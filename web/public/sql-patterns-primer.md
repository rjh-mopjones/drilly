---
type: interview-primer
---

# SQL Patterns Primer

Recognition-layer drill for SQL interview prep. The two SQL Practice sources teach you *how to write* each pattern; this primer teaches you *how to spot* which pattern a problem needs in under 30 seconds. 25 topics, ~150-180 questions. All examples in **Postgres 17/18** — uses `MERGE`, `JSON_TABLE`, `tablefunc.crosstab`, `PERCENTILE_CONT`, `LATERAL`, `DISTINCT ON`, `FILTER`, `EXCLUDE` constraints freely.

Pair with **Postgres** (engine-operational depth) and **SQL Practice** / **Advanced SQL Practice** (worked problems) under the Databases category.

The drill discipline: read a prompt, walk the four-pass decision tree (input shape → output cardinality → output type → constraint clues), name the pattern in under 30 seconds, then verify against the worked solutions in SQL Practice. Most senior candidates lose SQL rounds not because they can't write the query, but because they reach for a self-join when a window function would halve the code, or a correlated subquery when `DISTINCT ON` does it in one line. Get the recognition right and the rest is mechanical.

---

## Recognition & Decision Tree

### Summary

**What this topic covers**

The mental decision tree a senior candidate walks the moment a SQL prompt lands. Four passes — **input shape** (single table, two tables, hierarchical/self-referential, time-series, JSON-shaped, graph-shaped), **output cardinality** (single scalar, single row, set of rows, aggregated set, pivoted matrix, hierarchical tree), **output type** (count / sum / ranking / top-N / running calc / pivot / median / window-aware / boolean), and **constraint clues** (keywords like "consecutive", "median", "running", "transitive", "since last X", "within N days", "rolling", "first/last per group", "as-of"). Each pass narrows the candidate pattern set; by the fourth pass you typically have one pattern in mind and a clear fallback. The 7 questions in this topic are pure recognition drills — read a one-line signal, name the pattern, justify the choice with a complexity or readability argument.

**Mental model**

Think of SQL pattern recognition as four lenses applied in sequence. The **input shape lens** is the biggest branch: hierarchical self-referencing tables scream recursive CTE; two tables with a foreign key scream join; one table with a time column scream window function or `LAG`/`LEAD`; a JSON column means `jsonb_path_query` or `JSON_TABLE`; an event log with a session boundary screams gaps & islands. The **output cardinality lens** narrows by what shape you must return: a single scalar usually fits a subquery in `SELECT`; a row-per-group output is `GROUP BY`; a row-per-input with computed columns is a window function; a pivoted matrix needs `crosstab` or conditional aggregation. The **output type lens** picks the function: `COUNT(DISTINCT)`, `SUM(... ) FILTER (WHERE ...)`, `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)`, `PERCENTILE_CONT(0.5)`, `string_agg`. The **constraint clue lens** is the final reflex: "consecutive" → gaps & islands; "median" → `PERCENTILE_CONT`; "running" → window function with a frame; "transitive closure" → recursive CTE; "as-of" → range overlap or `LATERAL` join; "first per group" → `DISTINCT ON` (Postgres-specific) or `ROW_NUMBER() = 1` (portable). Senior candidates often skip the first two passes and reach the pattern from clue keywords alone — that's the goal state.

**Key terms**

- **Input shape** — the table topology (single, multi-table, self-referencing, time-series, JSON-shaped, graph-shaped); the first big branch.
- **Output cardinality** — scalar vs row vs set vs aggregated set vs pivot vs tree; the second big branch.
- **Output type** — the aggregate or window function family the prompt demands.
- **Constraint clue** — a single keyword in the prompt that locks the pattern (consecutive, median, running, transitive, as-of, etc.).
- **Brute-force baseline** — the obvious correlated-subquery or self-join version; state it before optimising.
- **Pattern shortlist** — output of the tree: 1-2 candidate patterns, ranked.
- **Reflex pattern recognition** — pattern is named within 30 seconds of reading the prompt.
- **Portability vs Postgres-native** — `ROW_NUMBER() = 1` is portable; `DISTINCT ON` is Postgres-only but shorter. Pick by audience.
- **Cost-readability trade** — sometimes the readable answer (window function) is also the cheap one; sometimes the cheap one (correlated subquery with an index) is uglier.
- **Decision symmetry** — the tree mirrors the SQL Practice / Advanced SQL Practice topic taxonomy; drilling it pays compounding interest.

**Why interviewers ask this**

Three signals. (1) **Process visibility** — senior SQL interviewers want to see you scan the prompt for input shape, cardinality, and clue keywords before reaching for syntax. Candidates who jump to `SELECT ... FROM ...` without that scan signal junior; candidates who narrate "this is a top-N-per-group problem because the output shape is one row per category" signal staff. (2) **Pattern fluency over syntax memorisation** — there are 25 SQL patterns and maybe 200 prompts in the wild; the recognition tree is what lets you map the 200 to the 25 without re-deriving. (3) **Tradeoff articulation** — many SQL prompts have two valid patterns (window function vs self-join; correlated subquery vs CTE; `DISTINCT ON` vs `ROW_NUMBER`); a senior candidate names both and picks one with a justification (readability, index alignment, portability). That tradeoff conversation is the senior tell.

**Common confusions**

- "Pattern recognition is just memorising more queries" — it's memorising the *signals that map to patterns*, not the queries.
- "I should always reach for window functions" — many prompts (single-row aggregate, simple count, no per-row output) don't need them; using them anyway is over-engineering.
- "Subqueries and CTEs are interchangeable" — they're not in Postgres; CTEs were an optimisation fence before PG 12, and in PG 17/18 the planner inlines them unless `MATERIALIZED` is set.
- "Self-join is always slower than window functions" — usually true but not always; on a tiny table with a great index, the self-join can win.
- "The four-pass tree is too slow for a 45-minute interview" — it takes 10 seconds once internalised; only feels slow when you're still learning it.
- "If the prompt says 'rank', I always use `RANK()`" — no; `RANK()` leaves gaps after ties (1, 1, 3), `DENSE_RANK()` doesn't (1, 1, 2), `ROW_NUMBER()` breaks ties arbitrarily. The prompt's tie semantics decide.

**What follows from this topic**

Every later topic in the primer expands one branch of this tree. Topic 2 (Pattern Signal Tables) compresses the tree into two lookup grids you can scan mid-interview. Topics 3-22 are the leaves — each one drills one pattern at the recognition layer. Topic 23 (Query Plan Reading) is what you reach for when the pattern is right but the query is slow. Topic 24 (Anti-patterns) is the negative space — recognising when a candidate is about to make a textbook mistake. Topic 25 (Closing) is the consolidation. If you can't walk this tree on a cold prompt, fix it first; drilling the leaves before the trunk doesn't compound.

### Q1. A prompt says "find consecutive days where revenue exceeded 100k for at least 3 days in a row". Walk the tree.

**Input shape**: single time-series table. **Output cardinality**: set of date ranges (or a count of streaks). **Output type**: streak detection. **Constraint clue**: "consecutive" / "in a row" — dead-on signal for **gaps & islands**. The standard move is `ROW_NUMBER() OVER (ORDER BY day)` minus a running row number among qualifying days; rows in the same streak share the same difference, so `GROUP BY (date - row_number_among_qualifying)` clusters them. Then `HAVING COUNT(*) >= 3` filters streaks of length ≥ 3. Brute-force baseline is a self-join checking `day, day+1, day+2`, which doesn't generalise to length-K streaks.

### Q2. Prompt: "for each customer return their most recent order". What's your move and what's the tradeoff?

**`DISTINCT ON (customer_id) ... ORDER BY customer_id, order_date DESC`** in Postgres — one-liner, planner-friendly, uses the index on `(customer_id, order_date DESC)` if present. Portable alternative: `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) = 1` in a CTE. Both are O(N log N) (sort by `(customer_id, order_date)`); `DISTINCT ON` is shorter and slightly faster because it can stop after the first row per group; `ROW_NUMBER` is what you write in MySQL or for cross-engine portability. Avoid the correlated subquery `WHERE order_date = (SELECT MAX(order_date) ...)` — it's slower and re-evaluates per row.

### Q3. "Find users whose 7-day rolling average sessions exceeded 10 for the first time in March". Pattern stack?

Two patterns layered. (1) **Window function with frame** — `AVG(sessions) OVER (PARTITION BY user_id ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` computes the rolling 7-day average. (2) **First occurrence per group** — wrap in a CTE, filter `WHERE rolling_avg > 10`, then `DISTINCT ON (user_id) ... ORDER BY user_id, day` to pick the first qualifying day per user. Filter to March on the outer query. The clue chain: "rolling N-day" → window frame; "first time" → first-per-group. Layering patterns like this is the senior-level move.

### Q4. "Return every employee and their manager's manager, up to the CEO". Recognise.

**Input shape clue**: self-referencing table (employee → manager via `manager_id`). **Output**: hierarchical traversal of arbitrary depth. **Pattern**: **recursive CTE**. Base case: `SELECT id, manager_id, 1 AS level FROM employees WHERE id = :start`. Recursive case: join `employees` on `e.id = r.manager_id`, increment level. Stop when `manager_id IS NULL` (CEO). The trap: forgetting the cycle-guard (Postgres `CYCLE` clause or a manual visited array) — on a corrupted org chart this loops forever. The brute-force alternative (N self-joins for N levels) doesn't work because levels are unbounded.

### Q5. "Pivot the daily revenue table so each row is a customer and each column is a month". Pattern and the Postgres-specific move.

**Pivot**. Two valid Postgres moves: (1) **Conditional aggregation with `FILTER`** — `SUM(revenue) FILTER (WHERE month = 1) AS jan, SUM(revenue) FILTER (WHERE month = 2) AS feb, ...`. Verbose but transparent and works in any standard SQL. (2) **`tablefunc.crosstab`** — Postgres-specific, requires `CREATE EXTENSION tablefunc`. Shorter syntax but the column list must be known at query time, which is the same constraint as conditional aggregation anyway. For unknown column sets (truly dynamic pivot), generate the SQL programmatically — pure SQL can't return a variable-shape result set.

### Q6. "Find pairs of users who logged in on the same day". Self-join vs window function?

**Self-join with an inequality predicate**: `FROM logins a JOIN logins b ON a.day = b.day AND a.user_id < b.user_id`. The `<` keeps each pair once (instead of (alice, bob) and (bob, alice)). Window functions don't apply here because the output is a *cartesian-style pair set*, not a per-row computation. Complexity: O(N²) worst case, but a good index on `(day)` plus a hash join keeps it tractable. If the prompt added "and they logged in within 5 minutes of each other", you'd add `AND abs(extract(epoch from a.ts - b.ts)) < 300` — same self-join, tighter predicate.

### Q7. "Compute the cumulative number of distinct users seen up to each day". The trap?

The trap: `COUNT(DISTINCT user_id) OVER (ORDER BY day ROWS UNBOUNDED PRECEDING)` is **not supported** as a window function in standard SQL (and Postgres rejects it). You need a workaround. Two options: (1) **First-appearance trick** — find each user's first login day with `DISTINCT ON (user_id) ... ORDER BY user_id, day`, then on the resulting table do `COUNT(*) OVER (ORDER BY first_day)` which becomes a plain running count. (2) **Self-join** — for each day, count distinct users where login_day ≤ that day. Option (1) is O(N log N), option (2) is O(N²). The recognition signal is "distinct in a running window" — that's specifically the unsupported case, and you need the first-appearance reformulation.

---

## Pattern Signal Tables

### Summary

**What this topic covers**

The lookup tables that compress the Recognition Decision Tree into two reference grids you can scan mid-interview without re-deriving. The first grid is **by keyword** — for every common phrase that appears in SQL interview prompts ("consecutive", "median", "running total", "top-N per X", "transitive closure", "as-of", "sessionize", "pivot", "cohort retention", "first/last per group", "exists / not exists"), it lists the pattern you reach for. The second grid is **by return shape** — single scalar, row-per-input, row-per-group, pivoted matrix, hierarchical tree — each shape maps to a small candidate set. These tables aren't a substitute for understanding the patterns; they're a compiled form of the understanding that cuts recognition latency from minutes to seconds once internalised. The 6 questions in this topic are scenario drills: given a one-line prompt fragment, name the pattern and justify with a constraint argument.

**Mental model**

The signal tables work because SQL interview prompts use a small vocabulary — maybe 40 phrases cover the entire corpus, and each maps to 1-2 patterns. "Consecutive" + "streak" = gaps & islands. "Median" + "p50" = `PERCENTILE_CONT`. "Running total" + "cumulative" = window function with frame. "Top-N per group" = `DISTINCT ON` or `ROW_NUMBER() = N`. "Transitive closure" + "reachable from" = recursive CTE. The keyword table is the compiled vocabulary. The **return shape** is the second strongest signal: a single scalar usually means a single aggregate (no `GROUP BY` needed); a row-per-input output with computed columns is a window function; a row-per-group output is `GROUP BY`; a pivoted matrix is conditional aggregation; a hierarchical tree is a recursive CTE. Combining keyword + return shape narrows to one pattern in 80% of cases. The interviewer phrasing is itself diagnostic — they're not hiding the pattern, they're testing whether you can hear it.

**Key terms**

- **Keyword signal** — a specific word or phrase in the prompt that maps to a pattern.
- **Return-shape signal** — the cardinality and topology of the output (scalar / row-per-input / row-per-group / matrix / tree).
- **"Consecutive" / "in a row" / "streak"** — gaps & islands.
- **"Median" / "percentile" / "p50/p95/p99"** — `PERCENTILE_CONT` (continuous) or `PERCENTILE_DISC` (exact existing value).
- **"Running" / "cumulative" / "rolling"** — window function with a frame.
- **"Top-N per group" / "first per group" / "last per group"** — `DISTINCT ON` or `ROW_NUMBER() = 1`.
- **"As-of" / "point in time" / "snapshot"** — range overlap or `LATERAL` join.
- **"Cohort" / "retention" / "funnel"** — `GENERATE_SERIES` + `LEFT JOIN` or a self-join on first-action date.
- **"Pivot" / "rows to columns"** — conditional aggregation with `FILTER` or `tablefunc.crosstab`.
- **"Exists" / "not exists" / "missing in B"** — semi-join (`EXISTS` / `IN`) or anti-join (`NOT EXISTS` / `LEFT JOIN ... IS NULL`).
- **"Sessionize" / "event boundary"** — gaps & islands on time with `LAG`.
- **"Transitive" / "reachable" / "ancestors"** — recursive CTE.

**Why interviewers ask this**

Two signals fold into one. (1) **Vocabulary fluency** — senior SQL candidates speak in the same dialect as the prompts. When the interviewer says "find consecutive days of declining revenue", a fluent candidate is mid-CTE before the sentence ends. (2) **Disambiguation discipline** — many prompts have two valid patterns; for example "first row per group" is `DISTINCT ON` (Postgres) or `ROW_NUMBER() OVER (PARTITION BY ...) = 1` (portable) or `MIN(...)` with a correlated subquery (worst). A senior candidate names the alternatives and picks one with a justification (portability, index alignment, readability). That tradeoff conversation is the staff-level signal that you've internalised the tables as a decision tree, not a flat lookup.

**Common confusions**

- "These tables are a cheat sheet, not real understanding" — they're a *compiled* form of the understanding. The templates and the proofs still matter; the tables compress only the recognition step.
- "If two keywords match, pick the first one" — pick the *most specific* one; "consecutive days where condition X holds" is gaps & islands with a `WHERE` filter, not a plain `LAG` chain.
- "Return shape is a stylistic choice" — no, it's a major signal; row-per-input output with a per-row computation is almost certainly a window function, never a `GROUP BY`.
- "Median always means `PERCENTILE_CONT`" — `PERCENTILE_CONT(0.5)` interpolates, `PERCENTILE_DISC(0.5)` returns an existing value. The prompt's tie semantics decide.
- "Running sum is just `SUM(...) OVER (ORDER BY day)`" — yes, but the default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which behaves differently from `ROWS BETWEEN ...` when ties exist on `day`. Pick the frame explicitly.

**What follows from this topic**

The 23 individual pattern topics that follow are the expansion of each row in these tables. Drilling them in order is fine, but in practice you should drill them in *frequency order* — joins, group by, window functions, top-N per group, and gaps & islands cover the majority of interview prompts and deserve 70% of your practice budget. The Postgres-specific power features (topic 22) and statistical SQL (topic 18) come up less often but separate staff candidates from senior. If you can read a prompt and name the pattern within 30 seconds using these tables, the rest of the interview is mechanical query construction.

| Words in prompt | Reach for |
|---|---|
| "consecutive", "in a row", "streak" | Gaps & Islands |
| "median", "p50", "p95", "p99" | `PERCENTILE_CONT` / `PERCENTILE_DISC` |
| "running total", "cumulative", "running count" | Window function with frame |
| "rolling N-day average" | Window with `ROWS BETWEEN N PRECEDING AND CURRENT ROW` |
| "top-N per group" | `DISTINCT ON` (Postgres) or `ROW_NUMBER() = N` |
| "first per group", "most recent per group" | `DISTINCT ON` or `ROW_NUMBER() = 1` |
| "transitive closure", "reachable from", "all ancestors" | Recursive CTE |
| "as-of", "point in time", "snapshot at" | Range overlap or `LATERAL` join |
| "sessionize", "event sequence", "user journey" | Gaps & Islands on time + `LAG` |
| "pivot", "rows to columns" | Conditional aggregation with `FILTER` |
| "cohort retention", "weekly retention" | `GENERATE_SERIES` cohort matrix + `LEFT JOIN` |
| "find pairs where" | Self-join with inequality predicate |
| "exists / not exists" | `EXISTS` (semi-join) / `NOT EXISTS` (anti-join) |
| "missing values", "fill gaps" | `GENERATE_SERIES` + `LEFT JOIN` |
| "upsert", "merge", "idempotent insert" | `INSERT ... ON CONFLICT` or `MERGE` |
| "rank with ties" | `RANK()` (gaps) / `DENSE_RANK()` (no gaps) |
| "Nth percentile" | `PERCENTILE_CONT(p) WITHIN GROUP (ORDER BY x)` |
| "GROUP BY multiple groupings at once" | `GROUPING SETS`, `ROLLUP`, `CUBE` |
| "JSON path query" | `jsonb_path_query` / `JSON_TABLE` (PG 17+) |
| "compare each row to next/previous" | `LAG` / `LEAD` window functions |

Then by **return shape**:

| Output shape | Likely pattern |
|---|---|
| Single scalar | Single aggregate, no `GROUP BY` |
| One row per input row, with computed columns | Window function (no `GROUP BY`) |
| One row per group | `GROUP BY` with aggregates |
| One row per group, picked from input rows | `DISTINCT ON` or `ROW_NUMBER() = 1` |
| Pivoted matrix (rows × known categories) | Conditional aggregation with `FILTER` |
| Tree / hierarchical | Recursive CTE |
| Time-bucketed series with zero-fills | `GENERATE_SERIES` + `LEFT JOIN` |
| Boolean per row ("does X exist?") | `EXISTS` correlated subquery |
| Set difference ("in A not in B") | Anti-join (`NOT EXISTS` or `LEFT JOIN ... IS NULL`) |
| Pair set | Self-join with inequality predicate |

### Q1. "Find the median order value per customer." Keyword scan, pattern, justify.

**`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY order_value) OVER (PARTITION BY customer_id)`** — or, more commonly, in a `GROUP BY customer_id` with `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY order_value)` as the aggregate. The keyword "median" is dead-on. `PERCENTILE_CONT` interpolates between the two middle values for even-count groups; `PERCENTILE_DISC` returns the lower of the two. For interview answers always say `PERCENTILE_CONT` unless the prompt specifies "existing value". The brute-force baseline is a self-join counting how many values are ≤ each value, which is O(N²) per group — never write that in an interview.

### Q2. "Return one row per category showing the highest-revenue product in that category." Keyword + return shape, pattern.

Keyword: "highest per category" — top-1 per group. Return shape: one row per category. **`DISTINCT ON (category) ... ORDER BY category, revenue DESC`** in Postgres. The full template: `SELECT DISTINCT ON (category) category, product_name, revenue FROM products ORDER BY category, revenue DESC`. The portable answer is `ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC) = 1` wrapped in a CTE. Worst answer: correlated subquery `WHERE revenue = (SELECT MAX(revenue) FROM products WHERE category = p.category)` — works but evaluates the subquery per row.

### Q3. "Compute weekly retention — what percentage of users who signed up in week 1 also logged in week 2, week 3, ..." Pattern stack.

**Cohort matrix**: (1) Find each user's signup week via `DATE_TRUNC('week', signup_date)`. (2) Compute the difference between login week and signup week for each login. (3) Pivot: cohort rows by signup week, columns by week offset, cells = `COUNT(DISTINCT user_id)`. (4) Divide by cohort size for percentages. The keyword "cohort" + "retention" is the dead-on signal; the implementation is conditional aggregation with `FILTER`. For sparse cohorts, `LEFT JOIN` against `GENERATE_SERIES(0, max_offset)` to ensure zero-fills.

### Q4. Prompt fragment: "for each transaction, the previous transaction by the same customer". Pattern.

**`LAG(transaction_id) OVER (PARTITION BY customer_id ORDER BY ts)`**. The "previous by the same customer" phrasing is dead-on for `LAG` — it returns the value from the preceding row in the partition. `LEAD` is the symmetric move for "the next transaction". Brute-force baseline: self-join `t1 JOIN t2 ON t1.customer_id = t2.customer_id AND t2.ts < t1.ts` then take `MAX(t2.ts)` per `t1`, which is O(N²). `LAG` is O(N log N) (just a sort). Pure recognition: any prompt with "previous" or "next" by group should reach for `LAG`/`LEAD` reflexively.

### Q5. "List users who placed an order in January but not February." Keyword scan, pattern.

Keyword: "but not" — set difference. **Anti-join**, written as `EXISTS` for Jan and `NOT EXISTS` for Feb: `WHERE EXISTS (SELECT 1 FROM orders WHERE user_id = u.id AND month = 1) AND NOT EXISTS (SELECT 1 FROM orders WHERE user_id = u.id AND month = 2)`. The standard alternative is `EXCEPT`: `(SELECT user_id FROM orders WHERE month = 1) EXCEPT (SELECT user_id FROM orders WHERE month = 2)`. Both are equivalent; `EXCEPT` reads better here, `NOT EXISTS` reads better when the conditions are more complex. Avoid `NOT IN` — it has surprising NULL semantics (if the subquery returns any NULL, the entire predicate is unknown).

### Q6. Senior interview angle: "find the second-highest salary per department". Three valid patterns, pick.

