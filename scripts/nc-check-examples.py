#!/usr/bin/env python3
"""Execute every NeetCode solution against its own stated examples.

This is the guard that makes the Examples sections trustworthy. It proves two
things at once: the shipped solution is correct, and the example was not
invented. With --naive it also runs the Explanation's brute-force snippet
against the same examples, so two independently written implementations have to
agree before an item passes.

    python3 scripts/nc-check-examples.py
    python3 scripts/nc-check-examples.py --items 1,9,27
    python3 scripts/nc-check-examples.py --no-naive --jobs 8

Exit 0 all green, 1 content failure, 2 harness misconfiguration.
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nc_harness import ADAPTERS, COMPARE_MODES, NAIVE_SKIP, OVERRIDES, PRELUDE  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD = os.path.join(ROOT, "web/public/neetcode-150.md")

OK, FAIL, ERROR, TIMEOUT, SKIP, MISCONF, NAIVE_MISMATCH = (
    "OK",
    "FAIL",
    "ERROR",
    "TIMEOUT",
    "SKIP",
    "MISCONF",
    "NAIVE",
)


def split_items(text):
    out = []
    for m in re.finditer(r"^### (\d+)\. (.+?)$", text, re.M):
        nxt = re.search(r"^### \d+\. ", text[m.end() :], re.M)
        end = m.end() + nxt.start() if nxt else len(text)
        out.append((int(m.group(1)), m.group(2).strip(), text[m.end() : end]))
    return out


def section(body, name):
    m = re.search(rf"^#### {re.escape(name)}\n(.*?)(?=^#### |\Z)", body, re.S | re.M)
    return m.group(1) if m else None


def fence(text, tag):
    if text is None:
        return None
    m = re.search(rf"```{tag}\n(.*?)\n```", text, re.S)
    return m.group(1) if m else None


def split_top_level(s):
    """Split `a = [1,2], b = 3` on commas at bracket depth 0."""
    parts, depth, cur, instr = [], 0, "", False
    i = 0
    while i < len(s):
        c = s[i]
        if instr:
            if c == "\\":
                cur += s[i : i + 2]
                i += 2
                continue
            if c == '"':
                instr = False
            cur += c
        else:
            if c == '"':
                instr = True
                cur += c
            elif c in "[{(":
                depth += 1
                cur += c
            elif c in "]})":
                depth -= 1
                cur += c
            elif c == "," and depth == 0:
                parts.append(cur)
                cur = ""
            else:
                cur += c
        i += 1
    if cur.strip():
        parts.append(cur)
    return [p.strip() for p in parts]


def parse_examples(block):
    """-> (examples, compare, error). Each example is (kwargs|ops, expected, out_name)."""
    if block is None:
        return [], "exact", "no Examples section"
    text = fence(block, "text")
    if text is None:
        return [], "exact", "Examples has no ```text fence"

    compare = "exact"
    m = re.search(r"^Compare:\s*(\S+)\s*$", text, re.M)
    if m:
        compare = m.group(1)
        if compare not in COMPARE_MODES:
            return [], compare, f"unknown Compare mode {compare!r}"

    # join continuation lines onto their Input:/Output: owner
    lines, buf = [], None
    for raw in text.split("\n"):
        if (
            re.match(r"^(Input|Output|Explanation|Compare|Constraints):", raw)
            or raw.startswith("- ")
            or not raw.strip()
        ):
            if buf is not None:
                lines.append(buf)
            buf = raw if raw.strip() else None
        elif buf is not None:
            buf += " " + raw.strip()
    if buf is not None:
        lines.append(buf)

    inputs = [l[len("Input:") :].strip() for l in lines if l.startswith("Input:")]
    outputs = [l[len("Output:") :].strip() for l in lines if l.startswith("Output:")]
    if not inputs:
        return [], compare, "no Input: line"
    if len(inputs) != len(outputs):
        return [], compare, f"{len(inputs)} Input: vs {len(outputs)} Output: lines"

    examples = []
    for ins, outs in zip(inputs, outputs):
        try:
            if "=" not in ins.split("[")[0]:
                # ops form: two top-level JSON arrays
                arrs = split_top_level(ins)
                if len(arrs) != 2:
                    return [], compare, "ops-form Input must be two arrays"
                payload = {
                    "__ops__": json.loads(arrs[0]),
                    "__args__": json.loads(arrs[1]),
                }
            else:
                payload = {}
                for part in split_top_level(ins):
                    k, _, v = part.partition("=")
                    payload[k.strip()] = json.loads(v.strip())
            out_name = None
            if re.match(r"^[A-Za-z_]\w*\s*=", outs):
                out_name, _, outs = outs.partition("=")
                out_name = out_name.strip()
            expected = json.loads(outs.strip())
        except (json.JSONDecodeError, ValueError) as e:
            return [], compare, f"unparseable example: {e}"
        examples.append((payload, expected, out_name))
    return examples, compare, None


def entry_point(code, keys, ops_form, compare, item_id):
    """Resolve the callable name without guessing at problem-specific names."""
    ov = OVERRIDES.get(item_id, {})
    if "entry" in ov:
        return ov["entry"], None
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return None, f"solution does not parse: {e}"
    defs = [n for n in tree.body if isinstance(n, ast.FunctionDef)]
    classes = [n for n in tree.body if isinstance(n, ast.ClassDef)]
    if ops_form:
        return (
            (ops_form, None)
            if any(c.name == ops_form for c in classes)
            else (
                None,
                f"ops form names class {ops_form!r}, not defined in the solution",
            )
        )
    if compare == "roundtrip":
        if len(defs) < 2:
            return None, "roundtrip needs two module-level defs"
        return (defs[0].name, defs[1].name), None
    # last module-level def whose params cover the Input keys
    for fn in reversed(defs):
        params = {a.arg for a in fn.args.args}
        if keys <= params:
            return fn.name, None
    if defs:
        return None, (
            f"no def covers Input keys {sorted(keys)}; "
            f"last def is {defs[-1].name}({', '.join(a.arg for a in defs[-1].args.args)})"
        )
    return None, "no module-level def in the Python section"


RUNNER = r"""
def __nc_dump__(v):
    if v is None or isinstance(v, (int, float, str, bool)):
        return v
    if isinstance(v, ListNode):
        return dump_list(v)
    if isinstance(v, TreeNode):
        return dump_tree(v)
    if isinstance(v, Node):
        return dump_graph(v)
    if isinstance(v, (list, tuple)):
        return [__nc_dump__(x) for x in v]
    if isinstance(v, dict):
        return {k: __nc_dump__(x) for k, x in v.items()}
    return v

