---
type: interview-prep
---

# Database Theory Interview Primer — 95 Questions

General, vendor-agnostic database theory for backend interviews — relational theory, transactions, concurrency, storage internals, and distributed-systems data concepts. Sister notes: the engine-specific [[Postgres Interview Primer]] and the query-focused SQL primers.

Each answer is interview-shaped: concise, opinionated, with concrete examples and tradeoffs. Specific systems are cited only as illustrations — the principles are the point.

1. [[#Relational Model & Theory]]
2. [[#Normalization & Schema Design]]
3. [[#ACID & Transactions]]
4. [[#Isolation Levels & Anomalies]]
5. [[#Concurrency Control]]
6. [[#Indexing & Access Methods]]
7. [[#Storage Engines & Physical Layout]]
8. [[#Query Processing & Optimization]]
9. [[#CAP, PACELC & Tradeoffs]]
10. [[#Replication]]
11. [[#Partitioning & Sharding]]
12. [[#Consistency Models]]
13. [[#Distributed Transactions & Consensus]]
14. [[#NoSQL & Data Store Types]]
15. [[#OLTP vs OLAP & Warehousing]]
16. [[#Caching, Durability & Reliability]]

---

## Relational Model & Theory

### Summary

**What this topic covers** — This topic is the conceptual bedrock of every SQL database: what a "relation" actually is, how keys formalize identity and references, the algebra that defines what queries *mean*, the logic that governs missing data, and the gap between the pristine mathematical model Codd published in 1970 and the messy SQL engines we ship. If you only know "tables and rows," this is where you upgrade to knowing *why* tables behave the way they do — and where SQL quietly betrays the theory.

**Mental model** — Carry two layers in your head. The bottom layer is set theory: a relation is a set of tuples drawn from the Cartesian product of domains, and relational algebra is closed — every operator takes relations and returns a relation, so you can compose them arbitrarily. This closure property is *why* subqueries, views, and CTEs nest cleanly. The top layer is SQL, which is a *bag* (multiset) language wearing relational clothing: it allows duplicate rows, imposes column order, and pretends `NULL` is a value when it's really a marker. A senior engineer keeps these layers distinct, because most "weird" SQL behavior — `SELECT DISTINCT` changing results, `NOT IN` returning nothing, `COUNT(*)` vs `COUNT(col)` — is the bag/null reality leaking through the set-theory abstraction. When you reason about correctness, drop to the algebra; when you reason about a real query, remember you're in bag-land with three-valued logic.

**Key terms**
- **Relation** — a set of tuples over a fixed heading (attribute names + domains); unordered, no duplicates.
- **Tuple** — one element of a relation; a set of attribute-value pairs, not an ordered list.
- **Attribute** — a named column with an associated domain; identity is by name, not position.
- **Domain** — the set of permitted values for an attribute (a type plus constraints), e.g. `email` or `positive_integer`.
- **Heading / schema** — the set of attribute-name/domain pairs defining a relation's shape.
- **Candidate key** — a minimal set of attributes that uniquely identifies every tuple.
- **Primary key** — the candidate key chosen as the canonical identifier.
- **Foreign key** — attributes referencing a candidate key in another relation, enforcing referential integrity.
- **Relational algebra** — a closed set of operators (σ, π, ⋈, ∪, −, ×) over relations.
- **Three-valued logic (3VL)** — `TRUE`/`FALSE`/`UNKNOWN`, the logic SQL uses once `NULL` enters a predicate.
- **Bag (multiset)** — a collection allowing duplicates; SQL's real data model.
- **Surrogate key** — a synthetic, meaningless identifier (sequence, UUID) standing in for a natural key.

**Why interviewers ask this** — It separates people who *use* SQL from people who *understand* it. A junior says "a table is a relation" and stops; a senior knows a SQL table is a *bag with positional columns* and can explain exactly when that difference produces a bug — say, a join fan-out that silently double-counts, or a `NOT IN (subquery)` that returns zero rows because one row was `NULL`. Interviewers use this topic to predict whether you'll write correct queries under pressure, design sane keys, and reason about edge cases instead of being surprised by them in production. It also flushes out the candidate who confuses the "C" in ACID (constraint consistency) with the "C" in CAP (consistency as a read property) — a tell that they're pattern-matching jargon rather than reasoning from the model.

**Common confusions**
- **"A table is a relation."** A table is a bag with ordered columns and possible duplicate rows; a relation is a set with named, unordered attributes.
- **"NULL means zero or empty string."** `NULL` is the *absence* of a value; it is neither equal to nor unequal to anything, including itself.
- **"Primary key and candidate key are the same thing."** A relation can have many candidate keys; the primary key is just the one you anointed.
- **"`x = NULL` filters NULLs."** It evaluates to `UNKNOWN` and matches nothing; you need `IS NULL`.
- **"SQL is relational."** SQL is *relational-ish* — duplicates, ordering, and `NULL` all violate the pure model.

**What follows from this topic** — Keys and functional dependencies feed directly into **normalization** (1NF→BCNF) and the denormalization tradeoffs you make for read performance. Three-valued logic resurfaces in **constraints**, **indexing** (nullable columns, partial indexes), and join semantics. Relational algebra is the substrate the **query optimizer** rewrites — predicate pushdown and join reordering are algebra-preserving transformations. And the set-vs-bag distinction informs how **transactions and isolation** define what a "row" even is across concurrent reads.

### Q1. What is the relational model, precisely? Define relation, tuple, attribute, domain, and how this differs from "a table".

The relational model, as Codd defined it in 1970, is built on set theory. A **domain** is a named set of allowed values — think of it as a type with constraints, like `email_address` or `0..120` for age. An **attribute** is a name paired with a domain; it's identified by that name, never by a position. A **tuple** is a set of attribute-value pairs — one value per attribute, each value drawn from that attribute's domain. A **relation** is a *set* of tuples that all share the same heading (the same set of attributes).

The two load-bearing words are *set* and *named*. Because a relation is a set, there are **no duplicate tuples** and **no ordering** — there's no "first row." Because attributes are named, there's **no column order** either; `{name: 'alice', age: 30}` and `{age: 30, name: 'alice'}` are the identical tuple.

A SQL **table** breaks all three of those. It is a *bag* (multiset), so it can contain duplicate rows. Its columns have a defined left-to-right order (`SELECT *` and positional `INSERT` depend on it). And without a `UNIQUE`/`PK` constraint, nothing stops repeated rows.

```text
RELATION (set, named, unordered)      TABLE (bag, positional, ordered cols)
  { {id:1, name:'alice'},               | id | name  |
    {id:2, name:'bob'} }                | 1  | alice |
  - no row order                        | 2  | bob   |
  - no dup tuples                       | 1  | alice |   <- legal in SQL!
  - attributes by name                  - columns by position
```

The practical upshot: when you reason about *correctness* of a query, think in relations (sets); when you reason about what a real engine *does*, remember you're manipulating bags with ordered columns. That mismatch is the source of half the surprising results in SQL.

### Q2. Explain the kinds of keys: super key, candidate key, primary key, foreign key, composite, surrogate vs natural. When do you choose a surrogate key?

Keys are about identity and reference. Start broad and narrow down:

- **Super key** — any set of attributes that uniquely identifies a tuple. `{id, email, name}` is a super key if `id` alone is, because supersets of a unique set are still unique.
- **Candidate key** — a *minimal* super key: remove any attribute and it's no longer unique. A relation can have several. For a user table, both `{id}` and `{email}` might be candidate keys.
- **Primary key** — the candidate key you crown as canonical. The others become `UNIQUE` constraints (sometimes called alternate keys). The choice is a design decision, not a mathematical one.
- **Composite key** — a key spanning multiple attributes, e.g. `{order_id, line_no}` for order line items. Common and correct in junction tables.
- **Foreign key** — attributes in one relation that reference a candidate key in another, enforcing referential integrity (no orphan rows).

**Natural** keys come from the data's meaning (`email`, ISBN, country code). **Surrogate** keys are synthetic and meaningless (an auto-increment `bigint`, a UUID). The tradeoff:

| Aspect | Natural key | Surrogate key |
|---|---|---|
| Meaning | carries domain meaning | none |
| Stability | can change (email, name) | never changes |
| FK width | can be wide/composite | narrow, uniform |
| Joins/indexes | larger, sometimes slower | compact, cache-friendly |
| Exposure | may leak PII in URLs | safe-ish (UUID better than serial) |

Choose a **surrogate** when the natural key is unstable (people change emails), wide or composite (cheaper to propagate one `bigint` than a 4-column FK everywhere), or when the natural identifier is sensitive. Choose a **natural** key when it's genuinely immutable and you want the database to enforce real-world uniqueness for free (e.g. a `(year, iso_country)` lookup table).

The senior move: use a surrogate primary key for *internal* references but *also* put a `UNIQUE` constraint on the natural key. That gives you stable FKs and still lets the database prevent duplicate humans. Dropping the natural-key constraint "because we have an id" is how you end up with three rows for the same person.

### Q3. What is relational algebra, and why does it matter? Walk through selection, projection, join, and set operations, and how they map to SQL.

Relational algebra is a small set of operators that each take one or two relations and return a relation. The crucial property is **closure**: the output of every operator is itself a relation, so operators compose without limit. That closure is *why* you can nest subqueries, define views on views, and chain CTEs — SQL inherits composability directly from the algebra.

The core operators:

| Algebra | Symbol | Meaning | SQL |
|---|---|---|---|
| Selection | σ | keep tuples matching a predicate | `WHERE` |
| Projection | π | keep a subset of attributes | `SELECT col_list` |
| Join | ⋈ | combine on matching attributes | `JOIN ... ON` |
| Product | × | every pairing of tuples | `CROSS JOIN` |
| Union | ∪ | tuples in either relation | `UNION` |
| Difference | − | tuples in A not in B | `EXCEPT` |
| Intersection | ∩ | tuples in both | `INTERSECT` |
| Rename | ρ | rename attributes | `AS` |

So `π_name(σ_age>30(person))` is just:

```sql
SELECT name FROM person WHERE age > 30;
```

A join is the workhorse: `R ⋈ S` is a product followed by a selection on the join condition, then projection. The optimizer exploits exactly this equivalence — predicate pushdown ("apply σ before the join, not after") and join reordering are algebraic rewrites that preserve the result set while changing the cost.

Why it matters in an interview: it explains *correctness* independent of execution. When you can say "`WHERE` filters before `GROUP BY`, `HAVING` filters after, because selection on a grouped relation is a different relation," you're reasoning algebraically. The catch — and a great thing to volunteer — is that pure algebra is set-based, but SQL's `UNION`/`EXCEPT`/`INTERSECT` default to *set* semantics (dedup) while `UNION ALL` is the bag version. That gap between algebra-on-sets and SQL-on-bags is exactly Q6.

### Q4. Explain NULL and three-valued logic (TRUE/FALSE/UNKNOWN). Show a query that returns surprising results because of it.

`NULL` is not a value — it's a marker meaning "value absent/unknown." The instant a `NULL` enters a comparison, SQL leaves two-valued Boolean logic and enters **three-valued logic (3VL)**: predicates can be `TRUE`, `FALSE`, or `UNKNOWN`. Any arithmetic or comparison with `NULL` yields `NULL`/`UNKNOWN`, *including* `NULL = NULL`, which is `UNKNOWN`, not `TRUE`. That's why you must write `IS NULL`.

The 3VL truth tables for `AND`/`OR`:

```text
AND     T   F   U          OR      T   F   U
T       T   F   U          T       T   T   T
F       F   F   F          F       T   F   U
U       U   F   U          U       T   U   U
```

`WHERE` keeps a row only when the predicate is `TRUE` — `UNKNOWN` rows are discarded just like `FALSE` ones. That's the trap. The classic surprise is `NOT IN` with a subquery containing a `NULL`:

```sql
-- employees not assigned to any of these departments
SELECT * FROM employee
WHERE dept_id NOT IN (SELECT dept_id FROM department);
```

If *any* `department.dept_id` is `NULL`, this returns **zero rows**, always. `NOT IN (a, b, NULL)` expands to `dept_id <> a AND dept_id <> b AND dept_id <> NULL`; that last term is `UNKNOWN`, so the whole `AND` can never be `TRUE` — at best `UNKNOWN`, which `WHERE` drops. The query silently returns nothing and looks like a data problem.

Other landmines: `COUNT(col)` ignores `NULL`s while `COUNT(*)` counts rows; `SUM`/`AVG` skip `NULL`s (so `AVG` ≠ `SUM/COUNT(*)`); and `UNIQUE` constraints in most engines allow multiple `NULL`s because two `NULL`s aren't "equal." The fix for `NOT IN` is `NOT EXISTS`, which uses straightforward existence semantics and is immune to the `NULL` blow-up:

```sql
SELECT * FROM employee e
WHERE NOT EXISTS (
  SELECT 1 FROM department d WHERE d.dept_id = e.dept_id);
```

### Q5. What are Codd's rules / the principles of a truly relational system, and which ones do real SQL databases violate?

Codd published 12 rules (numbered 0–12, so 13 total) in 1985 to pin down what "relational" actually requires, after vendors started slapping the label on anything with tables. You don't memorize all 13 for an interview; you know the *spirit* and the famous violations. The headline principles:

- **Information rule** — all data represented as values in relations, nothing hidden in pointers or row order.
- **Guaranteed access** — every value reachable by table name + primary key + column name (no positional access).
- **Systematic NULL treatment** — `NULL` handled uniformly, independent of datatype.
- **Active online catalog** — metadata stored as relations, queryable with the same language.
- **Comprehensive sublanguage** — one language for definition, manipulation, constraints, transactions.
- **View updating** — all theoretically updatable views are updatable by the system.
- **Physical & logical data independence** — apps survive storage *and* schema changes.
- **Non-subversion** — you can't bypass integrity rules via a lower-level interface.

Where real SQL engines fall short:

| Rule | Reality |
|---|---|
| Information rule | Violated by **duplicate rows** — a bag isn't a relation. |
| Guaranteed access | Weakened: tables without a PK exist; `ctid`/`ROWID` expose physical addressing. |
| Systematic NULL | Arguably violated — 3VL is inconsistent (`NULL = NULL` is `UNKNOWN`, but `GROUP BY` and `UNIQUE` treat `NULL`s as equal). |
| View updating | Widely violated — most engines only update trivial single-table views. |
| Logical data independence | Partial — adding a column is fine, but `SELECT *` and ordinal references break. |
| Non-subversion | Bulk loaders, replication, and direct file access can skip constraints. |

The honest summary for an interviewer: **no mainstream SQL database is fully relational.** SQL chose pragmatism — duplicates, ordered columns, `NULL`-as-pseudo-value — over Codd's purity. Date and Darwen's *Third Manifesto* is the academic protest against exactly these compromises. Knowing this signals you understand SQL is an *implementation that approximates* the model, not the model itself.

### Q6. Relational vs relational-calculus vs SQL: is SQL actually relational? Discuss bags vs sets, ordering, and duplicate rows.

There are two equivalent formalisms for "what to compute." **Relational algebra** is *procedural* — you specify operators in order (σ then ⋈ then π). **Relational calculus** is *declarative* — you describe the result with logic (`{t | t ∈ person ∧ t.age > 30}`) and say nothing about how to get it. Codd's theorem proved they're equally expressive ("relationally complete"). SQL is closer in spirit to the calculus (you declare *what*, the optimizer decides *how*), but it's strictly its own language and, importantly, it is **not** purely relational.

The three violations are the ones to name:

**Bags vs sets.** A relation is a set — no duplicates. A SQL table and query result are *bags*. `SELECT dept FROM employee` returns one row per employee, duplicates and all; you need `DISTINCT` to recover set semantics. This is a deliberate performance choice: deduplicating requires a sort or hash, and most aggregates (`SUM`, `COUNT`) actually *need* the duplicates. But it means an innocent query can return more rows than the model says it should — and a careless join fan-out double-counts a `SUM`.

**Ordering.** Relations are unordered; SQL columns have a fixed position (enabling `SELECT *` and positional inserts), and result *rows* have no guaranteed order unless you write `ORDER BY`. Relying on "natural" row order is a classic bug — it works until an index changes or the planner picks a different scan.

**Duplicate rows.** Without a key, SQL permits two byte-identical rows that are *indistinguishable* — you can't address one without the other, violating Codd's guaranteed-access rule. Set operators expose the split: `UNION`/`INTERSECT`/`EXCEPT` dedup (set semantics), while `UNION ALL` keeps duplicates (bag semantics) and is usually faster precisely because it skips the dedup pass.

```sql
SELECT dept FROM a UNION ALL SELECT dept FROM b;  -- bag: keeps dups, fast
SELECT dept FROM a UNION     SELECT dept FROM b;  -- set: dedups, sorts/hashes
```

So: is SQL relational? **Relational-*inspired*, not relational.** It's a bag-based, column-ordered language with 3VL `NULL`s layered on top of relational algebra's ideas. The senior framing is that SQL traded mathematical purity for the performance and pragmatism real systems need — and a good engineer knows exactly *where* that trade leaks into query behavior.

---

## Normalization & Schema Design

### Summary

**What this topic covers** — This topic is about the discipline of designing relational schemas so that each fact lives in exactly one place. Normalization is the formal theory — functional dependencies and the normal forms (1NF through BCNF, then 4NF/5NF) — that tells you *why* a given table layout is or isn't prone to redundancy and update anomalies. Schema design is the engineering judgment layered on top: when to follow the theory to the letter, when to denormalize for read performance, and how to model relationships (one-to-many, many-to-many) and choose between a relational and a document/embedded shape.

**Mental model** — A normalized schema is a factored representation of a set of true statements. Every non-key column states a fact *about* the key; if a fact depends on only part of a composite key, or on another non-key column, it's stored in the wrong table and will eventually be stored inconsistently. The master rule, paraphrasing Codd via Kent: "every non-key attribute must provide a fact about the key, the whole key, and nothing but the key" — that one sentence encodes 2NF, 3NF, and BCNF respectively. A senior engineer reads a schema by asking "what does this row claim, and is each claim derivable from the primary key alone?" Redundancy is the enemy not because it wastes space (storage is cheap) but because two copies of a fact will diverge under concurrent writes, and now you have data that contradicts itself with no authority to resolve it. Normalization buys *write correctness*; denormalization trades it back for *read speed*, and you should always know which direction you're moving and why.

**Key terms**
- **Functional dependency (FD)** — X → Y means: given a value of X, the value of Y is uniquely determined.
- **Candidate key** — a minimal set of attributes that functionally determines every other attribute.
- **Prime attribute** — an attribute that is part of some candidate key.
- **Partial dependency** — a non-prime attribute depends on only part of a composite candidate key (violates 2NF).
- **Transitive dependency** — a non-prime attribute depends on another non-prime attribute (violates 3NF).
- **BCNF** — for every FD X → Y, X must be a superkey; stricter than 3NF.
- **Multivalued dependency (MVD)** — X ↠ Y: Y's set of values is independent of all other columns given X (4NF).
- **Join dependency** — a table can be losslessly reconstructed by joining its projections (5NF).
- **Lossless-join decomposition** — splitting a table so the natural join of the pieces exactly reproduces the original, no spurious rows.
- **Dependency preservation** — all FDs are still enforceable within individual tables after decomposition.
- **Denormalization** — deliberately reintroducing redundancy to optimize reads.
- **Update/insert/delete anomaly** — inconsistencies that arise from storing a fact in the wrong place.

**Why interviewers ask this** — Normalization separates people who memorized "3NF good" from people who understand *what* it buys and *when* it costs. A junior recites the normal forms as a ladder to climb. A senior treats them as a diagnostic: they look at a denormalized table and immediately name the anomaly it will produce under concurrent writes, then weigh that against the read pattern that motivated it. The strong signal is fluency moving in *both* directions — being able to normalize a messy schema *and* articulate a defensible reason to denormalize, with a concrete plan to keep the redundant copy consistent. Interviewers also probe whether you conflate BCNF with 3NF, or "normalized" with "good schema." The best answers connect the theory to real failure modes: a reporting table that drifts from source-of-truth, a cached count that's off by three, a partial dependency that lets you insert a product with two different prices.

**Common confusions**
- **"Higher normal form is always better."** — BCNF can sacrifice dependency preservation; sometimes 3NF is the right stopping point.
- **"Normalization is about saving space."** — It's about preventing contradictory data; space is incidental.
- **"1NF means no duplicate rows."** — 1NF is about atomic, single-valued columns, not row uniqueness.
- **"3NF and BCNF are the same."** — They differ exactly when a non-key attribute determines part of a candidate key.
- **"Denormalize for performance" means skip normalization.** — You normalize *first*, then denormalize deliberately with a consistency mechanism.

**What follows from this topic** — Once a schema is normalized you confront the consequences: normalized data needs joins, which drives **indexing and query-planning** decisions; denormalized copies need **triggers, materialized views, or application-level consistency**, which pulls in **transactions and isolation**; and the normalize-vs-embed choice is really a preview of the **relational-vs-NoSQL data-modeling** tradeoff, where access patterns, not purity, drive the design.

### Q7. Define functional dependency and explain how it drives normalization. Give an example of a partial and a transitive dependency.

A **functional dependency** X → Y holds in a relation when any two rows that agree on X must agree on Y. It's a constraint on the *meaning* of the data, not on the current rows: `employee_id → email` says an employee has exactly one email, full stop. FDs are the raw material of normalization. You enumerate the FDs that *should* hold in your domain, identify the candidate keys (the minimal attribute sets that determine everything), and then check every other FD against those keys. Normalization is mechanical once you have the FDs: each normal form is just a rule about which FDs are allowed to exist relative to the keys.

A **partial dependency** is when a non-prime attribute depends on only *part* of a composite key. Take an order-line table keyed on `(order_id, product_id)`:

```text
order_items(order_id, product_id, quantity, product_name)
FDs: (order_id, product_id) → quantity
     product_id → product_name      ← partial: depends on half the key
```

`product_name` depends on `product_id` alone, not the whole key. Result: the product's name is repeated on every order line, and renaming it means touching N rows. That's a 2NF violation.

A **transitive dependency** is when a non-prime attribute depends on *another non-prime attribute* rather than directly on the key:

```text
employees(employee_id, dept_id, dept_name)
FDs: employee_id → dept_id
     dept_id → dept_name            ← transitive: employee_id → dept_id → dept_name
```

`dept_name` is functionally about `dept_id`, which is itself just an attribute. Every employee in the same department restates the department name; rename the department and you update every employee row. That's the 3NF violation. The fix in both cases is the same move: pull the dependent fact into its own table keyed on what it actually depends on.

### Q8. Walk through 1NF, 2NF, 3NF, and BCNF with a concrete schema that fails each, and the decomposition that fixes it.

Each normal form removes one class of dependency problem. Take a course-enrollment domain and walk it up the ladder.

**1NF — atomic, single-valued columns.** A column holding `"alice@x.com, alice@y.com"` or a repeating group like `phone1, phone2, phone3` violates 1NF.

```text
students(student_id, name, courses)   -- courses = "Math, Physics"  ❌
→ students(student_id, name)
  enrollments(student_id, course)     -- one row per course  ✅
```

**2NF — no partial dependencies (only matters with a composite key).** Key `(student_id, course_id)`:

```text
enrollments(student_id, course_id, grade, student_name)
  student_name depends on student_id alone  ❌
→ enrollments(student_id, course_id, grade)
  students(student_id, student_name)  ✅
```

**3NF — no transitive dependencies on the key.** Key `student_id`:

```text
students(student_id, name, dept_id, dept_building)
  dept_building depends on dept_id, not student_id  ❌
→ students(student_id, name, dept_id)
  departments(dept_id, dept_building)  ✅
```

**BCNF — every determinant is a superkey.** This is the case 3NF misses: an FD where a non-superkey determines part of a *candidate* key. Classic example — a student is advised by one instructor per subject, and each instructor teaches exactly one subject:

```text
advising(student_id, subject, instructor)
candidate keys: (student_id, subject) and (student_id, instructor)
FD: instructor → subject     -- instructor is not a superkey  ❌ (but 3NF passes: subject is prime)
→ instructors(instructor, subject)
  advising(student_id, instructor)  ✅
```

| Form | Removes | Trigger |
|------|---------|---------|
| 1NF | non-atomic / repeating columns | multivalued cells |
| 2NF | partial dependencies | composite key |
| 3NF | transitive dependencies | non-key → non-key |
| BCNF | non-superkey determinants | overlapping candidate keys |

Note the BCNF table passes 3NF (because `subject` is a prime attribute) yet still carries redundancy — that gap is exactly *why* BCNF exists. The catch: this BCNF decomposition loses dependency preservation — the FD `(student_id, subject) → instructor` now spans two tables and can't be enforced by a single key constraint. That's the real-world reason some shops deliberately stop at 3NF.

### Q9. What are 4NF and 5NF (multivalued and join dependencies)? When do they actually matter in practice?

**4NF** targets **multivalued dependencies**. An MVD X ↠ Y means that for a given X, the *set* of Y values is independent of every other column. The trap is putting two independent multivalued facts in one table:

```text
instructor_facts(instructor, course, hobby)
  -- instructor ↠ course AND instructor ↠ hobby, independently
```

If Alice teaches `{Math, Physics}` and has hobbies `{Chess, Hiking}`, a single table forces you to store the *cross product* — 4 rows — and "Alice teaches Math" gets entangled with "Alice plays Chess," which are unrelated facts. Add a hobby and you must add it against every course. 4NF says: split independent multivalued facts into separate tables.

```text
→ teaches(instructor, course)
  hobbies(instructor, hobby)
```

**5NF** (project-join normal form) handles **join dependencies** that aren't implied by any single MVD — cases where a table must be split into *three or more* projections to be reconstructed without spurious rows. The textbook case is a ternary relationship like `(supplier, part, project)` that holds only when all three pairwise relationships hold. These are genuinely rare and usually contrived.

In practice: 4NF violations *do* show up — any time you stuff two independent one-to-many associations into one junction table, you've created an MVD problem, and the symptom is combinatorial row blowup. The fix is so natural (two junction tables) that experienced modelers reach 4NF without invoking the theory. 5NF is mostly academic; you'll almost never deliberately decompose for it, and if a ternary fact truly can't be reduced to pairwise constraints, you keep it as one table. The honest interview answer: know 4NF as the "don't merge unrelated many-to-many's" rule, and recognize 5NF as a named edge case rather than a daily tool.

### Q10. When and why do you denormalize? What are the costs, and how do you keep denormalized data consistent?

You denormalize when reads dominate writes and the join cost (or aggregation cost) to assemble a result is hurting latency or throughput, and no index alone fixes it. Typical triggers: a dashboard that recomputes `COUNT(*)` over millions of rows on every page load; a feed query that joins five tables on the hot path; a reporting/analytics workload where read patterns are fixed and write-time denormalization is cheaper than read-time joins. Star schemas in data warehouses are denormalization as a deliberate design discipline.

The cost is always the same: you now store a fact in more than one place, and **the copies can diverge.** A cached `comment_count` on a post can drift from the actual number of comment rows; a duplicated `customer_name` on every order goes stale when the customer renames. You've traded a guaranteed-correct read (recompute from source) for a fast-but-possibly-wrong read. You also pay more on writes and more storage, and your code gets more complex.

Keeping it consistent is the engineering you're signing up for. Options, roughly in order of strength:

| Mechanism | Consistency | Notes |
|-----------|-------------|-------|
| Database trigger | Synchronous, transactional | Strong, but hides logic in the DB and can serialize writes |
| Same-transaction app write | Synchronous | Update source + copy in one txn; correct if the txn is atomic |
| Materialized view | DB-managed | `REFRESH` (manual/scheduled) in Postgres; some engines auto-maintain |
| Async job / CDC stream | Eventually consistent | Scales, but the copy is stale between updates; needs reconciliation |

```sql
-- counter kept correct by doing both writes in one transaction
BEGIN;
INSERT INTO comments (post_id, body) VALUES (42, 'nice');
UPDATE posts SET comment_count = comment_count + 1 WHERE id = 42;
COMMIT;
```

The rule: never denormalize without naming the consistency mechanism *and* a reconciliation path (a periodic job that recomputes the truth and corrects drift). A denormalized value with no way to detect or repair divergence is a latent data-corruption bug. And denormalize *late* — normalize first, prove the read problem with numbers, then add the redundant copy as a measured optimization.

### Q11. What anomalies (insert/update/delete) does normalization prevent? Show each with an example.

These three anomalies are the *reason* normalization exists — they're what goes wrong when a fact lives in the wrong table. Take an unnormalized table mixing employee and department facts:

```text
employees(emp_id, emp_name, dept_id, dept_name, dept_budget)
```

**Update anomaly** — a single fact is stored in many rows, so changing it means updating all of them, and missing one creates a contradiction. Change Engineering's budget:

```sql
UPDATE employees SET dept_budget = 500000 WHERE dept_id = 'ENG';
-- forget the WHERE, or miss some rows under concurrency,
-- and now "ENG budget" has two different values in the table
```

**Insertion anomaly** — you can't record one fact without supplying an unrelated one. You want to create a new department, but the table's key forces an employee:

```sql
-- can't add the "Legal" department until someone is hired into it,
-- because emp_id is part of the key and can't be NULL
INSERT INTO employees (dept_id, dept_name) VALUES ('LEG', 'Legal');  -- ❌ no emp_id
```

**Deletion anomaly** — deleting one fact accidentally destroys another. Fire the last employee in a department and the department itself vanishes:

```sql
DELETE FROM employees WHERE emp_id = 7;
-- if emp 7 was the only person in 'LEG', the existence of the
-- Legal department and its budget is now gone with no trace
```

The cure is the standard 3NF decomposition — give departments their own table:

```text
employees(emp_id, emp_name, dept_id)
departments(dept_id, dept_name, dept_budget)
```

Now the budget exists once (no update anomaly), a department can exist with zero employees (no insertion anomaly), and removing employees never deletes a department (no deletion anomaly). All three anomalies trace back to the same root cause — a non-key fact stored against the wrong key — which is precisely what 2NF/3NF eliminate.

### Q12. How do you model a many-to-many relationship, and how do you decide between normalization and a document/embedded model?

In a relational schema, a many-to-many relationship needs a third table — a **junction** (or join/associative) table — because you cannot represent "many on both sides" with foreign keys on the two entity tables alone. Students enroll in many courses; courses have many students:

```sql
CREATE TABLE enrollments (
  student_id INT REFERENCES students(id),
  course_id  INT REFERENCES courses(id),
  enrolled_at TIMESTAMPTZ,        -- relationship attributes live here
  grade CHAR(1),
  PRIMARY KEY (student_id, course_id)
);
```

The composite primary key enforces "at most one enrollment per student-course pair," and the junction table is the natural home for attributes *of the relationship itself* (`grade`, `enrolled_at`) — they belong to neither entity alone. If a pair can recur (a student retakes a course), add a surrogate key and a separate uniqueness rule. This is also where 4NF bites: never merge two independent many-to-many's (student↔course and student↔club) into one junction table.

The normalize-vs-embed decision is driven by **access patterns and consistency needs**, not by which is "cleaner":

| Favor normalized/relational | Favor embedded/document |
|-----------------------------|-------------------------|
| Data is shared/referenced by many parents | Data is owned by, and only read with, one parent |
| You query the child independently | You always fetch the whole aggregate together |
| Strong cross-entity consistency / transactions | Read latency on a single aggregate matters most |
| The child is genuinely many-to-many | Bounded one-to-many (order → its line items) |

Embedding wins when the child is *part of* the parent's lifecycle and you read them as a unit — an order document with its line items embedded is one fetch, no join, and updates atomically as one document. It loses badly for many-to-many: embedding a course inside every student duplicates the course and recreates the update anomaly across documents (rename a course, touch every student). The reliable heuristic: embed what you own and always read together; reference what is shared or queried on its own. Many-to-many is almost always a reference relationship, so even document stores end up modeling it with IDs and a lookup — the same junction table, wearing a different hat.

---

## ACID & Transactions

### Summary

**What this topic covers** — This topic is about the transaction: the unit of work a database promises to execute as if it were a single, indivisible, isolated, durable operation. ACID is the acronym that names the four guarantees — Atomicity, Consistency, Isolation, Durability — and this topic drills into what each one *actually* means, the concrete machinery (logs, locks, MVCC, fences) that implements it, and the places where casual understanding goes wrong. It deliberately separates the precise, mechanism-level view from the marketing-level view, because interviewers probe exactly that gap.

**Mental model** — Think of a transaction as a *contract with rollback*. You declare a boundary (`BEGIN`), perform reads and writes that are invisible-or-tentative to everyone else, and then either ratify the whole thing (`COMMIT`) or pretend none of it happened (`ROLLBACK`). The database's job is to make that all-or-nothing illusion survive concurrency and crashes. Internally, two mechanisms carry most of the weight: a *log* that records intent before mutating the real data (so a crash can be replayed or undone), and a *concurrency control* scheme — locking or multi-version (MVCC) — that decides what one transaction sees of another's in-flight work. The senior insight is that ACID is not one feature but four loosely-coupled guarantees implemented by *different* subsystems: Atomicity and Durability come from the write-ahead log and recovery; Isolation comes from concurrency control; Consistency is mostly *your* invariants plus the engine's constraint checks. Knowing which subsystem owns which letter lets you reason about exactly what breaks under replication, async commit, or read-uncommitted.

**Key terms**
- **Atomicity** — all writes in a transaction take effect, or none do; there is no partial state visible after the fact.
- **Isolation** — concurrent transactions produce a result equivalent to some serial order; isolation *levels* relax this.
- **Durability** — once `COMMIT` returns success, the effect survives crash/power loss.
- **WAL (write-ahead log)** — append-only record of changes written *before* the data pages, enabling redo/undo recovery.
- **fsync** — the syscall that forces buffered writes from OS/disk cache onto stable storage.
- **MVCC** — multi-version concurrency control; readers see a snapshot, writers create new row versions instead of overwriting.
- **Savepoint** — a named intra-transaction marker you can partially roll back to without aborting the whole transaction.
- **Two-phase commit (2PC)** — protocol coordinating an atomic commit across multiple nodes/resources.
- **Dirty write / dirty read** — observing or overwriting another transaction's uncommitted data.
- **Write amplification** — the WAL means every logical write is physically written more than once.
- **Group commit** — batching many transactions' `fsync` into one to amortize disk latency.

**Why interviewers ask this** — ACID is the load-bearing vocabulary of data systems, so it's a fast filter. A junior recites "Atomicity, Consistency, Isolation, Durability" and stops. A senior names the *mechanism* per property, knows that the "C" in ACID is almost a freebie that piggybacks on the other three, distinguishes it sharply from CAP's C, and can explain why a transaction that "committed" on a replica might still be lost. They'll push on durability — does `COMMIT` returning mean it's on disk, on one disk, or quorum-acknowledged? — because that's where real systems make pragmatic (and dangerous) tradeoffs. Strong candidates also volunteer failure modes: long-running transactions wrecking MVCC, async commit trading durability for throughput, isolation levels that silently permit anomalies. The signal is whether you treat ACID as a slogan or as four engineering subsystems with knobs.

**Common confusions**
- **"Consistency in ACID means the same thing as in CAP."** No — ACID-C is invariant preservation within a node; CAP-C is linearizability across nodes. Different concepts, same letter.
- **"Isolation means transactions run one at a time."** It means the *result* is equivalent to some serial order; they run concurrently.
- **"COMMIT returning success guarantees the data is durable everywhere."** Only as far as the configured durability level — async commit or async replication can lose acknowledged commits.
- **"Atomicity is about concurrency."** Atomicity is about crash/abort recovery; Isolation is about concurrency. They're separate letters for a reason.
- **"Rolling back is free."** Rollback can be as expensive as the work it undoes, and long transactions make it worse.

**What follows from this topic** — Once you accept that Isolation is a *spectrum* rather than a binary, you're set up for the isolation-levels and anomalies topic (dirty reads, write skew, serializable vs snapshot). Durability's "where is it really written" question opens directly into replication, consensus, and the distributed-systems topics. And the long-running-transaction failure modes here connect to concurrency control, MVCC garbage collection, and lock contention covered elsewhere.

### Q13. Define ACID precisely. For each property, name the mechanism a database typically uses to provide it.

ACID is four *separate* guarantees, and the giveaway that someone understands them is that they attribute each to a different subsystem rather than treating ACID as one monolithic feature.

| Property | Precise meaning | Typical mechanism |
|---|---|---|
| **Atomicity** | A transaction's writes are all-or-nothing; after a crash or abort, no partial subset is visible. | Write-ahead log with undo (rollback) and redo (recovery) records. |
| **Consistency** | A committed transaction moves the database from one valid state to another, preserving declared invariants. | Constraint enforcement (`CHECK`, `FOREIGN KEY`, `UNIQUE`, triggers) — plus the application's own correctness. |
| **Isolation** | Concurrent transactions yield a result equivalent to *some* serial execution (at the strongest level). | Concurrency control: locking (2PL) or MVCC + snapshot/serializable checks. |
| **Durability** | Once `COMMIT` is acknowledged, the effect survives crash/power loss. | WAL flushed to stable storage via `fsync`, often plus replication. |

The key opinion to voice: **Atomicity and Durability are both the log's job** — the log records intent before the data changes, so recovery can either redo committed work or undo uncommitted work. **Isolation is the concurrency-control system's job** and is the one property you routinely *weaken* via isolation levels. And **Consistency (ACID-C) is the odd one out** — the database only enforces the invariants you declared; the rest is on you. If you `BEGIN`, debit account A, and forget to credit account B, ACID won't save you; the transaction is atomic, isolated, and durable, and *wrong*.

So when someone says "my database is ACID," the precise follow-up is: at what isolation level, and with what durability setting? Both are configurable, and both routinely default to something weaker than the textbook ideal.

### Q14. What exactly does the "C" (Consistency) in ACID mean, and how is it different from the "C" in CAP?

They share a letter and almost nothing else. This is a classic trap question.

**ACID-C** means: a transaction takes the database from one state that satisfies all declared integrity rules to another state that also satisfies them. The "rules" are things the engine can check — referential integrity, uniqueness, `CHECK` constraints, triggers — plus, crucially, the *application-level* invariants the developer intends (e.g. "total debits equal total credits"). The database only enforces the former; it provides Atomicity and Isolation so that *you* can enforce the latter. ACID-C is therefore largely a derived property: it's what you get *for free* once Atomicity, Isolation, and Durability hold and your transaction logic is correct. Many database theorists openly call the C "the weakest letter" or even a bit of a fudge added to make the acronym pronounceable.

**CAP-C** means **linearizability**: a guarantee about a *distributed* system that every read sees the most recent committed write, as if there were a single copy of the data and operations happened in a global real-time order. It's about *replica agreement across nodes*, not about invariants within one node.

| | ACID-C | CAP-C |
|---|---|---|
| Scope | Single database/node, single transaction | Distributed replicas |
| Concerns | Integrity constraints + app invariants | Real-time read recency / single-copy illusion |
| Violated by | A buggy transaction, a missing constraint | A stale read from a lagging replica |
| Sacrificed for | Nothing — it's a goal | Availability, during a network partition |

Concrete example: a single-node Postgres instance can be perfectly ACID-consistent (no constraint ever violated) while being completely irrelevant to CAP, because there's nothing to partition. Conversely, a globally-distributed store can serve a *valid* row (ACID-C fine) that is simply *out of date* (CAP-C violated) because you read a replica that hadn't yet applied the latest write. Same letter, orthogonal guarantees — say that out loud and you've passed the trap.

### Q15. Explain the lifecycle of a transaction: BEGIN, COMMIT, ROLLBACK, savepoints, and what "atomic" guarantees on a crash mid-commit.

A transaction has a simple state machine: it begins, accumulates changes that are tentative, and ends by either ratifying or discarding them.

```text
        BEGIN
          │
          ▼
   ┌─────────────┐   ROLLBACK / error / crash
   │  ACTIVE     │ ───────────────────────────► ABORTED (all changes undone)
   │ (reads,     │
   │  writes,    │   SAVEPOINT s1 ... ROLLBACK TO s1
   │  savepoints)│ ◄──── partial undo, txn still ACTIVE
   └─────────────┘
          │ COMMIT
          ▼
     COMMITTED (durable, visible to others)
```

`BEGIN` opens the transaction and, in an MVCC engine, conceptually fixes the snapshot the transaction reads from. During `ACTIVE`, your writes go into the WAL and into in-memory/dirty pages but are invisible (or tentative) to other transactions per the isolation level. `COMMIT` writes a commit record to the log, flushes it durably, and makes the changes visible. `ROLLBACK` discards everything — using undo information or, in MVCC, simply abandoning the row versions this transaction created and marking it aborted.

**Savepoints** give you a partial undo within a single transaction:

```sql
BEGIN;
  INSERT INTO orders ...;
  SAVEPOINT after_order;
  INSERT INTO line_items ...;   -- this fails
  ROLLBACK TO after_order;      -- undo the line_items, keep the order
  INSERT INTO line_items ...;   -- retry
COMMIT;
```

You roll back to `after_order` without losing the whole transaction. Useful for retry logic and for ORMs implementing nested transactions (which are almost always savepoints under the hood, not real nesting).

**The crash-mid-commit question is the meat.** Atomicity hinges on one fact: *the commit is defined by a single durable write of the commit record to the log.* Everything before that flush is reversible. So:

- Crash *before* the commit record is fsync'd → on restart, recovery sees no commit record and **undoes** the transaction. The client never got a success, so no promise was broken.
- Crash *after* the commit record is durably written → recovery sees it and **redoes** any of the transaction's changes that hadn't reached the data files. The client may or may not have received the acknowledgement, but the data is there.

There is no in-between where half the rows land. The atomic "flip" is the single log write; the rest is replay. That's why a torn data-page write doesn't corrupt atomicity — the log is the source of truth, and recovery reconstructs the data pages from it.

### Q16. How is Durability actually achieved? Explain write-ahead logging and fsync, and what "committed" really promises.

Durability is the property people *think* they understand and usually don't, because the honest answer is "it depends on your durability setting."

The core technique is **write-ahead logging (WAL)**, sometimes called the redo log (InnoDB) or just "the log." The rule — *write-ahead* — is: **append the change description to the log and flush it to stable storage before you're allowed to consider the transaction committed**, and before (or independently of) updating the actual data pages. The data pages can be written lazily, in the background, in any order, because the log is the authoritative record. On crash recovery, the engine replays the log forward (redo) to reapply committed changes that hadn't hit the data files, and rolls back (undo) anything uncommitted. This converts random data-page writes into cheap sequential log appends, which is also why WAL is a performance win, not just a safety one.

**`fsync` is where durability becomes physical.** Writing to a file only puts bytes in the OS page cache; a power loss there loses them. `fsync` (or `fdatasync`, `O_DSYNC`, etc.) forces those bytes through the OS cache and the drive's own write cache onto stable media. The classic durability bug — and a great interview war story — is a disk that lies about `fsync`, acknowledging before data is truly on platters/flash, so a power cut loses "committed" data.

So what does **"committed" actually promise?** Exactly as much as the configured durability level:

| Setting | What COMMIT means | Risk |
|---|---|---|
| Synchronous WAL flush (default-ish) | Commit record fsync'd to local disk before ack | Survives process/OS crash and power loss on that node |
| Asynchronous / delayed commit | Ack returns before fsync; flushed shortly after | A crash loses the last few ms of "committed" txns — atomicity intact, durability sacrificed |
| Synchronous replication / quorum | Acked only after N replicas confirm (e.g. Spanner, sync standbys) | Survives node loss; costs latency |

Two performance notes worth volunteering: **group commit** batches many transactions into one `fsync` to amortize the (expensive) disk-flush latency across concurrent committers; and async commit (Postgres `synchronous_commit = off`, MySQL `innodb_flush_log_at_trx_commit = 2`) is a deliberate, common trade — you keep Atomicity and Isolation but accept that a crash can lose the most recent acknowledged commits. The senior takeaway: "committed" is a *configurable* promise, and you should know which one your system is actually making before you build money-movement on top of it.

### Q17. Contrast ACID with BASE. When is BASE the right tradeoff, and what do you give up?

BASE is the deliberately-cheeky counterpoint acronym: **B**asically **A**vailable, **S**oft state, **E**ventual consistency. Where ACID optimizes for correctness-on-every-operation, BASE optimizes for availability and scale, accepting that the system is *converging* toward consistency rather than guaranteeing it at each read.

| | ACID | BASE |
|---|---|---|
| Consistency | Strong, immediate, invariant-preserving | Eventual; reads may be stale |
| Availability | May reject/block under contention or partition | Stays available, serves possibly-stale data |
| Writes | Coordinated, often single-master, transactional | Often multi-master, last-write-wins or CRDT merge |
| Typical homes | RDBMS (Postgres, MySQL), Spanner | Dynamo-style stores (Cassandra, DynamoDB eventual mode, Riak) |
| Failure under partition | Favors C (CP) | Favors A (AP) |

The honest framing: BASE is essentially the **AP** corner of CAP plus an operational philosophy. You spread data across many nodes, let writes succeed locally without global coordination, and reconcile divergence afterward via mechanisms like vector clocks, last-write-wins timestamps, read-repair, anti-entropy, or CRDTs.

**When BASE is right:** when availability and horizontal scale matter more than reading your own latest write *immediately*, and the domain tolerates brief divergence. Shopping carts, user sessions, social feeds, like counts, telemetry, product catalogs, recommendation data — a like count that's off by one for 200ms harms nobody, and you'd rather stay up during a partition than reject writes. High write volume across regions is the canonical BASE case.

**What you give up:** read-your-writes and monotonic-read guarantees unless you bolt them on; multi-key atomic transactions (so you re-implement invariants in application code, with idempotency and conflict resolution); and the comfortable "the database enforces correctness" model. You inherit anomalies — concurrent updates that must be merged, deletes that resurrect ("zombie" rows) if anti-entropy fights a tombstone, counters that need special CRDT handling.

The senior nuance to land: ACID vs BASE is not a binary religion. Modern systems mix them — DynamoDB offers eventual *and* strongly-consistent reads and now transactions; Cassandra has lightweight transactions (Paxos) for the rare path that needs it; Spanner delivers ACID *globally* by paying a latency tax via TrueTime. The real engineering answer is per-operation: use ACID for the money-movement path, BASE for the firehose, in the same product.

### Q18. What is a long-running transaction and why is it dangerous (locks, MVCC bloat, lock escalation, blocking)?

A long-running transaction is one that stays open — `ACTIVE`, uncommitted — for a long time: seconds to hours. It might be a genuinely big batch job, but far more often it's a bug: a transaction left open across a slow network call, a user "think time" pause, an ORM that began a transaction and forgot to commit, or an idle-in-transaction connection. They're dangerous out of all proportion to how innocent they look, and the failure mode differs by concurrency-control style.

**In a locking system (2PL):** a long transaction holds its locks until commit. Anything that needs a conflicting lock *blocks* behind it, and blocking cascades — a queue of waiters forms behind a single stuck transaction, throughput collapses, and you get timeouts far from the actual culprit. **Lock escalation** makes it worse: many engines convert a large number of fine-grained row locks into a single coarse table lock to save memory, so a big transaction can suddenly lock an entire table, freezing unrelated work. Long transactions also widen the window for **deadlocks**.

**In an MVCC system (Postgres, InnoDB, Oracle):** the danger is subtler and nastier — **bloat**. MVCC keeps old row versions around as long as *any* transaction might still need to see them. An old transaction's snapshot pins the "oldest visible version" horizon, so the garbage collector (Postgres `VACUUM`, InnoDB purge, undo/rollback segments) **cannot reclaim** dead tuples newer than that snapshot — even rows the long transaction never touched. Consequences:

- Tables and indexes bloat with dead versions that can't be cleaned → disk grows, cache hit rate drops, scans slow down.
- Postgres specifically risks **transaction-ID wraparound** pressure, because an ancient open transaction holds back the freeze horizon; in the worst case the database forces a protective shutdown.
- Oracle's bounded undo can overflow and you get the classic `ORA-01555: snapshot too old` on the *reader*.

```text
txn A: BEGIN (snapshot taken) ............................. (still open!)
txn B,C,D: many UPDATEs creating dead row versions
VACUUM/purge: "can't remove these — A might still see them"  → BLOAT
```

The senior guidance: keep transactions short and scoped to actual DB work — never hold one open across user think-time, external API calls, or message-queue round-trips. Monitor for `idle in transaction`, set `idle_in_transaction_session_timeout` and statement timeouts, and split big batch jobs into chunked, separately-committed units. The recurring real-world incident is "queries got slow and disk filled up" tracing back to one forgotten `BEGIN` on a connection sitting idle for hours.

---

## Isolation Levels & Anomalies

### Summary

**What this topic covers** — This topic is about what "isolation" — the I in ACID — actually buys you, and what it doesn't. Concurrent transactions interleave their reads and writes, and without coordination they observe each other's half-finished work or trample each other's updates. Isolation levels are the formal contract for *how much* interference a transaction may witness. We cover the classic ANSI read phenomena (dirty read, non-repeatable read, phantom), the four ANSI levels, the modern reality of multi-version concurrency control (MVCC) and snapshot isolation, the anomalies snapshots still permit (write skew, lost update), and how Serializable Snapshot Isolation reclaims true serializability without pessimistic locking.

**Mental model** — Think of isolation as a dial that trades correctness for concurrency. At the strong end, transactions behave *as if* they ran one at a time (serializable); at the weak end, they freely observe each other's in-flight changes for maximum throughput. The senior mental model is that the ANSI standard defines levels by which *phenomena they forbid*, but real databases implement them with two very different machines: lock-based (readers block writers) and MVCC (readers see a consistent snapshot, never blocking writers). These produce *different* anomaly profiles even at the "same" named level — Postgres `REPEATABLE READ` is actually snapshot isolation and forbids phantoms, while the ANSI definition allows them. So the level name is a loose promise; what matters is the concrete set of anomalies your engine permits. Always reason about your workload's invariants — "no two doctors both off-call", "balance never negative" — and ask which interleavings could break them, rather than trusting the marketing label.

**Key terms**
- **Dirty read** — reading a row another transaction has written but not yet committed.
- **Non-repeatable read** — re-reading the same row in one transaction yields a different value because another committed in between.
- **Phantom read** — re-running a range query returns new rows that another transaction inserted/committed.
- **MVCC** — multi-version concurrency control; writers create new row versions so readers never block on writers.
- **Snapshot isolation (SI)** — each transaction reads from a consistent snapshot taken at its start.
- **Write skew** — two transactions read an overlapping set, then each writes a disjoint part, jointly violating an invariant.
- **Lost update** — two read-modify-write cycles race; one overwrites the other's committed change.
- **Serializable** — outcome is equivalent to *some* serial order of the transactions.
- **First-committer-wins** — SI conflict rule: concurrent writes to the same row abort the later committer.
- **Predicate lock** — a lock over a query condition (not just existing rows) used to prevent phantoms.
- **SSI** — Serializable Snapshot Isolation; SI plus runtime detection of dangerous read-write dependency cycles.

**Why interviewers ask this** — Isolation is where candidates reveal whether they've actually shipped concurrent systems or just memorized ACID expansions. A junior recites "the four levels" and stops; a senior knows the level *names* are unreliable across engines, that the common production default is `READ COMMITTED` (not serializable), and that snapshot isolation — what most people get when they ask for `REPEATABLE READ` — still allows write skew and lost updates. The interviewer wants to see you reason from an *invariant* to the specific anomaly that threatens it and then pick the right tool (`SELECT FOR UPDATE`, a unique constraint, optimistic versioning, or bumping the isolation level). Confusing serializability with linearizability, or ACID's C with CAP's C, is the classic senior-vs-staff dividing line.

**Common confusions**
- **"REPEATABLE READ prevents phantoms."** Under ANSI it doesn't; under MVCC engines (Postgres) it usually does — the name is ambiguous.
- **"Serializable means transactions actually run one at a time."** No — they run concurrently; the *result* is merely equivalent to some serial order.
- **"Snapshot isolation is serializable."** It isn't; it permits write skew, which no serial execution would.
- **"Higher isolation is always safer, so always use SERIALIZABLE."** It increases aborts/retries and contention; you must handle serialization-failure retries.
- **"Lost update and write skew are the same bug."** Related but distinct — lost update is same-row, write skew is disjoint-row across a shared predicate.

**What follows from this topic** — Isolation sits on top of concurrency control mechanisms (2PL, MVCC, timestamp ordering) and feeds directly into distributed-systems consistency: serializability is a *transaction* property, linearizability is a *single-object* recency property, and Spanner-style "external consistency" combines both. It also connects to the durability/atomicity side of ACID and to how distributed databases trade isolation for availability under CAP.

### Q19. Name the read phenomena (dirty read, non-repeatable read, phantom read) and which ANSI isolation level permits each.

The ANSI SQL standard defines isolation levels negatively — by which of three read phenomena they *forbid*. The three, in increasing scope:

- **Dirty read** — you read a row another transaction has modified but not committed. If that transaction rolls back, you acted on data that never existed.
- **Non-repeatable read** — you read row `X`, another transaction updates and commits `X`, you read `X` again in the *same* transaction and get a different value. The single row changed under you.
- **Phantom read** — you run `SELECT ... WHERE status = 'active'`, another transaction inserts a new matching row and commits, you re-run the query and a new row *appears*. The set of matching rows changed, not just a value.

The mapping:

| Level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| `READ UNCOMMITTED` | Allowed | Allowed | Allowed |
| `READ COMMITTED` | Prevented | Allowed | Allowed |
| `REPEATABLE READ` | Prevented | Prevented | Allowed |
| `SERIALIZABLE` | Prevented | Prevented | Prevented |

The progression is cumulative: each level adds one guarantee. The distinction between non-repeatable read and phantom is the one candidates fumble — non-repeatable is about an *existing row's value* changing; a phantom is about *membership in a result set* changing (new or removed rows matching a predicate). That difference is exactly why phantoms need predicate-level protection (range locks or predicate locks), not just row locks.

One sharp caveat for the interview: this table describes the *standard*, not any real engine. The phenomena were defined assuming lock-based concurrency, and MVCC databases don't fit cleanly. Quote the table, then immediately note that your actual engine's behavior may differ — Postgres at `REPEATABLE READ` forbids phantoms.

### Q20. Explain the four ANSI isolation levels and the practical default in most databases. Why is READ COMMITTED the common default?

The four levels, from weakest to strongest:

- **`READ UNCOMMITTED`** — almost no guarantees; permits dirty reads. In practice rarely useful; Postgres doesn't even implement it as distinct from `READ COMMITTED`. SQL Server supports it (often via the `NOLOCK` hint) for cheap, approximate reporting reads where you accept inaccuracy.
- **`READ COMMITTED`** — you only ever see committed data, but each *statement* sees a fresh view, so values can change between statements in your transaction. This is the default in Postgres, Oracle, and SQL Server.
- **`REPEATABLE READ`** — your transaction sees a stable view of any row it has read; re-reads are consistent. This is MySQL/InnoDB's default. In MVCC engines this is typically implemented as snapshot isolation.
- **`SERIALIZABLE`** — the execution is equivalent to *some* serial ordering of the transactions; all anomalies forbidden.

`READ COMMITTED` is the common default because it's the sweet spot of the correctness/throughput trade. It eliminates the one phenomenon almost no application can tolerate — dirty reads — while keeping locks short-lived: a read releases its view at statement boundaries rather than holding a snapshot for the whole transaction. That means less contention, fewer deadlocks, and very few serialization-failure aborts, so application developers rarely need retry logic. Most OLTP code is written as small, short transactions where the weaker guarantee is invisible.

The trade you accept: non-repeatable reads and phantoms are legal. If you `SELECT` a balance, then `SELECT` it again later in the same transaction, it can differ. For most CRUD this is fine; for read-modify-write logic it is a footgun (see lost update, Q23). The senior move is to default to `READ COMMITTED`, then *selectively* escalate the few transactions with real cross-statement invariants to `REPEATABLE READ`/snapshot or `SERIALIZABLE`, rather than globally raising the level and eating the contention everywhere.

### Q21. What is snapshot isolation, and how does it differ from SERIALIZABLE? What anomaly does it still allow?

Snapshot isolation (SI) gives each transaction a consistent snapshot of the database as of the moment it started (or its first read). All reads come from that frozen point-in-time view, so the transaction sees no concurrent commits — reads never block and are never blocked by writers, because writers create *new versions* (MVCC) rather than overwriting. On commit, SI applies **first-committer-wins**: if two concurrent transactions wrote the same row, the one that commits second aborts.

```text
T1 start ----[reads snapshot @ t0]----[writes X]----commit
T2  start --------[reads snapshot @ t0]----[writes X]----abort (X already changed)
```

SI is appealing because it gives read-only transactions a perfectly consistent view for free and dramatically reduces locking. Postgres `REPEATABLE READ` and Oracle's "serializable" mode are both really SI.

How it differs from true `SERIALIZABLE`: SI is **not** serializable. The first-committer-wins rule only catches *write-write* conflicts on the *same row*. It does nothing about read-write dependencies — transactions that read overlapping data but write *disjoint* data. Each reads from a stale snapshot, makes a locally valid decision, writes a different row, and both commit. No serial order could have produced that outcome.

The anomaly SI permits is **write skew** (Q22), and by extension certain read-only anomalies. A serial schedule has *no* such gap: if T1 and T2 had run one after the other, the second would have seen the first's write and decided differently. This is precisely the gap SSI (Q24) closes. So: SI ≈ serializable *minus write skew*. If your invariant spans multiple rows and is enforced by reading-then-writing-elsewhere, SI will silently let it break.

### Q22. Explain write skew with a concrete example (e.g. the on-call doctors problem). Why does snapshot isolation permit it?

Write skew is when two transactions read an overlapping data set, each makes a decision based on what it read, then each writes to a *different* row — and the combination violates an invariant that each transaction individually believed it was preserving.

The canonical example: a hospital requires **at least one doctor on call** at all times. Alice and Bob are both on call and both feel ill, so each tries to go off-call simultaneously.

```sql
-- Invariant: COUNT(*) WHERE on_call = true  must stay >= 1

-- T_alice:
SELECT count(*) FROM doctors WHERE on_call = true AND shift = 'night';  -- sees 2
-- 2 >= 1, safe to drop out
UPDATE doctors SET on_call = false WHERE name = 'alice';
COMMIT;

-- T_bob (concurrent):
SELECT count(*) FROM doctors WHERE on_call = true AND shift = 'night';  -- also sees 2
-- 2 >= 1, safe to drop out
UPDATE doctors SET on_call = false WHERE name = 'bob';
COMMIT;
```

Both transactions read `count = 2` from their respective snapshots, both conclude it's safe, and they write *different rows* (`alice` vs `bob`). First-committer-wins doesn't fire because there's no write-write conflict on the same row. Both commit. Now zero doctors are on call — an outcome no serial execution could ever produce, because the second-to-run transaction would have seen `count = 1` and refused.

Snapshot isolation permits this because SI only guards write-write conflicts. The conflict here is **read-write**: each transaction's *write* invalidates the *premise* the other *read*. SI never tracks that a transaction's read set was changed by another's write. Other write-skew flavors: double-spending against a shared balance read, two transactions both claiming the "last" meeting room, allocating duplicate IDs from a read-then-insert.

Fixes: materialize the conflict so it becomes a write-write or lock conflict — `SELECT ... FOR UPDATE` on the rows you read, add an actual constraint/aggregate row both transactions must touch, or move to `SERIALIZABLE`/SSI, which detects the read-write dependency cycle and aborts one.

### Q23. What is the lost update problem, and what are the ways to prevent it (SELECT FOR UPDATE, atomic ops, optimistic versioning)?

A lost update happens when two transactions both do a *read-modify-write* on the **same row**, and one overwrites the other's committed change as if it never happened. Classic case: incrementing a counter.

```text
T1: read balance=100
T2: read balance=100
T1: write balance=100+10 = 110, commit
T2: write balance=100+20 = 120, commit   -- T1's +10 is lost; should be 130
```

Both read 100; T2's write is based on a stale read and clobbers T1's increment. Under `READ COMMITTED` and even plain snapshot isolation this can occur (snapshot isolation actually catches *this* one via first-committer-wins if both write the same row concurrently — but `READ COMMITTED` does not). It's distinct from write skew: lost update is *same-row*, write skew is *disjoint-row across a shared predicate*.

Four standard preventions, roughly pessimistic → optimistic:

- **Atomic read-modify-write in the DB** — let the database do the arithmetic: `UPDATE accounts SET balance = balance + 10 WHERE id = 1`. The engine takes the row lock for you; no application-side read happens. Best option when expressible. Same idea for `INCR` in Redis.
- **`SELECT ... FOR UPDATE`** — pessimistic locking: read the row *and* take a write lock, blocking other readers-for-update until you commit. `SELECT balance FROM accounts WHERE id=1 FOR UPDATE;` then update. Correct, but holds a lock for the round-trip and can deadlock under contention.
- **Optimistic versioning (compare-and-set)** — carry a `version` column; on write, `UPDATE ... SET balance=?, version=version+1 WHERE id=? AND version=?`. If `rows_affected = 0`, someone else updated first — you re-read and retry. Great for low-contention, read-heavy paths; avoids holding locks, but you must write retry logic.
- **Higher isolation** — `SERIALIZABLE`/SSI detects the conflict and aborts one transaction with a serialization failure; you retry. Simplest code-wise, but pushes the cost into retries.

Rule of thumb: prefer the atomic DB operation when the update is expressible as arithmetic; use optimistic versioning for object-graph updates over HTTP (no held DB transaction); reserve `FOR UPDATE` for short, hot, must-serialize sections.

### Q24. What is Serializable Snapshot Isolation (SSI) and how does it detect conflicts without full locking?

SSI is the technique that makes a `SERIALIZABLE` level achievable on top of MVCC *without* pessimistic read locks. It's what Postgres uses for `SERIALIZABLE` (since 9.1) and the basis of CockroachDB-style serializability. The insight: start with snapshot isolation — cheap, non-blocking reads — and then *detect at runtime* the specific dependency pattern that makes SI non-serializable, aborting a transaction only when a real anomaly is about to commit.

The theory (Cahill/Fekete) says every SI anomaly, including write skew, requires a cycle in the dependency graph containing **two consecutive read-write (`rw`) dependency edges** — a structure called a "dangerous structure," where a pivot transaction has both an incoming and an outgoing `rw` anti-dependency. An `rw` anti-dependency means transaction T1 *read* something that T2 then *wrote* (T1's read missed T2's write). SSI tracks these edges and, when it sees the dangerous two-edge pattern, aborts the pivot.

Mechanically, SSI is optimistic. It doesn't take locks that block other transactions; instead it records lightweight **SIREAD locks** — predicate/range markers noting *what each transaction read*, including index ranges to catch phantoms. When a writer modifies data that a concurrent transaction's SIREAD covers, the engine flags an `rw` edge. No transaction waits on these; reads stay non-blocking. Only at commit (or when the dangerous structure completes) does one transaction get killed with a serialization failure (`SQLSTATE 40001`).

```text
T1 reads R  ──rw──▶ T2 writes R        (T1 missed T2's write)
T2 reads S  ──rw──▶ T3 writes S        T2 is the pivot: in-rw AND out-rw → abort T2
```

The practical consequences for an interview: SSI gives you true serializability with read concurrency close to SI, but it is **optimistic**, so under contention it produces serialization-failure aborts that your application **must catch and retry**. It can also throw false positives — aborting transactions that would actually have been safe — because the dependency tracking is conservative. So SSI is excellent when conflicts are rare and correctness is paramount; if your workload has heavy write contention on the same hot keys, the retry storm may make explicit locking (`FOR UPDATE`) cheaper and more predictable.

---

## Concurrency Control

### Summary

**What this topic covers** — Concurrency control is the machinery a database uses to let many transactions run at once while preserving the illusion that each ran alone. It is the implementation layer beneath the isolation guarantees of ACID: where isolation levels describe *what anomalies are permitted*, concurrency control describes *how* the engine actually prevents (or admits) them — through locks, multi-version snapshots, validation passes, and the ordering rules that resolve conflicts. This topic spans the two dominant families (lock-based and version-based), the failure mode they create (deadlock), and the knobs that govern lock cost (granularity, escalation, lock modes).

**Mental model** — Picture every transaction as wanting a consistent, private view of the data plus the right to mutate parts of it. Two strategies exist. The pessimistic one assumes conflicts are likely, so it makes a transaction *acquire permission* (a lock) before touching data and hold it until safe to release — readers and writers serialize at contended rows. The optimistic/multi-version one assumes conflicts are rare, so it lets transactions proceed against a snapshot and only checks for conflict at commit (OCC) or never blocks readers at all (MVCC). The deep truth: serializability is a property of the *schedule* of operations, and you can reach it either by physically preventing bad interleavings (strict 2PL) or by detecting and aborting them after the fact (serializable snapshot isolation, OCC). Every real engine is a blend — Postgres and InnoDB use MVCC for reads but locks for writes. Performance lives in the gap between "correct" and "minimally restrictive."

**Key terms**
- **Schedule** — the interleaved order of operations from concurrent transactions.
- **Serializable schedule** — one equivalent to *some* serial (one-at-a-time) execution.
- **2PL** — two-phase locking; acquire-then-release discipline that guarantees serializability.
- **Strict 2PL** — hold all exclusive locks until commit/abort; avoids cascading aborts.
- **MVCC** — multi-version concurrency control; keep old row versions so readers see a snapshot.
- **Snapshot** — the consistent point-in-time view a transaction reads from under MVCC.
- **OCC** — optimistic concurrency control; run freely, validate at commit, abort on conflict.
- **Deadlock** — a cycle of transactions each waiting on a lock another holds.
- **Wait-for graph** — directed graph of "T1 waits on T2"; a cycle means deadlock.
- **Lock granularity** — the size of the locked unit: row, page, or table.
- **Lock escalation** — converting many fine locks into one coarse lock to save memory.
- **Gap lock** — a lock on the *range between* index entries, blocking phantom inserts.

**Why interviewers ask this** — Isolation levels are the "what"; concurrency control is the "how," and the gap between the two is where senior signal lives. A junior recites "the database uses locks." A senior knows that `SELECT` under MVCC takes no lock at all, that strict 2PL is what actually delivers `SERIALIZABLE` in lock-based engines, that MVCC's hidden tax is garbage collection (Postgres `VACUUM`, Oracle undo, InnoDB purge), and that deadlocks are *expected* under row locking — you design retry loops, not pray they vanish. The strongest candidates connect a concrete production symptom ("our writes stall," "the table bloats," "we see `deadlock detected`") back to the underlying mechanism and propose the right lever: shorter transactions, consistent lock ordering, a coarser or finer granularity, or moving read-heavy work onto a snapshot.

**Common confusions**
- **"MVCC means no locks."** Writers still take row locks and conflict; MVCC only frees readers from blocking writers.
- **"2PL means two locks."** The "two phases" are growing and shrinking *over time*, not a count of locks.
- **"Optimistic is always faster."** Under contention, OCC's abort-and-retry storms can be far worse than just waiting.
- **"Deadlocks are bugs you can eliminate."** With fine-grained locking they're inherent; you detect-and-retry or order acquisitions.
- **"Gap locks are pointless overhead."** They're what makes `REPEATABLE READ`/`SERIALIZABLE` immune to phantoms in a lock-based engine.

**What follows from this topic** — Concurrency control is the engine room beneath *Transactions & Isolation Levels* (the anomalies these mechanisms permit or forbid) and *Storage & Indexing* (MVCC versions live in heaps/undo, gap locks ride on B-tree index ranges). It also sets up *Distributed Systems*, where single-node locking generalizes to two-phase commit, distributed deadlock, and the linearizability-vs-serializability distinction that CAP and consensus protocols turn on.

### Q25. Explain two-phase locking (2PL) and strict 2PL. What does the "two phases" refer to, and what does it guarantee?

The "two phases" are about *time*, not the number of locks. A transaction has a **growing phase**, during which it may acquire locks but release none, followed by a **shrinking phase**, during which it may release locks but acquire none. Once a transaction releases its first lock, it can never take another. That single discipline is what guarantees **conflict-serializability**: any schedule produced by 2PL is equivalent to some serial order.

```text
locks held
   ^        growing        shrinking
   |        _______
   |       /       \
   |      /         \____
   |_____/               \____  time -->
        ^                      ^
     first lock           last release
```

Plain 2PL is correct but has two ugly problems. First, if T1 releases a lock during its shrinking phase and then aborts, any T2 that already read the data T1 wrote must also abort — a **cascading rollback**. Second, T2 could read uncommitted data that later vanishes (dirty read territory).

**Strict 2PL** fixes both by holding all *exclusive* (write) locks until the transaction commits or aborts — the shrinking phase collapses to a single moment at commit. **Strong strict (rigorous) 2PL** holds *all* locks, shared and exclusive, until commit. This is what most lock-based engines actually implement for `SERIALIZABLE`, because it makes the serialization order match the commit order and eliminates cascading aborts.

The cost is reduced concurrency: locks are held longer than strictly necessary, so contended rows serialize hard. This is precisely why MVCC engines avoid locking for reads — strict 2PL's read locks are the expensive part, and snapshots make them unnecessary.

### Q26. Explain MVCC: how do multiple versions let readers avoid blocking writers? What is the cost (version storage, garbage collection)?

MVCC keeps **multiple physical versions** of each logical row, each tagged with the transaction that created it (and, in some designs, the one that deleted it). A reader executes against a **snapshot** — the set of versions that were committed as of the transaction's start (or statement start, depending on isolation level). When a writer updates a row, it creates a *new* version rather than overwriting the old one. The reader holding an older snapshot still sees the old version, so it never has to wait for the writer, and the writer never has to wait for the reader. The classic slogan: **readers don't block writers, and writers don't block readers.**

Writers still conflict with *each other*. Two transactions updating the same row serialize via a row lock — MVCC doesn't make write-write conflicts disappear, it only removes read-write blocking.

```text
row id=7:  v1 (xmin=100) ──> v2 (xmin=150) ──> v3 (xmin=200)
txn @ snapshot=120 reads v1   txn @ snapshot=180 reads v2
```

The costs are real and operational:

- **Version storage / bloat.** Old versions occupy space until reclaimed. Postgres keeps dead tuples in the table heap (table *bloat*); InnoDB and Oracle keep prior images in a separate **undo/rollback segment**.
- **Garbage collection.** Something must reclaim versions no live snapshot can see. Postgres runs `VACUUM` (and autovacuum); InnoDB runs a background **purge** thread; Oracle expires undo. Neglect it and you get bloat, index degradation, and — in Postgres — transaction-ID wraparound danger.
- **Long-running transactions are toxic.** A single ancient open transaction pins a snapshot, so GC can't reclaim *anything* newer than it. One idle `BEGIN` can bloat an entire database.

So MVCC trades the contention cost of locking for a *space + maintenance* cost. For read-heavy OLTP it's almost always the right trade, which is why Postgres, Oracle, and InnoDB all use it.

### Q27. Contrast pessimistic vs optimistic concurrency control. When is each appropriate?

**Pessimistic** control assumes conflicts are likely, so it acquires locks *before* touching data and holds them, forcing conflicting transactions to wait. **Optimistic** (OCC) assumes conflicts are rare, so transactions run unobstructed against a local/snapshot copy and only **validate at commit** — if someone else modified the same data in the meantime, the transaction aborts and retries.

| Dimension | Pessimistic (locking) | Optimistic (OCC) |
|---|---|---|
| When conflict is checked | Before access (lock) | At commit (validate) |
| Failure mode | Blocking, deadlock | Abort + retry |
| Wasted work | Waiting | Re-running aborted txns |
| Best when | High contention | Low contention |
| Latency profile | Predictable under load | Spiky under contention |

The rule of thumb: **OCC wins when conflicts are rare and transactions are short**; the validation is cheap and almost everything commits first try. **Pessimistic wins under genuine contention** — when many transactions hammer the same hot rows, OCC degrades into an *abort storm* where transactions repeatedly do work, fail validation, and retry, burning CPU with little forward progress, while a lock would have simply queued them efficiently.

OCC shows up in more places than people expect. Application-level **`version` columns / compare-and-swap** (`UPDATE ... WHERE version = 42`) are OCC. DynamoDB conditional writes, Git's merge model, and most ORMs' "optimistic locking" are OCC. Postgres's `SERIALIZABLE` isolation (SSI — serializable snapshot isolation) is essentially optimistic: it runs on snapshots and aborts at commit if it detects a dangerous dependency cycle, returning `could not serialize access`. The practical consequence: if you choose an optimistic strategy, you *must* build a retry loop with backoff — aborts are a normal control-flow path, not an error.

### Q28. What is a deadlock? How do databases detect vs prevent them (wait-for graphs, timeouts, wound-wait/wait-die ordering)?

A **deadlock** is a cycle of transactions each holding a lock the next one needs. The textbook case: T1 locks row A then asks for row B; T2 has already locked B and now asks for A. Neither can proceed; both wait forever absent intervention.

```text
T1 holds A, wants B
T2 holds B, wants A
wait-for graph:  T1 ──> T2 ──> T1   (cycle = deadlock)
```

There are two broad strategies:

**Detection** (the common approach). The engine maintains a **wait-for graph** of "T waits on T'" edges and periodically searches for a cycle. On finding one it picks a **victim** (usually the transaction with the least work done, or fewest locks held) and aborts it with an error like Postgres's `deadlock detected` or InnoDB's `ER_LOCK_DEADLOCK`. The application is expected to retry. Some engines use **timeouts** as a cheap proxy — if a lock wait exceeds `innodb_lock_wait_timeout`, assume deadlock and abort — but timeouts give false positives (a slow-but-progressing transaction) and false negatives (a real deadlock that resolves slowly).

**Prevention** via ordering, used in some distributed systems where global graph maintenance is expensive. Assign each transaction a timestamp and only ever let conflicts resolve in one consistent direction:

- **Wait-die** (non-preemptive): an *older* transaction requesting a lock held by a younger one *waits*; a *younger* one requesting an older's lock *dies* (aborts and retries with its original timestamp).
- **Wound-wait** (preemptive): an *older* transaction *wounds* (aborts) the younger holder and takes the lock; a *younger* one requesting an older's lock *waits*.

Because timestamps impose a total order, no cycle can form. The practical engineering advice is simpler than any algorithm: **always acquire locks in a consistent global order** (e.g., always lock rows by ascending primary key) and **keep transactions short** — most production deadlocks come from two code paths grabbing the same rows in opposite orders.

### Q29. Explain lock granularity and lock escalation: row vs page vs table locks, and the tradeoffs of each.

**Granularity** is the size of the unit you lock. Finer granularity (row) maximizes concurrency — two transactions touching different rows of the same table never conflict — but each lock costs memory and CPU to track, so a statement touching a million rows might hold a million locks. Coarser granularity (page or table) is cheap to track but throttles concurrency: a table lock blocks every other writer regardless of which row they want.

| Granularity | Concurrency | Lock overhead | Typical use |
|---|---|---|---|
| Row | Highest | Highest (one per row) | OLTP point writes |
| Page | Medium | Medium | Some engines (SQL Server) |
| Table | Lowest | Lowest (one lock) | DDL, bulk load, full scans |

**Lock escalation** is the engine's response to fine-grained locks getting too numerous. When a single transaction accumulates too many row/page locks (e.g., SQL Server's ~5000-lock threshold), the engine *escalates*: it releases the many fine locks and acquires one coarse lock (row → table) to cap memory. This trades concurrency for resource control — and is a classic source of surprise blocking, where a large `UPDATE` suddenly locks the whole table and stalls unrelated transactions.

Engines differ sharply here. **InnoDB does not escalate** — it locks at row granularity (technically index-record granularity) and keeps locks compact, accepting the bookkeeping cost. **SQL Server escalates aggressively** to a table lock by default. This is why "the same large batch update" behaves completely differently across engines: one quietly holds many row locks, the other grabs the table and blocks everyone.

The senior takeaway: escalation is usually a signal you're doing too much work in one transaction. The fixes are to **batch large writes into smaller chunks** (commit every N thousand rows), to ensure the operation is well-indexed so it locks records rather than scanning and locking ranges, and — where the engine allows — to disable escalation on hot tables.

### Q30. What are shared vs exclusive locks, intent locks, and predicate/gap locks? Why do gap locks exist?

**Shared (S)** and **exclusive (X)** are the base lock modes. Many transactions can hold an S lock on the same item simultaneously (concurrent reads are fine); an X lock is exclusive — no other lock of any mode can coexist with it (a writer needs sole access). The compatibility matrix is the whole story:

```text
        held S    held X
want S    ✓         ✗
want X    ✗         ✗
```

**Intent locks (IS / IX)** solve a hierarchy problem. Before a transaction takes a row-level X lock, it sets an **intent-exclusive (IX)** lock on the parent table. Now, when another transaction wants a *table*-level X lock (say, for DDL), it can detect the conflict by checking the single table-level intent lock instead of scanning every row to see if any is locked. Intent locks make multi-granularity locking efficient — you check coarse before going fine.

**Predicate locks** lock a *logical condition* rather than physical rows: "all rows where `status = 'pending'`." They're the theoretically clean way to prevent **phantoms** (rows that match a query's predicate appearing or disappearing between two reads in the same transaction). But general predicate evaluation is expensive, so most engines approximate them physically.

**Gap locks** are that approximation, and the reason they exist is precisely phantom prevention. A gap lock locks the *interval between* index entries — the empty space — so that no other transaction can `INSERT` a new row into that range. InnoDB's **next-key lock** is a row lock plus the gap before it, combined. Consider:

```sql
-- under REPEATABLE READ
SELECT * FROM orders WHERE amount BETWEEN 100 AND 200 FOR UPDATE;
-- gap-locks the index range [100,200]; a concurrent
-- INSERT INTO orders(amount) VALUES (150) now blocks
```

Without the gap lock, that `INSERT` would succeed and the original transaction would see a phantom row on re-read. Gap locks are what let a lock-based engine deliver phantom-free `REPEATABLE READ` and `SERIALIZABLE`. Their downside is reduced insert concurrency and a notorious deadlock surface: two transactions can each hold a gap lock and block on each other's inserts into the same range, which is one of the most common InnoDB deadlocks in production.

---

## Indexing & Access Methods

### Summary

**What this topic covers** — Indexes are auxiliary data structures that trade write cost and storage for read speed. This topic covers the dominant access methods a database uses to find rows without scanning every page: B+trees (the workhorse of nearly every relational engine), LSM-trees (the write-optimized alternative behind Cassandra, RocksDB, and ScyllaDB), hash indexes, and the structural distinctions — clustered vs secondary, composite, covering, bitmap. It also covers the query planner's decision of *whether to use an index at all*, which hinges on selectivity and cardinality. The through-line: an index is only useful if it lets the engine touch dramatically fewer pages than a sequential scan, and the planner is constantly recomputing that bet.

**Mental model** — Think of every index as a sorted (or hashed) copy of one or more columns plus a pointer back to the row. Reads get faster because you binary-search or hash instead of scanning; writes get slower because every insert/update/delete must maintain every index that covers the touched columns. A senior engineer never reasons about indexes in isolation — they reason about *access paths*. Given a query, the planner enumerates ways to fetch rows (seq scan, index scan, index-only scan, bitmap scan), estimates the page I/O of each using table statistics, and picks the cheapest. The index exists to win that contest. The second instinct is to picture data laid out on disk in pages, because the unit of cost is page reads, not rows. A B+tree wins random point/range lookups because it converges in 3-4 page reads; a sequential scan wins when you'd touch most pages anyway, because sequential I/O is far cheaper than scattered random I/O. Everything else — column order, covering, clustering — is about shaving page touches.

**Key terms**
- **B+tree** — balanced tree where all values live in leaves, leaves are linked, internal nodes hold only separator keys.
- **Fan-out** — number of children per internal node; high fan-out keeps the tree shallow.
- **LSM-tree** — log-structured merge tree; buffers writes in memory, flushes immutable sorted runs, merges them in the background.
- **Write amplification** — bytes physically written to storage per logical byte written.
- **Read amplification** — number of storage reads needed to answer one logical read.
- **Selectivity** — fraction of rows a predicate matches; low fraction = high selectivity.
- **Cardinality** — number of distinct values in a column.
- **Covering index** — index that contains every column a query needs, so the heap/table is never visited.
- **Clustered index** — index whose leaf level *is* the table data, sorted by key.
- **Secondary index** — non-clustered index; leaves hold a pointer (rowid or PK) back to the row.
- **Bitmap index** — index storing one bitmap per distinct value, ideal for low-cardinality columns and AND/OR combination.
- **Leftmost prefix** — rule that a composite index can only be used for predicates anchored on its leading columns.

**Why interviewers ask this** — Indexing separates candidates who memorized "add an index to make it fast" from those who understand the cost model. A junior says "create an index on the column." A senior asks what the query *shape* is (point vs range vs sort vs aggregate), whether the column is selective enough to bother, whether a composite index in the right order can serve the `WHERE` *and* the `ORDER BY`, and whether a covering index can eliminate the heap fetch entirely. The strongest signal is when a candidate volunteers that an index can *hurt* — write amplification, planner mis-estimates, or a low-selectivity column where a full scan is genuinely faster. Anyone who can articulate when *not* to index, and can reason about LSM vs B+tree under a write-heavy workload, is operating at a senior level.

**Common confusions**
- **"More indexes always make the database faster."** They speed targeted reads but tax every write and consume storage and buffer cache.
- **"An index on a column guarantees it gets used."** The planner ignores indexes on low-selectivity predicates where a scan is cheaper.
- **"A composite index on `(a, b)` helps queries filtering only on `b`."** The leftmost-prefix rule means it generally can't.
- **"B+trees and LSM-trees are interchangeable."** They invert the read/write amplification tradeoff.
- **"Hash indexes are just faster B+trees."** They can't do range scans, ordering, or prefix matching.

**What follows from this topic** — Index choice is downstream of the physical storage model and upstream of the query optimizer. Understanding access methods sets up *query planning and the cost model* (how the optimizer chooses between them), *transactions and MVCC* (indexes must be versioned and vacuumed too), and *storage internals* (pages, the buffer pool, sequential vs random I/O). It also connects to *distributed data* — partitioning and global vs local secondary indexes are the distributed generalization of everything here.

### Q31. How does a B-tree / B+tree index work, and why is it the default? Explain fan-out, height, and why range scans are cheap.

A B+tree is a balanced search tree tuned for block storage. Internal nodes hold only separator keys and child pointers; *all* actual values (or value+pointer pairs) live in the leaf level, and the leaves are linked into a doubly-linked list. "Balanced" means every leaf is at the same depth, so every lookup costs the same number of page reads — the worst case equals the average case.

The reason it's the default is **fan-out**. Each node is one disk/page-sized block (say 8 KB). If a key + pointer is ~16 bytes, a single internal node holds hundreds of children — fan-out of several hundred is typical. Height is `log_fanout(N)`, so with fan-out 500, a tree over 100 million rows is only `log_500(10^8) ≈ 3` levels deep. That means **any** row is reachable in ~3-4 page reads, and the top levels stay cached in the buffer pool, so in practice it's 1-2 physical reads.

```text
            [ 50 | 200 ]              ← root (cached)
           /     |      \
   [10|30]   [80|120]   [300|400]     ← internal (mostly cached)
   /  |  \      ...
[leaves: sorted values, linked: 5→8→10→...→ ]
```

Range scans are cheap precisely because of the linked, sorted leaves. To answer `WHERE x BETWEEN 100 AND 200`, the tree descends once to find `100`, then walks the leaf chain sequentially until it passes `200` — no re-traversal from the root per row. That same ordering means a B+tree also satisfies `ORDER BY x` and `MIN/MAX` for free. This versatility — point lookups, range scans, sorts, prefix matches — with logarithmic, predictable cost is why it's the universal default while specialized structures stay opt-in.

### Q32. Contrast B-tree vs LSM-tree storage. What are the read/write amplification tradeoffs, and which workloads favor each?

They invert the amplification tradeoff. A **B+tree** updates data *in place*: to change a row you locate its leaf page and rewrite it. That's random write I/O, and because durability requires write-ahead logging, you often write the change twice (WAL + the page). Reads are excellent and predictable — a few page reads — but write-heavy workloads suffer from random I/O and page-level write amplification.

An **LSM-tree** never updates in place. Writes go to an in-memory `memtable` (backed by a WAL), and when it fills, it's flushed as an immutable sorted file (an SSTable). Background **compaction** merges these runs, discarding overwritten/deleted keys. This turns random writes into sequential writes and batches them, giving far higher write throughput. The cost is **read amplification**: a key might live in any of several overlapping runs, so a read may probe multiple SSTables (mitigated by Bloom filters and block caches). Compaction also causes background write amplification and unpredictable latency spikes.

| Dimension | B+tree (Postgres, InnoDB) | LSM-tree (RocksDB, Cassandra) |
|---|---|---|
| Write path | In-place, random I/O | Append, sequential I/O |
| Write amplification | Moderate (page + WAL) | High but background (compaction) |
| Read amplification | Low, predictable | Higher (multi-run probes, Bloom filters) |
| Range scans | Excellent | Good (merged iterators) |
| Space | Fragmentation, fill-factor slack | Better compression; transient compaction overhead |

Rule of thumb: read-heavy or read-modify-write OLTP with strict latency SLOs favors B+trees. Write-heavy, append-mostly, high-ingest workloads — time-series, event logs, metrics, write-amplification-sensitive flash — favor LSM-trees. It's no accident that ingest engines (Cassandra, Scylla, HBase) are LSM and classic transactional databases are B+tree.

### Q33. What is a hash index, and when does it beat a B-tree? What can it not do?

A hash index stores entries in buckets keyed by `hash(value)`. For an **equality** lookup it's O(1) expected: hash the key, jump to the bucket, scan a short collision chain. A B+tree is O(log N) — a few page reads. So for pure point lookups on a high-cardinality column, especially large ones like long URLs or UUIDs where comparing hashes beats comparing full keys, a hash index can be smaller and faster.

The catch is that hashing destroys order, which kills most of what makes B+trees useful. A hash index **cannot** do:

- Range queries (`WHERE x > 100`, `BETWEEN`) — buckets are scattered, not sorted.
- `ORDER BY` / `MIN` / `MAX` — no ordering to exploit.
- Prefix or `LIKE 'abc%'` matching — the hash of a prefix is unrelated to the hash of the full value.
- Leftmost-prefix use of a composite key — only the whole hashed tuple matches.

```sql
-- Hash index can serve this:
SELECT * FROM sessions WHERE token = 'abc123';
-- It is useless for this:
SELECT * FROM sessions WHERE token > 'abc' ORDER BY token;
```

In practice hash indexes are niche. Postgres added crash-safe hash indexes in v10 but the planner still leans on B+trees because the B+tree handles equality nearly as well *and* everything else. Hash structures shine more inside the engine — hash joins, hash aggregation, in-memory key-value stores — than as on-disk secondary indexes. Reach for one only when you have a hot, equality-only, high-cardinality lookup and have measured that the B+tree is the bottleneck.

### Q34. Explain composite indexes and the leftmost-prefix rule. Why does column order matter, and what is a covering index?

A composite (multi-column) index on `(a, b, c)` sorts rows by `a`, then `b` within equal `a`, then `c` within equal `(a, b)` — like a phone book sorted by last name, then first name. The **leftmost-prefix rule** follows directly: the index can serve predicates only on a *contiguous prefix starting at the leftmost column*. It serves `WHERE a = ?`, `WHERE a = ? AND b = ?`, and `WHERE a = ? AND b = ? AND c = ?`. It does **not** serve `WHERE b = ?` alone or `WHERE c = ?` alone — there's no way to seek, because rows with a given `b` are scattered across every `a`.

```text
Index (a, b):  (1,'x') (1,'z') (2,'a') (2,'m') (3,'a') ...
WHERE a=2          → seek, contiguous slice ✓
WHERE a=2 AND b>'a'→ seek + range on b      ✓
WHERE b='a'        → 'a' appears under a=2 AND a=3 ... → no seek ✗
```

Column order therefore matters enormously. Put **equality predicates before range predicates**: an index on `(status, created_at)` serves `WHERE status = 'open' AND created_at > ?` beautifully (seek to `status`, range-scan `created_at`), and the leaves are already ordered to satisfy `ORDER BY created_at`. Reverse it to `(created_at, status)` and the `status` filter can't be seeked. A common heuristic: equality columns first, then the one range/sort column, then payload.

A **covering index** includes every column the query touches — both filters and the `SELECT` list — so the engine answers entirely from the index without visiting the table (an *index-only scan*). If you frequently run `SELECT email FROM users WHERE org_id = ?`, an index on `(org_id, email)` (or `(org_id) INCLUDE (email)` in engines that support non-key payload columns) avoids the per-row heap fetch. That eliminates the random I/O described in Q36 and is one of the highest-leverage tuning moves available.

### Q35. What is selectivity / cardinality, and how does it determine whether an index is even used? When does a full scan beat an index?

**Cardinality** is the number of distinct values in a column; **selectivity** is the fraction of rows a predicate matches (lower fraction = more selective). A predicate on a unique column (`id = 42`) is maximally selective — one row. A predicate on `gender` or a boolean flag is barely selective — it matches half the table.

The planner cares because an index scan isn't free: each matching row in a secondary index typically costs a *random* page read to fetch the row from the heap (Q36). A sequential scan reads pages in order, which storage handles far faster per page. So the planner estimates rows-matched from statistics (histograms, `n_distinct`) and compares: `selective_rows × random_page_cost` vs `total_pages × seq_page_cost`. If the predicate matches a large fraction — often cited around 5-20% depending on row width and clustering — the random fetches outweigh a clean sequential scan, and **the full scan wins**. The index is correctly ignored.

```sql
-- High selectivity: index scan, a handful of random reads
SELECT * FROM orders WHERE id = 91823;
-- Low selectivity: planner picks a seq scan; the index would be slower
SELECT * FROM orders WHERE status = 'active';   -- 80% of rows
```

This is why indexing a low-cardinality column for a simple equality filter is often pointless — and why stale statistics are a classic production incident: after a bulk load, the planner's estimate is wrong, it picks a seq scan over a now-selective index (or vice versa), and a query that took 5 ms takes 5 seconds. The fix is running `ANALYZE`/refreshing statistics, not adding more indexes. The senior move is to reason about selectivity *before* creating an index: if the predicate doesn't carve the table down small, the index won't be used regardless.

### Q36. Compare clustered vs non-clustered (secondary) indexes. What is the cost of a secondary-index lookup, and what are bitmap indexes for?

A **clustered index** *is* the table: the table's rows are physically stored in the index's leaf pages, sorted by the index key. There's exactly one per table because the data can only be sorted one way. InnoDB (MySQL) always clusters on the primary key; SQL Server lets you choose. The payoff is that primary-key lookups and PK range scans are maximally efficient — the data is right there, no second hop. The cost is that secondary indexes get more expensive (below), and inserts in non-key order cause page splits/fragmentation.

A **non-clustered (secondary) index** is a separate structure: its leaves hold the indexed columns plus a pointer to the row — either a physical address (Postgres heap: `ctid`) or the primary key (InnoDB). A secondary lookup is therefore **two-phase**: traverse the secondary index to find matching keys, then for each match do a second lookup to fetch the full row.

```text
Secondary index on (email):     Clustered/heap (by PK):
[email → PK/rowid] ───────────▶ [PK → full row]
   index seek (sorted)             random read per match
```

That second hop is the cost: N matches means up to N *random* page reads into the heap or clustered index. This is exactly why covering/index-only scans (Q34) matter — they skip the second phase — and why low selectivity makes the planner abandon the index (Q35): a thousand random heap fetches lose to a sequential scan.

**Bitmap indexes** address a different regime: low-cardinality columns combined with each other. The index stores one bitmap per distinct value — bit `i` set means row `i` has that value. To evaluate `WHERE region = 'EU' AND tier = 'gold'`, the engine `AND`s two bitmaps with raw CPU bitwise ops — extremely fast and compressible. They excel in read-mostly analytic/warehouse workloads (Oracle bitmap indexes; column stores use bitmap-like structures internally). They're a poor fit for OLTP because a single-row update may require locking/rewriting whole bitmap segments, so concurrent writes contend badly. Note Postgres has no persistent bitmap index but builds *bitmap scans* on the fly to combine multiple B+tree indexes for one query — the same `AND`/`OR`-of-bitmaps idea, materialized transiently.

---

## Storage Engines & Physical Layout

### Summary

**What this topic covers** — This topic is about how a database actually stores bytes and turns them into rows: the fixed-size units of I/O (pages or blocks), the in-memory cache that holds hot pages (the buffer pool / page cache), the durability mechanism that lets the engine acknowledge a commit before flushing data files (the write-ahead log), the periodic flushing that bounds recovery work (checkpoints), and the two big choices in physical layout — how a table is organized (heap vs clustered) and how a row is laid out (row-oriented vs columnar). It is the layer beneath the query planner and the index, where performance is dictated by disk physics, not algorithms.

**Mental model** — Think of the database as a memory-mapped illusion sitting on top of slow, block-addressable storage. The disk only deals in pages (commonly 4–16 KB), so the engine never reads "a row" — it reads the page that contains the row. The buffer pool is a software-managed cache of those pages with its own eviction (clock/LRU variants) and dirty-page tracking; a query touches buffer-pool pages, never the disk directly. Mutations happen in two streams: a small sequential append to the WAL that makes the change durable, and an in-place modification of the cached data page that is flushed lazily. This separation — durable-log-now, data-file-later — is the central trick. Sequential log writes are cheap; random data-file writes are expensive, so you defer and batch them. Recovery exists to reconcile the gap between "what the log promised" and "what made it to the data files," and checkpoints exist to keep that gap bounded.

**Key terms**
- **Page / block** — fixed-size unit of storage and I/O (e.g. 8 KB in Postgres, 16 KB in InnoDB).
- **Buffer pool / page cache** — in-memory cache of pages, with eviction and dirty tracking.
- **Dirty page** — a cached page modified in memory but not yet written to the data file.
- **WAL / redo log** — append-only log of changes written before data files (write-ahead rule).
- **Undo log** — record of prior values used to roll back uncommitted changes (and for MVCC reads).
- **LSN** — log sequence number; a monotonic address into the WAL stamped on pages.
- **Checkpoint** — a known-good point that bounds how much WAL must be replayed on recovery.
- **Heap table** — unordered collection of pages; rows located by physical address (tuple ID / RID).
- **Clustered / index-organized table** — rows physically stored in the leaves of a primary-key index.
- **Tuple ID / RID** — physical address (page number + slot) identifying a row in a heap.
- **Vectorized execution** — processing a batch of column values per CPU instruction (SIMD).
- **WORM / segment** — large immutable column file in analytical/columnar stores.

**Why interviewers ask this** — This separates candidates who treat the database as a black box from those who understand why it behaves the way it does under load. A junior says "it's slow, add an index." A senior reasons about page reads, buffer-pool hit ratio, random vs sequential I/O, and write amplification. The WAL question in particular is a litmus test: if you can explain *why* a commit can return before the data file is touched, you understand durability properly and won't be surprised by `fsync` behavior, replication lag, or recovery time. Interviewers also use row-vs-columnar to check whether you can map workload shape (OLTP point writes vs OLAP scans) onto a storage decision, and heap-vs-clustered to see if you grasp the hidden cost of secondary indexes. These are the questions where invented or vague answers are immediately obvious.

**Common confusions**
- **"A commit means the data is written to the table file."** No — commit means the WAL record is durable; the data page may be flushed minutes later.
- **"Indexes make writes faster."** They speed reads but add write amplification — every index must be maintained.
- **"Columnar is just a faster row store."** It is a different layout optimized for scans/aggregations; it is usually worse for point lookups and single-row writes.
- **"A checkpoint is a backup."** It is a recovery boundary, not a copy of your data.
- **"Clustered tables are always faster."** Range scans on the key win, but a large clustered key bloats every secondary index.

**What follows from this topic** — Physical layout is the substrate for everything above it. Indexing (B-trees vs LSM-trees) is a direct consequence of page and write-path mechanics. Transactions, isolation, and MVCC build on the undo log and LSN ordering covered here. Replication and distributed durability ship the WAL across machines. Query planning costs are denominated in page reads, the unit defined here.

### Q37. Explain how data is laid out on disk: pages/blocks, the buffer pool/page cache, and why databases think in pages not rows.

Storage hardware is block-addressable, not byte-addressable. An SSD or disk hands you a block at a time, and the OS/filesystem deals in blocks too. So the database picks a fixed page size — typically 4–16 KB (Postgres 8 KB, InnoDB 16 KB, SQL Server 8 KB) — as its atomic unit of I/O. Every read pulls a whole page into memory; every write eventually flushes a whole page. Rows live *inside* pages.

A data page has structure: a header, an array of item pointers (a slot directory) at one end, and the actual row data growing in from the other end. This slotted-page layout lets rows be variable-length and lets a row be addressed by `(page number, slot number)` — its tuple ID / RID — without the address breaking when neighboring rows move within the page.

```text
+----------------------------------------------+
| header | slot0 slot1 slot2 ->   ...           |
|                          <- row2 row1 row0    |
+----------------------------------------------+
```

The buffer pool (Postgres calls it shared buffers; InnoDB the buffer pool) is an in-memory array of page-sized frames. Queries operate only on pages in the buffer pool. On a miss, the engine reads the page from disk into a frame, possibly evicting another (clock-sweep or LRU). Modified pages are marked dirty and flushed lazily — not on every write. The buffer-pool hit ratio is one of the most important health metrics: a low ratio means you are doing random disk I/O on the hot path.

Why pages and not rows? Three reasons. **Amortization** — one 8 KB read brings in many rows; fetching a single row would waste the same I/O. **Locality** — related rows on the same page come for free once it's cached. **Bookkeeping** — caching, dirty-tracking, and logging are vastly simpler at a coarse, fixed granularity than per-row. The cost is read/write amplification: to change one byte you read and eventually write the whole 8 KB page.

### Q38. Contrast row-oriented vs column-oriented storage. Why is columnar so much better for analytics (compression, vectorization)?

In a row store, all columns of a row are stored contiguously on a page. In a column store, each column is stored separately — all values of `price`, then all values of `region`, etc. — often in large immutable segments.

| | Row-oriented | Column-oriented |
|---|---|---|
| Layout | full rows contiguous | one column contiguous |
| Best for | OLTP: point reads, single-row writes | OLAP: scans, aggregations |
| `SELECT *` of one row | one page read | one read per column |
| `SUM(price)` over 1B rows | reads every column | reads only `price` |
| Writes | cheap in place | batched, append-mostly |
| Compression | modest | excellent |
| Examples | Postgres, InnoDB | ClickHouse, Redshift, Parquet, DuckDB |

Columnar wins for analytics for two compounding reasons.

**Compression.** A column holds values of one type with low cardinality and high local similarity, so it compresses dramatically — run-length encoding for sorted/repeated values, dictionary encoding for low-cardinality strings (`region` becomes small integers), delta and bit-packing for integers. 10–30x is common. Less data on disk means fewer bytes to read, and an analytical query is usually I/O-bound, so compression directly buys throughput.

**Vectorization.** Because a column is a tight array of same-typed values, the engine processes it in batches with SIMD instructions — one CPU instruction operates on many values, with no per-row interpreter overhead and predictable branch behavior. A row engine, by contrast, hops field-by-field through heterogeneous rows.

The decisive factor is the projection: `SELECT AVG(salary) FROM employees` over a billion rows touches one column in a column store and every column in a row store. The row store reads (and decompresses) data it immediately discards. That's why a dashboard query that's a full-table scan in a row store is trivial in a columnar one — and why columnar is a poor fit for `UPDATE one_row SET ...`, which now has to touch many separate column segments.

### Q39. Explain write-ahead logging (WAL): the write path, redo vs undo logs, and how WAL enables both durability and crash recovery.

The write-ahead rule: **before you modify a data page in a way that must survive a crash, you first write a log record describing that change, and that log record must be durable on disk before the commit returns.** WAL = log-before-data.

The write path on a transaction:

```text
1. modify page in buffer pool (in memory) -> page is now dirty
2. append redo/undo record to the WAL buffer, stamped with an LSN
3. on COMMIT: flush WAL up to this LSN, fsync -> commit returns
4. LATER (checkpoint/eviction): dirty data page flushed to data file
```

The crucial insight: at step 3 the *data file is untouched*. The commit is durable because the *log* is durable. Sequential, batched appends to one log file are far cheaper than scattered random writes to data files, so this is both a correctness mechanism and the central performance optimization. It also enables group commit — many transactions' WAL records flushed in one `fsync`.

**Redo vs undo.** A redo record says "this change was made" (the new value / how to reapply it); it lets recovery re-do committed work that hadn't reached the data file. An undo record says "the previous value was X"; it lets recovery (and live rollback) un-do uncommitted work that *had* leaked to the data file. Engines differ: Postgres's WAL is redo-only and uses MVCC tuple versions + a separate mechanism for rollback; InnoDB keeps a redo log plus undo logs (the undo logs also serve MVCC consistent reads). Either way, redo handles "committed but not yet flushed," undo handles "flushed but not committed."

How it gives both guarantees: **durability** — a committed transaction's effects are reconstructable from the log even though its data pages weren't flushed, because the log was `fsync`ed at commit. **Crash recovery / atomicity** — on restart, redo rolls the data files forward to include all committed changes, and undo rolls back any partial changes from in-flight transactions, restoring a consistent, all-or-nothing state. WAL is also the natural unit of physical replication: ship the log to a replica and replay it.

### Q40. What is a checkpoint, and why is it needed? What is the tradeoff between checkpoint frequency and recovery time?

A checkpoint is a point in the WAL at which the engine guarantees that all dirty pages modified *before* that point have been flushed to the data files. It writes a checkpoint record recording the LSN, and recovery never has to replay WAL older than the last successful checkpoint.

Why it's needed: without checkpoints the WAL grows forever and recovery would have to replay the *entire* log from the beginning of time. The data files would lag arbitrarily far behind the log, so the redo phase could take hours. A checkpoint bounds two things at once — how much WAL must be retained, and how far back recovery must start.

The mechanism is usually incremental, not a stop-the-world flush: a background writer continuously trickles dirty pages to disk and the checkpoint spreads its work over an interval to avoid an I/O spike that would stall foreground transactions (a "checkpoint storm").

The core tradeoff:

| | Frequent checkpoints | Infrequent checkpoints |
|---|---|---|
| Recovery time | short (little WAL to replay) | long (lots of WAL to replay) |
| Steady-state I/O | high (pages flushed often, low write batching) | low (writes coalesced, fewer flushes) |
| WAL retained | small | large |

So it's recovery speed vs runtime throughput. Flush dirty pages aggressively and a crash recovers in seconds, but you pay continuous write amplification and lose the benefit of letting a hot page accumulate many changes before one flush. Flush rarely and steady-state I/O is efficient and batched, but a crash means replaying a long WAL tail. Real systems expose this as tunables (Postgres `checkpoint_timeout` / `max_wal_size`; InnoDB the redo-log size and flush settings). The right setting follows your RTO: if you must recover in under N seconds, you cap how much WAL can accumulate between checkpoints.

### Q41. Heap-organized vs index-organized (clustered) tables: what changes about inserts, lookups, and secondary indexes?

A **heap** stores rows in no particular order — wherever there's free space on some page. The primary key, if any, is just another B-tree index whose leaves point at heap tuples by physical address (RID/tuple ID). This is Postgres's model and Oracle's default. An **index-organized / clustered** table stores the rows themselves *in the leaves of the primary-key B-tree*, sorted by key. This is InnoDB's only model and SQL Server's default with a clustered index.

The difference cascades through three operations:

**Inserts.** Heap inserts are cheap and append-friendly: drop the row on any page with room, no ordering to maintain. Clustered inserts must place the row at its sorted position; sequential keys (auto-increment) append cleanly, but random keys (UUIDv4) cause page splits and fragmentation across the whole tree — a classic InnoDB anti-pattern. Prefer monotonic keys for clustered tables.

**Lookups.** A primary-key lookup in a clustered table finds the row *in the index leaf itself* — one B-tree traversal, no extra fetch. A heap PK lookup traverses the index to get the RID, then does a second read to fetch the heap tuple. So clustered tables win point and especially **range** scans on the primary key (rows are physically contiguous and sorted), which is their headline advantage.

**Secondary indexes** — the subtle, important part:

```text
HEAP secondary index leaf:    [secondary_key] -> RID (physical address)
CLUSTERED secondary index:    [secondary_key] -> PRIMARY KEY value
```

In a heap, a secondary index points straight at the physical row. In a clustered table, the secondary index can't store a physical address — the row moves when the tree reorganizes — so it stores the *primary key*, and a secondary lookup does two B-tree traversals: secondary index → PK value, then PK index → row. This also means a **fat primary key bloats every secondary index** (each entry carries the full PK), which is why a wide or string clustered key is costly. The heap's tradeoff is the opposite: secondary indexes are lean, but moving a row (or the HOT/visibility machinery) must keep RIDs valid, and you always pay the extra heap fetch on lookups.

### Q42. How does crash recovery work (e.g. ARIES: analysis, redo, undo)? What guarantees does it restore?

After a crash, the data files are in an arbitrary, inconsistent state: some committed changes never reached disk, and some uncommitted changes did (because dirty pages get evicted regardless of commit status — the "steal/no-force" policy). Recovery's job is to reconcile the data files with the WAL. ARIES is the canonical algorithm and runs three passes.

**Analysis.** Start from the last checkpoint and scan forward through the WAL to reconstruct two things: the set of transactions in flight at crash time (the transaction table) and the set of dirty pages with the earliest LSN that dirtied each (the dirty-page table). This computes where redo must begin and which transactions must be undone.

**Redo.** Replay the WAL forward from the oldest unflushed change, reapplying *every* logged change — committed or not — to bring the data pages back to the exact state they were in at the moment of the crash. Each page stores the LSN of the last change applied to it, so redo skips records whose LSN is already reflected on the page (idempotent replay). This is "repeating history": first restore the crash-time state exactly, *then* clean up.

**Undo.** Now roll back the changes of all transactions that were in flight (uncommitted) at crash time, using the undo information, walking each loser transaction's records backward. Undo actions are themselves logged as compensation log records (CLRs), so if the system crashes *during* recovery, the next recovery doesn't undo the same work twice — recovery is restartable and idempotent.

What it restores: **atomicity** — every transaction is either fully present or fully absent; no partial effects survive. **Durability** — every committed transaction's effects are present, reconstructed from the log even if their data pages were never flushed. Together these re-establish a transaction-consistent state equivalent to "all committed work applied, all uncommitted work erased." Note it restores ACID-Consistency only in the sense of valid post-state per the constraints the engine enforces; it does not invent application-level invariants. ARIES's design principles — write-ahead logging, repeating history then undoing losers, and logging undos via CLRs — are why a database can crash mid-transaction and come back clean.

---

## Query Processing & Optimization

### Summary

**What this topic covers** — This topic is about how a relational database turns a declarative SQL string into an efficient sequence of physical operations and the data it actually returns. SQL says *what* you want, not *how* to get it; the gap between those two is bridged by the query processor. We cover the four classic stages (parse, rewrite, plan/optimize, execute), the physical operators the engine chooses between (join algorithms, scan methods, aggregation strategies), and the cost-based optimizer that picks among them using statistics. We also cover cardinality estimation — the single most important and most fragile input to the whole process — and how to read an execution plan to diagnose why a query is slow.

**Mental model** — Carry this picture: the query is a *logical intent*, and the optimizer's job is to find the cheapest *physical execution tree* that produces the same rows. There are usually thousands of equivalent trees (different join orders, join algorithms, access paths), and the optimizer can't enumerate all of them, so it uses dynamic programming or heuristics plus a cost model to prune. The cost model is fed by statistics — row counts, distinct values, histograms — collected by a background `ANALYZE`. Crucially, the optimizer is *estimating*: every cost is a guess derived from those statistics, and errors compound multiplicatively up the join tree. A senior engineer treats the plan as the source of truth and the SQL as merely a request; when a query is slow, you don't stare at the SQL, you read the plan, find where actual rows diverge from estimated rows, and fix the statistics or the access path. The optimizer is a probabilistic search, not an oracle.

**Key terms**
- **Logical plan** — a tree of relational operators (joins, filters, projections) independent of how they're executed.
- **Physical plan** — the chosen concrete operators (`Hash Join`, `Index Scan`) with a cost and ordering.
- **Access path** — how a table's rows are fetched: sequential/full scan, index scan, index-only scan, bitmap scan.
- **Cost model** — a formula converting estimated I/O and CPU work into an abstract cost number for comparison.
- **Cardinality** — the estimated number of rows flowing out of an operator.
- **Selectivity** — the fraction of rows a predicate passes (0.0–1.0); cardinality = input rows × selectivity.
- **Statistics** — collected metadata: row counts, `n_distinct`, null fraction, most-common values, histograms.
- **Histogram** — a summary of a column's value distribution in buckets, used to estimate range predicate selectivity.
- **Selectivity estimation** — deriving a predicate's selectivity from statistics.
- **Plan cache / prepared statement** — a reused plan to avoid re-optimizing identical query shapes.
- **EXPLAIN / EXPLAIN ANALYZE** — shows the estimated plan / runs it and shows actual rows and timing.

**Why interviewers ask this** — Query optimization separates engineers who write SQL from engineers who understand databases. A junior says "add an index" reflexively; a senior asks "what does the plan say, and is the row estimate even right?" The signal interviewers want: can you reason about *why* the engine chose a plan, predict when a plan will degrade (data growth, skew, stale stats, parameter sniffing), and read `EXPLAIN ANALYZE` to find the actual bottleneck rather than guessing? Strong candidates distinguish the optimizer's *decision* from the *outcome*, know that a nested loop is great for 10 rows and catastrophic for 10 million, and understand that the most common production incident isn't a missing index but a bad cardinality estimate causing the planner to pick a nested loop where it should have hashed. This is also a proxy for whether you can debug a slow query under pressure.

**Common confusions**
- **"The optimizer always picks the best plan."** It picks the cheapest plan *according to its estimates*; wrong estimates yield bad plans.
- **"A sequential scan is always bad."** For a table that's small or where you read most rows, a seq scan beats random index lookups.
- **"More indexes always make queries faster."** Indexes slow writes and can lead the planner astray; an index only helps if it's selective and the planner trusts it.
- **"Cost is in milliseconds."** Cost is an abstract unit for comparing plans, not a time prediction.
- **"Rewriting the SQL changes the result, so it changes the plan."** Optimizer rewrites produce *equivalent* results; the plan changes, the answer doesn't.

**What follows from this topic** — Optimization sits on top of *indexing and storage* (B-trees, heaps, clustering determine which access paths exist) and feeds into *concurrency* (the plan determines lock footprint and isolation behavior). Cardinality estimation connects to *data distribution and skew*, and plan caching connects to *prepared statements and parameter sniffing*. Understanding the cost model is prerequisite to reasoning about *partitioning*, *materialized views*, and *distributed query planning*, where the same principles apply but network cost dominates.

### Q43. Walk through the lifecycle of a query: parse, rewrite, plan/optimize, execute. What does each stage produce?

A query flows through four stages, each consuming the previous stage's output and producing a richer representation.

**Parse** takes the raw SQL string and produces an abstract syntax tree (AST). This stage checks *syntax only* — is this valid SQL? It also does basic semantic analysis: do the referenced tables and columns exist, are types compatible, do you have permission? The output is a parse tree where `SELECT name FROM users WHERE id = 5` becomes a structured tree of clauses. A syntax error or unknown column fails here, before any planning.

**Rewrite** transforms the parse tree into a canonical logical form and applies *rule-based* (cost-independent) transformations. View definitions are inlined, `CHECK` constraints and row-level security predicates are injected, and some normalization happens. In Postgres this is the rule system; in most engines it's where views become their underlying queries. The output is still a logical query tree, but expanded and normalized.

**Plan/optimize** is the interesting stage. The optimizer takes the logical tree and searches the space of equivalent *physical* plans — different join orders, join algorithms, and access paths — costing each using table statistics, and picks the cheapest. This is where `Hash Join` vs `Nested Loop`, `Seq Scan` vs `Index Scan` is decided. The output is a physical execution plan: a tree of concrete operators annotated with estimated costs and row counts. This is what `EXPLAIN` shows you.

**Execute** runs the physical plan. Most engines use the Volcano/iterator model: each operator exposes `next()` and pulls rows from its children, so execution is pipelined and rows stream up the tree without materializing everything. Some modern engines (DuckDB, vectorized Postgres extensions) process batches of rows or compile the plan to machine code for speed. The output is the result set streamed to the client.

The practical takeaway: errors in `WHERE` column names die at parse; bad performance is almost always born in plan/optimize and only *observed* at execute.

### Q44. Explain the three main join algorithms (nested-loop, hash join, merge join). When does the optimizer pick each?

| Algorithm | How it works | Best when | Cost shape |
|---|---|---|---|
| **Nested loop** | For each outer row, probe the inner relation (ideally via index) | Outer side is tiny; inner has a selective index | O(outer × inner), or O(outer × log inner) with index |
| **Hash join** | Build a hash table on the smaller side, probe with the larger | Large unsorted inputs, equality join, no useful index | O(outer + inner), needs memory for the hash table |
| **Merge join** | Sort both inputs on the join key, then merge in lockstep | Inputs already sorted (e.g. index order), or large + sortable | O(n log n) if sorting needed, O(n) if pre-sorted |

**Nested loop** is the only one that handles non-equality joins (`<`, `BETWEEN`, range). It's brilliant when the outer side returns a handful of rows and the inner side has an index on the join key — each probe is an index lookup. It is catastrophic when the optimizer *thinks* the outer side is 5 rows but it's actually 5 million; that's the classic "nested loop blowup" you'll see in incidents.

**Hash join** is the workhorse for analytical and large OLTP joins. It builds an in-memory hash table on the build side (the optimizer wants this to be the smaller input), then streams the probe side through it. It only works for equi-joins. The risk: if the hash table doesn't fit in `work_mem`/memory budget, it spills to disk in batches, which is much slower — a common cause of a join that's "fine in dev, slow in prod" when data grows.

**Merge join** shines when both inputs arrive already sorted on the join key — for example, both sides scanned via an index in key order, so no sort is needed. It's also chosen for very large joins where a hash table won't fit but sorting is acceptable. If the optimizer must add explicit sorts, the `Sort` cost often makes hash join win instead.

The optimizer's choice is purely cost-driven and hinges on cardinality estimates: get the row count of the outer side wrong and it'll pick a nested loop where a hash join would have been orders of magnitude faster.

### Q45. What is a cost-based optimizer, and what inputs does it use? How do table statistics and histograms drive plan choice?

A cost-based optimizer (CBO) enumerates candidate physical plans, assigns each an abstract *cost*, and picks the minimum. Contrast with a rule-based optimizer, which applies fixed heuristics ("always use an index if one exists") regardless of data — those are largely obsolete because they make terrible choices on skewed or atypical data. Every serious engine today (Postgres, InnoDB, Oracle, SQL Server) is cost-based.

The cost model combines estimated **I/O** (sequential page reads, random page reads — random is far more expensive) and **CPU** (per-row and per-operator processing). Postgres exposes these as tunable constants: `seq_page_cost = 1.0`, `random_page_cost = 4.0`, `cpu_tuple_cost`, etc. The optimizer computes, say, "this index scan touches an estimated 200 random pages = 800 cost units" versus "this seq scan reads 10,000 sequential pages = 10,000 cost units" and chooses accordingly. Cost is a *unitless comparison number*, not a millisecond prediction — a frequent misconception.

The inputs that make or break those estimates are **statistics**, gathered by `ANALYZE` (often auto-triggered). Key statistics per column:

- **Row count / table size** — sets the base cardinality.
- **`n_distinct`** — number of distinct values, drives equality selectivity: for a unique-ish column, `col = ?` selects ~`1/n_distinct` of rows.
- **Most-common values (MCV) list** — exact frequencies for the top values, so `status = 'active'` (90% of rows) isn't estimated as uniform.
- **Histogram** — buckets dividing the remaining values into equal-frequency ranges, used for range predicates like `created_at > '2026-01-01'`.
- **Null fraction** and **correlation** (physical ordering vs logical order, which affects index scan cost).

Here's the concrete chain: for `WHERE created_at > X`, the optimizer finds X in the histogram, estimates the fraction of buckets above it (selectivity), multiplies by row count to get cardinality, and that cardinality decides whether an index scan or seq scan is cheaper and which join algorithm to use upstream. **Stale or missing statistics** are the number-one cause of bad plans: after a bulk load, the optimizer may still think the table has 1,000 rows when it has 10 million, and pick a nested loop that never finishes. The fix is almost always `ANALYZE`, not a query rewrite.

### Q46. What is cardinality estimation, why is it hard, and what happens when the estimate is badly wrong?

Cardinality estimation is predicting how many rows flow out of each operator *before* running the query. It's the foundation of cost-based optimization: every cost calculation and every join-algorithm choice depends on it. Get the row counts right and the plan is usually good; get them wrong and everything downstream is wrong.

It's hard for several reasons. **Correlated predicates**: the optimizer typically assumes columns are independent, so `WHERE country = 'UK' AND city = 'London'` is estimated as `sel(country) × sel(city)` — but those are correlated (everyone in London is in the UK), so the real cardinality is far higher than the product. **Join estimation compounds error multiplicatively**: a 2× error on each of four joins becomes a 16× error at the top of the tree. **Skew**: histograms assume reasonable distributions, but a single hot value (`user_id = <whale account>` with 40% of rows) breaks uniform assumptions unless it's in the MCV list. **Expressions and functions**: `WHERE lower(email) = ?` or `WHERE date_trunc('day', ts) = ?` defeat column statistics entirely — the optimizer falls back to a hardcoded guess (often 0.5% or 33%).

When the estimate is badly wrong, the symptom is a plan that's correct but pathologically slow:

```text
Nested Loop  (estimated rows=5, ACTUAL rows=4,200,000)
  ->  Index Scan on orders  (rows=5)        <- estimate said tiny
  ->  Index Scan on line_items  (per loop)  <- now run 4.2M times
```

The optimizer picked a nested loop because it believed the outer side was 5 rows; it was actually millions, so the inner index lookup runs millions of times instead of one hash build. This is *the* canonical production database incident.

Fixes, in order of preference: run `ANALYZE` to refresh stats; create **extended/multi-column statistics** so the engine knows `country` and `city` are correlated; rewrite the predicate to be sargable so column stats apply (avoid wrapping the column in a function); and as a last resort, add planner hints or `pg_hint_plan`-style overrides. The senior move is to read `EXPLAIN ANALYZE`, compare estimated vs actual rows on every node, and attack the node where they first diverge.

### Q47. How do you read an execution plan? What are the red flags (unexpected seq scans, nested loops over large sets, bad row estimates)?

Read a plan as a tree, **bottom-up and inside-out**: the most indented nodes execute first and feed their parents. Each node shows an operator, an estimated cost range (`cost=0.00..431.00`), and an estimated row count. The golden tool is `EXPLAIN ANALYZE`, which *runs* the query and adds **actual** rows and timing, plus loop counts. Without `ANALYZE` you're reading the optimizer's guesses; with it you're reading reality.

The single most valuable habit: **compare estimated rows vs actual rows on every node.** A node showing `rows=10` estimated but `actual rows=500000` is the root cause of a bad plan — the optimizer made every decision above it based on a number that was off by 50,000×. Find the lowest node where estimate and actual diverge; that's where to fix statistics or rewrite.

Concrete red flags:

- **Nested loop with a large outer side** (`loops=2,000,000` on the inner node). Fine for tens of rows, fatal for millions. Almost always a cardinality underestimate on the outer relation.
- **Unexpected `Seq Scan` on a large table** with a selective filter. Either the index is missing, the predicate isn't sargable (`WHERE lower(name)=...`), or the stats are stale so the planner thinks the scan is cheap. (Note: a seq scan is *correct* when you're reading most of the table.)
- **A `Sort` or `Hash` node reporting disk spill** (`Sort Method: external merge Disk: 250MB`). Means the operation exceeded the memory budget — raise `work_mem` for that query or reduce the row volume upstream.
- **Big gap between estimated and actual rows** anywhere — the diagnostic above.
- **`Rows Removed by Filter`** much larger than rows returned — you fetched a lot and threw most away; an index or better predicate could push the filter down.

```text
EXPLAIN ANALYZE output (read inner-out):
Hash Join  (actual rows=12000 loops=1)
  ->  Seq Scan on orders  (actual rows=2,000,000)   <- RED FLAG: full scan
        Filter: (status = 'pending')
        Rows Removed by Filter: 1,988,000            <- threw away 99%
  ->  Hash  (actual rows=50)
```

That `Seq Scan` reading 2M rows to keep 12K screams "missing index on `status`" — or a partial index `WHERE status='pending'`.

### Q48. What query rewrites/transformations can the optimizer apply (predicate pushdown, join reordering, subquery flattening)?

The optimizer applies semantics-preserving transformations to produce a cheaper-but-equivalent plan. These split into rule-based rewrites (always beneficial, applied unconditionally) and cost-based transformations (the optimizer evaluates alternatives).

**Predicate pushdown** moves filters as close to the data source as possible, so rows are discarded before expensive operations. Filtering before a join means the join processes fewer rows; pushing a predicate through a view or subquery means the base table scan filters early. In distributed/columnar systems this extends to pushing predicates into the storage layer or remote node so less data crosses the network — the dominant cost there.

**Join reordering** is the heart of the optimizer. Joins are associative and commutative for inner joins, so `(A ⋈ B) ⋈ C` and `A ⋈ (B ⋈ C)` return the same rows but can differ in cost by orders of magnitude — you want the join that produces the *fewest intermediate rows* to run first. With N tables there are factorially many orderings; optimizers use dynamic programming (System R style) up to a threshold, then switch to greedy heuristics (Postgres's `geqo` genetic algorithm for large joins). Outer joins constrain reordering because they're not freely commutative.

**Subquery flattening (decorrelation)** converts a correlated subquery into a join, which the optimizer can then reorder and hash. A correlated `EXISTS`/`IN` that conceptually runs once per outer row:

```sql
-- Before: correlated subquery, conceptually N executions
SELECT * FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.cust_id = c.id);

-- After (optimizer-internal): a semi-join, run once
SELECT c.* FROM customers c
SEMI JOIN orders o ON o.cust_id = c.id;
```

The flattened version becomes a single hash semi-join instead of millions of subquery evaluations.

Other common rewrites: **constant folding** (`WHERE x = 2 + 3` → `x = 5`), **predicate simplification / transitive closure** (`a = b AND b = 5` ⇒ `a = 5`, opening an index on `a`), **projection pruning** (drop unused columns early to narrow rows), **`IN`-to-semi-join** and **`OR`-to-`UNION`** rewrites, and **view/CTE inlining** (modern Postgres inlines non-recursive CTEs rather than materializing them, removing the old "CTE optimization fence"). The practical lesson: you rarely need to hand-tune join order or manually flatten subqueries — but you do need to write **sargable, well-typed predicates** so the optimizer's rewrites can fire.

---

## CAP, PACELC & Tradeoffs

### Summary

**What this topic covers** — This topic is about the fundamental, unavoidable tradeoffs a distributed data system makes when nodes must coordinate over an unreliable network. It covers the CAP theorem (consistency, availability, partition tolerance), its precise statement and frequent misreadings, and PACELC, which extends CAP to describe behavior in the common case when there is no partition. The throughline: in a distributed system you cannot have everything, and a senior engineer reasons about *which* guarantee gets sacrificed *when*, and what that means for the application sitting on top.

**Mental model** — Think of CAP not as a menu where you "pick two," but as a conditional: *when a partition happens*, you are forced to choose between serving possibly-stale (or no-longer-consistent) data and refusing to serve at all. Partitions are not a configuration choice — they are something the network does to you. So the real choice during a partition is C vs A; P is the precondition, not an option. PACELC then says the tradeoff doesn't disappear when the network is healthy: *else* (E), you trade latency (L) against consistency (C), because keeping replicas in sync synchronously costs round-trips. A useful image: every write either waits for a quorum/leader acknowledgment (more consistent, slower, and unavailable if it can't reach peers) or returns after a local write (faster, available, but replicas can diverge). The system's "personality" is defined by where it sits on both the partition-time C/A axis and the normal-time L/C axis.

**Key terms** —
- **Consistency (CAP-C)** — every read sees the most recent write; formally **linearizability** (a single, real-time-ordered view of the data).
- **Availability (CAP-A)** — every request to a non-failed node gets a non-error response (no guarantee it's fresh).
- **Partition tolerance (P)** — the system keeps operating despite arbitrary message loss between nodes.
- **Partition** — a network split where some nodes cannot reach others, but each side may still be up.
- **PACELC** — *if Partition then A-vs-C, Else then L-vs-C*; CAP plus the no-partition case.
- **Linearizability** — single-object real-time consistency; the strongest single-key guarantee.
- **Serializability** — transactions appear to run in some serial order (a multi-object, transaction-isolation property — *not* CAP-C).
- **Quorum** — a majority (or configured `R`/`W`) of replicas that must acknowledge an operation.
- **Eventual consistency** — replicas converge if writes stop; reads may be stale meanwhile.
- **Tunable consistency** — per-request control of how many replicas must respond (e.g. Cassandra `R`+`W`).
- **Split-brain** — both sides of a partition accept writes and diverge; the failure AP risks.

**Why interviewers ask this** — CAP is the single most-misquoted result in distributed systems, so it's a fast filter. A junior recites "consistency, availability, partition tolerance, pick two" and stops. A senior corrects the framing: P isn't optional, so the live tradeoff is C vs A *during a partition*, and most of the time there's no partition at all — which is why PACELC matters more in practice. The strong signal is connecting the theorem to product decisions: "a payment ledger must reject writes it can't confirm; a shopping cart should accept them and reconcile later." Interviewers also probe whether you conflate CAP-C (linearizability) with ACID-C (no integrity-constraint violation) or with serializability — getting those straight separates people who've read the words from people who've operated the systems.

**Common confusions** —
- **"You pick two of three."** — You don't choose P; the network imposes it. You choose C or A, and only while partitioned.
- **"CAP-C and ACID-C are the same C."** — No. ACID-C is "transactions preserve invariants"; CAP-C is linearizability. Unrelated.
- **"AP systems have no consistency."** — They give up *strong* consistency, not all of it; eventual or causal consistency still applies.
- **"CP systems are always unavailable."** — Only during partitions, and often only the minority side; the majority can keep serving.
- **"Linearizability equals serializability."** — Linearizability is single-object + real-time; serializability is multi-object transaction ordering. Spanner gives both (strict serializability).

**What follows from this topic** — Once you accept the C-vs-A and L-vs-C tradeoffs, the next questions are *how* systems implement each side: consensus protocols (Raft, Paxos) for the CP path, quorum reads/writes and anti-entropy for the AP path, and the consistency-model hierarchy (linearizable → causal → eventual) that names the middle ground. It also feeds directly into replication strategy, leader election, and how transaction isolation (a separate axis from CAP) composes with cross-node consistency.

### Q49. State the CAP theorem precisely. What do C, A, and P actually mean, and why is "pick two" a misleading summary?

The precise statement (Gilbert and Lynch's formalization of Brewer's conjecture): a distributed system *cannot simultaneously guarantee* linearizable **consistency** and **availability** *in the presence of network partitions*. That's it. It's a claim about what's impossible during a partition, not a general menu.

The three properties:

- **C (Consistency)** — **linearizability**: there's a single, total order of operations consistent with real time, so every read returns the value of the most recent completed write. It looks like there's one copy of the data even though there are many.
- **A (Availability)** — every request hitting a *non-crashed* node receives a non-error response. Crucially, "available" says nothing about freshness — a stale answer still counts as available.
- **P (Partition tolerance)** — the system continues to function even when the network arbitrarily drops or delays messages between nodes.

"Pick two" is misleading for two reasons. First, it implies the three are symmetric, freely-tradeable choices. They aren't: C and A are *guarantees you provide*, while P is a *fault the environment inflicts on you*. You don't get to "not pick" partitions any more than you get to not pick gravity.

Second, the tradeoff is *conditional and intermittent*. The theorem only bites *during a partition*. When the network is healthy — which is most of the time — a system can be both consistent and available. So "CA" isn't really a coherent category for a distributed system; it just means "a system that assumes partitions never happen," i.e. a single node or a system that will misbehave the moment the network splits. The honest framing is: **assuming P, choose C or A when a partition occurs.**

### Q50. Why is partition tolerance not really optional in a distributed system, and what does that mean for the real choice?

Because partitions are a property of the network, not of your software. Any time data lives on more than one machine connected by a network, that network *will* eventually drop packets, blackhole a switch, GC-pause a node into unresponsiveness, or sever a cross-AZ link. You cannot buy a network that never partitions; you can only buy one that partitions less often. So "not tolerating partitions" doesn't mean partitions won't happen — it means your system has no defined, correct behavior when they do.

That reframes CAP entirely. P is the *premise*, and the actual decision is what to do when a partition strikes:

```text
Partition splits replicas A | B (each side still up, can't talk)
Client writes to side A.

CP choice: side A (or the minority) refuses/blocks the write
           → consistency preserved, availability sacrificed
AP choice: side A accepts the write locally
           → availability preserved, consistency sacrificed (A and B diverge)
```

So the real-world choice is binary and situational: **during a partition, do you sacrifice consistency or availability?** A "CA system" in the strict sense only exists as a single node — once you replicate, you've signed up for P whether you acknowledge it or not.

The operational lesson: design your partition behavior *deliberately*. A system that hasn't decided will choose for you, usually badly — e.g. split-brain where both sides accept conflicting writes and you discover the divergence days later in a reconciliation report. Knowing you're "CP" tells operators "expect rejected writes / failovers during a netsplit"; knowing you're "AP" tells them "expect to resolve conflicts afterward."

### Q51. Explain PACELC and why it is a more useful framing than CAP. Give an example of an EL-vs-EC tradeoff.

PACELC (Abadi) extends CAP by addressing its biggest blind spot: CAP only describes behavior *during a partition*, but partitions are rare. PACELC reads: **if Partition (P), trade Availability (A) vs Consistency (C); Else (E), trade Latency (L) vs Consistency (C).** It captures the tradeoff that's live 99.9% of the time, when the network is fine.

The "else" branch is the insight. Even with no partition, keeping replicas strongly consistent costs synchronous coordination — a write must reach a leader or a quorum before it's acknowledged, adding round-trips and tail latency. If you relax consistency, you can acknowledge writes locally and replicate in the background, which is faster but exposes stale reads. So normal-operation latency and consistency trade against each other for the same physical reason availability and consistency do under partition: synchronization costs round-trips.

A classic **EL-vs-EC** example is a quorum store like Cassandra or DynamoDB, where consistency is tunable per request via read (`R`) and write (`W`) replica counts against a replication factor (`N`):

| Choice | Config | Behavior |
|---|---|---|
| **EC** (consistency over latency) | `R + W > N` (e.g. `N=3, W=2, R=2`) | Reads see latest write; every op waits for 2 replicas. Higher, more variable latency. |
| **EL** (latency over consistency) | `R + W ≤ N` (e.g. `W=1, R=1`) | Ack after one replica; very low latency, but a read may hit a replica that missed the latest write — stale. |

So the *same cluster* can be operated as EL or EC depending on the request — that's why PACELC classifies DynamoDB-style stores as **PA/EL** (default-tuned for availability and latency) even though they can be pushed toward consistency. In PACELC notation, Cassandra is often written **PA/EL**, Spanner **PC/EC** (it pays latency for consistency even when healthy), and classic single-leader Postgres replication **PC/EC** as well. CAP alone can't distinguish a system that's slow-but-consistent from one that's fast-but-stale when the network is fine — PACELC can.

### Q52. Classify some real systems as CP vs AP (and their PACELC behavior). What does each choice mean for the application?

These classifications are about *default/typical configuration* — many systems are tunable — but the canonical buckets:

| System | CAP | PACELC | Why |
|---|---|---|---|
| Google Spanner | CP | PC/EC | TrueTime + Paxos give strict serializability; pays latency for consistency even when healthy. |
| ZooKeeper / etcd (Raft) | CP | PC/EC | Consensus quorum; minority side stops serving writes to stay consistent. |
| Single-leader Postgres (sync replication) | CP | PC/EC | Leader + synchronous replica; can't commit if it can't confirm the replica. |
| Cassandra | AP | PA/EL | Leaderless quorum, tunable; defaults favor availability/low latency, replicas converge later. |
| DynamoDB | AP | PA/EL | Dynamo lineage; highly available, eventually consistent by default (strongly-consistent reads optional). |
| Riak | AP | PA/EL | Quorum + conflict resolution (vector clocks / CRDTs). |
| MongoDB (default majority) | CP-leaning | PC/EC | Primary-based with majority write concern; failover causes brief unavailability. |

What it means for the application:

A **CP** store tells the application "I will never lie to you, but I may say *no*." During a partition or leader failover, writes (and linearizable reads) on the cut-off side fail or block until a new leader is elected. That's exactly what you want for anything where divergence is unacceptable — financial ledgers, inventory decrements that mustn't oversell, distributed locks, configuration/leader-election (`etcd`). The application must handle write errors and retries, and accept that some requests fail during faults.

An **AP** store tells the application "I will always answer, but the answer may be stale or may need reconciling." During a partition both sides keep accepting writes; afterward they converge via last-write-wins, vector clocks, or CRDTs. That's right for shopping carts (Amazon's original Dynamo use case), social feeds, telemetry, session stores, "likes" counters — high write availability matters more than a momentarily-correct read, and conflicts are tolerable or mergeable. The cost lands on the application: it must be written to expect stale reads and design conflict resolution (idempotent operations, commutative merges) rather than assume a single truth.

### Q53. During a network partition, what does a CP system do vs an AP system, from the client's perspective?

Picture a 3-node cluster partitioned into a majority side (2 nodes) and a minority side (1 node), with clients talking to both.

**CP system** — it preserves a single consistent truth by *refusing to diverge*. The majority side, holding quorum, can elect/keep a leader and continue serving consistent reads and writes. The minority side cannot reach quorum, so it stops accepting writes (and stops serving linearizable reads) — clients there get errors or timeouts until the partition heals or they reconnect to the majority. From the client's view: **some requests fail or hang, but no request returns wrong data.** Concretely, a client of `etcd` on the wrong side of a split gets failed writes; a Spanner client may see increased latency or `UNAVAILABLE` rather than a stale value.

```text
Majority side (2 nodes): leader present → reads/writes succeed (consistent)
Minority side (1 node):  no quorum      → writes rejected, client sees errors
Healed:                  one truth, no reconciliation needed
```

**AP system** — it preserves availability by *letting both sides proceed independently*. Every reachable node answers. Clients on both sides successfully read and write — but they may see different values for the same key, and writes on each side accumulate without the other side knowing. From the client's view: **every request succeeds, but reads can be stale and concurrent writes can conflict.** When the partition heals, the system reconciles divergence using its conflict-resolution policy (last-write-wins by timestamp, vector-clock sibling resolution, or CRDT merge). The danger is silent split-brain: two clients increment the same counter on opposite sides, both succeed, and naive last-write-wins quietly drops one increment.

```text
Side X: write key=5 → ack          Side Y: write key=9 → ack
(both clients think they succeeded; values diverge)
Healed: conflict resolution runs → LWW keeps one, or CRDT/vector clock merges both
```

The summary a senior gives: under partition, **CP trades "yes" for "correct" — it would rather error than diverge; AP trades "correct" for "yes" — it would rather diverge than error.** Which is acceptable depends entirely on whether your domain can reconcile after the fact or must never be wrong in the moment.

---

## Replication

### Summary

**What this topic covers** — Replication is keeping copies of the same data on multiple nodes, for three overlapping reasons: durability and availability (survive a node loss), read scalability (serve reads from many machines), and latency (keep a copy near the user). This topic covers the three replication topologies — single-leader, multi-leader, and leaderless/quorum — and the consistency anomalies each one produces: stale reads, read-your-writes violations, non-monotonic reads, and write conflicts. It also covers failover and the split-brain problem that failover introduces.

**Mental model** — Replication is fundamentally about *when* and *how* a write propagates to copies, and the whole design space falls out of two questions: who is allowed to accept a write, and does the system wait for the copy to acknowledge before telling the client "done." Single-leader makes one node the serialization point so there are no write conflicts, at the cost of that node being a write bottleneck and a failover liability. Multi-leader and leaderless relax "one serialization point" to get write availability or geo-locality, and pay for it with conflict resolution. The async-vs-sync axis is orthogonal: it decides whether you trade durability for latency. A senior engineer treats replication lag not as a bug but as the *default state* of any asynchronously-replicated system, and designs the application to tolerate reading from a copy that is seconds behind. Crucially, replication gives you redundant copies; it does *not* by itself give you a consistent view of those copies — that requires extra protocols (quorums, consensus, fencing).

**Key terms**
- **Leader (primary)** — the replica that accepts writes and orders them.
- **Follower (replica/standby)** — a read-only copy that applies the leader's change stream.
- **Replication log** — the ordered stream of changes (statement, WAL/row, or logical) followers replay.
- **Synchronous replica** — leader waits for this replica's ack before confirming the write.
- **Asynchronous replica** — leader confirms the write without waiting; the replica catches up later.
- **Replication lag** — the time/offset by which a follower trails the leader.
- **Failover** — promoting a follower to leader after the old leader fails.
- **Split-brain** — two nodes both believing they are leader and accepting conflicting writes.
- **Quorum** — a required number of node acknowledgements (`W` for writes, `R` for reads).
- **LWW (last-write-wins)** — conflict resolution by timestamp; silently drops the loser.
- **CRDT** — a data type whose concurrent updates merge deterministically without conflict.
- **Hinted handoff** — a temporary stand-in node holds writes for an unavailable node.

**Why interviewers ask this** — Replication is where "it works on one box" collides with reality, so it separates candidates who think in terms of a single source of truth from those who think in terms of distributed copies and lag. A junior describes a primary and a replica and stops there. A strong candidate reaches for the second-order effects: that async replication means a confirmed write can be *lost* on failover, that a user can post a comment and then not see it because the read hit a lagging replica, that promoting a new leader without fencing the old one duplicates the cluster's brain. The best signal is a candidate who, unprompted, separates the *durability* question (sync vs async) from the *topology* question (who accepts writes) from the *consistency* question (what reads can observe), and who names the concrete failure mode for each choice rather than reciting definitions.

**Common confusions**
- **"Replication gives you consistency."** No — it gives you copies. Consistency across those copies needs quorums or consensus on top.
- **"Synchronous replication means the replica is always identical."** It means *acknowledged before commit*; there's still a window, and "synchronous" usually means at least one replica, not all.
- **"More replicas = more write throughput."** Replicas scale *reads*; every write still hits the leader (and sync replicas add latency).
- **"Failover is automatic and safe."** Automatic failover is the main *cause* of split-brain without fencing.
- **"Quorum reads always return the latest write."** Only with `R + W > N` *and* read repair; sloppy quorums break even that.

**What follows from this topic** — The consistency models replication exposes (read-your-writes, monotonic reads) are the practical face of the formal models in the consistency/isolation topics — linearizability is exactly what async replication fails to provide. Quorum replication leads directly into CAP and the consensus topic (Raft/Paxos), since electing a leader safely *is* consensus. Conflict resolution connects to distributed transactions and event-sourcing. And the durability tradeoff here is the same one underlying the WAL and crash-recovery discussions in storage.

### Q54. Explain leader-follower (primary-replica) replication. What is the write path, and how do reads from replicas behave?

In leader-follower replication one node is designated the **leader** (primary). All writes go to the leader, which decides the order in which changes are applied and writes them to a **replication log**. Followers connect to that log, replay the changes in the same order, and serve reads. This is the default model in Postgres, MySQL, SQL Server, and most managed RDBMS offerings.

The write path:

```text
client --write--> LEADER
                   |  1. apply locally (WAL / redo)
                   |  2. append to replication log
                   v
                 stream
                /      \
          FOLLOWER    FOLLOWER   (replay log, in order)
```

Because one node serializes every write, there are **no write conflicts** — that's the whole point of having a leader. The cost is that the leader is a write bottleneck (you can't scale writes by adding followers) and a single point of failure for writes until failover completes.

Reads from followers are **eventually consistent**. A follower applies the log with some delay (replication lag), so a read against a follower may return data that is milliseconds — or under load, seconds or minutes — behind the leader. This is the source of the read anomalies in Q56. The standard pattern is to route reads that tolerate staleness (analytics, list pages, search) to followers, and route reads that must see the latest write (the user's own just-submitted data, anything feeding a subsequent write) to the leader. Treat "read from a replica" as "read a possibly stale snapshot," and you'll design correctly.

### Q55. Synchronous vs asynchronous replication: what does each guarantee on failover, and what is the durability/latency tradeoff?

The difference is whether the leader **waits** for a replica to acknowledge before it confirms the write to the client.

| | Synchronous | Asynchronous |
|---|---|---|
| Client sees "committed" | After replica ack | After leader's local commit |
| Write latency | Leader + slowest sync replica + network round-trip | Leader's local commit only |
| Data loss on leader failure | None (a sync replica has it) | Last un-replicated writes are lost |
| Availability | Stalls if the sync replica is down | Unaffected by replica health |

**Synchronous** guarantees that on failover, a promoted replica has every acknowledged write — you can lose the leader without losing data. The price is latency (every commit pays a network round-trip) and a coupled fate: if the sync replica is slow or down, the leader blocks. Few systems make *all* replicas synchronous; that would make availability scale inversely with replica count. The common compromise is **semi-synchronous** — wait for *one* replica to ack, leave the rest async (this is Postgres `synchronous_standby_names`, MySQL semi-sync). One sync replica is enough to guarantee no data loss while keeping the blast radius small.

**Asynchronous** confirms as soon as the leader commits locally, so writes are fast and replica health never blocks the client. The risk is concrete: if the leader crashes before un-replicated writes reach a follower and you fail over, **those acknowledged writes are gone** — a transaction the client was told succeeded silently vanishes. This is the classic GitHub/MySQL post-mortem failure shape.

The senior framing: this is a pure durability-vs-latency knob, *orthogonal* to topology. Choose sync when losing an acknowledged write is unacceptable (payments, ledgers) and you can afford the latency; choose async when latency matters more than the last few milliseconds of writes and you can reconcile or accept rare loss.

### Q56. What is replication lag, and what application bugs does it cause (read-your-writes, monotonic reads)? How do you mitigate them?

**Replication lag** is the delay between a write committing on the leader and that change being visible on a follower. With async replication it's never zero, and it *spikes* exactly when you least want it to — during write bursts, long-running follower queries, or network hiccups. Lag is the normal state, not an error.

Three anomalies follow from reading lagging replicas:

- **Read-your-writes violation.** A user updates their profile (write → leader), the page reloads and reads from a lagging follower, and they see the *old* value. To the user, their save "didn't work." Fix: route reads of data the user *just wrote* to the leader, or to a replica known to have caught up to the write's position (LSN/GTID). A common heuristic: for N seconds after a user's write, read from the leader for that user.

- **Monotonic reads violation.** A user reads from follower A (lag 1s, sees a comment), then a refresh hits follower B (lag 5s, comment gone) — time appears to move *backward*. Fix: make each user always read from the *same* replica (sticky routing, e.g. hash on user id), so they never jump to a more-stale copy.

- **Consistent-prefix violation.** Replicas see writes out of causal order, so an answer appears before its question. Relevant mainly in partitioned/multi-leader systems.

The general mitigations, in order of strength: read from the leader for read-after-write-sensitive paths; pin a user to one replica for monotonic reads; or, the strongest, **wait for a replica to reach a known log position** before reading (track the write's LSN/GTID and only read from a replica that has applied it). The cleanest systemic answer is to push this into the database with a stronger consistency level rather than scattering routing logic through the app.

### Q57. Explain multi-leader replication and the write-conflict problem. What conflict-resolution strategies exist (LWW, CRDTs, app-level)?

**Multi-leader** (multi-master) replication has more than one node accepting writes, each acting as a leader and replicating its changes to the others. You use it when a single leader's location is a problem: multi-datacenter deployments where each region writes locally (low latency, survives a region partition), or offline-capable clients (a phone is effectively a leader that syncs later). Calendar apps and collaborative editors are the canonical cases.

The unavoidable cost is **write conflicts**. Because two leaders can accept writes to the same record concurrently — before either has seen the other's change — you can end up with two divergent versions and no inherent ordering between them. Single-leader sidesteps this entirely; multi-leader cannot, so conflict resolution is a *requirement*, not an add-on.

Resolution strategies:

- **Last-write-wins (LWW)** — attach a timestamp to each write, keep the highest. Simple and what Cassandra does by default, but it **silently discards** the losing write, and "highest timestamp" depends on clock sync — clock skew means you can lose the write that actually happened later. Acceptable for caches/metrics, dangerous for anything you can't afford to drop.
- **CRDTs (conflict-free replicated data types)** — data structures (counters, sets, sequences) whose concurrent updates *merge* deterministically by construction, so there's no conflict to resolve. Both edits survive. This is how modern collaborative editors and some distributed stores (Riak) handle merging. The constraint: your operations must fit a CRDT's algebra.
- **Application-level resolution** — surface both versions (siblings) and let custom logic or the user decide — e.g. a shopping cart that *unions* concurrent adds so nothing a customer added is lost (Amazon's classic Dynamo example).

The senior point: there is no free lunch. LWW loses data, CRDTs constrain your data model, app-level resolution adds complexity. Choose single-leader unless you have a concrete reason (geo-write latency, offline) to take on conflicts.

### Q58. Explain leaderless / quorum replication (Dynamo-style). Derive the R + W > N rule and what sloppy quorums/hinted handoff add.

**Leaderless** replication has no designated leader: the client (or a coordinator on its behalf) sends each write to *all* replicas and each read from *all* replicas, and relies on quorums for consistency. This is the Dynamo design — Cassandra, Riak, ScyllaDB. There's no failover because there's no leader to lose; a node being down just means fewer acks.

Let `N` be the number of replicas per key, `W` the number that must acknowledge a write, `R` the number queried on a read. The rule:

```text
R + W > N   ⇒   read and write quorums overlap
```

Derivation: if you write to `W` nodes and read from `R` nodes, the two sets are guaranteed to share **at least one** node whenever `R + W > N` (pigeonhole — they can't both fit in disjoint halves of `N`). That shared node holds the latest write, so the read sees it (the client picks the version with the highest version/timestamp). Typical config is `N=3, W=2, R=2`: tolerate one node down on either path while still overlapping. Tuning the knobs trades read vs write availability: `W=1` makes writes always succeed but reads must query more nodes; `W=N` is durable but a single node down blocks writes.

Quorum overlap guarantees you *read a node that has the latest value* — it does **not** guarantee all replicas converge. Stragglers are repaired by **read repair** (the coordinator notices stale replicas during a read and pushes the fresh value) and **anti-entropy** (a background process, often Merkle-tree based, reconciles divergence).

Two availability extensions:

- **Sloppy quorum** — if some of the *home* nodes for a key are unreachable, the coordinator accepts the write on *other* reachable nodes to still hit `W` acks. This boosts write availability but **breaks the `R + W > N` guarantee**: a subsequent read of the home nodes may not overlap with where the write actually landed.
- **Hinted handoff** — the stand-in node holds a "hint" and forwards the write to the proper home node once it recovers. It's the cleanup mechanism that makes sloppy quorums eventually consistent.

The honest framing: `R + W > N` gives you a *probabilistic, eventually-consistent* read of the latest write, not linearizability. Concurrent writes still need conflict resolution (Q57), and sloppy quorums weaken even the overlap guarantee in exchange for availability.

### Q59. What is split-brain, and how do failover mechanisms (fencing, leases, quorum) prevent two leaders?

**Split-brain** is when a network partition (or a falsely-detected leader failure) leaves *two* nodes each believing they are the leader, both accepting writes. The cluster's "brain" splits in two. The damage is divergent, conflicting writes to the same data with no leader to serialize them — exactly the conflicts single-leader replication exists to prevent, now happening silently. It typically arises during failover: a follower can't reach the leader, assumes it's dead, and promotes itself — but the old leader is actually alive (just partitioned) and still taking writes.

The root problem is that you **cannot distinguish "the leader is dead" from "I can't reach the leader"** over an unreliable network. So safe failover isn't about better detection; it's about ensuring at most one leader can *act* even if two think they're leader.

Mechanisms, roughly in order of robustness:

- **Quorum-based election.** A node may only become leader if a *majority* of nodes vote for it. Since two disjoint majorities can't exist, at most one side of a partition can elect a leader; the minority side cannot. This is how Raft/Paxos-backed systems (etcd, Consul, ZooKeeper) elect safely — leader election *is* a consensus problem.
- **Leases.** A leader holds a time-bounded lease and must renew it. If it can't renew (partitioned), the lease expires and it must *stop* serving as leader before a new one is granted. The catch is clock dependence — a leader whose clock or process pauses (GC, VM freeze) past the lease can wrongly believe it's still valid.
- **Fencing (STONITH / fencing tokens).** The strongest backstop, because it assumes the old leader might still be alive. Either physically isolate it ("shoot the other node in the head" — power/network off), or hand out a monotonically increasing **fencing token** with each leadership grant; downstream resources (the storage layer) reject any request carrying an *older* token. So even if a zombie old leader sends a write, the data layer refuses it.

The senior insight: detection alone is never enough — a paused-then-resumed old leader will always exist as a possibility. The only fully safe designs make the *resource* enforce a single writer via fencing tokens, rather than trusting nodes to know whether they're still in charge. Leases reduce the window; quorum prevents dual election; fencing prevents a stale leader from doing damage even if both above fail.

---

## Partitioning & Sharding

### Summary

**What this topic covers** — This topic is about splitting one logical dataset across many physical locations so a system can hold more data and serve more traffic than a single machine allows. We cover the vocabulary (partition, shard, replica), the strategies for deciding which row goes where (range, hash, directory), the failure modes (hot partitions, resharding pain), the algorithm that makes membership changes cheap (consistent hashing), what happens to secondary indexes once data is scattered, and why anything touching multiple shards — joins, transactions, fan-out queries — is the part that bites you. The throughline: sharding buys scale by sacrificing the single-node guarantees (cheap joins, easy transactions, global indexes) you took for granted.

**Mental model** — Think of sharding as a routing problem layered on top of a storage problem. Every read and write must first answer "which shard owns this key?" before it can do anything. That routing function — the partition key plus the strategy — is the single most consequential design decision in a distributed data system, and it is the hardest to change after you have petabytes in flight. A senior engineer mentally splits the world into two query classes: those that name the partition key (single-shard, fast, linearly scalable) and those that don't (scatter-gather, fan out to every shard, bounded by the slowest one). You design the key so the dominant access pattern lands in the first class. You also carry the cost of being wrong: choosing a key that distributes poorly (hot spots) or that forces cross-shard work for your common query means re-keying and migrating live data — an operation that ranges from "painful weekend" to "multi-quarter project." Sharding is a one-way door; treat the key like a schema you can never `ALTER`.

**Key terms**
- **Partition / shard** — a horizontal slice of a table's rows living on one node (or replica set). "Shard" usually implies the slices live on separate machines.
- **Partition key (shard key)** — the column(s) whose value determines which partition a row lands in.
- **Replication** — keeping copies of the *same* data on multiple nodes; orthogonal to partitioning.
- **Range partitioning** — assign rows to partitions by contiguous key ranges (`A–F`, `G–M`, …).
- **Hash partitioning** — assign by a hash of the key, scattering adjacent keys.
- **Directory / lookup-based partitioning** — an explicit lookup table maps key → partition.
- **Hot partition / hot spot** — one partition receiving a disproportionate share of traffic or data.
- **Consistent hashing** — a hashing scheme where adding/removing a node remaps only a small fraction of keys.
- **Virtual nodes (vnodes)** — many logical tokens per physical node to smooth distribution and rebalancing.
- **Local secondary index** — an index partitioned alongside the data it points to (per-shard).
- **Global secondary index** — an index partitioned independently on the indexed attribute.
- **Scatter-gather** — querying all partitions and merging results because the partition key isn't in the predicate.

**Why interviewers ask this** — Sharding separates engineers who have only used a single database from those who have operated data at scale. A junior answer reaches for "just add more servers" and treats `hash(key) % N` as the obvious solution without noticing that changing `N` reshuffles nearly everything. A senior answer leads with the access pattern: "what query must be fast, and does it name the key?" It distinguishes partitioning (for scale) from replication (for availability and read throughput), recognizes hot spots before they happen, knows why consistent hashing exists, and — most tellingly — treats cross-shard transactions as a smell to design around rather than a feature to reach for. Interviewers also probe whether you understand the *irreversibility*: the candidates who say "I'd validate the shard key against real query logs before committing" are the ones who've been burned.

**Common confusions**
- **"Partitioning and replication are the same thing."** No — partitioning splits distinct data; replication copies the same data. Most real systems do both.
- **"Hash partitioning is always better than range."** It distributes evenly but destroys range-scan locality; range scans become scatter-gather.
- **"`hash(key) % N` is fine for sharding."** Changing `N` remaps almost every key. That's the entire reason consistent hashing exists.
- **"A global secondary index is free, like on a single node."** It's a separately partitioned structure with its own writes and its own consistency lag.
- **"More shards always means more throughput."** Only for key-named queries; scatter-gather gets *slower* as shard count grows.

**What follows from this topic** — Once data is partitioned, the guarantees from the transactions and concurrency topics no longer come for free: cross-shard atomicity needs two-phase commit or sagas, and cross-shard isolation needs distributed concurrency control. The replication topic explains how each shard stays available and how that interacts with the CAP/consistency tradeoffs. And the storage/indexing topics explain *why* local indexes are cheap and range scans are fast on a single shard — the very properties partitioning fragments.

### Q60. Distinguish partitioning from replication, and horizontal from vertical partitioning. Why shard at all?

These are orthogonal axes and conflating them is the most common beginner mistake. **Replication** keeps multiple copies of the *same* data on different nodes — it buys availability (survive a node loss), read throughput (serve reads from followers), and locality (a replica near the user). **Partitioning** splits *distinct* data across nodes — it buys capacity and write throughput, because no single node holds everything. They compose: production systems shard the dataset, then replicate each shard. In Cassandra a key maps to a partition, and that partition has N replicas; in a sharded Postgres setup each shard is itself a primary with followers.

Within partitioning, **horizontal** vs **vertical** is about *how* you cut the table:

```text
Horizontal (sharding):        Vertical:
split by ROWS                 split by COLUMNS
shard A: user_id 1..1M        node A: id, name, email
shard B: user_id 1M..2M       node B: id, profile_blob, prefs
```

Horizontal partitioning (sharding) puts different rows on different nodes — every node has the full schema, a subset of rows. Vertical partitioning puts different columns on different nodes/tables — useful to separate a hot, narrow set of columns from a cold, wide blob, or to isolate a frequently-updated column. When people say "sharding" they almost always mean horizontal.

**Why shard at all?** Because vertical scaling (a bigger box) hits a ceiling: a single machine has finite RAM, IOPS, CPU, and a single write log everything serializes through. Once your working set exceeds one node's memory, or your write rate exceeds one disk/WAL, you have no choice but to spread the load. Shard only when you must — a single well-tuned Postgres instance with read replicas handles a *lot*, and sharding imposes permanent costs (no cheap joins, no easy transactions, operational complexity). The honest order of escalation is: optimize queries → scale up → add read replicas → *then* shard.

### Q61. Compare partitioning strategies: range, hash, and directory-based. What are the tradeoffs for range queries vs even distribution?

| Strategy | How it routes | Range queries | Even distribution | Rebalancing |
|---|---|---|---|---|
| **Range** | contiguous key intervals | excellent (one/few shards) | poor — prone to hot spots | split/merge ranges |
| **Hash** | `hash(key)` → bucket | terrible (scatter-gather) | excellent | hard (with mod-N); easy with consistent hashing |
| **Directory** | explicit lookup table | flexible | controllable | flexible, but lookup is a dependency |

**Range partitioning** keeps keys in sorted order, so a query like `WHERE created_at BETWEEN x AND y` touches one or a few contiguous shards — this is why time-series and `BETWEEN`-heavy workloads love it. The cost is skew: if your key is monotonically increasing (timestamps, auto-increment IDs), *all new writes* land on the last shard. That's the classic range hot spot.

**Hash partitioning** runs the key through a hash and routes on the result, scattering adjacent keys uniformly. Distribution is excellent and write load spreads evenly, which is why it's the default for high-write KV stores. The price: you destroy ordering, so any range scan becomes a scatter-gather across every shard, and you cannot do efficient `ORDER BY key LIMIT n`.

**Directory-based** keeps an explicit map of key (or key-range) → shard, often consulted via a coordinator/metadata service. It's the most flexible — you can move a noisy tenant to its own shard, or rebalance arbitrarily — but the directory becomes a critical dependency that must be highly available and is itself a potential bottleneck. Many real systems are hybrids: hash the key into many small ranges, then keep a directory mapping range → node (this is roughly what consistent hashing with vnodes gives you).

The core tradeoff is **locality vs uniformity**: range gives you locality and risks skew; hash gives you uniformity and kills locality. Pick based on whether your dominant query is a range scan or a point lookup.

### Q62. What causes hot spots / hot partitions, and how do you design a partition key to avoid them?

A hot partition is one shard absorbing disproportionate **traffic** or **data** while the rest sit idle. Two distinct failure modes, often conflated:

- **Write/throughput skew** — a monotonic key (timestamp, sequential ID) sends every new write to the tail shard under range partitioning. Or one value dominates: partitioning a global activity feed by `country` puts the US on one overloaded node.
- **Access skew (celebrity problem)** — even with perfect data distribution, one key gets read/written far more than others. A "tweets by user" table hashed by `user_id` distributes users evenly, but a celebrity with 100M followers makes that one partition a hot spot no hashing can fix, because all their activity shares one key.

Design techniques:

1. **Choose a high-cardinality, evenly-accessed key.** The key should have many distinct values *and* roughly uniform access. `user_id` beats `country`; `country` beats `is_premium`.
2. **Hash instead of range** when you don't need range scans — turns a monotonic write hot spot into uniform spread.
3. **Composite / salted keys.** Prefix the key with a bucket: instead of partitioning by `sensor_id`, use `(sensor_id, hour)` or add a salt `(hash(x) % 10, x)`. This spreads a single hot key across 10 partitions — at the cost of having to fan out reads across those 10 buckets and merge. You're trading read amplification for write spread; do it only for known-hot keys.
4. **Isolate noisy tenants** via directory partitioning — give the whale its own shard.

```text
Bad:  PK = created_at            → all writes hit newest shard
Good: PK = hash(user_id)         → writes spread, but celebrity still hot
Salt: PK = (created_at_hour, bucket 0..9)  → spreads even a hot hour
```

The senior instinct: validate the key against *real* access logs, not assumed uniformity. Skew is almost always in the data distribution you didn't measure — a Zipfian long tail where the top 1% of keys take 50% of traffic.

### Q63. What is consistent hashing, and what problem does it solve over plain hash-mod-N when adding/removing nodes?

The problem with `node = hash(key) % N`: it works fine until `N` changes. Add one node (`N`→`N+1`) and the modulus shifts for *almost every key* — roughly `N/(N+1)` of all keys remap to a different node. For a 10-node cluster going to 11, ~91% of keys move. That means a near-total data reshuffle and a cold cache cluster-wide every time you scale. Catastrophic.

**Consistent hashing** fixes this by hashing both keys *and* nodes onto the same circular keyspace (the "ring"). A key is owned by the first node clockwise from the key's hash position. Now adding a node only steals keys from its immediate clockwise neighbor — only `~K/N` keys move, where K is total keys. Removing a node hands its keys to the next node clockwise; again only that node's share moves. Membership changes become local, not global.

```text
Ring (hash space wraps 0 → MAX → 0):

        [NodeA]
       /        \
   key3          key1
     |            |
   [NodeC] ---- [NodeB]
        \  key2  /

key → walk clockwise → owned by first node hit.
Add NodeD between C and A: only keys in (C, D] move from A.
```

Naive consistent hashing has a flaw: with few nodes, the ring is lumpy — one node may own a huge arc and become a hot spot, and when a node leaves, *all* its load dumps onto one neighbor. The fix is **virtual nodes (vnodes)**: each physical node is placed at many positions on the ring (Cassandra defaults to 256 tokens per node). This smooths distribution (the law of large numbers evens out arc sizes) and spreads a departing node's load across *many* neighbors instead of one. Vnodes also let you weight heterogeneous hardware — a bigger box gets more tokens. Dynamo, Cassandra, Riak, and most modern KV stores use consistent hashing with vnodes precisely to make scaling and node failure cheap, incremental operations.

### Q64. How do secondary indexes work in a partitioned system (local vs global indexes), and what does each cost?

The partition key gives you a fast path for one access pattern. Every *other* way you want to query — "find orders by `status`", "users by `email`" — needs a secondary index, and partitioning forces a hard choice about how that index is itself distributed.

**Local secondary index (document-partitioned):** each shard indexes only the rows it holds. Writes are cheap and local — inserting a row updates the index on the *same* shard, no cross-node coordination, so it stays consistent with the data trivially. The cost is on reads: a query by the indexed attribute can't know which shards have matches, so it must **scatter-gather** across *every* shard, query each local index, and merge. This is how Cassandra's secondary indexes and Elasticsearch shards work. Great when your query *also* names the partition key (then it's single-shard); bad for a global "find all rows where status=X."

**Global secondary index (term-partitioned):** the index is partitioned independently, on the *indexed* attribute. A lookup by `email` hashes the email and goes straight to the one index partition that owns that term — a single-shard read, no scatter. The cost moves to writes: inserting one row may have to update an index partition on a *different* node than the data. That's a distributed write, and most systems (DynamoDB Global Secondary Indexes are the canonical example) make it **asynchronous and eventually consistent** — the index lags the table, so you can read a row that the index hasn't caught up to yet.

| | Local (document-partitioned) | Global (term-partitioned) |
|---|---|---|
| Index lives | with the data, per shard | partitioned by indexed term |
| Write cost | cheap, local, consistent | cross-shard, often async/eventual |
| Read cost | scatter-gather all shards | single-shard lookup |
| Best for | queries that name the partition key | global lookups by the indexed attr |

The tradeoff is "pay on write vs pay on read," and there's no free lunch — which is exactly why interviewers ask. If you read by an attribute far more than you write, a global index earns its keep despite the write complexity; if writes dominate or you can tolerate scatter-gather, local indexes keep the write path clean.

### Q65. How do you handle cross-shard queries, joins, and transactions? Why are they expensive and how do you design to avoid them?

Anything spanning shards is expensive because it forfeits the single-node guarantees sharding fragmented. A **cross-shard query** (no partition key in the predicate) fans out to every shard and is bounded by the slowest responder — tail latency dominates, and the query gets *slower* as you add shards. A **cross-shard join** can't use a local hash/merge join; the planner must ship data between nodes (broadcast the small side, or repartition both sides on the join key over the network) — orders of magnitude more expensive than a local join. A **cross-shard transaction** loses cheap single-node atomicity: you now need **two-phase commit (2PC)** — a coordinator with prepare/commit rounds that blocks holding locks across nodes, and stalls indefinitely if the coordinator dies mid-commit — or you abandon ACID and use **sagas** (a sequence of local transactions with compensating actions to undo on failure), which gives you eventual consistency and no isolation, pushing rollback logic into the application.

The senior answer is overwhelmingly "**design so you don't have to**." Concrete tactics:

1. **Co-locate related data.** Choose a partition key that keeps things you join/transact together on the same shard. Order + order_lines keyed by the *same* `customer_id` (or `order_id`) means the join and the "create order + lines atomically" transaction are both single-shard. Spanner calls this interleaved tables; Vitess calls it sequences/keyspaces; the idea is identical — pick an **entity group** boundary that matches your transaction boundary.
2. **Denormalize** to avoid the join entirely — store the data you'd join already embedded.
3. **Maintain a read model** (CQRS / materialized view) for the cross-cutting query, updated asynchronously, so the expensive scatter happens once at write time, not on every read.
4. **Accept eventual consistency** for genuinely cross-entity workflows (e.g. moving money between two accounts on different shards) via sagas + idempotent compensations, rather than forcing 2PC.

When you genuinely can't avoid it — analytics across all customers — that's a signal the workload belongs in a different system: an OLAP store / data warehouse fed by CDC, not your sharded OLTP database. The recurring theme: the partition key *is* the transaction and join boundary. Get that boundary to match your access pattern and cross-shard operations mostly disappear; get it wrong and you pay 2PC and scatter-gather forever.

---

## Consistency Models

### Summary

**What this topic covers** — Consistency models are the contract a storage system makes about what values reads can return when multiple clients read and write concurrently, especially when data is replicated across machines. This topic spans the strong end (linearizability), the relationship between consistency models and transaction isolation (serializability), the weak end (eventual consistency and session guarantees), the strongest model compatible with high availability (causal consistency), and the data structures that make convergence automatic (CRDTs). It is fundamentally about ordering: which writes a reader is guaranteed to see, and in what order.

**Mental model** — Picture a single logical register replicated across three datacenters. Every consistency model answers one question: given a write `W` and a later read `R`, must `R` reflect `W`? Linearizability says yes the instant `W` returns — the system behaves as if there is one copy and operations happen at a single point in time on a global timeline. Weaker models relax that timeline: maybe `R` sees a stale value, maybe different readers see writes in different orders. The deep insight is the CAP/PACELC tradeoff: to confirm a write everywhere before acknowledging it, you must talk to a quorum across the network, which costs latency and forces you to reject writes during a partition. So consistency is bought with latency and availability. A senior engineer reads "strong consistency" as "synchronous cross-replica coordination on the write path" and immediately asks what that costs in p99 and what happens during a network split. The model you pick is a business decision about whether stale or conflicting reads are tolerable.

**Key terms**
- **Linearizability** — every operation appears to take effect atomically at a single instant between its invocation and response, consistent with real-time order.
- **Sequential consistency** — operations appear in some total order respecting each process's program order, but not necessarily real-time order.
- **Serializability** — a transaction isolation property: concurrent transactions produce a result equal to some serial execution.
- **Strict serializability** — serializability plus linearizability's real-time order; the gold standard for distributed databases.
- **Eventual consistency** — replicas converge to the same value if writes stop; no ordering guarantee in the meantime.
- **Causal consistency** — operations that are causally related are seen in the same order by all replicas; concurrent ops may differ.
- **Session guarantees** — per-client promises like read-your-writes that hold within one session.
- **Quorum** — a subset of replicas (e.g. `R + W > N`) that must respond to guarantee overlap.
- **Convergence** — all replicas reaching the same state given the same set of updates.
- **CRDT** — a Conflict-free Replicated Data Type whose merge operation is commutative, associative, and idempotent.

**Why interviewers ask this** — This is the cleanest test of whether someone has worked with distributed data or only single-node databases. A junior answer collapses everything into "strong vs eventual" and conflates the consistency-C in ACID with the C in CAP. A senior answer distinguishes the two precisely, knows that serializability and linearizability are orthogonal (one is about transactions, one is about single-object real-time order), and can reason about which guarantee a feature actually needs — a "like" counter tolerates eventual consistency, but a bank balance or a uniqueness constraint usually needs linearizability or strict serializability. Interviewers also want to hear the cost framing: that moving toward stronger consistency trades away latency and availability, and that the strongest model you can keep under a network partition is causal, not linearizable.

**Common confusions**
- **"ACID consistency and CAP consistency are the same thing."** ACID-C is about invariants/constraints holding; CAP-C is linearizability. Unrelated.
- **"Serializability implies linearizability."** No — serializable transactions can read stale snapshots; you need *strict* serializability for real-time order.
- **"Eventual consistency means data is eventually correct."** It means replicas converge; the converged value may be a clobbered or arbitrary winner.
- **"Strong consistency is always better, just slower."** It also sacrifices availability under partition; sometimes unacceptable.
- **"CRDTs eliminate all conflicts."** They eliminate *merge* conflicts by defining a deterministic merge, but semantics (e.g. add-wins) may not match intent.

**What follows from this topic** — Consistency models sit downstream of replication and the CAP/PACELC theorems, and upstream of transaction isolation (serializable, snapshot isolation) and consensus protocols (Raft, Paxos) that *implement* linearizability. They connect to quorum systems, leaderless replication (Dynamo-style), and conflict resolution strategies like last-write-wins versus CRDTs. Understanding them is prerequisite to reasoning about distributed transactions, two-phase commit, and the guarantees of systems like Spanner, Cassandra, and DynamoDB.

### Q66. Define linearizability precisely. Why is it called "strong consistency", and what does it cost?

Linearizability is a guarantee about **single operations on a single object**. It says: each operation (read or write) appears to take effect atomically at some single instant between when the client issued it and when the client got a response, and this set of instants is consistent with real-time order. Concretely, once a write completes and returns to the caller, every subsequent read — by *any* client — must return that value or a newer one. There are no stale reads after acknowledgement, and the system behaves indistinguishably from a single copy of the data.

The "real-time" clause is what makes it strong. If operation `A` finishes before operation `B` begins (in wall-clock time), then `A` must be ordered before `B`. This rules out a reader seeing the system "go backwards in time."

```text
client1:  --[W x=1]--|                         (write returns here)
client2:                  |--[R x]--?           must read 1, not 0
```

It is called strong consistency because it is the closest a distributed system can get to behaving like a single non-replicated register — the strongest *single-object* model. The cost is coordination. To guarantee no client ever sees stale data, you cannot acknowledge a write until it is durable on enough replicas that any future read quorum overlaps it (`R + W > N`), or until a consensus leader has committed it. That means a synchronous round trip across replicas on the write path — and often the read path too. So you pay latency (cross-AZ or cross-region RTT on every operation) and, per CAP, you lose availability during a network partition: a minority partition must reject writes rather than risk a stale or divergent read. Systems like etcd, ZooKeeper, and Spanner pay exactly this price; Spanner uses TrueTime and GPS/atomic clocks specifically to bound the uncertainty and keep latency tolerable.

### Q67. Contrast linearizability with serializability. They are often confused — what is each actually about?

They answer different questions and are formally orthogonal. **Linearizability** is about a *single object* and *real-time order* of individual operations. **Serializability** is about *multiple objects across transactions* and says the outcome is equivalent to *some* serial (one-at-a-time) ordering of whole transactions — but it says nothing about *which* serial order or about real time.

| | Linearizability | Serializability |
|---|---|---|
| Scope | Single object/operation | Multi-object transactions |
| Concern | Real-time recency | Transaction isolation |
| Order constraint | Must match wall-clock order | Any serial order is fine |
| Can return stale data? | No | Yes (snapshot reads) |
| Family | Distributed systems / CAP-C | Database isolation / ACID-I |

The classic gotcha: a serializable database can give you a *stale* but internally consistent answer. Snapshot-based serializable engines may execute your transaction against a snapshot from the recent past; the result is equivalent to a serial schedule, but it is not necessarily the *latest* data, so it is not linearizable. Conversely, linearizability says nothing about grouping operations into atomic transactions.

The model that combines both is **strict serializability**: transactions are serializable *and* the serial order respects real-time order. That is what people usually mean by "a strongly consistent distributed SQL database" — Spanner and CockroachDB target this. When an interviewer says "consistency," pin down which one: if they mean CAP, they mean linearizability; if they mean ACID, they mean the constraint-preserving C (a different thing again) or isolation.

### Q68. Explain eventual consistency and the session guarantees (read-your-writes, monotonic reads, monotonic writes, writes-follow-reads).

Eventual consistency is the weak end: if writes stop, all replicas *eventually* converge to the same value. That is the only promise. In the meantime, reads can return stale data, different replicas can disagree, and a reader can even see values appear to move backward. It buys you low latency and high availability — any replica can serve a read or accept a write without coordinating — which is why Dynamo-style stores (Cassandra, DynamoDB with eventually-consistent reads, Riak) default to it.

Raw eventual consistency is painful for users, so systems layer **session guarantees** that hold within a single client session without requiring global coordination — usually implemented by pinning a client to a replica or carrying version metadata:

- **Read-your-writes (read-your-own-writes)** — after you write a value, your own subsequent reads see it (or newer). Prevents "I posted a comment and it vanished on refresh." Often done by routing the session to a replica known to have the write, or by passing a write token the read must satisfy.
- **Monotonic reads** — if you read a value, later reads in the same session never return an *older* value. Prevents time appearing to go backward (seeing a comment, refreshing, and it's gone because you hit a lagging replica).
- **Monotonic writes** — your writes are applied in the order you issued them. Prevents a later write being overtaken by an earlier one on a replica.
- **Writes-follow-reads (causal)** — if you read value `v` and then write `w`, then `w` is ordered after `v` everywhere. Ensures a reply is never visible before the message it replies to.

These are *per-session* and much cheaper than global linearizability — they require only that one client sees a sensible view, not that all clients agree in real time. Combine all four and you have effectively built per-session causal consistency.

### Q69. What is causal consistency, and why is it considered the strongest model achievable in an always-available system?

Causal consistency preserves the **happens-before** relationship (Lamport's causality): if operation `A` causally precedes `B` — because the same client did `A` then `B`, or because some client read `A`'s effect and then issued `B` — then *every* replica must apply `A` before `B`. Operations that are *not* causally related (concurrent) may be applied in different orders on different replicas, and that's allowed. The canonical example: you must never see a reply to a comment before the comment itself, but two unrelated comments can show up in either order on different replicas.

It sits below linearizability (which orders *all* operations on a real-time timeline, including concurrent ones) but above plain eventual consistency. The reason it is special: it is the **strongest consistency model that can be provided while remaining available under network partitions**. This is a theorem result (Mahajan et al.; the "CAC" / convergent causal consistency result) — once a partition heals you converge, and during the partition every replica can still accept reads and writes because tracking causality only needs per-operation metadata (vector clocks or dependency lists), not cross-replica agreement. Linearizability cannot do this: it requires consensus, which stalls a minority partition.

```text
A: post comment  ──happens-before──▶  B: reply to it
   every replica must show A before B

C: unrelated comment   ‖ concurrent with A
   replicas may order C and A either way
```

The practical cost is metadata: you track dependencies (vector clocks, version vectors) so a replica can detect "I can't apply this write yet, I'm missing a dependency" and buffer it. Systems like COPS, and the causal+ work that influenced Cosmos DB's "Consistent Prefix"/session levels, demonstrate it. It is the sweet spot for collaborative and social applications that need sane ordering but can't sacrifice availability.

### Q70. Place the common consistency models on a spectrum from strongest to weakest, and explain the latency/availability cost of moving up.

From strongest to weakest:

```text
strict serializability   (txn + real-time order)        ── most coordination
linearizability          (single-object real-time)
sequential consistency   (total order, not real-time)
causal consistency       (happens-before preserved)     ── max under partition (HA)
session guarantees       (read-your-writes, monotonic…)
eventual consistency     (converge if writes stop)       ── least coordination
```

| Model | Coordination on write | Available under partition? | Typical latency |
|---|---|---|---|
| Strict serializable | Consensus + 2PC across shards | No | Highest |
| Linearizable | Consensus / quorum | No (minority rejects) | High |
| Sequential | Total order, no real-time | Limited | High |
| Causal | Dependency tracking only | **Yes** | Medium |
| Session | Per-client routing/tokens | Yes | Low |
| Eventual | None | Yes | Lowest |

The principle behind the ordering: **the more operations you must totally order, and the tighter you tie that order to real wall-clock time, the more synchronous cross-replica agreement you need before acknowledging an operation.** Linearizability and above require a quorum or consensus round trip on the critical path, so every write pays inter-replica RTT — brutal across regions (tens to hundreds of ms) — and per CAP must refuse service on the minority side of a partition. PACELC sharpens this: *even when there's no partition*, you choose between latency and consistency (the "ELC" clause). Moving *down* the spectrum, each step removes a coordination requirement: causal needs only metadata-driven dependency ordering (no agreement on concurrent ops), session guarantees need only per-client stickiness, and eventual needs nothing — any replica answers immediately. The engineering job is to pick the weakest model that still satisfies the application's correctness needs, because every step up is paid for in p99 latency and partition-time availability.

### Q71. What are CRDTs, and how do they achieve conflict-free eventual convergence? Give an example (counter, set).

A CRDT (Conflict-free Replicated Data Type) is a data structure designed so that replicas can be updated independently and concurrently, and then *merged* into a consistent state with **no coordination and no conflict resolution logic** — convergence is mathematically guaranteed. They make eventual consistency *safe* by removing the "last-write-wins clobbers data" problem: instead of overwriting, the merge function combines states deterministically.

There are two flavors. **State-based (CvRDT)**: replicas exchange their full state and merge via a function that is **commutative, associative, and idempotent** — i.e. a join over a semilattice. Because of those properties, it doesn't matter what order updates arrive, whether they're duplicated, or how they're grouped; the merged result is identical everywhere. **Operation-based (CmRDT)**: replicas broadcast operations that must be commutative, with reliable causal delivery.

A **grow-only counter (G-Counter)**: each replica keeps a per-replica vector of increments, `{A:3, B:5, C:2}`. To increment, a replica bumps only its own entry. The merge is element-wise `max`; the value is the sum. Element-wise max is commutative/associative/idempotent, so two replicas that incremented concurrently both survive the merge — no lost updates. A **PN-Counter** adds a second vector for decrements.

```text
replica A: {A:2, B:1}    increments locally → {A:3, B:1}
replica B: {A:2, B:1}    increments locally → {A:2, B:2}
merge (element-wise max): {A:3, B:2}  →  value = 5  (both increments kept)
```

For sets, the subtlety is remove-vs-add. A naive set loses information on concurrent add/remove. An **OR-Set (Observed-Remove Set)** tags every add with a unique id; a remove only deletes the tags it has observed. If `add(x)` and `remove(x)` happen concurrently, the add's tag wasn't observed by the remove, so `x` survives — "add-wins." This is deterministic, but note the *semantic* choice: add-wins may not be what the user intended, which is the real cost of CRDTs — convergence is free, but you live with whatever merge semantics the type encodes. CRDTs power collaborative editors (Automerge, Yjs), Redis Active-Active, and Riak's data types.

---

## Distributed Transactions & Consensus

### Summary

**What this topic covers** — This topic is about getting multiple independent machines to agree — either on the outcome of a transaction that spans several nodes, or on a single value/log entry despite failures. It covers atomic commitment protocols (2PC, 3PC), the saga pattern as an alternative to distributed ACID, the formal problem of consensus and what it guarantees, the two production consensus algorithms you must know (Raft and Paxos), the theoretical limit imposed by the FLP result, and the practical reality of message delivery (idempotency and exactly-once semantics). These are the load-bearing ideas under replicated databases, distributed locks, leader election, and durable messaging.

**Mental model** — Hold two distinct problems in your head and never conflate them. The first is *atomic commitment*: a transaction touched data on nodes A, B, and C, and you need all-or-nothing across them — either everyone commits or everyone aborts. 2PC solves this but blocks under coordinator failure. The second is *consensus*: a set of replicas must agree on one value (the next log entry, who is leader) even though messages get lost, delayed, and reordered, and nodes crash. Consensus is the more fundamental primitive — atomic commitment can be built on top of it (replicate the commit decision through a consensus log so it survives coordinator death). The deep insight is that asynchronous networks give you no reliable way to distinguish a *crashed* node from a *slow* one. Every protocol here is a strategy for making progress despite that ambiguity, usually by trading off availability (block and stay safe) against liveness (use timeouts and risk being wrong).

**Key terms**
- **Atomic commitment** — getting all participants in a distributed transaction to commit or all to abort.
- **Coordinator** — the node that drives a 2PC/3PC round and decides the outcome.
- **Quorum** — a majority subset (e.g. ⌈(n+1)/2⌉) whose overlap guarantees no two disjoint quorums agree on different values.
- **Consensus** — agreeing on a single value among nodes despite failures.
- **Agreement / Validity / Termination** — the three properties a consensus algorithm must satisfy.
- **Linearizability** — a consistency property: operations appear to take effect atomically at a single point in real time.
- **Saga** — a sequence of local transactions with compensating actions, providing atomicity-ish without a global lock.
- **Compensating transaction** — a new transaction that semantically undoes a prior committed one.
- **Leader / term** — in Raft, the elected coordinator and the monotonic epoch number guarding stale leaders.
- **FLP impossibility** — no deterministic consensus algorithm can guarantee termination in a fully async network with even one crash.
- **Idempotency** — applying an operation more than once yields the same result as applying it once.
- **Fencing token** — a monotonic number that lets a resource reject writes from a stale leader.

**Why interviewers ask this** — These questions separate engineers who have *operated* distributed systems from those who have only read about them. A junior says "use 2PC" and stops; a senior immediately names the blocking failure mode and reaches for consensus-backed commit or sagas. A junior conflates "exactly-once delivery" with "exactly-once processing"; a senior explains why the former is impossible and how idempotency keys deliver the latter. The signal interviewers want: do you understand that the network is adversarial (lost, duplicated, reordered, delayed messages), that timeouts are guesses, and that every guarantee costs availability? Naming FLP and then explaining how Raft sidesteps it with randomized timeouts shows you understand the difference between theory and engineering. Reaching for compensations instead of distributed locks shows you understand cost at scale.

**Common confusions**
- **"2PC is a consensus protocol."** It's atomic commitment; it requires *all* participants (not a quorum) and blocks on coordinator failure — consensus tolerates a minority of failures and always terminates given synchrony.
- **"3PC fixes 2PC."** It removes the blocking case but is unsafe under network partitions, so almost nobody uses it.
- **"Sagas give you isolation."** They don't — intermediate states are visible; you only get eventual atomicity.
- **"FLP means consensus is impossible in practice."** It only forbids a *deterministic* algorithm guaranteeing termination under *fully async* assumptions; real systems add timeouts/randomness.
- **"Exactly-once delivery is achievable with enough retries."** Delivery can't be exactly-once; effects can, via idempotency or dedup.

**What follows from this topic** — Consensus underpins replication and leader election, which connects to the CAP/PACELC tradeoffs and to linearizability vs serializability (a consistency-model topic). Sagas link forward to event-driven architecture and the outbox pattern. Idempotency and fencing tokens recur in distributed locking and in stream-processing exactly-once topics.

### Q72. Explain two-phase commit (2PC): the coordinator/participant protocol, and exactly how it can block. What does 3PC try to fix?

2PC is an *atomic commitment* protocol: a coordinator drives a set of participants to all-commit or all-abort a distributed transaction. It runs in two round trips:

```text
Phase 1 (voting):    Coordinator --PREPARE--> participants
                     each participant durably logs, replies YES (vote-commit) or NO
Phase 2 (decision):  if all YES -> Coordinator --COMMIT--> all
                     if any NO  -> Coordinator --ABORT--> all
                     participants ack, coordinator completes
```

The key durability rule: once a participant votes `YES`, it is in an *uncertain* (prepared) state — it has given up the right to unilaterally abort and must hold locks until it hears the decision. The coordinator's decision becomes final the moment it writes the commit record to its own log.

The blocking failure mode: if the coordinator crashes *after* participants voted `YES` but *before* delivering the decision, the prepared participants are stuck. They can't abort (they promised to commit) and can't commit (they don't know the others' votes). They hold their locks and wait. If the coordinator's disk is also lost, the outcome may be unrecoverable without manual intervention. This is why 2PC is said to be a *blocking* protocol — a single node failure (the coordinator) halts the whole group. Participant-to-participant communication doesn't save you: a peer that also only voted `YES` knows nothing more than you do.

3PC inserts a `PRE-COMMIT` phase between voting and committing, so participants learn "everyone voted yes" *before* anyone commits. That extra round lets a recovery coordinator infer the decision from surviving nodes' states, eliminating the blocking case under the *fail-stop, synchronous* model. The catch: 3PC is **unsafe under network partitions** — a partition can let two sub-groups reach different decisions. That's a worse failure than blocking, so 3PC is essentially never used in practice.

The modern answer is to make the *commit decision itself* a consensus-replicated value — Spanner and CockroachDB run 2PC but back the coordinator's decision with Paxos/Raft, so a crashed coordinator is replaced and the decision survives. You get atomic commitment without the single-point block.

### Q73. What is the saga pattern, and how do compensating transactions differ from a rollback? When do you choose sagas over 2PC?

A saga models a long-running, multi-service business transaction as a sequence of *local* ACID transactions, each in its own service/database. There's no global lock and no prepared state. Instead, every step `Tᵢ` has a paired **compensating transaction** `Cᵢ` that semantically undoes it. If step 4 fails, the saga runs `C₃, C₂, C₁` in reverse to walk the system back to a consistent state.

```text
Forward:  T1 reserve -> T2 charge -> T3 ship -> T4 (fails)
Compensate:           C2 refund <- C1 unreserve   (T3 never ran)
```

Compensation is not a rollback. A rollback (the database `ROLLBACK` of an uncommitted transaction) erases changes as if they never happened — no one ever saw them. A compensating transaction runs *after* the original committed and was visible; it issues a *new* transaction that achieves a business-level reversal. You don't "un-charge" a card; you issue a refund. You don't un-send an email; you send a follow-up cancellation. This means compensations must be designed for each step, must be idempotent (they may be retried), and some actions are not cleanly compensable (you can't unsend a physical package — you compensate with a return-label workflow).

The crucial tradeoff: sagas give up isolation. Between `T2` and its compensation, the world sees the intermediate state — the charge is real and visible. Other transactions can read "dirty" intermediate results, so you need semantic safeguards (pending/reserved states, idempotency keys, business rules that tolerate the window).

Choose sagas when the transaction spans services that each own their data and you can't (or won't) hold distributed locks across them — the microservices default. Choose them for long-lived flows (seconds to days) where 2PC's lock-holding would kill throughput. Choose 2PC (ideally consensus-backed) when you need real atomic isolation, the participants are tightly coupled (e.g. two shards of one database), and the transaction is short. Rule of thumb: 2PC across service boundaries you don't control is an operational trap; sagas are the scalable answer, paid for with eventual consistency and more application code.

### Q74. Why is consensus needed in distributed systems? State what a consensus algorithm guarantees (agreement, validity, termination).

Consensus is needed whenever multiple nodes must agree on *one* thing despite failures: who is the leader, what the next entry in the replicated log is, whether a transaction committed, what the current cluster membership is. Replication is the canonical case — if three replicas each accept writes independently they'll diverge, so they must agree on a single ordered sequence of operations. Consensus is the primitive that turns a set of unreliable nodes into a single, fault-tolerant logical machine (a replicated state machine).

A consensus algorithm must satisfy three properties:

| Property | Meaning |
|---|---|
| **Agreement** | No two correct nodes decide different values. (Safety.) |
| **Validity** (integrity) | The decided value was actually proposed by some node — you can't agree on a value nobody suggested. (Safety.) |
| **Termination** | Every correct node eventually decides. (Liveness.) |

Agreement and validity are *safety* properties — "nothing bad happens"; they must hold always, even during partitions. Termination is a *liveness* property — "something good eventually happens." The whole drama of distributed systems lives in the tension between them: you can always preserve safety by blocking forever (never decide → never decide *wrong*), but that violates termination. FLP (next questions) proves you can't guarantee all three in a fully asynchronous network with a faulty node, which is why real systems relax the timing model rather than the safety properties.

Practically, consensus is built on **quorums**: decisions require a majority (e.g. 2 of 3, 3 of 5). Because any two majorities overlap in at least one node, that shared node prevents two disjoint groups from deciding conflicting values — this overlap is the mathematical heart of agreement. A 5-node cluster tolerates 2 failures and still has a quorum of 3; lose 3 and you lose liveness but never safety.

### Q75. Explain Raft at a high level: leader election, log replication, and how it stays safe across failures. How does it compare to Paxos?

Raft was explicitly designed to be *understandable*, and it achieves consensus through a strong-leader model. Time is divided into **terms** (monotonic integers); each term has at most one leader.

**Leader election:** every node is `follower`, `candidate`, or `leader`. Followers expect periodic heartbeats from the leader. If a follower's randomized election timeout (e.g. 150–300ms) elapses with no heartbeat, it becomes a candidate, increments the term, votes for itself, and requests votes. A node grants its vote at most once per term and only to a candidate whose log is at least as up-to-date as its own. Win a majority → become leader. The **randomized** timeouts are the trick that makes split votes rare and self-healing — staggered timers mean one candidate usually starts first and wins.

**Log replication:** clients send commands to the leader, which appends to its log and sends `AppendEntries` to followers. Once a majority has persisted an entry, the leader marks it **committed** and applies it to its state machine; followers apply once they learn it's committed. A consistency check (each `AppendEntries` carries the index/term of the preceding entry) forces follower logs to match the leader's, overwriting divergent tails from old leaders.

**Safety:** terms plus the up-to-date voting restriction guarantee that any newly elected leader already contains all committed entries, so committed data is never lost. A leader from a stale term is rejected the instant a node sees a higher term, preventing two leaders from both committing.

Compared to **Paxos**: single-decree Paxos solves agreement on *one* value and is famously hard to reason about; Multi-Paxos extends it to a log but the canonical papers leave membership changes and log management underspecified, so every implementation differs. Raft folds leader election, log replication, and membership changes into one prescriptive design. They have equivalent fault tolerance and both rely on majority quorums; Raft trades Paxos's flexibility (it permits leaderless proposals) for a strong-leader simplicity that's far easier to implement correctly. etcd, Consul, and TiKV use Raft; Spanner/Chubby descend from Paxos.

### Q76. What does the FLP impossibility result say, and how do real systems (Raft/Paxos) work around it?

FLP (Fischer, Lynch, Paterson, 1985) proves that in a **fully asynchronous** system — no bound on message delay or relative processor speed — **no deterministic consensus algorithm can guarantee termination if even a single process may crash**. There's always at least one execution where the system never decides.

The intuition: in a pure async model you cannot distinguish a crashed node from one that is merely slow, because a message can be delayed arbitrarily. An adversarial scheduler can always delay the one message that would have broken a tie, keeping the system in a "bivalent" state (an undecided state that could still go either way) forever. Crucially, FLP attacks *liveness* (termination), not *safety* — a correct algorithm never decides *wrong*, it just might never decide.

Real systems escape FLP by refusing its premise: they don't operate in a purely asynchronous model. The standard workarounds:

- **Timeouts as failure detectors.** Raft and Paxos use clocks to *suspect* a node is dead. This is a partial-synchrony assumption — the network is async sometimes but eventually behaves synchronously long enough to make progress. The detector can be wrong (suspect a slow node), which costs an extra election, never safety.
- **Randomization.** Raft's randomized election timeouts break the symmetry FLP exploits — the adversarial scheduler can't reliably keep nodes tied because timeouts are unpredictable. (Ben-Or–style randomized consensus formalizes this: terminate with probability 1.)

The honest framing for an interview: FLP doesn't say consensus is impossible — production systems do it every day. It says you can't have *guaranteed* termination *and* safety *and* full asynchrony simultaneously. Engineers keep safety unconditional (agreement holds even during a partition) and make termination *probabilistic / eventual* — the system always makes progress once the network is stable enough, and during a bad partition it correctly chooses to block rather than risk split-brain.

### Q77. Explain idempotency and exactly-once semantics. Why is "exactly-once delivery" impossible, and how do you get exactly-once effect?

**Idempotency** means applying an operation N times has the same effect as applying it once. `SET balance = 100` is idempotent; `balance = balance + 10` is not. Idempotency is the foundation that makes unreliable networks survivable, because it lets you *retry safely*.

Why **exactly-once delivery** is impossible: the sender faces an unavoidable ambiguity. It sends a message and waits for an ack. If no ack arrives, it cannot tell *which* of two things happened — the message was lost, or the message arrived and the *ack* was lost. Its only choices are: retry (risking a duplicate if the original landed) or don't retry (risking loss if it didn't). You must pick "at-least-once" (retry → possible duplicates) or "at-most-once" (don't → possible loss). There is no third option over an unreliable channel — this is a consequence of the same two-generals ambiguity that underlies FLP.

So you get exactly-once **effect** (sometimes called exactly-once *processing*), not delivery. The recipe: choose at-least-once delivery, then make processing idempotent so duplicates are harmless. Concretely:

```sql
-- Dedup with an idempotency key supplied by the client
INSERT INTO processed_requests (idempotency_key, result)
VALUES ('req-9f3a', '...')
ON CONFLICT (idempotency_key) DO NOTHING;
-- if zero rows inserted, this is a replay -> return the stored result
```

Three standard techniques: (1) **idempotency keys** — the client attaches a unique key; the server records processed keys and ignores repeats (Stripe's API works exactly this way). (2) **Deduplication windows** — Kafka's idempotent producer tags messages with a producer-id + sequence number so the broker drops duplicates. (3) **Transactional / atomic dedup** — record "I processed message X" *in the same transaction* that produces the side effect, so the dedup marker and the effect commit together; on replay you see the marker and skip. The subtle trap: dedup only works if the marker write and the effect are atomic. If you do the effect, then crash before writing the marker, the retry double-applies. Where you can't make the effect transactional (sending a real email, calling an external API), you push idempotency to the downstream system or accept a tiny double-action window and reconcile.

---

## NoSQL & Data Store Types

### Summary

**What this topic covers** — This topic is about the landscape of non-relational data stores: the major families (key-value, document, wide-column, graph, time-series), how each physically lays out data, and the access patterns each is built to serve. It also covers the design discipline that goes with them — modeling around queries instead of around normalized entities — and the harder organizational question of when to reach for NoSQL at all, including running several stores side by side (polyglot persistence) and keeping them in sync.

**Mental model** — The senior frame is that "NoSQL" is not a coherent category; it's a marketing label that lumps together stores whose only shared trait is "not a 1970s-style relational SGBD with SQL and joins." The useful axis is *physical data layout* and *what that layout makes cheap*. A relational engine is a general-purpose machine: it stores rows in a B-tree, lets you join anything to anything at query time, and pays for that flexibility with coordination and per-query planning cost. A NoSQL store typically picks one access pattern, bakes it into the storage layout, and gets enormous throughput or horizontal scale for *that* pattern while making everything else painful or impossible. So the real question is never "SQL or NoSQL?" — it's "what is my dominant access pattern, what is my consistency requirement, and what scale forces me off a single node?" Once you know the read/write shape, the storage engine almost picks itself.

**Key terms**
- **Key-value store** — a hash/dictionary at scale; get/put by primary key, no query over values (Redis, DynamoDB core, Riak).
- **Document store** — stores self-describing nested records (JSON/BSON) addressable by key, with secondary indexes on fields (MongoDB, Couchbase).
- **Wide-column / column-family** — rows keyed by a partition key, each holding sparse, dynamic columns; an ordered map of maps (Bigtable, Cassandra, HBase).
- **Graph database** — first-class nodes and edges optimized for traversal (Neo4j, JanusGraph).
- **Time-series database** — append-heavy store optimized for `(series, timestamp) → value` and time-windowed scans (InfluxDB, TimescaleDB, Prometheus).
- **Denormalization** — duplicating data across records so a read needs no join.
- **Partition key** — the value that determines which node/shard owns a row; drives data distribution.
- **Index-free adjacency** — graph nodes hold direct pointers to neighbors, so traversal cost is independent of total graph size.
- **LSM tree** — log-structured merge tree; buffers writes in memory, flushes sorted immutable files, compacts later — the write-optimized backbone of most wide-column stores.
- **Polyglot persistence** — deliberately using multiple stores, each for the workload it suits.
- **Single-table design** — DynamoDB-style modeling where many entity types share one table, packed for known queries.

**Why interviewers ask this** — Junior candidates treat "NoSQL" as "faster than SQL" or "schemaless so I don't have to think." That's a red flag. The signal interviewers want is whether you choose a store from access patterns and consistency needs, not hype — and whether you understand what you *give up*: ad-hoc queries, multi-key transactions, referential integrity, join flexibility. A senior answer names the family, names a real system, names the physical layout, and names the workload it loses on. The strongest tell is a candidate who says "I'd default to a relational database and only move off it for a specific, named reason," because that demonstrates they understand NoSQL as a set of *tradeoffs*, not an upgrade.

**Common confusions**
- **"NoSQL means schemaless, so there's no modeling."** — The schema moves from the database into your application and your access patterns; modeling gets *harder*, not optional.
- **"NoSQL is faster than relational."** — Only for the pattern it's tuned for; a join-heavy analytical query on a key-value store is slower or impossible.
- **"NoSQL doesn't do transactions/ACID."** — Many now do (DynamoDB transactions, MongoDB multi-document, Spanner is fully relational+distributed). The old equation is outdated.
- **"Document and wide-column are the same thing."** — Different layouts: documents are nested blobs per key; wide-column is a sorted, sparse column map per partition.
- **"Schemaless means no migrations."** — You still migrate, just lazily in code, which is often worse to reason about.

**What follows from this topic** — The consistency tradeoffs hinted at here (tunable consistency, eventual reads) are the subject of the CAP/PACELC and replication topics. The LSM-tree mechanics under wide-column stores connect to the storage-engine topic (B-tree vs LSM). And "query-first modeling" is the practical face of the denormalization-vs-normalization tension covered in relational design.

### Q78. Survey the main NoSQL families (key-value, document, wide-column, graph, time-series). What access pattern is each optimized for?

The families are best understood by *what one operation is cheap*. Lump them by physical layout, not by vendor.

| Family | Data shape | Cheap operation | Weak/expensive | Examples |
|---|---|---|---|---|
| Key-value | opaque blob keyed by one key | `GET`/`PUT` by key | querying *inside* values, range scans | Redis, DynamoDB, Riak |
| Document | nested JSON/BSON per key | fetch/update a whole aggregate; secondary-index lookups | cross-document joins, multi-doc transactions (historically) | MongoDB, Couchbase |
| Wide-column | partition key → sorted sparse columns | high write throughput, range scan within a partition | ad-hoc queries on non-key columns | Cassandra, Bigtable, HBase |
| Graph | nodes + edges with pointers | multi-hop traversal ("friends of friends") | bulk aggregate scans, sharding | Neo4j, JanusGraph |
| Time-series | `(series, ts) → value`, append-only | time-window scans, downsampling, recent-data reads | random updates, deletes | InfluxDB, Timescale, Prometheus |

Key-value is a distributed hash map: O(1) by key, blind to value contents. Document stores relax that — you can index and query fields — making them the natural home for an *aggregate* (an order with its line items as one record), so you read the whole thing in one trip.

Wide-column is the one most people misread. It's a sorted, persistent map of maps: `partition key → (column key → value)`, sorted by column key within a partition. That ordering is what makes it lethal at time-series and feed-style data — you write fast (LSM) and scan a contiguous slice.

Graph stores invert the cost model: relationships are physical pointers, not runtime joins, so traversal depth is what's cheap. Time-series stores are really a specialization — append-only, timestamp-partitioned, with retention and rollups built in — that you could approximate in wide-column but get for free here.

### Q79. Explain "query-first / access-pattern-first" data modeling in NoSQL. How does it differ from relational normalization?

In the relational world you model the *domain* first: identify entities, normalize to remove redundancy (each fact lives once), and trust the query planner to recombine data with joins at read time. The schema is independent of how you'll query it; new queries are "just" new `SELECT`s.

NoSQL flips the dependency. You enumerate your queries *first* — "get a user's last 20 orders," "get an order with its items" — and then design tables/documents so each query is satisfied by a single key lookup or a single partition scan, with no join. Data gets denormalized and duplicated on purpose: the same customer name might live in five places because five access patterns need it without a second round trip.

```text
Relational:    entities → normalize → joins recombine at query time
NoSQL:         queries  → design layout so each query = 1 read, duplicate as needed
```

DynamoDB single-table design is the extreme: orders, users, and items all share one table with composite keys (`PK=USER#123`, `SK=ORDER#2024-...`) engineered so each query hits one partition. The cost is real — writes must update every copy, and a *new, unforeseen* access pattern can mean a migration or a backfill rather than a new query.

The blunt rule: relational optimizes for write-time integrity and read-time flexibility; access-pattern-first optimizes for read-time performance and scale at the expense of write complexity and query flexibility. Don't do single-table design if your access patterns are still in flux — you'll pay the migration tax repeatedly.

### Q80. When should you NOT use a relational database, and when should you NOT use NoSQL? What is the real decision criterion?

Default to relational. It's the answer until you have a concrete reason not to. The reasons to leave are specific, not vibes.

**Don't use relational when:**
- Write/scale volume exceeds what one primary node (plus replicas) can take, and the workload partitions cleanly by key — e.g. event ingestion, IoT telemetry, feeds. Wide-column scales writes horizontally; a single relational primary doesn't.
- Your data is genuinely a traversal problem — recommendation graphs, fraud rings, "shortest path." Repeated self-joins over a many-to-many table fall off a cliff with depth; a graph store stays flat.
- You need a simple, massive, latency-critical lookup — session store, cache, feature flags — where a key-value store at sub-millisecond is the point.

**Don't use NoSQL when:**
- Your access patterns are unknown or changing. NoSQL punishes you for guessing wrong; relational ad-hoc queries absorb new requirements cheaply.
- You need multi-entity transactions and referential integrity as table stakes — money, inventory, anything where a half-applied write is a bug, not a metric.
- Your data is highly relational and your queries join many entities ad hoc — reporting, admin tools, BI.

The real criterion is not "scale." It's: **does my dominant access pattern fit the storage engine's cheap operation, and can I afford the consistency model it offers?** Scale is one input. Most teams choosing NoSQL "for scale" don't have the scale, and pay the modeling and consistency tax for nothing. Pick the boring relational option until a named access pattern or a named scale wall pushes you off it.

### Q81. How do wide-column stores (Bigtable/Cassandra-style) physically organize data, and why are they good at writes and time-series?

The logical model is a sorted, sparse, multi-dimensional map: `partition key → (clustering/column key → value)`. Rows are distributed across nodes by hashing (or ordering) the partition key; *within* a partition, data is stored sorted by the clustering key. That intra-partition ordering is the whole trick.

The storage engine is an **LSM tree**, and that's why writes are fast. A write goes to a commit log plus an in-memory `memtable` — a sequential append, no in-place update, no read-before-write. When the memtable fills, it's flushed as an immutable sorted file (`SSTable`). Background compaction merges SSTables later. So write cost is roughly an append, which is why these stores absorb enormous ingest rates and scale linearly by adding nodes.

```text
write → commit log + memtable (RAM, sorted)
          │ flush
          ▼
        SSTable (immutable, sorted on disk)  ──compaction──> merged SSTables
```

Time-series fits this layout like a glove. Model the series as the partition key and the timestamp as the clustering key:

```text
PK = sensor_42
  ts=10:00:00 → 21.4
  ts=10:00:01 → 21.5      (stored physically contiguous, sorted by ts)
  ts=10:00:02 → 21.5
```

Now "give me sensor 42 from 10:00 to 11:00" is a single contiguous range scan inside one partition — sequential disk reads, no scatter-gather. Combined with append-only writes and TTL-based expiry, that's exactly the IoT/metrics/feed workload. The flip side: you must query by the partition key. Asking "which sensors read above 30°C?" — a query on the *value* — has no index and means a full scan, which is why you model these stores query-first and accept that the partition key is a near-permanent decision.

### Q82. What problems do graph databases solve that relational joins handle poorly? Explain index-free adjacency.

The workload graph databases win is *deep, variable-length traversal* over many-to-many relationships: "friends of friends of friends," "is there any path of ownership between company A and sanctioned entity B," fraud rings, recommendation paths. These are the queries that make relational engines suffer.

In a relational model a relationship is a row in a join table, and traversing it means a join. One hop is fine. But each additional hop is another self-join, and the planner must do an index lookup (typically a B-tree, O(log n)) *per node visited*, with the working set growing combinatorially. A 4–5 hop query over a large social graph turns into a stack of self-joins that the optimizer handles badly and that gets slower as the *whole table* grows — even if your local neighborhood is small.

**Index-free adjacency** is the structural fix. Each node stores direct physical references (pointers) to its adjacent edges and nodes. To walk from a node to its neighbors you dereference pointers — you don't consult a global index at all. So the cost of a hop is proportional to the *degree of the current node*, and is **independent of the total size of the graph**. A traversal across a 10-billion-node graph costs the same per hop as across a 10-thousand-node graph, as long as local fan-out is similar.

```text
Relational hop:  index lookup, O(log n) in total table size, per node
Graph hop:       pointer dereference, O(local degree), independent of graph size
```

The tradeoffs are real: graph stores are harder to shard (a graph doesn't partition cleanly — edges cross any boundary you draw), and they're not the tool for bulk aggregate scans or set-oriented analytics. Use one when the *shape* of the question is "walk the relationships," not "aggregate the rows."

### Q83. What is polyglot persistence, and what operational complexity does it add? How do you keep multiple stores consistent?

Polyglot persistence is the deliberate use of multiple data stores in one system, each chosen for the workload it serves: Postgres for transactional order data, Redis for sessions, Elasticsearch for full-text search, a graph store for recommendations, an object store for blobs. The premise is sound — no single engine is optimal for every access pattern — but it is an *operational* decision masquerading as a data-modeling one.

The complexity it adds is mostly the cost of running N systems instead of one: N sets of backups, monitoring, failover, version upgrades, security patches, and on-call expertise. More dangerously, you lose the single biggest thing a relational database gave you for free — **a transaction boundary across all your data**. The moment a write needs to land in two stores (the order in Postgres *and* the search index in Elasticsearch), you have a distributed-consistency problem, and there is no `COMMIT` that covers both.

Keeping them consistent — the patterns, worst to best:
- **Dual writes from the app** (write to A, then B): the naive default, and broken. If the process dies between writes, the stores diverge silently. Avoid.
- **Transactional outbox + CDC**: write your domain change *and* an outbox row in one local transaction in the source-of-truth database, then a separate process (or change-data-capture stream like Debezium) reads that log and propagates to the other stores. This makes the write atomic *locally* and the propagation reliable.
- **Event-driven / log as backbone**: the source of truth emits events to a durable log (Kafka), and every secondary store is a downstream consumer that rebuilds its own view. Replayable and decoupled.

The honest framing: you are trading strong consistency for **eventual consistency between stores**, and you must design for it — idempotent consumers, a clear single source of truth per piece of data, reconciliation jobs to detect drift. Don't go polyglot to use the shiny store; go polyglot when a real access pattern justifies the second system *and* you've decided who owns the truth and how the copies catch up.

---

## OLTP vs OLAP & Warehousing

### Summary

**What this topic covers** — This topic separates the two great workload families of data systems: OLTP (online transaction processing), which runs the operational business — placing orders, updating balances, recording clicks — and OLAP (online analytical processing), which answers questions about the business — revenue by region by quarter, cohort retention, funnel conversion. The split drives almost everything downstream: storage layout (row vs column), schema design (normalized vs star), indexing strategy, hardware sizing, and the entire ecosystem of warehouses, lakes, ETL/ELT pipelines, and dimensional modeling. Understanding why these workloads diverge is the foundation for choosing the right engine.

**Mental model** — Picture two opposite shapes of access. OLTP is a needle: each query touches a handful of rows by key, reads and writes many columns of those few rows, and demands millisecond latency under high concurrency with strict transactional correctness. OLAP is a dragnet: each query scans millions or billions of rows but touches only a few columns, aggregating them into a small result, tolerating seconds-to-minutes latency at low concurrency. Because OLTP reads whole rows, store rows together; because OLAP reads few columns over many rows, store columns together. From this single axis — "few rows × many columns" vs "many rows × few columns" — everything else falls out: B-tree point lookups vs sequential column scans, third-normal-form to avoid update anomalies vs denormalized stars to avoid joins, row-level locking for concurrent writers vs append-mostly immutable partitions for readers. A senior engineer doesn't memorize a feature list; they reason from the access shape to the architecture.

**Key terms**
- **OLTP** — high-concurrency, short, read/write transactions on few rows; the operational system of record.
- **OLAP** — large-scan, aggregate-heavy, mostly-read analytical queries over historical data.
- **Row store** — physical layout storing all columns of a row contiguously; optimal for whole-row access.
- **Column store** — layout storing each column's values contiguously; optimal for scanning few columns.
- **Fact table** — the central event/measurement table in a star schema (e.g., `sales`), large and append-mostly.
- **Dimension table** — descriptive context (customer, product, date) joined to facts; smaller, denormalized.
- **ETL / ELT** — Extract-Transform-Load vs Extract-Load-Transform; the order of transformation relative to landing in the warehouse.
- **Data warehouse** — schema-on-write, curated, typically columnar analytical store (Snowflake, BigQuery, Redshift).
- **Data lake** — schema-on-read raw object storage of files (Parquet/ORC on S3/HDFS).
- **Lakehouse** — table formats (Iceberg, Delta, Hudi) adding ACID + schema to lake files, blending lake and warehouse.
- **Materialized view** — a precomputed, persisted query result, refreshed on a schedule or incrementally.
- **SCD** — Slowly Changing Dimension; patterns for recording how dimension attributes change over time.

**Why interviewers ask this** — It separates engineers who treat "the database" as one undifferentiated box from those who match workload to engine. A junior reaches for Postgres for everything, then bolts analytics onto the OLTP primary and wonders why a quarterly report locks out checkout. A senior immediately asks "what's the access pattern?" and reasons about row vs column, the need for a separate analytical store, and how data flows between them. The topic also probes whether you understand *why* — not just that columnar is "faster for analytics" but that contiguous same-type values compress brutally well and feed vectorized SIMD execution. Strong candidates discuss the cost of denormalization, staleness tradeoffs in materialized views, and history-tracking in dimensions. Weak candidates conflate a data lake with a warehouse or think ELT is just "ETL but lazy."

**Common confusions**
- **"OLAP databases are just OLTP databases with more RAM."** No — the physical storage layout (column vs row) is fundamentally different; you can't tune your way across the gap.
- **"Denormalization is always bad / a beginner mistake."** In dimensional modeling it's deliberate and correct; the update-anomaly risk is low because dimensions change slowly and are batch-loaded.
- **"A data lake replaces a warehouse."** They serve different needs; lakehouses emerged precisely because raw lakes lacked transactions and governance.
- **"A materialized view auto-updates like a regular view."** It's stale until refreshed; that's the whole tradeoff.
- **"Columnar is slower for everything except aggregations."** It's genuinely bad at point lookups and single-row writes — that's why OLTP stays row-based.

**What follows from this topic** — The OLTP side connects directly to transactions, isolation levels, and concurrency control (locking, MVCC). The OLAP side connects to indexing and storage internals (B-trees, LSM-trees, compression), partitioning, and distributed query execution. The pipelines between them — CDC, ETL/ELT — lean on replication and consistency models. Dimensional modeling reaches back into relational theory (normalization) and forward into query optimization.

### Q84. Contrast OLTP and OLAP workloads across access pattern, row vs column storage, indexing, and normalization.

The whole contrast collapses to one axis: OLTP touches **few rows, many columns**; OLAP touches **many rows, few columns**. Everything else is a consequence.

| Dimension | OLTP | OLAP |
|---|---|---|
| Access pattern | Point lookups / small range by key; read+write | Full or large scans; aggregate; read-mostly |
| Query example | "fetch order #4821 and its 3 line items" | "sum revenue by region for last 4 quarters" |
| Storage layout | Row store (all columns contiguous) | Column store (each column contiguous) |
| Indexing | Many B-tree indexes for selective lookups | Few/no indexes; rely on scan + zone maps / partition pruning |
| Schema | Normalized (3NF) to avoid update anomalies | Denormalized (star schema) to avoid joins |
| Concurrency | High (thousands of small txns/sec) | Low (few large queries) |
| Latency target | Milliseconds | Seconds to minutes |
| Data volume per query | Tiny result, tiny touch | Huge touch, small result |

On **storage**: a row store keeps `(id, name, email, balance)` together, so reading one customer is a single page fetch — perfect for OLTP. A column store keeps all `balance` values together, so summing a billion balances reads only the `balance` column, skipping the rest entirely. Try to sum a column in a row store and you drag every unwanted column through cache and I/O.

On **indexing**: OLTP leans on B-tree indexes because queries are selective — you want one row out of millions, fast. OLAP scans are the opposite; an index that returns 40% of the table is worse than a sequential scan, so analytical engines lean on partition pruning and column min/max "zone maps" to skip blocks rather than secondary indexes.

On **normalization**: OLTP normalizes to 3NF because writers update single facts in one place — change a customer's email once, not in a million order rows (avoiding update anomalies). OLAP denormalizes because there are no concurrent writers to create anomalies, and joins across billion-row facts are expensive — so you bake the context into wide dimensions and load it in batch.

The senior takeaway: don't run heavy analytics on your OLTP primary. Replicate out to a columnar warehouse. The layouts are physically incompatible, not just differently tuned.

### Q85. Explain the star schema and snowflake schema. What are facts vs dimensions, and why denormalize dimensions?

A **star schema** has one central **fact table** surrounded by **dimension tables**, joined by foreign keys — drawn out, it looks like a star.

A **fact** is a measurable business event: a sale, a click, a shipment. The fact table is large, append-mostly, and holds *measures* (numeric, additive values like `amount`, `quantity`) plus foreign keys to dimensions. A **dimension** is the descriptive context you slice and filter by: who (customer), what (product), when (date), where (store). Dimensions are comparatively small and hold textual attributes (`product_category`, `customer_segment`, `day_of_week`).

```text
        dim_date
            |
dim_customer — fact_sales — dim_product
            |
        dim_store

fact_sales(date_id, customer_id, product_id, store_id, quantity, amount)
```

A typical query — "revenue by `product_category` and `month`" — joins the fact to two dimensions, groups, and sums. The fact table is narrow and numeric; the dimensions carry the human-readable labels.

A **snowflake schema** normalizes the dimensions further: instead of one wide `dim_product` carrying `category` and `category_group` as repeated text, you split into `dim_product → dim_category → dim_category_group`. It looks like a snowflake. It saves some storage and centralizes attribute edits, at the cost of more joins per query and more complexity.

**Why denormalize dimensions (prefer star)?** In OLTP, normalization prevents update anomalies — but a dimension table changes slowly and is loaded in controlled batch jobs, so the anomaly risk that justifies 3NF largely evaporates. Meanwhile every extra join in a multi-billion-row analytical query costs real time. So you accept repeated `category` strings in `dim_product` to eliminate a join. Storage is cheap; analyst query latency and SQL simplicity are not. Most modern warehouses (and especially columnar engines, where the repeated strings dictionary-compress to near nothing) favor flat star schemas; snowflaking is a niche choice for very large or shared dimensions.

### Q86. Why are columnar stores and compression so effective for analytics? Explain encoding schemes (RLE, dictionary) and vectorized execution.

Two reasons stack: columnar stores **read less** and **compress better**, and on top of that they **execute faster per byte**.

**Read less.** Analytical queries touch few columns. A column store reads only those columns' data; a row store must read entire rows and discard the unwanted columns. For `SELECT sum(amount) FROM sales` over a 50-column table, columnar reads ~1/50th of the bytes.

**Compress better.** Storing one column together means storing many values of the *same type and similar distribution* contiguously. That makes general compressors work harder and enables specialized encodings:

- **Run-length encoding (RLE)** — store a value plus its repeat count. A `country` column sorted with long runs of `"US"` becomes `("US", 1_000_000)` instead of a million strings. Murder on row stores (values are interleaved with other columns); trivial on column stores.
- **Dictionary encoding** — map each distinct value to a small integer code; store the compact integer column plus a tiny dictionary. A `status` column of `{shipped, pending, cancelled}` becomes 2-bit codes. Filters can run directly on codes (`code = 2`) without decoding strings, and joins/group-bys operate on integers.
- Others: **delta encoding** for sorted/sequential IDs and timestamps (store differences), **bit-packing** for low-cardinality integers, **frame-of-reference** for clustered numeric ranges.

```text
Raw:        US US US US UK UK FR FR FR FR
Dictionary: {US:0, UK:1, FR:2}  ->  0 0 0 0 1 1 2 2 2 2
+ RLE:      (0,4)(1,2)(2,4)
```

**Vectorized execution.** Once data is columnar and decoded into tight arrays, the engine processes values in **batches** (e.g., 1024 at a time) rather than one row at a time through an interpreter. This is the difference from the classic Volcano "one tuple per `next()` call" model: batch processing amortizes interpreter overhead, keeps the CPU pipeline full, and lets the compiler emit **SIMD** instructions that add or compare many values per cycle. Tight, same-type, cache-resident column arrays are exactly what SIMD wants.

The compound effect is large: less I/O, smaller bytes after compression, and far more work per CPU cycle. This is why ClickHouse, DuckDB, BigQuery, and Redshift crush analytical scans that would crawl on a row-oriented OLTP engine — and why those same engines are terrible at single-row inserts and point lookups, which is the OLTP domain.

### Q87. What is a materialized view, and how does it differ from a regular view? What is the refresh/staleness tradeoff?

A **regular (virtual) view** is a saved query — a named macro. It stores no data; every time you select from it, the engine inlines its definition and recomputes it against current base tables. Always fresh, but you pay the full query cost on every read.

A **materialized view** physically *stores* the precomputed result on disk. Reads hit the stored result directly — cheap and fast — but the data is a snapshot frozen at the last refresh. That's the entire tradeoff: you trade **freshness for read latency**.

| | Regular view | Materialized view |
|---|---|---|
| Stores data? | No | Yes |
| Read cost | Recompute every time | Cheap lookup |
| Freshness | Always current | Stale until refreshed |
| Write/maintenance cost | None | Refresh cost on updates |

**Refresh strategies:**

- **Full refresh** — recompute the whole result. Simple, correct, expensive; fine for small/infrequent views.
- **Incremental / fast refresh** — apply only the deltas since last refresh (using change logs). Far cheaper for large results but only works for view shapes the engine can incrementally maintain (some aggregates and joins, not arbitrary SQL).
- **On-commit / eager** — refresh synchronously when base data changes; freshest, but it taxes every write transaction. Some systems (BigQuery's materialized views, Oracle on-commit) do this; others don't allow it because of the write penalty.
- **Scheduled / lazy** — refresh on a cron or on demand; the common warehouse choice, accepting bounded staleness.

The senior framing: a materialized view is a **cache with a consistency policy**, and you must own that policy. The key question is *how stale can this result be?* A daily revenue dashboard tolerating one-hour-old numbers is a perfect fit. A balance check that must never be stale is not — use a regular view or query base tables. Watch the failure mode where heavy on-commit materialized views silently slow down the OLTP writes that feed them. In analytics, materialized views are also how engines pre-aggregate rollups (e.g., ClickHouse `AggregatingMergeTree`) so dashboards read summaries instead of rescanning raw events.

### Q88. Contrast ETL and ELT, and explain where the data lake / lakehouse / data warehouse fit. Why has ELT become more common?

Both move data from sources into an analytical store; they differ in **when transformation happens**.

- **ETL (Extract → Transform → Load):** transform data in a dedicated processing layer *before* loading it into the warehouse. The warehouse only ever sees clean, conformed data. Classic when warehouse compute was scarce and expensive.
- **ELT (Extract → Load → Transform):** dump raw data into the warehouse/lake *first*, then transform it *in place* using the warehouse's own engine (typically SQL, e.g., dbt). The warehouse does the heavy lifting.

```text
ETL:  source -> [transform engine] -> warehouse (clean only)
ELT:  source -> warehouse (raw)    -> transform in-warehouse (SQL/dbt)
```

**Where the storage tiers fit:**

- **Data warehouse** — curated, schema-on-write, usually columnar (Snowflake, BigQuery, Redshift). You define structure up front; clean, governed, query-ready.
- **Data lake** — raw files (Parquet/ORC/JSON) on cheap object storage (S3, GCS, HDFS), schema-on-read. Cheap and flexible, but historically no transactions, no schema enforcement, easy to turn into a "data swamp."
- **Lakehouse** — open table formats (Apache Iceberg, Delta Lake, Apache Hudi) layered over lake files to add ACID transactions, schema evolution, time travel, and `UPDATE`/`DELETE`. It aims to give lake economics with warehouse guarantees, queryable by engines like Spark, Trino, and the warehouses themselves.

**Why ELT won:**

1. **Cheap, elastic, decoupled compute** — cloud warehouses (especially separated storage/compute like Snowflake/BigQuery) made it cheaper to transform inside the warehouse than to run and maintain a separate ETL cluster.
2. **Keep the raw data** — landing raw data first means you can re-transform when requirements change without re-extracting from sources; the raw layer is your replayable source of truth.
3. **SQL-first tooling** — dbt made transformations versioned, tested, documented SQL that analysts own, rather than opaque ETL jobs owned by a separate engineering team.
4. **Schema-on-read flexibility** — you don't have to model everything perfectly up front; load now, model the parts you need later.

The honest caveat: ELT can dump sensitive raw data into the warehouse before it's masked/governed, and "transform later" easily becomes "never transform" — so ELT shifts the discipline burden onto modeling conventions and governance.

### Q89. What is a data mart vs warehouse vs lake, and how do slowly changing dimensions (SCD types) handle history?

**Scope and audience** distinguish the three stores:

- **Data lake** — raw, all-formats, organization-wide dumping ground on cheap object storage; broadest scope, least structure, schema-on-read.
- **Data warehouse** — integrated, cleaned, conformed data across the whole organization; schema-on-write; the curated single source of analytical truth.
- **Data mart** — a focused subset of the warehouse for one team or domain (e.g., a Finance mart or Marketing mart). Smaller scope, often a star schema tailored to that team's questions, faster and simpler for them to query.

Think of it as funnel-to-fan-out: raw lake → conformed warehouse → departmental marts. (Some shops build "bottom-up" marts first and integrate later — that's the Kimball vs Inmon debate.)

**Slowly Changing Dimensions (SCD)** address a subtle problem: dimension attributes change over time (a customer moves city; a product is recategorized), and how you record that change determines whether historical facts stay accurate. If a customer was in `London` when they bought, and you overwrite them to `Paris`, last year's sales now misattribute to Paris.

| Type | Behavior | History kept? |
|---|---|---|
| **Type 0** | Never change (e.g., original signup date) | N/A — immutable |
| **Type 1** | Overwrite in place | None — loses old value |
| **Type 2** | Add a new row with validity range; version the entity | Full history |
| **Type 3** | Add a column for `previous_value` | Limited (one prior value) |

**Type 1** overwrites — simple, but historical facts now point at current attributes, which is wrong if you care about point-in-time truth. Use only when the attribute is a correction, not a real change.

**Type 2** is the workhorse for true history. You keep multiple rows per natural key, each with a surrogate key and validity columns:

```text
cust_sk natural_id city    valid_from  valid_to    is_current
  101    C-9        London  2020-01-01  2024-06-30   false
  102    C-9        Paris   2024-07-01  9999-12-31   true
```

Facts reference the surrogate key (`cust_sk`) in effect at event time, so a 2023 sale joins to row `101` (London) forever — point-in-time correctness preserved. The cost is dimension growth and more careful ETL.

**Type 3** keeps `current_city` and `previous_city` columns — cheap, but only remembers one prior value; useful for "compare to prior org structure" reporting, not full history.

The senior instinct: ask "does this business care about as-of-then truth?" If yes, Type 2 on the affected attributes; if the change is just a correction, Type 1. You rarely make a whole dimension one type — you choose per attribute.

---

## Caching, Durability & Reliability

### Summary

**What this topic covers** — This topic sits at the boundary between the database and the systems around it: the caches that protect it from read load, and the storage stack beneath it that decides whether an acknowledged write actually survives a crash. It is where correctness meets operations. We cover the canonical caching strategies and their consistency tradeoffs, why invalidation is genuinely hard, the failure modes caches exhibit under load, what durability really means once you account for the OS page cache and disk firmware, how backups and point-in-time recovery work, and how replication and backups combine into an end-to-end reliability story. The recurring theme: every layer that makes the system faster or more available adds a window in which data can be stale, lost, or unrecoverable.

**Mental model** — Picture data as living in a tower of volatile layers, each faster and less trustworthy than the one below: application memory, a distributed cache (Redis/Memcached), the database buffer pool, the OS page cache, the disk's own write cache, and finally the persistent platters or flash cells. A write is only as durable as the lowest layer it has reached, and a read is only as fresh as the highest layer it consults. Caching pushes hot data up the tower for speed; durability pushes critical writes down the tower for safety. The senior engineer never says "it's saved" — they ask "saved where, and what survives a power cut at this exact instant?" Likewise they never trust a cache to be correct, only to be probably-correct-and-cheap, with the database as the source of truth. Reliability is reasoning about the windows between these layers: the milliseconds where a write lives only in a volatile buffer, or where a cache entry contradicts the row it shadows.

**Key terms**
- **Cache-aside (lazy loading)** — app checks cache, on miss reads DB and populates cache itself.
- **Read-through / write-through** — the cache layer itself loads from / writes to the DB synchronously.
- **Write-back (write-behind)** — writes hit cache and are flushed to DB asynchronously; fast but loss-prone.
- **Write-around** — writes go straight to the DB, bypassing the cache, populated only on later reads.
- **TTL** — time-to-live; an entry's expiry, the crudest form of invalidation.
- **fsync** — syscall forcing buffered data from the OS page cache to the storage device.
- **WAL** — write-ahead log; durable record of changes written before the data pages.
- **RPO** — Recovery Point Objective; maximum acceptable data loss, measured in time.
- **RTO** — Recovery Time Objective; maximum acceptable downtime to restore service.
- **PITR** — point-in-time recovery; restoring to an arbitrary past instant via base backup + log replay.
- **Thundering herd** — many clients simultaneously rebuilding the same expired/missing entry.
- **Cache penetration** — repeated misses for keys that don't exist in the DB at all.

**Why interviewers ask this** — These questions separate engineers who have only built happy-path systems from those who have been paged at 3am. A junior describes cache-aside and stops; a senior immediately raises the invalidation race between the DB write and the cache delete, and reaches for cache-aside-with-delete over update. A junior thinks calling `write()` or even closing the connection means data is safe; a senior knows the write may still sit in the OS page cache or a disk's volatile DRAM buffer until `fsync` returns and write barriers are honored. A junior conflates backups with replication; a senior explains that a replica faithfully copies a `DROP TABLE` while a backup is the only thing that undoes it. The signal interviewers want is whether you reason about *windows of vulnerability* and *failure modes*, quantify them with RPO/RTO, and pick mitigations with explicit tradeoffs rather than reciting a glossary.

**Common confusions**
- **"Replication is a backup."** Replication copies corruption and deletes too; it protects availability, not against logical errors.
- **"The write returned, so it's durable."** It may only be in the OS page cache or the disk's volatile buffer until `fsync` completes.
- **"Higher cache TTL just means more staleness."** It also changes herd/stampede dynamics and DB load on expiry.
- **"Write-back is just a faster write-through."** Write-back can lose acknowledged writes on cache failure; the durability semantics differ fundamentally.
- **"fsync guarantees durability."** Only if the device honors write barriers / flushes its own cache; lying disks and misconfigured volatile caches break this.

**What follows from this topic** — Durability connects directly to the **WAL and recovery** machinery that ACID's D rests on, and to **replication and consensus**, where a write's durability is redefined as "acknowledged by a quorum." Caching consistency is a special case of the broader **distributed consistency** spectrum — a cache is just an eventually-consistent read replica with no replication protocol. RPO/RTO targets feed back into choices about synchronous vs asynchronous replication and the CAP tradeoffs you accept under partition.

### Q90. Explain the main caching strategies (cache-aside, read-through, write-through, write-back, write-around) and their tradeoffs.

These five strategies split along two axes: how reads populate the cache, and how writes propagate to it.

**Read paths.** *Cache-aside* (lazy loading) puts the application in control: check cache, on miss read the DB and write the result back yourself. It's the default for a reason — only requested data is cached, and a cache outage degrades gracefully to "slower" rather than "broken." *Read-through* moves that logic into the cache layer (or a library in front of it); the app just asks the cache, which loads from the DB on miss. Cleaner app code, but you've coupled to a cache that knows how to query your DB.

**Write paths.** *Write-through* writes to cache and DB synchronously on every write — the cache is always fresh, but you pay DB latency on the write path and cache space on data that may never be read. *Write-back* (write-behind) acknowledges the write after hitting the cache and flushes to the DB asynchronously; it absorbs write bursts and coalesces updates, but a cache node failure loses acknowledged writes — unacceptable for orders or payments, fine for view counters. *Write-around* sends writes straight to the DB and lets the cache populate on the next read, avoiding cache churn from write-heavy keys that are rarely read.

| Strategy | Cache freshness | Write latency | Failure exposure | Best for |
|---|---|---|---|---|
| Cache-aside | Stale until invalidated | DB-only | Graceful degradation | General read-heavy |
| Read-through | Same as aside | DB-only | Cache is critical path | Clean abstractions |
| Write-through | Always fresh | Cache + DB | Safe | Read-after-write heavy |
| Write-back | Always fresh | Cache-only | Data loss on crash | High-throughput, loss-tolerant |
| Write-around | Stale until read | DB-only | Safe | Write-heavy, rarely-read |

In practice most systems run **cache-aside for reads paired with write-around or invalidate-on-write**, because it keeps the DB as the unambiguous source of truth and the cache as a disposable accelerator. Reach for write-back only when you can tolerate losing the most recent writes.

### Q91. Why is cache invalidation hard? Explain the staleness vs consistency tradeoff and patterns to keep cache and DB in sync.

Invalidation is hard because the cache and DB are two independent stores updated by non-atomic operations, so any interleaving that updates one but not the other leaves them inconsistent — and there is no transaction spanning both.

The classic race, with *update-the-cache* on write:

```text
T1 reads DB (old value v1)
            T2 writes DB v2, sets cache = v2
T1 sets cache = v1   <-- stale write wins; cache stuck at v1
```

The standard mitigation is **cache-aside with delete, not update**: on write, update the DB then *delete* the key, so the next read repopulates from the DB. Deletion is idempotent and order-tolerant in a way that "set to my value" is not. But even delete has a race: a reader can load the old value and repopulate the cache *after* a concurrent writer's delete. Bounding the damage is what TTLs are for — they cap staleness even when invalidation is missed entirely.

For stronger guarantees, decouple invalidation from the write path entirely with **change-data-capture**: tail the DB's replication log (Debezium on the WAL/binlog) and invalidate cache keys from that stream. The cache now lags the DB but never contradicts a *committed* state, and you've eliminated dual-write inconsistency because there's a single source of ordering — the log.

The fundamental tradeoff is **staleness vs cost/consistency**: a longer TTL means cheaper DB load but more stale reads; synchronous write-through means fresh reads but you pay on every write and re-introduce the dual-write problem. There is no free lunch — you pick where on the spectrum your domain tolerates being. A product catalog tolerates minutes of staleness; an account balance tolerates none, so you don't cache it, or you cache it with explicit versioning and read-your-writes routing.

### Q92. What are the failure modes of caching at scale: thundering herd, cache stampede, and cache penetration? How do you mitigate each?

All three are about what happens to the *database* when the cache stops absorbing load — the cache's whole job is to shield the DB, and these are the moments it fails to.

**Thundering herd / cache stampede.** A hot key expires (or the cache restarts cold) and thousands of concurrent requests all miss simultaneously, stampeding the DB to recompute the same value. The fix is to ensure only *one* recomputation happens: take a per-key lock or use a single-flight pattern so one request rebuilds while the others wait or briefly serve stale.

```text
miss -> acquire lock(key) ? recompute + set : wait/serve-stale
```

Two more mitigations stack on top: **early/probabilistic expiration**, where an entry is refreshed slightly before its TTL with a randomized jitter so expiries don't synchronize; and **TTL jitter** generally, so a batch of keys written together don't all expire in the same instant. Some systems serve the stale value while a background job refreshes ("stale-while-revalidate").

**Cache penetration.** Requests for keys that *don't exist in the DB* always miss the cache and always hit the DB — a cheap way for an attacker (or a buggy client) to bypass the cache entirely. Mitigate by **caching the negative result** (store a "not found" sentinel with a short TTL) and by fronting the cache with a **Bloom filter** of known-existing keys to reject lookups for keys that definitely don't exist before they touch the DB.

| Failure | Trigger | Primary mitigation |
|---|---|---|
| Thundering herd | Hot key expiry / cold cache | Single-flight lock, serve-stale |
| Cache stampede | Synchronized mass expiry | TTL jitter, early probabilistic refresh |
| Cache penetration | Lookups for non-existent keys | Negative caching, Bloom filter |

The meta-lesson: a cache changes your DB's load *shape*, not just its magnitude. Sizing the DB for steady-state cached load and forgetting the cold-start or mass-expiry spike is how teams take an outage the moment they restart the cache fleet.

### Q93. Explain durability guarantees in depth: fsync, the OS page cache, write barriers, and why "the write returned" is not "it is on disk".

When your code calls `write()`, the kernel copies the bytes into the **OS page cache** and returns immediately. The data is now in volatile RAM, marked dirty, and will be flushed to the device *eventually* by the kernel's writeback threads. If the machine loses power in that window, the write is gone even though `write()` returned success. This is the gap that bites people: "the write returned" only means "the kernel accepted it into RAM."

`fsync(fd)` is the syscall that closes the gap: it blocks until the page cache's dirty pages for that file (and, with `fdatasync`, the data but not all metadata) have been handed to the storage device *and the device acknowledges them durable*. This is why every serious database `fsync`s its **WAL** on commit — the commit is durable once the log record is on disk, which is far cheaper than flushing the scattered data pages. The data pages can be written lazily because recovery replays the log.

But there's a layer below the OS: the **disk's own write cache**, a volatile DRAM buffer on the drive. A drive can acknowledge a write the instant it lands in that buffer, before it's on platters or flash. **Write barriers** (and cache-flush commands like ATA `FLUSH CACHE` / SCSI `SYNCHRONIZE CACHE`, which `fsync` triggers) force the device to actually persist and not reorder across the barrier. Historically some consumer drives *lied* — ignoring flush commands to win benchmarks — which silently broke durability. RAID controllers with battery-backed write cache are trusted to honor the ack because the battery makes their cache effectively non-volatile.

```text
write()        -> OS page cache (RAM, volatile)
fsync()        -> device write cache (DRAM on drive, volatile)
flush barrier  -> platters / flash (non-volatile)  <- only now durable
```

The senior takeaway: durability is a *property of the lowest layer the data has reached*, and every layer above can lie or lose. When you configure a DB's `synchronous_commit`, `innodb_flush_log_at_trx_commit`, or fsync-on-commit setting, you are explicitly choosing how far down the tower each commit must travel before you call it durable — trading latency for safety. Turning fsync off makes commits fast and turns a power loss into data loss.

### Q94. How do backups and point-in-time recovery (PITR) work (full + incremental + WAL archiving)? What are RPO and RTO?

Backups come in layers that compose. A **full backup** is a complete, consistent snapshot of the data files at one instant (e.g. `pg_basebackup`, a filesystem/volume snapshot, or `mysqldump` for a logical copy). **Incremental/differential backups** capture only blocks changed since the last full (or last incremental), shrinking backup size and window at the cost of a longer restore chain. On their own these only let you restore to the discrete instants you happened to take a backup.

**PITR** adds the missing dimension — *arbitrary* recovery points — by combining a base backup with **continuous WAL/redo log archiving**. You take a periodic full backup and then ship every WAL segment to durable storage as it fills. To recover, you restore the most recent base backup and **replay the archived logs forward** up to any chosen timestamp or transaction — crucially, you can stop *just before* a disastrous `DELETE` or migration.

```text
[full backup @ 02:00] --- WAL --- WAL --- WAL --->  replay to 14:37:12
                                          ^ stop here, just before the bad DELETE at 14:37:15
```

Two metrics quantify how good your scheme is:

| Metric | Question it answers | Driven by |
|---|---|---|
| **RPO** (Recovery Point Objective) | How much data can we afford to lose? | Backup/WAL-archive frequency |
| **RTO** (Recovery Time Objective) | How long can we be down? | Restore + replay speed |

If you archive WAL every 5 minutes, your worst-case RPO is ~5 minutes of transactions; continuous streaming archiving pushes RPO toward seconds. RTO is dominated by restore time — replaying a week of WAL onto an old base backup can take hours, which is why teams take *frequent* base backups: it bounds how much log must be replayed. **Always test restores.** An untested backup is a hypothesis, not a guarantee — silent corruption, missing WAL segments, or an unrestorable snapshot are discovered only when you actually rehearse recovery.

### Q95. How do you reason about reliability end to end: replication for availability vs backups for durability — why do you need both?

Because they defend against *different classes of failure*, and neither covers the other's gap.

**Replication protects availability against infrastructure failure.** When a primary's disk dies or its datacenter loses power, a replica that has been continuously copying writes can take over in seconds. But replication is *faithful* — it copies every committed change, including the ones you wish you hadn't made. A `DROP TABLE users`, an `UPDATE` with a forgotten `WHERE`, or a corrupt page propagates to every synchronous replica almost instantly. Replication has no concept of "undo." So replication answers "the node died" but not "we destroyed the data."

**Backups protect durability against logical and human failure.** A point-in-time backup lets you recover to *before* the bad change — it's the only thing that does. But restoring a backup is slow (minutes to hours of RTO) and loses everything since the last recoverable point (RPO), so it's a terrible availability story.

| Failure class | Replication | Backups |
|---|---|---|
| Node / disk / AZ failure | ✅ fast failover | ⚠️ slow restore |
| Datacenter outage | ✅ cross-region replica | ⚠️ slow |
| `DROP TABLE` / bad migration | ❌ replicates the damage | ✅ PITR to just before |
| Data corruption / bit rot | ❌ may propagate | ✅ restore clean copy |
| Ransomware / malicious delete | ❌ | ✅ if backups are isolated |

The end-to-end mental model is **defense in depth across orthogonal axes**: replication for *availability* (RTO near zero for hardware faults), backups + PITR for *durability* (recovering from logical disasters), and ideally a third axis of **isolation** — offsite, immutable, separately-credentialed backups, because ransomware and compromised admin credentials will happily delete your live replicas *and* any backups they can reach. A reliable system isn't the one with the most replicas; it's the one where you've enumerated each failure class, assigned an explicit RPO/RTO to each, chosen the mechanism that covers it, and *rehearsed* the recovery. The failure mode I've seen most often in real incidents is a team with five replicas and zero tested backups discovering, mid-incident, that "highly available" and "recoverable" were never the same thing.