(1) **`DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) = 2`** — handles ties correctly (if two people share the top salary, the third person becomes #2 with `RANK`, but stays #2 with `DENSE_RANK`). The prompt's tie semantics decide which. (2) **`ROW_NUMBER() OVER (...) = 2`** — breaks ties arbitrarily; wrong if "second-highest" means "second distinct value". (3) **`OFFSET 1 LIMIT 1`** after sorting — only works for one department at a time, not the per-department case. Senior tell: name all three, articulate the tie semantics, pick `DENSE_RANK` with the justification "second-highest distinct value, ties counted once". The interviewer is grading the tradeoff conversation, not the syntax.

---

## JOIN Patterns

### Summary

**What this topic covers**

The recognition layer for join selection — `INNER JOIN` vs `LEFT JOIN` vs `RIGHT JOIN` vs `FULL OUTER JOIN` vs `CROSS JOIN` vs `LATERAL JOIN` vs self-join — and the predicate placement rules (`ON` vs `WHERE`) that change the result semantics on outer joins. Sub-patterns: (1) **equality joins** — foreign-key joins, the standard move; (2) **inequality joins** — range overlaps, "between" joins, used for time-bucketing and as-of queries; (3) **LATERAL joins** — the per-row correlated subquery that returns a set, used for "top-N per group" and "for each customer, their most recent N orders"; (4) **self-joins** — for hierarchy walks (one level), pair-finding, and adjacency queries; (5) **CROSS JOIN** — explicit cartesian, used with `GENERATE_SERIES` for cohort matrices and time fills. The 7 questions cover the templates, the `ON` vs `WHERE` trap on `LEFT JOIN`, the LATERAL recognition signal, and the senior-level optimisation argument (when does the planner reorder joins, when does it not).

**Mental model**

Joins are how SQL composes tables, and the choice of join type encodes the *semantic* relationship between the two sides. `INNER JOIN` says "both sides must have a row"; `LEFT JOIN` says "every left row, with right-side data if present"; `FULL OUTER JOIN` says "every row on either side"; `CROSS JOIN` says "every combination". The senior insight is that `LEFT JOIN` is a *superset* of `INNER JOIN` — every `INNER JOIN` can be rewritten as `LEFT JOIN` followed by `WHERE right.key IS NOT NULL`, and that rewrite is the basis of the anti-join (`LEFT JOIN ... WHERE right.key IS NULL` returns rows in left not in right). The second insight is the `ON` vs `WHERE` distinction on outer joins: `ON` filters the join itself (and outer-side rows survive even if the predicate fails), `WHERE` filters the result (and an `IS NULL` check on the right side can be turned into an inner join inadvertently). `LATERAL` is the special move when the right side depends on the left side — useful when you need "for each row on the left, the top N rows on the right". The mental shift from procedural programming is "joins describe the relationship between sets, not the iteration order" — the planner picks nested loop, hash, or merge join based on stats; you don't control that, you just describe the relationship.

**Key terms**

- **`INNER JOIN`** — rows where both sides match; the default.
- **`LEFT JOIN`** — every row on the left, with right data if present (NULLs otherwise).
- **`FULL OUTER JOIN`** — every row on either side, NULL-padded where no match.
- **`CROSS JOIN`** — cartesian product; explicit form of `FROM a, b`.
- **`LATERAL JOIN`** — right side is correlated with left, evaluated per left row; used for top-N-per-group and "for each X, its dependent set".
- **Self-join** — joining a table to itself, usually with an inequality predicate.
- **Equi-join** — join predicate is an equality on foreign keys; the hash join's sweet spot.
- **Inequality join** — join predicate is a range or `<` / `>` comparison; usually nested loop or merge join.
- **Anti-join** — `LEFT JOIN ... WHERE right.key IS NULL` or `NOT EXISTS`; rows in left not in right.
- **Semi-join** — `EXISTS` or `IN`; rows in left that have at least one match in right, no duplication.
- **`ON` vs `WHERE` on outer joins** — `ON` filters the join (outer rows survive); `WHERE` filters the result (can break the outer-ness).
- **USING vs ON** — `USING(col)` is shorthand for `ON a.col = b.col`, and the joined column appears once in the output instead of twice.

**Why interviewers ask this**

Three signals. (1) **Semantic clarity** — picking the wrong join (`INNER` when `LEFT` was needed, or vice versa) silently drops or duplicates rows; senior candidates think about the relationship first, syntax second. (2) **`ON` vs `WHERE` discipline** — moving a predicate from `ON` to `WHERE` on a `LEFT JOIN` can convert it into an effective `INNER JOIN`. Senior candidates know to keep right-side filters in `ON` (or use `LEFT JOIN LATERAL`). (3) **LATERAL recognition** — most candidates have never used `LATERAL` and reach for self-joins or subqueries instead; recognising "for each X, give me the top N Y" as `LATERAL` is a staff-level signal because it produces the cleanest query plan and the most readable code.

**Common confusions**

- "`LEFT JOIN` and `RIGHT JOIN` are different patterns" — they're symmetric; always rewrite `RIGHT JOIN` as `LEFT JOIN` with sides flipped for readability.
- "`FULL OUTER JOIN` is rare and exotic" — it's the standard move for set comparisons ("rows in A xor B").
- "I can use `WHERE right.col = 5` on a `LEFT JOIN` to filter" — that quietly converts the join to inner because rows with `right.col IS NULL` fail the predicate.
- "`CROSS JOIN` is always wrong" — paired with `GENERATE_SERIES` it's the right move for time-bucketing and cohort matrices.
- "`LATERAL` is just a fancy subquery" — it's a *correlated set-returning* subquery in `FROM` clause, which the planner can optimise differently from a scalar subquery.
- "Self-joins are slow" — depends on the index; on a self-join with a good predicate index, the optimiser can hash-join the table against itself in one pass.

**What follows from this topic**

Joins are the foundation for nearly every multi-table SQL pattern. Anti-joins (covered in topic 15) build directly on `LEFT JOIN ... IS NULL`. Top-N per group (topic 12) uses `LATERAL` as one of three valid patterns. Self-joins recur in gaps & islands (topic 10), sessionization (topic 11), and hierarchical queries one level deep. The `ON` vs `WHERE` distinction matters in query plan reading (topic 23) because misplaced predicates change the join order and index selection. If you internalise joins as "describing set relationships" rather than "iteration patterns", every later pattern that uses them feels like composition rather than syntax memorisation.

### Q1. Prompt: "list customers and their orders, including customers with no orders". `INNER` or `LEFT`?

**`LEFT JOIN customers c LEFT JOIN orders o ON o.customer_id = c.id`**. The clue "including customers with no orders" is the dead-on signal for `LEFT JOIN` — every left row survives, with NULLs in `orders` columns for customers with none. The trap: if you then write `WHERE o.created_at > '2024-01-01'`, you've effectively converted it to an `INNER JOIN` because customers with no orders have `o.created_at IS NULL` which fails the predicate. Either move the date filter into the `ON` clause or change the predicate to `WHERE o.created_at > '2024-01-01' OR o.created_at IS NULL`.

### Q2. "For each customer, return their three most recent orders." Pattern, justify.

**`LATERAL` join**, the cleanest version: `FROM customers c CROSS JOIN LATERAL (SELECT * FROM orders o WHERE o.customer_id = c.id ORDER BY o.created_at DESC LIMIT 3) o`. The right side is evaluated per customer and returns up to 3 rows. Alternative: `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) <= 3` in a CTE, which sorts the entire orders table once. `LATERAL` is usually faster when there's a good index on `(customer_id, created_at DESC)` because each per-customer query is an index scan. The window-function version is steadier when there's no such index. Senior tell: name both, name the index alignment, pick `LATERAL`.

### Q3. "Find users in table A who are not in table B". Anti-join — three valid forms.

(1) **`NOT EXISTS`**: `WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.user_id = a.user_id)`. Usually the planner's favourite. (2) **`LEFT JOIN ... IS NULL`**: `LEFT JOIN b ON b.user_id = a.user_id WHERE b.user_id IS NULL`. Equivalent in modern planners. (3) **`EXCEPT`**: `(SELECT user_id FROM a) EXCEPT (SELECT user_id FROM b)`. Returns *distinct* user_ids, which differs subtly from the others. **Never `NOT IN`** — if the subquery returns any NULL, the entire predicate is unknown and you get an empty result. The senior tell is naming the NULL hazard explicitly.

### Q4. Walk me through the `ON` vs `WHERE` trap on `LEFT JOIN`.

```sql
-- Wanted: customers and their 2024 orders, including customers with zero 2024 orders
SELECT c.name, o.id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.created_at >= '2024-01-01';
```

This is wrong. Customers with no 2024 orders have `o.created_at IS NULL`, which fails the `WHERE` predicate, so they're dropped — effectively converting the join to inner. Correct version:

```sql
LEFT JOIN orders o ON o.customer_id = c.id AND o.created_at >= '2024-01-01'
```

Move the date filter into `ON` so the join itself is filtered but the customer row survives even when there's no matching order. The recognition trick: any time you have a `LEFT JOIN` with a predicate on the right side, ask whether you want non-matching left rows to survive — if yes, the predicate goes in `ON`, never `WHERE`.

### Q5. "Generate one row per day for the last 30 days, with the count of signups that day (zero-filled)". Pattern.

**`CROSS JOIN GENERATE_SERIES`** + `LEFT JOIN`. Template:

```sql
SELECT d::date, COUNT(s.id) AS signups
FROM GENERATE_SERIES(CURRENT_DATE - 29, CURRENT_DATE, '1 day'::interval) d
LEFT JOIN signups s ON s.created_at::date = d::date
GROUP BY d::date
ORDER BY d::date;
```

The recognition signal: "every day in range, including days with zero events". Without the `CROSS JOIN GENERATE_SERIES`, days with no signups disappear because there's no row to anchor them. The same pattern works for cohort matrices, missing-value fills, and "expected vs actual" comparisons.

### Q6. Self-join recognition: "find employees who earn more than their manager". Pattern.

**Self-join** on the manager FK: `FROM employees e JOIN employees m ON m.id = e.manager_id WHERE e.salary > m.salary`. The recognition signal is the self-referencing column (`manager_id` pointing to another employee). For multi-level hierarchy ("earns more than their manager's manager"), upgrade to a recursive CTE; one level is fine with a single self-join. The trap: forget the alias and write `WHERE e.salary > employees.salary` — the parser will error or, worse, silently pick the wrong reference.

### Q7. Senior interview angle: when does `LATERAL` outperform a window function for top-N per group?

`LATERAL` wins when (1) there's a good composite index on `(group_key, order_key DESC)` so each per-group `LIMIT N` is an index scan, and (2) N is small relative to group size (e.g. 3 latest orders out of thousands per customer). Window functions sort the entire table once; `LATERAL` does many small sorts that stop early. The breakeven is roughly: if `total_rows >> N × num_groups` and the index is good, `LATERAL` wins; otherwise window function wins. The senior tell is articulating this tradeoff and verifying with `EXPLAIN ANALYZE` before committing. Naive candidates always reach for the window function; staff-level candidates check the index and the group size first.

---

## GROUP BY, HAVING & Conditional Aggregation

### Summary

**What this topic covers**

The aggregation layer of SQL — `GROUP BY` for row-per-group output, `HAVING` for post-aggregation filtering, and `FILTER (WHERE ...)` for conditional aggregates that compute several aggregates from one scan. Sub-patterns: (1) **single-key `GROUP BY`** — the standard "count per category" move; (2) **multi-key `GROUP BY`** — "count per (category, region)"; (3) **`HAVING` post-filter** — keep only groups whose aggregate satisfies a condition; (4) **conditional aggregation with `FILTER`** — `COUNT(*) FILTER (WHERE status = 'paid')` reads cleaner than `SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)` and the planner treats them identically; (5) **`GROUPING SETS` / `ROLLUP` / `CUBE`** — multiple grouping levels in one scan, used for hierarchical totals (subtotals + grand total) and dashboards. The 6 questions cover the templates, the `WHERE` vs `HAVING` distinction, the `FILTER` vs `CASE WHEN` choice, and the senior-level rollup recognition.

**Mental model**

`GROUP BY` collapses a set of rows into one row per distinct group key, and every column in the `SELECT` must either be in the `GROUP BY` or wrapped in an aggregate. That constraint is what makes `GROUP BY` precise: there's exactly one row per group, and any column that varies within a group must be aggregated. `WHERE` filters input rows *before* the grouping; `HAVING` filters groups *after* aggregation. The order is `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT`, which is why aggregate aliases aren't visible in `WHERE` but are visible in `ORDER BY`. The senior insight is that **`FILTER (WHERE ...)` is the right tool for "compute several conditional counts in one pass"** — rather than three separate queries or three subqueries, you write `COUNT(*) FILTER (WHERE status = 'paid'), COUNT(*) FILTER (WHERE status = 'pending'), COUNT(*) FILTER (WHERE status = 'cancelled')` in one `SELECT`. The planner makes one scan and bucket-counts. For pivots, this generalises: `SUM(revenue) FILTER (WHERE month = 1) AS jan, SUM(revenue) FILTER (WHERE month = 2) AS feb, ...` is the conditional-aggregation pivot. For multi-level rollups, `GROUPING SETS((a, b), (a), ())` produces "by (a, b)", "by a alone", and "grand total" in one query — a single sort, multiple grouping levels, which is what dashboards usually want.

**Key terms**

- **`GROUP BY`** — collapse rows into groups by the listed columns.
- **`HAVING`** — post-aggregation filter on the grouped rows.
- **`WHERE` vs `HAVING`** — `WHERE` filters input, `HAVING` filters groups; if the predicate doesn't reference an aggregate, prefer `WHERE` (cheaper).
- **`FILTER (WHERE ...)`** — per-aggregate condition; `COUNT(*) FILTER (WHERE status = 'paid')`.
- **`CASE WHEN ... THEN 1 END`** — older syntax for the same idea, less readable but equivalent.
- **`GROUPING SETS`** — multiple grouping levels in one query; one row per (group_key combination).
- **`ROLLUP(a, b, c)`** — shorthand for `GROUPING SETS((a, b, c), (a, b), (a), ())`; hierarchical subtotals.
- **`CUBE(a, b)`** — shorthand for `GROUPING SETS((a, b), (a), (b), ())`; all combinations.
- **`GROUPING(col)`** — function that returns 1 if the column is grouped at the NULL row (subtotal), 0 otherwise; used to label subtotal rows.
- **`COUNT(DISTINCT col)`** — distinct count within a group; more expensive than `COUNT(col)`.
- **`STRING_AGG(col, sep ORDER BY ...)`** — concatenate group values into a string (replaces MySQL's `GROUP_CONCAT`).

**Why interviewers ask this**

Three signals. (1) **`WHERE` vs `HAVING` discipline** — juniors put non-aggregate predicates in `HAVING`, which works but is slower; seniors put them in `WHERE` to filter before the grouping. (2) **Conditional aggregation reflex** — when a prompt says "for each customer, count paid orders, pending orders, and cancelled orders", senior candidates write three `FILTER` clauses in one `SELECT`; juniors write three queries with `UNION` or three correlated subqueries. (3) **Multi-level rollup recognition** — when a prompt says "per region, per category, plus subtotals per region, plus grand total", senior candidates name `GROUPING SETS` or `ROLLUP` immediately; juniors write four queries with `UNION ALL`. The recognition gap is one query vs four — a major perf and readability difference.

**Common confusions**

- "Aggregate aliases work in `WHERE`" — they don't. `WHERE` runs before `SELECT`. Use `HAVING` or wrap in a subquery / CTE.
- "`HAVING` is just a slower `WHERE`" — only if the predicate doesn't reference an aggregate. If it does (`HAVING COUNT(*) > 5`), `WHERE` can't express it.
- "`FILTER` and `CASE WHEN` are different patterns" — same plan, `FILTER` is just cleaner syntax (PG 9.4+, standard SQL).
- "`COUNT(*) FILTER (WHERE x IS NULL)` and `COUNT(x)` are equivalent" — opposite. `COUNT(x)` skips NULLs; the `FILTER` version counts NULLs.
- "`GROUP BY 1` (by column position) is fine" — works but breaks silently when you reorder `SELECT` columns; in production code always use column names.
- "`ROLLUP` and `CUBE` are exotic" — they're the right tool for "per-X with subtotals", which is a standard dashboard requirement.

**What follows from this topic**

`GROUP BY` is the foundation of any aggregate output, which most analytical queries are. Window functions (next two topics) are *not* `GROUP BY` — they keep the row count and add a per-row aggregate column. Pivot (topic 13) is conditional aggregation in disguise. Hierarchical aggregation (topic 14) is `GROUPING SETS` and `ROLLUP`. Top-N per group (topic 12) uses `GROUP BY` only for the count-aggregation variant; for picking a representative row, window functions or `DISTINCT ON` win. If you internalise `GROUP BY` as "collapse rows by key, every non-key column must be aggregated", and `FILTER` as "compute several conditional aggregates in one scan", every later aggregation pattern composes from these primitives.

### Q1. Prompt: "count orders per customer where total > 100". `WHERE` or `HAVING`?

**`WHERE` first, then `GROUP BY`, then `HAVING` only for the count check.** If "where total > 100" filters individual orders, it's `WHERE total > 100` — cheaper because it filters input rows before grouping. If the prompt means "customers whose summed total exceeds 100", that's `HAVING SUM(total) > 100` because the predicate references an aggregate. Senior tell: read the predicate's grain — is it on a row or a group? Use `WHERE` for rows, `HAVING` for groups, never the other way.

### Q2. "For each region, count paid, pending, and cancelled orders separately." Pattern.

**Conditional aggregation with `FILTER`**, one row per region, three columns:

```sql
SELECT region,
       COUNT(*) FILTER (WHERE status = 'paid')     AS paid,
       COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM orders
GROUP BY region;
```

One scan, three counts. The `CASE WHEN status = 'paid' THEN 1 END` variant works identically but reads worse. Avoid the temptation to write three queries joined by `UNION` or three correlated subqueries — both are O(N) per branch but with worse cache behaviour and uglier code. The `FILTER` syntax is also the dead-on pivot template (topic 13).

### Q3. "Total revenue per region, per category, plus subtotals per region, plus a grand total". Pattern.

**`ROLLUP`** — hierarchical subtotals, one query:

```sql
SELECT region, category, SUM(revenue) AS total
FROM sales
GROUP BY ROLLUP(region, category);
```

Returns rows for (region, category), (region, NULL), and (NULL, NULL) — the subtotals per region and the grand total. Use `GROUPING(category)` to label the subtotal rows ("region subtotal") and the grand total. The alternative — four separate queries `UNION`'d — works but is verbose and re-scans the data four times. The recognition signal: "with subtotals" / "rolled up by" → `ROLLUP`; "every combination" → `CUBE`; "specific groupings I list" → `GROUPING SETS`.

### Q4. What's the trap with `COUNT(*)` vs `COUNT(col)` vs `COUNT(DISTINCT col)`?

`COUNT(*)` counts all rows in the group, including NULLs. `COUNT(col)` counts non-NULL values of `col`. `COUNT(DISTINCT col)` counts distinct non-NULL values; significantly more expensive (needs a hash or sort). On a `LEFT JOIN`, `COUNT(*)` overcounts because it counts the NULL-padded rows from the outer side; switch to `COUNT(right_table.id)` to count only matched rows. The senior tell: explicitly say `COUNT(*)` or `COUNT(col)` for clarity, never rely on the reader to infer.

### Q5. "Group by and concatenate the product names per category, comma-separated, alphabetically." Pattern.

**`STRING_AGG(product_name, ', ' ORDER BY product_name)`** — standard SQL (PG 9.0+), replaces MySQL's `GROUP_CONCAT`. The `ORDER BY` clause inside the aggregate controls element order, which is the part candidates often forget. For deduplication: `STRING_AGG(DISTINCT product_name, ', ')`, but distinct + ordered together is more awkward — use a CTE with `DISTINCT` first, then aggregate. Don't write `GROUP_CONCAT` — that's MySQL, and a Postgres interviewer will flag it.

### Q6. Senior interview angle: when do you reach for `GROUPING SETS` over `ROLLUP` or `CUBE`?

**`GROUPING SETS`** when the prompt specifies exactly which groupings you want and they aren't a hierarchy. Example: "report by region alone, by category alone, and by (region, category) combined" — that's `GROUPING SETS((region), (category), (region, category))`. **`ROLLUP`** when the groupings form a hierarchy ("region → category → subcategory"). **`CUBE`** when you want every combination including the grand total. The senior tell is explicitly choosing one over the others — juniors default to `ROLLUP` for everything because it's the most common, but `GROUPING SETS` gives precise control and is the right move for ad-hoc reports.

---

## Subqueries vs CTEs vs Window Functions

### Summary

**What this topic covers**

The structural choice between three ways of composing SQL: nested subqueries, common table expressions (CTEs), and window functions. Sub-patterns: (1) **scalar subquery** — returns a single value, embedded in `SELECT` or `WHERE`; (2) **correlated subquery** — re-evaluated per outer row; usually a red flag for performance; (3) **derived table** — subquery in `FROM`, gives a temporary table to reference; (4) **CTE** — `WITH ... AS (...)` clause, named, can be referenced multiple times; (5) **window function** — per-row aggregate without collapsing rows. The 7 questions cover the recognition signals, the `EXISTS` vs `IN` choice, the PG 12+ CTE inlining change, the readability tradeoff, and the senior-level "which to reach for" decision tree.

**Mental model**

These three forms are often interchangeable on small problems but have different ergonomic and performance characteristics. **Subqueries** (especially correlated ones) are the legacy form — they work but read poorly and the planner can't always optimise them. **CTEs** introduced named intermediate results; before Postgres 12 they were an optimisation fence (the planner couldn't push predicates through), which made them a perf hazard for naive use. In PG 12+ CTEs are inlined by default, eliminating the fence, but you can force materialisation with `WITH foo AS MATERIALIZED (...)` when you want the fence back (e.g. when the CTE is expensive and referenced multiple times). **Window functions** are the modern move for "per-row aggregate alongside row data" — they don't collapse rows like `GROUP BY` does, they add an aggregate column computed over a window of rows. The senior recognition tree: (1) if the result needs per-row aggregates, use window functions; (2) if you need to compose multi-step transformations and the intermediate names aid readability, use CTEs; (3) if you need a single scalar value embedded inline, use a scalar subquery; (4) avoid correlated subqueries unless the planner can fold them into a join — they're usually a sign that a window function or `LATERAL` is the right move.

**Key terms**

- **Scalar subquery** — returns one value; used in `SELECT` or `WHERE`.
- **Correlated subquery** — references the outer query's columns; re-evaluated per outer row in the naive plan.
- **Derived table** — subquery in `FROM` clause, given an alias.
- **CTE / `WITH` clause** — named intermediate result, can be referenced multiple times.
- **`MATERIALIZED` / `NOT MATERIALIZED`** — Postgres 12+ hint to control CTE inlining.
- **Recursive CTE** — `WITH RECURSIVE foo AS (... UNION ALL ...)`; for hierarchies and graphs.
- **Window function** — `func() OVER (PARTITION BY ... ORDER BY ... [frame])`; per-row aggregate.
- **`EXISTS` vs `IN`** — semantically similar for existence checks; `EXISTS` better when the subquery references the outer (semi-join); `IN` better for a simple set membership against a small list.
- **CTE optimisation fence** — pre-PG 12, CTEs materialised; post-PG 12, they inline by default.
- **`LATERAL`** — correlated subquery in `FROM`; the cleanest form for per-row dependent sets.

**Why interviewers ask this**

Three signals. (1) **Readability vs performance** — senior candidates choose CTEs for multi-step queries because the named steps document the pipeline; juniors deeply nest subqueries that no one can read. (2) **Window function reflex** — for "compute X per row alongside the row data", window functions are the dead-on answer; juniors reach for correlated subqueries that are O(N²). (3) **PG 12+ awareness** — the CTE-as-optimisation-fence rule changed in PG 12; senior Postgres candidates know this and use `MATERIALIZED` explicitly when they want the fence (or when they want to force re-use without re-execution).

**Common confusions**

- "CTEs are always slower than subqueries" — true pre-PG 12, false in PG 12+ unless you use `MATERIALIZED`.
- "`EXISTS` and `IN` are the same" — close but not always. `EXISTS` handles NULLs cleanly; `NOT IN` with a nullable subquery returns no rows.
- "Window functions replace `GROUP BY`" — they replace correlated-subquery-style per-row aggregates, not `GROUP BY`. `GROUP BY` collapses rows; window functions don't.
- "Scalar subqueries in `SELECT` are slow" — only if uncorrelated and the planner can't fold them; a single-value `(SELECT MAX(x) FROM t)` is fine.
- "Derived tables and CTEs are different" — semantically they're equivalent; CTEs just give the temporary a name and can be referenced multiple times.
- "Correlated subqueries are always bad" — usually slower than the alternatives, but on small N with the right index they're fine; the senior tell is checking the plan.

**What follows from this topic**

This is the structural foundation for every multi-step SQL pattern. Window functions (topics 6-8) are the deepest expansion. Recursive CTEs (topic 9) are a special variant of `WITH RECURSIVE`. Top-N per group (topic 12) uses CTEs to compose window function output. Cohort analysis (topic 16) uses CTEs to layer "compute signup cohort → compute action by week-offset → pivot to matrix". If you internalise the four-form decision tree (scalar / correlated / CTE / window), you'll always reach for the cleanest form first and only fall back to correlated subqueries when the planner specifically needs them.

### Q1. When do you reach for a CTE vs a derived table vs a window function?

**CTE** when you have a multi-step pipeline and naming the intermediate result aids readability; the standard move for any query longer than 20 lines. **Derived table (subquery in `FROM`)** when you need exactly one intermediate result and a name doesn't add value; common for "select aggregate from (select ... from t group by ...)". **Window function** when you want a per-row aggregate (running total, rank, lag) without collapsing rows. The decision is structural: scalars and existence checks go inline; multi-step compositions go in CTEs; per-row aggregates go in window functions.

### Q2. `EXISTS` vs `IN` — when does each win?

**`EXISTS`** when the subquery references the outer query's columns (semi-join); the planner can short-circuit on the first match per outer row. Also handles NULLs cleanly. **`IN`** for membership against a known list of values (`WHERE country IN ('US', 'UK', 'DE')`) — clearer syntax than `EXISTS` against a constants table. For "user_id appears in another table", `EXISTS` and `IN` are semantically equivalent in modern Postgres and the planner produces the same plan. **Never `NOT IN`** when the subquery can return NULLs — `NOT IN` with any NULL element returns unknown, dropping all rows. Use `NOT EXISTS` for safe anti-joins.

### Q3. PG 12+ changed CTE behaviour. What's the rule?

Before PG 12, `WITH foo AS (...)` was a materialisation fence — the inner query ran fully, its result was stored, and the outer query couldn't push predicates through. That made CTEs a perf hazard when you used them for clarity. In PG 12+, CTEs are **inlined by default** (same as derived tables), eliminating the fence. To force the fence (e.g. for an expensive CTE referenced multiple times where you want one execution), use `WITH foo AS MATERIALIZED (...)`. The senior tell: knowing the inlining rule, and explicitly choosing `MATERIALIZED` when the CTE is expensive *and* referenced more than once.

### Q4. Correlated subquery vs window function for "running total per customer". Pick.

**Window function**: `SUM(amount) OVER (PARTITION BY customer_id ORDER BY ts)`. Single sort, single pass, O(N log N). The correlated-subquery alternative `(SELECT SUM(amount) FROM orders o2 WHERE o2.customer_id = o1.customer_id AND o2.ts <= o1.ts)` is O(N²) per customer in the worst case, even with an index. The window function is the dead-on signal for any per-row running aggregate; reaching for a correlated subquery here is a junior tell.

### Q5. "Inside the `SELECT`, embed the count of orders for the customer." Scalar subquery or window function?

Either works, but **window function** is usually cleaner: `COUNT(*) OVER (PARTITION BY customer_id)` in a query over orders, returning order rows annotated with customer's total count. **Scalar subquery** version: `(SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = o.customer_id)` — equivalent semantically, can be slower if the planner doesn't fold it into a hash join. The window-function version is also reusable: you can add more `OVER (PARTITION BY customer_id)` aggregates without re-querying. The scalar-subquery version is the right move when the embedding is a one-off and the subquery has a different `FROM` clause (e.g. embedding a customer-level total from a separate table).

### Q6. When does `LATERAL` beat a CTE + window function?

When you need "for each row on the left, a *set* of correlated rows from the right", `LATERAL` is the cleanest form. Example: "for each customer, return their three most recent orders as separate rows". A CTE-with-`ROW_NUMBER` works but sorts the entire orders table; `LATERAL` does many small index-aligned lookups. The recognition signal: `LATERAL` is the right reach when the right side is *correlated* with the left and returns a *set* (not a scalar). For scalar correlation (one value per left row), a scalar subquery or window function is usually cleaner.

### Q7. Senior interview angle: structurally rewrite a deeply nested 4-level subquery as a CTE chain. Why is the CTE chain better?

```sql
-- Nested form (hard to read):
SELECT ... FROM (
  SELECT ... FROM (
    SELECT ... FROM (
      SELECT ... FROM raw_events
    )
  )
)

-- CTE chain (read top-down):
WITH parsed AS (SELECT ... FROM raw_events),
     filtered AS (SELECT ... FROM parsed WHERE ...),
     joined AS (SELECT ... FROM filtered JOIN dims ON ...),
     ranked AS (SELECT ..., ROW_NUMBER() OVER (...) FROM joined)
SELECT * FROM ranked WHERE rn = 1;
```

The CTE chain is better because (1) **named steps** — each CTE has a name that documents what it does; (2) **top-down reading** — the data flows top-down, matching how you'd narrate the query verbally; (3) **debuggability** — you can comment out the final `SELECT` and run any intermediate CTE in isolation; (4) **no perf penalty in PG 12+** because CTEs inline by default. The nested form forces the reader to parse inside-out, which is cognitively expensive and obscures intent. Senior code uses CTE chains for any query over ~20 lines.

---

## Window Functions — Ranking & Tie-Breaks

### Summary

**What this topic covers**

The ranking family of window functions: `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, `NTILE(n)`, `PERCENT_RANK()`, `CUME_DIST()`. These functions assign a rank to each row within a partition based on the `ORDER BY` clause inside the `OVER()` window. Sub-patterns: (1) **top-N per group** — `ROW_NUMBER() = N`; (2) **dense vs sparse ranking with ties** — `RANK` leaves gaps, `DENSE_RANK` doesn't; (3) **bucket assignment** — `NTILE(4)` for quartiles, `NTILE(100)` for percentiles; (4) **deduplication via `ROW_NUMBER = 1`** — pick one representative per group when duplicates exist; (5) **rank-based filtering** — "top 10%" via `PERCENT_RANK() <= 0.1`. The 6 questions cover the templates, the tie-break semantics, the senior-level "which ranking function for this prompt" decision, and the trap of using `WHERE rn = N` outside a subquery (window functions can't be filtered in the same `SELECT`).

**Mental model**

Ranking window functions all answer "what position is this row within its partition", but they answer differently in the presence of ties. Imagine three rows with salaries 100, 100, 90 partitioned by department, ordered by salary descending: `ROW_NUMBER()` gives 1, 2, 3 (ties broken arbitrarily — unstable, depends on storage order); `RANK()` gives 1, 1, 3 (ties share a rank, then the next gets the count-skipped position); `DENSE_RANK()` gives 1, 1, 2 (ties share, no skip). The choice depends on the prompt: "second-highest distinct salary" → `DENSE_RANK = 2`; "second row by salary, ties broken by id" → `ROW_NUMBER = 2` with `ORDER BY salary DESC, id`; "the top 25% earners" → `NTILE(4) = 1`. Window functions are evaluated *after* `WHERE` and `GROUP BY` but *before* `ORDER BY` and `LIMIT`, which means you cannot `WHERE rn = 1` — the alias isn't visible yet. The senior workaround is to wrap the ranked query in a CTE or subquery and filter on the outer level. The performance shape: a window function does one sort per partition; if the partition is large, it's expensive. The right index (`(partition_key, order_key)`) lets the planner skip the sort entirely.

**Key terms**

- **`ROW_NUMBER()`** — strict 1, 2, 3, ... within partition; ties broken arbitrarily.
- **`RANK()`** — ties share a rank; next rank skips (1, 1, 3, 4).
- **`DENSE_RANK()`** — ties share a rank; next rank is consecutive (1, 1, 2, 3).
- **`NTILE(n)`** — split partition into `n` buckets of as-equal size as possible; returns bucket number.
- **`PERCENT_RANK()`** — (rank - 1) / (count - 1); 0 for first, 1 for last; nuanced with ties.
- **`CUME_DIST()`** — cumulative distribution; fraction of rows with value ≤ current row.
- **Partition** — the `PARTITION BY` clause; groups within which the rank resets.
- **Order key** — the `ORDER BY` inside `OVER()`; the column(s) the rank is based on.
- **Tie-break columns** — additional `ORDER BY` columns to make ranking deterministic.
- **Stable vs unstable ranking** — `ROW_NUMBER` without tie-break columns is unstable; `RANK`/`DENSE_RANK` are stable in the rank value but unstable in row order.
- **Top-N per group** — `WHERE rn <= N` after `ROW_NUMBER() OVER (PARTITION BY group ORDER BY metric DESC)`.

**Why interviewers ask this**

Three signals. (1) **Tie-break awareness** — most ranking prompts hide a tie-break decision; senior candidates ask "how should we handle ties?" before writing the query, juniors pick one arbitrarily. (2) **`ROW_NUMBER` vs `RANK` vs `DENSE_RANK` discipline** — picking the wrong one returns subtly wrong results that pass the obvious test cases. Senior candidates explain the tie semantics in one sentence. (3) **Top-N per group reflex** — "the top 3 per category" is a dead-on `ROW_NUMBER` problem, and reaching for it (or `DISTINCT ON` for top-1) within 10 seconds is the senior tell. Juniors reach for self-joins or correlated subqueries.

**Common confusions**

- "`ROW_NUMBER` and `RANK` are interchangeable" — they're not; ties make them diverge, and prompts almost always have ties in the wild.
- "I can filter `WHERE row_number_alias = 1`" — no; window functions are evaluated after `WHERE`. Wrap in a CTE / subquery.
- "`NTILE(4)` always gives quartiles of equal size" — close; if the partition size doesn't divide evenly, earlier buckets get one extra row.
- "`PERCENT_RANK` and `CUME_DIST` are the same" — different definitions; `PERCENT_RANK` ignores the current row's tie group's size, `CUME_DIST` includes it.
- "`PARTITION BY` is required" — optional; without it, the whole result is one partition.
- "Rank ordering is stable across runs" — only if `ORDER BY` is deterministic. `ROW_NUMBER` with an under-specified `ORDER BY` returns different ranks on different runs.

**What follows from this topic**

Ranking window functions are the foundation for top-N per group (topic 12), gaps & islands (topic 10 — `ROW_NUMBER` minus row position is the canonical trick), and many deduplication patterns. The frame clause (topic 8) doesn't apply to ranking functions — they always operate on the whole partition. Analytics window functions (next topic) — `LAG`, `LEAD`, `FIRST_VALUE`, `LAST_VALUE` — pair with ranking for "what was the previous row, in rank order" lookups. If you internalise ranking as "assign a position within a partition, choose function by tie semantics", everything that uses it composes naturally.

### Q1. "Return the second-highest salary per department." Pick the ranking function and justify.

**`DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) = 2`** — wrapped in a CTE since you can't filter on the alias directly. `DENSE_RANK` is the right choice because "second-highest" usually means "second distinct salary value"; if two people tie at the top, both are #1, and the next person is #2. `RANK` would skip and the next person becomes #3 (wrong). `ROW_NUMBER` breaks the top tie arbitrarily — also wrong. Senior tell: name all three, explain the tie semantics, pick `DENSE_RANK` explicitly.

### Q2. "Return the top 3 products per category by revenue." Pattern.

**`ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC) <= 3`**, wrapped in a CTE:

```sql
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC) AS rn
  FROM products
)
SELECT * FROM ranked WHERE rn <= 3;
```

If you wanted "top 3 distinct revenue values" (so ties at #3 are all included), switch to `DENSE_RANK`. The alternative is `LATERAL`: `SELECT * FROM categories c CROSS JOIN LATERAL (SELECT * FROM products WHERE category = c.id ORDER BY revenue DESC LIMIT 3) p`. `LATERAL` is faster when there's a good `(category, revenue DESC)` index; `ROW_NUMBER` is steadier when there isn't.

### Q3. "Bucket users into quartiles by total spend." Pattern.

**`NTILE(4) OVER (ORDER BY total_spend DESC)`**. The result is 1-4, with 1 being the highest-spending quartile. Bucket sizes are within 1 row of each other. For percentiles (1-100): `NTILE(100)`. The trap: `NTILE` doesn't handle ties at bucket boundaries gracefully — two users with the same spend can end up in different buckets. For precise tie handling, use `PERCENT_RANK()` and filter `WHERE PERCENT_RANK() <= 0.25`. The senior tell: `NTILE` for approximate, `PERCENT_RANK` / `CUME_DIST` for tie-correct.

### Q4. Why can't you write `WHERE row_number_alias = 1` directly?

The SQL execution order is `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT`. Window functions are evaluated in `SELECT`, which is *after* `WHERE`. So at the moment `WHERE` runs, `row_number_alias` doesn't exist yet. The standard workaround is wrapping in a CTE or derived table and filtering on the outer level. Some engines (not Postgres) support `QUALIFY` for this case: `SELECT ... QUALIFY ROW_NUMBER() OVER (...) = 1` — clean, but it's not standard SQL and Postgres doesn't have it. In Postgres, always wrap in a CTE.

### Q5. "Return all rows tied for the highest salary per department." Pattern.

**`RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) = 1`**, wrapped in a CTE. `RANK` returns 1 for every tied top earner. `DENSE_RANK = 1` works identically here (the difference between `RANK` and `DENSE_RANK` only matters for #2+). `ROW_NUMBER = 1` would return only one row per department, dropping the others — wrong. Senior tell: when the prompt says "all tied" or "every row at the top", `RANK = 1` is the dead-on signal.

### Q6. Senior interview angle: deduplicate a table keeping the most recent row per natural key.

**`ROW_NUMBER() OVER (PARTITION BY natural_key ORDER BY ts DESC) = 1`**, wrapped in a CTE, filter `WHERE rn = 1`. This is the canonical dedup pattern when the table accumulates updates as appends. Alternative: `DISTINCT ON (natural_key) ... ORDER BY natural_key, ts DESC` in Postgres — shorter, equivalent. For batch deletion of duplicates in place: `DELETE FROM t WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY natural_key ORDER BY ts DESC) AS rn FROM t) WHERE rn > 1)`. The senior tell is recognising "keep the most recent per key" as a `ROW_NUMBER = 1` problem and choosing `DISTINCT ON` for the SELECT case, `ROW_NUMBER` for the DELETE case.

---

## Window Functions — Analytics

### Summary

**What this topic covers**

The analytics family of window functions — the ones that don't rank but look across rows in a window: `LAG(col, offset, default)`, `LEAD(col, offset, default)`, `FIRST_VALUE(col)`, `LAST_VALUE(col)`, `NTH_VALUE(col, n)`, plus the aggregate window functions `SUM`/`AVG`/`COUNT`/`MIN`/`MAX` with `OVER (...)`. Sub-patterns: (1) **previous / next row by group** — `LAG(col) OVER (PARTITION BY group ORDER BY ts)`; (2) **first / last value in window** — `FIRST_VALUE` and `LAST_VALUE`; the `LAST_VALUE` trap with default frame; (3) **running aggregate** — `SUM(x) OVER (PARTITION BY group ORDER BY ts)`; (4) **delta between rows** — `col - LAG(col)`; (5) **fill-forward** — `COALESCE(col, LAG(col) ...)` (limited; requires `ignore nulls` in real engines or a recursive workaround in Postgres). The 6 questions cover the templates, the default-frame trap, and the senior-level "when to reach for `LAG` vs a self-join".

**Mental model**

`LAG` and `LEAD` are the dead-on signal for "compare this row to the previous / next row in the same group". They're equivalent to a self-join `ON a.id = b.id - 1` (or a partition-aware version), but they're one line of SQL instead of three, and the planner produces one sort instead of a join. `FIRST_VALUE` and `LAST_VALUE` are subtler: they return the value from the first / last row in the *window frame*, which has a default that surprises people. The default frame for ordered windows is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which means `LAST_VALUE` returns the current row's value — not the last row in the partition. To get the actual last row, you need `LAST_VALUE(col) OVER (... ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)`. This is the most-cited gotcha in window function interviews. The aggregate-as-window form (`SUM(x) OVER (...)`) is the foundation of running totals and rolling averages. The senior insight is that **any "compare row to neighbour" computation should be a window function**, not a self-join — the self-join version is verbose and the planner doesn't always produce the best plan for it.

**Key terms**

- **`LAG(col, offset, default)`** — value from the row `offset` rows back; `default` if no such row.
- **`LEAD(col, offset, default)`** — value from the row `offset` rows forward.
- **`FIRST_VALUE(col)`** — value of `col` in the first row of the window frame.
- **`LAST_VALUE(col)`** — value of `col` in the last row of the window frame; *frame default surprises*.
- **`NTH_VALUE(col, n)`** — value of `col` in the nth row of the frame.
- **`OVER (PARTITION BY ... ORDER BY ... [frame])`** — window spec; partition + order + optional frame.
- **Default frame** — `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` when `ORDER BY` is specified.
- **Running aggregate** — `SUM(x) OVER (PARTITION BY g ORDER BY ts)` — cumulative sum within each group.
- **Delta between rows** — `col - LAG(col)`; common for "change since previous".
- **Fill-forward** — propagate a non-NULL value forward; Postgres lacks `IGNORE NULLS` so the clean version requires a recursive CTE or `MAX(... ) OVER` trick.
- **`ROWS` vs `RANGE`** — `ROWS BETWEEN N PRECEDING` is exact-row count; `RANGE BETWEEN N PRECEDING` uses value-based, treating ties as one row.

**Why interviewers ask this**

Three signals. (1) **`LAG` reflex** — when the prompt says "compare to previous", senior candidates write `LAG` in 5 seconds; juniors write self-joins. (2) **Default-frame awareness** — the `LAST_VALUE` gotcha is the canonical test for "do you know what frame is applied by default?" Candidates who confidently write `LAST_VALUE(col) OVER (...)` without overriding the frame produce wrong results and don't notice. (3) **Window aggregation reflex** — running totals, rolling averages, and per-partition counts are all window-aggregate problems; reaching for `SUM(x) OVER (PARTITION BY ... ORDER BY ...)` instead of correlated subqueries is the senior tell.

**Common confusions**

- "`LAST_VALUE` returns the last row in the partition" — only with explicit `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.
- "`LAG` and `LEAD` work without `ORDER BY` in the window" — no; they require `ORDER BY` to define "previous" / "next".
- "Default frame is `ROWS UNBOUNDED PRECEDING`" — it's `RANGE`, which behaves differently when ties exist on the `ORDER BY` column.
- "`LAG(col, 0)` returns the current row" — true (with offset 0) but useless; the point of `LAG` is offset ≥ 1.
- "`FIRST_VALUE` always returns the partition's first row" — only with `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`; with the default frame it returns the partition's first row up to the current row, which equals the partition's first row anyway, so for this function the default is "harmless".
- "Window aggregates collapse rows like `GROUP BY`" — they don't; they add a column, preserving row count.

