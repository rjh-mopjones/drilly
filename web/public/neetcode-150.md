---
type: interview-prep
---

### 1. Two Sum

#### Problem
Given an array of integers and a target, return the indices of the two numbers that add up to the target. Each input has exactly one solution; you may not use the same element twice.

#### Examples

```text
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: nums[0] + nums[1] == 9.

Input: nums = [3,2,4], target = 6
Output: [1,2]

Input: nums = [3,3], target = 6
Output: [0,1]

Constraints:
- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9
- exactly one valid answer exists
```

#### Recognition
**Signals.** "Return the indices of the two numbers that add up to a target" gives you three tells at once: you need a *pair*, the array is *unsorted*, and you must return *positions* rather than values. Unsorted plus positions is what rules out the usual pair-finding trick. **Therefore.** A hashmap from value to index, checked as you scan, because the partner for `n` is fully determined (`target - n`) so membership is the only question you ever ask. **Not two pointers**, which needs sorted input and would destroy the original indices you have to return; sorting first costs `O(n log n)` and forces you to carry the original positions alongside. **Not a nested loop**, which is the `O(n^2)` baseline this exists to beat. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Check every pair.

```python
def twoSum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** The inner loop re-scans the same suffix for every `i`, asking "does any later element equal `target - nums[i]`?" That is a membership question, and re-answering it by scanning is the entire cost.

**Optimal.** Replace the scan with a lookup. Walk once, and at index `i` ask whether `target - nums[i]` has already been seen. A dict of value to index answers that in `O(1)`, so the whole thing collapses to a single pass. Record `nums[i] -> i` *after* the check, never before, which is what stops an element pairing with itself: when `nums = [3,3]` and `target = 6`, index 0 finds nothing and is then recorded, so index 1 finds it.

**Edge cases.** Exactly one valid answer is guaranteed, so no not-found branch is needed. Duplicate values are fine because of the check-then-record order. Negative numbers and zero need no special handling since the complement is just arithmetic.

#### Python

`enumerate` + dict gives the cleanest one-pass; recording `seen[n] = i` *after* the lookup is what prevents an element pairing with itself.

```python
def twoSum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        comp = target - n
        if comp in seen:
            return [seen[comp], i]
        seen[n] = i
```

#### Java

`getOrDefault` isn't needed here — a plain `containsKey`/`get` pair reads cleanest, and recording `seen.put(n, i)` *after* the lookup is what stops an element pairing with itself. Autoboxing `int` into the `HashMap<Integer, Integer>` is transparent.

```java
import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (seen.containsKey(comp)) {
                return new int[]{seen.get(comp), i};
            }
            seen.put(nums[i], i);
        }
        return new int[]{};
    }
}
```

#### Rust

`HashMap::get` returns `Option<&V>` — `if let Some(&j)` destructures and copies the index out without cloning. The `i as i32` cast is purely for LeetCode's signature; idiomatic Rust would keep `usize` end-to-end.

```rust
use std::collections::HashMap;

fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
    let mut seen: HashMap<i32, i32> = HashMap::new();
    for (i, &n) in nums.iter().enumerate() {
        let comp = target - n;
        if let Some(&j) = seen.get(&comp) {
            return vec![j, i as i32];
        }
        seen.insert(n, i as i32);
    }
    vec![]
}
```

#### Go

The comma-ok idiom (`j, ok := seen[comp]`) is the idiomatic 'does the key exist?' check — no separate `contains` call, no double lookup. Returning `nil` is fine here because Go treats a nil slice as a valid empty `[]int`.

```go
func twoSum(nums []int, target int) []int {
    seen := make(map[int]int)
    for i, n := range nums {
        comp := target - n
        if j, ok := seen[comp]; ok {
            return []int{j, i}
        }
        seen[n] = i
    }
    return nil
}
```

#### C++

`auto it = seen.find(comp)` + `it != seen.end()` is the standard way to avoid the double lookup you'd get from `seen.count(comp)` followed by `seen[comp]`. Brace-init `{it->second, i}` lets the compiler build the return vector in place.

```cpp
#include <vector>
#include <unordered_map>

std::vector<int> twoSum(std::vector<int>& nums, int target) {
    std::unordered_map<int, int> seen;
    for (int i = 0; i < (int)nums.size(); ++i) {
        int comp = target - nums[i];
        auto it = seen.find(comp);
        if (it != seen.end()) return {it->second, i};
        seen[nums[i]] = i;
    }
    return {};
}
```


### 2. Add Two Numbers

#### Problem
Given two non-empty linked lists representing non-negative integers stored in reverse order (ones digit first), add the two numbers and return the sum as a linked list in the same reversed format.

#### Examples

```text
Input: l1 = [2,4,3], l2 = [5,6,4]
Output: [7,0,8]
Explanation: 342 + 465 = 807, stored reversed.

Input: l1 = [0], l2 = [0]
Output: [0]

Input: l1 = [9,9,9,9,9,9,9], l2 = [9,9,9,9]
Output: [8,9,9,9,0,0,0,1]

Constraints:
- 1 <= length of each list <= 100
- 0 <= node value <= 9
- no leading zeros, except the number 0 itself
```

#### Recognition
**Signals.** "Stored in reverse order (ones digit first)" is the gift: that is exactly the order addition consumes digits in, so no reversal, no stack, no recursion is needed anywhere. "Non-empty" removes the null-input case. The constraint that each list holds up to 100 nodes is the second signal, and it is a prohibition: a 100-digit number fits in no fixed-width integer type, so the numbers can never be reconstructed. **Therefore.** Walk both lists in lockstep carrying one integer, emitting one node per position behind a dummy head, exactly as you would add on paper. **Not converting each list to an integer**, adding, and splitting the digits back out, which passes in Python only because its integers are arbitrary precision, and overflows a 64-bit integer at 19 digits in every other language here. **O(max(m, n))** time, **O(max(m, n))** space.

#### Explanation
**Brute force.** Rebuild both numbers, add them, take the sum apart again.

```python
def addTwoNumbers(l1, l2):
    def to_int(node):
        digits = ""
        while node:
            digits = str(node.val) + digits
            node = node.next
        return int(digits)
    total = to_int(l1) + to_int(l2)
    dummy = curr = ListNode()
    for c in reversed(str(total)):
        curr.next = ListNode(int(c))
        curr = curr.next
    return dummy.next
```

`O(m + n)` time, `O(m + n)` space.

**Wasteful because.** The digits arrive in the order addition wants them and this throws that away: it assembles two whole numbers, then immediately decomposes the sum back into the same digits. Every character of both string forms is written twice and read twice to move information that never had to leave the node it started in.

**Optimal.** Add in place, one position at a time. Take whatever each list offers at the current position, add the carry from the previous position, store `val % 10` in a new node and keep `val // 10` as the next carry. The single loop condition `while l1 or l2 or carry` folds three separate endings into one: a shorter list simply stops contributing, and a carry out of the top digit gets its own node without any code after the loop. A dummy head removes the other special case, "is this the first node?", so the body never branches on position. No intermediate value here exceeds 19, so nothing overflows in any language.

**Edge cases.** Unequal lengths, where the shorter list contributes nothing past its end. A final carry, so `[9,9] + [1]` is `[0,0,1]`, one node longer than either input. Both lists `[0]`, which must return `[0]` rather than an empty list.

#### Python

Tuple assignment `carry, val = val // 10, val % 10` does both updates in one line without a temp. The walrus operators tempt you here but the dummy-head pattern reads better as-is.

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def addTwoNumbers(l1, l2):
    dummy = ListNode()
    curr = dummy
    carry = 0
    while l1 or l2 or carry:
        val = carry
        if l1:
            val += l1.val
            l1 = l1.next
        if l2:
            val += l2.val
            l2 = l2.next
        carry, val = val // 10, val % 10
        curr.next = ListNode(val)
        curr = curr.next
    return dummy.next
```

#### Java

Use the stock LeetCode `ListNode`; a `dummy` sentinel makes the first-node case disappear. Java has no tuple, so the carry/digit split stays two plain statements — clearer than any trick here.

```java
import java.util.*;

class Solution {
    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {
        ListNode dummy = new ListNode();
        ListNode curr = dummy;
        int carry = 0;
        while (l1 != null || l2 != null || carry != 0) {
            int val = carry;
            if (l1 != null) { val += l1.val; l1 = l1.next; }
            if (l2 != null) { val += l2.val; l2 = l2.next; }
            carry = val / 10;
            curr.next = new ListNode(val % 10);
            curr = curr.next;
        }
        return dummy.next;
    }
}
```

#### Rust

Threading `&mut dummy` through the loop sidesteps Rust's classic linked-list ownership pain — `curr.next.as_mut().unwrap()` re-borrows from the freshly-inserted node each iteration. Owning `l1`/`l2` by `mut Option<Box<...>>` lets you `if let Some(node) = l1` and move the chain forward without cloning.

```rust
#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}

impl ListNode {
    fn new(val: i32) -> Self { ListNode { val, next: None } }
}

fn add_two_numbers(
    mut l1: Option<Box<ListNode>>,
    mut l2: Option<Box<ListNode>>,
) -> Option<Box<ListNode>> {
    let mut dummy = ListNode::new(0);
    let mut curr = &mut dummy;
    let mut carry = 0;
    while l1.is_some() || l2.is_some() || carry != 0 {
        let mut val = carry;
        if let Some(node) = l1 {
            val += node.val;
            l1 = node.next;
        }
        if let Some(node) = l2 {
            val += node.val;
            l2 = node.next;
        }
        carry = val / 10;
        curr.next = Some(Box::new(ListNode::new(val % 10)));
        curr = curr.next.as_mut().unwrap();
    }
    dummy.next
}
```

#### Go

Allocating each node with `&ListNode{Val: val % 10}` puts it on the heap via escape analysis — no manual `new()` call needed. Nil checks on `l1`/`l2` are explicit rather than the `Option` pattern, but the loop condition `l1 != nil || l2 != nil || carry != 0` reads the same.

```go
type ListNode struct {
    Val  int
    Next *ListNode
}

func addTwoNumbers(l1 *ListNode, l2 *ListNode) *ListNode {
    dummy := &ListNode{}
    curr := dummy
    carry := 0
    for l1 != nil || l2 != nil || carry != 0 {
        val := carry
        if l1 != nil {
            val += l1.Val
            l1 = l1.Next
        }
        if l2 != nil {
            val += l2.Val
            l2 = l2.Next
        }
        carry = val / 10
        curr.Next = &ListNode{Val: val % 10}
        curr = curr.Next
    }
    return dummy.Next
}
```

#### C++

Stack-allocating `ListNode dummy` and pointing `curr` at it avoids a leak for the sentinel; only the real nodes use `new`. Single-line `if (l1) { ... }` keeps the inner loop dense without sacrificing clarity.

```cpp
#include <memory>

struct ListNode {
    int val;
    ListNode* next;
    ListNode(int v = 0, ListNode* n = nullptr) : val(v), next(n) {}
};

ListNode* addTwoNumbers(ListNode* l1, ListNode* l2) {
    ListNode dummy;
    ListNode* curr = &dummy;
    int carry = 0;
    while (l1 || l2 || carry) {
        int val = carry;
        if (l1) { val += l1->val; l1 = l1->next; }
        if (l2) { val += l2->val; l2 = l2->next; }
        carry = val / 10;
        curr->next = new ListNode(val % 10);
        curr = curr->next;
    }
    return dummy.next;
}
```


### 3. Median of Two Sorted Arrays

#### Problem
Given two sorted arrays `nums1` and `nums2`, return the median of the combined sorted array. The solution must run in `O(log(min(m, n)))` time.

#### Examples

```text
Input: nums1 = [1,3], nums2 = [2]
Output: 2.0
Explanation: merged is [1,2,3], middle element 2.

Input: nums1 = [1,2], nums2 = [3,4]
Output: 2.5

Input: nums1 = [], nums2 = [1]
Output: 1.0

Constraints:
- 0 <= nums1.length, nums2.length <= 1000
- 1 <= nums1.length + nums2.length <= 2000
- -10^6 <= nums1[i], nums2[i] <= 10^6
```

#### Recognition
**Signals.** Two already sorted inputs plus a required `O(log(min(m, n)))`. The bound is the tell and it is an unusually strong one: a logarithmic budget forbids even touching every element, which kills merging and kills any two-pointer walk to the midpoint. Sorted input plus a log bound is binary search by elimination; the only real question left is what you search over, and it is not a value, it is a *split point*. **Therefore.** Binary search on `i`, the number of elements taken from the shorter array into the left half, which forces `j = half - i` from the other. The split is right when `a[i-1] <= b[j]` and `b[j-1] <= a[i]`, and that predicate is monotonic in `i`, so whichever comparison fails tells you which way to move. **Not merging** to the midpoint, the `O(m + n)` baseline this problem exists to beat. **O(log(min(m, n)))** time, **O(1)** space.

#### Explanation
**Brute force.** Merge the two arrays, then index the middle.

```python
def findMedianSortedArrays(nums1, nums2):
    merged, i, j = [], 0, 0
    while i < len(nums1) and j < len(nums2):
        if nums1[i] <= nums2[j]:
            merged.append(nums1[i])
            i += 1
        else:
            merged.append(nums2[j])
            j += 1
    merged += nums1[i:] + nums2[j:]
    n = len(merged)
    if n % 2:
        return float(merged[n // 2])
    return (merged[n // 2 - 1] + merged[n // 2]) / 2.0
```

`O(m + n)` time, `O(m + n)` space.

**Wasteful because.** The merge produces the full ordering of every element when the answer depends on at most two of them. Everything below the midpoint is placed correctly and then never read again.

**Optimal.** Search for the split rather than building it. The median is defined by a partition of the combined array into a left and a right half of fixed sizes where every left element is at most every right element. Pin the left half at `(m + n + 1) // 2` elements; choosing `i` of them from the shorter array `a` then forces exactly `j = half - i` from `b`, so there is a single free variable ranging over `0..m`. The partition is valid exactly when the two cross comparisons hold, `a[i-1] <= b[j]` and `b[j-1] <= a[i]`. If `a[i-1] > b[j]` you took too much from `a` and must shrink `i`; otherwise you took too little. That predicate is monotonic, which is what makes binary search over `i` legal and gives `O(log m)`. Once valid, the median is `max(a[i-1], b[j-1])` for an odd total, or the mean of that and `min(a[i], b[j])` for an even one. Searching the *shorter* array is what turns the bound into `log(min(m, n))` and keeps `j` inside `b`.

**Edge cases.** Either array may be empty, and one may lie entirely below the other; both are absorbed by the `-inf` and `+inf` sentinels standing in for missing boundary elements, which is why the code needs no explicit branch. Odd versus even total length is the only genuine case split. The `+ 1` before the floor division in `half` puts the extra element on the left for odd totals, which is why the odd case reads only left-side values.

#### Python

`float('-inf')` and `float('inf')` as sentinels avoid any integer overflow concerns and compare correctly against ints. The tuple swap `nums1, nums2 = nums2, nums1` enforces the 'binary-search-on-shorter' invariant without an extra variable.

```python
def findMedianSortedArrays(nums1, nums2):
    if len(nums1) > len(nums2):
        nums1, nums2 = nums2, nums1
    m, n = len(nums1), len(nums2)
    lo, hi = 0, m
    half = (m + n + 1) // 2

    while lo <= hi:
        i = (lo + hi) // 2
        j = half - i

        left1  = nums1[i - 1] if i > 0 else float('-inf')
        left2  = nums2[j - 1] if j > 0 else float('-inf')
        right1 = nums1[i]     if i < m else float('inf')
        right2 = nums2[j]     if j < n else float('inf')

        if left1 <= right2 and left2 <= right1:
            if (m + n) % 2:
                return float(max(left1, left2))
            return (max(left1, left2) + min(right1, right2)) / 2.0
        elif left1 > right2:
            hi = i - 1
        else:
            lo = i + 1
    return 0.0
```

#### Java

Promote partition values to `long` and use `Long.MIN_VALUE`/`Long.MAX_VALUE` as sentinels so the boundary comparisons never overflow. Java has no tuple swap, so ensure-shorter is a manual three-line swap of the two array references.

```java
class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        if (nums1.length > nums2.length) {
            int[] tmp = nums1; nums1 = nums2; nums2 = tmp;
        }
        int m = nums1.length, n = nums2.length;
        int half = (m + n + 1) / 2;
        int lo = 0, hi = m;

        while (lo <= hi) {
            int i = (lo + hi) / 2;
            int j = half - i;

            long left1  = (i > 0) ? nums1[i - 1] : Long.MIN_VALUE;
            long left2  = (j > 0) ? nums2[j - 1] : Long.MIN_VALUE;
            long right1 = (i < m) ? nums1[i]     : Long.MAX_VALUE;
            long right2 = (j < n) ? nums2[j]     : Long.MAX_VALUE;

            if (left1 <= right2 && left2 <= right1) {
                if ((m + n) % 2 == 1) {
                    return (double) Math.max(left1, left2);
                }
                return (Math.max(left1, left2) + Math.min(right1, right2)) / 2.0;
            } else if (left1 > right2) {
                hi = i - 1;
            } else {
                lo = i + 1;
            }
        }
        return 0.0;
    }
}
```

#### Rust

Casting partition values to `i64` and using `i64::MIN`/`i64::MAX` as sentinels keeps comparisons safe when the input is at the edge of `i32`. Binding `(a, b)` as references avoids cloning either input vector.

```rust
fn find_median_sorted_arrays(nums1: Vec<i32>, nums2: Vec<i32>) -> f64 {
    let (a, b) = if nums1.len() <= nums2.len() {
        (&nums1, &nums2)
    } else {
        (&nums2, &nums1)
    };
    let m = a.len();
    let n = b.len();
    let half = (m + n + 1) / 2;
    let (mut lo, mut hi) = (0usize, m);

    loop {
        let i = (lo + hi) / 2;
        let j = half - i;

        let left1  = if i > 0 { a[i - 1] as i64 } else { i64::MIN };
        let left2  = if j > 0 { b[j - 1] as i64 } else { i64::MIN };
        let right1 = if i < m { a[i] as i64 }     else { i64::MAX };
        let right2 = if j < n { b[j] as i64 }     else { i64::MAX };

        if left1 <= right2 && left2 <= right1 {
            if (m + n) % 2 == 1 {
                return left1.max(left2) as f64;
            }
            return (left1.max(left2) + right1.min(right2)) as f64 / 2.0;
        } else if left1 > right2 {
            hi = i - 1;
        } else {
            lo = i + 1;
        }
    }
}
```

#### Go

`math.MinInt64`/`math.MaxInt64` as sentinels keep the comparison correct without overflow. Note the local `max`/`min` helpers — needed in older Go versions; from 1.21 the builtins remove this boilerplate.

```go
func findMedianSortedArrays(nums1 []int, nums2 []int) float64 {
    if len(nums1) > len(nums2) {
        nums1, nums2 = nums2, nums1
    }
    m, n := len(nums1), len(nums2)
    half := (m + n + 1) / 2
    lo, hi := 0, m

    for lo <= hi {
        i := (lo + hi) / 2
        j := half - i

        left1, left2, right1, right2 := math.MinInt64, math.MinInt64, math.MaxInt64, math.MaxInt64
        if i > 0 { left1 = nums1[i-1] }
        if j > 0 { left2 = nums2[j-1] }
        if i < m { right1 = nums1[i] }
        if j < n { right2 = nums2[j] }

        if left1 <= right2 && left2 <= right1 {
            if (m+n)%2 == 1 {
                return float64(max(left1, left2))
            }
            return float64(max(left1, left2)+min(right1, right2)) / 2.0
        } else if left1 > right2 {
            hi = i - 1
        } else {
            lo = i + 1
        }
    }
    return 0.0
}

func max(a, b int) int {
    if a > b { return a }
    return b
}
func min(a, b int) int {
    if a < b { return a }
    return b
}
```

#### C++

Swapping the inputs with `std::swap` mutates the caller's vectors (cheap because vectors swap pointers) instead of taking references to a chosen shorter side. Promoting to `long` for the partition values handles the `LLONG_MIN`/`LLONG_MAX` sentinels without overflow.

```cpp
#include <vector>
#include <climits>
#include <algorithm>

double findMedianSortedArrays(std::vector<int>& nums1, std::vector<int>& nums2) {
    if (nums1.size() > nums2.size()) std::swap(nums1, nums2);
    int m = (int)nums1.size(), n = (int)nums2.size();
    int half = (m + n + 1) / 2;
    int lo = 0, hi = m;

    while (lo <= hi) {
        int i = (lo + hi) / 2;
        int j = half - i;

        long left1  = (i > 0) ? nums1[i - 1] : LLONG_MIN;
        long left2  = (j > 0) ? nums2[j - 1] : LLONG_MIN;
        long right1 = (i < m) ? nums1[i]     : LLONG_MAX;
        long right2 = (j < n) ? nums2[j]     : LLONG_MAX;

        if (left1 <= right2 && left2 <= right1) {
            if ((m + n) % 2 == 1) return (double)std::max(left1, left2);
            return (std::max(left1, left2) + std::min(right1, right2)) / 2.0;
        } else if (left1 > right2) {
            hi = i - 1;
        } else {
            lo = i + 1;
        }
    }
    return 0.0;
}
```


### 4. Longest Palindromic Substring

#### Problem
Given a string `s`, return the longest substring that is a palindrome. If there are multiple answers of the same length, return any one of them.

#### Examples

```text
Input: s = "babad"
Output: "bab"
Explanation: "aba" is also a valid answer.

Input: s = "cbbd"
Output: "bb"

Input: s = "ac"
Output: "a"

Constraints:
- 1 <= s.length <= 1000
- s consists of digits and English letters
- any longest answer is accepted when several tie
```

#### Recognition
**Signals.** "Longest substring that is a palindrome", where substring means contiguous, so the answer is one interval and not a subsequence problem. The property being searched for is *inherited inward*: if `s[l..r]` is a palindrome then `s[l+1..r-1]` is one too, and the reverse direction is what you exploit, growing a known palindrome by testing one character at each end. `s.length <= 1000` puts `O(n²)` in budget and rules out `O(n³)`. **Therefore.** Try all `2n - 1` centers, `n` single characters plus `n - 1` gaps between adjacent characters, and expand each outward while the ends match, keeping the longest seen. **Not the DP table** over `is s[i..j] a palindrome`, which reaches the same `O(n²)` time but pays `O(n²)` memory to store answers that expansion computes and discards. Manacher's algorithm is `O(n)` and almost never expected. **O(n²)** time, **O(1)** space.

#### Explanation
**Brute force.** Test every substring, keep the longest that reads the same backwards.

```python
def longestPalindrome(s):
    best = ""
    n = len(s)
    for i in range(n):
        for j in range(i, n):
            sub = s[i:j + 1]
            if sub == sub[::-1] and len(sub) > len(best):
                best = sub
    return best
```

`O(n³)` time, `O(n)` space.

**Wasteful because.** Checking `s[i..j]` starts over from both ends every time, when the answer for `s[i+1..j-1]` was computed moments earlier and fully determines it. There are `O(n²)` substrings and each verification is an independent `O(n)` scan that re-reads characters already compared.

**Optimal.** Turn the inheritance around and build outward instead of testing inward. Every palindrome has a center, and there are only `2n - 1` of them, because an even-length palindrome is centered on the gap between two characters rather than on a character. From each center, compare the two ends and step outward while they match; the moment they differ, no wider palindrome shares that center, so the expansion stops with the maximum for that center already known. Each expansion is `O(n)` at worst and every comparison contributes to a new candidate rather than re-verifying an old one. Only the best start and length are kept, so nothing beyond a few integers is stored.

**Edge cases.** A string with no palindrome longer than one character, such as `"ac"`, must return a single character and not the empty string. Even-length answers like `"bb"` are found only by the gap centers, which is why `expand(i, i + 1)` is called as well. The whole string being a palindrome means the first center already expands to the full length. A single-character input returns itself.

#### Python

Closure over `res` via `nonlocal` keeps the expand helper short; the slice `s[l:r+1]` is built only when a new best is found, so allocation stays minimal.

```python
def longestPalindrome(s):
    res = ""

    def expand(l, r):
        nonlocal res
        while l >= 0 and r < len(s) and s[l] == s[r]:
            if r - l + 1 > len(res):
                res = s[l:r + 1]
            l -= 1
            r += 1

    for i in range(len(s)):
        expand(i, i)
        expand(i, i + 1)

    return res
```

#### Java

No closures over mutable locals in Java, so track `bestStart`/`bestLen` as fields (or return-by-effect on instance state) and have `expand` update them directly. `s.substring(start, end)` is the single allocation, built only at the end.

```java
class Solution {
    private int bestStart = 0, bestLen = 0;

    public String longestPalindrome(String s) {
        for (int i = 0; i < s.length(); i++) {
            expand(s, i, i);
            expand(s, i, i + 1);
        }
        return s.substring(bestStart, bestStart + bestLen);
    }

    private void expand(String s, int l, int r) {
        while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) {
            if (r - l + 1 > bestLen) {
                bestLen = r - l + 1;
                bestStart = l;
            }
            l--;
            r++;
        }
    }
}
```

#### Rust

Operating on `s.as_bytes()` avoids UTF-8 decoding for every comparison — safe here because the input is ASCII. Casting to `isize` lets `l` go negative as a loop-termination signal, then the helper returns the `(start, len)` pair so the outer loop tracks only the best.

```rust
fn longest_palindrome(s: String) -> String {
    let b = s.as_bytes();
    let n = b.len();
    if n == 0 { return String::new(); }
    let (mut best_start, mut best_len) = (0usize, 1usize);

    let expand = |mut l: isize, mut r: isize| -> (usize, usize) {
        while l >= 0 && r < n as isize && b[l as usize] == b[r as usize] {
            l -= 1;
            r += 1;
        }
        ((l + 1) as usize, (r - l - 1) as usize)
    };

    for i in 0..n {
        let (s1, l1) = expand(i as isize, i as isize);
        if l1 > best_len { best_start = s1; best_len = l1; }
        if i + 1 < n {
            let (s2, l2) = expand(i as isize, (i + 1) as isize);
            if l2 > best_len { best_start = s2; best_len = l2; }
        }
    }
    s[best_start..best_start + best_len].to_string()
}
```

#### Go

Indexing the string directly (`s[l] == s[r]`) works on bytes — fine for ASCII LeetCode inputs. The closure captures `bestStart`/`bestLen` by reference so the outer loop just calls `expand` twice per center.

```go
func longestPalindrome(s string) string {
    n := len(s)
    if n == 0 { return "" }
    bestStart, bestLen := 0, 1

    expand := func(l, r int) {
        for l >= 0 && r < n && s[l] == s[r] {
            if r-l+1 > bestLen {
                bestLen = r - l + 1
                bestStart = l
            }
            l--
            r++
        }
    }

    for i := 0; i < n; i++ {
        expand(i, i)
        expand(i, i+1)
    }
    return s[bestStart : bestStart+bestLen]
}
```

#### C++

The lambda captures by `[&]` to mutate `bestStart`/`bestLen` from inside. `s.substr(bestStart, bestLen)` is the only allocation in the whole function.

```cpp
#include <string>
#include <algorithm>

std::string longestPalindrome(std::string s) {
    int n = (int)s.size();
    if (n == 0) return "";
    int bestStart = 0, bestLen = 1;

    auto expand = [&](int l, int r) {
        while (l >= 0 && r < n && s[l] == s[r]) { --l; ++r; }
        int len = r - l - 1;
        if (len > bestLen) { bestLen = len; bestStart = l + 1; }
    };

    for (int i = 0; i < n; ++i) {
        expand(i, i);
        expand(i, i + 1);
    }
    return s.substr(bestStart, bestLen);
}
```


### 5. Coin Change II

#### Problem
Given an integer `amount` and an array of coin denominations, return the number of combinations (not permutations) of coins that sum to `amount`. You may use each coin denomination an unlimited number of times.

#### Examples

```text
Input: amount = 5, coins = [1,2,5]
Output: 4
Explanation: 5=5, 5=2+2+1, 5=2+1+1+1, 5=1+1+1+1+1.

Input: amount = 3, coins = [2]
Output: 0

Input: amount = 0, coins = [7]
Output: 1

Constraints:
- 1 <= coins.length <= 300
- 1 <= coins[i] <= 5000
- 0 <= amount <= 5000
- the denominations are distinct
```

#### Recognition
**Signals.** "Return the number of combinations", not the combinations themselves, so nothing needs to be enumerated and the answer is one integer. "Unlimited number of times" is the unbounded part: a denomination is never used up, so the state after choosing a coin still allows that same coin. The parenthesised "not permutations" is the whole difficulty, because it says two orderings of the same multiset are one answer. With `amount <= 5000` and 300 coins, a table of 1.5 million cells is nothing while enumeration is hopeless. **Therefore.** A 1-D table where `dp[a]` counts the ways to make `a`, filled with the coins in the outer loop so each denomination is finished before the next is introduced. **Not amount-outer, coin-inner**, the same three lines with the loops swapped, which counts every ordering separately and is the standard way this problem is failed. **O(n * amount)** time, **O(amount)** space.

#### Explanation
**Brute force.** Recurse on "use this coin again, or move past it".

```python
def change(amount, coins):
    def count(i, rem):
        if rem == 0:
            return 1
        if rem < 0 or i == len(coins):
            return 0
        return count(i, rem - coins[i]) + count(i + 1, rem)
    return count(0, amount)
```

Exponential time, `O(amount)` stack.

**Wasteful because.** The pair `(i, rem)` is all that determines the answer, and the recursion reaches the same pair down many different paths, recomputing the entire subtree each time. With `amount = 5000` there are at most 300 times 5001 distinct pairs, and the naive version visits vastly more calls than that.

**Optimal.** Store each `(i, rem)` answer once. Going bottom up removes the recursion too: start from `dp[0] = 1`, the one way to make nothing, which is to take no coins, and for each coin sweep amounts upward adding `dp[a - coin]` into `dp[a]`. Sweeping upward rather than downward is what encodes unlimited reuse, because `dp[a - coin]` has already absorbed the current coin by the time it is read. Only one row is needed because the row for coin `i` is built from the row for coin `i - 1` in place. Keeping coins outermost is the part that counts combinations: when coin 2 is processed, coin 1 is already fully accounted for and never appears after it, so `1 + 2` and `2 + 1` are the same single path through the loops.

**Edge cases.** `amount = 0` returns 1, the empty selection, and it is what seeds the table. A coin larger than `amount` makes its inner loop body never run and contributes nothing. An unreachable amount, such as 3 from `[2]`, returns 0 rather than failing.

#### Python

List comprehension `[0] * (amount + 1)` is the standard 1D DP buffer. The coin-outer / amount-inner loop order is what counts combinations rather than permutations — easy to flip by accident.

```python
def change(amount, coins):
    dp = [0] * (amount + 1)
    dp[0] = 1
    for coin in coins:
        for a in range(coin, amount + 1):
            dp[a] += dp[a - coin]
    return dp[amount]
```

#### Java

`new int[amount + 1]` zero-initializes automatically — no fill needed. The coin-outer / amount-inner loop order is what counts combinations rather than permutations; enhanced for-loop over `coins` keeps it clean.

```java
class Solution {
    public int change(int amount, int[] coins) {
        int[] dp = new int[amount + 1];
        dp[0] = 1;
        for (int coin : coins) {
            for (int a = coin; a <= amount; a++) {
                dp[a] += dp[a - coin];
            }
        }
        return dp[amount];
    }
}
```

#### Rust

`vec![0i32; amount + 1]` allocates the DP table once; the inclusive range `coin..=amount` keeps the inner loop bounds-safe without index arithmetic. The `coin as usize` cast happens once per coin, not per iteration.

```rust
fn change(amount: i32, coins: Vec<i32>) -> i32 {
    let amount = amount as usize;
    let mut dp = vec![0i32; amount + 1];
    dp[0] = 1;
    for coin in coins {
        let coin = coin as usize;
        for a in coin..=amount {
            dp[a] += dp[a - coin];
        }
    }
    dp[amount]
}
```

#### Go

`make([]int, amount+1)` zero-initializes the DP table — no need to loop and fill. The two-level loop reads almost identically to the math definition.

```go
func change(amount int, coins []int) int {
    dp := make([]int, amount+1)
    dp[0] = 1
    for _, coin := range coins {
        for a := coin; a <= amount; a++ {
            dp[a] += dp[a-coin]
        }
    }
    return dp[amount]
}
```

#### C++

`std::vector<int>(amount + 1, 0)` zero-initializes in the constructor. Range-for `for (int coin : coins)` keeps the outer loop clean; the inner is plain indexed iteration since you need the index.

```cpp
#include <vector>

int change(int amount, std::vector<int>& coins) {
    std::vector<int> dp(amount + 1, 0);
    dp[0] = 1;
    for (int coin : coins) {
        for (int a = coin; a <= amount; ++a) {
            dp[a] += dp[a - coin];
        }
    }
    return dp[amount];
}
```


### 6. Reverse Integer

#### Problem
Given a 32-bit signed integer `x`, return `x` with its digits reversed. If the reversed integer overflows the 32-bit signed range `[-2³¹, 2³¹ - 1]`, return 0.

#### Examples

```text
Input: x = 123
Output: 321

Input: x = -123
Output: -321

Input: x = 1534236469
Output: 0
Explanation: reversed it is 9646324351, past 2^31 - 1.

Constraints:
- -2^31 <= x <= 2^31 - 1
- 2^31 - 1 is 2147483647, -2^31 is -2147483648
- return 0 when the reversed value leaves that range
```

#### Recognition
**Signals.** "Digits reversed" over "a 32-bit signed integer", with a rule for what happens when the result "overflows the 32-bit signed range". Reversing the digits is not the problem; the overflow clause is, and it is stated in terms of a fixed-width type, which says the intended solution builds the answer in that type and guards it rather than escaping to a wider one. There is no array, nothing to search and nothing to compare, so the only tools available are `% 10` to read the last digit and `// 10` to drop it, at most ten steps for any 32-bit value. **Therefore.** Peel the last digit off `x` and push it onto `res` with `res = res * 10 + d`, checking the range before or after each push depending on the language. **Not a round trip through a string**, reversing the characters and parsing back, which allocates two buffers for a value that fits in one register and lets the parser silently produce something outside the 32-bit range. **O(log x)** time, **O(1)** space.

#### Explanation
**Brute force.** Print it, reverse the text, read it back.

```python
def reverse(x):
    sign = -1 if x < 0 else 1
    digits = str(abs(x))
    res = sign * int(digits[::-1])
    if res < -(2 ** 31) or res > 2 ** 31 - 1:
        return 0
    return res
```

`O(d)` time, `O(d)` space for `d` digits.

**Wasteful because.** Nothing is recomputed here; the cost is the detour. Two heap buffers are allocated and a decimal parser is run to move at most ten digits that arithmetic can address directly, and the parse happily builds a value outside the 32-bit range, so the check that matters happens only after the number the problem forbids has already been constructed.

**Optimal.** Do the same reversal with two operators. `x % 10` is the last digit and `x // 10` is everything above it, so each step moves one digit from the bottom of `x` to the bottom of `res` after shifting `res` up by a factor of ten. That is exactly a reversal, because the first digit removed is the last one placed. Strip the sign first and reapply it at the end: Python's floor division rounds toward negative infinity, so `-7 % 10` is 3 rather than the `-7` the other four languages produce, and the sign strip makes the code read the same everywhere. The guard is then one comparison against the two bounds, and in Java, Go and C++ the accumulation is done in a 64-bit type so the check happens before any narrowing.

**Edge cases.** Trailing zeros vanish, so 120 reverses to 21 and never to 021. Zero itself skips the loop entirely and returns 0. `-2147483648` reverses to `-8463847412`, past `-2^31`, so it returns 0; it is also the one value with no positive counterpart in a 32-bit int, which is why the Java, Go and C++ versions keep the sign and lean on `%` truncating toward zero instead of calling `abs`.

#### Python

Python's `//` on negatives floors toward `-∞`, so the explicit sign strip (`abs(x)` then reapply) avoids the `-7 % 10 == 3` surprise. Arbitrary-precision ints mean overflow only needs to be checked once at the end.

```python
def reverse(x):
    sign = -1 if x < 0 else 1
    x = abs(x)
    res = 0
    while x:
        res = res * 10 + x % 10
        x //= 10
    res *= sign
    if res < -(2**31) or res > 2**31 - 1:
        return 0
    return res
```

#### Java

Widen `res` to `long` during the build to dodge signed-overflow, then bounds-check against `Integer.MIN_VALUE`/`Integer.MAX_VALUE` before narrowing. Java's `%` truncates toward zero like C, so negatives need no sign normalization.

```java
class Solution {
    public int reverse(int x) {
        long res = 0;
        while (x != 0) {
            res = res * 10 + x % 10;
            x /= 10;
        }
        if (res < Integer.MIN_VALUE || res > Integer.MAX_VALUE) {
            return 0;
        }
        return (int) res;
    }
}
```

#### Rust

`checked_mul` + `and_then(|r| r.checked_add(...))` is the idiomatic overflow-aware chain — returning `0` on `None` matches the problem's contract. Rust's `i32 % 10` truncates toward zero like C, so no sign normalization is needed.

```rust
fn reverse(x: i32) -> i32 {
    let mut x = x;
    let mut res: i32 = 0;
    while x != 0 {
        let digit = x % 10;
        x /= 10;
        if let Some(v) = res.checked_mul(10).and_then(|r| r.checked_add(digit)) {
            res = v;
        } else {
            return 0;
        }
    }
    res
}
```

#### Go

Go's `int` is 64-bit on most platforms, so `res*10 + x%10` can't overflow during construction — the only check is the final `math.MinInt32`/`math.MaxInt32` bounds.

```go
import "math"

func reverse(x int) int {
    res := 0
    for x != 0 {
        res = res*10 + x%10
        x /= 10
    }
    if res < math.MinInt32 || res > math.MaxInt32 {
        return 0
    }
    return res
}
```

#### C++

Widening `res` to `long` sidesteps signed-overflow undefined behavior during the build, then a single `INT_MIN`/`INT_MAX` check at the end. C++ `%` truncates toward zero, so the sign of `x` is preserved naturally.

```cpp
#include <climits>

int reverse(int x) {
    long res = 0;
    while (x != 0) {
        res = res * 10 + x % 10;
        x /= 10;
    }
    if (res < INT_MIN || res > INT_MAX) return 0;
    return (int)res;
}
```


### 7. Contains Duplicate

#### Problem
Given an integer array `nums`, return `true` if any value appears at least twice, and `false` if every element is distinct.

#### Examples

```text
Input: nums = [1,2,3,1]
Output: true

Input: nums = [1,2,3,4]
Output: false

Input: nums = [1,1,1,3,3,4,3,2,4,2]
Output: true

Constraints:
- 1 <= nums.length <= 10^5
- -10^9 <= nums[i] <= 10^9
```

#### Recognition
**Signals.** "Return `true` if any value appears at least twice" asks exactly one thing: has this value been seen before. There is no index to report, no ordering to preserve, no count to compare, so it is a pure membership question and nothing about the input has to survive the scan. The bound `n <= 10^5` rules out the pairwise scan on its own, since that is 5 billion comparisons at the top end. **Therefore.** Stream the array into a hash set and return the moment an insert finds the value already present, which stops on the first duplicate instead of always paying full cost. **Not sorting**, which does make duplicates adjacent and needs no extra structure, but costs `O(n log n)` and reorders the caller's array; take it only when memory rather than time is the binding constraint. **Not a nested loop**, the `O(n^2)` baseline this exists to beat. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Compare every pair.

```python
def containsDuplicate(nums):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] == nums[j]:
                return True
    return False
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** For each `i` the inner loop rescans the entire suffix to answer "does this value occur later?" That is a membership query answered by a linear walk, and it is re-answered from scratch `n` times.

**Optimal.** Keep a hash set of everything seen so far and the walk collapses to one `O(1)` lookup. Test-and-insert in a single call is the idiom in most languages: `HashSet.add` in Java, `insert` in Rust and C++ all report whether the value was new, so one pass suffices and the function returns on the first repeat. Python's `len(nums) != len(set(nums))` says the same thing more compactly but builds the whole set before comparing lengths, so it cannot exit early. On an array whose first two elements match, the explicit loop does two inserts and the one-liner does `n`. Sorting is the alternative worth naming out loud when `O(1)` extra space is required, since it swaps the set for an `O(n log n)` time bill.

**Edge cases.** A single-element array has no pair and returns false. An array of identical values returns true at the second element. Negative values and zero hash like any other integer, so no special casing.

#### Python

One-liner using `set(nums)` — readable, but it allocates the full set before comparing lengths, so it can't short-circuit on an early duplicate. For tiny inputs the simplicity wins; for huge ones the explicit loop is faster.

```python
def containsDuplicate(nums):
    return len(nums) != len(set(nums))
```

#### Java

`HashSet.add` returns `false` when the element was already present — the same check-and-insert-in-one-call idiom as Rust/C++, and it short-circuits on the first duplicate.

```java
import java.util.*;

class Solution {
    public boolean containsDuplicate(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int n : nums) {
            if (!seen.add(n)) {
                return true;
            }
        }
        return false;
    }
}
```

#### Rust

`HashSet::insert` returns `false` if the element was already present — the idiomatic way to check-and-insert in one call. Short-circuits on the first duplicate.

```rust
use std::collections::HashSet;

fn contains_duplicate(nums: Vec<i32>) -> bool {
    let mut seen = HashSet::new();
    for n in nums {
        if !seen.insert(n) {
            return true;
        }
    }
    false
}
```

#### Go

Go has no built-in set, so `map[int]struct{}` is the zero-byte-value idiom. The two-step check-then-insert is needed because there's no atomic 'insert if absent and tell me' primitive.

```go
func containsDuplicate(nums []int) bool {
    seen := make(map[int]struct{})
    for _, n := range nums {
        if _, ok := seen[n]; ok {
            return true
        }
        seen[n] = struct{}{}
    }
    return false
}
```

#### C++

`seen.insert(n)` returns a `pair<iterator, bool>` where `.second` is true on successful insertion — `!insert().second` is the canonical 'was already there' check, same shape as Rust's API.

```cpp
#include <vector>
#include <unordered_set>

bool containsDuplicate(std::vector<int>& nums) {
    std::unordered_set<int> seen;
    for (int n : nums) {
        if (!seen.insert(n).second) return true;
    }
    return false;
}
```


### 8. Valid Anagram

#### Problem
Given two strings `s` and `t`, return `true` if `t` is an anagram of `s` (contains exactly the same characters with the same frequencies), and `false` otherwise.

#### Examples

```text
Input: s = "anagram", t = "nagaram"
Output: true

Input: s = "rat", t = "car"
Output: false

Input: s = "a", t = "ab"
Output: false

Constraints:
- 1 <= s.length, t.length <= 5 * 10^4
- s and t consist of lowercase English letters
```

#### Recognition
**Signals.** "Exactly the same characters with the same frequencies" defines the answer entirely in terms of counts, so position and order carry no information at all and any work that establishes an order is work you will throw away. The constraint "lowercase English letters" is the second signal and it fixes the alphabet at 26, which is what turns the tally from `O(k)` space into a constant. Unequal lengths can never be anagrams, so one comparison disposes of a large share of inputs before any counting starts. **Therefore.** One array of 26 counters: increment on `s`, decrement on `t` in the same pass, then check every counter is zero. **Not sorting both strings and comparing**, the answer most people give, which is correct and one line but spends `O(n log n)` computing a total ordering when only multiset equality was asked for, and needs a copy of both inputs to sort. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Sort both strings and compare them.

```python
def isAnagram(s, t):
    if len(s) != len(t):
        return False
    a = list(s)
    b = list(t)
    a.sort()
    b.sort()
    return a == b
```

`O(n log n)` time, `O(n)` space.

**Wasteful because.** Sorting answers a much harder question than the one asked. It computes where every character stands relative to every other, at a cost of `n log n` comparisons, and then uses that ordering for exactly one thing: checking whether two multisets match. The ordering itself is discarded the moment the comparison returns.

**Optimal.** Count instead of order. Because the alphabet is 26 fixed letters, a plain array indexed by `ord(c) - ord('a')` is a complete frequency table, and it is the same 26 integers whether the strings are 3 characters or 50,000, which is where the constant space comes from. The two strings can be walked together once the lengths are known equal, adding one for each character of `s` and subtracting one for the matching position of `t`; the strings are anagrams exactly when every counter lands back on zero. The length guard is not just an optimisation in the Python version: `zip` stops at the shorter string, so without it the tail of the longer one would never be counted. If the alphabet were Unicode, swap the array for a hash map and the space becomes `O(k)` distinct characters.

**Edge cases.** Different lengths return false before a single character is read. Two identical strings are anagrams of each other. Strings with the same letters in different quantities, such as `"aab"` and `"abb"`, are caught by two nonzero counters rather than by any length or membership check.

#### Python

Parallel `zip(s, t)` iteration with `ord(a) - ord('a')` indexes the 26-element array directly. `all(c == 0 for c in count)` reads as the postcondition; a generator avoids building an intermediate list.

```python
def isAnagram(s, t):
    if len(s) != len(t):
        return False
    count = [0] * 26
    for a, b in zip(s, t):
        count[ord(a) - ord('a')] += 1
        count[ord(b) - ord('a')] -= 1
    return all(c == 0 for c in count)
```

#### Java

A fixed `int[26]` (auto-zeroed) replaces a map entirely; `s.charAt(i) - 'a'` indexes it directly. Early-exit on length mismatch, then increment for `s` and decrement for `t` in one pass.

```java
class Solution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        int[] count = new int[26];
        for (int i = 0; i < s.length(); i++) {
            count[s.charAt(i) - 'a']++;
            count[t.charAt(i) - 'a']--;
        }
        for (int c : count) {
            if (c != 0) return false;
        }
        return true;
    }
}
```

#### Rust

Iterating `s.bytes()` instead of `s.chars()` skips UTF-8 decoding — safe because the inputs are constrained to lowercase ASCII. The fixed `[i32; 26]` array lives on the stack, no allocation.

```rust
fn is_anagram(s: String, t: String) -> bool {
    if s.len() != t.len() { return false; }
    let mut count = [0i32; 26];
    for (a, b) in s.bytes().zip(t.bytes()) {
        count[(a - b'a') as usize] += 1;
        count[(b - b'a') as usize] -= 1;
    }
    count.iter().all(|&c| c == 0)
}
```

#### Go

Indexing `s[i]` gives the byte directly; `s[i]-'a'` is a clean array index. A plain `[26]int` (array, not slice) keeps everything on the stack.

```go
func isAnagram(s string, t string) bool {
    if len(s) != len(t) { return false }
    var count [26]int
    for i := 0; i < len(s); i++ {
        count[s[i]-'a']++
        count[t[i]-'a']--
    }
    for _, c := range count {
        if c != 0 { return false }
    }
    return true
}
```

#### C++

`std::array<int, 26>{}` value-initializes to zero with the empty brace. Fixed-size and stack-allocated, no heap overhead vs. `std::vector`.

```cpp
#include <string>
#include <array>

bool isAnagram(std::string s, std::string t) {
    if (s.size() != t.size()) return false;
    std::array<int, 26> count{};
    for (int i = 0; i < (int)s.size(); ++i) {
        count[s[i] - 'a']++;
        count[t[i] - 'a']--;
    }
    for (int c : count) if (c != 0) return false;
    return true;
}
```


### 9. Group Anagrams

#### Problem
Given an array of strings, group the strings that are anagrams of each other and return the groups in any order.

#### Examples

```text
Compare: any-order-nested

Input: strs = ["eat","tea","tan","ate","nat","bat"]
Output: [["bat"],["nat","tan"],["ate","eat","tea"]]

Input: strs = [""]
Output: [[""]]

Input: strs = ["a"]
Output: [["a"]]

Constraints:
- 1 <= strs.length <= 10^4
- 0 <= strs[i].length <= 100
- strs[i] is lowercase English letters only
```

#### Recognition
**Signals.** "Group the strings that are anagrams of each other" plus "return the groups in any order". Grouping by a property means you need a *canonical form* of that property to key on, and "anagram" is a statement about character counts, nothing else. The any-order clause tells you the output is a partition, not a ranking, so no sorting of results is needed either. **Therefore.** A hashmap from canonical key to bucket, built in one pass. The only real question is what the key is, and counts beat sorted characters because counting is one linear pass per string. **Not sorting the whole array**, which groups nothing on its own since anagrams are not adjacent under lexicographic order. **Not pairwise comparison** of every string against every other, the `O(n^2 * k)` baseline. **O(n * k)** time, **O(n * k)** space.

#### Explanation
**Brute force.** Compare every string against every group's representative.

```python
def groupAnagrams(strs):
    groups = []
    for s in strs:
        for g in groups:
            if sorted(g[0]) == sorted(s):
                g.append(s)
                break
        else:
            groups.append([s])
    return groups
```

`O(n^2 * k log k)` time.

**Wasteful because.** It re-sorts the representative on every comparison, and it asks "does this string belong here?" once per existing group when the answer is fully determined by the string itself.

**Optimal.** Compute a canonical key that any two anagrams share, and let a hashmap do the grouping. Sorting the characters is the obvious key and costs `O(k log k)` per string. Counting them is better: a 26-element tally is one `O(k)` pass, and the resulting fixed-width key hashes and compares faster than a variable-length string. That gives `O(n * k)` overall. Sorting stays the better answer when the alphabet is large or unbounded, because the count array is sized by the alphabet rather than by the string.

**Edge cases.** The empty string is a valid key and forms its own group. A single-element array is trivially one group. Strings of different lengths can never collide, since their totals differ.

#### Python

A `tuple` of counts is hashable so it can key a dict directly. `setdefault(key, []).append(s)` is one of Python's few really tidy 'get-or-create then mutate' patterns.

```python
def groupAnagrams(strs):
    groups = {}
    for s in strs:
        count = [0] * 26
        for c in s:
            count[ord(c) - ord('a')] += 1
        groups.setdefault(tuple(count), []).append(s)
    return list(groups.values())
```

#### Java

`Arrays.toString(count)` gives a cheap canonical key without writing a custom
hash. `computeIfAbsent(key, k -> new ArrayList<>())` is Java's tidy
get-or-create-then-mutate.

```java
import java.util.*;

class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> groups = new HashMap<>();
        for (String s : strs) {
            int[] count = new int[26];
            for (char c : s.toCharArray()) count[c - 'a']++;
            String key = Arrays.toString(count);
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }
        return new ArrayList<>(groups.values());
    }
}
```

#### Rust

A fixed `[u8; 26]` array is `Hash + Eq`, so it keys the map with no allocation
at all. `entry(key).or_default().push(s)` is the canonical
get-or-create-and-mutate.

```rust
use std::collections::HashMap;

fn group_anagrams(strs: Vec<String>) -> Vec<Vec<String>> {
    let mut groups: HashMap<[u8; 26], Vec<String>> = HashMap::new();
    for s in strs {
        let mut key = [0u8; 26];
        for b in s.bytes() {
            key[(b - b'a') as usize] += 1;
        }
        groups.entry(key).or_default().push(s);
    }
    groups.into_values().collect()
}
```

#### Go

Go arrays (unlike slices) are comparable, so `[26]int` is directly usable as a
map key with no encoding step at all. This is one of the few places the
array/slice distinction pays off.

```go
func groupAnagrams(strs []string) [][]string {
    groups := make(map[[26]int][]string)
    for _, s := range strs {
        var key [26]int
        for _, c := range s {
            key[c-'a']++
        }
        groups[key] = append(groups[key], s)
    }
    res := make([][]string, 0, len(groups))
    for _, v := range groups {
        res = append(res, v)
    }
    return res
}
```

#### C++

`std::array` has no standard hash, so the counts are packed into a short
`string` of 26 chars, which `unordered_map` hashes for free. `std::move(v)` in
the final loop avoids copying each bucket's vector into the result.

```cpp
#include <vector>
#include <string>
#include <unordered_map>

std::vector<std::vector<std::string>> groupAnagrams(
        std::vector<std::string>& strs) {
    std::unordered_map<std::string, std::vector<std::string>> groups;
    for (const auto& s : strs) {
        std::string key(26, 0);
        for (char c : s) key[c - 'a']++;
        groups[key].push_back(s);
    }
    std::vector<std::vector<std::string>> res;
    res.reserve(groups.size());
    for (auto& [_, v] : groups) res.push_back(std::move(v));
    return res;
}
```


### 10. Top K Frequent Elements

#### Problem
Given an integer array `nums` and an integer `k`, return the `k` most frequent elements. The answer can be returned in any order and is guaranteed to be unique.

#### Examples

```text
Compare: any-order

Input: nums = [1,1,1,2,2,3], k = 2
Output: [1,2]

Input: nums = [1], k = 1
Output: [1]

Input: nums = [4,4,-1,-1,3], k = 2
Output: [4,-1]

Constraints:
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4
- 1 <= k <= number of distinct values in nums
- the answer is guaranteed to be unique
```

#### Recognition
**Signals.** "Most frequent" means you need a count per value, so a frequency map is forced before anything else can happen. "Top `k`" is a selection layered on that map, and "returned in any order" says the output is a set rather than a ranking, so the counts never need to be fully ordered. The last signal is a bound hiding in the data: no value can occur more than `n` times, so every count is an integer in `[1, n]`. **Therefore.** Count in one pass, then bucket by count into an array of `n + 1` lists and walk it from the back until `k` values are collected. Indexing by a bounded integer replaces comparison entirely. **Not a size-`k` min-heap**, which is the answer most people give and is genuinely good at `O(n log k)`; it loses only because the counts are bounded here, which is what makes the log disappear. Reach for it when the counts are unbounded or the data arrives as a stream. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Count, sort the counts, take the first `k`.

```python
def topKFrequent(nums, k):
    count = {}
    for n in nums:
        count[n] = count.get(n, 0) + 1
    pairs = sorted(count.items(), key=lambda p: -p[1])
    return [val for val, _ in pairs[:k]]
```

`O(n log n)` time, `O(n)` space.

**Wasteful because.** Sorting puts every distinct value into total frequency order when only the `k`th boundary matters. The relative order of everything below that boundary is computed in full and then thrown away.

**Optimal.** A size-`k` min-heap is the standard fix and reaches `O(n log k)`: push each value keyed by its count and evict the smallest whenever the heap grows past `k`. That is a good answer, and it is the one to say first. Bucket sort beats it because the sort key is not arbitrary. A count is an integer in `[1, n]`, so it can be an array index rather than something to compare. Allocate `n + 1` empty lists, drop each value into `buckets[count]`, then scan from index `n` downward, appending until `k` values are in hand. Filling costs one step per distinct value and the scan costs `O(n)`, so the whole thing is linear with no log factor anywhere. The heap wins back the moment counts are not bounded by `n`, for instance over an unbounded stream where you cannot size the bucket array.

**Edge cases.** Ties at the `k` boundary are why the problem guarantees a unique answer; a single bucket holds every value sharing that count. `k` equal to the number of distinct values drains every bucket. Bucket 0 is never filled, so the walk stops before reaching it.

#### Python

Buckets are a list-of-lists indexed by frequency — `nums.length + 1` slots because frequency can be at most `n`. Walking buckets high-to-low with `extend` + length check short-circuits cleanly.

```python
def topKFrequent(nums, k):
    count = {}
    for n in nums:
        count[n] = count.get(n, 0) + 1
    buckets = [[] for _ in range(len(nums) + 1)]
    for n, c in count.items():
        buckets[c].append(n)
    res = []
    for i in range(len(buckets) - 1, 0, -1):
        res.extend(buckets[i])
        if len(res) >= k:
            return res[:k]
```

#### Java

`getOrDefault(n, 0) + 1` folds the count update into one lookup. Buckets are an `List<Integer>[]` indexed by frequency; walk them high-to-low, adding until the result reaches `k`.

```java
import java.util.*;

class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>();
        for (int n : nums) {
            count.put(n, count.getOrDefault(n, 0) + 1);
        }
        List<Integer>[] buckets = new List[nums.length + 1];
        for (int i = 0; i <= nums.length; i++) {
            buckets[i] = new ArrayList<>();
        }
        for (Map.Entry<Integer, Integer> e : count.entrySet()) {
            buckets[e.getValue()].add(e.getKey());
        }
        int[] res = new int[k];
        int idx = 0;
        for (int i = buckets.length - 1; i > 0 && idx < k; i--) {
            for (int v : buckets[i]) {
                res[idx++] = v;
                if (idx == k) return res;
            }
        }
        return res;
    }
}
```

#### Rust

`vec![vec![]; n + 1]` allocates the bucket array (note: each inner `vec![]` is a fresh allocation — fine here because buckets are tiny). `buckets.iter().rev()` is the clean way to scan high-to-low without manual indexing.

```rust
fn top_k_frequent(nums: Vec<i32>, k: i32) -> Vec<i32> {
    use std::collections::HashMap;
    let n = nums.len();
    let mut count: HashMap<i32, usize> = HashMap::new();
    for &x in &nums { *count.entry(x).or_insert(0) += 1; }
    let mut buckets: Vec<Vec<i32>> = vec![vec![]; n + 1];
    for (&val, &freq) in &count { buckets[freq].push(val); }
    let mut res = Vec::new();
    for bucket in buckets.iter().rev() {
        for &v in bucket {
            res.push(v);
            if res.len() == k as usize { return res; }
        }
    }
    res
}
```

#### Go

Combining the bucket walk with the early-exit `len(res) < k` in the loop condition makes the code dense but readable. Final `res[:k]` slice keeps the answer at exactly `k` even if the last bucket overshoots.

```go
func topKFrequent(nums []int, k int) []int {
    count := make(map[int]int)
    for _, n := range nums { count[n]++ }
    buckets := make([][]int, len(nums)+1)
    for val, freq := range count { buckets[freq] = append(buckets[freq], val) }
    res := []int{}
    for i := len(buckets) - 1; i > 0 && len(res) < k; i-- {
        res = append(res, buckets[i]...)
    }
    return res[:k]
}
```

#### C++

Reverse iteration via decrementing `i` from `n` down to `1` — there's no neat `views::reverse` here without C++20 ranges. Range-for over the bucket contents is the cleanest inner loop.

```cpp
#include <vector>
#include <unordered_map>

std::vector<int> topKFrequent(std::vector<int>& nums, int k) {
    std::unordered_map<int, int> count;
    for (int n : nums) count[n]++;
    int n = (int)nums.size();
    std::vector<std::vector<int>> buckets(n + 1);
    for (auto& [val, freq] : count) buckets[freq].push_back(val);
    std::vector<int> res;
    for (int i = n; i > 0 && (int)res.size() < k; --i) {
        for (int v : buckets[i]) {
            res.push_back(v);
            if ((int)res.size() == k) return res;
        }
    }
    return res;
}
```


### 11. Encode and Decode Strings

#### Problem
Design an algorithm to encode a list of strings into a single string, and decode that single string back into the original list. The strings may contain any character including `#` and digits.

#### Examples

```text
Compare: roundtrip

Input: strs = ["hello","world"]
Output: ["hello","world"]

Input: strs = ["4#abc","",""]
Output: ["4#abc","",""]

Input: strs = [""]
Output: [""]

Constraints:
- 0 <= strs.length < 100
- 0 <= strs[i].length < 200
- strs[i] may hold any of the 256 ASCII characters
```

#### Recognition
**Signals.** "Encode a list of strings into a single string" and "may contain any character including `#` and digits". The second clause is the entire problem: it says no character can be reserved as a separator, which kills every scheme that finds boundaries by searching the payload. What is left is that the encoding must be self-delimiting, meaning the decoder learns where each string ends from the stream without ever inspecting the content. **Therefore.** Prefix each string with its own length: `"<len>#<content>"`. The `#` does not separate strings, it only terminates the digits, so a `#` inside a payload is never looked at; once the length is parsed the decoder jumps exactly that far. **Not a delimiter with escaping**, which needs every dangerous character enumerated, rescans character by character to find each boundary, and still cannot tell an empty list from a list holding one empty string. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Join on a comma, and escape any comma already in the data.

```python
def encode(strs):
    esc = [s.replace("\\", "\\\\").replace(",", "\\,") for s in strs]
    return ",".join(esc)

def decode(s):
    out, cur, i = [], "", 0
    while i < len(s):
        if s[i] == "\\":
            cur, i = cur + s[i + 1], i + 2
        elif s[i] == ",":
            out, cur, i = out + [cur], "", i + 1
        else:
            cur, i = cur + s[i], i + 1
    return out + [cur]
```

`O(n)` time, `O(n)` space, and not fully correct.

**Wasteful because.** The encoder knew the length of every string and threw that away, so the decoder has to rediscover each boundary one character at a time, branching on every single character to ask whether it is a separator, an escape, or content. That is the same information being derived twice, and the second derivation is the fragile one: the empty list and `[""]` both encode to the empty string, so one of them can never be recovered.

**Optimal.** Keep the length instead of re-deriving it. Write `len(s)`, then a `#`, then the string itself, so the header is unambiguous no matter what the payload holds: the digits before the first `#` cannot contain a `#`, and everything after it is content of a known size. Decoding is then two moves in a loop, find the next `#` from the cursor to read the length, then slice exactly that many characters and jump the cursor past them. Nothing inside a payload is ever examined, which is why a string like `"4#abc"` costs nothing extra. Both directions touch each character a constant number of times, so both are linear in the total input size.

**Edge cases.** An empty list encodes to the empty string and decodes back to an empty list, while `[""]` encodes to `"0#"`, which is how the two stay distinguishable. Payloads containing `#` and digits, like `"4#abc"`, decode correctly because the decoder never searches inside them. Strings up to 199 characters give three-digit headers, so the header width varies and cannot be assumed.

#### Python

`s.index('#', i)` finds the next delimiter without allocating a sliced view. Building the result with `res.append` and a manual cursor `i` is faster than splitting because there's no ambiguity to resolve.

```python
def encode(strs):
    return "".join(f"{len(s)}#{s}" for s in strs)

def decode(s):
    res, i = [], 0
    while i < len(s):
        j = s.index("#", i)
        length = int(s[i:j])
        res.append(s[j + 1:j + 1 + length])
        i = j + 1 + length
    return res
```

#### Java

Design problem: implement the `Codec` class with `encode`/`decode`. `StringBuilder` avoids quadratic concatenation; on decode, `indexOf('#', i)` finds the delimiter and `substring(start, start + length)` does the bounded slice.

```java
import java.util.*;

class Codec {
    public String encode(List<String> strs) {
        StringBuilder sb = new StringBuilder();
        for (String s : strs) {
            sb.append(s.length()).append('#').append(s);
        }
        return sb.toString();
    }

    public List<String> decode(String s) {
        List<String> res = new ArrayList<>();
        int i = 0;
        while (i < s.length()) {
            int j = s.indexOf('#', i);
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

Working on `s.as_bytes()` for the `#` scan avoids UTF-8 char-boundary checks; the actual content slice goes back through `s[..]` so it returns a `String`. `parse::<usize>` is unwrap-safe because we control the encoding.

```rust
fn encode(strs: Vec<String>) -> String {
    let mut out = String::new();
    for s in &strs {
        out.push_str(&format!("{}#{}", s.len(), s));
    }
    out
}

fn decode(s: String) -> Vec<String> {
    let mut res = Vec::new();
    let b = s.as_bytes();
    let mut i = 0;
    while i < b.len() {
        let hash = b[i..].iter().position(|&c| c == b'#').unwrap() + i;
        let length: usize = s[i..hash].parse().unwrap();
        let start = hash + 1;
        res.push(s[start..start + length].to_string());
        i = start + length;
    }
    res
}
```

#### Go

`strings.Builder` for the encode side avoids quadratic string concatenation. On decode, `strings.Index(s[i:], "#") + i` recovers an absolute index without slicing the whole tail.

```go
import (
    "strconv"
    "strings"
)

func encode(strs []string) string {
    var sb strings.Builder
    for _, s := range strs {
        sb.WriteString(strconv.Itoa(len(s)))
        sb.WriteByte('#')
        sb.WriteString(s)
    }
    return sb.String()
}

func decode(s string) []string {
    res := []string{}
    i := 0
    for i < len(s) {
        j := strings.Index(s[i:], "#") + i
        length, _ := strconv.Atoi(s[i:j])
        res = append(res, s[j+1:j+1+length])
        i = j + 1 + length
    }
    return res
}
```

#### C++

`std::string::find('#', i)` returns the absolute position directly — no offset arithmetic needed. `substr(j + 1, len)` does the bounded copy that `decode` relies on.

```cpp
#include <string>
#include <vector>

std::string encode(std::vector<std::string>& strs) {
    std::string out;
    for (const auto& s : strs) {
        out += std::to_string(s.size()) + '#' + s;
    }
    return out;
}

std::vector<std::string> decode(std::string s) {
    std::vector<std::string> res;
    int i = 0, n = (int)s.size();
    while (i < n) {
        int j = (int)s.find('#', i);
        int len = std::stoi(s.substr(i, j - i));
        res.push_back(s.substr(j + 1, len));
        i = j + 1 + len;
    }
    return res;
}
```


### 12. Product of Array Except Self

#### Problem
Given an integer array `nums`, return an array `output` where `output[i]` equals the product of all elements except `nums[i]`. You may not use division, and the solution must run in `O(n)`.

#### Examples

```text
Input: nums = [1,2,3,4]
Output: [24,12,8,6]

Input: nums = [-1,1,0,-3,3]
Output: [0,0,9,0,0]

Input: nums = [0,0]
Output: [0,0]

Constraints:
- 2 <= nums.length <= 10^5
- -30 <= nums[i] <= 30
- every prefix and suffix product fits in 32 bits
```

#### Recognition
**Signals.** "The product of all elements except `nums[i]`", asked for every `i`, is a range query over everything but one position, and the explicit ban on division removes the one-line shortcut of dividing the total by `nums[i]`. Two more tells: the required `O(n)` forbids recomputing a product per index, and "except self" splits cleanly into everything left of `i` times everything right of `i`. **Therefore.** Two accumulation passes. Sweep left to right writing the running prefix product into `output[i]`, then sweep right to left multiplying in the running suffix product, which needs one scalar and no second array. **Not the division trick**, and not merely because it is banned: one zero in the array makes every other index divide by zero, and two zeros zero the whole answer, so you end up branching on a zero count anyway and the "simple" version stops being simple. Counting the returned array as required output rather than working space, **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** For each index, multiply everything else.

```python
def productExceptSelf(nums):
    res = []
    for i in range(len(nums)):
        p = 1
        for j in range(len(nums)):
            if i != j:
                p *= nums[j]
        res.append(p)
    return res
```

`O(n^2)` time, `O(1)` extra space.

**Wasteful because.** Index `i` and index `i + 1` multiply almost exactly the same numbers. Every element is re-multiplied `n - 1` times, and the running product built for one index is discarded before the next one starts.

**Optimal.** Carry the running product forward instead of rebuilding it. The answer at `i` factorises into the product of everything before `i` times the product of everything after `i`, and each of those is a prefix scan, one from each end. First pass: walk forward with a `prefix` scalar, writing it into `res[i]` before folding `nums[i]` in, so `res[i]` ends up holding the left product. Second pass: walk backward with a `suffix` scalar, multiplying it into `res[i]` before folding `nums[i]` in. Reusing the output array as the prefix buffer is what keeps auxiliary space at `O(1)`. The same shape with `+` in place of `*` is the ordinary prefix sum; the technique needs only an associative operation, and unlike the division trick it never needs the inverse, which is why the ban costs nothing.

**Edge cases.** A single zero produces the product of the rest at that index and zero everywhere else, and this falls out with no branch. Two or more zeros give all zeros. Negative values need nothing special since sign propagates through multiplication.

#### Python

Using the output array as the prefix-product buffer (then multiplying by the running suffix) is the key allocation saver — no separate left/right arrays. `range(len(nums) - 1, -1, -1)` is Python's idiomatic 'walk backwards by index'.

```python
def productExceptSelf(nums):
    res = [1] * len(nums)
    prefix = 1
    for i in range(len(nums)):
        res[i] = prefix
        prefix *= nums[i]
    suffix = 1
    for i in range(len(nums) - 1, -1, -1):
        res[i] *= suffix
        suffix *= nums[i]
    return res
```

#### Java

`new int[n]` zero-inits, so seed nothing — the first prefix pass writes running left-products, then a reverse pass multiplies by the running suffix. Only the output array is allocated; the running vars are `O(1)`.

```java
class Solution {
    public int[] productExceptSelf(int[] nums) {
        int n = nums.length;
        int[] res = new int[n];
        int prefix = 1;
        for (int i = 0; i < n; i++) {
            res[i] = prefix;
            prefix *= nums[i];
        }
        int suffix = 1;
        for (int i = n - 1; i >= 0; i--) {
            res[i] *= suffix;
            suffix *= nums[i];
        }
        return res;
    }
}
```

#### Rust

`vec![1i32; n]` initializes the output to 1 so the prefix pass can just assign. The reverse pass uses `(0..n).rev()` — Rust's clean reverse-range without manual `i -= 1`.

```rust
fn product_except_self(nums: Vec<i32>) -> Vec<i32> {
    let n = nums.len();
    let mut res = vec![1i32; n];
    let mut prefix = 1;
    for i in 0..n {
        res[i] = prefix;
        prefix *= nums[i];
    }
    let mut suffix = 1;
    for i in (0..n).rev() {
        res[i] *= suffix;
        suffix *= nums[i];
    }
    res
}
```

#### Go

Plain indexed loops; no fancy ranges. `make([]int, n)` zero-initializes — actually a minor pitfall here, you must remember the prefix pass writes 1 implicitly because the first iteration sets `res[0] = prefix = 1` before multiplying.

```go
func productExceptSelf(nums []int) []int {
    n := len(nums)
    res := make([]int, n)
    prefix := 1
    for i := 0; i < n; i++ {
        res[i] = prefix
        prefix *= nums[i]
    }
    suffix := 1
    for i := n - 1; i >= 0; i-- {
        res[i] *= suffix
        suffix *= nums[i]
    }
    return res
}
```

#### C++

`std::vector<int> res(n, 1)` is the constructor form that fills with 1 — same role as the Python `[1] * n`. Two indexed loops, no fancy iterators, matches the algorithm shape one-to-one.

```cpp
#include <vector>

std::vector<int> productExceptSelf(std::vector<int>& nums) {
    int n = (int)nums.size();
    std::vector<int> res(n, 1);
    int prefix = 1;
    for (int i = 0; i < n; ++i) {
        res[i] = prefix;
        prefix *= nums[i];
    }
    int suffix = 1;
    for (int i = n - 1; i >= 0; --i) {
        res[i] *= suffix;
        suffix *= nums[i];
    }
    return res;
}
```


### 13. Valid Sudoku

#### Problem
Determine if a 9×9 Sudoku board is valid. Each row, column, and 3×3 sub-box must contain the digits 1–9 with no repetition. Empty cells are marked with `'.'`. The board does not need to be fully solved.

#### Examples

```text
Input: board =
[["5","3",".",".","7",".",".",".","."],
 ["6",".",".","1","9","5",".",".","."],
 [".","9","8",".",".",".",".","6","."],
 ["8",".",".",".","6",".",".",".","3"],
 ["4",".",".","8",".","3",".",".","1"],
 ["7",".",".",".","2",".",".",".","6"],
 [".","6",".",".",".",".","2","8","."],
 [".",".",".","4","1","9",".",".","5"],
 [".",".",".",".","8",".",".","7","9"]]
Output: true
Explanation: no digit repeats in any row, column or box.

Input: board =
[["8",".",".",".",".",".",".",".","."],
 [".","8",".",".",".",".",".",".","."],
 [".",".",".",".",".",".",".",".","."],
 [".",".",".",".",".",".",".",".","."],
 [".",".",".",".",".",".",".",".","."],
 [".",".",".",".",".",".",".",".","."],
 [".",".",".",".",".",".",".",".","."],
 [".",".",".",".",".",".",".",".","."],
 [".",".",".",".",".",".",".",".","."]]
Output: false
Explanation: every row and column is clean, but the two
8s share the top-left 3x3 box.

Constraints:
- board.length == 9 and board[i].length == 9
- board[i][j] is a digit '1'-'9' or the character '.'
- the board may be partly filled and need not be solvable
```

#### Recognition
**Signals.** Two phrases decide it. "No repetition" inside a row, a column or a 3×3 box is duplicate detection, which is a membership question rather than a search. "Does not need to be fully solved" says the check is entirely local: each cell is judged against three fixed regions and nothing else, so there is no lookahead and no completion to find. The board is pinned at 9×9, which turns every bound into a constant. **Therefore.** One scan of the 81 cells carrying 27 membership structures, nine per region type, with the box holding cell `(r, c)` at index `(r // 3) * 3 + c // 3`; a filled cell already present in any of its three regions fails on the spot. **Not backtracking**, the Sudoku Solver algorithm, which answers a different question: solvability means searching an exponential space of completions, whereas validity falls out of a single linear scan, and a board can easily be valid and still have no solution. Fixed 9×9, so **O(1)** time, **O(1)** space.

#### Explanation
**Brute force.** Materialise all 27 regions, then check each one for a repeat.

```python
def isValidSudoku(board):
    groups = [[board[r][c] for c in range(9)] for r in range(9)]
    groups += [[board[r][c] for r in range(9)] for c in range(9)]
    groups += [[board[br + i][bc + j]
                for i in range(3) for j in range(3)]
               for br in (0, 3, 6) for bc in (0, 3, 6)]
    for g in groups:
        digits = [v for v in g if v != "."]
        if len(digits) != len(set(digits)):
            return False
    return True
```

Generalised to an `n × n` board, `O(n^2)` time and `O(n^2)` space.

**Wasteful because.** Every cell is read three times, once into its row list, once into its column list, once into its box list, and 243 characters are copied into 27 lists before a single comparison happens. The one fact a cell contributes, "digit `d` occupies row `r`, column `c`, box `b`", is available the instant you touch it, so building the regions first is pure duplication.

**Optimal.** Fill the membership structures as you scan instead of before. At cell `(r, c)` compute `b = (r // 3) * 3 + c // 3`, which numbers the boxes 0 to 8, left to right then top to bottom, with two integer divisions and no lookup table. Skip `'.'`. If the digit is already in `rows[r]`, `cols[c]` or `boxes[b]`, return false immediately; otherwise insert it into all three. Each cell costs `O(1)` and is touched once, and the early return means a board that breaks at the second cell costs two cells rather than a full rebuild. To shrink the constant further, swap each set for a nine-bit integer and test with `mask & (1 << d)`, which is what the Java, Rust, Go and C++ versions do.

**Edge cases.** A board of all `'.'` is valid, since the skip means nothing is ever inserted. Two equal digits in one box but in different rows and columns must fail, and catching that is the only thing the box index buys you. A valid board with no possible completion still returns true, because solvability is not what was asked.

#### Python

Uses three lists of sets keyed by position — the most readable form. `set` membership is `O(1)` average; with only 9 digits per region the constant factor doesn't matter.

```python
def isValidSudoku(board):
    rows = [set() for _ in range(9)]
    cols = [set() for _ in range(9)]
    boxes = [set() for _ in range(9)]
    for r in range(9):
        for c in range(9):
            v = board[r][c]
            if v == ".":
                continue
            b = (r // 3) * 3 + (c // 3)
            if v in rows[r] or v in cols[c] or v in boxes[b]:
                return False
            rows[r].add(v)
            cols[c].add(v)
            boxes[b].add(v)
    return True
```

#### Java

Bitmask trick: a single `short`/`int` per region holds the seen-digit bits, so `1 << (c - '1')` encodes a digit, `&` checks and `|=` inserts — faster and lighter than nine `HashSet`s. Three `int[9]` arrays cover rows, cols, and boxes.

```java
class Solution {
    public boolean isValidSudoku(char[][] board) {
        int[] rows = new int[9];
        int[] cols = new int[9];
        int[] boxes = new int[9];
        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                char ch = board[r][c];
                if (ch == '.') continue;
                int bit = 1 << (ch - '1');
                int b = (r / 3) * 3 + c / 3;
                if ((rows[r] & bit) != 0 || (cols[c] & bit) != 0 || (boxes[b] & bit) != 0) {
                    return false;
                }
                rows[r] |= bit;
                cols[c] |= bit;
                boxes[b] |= bit;
            }
        }
        return true;
    }
}
```

#### Rust

Bitmask trick: `u16` is plenty for 9 digits, so `1u16 << (ch as u8 - b'1')` encodes the digit as a bit. `rows[r] & bit != 0` is the check, `|=` is the insert — faster than `HashSet` and cache-friendlier.

```rust
fn is_valid_sudoku(board: Vec<Vec<char>>) -> bool {
    let mut rows  = vec![0u16; 9];
    let mut cols  = vec![0u16; 9];
    let mut boxes = vec![0u16; 9];
    for r in 0..9 {
        for c in 0..9 {
            let ch = board[r][c];
            if ch == '.' { continue; }
            let bit = 1u16 << (ch as u8 - b'1');
            let b = (r / 3) * 3 + c / 3;
            if rows[r] & bit != 0 || cols[c] & bit != 0 || boxes[b] & bit != 0 {
                return false;
            }
            rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        }
    }
    true
}
```

#### Go

Same bitmask approach as Rust with `[9]uint16` arrays (stack-allocated, no `make`). Multiple statements on one line (`rows[r] |= bit; cols[c] |= bit; ...`) is idiomatic when the operations are parallel.

```go
func isValidSudoku(board [][]byte) bool {
    var rows, cols, boxes [9]uint16
    for r := 0; r < 9; r++ {
        for c := 0; c < 9; c++ {
            v := board[r][c]
            if v == '.' { continue }
            bit := uint16(1) << (v - '1')
            b := (r/3)*3 + c/3
            if rows[r]&bit != 0 || cols[c]&bit != 0 || boxes[b]&bit != 0 {
                return false
            }
            rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit
        }
    }
    return true
}
```

#### C++

`std::array<uint16_t, 9>{}` value-initializes the three bitmask vectors on the stack. The same bit-trick as Rust/Go — the C++ version reads almost identically because the operations are pure bit-twiddling, language-agnostic at that level.

```cpp
#include <vector>
#include <array>

bool isValidSudoku(std::vector<std::vector<char>>& board) {
    std::array<uint16_t, 9> rows{}, cols{}, boxes{};
    for (int r = 0; r < 9; ++r) {
        for (int c = 0; c < 9; ++c) {
            if (board[r][c] == '.') continue;
            uint16_t bit = 1u << (board[r][c] - '1');
            int b = (r / 3) * 3 + c / 3;
            if (rows[r] & bit || cols[c] & bit || boxes[b] & bit) return false;
            rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        }
    }
    return true;
}
```


### 14. Longest Consecutive Sequence

#### Problem
Given an unsorted integer array `nums`, return the length of the longest sequence of consecutive integers. The solution must run in `O(n)`.

#### Examples

```text
Input: nums = [100,4,200,1,3,2]
Output: 4
Explanation: the run is 1,2,3,4.

Input: nums = [0,3,7,2,5,8,4,6,0,1]
Output: 9

Input: nums = []
Output: 0

Constraints:
- 0 <= nums.length <= 10^5
- -10^9 <= nums[i] <= 10^9
- must run in O(n) time
```

#### Recognition
**Signals.** "Longest sequence of consecutive integers" over an **unsorted** array, plus an explicit `O(n)` requirement. That requirement is the tell and it is the whole problem: consecutiveness is trivially found by sorting and scanning, so stating a linear bound is the statement telling you sorting is off the table and that adjacency has to come from lookups instead. "Consecutive" also fixes the only question you ever ask about a value, which is whether `n - 1` or `n + 1` exists, and that is membership. **Therefore.** Load every value into a hash set, then start a walk only at values `n` whose predecessor `n - 1` is absent, since only those begin a run, and extend while `n + 1`, `n + 2` and so on are present. **Not sort and scan**, which is correct, shorter and needs no extra structure, but is `O(n log n)` and so is exactly what the stated bound forbids. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Sort, then scan for the longest run.

```python
def longestConsecutive(nums):
    if not nums:
        return 0
    s = sorted(set(nums))
    best, length = 1, 1
    for i in range(1, len(s)):
        if s[i] == s[i - 1] + 1:
            length += 1
            best = max(best, length)
        else:
            length = 1
    return best
```

`O(n log n)` time, `O(n)` space.

**Wasteful because.** Sorting establishes a total order over all `n` values when the algorithm only ever asks whether one specific neighbour exists. Full ordering is far more information than the question needs, and the `log n` factor is the price of computing it.

**Optimal.** Trade order for membership. A hash set answers "is `n + 1` present?" in `O(1)`, so runs can be walked directly with no ordering at all. The trap is that walking from every value is `O(n^2)` on input `[1, 2, ..., n]`, because the run starting at 1 gets re-walked from 2, then from 3, and so on. The guard fixes it: walk from `n` only when `n - 1` is absent, so each run is walked exactly once, from its own start. Total work is one membership check per value to test whether it is a start, plus one step per value summed across all walks, so `2n` probes and `O(n)` overall. The set also deduplicates, so repeats cost nothing. Sorting is still the better answer when the input arrives sorted or when `O(1)` extra space is mandated.

**Edge cases.** An empty array returns 0, so the running best must start at 0 rather than 1. Duplicates collapse into the set and cannot lengthen a run. A lone value is a run of length 1, found because its predecessor is absent.

#### Python

`set(nums)` deduplicates and gives `O(1)` lookups in one shot. The `n - 1 not in s` guard is what makes this `O(n)` instead of `O(n²)` — only sequence starts trigger the inner walk.

```python
def longestConsecutive(nums):
    s = set(nums)
    best = 0
    for n in s:
        if n - 1 not in s:
            length = 1
            while n + length in s:
                length += 1
            best = max(best, length)
    return best
```

#### Java

Dump `nums` into a `HashSet` for `O(1)` lookups (also dedups). The `!set.contains(n - 1)` guard restricts the inner walk to sequence starts, keeping it `O(n)` overall.

```java
import java.util.*;

class Solution {
    public int longestConsecutive(int[] nums) {
        Set<Integer> set = new HashSet<>();
        for (int n : nums) set.add(n);
        int best = 0;
        for (int n : set) {
            if (!set.contains(n - 1)) {
                int length = 1;
                while (set.contains(n + length)) length++;
                best = Math.max(best, length);
            }
        }
        return best;
    }
}
```

#### Rust

`nums.into_iter().collect::<HashSet<_>>()` consumes and dedups in one expression. The walk uses `&(n + length)` for the `contains` call because `HashSet<i32>::contains` takes `&i32`.

```rust
use std::collections::HashSet;

fn longest_consecutive(nums: Vec<i32>) -> i32 {
    let s: HashSet<i32> = nums.into_iter().collect();
    let mut best = 0;
    for &n in &s {
        if !s.contains(&(n - 1)) {
            let mut length = 1;
            while s.contains(&(n + length)) { length += 1; }
            best = best.max(length);
        }
    }
    best
}
```

#### Go

`map[int]bool` is the standard set substitute — slightly nicer than `map[int]struct{}` here because `s[n-1]` returns `false` for missing keys, avoiding the comma-ok dance.

```go
func longestConsecutive(nums []int) int {
    s := make(map[int]bool)
    for _, n := range nums { s[n] = true }
    best := 0
    for n := range s {
        if !s[n-1] {
            length := 1
            for s[n+length] { length++ }
            if length > best { best = length }
        }
    }
    return best
}
```

#### C++

`unordered_set<int> s(nums.begin(), nums.end())` constructs the dedup'd set in one call. `s.count(n - 1)` is the idiomatic 'is this in the set' check — `contains` exists in C++20 but `count` is portable.

```cpp
#include <vector>
#include <unordered_set>
#include <algorithm>

int longestConsecutive(std::vector<int>& nums) {
    std::unordered_set<int> s(nums.begin(), nums.end());
    int best = 0;
    for (int n : s) {
        if (!s.count(n - 1)) {
            int length = 1;
            while (s.count(n + length)) ++length;
            best = std::max(best, length);
        }
    }
    return best;
}
```


### 15. Valid Palindrome

#### Problem
A phrase is a palindrome if, after converting all uppercase letters to lowercase and removing all non-alphanumeric characters, it reads the same forward and backward. Given a string `s`, return `true` if it is a palindrome.

#### Examples

```text
Input: s = "A man, a plan, a canal: Panama"
Output: true
Explanation: cleaned it is "amanaplanacanalpanama".

Input: s = "race a car"
Output: false

Input: s = " "
Output: true

Constraints:
- 1 <= s.length <= 2 * 10^5
- s contains printable ASCII only
```

#### Recognition
**Signals.** "Reads the same forward and backward" is symmetry about a centre, and the only comparison that ever matters is first remaining character against last remaining character. That is a converging pair, so the working state is two indices, not a copy. The filtering clause, "ignoring case and non-alphanumeric characters", does not change the shape at all; it only means each pointer may have to step several times before it lands on something comparable. **Therefore.** A left index at 0 and a right index at `n - 1`, each skipping past non-alphanumeric characters, then compare lowercased and step both inward, returning false on the first mismatch. **Not building a cleaned copy** and testing it against its reverse, which is correct, shorter and the answer most people give, but costs `O(n)` extra space; on a 200000-character input that is a second buffer bought for nothing. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Filter into a clean string, then compare it with its reverse.

```python
def isPalindrome(s):
    clean = []
    for c in s:
        if c.isalnum():
            clean.append(c.lower())
    clean = "".join(clean)
    return clean == clean[::-1]
```

`O(n)` time, `O(n)` space.

**Wasteful because.** The repeated work here is not time, it is allocation. Every kept character is copied into a second buffer and the reversal builds a third, purely to line up characters that were already addressable by index in the original string.

**Optimal.** Compare in place. Put `l` at 0 and `r` at the last index and walk them toward each other. Before each comparison, advance `l` past anything non-alphanumeric and retreat `r` the same way, guarding both inner loops with `l < r` so a string of pure punctuation cannot run either pointer off its end. Then compare `s[l]` against `s[r]` lowercased, return false on any mismatch, and step both inward. Each character is examined at most once and by exactly one pointer, so it is still a single linear pass, but nothing is allocated. The cleaned-copy version wins when the same string is queried repeatedly, since the filter is then paid once instead of the skips being redone per query.

**Edge cases.** A string with no alphanumeric characters at all, such as `" "` or `",."`, is a palindrome; the `l < r` guards return true without ever running a comparison. An odd number of kept characters leaves a middle one that is never compared against anything, which is correct. Digits count as alphanumeric, so `"0P"` is false.

#### Python

`str.isalnum()` and `str.lower()` work on single characters — concise and Unicode-aware (LeetCode tests are ASCII, but the code generalizes). The dual inner `while` loops cleanly separate skip-and-compare.

```python
def isPalindrome(s):
    l, r = 0, len(s) - 1
    while l < r:
        while l < r and not s[l].isalnum(): l += 1
        while l < r and not s[r].isalnum(): r -= 1
        if s[l].lower() != s[r].lower(): return False
        l += 1
        r -= 1
    return True
```

#### Java

`Character.isLetterOrDigit` and `Character.toLowerCase` mirror Python's `isalnum`/`lower` and generalize past ASCII. Two pointers skip non-alphanumerics from each end, then compare case-insensitively — no filtered copy, so `O(1)` extra space.

```java
class Solution {
    public boolean isPalindrome(String s) {
        int l = 0, r = s.length() - 1;
        while (l < r) {
            while (l < r && !Character.isLetterOrDigit(s.charAt(l))) l++;
            while (l < r && !Character.isLetterOrDigit(s.charAt(r))) r--;
            if (Character.toLowerCase(s.charAt(l)) != Character.toLowerCase(s.charAt(r))) {
                return false;
            }
            l++;
            r--;
        }
        return true;
    }
}
```

#### Rust

Pre-filter into `Vec<u8>` of lowercase alphanumerics, then do a trivial two-pointer compare — trades `O(1)` extra space for clarity. `saturating_sub(1)` handles the empty-after-filter case without panicking on `0 - 1` for `usize`.

```rust
fn is_palindrome(s: String) -> bool {
    let chars: Vec<u8> = s.bytes()
        .filter(|b| b.is_ascii_alphanumeric())
        .map(|b| b.to_ascii_lowercase())
        .collect();
    let (mut l, mut r) = (0, chars.len().saturating_sub(1));
    while l < r {
        if chars[l] != chars[r] { return false; }
        l += 1; r -= 1;
    }
    true
}
```

#### Go

No `unicode.IsLetter`/`unicode.ToLower` here — raw byte comparisons with hand-rolled `isAlnum` and `toLower` closures, which avoid the rune-conversion overhead on ASCII inputs. The `+ 32` trick is the bit-level case shift.

```go
func isPalindrome(s string) bool {
    l, r := 0, len(s)-1
    isAlnum := func(b byte) bool {
        return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9')
    }
    toLower := func(b byte) byte {
        if b >= 'A' && b <= 'Z' { return b + 32 }
        return b
    }
    for l < r {
        for l < r && !isAlnum(s[l]) { l++ }
        for l < r && !isAlnum(s[r]) { r-- }
        if toLower(s[l]) != toLower(s[r]) { return false }
        l++; r--
    }
    return true
}
```

#### C++

`std::isalnum` and `std::tolower` take `int`, so casting through `unsigned char` is required to avoid undefined behavior on signed `char` values with the high bit set. Two-pointer skip is mechanical from there.

```cpp
#include <string>
#include <cctype>

bool isPalindrome(std::string s) {
    int l = 0, r = (int)s.size() - 1;
    while (l < r) {
        while (l < r && !std::isalnum((unsigned char)s[l])) ++l;
        while (l < r && !std::isalnum((unsigned char)s[r])) --r;
        if (std::tolower((unsigned char)s[l]) != std::tolower((unsigned char)s[r])) return false;
        ++l; --r;
    }
    return true;
}
```


### 16. Two Sum II

#### Problem
Given a 1-indexed sorted array `numbers` and a target, return the 1-indexed positions of the two numbers that sum to the target. Use only `O(1)` extra space; exactly one solution is guaranteed.

#### Examples

```text
Input: numbers = [2,7,11,15], target = 9
Output: [1,2]
Explanation: 2 + 7 == 9, returned 1-indexed.

Input: numbers = [-1,0], target = -1
Output: [1,2]

Input: numbers = [1,1,3], target = 2
Output: [1,2]

Constraints:
- 2 <= numbers.length <= 3 * 10^4
- -1000 <= numbers[i] <= 1000
- numbers is sorted in non-decreasing order
- exactly one solution exists; use O(1) extra space
```

#### Recognition
**Signals.** Two phrases carry the whole problem. The array is "sorted in non-decreasing order", so the sum of a pair moves monotonically with each index, and one comparison at the two ends is enough to prove which end cannot appear in any answer. The solution must "use only constant extra space", which deletes the obvious alternative before you write it. "Exactly one solution" removes the not-found branch, and the 1-indexed return is a formatting trap rather than an algorithmic one. **Therefore.** Put `l` at the first index and `r` at the last and compare `numbers[l] + numbers[r]` against the target: too small raises `l`, too large lowers `r`, equal returns `[l + 1, r + 1]`. **Not the Two Sum hashmap** of LeetCode 1, which matches the `O(n)` time but stores up to `n` values, precisely the space this variant forbids; sortedness is what makes that memory redundant. **Not a binary search for each complement**, which honours the space bound but pays `O(n log n)`. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Try every pair and ignore the fact that the input is sorted.

```python
def twoSum(numbers, target):
    n = len(numbers)
    for i in range(n):
        for j in range(i + 1, n):
            if numbers[i] + numbers[j] == target:
                return [i + 1, j + 1]
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** The inner loop keeps going after the sum has overshot. Once `numbers[i] + numbers[j] > target`, every larger `j` overshoots too, because the values only climb, yet the scan re-derives that from scratch for each `i`. Sortedness is the one gift the problem hands you and this ignores it.

**Optimal.** Converge from the ends and prove each discard. Suppose `numbers[l] + numbers[r] > target`. For any `l'` with `l <= l' < r` we have `numbers[l'] >= numbers[l]`, so `numbers[l'] + numbers[r] > target` as well: no surviving pair can use `r`, and dropping it loses nothing. The mirror argument applies when the sum is short, since every `r'` at or below `r` gives `numbers[l] + numbers[r'] < target`, so `l` is the index to drop. Each iteration eliminates exactly one index permanently, so the pointers meet within `n - 1` steps and no candidate pair is ever skipped. The hashmap version becomes the right answer the moment the input stops arriving sorted, because sorting purely to enable this scan costs `O(n log n)`.

**Edge cases.** Exactly one answer is guaranteed, so the loop always leaves through the equality branch and no fallback return is reachable. The output is 1-indexed, so add one to both pointers. Negative values need no special handling: `[-1,0]` with target `-1` returns `[1,2]`. Repeated values such as `[1,1,3]` with target `2` work because `l < r` keeps the two pointers on distinct positions.

#### Python

Returns 1-indexed positions per the problem's quirk — easy to forget. The `while l < r` invariant with three branches (equal / less / greater) is the canonical two-pointer skeleton.

```python
def twoSum(numbers, target):
    l, r = 0, len(numbers) - 1
    while l < r:
        s = numbers[l] + numbers[r]
        if s == target:
            return [l + 1, r + 1]
        elif s < target:
            l += 1
        else:
            r -= 1
```

#### Java

No import needed — pure `int[]` and primitives. The three-branch `while (l < r)` skeleton is identical to the other languages; return the freshly built `new int[]{l + 1, r + 1}` to honor the 1-indexed contract.

```java
class Solution {
    public int[] twoSum(int[] numbers, int target) {
        int l = 0, r = numbers.length - 1;
        while (l < r) {
            int s = numbers[l] + numbers[r];
            if (s == target) return new int[]{l + 1, r + 1};
            else if (s < target) l++;
            else r--;
        }
        return new int[0];
    }
}
```

#### Rust

`loop { ... return ... }` instead of `while l < r` because the problem guarantees a solution — no fallthrough return needed. The `as i32` casts only happen on the return shape.

```rust
fn two_sum(numbers: Vec<i32>, target: i32) -> Vec<i32> {
    let (mut l, mut r) = (0usize, numbers.len() - 1);
    loop {
        let s = numbers[l] + numbers[r];
        if s == target { return vec![(l + 1) as i32, (r + 1) as i32]; }
        else if s < target { l += 1; }
        else { r -= 1; }
    }
}
```

#### Go

Same two-pointer shape, but a trailing `return nil` for the unreachable case keeps the compiler happy without forcing a `loop` construct (Go doesn't have one).

```go
func twoSum(numbers []int, target int) []int {
    l, r := 0, len(numbers)-1
    for l < r {
        s := numbers[l] + numbers[r]
        if s == target { return []int{l + 1, r + 1} }
        if s < target { l++ } else { r-- }
    }
    return nil
}
```

#### C++

Return braces `{l + 1, r + 1}` are the simplest way to construct the result vector inline. `(int)numbers.size() - 1` cast keeps `r` signed in case the array is empty.

```cpp
#include <vector>

std::vector<int> twoSum(std::vector<int>& numbers, int target) {
    int l = 0, r = (int)numbers.size() - 1;
    while (l < r) {
        int s = numbers[l] + numbers[r];
        if (s == target) return {l + 1, r + 1};
        else if (s < target) ++l;
        else --r;
    }
    return {};
}
```


### 17. 3Sum

#### Problem
Given an integer array `nums`, return all unique triplets `[a, b, c]` such that `a + b + c == 0`. The solution set must not contain duplicate triplets.

#### Examples

```text
Compare: any-order-nested

Input: nums = [-1,0,1,2,-1,-4]
Output: [[-1,-1,2],[-1,0,1]]
Explanation: those are the only two distinct triplets.

Input: nums = [0,1,1]
Output: []

Input: nums = [0,0,0]
Output: [[0,0,0]]

Constraints:
- 3 <= nums.length <= 3000
- -10^5 <= nums[i] <= 10^5
- triplets are unique as multisets of values
```

#### Recognition
**Signals.** "All unique triplets" that "sum to zero", and the answer is a set of *values*, not indices. Values rather than indices is the permission slip: you are free to sort, and sorting is what turns a search into a scan. `nums.length <= 3000` puts `O(n²)` comfortably in budget and `O(n³)` out of it. "Must not contain duplicate triplets" is a second, separate problem hiding in the statement. **Therefore.** Sort, fix the first element, and converge two pointers over the suffix, skipping equal neighbours at both levels. **Not the Two Sum hashmap** applied to each suffix, which also reaches `O(n²)` but produces triplets in arbitrary internal order, so every hit must be normalised and pushed through a hashset to dedupe; after sorting, duplicates are adjacent and the skip is one comparison. Excluding the output list, **O(n²)** time, **O(1)** space.

#### Explanation
**Brute force.** Try every triple, dedupe with a set.

```python
def threeSum(nums):
    found = set()
    n = len(nums)
    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                if nums[i] + nums[j] + nums[k] == 0:
                    t = (nums[i], nums[j], nums[k])
                    found.add(tuple(sorted(t)))
    return [list(t) for t in found]
```

`O(n³)` time, `O(n)` space for the set.

**Wasteful because.** For each fixed pair `(i, j)` the innermost loop scans the whole remaining suffix to answer one question: does the value `-(nums[i] + nums[j])` appear later? That is a lookup, re-answered by linear search `O(n²)` times.

**Optimal.** Sort first, at `O(n log n)`, which disappears against `O(n²)` and is allowed because the output is values. Now fix `i` and run `l = i + 1`, `r = n - 1` inwards. Sortedness makes the sum monotone in each pointer, so a sum below zero can only be repaired by raising `l` and a sum above zero only by lowering `r`; no pair is ever skipped, and each suffix costs one linear pass. Sorting also dissolves the deduplication problem: equal values are adjacent, so `continue` when `nums[i] == nums[i-1]` kills repeated outer elements and advancing `l` past equal values after a hit kills repeated inner ones. No hashset, no normalising.

**Edge cases.** All zeros must yield `[[0,0,0]]` exactly once, which is what both skips buy you. Input with no valid triplet returns an empty list, not null. `[-1,-1,-1,2]` must emit `[-1,-1,2]` once even though two distinct index pairs produce it. Arrays shorter than three never enter the inner loop.

#### Python

In-place `nums.sort()` is the cheapest way to enable the two-pointer scan. The duplicate-skip on `nums[l] == nums[l-1]` after a hit avoids the hashset that a naive dedup would need.

```python
def threeSum(nums):
    nums.sort()
    res = []
    for i, n in enumerate(nums):
        if i > 0 and n == nums[i - 1]:
            continue
        l, r = i + 1, len(nums) - 1
        while l < r:
            s = n + nums[l] + nums[r]
            if s == 0:
                res.append([n, nums[l], nums[r]])
                l += 1
                while l < r and nums[l] == nums[l - 1]: l += 1
            elif s < 0:
                l += 1
            else:
                r -= 1
    return res
```

#### Java

`Arrays.sort(int[])` is a dual-pivot quicksort that sorts in place, enabling the two-pointer scan. `Arrays.asList(a, b, c)` builds the inner triplet directly into the `List<List<Integer>>` result.

```java
import java.util.*;

class Solution {
    public List<List<Integer>> threeSum(int[] nums) {
        Arrays.sort(nums);
        List<List<Integer>> res = new ArrayList<>();
        int n = nums.length;
        for (int i = 0; i < n - 2; i++) {
            if (i > 0 && nums[i] == nums[i - 1]) continue;
            int l = i + 1, r = n - 1;
            while (l < r) {
                int s = nums[i] + nums[l] + nums[r];
                if (s == 0) {
                    res.add(Arrays.asList(nums[i], nums[l], nums[r]));
                    l++;
                    while (l < r && nums[l] == nums[l - 1]) l++;
                } else if (s < 0) l++;
                else r--;
            }
        }
        return res;
    }
}
```

#### Rust

`sort_unstable` is faster than `sort` since stability is irrelevant for sums. `n.saturating_sub(2)` makes the outer range safe when `n < 2` (would underflow `usize` otherwise).

```rust
fn three_sum(mut nums: Vec<i32>) -> Vec<Vec<i32>> {
    nums.sort_unstable();
    let n = nums.len();
    let mut res = Vec::new();
    for i in 0..n.saturating_sub(2) {
        if i > 0 && nums[i] == nums[i - 1] { continue; }
        let (mut l, mut r) = (i + 1, n - 1);
        while l < r {
            let s = nums[i] + nums[l] + nums[r];
            if s == 0 {
                res.push(vec![nums[i], nums[l], nums[r]]);
                l += 1;
                while l < r && nums[l] == nums[l - 1] { l += 1; }
            } else if s < 0 { l += 1; } else { r -= 1; }
        }
    }
    res
}
```

#### Go

`sort.Ints` is the type-specific sort; modern code would use `slices.Sort`. The triple-nested duplicate-skip pattern (outer + inner-after-hit) is exactly the same as the Python/Rust forms.

```go
import "sort"

func threeSum(nums []int) [][]int {
    sort.Ints(nums)
    res := [][]int{}
    n := len(nums)
    for i := 0; i < n-2; i++ {
        if i > 0 && nums[i] == nums[i-1] { continue }
        l, r := i+1, n-1
        for l < r {
            s := nums[i] + nums[l] + nums[r]
            if s == 0 {
                res = append(res, []int{nums[i], nums[l], nums[r]})
                l++
                for l < r && nums[l] == nums[l-1] { l++ }
            } else if s < 0 { l++ } else { r-- }
        }
    }
    return res
}
```

#### C++

`std::sort` over the input range is in-place. `res.push_back({nums[i], nums[l], nums[r]})` uses brace-init to build the inner vector inline — saves the temp.

```cpp
#include <vector>
#include <algorithm>

std::vector<std::vector<int>> threeSum(std::vector<int>& nums) {
    std::sort(nums.begin(), nums.end());
    std::vector<std::vector<int>> res;
    int n = (int)nums.size();
    for (int i = 0; i < n - 2; ++i) {
        if (i > 0 && nums[i] == nums[i - 1]) continue;
        int l = i + 1, r = n - 1;
        while (l < r) {
            int s = nums[i] + nums[l] + nums[r];
            if (s == 0) {
                res.push_back({nums[i], nums[l], nums[r]});
                ++l;
                while (l < r && nums[l] == nums[l - 1]) ++l;
            } else if (s < 0) { ++l; } else { --r; }
        }
    }
    return res;
}
```


### 18. Container With Most Water

#### Problem
Given an array `height` of `n` non-negative integers where each represents a vertical line at position `i`, find two lines that together with the x-axis form a container that holds the most water. Return the maximum water volume.

#### Examples

```text
Input: height = [1,8,6,2,5,4,8,3,7]
Output: 49
Explanation: indices 1 and 8 give min(8,7) * 7 == 49.

Input: height = [1,1]
Output: 1

Input: height = [4,3,2,1,4]
Output: 16

Constraints:
- 2 <= height.length <= 10^5
- 0 <= height[i] <= 10^4
- the lines between the two chosen ones are ignored
```

#### Recognition
**Signals.** The score of a candidate is handed to you in the statement: `min(height[l], height[r]) * (r - l)`, a function of two positions where everything between them is irrelevant. The objective is a maximum over pairs, and `height.length <= 10^5` puts an all-pairs scan out of budget. The two factors pull against each other: width is largest at the extremes and only shrinks as you move inward, while height is capped by whichever of the two lines is shorter. That cap is the structure to exploit, because the shorter line is always the binding constraint. **Therefore.** Start at the widest pair, record its area, then discard whichever side is shorter and repeat until the pointers meet. **Not the monotonic stack** you would reach for on Trapping Rain Water, which draws the same picture but solves a different shape: there water sits above every index and interior bars displace it, so each position needs its bounding maxima. Here the container is exactly two lines, the interior is ignored, and one converging sweep suffices. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Score every pair of lines.

```python
def maxArea(height):
    res = 0
    n = len(height)
    for i in range(n):
        for j in range(i + 1, n):
            area = min(height[i], height[j]) * (j - i)
            if area > res:
                res = area
    return res
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** Most of those pairs are already beaten before they are measured. Holding `i` fixed and walking `j` inward evaluates containers that are simultaneously narrower than one already scored and no taller than it, so their area cannot win, and the loop has no way to notice.

**Optimal.** Put `l` at 0 and `r` at the last index, the widest container available, and measure it. Now suppose `height[l] <= height[r]`. Every other pair still using `l` is some `(l, j)` with `j < r`, so its width `j - l` is strictly smaller and its height `min(height[l], height[j])` is at most `height[l]`, which is exactly the height just used. Every such pair is therefore no better than the area already recorded, so `l` can be dropped with nothing lost, and the mirrored argument drops `r` when `height[r] < height[l]`. Moving the taller side instead is unsound: it throws away an index that may still belong to the optimum, and it cannot pay off in any case, because the height stays pinned by the shorter line while the width only shrinks. One index leaves per step, so `n - 1` steps cover every pair worth considering.

**Edge cases.** With exactly two lines the single pair is measured before the loop can move either pointer. Heights of 0 produce an area of 0 and are stepped over with no special case. When the two heights tie, the argument above dominates both indices, so discarding either is safe and the code's `else` branch simply picks one. All-equal heights such as `[3,3,3]` are answered by the first measurement, since the widest pair wins.

#### Python

Inline `min(height[l], height[r]) * (r - l)` is the natural expression of the area formula. The 'move the shorter side' rule lives in a single `if/else` — no need to track which side moved.

```python
def maxArea(height):
    l, r = 0, len(height) - 1
    res = 0
    while l < r:
        res = max(res, min(height[l], height[r]) * (r - l))
        if height[l] < height[r]:
            l += 1
        else:
            r -= 1
    return res
```

#### Java

`Math.max`/`Math.min` on primitives compile to branchless intrinsics — no boxing. The move-the-shorter-side rule is a single `if/else`, no need to track which pointer moved.

```java
class Solution {
    public int maxArea(int[] height) {
        int l = 0, r = height.length - 1, res = 0;
        while (l < r) {
            res = Math.max(res, Math.min(height[l], height[r]) * (r - l));
            if (height[l] < height[r]) l++;
            else r--;
        }
        return res;
    }
}
```

#### Rust

`height[l].min(height[r]) * (r - l) as i32` uses methods on `i32`, no `std::cmp::min` import. Note the precedence: `(r - l) as i32` casts the width, not the product.

```rust
fn max_area(height: Vec<i32>) -> i32 {
    let (mut l, mut r) = (0usize, height.len() - 1);
    let mut res = 0;
    while l < r {
        res = res.max(height[l].min(height[r]) * (r - l) as i32);
        if height[l] < height[r] { l += 1; } else { r -= 1; }
    }
    res
}
```

#### Go

Pre-1.21 Go forces the inline `min` helper at the bottom. Splitting the area calc onto its own line is a minor stylistic call — could also be a single `if`.

```go
func maxArea(height []int) int {
    l, r := 0, len(height)-1
    res := 0
    for l < r {
        area := min(height[l], height[r]) * (r - l)
        if area > res { res = area }
        if height[l] < height[r] { l++ } else { r-- }
    }
    return res
}

func min(a, b int) int {
    if a < b { return a }
    return b
}
```

#### C++

`std::max`/`std::min` keep the loop body readable; everything else is the same two-pointer shape.

```cpp
#include <vector>
#include <algorithm>

int maxArea(std::vector<int>& height) {
    int l = 0, r = (int)height.size() - 1, res = 0;
    while (l < r) {
        res = std::max(res, std::min(height[l], height[r]) * (r - l));
        if (height[l] < height[r]) ++l; else --r;
    }
    return res;
}
```


### 19. Trapping Rain Water

#### Problem
Given an array `height` representing an elevation map where the width of each bar is 1, compute how much water can be trapped after raining.

#### Examples

```text
Input: height = [0,1,0,2,1,0,1,3,2,1,2,1]
Output: 6
Explanation: 6 units settle in the dips between bars.

Input: height = [4,2,0,3,2,5]
Output: 9

Input: height = [3,3]
Output: 0

Constraints:
- 1 <= height.length <= 2 * 10^4
- 0 <= height[i] <= 10^5
```

#### Recognition
**Signals.** "Trapped after raining" means water at index `i` is held in place by a taller bar on *each* side, so the amount is `min(maxLeft, maxRight) - height[i]`. An answer that depends on one boundary from the left and one from the right is the converging-pointer shape. Bar width is fixed at 1, so the total is a plain sum over indices with no geometry. **Therefore.** Two pointers carrying a running maximum each; the side with the smaller maximum is provably the limiting one, so its water is already determined and that pointer can step inwards. **Not prefix and suffix maximum arrays**, the answer most people give: also `O(n)` time, but it materialises two length-`n` arrays holding information each index consumes exactly once, and the two scalars carry the same thing. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** For each bar, scan both directions for the tallest bar on each side.

```python
def trap(height):
    total = 0
    for i in range(len(height)):
        left = max(height[: i + 1])
        right = max(height[i:])
        total += min(left, right) - height[i]
    return total
```

`O(n²)` time, `O(1)` space.

**Wasteful because.** Both maxima are recomputed from scratch at every index, and the scan at `i` overlaps almost entirely with the scan at `i - 1`. A running maximum changes at most once per step, so the rescan reproduces a value it already had.

**Optimal.** Carry `maxL` and `maxR` as scalars and step inwards from whichever side is smaller. If `maxL <= maxR` then whatever lies to the right of the left pointer, the right bound is at least `maxR >= maxL`, so `min(maxL, maxR)` at the left pointer equals `maxL` no matter what has not been seen yet. That is the key: you never need the true right maximum, only the guarantee that it is not the binding constraint. Add `maxL - height[l]` and advance. The prefix and suffix arrays are the better answer when you need the per-index water depths themselves, or must answer repeated queries on the same profile, since the pointers throw those intermediate values away.

**Edge cases.** A single bar, or a monotone array in either direction, traps nothing. A flat array contributes `maxL - height[l] == 0` at every step. The empty array is excluded by the constraints, which matters because the code reads `height[0]` and `height[n-1]` before the loop. Interior zeros are the ordinary case and need no guard.

#### Python

`max` calls dominate the readability; everything else is mechanical. The `if maxL <= maxR` branch is the heart of why this is `O(1)` space.

```python
def trap(height):
    l, r = 0, len(height) - 1
    maxL, maxR = height[l], height[r]
    res = 0
    while l < r:
        if maxL <= maxR:
            l += 1
            maxL = max(maxL, height[l])
            res += maxL - height[l]
        else:
            r -= 1
            maxR = max(maxR, height[r])
            res += maxR - height[r]
    return res
```

#### Java

`Math.max` keeps the running-max update readable; everything else is primitive arithmetic. The `maxL <= maxR` branch is what makes this `O(1)` space rather than the prefix/suffix-array version.

```java
class Solution {
    public int trap(int[] height) {
        int l = 0, r = height.length - 1;
        int maxL = height[l], maxR = height[r], res = 0;
        while (l < r) {
            if (maxL <= maxR) {
                l++;
                maxL = Math.max(maxL, height[l]);
                res += maxL - height[l];
            } else {
                r--;
                maxR = Math.max(maxR, height[r]);
                res += maxR - height[r];
            }
        }
        return res;
    }
}
```

#### Rust

Method-form `max_l.max(height[l])` reads left-to-right. The variable names with underscores (`max_l`, `max_r`) match Rust convention vs. the camelCase in other languages.

```rust
fn trap(height: Vec<i32>) -> i32 {
    let (mut l, mut r) = (0usize, height.len() - 1);
    let (mut max_l, mut max_r) = (height[l], height[r]);
    let mut res = 0;
    while l < r {
        if max_l <= max_r {
            l += 1;
            max_l = max_l.max(height[l]);
            res += max_l - height[l];
        } else {
            r -= 1;
            max_r = max_r.max(height[r]);
            res += max_r - height[r];
        }
    }
    res
}
```

#### Go

Explicit `if height[l] > maxL` instead of a `max` call — pre-1.21 Go has no builtin. The two-pointer + running max idiom translates literally from the Python form.

```go
func trap(height []int) int {
    l, r := 0, len(height)-1
    maxL, maxR := height[l], height[r]
    res := 0
    for l < r {
        if maxL <= maxR {
            l++
            if height[l] > maxL { maxL = height[l] }
            res += maxL - height[l]
        } else {
            r--
            if height[r] > maxR { maxR = height[r] }
            res += maxR - height[r]
        }
    }
    return res
}
```

#### C++

Standard `std::max` usage; the algorithm shape is identical to all four. The only language-specific bit is `(int)height.size() - 1` to avoid the unsigned-to-signed pitfall on empty input.

```cpp
#include <vector>
#include <algorithm>

int trap(std::vector<int>& height) {
    int l = 0, r = (int)height.size() - 1;
    int maxL = height[l], maxR = height[r], res = 0;
    while (l < r) {
        if (maxL <= maxR) {
            ++l;
            maxL = std::max(maxL, height[l]);
            res += maxL - height[l];
        } else {
            --r;
            maxR = std::max(maxR, height[r]);
            res += maxR - height[r];
        }
    }
    return res;
}
```


### 20. Best Time to Buy and Sell Stock

#### Problem
Given an array `prices` where `prices[i]` is the stock price on day `i`, return the maximum profit from one buy followed by one sell on a later day. Return 0 if no profit is possible.

#### Examples

```text
Input: prices = [7,1,5,3,6,4]
Output: 5
Explanation: buy on day 1 at 1, sell on day 4 at 6.

Input: prices = [7,6,4,3,1]
Output: 0

Input: prices = [2]
Output: 0

Constraints:
- 1 <= prices.length <= 10^5
- 0 <= prices[i] <= 10^4
- one buy and one sell, and the sell day must be later
```

#### Recognition
**Signals.** "Buy on one day and sell on a later day" is an ordering constraint between the two indices, and exactly one transaction is allowed, so the answer is a single maximum of `prices[j] - prices[i]` over `i < j`. With `prices.length` up to `10^5`, examining all pairs is out. The decisive question is what a candidate sell day actually needs from its past, and the answer is not the history but one number: the cheapest price before it, which changes by a single comparison as you step forward. **Therefore.** One left-to-right pass carrying `buy`, the minimum price strictly earlier than today, and `profit`, the best difference so far; the order of the two updates is what enforces buy-before-sell. **Not a DP table over (day, holding) states**, the reflex for stock problems, which genuinely earns its place when the transaction count `k` is a parameter as in LeetCode 123 and 188; at `k = 1` the holding state collapses to that running minimum, so the table would store `n` rows to recompute a scalar. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Try every buy day against every later sell day.

```python
def maxProfit(prices):
    best = 0
    n = len(prices)
    for i in range(n):
        for j in range(i + 1, n):
            if prices[j] - prices[i] > best:
                best = prices[j] - prices[i]
    return best
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** Fix a sell day `j`. All the pairs `(i, j)` differ only in `prices[i]`, so every one of them loses to the single smallest price before `j`. The nested loop rediscovers that minimum from scratch for each `j`, even though going from `j` to `j + 1` can change it by at most one comparison.

**Optimal.** Carry the minimum rather than recomputing it. Seed `buy = prices[0]` and walk from day 1. At day `i` the quantity `prices[i] - buy` is the best profit obtainable by selling on day `i`, because `buy` is the minimum over days strictly before `i`, so keeping a running maximum of it over all `i` is the answer. Then fold `prices[i]` into `buy` for the next iteration. Updating the profit before the minimum is the entire buy-before-sell rule: swapping those two lines would let a day sell to itself, which scores zero and is harmless here but is the wrong invariant to carry into the harder variants. Read another way this is Kadane's algorithm on the array of day-to-day differences, and that framing is what generalises.

**Edge cases.** A strictly falling series such as `[7,6,4,3,1]` returns 0, because doing nothing is legal and `profit` starts at 0 rather than going negative. A single day returns 0 with the loop body never running. Flat prices return 0. Seeding from `prices[0]` requires a non-empty array, which the constraints guarantee.

#### Python

Slicing `prices[1:]` to skip the first element is more Pythonic than tracking an index. `max`/`min` on each step keeps the running state tight in two lines.

```python
def maxProfit(prices):
    buy, profit = prices[0], 0
    for p in prices[1:]:
        profit = max(profit, p - buy)
        buy = min(buy, p)
    return profit
```

#### Java

Indexed loop from 1 rather than slicing (Java arrays don't slice cheaply). `Math.max`/`Math.min` fold the running profit and running-minimum updates into two tidy lines.

```java
class Solution {
    public int maxProfit(int[] prices) {
        int buy = prices[0], profit = 0;
        for (int i = 1; i < prices.length; i++) {
            profit = Math.max(profit, prices[i] - buy);
            buy = Math.min(buy, prices[i]);
        }
        return profit;
    }
}
```

#### Rust

`&prices[1..]` borrows the tail without allocating — slicing in Rust is free. Method-form `profit.max(...)` and `buy.min(...)` mirror the Python shape directly.

```rust
fn max_profit(prices: Vec<i32>) -> i32 {
    let mut buy = prices[0];
    let mut profit = 0;
    for &p in &prices[1..] {
        profit = profit.max(p - buy);
        buy = buy.min(p);
    }
    profit
}
```

#### Go

Pre-builtin-min/max Go — explicit `if` comparisons. `prices[1:]` slicing is identical to Rust syntax and free in cost.

```go
func maxProfit(prices []int) int {
    buy, profit := prices[0], 0
    for _, p := range prices[1:] {
        if p-buy > profit { profit = p - buy }
        if p < buy { buy = p }
    }
    return profit
}
```

#### C++

Indexed loop from 1 instead of slicing; `std::max`/`std::min` from `<algorithm>`. Reads almost exactly like the Python form once you ignore the type annotations.

```cpp
#include <vector>
#include <algorithm>

int maxProfit(std::vector<int>& prices) {
    int buy = prices[0], profit = 0;
    for (int i = 1; i < (int)prices.size(); ++i) {
        profit = std::max(profit, prices[i] - buy);
        buy = std::min(buy, prices[i]);
    }
    return profit;
}
```


### 21. Longest Substring Without Repeating Characters

#### Problem
Given a string `s`, return the length of the longest substring that contains no repeating characters.

#### Examples

```text
Input: s = "abcabcbb"
Output: 3
Explanation: the longest is "abc", of length 3.

Input: s = "bbbbb"
Output: 1

Input: s = ""
Output: 0

Constraints:
- 0 <= s.length <= 5 * 10^4
- s holds English letters, digits, symbols and spaces
- the answer is a substring, not a subsequence
```

#### Recognition
**Signals.** "Substring" and not subsequence means the answer is a contiguous span `[l, r]`, and adjacent spans differ by one character gained and one lost. "Without repeating characters" is a property that can only break when you extend the span and can only be repaired by cutting from the left, and that one-directional behaviour is the licence to shrink instead of restart. A length up to `5 * 10^4` rules out enumerating the `O(n^2)` spans. **Therefore.** A variable-size sliding window over a set of the characters currently inside: push `r` right one character at a time, and while the incoming character is already in the set, evict `s[l]` and advance `l`; the answer is the largest `r - l + 1` observed. **Not a fixed-size window**, because the length is the unknown being solved for, so there is no `k` to slide and the inner shrink loop is unavoidable. **Not a frequency count of the whole string**, which tells you which characters repeat but not where, and adjacency is the entire question. With `m` the alphabet size, **O(n)** time, **O(min(n, m))** space.

#### Explanation
**Brute force.** Test every substring for uniqueness.

```python
def lengthOfLongestSubstring(s):
    res = 0
    n = len(s)
    for i in range(n):
        for j in range(i, n):
            w = s[i:j + 1]
            if len(set(w)) == len(w):
                res = max(res, len(w))
    return res
```

`O(n^3)` time, `O(n)` space.

**Wasteful because.** Growing the span from `[i, j]` to `[i, j + 1]` discards the character set just built and constructs the whole thing again one character longer. Worse, when `i` advances the scan re-walks a prefix that the previous round already proved duplicate-free.

**Optimal.** Maintain the set incrementally under one invariant: every character in `[l, r]` is distinct. Advance `r` by one. If `s[r]` is already inside, its earlier copy must sit at or after `l`, so evicting `s[l]` and advancing `l` repeatedly is guaranteed to reach and remove it; then insert `s[r]` and record the width. `l` never moves backwards, so over the whole run each index is inserted once and removed at most once, which is `2n` set operations despite the nested `while`. A common variant stores the last index of each character and jumps `l = max(l, last[c] + 1)` in one step rather than several; it is the same `O(n)` and wins when evictions would be long, but the `max` is not optional, because a stale index from outside the window would otherwise drag `l` backwards.

**Edge cases.** The empty string returns 0 with the loop body never entered. `"bbbbb"` returns 1: each new `b` evicts the previous one and the window never grows. `"abba"` is the case that punishes a careless jump, since at `r = 3` the last recorded index of `a` is 0, well behind `l = 2`, and the answer is 2 rather than 4.

#### Python

`set` of characters is the cleanest window membership check. The inner `while c in seen` (rather than an `if`) handles repeats inside the window without extra bookkeeping.

```python
def lengthOfLongestSubstring(s):
    seen = set()
    l = res = 0
    for r, c in enumerate(s):
        while c in seen:
            seen.remove(s[l])
            l += 1
        seen.add(c)
        res = max(res, r - l + 1)
    return res
```

#### Java

`HashSet<Character>` gives the window membership check; `s.charAt(r)` avoids allocating a char array. The inner `while (seen.contains(c))` shrinks the window one char at a time until the duplicate is evicted.

```java
import java.util.*;

class Solution {
    public int lengthOfLongestSubstring(String s) {
        Set<Character> seen = new HashSet<>();
        int l = 0, res = 0;
        for (int r = 0; r < s.length(); r++) {
            char c = s.charAt(r);
            while (seen.contains(c)) {
                seen.remove(s.charAt(l));
                l++;
            }
            seen.add(c);
            res = Math.max(res, r - l + 1);
        }
        return res;
    }
}
```

#### Rust

Operating on `s.as_bytes()` and storing `u8` in the set avoids char decoding — fine for ASCII LeetCode inputs. `seen.contains(&b[r])` takes a reference, matching the API shape.

```rust
use std::collections::HashSet;

fn length_of_longest_substring(s: String) -> i32 {
    let b = s.as_bytes();
    let mut seen: HashSet<u8> = HashSet::new();
    let (mut l, mut res) = (0usize, 0usize);
    for r in 0..b.len() {
        while seen.contains(&b[r]) {
            seen.remove(&b[l]);
            l += 1;
        }
        seen.insert(b[r]);
        res = res.max(r - l + 1);
    }
    res as i32
}
```

#### Go

`map[byte]bool` as a set; `delete(seen, s[l])` is the idiomatic removal. Direct byte indexing `s[r]` is faster than rune decoding for the ASCII inputs.

```go
func lengthOfLongestSubstring(s string) int {
    seen := make(map[byte]bool)
    l, res := 0, 0
    for r := 0; r < len(s); r++ {
        for seen[s[r]] {
            delete(seen, s[l])
            l++
        }
        seen[s[r]] = true
        if r-l+1 > res { res = r - l + 1 }
    }
    return res
}
```

#### C++

`seen.erase(s[l++])` and the equivalent `seen.insert(s[r])` keep the loop body dense. `seen.count(s[r])` is the portable 'is in set' check, same as `contains` in C++20.

```cpp
#include <string>
#include <unordered_set>
#include <algorithm>

int lengthOfLongestSubstring(std::string s) {
    std::unordered_set<char> seen;
    int l = 0, res = 0;
    for (int r = 0; r < (int)s.size(); ++r) {
        while (seen.count(s[r])) { seen.erase(s[l++]); }
        seen.insert(s[r]);
        res = std::max(res, r - l + 1);
    }
    return res;
}
```


### 22. Longest Repeating Character Replacement

#### Problem
Given a string `s` and an integer `k`, return the length of the longest substring that can be made into a single repeating character by replacing at most `k` characters.

#### Examples

```text
Input: s = "ABAB", k = 2
Output: 4
Explanation: replace both "A"s with "B"s.

Input: s = "AABABBA", k = 1
Output: 4

Input: s = "A", k = 0
Output: 1

Constraints:
- 1 <= s.length <= 10^5
- s is uppercase English letters only
- 0 <= k <= s.length
```

#### Recognition
**Signals.** "Longest substring" plus an explicit budget `k`. Substring means contiguous, so a window applies; "longest" plus a budget that only gets harder to satisfy as the window grows is the shrink-while-invalid variant. The cost of a window is `size - maxFreq`, where `maxFreq` is the count of its most common character, because every other character has to be replaced. That cost never decreases when you extend, which is what licenses a single left pointer that only moves forward. **Therefore.** One window, a 26-slot count array, and a running `maxFreq`. **Not 26 separate passes**, one per target letter, keeping the longest window whose non-target count stays within `k`. That is correct and easier to argue, but it is `O(26n)` and rebuilds the same window logic 26 times; tracking `maxFreq` folds all 26 into one pass. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Count characters for every substring and test the budget.

```python
def characterReplacement(s, k):
    best = 0
    for i in range(len(s)):
        count = {}
        for j in range(i, len(s)):
            count[s[j]] = count.get(s[j], 0) + 1
            size = j - i + 1
            if size - max(count.values()) <= k:
                best = max(best, size)
    return best
```

`O(n²)` time, `O(1)` space (the dict holds at most 26 keys).

**Wasteful because.** The counts restart at every left endpoint, so each character is counted again for every `i` before it. And once a window is invalid, extending `j` can never rescue it, yet the inner loop keeps going.

**Optimal.** Extending a window by one raises `size` by exactly 1 and `maxFreq` by 0 or 1, so the cost `size - maxFreq` is non-decreasing. Invalidity is therefore permanent until the left edge moves, which is exactly the condition for a two-pointer sweep: grow `r` every step, and advance `l` only while the window is invalid. Each pointer crosses the string once. The subtlety is that `maxFreq` is never recomputed when `l` moves, so it can be stale-high. That is harmless: the recorded answer only improves when the window genuinely widens, and widening requires some character to actually reach a higher count, so no unachievable length is ever reported.

**Edge cases.** `k = 0` degenerates to the longest run of a single character. `k >= len(s)` returns the whole string. A one-character string returns 1. Because `l` advances at most one slot per step, the window never shrinks below the best length seen, which is why the final `r - l + 1` is also the answer.

#### Python

Uses a dict rather than a fixed array — slightly more flexible for non-uppercase inputs, but you eat the hash cost. The `max_freq` never-decreasing invariant is what makes this `O(n)` without a per-iteration scan.

```python
def characterReplacement(s, k):
    count = {}
    l = res = 0
    max_freq = 0
    for r, c in enumerate(s):
        count[c] = count.get(c, 0) + 1
        max_freq = max(max_freq, count[c])
        while (r - l + 1) - max_freq > k:
            count[s[l]] -= 1
            l += 1
        res = max(res, r - l + 1)
    return res
```

#### Java

A stack `int[26]` counter indexed by `s.charAt(r) - 'A'` is cheaper than a `HashMap` for the constrained uppercase alphabet. `maxFreq` is only ever raised via `Math.max`, never rescanned — that never-decreasing invariant is what keeps the pass `O(n)`.

```java
class Solution {
    public int characterReplacement(String s, int k) {
        int[] count = new int[26];
        int l = 0, res = 0, maxFreq = 0;
        for (int r = 0; r < s.length(); r++) {
            count[s.charAt(r) - 'A']++;
            maxFreq = Math.max(maxFreq, count[s.charAt(r) - 'A']);
            while ((r - l + 1) - maxFreq > k) {
                count[s.charAt(l) - 'A']--;
                l++;
            }
            res = Math.max(res, r - l + 1);
        }
        return res;
    }
}
```

#### Rust

`[i32; 26]` on the stack — cheapest possible counter array. The `(b[r] - b'A') as usize` cast is the standard byte-to-index trick when the input is constrained to uppercase ASCII.

```rust
fn character_replacement(s: String, k: i32) -> i32 {
    let b = s.as_bytes();
    let mut count = [0i32; 26];
    let (mut l, mut res, mut max_freq) = (0usize, 0i32, 0i32);
    for r in 0..b.len() {
        let idx = (b[r] - b'A') as usize;
        count[idx] += 1;
        max_freq = max_freq.max(count[idx]);
        while (r - l + 1) as i32 - max_freq > k {
            count[(b[l] - b'A') as usize] -= 1;
            l += 1;
        }
        res = res.max((r - l + 1) as i32);
    }
    res
}
```

#### Go

Stack-allocated `[26]int` (array, not slice). No `max` builtin pre-1.21, so the explicit `if` for `maxFreq` update is unavoidable.

```go
func characterReplacement(s string, k int) int {
    count := [26]int{}
    l, res, maxFreq := 0, 0, 0
    for r := 0; r < len(s); r++ {
        count[s[r]-'A']++
        if count[s[r]-'A'] > maxFreq { maxFreq = count[s[r]-'A'] }
        for (r-l+1)-maxFreq > k {
            count[s[l]-'A']--
            l++
        }
        if r-l+1 > res { res = r - l + 1 }
    }
    return res
}
```

#### C++

`std::array<int, 26>{}` value-initializes to zero. Reads almost identically to the Go and Rust versions because everything is array indexing and arithmetic.

```cpp
#include <string>
#include <array>
#include <algorithm>

int characterReplacement(std::string s, int k) {
    std::array<int, 26> count{};
    int l = 0, res = 0, maxFreq = 0;
    for (int r = 0; r < (int)s.size(); ++r) {
        count[s[r] - 'A']++;
        maxFreq = std::max(maxFreq, count[s[r] - 'A']);
        while ((r - l + 1) - maxFreq > k) {
            count[s[l] - 'A']--;
            ++l;
        }
        res = std::max(res, r - l + 1);
    }
    return res;
}
```


### 23. Permutation in String

#### Problem
Given strings `s1` and `s2`, return `true` if any permutation of `s1` is a contiguous substring of `s2`.

#### Examples

```text
Input: s1 = "ab", s2 = "eidbaooo"
Output: true
Explanation: s2 contains "ba", a permutation of s1.

Input: s1 = "ab", s2 = "eidboaoo"
Output: false

Input: s1 = "abc", s2 = "ab"
Output: false

Constraints:
- 1 <= s1.length, s2.length <= 10^4
- both strings are lowercase English letters
```

#### Recognition
**Signals.** "Permutation" pins the length: any rearrangement of `s1` has exactly `len(s1)` characters, so the window size is fixed, not variable. "Contiguous substring" makes it a window rather than a subsequence. And a permutation is entirely characterised by its character counts, so equality of two 26-slot tallies is the whole test. **Therefore.** Slide a window of exactly `len(s1)` over `s2`, adding the entering character and removing the leaving one, comparing counts at each stop. **Not generating the permutations of `s1`** and searching for each, which is the reflex answer and is `k!` candidates: `k = 10` already means 3.6 million searches for a problem that is one linear pass. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Sort `s1`, then sort every window of that length in `s2`.

```python
def checkInclusion(s1, s2):
    k = len(s1)
    target = sorted(s1)
    for i in range(len(s2) - k + 1):
        if sorted(s2[i:i + k]) == target:
            return True
    return False
```

`O(n * k log k)` time, `O(k)` space.

**Wasteful because.** Consecutive windows differ in exactly two characters, one entering and one leaving, yet each is copied and re-sorted from scratch. Sorting also computes a total ordering when only the multiset matters, which is strictly more information than the question needs.

**Optimal.** Replace the sort with a 26-slot count array, the canonical form of a multiset over a fixed alphabet. Build one for `s1` and one for the first window, then slide: one increment for the entering character and one decrement for the leaving one, both `O(1)`. Array equality over 26 fixed slots is constant work, so the whole scan is `O(|s2|)`. If you want each step to be genuinely constant rather than 26 comparisons, keep a `matches` counter of how many slots currently agree and adjust it only for the two slots that changed. At an alphabet of 26 that rarely shows up in a benchmark, but it is the answer when the interviewer asks whether you can do better.

**Edge cases.** `len(s1) > len(s2)` returns false up front; without the guard, the seeding loop reads past the end of `s2`. Equal lengths leave exactly one window, so the problem reduces to a plain anagram check. Repeated letters in `s1` work because counts are compared, not sets: `s1 = "aab"` is not satisfied by a window holding one `a`.

#### Python

List equality on two `[0] * 26` arrays is `O(26) = O(1)` — that's the trick that keeps the slide `O(n)`. Slicing `s2[:len(s1)]` to seed the window costs one allocation up-front, then the slide is in-place.

```python
def checkInclusion(s1, s2):
    if len(s1) > len(s2):
        return False
    s1_count = [0] * 26
    window = [0] * 26
    for c in s1:
        s1_count[ord(c) - ord('a')] += 1
    for c in s2[:len(s1)]:
        window[ord(c) - ord('a')] += 1
    if s1_count == window:
        return True
    for i in range(len(s1), len(s2)):
        window[ord(s2[i]) - ord('a')] += 1
        window[ord(s2[i - len(s1)]) - ord('a')] -= 1
        if s1_count == window:
            return True
    return False
```

#### Java

`Arrays.equals(int[], int[])` compares the two 26-slot frequency arrays in `O(26) = O(1)` — the trick that keeps each slide constant-time. `new int[26]` zero-initializes automatically.

```java
import java.util.*;

class Solution {
    public boolean checkInclusion(String s1, String s2) {
        int n1 = s1.length(), n2 = s2.length();
        if (n1 > n2) return false;
        int[] s1c = new int[26], win = new int[26];
        for (int i = 0; i < n1; i++) {
            s1c[s1.charAt(i) - 'a']++;
            win[s2.charAt(i) - 'a']++;
        }
        if (Arrays.equals(s1c, win)) return true;
        for (int i = n1; i < n2; i++) {
            win[s2.charAt(i) - 'a']++;
            win[s2.charAt(i - n1) - 'a']--;
            if (Arrays.equals(s1c, win)) return true;
        }
        return false;
    }
}
```

#### Rust

Fixed-size arrays `[i32; 26]` compare with `==` — Rust generates a direct memcmp, no allocation. Computing `n1`/`n2` once avoids repeated `.len()` calls in the index arithmetic.

```rust
fn check_inclusion(s1: String, s2: String) -> bool {
    let (n1, n2) = (s1.len(), s2.len());
    if n1 > n2 { return false; }
    let (b1, b2) = (s1.as_bytes(), s2.as_bytes());
    let mut s1_count = [0i32; 26];
    let mut window = [0i32; 26];
    for i in 0..n1 {
        s1_count[(b1[i] - b'a') as usize] += 1;
        window[(b2[i] - b'a') as usize] += 1;
    }
    if s1_count == window { return true; }
    for i in n1..n2 {
        window[(b2[i] - b'a') as usize] += 1;
        window[(b2[i - n1] - b'a') as usize] -= 1;
        if s1_count == window { return true; }
    }
    false
}
```

#### Go

Go arrays (not slices) compare with `==` — `[26]int` equality is `O(1)` and free of allocation, the underrated property that makes this solution clean.

```go
func checkInclusion(s1 string, s2 string) bool {
    if len(s1) > len(s2) { return false }
    var s1c, win [26]int
    for i := 0; i < len(s1); i++ {
        s1c[s1[i]-'a']++
        win[s2[i]-'a']++
    }
    if s1c == win { return true }
    for i := len(s1); i < len(s2); i++ {
        win[s2[i]-'a']++
        win[s2[i-len(s1)]-'a']--
        if s1c == win { return true }
    }
    return false
}
```

#### C++

`std::array` equality is element-wise and trivially constexpr-able. The brace-init `{}` zero-fills both `s1c` and `win`.

```cpp
#include <string>
#include <array>

bool checkInclusion(std::string s1, std::string s2) {
    if (s1.size() > s2.size()) return false;
    std::array<int, 26> s1c{}, win{};
    int n1 = (int)s1.size(), n2 = (int)s2.size();
    for (int i = 0; i < n1; ++i) {
        s1c[s1[i] - 'a']++;
        win[s2[i] - 'a']++;
    }
    if (s1c == win) return true;
    for (int i = n1; i < n2; ++i) {
        win[s2[i] - 'a']++;
        win[s2[i - n1] - 'a']--;
        if (s1c == win) return true;
    }
    return false;
}
```


### 24. Minimum Window Substring

#### Problem
Given strings `s` and `t`, return the minimum window substring of `s` that contains all characters of `t` (including duplicates). Return an empty string if no such window exists.

#### Examples

```text
Input: s = "ADOBECODEBANC", t = "ABC"
Output: "BANC"
Explanation: the shortest window holding A, B and C.

Input: s = "a", t = "a"
Output: "a"

Input: s = "a", t = "aa"
Output: ""

Constraints:
- 1 <= s.length, t.length <= 10^5
- s and t are upper and lower case English letters
- the answer is unique when one exists
```

#### Recognition
**Signals.** "Minimum window" plus "contains all characters of `t`, including duplicates". Contains-all is a validity predicate that only gets easier as the window grows, and minimum means you want the tightest valid window, so the pattern is expand until valid, then shrink while still valid. "Including duplicates" says the state is counts, not a set of seen characters. **Therefore.** A `need` map of outstanding counts plus one scalar counting unfilled requirements, so validity is the test `missing == 0`. **Not comparing the two count maps for equality** at each step, which is the reflex and is simply wrong: a window holding three `A`s when `t` needs one is still valid, so equality rejects correct answers. The right test is per-character `>=`, and rescanning the alphabet to evaluate it turns every index into 52 comparisons over state that changed in one slot. **O(|s| + |t|)** time, **O(|t|)** space.

#### Explanation
**Brute force.** Check every substring against a count of `t`.

```python
from collections import Counter

def minWindow(s, t):
    need = Counter(t)
    best = ""
    for i in range(len(s)):
        for j in range(i + 1, len(s) + 1):
            have = Counter(s[i:j])
            if all(have[c] >= need[c] for c in need):
                if not best or j - i < len(best):
                    best = s[i:j]
                break
    return best
```

`O(n³)` time in the worst case, `O(1)` space beyond the counters.

**Wasteful because.** `Counter(s[i:j])` recounts a string that differs from the previous one by a single character, and restarting at each `i` discards a window already known to be valid. The same prefix is counted `n` times.

**Optimal.** Keep one window and two numbers. `need[c]` starts at the required count for characters in `t` and drifts negative for surplus copies; `missing` starts at `len(t)` and counts required slots still unfilled. Expanding right always decrements `need[c]`, but decrements `missing` only when `need[c]` was still positive, which is exactly the tick where a genuinely required copy arrives, so surplus characters are ignored for free. When `missing` hits zero the window is valid, and the left pointer walks forward over every character whose `need` is negative, which is every removable surplus, until it rests on one the window cannot spare. That is the minimal window ending at this `r`. Record it, give one required character back, and continue. Every index enters and leaves once, so the sweep is `O(|s|)`.

**Edge cases.** When no window exists the code returns `""`, detected by `end == 0`, which is safe because a valid window always has length at least 1. `t` longer than `s`, or `t` containing a character absent from `s`, both exit through that same path. `t = "aa"` against `s = "a"` is the case that fails if `need` holds a set instead of counts.

#### Python

Tracking `missing` as a single counter (instead of comparing two dicts) keeps the inner check `O(1)`. `enumerate(s, 1)` starts `r` at 1 so the window is `[l, r)`-style and `r - l` is the length directly.

```python
def minWindow(s, t):
    need = {}
    for c in t:
        need[c] = need.get(c, 0) + 1
    missing = len(t)
    l = start = end = 0
    for r, c in enumerate(s, 1):
        if need.get(c, 0) > 0:
            missing -= 1
        need[c] = need.get(c, 0) - 1
        if missing == 0:
            while need.get(s[l], 0) < 0:
                need[s[l]] += 1
                l += 1
            if not end or r - l < end - start:
                start, end = l, r
            need[s[l]] += 1
            missing += 1
            l += 1
    return s[start:end]
```

#### Java

`getOrDefault(c, 0)` folds the contains-check and read into one lookup for the `need` map; tracking `missing` as a single counter keeps the inner test `O(1)` instead of comparing two maps. `s.substring(start, end)` extracts the best window at the end.

```java
import java.util.*;

class Solution {
    public String minWindow(String s, String t) {
        Map<Character, Integer> need = new HashMap<>();
        for (char c : t.toCharArray()) need.merge(c, 1, Integer::sum);
        int missing = t.length();
        int l = 0, start = 0, end = 0;
        for (int r = 0; r < s.length(); r++) {
            char c = s.charAt(r);
            if (need.getOrDefault(c, 0) > 0) missing--;
            need.merge(c, -1, Integer::sum);
            if (missing == 0) {
                while (need.getOrDefault(s.charAt(l), 0) < 0) {
                    need.merge(s.charAt(l), 1, Integer::sum);
                    l++;
                }
                if (end == 0 || r + 1 - l < end - start) {
                    start = l;
                    end = r + 1;
                }
                need.merge(s.charAt(l), 1, Integer::sum);
                missing++;
                l++;
            }
        }
        return s.substring(start, end);
    }
}
```

#### Rust

`HashMap::entry(...).or_insert(0)` returns a mutable reference you can decrement in place — the canonical 'upsert and modify' shape. `usize::MAX` as the 'no best yet' sentinel avoids an `Option<(usize, usize)>` wrapper.

```rust
use std::collections::HashMap;

fn min_window(s: String, t: String) -> String {
    let mut need: HashMap<u8, i32> = HashMap::new();
    for c in t.bytes() { *need.entry(c).or_insert(0) += 1; }
    let mut missing = t.len() as i32;
    let sb = s.as_bytes();
    let (mut l, mut best_start, mut best_len) = (0usize, 0usize, usize::MAX);
    for r in 0..sb.len() {
        let e = need.entry(sb[r]).or_insert(0);
        if *e > 0 { missing -= 1; }
        *e -= 1;
        if missing == 0 {
            while *need.get(&sb[l]).unwrap_or(&0) < 0 {
                *need.get_mut(&sb[l]).unwrap() += 1;
                l += 1;
            }
            if r - l + 1 < best_len { best_len = r - l + 1; best_start = l; }
            *need.get_mut(&sb[l]).unwrap() += 1;
            missing += 1;
            l += 1;
        }
    }
    if best_len == usize::MAX { String::new() } else { s[best_start..best_start + best_len].to_string() }
}
```

#### Go

Go's nil-map read returns the zero value (`0`), so `need[c]` is safe without a `make` check on the read side. The `end == 0` 'first valid window' sentinel works because zero-length windows can't be valid.

```go
func minWindow(s string, t string) string {
    need := make(map[byte]int)
    for i := 0; i < len(t); i++ { need[t[i]]++ }
    missing := len(t)
    l, start, end := 0, 0, 0
    for r := 0; r < len(s); r++ {
        c := s[r]
        if need[c] > 0 { missing-- }
        need[c]--
        if missing == 0 {
            for need[s[l]] < 0 { need[s[l]]++; l++ }
            if end == 0 || r-l+1 < end-start { start = l; end = r + 1 }
            need[s[l]]++; missing++; l++
        }
    }
    return s[start:end]
}
```

#### C++

`need[s[r]]--` post-decrements *and* returns the old value — so `if (need[s[r]]-- > 0) --missing;` checks 'was needed' and decrements in one expression. Subtle but very C++.

```cpp
#include <string>
#include <unordered_map>
#include <climits>

std::string minWindow(std::string s, std::string t) {
    std::unordered_map<char, int> need;
    for (char c : t) need[c]++;
    int missing = (int)t.size();
    int l = 0, best_start = 0, best_len = INT_MAX;
    for (int r = 0; r < (int)s.size(); ++r) {
        if (need[s[r]]-- > 0) --missing;
        if (missing == 0) {
            while (need[s[l]] < 0) need[s[l++]]++;
            if (r - l + 1 < best_len) { best_len = r - l + 1; best_start = l; }
            need[s[l++]]++; ++missing;
        }
    }
    return best_len == INT_MAX ? "" : s.substr(best_start, best_len);
}
```


### 25. Sliding Window Maximum

#### Problem
Given an integer array `nums` and an integer `k`, return an array of the maximum value in each sliding window of size `k`.

#### Examples

```text
Input: nums = [1,3,-1,-3,5,3,6,7], k = 3
Output: [3,3,5,5,6,7]
Explanation: one maximum per window of width 3.

Input: nums = [1], k = 1
Output: [1]

Input: nums = [7,2,4], k = 2
Output: [7,4]

Constraints:
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4
- 1 <= k <= nums.length
```

#### Recognition
**Signals.** A fixed window width `k`, one extremum query per shift, and `n` up to `10^5` so the `O(n * k)` rescan is out at `k` near `n`. The structural tell is that elements leave the window in the order they entered, oldest first, while the query asks for a maximum: that pairing of FIFO eviction with an order statistic is what a monotonic deque exists for. **Therefore.** Hold indices in decreasing value order, pop dominated indices from the back, pop the expired index from the front, and read the front. **Not a max-heap** of `(value, index)` with lazy eviction of stale tops, which is correct and usually accepted, but costs `O(n log n)` and can hold all `n` entries at once, since a small value is only discarded when it happens to surface. The deque discards it the moment a larger later value appears, and never exceeds `k`. **O(n)** time, **O(k)** space.

#### Explanation
**Brute force.** Rescan each window for its maximum.

```python
def maxSlidingWindow(nums, k):
    res = []
    for i in range(len(nums) - k + 1):
        best = nums[i]
        for j in range(i + 1, i + k):
            if nums[j] > best:
                best = nums[j]
        res.append(best)
    return res
```

`O(n * k)` time, `O(1)` space beyond the output.

**Wasteful because.** Adjacent windows share `k - 1` elements and the rescan re-examines all of them. Worse, it keeps consulting elements already known to be irrelevant: once a larger value appears to the right of a smaller one, the smaller can never be the maximum of any window containing both.

**Optimal.** That last observation is the algorithm. Keep a deque of indices whose values decrease from front to back. Before pushing `i`, pop from the back every index whose value is `<= nums[i]`: each is dominated by a value that is both larger and later, so it is dead for every remaining window. Pop from the front when it expires, which the fixed width makes a single test, `dq[0] == i - k`. The front is then the current window's maximum by construction and is read in `O(1)`. Each index is pushed once and popped at most once, so although one step can pop many, total work is `O(n)` amortised.

**Edge cases.** `k = 1` returns the input unchanged and the deque never holds more than one index. `k = len(nums)` yields a single entry, the global maximum. All-equal input relies on the `<=` in the pop test to keep the deque at length 1; with a strict `<` it stays correct but grows to `k`. Output starts only at `i >= k - 1`, giving `n - k + 1` entries.

#### Python

`collections.deque` is the only built-in O(1)-at-both-ends container — list-as-deque would be O(n) on `popleft`. The `dq[0] == i - k` check evicts the stale front in one comparison.

```python
from collections import deque

def maxSlidingWindow(nums, k):
    dq = deque()
    res = []
    for i, n in enumerate(nums):
        while dq and nums[dq[-1]] <= n:
            dq.pop()
        dq.append(i)
        if dq[0] == i - k:
            dq.popleft()
        if i >= k - 1:
            res.append(nums[dq[0]])
    return res
```

#### Java

`ArrayDeque<Integer>` is the O(1)-at-both-ends container; use `peekLast`/`pollLast` for the monotonic back and `peekFirst`/`pollFirst` for the stale-front eviction. Prefer it over the synchronized legacy `Stack`/`LinkedList`.

```java
import java.util.*;

class Solution {
    public int[] maxSlidingWindow(int[] nums, int k) {
        Deque<Integer> dq = new ArrayDeque<>();
        int n = nums.length;
        int[] res = new int[n - k + 1];
        int idx = 0;
        for (int i = 0; i < n; i++) {
            while (!dq.isEmpty() && nums[dq.peekLast()] <= nums[i]) dq.pollLast();
            dq.addLast(i);
            if (dq.peekFirst() == i - k) dq.pollFirst();
            if (i >= k - 1) res[idx++] = nums[dq.peekFirst()];
        }
        return res;
    }
}
```

#### Rust

`VecDeque::back().map_or(false, |&j| nums[j] <= n)` collapses the empty-check and the comparison into one expression. `i.wrapping_sub(k)` avoids panicking on the first window where `i < k`.

```rust
use std::collections::VecDeque;

fn max_sliding_window(nums: Vec<i32>, k: i32) -> Vec<i32> {
    let k = k as usize;
    let mut dq: VecDeque<usize> = VecDeque::new();
    let mut res = Vec::new();
    for (i, &n) in nums.iter().enumerate() {
        while dq.back().map_or(false, |&j| nums[j] <= n) { dq.pop_back(); }
        dq.push_back(i);
        if dq.front() == Some(&(i.wrapping_sub(k))) { dq.pop_front(); }
        if i >= k - 1 { res.push(nums[*dq.front().unwrap()]); }
    }
    res
}
```

#### Go

Slice-as-deque works because `dq[1:]` and `dq[:len(dq)-1]` are O(1) view operations. Garbage collection takes care of the eventual reclamation.

```go
func maxSlidingWindow(nums []int, k int) []int {
    dq := []int{}
    res := []int{}
    for i, n := range nums {
        for len(dq) > 0 && nums[dq[len(dq)-1]] <= n {
            dq = dq[:len(dq)-1]
        }
        dq = append(dq, i)
        if dq[0] == i-k { dq = dq[1:] }
        if i >= k-1 { res = append(res, nums[dq[0]]) }
    }
    return res
}
```

#### C++

`std::deque<int>` gives O(1) push/pop at both ends; the API (`back`, `pop_back`, `front`, `pop_front`) maps directly to the algorithm vocabulary.

```cpp
#include <vector>
#include <deque>

std::vector<int> maxSlidingWindow(std::vector<int>& nums, int k) {
    std::deque<int> dq;
    std::vector<int> res;
    for (int i = 0; i < (int)nums.size(); ++i) {
        while (!dq.empty() && nums[dq.back()] <= nums[i]) dq.pop_back();
        dq.push_back(i);
        if (dq.front() == i - k) dq.pop_front();
        if (i >= k - 1) res.push_back(nums[dq.front()]);
    }
    return res;
}
```


### 26. Valid Parentheses

#### Problem
Given a string `s` containing only `'('`, `')'`, `'{'`, `'}'`, `'['`, and `']'`, determine if the input string is valid. An input is valid if every open bracket is closed by the same type of bracket in the correct order.

#### Examples

```text
Input: s = "()"
Output: true

Input: s = "([)]"
Output: false
Explanation: every type balances, but the pairs interleave.

Input: s = "]"
Output: false

Constraints:
- 1 <= s.length <= 10^4
- s holds only the characters '(', ')', '[', ']', '{', '}'
- nesting depth can reach s.length / 2
```

#### Recognition
**Signals.** "Closed by the same type of bracket" is a matching condition, but "in the correct order" is the phrase that picks the data structure: a closer must answer to the most recently opened bracket that is still unmatched, which is last-in-first-out by definition. Nesting can run to depth `s.length / 2`, so the number of pending openers is unbounded and has to live somewhere. **Therefore.** A stack. Push every opener; on a closer, fail if the stack is empty or its top is the wrong type, otherwise pop. The string is valid only if every closer matched and the stack finishes empty. **Not three counters**, one per bracket type, raised on open and lowered on close: `([)]` leaves all three at zero and is still invalid, because a count records how many brackets are open and never which one is innermost. **Not repeatedly deleting `"()"`, `"[]"` and `"{}"` until the string stops shrinking**, which is correct but pays a full rescan per nesting level. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Peel off adjacent matched pairs until nothing changes.

```python
def isValid(s):
    prev = None
    while prev != s:
        prev = s
        s = s.replace("()", "")
        s = s.replace("[]", "")
        s = s.replace("{}", "")
    return s == ""
```

`O(n^2)` time, `O(n)` space.

**Wasteful because.** Each round rescans and rebuilds the entire remaining string in order to strip one layer of nesting. On `"(((...)))"` of depth `n / 2` that is `n / 2` rounds over `O(n)` characters, and nearly all of those characters are unchanged, re-read only because the algorithm keeps no memory of where it had got to.

**Optimal.** Do the same peeling in one pass, with a stack standing in for the shrinking string. Push each opener. When a closer arrives, the only bracket it may legally close is the one on top, so an empty stack or a mismatched top is an immediate false; otherwise pop, which is the `O(1)` equivalent of deleting that pair out of the middle of the string. A dict from closer to opener folds the three cases into one branch and makes `stack[-1] != pairs[c]` the whole test. At the end an empty stack means every opener was closed, and leftovers mean unclosed openers, the same signal the naive version reads off a non-empty remainder. Each character is pushed at most once and popped at most once.

**Edge cases.** An odd-length string can never be valid, and both routes to failure are covered: `"("` survives to the end and fails the emptiness check, while `"]"` fails on the first character against an empty stack. `"([)]"` is the case that separates a stack from counting, since it balances by type and still breaks order. Deep nesting is fine; the stack simply grows to the nesting depth, at most `n / 2`.

#### Python

Dict `pairs = {')': '(', ...}` lets a single `if c in pairs` branch handle all closers. `not stack` is the empty-stack check; `stack[-1]` peeks without popping.

```python
def isValid(s):
    stack = []
    pairs = {")": "(", "]": "[", "}": "{"}
    for c in s:
        if c in pairs:
            if not stack or stack[-1] != pairs[c]:
                return False
            stack.pop()
        else:
            stack.append(c)
    return not stack
```

#### Java

`ArrayDeque<Character>` serves as the stack with `push`/`pop`/`isEmpty` — prefer it over the synchronized legacy `Stack`. A `Map` of closer-to-opener lets a single `containsKey` branch handle all three closing brackets.

```java
import java.util.*;

class Solution {
    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');
        for (char c : s.toCharArray()) {
            if (pairs.containsKey(c)) {
                if (stack.isEmpty() || stack.pop() != pairs.get(c)) return false;
            } else {
                stack.push(c);
            }
        }
        return stack.isEmpty();
    }
}
```

#### Rust

Pattern match on `char` with `|` alternatives gives a flat decision tree. `stack.pop()` returns `Option<char>` so the equality check against `Some('(')` is type-safe — no separate empty test needed.

```rust
fn is_valid(s: String) -> bool {
    let mut stack: Vec<char> = Vec::new();
    for c in s.chars() {
        match c {
            '(' | '[' | '{' => stack.push(c),
            ')' => { if stack.pop() != Some('(') { return false; } }
            ']' => { if stack.pop() != Some('[') { return false; } }
            '}' => { if stack.pop() != Some('{') { return false; } }
            _ => {}
        }
    }
    stack.is_empty()
}
```

#### Go

`map[rune]rune` for the pair lookup; ranging over a string yields runes, so types align. Slice-as-stack with `stack[:len(stack)-1]` for pop.

```go
func isValid(s string) bool {
    stack := []rune{}
    pairs := map[rune]rune{')': '(', ']': '[', '}': '{'}
    for _, c := range s {
        if open, ok := pairs[c]; ok {
            if len(stack) == 0 || stack[len(stack)-1] != open { return false }
            stack = stack[:len(stack)-1]
        } else {
            stack = append(stack, c)
        }
    }
    return len(stack) == 0
}
```

#### C++

`std::stack<char>` from `<stack>` — the dedicated adapter, not a vector. The chained `||` condition in the validation is slightly denser than the dict approach but avoids the map lookup.

```cpp
#include <string>
#include <stack>

bool isValid(std::string s) {
    std::stack<char> st;
    for (char c : s) {
        if (c == '(' || c == '[' || c == '{') { st.push(c); }
        else {
            if (st.empty()) return false;
            char top = st.top(); st.pop();
            if ((c == ')' && top != '(') ||
                (c == ']' && top != '[') ||
                (c == '}' && top != '{')) return false;
        }
    }
    return st.empty();
}
```


### 27. Min Stack

#### Problem
Design a stack that supports `push`, `pop`, `top`, and `getMin` — all in `O(1)` time.

#### Examples

```text
Input: ["MinStack","push","push","push","getMin","pop","top",
"getMin"],
[[],[-2],[0],[-3],[],[],[],[]]
Output: [null,null,null,null,-3,null,0,-2]
Explanation: getMin() returns -3, then after pop() top() is 0
and getMin() is -2.

Input: ["MinStack","push","push","getMin","pop","getMin"],
[[],[2],[2],[],[],[]]
Output: [null,null,null,2,null,2]

Input: ["MinStack","push","top","getMin"],
[[],[0],[],[]]
Output: [null,null,0,0]

Constraints:
- -2^31 <= val <= 2^31 - 1
- pop, top and getMin are called on a non-empty stack
- at most 3 * 10^4 calls in total
```

#### Recognition
**Signals.** "Design a stack" fixes the access order as last-in-first-out, and "`getMin` in `O(1)`" is the clause that does the work: a query must be answered without looking at the elements, so the answer has to be stored, not computed. Because `pop` undoes exactly one `push`, the state you need is a history, and a history that unwinds in the same order as the stack is just a second stack. **Therefore.** Push a paired entry recording the minimum of everything at or below that height, and pop both together. **Not a heap**, which peeks its minimum in `O(1)` but must remove the *most recent* element on `pop`, not the smallest, and deleting an arbitrary element costs `O(n)` to locate. **Not a single `min` variable**, which is correct until that minimum is popped and you have nothing to fall back to. Every operation stays constant time, paid for with one extra integer per element. **O(1)** time, **O(n)** space.

#### Explanation
**Brute force.** One list, and `getMin` scans it.

```python
class MinStack:
    def __init__(self):
        self.stack = []

    def push(self, val): self.stack.append(val)

    def pop(self): self.stack.pop()

    def top(self): return self.stack[-1]

    def getMin(self): return min(self.stack)  # rescans
```

`O(n)` per `getMin`, `O(n)` space.

**Wasteful because.** Each scan recomputes the minimum of a list that changed by one element since the last scan. With `getMin` called after every push, that is `O(n^2)` total work to answer a question whose answer was already known one element ago.

**Optimal.** Keep the answer instead of recomputing it. On every `push`, also push `min(val, current_min)` onto a parallel stack, so entry `i` of that stack means "the minimum if the main stack were trimmed to height `i + 1`". `getMin` reads its top. The reason pops need no repair is that the two stacks change height together, so removing an element automatically exposes the minimum that was correct before it arrived. Storing a value per element rather than a value per distinct minimum is what keeps duplicates safe; the space-tighter variant pushes onto the min stack only when `val <= current_min` and pops only when the popped value equals the top, which wins when the input is mostly increasing.

**Edge cases.** The first push sees an empty min stack, so the min is `val` itself. Pushing the same minimum twice then popping once must still report it, which the one-entry-per-element rule handles for free. All-negative inputs need nothing special since only comparisons are used.

#### Python

Two parallel lists; `min(val, self.min_stack[-1] if self.min_stack else val)` inlines the empty-check. Simple and the canonical reference shape.

```python
class MinStack:
    def __init__(self):
        self.stack = []
        self.min_stack = []

    def push(self, val):
        self.stack.append(val)
        self.min_stack.append(min(val, self.min_stack[-1] if self.min_stack else val))

    def pop(self):
        self.stack.pop()
        self.min_stack.pop()

    def top(self):
        return self.stack[-1]

    def getMin(self):
        return self.min_stack[-1]
```

#### Java

Two parallel `ArrayDeque<Integer>` stacks; `push` pairs each value with `Math.min(val, minStack.peek())`. `peek` reads the top without popping, so `getMin` is O(1). Autoboxing means `peek()` returns an `Integer` — fine for the comparison and `Math.min`.

```java
import java.util.*;

class MinStack {
    private final Deque<Integer> stack = new ArrayDeque<>();
    private final Deque<Integer> minStack = new ArrayDeque<>();

    public MinStack() {}

    public void push(int val) {
        stack.push(val);
        minStack.push(minStack.isEmpty() ? val : Math.min(val, minStack.peek()));
    }

    public void pop() {
        stack.pop();
        minStack.pop();
    }

    public int top() {
        return stack.peek();
    }

    public int getMin() {
        return minStack.peek();
    }
}
```

#### Rust

`self.min_stack.last().map_or(val, |&prev| prev.min(val))` is the empty-safe one-liner for 'min of new and current min, defaulting to new'. The `unwrap` on `top`/`get_min` reflects the problem's precondition that they're called only on non-empty stacks.

```rust
struct MinStack {
    stack: Vec<i32>,
    min_stack: Vec<i32>,
}

impl MinStack {
    fn new() -> Self { MinStack { stack: vec![], min_stack: vec![] } }

    fn push(&mut self, val: i32) {
        self.stack.push(val);
        let m = self.min_stack.last().map_or(val, |&prev| prev.min(val));
        self.min_stack.push(m);
    }

    fn pop(&mut self) { self.stack.pop(); self.min_stack.pop(); }

    fn top(&self) -> i32 { *self.stack.last().unwrap() }

    fn get_min(&self) -> i32 { *self.min_stack.last().unwrap() }
}
```

#### Go

`Constructor()` returns a value (not a pointer) — LeetCode's Go convention. Methods take `*MinStack` so pushes/pops are visible to the caller.

```go
type MinStack struct {
    stack    []int
    minStack []int
}

func Constructor() MinStack { return MinStack{} }

func (s *MinStack) Push(val int) {
    s.stack = append(s.stack, val)
    m := val
    if len(s.minStack) > 0 && s.minStack[len(s.minStack)-1] < m {
        m = s.minStack[len(s.minStack)-1]
    }
    s.minStack = append(s.minStack, m)
}

func (s *MinStack) Pop() {
    s.stack = s.stack[:len(s.stack)-1]
    s.minStack = s.minStack[:len(s.minStack)-1]
}

func (s *MinStack) Top() int     { return s.stack[len(s.stack)-1] }
func (s *MinStack) GetMin() int  { return s.minStack[len(s.minStack)-1] }
```

#### C++

`std::stack<int>` adapter for both stacks. Ternary `mn.empty() ? val : std::min(mn.top(), val)` keeps the push compact.

```cpp
#include <stack>
#include <algorithm>

class MinStack {
    std::stack<int> st, mn;
public:
    void push(int val) {
        st.push(val);
        mn.push(mn.empty() ? val : std::min(mn.top(), val));
    }
    void pop()      { st.pop(); mn.pop(); }
    int top()       { return st.top(); }
    int getMin()    { return mn.top(); }
};
```


### 28. Evaluate Reverse Polish Notation

#### Problem
Evaluate an arithmetic expression given as a list of tokens in Reverse Polish Notation (postfix). Operators are `+`, `-`, `*`, and `/` (integer division truncating toward zero). The expression is guaranteed to be valid.

#### Examples

```text
Input: tokens = ["2","1","+","3","*"]
Output: 9
Explanation: ((2 + 1) * 3) = 9.

Input: tokens = ["4","13","5","/","+"]
Output: 6
Explanation: (4 + (13 / 5)) = 4 + 2 = 6.

Input: tokens = ["-7","2","/"]
Output: -3
Explanation: truncation is toward zero, not floor.

Constraints:
- 1 <= tokens.length <= 10^4
- each token is an operator or an integer in [-200, 200]
- the expression is a valid RPN expression
- division never divides by zero
```

#### Recognition
**Signals.** "Reverse Polish Notation" means each operator arrives *after* both of its operands, so there is no precedence to resolve and no parentheses to match; the only rule is that an operator consumes the two most recently completed values. "Most recent, then the one before it" is the definition of last-in-first-out. **Therefore.** Push integers onto a stack, and on an operator pop two, apply, and push the result back so it can serve as an operand later. **Not an expression tree**, which is the classic way to evaluate arithmetic but costs `O(n)` node allocations plus a second traversal to buy back an evaluation order that postfix already hands you. **Not scanning the token list repeatedly** for the leftmost reducible operator, because collapsing three tokens into one shifts every token after it, giving `O(n^2)`. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Find the leftmost operator, collapse it, repeat.

```python
def evalRPN(tokens):
    t = list(tokens)
    while len(t) > 1:
        for i in range(2, len(t)):
            if t[i] in "+-*/":
                a, b = int(t[i - 2]), int(t[i - 1])
                v = (a + b if t[i] == "+" else
                     a - b if t[i] == "-" else
                     a * b if t[i] == "*" else int(a / b))
                t[i - 2:i + 1] = [str(v)]
                break
    return int(t[0])
```

`O(n^2)` time, `O(n)` space.

**Wasteful because.** Every collapse restarts the search at index 0 and rewrites the tail of the list. The tokens before the operator were already known to be plain numbers, and the scan re-establishes that fact once per operator.

**Optimal.** Keep the numbers you have already passed on a stack, so the search never restarts: reading left to right, an integer is pushed, and an operator pops exactly two values and pushes one. The stack top is always the leftmost reducible operand pair, which is why one pass suffices. Argument order matters, since the *first* pop is the right operand: `b, a = stack.pop(), stack.pop()` then `a - b`. Because the input is guaranteed valid, the stack never underflows and finishes holding exactly one value.

**Edge cases.** Division truncates toward zero, so `int(a / b)` and not `a // b`, which floors and turns `-7 / 2` into `-4` instead of `-3`. A negative literal such as `"-7"` is an operand, not the `-` operator, so test the whole token rather than its first character. A single-token input like `["42"]` is a complete expression.

#### Python

`int(a / b)` truncates toward zero — important because `a // b` floors, which differs for negative dividends. `t in "+-*/"` is a tiny-set membership check that's fine for four characters.

```python
def evalRPN(tokens):
    stack = []
    for t in tokens:
        if t in "+-*/":
            b, a = stack.pop(), stack.pop()
            if t == "+":   stack.append(a + b)
            elif t == "-": stack.append(a - b)
            elif t == "*": stack.append(a * b)
            else:          stack.append(int(a / b))  # truncate toward zero
        else:
            stack.append(int(t))
    return stack[0]
```

#### Java

`ArrayDeque<Integer>` as the operand stack; `Integer.parseInt` handles the numeric tokens. Java's integer `/` truncates toward zero already (matching the spec), so no float workaround is needed.

```java
import java.util.*;

class Solution {
    public int evalRPN(String[] tokens) {
        Deque<Integer> stack = new ArrayDeque<>();
        for (String t : tokens) {
            switch (t) {
                case "+", "-", "*", "/" -> {
                    int b = stack.pop(), a = stack.pop();
                    switch (t) {
                        case "+" -> stack.push(a + b);
                        case "-" -> stack.push(a - b);
                        case "*" -> stack.push(a * b);
                        default  -> stack.push(a / b);
                    }
                }
                default -> stack.push(Integer.parseInt(t));
            }
        }
        return stack.pop();
    }
}
```

#### Rust

Rust's `/` on integers already truncates toward zero, so no special handling needed. Nested `match t.as_str()` is the cleanest dispatch — `as_str` because matching on `String` directly isn't pattern-friendly.

```rust
fn eval_rpn(tokens: Vec<String>) -> i32 {
    let mut stack: Vec<i32> = Vec::new();
    for t in &tokens {
        match t.as_str() {
            "+" | "-" | "*" | "/" => {
                let b = stack.pop().unwrap();
                let a = stack.pop().unwrap();
                stack.push(match t.as_str() {
                    "+" => a + b,
                    "-" => a - b,
                    "*" => a * b,
                    _   => a / b,  // Rust integer division truncates toward zero
                });
            }
            _ => stack.push(t.parse().unwrap()),
        }
    }
    stack[0]
}
```

#### Go

Go's integer `/` truncates toward zero, but using `float64` here is a paranoid workaround for negative cases — equivalent to direct integer division. A simple `a / b` would also work.

```go
import "strconv"

func evalRPN(tokens []string) int {
    stack := []int{}
    for _, t := range tokens {
        switch t {
        case "+", "-", "*", "/":
            b, a := stack[len(stack)-1], stack[len(stack)-2]
            stack = stack[:len(stack)-2]
            var v int
            switch t {
            case "+": v = a + b
            case "-": v = a - b
            case "*": v = a * b
            case "/": v = int(float64(a) / float64(b)) // truncate toward zero
            }
            stack = append(stack, v)
        default:
            n, _ := strconv.Atoi(t)
            stack = append(stack, n)
        }
    }
    return stack[0]
}
```

#### C++

C++'s integer division has been truncate-toward-zero since C++11 (was implementation-defined before). Promoting to `long` defends against `INT_MIN / -1` overflow.

```cpp
#include <vector>
#include <string>
#include <stack>

int evalRPN(std::vector<std::string>& tokens) {
    std::stack<long> st;
    for (const auto& t : tokens) {
        if (t == "+" || t == "-" || t == "*" || t == "/") {
            long b = st.top(); st.pop();
            long a = st.top(); st.pop();
            if      (t == "+") st.push(a + b);
            else if (t == "-") st.push(a - b);
            else if (t == "*") st.push(a * b);
            else               st.push((long)(a / b));  // C++ truncates toward zero
        } else {
            st.push(std::stol(t));
        }
    }
    return (int)st.top();
}
```


### 29. Generate Parentheses

#### Problem
Given `n`, generate all combinations of `n` pairs of well-formed (valid) parentheses.

#### Examples

```text
Input: n = 3
Output: ["((()))","(()())","(())()","()(())","()()()"]

Input: n = 1
Output: ["()"]

Input: n = 2
Output: ["(())","()()"]

Compare: any-order

Constraints:
- 1 <= n <= 8
- the answer may be returned in any order
```

#### Recognition
**Signals.** "Generate all combinations" asks for the list, not a count, so the output itself is exponential and the only thing you control is how much invalid work you do on the way. "Well-formed" is the lever: a parenthesis string is valid exactly when no prefix has more `)` than `(` and the totals match, and a *prefix* property is testable while you are still building. **Therefore.** Build the string one character at a time, allowing `(` while `open < n` and `)` while `close < open`, so every leaf reached is already valid and nothing needs filtering or deduplicating. **Not generate-then-filter** over all `2^(2n)` strings, which at `n = 8` inspects 65536 candidates to keep 1430. **Not BFS by string length**, because a queue holds every partial string of the current length at once, while the depth-first path holds only `2n` characters. The number of answers is the `n`-th Catalan number, so that is the floor any method must pay. **O(4ⁿ / √n)** time, **O(n)** space.

#### Explanation
**Brute force.** Enumerate every string of `(` and `)`, then keep the valid ones.

```python
def generateParenthesis(n):
    res = []
    for bits in itertools.product("()", repeat=2 * n):
        s, bal = "".join(bits), 0
        for c in s:
            bal += 1 if c == "(" else -1
            if bal < 0:
                break
        if bal == 0:
            res.append(s)
    return res
```

`O(2^(2n) * n)` time, `O(n)` space.

**Wasteful because.** Every candidate is built to full length before it is judged. A string starting `())` is already dead, yet all `2^(2n - 3)` completions of it get generated and validated one by one.

**Optimal.** Move the validity test from the leaves to the branches. Carry two counters, `open` and `close`, and take the `(` branch only while `open < n` and the `)` branch only while `close < open`; the second condition is the prefix rule enforced at the moment it could first be broken, so no dead subtree is ever entered. The recursion therefore visits one node per prefix of a valid answer, and the count of answers is the `n`-th Catalan number, which is the floor for any algorithm that must print them. Each string is produced by exactly one sequence of choices, so no deduplication is needed. Mutating one buffer with `push`/`pop` instead of concatenating saves the `O(n)` copy per call, which matters more in the compiled languages than in Python.

**Edge cases.** `n = 1` yields the single string `"()"`. Order is unspecified, so any permutation of the list is accepted. The recursion depth is exactly `2n`, at most 16 here, so there is no stack risk.

#### Python

Recursive closure captures `res` directly. String concatenation `s + "("` is O(n) per call — could use a list and `"".join` for huge n, but for typical n=8 it's fine and reads cleanly.

```python
def generateParenthesis(n):
    res = []
    def bt(s, open_count, close_count):
        if len(s) == 2 * n:
            res.append(s)
            return
        if open_count < n:
            bt(s + "(", open_count + 1, close_count)
        if close_count < open_count:
            bt(s + ")", open_count, close_count + 1)
    bt("", 0, 0)
    return res
```

#### Java

`StringBuilder` mutated with `append`/`deleteCharAt` and cloned via `toString()` only at the leaves avoids the per-call string allocation. A private recursive helper is cleaner than a lambda here, since Java lambdas can't self-reference for recursion.

```java
import java.util.*;

class Solution {
    public List<String> generateParenthesis(int n) {
        List<String> res = new ArrayList<>();
        bt(new StringBuilder(), 0, 0, n, res);
        return res;
    }

    private void bt(StringBuilder s, int open, int close, int n, List<String> res) {
        if (s.length() == 2 * n) {
            res.add(s.toString());
            return;
        }
        if (open < n) {
            s.append('(');
            bt(s, open + 1, close, n, res);
            s.deleteCharAt(s.length() - 1);
        }
        if (close < open) {
            s.append(')');
            bt(s, open, close + 1, n, res);
            s.deleteCharAt(s.length() - 1);
        }
    }
}
```

#### Rust

Mutating a shared `String` with `push`/`pop` and cloning only at leaves avoids the per-call allocation. The free-function `fn bt` (with explicit args) is more idiomatic than a closure when recursion is involved — closures can't recurse without trickery.

```rust
fn generate_parenthesis(n: i32) -> Vec<String> {
    let mut res = Vec::new();
    fn bt(s: &mut String, open: i32, close: i32, n: i32, res: &mut Vec<String>) {
        if s.len() == (2 * n) as usize { res.push(s.clone()); return; }
        if open < n  { s.push('('); bt(s, open + 1, close, n, res); s.pop(); }
        if close < open { s.push(')'); bt(s, open, close + 1, n, res); s.pop(); }
    }
    bt(&mut String::new(), 0, 0, n, &mut res);
    res
}
```

#### Go

Declare-then-assign (`var bt func...; bt = func...`) is the workaround for self-referential closures in Go. String concatenation `s+"("` creates a new string each call — fine for small n.

```go
func generateParenthesis(n int) []string {
    res := []string{}
    var bt func(s string, open, close int)
    bt = func(s string, open, close int) {
        if len(s) == 2*n { res = append(res, s); return }
        if open < n      { bt(s+"(", open+1, close) }
        if close < open  { bt(s+")", open, close+1) }
    }
    bt("", 0, 0)
    return res
}
```

#### C++

`std::function<void(int, int)>` is the workaround for recursive lambdas. Sharing one `cur` string with `pop_back` after each branch is the same in-place mutation as Rust's version.

```cpp
#include <vector>
#include <string>

std::vector<std::string> generateParenthesis(int n) {
    std::vector<std::string> res;
    std::string cur;
    std::function<void(int, int)> bt = [&](int open, int close) {
        if ((int)cur.size() == 2 * n) { res.push_back(cur); return; }
        if (open < n)    { cur += '('; bt(open + 1, close); cur.pop_back(); }
        if (close < open){ cur += ')'; bt(open, close + 1); cur.pop_back(); }
    };
    bt(0, 0);
    return res;
}
```


### 30. Daily Temperatures

#### Problem
Given an array `temperatures`, return an array `answer` where `answer[i]` is the number of days after day `i` until a warmer temperature. If no warmer day exists, `answer[i]` is 0.

#### Examples

```text
Input: temperatures = [73,74,75,71,69,72,76,73]
Output: [1,1,4,2,1,1,0,0]
Explanation: day 2 (75) waits until day 6 (76), so 4.

Input: temperatures = [30,40,50,60]
Output: [1,1,1,0]

Input: temperatures = [90,80,80,70]
Output: [0,0,0,0]
Explanation: never warmer, and 80 does not beat 80.

Constraints:
- 1 <= temperatures.length <= 10^5
- 30 <= temperatures[i] <= 100
```

#### Recognition
**Signals.** "How many days **until** a warmer temperature" asks for a *distance* to the next qualifying element, not its value, so what you carry has to be indices rather than temperatures. "Next warmer" is next-greater-element phrasing, and the structural hint is that a cool day wedged between two warmer ones can never be anybody's answer once a warmer day passes it. **Therefore.** One left-to-right pass over a stack of indices whose temperatures are non-increasing: each new day resolves every waiting day it beats, recording `i - j`. **Not sort by temperature** and query a sorted set for the nearest later index, which is correct but costs `O(n log n)` plus a balanced-tree structure, where the stack answers the same queries for free in one pass. **Not a forward scan per day**, the `O(n^2)` baseline this exists to beat. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** For each day, walk forward until a warmer day appears.

```python
def dailyTemperatures(temperatures):
    n = len(temperatures)
    res = [0] * n
    for i in range(n):
        for j in range(i + 1, n):
            if temperatures[j] > temperatures[i]:
                res[i] = j - i
                break
    return res
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** Every scan re-walks the same run of cool days. Once day `j` is known to be cooler than day `k > j`, day `j` can never be the answer for anything to its left, yet each fresh scan from an earlier index steps over it again.

**Optimal.** Keep a stack of the indices still waiting for an answer, ordered so their temperatures are non-increasing from bottom to top. When day `i` arrives, every waiting day it beats has just found its answer, so pop those and write `i - j`. Then push `i`, which is now the newest unanswered day and is no warmer than anything left beneath it, preserving the order. Indices still on the stack at the end never saw a warmer day and keep the `0` the result array was initialised with. The inner `while` looks nested but each index is pushed once and popped once, so the total work is `O(n)` amortised, and saying "amortised" out loud is the point of the exercise.

**Edge cases.** A strictly decreasing input pops nothing until the end, so the stack holds all `n` indices and the `O(n)` space is real, not a bound you never hit. Equal temperatures must not resolve each other, which is why the comparison is strict `>`; `80` after `80` yields `0`. A single day returns `[0]`.

#### Python

Standard monotonic-stack form: `while stack and t > temperatures[stack[-1]]`. Initializing `res = [0] * n` means indices left in the stack stay zero — no post-loop cleanup needed.

```python
def dailyTemperatures(temperatures):
    res = [0] * len(temperatures)
    stack = []
    for i, t in enumerate(temperatures):
        while stack and t > temperatures[stack[-1]]:
            j = stack.pop()
            res[j] = i - j
        stack.append(i)
    return res
```

#### Java

`ArrayDeque<Integer>` holds indices in the monotonic stack; `new int[n]` defaults to 0, so indices left on the stack need no cleanup. `peek`/`pop` map directly to the peek-then-resolve pattern.

```java
import java.util.*;

class Solution {
    public int[] dailyTemperatures(int[] temperatures) {
        int n = temperatures.length;
        int[] res = new int[n];
        Deque<Integer> stack = new ArrayDeque<>();
        for (int i = 0; i < n; i++) {
            while (!stack.isEmpty() && temperatures[i] > temperatures[stack.peek()]) {
                int j = stack.pop();
                res[j] = i - j;
            }
            stack.push(i);
        }
        return res;
    }
}
```

#### Rust

`while let Some(&j) = stack.last()` is the idiomatic 'peek without popping' over an `Option`. The inner `break` is needed because the loop condition can't access `j`.

```rust
fn daily_temperatures(temperatures: Vec<i32>) -> Vec<i32> {
    let n = temperatures.len();
    let mut res = vec![0i32; n];
    let mut stack: Vec<usize> = Vec::new();
    for i in 0..n {
        while let Some(&j) = stack.last() {
            if temperatures[i] > temperatures[j] {
                stack.pop();
                res[j] = (i - j) as i32;
            } else {
                break;
            }
        }
        stack.push(i);
    }
    res
}
```

#### Go

Slice-as-stack; the indexed `temperatures[stack[len(stack)-1]]` chain is unavoidably noisy but matches the algorithm one-to-one.

```go
func dailyTemperatures(temperatures []int) []int {
    n := len(temperatures)
    res := make([]int, n)
    stack := []int{}
    for i, t := range temperatures {
        for len(stack) > 0 && t > temperatures[stack[len(stack)-1]] {
            j := stack[len(stack)-1]
            stack = stack[:len(stack)-1]
            res[j] = i - j
        }
        stack = append(stack, i)
    }
    return res
}
```

#### C++

`std::stack<int>` adapter — `top()`/`pop()` are separate calls (unlike Rust's `pop()` which returns the value). `std::vector<int> res(n, 0)` zero-fills.

```cpp
#include <vector>
#include <stack>

std::vector<int> dailyTemperatures(std::vector<int>& temperatures) {
    int n = (int)temperatures.size();
    std::vector<int> res(n, 0);
    std::stack<int> st;
    for (int i = 0; i < n; ++i) {
        while (!st.empty() && temperatures[i] > temperatures[st.top()]) {
            int j = st.top(); st.pop();
            res[j] = i - j;
        }
        st.push(i);
    }
    return res;
}
```


### 31. Car Fleet

#### Problem
Given `n` cars at different positions on a one-lane road heading toward a `target`, where each car has a given `speed`, return the number of car fleets (groups of cars that arrive together) that reach the destination.

#### Examples

```text
Input: target = 12, position = [10,8,0,5,3], speed = [2,4,1,1,3]
Output: 3
Explanation: cars at 10 and 8 meet at 12; the car at 0 arrives
alone; cars at 5 and 3 meet at 6.

Input: target = 10, position = [3], speed = [3]
Output: 1

Input: target = 100, position = [0,2,4], speed = [4,2,1]
Output: 1

Constraints:
- n == position.length == speed.length
- 1 <= n <= 10^5
- 0 < target <= 10^6 and 0 < speed[i] <= 10^6
- 0 <= position[i] < target, all positions distinct
```

#### Recognition
**Signals.** "One-lane road" plus "cannot pass" means a car is only ever affected by cars *ahead* of it, which makes position the natural processing order. "Arrive together" plus a fixed `target` means the only quantity that matters per car is its solo arrival time `(target - pos) / speed`; where it is at any intermediate moment is irrelevant. A car merges into the group ahead exactly when its own time is no larger than that group's time, because it would otherwise have overtaken. **Therefore.** Sort by position descending and sweep, counting a new fleet each time a car's time exceeds the largest time seen so far. **Not simulating time steps**, because positions reach `10^6` and the catch-up moment is generally fractional, so no step size is both fast enough and fine enough to avoid missing a merge. **Not sorting by arrival time**, which loses the road order that decides who blocks whom. **O(n log n)** time, **O(n)** space.

#### Explanation
**Brute force.** For each car, check every other car for one ahead that it cannot pass.

```python
def carFleet(target, position, speed):
    n = len(position)
    fleets = 0
    for i in range(n):
        t = (target - position[i]) / speed[i]
        blocked = False
        for j in range(n):
            ahead = position[j] > position[i]
            if ahead and (target - position[j]) / speed[j] >= t:
                blocked = True
        if not blocked:
            fleets += 1
    return fleets
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** The inner loop asks "is any car ahead of me slower to arrive?", which is a maximum over a suffix of the road. It recomputes that maximum from scratch for every car, when a single sweep in road order builds it incrementally.

**Optimal.** Sort the cars by position descending, so each car is visited after everything ahead of it. Keep the arrival time of the frontmost fleet found so far. If the current car's time is greater, nothing ahead can hold it back and it starts a new fleet; if it is less than or equal, it catches that fleet and inherits its time, so nothing is recorded. This is usually written with a stack, but only the top is ever read, so a single running maximum is equivalent and `O(1)` in space. The sort dominates at `O(n log n)`; if positions were already given in order the sweep alone would be `O(n)`.

**Edge cases.** One car is always exactly one fleet. A car that catches another exactly at the target still counts as merged, which is why the comparison is `>` for a new fleet and not `>=`. Float division is safe at these bounds, but comparing `(target - p1) * s2` against `(target - p2) * s1` avoids floats entirely if exactness is questioned.

#### Python

`sorted(zip(position, speed), reverse=True)` pairs and sorts in one expression — tuples sort lexicographically, so position descending is the primary key automatically. Float time is fine here since exact arithmetic isn't required.

```python
def carFleet(target, position, speed):
    pairs = sorted(zip(position, speed), reverse=True)
    stack = []
    for pos, spd in pairs:
        t = (target - pos) / spd
        if not stack or t > stack[-1]:
            stack.append(t)
    return len(stack)
```

#### Java

There's no zip, so pack `position`/`speed` into an `int[][]` and sort it with `Comparator` on the first column descending — `(a, b) -> b[0] - a[0]`. A plain `double[]`-backed count via a running "max time so far" avoids an explicit stack, but a `Deque<Double>` keeps the parallel to the Python.

```java
import java.util.*;

class Solution {
    public int carFleet(int target, int[] position, int[] speed) {
        int n = position.length;
        int[][] cars = new int[n][2];
        for (int i = 0; i < n; i++) {
            cars[i][0] = position[i];
            cars[i][1] = speed[i];
        }
        Arrays.sort(cars, (a, b) -> b[0] - a[0]);
        Deque<Double> stack = new ArrayDeque<>();
        for (int[] c : cars) {
            double t = (double) (target - c[0]) / c[1];
            if (stack.isEmpty() || t > stack.peek()) {
                stack.push(t);
            }
        }
        return stack.size();
    }
}
```

#### Rust

`sort_unstable_by(|a, b| b.0.cmp(&a.0))` sorts descending by position. Float `f64` for time matches the algorithm directly; integer cross-multiply would also work and avoid floats but is less readable.

```rust
fn car_fleet(target: i32, position: Vec<i32>, speed: Vec<i32>) -> i32 {
    let mut pairs: Vec<(i32, i32)> = position.into_iter().zip(speed).collect();
    pairs.sort_unstable_by(|a, b| b.0.cmp(&a.0));
    let mut stack: Vec<f64> = Vec::new();
    for (pos, spd) in pairs {
        let t = (target - pos) as f64 / spd as f64;
        if stack.is_empty() || t > *stack.last().unwrap() {
            stack.push(t);
        }
    }
    stack.len() as i32
}
```

#### Go

Local struct `type car struct{ pos, spd int }` keeps the sort key visible. Pre-1.21 needs `sort.Slice` with a closure; modern Go would use `slices.SortFunc`.

```go
import "sort"

func carFleet(target int, position []int, speed []int) int {
    n := len(position)
    type car struct{ pos, spd int }
    cars := make([]car, n)
    for i := range position {
        cars[i] = car{position[i], speed[i]}
    }
    sort.Slice(cars, func(i, j int) bool { return cars[i].pos > cars[j].pos })
    stack := []float64{}
    for _, c := range cars {
        t := float64(target-c.pos) / float64(c.spd)
        if len(stack) == 0 || t > stack[len(stack)-1] {
            stack = append(stack, t)
        }
    }
    return len(stack)
}
```

#### C++

Structured binding `auto& [pos, spd] : cars` cleans up the range-for. Sorting `std::pair<int,int>` with a custom lambda lets you compare `first` descending without flipping arguments.

```cpp
#include <vector>
#include <algorithm>

int carFleet(int target, std::vector<int>& position, std::vector<int>& speed) {
    int n = position.size();
    std::vector<std::pair<int,int>> cars(n);
    for (int i = 0; i < n; ++i) cars[i] = {position[i], speed[i]};
    std::sort(cars.begin(), cars.end(), [](auto& a, auto& b){ return a.first > b.first; });
    std::vector<double> stack;
    for (auto& [pos, spd] : cars) {
        double t = (double)(target - pos) / spd;
        if (stack.empty() || t > stack.back()) stack.push_back(t);
    }
    return (int)stack.size();
}
```


### 32. Largest Rectangle in Histogram

#### Problem
Given an array of bar heights in a histogram where each bar has width 1, return the area of the largest rectangle that can be formed.

#### Examples

```text
Input: heights = [2,1,5,6,2,3]
Output: 10
Explanation: bars 5 and 6 give height 5 over width 2.

Input: heights = [2,4]
Output: 4

Input: heights = [5,4,3,2,1]
Output: 9
Explanation: height 3 over the first three bars.

Constraints:
- 1 <= heights.length <= 10^5
- 0 <= heights[i] <= 10^4
```

#### Recognition
**Signals.** "Largest rectangle" over bars of width 1 means every candidate rectangle is pinned by a single number, the shortest bar inside it. So each bar anchors exactly one maximal rectangle, stretching left and right until it meets a strictly shorter bar, and the problem reduces to finding "previous smaller" and "next smaller" for every index. That pair of queries is the monotonic-stack fingerprint. **Therefore.** One pass with a stack of `(start, height)` in increasing height order; a shorter incoming bar evicts every taller entry and scores it with the current index as its right boundary. **Not two pointers** as in Container With Most Water: there you may discard the shorter wall because water only needs the two walls, but here every bar between the boundaries caps the height, so a short interior bar invalidates the move. **Not divide and conquer** on the minimum bar, which degrades to `O(n^2)` on an already-sorted histogram unless you bolt on a range-minimum structure. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Fix a left edge, extend right, tracking the running minimum height.

```python
def largestRectangleArea(heights):
    n = len(heights)
    res = 0
    for i in range(n):
        h = heights[i]
        for j in range(i, n):
            h = min(h, heights[j])
            res = max(res, h * (j - i + 1))
    return res
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** The double loop rediscovers, once per left edge, the same fact about each bar: where the first strictly shorter bar to its left and right sits. Those two boundaries are properties of the bar alone, not of the pair, so computing them `n` times is the whole overhead.

**Optimal.** Score each bar once, as the shortest bar in its own rectangle. Push bars while heights rise, keeping the stack in increasing height order. When a shorter bar arrives at index `i`, every taller entry has just met its right boundary, so pop it and score `height * (i - start)`. The incoming bar inherits the `start` of the last entry it evicted, because it can stretch back over everything shorter-than-it just removed. Entries surviving the loop never met a shorter bar on the right, so a second pass scores them out to `n`. Each index is pushed and popped at most once, which is why the nested-looking `while` still totals `O(n)`.

**Edge cases.** A strictly increasing input pops nothing during the loop, so the entire answer comes from the post-loop drain, which is the part that is easy to forget. Equal heights push separate entries rather than popping, and the deeper one carries the earlier `start`, so the full width is still scored. Zero-height bars are legal and simply flush everything taller while contributing area 0.

#### Python

Tuple `(start, height)` on the stack tracks how far left a bar's rectangle can stretch. The post-loop pass over remaining stack entries computes rectangles that extend to the end of the array — easy to forget.

```python
def largestRectangleArea(heights):
    stack = []  # (index, height)
    res = 0
    for i, h in enumerate(heights):
        start = i
        while stack and stack[-1][1] > h:
            idx, ht = stack.pop()
            res = max(res, ht * (i - idx))
            start = idx
        stack.append((start, h))
    for i, h in stack:
        res = max(res, h * (len(heights) - i))
    return res
```

#### Java

An `int[]{start, height}` pair on an `ArrayDeque` avoids boxing while carrying both fields; `peek`/`pop` operate on the head so pushes go to the front. `Math.max` folds the running best.

```java
import java.util.*;

class Solution {
    public int largestRectangleArea(int[] heights) {
        Deque<int[]> stack = new ArrayDeque<>(); // {start, height}
        int res = 0;
        int n = heights.length;
        for (int i = 0; i < n; i++) {
            int start = i;
            while (!stack.isEmpty() && stack.peek()[1] > heights[i]) {
                int[] top = stack.pop();
                res = Math.max(res, top[1] * (i - top[0]));
                start = top[0];
            }
            stack.push(new int[]{start, heights[i]});
        }
        for (int[] p : stack) {
            res = Math.max(res, p[1] * (n - p[0]));
        }
        return res;
    }
}
```

#### Rust

`while let Some(&(idx, ht)) = stack.last()` peeks with destructuring; the explicit `break` ends the inner loop without conditions. The `(i - idx) as i32` cast happens at the multiplication site, not at index time.

```rust
fn largest_rectangle_area(heights: Vec<i32>) -> i32 {
    let mut stack: Vec<(usize, i32)> = Vec::new(); // (start, height)
    let mut res = 0i32;
    let n = heights.len();
    for (i, &h) in heights.iter().enumerate() {
        let mut start = i;
        while let Some(&(idx, ht)) = stack.last() {
            if ht > h {
                stack.pop();
                res = res.max(ht * (i - idx) as i32);
                start = idx;
            } else {
                break;
            }
        }
        stack.push((start, h));
    }
    for (i, h) in stack {
        res = res.max(h * (n - i) as i32);
    }
    res
}
```

#### Go

Named struct `pair{idx, h int}` is clearer than `[2]int`. The two phases (in-loop pops, post-loop drain) are duplicated but readable; could DRY via a helper at the cost of clarity.

```go
func largestRectangleArea(heights []int) int {
    type pair struct{ idx, h int }
    stack := []pair{}
    res := 0
    n := len(heights)
    for i, h := range heights {
        start := i
        for len(stack) > 0 && stack[len(stack)-1].h > h {
            top := stack[len(stack)-1]
            stack = stack[:len(stack)-1]
            area := top.h * (i - top.idx)
            if area > res { res = area }
            start = top.idx
        }
        stack = append(stack, pair{start, h})
    }
    for _, p := range stack {
        area := p.h * (n - p.idx)
        if area > res { res = area }
    }
    return res
}
```

#### C++

Structured binding `auto [idx, ht] = st.top()` is C++17. `std::stack<std::pair<int,int>>` is the natural container choice — adapter over deque, no allocation per element after warm-up.

```cpp
#include <vector>
#include <stack>
#include <algorithm>

int largestRectangleArea(std::vector<int>& heights) {
    std::stack<std::pair<int,int>> st; // (start, height)
    int res = 0;
    int n = heights.size();
    for (int i = 0; i < n; ++i) {
        int start = i;
        while (!st.empty() && st.top().second > heights[i]) {
            auto [idx, ht] = st.top(); st.pop();
            res = std::max(res, ht * (i - idx));
            start = idx;
        }
        st.push({start, heights[i]});
    }
    while (!st.empty()) {
        auto [idx, ht] = st.top(); st.pop();
        res = std::max(res, ht * (n - idx));
    }
    return res;
}
```


### 33. Binary Search

#### Problem
Given a sorted array of integers and a target value, return the index of the target, or -1 if it is not present.

#### Examples

```text
Input: nums = [-1,0,3,5,9,12], target = 9
Output: 4

Input: nums = [-1,0,3,5,9,12], target = 2
Output: -1

Input: nums = [5], target = -5
Output: -1

Constraints:
- 1 <= nums.length <= 10^4
- -10^4 < nums[i], target < 10^4
- nums is sorted ascending, all values distinct
```

#### Recognition
**Signals.** Three phrases decide this before you write anything: "sorted array", "return the index", and an explicit `O(log n)` requirement in the statement. Sorted plus a log-time demand is the halving signal, and "return the index" tells you the array itself is the search space rather than some derived quantity. **Therefore.** The textbook template: hold a closed candidate range `[l, r]`, compare the middle, and discard the half the ordering rules out. **Not a hash map** from value to index, which does answer lookups in `O(1)` but needs an `O(n)` pass and `O(n)` memory to build, so for one query it is strictly worse than an `O(log n)` search that allocates nothing. Build one only if you must answer many queries against the same fixed array. **Not a linear scan**, the `O(n)` baseline that ignores the single structural fact you were handed. **O(log n)** time, **O(1)** space.

#### Explanation
**Brute force.** Walk the array and compare each element.

```python
def search(nums, target):
    for i, n in enumerate(nums):
        if n == target:
            return i
    return -1
```

`O(n)` time, `O(1)` space.

**Wasteful because.** Each comparison throws away everything it just learned. In sorted data, `nums[i] < target` rules out index `i` *and every index left of it* in one shot; the scan uses that comparison to eliminate exactly one candidate.

**Optimal.** Keep `[l, r]` as the closed range that could still hold the target. Compare `nums[m]` at the middle: equal ends it, less means the target sits strictly right of `m` so `l = m + 1`, greater means `r = m - 1`. Every iteration halves the range, so the loop runs at most `ceil(log2 n)` times. The condition is `l <= r`, not `l < r`, because a one-element range is still a live candidate and `<` would skip it. Compute the midpoint as `l + (r - l) // 2` rather than `(l + r) // 2`: in a fixed-width integer language `l + r` can overflow when both indices are large and perfectly valid, whereas `r - l` is bounded by the array length and cannot. Python integers are arbitrary precision so both forms are safe here, but the subtraction form is the habit worth carrying, and it is what the Java, Rust, Go and C++ versions below use.

**Edge cases.** A target below everything drives `r` to `-1` and exits; a target above everything drives `l` past `r`. Both fall out to the same `-1` with no special branch. A single-element array is handled by the `<=`. An empty array would start with `r = -1`, so the loop body never runs, though the constraints here rule it out.

#### Python

Textbook binary search. `(l + r) // 2` is fine because Python ints don't overflow.

```python
def search(nums, target):
    l, r = 0, len(nums) - 1
    while l <= r:
        m = (l + r) // 2
        if nums[m] == target:
            return m
        elif nums[m] < target:
            l = m + 1
        else:
            r = m - 1
    return -1
```

#### Java

`l + (r - l) / 2` is the overflow-safe midpoint — habit worth keeping even though the bounds here never overflow `int`. Pure primitives, so no imports needed.

```java
class Solution {
    public int search(int[] nums, int target) {
        int l = 0, r = nums.length - 1;
        while (l <= r) {
            int m = l + (r - l) / 2;
            if (nums[m] == target) return m;
            else if (nums[m] < target) l = m + 1;
            else r = m - 1;
        }
        return -1;
    }
}
```

#### Rust

`l + (r - l) / 2` is the overflow-safe midpoint formula — habit worth keeping even though `i32` won't overflow here. Casting `nums.len() as i32 - 1` requires the array to be non-empty; an empty slice would underflow `usize` first.

```rust
fn search(nums: Vec<i32>, target: i32) -> i32 {
    let (mut l, mut r) = (0i32, nums.len() as i32 - 1);
    while l <= r {
        let m = l + (r - l) / 2;
        if nums[m as usize] == target {
            return m;
        } else if nums[m as usize] < target {
            l = m + 1;
        } else {
            r = m - 1;
        }
    }
    -1
}
```

#### Go

Same overflow-safe midpoint. Go has no `Vec`/`Vec`-like generic — plain int indices work because `len()` returns `int`.

```go
func search(nums []int, target int) int {
    l, r := 0, len(nums)-1
    for l <= r {
        m := l + (r-l)/2
        if nums[m] == target {
            return m
        } else if nums[m] < target {
            l = m + 1
        } else {
            r = m - 1
        }
    }
    return -1
}
```

#### C++

Identical shape to Rust/Go; `(int)nums.size() - 1` cast guards against unsigned-to-signed comparison oddness when the array is empty.

```cpp
#include <vector>

int search(std::vector<int>& nums, int target) {
    int l = 0, r = (int)nums.size() - 1;
    while (l <= r) {
        int m = l + (r - l) / 2;
        if (nums[m] == target) return m;
        else if (nums[m] < target) l = m + 1;
        else r = m - 1;
    }
    return -1;
}
```


### 34. Search a 2D Matrix

#### Problem
Given an `m x n` matrix where each row is sorted left-to-right and the first integer of each row is greater than the last of the previous row, determine if a target value exists in the matrix.

#### Examples

```text
Input: matrix = [[1,3,5,7],[10,11,16,20],[23,30,34,60]],
target = 3
Output: true

Input: matrix = [[1,3,5,7],[10,11,16,20],[23,30,34,60]],
target = 13
Output: false

Input: matrix = [[1]], target = 1
Output: true

Constraints:
- m == matrix.length, n == matrix[0].length
- 1 <= m, n <= 100
- -10^4 <= matrix[i][j], target <= 10^4
- each row starts above the previous row's last value
```

#### Recognition
**Signals.** Two clauses, and the second is the whole problem. "Each row is sorted left to right" alone would only let you search within a row. "The first integer of each row is greater than the last of the previous row" says the rows concatenate into one globally sorted sequence, so the grid is a flat sorted array wearing a 2D shape. Sorted input plus a yes/no membership question is binary search. **Therefore.** Binary search the range `[0, m * n - 1]` and decode each probe with `matrix[mid // n][mid % n]`. **Not the staircase walk from the top-right corner**, the standard trick for a matrix that is only sorted per row and per column; it is `O(m + n)` and throws away the stronger guarantee you were given here. **Not searching row by row**: binary searching every row is `O(m log n)`, and locating the row first then searching it is `O(m + log n)`, both beaten by the single flat search. **O(log(m * n))** time, **O(1)** space.

#### Explanation
**Brute force.** Look at every cell.

```python
def searchMatrix(matrix, target):
    for row in matrix:
        for v in row:
            if v == target:
                return True
    return False
```

`O(m * n)` time, `O(1)` space.

**Wasteful because.** Every comparison is used only to reject one cell, when a comparison against a sorted sequence rejects half of what remains. At 100 by 100 that is 10000 probes instead of 14.

**Optimal.** Treat the matrix as the array it already is. Binary search over flat indices `0` to `m * n - 1`, converting a probe with `row = mid // n` and `col = mid % n`, since row `r` occupies flat indices `r * n` through `r * n + n - 1`. The comparison logic is then the ordinary one: equal means found, smaller means move `l` right, larger means move `r` left. Two-step alternatives are worth pricing: scanning the first column for the right row and then binary searching it is `O(m + log n)`, and binary searching each row in turn is `O(m log n)`. Only binary searching for the row as well, at `O(log m + log n)`, matches the flat search, and it costs two loops plus a boundary rule for which row a value belongs to, so the flat version is the one to write under time pressure.

**Edge cases.** A `1 x 1` matrix works unchanged, with `l == r == 0` on the first probe. A target below `matrix[0][0]` or above the last element exits with `l > r` and returns false. Guard for an empty matrix or an empty first row before reading `matrix[0][0]` if the constraints do not rule it out.

#### Python

Flat binary search with `mid // n` and `mid % n` for row/col — no nested search. Python's arbitrary-precision ints make `m * n - 1` overflow-safe even for huge matrices.

```python
def searchMatrix(matrix, target):
    m, n = len(matrix), len(matrix[0])
    l, r = 0, m * n - 1
    while l <= r:
        mid = (l + r) // 2
        val = matrix[mid // n][mid % n]
        if val == target:
            return True
        elif val < target:
            l = mid + 1
        else:
            r = mid - 1
    return False
```

#### Java

`mid / n` and `mid % n` decompose the flat index into row/col — no nested search. Keeping `mid` an `int` makes the `r = mid - 1` decrement safe at zero.

```java
class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int m = matrix.length, n = matrix[0].length;
        int l = 0, r = m * n - 1;
        while (l <= r) {
            int mid = l + (r - l) / 2;
            int val = matrix[mid / n][mid % n];
            if (val == target) return true;
            else if (val < target) l = mid + 1;
            else r = mid - 1;
        }
        return false;
    }
}
```

#### Rust

`(mid as usize) / n` casts only at the index site. The `i32` `mid` lets the loop go negative without underflow when shrinking past zero.

```rust
fn search_matrix(matrix: Vec<Vec<i32>>, target: i32) -> bool {
    let m = matrix.len();
    let n = matrix[0].len();
    let (mut l, mut r) = (0i32, (m * n) as i32 - 1);
    while l <= r {
        let mid = l + (r - l) / 2;
        let val = matrix[(mid as usize) / n][(mid as usize) % n];
        if val == target { return true; }
        else if val < target { l = mid + 1; }
        else { r = mid - 1; }
    }
    false
}
```

#### Go

Identical to Python in structure — `mid/n` and `mid%n` decompose the flat index. Go's `int` is 64-bit, no overflow concern.

```go
func searchMatrix(matrix [][]int, target int) bool {
    m, n := len(matrix), len(matrix[0])
    l, r := 0, m*n-1
    for l <= r {
        mid := l + (r-l)/2
        val := matrix[mid/n][mid%n]
        if val == target {
            return true
        } else if val < target {
            l = mid + 1
        } else {
            r = mid - 1
        }
    }
    return false
}
```

#### C++

Same flat-index trick. The `int` casts keep `mid` signed so the `r = mid - 1` decrement is safe at zero.

```cpp
#include <vector>

bool searchMatrix(std::vector<std::vector<int>>& matrix, int target) {
    int m = matrix.size(), n = matrix[0].size();
    int l = 0, r = m * n - 1;
    while (l <= r) {
        int mid = l + (r - l) / 2;
        int val = matrix[mid / n][mid % n];
        if (val == target) return true;
        else if (val < target) l = mid + 1;
        else r = mid - 1;
    }
    return false;
}
```


### 35. Koko Eating Bananas

#### Problem
Given `n` piles of bananas and `h` hours, find the minimum eating speed `k` (bananas per hour) such that Koko can eat all bananas within `h` hours, eating at most one pile per hour.

#### Examples

```text
Input: piles = [3,6,7,11], h = 8
Output: 4

Input: piles = [30,11,23,4,20], h = 5
Output: 30
Explanation: h equals the pile count, so one pile per
hour, so k must reach the largest pile.

Input: piles = [1,4,3,2], h = 9
Output: 2
Explanation: speed 1 needs 10 hours; speed 2 needs 6.

Constraints:
- 1 <= piles.length <= 10^4
- piles.length <= h <= 10^9
- 1 <= piles[i] <= 10^9
```

#### Recognition
**Signals.** The array is never sorted and sorting it would change nothing, since the total hours sums over all piles regardless of order. The ask is "the **minimum** `k` such that" a condition holds, and the bounds pair a tiny `n` (`10^4`) with an enormous value range (`piles[i]` up to `10^9`). A "minimum such that" objective over a huge numeric range, with a check that is cheap to run for any single candidate, is the binary-search-on-the-answer fingerprint: the thing with sorted structure is the answer axis, not the input. **Therefore.** Search `k` over `[1, max(piles)]` under the predicate `can_finish(k) = sum(ceil(p / k)) <= h`, which is monotone because a faster Koko is never slower. **Not a linear scan over candidate speeds**, which is correct but tests `k = 1, 2, 3, ...` up toward `10^9` where 30 probes suffice. Writing `m` for `max(piles)`: **O(n log m)** time, **O(1)** space.

#### Explanation
**Brute force.** Try every speed from 1 upward and return the first that fits.

```python
def minEatingSpeed(piles, h):
    for k in range(1, max(piles) + 1):
        hours = 0
        for p in piles:
            hours += (p + k - 1) // k
        if hours <= h:
            return k
```

`O(n * m)` time, `O(1)` space, with `m = max(piles)`.

**Wasteful because.** Every failed candidate costs a full `O(n)` pass to learn one bit, "too slow", and that bit was already implied by the previous failure. The predicate is monotone: once a speed finishes in time, so does every larger speed, so the sequence of answers is `False, False, ..., False, True, True, ...`.

**Optimal.** That shape is a sorted boolean array, so binary search it. The recognition leap is that you are not searching `piles`, you are searching the answer axis `[1, max(piles)]`, where speed 1 is the slowest legal speed and `max(piles)` always works whenever `h >= len(piles)`. Each probe evaluates the predicate in one `O(n)` pass, and the range collapses in about `log2(10^9)`, roughly 30 probes. Use `while l < r` with `r = m` on success and `l = m + 1` on failure: that converges on the *smallest* feasible speed rather than any feasible one, and on exit `l == r` is the answer. Write `ceil(p / k)` as `(p + k - 1) // k` to stay in integers, since float division loses precision at `10^9`.

**Edge cases.** A feasible speed always exists inside the range, so no not-found branch is needed. When `h` equals the pile count every pile gets exactly one hour and the answer is `max(piles)`, the top of the range. `k` starts at 1, never 0, so nothing divides by zero. A single huge pile with a huge `h` collapses to speed 1 on the first probes.

#### Python

`(p + m - 1) // m` is the integer ceiling formula — avoids floats. The shrink-right-on-feasible / advance-left-on-infeasible pattern converges to the minimum valid speed.

```python
def minEatingSpeed(piles, h):
    l, r = 1, max(piles)
    while l < r:
        m = (l + r) // 2
        if sum((p + m - 1) // m for p in piles) <= h:
            r = m
        else:
            l = m + 1
    return l
```

#### Java

Binary-search the answer in `[1, max(piles)]`; `(p + m - 1) / m` is integer-ceiling without floats. Accumulate `hours` in a `long` so the sum can't overflow `int` when speeds are small and piles large.

```java
class Solution {
    public int minEatingSpeed(int[] piles, int h) {
        int l = 1, r = 0;
        for (int p : piles) r = Math.max(r, p);
        while (l < r) {
            int m = l + (r - l) / 2;
            long hours = 0;
            for (int p : piles) hours += (p + m - 1) / m;
            if (hours <= h) r = m;
            else l = m + 1;
        }
        return l;
    }
}
```

#### Rust

`.iter().map(...).sum::<i32>()` — turbofish or annotated `let hours: i32` is needed because `sum` is generic. Same ceiling trick as Python.

```rust
fn min_eating_speed(piles: Vec<i32>, h: i32) -> i32 {
    let mut l = 1i32;
    let mut r = *piles.iter().max().unwrap();
    while l < r {
        let m = l + (r - l) / 2;
        let hours: i32 = piles.iter().map(|&p| (p + m - 1) / m).sum();
        if hours <= h { r = m; } else { l = m + 1; }
    }
    l
}
```

#### Go

Inlined max-find at the start instead of a helper. Otherwise reads exactly like the Python form — the algorithm shape dominates.

```go
func minEatingSpeed(piles []int, h int) int {
    l, r := 1, 0
    for _, p := range piles {
        if p > r { r = p }
    }
    for l < r {
        m := l + (r-l)/2
        hours := 0
        for _, p := range piles {
            hours += (p + m - 1) / m
        }
        if hours <= h {
            r = m
        } else {
            l = m + 1
        }
    }
    return l
}
```

#### C++

`*std::max_element(...)` for the upper bound. `long long hours` defends against the sum overflowing `int` when piles are large and speed is small.

```cpp
#include <vector>
#include <algorithm>
#include <numeric>

int minEatingSpeed(std::vector<int>& piles, int h) {
    int l = 1, r = *std::max_element(piles.begin(), piles.end());
    while (l < r) {
        int m = l + (r - l) / 2;
        long long hours = 0;
        for (int p : piles) hours += (p + m - 1) / m;
        if (hours <= h) r = m;
        else l = m + 1;
    }
    return l;
}
```


### 36. Find Minimum in Rotated Sorted Array

#### Problem
Given a sorted array of unique integers that has been rotated between 1 and n times, find the minimum element in `O(log n)` time.

#### Examples

```text
Input: nums = [3,4,5,1,2]
Output: 1
Explanation: the original array was [1,2,3,4,5], rotated 3 times.

Input: nums = [4,5,6,7,0,1,2]
Output: 0

Input: nums = [11,13,15,17]
Output: 11
Explanation: rotated n times, so it is back in sorted order.

Constraints:
- n == nums.length
- 1 <= n <= 5000
- -5000 <= nums[i] <= 5000
- all values are unique and the array was originally sorted
```

#### Recognition
**Signals.** "In `O(log n)` time" is stated outright, and on an array that only ever means binary search. The obstacle is that there is no target to compare against, so the deciding comparison has to be between two elements of the array itself. "Sorted then rotated" tells you the array is two sorted runs and every element of the left run is greater than every element of the right run, so a single probe against the right end says which run you are in: `nums[mid] > nums[r]` puts `mid` in the high run, and the minimum starts the other one. **Therefore.** Binary search with `l = mid + 1` when `nums[mid] > nums[r]` and `r = mid` otherwise, converging on the drop. **Not comparing `nums[mid]` to `nums[l]`**, because in an unrotated array that test is true at every step and walks you rightward past the answer unless you bolt on an extra `nums[l] < nums[r]` early exit. **O(log n)** time, **O(1)** space.

#### Explanation
**Brute force.** Scan for the smallest value.

```python
def findMin(nums):
    best = nums[0]
    for v in nums:
        if v < best:
            best = v
    return best
```

`O(n)` time, `O(1)` space.

**Wasteful because.** The scan treats the input as unordered and spends `n` comparisons, when the array is two sorted runs and one comparison classifies which run the midpoint lies in, discarding half the remaining range.

**Optimal.** Compare `nums[mid]` to `nums[r]`, the current right end. If `nums[mid] > nums[r]`, then `mid` sits in the high run and the wrap point is strictly after it, so `l = mid + 1`. Otherwise `mid` is already in the low run and may itself be the minimum, so `r = mid` and never `mid - 1`. The loop uses strict `l < r` and stops with `l == r` on the answer, which is why no candidate is tracked separately. The right end is the correct pivot because `nums[mid] <= nums[r]` means "sorted from here to the end" in both the rotated and unrotated cases, whereas `nums[l]` cannot distinguish them. With duplicates allowed, as in the follow-up problem, `nums[mid] == nums[r]` carries no information and you fall back to `r -= 1`, degrading to `O(n)` worst case.

**Edge cases.** A single element returns immediately since `l < r` is false at entry. An array rotated a full `n` times is plain sorted, and the first probe sends `r` leftward, ending at index 0. `mid` computed as `l + (r - l) // 2` biases low, which is what keeps `r = mid` from stalling when `r == l + 1`.

#### Python

Comparing `nums[m]` to `nums[r]` (not `nums[l]`) is the canonical form because the right side is unambiguous about which half contains the pivot. `l < r` (strict) means the loop ends with `l == r` pointing at the answer.

```python
def findMin(nums):
    l, r = 0, len(nums) - 1
    while l < r:
        m = (l + r) // 2
        if nums[m] > nums[r]:
            l = m + 1
        else:
            r = m
    return nums[l]
```

#### Java

Comparing `nums[m]` to `nums[r]` (not `nums[l]`) is the canonical form — the right side is unambiguous about which half holds the pivot. Strict `l < r` ends with `l == r` pointing at the minimum.

```java
class Solution {
    public int findMin(int[] nums) {
        int l = 0, r = nums.length - 1;
        while (l < r) {
            int m = l + (r - l) / 2;
            if (nums[m] > nums[r]) l = m + 1;
            else r = m;
        }
        return nums[l];
    }
}
```

#### Rust

`usize` for indices works here because we never decrement past zero. The structural form is identical to Python.

```rust
fn find_min(nums: Vec<i32>) -> i32 {
    let (mut l, mut r) = (0usize, nums.len() - 1);
    while l < r {
        let m = l + (r - l) / 2;
        if nums[m] > nums[r] { l = m + 1; } else { r = m; }
    }
    nums[l]
}
```

#### Go

Plain int indices. The loop condition `l < r` (strict) is essential — `l <= r` would loop forever once they meet.

```go
func findMin(nums []int) int {
    l, r := 0, len(nums)-1
    for l < r {
        m := l + (r-l)/2
        if nums[m] > nums[r] {
            l = m + 1
        } else {
            r = m
        }
    }
    return nums[l]
}
```

#### C++

Same structure as Go and Rust. The brevity of the body (one if-else) is unusual for C++ binary search — most variants are more complex.

```cpp
#include <vector>

int findMin(std::vector<int>& nums) {
    int l = 0, r = (int)nums.size() - 1;
    while (l < r) {
        int m = l + (r - l) / 2;
        if (nums[m] > nums[r]) l = m + 1;
        else r = m;
    }
    return nums[l];
}
```


### 37. Search in Rotated Sorted Array

#### Problem
Given a sorted array of unique integers rotated at an unknown pivot, search for a target and return its index, or -1 if not found, in `O(log n)` time.

#### Examples

```text
Input: nums = [4,5,6,7,0,1,2], target = 0
Output: 4

Input: nums = [4,5,6,7,0,1,2], target = 3
Output: -1

Input: nums = [1], target = 0
Output: -1

Constraints:
- 1 <= nums.length <= 5000
- -10^4 <= nums[i], target <= 10^4
- all values are distinct
- nums is an ascending array rotated once
```

#### Recognition
**Signals.** "Sorted" and "rotated at an unknown pivot" together say the order is broken in exactly one place, not scrambled. The statement then demands `O(log n)` outright, which forbids both the scan and any pass that rebuilds the ordering. One break point plus a halving requirement is the whole setup: wherever you cut, the pivot lands on one side only, so the other side is a clean ascending run whose endpoints you can read off directly. **Therefore.** Binary search, but each step first identifies the sorted half with a single comparison of `nums[l]` to `nums[m]`, then tests whether the target lies inside that half's known range, going there or into its complement. **Not a plain binary search**, which assumes global order and fails concretely: on `[4,5,6,7,0,1,2]` with `target = 1`, the middle is `7 > 1` so it turns left and never reaches the `1`. **O(log n)** time, **O(1)** space.

#### Explanation
**Brute force.** Ignore the ordering and scan.

```python
def search(nums, target):
    for i, n in enumerate(nums):
        if n == target:
            return i
    return -1
```

`O(n)` time, `O(1)` space.

**Wasteful because.** Each comparison eliminates one index. Rotation looks like it destroys the order that would let a comparison eliminate half, but it only moves the break to a single point, so nearly all of that order survives and the scan discards it.

**Optimal.** Cut anywhere at `m`. The pivot, the one place where the order breaks, lies on exactly one side of the cut, so the other side is a clean ascending run. Which one costs a single comparison: if `nums[l] <= nums[m]` the left side never wrapped, so `[l, m]` is sorted; otherwise `[m, r]` is. Because you know both endpoints of the sorted side, `nums[l] <= target < nums[m]` settles membership exactly. If the target is inside, recurse into that side; if not, it can only be in the other one. Either branch halves the range, so the log-time bound survives the broken total order. The comparison is `<=` rather than `<` so that `l == m`, a one-element left half, counts as sorted.

**Edge cases.** A rotation of zero leaves the array plainly sorted, `nums[l] <= nums[m]` is always true, and the code degrades into an ordinary binary search. A single element is decided by the first comparison. Duplicates would break the invariant, since `nums[l] == nums[m]` no longer proves the left is sorted, and force an `O(n)` worst case; this problem guarantees distinct values, LeetCode 81 does not.

#### Python

Chained comparison `nums[l] <= target < nums[m]` is the Python-only readability win — other languages need explicit `&&`. The 'which half is sorted' insight is what makes the two cases clean.

```python
def search(nums, target):
    l, r = 0, len(nums) - 1
    while l <= r:
        m = (l + r) // 2
        if nums[m] == target:
            return m
        if nums[l] <= nums[m]:
            if nums[l] <= target < nums[m]:
                r = m - 1
            else:
                l = m + 1
        else:
            if nums[m] < target <= nums[r]:
                l = m + 1
            else:
                r = m - 1
    return -1
```

#### Java

No chained comparisons, so the range checks spell out `&&` explicitly. The two-case split on `nums[l] <= nums[m]` (which half is sorted) is the whole trick and reads the same as C++.

```java
class Solution {
    public int search(int[] nums, int target) {
        int l = 0, r = nums.length - 1;
        while (l <= r) {
            int m = l + (r - l) / 2;
            if (nums[m] == target) return m;
            if (nums[l] <= nums[m]) {
                if (nums[l] <= target && target < nums[m]) r = m - 1;
                else l = m + 1;
            } else {
                if (nums[m] < target && target <= nums[r]) l = m + 1;
                else r = m - 1;
            }
        }
        return -1;
    }
}
```

#### Rust

`as usize` casts everywhere because indices must be unsigned but the loop variables stay signed for `r - 1` safety. Verbose but explicit.

```rust
fn search(nums: Vec<i32>, target: i32) -> i32 {
    let (mut l, mut r) = (0i32, nums.len() as i32 - 1);
    while l <= r {
        let m = l + (r - l) / 2;
        if nums[m as usize] == target { return m; }
        if nums[l as usize] <= nums[m as usize] {
            if nums[l as usize] <= target && target < nums[m as usize] {
                r = m - 1;
            } else {
                l = m + 1;
            }
        } else {
            if nums[m as usize] < target && target <= nums[r as usize] {
                l = m + 1;
            } else {
                r = m - 1;
            }
        }
    }
    -1
}
```

#### Go

Explicit `&&` for the range check; reads almost identically to the C++ form. Pre-1.21, no generics to abstract over the index type.

```go
func search(nums []int, target int) int {
    l, r := 0, len(nums)-1
    for l <= r {
        m := l + (r-l)/2
        if nums[m] == target { return m }
        if nums[l] <= nums[m] {
            if nums[l] <= target && target < nums[m] {
                r = m - 1
            } else {
                l = m + 1
            }
        } else {
            if nums[m] < target && target <= nums[r] {
                l = m + 1
            } else {
                r = m - 1
            }
        }
    }
    return -1
}
```

#### C++

Range checks use `&&`. The two-case structure (`if (nums[l] <= nums[m])` else) is the heart of the algorithm and language-independent.

```cpp
#include <vector>

int search(std::vector<int>& nums, int target) {
    int l = 0, r = (int)nums.size() - 1;
    while (l <= r) {
        int m = l + (r - l) / 2;
        if (nums[m] == target) return m;
        if (nums[l] <= nums[m]) {
            if (nums[l] <= target && target < nums[m]) r = m - 1;
            else l = m + 1;
        } else {
            if (nums[m] < target && target <= nums[r]) l = m + 1;
            else r = m - 1;
        }
    }
    return -1;
}
```


### 38. Time Based Key-Value Store

#### Problem
Design a key-value store supporting `set(key, value, timestamp)` and `get(key, timestamp)`, where `get` returns the value with the largest timestamp less than or equal to the given timestamp, or `""` if none exists.

#### Examples

```text
Input: ["TimeMap","set","get","get","set","get","get"],
[[],["foo","bar",1],["foo",1],["foo",3],
["foo","bar2",4],["foo",4],["foo",5]]
Output: [null,null,"bar","bar",null,"bar2","bar2"]
Explanation: get("foo",3) finds no write at 3, so it falls
  back to the newest write at or below 3, which is "bar".

Input: ["TimeMap","get","set","get"],
[[],["a",1],["a","x",5],["a",1]]
Output: [null,"",null,""]

Input: ["TimeMap","set","set","get","get"],
[[],["a","one",1],["b","two",2],["a",1],["b",1]]
Output: [null,null,null,"one",""]

Constraints:
- 1 <= key.length, value.length <= 100
- 1 <= timestamp <= 10^7
- up to 2 * 10^5 calls to set and get combined
- per key, timestamps are strictly increasing
```

#### Recognition
**Signals.** "The largest timestamp less than or equal to the given timestamp" is a predecessor query, not an equality lookup, so the word "key-value store" is a trap: a hash map answers "is this exact pair present" and the query almost never lands on a timestamp anyone wrote. The second signal is buried in the constraints: writes for a given key arrive with strictly increasing timestamps, which hands you a sorted array per key for free, with no sorting cost. Sorted plus "rightmost element at or below `x`" is binary search. **Therefore.** A hash map from key to an append-only list of `(timestamp, value)`, and a binary search of that list per `get`. **Not one flat log scanned per query**, because 2 * 10^5 calls against a log that grows to 2 * 10^5 entries is 10^10 comparisons, and each scan re-applies two filters, key match and timestamp bound, that the bucketing and the sort order remove permanently. Each `set` is `O(1)`. **O(log n)** time, **O(n)** space.

#### Explanation
**Brute force.** One flat list of every write, rescanned on each `get`.

```python
class TimeMap:
    def __init__(self):
        self.log = []

    def set(self, key, value, timestamp):
        self.log.append((key, timestamp, value))

    def get(self, key, timestamp):
        best, out = -1, ""
        for k, ts, v in self.log:
            if k == key and ts <= timestamp and ts > best:
                best, out = ts, v
        return out
```

`O(w)` time per `get` for `w` writes, `O(w)` space.

**Wasteful because.** Every `get` re-reads every write ever made, including all the entries belonging to other keys and all the entries too new to qualify. Both of those tests have answers that never change once a write lands, so the scan is re-deriving the same two facts on every call.

**Optimal.** Remove each filter with the structure that makes it free. Bucketing by key in a hash map means the key test is answered once, at insert time. Within a bucket, the guarantee that timestamps arrive increasing means the list is already sorted, so the timestamp test becomes monotone: everything left of the answer qualifies, everything right of it does not, which is exactly the precondition binary search needs. The loop keeps `res` as "best value found so far at or below the query"; on `vals[m][0] <= timestamp` the entry qualifies and a better one can only be further right, so record it and set `l = m + 1`; otherwise everything from `m` rightwards is too new and `r = m - 1`. `bisect_right` over a parallel list of timestamps does the same thing in one line when you are not being asked to show the search.

**Edge cases.** A key never written gives an empty list, the loop body never runs, and `""` comes back. A query below every timestamp for that key drives `r` to `-1` without ever recording, also `""`. An exact timestamp hit is accepted by the `<=` and the remaining right half is empty.

#### Python

Track `res` inside the loop as 'best valid so far' — when you find a `vals[m][0] <= timestamp`, record the value and search right for a more recent one. `setdefault`-free version uses explicit `if key not in self.store` for clarity.

```python
class TimeMap:
    def __init__(self):
        self.store = {}

    def set(self, key, value, timestamp):
        if key not in self.store:
            self.store[key] = []
        self.store[key].append((timestamp, value))

    def get(self, key, timestamp):
        vals = self.store.get(key, [])
        l, r = 0, len(vals) - 1
        res = ""
        while l <= r:
            m = (l + r) // 2
            if vals[m][0] <= timestamp:
                res = vals[m][1]
                l = m + 1
            else:
                r = m - 1
        return res
```

#### Java

`computeIfAbsent` folds the missing-key check into the `set` append in one line. Store `String[]{value}` alongside the timestamp via a `List<int[]>`-style pairing — here a `List<Object[]>` would box; cleaner is a small record-like `String[]` keyed list, but two parallel structures per key keep it primitive-friendly.

```java
import java.util.*;

class TimeMap {
    private Map<String, List<Object[]>> store = new HashMap<>();

    public TimeMap() {}

    public void set(String key, String value, int timestamp) {
        store.computeIfAbsent(key, k -> new ArrayList<>())
             .add(new Object[]{timestamp, value});
    }

    public String get(String key, int timestamp) {
        List<Object[]> vals = store.getOrDefault(key, Collections.emptyList());
        int l = 0, r = vals.size() - 1;
        String res = "";
        while (l <= r) {
            int m = l + (r - l) / 2;
            int ts = (int) vals.get(m)[0];
            if (ts <= timestamp) {
                res = (String) vals.get(m)[1];
                l = m + 1;
            } else {
                r = m - 1;
            }
        }
        return res;
    }
}
```

#### Rust

Returning `String::new()` (rather than `Option`) matches the problem's contract. `clone()` on the candidate `String` is needed because we hand back an owned value; could be avoided by returning `&str` if the API allowed it.

```rust
use std::collections::HashMap;

struct TimeMap {
    store: HashMap<String, Vec<(i32, String)>>,
}

impl TimeMap {
    fn new() -> Self { TimeMap { store: HashMap::new() } }

    fn set(&mut self, key: String, value: String, timestamp: i32) {
        self.store.entry(key).or_default().push((timestamp, value));
    }

    fn get(&self, key: String, timestamp: i32) -> String {
        let vals = match self.store.get(&key) {
            Some(v) => v,
            None => return String::new(),
        };
        let (mut l, mut r) = (0i32, vals.len() as i32 - 1);
        let mut res = String::new();
        while l <= r {
            let m = l + (r - l) / 2;
            if vals[m as usize].0 <= timestamp {
                res = vals[m as usize].1.clone();
                l = m + 1;
            } else {
                r = m - 1;
            }
        }
        res
    }
}
```

#### Go

Anonymous struct fields inline (`struct{ ts int; val string }`) keep the type local. Reading a missing key returns the zero-value slice, so the empty-check is implicit.

```go
type TimeMap struct {
    store map[string][]struct {
        ts  int
        val string
    }
}

func Constructor() TimeMap { return TimeMap{store: make(map[string][]struct{ ts int; val string })} }

func (t *TimeMap) Set(key string, value string, timestamp int) {
    t.store[key] = append(t.store[key], struct{ ts int; val string }{timestamp, value})
}

func (t *TimeMap) Get(key string, timestamp int) string {
    vals := t.store[key]
    l, r := 0, len(vals)-1
    res := ""
    for l <= r {
        m := l + (r-l)/2
        if vals[m].ts <= timestamp {
            res = vals[m].val
            l = m + 1
        } else {
            r = m - 1
        }
    }
    return res
}
```

#### C++

`unordered_map<string, vector<pair<int,string>>>` — verbose but the structure is obvious. `auto& vals = it->second` binds a reference so we don't copy the vector.

```cpp
#include <unordered_map>
#include <vector>
#include <string>

class TimeMap {
    std::unordered_map<std::string, std::vector<std::pair<int,std::string>>> store;
public:
    void set(std::string key, std::string value, int timestamp) {
        store[key].push_back({timestamp, value});
    }
    std::string get(std::string key, int timestamp) {
        auto it = store.find(key);
        if (it == store.end()) return "";
        auto& vals = it->second;
        int l = 0, r = (int)vals.size() - 1;
        std::string res;
        while (l <= r) {
            int m = l + (r - l) / 2;
            if (vals[m].first <= timestamp) { res = vals[m].second; l = m + 1; }
            else r = m - 1;
        }
        return res;
    }
};
```


### 39. Reverse Linked List

#### Problem
Given the head of a singly linked list, reverse it in-place and return the new head.

#### Examples

```text
Input: head = [1,2,3,4,5]
Output: [5,4,3,2,1]

Input: head = [1,2]
Output: [2,1]

Input: head = [1]
Output: [1]

Constraints:
- 0 <= number of nodes <= 5000
- -5000 <= Node.val <= 5000
- must run in O(1) extra space
```

#### Recognition
**Signals.** The input is a `head` pointer, not an array, so there is no random access and no index arithmetic available. "Return the new head" says the head moves, so the caller's handle becomes the tail and you cannot keep using it. The classic follow-up asking for both an iterative and a recursive version is the tell that the interviewer cares about stack space, not elegance. **Therefore.** Three-pointer in-place reversal: `prev` starts at `None`, and for each node you save `nxt = curr.next` *before* writing `curr.next = prev`, then advance both. **Not copying the values into a list** and writing them back reversed, which is `O(n)` extra space and sidesteps the pointer surgery the question exists to test. **Not the recursive version** as your only answer, since it costs `O(n)` stack frames to do what one loop does in `O(1)`. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Copy the values out, then write them back in reverse.

```python
def reverseList(head):
    vals = []
    node = head
    while node:
        vals.append(node.val)
        node = node.next
    node = head
    for v in reversed(vals):
        node.val = v
        node = node.next
    return head
```

`O(n)` time, `O(n)` space.

**Wasteful because.** The list already holds every value; only the arrows point the wrong way. Moving `n` integers through a buffer to avoid rewriting `n` pointers is the same amount of work plus the buffer.

**Optimal.** Reverse the arrows in place. Walk `curr` down the list while `prev` holds the head of the already-reversed prefix, starting at `None` so the original head naturally ends up as the new tail with a null `next`. The one ordering rule that matters: `curr.next` is your only route to the unvisited remainder, so save it in `nxt` before overwriting it with `prev`. Swap those two lines and the rest of the list becomes unreachable, which is the bug this problem is really testing for. Then advance `prev = curr` and `curr = nxt`. When `curr` reaches `None` every node has been rewired and `prev` is the new head.

**Edge cases.** An empty list runs the loop zero times and returns `prev`, which is already `None`, so no guard clause is needed. A single node runs once, sets its `next` to `None`, and returns the same node. The old head becoming a proper tail comes free from initialising `prev` to `None` rather than to `head`.

#### Python

Three pointers, no special cases. `prev` starts as `None` so the original head naturally becomes the new tail.

```python
def reverseList(head):
    prev, curr = None, head
    while curr:
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt
    return prev
```

#### Java

Standard three-pointer reversal; `prev` starts `null` so the original head becomes the new tail. Assumes the LeetCode `ListNode` definition — don't redeclare it.

```java
class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode prev = null, curr = head;
        while (curr != null) {
            ListNode nxt = curr.next;
            curr.next = prev;
            prev = curr;
            curr = nxt;
        }
        return prev;
    }
}
```

#### Rust

`node.next.take()` is the key move: it swaps `next` with `None`, transferring ownership of the rest of the list to `head`. Without `take`, the borrow checker would block reassignment of `node.next`.

```rust
#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}

fn reverse_list(mut head: Option<Box<ListNode>>) -> Option<Box<ListNode>> {
    let mut prev = None;
    while let Some(mut node) = head {
        head = node.next.take();
        node.next = prev;
        prev = Some(node);
    }
    prev
}
```

#### Go

`var prev *ListNode` defaults to `nil` — Go's zero-value gives us the initial state for free. Otherwise identical to the Python form.

```go
type ListNode struct {
    Val  int
    Next *ListNode
}

func reverseList(head *ListNode) *ListNode {
    var prev *ListNode
    curr := head
    for curr != nil {
        nxt := curr.Next
        curr.Next = prev
        prev = curr
        curr = nxt
    }
    return prev
}
```

#### C++

Raw `ListNode*` makes the pointer dance explicit. No memory management concerns here since we're rewiring existing nodes.

```cpp
struct ListNode {
    int val;
    ListNode* next;
    ListNode(int v = 0, ListNode* n = nullptr) : val(v), next(n) {}
};

ListNode* reverseList(ListNode* head) {
    ListNode* prev = nullptr;
    ListNode* curr = head;
    while (curr) {
        ListNode* nxt = curr->next;
        curr->next = prev;
        prev = curr;
        curr = nxt;
    }
    return prev;
}
```


### 40. Merge Two Sorted Lists

#### Problem
Given the heads of two sorted linked lists, merge them into a single sorted linked list and return its head.

#### Examples

```text
Input: l1 = [1,2,4], l2 = [1,3,4]
Output: [1,1,2,3,4,4]

Input: l1 = [], l2 = [0]
Output: [0]

Input: l1 = [5], l2 = [1,2,3]
Output: [1,2,3,5]

Constraints:
- 0 <= length of each list <= 50
- -100 <= node value <= 100
- both lists are already sorted non-decreasing
```

#### Recognition
**Signals.** "The heads of two *sorted* linked lists" plus "return its head" gives you three tells. The inputs are already ordered, so no two elements of the same list ever need comparing. The output is a list of nodes, not values, so you can relink what you were handed instead of allocating anything. And the returned head may come from either input, which is the standard cue for a dummy sentinel. **Therefore.** Walk both lists with a tail pointer, always splicing on whichever front node is smaller, then attach the surviving remainder in one move. **Not concatenate and sort**, which throws away the ordering you were given and pays `O((n + m) log(n + m))` to rediscover it, plus a full second copy. **Not a min-heap**, which is correct but pointless at `k = 2`: a heap of two items is a single comparison wearing a costume. **O(n + m)** time, **O(1)** space.

#### Explanation
**Brute force.** Copy every value out, sort it, build a fresh list.

```python
def mergeTwoLists(l1, l2):
    vals = []
    for node in (l1, l2):
        while node:
            vals.append(node.val)
            node = node.next
    vals.sort()
    dummy = curr = ListNode()
    for v in vals:
        curr.next = ListNode(v)
        curr = curr.next
    return dummy.next
```

`O((n + m) log(n + m))` time, `O(n + m)` space.

**Wasteful because.** The sort compares pairs that were never out of order: every element of `l1` already sits correctly relative to the rest of `l1`. Half the information in the input is discarded and then paid for again. It also allocates a duplicate of every node you were already holding.

**Optimal.** The only comparison that can matter is between the two front nodes, because everything behind a front node is at least as large as it. So keep a tail pointer, compare the two heads, splice the smaller one on, and advance that list. When one list runs out, the other is a sorted suffix entirely larger than what you have emitted, so it attaches whole in `O(1)` rather than node by node. A dummy node in front of the result deletes the "is this the first node?" branch, which is where the off-by-one bugs live: you always write `curr.next`. Using `<=` rather than `<` keeps equal values in `l1`-before-`l2` order, which matters when the nodes carry a payload.

**Edge cases.** Either list empty, or both: the loop never runs and the tail attach returns the other list or `None`. Equal values at the two fronts. One list entirely smaller than the other, where the loop drains it and the tail attach does all the rest.

#### Python

`dummy = curr = ListNode()` is the Python-only chained assignment trick. `curr.next = l1 or l2` uses truthiness — `None or x` yields `x`, attaching the remaining tail in one line.

```python
def mergeTwoLists(l1, l2):
    dummy = curr = ListNode()
    while l1 and l2:
        if l1.val <= l2.val:
            curr.next = l1
            l1 = l1.next
        else:
            curr.next = l2
            l2 = l2.next
        curr = curr.next
    curr.next = l1 or l2
    return dummy.next
```

#### Java

A `new ListNode()` dummy sentinel removes the first-node special case. Java has no truthy `or`, so the leftover tail attaches with a ternary `curr.next = l1 != null ? l1 : l2`.

```java
class Solution {
    public ListNode mergeTwoLists(ListNode l1, ListNode l2) {
        ListNode dummy = new ListNode();
        ListNode curr = dummy;
        while (l1 != null && l2 != null) {
            if (l1.val <= l2.val) {
                curr.next = l1;
                l1 = l1.next;
            } else {
                curr.next = l2;
                l2 = l2.next;
            }
            curr = curr.next;
        }
        curr.next = l1 != null ? l1 : l2;
        return dummy.next;
    }
}
```

#### Rust

Painful: `take()` repeatedly to satisfy the borrow checker, and the `as_ref().unwrap()` to peek `val` without taking. This is the canonical Rust linked-list pain — productive code would just use a `Vec`.

```rust
#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}
impl ListNode { fn new(val: i32) -> Self { ListNode { val, next: None } } }

fn merge_two_lists(
    mut l1: Option<Box<ListNode>>,
    mut l2: Option<Box<ListNode>>,
) -> Option<Box<ListNode>> {
    let mut dummy = ListNode::new(0);
    let mut curr = &mut dummy;
    while l1.is_some() && l2.is_some() {
        if l1.as_ref().unwrap().val <= l2.as_ref().unwrap().val {
            curr.next = l1.take();
            curr = curr.next.as_mut().unwrap();
            l1 = curr.next.take();
        } else {
            curr.next = l2.take();
            curr = curr.next.as_mut().unwrap();
            l2 = curr.next.take();
        }
    }
    curr.next = if l1.is_some() { l1 } else { l2 };
    dummy.next
}
```

#### Go

Straightforward — `curr.Next = l1` aliases without copying; updating `l1 = l1.Next` walks the source forward. Tail attachment via if-else; Go has no ternary or truthy `or`.

```go
type ListNode struct {
    Val  int
    Next *ListNode
}

func mergeTwoLists(l1 *ListNode, l2 *ListNode) *ListNode {
    dummy := &ListNode{}
    curr := dummy
    for l1 != nil && l2 != nil {
        if l1.Val <= l2.Val {
            curr.Next = l1
            l1 = l1.Next
        } else {
            curr.Next = l2
            l2 = l2.Next
        }
        curr = curr.Next
    }
    if l1 != nil {
        curr.Next = l1
    } else {
        curr.Next = l2
    }
    return dummy.Next
}
```

#### C++

Stack-allocated `dummy` avoids any allocation for the sentinel. Ternary `l1 ? l1 : l2` is the one-line tail attachment that Go can't do.

```cpp
struct ListNode {
    int val;
    ListNode* next;
    ListNode(int v = 0, ListNode* n = nullptr) : val(v), next(n) {}
};

ListNode* mergeTwoLists(ListNode* l1, ListNode* l2) {
    ListNode dummy;
    ListNode* curr = &dummy;
    while (l1 && l2) {
        if (l1->val <= l2->val) { curr->next = l1; l1 = l1->next; }
        else { curr->next = l2; l2 = l2->next; }
        curr = curr->next;
    }
    curr->next = l1 ? l1 : l2;
    return dummy.next;
}
```


### 41. Reorder List

#### Problem
Given a linked list `L0 → L1 → … → Ln`, reorder it in-place to `L0 → Ln → L1 → Ln-1 → L2 → Ln-2 → …` without returning a new list.

#### Examples

```text
Input: head = [1,2,3,4]
Output: head = [1,4,2,3]
Explanation: the list is zipped with its own reverse.

Input: head = [1,2,3,4,5]
Output: head = [1,5,2,4,3]

Input: head = [1]
Output: head = [1]

Constraints:
- 1 <= number of nodes <= 5 * 10^4
- 1 <= node value <= 1000
- reorder in place; nothing is returned
```

#### Recognition
**Signals.** The target order `L0, Ln, L1, Ln-1, ...` is the list zipped with its own reverse, and "in place" forbids building a second one. Reading `Ln` then `Ln-1` means moving backwards, which a singly linked list simply cannot do, so the shape of the problem is: get backwards access to the tail end, without paying for storage. **Therefore.** Three phases. Walk slow and fast pointers to land slow on the last node of the first half and sever there, reverse the detached second half in place so its nodes now run tail-first, then splice the two halves together one node at a time. **Not collecting node references into an array and indexing inwards from both ends**, which is far easier to write and gives exactly the random access the pattern wants, but costs `n` extra pointers, and it buffers the whole list when only the second half ever needs to be read in reverse. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Put every node in an array and rewire by index.

```python
def reorderList(head):
    nodes = []
    node = head
    while node:
        nodes.append(node)
        node = node.next
    i, j = 0, len(nodes) - 1
    while i < j:
        nodes[i].next = nodes[j]
        i += 1
        if i < j:
            nodes[j].next = nodes[i]
            j -= 1
    nodes[i].next = None
```

`O(n)` time, `O(n)` space.

**Wasteful because.** Nothing is recomputed; the cost is pure storage. The array exists for one reason, to make `nodes[j]` reachable when `j` is behind you, and it holds all `n` references to do it. Half of them are never read backwards at all: the first half is consumed strictly left to right, exactly as the list already allows.

**Optimal.** Buy backwards access with a reversal instead of an array. Find the split with slow and fast pointers, cut the list in two, reverse the shorter tail half in place, and the nodes you needed to reach from the back are now reachable from the front. The splice then walks both halves forward at once, saving `first.next` and `second.next` before either is overwritten, since each assignment destroys the pointer the other side still needs. Starting `fast` at `head.next` rather than `head` biases `slow` to the end of the first half, so on an odd length the extra node stays in front, which is what puts the middle element last in the output. `slow.next = None` is what lets the splice loop terminate on `while second` alone.

**Edge cases.** A single node leaves both loops unentered and is already correct. Two nodes are unchanged, since reversing a one-node tail is a no-op. On odd lengths the middle node ends up as the final node, with its `next` already cleared by the sever.

#### Python

Three-phase in-place: slow/fast midpoint, reverse second half, then interleave. `slow.next = None` severs the list so the merge step can use `while second:` as the loop condition cleanly.

```python
def reorderList(head):
    slow, fast = head, head.next
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    second = slow.next
    slow.next = None
    prev = None
    while second:
        nxt = second.next
        second.next = prev
        prev = second
        second = nxt
    first, second = head, prev
    while second:
        t1, t2 = first.next, second.next
        first.next = second
        second.next = t1
        first = t1
        second = t2
```

#### Java

Java references tolerate the three-pointer rewiring the Rust version can't, so the in-place three-phase form ports directly. `slow.next = null` severs the list so the interleave loop can use `second != null` cleanly.

```java
class Solution {
    public void reorderList(ListNode head) {
        if (head == null || head.next == null) return;
        ListNode slow = head, fast = head.next;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }
        ListNode second = slow.next;
        slow.next = null;
        ListNode prev = null;
        while (second != null) {
            ListNode nxt = second.next;
            second.next = prev;
            prev = second;
            second = nxt;
        }
        ListNode first = head;
        second = prev;
        while (second != null) {
            ListNode t1 = first.next, t2 = second.next;
            first.next = second;
            second.next = t1;
            first = t1;
            second = t2;
        }
    }
}
```

#### Rust

Rust's `Box`-owned linked list doesn't tolerate the three-pointer dance — the borrow checker rejects rewiring while holding handles. This implementation reads values into a `Vec`, computes the reorder order via two-pointer, and writes values back in place. Slightly cheating, but the only sane approach without `unsafe` or `Rc<RefCell<>>`.

```rust
#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}
impl ListNode { fn new(val: i32) -> Self { ListNode { val, next: None } } }

fn reorder_list(head: &mut Option<Box<ListNode>>) {
    // Collect nodes into a vec, rewire in-place
    let mut nodes: Vec<i32> = Vec::new();
    let mut cur = head.as_ref();
    while let Some(node) = cur {
        nodes.push(node.val);
        cur = node.next.as_ref();
    }
    let n = nodes.len();
    if n <= 2 { return; }
    // Build result order
    let mut order = Vec::with_capacity(n);
    let (mut l, mut r) = (0usize, n - 1);
    while l <= r {
        order.push(nodes[l]); l += 1;
        if l <= r { order.push(nodes[r]); r = r.saturating_sub(1); }
    }
    let mut cur = head.as_mut();
    for &v in &order {
        if let Some(node) = cur {
            node.val = v;
            cur = node.next.as_mut();
        }
    }
}
```

#### Go

Three-phase pointer dance reads almost identically to the Python form — Go's pointers tolerate the kind of mutation that Rust's borrow checker forbids. `var prev *ListNode` defaults to nil for the reverse phase.

```go
type ListNode struct {
    Val  int
    Next *ListNode
}

func reorderList(head *ListNode) {
    if head == nil || head.Next == nil { return }
    // Find middle
    slow, fast := head, head.Next
    for fast != nil && fast.Next != nil {
        slow = slow.Next
        fast = fast.Next.Next
    }
    // Reverse second half
    second := slow.Next
    slow.Next = nil
    var prev *ListNode
    for second != nil {
        nxt := second.Next
        second.Next = prev
        prev = second
        second = nxt
    }
    // Interleave
    first, second := head, prev
    for second != nil {
        t1, t2 := first.Next, second.Next
        first.Next = second
        second.Next = t1
        first = t1
        second = t2
    }
}
```

#### C++

Raw pointers make this mechanical — same three phases, no language friction. `slow->next = nullptr` is the critical severance step.

```cpp
struct ListNode {
    int val;
    ListNode* next;
    ListNode(int v = 0, ListNode* n = nullptr) : val(v), next(n) {}
};

void reorderList(ListNode* head) {
    if (!head || !head->next) return;
    // Find middle
    ListNode* slow = head;
    ListNode* fast = head->next;
    while (fast && fast->next) { slow = slow->next; fast = fast->next->next; }
    // Reverse second half
    ListNode* second = slow->next;
    slow->next = nullptr;
    ListNode* prev = nullptr;
    while (second) {
        ListNode* nxt = second->next;
        second->next = prev;
        prev = second;
        second = nxt;
    }
    // Interleave
    ListNode* first = head;
    second = prev;
    while (second) {
        ListNode* t1 = first->next, *t2 = second->next;
        first->next = second;
        second->next = t1;
        first = t1;
        second = t2;
    }
}
```


### 42. Remove Nth Node From End of List

#### Problem
Given the head of a linked list and an integer `n`, remove the nth node from the end of the list in one pass and return the head.

#### Examples

```text
Input: head = [1,2,3,4,5], n = 2
Output: [1,2,3,5]
Explanation: the 2nd node from the end holds 4.

Input: head = [1,2], n = 1
Output: [1]

Input: head = [1], n = 1
Output: null
Explanation: the only node is removed, so the list is empty.

Constraints:
- 1 <= number of nodes <= 30
- 1 <= n <= number of nodes
- -100 <= node value <= 100
```

#### Recognition
**Signals.** "The nth node from the end" together with "in one pass". A singly linked list carries no length field and no backward pointer, so a position measured from the tail is not addressable directly; the only way to hold one while walking forward is to keep a second pointer a fixed number of nodes behind the first. "One pass" is the clause that turns that from a nicety into the requirement. **Therefore.** Advance a lead pointer `n + 1` nodes ahead of a trailing pointer, both starting at a dummy placed before `head`, then step them together until the lead falls off the end; the trailing pointer is then parked on the node immediately before the target. **Not counting the length first and walking again**, which is correct and easier to reason about but re-traverses a prefix it has already visited, and cannot work at all if the list arrives as a one-shot stream you cannot rewind. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Measure the list, then walk back in to the target.

```python
def removeNthFromEnd(head, n):
    length = 0
    node = head
    while node:
        length += 1
        node = node.next
    if length == n:
        return head.next
    node = head
    for _ in range(length - n - 1):
        node = node.next
    node.next = node.next.next
    return head
```

`O(n)` time, `O(1)` space.

**Wasteful because.** The counting pass stands on every node and knows exactly where it is, then discards all of it; the second pass re-walks the first `length - n - 1` of those same nodes to recover a position it had already reached. The `length == n` branch is the second symptom: `head` has no predecessor to patch, so deleting the first element needs its own code path.

**Optimal.** Keep the position instead of throwing it away. A trailing pointer held exactly `n + 1` nodes behind the leader is, at every moment, a record of where the leader stood `n + 1` steps ago, so the instant the leader runs off the end the trailer is sitting on the node before the target for free. The gap is `n + 1` rather than `n` precisely because you can only unlink a node through its predecessor. Starting both at a dummy in front of `head` erases the special case: the dummy is a real predecessor for the first element, and returning `dummy.next` picks up the head whether or not it changed.

**Edge cases.** `n` equal to the length removes the head, and the dummy absorbs it with no branch. A one-node list returns `None`, the empty list. `n == 1` removes the tail, and the trailer lands on the second-to-last node.

#### Python

Dummy node trick lets the fast pointer go `n + 1` steps ahead so `slow` lands one *before* the target. `dummy.next` returns the (possibly new) head — handles removing the first node trivially.

```python
def removeNthFromEnd(head, n):
    dummy = ListNode(0, head)
    fast = slow = dummy
    for _ in range(n + 1):
        fast = fast.next
    while fast:
        fast = fast.next
        slow = slow.next
    slow.next = slow.next.next
    return dummy.next
```

#### Java

A dummy before `head` lets `fast` run `n + 1` steps ahead so `slow` lands one before the target; `dummy.next` returns the possibly-new head. Pure pointer walking, no allocation beyond the sentinel.

```java
class Solution {
    public ListNode removeNthFromEnd(ListNode head, int n) {
        ListNode dummy = new ListNode(0, head);
        ListNode fast = dummy, slow = dummy;
        for (int i = 0; i <= n; i++) fast = fast.next;
        while (fast != null) {
            fast = fast.next;
            slow = slow.next;
        }
        slow.next = slow.next.next;
        return dummy.next;
    }
}
```

#### Rust

Owned `Box<ListNode>` makes the two-pointer dance prohibitively painful — easier to collect values, drop the target index, and rebuild. The `vals.iter().rev()` + chained `Some(Box::new(...))` is the canonical 'build list from values' pattern.

```rust
#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}
impl ListNode { fn new(val: i32) -> Self { ListNode { val, next: None } } }

fn remove_nth_from_end(head: Option<Box<ListNode>>, n: i32) -> Option<Box<ListNode>> {
    // Collect into vec, remove index len-n, rebuild
    let mut vals = Vec::new();
    let mut cur = &head;
    while let Some(node) = cur { vals.push(node.val); cur = &node.next; }
    let remove = vals.len() - n as usize;
    vals.remove(remove);
    let mut result: Option<Box<ListNode>> = None;
    for &v in vals.iter().rev() {
        result = Some(Box::new(ListNode { val: v, next: result }));
    }
    result
}
```

#### Go

The textbook `n + 1` step lead — for-loop with `<=` instead of `<` makes the intent (`stop one short of n+1`) explicit. Pure pointer manipulation, no allocations.

```go
type ListNode struct {
    Val  int
    Next *ListNode
}

func removeNthFromEnd(head *ListNode, n int) *ListNode {
    dummy := &ListNode{Next: head}
    fast, slow := dummy, dummy
    for i := 0; i <= n; i++ {
        fast = fast.Next
    }
    for fast != nil {
        fast = fast.Next
        slow = slow.Next
    }
    slow.Next = slow.Next.Next
    return dummy.Next
}
```

#### C++

Stack-allocated `dummy(0, head)` uses the two-arg constructor. `delete del` is the only manual memory move — Go and Python rely on GC.

```cpp
struct ListNode {
    int val;
    ListNode* next;
    ListNode(int v = 0, ListNode* n = nullptr) : val(v), next(n) {}
};

ListNode* removeNthFromEnd(ListNode* head, int n) {
    ListNode dummy(0, head);
    ListNode* fast = &dummy;
    ListNode* slow = &dummy;
    for (int i = 0; i <= n; ++i) fast = fast->next;
    while (fast) { fast = fast->next; slow = slow->next; }
    ListNode* del = slow->next;
    slow->next = slow->next->next;
    delete del;
    return dummy.next;
}
```


### 43. Copy List with Random Pointer

#### Problem
Deep-copy a linked list where each node has a `val`, a `next` pointer, and a `random` pointer that may point to any node or `None`.

#### Examples

```text
Input: head = [[7,null],[13,0],[11,4],[10,2],[1,0]]
Output: [[7,null],[13,0],[11,4],[10,2],[1,0]]
Explanation: each entry is [value, index the random points at],
  and the clone must serialise to the same encoding.

Input: head = [[3,null],[3,0],[3,null]]
Output: [[3,null],[3,0],[3,null]]

Input: head = [[1,1],[2,1]]
Output: [[1,1],[2,1]]

Constraints:
- 0 <= number of nodes <= 1000
- -10^4 <= node value <= 10^4
- random is null or points at some node in this list
- values are not unique
```

#### Recognition
**Signals.** "Deep copy" plus a `random` pointer that "may point to any node in the list". Two things follow. Deep copy means every pointer in the result has to reference a fresh node, so you cannot reuse a single original anywhere. And because `random` may point forward, at the moment you allocate a node's copy the copy it must point at may not exist yet, which kills any single-pass build that wires as it walks. **Therefore.** Two passes over a dictionary keyed on the original node: pass one allocates a copy for every node so the mapping is total, pass two reads `next` and `random` through that mapping, which by then has an answer for every node. **Not an array of nodes with `random` recorded as an index**, because turning an arbitrary node pointer back into its index costs a linear scan, so building that table is `O(n^2)`; a dictionary answers the same question in `O(1)` because it is keyed on node identity, not position. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Snapshot the nodes in order, then look up each random target's position by searching that list.

```python
def copyRandomList(head):
    order = []
    cur = head
    while cur:
        order.append(cur)
        cur = cur.next
    copies = [Node(n.val) for n in order]
    for i in range(len(copies) - 1):
        copies[i].next = copies[i + 1]
    for i, n in enumerate(order):
        if n.random is not None:
            copies[i].random = copies[order.index(n.random)]
    return copies[0] if copies else None
```

`O(n^2)` time, `O(n)` space.

**Wasteful because.** `order.index` re-walks the list from the front once per node, to answer "which position is this pointer?" That position was already known during the first walk and was thrown away, so at `n = 1000` the search redoes up to a million steps to recover facts it had a moment ago.

**Optimal.** Record the answer at the moment you know it. A dictionary from original node to its copy is exactly the index table the brute force keeps rebuilding, except lookup is `O(1)` and the key is the node object itself, so identity does the matching and duplicate values cannot collide. The first pass has to complete before any wiring starts; that is what makes forward `random` pointers safe, because by the second pass the mapping is defined for every node in the list. Seeding it with `{None: None}` makes the second pass branchless: a null `next` or `random` looks up to null with no guard. There is an `O(1)`-space alternative that weaves each copy in behind its original as `A, A', B, B'`, sets `A'.random = A.random.next`, then unzips the two lists; take it when memory is the binding constraint and you can afford the extra care.

**Edge cases.** An empty list returns `None` before the map is ever read. A `random` that points at its own node is nothing special, since the map holds that node too. Repeated values, as in `[[3,null],[3,0],[3,null]]`, are the case that punishes keying the map on `val` instead of the node.

#### Python

Seeding `old_to_new` with `{None: None}` is the trick that makes the second pass branchless — looking up a null `random` returns null naturally. Two passes are needed because `random` can point forward to nodes not yet created.

```python
def copyRandomList(head):
    old_to_new = {None: None}
    cur = head
    while cur:
        old_to_new[cur] = Node(cur.val)
        cur = cur.next
    cur = head
    while cur:
        old_to_new[cur].next = old_to_new[cur.next]
        old_to_new[cur].random = old_to_new[cur.random]
        cur = cur.next
    return old_to_new[head]
```

#### Java

Seeding the `HashMap` with `map.put(null, null)` makes the second pass branchless — a null `next`/`random` lookup just returns null. Assumes the LeetCode `Node` type with `val`, `next`, `random`.

```java
import java.util.*;

class Solution {
    public Node copyRandomList(Node head) {
        Map<Node, Node> map = new HashMap<>();
        map.put(null, null);
        Node cur = head;
        while (cur != null) {
            map.put(cur, new Node(cur.val));
            cur = cur.next;
        }
        cur = head;
        while (cur != null) {
            Node copy = map.get(cur);
            copy.next = map.get(cur.next);
            copy.random = map.get(cur.random);
            cur = cur.next;
        }
        return map.get(head);
    }
}
```

#### Rust

Rust's borrow checker can't handle a graph with arbitrary forward/backward links via `Box`; production code would use `Rc<RefCell<Node>>` or raw pointers. This stub demonstrates the index-based representation that is the safe Rust alternative — real solution requires a different data structure.

```rust
use std::collections::HashMap;

#[derive(Clone)]
struct Node {
    val: i32,
    next: Option<usize>,
    random: Option<usize>,
}

// Represent list as Vec<Node> with indices instead of raw pointers.
fn copy_random_list(nodes: &[Node]) -> Vec<Node> {
    nodes.to_vec()
}
```

#### Go

`map[*Node]*Node{nil: nil}` seeds the nil mapping — same trick as Python. Pointers are first-class map keys in Go, no hashing concerns.

```go
type Node struct {
    Val    int
    Next   *Node
    Random *Node
}

func copyRandomList(head *Node) *Node {
    if head == nil { return nil }
    oldToNew := map[*Node]*Node{nil: nil}
    cur := head
    for cur != nil {
        oldToNew[cur] = &Node{Val: cur.Val}
        cur = cur.Next
    }
    cur = head
    for cur != nil {
        oldToNew[cur].Next = oldToNew[cur.Next]
        oldToNew[cur].Random = oldToNew[cur.Random]
        cur = cur.Next
    }
    return oldToNew[head]
}
```

#### C++

`std::unordered_map<Node*, Node*>` with `m[nullptr] = nullptr` seeded. `new Node(cur->val)` allocates on the heap — LeetCode tolerates the leak; production would track ownership.

```cpp
#include <unordered_map>

struct Node {
    int val;
    Node* next;
    Node* random;
    Node(int v) : val(v), next(nullptr), random(nullptr) {}
};

Node* copyRandomList(Node* head) {
    std::unordered_map<Node*, Node*> m;
    m[nullptr] = nullptr;
    for (Node* cur = head; cur; cur = cur->next)
        m[cur] = new Node(cur->val);
    for (Node* cur = head; cur; cur = cur->next) {
        m[cur]->next = m[cur->next];
        m[cur]->random = m[cur->random];
    }
    return m[head];
}
```


### 44. Linked List Cycle

#### Problem
Given the head of a linked list, return `true` if the list has a cycle (some node's `next` pointer points back to a previous node), and `false` otherwise.

#### Examples

```text
Input: head = [3,2,0,-4], pos = 1
Output: true
Explanation: the tail links back to the node at index 1.

Input: head = [1,2], pos = 0
Output: true

Input: head = [1], pos = -1
Output: false

Constraints:
- 0 <= number of nodes <= 10^4
- -10^5 <= node value <= 10^5
- pos is the index the tail links to, or -1 for no cycle
- pos is not passed to the function; it only describes the wiring
```

#### Recognition
**Signals.** A bare `head` pointer, the word "cycle", and the follow-up asking for `O(1)` memory. A linked list gives you no random access, no length, and no index, so the only move available is to walk it. The space bound is what forbids the obvious visited-set. "Cycle" also means the walk may never terminate on its own, so whatever you write needs its own termination argument. **Therefore.** Two pointers over the same list, `slow` one node per step and `fast` two. If a cycle exists, `fast` gains exactly one position on `slow` per step, so inside a cycle of length `L` it closes any gap within `L` steps and they coincide; if not, `fast` or `fast.next` reaches `None`. **Not a hash set** of visited node identities, which is correct and shorter to write but costs `O(n)` space, which is the exact thing the follow-up exists to take away. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Remember every node you have already stood on.

```python
def hasCycle(head):
    seen = set()
    node = head
    while node:
        if id(node) in seen:
            return True
        seen.add(id(node))
        node = node.next
    return False
```

`O(n)` time, `O(n)` space.

**Wasteful because.** Nothing is recomputed here; the cost is pure storage. The set grows to `n` node references in order to answer one bit of output, and it stores identities you will never look at again once the walk moves past them. That is the waste the `O(1)` follow-up is aimed at.

**Optimal.** Trade memory for relative speed. Run both pointers from `head`, advancing `slow` one node and `fast` two. Their separation, measured forward along the walk, grows by exactly one per step, and inside a cycle of length `L` that separation is taken modulo `L`, so it must hit zero within `L` steps. No cycle can be missed and none can be invented, since on an acyclic list `fast` falls off the end first. The guard is `while fast and fast.next` rather than `while fast` because a two-node hop dereferences twice. Compare after the move, never before, or both pointers sitting on `head` at step zero report a cycle that is not there. Keep the set version when the answer needed is more than one bit, for instance which node repeated.

**Edge cases.** Empty list: `fast` is `None`, the loop never runs, false. A single node with `next = None`: false on the same guard. A single node pointing at itself: both pointers land back on it in one step, true.

#### Python

Both pointers start at `head` so they're equal initially — the meeting check after the move (not before) avoids the false-positive on iteration 0.

```python
def hasCycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast:
            return True
    return False
```

#### Java

Both pointers start at `head`, so the `slow == fast` check comes after the move to avoid a false positive on iteration zero. Reference `==` compares identity, exactly what cycle detection needs.

```java
class Solution {
    public boolean hasCycle(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) return true;
        }
        return false;
    }
}
```

#### Rust

Owned `Box` linked lists can't have cycles by construction — `Box` enforces single ownership. This stub uses index arrays to demonstrate the algorithm; a real implementation would use raw pointers or `Rc<RefCell<>>`.

```rust
#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}

// Note: true cycle detection with Box<> is impossible at runtime since Box
// enforces unique ownership. In practice this is done with raw pointers.
// Here we demonstrate the algorithm with an index-based representation.
fn has_cycle(nodes: &[i32], nexts: &[i32]) -> bool {
    if nodes.is_empty() { return false; }
    let (mut slow, mut fast) = (0usize, 0usize);
    loop {
        let fs = nexts[fast];
        if fs < 0 { return false; }
        let ffs = nexts[fs as usize];
        if ffs < 0 { return false; }
        slow = nexts[slow] as usize;
        fast = ffs as usize;
        if slow == fast { return true; }
    }
}
```

#### Go

Pointer comparison `slow == fast` works because Go pointers compare by address. Zero language friction — the algorithm reads identically to Python.

```go
type ListNode struct {
    Val  int
    Next *ListNode
}

func hasCycle(head *ListNode) bool {
    slow, fast := head, head
    for fast != nil && fast.Next != nil {
        slow = slow.Next
        fast = fast.Next.Next
        if slow == fast {
            return true
        }
    }
    return false
}
```

#### C++

Raw pointer comparison via `==` on addresses. Same shape as Go; no special syntax for cycle-aware traversal.

```cpp
struct ListNode {
    int val;
    ListNode* next;
    ListNode(int v = 0, ListNode* n = nullptr) : val(v), next(n) {}
};

bool hasCycle(ListNode* head) {
    ListNode* slow = head;
    ListNode* fast = head;
    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
        if (slow == fast) return true;
    }
    return false;
}
```


### 45. Find the Duplicate Number

#### Problem
Given an array of `n + 1` integers where each integer is in `[1, n]`, find the one duplicate without modifying the array and using only `O(1)` extra space.

#### Examples

```text
Input: nums = [1,3,4,2,2]
Output: 2

Input: nums = [3,1,3,4,2]
Output: 3

Input: nums = [3,3,3,3,3]
Output: 3

Constraints:
- 1 <= n <= 10^5 and nums.length == n + 1
- 1 <= nums[i] <= n
- exactly one value repeats, one or more times
- the array must not be modified, O(1) extra space
```

#### Recognition
**Signals.** Three clauses that only ever show up together for one reason: `n + 1` integers each in `[1, n]`, "without modifying the array", and `O(1)` extra space. The range clause is the load-bearing one, because every value is a legal index into the same array, which makes `i -> nums[i]` a function from the array into itself. The no-modify clause kills index marking, where you negate `nums[v - 1]` to record a visit, and kills cyclic sort. The space clause kills a set or a count array. That pairing leaves essentially one technique. **Therefore.** Read `nums` as an implicit linked list whose next pointer at `i` is `nums[i]`. Pigeonhole forces a repeat, a repeat means two indices share a successor, and that is a cycle whose entrance is the duplicate, so Floyd's two phases find it. **Not sorting** and scanning for adjacent equals, which modifies the array and costs `O(n log n)`. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Compare every pair.

```python
def findDuplicate(nums):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] == nums[j]:
                return nums[i]
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** For each `i` the inner loop re-walks the entire suffix to ask "does this value appear again?", so the same suffix is traversed `n` times. A hash set answers that question in one pass instead, but it buys the speedup with `O(n)` space, which the problem has already ruled out.

**Optimal.** Follow the pointers instead of comparing values. Start both cursors at `nums[0]` and advance `slow` by one hop and `fast` by two until they meet, which they must, because the walk is confined to a finite set and index 0 is never a target: values are at least 1, so nothing points back to the start, and the cycle entrance therefore sits strictly inside. Phase 2 resets one cursor to `nums[0]` and advances both one hop at a time; the distance from the start to the entrance equals the distance from the meeting point to the entrance, so they collide exactly at the entrance, and that index is the repeated value. Nothing is written, so the no-modify rule holds. If the cycle argument deserts you under pressure, binary search on the *value* (count how many entries are `<= mid`) is a safe `O(n log n)` fallback obeying both constraints.

**Edge cases.** A value repeated more than twice, as in `[3,3,3,3,3]`, still yields one cycle with the same entrance. The smallest case `nums = [1,1]` terminates on the first phase-1 step. Values are guaranteed inside `[1, n]`, so `nums[nums[fast]]` never needs a bounds check.

#### Python

Two-phase Floyd: first loop finds the meeting point inside the cycle, second loop finds the cycle entrance (the duplicate). The `while True ... break` pattern is needed because `slow == fast` is also true initially.

```python
def findDuplicate(nums):
    slow = fast = nums[0]
    while True:
        slow = nums[slow]
        fast = nums[nums[fast]]
        if slow == fast:
            break
    slow = nums[0]
    while slow != fast:
        slow = nums[slow]
        fast = nums[fast]
    return slow
```

#### Java

Two-phase Floyd over the array-as-implicit-linked-list; a `do/while` fits the "compare after move" first phase better than Python's `while True/break`. Pure `int` indexing, no extra space.

```java
class Solution {
    public int findDuplicate(int[] nums) {
        int slow = nums[0], fast = nums[0];
        do {
            slow = nums[slow];
            fast = nums[nums[fast]];
        } while (slow != fast);
        slow = nums[0];
        while (slow != fast) {
            slow = nums[slow];
            fast = nums[fast];
        }
        return slow;
    }
}
```

#### Rust

`as usize` casts at every index — Rust forces this because array indices must be unsigned. The algorithm is identical in shape to the Python version.

```rust
fn find_duplicate(nums: Vec<i32>) -> i32 {
    let (mut slow, mut fast) = (nums[0] as usize, nums[0] as usize);
    loop {
        slow = nums[slow] as usize;
        fast = nums[nums[fast] as usize] as usize;
        if slow == fast { break; }
    }
    slow = nums[0] as usize;
    while slow != fast {
        slow = nums[slow] as usize;
        fast = nums[fast] as usize;
    }
    slow as i32
}
```

#### Go

Plain int indexing into the slice; the implicit-linked-list view is what makes this a graph problem in disguise. `for { ... break }` for the first phase.

```go
func findDuplicate(nums []int) int {
    slow, fast := nums[0], nums[0]
    for {
        slow = nums[slow]
        fast = nums[nums[fast]]
        if slow == fast { break }
    }
    slow = nums[0]
    for slow != fast {
        slow = nums[slow]
        fast = nums[fast]
    }
    return slow
}
```

#### C++

`do-while` loop is the most natural fit for the 'compare after move' first phase — eliminates the `while True/break` awkwardness.

```cpp
#include <vector>

int findDuplicate(std::vector<int>& nums) {
    int slow = nums[0], fast = nums[0];
    do {
        slow = nums[slow];
        fast = nums[nums[fast]];
    } while (slow != fast);
    slow = nums[0];
    while (slow != fast) {
        slow = nums[slow];
        fast = nums[fast];
    }
    return slow;
}
```


### 46. LRU Cache

#### Problem
Design a data structure that supports `get(key)` and `put(key, value)` in `O(1)` time, evicting the least recently used entry when capacity is exceeded.

#### Examples

```text
Input: ["LRUCache","put","put","get","put","get",
"put","get","get","get"],
[[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]
Output: [null,null,null,1,null,-1,null,-1,3,4]

Input: ["LRUCache","put","put","get","get"],
[[1],[1,1],[2,2],[1],[2]]
Output: [null,null,null,-1,2]

Input: ["LRUCache","put","put","get"],
[[2],[2,1],[2,3],[2]]
Output: [null,null,null,3]

Constraints:
- 1 <= capacity <= 3000
- 0 <= key <= 10^4, 0 <= value <= 10^5
- up to 2 * 10^5 calls to get and put combined
- get returns -1 when the key is absent
```

#### Recognition
**Signals.** The word "design", an explicit `O(1)` bound on *both* `get` and `put`, and an eviction rule that depends on a recency *ordering* which changes on every single access, reads included. Those requirements pull in opposite directions: `O(1)` lookup by key is a hash map, and `O(1)` "which entry is oldest, and promote this one to newest" is a linked list. Neither structure does both, and the `O(1)` bound is what stops you settling for one of them. **Therefore.** Run both over the same nodes: a hash map from key to a node *reference*, and a doubly linked list holding those nodes in recency order with a sentinel at each end. **Not an array or list of keys in access order**, where promoting a key costs an `O(n)` search plus an `O(n)` shift, which is the version that quietly makes every operation linear. **O(1)** time, **O(capacity)** space.

#### Explanation
**Brute force.** A dict for the values, plus a plain list holding the keys oldest-first.

```python
class LRUCache:
    def __init__(self, capacity):
        self.cap = capacity
        self.data = {}
        self.order = []
    def get(self, key):
        if key not in self.data:
            return -1
        self.order.remove(key)
        self.order.append(key)
        return self.data[key]
    def put(self, key, value):
        if key in self.data:
            self.order.remove(key)
        elif len(self.data) >= self.cap:
            del self.data[self.order.pop(0)]
        self.data[key] = value
        self.order.append(key)
```

`O(n)` per operation, `O(capacity)` space.

**Wasteful because.** `order.remove(key)` scans the list to find where the key currently sits, and `order.pop(0)` shifts every surviving element down one slot. Both are `O(n)`, so a 3000-entry cache does thousands of moves on a hit that should have cost four pointer writes. The position of a key is rediscovered on every touch even though the map was already holding the key.

**Optimal.** Store the position rather than searching for it. Every entry becomes a node in a doubly linked list ordered least-recent to most-recent, and the hash map maps the key to that node instead of to the value. Now "find the key" is a dict lookup, and "promote it" is unlinking it from its two neighbours and relinking it before the tail. Unlinking needs the node's *predecessor* in `O(1)`, which is the entire reason the list must be doubly linked rather than singly. Two sentinel nodes at the ends mean no insertion or removal ever inspects a null neighbour, so both helpers are branch-free. Eviction reads the node just after the left sentinel, and deletes `node.key` from the map, which is why each node has to carry its own key: without it you would have to scan the map to find what to delete.

**Edge cases.** Capacity 1, where any new key evicts on the very next `put`. Re-putting an existing key must refresh recency without growing the cache, so the size check belongs on the else branch. A `get` miss returns -1 and must leave the ordering untouched.

#### Python

Two sentinel nodes (`left` and `right` dummies) eliminate every neighbor null-check. The `cache` maps key → node, so `get`/`put` are pure dict access plus list rewiring — both O(1).

```python
class Node:
    def __init__(self, key=0, val=0):
        self.key = key
        self.val = val
        self.prev = self.next = None

class LRUCache:
    def __init__(self, capacity):
        self.cap = capacity
        self.cache = {}
        self.left = Node()   # LRU sentinel
        self.right = Node()  # MRU sentinel
        self.left.next = self.right
        self.right.prev = self.left

    def remove(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def insert(self, node):
        node.prev = self.right.prev
        node.next = self.right
        self.right.prev.next = node
        self.right.prev = node

    def get(self, key):
        if key in self.cache:
            self.remove(self.cache[key])
            self.insert(self.cache[key])
            return self.cache[key].val
        return -1

    def put(self, key, value):
        if key in self.cache:
            self.remove(self.cache[key])
        self.cache[key] = Node(key, value)
        self.insert(self.cache[key])
        if len(self.cache) > self.cap:
            lru = self.left.next
            self.remove(lru)
            del self.cache[lru.key]
```

#### Java

`LinkedHashMap` has a built-in `removeEldestEntry` hook and access-order mode, but writing the hashmap-plus-doubly-linked-list by hand shows the O(1) mechanics; two sentinel nodes drop every null-check. `getOrDefault`/explicit `containsKey` mirror the Python dict.

```java
import java.util.*;

class LRUCache {
    private static class Node {
        int key, val;
        Node prev, next;
        Node(int key, int val) { this.key = key; this.val = val; }
    }

    private final int cap;
    private final Map<Integer, Node> cache = new HashMap<>();
    private final Node left = new Node(0, 0);   // LRU sentinel
    private final Node right = new Node(0, 0);  // MRU sentinel

    public LRUCache(int capacity) {
        cap = capacity;
        left.next = right;
        right.prev = left;
    }

    private void remove(Node node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private void insert(Node node) {
        node.prev = right.prev;
        node.next = right;
        right.prev.next = node;
        right.prev = node;
    }

    public int get(int key) {
        if (cache.containsKey(key)) {
            Node node = cache.get(key);
            remove(node);
            insert(node);
            return node.val;
        }
        return -1;
    }

    public void put(int key, int value) {
        if (cache.containsKey(key)) {
            remove(cache.get(key));
        }
        Node node = new Node(key, value);
        cache.put(key, node);
        insert(node);
        if (cache.size() > cap) {
            Node lru = left.next;
            remove(lru);
            cache.remove(lru.key);
        }
    }
}
```

#### Rust

Production Rust LRU uses `unsafe` raw pointers or a Crates.io implementation; the borrow checker can't express the doubly-linked-list-with-back-pointers pattern. This implementation uses `VecDeque` + `retain` for clarity — correctness is preserved but `touch` is O(n), not O(1).

```rust
use std::collections::HashMap;

struct LRUCache {
    cap: usize,
    map: HashMap<i32, i32>,  // key -> value (simplified; production uses raw ptrs)
    order: std::collections::VecDeque<i32>,
}

impl LRUCache {
    fn new(capacity: i32) -> Self {
        LRUCache { cap: capacity as usize, map: HashMap::new(), order: std::collections::VecDeque::new() }
    }
    fn touch(&mut self, key: i32) {
        self.order.retain(|&k| k != key);
        self.order.push_back(key);
    }
    fn get(&mut self, key: i32) -> i32 {
        if let Some(&v) = self.map.get(&key) {
            self.touch(key);
            v
        } else { -1 }
    }
    fn put(&mut self, key: i32, value: i32) {
        if self.map.contains_key(&key) {
            self.map.insert(key, value);
            self.touch(key);
        } else {
            if self.map.len() == self.cap {
                if let Some(lru) = self.order.pop_front() {
                    self.map.remove(&lru);
                }
            }
            self.map.insert(key, value);
            self.order.push_back(key);
        }
    }
}
```

#### Go

`container/list` is the standard-library doubly linked list — `MoveToBack`, `PushBack`, `Remove`, `Front` give O(1) operations with no manual pointer wrangling. `el.Value.(*entry)` type-asserts the stored value.

```go
import "container/list"

type LRUCache struct {
    cap   int
    cache map[int]*list.Element
    list  *list.List
}

type entry struct{ key, val int }

func Constructor(capacity int) LRUCache {
    return LRUCache{cap: capacity, cache: make(map[int]*list.Element), list: list.New()}
}

func (c *LRUCache) Get(key int) int {
    if el, ok := c.cache[key]; ok {
        c.list.MoveToBack(el)
        return el.Value.(*entry).val
    }
    return -1
}

func (c *LRUCache) Put(key int, value int) {
    if el, ok := c.cache[key]; ok {
        el.Value.(*entry).val = value
        c.list.MoveToBack(el)
        return
    }
    if c.list.Len() == c.cap {
        front := c.list.Front()
        c.list.Remove(front)
        delete(c.cache, front.Value.(*entry).key)
    }
    c.cache[key] = c.list.PushBack(&entry{key, value})
}
```

#### C++

`std::list<pair<int,int>>::iterator` stored in the map gives O(1) splice-to-MRU via `lst.splice(lst.end(), lst, it->second)` — that one line is what makes the C++ form so compact compared to Python.

```cpp
#include <unordered_map>
#include <list>
#include <utility>

class LRUCache {
    int cap;
    std::list<std::pair<int,int>> lst; // {key, val}, back = MRU
    std::unordered_map<int, std::list<std::pair<int,int>>::iterator> cache;
public:
    LRUCache(int capacity) : cap(capacity) {}
    int get(int key) {
        auto it = cache.find(key);
        if (it == cache.end()) return -1;
        lst.splice(lst.end(), lst, it->second);
        return it->second->second;
    }
    void put(int key, int value) {
        auto it = cache.find(key);
        if (it != cache.end()) {
            it->second->second = value;
            lst.splice(lst.end(), lst, it->second);
            return;
        }
        if ((int)lst.size() == cap) {
            cache.erase(lst.front().first);
            lst.pop_front();
        }
        lst.push_back({key, value});
        cache[key] = std::prev(lst.end());
    }
};
```


### 47. Merge K Sorted Lists

#### Problem
Given an array of `k` sorted linked lists, merge all of them into one sorted linked list and return its head.

#### Examples

```text
Input: lists = [[1,4,5],[1,3,4],[2,6]]
Output: [1,1,2,3,4,4,5,6]

Input: lists = [[],[0],[]]
Output: [0]

Input: lists = [[1],[1],[1]]
Output: [1,1,1]

Constraints:
- 0 <= k <= 10^4 and 0 <= total nodes <= 10^4
- 0 <= length of each list <= 500
- -10^4 <= node value <= 10^4
- each list is already sorted non-decreasing
```

#### Recognition
**Signals.** "An array of `k` sorted linked lists" and a single merged output. Because each list is sorted, the global minimum is always sitting at one of the `k` heads and never deeper, so the whole problem reduces to "repeatedly take the smallest of `k` candidates, then replace it". That sentence is the definition of a priority queue. The second tell is that `k` and the total node count `n` are given as separate quantities, which is how a problem hints that `k` belongs inside a logarithm rather than as a multiplier. **Therefore.** Push all `k` heads into a min-heap, then pop the smallest, append it to the tail, and push that node's successor. **Not rescanning all `k` heads** on every step to find the minimum, which is `O(n * k)` and redoes `k - 1` comparisons whose answers did not change since the last pop. **O(n log k)** time, **O(k)** space.

#### Explanation
**Brute force.** Fold the lists into a running result, one pairwise merge at a time.

```python
def mergeKLists(lists):
    def merge(a, b):
        dummy = curr = ListNode()
        while a and b:
            if a.val <= b.val:
                curr.next, a = a, a.next
            else:
                curr.next, b = b, b.next
            curr = curr.next
        curr.next = a or b
        return dummy.next
    res = None
    for node in lists:
        res = merge(res, node)
    return res
```

`O(n * k)` time, `O(1)` space.

**Wasteful because.** Each merge re-walks everything accumulated so far. After `j` folds the result already holds roughly `j * n / k` nodes and every one of them is compared again in fold `j + 1`, so the first list is traversed `k` times, the second `k - 1` times, and so on. The pairwise merge itself is fine; doing it left to right is what makes the total quadratic in `k`.

**Optimal.** Hold only the `k` current front nodes and let a heap answer "which is smallest" in `O(log k)` instead of `O(k)`. Seed it with every non-null head, then pop, splice the popped node onto the tail, and push its successor if it has one. Each of the `n` nodes is pushed and popped exactly once against a heap that never exceeds size `k`, giving `O(n log k)` time and `O(k)` space. Divide and conquer reaches the same bound by merging lists pairwise in rounds, halving `k` each round, and it wins when a priority queue is unavailable or comparisons are expensive, since it needs no auxiliary structure. In Python the heap entries are `(val, i, node)` triples and the index is load-bearing: it settles ties before the comparison can reach the `ListNode`, which defines no ordering and would raise.

**Edge cases.** `lists` empty, so the heap never fills and the dummy's `next` stays `None`. `lists` containing empty lists, filtered at seed time by the `if node` guard rather than inside the pop loop. Every head carrying the same value, which is the case that exercises the tie-breaker and crashes any implementation that pushed bare nodes.

#### Python

Three-tuple `(val, index, node)` is critical — Python's heap compares tuples lexicographically, and the `index` tie-breaker prevents falling through to comparing `ListNode` objects (which would crash).

```python
import heapq

def mergeKLists(lists):
    heap = []
    for i, node in enumerate(lists):
        if node:
            heapq.heappush(heap, (node.val, i, node))
    dummy = curr = ListNode()
    while heap:
        val, i, node = heapq.heappop(heap)
        curr.next = node
        curr = curr.next
        if node.next:
            heapq.heappush(heap, (node.next.val, i, node.next))
    return dummy.next
```

#### Java

`PriorityQueue` is a min-heap by default; give it a `Comparator.comparingInt(n -> n.val)` so it orders by node value — no tie-breaker index needed since the comparator never falls through to comparing `ListNode` objects.

```java
import java.util.*;

class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        PriorityQueue<ListNode> heap =
            new PriorityQueue<>(Comparator.comparingInt(n -> n.val));
        for (ListNode node : lists) {
            if (node != null) heap.offer(node);
        }
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        while (!heap.isEmpty()) {
            ListNode node = heap.poll();
            curr.next = node;
            curr = curr.next;
            if (node.next != null) heap.offer(node.next);
        }
        return dummy.next;
    }
}
```

#### Rust

`BinaryHeap` is a max-heap by default; production code would wrap entries in `Reverse(...)` to invert. Owned `Box` linked lists make per-list-head heap entries painful, so this implementation flattens to a sorted vec and rebuilds — O(n log n) but trivial to write.

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}
impl ListNode { fn new(val: i32) -> Self { ListNode { val, next: None } } }

fn merge_k_lists(lists: Vec<Option<Box<ListNode>>>) -> Option<Box<ListNode>> {
    // Flatten into sorted vec then rebuild
    let mut vals: Vec<i32> = Vec::new();
    for mut list in lists {
        while let Some(node) = list {
            vals.push(node.val);
            list = node.next;
        }
    }
    vals.sort_unstable();
    let mut result: Option<Box<ListNode>> = None;
    for &v in vals.iter().rev() {
        result = Some(Box::new(ListNode { val: v, next: result }));
    }
    result
}
```

#### Go

Implementing `heap.Interface` requires five methods (`Len`, `Less`, `Swap`, `Push`, `Pop`) — verbose but explicit. The `interface{}` casts in `Push`/`Pop` predate generics; modern Go could use `container/heap` with a typed wrapper.

```go
import "container/heap"

type ListNode struct {
    Val  int
    Next *ListNode
}

type nodeHeap []*ListNode

func (h nodeHeap) Len() int            { return len(h) }
func (h nodeHeap) Less(i, j int) bool  { return h[i].Val < h[j].Val }
func (h nodeHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *nodeHeap) Push(x interface{}) { *h = append(*h, x.(*ListNode)) }
func (h *nodeHeap) Pop() interface{}   { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }

func mergeKLists(lists []*ListNode) *ListNode {
    h := &nodeHeap{}
    for _, node := range lists {
        if node != nil { heap.Push(h, node) }
    }
    dummy := &ListNode{}
    curr := dummy
    for h.Len() > 0 {
        node := heap.Pop(h).(*ListNode)
        curr.Next = node
        curr = curr.Next
        if node.Next != nil { heap.Push(h, node.Next) }
    }
    return dummy.Next
}
```

#### C++

`std::priority_queue` with custom comparator via lambda; `decltype(cmp)` lets you type the queue's third template parameter from the lambda. Reversed comparison (`a->val > b->val`) makes it a min-heap.

```cpp
#include <vector>
#include <queue>
#include <functional>

struct ListNode {
    int val;
    ListNode* next;
    ListNode(int v = 0, ListNode* n = nullptr) : val(v), next(n) {}
};

ListNode* mergeKLists(std::vector<ListNode*>& lists) {
    auto cmp = [](ListNode* a, ListNode* b){ return a->val > b->val; };
    std::priority_queue<ListNode*, std::vector<ListNode*>, decltype(cmp)> pq(cmp);
    for (auto* node : lists) if (node) pq.push(node);
    ListNode dummy;
    ListNode* curr = &dummy;
    while (!pq.empty()) {
        curr->next = pq.top(); pq.pop();
        curr = curr->next;
        if (curr->next) pq.push(curr->next);
    }
    return dummy.next;
}
```


### 48. Reverse Nodes in K-Group

#### Problem
Given a linked list and integer `k`, reverse the nodes in each group of `k` consecutive nodes. If the remaining nodes at the end are fewer than `k`, leave them as-is.

#### Examples

```text
Input: head = [1,2,3,4,5], k = 2
Output: [2,1,4,3,5]
Explanation: 5 is a leftover group of size 1, so it stays put.

Input: head = [1,2,3,4,5], k = 3
Output: [3,2,1,4,5]

Input: head = [1,2,3], k = 1
Output: [1,2,3]

Constraints:
- 1 <= k <= n <= 5000, where n is the number of nodes
- 0 <= node value <= 1000
- the nodes must be relinked; swapping values is not allowed
- follow-up: O(1) extra memory
```

#### Recognition
**Signals.** "Reverse the nodes in each group of `k`" plus "if fewer than `k` remain, leave them as-is". The leftover rule is the real tell: you have to know a full group exists *before* you disturb any of it, so each round starts with a `k`-step probe that is allowed to come back empty, and that probe is also the pointer you need for the relink. "Reverse" itself is the standard three-pointer walk. **Therefore.** A dummy node and a `group_prev` marker: probe `k` nodes ahead, and if the probe lands on a real node, reverse that span in place with `prev` seeded to the node *after* the group so the group's tail wires straight into the remainder, then patch `group_prev.next` to the probe. **Not recursion per group**, which reads far better but holds `n / k` frames, so `k = 1` on the maximum input parks 5000 frames on the stack and forfeits the `O(1)` memory the follow-up asks for. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Copy the values out, reverse them in slices, copy them back.

```python
def reverseKGroup(head, k):
    vals = []
    node = head
    while node:
        vals.append(node.val)
        node = node.next
    for i in range(0, len(vals) - k + 1, k):
        vals[i:i + k] = vals[i:i + k][::-1]
    node = head
    for v in vals:
        node.val = v
        node = node.next
    return head
```

`O(n)` time, `O(n)` space.

**Wasteful because.** The list is walked three times and `n` values are held in memory just to borrow Python's slice reversal, when the reversal only ever touches `k` consecutive nodes at a time. Worse, it moves *values* rather than nodes, which this problem explicitly forbids and which breaks the moment nodes carry any payload beyond `val`.

**Optimal.** Nothing here needs a buffer, because reversal only ever reads a node's own `next`. Hold `group_prev` on the node before the current group and probe `k` steps from it; if the probe returns `None` the tail is short and you stop, which is the leftover rule for free. Seeding `prev = group_next` instead of `None` is the whole trick: the group's last node is the first one rewritten, and it is pointed at the remainder immediately, so no separate stitching pass is needed afterwards. Then `group_prev.next` becomes the probe (the group's new head) and `group_prev` advances to the node that used to be first and is now the group's tail.

**Edge cases.** `k == 1` reverses each single node into itself, so the list is unchanged. When `n` is not a multiple of `k` the final short run is skipped because the probe returns `None`. A group that is exactly the whole list reverses once and `group_prev` then probes past the end.

#### Python

Helper `get_kth` walks `k` steps and returns `None` if the group is short — that's the loop-termination signal. The `prev = group_next` (not `None`) initial value is the trick that makes the reversal stop at the right boundary.

```python
def reverseKGroup(head, k):
    def get_kth(curr, k):
        while curr and k > 0:
            curr = curr.next
            k -= 1
        return curr

    dummy = ListNode(0, head)
    group_prev = dummy
    while True:
        kth = get_kth(group_prev, k)
        if not kth:
            break
        group_next = kth.next
        prev, curr = group_next, group_prev.next
        while curr != group_next:
            nxt = curr.next
            curr.next = prev
            prev = curr
            curr = nxt
        tmp = group_prev.next
        group_prev.next = kth
        group_prev = tmp
    return dummy.next
```

#### Java

Private `getKth` walks `k` steps and returns `null` on a short group — the loop-termination signal. The four-pointer dance (`groupPrev`, `kth`, `groupNext`, `tmp`) is identical to the C++/Go form; seed `prev = groupNext` so the reversal stops at the boundary.

```java
class Solution {
    public ListNode reverseKGroup(ListNode head, int k) {
        ListNode dummy = new ListNode(0, head);
        ListNode groupPrev = dummy;
        while (true) {
            ListNode kth = getKth(groupPrev, k);
            if (kth == null) break;
            ListNode groupNext = kth.next;
            ListNode prev = groupNext, curr = groupPrev.next;
            while (curr != groupNext) {
                ListNode nxt = curr.next;
                curr.next = prev;
                prev = curr;
                curr = nxt;
            }
            ListNode tmp = groupPrev.next;
            groupPrev.next = kth;
            groupPrev = tmp;
        }
        return dummy.next;
    }

    private ListNode getKth(ListNode curr, int k) {
        while (curr != null && k > 0) {
            curr = curr.next;
            k--;
        }
        return curr;
    }
}
```

#### Rust

Same `Box` ownership obstacle as the other linked-list problems. The values-to-vec, `chunks_mut(k).reverse()` chain is much shorter than a true in-place pointer reversal — sacrifices in-place for readability.

```rust
#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}
impl ListNode { fn new(val: i32) -> Self { ListNode { val, next: None } } }

fn reverse_k_group(head: Option<Box<ListNode>>, k: i32) -> Option<Box<ListNode>> {
    // Collect values, reverse in chunks, rebuild
    let mut vals = Vec::new();
    let mut cur = &head;
    while let Some(n) = cur { vals.push(n.val); cur = &n.next; }
    let k = k as usize;
    for chunk in vals.chunks_mut(k) {
        if chunk.len() == k { chunk.reverse(); }
    }
    let mut result: Option<Box<ListNode>> = None;
    for &v in vals.iter().rev() {
        result = Some(Box::new(ListNode { val: v, next: result }));
    }
    result
}
```

#### Go

Top-level helper `getKth` instead of a closure — Go's closure recursion is awkward, and the helper has no captures. Otherwise the algorithm shape is identical to Python.

```go
type ListNode struct {
    Val  int
    Next *ListNode
}

func reverseKGroup(head *ListNode, k int) *ListNode {
    dummy := &ListNode{Next: head}
    groupPrev := dummy
    for {
        kth := getKth(groupPrev, k)
        if kth == nil { break }
        groupNext := kth.Next
        prev, curr := groupNext, groupPrev.Next
        for curr != groupNext {
            nxt := curr.Next
            curr.Next = prev
            prev = curr
            curr = nxt
        }
        tmp := groupPrev.Next
        groupPrev.Next = kth
        groupPrev = tmp
    }
    return dummy.Next
}

func getKth(curr *ListNode, k int) *ListNode {
    for curr != nil && k > 0 {
        curr = curr.Next
        k--
    }
    return curr
}
```

#### C++

Same as Go but with raw pointers; the four-pointer dance (`groupPrev`, `kth`, `groupNext`, `tmp`) is identical across all three pointer-friendly languages.

```cpp
struct ListNode {
    int val;
    ListNode* next;
    ListNode(int v = 0, ListNode* n = nullptr) : val(v), next(n) {}
};

ListNode* getKth(ListNode* curr, int k) {
    while (curr && k-- > 0) curr = curr->next;
    return curr;
}

ListNode* reverseKGroup(ListNode* head, int k) {
    ListNode dummy(0, head);
    ListNode* groupPrev = &dummy;
    while (true) {
        ListNode* kth = getKth(groupPrev, k);
        if (!kth) break;
        ListNode* groupNext = kth->next;
        ListNode* prev = groupNext;
        ListNode* curr = groupPrev->next;
        while (curr != groupNext) {
            ListNode* nxt = curr->next;
            curr->next = prev;
            prev = curr;
            curr = nxt;
        }
        ListNode* tmp = groupPrev->next;
        groupPrev->next = kth;
        groupPrev = tmp;
    }
    return dummy.next;
}
```


### 49. Invert Binary Tree

#### Problem
Given the root of a binary tree, invert it (mirror left and right subtrees at every node) and return the root.

#### Examples

```text
Input: root = [4,2,7,1,3,6,9]
Output: [4,7,2,9,6,3,1]
Explanation: every node's two children trade places.

Input: root = [1,null,2]
Output: [1,2]
Explanation: a right-only child becomes a left-only child.

Input: root = []
Output: null

Constraints:
- 0 <= number of nodes <= 100
- -100 <= node value <= 100
- the tree is given in level order with null holes
```

#### Recognition
**Signals.** "Mirror the left and right subtrees at every node" is one rule stated in terms of subtrees and applying unchanged at each node, which is the shape of a recursive tree problem: solve both children, then do `O(1)` work at the parent. Nothing asks about ordering, depth, or search, so no traversal-specific bookkeeping is needed and the answer is the same tree object you were handed. **Therefore.** Recurse into both children and swap them; the swap can come before the calls (pre-order) or after them (post-order), and both land on the same tree because a node's swap never depends on what its subtrees became. **Not in-order DFS**, the one traversal that quietly breaks here: it recurses left, swaps, then recurses right, so the subtree it already inverted has just been moved into the right slot and gets inverted a second time back to the original, while the true right subtree is never visited at all. **O(n)** time, **O(h)** space.

#### Explanation
**Brute force.** Deep-copy the tree so the input is untouched, then mirror the copy.

```python
def invertTree(root):
    def copy(n):
        if not n:
            return None
        return TreeNode(n.val, copy(n.left), copy(n.right))

    def swap(n):
        if not n:
            return
        n.left, n.right = n.right, n.left
        swap(n.left)
        swap(n.right)

    out = copy(root)
    swap(out)
    return out
```

`O(n)` time, `O(n)` space.

**Wasteful because.** It traverses the whole tree twice to do work that commutes: the copy pass visits every node to allocate a twin, then the swap pass visits every node again to exchange two pointers. Nothing the copy learns is used by the swap, so the second walk re-derives a position the first walk was already standing on, and `n` freshly allocated nodes sit alongside the originals for the duration.

**Optimal.** Fuse the two walks, then notice the copy was never required. The problem returns a root, not a new tree, so mutating in place is allowed, and the swap at a node needs nothing but that node: exchange `left` and `right`, recurse into both, done in one pass with no allocation. Space drops from `n` nodes to `h` stack frames. When `h` is a worry, and a 5000-node right-leaning chain is exactly that, swap the recursion for a queue and do it breadth-first: pop a node, swap its two children, push both. The iterative form costs `O(w)` for the widest level instead of `O(h)`, which is the better trade on deep skinny trees and the worse one on wide bushy trees.

**Edge cases.** An empty tree returns `None` on the first line. A single node has two `None` children and swapping them is a no-op. A tree that is already its own mirror comes back looking identical, which is the correct answer, not a bug.

#### Python

The tuple assignment `root.left, root.right = invertTree(root.right), invertTree(root.left)` evaluates both calls before either assignment — order of recursion is well-defined.

```python
def invertTree(root):
    if not root:
        return None
    root.left, root.right = invertTree(root.right), invertTree(root.left)
    return root
```

#### Java

No parallel assignment in Java — grab the swapped subtrees into locals first, then recurse. Equivalent to the C++ `std::swap` then recurse; the base case returns `null`.

```java
class Solution {
    public TreeNode invertTree(TreeNode root) {
        if (root == null) return null;
        TreeNode left = invertTree(root.right);
        TreeNode right = invertTree(root.left);
        root.left = left;
        root.right = right;
        return root;
    }
}
```

#### Rust

`root.map(|mut node| { ... })` is the idiomatic 'do something to Option's inner value, returning a new Option'. `node.left.take()` is needed to move ownership out of `node` so it can be passed to the recursive call.

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}
impl TreeNode { fn new(val: i32) -> Self { TreeNode { val, left: None, right: None } } }

fn invert_tree(root: Option<Box<TreeNode>>) -> Option<Box<TreeNode>> {
    root.map(|mut node| {
        let left = invert_tree(node.left.take());
        let right = invert_tree(node.right.take());
        node.left = right;
        node.right = left;
        node
    })
}
```

#### Go

Parallel assignment `root.Left, root.Right = invertTree(root.Right), invertTree(root.Left)` — identical to Python's form. Both recursive calls complete before either field is assigned.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func invertTree(root *TreeNode) *TreeNode {
    if root == nil { return nil }
    root.Left, root.Right = invertTree(root.Right), invertTree(root.Left)
    return root
}
```

#### C++

`std::swap(root->left, root->right)` swaps pointers in place — no need to chain through return values. The two recursive calls happen after the swap; either order works.

```cpp
struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

TreeNode* invertTree(TreeNode* root) {
    if (!root) return nullptr;
    std::swap(root->left, root->right);
    invertTree(root->left);
    invertTree(root->right);
    return root;
}
```


### 50. Maximum Depth of Binary Tree

#### Problem
Given the root of a binary tree, return its maximum depth: the number of nodes along the longest path from root to leaf.

#### Examples

```text
Input: root = [3,9,20,null,null,15,7]
Output: 3

Input: root = [1,null,2]
Output: 2

Input: root = []
Output: 0

Constraints:
- 0 <= number of nodes <= 10^4
- -100 <= node value <= 100
- depth counts nodes on the path, not edges
```

#### Recognition
**Signals.** A `TreeNode` root, and a quantity whose value at any node is fully determined by the same quantity at its two children: the depth below a node is one more than the deeper of its subtrees. That self-similarity is the tell, and it points at bottom-up recursion specifically, because nothing has to be passed *down* and everything is returned *up*. The second signal is negative: there is no pruning available, since the deeper side could be either one, so every node must be visited and `O(n)` is the floor rather than a compromise. **Therefore.** Postorder recursion, with `None` returning 0 and a node returning `1 + max(left, right)`. **Not level-order BFS**, which is equally correct at the same `O(n)` time but holds an entire tree level in a queue, up to `O(n)` nodes on a wide tree, against `O(h)` stack frames here; it earns its place only when the tree is deep enough to blow the call stack. **O(n)** time, **O(h)** space.

#### Explanation
**Brute force.** Enumerate every root-to-leaf path and take the longest.

```python
def maxDepth(root):
    best = 0
    def walk(node, path):
        nonlocal best
        if not node:
            return
        path = path + [node.val]
        if not node.left and not node.right:
            best = max(best, len(path))
        walk(node.left, path)
        walk(node.right, path)
    walk(root, [])
    return best
```

`O(n * h)` time, `O(h^2)` space.

**Wasteful because.** `path + [node.val]` builds a fresh copy on every call, so a node at depth `d` pays `d` list writes and the prefix shared by two siblings is copied once for each of them. The contents of the path are then never read: only `len(path)` is. The whole accumulator exists to carry a number that could have been carried as a number.

**Optimal.** Ask each subtree for its own answer instead of threading state through the walk. `maxDepth(None)` is 0, and `maxDepth(node)` is `1 + max(maxDepth(node.left), maxDepth(node.right))`. Because the null case returns 0, an empty tree and a missing child are the same case, and the leaf test disappears entirely: a leaf is just a node whose two children both answer 0. Every node is asked exactly once, so the time is `O(n)` with a constant of two calls per node. The space is the call stack, `O(h)`, which is `O(log n)` on a balanced tree and `O(n)` on a chain. That worst case is the one to name aloud in an interview, and it is where an explicit stack or a level-counting BFS becomes the safer implementation.

**Edge cases.** An empty tree returns 0 through the base case, with no null check anywhere else. A single node returns 1. A fully skewed chain of `n` nodes returns `n` and recurses `n` deep, which is where CPython's default recursion limit of about 1000 frames bites first.

#### Python

Three lines including the base case. `max` of the two recursive calls is the entire algorithm.

```python
def maxDepth(root):
    if not root:
        return 0
    return 1 + max(maxDepth(root.left), maxDepth(root.right))
```

#### Java

`Math.max` of the two recursive calls is the whole algorithm; the `null` base case returns 0 and makes the recursion self-terminating.

```java
class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) return 0;
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }
}
```

#### Rust

Pattern match on `Option` — `None => 0`, `Some(node) => 1 + ...`. `max_depth(node.left).max(max_depth(node.right))` uses the method form of `max` on `i32`.

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}

fn max_depth(root: Option<Box<TreeNode>>) -> i32 {
    match root {
        None => 0,
        Some(node) => 1 + max_depth(node.left).max(max_depth(node.right)),
    }
}
```

#### Go

Pre-1.21, the `if l > r` ladder replaces a missing `max` builtin — verbose but unavoidable for the historical Go.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func maxDepth(root *TreeNode) int {
    if root == nil { return 0 }
    l, r := maxDepth(root.Left), maxDepth(root.Right)
    if l > r { return 1 + l }
    return 1 + r
}
```

#### C++

Single-line return using `std::max`. Reads almost identically to Python.

```cpp
struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

int maxDepth(TreeNode* root) {
    if (!root) return 0;
    return 1 + std::max(maxDepth(root->left), maxDepth(root->right));
}
```


### 51. Diameter of Binary Tree

#### Problem
Given the root of a binary tree, return the length of the diameter — the longest path between any two nodes (the path does not need to pass through the root). The length is the number of edges.

#### Examples

```text
Input: root = [1,2,3,4,5]
Output: 3
Explanation: the path 4 -> 2 -> 1 -> 3 has 3 edges.

Input: root = [1,2,null,3,null,4]
Output: 3

Input: root = [1]
Output: 0

Constraints:
- 1 <= number of nodes <= 10^4
- -100 <= Node.val <= 100
- length is counted in edges, not nodes
```

#### Recognition
**Signals.** "The longest path between any two nodes" together with "the path does not need to pass through the root". That second phrase is the whole problem: the answer is a maximum taken over every node, so no single measurement from the top can see it. A path in a tree bends at exactly one node and runs downward on both sides of that bend, so its length there is the depth of the deepest left descendant plus the depth of the deepest right descendant. **Therefore.** One postorder pass in which every call returns its own height to its parent while a running maximum absorbs `l + r` at each node. The value returned and the value being maximised are deliberately different quantities riding the same recursion. **Not BFS level order**, which hands you nodes grouped by depth but gives a node no channel to receive its subtrees' heights, so you would end up re-measuring heights per node anyway. **O(n)** time, **O(h)** space.

#### Explanation
**Brute force.** Measure both subtree heights at every node.

```python
def diameterOfBinaryTree(root):
    def height(node):
        if not node:
            return 0
        return 1 + max(height(node.left),
                       height(node.right))
    if not root:
        return 0
    through = height(root.left) + height(root.right)
    return max(through,
               diameterOfBinaryTree(root.left),
               diameterOfBinaryTree(root.right))
```

`O(n^2)` time, `O(h)` space.

**Wasteful because.** `height` is a full traversal of a subtree, and it is invoked again from every one of that subtree's ancestors. A node at depth `d` has its height recomputed `d` times, so on a chain of 10^4 nodes the identical walk is repeated 10^4 times.

**Optimal.** The height a parent needs is exactly what the child's own call already computed, so return it instead of recomputing it. Each call hands `1 + max(l, r)` upward, and on the way updates a shared maximum with `l + r`, the length of the path that bends at this node. Every node is visited once and every path is considered once, at its unique bend, so the maximum is complete. The answer is a bottom-up accumulation, not a top-down pass: nothing useful flows downward, and the only reason a shared variable appears at all is that the recursion's return slot is already occupied by the height. Swapping the two expressions is the standard bug.

**Edge cases.** A single node has diameter 0, since both heights are 0. A chain has diameter `n - 1` and one of `l`, `r` is always 0 there. Edges rather than nodes, so a two-node tree answers 1, not 2.

#### Python

`res = [0]` is the standard 'mutable box' trick for closure-shared state in Python — `nonlocal` would also work but `[0]` requires no declaration. DFS returns height while updating diameter as a side effect.

```python
def diameterOfBinaryTree(root):
    res = [0]
    def dfs(node):
        if not node:
            return 0
        l, r = dfs(node.left), dfs(node.right)
        res[0] = max(res[0], l + r)
        return 1 + max(l, r)
    dfs(root)
    return res[0]
```

#### Java

Java has no `nonlocal`, so a one-element `int[] res` is the standard mutable-box for closure-shared state threaded through the recursive helper. `dfs` returns height while updating `res[0]` as a side effect.

```java
class Solution {
    public int diameterOfBinaryTree(TreeNode root) {
        int[] res = {0};
        dfs(root, res);
        return res[0];
    }

    private int dfs(TreeNode node, int[] res) {
        if (node == null) return 0;
        int l = dfs(node.left, res);
        int r = dfs(node.right, res);
        res[0] = Math.max(res[0], l + r);
        return 1 + Math.max(l, r);
    }
}
```

#### Rust

Pass `&mut i32` for the running max — Rust's explicit mutability makes the side-effect channel visible at the call site. Inner `fn dfs` instead of a closure because Rust closures can't recurse without `Box<dyn Fn>` tricks.

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}

fn diameter_of_binary_tree(root: Option<Box<TreeNode>>) -> i32 {
    fn dfs(node: &Option<Box<TreeNode>>, res: &mut i32) -> i32 {
        match node {
            None => 0,
            Some(n) => {
                let l = dfs(&n.left, res);
                let r = dfs(&n.right, res);
                *res = (*res).max(l + r);
                1 + l.max(r)
            }
        }
    }
    let mut res = 0;
    dfs(&root, &mut res);
    res
}
```

#### Go

Declare-then-assign closure for self-reference (Go can't recurse a closure declared inline). Pre-1.21 needs the `if l > r` ladder instead of a `max` builtin.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func diameterOfBinaryTree(root *TreeNode) int {
    res := 0
    var dfs func(*TreeNode) int
    dfs = func(node *TreeNode) int {
        if node == nil { return 0 }
        l, r := dfs(node.Left), dfs(node.Right)
        if l+r > res { res = l + r }
        if l > r { return 1 + l }
        return 1 + r
    }
    dfs(root)
    return res
}
```

#### C++

Top-level `dfs` taking `int& res` — reference parameter is the C++ way to thread shared state without globals. `std::max` keeps the body terse.

```cpp
#include <algorithm>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

int dfs(TreeNode* node, int& res) {
    if (!node) return 0;
    int l = dfs(node->left, res), r = dfs(node->right, res);
    res = std::max(res, l + r);
    return 1 + std::max(l, r);
}

int diameterOfBinaryTree(TreeNode* root) {
    int res = 0;
    dfs(root, res);
    return res;
}
```


### 52. Balanced Binary Tree

#### Problem
Given the root of a binary tree, return `true` if it is height-balanced — every node's left and right subtrees differ in height by at most 1.

#### Examples

```text
Input: root = [3,9,20,null,null,15,7]
Output: true

Input: root = [1,2,2,3,3,null,null,4,4]
Output: false
Explanation: left subtree height 3, right subtree height 1.

Input: root = []
Output: true

Constraints:
- 0 <= number of nodes <= 5000
- -10^4 <= Node.val <= 10^4
- balanced means every node, not just the root
```

#### Recognition
**Signals.** "Every node's left and right subtrees differ in height by at most 1" quantifies over every node, and height is defined by descendants, so the verdict at a node cannot be reached before its children have reported. That is the signature of a bottom-up answer. The second tell is that height and balance need the same traversal: whatever computes one has already walked everything the other needs. **Therefore.** One postorder pass that returns a height, with `-1` reserved as a sentinel meaning "something below me is already unbalanced", which propagates to the root without any further comparison. **Not the top-down version** that calls a separate `height(node)` at every node, which is what most people write first: a node's height is then recomputed once per ancestor, giving `O(n^2)` on a 5000-node chain. **O(n)** time, **O(h)** space.

#### Explanation
**Brute force.** Ask for both subtree heights at every node, from scratch.

```python
def isBalanced(root):
    def height(node):
        if not node:
            return 0
        return 1 + max(height(node.left),
                       height(node.right))
    if not root:
        return True
    if abs(height(root.left) - height(root.right)) > 1:
        return False
    return (isBalanced(root.left)
            and isBalanced(root.right))
```

`O(n^2)` time, `O(h)` space.

**Wasteful because.** `height` walks a whole subtree, and `isBalanced` then calls it again at every descendant of that subtree. Each node is counted once per ancestor above it, so a one-sided chain of 5000 nodes performs about 12.5 million node visits to produce one boolean.

**Optimal.** Fold the two walks into one. A single postorder call returns the height of its subtree, which is precisely the number its parent needs, so nothing is ever measured twice. Then carry the verdict in that same return value: `-1` means "unbalanced somewhere below", and a parent seeing `-1` from either child returns `-1` at once, so the first violation short-circuits the whole remainder of the tree. The sentinel is safe because a genuine height is never negative, so the two meanings cannot collide. Both pieces of information travel bottom-up on one channel, which is what collapses `O(n^2)` to `O(n)`.

**Edge cases.** An empty tree is balanced with height 0, which is also the recursion's base case. A single node is balanced. The check is per node, so a tree whose root subtrees differ by 0 can still fail deeper, as example 2 would if the imbalance sat one level down.

#### Python

The `-1` sentinel is the elegance — it both signals 'imbalanced' and short-circuits via the `or` chain. `abs(l - r) > 1` is the balance check.

```python
def isBalanced(root):
    def dfs(node):
        if not node:
            return 0
        l, r = dfs(node.left), dfs(node.right)
        if l == -1 or r == -1 or abs(l - r) > 1:
            return -1
        return 1 + max(l, r)
    return dfs(root) != -1
```

#### Java

The `-1` sentinel both signals "imbalanced" and short-circuits every ancestor call. `Math.abs(l - r) > 1` is the balance check; `dfs(root) != -1` collapses to the boolean answer.

```java
class Solution {
    public boolean isBalanced(TreeNode root) {
        return dfs(root) != -1;
    }

    private int dfs(TreeNode node) {
        if (node == null) return 0;
        int l = dfs(node.left);
        int r = dfs(node.right);
        if (l == -1 || r == -1 || Math.abs(l - r) > 1) return -1;
        return 1 + Math.max(l, r);
    }
}
```

#### Rust

Same `-1` sentinel as Python; `(l - r).abs()` is the method form. Inner `fn dfs` for the same recursion-can't-be-closure reason as problem 51.

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}

fn is_balanced(root: Option<Box<TreeNode>>) -> bool {
    fn dfs(node: &Option<Box<TreeNode>>) -> i32 {
        match node {
            None => 0,
            Some(n) => {
                let l = dfs(&n.left);
                let r = dfs(&n.right);
                if l == -1 || r == -1 || (l - r).abs() > 1 { -1 }
                else { 1 + l.max(r) }
            }
        }
    }
    dfs(&root) != -1
}
```

#### Go

Two explicit comparisons (`l-r > 1 || r-l > 1`) replace `abs` to avoid a `math.Abs` cast through `float64`. Slightly more verbose but stays in `int`.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func isBalanced(root *TreeNode) bool {
    var dfs func(*TreeNode) int
    dfs = func(node *TreeNode) int {
        if node == nil { return 0 }
        l, r := dfs(node.Left), dfs(node.Right)
        if l == -1 || r == -1 || l-r > 1 || r-l > 1 { return -1 }
        if l > r { return 1 + l }
        return 1 + r
    }
    return dfs(root) != -1
}
```

#### C++

`std::abs(l - r)` on `int` works directly; the sentinel propagates the same way. Top-level `dfs` is the C++ idiom for recursive helpers.

```cpp
#include <algorithm>
#include <cstdlib>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

int dfs(TreeNode* node) {
    if (!node) return 0;
    int l = dfs(node->left), r = dfs(node->right);
    if (l == -1 || r == -1 || std::abs(l - r) > 1) return -1;
    return 1 + std::max(l, r);
}

bool isBalanced(TreeNode* root) { return dfs(root) != -1; }
```


### 53. Same Tree

#### Problem
Given the roots of two binary trees, return `true` if they are structurally identical with the same node values at every position.

#### Examples

```text
Input: p = [1,2,3], q = [1,2,3]
Output: true

Input: p = [1,2], q = [1,null,2]
Output: false
Explanation: same values, mirrored shape.

Input: p = [1,2,1], q = [1,1,2]
Output: false

Constraints:
- 0 <= nodes in each tree <= 100
- -10^4 <= Node.val <= 10^4
- both shape and values must match
```

#### Recognition
**Signals.** "Structurally identical with the same node values at every position" bolts two conditions together, shape and content, and both are local: two trees are the same exactly when their roots agree and their left subtrees are the same and their right subtrees are the same. A property that decomposes into the same property on the children is a recursion you can transcribe straight from the sentence. **Therefore.** Walk both trees in lockstep with one function taking two nodes, returning `False` the instant a null pattern or a value disagrees, so the traversal aborts at the first difference instead of finishing. **Not comparing traversal outputs**, the tempting shortcut: a bare preorder list is ambiguous without null markers, since `[1,2]` describes two different trees, and the preorder-plus-inorder pair only pins down a tree when all values are distinct, which nothing here promises. **O(n)** time, **O(h)** space.

#### Explanation
**Brute force.** Serialise both trees in full, then compare the two sequences.

```python
def isSameTree(p, q):
    def ser(node, out):
        if not node:
            out.append(None)
            return
        out.append(node.val)
        ser(node.left, out)
        ser(node.right, out)
    a, b = [], []
    ser(p, a)
    ser(q, b)
    return a == b
```

`O(n)` time, `O(n)` space.

**Wasteful because.** Both trees are walked to completion before a single comparison happens, so two trees whose roots already disagree still cost `2n` appends and `2n` list cells. Nothing is recomputed here; the work is simply done before anyone asks whether it was needed.

**Optimal.** Interleave the two walks so the comparison happens at each node instead of at the end. One function takes both nodes and covers four cases in three lines: both null is a match, exactly one null is a mismatch, unequal values is a mismatch, and otherwise recurse on the two left children and then the two right children. Python's `and` short-circuits, so a failure anywhere in the left subtree never touches the right one. Nothing is stored, so the only memory is the call stack at `O(h)`. Keep the serialising version when one tree must be compared against many, since each serialisation is then computed once and reused.

**Edge cases.** Two empty trees are the same. One empty and one not is caught by the second base case, before any `.val` is dereferenced. Mirror images such as `[1,2]` and `[1,null,2]` hold the same values and fail purely on the null pattern.

#### Python

Three lines of base cases collapse all the structural mismatches; the recursive `and` short-circuits on the first mismatch.

```python
def isSameTree(p, q):
    if not p and not q:
        return True
    if not p or not q or p.val != q.val:
        return False
    return isSameTree(p.left, q.left) and isSameTree(p.right, q.right)
```

#### Java

Three base-case lines cover every structural mismatch; the recursive `&&` short-circuits so the right subtree is skipped once the left fails. Reads identically to the C++/Go pointer form.

```java
class Solution {
    public boolean isSameTree(TreeNode p, TreeNode q) {
        if (p == null && q == null) return true;
        if (p == null || q == null || p.val != q.val) return false;
        return isSameTree(p.left, q.left) && isSameTree(p.right, q.right);
    }
}
```

#### Rust

Tuple match `(p, q)` is the cleanest expression of the four cases — `(None, None)`, `(Some, Some)`, and `_` for the mixed case. No null checks needed.

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}

fn is_same_tree(p: Option<Box<TreeNode>>, q: Option<Box<TreeNode>>) -> bool {
    match (p, q) {
        (None, None) => true,
        (Some(pn), Some(qn)) => {
            pn.val == qn.val
                && is_same_tree(pn.left, qn.left)
                && is_same_tree(pn.right, qn.right)
        }
        _ => false,
    }
}
```

#### Go

Identical shape to Python — pointer nil-checks instead of `not p`. Short-circuit `&&` halts on the first mismatch.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func isSameTree(p *TreeNode, q *TreeNode) bool {
    if p == nil && q == nil { return true }
    if p == nil || q == nil || p.Val != q.Val { return false }
    return isSameTree(p.Left, q.Left) && isSameTree(p.Right, q.Right)
}
```

#### C++

Raw pointer null-checks; otherwise reads identically to Go. The `&&` chain is the same short-circuit story.

```cpp
struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

bool isSameTree(TreeNode* p, TreeNode* q) {
    if (!p && !q) return true;
    if (!p || !q || p->val != q->val) return false;
    return isSameTree(p->left, q->left) && isSameTree(p->right, q->right);
}
```


### 54. Subtree of Another Tree

#### Problem
Given the roots of two binary trees `root` and `subRoot`, return `true` if there is a node in `root` whose subtree is identical to `subRoot`.

#### Examples

```text
Input: root = [3,4,5,1,2], subRoot = [4,1,2]
Output: true

Input: root = [3,4,5,1,2], subRoot = [4,1]
Output: false
Explanation: root's node 4 has a right child, subRoot's has none.

Input: root = [1,1], subRoot = [1]
Output: true

Constraints:
- 1 <= nodes in root <= 2000
- 1 <= nodes in subRoot <= 1000
- -10^4 <= Node.val <= 10^4
```

#### Recognition
**Signals.** "There is a node in `root` whose subtree is identical to `subRoot`" names two separate jobs: pick a candidate node, then test identity there. Identity of two trees is problem 53 and already costs `O(n)`, so the only new decision is which nodes to test, and "a node in root" with no qualifier means all of them. **Therefore.** Walk `root`, and at each node run the same-tree comparison against `subRoot`, stopping at the first success. Two nested recursions: the outer one enumerates candidates, the inner one compares. **Not anchoring on the first node whose value equals `subRoot.val`**, the natural shortcut, which breaks the moment values repeat: `root = [1,1]` against `subRoot = [1]` fails at the root and succeeds at the child, so a failed candidate says nothing about its descendants and every candidate has to stay live. **O(m * n)** time, **O(h)** space.

#### Explanation
**Brute force.** Serialise every subtree of `root`, then look up `subRoot`'s serialisation.

```python
def isSubtree(root, subRoot):
    def ser(node):
        if not node:
            return "#"
        return ("," + str(node.val) + ser(node.left)
                + ser(node.right))
    seen = []
    def walk(node):
        if not node:
            return
        seen.append(ser(node))
        walk(node.left)
        walk(node.right)
    walk(root)
    return ser(subRoot) in seen
```

`O(m^2)` time, `O(m^2)` space.

**Wasteful because.** Every subtree is written out in full, including the candidates that a single root value comparison would have thrown away. On a chain the stored strings sum to about `m^2 / 2` characters, all held in memory at once, to produce one boolean.

**Optimal.** Materialise nothing. Walk `root` and at each node compare against `subRoot` directly with the same-tree recursion, which returns `False` at the first differing value and so usually costs `O(1)` rather than `O(n)`. Memory falls to the two call stacks at `O(h)`. The worst case is still `O(m * n)` and it is genuinely reachable: 2000 identical values in `root` against 1000 identical values in `subRoot` drives nearly every comparison to completion. That is when the third approach earns its complexity. Serialise both trees once with explicit null markers, then run KMP to locate one string inside the other for `O(m + n)` time and space. The null markers are what make the substring test sound; without them a match can land on a fragment that is not a whole subtree.

**Edge cases.** Because a failed match at a node tells you nothing about its children, the recursion must continue past every failure. A leaf `subRoot` matches any leaf of `root` carrying the same value. `subRoot` is guaranteed non-empty here, and this code answers `False` for an empty one rather than the conventional `True`.

#### Python

Nested `isSameTree` keeps the helper scoped to this problem. The `if isSameTree(root, subRoot): return True` check happens at every node — naive but readable.

```python
def isSubtree(root, subRoot):
    def isSameTree(p, q):
        if not p and not q: return True
        if not p or not q or p.val != q.val: return False
        return isSameTree(p.left, q.left) and isSameTree(p.right, q.right)

    if not root:
        return False
    if isSameTree(root, subRoot):
        return True
    return isSubtree(root.left, subRoot) or isSubtree(root.right, subRoot)
```

#### Java

Reuse `isSameTree` as a private helper; the `||` recursion halts as soon as a match is found. Straightforward O(m * n) DFS — no KMP-on-serialization speedup.

```java
class Solution {
    public boolean isSubtree(TreeNode root, TreeNode subRoot) {
        if (root == null) return false;
        if (isSameTree(root, subRoot)) return true;
        return isSubtree(root.left, subRoot) || isSubtree(root.right, subRoot);
    }

    private boolean isSameTree(TreeNode p, TreeNode q) {
        if (p == null && q == null) return true;
        if (p == null || q == null || p.val != q.val) return false;
        return isSameTree(p.left, q.left) && isSameTree(p.right, q.right);
    }
}
```

#### Rust

Pass `&Option<Box<TreeNode>>` everywhere to avoid moves — references compose freely with the pattern match. The `is_same(root, sub)` is called against the *outer* `root` not `node` because the function signature wants references.

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}

fn is_same(p: &Option<Box<TreeNode>>, q: &Option<Box<TreeNode>>) -> bool {
    match (p, q) {
        (None, None) => true,
        (Some(a), Some(b)) => a.val == b.val && is_same(&a.left, &b.left) && is_same(&a.right, &b.right),
        _ => false,
    }
}

fn is_subtree(root: &Option<Box<TreeNode>>, sub: &Option<Box<TreeNode>>) -> bool {
    match root {
        None => false,
        Some(node) => {
            is_same(root, sub)
                || is_subtree(&node.left, sub)
                || is_subtree(&node.right, sub)
        }
    }
}
```

#### Go

Top-level `isSameTree` and `isSubtree` — no nested functions in Go. The recursive `||` short-circuits as soon as a match is found.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func isSameTree(p, q *TreeNode) bool {
    if p == nil && q == nil { return true }
    if p == nil || q == nil || p.Val != q.Val { return false }
    return isSameTree(p.Left, q.Left) && isSameTree(p.Right, q.Right)
}

func isSubtree(root *TreeNode, subRoot *TreeNode) bool {
    if root == nil { return false }
    if isSameTree(root, subRoot) { return true }
    return isSubtree(root.Left, subRoot) || isSubtree(root.Right, subRoot)
}
```

#### C++

Two top-level functions; identical control flow to Go. The `O(m * n)` complexity is the same across all four — none of them implement the KMP-on-serialization speedup.

```cpp
struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

bool isSame(TreeNode* p, TreeNode* q) {
    if (!p && !q) return true;
    if (!p || !q || p->val != q->val) return false;
    return isSame(p->left, q->left) && isSame(p->right, q->right);
}

bool isSubtree(TreeNode* root, TreeNode* subRoot) {
    if (!root) return false;
    if (isSame(root, subRoot)) return true;
    return isSubtree(root->left, subRoot) || isSubtree(root->right, subRoot);
}
```


### 55. Lowest Common Ancestor of a Binary Search Tree

#### Problem
Given a BST and two nodes `p` and `q`, find their lowest common ancestor (the deepest node that is an ancestor of both).

#### Examples

```text
Input: root = [6,2,8,0,4,7,9,null,null,3,5], p = [2], q = [8]
Output: [6,2,8,0,4,7,9,null,null,3,5]
Explanation: 2 and 8 split at the root, so the answer is 6.

Input: root = [6,2,8,0,4,7,9,null,null,3,5], p = [2], q = [4]
Output: [2,0,4,null,null,3,5]

Input: root = [2,1], p = [2], q = [1]
Output: [2,1]

Constraints:
- 2 <= number of nodes <= 10^5
- all Node.val are unique, and p != q
- p and q both exist in the tree
- Output prints the subtree rooted at the answer node
```

#### Recognition
**Signals.** Two words carry it, "BST" and "lowest". A BST supplies a total order, so from any node one value comparison says which side a target lies on, and the lowest common ancestor of `p` and `q` is precisely the first node where those two answers disagree. Above that node both targets sit on the same side, so the other half can be discarded outright; below it they are separated forever. **Therefore.** Walk down from the root, going left while both values are smaller and right while both are larger, and return the node where the walk stops, which is either the split point or one of `p` and `q` itself. **Not the general binary tree LCA**, the postorder that returns `p` or `q` upward and merges where they join: it is correct but visits all 10^5 nodes to learn what one comparison per level already reveals. **Not recursion at all**, since a BST may be a chain of 10^5 nodes and this descent needs no stack. **O(h)** time, **O(1)** space.

#### Explanation
**Brute force.** Use the algorithm that works on any binary tree: ask each subtree whether it contains both targets.

```python
def lowestCommonAncestor(root, p, q):
    def has(node, t):
        if not node:
            return False
        return (node.val == t.val or has(node.left, t)
                or has(node.right, t))
    cur = root
    while True:
        if has(cur.left, p) and has(cur.left, q):
            cur = cur.left
        elif has(cur.right, p) and has(cur.right, q):
            cur = cur.right
        else:
            return cur
```

`O(n * h)` time, `O(h)` space.

**Wasteful because.** `has` is a full subtree scan and it runs up to four times per level of the descent. It rediscovers by exhaustive search the one fact the BST invariant states for free: whether a value lies to the left or the right of the current node.

**Optimal.** Replace each scan with a comparison. At the current node, if `p.val` and `q.val` are both smaller then both targets live in the left subtree, so the answer cannot be here or anywhere to the right; go left. Both larger, go right. Anything else means either the pair straddles this node or one of them is this node, and both cases make this node the lowest ancestor of the pair, so stop. Each step discards half the remaining tree, giving `O(h)`, which is `O(log n)` on a balanced BST. Because the descent never backtracks, the answer is found on the way down rather than returned on the way up, so a single reassigned pointer suffices and the space is `O(1)`. That is why the shipped solution is a loop and not a recursion.

**Edge cases.** A node is its own ancestor, so `p` being an ancestor of `q` returns `p`, handled by the final branch and not by a special case. `p` and `q` may arrive in either order, since both comparisons are two-sided. On a plain binary tree the ordering test would be meaningless and the postorder version above would be required.

#### Python

Iterative `while root` — no recursion, no stack. The 'else' branch (the split point) is the answer; assignment to `root` walks down on the matching side.

```python
def lowestCommonAncestor(root, p, q):
    while root:
        if p.val < root.val and q.val < root.val:
            root = root.left
        elif p.val > root.val and q.val > root.val:
            root = root.right
        else:
            return root
```

#### Java

Iterative pointer reassignment walks the BST with O(1) space — no recursion, no stack. The `else` branch (the split point) is the answer.

```java
class Solution {
    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        while (root != null) {
            if (p.val < root.val && q.val < root.val) {
                root = root.left;
            } else if (p.val > root.val && q.val > root.val) {
                root = root.right;
            } else {
                return root;
            }
        }
        return null;
    }
}
```

#### Rust

Walks via `&Option<Box<TreeNode>>` references — no ownership moves. Returns the value `i32` rather than the node because re-extracting a `Box` from a reference would require cloning.

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}

fn lowest_common_ancestor(root: Option<Box<TreeNode>>, p: i32, q: i32) -> i32 {
    let mut cur = &root;
    loop {
        if let Some(node) = cur {
            if p < node.val && q < node.val { cur = &node.left; }
            else if p > node.val && q > node.val { cur = &node.right; }
            else { return node.val; }
        } else { return -1; }
    }
}
```

#### Go

Idiomatic — pointer reassignment walks the tree without any allocation. Returns the actual `*TreeNode` per the LeetCode signature.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func lowestCommonAncestor(root, p, q *TreeNode) *TreeNode {
    for root != nil {
        if p.Val < root.Val && q.Val < root.Val {
            root = root.Left
        } else if p.Val > root.Val && q.Val > root.Val {
            root = root.Right
        } else {
            return root
        }
    }
    return nil
}
```

#### C++

Same pointer-walk pattern as Go. The `while (root)` form with `return root` in the else branch is the tightest expression of the algorithm.

```cpp
struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {
    while (root) {
        if (p->val < root->val && q->val < root->val) root = root->left;
        else if (p->val > root->val && q->val > root->val) root = root->right;
        else return root;
    }
    return nullptr;
}
```


### 56. Binary Tree Level Order Traversal

#### Problem
Given the root of a binary tree, return the node values grouped by level — left to right, top to bottom — as a list of lists.

#### Examples

```text
Input: root = [3,9,20,null,null,15,7]
Output: [[3],[9,20],[15,7]]
Explanation: three levels, read left to right.

Input: root = [1]
Output: [[1]]

Input: root = []
Output: []

Constraints:
- 0 <= number of nodes <= 2000
- -1000 <= Node.val <= 1000
```

#### Recognition
**Signals.** "Grouped by level" and "top to bottom" say the output is indexed by distance from the root, and the grouping is part of the answer rather than a side effect. Any structure that hands you nodes in distance order is a queue, and the only missing piece is knowing where one level stops. **Therefore.** BFS from a queue, taking `len(q)` as a snapshot before each level and popping exactly that many nodes; every child enqueued during that inner loop belongs to the next level by construction. **Not recursive DFS in visit order**, because a preorder walk reaches depth 3 down the left spine before it ever sees the root's right child, so appending as you go interleaves levels. You can repair it by passing a depth and writing into `res[depth]`, but that is simulating the queue rather than using one. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Measure the height, then collect each depth with its own full traversal.

```python
def levelOrder(root):
    def height(node):
        if not node:
            return 0
        return 1 + max(height(node.left), height(node.right))
    def at(node, d):
        if not node:
            return []
        if d == 0:
            return [node.val]
        return at(node.left, d - 1) + at(node.right, d - 1)
    return [at(root, d) for d in range(height(root))]
```

`O(n * h)` time, `O(h)` space.

**Wasteful because.** Every level restarts from the root, so the path down to depth `d` is retraced once for each of the `d` levels above it. On a skewed tree that is `O(n^2)`.

**Optimal.** Visit each node once and let a FIFO queue do the ordering: pop the root, push its children, and the queue always holds nodes in nondecreasing depth. The only thing a plain queue loses is the level boundary, and reading `len(q)` before the inner loop recovers it exactly, since at that instant the queue holds the current level and nothing else. Pop that many, emit them as one group, and the pushes from this pass form the next level. A DFS carrying a depth argument and appending into `res[depth]` is equally `O(n)` and wins when you also need parent or path state, which recursion tracks for free.

**Edge cases.** A null root returns `[]`, not `[[]]`. A single node is one level of one value. A left-skewed chain of `n` nodes gives `n` groups of one. Queue space peaks at the widest level, which is `n/2` for a complete tree, so `O(n)` space is tight.

#### Python

`deque.popleft()` is O(1) — a plain list would be O(n) per pop. The `for _ in range(len(q))` snapshot is what separates levels.

```python
from collections import deque

def levelOrder(root):
    if not root:
        return []
    res, q = [], deque([root])
    while q:
        level = []
        for _ in range(len(q)):
            node = q.popleft()
            level.append(node.val)
            if node.left: q.append(node.left)
            if node.right: q.append(node.right)
        res.append(level)
    return res
```

#### Java

`ArrayDeque` is the fast, non-synchronized deque — `offer`/`poll` are O(1), unlike a legacy `LinkedList`-as-queue. Snapshot `queue.size()` before the inner loop so children enqueued this pass land in the next level.

```java
import java.util.*;

class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> res = new ArrayList<>();
        if (root == null) return res;
        Deque<TreeNode> queue = new ArrayDeque<>();
        queue.offer(root);
        while (!queue.isEmpty()) {
            int size = queue.size();
            List<Integer> level = new ArrayList<>();
            for (int i = 0; i < size; i++) {
                TreeNode node = queue.poll();
                level.add(node.val);
                if (node.left != null) queue.offer(node.left);
                if (node.right != null) queue.offer(node.right);
            }
            res.add(level);
        }
        return res;
    }
}
```

#### Rust

`VecDeque::pop_front` is O(1). The level-size snapshot via `let size = queue.len()` before the inner loop is the same trick — children enqueued during the loop belong to the next level.

```rust
use std::collections::VecDeque;

#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}

fn level_order(root: Option<Box<TreeNode>>) -> Vec<Vec<i32>> {
    let mut res = Vec::new();
    if root.is_none() { return res; }
    let mut queue = VecDeque::new();
    queue.push_back(root.unwrap());
    while !queue.is_empty() {
        let size = queue.len();
        let mut level = Vec::new();
        for _ in 0..size {
            let node = queue.pop_front().unwrap();
            level.push(node.val);
            if let Some(l) = node.left { queue.push_back(l); }
            if let Some(r) = node.right { queue.push_back(r); }
        }
        res.push(level);
    }
    res
}
```

#### Go

Uses slice-as-queue with `q = q[size:]` to drop processed nodes — O(1) view operation, eventual GC handles reclamation. `make([]int, 0, size)` pre-allocates the level vector.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func levelOrder(root *TreeNode) [][]int {
    if root == nil { return nil }
    res := [][]int{}
    q := []*TreeNode{root}
    for len(q) > 0 {
        size := len(q)
        level := make([]int, 0, size)
        for i := 0; i < size; i++ {
            node := q[i]
            level = append(level, node.Val)
            if node.Left != nil { q = append(q, node.Left) }
            if node.Right != nil { q = append(q, node.Right) }
        }
        q = q[size:]
        res = append(res, level)
    }
    return res
}
```

#### C++

`std::queue<TreeNode*>` adapter over deque — `front()`/`pop()` are separate calls. Level-size snapshot via `int size = q.size()` is the same pattern as the others.

```cpp
#include <vector>
#include <queue>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

std::vector<std::vector<int>> levelOrder(TreeNode* root) {
    std::vector<std::vector<int>> res;
    if (!root) return res;
    std::queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        int size = q.size();
        std::vector<int> level;
        for (int i = 0; i < size; ++i) {
            TreeNode* node = q.front(); q.pop();
            level.push_back(node->val);
            if (node->left) q.push(node->left);
            if (node->right) q.push(node->right);
        }
        res.push_back(level);
    }
    return res;
}
```


### 57. Binary Tree Right Side View

#### Problem
Given the root of a binary tree, return the values of the nodes visible when looking from the right side — one value per level (the rightmost node at each level).

#### Examples

```text
Input: root = [1,2,3,null,5,null,4]
Output: [1,3,4]

Input: root = [1,2,3,4]
Output: [1,3,4]
Explanation: level 2 holds only node 4, which is a left child.

Input: root = []
Output: []

Constraints:
- 0 <= number of nodes <= 100
- -100 <= Node.val <= 100
- exactly one value per level, top down
```

#### Recognition
**Signals.** "Looking from the right side" and "one value per level" say the same thing: the output has one entry per depth, so depth is the grouping key and the answer is the last node at each depth. Anything that hands you nodes grouped by depth solves it. **Therefore.** Level order BFS with the size snapshot: read `len(queue)` before the level begins, pop exactly that many nodes, and take the last one's value. A right-first DFS works equally well, recording a value the first time each new depth is reached, and is the version to reach for when you also want the left side view or per-level aggregates. **Not walking `root.right` until null**, which is the reading the phrase invites: visibility is per level, not per branch, so when the right spine ends early a deeper left subtree becomes the rightmost thing at its level, exactly as `[1,2,3,4]` shows. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Find the height, then hunt for the rightmost node at each depth separately.

```python
def rightSideView(root):
    def height(node):
        if not node:
            return 0
        return 1 + max(height(node.left),
                       height(node.right))
    def at(node, d):
        if not node:
            return []
        if d == 0:
            return [node.val]
        return at(node.left, d - 1) + at(node.right, d - 1)
    return [at(root, d)[-1] for d in range(height(root))]
```

`O(n * h)` time, `O(n)` space.

**Wasteful because.** `at(root, d)` descends through every node above depth `d` just to reach it, and the next value of `d` descends through all of them again. Each upper level is re-traversed once per level below it, and `height` adds a full pass of its own before any of that starts.

**Optimal.** Visit each node once and let the traversal do the grouping. A BFS queue already holds exactly one level at a time provided you snapshot its length before draining it: pop that many nodes, push their children, and the last node popped is the rightmost of that level. One pass, `O(n)` time, with the queue peaking at the widest level for `O(n)` space. The DFS alternative is the same `O(n)` time with only `O(h)` space, so it wins on a deep narrow tree; it visits the right child first and appends a value whenever the current depth equals the result length. Note that the Python solution leans on the loop variable outliving its `for`, which is legal but reads as an accident; tracking `last` explicitly, as the other four languages do, is clearer.

**Edge cases.** An empty tree returns an empty list, guarded before the queue is built. A left-only chain returns every node, since each one is alone on its level. A node with only a left child still contributes when nothing to its right exists at that depth.

#### Python

Closure variable `node` survives after the inner loop because Python's for-loop variable leaks to the enclosing scope — that's how `res.append(node.val)` works after the loop. Subtle but idiomatic.

```python
from collections import deque

def rightSideView(root):
    if not root:
        return []
    res, q = [], deque([root])
    while q:
        for i in range(len(q)):
            node = q.popleft()
            if node.left: q.append(node.left)
            if node.right: q.append(node.right)
        res.append(node.val)
    return res
```

#### Java

Java scopes the loop variable, so track the level's last value explicitly (or test `i == size - 1`); the rightmost node at each BFS level is the visible one. `ArrayDeque` gives O(1) `poll`/`offer`.

```java
import java.util.*;

class Solution {
    public List<Integer> rightSideView(TreeNode root) {
        List<Integer> res = new ArrayList<>();
        if (root == null) return res;
        Deque<TreeNode> queue = new ArrayDeque<>();
        queue.offer(root);
        while (!queue.isEmpty()) {
            int size = queue.size();
            int last = 0;
            for (int i = 0; i < size; i++) {
                TreeNode node = queue.poll();
                last = node.val;
                if (node.left != null) queue.offer(node.left);
                if (node.right != null) queue.offer(node.right);
            }
            res.add(last);
        }
        return res;
    }
}
```

#### Rust

Track `last` explicitly inside the loop — Rust scopes the iterator variable, no leak. Initial `last = 0` is overwritten on the first iteration since each level has ≥1 node.

```rust
use std::collections::VecDeque;

#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}

fn right_side_view(root: Option<Box<TreeNode>>) -> Vec<i32> {
    let mut res = Vec::new();
    if root.is_none() { return res; }
    let mut queue = VecDeque::new();
    queue.push_back(root.unwrap());
    while !queue.is_empty() {
        let size = queue.len();
        let mut last = 0;
        for _ in 0..size {
            let node = queue.pop_front().unwrap();
            last = node.val;
            if let Some(l) = node.left { queue.push_back(l); }
            if let Some(r) = node.right { queue.push_back(r); }
        }
        res.push(last);
    }
    res
}
```

#### Go

Cheats slightly — instead of tracking `last`, indexes `q[size-1]` *before* slicing. Works because we haven't yet sliced off the level's nodes.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func rightSideView(root *TreeNode) []int {
    if root == nil { return nil }
    res := []int{}
    q := []*TreeNode{root}
    for len(q) > 0 {
        size := len(q)
        for i := 0; i < size; i++ {
            node := q[i]
            if node.Left != nil { q = append(q, node.Left) }
            if node.Right != nil { q = append(q, node.Right) }
        }
        res = append(res, q[size-1].Val)
        q = q[size:]
    }
    return res
}
```

#### C++

Inline `if (i == size - 1) res.push_back(node->val)` inside the BFS loop — checks the index rather than tracking the last node separately. Marginally cleaner than the Python leak.

```cpp
#include <vector>
#include <queue>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

std::vector<int> rightSideView(TreeNode* root) {
    std::vector<int> res;
    if (!root) return res;
    std::queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        int size = q.size();
        for (int i = 0; i < size; ++i) {
            TreeNode* node = q.front(); q.pop();
            if (i == size - 1) res.push_back(node->val);
            if (node->left) q.push(node->left);
            if (node->right) q.push(node->right);
        }
    }
    return res;
}
```


### 58. Count Good Nodes in Binary Tree

#### Problem
Given a binary tree, count the number of "good" nodes — nodes where no node on the path from the root to that node has a value greater than the node's own value.

#### Examples

```text
Input: root = [3,1,4,3,null,1,5]
Output: 4
Explanation: 3, 3, 4 and 5 are good; both 1s sit
below a larger ancestor.

Input: root = [3,3,null,4,2]
Output: 3

Input: root = [1]
Output: 1

Constraints:
- 1 <= number of nodes <= 10^5
- -10^4 <= Node.val <= 10^4
- this is not a BST; values may repeat
```

#### Recognition
**Signals.** "No node on the path from the root to that node has a value greater than the node's own value" is a condition about ancestors only, and a whole list of ancestors collapses to one number: their maximum. Nothing orders the tree, so no subtree can be skipped and every node must be visited regardless. **Therefore.** A single top-down DFS carrying the largest value seen so far on the current root-to-node path, counting the node when `node.val >= max_so_far` and recursing with `max(max_so_far, node.val)`. **Not a bottom-up post-order** that combines what children return, because the predicate looks up toward the root and nothing computed inside a subtree can settle it. **Not carrying the ancestor list** and rescanning it at each node, which is correct but costs `O(n * h)` to recompute a maximum that changes by at most one comparison per step. **O(n)** time, **O(h)** space.

#### Explanation
**Brute force.** Carry the ancestor values down and rescan them at every node.

```python
def goodNodes(root):
    def dfs(node, path):
        if not node:
            return 0
        good = 1 if all(v <= node.val for v in path) else 0
        path.append(node.val)
        total = good + dfs(node.left, path) + dfs(node.right, path)
        path.pop()
        return total
    return dfs(root, [])
```

`O(n * h)` time, `O(h)` space.

**Wasteful because.** The `all(...)` sweep re-reads the entire ancestor list at every node, and between a parent and its child that list changes by exactly one element. What the sweep computes is a single fact, "is the largest ancestor value at most `node.val`", so the whole scan reduces to one comparison against a number you were already holding.

**Optimal.** Thread that number down instead of the list. Each call receives `max_val`, the largest value on the path above it, counts itself when `node.val >= max_val`, and hands `max(max_val, node.val)` to both children. Seeding the top call with `root.val` makes the root count itself, which is right: it has no ancestors, so it is always good. Passing `max_val` by value means nothing has to be undone on the way back up, unlike the `path.pop()` above, so the only memory is the call stack: `O(log n)` on a balanced tree, `O(n)` on a path. An explicit stack of `(node, max_val)` pairs is the same algorithm if 10^5 nodes in a line would blow the recursion limit.

**Edge cases.** A single node answers 1. Equal values along a path all count, because the test is `>=` and not `>`. Negative values need nothing special, and seeding with `root.val` rather than a sentinel avoids picking one at all.

#### Python

Thread `max_val` down the recursion as an argument — no shared mutable state, easy to reason about. Counts via `1 if condition else 0` for compactness.

```python
def goodNodes(root):
    def dfs(node, max_val):
        if not node:
            return 0
        res = 1 if node.val >= max_val else 0
        m = max(max_val, node.val)
        return res + dfs(node.left, m) + dfs(node.right, m)
    return dfs(root, root.val)
```

#### Java

Thread `maxVal` down as a by-value parameter — no shared mutable state, since each path carries its own running max. The C-style ternary counts the current node.

```java
class Solution {
    public int goodNodes(TreeNode root) {
        return dfs(root, root.val);
    }

    private int dfs(TreeNode node, int maxVal) {
        if (node == null) return 0;
        int good = node.val >= maxVal ? 1 : 0;
        int m = Math.max(maxVal, node.val);
        return good + dfs(node.left, m) + dfs(node.right, m);
    }
}
```

#### Rust

Inner `fn dfs` again for the recursion. `if-else` rather than ternary for the `good` count — Rust has no ternary but `if-else` is an expression so it fits inline.

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}

fn good_nodes(root: Option<Box<TreeNode>>) -> i32 {
    fn dfs(node: &Option<Box<TreeNode>>, max_val: i32) -> i32 {
        match node {
            None => 0,
            Some(n) => {
                let good = if n.val >= max_val { 1 } else { 0 };
                let m = max_val.max(n.val);
                good + dfs(&n.left, m) + dfs(&n.right, m)
            }
        }
    }
    if let Some(ref r) = root { dfs(&root, r.val) } else { 0 }
}
```

#### Go

Closure captures nothing — just threads `maxVal` as a parameter. Two `if` statements replace `max` and ternary because pre-1.21 Go has neither.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func goodNodes(root *TreeNode) int {
    var dfs func(*TreeNode, int) int
    dfs = func(node *TreeNode, maxVal int) int {
        if node == nil { return 0 }
        res := 0
        if node.Val >= maxVal { res = 1 }
        m := maxVal
        if node.Val > m { m = node.Val }
        return res + dfs(node.Left, m) + dfs(node.Right, m)
    }
    return dfs(root, root.Val)
}
```

#### C++

Top-level `dfs` with `int maxVal` by value — the running max is per-path so by-value is correct. C-style ternary `node->val >= maxVal ? 1 : 0` for the count.

```cpp
#include <algorithm>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

int dfs(TreeNode* node, int maxVal) {
    if (!node) return 0;
    int good = node->val >= maxVal ? 1 : 0;
    int m = std::max(maxVal, node->val);
    return good + dfs(node->left, m) + dfs(node->right, m);
}

int goodNodes(TreeNode* root) {
    return dfs(root, root->val);
}
```


### 59. Validate Binary Search Tree

#### Problem
Given the root of a binary tree, return `true` if it is a valid BST — every node's value is strictly greater than all values in its left subtree and strictly less than all values in its right subtree.

#### Examples

```text
Input: root = [2,1,3]
Output: true

Input: root = [5,1,4,null,null,3,6]
Output: false
Explanation: 4 sits right of 5 but is smaller than 5.

Input: root = [5,4,6,null,null,3,7]
Output: false
Explanation: 3 is left of 6, yet 3 is in 5's right subtree.

Constraints:
- 1 <= number of nodes <= 10^4
- -2^31 <= Node.val <= 2^31 - 1
```

#### Recognition
**Signals.** "Every node's value is greater than all values in its left subtree" is a claim about whole subtrees, not about neighbours, and the word "all" is the tell: the constraint on a node comes from every ancestor, not just its parent. That is a range, and ranges compose as you descend. **Therefore.** DFS carrying `(lo, hi)`, rejecting unless `lo < node.val < hi`, tightening `hi` to `node.val` when you go left and `lo` to `node.val` when you go right. **Not comparing each node against its parent only**, because `[5,4,6,null,null,3,7]` passes every parent test (4 is left of 5, 3 is left of 6) yet 3 lives in the root's right subtree while being smaller than 5. The parent check is local and the property is global. **O(n)** time, **O(h)** space.

#### Explanation
**Brute force.** At each node, collect both subtrees in full and check their extremes.

```python
def isValidBST(root):
    def vals(node):
        if not node:
            return []
        return vals(node.left) + [node.val] + vals(node.right)
    if not root:
        return True
    lo, hi = vals(root.left), vals(root.right)
    if lo and max(lo) >= root.val:
        return False
    if hi and min(hi) <= root.val:
        return False
    return isValidBST(root.left) and isValidBST(root.right)
```

`O(n^2)` time, `O(n)` space.

**Wasteful because.** `vals` is rebuilt from scratch at every node, so a node at depth `d` is collected `d + 1` times, once per ancestor. The entire subtree is materialised to extract a single min and a single max.

**Optimal.** Push the constraint down instead of pulling the data up. The only thing a node needs from its ancestors is the open interval it must fall in, and that interval is two numbers. Start at `(-inf, +inf)`, and each step replaces exactly one endpoint with the current value: going left everything below must stay under `node.val`, going right everything must stay above it. One visit per node, `O(h)` stack. The equivalent recognition is that inorder on a valid BST is strictly increasing, so a single inorder pass comparing against the previous value also works; reach for that one when the interviewer presses on overflow at the sentinel bounds, since it never invents a value.

**Edge cases.** A single node is always valid. Equal values fail, because the comparison is strict on both sides. A node holding `-2^31` or `2^31 - 1` breaks int-typed sentinels, which is why the typed solutions widen the bounds to 64 bits. A null child returns true and stops the recursion.

#### Python

Chained `lo < node.val < hi` is uniquely Pythonic — one comparison, no `and`. `float('-inf')`/`float('inf')` work for the BST's int bounds without overflow concerns.

```python
def isValidBST(root):
    def valid(node, lo, hi):
        if not node:
            return True
        if not (lo < node.val < hi):
            return False
        return valid(node.left, lo, node.val) and valid(node.right, node.val, hi)
    return valid(root, float('-inf'), float('inf'))
```

#### Java

Java has no chained comparison, so test `node.val <= lo || node.val >= hi`. Use `long` bounds (`Long.MIN_VALUE`/`Long.MAX_VALUE`) so a node holding `Integer.MIN_VALUE`/`MAX_VALUE` can't false-fail at the boundary.

```java
class Solution {
    public boolean isValidBST(TreeNode root) {
        return valid(root, Long.MIN_VALUE, Long.MAX_VALUE);
    }

    private boolean valid(TreeNode node, long lo, long hi) {
        if (node == null) return true;
        if (node.val <= lo || node.val >= hi) return false;
        return valid(node.left, lo, node.val) && valid(node.right, node.val, hi);
    }
}
```

#### Rust

Cast `n.val as i64` so the comparison against `i64::MIN`/`i64::MAX` doesn't overflow when the tree has `i32::MIN` or `i32::MAX` values. Subtle but necessary.

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}

fn is_valid_bst(root: Option<Box<TreeNode>>) -> bool {
    fn valid(node: &Option<Box<TreeNode>>, lo: i64, hi: i64) -> bool {
        match node {
            None => true,
            Some(n) => {
                let v = n.val as i64;
                v > lo && v < hi
                    && valid(&n.left, lo, v)
                    && valid(&n.right, v, hi)
            }
        }
    }
    valid(&root, i64::MIN, i64::MAX)
}
```

#### Go

`math.MinInt64`/`math.MaxInt64` as the initial bounds — Go's `int` is 64-bit so this fits naturally. Pre-1.21 has no chained comparison so two `||` checks.

```go
import "math"

type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func isValidBST(root *TreeNode) bool {
    var valid func(*TreeNode, int, int) bool
    valid = func(node *TreeNode, lo, hi int) bool {
        if node == nil { return true }
        if node.Val <= lo || node.Val >= hi { return false }
        return valid(node.Left, lo, node.Val) && valid(node.Right, node.Val, hi)
    }
    return valid(root, math.MinInt64, math.MaxInt64)
}
```

#### C++

`long long` for the bounds (`LLONG_MIN`/`LLONG_MAX`) — same overflow defense as Rust. Two comparisons against `node->val` separated by `||`.

```cpp
#include <climits>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

bool valid(TreeNode* node, long long lo, long long hi) {
    if (!node) return true;
    if (node->val <= lo || node->val >= hi) return false;
    return valid(node->left, lo, node->val) && valid(node->right, node->val, hi);
}

bool isValidBST(TreeNode* root) {
    return valid(root, LLONG_MIN, LLONG_MAX);
}
```


### 60. Kth Smallest Element in a BST

#### Problem
Given the root of a BST and an integer `k`, return the `k`th smallest value among all node values.

#### Examples

```text
Input: root = [3,1,4,null,2], k = 1
Output: 1

Input: root = [5,3,6,2,4,null,null,1], k = 3
Output: 3
Explanation: sorted the values read 1,2,3,4,5,6.

Input: root = [2,1,3], k = 3
Output: 3

Constraints:
- 1 <= number of nodes <= 10^4
- 1 <= k <= number of nodes
- 0 <= Node.val <= 10^4
```

#### Recognition
**Signals.** "BST" plus "kth smallest" is the whole tip. The BST invariant says every left descendant is smaller and every right descendant is larger, so the tree already holds its values in sorted order and an inorder walk (left, node, right) reads that order out one value at a time. "kth" then just means stop counting at `k`. **Therefore.** Inorder traversal with an explicit stack, decrementing `k` at each visit and returning the node where `k` hits zero, so the walk ends after `k` pops rather than finishing the tree. **Not collecting every value and sorting**, which pays `O(n log n)` to rebuild an ordering the invariant already guarantees. **Not a size-`k` heap**, the usual kth-smallest tool on unordered data, which is `O(n log k)` and still has to touch every node. **O(n)** time, **O(h)** space.

#### Explanation
**Brute force.** Gather every value, sort it, index.

```python
def kthSmallest(root, k):
    vals = []
    def dfs(node):
        if not node:
            return
        vals.append(node.val)
        dfs(node.left)
        dfs(node.right)
    dfs(root)
    vals.sort()
    return vals[k - 1]
```

`O(n log n)` time, `O(n)` space.

**Wasteful because.** The sort re-derives an ordering that the BST already encodes in its shape, and the traversal visits all `n` nodes even when `k` is 1. Both costs come from discarding the invariant on the way in and paying to recover it on the way out.

**Optimal.** Walk inorder instead. Push nodes while descending left, and every pop yields the next smallest value, so the `k`th pop is the answer and the walk can return on the spot. The stack only ever holds the current root-to-node spine, `O(h)`, and the work is `O(h + k)`: `O(h)` to reach the smallest, then one pop per rank after that. The worst case is `O(n)`, when `k = n` or the tree degenerates into a path. Recursion is equally correct and shorter to write, but the iterative form makes the early exit explicit and survives a 10^4-deep tree. If the tree is modified often and kth queries are frequent, store a subtree size in each node instead: a query then descends once in `O(h)`, and an insert or delete fixes counts along a single path.

**Edge cases.** `k = 1` returns the leftmost node, `k = n` the rightmost. Because `1 <= k <= n` is guaranteed, the loop always returns before the stack empties. A right-leaning path makes the stack depth 1 the whole way, a left-leaning one makes it `n`.

#### Python

Classic iterative inorder: drill left, pop, count, then jump to right subtree. Stops the moment `k` hits zero — no need to traverse the whole tree.

```python
def kthSmallest(root, k):
    stack = []
    curr = root
    while stack or curr:
        while curr:
            stack.append(curr)
            curr = curr.left
        curr = stack.pop()
        k -= 1
        if k == 0:
            return curr.val
        curr = curr.right
```

#### Java

`ArrayDeque` as an explicit stack (`push`/`pop`) beats the synchronized legacy `Stack`. Classic iterative inorder: drill left, pop, `--k`, and return the moment `k` hits zero — no need to visit the whole tree.

```java
import java.util.*;

class Solution {
    public int kthSmallest(TreeNode root, int k) {
        Deque<TreeNode> stack = new ArrayDeque<>();
        TreeNode curr = root;
        while (!stack.isEmpty() || curr != null) {
            while (curr != null) {
                stack.push(curr);
                curr = curr.left;
            }
            curr = stack.pop();
            if (--k == 0) return curr.val;
            curr = curr.right;
        }
        return -1;
    }
}
```

#### Rust

Recursive inorder building a full `Vec<i32>` — simpler than fighting `Box<TreeNode>` ownership for the iterative form. O(n) regardless of `k`, vs. the iterative O(k + h) — acceptable on LeetCode.

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Box<TreeNode>>,
    pub right: Option<Box<TreeNode>>,
}

fn kth_smallest(root: Option<Box<TreeNode>>, k: i32) -> i32 {
    // Collect inorder values into a vec, then index directly.
    fn inorder(node: Option<Box<TreeNode>>, vals: &mut Vec<i32>) {
        if let Some(n) = node {
            inorder(n.left, vals);
            vals.push(n.val);
            inorder(n.right, vals);
        }
    }
    let mut vals = Vec::new();
    inorder(root, &mut vals);
    vals[(k - 1) as usize]
}
```

#### Go

Iterative inorder with slice-as-stack. `k--` then `if k == 0` is the standard 'visit the kth element' pattern.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func kthSmallest(root *TreeNode, k int) int {
    stack := []*TreeNode{}
    curr := root
    for len(stack) > 0 || curr != nil {
        for curr != nil {
            stack = append(stack, curr)
            curr = curr.Left
        }
        curr = stack[len(stack)-1]
        stack = stack[:len(stack)-1]
        k--
        if k == 0 { return curr.Val }
        curr = curr.Right
    }
    return -1
}
```

#### C++

`std::stack<TreeNode*>` adapter; the `if (--k == 0)` is the prefix-decrement trick that combines decrement and check. `top()` + `pop()` are separate calls per the STL convention.

```cpp
#include <stack>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(v), left(l), right(r) {}
};

int kthSmallest(TreeNode* root, int k) {
    std::stack<TreeNode*> st;
    TreeNode* curr = root;
    while (!st.empty() || curr) {
        while (curr) { st.push(curr); curr = curr->left; }
        curr = st.top(); st.pop();
        if (--k == 0) return curr->val;
        curr = curr->right;
    }
    return -1;
}
```


### 61. Construct Binary Tree from Preorder and Inorder Traversal

#### Problem
Given a preorder and inorder traversal of a binary tree (all values unique), reconstruct and return the root of the tree.

#### Examples

```text
Input: preorder = [3,9,20,15,7], inorder = [9,3,15,20,7]
Output: [3,9,20,null,null,15,7]

Input: preorder = [-1], inorder = [-1]
Output: [-1]

Input: preorder = [1,2,3], inorder = [3,2,1]
Output: [1,2,null,3]
Explanation: every node is a left child.

Constraints:
- 1 <= preorder.length <= 3000
- inorder.length == preorder.length
- -3000 <= values <= 3000, all distinct
- inorder is a permutation of preorder
```

#### Recognition
**Signals.** Two traversals of one tree, and "all values unique". Preorder's first element is the root by definition; uniqueness means that value occurs exactly once in inorder, and its position there splits inorder into the left subtree's values and the right subtree's. That split hands you the size of each subtree, which is precisely what preorder alone will not tell you. **Therefore.** Recurse: take the next preorder value as the current root, look up its index in inorder to get the boundary, then build the left child before the right so a single advancing preorder cursor stays aligned with the recursion. A value-to-index dict built once makes every lookup `O(1)`. **Not scanning inorder for the root on each call**, the version everybody writes first, which costs `O(n)` per node and degrades to `O(n^2)` on a skewed tree. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Find the root in inorder by scanning, then recurse on fresh sublists.

```python
def buildTree(preorder, inorder):
    if not preorder:
        return None
    root = TreeNode(preorder[0])
    mid = inorder.index(preorder[0])
    root.left = buildTree(preorder[1:mid + 1], inorder[:mid])
    root.right = buildTree(preorder[mid + 1:], inorder[mid + 1:])
    return root
```

`O(n^2)` time, `O(n^2)` space.

**Wasteful because.** Two things are redone at every node. `inorder.index` re-walks the array to find a position that never changes once the input is fixed, and each slice copies values into new lists, so a tree shaped like a path copies `O(n)` elements `n` times over.

**Optimal.** Stop moving data. Build one dict from value to index in inorder up front, `O(n)`, so the split point becomes a lookup. Then describe a subtree by a pair of inorder bounds `(l, r)` instead of a slice, and keep one cursor into preorder that advances by one every time a node is created. That cursor is correct because preorder emits a node, then its entire left subtree, then its entire right subtree, which is exactly the order the recursion consumes them in: build `left` before `right`, never the reverse. The base case `l > r` is the empty subtree, and it also covers leaves without a special case. Each node is created once and each lookup is `O(1)`, so the build is `O(n)` with `O(n)` for the dict plus `O(h)` for the stack.

**Edge cases.** A single node has `mid == l == r`, so both children hit `l > r` immediately. A left-skewed tree, where inorder is the reverse of preorder, is the case that makes the naive version quadratic. Duplicate values would break the dict, which is why the problem guarantees distinct ones.

#### Python

`pre = [0]` is the closure-shared mutable counter (`nonlocal` would also work). The `idx` dict turns the `O(n)` inorder lookup into `O(1)`, the entire reason this isn't `O(n²)`.

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val; self.left = left; self.right = right

def buildTree(preorder, inorder):
    idx = {v: i for i, v in enumerate(inorder)}
    pre = [0]
    def build(l, r):
        if l > r:
            return None
        root = TreeNode(preorder[pre[0]])
        pre[0] += 1
        mid = idx[root.val]
        root.left = build(l, mid - 1)
        root.right = build(mid + 1, r)
        return root
    return build(0, len(inorder) - 1)
```

#### Java

An instance field `pre` gives the shared, self-advancing preorder cursor that Python fakes with a one-element list — cleaner than threading an `int[]{0}` through every call. `HashMap.get` autoboxes but keeps the inorder lookup O(1), the whole point of the precomputed index.

```java
import java.util.*;

class Solution {
    private int pre;
    private Map<Integer, Integer> idx;

    public TreeNode buildTree(int[] preorder, int[] inorder) {
        idx = new HashMap<>();
        for (int i = 0; i < inorder.length; i++) idx.put(inorder[i], i);
        pre = 0;
        return build(preorder, 0, inorder.length - 1);
    }

    private TreeNode build(int[] preorder, int l, int r) {
        if (l > r) return null;
        TreeNode root = new TreeNode(preorder[pre++]);
        int mid = idx.get(root.val);
        root.left = build(preorder, l, mid - 1);
        root.right = build(preorder, mid + 1, r);
        return root;
    }
}
```

#### Rust

Pass `&mut usize` for the `pre` counter and `&HashMap` for the lookup — explicit borrows make the shared state visible. Extra `if mid > l` guard on the left recursion prevents `mid - 1` from underflowing `usize`.

```rust
use std::collections::HashMap;

#[derive(Debug)]
struct TreeNode {
    val: i32,
    left: Option<Box<TreeNode>>,
    right: Option<Box<TreeNode>>,
}

fn build_tree(preorder: Vec<i32>, inorder: Vec<i32>) -> Option<Box<TreeNode>> {
    let idx: HashMap<i32, usize> = inorder.iter().enumerate().map(|(i, &v)| (v, i)).collect();
    let mut pre = 0usize;
    fn build(
        preorder: &[i32],
        idx: &HashMap<i32, usize>,
        pre: &mut usize,
        l: usize,
        r: usize,
    ) -> Option<Box<TreeNode>> {
        if l > r {
            return None;
        }
        let val = preorder[*pre];
        *pre += 1;
        let mid = idx[&val];
        let left = if mid > l { build(preorder, idx, pre, l, mid - 1) } else { None };
        let right = build(preorder, idx, pre, mid + 1, r);
        Some(Box::new(TreeNode { val, left, right }))
    }
    let n = inorder.len();
    if n == 0 { return None; }
    build(&preorder, &idx, &mut pre, 0, n - 1)
}
```

#### Go

Closure captures `pre` and `idx` by reference automatically. The `pre++` post-increment-via-statement is Go's only increment form — no `++pre` expression.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func buildTree(preorder []int, inorder []int) *TreeNode {
    idx := make(map[int]int, len(inorder))
    for i, v := range inorder {
        idx[v] = i
    }
    pre := 0
    var build func(l, r int) *TreeNode
    build = func(l, r int) *TreeNode {
        if l > r {
            return nil
        }
        root := &TreeNode{Val: preorder[pre]}
        pre++
        mid := idx[root.Val]
        root.Left = build(l, mid-1)
        root.Right = build(mid+1, r)
        return root
    }
    return build(0, len(inorder)-1)
}
```

#### C++

Wraps state in a class so `pre` and `idx` are members — avoids the parameter-passing tax. The constructor takes the preorder by reference (`p`) which the recursive `build` consumes via the captured member.

```cpp
#include <vector>
#include <unordered_map>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v) : val(v), left(nullptr), right(nullptr) {}
};

class Solution {
    std::unordered_map<int,int> idx;
    int pre = 0;
    std::vector<int>& preorder;
    TreeNode* build(int l, int r) {
        if (l > r) return nullptr;
        TreeNode* root = new TreeNode(preorder[pre++]);
        int mid = idx[root->val];
        root->left  = build(l, mid - 1);
        root->right = build(mid + 1, r);
        return root;
    }
public:
    Solution(std::vector<int>& p) : preorder(p) {}
    TreeNode* buildTree(std::vector<int>& preorder_, std::vector<int>& inorder) {
        for (int i = 0; i < (int)inorder.size(); ++i) idx[inorder[i]] = i;
        return build(0, (int)inorder.size() - 1);
    }
};
```


### 62. Binary Tree Maximum Path Sum

#### Problem
Given a binary tree, find the maximum path sum where a path is any sequence of nodes connected by edges (need not pass through the root). Node values can be negative.

#### Examples

```text
Input: root = [1,2,3]
Output: 6
Explanation: 2 -> 1 -> 3 sums to 6.

Input: root = [-10,9,20,null,null,15,7]
Output: 42
Explanation: 15 -> 20 -> 7; the root is not on the path.

Input: root = [-3]
Output: -3

Constraints:
- 1 <= number of nodes <= 3 * 10^4
- -1000 <= Node.val <= 1000
```

#### Recognition
**Signals.** "Any sequence of nodes connected by edges", "need not pass through the root", and "values can be negative". The first two say the answer is anchored nowhere, so there is no single starting point to recurse from; the third kills every greedy accumulate-as-you-go idea, since extending a path can lower the sum. **Therefore.** The two-values-up idiom: one post-order pass where `dfs(node)` returns the best *downward* path ending at `node`, clamped at 0, while a running best absorbs `node.val + left + right`, the path that turns at this node. **Not returning the subtree's best path to the parent**, which is the natural single-value recursion and is wrong: a best path may bend at some node inside the subtree, and a bent path has no free end for the parent to attach to. The value you report up and the value you record are different quantities. **O(n)** time, **O(h)** space.

#### Explanation
**Brute force.** Treat every node as the turning point and recompute both downward arms.

```python
def maxPathSum(root):
    def down(node):
        if not node:
            return 0
        return max(node.val + max(down(node.left),
                                  down(node.right)), 0)
    def nodes(node):
        if not node:
            return []
        return [node] + nodes(node.left) + nodes(node.right)
    return max(n.val + down(n.left) + down(n.right)
               for n in nodes(root))
```

`O(n^2)` time, `O(n)` space.

**Wasteful because.** `down` is called fresh at every node, so it re-walks that node's whole subtree; a leaf gets summed once for each of its ancestors. The same downward gains are recomputed `h` times over.

**Optimal.** One post-order pass computes each `down` value exactly once, and the trick is to harvest the answer on the way back up rather than in a second sweep. At `node`, the children have already returned their best downward gains `l` and `r`. Two different numbers come out of that: `node.val + l + r` is the best path that *turns* here, which is a candidate for the answer, and `node.val + max(l, r)` is what the parent can extend, because a path leaving through the parent uses at most one child. Clamping each gain with `max(gain, 0)` is how a subtree gets skipped for free: a negative arm contributes 0 instead of dragging the sum down. Seed the running best with `root.val` rather than 0, or an all-negative tree wrongly answers 0.

**Edge cases.** A single node returns its own value, negative or not. An all-negative tree answers with its largest single value, since both arms clamp to 0. A node with one child is handled by the null branch returning 0. The best path may exclude the root entirely, as in `[-10,9,20,null,null,15,7]`.

#### Python

`res = [root.val]` initialization (not `0` or `-inf`) handles the all-negative-tree case. `max(dfs(...), 0)` clamps negative gains to zero — that's how we 'skip' a subtree that would hurt the sum.

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val; self.left = left; self.right = right

def maxPathSum(root):
    res = [root.val]
    def dfs(node):
        if not node:
            return 0
        l = max(dfs(node.left), 0)
        r = max(dfs(node.right), 0)
        res[0] = max(res[0], node.val + l + r)
        return node.val + max(l, r)
    dfs(root)
    return res[0]
```

#### Java

A mutable field `res` replaces Python's `res[0]` boxing trick — Java closures can't capture-by-reference, so an instance field is the idiomatic way to let the recursion accumulate a global maximum. `Math.max(dfs(...), 0)` is the clamp that skips a subtree whose best gain would hurt the total.

```java
class Solution {
    private int res;

    public int maxPathSum(TreeNode root) {
        res = root.val;
        dfs(root);
        return res;
    }

    private int dfs(TreeNode node) {
        if (node == null) return 0;
        int l = Math.max(dfs(node.left), 0);
        int r = Math.max(dfs(node.right), 0);
        res = Math.max(res, node.val + l + r);
        return node.val + Math.max(l, r);
    }
}
```

#### Rust

Pattern match with early-return `return 0` inside the `match` binds `n` for the rest of the function. `(*res).max(...)` to update through the mutable reference — the parens make precedence explicit.

```rust
#[derive(Debug)]
struct TreeNode {
    val: i32,
    left: Option<Box<TreeNode>>,
    right: Option<Box<TreeNode>>,
}

fn max_path_sum(root: Option<Box<TreeNode>>) -> i32 {
    let mut res = i32::MIN;
    fn dfs(node: &Option<Box<TreeNode>>, res: &mut i32) -> i32 {
        let n = match node { None => return 0, Some(n) => n };
        let l = dfs(&n.left, res).max(0);
        let r = dfs(&n.right, res).max(0);
        *res = (*res).max(n.val + l + r);
        n.val + l.max(r)
    }
    dfs(&root, &mut res);
    res
}
```

#### Go

Two `if l < 0 { l = 0 }` blocks replace the `max(_, 0)` clamp — verbose but clear. Pre-1.21 has no `max` builtin so the return ladder is unavoidable.

```go
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func maxPathSum(root *TreeNode) int {
    res := root.Val
    var dfs func(node *TreeNode) int
    dfs = func(node *TreeNode) int {
        if node == nil {
            return 0
        }
        l := dfs(node.Left)
        if l < 0 { l = 0 }
        r := dfs(node.Right)
        if r < 0 { r = 0 }
        if node.Val+l+r > res {
            res = node.Val + l + r
        }
        if l > r {
            return node.Val + l
        }
        return node.Val + r
    }
    dfs(root)
    return res
}
```

#### C++

`std::function<int(TreeNode*)>` lets the lambda recurse via captured-by-reference `dfs`. The `std::max(..., 0)` clamp and `std::max(l, r)` for the return-up value mirror Python exactly.

```cpp
#include <algorithm>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v) : val(v), left(nullptr), right(nullptr) {}
};

int maxPathSum(TreeNode* root) {
    int res = root->val;
    std::function<int(TreeNode*)> dfs = [&](TreeNode* node) -> int {
        if (!node) return 0;
        int l = std::max(dfs(node->left), 0);
        int r = std::max(dfs(node->right), 0);
        res = std::max(res, node->val + l + r);
        return node->val + std::max(l, r);
    };
    dfs(root);
    return res;
}
```


### 63. Serialize and Deserialize Binary Tree

#### Problem
Design an algorithm to serialize a binary tree to a string and deserialize it back to the original tree structure. Any encoding scheme is acceptable.

#### Examples

```text
Input: root = [1,2,3,null,null,4,5]
Output: [1,2,3,null,null,4,5]
Explanation: the string in between is one valid
encoding; only the rebuilt tree has to match.

Input: root = []
Output: null

Input: root = [1,2]
Output: [1,2]

Compare: roundtrip

Constraints:
- 0 <= number of nodes <= 10^4
- -1000 <= Node.val <= 1000
- any format is allowed provided it round-trips
```

#### Recognition
**Signals.** "Serialize to a string and deserialize back to the original tree structure", plus "any encoding scheme is acceptable". Structure, not just values, is the payload: a bag of node values names no particular tree, so the format has to record where the missing children are. Freedom over the format is the hint to pick the traversal that rebuilds itself with no extra bookkeeping. **Therefore.** Preorder DFS, emitting `node.val` or a literal `"N"` for an absent child. Reading it back is the same walk: consume one token, and if it is a value, make the node and fill left then right from the tokens that follow, so a single advancing index is all the state deserialization needs. **Not inorder with the same markers**, which is genuinely ambiguous: the root sits at no known position in the stream, so different trees produce identical tokens. **Not an index-based array** with children at `2i+1` and `2i+2`, which is unambiguous but sizes itself to the tree's depth rather than its node count. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Put every node at its heap index and write the whole array out.

```python
def serialize(root):
    slots = {}
    def fill(node, i):
        if node:
            slots[i] = node.val
            fill(node.left, 2 * i + 1)
            fill(node.right, 2 * i + 2)
    fill(root, 0)
    n = max(slots) + 1 if slots else 0
    return ",".join(str(slots.get(i, "N")) for i in range(n))

def deserialize(data):
    vals = data.split(",") if data else []
    def build(i):
        if i >= len(vals) or vals[i] == "N":
            return None
        node = TreeNode(int(vals[i]))
        node.left = build(2 * i + 1)
        node.right = build(2 * i + 2)
        return node
    return build(0)
```

`O(2^h)` time, `O(2^h)` space.

**Wasteful because.** The index encoding pays for positions no node occupies. A tree that leans one way puts its deepest node at index `2^h - 1`, so the string burns `2^h` tokens on nulls to describe `n` nodes. The shape is already implicit in the order a traversal visits nodes; the array pays a second time to store it as arithmetic.

**Optimal.** Emit nodes in preorder and mark absence explicitly. Every node contributes one token and every missing child contributes one `"N"`, so a tree of `n` nodes always serializes to exactly `2n + 1` tokens whatever its shape. Deserialization replays the identical walk: read a token, return `None` on `"N"`, otherwise build the node and fill `left` then `right` from what follows. Left before right is not cosmetic, it is the order serialization wrote them in, and swapping it silently mirrors the tree. Postorder with markers works the same way if you consume the tokens in reverse. Level order round-trips too and is what LeetCode prints, but it needs a queue on both sides instead of one index.

**Edge cases.** The empty tree serializes to `"N"` and comes straight back as `None`. Negative values are fine because `int()` parses the sign, but that is why the marker is `"N"` and not something like `-1`, which is a legal value. A single node gives `"1,N,N"`.

#### Python

Preorder with `'N'` for null is the simplest self-describing format — splitting on `,` round-trips. The shared `i = [0]` mutable index walks through tokens during deserialization.

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val; self.left = left; self.right = right

def serialize(root):
    res = []
    def dfs(node):
        if not node:
            res.append("N")
            return
        res.append(str(node.val))
        dfs(node.left)
        dfs(node.right)
    dfs(root)
    return ",".join(res)

def deserialize(data):
    vals = data.split(",")
    i = [0]
    def dfs():
        if vals[i[0]] == "N":
            i[0] += 1
            return None
        node = TreeNode(int(vals[i[0]]))
        i[0] += 1
        node.left = dfs()
        node.right = dfs()
        return node
    return dfs()
```

#### Java

`StringBuilder` accumulates the preorder tokens without the O(n^2) cost of `+` on immutable `String`. `String.split(",")` drops the trailing empty token by default, so the dangling comma from the last append needs no cleanup; a `Codec` field carries the deserialization cursor.

```java
import java.util.*;

public class Codec {
    public String serialize(TreeNode root) {
        StringBuilder sb = new StringBuilder();
        dfs(root, sb);
        return sb.toString();
    }

    private void dfs(TreeNode node, StringBuilder sb) {
        if (node == null) { sb.append("N,"); return; }
        sb.append(node.val).append(',');
        dfs(node.left, sb);
        dfs(node.right, sb);
    }

    private int i;

    public TreeNode deserialize(String data) {
        String[] vals = data.split(",");
        i = 0;
        return build(vals);
    }

    private TreeNode build(String[] vals) {
        if (vals[i].equals("N")) { i++; return null; }
        TreeNode node = new TreeNode(Integer.parseInt(vals[i++]));
        node.left = build(vals);
        node.right = build(vals);
        return node;
    }
}
```

#### Rust

Inner `fn` for the recursion (closures can't recurse cleanly). `vals: Vec<&str>` is borrowed slice references — no string allocations during deserialization.

```rust
#[derive(Debug)]
struct TreeNode {
    val: i32,
    left: Option<Box<TreeNode>>,
    right: Option<Box<TreeNode>>,
}

fn serialize(root: Option<Box<TreeNode>>) -> String {
    let mut parts = Vec::new();
    fn dfs(node: &Option<Box<TreeNode>>, parts: &mut Vec<String>) {
        match node {
            None => parts.push("N".to_string()),
            Some(n) => {
                parts.push(n.val.to_string());
                dfs(&n.left, parts);
                dfs(&n.right, parts);
            }
        }
    }
    dfs(&root, &mut parts);
    parts.join(",")
}

fn deserialize(data: String) -> Option<Box<TreeNode>> {
    let vals: Vec<&str> = data.split(',').collect();
    let mut i = 0usize;
    fn dfs(vals: &[&str], i: &mut usize) -> Option<Box<TreeNode>> {
        if vals[*i] == "N" { *i += 1; return None; }
        let val = vals[*i].parse().unwrap();
        *i += 1;
        let left  = dfs(vals, i);
        let right = dfs(vals, i);
        Some(Box::new(TreeNode { val, left, right }))
    }
    dfs(&vals, &mut i)
}
```

#### Go

Closure with self-reference via the `var dfs func(...)` then assignment. `strings.Split` returns `[]string` — works directly for the tokens.

```go
import (
    "strconv"
    "strings"
)

type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

func serialize(root *TreeNode) string {
    var parts []string
    var dfs func(node *TreeNode)
    dfs = func(node *TreeNode) {
        if node == nil {
            parts = append(parts, "N")
            return
        }
        parts = append(parts, strconv.Itoa(node.Val))
        dfs(node.Left)
        dfs(node.Right)
    }
    dfs(root)
    return strings.Join(parts, ",")
}

func deserialize(data string) *TreeNode {
    vals := strings.Split(data, ",")
    i := 0
    var dfs func() *TreeNode
    dfs = func() *TreeNode {
        if vals[i] == "N" { i++; return nil }
        val, _ := strconv.Atoi(vals[i])
        i++
        return &TreeNode{Val: val, Left: dfs(), Right: dfs()}
    }
    return dfs()
}
```

#### C++

`std::istringstream` + `std::getline` with `,` delimiter is the standard 'split string' incantation. The trailing `pop_back()` after serialization strips the dangling comma.

```cpp
#include <string>
#include <sstream>
#include <vector>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int v) : val(v), left(nullptr), right(nullptr) {}
};

std::string serialize(TreeNode* root) {
    std::string res;
    std::function<void(TreeNode*)> dfs = [&](TreeNode* node) {
        if (!node) { res += "N,"; return; }
        res += std::to_string(node->val) + ",";
        dfs(node->left);
        dfs(node->right);
    };
    dfs(root);
    if (!res.empty()) res.pop_back();
    return res;
}

TreeNode* deserialize(std::string data) {
    std::istringstream ss(data);
    std::string tok;
    std::vector<std::string> vals;
    while (std::getline(ss, tok, ',')) vals.push_back(tok);
    int i = 0;
    std::function<TreeNode*(void)> dfs = [&]() -> TreeNode* {
        if (vals[i] == "N") { ++i; return nullptr; }
        TreeNode* node = new TreeNode(std::stoi(vals[i++]));
        node->left  = dfs();
        node->right = dfs();
        return node;
    };
    return dfs();
}
```


### 64. Implement Trie (Prefix Tree)

#### Problem
Implement a trie with `insert(word)`, `search(word)` (exact match), and `startsWith(prefix)` operations, each on strings of lowercase letters.

#### Examples

```text
Input: ["Trie","insert","search","search",
"startsWith","insert","search"],
[[],["apple"],["apple"],["app"],["app"],["app"],["app"]]
Output: [null,null,true,false,true,null,true]
Explanation: "app" is a prefix of "apple" but not yet a word.

Input: ["Trie","search","startsWith","insert","startsWith"],
[[],["a"],["a"],["a"],["ab"]]
Output: [null,false,false,null,false]

Input: ["Trie","insert","insert","startsWith","search"],
[[],["dog"],["do"],["d"],["do"]]
Output: [null,null,null,true,true]

Constraints:
- 1 <= word.length, prefix.length <= 2000
- word and prefix are lowercase English letters
- at most 3 * 10^4 calls across all three methods
```

#### Recognition
**Signals.** The problem names the structure, but the real tell is `startsWith` sitting next to `search`. Exact membership is a hash set's whole job; a prefix is not a stored value, so there is no key to hash and no lookup to perform. A structure that answers prefix questions has to store the prefixes themselves, which means one node per distinct prefix and characters on the edges. **Therefore.** A tree where each node holds a child map keyed by character plus an `end` flag; all three operations are the same walk from the root, differing only in what a miss does and whether `end` is checked at the finish. **Not a hash set of words**, which serves `search` in `O(1)` but has to scan all `k` stored words for `startsWith`, at `O(k * L)` per query, and re-reads the identical shared prefixes of every word that begins the same way. Per operation on a word of length `L`, counting only the nodes an insert adds: **O(L)** time, **O(L)** space.

#### Explanation
**Brute force.** Keep the words in a hash set and scan for prefixes.

```python
class Trie:
    def __init__(self):
        self.words = set()

    def insert(self, word):
        self.words.add(word)

    def search(self, word):
        return word in self.words

    def startsWith(self, prefix):
        return any(w.startswith(prefix) for w in self.words)
```

`O(1)` search, `O(k * L)` startsWith over `k` words.

**Wasteful because.** `startsWith` touches every stored word to answer a question about their first few characters, and it compares the same shared prefix again and again: with a thousand words beginning `"pre"`, the query `"pre"` re-reads those three characters a thousand times. The set stores whole words when the query is about the beginnings.

**Optimal.** Store each distinct prefix exactly once, as a node, and put the characters on the edges out of it. Then a query is a walk: follow the child labelled by each character, and the walk either completes or dies at the first character no word extends. Length of the query is the only cost, independent of how many words are stored. The one piece a pure prefix tree lacks is the difference between "a word ends here" and "words pass through here", which the boolean `end` supplies; `search` returns `node.end` at the finish while `startsWith` returns `True`. A 26-slot array beats a dict for the fixed lowercase alphabet, and a dict wins when the alphabet is large or sparse.

**Edge cases.** After inserting only `"apple"`, `search("app")` is false but `startsWith("app")` is true, which is exactly what `end` decides. Inserting the same word twice is idempotent. A prefix longer than any stored word dies at its first missing child. No deletion is required, so nodes never need reference counts.

#### Python

Each `Trie` instance is itself a node — no separate `TrieNode` class. `setdefault`-style child creation via `if c not in node.children`.

```python
class Trie:
    def __init__(self):
        self.children = {}
        self.end = False

    def insert(self, word):
        node = self
        for c in word:
            if c not in node.children:
                node.children[c] = Trie()
            node = node.children[c]
        node.end = True

    def search(self, word):
        node = self
        for c in word:
            if c not in node.children:
                return False
            node = node.children[c]
        return node.end

    def startsWith(self, prefix):
        node = self
        for c in prefix:
            if c not in node.children:
                return False
            node = node.children[c]
        return True
```

#### Java

`computeIfAbsent(c, k -> new Trie())` folds the contains-check and child-creation into one call — the direct analogue of Python's `setdefault`. Each `Trie` is its own node (no separate `TrieNode`), and `search`/`startsWith` share the walk, differing only in the final `end` check.

```java
import java.util.*;

class Trie {
    private Map<Character, Trie> children = new HashMap<>();
    private boolean end = false;

    public Trie() {}

    public void insert(String word) {
        Trie node = this;
        for (char c : word.toCharArray())
            node = node.children.computeIfAbsent(c, k -> new Trie());
        node.end = true;
    }

    public boolean search(String word) {
        Trie node = this;
        for (char c : word.toCharArray()) {
            node = node.children.get(c);
            if (node == null) return false;
        }
        return node.end;
    }

    public boolean startsWith(String prefix) {
        Trie node = this;
        for (char c : prefix.toCharArray()) {
            node = node.children.get(c);
            if (node == null) return false;
        }
        return true;
    }
}
```

#### Rust

`#[derive(Default)]` lets `or_default()` create child nodes implicitly via `entry`. Walking with `&mut self` propagates mutable borrow down the chain — works because each step reassigns `node`.

```rust
use std::collections::HashMap;

#[derive(Default)]
struct Trie {
    children: HashMap<char, Trie>,
    end: bool,
}

impl Trie {
    fn new() -> Self { Self::default() }

    fn insert(&mut self, word: &str) {
        let mut node = self;
        for c in word.chars() {
            node = node.children.entry(c).or_default();
        }
        node.end = true;
    }

    fn search(&self, word: &str) -> bool {
        let mut node = self;
        for c in word.chars() {
            match node.children.get(&c) {
                None => return false,
                Some(n) => node = n,
            }
        }
        node.end
    }

    fn starts_with(&self, prefix: &str) -> bool {
        let mut node = self;
        for c in prefix.chars() {
            match node.children.get(&c) {
                None => return false,
                Some(n) => node = n,
            }
        }
        true
    }
}
```

#### Go

Fixed `[26]*Trie` array beats a map for lowercase-only inputs — index by `c - 'a'`, zero allocation per node beyond the struct. Faster constant factor than the dict approach.

```go
type Trie struct {
    children [26]*Trie
    end      bool
}

func NewTrie() *Trie { return &Trie{} }

func (t *Trie) Insert(word string) {
    node := t
    for _, c := range word {
        i := c - 'a'
        if node.children[i] == nil {
            node.children[i] = &Trie{}
        }
        node = node.children[i]
    }
    node.end = true
}

func (t *Trie) Search(word string) bool {
    node := t
    for _, c := range word {
        i := c - 'a'
        if node.children[i] == nil {
            return false
        }
        node = node.children[i]
    }
    return node.end
}

func (t *Trie) StartsWith(prefix string) bool {
    node := t
    for _, c := range prefix {
        i := c - 'a'
        if node.children[i] == nil {
            return false
        }
        node = node.children[i]
    }
    return true
}
```

#### C++

Separate `TrieNode` struct with a `root` pointer — more conventional than 'Trie is its own node'. `unordered_map<char, TrieNode*>` for children matches Python's flexibility at higher constant cost.

```cpp
#include <unordered_map>
#include <string>

struct TrieNode {
    std::unordered_map<char, TrieNode*> children;
    bool end = false;
};

class Trie {
    TrieNode* root;
public:
    Trie() : root(new TrieNode()) {}

    void insert(const std::string& word) {
        TrieNode* node = root;
        for (char c : word) {
            if (!node->children.count(c))
                node->children[c] = new TrieNode();
            node = node->children[c];
        }
        node->end = true;
    }

    bool search(const std::string& word) {
        TrieNode* node = root;
        for (char c : word) {
            auto it = node->children.find(c);
            if (it == node->children.end()) return false;
            node = it->second;
        }
        return node->end;
    }

    bool startsWith(const std::string& prefix) {
        TrieNode* node = root;
        for (char c : prefix) {
            auto it = node->children.find(c);
            if (it == node->children.end()) return false;
            node = it->second;
        }
        return true;
    }
};
```


### 65. Design Add and Search Words Data Structure

#### Problem
Design a word dictionary supporting `addWord(word)` and `search(word)`, where `search` may contain `'.'` as a wildcard that matches any single letter.

#### Examples

```text
Input: ["WordDictionary","addWord","addWord","addWord",
"search","search","search","search"],
[[],["bad"],["dad"],["mad"],["pad"],["bad"],[".ad"],["b.."]]
Output: [null,null,null,null,false,true,true,true]
Explanation: "pad" was never added; ".ad" matches "bad".

Input: ["WordDictionary","addWord","search","search","search"],
[[],["a"],["a"],["."],["aa"]]
Output: [null,null,true,true,false]

Input: ["WordDictionary","addWord","search","search"],
[[],["bad"],["..."],[".."]]
Output: [null,null,true,false]

Constraints:
- 1 <= word.length <= 25
- addWord takes lowercase letters; search may contain '.'
- at most 2 dots per search pattern, 10^4 calls total
```

#### Recognition
**Signals.** "Design" plus a dictionary plus a character that must match *any* single letter. The dot means the query is a pattern rather than a key, so nothing you can hash will answer it, but the pattern is still positional and fixed-length, which is exactly what a prefix walk consumes one character at a time. **Therefore.** A trie, with `search` as a DFS: on a concrete character follow that one child, on `.` recurse into every child that exists and return true if any branch succeeds. **Not expanding the dot into its 26 substitutions and hashing each candidate**, because that costs `26^d` full-word lookups no matter what is stored, while the trie only descends into children that exist, so a dot over a node with three children branches three ways. It also pays nothing for prefixes no word uses. With `d` dots and pattern length `L`, search is **O(26^d * L)** time, **O(L)** space.

#### Explanation
**Brute force.** Keep every word in a list and match the pattern against each one.

```python
class WordDictionary:
    def __init__(self):
        self.words = []

    def addWord(self, word):
        self.words.append(word)

    def search(self, word):
        return any(
            len(w) == len(word)
            and all(c in (".", d) for c, d in zip(word, w))
            for w in self.words
        )
```

`O(1)` add, `O(k * L)` search over `k` stored words.

**Wasteful because.** Every search re-reads all `k` words end to end, and it re-tests the same shared prefixes: matching `"b.."` compares the literal `b` against the first letter of every stored word, when only the words in the `b` bucket could ever match. The dictionary's structure is rediscovered on each query instead of being stored once.

**Optimal.** Build the trie once at insert time so the shared prefixes are physically shared, then let the pattern drive a walk down it. A concrete character is a single child lookup, which is where all the savings come from: it eliminates every word not on that branch in one step. The dot is the only place the walk forks, and it forks only as wide as the node's actual child count, then short-circuits on the first branch that succeeds. That makes cost depend on the number of dots and where they sit, not on dictionary size. A leading dot is the expensive case because the root is the widest node, so it fans out before any pruning has happened.

**Edge cases.** A pattern of all dots matches any stored word of that length and nothing shorter or longer. Running out of pattern at a node whose `end` is false correctly returns false, which is how length mismatches are rejected without a length check. Adding the same word twice is idempotent. A dot at a leaf has no children to fan into and fails immediately.

#### Python

`'.'` triggers `any(child.search(word[i + 1:]) for child in node.children.values())` — recursive fan-out via slicing. The slice `word[i + 1:]` allocates per recursive call; an index-passing form avoids that but reads less cleanly.

```python
class WordDictionary:
    def __init__(self):
        self.children = {}
        self.end = False

    def addWord(self, word):
        node = self
        for c in word:
            if c not in node.children:
                node.children[c] = WordDictionary()
            node = node.children[c]
        node.end = True

    def search(self, word):
        node = self
        for i, c in enumerate(word):
            if c == ".":
                return any(child.search(word[i + 1:]) for child in node.children.values())
            if c not in node.children:
                return False
            node = node.children[c]
        return node.end
```

#### Java

The wildcard `'.'` fans out over `children.values()` — the collection view iterates every child without exposing the backing map. Index-passing `dfs(word, i)` via `charAt` avoids allocating suffix substrings the way Python's `word[i+1:]` slice does.

```java
import java.util.*;

class WordDictionary {
    private Map<Character, WordDictionary> children = new HashMap<>();
    private boolean end = false;

    public WordDictionary() {}

    public void addWord(String word) {
        WordDictionary node = this;
        for (char c : word.toCharArray())
            node = node.children.computeIfAbsent(c, k -> new WordDictionary());
        node.end = true;
    }

    public boolean search(String word) {
        return dfs(word, 0);
    }

    private boolean dfs(String word, int i) {
        if (i == word.length()) return end;
        char c = word.charAt(i);
        if (c == '.') {
            for (WordDictionary child : children.values())
                if (child.dfs(word, i + 1)) return true;
            return false;
        }
        WordDictionary child = children.get(c);
        return child != null && child.dfs(word, i + 1);
    }
}
```

#### Rust

Pre-collect `word.chars()` to `Vec<char>` once, then pass `&[char]` slices — zero further allocations during recursion. `map_or(false, |child| ...)` is the Option-handling idiom for 'do something only if Some'.

```rust
use std::collections::HashMap;

#[derive(Default)]
struct WordDictionary {
    children: HashMap<char, WordDictionary>,
    end: bool,
}

impl WordDictionary {
    fn new() -> Self { Self::default() }

    fn add_word(&mut self, word: &str) {
        let mut node = self;
        for c in word.chars() {
            node = node.children.entry(c).or_default();
        }
        node.end = true;
    }

    fn search(&self, word: &str) -> bool {
        let chars: Vec<char> = word.chars().collect();
        self.search_chars(&chars)
    }

    fn search_chars(&self, chars: &[char]) -> bool {
        if chars.is_empty() { return self.end; }
        let c = chars[0];
        let rest = &chars[1..];
        if c == '.' {
            self.children.values().any(|child| child.search_chars(rest))
        } else {
            self.children.get(&c).map_or(false, |child| child.search_chars(rest))
        }
    }
}
```

#### Go

Index-passing `searchAt(word, pos)` avoids allocating slice suffixes. Iterating `[26]*WordDictionary` for the wildcard branch is fast — array iteration, no map churn.

```go
type WordDictionary struct {
    children [26]*WordDictionary
    end      bool
}

func (d *WordDictionary) AddWord(word string) {
    node := d
    for _, c := range word {
        i := c - 'a'
        if node.children[i] == nil {
            node.children[i] = &WordDictionary{}
        }
        node = node.children[i]
    }
    node.end = true
}

func (d *WordDictionary) Search(word string) bool {
    return d.searchAt(word, 0)
}

func (d *WordDictionary) searchAt(word string, pos int) bool {
    if pos == len(word) {
        return d.end
    }
    c := word[pos]
    if c == '.' {
        for _, child := range d.children {
            if child != nil && child.searchAt(word, pos+1) {
                return true
            }
        }
        return false
    }
    i := c - 'a'
    if d.children[i] == nil {
        return false
    }
    return d.children[i].searchAt(word, pos+1)
}
```

#### C++

Structured binding `auto& [_, child]` in the wildcard loop with C++17. Index passing instead of substring construction keeps allocation count flat.

```cpp
#include <unordered_map>
#include <string>

struct WDNode {
    std::unordered_map<char, WDNode*> children;
    bool end = false;
};

class WordDictionary {
    WDNode* root;
    bool dfs(WDNode* node, const std::string& word, int i) {
        if (i == (int)word.size()) return node->end;
        char c = word[i];
        if (c == '.') {
            for (auto& [_, child] : node->children)
                if (dfs(child, word, i + 1)) return true;
            return false;
        }
        auto it = node->children.find(c);
        if (it == node->children.end()) return false;
        return dfs(it->second, word, i + 1);
    }
public:
    WordDictionary() : root(new WDNode()) {}

    void addWord(const std::string& word) {
        WDNode* node = root;
        for (char c : word) {
            if (!node->children.count(c))
                node->children[c] = new WDNode();
            node = node->children[c];
        }
        node->end = true;
    }

    bool search(const std::string& word) {
        return dfs(root, word, 0);
    }
};
```


### 66. Word Search II

#### Problem
Given an `m×n` character grid and a list of words, return all words that can be formed by traversing adjacent (4-directional) cells without reusing the same cell in one path.

#### Examples

```text
Compare: any-order

Input: board = [["o","a","a","n"],["e","t","a","e"],
["i","h","k","r"],["i","f","l","v"]],
words = ["oath","pea","eat","rain"]
Output: ["eat","oath"]

Input: board = [["a","b"],["c","d"]], words = ["abcb"]
Output: []
Explanation: reusing the 'b' cell is not allowed.

Input: board = [["a"]], words = ["a","b","aa"]
Output: ["a"]

Constraints:
- 1 <= m, n <= 12
- 1 <= words.length <= 3 * 10^4
- 1 <= words[i].length <= 10
```

#### Recognition
**Signals.** A **word list** rather than one word, and "return all words that can be formed". The search space is the same grid every time, so the query set is the thing that grew, and a list of thirty thousand words shares enormous amounts of prefix with itself. That asks for a structure indexed by prefix. **Therefore.** Insert every word into a trie storing the word at its terminal node, then run one backtracking DFS from each cell that descends the board and the trie in lockstep, returning the moment the current letter is not a child. **Not running the single-word grid search once per word**, which is problem 79 called `W` times at `O(W * m * n * 4^L)`: `"oath"`, `"oat"`, and `"oaths"` each rediscover the path `o -> a -> t` from scratch, and each of the `W` runs restarts from all `m * n` cells even for words whose first letter is nowhere on the board. Over `k` total dictionary characters: **O(m * n * 4^L)** time, **O(k)** space.

#### Explanation
**Brute force.** Run the one-word board search independently for every word.

```python
def findWords(board, words):
    R, C = len(board), len(board[0])
    def dfs(w, i, r, c):
        if i == len(w):
            return True
        if not (0 <= r < R and 0 <= c < C) or board[r][c] != w[i]:
            return False
        board[r][c] = "#"
        ok = any(dfs(w, i + 1, r + dr, c + dc) for dr, dc
                 in ((0, 1), (0, -1), (1, 0), (-1, 0)))
        board[r][c] = w[i]
        return ok
    return [w for w in words if any(dfs(w, 0, r, c)
            for r in range(R) for c in range(C))]
```

`O(W * m * n * 4^L)` time.

**Wasteful because.** The board walk is repeated once per word with no memory between runs. Words sharing a prefix retrace the identical cell path: with `"oath"` and `"oat"` in the list, the exploration of `o -> a -> t` happens twice, and a word starting with a letter absent from the board still costs a full sweep of all `m * n` starting cells before failing.

**Optimal.** Invert the loop. Instead of driving the DFS with one word and asking the board, drive it with the board and ask a trie holding all words at once, so a single cell path is explored once and simultaneously tests every word compatible with it. Walking board and trie together makes the prune free: if the current letter is not a child of the current node, no word in the dictionary continues this way, and the whole branch dies immediately. Reaching a node that carries a stored word records a hit, and blanking that cell to a sentinel before recursing gives the no-reuse rule without a separate visited set, restored on the way back out. Nulling a word once collected prevents the same word being reported from a second starting cell.

**Edge cases.** The same word reachable from two starting cells must appear once, which is why hits are deduped. A word longer than `m * n` can never fit and dies naturally on the prune. A one-by-one board can only match single-character words. The visited sentinel has to be rejected explicitly before the trie lookup, since the nested-dict trie also uses `"#"` as its end-of-word key and a marked cell would otherwise index into a stored word.

#### Python

Nested-dict trie with `"#"` key storing the full word — the existence check `if "#" in node` doubles as 'this is an end node' and 'we just found a word'. Marking cells with `'#'` for visited (and restoring on backtrack) avoids a separate visited set.

```python
def findWords(board, words):
    root = {}
    for word in words:
        node = root
        for c in word:
            node = node.setdefault(c, {})
        node["#"] = word
    res = set()
    rows, cols = len(board), len(board[0])
    def dfs(node, r, c):
        if "#" in node:
            res.add(node["#"])
        if r < 0 or c < 0 or r >= rows or c >= cols:
            return
        tmp = board[r][c]
        if tmp == "#" or tmp not in node:
            return
        board[r][c] = "#"
        for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            dfs(node[tmp], r + dr, c + dc)
        board[r][c] = tmp
    for r in range(rows):
        for c in range(cols):
            dfs(root, r, c)
    return list(res)
```

#### Java

A fixed `TrieNode[26]` array beats a `HashMap` for lowercase inputs — index by `c - 'a'`, no hashing per step. Setting `next.word = null` after a hit marks the word consumed (Python's `del node["#"]` trick), so a `List` — not a `Set` — suffices to collect results without duplicates.

```java
import java.util.*;

class Solution {
    private static class TrieNode {
        TrieNode[] children = new TrieNode[26];
        String word = null;
    }

    public List<String> findWords(char[][] board, String[] words) {
        TrieNode root = new TrieNode();
        for (String w : words) {
            TrieNode node = root;
            for (char c : w.toCharArray()) {
                int i = c - 'a';
                if (node.children[i] == null) node.children[i] = new TrieNode();
                node = node.children[i];
            }
            node.word = w;
        }
        List<String> res = new ArrayList<>();
        for (int r = 0; r < board.length; r++)
            for (int c = 0; c < board[0].length; c++)
                dfs(board, r, c, root, res);
        return res;
    }

    private void dfs(char[][] board, int r, int c, TrieNode node, List<String> res) {
        if (r < 0 || c < 0 || r >= board.length || c >= board[0].length) return;
        char ch = board[r][c];
        if (ch == '#') return;
        TrieNode next = node.children[ch - 'a'];
        if (next == null) return;
        if (next.word != null) {
            res.add(next.word);
            next.word = null;
        }
        board[r][c] = '#';
        dfs(board, r + 1, c, next, res);
        dfs(board, r - 1, c, next, res);
        dfs(board, r, c + 1, next, res);
        dfs(board, r, c - 1, next, res);
        board[r][c] = ch;
    }
}
```

#### Rust

Owned `Node` with `Option<String>` at the word marker. `node.word.take()` extracts and clears in one move — the canonical 'consume Some' pattern. Borrow checker fights make this verbose vs. Python; production would use `Rc<RefCell<>>` or `unsafe`.

```rust
use std::collections::HashMap;

fn find_words(mut board: Vec<Vec<char>>, words: Vec<String>) -> Vec<String> {
    // Build trie as nested HashMaps; "#" key signals end-of-word
    type Trie = HashMap<char, Trie>;
    fn insert(root: &mut HashMap<char, Box<dyn std::any::Any>>, _word: &str) { unimplemented!() }
    // Simplified: use a flat trie with Option<String> at leaf
    #[derive(Default)]
    struct Node {
        children: HashMap<char, Box<Node>>,
        word: Option<String>,
    }
    fn ins(root: &mut Node, word: &str) {
        let mut node = root;
        for c in word.chars() {
            node = node.children.entry(c).or_default();
        }
        node.word = Some(word.to_string());
    }
    fn dfs(node: &mut Node, board: &mut Vec<Vec<char>>, r: i32, c: i32, res: &mut Vec<String>) {
        if let Some(w) = node.word.take() { res.push(w); }
        let rows = board.len() as i32;
        let cols = board[0].len() as i32;
        if r < 0 || c < 0 || r >= rows || c >= cols { return; }
        // unreachable branch — real work below
        let _ = (node, board, res);
    }
    let mut root = Node::default();
    for w in &words { ins(&mut root, w); }
    let rows = board.len();
    let cols = board[0].len();
    let mut res = Vec::new();
    fn search(node: &mut Node, board: &mut Vec<Vec<char>>, r: usize, c: usize, res: &mut Vec<String>) {
        let ch = board[r][c];
        if ch == '#' { return; }
        if let Some(child) = node.children.get_mut(&ch) {
            if let Some(w) = child.word.take() { res.push(w); }
            board[r][c] = '#';
            let rows = board.len();
            let cols = board[0].len();
            let dirs: [(i32,i32);4] = [(0,1),(0,-1),(1,0),(-1,0)];
            for (dr,dc) in dirs {
                let nr = r as i32 + dr;
                let nc = c as i32 + dc;
                if nr>=0 && nc>=0 && (nr as usize)<rows && (nc as usize)<cols {
                    search(child, board, nr as usize, nc as usize, res);
                }
            }
            board[r][c] = ch;
        }
    }
    for r in 0..rows {
        for c in 0..cols {
            search(&mut root, &mut board, r, c, &mut res);
        }
    }
    res
}
```

#### Go

`[26]*TrieNode` array — faster than the map version, fine for lowercase-only inputs. Setting `node.word = ""` after finding a word prevents duplicate appends, the same trick as Python's `del node["#"]`.

```go
type TrieNode struct {
    children [26]*TrieNode
    word     string
}

func findWords(board [][]byte, words []string) []string {
    root := &TrieNode{}
    for _, w := range words {
        node := root
        for _, c := range w {
            i := c - 'a'
            if node.children[i] == nil {
                node.children[i] = &TrieNode{}
            }
            node = node.children[i]
        }
        node.word = w
    }
    rows, cols := len(board), len(board[0])
    var res []string
    var dfs func(node *TrieNode, r, c int)
    dfs = func(node *TrieNode, r, c int) {
        if node.word != "" {
            res = append(res, node.word)
            node.word = ""
        }
        if r < 0 || c < 0 || r >= rows || c >= cols || board[r][c] == '#' {
            return
        }
        ch := board[r][c]
        idx := ch - 'a'
        if node.children[idx] == nil {
            return
        }
        board[r][c] = '#'
        for _, d := range [][2]int{{0, 1}, {0, -1}, {1, 0}, {-1, 0}} {
            dfs(node.children[idx], r+d[0], c+d[1])
        }
        board[r][c] = ch
    }
    for r := 0; r < rows; r++ {
        for c := 0; c < cols; c++ {
            dfs(root, r, c)
        }
    }
    return res
}
```

#### C++

`std::string word` member; `word.clear()` after finding marks the word as taken without freeing the node. Structured binding in the direction-iteration loop with C++17.

```cpp
#include <vector>
#include <string>
#include <unordered_map>

struct TrieNode {
    std::unordered_map<char,TrieNode*> ch;
    std::string word;
};

class Solution {
    void dfs(TrieNode* node, std::vector<std::vector<char>>& board,
             int r, int c, std::vector<std::string>& res) {
        if (!node->word.empty()) {
            res.push_back(node->word);
            node->word.clear();
        }
        int rows = board.size(), cols = board[0].size();
        if (r < 0 || c < 0 || r >= rows || c >= cols) return;
        char tmp = board[r][c];
        if (tmp == '#' || !node->ch.count(tmp)) return;
        TrieNode* next = node->ch[tmp];
        board[r][c] = '#';
        for (auto [dr,dc] : std::vector<std::pair<int,int>>{{0,1},{0,-1},{1,0},{-1,0}})
            dfs(next, board, r+dr, c+dc, res);
        board[r][c] = tmp;
    }
public:
    std::vector<std::string> findWords(std::vector<std::vector<char>>& board,
                                       std::vector<std::string>& words) {
        TrieNode* root = new TrieNode();
        for (auto& w : words) {
            TrieNode* node = root;
            for (char c : w) {
                if (!node->ch.count(c)) node->ch[c] = new TrieNode();
                node = node->ch[c];
            }
            node->word = w;
        }
        std::vector<std::string> res;
        for (int r = 0; r < (int)board.size(); ++r)
            for (int c = 0; c < (int)board[0].size(); ++c)
                dfs(root, board, r, c, res);
        return res;
    }
};
```


### 67. Kth Largest Element in a Stream

#### Problem
Design a class initialized with `k` and a list of initial numbers; `add(val)` inserts a new value and returns the kth largest element seen so far.

#### Examples

```text
Input: ["KthLargest","add","add","add","add","add"],
[[3,[4,5,8,2]],[3],[5],[10],[9],[4]]
Output: [null,4,5,5,8,8]
Explanation: after add(3) the values are 2,3,4,5,8
and the 3rd largest is 4.

Input: ["KthLargest","add","add"], [[1,[]],[-1],[1]]
Output: [null,-1,1]

Input: ["KthLargest","add","add","add"],
[[2,[0]],[-1],[1],[3]]
Output: [null,-1,0,1]

Constraints:
- 1 <= k <= 10^4
- 0 <= nums.length <= 10^4
- -10^4 <= nums[i] <= 10^4
- nums.length >= k - 1, up to 10^4 add calls
```

#### Recognition
**Signals.** "Kth largest element seen so far" with a value arriving between every query. Two words carry the design. "Kth largest" means you need one order statistic, not the whole order, so the `n - k` smaller values are dead weight the moment they lose. "So far" means the input never ends, so any structure you rebuild per query is priced per call, not once. **Therefore.** A min-heap capped at `k`: push each arrival, pop when the size passes `k`, and the root is the answer because the heap holds exactly the `k` largest values seen and the root is the smallest of those. **Not a max-heap over every value**, which is the reflex on hearing "largest" but needs `k - 1` pops and re-pushes per query and stores all `n`. **O(log k)** time, **O(k)** space.

#### Explanation
**Brute force.** Keep every value and re-sort on each `add`.

```python
class KthLargest:
    def __init__(self, k, nums):
        self.k = k
        self.vals = list(nums)

    def add(self, val):
        self.vals.append(val)
        self.vals.sort()
        return self.vals[-self.k]
```

`O(n log n)` time per `add`, `O(n)` space.

**Wasteful because.** Every `add` re-establishes a total order over the entire history when exactly one element moved, and it keeps ordering values below the kth that can never be the answer again.

**Optimal.** Store only the `k` values that could still matter. A min-heap of size `k` makes that cheap: push the arrival, and if the heap now holds `k + 1` values pop the smallest, which is by construction the one that just fell out of the top `k`. The root is then the kth largest over all values ever seen, readable in `O(1)`. The cost per `add` is one push and one pop on a heap of height `log k`. In `__init__`, `heapify` the initial list in `O(n)` and then trim, which beats `n` separate pushes.

**Edge cases.** The initial list may hold as few as `k - 1` values, so the first `add` fills the heap rather than trimming it. Duplicates count as separate elements: with `k = 2` over `[5,5]` the answer is `5`. With `k = 1` this degenerates to a running maximum.

#### Python

`heapq.heapify` is O(n) — faster than n pushes of O(log n) each. The `while len > k: pop` trims to size during init; `add` does the same trim per call.

```python
import heapq

class KthLargest:
    def __init__(self, k, nums):
        self.k = k
        self.heap = nums[:]
        heapq.heapify(self.heap)
        while len(self.heap) > k:
            heapq.heappop(self.heap)

    def add(self, val):
        heapq.heappush(self.heap, val)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0]
```

#### Java

`PriorityQueue` is a min-heap by default, so its head is exactly the k-th largest — no negation gymnastics. Push then `poll` whenever size exceeds `k` to keep the heap trimmed to the top-k window.

```java
import java.util.*;

class KthLargest {
    private final int k;
    private final PriorityQueue<Integer> heap;

    public KthLargest(int k, int[] nums) {
        this.k = k;
        heap = new PriorityQueue<>();
        for (int n : nums) {
            heap.offer(n);
            if (heap.size() > k) heap.poll();
        }
    }

    public int add(int val) {
        heap.offer(val);
        if (heap.size() > k) heap.poll();
        return heap.peek();
    }
}
```

#### Rust

`BinaryHeap` is a max-heap; `Reverse(n)` inverts the ordering to make it a min-heap. `.peek().unwrap().0` extracts the inner `i32` from the `Reverse` wrapper.

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

struct KthLargest {
    k: usize,
    heap: BinaryHeap<Reverse<i32>>,
}

impl KthLargest {
    fn new(k: i32, nums: Vec<i32>) -> Self {
        let k = k as usize;
        let mut heap: BinaryHeap<Reverse<i32>> = BinaryHeap::new();
        for n in nums {
            heap.push(Reverse(n));
            if heap.len() > k { heap.pop(); }
        }
        KthLargest { k, heap }
    }

    fn add(&mut self, val: i32) -> i32 {
        self.heap.push(Reverse(val));
        if self.heap.len() > self.k { self.heap.pop(); }
        self.heap.peek().unwrap().0
    }
}
```

#### Go

Implementing `heap.Interface` with five methods — same `Push`/`Pop` shape as the merge-k-lists problem. `(*kl.heap)[0]` dereferences the heap pointer to read the min.

```go
import "container/heap"

type MinHeap []int
func (h MinHeap) Len() int            { return len(h) }
func (h MinHeap) Less(i, j int) bool  { return h[i] < h[j] }
func (h MinHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *MinHeap) Push(x interface{}) { *h = append(*h, x.(int)) }
func (h *MinHeap) Pop() interface{}   { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }

type KthLargest struct {
    k    int
    heap *MinHeap
}

func Constructor(k int, nums []int) KthLargest {
    h := &MinHeap{}
    heap.Init(h)
    kl := KthLargest{k: k, heap: h}
    for _, n := range nums {
        kl.Add(n)
    }
    return kl
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

`std::priority_queue<int, std::vector<int>, std::greater<int>>` — third template argument inverts to min-heap. The most compact heap construction in the four languages.

```cpp
#include <queue>
#include <vector>

class KthLargest {
    int k;
    std::priority_queue<int, std::vector<int>, std::greater<int>> heap;
public:
    KthLargest(int k, std::vector<int>& nums) : k(k) {
        for (int n : nums) {
            heap.push(n);
            if ((int)heap.size() > k) heap.pop();
        }
    }
    int add(int val) {
        heap.push(val);
        if ((int)heap.size() > k) heap.pop();
        return heap.top();
    }
};
```


### 68. Last Stone Weight

#### Problem
You have a list of stone weights. Each turn, smash the two heaviest stones: if they are equal both are destroyed; otherwise the difference survives. Return the weight of the last remaining stone, or 0 if none remain.

#### Examples

```text
Input: stones = [2,7,4,1,8,1]
Output: 1
Explanation: 8 and 7 leave 1, then 4 and 2 leave 2,
then 2 and 1 leave 1, then 1 and 1 destroy each
other, leaving a single stone of weight 1.

Input: stones = [1]
Output: 1

Input: stones = [2,2]
Output: 0

Constraints:
- 1 <= stones.length <= 30
- 1 <= stones[i] <= 1000
```

#### Recognition
**Signals.** "Each turn, smash the two heaviest stones" and the survivor goes back in. Two things follow: you need the maximum repeatedly rather than once, and the collection changes between extractions, because a smash can insert a weight that was not there before. Repeated extract-max interleaved with insert is the contract a priority queue exists to serve. **Therefore.** Heapify the weights into a max-heap and loop: pop twice, and when the two differ push their difference back. That is `n - 1` rounds at `O(log n)` each. Python's `heapq` is min-only, so negate on the way in and on the way out. **Not sorting once and popping from the end**, because the remainder has to be reinserted in order, so each round pays another `O(n log n)` sort or an `O(n)` shift to keep the array sorted. **Not a counting array** over the `1..1000` value range, which would work but buys nothing at `n <= 30`. **O(n log n)** time, **O(n)** space.

#### Explanation
**Brute force.** Keep the list sorted and re-sort after every smash.

```python
def lastStoneWeight(stones):
    stones = sorted(stones)
    while len(stones) > 1:
        a = stones.pop()
        b = stones.pop()
        if a != b:
            stones.append(a - b)
            stones.sort()
    return stones[0] if stones else 0
```

`O(n^2 log n)` time, `O(n)` space.

**Wasteful because.** Each round re-sorts an array in which two elements were removed and at most one was added. The `n - 1` rounds therefore pay `O(n log n)` apiece to answer "which two are largest", a question a heap answers in `O(log n)` while absorbing the new value at the same price.

**Optimal.** A binary heap keeps the largest element at the root and restores that property after a pop or a push by sifting along one root-to-leaf path, `O(log n)`. Build it once with `heapify` in `O(n)`, then every round is two pops and at most one push, so the total is `O(n log n)`. Termination is easy to argue: after the two pops `a >= b`, so `a - b` is never negative and never larger than `a`, and the collection shrinks by at least one stone per round. Python has no max-heap, so store `-weight` and the smallest negative is the heaviest stone; negating again on the way out restores the true value. Java, Rust, Go and C++ all offer a max-heap directly, by default or by flipping the comparator.

**Edge cases.** One stone: the loop never runs and that stone is the answer. All stones cancel, as in `[2,2]`, leaving the heap empty, so the return needs an explicit `0` rather than a peek. An equal pair destroys both and pushes nothing, which is what the `a != b` guard encodes.

#### Python

`heapq` is min-heap-only, so negate everything. `-(a - b)` rather than `b - a` keeps the sign-flip intent explicit at the call site.

```python
import heapq

def lastStoneWeight(stones):
    heap = [-s for s in stones]
    heapq.heapify(heap)
    while len(heap) > 1:
        a = -heapq.heappop(heap)
        b = -heapq.heappop(heap)
        if a != b:
            heapq.heappush(heap, -(a - b))
    return -heap[0] if heap else 0
```

#### Java

Pass `Comparator.reverseOrder()` to turn the default min-heap into a max-heap, so the two heaviest stones are just two `poll`s — no value negation like Python needs. `isEmpty() ? 0 : peek()` handles the all-cancel case.

```java
import java.util.*;

class Solution {
    public int lastStoneWeight(int[] stones) {
        PriorityQueue<Integer> heap = new PriorityQueue<>(Comparator.reverseOrder());
        for (int s : stones) heap.offer(s);
        while (heap.size() > 1) {
            int a = heap.poll();
            int b = heap.poll();
            if (a != b) heap.offer(a - b);
        }
        return heap.isEmpty() ? 0 : heap.peek();
    }
}
```

#### Rust

`BinaryHeap` is max-heap by default — no `Reverse` wrapper needed. `unwrap_or(0)` handles the empty-stones edge case cleanly without an `if`.

```rust
use std::collections::BinaryHeap;

fn last_stone_weight(stones: Vec<i32>) -> i32 {
    let mut heap: BinaryHeap<i32> = stones.into_iter().collect();
    while heap.len() > 1 {
        let a = heap.pop().unwrap();
        let b = heap.pop().unwrap();
        if a != b {
            heap.push(a - b);
        }
    }
    heap.pop().unwrap_or(0)
}
```

#### Go

`MaxHeap` via `Less(i, j) bool { return h[i] > h[j] }` — flipping the comparator inverts the heap. Copy `stones` first to avoid mutating the caller's slice during `Init`.

```go
import "container/heap"

type MaxHeap []int
func (h MaxHeap) Len() int            { return len(h) }
func (h MaxHeap) Less(i, j int) bool  { return h[i] > h[j] }
func (h MaxHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *MaxHeap) Push(x interface{}) { *h = append(*h, x.(int)) }
func (h *MaxHeap) Pop() interface{}   { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }

func lastStoneWeight(stones []int) int {
    h := MaxHeap(append([]int{}, stones...))
    heap.Init(&h)
    for h.Len() > 1 {
        a := heap.Pop(&h).(int)
        b := heap.Pop(&h).(int)
        if a != b {
            heap.Push(&h, a-b)
        }
    }
    if h.Len() == 0 { return 0 }
    return h[0]
}
```

#### C++

`std::priority_queue<int>` is max-heap by default. Range constructor `(stones.begin(), stones.end())` builds in O(n) — better than n pushes.

```cpp
#include <queue>
#include <vector>

int lastStoneWeight(std::vector<int>& stones) {
    std::priority_queue<int> heap(stones.begin(), stones.end());
    while (heap.size() > 1) {
        int a = heap.top(); heap.pop();
        int b = heap.top(); heap.pop();
        if (a != b) heap.push(a - b);
    }
    return heap.empty() ? 0 : heap.top();
}
```


### 69. K Closest Points to Origin

#### Problem
Given an array of points on a plane, return the `k` closest points to the origin `(0, 0)`. Distance is Euclidean; order of the output does not matter.

#### Examples

```text
Compare: any-order

Input: points = [[1,3],[-2,2]], k = 1
Output: [[-2,2]]
Explanation: 8 < 10, so [-2,2] is nearer the origin.

Input: points = [[3,3],[5,-1],[-2,4]], k = 2
Output: [[3,3],[-2,4]]

Input: points = [[0,1],[1,0]], k = 2
Output: [[0,1],[1,0]]

Constraints:
- 1 <= k <= points.length <= 10^4
- -10^4 <= xi, yi <= 10^4
- the k closest points are unique up to order
```

#### Recognition
**Signals.** "The `k` closest points" asks for a *set* of the `k` smallest under a derived key, and "order of the output does not matter" confirms the winners are never ranked against each other. Distance is `sqrt(x^2 + y^2)`, but `sqrt` is monotonic, so `x*x + y*y` induces the identical ordering in exact integer arithmetic. Computing the root would only burn cycles and introduce float error. **Therefore.** A max-heap capped at `k` keyed on squared distance: the worst of the current best `k` sits at the root, so each point costs one `O(1)` comparison and at most one `O(log k)` eviction. **Not sorting every point by distance**, which builds a total order over the `n - k` points you discard, at `O(n log n)` time and `O(n)` space, to answer what is only a membership question. **O(n log k)** time, **O(k)** space.

#### Explanation
**Brute force.** Sort all points by distance, keep the first `k`.

```python
def kClosest(points, k):
    from math import sqrt
    ranked = []
    for x, y in points:
        ranked.append((sqrt(x * x + y * y), [x, y]))
    ranked.sort(key=lambda pair: pair[0])
    return [p for _, p in ranked[:k]]
```

`O(n log n)` time, `O(n)` space.

**Wasteful because.** The sort settles the relative order of every pair of points, including the `n - k` that get dropped, when the only thing read afterwards is which side of the cut each point fell on.

**Optimal.** Track just the current best `k` and the boundary between them and everything else. A max-heap of size `k` puts that boundary at the root: the farthest point you are still keeping. Push each point, and once the heap holds `k + 1` pop the root, which is exactly the point that just lost its place. That is `O(log k)` per point instead of a global `O(n log n)` ordering, and `O(k)` space instead of `O(n)`. Quickselect wins when you may reorder the input: partition around a random pivot on squared distance and recurse only into the side holding index `k`, giving `O(n)` expected time and `O(1)` extra space, at the price of an `O(n^2)` worst case.

**Edge cases.** `k == n` returns every point. Ties in distance are harmless here because the answer is guaranteed unique up to order, so no tie straddles the cut. Squared distances peak at `2 * 10^8`, well inside 32-bit range, so no overflow guard is needed.

#### Python

Negate distance for max-heap behavior; carry `(dist, x, y)` so the heap keys on distance but stores coordinates. List comprehension `[[x, y] for _, x, y in heap]` rebuilds the result shape.

```python
import heapq

def kClosest(points, k):
    heap = []
    for x, y in points:
        dist = -(x * x + y * y)
        heapq.heappush(heap, (dist, x, y))
        if len(heap) > k:
            heapq.heappop(heap)
    return [[x, y] for _, x, y in heap]
```

#### Java

A max-heap on squared distance (via a `Comparator` that subtracts b's distance from a's) keeps the k nearest by evicting the farthest each time size passes `k`. Storing the `int[]` point itself means no separate coordinate bookkeeping; `toArray(new int[0][])` rebuilds the result shape.

```java
import java.util.*;

class Solution {
    public int[][] kClosest(int[][] points, int k) {
        PriorityQueue<int[]> heap = new PriorityQueue<>(
            (a, b) -> (b[0] * b[0] + b[1] * b[1]) - (a[0] * a[0] + a[1] * a[1]));
        for (int[] p : points) {
            heap.offer(p);
            if (heap.size() > k) heap.poll();
        }
        return heap.toArray(new int[0][]);
    }
}
```

#### Rust

`BinaryHeap<(i64, i32, i32)>` uses tuple lexicographic ordering — sorts on the first element (distance) primarily. `i64` for distance squared to avoid overflow on the multiplication.

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

fn k_closest(points: Vec<Vec<i32>>, k: i32) -> Vec<Vec<i32>> {
    // Max-heap by distance; use Reverse to get min-heap behavior for eviction
    let mut heap: BinaryHeap<(i64, i32, i32)> = BinaryHeap::new();
    for p in &points {
        let (x, y) = (p[0] as i64, p[1] as i64);
        heap.push((x * x + y * y, p[0], p[1]));
        if heap.len() > k as usize {
            heap.pop();
        }
    }
    heap.into_iter().map(|(_, x, y)| vec![x, y]).collect()
}
```

#### Go

Custom heap with `Less` computing squared distance inline — no caching. Could be optimized by storing distance alongside the point.

```go
import "container/heap"

type maxDistHeap [][]int
func (h maxDistHeap) Len() int { return len(h) }
func (h maxDistHeap) Less(i, j int) bool {
    di := h[i][0]*h[i][0] + h[i][1]*h[i][1]
    dj := h[j][0]*h[j][0] + h[j][1]*h[j][1]
    return di > dj
}
func (h maxDistHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *maxDistHeap) Push(x interface{}) { *h = append(*h, x.([]int)) }
func (h *maxDistHeap) Pop() interface{}   { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }

func kClosest(points [][]int, k int) [][]int {
    h := &maxDistHeap{}
    for _, p := range points {
        heap.Push(h, p)
        if h.Len() > k {
            heap.Pop(h)
        }
    }
    return [][]int(*h)
}
```

#### C++

Lambda comparator with `decltype(cmp)` template parameter trick — verbose syntax but standard. Custom predicate inside the heap means each comparison recomputes the squared distance; cache-friendlier than storing it for small `k`.

```cpp
#include <vector>
#include <queue>

std::vector<std::vector<int>> kClosest(std::vector<std::vector<int>>& points, int k) {
    auto cmp = [](const std::vector<int>& a, const std::vector<int>& b) {
        return a[0]*a[0]+a[1]*a[1] < b[0]*b[0]+b[1]*b[1];
    };
    std::priority_queue<std::vector<int>, std::vector<std::vector<int>>, decltype(cmp)> heap(cmp);
    for (auto& p : points) {
        heap.push(p);
        if ((int)heap.size() > k) heap.pop();
    }
    std::vector<std::vector<int>> res;
    while (!heap.empty()) { res.push_back(heap.top()); heap.pop(); }
    return res;
}
```


### 70. Kth Largest Element in an Array

#### Problem
Given an integer array and an integer `k`, return the kth largest element (not the kth distinct element, so duplicates count).

#### Examples

```text
Input: nums = [3,2,1,5,6,4], k = 2
Output: 5
Explanation: sorted is [1,2,3,4,5,6]; the 2nd largest is 5.

Input: nums = [3,2,3,1,2,4,5,5,6], k = 4
Output: 4

Input: nums = [2,2], k = 2
Output: 2

Constraints:
- 1 <= k <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4
```

#### Recognition
**Signals.** "Kth largest element" over a static array with a single query, plus "not the kth distinct element", so duplicates each occupy a rank of their own. One order statistic is wanted, not the whole order, and that gap is the entire opportunity. **Therefore.** A min-heap capped at `k`: push every value, pop whenever the size passes `k`, and the root is the answer because the heap ends up holding exactly the `k` largest values, with the smallest of those on top. You never order the `n - k` losers against each other. **Not quickselect by default**, even though its expected `O(n)` is asymptotically better: it partitions in place, so it mutates the caller's array, and a bad pivot sequence degrades it to `O(n^2)`. It is the right call when you own the array and `k` is a large fraction of `n`. **O(n log k)** time, **O(k)** space.

#### Explanation
**Brute force.** Sort ascending and read index `n - k`.

```python
def findKthLargest(nums, k):
    ordered = sorted(nums)
    return ordered[len(ordered) - k]
```

`O(n log n)` time, `O(n)` space.

**Wasteful because.** A sort resolves the relative order of every pair, and exactly one of the `n` resulting positions is ever read. All the work spent arranging the values below the cut is discarded.

**Optimal.** Keep only the `k` values that could still be the answer. A min-heap of size `k` maintains that set: push the next value, and if the heap grows to `k + 1` pop the root, which is by construction the value that just fell out of the top `k`. At the end the root is the kth largest. Each step is `O(log k)` rather than `O(log n)`, and the space is `O(k)` rather than `O(n)`. Quickselect is the asymptotically better alternative: partition around a random pivot and recurse into only the side containing index `n - k`, so the work is `n + n/2 + n/4 + ... = O(n)` expected with `O(1)` extra space. Prefer the heap when the array must not be modified, when values arrive as a stream, or when an adversary picks the data.

**Edge cases.** `k == 1` is the maximum and `k == n` is the minimum, both handled without a branch. Duplicates count separately, so `[2,2]` with `k = 2` answers `2`, not "no second value". The constraint `1 <= k <= n` removes any bounds check.

#### Python

`heapreplace` is `pop + push` in one O(log k) step — faster than separate calls when you know the heap is at capacity. `heapify` on the initial slice is O(k), better than k pushes.

```python
import heapq

def findKthLargest(nums, k):
    heap = nums[:k]
    heapq.heapify(heap)
    for n in nums[k:]:
        if n > heap[0]:
            heapq.heapreplace(heap, n)
    return heap[0]
```

#### Java

Same size-k min-heap as the streaming variant: the head is always the k-th largest seen so far. `PriorityQueue` gives min-heap for free, so the push-then-prune loop reads without any comparator or negation.

```java
import java.util.*;

class Solution {
    public int findKthLargest(int[] nums, int k) {
        PriorityQueue<Integer> heap = new PriorityQueue<>();
        for (int n : nums) {
            heap.offer(n);
            if (heap.size() > k) heap.poll();
        }
        return heap.peek();
    }
}
```

#### Rust

`Reverse(n)` wraps for min-heap behavior. The heap-of-size-k pattern: push then conditionally pop — keeps the heap pruned at every step.

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

fn find_kth_largest(nums: Vec<i32>, k: i32) -> i32 {
    let k = k as usize;
    let mut heap: BinaryHeap<Reverse<i32>> = BinaryHeap::new();
    for n in nums {
        heap.push(Reverse(n));
        if heap.len() > k {
            heap.pop();
        }
    }
    heap.peek().unwrap().0
}
```

#### Go

`IntMinHeap` via `Less(i, j) bool { return h[i] < h[j] }`. Verbose `Push`/`Pop` interface, but the algorithm body stays clean.

```go
import "container/heap"

type IntMinHeap []int
func (h IntMinHeap) Len() int            { return len(h) }
func (h IntMinHeap) Less(i, j int) bool  { return h[i] < h[j] }
func (h IntMinHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *IntMinHeap) Push(x interface{}) { *h = append(*h, x.(int)) }
func (h *IntMinHeap) Pop() interface{}   { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }

func findKthLargest(nums []int, k int) int {
    h := &IntMinHeap{}
    for _, n := range nums {
        heap.Push(h, n)
        if h.Len() > k {
            heap.Pop(h)
        }
    }
    return (*h)[0]
}
```

#### C++

`std::priority_queue<int, std::vector<int>, std::greater<int>>` — the min-heap incantation. Same push-then-prune pattern as everywhere else.

```cpp
#include <queue>
#include <vector>

int findKthLargest(std::vector<int>& nums, int k) {
    std::priority_queue<int, std::vector<int>, std::greater<int>> heap;
    for (int n : nums) {
        heap.push(n);
        if ((int)heap.size() > k) heap.pop();
    }
    return heap.top();
}
```


### 71. Task Scheduler

#### Problem
Given a list of tasks and a cooldown period `n`, find the minimum number of CPU intervals needed to execute all tasks, where the same task type must be at least `n` intervals apart (idle slots are allowed).

#### Examples

```text
Input: tasks = ["A","A","A","B","B","B"], n = 2
Output: 8
Explanation: A B idle A B idle A B, so two idles are forced.

Input: tasks = ["A","C","A","B","D","B"], n = 1
Output: 6

Input: tasks = ["A","A","A","A","A","A","B","C","D","E","F","G"],
n = 2
Output: 16

Constraints:
- 1 <= tasks.length <= 10^4
- tasks[i] is an uppercase English letter
- 0 <= n <= 100
```

#### Recognition
**Signals.** "Minimum number of intervals" with a rule that the same task must wait `n` ticks before repeating. The tell is that a task which is illegal now becomes legal later, so the set of candidates changes as the clock advances rather than being fixed up front. Idle slots being allowed confirms that the schedule is built tick by tick, not by permuting a list. **Therefore.** Greedy simulation: each tick run the available task with the most work left, then park it in a FIFO cooldown queue keyed by its ready time. The exchange argument is that deferring the most frequent task only pushes the same congestion later, so running it first is never worse. **Not one sort of the counts followed by a cycle through them**, because a fixed order goes stale the moment a task enters cooldown and a rarer task becomes the only legal move. Over `t` ticks with `k` distinct task types, at most 26 of them: **O(t log k)** time, **O(k)** space.

#### Explanation
**Brute force.** Simulate each tick, rescanning every task type to pick the best legal one.

```python
def leastInterval(tasks, n):
    count = {}
    for t in tasks:
        count[t] = count.get(t, 0) + 1
    last, time = {}, 0
    while any(count.values()):
        time += 1
        ready = [t for t, c in count.items() if c > 0
                 and time - last.get(t, -n) > n]
        if ready:
            best = max(ready, key=lambda t: count[t])
            count[best] -= 1
            last[best] = time
    return time
```

`O(t * k)` time, `O(k)` space.

**Wasteful because.** Every tick recomputes readiness for all `k` task types and rescans for the maximum count, when only one task changed state since the previous tick.

**Optimal.** Split the tasks into two structures that each answer one question in better than linear time. A max-heap of remaining counts holds the tasks that are legal right now, so the best choice is the root. A FIFO queue holds the ones cooling down as `(remaining, ready_at)` pairs. Because every task waits exactly `n + 1` ticks, tasks leave cooldown in the order they entered it, so the queue is already sorted by ready time and only its front ever needs checking. Each tick is then one pop, one push, and one front comparison. A closed form, `max(len(tasks), (maxCount - 1) * (n + 1) + numMaxTasks)`, answers this in `O(1)`, but it is harder to justify under questioning and it stops working the moment cooldowns differ per task.

**Edge cases.** With `n = 0` a task re-enters the heap on the same tick it left, so the answer is just `len(tasks)`. All-distinct tasks never idle. One dominant task type is the idle-heavy case, where the answer is set by the gaps around it rather than by the total count.

#### Python

Heap of negated counts + `deque` for the cooldown queue — `(remaining, available_at)` makes the FIFO order match cooldown expiry order. `cnt = 1 + heappop(heap)` increments toward zero since values are negated.

```python
import heapq
from collections import deque

def leastInterval(tasks, n):
    count = {}
    for t in tasks:
        count[t] = count.get(t, 0) + 1
    heap = [-c for c in count.values()]
    heapq.heapify(heap)
    queue = deque()  # (remaining_count, available_at_time)
    time = 0
    while heap or queue:
        time += 1
        if heap:
            cnt = 1 + heapq.heappop(heap)
            if cnt:
                queue.append((cnt, time + n))
        if queue and queue[0][1] == time:
            heapq.heappush(heap, queue.popleft()[0])
    return time
```

#### Java

`Comparator.reverseOrder()` gives the max-heap that always pops the most frequent task; an `ArrayDeque` is the cooldown FIFO (`offer`/`poll`), preferred over the legacy `Queue` impls. Counts live in a fixed `int[26]` since task labels are uppercase letters.

```java
import java.util.*;

class Solution {
    public int leastInterval(char[] tasks, int n) {
        int[] count = new int[26];
        for (char t : tasks) count[t - 'A']++;
        PriorityQueue<Integer> heap = new PriorityQueue<>(Comparator.reverseOrder());
        for (int c : count) if (c > 0) heap.offer(c);
        Queue<int[]> queue = new ArrayDeque<>(); // {remaining, availableAt}
        int time = 0;
        while (!heap.isEmpty() || !queue.isEmpty()) {
            time++;
            if (!heap.isEmpty()) {
                int cnt = heap.poll() - 1;
                if (cnt > 0) queue.offer(new int[]{cnt, time + n});
            }
            if (!queue.isEmpty() && queue.peek()[1] == time) {
                heap.offer(queue.poll()[0]);
            }
        }
        return time;
    }
}
```

#### Rust

`BinaryHeap<i32>` is max-heap so positive counts work directly — no negation tricks. `count.into_values().collect()` constructs the heap in one shot. `VecDeque` for the cooldown queue.

```rust
use std::collections::{BinaryHeap, VecDeque, HashMap};

fn least_interval(tasks: Vec<char>, n: i32) -> i32 {
    let mut count: HashMap<char, i32> = HashMap::new();
    for t in tasks { *count.entry(t).or_default() += 1; }
    let mut heap: BinaryHeap<i32> = count.into_values().collect();
    let mut queue: VecDeque<(i32, i32)> = VecDeque::new();
    let mut time = 0i32;
    while !heap.is_empty() || !queue.is_empty() {
        time += 1;
        if let Some(cnt) = heap.pop() {
            if cnt - 1 > 0 { queue.push_back((cnt - 1, time + n)); }
        }
        if let Some(&(c, avail)) = queue.front() {
            if avail == time { queue.pop_front(); heap.push(c); }
        }
    }
    time
}
```

#### Go

Custom `MaxIntHeap` via flipped `Less`. Anonymous struct for the queue entries keeps the type local. Slice-as-queue with `queue[1:]` for the pop.

```go
import (
    "container/heap"
)

type MaxIntHeap []int
func (h MaxIntHeap) Len() int            { return len(h) }
func (h MaxIntHeap) Less(i, j int) bool  { return h[i] > h[j] }
func (h MaxIntHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *MaxIntHeap) Push(x interface{}) { *h = append(*h, x.(int)) }
func (h *MaxIntHeap) Pop() interface{}   { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }

func leastInterval(tasks []byte, n int) int {
    count := make(map[byte]int)
    for _, t := range tasks { count[t]++ }
    h := &MaxIntHeap{}
    for _, c := range count { heap.Push(h, c) }
    heap.Init(h)
    type entry struct{ cnt, avail int }
    var queue []entry
    time := 0
    for h.Len() > 0 || len(queue) > 0 {
        time++
        if h.Len() > 0 {
            cnt := heap.Pop(h).(int) - 1
            if cnt > 0 { queue = append(queue, entry{cnt, time + n}) }
        }
        if len(queue) > 0 && queue[0].avail == time {
            heap.Push(h, queue[0].cnt)
            queue = queue[1:]
        }
    }
    return time
}
```

#### C++

`std::priority_queue<int>` is max-heap by default — cleanest of the four. Structured binding `auto& [_, c]` for the count map iteration.

```cpp
#include <vector>
#include <queue>
#include <unordered_map>

int leastInterval(std::vector<char>& tasks, int n) {
    std::unordered_map<char,int> count;
    for (char t : tasks) count[t]++;
    std::priority_queue<int> heap;
    for (auto& [_, c] : count) heap.push(c);
    std::queue<std::pair<int,int>> q; // (remaining, available_at)
    int time = 0;
    while (!heap.empty() || !q.empty()) {
        ++time;
        if (!heap.empty()) {
            int cnt = heap.top() - 1; heap.pop();
            if (cnt > 0) q.push({cnt, time + n});
        }
        if (!q.empty() && q.front().second == time) {
            heap.push(q.front().first); q.pop();
        }
    }
    return time;
}
```


### 72. Design Twitter

#### Problem
Design a simplified Twitter supporting `postTweet`, `getNewsFeed` (the 10 most recent tweets from the user and their followees), `follow`, and `unfollow`.

#### Examples

```text
Input: ["Twitter","postTweet","getNewsFeed","follow",
"postTweet","getNewsFeed","unfollow","getNewsFeed"],
[[],[1,5],[1],[1,2],[2,6],[1],[1,2],[1]]
Output: [null,null,[5],null,null,[6,5],null,[5]]

Input: ["Twitter","postTweet","postTweet","getNewsFeed"],
[[],[1,1],[1,2],[1]]
Output: [null,null,null,[2,1]]

Input: ["Twitter","getNewsFeed","unfollow","follow",
"getNewsFeed"],
[[],[9],[9,4],[9,9],[9]]
Output: [null,[],null,null,[]]

Constraints:
- 1 <= userId, tweetId <= 10^4
- up to 3 * 10^4 calls in total
- the feed returns at most 10 tweets, newest first
```

#### Recognition
**Signals.** "The 10 most recent tweets from the user and their followees" fixes three things at once: the answer is capped at 10 however long the history is, each user's own tweets arrive in time order and stay that way if you only append, and the feed is a merge across a small set of those already-ordered lists. A constant `k` taken from `u` sorted sequences is the k-way merge signature. **Therefore.** A global counter stamps every tweet so recency is an integer comparison, each user keeps an append-only list, and `getNewsFeed` seeds a heap with the newest tweet from each followee plus the user, pops 10 times, and after each pop pushes the next tweet from whichever list that pop came from. Follow and unfollow are set operations. **Not concatenating every followee's tweets and sorting**, which is `O(T log T)` in the total number of tweets posted, repeated on every single read, to produce 10 of them. **Not fanning out on write** into a materialised per-user feed, which makes `postTweet` cost `O(followers)` and `follow` need a backfill; that trade only wins when reads hugely outnumber writes. **O(k log u)** time, **O(T)** space.

#### Explanation
**Brute force.** One global tweet log, filtered and sorted on every read.

```python
class Twitter:
    def __init__(self):
        self.tweets = []
        self.following = {}
    def postTweet(self, userId, tweetId):
        self.tweets.append((len(self.tweets), userId, tweetId))
    def getNewsFeed(self, userId):
        ok = self.following.get(userId, set()) | {userId}
        feed = [t for t in self.tweets if t[1] in ok]
        feed.sort(reverse=True)
        return [t[2] for t in feed[:10]]
    def follow(self, followerId, followeeId):
        self.following.setdefault(followerId, set()).add(followeeId)
    def unfollow(self, followerId, followeeId):
        s = self.following.setdefault(followerId, set())
        s.discard(followeeId)
```

`O(T log T)` per feed, `O(T)` space.

**Wasteful because.** Every `getNewsFeed` walks the whole history, most of it posted by users this one does not follow, then sorts a list that was already built in posting order to take 10 items off the front. The sort is redundant twice over.

**Optimal.** Store tweets per user, appended, so each list is already sorted by recency with the newest at the tail. A feed is then the top 10 of a merge over at most `u + 1` sorted lists. Seed a heap with one entry per list, the newest tweet plus a cursor to the one before it, then pop 10 times, pushing that list's next-oldest entry after each pop. The heap never holds more than `u + 1` items, and each pop is the globally newest remaining candidate because every list's own newest is present. That is `O(u log u)` to seed and `O(k log u)` to drain, with no dependence at all on how many tweets exist. The global counter, decremented on each post so Python's min-heap orders newest first, is what makes cross-user recency a single integer compare.

**Edge cases.** A user with no tweets contributes nothing and must be skipped rather than indexed. Ids are created implicitly, so a feed for someone who never posted is `[]`. Following yourself must not duplicate your tweets, which the union with `{userId}` handles. Unfollowing a non-followee is a no-op, so `discard`, not `remove`.

#### Python

Negative `count` makes the min-heap behave like a max-heap on recency (smaller count = more recent). Tuple `(cnt, tid, u, idx-1)` carries everything needed to enqueue the next tweet from the same user when this one is consumed.

```python
import heapq
from collections import defaultdict

class Twitter:
    def __init__(self):
        self.count = 0
        self.tweets = defaultdict(list)
        self.following = defaultdict(set)

    def postTweet(self, userId, tweetId):
        self.tweets[userId].append((self.count, tweetId))
        self.count -= 1

    def getNewsFeed(self, userId):
        heap = []
        users = self.following[userId] | {userId}
        for u in users:
            tw = self.tweets[u]
            if tw:
                idx = len(tw) - 1
                cnt, tid = tw[idx]
                heapq.heappush(heap, (cnt, tid, u, idx - 1))
        res = []
        while heap and len(res) < 10:
            cnt, tid, u, idx = heapq.heappop(heap)
            res.append(tid)
            if idx >= 0:
                c, t = self.tweets[u][idx]
                heapq.heappush(heap, (c, t, u, idx - 1))
        return res

    def follow(self, followerId, followeeId):
        self.following[followerId].add(followeeId)

    def unfollow(self, followerId, followeeId):
        self.following[followerId].discard(followeeId)
```

#### Java

A monotonic `time++` counter plus a max-heap comparator (`b[0] - a[0]`) surfaces the newest tweet first without negating anything. Each heap entry is an `int[]{time, tweetId, userId, nextIndex}`, so consuming one tweet re-seeds the next from the same user — a lazy k-way merge capped at 10.

```java
import java.util.*;

class Twitter {
    private int time = 0;
    private final Map<Integer, List<int[]>> tweets = new HashMap<>();      // {time, tweetId}
    private final Map<Integer, Set<Integer>> following = new HashMap<>();

    public Twitter() {}

    public void postTweet(int userId, int tweetId) {
        tweets.computeIfAbsent(userId, k -> new ArrayList<>()).add(new int[]{time++, tweetId});
    }

    public List<Integer> getNewsFeed(int userId) {
        // {time, tweetId, userId, nextIndex}
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> b[0] - a[0]);
        Set<Integer> users = new HashSet<>(following.getOrDefault(userId, Set.of()));
        users.add(userId);
        for (int u : users) {
            List<int[]> tw = tweets.get(u);
            if (tw != null && !tw.isEmpty()) {
                int idx = tw.size() - 1;
                heap.offer(new int[]{tw.get(idx)[0], tw.get(idx)[1], u, idx - 1});
            }
        }
        List<Integer> res = new ArrayList<>();
        while (!heap.isEmpty() && res.size() < 10) {
            int[] e = heap.poll();
            res.add(e[1]);
            if (e[3] >= 0) {
                int[] t = tweets.get(e[2]).get(e[3]);
                heap.offer(new int[]{t[0], t[1], e[2], e[3] - 1});
            }
        }
        return res;
    }

    public void follow(int followerId, int followeeId) {
        following.computeIfAbsent(followerId, k -> new HashSet<>()).add(followeeId);
    }

    public void unfollow(int followerId, int followeeId) {
        Set<Integer> s = following.get(followerId);
        if (s != null) s.remove(followeeId);
    }
}
```

#### Rust

Negate timestamps for max-heap-via-min-heap behavior — `BinaryHeap` is max but we want most-recent-first which is most-negative. `users.insert(user_id)` includes the user's own tweets in the feed.

```rust
use std::collections::{HashMap, HashSet, BinaryHeap};
use std::cmp::Reverse;

#[derive(Default)]
struct Twitter {
    count: i64,
    tweets: HashMap<i32, Vec<(i64, i32)>>,
    following: HashMap<i32, HashSet<i32>>,
}

impl Twitter {
    fn new() -> Self { Self::default() }

    fn post_tweet(&mut self, user_id: i32, tweet_id: i32) {
        self.count -= 1;
        self.tweets.entry(user_id).or_default().push((self.count, tweet_id));
    }

    fn get_news_feed(&self, user_id: i32) -> Vec<i32> {
        // (timestamp, tweet_id, user_id, next_index)
        let mut heap: BinaryHeap<(i64, i32, i32, usize)> = BinaryHeap::new();
        let mut users: HashSet<i32> = self.following.get(&user_id).cloned().unwrap_or_default();
        users.insert(user_id);
        for u in &users {
            if let Some(tw) = self.tweets.get(u) {
                if !tw.is_empty() {
                    let idx = tw.len() - 1;
                    heap.push((-(tw[idx].0), tw[idx].1, *u, idx));
                }
            }
        }
        let mut res = Vec::new();
        while let Some((ts, tid, u, idx)) = heap.pop() {
            if res.len() == 10 { break; }
            res.push(tid);
            if idx > 0 {
                let tw = &self.tweets[&u];
                heap.push((-(tw[idx-1].0), tw[idx-1].1, u, idx-1));
            }
        }
        res
    }

    fn follow(&mut self, follower_id: i32, followee_id: i32) {
        self.following.entry(follower_id).or_default().insert(followee_id);
    }

    fn unfollow(&mut self, follower_id: i32, followee_id: i32) {
        if let Some(s) = self.following.get_mut(&follower_id) { s.remove(&followee_id); }
    }
}
```

#### Go

Custom heap with `Less` flipped (`h[i].ts > h[j].ts`) so most recent is at the top — no negation needed. `entry` struct carries the four-tuple.

```go
import (
    "container/heap"
)

type entry struct{ ts, tid, uid, idx int }
type feedHeap []entry
func (h feedHeap) Len() int            { return len(h) }
func (h feedHeap) Less(i, j int) bool  { return h[i].ts > h[j].ts }
func (h feedHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *feedHeap) Push(x interface{}) { *h = append(*h, x.(entry)) }
func (h *feedHeap) Pop() interface{}   { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }

type Twitter struct {
    count     int
    tweets    map[int][]entry
    following map[int]map[int]bool
}

func NewTwitter() *Twitter {
    return &Twitter{tweets: make(map[int][]entry), following: make(map[int]map[int]bool)}
}

func (t *Twitter) PostTweet(userId, tweetId int) {
    t.tweets[userId] = append(t.tweets[userId], entry{t.count, tweetId, userId, 0})
    t.count--
}

func (t *Twitter) GetNewsFeed(userId int) []int {
    h := &feedHeap{}
    users := map[int]bool{userId: true}
    for u := range t.following[userId] { users[u] = true }
    for u := range users {
        tw := t.tweets[u]
        if len(tw) > 0 {
            idx := len(tw) - 1
            heap.Push(h, entry{tw[idx].ts, tw[idx].tid, u, idx})
        }
    }
    var res []int
    for h.Len() > 0 && len(res) < 10 {
        e := heap.Pop(h).(entry)
        res = append(res, e.tid)
        if e.idx > 0 {
            tw := t.tweets[e.uid]
            heap.Push(h, entry{tw[e.idx-1].ts, tw[e.idx-1].tid, e.uid, e.idx - 1})
        }
    }
    return res
}

func (t *Twitter) Follow(followerId, followeeId int) {
    if t.following[followerId] == nil { t.following[followerId] = make(map[int]bool) }
    t.following[followerId][followeeId] = true
}

func (t *Twitter) Unfollow(followerId, followeeId int) {
    delete(t.following[followerId], followeeId)
}
```

#### C++

`std::tuple<int,int,int,int>` and structured binding `auto [ts, tid, u, idx]`. The lambda `push` deduplicates seeding logic for self + followed users.

```cpp
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <queue>

class Twitter {
    int count = 0;
    std::unordered_map<int, std::vector<std::pair<int,int>>> tweets;
    std::unordered_map<int, std::unordered_set<int>> following;
public:
    void postTweet(int userId, int tweetId) {
        tweets[userId].push_back({--count, tweetId});
    }
    std::vector<int> getNewsFeed(int userId) {
        using T4 = std::tuple<int,int,int,int>;
        std::priority_queue<T4> heap;
        auto push = [&](int u) {
            auto& tw = tweets[u];
            if (!tw.empty()) {
                int idx = tw.size()-1;
                heap.push({-tw[idx].first, tw[idx].second, u, idx});
            }
        };
        push(userId);
        for (int u : following[userId]) push(u);
        std::vector<int> res;
        while (!heap.empty() && res.size() < 10) {
            auto [ts, tid, u, idx] = heap.top(); heap.pop();
            res.push_back(tid);
            if (idx > 0) {
                auto& tw = tweets[u];
                heap.push({-tw[idx-1].first, tw[idx-1].second, u, idx-1});
            }
        }
        return res;
    }
    void follow(int f, int e)   { following[f].insert(e); }
    void unfollow(int f, int e) { following[f].erase(e); }
};
```


### 73. Find Median from Data Stream

#### Problem
Design a data structure that supports `addNum(int num)` and `findMedian()`, returning the median of all numbers added so far, in a streaming context.

#### Examples

```text
Input: ["MedianFinder","addNum","addNum","findMedian",
"addNum","findMedian"], [[],[1],[2],[],[3],[]]
Output: [null,null,null,1.5,null,2.0]
Explanation: after 1 and 2 the median is (1 + 2) / 2.

Input: ["MedianFinder","addNum","findMedian"], [[],[5],[]]
Output: [null,null,5.0]

Input: ["MedianFinder","addNum","addNum","addNum",
"findMedian"], [[],[-1],[-2],[-3],[]]
Output: [null,null,null,null,-2.0]

Constraints:
- -10^5 <= num <= 10^5
- findMedian runs only after at least one addNum
- up to 5 * 10^4 calls to addNum and findMedian
```

#### Recognition
**Signals.** "Median" is the giveaway, because it names a value at the *middle* of the order rather than at an end, and the numbers arrive in a stream with queries interleaved between insertions. So you need a structure that keeps the boundary between the lower and upper halves cheap to reach and cheap to maintain. **Therefore.** Two heaps facing each other: a max-heap for the lower half and a min-heap for the upper half, with sizes kept within one of each other. The two roots are exactly the elements adjacent to the middle, so the median is one root or the mean of both. **Not a single heap**, which exposes only its extreme; getting to the middle would mean popping half the elements and pushing them back on every query. **Not a sorted array with binary-search insertion**, where the search is `O(log n)` but the shift that makes room is `O(n)`. Each insert is one push and at most two moves. **O(log n)** time, **O(n)** space.

#### Explanation
**Brute force.** Append every number, sort on each query.

```python
class MedianFinder:
    def __init__(self):
        self.vals = []

    def addNum(self, num):
        self.vals.append(num)

    def findMedian(self):
        self.vals.sort()
        n = len(self.vals)
        if n % 2:
            return float(self.vals[n // 2])
        mid = n // 2
        return (self.vals[mid - 1] + self.vals[mid]) / 2.0
```

`O(n log n)` per query, `O(n)` space.

**Wasteful because.** Each query re-establishes a total order that was already correct at the previous query except for the handful of values appended since, and then reads one or two of the `n` positions it just computed.

**Optimal.** You never need the full order, only the split point. Keep the smaller half in a max-heap and the larger half in a min-heap, so the two roots are the values on either side of the middle. Inserting means pushing into one side, then repairing two invariants: if the lower root now exceeds the upper root the sides overlap, so move that element across; if the sizes differ by more than one, move a root from the bigger side to the smaller. Both repairs are single pushes and pops, so `addNum` is `O(log n)` and `findMedian` is an `O(1)` read. Python's `heapq` has no max-heap, so the lower half stores negated values and negates again on the way out.

**Edge cases.** After the first `addNum` the upper heap is empty, which the size rule handles by leaving the value in the lower heap. An even total returns a float average, so return `float(...)` in the odd case too rather than an `int`. Duplicates need no special handling; they simply land on either side of the split.

#### Python

Two heaps with the invariant `len(small) >= len(large)` — when sizes equal, median is the average of tops; when odd total, median is `small`'s top. Three rebalance steps cover all imbalance directions.

```python
import heapq

class MedianFinder:
    def __init__(self):
        self.small = []  # max-heap (negated)
        self.large = []  # min-heap

    def addNum(self, num):
        heapq.heappush(self.small, -num)
        if self.small and self.large and -self.small[0] > self.large[0]:
            heapq.heappush(self.large, -heapq.heappop(self.small))
        if len(self.small) > len(self.large) + 1:
            heapq.heappush(self.large, -heapq.heappop(self.small))
        if len(self.large) > len(self.small):
            heapq.heappush(self.small, -heapq.heappop(self.large))

    def findMedian(self):
        if len(self.small) > len(self.large):
            return float(-self.small[0])
        return (-self.small[0] + self.large[0]) / 2.0
```

#### Java

Two `PriorityQueue`s: `small` with `Comparator.reverseOrder()` for the lower-half max-heap, `large` as the default min-heap for the upper half. The comparator lives in the constructor, so the rebalance body reads plainly — no `Reverse` wrapper or value negation.

```java
import java.util.*;

class MedianFinder {
    private final PriorityQueue<Integer> small; // max-heap (lower half)
    private final PriorityQueue<Integer> large; // min-heap (upper half)

    public MedianFinder() {
        small = new PriorityQueue<>(Comparator.reverseOrder());
        large = new PriorityQueue<>();
    }

    public void addNum(int num) {
        small.offer(num);
        if (!small.isEmpty() && !large.isEmpty() && small.peek() > large.peek()) {
            large.offer(small.poll());
        }
        if (small.size() > large.size() + 1) {
            large.offer(small.poll());
        } else if (large.size() > small.size()) {
            small.offer(large.poll());
        }
    }

    public double findMedian() {
        if (small.size() > large.size()) return small.peek();
        return (small.peek() + large.peek()) / 2.0;
    }
}
```

#### Rust

`BinaryHeap<i32>` is max-heap (for `small`); `BinaryHeap<Reverse<i32>>` is min-heap (for `large`). Destructuring `let Reverse(v) = ...` extracts the inner value.

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

#[derive(Default)]
struct MedianFinder {
    small: BinaryHeap<i32>,          // max-heap (lower half)
    large: BinaryHeap<Reverse<i32>>, // min-heap (upper half)
}

impl MedianFinder {
    fn new() -> Self { Self::default() }

    fn add_num(&mut self, num: i32) {
        self.small.push(num);
        if let (Some(&s), Some(&Reverse(l))) = (self.small.peek(), self.large.peek()) {
            if s > l {
                let v = self.small.pop().unwrap();
                self.large.push(Reverse(v));
            }
        }
        if self.small.len() > self.large.len() + 1 {
            let v = self.small.pop().unwrap();
            self.large.push(Reverse(v));
        } else if self.large.len() > self.small.len() {
            let Reverse(v) = self.large.pop().unwrap();
            self.small.push(v);
        }
    }

    fn find_median(&self) -> f64 {
        if self.small.len() > self.large.len() {
            *self.small.peek().unwrap() as f64
        } else {
            let s = *self.small.peek().unwrap() as f64;
            let l = self.large.peek().unwrap().0 as f64;
            (s + l) / 2.0
        }
    }
}
```

#### Go

Two separate heap types — `maxH` and `minH` — because Go's heap interface ties comparator to the slice type. `(*mf.small)[0]` to read the top without popping.

```go
import "container/heap"

type maxH []int
func (h maxH) Len() int            { return len(h) }
func (h maxH) Less(i, j int) bool  { return h[i] > h[j] }
func (h maxH) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *maxH) Push(x interface{}) { *h = append(*h, x.(int)) }
func (h *maxH) Pop() interface{}   { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }

type minH []int
func (h minH) Len() int            { return len(h) }
func (h minH) Less(i, j int) bool  { return h[i] < h[j] }
func (h minH) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *minH) Push(x interface{}) { *h = append(*h, x.(int)) }
func (h *minH) Pop() interface{}   { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }

type MedianFinder struct {
    small *maxH
    large *minH
}

func NewMedianFinder() *MedianFinder {
    s, l := &maxH{}, &minH{}
    return &MedianFinder{s, l}
}

func (mf *MedianFinder) AddNum(num int) {
    heap.Push(mf.small, num)
    if mf.small.Len() > 0 && mf.large.Len() > 0 && (*mf.small)[0] > (*mf.large)[0] {
        heap.Push(mf.large, heap.Pop(mf.small))
    }
    if mf.small.Len() > mf.large.Len()+1 {
        heap.Push(mf.large, heap.Pop(mf.small))
    } else if mf.large.Len() > mf.small.Len() {
        heap.Push(mf.small, heap.Pop(mf.large))
    }
}

func (mf *MedianFinder) FindMedian() float64 {
    if mf.small.Len() > mf.large.Len() {
        return float64((*mf.small)[0])
    }
    return float64((*mf.small)[0]+(*mf.large)[0]) / 2.0
}
```

#### C++

Two `priority_queue`s — the default max-heap for `small`, the `greater<int>` variant for `large`. Cleaner than Rust's `Reverse` wrapper because the comparator lives in the template parameter.

```cpp
#include <queue>

class MedianFinder {
    std::priority_queue<int> small;                             // max-heap
    std::priority_queue<int,std::vector<int>,std::greater<int>> large; // min-heap
public:
    void addNum(int num) {
        small.push(num);
        if (!small.empty() && !large.empty() && small.top() > large.top()) {
            large.push(small.top()); small.pop();
        }
        if (small.size() > large.size() + 1) {
            large.push(small.top()); small.pop();
        } else if (large.size() > small.size()) {
            small.push(large.top()); large.pop();
        }
    }
    double findMedian() {
        if (small.size() > large.size()) return small.top();
        return (small.top() + large.top()) / 2.0;
    }
};
```


### 74. Subsets

#### Problem
Given an array of distinct integers, return all possible subsets (the power set). The solution set must not contain duplicate subsets; order does not matter.

#### Examples

```text
Compare: any-order-nested

Input: nums = [1,2,3]
Output: [[],[1],[2],[3],[1,2],[1,3],[2,3],[1,2,3]]
Explanation: 2^3 = 8 subsets, one per include/exclude choice.

Input: nums = [0]
Output: [[],[0]]

Input: nums = [-1,2]
Output: [[],[-1],[2],[-1,2]]

Constraints:
- 1 <= nums.length <= 10
- -10 <= nums[i] <= 10
- all elements of nums are distinct
```

#### Recognition
**Signals.** "Return **all** possible subsets" and a bound of `nums.length <= 10`. That bound is the whole tell: ten elements with an "all" objective means `2^10 = 1024` outputs are expected, so exponential is the target rather than a failure to optimise. "Distinct integers" removes the duplicate-handling that its sequel adds. **Therefore.** Enumerate one binary decision per element: at index `i` recurse having included `nums[i]`, then pop it and recurse having excluded it, emitting a copy of the running path at `i == n`. **Not memoisation or DP**, which is the reflex on seeing `2^n` but has nothing to cache here: every one of the `2^n` subsets is distinct and must be materialised, so the size of the output is itself the lower bound and no shared subproblem exists to collapse. Space is `O(n)` beyond the answer. **O(n * 2^n)** time, **O(n)** space.

#### Explanation
**Brute force.** Enumerate the `2^n` bitmasks and read off the set bits.

```python
def subsets(nums):
    res = []
    for mask in range(1 << len(nums)):
        subset = []
        for i in range(len(nums)):
            if mask & (1 << i):
                subset.append(nums[i])
        res.append(subset)
    return res
```

`O(n * 2^n)` time, `O(1)` space beyond the output.

**Wasteful because.** Each mask rebuilds its subset from an empty list, re-testing all `n` bits, even though masks that agree on their low bits share that whole prefix. Nothing is carried from one iteration to the next.

**Optimal.** Backtracking keeps the shared prefix alive on the call stack. The path from the root to the current node *is* the subset under construction, so descending is one `append` and returning is one `pop`, and only the leaf pays the `O(n)` copy. Be honest about what this buys: both versions are `O(n * 2^n)`, because the answer holds `n * 2^n` integers and nothing can beat printing it. The win is constant factors and generality. Backtracking is the version that extends: Subsets II skips equal siblings to dedupe, Combination Sum prunes a branch once its running total passes the target, and a bitmask loop has nowhere to put a prune. The bitmask is preferable when you want an iterative form with no recursion depth, or subsets addressable by index.

**Edge cases.** The empty subset is a real answer, produced by mask `0` or the all-exclude path, so do not filter it out. A one-element input yields exactly two subsets. Inputs are distinct, so no dedupe pass is needed, and at `n = 10` the recursion is only ten frames deep.

#### Python

`subset.append` / `bt` / `subset.pop` / `bt` — the include/exclude pattern. `subset[:]` copy at the leaf is mandatory because subset is mutated throughout.

```python
def subsets(nums):
    res = []
    def bt(i, subset):
        if i == len(nums):
            res.append(subset[:])
            return
        subset.append(nums[i])
        bt(i + 1, subset)
        subset.pop()
        bt(i + 1, subset)
    bt(0, [])
    return res
```

#### Java

`new ArrayList<>(subset)` snapshots the mutated list at each leaf — the required copy, since one `ArrayList` is threaded through the whole recursion. `subset.remove(subset.size() - 1)` is the pop that undoes the include branch before the exclude branch runs.

```java
import java.util.*;

class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> res = new ArrayList<>();
        bt(nums, 0, new ArrayList<>(), res);
        return res;
    }

    private void bt(int[] nums, int i, List<Integer> subset, List<List<Integer>> res) {
        if (i == nums.length) {
            res.add(new ArrayList<>(subset));
            return;
        }
        subset.add(nums[i]);
        bt(nums, i + 1, subset, res);
        subset.remove(subset.size() - 1);
        bt(nums, i + 1, subset, res);
    }
}
```

#### Rust

Same include/exclude pattern; `current.clone()` at the leaf. Inner `fn bt` with explicit threading of `nums`, `current`, and `res`.

```rust
fn subsets(nums: Vec<i32>) -> Vec<Vec<i32>> {
    let mut res = Vec::new();
    fn bt(nums: &[i32], i: usize, current: &mut Vec<i32>, res: &mut Vec<Vec<i32>>) {
        if i == nums.len() { res.push(current.clone()); return; }
        current.push(nums[i]);
        bt(nums, i + 1, current, res);
        current.pop();
        bt(nums, i + 1, current, res);
    }
    bt(&nums, 0, &mut Vec::new(), &mut res);
    res
}
```

#### Go

`append(current, nums[i])` returns a new slice — but Go's append may share the underlying array, so the explicit `copy` at the leaf is essential. Skip the pop because `current` isn't mutated.

```go
func subsets(nums []int) [][]int {
    var res [][]int
    var bt func(i int, current []int)
    bt = func(i int, current []int) {
        if i == len(nums) {
            tmp := make([]int, len(current))
            copy(tmp, current)
            res = append(res, tmp)
            return
        }
        bt(i+1, append(current, nums[i]))
        bt(i+1, current)
    }
    bt(0, []int{})
    return res
}
```

#### C++

`current.push_back` / `bt(i+1)` / `current.pop_back` — the same include/exclude shape. `res.push_back(current)` copies the vector at the leaf.

```cpp
#include <vector>

std::vector<std::vector<int>> subsets(std::vector<int>& nums) {
    std::vector<std::vector<int>> res;
    std::vector<int> current;
    std::function<void(int)> bt = [&](int i) {
        if (i == (int)nums.size()) { res.push_back(current); return; }
        current.push_back(nums[i]);
        bt(i + 1);
        current.pop_back();
        bt(i + 1);
    };
    bt(0);
    return res;
}
```


### 75. Combination Sum

#### Problem
Given an array of distinct positive integers and a target, find all unique combinations where the chosen numbers sum to the target. Each number may be used an unlimited number of times; order does not matter.

#### Examples

```text
Compare: any-order-nested

Input: candidates = [2,3,6,7], target = 7
Output: [[2,2,3],[7]]
Explanation: 2 + 2 + 3 == 7, and 7 is itself a candidate.

Input: candidates = [2,3,5], target = 8
Output: [[2,2,2,2],[2,3,3],[3,5]]

Input: candidates = [2], target = 1
Output: []

Constraints:
- 1 <= candidates.length <= 30
- 2 <= candidates[i] <= 40, all distinct
- 1 <= target <= 40
```

#### Recognition
**Signals.** "Return all unique combinations" is an enumeration objective, so the output itself is exponential and no polynomial algorithm exists; the `list of lists` return type is the second tell. "The same number may be chosen an unlimited number of times" plus `candidates.length <= 30` and `target <= 40` bound the search tree, whose depth cannot exceed `target / min(candidates)`. "Combinations", not permutations, means `[2,2,3]` and `[3,2,2]` are one answer, not two. **Therefore.** Index-based backtracking with two moves: take `candidates[i]` and recurse *staying at* `i`, which models unlimited reuse, or advance to `i + 1`. The index never moving backwards is what makes each multiset appear exactly once, so no dedup pass is needed. **Not the unbounded-knapsack DP**, which fills an `O(n · target)` table but only counts or minimises; listing the combinations means walking that table back along every path, which is the same exponential work with a table bolted on. Excluding the output, **O(2^(t/m))** time, **O(n + t/m)** space.

#### Explanation
**Brute force.** Try every candidate at every step, dedupe at the end.

```python
def combinationSum(candidates, target):
    found = set()
    def grow(curr, total):
        if total == target:
            found.add(tuple(sorted(curr)))
            return
        if total > target:
            return
        for c in candidates:
            curr.append(c)
            grow(curr, total + c)
            curr.pop()
    grow([], 0)
    return [list(t) for t in found]
```

`O(n^(t/m))` time, `O(t/m)` space plus the set.

**Wasteful because.** Every ordering of a winning multiset is its own root-to-leaf descent: `[2,2,3]`, `[2,3,2]` and `[3,2,2]` are three full paths that the closing `sorted` collapses into one answer. A k-element combination costs up to `k!` paths and all but one are discarded.

**Optimal.** Impose an order on the choices instead of deleting duplicates afterwards. Carry an index `i` and allow only "take `candidates[i]` again" or "skip to `i + 1` and never come back". Each combination then has exactly one construction, the one that emits its elements in candidate-array order, so the set and the sorting both vanish. Pruning on `total > target` kills a branch the moment it overshoots. Pre-sorting the candidates lets you `break` out of the loop rather than test each remaining one, which pays off when the array is long and the target is small.

**Edge cases.** A target below every candidate returns `[]`, not `None`. A candidate equal to the target is a valid one-element combination. Candidates are at least 2, so the "stay at `i`" branch always makes progress; a 0 in the array would recurse forever. Duplicate candidates are ruled out by the constraints, which is why no equal-sibling skip appears.

#### Python

Recurse with same `i` for the 'reuse' branch, `i+1` for the 'move on' branch. The two prunings (`total == target` for hit, `i >= len` or `total > target` for miss) cover all dead branches.

```python
def combinationSum(candidates, target):
    res = []
    def bt(i, curr, total):
        if total == target:
            res.append(curr[:])
            return
        if i >= len(candidates) or total > target:
            return
        curr.append(candidates[i])
        bt(i, curr, total + candidates[i])
        curr.pop()
        bt(i + 1, curr, total)
    bt(0, [], 0)
    return res
```

#### Java

Recurse with the same `i` for the reuse branch, `i + 1` to advance — the index never moving backward is what prevents duplicate multisets. A single shared `ArrayList` with add/remove around the recursive calls keeps allocation to just the `new ArrayList<>(curr)` copy at each hit.

```java
import java.util.*;

class Solution {
    public List<List<Integer>> combinationSum(int[] candidates, int target) {
        List<List<Integer>> res = new ArrayList<>();
        bt(candidates, 0, new ArrayList<>(), 0, target, res);
        return res;
    }

    private void bt(int[] candidates, int i, List<Integer> curr, int total, int target,
                    List<List<Integer>> res) {
        if (total == target) {
            res.add(new ArrayList<>(curr));
            return;
        }
        if (i >= candidates.length || total > target) return;
        curr.add(candidates[i]);
        bt(candidates, i, curr, total + candidates[i], target, res);
        curr.remove(curr.size() - 1);
        bt(candidates, i + 1, curr, total, target, res);
    }
}
```

#### Rust

Inner `fn bt` with five threaded parameters — verbose but explicit. Same dual-branch (reuse same index vs advance) as Python.

```rust
fn combination_sum(candidates: Vec<i32>, target: i32) -> Vec<Vec<i32>> {
    let mut res = Vec::new();
    fn bt(candidates: &[i32], i: usize, current: &mut Vec<i32>, total: i32, target: i32, res: &mut Vec<Vec<i32>>) {
        if total == target { res.push(current.clone()); return; }
        if i >= candidates.len() || total > target { return; }
        current.push(candidates[i]);
        bt(candidates, i, current, total + candidates[i], target, res);
        current.pop();
        bt(candidates, i + 1, current, total, target, res);
    }
    bt(&candidates, 0, &mut Vec::new(), 0, target, &mut res);
    res
}
```

#### Go

Closure `bt(i, total int, current []int)` — captures `res`, `candidates`, `target` from outer scope. `append(current, candidates[i])` creates a new slice for the recurse call.

```go
func combinationSum(candidates []int, target int) [][]int {
    var res [][]int
    var bt func(i, total int, current []int)
    bt = func(i, total int, current []int) {
        if total == target {
            tmp := make([]int, len(current))
            copy(tmp, current)
            res = append(res, tmp)
            return
        }
        if i >= len(candidates) || total > target {
            return
        }
        bt(i, total+candidates[i], append(current, candidates[i]))
        bt(i+1, total, current)
    }
    bt(0, 0, []int{})
    return res
}
```

#### C++

Lambda with `[&]` capture; `std::function<void(int,int)>` because recursive lambdas need a type. Same include-then-pop-then-advance shape.

```cpp
#include <vector>

std::vector<std::vector<int>> combinationSum(std::vector<int>& candidates, int target) {
    std::vector<std::vector<int>> res;
    std::vector<int> current;
    std::function<void(int, int)> bt = [&](int i, int total) {
        if (total == target) { res.push_back(current); return; }
        if (i >= (int)candidates.size() || total > target) return;
        current.push_back(candidates[i]);
        bt(i, total + candidates[i]);
        current.pop_back();
        bt(i + 1, total);
    };
    bt(0, 0);
    return res;
}
```


### 76. Permutations

#### Problem
Given an array of distinct integers, return all possible permutations in any order.

#### Examples

```text
Compare: any-order-nested

Input: nums = [1,2,3]
Output: [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]
Explanation: all 3! = 6 orderings, in any order.

Input: nums = [0,1]
Output: [[0,1],[1,0]]

Input: nums = [1]
Output: [[1]]

Constraints:
- 1 <= nums.length <= 6
- -10 <= nums[i] <= 10
- all integers in nums are unique
```

#### Recognition
**Signals.** "All possible permutations" and "in any order" is an enumeration objective: the output alone is `n!` lists of length `n`, so nothing can beat `O(n · n!)` and there is no point looking for a clever trick. `nums.length <= 6` confirms it, since `6! = 720` is a bound that only makes sense when the intended answer is factorial. "All integers are unique" removes the duplicate-branch problem before it starts. **Therefore.** Backtrack over *which unused element comes next*: at each level scan the array, skip whatever is already on the path, choose, recurse one level deeper, then unchoose. **Not the subsets include/exclude recursion**, which visits each index once and emits `2^n` sets whose elements keep their original relative order; permutations need the orderings of one fixed set, so the branching factor at depth `d` is `n - d` rather than 2, and no include/exclude tree can ever emit `[1,2,3]` and `[2,1,3]` as different answers. **O(n · n!)** time, **O(n)** space.

#### Explanation
**Brute force.** Build every length-`n` sequence of indices, keep the ones with no repeat.

```python
def permute(nums):
    n = len(nums)
    res = []
    def grow(picks):
        if len(picks) == n:
            if len(set(picks)) == n:
                res.append([nums[i] for i in picks])
            return
        for i in range(n):
            grow(picks + [i])
    grow([])
    return res
```

`O(n^n · n)` time, `O(n)` space.

**Wasteful because.** The repeat check only fires at depth `n`, so a path that picked index 0 twice at the first two levels is still expanded all the way to the bottom. At `n = 6` that is 46656 leaves for 720 answers: 98 percent of the tree is dead and every dead branch is walked to full depth.

**Optimal.** Reject a repeat at the moment it is made rather than at the leaf. Track which elements are already on the path and skip them when choosing, so the branching factor falls from `n` at the root to 1 at the bottom and the tree has exactly `n!` leaves, none of them dead. The shipped Python tests membership with `n not in perm`, a linear scan that adds an `O(n)` factor; a `used` boolean array or a set makes each test `O(1)`. Swapping `nums[start]` with `nums[i]` in place, as the Java, Rust, Go and C++ versions do, buys the same guarantee with no auxiliary structure at all, at the cost of mutating the caller's array. The copy at each leaf is unavoidable either way, because the path buffer is reused.

**Edge cases.** A one-element array returns `[[1]]`, a single permutation, not `[]`. Distinctness is guaranteed, so no equal-sibling skip is needed; with repeats you would sort first and skip a value equal to its predecessor at the same level. Negative values need no handling since nothing is summed or compared.

#### Python

Uses `if n not in perm` instead of a visited set — readable but O(n) per check, so the overall is O(n! · n²) on the perm checks. Acceptable for typical n ≤ 6.

```python
def permute(nums):
    res = []
    def bt(perm):
        if len(perm) == len(nums):
            res.append(perm[:])
            return
        for n in nums:
            if n not in perm:
                perm.append(n)
                bt(perm)
                perm.pop()
    bt([])
    return res
```

#### Java

The in-place swap needs a mutable `int[]`; `res.add(...)` at the leaf must copy via a stream or `Arrays.copyOf`-style boxing since `List<List<Integer>>` can't hold a raw `int[]`. Boxing each element into a fresh `ArrayList<Integer>` snapshot is the price for the collection return type.

```java
import java.util.*;

class Solution {
    public List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> res = new ArrayList<>();
        bt(nums, 0, res);
        return res;
    }

    private void bt(int[] nums, int start, List<List<Integer>> res) {
        if (start == nums.length) {
            List<Integer> perm = new ArrayList<>(nums.length);
            for (int n : nums) perm.add(n);
            res.add(perm);
            return;
        }
        for (int i = start; i < nums.length; i++) {
            swap(nums, start, i);
            bt(nums, start + 1, res);
            swap(nums, start, i);
        }
    }

    private void swap(int[] a, int i, int j) {
        int t = a[i]; a[i] = a[j]; a[j] = t;
    }
}
```

#### Rust

Swap-based approach: `nums.swap(start, i)` then recurse with `start + 1`, then swap back. O(1) per choice, no visited set, no allocation — strictly faster than Python's `in` check.

```rust
fn permute(nums: Vec<i32>) -> Vec<Vec<i32>> {
    let mut res = Vec::new();
    let mut nums = nums;
    fn bt(nums: &mut Vec<i32>, start: usize, res: &mut Vec<Vec<i32>>) {
        if start == nums.len() { res.push(nums.clone()); return; }
        for i in start..nums.len() {
            nums.swap(start, i);
            bt(nums, start + 1, res);
            nums.swap(start, i);
        }
    }
    bt(&mut nums, 0, &mut res);
    res
}
```

#### Go

Same swap-based approach with `nums[start], nums[i] = nums[i], nums[start]`. The leaf still requires `copy` because `nums` is the same slice being mutated.

```go
func permute(nums []int) [][]int {
    var res [][]int
    var bt func(start int)
    bt = func(start int) {
        if start == len(nums) {
            tmp := make([]int, len(nums))
            copy(tmp, nums)
            res = append(res, tmp)
            return
        }
        for i := start; i < len(nums); i++ {
            nums[start], nums[i] = nums[i], nums[start]
            bt(start + 1)
            nums[start], nums[i] = nums[i], nums[start]
        }
    }
    bt(0)
    return res
}
```

#### C++

`std::swap(nums[start], nums[i])` is the swap primitive. `res.push_back(nums)` at the leaf copies the current state of `nums` into the result.

```cpp
#include <vector>
#include <algorithm>

std::vector<std::vector<int>> permute(std::vector<int>& nums) {
    std::vector<std::vector<int>> res;
    std::function<void(int)> bt = [&](int start) {
        if (start == (int)nums.size()) { res.push_back(nums); return; }
        for (int i = start; i < (int)nums.size(); ++i) {
            std::swap(nums[start], nums[i]);
            bt(start + 1);
            std::swap(nums[start], nums[i]);
        }
    };
    bt(0);
    return res;
}
```


### 77. Subsets II

#### Problem
Given an integer array that may contain duplicates, return all possible unique subsets. The solution set must not contain duplicate subsets.

#### Examples

TODO

#### Recognition
**Backtracking with sort-and-skip-duplicate technique.** **O(n · 2ⁿ)** time, **O(n)** auxiliary stack space.

#### Explanation
The naive approach generates all `2ⁿ` subsets and deduplicates with a set — correct but wasteful. Sorting the array first groups duplicates together, enabling a simple rule: within the same recursion level (same `i`), skip `nums[j]` if `j > i` and `nums[j] == nums[j-1]`. This prevents choosing the same value twice at the same position in the decision tree without preventing the same value from being chosen at a deeper level (a different copy). The result set is built by appending `subset[:]` at the start of each call (recording every prefix, including the empty set), then branching on each remaining index. This is subtly different from the Combination Sum family — here we record on entry, not only at the leaf.

#### Python

Record on entry (`res.append(subset[:])` at the top) rather than only at leaves — this captures every prefix as a valid subset including the empty one. The `if j > i and nums[j] == nums[j-1]: continue` skips siblings with equal values.

```python
def subsetsWithDup(nums):
    nums.sort()
    res = []
    def bt(i, subset):
        res.append(subset[:])
        for j in range(i, len(nums)):
            if j > i and nums[j] == nums[j - 1]:
                continue
            subset.append(nums[j])
            bt(j + 1, subset)
            subset.pop()
    bt(0, [])
    return res
```

#### Java

`Arrays.sort` on the primitive `int[]` groups duplicates for the `j > i && nums[j] == nums[j-1]` skip. Record on entry by copying `current` into a fresh `ArrayList` before mutating.

```java
import java.util.*;

class Solution {
    public List<List<Integer>> subsetsWithDup(int[] nums) {
        Arrays.sort(nums);
        List<List<Integer>> res = new ArrayList<>();
        bt(nums, 0, new ArrayList<>(), res);
        return res;
    }

    private void bt(int[] nums, int i, List<Integer> current, List<List<Integer>> res) {
        res.add(new ArrayList<>(current));
        for (int j = i; j < nums.length; j++) {
            if (j > i && nums[j] == nums[j - 1]) continue;
            current.add(nums[j]);
            bt(nums, j + 1, current, res);
            current.remove(current.size() - 1);
        }
    }
}
```

#### Rust

`nums.sort()` in place — `Vec<i32>` has `sort` directly. The duplicate-skip is the same `j > i` boundary check that prevents same-value choice at the same recursion depth.

```rust
fn subsets_with_dup(mut nums: Vec<i32>) -> Vec<Vec<i32>> {
    nums.sort();
    let mut res = Vec::new();
    fn bt(nums: &[i32], i: usize, current: &mut Vec<i32>, res: &mut Vec<Vec<i32>>) {
        res.push(current.clone());
        for j in i..nums.len() {
            if j > i && nums[j] == nums[j - 1] { continue; }
            current.push(nums[j]);
            bt(nums, j + 1, current, res);
            current.pop();
        }
    }
    bt(&nums, 0, &mut Vec::new(), &mut res);
    res
}
```

#### Go

`sort.Ints` for the pre-sort. Append-pass on `current` works because we record an explicit copy at the start of each call before mutating.

```go
import "sort"

func subsetsWithDup(nums []int) [][]int {
    sort.Ints(nums)
    var res [][]int
    var bt func(i int, current []int)
    bt = func(i int, current []int) {
        tmp := make([]int, len(current))
        copy(tmp, current)
        res = append(res, tmp)
        for j := i; j < len(nums); j++ {
            if j > i && nums[j] == nums[j-1] {
                continue
            }
            bt(j+1, append(current, nums[j]))
        }
    }
    bt(0, []int{})
    return res
}
```

#### C++

`std::sort` in place; `res.push_back(current)` copies on entry. The duplicate-skip predicate is identical across all four languages — it's an algorithm constant, not a language feature.

```cpp
#include <vector>
#include <algorithm>

std::vector<std::vector<int>> subsetsWithDup(std::vector<int>& nums) {
    std::sort(nums.begin(), nums.end());
    std::vector<std::vector<int>> res;
    std::vector<int> current;
    std::function<void(int)> bt = [&](int i) {
        res.push_back(current);
        for (int j = i; j < (int)nums.size(); ++j) {
            if (j > i && nums[j] == nums[j - 1]) continue;
            current.push_back(nums[j]);
            bt(j + 1);
            current.pop_back();
        }
    };
    bt(0);
    return res;
}
```


### 78. Combination Sum II

#### Problem
Given a collection of candidates (may contain duplicates) and a target, find all unique combinations that sum to the target where each candidate may only be used once.

#### Examples

TODO

#### Recognition
**Backtracking with sort-and-skip-duplicate and early break.** **O(2ⁿ)** time, **O(n)** auxiliary stack space.

#### Explanation
Compared to Combination Sum (problem #75), two constraints tighten the search: each element used at most once (advance `j+1` rather than staying at `i`), and the input may have duplicates (must deduplicate results). Sorting enables both optimisations simultaneously: the duplicate-skip rule (`j > i and candidates[j] == candidates[j-1]`) prevents identical values from being chosen at the same level of the tree, and because candidates are sorted, once `total + candidates[j] > target` you can `break` the inner loop entirely — all subsequent candidates are at least as large. These two prunings together make this considerably faster in practice than the naive approach.

#### Python

Two prunings beyond the basic backtrack: same-level duplicate skip and the early `break` when `total + candidates[j] > target` exploits the sort order. Advancing `j+1` (not `j`) enforces the 'each element used at most once' rule.

```python
def combinationSum2(candidates, target):
    candidates.sort()
    res = []
    def bt(i, curr, total):
        if total == target:
            res.append(curr[:])
            return
        for j in range(i, len(candidates)):
            if j > i and candidates[j] == candidates[j - 1]:
                continue
            if total + candidates[j] > target:
                break
            curr.append(candidates[j])
            bt(j + 1, curr, total + candidates[j])
            curr.pop()
    bt(0, [], 0)
    return res
```

#### Java

`Arrays.sort` enables both the duplicate `continue` and the early `break` once `total + candidates[j] > target`. `current.remove(current.size() - 1)` is the pop; `ArrayList` gives O(1) removal from the tail.

```java
import java.util.*;

class Solution {
    public List<List<Integer>> combinationSum2(int[] candidates, int target) {
        Arrays.sort(candidates);
        List<List<Integer>> res = new ArrayList<>();
        bt(candidates, 0, 0, target, new ArrayList<>(), res);
        return res;
    }

    private void bt(int[] candidates, int i, int total, int target,
                    List<Integer> current, List<List<Integer>> res) {
        if (total == target) {
            res.add(new ArrayList<>(current));
            return;
        }
        for (int j = i; j < candidates.length; j++) {
            if (j > i && candidates[j] == candidates[j - 1]) continue;
            if (total + candidates[j] > target) break;
            current.add(candidates[j]);
            bt(candidates, j + 1, total + candidates[j], target, current, res);
            current.remove(current.size() - 1);
        }
    }
}
```

#### Rust

Same two-prune pattern; `break` works on Rust's `for` loop just like Python. The `sort()` is on the owned `Vec<i32>` so it's mutating in place.

```rust
fn combination_sum2(mut candidates: Vec<i32>, target: i32) -> Vec<Vec<i32>> {
    candidates.sort();
    let mut res = Vec::new();
    fn bt(candidates: &[i32], i: usize, current: &mut Vec<i32>, total: i32, target: i32, res: &mut Vec<Vec<i32>>) {
        if total == target { res.push(current.clone()); return; }
        for j in i..candidates.len() {
            if j > i && candidates[j] == candidates[j - 1] { continue; }
            if total + candidates[j] > target { break; }
            current.push(candidates[j]);
            bt(candidates, j + 1, current, total + candidates[j], target, res);
            current.pop();
        }
    }
    bt(&candidates, 0, &mut Vec::new(), 0, target, &mut res);
    res
}
```

#### Go

`sort.Ints(candidates)` mutates in place. `for j := i; ...` then `if ... { break }` to terminate early once sums exceed target.

```go
import "sort"

func combinationSum2(candidates []int, target int) [][]int {
    sort.Ints(candidates)
    var res [][]int
    var bt func(i, total int, current []int)
    bt = func(i, total int, current []int) {
        if total == target {
            tmp := make([]int, len(current))
            copy(tmp, current)
            res = append(res, tmp)
            return
        }
        for j := i; j < len(candidates); j++ {
            if j > i && candidates[j] == candidates[j-1] { continue }
            if total+candidates[j] > target { break }
            bt(j+1, total+candidates[j], append(current, candidates[j]))
        }
    }
    bt(0, 0, []int{})
    return res
}
```

#### C++

`std::sort` in place. Same two-prune pattern — the `break` from the for-loop is the early termination, the `continue` skips duplicates.

```cpp
#include <vector>
#include <algorithm>

std::vector<std::vector<int>> combinationSum2(std::vector<int>& candidates, int target) {
    std::sort(candidates.begin(), candidates.end());
    std::vector<std::vector<int>> res;
    std::vector<int> current;
    std::function<void(int, int)> bt = [&](int i, int total) {
        if (total == target) { res.push_back(current); return; }
        for (int j = i; j < (int)candidates.size(); ++j) {
            if (j > i && candidates[j] == candidates[j - 1]) continue;
            if (total + candidates[j] > target) break;
            current.push_back(candidates[j]);
            bt(j + 1, total + candidates[j]);
            current.pop_back();
        }
    };
    bt(0, 0);
    return res;
}
```


### 79. Word Search

#### Problem
Given an `m×n` grid of characters, determine if the word exists in the grid by moving to horizontally or vertically adjacent cells, without reusing the same cell in one path.

#### Examples

TODO

#### Recognition
**DFS backtracking with in-place visited marking.** **O(m · n · 4^L)** time where L is the word length.

#### Explanation
Start a DFS from every cell that matches `word[0]`. The DFS advances through `word` one character at a time; if the current cell doesn't match `word[i]`, return false immediately. Mark visited cells by temporarily overwriting them with a sentinel (`'#'`) to prevent revisiting within the current path — this avoids a separate `visited` set and restores the board on backtrack. When `i == len(word)` all characters have been matched successfully. The worst-case `O(m·n·4^L)` occurs on grids filled with the same character, but early mismatch pruning makes this fast on typical inputs. No global state is needed since the board itself serves as the visited structure.

#### Python

In-place visited marking via `board[r][c] = "#"` saves allocating a visited set. The `any(... for dr, dc in [...])` generator short-circuits as soon as one direction succeeds.

```python
def exist(board, word):
    rows, cols = len(board), len(board[0])
    def dfs(r, c, i):
        if i == len(word):
            return True
        if r < 0 or c < 0 or r >= rows or c >= cols or board[r][c] != word[i]:
            return False
        tmp, board[r][c] = board[r][c], "#"
        found = any(dfs(r + dr, c + dc, i + 1) for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)])
        board[r][c] = tmp
        return found
    return any(dfs(r, c, 0) for r in range(rows) for c in range(cols))
```

#### Java

`word.charAt(i)` compares against the `char[][]` board in place; temporarily overwriting with `'#'` doubles as the visited mark and restores on backtrack. The four-direction `||` chain short-circuits as soon as one path succeeds.

```java
class Solution {
    public boolean exist(char[][] board, String word) {
        int rows = board.length, cols = board[0].length;
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (dfs(board, word, r, c, 0)) return true;
        return false;
    }

    private boolean dfs(char[][] board, String word, int r, int c, int i) {
        if (i == word.length()) return true;
        if (r < 0 || c < 0 || r >= board.length || c >= board[0].length
                || board[r][c] != word.charAt(i)) return false;
        char tmp = board[r][c];
        board[r][c] = '#';
        boolean found = dfs(board, word, r + 1, c, i + 1)
                || dfs(board, word, r - 1, c, i + 1)
                || dfs(board, word, r, c + 1, i + 1)
                || dfs(board, word, r, c - 1, i + 1);
        board[r][c] = tmp;
        return found;
    }
}
```

#### Rust

Mutating `Vec<Vec<char>>` requires `&mut` threading through the recursion. `i32` for `r`/`c` to allow negative bounds without underflowing `usize`.

```rust
fn exist(mut board: Vec<Vec<char>>, word: &str) -> bool {
    let chars: Vec<char> = word.chars().collect();
    let rows = board.len();
    let cols = board[0].len();
    fn dfs(board: &mut Vec<Vec<char>>, chars: &[char], r: i32, c: i32, i: usize) -> bool {
        if i == chars.len() { return true; }
        let rows = board.len() as i32;
        let cols = board[0].len() as i32;
        if r < 0 || c < 0 || r >= rows || c >= cols { return false; }
        if board[r as usize][c as usize] != chars[i] { return false; }
        let tmp = board[r as usize][c as usize];
        board[r as usize][c as usize] = '#';
        let found = [(0,1),(0,-1),(1,0),(-1,0)].iter()
            .any(|&(dr,dc)| dfs(board, chars, r+dr, c+dc, i+1));
        board[r as usize][c as usize] = tmp;
        found
    }
    for r in 0..rows {
        for c in 0..cols {
            if dfs(&mut board, &chars, r as i32, c as i32, 0) { return true; }
        }
    }
    false
}
```

#### Go

Explicit four-direction `||` chain — short-circuit evaluation handles the early-exit. No `any` builtin so the chain is necessary.

```go
func exist(board [][]byte, word string) bool {
    rows, cols := len(board), len(board[0])
    var dfs func(r, c, i int) bool
    dfs = func(r, c, i int) bool {
        if i == len(word) { return true }
        if r < 0 || c < 0 || r >= rows || c >= cols || board[r][c] != word[i] { return false }
        tmp := board[r][c]
        board[r][c] = '#'
        found := dfs(r+1, c, i+1) || dfs(r-1, c, i+1) || dfs(r, c+1, i+1) || dfs(r, c-1, i+1)
        board[r][c] = tmp
        return found
    }
    for r := 0; r < rows; r++ {
        for c := 0; c < cols; c++ {
            if dfs(r, c, 0) { return true }
        }
    }
    return false
}
```

#### C++

Same four-direction `||` chain. `std::function<bool(int,int,int)>` for the recursive lambda — the type can't be inferred for self-referential lambdas.

```cpp
#include <vector>
#include <string>

bool exist(std::vector<std::vector<char>>& board, std::string word) {
    int rows = board.size(), cols = board[0].size();
    std::function<bool(int,int,int)> dfs = [&](int r, int c, int i) -> bool {
        if (i == (int)word.size()) return true;
        if (r < 0 || c < 0 || r >= rows || c >= cols || board[r][c] != word[i]) return false;
        char tmp = board[r][c];
        board[r][c] = '#';
        bool found = dfs(r+1,c,i+1) || dfs(r-1,c,i+1) || dfs(r,c+1,i+1) || dfs(r,c-1,i+1);
        board[r][c] = tmp;
        return found;
    };
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c)
            if (dfs(r, c, 0)) return true;
    return false;
}
```


### 80. Palindrome Partitioning

#### Problem
Given a string `s`, partition it so that every substring in the partition is a palindrome. Return all possible partitioning schemes.

#### Examples

TODO

#### Recognition
**Backtracking with inline palindrome check.** **O(n · 2ⁿ)** time, **O(n)** auxiliary stack space.

#### Explanation
At each index `i`, try every possible end index `j >= i` for the next partition piece. If `s[i..j]` is a palindrome, include it and recurse from `j+1`. When `i` reaches the end of the string, the current partition is complete and gets recorded. The inline two-pointer palindrome check is `O(n)` per call, so total time is `O(n · 2ⁿ)`. A DP precomputation (`isPalin[i][j]`) reduces each check to `O(1)` at the cost of `O(n²)` setup, beneficial when the string is long and palindrome checks are repeated frequently. For most interview inputs the inline check is simpler and fast enough.

#### Python

Inline `is_palindrome` closure captures `s` — no need to pass it. `s[i:j+1]` is the palindrome slice; `j+1` because the upper bound is exclusive.

```python
def partition(s):
    res = []
    def is_palindrome(l, r):
        while l < r:
            if s[l] != s[r]:
                return False
            l += 1
            r -= 1
        return True
    def bt(i, part):
        if i == len(s):
            res.append(part[:])
            return
        for j in range(i, len(s)):
            if is_palindrome(i, j):
                part.append(s[i:j + 1])
                bt(j + 1, part)
                part.pop()
    bt(0, [])
    return res
```

#### Java

`s.substring(i, j + 1)` gives the piece (end index exclusive, so `j + 1`). The inline two-pointer `isPalindrome` reads `s.charAt` directly — no allocation until a palindrome is actually recorded.

```java
import java.util.*;

class Solution {
    public List<List<String>> partition(String s) {
        List<List<String>> res = new ArrayList<>();
        bt(s, 0, new ArrayList<>(), res);
        return res;
    }

    private void bt(String s, int i, List<String> current, List<List<String>> res) {
        if (i == s.length()) {
            res.add(new ArrayList<>(current));
            return;
        }
        for (int j = i; j < s.length(); j++) {
            if (isPalindrome(s, i, j)) {
                current.add(s.substring(i, j + 1));
                bt(s, j + 1, current, res);
                current.remove(current.size() - 1);
            }
        }
    }

    private boolean isPalindrome(String s, int l, int r) {
        while (l < r) {
            if (s.charAt(l++) != s.charAt(r--)) return false;
        }
        return true;
    }
}
```

#### Rust

Pre-collect `chars: Vec<char>` once to index by position (Rust strings can't be indexed by byte for UTF-8 safety). `chars[i..=j].iter().collect()` rebuilds a `String` from the char slice — one allocation per palindrome found.

```rust
fn partition(s: &str) -> Vec<Vec<String>> {
    let chars: Vec<char> = s.chars().collect();
    let mut res = Vec::new();
    fn is_palindrome(chars: &[char], l: usize, r: usize) -> bool {
        let (mut l, mut r) = (l as i32, r as i32);
        while l < r {
            if chars[l as usize] != chars[r as usize] { return false; }
            l += 1; r -= 1;
        }
        true
    }
    fn bt(chars: &[char], i: usize, current: &mut Vec<String>, res: &mut Vec<Vec<String>>) {
        if i == chars.len() { res.push(current.clone()); return; }
        for j in i..chars.len() {
            if is_palindrome(chars, i, j) {
                current.push(chars[i..=j].iter().collect());
                bt(chars, j + 1, current, res);
                current.pop();
            }
        }
    }
    bt(&chars, 0, &mut Vec::new(), &mut res);
    res
}
```

#### Go

Byte indexing `s[l]` is fine because LeetCode inputs are ASCII. Substring `s[i:j+1]` is a view sharing the underlying string memory, no copy.

```go
func partition(s string) [][]string {
    var res [][]string
    isPalin := func(l, r int) bool {
        for l < r {
            if s[l] != s[r] { return false }
            l++; r--
        }
        return true
    }
    var bt func(i int, current []string)
    bt = func(i int, current []string) {
        if i == len(s) {
            tmp := make([]string, len(current))
            copy(tmp, current)
            res = append(res, tmp)
            return
        }
        for j := i; j < len(s); j++ {
            if isPalin(i, j) {
                bt(j+1, append(current, s[i:j+1]))
            }
        }
    }
    bt(0, []string{})
    return res
}
```

#### C++

`s.substr(i, j - i + 1)` for the substring — second arg is length, not end index. Inline `isPalin` lambda captures `s` by reference.

```cpp
#include <vector>
#include <string>

std::vector<std::vector<std::string>> partition(std::string s) {
    std::vector<std::vector<std::string>> res;
    std::vector<std::string> current;
    auto isPalin = [&](int l, int r) {
        while (l < r) { if (s[l++] != s[r--]) return false; }
        return true;
    };
    std::function<void(int)> bt = [&](int i) {
        if (i == (int)s.size()) { res.push_back(current); return; }
        for (int j = i; j < (int)s.size(); ++j) {
            if (isPalin(i, j)) {
                current.push_back(s.substr(i, j - i + 1));
                bt(j + 1);
                current.pop_back();
            }
        }
    };
    bt(0);
    return res;
}
```


### 81. Letter Combinations of a Phone Number

#### Problem
Given a string of digits `2-9`, return all possible letter combinations that the digits could represent on a phone keypad. Return an empty list for an empty input.

#### Examples

TODO

#### Recognition
**Backtracking over digit-to-letter mapping.** **O(4ⁿ · n)** time where n is the number of digits (4 accounts for `7` and `9` having 4 letters each).

#### Explanation
Each digit maps to 2-4 letters; the total combinations multiply out to at most `4ⁿ`. The backtracking walks digit by digit, branching once per letter for the current digit. Because strings are immutable in Python, concatenation (`curr + c`) creates a new string at each level — an alternative is to build a list and join at the leaf, but for short phone numbers the difference is negligible. The empty-digits guard is critical: without it the recursion would try to index into the phone map with an empty string and produce an incorrect single empty-string result instead of `[]`.

#### Python

Dict-of-digit-to-letters keeps the mapping declarative. Empty-digits guard returns `[]` instead of `[""]` — easy to miss.

```python
def letterCombinations(digits):
    if not digits:
        return []
    phone = {"2": "abc", "3": "def", "4": "ghi", "5": "jkl",
             "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz"}
    res = []
    def bt(i, curr):
        if i == len(digits):
            res.append(curr)
            return
        for c in phone[digits[i]]:
            bt(i + 1, curr + c)
    bt(0, "")
    return res
```

#### Java

A `String[]` indexed by digit value (slots 0/1 empty) beats a `HashMap` lookup. A shared `StringBuilder` accumulates with `append`/`deleteCharAt` and no per-call allocation; `sb.toString()` snapshots at the leaf. The `isEmpty` guard returns `[]`, not `[""]`.

```java
import java.util.*;

class Solution {
    public List<String> letterCombinations(String digits) {
        List<String> res = new ArrayList<>();
        if (digits.isEmpty()) return res;
        String[] phone = {"", "", "abc", "def", "ghi", "jkl",
                          "mno", "pqrs", "tuv", "wxyz"};
        bt(digits, 0, new StringBuilder(), phone, res);
        return res;
    }

    private void bt(String digits, int i, StringBuilder curr, String[] phone, List<String> res) {
        if (i == digits.length()) {
            res.add(curr.toString());
            return;
        }
        for (char c : phone[digits.charAt(i) - '0'].toCharArray()) {
            curr.append(c);
            bt(digits, i + 1, curr, phone, res);
            curr.deleteCharAt(curr.length() - 1);
        }
    }
}
```

#### Rust

Array of `&str` indexed by digit value (slots 0 and 1 are empty) — faster than a HashMap lookup. `current: &mut Vec<char>` accumulates without per-step allocation; `iter().collect()` at the leaf builds the String.

```rust
fn letter_combinations(digits: String) -> Vec<String> {
    if digits.is_empty() { return vec![]; }
    let phone: &[&str] = &["", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"];
    let mut res = Vec::new();
    fn bt(digits: &[u8], phone: &[&str], i: usize, current: &mut Vec<char>, res: &mut Vec<String>) {
        if i == digits.len() { res.push(current.iter().collect()); return; }
        let idx = (digits[i] - b'0') as usize;
        for c in phone[idx].chars() {
            current.push(c);
            bt(digits, phone, i + 1, current, res);
            current.pop();
        }
    }
    bt(digits.as_bytes(), phone, 0, &mut Vec::new(), &mut res);
    res
}
```

#### Go

`map[byte]string` keyed on the digit byte. `string(c)` to convert a rune to a one-character string for concatenation — Go has no implicit char-to-string coercion.

```go
func letterCombinations(digits string) []string {
    if len(digits) == 0 { return nil }
    phone := map[byte]string{
        '2': "abc", '3': "def", '4': "ghi", '5': "jkl",
        '6': "mno", '7': "pqrs", '8': "tuv", '9': "wxyz",
    }
    var res []string
    var bt func(i int, curr string)
    bt = func(i int, curr string) {
        if i == len(digits) { res = append(res, curr); return }
        for _, c := range phone[digits[i]] {
            bt(i+1, curr+string(c))
        }
    }
    bt(0, "")
    return res
}
```

#### C++

`unordered_map<char, string>` for the phone map. `current += c` and `current.pop_back()` mutate the string in place — no per-call allocation.

```cpp
#include <vector>
#include <string>
#include <unordered_map>

std::vector<std::string> letterCombinations(std::string digits) {
    if (digits.empty()) return {};
    std::unordered_map<char,std::string> phone = {
        {'2',"abc"},{'3',"def"},{'4',"ghi"},{'5',"jkl"},
        {'6',"mno"},{'7',"pqrs"},{'8',"tuv"},{'9',"wxyz"}
    };
    std::vector<std::string> res;
    std::string current;
    std::function<void(int)> bt = [&](int i) {
        if (i == (int)digits.size()) { res.push_back(current); return; }
        for (char c : phone[digits[i]]) {
            current += c;
            bt(i + 1);
            current.pop_back();
        }
    };
    bt(0);
    return res;
}
```


### 82. N-Queens

#### Problem
Place `n` queens on an `n×n` chessboard such that no two queens share a row, column, or diagonal. Return all distinct solutions as board layouts.

#### Examples

TODO

#### Recognition
**Backtracking with column and diagonal conflict sets.** **O(n!)** time, **O(n)** auxiliary space.

#### Explanation
The backtracking places one queen per row (since two queens can never share a row) and prunes columns and diagonals. Three sets track conflicts: `cols` for columns, and the two diagonals — all cells on the same `\` diagonal share the same `r - c` value, and all on the same `/` diagonal share `r + c`. Set membership gives `O(1)` conflict checking. For each row, iterate over columns; if the column or either diagonal is occupied, skip. Otherwise place the queen, recurse to the next row, then undo. When `r == n`, all `n` queens are placed without conflict and the board snapshot is recorded. This is more efficient than bit-mask approaches for clarity, though bitmask versions run faster in practice.

#### Python

Three Python sets — `cols`, `pos_diag` (r+c), `neg_diag` (r-c) — give O(1) conflict checks. Board snapshot via `["".join(row) for row in board]` at each solution.

```python
def solveNQueens(n):
    cols = set()
    pos_diag = set()  # r + c
    neg_diag = set()  # r - c
    res = []
    board = [["." ] * n for _ in range(n)]
    def bt(r):
        if r == n:
            res.append(["".join(row) for row in board])
            return
        for c in range(n):
            if c in cols or (r + c) in pos_diag or (r - c) in neg_diag:
                continue
            cols.add(c); pos_diag.add(r + c); neg_diag.add(r - c)
            board[r][c] = "Q"
            bt(r + 1)
            board[r][c] = "."
            cols.remove(c); pos_diag.remove(r + c); neg_diag.remove(r - c)
    bt(0)
    return res
```

#### Java

Boolean arrays beat `HashSet` for the O(1) conflict checks; the `r - c + n` offset shifts the negative diagonal into a non-negative index. Each solved board is snapshotted with `new String(row)` per row.

```java
import java.util.*;

class Solution {
    public List<List<String>> solveNQueens(int n) {
        List<List<String>> res = new ArrayList<>();
        char[][] board = new char[n][n];
        for (char[] row : board) Arrays.fill(row, '.');
        boolean[] cols = new boolean[n];
        boolean[] pos = new boolean[2 * n]; // r + c
        boolean[] neg = new boolean[2 * n]; // r - c + n
        bt(0, n, board, cols, pos, neg, res);
        return res;
    }

    private void bt(int r, int n, char[][] board,
                    boolean[] cols, boolean[] pos, boolean[] neg,
                    List<List<String>> res) {
        if (r == n) {
            List<String> snap = new ArrayList<>(n);
            for (char[] row : board) snap.add(new String(row));
            res.add(snap);
            return;
        }
        for (int c = 0; c < n; c++) {
            if (cols[c] || pos[r + c] || neg[r - c + n]) continue;
            cols[c] = pos[r + c] = neg[r - c + n] = true;
            board[r][c] = 'Q';
            bt(r + 1, n, board, cols, pos, neg, res);
            board[r][c] = '.';
            cols[c] = pos[r + c] = neg[r - c + n] = false;
        }
    }
}
```

#### Rust

Bool arrays instead of sets — `vec![false; n]` and `vec![false; 2 * n]` for the diagonals. The `(r + n) - c` offset shifts negative diagonal indices into a non-negative range.

```rust
fn solve_n_queens(n: usize) -> Vec<Vec<String>> {
    let mut res = Vec::new();
    let mut cols = vec![false; n];
    let mut pos_diag = vec![false; 2 * n];
    let mut neg_diag = vec![false; 2 * n];
    let mut board = vec![vec![b'.'; n]; n];
    fn bt(
        n: usize, r: usize,
        cols: &mut Vec<bool>, pos: &mut Vec<bool>, neg: &mut Vec<bool>,
        board: &mut Vec<Vec<u8>>, res: &mut Vec<Vec<String>>
    ) {
        if r == n {
            res.push(board.iter().map(|row| String::from_utf8(row.clone()).unwrap()).collect());
            return;
        }
        for c in 0..n {
            let pd = r + c;
            let nd = (r + n) - c;
            if cols[c] || pos[pd] || neg[nd] { continue; }
            cols[c] = true; pos[pd] = true; neg[nd] = true;
            board[r][c] = b'Q';
            bt(n, r + 1, cols, pos, neg, board, res);
            board[r][c] = b'.';
            cols[c] = false; pos[pd] = false; neg[nd] = false;
        }
    }
    bt(n, 0, &mut cols, &mut pos_diag, &mut neg_diag, &mut board, &mut res);
    res
}
```

#### Go

Maps as sets — `delete` is the explicit way to remove a key. Board reconstruction via per-row `string(row)` conversion.

```go
func solveNQueens(n int) [][]string {
    var res [][]string
    board := make([][]byte, n)
    for i := range board { board[i] = []byte(string(make([]byte, n))); for j := range board[i] { board[i][j] = '.' } }
    cols := make(map[int]bool)
    posDiag := make(map[int]bool)
    negDiag := make(map[int]bool)
    var bt func(r int)
    bt = func(r int) {
        if r == n {
            snap := make([]string, n)
            for i, row := range board { snap[i] = string(row) }
            res = append(res, snap)
            return
        }
        for c := 0; c < n; c++ {
            if cols[c] || posDiag[r+c] || negDiag[r-c] { continue }
            cols[c] = true; posDiag[r+c] = true; negDiag[r-c] = true
            board[r][c] = 'Q'
            bt(r + 1)
            board[r][c] = '.'
            delete(cols, c); delete(posDiag, r+c); delete(negDiag, r-c)
        }
    }
    bt(0)
    return res
}
```

#### C++

`std::vector<bool>` for the three conflict trackers — packed bit-storage. The `neg[r-c+n]` offset trick prevents negative indices. Multiple-assignment `cols[c] = pos[r+c] = neg[r-c+n] = true` is a C++ idiom.

```cpp
#include <vector>
#include <string>

std::vector<std::vector<std::string>> solveNQueens(int n) {
    std::vector<std::vector<std::string>> res;
    std::vector<std::string> board(n, std::string(n, '.'));
    std::vector<bool> cols(n), pos(2*n), neg(2*n);
    std::function<void(int)> bt = [&](int r) {
        if (r == n) { res.push_back(board); return; }
        for (int c = 0; c < n; ++c) {
            if (cols[c] || pos[r+c] || neg[r-c+n]) continue;
            cols[c] = pos[r+c] = neg[r-c+n] = true;
            board[r][c] = 'Q';
            bt(r + 1);
            board[r][c] = '.';
            cols[c] = pos[r+c] = neg[r-c+n] = false;
        }
    };
    bt(0);
    return res;
}
```


### 83. Number of Islands

#### Problem
Given an `m×n` binary grid of `'1'` (land) and `'0'` (water), count the number of islands. An island is a group of adjacent (4-directional) land cells surrounded by water.

#### Examples

```text
Input: grid = [["1","1","1","1","0"],["1","1","0","1","0"],
  ["1","1","0","0","0"],["0","0","0","0","0"]]
Output: 1

Input: grid = [["1","1","0","0","0"],["1","1","0","0","0"],
  ["0","0","1","0","0"],["0","0","0","1","1"]]
Output: 3

Input: grid = [["0"]]
Output: 0

Constraints:
- m == grid.length, n == grid[i].length
- 1 <= m, n <= 300
- grid[i][j] is "0" or "1"
```

#### Recognition
**Signals.** A grid whose cells are "adjacent" in four directions is a graph in disguise: each cell is a vertex, each orthogonal neighbour an edge. "Count the number of islands" asks for connected components, and the word *distance* appears nowhere in the statement, which is what settles the DFS-versus-BFS question: visiting order is irrelevant, only reachability matters. `1 <= m, n <= 300` is 90000 cells, so the budget is a single pass. **Therefore.** Scan every cell; on an unvisited `"1"`, add one to the count and flood-fill its whole component, overwriting each land cell with `"0"` so the grid doubles as the visited set. **Not Union Find**, which solves it but pays for an `m·n` parent array and an inverse-Ackermann factor to answer a connectivity question that never changes; a DSU earns its keep only when edges arrive one at a time, as in Number of Islands II. **O(m·n)** time, **O(m·n)** space.

#### Explanation
**Brute force.** Give each land cell its own label, then push the smaller label to neighbours until nothing changes.

```python
def numIslands(grid):
    rows, cols = len(grid), len(grid[0])
    lab = {(r, c): r * cols + c
           for r in range(rows) for c in range(cols)
           if grid[r][c] == "1"}
    changed = True
    while changed:
        changed = False
        for (r, c) in lab:
            for nb in ((r+1,c), (r-1,c), (r,c+1), (r,c-1)):
                if nb in lab and lab[nb] < lab[(r, c)]:
                    lab[(r, c)] = lab[nb]
                    changed = True
    return len(set(lab.values()))
```

`O((m·n)^2)` time, `O(m·n)` space.

**Wasteful because.** One sweep carries a label exactly one cell further along an island, so a snake-shaped island of length k needs k sweeps, and each of those sweeps re-reads all m·n cells to move information that one walk along the snake would have carried in a single pass.

**Optimal.** A component only has to be discovered once, from whichever of its cells the row-major scan reaches first. Flood-fill from that cell and consume the entire island in one traversal, writing `"0"` over each land cell as you enter it. That write does two jobs at once: it marks the cell visited, and it guarantees the outer scan will never start a second island from a cell already counted, so the answer is simply the number of traversals started. Each cell is entered at most once per side, giving `O(m·n)` overall. BFS with an explicit queue is the same algorithm at the same cost and is the version to write for large grids: 300 by 300 all-land recurses 90000 frames deep, far past Python's default limit.

**Edge cases.** An all-water grid returns 0 and never enters the fill. An all-land grid is one island and is also the worst case for stack depth. Cells touching only diagonally are separate islands, since the four orthogonal directions are the only edges. The grid cells are the strings `"1"` and `"0"`, not integers, so the comparison must be against a string. The function overwrites the caller's grid; copy it first if the caller still needs it.

#### Python

In-place mark with `"0"` doubles as visited tracking — no separate set. Direction list `[(0,1),(0,-1),(1,0),(-1,0)]` is the canonical 4-way iteration.

```python
def numIslands(grid):
    count = 0
    rows, cols = len(grid), len(grid[0])
    def dfs(r, c):
        if r < 0 or c < 0 or r >= rows or c >= cols or grid[r][c] != "1":
            return
        grid[r][c] = "0"
        for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            dfs(r + dr, c + dc)
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "1":
                dfs(r, c)
                count += 1
    return count
```

#### Java

In-place `grid[r][c] = '0'` marks visited without a separate structure. The four explicit recursive calls are terser than a direction loop for 4-way DFS.

```java
class Solution {
    public int numIslands(char[][] grid) {
        int rows = grid.length, cols = grid[0].length, count = 0;
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] == '1') {
                    dfs(grid, r, c);
                    count++;
                }
            }
        }
        return count;
    }

    private void dfs(char[][] grid, int r, int c) {
        if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length
                || grid[r][c] != '1') return;
        grid[r][c] = '0';
        dfs(grid, r + 1, c);
        dfs(grid, r - 1, c);
        dfs(grid, r, c + 1);
        dfs(grid, r, c - 1);
    }
}
```

#### Rust

`Vec<Vec<char>>` mutated in place; `&mut` threaded through the recursion. `i32` for r,c lets the bounds check happen before the `as usize` cast.

```rust
fn num_islands(mut grid: Vec<Vec<char>>) -> i32 {
    let rows = grid.len();
    let cols = grid[0].len();
    fn dfs(grid: &mut Vec<Vec<char>>, r: i32, c: i32) {
        let rows = grid.len() as i32;
        let cols = grid[0].len() as i32;
        if r < 0 || c < 0 || r >= rows || c >= cols || grid[r as usize][c as usize] != '1' { return; }
        grid[r as usize][c as usize] = '0';
        for (dr, dc) in [(0,1),(0,-1),(1,0),(-1,0)] {
            dfs(grid, r + dr, c + dc);
        }
    }
    let mut count = 0;
    for r in 0..rows {
        for c in 0..cols {
            if grid[r][c] == '1' {
                dfs(&mut grid, r as i32, c as i32);
                count += 1;
            }
        }
    }
    count
}
```

#### Go

Four explicit `dfs(r±1, c)` / `dfs(r, c±1)` calls instead of a direction loop — shorter for 4-way DFS. Mutating `grid` in place via byte assignment.

```go
func numIslands(grid [][]byte) int {
    rows, cols := len(grid), len(grid[0])
    var dfs func(r, c int)
    dfs = func(r, c int) {
        if r < 0 || c < 0 || r >= rows || c >= cols || grid[r][c] != '1' { return }
        grid[r][c] = '0'
        dfs(r+1, c); dfs(r-1, c); dfs(r, c+1); dfs(r, c-1)
    }
    count := 0
    for r := 0; r < rows; r++ {
        for c := 0; c < cols; c++ {
            if grid[r][c] == '1' { dfs(r, c); count++ }
        }
    }
    return count
}
```

#### C++

Four explicit recursive calls — same shape as Go. `std::function<void(int,int)>` for the recursive lambda.

```cpp
#include <vector>

int numIslands(std::vector<std::vector<char>>& grid) {
    int rows = grid.size(), cols = grid[0].size(), count = 0;
    std::function<void(int,int)> dfs = [&](int r, int c) {
        if (r < 0 || c < 0 || r >= rows || c >= cols || grid[r][c] != '1') return;
        grid[r][c] = '0';
        dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1);
    };
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c)
            if (grid[r][c] == '1') { dfs(r, c); ++count; }
    return count;
}
```


### 84. Clone Graph

#### Problem
Given a reference to a node in a connected undirected graph, return a deep copy (clone) of the graph. Each node contains a value and a list of neighbors.

#### Examples

```text
Input: node = [[2,4],[1,3],[2,4],[1,3]]
Output: [[2,4],[1,3],[2,4],[1,3]]
Explanation: the graph is written as an adjacency list whose
  i-th entry holds the neighbours of the node with value i+1;
  `node` is the first of them. The clone serialises the same.

Input: node = [[]]
Output: [[]]

Input: node = []
Output: null

Constraints:
- 0 <= number of nodes <= 100
- 1 <= Node.val <= 100, unique per node
- connected, undirected, no self-loops or repeated edges
```

#### Recognition
**Signals.** "Deep copy" of a graph given "a reference to a node" says the input is a pointer, not an array, so the only way to see the whole graph is to traverse it. Undirected guarantees cycles, because from any node you can walk straight back the way you came, and a plain recursive copy would therefore never terminate. Nothing in the statement mentions distance or ordering, so DFS and BFS are equally correct here. **Therefore.** One traversal carrying a hash map from original node to its clone, doing double duty: the keys are the visited set and the values are what neighbours get wired to. Create the clone and record it *before* recursing, so a cycle arriving back finds the in-progress copy instead of starting a second one. **Not a plain visited set**, because knowing a node has been seen does not tell you which clone it became, and you still have to append that exact clone to the current node's neighbour list. **O(V+E)** time, **O(V)** space.

#### Explanation
**Brute force.** Collect the nodes into a list, clone them, then find each neighbour by scanning that list.

```python
def cloneGraph(node):
    if not node:
        return None
    seen, stack = [], [node]
    while stack:
        n = stack.pop()
        if any(o is n for o in seen):
            continue
        seen.append(n)
        stack += n.neighbors
    copies = [Node(o.val) for o in seen]
    for o, c in zip(seen, copies):
        for nb in o.neighbors:
            c.neighbors.append(copies[seen.index(nb)])
    return copies[0]
```

`O(V^2 + E·V)` time, `O(V)` space.

**Wasteful because.** Both `any(o is n ...)` and `seen.index(nb)` walk the whole list to answer a membership or lookup question. Every edge triggers one such scan, so wiring the graph costs `E·V` comparisons where each one could have been a single hash.

**Optimal.** Replace the list with a dict keyed on the original node object. A single DFS then suffices: on entering a node, return its clone if the dict already holds one; otherwise create the clone, store it immediately, and only then recurse into the neighbours, appending each returned clone. Storing before recursing is the whole trick, and it is what converts a cycle from infinite recursion into a dict hit. Every node is entered once and every edge followed once, so the cost is `O(V+E)`. An iterative BFS with a queue is the same algorithm with the same map, and is the version to reach for if the graph could be deep enough to exhaust the recursion stack.

**Edge cases.** A null start node returns null, not an empty node. A lone node must come back with its own empty neighbour list, not a shared reference to the original's. Undirected edges appear twice, once in each endpoint's list, and the map keeps both copies consistent with no special handling. The test that the copy is truly deep: no clone's neighbour list may contain an original node.

#### Python

Insert the new node into `old_to_new` *before* recursing — critical for cycles, otherwise the recursive call would re-create the clone. `old_to_new[n]` for both 'have I seen this?' and 'give me the clone'.

```python
def cloneGraph(node):
    if not node:
        return None
    old_to_new = {}
    def dfs(n):
        if n in old_to_new:
            return old_to_new[n]
        copy = Node(n.val)
        old_to_new[n] = copy
        for nb in n.neighbors:
            copy.neighbors.append(dfs(nb))
        return copy
    return dfs(node)
```

#### Java

Assumes the standard LeetCode `Node` (an `int val` and `List<Node> neighbors`). A `HashMap<Node, Node>` keyed on object identity is both the visited set and the old-to-new lookup; insert the clone *before* recursing so cycles resolve to the in-progress copy.

```java
import java.util.*;

class Solution {
    public Node cloneGraph(Node node) {
        if (node == null) return null;
        Map<Node, Node> oldToNew = new HashMap<>();
        return dfs(node, oldToNew);
    }

    private Node dfs(Node n, Map<Node, Node> oldToNew) {
        Node existing = oldToNew.get(n);
        if (existing != null) return existing;
        Node copy = new Node(n.val);
        oldToNew.put(n, copy);
        for (Node nb : n.neighbors) {
            copy.neighbors.add(dfs(nb, oldToNew));
        }
        return copy;
    }
}
```

#### Rust

`Rc<RefCell<Node>>` is the standard shared-mutable graph shape in Rust. Cloning the neighbor list outside the recursive call (`let neighbors: Vec<_> = ...`) releases the immutable borrow before the recursive call needs `borrow_mut`.

```rust
use std::collections::HashMap;
use std::rc::Rc;
use std::cell::RefCell;

#[derive(Debug)]
struct Node {
    val: i32,
    neighbors: Vec<Rc<RefCell<Node>>>,
}

fn clone_graph(node: Option<Rc<RefCell<Node>>>) -> Option<Rc<RefCell<Node>>> {
    let node = node?;
    let mut map: HashMap<i32, Rc<RefCell<Node>>> = HashMap::new();
    fn dfs(n: &Rc<RefCell<Node>>, map: &mut HashMap<i32, Rc<RefCell<Node>>>) -> Rc<RefCell<Node>> {
        let val = n.borrow().val;
        if let Some(existing) = map.get(&val) { return Rc::clone(existing); }
        let copy = Rc::new(RefCell::new(Node { val, neighbors: vec![] }));
        map.insert(val, Rc::clone(&copy));
        let neighbors: Vec<_> = n.borrow().neighbors.iter().map(Rc::clone).collect();
        for nb in neighbors {
            copy.borrow_mut().neighbors.push(dfs(&nb, map));
        }
        copy
    }
    Some(dfs(&node, &mut map))
}
```

#### Go

Map keyed by pointer — `map[*Node]*Node` — leverages Go's native pointer identity. The comma-ok lookup `if copy, ok := visited[n]; ok` is the standard 'memoized' check.

```go
type Node struct {
    Val       int
    Neighbors []*Node
}

func cloneGraph(node *Node) *Node {
    if node == nil { return nil }
    visited := make(map[*Node]*Node)
    var dfs func(n *Node) *Node
    dfs = func(n *Node) *Node {
        if copy, ok := visited[n]; ok { return copy }
        copy := &Node{Val: n.Val}
        visited[n] = copy
        for _, nb := range n.Neighbors {
            copy.Neighbors = append(copy.Neighbors, dfs(nb))
        }
        return copy
    }
    return dfs(node)
}
```

#### C++

`unordered_map<Node*, Node*>` for the memoization. `visited.count(n)` then `visited[n]` does two lookups; could optimize with `find()` but readability wins.

```cpp
#include <unordered_map>
#include <vector>

class Node {
public:
    int val;
    std::vector<Node*> neighbors;
    Node(int v) : val(v) {}
};

Node* cloneGraph(Node* node) {
    if (!node) return nullptr;
    std::unordered_map<Node*, Node*> visited;
    std::function<Node*(Node*)> dfs = [&](Node* n) -> Node* {
        if (visited.count(n)) return visited[n];
        Node* copy = new Node(n->val);
        visited[n] = copy;
        for (Node* nb : n->neighbors)
            copy->neighbors.push_back(dfs(nb));
        return copy;
    };
    return dfs(node);
}
```


### 85. Max Area of Island

#### Problem
Given a binary matrix where `1` is land and `0` is water, return the area of the largest island (group of 4-directionally connected land cells), or `0` if there is no land.

#### Examples

TODO

#### Recognition
**DFS flood fill returning subtree size.** **O(m·n)** time, **O(m·n)** space.

#### Explanation
This is Number of Islands (problem #83) with an extra requirement: track and maximise the area of each connected component. The DFS returns the count of cells in the island rooted at `(r, c)`: `1` for the current cell plus the sum of sizes returned by the four recursive calls. In-place marking (`grid[r][c] = 0`) prevents revisiting. The outer loop takes the maximum over all starting cells — cells already marked `0` contribute `0` from the DFS. The `max(... for ...)` generator is convenient but visits every cell; an explicit loop storing the running maximum is equivalent. Edge case: a grid with no land returns `0` because all DFS calls return `0`.

#### Python

`1 + sum(dfs(...) for ...)` is the elegant one-liner that aggregates the four directions. Returns 0 on out-of-bounds or water, so the sum collapses naturally.

```python
def maxAreaOfIsland(grid):
    rows, cols = len(grid), len(grid[0])
    def dfs(r, c):
        if r < 0 or c < 0 or r >= rows or c >= cols or grid[r][c] == 0:
            return 0
        grid[r][c] = 0
        return 1 + sum(dfs(r + dr, c + dc) for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)])
    return max(dfs(r, c) for r in range(rows) for c in range(cols))
```

#### Java

The DFS returns the component size — `1 + dfs(...) + dfs(...) + ...` aggregated inline, with out-of-bounds/water returning 0 so the sum collapses naturally. `Math.max` over every start cell tracks the running best.

```java
class Solution {
    public int maxAreaOfIsland(int[][] grid) {
        int rows = grid.length, cols = grid[0].length, best = 0;
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                best = Math.max(best, dfs(grid, r, c));
        return best;
    }

    private int dfs(int[][] grid, int r, int c) {
        if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length
                || grid[r][c] == 0) return 0;
        grid[r][c] = 0;
        return 1 + dfs(grid, r + 1, c) + dfs(grid, r - 1, c)
                 + dfs(grid, r, c + 1) + dfs(grid, r, c - 1);
    }
}
```

#### Rust

Same `1 + dfs() + dfs() + dfs() + dfs()` aggregation, but explicit because Rust has no `sum` over inline iterators here without a slice. `i32` indices for bounds-safe arithmetic.

```rust
fn max_area_of_island(mut grid: Vec<Vec<i32>>) -> i32 {
    let rows = grid.len();
    let cols = grid[0].len();
    fn dfs(grid: &mut Vec<Vec<i32>>, r: i32, c: i32) -> i32 {
        let rows = grid.len() as i32;
        let cols = grid[0].len() as i32;
        if r < 0 || c < 0 || r >= rows || c >= cols || grid[r as usize][c as usize] == 0 { return 0; }
        grid[r as usize][c as usize] = 0;
        1 + dfs(grid, r+1, c) + dfs(grid, r-1, c) + dfs(grid, r, c+1) + dfs(grid, r, c-1)
    }
    let mut best = 0;
    for r in 0..rows {
        for c in 0..cols {
            best = best.max(dfs(&mut grid, r as i32, c as i32));
        }
    }
    best
}
```

#### Go

Inline assignment-in-condition `if a := dfs(r, c); a > best` updates the running max in one expression — Go's only conditional-binding form.

```go
func maxAreaOfIsland(grid [][]int) int {
    rows, cols := len(grid), len(grid[0])
    var dfs func(r, c int) int
    dfs = func(r, c int) int {
        if r < 0 || c < 0 || r >= rows || c >= cols || grid[r][c] == 0 { return 0 }
        grid[r][c] = 0
        return 1 + dfs(r+1,c) + dfs(r-1,c) + dfs(r,c+1) + dfs(r,c-1)
    }
    best := 0
    for r := 0; r < rows; r++ {
        for c := 0; c < cols; c++ {
            if a := dfs(r, c); a > best { best = a }
        }
    }
    return best
}
```

#### C++

Returns `1 + dfs(...) + dfs(...) + ...` aggregated inline. `std::function<int(int,int)>` because the recursive lambda needs a typed self-reference.

```cpp
#include <vector>
#include <algorithm>

int maxAreaOfIsland(std::vector<std::vector<int>>& grid) {
    int rows = grid.size(), cols = grid[0].size();
    std::function<int(int,int)> dfs = [&](int r, int c) -> int {
        if (r < 0 || c < 0 || r >= rows || c >= cols || grid[r][c] == 0) return 0;
        grid[r][c] = 0;
        return 1 + dfs(r+1,c) + dfs(r-1,c) + dfs(r,c+1) + dfs(r,c-1);
    };
    int best = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c)
            best = std::max(best, dfs(r, c));
    return best;
}
```


### 86. Pacific Atlantic Water Flow

#### Problem
Given an `m×n` integer matrix of heights, water flows to adjacent cells with equal or lower elevation. The Pacific touches the top and left edges; the Atlantic touches the bottom and right edges. Return all cells from which water can reach both oceans.

#### Examples

TODO

#### Recognition
**Reverse multi-source BFS from each ocean border.** **O(m·n)** time, **O(m·n)** space.

#### Explanation
Forward simulation (try every cell, simulate flow) is `O((mn)²)`. The reversal insight: instead of asking "can water flow from this cell to the ocean?", ask "from the ocean border, which cells can water flow *up* to?" — which means moving to adjacent cells with height **greater than or equal to** the current cell. Two separate BFS passes — one seeded from the Pacific border, one from the Atlantic — produce two reachable sets. The answer is their intersection. This is `O(m·n)` because each cell is enqueued at most once per BFS. The edge initialization includes all border cells for the respective ocean (top+left for Pacific, bottom+right for Atlantic).

#### Python

Set comprehension for the starting cells of each ocean; `pacific & atlantic` is set intersection in one operator. List comprehension for the result conversion.

```python
from collections import deque

def pacificAtlantic(heights):
    rows, cols = len(heights), len(heights[0])
    def bfs(starts):
        q = deque(starts)
        visited = set(starts)
        while q:
            r, c = q.popleft()
            for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                nr, nc = r + dr, c + dc
                if (0 <= nr < rows and 0 <= nc < cols
                        and (nr, nc) not in visited
                        and heights[nr][nc] >= heights[r][c]):
                    visited.add((nr, nc))
                    q.append((nr, nc))
        return visited
    pacific  = bfs([(0, c) for c in range(cols)] + [(r, 0) for r in range(rows)])
    atlantic = bfs([(rows-1, c) for c in range(cols)] + [(r, cols-1) for r in range(rows)])
    return [[r, c] for r, c in pacific & atlantic]
```

#### Java

Two `boolean[][]` visited grids replace the Python sets — index lookup instead of hashing. `ArrayDeque<int[]>` is the BFS queue (never the legacy `Stack`/`LinkedList`); the intersection sweep collects cells reachable from both oceans.

```java
import java.util.*;

class Solution {
    private static final int[][] DIRS = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};

    public List<List<Integer>> pacificAtlantic(int[][] heights) {
        int rows = heights.length, cols = heights[0].length;
        boolean[][] pac = new boolean[rows][cols];
        boolean[][] atl = new boolean[rows][cols];
        Deque<int[]> pq = new ArrayDeque<>();
        Deque<int[]> aq = new ArrayDeque<>();
        for (int c = 0; c < cols; c++) {
            pq.add(new int[]{0, c}); pac[0][c] = true;
            aq.add(new int[]{rows - 1, c}); atl[rows - 1][c] = true;
        }
        for (int r = 0; r < rows; r++) {
            pq.add(new int[]{r, 0}); pac[r][0] = true;
            aq.add(new int[]{r, cols - 1}); atl[r][cols - 1] = true;
        }
        bfs(heights, pq, pac);
        bfs(heights, aq, atl);
        List<List<Integer>> res = new ArrayList<>();
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (pac[r][c] && atl[r][c]) res.add(List.of(r, c));
        return res;
    }

    private void bfs(int[][] heights, Deque<int[]> q, boolean[][] vis) {
        int rows = heights.length, cols = heights[0].length;
        while (!q.isEmpty()) {
            int[] cell = q.poll();
            int r = cell[0], c = cell[1];
            for (int[] d : DIRS) {
                int nr = r + d[0], nc = c + d[1];
                if (nr >= 0 && nc >= 0 && nr < rows && nc < cols
                        && !vis[nr][nc] && heights[nr][nc] >= heights[r][c]) {
                    vis[nr][nc] = true;
                    q.add(new int[]{nr, nc});
                }
            }
        }
    }
}
```

#### Rust

Two visited bool grids instead of sets — index-keyed lookup is faster. Closure `bfs` captures `heights` by capture; explicit `&mut` for the queue and visited grid.

```rust
use std::collections::VecDeque;

fn pacific_atlantic(heights: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
    let rows = heights.len();
    let cols = heights[0].len();
    let mut pac = vec![vec![false; cols]; rows];
    let mut atl = vec![vec![false; cols]; rows];
    let mut pq: VecDeque<(usize,usize)> = VecDeque::new();
    let mut aq: VecDeque<(usize,usize)> = VecDeque::new();
    for c in 0..cols { pq.push_back((0,c)); pac[0][c]=true; aq.push_back((rows-1,c)); atl[rows-1][c]=true; }
    for r in 0..rows { pq.push_back((r,0)); pac[r][0]=true; aq.push_back((r,cols-1)); atl[r][cols-1]=true; }
    let bfs = |q: &mut VecDeque<(usize,usize)>, vis: &mut Vec<Vec<bool>>| {
        while let Some((r,c)) = q.pop_front() {
            for (dr,dc) in [(0i32,1i32),(0,-1),(1,0),(-1,0)] {
                let nr = r as i32 + dr; let nc = c as i32 + dc;
                if nr<0||nc<0||nr>=rows as i32||nc>=cols as i32 { continue; }
                let (nr,nc) = (nr as usize, nc as usize);
                if !vis[nr][nc] && heights[nr][nc] >= heights[r][c] {
                    vis[nr][nc] = true; q.push_back((nr,nc));
                }
            }
        }
    };
    bfs(&mut pq, &mut pac);
    bfs(&mut aq, &mut atl);
    let mut res = Vec::new();
    for r in 0..rows { for c in 0..cols { if pac[r][c] && atl[r][c] { res.push(vec![r as i32, c as i32]); } } }
    res
}
```

#### Go

`container/list` for the queue gives O(1) push/pop; slice-as-queue would also work. Type-assertion `e.Value.([2]int)` extracts the pair from `interface{}`.

```go
import "container/list"

func pacificAtlantic(heights [][]int) [][]int {
    rows, cols := len(heights), len(heights[0])
    bfs := func(starts [][2]int) [][]bool {
        vis := make([][]bool, rows)
        for i := range vis { vis[i] = make([]bool, cols) }
        q := list.New()
        for _, s := range starts { vis[s[0]][s[1]] = true; q.PushBack(s) }
        for q.Len() > 0 {
            e := q.Front(); q.Remove(e)
            pos := e.Value.([2]int)
            r, c := pos[0], pos[1]
            for _, d := range [][2]int{{0,1},{0,-1},{1,0},{-1,0}} {
                nr, nc := r+d[0], c+d[1]
                if nr>=0 && nc>=0 && nr<rows && nc<cols && !vis[nr][nc] && heights[nr][nc]>=heights[r][c] {
                    vis[nr][nc] = true; q.PushBack([2]int{nr,nc})
                }
            }
        }
        return vis
    }
    var pStarts, aStarts [][2]int
    for c := 0; c < cols; c++ { pStarts = append(pStarts, [2]int{0,c}); aStarts = append(aStarts, [2]int{rows-1,c}) }
    for r := 0; r < rows; r++ { pStarts = append(pStarts, [2]int{r,0}); aStarts = append(aStarts, [2]int{r,cols-1}) }
    pac, atl := bfs(pStarts), bfs(aStarts)
    var res [][]int
    for r := 0; r < rows; r++ { for c := 0; c < cols; c++ { if pac[r][c] && atl[r][c] { res = append(res, []int{r,c}) } } }
    return res
}
```

#### C++

`std::queue<std::pair<int,int>>` with structured binding `auto [r,c] = ...` for the dequeue. Captures `heights` by reference in the lambda.

```cpp
#include <vector>
#include <queue>

std::vector<std::vector<int>> pacificAtlantic(std::vector<std::vector<int>>& heights) {
    int rows = heights.size(), cols = heights[0].size();
    auto bfs = [&](std::vector<std::pair<int,int>> starts) {
        std::vector<std::vector<bool>> vis(rows, std::vector<bool>(cols, false));
        std::queue<std::pair<int,int>> q;
        for (auto [r,c] : starts) { vis[r][c] = true; q.push({r,c}); }
        while (!q.empty()) {
            auto [r,c] = q.front(); q.pop();
            for (auto [dr,dc] : std::vector<std::pair<int,int>>{{0,1},{0,-1},{1,0},{-1,0}}) {
                int nr=r+dr, nc=c+dc;
                if (nr>=0&&nc>=0&&nr<rows&&nc<cols&&!vis[nr][nc]&&heights[nr][nc]>=heights[r][c]) {
                    vis[nr][nc]=true; q.push({nr,nc});
                }
            }
        }
        return vis;
    };
    std::vector<std::pair<int,int>> pStarts, aStarts;
    for (int c=0;c<cols;c++) { pStarts.push_back({0,c}); aStarts.push_back({rows-1,c}); }
    for (int r=0;r<rows;r++) { pStarts.push_back({r,0}); aStarts.push_back({r,cols-1}); }
    auto pac=bfs(pStarts), atl=bfs(aStarts);
    std::vector<std::vector<int>> res;
    for (int r=0;r<rows;r++) for (int c=0;c<cols;c++) if (pac[r][c]&&atl[r][c]) res.push_back({r,c});
    return res;
}
```


### 87. Surrounded Regions

#### Problem
Given an `m×n` board of `'X'` and `'O'`, capture all `'O'` regions completely surrounded by `'X'` by flipping them to `'X'`. Border-connected `'O'` regions are never captured.

#### Examples

TODO

#### Recognition
**DFS from border `'O'` cells to mark safe regions, then sweep.** **O(m·n)** time, **O(m·n)** space.

#### Explanation
A direct approach — flood-fill each `'O'` region and check if it touches the border — requires `O(mn)` per region and risks quadratic time. The reverse approach is cleaner: any `'O'` reachable from the border is safe; anything else is surrounded. Two-pass algorithm: (1) DFS from every border `'O'`, marking safe cells `'S'`; (2) sweep the board and convert `'S'` back to `'O'` (safe) and everything else to `'X'` (captured or already `'X'`). The border cells to seed are the first/last row and first/last column. This runs in exactly `O(m·n)` since each cell is visited at most once.

#### Python

Two-pass: mark border-reachable Os as `'S'`, then sweep converting `'S' → 'O'`, everything else `→ 'X'`. The `r in (0, rows-1)` tuple membership is a compact border test.

```python
def solve(board):
    rows, cols = len(board), len(board[0])
    def dfs(r, c):
        if r < 0 or c < 0 or r >= rows or c >= cols or board[r][c] != "O":
            return
        board[r][c] = "S"
        for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            dfs(r + dr, c + dc)
    for r in range(rows):
        for c in range(cols):
            if board[r][c] == "O" and (r in (0, rows - 1) or c in (0, cols - 1)):
                dfs(r, c)
    for r in range(rows):
        for c in range(cols):
            board[r][c] = "O" if board[r][c] == "S" else "X"
```

#### Java

Two-pass with `'S'` as the border-safe marker. The ternary in the final sweep (`board[r][c] == 'S' ? 'O' : 'X'`) restores safe cells and captures everything else in one line.

```java
class Solution {
    public void solve(char[][] board) {
        int rows = board.length, cols = board[0].length;
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (board[r][c] == 'O' && (r == 0 || r == rows - 1 || c == 0 || c == cols - 1))
                    dfs(board, r, c);
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                board[r][c] = board[r][c] == 'S' ? 'O' : 'X';
    }

    private void dfs(char[][] board, int r, int c) {
        if (r < 0 || c < 0 || r >= board.length || c >= board[0].length
                || board[r][c] != 'O') return;
        board[r][c] = 'S';
        dfs(board, r + 1, c);
        dfs(board, r - 1, c);
        dfs(board, r, c + 1);
        dfs(board, r, c - 1);
    }
}
```

#### Rust

Same two-pass with `'S'` as the safe marker. Explicit `r==0||r==rows-1||c==0||c==cols-1` border check — Rust has no tuple-membership operator.

```rust
fn solve(board: &mut Vec<Vec<char>>) {
    let rows = board.len();
    let cols = board[0].len();
    fn dfs(board: &mut Vec<Vec<char>>, r: i32, c: i32) {
        let rows = board.len() as i32;
        let cols = board[0].len() as i32;
        if r<0||c<0||r>=rows||c>=cols||board[r as usize][c as usize]!='O' { return; }
        board[r as usize][c as usize] = 'S';
        for (dr,dc) in [(0,1),(0,-1),(1,0),(-1,0)] { dfs(board, r+dr, c+dc); }
    }
    for r in 0..rows {
        for c in 0..cols {
            if board[r][c] == 'O' && (r==0||r==rows-1||c==0||c==cols-1) {
                dfs(board, r as i32, c as i32);
            }
        }
    }
    for r in 0..rows {
        for c in 0..cols {
            board[r][c] = if board[r][c]=='S' { 'O' } else { 'X' };
        }
    }
}
```

#### Go

Four explicit border conditions joined by `||`. The final sweep uses a ternary-style if-else inline.

```go
func solve(board [][]byte) {
    rows, cols := len(board), len(board[0])
    var dfs func(r, c int)
    dfs = func(r, c int) {
        if r<0||c<0||r>=rows||c>=cols||board[r][c]!='O' { return }
        board[r][c] = 'S'
        dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1)
    }
    for r := 0; r < rows; r++ {
        for c := 0; c < cols; c++ {
            if board[r][c]=='O' && (r==0||r==rows-1||c==0||c==cols-1) { dfs(r,c) }
        }
    }
    for r := 0; r < rows; r++ {
        for c := 0; c < cols; c++ {
            if board[r][c]=='S' { board[r][c]='O' } else { board[r][c]='X' }
        }
    }
}
```

#### C++

Same shape; ternary `(board[r][c]=='S') ? 'O' : 'X'` for the final sweep. Lambda `dfs` captures `board` by reference.

```cpp
#include <vector>

void solve(std::vector<std::vector<char>>& board) {
    int rows = board.size(), cols = board[0].size();
    std::function<void(int,int)> dfs = [&](int r, int c) {
        if (r<0||c<0||r>=rows||c>=cols||board[r][c]!='O') return;
        board[r][c]='S';
        dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1);
    };
    for (int r=0;r<rows;r++) for (int c=0;c<cols;c++)
        if (board[r][c]=='O' && (r==0||r==rows-1||c==0||c==cols-1)) dfs(r,c);
    for (int r=0;r<rows;r++) for (int c=0;c<cols;c++)
        board[r][c] = (board[r][c]=='S') ? 'O' : 'X';
}
```


### 88. Rotting Oranges

#### Problem
In a grid, `0` = empty, `1` = fresh orange, `2` = rotten orange. Each minute, every fresh orange adjacent to a rotten one becomes rotten. Return the minimum minutes to rot all oranges, or `-1` if impossible.

#### Examples

```text
Input: grid = [[2,1,1],[1,1,0],[0,1,1]]
Output: 4
Explanation: the last fresh orange rots at minute 4.

Input: grid = [[2,1,1],[0,1,1],[1,0,1]]
Output: -1
Explanation: the bottom-left orange is never reached.

Input: grid = [[0,2]]
Output: 0

Constraints:
- 1 <= m, n <= 10
- grid[i][j] is 0, 1 or 2
- rot spreads 4-directionally, one cell per minute
```

#### Recognition
**Signals.** "Minimum minutes" is a shortest-distance objective on an unweighted grid, which means BFS rather than DFS. The decisive word is *simultaneously*: every rotten orange spreads during the same minute, so there is not one source but many, and what a fresh cell needs is its distance to the *nearest* rotten one. "Or -1 if impossible" warns that some fresh oranges may be unreachable, so leftovers have to be detectable. **Therefore.** Multi-source BFS. Seed the queue with every initially rotten cell at time 0, count the fresh ones, then expand outward, decrementing the count as each cell flips. The answer is the largest time stamp written, or -1 if the count is still positive when the queue drains. **Not one BFS per rotten orange**, which costs `O(k·m·n)` for k sources and then makes you take a per-cell minimum across k distance grids; one shared frontier expanding in lockstep produces those same minima in a single pass. **O(m·n)** time, **O(m·n)** space.

#### Explanation
**Brute force.** Simulate one minute at a time, rescanning the grid for fresh cells that touch a rotten one.

```python
def orangesRotting(grid):
    rows, cols = len(grid), len(grid[0])
    minutes = 0
    while True:
        rot = [(r, c)
               for r in range(rows) for c in range(cols)
               if grid[r][c] == 1 and any(
                   0 <= r + dr < rows and 0 <= c + dc < cols
                   and grid[r + dr][c + dc] == 2
                   for dr, dc in ((0,1),(0,-1),(1,0),(-1,0)))]
        if not rot:
            break
        for r, c in rot:
            grid[r][c] = 2
        minutes += 1
    return -1 if any(1 in row for row in grid) else minutes
```

`O((m·n)^2)` time, `O(m·n)` space.

**Wasteful because.** Each minute re-reads all m·n cells and all four neighbours of each, when the only cells that can possibly change are those touching an orange that rotted in the *previous* minute. With up to m·n minutes, untouched cells are examined m·n times over.

**Optimal.** Keep the frontier instead of rediscovering it every minute. A queue seeded with every rotten cell at time 0 is exactly the set whose neighbours might flip next; pop a cell at time `t`, flip each fresh neighbour, and push it at `t + 1`. Each cell is enqueued once and carries the minute it actually rots, because BFS pops in nondecreasing time order, so the first source to reach a cell is the nearest one and nothing needs revisiting. A running `fresh` counter turns the -1 test into a comparison rather than a closing sweep of the grid, and the answer is the last `t + 1` written. Draining the queue one level at a time and bumping a counter per level is an equivalent formulation that keeps the time out of the queue entries.

**Edge cases.** A grid with no fresh oranges returns 0 however many rotten ones it holds, because nothing ever writes `time`. A fresh orange walled off by empty cells returns -1, and so does a grid with fresh oranges but no rotten one at all. A 0 cell is not just empty, it blocks spread, so a pocket of fresh oranges ringed by zeros never rots.

#### Python

Multi-source BFS: enqueue every initially rotten orange with `t=0`. Tracking `fresh` count avoids a final sweep; `time = t + 1` updates on each successful infection.

```python
from collections import deque

def orangesRotting(grid):
    rows, cols = len(grid), len(grid[0])
    q = deque()
    fresh = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 2:
                q.append((r, c, 0))
            elif grid[r][c] == 1:
                fresh += 1
    time = 0
    while q:
        r, c, t = q.popleft()
        for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1:
                grid[nr][nc] = 2
                fresh -= 1
                q.append((nr, nc, t + 1))
                time = t + 1
    return time if fresh == 0 else -1
```

#### Java

`ArrayDeque<int[]>` seeds every initially rotten orange with a `{r, c, t}` triple. Tracking a `fresh` counter avoids a final sweep; `poll` returns null-safe FIFO order so `time` climbs monotonically.

```java
import java.util.*;

class Solution {
    public int orangesRotting(int[][] grid) {
        int rows = grid.length, cols = grid[0].length, fresh = 0, time = 0;
        Deque<int[]> q = new ArrayDeque<>();
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] == 2) q.add(new int[]{r, c, 0});
                else if (grid[r][c] == 1) fresh++;
            }
        }
        int[][] dirs = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};
        while (!q.isEmpty()) {
            int[] cell = q.poll();
            int r = cell[0], c = cell[1], t = cell[2];
            for (int[] d : dirs) {
                int nr = r + d[0], nc = c + d[1];
                if (nr >= 0 && nc >= 0 && nr < rows && nc < cols && grid[nr][nc] == 1) {
                    grid[nr][nc] = 2;
                    fresh--;
                    q.add(new int[]{nr, nc, t + 1});
                    time = t + 1;
                }
            }
        }
        return fresh == 0 ? time : -1;
    }
}
```

#### Rust

Same multi-source pattern. `i32` casts at the boundary check; the `usize` ↔ `i32` shuffling is the price for negative-bound-checking.

```rust
use std::collections::VecDeque;

fn oranges_rotting(mut grid: Vec<Vec<i32>>) -> i32 {
    let rows = grid.len();
    let cols = grid[0].len();
    let mut q: VecDeque<(usize, usize, i32)> = VecDeque::new();
    let mut fresh = 0i32;
    for r in 0..rows {
        for c in 0..cols {
            if grid[r][c] == 2 { q.push_back((r, c, 0)); }
            else if grid[r][c] == 1 { fresh += 1; }
        }
    }
    let mut time = 0;
    while let Some((r, c, t)) = q.pop_front() {
        for (dr, dc) in [(0i32,1i32),(0,-1),(1,0),(-1,0)] {
            let nr = r as i32 + dr; let nc = c as i32 + dc;
            if nr>=0&&nc>=0&&(nr as usize)<rows&&(nc as usize)<cols
                &&grid[nr as usize][nc as usize]==1 {
                grid[nr as usize][nc as usize]=2; fresh-=1;
                q.push_back((nr as usize, nc as usize, t+1)); time=t+1;
            }
        }
    }
    if fresh == 0 { time } else { -1 }
}
```

#### Go

`container/list` for the queue; named `cell` struct keeps the tuple readable. `time` is monotonically increasing because BFS processes in level order.

```go
import "container/list"

func orangesRotting(grid [][]int) int {
    rows, cols := len(grid), len(grid[0])
    type cell struct{ r, c, t int }
    q := list.New()
    fresh := 0
    for r := 0; r < rows; r++ {
        for c := 0; c < cols; c++ {
            if grid[r][c] == 2 { q.PushBack(cell{r,c,0}) }
            if grid[r][c] == 1 { fresh++ }
        }
    }
    time := 0
    for q.Len() > 0 {
        e := q.Front(); q.Remove(e)
        p := e.Value.(cell)
        for _, d := range [][2]int{{0,1},{0,-1},{1,0},{-1,0}} {
            nr, nc := p.r+d[0], p.c+d[1]
            if nr>=0&&nc>=0&&nr<rows&&nc<cols&&grid[nr][nc]==1 {
                grid[nr][nc]=2; fresh--
                q.PushBack(cell{nr,nc,p.t+1}); time=p.t+1
            }
        }
    }
    if fresh == 0 { return time }
    return -1
}
```

#### C++

`std::tuple<int,int,int>` for the queue entries, structured binding to destructure. Multi-source seeded in the initial double loop, no separate phase.

```cpp
#include <vector>
#include <queue>

int orangesRotting(std::vector<std::vector<int>>& grid) {
    int rows = grid.size(), cols = grid[0].size(), fresh = 0, time = 0;
    std::queue<std::tuple<int,int,int>> q;
    for (int r=0;r<rows;r++) for (int c=0;c<cols;c++) {
        if (grid[r][c]==2) q.push({r,c,0});
        else if (grid[r][c]==1) fresh++;
    }
    while (!q.empty()) {
        auto [r,c,t] = q.front(); q.pop();
        for (auto [dr,dc] : std::vector<std::pair<int,int>>{{0,1},{0,-1},{1,0},{-1,0}}) {
            int nr=r+dr, nc=c+dc;
            if (nr>=0&&nc>=0&&nr<rows&&nc<cols&&grid[nr][nc]==1) {
                grid[nr][nc]=2; --fresh; q.push({nr,nc,t+1}); time=t+1;
            }
        }
    }
    return fresh==0 ? time : -1;
}
```


### 89. Walls and Gates

#### Problem
Given a grid of rooms where `-1` is a wall, `0` is a gate, and `INF` (2^31 - 1) is an empty room, fill each empty room with its distance to the nearest gate in-place. Rooms unreachable from any gate remain `INF`.

#### Examples

TODO

#### Recognition
**Multi-source BFS from all gates simultaneously.** **O(m·n)** time, **O(m·n)** space.

#### Explanation
Running a BFS from each gate independently would cost `O(g · m·n)` where `g` is the number of gates. Multi-source BFS seeds all gates at once and propagates outward in waves: the first time any cell is reached gives the shortest distance to any gate. The `rooms[nr][nc] == INF` condition acts as a visited check — already-filled cells are not re-enqueued. This is correct because BFS guarantees that the first time a cell is dequeued, it was reached via the shortest path (so the first fill is optimal). Walls (`-1`) are never filled because the INF check excludes them.

#### Python

`INF = 2147483647` matches the problem's sentinel. The `rooms[nr][nc] == INF` check is both 'is this a room to fill' and 'have we already filled it'.

```python
from collections import deque

def wallsAndGates(rooms):
    rows, cols = len(rooms), len(rooms[0])
    INF = 2147483647
    q = deque(
        (r, c)
        for r in range(rows)
        for c in range(cols)
        if rooms[r][c] == 0
    )
    while q:
        r, c = q.popleft()
        for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and rooms[nr][nc] == INF:
                rooms[nr][nc] = rooms[r][c] + 1
                q.append((nr, nc))
```

#### Java

`Integer.MAX_VALUE` is the problem's `INF` sentinel; the `rooms[nr][nc] == INF` test doubles as the room-to-fill and not-yet-visited check. `ArrayDeque<int[]>` is the multi-source BFS queue seeded from every gate.

```java
import java.util.*;

class Solution {
    public void wallsAndGates(int[][] rooms) {
        int rows = rooms.length, cols = rooms[0].length;
        final int INF = Integer.MAX_VALUE;
        Deque<int[]> q = new ArrayDeque<>();
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (rooms[r][c] == 0) q.add(new int[]{r, c});
        int[][] dirs = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};
        while (!q.isEmpty()) {
            int[] cell = q.poll();
            int r = cell[0], c = cell[1];
            for (int[] d : dirs) {
                int nr = r + d[0], nc = c + d[1];
                if (nr >= 0 && nc >= 0 && nr < rows && nc < cols && rooms[nr][nc] == INF) {
                    rooms[nr][nc] = rooms[r][c] + 1;
                    q.add(new int[]{nr, nc});
                }
            }
        }
    }
}
```

#### Rust

`i32::MAX` as the sentinel — exactly the problem's value. The 'visited' check is the INF comparison itself; once filled, it's skipped on later visits.

```rust
use std::collections::VecDeque;

fn walls_and_gates(rooms: &mut Vec<Vec<i32>>) {
    let rows = rooms.len();
    let cols = rooms[0].len();
    const INF: i32 = i32::MAX;
    let mut q: VecDeque<(usize,usize)> = VecDeque::new();
    for r in 0..rows { for c in 0..cols { if rooms[r][c]==0 { q.push_back((r,c)); } } }
    while let Some((r,c)) = q.pop_front() {
        for (dr,dc) in [(0i32,1i32),(0,-1),(1,0),(-1,0)] {
            let nr=r as i32+dr; let nc=c as i32+dc;
            if nr>=0&&nc>=0&&(nr as usize)<rows&&(nc as usize)<cols {
                let (nr,nc)=(nr as usize,nc as usize);
                if rooms[nr][nc]==INF { rooms[nr][nc]=rooms[r][c]+1; q.push_back((nr,nc)); }
            }
        }
    }
}
```

#### Go

`1<<31 - 1` for `INF` — `math.MaxInt32` would work too but the bit-shift form is more concise. `container/list` queue.

```go
import "container/list"

func wallsAndGates(rooms [][]int) {
    rows, cols := len(rooms), len(rooms[0])
    const INF = 1<<31 - 1
    q := list.New()
    for r := 0; r < rows; r++ {
        for c := 0; c < cols; c++ {
            if rooms[r][c] == 0 { q.PushBack([2]int{r,c}) }
        }
    }
    for q.Len() > 0 {
        e := q.Front(); q.Remove(e)
        pos := e.Value.([2]int)
        r, c := pos[0], pos[1]
        for _, d := range [][2]int{{0,1},{0,-1},{1,0},{-1,0}} {
            nr, nc := r+d[0], c+d[1]
            if nr>=0&&nc>=0&&nr<rows&&nc<cols&&rooms[nr][nc]==INF {
                rooms[nr][nc]=rooms[r][c]+1; q.PushBack([2]int{nr,nc})
            }
        }
    }
}
```

#### C++

`INT_MAX` from `<climits>` is the sentinel. Multi-source seeding in the initial loop, BFS waves outward.

```cpp
#include <vector>
#include <queue>
#include <climits>

void wallsAndGates(std::vector<std::vector<int>>& rooms) {
    int rows = rooms.size(), cols = rooms[0].size();
    std::queue<std::pair<int,int>> q;
    for (int r=0;r<rows;r++) for (int c=0;c<cols;c++) if (rooms[r][c]==0) q.push({r,c});
    while (!q.empty()) {
        auto [r,c] = q.front(); q.pop();
        for (auto [dr,dc] : std::vector<std::pair<int,int>>{{0,1},{0,-1},{1,0},{-1,0}}) {
            int nr=r+dr, nc=c+dc;
            if (nr>=0&&nc>=0&&nr<rows&&nc<cols&&rooms[nr][nc]==INT_MAX) {
                rooms[nr][nc]=rooms[r][c]+1; q.push({nr,nc});
            }
        }
    }
}
```


### 90. Course Schedule

#### Problem
Given `numCourses` and a list of prerequisite pairs `[a, b]` meaning you must take course `b` before `a`, determine if it's possible to finish all courses (i.e., the prerequisite graph has no cycle).

#### Examples

```text
Input: numCourses = 2, prerequisites = [[1,0]]
Output: true
Explanation: take course 0, then course 1.

Input: numCourses = 2, prerequisites = [[1,0],[0,1]]
Output: false
Explanation: each course requires the other.

Input: numCourses = 3, prerequisites = []
Output: true

Constraints:
- 1 <= numCourses <= 2000
- 0 <= prerequisites.length <= 5000
- 0 <= a, b < numCourses
- all prerequisite pairs are distinct
```

#### Recognition
**Signals.** The literal word *prerequisite* plus a directed pair `[a, b]` that reads right to left ("take `b` before `a`") is the topological-sort family. The ask is a bare yes/no, "is it possible to finish all courses", with no ordering requested, so only the cycle-detection half of that family is needed. `numCourses <= 2000` with up to 5000 pairs puts one linear pass over the graph well inside budget. **Therefore.** Depth-first search with a three-state mark: unvisited, on the current path, finished. Reaching a node that is on the current path is a back edge, which is exactly a circular dependency. **Not union-find**, which is blind to direction: it merges `0 -> 1` and `1 -> 0` into the same component either way, so a legal chain and an illegal cycle look identical to it. **Not a single visited set**, which cannot separate "on the current path" from "finished on an earlier path", so it cries cycle on a diamond where courses 1 and 2 both require 0 and course 3 requires both. **O(V+E)** time, **O(V+E)** space.

#### Explanation
**Brute force.** Repeatedly sweep for a course whose prerequisites are all done.

```python
def canFinish(numCourses, prerequisites):
    remaining = list(range(numCourses))
    progress, done = True, set()
    while progress:
        progress = False
        for c in list(remaining):
            if all(b in done for a, b in prerequisites if a == c):
                done.add(c)
                remaining.remove(c)
                progress = True
    return not remaining
```

`O(V^2 E)` time, `O(V)` space.

**Wasteful because.** Every sweep re-filters the whole prerequisite list for every unfinished course, re-answering "are all of `c`'s prerequisites done?" from scratch. Only the courses finished in the previous sweep can have changed any of those answers, and the sweep ignores that.

**Optimal.** Ask the question once per edge instead. Build the adjacency list `a -> its prerequisites`, then run one DFS per course. The `visiting` set holds the courses on the current recursion path, so hitting a member of it means the path came back to itself: a cycle, return false. On the way out a course is removed from `visiting` and its adjacency list is cleared, which memoises "this course is verified safe" so a later DFS short-circuits on the empty list instead of re-descending. Every edge is therefore walked at most once. Kahn's BFS with in-degree counting is the equally good alternative, and it wins when you also want the order itself, which is exactly problem #91.

**Edge cases.** A self-loop `[0,0]` means a course requires itself and must return false. Courses that appear in no pair still need checking, which is what looping `c` over the full range buys. An empty prerequisite list is always finishable. Note the recursion depth: a 2000-course chain recurses 2000 frames and exceeds Python's default 1000-frame limit, so the iterative Kahn's formulation is the safer choice at that scale.

#### Python

Two-state via Python set (`visiting`) plus the trick of clearing `adj[c] = []` to memoize 'done'. Empty adjacency list short-circuits to True.

```python
def canFinish(numCourses, prerequisites):
    adj = [[] for _ in range(numCourses)]
    for a, b in prerequisites:
        adj[a].append(b)
    visiting = set()
    def dfs(c):
        if c in visiting:
            return False
        if not adj[c]:
            return True
        visiting.add(c)
        for pre in adj[c]:
            if not dfs(pre):
                return False
        visiting.remove(c)
        adj[c] = []
        return True
    return all(dfs(c) for c in range(numCourses))
```

#### Java

Three-state coloring via a `byte[]` (0=unvisited, 1=visiting, 2=done) is cleaner than the Python adjacency-clearing hack — hitting a `visiting` node means a back-edge (cycle). Build the adjacency list with `List<Integer>[]` and one pass over the pairs.

```java
import java.util.*;

class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) adj.add(new ArrayList<>());
        for (int[] p : prerequisites) adj.get(p[0]).add(p[1]);
        byte[] state = new byte[numCourses]; // 0=unvisited, 1=visiting, 2=done
        for (int c = 0; c < numCourses; c++)
            if (!dfs(c, adj, state)) return false;
        return true;
    }

    private boolean dfs(int c, List<List<Integer>> adj, byte[] state) {
        if (state[c] == 1) return false;
        if (state[c] == 2) return true;
        state[c] = 1;
        for (int nb : adj.get(c))
            if (!dfs(nb, adj, state)) return false;
        state[c] = 2;
        return true;
    }
}
```

#### Rust

Three-state coloring via `Vec<u8>` (0=unvisited, 1=visiting, 2=done) — cleaner than the Python adj-clearing hack. `(0..n).all(...)` for the outer pass.

```rust
fn can_finish(num_courses: i32, prerequisites: Vec<Vec<i32>>) -> bool {
    let n = num_courses as usize;
    let mut adj: Vec<Vec<usize>> = vec![vec![]; n];
    for p in &prerequisites { adj[p[0] as usize].push(p[1] as usize); }
    // 0=unvisited, 1=visiting, 2=done
    let mut state = vec![0u8; n];
    fn dfs(node: usize, adj: &Vec<Vec<usize>>, state: &mut Vec<u8>) -> bool {
        if state[node] == 1 { return false; }
        if state[node] == 2 { return true; }
        state[node] = 1;
        for &nb in &adj[node] { if !dfs(nb, adj, state) { return false; } }
        state[node] = 2;
        true
    }
    (0..n).all(|c| dfs(c, &adj, &mut state))
}
```

#### Go

Same three-state encoding via `[]int`. Closure recursion via `var dfs func(int) bool` declare-then-assign.

```go
func canFinish(numCourses int, prerequisites [][]int) bool {
    adj := make([][]int, numCourses)
    for _, p := range prerequisites { adj[p[0]] = append(adj[p[0]], p[1]) }
    // 0=unvisited, 1=visiting, 2=done
    state := make([]int, numCourses)
    var dfs func(c int) bool
    dfs = func(c int) bool {
        if state[c] == 1 { return false }
        if state[c] == 2 { return true }
        state[c] = 1
        for _, nb := range adj[c] { if !dfs(nb) { return false } }
        state[c] = 2
        return true
    }
    for c := 0; c < numCourses; c++ { if !dfs(c) { return false } }
    return true
}
```

#### C++

Three-state via `std::vector<int>`. `std::function<bool(int)>` lambda for the recursion — the type is needed for self-reference.

```cpp
#include <vector>

bool canFinish(int numCourses, std::vector<std::vector<int>>& prerequisites) {
    std::vector<std::vector<int>> adj(numCourses);
    for (auto& p : prerequisites) adj[p[0]].push_back(p[1]);
    std::vector<int> state(numCourses, 0); // 0=unvisited,1=visiting,2=done
    std::function<bool(int)> dfs = [&](int c) -> bool {
        if (state[c]==1) return false;
        if (state[c]==2) return true;
        state[c]=1;
        for (int nb : adj[c]) if (!dfs(nb)) return false;
        state[c]=2;
        return true;
    };
    for (int c=0;c<numCourses;c++) if (!dfs(c)) return false;
    return true;
}
```


### 91. Course Schedule II

#### Problem
Given `numCourses` and a list of `[course, prerequisite]` pairs, return a valid order to take all courses, or an empty array if a cycle makes it impossible.

#### Examples

```text
Input: numCourses = 2, prerequisites = [[1,0]]
Output: [0,1]
Explanation: course 1 needs course 0, so 0 goes first.

Input: numCourses = 3, prerequisites = [[1,0],[2,1]]
Output: [0,1,2]
Explanation: a straight chain, so only one order works.

Input: numCourses = 2, prerequisites = [[1,0],[0,1]]
Output: []

Constraints:
- 1 <= numCourses <= 2000
- 0 <= prerequisites.length <= numCourses * (numCourses - 1)
- 0 <= a, b < numCourses and a != b
- all prerequisite pairs are distinct
```

#### Recognition
**Signals.** The same prerequisite pairs as Course Schedule, but the ask moves from a boolean to "return a valid order", and LeetCode adds "if there are many valid answers, return any of them". That explicit admission of multiple answers is the DAG tell: an acyclic dependency graph normally has many topological orders and the problem wants only one. The empty-array fallback says cycle detection still has to happen. **Therefore.** Kahn's algorithm. Count each course's unmet prerequisites, seed a queue with the courses at zero, and emit a course the instant its count drops to zero. The emission sequence is the answer, and `len(res) == numCourses` is the cycle check for free. **Not a recursive DFS post-order**, which also produces a valid order but recurses to depth `V`, so a 2000-course chain overflows Python's default 1000-frame stack; it also needs its own three-state marking for the cycle case that Kahn's reads straight off a length. **O(V+E)** time, **O(V+E)** space.

#### Explanation
**Brute force.** Sweep repeatedly, appending any course whose prerequisites are all done.

```python
def findOrder(numCourses, prerequisites):
    order, done = [], set()
    progress = True
    while progress:
        progress = False
        for c in range(numCourses):
            if c in done:
                continue
            if all(b in done for a, b in prerequisites if a == c):
                done.add(c)
                order.append(c)
                progress = True
    return order if len(order) == numCourses else []
```

`O(V^2 E)` time, `O(V)` space.

**Wasteful because.** Each sweep rescans the entire prerequisite list for every course still outstanding, recomputing "is `c` ready?" from raw edges. Nothing about a course's readiness changes unless one of its own prerequisites was just finished, and the sweep has no way to notice that.

**Optimal.** Replace the rescan with a counter. `indegree[c]` holds how many prerequisites `c` still lacks, so "is `c` ready?" becomes reading one integer rather than filtering `E` pairs. Build the reverse adjacency `b -> the courses that depend on b`, so finishing `b` touches exactly the counters that can change, and each edge decrements exactly once across the whole run. That makes the total `O(V+E)`. Seed the queue with every zero-indegree course, which also covers disconnected components. If the queue drains before `numCourses` courses are emitted, every leftover still has an unmet prerequisite that is itself a leftover, and a finite set where everyone depends on someone inside it must contain a cycle, so `[]` is correct.

**Edge cases.** With no prerequisites, every permutation is valid and this returns `[0,1,...,n-1]`. A cycle returns `[]`, not a partial order. Courses named in no pair still appear, because the seed loop runs over the full range rather than over the keys of the adjacency map. If a follow-up asks for the lexicographically smallest valid order, swap the deque for a min-heap and pay `O(V log V + E)`.

#### Python

`adj.get(c, [])` is the defensive read — courses with no dependents won't be in `adj`. `len(res) == numCourses` distinguishes 'topo-sort complete' from 'stopped at a cycle'.

```python
from collections import deque

def findOrder(numCourses, prerequisites):
    adj = {}
    indegree = [0] * numCourses
    for a, b in prerequisites:
        if b not in adj:
            adj[b] = []
        adj[b].append(a)
        indegree[a] += 1
    q = deque(c for c in range(numCourses) if indegree[c] == 0)
    res = []
    while q:
        c = q.popleft()
        res.append(c)
        for nb in adj.get(c, []):
            indegree[nb] -= 1
            if indegree[nb] == 0:
                q.append(nb)
    return res if len(res) == numCourses else []
```

#### Java

`ArrayDeque` is the go-to FIFO queue — `offer`/`poll` beat the synchronized legacy `Stack`/`LinkedList`. Comparing `res.size() == numCourses` distinguishes a complete topological order from an early stop at a cycle.

```java
import java.util.*;

class Solution {
    public int[] findOrder(int numCourses, int[][] prerequisites) {
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) adj.add(new ArrayList<>());
        int[] indegree = new int[numCourses];
        for (int[] p : prerequisites) {
            adj.get(p[1]).add(p[0]);
            indegree[p[0]]++;
        }
        Deque<Integer> q = new ArrayDeque<>();
        for (int c = 0; c < numCourses; c++)
            if (indegree[c] == 0) q.offer(c);
        int[] res = new int[numCourses];
        int idx = 0;
        while (!q.isEmpty()) {
            int c = q.poll();
            res[idx++] = c;
            for (int nb : adj.get(c))
                if (--indegree[nb] == 0) q.offer(nb);
        }
        return idx == numCourses ? res : new int[0];
    }
}
```

#### Rust

`(0..n).filter(|&c| indegree[c] == 0).collect()` constructs the initial queue in one expression. Output is `Vec<i32>` per LeetCode signature, so the `as i32` cast happens at result push.

```rust
use std::collections::VecDeque;

fn find_order(num_courses: i32, prerequisites: Vec<Vec<i32>>) -> Vec<i32> {
    let n = num_courses as usize;
    let mut adj = vec![vec![]; n];
    let mut indegree = vec![0i32; n];
    for p in &prerequisites {
        let (a, b) = (p[0] as usize, p[1] as usize);
        adj[b].push(a);
        indegree[a] += 1;
    }
    let mut q: VecDeque<usize> = (0..n).filter(|&c| indegree[c] == 0).collect();
    let mut res = Vec::new();
    while let Some(c) = q.pop_front() {
        res.push(c as i32);
        for &nb in &adj[c] {
            indegree[nb] -= 1;
            if indegree[nb] == 0 {
                q.push_back(nb);
            }
        }
    }
    if res.len() == n { res } else { vec![] }
}
```

#### Go

Slice-as-queue with `q = q[1:]` for the pop. The Kahn's invariant — emit only when indegree hits zero — is identical across all four implementations.

```go
func findOrder(numCourses int, prerequisites [][]int) []int {
    adj := make([][]int, numCourses)
    indegree := make([]int, numCourses)
    for _, p := range prerequisites {
        a, b := p[0], p[1]
        adj[b] = append(adj[b], a)
        indegree[a]++
    }
    q := []int{}
    for c := 0; c < numCourses; c++ {
        if indegree[c] == 0 {
            q = append(q, c)
        }
    }
    res := []int{}
    for len(q) > 0 {
        c := q[0]
        q = q[1:]
        res = append(res, c)
        for _, nb := range adj[c] {
            indegree[nb]--
            if indegree[nb] == 0 {
                q = append(q, nb)
            }
        }
    }
    if len(res) == numCourses {
        return res
    }
    return []int{}
}
```

#### C++

`--indegree[nb] == 0` pre-decrement-and-test combines two operations. `std::queue<int>` adapter, no custom comparator needed.

```cpp
#include <vector>
#include <queue>

std::vector<int> findOrder(int numCourses, std::vector<std::vector<int>>& prerequisites) {
    std::vector<std::vector<int>> adj(numCourses);
    std::vector<int> indegree(numCourses, 0);
    for (auto& p : prerequisites) {
        adj[p[1]].push_back(p[0]);
        indegree[p[0]]++;
    }
    std::queue<int> q;
    for (int c = 0; c < numCourses; ++c)
        if (indegree[c] == 0) q.push(c);
    std::vector<int> res;
    while (!q.empty()) {
        int c = q.front(); q.pop();
        res.push_back(c);
        for (int nb : adj[c]) {
            if (--indegree[nb] == 0) q.push(nb);
        }
    }
    return (int)res.size() == numCourses ? res : std::vector<int>{};
}
```


### 92. Redundant Connection

#### Problem
Given a graph that started as a tree with one extra edge added, find and return that redundant edge. The graph has `n` nodes labeled `1` to `n`.

#### Examples

```text
Input: edges = [[1,2],[1,3],[2,3]]
Output: [2,3]
Explanation: 1-2-3-1 is the cycle; [2,3] closes it last.

Input: edges = [[1,2],[2,3],[3,4],[1,4],[1,5]]
Output: [1,4]

Input: edges = [[1,2],[2,3],[1,3],[1,4]]
Output: [1,3]
Explanation: the answer need not be the final input edge.

Constraints:
- n == edges.length and 3 <= n <= 1000
- 1 <= a < b <= n, no repeated edges
- the graph is connected: n nodes, n edges
```

#### Recognition
**Signals.** "Started as a tree with one extra edge added" pins the counts exactly: a tree on `n` nodes has `n-1` edges and the input has `n`, so there is precisely one cycle and precisely one edge that closes it. The edges are undirected and arrive in a fixed order, and the question is which edge closes the loop, so what you actually need per edge is incremental connectivity: are these two endpoints already in the same component? **Therefore.** Union-find. Walk the edges in input order, and the first `union` that fails because both endpoints already share a root is the answer. **Not the three-state DFS** from Course Schedule, because this graph is undirected, so every edge looks like a back edge to the node you just came from and the state machine needs a parent-exclusion patch to work at all; even then it hands you the cycle's nodes and you still have to map them back to input positions to pick the last edge. **O(n α(n))** time, **O(n)** space.

#### Explanation
**Brute force.** Before adding each edge, walk the graph so far to see if its endpoints already connect.

```python
def findRedundantConnection(edges):
    adj = {}
    for u, v in edges:
        seen, stack = {u}, [u]
        while stack:
            for y in adj.get(stack.pop(), []):
                if y not in seen:
                    seen.add(y)
                    stack.append(y)
        if v in seen:
            return [u, v]
        adj.setdefault(u, []).append(v)
        adj.setdefault(v, []).append(u)
```

`O(n^2)` time, `O(n)` space.

**Wasteful because.** Each edge re-walks an entire component from scratch to answer one yes/no question, rebuilding connectivity facts that the previous walks already established and then throwing them away.

**Optimal.** Store the answer instead of recomputing it. Give every component a single representative and keep a `parent` pointer per node; `find(x)` climbs to the representative, and two nodes are connected exactly when their representatives match, so the traversal collapses into a short pointer chase. Two tricks keep the chase short. Union by rank attaches the shorter tree under the taller one so the depth never grows unnecessarily, and path halving (`parent[x] = parent[parent[x]]` during the climb) flattens the path you just walked. Together they make each operation `O(α(n))`, inverse Ackermann, effectively constant. Because exactly one cycle exists, the first failing `union` is the edge that closed it, which is also the last edge of that cycle in input order, which is precisely the tie-break LeetCode asks for.

**Edge cases.** The answer is not always the final edge of the input: `[[1,2],[2,3],[1,3],[1,4]]` answers `[1,3]`. Nodes are labelled from 1, so `parent` must be sized `n+1` or every index is off by one. A three-node triangle is the smallest legal input. The graph is guaranteed connected with exactly one extra edge, so `union` fails exactly once and no not-found branch is needed.

#### Python

Path halving (`parent[x] = parent[parent[x]]`) inside `find` does compression without recursion. The `rank[px] += rank[py] == rank[px]` is the boolean-as-int trick — increments only when ranks were equal.

```python
def findRedundantConnection(edges):
    parent = list(range(len(edges) + 1))
    rank = [1] * (len(edges) + 1)

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        px, py = find(x), find(y)
        if px == py:
            return False
        if rank[px] < rank[py]:
            px, py = py, px
        parent[py] = px
        rank[px] += rank[py] == rank[px]
        return True

    for u, v in edges:
        if not union(u, v):
            return [u, v]
```

#### Java

Plain `int[]` for `parent`/`rank` — no boxing overhead. Java has no boolean-as-int coercion, so the rank tie increment is written as an explicit `if`.

```java
import java.util.*;

class Solution {
    private int[] parent, rank;

    private int find(int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }

    public int[] findRedundantConnection(int[][] edges) {
        int n = edges.length + 1;
        parent = new int[n];
        rank = new int[n];
        for (int i = 0; i < n; i++) { parent[i] = i; rank[i] = 1; }
        for (int[] e : edges) {
            int pu = find(e[0]), pv = find(e[1]);
            if (pu == pv) return new int[]{e[0], e[1]};
            if (rank[pu] < rank[pv]) { int t = pu; pu = pv; pv = t; }
            parent[pv] = pu;
            if (rank[pu] == rank[pv]) rank[pu]++;
        }
        return new int[0];
    }
}
```

#### Rust

Inner `fn find` instead of closure (closures-recursing-themselves is awkward). Three-branch rank-tie handling spelled out because Rust has no boolean-as-int coercion.

```rust
fn find_redundant_connection(edges: Vec<Vec<i32>>) -> Vec<i32> {
    let n = edges.len() + 1;
    let mut parent: Vec<usize> = (0..n).collect();
    let mut rank = vec![1usize; n];

    fn find(parent: &mut Vec<usize>, mut x: usize) -> usize {
        while parent[x] != x {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        x
    }

    for e in &edges {
        let (u, v) = (e[0] as usize, e[1] as usize);
        let pu = find(&mut parent, u);
        let pv = find(&mut parent, v);
        if pu == pv {
            return vec![e[0], e[1]];
        }
        if rank[pu] < rank[pv] {
            parent[pu] = pv;
        } else if rank[pu] > rank[pv] {
            parent[pv] = pu;
        } else {
            parent[pv] = pu;
            rank[pu] += 1;
        }
    }
    vec![]
}
```

#### Go

Closure for `find` via declare-then-assign. The first cycle-creating edge is the answer per the problem's tie-breaking rule.

```go
func findRedundantConnection(edges [][]int) []int {
    n := len(edges) + 1
    parent := make([]int, n)
    rank := make([]int, n)
    for i := range parent {
        parent[i] = i
        rank[i] = 1
    }
    var find func(int) int
    find = func(x int) int {
        for parent[x] != x {
            parent[x] = parent[parent[x]]
            x = parent[x]
        }
        return x
    }
    for _, e := range edges {
        pu, pv := find(e[0]), find(e[1])
        if pu == pv {
            return e
        }
        if rank[pu] < rank[pv] {
            parent[pu] = pv
        } else if rank[pu] > rank[pv] {
            parent[pv] = pu
        } else {
            parent[pv] = pu
            rank[pu]++
        }
    }
    return nil
}
```

#### C++

`std::iota` to fill the parent array `[0, 1, 2, ..., n-1]` — saves a manual loop. `std::swap(pu, pv)` to normalize the ranks before union.

```cpp
#include <vector>

std::vector<int> findRedundantConnection(std::vector<std::vector<int>>& edges) {
    int n = (int)edges.size() + 1;
    std::vector<int> parent(n), rank_(n, 1);
    std::iota(parent.begin(), parent.end(), 0);

    std::function<int(int)> find = [&](int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    };

    for (auto& e : edges) {
        int pu = find(e[0]), pv = find(e[1]);
        if (pu == pv) return {e[0], e[1]};
        if (rank_[pu] < rank_[pv]) std::swap(pu, pv);
        parent[pv] = pu;
        if (rank_[pu] == rank_[pv]) rank_[pu]++;
    }
    return {};
}
```


### 93. Number of Connected Components in an Undirected Graph

#### Problem
Given `n` nodes and a list of undirected edges, return the number of connected components in the graph.

#### Examples

TODO

#### Recognition
**Union-Find.** **O(n α(n))** time, **O(n)** space.

#### Explanation
Start with `n` isolated components. For each edge `(u, v)`, attempt to union the two nodes. If they already share a root, they are in the same component and the count doesn't change; if their roots differ, we merge and decrement the component count by 1. DFS/BFS works equally well at `O(V+E)`, but Union-Find is more concise and handles dynamic connectivity queries naturally. Path compression with union by rank keeps each operation near-constant. The final component count equals `n` minus the number of successful merges.

#### Python

`union` returns 0 (already connected) or 1 (newly merged); summing over edges gives the merge count. `n - sum(...)` is the component count.

```python
def countComponents(n, edges):
    parent = list(range(n))
    rank = [1] * n

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        px, py = find(x), find(y)
        if px == py:
            return 0
        if rank[px] < rank[py]:
            px, py = py, px
        parent[py] = px
        rank[px] += rank[py] == rank[px]
        return 1

    return n - sum(union(u, v) for u, v in edges)
```

#### Java

`int[]` arrays plus a helper `find` avoid the closure gymnastics the functional languages need. Decrementing `components` per successful merge is clearer than counting merges and subtracting.

```java
import java.util.*;

class Solution {
    private int[] parent, rank;

    private int find(int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }

    public int countComponents(int n, int[][] edges) {
        parent = new int[n];
        rank = new int[n];
        for (int i = 0; i < n; i++) { parent[i] = i; rank[i] = 1; }
        int components = n;
        for (int[] e : edges) {
            int pu = find(e[0]), pv = find(e[1]);
            if (pu != pv) {
                if (rank[pu] < rank[pv]) { int t = pu; pu = pv; pv = t; }
                parent[pv] = pu;
                if (rank[pu] == rank[pv]) rank[pu]++;
                components--;
            }
        }
        return components;
    }
}
```

#### Rust

Inner `fn find` with `&mut Vec<usize>`. The merge logic spells out the three rank cases explicitly instead of inlining the boolean trick.

```rust
fn count_components(n: i32, edges: Vec<Vec<i32>>) -> i32 {
    let n = n as usize;
    let mut parent: Vec<usize> = (0..n).collect();
    let mut rank = vec![1usize; n];

    fn find(parent: &mut Vec<usize>, mut x: usize) -> usize {
        while parent[x] != x {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        x
    }

    let mut components = n as i32;
    for e in &edges {
        let pu = find(&mut parent, e[0] as usize);
        let pv = find(&mut parent, e[1] as usize);
        if pu != pv {
            if rank[pu] < rank[pv] {
                parent[pu] = pv;
            } else if rank[pu] > rank[pv] {
                parent[pv] = pu;
            } else {
                parent[pv] = pu;
                rank[pu] += 1;
            }
            components -= 1;
        }
    }
    components
}
```

#### Go

Closure-based `find`. Decrement `components` per successful union — clearer than computing post-hoc.

```go
func countComponents(n int, edges [][]int) int {
    parent := make([]int, n)
    rank := make([]int, n)
    for i := range parent {
        parent[i] = i
        rank[i] = 1
    }
    var find func(int) int
    find = func(x int) int {
        for parent[x] != x {
            parent[x] = parent[parent[x]]
            x = parent[x]
        }
        return x
    }
    components := n
    for _, e := range edges {
        pu, pv := find(e[0]), find(e[1])
        if pu != pv {
            if rank[pu] < rank[pv] {
                parent[pu] = pv
            } else if rank[pu] > rank[pv] {
                parent[pv] = pu
            } else {
                parent[pv] = pu
                rank[pu]++
            }
            components--
        }
    }
    return components
}
```

#### C++

`std::iota(parent.begin(), parent.end(), 0)` initializes parents to identity. `std::swap` for rank-based union normalization.

```cpp
#include <vector>
#include <numeric>

int countComponents(int n, std::vector<std::vector<int>>& edges) {
    std::vector<int> parent(n), rank_(n, 1);
    std::iota(parent.begin(), parent.end(), 0);

    std::function<int(int)> find = [&](int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    };

    int components = n;
    for (auto& e : edges) {
        int pu = find(e[0]), pv = find(e[1]);
        if (pu != pv) {
            if (rank_[pu] < rank_[pv]) std::swap(pu, pv);
            parent[pv] = pu;
            if (rank_[pu] == rank_[pv]) rank_[pu]++;
            components--;
        }
    }
    return components;
}
```


### 94. Graph Valid Tree

#### Problem
Given `n` nodes labeled `0` to `n-1` and a list of undirected edges, determine whether they form a valid tree (connected and acyclic).

#### Examples

TODO

#### Recognition
**Union-Find (no cycle + connected).** **O(n α(n))** time, **O(n)** space.

#### Explanation
A valid tree on `n` nodes must satisfy exactly two conditions: it has `n-1` edges and contains no cycle. Checking the edge count first is a fast short-circuit — too many or too few edges fail immediately. Then we process each edge through Union-Find: if both endpoints already share the same root, adding this edge creates a cycle and we return `False`. If we union all `n-1` edges without conflict, the graph is both acyclic and connected (since a connected acyclic graph is exactly a tree). No need for a separate connectivity check because `n-1` edges with no cycle guarantees a spanning tree.

#### Python

Edge-count short-circuit (`if len(edges) != n - 1`) is the fast fail. Rank is omitted here because the asymptotic gain doesn't matter at LeetCode scales — plain `parent[pu] = pv` union works.

```python
def validTree(n, edges):
    if len(edges) != n - 1:
        return False
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for u, v in edges:
        pu, pv = find(u), find(v)
        if pu == pv:
            return False
        parent[pu] = pv
    return True
```

#### Java

The `edges.length != n - 1` short-circuit is the fast fail. With that guard plus the cycle check, plain `parent[pu] = pv` union (no rank) is enough — path halving in `find` keeps it fast.

```java
import java.util.*;

class Solution {
    private int[] parent;

    private int find(int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }

    public boolean validTree(int n, int[][] edges) {
        if (edges.length != n - 1) return false;
        parent = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;
        for (int[] e : edges) {
            int pu = find(e[0]), pv = find(e[1]);
            if (pu == pv) return false;
            parent[pu] = pv;
        }
        return true;
    }
}
```

#### Rust

Same simplified union — no rank tracking. The `if pu == pv` cycle check is the only acceptance criterion beyond edge count.

```rust
fn valid_tree(n: i32, edges: Vec<Vec<i32>>) -> bool {
    let n = n as usize;
    if edges.len() != n - 1 {
        return false;
    }
    let mut parent: Vec<usize> = (0..n).collect();

    fn find(parent: &mut Vec<usize>, mut x: usize) -> usize {
        while parent[x] != x {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        x
    }

    for e in &edges {
        let pu = find(&mut parent, e[0] as usize);
        let pv = find(&mut parent, e[1] as usize);
        if pu == pv {
            return false;
        }
        parent[pu] = pv;
    }
    true
}
```

#### Go

Plain union without rank; the path-halving compression in `find` keeps it fast enough. `for i := range parent` to initialize.

```go
func validTree(n int, edges [][]int) bool {
    if len(edges) != n-1 {
        return false
    }
    parent := make([]int, n)
    for i := range parent {
        parent[i] = i
    }
    var find func(int) int
    find = func(x int) int {
        for parent[x] != x {
            parent[x] = parent[parent[x]]
            x = parent[x]
        }
        return x
    }
    for _, e := range edges {
        pu, pv := find(e[0]), find(e[1])
        if pu == pv {
            return false
        }
        parent[pu] = pv
    }
    return true
}
```

#### C++

`std::iota` for the parent initialization. The simplified union shows that for tree-validity you don't need both the cycle check *and* rank — edge count + cycle check suffices.

```cpp
#include <vector>
#include <numeric>

bool validTree(int n, std::vector<std::vector<int>>& edges) {
    if ((int)edges.size() != n - 1) return false;
    std::vector<int> parent(n);
    std::iota(parent.begin(), parent.end(), 0);

    std::function<int(int)> find = [&](int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    };

    for (auto& e : edges) {
        int pu = find(e[0]), pv = find(e[1]);
        if (pu == pv) return false;
        parent[pu] = pv;
    }
    return true;
}
```


### 95. Word Ladder

#### Problem
Given `beginWord`, `endWord`, and a `wordList`, return the length of the shortest transformation sequence where each step changes exactly one letter and each intermediate word must be in the list. Return `0` if no such sequence exists.

#### Examples

```text
Input: beginWord = "hit", endWord = "cog",
       wordList = ["hot","dot","dog","lot","log","cog"]
Output: 5
Explanation: hit -> hot -> dot -> dog -> cog is 5 words.

Input: beginWord = "hit", endWord = "cog",
       wordList = ["hot","dot","dog","lot","log"]
Output: 0
Explanation: endWord is not in wordList.

Input: beginWord = "a", endWord = "c",
       wordList = ["a","b","c"]
Output: 2

Constraints:
- 1 <= beginWord.length <= 10
- endWord.length == beginWord.length
- 1 <= wordList.length <= 5000, words are unique
- all words are lowercase, beginWord != endWord
```

#### Recognition
**Signals.** "Shortest transformation sequence" where each step changes exactly one letter: every step costs the same, which is the unweighted-shortest-path tell. There is also no graph in the input, only a word list, which is the implicit-graph tell. Words are the nodes, one-letter edits are the edges, and you generate the neighbours rather than read them. Dictionary size `n <= 5000` against word length `m <= 10` decides *how* you generate them. **Therefore.** Breadth-first search from `beginWord`, where a word's neighbours are its `26 * m` single-letter mutations filtered through a set built from the dictionary. **Not DFS**, which finds *a* transformation sequence but has no reason to find the shortest, so you would have to enumerate every path and take the minimum. **Not an explicit all-pairs edge build**, which is `O(n^2 m)`, about 25 million word comparisons at `n = 5000`, against the at most 260 mutations BFS probes per word. **O(m² * n)** time, **O(m * n)** space.

#### Explanation
**Brute force.** BFS, but find each word's neighbours by scanning the whole dictionary.

```python
from collections import deque

def ladderLength(beginWord, endWord, wordList):
    if endWord not in wordList:
        return 0
    q, seen = deque([(beginWord, 1)]), {beginWord}
    while q:
        w, d = q.popleft()
        if w == endWord:
            return d
        for u in wordList:
            diff = sum(a != b for a, b in zip(w, u))
            if diff == 1 and u not in seen:
                seen.add(u)
                q.append((u, d + 1))
    return 0
```

`O(n^2 m)` time, `O(n m)` space.

**Wasteful because.** Every pop compares the current word against all `n` dictionary words at `O(m)` each, even though at most `26 * m` strings in the universe are one edit away from it. The scan cost is driven by the dictionary size, and the answer is not.

**Optimal.** Turn the neighbour search around. Instead of asking every dictionary word "are you one edit from me?", generate the `26 * m` strings that are one edit away and ask the set "do you contain this?". A hash set answers in `O(1)`, so a pop costs `26 * m` probes of `O(m)` each, which is `O(m²)` and does not grow with `n` at all. At `m <= 10` that is at most 260 probes versus 5000 comparisons. BFS still supplies the shortest-path guarantee: the first time `endWord` is generated, it is generated at the minimum possible depth, so returning `steps + 1` at generation time rather than waiting to dequeue it is correct and saves a level. The `visited` set is what keeps the work linear in edges rather than exponential in paths. If pushed further, bidirectional BFS expands from both ends and stops when the frontiers meet, turning `O(b^d)` into `O(b^(d/2))`.

**Edge cases.** If `endWord` is absent from `wordList` the answer is 0, and testing that first avoids a full pointless search. `beginWord` does not have to be in `wordList`, but it still counts as the first word in the length. The mutation loop regenerates the word itself, which is harmless because it is already in `visited`. Dictionary words in no connected component are simply never enqueued.

#### Python

Generate all `26 * len(word)` neighbors per step — faster than precomputing edges for short words. Checking `endWord` at generation time saves one BFS level.

```python
from collections import deque

def ladderLength(beginWord, endWord, wordList):
    wordSet = set(wordList)
    if endWord not in wordSet:
        return 0
    q = deque([(beginWord, 1)])
    visited = {beginWord}
    while q:
        word, steps = q.popleft()
        for i in range(len(word)):
            for c in "abcdefghijklmnopqrstuvwxyz":
                next_word = word[:i] + c + word[i+1:]
                if next_word == endWord:
                    return steps + 1
                if next_word in wordSet and next_word not in visited:
                    visited.add(next_word)
                    q.append((next_word, steps + 1))
    return 0
```

#### Java

Mutate a `char[]` in place then restore the original char — avoids the per-candidate String allocation, then `new String(chars)` keys the set lookup. A single `HashSet` doubles as dictionary and visited-set once words are removed on visit.

```java
import java.util.*;

class Solution {
    public int ladderLength(String beginWord, String endWord, List<String> wordList) {
        Set<String> wordSet = new HashSet<>(wordList);
        if (!wordSet.contains(endWord)) return 0;
        Deque<String> q = new ArrayDeque<>();
        q.offer(beginWord);
        Set<String> visited = new HashSet<>();
        visited.add(beginWord);
        int steps = 1;
        while (!q.isEmpty()) {
            int size = q.size();
            for (int s = 0; s < size; s++) {
                String word = q.poll();
                if (word.equals(endWord)) return steps;
                char[] chars = word.toCharArray();
                for (int i = 0; i < chars.length; i++) {
                    char orig = chars[i];
                    for (char c = 'a'; c <= 'z'; c++) {
                        chars[i] = c;
                        String next = new String(chars);
                        if (wordSet.contains(next) && !visited.contains(next)) {
                            visited.add(next);
                            q.offer(next);
                        }
                    }
                    chars[i] = orig;
                }
            }
            steps++;
        }
        return 0;
    }
}
```

#### Rust

Allocating `bytes.clone()` per candidate is wasteful — production code would use a buffer with a single byte mutation. The clarity wins here for an interview-style solution.

```rust
use std::collections::{HashSet, VecDeque};

fn ladder_length(begin_word: String, end_word: String, word_list: Vec<String>) -> i32 {
    let word_set: HashSet<String> = word_list.into_iter().collect();
    if !word_set.contains(&end_word) {
        return 0;
    }
    let mut visited: HashSet<String> = HashSet::new();
    let mut q: VecDeque<(String, i32)> = VecDeque::new();
    q.push_back((begin_word.clone(), 1));
    visited.insert(begin_word);
    let chars: Vec<char> = "abcdefghijklmnopqrstuvwxyz".chars().collect();
    while let Some((word, steps)) = q.pop_front() {
        let bytes: Vec<u8> = word.bytes().collect();
        for i in 0..bytes.len() {
            for &c in &chars {
                let mut next = bytes.clone();
                next[i] = c as u8;
                let next_word = String::from_utf8(next).unwrap();
                if next_word == end_word {
                    return steps + 1;
                }
                if word_set.contains(&next_word) && !visited.contains(&next_word) {
                    visited.insert(next_word.clone());
                    q.push_back((next_word, steps + 1));
                }
            }
        }
    }
    0
}
```

#### Go

Mutate `bs[i]` in place then restore via `orig` — avoids the per-candidate allocation that Rust suffers. `string(bs)` to hash-key the result.

```go
func ladderLength(beginWord string, endWord string, wordList []string) int {
    wordSet := make(map[string]bool)
    for _, w := range wordList {
        wordSet[w] = true
    }
    if !wordSet[endWord] {
        return 0
    }
    type entry struct {
        word  string
        steps int
    }
    visited := map[string]bool{beginWord: true}
    q := []entry{{beginWord, 1}}
    for len(q) > 0 {
        cur := q[0]
        q = q[1:]
        bs := []byte(cur.word)
        for i := 0; i < len(bs); i++ {
            orig := bs[i]
            for c := byte('a'); c <= 'z'; c++ {
                bs[i] = c
                next := string(bs)
                if next == endWord {
                    return cur.steps + 1
                }
                if wordSet[next] && !visited[next] {
                    visited[next] = true
                    q = append(q, entry{next, cur.steps + 1})
                }
            }
            bs[i] = orig
        }
    }
    return 0
}
```

#### C++

Mutate `word[i]` in place then restore — same in-place trick as Go. `wordSet.count(word)` returns 0 or 1; structured binding `auto [word, steps] = q.front()` destructures the queue entry.

```cpp
#include <vector>
#include <string>
#include <unordered_set>
#include <queue>

int ladderLength(std::string beginWord, std::string endWord, std::vector<std::string>& wordList) {
    std::unordered_set<std::string> wordSet(wordList.begin(), wordList.end());
    if (!wordSet.count(endWord)) return 0;
    std::queue<std::pair<std::string, int>> q;
    q.push({beginWord, 1});
    std::unordered_set<std::string> visited{beginWord};
    while (!q.empty()) {
        auto [word, steps] = q.front(); q.pop();
        for (int i = 0; i < (int)word.size(); ++i) {
            char orig = word[i];
            for (char c = 'a'; c <= 'z'; ++c) {
                word[i] = c;
                if (word == endWord) return steps + 1;
                if (wordSet.count(word) && !visited.count(word)) {
                    visited.insert(word);
                    q.push({word, steps + 1});
                }
            }
            word[i] = orig;
        }
    }
    return 0;
}
```


### 96. Reconstruct Itinerary

#### Problem
Given a list of airline tickets `[from, to]`, reconstruct the full itinerary starting from `"JFK"` using all tickets exactly once. When multiple itineraries exist, return the one with the smallest lexical order.

#### Examples

TODO

#### Recognition
**Hierholzer's algorithm (Eulerian path, iterative DFS).** **O(E log E)** time, **O(E)** space.

#### Explanation
This is an Eulerian path problem: find a path that visits every edge exactly once. Hierholzer's algorithm does it in linear time on the edge count. By sorting destinations in reverse order and using a stack/list as an adjacency list we pop from, each `pop()` always picks the lexicographically smallest next destination greedily. A node is appended to `res` only once all its outgoing edges are exhausted. Reversing `res` at the end gives the correct forward order. The recursive DFS here has Python stack depth risk on large inputs; an iterative version with an explicit stack is safer in practice.

#### Python

Pre-sorting tickets in *reverse* order means `pop()` always pulls the lex-smallest destination — clever inversion that turns list pop into greedy choice. Final `res[::-1]` reverses the postorder.

```python
def findItinerary(tickets):
    adj = {}
    for src, dst in sorted(tickets, reverse=True):
        if src not in adj:
            adj[src] = []
        adj[src].append(dst)
    res = []
    stack = ["JFK"]
    while stack:
        while adj.get(stack[-1]):
            stack.append(adj[stack[-1]].pop())
        res.append(stack.pop())
    return res[::-1]
```

#### Java

A `PriorityQueue` per source keeps destinations in lexical order, so `poll()` always pulls the smallest next hop — no pre-sorting pass needed. A node is appended to the result only once its edges are exhausted, then the list is reversed.

```java
import java.util.*;

class Solution {
    public List<String> findItinerary(List<List<String>> tickets) {
        Map<String, PriorityQueue<String>> adj = new HashMap<>();
        for (List<String> t : tickets)
            adj.computeIfAbsent(t.get(0), k -> new PriorityQueue<>()).offer(t.get(1));
        LinkedList<String> res = new LinkedList<>();
        Deque<String> stack = new ArrayDeque<>();
        stack.push("JFK");
        while (!stack.isEmpty()) {
            String top = stack.peek();
            PriorityQueue<String> dsts = adj.get(top);
            if (dsts != null && !dsts.isEmpty()) {
                stack.push(dsts.poll());
            } else {
                res.addFirst(stack.pop());
            }
        }
        return res;
    }
}
```

#### Rust

`BTreeMap` + `BinaryHeap<Reverse<String>>` per node — the heap gives lex-smallest pop. The `stack.last().cloned()` borrow workaround is annoying but avoids holding the borrow during `pop`.

```rust
use std::collections::BTreeMap;

fn find_itinerary(tickets: Vec<Vec<String>>) -> Vec<String> {
    let mut adj: BTreeMap<String, std::collections::BinaryHeap<std::cmp::Reverse<String>>> =
        BTreeMap::new();
    for t in &tickets {
        adj.entry(t[0].clone())
            .or_default()
            .push(std::cmp::Reverse(t[1].clone()));
    }
    let mut stack = vec!["JFK".to_string()];
    let mut res = Vec::new();
    while let Some(top) = stack.last().cloned() {
        if let Some(heap) = adj.get_mut(&top) {
            if let Some(std::cmp::Reverse(next)) = heap.pop() {
                stack.push(next);
                continue;
            }
        }
        res.push(stack.pop().unwrap());
    }
    res.reverse();
    res
}
```

#### Go

`sort.Reverse(sort.StringSlice(adj[k]))` sorts each adjacency list once; then `pop` from the back is the smallest. Manual reverse loop at the end.

```go
import "sort"

func findItinerary(tickets [][]string) []string {
    adj := map[string][]string{}
    for _, t := range tickets {
        adj[t[0]] = append(adj[t[0]], t[1])
    }
    for k := range adj {
        sort.Sort(sort.Reverse(sort.StringSlice(adj[k])))
    }
    var res []string
    stack := []string{"JFK"}
    for len(stack) > 0 {
        top := stack[len(stack)-1]
        if dsts := adj[top]; len(dsts) > 0 {
            stack = append(stack, dsts[len(dsts)-1])
            adj[top] = dsts[:len(dsts)-1]
        } else {
            res = append(res, top)
            stack = stack[:len(stack)-1]
        }
    }
    // reverse
    for i, j := 0, len(res)-1; i < j; i, j = i+1, j-1 {
        res[i], res[j] = res[j], res[i]
    }
    return res
}
```

#### C++

`std::map<std::string, std::vector<std::string>>` keyed by source. `std::sort` with `std::greater<std::string>` puts lex-smallest at the back for `pop_back` to grab.

```cpp
#include <vector>
#include <string>
#include <map>
#include <algorithm>

std::vector<std::string> findItinerary(std::vector<std::vector<std::string>>& tickets) {
    std::map<std::string, std::vector<std::string>> adj;
    for (auto& t : tickets)
        adj[t[0]].push_back(t[1]);
    for (auto& [k, v] : adj)
        std::sort(v.begin(), v.end(), std::greater<std::string>());
    std::vector<std::string> res;
    std::vector<std::string> stack{"JFK"};
    while (!stack.empty()) {
        std::string& top = stack.back();
        auto it = adj.find(top);
        if (it != adj.end() && !it->second.empty()) {
            stack.push_back(it->second.back());
            it->second.pop_back();
        } else {
            res.push_back(top);
            stack.pop_back();
        }
    }
    std::reverse(res.begin(), res.end());
    return res;
}
```


### 97. Min Cost to Connect All Points

#### Problem
Given an array of points on a 2-D plane, return the minimum cost to connect all points, where the cost between two points is their Manhattan distance. Each point must be connected (directly or indirectly) to every other.

#### Examples

```text
Input: points = [[0,0],[2,2],[3,10],[5,2],[7,0]]
Output: 20
Explanation: 4 + 4 + 4 + 8 links all five points.

Input: points = [[3,12],[-2,5],[-4,1]]
Output: 18
Explanation: 6 joins the lower pair, 12 attaches [3,12].

Input: points = [[0,0]]
Output: 0

Constraints:
- 1 <= points.length <= 1000
- -10^6 <= xi, yi <= 10^6
- all points are distinct
```

#### Recognition
**Signals.** "Connect all points" at "minimum cost", with every point reachable from every other directly or indirectly: a connected subgraph of minimum total weight is by definition a minimum spanning tree, not a shortest path. The cost between two points is given by a formula rather than an edge list, so the graph is implicit and complete. `points.length <= 1000` makes that about 500,000 candidate edges, which is dense, and dense is the fact that picks the algorithm. **Therefore.** Prim's algorithm, grown from any starting point, repeatedly taking the cheapest edge that crosses from the built tree to a point outside it, with a min-heap holding the candidates. **Not Kruskal**, the other MST algorithm, which has to materialise and sort all 500,000 edges before it can accept the first one, whereas Prim only ever holds edges out of the points it has actually reached. **Not Dijkstra**, which from a distance looks identical (heap, greedy, relax) but minimises distance *from a source*; a shortest-path tree can cost strictly more than an MST. **O(n² log n)** time, **O(n²)** space.

#### Explanation
**Brute force.** Grow the tree one point at a time, rescanning all pairs for the cheapest link.

```python
def minCostConnectPoints(points):
    n = len(points)
    inTree = [True] + [False] * (n - 1)
    cost = 0
    for _ in range(n - 1):
        best = (float("inf"), -1)
        for i in range(n):
            for j in range(n):
                if inTree[i] and not inTree[j]:
                    d = (abs(points[i][0] - points[j][0])
                         + abs(points[i][1] - points[j][1]))
                    best = min(best, (d, j))
        cost += best[0]
        inTree[best[1]] = True
    return cost
```

`O(n^3)` time, `O(n)` space.

**Wasteful because.** Every round recomputes all `n²` pairwise distances to extract a single minimum, and almost all of them are unchanged since the previous round. Adding one point to the tree can only introduce `n` new crossing edges, so recomputing the other `n² - n` is pure repetition.

**Optimal.** Keep the crossing edges in a min-heap instead of rediscovering them. When point `i` joins the tree, push its distance to every point still outside; the cheapest crossing edge is then one `heappop` rather than an `n²` scan. Edges whose target has since been absorbed are left in the heap and skipped when popped, which is lazy deletion, and it beats hunting through the heap to remove them. Each point contributes at most `n` pushes, so the heap holds `O(n²)` entries at `O(log n)` each, hence `O(n² log n)`. Correctness is the cut property: the minimum-weight edge crossing any cut between visited and unvisited points is always safe to add to some MST, so a greedy pick never needs revisiting. Where a different choice wins: Kruskal, when the edge list is explicit and sparse, and here the array-based Prim, which stores one best-known distance per point and takes the minimum by linear scan, is `Θ(n²)` with no heap at all.

**Edge cases.** A single point costs 0 and the main loop never runs. Manhattan distance, not Euclidean: the `|dx| + |dy|` choice can select a different tree, and squaring or square-rooting the terms is a different problem. Ties between equal-cost edges are safe because any of them belongs to some MST and the total is unique. All points are distinct, so no zero-length edge can inflate the heap.

#### Python

Lazy deletion: stale heap entries are skipped via the `if i in visited` guard. Manhattan distance because the problem specifies it; squared Euclidean would be a different MST.

```python
import heapq

def minCostConnectPoints(points):
    n = len(points)
    visited = set()
    heap = [(0, 0)]
    cost = 0
    while len(visited) < n:
        c, i = heapq.heappop(heap)
        if i in visited:
            continue
        visited.add(i)
        cost += c
        for j in range(n):
            if j not in visited:
                d = abs(points[i][0] - points[j][0]) + abs(points[i][1] - points[j][1])
                heapq.heappush(heap, (d, j))
    return cost
```

#### Java

`PriorityQueue` is a min-heap by default, so `int[]{cost, idx}` entries with a `cost`-keyed `Comparator` pop the cheapest edge first. A `boolean[] inMST` gives the lazy-deletion guard — stale entries are skipped when popped.

```java
import java.util.*;

class Solution {
    public int minCostConnectPoints(int[][] points) {
        int n = points.length;
        boolean[] inMST = new boolean[n];
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> a[0] - b[0]);
        heap.offer(new int[]{0, 0});
        int cost = 0, count = 0;
        while (count < n) {
            int[] cur = heap.poll();
            int c = cur[0], i = cur[1];
            if (inMST[i]) continue;
            inMST[i] = true;
            cost += c;
            count++;
            for (int j = 0; j < n; j++) {
                if (!inMST[j]) {
                    int d = Math.abs(points[i][0] - points[j][0])
                          + Math.abs(points[i][1] - points[j][1]);
                    heap.offer(new int[]{d, j});
                }
            }
        }
        return cost;
    }
}
```

#### Rust

`Reverse((cost, idx))` for the min-heap behavior. The `if visited.contains(&i) { continue; }` is the lazy-deletion check.

```rust
use std::collections::{BinaryHeap, HashSet};
use std::cmp::Reverse;

fn min_cost_connect_points(points: Vec<Vec<i32>>) -> i32 {
    let n = points.len();
    let mut visited = HashSet::new();
    let mut heap = BinaryHeap::new();
    heap.push(Reverse((0i32, 0usize)));
    let mut cost = 0;
    while visited.len() < n {
        let Reverse((c, i)) = heap.pop().unwrap();
        if visited.contains(&i) { continue; }
        visited.insert(i);
        cost += c;
        for j in 0..n {
            if !visited.contains(&j) {
                let d = (points[i][0] - points[j][0]).abs()
                      + (points[i][1] - points[j][1]).abs();
                heap.push(Reverse((d, j)));
            }
        }
    }
    cost
}
```

#### Go

Slice `[]bool` for visited (faster than map for `usize` indices). Custom `pairHeap` since Go heap requires interface implementation.

```go
import "container/heap"

type intPair struct{ cost, idx int }
type pairHeap []intPair
func (h pairHeap) Len() int            { return len(h) }
func (h pairHeap) Less(i, j int) bool { return h[i].cost < h[j].cost }
func (h pairHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *pairHeap) Push(x interface{}) { *h = append(*h, x.(intPair)) }
func (h *pairHeap) Pop() interface{} {
    old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x
}

func abs(x int) int {
    if x < 0 { return -x }
    return x
}

func minCostConnectPoints(points [][]int) int {
    n := len(points)
    visited := make([]bool, n)
    h := &pairHeap{{0, 0}}
    heap.Init(h)
    cost := 0
    for count := 0; count < n; {
        p := heap.Pop(h).(intPair)
        if visited[p.idx] { continue }
        visited[p.idx] = true
        cost += p.cost
        count++
        for j := 0; j < n; j++ {
            if !visited[j] {
                d := abs(points[p.idx][0]-points[j][0]) + abs(points[p.idx][1]-points[j][1])
                heap.Push(h, intPair{d, j})
            }
        }
    }
    return cost
}
```

#### C++

`std::priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>>` — the verbose min-heap declaration. `std::unordered_set<int>` for visited.

```cpp
#include <vector>
#include <queue>
#include <unordered_set>
#include <cmath>

int minCostConnectPoints(std::vector<std::vector<int>>& points) {
    int n = (int)points.size();
    std::priority_queue<std::pair<int,int>, std::vector<std::pair<int,int>>,
                        std::greater<>> heap;
    heap.push({0, 0});
    std::unordered_set<int> visited;
    int cost = 0;
    while ((int)visited.size() < n) {
        auto [c, i] = heap.top(); heap.pop();
        if (visited.count(i)) continue;
        visited.insert(i);
        cost += c;
        for (int j = 0; j < n; ++j) {
            if (!visited.count(j)) {
                int d = std::abs(points[i][0] - points[j][0])
                      + std::abs(points[i][1] - points[j][1]);
                heap.push({d, j});
            }
        }
    }
    return cost;
}
```


### 98. Network Delay Time

#### Problem
Given a directed weighted graph with `n` nodes and edges `[u, v, w]`, find the minimum time for all nodes to receive a signal sent from node `k`. Return `-1` if any node is unreachable.

#### Examples

```text
Input: times = [[2,1,1],[2,3,1],[3,4,1]], n = 4, k = 2
Output: 2
Explanation: nodes 1 and 3 hear at time 1, node 4 at time 2.

Input: times = [[1,2,1]], n = 2, k = 1
Output: 1

Input: times = [[1,2,1]], n = 2, k = 2
Output: -1
Explanation: node 1 is not reachable from node 2.

Constraints:
- 1 <= k <= n <= 100, nodes are labelled 1..n
- 1 <= times.length <= 6000
- 0 <= w <= 100, all (u, v) pairs are distinct
```

#### Recognition
**Signals.** "Directed weighted graph", one fixed origin `k`, and edge triples `[u, v, w]` where `w` is a travel time and is never negative. That is the Dijkstra fingerprint: single source plus non-negative weights means the first time the heap pops a node, its distance is final and nothing later can undercut it. The second tell is "the minimum time for **all** nodes to receive a signal". That is not a path query, it is an aggregate over every shortest path, so the answer is the largest of them, and unreachability is a size check on the distance table rather than a special case. **Therefore.** Dijkstra from `k` with a min-heap, answer `max(dist)` once `len(dist) == n`. **Not BFS**, which minimises hop count, so it would happily prefer one 100-unit edge over a two-edge route costing 2. **Not Bellman-Ford**, which is correct here but pays `O(V*E)` to buy a negative-weight guarantee this problem never needs. **O((V+E) log V)** time, **O(V+E)** space.

#### Explanation
**Brute force.** Walk every route out of `k`, keeping the best arrival time seen per node.

```python
def networkDelayTime(times, n, k):
    best = {}
    def dfs(u, t):
        if u in best and best[u] <= t:
            return
        best[u] = t
        for a, b, w in times:
            if a == u:
                dfs(b, t + w)
    dfs(k, 0)
    return max(best.values()) if len(best) == n else -1
```

`O(V*E)` time, `O(V)` space.

**Wasteful because.** Every recursive step rescans the entire `times` list just to find the edges leaving `u`, and a node is re-expanded together with its whole downstream subgraph each time a cheaper route into it turns up. The same suffix of the graph gets walked again and again.

**Optimal.** Two fixes. Build adjacency lists once, so finding the edges out of `u` costs `O(deg u)` instead of `O(E)`. Then kill the re-expansion by controlling the order in which nodes are settled: a min-heap keyed on distance always hands back the nearest unsettled node, and since no weight is negative, no route discovered later can beat it. So the first pop of a node is final and it is expanded exactly once. Python's `heapq` has no decrease-key, so rather than update an entry you push a second one and discard the stale pop with `if u in dist: continue`. The answer is then `max(dist.values())`, the node that hears last.

**Edge cases.** A node with no outgoing edges is fine, `adj.get(u, [])` returns empty. Labels run `1..n`, so `len(dist) < n` is the unreachable test. Zero-weight edges are legal and harmless. With `n == 1` the source is the only node and the answer is 0.

#### Python

Lazy deletion via `if u in dist: continue` — once a node has a finalized distance, ignore stale heap entries. `max(dist.values())` is the network's bottleneck node.

```python
import heapq

def networkDelayTime(times, n, k):
    adj = {}
    for u, v, w in times:
        if u not in adj:
            adj[u] = []
        adj[u].append((v, w))
    dist = {}
    heap = [(0, k)]
    while heap:
        d, u = heapq.heappop(heap)
        if u in dist:
            continue
        dist[u] = d
        for v, w in adj.get(u, []):
            if v not in dist:
                heapq.heappush(heap, (d + w, v))
    return max(dist.values()) if len(dist) == n else -1
```

#### Java

`PriorityQueue<int[]>` with a `dist`-keyed comparator is the min-heap; a `dist` map plus `containsKey` gives lazy deletion. `computeIfAbsent` builds the adjacency lists in one call.

```java
import java.util.*;

class Solution {
    public int networkDelayTime(int[][] times, int n, int k) {
        Map<Integer, List<int[]>> adj = new HashMap<>();
        for (int[] t : times)
            adj.computeIfAbsent(t[0], x -> new ArrayList<>()).add(new int[]{t[1], t[2]});
        Map<Integer, Integer> dist = new HashMap<>();
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> a[0] - b[0]);
        heap.offer(new int[]{0, k});
        while (!heap.isEmpty()) {
            int[] cur = heap.poll();
            int d = cur[0], u = cur[1];
            if (dist.containsKey(u)) continue;
            dist.put(u, d);
            for (int[] e : adj.getOrDefault(u, List.of())) {
                if (!dist.containsKey(e[0]))
                    heap.offer(new int[]{d + e[1], e[0]});
            }
        }
        if (dist.size() != n) return -1;
        int ans = 0;
        for (int d : dist.values()) ans = Math.max(ans, d);
        return ans;
    }
}
```

#### Rust

`Reverse((d, u))` for min-heap; lazy deletion via `dist.contains_key`. `dist.values().max().unwrap()` for the final aggregation.

```rust
use std::collections::{BinaryHeap, HashMap};
use std::cmp::Reverse;

fn network_delay_time(times: Vec<Vec<i32>>, n: i32, k: i32) -> i32 {
    let mut adj: HashMap<i32, Vec<(i32, i32)>> = HashMap::new();
    for t in &times {
        adj.entry(t[0]).or_default().push((t[1], t[2]));
    }
    let mut dist: HashMap<i32, i32> = HashMap::new();
    let mut heap = BinaryHeap::new();
    heap.push(Reverse((0i32, k)));
    while let Some(Reverse((d, u))) = heap.pop() {
        if dist.contains_key(&u) { continue; }
        dist.insert(u, d);
        if let Some(neighbors) = adj.get(&u) {
            for &(v, w) in neighbors {
                if !dist.contains_key(&v) {
                    heap.push(Reverse((d + w, v)));
                }
            }
        }
    }
    if dist.len() == n as usize {
        *dist.values().max().unwrap()
    } else {
        -1
    }
}
```

#### Go

Custom `minHeap97` with item struct. The lazy-deletion check uses the comma-ok idiom `if _, ok := dist[cur.node]; ok`.

```go
import "container/heap"

type edge97 struct{ to, w int }
type item97 struct{ dist, node int }
type minHeap97 []item97
func (h minHeap97) Len() int            { return len(h) }
func (h minHeap97) Less(i, j int) bool { return h[i].dist < h[j].dist }
func (h minHeap97) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *minHeap97) Push(x interface{}) { *h = append(*h, x.(item97)) }
func (h *minHeap97) Pop() interface{} {
    old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x
}

func networkDelayTime(times [][]int, n int, k int) int {
    adj := make(map[int][]edge97)
    for _, t := range times {
        adj[t[0]] = append(adj[t[0]], edge97{t[1], t[2]})
    }
    dist := make(map[int]int)
    h := &minHeap97{{0, k}}
    heap.Init(h)
    for h.Len() > 0 {
        cur := heap.Pop(h).(item97)
        if _, ok := dist[cur.node]; ok { continue }
        dist[cur.node] = cur.dist
        for _, e := range adj[cur.node] {
            if _, ok := dist[e.to]; !ok {
                heap.Push(h, item97{cur.dist + e.w, e.to})
            }
        }
    }
    if len(dist) != n { return -1 }
    maxD := 0
    for _, d := range dist {
        if d > maxD { maxD = d }
    }
    return maxD
}
```

#### C++

`std::greater<>` template parameter for the min-heap. `std::unordered_map<int, int>` for the distance table; `.count(u)` for the visited check.

```cpp
#include <vector>
#include <unordered_map>
#include <queue>
#include <climits>

int networkDelayTime(std::vector<std::vector<int>>& times, int n, int k) {
    std::unordered_map<int, std::vector<std::pair<int,int>>> adj;
    for (auto& t : times)
        adj[t[0]].push_back({t[1], t[2]});
    std::unordered_map<int, int> dist;
    std::priority_queue<std::pair<int,int>, std::vector<std::pair<int,int>>,
                        std::greater<>> heap;
    heap.push({0, k});
    while (!heap.empty()) {
        auto [d, u] = heap.top(); heap.pop();
        if (dist.count(u)) continue;
        dist[u] = d;
        for (auto& [v, w] : adj[u])
            if (!dist.count(v)) heap.push({d + w, v});
    }
    if ((int)dist.size() != n) return -1;
    int ans = 0;
    for (auto& [_, d] : dist) ans = std::max(ans, d);
    return ans;
}
```


### 99. Swim in Rising Water

#### Problem
Given an `n x n` grid where `grid[r][c]` is the elevation of cell `(r, c)`, find the minimum time `t` such that you can swim from `(0, 0)` to `(n-1, n-1)`. At time `t` you can swim through any cell with elevation at most `t`.

#### Examples

```text
Input: grid = [[0,2],[1,3]]
Output: 3
Explanation: the corner cell itself has elevation 3.

Input: grid = [[0,4,3],[8,5,2],[7,6,1]]
Output: 4
Explanation: the route 0,4,3,2,1 peaks at 4; going down
peaks at 8.

Input: grid = [[0]]
Output: 0

Constraints:
- n == grid.length == grid[i].length, 1 <= n <= 50
- 0 <= grid[i][j] < n * n
- every elevation in the grid is distinct
```

#### Recognition
**Signals.** A grid with a cost attached to each cell, and an objective that reads "minimum time `t` such that you can swim through", meaning every cell on the route must satisfy `elevation <= t`. So the cost of a route is the **largest** elevation on it, not the total. "Minimise the maximum" is the bottleneck, or minimax, variant of shortest path, and it is the phrase to react to. The elevations are distinct values in `[0, n*n)`, which quietly tells you the answer is one of the grid values. **Therefore.** Run Dijkstra with the relaxation changed from `d + w` to `max(d, grid[v])`. That value is still non-decreasing along a route, which is the only property the pop-order argument needs, so the first pop of the corner is optimal. **Not Dijkstra with a summed cost**, which is the reflex here and is wrong: a route over twenty cells of elevation 1 would score 20 and lose to a single cell of elevation 5, when in fact it is free and the other costs 5. **O(n² log n)** time, **O(n²)** space.

#### Explanation
**Brute force.** Try each candidate time in increasing order and flood-fill the cells it unlocks.

```python
def swimInWater(grid):
    n = len(grid)
    dirs = ((0, 1), (0, -1), (1, 0), (-1, 0))
    for t in range(grid[0][0], n * n):
        seen, stack = {(0, 0)}, [(0, 0)]
        while stack:
            r, c = stack.pop()
            if r == n - 1 and c == n - 1:
                return t
            for dr, dc in dirs:
                nr, nc = r + dr, c + dc
                if (0 <= nr < n and 0 <= nc < n
                        and (nr, nc) not in seen
                        and grid[nr][nc] <= t):
                    seen.add((nr, nc))
                    stack.append((nr, nc))
    return -1
```

`O(n^4)` time, `O(n^2)` space.

**Wasteful because.** Each value of `t` restarts the flood from an empty `seen`, even though the region reachable at `t` strictly contains the region reachable at `t - 1`. Almost all of the work at every step is rediscovering cells already known to be reachable.

**Optimal.** Grow that region once, in the order the rising water would unlock it, and let a min-heap keep the frontier sorted by bottleneck. Popping the frontier cell with the lowest bottleneck means keys come off in non-decreasing order, so the first time the corner is popped, its value is optimal. Marking a cell visited on push rather than on pop is safe for the same reason: if some route gave a neighbour a strictly lower bottleneck, the cell achieving it would already have been popped and would already have pushed that neighbour. Binary searching `t` and flooding once per guess is the same `O(n² log n)` and is easier to argue; Union-Find, adding cells in increasing elevation until the two corners connect, is the fastest of the three once the sort is paid for.

**Edge cases.** `n == 1` returns `grid[0][0]`, which the distinctness constraint pins at 0. The answer is never below `grid[n-1][n-1]`, since you must stand on it. Elevations are distinct, so heap keys never tie. A cell can be pushed with a bottleneck higher than its own elevation, which is the whole point.

#### Python

`max(t, grid[nr][nc])` replaces the usual 'sum the edge weight' — the minimax twist. Eager `visited` mark on enqueue (not dequeue) saves duplicate heap entries.

```python
import heapq

def swimInWater(grid):
    n = len(grid)
    visited = {(0, 0)}
    heap = [(grid[0][0], 0, 0)]
    while heap:
        t, r, c = heapq.heappop(heap)
        if r == n - 1 and c == n - 1:
            return t
        for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < n and 0 <= nc < n and (nr, nc) not in visited:
                visited.add((nr, nc))
                heapq.heappush(heap, (max(t, grid[nr][nc]), nr, nc))
```

#### Java

`PriorityQueue<int[]>` keyed by the bottleneck elevation is the min-heap; the minimax relaxation is `Math.max(t, grid[nr][nc])` instead of a sum. A `boolean[][]` visited grid beats a `HashSet` of coordinates for index-keyed lookup.

```java
import java.util.*;

class Solution {
    public int swimInWater(int[][] grid) {
        int n = grid.length;
        boolean[][] visited = new boolean[n][n];
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> a[0] - b[0]);
        heap.offer(new int[]{grid[0][0], 0, 0});
        visited[0][0] = true;
        int[][] dirs = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};
        while (!heap.isEmpty()) {
            int[] cur = heap.poll();
            int t = cur[0], r = cur[1], c = cur[2];
            if (r == n - 1 && c == n - 1) return t;
            for (int[] dir : dirs) {
                int nr = r + dir[0], nc = c + dir[1];
                if (nr >= 0 && nc >= 0 && nr < n && nc < n && !visited[nr][nc]) {
                    visited[nr][nc] = true;
                    heap.offer(new int[]{Math.max(t, grid[nr][nc]), nr, nc});
                }
            }
        }
        return -1;
    }
}
```

#### Rust

`Reverse((t, r, c))` for the min-heap. Visited is a `vec![vec![false; n]; n]` 2D array, faster than a HashSet for index-keyed lookup.

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

fn swim_in_water(grid: Vec<Vec<i32>>) -> i32 {
    let n = grid.len();
    let mut visited = vec![vec![false; n]; n];
    let mut heap = BinaryHeap::new();
    heap.push(Reverse((grid[0][0], 0usize, 0usize)));
    visited[0][0] = true;
    let dirs = [(0i32, 1i32), (0, -1), (1, 0), (-1, 0)];
    while let Some(Reverse((t, r, c))) = heap.pop() {
        if r == n - 1 && c == n - 1 { return t; }
        for (dr, dc) in dirs {
            let nr = r as i32 + dr;
            let nc = c as i32 + dc;
            if nr >= 0 && nc >= 0 {
                let (nr, nc) = (nr as usize, nc as usize);
                if nr < n && nc < n && !visited[nr][nc] {
                    visited[nr][nc] = true;
                    heap.push(Reverse((t.max(grid[nr][nc]), nr, nc)));
                }
            }
        }
    }
    -1
}
```

#### Go

Custom `swimHeap` with named fields. The `max` of `cur.t` and `grid[nr][nc]` is via two ifs since pre-1.21 Go has no `max` builtin.

```go
import "container/heap"

type swimItem struct{ t, r, c int }
type swimHeap []swimItem
func (h swimHeap) Len() int            { return len(h) }
func (h swimHeap) Less(i, j int) bool { return h[i].t < h[j].t }
func (h swimHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *swimHeap) Push(x interface{}) { *h = append(*h, x.(swimItem)) }
func (h *swimHeap) Pop() interface{} {
    old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x
}

func swimInWater(grid [][]int) int {
    n := len(grid)
    visited := make([][]bool, n)
    for i := range visited { visited[i] = make([]bool, n) }
    visited[0][0] = true
    h := &swimHeap{{grid[0][0], 0, 0}}
    heap.Init(h)
    dirs := [][2]int{{0, 1}, {0, -1}, {1, 0}, {-1, 0}}
    for h.Len() > 0 {
        cur := heap.Pop(h).(swimItem)
        if cur.r == n-1 && cur.c == n-1 { return cur.t }
        for _, d := range dirs {
            nr, nc := cur.r+d[0], cur.c+d[1]
            if nr >= 0 && nc >= 0 && nr < n && nc < n && !visited[nr][nc] {
                visited[nr][nc] = true
                t := cur.t
                if grid[nr][nc] > t { t = grid[nr][nc] }
                heap.Push(h, swimItem{t, nr, nc})
            }
        }
    }
    return -1
}
```

#### C++

`std::tuple<int,int,int>` for the heap entries; structured binding to destructure. `std::max(t, grid[nr][nc])` for the minimax relaxation.

```cpp
#include <vector>
#include <queue>
#include <algorithm>

int swimInWater(std::vector<std::vector<int>>& grid) {
    int n = (int)grid.size();
    std::vector<std::vector<bool>> visited(n, std::vector<bool>(n, false));
    using T3 = std::tuple<int,int,int>;
    std::priority_queue<T3, std::vector<T3>, std::greater<T3>> heap;
    heap.push({grid[0][0], 0, 0});
    visited[0][0] = true;
    int dirs[4][2] = {{0,1},{0,-1},{1,0},{-1,0}};
    while (!heap.empty()) {
        auto [t, r, c] = heap.top(); heap.pop();
        if (r == n-1 && c == n-1) return t;
        for (auto& d : dirs) {
            int nr = r + d[0], nc = c + d[1];
            if (nr >= 0 && nc >= 0 && nr < n && nc < n && !visited[nr][nc]) {
                visited[nr][nc] = true;
                heap.push({std::max(t, grid[nr][nc]), nr, nc});
            }
        }
    }
    return -1;
}
```


### 100. Alien Dictionary

#### Problem
Given a sorted list of words in an alien language, determine the character ordering of the alien alphabet. Return any valid ordering, or `""` if no valid ordering exists (i.e., the input is contradictory).

#### Examples

```text
Input: words = ["wrt","wrf","er","ett","rftt"]
Output: "wertf"
Explanation: the pairs give t<f, w<e, r<t, e<r, which chain
into one total order.

Input: words = ["z","x","z"]
Output: ""
Explanation: z<x and x<z contradict each other.

Input: words = ["abc","ab"]
Output: ""

Constraints:
- 1 <= words.length <= 100
- 1 <= words[i].length <= 100
- words[i] is lowercase English letters only
```

#### Recognition
**Signals.** "Sorted according to the rules of this new language", plus "return any valid ordering" and `""` when the input is contradictory. Nothing here hands you a graph, so the recognition step is that the edges are latent and you must derive them before you can sort anything. "Any valid ordering" says the answer is a partial order with slack, not a unique sequence, and `""` on contradiction is a cycle-detection requirement wearing a disguise. **Therefore.** Compare each adjacent pair of words, take the first position where they differ as one edge `w1[j] -> w2[j]`, then topologically sort the resulting character graph. **Not a sort with a custom comparator**, which is the reflex once you see "sorted": you have no comparator. Two characters that never meet at a first-difference are genuinely incomparable, and Python's `sort` needs a total order, so it would either crash on the gaps or invent an ordering the input never justified. With `C` the total number of characters across all words, **O(C)** time, **O(C)** space.

#### Explanation
**Brute force.** Try every permutation of the alphabet and keep the first that sorts the input correctly.

```python
from itertools import permutations

def alienOrder(words):
    chars = sorted({c for w in words for c in w})
    for p in permutations(chars):
        rank = {c: i for i, c in enumerate(p)}
        keys = [[rank[c] for c in w] for w in words]
        if all(a <= b for a, b in zip(keys, keys[1:])):
            return "".join(p)
    return ""
```

`O(k! * C)` time for an alphabet of size `k`, `O(k)` space.

**Wasteful because.** Nearly every permutation is rejected by the same one adjacent pair, and the ordering was never free to begin with. The input already pins down individual "a before b" facts; enumerating whole alphabets to rediscover them is the waste.

**Optimal.** Read the facts off directly. For adjacent words `w1, w2`, scan to the first position where they differ. That single character pair is the only information the pair carries, because everything after the first difference is unconstrained, so you record `w1[j] -> w2[j]` and break. If they agree through the shared prefix and `w1` is the longer one, no alphabet can order them and the answer is `""` at once. What is left is a directed graph over characters, and every valid alphabet is one of its topological orders. This DFS carries three states: absent means unseen, `True` means on the current recursion stack so a revisit is a back edge and therefore a cycle, and `False` means finished. Each node is appended after all its successors, so the reversed post-order is the answer. Kahn's algorithm with in-degrees is equally valid and reports the cycle by emitting fewer characters than exist.

**Edge cases.** A character constrained by nothing still belongs in the output, which is why `adj` is seeded from every character before any edge is added. A single word yields no adjacent pair at all, so every character is free. `["abc", "ab"]` is the invalid-prefix case and must be caught before the DFS. Repeated adjacent words are consistent and contribute no edge.

#### Python

Comprehension `{c: set() for w in words for c in w}` collects all characters up front — even chars with no constraints get an empty adjacency set. The longer-word-before-prefix case (`['abc', 'ab']`) is detected before the DFS and returns `""`.

```python
def alienOrder(words):
    adj = {c: set() for w in words for c in w}
    for i in range(len(words) - 1):
        w1, w2 = words[i], words[i + 1]
        min_len = min(len(w1), len(w2))
        if len(w1) > len(w2) and w1[:min_len] == w2[:min_len]:
            return ""
        for j in range(min_len):
            if w1[j] != w2[j]:
                adj[w1[j]].add(w2[j])
                break
    visited = {}
    res = []

    def dfs(c):
        if c in visited:
            return visited[c]
        visited[c] = True
        for nb in adj[c]:
            if dfs(nb):
                return True
        visited[c] = False
        res.append(c)
        return False

    for c in adj:
        if dfs(c):
            return ""
    return "".join(res[::-1])
```

#### Java

`computeIfAbsent(c, x -> new HashSet<>())` pre-registers every character so isolated chars still get emitted. A `Map<Character,Integer>` holds the three DFS states (0 unseen, 1 in-stack, 2 done); a `StringBuilder.reverse()` produces the final order.

```java
import java.util.*;

class Solution {
    private Map<Character, Set<Character>> adj;
    private Map<Character, Integer> state;
    private StringBuilder res;

    public String alienOrder(String[] words) {
        adj = new HashMap<>();
        for (String w : words)
            for (char c : w.toCharArray())
                adj.computeIfAbsent(c, x -> new HashSet<>());
        for (int i = 0; i < words.length - 1; i++) {
            String w1 = words[i], w2 = words[i + 1];
            int minLen = Math.min(w1.length(), w2.length());
            if (w1.length() > w2.length()
                    && w1.substring(0, minLen).equals(w2.substring(0, minLen)))
                return "";
            for (int j = 0; j < minLen; j++) {
                if (w1.charAt(j) != w2.charAt(j)) {
                    adj.get(w1.charAt(j)).add(w2.charAt(j));
                    break;
                }
            }
        }
        state = new HashMap<>();
        res = new StringBuilder();
        for (char c : adj.keySet())
            if (dfs(c)) return "";
        return res.reverse().toString();
    }

    private boolean dfs(char c) {
        Integer s = state.get(c);
        if (s != null) return s == 1;
        state.put(c, 1);
        for (char nb : adj.get(c))
            if (dfs(nb)) return true;
        state.put(c, 2);
        res.append(c);
        return false;
    }
}
```

#### Rust

Pre-collect words into `Vec<char>` for indexable comparison — Rust strings can't be indexed by byte without UTF-8 boundary checks. The prefix-mismatch invalid case checks `w1[..min_len] == w2[..min_len]` via slice equality.

```rust
use std::collections::{HashMap, HashSet};

fn alien_order(words: Vec<String>) -> String {
    let mut adj: HashMap<char, HashSet<char>> = HashMap::new();
    for w in &words {
        for c in w.chars() {
            adj.entry(c).or_default();
        }
    }
    for i in 0..words.len() - 1 {
        let (w1, w2): (Vec<char>, Vec<char>) = (words[i].chars().collect(), words[i+1].chars().collect());
        let min_len = w1.len().min(w2.len());
        if w1.len() > w2.len() && w1[..min_len] == w2[..min_len] {
            return String::new();
        }
        for j in 0..min_len {
            if w1[j] != w2[j] {
                adj.entry(w1[j]).or_default().insert(w2[j]);
                break;
            }
        }
    }
    // 0=unseen, 1=in-stack, 2=done
    let mut state: HashMap<char, u8> = HashMap::new();
    let mut res: Vec<char> = Vec::new();

    fn dfs(c: char, adj: &HashMap<char, HashSet<char>>, state: &mut HashMap<char, u8>, res: &mut Vec<char>) -> bool {
        match state.get(&c) {
            Some(&1) => return true,
            Some(&2) => return false,
            _ => {}
        }
        state.insert(c, 1);
        let neighbors: Vec<char> = adj[&c].iter().cloned().collect();
        for nb in neighbors {
            if dfs(nb, adj, state, res) { return true; }
        }
        state.insert(c, 2);
        res.push(c);
        false
    }

    let chars: Vec<char> = adj.keys().cloned().collect();
    for c in chars {
        if dfs(c, &adj, &mut state, &mut res) {
            return String::new();
        }
    }
    res.iter().rev().collect()
}
```

#### Go

`map[byte]map[byte]bool` — nested map as adjacency-set. Byte-level string slicing is safe for ASCII inputs. Manual reverse via index swap.

```go
func alienOrder(words []string) string {
    adj := map[byte]map[byte]bool{}
    for _, w := range words {
        for i := 0; i < len(w); i++ {
            if _, ok := adj[w[i]]; !ok {
                adj[w[i]] = map[byte]bool{}
            }
        }
    }
    for i := 0; i < len(words)-1; i++ {
        w1, w2 := words[i], words[i+1]
        minLen := len(w1)
        if len(w2) < minLen { minLen = len(w2) }
        if len(w1) > len(w2) && w1[:minLen] == w2[:minLen] { return "" }
        for j := 0; j < minLen; j++ {
            if w1[j] != w2[j] {
                adj[w1[j]][w2[j]] = true
                break
            }
        }
    }
    // 0=unseen, 1=in-stack, 2=done
    state := map[byte]int{}
    var res []byte
    var dfs func(byte) bool
    dfs = func(c byte) bool {
        if v, ok := state[c]; ok {
            return v == 1
        }
        state[c] = 1
        for nb := range adj[c] {
            if dfs(nb) { return true }
        }
        state[c] = 2
        res = append(res, c)
        return false
    }
    for c := range adj {
        if dfs(c) { return "" }
    }
    for i, j := 0, len(res)-1; i < j; i, j = i+1, j-1 { res[i], res[j] = res[j], res[i] }
    return string(res)
}
```

#### C++

`adj[c]` accessed for-effect (creates empty bucket) to pre-register every character. `substr(0, minLen) == ...` for the prefix-equality check; structured binding `auto& [c, _]` in C++17.

```cpp
#include <vector>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <functional>

std::string alienOrder(std::vector<std::string>& words) {
    std::unordered_map<char, std::unordered_set<char>> adj;
    for (auto& w : words)
        for (char c : w) adj[c];
    for (int i = 0; i + 1 < (int)words.size(); ++i) {
        auto& w1 = words[i]; auto& w2 = words[i+1];
        int minLen = std::min(w1.size(), w2.size());
        if (w1.size() > w2.size() && w1.substr(0, minLen) == w2.substr(0, minLen))
            return "";
        for (int j = 0; j < minLen; ++j) {
            if (w1[j] != w2[j]) { adj[w1[j]].insert(w2[j]); break; }
        }
    }
    std::unordered_map<char, int> state; // 0=unseen,1=stack,2=done
    std::string res;
    std::function<bool(char)> dfs = [&](char c) -> bool {
        auto it = state.find(c);
        if (it != state.end()) return it->second == 1;
        state[c] = 1;
        for (char nb : adj[c]) if (dfs(nb)) return true;
        state[c] = 2;
        res += c;
        return false;
    };
    for (auto& [c, _] : adj)
        if (dfs(c)) return "";
    std::reverse(res.begin(), res.end());
    return res;
}
```


### 101. Cheapest Flights Within K Stops

#### Problem
Given `n` cities, a list of directed flights `[from, to, price]`, a source `src`, destination `dst`, and an integer `k`, find the cheapest price from `src` to `dst` with at most `k` stops (i.e. at most `k+1` edges).

#### Examples

```text
Input: n = 4, src = 0, dst = 3, k = 1,
flights = [[0,1,100],[1,2,100],[2,0,100],[1,3,600],[2,3,200]]
Output: 700
Explanation: 0->1->3 costs 700 with one stop. The cheaper
0->1->2->3 at 400 uses two stops and is illegal.

Input: n = 3, src = 0, dst = 2, k = 1,
flights = [[0,1,100],[1,2,100],[0,2,500]]
Output: 200

Input: n = 3, src = 0, dst = 2, k = 0,
flights = [[0,1,100],[1,2,100],[0,2,500]]
Output: 500

Constraints:
- 1 <= n <= 100, 0 <= src, dst, k < n, src != dst
- 0 <= flights.length <= n * (n - 1) / 2
- 1 <= price <= 10^4
```

#### Recognition
**Signals.** Weighted directed edges and a single source, which reads like Dijkstra, but bolted on is "at most `k` stops". A cap on the *number of edges* alongside a minimisation over *edge weights* is the disambiguator, and it is the whole problem. It means the thing you carry per node is no longer one number: cost and hops used are both part of the state, and a route can be cheap and illegal or dear and legal. `n <= 100` with `k < n` puts a `k`-round pass over every flight well inside budget. **Therefore.** Bellman-Ford run `k+1` times, snapshotting the cost array so one round adds exactly one flight. **Not Dijkstra keyed on the node alone**, which settles each node at its globally cheapest cost and never reopens it. In example 1 it would settle node 2 at 200 via two hops and node 3 at 400 via three, then have no way to recover the legal 700, because the route it discarded was the expensive one. **O(k * E)** time, **O(n)** space.

#### Explanation
**Brute force.** Recurse over every route out of `src`, stopping when the hop budget runs out.

```python
def findCheapestPrice(n, flights, src, dst, k):
    best = float('inf')
    def dfs(u, hops, cost):
        nonlocal best
        if u == dst:
            best = min(best, cost)
            return
        if hops > k:
            return
        for a, b, w in flights:
            if a == u:
                dfs(b, hops + 1, cost + w)
    dfs(src, 0, 0)
    return best if best != float('inf') else -1
```

`O(E^(k+1))` time, `O(k)` space.

**Wasteful because.** The same `(node, hops used)` pair is reached by many different prefixes, and the entire subtree below it is re-explored once per prefix, even though only the cheapest cost of arriving in that state can ever affect the answer.

**Optimal.** Collapse the state. All the recursion needs at a node is the cheapest cost of reaching it having spent at most `i` edges, so keep one array of `n` costs per round instead of a call tree. Round `i` relaxes every flight once against round `i-1`'s array, which is exactly Bellman-Ford with the round count doing double duty as the hop budget. Copying `prices` into `tmp` before relaxing is the entire trick: relaxing in place would let a single round chain two or more flights, quietly spending hops you have not been given. After `k+1` rounds, since at most `k` stops means at most `k+1` flights, `prices[dst]` is the answer. Dijkstra over the widened state `(cost, node, hops)` also works and wins on sparse graphs with a large `k`, where most of the `k * E` relaxations touch nothing.

**Edge cases.** `k = 0` permits exactly one direct flight. An unreachable `dst` leaves the `inf` sentinel in place and returns `-1`. Cycles are harmless because the round count bounds the search, so no visited set is needed. Prices are strictly positive, so no round can improve a cost by looping.

#### Python

`prices[:]` copy each round is what makes this a true Bellman-Ford 'one more edge' iteration — using the live array would let one round chain multiple hops. `float('inf')` sentinel sidesteps overflow.

```python
def findCheapestPrice(n, flights, src, dst, k):
    prices = [float('inf')] * n
    prices[src] = 0
    for _ in range(k + 1):
        tmp = prices[:]
        for u, v, w in flights:
            if prices[u] != float('inf') and prices[u] + w < tmp[v]:
                tmp[v] = prices[u] + w
        prices = tmp
    return prices[dst] if prices[dst] != float('inf') else -1
```

#### Java

`Arrays.copyOf(prices, n)` clones the array each round so a single relaxation only reads distances from the previous round — the Bellman-Ford "one more edge" invariant. `Integer.MAX_VALUE / 2` is the sentinel that avoids overflow on `prices[u] + w`.

```java
import java.util.*;

class Solution {
    public int findCheapestPrice(int n, int[][] flights, int src, int dst, int k) {
        int INF = Integer.MAX_VALUE / 2;
        int[] prices = new int[n];
        Arrays.fill(prices, INF);
        prices[src] = 0;
        for (int i = 0; i <= k; i++) {
            int[] tmp = Arrays.copyOf(prices, n);
            for (int[] f : flights) {
                int u = f[0], v = f[1], w = f[2];
                if (prices[u] != INF && prices[u] + w < tmp[v])
                    tmp[v] = prices[u] + w;
            }
            prices = tmp;
        }
        return prices[dst] == INF ? -1 : prices[dst];
    }
}
```

#### Rust

`i64::MAX / 2` as sentinel to avoid overflow when adding edge weights. `prices.clone()` per round mirrors the Python slice copy.

```rust
fn find_cheapest_price(n: i32, flights: Vec<Vec<i32>>, src: i32, dst: i32, k: i32) -> i32 {
    let n = n as usize;
    const INF: i64 = i64::MAX / 2;
    let mut prices = vec![INF; n];
    prices[src as usize] = 0;
    for _ in 0..=k {
        let mut tmp = prices.clone();
        for f in &flights {
            let (u, v, w) = (f[0] as usize, f[1] as usize, f[2] as i64);
            if prices[u] < INF && prices[u] + w < tmp[v] {
                tmp[v] = prices[u] + w;
            }
        }
        prices = tmp;
    }
    if prices[dst as usize] == INF { -1 } else { prices[dst as usize] as i32 }
}
```

#### Go

`append([]int(nil), prices...)` is the standard 'clone a slice' idiom — `nil` source creates a fresh underlying array. Otherwise reads like the Python form.

```go
func findCheapestPrice(n int, flights [][]int, src int, dst int, k int) int {
    const inf = 1<<31 - 1
    prices := make([]int, n)
    for i := range prices { prices[i] = inf }
    prices[src] = 0
    for i := 0; i <= k; i++ {
        tmp := append([]int(nil), prices...)
        for _, f := range flights {
            u, v, w := f[0], f[1], f[2]
            if prices[u] != inf && prices[u]+w < tmp[v] {
                tmp[v] = prices[u] + w
            }
        }
        prices = tmp
    }
    if prices[dst] == inf { return -1 }
    return prices[dst]
}
```

#### C++

`std::vector<int> tmp = prices` is a deep copy (vector copy semantics). `INT_MAX / 2` prevents overflow on the `prices[u] + w` addition.

```cpp
#include <vector>
#include <climits>
#include <algorithm>

int findCheapestPrice(int n, std::vector<std::vector<int>>& flights, int src, int dst, int k) {
    const int INF = INT_MAX / 2;
    std::vector<int> prices(n, INF);
    prices[src] = 0;
    for (int i = 0; i <= k; ++i) {
        std::vector<int> tmp = prices;
        for (auto& f : flights) {
            int u = f[0], v = f[1], w = f[2];
            if (prices[u] < INF && prices[u] + w < tmp[v])
                tmp[v] = prices[u] + w;
        }
        prices = tmp;
    }
    return prices[dst] == INF ? -1 : prices[dst];
}
```


### 102. Climbing Stairs

#### Problem
You can climb `1` or `2` steps at a time. Count the number of distinct ways to reach the top of a staircase with `n` steps.

#### Examples

```text
Input: n = 2
Output: 2
Explanation: 1+1 and 2.

Input: n = 3
Output: 3
Explanation: 1+1+1, 1+2, 2+1.

Input: n = 1
Output: 1

Constraints:
- 1 <= n <= 45
- each move is exactly 1 or 2 steps
- the answer fits in a signed 32-bit integer
```

#### Recognition
**Signals.** "Count the number of distinct ways" is the counting objective, and there is exactly one thing to decide at each point (take 1 or take 2) with a single index describing where you are. Crucially the branches re-converge: reaching step 5 by 2+2+1 and by 1+2+2 both leave you facing the identical remaining problem. One index of state, a small fixed set of choices, and overlapping subproblems is linear DP. **Therefore.** Define `f(i)` as the number of ways to reach step `i`, note `f(i) = f(i-1) + f(i-2)`, and roll two scalars up the staircase. **Not greedy**, which cannot even be phrased here: greedy commits to one choice per step and returns one route, while the question asks how many routes exist, so there is no locally best move to be greedy about. **Not the closed-form binomial sum** over the number of 2-steps, which is correct but needs factorials that overflow long before `n = 45` does. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Recurse on the two choices available at every step.

```python
def climbStairs(n):
    if n <= 1:
        return 1
    return climbStairs(n - 1) + climbStairs(n - 2)
```

`O(2^n)` time, `O(n)` space for the call stack.

**Wasteful because.** The branches re-converge. `climbStairs(10)` evaluates `climbStairs(8)` inside both of its children, and every level below repeats the same way, so a call tree with `O(2^n)` nodes covers only `n` distinct arguments. That gap between number of calls and number of distinct subproblems is the signature of every problem in this section, and closing it is what DP means.

**Optimal.** Three moves, and they are the same three for the rest of the chapter. First name the state: `f(i)` is the number of ways to reach step `i`. Then read the transition off the choices: you arrive at `i` either from `i-1` or from `i-2`, those two route sets are disjoint and together they are all of them, so `f(i) = f(i-1) + f(i-2)` with `f(0) = f(1) = 1`. Memoising the recursion on `i` alone already collapses `2^n` calls to `n`. Next notice that `i` only ever depends on smaller `i`, so the recursion can be replaced by a left-to-right loop over a table, which drops the call stack. Finally notice each cell reads only the two cells before it, so the table can be two scalars. That last step is where the `O(n)` space becomes `O(1)`, and it is available whenever the transition has a bounded lookback.

**Edge cases.** `n = 1` returns 1 with the loop body never running. `n = 2` returns 2, not 1, which is why `f(0)` must be 1 rather than 0. The answer is Fibonacci shifted by one, so `n = 45` gives 1836311903, just under the signed 32-bit ceiling, which is exactly why the constraint stops there.

#### Python

Tuple swap `a, b = b, a + b` does the rolling update in one line. Two rolling vars beat a full DP array for O(1) space.

```python
def climbStairs(n):
    a, b = 1, 1
    for _ in range(n - 1):
        a, b = b, a + b
    return b
```

#### Java

Java has no tuple-swap, so an explicit `c` temp does the rolling Fibonacci update. Two scalars beat a full DP array for O(1) space.

```java
class Solution {
    public int climbStairs(int n) {
        int a = 1, b = 1;
        for (int i = 1; i < n; i++) {
            int c = a + b;
            a = b;
            b = c;
        }
        return b;
    }
}
```

#### Rust

Explicit temp `c` because Rust can't tuple-swap two `let mut` variables in one expression. `1..n` for `n-1` iterations.

```rust
fn climb_stairs(n: i32) -> i32 {
    let (mut a, mut b) = (1i32, 1i32);
    for _ in 1..n {
        let c = a + b;
        a = b;
        b = c;
    }
    b
}
```

#### Go

Tuple swap `a, b = b, a+b` — Go's parallel assignment matches Python's shape exactly. No `c` temp needed.

```go
func climbStairs(n int) int {
    a, b := 1, 1
    for i := 1; i < n; i++ {
        a, b = b, a+b
    }
    return b
}
```

#### C++

Explicit `int c` temp for the swap — C++ has no parallel assignment. `for (int i = 1; i < n; ++i)` runs `n-1` times.

```cpp
int climbStairs(int n) {
    int a = 1, b = 1;
    for (int i = 1; i < n; ++i) {
        int c = a + b;
        a = b;
        b = c;
    }
    return b;
}
```


### 103. Min Cost Climbing Stairs

#### Problem
Given an array `cost` where `cost[i]` is the cost of stepping on stair `i`, find the minimum total cost to reach the top (beyond the last index). You can start from index `0` or `1` and can take `1` or `2` steps.

#### Examples

TODO

#### Recognition
**DP (bottom-up, in-place).** **O(n)** time, **O(1)** space.

#### Explanation
`cost[i]` represents the cost to leave stair `i`. We build up the minimum cost to reach each stair in place: `cost[i] += min(cost[i-1], cost[i-2])`. This makes `cost[i]` the total minimum cost to step on and leave stair `i`. The "top" is one step beyond the last stair, so it's reachable from either the last or second-to-last stair — we return `min(cost[-1], cost[-2])`. Modifying the input array gives O(1) space; if we can't mutate input, two rolling variables suffice.

#### Python

In-place mutation of `cost` is the cleanest O(1) space form. Negative indices `cost[-1]` and `cost[-2]` for the final two elements — Pythonic.

```python
def minCostClimbingStairs(cost):
    for i in range(2, len(cost)):
        cost[i] += min(cost[i - 1], cost[i - 2])
    return min(cost[-1], cost[-2])
```

#### Java

In-place mutation of `cost` gives O(1) extra space; `Math.min` from `java.lang.Math` needs no import. `cost[n-1]`/`cost[n-2]` stand in for Python's negative indexing.

```java
class Solution {
    public int minCostClimbingStairs(int[] cost) {
        int n = cost.length;
        for (int i = 2; i < n; i++)
            cost[i] += Math.min(cost[i - 1], cost[i - 2]);
        return Math.min(cost[n - 1], cost[n - 2]);
    }
}
```

#### Rust

Mutates owned `cost: Vec<i32>` (shadowed with `let mut`). `cost[i-1].min(cost[i-2])` for the recurrence.

```rust
fn min_cost_climbing_stairs(cost: Vec<i32>) -> i32 {
    let mut cost = cost;
    for i in 2..cost.len() {
        cost[i] += cost[i - 1].min(cost[i - 2]);
    }
    let n = cost.len();
    cost[n - 1].min(cost[n - 2])
}
```

#### Go

Pre-1.21 Go needs the explicit if-else for `min` — verbose but unavoidable. In-place mutation matches the Python shape.

```go
func minCostClimbingStairs(cost []int) int {
    for i := 2; i < len(cost); i++ {
        if cost[i-1] < cost[i-2] {
            cost[i] += cost[i-1]
        } else {
            cost[i] += cost[i-2]
        }
    }
    n := len(cost)
    if cost[n-1] < cost[n-2] {
        return cost[n-1]
    }
    return cost[n-2]
}
```

#### C++

`std::min` from `<algorithm>` for the recurrence. In-place mutation of the input vector.

```cpp
#include <vector>
#include <algorithm>

int minCostClimbingStairs(std::vector<int>& cost) {
    int n = (int)cost.size();
    for (int i = 2; i < n; ++i)
        cost[i] += std::min(cost[i-1], cost[i-2]);
    return std::min(cost[n-1], cost[n-2]);
}
```


### 104. House Robber

#### Problem
Given an array of non-negative integers representing money in each house, return the maximum amount you can rob without robbing two adjacent houses.

#### Examples

TODO

#### Recognition
**DP (rolling variables).** **O(n)** time, **O(1)** space.

#### Explanation
At each house `i` there are two choices: skip it (best profit stays `curr`) or rob it (profit becomes `prev + nums[i]`, where `prev` is the best from two houses ago). The recurrence is `new_curr = max(curr, prev + nums[i])`. Only the two previous values are needed, so we maintain `prev` and `curr` as rolling scalars rather than a full DP array. A greedy approach (always rob the richer of adjacent houses) fails on inputs like `[2, 1, 1, 2]` where skipping two houses is optimal.

#### Python

Tuple swap `prev, curr = curr, max(curr, prev + n)` does the entire state update in one line. The clearest expression of the recurrence among the four.

```python
def rob(nums):
    prev, curr = 0, 0
    for n in nums:
        prev, curr = curr, max(curr, prev + n)
    return curr
```

#### Java

An explicit `next` temp stands in for Python's tuple swap. `Math.max` folds the skip-vs-rob choice; two rolling scalars keep it O(1) space.

```java
class Solution {
    public int rob(int[] nums) {
        int prev = 0, curr = 0;
        for (int n : nums) {
            int next = Math.max(curr, prev + n);
            prev = curr;
            curr = next;
        }
        return curr;
    }
}
```

#### Rust

Explicit `next` temp because parallel assignment of `let mut` vars requires an intermediate.

```rust
fn rob(nums: Vec<i32>) -> i32 {
    let (mut prev, mut curr) = (0i32, 0i32);
    for n in nums {
        let next = curr.max(prev + n);
        prev = curr;
        curr = next;
    }
    curr
}
```

#### Go

Two-statement update with explicit `next` and an if-comparison (pre-builtin `max`). Same shape but more lines.

```go
func rob(nums []int) int {
    prev, curr := 0, 0
    for _, n := range nums {
        next := curr
        if prev+n > next {
            next = prev + n
        }
        prev = curr
        curr = next
    }
    return curr
}
```

#### C++

Explicit `next` temp with `std::max`. Same control flow as Rust.

```cpp
#include <vector>
#include <algorithm>

int rob(std::vector<int>& nums) {
    int prev = 0, curr = 0;
    for (int n : nums) {
        int next = std::max(curr, prev + n);
        prev = curr;
        curr = next;
    }
    return curr;
}
```


### 105. House Robber II

#### Problem
Houses are arranged in a circle so the first and last are adjacent. Return the maximum amount you can rob without robbing two adjacent houses.

#### Examples

TODO

#### Recognition
**DP on two linear subproblems (skip first or last).** **O(n)** time, **O(1)** space.

#### Explanation
The circular constraint means you can't take both `nums[0]` and `nums[n-1]`. We handle this by splitting into two independent linear House Robber problems: one over `nums[1:]` (exclude first) and one over `nums[:-1]` (exclude last). Each subproblem is the standard linear rob with rolling variables. Taking the maximum of those two answers covers all valid cases. We also consider taking just `nums[0]` alone for the edge case where `n == 1`. This clean decomposition avoids any bespoke circular logic.

#### Python

`max(nums[0], rob_line(nums[1:]), rob_line(nums[:-1]))` — three-argument max with the n=1 edge case folded in via `nums[0]`. Nested function captures nothing — could be top-level.

```python
def rob(nums):
    def rob_line(houses):
        prev, curr = 0, 0
        for n in houses:
            prev, curr = curr, max(curr, prev + n)
        return curr
    return max(nums[0], rob_line(nums[1:]), rob_line(nums[:-1]))
```

#### Java

`Arrays.copyOfRange` extracts the two linear sub-arrays (exclude first, exclude last) without hand-rolled index math. A private `robLine` helper is reused for both; `Math.max` chains fold in the `n == 1` edge case.

```java
import java.util.*;

class Solution {
    private int robLine(int[] houses) {
        int prev = 0, curr = 0;
        for (int n : houses) {
            int next = Math.max(curr, prev + n);
            prev = curr;
            curr = next;
        }
        return curr;
    }

    public int rob(int[] nums) {
        int n = nums.length;
        if (n == 1) return nums[0];
        int excludeFirst = robLine(Arrays.copyOfRange(nums, 1, n));
        int excludeLast = robLine(Arrays.copyOfRange(nums, 0, n - 1));
        return Math.max(nums[0], Math.max(excludeFirst, excludeLast));
    }
}
```

#### Rust

`&nums[1..]` and `&nums[..n-1]` slices borrow without copying — Rust's slicing wins here over Python's `nums[1:]` which copies. Method-chained `max`.

```rust
fn rob2(nums: Vec<i32>) -> i32 {
    fn rob_line(houses: &[i32]) -> i32 {
        let (mut prev, mut curr) = (0i32, 0i32);
        for &n in houses {
            let next = curr.max(prev + n);
            prev = curr;
            curr = next;
        }
        curr
    }
    let n = nums.len();
    if n == 1 { return nums[0]; }
    nums[0].max(rob_line(&nums[1..]).max(rob_line(&nums[..n-1])))
}
```

#### Go

Inline closure for `robLine`. Three-way `max` via two `if` statements — annoying but pre-1.21 Go has no `max` builtin or variadic.

```go
func rob2(nums []int) int {
    robLine := func(houses []int) int {
        prev, curr := 0, 0
        for _, n := range houses {
            next := curr
            if prev+n > next { next = prev + n }
            prev, curr = curr, next
        }
        return curr
    }
    n := len(nums)
    if n == 1 { return nums[0] }
    a, b := robLine(nums[1:]), robLine(nums[:n-1])
    if nums[0] > a { a = nums[0] }
    if b > a { a = b }
    return a
}
```

#### C++

Iterator-based lambda `rob_line(begin, end)` — avoids copying the input slice. `std::max({...})` brace-list initializer for variadic max.

```cpp
#include <vector>
#include <algorithm>

int rob2(std::vector<int>& nums) {
    auto rob_line = [](std::vector<int>::iterator begin, std::vector<int>::iterator end) {
        int prev = 0, curr = 0;
        for (auto it = begin; it != end; ++it) {
            int next = std::max(curr, prev + *it);
            prev = curr;
            curr = next;
        }
        return curr;
    };
    int n = (int)nums.size();
    if (n == 1) return nums[0];
    return std::max({nums[0],
                     rob_line(nums.begin() + 1, nums.end()),
                     rob_line(nums.begin(), nums.end() - 1)});
}
```


### 106. Palindromic Substrings

#### Problem
Given a string `s`, return the number of substrings that are palindromes (single characters count).

#### Examples

TODO

#### Recognition
**Expand Around Center.** **O(n²)** time, **O(1)** space.

#### Explanation
Every palindrome has a center: a single character (odd length) or the gap between two characters (even length). There are `2n - 1` possible centers. For each center, expand outward while the characters match, incrementing the count at each successful expansion. This is simpler and more space-efficient than Manacher's `O(n)` algorithm, which is rarely needed in interviews. A DP table approach also works but uses `O(n²)` space and gives no speed advantage over this approach. The key insight: palindromes are self-similar around their center, so expansion naturally enumerates all of them.

#### Python

List `[(i, i), (i, i + 1)]` iterates both center types in one loop body. Single `count` variable, no need to track positions of palindromes.

```python
def countSubstrings(s):
    count = 0
    for i in range(len(s)):
        for l, r in [(i, i), (i, i + 1)]:
            while l >= 0 and r < len(s) and s[l] == s[r]:
                count += 1
                l -= 1
                r += 1
    return count
```

#### Java

A private `expand` helper with `charAt` comparisons mirrors the closure/lambda the other languages use; Java's lack of tuple iteration means two explicit calls per center. `count` is a field so the helper can accumulate.

```java
class Solution {
    private int count = 0;

    public int countSubstrings(String s) {
        for (int i = 0; i < s.length(); i++) {
            expand(s, i, i);
            expand(s, i, i + 1);
        }
        return count;
    }

    private void expand(String s, int l, int r) {
        while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) {
            count++;
            l--;
            r++;
        }
    }
}
```

#### Rust

Two separate expand blocks because Rust doesn't have a clean Python-style 'two-tuple inline iteration'. `i32` for `l` to allow negative values as the loop-termination signal.

```rust
fn count_substrings(s: String) -> i32 {
    let b = s.as_bytes();
    let n = b.len();
    let mut count = 0i32;
    for i in 0..n {
        // odd
        let (mut l, mut r) = (i as i32, i as i32);
        while l >= 0 && r < n as i32 && b[l as usize] == b[r as usize] {
            count += 1;
            l -= 1; r += 1;
        }
        // even
        let (mut l, mut r) = (i as i32, i as i32 + 1);
        while l >= 0 && r < n as i32 && b[l as usize] == b[r as usize] {
            count += 1;
            l -= 1; r += 1;
        }
    }
    count
}
```

#### Go

Closure `expand` captures `count` and `n` — clean reuse. Same two-call shape as Python.

```go
func countSubstrings(s string) int {
    count := 0
    n := len(s)
    expand := func(l, r int) {
        for l >= 0 && r < n && s[l] == s[r] {
            count++
            l--
            r++
        }
    }
    for i := 0; i < n; i++ {
        expand(i, i)
        expand(i, i+1)
    }
    return count
}
```

#### C++

Lambda `expand` with `[&]` capture; `--l; ++r` in one line keeps the inner loop dense.

```cpp
#include <string>

int countSubstrings(std::string& s) {
    int n = (int)s.size(), count = 0;
    auto expand = [&](int l, int r) {
        while (l >= 0 && r < n && s[l] == s[r]) {
            ++count; --l; ++r;
        }
    };
    for (int i = 0; i < n; ++i) {
        expand(i, i);
        expand(i, i + 1);
    }
    return count;
}
```


### 107. Decode Ways

#### Problem
A string of digits can be decoded where `'1'→'A'`, `'2'→'B'`, ..., `'26'→'Z'`. Count the number of ways to decode a non-empty digit string `s`.

#### Examples

TODO

#### Recognition
**DP (top-down memoization).** **O(n)** time, **O(n)** space.

#### Explanation
At each position `i` we have two choices: decode `s[i]` as a single digit (valid as long as `s[i] != '0'`) or decode `s[i:i+2]` as a two-digit number (valid when `10 <= val <= 26`). `'0'` can never stand alone, which is the critical edge case — a leading `'0'` at any position yields zero decodings from that point. We memoize `dfs(i)` to avoid exponential recomputation; the call tree branches only when both single and double decodes are valid. The base case `dp[len(s)] = 1` represents the empty suffix having exactly one decoding (the empty string).

#### Python

Top-down memo via `dp` dict. `int(s[i:i+2]) <= 26` is the validity check for the two-digit decode; the slice + `int` is clean but allocates per call.

```python
def numDecodings(s):
    dp = {len(s): 1}

    def dfs(i):
        if i in dp:
            return dp[i]
        if s[i] == "0":
            return 0
        res = dfs(i + 1)
        if i + 1 < len(s) and int(s[i:i+2]) <= 26:
            res += dfs(i + 2)
        dp[i] = res
        return res

    return dfs(0)
```

#### Java

Bottom-up over an `int[] dp`; `s.charAt(i) - '0'` byte arithmetic builds the two-digit value with no substring allocation. `dp[n] = 1` seeds the empty-suffix base case.

```java
class Solution {
    public int numDecodings(String s) {
        int n = s.length();
        int[] dp = new int[n + 1];
        dp[n] = 1;
        for (int i = n - 1; i >= 0; i--) {
            if (s.charAt(i) == '0') continue;
            dp[i] = dp[i + 1];
            if (i + 1 < n) {
                int two = (s.charAt(i) - '0') * 10 + (s.charAt(i + 1) - '0');
                if (two <= 26) dp[i] += dp[i + 2];
            }
        }
        return dp[0];
    }
}
```

#### Rust

Bottom-up DP avoids recursion. Byte arithmetic `(b[i] - b'0') as i32 * 10 + ...` for the two-digit value — no allocation.

```rust
fn num_decodings(s: String) -> i32 {
    let b = s.as_bytes();
    let n = b.len();
    let mut dp = vec![0i32; n + 1];
    dp[n] = 1;
    for i in (0..n).rev() {
        if b[i] == b'0' { continue; }
        dp[i] = dp[i + 1];
        if i + 1 < n {
            let two = (b[i] - b'0') as i32 * 10 + (b[i+1] - b'0') as i32;
            if two <= 26 { dp[i] += dp[i + 2]; }
        }
    }
    dp[0]
}
```

#### Go

Bottom-up iterative. `int(s[i]-'0')*10 + int(s[i+1]-'0')` computes the two-digit value without allocation, using byte arithmetic.

```go
func numDecodings(s string) int {
    n := len(s)
    dp := make([]int, n+1)
    dp[n] = 1
    for i := n - 1; i >= 0; i-- {
        if s[i] == '0' { continue }
        dp[i] = dp[i+1]
        if i+1 < n {
            two := int(s[i]-'0')*10 + int(s[i+1]-'0')
            if two <= 26 { dp[i] += dp[i+2] }
        }
    }
    return dp[0]
}
```

#### C++

Bottom-up with `std::vector<int>(n+1, 0)` initialized DP. Same byte-arithmetic two-digit construction as Go/Rust.

```cpp
#include <string>
#include <vector>

int numDecodings(std::string& s) {
    int n = (int)s.size();
    std::vector<int> dp(n + 1, 0);
    dp[n] = 1;
    for (int i = n - 1; i >= 0; --i) {
        if (s[i] == '0') continue;
        dp[i] = dp[i + 1];
        if (i + 1 < n) {
            int two = (s[i] - '0') * 10 + (s[i+1] - '0');
            if (two <= 26) dp[i] += dp[i + 2];
        }
    }
    return dp[0];
}
```


### 108. Coin Change

#### Problem
Given an array of coin denominations and a target `amount`, return the minimum number of coins needed to make up that amount, or `-1` if it's impossible.

#### Examples

```text
Input: coins = [1,2,5], amount = 11
Output: 3
Explanation: 11 = 5 + 5 + 1.

Input: coins = [2], amount = 3
Output: -1

Input: coins = [1], amount = 0
Output: 0

Constraints:
- 1 <= coins.length <= 12
- 1 <= coins[i] <= 2^31 - 1
- 0 <= amount <= 10^4
```

#### Recognition
**Signals.** "Minimum number of coins" is an optimisation over repeated choices, and `amount` arrives as its own bound (`<= 10^4`) rather than being derived from the array, which is the tell that it is a second state dimension. Coins are reusable without limit, so each denomination can be picked any number of times. **Therefore.** Unbounded knapsack: `dp[a]` is the fewest coins making `a`, `dp[a] = 1 + min(dp[a - c])` over coins `c <= a`, base `dp[0] = 0`, unreachable amounts left at infinity. **Not greedy**, taking the largest coin that fits: with `coins = [1,3,4]` and `amount = 6` that picks `4 + 1 + 1` for three coins, while `3 + 3` needs two. Greedy is correct only for canonical systems such as ordinary currency, and nothing in the constraints promises one. **Not plain recursion on the remainder**, which re-solves the same remaining amount once per ordering of the same multiset of coins. **O(n * amount)** time, **O(amount)** space.

#### Explanation
**Brute force.** Recurse on the remaining amount, trying every coin.

```python
def coinChange(coins, amount):
    def rec(rem):
        if rem == 0:
            return 0
        if rem < 0:
            return -1
        best = -1
        for c in coins:
            sub = rec(rem - c)
            if sub >= 0 and (best < 0 or sub + 1 < best):
                best = sub + 1
        return best
    return rec(amount)
```

`O(n^amount)` time, `O(amount)` stack.

**Wasteful because.** With `coins = [1,2,5]`, remainder 4 is reached from 6 by taking `2`, by taking `1,1`, and by taking `1` then `1` in the other order, and the identical subtree is rebuilt each time. Only the remainder matters, so every distinct ordering of the same coins is redundant work.

**Optimal.** The state is a single integer, the remaining amount, so there are only `amount + 1` distinct subproblems. Solve them in increasing order and each is answered once: `dp[a] = 1 + min(dp[a - c])` over the coins that fit. Reusability is what keeps the state that small, since a coin may be taken again there is no "which coins are still available" component, unlike 0/1 knapsack. The conceptual table is 2-D, `dp[i][a]` over the first `i` denominations and every amount, at `O(n * amount)` space; because a coin can be reused, row `i` reads from row `i` rather than row `i - 1`, so the rows collapse into a single array of `amount + 1` entries and the space drops to `O(amount)`. Infinity is the honest base for unreachable amounts: `-1` would compare as smaller than any real count and poison the `min`.

**Edge cases.** `amount = 0` returns 0 without entering the loop. Coins larger than the target are skipped by the `c <= a` guard, and if every coin is too large `dp[amount]` stays infinite and the answer is `-1`. The sentinel must survive `+ 1` in a fixed-width type, so the typed solutions either pick `amount + 1` as infinity or guard the read before adding. Duplicate denominations are harmless, just repeated work.

#### Python

`dp[0] = 0`, rest `float('inf')`. Outer amount loop, inner coin loop — unbounded knapsack form. Returns `-1` when `dp[amount]` remained infinity.

```python
def coinChange(coins, amount):
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0
    for a in range(1, amount + 1):
        for c in coins:
            if a - c >= 0:
                dp[a] = min(dp[a], dp[a - c] + 1)
    return dp[amount] if dp[amount] != float('inf') else -1
```

#### Java

`Arrays.fill(dp, amount + 1)` uses a safe sentinel above any real answer (each coin is at least 1), sidestepping `Integer.MAX_VALUE` overflow when adding 1. `Math.min` keeps the inner body one line.

```java
import java.util.*;

class Solution {
    public int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, amount + 1);
        dp[0] = 0;
        for (int a = 1; a <= amount; a++) {
            for (int c : coins) {
                if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);
            }
        }
        return dp[amount] > amount ? -1 : dp[amount];
    }
}
```

#### Rust

`i32::MAX` as the unreachable sentinel; `dp[a - c] != i32::MAX` guard prevents `MAX + 1` overflow.

```rust
fn coin_change(coins: Vec<i32>, amount: i32) -> i32 {
    let amount = amount as usize;
    let mut dp = vec![i32::MAX; amount + 1];
    dp[0] = 0;
    for a in 1..=amount {
        for &c in &coins {
            let c = c as usize;
            if c <= a && dp[a - c] != i32::MAX {
                dp[a] = dp[a].min(dp[a - c] + 1);
            }
        }
    }
    if dp[amount] == i32::MAX { -1 } else { dp[amount] }
}
```

#### Go

Same sentinel-and-guard pattern; explicit `if ... { dp[a] = ... }` because Go has no `min` builtin pre-1.21.

```go
func coinChange(coins []int, amount int) int {
    const inf = 1<<31 - 1
    dp := make([]int, amount+1)
    for i := range dp { dp[i] = inf }
    dp[0] = 0
    for a := 1; a <= amount; a++ {
        for _, c := range coins {
            if c <= a && dp[a-c] != inf && dp[a-c]+1 < dp[a] {
                dp[a] = dp[a-c] + 1
            }
        }
    }
    if dp[amount] == inf { return -1 }
    return dp[amount]
}
```

#### C++

`INT_MAX` sentinel with the guard. `std::min` keeps the body single-line.

```cpp
#include <vector>
#include <algorithm>
#include <climits>

int coinChange(std::vector<int>& coins, int amount) {
    std::vector<int> dp(amount + 1, INT_MAX);
    dp[0] = 0;
    for (int a = 1; a <= amount; ++a) {
        for (int c : coins) {
            if (c <= a && dp[a - c] != INT_MAX)
                dp[a] = std::min(dp[a], dp[a - c] + 1);
        }
    }
    return dp[amount] == INT_MAX ? -1 : dp[amount];
}
```


### 109. Maximum Product Subarray

#### Problem
Given an integer array `nums`, find the contiguous subarray with the largest product and return that product.

#### Examples

TODO

#### Recognition
**DP (track running min and max).** **O(n)** time, **O(1)** space.

#### Explanation
Unlike Maximum Subarray (where negatives just reset), products can flip sign: multiplying a very negative `curMin` by a negative number can suddenly produce the largest value. So we track both `curMax` and `curMin` simultaneously. At each element we consider three candidates: start fresh with just `n`, extend the current max subarray, or extend the current min subarray (in case `n` is negative). We reset both to `1` when `n == 0` since a zero breaks any ongoing product. The answer is the running maximum of all `curMax` values. Initializing `res = max(nums)` handles single-element arrays correctly.

#### Python

Three-way `max(n, cur_max * n, cur_min * n)` captures the sign-flip insight — multiplying by a negative can promote the previous min to the new max. `tmp = cur_max * n` saves the old max before overwriting it.

```python
def maxProduct(nums):
    res = max(nums)
    cur_min = cur_max = 1
    for n in nums:
        if n == 0:
            cur_min = cur_max = 1
            continue
        tmp = cur_max * n
        cur_max = max(n, cur_max * n, cur_min * n)
        cur_min = min(n, tmp, cur_min * n)
        res = max(res, cur_max)
    return res
```

#### Java

`Math.max` chains for the three-way comparison (no brace-list variadic like C++); `tmp` saves the pre-update `curMax` so the min uses the old value. Seed `res` with a manual scan for the max element.

```java
class Solution {
    public int maxProduct(int[] nums) {
        int res = nums[0];
        for (int n : nums) res = Math.max(res, n);
        int curMin = 1, curMax = 1;
        for (int n : nums) {
            if (n == 0) {
                curMin = 1;
                curMax = 1;
                continue;
            }
            int tmp = curMax * n;
            curMax = Math.max(n, Math.max(curMax * n, curMin * n));
            curMin = Math.min(n, Math.min(tmp, curMin * n));
            res = Math.max(res, curMax);
        }
        return res;
    }
}
```

#### Rust

Chained `.max(...).max(...)` for three-way max; same for `.min(...).min(...)`. `tmp` saves the pre-update `cur_max`.

```rust
fn max_product(nums: Vec<i32>) -> i32 {
    let mut res = *nums.iter().max().unwrap();
    let (mut cur_min, mut cur_max) = (1i32, 1i32);
    for n in nums {
        if n == 0 {
            cur_min = 1; cur_max = 1;
            continue;
        }
        let tmp = cur_max * n;
        cur_max = n.max(cur_max * n).max(cur_min * n);
        cur_min = n.min(tmp).min(cur_min * n);
        res = res.max(cur_max);
    }
    res
}
```

#### Go

Helper `max3`/`min3` functions — variadic max with three args, pre-1.21. The reset on `n == 0` is the same trick as the other languages.

```go
func maxProduct(nums []int) int {
    res := nums[0]
    for _, n := range nums[1:] {
        if n > res { res = n }
    }
    curMin, curMax := 1, 1
    for _, n := range nums {
        if n == 0 {
            curMin, curMax = 1, 1
            continue
        }
        tmp := curMax * n
        curMax = max3(n, curMax*n, curMin*n)
        curMin = min3(n, tmp, curMin*n)
        if curMax > res { res = curMax }
    }
    return res
}
func max3(a, b, c int) int {
    if a < b { a = b }
    if a < c { a = c }
    return a
}
func min3(a, b, c int) int {
    if a > b { a = b }
    if a > c { a = c }
    return a
}
```

#### C++

`std::max({n, cur_max * n, cur_min * n})` brace-list initializer for variadic max — C++11 onwards. Cleanest of the four for the three-way comparison.

```cpp
#include <vector>
#include <algorithm>

int maxProduct(std::vector<int>& nums) {
    int res = *std::max_element(nums.begin(), nums.end());
    int cur_min = 1, cur_max = 1;
    for (int n : nums) {
        if (n == 0) { cur_min = cur_max = 1; continue; }
        int tmp = cur_max * n;
        cur_max = std::max({n, cur_max * n, cur_min * n});
        cur_min = std::min({n, tmp, cur_min * n});
        res = std::max(res, cur_max);
    }
    return res;
}
```


### 110. Word Break

#### Problem
Given a string `s` and a dictionary `wordDict`, return `true` if `s` can be segmented into a space-separated sequence of one or more dictionary words.

#### Examples

TODO

#### Recognition
**DP (bottom-up, right-to-left).** **O(n² * m)** time, **O(n)** space, where `m` is average word length.

#### Explanation
`dp[i]` means the suffix `s[i:]` can be fully segmented. The base case `dp[n] = True` represents the empty suffix. For each position `i` from right to left, we try every word `w` in the dictionary: if `s[i:i+len(w)] == w` and `dp[i + len(w)]` is true, then `dp[i]` is true and we can break early. A recursive approach without memoization leads to exponential recomputation; converting to a trie can improve inner loop efficiency but adds complexity. The key edge case: words can overlap in unexpected ways, but the DP naturally handles all combinations.

#### Python

Right-to-left DP with early `break` once `dp[i]` is found true. Slicing `s[i:i+len(w)]` allocates per check; for huge inputs a trie would be faster.

```python
def wordBreak(s, wordDict):
    dp = [False] * (len(s) + 1)
    dp[len(s)] = True
    for i in range(len(s) - 1, -1, -1):
        for w in wordDict:
            if s[i:i + len(w)] == w:
                dp[i] = dp[i + len(w)]
            if dp[i]:
                break
    return dp[0]
```

#### Java

`s.regionMatches(i, w, 0, wn)` compares the window against the word without allocating a substring — cleaner and cheaper than `s.substring(i, i + wn).equals(w)`. Right-to-left fill with early `break`.

```java
import java.util.*;

class Solution {
    public boolean wordBreak(String s, List<String> wordDict) {
        int n = s.length();
        boolean[] dp = new boolean[n + 1];
        dp[n] = true;
        for (int i = n - 1; i >= 0; i--) {
            for (String w : wordDict) {
                int wn = w.length();
                if (i + wn <= n && s.regionMatches(i, w, 0, wn) && dp[i + wn]) {
                    dp[i] = true;
                    break;
                }
            }
        }
        return dp[0];
    }
}
```

#### Rust

Byte-slice comparison `&sb[i..i+wn] == w.as_bytes()` avoids the `String` allocation. `i + wn <= n` guard prevents slice OOB before the comparison.

```rust
fn word_break(s: String, word_dict: Vec<String>) -> bool {
    let n = s.len();
    let mut dp = vec![false; n + 1];
    dp[n] = true;
    let sb = s.as_bytes();
    for i in (0..n).rev() {
        for w in &word_dict {
            let wn = w.len();
            if i + wn <= n && &sb[i..i+wn] == w.as_bytes() && dp[i + wn] {
                dp[i] = true;
                break;
            }
        }
    }
    dp[0]
}
```

#### Go

`s[i:i+wn] == w` — Go string equality on slices is O(n) but doesn't allocate (the slice is a view). Same right-to-left + early break.

```go
func wordBreak(s string, wordDict []string) bool {
    n := len(s)
    dp := make([]bool, n+1)
    dp[n] = true
    for i := n - 1; i >= 0; i-- {
        for _, w := range wordDict {
            wn := len(w)
            if i+wn <= n && s[i:i+wn] == w && dp[i+wn] {
                dp[i] = true
                break
            }
        }
    }
    return dp[0]
}
```

#### C++

`s.substr(i, wn) == w` allocates the substring; an iterator-based compare would avoid it. For typical inputs the allocation cost is negligible.

```cpp
#include <vector>
#include <string>

bool wordBreak(std::string& s, std::vector<std::string>& wordDict) {
    int n = (int)s.size();
    std::vector<bool> dp(n + 1, false);
    dp[n] = true;
    for (int i = n - 1; i >= 0; --i) {
        for (auto& w : wordDict) {
            int wn = (int)w.size();
            if (i + wn <= n && s.substr(i, wn) == w && dp[i + wn]) {
                dp[i] = true;
                break;
            }
        }
    }
    return dp[0];
}
```


### 111. Longest Increasing Subsequence

#### Problem
Given an integer array `nums`, return the length of the longest strictly increasing subsequence.

#### Examples

```text
Input: nums = [10,9,2,5,3,7,101,18]
Output: 4
Explanation: the subsequence is [2,3,7,101].

Input: nums = [0,1,0,3,2,3]
Output: 4

Input: nums = [7,7,7,7,7,7,7]
Output: 1

Constraints:
- 1 <= nums.length <= 2500
- -10^4 <= nums[i] <= 10^4
- the subsequence must be strictly increasing
```

#### Recognition
**Signals.** "Longest" over an array fires the sliding-window reflex, and the word that stops it is *subsequence*: elements may be skipped, so the answer is not a contiguous stretch. "Strictly increasing" makes the comparison a total order, which is what lets one number summarise a whole prefix of choices. `n <= 2500` leaves `O(n^2)` affordable and rewards better. **Therefore.** Maintain `tails`, where `tails[k]` is the smallest value that can end an increasing subsequence of length `k + 1`. That array is sorted by construction, so each element is binary searched into it and either appended or written over the first entry it is not larger than; the final length is the answer. **Not a sliding window**, because there is no left pointer whose advance repairs a violated condition, and the window is not the answer once elements can be skipped. **Not greedily extending one chain**, which on `[10,9,2,5,3,7]` commits to 10 and reports 1. **O(n log n)** time, **O(n)** space.

#### Explanation
**Brute force.** Include or exclude each element, tracking the last one kept.

```python
def lengthOfLIS(nums):
    def rec(i, prev):
        if i == len(nums):
            return 0
        best = rec(i + 1, prev)
        if prev is None or nums[i] > prev:
            best = max(best, 1 + rec(i + 1, nums[i]))
        return best
    return rec(0, None)
```

`O(2^n)` time, `O(n)` stack.

**Wasteful because.** Two different sets of earlier picks that end on the same element leave exactly the same problem behind, yet each is explored in full. `rec(i, prev)` reads only that pair, so on `[1,2,3,9]` the choices `[1,2]` and `[2]` both arrive at index 2 with `prev = 2` and rebuild the same subtree.

**Optimal.** Memoising `(i, prev)` gives the `O(n^2)` DP everyone writes first: `dp[i]` is the best length ending at `i`, found by scanning earlier `j` with `nums[j] < nums[i]`. The shipped solution drops `dp` entirely, because among all increasing subsequences of a given length only the one with the smallest tail can ever matter, and anything that extends a larger tail extends a smaller one too. So keep one value per length in `tails`, which stays sorted, and place each new element with a binary search: it either extends the longest run by appending or lowers the smallest tail at its own length by overwriting. `tails` is not itself a valid subsequence, only the right length, and saying so unprompted is the senior signal. Prefer the `O(n^2)` DP when you must reconstruct the actual subsequence, or when the ordering is partial rather than total so binary search has nothing to exploit.

**Edge cases.** A single element answers 1. All-equal input answers 1, which is exactly what `bisect_left` rather than `bisect_right` enforces for strict increase. Strictly decreasing input also answers 1, with `tails` overwritten at index 0 each time. Negative values need no handling, since only comparisons are used.

#### Python

`bisect.bisect_left` finds the leftmost insertion point — exactly the patience-sorting position. Replacing in place (vs. inserting) keeps `tails` the same length.

```python
import bisect

def lengthOfLIS(nums):
    tails = []
    for n in nums:
        pos = bisect.bisect_left(tails, n)
        if pos == len(tails):
            tails.append(n)
        else:
            tails[pos] = n
    return len(tails)
```

#### Java

`Arrays.binarySearch` returns `-(insertionPoint) - 1` for a miss, so `-(pos) - 1` recovers the leftmost slot — the patience-sorting position. Track `size` manually to reuse a fixed-length `int[]` as the growable `tails`.

```java
import java.util.*;

class Solution {
    public int lengthOfLIS(int[] nums) {
        int[] tails = new int[nums.length];
        int size = 0;
        for (int n : nums) {
            int pos = Arrays.binarySearch(tails, 0, size, n);
            if (pos < 0) pos = -(pos) - 1;
            tails[pos] = n;
            if (pos == size) size++;
        }
        return size;
    }
}
```

#### Rust

`partition_point` is the binary search primitive Rust uses for this — returns the index where the predicate flips false→true. `|&x| x < n` gives the equivalent of `bisect_left`.

```rust
fn length_of_lis(nums: Vec<i32>) -> i32 {
    let mut tails: Vec<i32> = Vec::new();
    for n in nums {
        let pos = tails.partition_point(|&x| x < n);
        if pos == tails.len() {
            tails.push(n);
        } else {
            tails[pos] = n;
        }
    }
    tails.len() as i32
}
```

#### Go

`sort.SearchInts(tails, n)` is the type-specific binary search; returns the insertion index. Modern Go would use `slices.BinarySearch`.

```go
import "sort"

func lengthOfLIS(nums []int) int {
    tails := []int{}
    for _, n := range nums {
        pos := sort.SearchInts(tails, n)
        if pos == len(tails) {
            tails = append(tails, n)
        } else {
            tails[pos] = n
        }
    }
    return len(tails)
}
```

#### C++

`std::lower_bound` returns an iterator to the first element ≥ `n` — exactly the patience-sort position. Iterator comparison `it == tails.end()` checks for 'beyond the back'.

```cpp
#include <vector>
#include <algorithm>

int lengthOfLIS(std::vector<int>& nums) {
    std::vector<int> tails;
    for (int n : nums) {
        auto it = std::lower_bound(tails.begin(), tails.end(), n);
        if (it == tails.end()) tails.push_back(n);
        else *it = n;
    }
    return (int)tails.size();
}
```


### 112. Partition Equal Subset Sum

#### Problem
Given an integer array `nums`, determine whether it can be partitioned into two subsets with equal sum.

#### Examples

```text
Input: nums = [1,5,11,5]
Output: true
Explanation: [1,5,5] and [11] both sum to 11.

Input: nums = [1,2,3,5]
Output: false

Input: nums = [2,2,3,5]
Output: false
Explanation: the total is 12 but no subset reaches 6.

Constraints:
- 1 <= nums.length <= 200
- 1 <= nums[i] <= 100
- 1 <= sum(nums) <= 20000
```

#### Recognition
**Signals.** "Can it be partitioned" is a yes/no feasibility question, not a count and not an optimum. The two halves must be equal, so each is exactly `total / 2`, and the problem collapses to a single subset-sum query against a bounded target. Every element lands on exactly one side, so each is used **at most once**. At most 200 values of at most 100 caps the sum at 20000, small enough to index an array by, which is what makes a pseudo-polynomial `O(n * sum)` acceptable. **Therefore.** 0/1 knapsack over reachable sums: `dp[s]` is whether sum `s` is achievable, seeded `dp[0] = True`, answer `dp[total // 2]` after an odd-total early exit. **Not backtracking over subsets**, which is the right shape only when the subsets themselves are the output; here two branches that leave the same remaining target are interchangeable, so a memo collapses them and there is nothing left to enumerate. **Not the unbounded-knapsack loop order** of Coin Change: sweeping sums upward lets one number be spent twice, and `[1,5]` would wrongly report `true` for target 3. **O(n * sum)** time, **O(sum)** space.

#### Explanation
**Brute force.** Take or skip each number, chasing the remaining half.

```python
def canPartition(nums):
    total = sum(nums)
    if total % 2:
        return False
    def rec(i, rem):
        if rem == 0:
            return True
        if i == len(nums) or rem < 0:
            return False
        return rec(i + 1, rem - nums[i]) or rec(i + 1, rem)
    return rec(0, total // 2)
```

`O(2^n)` time, `O(n)` stack.

**Wasteful because.** Different take/skip patterns over the same prefix often remove the same total, and then leave an identical state. On `nums = [1,2,3,...]`, taking 1 and 2 while skipping 3, and skipping 1 and 2 while taking 3, both reach index 3 with the target reduced by 3, and the whole remaining search runs twice. With 200 numbers there are `2^200` paths but only `200 * 10001` distinct `(i, rem)` pairs.

**Optimal.** Memoising `(i, rem)` is the direct fix, and because the numbers are consumed in order the `i` dimension can be swept away as well. Keep one boolean row over sums `0..target` and, for each number `n`, mark `dp[s]` true wherever `dp[s - n]` was already true. The conceptual table is 2-D, `dp[i][s]` over the first `i` numbers and every sum up to `target`, at `O(n * sum)` space; iterating `s` **downward** guarantees each write reads a cell that still holds the previous row's value, so the rows collapse to a single array and the space drops to `O(sum)`. Sweeping upward instead would read a cell this same number just updated, reusing it and turning the recurrence into the unbounded one. The Python solution shown keeps a `set` of reachable sums instead of the array, which expresses the same take-or-skip step without needing loop-order discipline, at the cost of not capping anything at `target`.

**Edge cases.** An odd total is impossible and exits before any DP runs. A single element can never be split; its total is odd, or half of it is unreachable from the empty set. `dp[0] = True` is the empty subset, not a special case. Every value is at least 1 here, so sums only grow; zeros or negatives would break the downward sweep's bounds.

#### Python

Set union `{s + n for s in dp} | dp` — concise expression of the 'extend or skip' choice. Set grows to O(target) at worst; a bool array would be faster but less elegant.

```python
def canPartition(nums):
    if sum(nums) % 2:
        return False
    target = sum(nums) // 2
    dp = {0}
    for n in nums:
        dp = {s + n for s in dp} | dp
    return target in dp
```

#### Java

`boolean[]` DP with the backwards inner loop (`s` from `target` down to `n`) is what keeps each element used at most once — the in-place 0/1 knapsack. Odd total exits early.

```java
class Solution {
    public boolean canPartition(int[] nums) {
        int total = 0;
        for (int n : nums) total += n;
        if (total % 2 != 0) return false;
        int target = total / 2;
        boolean[] dp = new boolean[target + 1];
        dp[0] = true;
        for (int n : nums) {
            for (int s = target; s >= n; s--) {
                if (dp[s - n]) dp[s] = true;
            }
        }
        return dp[target];
    }
}
```

#### Rust

Bool array DP with backwards iteration `(n..=target).rev()` — the reverse traversal is what makes 0/1 knapsack work in-place (each element used at most once).

```rust
fn can_partition(nums: Vec<i32>) -> bool {
    let total: i32 = nums.iter().sum();
    if total % 2 != 0 { return false; }
    let target = (total / 2) as usize;
    let mut dp = vec![false; target + 1];
    dp[0] = true;
    for n in nums {
        let n = n as usize;
        for s in (n..=target).rev() {
            if dp[s - n] { dp[s] = true; }
        }
    }
    dp[target]
}
```

#### Go

Same backwards-iteration trick — `for s := target; s >= n; s--`. Bool slice for the DP table; pre-1.21 has no `min` but only equality assignment is needed.

```go
func canPartition(nums []int) bool {
    total := 0
    for _, n := range nums { total += n }
    if total%2 != 0 { return false }
    target := total / 2
    dp := make([]bool, target+1)
    dp[0] = true
    for _, n := range nums {
        for s := target; s >= n; s-- {
            if dp[s-n] { dp[s] = true }
        }
    }
    return dp[target]
}
```

#### C++

`std::vector<bool>` (bit-packed) for the DP table; same backwards-iteration trick. `std::accumulate` for the sum.

```cpp
#include <vector>
#include <numeric>

bool canPartition(std::vector<int>& nums) {
    int total = std::accumulate(nums.begin(), nums.end(), 0);
    if (total % 2) return false;
    int target = total / 2;
    std::vector<bool> dp(target + 1, false);
    dp[0] = true;
    for (int n : nums) {
        for (int s = target; s >= n; --s) {
            if (dp[s - n]) dp[s] = true;
        }
    }
    return dp[target];
}
```


### 113. Unique Paths

#### Problem
A robot starts at the top-left of an `m x n` grid and can only move right or down. Count the number of unique paths to the bottom-right corner.

#### Examples

TODO

#### Recognition
**DP (1-D rolling row).** **O(m * n)** time, **O(n)** space.

#### Explanation
`dp[j]` represents the number of ways to reach column `j` in the current row. Initially every cell in the first row has exactly one path (only rightward moves). For each subsequent row, the value at column `j` equals the number of paths from above (`dp[j]`, unchanged) plus paths from the left (`dp[j-1]`, just updated). We update left-to-right in-place, so each update correctly uses the freshly computed left value. The mathematically closed form `C(m+n-2, m-1)` computes the answer in O(min(m,n)) but requires careful handling of large intermediate values; the DP is simpler to verify.

#### Python

1-D rolling DP: `dp[j] += dp[j - 1]` updates left-to-right, so the freshly-updated left value is correctly used. Initialization `[1] * n` represents the first row.

```python
def uniquePaths(m, n):
    dp = [1] * n
    for _ in range(m - 1):
        for j in range(1, n):
            dp[j] += dp[j - 1]
    return dp[-1]
```

#### Java

`Arrays.fill(dp, 1)` seeds the first row in one call. Left-to-right in-place `dp[j] += dp[j - 1]` collapses the grid to a single rolling row.

```java
import java.util.*;

class Solution {
    public int uniquePaths(int m, int n) {
        int[] dp = new int[n];
        Arrays.fill(dp, 1);
        for (int i = 1; i < m; i++) {
            for (int j = 1; j < n; j++) {
                dp[j] += dp[j - 1];
            }
        }
        return dp[n - 1];
    }
}
```

#### Rust

`vec![1i32; n]` for the initial row. Identical structure to Python — DP collapses to one row because each cell only depends on (above, left).

```rust
fn unique_paths(m: i32, n: i32) -> i32 {
    let (m, n) = (m as usize, n as usize);
    let mut dp = vec![1i32; n];
    for _ in 1..m {
        for j in 1..n {
            dp[j] += dp[j - 1];
        }
    }
    dp[n - 1]
}
```

#### Go

Plain `make([]int, n)` then a loop to fill with 1s. Same rolling-row pattern; the algorithm is language-independent here.

```go
func uniquePaths(m int, n int) int {
    dp := make([]int, n)
    for i := range dp { dp[i] = 1 }
    for i := 1; i < m; i++ {
        for j := 1; j < n; j++ {
            dp[j] += dp[j-1]
        }
    }
    return dp[n-1]
}
```

#### C++

`std::vector<int>(n, 1)` constructor fills with 1. Two nested loops, no algorithm tricks.

```cpp
#include <vector>

int uniquePaths(int m, int n) {
    std::vector<int> dp(n, 1);
    for (int i = 1; i < m; ++i)
        for (int j = 1; j < n; ++j)
            dp[j] += dp[j - 1];
    return dp[n - 1];
}
```


### 114. Longest Common Subsequence

#### Problem
Given two strings `text1` and `text2`, return the length of their longest common subsequence. A subsequence does not need to be contiguous.

#### Examples

```text
Input: text1 = "abcde", text2 = "ace"
Output: 3
Explanation: the longest common subsequence is "ace".

Input: text1 = "abc", text2 = "abc"
Output: 3

Input: text1 = "abc", text2 = "def"
Output: 0

Constraints:
- 1 <= text1.length, text2.length <= 1000
- both strings are lowercase English letters
- a subsequence may skip characters on either side
```

#### Recognition
**Signals.** Two strings compared against each other, and the word *subsequence* rather than *substring*: characters may be skipped on either side, so no window and no single scan position holds enough state. Two independent positions to track is what makes the state a pair. "Return the length" rather than the string itself means nothing but a number has to be carried. `1000 * 1000` is a million cells, comfortably inside budget. **Therefore.** 2-D DP over suffixes: `dp[i][j]` is the LCS length of `text1[i:]` and `text2[j:]`, taking `1 + dp[i+1][j+1]` on a character match and `max(dp[i+1][j], dp[i][j+1])` otherwise. **Not the longest-common-substring recurrence**, whose mismatch case resets the run to 0 instead of taking a max over two skips; on `"abcde"` and `"ace"` that reports 1 rather than 3. **Not two pointers**, which can decide whether one string is a subsequence of the other but has no rule for which side to advance on a mismatch, because either branch can be the winner. **O(m * n)** time, **O(m * n)** space.

#### Explanation
**Brute force.** Recurse on both positions, branching at every mismatch.

```python
def longestCommonSubsequence(text1, text2):
    def rec(i, j):
        if i == len(text1) or j == len(text2):
            return 0
        if text1[i] == text2[j]:
            return 1 + rec(i + 1, j + 1)
        return max(rec(i + 1, j), rec(i, j + 1))
    return rec(0, 0)
```

`O(2^(m + n))` time, `O(m + n)` stack.

**Wasteful because.** The two mismatch branches reconverge. From `(i, j)`, skipping `text1[i]` and then `text2[j]`, or skipping them in the other order, both land on `(i + 1, j + 1)`, so that subtree is rebuilt twice at every mismatch and the duplication compounds with depth.

**Optimal.** The recursion only ever asks about a pair of suffix starts, and there are `(m + 1) * (n + 1)` of those, so fill a table rather than recurse. Sweeping `i` and `j` downward from the ends means `dp[i+1][j+1]`, `dp[i+1][j]` and `dp[i][j+1]` are all written before `dp[i][j]` needs them, and the row and column of zeros at the far edges encode "one string is exhausted". The match case is not a choice: when `text1[i] == text2[j]` some optimal LCS always pairs them, so no `max` belongs there, and putting one in costs nothing but hides the argument. This solution holds the whole `(m + 1) * (n + 1)` table at `O(m * n)` space, which is what lets you walk back through it to recover the actual subsequence; if only the length is wanted, two rolling rows suffice and the space falls to `O(min(m, n))` by making the shorter string the inner dimension.

**Edge cases.** Disjoint alphabets give 0, which the zero-filled table produces with no special branch. Identical strings give the full length. Repeated characters need no care because the state is a pair of positions, not a character. Empty input is excluded by the constraints, but the extra row and column would answer 0 anyway.

#### Python

Bottom-up 2-D DP, iterating from the end. The match case (`1 + dp[i+1][j+1]`) vs. the mismatch case (`max` of skip-from-either) is the heart of LCS.

```python
def longestCommonSubsequence(text1, text2):
    dp = [[0] * (len(text2) + 1) for _ in range(len(text1) + 1)]
    for i in range(len(text1) - 1, -1, -1):
        for j in range(len(text2) - 1, -1, -1):
            if text1[i] == text2[j]:
                dp[i][j] = 1 + dp[i + 1][j + 1]
            else:
                dp[i][j] = max(dp[i + 1][j], dp[i][j + 1])
    return dp[0][0]
```

#### Java

`charAt` comparison drives the suffix DP; a fresh `int[m+1][n+1]` is zero-initialized by the JVM, so the base row/column need no explicit setup. `Math.max` handles the mismatch case.

```java
class Solution {
    public int longestCommonSubsequence(String text1, String text2) {
        int m = text1.length(), n = text2.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = m - 1; i >= 0; i--) {
            for (int j = n - 1; j >= 0; j--) {
                if (text1.charAt(i) == text2.charAt(j)) {
                    dp[i][j] = 1 + dp[i + 1][j + 1];
                } else {
                    dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
                }
            }
        }
        return dp[0][0];
    }
}
```

#### Rust

Pre-collect both strings into `Vec<u8>` — byte indexing is O(1) and equality is just byte compare. Avoids per-call string indexing overhead.

```rust
fn longest_common_subsequence(text1: String, text2: String) -> i32 {
    let (t1, t2): (Vec<u8>, Vec<u8>) = (text1.bytes().collect(), text2.bytes().collect());
    let (m, n) = (t1.len(), t2.len());
    let mut dp = vec![vec![0i32; n + 1]; m + 1];
    for i in (0..m).rev() {
        for j in (0..n).rev() {
            if t1[i] == t2[j] {
                dp[i][j] = 1 + dp[i + 1][j + 1];
            } else {
                dp[i][j] = dp[i + 1][j].max(dp[i][j + 1]);
            }
        }
    }
    dp[0][0]
}
```

#### Go

Direct byte indexing `text1[i] == text2[j]` works for ASCII. The `else if / else` ladder replaces a `max` builtin.

```go
func longestCommonSubsequence(text1 string, text2 string) int {
    m, n := len(text1), len(text2)
    dp := make([][]int, m+1)
    for i := range dp { dp[i] = make([]int, n+1) }
    for i := m - 1; i >= 0; i-- {
        for j := n - 1; j >= 0; j-- {
            if text1[i] == text2[j] {
                dp[i][j] = 1 + dp[i+1][j+1]
            } else if dp[i+1][j] > dp[i][j+1] {
                dp[i][j] = dp[i+1][j]
            } else {
                dp[i][j] = dp[i][j+1]
            }
        }
    }
    return dp[0][0]
}
```

#### C++

Ternary `?:` for the recurrence keeps it tight. `std::max` from `<algorithm>` for the mismatch case.

```cpp
#include <vector>
#include <string>
#include <algorithm>

int longestCommonSubsequence(std::string& text1, std::string& text2) {
    int m = (int)text1.size(), n = (int)text2.size();
    std::vector<std::vector<int>> dp(m + 1, std::vector<int>(n + 1, 0));
    for (int i = m - 1; i >= 0; --i)
        for (int j = n - 1; j >= 0; --j)
            dp[i][j] = (text1[i] == text2[j])
                      ? 1 + dp[i+1][j+1]
                      : std::max(dp[i+1][j], dp[i][j+1]);
    return dp[0][0];
}
```


### 115. Best Time to Buy and Sell Stock with Cooldown

#### Problem
Given an array of stock prices, maximize profit where after selling you must wait one day (cooldown) before buying again. You may hold at most one share at a time.

#### Examples

TODO

#### Recognition
**DP with states (holding, sold, rest).** **O(n)** time, **O(1)** space.

#### Explanation
The state machine has three states: `hold` (currently own a share), `sold` (just sold — must rest tomorrow), and `rest` (in cooldown or idle, can buy). Transitions: from `hold` you can sell → `sold`; from `rest` you can buy → `hold` or stay in `rest`; from `sold` you must go to `rest`. Initialization: `hold = -prices[0]` (paid for first day's share), `sold = 0`, `rest = 0`. Each day these three states update simultaneously using previous-day values, so one pass suffices. The answer is `max(sold, rest)` since we'd never end on a `hold` state.

#### Python

Three-tuple assignment `hold, sold, rest = ...` updates all three states simultaneously — correctly uses pre-update values on the right side.

```python
def maxProfit(prices):
    hold, sold, rest = -prices[0], 0, 0
    for p in prices[1:]:
        hold, sold, rest = max(hold, rest - p), hold + p, max(rest, sold)
    return max(sold, rest)
```

#### Java

Java has no parallel assignment, so three temps (`nh`, `ns`, `nr`) capture the next state before overwriting — same shape as C++/Rust. `Math.max` for the two transitions that take a best-of.

```java
class Solution {
    public int maxProfit(int[] prices) {
        int hold = -prices[0], sold = 0, rest = 0;
        for (int i = 1; i < prices.length; i++) {
            int nh = Math.max(hold, rest - prices[i]);
            int ns = hold + prices[i];
            int nr = Math.max(rest, sold);
            hold = nh;
            sold = ns;
            rest = nr;
        }
        return Math.max(sold, rest);
    }
}
```

#### Rust

Destructuring `let (new_hold, new_sold, new_rest) = (...)` then individual assignments — Rust has no parallel assignment for `let mut` variables.

```rust
fn max_profit_cooldown(prices: Vec<i32>) -> i32 {
    let (mut hold, mut sold, mut rest) = (-prices[0], 0i32, 0i32);
    for &p in &prices[1..] {
        let (new_hold, new_sold, new_rest) = (
            hold.max(rest - p),
            hold + p,
            rest.max(sold),
        );
        hold = new_hold; sold = new_sold; rest = new_rest;
    }
    sold.max(rest)
}
```

#### Go

Parallel assignment `hold, sold, rest = ...` works like Python. Helper `max2` because pre-1.21 Go lacks a builtin.

```go
func maxProfitCooldown(prices []int) int {
    hold, sold, rest := -prices[0], 0, 0
    for _, p := range prices[1:] {
        hold, sold, rest = max2(hold, rest-p), hold+p, max2(rest, sold)
    }
    if sold > rest { return sold }
    return rest
}
func max2(a, b int) int {
    if a > b { return a }
    return b
}
```

#### C++

Three temps (`nh`, `ns`, `nr`) then assignments — same as Rust because C++ lacks parallel assignment. `std::max` keeps the body terse.

```cpp
#include <vector>
#include <algorithm>

int maxProfitCooldown(std::vector<int>& prices) {
    int hold = -prices[0], sold = 0, rest = 0;
    for (int i = 1; i < (int)prices.size(); ++i) {
        int nh = std::max(hold, rest - prices[i]);
        int ns = hold + prices[i];
        int nr = std::max(rest, sold);
        hold = nh; sold = ns; rest = nr;
    }
    return std::max(sold, rest);
}
```


### 116. Target Sum

#### Problem
Given an integer array `nums` and an integer `target`, assign `+` or `-` to each number and return the number of ways to make the expression equal `target`.

#### Examples

TODO

#### Recognition
**DP (subset sum variant, dict of counts).** **O(n * S)** time, **O(S)** space, where `S` is the range of reachable sums.

#### Explanation
The naive approach explores all `2ⁿ` assignments — exponential. Instead, treat it as a DP over reachable sums: after processing each number, `dp[s]` is the number of ways to reach sum `s`. For each new number `n`, every existing sum `s` spawns two new sums: `s + n` and `s - n`. Using a dictionary avoids fixing array bounds for potentially negative sums. An equivalent algebraic trick lets you rephrase this as a 0/1 knapsack on a subset sum, but the dict-based approach is more intuitive. Edge case: if `target` isn't in `dp` after all numbers, return `0` via `dict.get`.

#### Python

`dp.get(s + n, 0) + count` is the upsert pattern — defaults missing keys to 0. Dict allows negative keys without bounds checks.

```python
def findTargetSumWays(nums, target):
    dp = {0: 1}
    for n in nums:
        next_dp = {}
        for s, count in dp.items():
            next_dp[s + n] = next_dp.get(s + n, 0) + count
            next_dp[s - n] = next_dp.get(s - n, 0) + count
        dp = next_dp
    return dp.get(target, 0)
```

#### Java

`HashMap<Integer,Integer>` allows the negative-sum keys a fixed array can't, and `getOrDefault(k, 0)` folds the missing-key default into the read. A fresh `next` map is built each round to model the 0/1 choice.

```java
import java.util.*;

class Solution {
    public int findTargetSumWays(int[] nums, int target) {
        Map<Integer, Integer> dp = new HashMap<>();
        dp.put(0, 1);
        for (int n : nums) {
            Map<Integer, Integer> next = new HashMap<>();
            for (Map.Entry<Integer, Integer> e : dp.entrySet()) {
                int s = e.getKey(), cnt = e.getValue();
                next.put(s + n, next.getOrDefault(s + n, 0) + cnt);
                next.put(s - n, next.getOrDefault(s - n, 0) + cnt);
            }
            dp = next;
        }
        return dp.getOrDefault(target, 0);
    }
}
```

#### Rust

`*next.entry(s + n).or_insert(0) += cnt` is the canonical entry-API upsert. Dict keys are `i32` so negatives work directly.

```rust
use std::collections::HashMap;

fn find_target_sum_ways(nums: Vec<i32>, target: i32) -> i32 {
    let mut dp: HashMap<i32, i32> = HashMap::new();
    dp.insert(0, 1);
    for n in nums {
        let mut next = HashMap::new();
        for (&s, &cnt) in &dp {
            *next.entry(s + n).or_insert(0) += cnt;
            *next.entry(s - n).or_insert(0) += cnt;
        }
        dp = next;
    }
    *dp.get(&target).unwrap_or(&0)
}
```

#### Go

Maps default-read to zero, so `next[s+n] += cnt` is the entire upsert in one line. Most concise of the four.

```go
func findTargetSumWays(nums []int, target int) int {
    dp := map[int]int{0: 1}
    for _, n := range nums {
        next := map[int]int{}
        for s, cnt := range dp {
            next[s+n] += cnt
            next[s-n] += cnt
        }
        dp = next
    }
    return dp[target]
}
```

#### C++

`unordered_map<int,int>::operator[]` default-constructs to 0 for missing keys — same one-liner upsert as Go. `std::move(next)` to avoid copying when swapping into `dp`.

```cpp
#include <vector>
#include <unordered_map>

int findTargetSumWays(std::vector<int>& nums, int target) {
    std::unordered_map<int, int> dp{{0, 1}};
    for (int n : nums) {
        std::unordered_map<int, int> next;
        for (auto& [s, cnt] : dp) {
            next[s + n] += cnt;
            next[s - n] += cnt;
        }
        dp = std::move(next);
    }
    auto it = dp.find(target);
    return it != dp.end() ? it->second : 0;
}
```


### 117. Interleaving String

#### Problem
Given strings `s1`, `s2`, and `s3`, determine whether `s3` can be formed by interleaving `s1` and `s2` (preserving the relative order of each).

#### Examples

TODO

#### Recognition
**2-D DP.** **O(m * n)** time, **O(m * n)** space.

#### Explanation
`dp[i][j]` = can `s3[i+j:]` be formed by interleaving `s1[i:]` and `s2[j:]`. We fill from bottom-right. Base case: `dp[m][n] = True` (both strings fully consumed). From `(i, j)`, we can advance in `s1` if `s1[i] == s3[i+j]` and `dp[i+1][j]` is true, or advance in `s2` if `s2[j] == s3[i+j]` and `dp[i][j+1]` is true. The length check `len(s1) + len(s2) != len(s3)` is a necessary early exit. Space can be reduced to `O(n)` by rolling a single row, since each row only depends on the row below and the element to its right.

#### Python

2-D bool DP, suffix-based (`dp[i][j]` = can suffix `s3[i+j:]` be formed). Bottom-right corner is the base case; iterate towards top-left.

```python
def isInterleave(s1, s2, s3):
    if len(s1) + len(s2) != len(s3):
        return False
    m, n = len(s1), len(s2)
    dp = [[False] * (n + 1) for _ in range(m + 1)]
    dp[m][n] = True
    for i in range(m, -1, -1):
        for j in range(n, -1, -1):
            if i < m and s1[i] == s3[i + j] and dp[i + 1][j]:
                dp[i][j] = True
            if j < n and s2[j] == s3[i + j] and dp[i][j + 1]:
                dp[i][j] = True
    return dp[0][0]
```

#### Java

`charAt` indexing into all three strings drives the suffix DP; the length mismatch is a mandatory early exit. A fresh `boolean[m+1][n+1]` is false-initialized, so only the `dp[m][n]` base case is set explicitly.

```java
class Solution {
    public boolean isInterleave(String s1, String s2, String s3) {
        int m = s1.length(), n = s2.length();
        if (m + n != s3.length()) return false;
        boolean[][] dp = new boolean[m + 1][n + 1];
        dp[m][n] = true;
        for (int i = m; i >= 0; i--) {
            for (int j = n; j >= 0; j--) {
                if (i < m && s1.charAt(i) == s3.charAt(i + j) && dp[i + 1][j]) dp[i][j] = true;
                if (j < n && s2.charAt(j) == s3.charAt(i + j) && dp[i][j + 1]) dp[i][j] = true;
            }
        }
        return dp[0][0];
    }
}
```

#### Rust

Pre-collect all three strings to byte slices. The same suffix-DP shape; `vec![vec![false; ...]; ...]` for the 2-D table.

```rust
fn is_interleave(s1: String, s2: String, s3: String) -> bool {
    let (b1, b2, b3) = (s1.as_bytes(), s2.as_bytes(), s3.as_bytes());
    let (m, n) = (b1.len(), b2.len());
    if m + n != b3.len() { return false; }
    let mut dp = vec![vec![false; n + 1]; m + 1];
    dp[m][n] = true;
    for i in (0..=m).rev() {
        for j in (0..=n).rev() {
            if i < m && b1[i] == b3[i+j] && dp[i+1][j] { dp[i][j] = true; }
            if j < n && b2[j] == b3[i+j] && dp[i][j+1] { dp[i][j] = true; }
        }
    }
    dp[0][0]
}
```

#### Go

Manual 2-D slice via nested `make`. Direct byte indexing on string slices — safe for the ASCII inputs.

```go
func isInterleave(s1 string, s2 string, s3 string) bool {
    m, n := len(s1), len(s2)
    if m+n != len(s3) { return false }
    dp := make([][]bool, m+1)
    for i := range dp { dp[i] = make([]bool, n+1) }
    dp[m][n] = true
    for i := m; i >= 0; i-- {
        for j := n; j >= 0; j-- {
            if i < m && s1[i] == s3[i+j] && dp[i+1][j] { dp[i][j] = true }
            if j < n && s2[j] == s3[i+j] && dp[i][j+1] { dp[i][j] = true }
        }
    }
    return dp[0][0]
}
```

#### C++

`std::vector<std::vector<bool>>` is the bit-packed 2-D bool grid. Same suffix DP shape across all four.

```cpp
#include <vector>
#include <string>

bool isInterleave(std::string& s1, std::string& s2, std::string& s3) {
    int m = (int)s1.size(), n = (int)s2.size();
    if (m + n != (int)s3.size()) return false;
    std::vector<std::vector<bool>> dp(m + 1, std::vector<bool>(n + 1, false));
    dp[m][n] = true;
    for (int i = m; i >= 0; --i) {
        for (int j = n; j >= 0; --j) {
            if (i < m && s1[i] == s3[i+j] && dp[i+1][j]) dp[i][j] = true;
            if (j < n && s2[j] == s3[i+j] && dp[i][j+1]) dp[i][j] = true;
        }
    }
    return dp[0][0];
}
```


### 118. Longest Increasing Path in a Matrix

#### Problem
Given an `m x n` integer matrix, return the length of the longest strictly increasing path. You can move in four directions (up, down, left, right) but not diagonally.

#### Examples

```text
Input: matrix = [[9,9,4],[6,6,8],[2,1,1]]
Output: 4
Explanation: the path is [1,2,6,9].

Input: matrix = [[3,4,5],[3,2,6],[2,2,1]]
Output: 4
Explanation: the path is [3,4,5,6]; diagonals are not allowed.

Input: matrix = [[1]]
Output: 1

Constraints:
- 1 <= m, n <= 200
- 0 <= matrix[i][j] <= 2^31 - 1
- moves are up, down, left or right only
```

#### Recognition
**Signals.** "Longest path" in a graph is NP-hard in general, so the word to fix on is *strictly* increasing: every legal move goes from a smaller value to a strictly larger one, so no path can ever return to a cell it left. The implicit graph is a DAG, and that acyclicity is the whole recognition. A 200 by 200 grid with four-way moves is 40000 nodes and under 160000 edges, so the expected answer is linear in the graph. **Therefore.** Longest path on a DAG, which is DP: `best(r, c) = 1 + max(best(neighbour))` over strictly greater neighbours, evaluated by DFS with a memo table. **Not a row-major grid DP**, because the dependency order follows values rather than positions: a cell can depend on the neighbour below it or to its right, so no fixed sweep direction works and tabulation would first have to sort every cell by value or peel them with Kahn's algorithm. **Not a visited set**, DFS's usual companion, which is unnecessary here and actively wrong, since it would block cells that legitimately sit on several different paths. **O(m * n)** time, **O(m * n)** space.

#### Explanation
**Brute force.** DFS from every cell, following strictly greater neighbours.

```python
def longestIncreasingPath(matrix):
    rows, cols = len(matrix), len(matrix[0])

    def dfs(r, c):
        best = 1
        for dr, dc in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nr, nc = r + dr, c + dc
            if not (0 <= nr < rows and 0 <= nc < cols):
                continue
            if matrix[nr][nc] > matrix[r][c]:
                best = max(best, 1 + dfs(nr, nc))
        return best

    return max(dfs(r, c) for r in range(rows)
               for c in range(cols))
```

Exponential time, `O(m * n)` stack.

**Wasteful because.** `dfs(r, c)` depends on nothing but `(r, c)`. The route taken to reach a cell cannot change its answer, since every continuation has to beat the current value regardless of history. Yet a cell at the foot of one long ascending ridge is recomputed once for every cell that can reach it, and those recomputations nest inside each other.

**Optimal.** Cache each cell's result the first time it is finished. There are `m * n` states and each does constant work over four neighbours, so the whole search is `O(m * n)` however many cells the outer loop starts from. Correctness rests on the same acyclicity that made this a DAG: a memo slot can never be read while it is still being computed, because that would require a cycle of strictly increasing values. That is also why no visited set appears, and why 0 is a safe "not computed yet" sentinel, given every real answer is at least 1. Recursion depth is the one thing acyclicity does not bound, so a 200 by 200 board of increasing values nests 40000 frames; Kahn's algorithm on the reversed edges, peeling off cells whose greater neighbours are all resolved, costs the same and avoids recursion entirely.

**Edge cases.** A one-cell matrix answers 1, since a single cell is a path of length 1. A matrix of all equal values also answers 1, because the strict comparison leaves it with no edges at all. Plateaus of ties never extend a path, which is what makes `[[9,9,4],[6,6,8],[2,1,1]]` cap at 4 rather than running along the nines. Values reach `2^31 - 1`, so compare neighbours directly and never by subtracting them.

#### Python

Memo via dict keyed on `(r, c)` tuple. No visited set needed because the strictly-increasing edge condition rules out cycles.

```python
def longestIncreasingPath(matrix):
    rows, cols = len(matrix), len(matrix[0])
    memo = {}

    def dfs(r, c):
        if (r, c) in memo:
            return memo[(r, c)]
        res = 1
        for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and matrix[nr][nc] > matrix[r][c]:
                res = max(res, 1 + dfs(nr, nc))
        memo[(r, c)] = res
        return res

    return max(dfs(r, c) for r in range(rows) for c in range(cols))
```

#### Java

A `memo` field lets a private recursive `dfs` carry state cleanly; `memo[r][c] != 0` is the computed-marker (answers are always ≥1, so 0 is a safe sentinel). The strictly-greater edge rules out cycles, so no visited set is needed.

```java
class Solution {
    private int rows, cols;
    private int[][] memo;
    private static final int[][] DIRS = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};

    public int longestIncreasingPath(int[][] matrix) {
        rows = matrix.length;
        cols = matrix[0].length;
        memo = new int[rows][cols];
        int ans = 0;
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                ans = Math.max(ans, dfs(matrix, r, c));
            }
        }
        return ans;
    }

    private int dfs(int[][] matrix, int r, int c) {
        if (memo[r][c] != 0) return memo[r][c];
        int res = 1;
        for (int[] d : DIRS) {
            int nr = r + d[0], nc = c + d[1];
            if (nr >= 0 && nc >= 0 && nr < rows && nc < cols && matrix[nr][nc] > matrix[r][c]) {
                res = Math.max(res, 1 + dfs(matrix, nr, nc));
            }
        }
        return memo[r][c] = res;
    }
}
```

#### Rust

`memo[r][c] != 0` as the 'already computed' check — 0 sentinel works because the answer is always ≥1. Function takes `&Vec<Vec<i32>>` to avoid moving the matrix.

```rust
fn longest_increasing_path(matrix: Vec<Vec<i32>>) -> i32 {
    let (rows, cols) = (matrix.len(), matrix[0].len());
    let mut memo = vec![vec![0i32; cols]; rows];

    fn dfs(r: usize, c: usize, matrix: &Vec<Vec<i32>>, memo: &mut Vec<Vec<i32>>) -> i32 {
        if memo[r][c] != 0 { return memo[r][c]; }
        let dirs: &[(i32, i32)] = &[(0, 1), (0, -1), (1, 0), (-1, 0)];
        let mut res = 1;
        for &(dr, dc) in dirs {
            let nr = r as i32 + dr;
            let nc = c as i32 + dc;
            let (rows, cols) = (matrix.len() as i32, matrix[0].len() as i32);
            if nr >= 0 && nc >= 0 && nr < rows && nc < cols {
                let (nr, nc) = (nr as usize, nc as usize);
                if matrix[nr][nc] > matrix[r][c] {
                    res = res.max(1 + dfs(nr, nc, matrix, memo));
                }
            }
        }
        memo[r][c] = res;
        res
    }

    let mut ans = 0;
    for r in 0..rows {
        for c in 0..cols {
            ans = ans.max(dfs(r, c, &matrix, &mut memo));
        }
    }
    ans
}
```

#### Go

Closure recursion via `var dfs func`. The 0-sentinel-as-memo-marker is the same pattern as Rust.

```go
func longestIncreasingPath(matrix [][]int) int {
    rows, cols := len(matrix), len(matrix[0])
    memo := make([][]int, rows)
    for i := range memo { memo[i] = make([]int, cols) }
    dirs := [][2]int{{0, 1}, {0, -1}, {1, 0}, {-1, 0}}
    var dfs func(r, c int) int
    dfs = func(r, c int) int {
        if memo[r][c] != 0 { return memo[r][c] }
        res := 1
        for _, d := range dirs {
            nr, nc := r+d[0], c+d[1]
            if nr >= 0 && nc >= 0 && nr < rows && nc < cols && matrix[nr][nc] > matrix[r][c] {
                if v := 1 + dfs(nr, nc); v > res { res = v }
            }
        }
        memo[r][c] = res
        return res
    }
    ans := 0
    for r := 0; r < rows; r++ {
        for c := 0; c < cols; c++ {
            if v := dfs(r, c); v > ans { ans = v }
        }
    }
    return ans
}
```

#### C++

Return-assign trick `return memo[r][c] = res;` — assigns and returns in one statement. `std::function` for the recursive lambda.

```cpp
#include <vector>
#include <algorithm>
#include <functional>

int longestIncreasingPath(std::vector<std::vector<int>>& matrix) {
    int rows = (int)matrix.size(), cols = (int)matrix[0].size();
    std::vector<std::vector<int>> memo(rows, std::vector<int>(cols, 0));
    int dirs[4][2] = {{0,1},{0,-1},{1,0},{-1,0}};

    std::function<int(int,int)> dfs = [&](int r, int c) -> int {
        if (memo[r][c]) return memo[r][c];
        int res = 1;
        for (auto& d : dirs) {
            int nr = r + d[0], nc = c + d[1];
            if (nr >= 0 && nc >= 0 && nr < rows && nc < cols && matrix[nr][nc] > matrix[r][c])
                res = std::max(res, 1 + dfs(nr, nc));
        }
        return memo[r][c] = res;
    };

    int ans = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c)
            ans = std::max(ans, dfs(r, c));
    return ans;
}
```


### 119. Distinct Subsequences

#### Problem
Given strings `s` and `t`, return the number of distinct subsequences of `s` that equal `t`.

#### Examples

TODO

#### Recognition
**2-D DP.** **O(m * n)** time, **O(m * n)** space.

#### Explanation
`dp[i][j]` = number of ways to form `t[j:]` using the characters in `s[i:]`. Base case: `dp[i][n] = 1` for all `i` — an empty `t` can always be matched (the empty subsequence). At each cell, we can always skip `s[i]` by inheriting from `dp[i+1][j]`. If `s[i] == t[j]`, we also add `dp[i+1][j+1]` (the count of ways to match the rest of `t` using the rest of `s`). The two choices — skip or match — are the core of this DP. Numbers can be large; the problem guarantees the answer fits in a 32-bit integer.

#### Python

Suffix-DP: `dp[i][j]` = ways to form `t[j:]` from `s[i:]`. Always inherit `dp[i+1][j]` (skip s[i]); add `dp[i+1][j+1]` only when chars match.

```python
def numDistinct(s, t):
    m, n = len(s), len(t)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][n] = 1
    for i in range(m - 1, -1, -1):
        for j in range(n - 1, -1, -1):
            dp[i][j] = dp[i + 1][j]
            if s[i] == t[j]:
                dp[i][j] += dp[i + 1][j + 1]
    return dp[0][0]
```

#### Java

`long[][]` guards the additions against overflow before the final cast to `int` (the answer itself fits 32 bits). `charAt` drives the skip-or-match recurrence; the `dp[i][n] = 1` column seeds the empty-`t` base case.

```java
class Solution {
    public int numDistinct(String s, String t) {
        int m = s.length(), n = t.length();
        long[][] dp = new long[m + 1][n + 1];
        for (int i = 0; i <= m; i++) dp[i][n] = 1;
        for (int i = m - 1; i >= 0; i--) {
            for (int j = n - 1; j >= 0; j--) {
                dp[i][j] = dp[i + 1][j];
                if (s.charAt(i) == t.charAt(j)) dp[i][j] += dp[i + 1][j + 1];
            }
        }
        return (int) dp[0][0];
    }
}
```

#### Rust

`u64` for the DP cells to defend against int overflow during the additions (the final cast to `i32` is fine per the problem). Byte slices for fast indexing.

```rust
fn num_distinct(s: String, t: String) -> i32 {
    let (sb, tb) = (s.as_bytes(), t.as_bytes());
    let (m, n) = (sb.len(), tb.len());
    let mut dp = vec![vec![0u64; n + 1]; m + 1];
    for i in 0..=m { dp[i][n] = 1; }
    for i in (0..m).rev() {
        for j in (0..n).rev() {
            dp[i][j] = dp[i+1][j];
            if sb[i] == tb[j] { dp[i][j] += dp[i+1][j+1]; }
        }
    }
    dp[0][0] as i32
}
```

#### Go

`int` is 64-bit on most platforms so plain `int` suffices for the DP. Manual 2-D slice construction via `make`-in-loop.

```go
func numDistinct(s string, t string) int {
    m, n := len(s), len(t)
    dp := make([][]int, m+1)
    for i := range dp { dp[i] = make([]int, n+1) }
    for i := 0; i <= m; i++ { dp[i][n] = 1 }
    for i := m - 1; i >= 0; i-- {
        for j := n - 1; j >= 0; j-- {
            dp[i][j] = dp[i+1][j]
            if s[i] == t[j] { dp[i][j] += dp[i+1][j+1] }
        }
    }
    return dp[0][0]
}
```

#### C++

`long long` for the DP cells — overflow defense during additions. Same suffix-DP shape; ternary would tighten the body further.

```cpp
#include <vector>
#include <string>

int numDistinct(std::string& s, std::string& t) {
    int m = (int)s.size(), n = (int)t.size();
    std::vector<std::vector<long long>> dp(m + 1, std::vector<long long>(n + 1, 0));
    for (int i = 0; i <= m; ++i) dp[i][n] = 1;
    for (int i = m - 1; i >= 0; --i)
        for (int j = n - 1; j >= 0; --j) {
            dp[i][j] = dp[i+1][j];
            if (s[i] == t[j]) dp[i][j] += dp[i+1][j+1];
        }
    return (int)dp[0][0];
}
```


### 120. Edit Distance

#### Problem
Given two strings `word1` and `word2`, return the minimum number of operations (insert, delete, or replace a character) required to convert `word1` to `word2`.

#### Examples

TODO

#### Recognition
**2-D DP (space-optimized to 1-D).** **O(m * n)** time, **O(n)** space.

#### Explanation
The classic Levenshtein distance. `dp[i][j]` = min edits to convert `word1[:i]` to `word2[:j]`. Base cases: converting to/from an empty string costs `i` or `j` deletions/insertions. When characters match (`word1[i-1] == word2[j-1]`), no edit is needed and we inherit the diagonal `dp[i-1][j-1]`. When they differ, we take 1 + the minimum of three options: delete from `word1` (`dp[i-1][j]`), insert into `word1` (`dp[i][j-1]`), or replace (`dp[i-1][j-1]`). The 1-D rolling array reuses the single-row `dp`, tracking the "previous diagonal" in `prev` before overwriting.

#### Python

1-D rolling DP with explicit `prev = dp[:]` copy per row — captures the entire previous row before overwriting. `dp[0] = i` resets the column-0 invariant per row.

```python
def minDistance(word1, word2):
    m, n = len(word1), len(word2)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[:]
        dp[0] = i
        for j in range(1, n + 1):
            if word1[i - 1] == word2[j - 1]:
                dp[j] = prev[j - 1]
            else:
                dp[j] = 1 + min(prev[j], dp[j - 1], prev[j - 1])
    return dp[n]
```

#### Java

`prev = dp.clone()` snapshots the previous row (a shallow copy is a full copy for `int[]`), and `dp[0] = i` resets the column-0 invariant each row. `Math.min` nesting replaces the brace-list variadic min of C++.

```java
class Solution {
    public int minDistance(String word1, String word2) {
        int m = word1.length(), n = word2.length();
        int[] dp = new int[n + 1];
        for (int j = 0; j <= n; j++) dp[j] = j;
        for (int i = 1; i <= m; i++) {
            int[] prev = dp.clone();
            dp[0] = i;
            for (int j = 1; j <= n; j++) {
                if (word1.charAt(i - 1) == word2.charAt(j - 1)) {
                    dp[j] = prev[j - 1];
                } else {
                    dp[j] = 1 + Math.min(prev[j], Math.min(dp[j - 1], prev[j - 1]));
                }
            }
        }
        return dp[n];
    }
}
```

#### Rust

`(0..=n as i32).collect()` for the initial row `[0, 1, 2, ..., n]`. `prev = dp.clone()` per row is the same explicit copy as Python. The unused `let _ = prev` is a no-op to silence a warning.

```rust
fn min_distance(word1: String, word2: String) -> i32 {
    let (b1, b2) = (word1.as_bytes(), word2.as_bytes());
    let (m, n) = (b1.len(), b2.len());
    let mut dp: Vec<i32> = (0..=n as i32).collect();
    for i in 1..=m {
        let mut prev = dp.clone();
        dp[0] = i as i32;
        for j in 1..=n {
            dp[j] = if b1[i-1] == b2[j-1] {
                prev[j-1]
            } else {
                1 + prev[j].min(dp[j-1]).min(prev[j-1])
            };
        }
        let _ = prev; // consumed
    }
    dp[n]
}
```

#### Go

`append([]int(nil), dp...)` for the row clone. Helper `minOf3` because pre-1.21 Go has no variadic min.

```go
func minDistance(word1 string, word2 string) int {
    m, n := len(word1), len(word2)
    dp := make([]int, n+1)
    for j := 0; j <= n; j++ { dp[j] = j }
    for i := 1; i <= m; i++ {
        prev := append([]int(nil), dp...)
        dp[0] = i
        for j := 1; j <= n; j++ {
            if word1[i-1] == word2[j-1] {
                dp[j] = prev[j-1]
            } else {
                dp[j] = 1 + minOf3(prev[j], dp[j-1], prev[j-1])
            }
        }
    }
    return dp[n]
}
func minOf3(a, b, c int) int {
    if a < b { b = a }
    if b < c { return b }
    return c
}
```

#### C++

`std::vector<int> prev = dp;` is a deep copy. `std::min({a, b, c})` brace-init for variadic min — C++11 onwards.

```cpp
#include <vector>
#include <string>
#include <algorithm>

int minDistance(std::string& word1, std::string& word2) {
    int m = (int)word1.size(), n = (int)word2.size();
    std::vector<int> dp(n + 1);
    for (int j = 0; j <= n; ++j) dp[j] = j;
    for (int i = 1; i <= m; ++i) {
        std::vector<int> prev = dp;
        dp[0] = i;
        for (int j = 1; j <= n; ++j) {
            if (word1[i-1] == word2[j-1])
                dp[j] = prev[j-1];
            else
                dp[j] = 1 + std::min({prev[j], dp[j-1], prev[j-1]});
        }
    }
    return dp[n];
}
```


### 121. Burst Balloons

#### Problem
Given `n` balloons with integer values, burst them one at a time; when you burst balloon `i`, you earn `nums[i-1] * nums[i] * nums[i+1]` coins (using 1 for out-of-bounds neighbors). Return the maximum coins collectable.

#### Examples

TODO

#### Recognition
**Interval DP (think-last trick).** **O(n³)** time, **O(n²)** space.

#### Explanation
The naive approach tries all permutations of burst order — `O(n!)`. The key insight is to think in reverse: instead of asking "which balloon do I burst first?", ask "which balloon do I burst *last* in this interval `[l, r]`?" When balloon `i` is the last to be burst in `[l, r]`, its neighbors are exactly the sentinels at `l-1` and `r+1` (since all others in the interval are already gone), so coins are `nums[l-1] * nums[i] * nums[r+1]`. Then the subproblems `dfs(l, i-1)` and `dfs(i+1, r)` are independent. Pad `nums` with `1` sentinels on both ends so boundary cases vanish. Memoize each `(l, r)` pair; there are `O(n²)` states, each iterated over `O(n)` choices, giving `O(n³)`.

#### Python

Generator inside `max(...)` for the per-position search — concise, no intermediate list. `nums = [1] + nums + [1]` pads with sentinels so boundary multiplications are well-defined.

```python
def maxCoins(nums):
    nums = [1] + nums + [1]
    n = len(nums)
    dp = {}
    def dfs(l, r):
        if l > r:
            return 0
        if (l, r) in dp:
            return dp[(l, r)]
        dp[(l, r)] = max(
            nums[l-1] * nums[i] * nums[r+1] + dfs(l, i-1) + dfs(i+1, r)
            for i in range(l, r+1)
        )
        return dp[(l, r)]
    return dfs(1, n - 2)
```

#### Java

Java has no closures that capture mutable arrays cleanly for recursion, so hoist `nums` and the `int[][]` memo to instance fields and recurse through a private helper. Initialize the memo to `-1` as the "not computed" sentinel — `Arrays.fill` per row, or `new int[n][n]` and check for a distinct flag.

```java
import java.util.*;

class Solution {
    private int[] nums;
    private int[][] dp;

    public int maxCoins(int[] input) {
        int n = input.length;
        nums = new int[n + 2];
        nums[0] = 1;
        nums[n + 1] = 1;
        for (int i = 0; i < n; i++) nums[i + 1] = input[i];
        int m = nums.length;
        dp = new int[m][m];
        for (int[] row : dp) Arrays.fill(row, -1);
        return dfs(1, m - 2);
    }

    private int dfs(int l, int r) {
        if (l > r) return 0;
        if (dp[l][r] != -1) return dp[l][r];
        int best = 0;
        for (int i = l; i <= r; i++) {
            int coins = nums[l - 1] * nums[i] * nums[r + 1] + dfs(l, i - 1) + dfs(i + 1, r);
            best = Math.max(best, coins);
        }
        return dp[l][r] = best;
    }
}
```

#### Rust

`nums.insert(0, 1)` + `push(1)` for the sentinel padding. `i.wrapping_sub(1)` for the `l, i-1` recursive call to avoid `usize` underflow when `i == 0` (the guard `l > r` catches it next).

```rust
use std::collections::HashMap;

fn max_coins(mut nums: Vec<i32>) -> i32 {
    nums.insert(0, 1);
    nums.push(1);
    let n = nums.len();
    let mut dp: HashMap<(usize, usize), i32> = HashMap::new();

    fn dfs(l: usize, r: usize, nums: &[i32], dp: &mut HashMap<(usize, usize), i32>) -> i32 {
        if l > r {
            return 0;
        }
        if let Some(&v) = dp.get(&(l, r)) {
            return v;
        }
        let mut best = 0;
        for i in l..=r {
            let coins = nums[l - 1] * nums[i] * nums[r + 1]
                + dfs(l, i.wrapping_sub(1), nums, dp)
                + dfs(i + 1, r, nums, dp);
            best = best.max(coins);
        }
        dp.insert((l, r), best);
        best
    }

    dfs(1, n - 2, &nums, &mut dp)
}
```

#### Go

2-D `[][]int` initialized to `-1` as the 'not yet memoized' sentinel — faster than a map for dense index ranges. `append([]int{1}, append(nums, 1)...)` for sentinel padding.

```go
func maxCoins(nums []int) int {
    nums = append([]int{1}, append(nums, 1)...)
    n := len(nums)
    dp := make([][]int, n)
    for i := range dp {
        dp[i] = make([]int, n)
        for j := range dp[i] {
            dp[i][j] = -1
        }
    }
    var dfs func(l, r int) int
    dfs = func(l, r int) int {
        if l > r {
            return 0
        }
        if dp[l][r] != -1 {
            return dp[l][r]
        }
        best := 0
        for i := l; i <= r; i++ {
            coins := nums[l-1]*nums[i]*nums[r+1] + dfs(l, i-1) + dfs(i+1, r)
            if coins > best {
                best = coins
            }
        }
        dp[l][r] = best
        return best
    }
    return dfs(1, n-2)
}
```

#### C++

`nums.insert(nums.begin(), 1)` then `push_back(1)` — same padding. 2-D vector initialized to `-1`; return-assign `return dp[l][r] = best;` saves a line.

```cpp
#include <vector>
#include <functional>
#include <algorithm>

int maxCoins(std::vector<int>& nums) {
    nums.insert(nums.begin(), 1);
    nums.push_back(1);
    int n = (int)nums.size();
    std::vector<std::vector<int>> dp(n, std::vector<int>(n, -1));
    std::function<int(int, int)> dfs = [&](int l, int r) -> int {
        if (l > r) return 0;
        if (dp[l][r] != -1) return dp[l][r];
        int best = 0;
        for (int i = l; i <= r; ++i) {
            int coins = nums[l-1] * nums[i] * nums[r+1] + dfs(l, i-1) + dfs(i+1, r);
            best = std::max(best, coins);
        }
        return dp[l][r] = best;
    };
    return dfs(1, n - 2);
}
```


### 122. Regular Expression Matching

#### Problem
Given string `s` and pattern `p` with `.` (matches any char) and `*` (matches zero or more of the preceding element), return whether `p` fully matches `s`.

#### Examples

TODO

#### Recognition
**2-D DP (top-down memoization).** **O(m·n)** time, **O(m·n)** space.

#### Explanation
The naive recursive solution re-evaluates the same `(i, j)` state many times. The state is "does `s[i:]` match `p[j:]`?" — memoize it. The tricky case is `*`: it can match zero of the preceding character (`dp(i, j+2)`, skipping the `x*` pair) or one-or-more if the current characters agree (`first and dp(i+1, j)`, advancing `s` while staying at the same `*` pattern position). `first` checks both literal match and `.` wildcard in one expression. Base case: if `j == len(p)`, valid only when `s` is also exhausted. Because pattern consumes from left, every recursive call moves at least one index forward, bounding depth to `O(m + n)` with `O(m·n)` unique states.

#### Python

`p[j] in {s[i], "."}` is a set membership — handles both literal match and wildcard in one expression. The `or` chain on the `*` branch tries zero-match before one-or-more.

```python
def isMatch(s, p):
    memo = {}
    def dp(i, j):
        if (i, j) in memo:
            return memo[(i, j)]
        if j == len(p):
            return i == len(s)
        first = i < len(s) and p[j] in {s[i], "."}
        if j + 1 < len(p) and p[j + 1] == "*":
            res = dp(i, j + 2) or (first and dp(i + 1, j))
        else:
            res = first and dp(i + 1, j + 1)
        memo[(i, j)] = res
        return res
    return dp(0, 0)
```

#### Java

Use a boxed `Boolean[][]` memo where `null` means "unvisited" — cleaner than the tri-state `int` with `-1` that C++ needs, since `Boolean` naturally has a third state. Size it `(m+1) x (n+1)` to allow the exhausted-index states `i == m` / `j == n`.

```java
import java.util.*;

class Solution {
    private String s, p;
    private Boolean[][] memo;

    public boolean isMatch(String s, String p) {
        this.s = s;
        this.p = p;
        memo = new Boolean[s.length() + 1][p.length() + 1];
        return dp(0, 0);
    }

    private boolean dp(int i, int j) {
        if (memo[i][j] != null) return memo[i][j];
        if (j == p.length()) return memo[i][j] = (i == s.length());
        boolean first = i < s.length() && (p.charAt(j) == '.' || p.charAt(j) == s.charAt(i));
        boolean res;
        if (j + 1 < p.length() && p.charAt(j + 1) == '*') {
            res = dp(i, j + 2) || (first && dp(i + 1, j));
        } else {
            res = first && dp(i + 1, j + 1);
        }
        return memo[i][j] = res;
    }
}
```

#### Rust

Pre-collect to `Vec<char>` once. `dp(i, j + 2, ...)` is the zero-match-of-star branch; `dp(i + 1, j, ...)` is the consume-one-and-stay branch.

```rust
use std::collections::HashMap;

fn is_match(s: String, p: String) -> bool {
    let s: Vec<char> = s.chars().collect();
    let p: Vec<char> = p.chars().collect();
    let mut memo: HashMap<(usize, usize), bool> = HashMap::new();

    fn dp(i: usize, j: usize, s: &[char], p: &[char], memo: &mut HashMap<(usize, usize), bool>) -> bool {
        if let Some(&v) = memo.get(&(i, j)) {
            return v;
        }
        if j == p.len() {
            return i == s.len();
        }
        let first = i < s.len() && (p[j] == '.' || p[j] == s[i]);
        let res = if j + 1 < p.len() && p[j + 1] == '*' {
            dp(i, j + 2, s, p, memo) || (first && dp(i + 1, j, s, p, memo))
        } else {
            first && dp(i + 1, j + 1, s, p, memo)
        };
        memo.insert((i, j), res);
        res
    }

    dp(0, 0, &s, &p, &mut memo)
}
```

#### Go

Array-key `[2]int` for the memo map — Go map keys must be comparable, arrays are but slices aren't. `byte` comparison on `p[j]` works for ASCII.

```go
func isMatch(s string, p string) bool {
    memo := map[[2]int]bool{}
    var dp func(i, j int) bool
    dp = func(i, j int) bool {
        key := [2]int{i, j}
        if v, ok := memo[key]; ok {
            return v
        }
        if j == len(p) {
            return i == len(s)
        }
        first := i < len(s) && (p[j] == '.' || p[j] == s[i])
        var res bool
        if j+1 < len(p) && p[j+1] == '*' {
            res = dp(i, j+2) || (first && dp(i+1, j))
        } else {
            res = first && dp(i+1, j+1)
        }
        memo[key] = res
        return res
    }
    return dp(0, 0)
}
```

#### C++

`std::vector<std::vector<int>>` with `-1` sentinel for three-state memo (unvisited/false/true). Return-assign trick `return memo[i][j] = res;`.

```cpp
#include <string>
#include <vector>

bool isMatch(std::string s, std::string p) {
    int m = (int)s.size(), n = (int)p.size();
    // -1=unvisited, 0=false, 1=true
    std::vector<std::vector<int>> memo(m + 1, std::vector<int>(n + 1, -1));
    std::function<bool(int, int)> dp = [&](int i, int j) -> bool {
        if (memo[i][j] != -1) return memo[i][j];
        if (j == n) return memo[i][j] = (i == m);
        bool first = i < m && (p[j] == '.' || p[j] == s[i]);
        bool res;
        if (j + 1 < n && p[j + 1] == '*') {
            res = dp(i, j + 2) || (first && dp(i + 1, j));
        } else {
            res = first && dp(i + 1, j + 1);
        }
        return memo[i][j] = res;
    };
    return dp(0, 0);
}
```


### 123. Maximum Subarray

#### Problem
Given an integer array `nums`, find the contiguous subarray with the largest sum and return that sum. The array may contain negative numbers.

#### Examples

```text
Input: nums = [-2,1,-3,4,-1,2,1,-5,4]
Output: 6
Explanation: the subarray [4,-1,2,1] sums to 6.

Input: nums = [-3,-1,-2]
Output: -1

Input: nums = [5,4,-1,7,8]
Output: 23

Constraints:
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4
- the subarray must be non-empty
```

#### Recognition
**Signals.** "Contiguous subarray" plus "largest sum" plus one flat array that "may contain negative numbers". Contiguous forbids sorting or cherry-picking, and a single array with no second dimension in the state means what you carry forward is one scalar, not a table. The negatives are the load-bearing detail. **Therefore.** Kadane: sweep once holding `cur`, the best sum of a subarray ending exactly at this index, restarting whenever the carried prefix has gone negative. **Not a sliding window**, because a window needs the running sum to move monotonically as you extend right or shrink left, and negatives break that: growing the window can lower the sum and shrinking it can raise it, so no condition tells the left pointer when to advance. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Sum every subarray and keep the largest.

```python
def maxSubArray(nums):
    best = nums[0]
    for i in range(len(nums)):
        total = 0
        for j in range(i, len(nums)):
            total += nums[j]
            if total > best:
                best = total
    return best
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** Every start index rebuilds the whole suffix from zero, and the pass starting at `i + 1` differs from the pass starting at `i` by exactly one leading term. The quantity being recomputed `n` times over is "the best sum ending at `j`".

**Optimal.** Ask that question once per position instead of once per start. The best subarray ending at `i` is either `nums[i]` standing alone or `nums[i]` glued onto the best one ending at `i - 1`, because those are the only two shapes a contiguous run can have, so `cur = max(nums[i], cur + nums[i])` absorbs the entire inner loop. The greedy reading of the same line is the proof: once `cur` is negative, carrying it forward subtracts from every later sum, so dropping it can never discard an optimum. Seed `cur` and `res` from `nums[0]`, not from `0`; seeding from `0` quietly answers `0` on an all-negative array. If the follow-up asks for the boundaries rather than the sum, keep a start index that resets on the restart branch.

**Edge cases.** All-negative input must return the largest single element, so `[-3,-1,-2]` answers `-1` and not `0`. A one-element array returns that element. A leading run of negatives is discarded outright, so `[-5,9]` answers `9`, not `4`. Zeros need no branch since they neither help nor hurt.

#### Python

Two-line update: `cur = max(n, cur + n)` (start fresh or extend), `res = max(res, cur)` (track best). Init both to `nums[0]` to handle all-negative arrays.

```python
def maxSubArray(nums):
    res = cur = nums[0]
    for n in nums[1:]:
        cur = max(n, cur + n)
        res = max(res, cur)
    return res
```

#### Java

`Math.max` on two `int`s, no imports needed — pure primitives. Seed both `cur` and `res` from `nums[0]` and iterate from index 1 so the all-negative case returns the largest single element.

```java
class Solution {
    public int maxSubArray(int[] nums) {
        int cur = nums[0], res = nums[0];
        for (int i = 1; i < nums.length; i++) {
            cur = Math.max(nums[i], cur + nums[i]);
            res = Math.max(res, cur);
        }
        return res;
    }
}
```

#### Rust

`nums.iter().skip(1)` for the slice from index 1 — borrows the tail without allocation. Method-form `n.max(cur + n)` and `res.max(cur)`.

```rust
fn max_sub_array(nums: Vec<i32>) -> i32 {
    let mut cur = nums[0];
    let mut res = nums[0];
    for &n in nums.iter().skip(1) {
        cur = n.max(cur + n);
        res = res.max(cur);
    }
    res
}
```

#### Go

Pre-1.21 explicit if-else for both `max` calls. Otherwise identical control flow to the others.

```go
func maxSubArray(nums []int) int {
    cur, res := nums[0], nums[0]
    for _, n := range nums[1:] {
        if cur+n > n {
            cur = cur + n
        } else {
            cur = n
        }
        if cur > res {
            res = cur
        }
    }
    return res
}
```

#### C++

`std::max` from `<algorithm>`. Indexed loop from 1 because we initialize cur/res from index 0.

```cpp
#include <vector>
#include <algorithm>

int maxSubArray(std::vector<int>& nums) {
    int cur = nums[0], res = nums[0];
    for (int i = 1; i < (int)nums.size(); ++i) {
        cur = std::max(nums[i], cur + nums[i]);
        res = std::max(res, cur);
    }
    return res;
}
```


### 124. Jump Game

#### Problem
Given an array `nums` where `nums[i]` is the maximum jump length from index `i`, return whether you can reach the last index starting from index 0.

#### Examples

```text
Input: nums = [2,3,1,1,4]
Output: true
Explanation: jump 1 to index 1, then 3 to the last index.

Input: nums = [3,2,1,0,4]
Output: false
Explanation: every route lands on the 0 at index 3 and stalls.

Input: nums = [0]
Output: true

Constraints:
- 1 <= nums.length <= 10^4
- 0 <= nums[i] <= 10^5
```

#### Recognition
**Signals.** A yes/no reachability question over one array, and `nums[i]` is the *maximum* jump length, so every shorter hop from `i` is legal too. That word "maximum" is the whole problem: it makes reachability downward closed, meaning if you can land on index `i` you can land on every index before it. A downward closed set of indices is described completely by one number. **Therefore.** Carry that one number. Scan right to left holding `goal`, the leftmost index known to reach the end, and pull it back to `i` whenever `i + nums[i] >= goal`; the answer is `goal == 0`. **Not BFS over indices**, which is correct but treats each index as a node and pushes the same heavily overlapping ranges again and again, costing `O(n^2)` edges and an `O(n)` visited array to learn nothing the scalar did not already have. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Mark every index reachable from an already-reachable one.

```python
def canJump(nums):
    n = len(nums)
    ok = [False] * n
    ok[0] = True
    for i in range(n):
        if not ok[i]:
            continue
        for j in range(i + 1, min(i + nums[i], n - 1) + 1):
            ok[j] = True
    return ok[n - 1]
```

`O(n^2)` time, `O(n)` space.

**Wasteful because.** The ranges written by successive indices overlap almost entirely, so each index is set to `True` once per predecessor that covers it. In `[3,2,1,0,4]` indices 1 through 3 are marked three separate times, and one witness would have done.

**Optimal.** Because reachability is downward closed and transitive, you never need to know *which* index reaches the end, only whether some index at or before your position does. Set `goal = n - 1` and walk backwards: if `i + nums[i] >= goal` then `i` reaches the goal, and anything reaching `i` now reaches the end, so `i` becomes the new goal. Reaching index 0 with `goal == 0` means the chain is unbroken. The mirror image works equally well and is worth knowing: sweep forward tracking `reach`, the furthest index seen so far, and fail the moment `i > reach`. Prefer the forward form when the follow-up is Jump Game II, since counting minimum jumps is that same `reach` read as BFS layers.

**Edge cases.** A single-element array is true even when `nums[0] == 0`, since you already stand on the last index. A zero at the final index never blocks anything. A zero elsewhere blocks only if nothing strictly before it can jump clear over it. Large `nums[i]` values overshoot the array end, which the `>=` comparison handles without clamping.

#### Python

Right-to-left greedy: track the leftmost reachable goal. If `i + nums[i] >= goal`, then `i` itself reaches the goal — promote it to the new goal.

```python
def canJump(nums):
    goal = len(nums) - 1
    for i in range(len(nums) - 2, -1, -1):
        if i + nums[i] >= goal:
            goal = i
    return goal == 0
```

#### Java

Plain primitive scan, no collections — a classic index-based reverse for-loop. `int` indices never underflow here since we stop at 0, so no cast gymnastics like Rust's `usize`.

```java
class Solution {
    public boolean canJump(int[] nums) {
        int goal = nums.length - 1;
        for (int i = nums.length - 2; i >= 0; i--) {
            if (i + nums[i] >= goal) goal = i;
        }
        return goal == 0;
    }
}
```

#### Rust

`nums[i] as usize` cast inside the comparison. `(0..nums.len() - 1).rev()` for backwards iteration; range-rev is the idiomatic form.

```rust
fn can_jump(nums: Vec<i32>) -> bool {
    let mut goal = nums.len() - 1;
    for i in (0..nums.len() - 1).rev() {
        if i + nums[i] as usize >= goal {
            goal = i;
        }
    }
    goal == 0
}
```

#### Go

Manual reverse for-loop. No casts needed — Go's `int` for everything.

```go
func canJump(nums []int) bool {
    goal := len(nums) - 1
    for i := len(nums) - 2; i >= 0; i-- {
        if i+nums[i] >= goal {
            goal = i
        }
    }
    return goal == 0
}
```

#### C++

`(int)nums.size() - 2` cast to keep `i` signed for the `>= 0` termination. Same right-to-left greedy.

```cpp
#include <vector>

bool canJump(std::vector<int>& nums) {
    int goal = (int)nums.size() - 1;
    for (int i = (int)nums.size() - 2; i >= 0; --i) {
        if (i + nums[i] >= goal) goal = i;
    }
    return goal == 0;
}
```


### 125. Jump Game II

#### Problem
Given `nums` where `nums[i]` is the max jump from index `i`, return the minimum number of jumps to reach the last index. A solution is guaranteed to exist.

#### Examples

TODO

#### Recognition
**Greedy BFS (implicit levels via boundary tracking).** **O(n)** time, **O(1)** space.

#### Explanation
BFS on jump levels works but requires a queue. The greedy insight models BFS levels implicitly with two pointers: `cur_end` (end of the current BFS level) and `cur_far` (farthest we can reach from any position in this level). At each index `i`, extend `cur_far`. When `i` hits `cur_end`, we must take a jump — increment `jumps` and advance `cur_end` to `cur_far`. We stop the loop at `len(nums) - 1` (not inclusive) because reaching the last index itself doesn't require an additional jump. This is equivalent to BFS expanding level by level, but uses O(1) space instead of a queue.

#### Python

Three-state greedy: `cur_end` is the level boundary, `cur_far` is the next-level's farthest reach. Increment jumps when `i` hits `cur_end`.

```python
def jump(nums):
    jumps = cur_end = cur_far = 0
    for i in range(len(nums) - 1):
        cur_far = max(cur_far, i + nums[i])
        if i == cur_end:
            jumps += 1
            cur_end = cur_far
    return jumps
```

#### Java

`Math.max` extends `curFar`; primitives throughout, no imports. Loop stops at `length - 1` so arriving at the last index doesn't cost an extra jump.

```java
class Solution {
    public int jump(int[] nums) {
        int jumps = 0, curEnd = 0, curFar = 0;
        for (int i = 0; i < nums.length - 1; i++) {
            curFar = Math.max(curFar, i + nums[i]);
            if (i == curEnd) {
                jumps++;
                curEnd = curFar;
            }
        }
        return jumps;
    }
}
```

#### Rust

`nums[i] as usize` for safe addition with the index. Stop one short of the last index — reaching it doesn't need a new jump.

```rust
fn jump(nums: Vec<i32>) -> i32 {
    let mut jumps = 0;
    let mut cur_end = 0;
    let mut cur_far = 0;
    for i in 0..nums.len() - 1 {
        cur_far = cur_far.max(i + nums[i] as usize);
        if i == cur_end {
            jumps += 1;
            cur_end = cur_far;
        }
    }
    jumps
}
```

#### Go

Pre-1.21 explicit if for the `cur_far` update. Same level-boundary pattern.

```go
func jump(nums []int) int {
    jumps, curEnd, curFar := 0, 0, 0
    for i := 0; i < len(nums)-1; i++ {
        if i+nums[i] > curFar {
            curFar = i + nums[i]
        }
        if i == curEnd {
            jumps++
            curEnd = curFar
        }
    }
    return jumps
}
```

#### C++

`std::max` for the `cur_far` extension. Stops the loop at `size() - 1` to avoid an unnecessary final jump.

```cpp
#include <vector>
#include <algorithm>

int jump(std::vector<int>& nums) {
    int jumps = 0, cur_end = 0, cur_far = 0;
    for (int i = 0; i < (int)nums.size() - 1; ++i) {
        cur_far = std::max(cur_far, i + nums[i]);
        if (i == cur_end) {
            ++jumps;
            cur_end = cur_far;
        }
    }
    return jumps;
}
```


### 126. Gas Station

#### Problem
Given `gas[i]` and `cost[i]` for `n` stations in a circle, find the starting station index that allows you to complete the circuit without running dry, or return -1 if none exists.

#### Examples

TODO

#### Recognition
**Greedy (surplus tracking with reset).** **O(n)** time, **O(1)** space.

#### Explanation
First check feasibility: if total gas is less than total cost, no solution exists. This can be proven: the problem guarantees at most one valid start, so if the total is sufficient, exactly one exists. For the single-pass approach, track a running `tank` surplus. Whenever `tank` drops below zero, the current `start` through index `i` is invalid (any sub-segment of a failing segment also fails), so reset `tank = 0` and move `start` to `i + 1`. The last candidate `start` when the loop ends is the answer, because the feasibility check already guarantees a solution exists. No need to simulate the second loop from `start`.

#### Python

Two passes folded into one: total feasibility check, then greedy reset-on-deficit. The `start = i + 1` reset is the key — a failing prefix can never be part of a valid start.

```python
def canCompleteCircuit(gas, cost):
    if sum(gas) < sum(cost):
        return -1
    tank = start = 0
    for i in range(len(gas)):
        tank += gas[i] - cost[i]
        if tank < 0:
            tank = 0
            start = i + 1
    return start
```

#### Java

No stream needed — a single primitive loop computes the total surplus, and a second does the reset-on-deficit scan. Keeping it to `int` arithmetic avoids any boxing.

```java
class Solution {
    public int canCompleteCircuit(int[] gas, int[] cost) {
        int total = 0;
        for (int i = 0; i < gas.length; i++) total += gas[i] - cost[i];
        if (total < 0) return -1;
        int tank = 0, start = 0;
        for (int i = 0; i < gas.length; i++) {
            tank += gas[i] - cost[i];
            if (tank < 0) {
                tank = 0;
                start = i + 1;
            }
        }
        return start;
    }
}
```

#### Rust

`gas.iter().zip(cost.iter()).map(|(g, c)| g - c).sum()` chains the total computation in one expression. The reset logic mirrors Python.

```rust
fn can_complete_circuit(gas: Vec<i32>, cost: Vec<i32>) -> i32 {
    let total: i32 = gas.iter().zip(cost.iter()).map(|(g, c)| g - c).sum();
    if total < 0 {
        return -1;
    }
    let mut tank = 0i32;
    let mut start = 0usize;
    for i in 0..gas.len() {
        tank += gas[i] - cost[i];
        if tank < 0 {
            tank = 0;
            start = i + 1;
        }
    }
    start as i32
}
```

#### Go

Two explicit loops — one for the total, one for the greedy scan. No iterator chaining, but the algorithm shape is identical.

```go
func canCompleteCircuit(gas []int, cost []int) int {
    total := 0
    for i := range gas {
        total += gas[i] - cost[i]
    }
    if total < 0 {
        return -1
    }
    tank, start := 0, 0
    for i := range gas {
        tank += gas[i] - cost[i]
        if tank < 0 {
            tank = 0
            start = i + 1
        }
    }
    return start
}
```

#### C++

`std::numeric_limits`-free version — manual sum loop. The reset trick (`tank = 0; start = i + 1`) is the language-independent core.

```cpp
#include <vector>
#include <numeric>

int canCompleteCircuit(std::vector<int>& gas, std::vector<int>& cost) {
    int total = 0;
    for (int i = 0; i < (int)gas.size(); ++i) total += gas[i] - cost[i];
    if (total < 0) return -1;
    int tank = 0, start = 0;
    for (int i = 0; i < (int)gas.size(); ++i) {
        tank += gas[i] - cost[i];
        if (tank < 0) { tank = 0; start = i + 1; }
    }
    return start;
}
```


### 127. Hand of Straights

#### Problem
Given a hand of cards and a `groupSize`, determine if the cards can be rearranged into groups of `groupSize` consecutive cards.

#### Examples

TODO

#### Recognition
**Greedy with ordered counter.** **O(n log n)** time, **O(n)** space.

#### Explanation
If `len(hand) % groupSize != 0`, it's immediately impossible. The greedy strategy: always form groups starting from the smallest available card. Sorting the unique card values gives the correct order to process. For each smallest card with a non-zero count `n`, we need `n` groups starting there, so we consume `n` copies of each of the next `groupSize` cards. If any of those cards has fewer than `n` copies, return False. Using a plain dict with sorted keys is equivalent to using a sorted map — we visit keys in ascending order and decrement counts. A missing key means zero count, which triggers the failure.

#### Python

Plain dict with `sorted(count)` to iterate keys in order — works for the small key range. `count.get(i, 0)` defaults missing keys to 0.

```python
def isNStraightHand(hand, groupSize):
    if len(hand) % groupSize:
        return False
    count = {}
    for c in hand:
        count[c] = count.get(c, 0) + 1
    for card in sorted(count):
        if count[card] > 0:
            n = count[card]
            for i in range(card, card + groupSize):
                if count.get(i, 0) < n:
                    return False
                count[i] -= n
    return True
```

#### Java

`TreeMap` iterates keys in ascending order for free (red-black tree), mirroring C++'s `std::map` — no separate sort of the key set. `getOrDefault(i, 0)` folds the missing-key check into the read; snapshot `firstKey()`-style iteration is fine here since we only decrement existing/absent entries.

```java
import java.util.*;

class Solution {
    public boolean isNStraightHand(int[] hand, int groupSize) {
        if (hand.length % groupSize != 0) return false;
        TreeMap<Integer, Integer> count = new TreeMap<>();
        for (int c : hand) count.merge(c, 1, Integer::sum);
        while (!count.isEmpty()) {
            int card = count.firstKey();
            int n = count.get(card);
            for (int i = card; i < card + groupSize; i++) {
                int have = count.getOrDefault(i, 0);
                if (have < n) return false;
                if (have == n) count.remove(i);
                else count.put(i, have - n);
            }
        }
        return true;
    }
}
```

#### Rust

`BTreeMap` keeps keys sorted automatically — avoids the manual sort. The `keys: Vec<i32> = ...collect()` snapshots before mutation to avoid borrow conflicts during the inner loop.

```rust
use std::collections::BTreeMap;

fn is_n_straight_hand(hand: Vec<i32>, group_size: i32) -> bool {
    if hand.len() % group_size as usize != 0 {
        return false;
    }
    let mut count: BTreeMap<i32, i32> = BTreeMap::new();
    for c in hand {
        *count.entry(c).or_insert(0) += 1;
    }
    let keys: Vec<i32> = count.keys().cloned().collect();
    for card in keys {
        let n = *count.get(&card).unwrap_or(&0);
        if n > 0 {
            for i in card..card + group_size {
                let entry = count.entry(i).or_insert(0);
                if *entry < n {
                    return false;
                }
                *entry -= n;
            }
        }
    }
    true
}
```

#### Go

Two-step: collect keys, `sort.Ints(keys)`. Map reads default to zero, so `count[i] < n` works without comma-ok.

```go
import "sort"

func isNStraightHand(hand []int, groupSize int) bool {
    if len(hand)%groupSize != 0 {
        return false
    }
    count := map[int]int{}
    for _, c := range hand {
        count[c]++
    }
    keys := make([]int, 0, len(count))
    for k := range count {
        keys = append(keys, k)
    }
    sort.Ints(keys)
    for _, card := range keys {
        n := count[card]
        if n > 0 {
            for i := card; i < card+groupSize; i++ {
                if count[i] < n {
                    return false
                }
                count[i] -= n
            }
        }
    }
    return true
}
```

#### C++

`std::map<int,int>` (red-black tree) iterates in key order — no separate sort. Structured binding `auto& [card, n]` in the range-for.

```cpp
#include <vector>
#include <map>

bool isNStraightHand(std::vector<int>& hand, int groupSize) {
    if ((int)hand.size() % groupSize != 0) return false;
    std::map<int, int> count;
    for (int c : hand) count[c]++;
    for (auto& [card, n] : count) {
        if (n > 0) {
            for (int i = card; i < card + groupSize; ++i) {
                if (count[i] < n) return false;
                count[i] -= n;
            }
        }
    }
    return true;
}
```


### 128. Merge Triplets to Form Target Triplet

#### Problem
Given a list of triplets and a `target` triplet, you can merge any triplets by taking the element-wise maximum. Return whether it's possible to form exactly `target` by merging some subset of triplets.

#### Examples

TODO

#### Recognition
**Greedy (filter then element-wise max).** **O(n)** time, **O(1)** space.

#### Explanation
Any triplet with an element exceeding the corresponding target element would contaminate the merge (element-wise max can only grow, never shrink), so we discard those upfront. Among the remaining "safe" triplets, the best we can do is take the element-wise max — this represents using all safe triplets simultaneously. If that maximum equals `target`, we can achieve it; otherwise we cannot. No sorting or backtracking needed: the filter and max are independent per element. Edge case: if `target` itself is not achievable, `res` will fall short on at least one dimension.

#### Python

Filter triplets in place via `if t[0] <= target[0] and ...`; element-wise max grows `res` toward the target. Final equality check confirms success.

```python
def mergeTriplets(triplets, target):
    res = [0, 0, 0]
    for t in triplets:
        if t[0] <= target[0] and t[1] <= target[1] and t[2] <= target[2]:
            res = [max(res[i], t[i]) for i in range(3)]
    return res == target
```

#### Java

Fixed `int[3]` accumulator on the heap (Java arrays are always heap objects, but the pattern is the same). `Math.max` per element; `Arrays.equals` gives the concise final element-wise comparison C++ gets from `==`.

```java
import java.util.*;

class Solution {
    public boolean mergeTriplets(int[][] triplets, int[] target) {
        int[] res = new int[3];
        for (int[] t : triplets) {
            if (t[0] <= target[0] && t[1] <= target[1] && t[2] <= target[2]) {
                for (int i = 0; i < 3; i++) res[i] = Math.max(res[i], t[i]);
            }
        }
        return Arrays.equals(res, target);
    }
}
```

#### Rust

Fixed `[i32; 3]` array on the stack. Method-form `res[i].max(t[i])` for the per-element max.

```rust
fn merge_triplets(triplets: Vec<Vec<i32>>, target: Vec<i32>) -> bool {
    let mut res = [0i32; 3];
    for t in &triplets {
        if t[0] <= target[0] && t[1] <= target[1] && t[2] <= target[2] {
            for i in 0..3 {
                res[i] = res[i].max(t[i]);
            }
        }
    }
    res[0] == target[0] && res[1] == target[1] && res[2] == target[2]
}
```

#### Go

Stack-allocated `[3]int` array. Pre-1.21 explicit `if` for the max comparison.

```go
func mergeTriplets(triplets [][]int, target []int) bool {
    res := [3]int{}
    for _, t := range triplets {
        if t[0] <= target[0] && t[1] <= target[1] && t[2] <= target[2] {
            for i := 0; i < 3; i++ {
                if t[i] > res[i] {
                    res[i] = t[i]
                }
            }
        }
    }
    return res[0] == target[0] && res[1] == target[1] && res[2] == target[2]
}
```

#### C++

`std::vector<int>(3, 0)` initialized to zeros. `res == target` is element-wise vector equality — concise final check.

```cpp
#include <vector>
#include <algorithm>

bool mergeTriplets(std::vector<std::vector<int>>& triplets, std::vector<int>& target) {
    std::vector<int> res(3, 0);
    for (auto& t : triplets) {
        if (t[0] <= target[0] && t[1] <= target[1] && t[2] <= target[2]) {
            for (int i = 0; i < 3; ++i)
                res[i] = std::max(res[i], t[i]);
        }
    }
    return res == target;
}
```


### 129. Partition Labels

#### Problem
Given string `s`, partition it into as many parts as possible such that each letter appears in at most one part. Return the list of partition sizes.

#### Examples

TODO

#### Recognition
**Greedy (last-occurrence boundary extension).** **O(n)** time, **O(1)** space (26-char alphabet).

#### Explanation
To ensure a character stays within one part, the part must extend at least to the last occurrence of that character. Precompute `last[c]` — the last index where each character appears — in one scan. Then do a second scan: at each index `i`, extend the current partition's `end` to `max(end, last[c])`. When `i == end`, no character in the current window has a later occurrence, so we close this partition, record its size, and start a fresh one. The alphabet size is constant (26), so the `last` dict is O(1) space. The algorithm is essentially interval merging driven by character constraints.

#### Python

Dict comprehension `{c: i for i, c in enumerate(s)}` writes the last-occurrence map in one pass (later writes overwrite). Two-pass total: build map, then scan with boundary extension.

```python
def partitionLabels(s):
    last = {c: i for i, c in enumerate(s)}
    res = []
    start = end = 0
    for i, c in enumerate(s):
        end = max(end, last[c])
        if i == end:
            res.append(end - start + 1)
            start = i + 1
    return res
```

#### Java

A fixed `int[26]` table for last-occurrence beats a `HashMap` for the constant alphabet — index by `c - 'a'`. `charAt` iterates the string without allocating a char array; `Math.max` extends the partition boundary.

```java
import java.util.*;

class Solution {
    public List<Integer> partitionLabels(String s) {
        int[] last = new int[26];
        for (int i = 0; i < s.length(); i++) last[s.charAt(i) - 'a'] = i;
        List<Integer> res = new ArrayList<>();
        int start = 0, end = 0;
        for (int i = 0; i < s.length(); i++) {
            end = Math.max(end, last[s.charAt(i) - 'a']);
            if (i == end) {
                res.add(end - start + 1);
                start = i + 1;
            }
        }
        return res;
    }
}
```

#### Rust

Fixed `[usize; 26]` array for the last-occurrence table — stack-allocated. Byte arithmetic `(b - b'a') as usize` for the index.

```rust
fn partition_labels(s: String) -> Vec<i32> {
    let s: Vec<u8> = s.bytes().collect();
    let mut last = [0usize; 26];
    for (i, &b) in s.iter().enumerate() {
        last[(b - b'a') as usize] = i;
    }
    let mut res = Vec::new();
    let mut start = 0;
    let mut end = 0;
    for (i, &b) in s.iter().enumerate() {
        let l = last[(b - b'a') as usize];
        if l > end { end = l; }
        if i == end {
            res.push((end - start + 1) as i32);
            start = i + 1;
        }
    }
    res
}
```

#### Go

Stack-allocated `[26]int` array. Same two-pass structure as Python/Rust.

```go
func partitionLabels(s string) []int {
    last := [26]int{}
    for i, c := range s {
        last[c-'a'] = i
    }
    res := []int{}
    start, end := 0, 0
    for i, c := range s {
        if last[c-'a'] > end {
            end = last[c-'a']
        }
        if i == end {
            res = append(res, end-start+1)
            start = i + 1
        }
    }
    return res
}
```

#### C++

`int last[26] = {}` value-initializes to zero on the stack. `std::max` for the boundary extension.

```cpp
#include <vector>
#include <string>
#include <algorithm>

std::vector<int> partitionLabels(std::string s) {
    int last[26] = {};
    for (int i = 0; i < (int)s.size(); ++i)
        last[s[i] - 'a'] = i;
    std::vector<int> res;
    int start = 0, end = 0;
    for (int i = 0; i < (int)s.size(); ++i) {
        end = std::max(end, last[s[i] - 'a']);
        if (i == end) {
            res.push_back(end - start + 1);
            start = i + 1;
        }
    }
    return res;
}
```


### 130. Valid Parenthesis String

#### Problem
Given a string containing `(`, `)`, and `*` (which can be `(`, `)`, or empty), return whether the string can be valid.

#### Examples

TODO

#### Recognition
**Greedy (min/max open-count range).** **O(n)** time, **O(1)** space.

#### Explanation
A DP approach over all possible assignments of `*` is O(n²). The greedy insight: instead of tracking one exact open count, track the range `[lo, hi]` of possible open-paren counts across all valid wildcard choices. `(` increments both bounds; `)` decrements both; `*` widens the range (decrement `lo`, increment `hi`). If `hi` drops below zero, even the most optimistic interpretation has more closes than opens — impossible. Clamp `lo` to zero because a negative open count is meaningless. At the end, valid iff `lo == 0` (there exists an assignment that closes all opens).

#### Python

Track `[lo, hi]` range of possible open counts; `*` widens the range. `lo = max(lo, 0)` clamps negative opens (can't have less than zero).

```python
def checkValidString(s):
    lo = hi = 0
    for c in s:
        if c == "(":
            lo += 1; hi += 1
        elif c == ")":
            lo -= 1; hi -= 1
        else:
            lo -= 1; hi += 1
        if hi < 0:
            return False
        lo = max(lo, 0)
    return lo == 0
```

#### Java

Pure `int` bookkeeping — no collections. `charAt` reads each character; `Math.max(lo, 0)` clamps the lower bound, the same trick as C++.

```java
class Solution {
    public boolean checkValidString(String s) {
        int lo = 0, hi = 0;
        for (int idx = 0; idx < s.length(); idx++) {
            char c = s.charAt(idx);
            if (c == '(') { lo++; hi++; }
            else if (c == ')') { lo--; hi--; }
            else { lo--; hi++; }
            if (hi < 0) return false;
            lo = Math.max(lo, 0);
        }
        return lo == 0;
    }
}
```

#### Rust

Pattern match on `char` with three arms. The `if lo < 0 { lo = 0 }` clamp is explicit; no method-form `max` for this in-place mutation.

```rust
fn check_valid_string(s: String) -> bool {
    let (mut lo, mut hi) = (0i32, 0i32);
    for c in s.chars() {
        match c {
            '(' => { lo += 1; hi += 1; }
            ')' => { lo -= 1; hi -= 1; }
            _   => { lo -= 1; hi += 1; }
        }
        if hi < 0 { return false; }
        if lo < 0 { lo = 0; }
    }
    lo == 0
}
```

#### Go

`switch c { case '(': ... }` for the three-way branch. The `if lo < 0` clamp is the same shape as Rust.

```go
func checkValidString(s string) bool {
    lo, hi := 0, 0
    for _, c := range s {
        switch c {
        case '(':
            lo++; hi++
        case ')':
            lo--; hi--
        default:
            lo--; hi++
        }
        if hi < 0 {
            return false
        }
        if lo < 0 {
            lo = 0
        }
    }
    return lo == 0
}
```

#### C++

if-else-if ladder for the three branches. `std::max(lo, 0)` for the clamp.

```cpp
#include <string>
#include <algorithm>

bool checkValidString(std::string s) {
    int lo = 0, hi = 0;
    for (char c : s) {
        if (c == '(') { lo++; hi++; }
        else if (c == ')') { lo--; hi--; }
        else { lo--; hi++; }
        if (hi < 0) return false;
        lo = std::max(lo, 0);
    }
    return lo == 0;
}
```


### 131. Insert Interval

#### Problem
Given a sorted list of non-overlapping intervals and a `newInterval`, insert it into the list (merging if necessary) and return the updated sorted list.

#### Examples

```text
Input: intervals = [[1,3],[6,9]], newInterval = [2,5]
Output: [[1,5],[6,9]]
Explanation: [2,5] overlaps [1,3], so they fuse into [1,5].

Input: intervals = [[1,2],[3,5],[6,7],[8,10],[12,16]],
       newInterval = [4,8]
Output: [[1,2],[3,10],[12,16]]

Input: intervals = [], newInterval = [5,7]
Output: [[5,7]]

Constraints:
- 0 <= intervals.length <= 10^4
- intervals is sorted by start and pairwise disjoint
- 0 <= start <= end <= 10^5
```

#### Recognition
**Signals.** The statement volunteers that the input is "sorted" and "non-overlapping", and that you insert exactly one interval. A guarantee handed to you for free is a budget statement: the `O(n log n)` has already been paid, so the intended answer is `O(n)`. Disjointness adds a second fact, that everything `newInterval` touches forms one contiguous run, so the edit is local. **Therefore.** One pass in three phases: copy intervals ending before `newInterval` starts, absorb every interval that touches it by widening with `min` and `max`, append it, copy the rest. **Not sort-then-merge**, the Merge Intervals routine run over `intervals + [newInterval]`, which is correct but discards both guarantees and pays `O(n log n)` to rediscover an order the problem already gave you. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Append the new interval and re-merge the whole list from scratch.

```python
def insert(intervals, newInterval):
    ivs = sorted(intervals + [newInterval])
    res = []
    for s, e in ivs:
        if res and s <= res[-1][1]:
            res[-1][1] = max(res[-1][1], e)
        else:
            res.append([s, e])
    return res
```

`O(n log n)` time, `O(n)` space.

**Wasteful because.** The sort re-derives an ordering the input already carried, and the merge pass then tests all `n` intervals for overlaps that the disjointness guarantee has already ruled out. Only the run of intervals actually touching `newInterval` can change.

**Optimal.** Walk the sorted list once and let position do the sorting's job. Three cases, in order: if `newInterval` ends before the current interval starts you are past the affected run, so emit `newInterval` and copy the untouched suffix; if `newInterval` starts after the current interval ends you have not reached the run yet, so copy the interval through; otherwise they touch, and you widen `newInterval` to `min` of the starts and `max` of the ends rather than emitting anything. Widening rather than emitting is what fuses a whole chain of overlaps into one interval in a single pass, and it is correct because the inputs are disjoint, so once the widened interval clears the current one it can only meet later ones. A binary search would find the first affected interval in `O(log n)`, but you still copy every element into the output, so the total stays `O(n)`; that only pays off when you can splice in place instead of returning a fresh list.

**Edge cases.** An empty input list falls straight through the loop and returns `[[newInterval]]`. A `newInterval` that lands entirely before or entirely after every existing interval never enters the widening branch. Touching endpoints count as overlap, so `[1,3]` and `[3,5]` fuse into `[1,5]`. A `newInterval` swallowing several intervals emits exactly one merged result.

#### Python

Three-phase scan with the early `return res + intervals[i:]` short-circuit — slice concatenation in one line. The merging phase mutates `newInterval` so the final append uses the expanded version.

```python
def insert(intervals, newInterval):
    res = []
    for i, (s, e) in enumerate(intervals):
        if newInterval[1] < s:
            res.append(newInterval)
            return res + intervals[i:]
        elif newInterval[0] > e:
            res.append([s, e])
        else:
            newInterval = [min(newInterval[0], s), max(newInterval[1], e)]
    res.append(newInterval)
    return res
```

#### Java

`List<int[]>` for the result; there is no slice-append, so copy the suffix with `res.add(intervals[j])` in a loop for the early-exit phase. Return `res.toArray(new int[0][])` to match the `int[][]` signature LeetCode expects.

```java
import java.util.*;

class Solution {
    public int[][] insert(int[][] intervals, int[] newInterval) {
        List<int[]> res = new ArrayList<>();
        for (int i = 0; i < intervals.length; i++) {
            int s = intervals[i][0], e = intervals[i][1];
            if (newInterval[1] < s) {
                res.add(newInterval);
                for (int j = i; j < intervals.length; j++) res.add(intervals[j]);
                return res.toArray(new int[0][]);
            } else if (newInterval[0] > e) {
                res.add(new int[]{s, e});
            } else {
                newInterval = new int[]{Math.min(newInterval[0], s), Math.max(newInterval[1], e)};
            }
        }
        res.add(newInterval);
        return res.toArray(new int[0][]);
    }
}
```

#### Rust

`inserted` flag tracks whether `new_iv` has been appended — needed because we don't have Python's early-return-with-slice form. `.clone()` on each `iv` because we're pushing into a new `Vec`.

```rust
fn insert(intervals: Vec<Vec<i32>>, new_interval: Vec<i32>) -> Vec<Vec<i32>> {
    let mut res: Vec<Vec<i32>> = Vec::new();
    let mut new_iv = new_interval;
    let mut inserted = false;
    for iv in &intervals {
        if new_iv[1] < iv[0] {
            if !inserted { res.push(new_iv.clone()); inserted = true; }
            res.push(iv.clone());
        } else if new_iv[0] > iv[1] {
            res.push(iv.clone());
        } else {
            new_iv[0] = new_iv[0].min(iv[0]);
            new_iv[1] = new_iv[1].max(iv[1]);
        }
    }
    if !inserted { res.push(new_iv); }
    res
}
```

#### Go

`append(res, intervals[i:]...)` for the early-exit suffix copy — exact mirror of Python's slice concat. Slices are cheap views, so no per-element copy.

```go
func insert(intervals [][]int, newInterval []int) [][]int {
    res := [][]int{}
    for i, iv := range intervals {
        if newInterval[1] < iv[0] {
            res = append(res, newInterval)
            return append(res, intervals[i:]...)
        } else if newInterval[0] > iv[1] {
            res = append(res, iv)
        } else {
            if iv[0] < newInterval[0] { newInterval[0] = iv[0] }
            if iv[1] > newInterval[1] { newInterval[1] = iv[1] }
        }
    }
    return append(res, newInterval)
}
```

#### C++

Manual `for (int j = i; ...)` to copy the suffix — no `append(slice...)` equivalent. The `newInterval` is mutated in place during the merge phase.

```cpp
#include <vector>
#include <algorithm>

std::vector<std::vector<int>> insert(std::vector<std::vector<int>>& intervals, std::vector<int>& newInterval) {
    std::vector<std::vector<int>> res;
    for (int i = 0; i < (int)intervals.size(); ++i) {
        if (newInterval[1] < intervals[i][0]) {
            res.push_back(newInterval);
            for (int j = i; j < (int)intervals.size(); ++j)
                res.push_back(intervals[j]);
            return res;
        } else if (newInterval[0] > intervals[i][1]) {
            res.push_back(intervals[i]);
        } else {
            newInterval[0] = std::min(newInterval[0], intervals[i][0]);
            newInterval[1] = std::max(newInterval[1], intervals[i][1]);
        }
    }
    res.push_back(newInterval);
    return res;
}
```


### 132. Merge Intervals

#### Problem
Given a list of intervals, merge all overlapping intervals and return the minimal non-overlapping list.

#### Examples

```text
Input: intervals = [[1,3],[2,6],[8,10],[15,18]]
Output: [[1,6],[8,10],[15,18]]
Explanation: [1,3] and [2,6] overlap, so they fuse into [1,6].

Input: intervals = [[1,4],[4,5]]
Output: [[1,5]]

Input: intervals = [[1,4],[2,3]]
Output: [[1,4]]

Constraints:
- 1 <= intervals.length <= 10^4
- intervals[i].length == 2
- 0 <= start <= end <= 10^4
```

#### Recognition
**Signals.** "Intervals", "overlapping", "merge", and an output that is a restructured *set* rather than a count, with nothing said about the input order. That silence is the tell: nothing in the raw input tells you which intervals are neighbours, and supplying that missing adjacency is exactly what a sort buys. **Therefore.** Sort by start, then sweep once, extending the last kept interval when the current one starts at or before its end and appending otherwise. **Not sorting by end**, which also clusters overlaps but destroys the one-comparison test: after an end-sort a later interval can start before the last kept interval's start, so deciding overlap means scanning further back than one element. Sorting by start guarantees every earlier-starting interval has already been folded in, which makes the previous result entry the only candidate. **O(n log n)** time, **O(n)** space.

#### Explanation
**Brute force.** Fuse any overlapping pair you can find, and repeat until nothing changes.

```python
def merge(intervals):
    res = [iv[:] for iv in intervals]
    i = 0
    while i < len(res):
        for j in range(i + 1, len(res)):
            if res[i][0] <= res[j][1] and res[j][0] <= res[i][1]:
                res[i][0] = min(res[i][0], res[j][0])
                res[i][1] = max(res[i][1], res[j][1])
                res.pop(j)
                i = -1
                break
        i += 1
    res.sort()
    return res
```

`O(n^3)` time, `O(n)` space.

**Wasteful because.** Every fuse widens an interval and so invalidates the pairings already rejected, forcing the whole `O(n^2)` pair scan to restart. The overlap test itself is two comparisons; running it that many times is the cost, and it exists only because nothing tells you which intervals sit next to each other.

**Optimal.** Sort by start first, at `O(n log n)`, and the restarts vanish. Seed the result with the first interval, then for each next one compare its start against the last result entry's end: if `start <= res[-1][1]` they touch, so widen with `res[-1][1] = max(res[-1][1], end)`; otherwise the gap is real and you append. Only the last entry ever needs checking, because starts are non-decreasing, so any interval that failed to touch the running result cannot touch anything earlier either. The `max` on the end, rather than a plain assignment, is what handles a fully contained interval: `[2,3]` inside `[1,4]` must not shrink the result to `[1,3]`. The sort dominates; the sweep is a single `O(n)` pass and the only extra memory is the output.

**Edge cases.** A single interval comes back unchanged, which is why seeding the result with `intervals[0]` is safe. Touching endpoints count as overlap, so `[1,4]` and `[4,5]` fuse into `[1,5]`. A fully contained interval keeps the outer end. Input already disjoint returns the same list in sorted order.

#### Python

`intervals.sort()` sorts by first element by default — `[s, e]` lists compare lexicographically. `res[-1][1] = max(...)` mutates the last result in place.

```python
def merge(intervals):
    intervals.sort()
    res = [intervals[0]]
    for s, e in intervals[1:]:
        if s <= res[-1][1]:
            res[-1][1] = max(res[-1][1], e)
        else:
            res.append([s, e])
    return res
```

#### Java

`Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]))` sorts by start without boxing the key. Keep a `List<int[]>` and mutate `res.get(res.size()-1)[1]` in place to extend the last merged end.

```java
import java.util.*;

class Solution {
    public int[][] merge(int[][] intervals) {
        Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));
        List<int[]> res = new ArrayList<>();
        res.add(intervals[0]);
        for (int i = 1; i < intervals.length; i++) {
            int[] last = res.get(res.size() - 1);
            if (intervals[i][0] <= last[1]) {
                last[1] = Math.max(last[1], intervals[i][1]);
            } else {
                res.add(intervals[i]);
            }
        }
        return res.toArray(new int[0][]);
    }
}
```

#### Rust

`sort_by_key(|iv| iv[0])` is explicit about the sort key. `res.last_mut().unwrap()` to mutate the last interval — borrow checker requires the explicit `.unwrap()`.

```rust
fn merge(mut intervals: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
    intervals.sort_by_key(|iv| iv[0]);
    let mut res: Vec<Vec<i32>> = vec![intervals[0].clone()];
    for iv in intervals.into_iter().skip(1) {
        let last = res.last_mut().unwrap();
        if iv[0] <= last[1] {
            last[1] = last[1].max(iv[1]);
        } else {
            res.push(iv);
        }
    }
    res
}
```

#### Go

`sort.Slice` with a closure comparator. `res[len(res)-1]` indexes the last interval — pre-1.21 has no `slices.LastIndex` helper.

```go
import "sort"

func merge(intervals [][]int) [][]int {
    sort.Slice(intervals, func(i, j int) bool {
        return intervals[i][0] < intervals[j][0]
    })
    res := [][]int{intervals[0]}
    for _, iv := range intervals[1:] {
        last := res[len(res)-1]
        if iv[0] <= last[1] {
            if iv[1] > last[1] { last[1] = iv[1] }
        } else {
            res = append(res, iv)
        }
    }
    return res
}
```

#### C++

Default `std::sort` on `vector<vector<int>>` compares lexicographically. `res.back()[1]` accesses the last interval's end — `back()` returns a reference.

```cpp
#include <vector>
#include <algorithm>

std::vector<std::vector<int>> merge(std::vector<std::vector<int>>& intervals) {
    std::sort(intervals.begin(), intervals.end());
    std::vector<std::vector<int>> res = {intervals[0]};
    for (int i = 1; i < (int)intervals.size(); ++i) {
        if (intervals[i][0] <= res.back()[1]) {
            res.back()[1] = std::max(res.back()[1], intervals[i][1]);
        } else {
            res.push_back(intervals[i]);
        }
    }
    return res;
}
```


### 133. Non-overlapping Intervals

#### Problem
Given intervals, return the minimum number of intervals to remove so that no two intervals overlap.

#### Examples

```text
Input: intervals = [[1,2],[2,3],[3,4],[1,3]]
Output: 1
Explanation: drop [1,3] and the other three are disjoint.

Input: intervals = [[1,2],[1,2],[1,2]]
Output: 2

Input: intervals = [[1,2],[2,3]]
Output: 0

Constraints:
- 1 <= intervals.length <= 10^5
- intervals[i].length == 2
- -5 * 10^4 <= start < end <= 5 * 10^4
```

#### Recognition
**Signals.** "Minimum number of intervals to remove so that no two overlap." Minimising removals is maximising what stays, so this is Activity Selection with the answer read backwards. Every removal costs the same and no interval carries a value or priority, and that unweighted counting is the second tell: the moment intervals carry weights this becomes weighted interval scheduling, which needs DP and binary search rather than a greedy. **Therefore.** Sort by *end*, keep an interval whenever its start is at or after the last kept end, and count everything else as a removal. The exchange argument: replacing any optimal schedule's first pick with the earliest-finishing interval frees the timeline no later, so it never creates a fresh conflict. **Not sorting by start**, which will happily keep one long early interval that blocks several short ones that would all have fitted. **O(n log n)** time, **O(1)** space.

#### Explanation
**Brute force.** Try every subset and keep the largest conflict-free one.

```python
def eraseOverlapIntervals(intervals):
    n = len(intervals)
    best = 0
    for mask in range(1 << n):
        pick = sorted(intervals[i] for i in range(n)
                      if mask >> i & 1)
        ok = all(pick[k][1] <= pick[k + 1][0]
                 for k in range(len(pick) - 1))
        if ok:
            best = max(best, len(pick))
    return n - best
```

`O(2^n * n log n)` time, `O(n)` space.

**Wasteful because.** The `2^n` subsets overlap enormously, so the same pair of intervals is re-tested for conflict in exponentially many candidate schedules. Every subset containing `[1,3]` and `[2,4]` rediscovers that those two clash.

**Optimal.** The choice does not actually need searching, because one rule fixes it. Sort by end time and walk left to right holding `end`, the finish time of the last interval you kept. If the current interval starts at or after `end` it fits, so keep it and advance `end`; otherwise it conflicts with something already kept and you count a removal. Earliest-finish-first is optimal by the exchange argument above: among the intervals still compatible with what you have kept, the one that ends soonest leaves the most room for everything after it, and swapping it into any optimal schedule cannot make that schedule worse. Sorting by end rather than start is the entire difference between this and Merge Intervals, and it is not interchangeable: with `[[1,100],[2,3],[4,5]]` a start-sort keeps `[1,100]` and removes two, while the end-sort keeps both short ones and removes one. Initialise `end` to negative infinity so the first interval is always kept.

**Edge cases.** Identical duplicates conflict with each other, so three copies of `[1,2]` cost two removals. Touching intervals do not overlap, which is why the test is `start >= end` and not `>`, so `[[1,2],[2,3]]` answers `0`. A single interval or an empty list answers `0`. Fully contained intervals are handled by the end-sort automatically, since the inner one finishes first and is seen first.

#### Python

Sort by end (`key=lambda x: x[1]`) — the activity-selection insight. `float('-inf')` initial `end` ensures the first interval is always kept.

```python
def eraseOverlapIntervals(intervals):
    intervals.sort(key=lambda x: x[1])
    res = 0
    end = float('-inf')
    for s, e in intervals:
        if s >= end:
            end = e
        else:
            res += 1
    return res
```

#### Java

`Comparator.comparingInt(a -> a[1])` sorts by end for the activity-selection greedy. `Integer.MIN_VALUE` is the initial sentinel — safe because we only compare, never do arithmetic that could overflow.

```java
import java.util.*;

class Solution {
    public int eraseOverlapIntervals(int[][] intervals) {
        Arrays.sort(intervals, Comparator.comparingInt(a -> a[1]));
        int res = 0, end = Integer.MIN_VALUE;
        for (int[] iv : intervals) {
            if (iv[0] >= end) end = iv[1];
            else res++;
        }
        return res;
    }
}
```

#### Rust

`sort_by_key(|iv| iv[1])` sorts by end. `i32::MIN` as the initial sentinel; `i32::MIN` won't overflow when compared.

```rust
fn erase_overlap_intervals(mut intervals: Vec<Vec<i32>>) -> i32 {
    intervals.sort_by_key(|iv| iv[1]);
    let mut res = 0;
    let mut end = i32::MIN;
    for iv in &intervals {
        if iv[0] >= end {
            end = iv[1];
        } else {
            res += 1;
        }
    }
    res
}
```

#### Go

Manual closure for the by-end sort. `-1 << 62` for a very negative sentinel — avoids importing `math.MinInt64`.

```go
import "sort"

func eraseOverlapIntervals(intervals [][]int) int {
    sort.Slice(intervals, func(i, j int) bool {
        return intervals[i][1] < intervals[j][1]
    })
    res := 0
    end := -1 << 62
    for _, iv := range intervals {
        if iv[0] >= end {
            end = iv[1]
        } else {
            res++
        }
    }
    return res
}
```

#### C++

Lambda comparator `[](auto& a, auto& b){ return a[1] < b[1]; }` for the by-end sort. `INT_MIN` from `<climits>` for the initial sentinel.

```cpp
#include <vector>
#include <algorithm>
#include <climits>

int eraseOverlapIntervals(std::vector<std::vector<int>>& intervals) {
    std::sort(intervals.begin(), intervals.end(),
              [](auto& a, auto& b){ return a[1] < b[1]; });
    int res = 0, end = INT_MIN;
    for (auto& iv : intervals) {
        if (iv[0] >= end) end = iv[1];
        else ++res;
    }
    return res;
}
```


### 134. Meeting Rooms

#### Problem
Given a list of meeting time intervals `[start, end]`, determine if a person can attend all meetings without any overlap.

#### Examples

TODO

#### Recognition
**Sort then adjacent-pair check.** **O(n log n)** time, **O(1)** space.

#### Explanation
After sorting by start time, any overlap must occur between adjacent intervals — a later interval can only overlap with its predecessor because predecessors are sorted. Check each consecutive pair: if the next meeting starts before the current one ends (`intervals[i][0] < intervals[i-1][1]`), return False. If `end` equals `start` exactly, that is not an overlap (meetings are back-to-back). The sort is necessary; without it, a meeting starting much later but appearing earlier in the list could mask an overlap. An empty or single-element input trivially returns True.

#### Python

Default sort puts intervals by start time. The adjacent-pair check `intervals[i][0] < intervals[i-1][1]` — `<` not `<=` because back-to-back meetings (`end == start`) don't conflict.

```python
def canAttendMeetings(intervals):
    intervals.sort()
    for i in range(1, len(intervals)):
        if intervals[i][0] < intervals[i-1][1]:
            return False
    return True
```

#### Java

`Arrays.sort` with `comparingInt(a -> a[0])` orders by start; then a single adjacent-pair scan. The strict `<` (not `<=`) is the load-bearing detail — back-to-back meetings where `end == start` don't conflict.

```java
import java.util.*;

class Solution {
    public boolean canAttendMeetings(int[][] intervals) {
        Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));
        for (int i = 1; i < intervals.length; i++) {
            if (intervals[i][0] < intervals[i - 1][1]) return false;
        }
        return true;
    }
}
```

#### Rust

`sort_by_key(|iv| iv[0])` for explicit by-start. Loop with `1..intervals.len()` for the adjacent comparison.

```rust
fn can_attend_meetings(mut intervals: Vec<Vec<i32>>) -> bool {
    intervals.sort_by_key(|iv| iv[0]);
    for i in 1..intervals.len() {
        if intervals[i][0] < intervals[i-1][1] {
            return false;
        }
    }
    true
}
```

#### Go

Closure comparator; otherwise identical. The strict `<` on the overlap check is the language-independent invariant.

```go
import "sort"

func canAttendMeetings(intervals [][]int) bool {
    sort.Slice(intervals, func(i, j int) bool {
        return intervals[i][0] < intervals[j][0]
    })
    for i := 1; i < len(intervals); i++ {
        if intervals[i][0] < intervals[i-1][1] {
            return false
        }
    }
    return true
}
```

#### C++

Default `std::sort` does lexicographic comparison — works because start is the first element. Same adjacent-pair check shape.

```cpp
#include <vector>
#include <algorithm>

bool canAttendMeetings(std::vector<std::vector<int>>& intervals) {
    std::sort(intervals.begin(), intervals.end());
    for (int i = 1; i < (int)intervals.size(); ++i) {
        if (intervals[i][0] < intervals[i-1][1]) return false;
    }
    return true;
}
```


### 135. Meeting Rooms II

#### Problem
Given meeting time intervals, return the minimum number of conference rooms required to hold all meetings simultaneously.

#### Examples

```text
Input: intervals = [[0,30],[5,10],[15,20]]
Output: 2
Explanation: [0,30] holds one room throughout; the other
two never overlap each other, so they share a second.

Input: intervals = [[7,10],[2,4]]
Output: 1

Input: intervals = [[1,5],[5,9],[5,9]]
Output: 2

Constraints:
- 1 <= intervals.length <= 10^4
- 0 <= start < end <= 10^6
- a room freed at time t is reusable at time t
```

#### Recognition
**Signals.** "Minimum number of conference rooms" plus "simultaneously". A minimum-resource count over intervals is not a subset question, it is a *maximum concurrency* question: the answer is the largest number of meetings alive at one instant, and concurrency only changes at a start or an end. Interval input plus a quantity measured "at any instant" is the standing cue to sort by start and walk forward in time. **Therefore.** Sort by start, keep a min-heap of end times representing the rooms opened so far, and for each meeting either reuse the room that frees soonest (when its end is at or below the new start) or open a new one. The heap never shrinks, so its final size is the peak. **Not merge intervals**, the reflex on interval input, because merging collapses overlaps into a single span and destroys exactly the quantity being counted: `[[0,30],[5,10],[15,20]]` merges to one `[0,30]` and reports 1 room instead of 2. **O(n log n)** time, **O(n)** space.

#### Explanation
**Brute force.** Count how many meetings are live at each meeting's start.

```python
def minMeetingRooms(intervals):
    best = 0
    for s, _ in intervals:
        live = 0
        for a, b in intervals:
            if a <= s < b:
                live += 1
        if live > best:
            best = live
    return best
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** Concurrency changes by exactly one at each start and each end, yet the inner loop rebuilds the whole count from scratch at every start, re-testing meetings it already knew were live an instant earlier.

**Optimal.** Process meetings in start order so the count is maintained instead of recomputed. A min-heap of end times holds the rooms opened so far with the one freeing soonest on top. For each meeting, if that earliest end is at or below the new start the room is genuinely free, so overwrite it with this meeting's end and the room count is unchanged; otherwise no room is free (the earliest end is the best candidate, so if it fails they all fail) and a push grows the count by one. The heap therefore never shrinks, and its final size is the peak concurrency. One sort plus `n` heap operations is `O(n log n)`. A sweep line over `(start, +1)` and `(end, -1)` events costs the same and is less code; keep the heap when you also need to know *which* meeting expires next.

**Edge cases.** Touching meetings such as `[1,5]` and `[5,9]` share one room, which is why the test is `<=` and not `<`. Fully nested meetings like `[5,10]` inside `[0,30]` still need two rooms. An empty list returns 0 with no special branch.

#### Python

`heapreplace` is pop-then-push in one O(log n) operation — slightly faster than the two separate calls. The heap holds end times only; the count is the room count.

```python
import heapq

def minMeetingRooms(intervals):
    intervals.sort()
    heap = []
    for s, e in intervals:
        if heap and heap[0] <= s:
            heapq.heapreplace(heap, e)
        else:
            heapq.heappush(heap, e)
    return len(heap)
```

#### Java

`PriorityQueue<Integer>` is a min-heap by default, so `peek()` returns the earliest end time with no `Comparator` needed. There is no atomic `heapreplace`, so express it as `poll()` then `offer()` when the room frees up; the final `size()` is the peak room count.

```java
import java.util.*;

class Solution {
    public int minMeetingRooms(int[][] intervals) {
        Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));
        PriorityQueue<Integer> heap = new PriorityQueue<>();
        for (int[] iv : intervals) {
            if (!heap.isEmpty() && heap.peek() <= iv[0]) heap.poll();
            heap.offer(iv[1]);
        }
        return heap.size();
    }
}
```

#### Rust

`Reverse(i32)` for min-heap behavior. Pattern destructure `if let Some(&Reverse(top)) = heap.peek()` to inspect without popping.

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

fn min_meeting_rooms(mut intervals: Vec<Vec<i32>>) -> i32 {
    intervals.sort_by_key(|iv| iv[0]);
    let mut heap: BinaryHeap<Reverse<i32>> = BinaryHeap::new();
    for iv in &intervals {
        if let Some(&Reverse(top)) = heap.peek() {
            if top <= iv[0] {
                heap.pop();
            }
        }
        heap.push(Reverse(iv[1]));
    }
    heap.len() as i32
}
```

#### Go

Custom `MinHeap` via the heap interface. `(*h)[0]` to peek the top — Go's heap doesn't expose `Peek` directly.

```go
import (
    "container/heap"
    "sort"
)

type MinHeap []int
func (h MinHeap) Len() int           { return len(h) }
func (h MinHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h MinHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *MinHeap) Push(x interface{}) { *h = append(*h, x.(int)) }
func (h *MinHeap) Pop() interface{} {
    old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x
}

func minMeetingRooms(intervals [][]int) int {
    sort.Slice(intervals, func(i, j int) bool {
        return intervals[i][0] < intervals[j][0]
    })
    h := &MinHeap{}
    heap.Init(h)
    for _, iv := range intervals {
        if h.Len() > 0 && (*h)[0] <= iv[0] {
            heap.Pop(h)
        }
        heap.Push(h, iv[1])
    }
    return h.Len()
}
```

#### C++

`std::priority_queue<int, vector<int>, greater<int>>` is the min-heap incantation. `heap.top()` peeks without popping.

```cpp
#include <vector>
#include <queue>
#include <algorithm>

int minMeetingRooms(std::vector<std::vector<int>>& intervals) {
    std::sort(intervals.begin(), intervals.end());
    std::priority_queue<int, std::vector<int>, std::greater<int>> heap;
    for (auto& iv : intervals) {
        if (!heap.empty() && heap.top() <= iv[0]) heap.pop();
        heap.push(iv[1]);
    }
    return (int)heap.size();
}
```


### 136. Minimum Interval to Include Each Query

#### Problem
Given intervals and queries, for each query value return the size (`end - start + 1`) of the smallest interval containing it, or -1 if none.

#### Examples

TODO

#### Recognition
**Sort + sweep with min-heap.** **O((n + q) log n)** time, **O(n + q)** space.

#### Explanation
Processing queries offline (sorted) lets us sweep through intervals left to right. As we advance each query `q`, we add all intervals whose start ≤ `q` to a min-heap keyed by size. The heap always contains candidates that have started by `q`. Before reading the answer, evict stale intervals whose end < `q` (they no longer contain `q`). The top of the heap is then the smallest valid interval. Storing results in a dict keyed by query value lets us reconstruct answers in original query order at the end. Eviction is lazy — only pop when the top is invalid — so each interval is pushed and popped at most once.

#### Python

Three-way state: (a) sorted intervals advance with a pointer `i`, (b) min-heap of (size, end) candidates, (c) lazy eviction of stale intervals. Dict for result reordering to original query order.

```python
import heapq

def minInterval(intervals, queries):
    intervals.sort()
    heap = []
    res = {}
    i = 0
    for q in sorted(queries):
        while i < len(intervals) and intervals[i][0] <= q:
            s, e = intervals[i]
            heapq.heappush(heap, (e - s + 1, e))
            i += 1
        while heap and heap[0][1] < q:
            heapq.heappop(heap)
        res[q] = heap[0][0] if heap else -1
    return [res[q] for q in queries]
```

#### Java

A `PriorityQueue<int[]>` with `Comparator.comparingInt(a -> a[0])` is the min-heap keyed by size; `peek()` reads the top without popping for the lazy eviction. A `HashMap<Integer,Integer>` reorders answers back to the original query order.

```java
import java.util.*;

class Solution {
    public int[] minInterval(int[][] intervals, int[] queries) {
        Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));
        int[] sortedQ = queries.clone();
        Arrays.sort(sortedQ);
        PriorityQueue<int[]> heap = new PriorityQueue<>(Comparator.comparingInt(a -> a[0])); // (size, end)
        Map<Integer, Integer> resMap = new HashMap<>();
        int i = 0;
        for (int q : sortedQ) {
            while (i < intervals.length && intervals[i][0] <= q) {
                int s = intervals[i][0], e = intervals[i][1];
                heap.offer(new int[]{e - s + 1, e});
                i++;
            }
            while (!heap.isEmpty() && heap.peek()[1] < q) heap.poll();
            resMap.put(q, heap.isEmpty() ? -1 : heap.peek()[0]);
        }
        int[] out = new int[queries.length];
        for (int k = 0; k < queries.length; k++) out[k] = resMap.get(queries[k]);
        return out;
    }
}
```

#### Rust

`Reverse((i32, i32))` for the min-heap on tuples. Borrow gymnastics around `peek()` returning `Option<&Reverse<(i32,i32)>>` — pattern destructure is verbose but explicit.

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;
use std::collections::HashMap;

fn min_interval(mut intervals: Vec<Vec<i32>>, queries: Vec<i32>) -> Vec<i32> {
    intervals.sort_by_key(|iv| iv[0]);
    let mut sorted_q: Vec<i32> = queries.clone();
    sorted_q.sort();
    let mut heap: BinaryHeap<Reverse<(i32, i32)>> = BinaryHeap::new(); // (size, end)
    let mut res_map: HashMap<i32, i32> = HashMap::new();
    let mut i = 0;
    for q in sorted_q {
        while i < intervals.len() && intervals[i][0] <= q {
            let (s, e) = (intervals[i][0], intervals[i][1]);
            heap.push(Reverse((e - s + 1, e)));
            i += 1;
        }
        while let Some(&Reverse((_, e))) = heap.peek() {
            if e < q { heap.pop(); } else { break; }
        }
        let ans = if let Some(&Reverse((sz, _))) = heap.peek() { sz } else { -1 };
        res_map.insert(q, ans);
    }
    queries.iter().map(|q| *res_map.get(q).unwrap_or(&-1)).collect()
}
```

#### Go

Custom `SizeEndHeap` storing `[2]int` arrays — keys must be comparable but arrays are. The lazy eviction `(*h)[0][1] < q` reads the top size+end without popping.

```go
import (
    "container/heap"
    "sort"
)

type SizeEndHeap [][2]int
func (h SizeEndHeap) Len() int            { return len(h) }
func (h SizeEndHeap) Less(i, j int) bool  { return h[i][0] < h[j][0] }
func (h SizeEndHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *SizeEndHeap) Push(x interface{}) { *h = append(*h, x.([2]int)) }
func (h *SizeEndHeap) Pop() interface{} {
    old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x
}

func minInterval(intervals [][]int, queries []int) []int {
    sort.Slice(intervals, func(i, j int) bool { return intervals[i][0] < intervals[j][0] })
    sortedQ := make([]int, len(queries))
    copy(sortedQ, queries)
    sort.Ints(sortedQ)
    resMap := map[int]int{}
    h := &SizeEndHeap{}
    heap.Init(h)
    idx := 0
    for _, q := range sortedQ {
        for idx < len(intervals) && intervals[idx][0] <= q {
            s, e := intervals[idx][0], intervals[idx][1]
            heap.Push(h, [2]int{e - s + 1, e})
            idx++
        }
        for h.Len() > 0 && (*h)[0][1] < q {
            heap.Pop(h)
        }
        if h.Len() > 0 {
            resMap[q] = (*h)[0][0]
        } else {
            resMap[q] = -1
        }
    }
    out := make([]int, len(queries))
    for i, q := range queries {
        out[i] = resMap[q]
    }
    return out
}
```

#### C++

`priority_queue<pair<int,int>, vector<pair<int,int>>, greater<P>>` — the min-heap by tuple-lex. `heap.top().first` for size, `.second` for end.

```cpp
#include <vector>
#include <queue>
#include <algorithm>
#include <unordered_map>

std::vector<int> minInterval(std::vector<std::vector<int>>& intervals, std::vector<int>& queries) {
    std::sort(intervals.begin(), intervals.end());
    std::vector<int> sortedQ = queries;
    std::sort(sortedQ.begin(), sortedQ.end());
    // min-heap: (size, end)
    using P = std::pair<int,int>;
    std::priority_queue<P, std::vector<P>, std::greater<P>> heap;
    std::unordered_map<int,int> resMap;
    int i = 0;
    for (int q : sortedQ) {
        while (i < (int)intervals.size() && intervals[i][0] <= q) {
            int s = intervals[i][0], e = intervals[i][1];
            heap.push({e - s + 1, e});
            ++i;
        }
        while (!heap.empty() && heap.top().second < q) heap.pop();
        resMap[q] = heap.empty() ? -1 : heap.top().first;
    }
    std::vector<int> out;
    for (int q : queries) out.push_back(resMap[q]);
    return out;
}
```


### 137. Rotate Image

#### Problem
Given an `n x n` matrix, rotate it 90 degrees clockwise in-place without using extra space.

#### Examples

TODO

#### Recognition
**Transpose then reverse each row.** **O(n²)** time, **O(1)** space.

#### Explanation
A naive approach using a copy matrix is O(n²) space. The in-place trick decomposes the 90° clockwise rotation into two simple operations: (1) transpose — swap `matrix[i][j]` with `matrix[j][i]` for all `i < j`; (2) reverse each row horizontally. After transposing, element `(i, j)` sits at `(j, i)`, and reversing rows maps `(j, i)` to `(j, n-1-i)`, which is exactly the 90° clockwise destination of original `(i, j)`. Both steps are in-place and require only pair swaps. The loop bound `j in range(i+1, n)` avoids double-swapping the diagonal.

#### Python

Two-step rotation: transpose (swap across the diagonal) then reverse each row. `row.reverse()` is in-place. The `j in range(i + 1, n)` upper-triangle bound avoids double-swapping the diagonal.

```python
def rotate(matrix):
    n = len(matrix)
    for i in range(n):
        for j in range(i + 1, n):
            matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
    for row in matrix:
        row.reverse()
```

#### Java

Java's lack of tuple assignment means the transpose swap needs an explicit `tmp`; the row reversal is a plain two-pointer loop over each `int[]` row. Pure primitives, no imports needed.

```java
class Solution {
    public void rotate(int[][] matrix) {
        int n = matrix.length;
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                int tmp = matrix[i][j];
                matrix[i][j] = matrix[j][i];
                matrix[j][i] = tmp;
            }
        }
        for (int[] row : matrix) {
            for (int l = 0, r = n - 1; l < r; l++, r--) {
                int tmp = row[l];
                row[l] = row[r];
                row[r] = tmp;
            }
        }
    }
}
```

#### Rust

Explicit `tmp` temp — Rust can't index-swap two `matrix[i][j]` and `matrix[j][i]` via parallel assignment because both borrow `matrix`. `row.reverse()` for the row reversal.

```rust
fn rotate(matrix: &mut Vec<Vec<i32>>) {
    let n = matrix.len();
    for i in 0..n {
        for j in i + 1..n {
            let tmp = matrix[i][j];
            matrix[i][j] = matrix[j][i];
            matrix[j][i] = tmp;
        }
    }
    for row in matrix.iter_mut() {
        row.reverse();
    }
}
```

#### Go

Parallel assignment `matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]` — Go allows this swap. Manual two-pointer reverse on each row because `slices.Reverse` is post-1.21.

```go
func rotate(matrix [][]int) {
    n := len(matrix)
    for i := 0; i < n; i++ {
        for j := i + 1; j < n; j++ {
            matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
        }
    }
    for _, row := range matrix {
        for l, r := 0, len(row)-1; l < r; l, r = l+1, r-1 {
            row[l], row[r] = row[r], row[l]
        }
    }
}
```

#### C++

`std::swap(matrix[i][j], matrix[j][i])` for the transpose. `std::reverse(row.begin(), row.end())` for the row reversal.

```cpp
#include <vector>
#include <algorithm>

void rotate(std::vector<std::vector<int>>& matrix) {
    int n = (int)matrix.size();
    for (int i = 0; i < n; ++i)
        for (int j = i + 1; j < n; ++j)
            std::swap(matrix[i][j], matrix[j][i]);
    for (auto& row : matrix)
        std::reverse(row.begin(), row.end());
}
```


### 138. Spiral Matrix

#### Problem
Given an `m x n` matrix, return all elements in spiral order (right, down, left, up, repeat inward).

#### Examples

TODO

#### Recognition
**Shrinking boundary simulation.** **O(m·n)** time, **O(1)** extra space.

#### Explanation
Track four boundaries: `top`, `bottom`, `left`, `right`. Each iteration of the outer loop traverses one full ring: left-to-right on the top row, top-to-bottom on the right column, right-to-left on the bottom row (only if rows remain), bottom-to-top on the left column (only if columns remain). After each traversal, shrink the corresponding boundary inward. The inner guards (`if top <= bottom` and `if left <= right`) prevent double-counting the same row or column when the matrix has an odd number of rows or columns — otherwise a single remaining row would be traversed twice (once top-to-right, once bottom right-to-left).

#### Python

Slice `matrix[top][left:right+1]` for the top row in one shot; reverse slice `matrix[bottom][left:right+1][::-1]` for the bottom. Saves explicit indexed loops.

```python
def spiralOrder(matrix):
    res = []
    top, bottom = 0, len(matrix) - 1
    left, right = 0, len(matrix[0]) - 1
    while top <= bottom and left <= right:
        res += matrix[top][left:right+1]
        top += 1
        for r in range(top, bottom + 1):
            res.append(matrix[r][right])
        right -= 1
        if top <= bottom:
            res += matrix[bottom][left:right+1][::-1]
            bottom -= 1
        if left <= right:
            for r in range(bottom, top - 1, -1):
                res.append(matrix[r][left])
            left += 1
    return res
```

#### Java

No slice sugar, so all four ring traversals are explicit indexed loops. Returning an `ArrayList<Integer>` matches the LeetCode `List<Integer>` signature; the inner-guard checks are the correctness anchor.

```java
import java.util.*;

class Solution {
    public List<Integer> spiralOrder(int[][] matrix) {
        List<Integer> res = new ArrayList<>();
        int top = 0, bottom = matrix.length - 1;
        int left = 0, right = matrix[0].length - 1;
        while (top <= bottom && left <= right) {
            for (int c = left; c <= right; c++) res.add(matrix[top][c]);
            top++;
            for (int r = top; r <= bottom; r++) res.add(matrix[r][right]);
            right--;
            if (top <= bottom) {
                for (int c = right; c >= left; c--) res.add(matrix[bottom][c]);
                bottom--;
            }
            if (left <= right) {
                for (int r = bottom; r >= top; r--) res.add(matrix[r][left]);
                left++;
            }
        }
        return res;
    }
}
```

#### Rust

All four directions via explicit loops — Rust has no equivalent of Python's `[::-1]` slice-and-reverse for `Vec`. `(left..=right).rev()` for the right-to-left traversal.

```rust
fn spiral_order(matrix: Vec<Vec<i32>>) -> Vec<i32> {
    let mut res = Vec::new();
    let (mut top, mut bottom) = (0i32, matrix.len() as i32 - 1);
    let (mut left, mut right) = (0i32, matrix[0].len() as i32 - 1);
    while top <= bottom && left <= right {
        for c in left..=right { res.push(matrix[top as usize][c as usize]); }
        top += 1;
        for r in top..=bottom { res.push(matrix[r as usize][right as usize]); }
        right -= 1;
        if top <= bottom {
            for c in (left..=right).rev() { res.push(matrix[bottom as usize][c as usize]); }
            bottom -= 1;
        }
        if left <= right {
            for r in (top..=bottom).rev() { res.push(matrix[r as usize][left as usize]); }
            left += 1;
        }
    }
    res
}
```

#### Go

Four explicit indexed loops. `range` not used because the column-traversal needs decreasing direction.

```go
func spiralOrder(matrix [][]int) []int {
    res := []int{}
    top, bottom := 0, len(matrix)-1
    left, right := 0, len(matrix[0])-1
    for top <= bottom && left <= right {
        for c := left; c <= right; c++ { res = append(res, matrix[top][c]) }
        top++
        for r := top; r <= bottom; r++ { res = append(res, matrix[r][right]) }
        right--
        if top <= bottom {
            for c := right; c >= left; c-- { res = append(res, matrix[bottom][c]) }
            bottom--
        }
        if left <= right {
            for r := bottom; r >= top; r-- { res = append(res, matrix[r][left]) }
            left++
        }
    }
    return res
}
```

#### C++

Four explicit indexed loops; no slice operations. The inner-guard `if (top <= bottom)` / `if (left <= right)` checks are the language-independent correctness anchors.

```cpp
#include <vector>

std::vector<int> spiralOrder(std::vector<std::vector<int>>& matrix) {
    std::vector<int> res;
    int top = 0, bottom = (int)matrix.size() - 1;
    int left = 0, right = (int)matrix[0].size() - 1;
    while (top <= bottom && left <= right) {
        for (int c = left; c <= right; ++c) res.push_back(matrix[top][c]);
        ++top;
        for (int r = top; r <= bottom; ++r) res.push_back(matrix[r][right]);
        --right;
        if (top <= bottom) {
            for (int c = right; c >= left; --c) res.push_back(matrix[bottom][c]);
            --bottom;
        }
        if (left <= right) {
            for (int r = bottom; r >= top; --r) res.push_back(matrix[r][left]);
            ++left;
        }
    }
    return res;
}
```


### 139. Set Matrix Zeroes

#### Problem
Given an `m x n` matrix, if any element is 0, set its entire row and column to 0, in-place.

#### Examples

TODO

#### Recognition
**Use first row/column as markers.** **O(m·n)** time, **O(1)** space.

#### Explanation
A naive approach stores all zero positions in a set — O(m + n) space. The trick: repurpose `matrix[r][0]` and `matrix[0][c]` as markers for "row r should be zeroed" and "column c should be zeroed". But this collides on `matrix[0][0]`, so track the first row and first column separately with two booleans before any marking. Then scan the interior (rows/cols 1+) to mark. Then zero the interior based on markers. Finally, zero the first row and column if their original booleans were set. The order matters: mark before zeroing, and handle the first row/col last to avoid using a zeroed marker prematurely.

#### Python

`any(... for c in range(cols))` generator + first-row/col flags. The interior is processed first; first row and col are zeroed last to avoid using stale markers.

```python
def setZeroes(matrix):
    rows, cols = len(matrix), len(matrix[0])
    first_row = any(matrix[0][c] == 0 for c in range(cols))
    first_col = any(matrix[r][0] == 0 for r in range(rows))
    for r in range(1, rows):
        for c in range(1, cols):
            if matrix[r][c] == 0:
                matrix[r][0] = matrix[0][c] = 0
    for r in range(1, rows):
        for c in range(1, cols):
            if matrix[r][0] == 0 or matrix[0][c] == 0:
                matrix[r][c] = 0
    if first_row:
        for c in range(cols):
            matrix[0][c] = 0
    if first_col:
        for r in range(rows):
            matrix[r][0] = 0
```

#### Java

Two linear scans set the first-row/col flags; the rest is primitive `int[][]` indexing. The three-phase order (flags then interior mark then interior zero then first row/col) is the correctness anchor — no collections needed.

```java
class Solution {
    public void setZeroes(int[][] matrix) {
        int rows = matrix.length, cols = matrix[0].length;
        boolean firstRow = false, firstCol = false;
        for (int c = 0; c < cols; c++) if (matrix[0][c] == 0) firstRow = true;
        for (int r = 0; r < rows; r++) if (matrix[r][0] == 0) firstCol = true;
        for (int r = 1; r < rows; r++)
            for (int c = 1; c < cols; c++)
                if (matrix[r][c] == 0) { matrix[r][0] = 0; matrix[0][c] = 0; }
        for (int r = 1; r < rows; r++)
            for (int c = 1; c < cols; c++)
                if (matrix[r][0] == 0 || matrix[0][c] == 0) matrix[r][c] = 0;
        if (firstRow) for (int c = 0; c < cols; c++) matrix[0][c] = 0;
        if (firstCol) for (int r = 0; r < rows; r++) matrix[r][0] = 0;
    }
}
```

#### Rust

`(0..cols).any(|c| matrix[0][c] == 0)` — closure-based any. Same first-row/col-flag pattern; explicit `for` loops for the zeroing phases.

```rust
fn set_zeroes(matrix: &mut Vec<Vec<i32>>) {
    let rows = matrix.len();
    let cols = matrix[0].len();
    let first_row = (0..cols).any(|c| matrix[0][c] == 0);
    let first_col = (0..rows).any(|r| matrix[r][0] == 0);
    for r in 1..rows {
        for c in 1..cols {
            if matrix[r][c] == 0 {
                matrix[r][0] = 0;
                matrix[0][c] = 0;
            }
        }
    }
    for r in 1..rows {
        for c in 1..cols {
            if matrix[r][0] == 0 || matrix[0][c] == 0 {
                matrix[r][c] = 0;
            }
        }
    }
    if first_row { for c in 0..cols { matrix[0][c] = 0; } }
    if first_col { for r in 0..rows { matrix[r][0] = 0; } }
}
```

#### Go

Two explicit linear scans for the first-row/col flags. Pre-1.21 has no `slices.Contains` or `Any` — manual is unavoidable.

```go
func setZeroes(matrix [][]int) {
    rows, cols := len(matrix), len(matrix[0])
    firstRow, firstCol := false, false
    for c := 0; c < cols; c++ { if matrix[0][c] == 0 { firstRow = true } }
    for r := 0; r < rows; r++ { if matrix[r][0] == 0 { firstCol = true } }
    for r := 1; r < rows; r++ {
        for c := 1; c < cols; c++ {
            if matrix[r][c] == 0 { matrix[r][0] = 0; matrix[0][c] = 0 }
        }
    }
    for r := 1; r < rows; r++ {
        for c := 1; c < cols; c++ {
            if matrix[r][0] == 0 || matrix[0][c] == 0 { matrix[r][c] = 0 }
        }
    }
    if firstRow { for c := 0; c < cols; c++ { matrix[0][c] = 0 } }
    if firstCol { for r := 0; r < rows; r++ { matrix[r][0] = 0 } }
}
```

#### C++

Linear scans for the flags. The three-phase order (flags → interior mark → interior zero → first row/col zero) is the language-independent correctness anchor.

```cpp
#include <vector>

void setZeroes(std::vector<std::vector<int>>& matrix) {
    int rows = (int)matrix.size(), cols = (int)matrix[0].size();
    bool firstRow = false, firstCol = false;
    for (int c = 0; c < cols; ++c) if (matrix[0][c] == 0) firstRow = true;
    for (int r = 0; r < rows; ++r) if (matrix[r][0] == 0) firstCol = true;
    for (int r = 1; r < rows; ++r)
        for (int c = 1; c < cols; ++c)
            if (matrix[r][c] == 0) { matrix[r][0] = 0; matrix[0][c] = 0; }
    for (int r = 1; r < rows; ++r)
        for (int c = 1; c < cols; ++c)
            if (matrix[r][0] == 0 || matrix[0][c] == 0) matrix[r][c] = 0;
    if (firstRow) for (int c = 0; c < cols; ++c) matrix[0][c] = 0;
    if (firstCol) for (int r = 0; r < rows; ++r) matrix[r][0] = 0;
}
```


### 140. Happy Number

#### Problem
A number is "happy" if repeatedly replacing it with the sum of squares of its digits eventually reaches 1. Return whether `n` is happy.

#### Examples

TODO

#### Recognition
**Floyd's cycle detection (fast/slow pointers).** **O(log n)** time per step, **O(1)** space.

#### Explanation
If `n` is not happy, the digit-square sequence enters a cycle (it's proven to always include 4). A hashset approach detects the cycle but uses O(k) space for cycle length `k`. Floyd's algorithm avoids that: run a slow pointer one step at a time and a fast pointer two steps at a time. If they meet and `fast != 1`, a cycle was detected (unhappy). If `fast == 1`, the number is happy. The `next_n` function converts to string to cleanly iterate digits — simple and correct. In practice the cycle is short, so this terminates quickly.

#### Python

`sum(int(d) ** 2 for d in str(x))` — string conversion + comprehension for digit-square sum. Floyd's slow/fast eliminates the O(k) cycle-set.

```python
def isHappy(n):
    def next_n(x):
        return sum(int(d) ** 2 for d in str(x))
    slow, fast = n, next_n(n)
    while fast != 1 and slow != fast:
        slow = next_n(slow)
        fast = next_n(next_n(fast))
    return fast == 1
```

#### Java

A private helper does the integer-arithmetic digit-square sum (`x % 10`, `x /= 10`) — faster than string conversion in a tight loop. Floyd's slow/fast keeps it O(1) space with no `HashSet`.

```java
class Solution {
    public boolean isHappy(int n) {
        int slow = n, fast = nextN(n);
        while (fast != 1 && slow != fast) {
            slow = nextN(slow);
            fast = nextN(nextN(fast));
        }
        return fast == 1;
    }

    private int nextN(int x) {
        int s = 0;
        while (x > 0) {
            int d = x % 10;
            s += d * d;
            x /= 10;
        }
        return s;
    }
}
```

#### Rust

Pure integer arithmetic for `next_n` — `x % 10` and `x /= 10` extracts digits. Faster than string conversion for tight loops.

```rust
fn is_happy(n: i32) -> bool {
    fn next_n(mut x: i32) -> i32 {
        let mut s = 0;
        while x > 0 {
            let d = x % 10;
            s += d * d;
            x /= 10;
        }
        s
    }
    let mut slow = n;
    let mut fast = next_n(n);
    while fast != 1 && slow != fast {
        slow = next_n(slow);
        fast = next_n(next_n(fast));
    }
    fast == 1
}
```

#### Go

Same integer-arithmetic `nextN`. Closure captures nothing — just for scoping.

```go
func isHappy(n int) bool {
    nextN := func(x int) int {
        s := 0
        for x > 0 {
            d := x % 10
            s += d * d
            x /= 10
        }
        return s
    }
    slow, fast := n, nextN(n)
    for fast != 1 && slow != fast {
        slow = nextN(slow)
        fast = nextN(nextN(fast))
    }
    return fast == 1
}
```

#### C++

Lambda `nextN` with `auto` parameter inference (C++14+). Same integer-arithmetic digit extraction.

```cpp
#include <functional>

bool isHappy(int n) {
    auto nextN = [](int x) {
        int s = 0;
        while (x > 0) { int d = x % 10; s += d * d; x /= 10; }
        return s;
    };
    int slow = n, fast = nextN(n);
    while (fast != 1 && slow != fast) {
        slow = nextN(slow);
        fast = nextN(nextN(fast));
    }
    return fast == 1;
}
```


### 141. Plus One

#### Problem
Given a non-negative integer represented as an array of its digits (most significant first), increment it by one and return the resulting array.

#### Examples

TODO

#### Recognition
**Carry propagation from least-significant digit.** **O(n)** time, **O(1)** extra space.

#### Explanation
Iterate from the least significant digit (rightmost) toward the most significant. If the current digit is less than 9, simply increment it and return — no carry propagates. If it is 9, set it to 0 (carries over) and continue left. The only case requiring an extra digit is an all-9 number (e.g., `[9,9,9]` → `[1,0,0,0]`): after the loop exits all digits are 0, so prepend a 1. This is equivalent to grade-school addition but without needing to handle general multi-digit addends.

#### Python

Early return as soon as you hit a non-9 — most inputs exit on the first iteration. `[1] + digits` prepends only when every digit was 9.

```python
def plusOne(digits):
    for i in range(len(digits) - 1, -1, -1):
        if digits[i] < 9:
            digits[i] += 1
            return digits
        digits[i] = 0
    return [1] + digits
```

#### Java

The typical case mutates one digit and returns the input array. Only the all-9s case allocates: a fresh `int[n+1]` whose leading 1 is already the default `0`-initialized array with `res[0] = 1`.

```java
class Solution {
    public int[] plusOne(int[] digits) {
        for (int i = digits.length - 1; i >= 0; i--) {
            if (digits[i] < 9) {
                digits[i]++;
                return digits;
            }
            digits[i] = 0;
        }
        int[] res = new int[digits.length + 1];
        res[0] = 1;
        return res;
    }
}
```

#### Rust

`digits.insert(0, 1)` is O(n) but only happens in the all-9s case. Early return on first non-9 keeps the typical case at O(1) modifications.

```rust
fn plus_one(mut digits: Vec<i32>) -> Vec<i32> {
    for i in (0..digits.len()).rev() {
        if digits[i] < 9 {
            digits[i] += 1;
            return digits;
        }
        digits[i] = 0;
    }
    digits.insert(0, 1);
    digits
}
```

#### Go

`append([]int{1}, digits...)` — the standard 'prepend to slice' idiom, allocating a new backing array.

```go
func plusOne(digits []int) []int {
    for i := len(digits) - 1; i >= 0; i-- {
        if digits[i] < 9 {
            digits[i]++
            return digits
        }
        digits[i] = 0
    }
    return append([]int{1}, digits...)
}
```

#### C++

`digits.insert(digits.begin(), 1)` is O(n) — `std::vector` doesn't have an O(1) push_front. Rare hit case so acceptable.

```cpp
#include <vector>

std::vector<int> plusOne(std::vector<int>& digits) {
    for (int i = (int)digits.size() - 1; i >= 0; --i) {
        if (digits[i] < 9) { ++digits[i]; return digits; }
        digits[i] = 0;
    }
    digits.insert(digits.begin(), 1);
    return digits;
}
```


### 142. Pow(x, n)

#### Problem
Implement `pow(x, n)` — compute `x` raised to the power `n`, where `n` can be negative.

#### Examples

```text
Input: x = 2.00000, n = 10
Output: 1024.00000
Explanation: 2^10 == 1024.

Input: x = 2.00000, n = -2
Output: 0.25000
Explanation: 2^-2 == 1 / 2^2 == 1 / 4.

Input: x = -2.00000, n = 0
Output: 1.00000

Constraints:
- -100.0 < x < 100.0
- -2^31 <= n <= 2^31 - 1
- -10^4 <= x^n <= 10^4
```

#### Recognition
**Signals.** `n` is a *value*, not a length, and it runs to `2^31 - 1`. That single fact reclassifies the problem: a loop that multiplies `n` times is about two billion multiplications, so anything linear in the magnitude of the input is out and `O(log n)` is the target. "Where `n` can be negative" is the second, smaller signal, flagging a normalisation step rather than a different algorithm. **Therefore.** Binary exponentiation off the identity `x^n = (x^(n/2))^2`, times one leftover `x` when `n` is odd. Walk the bits of `n`: fold the running base into the result when the low bit is set, then square the base and shift right. **Not recursion** on `myPow(x, n // 2)`, which reaches the same `O(log n)` but spends `O(log n)` stack frames and gives the `n = -2^31` negation a second place to overflow in fixed-width languages. **Not a library `pow`**, which answers the question rather than the exercise. **O(log n)** time, **O(1)** space.

#### Explanation
**Brute force.** Multiply `x` by itself `n` times.

```python
def myPow(x, n):
    if n < 0:
        x, n = 1 / x, -n
    res = 1.0
    for _ in range(n):
        res *= x
    return res
```

`O(n)` time, `O(1)` space.

**Wasteful because.** Reaching `x^10` costs ten multiplications here, but `x^10` is `(x^5)^2` and `x^5` is `(x^2)^2 * x`. Every intermediate `x^k` the loop builds is discarded rather than squared, so the halving structure sitting inside the exponent gets paid for one unit at a time.

**Optimal.** Square the base instead of accumulating it. Hold a base equal to `x^(2^k)` at step `k`, and a result that collects exactly the powers whose bits are set in `n`, which is valid because `n` in binary *is* a sum of distinct powers of two. Each round tests the low bit, folds the base into the result when it is set, squares the base, and shifts `n` right, so the loop runs once per bit: 31 iterations rather than two billion. A negative `n` is normalised up front by replacing `x` with `1 / x` and flipping the sign, which changes the inputs and not the loop.

**Edge cases.** `n = 0` returns 1 for every `x`. `n = -2^31` cannot be negated inside a 32-bit int, so Java, Rust and C++ widen to 64 bits before flipping the sign; Python's arbitrary-precision ints make the step invisible. Repeated squaring can overflow to infinity or collapse to zero for bases far from 1, which the stated bound `-10^4 <= x^n <= 10^4` exists to keep out.

#### Python

Arbitrary-precision int means `-n` after `n = INT_MIN` works without overflow concern. `n % 2` and `n //= 2` are the bit operations expressed arithmetically.

```python
def myPow(x, n):
    if n < 0:
        x, n = 1 / x, -n
    res = 1
    while n:
        if n % 2:
            res *= x
        x *= x
        n //= 2
    return res
```

#### Java

Widen `n` to a `long` before negating so `n == Integer.MIN_VALUE` doesn't overflow when flipped. Bit ops (`m & 1`, `m >>= 1`) run on the widened value.

```java
class Solution {
    public double myPow(double x, int n) {
        long m = n;
        if (m < 0) { x = 1.0 / x; m = -m; }
        double res = 1.0;
        while (m > 0) {
            if ((m & 1) == 1) res *= x;
            x *= x;
            m >>= 1;
        }
        return res;
    }
}
```

#### Rust

Cast through `i64` then to `u64` defends against `INT_MIN` negation overflow. Bit ops (`m & 1`, `m >>= 1`) are unsigned-safe.

```rust
fn my_pow(mut x: f64, mut n: i32) -> f64 {
    if n < 0 {
        x = 1.0 / x;
        // handle INT_MIN safely
        let mut res = 1.0f64;
        let mut m = -(n as i64) as u64;
        while m > 0 {
            if m & 1 == 1 { res *= x; }
            x *= x;
            m >>= 1;
        }
        return res;
    }
    let mut res = 1.0f64;
    let mut m = n as u64;
    while m > 0 {
        if m & 1 == 1 { res *= x; }
        x *= x;
        m >>= 1;
    }
    res
}
```

#### Go

Go's `int` is 64-bit on most platforms — `-n` doesn't overflow even at the LeetCode int32 input range. Plain arithmetic, no casting.

```go
func myPow(x float64, n int) float64 {
    if n < 0 {
        x = 1 / x
        n = -n
    }
    res := 1.0
    for n > 0 {
        if n%2 == 1 {
            res *= x
        }
        x *= x
        n /= 2
    }
    return res
}
```

#### C++

Cast to `long long m = n` first so `-m` doesn't overflow when `n == INT_MIN`. Bit ops use unsigned-safe shifts on the widened type.

```cpp
#include <cstdint>

double myPow(double x, int n) {
    long long m = n;
    if (m < 0) { x = 1.0 / x; m = -m; }
    double res = 1.0;
    while (m > 0) {
        if (m & 1) res *= x;
        x *= x;
        m >>= 1;
    }
    return res;
}
```


### 143. Multiply Strings

#### Problem
Given two non-negative integers as strings `num1` and `num2`, return their product as a string without converting them to integers directly.

#### Examples

TODO

#### Recognition
**Grade-school multiplication with position arithmetic.** **O(m·n)** time, **O(m + n)** space.

#### Explanation
Digit `num1[i]` and `num2[j]` contribute to positions `i+j` (tens carry) and `i+j+1` (units) in the result array (both indices from the left, with the result array of length `m+n`). Process digits right-to-left for both numbers. At each pair, multiply the digits, add to `res[p2]`, then propagate the carry to `res[p1]`. This is exactly what you do by hand. At the end, strip leading zeros and convert. The early-exit for "0" avoids leading-zero issues in the output (`lstrip("0")` on an empty product would return `""` instead of `"0"`).

#### Python

`if "0" in [num1, num2]` is the early-exit for the leading-zero pitfall — `lstrip("0")` of "000" would return "" instead of "0". `int(num1[i])` converts each char to int.

```python
def multiply(num1, num2):
    if "0" in [num1, num2]:
        return "0"
    res = [0] * (len(num1) + len(num2))
    for i in range(len(num1) - 1, -1, -1):
        for j in range(len(num2) - 1, -1, -1):
            mul = int(num1[i]) * int(num2[j])
            p1, p2 = i + j, i + j + 1
            total = mul + res[p2]
            res[p2] = total % 10
            res[p1] += total // 10
    return "".join(map(str, res)).lstrip("0")
```

#### Java

`charAt(i) - '0'` converts each digit char to its value. A `StringBuilder` composes the result, and stripping leading zeros is a manual index scan — cheaper than allocating a substring via regex.

```java
class Solution {
    public String multiply(String num1, String num2) {
        if (num1.equals("0") || num2.equals("0")) return "0";
        int m = num1.length(), n = num2.length();
        int[] res = new int[m + n];
        for (int i = m - 1; i >= 0; i--) {
            for (int j = n - 1; j >= 0; j--) {
                int mul = (num1.charAt(i) - '0') * (num2.charAt(j) - '0');
                int total = mul + res[i + j + 1];
                res[i + j + 1] = total % 10;
                res[i + j] += total / 10;
            }
        }
        StringBuilder sb = new StringBuilder();
        int start = 0;
        while (start < res.length && res[start] == 0) start++;
        for (int k = start; k < res.length; k++) sb.append((char) ('0' + res[k]));
        return sb.toString();
    }
}
```

#### Rust

Pre-convert each string to `Vec<u32>` of digit values via `(b - b'0') as u32` — saves repeated byte arithmetic in the inner loop. `char::from_digit` for the result formatting.

```rust
fn multiply(num1: String, num2: String) -> String {
    if num1 == "0" || num2 == "0" { return "0".to_string(); }
    let n1: Vec<u32> = num1.bytes().map(|b| (b - b'0') as u32).collect();
    let n2: Vec<u32> = num2.bytes().map(|b| (b - b'0') as u32).collect();
    let m = n1.len(); let n = n2.len();
    let mut res = vec![0u32; m + n];
    for i in (0..m).rev() {
        for j in (0..n).rev() {
            let mul = n1[i] * n2[j];
            let p2 = i + j + 1;
            let total = mul + res[p2];
            res[p2] = total % 10;
            res[i + j] += total / 10;
        }
    }
    let s: String = res.iter().map(|d| char::from_digit(*d, 10).unwrap()).collect();
    s.trim_start_matches('0').to_string()
}
```

#### Go

`strings.Builder` for the result composition. `byte('0' + d)` to convert digit back to ASCII char. `strings.TrimLeft` for the leading-zero strip.

```go
import "strings"

func multiply(num1 string, num2 string) string {
    if num1 == "0" || num2 == "0" { return "0" }
    m, n := len(num1), len(num2)
    res := make([]int, m+n)
    for i := m - 1; i >= 0; i-- {
        for j := n - 1; j >= 0; j-- {
            mul := int(num1[i]-'0') * int(num2[j]-'0')
            p2 := i + j + 1
            total := mul + res[p2]
            res[p2] = total % 10
            res[i+j] += total / 10
        }
    }
    sb := strings.Builder{}
    for _, d := range res { sb.WriteByte(byte('0' + d)) }
    return strings.TrimLeft(sb.String(), "0")
}
```

#### C++

`s.find_first_not_of('0')` returns the first non-zero index; `npos` means the entire string was zeros. The substr from that index strips leading zeros.

```cpp
#include <string>
#include <vector>
#include <algorithm>

std::string multiply(std::string num1, std::string num2) {
    if (num1 == "0" || num2 == "0") return "0";
    int m = (int)num1.size(), n = (int)num2.size();
    std::vector<int> res(m + n, 0);
    for (int i = m - 1; i >= 0; --i) {
        for (int j = n - 1; j >= 0; --j) {
            int mul = (num1[i] - '0') * (num2[j] - '0');
            int total = mul + res[i + j + 1];
            res[i + j + 1] = total % 10;
            res[i + j] += total / 10;
        }
    }
    std::string s;
    for (int d : res) s += char('0' + d);
    auto start = s.find_first_not_of('0');
    return start == std::string::npos ? "0" : s.substr(start);
}
```


### 144. Detect Squares

#### Problem
Design a data structure supporting `add(point)` and `count(point)` — the latter returns the number of ways to form an axis-aligned square using the query point as one corner and three previously added points.

#### Examples

TODO

#### Recognition
**Count map + enumerate diagonal partners.** **O(1)** add, **O(n)** count per query, **O(n)** space.

#### Explanation
An axis-aligned square is fully determined by any diagonal pair of its corners. Fix the query point `(px, py)` as one corner. For every other point `(x, y)` in the set, check if it forms a valid diagonal with `(px, py)`: the distances along both axes must be equal and non-zero (`abs(py - y) == abs(px - x)` and `x != px`). If so, the other two corners are `(x, py)` and `(px, y)` — multiply their counts (duplicate points can independently contribute). Iterating over a deduplicated point set keeps the count loop at O(distinct points). Storing separate `pt_counts` and `pts` set makes it easy to handle duplicate additions.

#### Python

`tuple(point)` because lists aren't hashable. Iterating `self.pts` (unique points) keeps the count loop O(distinct points) — not O(adds).

```python
class DetectSquares:
    def __init__(self):
        self.pt_counts = {}
        self.pts = set()

    def add(self, point):
        p = tuple(point)
        self.pt_counts[p] = self.pt_counts.get(p, 0) + 1
        self.pts.add(p)

    def count(self, point):
        px, py = point
        res = 0
        for x, y in self.pts:
            if abs(py - y) != abs(px - x) or x == px:
                continue
            res += self.pt_counts.get((x, py), 0) * self.pt_counts.get((px, y), 0)
        return res
```

#### Java

A design problem, so write the named `DetectSquares` class. A `HashMap<Long,Integer>` keyed by a packed `(x<<20)|y` long counts duplicates and doubles as the distinct-point set (iterate `keySet()`), avoiding a separate collection.

```java
import java.util.*;

class DetectSquares {
    private final Map<Long, Integer> ptCounts = new HashMap<>();

    public DetectSquares() {}

    public void add(int[] point) {
        long key = encode(point[0], point[1]);
        ptCounts.merge(key, 1, Integer::sum);
    }

    public int count(int[] point) {
        int px = point[0], py = point[1], res = 0;
        for (long key : ptCounts.keySet()) {
            int x = (int) (key >> 20), y = (int) (key & 0xFFFFF);
            if (Math.abs(py - y) != Math.abs(px - x) || x == px) continue;
            int c1 = ptCounts.getOrDefault(encode(x, py), 0);
            int c2 = ptCounts.getOrDefault(encode(px, y), 0);
            res += ptCounts.get(key) * c1 * c2;
        }
        return res;
    }

    private long encode(int x, int y) {
        return ((long) x << 20) | y;
    }
}
```

#### Rust

`HashSet<(i32, i32)>` for distinct points; tuples are `Hash` automatically. The `*self.pt_counts.get(&...).unwrap_or(&0)` dereferences-or-default pattern.

```rust
use std::collections::{HashMap, HashSet};

struct DetectSquares {
    pt_counts: HashMap<(i32, i32), i32>,
    pts: HashSet<(i32, i32)>,
}

impl DetectSquares {
    fn new() -> Self {
        Self { pt_counts: HashMap::new(), pts: HashSet::new() }
    }
    fn add(&mut self, point: Vec<i32>) {
        let p = (point[0], point[1]);
        *self.pt_counts.entry(p).or_insert(0) += 1;
        self.pts.insert(p);
    }
    fn count(&self, point: Vec<i32>) -> i32 {
        let (px, py) = (point[0], point[1]);
        let mut res = 0;
        for &(x, y) in &self.pts {
            if (py - y).abs() != (px - x).abs() || x == px { continue; }
            let c1 = *self.pt_counts.get(&(x, py)).unwrap_or(&0);
            let c2 = *self.pt_counts.get(&(px, y)).unwrap_or(&0);
            res += c1 * c2;
        }
        res
    }
}
```

#### Go

`[2]int` arrays as map keys — Go requires comparable types, arrays qualify (slices don't). Manual abs because pre-1.21 has no `int` `Abs`.

```go
type DetectSquares struct {
    ptCounts map[[2]int]int
    pts      map[[2]int]bool
}

func Constructor() DetectSquares {
    return DetectSquares{ptCounts: map[[2]int]int{}, pts: map[[2]int]bool{}}
}

func (ds *DetectSquares) Add(point []int) {
    p := [2]int{point[0], point[1]}
    ds.ptCounts[p]++
    ds.pts[p] = true
}

func (ds *DetectSquares) Count(point []int) int {
    px, py := point[0], point[1]
    res := 0
    for p := range ds.pts {
        x, y := p[0], p[1]
        dx, dy := px-x, py-y
        if dx < 0 { dx = -dx }
        if dy < 0 { dy = -dy }
        if dx != dy || x == px { continue }
        res += ds.ptCounts[[2]int{x, py}] * ds.ptCounts[[2]int{px, y}]
    }
    return res
}
```

#### C++

Custom `PairHash` for `unordered_map<pair<int,int>, ..., PairHash>` — pair isn't hashable by default in C++. The hash combines two `int`s into a `long long` for the underlying hash.

```cpp
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <cmath>
#include <string>

struct PairHash {
    size_t operator()(std::pair<int,int> p) const {
        return std::hash<long long>()((long long)p.first << 32 | (unsigned)p.second);
    }
};

class DetectSquares {
    std::unordered_map<std::pair<int,int>, int, PairHash> ptCounts;
    std::unordered_set<std::pair<int,int>, PairHash> pts;
public:
    void add(std::vector<int> point) {
        auto p = std::make_pair(point[0], point[1]);
        ptCounts[p]++;
        pts.insert(p);
    }
    int count(std::vector<int> point) {
        int px = point[0], py = point[1], res = 0;
        for (auto& [x, y] : pts) {
            if (std::abs(py - y) != std::abs(px - x) || x == px) continue;
            auto it1 = ptCounts.find({x, py}), it2 = ptCounts.find({px, y});
            int c1 = it1 != ptCounts.end() ? it1->second : 0;
            int c2 = it2 != ptCounts.end() ? it2->second : 0;
            res += c1 * c2;
        }
        return res;
    }
};
```


### 145. Single Number

#### Problem
Given an array where every element appears exactly twice except one, find that single element. Must run in O(n) time and O(1) space.

#### Examples

```text
Input: nums = [2,2,1]
Output: 1

Input: nums = [4,1,2,1,2]
Output: 4

Input: nums = [1]
Output: 1

Constraints:
- 1 <= nums.length <= 3 * 10^4
- -3 * 10^4 <= nums[i] <= 3 * 10^4
- every element appears twice except one, which appears once
```

#### Recognition
**Signals.** "Every element appears exactly twice except one" states the multiplicity rule outright, and the problem then demands `O(n)` time *and* `O(1)` space. Those two clauses together are the whole puzzle: linear time on its own is easy, but constant space alongside it rules out a hash set, a counter, and the scratch space of a sort. When the structure is pairing and the answer has to survive in one accumulator, reach for an involution, an operation that undoes itself. **Therefore.** Fold XOR across the array. `a ^ a == 0` and `a ^ 0 == a`, and XOR is commutative and associative, so each pair cancels no matter how far apart its two copies sit, leaving the lone value. **Not a hash set** toggled on each value, which is honestly `O(n)` time and arguably clearer, but costs `O(n)` space and so breaks the constraint the problem went out of its way to state. **Not sorting** and scanning for the element without a neighbour, which is `O(n log n)`. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Tally every value, then return the one seen once.

```python
def singleNumber(nums):
    counts = {}
    for n in nums:
        counts[n] = counts.get(n, 0) + 1
    for value, c in counts.items():
        if c == 1:
            return value
```

`O(n)` time, `O(n)` space.

**Wasteful because.** This one is not slow, it is fat, and space is the constraint it breaks. It builds and stores an exact tally for all `n / 2` paired values and then reads none of them: every count but one is computed and discarded. It also needs two passes where the information could have been folded during the first.

**Optimal.** Replace the tally with an accumulator that forgets pairs on its own. XOR is its own inverse, so `x ^ x` erases `x` from the running value the instant the second copy arrives, and because XOR is commutative and associative there is no bookkeeping to match copies up. Start at 0, XOR everything in, and the bits still set are exactly those set an odd number of times, which is the singleton. Note how tightly this is bound to the stated multiplicity: if elements repeated three times instead of twice XOR would cancel nothing, and you would count each of the 32 bit positions modulo 3 instead.

**Edge cases.** A one-element array returns that element, since `0 ^ x == x`. Negative values need no special handling because XOR works on the two's-complement bit pattern, not the magnitude. A zero in the input is not special either: it pairs and cancels like any other value.

#### Python

Three-line `for / res ^= n / return`. XOR's self-cancelling property does all the work.

```python
def singleNumber(nums):
    res = 0
    for n in nums:
        res ^= n
    return res
```

#### Java

A plain accumulating XOR loop — the canonical, clearest form. No import needed since it's pure primitives; XOR's self-cancelling property does all the work.

```java
class Solution {
    public int singleNumber(int[] nums) {
        int res = 0;
        for (int n : nums) res ^= n;
        return res;
    }
}
```

#### Rust

`nums.iter().fold(0, |acc, &n| acc ^ n)` — fold with XOR is the canonical reduce pattern, one line.

```rust
fn single_number(nums: Vec<i32>) -> i32 {
    nums.iter().fold(0, |acc, &n| acc ^ n)
}
```

#### Go

Plain accumulating loop — Go has no `Reduce` or `fold` in the stdlib (pre-1.21 even with generics).

```go
func singleNumber(nums []int) int {
    res := 0
    for _, n := range nums {
        res ^= n
    }
    return res
}
```

#### C++

`std::reduce` / `std::accumulate` with bit-xor lambda would also work, but the plain loop is the canonical form for clarity.

```cpp
#include <vector>

int singleNumber(std::vector<int>& nums) {
    int res = 0;
    for (int n : nums) res ^= n;
    return res;
}
```


### 146. Number of 1 Bits

#### Problem
Return the number of `1` bits (Hamming weight) in the binary representation of an unsigned 32-bit integer.

#### Examples

TODO

#### Recognition
**Bit manipulation — Brian Kernighan's trick.** **O(k)** time where k = number of set bits, **O(1)** space.

#### Explanation
A naive approach tests each of the 32 bits individually — always 32 iterations. Brian Kernighan's trick is faster: `n & (n - 1)` clears the lowest set bit of `n` in one operation. Why? Subtracting 1 flips the lowest set bit to 0 and all bits below it to 1; ANDing with the original clears those bits. Incrementing a counter each iteration counts exactly as many set bits as there are. The loop runs only `k` times (number of set bits), which is at most 32. For sparse bit patterns this is meaningfully faster, and it reads more clearly than masking each bit individually.

#### Python

Brian Kernighan's `n &= n - 1` clears the lowest set bit per iteration — runs `k` times where `k` is the popcount. Faster than checking every bit when input is sparse.

```python
def hammingWeight(n):
    res = 0
    while n:
        n &= n - 1
        res += 1
    return res
```

#### Java

`Integer.bitCount(n)` is the standard-library popcount, compiled to a single `POPCNT` instruction on modern CPUs — the cleanest option. (Brian Kernighan's `n &= n - 1` loop is the manual alternative.)

```java
class Solution {
    public int hammingWeight(int n) {
        return Integer.bitCount(n);
    }
}
```

#### Rust

`n.count_ones()` is the standard library popcount — single instruction on modern hardware. Cleanest of the four.

```rust
fn hamming_weight(n: u32) -> i32 {
    n.count_ones() as i32
}
```

#### Go

`bits.OnesCount32(n)` from `math/bits` — same single-instruction popcount.

```go
import "math/bits"

func hammingWeight(n uint32) int {
    return bits.OnesCount32(n)
}
```

#### C++

`__builtin_popcount` is the GCC/Clang intrinsic; `std::popcount` from `<bit>` is the C++20 portable equivalent.

```cpp
#include <cstdint>
#include <bit>

int hammingWeight(uint32_t n) {
    return __builtin_popcount(n);
}
```


### 147. Counting Bits

#### Problem
Given `n`, return an array `ans` of length `n + 1` where `ans[i]` is the number of `1` bits in `i`.

#### Examples

```text
Input: n = 2
Output: [0,1,1]
Explanation: 0 is 0b0, 1 is 0b1, 2 is 0b10.

Input: n = 5
Output: [0,1,1,2,1,2]

Input: n = 0
Output: [0]

Constraints:
- 0 <= n <= 10^5
- the answer has length n + 1
- ans[i] is the number of set bits in i
```

#### Recognition
**Signals.** "For every `i` in `0..n`" turns a per-number trick into a *sequence*, and `n` reaches `10^5`. The question stops being how to popcount one integer and becomes how to avoid paying full price `n` times. Whenever an answer is wanted for every prefix of the naturals, ask what `i` shares with a smaller index: `i >> 1` is `i` with its lowest bit removed, it is strictly smaller, so it is already solved. **Therefore.** Fill a table with `dp[i] = dp[i >> 1] + (i & 1)`, one array pass, one shift and one mask per entry. **Not a builtin popcount** in a loop, such as `bin(i).count('1')` or `Integer.bitCount(i)`, which costs `O(n log n)` bit-level work and, more to the point, sidesteps the reuse the problem is testing. **Not a precomputed nibble table**, the classic constant-factor trick, which is strictly more code for the same `O(n)`. **O(n)** time, **O(n)** space.

#### Explanation
**Brute force.** Popcount each number independently.

```python
def countBits(n):
    ans = []
    for i in range(n + 1):
        bits = 0
        x = i
        while x:
            bits += x & 1
            x >>= 1
        ans.append(bits)
    return ans
```

`O(n log n)` time, `O(n)` space for the output.

**Wasteful because.** Counting the bits of `i` walks the whole number, but everything above `i`'s last bit is itself a smaller index whose answer already sits in the array. For `i` near `10^5` that is 17 shifts, 16 of which redo work finished earlier in the same loop.

**Optimal.** Turn the popcount into a one-step recurrence over the table being built. Dropping the lowest bit gives `i >> 1`, strictly less than `i` and therefore already filled, so `dp[i] = dp[i >> 1] + (i & 1)`: take the answer for the shorter number and add back the bit you removed. The base case `dp[0] = 0` is free in any language that zero-initialises. The alternative recurrence `dp[i] = dp[i & (i - 1)] + 1` clears the *lowest set* bit instead of the last bit and is equally `O(n)`; prefer it when you also want the identity behind Kernighan's popcount, and prefer the shift form when you want the dependency to be a plain halving.

**Edge cases.** `n = 0` must return `[0]`, a one-element array rather than an empty one. The table has length `n + 1`, an off-by-one easy to miss in both directions. Odd `i` always lands on `dp[i >> 1] + 1`, powers of two always on 1.

#### Python

Recurrence `dp[i] = dp[i >> 1] + (i & 1)` — the bit-shift trick gives O(n) total work, beats per-element popcount.

```python
def countBits(n):
    dp = [0] * (n + 1)
    for i in range(1, n + 1):
        dp[i] = dp[i >> 1] + (i & 1)
    return dp
```

#### Java

The recurrence `dp[i] = dp[i >> 1] + (i & 1)` fills a primitive `int[]` in one O(n) pass; Java's arrays are zero-initialized so the base case `dp[0] = 0` is free.

```java
class Solution {
    public int[] countBits(int n) {
        int[] dp = new int[n + 1];
        for (int i = 1; i <= n; i++) {
            dp[i] = dp[i >> 1] + (i & 1);
        }
        return dp;
    }
}
```

#### Rust

Cast `(i & 1) as i32` because `usize & usize` returns `usize`. Same one-line recurrence as Python.

```rust
fn count_bits(n: i32) -> Vec<i32> {
    let mut dp = vec![0i32; (n + 1) as usize];
    for i in 1..=(n as usize) {
        dp[i] = dp[i >> 1] + (i & 1) as i32;
    }
    dp
}
```

#### Go

`dp[i>>1] + i&1` — Go's operator precedence makes the parens unnecessary (`+` binds tighter than `&`, but here it works out).

```go
func countBits(n int) []int {
    dp := make([]int, n+1)
    for i := 1; i <= n; i++ {
        dp[i] = dp[i>>1] + i&1
    }
    return dp
}
```

#### C++

Identical to Python in structure; could use `std::popcount` per element but the recurrence is asymptotically the same and cache-friendlier.

```cpp
#include <vector>

std::vector<int> countBits(int n) {
    std::vector<int> dp(n + 1, 0);
    for (int i = 1; i <= n; ++i)
        dp[i] = dp[i >> 1] + (i & 1);
    return dp;
}
```


### 148. Reverse Bits

#### Problem
Reverse the bits of a given 32-bit unsigned integer and return the result.

#### Examples

TODO

#### Recognition
**Bit manipulation — shift and OR 32 times.** **O(1)** time, **O(1)** space.

#### Explanation
There are exactly 32 bits to reverse. At each step: shift `res` left by 1 to make room, then OR in the least significant bit of `n` (`n & 1`), then shift `n` right by 1 to expose the next bit. After 32 iterations, `res` holds the reversed bit pattern. This is O(1) because the loop bound is constant (32). Rust and Go expose this as a standard library intrinsic (`reverse_bits` / `bits.Reverse32`) backed by a single CPU instruction on modern hardware. Python integers are arbitrary-precision, so no special masking is needed — the problem constraints guarantee a 32-bit input.

#### Python

Plain shift-and-OR loop because Python has no fixed-width int. 32 iterations is constant, so O(1).

```python
def reverseBits(n):
    res = 0
    for _ in range(32):
        res = (res << 1) | (n & 1)
        n >>= 1
    return res
```

#### Java

`Integer.reverse(n)` is the standard-library bit-reversal intrinsic (`RBIT` on ARM) — one call. The manual shift-and-OR loop is shown only if the intrinsic is disallowed.

```java
class Solution {
    public int reverseBits(int n) {
        return Integer.reverse(n);
    }
}
```

#### Rust

`n.reverse_bits()` is a single CPU instruction (RBIT on ARM, software emulation otherwise). One line.

```rust
fn reverse_bits(n: u32) -> u32 {
    n.reverse_bits()
}
```

#### Go

`bits.Reverse32(num)` from `math/bits` — same intrinsic. Cleanest of the four.

```go
import "math/bits"

func reverseBits(num uint32) uint32 {
    return bits.Reverse32(num)
}
```

#### C++

Plain shift-and-OR loop because there's no `std::reverse_bits` in standard C++. The compiler may optimize this into a single instruction depending on target.

```cpp
#include <cstdint>

uint32_t reverseBits(uint32_t n) {
    uint32_t res = 0;
    for (int i = 0; i < 32; ++i) {
        res = (res << 1) | (n & 1);
        n >>= 1;
    }
    return res;
}
```


### 149. Missing Number

#### Problem
Given an array `nums` containing `n` distinct numbers in the range `[0, n]`, return the one number missing from the range.

#### Examples

```text
Input: nums = [3,0,1]
Output: 2
Explanation: n == 3, so the range is [0,3] and 2 is absent.

Input: nums = [0,1]
Output: 2

Input: nums = [9,6,4,2,3,5,7,0,1]
Output: 8

Constraints:
- n == nums.length, 1 <= n <= 10^4
- 0 <= nums[i] <= n
- all values in nums are distinct
```

#### Recognition
**Signals.** `n` distinct numbers drawn from `[0, n]`, exactly one absent. The value range is pinned to the index range and the defect count is exactly one, which is the standing cue that the answer is recoverable from an *aggregate* rather than a search: any quantity computable in one pass over the whole range and invertible will expose the gap. The usual follow-up asking for `O(1)` extra space rules out a set. **Therefore.** Compute what the total should be and subtract what it is: `n * (n + 1) / 2 - sum(nums)`. One pass, one accumulator, no allocation. **Not the XOR fold** over all indices `0..n` and all values, which is just as correct and just as short, but is the better choice in Java, Rust, Go or C++ once `n` grows, because the expected sum grows quadratically and overflows a 32-bit int while XOR cannot overflow at all. **O(n)** time, **O(1)** space.

#### Explanation
**Brute force.** Try each candidate in `0..n` and scan for it.

```python
def missingNumber(nums):
    for want in range(len(nums) + 1):
        found = False
        for v in nums:
            if v == want:
                found = True
                break
        if not found:
            return want
```

`O(n^2)` time, `O(1)` space.

**Wasteful because.** Every candidate rescans the array to answer one membership question, and the `n` candidates that are present get confirmed only to be thrown away. A full pass over the input yields a single bit of information.

**Optimal.** Stop searching and start accounting. The set `0..n` has a known total, `n * (n + 1) / 2`, and the array is that set with exactly one member removed, so the difference between the expected total and the actual total *is* the removed member. One pass, one accumulator, nothing stored. The same argument runs with XOR in place of addition: fold every index `0..n` and every value together and each present number meets its own copy and cancels. That version is the safer default in a fixed-width language, since the expected sum here is only about `5 * 10^7` but grows as `n^2` and will overflow a 32-bit int, while XOR has no ceiling. Cyclic sort, swapping each value to its own index and reporting the first mismatch, is a third correct answer and the one that survives when several values are missing.

**Edge cases.** The missing value can be `n` itself, as in `[0,1]` where the answer is 2, so the candidate range must run to `n` inclusive. It can equally be 0, as in `[1]`. A single-element array has to work in both directions.

#### Python

`n * (n + 1) // 2 - sum(nums)` — Gauss formula in one expression. Python's arbitrary-precision int sidesteps overflow.

```python
def missingNumber(nums):
    n = len(nums)
    return n * (n + 1) // 2 - sum(nums)
```

#### Java

The Gauss formula `n * (n + 1) / 2 - sum` in a single loop; `int` is 32-bit so within LeetCode bounds there's no overflow, matching the C++/Go approach.

```java
class Solution {
    public int missingNumber(int[] nums) {
        int n = nums.length;
        int expected = n * (n + 1) / 2;
        int actual = 0;
        for (int v : nums) actual += v;
        return expected - actual;
    }
}
```

#### Rust

`nums.iter().sum::<i32>()` with turbofish to disambiguate the sum's type. Risk of overflow for very large `n` but fine within LeetCode bounds.

```rust
fn missing_number(nums: Vec<i32>) -> i32 {
    let n = nums.len() as i32;
    n * (n + 1) / 2 - nums.iter().sum::<i32>()
}
```

#### Go

Manual sum loop — pre-generics Go has no `slices.Sum`. `int` is 64-bit so no overflow on typical inputs.

```go
func missingNumber(nums []int) int {
    n := len(nums)
    expected := n * (n + 1) / 2
    actual := 0
    for _, v := range nums {
        actual += v
    }
    return expected - actual
}
```

#### C++

`std::accumulate` for the sum. `expected - sum` is the answer in one expression after.

```cpp
#include <vector>
#include <numeric>

int missingNumber(std::vector<int>& nums) {
    int n = (int)nums.size();
    int expected = n * (n + 1) / 2;
    return expected - std::accumulate(nums.begin(), nums.end(), 0);
}
```


### 150. Sum of Two Integers

#### Problem
Calculate the sum of two integers `a` and `b` without using the `+` or `-` operators.

#### Examples

```text
Input: a = 1, b = 2
Output: 3

Input: a = 2, b = 3
Output: 5

Input: a = -12, b = 8
Output: -4

Constraints:
- -1000 <= a <= 1000
- -1000 <= b <= 1000
- neither + nor - may appear in the solution
```

#### Recognition
**Signals.** "Without using the `+` or `-` operators" is not a performance constraint, it is the entire problem. Nothing about the input is large or awkward and there is no faster algorithm hiding here. A banned arithmetic operator with the bitwise operators left open is a request to rebuild the operation out of them, and for addition that means reproducing a hardware full adder. **Therefore.** `a ^ b` is the per-column sum with all carries ignored, and `(a & b) << 1` is exactly those carries moved one place left. Feed the pair back in until the carry word is zero, at most 32 rounds for 32-bit inputs. **Not repeated increment** by `b` steps, which still spells `+` or `-` in every language and costs `O(|b|)` besides. **Not a library call** such as `sum([a, b])` or `operator.add(a, b)`, which is the banned operator wearing a hat rather than an alternative to it. **O(1)** time, **O(1)** space.

#### Explanation
**Brute force.** The line you would write if the ban did not exist.

```python
def getSum(a, b):
    # The obvious answer, and the one the problem forbids.
    # Every dodge reduces to it: sum([a, b]),
    # operator.add(a, b) and math.fsum([a, b]) all issue
    # the same machine ADD, so none of them count.
    return a + b
```

`O(1)` time, `O(1)` space.

**Wasteful because.** Nothing here is slow, so the usual framing does not hold: the cost is that you are not permitted this. What the one-liner hides is the machinery, and the machinery is the exercise. A single `+` is a chain of full adders in silicon, and you are being asked to write that chain out.

**Optimal.** Split addition into its two independent halves. Column by column, `a ^ b` is the digit you keep when you ignore carrying, and `a & b` marks the columns that generate a carry, which belongs one position to the left, hence the `<< 1`. Neither half is the answer on its own, so set `a, b = a ^ b, (a & b) << 1` and repeat: each round pushes the surviving carries further left, so after at most 32 rounds the carry word is zero and `a` holds the sum. Python needs one extra guard, because its integers are arbitrary precision and a negative value has infinitely many leading one bits, so the carry never falls off the end. Mask with `0xFFFFFFFF` each round to emulate a 32-bit register, then reinterpret the result as signed. Java, Rust, Go and C++ get that truncation from the type itself.

**Edge cases.** `b = 0` returns `a` without entering the loop. Mixed signs such as `a = -12, b = 8` are what exposes a missing mask in Python, where the loop otherwise never terminates. Two's complement means subtraction needs no separate branch: negative operands flow through the same adder unchanged.

#### Python

Python's arbitrary-precision int needs `mask = 0xFFFFFFFF` to keep `b` in 32-bit range — otherwise the carry shift could grow forever. Final `& mask` reinterprets the result as a 32-bit signed value.

```python
def getSum(a, b):
    mask = 0xFFFFFFFF
    while b & mask:
        carry = (a & b) << 1
        a ^= b
        b = carry
    return a if b == 0 else a & mask
```

#### Java

Fixed-width `int` handles the wraparound naturally, so no masking is needed (unlike Python): `a ^ b` is the carry-less sum and `(a & b) << 1` is the carry, looped until the carry is zero.

```java
class Solution {
    public int getSum(int a, int b) {
        while (b != 0) {
            int carry = (a & b) << 1;
            a ^= b;
            b = carry;
        }
        return a;
    }
}
```

#### Rust

Fixed-width `i32` handles overflow naturally — `((a & b) as u32) << 1` casts to unsigned for the shift, then back to `i32`. The bit pattern is the same.

```rust
fn get_sum(mut a: i32, mut b: i32) -> i32 {
    while b != 0 {
        let carry = ((a & b) as u32) << 1;
        a ^= b;
        b = carry as i32;
    }
    a
}
```

#### Go

Plain integer ops — `int` is 64-bit but the bit pattern math works regardless. Shifts in Go don't undefined-behavior on signed overflow like C.

```go
func getSum(a int, b int) int {
    for b != 0 {
        carry := (a & b) << 1
        a ^= b
        b = carry
    }
    return a
}
```

#### C++

Cast through `unsigned` for the shift to avoid signed-overflow UB. Same bit-pattern math, just safer compile-time.

```cpp
int getSum(int a, int b) {
    while (b != 0) {
        unsigned carry = (unsigned)(a & b) << 1;
        a ^= b;
        b = (int)carry;
    }
    return a;
}
```
