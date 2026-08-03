#!/usr/bin/env python3
"""Mechanically restructure patterns.md from 16 legacy sections to 14 new ones.

Deterministic, no model involved. Renames, merges and re-orders existing text;
splits the follow-up Q&A into separate drill and answer sections; and stubs the
four sections that need genuine authoring. Content is never dropped: the three
dissolved sections are carried into the section that will absorb them, under a
TODO marker, so the authoring pass has the raw material in place.

    python3 scripts/sd-transform.py --dry-run
    python3 scripts/sd-transform.py --items 25
    python3 scripts/sd-transform.py

Item headings are copied verbatim, so item ids never move.
"""

from __future__ import annotations

import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_MD = os.path.join(ROOT, "web/public/patterns.md")

NEW_ORDER = [
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


def split_items(text: str):
    out = []
    for m in re.finditer(r"^### (\d+)\. (.+)$", text, re.M):
        nxt = re.search(r"^### \d+\. ", text[m.end() :], re.M)
        end = m.end() + nxt.start() if nxt else len(text)
        out.append((int(m.group(1)), m.group(0), text[m.end() : end]))
    return out


def split_sections(body: str) -> dict[str, str]:
    """Fence-aware `#### Name` split. Preserves body text byte for byte."""
    out: list[tuple[str, list[str]]] = []
    in_fence = False
    for ln in body.split("\n"):
        if ln.startswith("```"):
            in_fence = not in_fence
        if not in_fence and ln.startswith("#### "):
            out.append((ln[5:].strip(), []))
        elif out:
            out[-1][1].append(ln)
    return {n: "\n".join(c).strip() for n, c in out}


def split_followups(text: str) -> list[tuple[str, str]]:
    """Split `**Q: ...**` + answer into (question, answer) pairs."""
    if not text.strip():
        return []
    parts = re.split(r"^\*\*Q:\s*(.+?)\*\*\s*$", text, flags=re.M)
    pairs = []
    for i in range(1, len(parts) - 1, 2):
        q = parts[i].strip()
        a = parts[i + 1].strip()
        if q:
            pairs.append((q, a))
    return pairs


def build(rid: int, secs: dict[str, str]) -> tuple[dict[str, str], list[str]]:
    notes: list[str] = []
    g = lambda k: secs.get(k, "").strip()  # noqa: E731
    new: dict[str, str] = {}

    new["Problem"] = g("Problem")

    new["Core"] = (
        "TODO\n\n"
        "Write the whole answer as you would give it in sixty seconds, 200 to 300 "
        "words, standing alone."
    )

    # Summary: keep the existing narrative, rename the block whose title
    # presupposed a single right answer, and slot in the plain-language survey
    # of approaches directly after the analogy.
    summary = g("Summary")
    before = summary
    summary = summary.replace(
        "**Why the standard solution works:**",
        "**Why this design and what it costs:**",
    ).replace(
        "**Why the standard solution works — and one weird trick (fail open):**",
        "**Why this design and what it costs:**",
    )
    if summary == before and "**Why" in summary:
        notes.append(f"Q{rid}: no 'Why the standard solution works' block to rename")

    approaches = (
        "**The approaches people actually take:**\n"
        "TODO. Two or three things a competent engineer might reach for, in plain "
        "language and before any product name, with what each one buys and roughly "
        "when it wins.\n"
    )
    # Insert directly after the analogy, i.e. before whichever block comes next.
    # Titles vary ("... walkthrough - prefill:", "(query path)"), and a few
    # questions have no walkthrough at all, so try a chain of prefixes.
    anchor = None
    for pat in (
        r"^\*\*The single-request walkthrough",
        r"^\*\*The write path",
        r"^\*\*The pieces",
        r"^\*\*The thing that makes it hard",
    ):
        anchor = re.search(pat, summary, re.M)
        if anchor:
            break
    if anchor:
        summary = (
            summary[: anchor.start()] + approaches + "\n" + summary[anchor.start() :]
        )
    else:
        paras = summary.split("\n\n")
        summary = "\n\n".join([paras[0], approaches.rstrip()] + paras[1:])
        notes.append(
            f"Q{rid}: no anchor block found, approaches placed after para 1"
        )
    new["Summary"] = summary

    new["What this is really testing"] = (
        "TODO\n\n"
        "The one insight this question exists to elicit, then the contrast with the "
        "question it most resembles and why the answers differ.\n\n"
        "Closest question: TODO"
    )

    new["Clarifying questions and how each answer forks the design"] = g(
        "Clarifying Questions"
    )

    req, scale = g("Requirements"), g("Scale Estimate")
    new["Requirements and scale, derived out loud"] = (
        f"**Requirements**\n\n{req}\n\n**Scale**\n\n{scale}".strip()
    )

    # Key decisions absorbs the old Algorithm Comparison (a real comparison, only
    # present in 3 questions) and Common Mistakes (each is usually the losing
    # side of a fork).
    kd = [
        "TODO\n\n"
        "Two or three genuine forks. For each, in this exact shape so it stays "
        "checkable:\n\n"
        "**<name of the fork>**\n"
        "- Choice:\n"
        "- Alternative:\n"
        "- Decider:\n"
        "- Alternative wins when:"
    ]
    if g("Algorithm Comparison"):
        kd.append(
            "**Raw material, from the old Algorithm Comparison:**\n\n"
            + g("Algorithm Comparison")
        )
    if g("Common Mistakes / Anti-patterns"):
        kd.append(
            "**Raw material, from the old Common Mistakes:**\n\n"
            + g("Common Mistakes / Anti-patterns")
        )
    new["Key decisions"] = "\n\n".join(kd)

    new["High-level design"] = "**must-say**\n\n" + g("High-Level Design")
    new["Deep dive"] = "**must-say**\n\n" + g("Detailed Design")

    wib = ["**must-say**"]
    if g("Bottlenecks & Mitigations"):
        wib.append("**Bottlenecks**\n\n" + g("Bottlenecks & Mitigations"))
    if g("Failure Modes"):
        wib.append("**Failure modes**\n\n" + g("Failure Modes"))
    wib.append(
        "**Unresolved**\n\nTODO. Two or three things this design genuinely does not "
        "handle well, and what you would do about each."
    )
    new["Where it breaks"] = "\n\n".join(wib)

    pairs = split_followups(g("Potential Follow-Up Questions"))
    if pairs:
        qs = "\n".join(f"{i}. {q}" for i, (q, _) in enumerate(pairs, 1))
        ans = "\n\n".join(f"{i}. {a}" for i, (_, a) in enumerate(pairs, 1))
        if len(pairs) < 10:
            qs += f"\n\nTODO. Only {len(pairs)} drill questions carried over, top up to at least 10."
        new["Drill questions"] = qs
        new["Answers to drill questions"] = ans
    else:
        notes.append(f"Q{rid}: no follow-ups parsed, drill sections stubbed")
        new["Drill questions"] = "TODO. Write 10 to 15 drill questions."
        new["Answers to drill questions"] = "TODO"

    ws = [
        "TODO\n\n"
        "A 45 minute budget: what to cover in 0-5, 5-15, 15-35 and 35-45, what to "
        "say first, and a line starting `Cut first:`."
    ]
    if g("Talking Points for the Interview"):
        ws.append(
            "**Raw material, from the old Talking Points:**\n\n"
            + g("Talking Points for the Interview")
        )
    new["Whiteboard script"] = "\n\n".join(ws)

    ap = []
    for label, key in (
        ("**Data model**", "Data Model"),
        ("**API contract**", "API Contract"),
        ("**Observability**", "Observability — Key Metrics & SLOs"),
        ("**Multi-region and DR**", "Multi-Region & DR"),
    ):
        if g(key):
            ap.append(f"{label}\n\n{g(key)}")
    new["Appendix"] = "\n\n".join(ap)

    return new, notes


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--items", help="comma-separated ids; default all")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    text = open(WEB_MD, encoding="utf-8").read()
    items = split_items(text)
    only = {int(x) for x in args.items.split(",")} if args.items else None

    # Everything before the first item heading: frontmatter and any preamble.
    out = [text[: text.index(items[0][1])].rstrip("\n")]
    all_notes: list[str] = []
    done = 0

    for rid, heading, body in items:
        secs = split_sections(body)
        already = "Core" in secs or "Key decisions" in secs
        if (only and rid not in only) or already:
            out.append(heading + body.rstrip("\n"))
            continue
        new, notes = build(rid, secs)
        all_notes += notes
        chunk = [heading]
        for name in NEW_ORDER:
            chunk.append(f"#### {name}\n{new[name].strip()}")
        out.append("\n".join(chunk))
        done += 1

    result = "\n\n".join(out) + "\n"
    result = re.sub(r"\n{3,}", "\n\n", result)

    for n in all_notes:
        print("NOTE ", n)
    print(f"transformed {done} question(s)")

    if args.dry_run:
        print("(dry run, nothing written)")
        return 0
    open(WEB_MD, "w", encoding="utf-8").write(result)
    print(f"wrote {WEB_MD}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