**What follows from this topic**

Analytics window functions feed into gaps & islands (topic 10) where `LAG` detects boundaries, sessionization (topic 11) where `LAG` plus a time threshold defines sessions, temporal queries (topic 17) where `LAG`/`LEAD` build "since last X" computations, and time-series patterns generally. The frame clause (next topic) is the precise control over the row range a window function operates on. If you internalise window functions as "compare row to neighbours within a partition", the rest of the patterns that use them are mechanical.

### Q1. "For each transaction, the difference from the previous transaction by the same customer." Pattern.

**`amount - LAG(amount) OVER (PARTITION BY customer_id ORDER BY ts)`** — one line. The `LAG` returns the previous row's amount in the partition; the subtraction is the delta. For the first transaction per customer, `LAG` returns NULL, which propagates to the delta — wrap in `COALESCE(amount - LAG(amount) OVER (...), 0)` if you want zero for the first. Self-join alternative: `LEFT JOIN transactions t2 ON t2.customer_id = t.customer_id AND t2.ts = (SELECT MAX(ts) FROM transactions t3 WHERE t3.customer_id = t.customer_id AND t3.ts < t.ts)` — verbose and O(N²) in the planner's worst case. Reach for `LAG`.

### Q2. The `LAST_VALUE` trap. What goes wrong with `LAST_VALUE(salary) OVER (PARTITION BY dept_id ORDER BY hire_date)` and how do you fix it?

The default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, so `LAST_VALUE` returns the salary of the current row — not the last salary in the partition. Fix: override the frame to span the whole partition:

```sql
LAST_VALUE(salary) OVER (
  PARTITION BY dept_id
  ORDER BY hire_date
  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
)
```

Or equivalently, use `FIRST_VALUE(salary) OVER (PARTITION BY dept_id ORDER BY hire_date DESC)` — flip the sort direction and use `FIRST_VALUE`, which doesn't need the frame override. The latter is the cleaner pattern in practice.

### Q3. "Running total of revenue per customer, ordered by date." Pattern.

**`SUM(revenue) OVER (PARTITION BY customer_id ORDER BY order_date)`** — the canonical running total. The default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which gives "from the start to here" — exactly the running total semantic. Trap: if two orders share the same `order_date`, the `RANGE`-based default groups them at the same logical row, so both get the same running total (the post-group total). For exact-per-row, use `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. The senior tell: pick `ROWS` vs `RANGE` explicitly when ties on the order key matter.

### Q4. "Detect price drops — flag rows where the price decreased from the previous day." Pattern.

**`LAG(price) OVER (PARTITION BY product_id ORDER BY day)`** and compare:

```sql
SELECT product_id, day, price,
       CASE WHEN price < LAG(price) OVER (PARTITION BY product_id ORDER BY day)
            THEN 1 ELSE 0 END AS price_dropped
