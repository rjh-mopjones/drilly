"""Shared machinery for nc-check-examples.py.

Everything in here is the stuff a reader should never have to see: the LeetCode
preamble classes, the adapters that turn a JSON example into the object a
solution expects, and the checkers for problems whose answer is not unique.

Keeping it out of the markdown is deliberate. The file teaches algorithms; it
should not carry `class ListNode` 40 times.
"""

from __future__ import annotations

# Injected before every solution. LeetCode supplies these for free, which is why
# several solutions in the file reference them without defining them.
PRELUDE = '''
import json, sys, collections, heapq, bisect, math, functools, itertools, re
from collections import defaultdict, deque, Counter, OrderedDict
sys.setrecursionlimit(20000)

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val; self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val; self.left = left; self.right = right

class Node:
    """Serves the several distinct LeetCode `Node` shapes (graph, random-pointer,
    n-ary). Extra kwargs are tolerated so one class covers all of them."""
    def __init__(self, val=0, neighbors=None, next=None, random=None,
                 children=None, left=None, right=None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []
        self.next = next
        self.random = random
        self.children = children if children is not None else []
        self.left = left
        self.right = right

def build_list(a):
    head = None
    for v in reversed(a or []):
        head = ListNode(v, head)
    return head

def dump_list(h):
    out = []
    seen = set()
    while h is not None:
        if id(h) in seen:          # cycle: stop rather than hang
            out.append("...cycle")
            break
        seen.add(id(h)); out.append(h.val); h = h.next
    return out

def build_tree(a):
    """LeetCode level-order with null holes."""
    if not a or a[0] is None:
        return None
    root = TreeNode(a[0])
    q = deque([root]); i = 1
    while q and i < len(a):
        n = q.popleft()
        if i < len(a):
            v = a[i]; i += 1
            if v is not None:
                n.left = TreeNode(v); q.append(n.left)
        if i < len(a):
            v = a[i]; i += 1
            if v is not None:
                n.right = TreeNode(v); q.append(n.right)
    return root

def dump_tree(r):
    if r is None:
        return []
    out = []; q = deque([r])
    while q:
        n = q.popleft()
        if n is None:
            out.append(None); continue
        out.append(n.val); q.append(n.left); q.append(n.right)
    while out and out[-1] is None:
        out.pop()
    return out

def build_graph(adj):
    """adjList is 1-indexed in LeetCode's encoding."""
    if not adj:
        return None
    nodes = [Node(i + 1) for i in range(len(adj))]
    for i, nbrs in enumerate(adj):
        nodes[i].neighbors = [nodes[j - 1] for j in nbrs]
    return nodes[0]

def build_list_of_lists(arrs):
    """[[1,4,5],[1,3,4]] -> a list of ListNode heads (merge-k-lists shape)."""
    return [build_list(a) for a in (arrs or [])]

def dump_graph(n):
    if n is None:
        return []
    seen = {}; order = []
    st = [n]
    while st:
        cur = st.pop()
        if cur.val in seen:
            continue
        seen[cur.val] = cur; order.append(cur)
        for nb in cur.neighbors:
            if nb.val not in seen:
                st.append(nb)
    order.sort(key=lambda x: x.val)
    return [sorted(nb.val for nb in c.neighbors) for c in order]
'''

# Parameter name -> adapter. Applied to the JSON value before the call, and the
# inverse applied to the result. Inferred by name; override per item below.
ADAPTERS: dict[str, tuple[str, str]] = {
    "head": ("build_list", "dump_list"),
    "l1": ("build_list", "dump_list"),
    "l2": ("build_list", "dump_list"),
    "list1": ("build_list", "dump_list"),
    "list2": ("build_list", "dump_list"),
    "lists": ("build_list_of_lists", "dump_list"),
    "root": ("build_tree", "dump_tree"),
    "subRoot": ("build_tree", "dump_tree"),
    "p": ("build_tree", "dump_tree"),
    "q": ("build_tree", "dump_tree"),
    "adjList": ("build_graph", "dump_graph"),
}

# item id -> {"entry": name, "adapters": {param: (build, dump)}, "result": dump}
OVERRIDES: dict[int, dict] = {}

# Items whose Explanation snippet cannot reasonably be run against the examples
# (pure design classes where the "brute force" is a different data structure).
# validate_nc.py fails if this grows past the baseline, so it cannot rot quietly.
NAIVE_SKIP: set[int] = set()

# item id -> callable(inputs: dict, actual) -> bool, for Compare: any-valid
CHECKERS: dict[int, str] = {}

COMPARE_MODES = {"exact", "any-order", "any-order-nested", "any-valid", "roundtrip"}
