---
type: interview-prep
---

### 1. Min Stack

#### Problem
Design a stack that supports `push(x)`, `pop()`, `top()`, and `getMin()` — retrieving the minimum element — all in constant time. `push` adds a value to the top, `pop` removes the top element, `top` returns the current top without removing it, and `getMin` returns the smallest value currently in the stack. Every operation must run in O(1); assume `pop`, `top`, and `getMin` are only called on a non-empty stack.

#### Pattern
**Auxiliary stack of running minima (or value-encoding).** **O(1)** per operation, **O(n)** space. Each element carries the minimum of the stack at the moment it was pushed.

#### Explanation
The naive approach recomputes the minimum by scanning, which is O(n). The trick is to store, alongside each pushed value, the minimum of the entire stack up to and including that value. Because the stack is LIFO, the minimum can only change at the top: when you push, the new running minimum is `min(x, current_min)`; when you pop, you discard that element's snapshot and the previous element's snapshot is again valid. This gives a monotone-consistent view where `getMin` is just reading the top's stored minimum.

Two common encodings exist. The clearest is a pair-per-slot: push `(value, min_so_far)`. A space-saving variant keeps a second stack that only records a new minimum when one arrives, but the pair approach is simpler and equally O(1). The invariant is that the min-snapshot at position i equals the minimum of all elements from the bottom up to i, so the top slot always answers `getMin` directly. The main edge case is the very first push (compare against positive infinity or special-case an empty stack), and duplicate minima — which the second-stack variant must handle with `<=` so it pops the right number of times.

#### Python
Store `(x, current_min)` tuples in a single list; `getMin` reads `stack[-1][1]`. Simple and allocation-light versus a separate min-stack.

```python
class MinStack:
    def __init__(self):
        self.stack = []

    def push(self, val: int) -> None:
        cur_min = val if not self.stack else min(val, self.stack[-1][1])
        self.stack.append((val, cur_min))

    def pop(self) -> None:
        self.stack.pop()

    def top(self) -> int:
        return self.stack[-1][0]

    def getMin(self) -> int:
        return self.stack[-1][1]
```

#### Java
`ArrayDeque<int[]>` as the stack (never legacy `Stack`); each entry is a `{value, min}` pair.

```java
import java.util.*;

class MinStack {
    private final Deque<int[]> stack = new ArrayDeque<>();

    public MinStack() {}

    public void push(int val) {
        int curMin = stack.isEmpty() ? val : Math.min(val, stack.peek()[1]);
        stack.push(new int[]{val, curMin});
    }

    public void pop() {
        stack.pop();
    }

    public int top() {
        return stack.peek()[0];
    }

    public int getMin() {
        return stack.peek()[1];
    }
}
```

#### Rust
A `Vec<(i32, i32)>` of `(value, min)` pairs; `last()` returns an `Option`, unwrapped since calls assume non-empty.

```rust
struct MinStack {
    stack: Vec<(i32, i32)>,
}

impl MinStack {
    fn new() -> Self {
        MinStack { stack: Vec::new() }
    }

    fn push(&mut self, val: i32) {
        let cur_min = match self.stack.last() {
            Some(&(_, m)) => m.min(val),
            None => val,
        };
        self.stack.push((val, cur_min));
    }

    fn pop(&mut self) {
        self.stack.pop();
    }

    fn top(&self) -> i32 {
        self.stack.last().unwrap().0
    }

    fn get_min(&self) -> i32 {
        self.stack.last().unwrap().1
    }
}
```

#### Go
A slice of `[2]int` pairs used as a stack; append/reslice for push/pop, no container needed.

```go
type MinStack struct {
    stack [][2]int
}

func Constructor() MinStack {
    return MinStack{}
}

func (s *MinStack) Push(val int) {
    curMin := val
    if n := len(s.stack); n > 0 && s.stack[n-1][1] < curMin {
        curMin = s.stack[n-1][1]
    }
    s.stack = append(s.stack, [2]int{val, curMin})
}

func (s *MinStack) Pop() {
    s.stack = s.stack[:len(s.stack)-1]
}

func (s *MinStack) Top() int {
    return s.stack[len(s.stack)-1][0]
}

func (s *MinStack) GetMin() int {
    return s.stack[len(s.stack)-1][1]
}
```

#### C++
A `std::vector<std::pair<int,int>>` of `{value, min}`; `back()` gives O(1) access to both.

```cpp
#include <vector>
#include <utility>
#include <algorithm>

class MinStack {
    std::vector<std::pair<int, int>> stack;

public:
    MinStack() {}

    void push(int val) {
        int curMin = stack.empty() ? val : std::min(val, stack.back().second);
        stack.push_back({val, curMin});
    }

    void pop() {
        stack.pop_back();
    }

    int top() {
        return stack.back().first;
    }

    int getMin() {
        return stack.back().second;
    }
};
```

### 2. Max Stack

#### Problem
Design a stack that supports `push(x)`, `pop()` (remove and return the top), `top()` (peek the top), `peekMax()` (return the maximum element), and `popMax()` (remove and return the maximum element). If there are multiple maxima, `popMax` removes only the one closest to the top. Aim for better than O(n) on the max operations; a balanced-structure solution achieves O(log n) for `push`/`popMax` and O(1) for `top`/`peekMax`.

#### Pattern
**Balanced BST / ordered map keyed by value, plus a doubly linked list for stack order.** **O(log n)** for `push` and `popMax`, **O(1)** for `top`/`peekMax` (amortized with lazy deletion) or O(log n) worst case. Two coordinated structures give ordering by value and ordering by insertion simultaneously.

#### Explanation
A plain Min/Max-Stack pairing trick fails here because `popMax` can remove an element from the *middle* of the stack, which then breaks the running-max snapshots. So you need random-ish removal from stack order plus fast lookup of the maximum. The clean design keeps the stack as a doubly linked list (so any node can be spliced out in O(1) once located) and an ordered map from value to the list of nodes holding that value. `push` appends a node and records it under its value; `peekMax` reads the map's largest key; `popMax` finds the last node in that key's bucket (closest to top), unlinks it from the list, and removes it from the map.

The ordered map (TreeMap / BTreeMap / `std::map`) gives O(log n) max-key access and O(log n) insert/erase. Buckets must preserve insertion order so "closest to the top" is well defined — you pop the node inserted latest for that value. The subtle edge cases: multiple equal maxima (bucket must be a stack itself), and cleaning up an emptied bucket so the map's largest key stays accurate. An alternative is two heaps with lazy deletion and a validity set/id scheme, trading the linked list for a `popMax`-marks-invalid approach; the balanced-tree-plus-list version is the crispest to reason about.

#### Python
A doubly linked list of nodes plus a `SortedDict`-style structure isn't in stdlib, so use a dict mapping value to a list of node references and track the max via a lazily-maintained heap of values with a validity check against live buckets.

```python
import heapq

class Node:
    __slots__ = ("val", "prev", "next")
    def __init__(self, val):
        self.val = val
        self.prev = None
        self.next = None

class MaxStack:
    def __init__(self):
        self.head = Node(0)  # sentinel head
        self.tail = Node(0)  # sentinel tail
        self.head.next = self.tail
        self.tail.prev = self.head
        self.buckets = {}          # value -> list of live nodes (insertion order)
        self.heap = []             # max-heap of values via negation

    def _add_before_tail(self, node):
        p = self.tail.prev
        p.next = node
        node.prev = p
        node.next = self.tail
        self.tail.prev = node

    def _unlink(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def push(self, x: int) -> None:
        node = Node(x)
        self._add_before_tail(node)
        self.buckets.setdefault(x, []).append(node)
        heapq.heappush(self.heap, -x)

    def top(self) -> int:
        return self.tail.prev.val

    def pop(self) -> int:
        node = self.tail.prev
        self._unlink(node)
        self.buckets[node.val].pop()
        if not self.buckets[node.val]:
            del self.buckets[node.val]
        return node.val

    def _clean_heap(self):
        while self.heap and (-self.heap[0]) not in self.buckets:
            heapq.heappop(self.heap)

    def peekMax(self) -> int:
        self._clean_heap()
        return -self.heap[0]

    def popMax(self) -> int:
        self._clean_heap()
        val = -self.heap[0]
        node = self.buckets[val].pop()
        if not self.buckets[val]:
            del self.buckets[val]
        self._unlink(node)
        return val
```

#### Java
`TreeMap<Integer, ArrayDeque<Node>>` gives O(log n) max-key access; a doubly linked list of `Node` supports O(1) splice on `popMax`.

```java
import java.util.*;

class MaxStack {
    private static class Node {
        int val;
        Node prev, next;
        Node(int v) { val = v; }
    }

    private final Node head = new Node(0);
    private final Node tail = new Node(0);
    private final TreeMap<Integer, ArrayDeque<Node>> map = new TreeMap<>();

    public MaxStack() {
        head.next = tail;
        tail.prev = head;
    }

    private void addBeforeTail(Node node) {
        Node p = tail.prev;
        p.next = node;
        node.prev = p;
        node.next = tail;
        tail.prev = node;
    }

    private void unlink(Node node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    public void push(int x) {
        Node node = new Node(x);
        addBeforeTail(node);
        map.computeIfAbsent(x, k -> new ArrayDeque<>()).push(node);
    }

    public int top() {
        return tail.prev.val;
    }

    public int pop() {
        Node node = tail.prev;
        unlink(node);
        ArrayDeque<Node> dq = map.get(node.val);
        dq.remove(node);
        if (dq.isEmpty()) map.remove(node.val);
        return node.val;
    }

    public int peekMax() {
        return map.lastKey();
    }

    public int popMax() {
        int val = map.lastKey();
        ArrayDeque<Node> dq = map.get(val);
        Node node = dq.pop();
        if (dq.isEmpty()) map.remove(val);
        unlink(node);
        return val;
    }
}
```

#### Rust
`BTreeMap<i32, Vec<usize>>` maps value to node indices in an arena `Vec<Node>`; a slab with a free list plus prev/next indices avoids `Rc<RefCell<>>` for the doubly linked list.

```rust
use std::collections::BTreeMap;

struct Node {
    val: i32,
    prev: usize,
    next: usize,
}

struct MaxStack {
    nodes: Vec<Node>,
    head: usize,
    tail: usize,
    map: BTreeMap<i32, Vec<usize>>,
}

impl MaxStack {
    fn new() -> Self {
        let head = Node { val: 0, prev: usize::MAX, next: 1 };
        let tail = Node { val: 0, prev: 0, next: usize::MAX };
        MaxStack {
            nodes: vec![head, tail],
            head: 0,
            tail: 1,
            map: BTreeMap::new(),
        }
    }

    fn add_before_tail(&mut self, idx: usize) {
        let p = self.nodes[self.tail].prev;
        self.nodes[p].next = idx;
        self.nodes[idx].prev = p;
        self.nodes[idx].next = self.tail;
        self.nodes[self.tail].prev = idx;
    }

    fn unlink(&mut self, idx: usize) {
        let p = self.nodes[idx].prev;
        let n = self.nodes[idx].next;
        self.nodes[p].next = n;
        self.nodes[n].prev = p;
    }

    fn push(&mut self, x: i32) {
        let idx = self.nodes.len();
        self.nodes.push(Node { val: x, prev: usize::MAX, next: usize::MAX });
        self.add_before_tail(idx);
        self.map.entry(x).or_default().push(idx);
    }

    fn top(&self) -> i32 {
        let t = self.nodes[self.tail].prev;
        self.nodes[t].val
    }

    fn pop(&mut self) -> i32 {
        let idx = self.nodes[self.tail].prev;
        self.unlink(idx);
        let val = self.nodes[idx].val;
        if let Some(bucket) = self.map.get_mut(&val) {
            let pos = bucket.iter().rposition(|&i| i == idx).unwrap();
            bucket.remove(pos);
            if bucket.is_empty() {
                self.map.remove(&val);
            }
        }
        val
    }

    fn peek_max(&self) -> i32 {
        *self.map.keys().next_back().unwrap()
    }

    fn pop_max(&mut self) -> i32 {
        let val = *self.map.keys().next_back().unwrap();
        let idx = {
            let bucket = self.map.get_mut(&val).unwrap();
            let idx = bucket.pop().unwrap();
            if bucket.is_empty() {
                self.map.remove(&val);
            }
            idx
        };
        self.unlink(idx);
        val
    }
}
```

#### Go
A `container/list` doubly linked list holds stack order; a `map[int][]*list.Element` bucket plus a lazily-cleaned value tracking via a sorted structure. Here a `map` of buckets with a max scan replaced by an ordered approach uses a simple balanced alternative: track values in a `*list`-backed stack and find max via a secondary sorted key set.

```go
import (
    "container/list"
)

type MaxStack struct {
    ll      *list.List
    buckets map[int][]*list.Element
    keys    map[int]int // value -> count, for max lookup
    maxKeys []int       // sorted distinct values
}

func Constructor() MaxStack {
    return MaxStack{
        ll:      list.New(),
        buckets: make(map[int][]*list.Element),
        keys:    make(map[int]int),
    }
}

func (s *MaxStack) insertKey(v int) {
    if s.keys[v] == 0 {
        // insert v into sorted maxKeys
        i := lowerBound(s.maxKeys, v)
        s.maxKeys = append(s.maxKeys, 0)
        copy(s.maxKeys[i+1:], s.maxKeys[i:])
        s.maxKeys[i] = v
    }
    s.keys[v]++
}

func (s *MaxStack) removeKey(v int) {
    s.keys[v]--
    if s.keys[v] == 0 {
        delete(s.keys, v)
        i := lowerBound(s.maxKeys, v)
        s.maxKeys = append(s.maxKeys[:i], s.maxKeys[i+1:]...)
    }
}

func lowerBound(a []int, v int) int {
    lo, hi := 0, len(a)
    for lo < hi {
        mid := (lo + hi) / 2
        if a[mid] < v {
            lo = mid + 1
        } else {
            hi = mid
        }
    }
    return lo
}

func (s *MaxStack) Push(x int) {
    e := s.ll.PushBack(x)
    s.buckets[x] = append(s.buckets[x], e)
    s.insertKey(x)
}

func (s *MaxStack) Top() int {
    return s.ll.Back().Value.(int)
}

func (s *MaxStack) Pop() int {
    e := s.ll.Back()
    val := e.Value.(int)
    s.ll.Remove(e)
    b := s.buckets[val]
    s.buckets[val] = b[:len(b)-1]
    if len(s.buckets[val]) == 0 {
        delete(s.buckets, val)
    }
    s.removeKey(val)
    return val
}

func (s *MaxStack) PeekMax() int {
    return s.maxKeys[len(s.maxKeys)-1]
}

func (s *MaxStack) PopMax() int {
    val := s.maxKeys[len(s.maxKeys)-1]
    b := s.buckets[val]
    e := b[len(b)-1]
    s.buckets[val] = b[:len(b)-1]
    if len(s.buckets[val]) == 0 {
        delete(s.buckets, val)
    }
    s.ll.Remove(e)
    s.removeKey(val)
    return val
}
```

#### C++
`std::map<int, std::vector<std::list<int>::iterator>>` maps value to iterators into a `std::list` holding stack order; `list` iterators stay valid across other erases, enabling O(1) splice on `popMax`.

```cpp
#include <map>
#include <list>
#include <vector>

class MaxStack {
    std::list<int> stack;                                       // front..back = bottom..top
    std::map<int, std::vector<std::list<int>::iterator>> map;   // value -> iterators

public:
    MaxStack() {}

    void push(int x) {
        stack.push_back(x);
        map[x].push_back(std::prev(stack.end()));
    }

    int top() {
        return stack.back();
    }

    int pop() {
        int val = stack.back();
        auto& vec = map[val];
        vec.pop_back();
        if (vec.empty()) map.erase(val);
        stack.pop_back();
        return val;
    }

    int peekMax() {
        return map.rbegin()->first;
    }

    int popMax() {
        int val = map.rbegin()->first;
        auto& vec = map[val];
        auto it = vec.back();
        vec.pop_back();
        if (vec.empty()) map.erase(val);
        stack.erase(it);
        return val;
    }
};
```

### 3. Implement Queue using Stacks

#### Problem
Implement a first-in-first-out (FIFO) queue using only two stacks. Support `push(x)` to enqueue at the back, `pop()` to dequeue and return the front element, `peek()` to return the front without removing it, and `empty()` to report whether the queue holds no elements. You may only use standard stack operations (push to top, pop from top, peek top, size/empty); the amortized cost per operation must be O(1).

#### Pattern
**Two stacks — one inbound, one outbound — with lazy transfer.** **O(1) amortized** per operation (O(n) worst case on a transfer), **O(n)** space. Reversing a stack into another stack turns LIFO into FIFO.

#### Explanation
A single stack is LIFO, the opposite of a queue. Pouring stack A into stack B reverses the order, so the bottom of A (the oldest element, which should exit first) ends up on top of B. The design: `push` always goes onto the input stack. For `pop`/`peek`, if the output stack is empty, drain the entire input stack into it, reversing order; then the front of the queue is simply the top of the output stack. Crucially you only transfer when the output stack runs dry, not on every operation.

This lazy transfer is what makes it O(1) amortized: each element is moved from input to output at most once over its lifetime, so across n operations the total transfer work is O(n), i.e. O(1) each on average. A single `pop` can be O(n) if it triggers a full drain, but that cost is paid down by the many cheap operations that follow. The key invariant: the output stack, top to bottom, holds the front-most queue elements in dequeue order; never refill it until it is empty, or you would scramble the ordering. `empty()` is true only when both stacks are empty.

#### Python
Two plain `list`s as stacks; `append`/`pop` are O(1). Refill `out` from `in` only when `out` is empty.

```python
class MyQueue:
    def __init__(self):
        self.in_stack = []
        self.out_stack = []

    def push(self, x: int) -> None:
        self.in_stack.append(x)

    def _transfer(self) -> None:
        if not self.out_stack:
            while self.in_stack:
                self.out_stack.append(self.in_stack.pop())

    def pop(self) -> int:
        self._transfer()
        return self.out_stack.pop()

    def peek(self) -> int:
        self._transfer()
        return self.out_stack[-1]

    def empty(self) -> bool:
        return not self.in_stack and not self.out_stack
```

#### Java
Two `ArrayDeque<Integer>` used as stacks via `push`/`pop`/`peek`; avoid legacy `Stack`.

```java
import java.util.*;

class MyQueue {
    private final Deque<Integer> in = new ArrayDeque<>();
    private final Deque<Integer> out = new ArrayDeque<>();

    public MyQueue() {}

    public void push(int x) {
        in.push(x);
    }

    private void transfer() {
        if (out.isEmpty()) {
            while (!in.isEmpty()) {
                out.push(in.pop());
            }
        }
    }

    public int pop() {
        transfer();
        return out.pop();
    }

    public int peek() {
        transfer();
        return out.peek();
    }

    public boolean empty() {
        return in.isEmpty() && out.isEmpty();
    }
}
```

#### Rust
Two `Vec<i32>` as stacks; `push`/`pop` on `Vec` are the stack ops. `pop` returns `Option`, unwrapped since queue is non-empty on valid calls.

```rust
struct MyQueue {
    in_stack: Vec<i32>,
    out_stack: Vec<i32>,
}

impl MyQueue {
    fn new() -> Self {
        MyQueue { in_stack: Vec::new(), out_stack: Vec::new() }
    }

    fn push(&mut self, x: i32) {
        self.in_stack.push(x);
    }

    fn transfer(&mut self) {
        if self.out_stack.is_empty() {
            while let Some(v) = self.in_stack.pop() {
                self.out_stack.push(v);
            }
        }
    }

    fn pop(&mut self) -> i32 {
        self.transfer();
        self.out_stack.pop().unwrap()
    }

    fn peek(&mut self) -> i32 {
        self.transfer();
        *self.out_stack.last().unwrap()
    }

    fn empty(&self) -> bool {
        self.in_stack.is_empty() && self.out_stack.is_empty()
    }
}
```

#### Go
Two `[]int` slices as stacks; append for push, reslice for pop. No container package needed.

```go
type MyQueue struct {
    in  []int
    out []int
}

func Constructor() MyQueue {
    return MyQueue{}
}

func (q *MyQueue) Push(x int) {
    q.in = append(q.in, x)
}

func (q *MyQueue) transfer() {
    if len(q.out) == 0 {
        for len(q.in) > 0 {
            n := len(q.in)
            q.out = append(q.out, q.in[n-1])
            q.in = q.in[:n-1]
        }
    }
}

func (q *MyQueue) Pop() int {
    q.transfer()
    n := len(q.out)
    v := q.out[n-1]
    q.out = q.out[:n-1]
    return v
}

func (q *MyQueue) Peek() int {
    q.transfer()
    return q.out[len(q.out)-1]
}

func (q *MyQueue) Empty() bool {
    return len(q.in) == 0 && len(q.out) == 0
}
```

#### C++
Two `std::stack<int>` containers; transfer from `in` to `out` only when `out` is empty.

```cpp
#include <stack>

class MyQueue {
    std::stack<int> in;
    std::stack<int> out;

public:
    MyQueue() {}

    void push(int x) {
        in.push(x);
    }

    void transfer() {
        if (out.empty()) {
            while (!in.empty()) {
                out.push(in.top());
                in.pop();
            }
        }
    }

    int pop() {
        transfer();
        int v = out.top();
        out.pop();
        return v;
    }

    int peek() {
        transfer();
        return out.top();
    }

    bool empty() {
        return in.empty() && out.empty();
    }
};
```

### 4. Implement Stack using Queues

#### Problem
Implement a last-in-first-out (LIFO) stack using only queue operations. Support `push(x)` to add to the top, `pop()` to remove and return the top element, `top()` to peek the top, and `empty()` to test for emptiness. You may only use standard queue operations (enqueue at back, dequeue from front, peek front, size/empty). A single-queue design achieves O(n) `push` with O(1) everything else, or symmetrically O(1) `push` / O(n) `pop`.

#### Pattern
**One queue with rotate-on-push (or two queues).** **O(n)** `push`, **O(1)** `pop`/`top`/`empty`, **O(n)** space. Rotating the queue after each enqueue keeps the newest element at the front.

#### Explanation
A queue is FIFO, so to simulate a stack you must arrange for the most recently pushed element to be dequeued first. The single-queue trick: after enqueuing the new element at the back, rotate the queue by dequeuing and re-enqueuing every *other* element (size - 1 of them). This moves the just-pushed element to the front and shifts the rest around behind it, so the queue's front is always the current stack top. Then `pop` is a plain dequeue and `top` is a plain front-peek, both O(1).

This front-loads the cost into `push` (O(n) per push because of the rotation), which is usually the right tradeoff since it keeps `pop`/`top` trivial. The invariant is that the queue, front to back, holds the stack from top to bottom, and every push restores that order by rotating exactly `size - 1` elements. A two-queue variant instead keeps one queue holding the ordered stack and uses the second as scratch during push, but the single-queue rotation is tighter and uses less memory. Edge cases are minimal: an empty stack rotates zero elements, and `empty()` just checks the queue's size.

#### Python
`collections.deque` gives O(1) `append` (enqueue) and `popleft` (dequeue); rotate by popping-and-appending `size - 1` fronts after each push.

```python
from collections import deque

class MyStack:
    def __init__(self):
        self.q = deque()

    def push(self, x: int) -> None:
        self.q.append(x)
        for _ in range(len(self.q) - 1):
            self.q.append(self.q.popleft())

    def pop(self) -> int:
        return self.q.popleft()

    def top(self) -> int:
        return self.q[0]

    def empty(self) -> bool:
        return not self.q
```

#### Java
A single `ArrayDeque<Integer>` used as a FIFO queue (`offer`/`poll`/`peek`); rotate `size - 1` elements after each push.

```java
import java.util.*;

class MyStack {
    private final Queue<Integer> q = new ArrayDeque<>();

    public MyStack() {}

    public void push(int x) {
        q.offer(x);
        for (int i = q.size() - 1; i > 0; i--) {
            q.offer(q.poll());
        }
    }

    public int pop() {
        return q.poll();
    }

    public int top() {
        return q.peek();
    }

    public boolean empty() {
        return q.isEmpty();
    }
}
```

#### Rust
`std::collections::VecDeque` provides `push_back`/`pop_front`/`front`; rotate `len - 1` elements after each push.

```rust
use std::collections::VecDeque;

struct MyStack {
    q: VecDeque<i32>,
}

impl MyStack {
    fn new() -> Self {
        MyStack { q: VecDeque::new() }
    }

    fn push(&mut self, x: i32) {
        self.q.push_back(x);
        for _ in 0..self.q.len() - 1 {
            let front = self.q.pop_front().unwrap();
            self.q.push_back(front);
        }
    }

    fn pop(&mut self) -> i32 {
        self.q.pop_front().unwrap()
    }

    fn top(&self) -> i32 {
        *self.q.front().unwrap()
    }

    fn empty(&self) -> bool {
        self.q.is_empty()
    }
}
```

#### Go
`container/list` acts as the queue (`PushBack`/`Front`+`Remove`); rotate `Len - 1` elements after each push.

```go
import (
    "container/list"
)

type MyStack struct {
    q *list.List
}

func Constructor() MyStack {
    return MyStack{q: list.New()}
}

func (s *MyStack) Push(x int) {
    s.q.PushBack(x)
    for i := s.q.Len() - 1; i > 0; i-- {
        front := s.q.Front()
        s.q.Remove(front)
        s.q.PushBack(front.Value)
    }
}

func (s *MyStack) Pop() int {
    front := s.q.Front()
    s.q.Remove(front)
    return front.Value.(int)
}

func (s *MyStack) Top() int {
    return s.q.Front().Value.(int)
}

func (s *MyStack) Empty() bool {
    return s.q.Len() == 0
}
```

#### C++
`std::queue<int>` with `push`/`front`/`pop`; rotate `size - 1` elements to the back after each push.

```cpp
#include <queue>

class MyStack {
    std::queue<int> q;

public:
    MyStack() {}

    void push(int x) {
        q.push(x);
        for (int i = q.size() - 1; i > 0; i--) {
            q.push(q.front());
            q.pop();
        }
    }

    int pop() {
        int v = q.front();
        q.pop();
        return v;
    }

    int top() {
        return q.front();
    }

    bool empty() {
        return q.empty();
    }
};
```

### 5. Design Circular Queue

#### Problem
Design a fixed-capacity circular queue (ring buffer). The constructor takes a capacity `k`. Support `enQueue(x)` to insert at the rear (returns false if full), `deQueue()` to delete from the front (returns false if empty), `Front()` and `Rear()` to read the front/rear values (return -1 if empty), and `isEmpty()`/`isFull()`. All operations must be O(1); the buffer reuses freed slots by wrapping indices modulo `k`.

#### Pattern
**Fixed array + head index + count (ring buffer).** **O(1)** per operation, **O(k)** space. Modular arithmetic wraps the rear pointer around the fixed array so freed front slots are reused.

#### Explanation
A circular queue avoids the O(n) shifting of a naive array queue by treating a fixed array as a ring: instead of moving elements when the front advances, you advance a head index and wrap it around with modulo. Track the `head` index and a `count` of live elements. The rear slot is `(head + count) % capacity`. `enQueue` writes there and increments count (rejecting if `count == capacity`); `deQueue` advances `head = (head + 1) % capacity` and decrements count (rejecting if empty). Using an explicit `count` cleanly disambiguates the full-versus-empty case, which is the classic ring-buffer pitfall.

The alternative — tracking `head` and `tail` indices without a count — suffers from ambiguity: when head equals tail, you cannot tell full from empty without either sacrificing one slot or carrying a boolean. The count-based design sidesteps that entirely and makes every predicate trivial: `isEmpty` is `count == 0`, `isFull` is `count == capacity`. `Front()` reads `array[head]`; `Rear()` reads `array[(head + count - 1) % capacity]`. The main edge cases are reading from an empty queue (return -1) and the wraparound arithmetic when `head + count` exceeds the array bounds — always reduce modulo capacity.

#### Python
A pre-sized `list` of length `k` with `head` and `count` integers; compute rear index by modular arithmetic — no `deque` needed since capacity is fixed.

```python
class MyCircularQueue:
    def __init__(self, k: int):
        self.data = [0] * k
        self.capacity = k
        self.head = 0
        self.count = 0

    def enQueue(self, value: int) -> bool:
        if self.isFull():
            return False
        self.data[(self.head + self.count) % self.capacity] = value
        self.count += 1
        return True

    def deQueue(self) -> bool:
        if self.isEmpty():
            return False
        self.head = (self.head + 1) % self.capacity
        self.count -= 1
        return True

    def Front(self) -> int:
        return -1 if self.isEmpty() else self.data[self.head]

    def Rear(self) -> int:
        if self.isEmpty():
            return -1
        return self.data[(self.head + self.count - 1) % self.capacity]

    def isEmpty(self) -> bool:
        return self.count == 0

    def isFull(self) -> bool:
        return self.count == self.capacity
```

#### Java
A primitive `int[]` of size `k` with `head` and `count` fields; modular indexing keeps every operation O(1).

```java
class MyCircularQueue {
    private final int[] data;
    private final int capacity;
    private int head;
    private int count;

    public MyCircularQueue(int k) {
        data = new int[k];
        capacity = k;
        head = 0;
        count = 0;
    }

    public boolean enQueue(int value) {
        if (isFull()) return false;
        data[(head + count) % capacity] = value;
        count++;
        return true;
    }

    public boolean deQueue() {
        if (isEmpty()) return false;
        head = (head + 1) % capacity;
        count--;
        return true;
    }

    public int Front() {
        return isEmpty() ? -1 : data[head];
    }

    public int Rear() {
        return isEmpty() ? -1 : data[(head + count - 1) % capacity];
    }

    public boolean isEmpty() {
        return count == 0;
    }

    public boolean isFull() {
        return count == capacity;
    }
}
```

#### Rust
A `Vec<i32>` pre-filled to length `k` with `head` and `count` as `usize`; modular arithmetic on `usize` avoids any wrapping surprises.

```rust
struct MyCircularQueue {
    data: Vec<i32>,
    capacity: usize,
    head: usize,
    count: usize,
}

impl MyCircularQueue {
    fn new(k: i32) -> Self {
        let cap = k as usize;
        MyCircularQueue {
            data: vec![0; cap],
            capacity: cap,
            head: 0,
            count: 0,
        }
    }

    fn en_queue(&mut self, value: i32) -> bool {
        if self.is_full() {
            return false;
        }
        let idx = (self.head + self.count) % self.capacity;
        self.data[idx] = value;
        self.count += 1;
        true
    }

    fn de_queue(&mut self) -> bool {
        if self.is_empty() {
            return false;
        }
        self.head = (self.head + 1) % self.capacity;
        self.count -= 1;
        true
    }

    fn front(&self) -> i32 {
        if self.is_empty() {
            -1
        } else {
            self.data[self.head]
        }
    }

    fn rear(&self) -> i32 {
        if self.is_empty() {
            -1
        } else {
            self.data[(self.head + self.count - 1) % self.capacity]
        }
    }

    fn is_empty(&self) -> bool {
        self.count == 0
    }

    fn is_full(&self) -> bool {
        self.count == self.capacity
    }
}
```

#### Go
A fixed `[]int` of length `k` with `head` and `count` ints; modular indexing, no container package.

```go
type MyCircularQueue struct {
    data     []int
    capacity int
    head     int
    count    int
}

func Constructor(k int) MyCircularQueue {
    return MyCircularQueue{
        data:     make([]int, k),
        capacity: k,
    }
}

func (q *MyCircularQueue) EnQueue(value int) bool {
    if q.IsFull() {
        return false
    }
    q.data[(q.head+q.count)%q.capacity] = value
    q.count++
    return true
}

func (q *MyCircularQueue) DeQueue() bool {
    if q.IsEmpty() {
        return false
    }
    q.head = (q.head + 1) % q.capacity
    q.count--
    return true
}

func (q *MyCircularQueue) Front() int {
    if q.IsEmpty() {
        return -1
    }
    return q.data[q.head]
}

func (q *MyCircularQueue) Rear() int {
    if q.IsEmpty() {
        return -1
    }
    return q.data[(q.head+q.count-1)%q.capacity]
}

func (q *MyCircularQueue) IsEmpty() bool {
    return q.count == 0
}

func (q *MyCircularQueue) IsFull() bool {
    return q.count == q.capacity
}
```

#### C++
A `std::vector<int>` sized to `k` with `head` and `count` members; modular arithmetic wraps the rear index.

```cpp
#include <vector>

class MyCircularQueue {
    std::vector<int> data;
    int capacity;
    int head;
    int count;

public:
    MyCircularQueue(int k) : data(k), capacity(k), head(0), count(0) {}

    bool enQueue(int value) {
        if (isFull()) return false;
        data[(head + count) % capacity] = value;
        count++;
        return true;
    }

    bool deQueue() {
        if (isEmpty()) return false;
        head = (head + 1) % capacity;
        count--;
        return true;
    }

    int Front() {
        return isEmpty() ? -1 : data[head];
    }

    int Rear() {
        return isEmpty() ? -1 : data[(head + count - 1) % capacity];
    }

    bool isEmpty() {
        return count == 0;
    }

    bool isFull() {
        return count == capacity;
    }
};
```

### 6. Design Circular Deque

#### Problem
Design a fixed-capacity circular double-ended queue. The constructor takes a capacity `k`. Support insertion and deletion at both ends: `insertFront(x)` and `insertLast(x)` (each returns false if full), `deleteFront()` and `deleteLast()` (each returns false if empty), plus `getFront()` and `getRear()` (return -1 if empty), and `isEmpty()`/`isFull()`. All operations must be O(1) using a ring buffer with wraparound at both ends.

#### Pattern
**Fixed array + head index + count, symmetric wraparound (double-ended ring buffer).** **O(1)** per operation, **O(k)** space. Front insertions decrement head modulo k; rear insertions write at `(head + count) % k`.

#### Explanation
A circular deque generalizes the ring buffer to grow and shrink at both ends. Keep the same `head` index and `count`, and derive the rear index as `(head + count - 1) % capacity`. Rear operations mirror the plain circular queue: `insertLast` writes at `(head + count) % capacity`, `deleteLast` just decrements count. The front operations are the new part: `insertFront` moves head *backwards* one slot — `head = (head - 1 + capacity) % capacity` — then writes there and increments count; `deleteFront` advances head forward and decrements count. Adding `capacity` before the modulo avoids negative indices when head is 0.

The `count`-plus-`head` representation shines here because both ends manipulate the same two variables symmetrically, and full/empty stay unambiguous (`count == capacity` versus `count == 0`) no matter which end you operate on. The trickiest edge case is the backward wrap in `insertFront`: in languages with unsigned indices or truncating modulo on negatives, you must add `capacity` first. `getFront` reads `array[head]`; `getRear` reads `array[(head + count - 1) % capacity]`. As with the circular queue, always reduce indices modulo capacity, and reject inserts when full / reads when empty rather than corrupting the ring.

#### Python
A pre-sized `list` of length `k` with `head` and `count`; `insertFront` uses `(head - 1) % k`, which Python's non-negative modulo handles cleanly.

```python
class MyCircularDeque:
    def __init__(self, k: int):
        self.data = [0] * k
        self.capacity = k
        self.head = 0
        self.count = 0

    def insertFront(self, value: int) -> bool:
        if self.isFull():
            return False
        self.head = (self.head - 1) % self.capacity
        self.data[self.head] = value
        self.count += 1
        return True

    def insertLast(self, value: int) -> bool:
        if self.isFull():
            return False
        self.data[(self.head + self.count) % self.capacity] = value
        self.count += 1
        return True

    def deleteFront(self) -> bool:
        if self.isEmpty():
            return False
        self.head = (self.head + 1) % self.capacity
        self.count -= 1
        return True

    def deleteLast(self) -> bool:
        if self.isEmpty():
            return False
        self.count -= 1
        return True

    def getFront(self) -> int:
        return -1 if self.isEmpty() else self.data[self.head]

    def getRear(self) -> int:
        if self.isEmpty():
            return -1
        return self.data[(self.head + self.count - 1) % self.capacity]

    def isEmpty(self) -> bool:
        return self.count == 0

    def isFull(self) -> bool:
        return self.count == self.capacity
```

#### Java
A primitive `int[]` with `head` and `count`; front insert uses `(head - 1 + capacity) % capacity` to keep the index non-negative.

```java
class MyCircularDeque {
    private final int[] data;
    private final int capacity;
    private int head;
    private int count;

    public MyCircularDeque(int k) {
        data = new int[k];
        capacity = k;
        head = 0;
        count = 0;
    }

    public boolean insertFront(int value) {
        if (isFull()) return false;
        head = (head - 1 + capacity) % capacity;
        data[head] = value;
        count++;
        return true;
    }

    public boolean insertLast(int value) {
        if (isFull()) return false;
        data[(head + count) % capacity] = value;
        count++;
        return true;
    }

    public boolean deleteFront() {
        if (isEmpty()) return false;
        head = (head + 1) % capacity;
        count--;
        return true;
    }

    public boolean deleteLast() {
        if (isEmpty()) return false;
        count--;
        return true;
    }

    public int getFront() {
        return isEmpty() ? -1 : data[head];
    }

    public int getRear() {
        return isEmpty() ? -1 : data[(head + count - 1) % capacity];
    }

    public boolean isEmpty() {
        return count == 0;
    }

    public boolean isFull() {
        return count == capacity;
    }
}
```

#### Rust
A `Vec<i32>` sized to `k` with `usize` indices; front insert adds `capacity` before the modulo so the unsigned index never underflows.

```rust
struct MyCircularDeque {
    data: Vec<i32>,
    capacity: usize,
    head: usize,
    count: usize,
}

impl MyCircularDeque {
    fn new(k: i32) -> Self {
        let cap = k as usize;
        MyCircularDeque {
            data: vec![0; cap],
            capacity: cap,
            head: 0,
            count: 0,
        }
    }

    fn insert_front(&mut self, value: i32) -> bool {
        if self.is_full() {
            return false;
        }
        self.head = (self.head + self.capacity - 1) % self.capacity;
        self.data[self.head] = value;
        self.count += 1;
        true
    }

    fn insert_last(&mut self, value: i32) -> bool {
        if self.is_full() {
            return false;
        }
        let idx = (self.head + self.count) % self.capacity;
        self.data[idx] = value;
        self.count += 1;
        true
    }

    fn delete_front(&mut self) -> bool {
        if self.is_empty() {
            return false;
        }
        self.head = (self.head + 1) % self.capacity;
        self.count -= 1;
        true
    }

    fn delete_last(&mut self) -> bool {
        if self.is_empty() {
            return false;
        }
        self.count -= 1;
        true
    }

    fn get_front(&self) -> i32 {
        if self.is_empty() {
            -1
        } else {
            self.data[self.head]
        }
    }

    fn get_rear(&self) -> i32 {
        if self.is_empty() {
            -1
        } else {
            self.data[(self.head + self.count - 1) % self.capacity]
        }
    }

    fn is_empty(&self) -> bool {
        self.count == 0
    }

    fn is_full(&self) -> bool {
        self.count == self.capacity
    }
}
```

#### Go
A fixed `[]int` with `head` and `count`; front insert uses `(head - 1 + capacity) % capacity` for a safe backward wrap.

```go
type MyCircularDeque struct {
    data     []int
    capacity int
    head     int
    count    int
}

func Constructor(k int) MyCircularDeque {
    return MyCircularDeque{
        data:     make([]int, k),
        capacity: k,
    }
}

func (d *MyCircularDeque) InsertFront(value int) bool {
    if d.IsFull() {
        return false
    }
    d.head = (d.head - 1 + d.capacity) % d.capacity
    d.data[d.head] = value
    d.count++
    return true
}

func (d *MyCircularDeque) InsertLast(value int) bool {
    if d.IsFull() {
        return false
    }
    d.data[(d.head+d.count)%d.capacity] = value
    d.count++
    return true
}

func (d *MyCircularDeque) DeleteFront() bool {
    if d.IsEmpty() {
        return false
    }
    d.head = (d.head + 1) % d.capacity
    d.count--
    return true
}

func (d *MyCircularDeque) DeleteLast() bool {
    if d.IsEmpty() {
        return false
    }
    d.count--
    return true
}

func (d *MyCircularDeque) GetFront() int {
    if d.IsEmpty() {
        return -1
    }
    return d.data[d.head]
}

func (d *MyCircularDeque) GetRear() int {
    if d.IsEmpty() {
        return -1
    }
    return d.data[(d.head+d.count-1)%d.capacity]
}

func (d *MyCircularDeque) IsEmpty() bool {
    return d.count == 0
}

func (d *MyCircularDeque) IsFull() bool {
    return d.count == d.capacity
}
```

#### C++
A `std::vector<int>` sized to `k` with `head` and `count`; front insert adds `capacity` before the modulo to avoid a negative index.

```cpp
#include <vector>

class MyCircularDeque {
    std::vector<int> data;
    int capacity;
    int head;
    int count;

public:
    MyCircularDeque(int k) : data(k), capacity(k), head(0), count(0) {}

    bool insertFront(int value) {
        if (isFull()) return false;
        head = (head - 1 + capacity) % capacity;
        data[head] = value;
        count++;
        return true;
    }

    bool insertLast(int value) {
        if (isFull()) return false;
        data[(head + count) % capacity] = value;
        count++;
        return true;
    }

    bool deleteFront() {
        if (isEmpty()) return false;
        head = (head + 1) % capacity;
        count--;
        return true;
    }

    bool deleteLast() {
        if (isEmpty()) return false;
        count--;
        return true;
    }

    int getFront() {
        return isEmpty() ? -1 : data[head];
    }

    int getRear() {
        return isEmpty() ? -1 : data[(head + count - 1) % capacity];
    }

    bool isEmpty() {
        return count == 0;
    }

    bool isFull() {
        return count == capacity;
    }
};
```

### 7. Design Front Middle Back Queue

#### Problem
Implement `FrontMiddleBackQueue` supporting `pushFront(val)`, `pushMiddle(val)`, `pushBack(val)`, `popFront()`, `popMiddle()`, and `popBack()`. When there are two middle positions, push to the frontmost middle and pop from the frontmost middle. Each pop returns the removed value, or -1 if the queue is empty. All operations should run in O(1) amortized time.

#### Pattern
**Two balanced deques (front half + back half).** **O(1)** amortized per operation, **O(n)** space. Keep `len(right)` equal to or one greater than `len(left)` so the middle is always at a deque boundary.

#### Explanation
Split the logical queue into a front deque `left` and a back deque `right`, where the full sequence is `left` followed by `right`. The invariant is `len(left) <= len(right) <= len(left) + 1` — the back half never trails the front, and holds the extra element on odd lengths. Because every operation shifts total size by exactly one, a single constant-time rebalance step after each call is enough to restore the invariant, giving O(1) per operation.

With this invariant the middle element is pinned to a deque endpoint. For a push, the target index is `n/2`: when the halves are equal you prepend to `right` (new frontmost middle), otherwise you append to `left`. For popMiddle, the frontmost middle is at index `(n-1)/2`: when the halves are equal it is the last element of `left`, and when `right` is longer it is the front of `right`. The only edge cases are empty pops (return -1) and popFront when `left` is momentarily empty (pull from `right`, which the invariant caps at one element in that state).

#### Python
`collections.deque` gives O(1) `appendleft`/`popleft` on both ends; a one-line `_rebalance` restores the size invariant after every mutation.

```python
from collections import deque

class FrontMiddleBackQueue:
    def __init__(self):
        self.left = deque()
        self.right = deque()

    def _rebalance(self):
        if len(self.left) > len(self.right):
            self.right.appendleft(self.left.pop())
        elif len(self.right) > len(self.left) + 1:
            self.left.append(self.right.popleft())

    def pushFront(self, val: int) -> None:
        self.left.appendleft(val)
        self._rebalance()

    def pushMiddle(self, val: int) -> None:
        if len(self.left) == len(self.right):
            self.right.appendleft(val)
        else:
            self.left.append(val)
        self._rebalance()

    def pushBack(self, val: int) -> None:
        self.right.append(val)
        self._rebalance()

    def popFront(self) -> int:
        if not self.left and not self.right:
            return -1
        val = self.left.popleft() if self.left else self.right.popleft()
        self._rebalance()
        return val

    def popMiddle(self) -> int:
        if not self.left and not self.right:
            return -1
        if len(self.left) == len(self.right):
            val = self.left.pop()
        else:
            val = self.right.popleft()
        self._rebalance()
        return val

    def popBack(self) -> int:
        if not self.right:
            return -1
        val = self.right.pop()
        self._rebalance()
        return val
```

#### Java
`ArrayDeque` is the modern double-ended queue; `addFirst`/`removeLast` etc. are all O(1), and it never boxes as much as a `LinkedList`.

```java
import java.util.*;

class FrontMiddleBackQueue {
    private Deque<Integer> left = new ArrayDeque<>();
    private Deque<Integer> right = new ArrayDeque<>();

    public FrontMiddleBackQueue() {}

    private void rebalance() {
        if (left.size() > right.size()) {
            right.addFirst(left.removeLast());
        } else if (right.size() > left.size() + 1) {
            left.addLast(right.removeFirst());
        }
    }

    public void pushFront(int val) {
        left.addFirst(val);
        rebalance();
    }

    public void pushMiddle(int val) {
        if (left.size() == right.size()) {
            right.addFirst(val);
        } else {
            left.addLast(val);
        }
        rebalance();
    }

    public void pushBack(int val) {
        right.addLast(val);
        rebalance();
    }

    public int popFront() {
        if (left.isEmpty() && right.isEmpty()) return -1;
        int val = left.isEmpty() ? right.removeFirst() : left.removeFirst();
        rebalance();
        return val;
    }

    public int popMiddle() {
        if (left.isEmpty() && right.isEmpty()) return -1;
        int val = (left.size() == right.size()) ? left.removeLast() : right.removeFirst();
        rebalance();
        return val;
    }

    public int popBack() {
        if (right.isEmpty()) return -1;
        int val = right.removeLast();
        rebalance();
        return val;
    }
}
```

#### Rust
`std::collections::VecDeque` is a ring buffer with O(1) push/pop at both ends; the pop methods return `Option`, so `-1` is the natural empty sentinel.

```rust
use std::collections::VecDeque;

struct FrontMiddleBackQueue {
    left: VecDeque<i32>,
    right: VecDeque<i32>,
}

impl FrontMiddleBackQueue {
    fn new() -> Self {
        FrontMiddleBackQueue { left: VecDeque::new(), right: VecDeque::new() }
    }

    fn rebalance(&mut self) {
        if self.left.len() > self.right.len() {
            let v = self.left.pop_back().unwrap();
            self.right.push_front(v);
        } else if self.right.len() > self.left.len() + 1 {
            let v = self.right.pop_front().unwrap();
            self.left.push_back(v);
        }
    }

    fn push_front(&mut self, val: i32) {
        self.left.push_front(val);
        self.rebalance();
    }

    fn push_middle(&mut self, val: i32) {
        if self.left.len() == self.right.len() {
            self.right.push_front(val);
        } else {
            self.left.push_back(val);
        }
        self.rebalance();
    }

    fn push_back(&mut self, val: i32) {
        self.right.push_back(val);
        self.rebalance();
    }

    fn pop_front(&mut self) -> i32 {
        if self.left.is_empty() && self.right.is_empty() {
            return -1;
        }
        let val = if self.left.is_empty() {
            self.right.pop_front().unwrap()
        } else {
            self.left.pop_front().unwrap()
        };
        self.rebalance();
        val
    }

    fn pop_middle(&mut self) -> i32 {
        if self.left.is_empty() && self.right.is_empty() {
            return -1;
        }
        let val = if self.left.len() == self.right.len() {
            self.left.pop_back().unwrap()
        } else {
            self.right.pop_front().unwrap()
        };
        self.rebalance();
        val
    }

    fn pop_back(&mut self) -> i32 {
        if self.right.is_empty() {
            return -1;
        }
        let val = self.right.pop_back().unwrap();
        self.rebalance();
        val
    }
}
```

#### Go
`container/list` also works, but two `[]int` slices used as deques with `container`-style front/back ops are simplest here since only one end of each side ever churns per call.

```go
type FrontMiddleBackQueue struct {
    left, right []int
}

func Constructor() FrontMiddleBackQueue {
    return FrontMiddleBackQueue{}
}

func (q *FrontMiddleBackQueue) rebalance() {
    if len(q.left) > len(q.right) {
        v := q.left[len(q.left)-1]
        q.left = q.left[:len(q.left)-1]
        q.right = append([]int{v}, q.right...)
    } else if len(q.right) > len(q.left)+1 {
        v := q.right[0]
        q.right = q.right[1:]
        q.left = append(q.left, v)
    }
}

func (q *FrontMiddleBackQueue) PushFront(val int) {
    q.left = append([]int{val}, q.left...)
    q.rebalance()
}

func (q *FrontMiddleBackQueue) PushMiddle(val int) {
    if len(q.left) == len(q.right) {
        q.right = append([]int{val}, q.right...)
    } else {
        q.left = append(q.left, val)
    }
    q.rebalance()
}

func (q *FrontMiddleBackQueue) PushBack(val int) {
    q.right = append(q.right, val)
    q.rebalance()
}

func (q *FrontMiddleBackQueue) PopFront() int {
    if len(q.left) == 0 && len(q.right) == 0 {
        return -1
    }
    var val int
    if len(q.left) > 0 {
        val = q.left[0]
        q.left = q.left[1:]
    } else {
        val = q.right[0]
        q.right = q.right[1:]
    }
    q.rebalance()
    return val
}

func (q *FrontMiddleBackQueue) PopMiddle() int {
    if len(q.left) == 0 && len(q.right) == 0 {
        return -1
    }
    var val int
    if len(q.left) == len(q.right) {
        val = q.left[len(q.left)-1]
        q.left = q.left[:len(q.left)-1]
    } else {
        val = q.right[0]
        q.right = q.right[1:]
    }
    q.rebalance()
    return val
}

func (q *FrontMiddleBackQueue) PopBack() int {
    if len(q.right) == 0 {
        return -1
    }
    val := q.right[len(q.right)-1]
    q.right = q.right[:len(q.right)-1]
    q.rebalance()
    return val
}
```

#### C++
`std::deque` provides O(1) `push_front`/`push_back`/`pop_front`/`pop_back`; a private `rebalance` keeps the two halves sized correctly.

```cpp
#include <deque>
using namespace std;

class FrontMiddleBackQueue {
    deque<int> left, right;

    void rebalance() {
        if (left.size() > right.size()) {
            right.push_front(left.back());
            left.pop_back();
        } else if (right.size() > left.size() + 1) {
            left.push_back(right.front());
            right.pop_front();
        }
    }

public:
    FrontMiddleBackQueue() {}

    void pushFront(int val) {
        left.push_front(val);
        rebalance();
    }

    void pushMiddle(int val) {
        if (left.size() == right.size()) right.push_front(val);
        else left.push_back(val);
        rebalance();
    }

    void pushBack(int val) {
        right.push_back(val);
        rebalance();
    }

    int popFront() {
        if (left.empty() && right.empty()) return -1;
        int val;
        if (!left.empty()) { val = left.front(); left.pop_front(); }
        else { val = right.front(); right.pop_front(); }
        rebalance();
        return val;
    }

    int popMiddle() {
        if (left.empty() && right.empty()) return -1;
        int val;
        if (left.size() == right.size()) { val = left.back(); left.pop_back(); }
        else { val = right.front(); right.pop_front(); }
        rebalance();
        return val;
    }

    int popBack() {
        if (right.empty()) return -1;
        int val = right.back();
        right.pop_back();
        rebalance();
        return val;
    }
};
```

### 8. Design a Stack With Increment Operation

#### Problem
Implement `CustomStack(maxSize)` with `push(x)` (adds `x` only if the stack has fewer than `maxSize` elements), `pop()` (returns and removes the top, or -1 if empty), and `increment(k, val)` (adds `val` to the bottom `k` elements, or to all elements if the stack has fewer than `k`). Target O(1) time for every operation, including `increment`.

#### Pattern
**Array-backed stack + lazy increment (difference) array.** **O(1)** per operation, **O(maxSize)** space. Record each range increment at its top boundary and push it down one slot on pop.

#### Explanation
The naive `increment` touches `k` elements and costs O(k). The trick is a parallel `inc` array where `inc[i]` holds a pending amount owed to element `i` and everything beneath it. An `increment(k, val)` becomes a single write: `inc[min(k, size) - 1] += val`, marking that the bottom `k` elements each gain `val`. This is exactly a lazy propagation / difference-array idea applied to a stack.

The debt is settled at pop time. When you pop index `i`, its true value is `stack[i] + inc[i]`; before returning it you push its pending increment down to the new top via `inc[i-1] += inc[i]`, so the elements still beneath it keep the amount they are owed. Every operation is therefore O(1). The edge cases are a full stack (drop the push), an empty pop (return -1), and `increment` with `k` larger than the size (clamp to `size`, and if the stack is empty do nothing).

#### Python
Two parallel lists track values and pending increments; pushing the top's pending amount onto the element below on `pop` keeps `increment` at O(1).

```python
class CustomStack:
    def __init__(self, maxSize: int):
        self.maxSize = maxSize
        self.stack = []
        self.inc = []

    def push(self, x: int) -> None:
        if len(self.stack) < self.maxSize:
            self.stack.append(x)
            self.inc.append(0)

    def pop(self) -> int:
        if not self.stack:
            return -1
        add = self.inc.pop()
        val = self.stack.pop()
        if self.inc:
            self.inc[-1] += add
        return val + add

    def increment(self, k: int, val: int) -> None:
        i = min(k, len(self.stack)) - 1
        if i >= 0:
            self.inc[i] += val
```

#### Java
Preallocated `int[]` arrays with a `top` index avoid autoboxing and give true O(1) array indexing for the lazy increments.

```java
class CustomStack {
    private int[] stack;
    private int[] inc;
    private int top;

    public CustomStack(int maxSize) {
        stack = new int[maxSize];
        inc = new int[maxSize];
        top = 0;
    }

    public void push(int x) {
        if (top < stack.length) {
            stack[top] = x;
            inc[top] = 0;
            top++;
        }
    }

    public int pop() {
        if (top == 0) return -1;
        top--;
        int add = inc[top];
        if (top > 0) inc[top - 1] += add;
        return stack[top] + add;
    }

    public void increment(int k, int val) {
        int i = Math.min(k, top) - 1;
        if (i >= 0) inc[i] += val;
    }
}
```

#### Rust
Two `Vec<i32>` grown in lockstep; `Vec::pop` returns `Option`, so an empty pop maps cleanly to `-1` via `match`.

```rust
struct CustomStack {
    stack: Vec<i32>,
    inc: Vec<i32>,
    max_size: usize,
}

impl CustomStack {
    fn new(max_size: i32) -> Self {
        CustomStack { stack: Vec::new(), inc: Vec::new(), max_size: max_size as usize }
    }

    fn push(&mut self, x: i32) {
        if self.stack.len() < self.max_size {
            self.stack.push(x);
            self.inc.push(0);
        }
    }

    fn pop(&mut self) -> i32 {
        match self.stack.pop() {
            None => -1,
            Some(val) => {
                let add = self.inc.pop().unwrap();
                let n = self.stack.len();
                if n > 0 {
                    self.inc[n - 1] += add;
                }
                val + add
            }
        }
    }

    fn increment(&mut self, k: i32, val: i32) {
        let k = (k as usize).min(self.stack.len());
        if k > 0 {
            self.inc[k - 1] += val;
        }
    }
}
```

#### Go
Two `[]int` slices used as stacks; slice length is the size, and `append`/reslice cover push and pop with no extra bookkeeping.

```go
type CustomStack struct {
    stack []int
    inc   []int
    max   int
}

func Constructor(maxSize int) CustomStack {
    return CustomStack{max: maxSize}
}

func (s *CustomStack) Push(x int) {
    if len(s.stack) < s.max {
        s.stack = append(s.stack, x)
        s.inc = append(s.inc, 0)
    }
}

func (s *CustomStack) Pop() int {
    n := len(s.stack)
    if n == 0 {
        return -1
    }
    add := s.inc[n-1]
    val := s.stack[n-1]
    s.stack = s.stack[:n-1]
    s.inc = s.inc[:n-1]
    if n-1 > 0 {
        s.inc[n-2] += add
    }
    return val + add
}

func (s *CustomStack) Increment(k int, val int) {
    i := k
    if len(s.stack) < i {
        i = len(s.stack)
    }
    if i > 0 {
        s.inc[i-1] += val
    }
}
```

#### C++
Two `std::vector<int>`; `back()`/`pop_back()` operate on the top, and `min(k, size)` clamps the increment range.

```cpp
#include <vector>
#include <algorithm>
using namespace std;

class CustomStack {
    vector<int> stk, inc;
    int maxSize;

public:
    CustomStack(int maxSize) : maxSize(maxSize) {}

    void push(int x) {
        if ((int)stk.size() < maxSize) {
            stk.push_back(x);
            inc.push_back(0);
        }
    }

    int pop() {
        if (stk.empty()) return -1;
        int add = inc.back(); inc.pop_back();
        int val = stk.back(); stk.pop_back();
        if (!inc.empty()) inc.back() += add;
        return val + add;
    }

    void increment(int k, int val) {
        int i = min(k, (int)stk.size()) - 1;
        if (i >= 0) inc[i] += val;
    }
};
```

### 9. Online Stock Span

#### Problem
Implement `StockSpanner` with a single method `next(price)` that returns the stock's span for the current day: the number of consecutive days (ending today, going backward) on which the price was less than or equal to today's price. Prices arrive one at a time in stream order. Aim for O(1) amortized time per call.

#### Pattern
**Monotonic decreasing stack of (price, span) pairs.** **O(1)** amortized per call, **O(n)** space. Collapse all preceding days whose price is not greater than today.

#### Explanation
The span of today swallows the spans of every immediately preceding day whose price is less than or equal to today's. Rather than rescan history each call, keep a stack of `(price, span)` entries that is strictly decreasing in price from bottom to top. On `next(price)`, start with `span = 1` (today itself), then while the top entry's price is `<= price`, pop it and add its stored span to `span` — you are folding an already-computed run into today in one step.

Push the merged `(price, span)` back on top and return `span`. Because each price is pushed once and popped at most once across the whole stream, the total work is O(n) and each call is O(1) amortized. The key invariant is that the stack always holds the "staircase" of strictly higher prices still visible looking left from the current position; anything a newer day can absorb is already summarized in a single span field, so no day is ever revisited.

#### Python
A plain list as a stack of `(price, span)` tuples; the `while` loop folds absorbed spans in one amortized-O(1) pass.

```python
class StockSpanner:
    def __init__(self):
        self.stack = []  # (price, span)

    def next(self, price: int) -> int:
        span = 1
        while self.stack and self.stack[-1][0] <= price:
            span += self.stack.pop()[1]
        self.stack.append((price, span))
        return span
```

#### Java
`ArrayDeque<int[]>` as a stack; each `int[]{price, span}` avoids allocating a wrapper class while keeping both fields together.

```java
import java.util.*;

class StockSpanner {
    private Deque<int[]> stack = new ArrayDeque<>();

    public StockSpanner() {}

    public int next(int price) {
        int span = 1;
        while (!stack.isEmpty() && stack.peek()[0] <= price) {
            span += stack.pop()[1];
        }
        stack.push(new int[]{price, span});
        return span;
    }
}
```

#### Rust
A `Vec<(i32, i32)>` stack; `while let Some(&(p, s)) = self.stack.last()` peeks by copy, then `pop` removes the absorbed entry.

```rust
struct StockSpanner {
    stack: Vec<(i32, i32)>,
}

impl StockSpanner {
    fn new() -> Self {
        StockSpanner { stack: Vec::new() }
    }

    fn next(&mut self, price: i32) -> i32 {
        let mut span = 1;
        while let Some(&(p, s)) = self.stack.last() {
            if p <= price {
                span += s;
                self.stack.pop();
            } else {
                break;
            }
        }
        self.stack.push((price, span));
        span
    }
}
```

#### Go
A slice of `[2]int` used as a stack; reslicing `s.stack[:len-1]` pops, and value arrays keep the pair contiguous.

```go
type StockSpanner struct {
    stack [][2]int
}

func Constructor() StockSpanner {
    return StockSpanner{}
}

func (s *StockSpanner) Next(price int) int {
    span := 1
    for len(s.stack) > 0 && s.stack[len(s.stack)-1][0] <= price {
        span += s.stack[len(s.stack)-1][1]
        s.stack = s.stack[:len(s.stack)-1]
    }
    s.stack = append(s.stack, [2]int{price, span})
    return span
}
```

#### C++
`std::stack<pair<int,int>>` holds `{price, span}`; `top()`/`pop()` drive the monotonic collapse.

```cpp
#include <stack>
#include <utility>
using namespace std;

class StockSpanner {
    stack<pair<int, int>> stk;

public:
    StockSpanner() {}

    int next(int price) {
        int span = 1;
        while (!stk.empty() && stk.top().first <= price) {
            span += stk.top().second;
            stk.pop();
        }
        stk.push({price, span});
        return span;
    }
};
```

### 10. Design Linked List

#### Problem
Implement `MyLinkedList` (0-indexed) with `get(index)` (value at `index`, or -1 if invalid), `addAtHead(val)`, `addAtTail(val)`, `addAtIndex(index, val)` (insert before `index`; if `index == size` append, if `index > size` do nothing), and `deleteAtIndex(index)`. You design the node type yourself. A singly linked list with a size counter gives O(1) head insert and O(index) positional access.

#### Pattern
**Singly linked list of nodes + size counter.** **O(1)** head insert, **O(index)** access/insert/delete, **O(n)** for tail. Walk to the predecessor slot, then relink.

#### Explanation
This is the canonical "prove you can splice pointers" problem. Store a `head` pointer and a `size` count; the count lets every public method validate `index` in O(1) and lets `addAtTail` reuse `addAtIndex(size, val)`. Insertion and deletion both hinge on reaching the node *before* the target so you can rewrite one `next` pointer: for index 0 you special-case the head, otherwise you advance `index - 1` steps.

The bounds rules are the fiddly part and where most submissions fail: `get`/`deleteAtIndex` require `0 <= index < size`, while `addAtIndex` accepts `0 <= index <= size` (equal to `size` means append). Anything out of range is a silent no-op (or -1 for `get`). Keeping `size` exactly in sync on every successful insert and delete is what makes the O(1) validation and the `addAtTail` shortcut correct. A doubly linked list with a tail sentinel would make `addAtTail` O(1), but the singly linked version is the cleaner, more portable answer.

#### Python
A minimal `Node` class plus `head`/`size`; slicing to the predecessor with a simple `for _ in range(index - 1)` walk keeps the relinking obvious.

```python
class Node:
    def __init__(self, val=0, nxt=None):
        self.val = val
        self.next = nxt

class MyLinkedList:
    def __init__(self):
        self.head = None
        self.size = 0

    def get(self, index: int) -> int:
        if index < 0 or index >= self.size:
            return -1
        cur = self.head
        for _ in range(index):
            cur = cur.next
        return cur.val

    def addAtHead(self, val: int) -> None:
        self.addAtIndex(0, val)

    def addAtTail(self, val: int) -> None:
        self.addAtIndex(self.size, val)

    def addAtIndex(self, index: int, val: int) -> None:
        if index < 0 or index > self.size:
            return
        if index == 0:
            self.head = Node(val, self.head)
        else:
            prev = self.head
            for _ in range(index - 1):
                prev = prev.next
            prev.next = Node(val, prev.next)
        self.size += 1

    def deleteAtIndex(self, index: int) -> None:
        if index < 0 or index >= self.size:
            return
        if index == 0:
            self.head = self.head.next
        else:
            prev = self.head
            for _ in range(index - 1):
                prev = prev.next
            prev.next = prev.next.next
        self.size -= 1
```

#### Java
A private static nested `Node` class keeps the type encapsulated; garbage collection means deletes are just a pointer rewrite.

```java
class MyLinkedList {
    private static class Node {
        int val;
        Node next;
        Node(int val) { this.val = val; }
    }

    private Node head;
    private int size;

    public MyLinkedList() {
        head = null;
        size = 0;
    }

    public int get(int index) {
        if (index < 0 || index >= size) return -1;
        Node cur = head;
        for (int i = 0; i < index; i++) cur = cur.next;
        return cur.val;
    }

    public void addAtHead(int val) { addAtIndex(0, val); }

    public void addAtTail(int val) { addAtIndex(size, val); }

    public void addAtIndex(int index, int val) {
        if (index < 0 || index > size) return;
        Node node = new Node(val);
        if (index == 0) {
            node.next = head;
            head = node;
        } else {
            Node prev = head;
            for (int i = 0; i < index - 1; i++) prev = prev.next;
            node.next = prev.next;
            prev.next = node;
        }
        size++;
    }

    public void deleteAtIndex(int index) {
        if (index < 0 || index >= size) return;
        if (index == 0) {
            head = head.next;
        } else {
            Node prev = head;
            for (int i = 0; i < index - 1; i++) prev = prev.next;
            prev.next = prev.next.next;
        }
        size--;
    }
}
```

#### Rust
`Option<Box<Node>>` models the ownership chain; walking a `&mut Option<Box<Node>>` cursor and using `take()` lets you splice without cloning or unsafe code.

```rust
struct Node {
    val: i32,
    next: Option<Box<Node>>,
}

struct MyLinkedList {
    head: Option<Box<Node>>,
    size: i32,
}

impl MyLinkedList {
    fn new() -> Self {
        MyLinkedList { head: None, size: 0 }
    }

    fn get(&self, index: i32) -> i32 {
        if index < 0 || index >= self.size {
            return -1;
        }
        let mut cur = &self.head;
        for _ in 0..index {
            cur = &cur.as_ref().unwrap().next;
        }
        cur.as_ref().unwrap().val
    }

    fn add_at_head(&mut self, val: i32) {
        self.add_at_index(0, val);
    }

    fn add_at_tail(&mut self, val: i32) {
        self.add_at_index(self.size, val);
    }

    fn add_at_index(&mut self, index: i32, val: i32) {
        if index < 0 || index > self.size {
            return;
        }
        let mut cur = &mut self.head;
        for _ in 0..index {
            cur = &mut cur.as_mut().unwrap().next;
        }
        let node = Box::new(Node { val, next: cur.take() });
        *cur = Some(node);
        self.size += 1;
    }

    fn delete_at_index(&mut self, index: i32) {
        if index < 0 || index >= self.size {
            return;
        }
        let mut cur = &mut self.head;
        for _ in 0..index {
            cur = &mut cur.as_mut().unwrap().next;
        }
        let next = cur.as_mut().unwrap().next.take();
        *cur = next;
        self.size -= 1;
    }
}
```

#### Go
An unexported `node` struct with `*node` links; `nil` is the empty list and the zero value of `MyLinkedList` is already a valid empty list.

```go
type node struct {
    val  int
    next *node
}

type MyLinkedList struct {
    head *node
    size int
}

func Constructor() MyLinkedList {
    return MyLinkedList{}
}

func (l *MyLinkedList) Get(index int) int {
    if index < 0 || index >= l.size {
        return -1
    }
    cur := l.head
    for i := 0; i < index; i++ {
        cur = cur.next
    }
    return cur.val
}

func (l *MyLinkedList) AddAtHead(val int) { l.AddAtIndex(0, val) }

func (l *MyLinkedList) AddAtTail(val int) { l.AddAtIndex(l.size, val) }

func (l *MyLinkedList) AddAtIndex(index int, val int) {
    if index < 0 || index > l.size {
        return
    }
    if index == 0 {
        l.head = &node{val: val, next: l.head}
    } else {
        prev := l.head
        for i := 0; i < index-1; i++ {
            prev = prev.next
        }
        prev.next = &node{val: val, next: prev.next}
    }
    l.size++
}

func (l *MyLinkedList) DeleteAtIndex(index int) {
    if index < 0 || index >= l.size {
        return
    }
    if index == 0 {
        l.head = l.head.next
    } else {
        prev := l.head
        for i := 0; i < index-1; i++ {
            prev = prev.next
        }
        prev.next = prev.next.next
    }
    l.size--
}
```

#### C++
A private nested `Node` struct with raw `Node*`; delete the unlinked node explicitly to avoid a leak, since there is no garbage collector.

```cpp
class MyLinkedList {
    struct Node {
        int val;
        Node* next;
        Node(int v) : val(v), next(nullptr) {}
    };

    Node* head = nullptr;
    int size = 0;

public:
    MyLinkedList() {}

    int get(int index) {
        if (index < 0 || index >= size) return -1;
        Node* cur = head;
        for (int i = 0; i < index; i++) cur = cur->next;
        return cur->val;
    }

    void addAtHead(int val) { addAtIndex(0, val); }

    void addAtTail(int val) { addAtIndex(size, val); }

    void addAtIndex(int index, int val) {
        if (index < 0 || index > size) return;
        Node* node = new Node(val);
        if (index == 0) {
            node->next = head;
            head = node;
        } else {
            Node* prev = head;
            for (int i = 0; i < index - 1; i++) prev = prev->next;
            node->next = prev->next;
            prev->next = node;
        }
        size++;
    }

    void deleteAtIndex(int index) {
        if (index < 0 || index >= size) return;
        Node* victim;
        if (index == 0) {
            victim = head;
            head = head->next;
        } else {
            Node* prev = head;
            for (int i = 0; i < index - 1; i++) prev = prev->next;
            victim = prev->next;
            prev->next = victim->next;
        }
        delete victim;
        size--;
    }
};
```

### 11. Design Browser History

#### Problem
Implement `BrowserHistory(homepage)` with `visit(url)` (go to `url` from the current page, clearing all forward history), `back(steps)` (move back up to `steps` pages, stopping at the oldest), and `forward(steps)` (move forward up to `steps` pages, stopping at the newest). `back` and `forward` return the resulting URL. Each operation should run in O(1) time (amortized for `visit`).

#### Pattern
**Dynamic array + current-position cursor.** **O(1)** amortized `visit`, **O(1)** `back`/`forward`, **O(n)** space. Truncate forward history on visit; clamp the cursor on navigation.

#### Explanation
Model history as a growable array with an integer `cur` pointing at the current page. `back` and `forward` are pure cursor arithmetic clamped to `[0, len - 1]`: `cur = max(0, cur - steps)` and `cur = min(len - 1, cur + steps)`. No data moves, so both are O(1).

`visit` is where the forward branch dies: any pages after `cur` become unreachable, so you truncate the array to length `cur + 1`, append the new URL, and advance `cur`. Truncate-then-append is O(1) amortized. This beats a doubly linked list or two-stack design in both simplicity and cache behavior, and it exactly matches real browser semantics — visiting a new page from the middle of your history discards everything you could have gone forward to. The only edge cases are clamping so `back`/`forward` never run off either end.

#### Python
A list plus an integer cursor; `del self.history[self.cur + 1:]` drops the dead forward branch in one slice.

```python
class BrowserHistory:
    def __init__(self, homepage: str):
        self.history = [homepage]
        self.cur = 0

    def visit(self, url: str) -> None:
        del self.history[self.cur + 1:]
        self.history.append(url)
        self.cur += 1

    def back(self, steps: int) -> str:
        self.cur = max(0, self.cur - steps)
        return self.history[self.cur]

    def forward(self, steps: int) -> str:
        self.cur = min(len(self.history) - 1, self.cur + steps)
        return self.history[self.cur]
```

#### Java
`ArrayList<String>` with `subList(cur + 1, size).clear()` to lop off forward history in place, then `Math.max`/`Math.min` to clamp.

```java
import java.util.*;

class BrowserHistory {
    private List<String> history = new ArrayList<>();
    private int cur = 0;

    public BrowserHistory(String homepage) {
        history.add(homepage);
    }

    public void visit(String url) {
        history.subList(cur + 1, history.size()).clear();
        history.add(url);
        cur++;
    }

    public String back(int steps) {
        cur = Math.max(0, cur - steps);
        return history.get(cur);
    }

    public String forward(int steps) {
        cur = Math.min(history.size() - 1, cur + steps);
        return history.get(cur);
    }
}
```

#### Rust
A `Vec<String>` with `truncate(cur + 1)` to clear forward history; `saturating_sub` clamps `back` at zero without underflowing `usize`.

```rust
struct BrowserHistory {
    history: Vec<String>,
    cur: usize,
}

impl BrowserHistory {
    fn new(homepage: String) -> Self {
        BrowserHistory { history: vec![homepage], cur: 0 }
    }

    fn visit(&mut self, url: String) {
        self.history.truncate(self.cur + 1);
        self.history.push(url);
        self.cur += 1;
    }

    fn back(&mut self, steps: i32) -> String {
        self.cur = self.cur.saturating_sub(steps as usize);
        self.history[self.cur].clone()
    }

    fn forward(&mut self, steps: i32) -> String {
        self.cur = (self.cur + steps as usize).min(self.history.len() - 1);
        self.history[self.cur].clone()
    }
}
```

#### Go
A `[]string` slice; `append(b.history[:b.cur+1], url)` reuses the backing array to both truncate forward history and push the new page.

```go
type BrowserHistory struct {
    history []string
    cur     int
}

func Constructor(homepage string) BrowserHistory {
    return BrowserHistory{history: []string{homepage}, cur: 0}
}

func (b *BrowserHistory) Visit(url string) {
    b.history = append(b.history[:b.cur+1], url)
    b.cur++
}

func (b *BrowserHistory) Back(steps int) string {
    if steps > b.cur {
        b.cur = 0
    } else {
        b.cur -= steps
    }
    return b.history[b.cur]
}

func (b *BrowserHistory) Forward(steps int) string {
    b.cur += steps
    if b.cur > len(b.history)-1 {
        b.cur = len(b.history) - 1
    }
    return b.history[b.cur]
}
```

#### C++
`std::vector<string>` with `resize(cur + 1)` to drop forward history, then `push_back`; `max`/`min` clamp the cursor.

```cpp
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

class BrowserHistory {
    vector<string> history;
    int cur = 0;

public:
    BrowserHistory(string homepage) {
        history.push_back(homepage);
    }

    void visit(string url) {
        history.resize(cur + 1);
        history.push_back(url);
        cur++;
    }

    string back(int steps) {
        cur = max(0, cur - steps);
        return history[cur];
    }

    string forward(int steps) {
        cur = min((int)history.size() - 1, cur + steps);
        return history[cur];
    }
};
```

### 12. Binary Search Tree Iterator

#### Problem
Implement `BSTIterator(root)` over the in-order (ascending) traversal of a binary search tree, with `next()` returning the next-smallest value and `hasNext()` reporting whether more values remain. `next` and `hasNext` should be O(1) amortized, using O(h) memory where `h` is the tree height (not O(n)). Assume the standard `TreeNode` type is provided.

#### Pattern
**Controlled in-order traversal via an explicit stack of the left spine.** **O(1)** amortized `next`, **O(h)** space. Push all left children, then on `next` pop and descend the popped node's right subtree's left spine.

#### Explanation
A full in-order traversal into a list is O(n) space; the iterator brief demands O(h). The classic solution simulates the recursion stack manually, storing only the "left spine" — the chain of ancestors whose left subtree is still being explored. The constructor pushes `root` and all its left descendants, so the stack top is always the smallest unvisited node.

On `next`, pop the top (the current minimum), and before returning its value, push the left spine of its right child. This restores the invariant that the top is the next smallest node. Although a single `next` can push a whole spine, each node is pushed and popped exactly once over the life of the iterator, so `next` is O(1) amortized. Stack depth never exceeds the tree height, meeting the O(h) space bound; `hasNext` is just a stack-empty check. The empty-tree case works for free — the stack starts empty and `hasNext` returns false.

#### Python
A list as the stack with a `_push_left` helper; sentinel-free since `None` naturally terminates the spine walk.

```python
class BSTIterator:
    def __init__(self, root: Optional[TreeNode]):
        self.stack = []
        self._push_left(root)

    def _push_left(self, node: Optional[TreeNode]) -> None:
        while node:
            self.stack.append(node)
            node = node.left

    def next(self) -> int:
        node = self.stack.pop()
        self._push_left(node.right)
        return node.val

    def hasNext(self) -> bool:
        return len(self.stack) > 0
```

#### Java
`ArrayDeque<TreeNode>` as the stack; a private `pushLeft` factors out the spine descent used by the constructor and `next`.

```java
import java.util.*;

class BSTIterator {
    private Deque<TreeNode> stack = new ArrayDeque<>();

    public BSTIterator(TreeNode root) {
        pushLeft(root);
    }

    private void pushLeft(TreeNode node) {
        while (node != null) {
            stack.push(node);
            node = node.left;
        }
    }

    public int next() {
        TreeNode node = stack.pop();
        pushLeft(node.right);
        return node.val;
    }

    public boolean hasNext() {
        return !stack.isEmpty();
    }
}
```

#### Rust
LeetCode's `TreeNode` uses `Option<Rc<RefCell<TreeNode>>>`; clone the `Rc` (cheap refcount bump) to push child handles, and scope each `borrow()` so no `RefCell` guard outlives the push.

```rust
use std::rc::Rc;
use std::cell::RefCell;

struct BSTIterator {
    stack: Vec<Rc<RefCell<TreeNode>>>,
}

impl BSTIterator {
    fn new(root: Option<Rc<RefCell<TreeNode>>>) -> Self {
        let mut it = BSTIterator { stack: Vec::new() };
        it.push_left(root);
        it
    }

    fn push_left(&mut self, mut node: Option<Rc<RefCell<TreeNode>>>) {
        while let Some(n) = node {
            let left = n.borrow().left.clone();
            self.stack.push(n);
            node = left;
        }
    }

    fn next(&mut self) -> i32 {
        let node = self.stack.pop().unwrap();
        let (val, right) = {
            let b = node.borrow();
            (b.val, b.right.clone())
        };
        self.push_left(right);
        val
    }

    fn has_next(&self) -> bool {
        !self.stack.is_empty()
    }
}
```

#### Go
A `[]*TreeNode` slice as the stack; `pushLeft` follows `.Left` pointers until `nil`, and reslicing pops.

```go
type BSTIterator struct {
    stack []*TreeNode
}

func Constructor(root *TreeNode) BSTIterator {
    it := BSTIterator{}
    it.pushLeft(root)
    return it
}

func (it *BSTIterator) pushLeft(node *TreeNode) {
    for node != nil {
        it.stack = append(it.stack, node)
        node = node.Left
    }
}

func (it *BSTIterator) Next() int {
    n := len(it.stack) - 1
    node := it.stack[n]
    it.stack = it.stack[:n]
    it.pushLeft(node.Right)
    return node.Val
}

func (it *BSTIterator) HasNext() bool {
    return len(it.stack) > 0
}
```

#### C++
`std::stack<TreeNode*>`; a private `pushLeft` helper drives both the constructor and `next` down the left spine.

```cpp
#include <stack>
using namespace std;

class BSTIterator {
    stack<TreeNode*> stk;

    void pushLeft(TreeNode* node) {
        while (node) {
            stk.push(node);
            node = node->left;
        }
    }

public:
    BSTIterator(TreeNode* root) {
        pushLeft(root);
    }

    int next() {
        TreeNode* node = stk.top();
        stk.pop();
        pushLeft(node->right);
        return node->val;
    }

    bool hasNext() {
        return !stk.empty();
    }
};
```

### 13. Peeking Iterator

#### Problem
Design a `PeekingIterator` that wraps an existing iterator (supporting `next()` and `hasNext()`) and adds a `peek()` operation that returns the element that a subsequent `next()` would return, without advancing the iterator. The constructor takes the underlying iterator. Support `next()` (return and consume the next element), `peek()` (return the next element without consuming), and `hasNext()`. All operations must be O(1).

#### Pattern
**One-element lookahead buffer over an iterator.** **O(1)** per operation, **O(1)** extra space. Cache the next value eagerly so peek is free.

#### Explanation
The underlying iterator only lets you move forward, so to implement `peek()` you must be able to look at an element without losing it. The clean invariant is: always keep one element "pulled" from the source in a buffer whenever one exists. On construction you prime the buffer by pulling the first element (if any). `peek()` returns the buffered value untouched; `next()` returns the buffered value and immediately refills the buffer by pulling the next element from the source; `hasNext()` just reports whether the buffer currently holds a value.

The subtlety is the boundary between "the buffer holds a real value" and "the source is exhausted." Rather than a nullable value (which is ambiguous if the stream can contain null-like values), carry a boolean `hasPeeked`/`has_next` flag alongside the cached value. Every refill sets that flag from the source's `hasNext()`. This keeps all three operations O(1) with no re-reading of the source, and correctly handles empty streams (the initial prime leaves the flag false).

#### Python
Prime `self._buf` from the wrapped iterator in `__init__`; a sentinel `self._has` boolean distinguishes "buffered" from "exhausted" without conflating with `None` data.

```python
class PeekingIterator:
    def __init__(self, iterator):
        self._it = iterator
        self._has = iterator.hasNext()
        self._buf = iterator.next() if self._has else None

    def peek(self):
        return self._buf

    def next(self):
        val = self._buf
        self._has = self._it.hasNext()
        self._buf = self._it.next() if self._has else None
        return val

    def hasNext(self):
        return self._has
```

#### Java
`Iterator<Integer>` from `java.util`; hold the lookahead in a field and refill on every `next()`. A boolean flag guards exhaustion cleanly.

```java
import java.util.*;

class PeekingIterator implements Iterator<Integer> {
    private final Iterator<Integer> it;
    private boolean has;
    private Integer buf;

    public PeekingIterator(Iterator<Integer> iterator) {
        it = iterator;
        has = it.hasNext();
        buf = has ? it.next() : null;
    }

    public Integer peek() {
        return buf;
    }

    @Override
    public Integer next() {
        Integer val = buf;
        has = it.hasNext();
        buf = has ? it.next() : null;
        return val;
    }

    @Override
    public boolean hasNext() {
        return has;
    }
}
```

#### Rust
Wrap any `Iterator<Item = i32>` and store the pulled value in an `Option<i32>`; `Some` means buffered, `None` means exhausted, so no extra flag is needed.

```rust
pub struct PeekingIterator<I: Iterator<Item = i32>> {
    it: I,
    buf: Option<i32>,
}

impl<I: Iterator<Item = i32>> PeekingIterator<I> {
    pub fn new(mut iterator: I) -> Self {
        let buf = iterator.next();
        PeekingIterator { it: iterator, buf }
    }

    pub fn peek(&self) -> Option<i32> {
        self.buf
    }

    pub fn next(&mut self) -> Option<i32> {
        let val = self.buf;
        self.buf = self.it.next();
        val
    }

    pub fn has_next(&self) -> bool {
        self.buf.is_some()
    }
}
```

#### Go
Assume the given `*Iterator` exposes `hasNext()` and `next()`; cache the head element and a `has` bool, refilling in `next`.

```go
type PeekingIterator struct {
    it  *Iterator
    has bool
    buf int
}

func Constructor(iter *Iterator) *PeekingIterator {
    p := &PeekingIterator{it: iter}
    p.has = iter.hasNext()
    if p.has {
        p.buf = iter.next()
    }
    return p
}

func (p *PeekingIterator) hasNext() bool {
    return p.has
}

func (p *PeekingIterator) next() int {
    val := p.buf
    p.has = p.it.hasNext()
    if p.has {
        p.buf = p.it.next()
    }
    return val
}

func (p *PeekingIterator) peek() int {
    return p.buf
}
```

#### C++
The provided `Iterator` base class offers `next()`/`hasNext()`; store the lookahead and a bool, refilling on each `next()`.

```cpp
class PeekingIterator : public Iterator {
    int buf;
    bool has;
public:
    PeekingIterator(const vector<int>& nums) : Iterator(nums) {
        has = Iterator::hasNext();
        if (has) buf = Iterator::next();
    }

    int peek() {
        return buf;
    }

    int next() {
        int val = buf;
        has = Iterator::hasNext();
        if (has) buf = Iterator::next();
        return val;
    }

    bool hasNext() const {
        return has;
    }
};
```

### 14. Flatten Nested List Iterator

#### Problem
Given a nested list of integers where each element is either an integer or a list whose elements are again integers or lists, implement `NestedIterator` that flattens it into a single stream. The constructor takes the `nestedList`; implement `next()` returning the next integer and `hasNext()` returning whether more integers remain. Each `NestedInteger` exposes `isInteger()`, `getInteger()`, and `getList()`.

#### Pattern
**Explicit stack of iterators / reversed elements (lazy DFS).** **O(1)** amortized per `next()`, **O(depth)** to **O(n)** space. Push children on demand instead of pre-flattening.

#### Explanation
The clean approach keeps a stack whose top always advances toward the next integer. Push the top-level items onto a stack in reverse (so the first item is on top). The key helper is a "settle" step run inside `hasNext()`: while the stack's top is a list, pop it and push its children back in reverse order. When `hasNext()` returns, the top is guaranteed to be an integer, so `next()` simply pops and returns it. This is lazy: nested lists are only expanded when the iterator actually reaches them, giving O(depth) working space in the common case rather than materializing everything up front.

An alternative is to pre-flatten everything in the constructor with a recursive DFS into a flat list plus an index pointer. That is simpler to write and O(1) per `next()`, but eagerly walks the entire structure at construction. The stack version is the interview-preferred answer because it is genuinely lazy and handles deeply nested or partially consumed input without doing all the work. The main edge case both must handle is empty sublists like `[[]]` — the settle loop pops them and produces nothing, so `hasNext()` correctly reports false.

#### Python
Store the reversed list as a Python list used as a stack; `hasNext` settles the top by expanding lists via `extend(reversed(...))`.

```python
class NestedIterator:
    def __init__(self, nestedList):
        self._stack = list(reversed(nestedList))

    def next(self):
        return self._stack.pop().getInteger()

    def hasNext(self):
        while self._stack:
            top = self._stack[-1]
            if top.isInteger():
                return True
            self._stack.pop()
            self._stack.extend(reversed(top.getList()))
        return False
```

#### Java
`ArrayDeque<NestedInteger>` as the stack; `hasNext` peeks and expands lists by pushing children in reverse.

```java
import java.util.*;

public class NestedIterator implements Iterator<Integer> {
    private final Deque<NestedInteger> stack = new ArrayDeque<>();

    public NestedIterator(List<NestedInteger> nestedList) {
        for (int i = nestedList.size() - 1; i >= 0; i--) {
            stack.push(nestedList.get(i));
        }
    }

    @Override
    public Integer next() {
        return stack.pop().getInteger();
    }

    @Override
    public boolean hasNext() {
        while (!stack.isEmpty()) {
            NestedInteger top = stack.peek();
            if (top.isInteger()) return true;
            stack.pop();
            List<NestedInteger> list = top.getList();
            for (int i = list.size() - 1; i >= 0; i--) {
                stack.push(list.get(i));
            }
        }
        return false;
    }
}
```

#### Rust
Use a `Vec<NestedInteger>` as an explicit stack; `has_next` takes `&mut self` because settling mutates the stack, and pushes children in reverse.

```rust
struct NestedIterator {
    stack: Vec<NestedInteger>,
}

impl NestedIterator {
    fn new(nested_list: Vec<NestedInteger>) -> Self {
        let mut stack: Vec<NestedInteger> = nested_list;
        stack.reverse();
        NestedIterator { stack }
    }

    fn next(&mut self) -> i32 {
        self.stack.pop().unwrap().get_integer()
    }

    fn has_next(&mut self) -> bool {
        while let Some(top) = self.stack.last() {
            if top.is_integer() {
                return true;
            }
            let list = self.stack.pop().unwrap().get_list();
            for item in list.into_iter().rev() {
                self.stack.push(item);
            }
        }
        false
    }
}
```

#### Go
A slice of `*NestedInteger` as a stack; `HasNext` settles the tail element, appending children in reverse.

```go
type NestedIterator struct {
    stack []*NestedInteger
}

func Constructor(nestedList []*NestedInteger) *NestedIterator {
    it := &NestedIterator{}
    for i := len(nestedList) - 1; i >= 0; i-- {
        it.stack = append(it.stack, nestedList[i])
    }
    return it
}

func (it *NestedIterator) Next() int {
    n := len(it.stack)
    top := it.stack[n-1]
    it.stack = it.stack[:n-1]
    return top.GetInteger()
}

func (it *NestedIterator) HasNext() bool {
    for len(it.stack) > 0 {
        n := len(it.stack)
        top := it.stack[n-1]
        if top.IsInteger() {
            return true
        }
        it.stack = it.stack[:n-1]
        list := top.GetList()
        for i := len(list) - 1; i >= 0; i-- {
            it.stack = append(it.stack, list[i])
        }
    }
    return false
}
```

#### C++
`std::stack<NestedInteger>` (or a vector); `hasNext` pops a list and pushes its children in reverse via reverse iteration.

```cpp
class NestedIterator {
    stack<NestedInteger> st;
public:
    NestedIterator(vector<NestedInteger> &nestedList) {
        for (int i = nestedList.size() - 1; i >= 0; i--) {
            st.push(nestedList[i]);
        }
    }

    int next() {
        int val = st.top().getInteger();
        st.pop();
        return val;
    }

    bool hasNext() {
        while (!st.empty()) {
            NestedInteger top = st.top();
            if (top.isInteger()) return true;
            st.pop();
            vector<NestedInteger>& list = top.getList();
            for (int i = list.size() - 1; i >= 0; i--) {
                st.push(list[i]);
            }
        }
        return false;
    }
};
```

### 15. Flatten 2D Vector

#### Problem
Design an iterator `Vector2D` that flattens a 2D vector (a list of lists of integers) into a single sequence. The constructor takes `vec`, the 2D vector. Implement `next()` returning the next integer and `hasNext()` returning whether any integers remain. The iterator must skip empty inner lists transparently and run in O(1) amortized time per operation.

#### Pattern
**Two indices (outer row, inner column) with a skip-empty advance.** **O(1)** amortized per operation, **O(1)** extra space. Advance past exhausted/empty rows lazily.

#### Explanation
Keep two cursors: an outer index into the list of rows and an inner index into the current row. The single reusable primitive is an `advance` step that, while the outer index still points at a row that is fully consumed (inner index at or past its length, which also covers empty rows), moves to the next row and resets the inner index to 0. Call `advance` at the start of both `hasNext()` and `next()` so the cursors always land on a valid element or run off the end. `hasNext()` returns whether the outer index is still in range after advancing; `next()` returns the current element then bumps the inner index.

The reason for the loop (not a single `if`) is consecutive empty rows: `[[], [], [1]]` requires skipping two empties in one advance. Storing only indices rather than a flattened copy keeps space O(1) and respects the "iterator" spirit — you never materialize the whole thing. The amortized O(1) bound holds because each row and each element is visited exactly once across the lifetime of the iterator.

#### Python
Keep integer indices `outer`/`inner` and a private `_advance` that skips exhausted rows; call it before each read.

```python
class Vector2D:
    def __init__(self, vec):
        self._vec = vec
        self._outer = 0
        self._inner = 0

    def _advance(self):
        while self._outer < len(self._vec) and self._inner == len(self._vec[self._outer]):
            self._outer += 1
            self._inner = 0

    def next(self):
        self._advance()
        val = self._vec[self._outer][self._inner]
        self._inner += 1
        return val

    def hasNext(self):
        self._advance()
        return self._outer < len(self._vec)
```

#### Java
Store the `int[][]` and two ints; a private `advance()` skips finished rows before each `next`/`hasNext`.

```java
import java.util.*;

class Vector2D {
    private final int[][] vec;
    private int outer = 0, inner = 0;

    public Vector2D(int[][] vec) {
        this.vec = vec;
    }

    private void advance() {
        while (outer < vec.length && inner == vec[outer].length) {
            outer++;
            inner = 0;
        }
    }

    public int next() {
        advance();
        return vec[outer][inner++];
    }

    public boolean hasNext() {
        advance();
        return outer < vec.length;
    }
}
```

#### Rust
Hold the `Vec<Vec<i32>>` and two `usize` cursors; `advance` takes `&mut self` and both public methods call it first.

```rust
struct Vector2D {
    vec: Vec<Vec<i32>>,
    outer: usize,
    inner: usize,
}

impl Vector2D {
    fn new(vec: Vec<Vec<i32>>) -> Self {
        Vector2D { vec, outer: 0, inner: 0 }
    }

    fn advance(&mut self) {
        while self.outer < self.vec.len() && self.inner == self.vec[self.outer].len() {
            self.outer += 1;
            self.inner = 0;
        }
    }

    fn next(&mut self) -> i32 {
        self.advance();
        let val = self.vec[self.outer][self.inner];
        self.inner += 1;
        val
    }

    fn has_next(&mut self) -> bool {
        self.advance();
        self.outer < self.vec.len()
    }
}
```

#### Go
Store `[][]int` plus outer/inner ints; an unexported `advance` skips empty and finished rows.

```go
type Vector2D struct {
    vec   [][]int
    outer int
    inner int
}

func Constructor(vec [][]int) Vector2D {
    return Vector2D{vec: vec}
}

func (v *Vector2D) advance() {
    for v.outer < len(v.vec) && v.inner == len(v.vec[v.outer]) {
        v.outer++
        v.inner = 0
    }
}

func (v *Vector2D) Next() int {
    v.advance()
    val := v.vec[v.outer][v.inner]
    v.inner++
    return val
}

func (v *Vector2D) HasNext() bool {
    v.advance()
    return v.outer < len(v.vec)
}
```

#### C++
Keep the `vector<vector<int>>` and two `size_t` indices; a private `advance()` skips consumed rows before each access.

```cpp
class Vector2D {
    vector<vector<int>> vec;
    size_t outer = 0, inner = 0;

    void advance() {
        while (outer < vec.size() && inner == vec[outer].size()) {
            outer++;
            inner = 0;
        }
    }
public:
    Vector2D(vector<vector<int>>& v) : vec(v) {}

    int next() {
        advance();
        return vec[outer][inner++];
    }

    bool hasNext() {
        advance();
        return outer < vec.size();
    }
};
```

### 16. Zigzag Iterator

#### Problem
Given two integer lists `v1` and `v2`, design a `ZigzagIterator` that returns their elements in alternating order: first element of `v1`, first of `v2`, second of `v1`, second of `v2`, and so on; when one list is exhausted, continue with the remainder of the other. Implement `next()` returning the next integer and `hasNext()`. Design it to generalize cleanly to k lists via a queue of active cursors.

#### Pattern
**Round-robin queue of list cursors.** **O(1)** per operation, **O(k)** space for k lists. Rotate a cursor to the back after each read while it still has elements.

#### Explanation
The generalizable solution treats each input list as a cursor (its data plus a position) and holds a queue of the cursors that still have elements. `next()` dequeues the front cursor, reads its current element, advances its position, and if it still has more, enqueues it at the back — that rotation produces the round-robin zigzag order automatically and extends to any number of lists without special-casing. `hasNext()` is simply "is the queue non-empty."

Initialization only enqueues non-empty lists, so uneven lengths and empty inputs need no branches later: once a list runs dry it is never re-added, and the remaining lists keep cycling until all are drained. This is strictly cleaner than tracking a boolean "turn" flag and two indices, which does not scale past two lists. The invariant — the queue contains exactly the cursors with remaining elements, in the order they should next be served — is what makes every operation O(1) and the follow-up "what about k lists?" a non-event.

#### Python
Use `collections.deque` of `(list, index)` cursors; pop-left to read, re-append if the cursor still has elements.

```python
from collections import deque

class ZigzagIterator:
    def __init__(self, v1, v2):
        self._q = deque()
        for v in (v1, v2):
            if v:
                self._q.append((v, 0))

    def next(self):
        v, i = self._q.popleft()
        if i + 1 < len(v):
            self._q.append((v, i + 1))
        return v[i]

    def hasNext(self):
        return len(self._q) > 0
```

#### Java
`ArrayDeque` of small cursor objects holding the list and an index; poll from the front and offer back if not exhausted.

```java
import java.util.*;

public class ZigzagIterator {
    private static class Cursor {
        List<Integer> list;
        int idx;
        Cursor(List<Integer> l) { list = l; idx = 0; }
    }

    private final Deque<Cursor> queue = new ArrayDeque<>();

    public ZigzagIterator(List<Integer> v1, List<Integer> v2) {
        if (!v1.isEmpty()) queue.offer(new Cursor(v1));
        if (!v2.isEmpty()) queue.offer(new Cursor(v2));
    }

    public int next() {
        Cursor c = queue.poll();
        int val = c.list.get(c.idx);
        c.idx++;
        if (c.idx < c.list.size()) queue.offer(c);
        return val;
    }

    public boolean hasNext() {
        return !queue.isEmpty();
    }
}
```

#### Rust
Use `VecDeque<(Vec<i32>, usize)>` cursors; `pop_front` to read and `push_back` when the cursor has more, sidestepping shared ownership.

```rust
use std::collections::VecDeque;

struct ZigzagIterator {
    queue: VecDeque<(Vec<i32>, usize)>,
}

impl ZigzagIterator {
    fn new(v1: Vec<i32>, v2: Vec<i32>) -> Self {
        let mut queue = VecDeque::new();
        for v in [v1, v2] {
            if !v.is_empty() {
                queue.push_back((v, 0));
            }
        }
        ZigzagIterator { queue }
    }

    fn next(&mut self) -> i32 {
        let (v, i) = self.queue.pop_front().unwrap();
        let val = v[i];
        if i + 1 < v.len() {
            self.queue.push_back((v, i + 1));
        }
        val
    }

    fn has_next(&self) -> bool {
        !self.queue.is_empty()
    }
}
```

#### Go
A slice-backed queue of cursor structs; slice off the front to read and append when the cursor still has elements.

```go
type cursor struct {
    list []int
    idx  int
}

type ZigzagIterator struct {
    queue []cursor
}

func Constructor(v1, v2 []int) *ZigzagIterator {
    z := &ZigzagIterator{}
    if len(v1) > 0 {
        z.queue = append(z.queue, cursor{v1, 0})
    }
    if len(v2) > 0 {
        z.queue = append(z.queue, cursor{v2, 0})
    }
    return z
}

func (z *ZigzagIterator) next() int {
    c := z.queue[0]
    z.queue = z.queue[1:]
    val := c.list[c.idx]
    if c.idx+1 < len(c.list) {
        c.idx++
        z.queue = append(z.queue, c)
    }
    return val
}

func (z *ZigzagIterator) hasNext() bool {
    return len(z.queue) > 0
}
```

#### C++
`std::queue` of `(vector<int>, index)` cursors; pop from the front, push back when the cursor is not exhausted.

```cpp
class ZigzagIterator {
    queue<pair<vector<int>, size_t>> q;
public:
    ZigzagIterator(vector<int>& v1, vector<int>& v2) {
        if (!v1.empty()) q.push({v1, 0});
        if (!v2.empty()) q.push({v2, 0});
    }

    int next() {
        auto [v, i] = q.front();
        q.pop();
        if (i + 1 < v.size()) q.push({v, i + 1});
        return v[i];
    }

    bool hasNext() {
        return !q.empty();
    }
};
```

### 17. RLE Iterator

#### Problem
Design an `RLEIterator` over a sequence encoded as run-length pairs: the input array `encoding` is read in pairs `[count, value]`, meaning `value` appears `count` times consecutively. Implement `next(n)` which exhausts the next `n` elements of the sequence and returns the last element exhausted, or returns `-1` if fewer than `n` elements remain. The constructor takes the `encoding` array. Aim for time proportional to the number of runs consumed rather than the number of elements.

#### Pattern
**Pointer over run pairs with in-place count decrement.** **O(runs consumed)** per `next(n)`, **O(1)** extra space. Skip whole runs at a time instead of element by element.

#### Explanation
Never expand the runs into actual elements — with counts up to 10^9 that would blow up. Instead keep a pointer `i` into the encoding at the current run's count field. For `next(n)`, repeatedly look at the current run's remaining count: if `n` exceeds it, subtract the whole run from `n`, zero it (or advance the pointer past it), and continue; otherwise the answer lies inside this run, so subtract `n` from the run's count and return this run's value. If you fall off the end of the encoding before consuming `n`, return -1.

The trick that makes this efficient is decrementing the stored count in place (or tracking how far into the current run you are) so that consecutive `next` calls resume exactly where the last left off. Each `next(n)` only touches the runs it actually consumes, so a call that lands mid-run is O(1) and one that skips many runs is proportional to those runs — never to the element count. The key edge cases: `next(0)` should consume nothing (guard it or let the loop return the current run's value harmlessly is wrong, so treat n as strictly consuming), a run whose count is exactly `n`, and running out of encoding entirely.

#### Python
Keep index `i` into the flat `encoding` list and mutate `encoding[i]` (the remaining count) in place as runs are consumed.

```python
class RLEIterator:
    def __init__(self, encoding):
        self._enc = encoding
        self._i = 0

    def next(self, n):
        while self._i < len(self._enc):
            if n <= self._enc[self._i]:
                self._enc[self._i] -= n
                return self._enc[self._i + 1]
            n -= self._enc[self._i]
            self._i += 2
        return -1
```

#### Java
Use `long` for the counts to avoid overflow when summing large runs; advance an index by 2 and decrement the current count in place.

```java
import java.util.*;

class RLEIterator {
    private final long[] enc;
    private int i = 0;

    public RLEIterator(int[] encoding) {
        enc = new long[encoding.length];
        for (int k = 0; k < encoding.length; k++) enc[k] = encoding[k];
    }

    public int next(int n) {
        while (i < enc.length) {
            if (n <= enc[i]) {
                enc[i] -= n;
                return (int) enc[i + 1];
            }
            n -= enc[i];
            i += 2;
        }
        return -1;
    }
}
```

#### Rust
Store the encoding as `Vec<i64>` (counts can be large) and a `usize` pointer; decrement the current count in place, returning `-1` past the end.

```rust
struct RLEIterator {
    enc: Vec<i64>,
    i: usize,
}

impl RLEIterator {
    fn new(encoding: Vec<i32>) -> Self {
        RLEIterator {
            enc: encoding.into_iter().map(|x| x as i64).collect(),
            i: 0,
        }
    }

    fn next(&mut self, n: i32) -> i32 {
        let mut n = n as i64;
        while self.i < self.enc.len() {
            if n <= self.enc[self.i] {
                self.enc[self.i] -= n;
                return self.enc[self.i + 1] as i32;
            }
            n -= self.enc[self.i];
            self.i += 2;
        }
        -1
    }
}
```

#### Go
Keep an `[]int64` copy of the encoding (counts sum beyond int32) and an index; subtract whole runs, then decrement the landing run in place.

```go
type RLEIterator struct {
    enc []int64
    i   int
}

func Constructor(encoding []int) RLEIterator {
    enc := make([]int64, len(encoding))
    for k, v := range encoding {
        enc[k] = int64(v)
    }
    return RLEIterator{enc: enc}
}

func (r *RLEIterator) Next(n int) int {
    nn := int64(n)
    for r.i < len(r.enc) {
        if nn <= r.enc[r.i] {
            r.enc[r.i] -= nn
            return int(r.enc[r.i+1])
        }
        nn -= r.enc[r.i]
        r.i += 2
    }
    return -1
}
```

#### C++
Store counts as `long long` to prevent overflow; walk an index over run pairs, decrementing the current count in place.

```cpp
class RLEIterator {
    vector<long long> enc;
    size_t i = 0;
public:
    RLEIterator(vector<int>& encoding) {
        enc.assign(encoding.begin(), encoding.end());
    }

    int next(int n) {
        long long nn = n;
        while (i < enc.size()) {
            if (nn <= enc[i]) {
                enc[i] -= nn;
                return (int) enc[i + 1];
            }
            nn -= enc[i];
            i += 2;
        }
        return -1;
    }
};
```

### 18. Iterator for Combination

#### Problem
Design `CombinationIterator` over the lowercase letters of a given sorted `characters` string, iterating over all combinations of length `combinationLength` in lexicographical order. The constructor takes `characters` (sorted, distinct) and `combinationLength`. Implement `next()` returning the next combination as a string and `hasNext()` returning whether any combination remains. Combinations must be produced in lexicographic order.

#### Pattern
**Index-combination advance (odometer on indices) or precomputed queue.** **O(k)** per `next()`, **O(k)** state for the streaming version. Increment the rightmost index that can still grow.

#### Explanation
The streaming solution stores the current combination as a strictly increasing array of `k` indices into `characters`, initialized to `[0, 1, ..., k-1]` — the lexicographically smallest combination. `next()` first snapshots the current indices as the string to return, then advances the index array like an odometer: scan from the rightmost position leftward to find a position `i` whose value can still increase without colliding with the fixed tail (its ceiling is `len(characters) - k + i`). Increment that position, then reset every position to its right to consecutive values (`indices[j] = indices[j-1] + 1`). If no position can advance, the iterator is exhausted.

Because `characters` is already sorted and distinct, increasing indices map directly to lexicographic order, so the odometer advance yields exactly the right sequence. `hasNext()` is a boolean tracking whether a valid current combination exists (set false once the advance fails). The streaming version uses only O(k) space, which matters when the number of combinations C(n, k) is huge; a simpler but heavier alternative precomputes all combinations into a queue in the constructor via DFS and pops the front on each `next()` — fine for the small inputs LeetCode uses, but not the scalable answer. The main edge case is the final combination `[n-k, ..., n-1]`, where the leftward scan finds no advanceable position and correctly marks exhaustion.

#### Python
Track a list of `k` indices and advance them odometer-style; `hasNext` reads a `self._has` flag flipped off when no index can grow.

```python
class CombinationIterator:
    def __init__(self, characters, combinationLength):
        self._chars = characters
        self._k = combinationLength
        self._n = len(characters)
        self._idx = list(range(self._k))
        self._has = True

    def next(self):
        combo = ''.join(self._chars[i] for i in self._idx)
        i = self._k - 1
        while i >= 0 and self._idx[i] == self._n - self._k + i:
            i -= 1
        if i < 0:
            self._has = False
        else:
            self._idx[i] += 1
            for j in range(i + 1, self._k):
                self._idx[j] = self._idx[j - 1] + 1
        return combo

    def hasNext(self):
        return self._has
```

#### Java
Hold an `int[]` of indices and a boolean; build the current string, then odometer-advance, resetting the tail to consecutive values.

```java
import java.util.*;

class CombinationIterator {
    private final String chars;
    private final int k, n;
    private final int[] idx;
    private boolean has = true;

    public CombinationIterator(String characters, int combinationLength) {
        chars = characters;
        k = combinationLength;
        n = characters.length();
        idx = new int[k];
        for (int i = 0; i < k; i++) idx[i] = i;
    }

    public String next() {
        StringBuilder sb = new StringBuilder();
        for (int i : idx) sb.append(chars.charAt(i));
        int i = k - 1;
        while (i >= 0 && idx[i] == n - k + i) i--;
        if (i < 0) {
            has = false;
        } else {
            idx[i]++;
            for (int j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
        }
        return sb.toString();
    }

    public boolean hasNext() {
        return has;
    }
}
```

#### Rust
Keep `Vec<usize>` indices and a `has` bool; borrow `characters` as bytes to build each combination string, advancing indices like an odometer.

```rust
struct CombinationIterator {
    chars: Vec<u8>,
    k: usize,
    n: usize,
    idx: Vec<usize>,
    has: bool,
}

impl CombinationIterator {
    fn new(characters: String, combination_length: i32) -> Self {
        let k = combination_length as usize;
        let chars = characters.into_bytes();
        let n = chars.len();
        CombinationIterator {
            chars,
            k,
            n,
            idx: (0..k).collect(),
            has: true,
        }
    }

    fn next(&mut self) -> String {
        let combo: String = self.idx.iter().map(|&i| self.chars[i] as char).collect();
        let mut i = self.k as isize - 1;
        while i >= 0 && self.idx[i as usize] == self.n - self.k + i as usize {
            i -= 1;
        }
        if i < 0 {
            self.has = false;
        } else {
            let i = i as usize;
            self.idx[i] += 1;
            for j in i + 1..self.k {
                self.idx[j] = self.idx[j - 1] + 1;
            }
        }
        combo
    }

    fn has_next(&self) -> bool {
        self.has
    }
}
```

#### Go
Store an `[]int` of indices plus a `has` bool; assemble the current combination via a byte slice, then odometer-advance the indices.

```go
type CombinationIterator struct {
    chars string
    k     int
    n     int
    idx   []int
    has   bool
}

func Constructor(characters string, combinationLength int) CombinationIterator {
    k := combinationLength
    idx := make([]int, k)
    for i := 0; i < k; i++ {
        idx[i] = i
    }
    return CombinationIterator{chars: characters, k: k, n: len(characters), idx: idx, has: true}
}

func (c *CombinationIterator) Next() string {
    buf := make([]byte, c.k)
    for j, i := range c.idx {
        buf[j] = c.chars[i]
    }
    i := c.k - 1
    for i >= 0 && c.idx[i] == c.n-c.k+i {
        i--
    }
    if i < 0 {
        c.has = false
    } else {
        c.idx[i]++
        for j := i + 1; j < c.k; j++ {
            c.idx[j] = c.idx[j-1] + 1
        }
    }
    return string(buf)
}

func (c *CombinationIterator) HasNext() bool {
    return c.has
}
```

#### C++
Keep a `vector<int>` of indices and a bool; build the string from `characters`, then advance the indices odometer-style resetting the tail.

```cpp
class CombinationIterator {
    string chars;
    int k, n;
    vector<int> idx;
    bool has = true;
public:
    CombinationIterator(string characters, int combinationLength) {
        chars = characters;
        k = combinationLength;
        n = characters.size();
        idx.resize(k);
        for (int i = 0; i < k; i++) idx[i] = i;
    }

    string next() {
        string combo;
        for (int i : idx) combo += chars[i];
        int i = k - 1;
        while (i >= 0 && idx[i] == n - k + i) i--;
        if (i < 0) {
            has = false;
        } else {
            idx[i]++;
            for (int j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
        }
        return combo;
    }

    bool hasNext() {
        return has;
    }
};
```

### 19. Design a Text Editor

#### Problem
Design a `TextEditor` with a movable cursor. Implement `addText(text)` which inserts `text` at the cursor (cursor moves to the end of the inserted text), `deleteText(k)` which deletes up to `k` characters to the left of the cursor and returns the number actually deleted, `cursorLeft(k)` which moves the cursor left up to `k` times and returns the last min(10, len) characters to the left of the cursor, and `cursorRight(k)` which moves the cursor right up to `k` times and returns the last min(10, len) characters to the left of the cursor. All operations should be amortized O(k + result) time.

#### Pattern
**Two stacks straddling the cursor (or a gap buffer).** **O(k)** amortized per operation, **O(n)** space. The cursor position is the boundary between the two stacks.

#### Explanation
The killer requirement is efficient editing at an arbitrary cursor, not just at the end. A single array forces O(n) shifts on every insert/delete mid-string. The trick is to keep two stacks: `left` holds characters to the left of the cursor (top of stack is the character immediately left of the cursor) and `right` holds characters to the right (top is the character immediately right). This is a gap buffer expressed as two stacks.

Every operation becomes cheap. `addText` pushes onto `left`. `deleteText(k)` pops up to k from `left`. `cursorLeft(k)` moves up to k characters from the top of `left` to the top of `right`; `cursorRight(k)` does the reverse. Because the cursor is always the boundary, moving it is just transferring characters between the two stacks — no reindexing. The returned window is simply the top min(10, size) of `left`, read in order. The only edge cases are running past the string ends: clamp every k to the available size, which the pop-until-empty loops handle naturally.

#### Python
Two plain lists as stacks; `left[-10:]` gives the trailing window without extra bookkeeping.

```python
class TextEditor:
    def __init__(self):
        self.left = []
        self.right = []

    def addText(self, text: str) -> None:
        self.left.extend(text)

    def deleteText(self, k: int) -> int:
        d = min(k, len(self.left))
        for _ in range(d):
            self.left.pop()
        return d

    def cursorLeft(self, k: int) -> str:
        for _ in range(min(k, len(self.left))):
            self.right.append(self.left.pop())
        return "".join(self.left[-10:])

    def cursorRight(self, k: int) -> str:
        for _ in range(min(k, len(self.right))):
            self.left.append(self.right.pop())
        return "".join(self.left[-10:])
```

#### Java
`StringBuilder` used as a stack for `left` (append/deleteCharAt at the end are O(1) amortized); a `Deque<Character>` for `right`.

```java
import java.util.*;

class TextEditor {
    private final StringBuilder left = new StringBuilder();
    private final Deque<Character> right = new ArrayDeque<>();

    public TextEditor() {}

    public void addText(String text) {
        left.append(text);
    }

    public int deleteText(int k) {
        int d = Math.min(k, left.length());
        left.setLength(left.length() - d);
        return d;
    }

    public String cursorLeft(int k) {
        int m = Math.min(k, left.length());
        for (int i = 0; i < m; i++) {
            right.push(left.charAt(left.length() - 1));
            left.setLength(left.length() - 1);
        }
        return window();
    }

    public String cursorRight(int k) {
        int m = Math.min(k, right.size());
        for (int i = 0; i < m; i++) {
            left.append(right.pop());
        }
        return window();
    }

    private String window() {
        return left.substring(Math.max(0, left.length() - 10));
    }
}
```

#### Rust
Two `Vec<char>` stacks; `pop`/`push` are the natural cursor-transfer ops and avoid any UTF-8 byte-index headaches.

```rust
struct TextEditor {
    left: Vec<char>,
    right: Vec<char>,
}

impl TextEditor {
    fn new() -> Self {
        TextEditor { left: Vec::new(), right: Vec::new() }
    }

    fn add_text(&mut self, text: String) {
        self.left.extend(text.chars());
    }

    fn delete_text(&mut self, k: i32) -> i32 {
        let d = (k as usize).min(self.left.len());
        self.left.truncate(self.left.len() - d);
        d as i32
    }

    fn cursor_left(&mut self, k: i32) -> String {
        for _ in 0..(k as usize).min(self.left.len()) {
            let c = self.left.pop().unwrap();
            self.right.push(c);
        }
        self.window()
    }

    fn cursor_right(&mut self, k: i32) -> String {
        for _ in 0..(k as usize).min(self.right.len()) {
            let c = self.right.pop().unwrap();
            self.left.push(c);
        }
        self.window()
    }

    fn window(&self) -> String {
        let start = self.left.len().saturating_sub(10);
        self.left[start..].iter().collect()
    }
}
```

#### Go
Two `[]byte` slices as stacks; slice reslicing (`s[:len-1]`) is the O(1) pop, and `string(left[start:])` builds the window.

```go
type TextEditor struct {
    left  []byte
    right []byte
}

func Constructor() TextEditor {
    return TextEditor{}
}

func (t *TextEditor) AddText(text string) {
    t.left = append(t.left, text...)
}

func (t *TextEditor) DeleteText(k int) int {
    d := k
    if d > len(t.left) {
        d = len(t.left)
    }
    t.left = t.left[:len(t.left)-d]
    return d
}

func (t *TextEditor) CursorLeft(k int) string {
    for i := 0; i < k && len(t.left) > 0; i++ {
        c := t.left[len(t.left)-1]
        t.left = t.left[:len(t.left)-1]
        t.right = append(t.right, c)
    }
    return t.window()
}

func (t *TextEditor) CursorRight(k int) string {
    for i := 0; i < k && len(t.right) > 0; i++ {
        c := t.right[len(t.right)-1]
        t.right = t.right[:len(t.right)-1]
        t.left = append(t.left, c)
    }
    return t.window()
}

func (t *TextEditor) window() string {
    start := len(t.left) - 10
    if start < 0 {
        start = 0
    }
    return string(t.left[start:])
}
```

#### C++
Two `std::string` objects as stacks; `push_back`/`pop_back` and `substr` from the tail give the whole thing in a few lines.

```cpp
#include <string>
#include <algorithm>

class TextEditor {
    std::string left, right;

    std::string window() {
        int start = std::max(0, (int)left.size() - 10);
        return left.substr(start);
    }

public:
    TextEditor() {}

    void addText(std::string text) {
        left += text;
    }

    int deleteText(int k) {
        int d = std::min((int)left.size(), k);
        left.erase(left.size() - d);
        return d;
    }

    std::string cursorLeft(int k) {
        while (k-- > 0 && !left.empty()) {
            right.push_back(left.back());
            left.pop_back();
        }
        return window();
    }

    std::string cursorRight(int k) {
        while (k-- > 0 && !right.empty()) {
            left.push_back(right.back());
            right.pop_back();
        }
        return window();
    }
};
```

### 20. Design HashMap

#### Problem
Design a `MyHashMap` without using any built-in hash-table library. Implement `put(key, value)` to insert or update a mapping, `get(key)` to return the value for a key or `-1` if absent, and `remove(key)` to erase the mapping if present. Keys and values are non-negative integers. Target average O(1) per operation.

#### Pattern
**Open bucket array with separate chaining.** **O(1)** average per operation (O(n/B) worst), **O(n + B)** space, where B is the bucket count.

#### Explanation
The point of the exercise is to build the hash table itself, so we cannot lean on the language's map. We allocate a fixed array of B buckets and map a key to a bucket by `key % B`. Each bucket is a small collection (a linked list, or a vector of key-value pairs) holding every key that hashes there. Choosing B as a reasonably large prime-ish number (a few thousand) keeps chains short given LeetCode's constraints, so we can skip dynamic resizing and still get O(1) average behavior.

Each operation hashes to a bucket, then scans that bucket's chain. `put` updates the value if the key is already present, otherwise appends a new pair. `get` returns the matching value or -1. `remove` unlinks or erases the matching pair. The invariant is that a key lives in exactly one bucket and appears at most once in that bucket's chain. The only subtlety is that `put` must update-in-place rather than blindly append, otherwise duplicate keys accumulate and later `get`/`remove` become inconsistent.

#### Python
A list of lists of `[key, value]` pairs; linear scan within the chosen bucket. A modest prime bucket count keeps chains tiny.

```python
class MyHashMap:
    def __init__(self):
        self.size = 1009
        self.buckets = [[] for _ in range(self.size)]

    def _bucket(self, key: int):
        return self.buckets[key % self.size]

    def put(self, key: int, value: int) -> None:
        b = self._bucket(key)
        for pair in b:
            if pair[0] == key:
                pair[1] = value
                return
        b.append([key, value])

    def get(self, key: int) -> int:
        for k, v in self._bucket(key):
            if k == key:
                return v
        return -1

    def remove(self, key: int) -> None:
        b = self._bucket(key)
        for i, (k, _) in enumerate(b):
            if k == key:
                b.pop(i)
                return
```

#### Java
Array of `LinkedList<int[]>` buckets; iterate the list, update or add. `int[]{key, value}` avoids a helper class.

```java
import java.util.*;

class MyHashMap {
    private static final int SIZE = 1009;
    private final LinkedList<int[]>[] buckets;

    @SuppressWarnings("unchecked")
    public MyHashMap() {
        buckets = new LinkedList[SIZE];
        for (int i = 0; i < SIZE; i++) buckets[i] = new LinkedList<>();
    }

    private LinkedList<int[]> bucket(int key) {
        return buckets[key % SIZE];
    }

    public void put(int key, int value) {
        LinkedList<int[]> b = bucket(key);
        for (int[] pair : b) {
            if (pair[0] == key) { pair[1] = value; return; }
        }
        b.add(new int[]{key, value});
    }

    public int get(int key) {
        for (int[] pair : bucket(key)) {
            if (pair[0] == key) return pair[1];
        }
        return -1;
    }

    public void remove(int key) {
        LinkedList<int[]> b = bucket(key);
        Iterator<int[]> it = b.iterator();
        while (it.hasNext()) {
            if (it.next()[0] == key) { it.remove(); return; }
        }
    }
}
```

#### Rust
A `Vec<Vec<(i32, i32)>>` of buckets; `iter_mut` to update in place, `retain`/`swap_remove` to delete without holding a second borrow.

```rust
struct MyHashMap {
    size: usize,
    buckets: Vec<Vec<(i32, i32)>>,
}

impl MyHashMap {
    fn new() -> Self {
        let size = 1009;
        MyHashMap { size, buckets: vec![Vec::new(); size] }
    }

    fn idx(&self, key: i32) -> usize {
        (key as usize) % self.size
    }

    fn put(&mut self, key: i32, value: i32) {
        let i = self.idx(key);
        for pair in self.buckets[i].iter_mut() {
            if pair.0 == key {
                pair.1 = value;
                return;
            }
        }
        self.buckets[i].push((key, value));
    }

    fn get(&self, key: i32) -> i32 {
        let i = self.idx(key);
        for &(k, v) in &self.buckets[i] {
            if k == key {
                return v;
            }
        }
        -1
    }

    fn remove(&mut self, key: i32) {
        let i = self.idx(key);
        self.buckets[i].retain(|&(k, _)| k != key);
    }
}
```

#### Go
A slice of `[][2]int` buckets; index by `key % size`, linear scan the chain, and `append(b[:i], b[i+1:]...)` to remove.

```go
type MyHashMap struct {
    size    int
    buckets [][][2]int
}

func Constructor() MyHashMap {
    size := 1009
    return MyHashMap{size: size, buckets: make([][][2]int, size)}
}

func (m *MyHashMap) Put(key int, value int) {
    i := key % m.size
    for j := range m.buckets[i] {
        if m.buckets[i][j][0] == key {
            m.buckets[i][j][1] = value
            return
        }
    }
    m.buckets[i] = append(m.buckets[i], [2]int{key, value})
}

func (m *MyHashMap) Get(key int) int {
    i := key % m.size
    for _, pair := range m.buckets[i] {
        if pair[0] == key {
            return pair[1]
        }
    }
    return -1
}

func (m *MyHashMap) Remove(key int) {
    i := key % m.size
    for j, pair := range m.buckets[i] {
        if pair[0] == key {
            m.buckets[i] = append(m.buckets[i][:j], m.buckets[i][j+1:]...)
            return
        }
    }
}
```

#### C++
A `vector<list<pair<int,int>>>`; `std::list::erase` with an iterator removes a node cleanly, and `pair` avoids a struct.

```cpp
#include <vector>
#include <list>
#include <utility>

class MyHashMap {
    static const int SIZE = 1009;
    std::vector<std::list<std::pair<int,int>>> buckets;

public:
    MyHashMap() : buckets(SIZE) {}

    void put(int key, int value) {
        auto &b = buckets[key % SIZE];
        for (auto &pr : b) {
            if (pr.first == key) { pr.second = value; return; }
        }
        b.emplace_back(key, value);
    }

    int get(int key) {
        auto &b = buckets[key % SIZE];
        for (auto &pr : b) {
            if (pr.first == key) return pr.second;
        }
        return -1;
    }

    void remove(int key) {
        auto &b = buckets[key % SIZE];
        for (auto it = b.begin(); it != b.end(); ++it) {
            if (it->first == key) { b.erase(it); return; }
        }
    }
};
```

### 21. Design HashSet

#### Problem
Design a `MyHashSet` without using any built-in hash-set library. Implement `add(key)` to insert a key, `remove(key)` to erase it, and `contains(key)` to return whether the key is present. Keys are non-negative integers. Target average O(1) per operation.

#### Pattern
**Bucket array with separate chaining.** **O(1)** average per operation (O(n/B) worst), **O(n + B)** space. Identical skeleton to a hash map, minus the value.

#### Explanation
A set is a map without payloads, so the machinery is the same: a fixed array of B buckets, each key routed to `key % B`, and a per-bucket chain that stores the keys hashing there. With B chosen large enough (a few thousand) chains stay short for LeetCode-scale inputs, so no resizing is needed and every operation is O(1) on average.

`add` scans the bucket and appends only if the key is absent (the set invariant: no duplicates in a bucket). `contains` scans the bucket for the key. `remove` unlinks it if found. Since there is no value to update, `add` becomes a membership check plus a conditional append. The bit-set alternative — a boolean array indexed directly by the key — is even faster when the key range is small and known, but chaining is the general answer that survives an unbounded key domain.

#### Python
List of lists of ints; `if key not in bucket` guards the insert, and `bucket.remove(key)` deletes by value.

```python
class MyHashSet:
    def __init__(self):
        self.size = 1009
        self.buckets = [[] for _ in range(self.size)]

    def _bucket(self, key: int):
        return self.buckets[key % self.size]

    def add(self, key: int) -> None:
        b = self._bucket(key)
        if key not in b:
            b.append(key)

    def remove(self, key: int) -> None:
        b = self._bucket(key)
        if key in b:
            b.remove(key)

    def contains(self, key: int) -> bool:
        return key in self._bucket(key)
```

#### Java
Array of `LinkedList<Integer>`; `contains` on the list guards inserts, and `remove(Integer.valueOf(key))` deletes by value (not index).

```java
import java.util.*;

class MyHashSet {
    private static final int SIZE = 1009;
    private final LinkedList<Integer>[] buckets;

    @SuppressWarnings("unchecked")
    public MyHashSet() {
        buckets = new LinkedList[SIZE];
        for (int i = 0; i < SIZE; i++) buckets[i] = new LinkedList<>();
    }

    private LinkedList<Integer> bucket(int key) {
        return buckets[key % SIZE];
    }

    public void add(int key) {
        LinkedList<Integer> b = bucket(key);
        if (!b.contains(key)) b.add(key);
    }

    public void remove(int key) {
        bucket(key).remove(Integer.valueOf(key));
    }

    public boolean contains(int key) {
        return bucket(key).contains(key);
    }
}
```

#### Rust
`Vec<Vec<i32>>` of buckets; `contains` guards the push and `retain` deletes, avoiding any manual index shuffling.

```rust
struct MyHashSet {
    size: usize,
    buckets: Vec<Vec<i32>>,
}

impl MyHashSet {
    fn new() -> Self {
        let size = 1009;
        MyHashSet { size, buckets: vec![Vec::new(); size] }
    }

    fn idx(&self, key: i32) -> usize {
        (key as usize) % self.size
    }

    fn add(&mut self, key: i32) {
        let i = self.idx(key);
        if !self.buckets[i].contains(&key) {
            self.buckets[i].push(key);
        }
    }

    fn remove(&mut self, key: i32) {
        let i = self.idx(key);
        self.buckets[i].retain(|&k| k != key);
    }

    fn contains(&self, key: i32) -> bool {
        let i = self.idx(key);
        self.buckets[i].contains(&key)
    }
}
```

#### Go
Slice of `[]int` buckets; linear membership scan, and `append(b[:i], b[i+1:]...)` to remove the matched key.

```go
type MyHashSet struct {
    size    int
    buckets [][]int
}

func Constructor() MyHashSet {
    size := 1009
    return MyHashSet{size: size, buckets: make([][]int, size)}
}

func (s *MyHashSet) Add(key int) {
    i := key % s.size
    for _, k := range s.buckets[i] {
        if k == key {
            return
        }
    }
    s.buckets[i] = append(s.buckets[i], key)
}

func (s *MyHashSet) Remove(key int) {
    i := key % s.size
    for j, k := range s.buckets[i] {
        if k == key {
            s.buckets[i] = append(s.buckets[i][:j], s.buckets[i][j+1:]...)
            return
        }
    }
}

func (s *MyHashSet) Contains(key int) bool {
    i := key % s.size
    for _, k := range s.buckets[i] {
        if k == key {
            return true
        }
    }
    return false
}
```

#### C++
`vector<list<int>>`; `std::find` for membership and `list::remove` to erase by value in one call.

```cpp
#include <vector>
#include <list>
#include <algorithm>

class MyHashSet {
    static const int SIZE = 1009;
    std::vector<std::list<int>> buckets;

public:
    MyHashSet() : buckets(SIZE) {}

    void add(int key) {
        auto &b = buckets[key % SIZE];
        if (std::find(b.begin(), b.end(), key) == b.end()) {
            b.push_back(key);
        }
    }

    void remove(int key) {
        buckets[key % SIZE].remove(key);
    }

    bool contains(int key) {
        auto &b = buckets[key % SIZE];
        return std::find(b.begin(), b.end(), key) != b.end();
    }
};
```

### 22. Insert Delete GetRandom O(1)

#### Problem
Design a `RandomizedSet` supporting `insert(val)` (returns true if `val` was not already present), `remove(val)` (returns true if `val` was present), and `getRandom()` (returns a uniformly random current element). Every operation must run in average O(1) time.

#### Pattern
**Dynamic array + hash map from value to index.** **O(1)** average per operation, **O(n)** space. The map gives O(1) lookup; swap-with-last gives O(1) removal from the array.

#### Explanation
`getRandom` demands O(1) uniform sampling, which a plain hash set cannot do (you cannot index into it). So we keep the elements in a contiguous array and pick a random index. The problem is that removing an arbitrary element from the middle of an array is O(n) because of the shift. The trick: to delete a value, look up its index via the map, swap that element with the last element of the array, fix the moved element's index in the map, then pop the last slot. Removal from the end is O(1) and order does not matter for a set.

The two structures are kept in lockstep: the array holds the values, and the map holds `value -> its index in the array`. `insert` appends and records the index. `remove` does the swap-pop dance and updates the map for the relocated element. The one edge case that bites people is removing the last element (or the only element): the swap is with itself, so update the map before popping, or guard the index-fix so you don't write a stale index back for an element you are about to erase.

#### Python
`random.choice` over the backing list plus a `dict` from value to index; swap-with-last then `pop` for O(1) delete.

```python
import random

class RandomizedSet:
    def __init__(self):
        self.vals = []
        self.idx = {}

    def insert(self, val: int) -> bool:
        if val in self.idx:
            return False
        self.idx[val] = len(self.vals)
        self.vals.append(val)
        return True

    def remove(self, val: int) -> bool:
        if val not in self.idx:
            return False
        i = self.idx[val]
        last = self.vals[-1]
        self.vals[i] = last
        self.idx[last] = i
        self.vals.pop()
        del self.idx[val]
        return True

    def getRandom(self) -> int:
        return random.choice(self.vals)
```

#### Java
`ArrayList<Integer>` for values, `HashMap<Integer,Integer>` for value-to-index, and a `Random` for sampling.

```java
import java.util.*;

class RandomizedSet {
    private final List<Integer> vals = new ArrayList<>();
    private final Map<Integer, Integer> idx = new HashMap<>();
    private final Random rng = new Random();

    public RandomizedSet() {}

    public boolean insert(int val) {
        if (idx.containsKey(val)) return false;
        idx.put(val, vals.size());
        vals.add(val);
        return true;
    }

    public boolean remove(int val) {
        Integer i = idx.get(val);
        if (i == null) return false;
        int last = vals.get(vals.size() - 1);
        vals.set(i, last);
        idx.put(last, i);
        vals.remove(vals.size() - 1);
        idx.remove(val);
        return true;
    }

    public int getRandom() {
        return vals.get(rng.nextInt(vals.size()));
    }
}
```

#### Rust
`Vec<i32>` + `HashMap<i32, usize>`; a small linear-congruential state avoids pulling in the `rand` crate while staying stdlib-only.

```rust
use std::collections::HashMap;

struct RandomizedSet {
    vals: Vec<i32>,
    idx: HashMap<i32, usize>,
    seed: u64,
}

impl RandomizedSet {
    fn new() -> Self {
        RandomizedSet { vals: Vec::new(), idx: HashMap::new(), seed: 0x2545F4914F6CDD1D }
    }

    fn next_rand(&mut self) -> usize {
        // xorshift64 for stdlib-only pseudo-randomness
        let mut x = self.seed;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.seed = x;
        x as usize
    }

    fn insert(&mut self, val: i32) -> bool {
        if self.idx.contains_key(&val) {
            return false;
        }
        self.idx.insert(val, self.vals.len());
        self.vals.push(val);
        true
    }

    fn remove(&mut self, val: i32) -> bool {
        if let Some(&i) = self.idx.get(&val) {
            let last = *self.vals.last().unwrap();
            self.vals[i] = last;
            self.idx.insert(last, i);
            self.vals.pop();
            self.idx.remove(&val);
            true
        } else {
            false
        }
    }

    fn get_random(&mut self) -> i32 {
        let n = self.vals.len();
        let r = self.next_rand() % n;
        self.vals[r]
    }
}
```

#### Go
`[]int` slice + `map[int]int`; `math/rand` for sampling, and swap-with-last then reslice for O(1) delete.

```go
import "math/rand"

type RandomizedSet struct {
    vals []int
    idx  map[int]int
}

func Constructor() RandomizedSet {
    return RandomizedSet{vals: []int{}, idx: map[int]int{}}
}

func (s *RandomizedSet) Insert(val int) bool {
    if _, ok := s.idx[val]; ok {
        return false
    }
    s.idx[val] = len(s.vals)
    s.vals = append(s.vals, val)
    return true
}

func (s *RandomizedSet) Remove(val int) bool {
    i, ok := s.idx[val]
    if !ok {
        return false
    }
    last := s.vals[len(s.vals)-1]
    s.vals[i] = last
    s.idx[last] = i
    s.vals = s.vals[:len(s.vals)-1]
    delete(s.idx, val)
    return true
}

func (s *RandomizedSet) GetRandom() int {
    return s.vals[rand.Intn(len(s.vals))]
}
```

#### C++
`vector<int>` + `unordered_map<int,int>`; `rand()` for sampling, swap-with-`back()` then `pop_back()` for O(1) erase.

```cpp
#include <vector>
#include <unordered_map>
#include <cstdlib>

class RandomizedSet {
    std::vector<int> vals;
    std::unordered_map<int, int> idx;

public:
    RandomizedSet() {}

    bool insert(int val) {
        if (idx.count(val)) return false;
        idx[val] = vals.size();
        vals.push_back(val);
        return true;
    }

    bool remove(int val) {
        auto it = idx.find(val);
        if (it == idx.end()) return false;
        int i = it->second;
        int last = vals.back();
        vals[i] = last;
        idx[last] = i;
        vals.pop_back();
        idx.erase(it);
        return true;
    }

    int getRandom() {
        return vals[std::rand() % vals.size()];
    }
};
```

### 23. Insert Delete GetRandom O(1) - Duplicates allowed

#### Problem
Design a `RandomizedCollection` (a multiset) supporting `insert(val)` (always inserts; returns true if `val` was not already present), `remove(val)` (removes one occurrence; returns true if `val` was present), and `getRandom()` (returns an element with probability proportional to its multiplicity). Every operation must run in average O(1) time.

#### Pattern
**Dynamic array + hash map from value to a set of indices.** **O(1)** average per operation, **O(n)** space. The set-of-indices upgrade is what makes swap-pop work when duplicates share a value.

#### Explanation
This is the duplicates-allowed cousin of RandomizedSet, and the probabilistic requirement means `getRandom` must still just pick a uniformly random array slot — since a value occupying k slots is naturally returned with probability k/n. The array stores every occurrence. The map now points each value to a *set* of the array indices where it currently lives, because a value can appear many times.

`insert` appends and adds the new index to that value's set. `remove` picks any one index from the value's set (say `i`), then does the swap-pop: move the last array element into slot `i`, update that moved value's index set (remove old-last-index, add `i`), remove `i` (or the old last index) from the target value's set, and pop the array. The nasty edge case is when the element being removed *is* the last element, or when `i` equals the last index: you must delete the stale last-index from the moved value's set and add the new one in the right order, or you corrupt the index bookkeeping. Using a hash set of indices (not a list) keeps every add/discard O(1).

#### Python
`dict` mapping value to a `set` of indices; `next(iter(...))` grabs an arbitrary occurrence, and careful set updates handle the swap-with-last.

```python
import random

class RandomizedCollection:
    def __init__(self):
        self.vals = []
        self.idx = {}

    def insert(self, val: int) -> bool:
        present = val in self.idx and len(self.idx[val]) > 0
        self.idx.setdefault(val, set()).add(len(self.vals))
        self.vals.append(val)
        return not present

    def remove(self, val: int) -> bool:
        if not self.idx.get(val):
            return False
        i = next(iter(self.idx[val]))
        self.idx[val].discard(i)
        last = self.vals[-1]
        last_i = len(self.vals) - 1
        self.vals[i] = last
        self.idx[last].discard(last_i)
        if i != last_i:
            self.idx[last].add(i)
        self.vals.pop()
        return True

    def getRandom(self) -> int:
        return random.choice(self.vals)
```

#### Java
`ArrayList<Integer>` plus `HashMap<Integer, Set<Integer>>`; a `LinkedHashSet` per value gives O(1) add/remove and a cheap "any element" via its iterator.

```java
import java.util.*;

class RandomizedCollection {
    private final List<Integer> vals = new ArrayList<>();
    private final Map<Integer, Set<Integer>> idx = new HashMap<>();
    private final Random rng = new Random();

    public RandomizedCollection() {}

    public boolean insert(int val) {
        Set<Integer> s = idx.computeIfAbsent(val, k -> new LinkedHashSet<>());
        boolean absent = s.isEmpty();
        s.add(vals.size());
        vals.add(val);
        return absent;
    }

    public boolean remove(int val) {
        Set<Integer> s = idx.get(val);
        if (s == null || s.isEmpty()) return false;
        int i = s.iterator().next();
        s.remove(i);
        int lastI = vals.size() - 1;
        int last = vals.get(lastI);
        vals.set(i, last);
        idx.get(last).remove(lastI);
        if (i != lastI) idx.get(last).add(i);
        vals.remove(lastI);
        return true;
    }

    public int getRandom() {
        return vals.get(rng.nextInt(vals.size()));
    }
}
```

#### Rust
`Vec<i32>` + `HashMap<i32, HashSet<usize>>`; `iter().next().copied()` pulls any occurrence, and a stdlib xorshift avoids the `rand` crate.

```rust
use std::collections::{HashMap, HashSet};

struct RandomizedCollection {
    vals: Vec<i32>,
    idx: HashMap<i32, HashSet<usize>>,
    seed: u64,
}

impl RandomizedCollection {
    fn new() -> Self {
        RandomizedCollection {
            vals: Vec::new(),
            idx: HashMap::new(),
            seed: 0x9E3779B97F4A7C15,
        }
    }

    fn next_rand(&mut self) -> usize {
        let mut x = self.seed;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.seed = x;
        x as usize
    }

    fn insert(&mut self, val: i32) -> bool {
        let set = self.idx.entry(val).or_default();
        let absent = set.is_empty();
        set.insert(self.vals.len());
        self.vals.push(val);
        absent
    }

    fn remove(&mut self, val: i32) -> bool {
        let i = match self.idx.get(&val).and_then(|s| s.iter().next().copied()) {
            Some(i) => i,
            None => return false,
        };
        self.idx.get_mut(&val).unwrap().remove(&i);
        let last_i = self.vals.len() - 1;
        let last = self.vals[last_i];
        self.vals[i] = last;
        let ls = self.idx.get_mut(&last).unwrap();
        ls.remove(&last_i);
        if i != last_i {
            ls.insert(i);
        }
        self.vals.pop();
        true
    }

    fn get_random(&mut self) -> i32 {
        let n = self.vals.len();
        let r = self.next_rand() % n;
        self.vals[r]
    }
}
```

#### Go
`[]int` + `map[int]map[int]struct{}` (a set of indices); grab any index by ranging one step, then swap-pop with the index bookkeeping.

```go
import "math/rand"

type RandomizedCollection struct {
    vals []int
    idx  map[int]map[int]struct{}
}

func Constructor() RandomizedCollection {
    return RandomizedCollection{vals: []int{}, idx: map[int]map[int]struct{}{}}
}

func (c *RandomizedCollection) Insert(val int) bool {
    if c.idx[val] == nil {
        c.idx[val] = map[int]struct{}{}
    }
    absent := len(c.idx[val]) == 0
    c.idx[val][len(c.vals)] = struct{}{}
    c.vals = append(c.vals, val)
    return absent
}

func (c *RandomizedCollection) Remove(val int) bool {
    if len(c.idx[val]) == 0 {
        return false
    }
    var i int
    for k := range c.idx[val] {
        i = k
        break
    }
    delete(c.idx[val], i)
    lastI := len(c.vals) - 1
    last := c.vals[lastI]
    c.vals[i] = last
    delete(c.idx[last], lastI)
    if i != lastI {
        c.idx[last][i] = struct{}{}
    }
    c.vals = c.vals[:lastI]
    return true
}

func (c *RandomizedCollection) GetRandom() int {
    return c.vals[rand.Intn(len(c.vals))]
}
```

#### C++
`vector<int>` + `unordered_map<int, unordered_set<int>>`; `*begin()` of the set yields any occurrence, then swap-with-`back()` and fix the moved value's index set.

```cpp
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <cstdlib>

class RandomizedCollection {
    std::vector<int> vals;
    std::unordered_map<int, std::unordered_set<int>> idx;

public:
    RandomizedCollection() {}

    bool insert(int val) {
        bool absent = idx[val].empty();
        idx[val].insert(vals.size());
        vals.push_back(val);
        return absent;
    }

    bool remove(int val) {
        auto it = idx.find(val);
        if (it == idx.end() || it->second.empty()) return false;
        int i = *it->second.begin();
        it->second.erase(i);
        int lastI = vals.size() - 1;
        int last = vals[lastI];
        vals[i] = last;
        idx[last].erase(lastI);
        if (i != lastI) idx[last].insert(i);
        vals.pop_back();
        return true;
    }

    int getRandom() {
        return vals[std::rand() % vals.size()];
    }
};
```

### 24. All O(1) Data Structure

#### Problem
Design an `AllOne` structure that tracks string keys and their positive integer counts. Implement `inc(key)` (increment the key's count, inserting it at 1 if new), `dec(key)` (decrement the key's count, removing it when it hits 0; the key is guaranteed to exist), `getMaxKey()` (return any key with the maximum count, or `""` if empty), and `getMinKey()` (return any key with the minimum count, or `""` if empty). Every operation must run in O(1) time.

#### Pattern
**Doubly linked list of count-buckets + hash map from key to its bucket node.** **O(1)** per operation, **O(n)** space. Buckets are kept in sorted count order so min/max are the two ends.

#### Explanation
The hard requirement is O(1) `getMax`/`getMin` alongside O(1) `inc`/`dec`. A heap gives O(log n) updates, so it is out. The winning structure is a doubly linked list of buckets, where each bucket holds a count value and the *set of keys* that currently have exactly that count. The list is maintained in strictly increasing count order, so the head bucket is the minimum count and the tail bucket is the maximum — both readable in O(1).

A hash map from key to the bucket node holding it makes every update local. `inc(key)`: find the key's current bucket (count c), and it must move to the bucket for c+1. If the next bucket in the list already has count c+1, move the key there; otherwise splice a fresh bucket in between. Remove the key from the old bucket, and if that bucket is now empty, unlink it. `dec` is the mirror image toward c-1 (deleting the key entirely if it would reach 0). Every step is a constant number of linked-list splices and set operations, so it is genuinely O(1). The two edge cases: an emptied bucket must be unlinked so min/max stay correct, and the c+1 / c-1 target bucket may or may not already exist, so check the neighbor before inserting.

#### Python
Sentinel-guarded doubly linked list of `Bucket(count, keys:set)` nodes; a `dict` maps key to its node so inc/dec are local splices.

```python
class Bucket:
    def __init__(self, count):
        self.count = count
        self.keys = set()
        self.prev = None
        self.next = None

class AllOne:
    def __init__(self):
        self.head = Bucket(float("-inf"))
        self.tail = Bucket(float("inf"))
        self.head.next = self.tail
        self.tail.prev = self.head
        self.key_bucket = {}

    def _insert_after(self, node, count):
        b = Bucket(count)
        b.prev = node
        b.next = node.next
        node.next.prev = b
        node.next = b
        return b

    def _remove(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def inc(self, key: str) -> None:
        if key in self.key_bucket:
            cur = self.key_bucket[key]
            nxt = cur.next
            if nxt.count != cur.count + 1:
                nxt = self._insert_after(cur, cur.count + 1)
            nxt.keys.add(key)
            self.key_bucket[key] = nxt
            cur.keys.discard(key)
            if not cur.keys:
                self._remove(cur)
        else:
            first = self.head.next
            if first.count != 1:
                first = self._insert_after(self.head, 1)
            first.keys.add(key)
            self.key_bucket[key] = first

    def dec(self, key: str) -> None:
        cur = self.key_bucket[key]
        if cur.count == 1:
            del self.key_bucket[key]
        else:
            prev = cur.prev
            if prev.count != cur.count - 1:
                prev = self._insert_after(cur.prev, cur.count - 1)
            prev.keys.add(key)
            self.key_bucket[key] = prev
        cur.keys.discard(key)
        if not cur.keys:
            self._remove(cur)

    def getMaxKey(self) -> str:
        if self.tail.prev is self.head:
            return ""
        return next(iter(self.tail.prev.keys))

    def getMinKey(self) -> str:
        if self.head.next is self.tail:
            return ""
        return next(iter(self.head.next.keys))
```

#### Java
A hand-rolled doubly linked list of `Bucket` nodes (each with a `LinkedHashSet<String>`) plus a `HashMap<String,Bucket>`; sentinel head/tail simplify splicing.

```java
import java.util.*;

class AllOne {
    private static class Bucket {
        int count;
        Set<String> keys = new LinkedHashSet<>();
        Bucket prev, next;
        Bucket(int count) { this.count = count; }
    }

    private final Bucket head = new Bucket(Integer.MIN_VALUE);
    private final Bucket tail = new Bucket(Integer.MAX_VALUE);
    private final Map<String, Bucket> keyBucket = new HashMap<>();

    public AllOne() {
        head.next = tail;
        tail.prev = head;
    }

    private Bucket insertAfter(Bucket node, int count) {
        Bucket b = new Bucket(count);
        b.prev = node;
        b.next = node.next;
        node.next.prev = b;
        node.next = b;
        return b;
    }

    private void remove(Bucket node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    public void inc(String key) {
        if (keyBucket.containsKey(key)) {
            Bucket cur = keyBucket.get(key);
            Bucket nxt = cur.next;
            if (nxt.count != cur.count + 1) nxt = insertAfter(cur, cur.count + 1);
            nxt.keys.add(key);
            keyBucket.put(key, nxt);
            cur.keys.remove(key);
            if (cur.keys.isEmpty()) remove(cur);
        } else {
            Bucket first = head.next;
            if (first.count != 1) first = insertAfter(head, 1);
            first.keys.add(key);
            keyBucket.put(key, first);
        }
    }

    public void dec(String key) {
        Bucket cur = keyBucket.get(key);
        if (cur.count == 1) {
            keyBucket.remove(key);
        } else {
            Bucket prev = cur.prev;
            if (prev.count != cur.count - 1) prev = insertAfter(cur.prev, cur.count - 1);
            prev.keys.add(key);
            keyBucket.put(key, prev);
        }
        cur.keys.remove(key);
        if (cur.keys.isEmpty()) remove(cur);
    }

    public String getMaxKey() {
        return tail.prev == head ? "" : tail.prev.keys.iterator().next();
    }

    public String getMinKey() {
        return head.next == tail ? "" : head.next.keys.iterator().next();
    }
}
```

#### Rust
Index-based doubly linked list over a `Vec<Bucket>` with a free-list — this sidesteps `Rc<RefCell<>>` borrow gymnastics while keeping O(1) splices; a `HashMap<String, usize>` maps key to bucket index.

```rust
use std::collections::{HashMap, HashSet};

struct Bucket {
    count: i64,
    keys: HashSet<String>,
    prev: usize,
    next: usize,
    alive: bool,
}

struct AllOne {
    buckets: Vec<Bucket>,
    free: Vec<usize>,
    head: usize,
    tail: usize,
    key_bucket: HashMap<String, usize>,
}

impl AllOne {
    fn new() -> Self {
        let head = Bucket { count: i64::MIN, keys: HashSet::new(), prev: 0, next: 1, alive: true };
        let tail = Bucket { count: i64::MAX, keys: HashSet::new(), prev: 0, next: 1, alive: true };
        AllOne {
            buckets: vec![head, tail],
            free: Vec::new(),
            head: 0,
            tail: 1,
            key_bucket: HashMap::new(),
        }
    }

    fn alloc(&mut self, count: i64) -> usize {
        if let Some(i) = self.free.pop() {
            self.buckets[i] = Bucket { count, keys: HashSet::new(), prev: 0, next: 0, alive: true };
            i
        } else {
            self.buckets.push(Bucket { count, keys: HashSet::new(), prev: 0, next: 0, alive: true });
            self.buckets.len() - 1
        }
    }

    fn insert_after(&mut self, node: usize, count: i64) -> usize {
        let b = self.alloc(count);
        let nn = self.buckets[node].next;
        self.buckets[b].prev = node;
        self.buckets[b].next = nn;
        self.buckets[nn].prev = b;
        self.buckets[node].next = b;
        b
    }

    fn remove(&mut self, node: usize) {
        let p = self.buckets[node].prev;
        let n = self.buckets[node].next;
        self.buckets[p].next = n;
        self.buckets[n].prev = p;
        self.buckets[node].alive = false;
        self.free.push(node);
    }

    fn inc(&mut self, key: String) {
        if let Some(&cur) = self.key_bucket.get(&key) {
            let c = self.buckets[cur].count;
            let mut nxt = self.buckets[cur].next;
            if self.buckets[nxt].count != c + 1 {
                nxt = self.insert_after(cur, c + 1);
            }
            self.buckets[nxt].keys.insert(key.clone());
            self.key_bucket.insert(key.clone(), nxt);
            self.buckets[cur].keys.remove(&key);
            if self.buckets[cur].keys.is_empty() {
                self.remove(cur);
            }
        } else {
            let mut first = self.buckets[self.head].next;
            if self.buckets[first].count != 1 {
                first = self.insert_after(self.head, 1);
            }
            self.buckets[first].keys.insert(key.clone());
            self.key_bucket.insert(key, first);
        }
    }

    fn dec(&mut self, key: String) {
        let cur = self.key_bucket[&key];
        let c = self.buckets[cur].count;
        if c == 1 {
            self.key_bucket.remove(&key);
        } else {
            let prev_node = self.buckets[cur].prev;
            let mut prev = prev_node;
            if self.buckets[prev].count != c - 1 {
                prev = self.insert_after(prev_node, c - 1);
            }
            self.buckets[prev].keys.insert(key.clone());
            self.key_bucket.insert(key.clone(), prev);
        }
        self.buckets[cur].keys.remove(&key);
        if self.buckets[cur].keys.is_empty() {
            self.remove(cur);
        }
    }

    fn get_max_key(&self) -> String {
        let last = self.buckets[self.tail].prev;
        if last == self.head {
            return String::new();
        }
        self.buckets[last].keys.iter().next().cloned().unwrap_or_default()
    }

    fn get_min_key(&self) -> String {
        let first = self.buckets[self.head].next;
        if first == self.tail {
            return String::new();
        }
        self.buckets[first].keys.iter().next().cloned().unwrap_or_default()
    }
}
```

#### Go
`container/list` supplies the doubly linked list; each element carries a `*bucket{count, keys map[string]struct{}}`, and a `map[string]*list.Element` maps key to node for O(1) splices.

```go
import "container/list"

type bucket struct {
    count int
    keys  map[string]struct{}
}

type AllOne struct {
    l   *list.List
    m   map[string]*list.Element
}

func Constructor() AllOne {
    return AllOne{l: list.New(), m: map[string]*list.Element{}}
}

func newBucket(count int) *bucket {
    return &bucket{count: count, keys: map[string]struct{}{}}
}

func anyKey(b *bucket) string {
    for k := range b.keys {
        return k
    }
    return ""
}

func (a *AllOne) Inc(key string) {
    if e, ok := a.m[key]; ok {
        cur := e.Value.(*bucket)
        var nxtE *list.Element
        if e.Next() != nil && e.Next().Value.(*bucket).count == cur.count+1 {
            nxtE = e.Next()
        } else {
            nxtE = a.l.InsertAfter(newBucket(cur.count+1), e)
        }
        nxtE.Value.(*bucket).keys[key] = struct{}{}
        a.m[key] = nxtE
        delete(cur.keys, key)
        if len(cur.keys) == 0 {
            a.l.Remove(e)
        }
    } else {
        var firstE *list.Element
        if a.l.Front() != nil && a.l.Front().Value.(*bucket).count == 1 {
            firstE = a.l.Front()
        } else {
            firstE = a.l.PushFront(newBucket(1))
        }
        firstE.Value.(*bucket).keys[key] = struct{}{}
        a.m[key] = firstE
    }
}

func (a *AllOne) Dec(key string) {
    e := a.m[key]
    cur := e.Value.(*bucket)
    if cur.count == 1 {
        delete(a.m, key)
    } else {
        var prevE *list.Element
        if e.Prev() != nil && e.Prev().Value.(*bucket).count == cur.count-1 {
            prevE = e.Prev()
        } else {
            prevE = a.l.InsertBefore(newBucket(cur.count-1), e)
        }
        prevE.Value.(*bucket).keys[key] = struct{}{}
        a.m[key] = prevE
    }
    delete(cur.keys, key)
    if len(cur.keys) == 0 {
        a.l.Remove(e)
    }
}

func (a *AllOne) GetMaxKey() string {
    if a.l.Back() == nil {
        return ""
    }
    return anyKey(a.l.Back().Value.(*bucket))
}

func (a *AllOne) GetMinKey() string {
    if a.l.Front() == nil {
        return ""
    }
    return anyKey(a.l.Front().Value.(*bucket))
}
```

#### C++
`std::list<Bucket>` for the ordered buckets (each with an `unordered_set<string>`), and `unordered_map<string, list<Bucket>::iterator>` mapping key to its node; list iterators stay valid across splices.

```cpp
#include <list>
#include <string>
#include <unordered_map>
#include <unordered_set>

class AllOne {
    struct Bucket {
        int count;
        std::unordered_set<std::string> keys;
        Bucket(int c) : count(c) {}
    };

    std::list<Bucket> buckets;
    std::unordered_map<std::string, std::list<Bucket>::iterator> keyBucket;

public:
    AllOne() {}

    void inc(std::string key) {
        auto it = keyBucket.find(key);
        if (it != keyBucket.end()) {
            auto cur = it->second;
            auto nxt = std::next(cur);
            if (nxt == buckets.end() || nxt->count != cur->count + 1) {
                nxt = buckets.insert(nxt, Bucket(cur->count + 1));
            }
            nxt->keys.insert(key);
            keyBucket[key] = nxt;
            cur->keys.erase(key);
            if (cur->keys.empty()) buckets.erase(cur);
        } else {
            auto first = buckets.begin();
            if (first == buckets.end() || first->count != 1) {
                first = buckets.insert(buckets.begin(), Bucket(1));
            }
            first->keys.insert(key);
            keyBucket[key] = first;
        }
    }

    void dec(std::string key) {
        auto cur = keyBucket[key];
        if (cur->count == 1) {
            keyBucket.erase(key);
        } else {
            auto prev = (cur == buckets.begin()) ? buckets.end() : std::prev(cur);
            if (prev == buckets.end() || prev->count != cur->count - 1) {
                prev = buckets.insert(cur, Bucket(cur->count - 1));
            }
            prev->keys.insert(key);
            keyBucket[key] = prev;
        }
        cur->keys.erase(key);
        if (cur->keys.empty()) buckets.erase(cur);
    }

    std::string getMaxKey() {
        if (buckets.empty()) return "";
        return *buckets.back().keys.begin();
    }

    std::string getMinKey() {
        if (buckets.empty()) return "";
        return *buckets.front().keys.begin();
    }
};
```

### 25. Design a Number Container System

#### Problem
Implement `NumberContainers` supporting `change(index, number)` which assigns `number` to `index` (overwriting any prior assignment), and `find(number)` which returns the smallest index currently holding `number`, or `-1` if none. The challenge is keeping `find` fast under repeated reassignment, so a plain scan is too slow.

#### Pattern
**Two maps: index to number, plus number to an ordered/priority set of indices.** **O(log n)** per operation, **O(n)** space. The reverse index lets `find` return the minimum in one lookup.

#### Explanation
The core insight is a two-way mapping. `idxToNum` tells you what each index currently holds so you can undo a stale assignment; `numToIdx` maps each number to the set of indices holding it, kept in sorted order so `find` reads the minimum directly. On `change`, you first remove `index` from the set of its previous number (if any), then add it to the new number's set — this keeps every set exactly consistent with the forward map.

Where an ordered set is available (TreeSet, BTreeSet, std::set) `find` is a clean "first element" read. In languages without one in the standard library, a min-heap with lazy deletion works: push freely, and on `find` pop heap-top indices whose current number no longer matches before reading. The edge cases are removing the last index for a number (drop the empty set) and querying a number never assigned (return `-1`).

#### Python
Python's stdlib has no ordered set, so use a per-number min-heap with lazy deletion: `find` discards indices whose `idx_to_num` no longer matches the queried number before reading `heap[0]`.

```python
import heapq
from collections import defaultdict


class NumberContainers:
    def __init__(self):
        self.idx_to_num = {}
        self.heaps = defaultdict(list)

    def change(self, index: int, number: int) -> None:
        self.idx_to_num[index] = number
        heapq.heappush(self.heaps[number], index)

    def find(self, number: int) -> int:
        heap = self.heaps.get(number)
        if not heap:
            return -1
        while heap and self.idx_to_num.get(heap[0]) != number:
            heapq.heappop(heap)
        return heap[0] if heap else -1
```

#### Java
`TreeMap`/`TreeSet` give an ordered set with O(log n) `first()`, so eager removal keeps every set exact and `find` is a single `first()` call.

```java
import java.util.*;

class NumberContainers {
    private Map<Integer, Integer> idxToNum = new HashMap<>();
    private Map<Integer, TreeSet<Integer>> numToIdx = new HashMap<>();

    public NumberContainers() {}

    public void change(int index, int number) {
        Integer prev = idxToNum.get(index);
        if (prev != null) {
            TreeSet<Integer> set = numToIdx.get(prev);
            set.remove(index);
            if (set.isEmpty()) numToIdx.remove(prev);
        }
        idxToNum.put(index, number);
        numToIdx.computeIfAbsent(number, k -> new TreeSet<>()).add(index);
    }

    public int find(int number) {
        TreeSet<Integer> set = numToIdx.get(number);
        return (set == null || set.isEmpty()) ? -1 : set.first();
    }
}
```

#### Rust
`BTreeSet` is std's ordered set; `iter().next()` yields the minimum, and `entry(..).or_default()` lazily creates the per-number set.

```rust
use std::collections::{BTreeSet, HashMap};

struct NumberContainers {
    idx_to_num: HashMap<i32, i32>,
    num_to_idx: HashMap<i32, BTreeSet<i32>>,
}

impl NumberContainers {
    fn new() -> Self {
        Self {
            idx_to_num: HashMap::new(),
            num_to_idx: HashMap::new(),
        }
    }

    fn change(&mut self, index: i32, number: i32) {
        if let Some(&prev) = self.idx_to_num.get(&index) {
            if let Some(set) = self.num_to_idx.get_mut(&prev) {
                set.remove(&index);
                if set.is_empty() {
                    self.num_to_idx.remove(&prev);
                }
            }
        }
        self.idx_to_num.insert(index, number);
        self.num_to_idx.entry(number).or_default().insert(index);
    }

    fn find(&self, number: i32) -> i32 {
        self.num_to_idx
            .get(&number)
            .and_then(|s| s.iter().next().copied())
            .unwrap_or(-1)
    }
}
```

#### Go
Go's stdlib lacks an ordered set, so mirror the Python approach: a per-number min-heap via `container/heap` with lazy deletion driven by the `idxToNum` map.

```go
import "container/heap"

type IntHeap []int

func (h IntHeap) Len() int            { return len(h) }
func (h IntHeap) Less(i, j int) bool  { return h[i] < h[j] }
func (h IntHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *IntHeap) Push(x any)         { *h = append(*h, x.(int)) }
func (h *IntHeap) Pop() any {
    old := *h
    n := len(old)
    x := old[n-1]
    *h = old[:n-1]
    return x
}

type NumberContainers struct {
    idxToNum map[int]int
    heaps    map[int]*IntHeap
}

func Constructor() NumberContainers {
    return NumberContainers{idxToNum: map[int]int{}, heaps: map[int]*IntHeap{}}
}

func (nc *NumberContainers) Change(index int, number int) {
    nc.idxToNum[index] = number
    h, ok := nc.heaps[number]
    if !ok {
        h = &IntHeap{}
        nc.heaps[number] = h
    }
    heap.Push(h, index)
}

func (nc *NumberContainers) Find(number int) int {
    h, ok := nc.heaps[number]
    if !ok {
        return -1
    }
    for h.Len() > 0 && nc.idxToNum[(*h)[0]] != number {
        heap.Pop(h)
    }
    if h.Len() == 0 {
        return -1
    }
    return (*h)[0]
}
```

#### C++
`std::set` is an ordered (red-black) set, so `*begin()` is the minimum index and erase-on-reassign keeps it exact.

```cpp
#include <set>
#include <unordered_map>
using namespace std;

class NumberContainers {
    unordered_map<int, int> idxToNum;
    unordered_map<int, set<int>> numToIdx;

public:
    NumberContainers() {}

    void change(int index, int number) {
        auto it = idxToNum.find(index);
        if (it != idxToNum.end()) {
            auto& s = numToIdx[it->second];
            s.erase(index);
            if (s.empty()) numToIdx.erase(it->second);
        }
        idxToNum[index] = number;
        numToIdx[number].insert(index);
    }

    int find(int number) {
        auto it = numToIdx.find(number);
        if (it == numToIdx.end() || it->second.empty()) return -1;
        return *it->second.begin();
    }
};
```

### 26. Design Phone Directory

#### Problem
Implement `PhoneDirectory(maxNumbers)` managing numbers `0..maxNumbers-1`, all initially free. `get()` returns any free number and marks it used, or `-1` if none remain; `check(number)` returns whether `number` is currently free; `release(number)` recycles a used number back to the free pool. All three should run in O(1).

#### Pattern
**A pool of free slots (queue or stack) plus an availability array/set.** **O(1)** per operation, **O(n)** space. The pool hands out numbers; the flag array answers `check` and guards double-release.

#### Explanation
Two structures cooperate. A FIFO/LIFO container holds the currently-free numbers so `get` is a single pop, and a boolean array (indexed by number) records availability so `check` is a direct read. `get` pops from the pool and flips the flag to used; `release` flips back to free and pushes into the pool, but only if the number was actually used — the availability check prevents a double `release` from inserting the same number twice, which would let `get` hand it out to two callers.

Initialization seeds both structures with every number. Whether the pool is a queue or a stack does not matter for correctness (either yields "any free number"); a queue tends to cycle numbers, a stack reuses the most recently freed. The only real edge case is `get` on an exhausted pool, which returns `-1`.

#### Python
A `deque` is the free pool (`popleft` for O(1) dequeue) and a `set` tracks availability, making `release` idempotent via a membership guard.

```python
from collections import deque


class PhoneDirectory:
    def __init__(self, maxNumbers: int):
        self.available = set(range(maxNumbers))
        self.free = deque(range(maxNumbers))

    def get(self) -> int:
        if not self.free:
            return -1
        num = self.free.popleft()
        self.available.discard(num)
        return num

    def check(self, number: int) -> bool:
        return number in self.available

    def release(self, number: int) -> None:
        if number not in self.available:
            self.available.add(number)
            self.free.append(number)
```

#### Java
`ArrayDeque` is the free queue (never the legacy `Stack`), backed by a `boolean[]` for O(1) `check` and double-release protection.

```java
import java.util.*;

class PhoneDirectory {
    private boolean[] available;
    private Queue<Integer> free;

    public PhoneDirectory(int maxNumbers) {
        available = new boolean[maxNumbers];
        free = new ArrayDeque<>();
        for (int i = 0; i < maxNumbers; i++) {
            available[i] = true;
            free.offer(i);
        }
    }

    public int get() {
        if (free.isEmpty()) return -1;
        int num = free.poll();
        available[num] = false;
        return num;
    }

    public boolean check(int number) {
        return available[number];
    }

    public void release(int number) {
        if (!available[number]) {
            available[number] = true;
            free.offer(number);
        }
    }
}
```

#### Rust
`VecDeque` collected from a range seeds the pool in one line; a `Vec<bool>` gives O(1) availability, and `pop_front` returns an `Option` handled with `match`.

```rust
use std::collections::VecDeque;

struct PhoneDirectory {
    available: Vec<bool>,
    free: VecDeque<i32>,
}

impl PhoneDirectory {
    fn new(max_numbers: i32) -> Self {
        Self {
            available: vec![true; max_numbers as usize],
            free: (0..max_numbers).collect(),
        }
    }

    fn get(&mut self) -> i32 {
        match self.free.pop_front() {
            Some(num) => {
                self.available[num as usize] = false;
                num
            }
            None => -1,
        }
    }

    fn check(&self, number: i32) -> bool {
        self.available[number as usize]
    }

    fn release(&mut self, number: i32) {
        let i = number as usize;
        if !self.available[i] {
            self.available[i] = true;
            self.free.push_back(number);
        }
    }
}
```

#### Go
A plain slice used as a stack (append / slice-off the tail) is the free pool, paired with a `[]bool` for O(1) checks.

```go
type PhoneDirectory struct {
    available []bool
    free      []int
}

func Constructor(maxNumbers int) PhoneDirectory {
    avail := make([]bool, maxNumbers)
    free := make([]int, maxNumbers)
    for i := 0; i < maxNumbers; i++ {
        avail[i] = true
        free[i] = i
    }
    return PhoneDirectory{available: avail, free: free}
}

func (d *PhoneDirectory) Get() int {
    if len(d.free) == 0 {
        return -1
    }
    num := d.free[len(d.free)-1]
    d.free = d.free[:len(d.free)-1]
    d.available[num] = false
    return num
}

func (d *PhoneDirectory) Check(number int) bool {
    return d.available[number]
}

func (d *PhoneDirectory) Release(number int) {
    if !d.available[number] {
        d.available[number] = true
        d.free = append(d.free, number)
    }
}
```

#### C++
`std::queue` is the free pool and `vector<bool>` the availability bitmap; the guard in `release` keeps it idempotent.

```cpp
#include <queue>
#include <vector>
using namespace std;

class PhoneDirectory {
    vector<bool> available;
    queue<int> freeNums;

public:
    PhoneDirectory(int maxNumbers) : available(maxNumbers, true) {
        for (int i = 0; i < maxNumbers; i++) freeNums.push(i);
    }

    int get() {
        if (freeNums.empty()) return -1;
        int num = freeNums.front();
        freeNums.pop();
        available[num] = false;
        return num;
    }

    bool check(int number) {
        return available[number];
    }

    void release(int number) {
        if (!available[number]) {
            available[number] = true;
            freeNums.push(number);
        }
    }
};
```

### 27. Snapshot Array

#### Problem
Implement `SnapshotArray(length)` — an array of `length` cells all initialized to 0. `set(index, val)` updates a cell; `snap()` takes a snapshot and returns its id (0, 1, 2, ... in call order); `get(index, snap_id)` returns the value at `index` at the moment snapshot `snap_id` was taken. Copying the whole array per snapshot is too expensive, so store history sparsely.

#### Pattern
**Per-index list of (snap_id, value) records, appended in snap order; binary search on read.** **O(1)** amortized `set`/`snap`, **O(log k)** `get` where k is that index's history. Space is proportional to total writes, not length times snaps.

#### Explanation
Copying the array on every `snap` is O(length) per snapshot and wastes space on unchanged cells. Instead each index keeps only its own change log: a list of `(snap_id, value)` pairs recorded at the current snapshot id. Because snapshot ids only increase, each list is naturally sorted by `snap_id`, so `get(index, snap_id)` binary-searches for the last record with id less than or equal to the query — that is the value visible at that snapshot.

Two details make it exact. First, seed every index with `(0, 0)` so a `get` before any `set` still finds a baseline. Second, when a `set` happens within the same snapshot id as the index's last record, overwrite that record rather than appending a duplicate — otherwise the same `snap_id` would appear twice. `snap` itself just increments the counter and returns the previous value, doing no per-cell work.

#### Python
`bisect_right` over the record list with a `(snap_id, inf)` key finds the insertion point past all records at or below the target, so index minus one is the visible value.

```python
from bisect import bisect_right


class SnapshotArray:
    def __init__(self, length: int):
        self.snap_id = 0
        self.history = [[(0, 0)] for _ in range(length)]

    def set(self, index: int, val: int) -> None:
        records = self.history[index]
        if records[-1][0] == self.snap_id:
            records[-1] = (self.snap_id, val)
        else:
            records.append((self.snap_id, val))

    def snap(self) -> int:
        self.snap_id += 1
        return self.snap_id - 1

    def get(self, index: int, snap_id: int) -> int:
        records = self.history[index]
        i = bisect_right(records, (snap_id, float("inf"))) - 1
        return records[i][1]
```

#### Java
An array of `ArrayList<int[]>` holds the `{snapId, val}` records; a hand-rolled upper-bound binary search finds the last record at or below the queried id.

```java
import java.util.*;

class SnapshotArray {
    private int snapId = 0;
    private List<int[]>[] history;

    @SuppressWarnings("unchecked")
    public SnapshotArray(int length) {
        history = new List[length];
        for (int i = 0; i < length; i++) {
            history[i] = new ArrayList<>();
            history[i].add(new int[]{0, 0});
        }
    }

    public void set(int index, int val) {
        List<int[]> records = history[index];
        int[] last = records.get(records.size() - 1);
        if (last[0] == snapId) last[1] = val;
        else records.add(new int[]{snapId, val});
    }

    public int snap() {
        return snapId++;
    }

    public int get(int index, int snapId) {
        List<int[]> records = history[index];
        int lo = 0, hi = records.size() - 1, ans = 0;
        while (lo <= hi) {
            int mid = (lo + hi) >>> 1;
            if (records.get(mid)[0] <= snapId) {
                ans = records.get(mid)[1];
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return ans;
    }
}
```

#### Rust
`Vec<(i32, i32)>` per index plus slice `partition_point` gives the count of records at or below the target id, so `pos - 1` is the answer with no manual binary search.

```rust
struct SnapshotArray {
    snap_id: i32,
    history: Vec<Vec<(i32, i32)>>,
}

impl SnapshotArray {
    fn new(length: i32) -> Self {
        Self {
            snap_id: 0,
            history: vec![vec![(0, 0)]; length as usize],
        }
    }

    fn set(&mut self, index: i32, val: i32) {
        let records = &mut self.history[index as usize];
        let last = records.last_mut().unwrap();
        if last.0 == self.snap_id {
            last.1 = val;
        } else {
            records.push((self.snap_id, val));
        }
    }

    fn snap(&mut self) -> i32 {
        self.snap_id += 1;
        self.snap_id - 1
    }

    fn get(&self, index: i32, snap_id: i32) -> i32 {
        let records = &self.history[index as usize];
        let pos = records.partition_point(|&(s, _)| s <= snap_id);
        records[pos - 1].1
    }
}
```

#### Go
Each cell is a `[][2]int` slice of `{snapId, val}`; `sort.Search` locates the first record strictly greater than the target, so the previous one is visible.

```go
import "sort"

type SnapshotArray struct {
    snapId  int
    history [][][2]int
}

func Constructor(length int) SnapshotArray {
    h := make([][][2]int, length)
    for i := range h {
        h[i] = [][2]int{{0, 0}}
    }
    return SnapshotArray{snapId: 0, history: h}
}

func (sa *SnapshotArray) Set(index int, val int) {
    records := sa.history[index]
    last := &records[len(records)-1]
    if last[0] == sa.snapId {
        last[1] = val
    } else {
        sa.history[index] = append(records, [2]int{sa.snapId, val})
    }
}

func (sa *SnapshotArray) Snap() int {
    sa.snapId++
    return sa.snapId - 1
}

func (sa *SnapshotArray) Get(index int, snapId int) int {
    records := sa.history[index]
    i := sort.Search(len(records), func(i int) bool {
        return records[i][0] > snapId
    })
    return records[i-1][1]
}
```

#### C++
`vector<vector<pair<int,int>>>` stores per-index history; a hand-written upper-bound loop returns the last record at or below the queried snapshot.

```cpp
#include <utility>
#include <vector>
using namespace std;

class SnapshotArray {
    int snapId = 0;
    vector<vector<pair<int, int>>> history;

public:
    SnapshotArray(int length) : history(length, {{0, 0}}) {}

    void set(int index, int val) {
        auto& records = history[index];
        if (records.back().first == snapId) records.back().second = val;
        else records.push_back({snapId, val});
    }

    int snap() {
        return snapId++;
    }

    int get(int index, int snap_id) {
        auto& records = history[index];
        int lo = 0, hi = records.size();
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (records[mid].first <= snap_id) lo = mid + 1;
            else hi = mid;
        }
        return records[lo - 1].second;
    }
};
```

### 28. Design Bitset

#### Problem
Implement `Bitset(size)` initialized to all zeros. Support `fix(idx)` (set bit to 1), `unfix(idx)` (set bit to 0), `flip()` (invert every bit), `all()` (true if every bit is 1), `one()` (true if any bit is 1), `count()` (number of 1s), and `toString()` (the bit string). `flip` must be O(1), which rules out actually walking the array on each flip.

#### Pattern
**Bit array plus a lazy global flip flag and a running count of ones.** **O(1)** for every mutation and query except `toString` which is **O(size)**, **O(size)** space. Deferring the flip keeps it constant time.

#### Explanation
The trick is to never physically invert the array on `flip`. Instead keep a boolean `flipped`; the logical value of bit `i` is `raw[i] XOR flipped`. Then `flip` just toggles the flag and resets the count of ones to `size - ones`, both O(1). A running `ones` counter answers `all`, `one`, and `count` directly without scanning.

`fix` and `unfix` compute the current logical value (`raw XOR flipped`) and act only when it needs to change: `fix` on a logical 0 toggles the raw bit and increments `ones`; `unfix` on a logical 1 toggles and decrements. Toggling the raw bit is correct regardless of the flag because XOR with the flag is applied consistently everywhere. Only `toString` must materialize the logical bits, XOR-ing each raw bit with the flag as it builds the string.

#### Python
Booleans are `int` subclasses, so `bits[idx] ^ self.flipped` mixes the flag straight into the XOR; `flip` recomputes `ones` as `size - ones` in O(1).

```python
class Bitset:
    def __init__(self, size: int):
        self.size = size
        self.bits = [0] * size
        self.flipped = False
        self.ones = 0

    def fix(self, idx: int) -> None:
        if self.bits[idx] ^ self.flipped == 0:
            self.bits[idx] ^= 1
            self.ones += 1

    def unfix(self, idx: int) -> None:
        if self.bits[idx] ^ self.flipped == 1:
            self.bits[idx] ^= 1
            self.ones -= 1

    def flip(self) -> None:
        self.flipped = not self.flipped
        self.ones = self.size - self.ones

    def all(self) -> bool:
        return self.ones == self.size

    def one(self) -> bool:
        return self.ones > 0

    def count(self) -> int:
        return self.ones

    def toString(self) -> str:
        f = 1 if self.flipped else 0
        return "".join(str(b ^ f) for b in self.bits)
```

#### Java
An `int[]` of 0/1 bits with a `boolean flipped`; `toString` builds the logical string with a `StringBuilder`, appending `'0' + (bit ^ flag)`.

```java
class Bitset {
    private int size;
    private int[] bits;
    private boolean flipped;
    private int ones;

    public Bitset(int size) {
        this.size = size;
        this.bits = new int[size];
        this.flipped = false;
        this.ones = 0;
    }

    public void fix(int idx) {
        int f = flipped ? 1 : 0;
        if ((bits[idx] ^ f) == 0) {
            bits[idx] ^= 1;
            ones++;
        }
    }

    public void unfix(int idx) {
        int f = flipped ? 1 : 0;
        if ((bits[idx] ^ f) == 1) {
            bits[idx] ^= 1;
            ones--;
        }
    }

    public void flip() {
        flipped = !flipped;
        ones = size - ones;
    }

    public boolean all() {
        return ones == size;
    }

    public boolean one() {
        return ones > 0;
    }

    public int count() {
        return ones;
    }

    public String toString() {
        int f = flipped ? 1 : 0;
        StringBuilder sb = new StringBuilder();
        for (int b : bits) sb.append((char) ('0' + (b ^ f)));
        return sb.toString();
    }
}
```

#### Rust
A `Vec<u8>` of 0/1 plus `self.flipped as u8` folds the flag into the XOR; `to_string` maps each logical bit to a `char` via `+ b'0'`.

```rust
struct Bitset {
    size: i32,
    bits: Vec<u8>,
    flipped: bool,
    ones: i32,
}

impl Bitset {
    fn new(size: i32) -> Self {
        Self {
            size,
            bits: vec![0; size as usize],
            flipped: false,
            ones: 0,
        }
    }

    fn fix(&mut self, idx: i32) {
        let f = self.flipped as u8;
        let i = idx as usize;
        if self.bits[i] ^ f == 0 {
            self.bits[i] ^= 1;
            self.ones += 1;
        }
    }

    fn unfix(&mut self, idx: i32) {
        let f = self.flipped as u8;
        let i = idx as usize;
        if self.bits[i] ^ f == 1 {
            self.bits[i] ^= 1;
            self.ones -= 1;
        }
    }

    fn flip(&mut self) {
        self.flipped = !self.flipped;
        self.ones = self.size - self.ones;
    }

    fn all(&self) -> bool {
        self.ones == self.size
    }

    fn one(&self) -> bool {
        self.ones > 0
    }

    fn count(&self) -> i32 {
        self.ones
    }

    fn to_string(&self) -> String {
        let f = self.flipped as u8;
        self.bits.iter().map(|&b| ((b ^ f) + b'0') as char).collect()
    }
}
```

#### Go
A `[]byte` of 0/1 with a `flipped bool`; `ToString` writes into a `make([]byte, size)` buffer and converts once, avoiding per-append allocation.

```go
type Bitset struct {
    size    int
    bits    []byte
    flipped bool
    ones    int
}

func Constructor(size int) Bitset {
    return Bitset{size: size, bits: make([]byte, size)}
}

func (b *Bitset) Fix(idx int) {
    var f byte
    if b.flipped {
        f = 1
    }
    if b.bits[idx]^f == 0 {
        b.bits[idx] ^= 1
        b.ones++
    }
}

func (b *Bitset) Unfix(idx int) {
    var f byte
    if b.flipped {
        f = 1
    }
    if b.bits[idx]^f == 1 {
        b.bits[idx] ^= 1
        b.ones--
    }
}

func (b *Bitset) Flip() {
    b.flipped = !b.flipped
    b.ones = b.size - b.ones
}

func (b *Bitset) All() bool {
    return b.ones == b.size
}

func (b *Bitset) One() bool {
    return b.ones > 0
}

func (b *Bitset) Count() int {
    return b.ones
}

func (b *Bitset) ToString() string {
    var f byte
    if b.flipped {
        f = 1
    }
    out := make([]byte, b.size)
    for i, v := range b.bits {
        out[i] = '0' + (v ^ f)
    }
    return string(out)
}
```

#### C++
A `vector<char>` of 0/1 with a `bool flipped`; `toString` fills a preallocated `string(size, '0')` in place.

```cpp
#include <string>
#include <vector>
using namespace std;

class Bitset {
    int size;
    vector<char> bits;
    bool flipped = false;
    int ones = 0;

public:
    Bitset(int size) : size(size), bits(size, 0) {}

    void fix(int idx) {
        char f = flipped ? 1 : 0;
        if ((bits[idx] ^ f) == 0) {
            bits[idx] ^= 1;
            ones++;
        }
    }

    void unfix(int idx) {
        char f = flipped ? 1 : 0;
        if ((bits[idx] ^ f) == 1) {
            bits[idx] ^= 1;
            ones--;
        }
    }

    void flip() {
        flipped = !flipped;
        ones = size - ones;
    }

    bool all() {
        return ones == size;
    }

    bool one() {
        return ones > 0;
    }

    int count() {
        return ones;
    }

    string toString() {
        char f = flipped ? 1 : 0;
        string s(size, '0');
        for (int i = 0; i < size; i++) s[i] = '0' + (bits[i] ^ f);
        return s;
    }
};
```

### 29. LRU Cache

#### Problem
Implement `LRUCache(capacity)` where `get(key)` returns the value or `-1` if absent, and `put(key, value)` inserts or updates. Both count as "using" the key. When inserting past `capacity`, evict the least recently used key first. Both operations must run in O(1).

#### Pattern
**Hash map plus a doubly linked list ordered by recency.** **O(1)** per operation, **O(capacity)** space. The map gives O(1) lookup; the list gives O(1) splice-to-front and O(1) tail eviction.

#### Explanation
A hash map alone can find a key in O(1) but cannot answer "which key is least recently used" without scanning. Pairing it with a doubly linked list, ordered most-recent at the front and least-recent at the back, fixes that: the map stores a pointer to each key's list node, so on `get` or `put` you unlink the node and move it to the front in O(1), and on overflow you drop the back node. Both structures update together so they never disagree.

`put` has three cases: existing key (update value, move to front), room available (insert at front), and full (evict the back node's key from both structures, then insert). Every language here reaches for its idiomatic version of this pattern — some hide the linked list inside a library type, others build it explicitly with sentinel nodes to avoid null-boundary special-casing.

#### Python
`OrderedDict` is a hash map with a built-in recency order: `move_to_end` marks a key most-recent and `popitem(last=False)` evicts the oldest, both O(1).

```python
from collections import OrderedDict


class LRUCache:
    def __init__(self, capacity: int):
        self.cache = OrderedDict()
        self.capacity = capacity

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)
```

#### Java
`LinkedHashMap` in access-order mode maintains recency automatically; overriding `removeEldestEntry` turns capacity enforcement into a one-line eviction hook.

```java
import java.util.*;

class LRUCache {
    private final LinkedHashMap<Integer, Integer> map;
    private final int capacity;

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.map = new LinkedHashMap<>(capacity, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<Integer, Integer> eldest) {
                return size() > LRUCache.this.capacity;
            }
        };
    }

    public int get(int key) {
        return map.getOrDefault(key, -1);
    }

    public void put(int key, int value) {
        map.put(key, value);
    }
}
```

#### Rust
Rust's ownership rules make pointer-based linked lists painful, so use an index-arena doubly linked list: parallel `Vec`s hold the nodes, a free list recycles slots, and two sentinels remove null-boundary checks.

```rust
use std::collections::HashMap;

struct LRUCache {
    map: HashMap<i32, usize>,
    key: Vec<i32>,
    val: Vec<i32>,
    prev: Vec<usize>,
    next: Vec<usize>,
    free: Vec<usize>,
    head: usize,
    tail: usize,
}

impl LRUCache {
    fn new(capacity: i32) -> Self {
        let cap = capacity as usize;
        let total = cap + 2;
        let head = cap;
        let tail = cap + 1;
        let mut prev = vec![0usize; total];
        let mut next = vec![0usize; total];
        next[head] = tail;
        prev[tail] = head;
        LRUCache {
            map: HashMap::new(),
            key: vec![0; total],
            val: vec![0; total],
            prev,
            next,
            free: (0..cap).collect(),
            head,
            tail,
        }
    }

    fn unlink(&mut self, i: usize) {
        let (p, n) = (self.prev[i], self.next[i]);
        self.next[p] = n;
        self.prev[n] = p;
    }

    fn push_front(&mut self, i: usize) {
        let n = self.next[self.head];
        self.next[self.head] = i;
        self.prev[i] = self.head;
        self.next[i] = n;
        self.prev[n] = i;
    }

    fn get(&mut self, key: i32) -> i32 {
        if let Some(&i) = self.map.get(&key) {
            self.unlink(i);
            self.push_front(i);
            self.val[i]
        } else {
            -1
        }
    }

    fn put(&mut self, key: i32, value: i32) {
        if let Some(&i) = self.map.get(&key) {
            self.val[i] = value;
            self.unlink(i);
            self.push_front(i);
            return;
        }
        let i = if let Some(slot) = self.free.pop() {
            slot
        } else {
            let lru = self.prev[self.tail];
            self.unlink(lru);
            self.map.remove(&self.key[lru]);
            lru
        };
        self.key[i] = key;
        self.val[i] = value;
        self.map.insert(key, i);
        self.push_front(i);
    }
}
```

#### Go
`container/list` is a ready-made doubly linked list; store each `*list.Element` in the map so `MoveToFront` and `Remove(Back())` are O(1) splices.

```go
import "container/list"

type entry struct {
    key, value int
}

type LRUCache struct {
    capacity int
    ll       *list.List
    cache    map[int]*list.Element
}

func Constructor(capacity int) LRUCache {
    return LRUCache{
        capacity: capacity,
        ll:       list.New(),
        cache:    make(map[int]*list.Element),
    }
}

func (c *LRUCache) Get(key int) int {
    if el, ok := c.cache[key]; ok {
        c.ll.MoveToFront(el)
        return el.Value.(*entry).value
    }
    return -1
}

func (c *LRUCache) Put(key int, value int) {
    if el, ok := c.cache[key]; ok {
        el.Value.(*entry).value = value
        c.ll.MoveToFront(el)
        return
    }
    if c.ll.Len() >= c.capacity {
        back := c.ll.Back()
        if back != nil {
            c.ll.Remove(back)
            delete(c.cache, back.Value.(*entry).key)
        }
    }
    el := c.ll.PushFront(&entry{key, value})
    c.cache[key] = el
}
```

#### C++
`std::list` plus `unordered_map` of iterators; `list::splice` moves a node to the front in O(1) without invalidating the stored iterator.

```cpp
#include <list>
#include <unordered_map>
#include <utility>
using namespace std;

class LRUCache {
    int capacity;
    list<pair<int, int>> items;  // front = most recently used
    unordered_map<int, list<pair<int, int>>::iterator> map;

public:
    LRUCache(int capacity) : capacity(capacity) {}

    int get(int key) {
        auto it = map.find(key);
        if (it == map.end()) return -1;
        items.splice(items.begin(), items, it->second);
        return it->second->second;
    }

    void put(int key, int value) {
        auto it = map.find(key);
        if (it != map.end()) {
            it->second->second = value;
            items.splice(items.begin(), items, it->second);
            return;
        }
        if ((int)items.size() >= capacity) {
            map.erase(items.back().first);
            items.pop_back();
        }
        items.push_front({key, value});
        map[key] = items.begin();
    }
};
```

### 30. LFU Cache

#### Problem
Implement `LFUCache(capacity)` where `get(key)` returns the value or `-1`, and `put(key, value)` inserts or updates; both increment the key's use frequency. On overflow, evict the least frequently used key, breaking ties by least recently used among those. Target O(1) for `get` and `put`.

#### Pattern
**Key maps for value and frequency, plus one recency-ordered bucket per frequency, and a tracked minimum frequency.** **O(1)** per operation, **O(capacity)** space. Buckets ordered by recency make the eviction victim the front of the min-frequency bucket.

#### Explanation
LFU needs two orderings at once: by frequency (to pick the victim) and, within a frequency, by recency (to break ties). The design keeps `keyToVal` and `keyToFreq` for O(1) lookups, plus `freqToKeys[f]` — an insertion-ordered collection of every key currently at frequency `f`, oldest at the front. A `minFreq` variable always points at the lowest occupied frequency, so eviction is "remove the front key of `freqToKeys[minFreq]`" in O(1).

Every access "bumps" a key: remove it from its current frequency bucket, append it to the `freq+1` bucket (making it most-recent there), and update `keyToFreq`. If the bucket it left was the min-frequency bucket and just became empty, `minFreq` increments — and since the bumped key now sits at `freq+1`, that is exactly the new minimum. On a fresh `put`, the key enters frequency 1 and `minFreq` resets to 1. A zero capacity is a no-op guard. The one subtlety is the tie-break: because buckets append on insert and on bump, front-of-bucket is always the least recently used at that frequency.

#### Python
`defaultdict(OrderedDict)` gives each frequency an insertion-ordered bucket, so `popitem(last=False)` evicts the least-recently-used key at `min_freq` in O(1).

```python
from collections import defaultdict, OrderedDict


class LFUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.key_to_val = {}
        self.key_to_freq = {}
        self.freq_to_keys = defaultdict(OrderedDict)
        self.min_freq = 0

    def _bump(self, key: int) -> None:
        freq = self.key_to_freq[key]
        del self.freq_to_keys[freq][key]
        if not self.freq_to_keys[freq]:
            del self.freq_to_keys[freq]
            if self.min_freq == freq:
                self.min_freq += 1
        self.key_to_freq[key] = freq + 1
        self.freq_to_keys[freq + 1][key] = None

    def get(self, key: int) -> int:
        if key not in self.key_to_val:
            return -1
        self._bump(key)
        return self.key_to_val[key]

    def put(self, key: int, value: int) -> None:
        if self.capacity <= 0:
            return
        if key in self.key_to_val:
            self.key_to_val[key] = value
            self._bump(key)
            return
        if len(self.key_to_val) >= self.capacity:
            evict_key, _ = self.freq_to_keys[self.min_freq].popitem(last=False)
            del self.key_to_val[evict_key]
            del self.key_to_freq[evict_key]
        self.key_to_val[key] = value
        self.key_to_freq[key] = 1
        self.freq_to_keys[1][key] = None
        self.min_freq = 1
```

#### Java
`LinkedHashSet` per frequency preserves insertion order, so `iterator().next()` is the LRU key at that frequency and remove-then-add on bump moves a key to the most-recent end.

```java
import java.util.*;

class LFUCache {
    private final int capacity;
    private int minFreq;
    private final Map<Integer, Integer> keyToVal = new HashMap<>();
    private final Map<Integer, Integer> keyToFreq = new HashMap<>();
    private final Map<Integer, LinkedHashSet<Integer>> freqToKeys = new HashMap<>();

    public LFUCache(int capacity) {
        this.capacity = capacity;
        this.minFreq = 0;
    }

    private void bump(int key) {
        int freq = keyToFreq.get(key);
        LinkedHashSet<Integer> set = freqToKeys.get(freq);
        set.remove(key);
        if (set.isEmpty()) {
            freqToKeys.remove(freq);
            if (minFreq == freq) minFreq++;
        }
        keyToFreq.put(key, freq + 1);
        freqToKeys.computeIfAbsent(freq + 1, k -> new LinkedHashSet<>()).add(key);
    }

    public int get(int key) {
        if (!keyToVal.containsKey(key)) return -1;
        bump(key);
        return keyToVal.get(key);
    }

    public void put(int key, int value) {
        if (capacity <= 0) return;
        if (keyToVal.containsKey(key)) {
            keyToVal.put(key, value);
            bump(key);
            return;
        }
        if (keyToVal.size() >= capacity) {
            LinkedHashSet<Integer> set = freqToKeys.get(minFreq);
            int evict = set.iterator().next();
            set.remove(evict);
            if (set.isEmpty()) freqToKeys.remove(minFreq);
            keyToVal.remove(evict);
            keyToFreq.remove(evict);
        }
        keyToVal.put(key, value);
        keyToFreq.put(key, 1);
        freqToKeys.computeIfAbsent(1, k -> new LinkedHashSet<>()).add(key);
        minFreq = 1;
    }
}
```

#### Rust
Std has no insertion-ordered set, so build per-frequency doubly linked lists in a shared index arena: parallel `Vec`s for nodes, a `buckets` map from frequency to head/tail sentinel indices, and a free list — every splice and eviction stays O(1).

```rust
use std::collections::HashMap;

struct LFUCache {
    capacity: usize,
    size: usize,
    min_freq: i32,
    map: HashMap<i32, usize>,
    key: Vec<i32>,
    val: Vec<i32>,
    freq: Vec<i32>,
    prev: Vec<usize>,
    next: Vec<usize>,
    free: Vec<usize>,
    buckets: HashMap<i32, (usize, usize)>,
}

impl LFUCache {
    fn new(capacity: i32) -> Self {
        LFUCache {
            capacity: capacity as usize,
            size: 0,
            min_freq: 0,
            map: HashMap::new(),
            key: Vec::new(),
            val: Vec::new(),
            freq: Vec::new(),
            prev: Vec::new(),
            next: Vec::new(),
            free: Vec::new(),
            buckets: HashMap::new(),
        }
    }

    fn alloc(&mut self) -> usize {
        if let Some(i) = self.free.pop() {
            i
        } else {
            self.key.push(0);
            self.val.push(0);
            self.freq.push(0);
            self.prev.push(0);
            self.next.push(0);
            self.key.len() - 1
        }
    }

    fn bucket(&mut self, f: i32) -> (usize, usize) {
        if let Some(&ht) = self.buckets.get(&f) {
            return ht;
        }
        let h = self.alloc();
        let t = self.alloc();
        self.next[h] = t;
        self.prev[t] = h;
        self.buckets.insert(f, (h, t));
        (h, t)
    }

    fn unlink(&mut self, i: usize) {
        let (p, n) = (self.prev[i], self.next[i]);
        self.next[p] = n;
        self.prev[n] = p;
    }

    fn push_back(&mut self, f: i32, i: usize) {
        let (_, t) = self.bucket(f);
        let p = self.prev[t];
        self.next[p] = i;
        self.prev[i] = p;
        self.next[i] = t;
        self.prev[t] = i;
    }

    fn drop_if_empty(&mut self, f: i32) {
        if let Some(&(h, t)) = self.buckets.get(&f) {
            if self.next[h] == t {
                self.buckets.remove(&f);
                self.free.push(h);
                self.free.push(t);
            }
        }
    }

    fn bump(&mut self, i: usize) {
        let f = self.freq[i];
        self.unlink(i);
        self.drop_if_empty(f);
        if self.min_freq == f && !self.buckets.contains_key(&f) {
            self.min_freq = f + 1;
        }
        self.freq[i] = f + 1;
        self.push_back(f + 1, i);
    }

    fn get(&mut self, key: i32) -> i32 {
        if let Some(&i) = self.map.get(&key) {
            let v = self.val[i];
            self.bump(i);
            v
        } else {
            -1
        }
    }

    fn put(&mut self, key: i32, value: i32) {
        if self.capacity == 0 {
            return;
        }
        if let Some(&i) = self.map.get(&key) {
            self.val[i] = value;
            self.bump(i);
            return;
        }
        if self.size >= self.capacity {
            let (h, _) = self.buckets[&self.min_freq];
            let lru = self.next[h];
            self.unlink(lru);
            let f = self.freq[lru];
            self.map.remove(&self.key[lru]);
            self.free.push(lru);
            self.size -= 1;
            self.drop_if_empty(f);
        }
        let i = self.alloc();
        self.key[i] = key;
        self.val[i] = value;
        self.freq[i] = 1;
        self.map.insert(key, i);
        self.push_back(1, i);
        self.min_freq = 1;
        self.size += 1;
    }
}
```

#### Go
`container/list` per frequency stores `*lfuEntry` nodes; `Front()` is the LRU victim at `minFreq`, and `PushBack` on bump keeps each bucket ordered by recency.

```go
import "container/list"

type lfuEntry struct {
    key, value, freq int
}

type LFUCache struct {
    capacity int
    minFreq  int
    nodes    map[int]*list.Element
    freqs    map[int]*list.List
}

func Constructor(capacity int) LFUCache {
    return LFUCache{
        capacity: capacity,
        minFreq:  0,
        nodes:    make(map[int]*list.Element),
        freqs:    make(map[int]*list.List),
    }
}

func (c *LFUCache) bump(el *list.Element) {
    ent := el.Value.(*lfuEntry)
    old := ent.freq
    c.freqs[old].Remove(el)
    if c.freqs[old].Len() == 0 {
        delete(c.freqs, old)
        if c.minFreq == old {
            c.minFreq++
        }
    }
    ent.freq++
    if c.freqs[ent.freq] == nil {
        c.freqs[ent.freq] = list.New()
    }
    c.nodes[ent.key] = c.freqs[ent.freq].PushBack(ent)
}

func (c *LFUCache) Get(key int) int {
    el, ok := c.nodes[key]
    if !ok {
        return -1
    }
    val := el.Value.(*lfuEntry).value
    c.bump(el)
    return val
}

func (c *LFUCache) Put(key int, value int) {
    if c.capacity <= 0 {
        return
    }
    if el, ok := c.nodes[key]; ok {
        el.Value.(*lfuEntry).value = value
        c.bump(el)
        return
    }
    if len(c.nodes) >= c.capacity {
        l := c.freqs[c.minFreq]
        front := l.Front()
        evict := front.Value.(*lfuEntry)
        l.Remove(front)
        if l.Len() == 0 {
            delete(c.freqs, c.minFreq)
        }
        delete(c.nodes, evict.key)
    }
    ent := &lfuEntry{key: key, value: value, freq: 1}
    if c.freqs[1] == nil {
        c.freqs[1] = list.New()
    }
    c.nodes[key] = c.freqs[1].PushBack(ent)
    c.minFreq = 1
}
```

#### C++
`std::list<int>` per frequency for recency order, plus an `unordered_map` of iterators so removing a key from the middle of its bucket on bump is O(1) via `list::erase`.

```cpp
#include <list>
#include <unordered_map>
using namespace std;

class LFUCache {
    int capacity;
    int minFreq = 0;
    unordered_map<int, int> keyToVal;
    unordered_map<int, int> keyToFreq;
    unordered_map<int, list<int>> freqToKeys;
    unordered_map<int, list<int>::iterator> keyToIter;

    void bump(int key) {
        int f = keyToFreq[key];
        freqToKeys[f].erase(keyToIter[key]);
        if (freqToKeys[f].empty()) {
            freqToKeys.erase(f);
            if (minFreq == f) minFreq++;
        }
        keyToFreq[key] = f + 1;
        freqToKeys[f + 1].push_back(key);
        keyToIter[key] = prev(freqToKeys[f + 1].end());
    }

public:
    LFUCache(int capacity) : capacity(capacity) {}

    int get(int key) {
        auto it = keyToVal.find(key);
        if (it == keyToVal.end()) return -1;
        bump(key);
        return it->second;
    }

    void put(int key, int value) {
        if (capacity <= 0) return;
        if (keyToVal.count(key)) {
            keyToVal[key] = value;
            bump(key);
            return;
        }
        if ((int)keyToVal.size() >= capacity) {
            int evict = freqToKeys[minFreq].front();
            freqToKeys[minFreq].pop_front();
            if (freqToKeys[minFreq].empty()) freqToKeys.erase(minFreq);
            keyToVal.erase(evict);
            keyToFreq.erase(evict);
            keyToIter.erase(evict);
        }
        keyToVal[key] = value;
        keyToFreq[key] = 1;
        freqToKeys[1].push_back(key);
        keyToIter[key] = prev(freqToKeys[1].end());
        minFreq = 1;
    }
};
```

### 31. Design Most Recently Used Queue

#### Problem
Implement `MRUQueue`. The constructor `MRUQueue(n)` builds a queue holding the values `1, 2, ..., n` in order. `fetch(k)` moves the k-th element of the queue (1-indexed, by current position) to the very end of the queue and returns that element's value. Support repeated `fetch` calls; each returns the value that was just promoted to the back.

#### Pattern
**Dynamic array with remove-then-append.** **O(n)** per `fetch`, **O(n)** space. Removing at an index shifts the tail; appending is amortized O(1). An O(log n) variant exists via a Fenwick tree over occupancy slots, but the array is the honest, clearly-correct baseline for the standard constraints.

#### Explanation
The queue is nothing more than an ordered list, and `fetch(k)` is a splice: pull the element out of position `k-1` and push it onto the back. A plain growable array captures this exactly. The only invariant is that array order equals queue order at all times, which `remove` + `append` preserves for free.

The cost is the shift: deleting from the middle of a contiguous array slides every later element down by one, giving O(n) per call. With n and the number of calls both in the low thousands, O(n^2) total is comfortably fast. If you needed sub-linear behavior you would keep every original position permanently allocated and use a Fenwick tree to find the k-th still-present element by prefix-count, appending promoted values into fresh trailing slots; that trades simplicity for an O(log n) query. The edge case to keep straight is the 1-indexing of `k` versus 0-indexed array access.

#### Python
`list.pop(i)` removes and returns in one call, then `append` re-adds at the back; `range(1, n + 1)` seeds the values.

```python
class MRUQueue:
    def __init__(self, n: int):
        self.q = list(range(1, n + 1))

    def fetch(self, k: int) -> int:
        val = self.q.pop(k - 1)
        self.q.append(val)
        return val
```

#### Java
`ArrayList.remove(int)` deletes by index and returns the element (careful: that's the index overload, not the value overload), then `add` appends.

```java
class MRUQueue {
    private final ArrayList<Integer> q = new ArrayList<>();

    public MRUQueue(int n) {
        for (int i = 1; i <= n; i++) q.add(i);
    }

    public int fetch(int k) {
        int val = q.remove(k - 1);
        q.add(val);
        return val;
    }
}
```

#### Rust
`Vec::remove` shifts and returns the value; `(1..=n).collect()` builds the initial vector directly.

```rust
struct MRUQueue {
    q: Vec<i32>,
}

impl MRUQueue {
    fn new(n: i32) -> Self {
        MRUQueue { q: (1..=n).collect() }
    }

    fn fetch(&mut self, k: i32) -> i32 {
        let val = self.q.remove((k - 1) as usize);
        self.q.push(val);
        val
    }
}
```

#### Go
Delete-at-index via `append(s[:i], s[i+1:]...)` is the idiomatic slice splice; then append the value to the tail.

```go
type MRUQueue struct {
    q []int
}

func Constructor(n int) MRUQueue {
    q := make([]int, n)
    for i := 0; i < n; i++ {
        q[i] = i + 1
    }
    return MRUQueue{q: q}
}

func (m *MRUQueue) Fetch(k int) int {
    idx := k - 1
    val := m.q[idx]
    m.q = append(m.q[:idx], m.q[idx+1:]...)
    m.q = append(m.q, val)
    return val
}
```

#### C++
`vector::erase(begin() + i)` removes by iterator; grab the value first since erase invalidates the position.

```cpp
class MRUQueue {
    vector<int> q;
public:
    MRUQueue(int n) {
        q.reserve(n);
        for (int i = 1; i <= n; i++) q.push_back(i);
    }

    int fetch(int k) {
        int val = q[k - 1];
        q.erase(q.begin() + (k - 1));
        q.push_back(val);
        return val;
    }
};
```

### 32. Design Memory Allocator

#### Problem
Implement `Allocator`. The constructor `Allocator(n)` creates a memory array of `n` units, all initially free. `allocate(size, mID)` finds the leftmost block of `size` consecutive free units, marks every unit in it with owner id `mID`, and returns the starting index; if no such block exists it returns `-1`. `freeMemory(mID)` frees every unit currently owned by `mID` (wherever they are) and returns the count of units freed.

#### Pattern
**Flat occupancy array with linear scans.** **O(n)** per `allocate` and per `freeMemory`, **O(n)** space. Owner id `0` marks a free unit, so allocation is a run-length scan and freeing is a full sweep.

#### Explanation
Model memory as an integer array where each cell stores its owner's id and `0` means free. Allocation is a classic first-fit scan: walk left to right counting consecutive free cells; the moment the run reaches `size`, back up to `start = i - size + 1`, stamp `mID` across the block, and return `start`. Any non-free cell resets the run counter to zero. This is guaranteed leftmost because we take the first run that qualifies.

Freeing by id is intentionally global: the units owned by `mID` need not be contiguous (nothing forbids allocating the same id twice), so a single left-to-right sweep clears each matching cell and tallies the count. Using `0` as the free sentinel is the key simplification, since problem ids are positive it can never collide with a real owner. With n and call counts in the low thousands, O(n) per operation is well within limits; interval-tree or free-list structures would cut the constant but add complexity the constraints do not demand. The subtle bug to avoid is computing `start` off the run's end index rather than tracking it separately.

#### Python
A single pass with a `run` counter; on hitting `size`, fill the slice with `mID`. Freeing is a comprehension-free sweep to allow in-place mutation and counting.

```python
class Allocator:
    def __init__(self, n: int):
        self.mem = [0] * n

    def allocate(self, size: int, mID: int) -> int:
        run = 0
        for i in range(len(self.mem)):
            if self.mem[i] == 0:
                run += 1
                if run == size:
                    start = i - size + 1
                    for j in range(start, i + 1):
                        self.mem[j] = mID
                    return start
            else:
                run = 0
        return -1

    def freeMemory(self, mID: int) -> int:
        freed = 0
        for i in range(len(self.mem)):
            if self.mem[i] == mID:
                self.mem[i] = 0
                freed += 1
        return freed
```

#### Java
A primitive `int[]` for the memory; `++run == size` triggers the fill. No boxing, no collections needed.

```java
class Allocator {
    private final int[] mem;

    public Allocator(int n) {
        mem = new int[n];
    }

    public int allocate(int size, int mID) {
        int run = 0;
        for (int i = 0; i < mem.length; i++) {
            if (mem[i] == 0) {
                if (++run == size) {
                    int start = i - size + 1;
                    for (int j = start; j <= i; j++) mem[j] = mID;
                    return start;
                }
            } else {
                run = 0;
            }
        }
        return -1;
    }

    public int freeMemory(int mID) {
        int freed = 0;
        for (int i = 0; i < mem.length; i++) {
            if (mem[i] == mID) {
                mem[i] = 0;
                freed++;
            }
        }
        return freed;
    }
}
```

#### Rust
`vec![0; n]` for the backing store; `iter_mut()` gives clean in-place clearing during `free_memory`.

```rust
struct Allocator {
    mem: Vec<i32>,
}

impl Allocator {
    fn new(n: i32) -> Self {
        Allocator { mem: vec![0; n as usize] }
    }

    fn allocate(&mut self, size: i32, m_id: i32) -> i32 {
        let size = size as usize;
        let mut run = 0usize;
        for i in 0..self.mem.len() {
            if self.mem[i] == 0 {
                run += 1;
                if run == size {
                    let start = i + 1 - size;
                    for j in start..=i {
                        self.mem[j] = m_id;
                    }
                    return start as i32;
                }
            } else {
                run = 0;
            }
        }
        -1
    }

    fn free_memory(&mut self, m_id: i32) -> i32 {
        let mut freed = 0;
        for x in self.mem.iter_mut() {
            if *x == m_id {
                *x = 0;
                freed += 1;
            }
        }
        freed
    }
}
```

#### Go
A plain `[]int` from `make`; the two methods are straight index loops.

```go
type Allocator struct {
    mem []int
}

func Constructor(n int) Allocator {
    return Allocator{mem: make([]int, n)}
}

func (a *Allocator) Allocate(size int, mID int) int {
    run := 0
    for i := 0; i < len(a.mem); i++ {
        if a.mem[i] == 0 {
            run++
            if run == size {
                start := i - size + 1
                for j := start; j <= i; j++ {
                    a.mem[j] = mID
                }
                return start
            }
        } else {
            run = 0
        }
    }
    return -1
}

func (a *Allocator) FreeMemory(mID int) int {
    freed := 0
    for i := range a.mem {
        if a.mem[i] == mID {
            a.mem[i] = 0
            freed++
        }
    }
    return freed
}
```

#### C++
`vector<int>(n, 0)` via the member initializer list; `++run == size` gates the fill.

```cpp
class Allocator {
    vector<int> mem;
public:
    Allocator(int n) : mem(n, 0) {}

    int allocate(int size, int mID) {
        int run = 0;
        for (int i = 0; i < (int)mem.size(); i++) {
            if (mem[i] == 0) {
                if (++run == size) {
                    int start = i - size + 1;
                    for (int j = start; j <= i; j++) mem[j] = mID;
                    return start;
                }
            } else {
                run = 0;
            }
        }
        return -1;
    }

    int freeMemory(int mID) {
        int freed = 0;
        for (int i = 0; i < (int)mem.size(); i++) {
            if (mem[i] == mID) {
                mem[i] = 0;
                freed++;
            }
        }
        return freed;
    }
};
```

### 33. Implement Trie (Prefix Tree)

#### Problem
Implement `Trie` (prefix tree) supporting three operations. `insert(word)` adds a lowercase word. `search(word)` returns true only if the exact word was previously inserted. `startsWith(prefix)` returns true if any inserted word begins with the given prefix. All strings are lowercase `a`-`z`.

#### Pattern
**Prefix tree of child links plus an end-of-word flag.** **O(L)** per operation where L is the string length, **O(total characters)** space. `search` and `startsWith` differ only in whether they demand the terminal flag.

#### Explanation
A trie stores strings by their characters along a path from the root, so shared prefixes share nodes. Each node holds up to 26 child links and one boolean, `isWord`, marking that a path from the root to this node spells a complete inserted word. `insert` walks the word, creating missing children as it goes, and sets `isWord` on the final node.

Lookup collapses to path-following. Factor out a single `find(s)` helper that returns the node reached by consuming every character of `s`, or nothing if a link is missing. Then `search` is `find(word)` succeeding and that node having `isWord == true`; `startsWith` is merely `find(prefix)` succeeding, ignoring the flag. That distinction, terminal flag versus mere existence, is the whole point of the problem and the classic follow-up trap. Using a fixed 26-slot array of child pointers keeps each hop O(1) and avoids hashing overhead, which is why array-backed tries beat hash-map children in practice for the a-z alphabet.

#### Python
The node is just a `dict` of children plus a flag; a shared `_find` walks a string and returns the node or `None`.

```python
class Trie:
    def __init__(self):
        self.children = {}
        self.is_word = False

    def insert(self, word: str) -> None:
        node = self
        for ch in word:
            if ch not in node.children:
                node.children[ch] = Trie()
            node = node.children[ch]
        node.is_word = True

    def _find(self, prefix: str):
        node = self
        for ch in prefix:
            if ch not in node.children:
                return None
            node = node.children[ch]
        return node

    def search(self, word: str) -> bool:
        node = self._find(word)
        return node is not None and node.is_word

    def startsWith(self, prefix: str) -> bool:
        return self._find(prefix) is not None
```

#### Java
A fixed `Trie[26]` child array indexed by `c - 'a'` gives O(1) hops with no boxing; `find` is shared by both queries.

```java
class Trie {
    private final Trie[] children = new Trie[26];
    private boolean isWord = false;

    public Trie() {}

    public void insert(String word) {
        Trie node = this;
        for (char c : word.toCharArray()) {
            int i = c - 'a';
            if (node.children[i] == null) node.children[i] = new Trie();
            node = node.children[i];
        }
        node.isWord = true;
    }

    private Trie find(String s) {
        Trie node = this;
        for (char c : s.toCharArray()) {
            node = node.children[c - 'a'];
            if (node == null) return null;
        }
        return node;
    }

    public boolean search(String word) {
        Trie node = find(word);
        return node != null && node.isWord;
    }

    public boolean startsWith(String prefix) {
        return find(prefix) != null;
    }
}
```

#### Rust
`HashMap<char, Trie>` children with `entry(ch).or_default()` grows the tree in one line; `#[derive(Default)]` builds empty nodes and `find` returns `Option<&Trie>` so `?` short-circuits.

```rust
use std::collections::HashMap;

#[derive(Default)]
struct Trie {
    children: HashMap<char, Trie>,
    is_word: bool,
}

impl Trie {
    fn new() -> Self {
        Trie::default()
    }

    fn insert(&mut self, word: String) {
        let mut node = self;
        for ch in word.chars() {
            node = node.children.entry(ch).or_default();
        }
        node.is_word = true;
    }

    fn find(&self, s: &str) -> Option<&Trie> {
        let mut node = self;
        for ch in s.chars() {
            node = node.children.get(&ch)?;
        }
        Some(node)
    }

    fn search(&self, word: String) -> bool {
        self.find(&word).map_or(false, |n| n.is_word)
    }

    fn starts_with(&self, prefix: String) -> bool {
        self.find(&prefix).is_some()
    }
}
```

#### Go
A `[26]*Trie` value-type child array (zero value is all-nil, no init needed); `find` returns `nil` on a missing link.

```go
type Trie struct {
    children [26]*Trie
    isWord   bool
}

func Constructor() Trie {
    return Trie{}
}

func (t *Trie) Insert(word string) {
    node := t
    for i := 0; i < len(word); i++ {
        c := word[i] - 'a'
        if node.children[c] == nil {
            node.children[c] = &Trie{}
        }
        node = node.children[c]
    }
    node.isWord = true
}

func (t *Trie) find(s string) *Trie {
    node := t
    for i := 0; i < len(s); i++ {
        node = node.children[s[i]-'a']
        if node == nil {
            return nil
        }
    }
    return node
}

func (t *Trie) Search(word string) bool {
    node := t.find(word)
    return node != nil && node.isWord
}

func (t *Trie) StartsWith(prefix string) bool {
    return t.find(prefix) != nil
}
```

#### C++
A raw `Trie* children[26] = {}` array default-initializes to null pointers; a private `find` is shared by both queries.

```cpp
class Trie {
    Trie* children[26] = {};
    bool isWord = false;

    Trie* find(const string& s) {
        Trie* node = this;
        for (char c : s) {
            node = node->children[c - 'a'];
            if (!node) return nullptr;
        }
        return node;
    }
public:
    Trie() {}

    void insert(const string& word) {
        Trie* node = this;
        for (char c : word) {
            int i = c - 'a';
            if (!node->children[i]) node->children[i] = new Trie();
            node = node->children[i];
        }
        node->isWord = true;
    }

    bool search(const string& word) {
        Trie* node = find(word);
        return node && node->isWord;
    }

    bool startsWith(const string& prefix) {
        return find(prefix) != nullptr;
    }
};
```

### 34. Design Add and Search Words Data Structure

#### Problem
Implement `WordDictionary`. `addWord(word)` stores a lowercase word. `search(word)` returns true if some stored word matches, where the query may contain the wildcard `.` that matches any single letter. A query has the same length as the words it can match; only single-character wildcards are involved.

#### Pattern
**Trie with DFS over wildcards.** **O(L)** per exact search, **O(26^d * L)** worst case with d wildcards, **O(total characters)** space. Concrete letters follow one link; a `.` branches into all present children.

#### Explanation
Storage is an ordinary trie: `addWord` inserts character by character exactly as a prefix tree does. The interesting half is `search`, which becomes a depth-first match against the query. At each position, a normal letter is deterministic, descend into that one child if it exists, else fail. A `.` is the branch point: try every existing child of the current node, and succeed if any subtree can match the remaining suffix.

The recursion carries the current node and the query index; the base case is reaching the end of the query, where success requires the node's `isWord` flag, not merely arriving somewhere. That flag check is essential: a `.`-heavy query must still land exactly on a stored word's terminal node, not a strict prefix of one. Cost is bounded by the branching factor at wildcard positions; with an all-`.` query you fan out across the whole alphabet at every level, but real inputs rarely hit that. Iterating a fixed 26-slot child array (skipping nulls) is the clean way to enumerate children for the wildcard case.

#### Python
A nested `dfs(node, i)` closes over the query string; `any(...)` over `children.values()` handles the `.` branch concisely.

```python
class WordDictionary:
    def __init__(self):
        self.children = {}
        self.is_word = False

    def addWord(self, word: str) -> None:
        node = self
        for ch in word:
            if ch not in node.children:
                node.children[ch] = WordDictionary()
            node = node.children[ch]
        node.is_word = True

    def search(self, word: str) -> bool:
        def dfs(node, i):
            if i == len(word):
                return node.is_word
            ch = word[i]
            if ch == '.':
                return any(dfs(child, i + 1) for child in node.children.values())
            child = node.children.get(ch)
            return child is not None and dfs(child, i + 1)
        return dfs(self, 0)
```

#### Java
A recursive `dfs` over the `WordDictionary[26]` child array; the `.` case loops all 26 slots and short-circuits on the first match.

```java
class WordDictionary {
    private final WordDictionary[] children = new WordDictionary[26];
    private boolean isWord = false;

    public WordDictionary() {}

    public void addWord(String word) {
        WordDictionary node = this;
        for (char c : word.toCharArray()) {
            int i = c - 'a';
            if (node.children[i] == null) node.children[i] = new WordDictionary();
            node = node.children[i];
        }
        node.isWord = true;
    }

    public boolean search(String word) {
        return dfs(word, 0, this);
    }

    private boolean dfs(String word, int i, WordDictionary node) {
        if (i == word.length()) return node.isWord;
        char c = word.charAt(i);
        if (c == '.') {
            for (WordDictionary child : node.children) {
                if (child != null && dfs(word, i + 1, child)) return true;
            }
            return false;
        }
        WordDictionary child = node.children[c - 'a'];
        return child != null && dfs(word, i + 1, child);
    }
}
```

#### Rust
`HashMap<char, WordDictionary>` children let the `.` case iterate `values()`; the DFS is an associated fn taking `&[u8]` to index bytes cheaply.

```rust
use std::collections::HashMap;

#[derive(Default)]
struct WordDictionary {
    children: HashMap<char, WordDictionary>,
    is_word: bool,
}

impl WordDictionary {
    fn new() -> Self {
        WordDictionary::default()
    }

    fn add_word(&mut self, word: String) {
        let mut node = self;
        for ch in word.chars() {
            node = node.children.entry(ch).or_default();
        }
        node.is_word = true;
    }

    fn search(&self, word: String) -> bool {
        Self::dfs(self, word.as_bytes(), 0)
    }

    fn dfs(node: &WordDictionary, word: &[u8], i: usize) -> bool {
        if i == word.len() {
            return node.is_word;
        }
        let ch = word[i] as char;
        if ch == '.' {
            node.children.values().any(|c| Self::dfs(c, word, i + 1))
        } else {
            node.children.get(&ch).map_or(false, |c| Self::dfs(c, word, i + 1))
        }
    }
}
```

#### Go
A closure `dfs` capturing `word`; the `.` case ranges the `[26]*WordDictionary` array and returns early on any hit.

```go
type WordDictionary struct {
    children [26]*WordDictionary
    isWord   bool
}

func Constructor() WordDictionary {
    return WordDictionary{}
}

func (w *WordDictionary) AddWord(word string) {
    node := w
    for i := 0; i < len(word); i++ {
        c := word[i] - 'a'
        if node.children[c] == nil {
            node.children[c] = &WordDictionary{}
        }
        node = node.children[c]
    }
    node.isWord = true
}

func (w *WordDictionary) Search(word string) bool {
    var dfs func(node *WordDictionary, i int) bool
    dfs = func(node *WordDictionary, i int) bool {
        if i == len(word) {
            return node.isWord
        }
        if word[i] == '.' {
            for _, child := range node.children {
                if child != nil && dfs(child, i+1) {
                    return true
                }
            }
            return false
        }
        child := node.children[word[i]-'a']
        return child != nil && dfs(child, i+1)
    }
    return dfs(w, 0)
}
```

#### C++
A private recursive `dfs` over the raw `WordDictionary* children[26]` array; a range-for handles the wildcard fan-out.

```cpp
class WordDictionary {
    WordDictionary* children[26] = {};
    bool isWord = false;

    bool dfs(const string& word, int i, WordDictionary* node) {
        if (i == (int)word.size()) return node->isWord;
        char c = word[i];
        if (c == '.') {
            for (WordDictionary* child : node->children) {
                if (child && dfs(word, i + 1, child)) return true;
            }
            return false;
        }
        WordDictionary* child = node->children[c - 'a'];
        return child && dfs(word, i + 1, child);
    }
public:
    WordDictionary() {}

    void addWord(const string& word) {
        WordDictionary* node = this;
        for (char c : word) {
            int i = c - 'a';
            if (!node->children[i]) node->children[i] = new WordDictionary();
            node = node->children[i];
        }
        node->isWord = true;
    }

    bool search(const string& word) {
        return dfs(word, 0, this);
    }
};
```

### 35. Implement Magic Dictionary

#### Problem
Implement `MagicDictionary`. `buildDict(dictionary)` initializes the structure from a list of distinct words. `search(searchWord)` returns true if and only if you can change exactly one character of `searchWord` (to some other letter) so the result equals a word in the dictionary. Changing zero characters or two-or-more characters does not count; the match must be same-length with exactly one differing position.

#### Pattern
**Trie with a one-mismatch DFS.** **O(26 * L)** per search, **O(total characters)** space. The DFS carries a `changed` flag and may spend it on at most one deviating child.

#### Explanation
Build a plain trie from the dictionary. `search` is a constrained tree walk that must consume a mismatch budget of exactly one. Carry a boolean `changed`. At each position, following the child that equals the current query character costs nothing and keeps `changed` as-is; following any other existing child spends the single allowed change and is only permitted when `changed` is still false, flipping it to true.

The acceptance condition ties it together: at the end of the query you succeed only if you are on a word-terminal node and `changed` is true. Requiring `changed == true` is what enforces exactly one edit, an identical word (zero edits) correctly fails, and a second deviation is blocked earlier because the budget is already spent. Enumerating children by scanning the 26-slot array lets you cheaply try both the matching branch and the alternative branches. This trie approach dominates the naive "compare against every same-length word" scan when the dictionary is large and shares prefixes, since mismatched branches are pruned the moment the budget would go negative.

#### Python
A `dfs(node, i, changed)` closure iterates `children.items()`, spending the change only when `c != ch` and `not changed`.

```python
class MagicDictionary:
    def __init__(self):
        self.children = {}
        self.is_word = False

    def buildDict(self, dictionary) -> None:
        for word in dictionary:
            node = self
            for ch in word:
                if ch not in node.children:
                    node.children[ch] = MagicDictionary()
                node = node.children[ch]
            node.is_word = True

    def search(self, searchWord: str) -> bool:
        def dfs(node, i, changed):
            if i == len(searchWord):
                return changed and node.is_word
            ch = searchWord[i]
            for c, child in node.children.items():
                if c == ch:
                    if dfs(child, i + 1, changed):
                        return True
                elif not changed:
                    if dfs(child, i + 1, True):
                        return True
            return False
        return dfs(self, 0, False)
```

#### Java
A recursive `dfs` scans the `MagicDictionary[26]` array; the matching index preserves `changed`, other indices flip it (only if unused).

```java
class MagicDictionary {
    private final MagicDictionary[] children = new MagicDictionary[26];
    private boolean isWord = false;

    public MagicDictionary() {}

    public void buildDict(String[] dictionary) {
        for (String word : dictionary) {
            MagicDictionary node = this;
            for (char c : word.toCharArray()) {
                int i = c - 'a';
                if (node.children[i] == null) node.children[i] = new MagicDictionary();
                node = node.children[i];
            }
            node.isWord = true;
        }
    }

    public boolean search(String searchWord) {
        return dfs(searchWord, 0, false, this);
    }

    private boolean dfs(String word, int i, boolean changed, MagicDictionary node) {
        if (i == word.length()) return changed && node.isWord;
        int target = word.charAt(i) - 'a';
        for (int c = 0; c < 26; c++) {
            if (node.children[c] == null) continue;
            if (c == target) {
                if (dfs(word, i + 1, changed, node.children[c])) return true;
            } else if (!changed) {
                if (dfs(word, i + 1, true, node.children[c])) return true;
            }
        }
        return false;
    }
}
```

#### Rust
`build_dict` reborrows with `&mut *self` each iteration so the outer loop can reuse the root; the DFS iterates `children.iter()` and passes `changed` by value.

```rust
use std::collections::HashMap;

#[derive(Default)]
struct MagicDictionary {
    children: HashMap<char, MagicDictionary>,
    is_word: bool,
}

impl MagicDictionary {
    fn new() -> Self {
        MagicDictionary::default()
    }

    fn build_dict(&mut self, dictionary: Vec<String>) {
        for word in dictionary {
            let mut node = &mut *self;
            for ch in word.chars() {
                node = node.children.entry(ch).or_default();
            }
            node.is_word = true;
        }
    }

    fn search(&self, search_word: String) -> bool {
        Self::dfs(self, search_word.as_bytes(), 0, false)
    }

    fn dfs(node: &MagicDictionary, word: &[u8], i: usize, changed: bool) -> bool {
        if i == word.len() {
            return changed && node.is_word;
        }
        let target = word[i] as char;
        for (&c, child) in node.children.iter() {
            if c == target {
                if Self::dfs(child, word, i + 1, changed) {
                    return true;
                }
            } else if !changed && Self::dfs(child, word, i + 1, true) {
                return true;
            }
        }
        false
    }
}
```

#### Go
A closure `dfs` over the `[26]*MagicDictionary` array; the branch at `c == target` keeps `changed`, others set it true when still false.

```go
type MagicDictionary struct {
    children [26]*MagicDictionary
    isWord   bool
}

func Constructor() MagicDictionary {
    return MagicDictionary{}
}

func (m *MagicDictionary) BuildDict(dictionary []string) {
    for _, word := range dictionary {
        node := m
        for i := 0; i < len(word); i++ {
            c := word[i] - 'a'
            if node.children[c] == nil {
                node.children[c] = &MagicDictionary{}
            }
            node = node.children[c]
        }
        node.isWord = true
    }
}

func (m *MagicDictionary) Search(searchWord string) bool {
    var dfs func(node *MagicDictionary, i int, changed bool) bool
    dfs = func(node *MagicDictionary, i int, changed bool) bool {
        if i == len(searchWord) {
            return changed && node.isWord
        }
        target := int(searchWord[i] - 'a')
        for c := 0; c < 26; c++ {
            if node.children[c] == nil {
                continue
            }
            if c == target {
                if dfs(node.children[c], i+1, changed) {
                    return true
                }
            } else if !changed {
                if dfs(node.children[c], i+1, true) {
                    return true
                }
            }
        }
        return false
    }
    return dfs(m, 0, false)
}
```

#### C++
A private recursive `dfs` scans the raw `MagicDictionary* children[26]` array, spending the one allowed change on any non-matching index.

```cpp
class MagicDictionary {
    MagicDictionary* children[26] = {};
    bool isWord = false;

    bool dfs(const string& word, int i, bool changed, MagicDictionary* node) {
        if (i == (int)word.size()) return changed && node->isWord;
        int target = word[i] - 'a';
        for (int c = 0; c < 26; c++) {
            if (!node->children[c]) continue;
            if (c == target) {
                if (dfs(word, i + 1, changed, node->children[c])) return true;
            } else if (!changed) {
                if (dfs(word, i + 1, true, node->children[c])) return true;
            }
        }
        return false;
    }
public:
    MagicDictionary() {}

    void buildDict(vector<string> dictionary) {
        for (const string& word : dictionary) {
            MagicDictionary* node = this;
            for (char ch : word) {
                int i = ch - 'a';
                if (!node->children[i]) node->children[i] = new MagicDictionary();
                node = node->children[i];
            }
            node->isWord = true;
        }
    }

    bool search(string searchWord) {
        return dfs(searchWord, 0, false, this);
    }
};
```

### 36. Stream of Characters

#### Problem
Implement `StreamChecker`. The constructor takes a list of words. `query(letter)` accepts the next character of an incoming stream and returns true if any suffix of the characters received so far (including the just-added one) equals one of the words. Each `query` runs in time proportional to the longest word, not the whole stream.

#### Pattern
**Trie of reversed words walked backward over a bounded stream.** **O(maxLen)** per `query`, **O(total characters)** space. Storing words reversed turns "is a suffix of the stream a word" into "does walking recent chars newest-first spell a stored word".

#### Explanation
The trick is direction. A suffix of the stream ends at the current character, so match from the newest character backward. Insert every dictionary word reversed into a trie; then a `query` walks the stream from the most recent character toward older ones, descending the trie one hop per character. If at any hop you land on a word-terminal node, some suffix ending "now" spells a stored word and you return true; if a link is missing, no longer suffix can match either, so stop.

Bounding the work is the second half. You never need more than `maxLen` recent characters, since no word is longer than that, so keep only a trailing window of the stream (evicting the oldest once it exceeds `maxLen`). Each query then costs at most `maxLen` hops regardless of how long the stream grows. This reversed-trie approach is the standard alternative to building an Aho-Corasick automaton; it is simpler to write, matches the same complexity target, and the only easy mistake is walking the stream forward instead of backward.

#### Python
A nested-`dict` trie keyed on reversed characters with `'$'` marking word ends; a `deque(maxlen=...)` with `appendleft` keeps the newest-first window and self-trims.

```python
from collections import deque

class StreamChecker:
    def __init__(self, words):
        self.root = {}
        max_len = 0
        for word in words:
            node = self.root
            for ch in reversed(word):
                node = node.setdefault(ch, {})
            node['$'] = True
            max_len = max(max_len, len(word))
        self.stream = deque(maxlen=max_len)

    def query(self, letter: str) -> bool:
        self.stream.appendleft(letter)
        node = self.root
        for ch in self.stream:
            if ch not in node:
                return False
            node = node[ch]
            if '$' in node:
                return True
        return False
```

#### Java
A small `Node` with a `[26]` child array; a `StringBuilder` holds the stream and `query` scans backward from the tail, bounded by `maxLen`.

```java
class StreamChecker {
    static class Node {
        Node[] children = new Node[26];
        boolean isWord = false;
    }

    private final Node root = new Node();
    private final StringBuilder stream = new StringBuilder();
    private int maxLen = 0;

    public StreamChecker(String[] words) {
        for (String word : words) {
            Node node = root;
            for (int i = word.length() - 1; i >= 0; i--) {
                int c = word.charAt(i) - 'a';
                if (node.children[c] == null) node.children[c] = new Node();
                node = node.children[c];
            }
            node.isWord = true;
            maxLen = Math.max(maxLen, word.length());
        }
    }

    public boolean query(char letter) {
        stream.append(letter);
        Node node = root;
        int limit = Math.max(0, stream.length() - maxLen);
        for (int i = stream.length() - 1; i >= limit; i--) {
            int c = stream.charAt(i) - 'a';
            if (node.children[c] == null) return false;
            node = node.children[c];
            if (node.isWord) return true;
        }
        return false;
    }
}
```

#### Rust
A `[Option<Box<Node>>; 26]` child array (arrays of length <= 32 derive `Default`); `get_or_insert_with` builds the reversed trie and a `VecDeque` with `push_front` plus a `pop_back` trim keeps the newest-first window.

```rust
use std::collections::VecDeque;

#[derive(Default)]
struct Node {
    children: [Option<Box<Node>>; 26],
    is_word: bool,
}

struct StreamChecker {
    root: Node,
    stream: VecDeque<u8>,
    max_len: usize,
}

impl StreamChecker {
    fn new(words: Vec<String>) -> Self {
        let mut root = Node::default();
        let mut max_len = 0;
        for word in &words {
            let bytes = word.as_bytes();
            max_len = max_len.max(bytes.len());
            let mut node = &mut root;
            for &b in bytes.iter().rev() {
                let idx = (b - b'a') as usize;
                node = node.children[idx].get_or_insert_with(|| Box::new(Node::default()));
            }
            node.is_word = true;
        }
        StreamChecker { root, stream: VecDeque::new(), max_len }
    }

    fn query(&mut self, letter: char) -> bool {
        self.stream.push_front(letter as u8);
        while self.stream.len() > self.max_len {
            self.stream.pop_back();
        }
        let mut node = &self.root;
        for &b in self.stream.iter() {
            let idx = (b - b'a') as usize;
            match node.children[idx].as_ref() {
                Some(next) => {
                    node = next;
                    if node.is_word {
                        return true;
                    }
                }
                None => return false,
            }
        }
        false
    }
}
```

#### Go
A `[26]*scNode` reversed trie; the stream is a `[]byte` reslice-trimmed to the last `maxLen` bytes, scanned backward each query.

```go
type scNode struct {
    children [26]*scNode
    isWord   bool
}

type StreamChecker struct {
    root   *scNode
    stream []byte
    maxLen int
}

func Constructor(words []string) StreamChecker {
    root := &scNode{}
    maxLen := 0
    for _, word := range words {
        if len(word) > maxLen {
            maxLen = len(word)
        }
        node := root
        for i := len(word) - 1; i >= 0; i-- {
            c := word[i] - 'a'
            if node.children[c] == nil {
                node.children[c] = &scNode{}
            }
            node = node.children[c]
        }
        node.isWord = true
    }
    return StreamChecker{root: root, maxLen: maxLen}
}

func (s *StreamChecker) Query(letter byte) bool {
    s.stream = append(s.stream, letter)
    if len(s.stream) > s.maxLen {
        s.stream = s.stream[len(s.stream)-s.maxLen:]
    }
    node := s.root
    for i := len(s.stream) - 1; i >= 0; i-- {
        c := s.stream[i] - 'a'
        if node.children[c] == nil {
            return false
        }
        node = node.children[c]
        if node.isWord {
            return true
        }
    }
    return false
}
```

#### C++
A nested `Node` struct with a raw `children[26]` array; a `string` accumulates the stream and `query` scans backward bounded by `maxLen`.

```cpp
class StreamChecker {
    struct Node {
        Node* children[26] = {};
        bool isWord = false;
    };
    Node* root = new Node();
    string stream;
    int maxLen = 0;
public:
    StreamChecker(vector<string>& words) {
        for (const string& word : words) {
            maxLen = max(maxLen, (int)word.size());
            Node* node = root;
            for (int i = (int)word.size() - 1; i >= 0; i--) {
                int c = word[i] - 'a';
                if (!node->children[c]) node->children[c] = new Node();
                node = node->children[c];
            }
            node->isWord = true;
        }
    }

    bool query(char letter) {
        stream.push_back(letter);
        Node* node = root;
        int limit = max(0, (int)stream.size() - maxLen);
        for (int i = (int)stream.size() - 1; i >= limit; i--) {
            int c = stream[i] - 'a';
            if (!node->children[c]) return false;
            node = node->children[c];
            if (node->isWord) return true;
        }
        return false;
    }
};
```

### 37. Encode and Decode Strings

#### Problem
Design a `Codec` that turns a list of arbitrary strings into a single string and back. Implement `encode(strs)` returning one string over the network, and `decode(s)` returning the original list. The strings may contain any characters — including any delimiter you might pick — so a naive `join`/`split` fails; encoding and decoding must both run in O(total length).

#### Pattern
**Length-prefix framing.** **O(N)** total time over all characters, **O(N)** space. Prefix each string with its byte length and a separator so decoding never has to guess where a payload ends.

#### Explanation
The whole trick is that no single delimiter is safe when payloads are arbitrary, so instead of delimiting the *content* you delimit the *header*. Write `len(s) + "#" + s` for each string. On decode you read digits up to the first `#`, parse the length, then take exactly that many characters as the payload — the payload itself is never scanned for structure, so it can contain `#`, digits, newlines, anything.

The invariant is that the read cursor always sits at the start of a length header. You advance it to the `#`, jump past it, consume `length` chars, and land back on the next header (or the end). This is O(N) because every character is touched a constant number of times, and it is robust to empty strings (`"0#"`) and to Unicode as long as lengths and slicing agree on the same unit — measure length in bytes and slice by bytes to stay consistent.

#### Python
Byte-safe here because Python `len` and slicing agree on the same unit; scan for `#` with a simple cursor.

```python
class Codec:
    def encode(self, strs: list[str]) -> str:
        parts = []
        for s in strs:
            parts.append(f"{len(s)}#{s}")
        return "".join(parts)

    def decode(self, s: str) -> list[str]:
        res = []
        i, n = 0, len(s)
        while i < n:
            j = i
            while s[j] != '#':
                j += 1
            length = int(s[i:j])
            start = j + 1
            res.append(s[start:start + length])
            i = start + length
        return res
```

#### Java
`StringBuilder` for the append loop; `substring` cheaply extracts each framed payload.

```java
import java.util.*;

public class Codec {
    public String encode(List<String> strs) {
        StringBuilder sb = new StringBuilder();
        for (String s : strs) {
            sb.append(s.length()).append('#').append(s);
        }
        return sb.toString();
    }

    public List<String> decode(String s) {
        List<String> res = new ArrayList<>();
        int i = 0, n = s.length();
        while (i < n) {
            int j = i;
            while (s.charAt(j) != '#') j++;
            int length = Integer.parseInt(s.substring(i, j));
            int start = j + 1;
            res.add(s.substring(start, start + length));
            i = start + length;
        }
        return res;
    }
}
```

#### Rust
Work over `as_bytes()` and slice by byte index so `len()` (byte length) and the slice stay in the same unit.

```rust
struct Codec;

impl Codec {
    fn new() -> Self {
        Codec
    }

    fn encode(&self, strs: Vec<String>) -> String {
        let mut out = String::new();
        for s in &strs {
            out.push_str(&s.len().to_string());
            out.push('#');
            out.push_str(s);
        }
        out
    }

    fn decode(&self, s: String) -> Vec<String> {
        let bytes = s.as_bytes();
        let mut res = Vec::new();
        let (mut i, n) = (0usize, bytes.len());
        while i < n {
            let mut j = i;
            while bytes[j] != b'#' {
                j += 1;
            }
            let length: usize = s[i..j].parse().unwrap();
            let start = j + 1;
            res.push(s[start..start + length].to_string());
            i = start + length;
        }
        res
    }
}
```

#### Go
Index a `string` as bytes and use `strconv.Itoa`/`Atoi`; `strings.Builder` avoids quadratic concatenation.

```go
type Codec struct{}

func Constructor() Codec {
    return Codec{}
}

func (c *Codec) Encode(strs []string) string {
    var sb strings.Builder
    for _, s := range strs {
        sb.WriteString(strconv.Itoa(len(s)))
        sb.WriteByte('#')
        sb.WriteString(s)
    }
    return sb.String()
}

func (c *Codec) Decode(s string) []string {
    res := []string{}
    i, n := 0, len(s)
    for i < n {
        j := i
        for s[j] != '#' {
            j++
        }
        length, _ := strconv.Atoi(s[i:j])
        start := j + 1
        res = append(res, s[start:start+length])
        i = start + length
    }
    return res
}
```

#### C++
`std::to_string`/`std::stoi` for the header; `substr(start, length)` slices the payload directly.

```cpp
#include <string>
#include <vector>

class Codec {
public:
    std::string encode(std::vector<std::string>& strs) {
        std::string out;
        for (const auto& s : strs) {
            out += std::to_string(s.size());
            out += '#';
            out += s;
        }
        return out;
    }

    std::vector<std::string> decode(std::string s) {
        std::vector<std::string> res;
        size_t i = 0, n = s.size();
        while (i < n) {
            size_t j = i;
            while (s[j] != '#') j++;
            int length = std::stoi(s.substr(i, j - i));
            size_t start = j + 1;
            res.push_back(s.substr(start, length));
            i = start + length;
        }
        return res;
    }
};
```

### 38. Encode and Decode TinyURL

#### Problem
Design a `Codec` for a URL shortener. `encode(longUrl)` returns a short URL, and `decode(shortUrl)` returns the original long URL such that `decode(encode(url)) == url`. There is no cross-process persistence requirement — one in-memory instance serves both calls — and both operations should be O(1) amortized.

#### Pattern
**Counter + base62 key over a hash map.** **O(1)** amortized per call, **O(n)** space for n stored URLs. A monotonically increasing id guarantees uniqueness without any collision retries.

#### Explanation
The only real requirement is a reversible mapping, so the clean design is a dictionary keyed by a short opaque token. Random 6-char keys work but force a collision-check loop; an incrementing counter is strictly simpler and collision-free. Encode the counter in base62 (`[a-zA-Z0-9]`) to keep tokens short and URL-safe, store `key -> longUrl`, and hand back `host + key`.

Decode just strips everything up to the last `/` and looks the token up. The map gives O(1) amortized reads and writes; base62 keeps the token length logarithmic in the number of URLs (six chars already covers ~56 billion). Note this deliberately does not dedupe identical long URLs — encoding the same URL twice yields two tokens, which matches the problem's contract and avoids a second reverse map. The one caveat versus random keys is that sequential tokens are guessable/enumerable, which is a security consideration a real service would address but the exercise does not.

#### Python
A plain `dict` plus an integer counter; a small base62 helper builds digits least-significant-first then reverses.

```python
class Codec:
    def __init__(self):
        self.url_map = {}
        self.counter = 0
        self.alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        self.base = "http://tinyurl.com/"

    def _to_key(self, n: int) -> str:
        if n == 0:
            return self.alphabet[0]
        digits = []
        while n > 0:
            digits.append(self.alphabet[n % 62])
            n //= 62
        return "".join(reversed(digits))

    def encode(self, longUrl: str) -> str:
        key = self._to_key(self.counter)
        self.counter += 1
        self.url_map[key] = longUrl
        return self.base + key

    def decode(self, shortUrl: str) -> str:
        key = shortUrl.rsplit("/", 1)[-1]
        return self.url_map[key]
```

#### Java
`HashMap<String,String>` for storage; `StringBuilder.reverse()` finishes the base62 conversion.

```java
import java.util.*;

public class Codec {
    private final Map<String, String> urlMap = new HashMap<>();
    private int counter = 0;
    private static final String ALPHABET =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final String BASE = "http://tinyurl.com/";

    private String toKey(int n) {
        if (n == 0) return String.valueOf(ALPHABET.charAt(0));
        StringBuilder sb = new StringBuilder();
        while (n > 0) {
            sb.append(ALPHABET.charAt(n % 62));
            n /= 62;
        }
        return sb.reverse().toString();
    }

    public String encode(String longUrl) {
        String key = toKey(counter++);
        urlMap.put(key, longUrl);
        return BASE + key;
    }

    public String decode(String shortUrl) {
        String key = shortUrl.substring(shortUrl.lastIndexOf('/') + 1);
        return urlMap.get(key);
    }
}
```

#### Rust
Std has no RNG, so a `u64` counter is the natural (and collision-free) choice; build the key into a `Vec<u8>` and hand it to `String::from_utf8`.

```rust
use std::collections::HashMap;

struct Codec {
    url_map: HashMap<String, String>,
    counter: u64,
}

impl Codec {
    fn new() -> Self {
        Codec { url_map: HashMap::new(), counter: 0 }
    }

    fn to_key(mut n: u64) -> String {
        const ALPHABET: &[u8] =
            b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        if n == 0 {
            return (ALPHABET[0] as char).to_string();
        }
        let mut digits = Vec::new();
        while n > 0 {
            digits.push(ALPHABET[(n % 62) as usize]);
            n /= 62;
        }
        digits.reverse();
        String::from_utf8(digits).unwrap()
    }

    fn encode(&mut self, long_url: String) -> String {
        let key = Self::to_key(self.counter);
        self.counter += 1;
        self.url_map.insert(key.clone(), long_url);
        format!("http://tinyurl.com/{}", key)
    }

    fn decode(&self, short_url: String) -> String {
        let key = short_url.rsplit('/').next().unwrap();
        self.url_map.get(key).cloned().unwrap()
    }
}
```

#### Go
A `map[string]string` plus an int counter; `strings.LastIndex` isolates the token on decode.

```go
type Codec struct {
    urlMap  map[string]string
    counter int
}

func Constructor() Codec {
    return Codec{urlMap: make(map[string]string), counter: 0}
}

const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const base = "http://tinyurl.com/"

func toKey(n int) string {
    if n == 0 {
        return string(alphabet[0])
    }
    var digits []byte
    for n > 0 {
        digits = append(digits, alphabet[n%62])
        n /= 62
    }
    for i, j := 0, len(digits)-1; i < j; i, j = i+1, j-1 {
        digits[i], digits[j] = digits[j], digits[i]
    }
    return string(digits)
}

func (c *Codec) encode(longUrl string) string {
    key := toKey(c.counter)
    c.counter++
    c.urlMap[key] = longUrl
    return base + key
}

func (c *Codec) decode(shortUrl string) string {
    idx := strings.LastIndex(shortUrl, "/")
    return c.urlMap[shortUrl[idx+1:]]
}
```

#### C++
`std::unordered_map` for O(1) lookup; reverse the accumulated digits with a reverse-iterator range constructor.

```cpp
#include <string>
#include <unordered_map>

class Codec {
    std::unordered_map<std::string, std::string> urlMap;
    int counter = 0;
    const std::string alphabet =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const std::string base = "http://tinyurl.com/";

    std::string toKey(int n) {
        if (n == 0) return std::string(1, alphabet[0]);
        std::string key;
        while (n > 0) {
            key += alphabet[n % 62];
            n /= 62;
        }
        return std::string(key.rbegin(), key.rend());
    }

public:
    std::string encode(std::string longUrl) {
        std::string key = toKey(counter++);
        urlMap[key] = longUrl;
        return base + key;
    }

    std::string decode(std::string shortUrl) {
        std::string key = shortUrl.substr(shortUrl.find_last_of('/') + 1);
        return urlMap[key];
    }
};
```

### 39. Design Search Autocomplete System

#### Problem
Design `AutocompleteSystem(sentences, times)` seeded with historical sentences and their frequencies. `input(c)` streams the user's typing one character at a time: for a normal character, append it to the current query and return the top 3 historical sentences that start with the query so far; for the special end character `#`, record the fully typed sentence (frequency +1), reset the query, and return an empty list. Ranking is by frequency descending, breaking ties by ASCII order ascending.

#### Pattern
**Frequency map + prefix filter with a top-3 partial sort.** **O(k)** to select per keystroke where k is the number of stored sentences, **O(total text)** space. A trie can lower the prefix cost but the map is simpler and fast enough here.

#### Explanation
Two pieces of state carry everything: a `sentence -> frequency` map and the query buffer built up across keystrokes. On `#` you commit — bump the buffer's frequency (creating it if new) and clear the buffer — returning nothing. On any other character you extend the buffer, then collect every stored sentence whose prefix matches and pick the best three.

The ranking comparator is the subtle part: primary key is frequency *descending*, secondary key is the sentence itself *ascending* by raw ASCII (so uppercase sorts before lowercase, and space before letters). Getting the tie-break direction wrong is the classic bug. Sorting all matches is O(k log k); since we only need three, a partial selection is asymptotically better, but for the constraint sizes a full sort of the matched subset is clean and plenty fast. The trie alternative stores, at each node, a running set of the hottest completions so a keystroke is just a walk down one edge — worth it when the corpus is huge, but it trades a lot of code for that.

#### Python
A `defaultdict(int)` for counts; sort matches by the tuple `(-count, sentence)` to get frequency-desc then ASCII-asc in one key.

```python
from collections import defaultdict

class AutocompleteSystem:
    def __init__(self, sentences: list[str], times: list[int]):
        self.counts = defaultdict(int)
        for s, t in zip(sentences, times):
            self.counts[s] += t
        self.prefix = ""

    def input(self, c: str) -> list[str]:
        if c == '#':
            self.counts[self.prefix] += 1
            self.prefix = ""
            return []
        self.prefix += c
        matches = [s for s in self.counts if s.startswith(self.prefix)]
        matches.sort(key=lambda s: (-self.counts[s], s))
        return matches[:3]
```

#### Java
`HashMap.merge` accumulates seed frequencies; a custom comparator does frequency-desc then `compareTo` for the tie-break.

```java
import java.util.*;

public class AutocompleteSystem {
    private final Map<String, Integer> counts = new HashMap<>();
    private final StringBuilder prefix = new StringBuilder();

    public AutocompleteSystem(String[] sentences, int[] times) {
        for (int i = 0; i < sentences.length; i++) {
            counts.merge(sentences[i], times[i], Integer::sum);
        }
    }

    public List<String> input(char c) {
        if (c == '#') {
            counts.merge(prefix.toString(), 1, Integer::sum);
            prefix.setLength(0);
            return new ArrayList<>();
        }
        prefix.append(c);
        String p = prefix.toString();
        List<String> matches = new ArrayList<>();
        for (String s : counts.keySet()) {
            if (s.startsWith(p)) matches.add(s);
        }
        matches.sort((a, b) -> {
            int ca = counts.get(a), cb = counts.get(b);
            if (ca != cb) return cb - ca;
            return a.compareTo(b);
        });
        return new ArrayList<>(matches.subList(0, Math.min(3, matches.size())));
    }
}
```

#### Rust
Collect matching `(&String, count)` pairs, then `sort_by` with `b.count.cmp(a.count).then(a.name.cmp(b.name))` to encode both keys.

```rust
use std::collections::HashMap;

struct AutocompleteSystem {
    counts: HashMap<String, i32>,
    prefix: String,
}

impl AutocompleteSystem {
    fn new(sentences: Vec<String>, times: Vec<i32>) -> Self {
        let mut counts = HashMap::new();
        for (s, t) in sentences.into_iter().zip(times.into_iter()) {
            *counts.entry(s).or_insert(0) += t;
        }
        AutocompleteSystem { counts, prefix: String::new() }
    }

    fn input(&mut self, c: char) -> Vec<String> {
        if c == '#' {
            *self.counts.entry(self.prefix.clone()).or_insert(0) += 1;
            self.prefix.clear();
            return Vec::new();
        }
        self.prefix.push(c);
        let mut matches: Vec<(&String, i32)> = self
            .counts
            .iter()
            .filter(|(s, _)| s.starts_with(&self.prefix))
            .map(|(s, &cnt)| (s, cnt))
            .collect();
        matches.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
        matches.into_iter().take(3).map(|(s, _)| s.clone()).collect()
    }
}
```

#### Go
`sort.Slice` with a two-level less function; `input` takes a `byte` to match LeetCode's signature.

```go
import "sort"

type AutocompleteSystem struct {
    counts map[string]int
    prefix string
}

func Constructor(sentences []string, times []int) AutocompleteSystem {
    counts := make(map[string]int)
    for i, s := range sentences {
        counts[s] += times[i]
    }
    return AutocompleteSystem{counts: counts, prefix: ""}
}

func (a *AutocompleteSystem) Input(c byte) []string {
    if c == '#' {
        a.counts[a.prefix]++
        a.prefix = ""
        return []string{}
    }
    a.prefix += string(c)
    matches := []string{}
    for s := range a.counts {
        if strings.HasPrefix(s, a.prefix) {
            matches = append(matches, s)
        }
    }
    sort.Slice(matches, func(i, j int) bool {
        if a.counts[matches[i]] != a.counts[matches[j]] {
            return a.counts[matches[i]] > a.counts[matches[j]]
        }
        return matches[i] < matches[j]
    })
    if len(matches) > 3 {
        matches = matches[:3]
    }
    return matches
}
```

#### C++
Collect `(count, sentence)` pairs and `std::sort` with count-desc then string-asc; `string::compare` does the prefix test.

```cpp
#include <string>
#include <vector>
#include <unordered_map>
#include <algorithm>

class AutocompleteSystem {
    std::unordered_map<std::string, int> counts;
    std::string prefix;

public:
    AutocompleteSystem(std::vector<std::string>& sentences, std::vector<int>& times) {
        for (size_t i = 0; i < sentences.size(); i++) {
            counts[sentences[i]] += times[i];
        }
    }

    std::vector<std::string> input(char c) {
        if (c == '#') {
            counts[prefix]++;
            prefix.clear();
            return {};
        }
        prefix += c;
        std::vector<std::pair<int, std::string>> matches;
        for (auto& [s, cnt] : counts) {
            if (s.size() >= prefix.size() &&
                s.compare(0, prefix.size(), prefix) == 0) {
                matches.push_back({cnt, s});
            }
        }
        std::sort(matches.begin(), matches.end(),
            [](const auto& a, const auto& b) {
                if (a.first != b.first) return a.first > b.first;
                return a.second < b.second;
            });
        std::vector<std::string> res;
        for (size_t i = 0; i < matches.size() && i < 3; i++) {
            res.push_back(matches[i].second);
        }
        return res;
    }
};
```

### 40. Design Compressed String Iterator

#### Problem
Design `StringIterator(compressedString)` over a run-length encoded string like `"L1e2t1"`, where each letter is followed by its repeat count (counts may be multi-digit). `next()` returns the next uncompressed character, or a space `' '` if the string is exhausted; `hasNext()` reports whether any characters remain. The point is to expand lazily — never materialize the full decompressed string.

#### Pattern
**Lazy two-cursor run-length decoder.** **O(1)** amortized per `next`/`hasNext`, **O(1)** extra space beyond the input. Hold the current character and a remaining-count, refilling only when the count hits zero.

#### Explanation
Never expand the string; instead keep three pieces of state: a parse pointer into the compressed input, the current character, and how many copies of it are still owed. `next()` first checks `hasNext()` and bails with a space if empty. If the owed count is zero it parses the next run — read one letter, then read the following run of digits into an integer (this is where multi-digit counts matter). Then it decrements the count and returns the character.

`hasNext()` is true when either the parse pointer hasn't reached the end (more runs to parse) or the current run still owes copies. This lazy scheme means the memory footprint is O(1) regardless of how large the counts are — a run of a billion characters costs nothing until you actually call `next()` a billion times. The two edge cases to respect are exhaustion (return the space sentinel, don't over-read) and multi-digit counts (accumulate digits with `num = num*10 + digit`, don't stop at the first digit). Because counts can reach ~10^9, keep the counter in a type that comfortably holds that.

#### Python
`str.isdigit` drives the digit loop; the `(ptr, ch, count)` triple is the whole state machine.

```python
class StringIterator:
    def __init__(self, compressedString: str):
        self.s = compressedString
        self.ptr = 0
        self.ch = ' '
        self.count = 0

    def next(self) -> str:
        if not self.hasNext():
            return ' '
        if self.count == 0:
            self.ch = self.s[self.ptr]
            self.ptr += 1
            num = 0
            while self.ptr < len(self.s) and self.s[self.ptr].isdigit():
                num = num * 10 + int(self.s[self.ptr])
                self.ptr += 1
            self.count = num
        self.count -= 1
        return self.ch

    def hasNext(self) -> bool:
        return self.ptr < len(self.s) or self.count > 0
```

#### Java
`Character.isDigit` plus `charAt('0')` subtraction parses the count in place; `int` holds counts up to ~10^9 safely.

```java
public class StringIterator {
    private final String s;
    private int ptr = 0;
    private char ch = ' ';
    private int count = 0;

    public StringIterator(String compressedString) {
        this.s = compressedString;
    }

    public char next() {
        if (!hasNext()) return ' ';
        if (count == 0) {
            ch = s.charAt(ptr++);
            int num = 0;
            while (ptr < s.length() && Character.isDigit(s.charAt(ptr))) {
                num = num * 10 + (s.charAt(ptr) - '0');
                ptr++;
            }
            count = num;
        }
        count--;
        return ch;
    }

    public boolean hasNext() {
        return ptr < s.length() || count > 0;
    }
}
```

#### Rust
Iterate over the input's bytes with `is_ascii_digit`; a `u32` count comfortably covers the constraint range.

```rust
struct StringIterator {
    s: Vec<u8>,
    ptr: usize,
    ch: char,
    count: u32,
}

impl StringIterator {
    fn new(compressed_string: String) -> Self {
        StringIterator {
            s: compressed_string.into_bytes(),
            ptr: 0,
            ch: ' ',
            count: 0,
        }
    }

    fn next(&mut self) -> char {
        if !self.has_next() {
            return ' ';
        }
        if self.count == 0 {
            self.ch = self.s[self.ptr] as char;
            self.ptr += 1;
            let mut num = 0u32;
            while self.ptr < self.s.len() && self.s[self.ptr].is_ascii_digit() {
                num = num * 10 + (self.s[self.ptr] - b'0') as u32;
                self.ptr += 1;
            }
            self.count = num;
        }
        self.count -= 1;
        self.ch
    }

    fn has_next(&self) -> bool {
        self.ptr < self.s.len() || self.count > 0
    }
}
```

#### Go
Index the string as bytes and test the `'0'..'9'` range directly; `Next`/`HasNext` are exported per LeetCode's Go convention.

```go
type StringIterator struct {
    s     string
    ptr   int
    ch    byte
    count int
}

func Constructor(compressedString string) StringIterator {
    return StringIterator{s: compressedString, ptr: 0, ch: ' ', count: 0}
}

func (it *StringIterator) Next() byte {
    if !it.HasNext() {
        return ' '
    }
    if it.count == 0 {
        it.ch = it.s[it.ptr]
        it.ptr++
        num := 0
        for it.ptr < len(it.s) && it.s[it.ptr] >= '0' && it.s[it.ptr] <= '9' {
            num = num*10 + int(it.s[it.ptr]-'0')
            it.ptr++
        }
        it.count = num
    }
    it.count--
    return it.ch
}

func (it *StringIterator) HasNext() bool {
    return it.ptr < len(it.s) || it.count > 0
}
```

#### C++
`std::isdigit` (cast to `unsigned char`) guards the digit loop; a `long` count avoids any overflow worry.

```cpp
#include <string>
#include <cctype>

class StringIterator {
    std::string s;
    size_t ptr = 0;
    char ch = ' ';
    long count = 0;

public:
    StringIterator(std::string compressedString) : s(compressedString) {}

    char next() {
        if (!hasNext()) return ' ';
        if (count == 0) {
            ch = s[ptr++];
            long num = 0;
            while (ptr < s.size() && std::isdigit((unsigned char)s[ptr])) {
                num = num * 10 + (s[ptr] - '0');
                ptr++;
            }
            count = num;
        }
        count--;
        return ch;
    }

    bool hasNext() {
        return ptr < s.size() || count > 0;
    }
};
```

### 41. Design In-Memory File System

#### Problem
Design a `FileSystem` supporting four operations on absolute paths. `ls(path)`: if the path is a file, return a list with just that file's name; if a directory, return its immediate children (files and dirs) sorted lexicographically. `mkdir(path)`: create a directory, making any missing parent directories along the way. `addContentToFile(filePath, content)`: create the file if absent, then append the content. `readContentFromFile(filePath)`: return the file's full content.

#### Pattern
**Trie of path components (directory tree).** **O(p)** per op to walk p path segments (plus O(k log k) or free-sorted listing for `ls`), **O(total content + paths)** space. Each node is a directory-or-file with a sorted child map.

#### Explanation
Model the filesystem as a tree where each node holds a map from child name to child node, an `is_file` flag, and (for files) accumulated content. Every operation splits the path on `/` and walks segment by segment, creating nodes on the way when the operation is a `mkdir` or a file write. Keeping the children in a *sorted* map (red-black tree / `TreeMap` / `BTreeMap` / `std::map`) makes `ls` return names in order for free — no sort call needed.

The one branch worth care is `ls` on a file versus a directory: after walking to the target node, if it is a file you return just the trailing path component, otherwise you return the child keys. `addContentToFile` sets `is_file` and appends (append, not overwrite — repeated calls concatenate). `mkdir` is simply the walk-and-create with no terminal flag. Because directories and files share the node type, `mkdir`-ing intermediate directories is automatic: the walk's `get-or-create` step builds every missing parent. The root path `"/"` is the empty-segment edge case — treat it as the tree root directly rather than splitting it into a phantom empty component.

#### Python
`dict.setdefault` gives the get-or-create walk in one line; `sorted(keys)` orders directory listings since a plain dict isn't sorted.

```python
class Node:
    def __init__(self):
        self.children = {}
        self.is_file = False
        self.content = ""

class FileSystem:
    def __init__(self):
        self.root = Node()

    def _traverse(self, path: str) -> Node:
        node = self.root
        if path == "/":
            return node
        for part in path.split("/")[1:]:
            node = node.children.setdefault(part, Node())
        return node

    def ls(self, path: str) -> list[str]:
        node = self._traverse(path)
        if node.is_file:
            return [path.split("/")[-1]]
        return sorted(node.children.keys())

    def mkdir(self, path: str) -> None:
        self._traverse(path)

    def addContentToFile(self, filePath: str, content: str) -> None:
        node = self._traverse(filePath)
        node.is_file = True
        node.content += content

    def readContentFromFile(self, filePath: str) -> str:
        return self._traverse(filePath).content
```

#### Java
`TreeMap` children keep listings sorted automatically; `computeIfAbsent` is the get-or-create step.

```java
import java.util.*;

public class FileSystem {
    private static class Node {
        TreeMap<String, Node> children = new TreeMap<>();
        boolean isFile = false;
        StringBuilder content = new StringBuilder();
    }

    private final Node root = new Node();

    private Node traverse(String path) {
        Node node = root;
        if (path.equals("/")) return node;
        for (String part : path.substring(1).split("/")) {
            node = node.children.computeIfAbsent(part, k -> new Node());
        }
        return node;
    }

    public List<String> ls(String path) {
        Node node = traverse(path);
        if (node.isFile) {
            String[] parts = path.split("/");
            return new ArrayList<>(List.of(parts[parts.length - 1]));
        }
        return new ArrayList<>(node.children.keySet());
    }

    public void mkdir(String path) {
        traverse(path);
    }

    public void addContentToFile(String filePath, String content) {
        Node node = traverse(filePath);
        node.isFile = true;
        node.content.append(content);
    }

    public String readContentFromFile(String filePath) {
        return traverse(filePath).content.toString();
    }
}
```

#### Rust
`BTreeMap` children give sorted `ls` for free; `entry(..).or_default()` reborrows the mutable node down the walk, and a `&mut Node -> &mut Node` associated fn keeps the borrow checker happy.

```rust
use std::collections::BTreeMap;

#[derive(Default)]
struct Node {
    children: BTreeMap<String, Node>,
    is_file: bool,
    content: String,
}

struct FileSystem {
    root: Node,
}

impl FileSystem {
    fn new() -> Self {
        FileSystem { root: Node::default() }
    }

    fn traverse<'a>(root: &'a mut Node, path: &str) -> &'a mut Node {
        let mut node = root;
        if path == "/" {
            return node;
        }
        for part in path[1..].split('/') {
            node = node.children.entry(part.to_string()).or_default();
        }
        node
    }

    fn ls(&mut self, path: String) -> Vec<String> {
        let node = Self::traverse(&mut self.root, &path);
        if node.is_file {
            let name = path.rsplit('/').next().unwrap().to_string();
            return vec![name];
        }
        node.children.keys().cloned().collect()
    }

    fn mkdir(&mut self, path: String) {
        Self::traverse(&mut self.root, &path);
    }

    fn add_content_to_file(&mut self, file_path: String, content: String) {
        let node = Self::traverse(&mut self.root, &file_path);
        node.is_file = true;
        node.content.push_str(&content);
    }

    fn read_content_from_file(&mut self, file_path: String) -> String {
        Self::traverse(&mut self.root, &file_path).content.clone()
    }
}
```

#### Go
A pointer-based node tree; `strings.Split` segments the path and `sort.Strings` orders `ls` output since Go maps are unordered.

```go
import (
    "sort"
    "strings"
)

type Node struct {
    children map[string]*Node
    isFile   bool
    content  string
}

func newNode() *Node {
    return &Node{children: make(map[string]*Node)}
}

type FileSystem struct {
    root *Node
}

func Constructor() FileSystem {
    return FileSystem{root: newNode()}
}

func (fs *FileSystem) traverse(path string) *Node {
    node := fs.root
    if path == "/" {
        return node
    }
    for _, part := range strings.Split(path[1:], "/") {
        if node.children[part] == nil {
            node.children[part] = newNode()
        }
        node = node.children[part]
    }
    return node
}

func (fs *FileSystem) Ls(path string) []string {
    node := fs.traverse(path)
    if node.isFile {
        parts := strings.Split(path, "/")
        return []string{parts[len(parts)-1]}
    }
    names := []string{}
    for name := range node.children {
        names = append(names, name)
    }
    sort.Strings(names)
    return names
}

func (fs *FileSystem) Mkdir(path string) {
    fs.traverse(path)
}

func (fs *FileSystem) AddContentToFile(filePath string, content string) {
    node := fs.traverse(filePath)
    node.isFile = true
    node.content += content
}

func (fs *FileSystem) ReadContentFromFile(filePath string) string {
    return fs.traverse(filePath).content
}
```

#### C++
`std::map` children iterate in sorted order, so `ls` needs no explicit sort; `std::getline` on a `stringstream` splits the path.

```cpp
#include <string>
#include <vector>
#include <map>
#include <sstream>

class FileSystem {
    struct Node {
        std::map<std::string, Node*> children;
        bool isFile = false;
        std::string content;
    };
    Node* root;

    Node* traverse(const std::string& path) {
        Node* node = root;
        if (path == "/") return node;
        std::stringstream ss(path.substr(1));
        std::string part;
        while (std::getline(ss, part, '/')) {
            if (node->children.find(part) == node->children.end()) {
                node->children[part] = new Node();
            }
            node = node->children[part];
        }
        return node;
    }

public:
    FileSystem() { root = new Node(); }

    std::vector<std::string> ls(std::string path) {
        Node* node = traverse(path);
        if (node->isFile) {
            size_t pos = path.find_last_of('/');
            return { path.substr(pos + 1) };
        }
        std::vector<std::string> res;
        for (auto& [name, child] : node->children) {
            res.push_back(name);
        }
        return res;
    }

    void mkdir(std::string path) {
        traverse(path);
    }

    void addContentToFile(std::string filePath, std::string content) {
        Node* node = traverse(filePath);
        node->isFile = true;
        node->content += content;
    }

    std::string readContentFromFile(std::string filePath) {
        return traverse(filePath)->content;
    }
};
```

### 42. Serialize and Deserialize Binary Tree

#### Problem
Design a `Codec` that converts a binary tree to a string and back. `serialize(root)` returns a string encoding the tree (including its shape), and `deserialize(data)` rebuilds an identical tree such that the round trip preserves structure and values. Assume the standard `TreeNode` type with `val`, `left`, `right`. Both directions should be O(n) in the number of nodes.

#### Pattern
**Preorder DFS with explicit null markers.** **O(n)** time both ways, **O(n)** output size and recursion depth. Serializing the null children is what makes the shape recoverable from preorder alone.

#### Explanation
A single traversal order (preorder here) is ambiguous *unless* you also record where subtrees end — the standard fix is to emit a sentinel (e.g. `#`) for every null child. With nulls present, preorder becomes a complete description: the first token is the root, and the rest of the stream splits deterministically into the fully-serialized left subtree followed by the right, because each recursive call consumes exactly its own subtree before returning.

Deserialization mirrors that exactly: walk the tokens with a single advancing cursor; a `#` yields null, otherwise create a node and recursively build its left then right children from the next tokens. The cursor is the shared state that keeps the two recursions aligned. This is O(n) since each node and each null marker is produced and consumed once. Watch the token count: an n-node tree emits n values plus n+1 null markers, so the stream is ~2n+1 tokens — comma-joining and splitting handles arbitrary integer values (including negatives) cleanly. The main trap is letting `split` drop a trailing empty token; consuming tokens by a strict advancing index rather than by count sidesteps it.

#### Python
A closure over an iterator (`next(vals)`) advances the cursor implicitly during the rebuild; `#` marks nulls.

```python
class Codec:
    def serialize(self, root: 'TreeNode') -> str:
        vals = []
        def dfs(node):
            if not node:
                vals.append("#")
                return
            vals.append(str(node.val))
            dfs(node.left)
            dfs(node.right)
        dfs(root)
        return ",".join(vals)

    def deserialize(self, data: str) -> 'TreeNode':
        vals = iter(data.split(","))
        def build():
            v = next(vals)
            if v == "#":
                return None
            node = TreeNode(int(v))
            node.left = build()
            node.right = build()
            return node
        return build()
```

#### Java
An `ArrayDeque` used as a FIFO of tokens acts as the shared cursor; `poll` advances it during rebuild.

```java
import java.util.*;

public class Codec {
    public String serialize(TreeNode root) {
        StringBuilder sb = new StringBuilder();
        dfsSerialize(root, sb);
        return sb.toString();
    }

    private void dfsSerialize(TreeNode node, StringBuilder sb) {
        if (node == null) {
            sb.append("#,");
            return;
        }
        sb.append(node.val).append(',');
        dfsSerialize(node.left, sb);
        dfsSerialize(node.right, sb);
    }

    public TreeNode deserialize(String data) {
        Deque<String> nodes = new ArrayDeque<>(Arrays.asList(data.split(",")));
        return build(nodes);
    }

    private TreeNode build(Deque<String> nodes) {
        String v = nodes.poll();
        if (v.equals("#")) return null;
        TreeNode node = new TreeNode(Integer.parseInt(v));
        node.left = build(nodes);
        node.right = build(nodes);
        return node;
    }
}
```

#### Rust
`Rc<RefCell<TreeNode>>` matches LeetCode's node type; a `&mut usize` index threads the cursor through the recursive build.

```rust
use std::rc::Rc;
use std::cell::RefCell;

struct Codec;

impl Codec {
    fn new() -> Self {
        Codec
    }

    fn serialize(&self, root: Option<Rc<RefCell<TreeNode>>>) -> String {
        let mut out = String::new();
        Self::ser(&root, &mut out);
        out
    }

    fn ser(node: &Option<Rc<RefCell<TreeNode>>>, out: &mut String) {
        match node {
            None => out.push_str("#,"),
            Some(n) => {
                let n = n.borrow();
                out.push_str(&n.val.to_string());
                out.push(',');
                Self::ser(&n.left, out);
                Self::ser(&n.right, out);
            }
        }
    }

    fn deserialize(&self, data: String) -> Option<Rc<RefCell<TreeNode>>> {
        let tokens: Vec<&str> = data.split(',').collect();
        let mut idx = 0;
        Self::build(&tokens, &mut idx)
    }

    fn build(tokens: &[&str], idx: &mut usize) -> Option<Rc<RefCell<TreeNode>>> {
        let v = tokens[*idx];
        *idx += 1;
        if v == "#" || v.is_empty() {
            return None;
        }
        let node = Rc::new(RefCell::new(TreeNode::new(v.parse().unwrap())));
        node.borrow_mut().left = Self::build(tokens, idx);
        node.borrow_mut().right = Self::build(tokens, idx);
        Some(node)
    }
}
```

#### Go
A closure capturing an `idx` counter advances the token cursor; `strings.Builder` accumulates the preorder stream.

```go
import (
    "strconv"
    "strings"
)

type Codec struct{}

func Constructor() Codec {
    return Codec{}
}

func (c *Codec) serialize(root *TreeNode) string {
    var sb strings.Builder
    var dfs func(node *TreeNode)
    dfs = func(node *TreeNode) {
        if node == nil {
            sb.WriteString("#,")
            return
        }
        sb.WriteString(strconv.Itoa(node.Val))
        sb.WriteByte(',')
        dfs(node.Left)
        dfs(node.Right)
    }
    dfs(root)
    return sb.String()
}

func (c *Codec) deserialize(data string) *TreeNode {
    tokens := strings.Split(data, ",")
    idx := 0
    var build func() *TreeNode
    build = func() *TreeNode {
        v := tokens[idx]
        idx++
        if v == "#" || v == "" {
            return nil
        }
        val, _ := strconv.Atoi(v)
        node := &TreeNode{Val: val}
        node.Left = build()
        node.Right = build()
        return node
    }
    return build()
}
```

#### C++
An `istringstream` with `getline(ss, tok, ',')` streams tokens in order, doubling as the shared cursor across recursion.

```cpp
#include <string>
#include <sstream>

class Codec {
public:
    std::string serialize(TreeNode* root) {
        std::string out;
        ser(root, out);
        return out;
    }

    TreeNode* deserialize(std::string data) {
        std::istringstream ss(data);
        return build(ss);
    }

private:
    void ser(TreeNode* node, std::string& out) {
        if (!node) {
            out += "#,";
            return;
        }
        out += std::to_string(node->val);
        out += ',';
        ser(node->left, out);
        ser(node->right, out);
    }

    TreeNode* build(std::istringstream& ss) {
        std::string v;
        std::getline(ss, v, ',');
        if (v == "#") return nullptr;
        TreeNode* node = new TreeNode(std::stoi(v));
        node->left = build(ss);
        node->right = build(ss);
        return node;
    }
};
```

### 43. Serialize and Deserialize BST

#### Problem
Implement a `Codec` with `serialize(root)` returning a string encoding of a binary search tree, and `deserialize(data)` rebuilding the exact tree from that string. The encoding should be as compact as reasonable and the round trip must reproduce the same structure. Aim for O(n) time in both directions.

#### Pattern
**Preorder traversal + BST bounds reconstruction.** **O(n)** time both ways, **O(n)** space. No null markers are needed because BST ordering makes the shape recoverable.

#### Explanation
A general binary tree needs explicit null markers to serialize, but a BST does not: a preorder sequence uniquely determines a BST. That is the whole trick. During deserialize you walk the preorder list left to right, and each node's valid value range is bounded by its ancestors. When the next value falls outside the current `(low, high)` window it belongs to some ancestor's right subtree, so you return null and let the recursion unwind.

The invariant is that `build(low, high)` consumes exactly the prefix of the remaining values that fit strictly inside that open interval. The shared cursor index advances only when a value is actually placed, which keeps the whole reconstruction O(n) with no scanning or searching. Use a wide bound type (64-bit or infinities) so node values at the integer extremes still pass the range check. The only real edge case is the empty tree, which serializes to an empty string.

#### Python
Shared cursor as an instance attribute; `float('-inf')`/`float('inf')` as the initial bounds avoids overflow concerns entirely.

```python
class Codec:
    def serialize(self, root: 'TreeNode') -> str:
        vals = []
        def pre(node):
            if not node:
                return
            vals.append(str(node.val))
            pre(node.left)
            pre(node.right)
        pre(root)
        return ' '.join(vals)

    def deserialize(self, data: str) -> 'TreeNode':
        if not data:
            return None
        vals = [int(x) for x in data.split()]
        self.idx = 0
        def build(low, high):
            if self.idx == len(vals):
                return None
            v = vals[self.idx]
            if v < low or v > high:
                return None
            self.idx += 1
            node = TreeNode(v)
            node.left = build(low, v)
            node.right = build(v, high)
            return node
        return build(float('-inf'), float('inf'))
```

#### Java
`long` bounds sidestep `Integer.MIN_VALUE`/`MAX_VALUE` edge cases; a single field cursor threads the recursion.

```java
public class Codec {
    private int idx;
    private int[] vals;

    public String serialize(TreeNode root) {
        StringBuilder sb = new StringBuilder();
        pre(root, sb);
        return sb.toString().trim();
    }

    private void pre(TreeNode node, StringBuilder sb) {
        if (node == null) return;
        sb.append(node.val).append(' ');
        pre(node.left, sb);
        pre(node.right, sb);
    }

    public TreeNode deserialize(String data) {
        if (data == null || data.isEmpty()) return null;
        String[] parts = data.split(" ");
        vals = new int[parts.length];
        for (int i = 0; i < parts.length; i++) vals[i] = Integer.parseInt(parts[i]);
        idx = 0;
        return build(Long.MIN_VALUE, Long.MAX_VALUE);
    }

    private TreeNode build(long low, long high) {
        if (idx == vals.length) return null;
        int v = vals[idx];
        if (v < low || v > high) return null;
        idx++;
        TreeNode node = new TreeNode(v);
        node.left = build(low, v);
        node.right = build(v, high);
        return node;
    }
}
```

#### Rust
A `&mut usize` cursor is passed down explicitly; bounds widen to `i64` so `i32` extremes compare correctly.

```rust
use std::rc::Rc;
use std::cell::RefCell;

type Link = Option<Rc<RefCell<TreeNode>>>;

struct Codec {}

impl Codec {
    fn new() -> Self {
        Codec {}
    }

    fn serialize(&self, root: Link) -> String {
        let mut vals = Vec::new();
        Self::pre(&root, &mut vals);
        vals.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(" ")
    }

    fn pre(node: &Link, vals: &mut Vec<i32>) {
        if let Some(n) = node {
            let n = n.borrow();
            vals.push(n.val);
            Self::pre(&n.left, vals);
            Self::pre(&n.right, vals);
        }
    }

    fn deserialize(&self, data: String) -> Link {
        if data.is_empty() {
            return None;
        }
        let vals: Vec<i32> = data.split_whitespace().map(|x| x.parse().unwrap()).collect();
        let mut idx = 0;
        Self::build(&vals, &mut idx, i64::MIN, i64::MAX)
    }

    fn build(vals: &[i32], idx: &mut usize, low: i64, high: i64) -> Link {
        if *idx == vals.len() {
            return None;
        }
        let v = vals[*idx] as i64;
        if v < low || v > high {
            return None;
        }
        *idx += 1;
        let node = Rc::new(RefCell::new(TreeNode::new(v as i32)));
        node.borrow_mut().left = Self::build(vals, idx, low, v);
        node.borrow_mut().right = Self::build(vals, idx, v, high);
        Some(node)
    }
}
```

#### Go
`strings.Fields` tokenizes on any whitespace; a captured `idx` closure variable serves as the shared cursor.

```go
type Codec struct {
}

func Constructor() Codec {
	return Codec{}
}

func (c *Codec) serialize(root *TreeNode) string {
	var vals []string
	var pre func(node *TreeNode)
	pre = func(node *TreeNode) {
		if node == nil {
			return
		}
		vals = append(vals, strconv.Itoa(node.Val))
		pre(node.Left)
		pre(node.Right)
	}
	pre(root)
	return strings.Join(vals, " ")
}

func (c *Codec) deserialize(data string) *TreeNode {
	if data == "" {
		return nil
	}
	parts := strings.Fields(data)
	vals := make([]int, len(parts))
	for i, p := range parts {
		vals[i], _ = strconv.Atoi(p)
	}
	idx := 0
	var build func(low, high int) *TreeNode
	build = func(low, high int) *TreeNode {
		if idx == len(vals) {
			return nil
		}
		v := vals[idx]
		if v < low || v > high {
			return nil
		}
		idx++
		node := &TreeNode{Val: v}
		node.Left = build(low, v)
		node.Right = build(v, high)
		return node
	}
	return build(math.MinInt, math.MaxInt)
}
```

#### C++
A `stringstream` parses ints back cheaply; recursive lambdas via `std::function` capture the shared `idx` by reference.

```cpp
class Codec {
public:
    string serialize(TreeNode* root) {
        string out;
        function<void(TreeNode*)> pre = [&](TreeNode* node) {
            if (!node) return;
            out += to_string(node->val);
            out += ' ';
            pre(node->left);
            pre(node->right);
        };
        pre(root);
        return out;
    }

    TreeNode* deserialize(string data) {
        if (data.empty()) return nullptr;
        vector<int> vals;
        stringstream ss(data);
        int x;
        while (ss >> x) vals.push_back(x);
        int idx = 0;
        function<TreeNode*(long, long)> build = [&](long low, long high) -> TreeNode* {
            if (idx == (int)vals.size()) return nullptr;
            long v = vals[idx];
            if (v < low || v > high) return nullptr;
            idx++;
            TreeNode* node = new TreeNode((int)v);
            node->left = build(low, v);
            node->right = build(v, high);
            return node;
        };
        return build(LONG_MIN, LONG_MAX);
    }
};
```

### 44. Serialize and Deserialize N-ary Tree

#### Problem
Implement a `Codec` for an N-ary tree, where each `Node` holds an `int val` and a list of child `Node`s. `serialize(root)` returns a string, and `deserialize(data)` rebuilds the identical tree. Because nodes can have any number of children, the encoding must record each node's child count. Target O(n) time.

#### Pattern
**Preorder with explicit child-count prefix.** **O(n)** time both ways, **O(n)** space. Encoding `val count child... child...` makes the recursion fully self-delimiting.

#### Explanation
The core problem versus a binary tree is that arity varies, so you cannot rely on a fixed two-slot layout. The clean fix is to serialize each node as its value followed by its child count, then recurse into exactly that many children. On deserialize you read a value, read a count, create the node, and pull that many subtrees recursively. The count acts as an explicit, self-describing frame delimiter, so no separator sentinels or backtracking are needed.

The invariant: `dec()` consumes exactly one complete subtree from the token stream, leaving the cursor positioned at the next sibling or the end. Since every node writes its own degree, the parser never has to guess where a child list ends. The empty tree is the only special case; it serializes to an empty string and deserializes to null.

#### Python
Interleave value and child count into one flat token list; a per-call recursion with an instance cursor rebuilds it.

```python
class Codec:
    def serialize(self, root: 'Node') -> str:
        vals = []
        def enc(node):
            if not node:
                return
            vals.append(str(node.val))
            vals.append(str(len(node.children)))
            for c in node.children:
                enc(c)
        enc(root)
        return ' '.join(vals)

    def deserialize(self, data: str) -> 'Node':
        if not data:
            return None
        tokens = data.split()
        self.idx = 0
        def dec():
            val = int(tokens[self.idx]); self.idx += 1
            count = int(tokens[self.idx]); self.idx += 1
            node = Node(val, [])
            for _ in range(count):
                node.children.append(dec())
            return node
        return dec()
```

#### Java
A `String[]` token array plus an `idx` field; `node.children` is initialized to an `ArrayList` so children can be appended in order.

```java
class Codec {
    private String[] tokens;
    private int idx;

    public String serialize(Node root) {
        StringBuilder sb = new StringBuilder();
        enc(root, sb);
        return sb.toString().trim();
    }

    private void enc(Node node, StringBuilder sb) {
        if (node == null) return;
        sb.append(node.val).append(' ').append(node.children.size()).append(' ');
        for (Node c : node.children) enc(c, sb);
    }

    public Node deserialize(String data) {
        if (data == null || data.isEmpty()) return null;
        tokens = data.split(" ");
        idx = 0;
        return dec();
    }

    private Node dec() {
        int val = Integer.parseInt(tokens[idx++]);
        int count = Integer.parseInt(tokens[idx++]);
        Node node = new Node(val, new ArrayList<>());
        for (int i = 0; i < count; i++) node.children.add(dec());
        return node;
    }
}
```

#### Rust
Model the N-ary `Node` as `Rc<RefCell<Node>>` with `children: Vec<Rc<RefCell<Node>>>`; the `&mut usize` cursor threads the token slice.

```rust
use std::rc::Rc;
use std::cell::RefCell;

type Link = Option<Rc<RefCell<Node>>>;

struct Codec {}

impl Codec {
    fn new() -> Self {
        Codec {}
    }

    fn serialize(&self, root: Link) -> String {
        let mut vals = Vec::new();
        Self::enc(&root, &mut vals);
        vals.join(" ")
    }

    fn enc(node: &Link, vals: &mut Vec<String>) {
        if let Some(n) = node {
            let n = n.borrow();
            vals.push(n.val.to_string());
            vals.push(n.children.len().to_string());
            for c in &n.children {
                Self::enc(&Some(c.clone()), vals);
            }
        }
    }

    fn deserialize(&self, data: String) -> Link {
        if data.is_empty() {
            return None;
        }
        let tokens: Vec<&str> = data.split_whitespace().collect();
        let mut idx = 0;
        Some(Self::dec(&tokens, &mut idx))
    }

    fn dec(tokens: &[&str], idx: &mut usize) -> Rc<RefCell<Node>> {
        let val: i32 = tokens[*idx].parse().unwrap();
        *idx += 1;
        let count: usize = tokens[*idx].parse().unwrap();
        *idx += 1;
        let node = Rc::new(RefCell::new(Node { val, children: Vec::new() }));
        for _ in 0..count {
            let child = Self::dec(tokens, idx);
            node.borrow_mut().children.push(child);
        }
        node
    }
}
```

#### Go
The N-ary `Node` has `Val int` and `Children []*Node`; a captured `idx` closure variable walks the tokenized fields.

```go
type Codec struct {
}

func Constructor() Codec {
	return Codec{}
}

func (c *Codec) serialize(root *Node) string {
	var vals []string
	var enc func(node *Node)
	enc = func(node *Node) {
		if node == nil {
			return
		}
		vals = append(vals, strconv.Itoa(node.Val))
		vals = append(vals, strconv.Itoa(len(node.Children)))
		for _, ch := range node.Children {
			enc(ch)
		}
	}
	enc(root)
	return strings.Join(vals, " ")
}

func (c *Codec) deserialize(data string) *Node {
	if data == "" {
		return nil
	}
	tokens := strings.Fields(data)
	idx := 0
	var dec func() *Node
	dec = func() *Node {
		val, _ := strconv.Atoi(tokens[idx])
		idx++
		count, _ := strconv.Atoi(tokens[idx])
		idx++
		node := &Node{Val: val}
		for i := 0; i < count; i++ {
			node.Children = append(node.Children, dec())
		}
		return node
	}
	return dec()
}
```

#### C++
A single `stringstream` feeds both the value and count reads; the recursive lambda pushes children directly onto the node's `vector`.

```cpp
class Codec {
public:
    string serialize(Node* root) {
        string out;
        function<void(Node*)> enc = [&](Node* node) {
            if (!node) return;
            out += to_string(node->val) + ' ';
            out += to_string(node->children.size()) + ' ';
            for (Node* c : node->children) enc(c);
        };
        enc(root);
        return out;
    }

    Node* deserialize(string data) {
        if (data.empty()) return nullptr;
        stringstream ss(data);
        function<Node*()> dec = [&]() -> Node* {
            int val, count;
            ss >> val >> count;
            Node* node = new Node(val);
            node->children.resize(0);
            for (int i = 0; i < count; i++) node->children.push_back(dec());
            return node;
        };
        return dec();
    }
};
```

### 45. Find Median from Data Stream

#### Problem
Implement `MedianFinder` supporting `addNum(num)` to insert an integer into a growing data stream and `findMedian()` to return the median of all values seen so far as a double. The median is the middle value for odd counts and the average of the two middle values for even counts. Target O(log n) per insert and O(1) per query.

#### Pattern
**Two balanced heaps (max-heap of the low half, min-heap of the high half).** **O(log n)** insert, **O(1)** median, **O(n)** space. The two roots straddle the median.

#### Explanation
Split the sorted stream into a lower half and an upper half. Keep the lower half in a max-heap so its largest element sits on top, and the upper half in a min-heap so its smallest sits on top. If you maintain the size invariant that the low heap has either the same count as the high heap or exactly one more, then the median is always readable from one or both roots in constant time.

The insertion trick that keeps everything balanced with no branching mess: always push onto the low heap, immediately move its top to the high heap, then if the high heap has grown larger, move its top back. This three-step shuffle guarantees both heaps stay ordered relative to each other and the size invariant holds. For an odd total, the low heap's root is the median; for an even total, average the two roots. The main pitfall is integer overflow when averaging two large roots, so compute in floating point.

#### Python
`heapq` is a min-heap only, so negate values for the low half to fake a max-heap.

```python
import heapq

class MedianFinder:
    def __init__(self):
        self.small = []  # max-heap via negation
        self.large = []  # min-heap

    def addNum(self, num: int) -> None:
        heapq.heappush(self.small, -num)
        heapq.heappush(self.large, -heapq.heappop(self.small))
        if len(self.large) > len(self.small):
            heapq.heappush(self.small, -heapq.heappop(self.large))

    def findMedian(self) -> float:
        if len(self.small) > len(self.large):
            return -self.small[0]
        return (-self.small[0] + self.large[0]) / 2.0
```

#### Java
`PriorityQueue` is a min-heap; pass `Collections.reverseOrder()` to make the low-half a max-heap.

```java
class MedianFinder {
    private PriorityQueue<Integer> small; // max-heap
    private PriorityQueue<Integer> large; // min-heap

    public MedianFinder() {
        small = new PriorityQueue<>(Collections.reverseOrder());
        large = new PriorityQueue<>();
    }

    public void addNum(int num) {
        small.offer(num);
        large.offer(small.poll());
        if (large.size() > small.size()) {
            small.offer(large.poll());
        }
    }

    public double findMedian() {
        if (small.size() > large.size()) {
            return small.peek();
        }
        return (small.peek() + large.peek()) / 2.0;
    }
}
```

#### Rust
`BinaryHeap` is a max-heap; wrap the high half in `Reverse` to get a min-heap.

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

struct MedianFinder {
    small: BinaryHeap<i32>,          // max-heap
    large: BinaryHeap<Reverse<i32>>, // min-heap
}

impl MedianFinder {
    fn new() -> Self {
        MedianFinder { small: BinaryHeap::new(), large: BinaryHeap::new() }
    }

    fn add_num(&mut self, num: i32) {
        self.small.push(num);
        let top = self.small.pop().unwrap();
        self.large.push(Reverse(top));
        if self.large.len() > self.small.len() {
            let Reverse(v) = self.large.pop().unwrap();
            self.small.push(v);
        }
    }

    fn find_median(&self) -> f64 {
        if self.small.len() > self.large.len() {
            *self.small.peek().unwrap() as f64
        } else {
            let s = *self.small.peek().unwrap() as f64;
            let Reverse(l) = self.large.peek().unwrap();
            (s + *l as f64) / 2.0
        }
    }
}
```

#### Go
`container/heap` needs an explicit `heap.Interface`; a single `Heap` type with a `less` comparator field serves as both min- and max-heap.

```go
type Heap struct {
	data []int
	less func(a, b int) bool
}

func (h Heap) Len() int           { return len(h.data) }
func (h Heap) Less(i, j int) bool { return h.less(h.data[i], h.data[j]) }
func (h Heap) Swap(i, j int)      { h.data[i], h.data[j] = h.data[j], h.data[i] }
func (h *Heap) Push(x interface{}) {
	h.data = append(h.data, x.(int))
}
func (h *Heap) Pop() interface{} {
	old := h.data
	n := len(old)
	v := old[n-1]
	h.data = old[:n-1]
	return v
}

type MedianFinder struct {
	small *Heap // max-heap
	large *Heap // min-heap
}

func Constructor() MedianFinder {
	return MedianFinder{
		small: &Heap{less: func(a, b int) bool { return a > b }},
		large: &Heap{less: func(a, b int) bool { return a < b }},
	}
}

func (m *MedianFinder) AddNum(num int) {
	heap.Push(m.small, num)
	heap.Push(m.large, heap.Pop(m.small))
	if m.large.Len() > m.small.Len() {
		heap.Push(m.small, heap.Pop(m.large))
	}
}

func (m *MedianFinder) FindMedian() float64 {
	if m.small.Len() > m.large.Len() {
		return float64(m.small.data[0])
	}
	return float64(m.small.data[0]+m.large.data[0]) / 2.0
}
```

#### C++
`priority_queue` defaults to a max-heap; the min-heap variant uses `greater<int>` as the comparator template argument.

```cpp
class MedianFinder {
    priority_queue<int> small;                             // max-heap
    priority_queue<int, vector<int>, greater<int>> large;  // min-heap
public:
    MedianFinder() {}

    void addNum(int num) {
        small.push(num);
        large.push(small.top());
        small.pop();
        if (large.size() > small.size()) {
            small.push(large.top());
            large.pop();
        }
    }

    double findMedian() {
        if (small.size() > large.size()) {
            return small.top();
        }
        return (small.top() + large.top()) / 2.0;
    }
};
```

### 46. Kth Largest Element in a Stream

#### Problem
Implement `KthLargest` initialized with an integer `k` and an initial array `nums`. The method `add(val)` inserts a value into the stream and returns the k-th largest element seen so far (the k-th largest in sorted order, counting duplicates). Assume there are always at least k elements when `add` returns. Target O(log k) per add.

#### Pattern
**Fixed-size min-heap of the k largest elements.** **O(log k)** per add, **O(k)** space. The heap root is exactly the k-th largest.

#### Explanation
You do not need to keep every element, only the k largest ones. Store them in a min-heap capped at size k. The smallest of those k largest sits at the root, and that root is by definition the k-th largest element in the entire stream. On each add, push the new value and, if the heap now holds more than k elements, pop the minimum, which discards whatever is too small to matter.

This bounds memory at O(k) regardless of stream length and makes every operation O(log k) rather than O(log n). The constructor simply replays the initial array through the same add logic, so there is no special-case seeding code. A value smaller than the current root when the heap is already full gets pushed and immediately popped, correctly leaving the answer unchanged.

#### Python
Reuse `add` inside `__init__` after an initial `heapify`; the root `heap[0]` is the running answer.

```python
from typing import List
import heapq

class KthLargest:
    def __init__(self, k: int, nums: List[int]):
        self.k = k
        self.heap = nums
        heapq.heapify(self.heap)
        while len(self.heap) > k:
            heapq.heappop(self.heap)

    def add(self, val: int) -> int:
        heapq.heappush(self.heap, val)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0]
```

#### Java
A default `PriorityQueue` is already a min-heap; the constructor just funnels `nums` through `add`.

```java
class KthLargest {
    private PriorityQueue<Integer> heap;
    private int k;

    public KthLargest(int k, int[] nums) {
        this.k = k;
        heap = new PriorityQueue<>();
        for (int n : nums) add(n);
    }

    public int add(int val) {
        heap.offer(val);
        if (heap.size() > k) heap.poll();
        return heap.peek();
    }
}
```

#### Rust
`BinaryHeap<Reverse<i32>>` gives a min-heap; `.peek().unwrap().0` unwraps the `Reverse` back to the raw value.

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

struct KthLargest {
    k: usize,
    heap: BinaryHeap<Reverse<i32>>, // min-heap
}

impl KthLargest {
    fn new(k: i32, nums: Vec<i32>) -> Self {
        let mut obj = KthLargest { k: k as usize, heap: BinaryHeap::new() };
        for n in nums {
            obj.add(n);
        }
        obj
    }

    fn add(&mut self, val: i32) -> i32 {
        self.heap.push(Reverse(val));
        if self.heap.len() > self.k {
            self.heap.pop();
        }
        self.heap.peek().unwrap().0
    }
}
```

#### Go
An `IntHeap` with `Less` as `<` is a min-heap; `heap.Init` primes it before the constructor replays `nums`.

```go
type IntHeap []int

func (h IntHeap) Len() int           { return len(h) }
func (h IntHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h IntHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *IntHeap) Push(x interface{}) {
	*h = append(*h, x.(int))
}
func (h *IntHeap) Pop() interface{} {
	old := *h
	n := len(old)
	v := old[n-1]
	*h = old[:n-1]
	return v
}

type KthLargest struct {
	k    int
	heap *IntHeap
}

func Constructor(k int, nums []int) KthLargest {
	h := &IntHeap{}
	heap.Init(h)
	obj := KthLargest{k: k, heap: h}
	for _, n := range nums {
		obj.Add(n)
	}
	return obj
}

func (kl *KthLargest) Add(val int) int {
	heap.Push(kl.heap, val)
	if kl.heap.Len() > kl.k {
		heap.Pop(kl.heap)
	}
	return (*kl.heap)[0]
}
```

#### C++
`priority_queue<int, vector<int>, greater<int>>` is the min-heap form; the constructor delegates to `add` in a member-init list.

```cpp
class KthLargest {
    priority_queue<int, vector<int>, greater<int>> heap; // min-heap
    int k;
public:
    KthLargest(int k, vector<int>& nums) : k(k) {
        for (int n : nums) add(n);
    }

    int add(int val) {
        heap.push(val);
        if ((int)heap.size() > k) heap.pop();
        return heap.top();
    }
};
```

### 47. Stock Price Fluctuation

#### Problem
Implement `StockPrice` tracking a stream of `(timestamp, price)` records that may arrive out of order and may correct earlier timestamps. Support `update(timestamp, price)` to record or overwrite a price, `current()` to return the price at the latest timestamp seen, and `maximum()`/`minimum()` to return the highest/lowest price among all currently-correct records. Target O(log n) per operation.

#### Pattern
**Hash map of timestamp to price plus an ordered multiset of live prices.** **O(log n)** per op, **O(n)** space. Track the latest timestamp separately for `current`.

#### Explanation
Two facts must be queryable fast: the price at the newest timestamp, and the extremes across all live prices. A hash map from timestamp to price answers `current` once you also remember the maximum timestamp seen. The extremes are the hard part because `update` can overwrite an old price, which must be retracted from the extreme structure. A balanced multiset of prices (as a price-to-count map) handles this: on update, decrement the count of the old price at that timestamp and increment the new one, deleting keys that hit zero. Then `maximum`/`minimum` are just the last/first keys.

The multiset-as-counts approach keeps updates and both extreme queries at O(log n). The alternative for languages lacking an ordered map is two lazy-deletion heaps: push `(price, timestamp)` on both, and when querying, discard heap tops whose recorded price no longer matches the current price at that timestamp. Both approaches share the same invariant, that only records matching the authoritative timestamp-to-price map count. The edge cases are the very first update seeding the latest timestamp, and an overwrite that removes the last copy of an extreme price.

#### Python
No ordered map in stdlib, so use two `heapq` heaps with lazy deletion, validating each top against the authoritative `prices` dict.

```python
import heapq

class StockPrice:
    def __init__(self):
        self.prices = {}    # timestamp -> price
        self.latest = 0
        self.max_heap = []  # (-price, timestamp)
        self.min_heap = []  # (price, timestamp)

    def update(self, timestamp: int, price: int) -> None:
        self.prices[timestamp] = price
        self.latest = max(self.latest, timestamp)
        heapq.heappush(self.max_heap, (-price, timestamp))
        heapq.heappush(self.min_heap, (price, timestamp))

    def current(self) -> int:
        return self.prices[self.latest]

    def maximum(self) -> int:
        while True:
            neg_price, ts = self.max_heap[0]
            if -neg_price == self.prices[ts]:
                return -neg_price
            heapq.heappop(self.max_heap)

    def minimum(self) -> int:
        while True:
            price, ts = self.min_heap[0]
            if price == self.prices[ts]:
                return price
            heapq.heappop(self.min_heap)
```

#### Java
`TreeMap<price, count>` is the ordered multiset; `firstKey`/`lastKey` give the extremes in O(log n) after decrementing the overwritten price.

```java
class StockPrice {
    private Map<Integer, Integer> prices;      // timestamp -> price
    private TreeMap<Integer, Integer> counts;  // price -> count
    private int latest;

    public StockPrice() {
        prices = new HashMap<>();
        counts = new TreeMap<>();
        latest = 0;
    }

    public void update(int timestamp, int price) {
        if (prices.containsKey(timestamp)) {
            int old = prices.get(timestamp);
            int c = counts.get(old);
            if (c == 1) counts.remove(old);
            else counts.put(old, c - 1);
        }
        prices.put(timestamp, price);
        counts.merge(price, 1, Integer::sum);
        latest = Math.max(latest, timestamp);
    }

    public int current() {
        return prices.get(latest);
    }

    public int maximum() {
        return counts.lastKey();
    }

    public int minimum() {
        return counts.firstKey();
    }
}
```

#### Rust
`BTreeMap<price, count>` acts as the ordered multiset; `keys().next()` and `keys().next_back()` read the extremes.

```rust
use std::collections::{BTreeMap, HashMap};

struct StockPrice {
    prices: HashMap<i32, i32>,   // timestamp -> price
    counts: BTreeMap<i32, i32>,  // price -> count
    latest: i32,
}

impl StockPrice {
    fn new() -> Self {
        StockPrice { prices: HashMap::new(), counts: BTreeMap::new(), latest: 0 }
    }

    fn update(&mut self, timestamp: i32, price: i32) {
        if let Some(&old) = self.prices.get(&timestamp) {
            if let Some(c) = self.counts.get_mut(&old) {
                *c -= 1;
                if *c == 0 {
                    self.counts.remove(&old);
                }
            }
        }
        self.prices.insert(timestamp, price);
        *self.counts.entry(price).or_insert(0) += 1;
        self.latest = self.latest.max(timestamp);
    }

    fn current(&self) -> i32 {
        self.prices[&self.latest]
    }

    fn maximum(&self) -> i32 {
        *self.counts.keys().next_back().unwrap()
    }

    fn minimum(&self) -> i32 {
        *self.counts.keys().next().unwrap()
    }
}
```

#### Go
No ordered map in stdlib, so mirror the two-heap lazy-deletion approach with a `container/heap` type parameterized by a `less` comparator.

```go
type stockItem struct {
	price int
	ts    int
}

type StockHeap struct {
	data []stockItem
	less func(a, b stockItem) bool
}

func (h StockHeap) Len() int           { return len(h.data) }
func (h StockHeap) Less(i, j int) bool { return h.less(h.data[i], h.data[j]) }
func (h StockHeap) Swap(i, j int)      { h.data[i], h.data[j] = h.data[j], h.data[i] }
func (h *StockHeap) Push(x interface{}) {
	h.data = append(h.data, x.(stockItem))
}
func (h *StockHeap) Pop() interface{} {
	old := h.data
	n := len(old)
	v := old[n-1]
	h.data = old[:n-1]
	return v
}

type StockPrice struct {
	prices  map[int]int
	latest  int
	maxHeap *StockHeap
	minHeap *StockHeap
}

func Constructor() StockPrice {
	return StockPrice{
		prices:  make(map[int]int),
		maxHeap: &StockHeap{less: func(a, b stockItem) bool { return a.price > b.price }},
		minHeap: &StockHeap{less: func(a, b stockItem) bool { return a.price < b.price }},
	}
}

func (s *StockPrice) Update(timestamp int, price int) {
	s.prices[timestamp] = price
	if timestamp > s.latest {
		s.latest = timestamp
	}
	heap.Push(s.maxHeap, stockItem{price, timestamp})
	heap.Push(s.minHeap, stockItem{price, timestamp})
}

func (s *StockPrice) Current() int {
	return s.prices[s.latest]
}

func (s *StockPrice) Maximum() int {
	for {
		top := s.maxHeap.data[0]
		if s.prices[top.ts] == top.price {
			return top.price
		}
		heap.Pop(s.maxHeap)
	}
}

func (s *StockPrice) Minimum() int {
	for {
		top := s.minHeap.data[0]
		if s.prices[top.ts] == top.price {
			return top.price
		}
		heap.Pop(s.minHeap)
	}
}
```

#### C++
`std::map<int,int>` as a price-to-count ordered multiset; `rbegin()`/`begin()` fetch the max/min after erasing zeroed keys.

```cpp
class StockPrice {
    unordered_map<int, int> prices;  // timestamp -> price
    map<int, int> counts;            // price -> count
    int latest = 0;
public:
    StockPrice() {}

    void update(int timestamp, int price) {
        if (prices.count(timestamp)) {
            int old = prices[timestamp];
            if (--counts[old] == 0) counts.erase(old);
        }
        prices[timestamp] = price;
        counts[price]++;
        latest = max(latest, timestamp);
    }

    int current() {
        return prices[latest];
    }

    int maximum() {
        return counts.rbegin()->first;
    }

    int minimum() {
        return counts.begin()->first;
    }
};
```

### 48. Design a Food Rating System

#### Problem
Implement `FoodRatings` initialized with parallel arrays `foods`, `cuisines`, and `ratings`, where each food belongs to exactly one cuisine and has a rating. Support `changeRating(food, newRating)` to update a food's rating, and `highestRated(cuisine)` to return the name of the highest-rated food of that cuisine, breaking ties by lexicographically smallest name. Target O(log n) per operation.

#### Pattern
**Per-cuisine ordered set keyed by (rating desc, name asc), plus lookup maps.** **O(log n)** per op, **O(n)** space. The set's first element is the answer.

#### Explanation
Each `highestRated` query must return the top food of one cuisine under a compound ordering: rating descending, then name ascending. An ordered set per cuisine, keyed on that composite, puts the answer at the front, readable in O(log n) or better. Two side maps record each food's current rating and its cuisine so `changeRating` can locate the right set. The critical detail on update is that the sort key embeds the rating, so you must remove the food's old entry before mutating the stored rating, then re-insert with the new key; mutating in place would corrupt the set's ordering invariant.

For languages with an ordered set that supports keyed removal (Java `TreeSet`, C++ `std::set`, Rust `BTreeSet`), store `(rating, name)` directly and delete-then-reinsert. For Python and Go, which lack a stdlib ordered set, use a per-cuisine heap with lazy deletion: push the new `(rating, name)` on change, and when querying, pop any top whose rating disagrees with the authoritative map. Both share the invariant that only entries matching the current rating map are authoritative. The tie-break by name is baked into the key ordering, so no extra comparison logic is needed at query time.

#### Python
No ordered set in stdlib, so use a per-cuisine `heapq` of `(-rating, name)` with lazy deletion, validating the top against the current rating map.

```python
from typing import List
from collections import defaultdict
import heapq

class FoodRatings:
    def __init__(self, foods: List[str], cuisines: List[str], ratings: List[int]):
        self.food_info = {}             # food -> (rating, cuisine)
        self.heaps = defaultdict(list)  # cuisine -> heap of (-rating, food)
        for f, c, r in zip(foods, cuisines, ratings):
            self.food_info[f] = (r, c)
            heapq.heappush(self.heaps[c], (-r, f))

    def changeRating(self, food: str, newRating: int) -> None:
        _, cuisine = self.food_info[food]
        self.food_info[food] = (newRating, cuisine)
        heapq.heappush(self.heaps[cuisine], (-newRating, food))

    def highestRated(self, cuisine: str) -> str:
        heap = self.heaps[cuisine]
        while True:
            neg_rating, food = heap[0]
            if -neg_rating == self.food_info[food][0]:
                return food
            heapq.heappop(heap)
```

#### Java
A `TreeSet` with a comparator over `(rating desc, name asc)`; remove the food before updating its rating so the set re-sorts correctly.

```java
class FoodRatings {
    private Map<String, Integer> foodRating;
    private Map<String, String> foodCuisine;
    private Map<String, TreeSet<String>> cuisineFoods;

    public FoodRatings(String[] foods, String[] cuisines, int[] ratings) {
        foodRating = new HashMap<>();
        foodCuisine = new HashMap<>();
        cuisineFoods = new HashMap<>();
        for (int i = 0; i < foods.length; i++) {
            foodRating.put(foods[i], ratings[i]);
            foodCuisine.put(foods[i], cuisines[i]);
            cuisineFoods.computeIfAbsent(cuisines[i], k -> new TreeSet<>((a, b) -> {
                int ra = foodRating.get(a), rb = foodRating.get(b);
                if (ra != rb) return rb - ra;
                return a.compareTo(b);
            })).add(foods[i]);
        }
    }

    public void changeRating(String food, int newRating) {
        String cuisine = foodCuisine.get(food);
        TreeSet<String> set = cuisineFoods.get(cuisine);
        set.remove(food);
        foodRating.put(food, newRating);
        set.add(food);
    }

    public String highestRated(String cuisine) {
        return cuisineFoods.get(cuisine).first();
    }
}
```

#### Rust
`BTreeSet<(Reverse<i32>, String)>` bakes the compound ordering into the key; delete the old `(Reverse(old), name)` before inserting the new key.

```rust
use std::collections::{BTreeSet, HashMap};
use std::cmp::Reverse;

struct FoodRatings {
    food_rating: HashMap<String, i32>,
    food_cuisine: HashMap<String, String>,
    cuisine_foods: HashMap<String, BTreeSet<(Reverse<i32>, String)>>,
}

impl FoodRatings {
    fn new(foods: Vec<String>, cuisines: Vec<String>, ratings: Vec<i32>) -> Self {
        let mut food_rating = HashMap::new();
        let mut food_cuisine = HashMap::new();
        let mut cuisine_foods: HashMap<String, BTreeSet<(Reverse<i32>, String)>> = HashMap::new();
        for i in 0..foods.len() {
            food_rating.insert(foods[i].clone(), ratings[i]);
            food_cuisine.insert(foods[i].clone(), cuisines[i].clone());
            cuisine_foods
                .entry(cuisines[i].clone())
                .or_default()
                .insert((Reverse(ratings[i]), foods[i].clone()));
        }
        FoodRatings { food_rating, food_cuisine, cuisine_foods }
    }

    fn change_rating(&mut self, food: String, new_rating: i32) {
        let cuisine = self.food_cuisine[&food].clone();
        let old = self.food_rating[&food];
        let set = self.cuisine_foods.get_mut(&cuisine).unwrap();
        set.remove(&(Reverse(old), food.clone()));
        set.insert((Reverse(new_rating), food.clone()));
        self.food_rating.insert(food, new_rating);
    }

    fn highest_rated(&self, cuisine: String) -> String {
        self.cuisine_foods[&cuisine].iter().next().unwrap().1.clone()
    }
}
```

#### Go
No ordered set in stdlib, so use a per-cuisine `container/heap` of `(rating, name)` with lazy deletion; `Less` encodes rating desc then name asc.

```go
type foodItem struct {
	rating int
	name   string
}

type FoodHeap []foodItem

func (h FoodHeap) Len() int { return len(h) }
func (h FoodHeap) Less(i, j int) bool {
	if h[i].rating != h[j].rating {
		return h[i].rating > h[j].rating
	}
	return h[i].name < h[j].name
}
func (h FoodHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *FoodHeap) Push(x interface{}) {
	*h = append(*h, x.(foodItem))
}
func (h *FoodHeap) Pop() interface{} {
	old := *h
	n := len(old)
	v := old[n-1]
	*h = old[:n-1]
	return v
}

type FoodRatings struct {
	foodRating  map[string]int
	foodCuisine map[string]string
	heaps       map[string]*FoodHeap
}

func Constructor(foods []string, cuisines []string, ratings []int) FoodRatings {
	fr := FoodRatings{
		foodRating:  make(map[string]int),
		foodCuisine: make(map[string]string),
		heaps:       make(map[string]*FoodHeap),
	}
	for i, f := range foods {
		fr.foodRating[f] = ratings[i]
		fr.foodCuisine[f] = cuisines[i]
		if fr.heaps[cuisines[i]] == nil {
			fr.heaps[cuisines[i]] = &FoodHeap{}
		}
		heap.Push(fr.heaps[cuisines[i]], foodItem{ratings[i], f})
	}
	return fr
}

func (fr *FoodRatings) ChangeRating(food string, newRating int) {
	cuisine := fr.foodCuisine[food]
	fr.foodRating[food] = newRating
	heap.Push(fr.heaps[cuisine], foodItem{newRating, food})
}

func (fr *FoodRatings) HighestRated(cuisine string) string {
	h := fr.heaps[cuisine]
	for {
		top := (*h)[0]
		if fr.foodRating[top.name] == top.rating {
			return top.name
		}
		heap.Pop(h)
	}
}
```

#### C++
`std::set<pair<int,string>>` keyed on `(-rating, name)` gives the desired ordering; erase the old key before inserting the new one.

```cpp
class FoodRatings {
    unordered_map<string, int> foodRating;
    unordered_map<string, string> foodCuisine;
    unordered_map<string, set<pair<int, string>>> cuisineFoods; // (-rating, name)
public:
    FoodRatings(vector<string>& foods, vector<string>& cuisines, vector<int>& ratings) {
        for (int i = 0; i < (int)foods.size(); i++) {
            foodRating[foods[i]] = ratings[i];
            foodCuisine[foods[i]] = cuisines[i];
            cuisineFoods[cuisines[i]].insert({-ratings[i], foods[i]});
        }
    }

    void changeRating(string food, int newRating) {
        string cuisine = foodCuisine[food];
        int old = foodRating[food];
        cuisineFoods[cuisine].erase({-old, food});
        cuisineFoods[cuisine].insert({-newRating, food});
        foodRating[food] = newRating;
    }

    string highestRated(string cuisine) {
        return cuisineFoods[cuisine].begin()->second;
    }
};
```

### 49. Design a Leaderboard

#### Problem
Implement a `Leaderboard` class supporting three operations: `addScore(playerId, score)` adds `score` to the player's current total (creating the player at that score if new), `top(K)` returns the sum of the top `K` highest scores, and `reset(playerId)` removes a player's score entirely (guaranteed present, and afterwards their score is 0). Scores accumulate across `addScore` calls. Aim for efficient updates and top-K queries.

#### Pattern
**Hash map of scores + selection for top-K.** **O(1)** for add/reset, **O(n)** or **O(n log K)** for `top(K)`, **O(n)** space. Map playerId to running total; for `top(K)` collect all scores and take the K largest.

#### Explanation
The core insight is that `addScore` and `reset` are point updates on a player's cumulative score, so a plain hash map from playerId to total gives O(1) for both. The only real work is `top(K)`. A simple, robust approach collects all current scores and selects the K largest — O(n) if you use a partial-selection routine, or O(n log K) with a size-K min-heap that you push each score into and pop when it exceeds K elements, leaving the K largest. Given LeetCode's constraints (scores small, calls moderate), collecting-and-sorting is perfectly acceptable and clearest.

The alternative — keeping a sorted structure (balanced BST / order-statistics tree) keyed by score for O(log n) top-K — is overkill here and error-prone because scores are non-unique and mutate on every add. The map-plus-selection design keeps the invariant trivial: the map always holds each player's exact current total, and `top(K)` derives the answer freshly. Edge cases: `top(K)` where K exceeds the number of players simply sums everything; `reset` on a player then re-adding starts them from that new score (map entry deleted, recreated on next add).

#### Python
`heapq.nlargest(K, scores)` selects the top K in O(n log K) without a manual heap, and a plain `dict` handles the accumulation with `dict.get(id, 0)`.

```python
import heapq

class Leaderboard:
    def __init__(self):
        self.scores = {}

    def addScore(self, playerId: int, score: int) -> None:
        self.scores[playerId] = self.scores.get(playerId, 0) + score

    def top(self, K: int) -> int:
        return sum(heapq.nlargest(K, self.scores.values()))

    def reset(self, playerId: int) -> None:
        self.scores.pop(playerId, None)
```

#### Java
A `HashMap<Integer,Integer>` with `merge(id, score, Integer::sum)` accumulates cleanly; a size-K min-`PriorityQueue` keeps the top K.

```java
import java.util.*;

class Leaderboard {
    private final Map<Integer, Integer> scores = new HashMap<>();

    public void addScore(int playerId, int score) {
        scores.merge(playerId, score, Integer::sum);
    }

    public int top(int K) {
        PriorityQueue<Integer> minHeap = new PriorityQueue<>();
        for (int s : scores.values()) {
            minHeap.offer(s);
            if (minHeap.size() > K) minHeap.poll();
        }
        int sum = 0;
        for (int s : minHeap) sum += s;
        return sum;
    }

    public void reset(int playerId) {
        scores.remove(playerId);
    }
}
```

#### Rust
A `HashMap<i32,i32>` with the entry API accumulates; `BinaryHeap` is a max-heap, so collect values and pop K times for the top K.

```rust
use std::collections::{HashMap, BinaryHeap};

struct Leaderboard {
    scores: HashMap<i32, i32>,
}

impl Leaderboard {
    fn new() -> Self {
        Leaderboard { scores: HashMap::new() }
    }

    fn add_score(&mut self, player_id: i32, score: i32) {
        *self.scores.entry(player_id).or_insert(0) += score;
    }

    fn top(&self, k: i32) -> i32 {
        let mut heap: BinaryHeap<i32> = self.scores.values().copied().collect();
        let mut sum = 0;
        for _ in 0..k {
            match heap.pop() {
                Some(v) => sum += v,
                None => break,
            }
        }
        sum
    }

    fn reset(&mut self, player_id: i32) {
        self.scores.remove(&player_id);
    }
}
```

#### Go
A `map[int]int` accumulates in O(1); `sort.Sort(sort.Reverse(...))` on a slice of values, then sum the first K, keeps it simple with the stdlib.

```go
import "sort"

type Leaderboard struct {
    scores map[int]int
}

func Constructor() Leaderboard {
    return Leaderboard{scores: make(map[int]int)}
}

func (l *Leaderboard) AddScore(playerId int, score int) {
    l.scores[playerId] += score
}

func (l *Leaderboard) Top(K int) int {
    vals := make([]int, 0, len(l.scores))
    for _, v := range l.scores {
        vals = append(vals, v)
    }
    sort.Sort(sort.Reverse(sort.IntSlice(vals)))
    sum := 0
    for i := 0; i < K && i < len(vals); i++ {
        sum += vals[i]
    }
    return sum
}

func (l *Leaderboard) Reset(playerId int) {
    delete(l.scores, playerId)
}
```

#### C++
`unordered_map<int,int>` accumulates; `partial_sort` (or `nth_element`) on a values vector isolates the top K in O(n log K) without a full sort.

```cpp
#include <unordered_map>
#include <vector>
#include <algorithm>
#include <functional>
using namespace std;

class Leaderboard {
    unordered_map<int, int> scores;
public:
    Leaderboard() {}

    void addScore(int playerId, int score) {
        scores[playerId] += score;
    }

    int top(int K) {
        vector<int> vals;
        vals.reserve(scores.size());
        for (auto& [id, s] : scores) vals.push_back(s);
        int k = min((int)vals.size(), K);
        partial_sort(vals.begin(), vals.begin() + k, vals.end(), greater<int>());
        int sum = 0;
        for (int i = 0; i < k; ++i) sum += vals[i];
        return sum;
    }

    void reset(int playerId) {
        scores.erase(playerId);
    }
};
```

### 50. Design Graph With Shortest Path Calculator

#### Problem
Implement a `Graph` class for a directed, weighted graph of `n` nodes labelled `0..n-1`. The constructor takes `n` and an initial edge list where each edge is `[from, to, cost]`. `addEdge(edge)` adds a new directed edge `[from, to, cost]`. `shortestPath(node1, node2)` returns the minimum total cost of any path from `node1` to `node2`, or `-1` if none exists. Costs are positive.

#### Pattern
**Adjacency list + Dijkstra per query.** **O(E log V)** per `shortestPath`, **O(1)** amortized per `addEdge`, **O(V + E)** space. Positive weights make Dijkstra the right tool.

#### Explanation
Because edges are added incrementally but queried far more variably, the cleanest design stores a mutable adjacency list and runs Dijkstra fresh on each `shortestPath` call. `addEdge` is just an append to `adj[from]`, so it is O(1). Dijkstra is valid here precisely because all edge costs are positive — no negative-weight surprises — so the first time we finalize a node we have its true shortest distance, and a min-priority-queue drives the frontier in O(E log V).

The key implementation invariant: pop the smallest tentative distance from the heap, and skip any popped entry whose distance is stale (greater than the best already recorded for that node) — this "lazy deletion" avoids needing a decrease-key operation. We start with distance 0 at `node1`, relax outgoing edges, and stop early the moment we pop `node2`. If the heap drains without reaching `node2`, return -1. Re-running Dijkstra per query rather than maintaining an all-pairs matrix is the right trade because `addEdge` would otherwise invalidate a cached matrix constantly; per-query search keeps every answer correct against the current graph with minimal bookkeeping.

#### Python
`heapq` provides the min-heap; store `(dist, node)` tuples so Python's tuple ordering pops the smallest distance, and use a `dist` dict or list initialized to infinity.

```python
import heapq

class Graph:
    def __init__(self, n: int, edges: list[list[int]]):
        self.n = n
        self.adj = [[] for _ in range(n)]
        for u, v, w in edges:
            self.adj[u].append((v, w))

    def addEdge(self, edge: list[int]) -> None:
        u, v, w = edge
        self.adj[u].append((v, w))

    def shortestPath(self, node1: int, node2: int) -> int:
        dist = [float('inf')] * self.n
        dist[node1] = 0
        heap = [(0, node1)]
        while heap:
            d, u = heapq.heappop(heap)
            if u == node2:
                return d
            if d > dist[u]:
                continue
            for v, w in self.adj[u]:
                nd = d + w
                if nd < dist[v]:
                    dist[v] = nd
                    heapq.heappush(heap, (nd, v))
        return -1
```

#### Java
A `List<int[]>[]` adjacency array holds `{to, cost}`; a `PriorityQueue<int[]>` ordered by distance drives Dijkstra with lazy stale-entry skipping.

```java
import java.util.*;

class Graph {
    private final int n;
    private final List<int[]>[] adj;

    @SuppressWarnings("unchecked")
    public Graph(int n, int[][] edges) {
        this.n = n;
        adj = new List[n];
        for (int i = 0; i < n; i++) adj[i] = new ArrayList<>();
        for (int[] e : edges) adj[e[0]].add(new int[]{e[1], e[2]});
    }

    public void addEdge(int[] edge) {
        adj[edge[0]].add(new int[]{edge[1], edge[2]});
    }

    public int shortestPath(int node1, int node2) {
        int[] dist = new int[n];
        Arrays.fill(dist, Integer.MAX_VALUE);
        dist[node1] = 0;
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] - b[0]);
        pq.offer(new int[]{0, node1});
        while (!pq.isEmpty()) {
            int[] cur = pq.poll();
            int d = cur[0], u = cur[1];
            if (u == node2) return d;
            if (d > dist[u]) continue;
            for (int[] e : adj[u]) {
                int v = e[0], nd = d + e[1];
                if (nd < dist[v]) {
                    dist[v] = nd;
                    pq.offer(new int[]{nd, v});
                }
            }
        }
        return -1;
    }
}
```

#### Rust
`BinaryHeap` is a max-heap, so wrap `(dist, node)` in `std::cmp::Reverse` to pop the smallest distance; adjacency is a `Vec<Vec<(usize, i64)>>`.

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

struct Graph {
    adj: Vec<Vec<(usize, i64)>>,
}

impl Graph {
    fn new(n: i32, edges: Vec<Vec<i32>>) -> Self {
        let mut adj = vec![Vec::new(); n as usize];
        for e in edges {
            adj[e[0] as usize].push((e[1] as usize, e[2] as i64));
        }
        Graph { adj }
    }

    fn add_edge(&mut self, edge: Vec<i32>) {
        self.adj[edge[0] as usize].push((edge[1] as usize, edge[2] as i64));
    }

    fn shortest_path(&self, node1: i32, node2: i32) -> i32 {
        let n = self.adj.len();
        let target = node2 as usize;
        let mut dist = vec![i64::MAX; n];
        dist[node1 as usize] = 0;
        let mut heap = BinaryHeap::new();
        heap.push(Reverse((0i64, node1 as usize)));
        while let Some(Reverse((d, u))) = heap.pop() {
            if u == target {
                return d as i32;
            }
            if d > dist[u] {
                continue;
            }
            for &(v, w) in &self.adj[u] {
                let nd = d + w;
                if nd < dist[v] {
                    dist[v] = nd;
                    heap.push(Reverse((nd, v)));
                }
            }
        }
        -1
    }
}
```

#### Go
`container/heap` provides the priority queue; implement `heap.Interface` on a slice of `[dist, node]` items ordered by distance ascending.

```go
import "container/heap"

type item struct{ dist, node int }
type pq []item

func (p pq) Len() int            { return len(p) }
func (p pq) Less(i, j int) bool  { return p[i].dist < p[j].dist }
func (p pq) Swap(i, j int)       { p[i], p[j] = p[j], p[i] }
func (p *pq) Push(x interface{}) { *p = append(*p, x.(item)) }
func (p *pq) Pop() interface{} {
    old := *p
    n := len(old)
    it := old[n-1]
    *p = old[:n-1]
    return it
}

type Graph struct {
    n   int
    adj [][][2]int
}

func Constructor(n int, edges [][]int) Graph {
    adj := make([][][2]int, n)
    for _, e := range edges {
        adj[e[0]] = append(adj[e[0]], [2]int{e[1], e[2]})
    }
    return Graph{n: n, adj: adj}
}

func (g *Graph) AddEdge(edge []int) {
    g.adj[edge[0]] = append(g.adj[edge[0]], [2]int{edge[1], edge[2]})
}

func (g *Graph) ShortestPath(node1 int, node2 int) int {
    dist := make([]int, g.n)
    for i := range dist {
        dist[i] = 1 << 30
    }
    dist[node1] = 0
    h := &pq{{0, node1}}
    for h.Len() > 0 {
        cur := heap.Pop(h).(item)
        if cur.node == node2 {
            return cur.dist
        }
        if cur.dist > dist[cur.node] {
            continue
        }
        for _, e := range g.adj[cur.node] {
            v, w := e[0], e[1]
            if nd := cur.dist + w; nd < dist[v] {
                dist[v] = nd
                heap.Push(h, item{nd, v})
            }
        }
    }
    return -1
}
```

#### C++
`priority_queue` is a max-heap by default; use `greater<>` with a `pair<int,int>` of `(dist, node)` to make it a min-heap for Dijkstra.

```cpp
#include <vector>
#include <queue>
#include <climits>
using namespace std;

class Graph {
    int n;
    vector<vector<pair<int,int>>> adj;
public:
    Graph(int n, vector<vector<int>>& edges) : n(n), adj(n) {
        for (auto& e : edges) adj[e[0]].push_back({e[1], e[2]});
    }

    void addEdge(vector<int> edge) {
        adj[edge[0]].push_back({edge[1], edge[2]});
    }

    int shortestPath(int node1, int node2) {
        vector<int> dist(n, INT_MAX);
        dist[node1] = 0;
        priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;
        pq.push({0, node1});
        while (!pq.empty()) {
            auto [d, u] = pq.top(); pq.pop();
            if (u == node2) return d;
            if (d > dist[u]) continue;
            for (auto& [v, w] : adj[u]) {
                int nd = d + w;
                if (nd < dist[v]) {
                    dist[v] = nd;
                    pq.push({nd, v});
                }
            }
        }
        return -1;
    }
};
```

### 51. Logger Rate Limiter

#### Problem
Implement a `Logger` class that rate-limits repeated messages. The method `shouldPrintMessage(timestamp, message)` returns `true` if the message may be printed at that `timestamp`, and `false` otherwise. A given message may be printed at most once every 10 seconds: after printing `message` at time `t`, the same message is blocked until `t + 10`. Timestamps arrive in non-decreasing order.

#### Pattern
**Hash map of message to next-allowed time.** **O(1)** per call, **O(m)** space where m is the number of distinct messages. Store, for each message, the earliest timestamp it may print again.

#### Explanation
The natural state is a map from message to the next timestamp at which it becomes printable. On each call, if the message is absent or the current `timestamp` is at least its stored next-allowed time, we print: update the map to `timestamp + 10` and return true. Otherwise we are inside the 10-second cooldown and return false without touching the map. This is O(1) per call and O(m) space in the number of distinct messages ever seen.

A common alternative uses a queue of `(message, timestamp)` pairs plus a set, evicting entries older than 10 seconds as time advances — this bounds memory to only messages seen in the last window, which matters if the distinct-message universe is huge but the active window is small. For the standard problem the map approach is simpler and correct; the only subtlety is the boundary condition: exactly `t + 10` must be allowed (the limit is "once per 10 seconds", so the 10th second reopens it), which is why the comparison is `timestamp >= nextAllowed`. Because timestamps are non-decreasing, no reordering logic is needed.

#### Python
A plain `dict` mapping message to next-allowed timestamp; the check `msg not in d or ts >= d[msg]` handles both first-sight and cooldown-expired in one expression.

```python
class Logger:
    def __init__(self):
        self.next_allowed = {}

    def shouldPrintMessage(self, timestamp: int, message: str) -> bool:
        if message not in self.next_allowed or timestamp >= self.next_allowed[message]:
            self.next_allowed[message] = timestamp + 10
            return True
        return False
```

#### Java
`HashMap<String,Integer>` maps message to next-allowed time; `getOrDefault(message, 0)` lets the comparison and update stay a two-liner.

```java
import java.util.*;

class Logger {
    private final Map<String, Integer> nextAllowed = new HashMap<>();

    public Logger() {}

    public boolean shouldPrintMessage(int timestamp, String message) {
        if (timestamp >= nextAllowed.getOrDefault(message, 0)) {
            nextAllowed.put(message, timestamp + 10);
            return true;
        }
        return false;
    }
}
```

#### Rust
`HashMap<String, i32>` keyed by message; `get` returns `Option`, and `map_or(true, ...)` treats an absent message as printable in one expression.

```rust
use std::collections::HashMap;

struct Logger {
    next_allowed: HashMap<String, i32>,
}

impl Logger {
    fn new() -> Self {
        Logger { next_allowed: HashMap::new() }
    }

    fn should_print_message(&mut self, timestamp: i32, message: String) -> bool {
        let ok = self.next_allowed.get(&message).map_or(true, |&t| timestamp >= t);
        if ok {
            self.next_allowed.insert(message, timestamp + 10);
        }
        ok
    }
}
```

#### Go
A `map[string]int` maps message to next-allowed time; Go's zero value for a missing key is 0, so `ts >= m[message]` naturally allows first-time messages.

```go
type Logger struct {
    nextAllowed map[string]int
}

func Constructor() Logger {
    return Logger{nextAllowed: make(map[string]int)}
}

func (l *Logger) ShouldPrintMessage(timestamp int, message string) bool {
    if timestamp >= l.nextAllowed[message] {
        l.nextAllowed[message] = timestamp + 10
        return true
    }
    return false
}
```

#### C++
`unordered_map<string,int>` maps message to next-allowed time; `operator[]` value-initializes a missing key to 0, so the comparison handles first-sight for free.

```cpp
#include <unordered_map>
#include <string>
using namespace std;

class Logger {
    unordered_map<string, int> nextAllowed;
public:
    Logger() {}

    bool shouldPrintMessage(int timestamp, string message) {
        if (timestamp >= nextAllowed[message]) {
            nextAllowed[message] = timestamp + 10;
            return true;
        }
        return false;
    }
};
```

### 52. Design Hit Counter

#### Problem
Implement a `HitCounter` that counts hits within the past 5 minutes (300 seconds). `hit(timestamp)` records a hit at the given time (multiple hits may share a timestamp). `getHits(timestamp)` returns the number of hits in the past 300 seconds, i.e. within the range `(timestamp - 300, timestamp]`. Calls arrive with non-decreasing timestamps.

#### Pattern
**Monotonic queue of timestamps (or 300-bucket circular array).** **O(1)** amortized `hit`, **O(1)** or **O(window)** `getHits`, **O(n)** or **O(300)** space. Evict entries older than 300 seconds from the front.

#### Explanation
Since timestamps are non-decreasing, a FIFO queue of hit timestamps stays sorted automatically. `hit` pushes to the back. `getHits` first evicts from the front every timestamp `<= timestamp - 300` (i.e. outside the trailing 300-second window), then returns the queue size. Each timestamp is pushed once and popped once, so the eviction cost amortizes to O(1) per hit; the queue size directly answers the query. To avoid storing one entry per hit when many hits share a timestamp, store `(timestamp, count)` pairs and coalesce consecutive hits at the same second.

The bounded-memory alternative is a 300-slot circular array: `bucket[timestamp % 300]` holds a count and a `times[timestamp % 300]` holds which timestamp that slot currently represents. On `hit`, if the slot's stored timestamp differs from now, reset it before incrementing; on `getHits`, sum all slots whose stored timestamp is within the last 300 seconds. This caps memory at O(300) regardless of hit volume and gives O(300) queries — the right choice when hits vastly outnumber distinct seconds. The edge case in both designs is the exclusive lower bound: a hit at exactly `timestamp - 300` is out of the window, so evict/skip anything with `t <= timestamp - 300`.

#### Python
`collections.deque` gives O(1) `popleft` for front eviction; store the raw timestamps and pop while `q[0] <= timestamp - 300`.

```python
from collections import deque

class HitCounter:
    def __init__(self):
        self.hits = deque()

    def hit(self, timestamp: int) -> None:
        self.hits.append(timestamp)

    def getHits(self, timestamp: int) -> int:
        while self.hits and self.hits[0] <= timestamp - 300:
            self.hits.popleft()
        return len(self.hits)
```

#### Java
`ArrayDeque<Integer>` is the modern FIFO queue; `peekFirst`/`pollFirst` evict expired timestamps from the head in amortized O(1).

```java
import java.util.*;

class HitCounter {
    private final Deque<Integer> hits = new ArrayDeque<>();

    public HitCounter() {}

    public void hit(int timestamp) {
        hits.offerLast(timestamp);
    }

    public int getHits(int timestamp) {
        while (!hits.isEmpty() && hits.peekFirst() <= timestamp - 300) {
            hits.pollFirst();
        }
        return hits.size();
    }
}
```

#### Rust
`VecDeque<i32>` provides O(1) `push_back` and `pop_front`; evict from the front while the oldest timestamp falls outside the 300-second window.

```rust
use std::collections::VecDeque;

struct HitCounter {
    hits: VecDeque<i32>,
}

impl HitCounter {
    fn new() -> Self {
        HitCounter { hits: VecDeque::new() }
    }

    fn hit(&mut self, timestamp: i32) {
        self.hits.push_back(timestamp);
    }

    fn get_hits(&mut self, timestamp: i32) -> i32 {
        while let Some(&front) = self.hits.front() {
            if front <= timestamp - 300 {
                self.hits.pop_front();
            } else {
                break;
            }
        }
        self.hits.len() as i32
    }
}
```

#### Go
A slice used as a queue works well since timestamps are non-decreasing; advance a start index (or reslice) to drop expired front entries.

```go
type HitCounter struct {
    hits []int
}

func Constructor() HitCounter {
    return HitCounter{hits: []int{}}
}

func (h *HitCounter) Hit(timestamp int) {
    h.hits = append(h.hits, timestamp)
}

func (h *HitCounter) GetHits(timestamp int) int {
    i := 0
    for i < len(h.hits) && h.hits[i] <= timestamp-300 {
        i++
    }
    h.hits = h.hits[i:]
    return len(h.hits)
}
```

#### C++
`std::queue<int>` (backed by a deque) gives O(1) `push` and `pop`; evict from the front while the head timestamp is outside the window.

```cpp
#include <queue>
using namespace std;

class HitCounter {
    queue<int> hits;
public:
    HitCounter() {}

    void hit(int timestamp) {
        hits.push(timestamp);
    }

    int getHits(int timestamp) {
        while (!hits.empty() && hits.front() <= timestamp - 300) {
            hits.pop();
        }
        return hits.size();
    }
};
```

### 53. Moving Average from Data Stream

#### Problem
Implement a `MovingAverage` class initialized with an integer window `size`. The method `next(val)` adds `val` to the stream and returns the average of the last `size` values (or of all values so far, if fewer than `size` have arrived). Maintain a running average over a sliding window efficiently.

#### Pattern
**Fixed-size circular buffer with a running sum.** **O(1)** per `next`, **O(size)** space. Track the sum; when the window is full, subtract the value being overwritten before adding the new one.

#### Explanation
The efficient design keeps a running sum and a fixed-capacity buffer of the last `size` values, avoiding a re-sum on every call. A queue is the clearest realization: push the new value and add it to `sum`; if the queue length now exceeds `size`, pop the oldest value and subtract it from `sum`. The returned average is `sum / current_count`, where `current_count` is `min(elements_seen, size)` — equivalently just the queue length. This is O(1) per `next` and O(size) memory.

A circular array with a moving write index is the equivalent bounded-memory form: keep an array of `size` slots and a count; each `next` overwrites slot `index % size`, but before overwriting, subtract the value currently there (which is the one leaving the window once the array has filled) and add the incoming value. The only care point is the warm-up phase before the window fills — divide by the actual number of elements seen so far, not by `size`, so the early averages are correct. Integer overflow of `sum` is a non-issue for typical constraints but worth a wider type if values are large.

#### Python
`collections.deque(maxlen=size)` auto-evicts the oldest element on overflow; combined with a running `sum` you get O(1) updates, but capture the evicted value manually since deque's auto-drop is silent.

```python
from collections import deque

class MovingAverage:
    def __init__(self, size: int):
        self.size = size
        self.queue = deque()
        self.total = 0

    def next(self, val: int) -> float:
        self.queue.append(val)
        self.total += val
        if len(self.queue) > self.size:
            self.total -= self.queue.popleft()
        return self.total / len(self.queue)
```

#### Java
An `ArrayDeque<Integer>` as a FIFO plus a running `sum` gives O(1) updates; poll the head when the window overflows and subtract it.

```java
import java.util.*;

class MovingAverage {
    private final Deque<Integer> queue = new ArrayDeque<>();
    private final int size;
    private double sum = 0;

    public MovingAverage(int size) {
        this.size = size;
    }

    public double next(int val) {
        queue.offerLast(val);
        sum += val;
        if (queue.size() > size) {
            sum -= queue.pollFirst();
        }
        return sum / queue.size();
    }
}
```

#### Rust
A `VecDeque<i32>` with a running sum; `pop_front` returns the evicted value as an `Option`, so subtracting it from the sum is clean.

```rust
use std::collections::VecDeque;

struct MovingAverage {
    size: usize,
    queue: VecDeque<i32>,
    sum: i64,
}

impl MovingAverage {
    fn new(size: i32) -> Self {
        MovingAverage { size: size as usize, queue: VecDeque::new(), sum: 0 }
    }

    fn next(&mut self, val: i32) -> f64 {
        self.queue.push_back(val);
        self.sum += val as i64;
        if self.queue.len() > self.size {
            if let Some(old) = self.queue.pop_front() {
                self.sum -= old as i64;
            }
        }
        self.sum as f64 / self.queue.len() as f64
    }
}
```

#### Go
A slice-backed queue with a running sum; reslice off the front element when the window overflows, subtracting it from the sum.

```go
type MovingAverage struct {
    size  int
    queue []int
    sum   int
}

func Constructor(size int) MovingAverage {
    return MovingAverage{size: size, queue: []int{}}
}

func (m *MovingAverage) Next(val int) float64 {
    m.queue = append(m.queue, val)
    m.sum += val
    if len(m.queue) > m.size {
        m.sum -= m.queue[0]
        m.queue = m.queue[1:]
    }
    return float64(m.sum) / float64(len(m.queue))
}
```

#### C++
`std::queue<int>` plus a running `sum`; pop the front and subtract it when the window exceeds `size`.

```cpp
#include <queue>
using namespace std;

class MovingAverage {
    queue<int> q;
    int size;
    double sum = 0;
public:
    MovingAverage(int size) : size(size) {}

    double next(int val) {
        q.push(val);
        sum += val;
        if ((int)q.size() > size) {
            sum -= q.front();
            q.pop();
        }
        return sum / q.size();
    }
};
```

### 54. My Calendar I

#### Problem
Implement a `MyCalendar` class that books events without double-booking. `book(start, end)` represents a half-open interval `[start, end)`. Return `true` and record the event if it does not overlap any previously booked event; otherwise return `false` and do not record it. Two events overlap if they share any point of time (touching endpoints, e.g. `[10,20)` and `[20,30)`, do NOT overlap).

#### Pattern
**Balanced BST / ordered map keyed by start time.** **O(log n)** per `book` with an ordered map, **O(n)** with a linear scan, **O(n)** space. Check only the neighboring intervals via floor/ceiling lookups.

#### Explanation
The overlap test for half-open intervals is: new `[s, e)` conflicts with existing `[s', e')` iff `s < e'` and `s' < e`. The brute-force design scans all stored intervals per booking — O(n) each, fine for small inputs. The scalable design keeps intervals in an ordered map keyed by start time, so we only need to examine the two neighbors of `s`: the greatest existing start `<= s` (its end might spill past `s`) and the smallest existing start `> s` (whose start might fall before `e`). If neither neighbor overlaps, the whole set is clear, because the map's ordering guarantees no other interval can reach across those neighbors.

Concretely with a floor/ceiling-capable structure: let `prev` be the entry with the largest start `<= s`; conflict if `prev.end > s`. Let `next` be the entry with the smallest start `> s`; conflict if `next.start < e`. If both checks pass, insert `[s, e)`. This is the standard TreeMap/`floorKey`/`ceilingKey` pattern and gives O(log n) per operation. The critical subtlety is half-open semantics: use strict inequalities so that abutting intervals like `[20,30)` after `[10,20)` are accepted — mixing up `<` and `<=` here is the classic bug.

#### Python
No stdlib ordered map exists, so use `bisect` over a list of `(start, end)` kept sorted by start; `bisect` locates the insertion point, and we check only the neighbors on each side.

```python
import bisect

class MyCalendar:
    def __init__(self):
        self.events = []  # sorted list of (start, end)

    def book(self, start: int, end: int) -> bool:
        starts = [s for s, _ in self.events]
        i = bisect.bisect_right(starts, start)
        # neighbor to the left: largest start <= start
        if i > 0 and self.events[i - 1][1] > start:
            return False
        # neighbor to the right: smallest start > start
        if i < len(self.events) and self.events[i][0] < end:
            return False
        self.events.insert(i, (start, end))
        return True
```

#### Java
`TreeMap<Integer,Integer>` keyed by start with `floorKey`/`ceilingKey` gives O(log n) neighbor lookups — the textbook structure for this problem.

```java
import java.util.*;

class MyCalendar {
    private final TreeMap<Integer, Integer> calendar = new TreeMap<>();

    public MyCalendar() {}

    public boolean book(int start, int end) {
        Integer prev = calendar.floorKey(start);
        if (prev != null && calendar.get(prev) > start) return false;
        Integer next = calendar.ceilingKey(start);
        if (next != null && next < end) return false;
        calendar.put(start, end);
        return true;
    }
}
```

#### Rust
`BTreeMap<i32,i32>` keyed by start; use `range` queries to fetch the neighbor just at-or-before `start` and the one just after, both in O(log n).

```rust
use std::collections::BTreeMap;
use std::ops::Bound::{Included, Unbounded};

struct MyCalendar {
    calendar: BTreeMap<i32, i32>,
}

impl MyCalendar {
    fn new() -> Self {
        MyCalendar { calendar: BTreeMap::new() }
    }

    fn book(&mut self, start: i32, end: i32) -> bool {
        // neighbor with largest start <= start
        if let Some((_, &pe)) = self.calendar.range((Unbounded, Included(start))).next_back() {
            if pe > start {
                return false;
            }
        }
        // neighbor with smallest start > start
        if let Some((&ns, _)) = self.calendar.range((start + 1)..).next() {
            if ns < end {
                return false;
            }
        }
        self.calendar.insert(start, end);
        true
    }
}
```

#### Go
No stdlib ordered map, so keep a `sort`-maintained slice of intervals and use `sort.Search` for the insertion point, checking only the two neighbors.

```go
import "sort"

type MyCalendar struct {
    starts []int
    ends   []int
}

func Constructor() MyCalendar {
    return MyCalendar{}
}

func (c *MyCalendar) Book(start int, end int) bool {
    i := sort.Search(len(c.starts), func(k int) bool { return c.starts[k] > start })
    // left neighbor: largest start <= start
    if i > 0 && c.ends[i-1] > start {
        return false
    }
    // right neighbor: smallest start > start
    if i < len(c.starts) && c.starts[i] < end {
        return false
    }
    c.starts = append(c.starts, 0)
    c.ends = append(c.ends, 0)
    copy(c.starts[i+1:], c.starts[i:])
    copy(c.ends[i+1:], c.ends[i:])
    c.starts[i] = start
    c.ends[i] = end
    return true
}
```

#### C++
`std::map<int,int>` keyed by start; `lower_bound(start)` finds the first interval starting at or after `start`, and stepping back one gives the left neighbor — both O(log n).

```cpp
#include <map>
#include <iterator>
using namespace std;

class MyCalendar {
    map<int, int> calendar;  // start -> end
public:
    MyCalendar() {}

    bool book(int start, int end) {
        auto next = calendar.lower_bound(start);
        // right neighbor: smallest start >= start
        if (next != calendar.end() && next->first < end) return false;
        // left neighbor: largest start < start
        if (next != calendar.begin()) {
            auto prev = std::prev(next);
            if (prev->second > start) return false;
        }
        calendar[start] = end;
        return true;
    }
};
```

### 55. My Calendar II

#### Problem
Implement a `MyCalendarTwo` class that stores event bookings. Each call to `book(start, end)` represents a half-open interval `[start, end)`. Return `true` and record the booking if adding it does not cause a **triple** booking (three events overlapping the same instant); otherwise return `false` and do not record it. Double bookings are allowed. Target sub-quadratic per call is not required — O(n) per booking is standard.

#### Pattern
**Two interval lists (all bookings + overlaps).** **O(n)** per `book`, **O(n)** space. Maintain the set of doubly-booked regions; a new event is rejected iff it intersects any existing double.

#### Explanation
The key invariant is that we keep a running list of intervals that are already double-booked. A triple booking happens exactly when a new event overlaps a region that is already double-booked, so before committing we scan the double list: if the new interval `[start, end)` intersects any double region `[s, e)` (i.e. `start < e and s < end`), we reject. Otherwise the booking is safe.

When we accept, we must update both lists. The new event may create fresh double-booked regions wherever it overlaps an existing single booking — the intersection `[max(start, s), min(end, e))` of the new event with each prior booking becomes a new double region. So we compute those intersections against the full booking list, append them to the doubles, and finally append the new event to the bookings. This two-list bookkeeping avoids ever needing to detect triples directly; a triple can only arise by overlapping an existing double, which the guard check already forbids. Edge cases: half-open intervals mean touching endpoints (`end == s`) do not overlap, and an empty calendar always accepts.

#### Python
Plain lists of tuples; the overlap test is a single boolean and intersections are computed with `max`/`min`.

```python
class MyCalendarTwo:
    def __init__(self):
        self.bookings = []
        self.doubles = []

    def book(self, start: int, end: int) -> bool:
        for s, e in self.doubles:
            if start < e and s < end:
                return False
        for s, e in self.bookings:
            if start < e and s < end:
                self.doubles.append((max(start, s), min(end, e)))
        self.bookings.append((start, end))
        return True
```

#### Java
`int[]` pairs held in `ArrayList`; overlap and clamp with plain comparisons and `Math.max`/`Math.min`.

```java
import java.util.*;

class MyCalendarTwo {
    private final List<int[]> bookings = new ArrayList<>();
    private final List<int[]> doubles = new ArrayList<>();

    public MyCalendarTwo() {}

    public boolean book(int start, int end) {
        for (int[] d : doubles) {
            if (start < d[1] && d[0] < end) return false;
        }
        for (int[] b : bookings) {
            if (start < b[1] && b[0] < end) {
                doubles.add(new int[]{Math.max(start, b[0]), Math.min(end, b[1])});
            }
        }
        bookings.add(new int[]{start, end});
        return true;
    }
}
```

#### Rust
Two `Vec<(i32, i32)>` fields; `.iter()` for the scans and `.max`/`.min` on integers for clamping.

```rust
struct MyCalendarTwo {
    bookings: Vec<(i32, i32)>,
    doubles: Vec<(i32, i32)>,
}

impl MyCalendarTwo {
    fn new() -> Self {
        MyCalendarTwo { bookings: Vec::new(), doubles: Vec::new() }
    }

    fn book(&mut self, start: i32, end: i32) -> bool {
        for &(s, e) in &self.doubles {
            if start < e && s < end {
                return false;
            }
        }
        for &(s, e) in &self.bookings {
            if start < e && s < end {
                self.doubles.push((start.max(s), end.min(e)));
            }
        }
        self.bookings.push((start, end));
        true
    }
}
```

#### Go
Slices of `[2]int`; iterate with `range` and use plain comparisons with small `max`/`min` helpers.

```go
type MyCalendarTwo struct {
	bookings [][2]int
	doubles  [][2]int
}

func Constructor() MyCalendarTwo {
	return MyCalendarTwo{}
}

func (c *MyCalendarTwo) Book(start int, end int) bool {
	for _, d := range c.doubles {
		if start < d[1] && d[0] < end {
			return false
		}
	}
	for _, b := range c.bookings {
		if start < b[1] && b[0] < end {
			lo, hi := start, end
			if b[0] > lo {
				lo = b[0]
			}
			if b[1] < hi {
				hi = b[1]
			}
			c.doubles = append(c.doubles, [2]int{lo, hi})
		}
	}
	c.bookings = append(c.bookings, [2]int{start, end})
	return true
}
```

#### C++
`vector<pair<int,int>>` for both lists; `max`/`min` from `<algorithm>` clamp the overlap.

```cpp
#include <vector>
#include <utility>
#include <algorithm>
using namespace std;

class MyCalendarTwo {
    vector<pair<int,int>> bookings;
    vector<pair<int,int>> doubles;
public:
    MyCalendarTwo() {}

    bool book(int start, int end) {
        for (auto& d : doubles) {
            if (start < d.second && d.first < end) return false;
        }
        for (auto& b : bookings) {
            if (start < b.second && b.first < end) {
                doubles.emplace_back(max(start, b.first), min(end, b.second));
            }
        }
        bookings.emplace_back(start, end);
        return true;
    }
};
```

### 56. My Calendar III

#### Problem
Implement a `MyCalendarThree` class where `book(start, end)` records a half-open interval `[start, end)` and returns an integer `k`: the maximum number of events that overlap at any single point across all bookings so far (the maximum "k-booking"). Every booking always succeeds; you only report the current peak overlap. Target O(n) per call.

#### Pattern
**Sweep-line delta counting (boundary map).** **O(n)** per `book` over a sorted boundary map, **O(n)** space. `+1` at `start`, `-1` at `end`; running prefix max is the answer.

#### Explanation
This is a classic difference-array / sweep-line over event boundaries. Keep an ordered map from timestamp to a delta count. Each booking adds `+1` at `start` and `-1` at `end`. Because the intervals are half-open, decrementing exactly at `end` is correct — an event contributes only up to but not including `end`, so a booking starting at another's `end` never counts as overlapping.

To answer, walk the boundaries in ascending time accumulating the deltas into a running "active events" counter; the maximum value this counter reaches is the peak k-booking. Since a booking can shift the peak anywhere, we recompute the prefix maximum by sweeping the whole map each call, which is O(n log n) with a tree map or O(n) if we amortize; the ordered structure keeps timestamps sorted for the sweep. The subtle correctness point is the half-open convention: using `<` overlap semantics is equivalent to the `-1` landing at `end`, so touching intervals never inflate the count.

#### Python
`collections.defaultdict(int)` for deltas, then `sorted(...)` the keys each call for the sweep — no external ordered map needed.

```python
from collections import defaultdict

class MyCalendarThree:
    def __init__(self):
        self.delta = defaultdict(int)

    def book(self, start: int, end: int) -> int:
        self.delta[start] += 1
        self.delta[end] -= 1
        active = 0
        best = 0
        for t in sorted(self.delta):
            active += self.delta[t]
            best = max(best, active)
        return best
```

#### Java
`TreeMap<Integer,Integer>` keeps boundaries sorted; iterate `values()` in key order to accumulate.

```java
import java.util.*;

class MyCalendarThree {
    private final TreeMap<Integer, Integer> delta = new TreeMap<>();

    public MyCalendarThree() {}

    public int book(int start, int end) {
        delta.merge(start, 1, Integer::sum);
        delta.merge(end, -1, Integer::sum);
        int active = 0, best = 0;
        for (int d : delta.values()) {
            active += d;
            best = Math.max(best, active);
        }
        return best;
    }
}
```

#### Rust
`std::collections::BTreeMap` stores deltas in sorted key order; iterating yields boundaries ascending for the sweep.

```rust
use std::collections::BTreeMap;

struct MyCalendarThree {
    delta: BTreeMap<i32, i32>,
}

impl MyCalendarThree {
    fn new() -> Self {
        MyCalendarThree { delta: BTreeMap::new() }
    }

    fn book(&mut self, start: i32, end: i32) -> i32 {
        *self.delta.entry(start).or_insert(0) += 1;
        *self.delta.entry(end).or_insert(0) -= 1;
        let mut active = 0;
        let mut best = 0;
        for (_, &d) in &self.delta {
            active += d;
            if active > best {
                best = active;
            }
        }
        best
    }
}
```

#### Go
A `map[int]int` for deltas plus `sort.Ints` on the collected keys each call — the stdlib way without an ordered map type.

```go
import "sort"

type MyCalendarThree struct {
	delta map[int]int
}

func Constructor() MyCalendarThree {
	return MyCalendarThree{delta: make(map[int]int)}
}

func (c *MyCalendarThree) Book(start int, end int) int {
	c.delta[start]++
	c.delta[end]--
	keys := make([]int, 0, len(c.delta))
	for k := range c.delta {
		keys = append(keys, k)
	}
	sort.Ints(keys)
	active, best := 0, 0
	for _, k := range keys {
		active += c.delta[k]
		if active > best {
			best = active
		}
	}
	return best
}
```

#### C++
`std::map<int,int>` is an ordered tree, so a single range-for over it walks boundaries in time order.

```cpp
#include <map>
using namespace std;

class MyCalendarThree {
    map<int,int> delta;
public:
    MyCalendarThree() {}

    int book(int start, int end) {
        delta[start]++;
        delta[end]--;
        int active = 0, best = 0;
        for (auto& [t, d] : delta) {
            active += d;
            if (active > best) best = active;
        }
        return best;
    }
};
```

### 57. Design Authentication Manager

#### Problem
Implement `AuthenticationManager` with a constructor `AuthenticationManager(timeToLive)` setting the token lifetime in seconds. `generate(tokenId, currentTime)` creates a token expiring at `currentTime + timeToLive`. `renew(tokenId, currentTime)` extends an unexpired token to `currentTime + timeToLive`, but does nothing if the token does not exist or has already expired at `currentTime`. `countUnexpiredTokens(currentTime)` returns how many tokens are still valid (expiry strictly greater than `currentTime`). Target O(1) for generate/renew.

#### Pattern
**Hash map of token to expiry time.** **O(1)** generate/renew, **O(n)** count, **O(n)** space. Expiry is stored as an absolute deadline; a token is live while `expiry > currentTime`.

#### Explanation
Store each token as a key mapped to its absolute expiry timestamp `currentTime + ttl`. Generation is a plain insert. Renewal is guarded: it only applies if the token exists AND its stored expiry is strictly greater than the current time — an expired-but-not-yet-purged entry must be treated as gone, so renewing it is a no-op (and we should not resurrect it). Using strict `>` throughout enforces the "expires at exactly `expiry`" contract: at `currentTime == expiry` the token is already dead.

We never eagerly delete expired tokens; they simply fail the `> currentTime` test wherever it matters. Counting therefore scans the map and tallies entries whose expiry still beats the current time, which is O(n). If lazy accumulation of dead keys were a concern you could prune during count, but it is unnecessary for correctness. The only real trap is the renew guard — forgetting the expiry check lets a stale token spring back to life, which violates the spec.

#### Python
A single `dict` mapping token id to expiry; `.get` with a sentinel handles the "missing token" branch in `renew`.

```python
class AuthenticationManager:
    def __init__(self, timeToLive: int):
        self.ttl = timeToLive
        self.expiry = {}

    def generate(self, tokenId: str, currentTime: int) -> None:
        self.expiry[tokenId] = currentTime + self.ttl

    def renew(self, tokenId: str, currentTime: int) -> None:
        if self.expiry.get(tokenId, 0) > currentTime:
            self.expiry[tokenId] = currentTime + self.ttl

    def countUnexpiredTokens(self, currentTime: int) -> int:
        return sum(1 for e in self.expiry.values() if e > currentTime)
```

#### Java
`HashMap<String,Integer>` from token to expiry; `getOrDefault` cleanly encodes the missing-token case in `renew`.

```java
import java.util.*;

class AuthenticationManager {
    private final int ttl;
    private final Map<String, Integer> expiry = new HashMap<>();

    public AuthenticationManager(int timeToLive) {
        this.ttl = timeToLive;
    }

    public void generate(String tokenId, int currentTime) {
        expiry.put(tokenId, currentTime + ttl);
    }

    public void renew(String tokenId, int currentTime) {
        if (expiry.getOrDefault(tokenId, 0) > currentTime) {
            expiry.put(tokenId, currentTime + ttl);
        }
    }

    public int countUnexpiredTokens(int currentTime) {
        int count = 0;
        for (int e : expiry.values()) {
            if (e > currentTime) count++;
        }
        return count;
    }
}
```

#### Rust
`HashMap<String, i32>` from token to deadline; `if let Some(&e)` on the lookup keeps the renew guard borrow-clean before the mutation.

```rust
use std::collections::HashMap;

struct AuthenticationManager {
    ttl: i32,
    expiry: HashMap<String, i32>,
}

impl AuthenticationManager {
    fn new(time_to_live: i32) -> Self {
        AuthenticationManager { ttl: time_to_live, expiry: HashMap::new() }
    }

    fn generate(&mut self, token_id: String, current_time: i32) {
        self.expiry.insert(token_id, current_time + self.ttl);
    }

    fn renew(&mut self, token_id: String, current_time: i32) {
        if let Some(&e) = self.expiry.get(&token_id) {
            if e > current_time {
                self.expiry.insert(token_id, current_time + self.ttl);
            }
        }
    }

    fn count_unexpired_tokens(&self, current_time: i32) -> i32 {
        self.expiry.values().filter(|&&e| e > current_time).count() as i32
    }
}
```

#### Go
A `map[string]int` from token to expiry; the comma-ok lookup handles both "exists" and "unexpired" in the renew guard.

```go
type AuthenticationManager struct {
	ttl    int
	expiry map[string]int
}

func Constructor(timeToLive int) AuthenticationManager {
	return AuthenticationManager{ttl: timeToLive, expiry: make(map[string]int)}
}

func (m *AuthenticationManager) Generate(tokenId string, currentTime int) {
	m.expiry[tokenId] = currentTime + m.ttl
}

func (m *AuthenticationManager) Renew(tokenId string, currentTime int) {
	if e, ok := m.expiry[tokenId]; ok && e > currentTime {
		m.expiry[tokenId] = currentTime + m.ttl
	}
}

func (m *AuthenticationManager) CountUnexpiredTokens(currentTime int) int {
	count := 0
	for _, e := range m.expiry {
		if e > currentTime {
			count++
		}
	}
	return count
}
```

#### C++
`unordered_map<string,int>` from token to expiry; `find` distinguishes the missing token from an expired one in `renew`.

```cpp
#include <string>
#include <unordered_map>
using namespace std;

class AuthenticationManager {
    int ttl;
    unordered_map<string, int> expiry;
public:
    AuthenticationManager(int timeToLive) : ttl(timeToLive) {}

    void generate(const string& tokenId, int currentTime) {
        expiry[tokenId] = currentTime + ttl;
    }

    void renew(const string& tokenId, int currentTime) {
        auto it = expiry.find(tokenId);
        if (it != expiry.end() && it->second > currentTime) {
            it->second = currentTime + ttl;
        }
    }

    int countUnexpiredTokens(int currentTime) {
        int count = 0;
        for (auto& [id, e] : expiry) {
            if (e > currentTime) count++;
        }
        return count;
    }
};
```

### 58. Design an ATM Machine

#### Problem
Implement an `ATM` that holds banknotes of five denominations: 20, 50, 100, 200, 500. `deposit(banknotesCount)` adds counts for each denomination (an array of five). `withdraw(amount)` must dispense the exact amount using the **greedy largest-denomination-first** rule; if it cannot be fulfilled exactly, return `[-1]` and change nothing. On success it returns the count of each denomination dispensed (array of five) and deducts them. Target O(1) per operation (fixed 5 denominations).

#### Pattern
**Fixed-size count array + greedy from largest.** **O(1)** per op (5 denominations), **O(1)** space. Greedy is optimal here because each larger note is a multiple-compatible superset for exact change under these values plus a validity recheck.

#### Explanation
Maintain a length-5 array of note counts aligned to denominations `[20, 50, 100, 200, 500]`. Deposit just adds elementwise. Withdrawal is greedy from the largest denomination down: for each denomination take as many notes as possible without exceeding the remaining amount and without exceeding stock, i.e. `min(remaining / value, count)`. Record these picks in a temporary array and reduce the remaining amount.

The critical discipline is atomicity: greedy might leave a nonzero remainder even though a different split could have worked — but for this specific denomination set the greedy-from-largest choice is what the problem defines as correct, so we do not backtrack. After the pass, if `remaining != 0` the request is unfulfillable and we must return `[-1]` having modified nothing. That is why we accumulate picks in a scratch array and only commit them back to the real counts once we know `remaining == 0`. Forgetting to defer the commit is the classic bug: a partial deduction on a failed withdrawal corrupts the machine state.

#### Python
A list of five counts and a parallel `values` list; integer `//` and `min` drive the greedy pass into a scratch list committed only on success.

```python
class ATM:
    def __init__(self):
        self.counts = [0, 0, 0, 0, 0]
        self.values = [20, 50, 100, 200, 500]

    def deposit(self, banknotesCount) -> None:
        for i in range(5):
            self.counts[i] += banknotesCount[i]

    def withdraw(self, amount: int):
        take = [0, 0, 0, 0, 0]
        for i in range(4, -1, -1):
            take[i] = min(amount // self.values[i], self.counts[i])
            amount -= take[i] * self.values[i]
        if amount != 0:
            return [-1]
        for i in range(5):
            self.counts[i] -= take[i]
        return take
```

#### Java
`long[]` counts guard against overflow when denominations pile up; a scratch `int[]` holds picks until the exact-match check passes.

```java
import java.util.*;

class ATM {
    private final long[] counts = new long[5];
    private final int[] values = {20, 50, 100, 200, 500};

    public ATM() {}

    public void deposit(int[] banknotesCount) {
        for (int i = 0; i < 5; i++) counts[i] += banknotesCount[i];
    }

    public int[] withdraw(int amount) {
        int[] take = new int[5];
        for (int i = 4; i >= 0; i--) {
            long n = Math.min(amount / values[i], counts[i]);
            take[i] = (int) n;
            amount -= take[i] * values[i];
        }
        if (amount != 0) return new int[]{-1};
        for (int i = 0; i < 5; i++) counts[i] -= take[i];
        return take;
    }
}
```

#### Rust
Fixed `[i64; 5]` arrays for counts and values; the greedy loop fills a `[i32; 5]` scratch and commits only when `amount` hits zero.

```rust
struct ATM {
    counts: [i64; 5],
    values: [i64; 5],
}

impl ATM {
    fn new() -> Self {
        ATM { counts: [0; 5], values: [20, 50, 100, 200, 500] }
    }

    fn deposit(&mut self, banknotes_count: Vec<i32>) {
        for i in 0..5 {
            self.counts[i] += banknotes_count[i] as i64;
        }
    }

    fn withdraw(&mut self, amount: i32) -> Vec<i32> {
        let mut remaining = amount as i64;
        let mut take = [0i64; 5];
        for i in (0..5).rev() {
            take[i] = (remaining / self.values[i]).min(self.counts[i]);
            remaining -= take[i] * self.values[i];
        }
        if remaining != 0 {
            return vec![-1];
        }
        for i in 0..5 {
            self.counts[i] -= take[i];
        }
        take.iter().map(|&x| x as i32).collect()
    }
}
```

#### Go
`[5]int64` counts avoid overflow; a scratch `[]int` of picks is returned only after the exact-amount check, else `[]int{-1}`.

```go
type ATM struct {
	counts [5]int64
	values [5]int64
}

func Constructor() ATM {
	return ATM{values: [5]int64{20, 50, 100, 200, 500}}
}

func (a *ATM) Deposit(banknotesCount []int) {
	for i := 0; i < 5; i++ {
		a.counts[i] += int64(banknotesCount[i])
	}
}

func (a *ATM) Withdraw(amount int) []int {
	remaining := int64(amount)
	var take [5]int64
	for i := 4; i >= 0; i-- {
		n := remaining / a.values[i]
		if n > a.counts[i] {
			n = a.counts[i]
		}
		take[i] = n
		remaining -= n * a.values[i]
	}
	if remaining != 0 {
		return []int{-1}
	}
	res := make([]int, 5)
	for i := 0; i < 5; i++ {
		a.counts[i] -= take[i]
		res[i] = int(take[i])
	}
	return res
}
```

#### C++
`array<long long,5>` counts prevent overflow; `min` picks greedily into a scratch and the deduction is deferred until the exact match is confirmed.

```cpp
#include <vector>
#include <array>
#include <algorithm>
using namespace std;

class ATM {
    array<long long, 5> counts{};
    array<long long, 5> values{20, 50, 100, 200, 500};
public:
    ATM() {}

    void deposit(vector<int> banknotesCount) {
        for (int i = 0; i < 5; i++) counts[i] += banknotesCount[i];
    }

    vector<int> withdraw(int amount) {
        long long remaining = amount;
        array<long long, 5> take{};
        for (int i = 4; i >= 0; i--) {
            take[i] = min(remaining / values[i], counts[i]);
            remaining -= take[i] * values[i];
        }
        if (remaining != 0) return {-1};
        vector<int> res(5);
        for (int i = 0; i < 5; i++) {
            counts[i] -= take[i];
            res[i] = (int) take[i];
        }
        return res;
    }
};
```

### 59. Design Twitter

#### Problem
Implement `Twitter` supporting: `postTweet(userId, tweetId)` composes a tweet; `getNewsFeed(userId)` returns the 10 most recent tweet ids posted by the user or the people they follow, most recent first; `follow(followerId, followeeId)` and `unfollow(followerId, followeeId)` manage the follow graph. A user implicitly sees their own tweets. Target efficient feed retrieval via a k-way merge of per-user timelines.

#### Pattern
**Per-user tweet lists + global timestamp + k-way merge by heap.** Feed is **O(k + 10 log k)** for k followees, other ops **O(1)**. A monotonic counter orders tweets globally.

#### Explanation
Each user owns a list of `(timestamp, tweetId)` pairs appended in post order; a single global counter supplies strictly increasing timestamps so tweets across users are totally ordered. The follow graph is an adjacency set per user. Posting and (un)following are trivial map/set mutations — the only care is that a user should not follow themselves as a duplicate, but including self explicitly or implicitly both work as long as the feed unions the user's own tweets.

The feed is the interesting part: gather the candidate authors (the user plus everyone they follow), and merge their per-user timelines to pull the 10 newest. Because each user's own list is already in ascending time order, we do a k-way merge using a max-heap seeded with each author's latest tweet; pop the newest, then push that author's previous tweet, repeating up to 10 times. This is the merge-k-sorted-lists pattern and avoids sorting every tweet. Edge cases: authors with no tweets contribute nothing, unfollowing someone you do not follow is a no-op, and you cannot unfollow yourself out of your own feed.

#### Python
`collections.defaultdict` for tweets and follow sets; `heapq` (a min-heap) is fed negated timestamps to pop newest-first during the k-way merge.

```python
from collections import defaultdict
import heapq

class Twitter:
    def __init__(self):
        self.time = 0
        self.tweets = defaultdict(list)
        self.following = defaultdict(set)

    def postTweet(self, userId: int, tweetId: int) -> None:
        self.tweets[userId].append((self.time, tweetId))
        self.time += 1

    def getNewsFeed(self, userId: int):
        heap = []
        authors = self.following[userId] | {userId}
        for a in authors:
            if self.tweets[a]:
                idx = len(self.tweets[a]) - 1
                t, tid = self.tweets[a][idx]
                heap.append((-t, tid, a, idx))
        heapq.heapify(heap)
        feed = []
        while heap and len(feed) < 10:
            negt, tid, a, idx = heapq.heappop(heap)
            feed.append(tid)
            if idx > 0:
                pt, ptid = self.tweets[a][idx - 1]
                heapq.heappush(heap, (-pt, ptid, a, idx - 1))
        return feed
```

#### Java
`PriorityQueue` ordered by descending timestamp does the k-way merge; `HashMap` of `ArrayList` timelines and `HashSet` follow lists back it.

```java
import java.util.*;

class Twitter {
    private int time = 0;
    private final Map<Integer, List<int[]>> tweets = new HashMap<>();
    private final Map<Integer, Set<Integer>> following = new HashMap<>();

    public Twitter() {}

    public void postTweet(int userId, int tweetId) {
        tweets.computeIfAbsent(userId, k -> new ArrayList<>()).add(new int[]{time++, tweetId});
    }

    public List<Integer> getNewsFeed(int userId) {
        Set<Integer> authors = new HashSet<>(following.getOrDefault(userId, Set.of()));
        authors.add(userId);
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> b[0] - a[0]);
        for (int a : authors) {
            List<int[]> list = tweets.get(a);
            if (list != null && !list.isEmpty()) {
                int idx = list.size() - 1;
                pq.add(new int[]{list.get(idx)[0], list.get(idx)[1], a, idx});
            }
        }
        List<Integer> feed = new ArrayList<>();
        while (!pq.isEmpty() && feed.size() < 10) {
            int[] top = pq.poll();
            feed.add(top[1]);
            if (top[3] > 0) {
                List<int[]> list = tweets.get(top[2]);
                int idx = top[3] - 1;
                pq.add(new int[]{list.get(idx)[0], list.get(idx)[1], top[2], idx});
            }
        }
        return feed;
    }

    public void follow(int followerId, int followeeId) {
        following.computeIfAbsent(followerId, k -> new HashSet<>()).add(followeeId);
    }

    public void unfollow(int followerId, int followeeId) {
        Set<Integer> set = following.get(followerId);
        if (set != null) set.remove(followeeId);
    }
}
```

#### Rust
`BinaryHeap` is a max-heap, so pushing `(timestamp, ...)` tuples naturally pops newest-first for the merge; `HashMap`/`HashSet` hold timelines and follows.

```rust
use std::collections::{HashMap, HashSet, BinaryHeap};

struct Twitter {
    time: i32,
    tweets: HashMap<i32, Vec<(i32, i32)>>,
    following: HashMap<i32, HashSet<i32>>,
}

impl Twitter {
    fn new() -> Self {
        Twitter { time: 0, tweets: HashMap::new(), following: HashMap::new() }
    }

    fn post_tweet(&mut self, user_id: i32, tweet_id: i32) {
        self.tweets.entry(user_id).or_default().push((self.time, tweet_id));
        self.time += 1;
    }

    fn get_news_feed(&self, user_id: i32) -> Vec<i32> {
        let mut authors: HashSet<i32> = self.following.get(&user_id).cloned().unwrap_or_default();
        authors.insert(user_id);
        let mut heap: BinaryHeap<(i32, i32, i32, usize)> = BinaryHeap::new();
        for &a in &authors {
            if let Some(list) = self.tweets.get(&a) {
                if !list.is_empty() {
                    let idx = list.len() - 1;
                    heap.push((list[idx].0, list[idx].1, a, idx));
                }
            }
        }
        let mut feed = Vec::new();
        while let Some((_, tid, a, idx)) = heap.pop() {
            if feed.len() >= 10 {
                break;
            }
            feed.push(tid);
            if idx > 0 {
                let list = &self.tweets[&a];
                heap.push((list[idx - 1].0, list[idx - 1].1, a, idx - 1));
            }
        }
        feed
    }

    fn follow(&mut self, follower_id: i32, followee_id: i32) {
        self.following.entry(follower_id).or_default().insert(followee_id);
    }

    fn unfollow(&mut self, follower_id: i32, followee_id: i32) {
        if let Some(set) = self.following.get_mut(&follower_id) {
            set.remove(&followee_id);
        }
    }
}
```

#### Go
`container/heap` implements the k-way merge; maps hold `[]tweet` timelines and `map[int]bool` follow sets.

```go
import "container/heap"

type entry struct {
	time, tweetId, author, idx int
}

type feedHeap []entry

func (h feedHeap) Len() int            { return len(h) }
func (h feedHeap) Less(i, j int) bool  { return h[i].time > h[j].time }
func (h feedHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *feedHeap) Push(x interface{}) { *h = append(*h, x.(entry)) }
func (h *feedHeap) Pop() interface{} {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[:n-1]
	return x
}

type Twitter struct {
	time      int
	tweets    map[int][][2]int
	following map[int]map[int]bool
}

func Constructor() Twitter {
	return Twitter{tweets: map[int][][2]int{}, following: map[int]map[int]bool{}}
}

func (t *Twitter) PostTweet(userId int, tweetId int) {
	t.tweets[userId] = append(t.tweets[userId], [2]int{t.time, tweetId})
	t.time++
}

func (t *Twitter) GetNewsFeed(userId int) []int {
	authors := map[int]bool{userId: true}
	for a := range t.following[userId] {
		authors[a] = true
	}
	h := &feedHeap{}
	heap.Init(h)
	for a := range authors {
		list := t.tweets[a]
		if len(list) > 0 {
			idx := len(list) - 1
			heap.Push(h, entry{list[idx][0], list[idx][1], a, idx})
		}
	}
	feed := []int{}
	for h.Len() > 0 && len(feed) < 10 {
		top := heap.Pop(h).(entry)
		feed = append(feed, top.tweetId)
		if top.idx > 0 {
			list := t.tweets[top.author]
			idx := top.idx - 1
			heap.Push(h, entry{list[idx][0], list[idx][1], top.author, idx})
		}
	}
	return feed
}

func (t *Twitter) Follow(followerId int, followeeId int) {
	if t.following[followerId] == nil {
		t.following[followerId] = map[int]bool{}
	}
	t.following[followerId][followeeId] = true
}

func (t *Twitter) Unfollow(followerId int, followeeId int) {
	if s := t.following[followerId]; s != nil {
		delete(s, followeeId)
	}
}
```

#### C++
`priority_queue` of tuples (max-heap on timestamp) drives the merge; `unordered_map` of `vector` timelines and `unordered_set` follows back it.

```cpp
#include <vector>
#include <tuple>
#include <queue>
#include <unordered_map>
#include <unordered_set>
using namespace std;

class Twitter {
    int time = 0;
    unordered_map<int, vector<pair<int,int>>> tweets;
    unordered_map<int, unordered_set<int>> following;
public:
    Twitter() {}

    void postTweet(int userId, int tweetId) {
        tweets[userId].push_back({time++, tweetId});
    }

    vector<int> getNewsFeed(int userId) {
        unordered_set<int> authors = following[userId];
        authors.insert(userId);
        priority_queue<tuple<int,int,int,int>> pq;
        for (int a : authors) {
            auto& list = tweets[a];
            if (!list.empty()) {
                int idx = (int) list.size() - 1;
                pq.push({list[idx].first, list[idx].second, a, idx});
            }
        }
        vector<int> feed;
        while (!pq.empty() && (int) feed.size() < 10) {
            auto [t, tid, a, idx] = pq.top();
            pq.pop();
            feed.push_back(tid);
            if (idx > 0) {
                auto& list = tweets[a];
                pq.push({list[idx - 1].first, list[idx - 1].second, a, idx - 1});
            }
        }
        return feed;
    }

    void follow(int followerId, int followeeId) {
        following[followerId].insert(followeeId);
    }

    void unfollow(int followerId, int followeeId) {
        following[followerId].erase(followeeId);
    }
};
```

### 60. Design Underground System

#### Problem
Implement `UndergroundSystem` tracking travel times between stations. `checkIn(id, stationName, t)` records that customer `id` entered `stationName` at time `t`. `checkOut(id, stationName, t)` records their exit and closes the trip. `getAverageTime(startStation, endStation)` returns the average travel time over all completed trips that went from `startStation` directly to `endStation`. A customer has at most one active trip at a time. Target O(1) per operation.

#### Pattern
**Two hash maps: active check-ins + running totals per route.** **O(1)** per op, **O(n)** space. Store sum and count per `(start, end)` route so the average is a division.

#### Explanation
The first map holds each currently checked-in customer keyed by id, storing their start station and check-in time. On check-out we pop that entry, form the route key `(startStation, endStation)`, and fold the trip duration `t - startTime` into a second map that accumulates a running `(totalTime, tripCount)` per route. This keeps every operation O(1) and never stores individual trips — only per-route aggregates, which is all `getAverageTime` needs.

The invariant is that a customer id appears in the active map iff they are mid-trip; the "at most one active trip" guarantee means we never clobber a live check-in. `getAverageTime` is then `totalTime / tripCount` for the queried route — the count is always positive because the problem guarantees the route has been travelled before it is queried. The one subtlety is the composite key: it must combine both station names unambiguously (a tuple, a nested map, or a delimiter-joined string that cannot collide), otherwise routes `A->B` and `B->A` or oddly-named stations could merge.

#### Python
A tuple `(start, end)` is a hashable dict key for the totals map; check-ins stash a `(station, time)` tuple keyed by id.

```python
class UndergroundSystem:
    def __init__(self):
        self.checkins = {}
        self.totals = {}

    def checkIn(self, id: int, stationName: str, t: int) -> None:
        self.checkins[id] = (stationName, t)

    def checkOut(self, id: int, stationName: str, t: int) -> None:
        start, startTime = self.checkins.pop(id)
        key = (start, stationName)
        total, count = self.totals.get(key, (0, 0))
        self.totals[key] = (total + (t - startTime), count + 1)

    def getAverageTime(self, startStation: str, endStation: str) -> float:
        total, count = self.totals[(startStation, endStation)]
        return total / count
```

#### Java
`HashMap` from id to a small check-in record; the route key is the joined station names mapping to a `double[]{sum, count}` accumulator.

```java
import java.util.*;

class UndergroundSystem {
    private final Map<Integer, int[]> checkins = new HashMap<>();
    private final Map<Integer, String> checkinStation = new HashMap<>();
    private final Map<String, double[]> totals = new HashMap<>();

    public UndergroundSystem() {}

    public void checkIn(int id, String stationName, int t) {
        checkinStation.put(id, stationName);
        checkins.put(id, new int[]{t});
    }

    public void checkOut(int id, String stationName, int t) {
        String start = checkinStation.remove(id);
        int startTime = checkins.remove(id)[0];
        String key = start + "->" + stationName;
        double[] agg = totals.computeIfAbsent(key, k -> new double[2]);
        agg[0] += t - startTime;
        agg[1] += 1;
    }

    public double getAverageTime(String startStation, String endStation) {
        double[] agg = totals.get(startStation + "->" + endStation);
        return agg[0] / agg[1];
    }
}
```

#### Rust
`HashMap<i32, (String, i32)>` for active trips and `HashMap<(String, String), (f64, i32)>` keyed by an owned tuple for the running totals.

```rust
use std::collections::HashMap;

struct UndergroundSystem {
    checkins: HashMap<i32, (String, i32)>,
    totals: HashMap<(String, String), (f64, i32)>,
}

impl UndergroundSystem {
    fn new() -> Self {
        UndergroundSystem { checkins: HashMap::new(), totals: HashMap::new() }
    }

    fn check_in(&mut self, id: i32, station_name: String, t: i32) {
        self.checkins.insert(id, (station_name, t));
    }

    fn check_out(&mut self, id: i32, station_name: String, t: i32) {
        let (start, start_time) = self.checkins.remove(&id).unwrap();
        let entry = self.totals.entry((start, station_name)).or_insert((0.0, 0));
        entry.0 += (t - start_time) as f64;
        entry.1 += 1;
    }

    fn get_average_time(&self, start_station: String, end_station: String) -> f64 {
        let (total, count) = self.totals[&(start_station, end_station)];
        total / count as f64
    }
}
```

#### Go
Maps keyed by id for active check-ins and by a struct `{start, end string}` for per-route sum and count.

```go
type checkinInfo struct {
	station string
	time    int
}

type route struct {
	start, end string
}

type total struct {
	sum   int
	count int
}

type UndergroundSystem struct {
	checkins map[int]checkinInfo
	totals   map[route]total
}

func Constructor() UndergroundSystem {
	return UndergroundSystem{
		checkins: map[int]checkinInfo{},
		totals:   map[route]total{},
	}
}

func (u *UndergroundSystem) CheckIn(id int, stationName string, t int) {
	u.checkins[id] = checkinInfo{stationName, t}
}

func (u *UndergroundSystem) CheckOut(id int, stationName string, t int) {
	in := u.checkins[id]
	delete(u.checkins, id)
	key := route{in.station, stationName}
	agg := u.totals[key]
	agg.sum += t - in.time
	agg.count++
	u.totals[key] = agg
}

func (u *UndergroundSystem) GetAverageTime(startStation string, endStation string) float64 {
	agg := u.totals[route{startStation, endStation}]
	return float64(agg.sum) / float64(agg.count)
}
```

#### C++
`unordered_map<int, pair<string,int>>` for active trips and an `unordered_map<string, pair<double,int>>` keyed by joined station names for route totals.

```cpp
#include <string>
#include <utility>
#include <unordered_map>
using namespace std;

class UndergroundSystem {
    unordered_map<int, pair<string,int>> checkins;
    unordered_map<string, pair<double,int>> totals;
public:
    UndergroundSystem() {}

    void checkIn(int id, string stationName, int t) {
        checkins[id] = {stationName, t};
    }

    void checkOut(int id, string stationName, int t) {
        auto [start, startTime] = checkins[id];
        checkins.erase(id);
        string key = start + "->" + stationName;
        auto& agg = totals[key];
        agg.first += t - startTime;
        agg.second += 1;
    }

    double getAverageTime(string startStation, string endStation) {
        auto& agg = totals[startStation + "->" + endStation];
        return agg.first / agg.second;
    }
};
```

### 61. Design Parking System

#### Problem
Implement `ParkingSystem`. The constructor takes the number of slots of three car types: `ParkingSystem(int big, int medium, int small)`. Method `addCar(int carType)` where `carType` is 1 (big), 2 (medium), or 3 (small) parks a car of that type if a slot is free, returning `true` and consuming the slot, or `false` if that type is full. Both operations must be O(1).

#### Pattern
**Fixed-size counter array.** **O(1)** per operation, **O(1)** space. Index the array by `carType - 1` and decrement on a successful park.

#### Explanation
There is nothing to search here: the entire state is three integers, one remaining-capacity counter per car type. Storing them in a length-3 array lets `addCar` map `carType` (1..3) directly to index `carType - 1`, check for a free slot, decrement, and return in constant time. The only edge case is a full lot for the requested type, which is the `count == 0` branch returning `false`. Keeping the counts in an array rather than three named fields removes the branch-on-type and keeps the method a single expression, which is the whole point of the exercise: recognising that a "system" question can collapse to trivial state.

#### Python
A plain list indexed by `carType - 1`; no imports needed.

```python
class ParkingSystem:
    def __init__(self, big: int, medium: int, small: int):
        self.slots = [big, medium, small]

    def addCar(self, carType: int) -> bool:
        if self.slots[carType - 1] > 0:
            self.slots[carType - 1] -= 1
            return True
        return False
```

#### Java
A primitive `int[]` initialised with an array literal keeps the whole state on the stack-friendly path.

```java
class ParkingSystem {
    private final int[] slots;

    public ParkingSystem(int big, int medium, int small) {
        slots = new int[]{big, medium, small};
    }

    public boolean addCar(int carType) {
        if (slots[carType - 1] > 0) {
            slots[carType - 1]--;
            return true;
        }
        return false;
    }
}
```

#### Rust
A fixed `[i32; 3]` array; cast `car_type - 1` to `usize` once for indexing.

```rust
struct ParkingSystem {
    slots: [i32; 3],
}

impl ParkingSystem {
    fn new(big: i32, medium: i32, small: i32) -> Self {
        ParkingSystem { slots: [big, medium, small] }
    }

    fn add_car(&mut self, car_type: i32) -> bool {
        let i = (car_type - 1) as usize;
        if self.slots[i] > 0 {
            self.slots[i] -= 1;
            true
        } else {
            false
        }
    }
}
```

#### Go
A fixed `[3]int` array value embedded in the struct; the receiver is a pointer so mutation sticks.

```go
type ParkingSystem struct {
    slots [3]int
}

func Constructor(big int, medium int, small int) ParkingSystem {
    return ParkingSystem{slots: [3]int{big, medium, small}}
}

func (p *ParkingSystem) AddCar(carType int) bool {
    if p.slots[carType-1] > 0 {
        p.slots[carType-1]--
        return true
    }
    return false
}
```

#### C++
A raw `int slots[3]` member set in the constructor body keeps it as tight as the problem allows.

```cpp
class ParkingSystem {
    int slots[3];
public:
    ParkingSystem(int big, int medium, int small) {
        slots[0] = big;
        slots[1] = medium;
        slots[2] = small;
    }

    bool addCar(int carType) {
        if (slots[carType - 1] > 0) {
            slots[carType - 1]--;
            return true;
        }
        return false;
    }
};
```

### 62. Design Snake Game

#### Problem
Implement `SnakeGame(int width, int height, int[][] food)` where `food` is the ordered list of `[row, col]` food cells. The snake starts at cell `(0, 0)` with length 1. Method `move(String direction)` (one of "U", "D", "L", "R") advances the snake one cell in that direction and returns the current score, or `-1` if the game ends (the head leaves the grid or bites its own body). Eating the next food (in order) grows the snake by one and increments the score; otherwise the tail follows the head.

#### Pattern
**Deque for the body plus a hash set of occupied cells.** **O(1)** per move, **O(L)** space where L is the snake length. The set gives O(1) self-collision tests; a food-index pointer tracks the next pellet.

#### Explanation
The subtlety is the ordering of the tail move relative to the self-collision check. When the snake does not eat, the tail vacates its cell in the same step the head enters a new one, so the cell the tail is leaving must be freed *before* testing whether the new head collides with the body. Otherwise a snake chasing its own tail would falsely report a bite. So the algorithm is: compute the new head, reject if out of bounds, decide if it eats the current food (compare against `food[foodIdx]` and advance the pointer if so), and if it does not eat, pop the tail from both the deque and the occupancy set. Only then test the new head against the set. The deque preserves head/tail order for O(1) growth at the front and shrink at the back; the set exists purely so the membership test is O(1) instead of scanning the body. Encoding each cell as `row * width + col` (or a tuple) keys the set uniquely.

#### Python
`collections.deque` with `appendleft`/`pop`, and a `set` of `(r, c)` tuples for O(1) collision checks.

```python
from collections import deque

class SnakeGame:
    def __init__(self, width: int, height: int, food: list[list[int]]):
        self.width = width
        self.height = height
        self.food = food
        self.food_idx = 0
        self.score = 0
        self.snake = deque([(0, 0)])
        self.body = {(0, 0)}

    def move(self, direction: str) -> int:
        r, c = self.snake[0]
        if direction == "U":
            r -= 1
        elif direction == "D":
            r += 1
        elif direction == "L":
            c -= 1
        else:
            c += 1

        if r < 0 or r >= self.height or c < 0 or c >= self.width:
            return -1

        ate = (self.food_idx < len(self.food)
               and self.food[self.food_idx] == [r, c])
        if ate:
            self.food_idx += 1
            self.score += 1
        else:
            self.body.remove(self.snake.pop())

        if (r, c) in self.body:
            return -1

        self.snake.appendleft((r, c))
        self.body.add((r, c))
        return self.score
```

#### Java
`ArrayDeque<int[]>` for the body and a `HashSet<Integer>` keyed by `row * width + col` for collision.

```java
import java.util.*;

class SnakeGame {
    private final int width, height;
    private final int[][] food;
    private int foodIdx = 0, score = 0;
    private final Deque<int[]> snake = new ArrayDeque<>();
    private final Set<Integer> body = new HashSet<>();

    public SnakeGame(int width, int height, int[][] food) {
        this.width = width;
        this.height = height;
        this.food = food;
        snake.offerFirst(new int[]{0, 0});
        body.add(0);
    }

    private int key(int r, int c) {
        return r * width + c;
    }

    public int move(String direction) {
        int[] head = snake.peekFirst();
        int r = head[0], c = head[1];
        switch (direction) {
            case "U": r--; break;
            case "D": r++; break;
            case "L": c--; break;
            default:  c++; break;
        }

        if (r < 0 || r >= height || c < 0 || c >= width) return -1;

        boolean ate = foodIdx < food.length
                && food[foodIdx][0] == r && food[foodIdx][1] == c;
        if (ate) {
            foodIdx++;
            score++;
        } else {
            int[] tail = snake.pollLast();
            body.remove(key(tail[0], tail[1]));
        }

        if (body.contains(key(r, c))) return -1;

        snake.offerFirst(new int[]{r, c});
        body.add(key(r, c));
        return score;
    }
}
```

#### Rust
`VecDeque<(i32, i32)>` for the body and a `HashSet<(i32, i32)>`; destructure the front with `&(mut r, mut c)` since tuples of `i32` are `Copy`.

```rust
use std::collections::{HashSet, VecDeque};

struct SnakeGame {
    width: i32,
    height: i32,
    food: Vec<Vec<i32>>,
    food_idx: usize,
    score: i32,
    snake: VecDeque<(i32, i32)>,
    body: HashSet<(i32, i32)>,
}

impl SnakeGame {
    fn new(width: i32, height: i32, food: Vec<Vec<i32>>) -> Self {
        let mut snake = VecDeque::new();
        snake.push_front((0, 0));
        let mut body = HashSet::new();
        body.insert((0, 0));
        SnakeGame { width, height, food, food_idx: 0, score: 0, snake, body }
    }

    fn move_(&mut self, direction: String) -> i32 {
        let &(mut r, mut c) = self.snake.front().unwrap();
        match direction.as_str() {
            "U" => r -= 1,
            "D" => r += 1,
            "L" => c -= 1,
            _ => c += 1,
        }

        if r < 0 || r >= self.height || c < 0 || c >= self.width {
            return -1;
        }

        let ate = self.food_idx < self.food.len()
            && self.food[self.food_idx][0] == r
            && self.food[self.food_idx][1] == c;
        if ate {
            self.food_idx += 1;
            self.score += 1;
        } else {
            let tail = self.snake.pop_back().unwrap();
            self.body.remove(&tail);
        }

        if self.body.contains(&(r, c)) {
            return -1;
        }

        self.snake.push_front((r, c));
        self.body.insert((r, c));
        self.score
    }
}
```

#### Go
A slice as the body with a `map[[2]int]bool` occupancy set; prepend the new head so index 0 stays the front.

```go
type SnakeGame struct {
    width, height int
    food          [][]int
    foodIdx       int
    score         int
    snake         [][2]int
    body          map[[2]int]bool
}

func Constructor(width int, height int, food [][]int) SnakeGame {
    return SnakeGame{
        width:  width,
        height: height,
        food:   food,
        snake:  [][2]int{{0, 0}},
        body:   map[[2]int]bool{{0, 0}: true},
    }
}

func (g *SnakeGame) Move(direction string) int {
    head := g.snake[0]
    r, c := head[0], head[1]
    switch direction {
    case "U":
        r--
    case "D":
        r++
    case "L":
        c--
    default:
        c++
    }

    if r < 0 || r >= g.height || c < 0 || c >= g.width {
        return -1
    }

    ate := g.foodIdx < len(g.food) &&
        g.food[g.foodIdx][0] == r && g.food[g.foodIdx][1] == c
    if ate {
        g.foodIdx++
        g.score++
    } else {
        tail := g.snake[len(g.snake)-1]
        g.snake = g.snake[:len(g.snake)-1]
        delete(g.body, tail)
    }

    if g.body[[2]int{r, c}] {
        return -1
    }

    g.snake = append([][2]int{{r, c}}, g.snake...)
    g.body[[2]int{r, c}] = true
    return g.score
}
```

#### C++
`std::deque<pair<int,int>>` for the body and an `unordered_set<int>` keyed by `r * width + c`; structured bindings read the front.

```cpp
#include <deque>
#include <unordered_set>
#include <vector>
#include <string>
using namespace std;

class SnakeGame {
    int width, height;
    vector<vector<int>> food;
    int foodIdx = 0, score = 0;
    deque<pair<int,int>> snake;
    unordered_set<int> body;

    int key(int r, int c) { return r * width + c; }

public:
    SnakeGame(int width, int height, vector<vector<int>>& food)
        : width(width), height(height), food(food) {
        snake.push_front({0, 0});
        body.insert(key(0, 0));
    }

    int move(string direction) {
        auto [r, c] = snake.front();
        if (direction == "U") r--;
        else if (direction == "D") r++;
        else if (direction == "L") c--;
        else c++;

        if (r < 0 || r >= height || c < 0 || c >= width) return -1;

        bool ate = foodIdx < (int)food.size()
                   && food[foodIdx][0] == r && food[foodIdx][1] == c;
        if (ate) {
            foodIdx++;
            score++;
        } else {
            auto tail = snake.back();
            snake.pop_back();
            body.erase(key(tail.first, tail.second));
        }

        if (body.count(key(r, c))) return -1;

        snake.push_front({r, c});
        body.insert(key(r, c));
        return score;
    }
};
```

### 63. Design Tic-Tac-Toe

#### Problem
Implement `TicTacToe(int n)` for an `n x n` board with two players. Method `move(int row, int col, int player)` places `player`'s mark (player is 1 or 2) at an empty cell and returns the id of the winning player (1 or 2) if that move completes a full row, column, or diagonal, otherwise 0. Each move must run in O(1) time (no scanning the board).

#### Pattern
**Signed running sums per line.** **O(1)** per move, **O(n)** space. Player 1 adds +1, player 2 adds -1; a line whose absolute sum reaches n is fully owned by one player.

#### Explanation
The trick that hits O(1) is to never look at the board as a grid. A row (or column, or diagonal) is won when all n of its cells belong to one player. Track one integer per row, one per column, and two for the diagonals, and let player 1 contribute +1 and player 2 contribute -1 to each line the move touches. After a move, if any touched line's running sum has absolute value n, every cell on that line was placed by the same player (all +1 or all -1), so that player wins. This replaces an O(n) win-check with four `abs(...) == n` comparisons. A cell lies on the main diagonal when `row == col` and on the anti-diagonal when `row + col == n - 1`; those two conditions are independent (the center of an odd board is on both). No board array is even required.

#### Python
Two lists for rows and cols plus two scalars for the diagonals; `abs` on the four touched sums.

```python
class TicTacToe:
    def __init__(self, n: int):
        self.n = n
        self.rows = [0] * n
        self.cols = [0] * n
        self.diag = 0
        self.anti = 0

    def move(self, row: int, col: int, player: int) -> int:
        delta = 1 if player == 1 else -1
        self.rows[row] += delta
        self.cols[col] += delta
        if row == col:
            self.diag += delta
        if row + col == self.n - 1:
            self.anti += delta

        if (abs(self.rows[row]) == self.n
                or abs(self.cols[col]) == self.n
                or abs(self.diag) == self.n
                or abs(self.anti) == self.n):
            return player
        return 0
```

#### Java
Primitive `int[]` arrays and `Math.abs`; `delta` is a single ternary off the player id.

```java
class TicTacToe {
    private final int n;
    private final int[] rows, cols;
    private int diag = 0, anti = 0;

    public TicTacToe(int n) {
        this.n = n;
        rows = new int[n];
        cols = new int[n];
    }

    public int move(int row, int col, int player) {
        int delta = player == 1 ? 1 : -1;
        rows[row] += delta;
        cols[col] += delta;
        if (row == col) diag += delta;
        if (row + col == n - 1) anti += delta;

        if (Math.abs(rows[row]) == n || Math.abs(cols[col]) == n
                || Math.abs(diag) == n || Math.abs(anti) == n) {
            return player;
        }
        return 0;
    }
}
```

#### Rust
`Vec<i32>` for the lines and `i32::abs`; cast `row`/`col` to `usize` once for indexing.

```rust
struct TicTacToe {
    n: i32,
    rows: Vec<i32>,
    cols: Vec<i32>,
    diag: i32,
    anti: i32,
}

impl TicTacToe {
    fn new(n: i32) -> Self {
        TicTacToe {
            n,
            rows: vec![0; n as usize],
            cols: vec![0; n as usize],
            diag: 0,
            anti: 0,
        }
    }

    fn move_(&mut self, row: i32, col: i32, player: i32) -> i32 {
        let delta = if player == 1 { 1 } else { -1 };
        let (r, c) = (row as usize, col as usize);
        self.rows[r] += delta;
        self.cols[c] += delta;
        if row == col {
            self.diag += delta;
        }
        if row + col == self.n - 1 {
            self.anti += delta;
        }

        if self.rows[r].abs() == self.n
            || self.cols[c].abs() == self.n
            || self.diag.abs() == self.n
            || self.anti.abs() == self.n
        {
            return player;
        }
        0
    }
}
```

#### Go
Slices for rows and cols; a small `abs` helper since the stdlib `math.Abs` is float-only.

```go
type TicTacToe struct {
    n          int
    rows, cols []int
    diag, anti int
}

func Constructor(n int) TicTacToe {
    return TicTacToe{
        n:    n,
        rows: make([]int, n),
        cols: make([]int, n),
    }
}

func (t *TicTacToe) Move(row int, col int, player int) int {
    delta := 1
    if player == 2 {
        delta = -1
    }
    t.rows[row] += delta
    t.cols[col] += delta
    if row == col {
        t.diag += delta
    }
    if row+col == t.n-1 {
        t.anti += delta
    }

    if abs(t.rows[row]) == t.n || abs(t.cols[col]) == t.n ||
        abs(t.diag) == t.n || abs(t.anti) == t.n {
        return player
    }
    return 0
}

func abs(x int) int {
    if x < 0 {
        return -x
    }
    return x
}
```

#### C++
`std::vector<int>` for the lines and `std::abs` from `<cstdlib>`; members initialised in the constructor list.

```cpp
#include <vector>
#include <cstdlib>
using namespace std;

class TicTacToe {
    int n;
    vector<int> rows, cols;
    int diag = 0, anti = 0;

public:
    TicTacToe(int n) : n(n), rows(n, 0), cols(n, 0) {}

    int move(int row, int col, int player) {
        int delta = player == 1 ? 1 : -1;
        rows[row] += delta;
        cols[col] += delta;
        if (row == col) diag += delta;
        if (row + col == n - 1) anti += delta;

        if (abs(rows[row]) == n || abs(cols[col]) == n
                || abs(diag) == n || abs(anti) == n) {
            return player;
        }
        return 0;
    }
};
```

### 64. Design Movie Rental System

#### Problem
Implement `MovieRentingSystem(int n, int[][] entries)` where each entry is `[shop, movie, price]` and each shop stocks at most one copy of a given movie. Support: `search(int movie)` returning the shops with an unrented copy of `movie`, cheapest first (ties by smaller shop id), at most 5 shop ids; `rent(int shop, int movie)` and `drop(int shop, int movie)` toggling a copy's rented state; and `report()` returning the 5 cheapest currently-rented `[shop, movie]` pairs ordered by price, then shop, then movie. All queries return small fixed-size lists.

#### Pattern
**Two ordered sets plus a price lookup.** **O(log n)** per rent/drop, **O(log n + 5)** per query. One sorted set of `(price, shop)` per movie for availability, one global sorted set of `(price, shop, movie)` for rentals; a hash map holds each copy's price.

#### Explanation
Every query wants the smallest few elements of a set ordered by a compound key, and rent/drop move a single copy between "available for movie m" and "rented", so a balanced ordered set (red-black tree) is the natural fit: it keeps elements sorted and supports O(log n) insert/erase plus an in-order walk to grab the first five. Availability is partitioned by movie, so keep a map `movie -> orderedSet<(price, shop)>`; rentals are global, so keep one `orderedSet<(price, shop, movie)>`. A separate hash map `(shop, movie) -> price` lets rent/drop reconstruct the exact key to erase from one set and insert into the other in O(log n) without re-scanning. `search` and `report` just iterate the front of the relevant set until they have five. Python's standard library has no balanced set, so it uses lazy-deletion heaps that skip and discard stale entries during extraction (a dropped copy is re-pushed on `drop`, so permanently discarding a stale heap entry is safe), deduping by shop so a rent/drop cycle cannot surface the same copy twice.

#### Python
No stdlib ordered set, so use per-movie and global `heapq` min-heaps with lazy deletion: pop stale/duplicate entries, keep the 5 valid ones, and push those back.

```python
import heapq

class MovieRentingSystem:
    def __init__(self, n: int, entries: list[list[int]]):
        self.price = {}
        self.avail = {}          # movie -> heap of (price, shop)
        self.rented_heap = []    # heap of (price, shop, movie)
        self.is_rented = set()   # (shop, movie)
        for shop, movie, p in entries:
            self.price[(shop, movie)] = p
            self.avail.setdefault(movie, []).append((p, shop))
        for movie in self.avail:
            heapq.heapify(self.avail[movie])

    def search(self, movie: int) -> list[int]:
        heap = self.avail.get(movie, [])
        res, seen, buf = [], set(), []
        while heap and len(res) < 5:
            p, shop = heapq.heappop(heap)
            if (shop, movie) in self.is_rented or shop in seen:
                continue
            seen.add(shop)
            res.append(shop)
            buf.append((p, shop))
        for item in buf:
            heapq.heappush(heap, item)
        return res

    def rent(self, shop: int, movie: int) -> None:
        self.is_rented.add((shop, movie))
        heapq.heappush(self.rented_heap, (self.price[(shop, movie)], shop, movie))

    def drop(self, shop: int, movie: int) -> None:
        self.is_rented.discard((shop, movie))
        heapq.heappush(self.avail.setdefault(movie, []),
                       (self.price[(shop, movie)], shop))

    def report(self) -> list[list[int]]:
        res, seen, buf = [], set(), []
        while self.rented_heap and len(res) < 5:
            p, shop, movie = heapq.heappop(self.rented_heap)
            if (shop, movie) not in self.is_rented or (shop, movie) in seen:
                continue
            seen.add((shop, movie))
            res.append([shop, movie])
            buf.append((p, shop, movie))
        for item in buf:
            heapq.heappush(self.rented_heap, item)
        return res
```

#### Java
`TreeSet` with custom comparators gives true O(log n) ordered inserts/erases; `remove(new int[]{...})` works because equality is defined by the comparator.

```java
import java.util.*;

class MovieRentingSystem {
    private final Map<Long, Integer> price = new HashMap<>();
    private final Map<Integer, TreeSet<int[]>> available = new HashMap<>();
    private final TreeSet<int[]> rented;

    private long key(int shop, int movie) {
        return (long) shop * 100001 + movie;
    }

    public MovieRentingSystem(int n, int[][] entries) {
        Comparator<int[]> byPriceShop = (a, b) ->
            a[0] != b[0] ? a[0] - b[0] : a[1] - b[1];
        rented = new TreeSet<>((a, b) -> {
            if (a[0] != b[0]) return a[0] - b[0];
            if (a[1] != b[1]) return a[1] - b[1];
            return a[2] - b[2];
        });
        for (int[] e : entries) {
            int shop = e[0], movie = e[1], p = e[2];
            price.put(key(shop, movie), p);
            available.computeIfAbsent(movie, k -> new TreeSet<>(byPriceShop))
                     .add(new int[]{p, shop});
        }
    }

    public List<Integer> search(int movie) {
        List<Integer> res = new ArrayList<>();
        TreeSet<int[]> set = available.get(movie);
        if (set == null) return res;
        for (int[] item : set) {
            res.add(item[1]);
            if (res.size() == 5) break;
        }
        return res;
    }

    public void rent(int shop, int movie) {
        int p = price.get(key(shop, movie));
        available.get(movie).remove(new int[]{p, shop});
        rented.add(new int[]{p, shop, movie});
    }

    public void drop(int shop, int movie) {
        int p = price.get(key(shop, movie));
        rented.remove(new int[]{p, shop, movie});
        available.get(movie).add(new int[]{p, shop});
    }

    public List<List<Integer>> report() {
        List<List<Integer>> res = new ArrayList<>();
        for (int[] item : rented) {
            res.add(Arrays.asList(item[1], item[2]));
            if (res.size() == 5) break;
        }
        return res;
    }
}
```

#### Rust
`BTreeSet` of tuples sorts lexicographically for free; iterate `.take(5)`. Availability is a `HashMap<i32, BTreeSet<(i32,i32)>>`, rentals a single `BTreeSet<(i32,i32,i32)>`.

```rust
use std::collections::{BTreeSet, HashMap};

struct MovieRentingSystem {
    price: HashMap<(i32, i32), i32>,
    available: HashMap<i32, BTreeSet<(i32, i32)>>,
    rented: BTreeSet<(i32, i32, i32)>,
}

impl MovieRentingSystem {
    fn new(_n: i32, entries: Vec<Vec<i32>>) -> Self {
        let mut price = HashMap::new();
        let mut available: HashMap<i32, BTreeSet<(i32, i32)>> = HashMap::new();
        for e in &entries {
            let (shop, movie, p) = (e[0], e[1], e[2]);
            price.insert((shop, movie), p);
            available.entry(movie).or_default().insert((p, shop));
        }
        MovieRentingSystem { price, available, rented: BTreeSet::new() }
    }

    fn search(&self, movie: i32) -> Vec<i32> {
        match self.available.get(&movie) {
            Some(set) => set.iter().take(5).map(|&(_, shop)| shop).collect(),
            None => Vec::new(),
        }
    }

    fn rent(&mut self, shop: i32, movie: i32) {
        let p = self.price[&(shop, movie)];
        if let Some(set) = self.available.get_mut(&movie) {
            set.remove(&(p, shop));
        }
        self.rented.insert((p, shop, movie));
    }

    fn drop(&mut self, shop: i32, movie: i32) {
        let p = self.price[&(shop, movie)];
        self.rented.remove(&(p, shop, movie));
        self.available.entry(movie).or_default().insert((p, shop));
    }

    fn report(&self) -> Vec<Vec<i32>> {
        self.rented
            .iter()
            .take(5)
            .map(|&(_, shop, movie)| vec![shop, movie])
            .collect()
    }
}
```

#### Go
No ordered container in the stdlib, so keep sorted slices and use `sort.Search` for O(log n) locate plus O(n) splice on insert/erase; the first five elements are already in order.

```go
import "sort"

type MovieRentingSystem struct {
    price     map[[2]int]int   // {shop, movie} -> price
    available map[int][][2]int // movie -> sorted []{price, shop}
    rented    [][3]int         // sorted []{price, shop, movie}
}

func less2(a, b [2]int) bool {
    if a[0] != b[0] {
        return a[0] < b[0]
    }
    return a[1] < b[1]
}

func less3(a, b [3]int) bool {
    if a[0] != b[0] {
        return a[0] < b[0]
    }
    if a[1] != b[1] {
        return a[1] < b[1]
    }
    return a[2] < b[2]
}

func Constructor(n int, entries [][]int) MovieRentingSystem {
    m := MovieRentingSystem{
        price:     make(map[[2]int]int),
        available: make(map[int][][2]int),
    }
    for _, e := range entries {
        shop, movie, p := e[0], e[1], e[2]
        m.price[[2]int{shop, movie}] = p
        m.available[movie] = append(m.available[movie], [2]int{p, shop})
    }
    for movie := range m.available {
        list := m.available[movie]
        sort.Slice(list, func(i, j int) bool { return less2(list[i], list[j]) })
    }
    return m
}

func (m *MovieRentingSystem) Search(movie int) []int {
    list := m.available[movie]
    res := []int{}
    for i := 0; i < len(list) && i < 5; i++ {
        res = append(res, list[i][1])
    }
    return res
}

func (m *MovieRentingSystem) Rent(shop int, movie int) {
    p := m.price[[2]int{shop, movie}]
    list := m.available[movie]
    target := [2]int{p, shop}
    i := sort.Search(len(list), func(k int) bool { return !less2(list[k], target) })
    m.available[movie] = append(list[:i], list[i+1:]...)

    t := [3]int{p, shop, movie}
    j := sort.Search(len(m.rented), func(k int) bool { return !less3(m.rented[k], t) })
    m.rented = append(m.rented, [3]int{})
    copy(m.rented[j+1:], m.rented[j:])
    m.rented[j] = t
}

func (m *MovieRentingSystem) Drop(shop int, movie int) {
    p := m.price[[2]int{shop, movie}]
    t := [3]int{p, shop, movie}
    j := sort.Search(len(m.rented), func(k int) bool { return !less3(m.rented[k], t) })
    m.rented = append(m.rented[:j], m.rented[j+1:]...)

    list := m.available[movie]
    target := [2]int{p, shop}
    i := sort.Search(len(list), func(k int) bool { return !less2(list[k], target) })
    list = append(list, [2]int{})
    copy(list[i+1:], list[i:])
    list[i] = target
    m.available[movie] = list
}

func (m *MovieRentingSystem) Report() [][]int {
    res := [][]int{}
    for i := 0; i < len(m.rented) && i < 5; i++ {
        res = append(res, []int{m.rented[i][1], m.rented[i][2]})
    }
    return res
}
```

#### C++
`std::set<pair<int,int>>` per movie and a global `std::set<array<int,3>>`; both keep lexicographic order so `erase`/`insert` are O(log n) and the front five are the answer.

```cpp
#include <vector>
#include <set>
#include <unordered_map>
#include <array>
using namespace std;

class MovieRentingSystem {
    unordered_map<long long, int> price;
    unordered_map<int, set<pair<int,int>>> available;
    set<array<int,3>> rented;

    long long key(int shop, int movie) {
        return (long long) shop * 100001 + movie;
    }

public:
    MovieRentingSystem(int n, vector<vector<int>>& entries) {
        for (auto& e : entries) {
            int shop = e[0], movie = e[1], p = e[2];
            price[key(shop, movie)] = p;
            available[movie].insert({p, shop});
        }
    }

    vector<int> search(int movie) {
        vector<int> res;
        auto it = available.find(movie);
        if (it == available.end()) return res;
        for (auto& pr : it->second) {
            res.push_back(pr.second);
            if (res.size() == 5) break;
        }
        return res;
    }

    void rent(int shop, int movie) {
        int p = price[key(shop, movie)];
        available[movie].erase({p, shop});
        rented.insert({p, shop, movie});
    }

    void drop(int shop, int movie) {
        int p = price[key(shop, movie)];
        rented.erase({p, shop, movie});
        available[movie].insert({p, shop});
    }

    vector<vector<int>> report() {
        vector<vector<int>> res;
        for (auto& t : rented) {
            res.push_back({t[1], t[2]});
            if (res.size() == 5) break;
        }
        return res;
    }
};
```

### 65. Design Video Sharing Platform

#### Problem
Implement `VideoSharingPlatform()`. `upload(String video)` stores a video (a string of digits) under the smallest unused non-negative id, reusing ids freed by removal, and returns that id. `remove(int videoId)` deletes the video if present and frees its id. `watch(int videoId, int startMinute, int endMinute)` increments the view count and returns the substring of minutes `[startMinute, min(endMinute, len-1)]`, or "-1" if absent. `like`/`dislike(int videoId)` bump counters; `getLikesAndDislikes(int videoId)` returns `[likes, dislikes]` or `[-1]`; `getViews(int videoId)` returns the view count or -1.

#### Pattern
**Hash map of videos plus a min-heap of freed ids.** **O(log n)** per upload/remove for id allocation, **O(1)** amortised for the rest. The heap guarantees the smallest reusable id; a counter supplies fresh ids when the heap is empty.

#### Explanation
Two facts drive the design. First, ids must be recycled and the *smallest* free id chosen, which is exactly a min-priority-queue: `remove` pushes the freed id, `upload` pops the minimum, and only when no ids have ever been freed do we hand out the next value of a monotonically increasing counter. That keeps allocation O(log n) and always minimal without scanning. Second, every other operation is a keyed lookup into a map from id to a small record of `(content, views, likes, dislikes)`, so they are O(1) apart from the substring copy in `watch`. The recurring edge case is "video does not exist" (removed or never uploaded), which each accessor guards, returning the sentinel `"-1"` / `[-1]` / `-1`. In `watch`, clamp `endMinute` to `len - 1` before slicing so an over-long range does not run off the end; since the content is digits (ASCII), byte-indexing the substring is safe.

#### Python
A `dict` id -> record and a `heapq` of freed ids; a `next_id` counter covers the never-freed case.

```python
import heapq

class VideoSharingPlatform:
    def __init__(self):
        self.videos = {}        # id -> [content, views, likes, dislikes]
        self.free = []          # min-heap of reusable ids
        self.next_id = 0

    def upload(self, video: str) -> int:
        if self.free:
            vid = heapq.heappop(self.free)
        else:
            vid = self.next_id
            self.next_id += 1
        self.videos[vid] = [video, 0, 0, 0]
        return vid

    def remove(self, videoId: int) -> None:
        if videoId in self.videos:
            del self.videos[videoId]
            heapq.heappush(self.free, videoId)

    def watch(self, videoId: int, startMinute: int, endMinute: int) -> str:
        if videoId not in self.videos:
            return "-1"
        v = self.videos[videoId]
        end = min(endMinute, len(v[0]) - 1)
        v[1] += 1
        return v[0][startMinute:end + 1]

    def like(self, videoId: int) -> None:
        if videoId in self.videos:
            self.videos[videoId][2] += 1

    def dislike(self, videoId: int) -> None:
        if videoId in self.videos:
            self.videos[videoId][3] += 1

    def getLikesAndDislikes(self, videoId: int) -> list[int]:
        if videoId not in self.videos:
            return [-1]
        v = self.videos[videoId]
        return [v[2], v[3]]

    def getViews(self, videoId: int) -> int:
        if videoId not in self.videos:
            return -1
        return self.videos[videoId][1]
```

#### Java
A `HashMap<Integer, Video>` and a `PriorityQueue<Integer>` (min-heap by default) for freed ids.

```java
import java.util.*;

class VideoSharingPlatform {
    private static class Video {
        String content;
        int views, likes, dislikes;
        Video(String content) { this.content = content; }
    }

    private final Map<Integer, Video> videos = new HashMap<>();
    private final PriorityQueue<Integer> free = new PriorityQueue<>();
    private int nextId = 0;

    public VideoSharingPlatform() {}

    public int upload(String video) {
        int id = free.isEmpty() ? nextId++ : free.poll();
        videos.put(id, new Video(video));
        return id;
    }

    public void remove(int videoId) {
        if (videos.remove(videoId) != null) {
            free.offer(videoId);
        }
    }

    public String watch(int videoId, int startMinute, int endMinute) {
        Video v = videos.get(videoId);
        if (v == null) return "-1";
        v.views++;
        int end = Math.min(endMinute, v.content.length() - 1);
        return v.content.substring(startMinute, end + 1);
    }

    public void like(int videoId) {
        Video v = videos.get(videoId);
        if (v != null) v.likes++;
    }

    public void dislike(int videoId) {
        Video v = videos.get(videoId);
        if (v != null) v.dislikes++;
    }

    public int[] getLikesAndDislikes(int videoId) {
        Video v = videos.get(videoId);
        if (v == null) return new int[]{-1};
        return new int[]{v.likes, v.dislikes};
    }

    public int getViews(int videoId) {
        Video v = videos.get(videoId);
        return v == null ? -1 : v.views;
    }
}
```

#### Rust
`BinaryHeap` is a max-heap, so wrap freed ids in `std::cmp::Reverse` to pop the smallest; store records in a `HashMap`.

```rust
use std::collections::{BinaryHeap, HashMap};
use std::cmp::Reverse;

struct Video {
    content: String,
    views: i32,
    likes: i32,
    dislikes: i32,
}

struct VideoSharingPlatform {
    videos: HashMap<i32, Video>,
    free: BinaryHeap<Reverse<i32>>,
    next_id: i32,
}

impl VideoSharingPlatform {
    fn new() -> Self {
        VideoSharingPlatform {
            videos: HashMap::new(),
            free: BinaryHeap::new(),
            next_id: 0,
        }
    }

    fn upload(&mut self, video: String) -> i32 {
        let id = match self.free.pop() {
            Some(Reverse(id)) => id,
            None => {
                let id = self.next_id;
                self.next_id += 1;
                id
            }
        };
        self.videos.insert(id, Video { content: video, views: 0, likes: 0, dislikes: 0 });
        id
    }

    fn remove(&mut self, video_id: i32) {
        if self.videos.remove(&video_id).is_some() {
            self.free.push(Reverse(video_id));
        }
    }

    fn watch(&mut self, video_id: i32, start_minute: i32, end_minute: i32) -> String {
        match self.videos.get_mut(&video_id) {
            Some(v) => {
                v.views += 1;
                let len = v.content.len() as i32;
                let end = end_minute.min(len - 1);
                v.content[start_minute as usize..(end + 1) as usize].to_string()
            }
            None => "-1".to_string(),
        }
    }

    fn like(&mut self, video_id: i32) {
        if let Some(v) = self.videos.get_mut(&video_id) {
            v.likes += 1;
        }
    }

    fn dislike(&mut self, video_id: i32) {
        if let Some(v) = self.videos.get_mut(&video_id) {
            v.dislikes += 1;
        }
    }

    fn get_likes_and_dislikes(&self, video_id: i32) -> Vec<i32> {
        match self.videos.get(&video_id) {
            Some(v) => vec![v.likes, v.dislikes],
            None => vec![-1],
        }
    }

    fn get_views(&self, video_id: i32) -> i32 {
        self.videos.get(&video_id).map_or(-1, |v| v.views)
    }
}
```

#### Go
`container/heap` over an `IntHeap` supplies the min-heap of freed ids; records live in a `map[int]*video` so mutations write through the pointer.

```go
import "container/heap"

type IntHeap []int

func (h IntHeap) Len() int           { return len(h) }
func (h IntHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h IntHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *IntHeap) Push(x any)        { *h = append(*h, x.(int)) }
func (h *IntHeap) Pop() any {
    old := *h
    n := len(old)
    x := old[n-1]
    *h = old[:n-1]
    return x
}

type video struct {
    content                string
    views, likes, dislikes int
}

type VideoSharingPlatform struct {
    videos map[int]*video
    free   *IntHeap
    nextID int
}

func Constructor() VideoSharingPlatform {
    h := &IntHeap{}
    heap.Init(h)
    return VideoSharingPlatform{videos: make(map[int]*video), free: h}
}

func (p *VideoSharingPlatform) Upload(v string) int {
    var id int
    if p.free.Len() > 0 {
        id = heap.Pop(p.free).(int)
    } else {
        id = p.nextID
        p.nextID++
    }
    p.videos[id] = &video{content: v}
    return id
}

func (p *VideoSharingPlatform) Remove(videoId int) {
    if _, ok := p.videos[videoId]; ok {
        delete(p.videos, videoId)
        heap.Push(p.free, videoId)
    }
}

func (p *VideoSharingPlatform) Watch(videoId int, startMinute int, endMinute int) string {
    v, ok := p.videos[videoId]
    if !ok {
        return "-1"
    }
    v.views++
    end := endMinute
    if end > len(v.content)-1 {
        end = len(v.content) - 1
    }
    return v.content[startMinute : end+1]
}

func (p *VideoSharingPlatform) Like(videoId int) {
    if v, ok := p.videos[videoId]; ok {
        v.likes++
    }
}

func (p *VideoSharingPlatform) Dislike(videoId int) {
    if v, ok := p.videos[videoId]; ok {
        v.dislikes++
    }
}

func (p *VideoSharingPlatform) GetLikesAndDislikes(videoId int) []int {
    v, ok := p.videos[videoId]
    if !ok {
        return []int{-1}
    }
    return []int{v.likes, v.dislikes}
}

func (p *VideoSharingPlatform) GetViews(videoId int) int {
    v, ok := p.videos[videoId]
    if !ok {
        return -1
    }
    return v.views
}
```

#### C++
`priority_queue<int, vector<int>, greater<int>>` is the min-heap of freed ids; an `unordered_map<int, Video>` holds records.

```cpp
#include <string>
#include <vector>
#include <unordered_map>
#include <queue>
#include <algorithm>
using namespace std;

class VideoSharingPlatform {
    struct Video {
        string content;
        int views = 0, likes = 0, dislikes = 0;
    };
    unordered_map<int, Video> videos;
    priority_queue<int, vector<int>, greater<int>> freeIds;
    int nextId = 0;

public:
    VideoSharingPlatform() {}

    int upload(string video) {
        int id;
        if (!freeIds.empty()) {
            id = freeIds.top();
            freeIds.pop();
        } else {
            id = nextId++;
        }
        videos[id] = Video{video, 0, 0, 0};
        return id;
    }

    void remove(int videoId) {
        if (videos.erase(videoId)) {
            freeIds.push(videoId);
        }
    }

    string watch(int videoId, int startMinute, int endMinute) {
        auto it = videos.find(videoId);
        if (it == videos.end()) return "-1";
        it->second.views++;
        int end = min(endMinute, (int)it->second.content.size() - 1);
        return it->second.content.substr(startMinute, end - startMinute + 1);
    }

    void like(int videoId) {
        auto it = videos.find(videoId);
        if (it != videos.end()) it->second.likes++;
    }

    void dislike(int videoId) {
        auto it = videos.find(videoId);
        if (it != videos.end()) it->second.dislikes++;
    }

    vector<int> getLikesAndDislikes(int videoId) {
        auto it = videos.find(videoId);
        if (it == videos.end()) return {-1};
        return {it->second.likes, it->second.dislikes};
    }

    int getViews(int videoId) {
        auto it = videos.find(videoId);
        return it == videos.end() ? -1 : it->second.views;
    }
};
```

### 66. Design a Todo List

#### Problem
Implement `TodoList()`. `addTask(int userId, String taskDescription, int dueDate, List<String> tags)` stores a task for the user and returns a globally unique, increasing task id. `getAllTasks(int userId)` returns the descriptions of the user's uncompleted tasks ordered by ascending `dueDate` (ties keep insertion order). `getTasksForTag(int userId, String tag)` does the same but only for tasks carrying `tag`. `completeTask(int userId, int taskId)` marks the task complete if it exists and belongs to that user.

#### Pattern
**Per-user insertion-ordered task lists plus a global id map.** **O(1)** add and complete, **O(k log k)** per query for k user tasks. A stable sort by `dueDate` preserves insertion order among ties; tags are stored per task as a set for O(1) membership.

#### Explanation
Keep every task in one record holding `userId`, description, `dueDate`, a tag set, and a `completed` flag, plus a global id counter that hands out increasing ids so "unique" and "insertion order" come for free. Index the records two ways: a map `taskId -> task` so `completeTask` is an O(1) ownership check and flag flip, and a map `userId -> [tasks in insertion order]` so queries touch only that user's tasks. Because the per-user list is already in insertion order, a *stable* sort by `dueDate` yields exactly the required tie-break without any secondary key. Filtering drops completed tasks and, for the tag query, tasks whose tag set does not contain the tag (an O(1) hash lookup). Marking complete is a lazy flag rather than a physical removal, which keeps `addTask`/`completeTask` O(1) and leaves the ordering work in the read path where it belongs. The main edge cases are an unknown user (return empty) and completing a task owned by a different user (no-op).

#### Python
`dict` maps for tasks and per-user id lists; Python's `list.sort` is stable, so a single `key=dueDate` honours the insertion-order tie-break.

```python
class TodoList:
    def __init__(self):
        self.tasks = {}          # taskId -> [userId, desc, dueDate, tagset, completed]
        self.user_tasks = {}     # userId -> list of taskId in insertion order
        self.next_id = 1

    def addTask(self, userId: int, taskDescription: str, dueDate: int, tags: list[str]) -> int:
        tid = self.next_id
        self.next_id += 1
        self.tasks[tid] = [userId, taskDescription, dueDate, set(tags), False]
        self.user_tasks.setdefault(userId, []).append(tid)
        return tid

    def _collect(self, userId: int, tag):
        ids = self.user_tasks.get(userId, [])
        pending = [self.tasks[t] for t in ids
                   if not self.tasks[t][4] and (tag is None or tag in self.tasks[t][3])]
        pending.sort(key=lambda x: x[2])
        return [t[1] for t in pending]

    def getAllTasks(self, userId: int) -> list[str]:
        return self._collect(userId, None)

    def getTasksForTag(self, userId: int, tag: str) -> list[str]:
        return self._collect(userId, tag)

    def completeTask(self, userId: int, taskId: int) -> None:
        t = self.tasks.get(taskId)
        if t is not None and t[0] == userId and not t[4]:
            t[4] = True
```

#### Java
`Comparator.comparingInt` fed to a stable `List.sort` keeps ties in insertion order; the task stores its `userId` so completion is an O(1) check.

```java
import java.util.*;

class TodoList {
    private static class Task {
        int id, userId, dueDate;
        String description;
        Set<String> tags;
        boolean completed = false;
        Task(int id, int userId, String description, int dueDate, Set<String> tags) {
            this.id = id;
            this.userId = userId;
            this.description = description;
            this.dueDate = dueDate;
            this.tags = tags;
        }
    }

    private final Map<Integer, List<Task>> userTasks = new HashMap<>();
    private final Map<Integer, Task> tasksById = new HashMap<>();
    private int nextId = 1;

    public TodoList() {}

    public int addTask(int userId, String taskDescription, int dueDate, List<String> tags) {
        Task t = new Task(nextId++, userId, taskDescription, dueDate, new HashSet<>(tags));
        userTasks.computeIfAbsent(userId, k -> new ArrayList<>()).add(t);
        tasksById.put(t.id, t);
        return t.id;
    }

    public List<String> getAllTasks(int userId) {
        return collect(userId, null);
    }

    public List<String> getTasksForTag(int userId, String tag) {
        return collect(userId, tag);
    }

    private List<String> collect(int userId, String tag) {
        List<Task> pending = new ArrayList<>();
        for (Task t : userTasks.getOrDefault(userId, Collections.emptyList())) {
            if (!t.completed && (tag == null || t.tags.contains(tag))) {
                pending.add(t);
            }
        }
        pending.sort(Comparator.comparingInt(t -> t.dueDate));
        List<String> res = new ArrayList<>();
        for (Task t : pending) res.add(t.description);
        return res;
    }

    public void completeTask(int userId, int taskId) {
        Task t = tasksById.get(taskId);
        if (t != null && t.userId == userId) {
            t.completed = true;
        }
    }
}
```

#### Rust
`sort_by_key` is stable, so filtering into a `Vec` (which stays in insertion order) then sorting by `due_date` gives the tie-break; tags live in a `HashSet<String>`.

```rust
use std::collections::{HashMap, HashSet};

struct Task {
    user_id: i32,
    description: String,
    due_date: i32,
    tags: HashSet<String>,
    completed: bool,
}

struct TodoList {
    tasks: HashMap<i32, Task>,
    user_tasks: HashMap<i32, Vec<i32>>,
    next_id: i32,
}

impl TodoList {
    fn new() -> Self {
        TodoList {
            tasks: HashMap::new(),
            user_tasks: HashMap::new(),
            next_id: 1,
        }
    }

    fn add_task(&mut self, user_id: i32, task_description: String, due_date: i32, tags: Vec<String>) -> i32 {
        let id = self.next_id;
        self.next_id += 1;
        self.tasks.insert(id, Task {
            user_id,
            description: task_description,
            due_date,
            tags: tags.into_iter().collect(),
            completed: false,
        });
        self.user_tasks.entry(user_id).or_default().push(id);
        id
    }

    fn get_all_tasks(&self, user_id: i32) -> Vec<String> {
        self.collect(user_id, None)
    }

    fn get_tasks_for_tag(&self, user_id: i32, tag: String) -> Vec<String> {
        self.collect(user_id, Some(tag))
    }

    fn complete_task(&mut self, user_id: i32, task_id: i32) {
        if let Some(t) = self.tasks.get_mut(&task_id) {
            if t.user_id == user_id {
                t.completed = true;
            }
        }
    }

    fn collect(&self, user_id: i32, tag: Option<String>) -> Vec<String> {
        let ids = match self.user_tasks.get(&user_id) {
            Some(ids) => ids,
            None => return Vec::new(),
        };
        let mut pending: Vec<&Task> = ids
            .iter()
            .filter_map(|id| self.tasks.get(id))
            .filter(|t| !t.completed && tag.as_ref().map_or(true, |g| t.tags.contains(g)))
            .collect();
        pending.sort_by_key(|t| t.due_date);
        pending.into_iter().map(|t| t.description.clone()).collect()
    }
}
```

#### Go
`sort.SliceStable` preserves the insertion order captured in the per-user slice; tags are a `map[string]bool` set, and an empty `tag` string means "all tasks".

```go
import "sort"

type todoTask struct {
    userID      int
    description string
    dueDate     int
    tags        map[string]bool
    completed   bool
}

type TodoList struct {
    tasks     map[int]*todoTask
    userTasks map[int][]*todoTask
    nextID    int
}

func Constructor() TodoList {
    return TodoList{
        tasks:     make(map[int]*todoTask),
        userTasks: make(map[int][]*todoTask),
        nextID:    1,
    }
}

func (l *TodoList) AddTask(userId int, taskDescription string, dueDate int, tags []string) int {
    id := l.nextID
    l.nextID++
    tagSet := make(map[string]bool, len(tags))
    for _, t := range tags {
        tagSet[t] = true
    }
    task := &todoTask{
        userID:      userId,
        description: taskDescription,
        dueDate:     dueDate,
        tags:        tagSet,
    }
    l.tasks[id] = task
    l.userTasks[userId] = append(l.userTasks[userId], task)
    return id
}

func (l *TodoList) collect(userId int, tag string) []string {
    var pending []*todoTask
    for _, t := range l.userTasks[userId] {
        if t.completed {
            continue
        }
        if tag != "" && !t.tags[tag] {
            continue
        }
        pending = append(pending, t)
    }
    sort.SliceStable(pending, func(i, j int) bool {
        return pending[i].dueDate < pending[j].dueDate
    })
    res := []string{}
    for _, t := range pending {
        res = append(res, t.description)
    }
    return res
}

func (l *TodoList) GetAllTasks(userId int) []string {
    return l.collect(userId, "")
}

func (l *TodoList) GetTasksForTag(userId int, tag string) []string {
    return l.collect(userId, tag)
}

func (l *TodoList) CompleteTask(userId int, taskId int) {
    if t, ok := l.tasks[taskId]; ok && t.userID == userId {
        t.completed = true
    }
}
```

#### C++
`std::stable_sort` keeps ties in insertion order; tags go in an `unordered_set<string>`, and an empty `tag` argument selects all tasks.

```cpp
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <algorithm>
using namespace std;

class TodoList {
    struct Task {
        int userId, dueDate;
        string description;
        unordered_set<string> tags;
        bool completed = false;
    };
    unordered_map<int, Task> tasksById;
    unordered_map<int, vector<int>> userTasks;
    int nextId = 1;

    vector<string> collect(int userId, const string& tag) {
        vector<Task*> pending;
        auto uit = userTasks.find(userId);
        if (uit != userTasks.end()) {
            for (int id : uit->second) {
                Task& t = tasksById[id];
                if (t.completed) continue;
                if (!tag.empty() && t.tags.find(tag) == t.tags.end()) continue;
                pending.push_back(&t);
            }
        }
        stable_sort(pending.begin(), pending.end(),
                    [](Task* a, Task* b) { return a->dueDate < b->dueDate; });
        vector<string> res;
        for (Task* t : pending) res.push_back(t->description);
        return res;
    }

public:
    TodoList() {}

    int addTask(int userId, string taskDescription, int dueDate, vector<string> tags) {
        int id = nextId++;
        Task t;
        t.userId = userId;
        t.dueDate = dueDate;
        t.description = taskDescription;
        t.tags = unordered_set<string>(tags.begin(), tags.end());
        tasksById[id] = t;
        userTasks[userId].push_back(id);
        return id;
    }

    vector<string> getAllTasks(int userId) {
        return collect(userId, "");
    }

    vector<string> getTasksForTag(int userId, string tag) {
        return collect(userId, tag);
    }

    void completeTask(int userId, int taskId) {
        auto it = tasksById.find(taskId);
        if (it != tasksById.end() && it->second.userId == userId) {
            it->second.completed = true;
        }
    }
};
```

### 67. Range Sum Query - Immutable

#### Problem
Implement `NumArray`, initialized once with an integer array `nums`. Support `sumRange(left, right)` returning the sum of elements from index `left` to `right` inclusive. The array is never modified after construction, and `sumRange` may be called many times, so it must run in O(1).

#### Pattern
**Prefix-sum array.** **O(1)** per query after **O(n)** build, **O(n)** space. Store cumulative sums and subtract two of them.

#### Explanation
The whole game here is amortizing the summation cost into the constructor. Build a `prefix` array where `prefix[i]` holds the sum of the first `i` elements (so `prefix[0] = 0`). Then the sum of any half-open window `[left, right]` is `prefix[right + 1] - prefix[left]` — one subtraction, no loop.

The off-by-one that trips people up is the extra leading zero: making `prefix` length `n + 1` lets `sumRange(0, k)` work without a special case, because `prefix[left]` for `left = 0` reads the sentinel `0`. This is the immutable baseline that problem 68 has to beat once updates enter the picture; with no updates, nothing beats a flat prefix array.

#### Python
`itertools.accumulate` builds the running totals in C; prepend a `0` sentinel so both endpoints index uniformly.

```python
from itertools import accumulate

class NumArray:
    def __init__(self, nums: list[int]):
        self.prefix = [0] + list(accumulate(nums))

    def sumRange(self, left: int, right: int) -> int:
        return self.prefix[right + 1] - self.prefix[left]
```

#### Java
A plain `int[]` of length `n + 1`; the loop carries the running sum forward.

```java
class NumArray {
    private final int[] prefix;

    public NumArray(int[] nums) {
        prefix = new int[nums.length + 1];
        for (int i = 0; i < nums.length; i++) {
            prefix[i + 1] = prefix[i] + nums[i];
        }
    }

    public int sumRange(int left, int right) {
        return prefix[right + 1] - prefix[left];
    }
}
```

#### Rust
`Vec<i32>` sized `n + 1`; iterate with `enumerate` to fill each running total.

```rust
struct NumArray {
    prefix: Vec<i32>,
}

impl NumArray {
    fn new(nums: Vec<i32>) -> Self {
        let mut prefix = vec![0; nums.len() + 1];
        for (i, &x) in nums.iter().enumerate() {
            prefix[i + 1] = prefix[i] + x;
        }
        NumArray { prefix }
    }

    fn sum_range(&self, left: i32, right: i32) -> i32 {
        self.prefix[(right + 1) as usize] - self.prefix[left as usize]
    }
}
```

#### Go
A `[]int` slice with `make(..., n+1)`; the sentinel zero at index 0 falls out for free.

```go
type NumArray struct {
    prefix []int
}

func Constructor(nums []int) NumArray {
    prefix := make([]int, len(nums)+1)
    for i, x := range nums {
        prefix[i+1] = prefix[i] + x
    }
    return NumArray{prefix: prefix}
}

func (na *NumArray) SumRange(left int, right int) int {
    return na.prefix[right+1] - na.prefix[left]
}
```

#### C++
`std::vector<int>` sized `n + 1`; `assign` zero-initializes including the sentinel.

```cpp
#include <vector>

class NumArray {
    std::vector<int> prefix;
public:
    NumArray(std::vector<int>& nums) {
        prefix.assign(nums.size() + 1, 0);
        for (size_t i = 0; i < nums.size(); i++) {
            prefix[i + 1] = prefix[i] + nums[i];
        }
    }

    int sumRange(int left, int right) {
        return prefix[right + 1] - prefix[left];
    }
};
```

### 68. Range Sum Query - Mutable

#### Problem
Implement `NumArray` supporting two operations after construction from `nums`: `update(index, val)` sets the element at `index` to `val`, and `sumRange(left, right)` returns the inclusive sum from `left` to `right`. Both operations are interleaved arbitrarily, so both must be sublinear — target O(log n) each.

#### Pattern
**Binary Indexed Tree (Fenwick tree).** **O(log n)** per update and per query, **O(n)** space. Each tree slot covers a power-of-two-sized block keyed by the lowest set bit.

#### Explanation
A flat prefix array gives O(1) queries but O(n) updates, because one changed element shifts every later prefix. A Fenwick tree balances both to O(log n) by storing partial sums over blocks whose length is the lowest set bit of the index: `tree[i]` covers `(i - (i & -i), i]`. Walking `i += i & -i` visits the O(log n) blocks that must absorb a point update; walking `i -= i & -i` visits the O(log n) blocks that compose a prefix sum.

The mutable twist versus a static Fenwick tree is `update` taking an absolute value, not a delta. We keep a mirror `nums` array, compute `delta = val - nums[index]`, apply that delta to the tree, then overwrite the mirror. The tree is 1-indexed (slot 0 is unused) so the `i & -i` bit trick works; the public `index` maps to `index + 1` internally. `sumRange(left, right)` is `prefix(right + 1) - prefix(left)`, same subtraction trick as the immutable version but now over a logarithmic structure.

#### Python
`i & -i` isolates the low bit directly on Python ints; keep a `nums` mirror to turn an absolute set into a delta.

```python
class NumArray:
    def __init__(self, nums: list[int]):
        self.n = len(nums)
        self.nums = [0] * self.n
        self.tree = [0] * (self.n + 1)
        for i, x in enumerate(nums):
            self.update(i, x)

    def update(self, index: int, val: int) -> None:
        delta = val - self.nums[index]
        self.nums[index] = val
        i = index + 1
        while i <= self.n:
            self.tree[i] += delta
            i += i & (-i)

    def _prefix(self, i: int) -> int:
        s = 0
        while i > 0:
            s += self.tree[i]
            i -= i & (-i)
        return s

    def sumRange(self, left: int, right: int) -> int:
        return self._prefix(right + 1) - self._prefix(left)
```

#### Java
Two `int[]` arrays; the `for` loops encode the ascend/descend over lowest-set-bit blocks.

```java
class NumArray {
    private final int n;
    private final int[] nums;
    private final int[] tree;

    public NumArray(int[] nums) {
        this.n = nums.length;
        this.nums = new int[n];
        this.tree = new int[n + 1];
        for (int i = 0; i < n; i++) {
            update(i, nums[i]);
        }
    }

    public void update(int index, int val) {
        int delta = val - nums[index];
        nums[index] = val;
        for (int i = index + 1; i <= n; i += i & (-i)) {
            tree[i] += delta;
        }
    }

    private int prefix(int i) {
        int s = 0;
        for (; i > 0; i -= i & (-i)) {
            s += tree[i];
        }
        return s;
    }

    public int sumRange(int left, int right) {
        return prefix(right + 1) - prefix(left);
    }
}
```

#### Rust
`usize` indices are unsigned, so use `i.wrapping_neg()` to get the two's-complement low-bit mask that `-i` would give.

```rust
struct NumArray {
    n: usize,
    nums: Vec<i32>,
    tree: Vec<i32>,
}

impl NumArray {
    fn new(nums: Vec<i32>) -> Self {
        let n = nums.len();
        let mut na = NumArray { n, nums: vec![0; n], tree: vec![0; n + 1] };
        for i in 0..n {
            na.update(i as i32, nums[i]);
        }
        na
    }

    fn update(&mut self, index: i32, val: i32) {
        let idx = index as usize;
        let delta = val - self.nums[idx];
        self.nums[idx] = val;
        let mut i = idx + 1;
        while i <= self.n {
            self.tree[i] += delta;
            i += i & i.wrapping_neg();
        }
    }

    fn prefix(&self, mut i: usize) -> i32 {
        let mut s = 0;
        while i > 0 {
            s += self.tree[i];
            i -= i & i.wrapping_neg();
        }
        s
    }

    fn sum_range(&self, left: i32, right: i32) -> i32 {
        self.prefix((right + 1) as usize) - self.prefix(left as usize)
    }
}
```

#### Go
Plain `[]int` slices; `i & (-i)` works because Go's `int` is signed two's complement.

```go
type NumArray struct {
    n    int
    nums []int
    tree []int
}

func Constructor(nums []int) NumArray {
    n := len(nums)
    na := NumArray{n: n, nums: make([]int, n), tree: make([]int, n+1)}
    for i, x := range nums {
        na.Update(i, x)
    }
    return na
}

func (na *NumArray) Update(index int, val int) {
    delta := val - na.nums[index]
    na.nums[index] = val
    for i := index + 1; i <= na.n; i += i & (-i) {
        na.tree[i] += delta
    }
}

func (na *NumArray) prefix(i int) int {
    s := 0
    for ; i > 0; i -= i & (-i) {
        s += na.tree[i]
    }
    return s
}

func (na *NumArray) SumRange(left int, right int) int {
    return na.prefix(right+1) - na.prefix(left)
}
```

#### C++
Member-initializer list sizes both vectors; `i & (-i)` on `int` isolates the low set bit.

```cpp
#include <vector>

class NumArray {
    int n;
    std::vector<int> nums;
    std::vector<int> tree;

    int prefix(int i) {
        int s = 0;
        for (; i > 0; i -= i & (-i)) s += tree[i];
        return s;
    }
public:
    NumArray(std::vector<int>& a) : n(a.size()), nums(a.size(), 0), tree(a.size() + 1, 0) {
        for (int i = 0; i < n; i++) update(i, a[i]);
    }

    void update(int index, int val) {
        int delta = val - nums[index];
        nums[index] = val;
        for (int i = index + 1; i <= n; i += i & (-i)) tree[i] += delta;
    }

    int sumRange(int left, int right) {
        return prefix(right + 1) - prefix(left);
    }
};
```

### 69. Range Sum Query 2D - Immutable

#### Problem
Implement `NumMatrix`, built once from a 2D integer `matrix`. Support `sumRegion(row1, col1, row2, col2)` returning the sum of the submatrix whose upper-left corner is `(row1, col1)` and lower-right corner is `(row2, col2)`, inclusive. The matrix is never modified, so each query must be O(1).

#### Pattern
**2D prefix-sum (integral image).** **O(1)** per query after **O(m*n)** build, **O(m*n)** space. Inclusion-exclusion over four corner prefixes.

#### Explanation
Extend the 1D prefix trick to two dimensions: `pre[r][c]` holds the sum of the whole rectangle from the origin to `(r-1, c-1)`. Each cell is filled by inclusion-exclusion — the block above plus the block to the left, minus the doubly-counted overlap, plus the current element: `pre[r+1][c+1] = pre[r][c+1] + pre[r+1][c] - pre[r][c] + matrix[r][c]`.

A query is the same inclusion-exclusion run backwards over four corners: take the big rectangle to `(row2, col2)`, subtract the strip above and the strip to the left, then add back the top-left rectangle that was subtracted twice. The extra zero-filled first row and column of `pre` make the corner arithmetic uniform, so queries touching row 0 or column 0 need no special casing. This is the integral-image technique used in image processing, and it is the immutable counterpart to the 2D Fenwick tree in problem 70.

#### Python
Nested comprehension pads `pre` with a zero row and column so the four-corner formula never underflows an index.

```python
class NumMatrix:
    def __init__(self, matrix: list[list[int]]):
        m = len(matrix)
        n = len(matrix[0]) if m else 0
        self.pre = [[0] * (n + 1) for _ in range(m + 1)]
        for r in range(m):
            for c in range(n):
                self.pre[r + 1][c + 1] = (
                    self.pre[r][c + 1] + self.pre[r + 1][c]
                    - self.pre[r][c] + matrix[r][c]
                )

    def sumRegion(self, row1: int, col1: int, row2: int, col2: int) -> int:
        return (
            self.pre[row2 + 1][col2 + 1] - self.pre[row1][col2 + 1]
            - self.pre[row2 + 1][col1] + self.pre[row1][col1]
        )
```

#### Java
A `int[m+1][n+1]` is zero-initialized by default, giving the sentinel border for free.

```java
class NumMatrix {
    private final int[][] pre;

    public NumMatrix(int[][] matrix) {
        int m = matrix.length;
        int n = m > 0 ? matrix[0].length : 0;
        pre = new int[m + 1][n + 1];
        for (int r = 0; r < m; r++) {
            for (int c = 0; c < n; c++) {
                pre[r + 1][c + 1] = pre[r][c + 1] + pre[r + 1][c]
                    - pre[r][c] + matrix[r][c];
            }
        }
    }

    public int sumRegion(int row1, int col1, int row2, int col2) {
        return pre[row2 + 1][col2 + 1] - pre[row1][col2 + 1]
            - pre[row2 + 1][col1] + pre[row1][col1];
    }
}
```

#### Rust
`vec![vec![0; n + 1]; m + 1]` builds the padded grid; cast the `i32` query args to `usize` once.

```rust
struct NumMatrix {
    pre: Vec<Vec<i32>>,
}

impl NumMatrix {
    fn new(matrix: Vec<Vec<i32>>) -> Self {
        let m = matrix.len();
        let n = if m > 0 { matrix[0].len() } else { 0 };
        let mut pre = vec![vec![0; n + 1]; m + 1];
        for r in 0..m {
            for c in 0..n {
                pre[r + 1][c + 1] = pre[r][c + 1] + pre[r + 1][c]
                    - pre[r][c] + matrix[r][c];
            }
        }
        NumMatrix { pre }
    }

    fn sum_region(&self, row1: i32, col1: i32, row2: i32, col2: i32) -> i32 {
        let (r1, c1) = (row1 as usize, col1 as usize);
        let (r2, c2) = (row2 as usize, col2 as usize);
        self.pre[r2 + 1][c2 + 1] - self.pre[r1][c2 + 1]
            - self.pre[r2 + 1][c1] + self.pre[r1][c1]
    }
}
```

#### Go
Allocate each padded row with its own `make`; zero-valued `int` gives the border.

```go
type NumMatrix struct {
    pre [][]int
}

func Constructor(matrix [][]int) NumMatrix {
    m := len(matrix)
    n := 0
    if m > 0 {
        n = len(matrix[0])
    }
    pre := make([][]int, m+1)
    for i := range pre {
        pre[i] = make([]int, n+1)
    }
    for r := 0; r < m; r++ {
        for c := 0; c < n; c++ {
            pre[r+1][c+1] = pre[r][c+1] + pre[r+1][c] - pre[r][c] + matrix[r][c]
        }
    }
    return NumMatrix{pre: pre}
}

func (nm *NumMatrix) SumRegion(row1, col1, row2, col2 int) int {
    return nm.pre[row2+1][col2+1] - nm.pre[row1][col2+1] - nm.pre[row2+1][col1] + nm.pre[row1][col1]
}
```

#### C++
`assign(m + 1, vector<int>(n + 1, 0))` builds the zero-padded integral image in one call.

```cpp
#include <vector>

class NumMatrix {
    std::vector<std::vector<int>> pre;
public:
    NumMatrix(std::vector<std::vector<int>>& matrix) {
        int m = matrix.size();
        int n = m > 0 ? matrix[0].size() : 0;
        pre.assign(m + 1, std::vector<int>(n + 1, 0));
        for (int r = 0; r < m; r++) {
            for (int c = 0; c < n; c++) {
                pre[r + 1][c + 1] = pre[r][c + 1] + pre[r + 1][c]
                    - pre[r][c] + matrix[r][c];
            }
        }
    }

    int sumRegion(int row1, int col1, int row2, int col2) {
        return pre[row2 + 1][col2 + 1] - pre[row1][col2 + 1]
            - pre[row2 + 1][col1] + pre[row1][col1];
    }
};
```

### 70. Range Sum Query 2D - Mutable

#### Problem
Implement `NumMatrix` built from a 2D `matrix`, supporting `update(row, col, val)` which sets one cell, and `sumRegion(row1, col1, row2, col2)` which returns the inclusive submatrix sum. Updates and queries interleave, so a static integral image will not do — target O(log(m) * log(n)) per operation.

#### Pattern
**2D Binary Indexed Tree.** **O(log(m) * log(n))** per update and per query, **O(m*n)** space. A Fenwick tree nested inside a Fenwick tree.

#### Explanation
Stack two Fenwick trees: the outer index walks rows by lowest set bit, and for each visited row the inner index walks columns the same way. A point update touches O(log m) rows times O(log n) columns of tree slots; a prefix query `query(r, c)` — the sum of the rectangle from the origin to `(r, c)` — descends both dimensions symmetrically. The region sum is the familiar four-corner inclusion-exclusion, each corner being one 2D prefix query.

As in the 1D mutable case, `update` receives an absolute value, so we keep a mirror `mat` grid and push `delta = val - mat[row][col]` into the tree before overwriting the mirror. Both the tree's row and column dimensions are 1-indexed (an extra row and column of unused slots) so the `& -i` bit walks stay in range. Building the structure is just `m*n` point updates from the initial matrix; that O(m*n*log(m)*log(n)) construction is fine because queries afterward are cheap and updates no longer cost a full rebuild.

#### Python
Nested `while` loops with `i & (-i)`; the mirror `mat` converts each absolute set into a delta.

```python
class NumMatrix:
    def __init__(self, matrix: list[list[int]]):
        self.m = len(matrix)
        self.n = len(matrix[0]) if self.m else 0
        self.mat = [[0] * self.n for _ in range(self.m)]
        self.tree = [[0] * (self.n + 1) for _ in range(self.m + 1)]
        for r in range(self.m):
            for c in range(self.n):
                self.update(r, c, matrix[r][c])

    def update(self, row: int, col: int, val: int) -> None:
        delta = val - self.mat[row][col]
        self.mat[row][col] = val
        i = row + 1
        while i <= self.m:
            j = col + 1
            while j <= self.n:
                self.tree[i][j] += delta
                j += j & (-j)
            i += i & (-i)

    def _query(self, row: int, col: int) -> int:
        s = 0
        i = row
        while i > 0:
            j = col
            while j > 0:
                s += self.tree[i][j]
                j -= j & (-j)
            i -= i & (-i)
        return s

    def sumRegion(self, row1: int, col1: int, row2: int, col2: int) -> int:
        return (
            self._query(row2 + 1, col2 + 1) - self._query(row1, col2 + 1)
            - self._query(row2 + 1, col1) + self._query(row1, col1)
        )
```

#### Java
Nested `for` loops over rows then columns; both dimensions are 1-indexed `int[][]`.

```java
class NumMatrix {
    private final int m, n;
    private final int[][] mat;
    private final int[][] tree;

    public NumMatrix(int[][] matrix) {
        m = matrix.length;
        n = m > 0 ? matrix[0].length : 0;
        mat = new int[m][n];
        tree = new int[m + 1][n + 1];
        for (int r = 0; r < m; r++) {
            for (int c = 0; c < n; c++) {
                update(r, c, matrix[r][c]);
            }
        }
    }

    public void update(int row, int col, int val) {
        int delta = val - mat[row][col];
        mat[row][col] = val;
        for (int i = row + 1; i <= m; i += i & (-i)) {
            for (int j = col + 1; j <= n; j += j & (-j)) {
                tree[i][j] += delta;
            }
        }
    }

    private int query(int row, int col) {
        int s = 0;
        for (int i = row; i > 0; i -= i & (-i)) {
            for (int j = col; j > 0; j -= j & (-j)) {
                s += tree[i][j];
            }
        }
        return s;
    }

    public int sumRegion(int row1, int col1, int row2, int col2) {
        return query(row2 + 1, col2 + 1) - query(row1, col2 + 1)
            - query(row2 + 1, col1) + query(row1, col1);
    }
}
```

#### Rust
`wrapping_neg` supplies the low-bit mask on the unsigned `usize` loop counters in both dimensions.

```rust
struct NumMatrix {
    m: usize,
    n: usize,
    mat: Vec<Vec<i32>>,
    tree: Vec<Vec<i32>>,
}

impl NumMatrix {
    fn new(matrix: Vec<Vec<i32>>) -> Self {
        let m = matrix.len();
        let n = if m > 0 { matrix[0].len() } else { 0 };
        let mut nm = NumMatrix {
            m,
            n,
            mat: vec![vec![0; n]; m],
            tree: vec![vec![0; n + 1]; m + 1],
        };
        for r in 0..m {
            for c in 0..n {
                nm.update(r as i32, c as i32, matrix[r][c]);
            }
        }
        nm
    }

    fn update(&mut self, row: i32, col: i32, val: i32) {
        let (r, c) = (row as usize, col as usize);
        let delta = val - self.mat[r][c];
        self.mat[r][c] = val;
        let mut i = r + 1;
        while i <= self.m {
            let mut j = c + 1;
            while j <= self.n {
                self.tree[i][j] += delta;
                j += j & j.wrapping_neg();
            }
            i += i & i.wrapping_neg();
        }
    }

    fn query(&self, row: usize, col: usize) -> i32 {
        let mut s = 0;
        let mut i = row;
        while i > 0 {
            let mut j = col;
            while j > 0 {
                s += self.tree[i][j];
                j -= j & j.wrapping_neg();
            }
            i -= i & i.wrapping_neg();
        }
        s
    }

    fn sum_region(&self, row1: i32, col1: i32, row2: i32, col2: i32) -> i32 {
        let (r1, c1) = (row1 as usize, col1 as usize);
        let (r2, c2) = (row2 as usize, col2 as usize);
        self.query(r2 + 1, c2 + 1) - self.query(r1, c2 + 1)
            - self.query(r2 + 1, c1) + self.query(r1, c1)
    }
}
```

#### Go
Two `[][]int` grids allocated row by row; nested `for` loops with `& (-i)` do the bit walk.

```go
type NumMatrix struct {
    m, n int
    mat  [][]int
    tree [][]int
}

func Constructor(matrix [][]int) NumMatrix {
    m := len(matrix)
    n := 0
    if m > 0 {
        n = len(matrix[0])
    }
    mat := make([][]int, m)
    for i := range mat {
        mat[i] = make([]int, n)
    }
    tree := make([][]int, m+1)
    for i := range tree {
        tree[i] = make([]int, n+1)
    }
    nm := NumMatrix{m: m, n: n, mat: mat, tree: tree}
    for r := 0; r < m; r++ {
        for c := 0; c < n; c++ {
            nm.Update(r, c, matrix[r][c])
        }
    }
    return nm
}

func (nm *NumMatrix) Update(row, col, val int) {
    delta := val - nm.mat[row][col]
    nm.mat[row][col] = val
    for i := row + 1; i <= nm.m; i += i & (-i) {
        for j := col + 1; j <= nm.n; j += j & (-j) {
            nm.tree[i][j] += delta
        }
    }
}

func (nm *NumMatrix) query(row, col int) int {
    s := 0
    for i := row; i > 0; i -= i & (-i) {
        for j := col; j > 0; j -= j & (-j) {
            s += nm.tree[i][j]
        }
    }
    return s
}

func (nm *NumMatrix) SumRegion(row1, col1, row2, col2 int) int {
    return nm.query(row2+1, col2+1) - nm.query(row1, col2+1) - nm.query(row2+1, col1) + nm.query(row1, col1)
}
```

#### C++
`assign` sizes both the mirror and the 1-indexed tree; nested loops do the 2D bit walk.

```cpp
#include <vector>

class NumMatrix {
    int m, n;
    std::vector<std::vector<int>> mat;
    std::vector<std::vector<int>> tree;

    int query(int row, int col) {
        int s = 0;
        for (int i = row; i > 0; i -= i & (-i))
            for (int j = col; j > 0; j -= j & (-j))
                s += tree[i][j];
        return s;
    }
public:
    NumMatrix(std::vector<std::vector<int>>& matrix) {
        m = matrix.size();
        n = m > 0 ? matrix[0].size() : 0;
        mat.assign(m, std::vector<int>(n, 0));
        tree.assign(m + 1, std::vector<int>(n + 1, 0));
        for (int r = 0; r < m; r++)
            for (int c = 0; c < n; c++)
                update(r, c, matrix[r][c]);
    }

    void update(int row, int col, int val) {
        int delta = val - mat[row][col];
        mat[row][col] = val;
        for (int i = row + 1; i <= m; i += i & (-i))
            for (int j = col + 1; j <= n; j += j & (-j))
                tree[i][j] += delta;
    }

    int sumRegion(int row1, int col1, int row2, int col2) {
        return query(row2 + 1, col2 + 1) - query(row1, col2 + 1)
            - query(row2 + 1, col1) + query(row1, col1);
    }
};
```

### 71. Design Skiplist

#### Problem
Implement `Skiplist` without any built-in ordered-set library. Support `search(target)` returning whether `target` exists, `add(num)` inserting a value (duplicates allowed), and `erase(num)` removing one occurrence and returning whether anything was removed. All three must run in expected O(log n).

#### Pattern
**Probabilistic multi-level linked list.** **O(log n)** expected per operation, **O(n)** expected space. Express lanes at geometrically thinning levels let a search skip over most nodes.

#### Explanation
A skiplist is a sorted linked list stacked with sparse "express" lanes. Level 0 holds every node; each higher level keeps a node with independent probability p (here 1/2), so the expected number of levels is O(log n) and each level roughly halves the nodes below it. A search starts at the highest level of a sentinel head and moves right while the next value is smaller than the target, dropping a level whenever it would overshoot. Because each level skips about half the remaining span, the walk is O(log n) expected.

The engine of all three operations is the descent that records, for every level, the last node whose successor is not less than the target — the `update` array. `search` just checks whether the level-0 successor equals the target. `add` picks a random level from a geometric distribution, then splices the new node in at levels 0 through that level, rewiring exactly the recorded predecessors. `erase` finds the target and unlinks it at every level where the recorded predecessor points at it, then trims now-empty top levels. Duplicates are handled naturally because we compare with strict `<` during descent and stop at the first equal node, so each `erase` removes exactly one. A fixed `MAX_LEVEL` cap (16 here) bounds the pointer arrays; it comfortably covers tens of thousands of elements.

#### Python
`random.random() < 0.5` drives the geometric level draw; each node carries a `next` list sized to its level.

```python
import random

class _Node:
    __slots__ = ('val', 'next')
    def __init__(self, val: int, level: int):
        self.val = val
        self.next = [None] * level

class Skiplist:
    MAX_LEVEL = 16

    def __init__(self):
        self.head = _Node(-1, self.MAX_LEVEL)
        self.level = 1

    def _random_level(self) -> int:
        lvl = 1
        while random.random() < 0.5 and lvl < self.MAX_LEVEL:
            lvl += 1
        return lvl

    def search(self, target: int) -> bool:
        cur = self.head
        for i in range(self.level - 1, -1, -1):
            while cur.next[i] and cur.next[i].val < target:
                cur = cur.next[i]
        cur = cur.next[0]
        return cur is not None and cur.val == target

    def add(self, num: int) -> None:
        update = [self.head] * self.MAX_LEVEL
        cur = self.head
        for i in range(self.level - 1, -1, -1):
            while cur.next[i] and cur.next[i].val < num:
                cur = cur.next[i]
            update[i] = cur
        lvl = self._random_level()
        if lvl > self.level:
            self.level = lvl
        node = _Node(num, lvl)
        for i in range(lvl):
            node.next[i] = update[i].next[i]
            update[i].next[i] = node

    def erase(self, num: int) -> bool:
        update = [self.head] * self.MAX_LEVEL
        cur = self.head
        for i in range(self.level - 1, -1, -1):
            while cur.next[i] and cur.next[i].val < num:
                cur = cur.next[i]
            update[i] = cur
        cur = cur.next[0]
        if cur is None or cur.val != num:
            return False
        for i in range(self.level):
            if update[i].next[i] is cur:
                update[i].next[i] = cur.next[i]
        while self.level > 1 and self.head.next[self.level - 1] is None:
            self.level -= 1
        return True
```

#### Java
`Random.nextDouble()` drives the level draw; `Arrays.fill(update, head)` seeds the predecessor array so unvisited high levels default to the head.

```java
class Skiplist {
    private static final int MAX_LEVEL = 16;

    private static class Node {
        int val;
        Node[] next;
        Node(int val, int level) {
            this.val = val;
            this.next = new Node[level];
        }
    }

    private final Node head = new Node(-1, MAX_LEVEL);
    private int level = 1;
    private final Random rand = new Random();

    private int randomLevel() {
        int lvl = 1;
        while (rand.nextDouble() < 0.5 && lvl < MAX_LEVEL) lvl++;
        return lvl;
    }

    public boolean search(int target) {
        Node cur = head;
        for (int i = level - 1; i >= 0; i--) {
            while (cur.next[i] != null && cur.next[i].val < target) cur = cur.next[i];
        }
        cur = cur.next[0];
        return cur != null && cur.val == target;
    }

    public void add(int num) {
        Node[] update = new Node[MAX_LEVEL];
        Arrays.fill(update, head);
        Node cur = head;
        for (int i = level - 1; i >= 0; i--) {
            while (cur.next[i] != null && cur.next[i].val < num) cur = cur.next[i];
            update[i] = cur;
        }
        int lvl = randomLevel();
        if (lvl > level) level = lvl;
        Node node = new Node(num, lvl);
        for (int i = 0; i < lvl; i++) {
            node.next[i] = update[i].next[i];
            update[i].next[i] = node;
        }
    }

    public boolean erase(int num) {
        Node[] update = new Node[MAX_LEVEL];
        Arrays.fill(update, head);
        Node cur = head;
        for (int i = level - 1; i >= 0; i--) {
            while (cur.next[i] != null && cur.next[i].val < num) cur = cur.next[i];
            update[i] = cur;
        }
        cur = cur.next[0];
        if (cur == null || cur.val != num) return false;
        for (int i = 0; i < level; i++) {
            if (update[i].next[i] == cur) update[i].next[i] = cur.next[i];
        }
        while (level > 1 && head.next[level - 1] == null) level--;
        return true;
    }
}
```

#### Rust
`Rc<RefCell<Node>>` gives shared, interior-mutable nodes; clone the `next` link out before comparing so no borrow spans the reassignment, and a small xorshift avoids any external RNG crate.

```rust
use std::cell::{Cell, RefCell};
use std::rc::Rc;

const MAX_LEVEL: usize = 16;
type Link = Option<Rc<RefCell<Node>>>;

struct Node {
    val: i32,
    next: Vec<Link>,
}

impl Node {
    fn new(val: i32, level: usize) -> Rc<RefCell<Node>> {
        Rc::new(RefCell::new(Node { val, next: vec![None; level] }))
    }
}

struct Skiplist {
    head: Rc<RefCell<Node>>,
    level: usize,
    seed: Cell<u64>,
}

impl Skiplist {
    fn new() -> Self {
        Skiplist {
            head: Node::new(-1, MAX_LEVEL),
            level: 1,
            seed: Cell::new(0x2545F4914F6CDD1D),
        }
    }

    fn random_level(&self) -> usize {
        let mut x = self.seed.get();
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.seed.set(x);
        let mut lvl = 1;
        while (x & 1) == 1 && lvl < MAX_LEVEL {
            lvl += 1;
            x >>= 1;
        }
        lvl
    }

    fn descend(&self, num: i32, update: &mut Vec<Rc<RefCell<Node>>>) {
        let mut cur = self.head.clone();
        for i in (0..self.level).rev() {
            loop {
                let nxt = cur.borrow().next[i].clone();
                if let Some(n) = nxt {
                    if n.borrow().val < num {
                        cur = n;
                        continue;
                    }
                }
                break;
            }
            update[i] = cur.clone();
        }
    }

    fn search(&self, target: i32) -> bool {
        let mut cur = self.head.clone();
        for i in (0..self.level).rev() {
            loop {
                let nxt = cur.borrow().next[i].clone();
                if let Some(n) = nxt {
                    if n.borrow().val < target {
                        cur = n;
                        continue;
                    }
                }
                break;
            }
        }
        let nxt = cur.borrow().next[0].clone();
        match nxt {
            Some(n) => n.borrow().val == target,
            None => false,
        }
    }

    fn add(&mut self, num: i32) {
        let mut update: Vec<Rc<RefCell<Node>>> = vec![self.head.clone(); MAX_LEVEL];
        self.descend(num, &mut update);
        let lvl = self.random_level();
        if lvl > self.level {
            self.level = lvl;
        }
        let node = Node::new(num, lvl);
        for i in 0..lvl {
            let prev_next = update[i].borrow().next[i].clone();
            node.borrow_mut().next[i] = prev_next;
            update[i].borrow_mut().next[i] = Some(node.clone());
        }
    }

    fn erase(&mut self, num: i32) -> bool {
        let mut update: Vec<Rc<RefCell<Node>>> = vec![self.head.clone(); MAX_LEVEL];
        self.descend(num, &mut update);
        let target = update[0].borrow().next[0].clone();
        let target = match target {
            Some(n) if n.borrow().val == num => n,
            _ => return false,
        };
        for i in 0..self.level {
            let nxt = update[i].borrow().next[i].clone();
            if let Some(n) = nxt {
                if Rc::ptr_eq(&n, &target) {
                    let after = target.borrow().next[i].clone();
                    update[i].borrow_mut().next[i] = after;
                }
            }
        }
        while self.level > 1 && self.head.borrow().next[self.level - 1].is_none() {
            self.level -= 1;
        }
        true
    }
}
```

#### Go
Each node holds a `[]*skipNode` sized to its level; `math/rand`'s `Float64` drives the geometric draw.

```go
import "math/rand"

const maxLevel = 16

type skipNode struct {
    val  int
    next []*skipNode
}

type Skiplist struct {
    head  *skipNode
    level int
}

func Constructor() Skiplist {
    return Skiplist{
        head:  &skipNode{val: -1, next: make([]*skipNode, maxLevel)},
        level: 1,
    }
}

func randomLevel() int {
    lvl := 1
    for rand.Float64() < 0.5 && lvl < maxLevel {
        lvl++
    }
    return lvl
}

func (s *Skiplist) Search(target int) bool {
    cur := s.head
    for i := s.level - 1; i >= 0; i-- {
        for cur.next[i] != nil && cur.next[i].val < target {
            cur = cur.next[i]
        }
    }
    cur = cur.next[0]
    return cur != nil && cur.val == target
}

func (s *Skiplist) Add(num int) {
    update := make([]*skipNode, maxLevel)
    for i := range update {
        update[i] = s.head
    }
    cur := s.head
    for i := s.level - 1; i >= 0; i-- {
        for cur.next[i] != nil && cur.next[i].val < num {
            cur = cur.next[i]
        }
        update[i] = cur
    }
    lvl := randomLevel()
    if lvl > s.level {
        s.level = lvl
    }
    node := &skipNode{val: num, next: make([]*skipNode, lvl)}
    for i := 0; i < lvl; i++ {
        node.next[i] = update[i].next[i]
        update[i].next[i] = node
    }
}

func (s *Skiplist) Erase(num int) bool {
    update := make([]*skipNode, maxLevel)
    for i := range update {
        update[i] = s.head
    }
    cur := s.head
    for i := s.level - 1; i >= 0; i-- {
        for cur.next[i] != nil && cur.next[i].val < num {
            cur = cur.next[i]
        }
        update[i] = cur
    }
    cur = cur.next[0]
    if cur == nil || cur.val != num {
        return false
    }
    for i := 0; i < s.level; i++ {
        if update[i].next[i] == cur {
            update[i].next[i] = cur.next[i]
        }
    }
    for s.level > 1 && s.head.next[s.level-1] == nil {
        s.level--
    }
    return true
}
```

#### C++
Each `Node` owns a `vector<Node*>` of forward links; `std::rand() & 1` supplies the coin flip and `delete` reclaims the erased node.

```cpp
#include <vector>
#include <cstdlib>

class Skiplist {
    static const int MAX_LEVEL = 16;

    struct Node {
        int val;
        std::vector<Node*> next;
        Node(int v, int level) : val(v), next(level, nullptr) {}
    };

    Node* head;
    int level;

    int randomLevel() {
        int lvl = 1;
        while ((std::rand() & 1) && lvl < MAX_LEVEL) lvl++;
        return lvl;
    }

public:
    Skiplist() {
        head = new Node(-1, MAX_LEVEL);
        level = 1;
    }

    bool search(int target) {
        Node* cur = head;
        for (int i = level - 1; i >= 0; i--) {
            while (cur->next[i] && cur->next[i]->val < target) cur = cur->next[i];
        }
        cur = cur->next[0];
        return cur && cur->val == target;
    }

    void add(int num) {
        std::vector<Node*> update(MAX_LEVEL, head);
        Node* cur = head;
        for (int i = level - 1; i >= 0; i--) {
            while (cur->next[i] && cur->next[i]->val < num) cur = cur->next[i];
            update[i] = cur;
        }
        int lvl = randomLevel();
        if (lvl > level) level = lvl;
        Node* node = new Node(num, lvl);
        for (int i = 0; i < lvl; i++) {
            node->next[i] = update[i]->next[i];
            update[i]->next[i] = node;
        }
    }

    bool erase(int num) {
        std::vector<Node*> update(MAX_LEVEL, head);
        Node* cur = head;
        for (int i = level - 1; i >= 0; i--) {
            while (cur->next[i] && cur->next[i]->val < num) cur = cur->next[i];
            update[i] = cur;
        }
        cur = cur->next[0];
        if (!cur || cur->val != num) return false;
        for (int i = 0; i < level; i++) {
            if (update[i]->next[i] == cur) update[i]->next[i] = cur->next[i];
        }
        delete cur;
        while (level > 1 && !head->next[level - 1]) level--;
        return true;
    }
};
```

### 72. Design Excel Sum Formula

#### Problem
Implement `Excel`, constructed with a row count `height` and a maximum column letter `width` (an uppercase char). Support `set(row, column, val)` writing a literal into a 1-indexed cell, `get(row, column)` reading a cell's current value, and `sum(row, column, numbers)` which turns a cell into a formula equal to the sum of the referenced cells or ranges (strings like `"A1"` or `"A1:B2"`) and returns that sum. Reads must reflect the live values of every cell a formula transitively depends on.

#### Pattern
**Dependency grid with lazy recursive evaluation.** **O(cells in formula closure)** per `get`/`sum`, **O(height * width + formula size)** space. Each cell is either a literal or a multiset of cell references.

#### Explanation
Model each cell as one of two states: a literal integer, or a formula holding a map from referenced coordinate to a count (a range like `A1:B2` contributes every cell in that rectangle, and a cell may appear multiple times across tokens, so counts matter). `set` drops any formula and stores the literal. `sum` parses the tokens into that reference multiset, marks the cell as a formula, and immediately returns its evaluation.

The clean move is to evaluate lazily and recursively rather than eagerly propagating updates. `get(r, c)` returns the literal if the cell is a literal, otherwise it recurses into each referenced cell, multiplying by its count and summing. Because every reference resolves through the same `get`, a formula automatically sees the latest value of anything it depends on — even a chain of formulas built on other formulas — with no cache to invalidate when `set` fires. LeetCode's constraints keep the dependency closures tiny, so the recursion is well within budget and far simpler than maintaining a topological order or an observer graph. The only parsing care is mapping the 1-indexed public `row` and the column letter into 0-indexed internal coordinates, and expanding a `":"` token into its full rectangle.

#### Python
Coordinate-keyed `dict` per formula cell with `None` marking literals; `dict.get(key, 0) + 1` accumulates reference multiplicities.

```python
class Excel:
    def __init__(self, height: int, width: str):
        w = ord(width) - ord('A') + 1
        self.values = [[0] * w for _ in range(height)]
        self.formulas = [[None] * w for _ in range(height)]

    def _parse(self, s: str) -> tuple[int, int]:
        return int(s[1:]) - 1, ord(s[0]) - ord('A')

    def set(self, row: int, column: str, val: int) -> None:
        r, c = row - 1, ord(column) - ord('A')
        self.formulas[r][c] = None
        self.values[r][c] = val

    def _eval(self, r: int, c: int) -> int:
        if self.formulas[r][c] is None:
            return self.values[r][c]
        total = 0
        for (rr, cc), cnt in self.formulas[r][c].items():
            total += cnt * self._eval(rr, cc)
        return total

    def get(self, row: int, column: str) -> int:
        return self._eval(row - 1, ord(column) - ord('A'))

    def sum(self, row: int, column: str, numbers: list[str]) -> int:
        r, c = row - 1, ord(column) - ord('A')
        formula: dict[tuple[int, int], int] = {}
        for token in numbers:
            if ':' in token:
                a, b = token.split(':')
                r1, c1 = self._parse(a)
                r2, c2 = self._parse(b)
                for i in range(r1, r2 + 1):
                    for j in range(c1, c2 + 1):
                        formula[(i, j)] = formula.get((i, j), 0) + 1
            else:
                i, j = self._parse(token)
                formula[(i, j)] = formula.get((i, j), 0) + 1
        self.formulas[r][c] = formula
        return self._eval(r, c)
```

#### Java
`Map<Integer,Integer>[][]` where a `null` entry means literal and the key packs `row * width + col`; `merge(key, 1, Integer::sum)` tallies reference counts.

```java
class Excel {
    private final int[][] values;
    private final Map<Integer, Integer>[][] formulas;
    private final int w;

    @SuppressWarnings("unchecked")
    public Excel(int height, char width) {
        w = width - 'A' + 1;
        values = new int[height][w];
        formulas = new HashMap[height][w];
    }

    public void set(int row, char column, int val) {
        int r = row - 1, c = column - 'A';
        formulas[r][c] = null;
        values[r][c] = val;
    }

    private int eval(int r, int c) {
        if (formulas[r][c] == null) return values[r][c];
        int total = 0;
        for (Map.Entry<Integer, Integer> e : formulas[r][c].entrySet()) {
            total += e.getValue() * eval(e.getKey() / w, e.getKey() % w);
        }
        return total;
    }

    public int get(int row, char column) {
        return eval(row - 1, column - 'A');
    }

    public int sum(int row, char column, String[] numbers) {
        int r = row - 1, c = column - 'A';
        Map<Integer, Integer> formula = new HashMap<>();
        for (String token : numbers) {
            String[] parts = token.split(":");
            int[] a = parseCell(parts[0]);
            int[] b = parts.length > 1 ? parseCell(parts[1]) : a;
            for (int i = a[0]; i <= b[0]; i++) {
                for (int j = a[1]; j <= b[1]; j++) {
                    formula.merge(i * w + j, 1, Integer::sum);
                }
            }
        }
        formulas[r][c] = formula;
        return eval(r, c);
    }

    private int[] parseCell(String s) {
        return new int[]{Integer.parseInt(s.substring(1)) - 1, s.charAt(0) - 'A'};
    }
}
```

#### Rust
`Vec<Vec<Option<HashMap<(usize,usize), i32>>>>` where `None` is a literal; `entry(..).or_insert(0)` accumulates counts and `&self` recursion evaluates.

```rust
use std::collections::HashMap;

struct Excel {
    values: Vec<Vec<i32>>,
    formulas: Vec<Vec<Option<HashMap<(usize, usize), i32>>>>,
}

impl Excel {
    fn new(height: i32, width: char) -> Self {
        let h = height as usize;
        let w = (width as u8 - b'A' + 1) as usize;
        Excel {
            values: vec![vec![0; w]; h],
            formulas: vec![vec![None; w]; h],
        }
    }

    fn parse_cell(s: &str) -> (usize, usize) {
        let col = (s.as_bytes()[0] - b'A') as usize;
        let row = s[1..].parse::<usize>().unwrap() - 1;
        (row, col)
    }

    fn eval(&self, r: usize, c: usize) -> i32 {
        match &self.formulas[r][c] {
            None => self.values[r][c],
            Some(f) => {
                let mut total = 0;
                for (&(rr, cc), &cnt) in f.iter() {
                    total += cnt * self.eval(rr, cc);
                }
                total
            }
        }
    }

    fn set(&mut self, row: i32, column: char, val: i32) {
        let r = (row - 1) as usize;
        let c = (column as u8 - b'A') as usize;
        self.formulas[r][c] = None;
        self.values[r][c] = val;
    }

    fn get(&self, row: i32, column: char) -> i32 {
        self.eval((row - 1) as usize, (column as u8 - b'A') as usize)
    }

    fn sum(&mut self, row: i32, column: char, numbers: Vec<String>) -> i32 {
        let r = (row - 1) as usize;
        let c = (column as u8 - b'A') as usize;
        let mut formula: HashMap<(usize, usize), i32> = HashMap::new();
        for token in &numbers {
            if let Some(idx) = token.find(':') {
                let (r1, c1) = Self::parse_cell(&token[..idx]);
                let (r2, c2) = Self::parse_cell(&token[idx + 1..]);
                for i in r1..=r2 {
                    for j in c1..=c2 {
                        *formula.entry((i, j)).or_insert(0) += 1;
                    }
                }
            } else {
                let (i, j) = Self::parse_cell(token);
                *formula.entry((i, j)).or_insert(0) += 1;
            }
        }
        self.formulas[r][c] = Some(formula);
        self.eval(r, c)
    }
}
```

#### Go
A `map[cellKey]int` per formula cell (nil means literal); a small struct key keeps coordinate pairs hashable and `strings.Contains` detects ranges.

```go
import (
    "strconv"
    "strings"
)

type cellKey struct {
    r, c int
}

type Excel struct {
    values   [][]int
    formulas [][]map[cellKey]int
}

func Constructor(height int, width byte) Excel {
    w := int(width-'A') + 1
    values := make([][]int, height)
    formulas := make([][]map[cellKey]int, height)
    for i := 0; i < height; i++ {
        values[i] = make([]int, w)
        formulas[i] = make([]map[cellKey]int, w)
    }
    return Excel{values: values, formulas: formulas}
}

func parseCell(s string) (int, int) {
    row, _ := strconv.Atoi(s[1:])
    return row - 1, int(s[0] - 'A')
}

func (e *Excel) eval(r, c int) int {
    if e.formulas[r][c] == nil {
        return e.values[r][c]
    }
    total := 0
    for k, cnt := range e.formulas[r][c] {
        total += cnt * e.eval(k.r, k.c)
    }
    return total
}

func (e *Excel) Set(row int, column byte, val int) {
    r, c := row-1, int(column-'A')
    e.formulas[r][c] = nil
    e.values[r][c] = val
}

func (e *Excel) Get(row int, column byte) int {
    return e.eval(row-1, int(column-'A'))
}

func (e *Excel) Sum(row int, column byte, numbers []string) int {
    r, c := row-1, int(column-'A')
    formula := make(map[cellKey]int)
    for _, token := range numbers {
        if strings.Contains(token, ":") {
            parts := strings.Split(token, ":")
            r1, c1 := parseCell(parts[0])
            r2, c2 := parseCell(parts[1])
            for i := r1; i <= r2; i++ {
                for j := c1; j <= c2; j++ {
                    formula[cellKey{i, j}]++
                }
            }
        } else {
            i, j := parseCell(token)
            formula[cellKey{i, j}]++
        }
    }
    e.formulas[r][c] = formula
    return e.eval(r, c)
}
```

#### C++
Parallel `isFormula` flag grid plus `unordered_map<int,int>` per cell keyed by `row * width + col`; `find(':')` splits ranges from single references.

```cpp
#include <vector>
#include <unordered_map>
#include <string>

class Excel {
    int w;
    std::vector<std::vector<int>> values;
    std::vector<std::vector<std::unordered_map<int, int>>> formulas;
    std::vector<std::vector<bool>> isFormula;

    std::pair<int, int> parseCell(const std::string& s) {
        return {std::stoi(s.substr(1)) - 1, s[0] - 'A'};
    }

    int eval(int r, int c) {
        if (!isFormula[r][c]) return values[r][c];
        int total = 0;
        for (auto& [key, cnt] : formulas[r][c]) {
            total += cnt * eval(key / w, key % w);
        }
        return total;
    }

public:
    Excel(int height, char width) {
        w = width - 'A' + 1;
        values.assign(height, std::vector<int>(w, 0));
        formulas.assign(height, std::vector<std::unordered_map<int, int>>(w));
        isFormula.assign(height, std::vector<bool>(w, false));
    }

    void set(int row, char column, int val) {
        int r = row - 1, c = column - 'A';
        isFormula[r][c] = false;
        formulas[r][c].clear();
        values[r][c] = val;
    }

    int get(int row, char column) {
        return eval(row - 1, column - 'A');
    }

    int sum(int row, char column, std::vector<std::string> numbers) {
        int r = row - 1, c = column - 'A';
        std::unordered_map<int, int> formula;
        for (auto& token : numbers) {
            size_t pos = token.find(':');
            if (pos != std::string::npos) {
                auto [r1, c1] = parseCell(token.substr(0, pos));
                auto [r2, c2] = parseCell(token.substr(pos + 1));
                for (int i = r1; i <= r2; i++)
                    for (int j = c1; j <= c2; j++)
                        formula[i * w + j]++;
            } else {
                auto [i, j] = parseCell(token);
                formula[i * w + j]++;
            }
        }
        formulas[r][c] = formula;
        isFormula[r][c] = true;
        return eval(r, c);
    }
};
```