FROM prices;
```

The recognition signal is "compared to previous day". For multi-day drops (e.g. "dropped from 5 days ago"), use `LAG(price, 5)`. For "dropped at any point in the trailing window", use a min over the trailing window: `price < MIN(price) OVER (PARTITION BY product_id ORDER BY day ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING)`.

### Q5. "For each row, the first and last value of category in the partition." Pattern + the frame fix.

**`FIRST_VALUE(category) OVER (PARTITION BY group_id ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)`** and similarly `LAST_VALUE`. Without the explicit frame, `LAST_VALUE` returns the current row's value due to the default frame. With the frame, both return the actual first and last in the partition. Alternative for `LAST_VALUE`: `FIRST_VALUE(category) OVER (PARTITION BY group_id ORDER BY ts DESC)` — sort descending and take first, no frame needed. This is the idiom most experienced engineers use because it sidesteps the frame trap entirely.

### Q6. Senior interview angle: fill-forward NULL values within a partition (Postgres doesn't have `IGNORE NULLS`).

The clean form in other engines is `LAST_VALUE(col IGNORE NULLS) OVER (...)`, but Postgres doesn't support that yet (as of 17). The workaround: use a `MAX` over the partition-trailing window with a clever ordering trick. The most common pattern: number each non-NULL value's group with `COUNT(col) OVER (ORDER BY ts)` — this only increments at non-NULL rows, so rows after a non-NULL share the same count value. Then `FIRST_VALUE(col) OVER (PARTITION BY that_count ORDER BY ts)` fills the value forward. The senior tell: knowing this workaround off-hand, articulating why the obvious `LAST_VALUE` doesn't work (the default frame doesn't skip NULLs), and naming `IGNORE NULLS` as the feature you'd want.

---

## Window Frames

### Summary

**What this topic covers**

The frame clause — the third part of `OVER (PARTITION BY ... ORDER BY ... [frame])` — which precisely controls the row range a window function operates on. Sub-patterns: (1) **`ROWS BETWEEN N PRECEDING AND CURRENT ROW`** — exact-row trailing window, used for moving averages and rolling sums; (2) **`RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW`** — value-based trailing window, used for time-based rolling computations; (3) **`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`** — running aggregate (cumulative); (4) **`ROWS BETWEEN N PRECEDING AND M FOLLOWING`** — centred window (e.g. 3-day moving average centred on each row); (5) **`GROUPS BETWEEN N PRECEDING AND CURRENT ROW`** — group-based frame, for peer-aware computations. The 5 questions cover the templates, the `ROWS` vs `RANGE` vs `GROUPS` distinction, the time-based frame syntax, and the senior-level recognition of which frame matches the prompt.

**Mental model**

The frame clause is the precise specification of "which other rows does this row see when the window function evaluates". `ROWS` is exact-row counting — `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` is "the 6 rows before plus the current row = 7 rows total". `RANGE` is value-based — `RANGE BETWEEN '7 days' PRECEDING AND CURRENT ROW` is "rows where the order-by value is within 7 days of the current row". `GROUPS` is peer-based — useful when multiple rows share an order-by value and you want them treated as one logical position. The default frame, when you specify `ORDER BY` without a frame, is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. This is fine for `SUM` / running totals but wrong for `LAST_VALUE` (returns current row instead of partition end). When you don't specify `ORDER BY`, the frame defaults to the whole partition. The senior insight is that **`ROWS` and `RANGE` produce different results when ties exist on the order-by column**: `ROWS` treats them as distinct rows in sequence; `RANGE` treats them as one logical position. For unique timestamps the distinction doesn't matter; for date-grain data with multiple rows per date, it matters a lot. Pick explicitly.

**Key terms**

- **Frame clause** — the optional third part of `OVER`: `ROWS|RANGE|GROUPS BETWEEN ... AND ...`.
- **`ROWS`** — exact row count; "5 preceding" means 5 rows back.
- **`RANGE`** — value-based; "5 preceding" means rows where order-by value is within 5 of current.
- **`GROUPS`** — peer-based; treats ties on the order-by column as one group.
- **`UNBOUNDED PRECEDING`** — from the start of the partition.
- **`UNBOUNDED FOLLOWING`** — to the end of the partition.
- **`CURRENT ROW`** — the row being evaluated.
- **`N PRECEDING` / `N FOLLOWING`** — `N` rows / `N` values back / forward.
- **`INTERVAL '7 days' PRECEDING`** — Postgres-specific syntax for time-based ranges.
- **Default frame** — `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` when `ORDER BY` is specified; whole partition when not.
- **Trailing window** — `ROWS BETWEEN N PRECEDING AND CURRENT ROW`; the standard moving-window form.

**Why interviewers ask this**

Three signals. (1) **Frame literacy** — most candidates know `OVER (PARTITION BY ... ORDER BY ...)` but stumble on the frame clause; senior candidates write frames explicitly when ties or time-based windows matter. (2) **`ROWS` vs `RANGE` discipline** — the ties-on-order-key gotcha (where `RANGE` produces unexpected per-row results) is a canonical test; senior candidates name the distinction. (3) **Time-based rolling computation** — "rolling 7-day average" is a frequent prompt; the Postgres-specific `INTERVAL '7 days' PRECEDING` syntax is the cleanest form, but only works with `RANGE` (not `ROWS`). Recognising that and choosing it is a Postgres-staff signal.

**Common confusions**

- "Default frame is `ROWS UNBOUNDED PRECEDING`" — it's `RANGE`, which matters when ties exist.
- "`ROWS BETWEEN 7 PRECEDING AND CURRENT ROW` gives 7 rows" — it gives 8 (7 preceding plus current).
- "`RANGE BETWEEN 7 PRECEDING AND CURRENT ROW` works on dates" — only with `INTERVAL` syntax: `RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW`.
- "I can use `ROWS BETWEEN '7 days' PRECEDING`" — no; `ROWS` is integer-count only, not interval-based.
- "`GROUPS` is exotic and never needed" — it's the right move when peers should be treated as one logical position (e.g. ranking with peer awareness).
- "The frame applies to ranking functions like `ROW_NUMBER`" — it doesn't; ranking functions ignore the frame and operate on the whole partition.

**What follows from this topic**

Frames are the precision instrument for window-aggregate computations. They underpin rolling averages, trailing sums, "max in trailing N days", and any "look back / look forward" computation. The `RANGE BETWEEN INTERVAL` syntax is Postgres-specific and recurs in temporal queries (topic 17) and statistical SQL (topic 18). For ranking functions the frame is moot — they always see the full partition. If you internalise the frame as "precise control over which other rows the window function sees", the rest of the patterns that use it become straightforward.

### Q1. "Compute the 7-day rolling average of daily revenue." Pattern.

**`AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`**. Note: `6 PRECEDING AND CURRENT ROW` is 7 rows total. The trap is writing `7 PRECEDING` and getting 8 rows. If you have multiple rows per day (e.g. per-product), `PARTITION BY product_id ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` per product, or aggregate to daily first. For time-based instead of row-based ("rolling 7 calendar days, regardless of how many rows per day"), use `RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW` — value-based on the date column.

### Q2. `ROWS` vs `RANGE` — when does the choice matter?

When ties exist on the `ORDER BY` column. Example: 5 rows on `2024-01-01` and 3 rows on `2024-01-02`, ordered by date. `ROWS BETWEEN 1 PRECEDING AND CURRENT ROW` treats each row as a distinct position — so for a row on `2024-01-02`, the "1 preceding" is another row on `2024-01-02` (if exists) or one of the `2024-01-01` rows. `RANGE BETWEEN 1 PRECEDING AND CURRENT ROW` treats all rows with the same `ORDER BY` value as one position — so the same row on `2024-01-02` sees all rows from `2024-01-01` and `2024-01-02` as its window. For analytics on date-grain data, `RANGE` is usually the right semantic; for exact-row windows (e.g. moving median over 5 transactions), `ROWS` is right.

### Q3. "Rolling 30-day sum where some days have no rows." Pattern.

**`RANGE BETWEEN INTERVAL '30 days' PRECEDING AND CURRENT ROW`** — value-based on the date column, so missing days don't break the window. With `ROWS`, missing days would shrink the window to "the most recent N rows regardless of date", which is the wrong semantic. The senior recognition: any "rolling N calendar days" prompt is `RANGE BETWEEN INTERVAL`, not `ROWS BETWEEN N PRECEDING`.

### Q4. "Centred 5-day moving average — 2 days before, current, 2 days after." Pattern.

**`AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING)`** — symmetric frame around the current row. For time-based: `RANGE BETWEEN INTERVAL '2 days' PRECEDING AND INTERVAL '2 days' FOLLOWING`. At the partition edges (first 2 days, last 2 days) the window is truncated. The senior trap: if you need *only* full 5-day windows (skip edges), wrap in a CTE and filter `WHERE COUNT(*) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING) = 5`.

### Q5. Senior interview angle: why doesn't the frame clause apply to `RANK()` and `ROW_NUMBER()`?

Ranking functions are defined to operate over the entire partition — their semantics are "what's my position among all peer rows", which intrinsically requires seeing the whole partition. The frame clause is syntactically allowed in some engines for ranking functions but ignored. The senior tell is naming this constraint explicitly: "ranking functions ignore the frame; if you need a frame-aware rank, you'd compute it via a window aggregate, e.g. `COUNT(*) OVER (ORDER BY x ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` which is a rank-like running count". Window aggregates respect the frame; rankings don't.

### Q6. "Running max over the trailing 100 rows per customer." Frame choice.

**`MAX(value) OVER (PARTITION BY customer_id ORDER BY ts ROWS BETWEEN 99 PRECEDING AND CURRENT ROW)`** — 99 preceding plus current = 100 rows total. The trap is writing `100 PRECEDING` and getting 101. For "trailing 100 calendar days" use `RANGE BETWEEN INTERVAL '99 days' PRECEDING AND CURRENT ROW`. The senior tell: explicit frame, off-by-one awareness.

---

## Recursive CTEs as Graph Algorithms

### Summary

**What this topic covers**

The recursive CTE pattern (`WITH RECURSIVE foo AS (... UNION ALL ...)`) used to walk hierarchies and graphs in pure SQL. Sub-patterns: (1) **hierarchical descent** — walk children of a node down to leaves; (2) **hierarchical ascent** — walk parents up to root; (3) **path enumeration** — collect the path from root to node as an array; (4) **transitive closure** — all reachable nodes from a starting node; (5) **shortest path** — BFS-style with level tracking; (6) **cycle detection** — Postgres's `CYCLE` clause or manual visited-array tracking. The 6 questions cover the templates, the base-case + recursive-case structure, the `CYCLE` clause introduced in PG 14, the performance trap of unbounded recursion, and the senior-level "when is SQL the wrong tool".

**Mental model**

A recursive CTE has two parts: a **base case** (the seed query that runs once) and a **recursive case** (joined to the CTE's own intermediate output, runs repeatedly until it returns no new rows). The pattern: `WITH RECURSIVE foo AS (SELECT ... FROM base WHERE ... UNION ALL SELECT ... FROM next JOIN foo ON ...)`. Each iteration uses the previous iteration's output as the join input. The recursion stops when an iteration returns zero rows. This is BFS over the implicit graph defined by the recursive-case join condition. For trees, it's bounded by tree depth; for graphs with cycles, it's unbounded unless you track visited nodes. The senior insight is that **a recursive CTE is BFS** — each iteration is a level, and adding `level + 1` as a column makes it explicit. For depth-first traversal, you'd need to recurse on a single path at a time, which SQL doesn't naturally support — that's where the language strains. The classic graph problems (shortest path in unweighted graph, reachability, ancestors, descendants) are all clean recursive CTEs. Anything that needs heap-based priority (Dijkstra) or path-state (TSP) is past SQL's comfort zone — switch to a real language.

**Key terms**

- **`WITH RECURSIVE`** — the keyword that enables self-referential CTEs.
- **Base case (anchor member)** — the non-recursive `SELECT` that seeds the recursion.
- **Recursive case (recursive member)** — the `SELECT` that joins to the CTE's own intermediate output.
- **`UNION ALL` vs `UNION`** — almost always `UNION ALL` for performance; `UNION` deduplicates each iteration, which compounds.
- **Visited set** — track explored nodes via an array column to prevent infinite loops in cyclic graphs.
- **`CYCLE ... SET ... USING ...`** — PG 14+ built-in cycle detection clause.
- **`SEARCH BREADTH FIRST BY ... SET ...`** — PG 14+ clause to control traversal order.
- **Path accumulation** — `array_append(parent_path, current_id)` to collect path from root.
- **Termination** — recursion stops when the recursive case returns zero rows.
- **Depth bound** — `WHERE level < 100` is a practical safety belt to bound runaway recursion.

**Why interviewers ask this**

Three signals. (1) **Hierarchy recognition** — the moment a prompt involves a self-referencing table (parent/child, manager/employee, category/subcategory), senior candidates write `WITH RECURSIVE` in 10 seconds; juniors write N self-joins for N levels, which doesn't work for unknown depths. (2) **Cycle awareness** — on org charts with corrupted data or graphs with cycles, recursion can run forever. Senior candidates either use `CYCLE` or track a visited array; juniors don't think about it until the query OOMs. (3) **Knowing the limits** — recursive CTEs are great for BFS-style traversal but bad for shortest weighted path, DP, and anything stateful. Senior candidates name when to switch to application code; juniors fight SQL.

**Common confusions**

- "`UNION` vs `UNION ALL` doesn't matter" — `UNION ALL` is much faster; `UNION` deduplicates each iteration.
- "Recursive CTEs are DFS" — they're BFS by default; each iteration is a level.
- "I don't need cycle detection for trees" — true only if the data is guaranteed cycle-free; corrupted production data is the bug you ship.
- "`CYCLE` is standard SQL" — it's standard from SQL:2016 but only landed in Postgres 14.
- "Recursion depth is unlimited" — Postgres has `max_stack_depth`; very deep recursion can fail.
- "Recursive CTEs are fast" — they're often *not* — each iteration sees the previous iteration's rows, so deep recursions accumulate cost. Profile before assuming.

**What follows from this topic**

Recursive CTEs are the SQL answer to graph and hierarchy problems. They feed into hierarchical aggregation (topic 14 — recursive CTE + `GROUPING SETS` for tree subtotals), org chart traversal, BOM (bill of materials) explosion, network reachability, and dependency resolution. The two SQL Practice sources have multiple worked examples — this primer's job is to make the recognition reflexive. If you internalise recursive CTEs as "BFS over an implicit graph defined by the recursive join condition", every later pattern that uses them is mechanical.

### Q1. "Return every descendant of node X in a category tree." Recognise + template.

**Recursive CTE — descent.** Base: `SELECT id, parent_id, 1 AS level FROM categories WHERE id = :x`. Recursive: `SELECT c.id, c.parent_id, t.level + 1 FROM categories c JOIN descent t ON c.parent_id = t.id`.

```sql
WITH RECURSIVE descent AS (
  SELECT id, parent_id, name, 1 AS level FROM categories WHERE id = :x
  UNION ALL
  SELECT c.id, c.parent_id, c.name, d.level + 1
  FROM categories c JOIN descent d ON c.parent_id = d.id
)
SELECT * FROM descent;
```

The recognition signal: parent_id self-reference + "all descendants" / "subtree". For ascent (ancestors of X), flip the join: `JOIN ascent a ON c.id = a.parent_id`.

### Q2. "Find the shortest unweighted path between two nodes in a graph." Pattern.

**Recursive CTE, BFS-style with level tracking.** Base: `SELECT src AS node, ARRAY[src] AS path, 0 AS level WHERE src = :start`. Recursive: join the edge table on `node = edges.src`, append `edges.dst` to path, increment level. Stop when `node = :end` or when the recursion exhausts. Postgres 14+ supports `CYCLE node SET is_cycle USING path_array` for clean cycle handling. The recognition signal: graph + "shortest unweighted path" → recursive CTE with level. For weighted shortest path (Dijkstra), SQL is the wrong tool — switch to application code.

### Q3. The cycle detection trap. How does PG 14's `CYCLE` clause work?

```sql
WITH RECURSIVE g AS (
  SELECT id, name FROM nodes WHERE id = :start
  UNION ALL
  SELECT n.id, n.name FROM nodes n JOIN edges e ON e.src_id = current_node JOIN g ON ...
) CYCLE id SET is_cycle USING path
SELECT * FROM g WHERE NOT is_cycle;
```

The `CYCLE` clause tracks the path internally and sets `is_cycle = true` for rows that close a cycle. You filter them out at the outer level. Pre-PG 14, the workaround was a manual `path = path || current_id` array and `WHERE NOT (current_id = ANY(path))` to prevent revisits. The senior tell: knowing both, naming `CYCLE` as the PG 14+ form, and explaining why naive recursion on a cyclic graph runs forever.

### Q4. "Compute the full path from root to each node as a string." Pattern.

**Recursive CTE with path accumulation.** Carry a `path` column that concatenates names from root down. Base: `SELECT id, name, name AS path FROM tree WHERE parent_id IS NULL`. Recursive: `SELECT c.id, c.name, t.path || ' / ' || c.name FROM tree c JOIN paths t ON c.parent_id = t.id`. The result has one row per node with the breadcrumb-style path. For array form, use `array_append`. The senior tell: recognising "path from root" as the canonical accumulation pattern and reaching for `string_agg`'s sibling (concatenation in the recursive case, not in an outer aggregate).

### Q5. "Bill of materials explosion — for a finished product, list all raw materials and their total quantities." Pattern.

**Recursive CTE + aggregation.** Base case: the finished product. Recursive case: join to the BOM table on `parent = component`, multiplying the running quantity by the per-level quantity. Stop at leaf nodes (no sub-components). Then `GROUP BY raw_material SUM(quantity)` at the outer level. The recognition signal: "explode a structured tree, multiplying as you descend". Trap: forgetting to multiply quantities along the path means you get counts instead of cumulative quantities. The recursive case must carry the running multiplier.

### Q6. Senior interview angle: when is a recursive CTE the wrong tool?

When (1) the algorithm needs **priority-queue state** (Dijkstra, A*) — SQL has no heap, so you'd simulate it badly. (2) The algorithm needs **memoised path state** (TSP, longest path in DAG) — SQL recursion repeats work. (3) **Depth is huge** (>10⁴) — Postgres recursion can exhaust the stack. (4) **You need backtracking** — SQL is BFS-by-default, and DFS-with-backtracking is unnatural. (5) **Computation is heavy per node** — the planner re-evaluates the recursive case each iteration. The senior tell: naming these limits, articulating "I'd use SQL for transitive closure and tree walks, but switch to application code or a graph database for shortest path and complex traversals". That tradeoff conversation is the staff-level signal.

---

## Gaps & Islands

### Summary

**What this topic covers**

The canonical pattern for detecting consecutive runs of a condition — "consecutive days where X is true", "consecutive seats booked", "consecutive numbers in a sequence". Sub-patterns: (1) **basic gaps & islands** — group rows by `(value - row_number_among_qualifying)`; identical differences mean same island; (2) **time-based islands** — same trick on dates instead of values; (3) **conditional islands** — find consecutive rows where a condition holds, filter first then group; (4) **gap detection** — find missing values via `LAG` and a difference check; (5) **island length filtering** — `HAVING COUNT(*) >= K` to find streaks of length K or more. The 6 questions cover the templates, the `LAG`-based variant, the trap of the row-number ordering, and the senior-level "two equivalent solutions" recognition.

**Mental model**

The gaps & islands trick is the single most clever pattern in SQL — it converts "find consecutive runs" from O(N²) self-join hell into one window function plus a `GROUP BY`. The insight: if you have a sequence of qualifying rows and assign them a row number `ROW_NUMBER() OVER (ORDER BY ts)`, and you subtract this from the date itself, **rows in the same consecutive run share the same difference**. For example, dates 1, 2, 3, 7, 8 with row numbers 1, 2, 3, 4, 5 give differences 0, 0, 0, 3, 3 — two islands (the 0-group and the 3-group). Then `GROUP BY difference` identifies the islands and computes their start, end, and length. The variant for time-based islands uses `RANK()` or `DENSE_RANK()` if you want gaps to count specifically by date rather than row position. The `LAG`-based variant assigns an "island id" by detecting boundaries: each time `LAG(ts)` differs from `ts - 1`, start a new island. Both produce equivalent results; the row-number-minus-date version is more elegant, the `LAG`-and-cumsum version is more flexible (it generalises to "new island when X changes" for arbitrary X). The senior tell is recognising this pattern in 5 seconds for any "consecutive" prompt and writing the row-number version reflexively.

**Key terms**

- **Island** — a maximal run of consecutive qualifying values.
- **Gap** — a missing value between two qualifying values.
- **Row number trick** — subtract `ROW_NUMBER() OVER (ORDER BY ts)` from `ts`; identical differences mean same island.
- **`LAG`-based trick** — detect boundaries via `LAG(ts)`, assign island id via cumulative sum of boundary flags.
- **Qualifying row** — a row that satisfies the condition for being in an island (e.g. revenue > 100k).
- **Boundary** — a row where the previous row is not in the same island.
- **Cumulative sum boundary tag** — `SUM(is_boundary) OVER (ORDER BY ts)` produces an island id.
- **Island length** — `COUNT(*)` after grouping by the difference.
- **`MIN(ts)` / `MAX(ts)` per island** — start and end dates.
- **Streak filter** — `HAVING COUNT(*) >= K` to find runs of length ≥ K.

**Why interviewers ask this**

Three signals. (1) **Pattern recognition** — "consecutive" / "in a row" / "streak" / "session" is dead-on for gaps & islands; recognising it in 5 seconds is the senior tell. (2) **The row-number trick** — knowing the `ROW_NUMBER` minus date trick is the canonical "have you seen this before?" test. Without prior exposure, candidates spend 20 minutes deriving it and may give up. (3) **Variant fluency** — for "consecutive only when condition X holds" or "session boundary on inactivity", senior candidates layer a `WHERE` filter or a `LAG`-based boundary; juniors mash the pieces together inconsistently.

**Common confusions**

- "Self-join is fine for consecutive 3-day streaks" — works for fixed length K, doesn't generalise to "≥ K".
- "`ROW_NUMBER` minus date only works for daily data" — works for any monotonic ordering; for hourly data, use hour-of-epoch instead.
- "`LAG`-based and row-number-based are different patterns" — equivalent; pick by personal preference and prompt shape.
- "Gaps and islands are different problems" — they're the same problem viewed from two angles; the trick is symmetric.
- "I need to handle weekends specially" — depends on the prompt; "consecutive *business* days" requires generating a business-day series and joining.
- "I can use a self-join for arbitrary streak length" — only with recursive CTE, which is what gaps & islands replaces.

**What follows from this topic**

Gaps & islands is the foundation for sessionization (topic 11 — same trick but with a time-based boundary), event sequence detection, "find streaks" prompts, and many time-series analyses. The `LAG`-based variant generalises to "new partition when X changes" for any X. If you internalise the row-number-minus-date trick and the `LAG`-and-cumsum variant, the entire family of consecutive-runs problems collapses to one mental move.

### Q1. Walk me through the canonical row-number-minus-date trick.

```sql
SELECT user_id,
       MIN(login_date) AS streak_start,
       MAX(login_date) AS streak_end,
       COUNT(*) AS streak_length
FROM (
  SELECT user_id, login_date,
         login_date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date))::int AS grp
  FROM logins
) t
GROUP BY user_id, grp
HAVING COUNT(*) >= 3;  -- streaks of 3+ days
```

The insight: for consecutive dates `d1, d2, d3 = d1+1, d1+2`, the row numbers are `1, 2, 3`, so `d - rn` is constant. Any gap breaks the pattern. The cast `::int` is because `date - int` in Postgres returns a date; you actually want the difference value as the grouping key — store `login_date - rn * interval '1 day'` if you want to be explicit. Read it as: "rows in the same consecutive run share `(date - row_number)`".

### Q2. "Find streaks where revenue exceeded 100k for at least 3 consecutive days." Pattern.

Same gaps & islands trick, but **filter qualifying rows first**, then row-number among the survivors:

```sql
WITH qualifying AS (
  SELECT day FROM daily_revenue WHERE revenue > 100000
),
grouped AS (
  SELECT day, day - (ROW_NUMBER() OVER (ORDER BY day))::int AS grp FROM qualifying
)
SELECT MIN(day), MAX(day), COUNT(*) AS streak_length
FROM grouped
GROUP BY grp
HAVING COUNT(*) >= 3;
```

The trap: if you row-number the full table (not the filtered one), the `(date - rn)` trick breaks because non-qualifying days are missing from the sequence but still affect the row number alignment. Filter first, then row-number — that's the senior detail.

### Q3. The `LAG`-based gaps & islands variant. When does it win?

```sql
WITH boundaries AS (
  SELECT user_id, login_date,
         CASE WHEN login_date - LAG(login_date) OVER (PARTITION BY user_id ORDER BY login_date) = 1
              THEN 0 ELSE 1 END AS is_new_island
  FROM logins
),
islands AS (
  SELECT *, SUM(is_new_island) OVER (PARTITION BY user_id ORDER BY login_date) AS island_id
  FROM boundaries
)
SELECT user_id, island_id, MIN(login_date), MAX(login_date), COUNT(*)
FROM islands
GROUP BY user_id, island_id;
```

This variant wins when the boundary condition isn't just "consecutive integer/date" — e.g. "new island when category changes" or "new session when inactivity > 30 minutes". The `LAG` flexibly defines the boundary; the cumulative sum produces the island id. The row-number variant is shorter for the simple date-consecutive case; `LAG`-based is more general.

### Q4. "Find missing days in a date range where logins should have occurred." Gap-finding pattern.

**`GENERATE_SERIES` + `LEFT JOIN`** is the cleanest form, not gaps & islands directly:

```sql
SELECT d::date AS missing_day
FROM GENERATE_SERIES(:start, :end, '1 day'::interval) d
LEFT JOIN logins l ON l.login_date = d::date
WHERE l.id IS NULL;
```

The pure-SQL gap-finding alternative uses `LAG`: `WHERE login_date - LAG(login_date) OVER (ORDER BY login_date) > 1` gives the day after each gap end. But the `GENERATE_SERIES` approach is clearer and directly enumerates missing days. Reach for it.

### Q5. "Sessionize user events — start a new session after 30 minutes of inactivity." Variant.

Pure gaps & islands with a time-based boundary:

```sql
WITH boundaries AS (
  SELECT user_id, ts,
         CASE WHEN ts - LAG(ts) OVER (PARTITION BY user_id ORDER BY ts) > INTERVAL '30 minutes'
              OR LAG(ts) OVER (PARTITION BY user_id ORDER BY ts) IS NULL
              THEN 1 ELSE 0 END AS is_new_session
  FROM events
),
sessions AS (
  SELECT *, SUM(is_new_session) OVER (PARTITION BY user_id ORDER BY ts) AS session_id
  FROM boundaries
)
SELECT user_id, session_id, MIN(ts) AS start, MAX(ts) AS end, COUNT(*) AS event_count
FROM sessions
GROUP BY user_id, session_id;
```

This is the canonical session detection pattern; topic 11 expands it.

### Q6. Senior interview angle: gaps & islands generalises to "new group when X changes". Give an example beyond dates.

Detect runs of consecutive rows with the same status value: "find consecutive rows where `status` stays the same, then group by run". The `LAG`-based variant works directly: `is_new_run = (status != LAG(status))::int`, cumulative-sum it, group by the resulting `run_id`. Use case: detect uptime/downtime periods from a service status log, find runs of consecutive sales of the same product, detect runs of consecutive employees in the same department in an ordered seating chart. The senior tell is recognising that gaps & islands is really "group by stable-value run", and the row-number-minus-date version is a special case where the value is a sequence number.

---

## Sessionization & Event Sequences

### Summary

**What this topic covers**

The pattern for grouping a stream of events into sessions and analysing event sequences within and across sessions. Sub-patterns: (1) **time-gap sessionization** — start a new session after N minutes of inactivity (gaps & islands variant); (2) **explicit-boundary sessionization** — start a new session on a specific event (e.g. `event_type = 'session_start'`); (3) **session-level aggregation** — once sessions are identified, compute session length, event count, unique pages; (4) **event sequence detection** — find sessions where event A is followed by event B (`LAG` / `LEAD` plus filter); (5) **first/last event per session** — `DISTINCT ON` or `FIRST_VALUE`/`LAST_VALUE` per session. The 5 questions cover the templates, the boundary recognition (time-based vs event-based), and the senior-level "funnel from event sequences" pattern.

**Mental model**

Sessionization is gaps & islands applied to time-series event data — the difference is that the boundary is a time threshold rather than a one-day gap. Once sessions are identified (each event tagged with a `session_id`), the table behaves like any other group-keyed table — `GROUP BY user_id, session_id` for session-level aggregates. The harder pattern is **event sequence detection within sessions** — "did event A precede event B in the same session?" That's `LAG(event_type) OVER (PARTITION BY session_id ORDER BY ts)` for the previous event, plus a filter. For longer sequences ("A then B then C"), the cleanest move is either (a) self-joins of the event table on session_id and time order, or (b) `STRING_AGG(event_type ORDER BY ts)` per session into a sequence string and pattern-match with `LIKE '%A%B%C%'`. The string-pattern-match approach is hackish but works and reads concisely. For funnel analysis (count of users who reached step N), you typically compute step reach per user via `MAX(CASE WHEN event = 'step_n' THEN 1 ELSE 0 END)` and aggregate. The senior insight is that **once sessionization is done, downstream analyses are just `GROUP BY session_id` patterns** — the hard part is the boundary detection.

**Key terms**

- **Session** — a sequence of events from one user with inter-event gaps below a threshold.
- **Session boundary** — the gap or event that starts a new session.
- **Time-gap boundary** — inactivity longer than N minutes.
- **Explicit-event boundary** — a specific event type marks session start.
- **`session_id`** — cumulative sum of boundary flags via `LAG` + `SUM() OVER`.
- **Session length** — `MAX(ts) - MIN(ts)` per session.
- **Bounce session** — a session with one event (no follow-up); typically short or zero-duration.
- **Event sequence** — ordered events within a session; `LAG`/`LEAD` to compare adjacent.
- **Funnel step** — a designated event type in an ordered sequence; "users who reached step N".
- **Conversion rate** — count of users at step N divided by count at step N-1.

**Why interviewers ask this**

Three signals. (1) **Sessionization recognition** — "events into sessions" is a common analytical prompt and senior candidates write the `LAG`-and-cumsum pattern in 30 seconds. (2) **Funnel reasoning** — funnel queries are notorious for ambiguity ("does the user need to complete step N in the same session as step N-1?"); senior candidates ask the disambiguating questions before writing. (3) **Event sequence detection** — multi-step "A then B then C" patterns are non-trivial in pure SQL; reaching for `STRING_AGG` plus `LIKE` or layered self-joins shows experience.

**Common confusions**

- "Sessionization needs a special function" — no, it's gaps & islands with a time threshold.
- "Time-gap and event-based boundaries are different patterns" — same pattern, different boundary predicate.
- "Bounce sessions are noise" — they're a metric; high bounce rate is a UX signal.
- "Funnel is just a `COUNT(*)` per event type" — only if events are disjoint per user; for "users who reached at least step N", you need per-user max-step computation.
- "Event sequence is fast in SQL" — for short sequences yes; for long sequences (>5 events), the self-join chain gets expensive.
- "Session length includes the time from last event to next-session start" — no; session length is from first to last event *within* the session.

**What follows from this topic**

Sessionization underpins cohort analysis (topic 16 — sessions per user per cohort), funnel analysis (which step did each user reach), retention (sessions per user across days). The event-sequence pattern recurs in fraud detection ("A followed by B within N seconds"), user-journey mapping, and any time-ordered behavioural analysis. If you internalise sessionization as "gaps & islands with a time threshold, then `GROUP BY session_id`", every later pattern that uses it composes naturally.

### Q1. "Sessionize user events — 30-minute inactivity boundary, then compute average session length." Pattern.

**Gaps & islands on time** to assign `session_id`, then `GROUP BY user_id, session_id`:

```sql
WITH tagged AS (
  SELECT user_id, ts,
         CASE WHEN ts - LAG(ts) OVER (PARTITION BY user_id ORDER BY ts) > INTERVAL '30 minutes'
              OR LAG(ts) OVER (PARTITION BY user_id ORDER BY ts) IS NULL THEN 1 ELSE 0 END AS new_session
  FROM events
),
sessions AS (
  SELECT *, SUM(new_session) OVER (PARTITION BY user_id ORDER BY ts) AS session_id FROM tagged
)
SELECT AVG(MAX(ts) - MIN(ts))
FROM sessions
GROUP BY user_id, session_id;
```

The first session per user has `LAG = NULL` which is why the explicit `OR LAG IS NULL` is needed. The senior tell is the explicit NULL handling.

### Q2. "Per session, the first and last page visited." Pattern.

After sessionization, `DISTINCT ON (user_id, session_id) ... ORDER BY user_id, session_id, ts` gives first page; `ORDER BY ... ts DESC` gives last. Alternative in one query: `FIRST_VALUE(page) OVER (PARTITION BY user_id, session_id ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)` paired with `LAST_VALUE` (with the same frame override to avoid the default-frame trap). The `DISTINCT ON` form is cleaner when you only want first/last as separate rows; the window-function form is cleaner when you want them as columns on every event row.

### Q3. "Did the user visit page A then page B in the same session?" Pattern.

Two valid forms. (1) **`LAG`-based** — for "B preceded by A immediately": `WHERE page = 'B' AND LAG(page) OVER (PARTITION BY session_id ORDER BY ts) = 'A'`. (2) **`STRING_AGG` + `LIKE`** — for "B preceded by A at any point in the session": `WITH s AS (SELECT session_id, STRING_AGG(page, ',' ORDER BY ts) AS seq FROM events GROUP BY session_id) SELECT session_id FROM s WHERE seq LIKE '%A%B%'`. The second form generalises to any "A...B...C" pattern. The senior tell: pick the right form based on whether "preceded by" means "immediately before" or "anywhere before".

### Q4. "Funnel: count users who reached signup, checkout, and purchase in order." Pattern.

Per-user max-step approach:

```sql
WITH user_steps AS (
  SELECT user_id,
         MAX(CASE WHEN event = 'signup' THEN 1 ELSE 0 END) AS reached_signup,
         MAX(CASE WHEN event = 'checkout' THEN 1 ELSE 0 END) AS reached_checkout,
         MAX(CASE WHEN event = 'purchase' THEN 1 ELSE 0 END) AS reached_purchase
  FROM events GROUP BY user_id
)
SELECT SUM(reached_signup), SUM(reached_checkout), SUM(reached_purchase) FROM user_steps;
```

This ignores order — for "in order" requirement, you need to verify that the first signup timestamp precedes the first checkout, which precedes the first purchase. Add `MIN(ts) FILTER (WHERE event = 'signup')` etc., then filter for monotonic ordering. The senior tell: catching the order ambiguity in the prompt and asking before writing.

### Q5. Senior interview angle: bounce-rate analysis from sessions. Pattern.

A bounce is a session with exactly one event (or duration < N seconds). After sessionization:

```sql
WITH session_stats AS (
  SELECT user_id, session_id, COUNT(*) AS event_count, MAX(ts) - MIN(ts) AS duration
  FROM tagged_sessions GROUP BY user_id, session_id
)
SELECT
  COUNT(*) FILTER (WHERE event_count = 1) * 100.0 / COUNT(*) AS bounce_rate
FROM session_stats;
```

The `FILTER` clause makes it a one-line computation. For "bounce as session duration < 10 seconds", use `WHERE duration < INTERVAL '10 seconds'`. The senior tell: defining the bounce criterion explicitly with the interviewer before writing — different products use different definitions (single page vs short duration vs no interaction).

### Q6. "Time between consecutive events within a session." Pattern.

**`LEAD(ts) OVER (PARTITION BY session_id ORDER BY ts) - ts`** as inter-event gap; NULL for the last event in each session. Average across all rows gives mean inter-event time per session. For the per-session aggregate: `AVG(LEAD(ts) OVER (...) - ts) GROUP BY session_id`. Recognition signal: "time between events" → `LEAD` minus current, per partition.

---

## Top-N per Group

### Summary

**What this topic covers**

The canonical "for each group, pick the top-N rows by some metric" pattern. Sub-patterns: (1) **top-1 per group** — `DISTINCT ON` (Postgres-native, shortest) or `ROW_NUMBER() = 1` (portable); (2) **top-N per group** — `ROW_NUMBER() <= N`; (3) **top-N with ties** — `DENSE_RANK() <= N` or `RANK() <= N`; (4) **lateral top-N** — `LATERAL ... LIMIT N` for index-aligned per-group lookups; (5) **per-group aggregate of top-N** — e.g. "average of the top 3 sales per category". The 6 questions cover the templates, the three valid forms for top-1, the `LATERAL` vs `ROW_NUMBER` tradeoff, and the senior-level "what does 'top N' mean if there are ties at N".

**Mental model**

Top-N per group is one of the most frequent SQL interview prompts because there are three structurally different ways to write it, each with different performance characteristics and portability. **`DISTINCT ON`** is Postgres-only and the most concise; one line, no CTE needed. **`ROW_NUMBER() OVER (PARTITION BY group ORDER BY metric DESC) <= N`** is portable and the most common form in production code. **`LATERAL ... LIMIT N`** does many small per-group lookups; it wins when there's a good `(group_key, metric DESC)` index because each lookup is an index scan that stops after N rows. The right choice depends on (a) Postgres-only vs portable, (b) whether the index supports per-group early termination, and (c) whether ties at rank N should be included. For "top-1", `DISTINCT ON` is the cleanest in Postgres; for "top-N with N > 1", `ROW_NUMBER` is usually clearest; for "top-3 per customer where customer table is small and orders is huge with the right index", `LATERAL` is fastest. The senior insight is that **the tie semantics decide between `ROW_NUMBER`, `RANK`, and `DENSE_RANK`** — and most prompts hide this decision. Senior candidates ask before writing.

**Key terms**

- **Top-N per group** — for each group, the N rows with the highest (or lowest) value of some metric.
- **`DISTINCT ON (key)`** — Postgres-only; returns one row per distinct key, picked by `ORDER BY`.
- **`ROW_NUMBER() OVER (PARTITION BY key ORDER BY metric DESC) <= N`** — portable; standard top-N.
- **`DENSE_RANK() <= N`** — includes ties at rank N (so "top 3" could return 4+ rows if ties).
- **`LATERAL ... LIMIT N`** — per-group correlated subquery; index-aligned.
- **Tie-break columns** — additional `ORDER BY` columns for deterministic ordering when ties exist.
- **Group key** — the column you're partitioning by.
- **Metric** — the column you're ranking by.
- **Index alignment** — having an index on `(group_key, metric DESC)` enables index-only top-N.
- **Bottom-N** — same pattern, with `ORDER BY metric ASC`.

**Why interviewers ask this**

Three signals. (1) **Three-form fluency** — senior candidates name all three (`DISTINCT ON`, `ROW_NUMBER`, `LATERAL`) and pick one with a justification; juniors write only the one they know. (2) **Tie-semantic awareness** — for "top 3 by sales per region", does "top 3" mean exactly 3 rows or all rows tied for the third position? Asking is the senior tell. (3) **Index awareness** — choosing `LATERAL` when the index supports it shows understanding of how planners use composite indexes for ORDER BY + LIMIT.

**Common confusions**

- "Top-1 per group is always `DISTINCT ON`" — only in Postgres; in MySQL or SQL Server it's `ROW_NUMBER = 1`.
- "`DISTINCT ON` is the same as `DISTINCT`" — totally different; `DISTINCT` dedups, `DISTINCT ON (key)` picks one row per key by `ORDER BY`.
- "`ROW_NUMBER` and `DENSE_RANK` give the same top-N" — only when there are no ties; with ties they diverge.
- "`LATERAL` is always faster" — only with the right index; without it, the window function wins.
- "I can use `LIMIT` directly in a `GROUP BY`" — no, `LIMIT` applies to the final result; you need window function or `LATERAL` for per-group limits.
- "Correlated subquery `WHERE ts = (SELECT MAX(ts) ...)` is fine" — slow and re-evaluates per row; use `DISTINCT ON` or `ROW_NUMBER` instead.

**What follows from this topic**

Top-N per group is a building block for "most recent N orders per customer", "best-selling N products per category", "highest-paid N employees per department", and many ranking-based prompts. It composes with cohort analysis (topic 16 — first action per cohort) and temporal queries (topic 17 — most recent event before a timestamp). If you internalise the three forms and the tie-semantic decision, this pattern is reflex.

### Q1. "Top product per category by revenue, Postgres-only style." Pattern.

**`DISTINCT ON (category) category, product_name, revenue FROM products ORDER BY category, revenue DESC`**. One line, no CTE. The `ORDER BY` must start with the `DISTINCT ON` columns, then the tie-break. The first matching row per category is kept. With an index on `(category, revenue DESC)`, this is an index-only scan with early termination per category — usually the cheapest plan. The portable equivalent is `ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC) = 1` in a CTE.

### Q2. "Top 3 products per category by revenue, portable form." Pattern.

**`ROW_NUMBER() <= 3`** in a CTE:

```sql
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC) AS rn FROM products
)
SELECT * FROM ranked WHERE rn <= 3;
```

If "top 3" should include ties at rank 3 (so could be 4+ rows for a category with 4-way tie at #3), switch to `DENSE_RANK() <= 3`. The senior tell: ask before writing. Default to `ROW_NUMBER` unless the prompt explicitly mentions ties.

### Q3. "For each customer, their 5 most recent orders, with index optimisation." Pattern.

**`LATERAL`** wins when there's an index on `(customer_id, ts DESC)`:

```sql
SELECT c.*, o.*
FROM customers c
CROSS JOIN LATERAL (
  SELECT * FROM orders o WHERE o.customer_id = c.id ORDER BY o.ts DESC LIMIT 5
) o;
```

The planner does one index seek per customer, reading at most 5 rows. With 1M customers and a great index, this beats the `ROW_NUMBER` version which sorts the entire orders table. Without the index, the window-function version wins. The senior tell: check the index before choosing `LATERAL` vs `ROW_NUMBER`.

### Q4. "Average revenue of the top 3 products per category." Pattern stack.

CTE-and-aggregate:

```sql
WITH ranked AS (
  SELECT category, revenue, ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC) AS rn FROM products
)
SELECT category, AVG(revenue) AS avg_top3 FROM ranked WHERE rn <= 3 GROUP BY category;
```

Reach the top 3 via window function, then aggregate. The `GROUP BY` collapses to one row per category. Senior alternative for variable N: parameterise `N` and use the same template. For "average of top 3 with ties", switch to `DENSE_RANK <= 3` — the average will include ties.

### Q5. The bottom-N variant. What changes?

Just flip the `ORDER BY` direction. For "the 3 cheapest products per category": `ROW_NUMBER() OVER (PARTITION BY category ORDER BY price ASC) <= 3`. For "the worst-performing employee per region": `DISTINCT ON (region) ... ORDER BY region, performance_score ASC`. The pattern is identical; only the sort direction matters. The senior tell: state "ascending vs descending" explicitly when reading the prompt — sometimes prompts use "top" to mean "worst" (e.g. "top 5 complaints by frequency").

### Q6. Senior interview angle: per-group quartiles — "for each region, the user at the 25th, 50th, 75th percentile of total spend". Pattern.

`PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_spend)` per region — but this returns a *value*, not a *row*. To get the row at the percentile, use `NTILE(4) OVER (PARTITION BY region ORDER BY total_spend)` then filter — but `NTILE` bucket boundaries don't align cleanly with percentiles for tie-rich data. The cleanest answer: `PERCENT_RANK() OVER (PARTITION BY region ORDER BY total_spend)` and filter to the closest match for each percentile. The senior tell is recognising "value at percentile" vs "row at percentile" as different problems with different tools.

---

## Pivot & Unpivot

### Summary

**What this topic covers**

The patterns for reshaping data between long format (one row per measurement) and wide format (one column per category). Sub-patterns: (1) **conditional aggregation pivot** — `SUM(x) FILTER (WHERE category = 'A') AS a, SUM(x) FILTER (WHERE category = 'B') AS b, ...`; (2) **`tablefunc.crosstab`** — Postgres-specific extension for pivot; (3) **dynamic pivot** — programmatically generated SQL when categories are unknown at write time; (4) **unpivot via `UNION ALL`** — flip wide-format columns back to long; (5) **unpivot via `jsonb_each`** — convert a JSONB row to key/value rows. The 5 questions cover the templates, the fixed-vs-dynamic distinction, the `FILTER` vs `CASE WHEN` choice, and the senior-level recognition of when pivot is the wrong shape.

**Mental model**

Pivoting in pure SQL requires knowing the destination columns at query write time — SQL can't return a result set with a runtime-determined schema. So **all pivots are conditional aggregations** with one aggregate per destination column. The cleanest form in Postgres is `FILTER`: `SUM(revenue) FILTER (WHERE month = 1) AS jan, SUM(revenue) FILTER (WHERE month = 2) AS feb`. The legacy form is `CASE WHEN month = 1 THEN revenue END` — equivalent plan, less readable. The `tablefunc.crosstab` extension provides a more compact syntax but requires installation and has the same "columns must be known" constraint. For **dynamic pivots** (unknown categories at write time), the only option is to generate the SQL programmatically — the application reads the distinct categories first, builds the query, then executes. Pure SQL can't do this in one query. For **unpivot** (wide to long), the standard form is `UNION ALL` of one query per column being unpivoted: `SELECT id, 'jan' AS month, jan AS value FROM t UNION ALL SELECT id, 'feb' AS month, feb AS value FROM t UNION ALL ...`. For JSONB, `jsonb_each` converts a JSONB object to one row per key/value — much cleaner than `UNION ALL` for many-column unpivots. The senior insight is that **pivot is often the wrong shape for storage** — wide format makes adding new categories require schema changes. Pivot is a presentation-layer operation, not a storage decision.

**Key terms**

- **Pivot** — reshape long-format rows into wide-format columns.
- **Unpivot** — reshape wide-format columns into long-format rows.
- **Conditional aggregation** — `SUM(x) FILTER (WHERE category = 'A')`; the standard pivot form.
- **`FILTER (WHERE ...)`** — Postgres standard SQL; per-aggregate condition.
- **`CASE WHEN ... THEN x END`** — legacy form of conditional aggregation; same plan as `FILTER`.
- **`tablefunc.crosstab`** — Postgres extension for compact pivot syntax.
- **Dynamic pivot** — pivot where categories are unknown at write time; requires programmatic SQL generation.
- **`UNION ALL` unpivot** — one query per source column; concatenates results.
- **`jsonb_each(jsonb)`** — set-returning function that yields one row per key/value; useful for unpivot.
- **Wide format** — one row per entity, one column per category.
- **Long format** — one row per (entity, category) measurement.

**Why interviewers ask this**

Three signals. (1) **`FILTER` reflex** — senior candidates write `FILTER` for pivot; juniors write `CASE WHEN` or three queries `UNION`'d. (2) **Dynamic-pivot awareness** — when categories aren't fixed, senior candidates name "this needs programmatic SQL generation" instead of trying to make pure SQL do it. (3) **Unpivot fluency** — most candidates have never unpivoted; recognising `jsonb_each` as the clean unpivot form for many-column data is a Postgres-staff signal.

**Common confusions**

- "Pivot needs a special function" — no, conditional aggregation is pivot.
- "`crosstab` is required for pivot" — no, it's a syntactic sugar; conditional aggregation with `FILTER` is the standard form.
- "Dynamic pivot is doable in pure SQL" — no, the column list must be known at write time.
- "Unpivot is hard" — `UNION ALL` of N queries is straightforward; `jsonb_each` is cleaner.
- "Pivoted output is the natural storage shape" — usually no; long format scales better with new categories.
- "`PIVOT` is standard SQL" — it's in SQL Server and Oracle but not standard or Postgres.

**What follows from this topic**

Pivot recurs in cohort matrices (topic 16 — pivot signup-week × week-offset), reporting / dashboard queries (any "by region per quarter" report), and pre-aggregated denormalisation. Unpivot recurs when consuming wide-format CSVs into long-format tables. If you internalise pivot as conditional aggregation and dynamic pivot as "programmatic SQL generation", the rest is mechanical.

### Q1. "Pivot daily revenue so each row is a category and each column is a month." Pattern.

**Conditional aggregation with `FILTER`**:

```sql
SELECT category,
       SUM(revenue) FILTER (WHERE EXTRACT(MONTH FROM day) = 1) AS jan,
       SUM(revenue) FILTER (WHERE EXTRACT(MONTH FROM day) = 2) AS feb,
       ...
       SUM(revenue) FILTER (WHERE EXTRACT(MONTH FROM day) = 12) AS dec