def __nc_main__(spec):
    import copy
    results = []
    for payload, out_name in spec["examples"]:
        try:
            if "__ops__" in payload:
                ops, args = payload["__ops__"], payload["__args__"]
                cls = globals()[ops[0]]
                obj = cls(*args[0]); res = [None]
                for op, a in zip(ops[1:], args[1:]):
                    res.append(__nc_dump__(getattr(obj, op)(*a)))
                results.append({"ok": True, "value": res})
                continue
            kw = {}
            consume = spec.get("consume", {})
            extra_keys = {x for xs in consume.values() for x in xs}
            for k, v in payload.items():
                if k in extra_keys:
                    continue
                b = spec["adapters"].get(k)
                # Adapters are inferred from parameter name, and names like p/q
                # are used both for tree roots (#53, #55) and for plain strings
                # (#122's regex pattern). Every builder takes an array, so only
                # apply one when the value actually is one.
                if b and not isinstance(v, list):
                    b = None
                if b:
                    extra = [copy.deepcopy(payload[e]) for e in consume.get(k, [])]
                    kw[k] = globals()[b](copy.deepcopy(v), *extra)
                else:
                    kw[k] = copy.deepcopy(v)
            entry = spec["entry"]
            if isinstance(entry, list):
                f1, f2 = globals()[entry[0]], globals()[entry[1]]
                results.append({"ok": True, "value": __nc_dump__(f2(f1(*kw.values())))})
                continue
            rd = spec.get("result")
            dump = globals()[rd] if rd else __nc_dump__
            out = globals()[entry](**kw)
            if out_name is not None:
                results.append({"ok": True, "value": dump(kw[out_name])})
            else:
                results.append({"ok": True, "value": dump(out)})
        except Exception as e:
            results.append({"ok": False, "error": type(e).__name__ + ": " + str(e)})
    print("__NC__" + json.dumps(results))
"""

LIMITS = r"""
try:
    import resource
    resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
    resource.setrlimit(resource.RLIMIT_AS, (512 << 20, 512 << 20))
except Exception:
    pass
