"""Regex-based editing of the diagram spec TS files (consistent 2-space formatting).
Node blocks: `    {` ... `    },` at indent 4 with `      id: "x",` at indent 6.
Edge blocks: same shape inside `edges: [`."""
import re, sys

def load(path):
    return open(path).read()

def save(path, t):
    open(path, 'w').write(t)

def block_span(t, id_):
    """Return (start, end) of the `    {` ... `    },` block whose id is id_."""
    m = re.search(r'^    \{\n      id: "%s",\n' % re.escape(id_), t, re.M)
    if not m:
        raise KeyError(id_)
    start = m.start()
    end = t.index('\n    },\n', start) + len('\n    },\n')
    return start, end

def get_block(t, id_):
    s, e = block_span(t, id_)
    return t[s:e]

def set_field(t, id_, field, value_src):
    """Set (or add after `kind:`/`to:`) a top-level field on the block. value_src is TS source (e.g. '"hot"', '3'). None deletes."""
    s, e = block_span(t, id_)
    block = t[s:e]
    block = re.sub(r'^      %s: [^\n]*\n' % field, '', block, flags=re.M)
    if value_src is not None:
        line = '      %s: %s,\n' % (field, value_src)
        # after kind (nodes) or to (edges), else after id
        for anchor in ('kind', 'to', 'id'):
            m = re.search(r'^      %s: [^\n]*\n' % anchor, block, re.M)
            if m:
                block = block[:m.end()] + line + block[m.end():]
                break
    return t[:s] + block + t[e:]

def set_cell(t, id_, col=None, row=None, parent=None):
    for f in ('x', 'y', 'w', 'h', 'col', 'row', 'parent'):
        t = set_field(t, id_, f, None)
    # insert in order parent, row, col (each inserted after kind → reverse order)
    if parent is not None:
        t = set_field(t, id_, 'parent', '"%s"' % parent)
    if row is not None:
        t = set_field(t, id_, 'row', str(row))
    if col is not None:
        t = set_field(t, id_, 'col', str(col))
    return t

def set_sides(t, eid, fs=None, ts=None):
    t = set_field(t, eid, 'fromSide', None)
    t = set_field(t, eid, 'toSide', None)
    if ts:
        t = set_field(t, eid, 'toSide', '"%s"' % ts)
    if fs:
        t = set_field(t, eid, 'fromSide', '"%s"' % fs)
    return t

def clear_all_sides(t):
    return re.sub(r'^      (fromSide|toSide): [^\n]*\n', '', t, flags=re.M)

def set_tier(t, eid, tier):
    t = set_field(t, eid, 'animated', None)
    t = set_field(t, eid, 'dashed', None)
    return set_field(t, eid, 'tier', '"%s"' % tier)

def delete_block(t, id_):
    s, e = block_span(t, id_)
    return t[:s] + t[e:]

def edge_ids(t):
    return re.findall(r'^      id: "(e\d+)",', t, re.M)

def edges_touching(t, node_id):
    out = []
    for eid in edge_ids(t):
        b = get_block(t, eid)
        if re.search(r'^      (from|to): "%s",' % re.escape(node_id), b, re.M):
            out.append(eid)
    return out

def delete_node(t, node_id):
    for eid in edges_touching(t, node_id):
        t = delete_block(t, eid)
    return delete_block(t, node_id)

def retarget(t, eid, from_=None, to=None):
    if from_: t = set_field(t, eid, 'from', '"%s"' % from_)
    if to: t = set_field(t, eid, 'to', '"%s"' % to)
    return t