FROM sales GROUP BY category;
```

Twelve `FILTER` clauses, one per month. Verbose but explicit and works in plain SQL. The `tablefunc.crosstab` variant is shorter but requires the extension. For dashboards, the `FILTER` form is preferred because the column names are explicit.

### Q2. `FILTER` vs `CASE WHEN` for conditional aggregation — does the planner care?

Functionally equivalent; both produce the same execution plan. `FILTER (WHERE ...)` is the SQL:2003 standard syntax and reads cleaner: `COUNT(*) FILTER (WHERE status = 'paid')` vs `COUNT(CASE WHEN status = 'paid' THEN 1 END)`. The `FILTER` form is preferred in modern Postgres code. Use `CASE WHEN` only when the aggregate has a non-trivial expression that benefits from being inline (e.g. `SUM(CASE WHEN status = 'paid' THEN amount * 1.1 ELSE amount END)`).

### Q3. "Pivot, but the categories are unknown until query time." How?

You can't do this in pure SQL — the column list must be known at write time. The pattern: (1) Query the distinct categories: `SELECT DISTINCT category FROM sales`. (2) Build the `FILTER` clauses programmatically in application code. (3) Execute the assembled query. Alternative: return the data in long format with a placeholder for the pivot, and pivot in the presentation layer. The senior tell is naming "pure SQL can't return runtime-determined columns" explicitly and proposing the programmatic-generation workaround.

### Q4. "Unpivot a wide-format monthly revenue table back to long format." Pattern.

**`UNION ALL`** of one query per column:

```sql
SELECT id, 'jan' AS month, jan AS revenue FROM monthly
UNION ALL
SELECT id, 'feb' AS month, feb AS revenue FROM monthly
UNION ALL
...
```

Or, for cleanlier syntax when columns are JSONB: `SELECT id, key AS month, value::numeric AS revenue FROM monthly, jsonb_each(row_to_json(monthly)::jsonb) WHERE key IN ('jan', 'feb', ...)`. The `jsonb_each` form scales better for 12+ columns. Pure-SQL Postgres also has `UNNEST` for arrays, useful when you can `array_agg` first.

### Q5. Senior interview angle: when is the pivoted output the wrong shape?

For storage: long format scales better. Adding a new category in long format is one new row; in wide format it's a schema migration. For BI tools and reports: wide format is what humans expect. For aggregate queries: long format is more flexible (you can compute "total per category" without rewriting per-column SUMs). The senior tell: recognise pivoting as a *presentation* operation, not a storage choice. Store data in long format; pivot at query time only when the consumer (dashboard, report, spreadsheet export) needs wide format.

### Q6. "Unpivot a row of monthly columns into 12 rows using `jsonb_each`." Pattern.

```sql
SELECT id, key AS month, value::numeric AS revenue
FROM monthly_wide,
     jsonb_each(to_jsonb(monthly_wide) - 'id') AS j(key, value)
WHERE key IN ('jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec');
```

Convert the row to JSONB, strip the id, iterate keys with `jsonb_each`, filter to the month columns, cast back to numeric. Cleaner than `UNION ALL` of 12 queries. Recognition signal: many-column unpivot → `jsonb_each`.

---

## Hierarchical Aggregation

### Summary

**What this topic covers**

The pattern for computing aggregates at multiple grouping levels in one query — totals per (region, category), per region, per category, and grand total. Sub-patterns: (1) **`GROUPING SETS`** — explicit list of grouping combinations; (2) **`ROLLUP(a, b, c)`** — shorthand for hierarchical subtotals: `(a, b, c), (a, b), (a), ()`; (3) **`CUBE(a, b)`** — every combination including no-grouping; (4) **`GROUPING(col)`** — function returning 1 for the NULL-row-from-subtotal indicator; (5) **recursive-CTE-driven tree aggregation** — sum across a true hierarchy (org chart, BOM). The 5 questions cover the templates, the `GROUPING(col)` label trick, the choice between `ROLLUP` and `GROUPING SETS`, and the senior-level "tree aggregation via recursive CTE" pattern.

**Mental model**

Hierarchical aggregation answers "I want sums at multiple grouping levels in one query, not four queries `UNION`'d." `ROLLUP(region, category)` produces rows at three grouping levels — (region, category), (region), and () — with NULLs in the columns that aren't grouped at that level. `CUBE(region, category)` adds rows for (category) alone — every combination. `GROUPING SETS((region, category), (region), ())` is the explicit form, useful when you want non-hierarchical combinations like (region) + (category) + grand total without (region, category). The `GROUPING(col)` function returns 1 if the row's `col` is NULL because it's a subtotal (not because the data has NULL there); use it to label rows: `CASE WHEN GROUPING(region) = 1 THEN 'GRAND TOTAL' ELSE region END`. For **true hierarchical aggregation** (tree-shaped, where you sum descendants up to ancestors), recursive CTEs are the right tool — `ROLLUP` only works for flat hierarchies expressed as columns. The senior insight is that **`ROLLUP` is fast (one scan, multiple grouping levels in one pass) and replaces four separate aggregation queries** with one. Reaching for it is the staff-level move for any "with subtotals" dashboard.

**Key terms**

- **`GROUPING SETS((a, b), (a), ())`** — multiple grouping levels in one query.
- **`ROLLUP(a, b, c)`** — hierarchical subtotals: each prefix of the column list plus the empty group.
- **`CUBE(a, b)`** — every subset of the columns including the empty set.
- **`GROUPING(col)`** — returns 1 if `col` is NULL because of subtotal aggregation, 0 otherwise.
- **`GROUPING_ID(...)`** — bitmask version of `GROUPING`, useful for many columns.
- **Subtotal row** — row where some grouping columns are NULL because they're aggregated at a higher level.
- **Grand total** — row where all grouping columns are NULL.
- **Flat hierarchy** — `(region, category)` expressed as columns; `ROLLUP` works here.
- **True hierarchy** — `(parent_id, child_id)` tree; needs recursive CTE.
- **Subtotal label** — using `GROUPING(col)` to format subtotal rows for display.

**Why interviewers ask this**

Three signals. (1) **`ROLLUP` recognition** — "by X, by (X, Y), plus subtotals" is dead-on for `ROLLUP`; senior candidates name it in 5 seconds. (2) **`GROUPING(col)` awareness** — labelling subtotal rows correctly (distinguishing "the data has NULL for this column" from "this is a subtotal row") is the senior detail. (3) **Recursive tree aggregation** — when the hierarchy is a true tree (org chart, BOM), `ROLLUP` doesn't apply and recursive CTE is the right tool; recognising the distinction is staff-level.

**Common confusions**

- "`ROLLUP` and `CUBE` are interchangeable" — `ROLLUP` is hierarchical (one direction); `CUBE` is every combination.
- "NULL in a subtotal row means missing data" — no, it's the subtotal indicator; use `GROUPING(col)` to disambiguate.
- "I can do subtotals with `UNION ALL`" — yes, but `ROLLUP` does it in one scan; `UNION ALL` re-scans per branch.
- "`ROLLUP` works on tree hierarchies" — no, only flat hierarchies in columns; trees need recursive CTE.
- "`GROUPING SETS` is rarely useful" — it's the right move for ad-hoc reports with non-hierarchical groupings.
- "Subtotal rows have a different schema" — same schema, just NULLs in the aggregated columns.

**What follows from this topic**

Hierarchical aggregation is the foundation for dashboard queries, financial reports (per-quarter, per-year subtotals), and any multi-level summary. The recursive-CTE tree aggregation pattern recurs in BOM rollups (topic 9), organisational P&L (sum revenue by manager-cascade), and pricing rollups. If you internalise `ROLLUP` for flat multi-level subtotals and recursive CTE for true tree sums, every later pattern that uses them composes naturally.

### Q1. "Revenue per region, per category, plus subtotals per region and grand total." Pattern.

**`ROLLUP(region, category)`**:

```sql
SELECT region, category, SUM(revenue) AS total FROM sales GROUP BY ROLLUP(region, category);
```

Returns rows for (region, category) pairs, (region, NULL) subtotals, and (NULL, NULL) grand total. The NULL columns indicate which grouping the row represents. For pretty labels, wrap in `GROUPING(col)`:

```sql
SELECT
  CASE WHEN GROUPING(region) = 1 THEN 'GRAND TOTAL' ELSE region END AS region,
  CASE WHEN GROUPING(category) = 1 AND GROUPING(region) = 0 THEN 'Subtotal' ELSE category END AS category,
  SUM(revenue)
FROM sales GROUP BY ROLLUP(region, category);
```

### Q2. The `GROUPING(col)` trick. Why is it needed?

To distinguish "this row's column is NULL because the data has NULL" from "this row's column is NULL because it's a subtotal row". `GROUPING(col) = 1` means the latter. Without this, a row with `region = NULL` could be either a region named NULL (rare) or a grand-total subtotal. Use `GROUPING` in `CASE` expressions for labels, and in `HAVING` to filter subtotal rows: `HAVING GROUPING(region) = 0` excludes the grand total from the result.

### Q3. "Revenue by (region), by (category), and grand total — but not (region, category)." Pattern.

**`GROUPING SETS`** with the explicit list:

```sql
SELECT region, category, SUM(revenue) FROM sales
GROUP BY GROUPING SETS ((region), (category), ());
```

`ROLLUP(region, category)` would also include (region, category), which the prompt excludes. `GROUPING SETS` lets you specify exactly which combinations you want. The senior tell: recognising "this is `GROUPING SETS`, not `ROLLUP`" when the prompt asks for non-hierarchical combinations.

### Q4. "Roll up total compensation from leaf employees up to managers, recursively." Pattern.

**Recursive CTE for the hierarchy** + aggregate at the outer level:

```sql
WITH RECURSIVE descent AS (
  SELECT id, manager_id, salary FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.manager_id, e.salary FROM employees e JOIN descent d ON e.manager_id = d.id
)
SELECT manager_id, SUM(salary) AS team_total FROM descent GROUP BY manager_id;
```

This sums salaries one level deep; for "total comp of everyone under each manager including all descendants", you'd carry an `original_manager` column down through the recursion. The recognition signal: tree hierarchy + "sum of all descendants" → recursive CTE + group by ancestor.

### Q5. Senior interview angle: when does `ROLLUP` beat four `UNION ALL` queries?

Always. `ROLLUP` is one scan of the source data with multiple aggregation buckets; `UNION ALL` of four queries is four scans. On a 100M-row table, that's 4× the I/O and 4× the CPU. The plan for `ROLLUP` uses a single hash aggregate with multiple grouping levels, which is one of the planner's favourite operators. The senior tell: explicitly compare "one scan with `ROLLUP`" vs "four scans with `UNION ALL`" and choose `ROLLUP` for both performance and readability. The only time `UNION ALL` wins is when the four queries have *different `FROM` clauses* (e.g. mixing tables), which `ROLLUP` can't handle.

### Q6. "Label the row as 'grand total', 'region subtotal', or a region name in the output." Pattern.

Use `GROUPING(col)` to detect subtotal rows:

```sql
SELECT
  CASE WHEN GROUPING(region) = 1 THEN 'GRAND TOTAL'
       WHEN GROUPING(category) = 1 THEN region || ' subtotal'
       ELSE region END AS region_label,
  category, SUM(revenue) AS total
FROM sales GROUP BY ROLLUP(region, category);
```

Recognition signal: any time you mix `ROLLUP` with display logic, `GROUPING(col)` is the disambiguator between "data NULL" and "subtotal NULL".

---

## Set Operations & Anti-Joins

### Summary

**What this topic covers**

The set-based query patterns: `UNION`, `UNION ALL`, `INTERSECT`, `EXCEPT`, plus anti-joins (`NOT EXISTS` and `LEFT JOIN ... IS NULL`) and semi-joins (`EXISTS` and `IN`). Sub-patterns: (1) **deduplicating union** — `UNION` for distinct rows from two sources; (2) **concatenating union** — `UNION ALL` to keep duplicates (much faster); (3) **set intersection** — rows in both; (4) **set difference (anti-join)** — `EXCEPT` or `NOT EXISTS` or `LEFT JOIN ... IS NULL`; (5) **semi-join (existence check)** — `EXISTS` or `IN`. The 6 questions cover the templates, the `UNION` vs `UNION ALL` performance gap, the three equivalent forms of anti-join, the `NOT IN` NULL hazard, and the senior-level "which form for which planner".

**Mental model**

Set operations let you express "rows that satisfy condition X with respect to another set" without an explicit join. `UNION` deduplicates the combined rows; `UNION ALL` keeps duplicates. The performance gap is significant: `UNION` requires a sort or hash to dedup, while `UNION ALL` is a simple concatenation. **Always use `UNION ALL` unless you specifically need dedup.** `INTERSECT` returns rows in both queries (distinct by default); `EXCEPT` returns rows in the first query but not the second (distinct by default). The anti-join is more nuanced — `NOT EXISTS` is the standard form, `LEFT JOIN ... WHERE right.key IS NULL` is the join-based equivalent, and `EXCEPT` is the set-based form (with implicit deduplication). The three are usually equivalent in modern Postgres, but **`NOT IN` is the danger** — if the inner query returns any NULL, the entire `NOT IN` predicate becomes unknown and you get zero rows. Always use `NOT EXISTS` or `LEFT JOIN ... IS NULL` for anti-joins. The semi-join (`EXISTS` / `IN`) is the "filter left by existence in right" pattern — handles NULLs cleanly and the planner can short-circuit on first match. The senior insight is that **set operations are essentially row-set algebra** — pick the form that reads cleanly for the intent, knowing that modern planners optimise across the equivalent forms.

**Key terms**

- **`UNION`** — deduplicating union; rows distinct across the combined result.
- **`UNION ALL`** — concatenating union; keeps duplicates; much faster.
- **`INTERSECT`** — rows in both queries; distinct by default.
- **`INTERSECT ALL`** — keeps duplicates from the intersection.
- **`EXCEPT`** — rows in first query but not second; distinct by default.
- **`EXCEPT ALL`** — duplicate-aware difference.
- **Anti-join** — left rows with no matching right row; `NOT EXISTS` / `LEFT JOIN ... IS NULL`.
- **Semi-join** — left rows with at least one matching right row; `EXISTS` / `IN`.
- **`NOT IN` NULL hazard** — `NOT IN (subquery with NULLs)` returns zero rows.
- **`EXISTS` short-circuit** — planner can stop on first match per outer row.
- **Set algebra** — composing queries via union/intersect/except as if rows were sets.

**Why interviewers ask this**

Three signals. (1) **`UNION ALL` reflex** — senior candidates default to `UNION ALL` unless dedup is required; juniors write `UNION` for safety and lose 2× perf. (2) **`NOT IN` awareness** — recognising the NULL hazard is the canonical senior test. (3) **Anti-join form fluency** — naming the three equivalent forms and picking one based on readability or planner preference shows mature SQL judgement.

**Common confusions**

- "`UNION` is always safe" — it's safe but slow because of the dedup; use `UNION ALL` when you know duplicates aren't an issue.
- "`NOT IN` and `NOT EXISTS` are equivalent" — only when the subquery is NULL-free. With nullable columns, `NOT IN` returns zero rows.
- "`EXCEPT` is rare" — it's the cleanest form for "rows in A not in B" when both sides are full subqueries.
- "`INTERSECT` returns duplicates" — only with `INTERSECT ALL`; bare `INTERSECT` is distinct.
- "Set operations require matching columns" — they require matching *types* (column count + compatible types); column names come from the first query.
- "`EXISTS` is slower than a join" — usually no; the planner converts `EXISTS` to a semi-join.

**What follows from this topic**

Set operations recur in any "compare two row sets" pattern — A/B testing reports, missing-row detection, set difference queries. Anti-joins are foundational for "users who haven't done X" / "products with no orders" queries. Semi-joins are the cleanest form of "filter by existence". If you internalise the four set operators, the three anti-join forms, and the `NOT IN` hazard, the entire family of set-based queries is reflex.

### Q1. `UNION` vs `UNION ALL` — when does each win?

**`UNION ALL`** always wins on performance because it skips the dedup step. **`UNION`** is needed only when the two queries can produce overlapping rows and you need a single row per distinct combination. In practice: most of the time, the two queries return disjoint rows (different filters on the same table, or queries against different tables), so `UNION ALL` is safe. The senior tell: default to `UNION ALL`, switch to `UNION` only when you can articulate why dedup is needed.

### Q2. "Users in table A not in table B." Three valid forms.

(1) **`NOT EXISTS`**:
```sql
SELECT * FROM a WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.id = a.id);
```
(2) **`LEFT JOIN ... IS NULL`**:
```sql
SELECT a.* FROM a LEFT JOIN b ON b.id = a.id WHERE b.id IS NULL;
```
(3) **`EXCEPT`**:
```sql
SELECT id FROM a EXCEPT SELECT id FROM b;
```

The planner usually produces the same plan for (1) and (2). (3) is cleanest when the projection is just the keys; it implicitly deduplicates. **Never `NOT IN`** unless you're certain the subquery has no NULLs.

### Q3. The `NOT IN` NULL hazard. Why does it return zero rows?

`x NOT IN (1, 2, NULL)` is evaluated as `x != 1 AND x != 2 AND x != NULL`. The last comparison evaluates to unknown (NULL), not true. In SQL three-valued logic, `unknown AND anything = unknown`, and `unknown` in `WHERE` excludes the row. So any row of `x` is excluded if the inner set contains a NULL. The fix: filter the NULLs out (`WHERE id NOT IN (SELECT id FROM b WHERE id IS NOT NULL)`) or, better, use `NOT EXISTS` which handles NULLs by checking row-by-row. The senior tell: name this hazard explicitly when reviewing code, never write `NOT IN (subquery)`.

### Q4. "Find rows that appear in both A and B, by id." Pattern.

**`INTERSECT`** is the cleanest form: `SELECT id FROM a INTERSECT SELECT id FROM b`. Returns distinct ids in both. Alternative: `WHERE EXISTS (SELECT 1 FROM b WHERE b.id = a.id)` — equivalent semi-join. Or `JOIN b ON b.id = a.id` with `DISTINCT` — also equivalent. Pick based on what columns you need: `INTERSECT` returns only the projected columns; `JOIN` lets you include columns from both. For "rows from A that have a match in B, but only A's columns", `EXISTS` is the standard form.

### Q5. `EXISTS` vs `IN` for "users who have placed at least one order". Pick.

Modern Postgres treats them identically — both become semi-joins in the plan. Stylistically, `EXISTS` is preferred when the subquery references the outer query (`WHERE EXISTS (SELECT 1 FROM orders WHERE orders.user_id = users.id)`) — it reads as "for each user, does any order exist?" `IN` is preferred for static lists (`WHERE id IN (1, 2, 3)`) or simple set membership. Avoid `IN` against a subquery when ambiguity matters — `EXISTS` is more explicit.

### Q6. Senior interview angle: when does `UNION ALL` lose to a single query?

When the two queries can be combined into one with a `WHERE` clause. Example: `SELECT * FROM orders WHERE status = 'paid' UNION ALL SELECT * FROM orders WHERE status = 'pending'` should be `WHERE status IN ('paid', 'pending')` — one scan instead of two. `UNION ALL` is the right move only when the two queries differ in `FROM` (different tables) or projections (different computed columns). The senior tell: scan for the "one query with a wider filter" rewrite before reaching for `UNION ALL`.

---

## Cohort, Funnel & Retention

### Summary

**What this topic covers**

The analytical patterns for measuring user behaviour over time. Sub-patterns: (1) **cohort definition** — group users by signup week / first-action week; (2) **cohort matrix** — pivot showing retention rate per cohort per week offset; (3) **funnel analysis** — count users at each step in a sequence; (4) **DAU/WAU/MAU** — distinct active users per time window; (5) **N-day retention** — users active on day 0 who returned on day N. The 6 questions cover the templates, the `GENERATE_SERIES`-driven cohort matrix, the funnel ambiguity ("same session" vs "ever"), the N-day vs N-th-day distinction, and the senior-level "compute retention without window functions" challenge.

**Mental model**

Cohort analysis answers "of users who did X at time T0, what fraction did Y at time T0+N?" The cohort is the group of users who did X in a specific time window (week, month). For each cohort, you measure retention at week offsets 0, 1, 2, etc. The query template: (1) compute each user's cohort (e.g. `DATE_TRUNC('week', signup_date)`), (2) compute each user's action weeks (`DATE_TRUNC('week', action_date)`), (3) join cohort to actions, compute week offset, (4) aggregate to cohort × offset cells with distinct user counts, (5) divide by cohort size for percentages. The `GENERATE_SERIES` trick: to ensure all (cohort, offset) cells appear (including zeros), `LEFT JOIN` against the full cartesian of cohorts × offsets. For **funnel analysis**, the question is "how many users completed step N given they started?" Two valid interpretations: (a) "ever did step N" (no order required), (b) "did step N after step N-1" (order matters). The order-matters version is harder and typically uses per-user `MIN(ts)` per step, then filters for monotonic ordering. For **N-day retention** ("users active on day 0 who returned on day N"), the standard is a self-join on user_id with a date difference filter. The senior insight is that cohort analysis is **just pivot on (cohort, offset) of distinct-user counts** — once you frame it that way, the implementation is mechanical.

**Key terms**

- **Cohort** — a group of users defined by a shared first-action time window.
- **Cohort size** — distinct user count in the cohort.
- **Retention rate** — fraction of cohort users still active at week offset N.
- **Week offset** — difference between action week and cohort week, in weeks.
- **Cohort matrix** — pivoted table: rows = cohort weeks, columns = week offsets, cells = retention %.
- **Funnel step** — a designated event type in an ordered sequence.
- **Funnel conversion** — count at step N / count at step N-1.
- **DAU/WAU/MAU** — daily/weekly/monthly active users; `COUNT(DISTINCT user_id)` per window.
- **N-day retention** — fraction of day-0 active users active on exactly day N (or "by day N").
- **Stickiness** — DAU / MAU; how often weekly users return daily.
- **Cohort triangle** — the bottom-right zeros of the cohort matrix where the cohort hasn't yet had N weeks to accumulate data.

**Why interviewers ask this**

Three signals. (1) **Cohort pattern recognition** — "weekly retention by signup cohort" is the dead-on signal; senior candidates name "compute week offset and pivot" in 30 seconds. (2) **Funnel disambiguation** — most funnel prompts hide order ambiguity; senior candidates ask before writing. (3) **Cohort matrix completeness** — naive implementations miss zero-retention cells because of `INNER JOIN` semantics; reaching for `GENERATE_SERIES` + `LEFT JOIN` shows experience with the canonical pitfall.

**Common confusions**

- "Cohort and funnel are the same" — different. Cohort tracks the same users over time; funnel tracks step completion.
- "N-day retention is `WHERE login_date - signup_date = N`" — that's *N-th day* retention; "by N-day" is `<= N`.
- "Cohort matrix is just a `GROUP BY (cohort, offset)`" — misses cohorts with zero retention at some offsets unless you `LEFT JOIN` a series.
- "Funnel is independent of session" — depends on the prompt; "same-session funnel" is much stricter than "ever did step N".
- "Stickiness should be DAU * 30 / MAU" — no, it's just DAU / MAU; the ratio shows retention intensity.
- "I can compute retention without window functions" — yes, with self-joins, but slower; window functions are the standard tool.

**What follows from this topic**

Cohort and funnel analysis recur in every product analytics interview at FAANG and growth-stage companies. Pair this with sessionization (topic 11) for session-bounded funnels, with temporal queries (topic 17) for "as-of" cohort definitions, and with pivot (topic 13) for cohort matrices. If you internalise cohort analysis as "pivot of distinct-user counts on (cohort, offset)", the implementation collapses to standard primitives.

### Q1. "Weekly retention matrix for users who signed up in 2024." Walk the pattern.

```sql
WITH cohorts AS (
  SELECT user_id, DATE_TRUNC('week', signup_date)::date AS cohort_week FROM users
  WHERE signup_date >= '2024-01-01' AND signup_date < '2025-01-01'
),
actions AS (
  SELECT u.cohort_week,
         (DATE_TRUNC('week', l.login_date)::date - u.cohort_week) / 7 AS week_offset,
         l.user_id
  FROM cohorts u JOIN logins l ON l.user_id = u.user_id
),
matrix AS (
  SELECT cohort_week, week_offset, COUNT(DISTINCT user_id) AS active_users FROM actions
  GROUP BY cohort_week, week_offset
)
SELECT cohort_week,
       SUM(active_users) FILTER (WHERE week_offset = 0) AS w0,
       SUM(active_users) FILTER (WHERE week_offset = 1) AS w1,
       SUM(active_users) FILTER (WHERE week_offset = 2) AS w2