"""


def run_solution(code, entry, adapters, examples, timeout, consume=None, result=None):
    consume = consume or {}
    spec = {
        "entry": list(entry) if isinstance(entry, tuple) else entry,
        "adapters": adapters,
        "examples": [[p, o] for p, _, o in examples],
        "consume": consume,
        "result": result,
    }
    # The spec is JSON, not Python: `null`/`true` are not Python literals, so it
    # must be parsed inside the driver rather than interpolated as source.
    src = (
        LIMITS
        + PRELUDE
        + "\n"
        + code
        + "\n"
        + RUNNER
        + "\n__nc_main__(json.loads("
        + repr(json.dumps(spec))
        + "))\n"
    )
    try:
        proc = subprocess.run(
            [sys.executable, "-I", "-"],
            input=src,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return None, "timeout"
    for line in proc.stdout.split("\n"):
        if line.startswith("__NC__"):
            return json.loads(line[6:]), None
    err = (proc.stderr or proc.stdout).strip().split("\n")
    return None, err[-1] if err and err[-1] else "no output from solution"


def canon(v, mode):
    if mode in ("exact", "roundtrip"):
        return v
    if mode == "any-order":
        return sorted(map(repr, v)) if isinstance(v, list) else v
    if mode == "any-order-nested":
        if isinstance(v, list):
            return sorted(
                tuple(sorted(map(repr, x))) if isinstance(x, list) else repr(x)
                for x in v
            )
        return v
    return v


def check_item(args_tuple):
    item_id, title, body, opts = args_tuple
    ex_block = section(body, "Examples")
    if ex_block is None or ex_block.strip() == "TODO":
        return (SKIP, item_id, title, "Examples not authored yet", [])

    examples, compare, err = parse_examples(ex_block)
    if err:
        return (MISCONF, item_id, title, err, [])

    py = fence(section(body, "Python"), "python")
    if py is None:
        return (MISCONF, item_id, title, "no python fence in the Python section", [])

    ops_form = None
    if examples and "__ops__" in examples[0][0]:
        ops_form = examples[0][0]["__ops__"][0]
    keys = set() if ops_form else set(examples[0][0])
    consume = OVERRIDES.get(item_id, {}).get("consume", {})
    consumed = {x for xs in consume.values() for x in xs}
    entry, err = entry_point(py, keys - consumed, ops_form, compare, item_id)
    if err:
        return (MISCONF, item_id, title, err, [])

    ov = OVERRIDES.get(item_id, {})
    adapters = {k: v[0] for k, v in ADAPTERS.items() if k in keys}
    adapters.update({k: v[0] for k, v in ov.get("adapters", {}).items()})

    results, rerr = run_solution(
        py, entry, adapters, examples, opts["timeout"], consume, ov.get("result")
    )
    if rerr == "timeout":
        return (TIMEOUT, item_id, title, f">{opts['timeout']}s, killed", [])
    if results is None:
        return (ERROR, item_id, title, rerr, [])

    fails = []
    for i, (r, (payload, expected, out_name)) in enumerate(zip(results, examples), 1):
        if not r["ok"]:
            fails.append((i, payload, expected, None, r["error"]))
        elif canon(r["value"], compare) != canon(expected, compare):
            fails.append((i, payload, expected, r["value"], None))
    if fails:
        return (FAIL, item_id, title, compare, fails)

    if opts["naive"] and item_id not in NAIVE_SKIP:
        nv = fence(section(body, "Explanation"), "python")
        if nv is not None:
            nres, nerr = run_solution(
                nv,
                entry,
                adapters,
                examples,
                opts["timeout"],
                consume,
                ov.get("result"),
            )
            if nres is not None:
                for i, (r, (_, expected, _)) in enumerate(zip(nres, examples), 1):
                    if r["ok"] and canon(r["value"], compare) != canon(
                        expected, compare
                    ):
                        return (
                            NAIVE_MISMATCH,
                            item_id,
                            title,
                            f"example {i}: naive={r['value']!r} expected={expected!r}",
                            [],
                        )
    return (OK, item_id, title, "", [])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--items")
    ap.add_argument("--no-naive", dest="naive", action="store_false", default=True)
    ap.add_argument("--timeout", type=int, default=5)
    ap.add_argument("--jobs", type=int, default=8)
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()

    text = open(MD, encoding="utf-8").read()
    items = split_items(text)
    if a.items:
        want = {int(x) for x in a.items.split(",")}
        items = [i for i in items if i[0] in want]

    opts = {"naive": a.naive, "timeout": a.timeout}
    payload = [(i, t, b, opts) for i, t, b in items]
    with ProcessPoolExecutor(max_workers=a.jobs) as ex:
        out = list(ex.map(check_item, payload))

    counts, examples_run = {}, 0
    for status, iid, title, detail, fails in sorted(out, key=lambda r: r[1]):
        counts[status] = counts.get(status, 0) + 1
        if status == OK:
            continue
        if status == SKIP and a.quiet:
            continue
        print(f"{status:7} #{iid:<4}{title}")
        if status == FAIL:
            print(f"        compare  {detail}")
            for n, payload_, expected, actual, exc in fails:
                args = ", ".join(f"{k}={v!r}" for k, v in payload_.items())
                print(f"        example {n}  ({args[:90]})")
                if exc:
                    print(f"          exception {exc}")
                else:
                    print(f"          expected  {expected!r}")
                    print(f"          actual    {actual!r}")
        elif detail:
            print(f"        {detail}")

    total = len(out)
    line = " · ".join(f"{v} {k.lower()}" for k, v in sorted(counts.items()))
    print(f"\n{total} items · {line}")

    if counts.get(MISCONF):
        return 2
    if any(counts.get(s) for s in (FAIL, ERROR, TIMEOUT, NAIVE_MISMATCH)):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
