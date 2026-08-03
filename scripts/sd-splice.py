#!/usr/bin/env python3
"""Splice authored question fragments back into patterns.md.

Usage: sd-splice.py <fragment.md> [...]
Each fragment must start with `### N. Title` matching an existing question.
"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "web/public/patterns.md")
text = open(P, encoding="utf-8").read()
for f in sys.argv[1:]:
    frag = open(f, encoding="utf-8").read().strip() + "\n"
    head = frag.split("\n", 1)[0]
    m = re.match(r"^### (\d+)\. ", head)
    if not m:
        sys.exit(f"{f}: does not start with '### N. '")
    n = int(m.group(1))
    pat = re.compile(rf"^### {n}\. .*?(?=^### \d+\. |\Z)", re.S | re.M)
    old = pat.search(text)
    if not old:
        sys.exit(f"{f}: question {n} not found in primer")
    if old.group(0).split("\n", 1)[0].strip() != head.strip():
        sys.exit(f"{f}: title changed\n  was {old.group(0).split(chr(10))[0]!r}\n  now {head!r}")
    text = text[: old.start()] + frag + "\n" + text[old.end():]
    print(f"spliced Q{n} ({len(frag.split())} words)")
text = re.sub(r"\n{3,}", "\n\n", text)
open(P, "w", encoding="utf-8").write(text)