FROM matrix GROUP BY cohort_week ORDER BY cohort_week;
```

This is "actions per (cohort × week offset)" pivoted. For percentages, divide each cell by the w0 value per cohort. For zero-fills, `LEFT JOIN` against `GENERATE_SERIES` of all (cohort, offset) combinations.

### Q2. "N-day retention vs N-th day retention." What's the difference?

**N-th day retention**: fraction of day-0 users active on *exactly* day N. `WHERE login_date - signup_date = N`. **By-N-day retention** (also called "rolling N-day"): fraction active on *any day from 1 to N*. `WHERE login_date - signup_date BETWEEN 1 AND N`. Most prompts say "7-day retention" ambiguously; senior candidates ask which definition. The metric definitions matter — Facebook's classic "L7" is users active on at least one day in the trailing 7 days; that's a third definition. Ask before writing.

### Q3. "Funnel: count users who reached signup, then checkout, then purchase, in order." Pattern.

```sql
WITH user_steps AS (
  SELECT user_id,
         MIN(ts) FILTER (WHERE event = 'signup') AS signup_ts,
         MIN(ts) FILTER (WHERE event = 'checkout') AS checkout_ts,
         MIN(ts) FILTER (WHERE event = 'purchase') AS purchase_ts
  FROM events GROUP BY user_id
)
SELECT
  COUNT(signup_ts) AS reached_signup,
  COUNT(checkout_ts) FILTER (WHERE checkout_ts > signup_ts) AS reached_checkout,
  COUNT(purchase_ts) FILTER (WHERE purchase_ts > checkout_ts AND checkout_ts > signup_ts) AS reached_purchase
FROM user_steps;
```

The `FILTER` clauses enforce ordering. For unordered funnel ("ever did each step"), drop the `>` conditions. Conversion rate = each step / previous step.

### Q4. "DAU and MAU per day, with stickiness DAU/MAU." Pattern.

```sql
SELECT day,
       COUNT(DISTINCT user_id) AS dau,
       (SELECT COUNT(DISTINCT user_id) FROM logins WHERE login_date BETWEEN day - INTERVAL '29 days' AND day) AS mau
FROM logins
GROUP BY day;
```

The MAU subquery is a 30-day rolling distinct count, which can't be a window function in standard SQL (no `COUNT(DISTINCT) OVER`). Workaround: precompute a daily distinct-user list, then for each day, `COUNT(DISTINCT)` over the trailing 30 days via a self-join or a clever first-appearance trick. The senior tell: name the "no `COUNT(DISTINCT) OVER`" limitation and propose the workaround.

### Q5. "For each cohort, fill in zeros for weeks with no retained users." Pattern.

`LEFT JOIN GENERATE_SERIES` of (cohort_week, week_offset):

```sql
WITH cohort_size AS (SELECT cohort_week, COUNT(DISTINCT user_id) AS size FROM cohorts GROUP BY cohort_week),
     offsets AS (SELECT generate_series(0, 12) AS week_offset),
     grid AS (SELECT c.cohort_week, o.week_offset FROM cohort_size c CROSS JOIN offsets o),
     retained AS (
       SELECT u.cohort_week, (DATE_TRUNC('week', l.login_date) - u.cohort_week) / 7 AS week_offset,
              COUNT(DISTINCT l.user_id) AS retained
       FROM cohorts u JOIN logins l ON l.user_id = u.user_id
       GROUP BY u.cohort_week, week_offset
     )
SELECT g.cohort_week, g.week_offset, COALESCE(r.retained, 0) AS retained
FROM grid g LEFT JOIN retained r USING (cohort_week, week_offset)
ORDER BY g.cohort_week, g.week_offset;
```

The `grid` CTE is the full (cohort × offset) cartesian; `LEFT JOIN` retained data; `COALESCE` zero-fills. This pattern guarantees no cells are missing in the matrix.

### Q6. Senior interview angle: compute weekly retention without using window functions.

Yes, with self-joins. For each cohort week and offset, count distinct users from `logins` joined to `users.signup_date` where `login_date BETWEEN signup_week_start + offset*7 AND signup_week_start + (offset+1)*7 - 1`. The query is one big `GROUP BY cohort_week, offset` with conditional aggregations. It works but reads worse than the CTE-chain version with window functions. The senior tell: knowing both forms, choosing the readable one for production code, naming the self-join form as the pre-window-function legacy approach.

---

## Temporal Queries & As-Of Joins

### Summary

**What this topic covers**

The patterns for time-aware queries — "what was the state of X at time T", "find the most recent Y before time T", "join two time-series at matching timestamps". Sub-patterns: (1) **as-of join** — for each event in stream A, find the most recent event in stream B at or before A's timestamp; (2) **range overlap** — find rows where a time range intersects a query range; (3) **slowly changing dimension (SCD type 2) point lookup** — given an `(id, valid_from, valid_to)` table, find the row valid at timestamp T; (4) **time-bucketed join** — assign events to time buckets (hour, day) and aggregate; (5) **interval arithmetic** — `INTERVAL` operations, `tstzrange` and `&&` overlap operator. The 6 questions cover the templates, the `LATERAL`-based as-of join, the range overlap check, and the senior-level "what if the same timestamp has multiple rows" tiebreak.

**Mental model**

Temporal queries are the SQL answer to "time as a first-class dimension". The core operation is the **as-of join**: for each row in stream A, find the most recent row in stream B with `B.ts <= A.ts`. In other engines (KDB, Vertica) there's a built-in `ASOF JOIN`; in Postgres you write it with `LATERAL ... ORDER BY ts DESC LIMIT 1`. Range overlap (`tstzrange` with the `&&` operator) is the Postgres-specific way to ask "do these two time ranges intersect?" For **SCD type 2 lookup** ("what was the customer's tier at timestamp T?"), the standard form is `WHERE valid_from <= T AND (valid_to > T OR valid_to IS NULL)`. The senior insight is that **time-bucketing collapses time to a coarser grain** for joining and aggregating — `DATE_TRUNC('hour', ts)` reduces an event stream to hourly buckets, and then standard `GROUP BY` and join patterns apply. The trap with time-based queries is **timezone confusion** — `timestamp` (no tz) and `timestamptz` (with tz) behave differently, and forgetting to coerce one to the other leads to subtle bugs. Always use `timestamptz` for stored timestamps; use `AT TIME ZONE 'UTC'` for explicit conversions.

**Key terms**

- **As-of join** — for each A row, find the most recent B row at or before A's ts.
- **Range overlap** — two time ranges intersect; `tstzrange(a, b) && tstzrange(c, d)`.
- **`LATERAL ... LIMIT 1`** — Postgres pattern for as-of join.
- **SCD type 2** — slowly changing dimension; `(id, value, valid_from, valid_to)` rows.
- **Point-in-time lookup** — find the row valid at timestamp T.
- **Time bucket** — `DATE_TRUNC('hour' | 'day' | 'week', ts)`; coarser-grain timestamp.
- **`timestamptz` vs `timestamp`** — with vs without timezone awareness; mixing is a hazard.
- **`AT TIME ZONE`** — convert timestamp to a specific timezone.
- **`INTERVAL`** — duration type; `ts + INTERVAL '7 days'`, `ts - other_ts` returns interval.
- **`OVERLAPS`** — standard SQL operator for range overlap; verbose syntax.
- **`tstzrange` type** — Postgres range type; supports `&&` (overlap), `@>` (contains), `+` (union).

**Why interviewers ask this**

Three signals. (1) **As-of join recognition** — "most recent X before Y" is dead-on for `LATERAL ... LIMIT 1`; senior candidates write it reflexively. (2) **SCD point-in-time discipline** — the `valid_from <= T AND valid_to > T OR valid_to IS NULL` predicate is the canonical SCD lookup; missing the NULL-end check breaks the query for currently-valid rows. (3) **Range type fluency** — `tstzrange` with `&&` is the Postgres-staff move for "intervals that overlap"; juniors write `(a_start < b_end AND a_end > b_start)` which works but reads worse.

**Common confusions**

- "Most recent X before Y is a self-join" — works but `LATERAL ... LIMIT 1` is cleaner.
- "SCD lookup needs `BETWEEN`" — `BETWEEN` is inclusive; if your SCD ranges are `[from, to)` half-open, `BETWEEN` is wrong.
- "`timestamp` and `timestamptz` are the same" — they're not; `timestamptz` stores UTC, `timestamp` is naive.
- "`DATE_TRUNC` always returns the same type" — it preserves `timestamp` vs `timestamptz`; check the input.
- "Time-bucketed joins are slow" — fast if you index on `DATE_TRUNC('hour', ts)` (functional index).
- "`OVERLAPS` is portable" — yes (standard SQL), but the syntax is verbose and the planner doesn't always optimise it.

**What follows from this topic**

Temporal queries underpin financial as-of reporting, IoT sensor data joins, log analysis, slowly changing dimension lookups in data warehouses, and any "what was the state at time T" question. The `LATERAL ... LIMIT 1` pattern is the workhorse for as-of joins. If you internalise the three temporal primitives (as-of, range overlap, point-in-time SCD), most time-aware prompts collapse to one of them.

### Q1. "For each trade, find the most recent quote before the trade timestamp." As-of join pattern.

**`LATERAL`** in one query:

```sql
SELECT t.*, q.bid, q.ask, q.ts AS quote_ts
FROM trades t
CROSS JOIN LATERAL (
  SELECT * FROM quotes q WHERE q.symbol = t.symbol AND q.ts <= t.ts ORDER BY q.ts DESC LIMIT 1
) q;
```

The `LATERAL` runs per trade, picking the most recent quote with `ts <= trade.ts`. With an index on `(symbol, ts DESC)`, each LATERAL is a single index seek. This is the cleanest as-of join in pure Postgres; KDB+'s `aj` is built-in but the SQL equivalent is just this template.

### Q2. SCD type 2 point-in-time lookup. The predicate?

```sql
SELECT * FROM customer_tier_history
WHERE customer_id = :id
  AND valid_from <= :ts
  AND (valid_to > :ts OR valid_to IS NULL);
```

The `valid_to IS NULL` check is for the *currently valid* row (open-ended range). Forgetting it means you'd miss the current tier. With `tstzrange`, this becomes `WHERE customer_id = :id AND tstzrange(valid_from, valid_to, '[)') @> :ts::timestamptz` — cleaner. Use the half-open `[)` convention to avoid double-counting at boundaries.

### Q3. "Find overlapping bookings for the same room." Range overlap pattern.

**`tstzrange` with `&&`**:

```sql
SELECT a.id, b.id FROM bookings a
JOIN bookings b ON a.room_id = b.room_id AND a.id < b.id
WHERE tstzrange(a.start_ts, a.end_ts, '[)') && tstzrange(b.start_ts, b.end_ts, '[)');
```

The `a.id < b.id` prevents reporting (a, b) and (b, a) as separate overlaps. The `&&` operator is Postgres-specific but indexable with a GiST index on the range expression. The standard SQL form is `WHERE (a.start_ts < b.end_ts AND a.end_ts > b.start_ts)` — equivalent for half-open ranges. Senior tell: prefer `tstzrange` + `&&` when working in Postgres because GiST indexes make range queries fast.

### Q4. "Aggregate events into hourly buckets and join to weather data per hour." Pattern.

`DATE_TRUNC('hour', ts)` on both sides, join on the bucket:

```sql
WITH event_hours AS (
  SELECT DATE_TRUNC('hour', ts) AS hour, COUNT(*) AS event_count FROM events GROUP BY 1
)
SELECT eh.hour, eh.event_count, w.temperature
FROM event_hours eh
JOIN weather w ON DATE_TRUNC('hour', w.ts) = eh.hour;
```

For performance, create a functional index: `CREATE INDEX ON weather (DATE_TRUNC('hour', ts))`. Time-bucketing is the canonical "join two time series at matching grain" pattern; works for daily, weekly, any grain.

### Q5. "Find users whose subscription was active on a specific date." SCD with overlaps.

```sql
SELECT u.* FROM users u
JOIN subscriptions s ON s.user_id = u.id
WHERE tstzrange(s.start_ts, s.end_ts, '[)') @> :query_date::timestamptz;
```

The `@>` operator checks containment. Half-open ranges (`[)`) prevent double-counting at boundary days. For "active during a date range", switch to `&&`: `WHERE tstzrange(s.start_ts, s.end_ts, '[)') && tstzrange(:start, :end, '[)')`. Range types make these queries concise and indexable.

### Q6. Senior interview angle: as-of join with multiple rows at the same timestamp. Tiebreak.

When multiple quotes share the most recent timestamp, `LATERAL ... LIMIT 1` returns one arbitrarily — non-deterministic. The fix: add tiebreak columns to the `ORDER BY`: `ORDER BY q.ts DESC, q.id DESC LIMIT 1`. The senior tell: name the tiebreak problem proactively, choose a tiebreak (latest id, lowest spread, whatever the business prefers), and write it deterministically. Production as-of joins must always have deterministic tiebreaks because non-deterministic results break downstream reconciliation.

---

## Statistical SQL

### Summary

**What this topic covers**

The aggregate functions for statistical computation in pure SQL. Sub-patterns: (1) **percentiles** — `PERCENTILE_CONT(p) WITHIN GROUP (ORDER BY x)` and `PERCENTILE_DISC(p)`; (2) **moving averages** — window functions with `ROWS BETWEEN N PRECEDING`; (3) **correlation and regression** — `corr(x, y)`, `regr_slope(y, x)`, `regr_intercept(y, x)`, `regr_r2(y, x)`; (4) **standard deviation and variance** — `stddev_pop`, `stddev_samp`, `var_pop`, `var_samp`; (5) **histograms** — `width_bucket(x, lower, upper, n)` to assign bucket indices. The 5 questions cover the templates, the `_pop` vs `_samp` distinction, the `PERCENTILE_CONT` vs `PERCENTILE_DISC` choice, and the senior-level "compute mode in SQL" (which isn't a built-in).

**Mental model**

SQL has more statistical functions than most candidates realise. **Percentiles** are the most common interview prompt — `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x)` is the median (interpolated); `PERCENTILE_DISC(0.5)` returns the lower of the two middle values (exact existing value). For per-group percentiles, wrap in `WITHIN GROUP` and use as a regular aggregate or as `OVER (PARTITION BY group)` for per-row computation. **Correlation and regression** are first-class: `regr_slope(y, x)` gives the OLS slope; `regr_r2(y, x)` gives R². These are useful for sanity-checking correlations directly in SQL without exporting to a notebook. **Standard deviation** has population and sample variants — `stddev_pop` divides by N, `stddev_samp` by N-1; sample is the default in `stddev()` (without suffix). **Histograms** via `width_bucket` assign each value to a bucket: `width_bucket(x, 0, 100, 10)` returns 1-10 for x in [0,100], 0 for x < 0, 11 for x > 100. The senior insight is that **most "stats in SQL" prompts are looking for the right built-in** — not custom calculation. Knowing `regr_slope` instead of writing a `SUM(xy) - N*xbar*ybar` formula is the senior tell.

**Key terms**

- **`PERCENTILE_CONT(p) WITHIN GROUP (ORDER BY x)`** — continuous percentile, interpolated.
- **`PERCENTILE_DISC(p) WITHIN GROUP (ORDER BY x)`** — discrete percentile, exact value.
- **Ordered-set aggregate** — `WITHIN GROUP (ORDER BY ...)`; the syntax for percentile-style aggregates.
- **`stddev_pop`** — population standard deviation; divides by N.
- **`stddev_samp`** — sample standard deviation; divides by N-1; default for `stddev()`.
- **`var_pop` / `var_samp`** — population / sample variance.
- **`corr(y, x)`** — Pearson correlation coefficient.
- **`regr_slope(y, x)` / `regr_intercept(y, x)`** — OLS regression coefficients.
- **`regr_r2(y, x)`** — coefficient of determination.
- **`width_bucket(x, lo, hi, n)`** — assign x to one of n equal-width buckets in [lo, hi).
- **`mode() WITHIN GROUP (ORDER BY x)`** — most common value (Postgres-specific, since 9.4).

**Why interviewers ask this**

Three signals. (1) **`PERCENTILE_CONT` reflex** — "median" / "p99" reaches for `PERCENTILE_CONT` immediately; juniors write self-joins. (2) **Regression awareness** — knowing `regr_slope` for "slope of y vs x per group" is a Postgres-staff signal. (3) **Population vs sample discipline** — picking `stddev_pop` vs `stddev_samp` based on whether the data is the full population or a sample shows statistical fluency.

**Common confusions**

- "`PERCENTILE_CONT(0.5)` and `MEDIAN()` are the same" — Postgres doesn't have `MEDIAN()`; use `PERCENTILE_CONT(0.5)`.
- "`stddev` is population by default" — it's sample (`stddev_samp`); for population, use `stddev_pop` explicitly.
- "`PERCENTILE_CONT` and `PERCENTILE_DISC` are interchangeable" — for even-count groups they diverge.
- "Histograms need application code" — `width_bucket` does it in one expression.
- "Correlation in SQL is custom-formula territory" — `corr(y, x)` is built-in.
- "Mode requires `GROUP BY x ORDER BY COUNT(*) DESC LIMIT 1`" — Postgres has `mode() WITHIN GROUP (ORDER BY x)`.

**What follows from this topic**

Statistical SQL is the foundation for in-database analytics that bypass the data-export-to-pandas pattern. Pair this with window frames (topic 8) for rolling stats, with cohort analysis (topic 16) for distribution-per-cohort, and with anomaly detection (variance-based filters). For ad-hoc analytics, knowing the built-in functions saves rewriting standard formulas. If you internalise the percentile, regression, and histogram primitives, most statistical prompts collapse to one-liners.

### Q1. "Median order value per customer." Pattern.

```sql
SELECT customer_id, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY order_value) AS median
FROM orders GROUP BY customer_id;
```

`PERCENTILE_CONT(0.5)` is the standard median. For p95: `PERCENTILE_CONT(0.95)`. For multiple percentiles in one query: `PERCENTILE_CONT(ARRAY[0.5, 0.95, 0.99]) WITHIN GROUP (ORDER BY x)` returns an array. Use `PERCENTILE_DISC` if you need an actual data value (not interpolated).

### Q2. "Per region, the regression slope of revenue against marketing spend." Pattern.

```sql
SELECT region, regr_slope(revenue, marketing_spend) AS slope, regr_r2(revenue, marketing_spend) AS r2
FROM monthly_data GROUP BY region;
```

The argument order in `regr_*` is `(y, x)` — the dependent variable first. `regr_r2` returns the coefficient of determination. Trap: if marketing_spend has zero variance within a region, the slope is undefined (Postgres returns NULL). The senior tell: knowing the function is built-in, naming the `(y, x)` argument order explicitly.

### Q3. `stddev_pop` vs `stddev_samp` — pick when.

`stddev_pop` divides by N — use when the data is the entire population (e.g. "the standard deviation of yesterday's logins across all users"). `stddev_samp` divides by N-1 (Bessel's correction) — use when the data is a sample drawn from a larger population (e.g. "sample mean ± stddev for confidence intervals"). Default `stddev()` is `stddev_samp`. For most analytical queries on operational data (you have all the data, not a sample), `stddev_pop` is conceptually correct, though candidates often default to `stddev_samp` out of habit.

### Q4. "Bucket users by total spend into 10 equal-width buckets between 0 and 10000." Pattern.

```sql
SELECT width_bucket(total_spend, 0, 10000, 10) AS bucket, COUNT(*) AS users
FROM customers GROUP BY bucket ORDER BY bucket;
```

`width_bucket` returns 1-10 for values in [0, 10000), 0 for below, 11 for above. For log-scale buckets, use `width_bucket(log10(spend), 0, 5, 10)` — but watch for `log10(0)` errors. The senior tell: choosing equal-width vs equal-frequency (`NTILE` for the latter) based on the distribution.

### Q5. Senior interview angle: how do you compute the **mode** of a column?

Postgres-specific: `mode() WITHIN GROUP (ORDER BY x)` since version 9.4. Returns the most frequent value. For portability or for multimodal data: `SELECT x FROM (SELECT x, COUNT(*) AS c FROM t GROUP BY x) ORDER BY c DESC LIMIT 1`. For all modes (ties): `SELECT x FROM (SELECT x, COUNT(*) AS c FROM t GROUP BY x) WHERE c = (SELECT MAX(c) FROM (SELECT COUNT(*) AS c FROM t GROUP BY x))`. Senior tell: knowing the built-in `mode()` exists, naming the multimodal edge case.

### Q6. "Rolling 30-day p95 latency per service." Pattern stack.

`PERCENTILE_CONT` doesn't work as a window function in Postgres (it's an ordered-set aggregate, not a window function). Workaround: pre-aggregate latency per (service, day) with daily p95, then use a window function over the daily series for the trailing 30-day average of the daily p95. Exact rolling p95 over raw events requires a self-join or `LATERAL` per day. Recognition signal: rolling percentile is the canonical "stats × window" hard case; pre-aggregate first.

---

## NULL Handling & Three-Valued Logic

### Summary

**What this topic covers**

The subtle but high-stakes rules for handling NULL values in SQL. Sub-patterns: (1) **three-valued logic** — `TRUE`, `FALSE`, `UNKNOWN`; comparisons with NULL return UNKNOWN; (2) **`IS NULL` vs `= NULL`** — only `IS NULL` works; `= NULL` is always UNKNOWN; (3) **`NOT IN` with NULL hazard** — the canonical trap; (4) **NULL-safe equality** — `IS NOT DISTINCT FROM` treats NULL = NULL as TRUE; (5) **NULL in aggregates** — most aggregates skip NULLs, `COUNT(*)` includes them; (6) **NULL in `ORDER BY`** — `NULLS FIRST` / `NULLS LAST` control placement. The 5 questions cover the templates, the `NOT IN` hazard (revisited), the `COALESCE` pattern, and the senior-level "NULL is a different beast from missing data" distinction.

**Mental model**

SQL's NULL is not a value — it's the absence of a value, which means standard comparisons against NULL return UNKNOWN (not TRUE or FALSE). In a `WHERE` clause, UNKNOWN is treated as FALSE, so rows with NULL in the compared column are dropped. This is the source of most NULL bugs. The standard tools: **`IS NULL` / `IS NOT NULL`** — the only safe NULL checks. **`COALESCE(col, default)`** — replace NULLs with a default. **`NULLIF(a, b)`** — returns NULL if `a = b`, else `a`; useful for "treat sentinel values as NULL". **`IS DISTINCT FROM` / `IS NOT DISTINCT FROM`** — NULL-safe equality (`NULL IS NOT DISTINCT FROM NULL` is TRUE). In aggregates, **`COUNT(*)` includes NULL rows, `COUNT(col)` doesn't, and `SUM` / `AVG` / `MIN` / `MAX` skip NULLs**. In `ORDER BY`, NULLs come last by default in `ASC` and first in `DESC` (Postgres convention); use `NULLS FIRST` / `NULLS LAST` to override. The senior insight is that **NULL is a different concept from "missing data" or "zero" or "unknown"** — it specifically means "no value here", and treating it as zero in computation (e.g. `SUM(amount)` when some rows have NULL amount) silently produces wrong totals if the prompt actually expected zero treatment.

**Key terms**

- **Three-valued logic** — `TRUE`, `FALSE`, `UNKNOWN`.
- **`IS NULL` / `IS NOT NULL`** — the only safe NULL checks.
- **`= NULL` / `!= NULL`** — always UNKNOWN; always wrong.
- **`COALESCE(a, b, c, ...)`** — return first non-NULL argument.
- **`NULLIF(a, b)`** — return NULL if `a = b`, else `a`.
- **`IS DISTINCT FROM`** — NULL-safe inequality; `NULL IS DISTINCT FROM 5` is TRUE.
- **`IS NOT DISTINCT FROM`** — NULL-safe equality; `NULL IS NOT DISTINCT FROM NULL` is TRUE.
- **`NOT IN` NULL hazard** — `NOT IN` with a NULL element returns zero rows.
- **NULL-safe `COUNT`** — `COUNT(*)` includes NULL rows; `COUNT(col)` excludes them.
- **`NULLS FIRST` / `NULLS LAST`** — explicit NULL placement in `ORDER BY`.
- **`NOT NULL` constraint** — schema-level NULL prohibition.

**Why interviewers ask this**

Three signals. (1) **NULL-trap awareness** — recognising the `NOT IN` NULL hazard and the `= NULL` mistake is the canonical SQL-correctness test. (2) **`COALESCE` reflex** — handling NULLs in aggregates explicitly (`COALESCE(SUM(x), 0)`) is the senior detail for "no rows = zero, not NULL" prompts. (3) **`IS DISTINCT FROM` fluency** — knowing the NULL-safe equality operator separates senior Postgres engineers from juniors.

**Common confusions**

- "`NULL = NULL` is TRUE" — it's UNKNOWN. NULL never equals anything via `=`.
- "`COUNT(*)` skips NULLs" — it counts all rows including NULL ones; `COUNT(col)` skips NULL `col` values.
- "`SUM` of all NULLs is 0" — it's NULL; use `COALESCE(SUM(x), 0)` for zero-on-empty.
- "NULL in `ORDER BY` is always last" — depends on `ASC`/`DESC` and engine; use `NULLS LAST` explicitly.
- "`!= NULL` excludes NULLs" — it's UNKNOWN; use `IS NOT NULL`.
- "NULL means zero or empty string" — neither; it's the absence of value.

**What follows from this topic**

NULL handling is the substrate for every query. Anti-joins (topic 15) depend on `IS NULL` checks. Outer joins introduce NULLs that propagate downstream. Aggregates have NULL-specific behaviour. If you internalise three-valued logic and the safe-NULL primitives (`IS NULL`, `COALESCE`, `IS DISTINCT FROM`), you'll avoid the silent-correctness bugs that plague NULL-naive code.

### Q1. The `NOT IN` NULL hazard. Show me the broken query and the fix.

```sql
-- BROKEN if the subquery returns any NULL:
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM banned);

