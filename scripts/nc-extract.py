#!/usr/bin/env python3
"""Print one question from patterns.md to stdout. Usage: sd-extract.py 25"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
n = int(sys.argv[1])
t = open(os.path.join(ROOT, "web/public/neetcode-250.md"), encoding="utf-8").read()
m = re.search(rf"^### {n}\. .*?(?=^### \d+\. |\Z)", t, re.S | re.M)
if not m:
    sys.exit(f"question {n} not found")
sys.stdout.write(m.group(0).rstrip() + "\n")
