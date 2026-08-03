#!/usr/bin/env python3
"""Validate web/public/patterns.md against the 14-section System Design format.

The file is migrated question by question, so every question is classified as
either LEGACY (the old 16-section shape) or MIGRATED (the new 14-section one).
Structural and content rules are only enforced on migrated questions; legacy
ones are counted and reported so progress is visible.

Usage:
    python3 scripts/validate_sd.py
    python3 scripts/validate_sd.py --items 25,42
    python3 scripts/validate_sd.py --strict          # every question must be migrated
    python3 scripts/validate_sd.py --write-baseline  # record current counts
    python3 scripts/validate_sd.py --write-svg-hashes

Exit 1 on any error, 0 otherwise. Warnings never fail the run.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_MD = os.path.join(ROOT, "web/public/patterns.md")
MOBILE_MD = os.path.join(ROOT, "mobile/assets/content/patterns.md")
WEB_MANIFEST = os.path.join(ROOT, "web/public/manifest.json")
MOBILE_MANIFEST = os.path.join(ROOT, "mobile/assets/content/manifest.json")
SVG_HASHES = os.path.join(ROOT, "scripts/sd-svg-hashes.json")
BASELINE = os.path.join(ROOT, "scripts/sd-baseline.json")

# The target format. Order is significant: it is asserted against the file so
# sortSections() stays a no-op and the raw markdown reads correctly.
SECTIONS = [
    "Problem",
    "Core",
    "Summary",
    "What this is really testing",
    "Clarifying questions and how each answer forks the design",
    "Requirements and scale, derived out loud",
    "Key decisions",
    "High-level design",
    "Deep dive",
    "Where it breaks",
    "Drill questions",
    "Answers to drill questions",
    "Whiteboard script",
    "Appendix",
]

LEGACY_SECTIONS = [
    "Problem",
    "Summary",
    "Clarifying Questions",
    "Requirements",
    "Scale Estimate",
    "API Contract",
    "High-Level Design",
    "Data Model",
    "Algorithm Comparison",
    "Detailed Design",
    "Potential Follow-Up Questions",
    "Bottlenecks & Mitigations",
    "Failure Modes",
    "Observability — Key Metrics & SLOs",
    "Multi-Region & DR",
    "Common Mistakes / Anti-patterns",
    "Talking Points for the Interview",
]

# Sections that must open with a must-say / if-there-is-time marker.
MARKED = {"High-level design", "Deep dive", "Where it breaks"}
MARKER_RE = re.compile(r"^\*\*(must-say|if there is time)\*\*$")

STUB = "TODO"


class Report:
    def __init__(self) -> None:
        self.errors: list[tuple[str, str]] = []
        self.warns: list[tuple[str, str]] = []

    def err(self, code: str, msg: str) -> None:
        self.errors.append((code, msg))

    def warn(self, code: str, msg: str) -> None:
        self.warns.append((code, msg))


def split_items(text: str) -> list[tuple[int, str, str]]:
    """Return [(id, title, body)] for each `### N. Title` item."""
    out = []
    for m in re.finditer(r"^### (\d+)\. (.+)$", text, re.M):
        start = m.start()
        nxt = re.search(r"^### \d+\. ", text[m.end() :], re.M)
        end = m.end() + nxt.start() if nxt else len(text)
        out.append((int(m.group(1)), m.group(2).strip(), text[start:end]))
    return out


def split_sections(body: str) -> list[tuple[str, str]]:
    """Return [(name, content)] for `#### Name` sections, fence-aware."""
    lines = body.split("\n")
    out: list[tuple[str, list[str]]] = []
    in_fence = False
    for ln in lines:
        if ln.startswith("```"):
            in_fence = not in_fence
        if not in_fence and ln.startswith("#### "):
            out.append((ln[5:].strip(), []))
        elif out:
            out[-1][1].append(ln)
    return [(n, "\n".join(c).strip()) for n, c in out]


def strip_fences(s: str) -> str:
    return re.sub(r"```.*?```", "", s, flags=re.S)


def word_count(s: str) -> int:
    s = strip_fences(s)
    s = re.sub(r"[*_`#|>-]", " ", s)
    return len(s.split())


def check_fences(rid: int, body: str, rep: Report) -> None:
    in_fence = False
    opened_at = 0
    for i, ln in enumerate(body.split("\n"), 1):
        if ln.startswith("```"):
            in_fence = not in_fence
            if in_fence:
                opened_at = i
            continue
        if in_fence:
            if ln.startswith("#"):
                rep.err(
                    "F2",
                    f"Q{rid} line {i}: line-start '#' inside fence opened at {opened_at}: {ln[:50]!r}",
                )
    if in_fence:
        rep.err("F1", f"Q{rid}: unclosed fence opened at line {opened_at}")


def check_svgs(
    rid: int, body: str, rep: Report, hashes: dict | None, collect: dict
) -> None:
    for n, block in enumerate(re.findall(r"```svg\n(.*?)\n```", body, re.S), 1):
        key = f"{rid}:{n}"
        collect[key] = hashlib.sha256(block.encode()).hexdigest()
        stripped = block.lstrip()
        if not stripped.startswith("<svg"):
            rep.err("V1", f"Q{rid} svg#{n}: does not start with '<svg'")
        if "viewBox=" not in block:
            rep.err("V2", f"Q{rid} svg#{n}: missing viewBox")
        try:
            ET.fromstring(block)
        except ET.ParseError as e:
            rep.err("V3", f"Q{rid} svg#{n}: XML parse error: {e}")
        if "currentColor" not in block:
            rep.err("V4", f"Q{rid} svg#{n}: no currentColor, will not theme")
        if re.search(r'(?:fill|stroke)="#[0-9a-fA-F]{3,8}"', block):
            rep.err("V4", f"Q{rid} svg#{n}: hardcoded hex colour")
        if hashes is not None and key in hashes and hashes[key] != collect[key]:
            rep.err(
                "V5",
                f"Q{rid} svg#{n}: content changed vs baseline. Re-run with --write-svg-hashes if intended.",
            )


def check_migrated(
    rid: int, secs: list[tuple[str, str]], rep: Report, allow_stub: bool
) -> None:
    names = [n for n, _ in secs]
    by_name = dict(secs)

    dupes = {n for n in names if names.count(n) > 1}
    if dupes:
        rep.err(
            "S2",
            f"Q{rid}: duplicate section names {sorted(dupes)} (collide on React key and reveal Set)",
        )

    missing = [s for s in SECTIONS if s not in names]
    if missing:
        rep.err("S3", f"Q{rid}: missing sections {missing}")
    extra = [n for n in names if n not in SECTIONS]
    if extra:
        rep.err(
            "S4", f"Q{rid}: unexpected section names {extra} (would sort to rank 999)"
        )
    present = [n for n in names if n in SECTIONS]
    if present != [s for s in SECTIONS if s in present]:
        rep.err("S5", f"Q{rid}: sections out of canonical order")

    # A section is "unfinished" if it has a line that is exactly TODO. The
    # mechanical transform emits those, sometimes above seed material carried
    # over from a dissolved section, so authoring has the raw text to hand.
    def stub(name: str) -> bool:
        return bool(re.search(r"^TODO\b", by_name.get(name, ""), re.M))

    # C1 Core word cap
    core = by_name.get("Core", "")
    if core and not (allow_stub and stub("Core")):
        wc = word_count(core)
        if wc > 300:
            rep.err("C1", f"Q{rid}: Core is {wc} words, cap is 300")
        elif wc < 150:
            rep.warn("C1", f"Q{rid}: Core is only {wc} words")
        if "```" in core or "\n|" in core:
            rep.warn(
                "C1", f"Q{rid}: Core contains a fence or table; it should be prose"
            )

    # C5 must-say markers
    for name in MARKED:
        c = by_name.get(name)
        if c is None or (allow_stub and c.strip() == STUB):
            continue
        first = next((l for l in c.split("\n") if l.strip()), "")
        if not MARKER_RE.match(first.strip()):
            rep.err(
                "C5",
                f"Q{rid}: '{name}' must open with **must-say** or **if there is time**, got {first[:40]!r}",
            )

    # C6 Unresolved
    wb = by_name.get("Where it breaks", "")
    if wb and "**Unresolved**" not in wb:
        rep.err("C6", f"Q{rid}: 'Where it breaks' has no **Unresolved** subsection")

    # C3/C4 drill questions and matching answers
    dq = by_name.get("Drill questions", "")
    ans = by_name.get("Answers to drill questions", "")
    if dq and not (allow_stub and stub("Drill questions")):
        qn = [int(m.group(1)) for m in re.finditer(r"^(\d+)\.\s", dq, re.M)]
        if not 10 <= len(qn) <= 15:
            rep.err("C3", f"Q{rid}: {len(qn)} drill questions, want 10-15")
        if ans and not (allow_stub and stub("Answers to drill questions")):
            an = [int(m.group(1)) for m in re.finditer(r"^(\d+)\.\s", ans, re.M)]
            if set(qn) != set(an):
                rep.err(
                    "C4", f"Q{rid}: drill numbering {qn} does not match answers {an}"
                )

    # C7 fork table
    cq = by_name.get("Clarifying questions and how each answer forks the design", "")
    if cq and not (allow_stub and stub("Clarifying questions and how each answer forks the design")) and "|---" not in cq.replace(" ", ""):
        rep.warn("C7", f"Q{rid}: clarifying section has no markdown table")

    # C8 arithmetic shown
    rs = by_name.get("Requirements and scale, derived out loud", "")
    if rs and not (allow_stub and stub("Requirements and scale, derived out loud")):
        if not re.search(r"\d.*[×*/+].*=", rs):
            rep.warn("C8", f"Q{rid}: scale section shows no arithmetic")

    # C9 Key decisions micro-schema
    kd = by_name.get("Key decisions", "")
    if kd and not (allow_stub and stub("Key decisions")):
        choices = re.findall(r"^- Choice:", kd, re.M)
        alts = re.findall(r"^- Alternative:", kd, re.M)
        deciders = re.findall(r"^- Decider:(.*)$", kd, re.M)
        wins = re.findall(r"^- Alternative wins when:", kd, re.M)
        n = len(choices)
        if not 2 <= n <= 3:
            rep.err("C9", f"Q{rid}: {n} forks in Key decisions, want 2-3")
        if not (n == len(alts) == len(deciders) == len(wins)):
            rep.err(
                "C9",
                f"Q{rid}: fork schema incomplete (Choice {n}, Alternative {len(alts)}, Decider {len(deciders)}, wins-when {len(wins)})",
            )
        for d in deciders:
            if not re.search(r"\d", d):
                rep.warn("C9", f"Q{rid}: decider has no number: {d.strip()[:60]!r}")

    # C10 nearest-question contrast
    wt = by_name.get("What this is really testing", "")
    if wt and not (allow_stub and stub("What this is really testing")):
        m = re.search(r"^Closest question: Q(\d+)\b", wt, re.M)
        if not m:
            rep.err(
                "C10",
                f"Q{rid}: 'What this is really testing' needs a line 'Closest question: Q<n>'",
            )
        elif int(m.group(1)) == rid:
            rep.err("C10", f"Q{rid}: closest question points at itself")

    # C11 whiteboard budget
    ws = by_name.get("Whiteboard script", "")
    if ws and not (allow_stub and stub("Whiteboard script")):
        for band in ("0-5", "5-15", "15-35", "35-45"):
            if band not in ws:
                rep.err("C11", f"Q{rid}: whiteboard script missing the {band} band")
        if "Cut first:" not in ws:
            rep.err("C11", f"Q{rid}: whiteboard script missing 'Cut first:'")

    # C12 appendix contents
    ap = by_name.get("Appendix", "")
    if ap and not (allow_stub and stub("Appendix")):
        for want in (
            "**Data model**",
            "**API contract**",
            "**Observability**",
            "**Multi-region and DR**",
        ):
            if want not in ap:
                rep.warn("C12", f"Q{rid}: appendix missing {want}")

    if not allow_stub:
        stubs = [n for n in SECTIONS if stub(n)]
        if stubs:
            rep.err("S9", f"Q{rid}: unfilled stubs {stubs}")


def check_manifests(rep: Report, strict: bool) -> None:
    try:
        web = json.load(open(WEB_MANIFEST, encoding="utf-8"))
        mob = json.load(open(MOBILE_MANIFEST, encoding="utf-8"))
    except Exception as e:  # pragma: no cover
        rep.err("S6", f"cannot read manifests: {e}")
        return

    def entry(m):
        return next((s for s in m["sources"] if s["id"] == "patterns"), None)

    we, me = entry(web), entry(mob)
    if we is None or me is None:
        rep.err("S6", "no 'patterns' entry in one of the manifests")
        return
    if we != me:
        diff = [k for k in set(we) | set(me) if we.get(k) != me.get(k)]
        rep.err(
            "S6", f"manifest 'patterns' entries differ between web and mobile on {diff}"
        )
    for name in we.get("defaultRevealedSections", []):
        if name not in SECTIONS and name not in LEGACY_SECTIONS:
            rep.err(
                "S7",
                f"defaultRevealedSections names {name!r}, which is not a real section",
            )
    if strict and we.get("sectionOrder") != SECTIONS:
        rep.err(
            "S6",
            "sectionOrder is not the final 14-section array (required under --strict)",
        )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?", default=WEB_MD)
    ap.add_argument("--items", help="comma-separated question ids to check")
    ap.add_argument(
        "--strict",
        action="store_true",
        help="all questions must be migrated, no stubs, no em dashes",
    )
    ap.add_argument("--allow-stub", action="store_true", default=True)
    ap.add_argument("--no-allow-stub", dest="allow_stub", action="store_false")
    ap.add_argument("--write-baseline", action="store_true")
    ap.add_argument("--write-svg-hashes", action="store_true")
    args = ap.parse_args()

    text = open(args.file, encoding="utf-8").read()
    rep = Report()
    items = split_items(text)

    if not items:
        print("no `### N.` items found")
        return 1

    only = {int(x) for x in args.items.split(",")} if args.items else None

    hashes = None
    if os.path.exists(SVG_HASHES) and not args.write_svg_hashes:
        hashes = json.load(open(SVG_HASHES, encoding="utf-8"))
    collected: dict[str, str] = {}

    ids = [i for i, _, _ in items]
    if len(set(ids)) != len(ids):
        rep.err("S1", f"duplicate item ids: {[i for i in ids if ids.count(i) > 1]}")

    migrated, legacy, emdash_total = [], [], 0

    for rid, title, body in items:
        secs = split_sections(body)
        names = [n for n, _ in secs]
        is_migrated = "Core" in names or "Key decisions" in names

        check_fences(rid, body, rep)
        check_svgs(rid, body, rep, hashes, collected)

        em = strip_fences(body).count("—")
        emdash_total += em

        if only and rid not in only:
            (migrated if is_migrated else legacy).append(rid)
            continue

        if is_migrated:
            migrated.append(rid)
            check_migrated(rid, secs, rep, args.allow_stub and not args.strict)
            # The em-dash rule applies to authored prose, not to text the
            # mechanical transform merely relocated. A question still carrying
            # a TODO has not been through the style pass yet.
            unfinished = any(
                re.search(r"^TODO\b", c, re.M) for _, c in secs
            )
            if em and not (unfinished and not args.strict):
                rep.err(
                    "C2",
                    f"Q{rid}: {em} em dashes outside fences (authored questions must have none)",
                )
            elif em and unfinished:
                rep.warn("C2", f"Q{rid}: {em} em dashes, still to do in the style pass")
        else:
            legacy.append(rid)
            if args.strict:
                rep.err("S3", f"Q{rid}: still in legacy 16-section format")
            missing = [s for s in ("Problem", "Summary") if s not in names]
            if missing:
                rep.err(
                    "S7", f"Q{rid}: legacy question missing frozen section(s) {missing}"
                )

    check_manifests(rep, args.strict)

    if os.path.exists(MOBILE_MD):
        if open(MOBILE_MD, encoding="utf-8").read() != text and args.file == WEB_MD:
            rep.err(
                "S8",
                "web/public/patterns.md and mobile/assets/content/patterns.md differ; re-copy the mirror",
            )
    else:
        rep.warn("S8", "mobile/assets/content/patterns.md missing")

    # Removed diagrams are as much a regression as altered ones; the per-block
    # hash check above only sees blocks that still exist.
    if hashes is not None:
        gone = sorted(set(hashes) - set(collected), key=lambda k: (int(k.split(":")[0]), k))
        if gone:
            rep.err(
                "V6",
                f"{len(gone)} svg block(s) removed vs baseline: {gone}. "
                "Re-run with --write-svg-hashes if the removal is intended.",
            )

    if args.write_svg_hashes:
        json.dump(
            collected, open(SVG_HASHES, "w", encoding="utf-8"), indent=1, sort_keys=True
        )
        print(f"wrote {len(collected)} svg hashes to {SVG_HASHES}")
    if args.write_baseline:
        counts: dict[str, int] = {}
        for code, _ in rep.errors:
            counts[code] = counts.get(code, 0) + 1
        json.dump(
            {"errors": counts, "emdashes": emdash_total},
            open(BASELINE, "w", encoding="utf-8"),
            indent=1,
            sort_keys=True,
        )
        print(f"wrote baseline to {BASELINE}")

    for code, msg in rep.warns:
        print(f"WARN  [{code}] {msg}")
    for code, msg in rep.errors:
        print(f"ERROR [{code}] {msg}")

    pct = 100 * len(migrated) // len(items) if items else 0
    print(
        f"\n{args.file}: {len(items)} questions, "
        f"{len(migrated)} migrated ({pct}%), {len(legacy)} legacy, "
        f"{len(collected)} svgs, {emdash_total} em dashes, "
        f"{len(rep.errors)} errors, {len(rep.warns)} warnings"
    )
    if legacy and not args.strict:
        head = ", ".join(f"Q{i}" for i in legacy[:12])
        print(f"legacy: {head}{' ...' if len(legacy) > 12 else ''}")

    return 1 if rep.errors else 0


if __name__ == "__main__":
    sys.exit(main())