-- FIX 1: NOT EXISTS handles NULLs cleanly
SELECT * FROM users WHERE NOT EXISTS (SELECT 1 FROM banned WHERE banned.user_id = users.id);

-- FIX 2: filter NULLs out of the IN list
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM banned WHERE user_id IS NOT NULL);
```

The first form returns zero rows if `banned.user_id` ever contains NULL because `id != NULL` is UNKNOWN. Always prefer `NOT EXISTS` for anti-joins.

### Q2. "Total revenue per region, treating customers with no orders as $0." Pattern.

```sql
SELECT c.region, COALESCE(SUM(o.amount), 0) AS total
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.region;
```

`SUM` of zero rows is NULL, not 0. The `COALESCE` converts NULL to 0. Without it, a region with no orders would show `total = NULL` instead of `total = 0` — silently wrong for downstream aggregations. The senior tell: explicit `COALESCE` on aggregates when no-rows means zero.

### Q3. `NULL = NULL` — what does it return, and how do you check NULL-equality?

`NULL = NULL` returns UNKNOWN, which is FALSE in `WHERE`. For NULL-safe equality, use **`IS NOT DISTINCT FROM`**: `NULL IS NOT DISTINCT FROM NULL` is TRUE; `5 IS NOT DISTINCT FROM 5` is TRUE; `5 IS NOT DISTINCT FROM NULL` is FALSE. Useful for "find rows where col_a equals col_b including the both-NULL case". For inequality with NULL handling: `IS DISTINCT FROM`. These are Postgres-specific but most modern engines have them.

### Q4. `COUNT(*)` vs `COUNT(col)` — when do they diverge?

`COUNT(*)` counts all rows including NULL-only ones. `COUNT(col)` counts rows where `col IS NOT NULL`. On a `LEFT JOIN` where the right side is unmatched, the right-side columns are NULL — so `COUNT(*)` counts everything (including unmatched left rows), but `COUNT(right.id)` counts only matched rows. The senior tell: when explaining counts after `LEFT JOIN`, choose `COUNT(right.key)` to count matches and explain the choice.

### Q5. Senior interview angle: NULL in `ORDER BY`. Sort users by signup_date with NULLs last (no signup means show them at the end).

```sql
SELECT * FROM users ORDER BY signup_date ASC NULLS LAST;
```

Without `NULLS LAST`, Postgres puts NULLs first in `ASC` order (with `NULLS FIRST` being the default for `ASC`... wait, actually for `ASC` the default is `NULLS LAST` in Postgres; for `DESC` it's `NULLS FIRST`). Always specify explicitly to avoid engine-dependence. For MySQL and SQLite, `ORDER BY signup_date IS NULL, signup_date` is a portable trick. Senior tell: write `NULLS LAST` explicitly in production code, name the default behaviour difference across engines.

### Q6. "`AVG` of a column where some rows are NULL — is the result correct?"

`AVG(x)` ignores NULL rows in both the sum and the count, so `AVG` returns the mean of non-NULL values. If the prompt expects NULL = 0, you must `AVG(COALESCE(x, 0))` instead. The distinction matters: 10 rows, 5 NULL, 5 with value 10 → `AVG(x) = 10`, `AVG(COALESCE(x, 0)) = 5`. Recognition signal: any aggregate over a nullable column should be paired with an explicit "treat NULL as what?" decision.

---

## UPSERT, MERGE & Idempotency

### Summary

**What this topic covers**

The write-side patterns for idempotent and conflict-aware inserts. Sub-patterns: (1) **`INSERT ... ON CONFLICT DO NOTHING`** — idempotent insert; (2) **`INSERT ... ON CONFLICT DO UPDATE`** — upsert with merge logic; (3) **`MERGE`** (SQL:2003 standard, Postgres 15+) — multi-action upsert with INSERT/UPDATE/DELETE branches; (4) **`RETURNING`** — get the inserted/updated rows back; (5) **CTE-based delete-then-insert** — alternative pattern when conflict semantics don't fit. The 5 questions cover the templates, the `ON CONFLICT` vs `MERGE` choice (PG 15+ has both), the `EXCLUDED` pseudo-table, and the senior-level "what's the difference between `MERGE` and upsert".

**Mental model**

Idempotent writes are the foundation of safe retries — if a client retries an insert after a timeout, the second insert should not create a duplicate. The canonical Postgres form is **`INSERT ... ON CONFLICT (col) DO NOTHING`** or **`DO UPDATE SET ...`**. The `(col)` is the conflict target — usually a primary key or unique constraint. In `DO UPDATE`, the `EXCLUDED` pseudo-table references the would-be-inserted row; you write things like `SET amount = EXCLUDED.amount, updated_at = NOW()`. **`MERGE`** (Postgres 15+) is the SQL standard form that supports multiple actions in one statement: `WHEN MATCHED THEN UPDATE`, `WHEN NOT MATCHED THEN INSERT`, `WHEN MATCHED AND condition THEN DELETE`. It's more flexible than `ON CONFLICT` but more verbose, and it doesn't have the simple "conflict target → action" semantics; instead, it joins source to target via `USING (...) ON ...`. The choice: use `ON CONFLICT` for the common idempotent-insert and upsert cases; reach for `MERGE` when you have multiple actions or complex matching logic. **`RETURNING`** appends "give me back the affected rows" — invaluable for inserts where you need the generated id, and for upserts where you need to know which rows were inserted vs updated (via the `xmax = 0` trick or a tagging column). The senior insight is that **idempotency requires a unique constraint on the natural key** — without it, `ON CONFLICT` has nothing to detect, and concurrent inserts can still create duplicates.

**Key terms**

- **`INSERT ... ON CONFLICT (col) DO NOTHING`** — idempotent insert; ignore duplicates.
- **`INSERT ... ON CONFLICT (col) DO UPDATE SET ...`** — upsert; update on conflict.
- **`EXCLUDED`** — pseudo-table referencing the would-be-inserted row in `DO UPDATE`.
- **`MERGE INTO target USING source ON ...`** — standard SQL multi-action statement.
- **`WHEN MATCHED THEN UPDATE/DELETE`** — `MERGE` branches.
- **`WHEN NOT MATCHED THEN INSERT`** — `MERGE` branch for new rows.
- **`RETURNING *`** — append affected rows to the result set.
- **Idempotent insert** — safe to retry; no duplicates on second run.
- **Natural key** — application-meaningful unique identifier (email, sku, etc.).
- **Conflict target** — the column(s) or unique constraint on which conflict is detected.
- **`xmax = 0` trick** — distinguish inserted vs updated rows in `RETURNING`; `xmax = 0` means inserted.

**Why interviewers ask this**

Three signals. (1) **Idempotency reflex** — recognising that retry-safe inserts need `ON CONFLICT` is the system-design signal. (2) **`MERGE` vs `ON CONFLICT` discipline** — knowing both, choosing `ON CONFLICT` for common cases and `MERGE` for complex multi-action logic. (3) **`RETURNING` awareness** — most candidates don't know it exists; knowing it lets you avoid the round-trip "insert then select the id" pattern.

**Common confusions**

- "`ON CONFLICT DO UPDATE` is the same as `UPDATE ... INSERT IF NOT FOUND`" — atomically yes, but you need a unique constraint or the upsert can race.
- "`MERGE` is the same as `ON CONFLICT`" — `MERGE` is the SQL standard and supports DELETE branches; `ON CONFLICT` is Postgres-specific and simpler.
- "Idempotency works without a unique constraint" — no; concurrent inserts can both succeed before the conflict check.
- "`EXCLUDED` is a real table" — it's a pseudo-table, only valid inside `ON CONFLICT DO UPDATE`.
- "`RETURNING` works on every engine" — Postgres-specific; SQL Server has `OUTPUT`.
- "I can update multiple rows with `MERGE`" — yes, but each source row maps to at most one target row.

**What follows from this topic**

Upsert and `MERGE` underpin event ingestion pipelines (replay-safe inserts), slowly-changing-dimension updates, and any "create-or-update" API. Pair this with transactions and isolation levels (covered in the Postgres primer) for concurrent-safety guarantees. If you internalise `ON CONFLICT DO UPDATE` for simple upserts and `MERGE` for multi-action complex cases, write-side idempotency becomes mechanical.

### Q1. "Idempotent insert of a webhook event by external_id." Pattern.

```sql
INSERT INTO events (external_id, payload, received_at)
VALUES (:ext_id, :payload, NOW())
ON CONFLICT (external_id) DO NOTHING;
```

Requires a unique constraint on `external_id`. The retry-safety: if the client retries due to a timeout, the second call hits the conflict and silently skips. Use `RETURNING id` if you need the inserted (or existing) id back. For "update the existing row on retry", switch to `DO UPDATE SET payload = EXCLUDED.payload`.

### Q2. "Upsert a customer record by email, updating their name and last-seen timestamp." Pattern.

```sql
INSERT INTO customers (email, name, last_seen)
VALUES (:email, :name, NOW())
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name, last_seen = EXCLUDED.last_seen
RETURNING id, (xmax = 0) AS was_inserted;
```

`EXCLUDED.name` is the would-be-inserted name. `xmax = 0` is true for inserted rows, false for updated — useful for branching on the caller side. The senior tell: knowing `EXCLUDED` and the `xmax` trick.

### Q3. `INSERT ... ON CONFLICT` vs `MERGE`. When to reach for `MERGE`?

`ON CONFLICT` is the Postgres-specific simpler form — one source row at a time, one conflict target, two branches (do nothing / do update). `MERGE` (SQL standard, PG 15+) is the multi-row, multi-action form:

```sql
MERGE INTO customers c
USING staging s ON c.email = s.email
WHEN MATCHED AND s.is_deleted THEN DELETE
WHEN MATCHED THEN UPDATE SET name = s.name, last_seen = s.updated_at
WHEN NOT MATCHED THEN INSERT (email, name, last_seen) VALUES (s.email, s.name, s.updated_at);
```

Use `MERGE` for ETL-style bulk merges and when you need a DELETE branch. Use `ON CONFLICT` for single-row idempotent inserts. The senior tell: knowing both, choosing the simpler form when it suffices.

### Q4. "Insert a row and return the generated id without a round-trip." Pattern.

**`RETURNING id`**:

```sql
INSERT INTO orders (customer_id, amount) VALUES (:cid, :amt) RETURNING id;
```

Returns the generated id (from a serial / identity / uuid default) in the same statement. Without `RETURNING`, you'd need `INSERT ... RETURNING currval('seq')` or a separate `SELECT` — both worse. For upserts with `ON CONFLICT`, `RETURNING *` returns the row whether inserted or updated. The senior tell: knowing `RETURNING` exists and using it instead of round-tripping.

### Q5. Senior interview angle: an upsert race condition. Without a unique constraint, can `ON CONFLICT` still race?

Yes. `ON CONFLICT` requires a unique constraint as the conflict target; without one, you can't write `ON CONFLICT (col)`. Without a unique constraint, two concurrent `INSERT`s of the same logical row both succeed because neither sees the other's uncommitted row (depends on isolation level). The fix is **a unique constraint** at the schema level — the database enforces it, so concurrent inserts serialise on the index. The senior tell: never assume "rare event" idempotency without a unique constraint; race conditions show up in production at scale. Always pair `ON CONFLICT` with a matching `UNIQUE` index.

### Q6. "Conditionally update only when the incoming row is newer than the existing one." Pattern.

`ON CONFLICT DO UPDATE` with a `WHERE` clause on the update:

```sql
INSERT INTO state (key, value, updated_at) VALUES (:k, :v, :ts)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
WHERE state.updated_at < EXCLUDED.updated_at;
```

The `WHERE` filters within the conflict-update branch — older incoming writes are no-ops. Recognition signal: last-write-wins by timestamp → conditional `DO UPDATE WHERE`. Senior tell: knowing the `WHERE` clause on `DO UPDATE` exists.

---

## JSON & JSONB Patterns

### Summary

**What this topic covers**

The patterns for querying, indexing, and updating JSONB columns in Postgres. Sub-patterns: (1) **path extraction** — `->`, `->>`, `#>`, `#>>`, `jsonb_path_query`; (2) **containment and existence** — `@>`, `?`, `?|`, `?&` with GIN indexes; (3) **`JSON_TABLE`** (PG 17+) — convert JSON to rows in `FROM` clause, SQL-standard; (4) **JSONB updates** — `jsonb_set`, `||` merge, `-` delete; (5) **indexing strategies** — GIN on JSONB column for containment, BTREE on specific extracted paths for equality. The 6 questions cover the templates, the `->` vs `->>` distinction (jsonb vs text), the `@>` containment indexing trick, and the senior-level "when does JSONB become the wrong storage model".

**Mental model**

JSONB is Postgres's binary JSON type — fast to query, indexable, and lets you store semi-structured data without a fixed schema. The two extraction operators are **`->`** (returns JSONB) and **`->>`** (returns text); use `->` when chaining further JSONB operations, `->>` when you need a final text value. **Containment** (`@>`) is the workhorse query: `data @> '{"status": "paid"}'` returns rows where the JSONB contains that subdocument. A GIN index on the JSONB column makes this fast for any containment query. **`JSON_TABLE`** (PG 17+) is the standard SQL way to convert JSON arrays/objects to rows in a `FROM` clause — `SELECT * FROM JSON_TABLE(jsondata, '$.items[*]' COLUMNS (...))` extracts each array element as a row. Before PG 17, the Postgres-specific equivalent is `jsonb_array_elements()` or `jsonb_path_query()`. **JSONB updates** are awkward in SQL — you read the value, modify it in application code, and write it back, or use `jsonb_set(data, '{path,subpath}', new_value)` for targeted in-database updates. The **senior insight** is that JSONB is the right choice when (a) the schema is genuinely flexible (user-provided form data, event payloads), or (b) you have sparse columns that would waste space as actual columns. For data that's stable and accessed by specific paths, **normalised columns are faster and clearer** — JSONB pays a parsing cost on every access. Don't store JSONB just because "it's flexible"; pay the schema design cost upfront.

**Key terms**

- **`->`** — extract JSONB field; returns JSONB.
- **`->>`** — extract JSONB field as text.
- **`#>`** / **`#>>`** — extract via path (array of keys); JSONB / text.
- **`@>`** — containment operator; "left contains right".
- **`?`** — key existence at top level.
- **`?|` / `?&`** — any-of / all-of key existence.
- **`jsonb_path_query(j, '$.path')`** — JSONPath expressions; PG 12+.
- **`JSON_TABLE`** — SQL standard; PG 17+; convert JSON to relational rows.
- **`jsonb_set(j, path, val)`** — update a JSONB value at the specified path.
- **`jsonb_array_elements(j)`** — set-returning; one row per array element.
- **GIN index on JSONB** — `CREATE INDEX ON t USING GIN (col)`; accelerates `@>`, `?`.
- **Functional index** — `CREATE INDEX ON t ((col->>'status'))`; accelerates equality on a specific extracted path.

**Why interviewers ask this**

Three signals. (1) **`@>` containment reflex** — for JSONB filtering, senior candidates write `WHERE data @> '{"key": "value"}'`; juniors write `(data->>'key') = 'value'` (works but less indexable on multi-key queries). (2) **GIN index awareness** — knowing to add a GIN index on the JSONB column is the perf signal. (3) **Schema judgement** — recognising when JSONB is the wrong storage choice (stable schema, accessed by fixed paths) is the staff-level architecture call.

**Common confusions**

- "`->` and `->>` are the same" — `->` returns JSONB; `->>` returns text. Chain mistakes are common.
- "GIN indexes work on everything in JSONB" — they accelerate `@>`, `?`, `?|`, `?&`; not arbitrary path equality.
- "JSONB is the same as JSON" — `JSON` stores raw text (preserves whitespace, order); `JSONB` parses to binary (faster query, slight insert overhead).
- "I can index a specific path easily" — yes, with a functional index `((col->>'status'))`, not the default GIN.
- "`jsonb_set` is fast" — relatively, but updating JSONB is more expensive than updating a column because the whole JSONB value is rewritten.
- "`JSON_TABLE` works in old Postgres" — only PG 17+; for earlier, use `jsonb_array_elements` or `jsonb_path_query`.

**What follows from this topic**

JSONB is the foundation for flexible-schema patterns — event payloads, user preferences, dynamic forms. Pair with `LATERAL` joins to expand JSON arrays into rows in queries. The `JSON_TABLE` arrival in PG 17 brings Postgres in line with the SQL standard. If you internalise the four primitives (extract with `->`, contain with `@>`, expand with `jsonb_array_elements` / `JSON_TABLE`, update with `jsonb_set`), most JSONB queries become straightforward.

### Q1. "Find all orders where the JSONB metadata contains `{"source": "mobile"}`." Pattern + index.

```sql
SELECT * FROM orders WHERE metadata @> '{"source": "mobile"}';
```

With a GIN index: `CREATE INDEX orders_metadata_gin ON orders USING GIN (metadata)`. The `@>` operator is index-aware and the planner uses the GIN index for any containment query. Alternative: `WHERE metadata->>'source' = 'mobile'` — semantically equivalent but only indexable with a specific functional index `ON orders ((metadata->>'source'))`. For multi-key filters, `@>` is much more flexible.

### Q2. "Extract the `email` field as text from a JSONB column." Pattern.

```sql
SELECT data->>'email' AS email FROM users;
```

`->>` returns text directly; `->` would return JSONB which needs further casting. For nested fields: `data->'profile'->>'email'` or `data#>>'{profile,email}'`. The `#>>` form is cleaner for deep paths. Both index identically — pick the one that reads better.

### Q3. PG 17's `JSON_TABLE` — what problem does it solve?

It converts a JSON array into relational rows in a `FROM` clause, the standard SQL way:

```sql
SELECT *
FROM orders, JSON_TABLE(
  items, '$[*]' COLUMNS (
    product_id INT PATH '$.product_id',
    qty INT PATH '$.qty',
    price NUMERIC PATH '$.price'
  )
) jt;
```

Before PG 17, the Postgres-specific equivalent was `jsonb_to_recordset` or `jsonb_array_elements` + manual casting — verbose and non-standard. `JSON_TABLE` is concise, standard, and works across modern engines. The senior tell: knowing the PG 17+ feature exists and naming the pre-17 workaround.

### Q4. "Update the `status` field inside a JSONB column to 'paid'." Pattern.

```sql
UPDATE orders SET metadata = jsonb_set(metadata, '{status}', '"paid"', true)
WHERE id = :id;
```

The `'{status}'` is the path (array of keys); the value `'"paid"'` is JSONB-encoded (note the quoted JSON string). The `true` creates the key if missing. For nested: `jsonb_set(metadata, '{customer,tier}', '"gold"')`. Trap: forget the JSON quoting and you pass a literal text "paid", which becomes invalid JSON. Trap 2: `jsonb_set` returns the new value; you need `SET metadata = jsonb_set(...)`, not `SET jsonb_set(...) = ...`.

### Q5. "Expand a JSONB array column to one row per element." Pattern.

**`jsonb_array_elements`** or **`JSON_TABLE`** (PG 17+):

```sql
-- PG <17
SELECT o.id, elem
FROM orders o, jsonb_array_elements(o.items) AS elem;

-- PG 17+
SELECT o.id, jt.product_id, jt.qty
FROM orders o, JSON_TABLE(o.items, '$[*]' COLUMNS (product_id INT PATH '$.product_id', qty INT PATH '$.qty')) jt;
```

The `LATERAL` is implicit here because the right side references the left. For filtering on the expanded element: add a `WHERE elem->>'category' = 'electronics'`. This is the canonical "JSONB array to rows" pattern.

### Q6. Senior interview angle: when is JSONB the wrong choice?

When (1) the schema is stable and known — columns are faster, clearer, and type-safe. (2) You access specific fields frequently and join on them — JSONB extraction has parsing overhead. (3) You need to enforce constraints across fields — column constraints (`CHECK`, `FOREIGN KEY`) don't apply to JSONB sub-fields. (4) The data has consistent structure with no missing fields — sparse columns are better than JSONB for dense data. (5) Query patterns evolve — adding a column for a frequently-queried field is straightforward; refactoring JSONB to columns is migration work. The senior tell: explicitly evaluate "does the schema vary?" before defaulting to JSONB; reach for columns first, JSONB only for genuinely variable shapes.

---

## Postgres-Specific Power Features

### Summary

**What this topic covers**

The Postgres-specific features that aren't in standard SQL but separate staff Postgres engineers from juniors. Sub-patterns: (1) **`DISTINCT ON`** — top-1 per group in one line; (2) **`FILTER (WHERE ...)`** clause on aggregates; (3) **`GENERATE_SERIES`** for time and number series; (4) **`tstzrange` and `daterange`** with `&&` overlap; (5) **`LATERAL`** subqueries; (6) **array operators** (`ANY`, `ALL`, `array_agg`, `UNNEST`); (7) **`EXCLUDE` constraints** with GiST for non-overlapping reservations; (8) **`COPY` for bulk load**; (9) **`LISTEN/NOTIFY`** for pub/sub; (10) **partial indexes** — `CREATE INDEX ... WHERE`. The 6 questions cover the recognition layer for each — when does the prompt smell of one of these features.

**Mental model**

Postgres has dozens of features beyond ANSI SQL that make queries shorter and cleaner. The pattern recognition trick: **for every common SQL prompt, ask "is there a Postgres-specific feature that does this in one line?"** "Top-1 per group" → `DISTINCT ON`. "Conditional count" → `FILTER`. "Generate sequence" → `GENERATE_SERIES`. "Overlapping ranges" → `tstzrange` + `&&`. "Per-row dependent set" → `LATERAL`. "Array membership" → `= ANY(array)`. "Prevent overlapping bookings at schema level" → `EXCLUDE USING GIST`. "Bulk load" → `COPY` (10-100x faster than `INSERT`). "Reactive trigger" → `LISTEN`/`NOTIFY`. "Index only some rows" → partial index `WHERE`. The **senior insight** is that these aren't tricks — they're the standard tools when working in Postgres. A staff Postgres engineer reaches for them reflexively; a junior writes the verbose portable form. The choice is conscious: portability vs concision. For Postgres-only codebases, concision wins.

**Key terms**

- **`DISTINCT ON (key)`** — Postgres-only top-1 per group.
- **`FILTER (WHERE ...)`** — standard SQL but Postgres adopted early; per-aggregate condition.
- **`GENERATE_SERIES(start, end, step)`** — set-returning function for sequences.
- **`tstzrange` / `daterange`** — Postgres range types; `&&` overlap.
- **`LATERAL`** — correlated subquery in `FROM` (standard but Postgres has clean syntax).
- **`= ANY(array)` / `= ALL(array)`** — Postgres array comparison; faster than `IN` for arrays.
- **`array_agg(col ORDER BY ...)`** — collect group values into an array.
- **`UNNEST(array)`** — expand array to rows.
- **`EXCLUDE USING GIST (room WITH =, during WITH &&)`** — schema-level non-overlap constraint.
- **`COPY ... FROM STDIN`** — fastest bulk load form.
- **`LISTEN channel` / `NOTIFY channel, 'msg'`** — Postgres pub/sub.
- **Partial index** — `CREATE INDEX ... WHERE active = true`; index a subset of rows.

**Why interviewers ask this**

Three signals. (1) **`DISTINCT ON` reflex** — for top-1 per group, Postgres candidates write it; portable-only candidates don't know it. (2) **`EXCLUDE` awareness** — schema-level non-overlapping constraints (no double-bookings) are an architectural signal — most candidates would enforce this in application code. (3) **Bulk load discipline** — recognising `COPY` for ETL ingestion vs `INSERT ... VALUES (...), (...), ...` is the perf-aware tell.

**Common confusions**

- "`DISTINCT ON` is the same as `DISTINCT`" — totally different.
- "`FILTER` is Postgres-only" — it's standard SQL 2003; Postgres just had it earlier.
- "`GENERATE_SERIES` is for testing only" — it's the canonical "generate cohort grid" / "fill missing days" tool.
- "`EXCLUDE` constraints are exotic" — they're the right tool for booking systems, schedule deduplication.
- "`COPY` is for command-line only" — `COPY FROM STDIN` is callable from drivers and is the bulk-load standard.
- "Partial indexes are micro-optimisation" — they're the right move when most rows have a status and you only query for one.

**What follows from this topic**

Postgres-specific features compound — knowing 10 of them means most query rewrites become one-liners. Pair with the query plan reading topic (next) — knowing the features is half the battle; knowing when the planner uses them is the other half. If you internalise these as "always check if there's a Postgres feature for this prompt", your queries get shorter and faster.

### Q1. "Top product per category" — Postgres-only one-liner.

**`DISTINCT ON (category) ... ORDER BY category, revenue DESC`**:

```sql
SELECT DISTINCT ON (category) category, product_name, revenue FROM products ORDER BY category, revenue DESC;
```

One line, no CTE, no window function. The portable equivalent needs a CTE with `ROW_NUMBER`. With an index on `(category, revenue DESC)`, this is the cheapest plan because Postgres can stop after the first row per category group.

### Q2. "Prevent overlapping bookings for the same room at the schema level." Pattern.

**`EXCLUDE USING GIST`** with a range column:

```sql
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  during tstzrange NOT NULL,
  EXCLUDE USING GIST (room_id WITH =, during WITH &&)
);
```

The constraint prevents any two rows from having the same `room_id` *and* overlapping `during` ranges. A regular `UNIQUE` only checks equality; `EXCLUDE` is the generalisation. The senior tell: knowing this exists and reaching for schema-level enforcement instead of application-code checks (which have race conditions).

### Q3. "Bulk load 10M rows from a CSV." Postgres pattern.

**`COPY FROM`**:

```sql
COPY events (col1, col2, col3) FROM '/path/to/file.csv' WITH (FORMAT csv, HEADER true);
-- Or from STDIN via driver:
COPY events (col1, col2, col3) FROM STDIN WITH (FORMAT csv);
```

`COPY` is 10-100x faster than `INSERT` because it bypasses the SQL parser per row, uses a streaming protocol, and batches WAL writes. For loaded data exceeding millions of rows, `COPY` is non-negotiable. The senior tell: knowing this and reaching for it reflexively for any bulk-load scenario.

### Q4. "Find users in array of allowed roles." Pattern.

**`= ANY(array)`**:

```sql
SELECT * FROM users WHERE role = ANY(ARRAY['admin', 'moderator', 'editor']);
```

Equivalent to `IN ('admin', 'moderator', 'editor')` but works on arbitrary arrays including those returned from subqueries. For "all of these tags": `tags @> ARRAY['urgent', 'priority']` (array containment). For "any of these tags": `tags && ARRAY['urgent', 'priority']` (array overlap). Array operators are first-class in Postgres.

### Q5. "Generate one row per day for the last 30 days." Pattern.

**`GENERATE_SERIES`**:

```sql
SELECT d::date AS day FROM GENERATE_SERIES(CURRENT_DATE - 29, CURRENT_DATE, '1 day'::interval) d;
```

