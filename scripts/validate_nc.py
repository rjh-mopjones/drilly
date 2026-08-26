#!/usr/bin/env python3
"""Validate web/public/neetcode-250.md against the 9-section format.

Items are authored in batches, so an item still carrying a `TODO` Examples stub
is reported as unauthored rather than failing. --strict requires all 150.

    python3 scripts/validate_nc.py
    python3 scripts/validate_nc.py --items 1,9
    python3 scripts/validate_nc.py --strict
    python3 scripts/validate_nc.py --write-baseline

Exit 1 on any error. Warnings never fail unless a baselined count rises.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_MD = os.path.join(ROOT, "web/public/neetcode-250.md")
MOBILE_MD = os.path.join(ROOT, "mobile/assets/content/neetcode-250.md")
WEB_MANIFEST = os.path.join(ROOT, "web/public/manifest.json")
MOBILE_MANIFEST = os.path.join(ROOT, "mobile/assets/content/manifest.json")
UP_PARSER = os.path.join(ROOT, "packages/parser/src/parser.ts")
DN_PARSER = os.path.join(ROOT, "mobile/lib/parser.ts")
BASELINE = os.path.join(ROOT, "scripts/nc-baseline.json")

SECTIONS = [
    "Problem",
    "Examples",
    "Recognition",
    "Explanation",
    "Python",
    "Java",
    "Rust",
    "Go",
    "C++",
]
LANG_TAG = {
    "Python": "python",
    "Java": "java",
    "Rust": "rust",
    "Go": "go",
    "C++": "cpp",
}
COMPARE_MODES = {"exact", "any-order", "any-order-nested", "roundtrip"}
LINE_LIMIT = 70


class Report:
    def __init__(self):
        self.errors, self.warns = [], []

    def err(self, code, msg):
        self.errors.append((code, msg))

    def warn(self, code, msg):
        self.warns.append((code, msg))


def split_items(text):
    out = []
    for m in re.finditer(r"^### (\d+)\. (.+?)$", text, re.M):
        nxt = re.search(r"^### \d+\. ", text[m.end() :], re.M)
        end = m.end() + nxt.start() if nxt else len(text)
        out.append((int(m.group(1)), m.group(2).strip(), text[m.end() : end]))
    return out


def split_sections(body):
    """Fence-aware `#### Name` split."""
    out, in_fence = [], False
    for ln in body.split("\n"):
        if ln.startswith("```"):
            in_fence = not in_fence
        if not in_fence and ln.startswith("#### "):
            out.append((ln[5:].strip(), []))
        elif out:
            out[-1][1].append(ln)
    return [(n, "\n".join(c).strip()) for n, c in out]


def fences(text):
    """-> [(tag, body)] for every fence in text."""
    return re.findall(r"```(\w*)\n(.*?)\n```", text, re.S)


def strip_fences(s):
    return re.sub(r"```.*?```", "", s, flags=re.S)


def word_count(s):
    return len(re.sub(r"[*_`#|>-]", " ", strip_fences(s)).split())


def check_item(rid, title, secs, rep, strict):
    names = [n for n, _ in secs]
    by = dict(secs)

    dupes = {n for n in names if names.count(n) > 1}
    if dupes:
        rep.err("S2", f"#{rid}: duplicate section names {sorted(dupes)}")
    missing = [s for s in SECTIONS if s not in names]
    if missing:
        rep.err("S2", f"#{rid}: missing sections {missing}")
    extra = [n for n in names if n not in SECTIONS]
    if extra:
        rep.err("S2", f"#{rid}: unexpected sections {extra}")
    present = [n for n in names if n in SECTIONS]
    if present != [s for s in SECTIONS if s in present]:
        rep.err("S3", f"#{rid}: sections out of canonical order")

    authored = by.get("Examples", "").strip() != "TODO"
    if not authored:
        if strict:
            rep.err("S8", f"#{rid}: Examples still a TODO stub")
        return authored

    # --- Examples
    ex = by.get("Examples", "")
    fs = fences(ex)
    if len(fs) != 1 or fs[0][0] != "text":
        rep.err(
            "E1",
            f"#{rid}: Examples needs exactly one ```text fence, got {[t for t, _ in fs]}",
        )
    else:
        blk = fs[0][1]
        ins = re.findall(r"^Input:", blk, re.M)
        outs = re.findall(r"^Output:", blk, re.M)
        if not 2 <= len(ins) <= 3:
            rep.warn("E1", f"#{rid}: {len(ins)} Input: lines, want 2-3")
        if len(ins) != len(outs):
            rep.err("E1", f"#{rid}: {len(ins)} Input: vs {len(outs)} Output:")
        cons = re.findall(r"^Constraints:\s*$", blk, re.M)
        if len(cons) != 1:
            rep.err(
                "E1", f"#{rid}: needs exactly one Constraints: line, got {len(cons)}"
            )
        else:
            bullets = re.findall(r"^- .+$", blk, re.M)
            if len(bullets) < 2:
                rep.err(
                    "E1", f"#{rid}: Constraints needs >=2 bullets, got {len(bullets)}"
                )
        cm = re.findall(r"^Compare:\s*(\S+)\s*$", blk, re.M)
        if len(cm) > 1:
            rep.err("E2", f"#{rid}: {len(cm)} Compare: lines")
        for c in cm:
            if c not in COMPARE_MODES:
                rep.err("E2", f"#{rid}: unknown Compare mode {c!r}")
        for ln in blk.split("\n"):
            if ln.startswith("#"):
                rep.err("S4", f"#{rid}: column-0 '#' inside Examples: {ln[:40]!r}")
            if len(ln) > 65:
                rep.warn(
                    "W4", f"#{rid}: Examples line {len(ln)} chars (mobile soft-wrap)"
                )

    # --- Recognition
    rec = by.get("Recognition", "")
    for marker in ("**Signals.**", "**Therefore.**"):
        if marker not in rec:
            rep.err("R1", f"#{rid}: Recognition missing {marker}")
    if "**Not " not in rec:
        rep.err("R1", f"#{rid}: Recognition names no rejected neighbour (**Not X**)")
    if not re.search(r"\*\*O\(.+?\)\*\* time, \*\*O\(.+?\)\*\* space\.", rec):
        rep.err(
            "R1",
            f"#{rid}: Recognition must end with the **O(x)** time, **O(y)** space clause",
        )
    wc = word_count(rec)
    if not 80 <= wc <= 200:
        rep.warn("R1", f"#{rid}: Recognition {wc} words, want 80-200")

    # --- Explanation
    exp = by.get("Explanation", "")
    for marker in (
        "**Brute force.**",
        "**Wasteful because.**",
        "**Optimal.**",
        "**Edge cases.**",
    ):
        if marker not in exp:
            rep.err("X1", f"#{rid}: Explanation missing {marker}")
    ef = fences(exp)
    if len(ef) != 1 or ef[0][0] != "python":
        rep.err(
            "X2",
            f"#{rid}: Explanation needs exactly one ```python fence, got {[t for t, _ in ef]}",
        )
    wc = word_count(exp)
    if not 140 <= wc <= 320:
        rep.warn("X1", f"#{rid}: Explanation {wc} words outside fence, want 140-320")

    # --- language sections
    for sec, tag in LANG_TAG.items():
        c = by.get(sec, "")
        f = fences(c)
        if len(f) != 1:
            rep.err("L1", f"#{rid}: {sec} has {len(f)} fences, want 1")
        elif f[0][0] != tag:
            rep.err("L1", f"#{rid}: {sec} fence tagged {f[0][0]!r}, want {tag!r}")

    # exactly two python fences per item, Explanation + Python
    py_total = sum(1 for n, c in secs for t, _ in fences(c) if t == "python")
    if py_total != 2:
        rep.err("X2", f"#{rid}: {py_total} python fences in the item, want exactly 2")

    return authored


def check_global(text, rep, strict):
    in_fence = False
    for i, ln in enumerate(text.split("\n"), 1):
        if ln.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence and re.match(r"^(#### |### \d+\. )", ln):
            rep.err("S4", f"line {i}: heading inside a fence: {ln[:50]!r}")
    if in_fence:
        rep.err("S4", "unclosed fence at EOF")

    body = strip_fences(text)
    em = body.count("—")
    if em:
        (rep.err if strict else rep.warn)("C1", f"{em} em dashes outside fences")

    long_lines = 0
    for _, code in re.findall(r"```\w*\n(.*?)\n```", text, re.S) and [
        (None, c) for _, c in fences(text)
    ]:
        for ln in code.split("\n"):
            if len(ln) > LINE_LIMIT:
                long_lines += 1
    return {"emdashes": em, "long_lines": long_lines}


def check_config(rep):
    try:
        web = json.load(open(WEB_MANIFEST, encoding="utf-8"))
        mob = json.load(open(MOBILE_MANIFEST, encoding="utf-8"))
    except Exception as e:
        rep.err("S6", f"cannot read manifests: {e}")
        return
    we = next((s for s in web["sources"] if s["id"] == "neetcode"), None)
    me = next((s for s in mob["sources"] if s["id"] == "neetcode"), None)
    if we is None or me is None:
        rep.err("S6", "no 'neetcode' entry in one of the manifests")
        return
    if we != me:
        diff = [k for k in set(we) | set(me) if we.get(k) != me.get(k)]
        rep.err("S6", f"neetcode manifest entries differ on {diff}")
    if we.get("sectionOrder") != SECTIONS:
        rep.err(
            "S6",
            f"manifest sectionOrder is not the canonical 9: {we.get('sectionOrder')}",
        )
    for name in we.get("defaultRevealedSections", []):
        if name not in SECTIONS:
            rep.err("S7", f"defaultRevealedSections names {name!r}, not a real section")
    for path in (UP_PARSER, DN_PARSER):
        src = open(path, encoding="utf-8").read()
        blk = re.search(r"  neetcode: \{.*?\n  \},", src, re.S)
        if not blk:
            rep.err("S6", f"{os.path.relpath(path, ROOT)}: no neetcode block")
            continue
        got = re.findall(
            r'"([^"]+)",',
            re.search(r"sectionOrder: \[(.*?)\]", blk.group(0), re.S).group(1),
        )
        if got != SECTIONS:
            rep.err(
                "S6", f"{os.path.relpath(path, ROOT)}: sectionOrder {got} != canonical"
            )

    if os.path.exists(MOBILE_MD):
        if (
            open(MOBILE_MD, encoding="utf-8").read()
            != open(WEB_MD, encoding="utf-8").read()
        ):
            rep.err(
                "S5",
                "web and mobile copies of neetcode-250.md differ; re-copy the mirror",
            )
    else:
        rep.warn("S5", "mobile/assets/content/neetcode-250.md missing")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?", default=WEB_MD)
    ap.add_argument("--items")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--write-baseline", action="store_true")
    a = ap.parse_args()

    text = open(a.file, encoding="utf-8").read()
    rep = Report()
    items = split_items(text)

    ids = [i for i, _, _ in items]
    if len(items) != 250:
        rep.err("S1", f"{len(items)} items, want 250")
    if ids != sorted(ids):
        rep.err("S1", "item ids are not ascending")
    if len(set(ids)) != len(ids):
        rep.err("S1", "duplicate item ids")
    gaps = sorted(set(range(1, 151)) - set(ids))
    if gaps:
        rep.err("S1", f"missing ids {gaps[:10]}")

    only = {int(x) for x in a.items.split(",")} if a.items else None
    authored = 0
    for rid, title, body in items:
        secs = split_sections(body)
        if only and rid not in only:
            if (
                split_sections(body)
                and dict(secs).get("Examples", "").strip() != "TODO"
            ):
                authored += 1
            continue
        if check_item(rid, title, secs, rep, a.strict):
            authored += 1

    counts = check_global(text, rep, a.strict)
    check_config(rep)

    if a.write_baseline:
        json.dump(
            counts, open(BASELINE, "w", encoding="utf-8"), indent=1, sort_keys=True
        )
        print(f"wrote baseline {counts} to {BASELINE}")
    elif os.path.exists(BASELINE):
        base = json.load(open(BASELINE, encoding="utf-8"))
        for k, v in counts.items():
            if v > base.get(k, 0):
                rep.err("W0", f"{k} rose to {v} from baseline {base.get(k, 0)}")

    for c, m in rep.warns:
        print(f"WARN  [{c}] {m}")
    for c, m in rep.errors:
        print(f"ERROR [{c}] {m}")

    pct = 100 * authored // len(items) if items else 0
    print(
        f"\n{a.file}: {len(items)} items, {authored} authored ({pct}%), "
        f"{counts['emdashes']} em dashes, {counts['long_lines']} long code lines, "
        f"{len(rep.errors)} errors, {len(rep.warns)} warnings"
    )
    return 1 if rep.errors else 0


if __name__ == "__main__":
    sys.exit(main())
