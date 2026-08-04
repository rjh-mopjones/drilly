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

def build_cycle_list(vals, pos):
    """LeetCode's cycle encoding: values plus the index the tail links back to,
    or -1 for no cycle. Lets `Input: head = [3,2,0,-4], pos = 1` stay in the
    file's real LeetCode form while still being executable."""
    head = build_list(vals)
    if pos is None or pos < 0 or head is None:
        return head
    tail = head
    while tail.next:
        tail = tail.next
    entry = head
    for _ in range(pos):
        entry = entry.next
    tail.next = entry
    return head

def build_list_of_lists(arrs):
    """[[1,4,5],[1,3,4]] -> a list of ListNode heads (merge-k-lists shape)."""
    return [build_list(a) for a in (arrs or [])]

def build_random_list(a):
    """LeetCode's random-pointer encoding: [[val, randomIndex|null], ...].
    A random pointer cannot be written as a plain value array, so the index
    is resolved to the node it names once every node exists."""
    nodes = [Node(v) for v, _ in (a or [])]
    for i, (_, r) in enumerate(a or []):
        if i + 1 < len(nodes):
            nodes[i].next = nodes[i + 1]
        if r is not None:
            nodes[i].random = nodes[r]
    return nodes[0] if nodes else None

def dump_random_list(h):
    """Inverse of build_random_list, so a clone serialises like its original."""
    order, idx, cur = [], {}, h
    while cur is not None:
        idx[id(cur)] = len(order)
        order.append(cur)
        cur = cur.next
    return [[n.val, idx.get(id(n.random)) if n.random is not None else None]
            for n in order]

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
# "consume" lists Input keys that are NOT function parameters: they are extra
# arguments to that parameter's builder and are dropped before the call. This is
# what lets an example keep LeetCode's published shape when the signature is
# narrower than the problem statement.
OVERRIDES: dict[int, dict] = {
    # Clone Graph's parameter is `node`, too generic to key on globally, so the
    # graph adapter is bound per item instead.
    84: {"adapters": {"node": ("build_graph", "dump_graph")}},
    # hasCycle(head) takes no `pos`, but a cycle cannot be written as a JSON
    # array, so `pos` feeds the builder and never reaches the solution.
    44: {
        "adapters": {"head": ("build_cycle_list", "dump_list")},
        "consume": {"head": ["pos"]},
    },
    # copyRandomList's input is [[val, randomIndex|null], ...], which build_list
    # cannot express, and the clone has to be re-encoded the same way rather
    # than dumped as a plain value list.
    43: {
        "adapters": {"head": ("build_random_list", "dump_random_list")},
        "result": "dump_random_list",
    },
}

# Items whose Explanation snippet cannot reasonably be run against the examples
# (pure design classes where the "brute force" is a different data structure).
# validate_nc.py fails if this grows past the baseline, so it cannot rot quietly.
NAIVE_SKIP: set[int] = set()

# Items whose examples are only safe under `exact` because of a tie-break
# convention, not because the answer is unique. If the harness suddenly fails one
# of these after an edit, suspect the convention before suspecting the content.
TIE_SENSITIVE: dict[int, str] = {
    4: "Longest Palindromic Substring: 'babad' admits both 'bab' and 'aba'. "
       "The shipped solution and the naive snippet both scan i ascending and "
       "keep a strictly-longer match, so both return 'bab'. Preserve that scan "
       "order in either implementation or the example must change.",
}

# Deliberately no `any-valid`: it would need a per-item checker, and a mode that
# silently degrades to exact comparison is worse than not offering it. If a
# problem genuinely has several valid answers, pick an example whose answer is
# unique instead. #91 and #100 do exactly that.
COMPARE_MODES = {"exact", "any-order", "any-order-nested", "roundtrip"}