For numeric: `GENERATE_SERIES(1, 100)`. For arbitrary step: `GENERATE_SERIES(1, 100, 5)`. Use as the left side of a `LEFT JOIN` to zero-fill missing values in time series. The senior tell: reaching for `GENERATE_SERIES` whenever the prompt mentions "every day", "every hour", or "all values in range".

### Q6. Senior interview angle: when does a partial index outperform a regular index?

When most rows have a common value and you query for the rare one. Example: `CREATE INDEX active_users_email ON users (email) WHERE active = true`. If 90% of users are inactive, the partial index is 10x smaller than a full index on `(email)` filtered by `active = true`. The planner uses it for queries like `WHERE active = true AND email = 'x'`. For booleans where you mostly query for one value, partial indexes are dead-on. The senior tell: pattern-match "frequent filter on a column with one common value" → partial index.

---

## Query Plan Reading & Index Strategy

### Summary

**What this topic covers**

The pattern recognition layer for performance debugging — given an `EXPLAIN ANALYZE` plan, identify what's slow and which index would fix it. Sub-patterns: (1) **Sequential Scan** on a large table when an index should be available; (2) **Hash Join vs Nested Loop vs Merge Join** — when each is right; (3) **Sort node before Limit** — usually a missing-index symptom for top-N queries; (4) **Index Scan vs Bitmap Index Scan vs Index Only Scan** — what each means; (5) **Buffers and rows** — the cost-vs-actual gap that reveals planner mis-estimates; (6) **EXPLAIN BUFFERS** — see actual I/O; (7) common index types — BTREE for ordering, GIN for JSONB/arrays, GIST for ranges, BRIN for huge sorted-by-time tables. The 5 questions cover the templates, the Hash vs Nested Loop signal, the index-only scan requirement, and the senior-level "the planner picked the wrong plan, what do I do".

**Mental model**

Query plan reading is pattern recognition on the planner's output. The plan is a tree of operators (scans at the leaves, joins / aggregates / sorts in the middle, project / limit at the top). For each operator, `EXPLAIN ANALYZE` reports cost estimate, actual rows, actual time, and buffers. The **first signal** is a **Seq Scan on a large table** — almost always wrong, fix with an index on the filter column. The **second signal** is a **Sort followed by a small Limit** — fix with an index whose order matches the `ORDER BY` so the sort goes away. The **third signal** is **Rows estimate vs actual diverging by 10x or more** — the planner has bad statistics; `ANALYZE` the table or add extended statistics. **Join types**: **Hash Join** is the default for equi-joins on large datasets; **Nested Loop** wins when one side is tiny and the other has an index on the join key; **Merge Join** wins when both sides are pre-sorted (common after composite index scans). For **JSONB containment**, GIN is the only index that helps. For **range overlap (`&&`)**, GiST is the index of choice. For **billion-row append-only tables sorted by time**, BRIN is the right index — tiny on disk, perfect for range scans on the sort key. The **senior insight** is that index strategy is **about what the planner can use, not what looks right** — a composite index `(a, b)` accelerates `WHERE a = 1`, `WHERE a = 1 AND b = 2`, and `WHERE a = 1 ORDER BY b`, but **not** `WHERE b = 2` alone. Index ordering matters.

**Key terms**

- **`EXPLAIN ANALYZE`** — runs the query and reports actual rows + time + buffers.
- **`EXPLAIN (ANALYZE, BUFFERS)`** — adds I/O page counts.
- **Seq Scan** — full table scan; expensive on large tables.
- **Index Scan** — scan via index; returns rows one at a time.
- **Index Only Scan** — returns directly from index without touching heap; needs covering index.
- **Bitmap Index Scan + Bitmap Heap Scan** — for multi-row filters; collect tuple ids in a bitmap, then fetch heap pages in order.
- **Hash Join** — build hash on smaller side, probe with larger; equi-join on big data.
- **Nested Loop** — outer for each, inner indexed lookup; great when outer is tiny.
- **Merge Join** — both sides sorted on join key; cheap if sort is already there.
- **Sort node** — explicit sort; expensive; eliminate with matching index.
- **BTREE** — default; for equality and range.
- **GIN** — JSONB containment, full-text, array.
- **GiST** — range overlap, geographic.
- **BRIN** — block range index; huge tables sorted by time/sequence.

**Why interviewers ask this**

Three signals. (1) **Plan-reading reflex** — given a slow query, senior candidates read the plan first, juniors guess at indexes. (2) **Composite index awareness** — knowing that `(a, b)` doesn't help `WHERE b = ?` alone is the canonical index trap. (3) **Index-type judgement** — picking GIN for JSONB containment vs BRIN for time-series vs BTREE for equality is the staff-level signal.

**Common confusions**

- "Index Scan is always faster than Seq Scan" — on small tables, Seq Scan wins (no random I/O).
- "Adding an index always helps" — indexes slow writes and use space; only add when query plans justify.
- "Composite index `(a, b)` helps `WHERE b = ?`" — no; first column must be in the filter.
- "Hash Join is always the best join" — Nested Loop wins for small outer × indexed inner.
- "`EXPLAIN` shows actual performance" — only `EXPLAIN ANALYZE` does; bare `EXPLAIN` shows estimates only.
- "Sort before LIMIT is fine" — for top-N queries, an index aligned with `ORDER BY` eliminates the sort entirely.

**What follows from this topic**

Query plan reading is the foundation for any performance work. Pair with index types (BTREE, GIN, GiST, BRIN) for the right tool per data shape. The Postgres primer covers MVCC, statistics, and VACUUM at the operational depth; this primer covers the recognition-layer "given this plan, what's wrong?". If you internalise the four common plan smells (Seq Scan on big table, Sort before Limit, rows estimate way off, Hash Join with build side too big), you'll diagnose 80% of slow queries.

### Q1. The plan shows `Seq Scan on orders (cost=..rows=10000000)` for a query with `WHERE customer_id = 42`. What's wrong?

**Missing index on `customer_id`**. Add: `CREATE INDEX ON orders (customer_id)`. After `ANALYZE`, the planner switches to Index Scan and reads only the matching rows. The senior tell: name "Seq Scan on a large table with a selective filter" as the smell, propose the index, verify with `EXPLAIN ANALYZE`. For very selective filters (one row in millions), the index is non-negotiable; for non-selective filters (half the table), Seq Scan can actually be the right plan.

### Q2. The plan shows `Sort ... -> Limit 10`. What's the index fix?

**Match the `ORDER BY` with a composite index**. For `ORDER BY revenue DESC LIMIT 10`: `CREATE INDEX ON products (revenue DESC)`. The planner now scans the index in order and stops after 10 rows — no sort, no full scan. For `ORDER BY category, revenue DESC LIMIT 10 per category`: `CREATE INDEX ON products (category, revenue DESC)` — the composite supports both the partition and the ordering. The senior tell: "Sort before Limit is the canonical missing-index smell for top-N queries".

### Q3. The composite-index trap. Why doesn't `CREATE INDEX ON t (a, b)` help `WHERE b = 5`?

Composite indexes are sorted by `a` first, then `b` within each `a`. Without a constraint on `a`, you'd need to scan every `a` value's section of the index to find `b = 5` — equivalent to scanning the whole index, which the planner declines in favour of a heap Seq Scan. The fix: `CREATE INDEX ON t (b)` for `b`-only queries, or `CREATE INDEX ON t (b, a)` if you want one index for `WHERE b = ?` and `WHERE b = ? AND a = ?`. The senior tell: knowing the leftmost-prefix rule for composite indexes.

### Q4. The plan shows `Hash Join` between two 10M-row tables. Is that right?

Probably yes — Hash Join is the default for large equi-joins. The signal that it's *wrong* would be (a) one side is small (a few thousand rows) and indexed on the join key — Nested Loop wins; (b) both sides are sorted on the join key (via index scans) — Merge Join wins; (c) the hash table doesn't fit in `work_mem` and spills to disk — increase `work_mem` for that session or rewrite the query to filter first. For 10M × 10M with neither side small or pre-sorted, Hash Join is the right plan.

### Q5. Senior interview angle: when do you reach for BRIN over BTREE?

When the table is huge (billions of rows), append-only, and the rows are physically stored in roughly sorted order of some column (typically a timestamp or sequence id). BRIN stores min/max per block range, so a 10TB table's index is a few MB. Queries like `WHERE ts BETWEEN ... AND ...` can skip whole block ranges. The tradeoff: BRIN can't be used for point lookups efficiently (it's a coarse-grained index); BTREE wins there. The senior tell: recognising "append-only, time-ordered, multi-billion rows" → BRIN; "moderate size, point lookups" → BTREE.

### Q6. The plan shows `Rows Removed by Filter: 9000000` on an Index Scan. Diagnosis?

The index returned 9M rows that the post-index filter rejected — the index is poorly selective for this query. Fix: extend the index to include the additional filter column so the index can pre-filter. E.g. for `WHERE customer_id = 42 AND status = 'paid'` with an index on `(customer_id)`, switch to `(customer_id, status)`. Now the index returns only matching rows, no post-filter waste. Recognition signal: large `Rows Removed by Filter` after an Index Scan → composite index opportunity.

---

## Anti-patterns & Smells

### Summary

**What this topic covers**

The negative space — recognising when a candidate (or PR) is about to make a textbook SQL mistake. Sub-patterns: (1) **`SELECT *`** in production code — fragile, slow, wastes I/O; (2) **`COUNT(DISTINCT)`** on huge tables without a supporting index; (3) **correlated subqueries** that the planner can't fold into joins; (4) **`NOT IN` with NULL hazard**; (5) **OR conditions that block index use**; (6) **functions on indexed columns** (`WHERE upper(col) = ...` defeats the index); (7) **LIKE patterns with leading wildcards** (`LIKE '%foo'` defeats BTREE); (8) **`WHERE col IS DISTINCT FROM NULL` instead of `IS NOT NULL`** (verbose, confuses readers); (9) **N+1 queries from application code**; (10) **`UNION` when `UNION ALL` would suffice**; (11) **`ORDER BY RAND()`** for random sampling. The 6 questions cover the recognition of each smell and the standard fix.

**Mental model**

Most SQL anti-patterns share a common shape: they look right and produce correct results but are slow or fragile. Recognising them in code review is the senior tell. The key is **knowing the fix per smell**:
- `SELECT *` → enumerate columns explicitly.
- `COUNT(DISTINCT col)` slow → `COUNT(DISTINCT col)` on a derived table after pre-aggregation, or HyperLogLog approximation.
- Correlated subquery → join or window function.
- `NOT IN` → `NOT EXISTS`.
- `OR` blocking index → split into `UNION ALL` of two indexed queries.
- `WHERE func(col) = ...` → functional index or rewrite to use the raw column.
- `LIKE '%foo'` → trigram index (`pg_trgm` extension) or full-text search.
- N+1 → fetch the parent set first, then a single `WHERE IN (...)` for children.
- `UNION` → `UNION ALL` when duplicates can't occur or don't matter.
- `ORDER BY RAND()` → `TABLESAMPLE` or `WHERE id IN (random sampled ids)`.

The senior insight is that **anti-patterns are usually code-review red flags, not query-correctness bugs** — they pass tests, then fail under production load. Recognising them in PR review is the staff-level signal. Beyond fixes, the deeper move is teaching juniors *why* each is bad — the index-blocking mechanism, the NULL-hazard math, the cardinality-explosion in OR.

**Key terms**

- **`SELECT *` in prod** — fragile; new columns break consumers; wastes I/O.
- **Correlated subquery** — re-evaluated per outer row in naive plans.
- **OR-blocked index** — `WHERE a = 1 OR b = 1` can't use single-column indexes on `a` or `b` directly.
- **Function on indexed column** — `upper(col)`, `col + 1`, `col::text` all defeat BTREE.
- **Leading-wildcard `LIKE`** — `LIKE '%foo'` defeats BTREE; needs `pg_trgm`.
- **N+1 query** — application loop issues per-row child queries instead of one batch.
- **`UNION` instead of `UNION ALL`** — wastes the dedup.
- **`ORDER BY RAND()`** — full sort of the table by random keys.
- **Trigram index (`pg_trgm`)** — supports `LIKE`, `ILIKE`, `~`, `~*` for substring search.
- **TABLESAMPLE** — efficient random sampling.
- **`COUNT(DISTINCT)`** — expensive; consider HyperLogLog (`hll` extension) for approximations.

**Why interviewers ask this**

Three signals. (1) **Code-review eye** — given a query, senior candidates spot the smell in 10 seconds; juniors don't notice. (2) **Fix-per-smell discipline** — naming the fix (functional index, `NOT EXISTS`, `UNION ALL`) shows depth. (3) **Production awareness** — recognising that the smell only matters at scale (no problem on 1000 rows, catastrophe on 100M) is the systems-level signal.

**Common confusions**

- "`SELECT *` is fine in queries that get all columns" — fragile to schema changes; consumers break silently.
- "Correlated subqueries are always bad" — modern planners can sometimes fold them; check the plan.
- "OR always blocks index" — if both sides reference the same column, OR can use the index; cross-column OR doesn't.
- "Functions on indexed columns block all indexes" — only BTREE-on-raw-column; a functional index `((upper(col)))` works.
- "`LIKE 'foo%'` is slow" — that's a *trailing* wildcard, which BTREE handles fine. Only *leading* is slow.
- "N+1 is a Rails problem" — it's a SQL problem; any ORM can do it.

**What follows from this topic**

Anti-patterns are the negative space that every other topic complements — knowing the patterns is one half, recognising their absence (or misuse) is the other. Pair with query plan reading (topic 23) for the diagnostic angle. If you internalise the smells and their fixes, you'll catch them in PR review and write production-safe queries reflexively.

### Q1. The `SELECT *` smell. Why is it bad in production code?

(1) **Fragility**: when someone adds a column, every consumer suddenly gets the new field — silent breakage if the consumer's deserialiser is strict. (2) **I/O waste**: returns all columns even when only a few are needed; bloats network and memory. (3) **Index-only scan defeat**: an index-only scan requires the index to cover all SELECTed columns; `SELECT *` rarely matches. The fix: enumerate columns explicitly. Exception: ad-hoc analysis at the psql prompt is fine; production code is not. The senior tell: flag `SELECT *` in any PR that ships to production.

### Q2. `WHERE upper(email) = 'X@Y.COM'` defeats the index. Two fixes.

(1) **Functional index**: `CREATE INDEX ON users ((upper(email)))` — the index is on the function result, matches the query. (2) **Store lowercased**: enforce `lower(email)` at insert time (constraint or trigger), query with `WHERE email = lower('X@Y.COM')`. The second is cleaner because it normalises at write time and all queries use the raw column. Senior tell: prefer normalisation at write; reach for functional indexes only when you can't change the write path.

### Q3. `LIKE 'foo%'` vs `LIKE '%foo'` — what's the index story?

`LIKE 'foo%'` (trailing wildcard) is indexable by BTREE — the index can range-scan from 'foo' to 'fop' (exclusive). `LIKE '%foo'` (leading wildcard) is not BTREE-indexable; the index can't seek to a prefix because the prefix is unknown. For leading-wildcard search, install `pg_trgm` and `CREATE INDEX ON t USING GIN (col gin_trgm_ops)` — trigram indexes handle substring search efficiently. For full-text search, `tsvector` + GIN. The senior tell: knowing the BTREE prefix rule and naming `pg_trgm` as the fix.

### Q4. `WHERE a = 1 OR b = 1` — why does this often defeat indexes?

For a single index on `(a)` to be used, every condition must reference `a`. The OR reaches across columns; the index on `(a)` doesn't help find `b = 1` rows. The fix: **`UNION ALL` of two indexed queries**:

```sql
SELECT * FROM t WHERE a = 1
UNION ALL
SELECT * FROM t WHERE b = 1 AND a != 1;  -- dedup if needed
```

Each branch uses its own index. For the OR-with-same-column case (`a = 1 OR a = 2`), Postgres rewrites to `a IN (1, 2)` which is indexable. The senior tell: recognise cross-column OR as the index-blocker.

### Q5. The N+1 query smell. Show me the bad pattern and the fix.

**Bad** (in app code): `SELECT * FROM users; for each user: SELECT * FROM orders WHERE user_id = ?;` — N+1 queries for N users. **Fix**: fetch parents, collect ids, one batch query:

```sql
SELECT * FROM users;
-- collect user ids in code
SELECT * FROM orders WHERE user_id = ANY(:user_ids);
```

Or a single join: `SELECT u.*, o.* FROM users u LEFT JOIN orders o ON o.user_id = u.id`. The N+1 smell appears in any ORM-driven loop over parent rows that accesses children. ORM features like "eager loading" or "joins" prevent it. Senior tell: spot N+1 in code review and propose the batch-or-join fix.

### Q6. Senior interview angle: `ORDER BY RAND() LIMIT 10` for random sampling. What's wrong and the fix.

Wrong: it sorts the entire table by a random key (`RANDOM()` per row), then takes the top 10 — O(N log N) work for a 10-row result. For huge tables this is catastrophic. **Fix 1**: `TABLESAMPLE SYSTEM (1) LIMIT 10` — samples ~1% of pages, returns up to 10. **Fix 2**: pre-compute random ids and seek: `SELECT * FROM t WHERE id IN (SELECT id FROM t ORDER BY RANDOM() LIMIT 10)` (still slow without an id range trick). **Fix 3 (best for huge tables)**: pick 10 random ids in the known id range, `SELECT * FROM t WHERE id IN (rand_ids)` — O(10) seeks. The senior tell: recognise `ORDER BY RAND()` as a perf hazard, propose `TABLESAMPLE` or id-range sampling.

---

## Tradeoff Vocabulary & Closing

### Summary

**What this topic covers**

The final consolidation — a quick-reference cheat list of every SQL pattern recognition signal from the primer, plus the tradeoff vocabulary that compounds across patterns. The signals: input-shape lens (single table, multi-table, hierarchical, time-series, JSON, graph) → first pattern; output-shape lens (scalar, row-per-input, row-per-group, pivot, tree) → second pattern; constraint clues ("consecutive" → gaps & islands, "median" → `PERCENTILE_CONT`, "running" → window function, "transitive" → recursive CTE, "as-of" → `LATERAL`, "top-N per group" → `DISTINCT ON` or `ROW_NUMBER`, "pivot" → conditional aggregation, "cohort" → cohort matrix, "missing in B" → anti-join, "upsert" → `ON CONFLICT`) → exact pattern. Plus the Postgres-specific reminders: `DISTINCT ON` for top-1, `FILTER` for conditional aggregates, `GENERATE_SERIES` for series, `tstzrange` + `&&` for overlaps, `LATERAL` for per-row sets, `EXCLUDE` for non-overlap constraints, `COPY` for bulk load, BRIN for huge time-ordered tables, GIN for JSONB, GiST for ranges, partial indexes for one-sided filters. The 5 questions consolidate and drill the recognition.

**Mental model**

The senior SQL interview isn't about knowing more syntax — it's about **recognising the pattern faster** and **articulating the tradeoff cleanly**. The 25 topics in this primer cover the recognition; the tradeoff vocabulary is what separates senior from staff. The vocabulary: **`DISTINCT ON` vs `ROW_NUMBER`** — Postgres concision vs portability. **`LATERAL` vs window function** — index-aligned per-group vs full-partition sort. **`UNION` vs `UNION ALL`** — dedup cost vs no-dedup speed. **`NOT IN` vs `NOT EXISTS`** — NULL hazard vs NULL-safe. **`FILTER` vs `CASE WHEN`** — modern syntax vs legacy. **`ON CONFLICT` vs `MERGE`** — simple upsert vs multi-action. **`tstzrange` + `&&` vs explicit boundary predicates** — index-friendly range types vs portable verbosity. **`COUNT(*)` vs `COUNT(col)`** — total vs non-NULL. **`PERCENTILE_CONT` vs `PERCENTILE_DISC`** — interpolated vs exact. **BTREE vs GIN vs GiST vs BRIN** — equality/range vs containment vs overlap vs huge-sorted. The drill discipline is daily: read five SQL prompts, name the pattern in 30 seconds, name the alternative and the tradeoff. Over weeks, recognition becomes reflex; over months, you can name the pattern from the first sentence and articulate the tradeoff before any code is written.

**Key terms**

- **Recognition reflex** — naming the pattern from the prompt in under 30 seconds.
- **Tradeoff vocabulary** — the senior-level language for comparing two valid patterns.
- **Signal table** — the keyword-to-pattern lookup from topic 2.
- **Brute-force baseline** — always state the naive correlated-subquery or self-join version before optimising.
- **Edge-case narration** — NULLs, empty groups, ties, duplicates, timezone — enumerate before coding.
- **Complexity scan** — derive the expected join / sort cost from row counts and indexes.
- **Senior tell** — naming the tradeoff (DISTINCT ON vs ROW_NUMBER), the alternative (LATERAL vs window), the proof of correctness (gaps & islands derivation).
- **Drill schedule** — five prompts a day, name the pattern in 30 seconds, then verify.
- **Companion to SQL Practice** — this primer is the recognition layer; the SQL Practice sources are the worked examples.
- **Bring receipts** — back every pattern claim with a tradeoff articulation; don't just write the query, narrate it.

**Why interviewers ask this**

Three signals come together in every SQL round. (1) **Recognition speed** — 45 minutes total; 10 for problem reading and clarifying, 25 for query construction, 10 for testing. Spend 20 on recognition and you'll be writing under time pressure. (2) **Process visibility** — narrating input shape, output cardinality, the pattern shortlist, the tradeoff, then coding — earns credit even if the query isn't finished. (3) **Senior signals at every step** — the cumulative effect of "stated brute force, named the pattern in 30 seconds, articulated the alternative, enumerated NULL/edge cases, named the index strategy, named the anti-pattern to avoid". Each is a small upgrade signal; together they're decisive.

**Common confusions**

- "I just need to write more queries" — no; recognise more *patterns*. 25 patterns cover everything.
- "Speed comes from typing fast" — no; speed comes from skipping the 20-minute recognition phase.
- "If I can write the query, the rest is gravy" — no; the narration and tradeoff conversation is the senior signal.
- "Edge cases are an afterthought" — they're the pre-thought. Enumerate NULL, empty, ties before writing.
- "Postgres-specific features are optional" — for Postgres roles they're table-stakes; the staff candidate reaches for them reflexively.
- "Pattern recognition gets you only so far" — wrong; pattern recognition compounded with index awareness and tradeoff articulation *is* SQL interview success.

**What follows from this topic**

This is the closing topic. What follows is your daily practice. The drill: pick five SQL prompts each morning (from SQL Practice, Advanced SQL Practice, or this primer's signal tables); for each, read the prompt; close your eyes; name the pattern in 30 seconds; name the brute force; name the optimal; name two edge cases (NULL, ties); name the tradeoff against the alternative pattern; then verify by writing the query. Over four weeks, recognition becomes faster, the templates become reflex, and the tradeoff vocabulary becomes automatic. The goal state isn't "I've seen this exact prompt before" — it's "I see the pattern from the first sentence, name the tradeoff, and the rest is mechanical". Drill until that's reflex. The interview is won in the first 30 seconds.

### Q1. Recite the keyword-to-pattern signals from memory.

- **"consecutive" / "in a row" / "streak"** → gaps & islands (row-number-minus-date trick).
- **"median" / "p50" / "p95" / "p99"** → `PERCENTILE_CONT(p) WITHIN GROUP (ORDER BY x)`.
- **"running total" / "cumulative"** → window function with default frame.
- **"rolling N-day"** → `RANGE BETWEEN INTERVAL 'N days' PRECEDING`.
- **"top-N per group" / "first per group"** → `DISTINCT ON` (Postgres) or `ROW_NUMBER() = N`.
- **"transitive closure" / "reachable from"** → recursive CTE.
- **"as-of" / "point in time"** → `LATERAL ... LIMIT 1` or `tstzrange` + `@>`.
- **"sessionize" / "event sequence"** → gaps & islands with time threshold + `LAG`.
- **"pivot" / "rows to columns"** → conditional aggregation with `FILTER`.
- **"cohort retention"** → cohort matrix via `GENERATE_SERIES` + `LEFT JOIN`.
- **"missing in B" / "not in B"** → `NOT EXISTS` or `EXCEPT`.
- **"upsert" / "idempotent insert"** → `INSERT ... ON CONFLICT`.
- **"compare to previous / next row"** → `LAG` / `LEAD`.
- **"rank with ties"** → `DENSE_RANK` (no gaps) or `RANK` (gaps).
- **"per-group subtotals + grand total"** → `ROLLUP`.

Read each one aloud; the signal should map to the pattern in under a second.

### Q2. Recite the Postgres-specific tradeoffs.

- **`DISTINCT ON`** — Postgres top-1 per group, one line; portable equivalent is `ROW_NUMBER() = 1` in a CTE.
- **`FILTER (WHERE ...)`** — standard SQL, cleaner than `CASE WHEN`; same plan.
- **`GENERATE_SERIES`** — generate cohort grids, time series, missing-day fills.
- **`tstzrange` + `&&`** — index-friendly range overlap; portable form is explicit boundary predicates.
- **`LATERAL`** — per-row dependent sets; index-aligned top-N when index exists.
- **`EXCLUDE USING GIST`** — schema-level non-overlap constraint; replaces application-level checks.
- **`COPY FROM STDIN`** — 10-100x faster than `INSERT` for bulk load.
- **`ON CONFLICT DO UPDATE`** — idempotent upsert; requires unique constraint.
- **BRIN** — huge time-sorted tables; tiny index, fast range scan.
- **GIN on JSONB** — `@>` containment queries.
- **Partial index** — index a subset (`WHERE active = true`); smaller, faster for the common query.

The senior tell is reaching for these reflexively in Postgres roles.

### Q3. Walk me through your pre-query narration ritual.

(1) Restate the prompt to confirm understanding. (2) Identify input shape (single / multi-table / hierarchical / time-series / JSON). (3) Identify output cardinality (scalar / row-per-input / row-per-group / pivot / tree). (4) Identify the constraint clue (consecutive, median, running, transitive, as-of, top-N, pivot). (5) Name the pattern. (6) Name the alternative pattern and articulate the tradeoff. (7) Enumerate NULL handling, ties, edge cases. (8) State expected indexes / performance shape. (9) Write the query.

This is 60-90 seconds of narration. Juniors skip steps 1-8 and start at 9; senior candidates do all nine. The interviewer is grading on *what you say*, not just what you write.

### Q4. What's your daily drill schedule?

Five SQL prompts per day, each given 30-60 seconds for pattern recognition before checking the solution. Drill the **Recognition & Decision Tree** (topic 1) and **Pattern Signal Tables** (topic 2) at the start of every session. Over four weeks:

- Week 1: recognition takes 2-3 minutes per prompt; pattern often wrong.
- Week 2: recognition takes 1-2 minutes; pattern right ~70% of the time.
- Week 3: recognition takes 30-60 seconds; pattern right ~90%.
- Week 4: recognition is reflex; pattern right ~95%, often from the first sentence; tradeoff articulation is automatic.

That's the goal state. Drill until reflex.

### Q5. Closing senior interview angle: what's the one piece of advice that compounds the most?

**Tradeoff articulation compounds**. Every senior SQL interview question has at least two valid patterns. The candidate who writes one correctly gets a junior pass; the candidate who names both, articulates the tradeoff, picks one with a justification (readability, index alignment, portability), and *then* writes it gets the staff pass. Every pattern in this primer has a tradeoff partner: `DISTINCT ON` vs `ROW_NUMBER`, `LATERAL` vs window, `FILTER` vs `CASE WHEN`, `ON CONFLICT` vs `MERGE`, `NOT EXISTS` vs `EXCEPT`, `tstzrange` vs boundary predicates, `BRIN` vs `BTREE` for time-ordered tables.

The drill: for every prompt, name **both** valid patterns and the tradeoff before writing. Over four weeks of this discipline, your interview performance changes qualitatively. The 25 patterns in this primer cover 95% of what you'll see. Drill them until recognition is reflex — and bring receipts.

