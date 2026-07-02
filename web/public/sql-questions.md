---
type: sql-practice
---

# SQL Questions

A single graded set of SQL problems — LeetCode-50 + Hard tier through the Senior+ tier — each with the Problem, the Pattern, an Explanation, and a Solution. 137 questions.

## Aggregation & Counting

### 1. Big Countries

#### Problem

Given a `world` table of countries with area and population, return the countries that qualify as "big" — either at least 3,000,000 km² in area or at least 25,000,000 in population. Output the name, population, and area.

**Schema:**

```
world
  name        varchar  PRIMARY KEY
  continent   varchar
  area        integer
  population  bigint
  gdp         bigint
```

**Expected output (sample):**

| name        | population  | area     |
|-------------|-------------|----------|
| Afghanistan | 25500100    | 652230   |
| Algeria     | 37100000    | 2381741  |

#### Pattern

Simple filter with OR.

#### Explanation

Trivial filter. The only thing worth saying: prefer `OR` here over `UNION` of two queries — the planner can use a single sequential scan with a disjunctive predicate, and you avoid materialising and de-duplicating two result sets.

#### Solution

```sql
SELECT name, population, area
FROM world
WHERE area >= 3000000
   OR population >= 25000000;
```

*Source: LeetCode #595 — Big Countries*

---

### 2. Recyclable and Low Fat Products

#### Problem

From a `products` table with `low_fats` and `recyclable` flags (each `'Y'` or `'N'`), return the IDs of products that are both low-fat and recyclable.

**Schema:**

```
products
  product_id  integer  PRIMARY KEY
  low_fats    char(1)  CHECK (low_fats IN ('Y','N'))
  recyclable  char(1)  CHECK (recyclable IN ('Y','N'))
```

**Expected output (sample):**

| product_id |
|------------|
| 1          |
| 3          |

#### Pattern

Compound boolean filter.

#### Explanation

A single-pass `WHERE` with two `=` predicates. If this table were enormous, a partial expression index on `(low_fats, recyclable) WHERE low_fats='Y' AND recyclable='Y'` would matter; in practice it doesn't.

#### Solution

```sql
SELECT product_id
FROM products
WHERE low_fats = 'Y' AND recyclable = 'Y';
```

*Source: LeetCode #1757 — Recyclable and Low Fat Products*

---

### 3. Number of Unique Subjects Taught by Each Teacher

#### Problem

Given `teacher(teacher_id, subject_id, dept_id)`, return for each teacher the count of distinct subjects they teach. Note: the same subject taught in two departments counts once.

**Schema:**

```
teacher
  teacher_id  integer
  subject_id  integer
  dept_id     integer
  PRIMARY KEY (subject_id, dept_id)
```

**Expected output (sample):**

| teacher_id | cnt |
|------------|-----|
| 1          | 2   |
| 2          | 4   |

#### Pattern

`COUNT(DISTINCT ...)` with `GROUP BY`.

#### Explanation

`COUNT(DISTINCT subject_id)` per teacher — the natural fit. Faster than `GROUP BY teacher_id, subject_id` followed by an outer count, and reads better.

#### Solution

```sql
SELECT teacher_id, COUNT(DISTINCT subject_id) AS cnt
FROM teacher
GROUP BY teacher_id;
```

*Source: LeetCode #2356 — Number of Unique Subjects Taught by Each Teacher*

---

### 4. Find Followers Count

#### Problem

Given a `followers(user_id, follower_id)` table, return each user's follower count, sorted by `user_id` ascending.

**Schema:**

```
followers
  user_id      integer
  follower_id  integer
  PRIMARY KEY (user_id, follower_id)
```

**Expected output (sample):**

| user_id | followers_count |
|---------|-----------------|
| 0       | 2               |
| 1       | 1               |
| 2       | 1               |

#### Pattern

`GROUP BY` + `COUNT(*)`.

#### Explanation

The PK guarantees `(user_id, follower_id)` is unique, so `COUNT(*)` is sufficient — no need for `COUNT(DISTINCT)`. Knowing your constraints lets you skip needless work.

#### Solution

```sql
SELECT user_id, COUNT(*) AS followers_count
FROM followers
GROUP BY user_id
ORDER BY user_id;
```

*Source: LeetCode #1729 — Find Followers Count*

---

### 5. Classes More Than 5 Students

#### Problem

From a `courses(student, class)` table, return the names of classes that have at least 5 students.

**Schema:**

```
courses
  student  varchar
  class    varchar
  PRIMARY KEY (student, class)
```

**Expected output (sample):**

| class    |
|----------|
| Math     |

#### Pattern

`GROUP BY` + `HAVING`.

#### Explanation

`HAVING` filters groups after aggregation. The PK already guarantees student uniqueness per class, so `COUNT(*)` is fine — no `DISTINCT` needed.

#### Solution

```sql
SELECT class
FROM courses
GROUP BY class
HAVING COUNT(*) >= 5;
```

*Source: LeetCode #596 — Classes More Than 5 Students*

---

### 6. Confirmation Rate

#### Problem

Given `signups(user_id, time_stamp)` and `confirmations(user_id, time_stamp, action)` where `action` is `'confirmed'` or `'timeout'`, return each signed-up user's confirmation rate (confirmed / total messages), rounded to two decimals. Users with no messages get rate 0.00.

**Schema:**

```
signups
  user_id     integer  PRIMARY KEY
  time_stamp  timestamp

confirmations
  user_id     integer  FK → signups
  time_stamp  timestamp
  action      varchar  CHECK (action IN ('confirmed','timeout'))
  PRIMARY KEY (user_id, time_stamp)
```

**Expected output (sample):**

| user_id | confirmation_rate |
|---------|-------------------|
| 6       | 0.00              |
| 3       | 0.00              |
| 7       | 1.00              |
| 2       | 0.50              |

#### Pattern

`LEFT JOIN` + conditional aggregation.

#### Explanation

The classic "rate of X out of total" — express the numerator as `AVG((action='confirmed')::int)`. Postgres handles the bool→int cast cleanly; in MySQL you'd write `AVG(action = 'confirmed')`. `LEFT JOIN` plus `COALESCE`/grouping keeps users with no messages.

#### Solution

```sql
SELECT s.user_id,
       ROUND(COALESCE(AVG((c.action = 'confirmed')::int)::numeric, 0), 2) AS confirmation_rate
FROM signups s
LEFT JOIN confirmations c USING (user_id)
GROUP BY s.user_id;
```

*Source: LeetCode #1934 — Confirmation Rate*

---

### 7. Queries Quality and Percentage

#### Problem

From a `queries(query_name, result, position, rating)` table, for each query name return the quality (average of `rating / position`) and the poor-query percentage (rating < 3), both rounded to two decimals.

**Schema:**

```
queries
  query_name  varchar
  result      varchar
  position    integer
  rating      integer
```

**Expected output (sample):**

| query_name | quality | poor_query_percentage |
|------------|---------|-----------------------|
| Dog        | 2.50    | 0.00                  |
| Cat        | 0.66    | 33.33                 |

#### Pattern

Conditional aggregation with `AVG`.

#### Explanation

Two derived metrics in one pass. Cast to `numeric` before dividing — integer division would zero out fractional ratings. The poor-query percentage is `100 * AVG((rating < 3)::int)`.

#### Solution

```sql
SELECT query_name,
       ROUND(AVG(rating::numeric / position), 2)            AS quality,
       ROUND(100 * AVG((rating < 3)::int)::numeric, 2)      AS poor_query_percentage
FROM queries
WHERE query_name IS NOT NULL
GROUP BY query_name;
```

*Source: LeetCode #1211 — Queries Quality and Percentage*

---

### 8. Monthly Transactions I

#### Problem

For each (month, country) pair in `transactions`, return the total transaction count, the count of approved transactions, the total amount, and the approved amount. Month format `YYYY-MM`.

**Schema:**

```
transactions
  id        integer  PRIMARY KEY
  country   varchar
  state     varchar  CHECK (state IN ('approved','declined'))
  amount    integer
  trans_date date
```

**Expected output (sample):**

| month   | country | trans_count | approved_count | trans_total_amount | approved_total_amount |
|---------|---------|-------------|----------------|--------------------|-----------------------|
| 2018-12 | US      | 2           | 1              | 3000               | 1000                  |
| 2019-01 | US      | 1           | 1              | 2000               | 2000                  |

#### Pattern

`GROUP BY` on a derived month + conditional sums.

#### Explanation

`TO_CHAR(trans_date, 'YYYY-MM')` gives the month bucket. Conditional `SUM(CASE WHEN ...)` and `COUNT(... FILTER (WHERE ...))` are equivalent; `FILTER` reads better and is standard SQL.

#### Solution

```sql
SELECT TO_CHAR(trans_date, 'YYYY-MM')                    AS month,
       country,
       COUNT(*)                                          AS trans_count,
       COUNT(*) FILTER (WHERE state = 'approved')        AS approved_count,
       SUM(amount)                                       AS trans_total_amount,
       SUM(amount) FILTER (WHERE state = 'approved')     AS approved_total_amount
FROM transactions
GROUP BY 1, country;
```

*Source: LeetCode #1193 — Monthly Transactions I*

---

### 9. Average Time of Process per Machine

#### Problem

Given `activity(machine_id, process_id, activity_type, timestamp)` where `activity_type` is `'start'` or `'end'`, compute the average processing time (end − start) per machine, rounded to three decimals.

**Schema:**

```
activity
  machine_id     integer
  process_id     integer
  activity_type  varchar  CHECK (activity_type IN ('start','end'))
  timestamp      float
  PRIMARY KEY (machine_id, process_id, activity_type)
```

**Expected output (sample):**

| machine_id | processing_time |
|------------|-----------------|
| 0          | 0.712           |
| 1          | 1.103           |
| 2          | 4.456           |

#### Pattern

Self-join on `(machine_id, process_id)` or conditional aggregation.

#### Explanation

A self-join works but is wasteful — two passes plus a join. Cleaner: aggregate in one pass with `SUM(... FILTER ...)`. For each machine, average the (end − start) deltas per process.

#### Solution

```sql
SELECT machine_id,
       ROUND(
         AVG(end_ts - start_ts)::numeric,
         3
       ) AS processing_time
FROM (
  SELECT machine_id,
         process_id,
         MAX(timestamp) FILTER (WHERE activity_type = 'end')   AS end_ts,
         MAX(timestamp) FILTER (WHERE activity_type = 'start') AS start_ts
  FROM activity
  GROUP BY machine_id, process_id
) t
GROUP BY machine_id;
```

*Source: LeetCode #1661 — Average Time of Process per Machine*

---

### 10. Number of Employees Which Report to Each Employee

#### Problem

From an `employees(employee_id, name, reports_to, age)` table, for each manager who has at least one direct report return their id, name, the count of direct reports, and the average reportee age rounded to the nearest integer. Sort by `employee_id`.

**Schema:**

```
employees
  employee_id  integer  PRIMARY KEY
  name         varchar
  reports_to   integer  FK → employees(employee_id)
  age          integer
```

**Expected output (sample):**

| employee_id | name  | reports_count | average_age |
|-------------|-------|---------------|-------------|
| 1           | Alice | 1             | 31          |
| 2           | Bob   | 2             | 26          |

#### Pattern

Self-join on `reports_to = employee_id` + aggregation.

#### Explanation

Standard inner self-join: managers on the left, reports on the right. Inner join automatically drops managers with no reports. `ROUND(AVG(age))` for the integer rounding — note Postgres rounds halves away from zero, MySQL banker's-rounds.

#### Solution

```sql
SELECT m.employee_id,
       m.name,
       COUNT(*)              AS reports_count,
       ROUND(AVG(r.age))::int AS average_age
FROM employees m
JOIN employees r ON r.reports_to = m.employee_id
GROUP BY m.employee_id, m.name
ORDER BY m.employee_id;
```

*Source: LeetCode #1731 — The Number of Employees Which Report to Each Employee*

---

## Joins

### 11. Replace Employee ID with the Unique Identifier

#### Problem

Given `employees(id, name)` and `employee_uni(id, unique_id)`, return each employee's `unique_id` and `name`. If no unique id exists, show `NULL`.

**Schema:**

```
employees
  id    integer  PRIMARY KEY
  name  varchar

employee_uni
  id          integer  FK → employees(id)
  unique_id   integer
  PRIMARY KEY (id, unique_id)
```

**Expected output (sample):**

| unique_id | name     |
|-----------|----------|
| NULL      | Alice    |
| NULL      | Bob      |
| 3         | Meir     |

#### Pattern

`LEFT JOIN`.

#### Explanation

A clean left-join with employees on the left so unmatched rows are preserved. Order of tables matters semantically — left table is the "anchor" you must keep.

#### Solution

```sql
SELECT eu.unique_id, e.name
FROM employees e
LEFT JOIN employee_uni eu ON eu.id = e.id;
```

*Source: LeetCode #1378 — Replace Employee ID with the Unique Identifier*

---

### 12. Product Sales Analysis I

#### Problem

Given `sales(sale_id, product_id, year, quantity, price)` and `product(product_id, product_name)`, return for each sale the `product_name`, `year`, and `price`.

**Schema:**

```
sales
  sale_id     integer
  product_id  integer  FK → product
  year        integer
  quantity    integer
  price       integer
  PRIMARY KEY (sale_id, year)

product
  product_id    integer  PRIMARY KEY
  product_name  varchar
```

**Expected output (sample):**

| product_name | year | price |
|--------------|------|-------|
| LCPHONE      | 2018 | 5000  |
| LCPHONE      | 2019 | 5000  |

#### Pattern

Inner join.

#### Explanation

A no-frills join. `USING (product_id)` works because the column name is shared and you avoid the qualifier salad.

#### Solution

```sql
SELECT p.product_name, s.year, s.price
FROM sales s
JOIN product p USING (product_id);
```

*Source: LeetCode #1068 — Product Sales Analysis I*

---

### 13. Customer Who Visited but Did Not Make Any Transactions

#### Problem

Given `visits(visit_id, customer_id)` and `transactions(transaction_id, visit_id, amount)`, return each customer who has at least one visit with zero transactions, along with the count of such visits.

**Schema:**

```
visits
  visit_id     integer  PRIMARY KEY
  customer_id  integer

transactions
  transaction_id  integer  PRIMARY KEY
  visit_id        integer  FK → visits
  amount          integer
```

**Expected output (sample):**

| customer_id | count_no_trans |
|-------------|----------------|
| 54          | 2              |
| 30          | 1              |
| 96          | 1              |

#### Pattern

Anti-join via `LEFT JOIN ... IS NULL`.

#### Explanation

Two equivalent shapes: `LEFT JOIN transactions WHERE transaction_id IS NULL` or `WHERE NOT EXISTS (...)`. Both produce the same plan in Postgres (anti-join). I prefer `NOT EXISTS` for the intent; `LEFT JOIN ... IS NULL` is fine when you also want columns from the right side.

#### Solution

```sql
SELECT v.customer_id, COUNT(*) AS count_no_trans
FROM visits v
LEFT JOIN transactions t ON t.visit_id = v.visit_id
WHERE t.transaction_id IS NULL
GROUP BY v.customer_id;
```

*Source: LeetCode #1581 — Customer Who Visited but Did Not Make Any Transactions*

---

### 14. Students and Examinations

#### Problem

Given `students(student_id, student_name)`, `subjects(subject_name)`, and `examinations(student_id, subject_name)`, return every (student, subject) pair with the attendance count (zero allowed). Order by `student_id`, then `subject_name`.

**Schema:**

```
students
  student_id    integer  PRIMARY KEY
  student_name  varchar

subjects
  subject_name  varchar  PRIMARY KEY

examinations
  student_id    integer  FK → students
  subject_name  varchar  FK → subjects
```

**Expected output (sample):**

| student_id | student_name | subject_name | attended_exams |
|------------|--------------|--------------|----------------|
| 1          | Alice        | Math         | 3              |
| 1          | Alice        | Physics      | 2              |
| 1          | Alice        | Programming  | 1              |

#### Pattern

`CROSS JOIN` (Cartesian) + `LEFT JOIN`.

#### Explanation

Generate every (student, subject) pair via `CROSS JOIN`, then `LEFT JOIN` the exam history to count attendances. The cartesian product is the only honest way to materialise pairs that may have zero attendances.

#### Solution

```sql
SELECT st.student_id,
       st.student_name,
       su.subject_name,
       COUNT(e.student_id) AS attended_exams
FROM students st
CROSS JOIN subjects su
LEFT JOIN examinations e
       ON e.student_id   = st.student_id
      AND e.subject_name = su.subject_name
GROUP BY st.student_id, st.student_name, su.subject_name
ORDER BY st.student_id, su.subject_name;
```

*Source: LeetCode #1280 — Students and Examinations*

---

### 15. Managers with At Least 5 Direct Reports

#### Problem

From `employees(id, name, department, managerId)`, return the names of managers who have at least five direct reports.

**Schema:**

```
employees
  id          integer  PRIMARY KEY
  name        varchar
  department  varchar
  manager_id  integer  FK → employees(id)
```

**Expected output (sample):**

| name |
|------|
| John |

#### Pattern

Self-join + `HAVING COUNT(*) >= 5`.

#### Explanation

The pattern: aggregate the report side, threshold with `HAVING`, then join to the manager side for the name. You can do this in one statement with a self-join + group by; either way is fine.

#### Solution

```sql
SELECT e.name
FROM employees e
JOIN employees r ON r.manager_id = e.id
GROUP BY e.id, e.name
HAVING COUNT(*) >= 5;
```

*Source: LeetCode #570 — Managers with at Least 5 Direct Reports*

---

### 16. Employee Bonus

#### Problem

Given `employee(empId, name, supervisor, salary)` and `bonus(empId, bonus)`, return name and bonus for every employee whose bonus is less than 1000 or has no bonus row.

**Schema:**

```
employee
  emp_id     integer  PRIMARY KEY
  name       varchar
  supervisor integer
  salary     integer

bonus
  emp_id  integer  FK → employee
  bonus   integer
```

**Expected output (sample):**

| name   | bonus |
|--------|-------|
| Brad   | NULL  |
| John   | NULL  |
| Dan    | 500   |

#### Pattern

`LEFT JOIN` + `WHERE` on NULL-permitting predicate.

#### Explanation

Watch the NULL semantics: `bonus < 1000` is FALSE when bonus is NULL, so you must add `OR bonus IS NULL`. This is the kind of off-by-one that bites in interviews.

#### Solution

```sql
SELECT e.name, b.bonus
FROM employee e
LEFT JOIN bonus b USING (emp_id)
WHERE b.bonus < 1000 OR b.bonus IS NULL;
```

*Source: LeetCode #577 — Employee Bonus*

---

### 17. Article Views I

#### Problem

Given `views(article_id, author_id, viewer_id, view_date)`, return the distinct ids of authors who have viewed at least one of their own articles, sorted ascending.

**Schema:**

```
views
  article_id  integer
  author_id   integer
  viewer_id   integer
  view_date   date
```

**Expected output (sample):**

| id |
|----|
| 4  |
| 7  |

#### Pattern

Self-equality filter + `DISTINCT`.

#### Explanation

No join needed — the predicate is on the same row. `DISTINCT` because an author can view many of their own articles.

#### Solution

```sql
SELECT DISTINCT author_id AS id
FROM views
WHERE author_id = viewer_id
ORDER BY id;
```

*Source: LeetCode #1148 — Article Views I*

---

### 18. Find Customer Referee

#### Problem

From `customer(id, name, referee_id)`, return the names of customers whose `referee_id` is not 2 (including those with no referee).

**Schema:**

```
customer
  id          integer  PRIMARY KEY
  name        varchar
  referee_id  integer
```

**Expected output (sample):**

| name |
|------|
| Will |
| Jane |
| Bill |
| Zack |

#### Pattern

NULL-safe inequality.

#### Explanation

`referee_id != 2` returns UNKNOWN for NULLs, which are then dropped. To keep them: `referee_id IS DISTINCT FROM 2` (Postgres-native, NULL-safe) or `referee_id != 2 OR referee_id IS NULL`.

#### Solution

```sql
SELECT name
FROM customer
WHERE referee_id IS DISTINCT FROM 2;
```

*Source: LeetCode #584 — Find Customer Referee*

---

### 19. Project Employees I

#### Problem

Given `project(project_id, employee_id)` and `employee(employee_id, name, experience_years)`, return each project's average employee experience years rounded to two decimals.

**Schema:**

```
project
  project_id   integer
  employee_id  integer  FK → employee
  PRIMARY KEY (project_id, employee_id)

employee
  employee_id       integer  PRIMARY KEY
  name              varchar
  experience_years  integer
```

**Expected output (sample):**

| project_id | average_years |
|------------|---------------|
| 1          | 2.00          |
| 2          | 2.50          |

#### Pattern

Join + `AVG` per group.

#### Explanation

Straightforward — join, group, average. Cast to `numeric` before rounding to avoid integer division surprises.

#### Solution

```sql
SELECT p.project_id,
       ROUND(AVG(e.experience_years)::numeric, 2) AS average_years
FROM project p
JOIN employee e USING (employee_id)
GROUP BY p.project_id;
```

*Source: LeetCode #1075 — Project Employees I*

---

### 20. Sales Person

#### Problem

Given `salesperson(sales_id, name, ...)`, `company(com_id, name, ...)`, and `orders(order_id, order_date, com_id, sales_id, amount)`, return the names of salespeople who have **never** placed an order with the company named "RED".

**Schema:**

```
salesperson
  sales_id  integer  PRIMARY KEY
  name      varchar

company
  com_id  integer  PRIMARY KEY
  name    varchar

orders
  order_id    integer  PRIMARY KEY
  order_date  date
  com_id      integer  FK → company
  sales_id    integer  FK → salesperson
  amount      integer
```

**Expected output (sample):**

| name |
|------|
| Abe  |
| Pat  |

#### Pattern

Anti-join via `NOT IN` / `NOT EXISTS`.

#### Explanation

`NOT IN` is fine here only if the inner subquery cannot return NULLs (if it can, the whole predicate becomes UNKNOWN and you get zero rows). `NOT EXISTS` is NULL-safe and reads better — use that as your default.

#### Solution

```sql
SELECT name
FROM salesperson sp
WHERE NOT EXISTS (
  SELECT 1
  FROM orders o
  JOIN company c ON c.com_id = o.com_id
  WHERE o.sales_id = sp.sales_id
    AND c.name = 'RED'
);
```

*Source: LeetCode #607 — Sales Person*

---

## Subqueries & Set Logic

### 21. Customers Who Bought All Products

#### Problem

Given `customer(customer_id, product_key)` and `product(product_key)`, return the customers who have bought every product in the catalogue.

**Schema:**

```
product
  product_key  integer  PRIMARY KEY

customer
  customer_id  integer
  product_key  integer  FK → product
```

**Expected output (sample):**

| customer_id |
|-------------|
| 1           |
| 3           |

#### Pattern

Division: `COUNT(DISTINCT)` per customer vs. catalogue size.

#### Explanation

Classic relational division. Group by customer, count distinct products purchased, compare to the catalogue size (a scalar subquery). The alternative `NOT EXISTS (... product NOT IN customer's set ...)` is the literal translation of the universal quantifier but is harder to read.

#### Solution

```sql
SELECT customer_id
FROM customer
GROUP BY customer_id
HAVING COUNT(DISTINCT product_key) = (SELECT COUNT(*) FROM product);
```

*Source: LeetCode #1045 — Customers Who Bought All Products*

---

### 22. Customers Who Bought Products A and B but Not C

#### Problem

Given `customers(customer_id, customer_name)` and `orders(order_id, customer_id, product_name)`, return the customers who have bought products `'A'` and `'B'` but not `'C'`.

**Schema:**

```
customers
  customer_id    integer  PRIMARY KEY
  customer_name  varchar

orders
  order_id      integer  PRIMARY KEY
  customer_id   integer  FK → customers
  product_name  varchar
```

**Expected output (sample):**

| customer_id | customer_name |
|-------------|---------------|
| 1           | Daniel        |

#### Pattern

`GROUP BY` + `HAVING` with `BOOL_OR`/`SUM(CASE)` flags.

#### Explanation

Aggregate three booleans per customer and threshold them in one `HAVING`. `BOOL_OR` is the Postgres idiom and reads cleanly; MySQL would use `MAX(product_name='A')`. Avoid three subqueries with `EXISTS` — one pass beats three.

#### Solution

```sql
SELECT c.customer_id, c.customer_name
FROM customers c
JOIN orders o USING (customer_id)
GROUP BY c.customer_id, c.customer_name
HAVING BOOL_OR(o.product_name = 'A')
   AND BOOL_OR(o.product_name = 'B')
   AND NOT BOOL_OR(o.product_name = 'C');
```

*Source: LeetCode #1965 / community — Customers Who Bought Products A and B but Not C*

---

### 23. Investments in 2016

#### Problem

Given `insurance(pid, tiv_2015, tiv_2016, lat, lon)`, return the sum of `tiv_2016` for policies whose `tiv_2015` value is shared by at least one other policy **and** whose `(lat, lon)` is unique. Round to two decimals.

**Schema:**

```
insurance
  pid       integer  PRIMARY KEY
  tiv_2015  float
  tiv_2016  float
  lat       float
  lon       float
```

**Expected output (sample):**

| tiv_2016 |
|----------|
| 45.00    |

#### Pattern

Window-function frequency counts.

#### Explanation

Two conditions become two `COUNT(*) OVER (PARTITION BY ...)` calls — frequency of `tiv_2015` and frequency of `(lat, lon)`. One pass, no self-joins.

#### Solution

```sql
SELECT ROUND(SUM(tiv_2016)::numeric, 2) AS tiv_2016
FROM (
  SELECT tiv_2016,
         COUNT(*) OVER (PARTITION BY tiv_2015)   AS tiv15_cnt,
         COUNT(*) OVER (PARTITION BY lat, lon)   AS loc_cnt
  FROM insurance
) t
WHERE tiv15_cnt > 1 AND loc_cnt = 1;
```

*Source: LeetCode #585 — Investments in 2016*

---

### 24. Triangle Judgment

#### Problem

Given `triangle(x, y, z)`, return for each row whether the three lengths can form a valid triangle (`'Yes'` / `'No'`).

**Schema:**

```
triangle
  x  integer
  y  integer
  z  integer
```

**Expected output (sample):**

| x  | y | z  | triangle |
|----|---|----|----------|
| 13 | 15 | 30 | No       |
| 10 | 20 | 15 | Yes      |

#### Pattern

`CASE` expression.

#### Explanation

Triangle inequality: each side must be strictly less than the sum of the other two. A `CASE` expression is the cleanest way.

#### Solution

```sql
SELECT x, y, z,
       CASE
         WHEN x + y > z AND x + z > y AND y + z > x THEN 'Yes'
         ELSE 'No'
       END AS triangle
FROM triangle;
```

*Source: LeetCode #610 — Triangle Judgment*

---

### 25. Biggest Single Number

#### Problem

From a `my_numbers(num)` table, return the largest number that appears exactly once. Return `NULL` if no such number exists.

**Schema:**

```
my_numbers
  num  integer
```

**Expected output (sample):**

| num |
|-----|
| 6   |

#### Pattern

`GROUP BY` + `HAVING` + scalar subquery.

#### Explanation

Group, keep singletons, `MAX`. Wrap in a scalar subquery so an empty result returns `NULL` rather than zero rows — important when the grader expects exactly one row.

#### Solution

```sql
SELECT (
  SELECT MAX(num)
  FROM my_numbers
  GROUP BY num
  HAVING COUNT(*) = 1
  ORDER BY 1 DESC
  LIMIT 1
) AS num;
```

*Source: LeetCode #619 — Biggest Single Number*

---

### 26. Group Sold Products by the Date

#### Problem

From `activities(sell_date, product)`, for each `sell_date` return the number of distinct products sold and an alphabetically-sorted comma-separated list of those products.

**Schema:**

```
activities
  sell_date  date
  product    varchar
```

**Expected output (sample):**

| sell_date  | num_sold | products                     |
|------------|----------|------------------------------|
| 2020-05-30 | 3        | Basketball,Headphone,T-Shirt |
| 2020-06-01 | 2        | Bible,Pencil                 |

#### Pattern

`COUNT(DISTINCT)` + `STRING_AGG`.

#### Explanation

Postgres has `STRING_AGG(expr, ',' ORDER BY expr)` which sorts within the aggregate — exactly what's needed. MySQL's equivalent is `GROUP_CONCAT(... ORDER BY ... SEPARATOR ',')`. Wrap the inner expression in `DISTINCT` to dedupe products that repeat in a day.

#### Solution

```sql
SELECT sell_date,
       COUNT(DISTINCT product)                         AS num_sold,
       STRING_AGG(DISTINCT product, ',' ORDER BY product) AS products
FROM activities
GROUP BY sell_date
ORDER BY sell_date;
```

*Source: LeetCode #1484 — Group Sold Products by the Date*

---

### 27. Customers Who Never Order

#### Problem

From `customers(id, name)` and `orders(id, customer_id)`, return the names of customers who have never placed an order.

**Schema:**

```
customers
  id    integer  PRIMARY KEY
  name  varchar

orders
  id           integer  PRIMARY KEY
  customer_id  integer  FK → customers(id)
```

**Expected output (sample):**

| customers |
|-----------|
| Henry     |
| Max       |

#### Pattern

Anti-join via `NOT EXISTS`.

#### Explanation

`NOT EXISTS` is the safest formulation — NULL-safe and the planner runs it as an anti-join. `NOT IN` would explode if any `customer_id` were NULL.

#### Solution

```sql
SELECT name AS customers
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

*Source: LeetCode #183 — Customers Who Never Order*

---

## Window Functions

### 28. Rank Scores

#### Problem

Given `scores(id, score)`, rank each score in descending order. Ties get the same rank, and the next rank is consecutive (no gaps).

**Schema:**

```
scores
  id     integer  PRIMARY KEY
  score  numeric
```

**Expected output (sample):**

| score | rank |
|-------|------|
| 4.00  | 1    |
| 4.00  | 1    |
| 3.85  | 2    |
| 3.65  | 3    |

#### Pattern

`DENSE_RANK` window function.

#### Explanation

Three window functions are easy to confuse: `RANK` leaves gaps after ties (1,1,3), `DENSE_RANK` doesn't (1,1,2), `ROW_NUMBER` breaks ties arbitrarily. The "no gaps" requirement is the giveaway.

#### Solution

```sql
SELECT score,
       DENSE_RANK() OVER (ORDER BY score DESC) AS rank
FROM scores;
```

*Source: LeetCode #178 — Rank Scores*

---

### 29. Consecutive Numbers

#### Problem

Given `logs(id, num)`, return all numbers that appear at least three times consecutively (ordered by `id`).

**Schema:**

```
logs
  id   integer  PRIMARY KEY
  num  varchar
```

**Expected output (sample):**

| consecutive_nums |
|------------------|
| 1                |

#### Pattern

`LAG` × 2 (or self-join offset).

#### Explanation

For each row, compare to the two prior rows with `LAG(num, 1)` and `LAG(num, 2)`. If all three agree, the current row is the tail of a run of three. The classic alternative is a triple self-join on `id`, `id-1`, `id-2`, but that assumes contiguous ids.

#### Solution

```sql
SELECT DISTINCT num AS consecutive_nums
FROM (
  SELECT num,
         LAG(num, 1) OVER (ORDER BY id) AS p1,
         LAG(num, 2) OVER (ORDER BY id) AS p2
  FROM logs
) t
WHERE num = p1 AND num = p2;
```

*Source: LeetCode #180 — Consecutive Numbers*

---

### 30. Department Highest Salary

#### Problem

Given `employee(id, name, salary, departmentId)` and `department(id, name)`, return for each department the names of its highest-paid employees (handle ties — multiple winners possible).

**Schema:**

```
employee
  id            integer  PRIMARY KEY
  name          varchar
  salary        integer
  department_id integer  FK → department

department
  id    integer  PRIMARY KEY
  name  varchar
```

**Expected output (sample):**

| Department | Employee | Salary |
|------------|----------|--------|
| IT         | Max      | 90000  |
| Sales      | Henry    | 80000  |

#### Pattern

`RANK` partitioned by department.

#### Explanation

`RANK` is the right tool for "top with ties" — multiple winners share rank 1. `ROW_NUMBER` would pick exactly one. `MAX` per department joined back is the textbook alternative; the window form keeps it to one pass.

#### Solution

```sql
SELECT d.name AS "Department",
       e.name AS "Employee",
       e.salary AS "Salary"
FROM (
  SELECT name, salary, department_id,
         RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rk
  FROM employee
) e
JOIN department d ON d.id = e.department_id
WHERE e.rk = 1;
```

*Source: LeetCode #184 — Department Highest Salary*

---

### 31. Department Top Three Salaries

#### Problem

Given `employee(id, name, salary, departmentId)` and `department(id, name)`, return the top three distinct salaries per department (handle ties — many employees can share a rank).

**Schema:**

```
employee
  id            integer  PRIMARY KEY
  name          varchar
  salary        integer
  department_id integer  FK → department

department
  id    integer  PRIMARY KEY
  name  varchar
```

**Expected output (sample):**

| Department | Employee | Salary |
|------------|----------|--------|
| IT         | Max      | 90000  |
| IT         | Randy    | 85000  |
| IT         | Joe      | 85000  |
| IT         | Will     | 70000  |
| Sales      | Henry    | 80000  |

#### Pattern

`DENSE_RANK` partitioned by department.

#### Explanation

"Top three distinct salaries" → `DENSE_RANK` (no gaps after ties) with `rk <= 3`. The ranking is on distinct salary values, which is exactly what `DENSE_RANK` produces. Beats the legacy "correlated subquery counting higher salaries" approach by an order of magnitude in time complexity.

#### Solution

```sql
WITH ranked AS (
  SELECT name, salary, department_id,
         DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rk
  FROM employee
)
SELECT d.name AS "Department",
       e.name AS "Employee",
       e.salary AS "Salary"
FROM ranked e
JOIN department d ON d.id = e.department_id
WHERE e.rk <= 3;
```

*Source: LeetCode #185 — Department Top Three Salaries*

---

### 32. Restaurant Growth

#### Problem

Given `customer(customer_id, name, visited_on, amount)` — one row per visit per day per customer — return for each day starting from the seventh recorded day: the date, the 7-day rolling sum of amounts ending on that day, and the 7-day rolling average rounded to two decimals.

**Schema:**

```
customer
  customer_id  integer
  name         varchar
  visited_on   date
  amount       integer
```

**Expected output (sample):**

| visited_on | amount | average_amount |
|------------|--------|----------------|
| 2019-01-07 | 860    | 122.86         |
| 2019-01-08 | 840    | 120.00         |

#### Pattern

Daily roll-up + window with rows frame.

#### Explanation

Two passes: aggregate per day, then 7-day rolling sum using `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW`. The `OFFSET 6` (or `WHERE row_number >= 7`) drops the leading partial windows where the rolling sum would be incomplete.

#### Solution

```sql
WITH daily AS (
  SELECT visited_on, SUM(amount) AS day_total
  FROM customer
  GROUP BY visited_on
),
rolled AS (
  SELECT visited_on,
         SUM(day_total) OVER w  AS amount,
         AVG(day_total) OVER w  AS avg_amt,
         ROW_NUMBER()  OVER (ORDER BY visited_on) AS rn
  FROM daily
  WINDOW w AS (ORDER BY visited_on ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
)
SELECT visited_on, amount, ROUND(avg_amt::numeric, 2) AS average_amount
FROM rolled
WHERE rn >= 7
ORDER BY visited_on;
```

*Source: LeetCode #1321 — Restaurant Growth*

---

### 33. Game Play Analysis IV

#### Problem

Given `activity(player_id, device_id, event_date, games_played)`, return the fraction of players who logged in the day after their first login, rounded to two decimals.

**Schema:**

```
activity
  player_id    integer
  device_id    integer
  event_date   date
  games_played integer
  PRIMARY KEY (player_id, event_date)
```

**Expected output (sample):**

| fraction |
|----------|
| 0.33     |

#### Pattern

`MIN` window + date arithmetic.

#### Explanation

For each player, find the first login date, then check if `first_login + 1` appears anywhere in their history. `EXISTS` is fine, but a window-min + self-join is also common. Divide by total distinct players.

#### Solution

```sql
WITH firsts AS (
  SELECT player_id,
         MIN(event_date) AS first_date
  FROM activity
  GROUP BY player_id
)
SELECT ROUND(
         COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM activity a
             WHERE a.player_id  = f.player_id
               AND a.event_date = f.first_date + INTERVAL '1 day'
           )
         )::numeric
         / COUNT(*),
         2
       ) AS fraction
FROM firsts f;
```

*Source: LeetCode #550 — Game Play Analysis IV*

---

### 34. Last Person to Fit in the Bus

#### Problem

Given `queue(person_id, person_name, weight, turn)` representing a boarding queue ordered by `turn`, return the name of the last person who can board without the running weight exceeding 1000.

**Schema:**

```
queue
  person_id    integer  PRIMARY KEY
  person_name  varchar
  weight       integer
  turn         integer
```

**Expected output (sample):**

| person_name |
|-------------|
| John Cena   |

#### Pattern

Running sum + threshold + `LIMIT 1`.

#### Explanation

Cumulative `SUM(weight) OVER (ORDER BY turn)`, then keep rows whose total is ≤ 1000 and pick the last one. `ORDER BY turn DESC LIMIT 1` is the idiomatic finish.

#### Solution

```sql
SELECT person_name
FROM (
  SELECT person_name, turn,
         SUM(weight) OVER (ORDER BY turn) AS running
  FROM queue
) t
WHERE running <= 1000
ORDER BY turn DESC
LIMIT 1;
```

*Source: LeetCode #1204 — Last Person to Fit in the Bus*

---

### 35. Movie Rating

#### Problem

Given `users`, `movies`, and `movie_rating(movie_id, user_id, rating, created_at)`, return two scalar rows: (1) the user who has rated the most movies (ties broken by name ascending), and (2) the movie with the highest average rating in February 2020 (ties broken by title ascending).

**Schema:**

```
users
  user_id  integer  PRIMARY KEY
  name     varchar

movies
  movie_id  integer  PRIMARY KEY
  title     varchar

movie_rating
  movie_id    integer  FK → movies
  user_id     integer  FK → users
  rating      integer
  created_at  date
  PRIMARY KEY (movie_id, user_id)
```

**Expected output (sample):**

| results       |
|---------------|
| Daniel        |
| Frozen 2      |

#### Pattern

Two ordered top-1 queries glued with `UNION ALL`.

#### Explanation

Two independent rankings combined with `UNION ALL` (no de-dup needed). Each side is its own `ORDER BY ... LIMIT 1`. Order matters in the final output — wrap with an outer `ORDER BY` carrying a sort key per branch if necessary.

#### Solution

```sql
(SELECT u.name AS results
 FROM movie_rating mr
 JOIN users u USING (user_id)
 GROUP BY u.name
 ORDER BY COUNT(*) DESC, u.name
 LIMIT 1)
UNION ALL
(SELECT m.title
 FROM movie_rating mr
 JOIN movies m USING (movie_id)
 WHERE mr.created_at >= DATE '2020-02-01'
   AND mr.created_at <  DATE '2020-03-01'
 GROUP BY m.title
 ORDER BY AVG(mr.rating) DESC, m.title
 LIMIT 1);
```

*Source: LeetCode #1341 — Movie Rating*

---

### 36. Nth Highest Salary

#### Problem

Given `employee(id, salary)`, return the *n*-th highest distinct salary. Return `NULL` if there are fewer than *n* distinct salaries.

**Schema:**

```
employee
  id      integer  PRIMARY KEY
  salary  integer
```

**Expected output (sample):**

| getNthHighestSalary(2) |
|------------------------|
| 200                    |

#### Pattern

`DENSE_RANK` + scalar subquery, or `OFFSET ... LIMIT 1`.

#### Explanation

Two clean ways: `OFFSET n-1 LIMIT 1` on `SELECT DISTINCT salary ORDER BY salary DESC`, or `DENSE_RANK` and filter. The `OFFSET` form is simpler and emits NULL naturally when the offset is past the end (Postgres returns zero rows; wrap in a `SELECT (...)` scalar subquery to coerce to NULL).

#### Solution

```sql
-- Postgres function form; for a plain query, swap the params for literals.
CREATE OR REPLACE FUNCTION nth_highest_salary(n integer)
RETURNS integer LANGUAGE sql AS $$
  SELECT (
    SELECT DISTINCT salary
    FROM employee
    ORDER BY salary DESC
    OFFSET GREATEST(n - 1, 0)
    LIMIT 1
  );
$$;
```

*Source: LeetCode #177 — Nth Highest Salary*

---

### 37. Second Highest Salary

#### Problem

Given `employee(id, salary)`, return the second-highest distinct salary. Return `NULL` if it doesn't exist.

**Schema:**

```
employee
  id      integer  PRIMARY KEY
  salary  integer
```

**Expected output (sample):**

| SecondHighestSalary |
|---------------------|
| 200                 |

#### Pattern

`OFFSET 1 LIMIT 1` wrapped in a scalar subquery.

#### Explanation

The scalar subquery wrap is the trick that returns `NULL` instead of zero rows when the offset overshoots — the empty inner query becomes a single NULL value at the outer level.

#### Solution

```sql
SELECT (
  SELECT DISTINCT salary
  FROM employee
  ORDER BY salary DESC
  OFFSET 1 LIMIT 1
) AS "SecondHighestSalary";
```

*Source: LeetCode #176 — Second Highest Salary*

---

## Self-Joins & Hierarchies

### 38. Rising Temperature

#### Problem

Given `weather(id, recordDate, temperature)`, return the ids of days whose temperature was higher than the previous calendar day (gaps in the date series are allowed — only adjacent calendar days count).

**Schema:**

```
weather
  id           integer  PRIMARY KEY
  record_date  date     UNIQUE
  temperature  integer
```

**Expected output (sample):**

| id |
|----|
| 2  |
| 4  |

#### Pattern

Self-join on `record_date = prev_date + 1`.

#### Explanation

The literal "previous **calendar** day" requirement rules out a `LAG` ordered by row position — you must compare on date arithmetic. Self-join is clearer than a `LAG` with a guard clause.

#### Solution

```sql
SELECT today.id
FROM weather today
JOIN weather yest
  ON yest.record_date = today.record_date - INTERVAL '1 day'
WHERE today.temperature > yest.temperature;
```

*Source: LeetCode #197 — Rising Temperature*

---

### 39. Employees Earning More Than Their Managers

#### Problem

From `employee(id, name, salary, managerId)`, return the names of employees who earn more than their direct manager.

**Schema:**

```
employee
  id          integer  PRIMARY KEY
  name        varchar
  salary      integer
  manager_id  integer
```

**Expected output (sample):**

| Employee |
|----------|
| Joe      |

#### Pattern

Self-join `employee.manager_id = manager.id`.

#### Explanation

The bread-and-butter recursive-feeling self-join. Use distinct table aliases (`e`, `m`) and the join condition handles NULL managers cleanly (inner join drops the CEO).

#### Solution

```sql
SELECT e.name AS "Employee"
FROM employee e
JOIN employee m ON m.id = e.manager_id
WHERE e.salary > m.salary;
```

*Source: LeetCode #181 — Employees Earning More Than Their Managers*

---

### 40. Exchange Seats

#### Problem

Given `seat(id, student)` with consecutive ids 1..N, swap each adjacent pair (1↔2, 3↔4, …). If N is odd, the last student stays in place. Output sorted by id.

**Schema:**

```
seat
  id       integer  PRIMARY KEY
  student  varchar
```

**Expected output (sample):**

| id | student |
|----|---------|
| 1  | Doris   |
| 2  | Abbot   |
| 3  | Green   |
| 4  | Emerson |
| 5  | Jeames  |

#### Pattern

`CASE` on parity + scalar `MAX(id)` for the odd tail.

#### Explanation

The neat one-pass trick: even rows pair down (id → id − 1), odd rows pair up (id → id + 1), and the last row stays. Compute the max id once and reuse.

#### Solution

```sql
SELECT
  CASE
    WHEN id % 2 = 0           THEN id - 1
    WHEN id = (SELECT MAX(id) FROM seat) THEN id
    ELSE id + 1
  END AS id,
  student
FROM seat
ORDER BY id;
```

*Source: LeetCode #626 — Exchange Seats*

---

### 41. Primary Department for Each Employee

#### Problem

Given `employee(employee_id, department_id, primary_flag)` where `primary_flag` is `'Y'` or `'N'`, return each employee's primary department. If an employee has exactly one department row, that one is primary by default.

**Schema:**

```
employee
  employee_id    integer
  department_id  integer
  primary_flag   char(1) CHECK (primary_flag IN ('Y','N'))
  PRIMARY KEY (employee_id, department_id)
```

**Expected output (sample):**

| employee_id | department_id |
|-------------|---------------|
| 1           | 1             |
| 2           | 1             |
| 3           | 3             |

#### Pattern

`UNION ALL` of two disjoint cases.

#### Explanation

Two disjoint sets: employees with one row (default primary) and employees with multiple rows (explicit `'Y'`). `UNION ALL` is safe because the cases can't overlap.

#### Solution

```sql
SELECT employee_id, department_id
FROM employee
WHERE primary_flag = 'Y'

UNION ALL

SELECT employee_id, MIN(department_id)
FROM employee
GROUP BY employee_id
HAVING COUNT(*) = 1;
```

*Source: LeetCode #1789 — Primary Department for Each Employee*

---

### 42. Tree Node

#### Problem

Given `tree(id, p_id)` representing a tree, label each node as `'Root'` (no parent), `'Inner'` (has parent and at least one child), or `'Leaf'` (has parent, no children).

**Schema:**

```
tree
  id    integer  PRIMARY KEY
  p_id  integer  -- NULL for the root
```

**Expected output (sample):**

| id | type  |
|----|-------|
| 1  | Root  |
| 2  | Inner |
| 3  | Leaf  |
| 4  | Leaf  |

#### Pattern

`CASE` on `p_id IS NULL` + `EXISTS` for children.

#### Explanation

Two independent boolean tests: "has parent?" (column check) and "has child?" (EXISTS). The labels follow from the truth table. Two passes is overkill — let the planner inline the EXISTS.

#### Solution

```sql
SELECT id,
  CASE
    WHEN p_id IS NULL THEN 'Root'
    WHEN EXISTS (SELECT 1 FROM tree c WHERE c.p_id = t.id) THEN 'Inner'
    ELSE 'Leaf'
  END AS type
FROM tree t;
```

*Source: LeetCode #608 — Tree Node*

---

### 43. Swap Salary

#### Problem

Given `salary(id, name, sex, salary)` with `sex` in `('m','f')`, atomically swap all `m`s to `f`s and vice versa in a single `UPDATE`.

**Schema:**

```
salary
  id      integer  PRIMARY KEY
  name    varchar
  sex     char(1)
  salary  integer
```

**Expected output (sample):**

(table contents post-update; one row per id, with sex flipped)

#### Pattern

`UPDATE` with `CASE`.

#### Explanation

A single statement avoids the classic two-statement bug where the second update reverts the first. `CASE` (or in Postgres specifically: `CASE WHEN ... ELSE ... END`) inside `SET` does both directions in one pass.

#### Solution

```sql
UPDATE salary
SET sex = CASE sex WHEN 'm' THEN 'f' ELSE 'm' END;
```

*Source: LeetCode #627 — Swap Salary*

---

### 44. Delete Duplicate Emails

#### Problem

Given `person(id, email)`, delete duplicates so that only the row with the smallest `id` per email survives.

**Schema:**

```
person
  id     integer  PRIMARY KEY
  email  varchar
```

**Expected output (sample):**

(table contents post-delete; one row per distinct email, keeping the smallest id)

#### Pattern

`DELETE ... USING` self-reference.

#### Explanation

Postgres-idiomatic: `DELETE ... USING` lets you self-join in a delete. The condition keeps `p1.id > p2.id` so the lower id always wins. MySQL would need a different syntax with a derived table to avoid "can't delete from a table you're selecting from".

#### Solution

```sql
DELETE FROM person p1
USING person p2
WHERE p1.email = p2.email
  AND p1.id    > p2.id;
```

*Source: LeetCode #196 — Delete Duplicate Emails*

---

### 45. Duplicate Emails

#### Problem

Given `person(id, email)`, return the emails that appear more than once.

**Schema:**

```
person
  id     integer  PRIMARY KEY
  email  varchar
```

**Expected output (sample):**

| Email             |
|-------------------|
| a@b.com           |

#### Pattern

`GROUP BY` + `HAVING COUNT(*) > 1`.

#### Explanation

The textbook duplicate-finder. Trivial.

#### Solution

```sql
SELECT email AS "Email"
FROM person
GROUP BY email
HAVING COUNT(*) > 1;
```

*Source: LeetCode #182 — Duplicate Emails*

---

## Date / Time

### 46. Sales Analysis III

#### Problem

Given `product(product_id, product_name, unit_price)` and `sales(seller_id, product_id, buyer_id, sale_date, quantity, price)`, return the products that were sold **only** in Q1 2019 (between 2019-01-01 and 2019-03-31 inclusive).

**Schema:**

```
product
  product_id    integer  PRIMARY KEY
  product_name  varchar
  unit_price    integer

sales
  seller_id    integer
  product_id   integer  FK → product
  buyer_id     integer
  sale_date    date
  quantity     integer
  price        integer
```

**Expected output (sample):**

| product_id | product_name |
|------------|--------------|
| 1          | S8           |

#### Pattern

`GROUP BY` + `HAVING` with `MIN`/`MAX` range check.

#### Explanation

A product qualifies iff *every* sale falls in the window. Express this with `MIN(sale_date) >= start AND MAX(sale_date) <= end`. Avoid the "any sale outside the window" anti-join — bounds are tighter and read better.

#### Solution

```sql
SELECT p.product_id, p.product_name
FROM sales s
JOIN product p USING (product_id)
GROUP BY p.product_id, p.product_name
HAVING MIN(s.sale_date) >= DATE '2019-01-01'
   AND MAX(s.sale_date) <= DATE '2019-03-31';
```

*Source: LeetCode #1084 — Sales Analysis III*

---

### 47. User Activity for the Past 30 Days I

#### Problem

Given `activity(user_id, session_id, activity_date, activity_type)`, for each day in the 30-day window ending 2019-07-27 inclusive, return the number of distinct active users that day. Skip days with zero activity.

**Schema:**

```
activity
  user_id        integer
  session_id     integer
  activity_date  date
  activity_type  varchar
```

**Expected output (sample):**

| day        | active_users |
|------------|--------------|
| 2019-07-20 | 2            |
| 2019-07-23 | 1            |
| 2019-07-27 | 3            |

#### Pattern

Date-window `WHERE` + `COUNT(DISTINCT)`.

#### Explanation

`activity_date > end - INTERVAL '30 days'` (exclusive lower bound) gives the 30-day window ending on `end`. `COUNT(DISTINCT user_id)` because the same user may have multiple sessions in a day.

#### Solution

```sql
SELECT activity_date AS day,
       COUNT(DISTINCT user_id) AS active_users
FROM activity
WHERE activity_date >  DATE '2019-07-27' - INTERVAL '30 days'
  AND activity_date <= DATE '2019-07-27'
GROUP BY activity_date;
```

*Source: LeetCode #1141 — User Activity for the Past 30 Days I*

---

### 48. Sales by Day of the Week

#### Problem

Given `orders(order_id, customer_id, order_date, item_id, quantity)` and `items(item_id, item_name)`, return for each item the total quantity sold per day of the week. Columns: `Category` (item_name), then `Monday`…`Sunday`. Every item appears in the output even if some days have zero.

**Schema:**

```
orders
  order_id     integer  PRIMARY KEY
  customer_id  integer
  order_date   date
  item_id      integer  FK → items
  quantity     integer

items
  item_id    integer  PRIMARY KEY
  item_name  varchar
```

**Expected output (sample):**

| Category | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
|----------|--------|---------|-----------|----------|--------|----------|--------|
| Bread    | 2      | 1       | 0         | 0        | 0      | 0        | 0      |
| Cheese   | 0      | 1       | 0         | 0        | 0      | 0        | 0      |

#### Pattern

Pivot via conditional sum + left join to anchor on items.

#### Explanation

Postgres has no native `PIVOT`, but `SUM(CASE WHEN dow=... THEN quantity ELSE 0 END)` is the universal pivot. `EXTRACT(ISODOW FROM date)` returns Monday=1, …, Sunday=7. `LEFT JOIN` to keep items with zero sales.

#### Solution

```sql
SELECT i.item_name AS "Category",
       COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM o.order_date) = 1 THEN o.quantity END), 0) AS "Monday",
       COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM o.order_date) = 2 THEN o.quantity END), 0) AS "Tuesday",
       COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM o.order_date) = 3 THEN o.quantity END), 0) AS "Wednesday",
       COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM o.order_date) = 4 THEN o.quantity END), 0) AS "Thursday",
       COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM o.order_date) = 5 THEN o.quantity END), 0) AS "Friday",
       COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM o.order_date) = 6 THEN o.quantity END), 0) AS "Saturday",
       COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM o.order_date) = 7 THEN o.quantity END), 0) AS "Sunday"
FROM items i
LEFT JOIN orders o USING (item_id)
GROUP BY i.item_name
ORDER BY i.item_name;
```

*Source: LeetCode #1741 — Sales by Day of the Week*

---

## String Manipulation

### 49. Invalid Tweets

#### Problem

From `tweets(tweet_id, content)`, return the ids of tweets whose `content` length exceeds 15 characters.

**Schema:**

```
tweets
  tweet_id  integer  PRIMARY KEY
  content   varchar
```

**Expected output (sample):**

| tweet_id |
|----------|
| 1        |

#### Pattern

`CHAR_LENGTH`.

#### Explanation

`CHAR_LENGTH` (= `LENGTH` in Postgres for `text`) counts characters. In MySQL, `LENGTH` returns bytes — use `CHAR_LENGTH` there for portability.

#### Solution

```sql
SELECT tweet_id
FROM tweets
WHERE CHAR_LENGTH(content) > 15;
```

*Source: LeetCode #1683 — Invalid Tweets*

---

### 50. Find Users With Valid Emails

#### Problem

Given `users(user_id, name, mail)`, return rows whose `mail` is a valid email — starts with a letter, followed by letters/digits/`_`/`.`/`-`, ending in literal `@leetcode.com`.

**Schema:**

```
users
  user_id  integer  PRIMARY KEY
  name     varchar
  mail     varchar
```

**Expected output (sample):**

| user_id | name      | mail                  |
|---------|-----------|-----------------------|
| 1       | Winston   | winston@leetcode.com  |
| 3       | Annabelle | bella-@leetcode.com   |

#### Pattern

POSIX regex with `~`.

#### Explanation

Postgres `~` is case-sensitive POSIX regex (Postgres-native, no extension needed). Anchor with `^` and `$`. The character class `[A-Za-z0-9_.-]` covers the allowed inner characters; the leading character must be a letter.

#### Solution

```sql
SELECT user_id, name, mail
FROM users
WHERE mail ~ '^[A-Za-z][A-Za-z0-9_.\-]*@leetcode\.com$';
```

*Source: LeetCode #1517 — Find Users With Valid Emails*

---

### 51. Fix Names in a Table

#### Problem

Given `users(user_id, name)` where the name's casing is inconsistent, return rows with the name capitalised: first letter upper, rest lower. Order by `user_id`.

**Schema:**

```
users
  user_id  integer  PRIMARY KEY
  name     varchar
```

**Expected output (sample):**

| user_id | name  |
|---------|-------|
| 1       | Alice |
| 2       | Bob   |

#### Pattern

`INITCAP` or manual `UPPER`/`LOWER` slice.

#### Explanation

Postgres has `INITCAP` but it also lowercases letters after every non-alphanumeric — fine for single-word names, surprising for "mary-jane". Safer for a single-word constraint: explicit slice with `UPPER(LEFT(...,1)) || LOWER(SUBSTRING(...,2))`.

#### Solution

```sql
SELECT user_id,
       UPPER(LEFT(name, 1)) || LOWER(SUBSTRING(name FROM 2)) AS name
FROM users
ORDER BY user_id;
```

*Source: LeetCode #1667 — Fix Names in a Table*

---

### 52. Patients With a Condition

#### Problem

Given `patients(patient_id, patient_name, conditions)` where `conditions` is a space-separated string of codes, return patients with at least one condition starting with `'DIAB1'`.

**Schema:**

```
patients
  patient_id     integer  PRIMARY KEY
  patient_name   varchar
  conditions     varchar
```

**Expected output (sample):**

| patient_id | patient_name | conditions       |
|------------|--------------|------------------|
| 2          | Alice        | DIAB100 MYOP     |
| 4          | Bob          | ACNE DIAB100     |

#### Pattern

Two `LIKE` checks (start and word-boundary).

#### Explanation

The naive `LIKE '%DIAB1%'` would match `'XDIAB1'` — a false positive. The fix is two patterns ORed: `LIKE 'DIAB1%'` (start of string) and `LIKE '% DIAB1%'` (after a space).

#### Solution

```sql
SELECT patient_id, patient_name, conditions
FROM patients
WHERE conditions LIKE 'DIAB1%'
   OR conditions LIKE '% DIAB1%';
```

*Source: LeetCode #1527 — Patients With a Condition*

---

### 53. Not Boring Movies

#### Problem

From `cinema(id, movie, description, rating)`, return rows where the id is odd and the description is not `'boring'`, sorted by `rating` descending.

**Schema:**

```
cinema
  id           integer  PRIMARY KEY
  movie        varchar
  description  varchar
  rating       numeric
```

**Expected output (sample):**

| id | movie     | description | rating |
|----|-----------|-------------|--------|
| 5  | House     | great       | 8.90   |
| 1  | War       | great 3D    | 8.90   |

#### Pattern

Modulo filter + ordering.

#### Explanation

Trivial. `id % 2 = 1` for odd. Stable behaviour requires the explicit `ORDER BY`; without it the engine can return rows in any order.

#### Solution

```sql
SELECT id, movie, description, rating
FROM cinema
WHERE id % 2 = 1
  AND description <> 'boring'
ORDER BY rating DESC;
```

*Source: LeetCode #620 — Not Boring Movies*

---

## Recursive CTEs

### 54. All People Report to the Given Manager

#### Problem

Given `employees(employee_id, employee_name, manager_id)`, return the ids of every employee in the reporting subtree of manager 1 — direct reports, indirect reports, and so on. Exclude manager 1.

**Schema:**

```
employees
  employee_id    integer  PRIMARY KEY
  employee_name  varchar
  manager_id     integer
```

**Expected output (sample):**

| employee_id |
|-------------|
| 2           |
| 77          |
| 4           |

#### Pattern

Recursive CTE.

#### Explanation

The textbook hierarchy traversal: anchor at manager 1's direct reports, recursively join children. The depth-3 cap mentioned in the original problem is handled by either bounded recursion or by simply continuing until no new rows are added (postgres terminates naturally).

#### Solution

```sql
WITH RECURSIVE subordinates AS (
  SELECT employee_id
  FROM employees
  WHERE manager_id = 1 AND employee_id <> 1

  UNION

  SELECT e.employee_id
  FROM employees e
  JOIN subordinates s ON e.manager_id = s.employee_id
)
SELECT employee_id FROM subordinates;
```

*Source: LeetCode #1303 — Find the Team Size / 1972 / community: All People Report to the Given Manager*

---

### 55. Find the Start and End Number of Continuous Ranges

#### Problem

Given `logs(log_id)` containing a set of integers, return all maximal continuous ranges as (`start_id`, `end_id`) pairs.

**Schema:**

```
logs
  log_id  integer  PRIMARY KEY
```

**Expected output (sample):**

| start_id | end_id |
|----------|--------|
| 1        | 3      |
| 7        | 8      |
| 10       | 10     |

#### Pattern

Gaps-and-islands via `log_id - ROW_NUMBER`.

#### Explanation

The canonical trick: for any contiguous run of integers, `log_id - ROW_NUMBER() OVER (ORDER BY log_id)` is constant within the run. Group by that derived constant and take min/max.

#### Solution

```sql
SELECT MIN(log_id) AS start_id,
       MAX(log_id) AS end_id
FROM (
  SELECT log_id,
         log_id - ROW_NUMBER() OVER (ORDER BY log_id) AS grp
  FROM logs
) t
GROUP BY grp
ORDER BY start_id;
```

*Source: LeetCode #1285 — Find the Start and End Number of Continuous Ranges*

---

### 56. Friend Requests Acceptance Rate

#### Problem

Given `friend_request(sender_id, send_to_id, request_date)` and `request_accepted(requester_id, accepter_id, accept_date)`, return the overall acceptance rate (accepted / sent), rounded to two decimals. Each request is unique by `(sender, recipient)`; each acceptance is unique by `(requester, accepter)`. If there are no requests, return 0.00.

**Schema:**

```
friend_request
  sender_id     integer
  send_to_id    integer
  request_date  date

request_accepted
  requester_id  integer
  accepter_id   integer
  accept_date   date
```

**Expected output (sample):**

| accept_rate |
|-------------|
| 0.80        |

#### Pattern

Two `COUNT(DISTINCT)` scalars + division.

#### Explanation

Two scalar subqueries — distinct pairs sent vs. distinct pairs accepted. Guard against zero divisor with a `CASE`. Don't try to join the tables: the relationship is set-cardinality, not row-by-row.

#### Solution

```sql
SELECT ROUND(
  CASE
    WHEN (SELECT COUNT(DISTINCT (sender_id, send_to_id)) FROM friend_request) = 0
      THEN 0
    ELSE (SELECT COUNT(DISTINCT (requester_id, accepter_id)) FROM request_accepted)::numeric
       / (SELECT COUNT(DISTINCT (sender_id, send_to_id)) FROM friend_request)
  END, 2
) AS accept_rate;
```

*Source: LeetCode #597 — Friend Requests I: Overall Acceptance Rate*

---

### 57. Friend Suggestions

#### Problem

Given `friendship(user1_id, user2_id)` (undirected — each pair stored once), suggest for each user the friends-of-friends who are not themselves and not already direct friends. Return `(user_id, suggested_id)` pairs.

**Schema:**

```
friendship
  user1_id  integer
  user2_id  integer
  PRIMARY KEY (user1_id, user2_id)
```

**Expected output (sample):**

| user_id | suggested_id |
|---------|--------------|
| 1       | 4            |
| 2       | 5            |

#### Pattern

Undirected adjacency unfold + 2-hop traversal.

#### Explanation

The undirected pairs are stored once but need to expand both ways — `UNION ALL` the (a→b) and (b→a) versions, then join twice for friends-of-friends, excluding self and direct friends.

#### Solution

```sql
WITH edges AS (
  SELECT user1_id AS a, user2_id AS b FROM friendship
  UNION ALL
  SELECT user2_id, user1_id FROM friendship
),
direct AS (SELECT * FROM edges)
SELECT DISTINCT e1.a AS user_id, e2.b AS suggested_id
FROM edges e1
JOIN edges e2 ON e1.b = e2.a
WHERE e2.b <> e1.a
  AND NOT EXISTS (
    SELECT 1 FROM direct d
    WHERE d.a = e1.a AND d.b = e2.b
  );
```

*Source: LeetCode community — Friend Suggestions*

---

## Hard / Advanced Patterns

### 58. Trips and Users

#### Problem

Given `trips(id, client_id, driver_id, city_id, status, request_at)` and `users(users_id, banned, role)`, where `status` is one of `'completed'`, `'cancelled_by_driver'`, `'cancelled_by_client'`, return the daily cancellation rate (cancelled / total) for unbanned clients and unbanned drivers, between 2013-10-01 and 2013-10-03 inclusive. Round to two decimals. Days with no qualifying trips are omitted.

**Schema:**

```
trips
  id           integer  PRIMARY KEY
  client_id    integer  FK → users(users_id)
  driver_id    integer  FK → users(users_id)
  city_id      integer
  status       varchar
  request_at   date

users
  users_id  integer  PRIMARY KEY
  banned    varchar  CHECK (banned IN ('Yes','No'))
  role      varchar
```

**Expected output (sample):**

| Day        | Cancellation Rate |
|------------|-------------------|
| 2013-10-01 | 0.33              |
| 2013-10-02 | 0.00              |
| 2013-10-03 | 0.50              |

#### Pattern

Multi-condition filtering + conditional aggregation.

#### Explanation

Three-way filter (client unbanned, driver unbanned, date in range) plus a ratio computed in one pass with `AVG((status<>'completed')::int)`. Two `NOT IN` lookups (banned clients, banned drivers) are clean and the planner handles them efficiently with indexes on `users.users_id`.

#### Solution

```sql
SELECT request_at AS "Day",
       ROUND(AVG((status <> 'completed')::int)::numeric, 2) AS "Cancellation Rate"
FROM trips
WHERE request_at BETWEEN DATE '2013-10-01' AND DATE '2013-10-03'
  AND client_id NOT IN (SELECT users_id FROM users WHERE banned = 'Yes')
  AND driver_id NOT IN (SELECT users_id FROM users WHERE banned = 'Yes')
GROUP BY request_at
ORDER BY request_at;
```

*Source: LeetCode #262 — Trips and Users*

---

### 59. Human Traffic of Stadium

#### Problem

Given `stadium(id, visit_date, people)`, return all rows from runs of three or more consecutive days where `people >= 100`. Order by `visit_date`.

**Schema:**

```
stadium
  id          integer  PRIMARY KEY
  visit_date  date     UNIQUE
  people      integer
```

**Expected output (sample):**

| id | visit_date | people |
|----|------------|--------|
| 5  | 2017-01-05 | 145    |
| 6  | 2017-01-06 | 1455   |
| 7  | 2017-01-07 | 199    |
| 8  | 2017-01-09 | 188    |

#### Pattern

Gaps-and-islands on filtered rows.

#### Explanation

Filter to `people >= 100`, then assign each row a group key by `id - ROW_NUMBER()` over the remaining rows. Group by that key, keep groups of size ≥ 3, and join the qualifying rows back.

#### Solution

```sql
WITH busy AS (
  SELECT id, visit_date, people,
         id - ROW_NUMBER() OVER (ORDER BY id) AS grp
  FROM stadium
  WHERE people >= 100
),
qualifying AS (
  SELECT grp FROM busy GROUP BY grp HAVING COUNT(*) >= 3
)
SELECT b.id, b.visit_date, b.people
FROM busy b
JOIN qualifying q USING (grp)
ORDER BY b.visit_date;
```

*Source: LeetCode #601 — Human Traffic of Stadium*

---

### 60. Median Employee Salary

#### Problem

Given `employee(id, company, salary)`, return the median salary row(s) per company. If the row count is even, return the two middle rows; if odd, the single middle row.

**Schema:**

```
employee
  id       integer  PRIMARY KEY
  company  varchar
  salary   integer
```

**Expected output (sample):**

| id | company | salary |
|----|---------|--------|
| 5  | A       | 7500   |
| 8  | B       | 6000   |
| 11 | B       | 5000   |

#### Pattern

Window-based median: row-number + total count.

#### Explanation

For each row, compute its rank within company by salary and the company's row count. The median rows satisfy `2 * rn ∈ {count, count+1, count+2}` — three positions that cover both odd and even cases.

#### Solution

```sql
SELECT id, company, salary
FROM (
  SELECT id, company, salary,
         ROW_NUMBER() OVER (PARTITION BY company ORDER BY salary, id) AS rn,
         COUNT(*)     OVER (PARTITION BY company)                     AS cnt
  FROM employee
) t
WHERE 2 * rn IN (cnt, cnt + 1, cnt + 2);
```

*Source: LeetCode #569 — Median Employee Salary*

---

### 61. Find Median Given Frequency of Numbers

#### Problem

Given `numbers(num, frequency)` representing a multiset, return the median value. The dataset can be very large (frequencies in the thousands).

**Schema:**

```
numbers
  num        integer  PRIMARY KEY
  frequency  integer
```

**Expected output (sample):**

| median |
|--------|
| 2.5000 |

#### Pattern

Cumulative frequency + median position.

#### Explanation

Sort by `num`, compute the running sum of frequencies, and find rows where the cumulative range straddles the median position. Works in one pass even for billions of logical elements — that's the whole point of the frequency encoding.

#### Solution

```sql
WITH cum AS (
  SELECT num, frequency,
         SUM(frequency) OVER (ORDER BY num)                  AS running,
         SUM(frequency) OVER ()                              AS total
  FROM numbers
)
SELECT AVG(num)::numeric(10, 4) AS median
FROM cum
WHERE running       >= total / 2.0
  AND running - frequency <= total / 2.0;
```

*Source: LeetCode #571 — Find Median Given Frequency of Numbers*

---

### 62. Tournament Winners

#### Problem

Given `players(player_id, group_id)` and `matches(match_id, first_player, second_player, first_score, second_score)`, return the winner per group — the player with the highest total score. Ties go to the smallest `player_id`.

**Schema:**

```
players
  player_id  integer  PRIMARY KEY
  group_id   integer

matches
  match_id       integer  PRIMARY KEY
  first_player   integer  FK → players
  second_player  integer  FK → players
  first_score    integer
  second_score   integer
```

**Expected output (sample):**

| group_id | player_id |
|----------|-----------|
| 1        | 15        |
| 2        | 35        |
| 3        | 40        |

#### Pattern

Union-unfold scores + top-1 per group with tie-break.

#### Explanation

Unfold each match into two score rows via `UNION ALL`, sum per player, join group, then top-1 per group with `ROW_NUMBER` ordered by `(total DESC, player_id ASC)`. Cleaner than a `MAX`-then-rejoin which can't break ties by id.

#### Solution

```sql
WITH scores AS (
  SELECT first_player  AS player_id, first_score  AS score FROM matches
  UNION ALL
  SELECT second_player,                second_score        FROM matches
),
totals AS (
  SELECT p.group_id, p.player_id, COALESCE(SUM(s.score), 0) AS total
  FROM players p
  LEFT JOIN scores s USING (player_id)
  GROUP BY p.group_id, p.player_id
)
SELECT group_id, player_id
FROM (
  SELECT group_id, player_id,
         ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY total DESC, player_id) AS rn
  FROM totals
) t
WHERE rn = 1
ORDER BY group_id;
```

*Source: LeetCode #1194 — Tournament Winners*

---

### 63. Report Contiguous Dates

#### Problem

Given `failed(fail_date)` and `succeeded(success_date)` with no overlap between the two sets and all dates within 2019, return each maximal contiguous run as (`period_state`, `start_date`, `end_date`) where `period_state` is `'failed'` or `'succeeded'`.

**Schema:**

```
failed
  fail_date  date  PRIMARY KEY

succeeded
  success_date  date  PRIMARY KEY
```

**Expected output (sample):**

| period_state | start_date | end_date   |
|--------------|------------|------------|
| succeeded    | 2019-01-01 | 2019-01-03 |
| failed       | 2019-01-04 | 2019-01-05 |
| succeeded    | 2019-01-06 | 2019-01-06 |

#### Pattern

Union + gaps-and-islands keyed by `(state, date - row_number)`.

#### Explanation

Unify into one stream with a state label. Within each state, contiguous date runs are isolated by `date - ROW_NUMBER()` partitioned on state. Group by `(state, key)`.

#### Solution

```sql
WITH days AS (
  SELECT 'failed'    AS period_state, fail_date AS d
  FROM failed WHERE fail_date BETWEEN DATE '2019-01-01' AND DATE '2019-12-31'
  UNION ALL
  SELECT 'succeeded', success_date
  FROM succeeded WHERE success_date BETWEEN DATE '2019-01-01' AND DATE '2019-12-31'
),
keyed AS (
  SELECT period_state, d,
         d - (ROW_NUMBER() OVER (PARTITION BY period_state ORDER BY d) || ' days')::interval AS grp
  FROM days
)
SELECT period_state, MIN(d) AS start_date, MAX(d) AS end_date
FROM keyed
GROUP BY period_state, grp
ORDER BY start_date;
```

*Source: LeetCode #1225 — Report Contiguous Dates*

---

### 64. Capital Gain/Loss

#### Problem

Given `stocks(stock_name, operation, operation_day, price)` where each `'Buy'` is paired with a future `'Sell'` for the same stock, return the net capital gain/loss per stock (sum of sell prices minus sum of buy prices).

**Schema:**

```
stocks
  stock_name     varchar
  operation      varchar  CHECK (operation IN ('Buy','Sell'))
  operation_day  integer
  price          integer
  PRIMARY KEY (stock_name, operation_day)
```

**Expected output (sample):**

| stock_name | capital_gain_loss |
|------------|-------------------|
| Corona     | -45               |
| Leetcode   | 850               |

#### Pattern

Signed aggregation.

#### Explanation

A buy is a negative cashflow, a sell a positive one. Express this with a single `SUM(CASE WHEN operation='Sell' THEN price ELSE -price END)`. No join, no window — one pass.

#### Solution

```sql
SELECT stock_name,
       SUM(CASE WHEN operation = 'Sell' THEN price ELSE -price END) AS capital_gain_loss
FROM stocks
GROUP BY stock_name;
```

*Source: LeetCode #1393 — Capital Gain/Loss*

---

### 65. Find Cumulative Salary of an Employee

#### Problem

Given `employee(id, month, salary)`, for each employee at each month, return the sum of salaries for the latest three months **excluding the most recent month** (the most recent month is hidden — could be in-progress payroll). Skip employees with only one record. Order by `id` ascending, `month` descending.

**Schema:**

```
employee
  id      integer
  month   integer
  salary  integer
  PRIMARY KEY (id, month)
```

**Expected output (sample):**

| id | month | Salary |
|----|-------|--------|
| 1  | 3     | 90     |
| 1  | 2     | 50     |
| 1  | 1     | 20     |

#### Pattern

Window rolling sum + filter on rank.

#### Explanation

For each employee, rank months descending; drop the top-1 (most recent); over the remaining rows, compute `SUM(salary) OVER (... ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)` ordered by month ascending so the "latest three months including current" becomes a backward window.

#### Solution

```sql
WITH ranked AS (
  SELECT id, month, salary,
         ROW_NUMBER() OVER (PARTITION BY id ORDER BY month DESC) AS rn_desc
  FROM employee
),
kept AS (
  SELECT id, month, salary
  FROM ranked
  WHERE rn_desc > 1   -- drop latest
)
SELECT id, month,
       SUM(salary) OVER (
         PARTITION BY id ORDER BY month
         ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
       ) AS "Salary"
FROM kept
ORDER BY id, month DESC;
```

*Source: LeetCode #579 — Find Cumulative Salary of an Employee*

---

### 66. Strong Friendship

#### Problem

Given `friendship(user1_id, user2_id)` (undirected, stored once with `user1_id < user2_id`), return pairs of users who share at least three common friends, with their common-friends count.

**Schema:**

```
friendship
  user1_id  integer
  user2_id  integer
  PRIMARY KEY (user1_id, user2_id)
```

**Expected output (sample):**

| user1_id | user2_id | common_friend |
|----------|----------|---------------|
| 1        | 2        | 3             |
| 1        | 3        | 3             |

#### Pattern

Adjacency unfold + intersection count.

#### Explanation

Build a directed-view of friendships, then for each direct-friendship pair count common neighbours via an inner join on a shared third user. Threshold at 3. The undirected storage means you need the `UNION ALL` unfold.

#### Solution

```sql
WITH edges AS (
  SELECT user1_id AS a, user2_id AS b FROM friendship
  UNION ALL
  SELECT user2_id, user1_id FROM friendship
)
SELECT f.user1_id, f.user2_id, COUNT(*) AS common_friend
FROM friendship f
JOIN edges e1 ON e1.a = f.user1_id
JOIN edges e2 ON e2.a = f.user2_id AND e2.b = e1.b
GROUP BY f.user1_id, f.user2_id
HAVING COUNT(*) >= 3
ORDER BY f.user1_id, f.user2_id;
```

*Source: LeetCode #1949 — Strong Friendship*

---

### 67. Market Analysis I

#### Problem

Given `users(user_id, join_date, favorite_brand)`, `orders(order_id, order_date, item_id, buyer_id, seller_id)`, and `items(item_id, item_brand)`, return for every user their `user_id`, `join_date`, and the number of orders placed in 2019.

**Schema:**

```
users
  user_id          integer  PRIMARY KEY
  join_date        date
  favorite_brand   varchar

orders
  order_id    integer  PRIMARY KEY
  order_date  date
  item_id     integer
  buyer_id    integer  FK → users
  seller_id   integer  FK → users

items
  item_id     integer  PRIMARY KEY
  item_brand  varchar
```

**Expected output (sample):**

| buyer_id | join_date  | orders_in_2019 |
|----------|------------|----------------|
| 1        | 2018-01-01 | 1              |
| 2        | 2018-02-09 | 2              |

#### Pattern

`LEFT JOIN` with year-scoped predicate inside the join condition.

#### Explanation

Subtle: the year predicate must be on the **join** clause, not the `WHERE`. If you put it in `WHERE`, NULL `order_date`s from non-buyers get filtered out and you lose the zero-order users.

#### Solution

```sql
SELECT u.user_id AS buyer_id,
       u.join_date,
       COUNT(o.order_id) AS orders_in_2019
FROM users u
LEFT JOIN orders o
       ON o.buyer_id = u.user_id
      AND o.order_date >= DATE '2019-01-01'
      AND o.order_date <  DATE '2020-01-01'
GROUP BY u.user_id, u.join_date;
```

*Source: LeetCode #1158 — Market Analysis I*

---

### 68. Market Analysis II

#### Problem

Using the same schema as Market Analysis I, return for each user whether their **second-ever** sold item's brand matches their `favorite_brand` (`'yes'` / `'no'`). Users with fewer than two sales return `'no'`.

**Schema:** *(see #67)*

**Expected output (sample):**

| seller_id | 2nd_item_fav_brand |
|-----------|--------------------|
| 1         | no                 |
| 2         | yes                |

#### Pattern

`ROW_NUMBER` over seller history + `LEFT JOIN`.

#### Explanation

Rank each seller's sales chronologically; pick row 2; compare its brand to `favorite_brand`. `LEFT JOIN` so sellers with < 2 sales get a NULL that collapses to `'no'`.

#### Solution

```sql
WITH ranked AS (
  SELECT seller_id, item_id,
         ROW_NUMBER() OVER (PARTITION BY seller_id ORDER BY order_date, order_id) AS rn
  FROM orders
)
SELECT u.user_id AS seller_id,
       CASE
         WHEN i.item_brand = u.favorite_brand THEN 'yes'
         ELSE 'no'
       END AS "2nd_item_fav_brand"
FROM users u
LEFT JOIN ranked r ON r.seller_id = u.user_id AND r.rn = 2
LEFT JOIN items  i ON i.item_id   = r.item_id;
```

*Source: LeetCode #1159 — Market Analysis II*

---

### 69. Page Recommendations II

#### Problem

Given `friendship(user1_id, user2_id)` (undirected, one row per pair) and `likes(user_id, page_id)`, for each user return the pages liked by at least one friend that the user hasn't liked themselves, along with the count of friends who liked each page. Sort by `user_id` ascending, then `friends_likes` descending.

**Schema:**

```
friendship
  user1_id  integer
  user2_id  integer
  PRIMARY KEY (user1_id, user2_id)

likes
  user_id  integer
  page_id  integer
  PRIMARY KEY (user_id, page_id)
```

**Expected output (sample):**

| user_id | page_id | friends_likes |
|---------|---------|---------------|
| 1       | 88      | 2             |
| 1       | 23      | 1             |

#### Pattern

Adjacency unfold + anti-join.

#### Explanation

Unfold friendship both directions, join to friends' likes, then anti-join against the user's own likes. Group and count. Two `LEFT JOIN ... IS NULL` is fine; `NOT EXISTS` is fine. Either way, deduplicate within the friends' likes per page first.

#### Solution

```sql
WITH edges AS (
  SELECT user1_id AS u, user2_id AS f FROM friendship
  UNION ALL
  SELECT user2_id, user1_id FROM friendship
),
friend_likes AS (
  SELECT DISTINCT e.u AS user_id, l.page_id, l.user_id AS friend_id
  FROM edges e
  JOIN likes l ON l.user_id = e.f
)
SELECT fl.user_id, fl.page_id, COUNT(DISTINCT fl.friend_id) AS friends_likes
FROM friend_likes fl
WHERE NOT EXISTS (
  SELECT 1 FROM likes l2
  WHERE l2.user_id = fl.user_id AND l2.page_id = fl.page_id
)
GROUP BY fl.user_id, fl.page_id
ORDER BY fl.user_id, friends_likes DESC;
```

*Source: LeetCode #1729 / community — Page Recommendations II*

---

### 70. Number of Transactions per Visit

#### Problem

Given `visits(user_id, visit_date)` and `transactions(user_id, transaction_date, amount)` (a single visit can have many transactions on the same date), return a frequency distribution: for each `transactions_count` from 0 up to the maximum observed, how many visits had exactly that many transactions.

**Schema:**

```
visits
  user_id     integer
  visit_date  date

transactions
  user_id           integer
  transaction_date  date
  amount            integer
```

**Expected output (sample):**

| transactions_count | visits_count |
|--------------------|--------------|
| 0                  | 4            |
| 1                  | 5            |
| 2                  | 1            |
| 3                  | 0            |

#### Pattern

Visit-level counts joined with a `generate_series` range.

#### Explanation

Two-step problem: first count transactions per visit (with `LEFT JOIN`, including zero-transaction visits), then bin by count. The missing piece — empty bins like `3` — needs a dense range from `generate_series(0, max_count)` joined with the histogram.

#### Solution

```sql
WITH per_visit AS (
  SELECT v.user_id, v.visit_date,
         COUNT(t.user_id) AS tx_cnt
  FROM visits v
  LEFT JOIN transactions t
         ON t.user_id          = v.user_id
        AND t.transaction_date = v.visit_date
  GROUP BY v.user_id, v.visit_date
),
hist AS (
  SELECT tx_cnt, COUNT(*) AS visits_count
  FROM per_visit
  GROUP BY tx_cnt
),
bounds AS (
  SELECT COALESCE(MAX(tx_cnt), 0) AS hi FROM per_visit
)
SELECT g.n            AS transactions_count,
       COALESCE(h.visits_count, 0) AS visits_count
FROM bounds b,
     generate_series(0, b.hi) AS g(n)
LEFT JOIN hist h ON h.tx_cnt = g.n
ORDER BY transactions_count;
```

*Source: LeetCode #1336 — Number of Transactions per Visit*

---

### 71. Find the Quiet Students in All Exams

#### Problem

Given `student(student_id, student_name)` and `exam(exam_id, student_id, score)`, return the "quiet" students — those who took at least one exam and in every exam they took, their score is strictly between (not equal to) the minimum and maximum of that exam.

**Schema:**

```
student
  student_id    integer  PRIMARY KEY
  student_name  varchar

exam
  exam_id     integer
  student_id  integer  FK → student
  score       integer
  PRIMARY KEY (exam_id, student_id)
```

**Expected output (sample):**

| student_id | student_name |
|------------|--------------|
| 2          | Quiet Stu    |

#### Pattern

Window MIN/MAX per exam + universal-quantifier filter.

#### Explanation

Per-exam `MIN`/`MAX` via window. A student qualifies iff *every* one of their exams has score strictly between extremes — express as "no exam where they're at an extreme" via `NOT EXISTS`.

#### Solution

```sql
WITH scored AS (
  SELECT exam_id, student_id, score,
         MIN(score) OVER (PARTITION BY exam_id) AS lo,
         MAX(score) OVER (PARTITION BY exam_id) AS hi
  FROM exam
)
SELECT s.student_id, s.student_name
FROM student s
WHERE EXISTS (SELECT 1 FROM scored WHERE student_id = s.student_id)
  AND NOT EXISTS (
    SELECT 1 FROM scored sc
    WHERE sc.student_id = s.student_id
      AND (sc.score = sc.lo OR sc.score = sc.hi)
  )
ORDER BY s.student_id;
```

*Source: LeetCode #1412 — Find the Quiet Students in All Exams*

---

### 72. Game Play Analysis V

#### Problem

Given `activity(player_id, device_id, event_date, games_played)`, define each player's "install date" as the date of their first activity. For each install date, return the install count (distinct players who installed that day) and the Day-1 retention rate — the fraction of those players who also played on `install_date + 1`, rounded to two decimals.

**Schema:**

```
activity
  player_id     integer
  device_id     integer
  event_date    date
  games_played integer
  PRIMARY KEY (player_id, event_date)
```

**Expected output (sample):**

| install_dt | installs | Day1_retention |
|------------|----------|----------------|
| 2016-03-01 | 1        | 1.00           |
| 2017-06-25 | 1        | 0.00           |

#### Pattern

First-event window + Day-1 lookup.

#### Explanation

Get each player's install date, group those by date for install counts, then `LEFT JOIN` back to `activity` on `event_date = install_date + 1` for retention.

#### Solution

```sql
WITH installs AS (
  SELECT player_id, MIN(event_date) AS install_dt
  FROM activity
  GROUP BY player_id
)
SELECT i.install_dt,
       COUNT(*)                                              AS installs,
       ROUND(
         AVG((a.event_date IS NOT NULL)::int)::numeric, 2
       )                                                     AS "Day1_retention"
FROM installs i
LEFT JOIN activity a
       ON a.player_id  = i.player_id
      AND a.event_date = i.install_dt + INTERVAL '1 day'
GROUP BY i.install_dt
ORDER BY i.install_dt;
```

*Source: LeetCode community — Game Play Analysis V*

---


## Window Functions — Frames in Anger

Window function frames are where senior candidates separate from mid. The interviewer isn't testing that you know `OVER` — they're testing whether you know that `ROWS BETWEEN N PRECEDING` is a literal row count while `RANGE BETWEEN INTERVAL 'N' DAYS PRECEDING` is a value range, that `EXCLUDE CURRENT ROW` exists, and that under tied `ORDER BY` values the two diverge in ways that are usually a bug. The `GROUPS` mode is the third, less-known option — it counts peer groups rather than rows or values. These 8 problems exercise each frame mode under conditions where the wrong choice silently produces wrong answers, and they push into territory (windowed median, EXCLUDE CURRENT ROW for peer comparison, running VWAP as two windowed sums) where the mid-level "just use ROW_NUMBER" answer falls apart.

### 73. Cumulative Salary of an Employee

#### Problem

Given `employee(id, month, salary)` with at most one row per (employee, month), for each employee compute the cumulative sum of salary over the most recent three months — **excluding the most recent month** (treat it as not-yet-paid). If an employee has only one historical month, that one row is the cumulative.

*Why interviewers ask this: it forces you to combine row-filtering by rank with a trailing-window aggregate in a single pipeline. Candidates who reach for `LIMIT` or a separate aggregation step usually trip over the "exclude latest month, but compute the running sum **as of** each kept month" composition.*

**Tables:** `employee`

**Expected output (sample):**

| id | month | salary |
|----|-------|--------|
| 1  | 3     | 90     |
| 1  | 2     | 50     |
| 1  | 1     | 20     |
| 2  | 1     | 20     |

#### Pattern

Two-stage window: `ROW_NUMBER() OVER (PARTITION BY id ORDER BY month DESC)` to strip the latest month, then `SUM ... OVER (PARTITION BY id ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)` for the trailing-3 sum.

#### Explanation

The headline mechanic is the `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` frame — a literal three-row trailing window evaluated per partition. The naive alternative is a correlated subquery `(SELECT SUM(salary) FROM employee e2 WHERE e2.id = e.id AND e2.month BETWEEN e.month - 2 AND e.month)`; that's O(N²) — once per row over the partition — versus the window function's single O(N log N) sort-and-stream. The frame choice matters: with `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` you get exactly three rows by position; with `RANGE BETWEEN 2 PRECEDING AND CURRENT ROW` you'd get every row whose `month` value is within 2 of the current row's `month`, which silently misbehaves if there's a gap (employee skipped month 4 — `RANGE` collapses to two rows for month 5). `GROUPS BETWEEN 2 PRECEDING AND CURRENT ROW` would count peer groups under the ORDER BY — meaningless here since month is unique per employee, but worth knowing it exists. The "exclude most recent month" trick is done by ranking with `ORDER BY month DESC` and filtering `rn > 1` before the aggregation pass — order matters: the rank must be computed first so the cumulative sum sees the right input set. Edge case: an employee with one row has nothing to sum after stripping; the `WHERE rn > 1` removes them entirely, which matches the spec ("only one historical month" interpreted as "no exclusion possible" yields no output). Final sort is descending so the most-recent kept month leads, matching the LeetCode contract.

#### Solution

```sql
-- Postgres 17/18.
WITH stripped AS (
  -- Rank months newest-first per employee so rn=1 is the month to exclude.
  SELECT id, month, salary,
         ROW_NUMBER() OVER (PARTITION BY id ORDER BY month DESC) AS rn
  FROM employee
)
SELECT id, month,
       -- ROWS BETWEEN: literal row count, not value range — robust against month gaps.
       -- PARTITION BY id keeps the trailing window scoped to one employee.
       SUM(salary) OVER (
         PARTITION BY id ORDER BY month
         ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
       ) AS salary
FROM stripped
WHERE rn > 1            -- drop each employee's most-recent month
ORDER BY id, month DESC;
```

*Source: LeetCode #579 — Cumulative Salary of an Employee*

---

### 74. Longest Winning Streak Per Player

#### Problem

Given `matches(player_id, match_day, result)` where `result` is `'Win'` or `'Loss'`, return for each player their longest consecutive winning streak (count of back-to-back wins ordered by match day). Players who never won return 0.

*Why interviewers ask this: it's the canonical gaps-and-islands shape, and they want to see whether you reach for the `ROW_NUMBER` difference trick or fall back to a slow correlated subquery. The "never won → 0" requirement is the second trap — candidates often drop those players entirely.*

**Tables:** `matches`, `players`

**Expected output (sample):**

| player_id | longest_streak |
|-----------|----------------|
| 1         | 3              |
| 2         | 0              |
| 3         | 5              |

#### Pattern

Gaps-and-islands via two `ROW_NUMBER` windows (`rn_all` over all matches, `rn_res` over wins-only) whose difference is constant within a run of consecutive wins; then `COUNT(*)` per island, `MAX` per player, `LEFT JOIN` from players to keep never-won users.

#### Explanation

The headline trick: for each player, number all matches `rn_all` and number wins-only `rn_res`; their difference `rn_all - rn_res` is invariant across a contiguous run of wins (every win advances both counters by one) and changes on every loss (only `rn_all` advances). Group wins by `(player_id, rn_all - rn_res)` and count — that's the streak length. The naive alternative is a `LAG(result)` chain that flags streak-resets and cumulatively counts them; that works too and is O(N), but the double-`ROW_NUMBER` form is one-pass-friendlier and reads as the textbook idiom. The third alternative — a recursive CTE walking match-by-match — is O(N) but spectacularly slow due to PG's CTE materialization overhead. Tie semantics: if two matches share `match_day`, both `ROW_NUMBER`s pick an arbitrary order, which is fine for streak counting since we only care about the count, not the identity. NULL handling: the `result` column needs a CHECK or your `rn_res` definition silently treats NULLs as non-wins — usually what you want, but worth saying. The `LEFT JOIN ... COALESCE(..., 0)` on the players table is the only way to surface never-won players as zero; an `INNER JOIN` plus a `UNION ALL` of "missing players with 0" works but is messier. Edge case: a player whose only win is the first row gets a streak of 1, which is correct — the threshold for "streak" being 2+ isn't in the spec.

#### Solution

```sql
-- Postgres 17/18.
WITH numbered AS (
  SELECT player_id, match_day, result,
         -- rn_all advances on every match
         ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY match_day) AS rn_all,
         -- rn_res advances only within the result class — wins or losses
         ROW_NUMBER() OVER (PARTITION BY player_id, result ORDER BY match_day) AS rn_res
  FROM matches
),
streaks AS (
  -- (rn_all - rn_res) is constant inside a contiguous win run; group it.
  SELECT player_id, COUNT(*) AS streak_len
  FROM numbered
  WHERE result = 'Win'
  GROUP BY player_id, rn_all - rn_res
)
SELECT p.player_id,
       -- COALESCE turns never-won (NULL after LEFT JOIN) into 0 per spec.
       COALESCE(MAX(s.streak_len), 0) AS longest_streak
FROM players p
LEFT JOIN streaks s ON s.player_id = p.player_id
GROUP BY p.player_id
ORDER BY p.player_id;
```

*Source: LeetCode #2173 — Longest Winning Streak*

---

### 75. Trailing 7-Day Active User Average

#### Problem

Given `activity(user_id, activity_date)` (at most one row per user-day), for each calendar date in the data return the count of distinct users active in the trailing 7-day window ending on that date (inclusive), and the 7-day moving average rounded to two decimals. Output sorted by date.

**Tables:** `activity`

**Expected output (sample):**

| activity_date | active_users | avg_active |
|---------------|--------------|------------|
| 2026-04-01    | 5            | 5.00       |
| 2026-04-02    | 7            | 6.00       |
| 2026-04-08    | 12           | 8.43       |

*Why interviewers ask this: it's the canonical "do you reach for `RANGE BETWEEN INTERVAL` or do you compute trailing windows with `ROWS BETWEEN 6 PRECEDING`" probe. The two diverge the moment there's a missing day. Senior candidates state which they're using and why.*

#### Pattern

Aggregate-per-day pre-rollup + windowed `SUM/AVG OVER (ORDER BY activity_date RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW)` — value-based range frame, not positional.

#### Explanation

The headline mechanic is the `RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW` frame — Postgres defines the window by the *value* of the `ORDER BY` column, so a missing day still sits inside its own trailing 7-day window. The naive `ROWS BETWEEN 6 PRECEDING` form is wrong here: if April 3rd has no activity, the row for April 8th's window contains the seven most recent rows in the table, which might span 9 calendar days. `RANGE` with an interval is the only positionally-correct choice when the time series is sparse. `GROUPS BETWEEN 6 PRECEDING` would treat ties as one group (irrelevant after pre-aggregation, but in a multi-row-per-day dataset, `GROUPS` is the right choice for "trailing 7 distinct days"). The naive alternative is a correlated subquery `(SELECT COUNT(DISTINCT user_id) FROM activity a2 WHERE a2.activity_date BETWEEN a.activity_date - 6 AND a.activity_date)` — works, but O(N²) and the planner usually can't decorrelate. The trade noted in the prompt: window-`SUM` over pre-aggregated daily counts is not the same as "distinct users across the 7-day window" — a user active on day 1 and day 3 is counted twice. For exact rolling-distinct, drop the pre-rollup and use a correlated subquery or HyperLogLog (`pgx_hll` extension). NULL behaviour: `activity_date` is assumed NOT NULL; if nullable, `ORDER BY` puts NULLs last and the frame misbehaves. Edge case: the first six days have a frame shorter than 7 — `AVG` divides by the actual frame size, so early values look noisy.

#### Solution

```sql
-- Postgres 17/18.
WITH per_day AS (
  -- Pre-aggregate to one row per day so the window has a uniform spine.
  SELECT activity_date, COUNT(DISTINCT user_id) AS daily_users
  FROM activity
  GROUP BY activity_date
)
SELECT activity_date,
       -- RANGE BETWEEN INTERVAL: value-based frame; missing days do not collapse it.
       -- Compare ROWS BETWEEN 6 PRECEDING which would span variable calendar widths.
       SUM(daily_users) OVER (
         ORDER BY activity_date
         RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
       ) AS active_users,
       -- Same frame for the moving average — Postgres reuses the window evaluation.
       ROUND(AVG(daily_users) OVER (
         ORDER BY activity_date
         RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
       )::numeric, 2) AS avg_active
FROM per_day
ORDER BY activity_date;
```

*Source: LeetCode #1097 — Game Play Analysis V (adapted to trailing-7-day form)*

---

### 76. Median Salary Per Department Excluding Self

#### Problem

For each row in `employee(id, dept_id, salary)`, return the median salary of *all other* employees in the same department (exclude the current row). If the department has only one row, return NULL.

**Tables:** `employee`

**Expected output (sample):**

| id | dept_id | salary | peer_median |
|----|---------|--------|-------------|
| 1  | A       | 100    | 75.00       |
| 2  | A       | 80     | 90.00       |
| 3  | A       | 70     | 90.00       |
| 4  | B       | 50     | NULL        |

*Why interviewers ask this: this is the trap question for window functions — candidates assume `PERCENTILE_CONT` works as a window function (it doesn't in Postgres) and lose 5 minutes before pivoting. Senior candidates name the limitation immediately and reach for `LATERAL`.*

#### Pattern

`LATERAL` correlated join recomputing `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary)` per row, scoped to same-department peers with `id <> e.id` — ordered-set aggregate, no window form available.

#### Explanation

The headline constraint: Postgres has no windowed `PERCENTILE_CONT` — it's exclusively an ordered-set aggregate (`WITHIN GROUP`). You can't write `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) OVER (PARTITION BY dept_id)` — the parser rejects it. The clean form is `LATERAL` joining a per-row aggregate. The naive alternative is a correlated scalar subquery in the SELECT list — semantically identical, but `LATERAL` reads as intent and composes if you later need to project additional aggregates (mean, stddev, max) from the same peer set without re-executing the scan. The expensive-but-portable alternative is `ROW_NUMBER()`-based middle-row picking: rank peers, count them, pick the middle one (or average two for even counts) — 30 lines of code where `PERCENTILE_CONT` is one. The performance shape: per row we re-scan the department's rows, so the cost is O(N·k̄) where k̄ is the average department size. For 10K employees across 100 departments that's 1M operations — fast. For 1M employees with one giant department, it's catastrophic — materialise the sorted salary array once per department in a CTE and probe positionally. NULL semantics: `WITHIN GROUP (ORDER BY salary)` ignores NULL salaries by ordered-set aggregate convention; if NULL salaries should count as missing, that's correct. Empty peer set (department of size 1): `PERCENTILE_CONT` over zero rows returns NULL by SQL standard — matches the spec exactly. Tie semantics: `PERCENTILE_CONT` interpolates between the two middle values for even counts; `PERCENTILE_DISC` would return one of them — use `CONT` for salaries (continuous quantity).

#### Solution

```sql
-- Postgres 17/18.
SELECT e.id, e.dept_id, e.salary, m.peer_median
FROM employee e
LEFT JOIN LATERAL (
  -- LATERAL because we need to reference e.dept_id and e.id from the outer row.
  -- PERCENTILE_CONT is an ordered-set aggregate — no windowed form in Postgres.
  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.salary) AS peer_median
  FROM employee p
  WHERE p.dept_id = e.dept_id
    AND p.id <> e.id  -- "excluding self" — drops the current row from the peer set
) m ON TRUE          -- LEFT JOIN: empty peer set yields NULL median, per spec
ORDER BY e.dept_id, e.salary DESC;
```

*Source: Folk interview question — Two Sigma quant-dev screen*

---

### 77. Stock Price High-Water Mark and Drawdown

#### Problem

Given `prices(ticker, ts, px)` of intraday tick prices, for each row compute the running maximum price seen so far for that ticker and the drawdown percentage from that high (current_px / running_max − 1). Output the rows where drawdown is worse than −5%.

**Tables:** `prices`

**Expected output (sample):**

| ticker | ts                    | px      | hwm     | drawdown |
|--------|-----------------------|---------|---------|----------|
| AAPL   | 2026-05-12 09:35:01   | 184.20  | 195.00  | -0.0554  |
| AAPL   | 2026-05-12 09:41:00   | 182.10  | 195.00  | -0.0662  |

*Why interviewers ask this: it probes whether you know the explicit frame syntax for "running anything" and whether you understand the `ROWS` vs `RANGE` default. The look-ahead trap on tied timestamps is the senior-vs-mid filter.*

#### Pattern

Running aggregate via `MAX(px) OVER (PARTITION BY ticker ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` — explicit `ROWS` frame to avoid `RANGE` look-ahead on ts ties.

#### Explanation

The headline mechanic is the running-max window with an explicit `ROWS` frame. Even though `MAX(px) OVER (PARTITION BY ticker ORDER BY ts)` would work for this data (no ties expected on `ts` since it's intraday-microsecond), the explicit `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` is the correct senior form because it makes the look-ahead semantics deterministic. The frame divergence matters: with `ROWS`, two ticks sharing the exact same `ts` are processed in physical-storage order — only earlier rows are in the frame. With the default `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, the tied row's *peer* is included in the frame, which means the current row sees the tied row's price as part of its own high-water mark — a one-tick look-ahead. In an HFT backtest, that look-ahead is a backtest bug that inflates returns. `GROUPS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` would behave like `RANGE` here (each ts value is one group). The naive alternative is a correlated subquery `(SELECT MAX(px) FROM prices p2 WHERE p2.ticker = p.ticker AND p2.ts <= p.ts)` — semantically equivalent but O(N²); the window form is one sort + one streaming pass. Edge case: the very first tick has `hwm = px` so `drawdown = 0` — correctly filtered out by the `< -0.05` predicate. Division by zero: only if `hwm = 0`, which shouldn't occur for prices; in production, `NULLIF(hwm, 0)` guards. NULL handling: `MAX` ignores NULL prices, which is usually correct.

#### Solution

```sql
-- Postgres 17/18.
WITH hwm AS (
  SELECT ticker, ts, px,
         -- Explicit ROWS frame: deterministic, no look-ahead on ts ties.
         -- Default RANGE would include peer rows at the same ts — backtest bug.
         MAX(px) OVER (
           PARTITION BY ticker ORDER BY ts
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS hwm
  FROM prices
)
SELECT ticker, ts, px, hwm,
       ROUND((px / hwm - 1)::numeric, 4) AS drawdown
FROM hwm
WHERE px / hwm - 1 < -0.05   -- worse than -5% drawdown
ORDER BY ticker, ts;
```

*Source: Folk interview question — Citadel SQL screen (drawdown calc)*

---

### 78. NTILE Decile Bucketing with Tie Stability

#### Problem

Given `customers(id, lifetime_value)`, assign each customer a decile (1=lowest, 10=highest) by lifetime value such that customers with identical lifetime value always land in the same decile — never split across bucket boundaries.

**Tables:** `customers`

**Expected output (sample):**

| id | lifetime_value | decile |
|----|----------------|--------|
| 17 | 0              | 1      |
| 42 | 250            | 5      |
| 19 | 250            | 5      |
| 88 | 9999           | 10     |

*Why interviewers ask this: `NTILE` looks like it does the right thing until the tie semantics bite. Senior candidates know that `NTILE(10)` splits ties across buckets when the partition size doesn't divide evenly, and they reach for the two-stage decile-the-distinct-values fix.*

#### Pattern

Two-stage NTILE: `DENSE_RANK` (or `DISTINCT`) extracts the unique value set, `NTILE(10) OVER (ORDER BY lifetime_value)` buckets the distinct values, then join back — tie-safe bucketing.

#### Explanation

The headline trap: `NTILE(n)` distributes rows evenly across n buckets, but it's row-based, not value-based. With 1000 rows and `NTILE(10)`, each bucket gets exactly 100 rows. If row 100 and row 101 have identical `lifetime_value` (a tie), they land in different buckets — bucket 1 and bucket 2. That violates the "ties land together" requirement. The fix is to `NTILE` the *distinct values* (each appears once) and join back — guaranteeing that all rows with the same value get the same bucket. The naive alternative — `NTILE(10) OVER (ORDER BY lifetime_value, id)` — adds a deterministic tie-breaker but still splits ties across buckets, just deterministically; the spec specifically forbids this. A `WIDTH_BUCKET`-based approach works if values are uniformly distributed: `WIDTH_BUCKET(lifetime_value, MIN(lifetime_value) OVER (), MAX(lifetime_value) OVER () + 1, 10)` — buckets by value range, not population, so ties co-locate by construction. But for skewed distributions (a long tail of high-LTV customers) `WIDTH_BUCKET` produces wildly unequal bucket populations; `NTILE(distinct_values)` keeps the population somewhat balanced. The trade-off: tie-safety vs equal bucket sizes — pick based on the downstream use case. The query has an alternative single-CTE form using `PERCENTILE_DISC` over an `array[0.1, 0.2, ..., 1.0]` of cut points, but the join form is clearer. Edge case: if fewer than 10 distinct values exist, `NTILE(10)` produces some empty buckets — the join still works; some decile values simply don't appear in the output. NULL handling: `lifetime_value` NULLs go to the highest bucket under default `ORDER BY NULLS LAST` — usually wrong; `COALESCE(lifetime_value, 0)` upfront if NULL means "no purchases yet".

#### Solution

```sql
-- Postgres 17/18.
WITH ranked AS (
  -- DENSE_RANK gives a per-row rank that handles ties uniformly.
  SELECT id, lifetime_value,
         DENSE_RANK() OVER (ORDER BY lifetime_value) AS dr,
         COUNT(*) OVER () AS n_total
  FROM customers
),
distinct_buckets AS (
  -- NTILE the DISTINCT value set, not the rows — ties cannot split across buckets.
  SELECT lifetime_value,
         NTILE(10) OVER (ORDER BY lifetime_value) AS decile
  FROM (SELECT DISTINCT lifetime_value FROM customers) d
)
SELECT r.id, r.lifetime_value, db.decile
FROM ranked r
JOIN distinct_buckets db USING (lifetime_value)  -- join back on the value
ORDER BY r.lifetime_value, r.id;
```

*Source: Folk interview question — Stripe data-eng screen*

---

### 79. EXCLUDE CURRENT ROW for Peer-Comparison Z-Score

#### Problem

Given `salaries(emp_id, dept_id, salary)`, for each employee compute a within-department z-score using the mean and stddev of **only their peers** (exclude themselves). Departments of size 1 should yield NULL.

**Tables:** `salaries`

**Expected output (sample):**

| emp_id | dept_id | salary | z      |
|--------|---------|--------|--------|
| 1      | A       | 100    | 1.41   |
| 2      | A       | 80     | 0.00   |
| 3      | A       | 60     | -1.41  |
| 9      | C       | 70     | NULL   |

*Why interviewers ask this: they want to see whether you know the `EXCLUDE CURRENT ROW` frame clause (added in PG 11) — the senior-vs-mid signal is whether you reach for it or for a self-join-and-subtract.*

#### Pattern

Full-partition aggregate window with `EXCLUDE CURRENT ROW`: `AVG/STDDEV_SAMP OVER (PARTITION BY dept_id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING EXCLUDE CURRENT ROW)` — peer aggregates without the self row, single pass.

#### Explanation

The headline mechanic is the `EXCLUDE CURRENT ROW` clause — when added to a window frame, the current row is dropped from the aggregate's input. Combined with `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`, the aggregate sees the whole partition minus the current row, which is exactly "peers". The naive alternative is the textbook self-join-and-subtract: compute `dept_avg = AVG(salary)` per department, then back out the current row's contribution arithmetically — `peer_avg = (dept_avg * n - salary) / (n - 1)`. That works for `AVG` but doesn't for `STDDEV` without re-deriving sum-of-squares — three pages of arithmetic where `EXCLUDE CURRENT ROW` is one clause. A second alternative is a correlated subquery `(SELECT AVG(s2.salary) FROM salaries s2 WHERE s2.dept_id = s.dept_id AND s2.emp_id <> s.emp_id)` — O(N²), planner can't decorrelate cleanly. `EXCLUDE` variants beyond `CURRENT ROW`: `EXCLUDE GROUP` drops the current row and all its peers under the `ORDER BY` (irrelevant here — no `ORDER BY`); `EXCLUDE TIES` drops only the peers, keeping the current row; `EXCLUDE NO OTHERS` is the default. NULL behaviour: `STDDEV_SAMP` over zero or one row returns NULL (no degrees of freedom for sample std dev) — `NULLIF(..., 0)` guards against a zero-stddev department where everyone earns identically, which would otherwise cause division-by-zero. Edge case: departments of size 1 — `EXCLUDE CURRENT ROW` leaves zero peers, `STDDEV_SAMP` returns NULL, the `z` column is NULL by NULL-propagation. Exactly matches the spec.

#### Solution

```sql
-- Postgres 17/18.
SELECT emp_id, dept_id, salary,
       ROUND(
         -- Per-row z-score against the peer-mean and peer-stddev.
         ((salary - AVG(salary) OVER w)
           / NULLIF(STDDEV_SAMP(salary) OVER w, 0))::numeric, 2
       ) AS z
FROM salaries
WINDOW w AS (
  -- Full partition minus the current row = peers only.
  -- EXCLUDE CURRENT ROW (PG 11+) drops the self row from the aggregate input.
  PARTITION BY dept_id
  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  EXCLUDE CURRENT ROW
)
ORDER BY dept_id, salary DESC;
```

*Source: Original — Advanced SQL Practice*

---

### 80. Time-Weighted Average Price (VWAP) by Bar

#### Problem

Given tick-level `trades(ticker, ts, px, qty)`, compute the 1-minute VWAP per ticker per minute bar: VWAP = Σ(px·qty) / Σ(qty) over the minute. Within each minute, also emit the running VWAP up to each tick (anytime-VWAP — needed for execution analytics).

**Tables:** `trades`

**Expected output (sample):**

| ticker | bar_minute            | tick_ts                | px      | qty | running_vwap |
|--------|-----------------------|------------------------|---------|-----|--------------|
| MSFT   | 2026-05-12 10:14:00   | 2026-05-12 10:14:02    | 410.20  | 100 | 410.2000     |
| MSFT   | 2026-05-12 10:14:00   | 2026-05-12 10:14:55    | 410.50  | 300 | 410.4250     |

*Why interviewers ask this: VWAP is a textbook execution-desk metric. The trap is candidates writing `AVG(px) OVER (...)` — which is mean price, not volume-weighted. Senior candidates immediately compose it as two windowed sums.*

#### Pattern

Two co-windowed running sums divided: `SUM(px*qty) OVER w / SUM(qty) OVER w` with `w = PARTITION BY ticker, date_trunc('minute', ts) ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` — Postgres reuses the window evaluation across both sums.

#### Explanation

The headline mechanic is decomposing the ratio statistic VWAP = Σ(px·qty)/Σ(qty) into two `SUM` aggregates over the same window, which Postgres evaluates in one streaming pass per partition. Two-co-windowed-sums is a general pattern for any ratio-of-cumulative metric (running gross margin, running fill rate, running on-time%). The naive alternative — `AVG(px) OVER (...)` — is wrong: it gives the arithmetic mean of tick prices, ignoring quantity. A 100-share trade at \$100 and a 1-share trade at \$50 have `AVG(px) = 75` but `VWAP = 99.50`. The second naive alternative — computing `px*qty` in a CTE then averaging — also wrong; you need the ratio of sums, not the mean of products. Frame choice matters: for bar-final VWAP, use the unbounded-following frame (`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`); for running VWAP, use the prefix frame as shown. `ROWS` vs `RANGE`: at sub-second tick resolution, `ts` is unique so both are equivalent — but `ROWS` is the right HFT default to avoid look-ahead on tied timestamps (see problem #5 for the discussion). Partition key: `(ticker, date_trunc('minute', ts))` — the minute floor is the bar key. NULL handling: trades with NULL `qty` shouldn't exist (exchange data is complete), but `NULLIF(SUM(qty), 0)` guards against a zero-volume minute. Numeric overflow: SUM(px·qty) at SF1000 trade volumes can exceed numeric(38, ...) precision — cast to `numeric(38, 6)` upfront.

#### Solution

```sql
-- Postgres 17/18.
SELECT ticker,
       date_trunc('minute', ts) AS bar_minute,
       ts AS tick_ts,
       px, qty,
       -- VWAP = Σ(px·qty) / Σ(qty) — two co-windowed sums, Postgres evaluates in one pass.
       -- NULLIF guards a zero-volume minute (division-by-zero).
       ROUND(
         (SUM(px * qty) OVER w / NULLIF(SUM(qty) OVER w, 0))::numeric, 4
       ) AS running_vwap
FROM trades
WINDOW w AS (
  -- Partition by ticker AND minute-bar: each minute is its own VWAP.
  -- ROWS frame: no look-ahead on tied timestamps (HFT correctness).
  PARTITION BY ticker, date_trunc('minute', ts)
  ORDER BY ts
  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
)
ORDER BY ticker, ts;
```

*Source: Folk interview question — Jane Street / Two Sigma execution-desk screen*

---

## Recursive CTEs as Graph Algorithms

Recursive CTEs in SQL are the only way to express transitive reachability without an external loop. Interviewers use them as a proxy for "can you implement BFS, Dijkstra-style relaxation, or topological sort in declarative SQL?" — algorithms candidates can usually code imperatively but stumble over in set-based form. The two non-negotiable concerns are termination (cycles will hang the query forever without a `path` array or depth bound) and duplicate-row pruning (`UNION` dedupes per iteration; `UNION ALL` is faster but can explode on graphs with multiple paths to the same node). These 7 problems span tree traversal, transitive closure, shortest-path, BOM explosion, and cycle detection — every recursive-CTE primitive an interviewer might probe.

### 81. Hopper Company Active Driver-Days

#### Problem

Given `drivers(driver_id, join_date)` (where `join_date` is the first month a driver could accept rides) and `rides(ride_id, driver_id, requested_at)` plus `accepted_rides(ride_id, driver_id)`, for each of the 12 months of 2020 output: total active drivers (anyone whose join_date ≤ month-end), and the number of accepted rides that month. Include zero-row months explicitly.

**Tables:** `drivers`, `rides`, `accepted_rides`

**Expected output (sample):**

| month | active_drivers | accepted |
|-------|----------------|----------|
| 1     | 8              | 0        |
| 2     | 11             | 4        |
| 12    | 50             | 31       |

*Why interviewers ask this: the trap is forgetting zero-ride months. Candidates who join from `rides` instead of from a month-spine drop those months silently. The recursive-CTE form also tests basic anchor + recursive-step composition.*

#### Pattern

Recursive month-spine via `WITH RECURSIVE months(m) AS (SELECT 1 UNION ALL SELECT m+1 FROM months WHERE m < 12)` + `LEFT JOIN LATERAL` per-month aggregates — spine drives the join so missing months survive.

#### Explanation

The algorithm being mimicked is iterative count-up — the anchor seeds month 1, the recursive step adds 1 until the bound (`m < 12`), terminating when no new rows are produced. `UNION ALL` is correct here (each iteration produces one new value, no dedupe needed); `UNION` would still work but force an extra hash-distinct per step. The naive alternative — `generate_series(1, 12)` — works and is what most candidates reach for; the recursive form is what LC #1635 specifically tests. The structural trap is the join direction: joining `rides` to `months` (rides as driver) drops months with no rides; the senior form is `months LEFT JOIN LATERAL (aggregate of rides)` — the spine drives. `LATERAL` lets the aggregate reference the outer `m`; without `LATERAL`, the per-month aggregate would have to be a correlated subquery in SELECT. Termination: the bounded recursion (`WHERE m < 12`) is the safety net — no path-array needed because there's no graph cycle, only a counter. Edge case: leap years aren't relevant since the spine is just 1..12 integers, but if the spine were dates (`generate_series(date, date, interval)`), February's 29-day variation would matter for month-end calculations — here `make_date(2020, m, 1) + INTERVAL '1 month' - INTERVAL '1 day'` is the safe form. NULL handling: `LEFT JOIN LATERAL ... ON TRUE` plus `COALESCE(a.cnt, 0)` turns months with no rides into a zero count, matching the spec.

#### Solution

```sql
-- Postgres 17/18.
WITH RECURSIVE months(m) AS (
  -- Anchor: month 1.
  SELECT 1
  UNION ALL
  -- Recursive step: increment, bounded by m < 12 so termination is automatic.
  SELECT m + 1 FROM months WHERE m < 12
)
SELECT m AS month,
       -- Active drivers as of month-end — scalar subquery per month.
       (SELECT COUNT(*) FROM drivers d
        WHERE d.join_date <= make_date(2020, m, 1) + INTERVAL '1 month' - INTERVAL '1 day')
         AS active_drivers,
       COALESCE(a.cnt, 0) AS accepted    -- zero-fill for months with no accepted rides
FROM months
LEFT JOIN LATERAL (
  -- LATERAL lets the inner aggregate reference the outer m.
  SELECT COUNT(*) AS cnt
  FROM accepted_rides ar
  JOIN rides r ON r.ride_id = ar.ride_id
  WHERE EXTRACT(MONTH FROM r.requested_at) = m
    AND EXTRACT(YEAR FROM r.requested_at) = 2020
) a ON TRUE     -- LEFT JOIN preserves months with zero rides
ORDER BY m;
```

*Source: LeetCode #1635 — Hopper Company Queries I*

---

### 82. Transitive Closure of Mutual Friend Suggestions

#### Problem

Given `friendship(u1, u2)` (undirected, stored once with `u1 < u2`), find every pair of users who are connected through some chain of friends — i.e. the transitive closure of the friendship graph. Return distinct unordered pairs with the shortest hop count between them.

**Tables:** `friendship`

**Expected output (sample):**

| user_a | user_b | hops |
|--------|--------|------|
| 1      | 2      | 1    |
| 1      | 5      | 2    |
| 2      | 7      | 3    |

*Why interviewers ask this: it's the canonical recursive-CTE-as-BFS probe. The traps are bidirectionalisation (the storage convention `u1 < u2` is lossy), cycle termination (without a path-array guard the recursion loops forever), and unordered-pair dedup at output time.*

#### Pattern

Recursive CTE BFS layer-by-layer: anchor seeds direct friendships in both directions, recursive step extends one hop along edges with `NOT (next = ANY(path))` cycle-guard, terminates by graph diameter; output dedupes via `LEAST/GREATEST` normalisation and `MIN(hops)` for shortest-path.

#### Explanation

The algorithm being mimicked is BFS — each recursive iteration adds one hop, so the `hops` column is the BFS layer index, and `MIN(hops)` at the end gives shortest-path length. The first correctness trap: the storage convention `u1 < u2` means the graph is undirected but each edge appears once. The `bidir` CTE materialises both directions; without it you'd only discover paths in the "rising id" direction. The second trap: Postgres recursive CTEs have no built-in cycle detection. Without the `NOT (e.b = ANY(b.path))` guard, a 3-cycle `1→2→3→1` would loop until `work_mem` fills (or forever in the absence of the `b.hops < 10` depth bound). The path-array approach is the Tarjan-style cycle detect — accumulate visited nodes into an array, refuse to extend through any already-visited node. `UNION ALL` vs `UNION`: this query uses `UNION ALL` because each iteration produces structurally-different rows (different `path` arrays even for same (src, dst)); `UNION` would attempt to dedupe but the `path` column makes every row unique so it'd be wasted work. The output `GROUP BY LEAST(src, dst), GREATEST(src, dst)` collapses the bidirectional duplicates into unordered pairs and takes `MIN(hops)` for shortest. Performance: O(V²) worst case for transitive closure; for graphs with millions of vertices this is impractical — production systems use materialised reachability tables or graph databases. NULL handling: edges with NULL endpoints are dropped by the equi-join implicitly. Edge case: isolated vertices (no edges) never enter the result — usually correct, but if you need "isolated nodes pair with themselves" semantics, `UNION` a self-pair seed.

#### Solution

```sql
-- Postgres 17/18.
WITH RECURSIVE bidir AS (
  -- Materialise both directions so BFS can walk in either direction.
  SELECT u1 AS a, u2 AS b FROM friendship
  UNION ALL
  SELECT u2, u1 FROM friendship
),
bfs AS (
  -- Anchor: direct edges — every direct friend is one hop.
  SELECT a AS src, b AS dst, 1 AS hops, ARRAY[a, b] AS path
  FROM bidir

  UNION ALL

  -- Recursive step: extend by one edge from the current dst.
  SELECT b.src, e.b, b.hops + 1, b.path || e.b
  FROM bfs b
  JOIN bidir e ON e.a = b.dst
  WHERE NOT (e.b = ANY(b.path))   -- cycle guard: never revisit a node in this path
    AND b.hops < 10                -- depth bound: typical social-graph diameter
)
SELECT LEAST(src, dst) AS user_a,
       GREATEST(src, dst) AS user_b,
       MIN(hops) AS hops          -- shortest path among all discovered paths
FROM bfs
WHERE src <> dst
GROUP BY LEAST(src, dst), GREATEST(src, dst)
ORDER BY user_a, user_b;
```

*Source: DataLemur — "Friends Recommendation" (Meta tag) — adapted*

---

### 83. Hopper Subtask Dependency Resolution

#### Problem

Given `subtasks(task_id, subtask_id)` describing required subtasks per parent task and `executed(task_id, subtask_id)` of completed runs, return the (task, subtask) pairs that still need execution. Subtask ids run 1..N where N is the max declared per task.

**Tables:** `subtasks`, `executed`

**Expected output (sample):**

| task_id | missing_subtask |
|---------|-----------------|
| 1       | 2               |
| 1       | 4               |
| 3       | 1               |

*Why interviewers ask this: it composes recursive enumeration with anti-join — both are senior primitives. The trap is that `subtasks` may not contain every subtask_id from 1..N (the table records "required" subtasks but the spec says ids implicitly run 1..N).*

#### Pattern

Recursive enumeration of 1..N per task (anchor at 1, recursive step `subtask_id + 1` bounded by per-task `MAX`) followed by `EXCEPT` against `executed` — anti-join via set-difference.

#### Explanation

The algorithm being mimicked is per-task counter expansion + anti-join. The anchor seeds (task_id, 1) for every task with its max-subtask-id; the recursive step ticks the subtask counter up by one, terminating when `subtask_id < n` is false. `UNION ALL` is correct because each iteration produces distinct (task, subtask) pairs by construction (the counter is monotone within task). The naive alternative is `generate_series(1, max_subtask) per task` — works in one line via `LATERAL`, but LC #1767 specifically tests the recursive form. The `EXCEPT` is the anti-join: every "should run" pair minus every "already ran" pair equals "still needs to run". The alternative `NOT EXISTS` form would work too, often with a better plan: `WHERE NOT EXISTS (SELECT 1 FROM executed e WHERE e.task_id = ex.task_id AND e.subtask_id = ex.subtask_id)` lets the planner choose hash-anti-join; `EXCEPT` is set semantics and dedupes both sides first, costing an extra sort. NULL handling: `EXCEPT` treats NULL = NULL (unlike `=`), so NULL subtask_ids in `executed` would match against NULL in the expanded set — not an issue here since subtask_id should be NOT NULL. Edge case: tasks where every subtask has run produce no missing rows — correctly empty. Tasks not in `subtasks` at all produce no expanded rows — also correctly empty. Termination: bounded by per-task `n`, so recursion depth = max subtask count; for a task with 10000 subtasks the recursion has 10000 levels, which `max_stack_depth` may complain about — use `generate_series` for large counts.

#### Solution

```sql
-- Postgres 17/18.
WITH RECURSIVE max_per AS (
  -- Per-task ceiling: the highest declared subtask_id.
  SELECT task_id, MAX(subtask_id) AS n FROM subtasks GROUP BY task_id
),
expanded AS (
  -- Anchor: subtask 1 for every task that has any declared subtask.
  SELECT task_id, 1 AS subtask_id, n FROM max_per
  UNION ALL
  -- Recursive step: tick counter up by 1, bounded by per-task max.
  SELECT task_id, subtask_id + 1, n
  FROM expanded
  WHERE subtask_id < n
)
SELECT task_id, subtask_id AS missing_subtask
FROM expanded
EXCEPT      -- set difference: "should run" minus "did run" = "still pending"
SELECT task_id, subtask_id FROM executed
ORDER BY task_id, missing_subtask;
```

*Source: LeetCode #1767 — Find the Subtasks That Did Not Execute*

---

### 84. Shortest Path in a Directed Weighted Graph

#### Problem

Given `edges(src, dst, weight)` (directed, positive weights), return the shortest-path distance from node 1 to every reachable node. Unreachable nodes are omitted.

**Tables:** `edges`

**Expected output (sample):**

| node | distance |
|------|----------|
| 1    | 0        |
| 2    | 5        |
| 5    | 12       |

*Why interviewers ask this: it's the "implement Dijkstra in SQL" question — except you can't, because SQL recursion has no priority queue. Senior candidates name that constraint upfront, pick Bellman-Ford-style relaxation, and discuss when it's catastrophic vs acceptable.*

#### Pattern

Bellman-Ford-style recursive CTE: anchor seeds source at distance 0, recursive step relaxes one edge per iteration accumulating distance and path, output takes `MIN(dist)` per node — cycle-safe via path-array, depth-bounded by graph diameter estimate.

#### Explanation

The algorithm being mimicked is Bellman-Ford edge relaxation — each iteration extends paths by one edge, so after k iterations every reachable-in-k-edges node has at least one candidate distance recorded. The final `MIN(dist) GROUP BY node` picks the shortest. This is *not* Dijkstra: Dijkstra picks the node with minimum tentative distance each round (priority queue), which SQL recursion can't express because each iteration adds *all* one-edge extensions, not the single cheapest. The performance consequence: Bellman-Ford does work proportional to V·E (vs Dijkstra's E log V), and the recursive CTE materialises every candidate path, so memory blows up for dense graphs. The `NOT (e.dst = ANY(p.path))` is the simple-path constraint — a path can't revisit a node. This is *not* a correctness fix for positive-weight graphs (Dijkstra never revisits because it's monotone), but it IS the only thing preventing infinite recursion. The depth bound `array_length(p.path, 1) < 50` caps the path length to 50 hops — too small for some graphs, deliberately small here as a safety. `UNION ALL` vs `UNION`: `UNION ALL` because each path has a distinct `path` array; `UNION` would attempt to dedupe and still find every path unique. Negative weights would require negative-cycle detection — a separate query, usually out of interview scope. NULL handling: edges with NULL weight return NULL distances by NULL-propagation; the `MIN` aggregate ignores them. Edge case: the source node 1 itself: anchor seeds `(1, 0, [1])`, so the output includes `(1, 0)` correctly. Unreachable nodes never appear in any iteration, so they're omitted from output — matches spec.

#### Solution

```sql
-- Postgres 17/18.
WITH RECURSIVE paths AS (
  -- Anchor: source node, distance zero, path containing just the source.
  SELECT 1 AS node, 0::numeric AS dist, ARRAY[1] AS path
  UNION ALL
  -- Recursive step: extend one edge, accumulate distance, append to path.
  SELECT e.dst,
         p.dist + e.weight,
         p.path || e.dst
  FROM paths p
  JOIN edges e ON e.src = p.node
  WHERE NOT (e.dst = ANY(p.path))     -- simple-path constraint + cycle safety
    AND array_length(p.path, 1) < 50  -- depth bound — diameter cap
)
SELECT node, MIN(dist) AS distance     -- shortest among all discovered paths
FROM paths
GROUP BY node
ORDER BY node;
```

*Source: Folk interview question — Two Sigma graph-algos screen*

---

### 85. Reporting Chain with Levels

#### Problem

Given `employees(id, manager_id)`, for each employee output their full reporting chain as an ordered array from the CEO down to themselves, plus their depth. The CEO has `manager_id IS NULL`.

**Tables:** `employees`

**Expected output (sample):**

| id | chain         | depth |
|----|---------------|-------|
| 1  | {1}           | 0     |
| 4  | {1, 2, 4}     | 2     |
| 9  | {1, 2, 5, 9}  | 3     |

*Why interviewers ask this: it tests anchor-direction reasoning. Senior candidates anchor at the root and recurse down (chains accumulate in the correct order); mid-level candidates anchor at leaves, build the chain backwards, and need `array_reverse` at the end.*

#### Pattern

Recursive CTE anchored at root (`manager_id IS NULL`), recursive step extends each subordinate by appending their id to the parent's chain — top-down traversal, path-array carries lineage, depth increments per level.

#### Explanation

The algorithm being mimicked is top-down tree traversal — BFS by reporting level. The anchor seeds the CEO with a singleton path `[ceo_id]` at depth 0; the recursive step joins each row in `chain` with employees whose `manager_id` matches that row's `id`, appending the new id to the chain. The direction matters: anchoring at leaves (people with no reports) and recursing upward would build the chain in reverse — you'd need `array_reverse(chain)` at the end, and you'd also need a separate query to identify leaves (`NOT EXISTS (SELECT 1 FROM employees e2 WHERE e2.manager_id = e.id)`). Anchor-at-root is cleaner and faster. `UNION ALL` is correct because each employee appears exactly once in the result (one path from the CEO to each node in a tree); `UNION` would force a hash-distinct per iteration with no benefit. Termination: the recursion terminates naturally when no employee has a `manager_id` matching any node in the current frontier — the empty join produces no new rows. No explicit cycle guard is needed because in a *well-formed* tree there are no cycles; in production data with potential cycles, add `NOT (e.id = ANY(c.chain))` defensively. NULL handling: the anchor uses `IS NULL` not `=` for `manager_id` since `NULL = NULL` is unknown; the recursive join uses `=` which correctly excludes NULL manager_ids. Edge case: an employee referenced as `manager_id` but absent from `employees` would orphan their subtree — the recursion just doesn't extend to them; surface separately if needed. Multiple CEOs (multiple `manager_id IS NULL` rows) produce multiple trees; the query handles this naturally.

#### Solution

```sql
-- Postgres 17/18.
WITH RECURSIVE chain AS (
  -- Anchor: roots (CEOs) — depth 0, singleton chain.
  SELECT id, ARRAY[id] AS chain, 0 AS depth
  FROM employees
  WHERE manager_id IS NULL    -- NULL-safe form; "=" would fail here

  UNION ALL

  -- Recursive step: each subordinate inherits parent's chain + their own id.
  SELECT e.id, c.chain || e.id, c.depth + 1
  FROM employees e
  JOIN chain c ON e.manager_id = c.id
)
SELECT id, chain, depth
FROM chain
ORDER BY id;
```

*Source: Adapted from Celko, "SQL for Smarties" — nested-set / adjacency hybrid puzzles*

---

### 86. Bill of Materials Total Cost

#### Problem

Given `parts(part_id, base_cost)` and `bom(parent_id, child_id, qty)` describing a multi-level assembly, return the total rolled-up cost of each top-level part. Top-level parts never appear as `child_id`.

**Tables:** `parts`, `bom`

**Expected output (sample):**

| part_id | total_cost |
|---------|------------|
| 100     | 240.50     |
| 200     | 1830.00    |

*Why interviewers ask this: BOM explosion is the manufacturing/ERP test case for recursive CTEs. The traps are (1) identifying roots correctly, (2) carrying the cumulative quantity multiplier through every level, (3) cycle defence even when data is "supposed" to be acyclic.*

#### Pattern

Two-phase recursive: identify roots via `EXCEPT` (parts that never appear as child), then recursive explode anchored at each root with multiplier accumulating as `parent.mult * bom.qty` — terminates by acyclicity (with path-array fallback for malformed data).

#### Explanation

The algorithm being mimicked is depth-first multiplier propagation. Step 1: identify roots — `parts EXCEPT child_id` gives every part not depended on (top-level assemblies). Step 2: for each root, walk down the BOM tree accumulating quantity. The anchor seeds `(root, root, 1.0, [root])` — the root contributes its own base cost at multiplier 1. The recursive step joins each `(root, node)` pair to bom rows where `node` is the parent, producing `(root, child, mult * qty, path || child)` — child's effective quantity is the parent's multiplier times the bom row's quantity. The final aggregation sums `mult * base_cost` per root — every reachable part contributes its base cost times its cumulative multiplier. The naive alternative — a single-level join `SELECT root, SUM(qty * base_cost)` — works only for one-level assemblies; multi-level needs recursion. The cycle guard `NOT (b.child_id = ANY(e.path))` is defensive: real BOMs shouldn't have cycles (an assembly can't contain itself), but data-quality bugs do happen — the guard prevents the query from hanging on malformed data instead of returning an error. `UNION ALL` is correct because each (root, descendant) pair may appear multiple times via different paths through the tree (a shared sub-assembly), and those occurrences should sum, not dedupe. Performance: BOM trees are typically shallow (<10 levels), so the recursion is bounded; depth bound is omitted because the cycle guard already prevents infinite recursion. NULL handling: NULL qty or NULL base_cost propagates to NULL multiplier — usually a data bug; `COALESCE(qty, 1)` in the recursive step if NULL means "1 unit assumed". Edge case: a "root" with no BOM rows still appears in the output via the anchor — its `total_cost` = its own `base_cost`.

#### Solution

```sql
-- Postgres 17/18.
WITH RECURSIVE roots AS (
  -- Roots: parts that are never a child of any BOM row.
  SELECT part_id FROM parts
  EXCEPT
  SELECT child_id FROM bom
),
explode AS (
  -- Anchor: each root contributes itself at multiplier 1.0.
  SELECT r.part_id AS root_id, r.part_id AS node, 1.0::numeric AS mult, ARRAY[r.part_id] AS path
  FROM roots r

  UNION ALL

  -- Recursive step: descend one BOM level, multiply quantity along the path.
  SELECT e.root_id, b.child_id, e.mult * b.qty, e.path || b.child_id
  FROM explode e
  JOIN bom b ON b.parent_id = e.node
  WHERE NOT (b.child_id = ANY(e.path))   -- defensive cycle guard for bad data
)
SELECT root_id AS part_id,
       -- Each reachable part contributes base_cost × cumulative multiplier.
       ROUND(SUM(mult * p.base_cost)::numeric, 2) AS total_cost
FROM explode e
JOIN parts p ON p.part_id = e.node
GROUP BY root_id
ORDER BY root_id;
```

*Source: Adapted from Celko, "SQL Puzzles & Answers" — Bill of Materials*

---

### 87. Detect Cycles in a Directed Graph

#### Problem

Given `edges(src, dst)`, return all nodes that participate in at least one cycle. Output node ids ascending.

**Tables:** `edges`

**Expected output (sample):**

| node |
|------|
| 4    |
| 5    |
| 7    |

*Why interviewers ask this: it's the structural inversion of cycle-defence — usually you guard against cycles; here you actively detect them. The trap is `UNION` vs `UNION ALL` semantics: dedupe-on-recurse hides path information you need.*

#### Pattern

Recursive CTE walk with a `cycle` flag set when the next node is already in the path-array (Tarjan-style re-entry detect); collect path arrays where `cycle` fires, `unnest` to get participating nodes — `UNION ALL` is mandatory.

#### Explanation

The algorithm being mimicked is path-aware DFS with re-entry detection. The anchor seeds one row per edge `(src, dst, [src, dst], cycle=false)`; the recursive step extends along outbound edges, appending to the path and *flipping the `cycle` flag if the next node appears in the path so far*. When the flag fires, the path closes a loop — every node in the path-array participates in *some* cycle (specifically the one closed by this path). The final step `unnest(path)` flattens the path-arrays into participating nodes. The naive trap: using `UNION` instead of `UNION ALL` dedupes rows on the recurse — and since `(start, current, path)` is the row identity, dedupe is harmless for the recursion but the `cycle` flag changes between iterations, so you lose information about which iteration first detected the cycle. `UNION ALL` is mandatory. The further trap is termination: the recursion must stop on cycle detection (`WHERE NOT w.cycle`), otherwise it would extend the same cycle infinitely; the depth bound (`< 100`) is a belt-and-braces safety. The alternative algorithm is Tarjan's SCC — Postgres has no built-in for it; you'd write it in plpgsql. For large graphs this query is O(V·E) worst-case; production fraud-ring detection (problem #60) uses connected-components, which is cheaper. NULL handling: NULL endpoints in edges produce path NULLs; filter them at the anchor (`WHERE src IS NOT NULL AND dst IS NOT NULL`). Edge case: self-loops (`src = dst`) — the anchor produces `path = [src, src]` and `cycle = false`; the recursive step would detect `dst = src` in the path immediately. Add a special case at the anchor to catch this: `(src = dst) AS cycle`. Multiple cycles sharing nodes are handled correctly via `DISTINCT unnest` at output.

#### Solution

```sql
-- Postgres 17/18.
WITH RECURSIVE walk AS (
  -- Anchor: every edge becomes a starting walk.
  SELECT src AS start_node, dst AS node, ARRAY[src, dst] AS path, FALSE AS cycle
  FROM edges

  UNION ALL

  -- Recursive step: extend along outbound edges; fire cycle flag on re-entry.
  SELECT w.start_node, e.dst,
         w.path || e.dst,
         e.dst = ANY(w.path)         -- next node already in path → cycle closes here
  FROM walk w
  JOIN edges e ON e.src = w.node
  WHERE NOT w.cycle                  -- stop extending once a cycle is detected
    AND array_length(w.path, 1) < 100  -- depth bound — safety
)
SELECT DISTINCT unnest(path) AS node  -- flatten path-arrays; DISTINCT dedupes shared cycle members
FROM walk
WHERE cycle
ORDER BY node;
```

*Source: Original — Advanced SQL Practice*

---

## Sessionization & Event Sequences

Sessionization is the litmus test for "do you ask clarifying questions about business definitions before writing SQL". There is no canonical definition of a session — it's "continuous engagement" until the product team picks a boundary rule, and the rule is often 30 minutes of inactivity, but could equally be browser-close, app-cold-start, login-event, or a fixed wall-clock window. A senior candidate names the assumption explicitly before the first keystroke. The mechanic itself is small: `LAG` to compute inter-event gap, a flag for new-session-start, cumulative sum of the flag as the session id. These 5 problems probe the variations — inactivity gap, ordered-step funnels, monotone-amount streaks, interval merging, role-transition detection.

### 88. Sessionize Page Views with 30-Minute Inactivity Gap

#### Problem

Given `events(user_id, ts, page)`, group consecutive events per user into sessions where a gap of more than 30 minutes between events starts a new session. Return one row per session with start time, end time, and page count.

**Tables:** `events`

**Expected output (sample):**

| user_id | session_id | started_at          | ended_at            | pages |
|---------|------------|---------------------|---------------------|-------|
| 1       | 1          | 2026-04-01 09:00:00 | 2026-04-01 09:25:00 | 5     |
| 1       | 2          | 2026-04-01 11:10:00 | 2026-04-01 11:12:00 | 2     |

*Why interviewers ask this: sessionization is the canonical "do you clarify the business rule first" probe. Mid-level candidates pick 30 minutes and code. Senior candidates explicitly name the assumption and offer alternatives (browser close, login event, fixed-window, total-length cap).*

#### Pattern

`LAG`-based gap detection: flag rows where `ts - prev_ts > 30 min`, then cumulative `SUM(flag) OVER (PARTITION BY user_id ORDER BY ts)` assigns a monotone session id within each user. Group by `(user_id, session_id)` for per-session aggregates.

#### Explanation

**Clarify before coding** — the 30-minute inactivity rule is the de facto default but not universal. State explicitly: "I'm interpreting a session boundary as a gap of more than 30 minutes between consecutive events from the same user. Other common rules are app-cold-start (each fresh launch is a session regardless of gap), browser-close (only the client knows), bounded session length (force-end at 4 hours), or activity-class boundary (login → checkout → logout each cap a session). Which do you want?" If the interviewer accepts the 30-minute rule, proceed. The headline mechanic: `LAG(ts) OVER (PARTITION BY user_id ORDER BY ts)` gives the previous event time per user; subtract to get the gap; cast the boolean `(gap > 30 min)` to int (1 for new-session boundary, 0 otherwise). Cumulative `SUM` over that flag — within user, ordered by `ts` — gives the session number. The first row per user has NULL gap (no prior event); `COALESCE(..., 0)` treats it as not-a-boundary, and the `+ 1` shifts session numbering to start at 1 (Postgres-friendly index). The naive alternative is a recursive CTE per user — works but absurdly slow vs the window-based form. The second naive trap is computing the gap as `ts - prev_ts > '30 minutes'::text` — the text cast loses interval semantics; always use `INTERVAL` literal. `LAG` is positional, so frame discussions don't apply — `LAG` ignores any explicit frame; it's defined by the `ORDER BY` position. NULL handling: `LAG` returns NULL for the first row per user (no prior); `COALESCE` to 0 makes it explicitly non-boundary. Edge case: ties on `ts` (two events at the same instant) — `LAG` picks an arbitrary order, both rows land in the same session (gap of 0), which is correct.

#### Solution

```sql
-- Postgres 17/18.
WITH flagged AS (
  SELECT user_id, ts, page,
         -- Boolean-cast-to-int: 1 if this row starts a new session, 0 otherwise.
         -- First row per user has NULL gap; COALESCE later treats as 0.
         (ts - LAG(ts) OVER (PARTITION BY user_id ORDER BY ts)
            > INTERVAL '30 minutes')::int AS new_session
  FROM events
),
sessioned AS (
  -- Cumulative SUM of the boundary flag = session number within user.
  -- +1 so sessions start at 1 not 0.
  SELECT user_id, ts, page,
         SUM(COALESCE(new_session, 0)) OVER (PARTITION BY user_id ORDER BY ts) + 1
           AS session_id
  FROM flagged
)
SELECT user_id, session_id,
       MIN(ts) AS started_at,
       MAX(ts) AS ended_at,
       COUNT(*) AS pages
FROM sessioned
GROUP BY user_id, session_id
ORDER BY user_id, session_id;
```

*Source: DataLemur — "Session Identification" (Airbnb tag) — adapted*

---

### 89. Consecutive Increasing Transactions Per User

#### Problem

Given `transactions(user_id, txn_date, amount)`, find users with at least three consecutive (by date) transactions where each transaction's amount strictly exceeds the previous. Return user_id and the length of their longest such streak.

**Tables:** `transactions`

**Expected output (sample):**

| user_id | longest_streak |
|---------|----------------|
| 7       | 4              |
| 12      | 3              |

*Why interviewers ask this: it stacks two conditions on a streak — date-contiguity AND strictly-increasing amount. Candidates who can do one but not the composition fail. The senior signal is naming both gap conditions explicitly.*

#### Pattern

Two-condition gaps-and-islands: `LAG(amount)` and `LAG(txn_date)` define the per-row "continues" predicate (`amount > prev_amt AND txn_date = prev_dt + 1 day`); cumulative count of *resets* (where `cont = false`) gives the run id; group by run id, count, take max per user.

#### Explanation

The algorithm being mimicked is dual-condition island detection: an "island" is a maximal contiguous span where both `amount > prev_amount` AND `txn_date = prev_date + 1 day`. The headline mechanic is two parallel `LAG`s under the same window definition, combined into one `cont` predicate. The naive alternative is a single `ROW_NUMBER` difference (the trick from #2) — fails here because it only tracks one ordering invariant; you'd need a separate row number per condition class and the combinatorics gets ugly. The cumulative-sum-of-resets trick is the senior-correct form: every time `cont = false`, the run id ticks up; rows where `cont = true` inherit the same run id as their predecessor. The semantics trap is `> vs >=`: the spec says "strictly exceeds" so `>` is correct; `>=` would let equal amounts continue a streak, which is a different metric. Date arithmetic: `prev_dt + INTERVAL '1 day'` is the standard form; `prev_dt + 1` works for date types (no INTERVAL needed) but `INTERVAL` reads as intent. NULL handling: the first row per user has `prev_amt` and `prev_dt` both NULL, so `cont = NULL` not `false`. The `CASE WHEN cont THEN 0 ELSE 1 END` treats NULL as "else" (i.e. as a reset) which is correct — first row always starts a new run. Edge case: a user with one transaction has streak length 1, filtered out by the `>= 3` predicate. Multiple non-overlapping streaks per user — `MAX(streak_len)` correctly picks the longest. Ties on date (two transactions same day) — `LAG` picks one arbitrarily; the `prev_dt + 1 day` predicate fails for same-day rows so they break the streak, which is probably correct behaviour (same-day transactions aren't "consecutive" in the streak sense).

#### Solution

```sql
-- Postgres 17/18.
WITH lagged AS (
  -- Pull previous row's amount and date for each row, per user, by date.
  SELECT user_id, txn_date, amount,
         LAG(amount) OVER (PARTITION BY user_id ORDER BY txn_date) AS prev_amt,
         LAG(txn_date) OVER (PARTITION BY user_id ORDER BY txn_date) AS prev_dt
  FROM transactions
),
flagged AS (
  -- Continues iff BOTH conditions hold: strictly increasing AND next-day.
  SELECT user_id, txn_date,
         (amount > prev_amt AND txn_date = prev_dt + INTERVAL '1 day') AS cont
  FROM lagged
),
grp AS (
  -- Cumulative count of resets (cont=false) gives the run id within user.
  SELECT user_id, txn_date,
         SUM(CASE WHEN cont THEN 0 ELSE 1 END)
           OVER (PARTITION BY user_id ORDER BY txn_date) AS grp
  FROM flagged
),
runs AS (
  -- Count length of each run.
  SELECT user_id, grp, COUNT(*) AS streak_len
  FROM grp
  GROUP BY user_id, grp
)
SELECT user_id, MAX(streak_len) AS longest_streak
FROM runs
GROUP BY user_id
HAVING MAX(streak_len) >= 3   -- spec: at least three consecutive
ORDER BY user_id;
```

*Source: LeetCode #2701 — Consecutive Transactions with Increasing Amounts*

---

### 90. Funnel Drop-Off Per Step

#### Problem

Given `events(user_id, ts, step)` where `step` is one of `'view'`, `'add_to_cart'`, `'checkout'`, `'purchase'`, return for each step the number of distinct users who reached that step **in the correct order** within a single session (defined as a 1-hour inactivity gap). A user who carts before viewing in the same session does not count for the carting step.

**Tables:** `events`

**Expected output (sample):**

| step         | users |
|--------------|-------|
| view         | 1200  |
| add_to_cart  | 480   |
| checkout     | 215   |
| purchase     | 142   |

*Why interviewers ask this: funnel analysis is core to growth-eng. The trap is "ordered" — candidates who skip the order check produce inflated mid-funnel counts. The senior signal is using `FILTER` aggregates per step and chaining ordered comparisons.*

#### Pattern

Three-stage: (1) sessionize via `LAG`-gap-flag cumulative sum (1h gap); (2) within each session, take `MIN(ts) FILTER (WHERE step = X)` per step for the earliest step-X occurrence; (3) count distinct users per step where the ordered predicate `t_view ≤ t_cart ≤ t_co ≤ t_buy` holds at each level.

#### Explanation

**Clarify** — the 1-hour inactivity rule is one interpretation; the alternative is per-checkout-attempt sessions (each cart→checkout is its own funnel even if 5 min apart), or fixed-window sessions (each calendar day is one funnel). State your assumption. The first stage is sessionization from #16 with a 1h gap instead of 30m. The second stage uses `FILTER` aggregates — `MIN(ts) FILTER (WHERE step = 'view')` returns the earliest view-event timestamp within the session or NULL if no view occurred. `FILTER` is the Postgres-idiomatic conditional aggregate; the equivalent `MIN(CASE WHEN step = 'view' THEN ts END)` works too but reads worse and (in the past) had marginal planner penalties. The third stage is the ordered-comparison funnel: a user qualifies for step N only if their step-N time exists and is ≥ their step-(N-1) time. The naive mistake is counting `DISTINCT user_id WHERE step = 'add_to_cart'` — ignores order, inflates the cart count. The four-way `UNION ALL` form here is explicit and reads as funnel intent; an alternative is a single CTE with four boolean columns (`reached_view, reached_cart, ...`) and `SUM(reached_X::int)` per step — same answer, denser. NULL handling: `FILTER` aggregates return NULL when no rows match; the ordered predicates `t_X >= t_Y` are NULL-false (NULL comparison is UNKNOWN, which the WHERE clause treats as false), correctly excluding users who skipped a step. Edge case: a user who carts → views → carts again in the same session — `MIN(ts) FILTER (WHERE step = 'add_to_cart')` picks the first cart, which is before view — they don't qualify for cart. If the spec wanted them to qualify (any-cart-after-any-view), the query needs the more complex `EXISTS` form. Tie semantics: identical timestamps across steps (a programmatic checkout-and-purchase fired at the same instant) — `>=` correctly counts them at every level.

#### Solution

```sql
-- Postgres 17/18.
WITH flagged AS (
  SELECT user_id, ts, step,
         (ts - LAG(ts) OVER (PARTITION BY user_id ORDER BY ts)
            > INTERVAL '1 hour')::int AS new_session
  FROM events
),
sessioned AS (
  SELECT user_id, ts, step,
         SUM(COALESCE(new_session, 0)) OVER (PARTITION BY user_id ORDER BY ts) AS sid
  FROM flagged
),
per_session AS (
  SELECT user_id, sid,
         MIN(ts) FILTER (WHERE step = 'view')        AS t_view,
         MIN(ts) FILTER (WHERE step = 'add_to_cart') AS t_cart,
         MIN(ts) FILTER (WHERE step = 'checkout')    AS t_co,
         MIN(ts) FILTER (WHERE step = 'purchase')    AS t_buy
  FROM sessioned
  GROUP BY user_id, sid
)
SELECT step, COUNT(DISTINCT user_id) AS users
FROM (
  SELECT user_id, 'view' AS step FROM per_session WHERE t_view IS NOT NULL
  UNION ALL
  SELECT user_id, 'add_to_cart' FROM per_session WHERE t_view IS NOT NULL AND t_cart >= t_view
  UNION ALL
  SELECT user_id, 'checkout'    FROM per_session WHERE t_cart IS NOT NULL AND t_co >= t_cart
  UNION ALL
  SELECT user_id, 'purchase'    FROM per_session WHERE t_co IS NOT NULL AND t_buy >= t_co
) f
GROUP BY step
ORDER BY array_position(ARRAY['view','add_to_cart','checkout','purchase'], step);
```

*Source: DataLemur — "E-commerce funnel" (Amazon tag) — adapted*

---

### 91. Merge Overlapping Time Intervals

#### Problem

Given `intervals(user_id, started_at, ended_at)` of usage periods (possibly overlapping per user), return the merged, non-overlapping intervals per user.

**Tables:** `intervals`

**Expected output (sample):**

| user_id | merged_start        | merged_end          |
|---------|---------------------|---------------------|
| 1       | 2026-04-01 09:00    | 2026-04-01 10:30    |
| 1       | 2026-04-01 11:00    | 2026-04-01 12:15    |

*Why interviewers ask this: interval merging is a classic two-pointer algorithm in imperative code; doing it set-based with windows tests senior fluency. The trap is using `LAG(ended_at)` instead of `MAX(ended_at)` running — `LAG` is wrong when intervals are nested.*

#### Pattern

Running-max-of-ended-at trick: sort by start within user, `MAX(ended_at) OVER (... ROWS UNBOUNDED PRECEDING AND 1 PRECEDING)` gives the "wall" of previous intervals; new merge-group starts when `started_at > wall`; cumulative `SUM` of new-group flags is the group id; aggregate `MIN/MAX` per group.

#### Explanation

The algorithm being mimicked is two-pointer sweep merge — Tarjan-style interval coalescing. The naive trap is using `LAG(ended_at)` for the wall: `LAG` returns only the immediately previous row's end, which is wrong when intervals are nested. Example: `[1, 10], [2, 4], [3, 11]` — sorted by start. With `LAG(ended_at)`, row 3's wall is 4 (from row 2), so row 3 starts a new group at 3 < 4 → fine. But consider `[1, 10], [2, 3], [4, 5]` — row 3's `LAG(ended_at)` is 3 (from row 2), so row 3 looks like it starts a new group; in fact `[1, 10]` still contains `[4, 5]`, so they should merge. `MAX(ended_at) OVER (... ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)` correctly tracks the cumulative high-water mark of all prior `ended_at` values, which is the actual wall. The frame `BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING` excludes the current row — important so the current row's own `ended_at` doesn't enter its own wall computation. Once the wall is correct, the flag is straightforward: `(prev_max_end IS NULL OR started_at > prev_max_end)` — NULL handles the first row of each user (no wall). Cumulative `SUM` of flags is the merge-group id; group by `(user_id, gid)` and aggregate. The alternative is the recursive CTE form — walk start-by-start, conditionally extend the current interval or open a new one — same answer, slower, less readable. Edge case: intervals where `ended_at = next.started_at` exactly (touching but not overlapping) — `>` strictly means they remain separate; `>=` would merge them. Spec ambiguity; clarify. NULL handling: NULL `started_at` or `ended_at` would propagate through `MAX` and the comparison, producing NULL groups — filter at input or treat as a data bug. Tie semantics: two intervals with identical `started_at` — `ORDER BY started_at` picks an arbitrary order; the merge logic is order-independent within the tie since both have the same wall, so the result is stable.

#### Solution

```sql
-- Postgres 17/18.
WITH ordered AS (
  SELECT user_id, started_at, ended_at,
         MAX(ended_at) OVER (
           PARTITION BY user_id ORDER BY started_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
         ) AS prev_max_end
  FROM intervals
),
flagged AS (
  SELECT user_id, started_at, ended_at,
         CASE WHEN prev_max_end IS NULL OR started_at > prev_max_end THEN 1 ELSE 0 END
           AS new_grp
  FROM ordered
),
grouped AS (
  SELECT user_id, started_at, ended_at,
         SUM(new_grp) OVER (PARTITION BY user_id ORDER BY started_at) AS gid
  FROM flagged
)
SELECT user_id,
       MIN(started_at) AS merged_start,
       MAX(ended_at) AS merged_end
FROM grouped
GROUP BY user_id, gid
ORDER BY user_id, merged_start;
```

*Source: LeetCode #2494 — Merge Overlapping Events in the Same Hall*

---

### 92. Viewers Turned Streamers

#### Problem

Given `sessions(user_id, ts, role)` where `role` is `'viewer'` or `'streamer'`, find users who were viewers first and later streamed in a separate session (the streaming session starts strictly after their last viewing session ends). Return user_id and the conversion timestamp (first stream session start).

**Tables:** `sessions`

**Expected output (sample):**

| user_id | first_stream_at      |
|---------|----------------------|
| 4       | 2026-04-05 14:20:00  |
| 11      | 2026-04-09 19:55:00  |

*Why interviewers ask this: it tests whether you reach for `FILTER`-conditional-aggregates (Postgres-idiomatic) or fall back to `CASE`-inside-`MIN/MAX` (MySQL leftover). Both work; the `FILTER` form reads cleaner and the planner handles it the same way.*

#### Pattern

Per-user conditional aggregates: `MIN(ts) FILTER (WHERE role = 'streamer')` and `MAX(ts) FILTER (WHERE role = 'viewer')` in one GROUP BY — both must exist and stream-min must strictly exceed view-max.

#### Explanation

The headline mechanic is `FILTER`-conditional aggregates in one GROUP BY: `MIN(ts) FILTER (WHERE role = 'streamer')` gives the first streaming-session start, `MAX(ts) FILTER (WHERE role = 'viewer')` gives the last viewing session. `FILTER` was added in SQL:2003 and Postgres supports it natively. The MySQL-leftover equivalent is `MIN(CASE WHEN role = 'streamer' THEN ts END)` — works but reads worse. The naive alternative is two self-joins or two subqueries: `(SELECT MIN(ts) FROM sessions WHERE user_id = u.id AND role = 'streamer')` and similar for the viewer max — two scans of the table where `FILTER` does it in one. The two-stage `HAVING` predicate enforces both conditions: viewer-max exists (not NULL) AND streamer-min > viewer-max. The `>` is strict per spec ("strictly after"); `>=` would let a user who streamed and viewed at the same instant qualify, which the spec excludes. NULL handling: `FILTER` aggregates return NULL when no rows match — so a user who never streamed has `first_stream_at = NULL`, filtered out by the `HAVING` predicate (NULL comparison is UNKNOWN, treated as false). NULL viewer rows similarly excluded. Tie semantics: a user with one viewing session at 10:00 and one streaming session at 10:00 — `MIN` and `MAX` both return 10:00, the `>` test fails, they're excluded. A senior interviewer might probe: "what if the spec said the stream session must START strictly after the viewer session END (using session intervals, not just session start timestamps)?" — that's a different query against an `intervals` table; the current query treats `ts` as the session start. Edge case: a user with multiple alternating roles — the query takes their first stream and last view, so a user with sequence view→stream→view→stream would qualify if first-stream > last-view, which works correctly.

#### Solution

```sql
-- Postgres 17/18.
SELECT user_id, MIN(ts) FILTER (WHERE role = 'streamer') AS first_stream_at
FROM sessions
GROUP BY user_id
HAVING MAX(ts) FILTER (WHERE role = 'viewer') IS NOT NULL
   AND MIN(ts) FILTER (WHERE role = 'streamer')
       > MAX(ts) FILTER (WHERE role = 'viewer')
ORDER BY user_id;
```

*Source: LeetCode #2995 — Viewers Turned Streamers*

---

## Cohort, Funnel & Retention Analysis

Cohort and retention analysis is where growth-eng candidates earn their keep. The mechanic is consistent: bucket users by a cohort key (signup week, first-purchase month), measure activity in subsequent periods, compute the matrix. The traps are definitional: "retention" can mean classic (active on day N exactly), rolling (active any day in [1..N]), bounded (active in [N-7..N]), or persistent (active every period since signup). State the choice, then code it. These 5 problems push into per-cohort percentile lag, conversion timing, churn definitions, and A/B lift — the queries that drive real product dashboards.

### 93. Weekly Cohort Retention Matrix

#### Problem

Given `users(user_id, signup_ts)` and `activity(user_id, ts)`, build a weekly cohort retention table: each row is a signup-week cohort, columns are weeks-since-signup (0..12), values are the percentage of that cohort that was active in that week. Round to one decimal.

**Tables:** `users`, `activity`

**Expected output (sample):**

| cohort_week | week_0 | week_1 | week_2 | ... | week_12 |
|-------------|--------|--------|--------|-----|---------|
| 2026-01-04  | 100.0  | 42.5   | 28.1   | ... | 11.2    |
| 2026-01-11  | 100.0  | 48.0   | 30.2   | ... | NULL    |

*Why interviewers ask this: cohort retention is the workhorse of growth-eng. The trap is conflating "active in week N" with "active on day N" — and the bigger trap is forgetting that cohorts have decreasing observation windows the closer you get to "now" (the trailing weeks should be NULL or capped).*

#### Pattern

Three-CTE pipeline: (1) cohort assignment via `date_trunc('week', signup_ts)`; (2) per-(user, week-since-signup) active flag via `date_trunc('week', activity.ts) - cohort_week` arithmetic in days/7; (3) pivot via `COUNT(DISTINCT user_id) FILTER (WHERE week_offset = N) / cohort_size` per N. Hand-rolled column list (use `crosstab` only when N is dynamic).

#### Explanation

The headline structure is the three-stage cohort pipeline: assign, measure, pivot. Step 1 buckets each user into their signup-week via `date_trunc('week', signup_ts)` — Postgres weeks are ISO (Monday-start). Step 2 measures activity: for each (user, activity_week), compute `week_offset = (activity_week - cohort_week) / 7`. Step 3 pivots into per-offset columns using `COUNT(DISTINCT user_id) FILTER (WHERE week_offset = N)` — one column per N. The hand-rolled column list is the right form here because the offsets 0..12 are known at write time; `crosstab` is for dynamic column lists. The naive alternative is computing retention per user as a 13-element array and aggregating — works but harder to consume. The trap mentioned in the prompt-tail: cohorts in the trailing weeks have insufficient observation. A cohort that signed up 3 weeks ago can't have week-12 retention measured yet — `week_12` should be NULL, not 0. The current query produces NULL via empty `FILTER` (no rows match) divided by cohort_size — gives 0, which is *wrong*. The correct production form adds a cohort-observation-window check: only emit `week_N` if `cohort_week + N*7 <= current_date - 7` (the week is fully observable). The query as shown gives the textbook answer; production should add the observation guard. NULL handling: `COUNT(DISTINCT)` ignores NULLs; users with NULL signup get dropped at cohort assignment (correct). Edge case: a user who signs up Monday at 23:59 has `cohort_week = Monday`; activity on Tuesday is `week_offset = 0` (same week) — correct. Ties on signup_ts: irrelevant since cohort is by week, not by tick. Performance: O(users × distinct activity weeks) — for 10M users × 52 weeks = 520M rows in the join; production materialises this as a daily-refreshed roll-up.

#### Solution

```sql
-- Postgres 17/18.
WITH cohort AS (
  SELECT user_id, date_trunc('week', signup_ts)::date AS cohort_week
  FROM users
),
active_weeks AS (
  SELECT c.user_id, c.cohort_week,
         (date_trunc('week', a.ts)::date - c.cohort_week) / 7 AS week_offset
  FROM cohort c
  JOIN activity a ON a.user_id = c.user_id
  WHERE a.ts >= c.cohort_week
),
sized AS (
  SELECT cohort_week, COUNT(*)::numeric AS cohort_size FROM cohort GROUP BY cohort_week
)
SELECT s.cohort_week,
       ROUND(100.0 * COUNT(DISTINCT a.user_id) FILTER (WHERE a.week_offset = 0)  / s.cohort_size, 1) AS week_0,
       ROUND(100.0 * COUNT(DISTINCT a.user_id) FILTER (WHERE a.week_offset = 1)  / s.cohort_size, 1) AS week_1,
       ROUND(100.0 * COUNT(DISTINCT a.user_id) FILTER (WHERE a.week_offset = 2)  / s.cohort_size, 1) AS week_2,
       ROUND(100.0 * COUNT(DISTINCT a.user_id) FILTER (WHERE a.week_offset = 4)  / s.cohort_size, 1) AS week_4,
       ROUND(100.0 * COUNT(DISTINCT a.user_id) FILTER (WHERE a.week_offset = 8)  / s.cohort_size, 1) AS week_8,
       ROUND(100.0 * COUNT(DISTINCT a.user_id) FILTER (WHERE a.week_offset = 12) / s.cohort_size, 1) AS week_12
FROM sized s
LEFT JOIN active_weeks a USING (cohort_week)
GROUP BY s.cohort_week, s.cohort_size
ORDER BY s.cohort_week;
```

*Source: StrataScratch #10081 — Cohort Retention (Airbnb)*

---

### 94. N-Day Rolling Retention

#### Problem

Given `users(user_id, signup_dt)` and `activity(user_id, dt)`, compute "N-day rolling retention" for N ∈ {1, 7, 30}: the fraction of users active on **any** day in [signup_dt+1, signup_dt+N]. Return one row per N.

**Tables:** `users`, `activity`

**Expected output (sample):**

| n  | retention |
|----|-----------|
| 1  | 0.412     |
| 7  | 0.683     |
| 30 | 0.741     |

*Why interviewers ask this: the trap is the definition. "Rolling N-day retention" (active any day in [1..N]) vs "classic N-day retention" (active exactly on day N) produce very different numbers. Senior candidates name the choice before coding.*

#### Pattern

`VALUES (1), (7), (30)` constants table CROSS JOINed with users, `EXISTS`-correlated per-(user, N) activity check, aggregate `AVG(retained::int)` to get the fraction — one pass over users, one indexed lookup per (user, horizon).

#### Explanation

**Clarify first:** "rolling" retention means active any day in [signup_dt+1, signup_dt+N]; "classic" retention means active exactly on day N (or in week N). The two metrics diverge sharply. State your interpretation; here we follow rolling. The headline mechanic is `VALUES` constants joined with users to produce one row per (user, N), then `EXISTS` to check activity in the N-day window. The naive form is three separate queries `UNION ALL`-ed — one per N — works but composes badly when N grows beyond a handful. The `EXISTS` form is `O(users × horizons)` with index lookup per check; vs a `JOIN activity ON ... WHERE dt BETWEEN ...` which scans all activity rows for each user. With an index on `activity(user_id, dt)`, the `EXISTS` short-circuits at first match — for high-retention cohorts it terminates immediately. NULL handling: `signup_dt` is assumed NOT NULL; if nullable, the `BETWEEN` arithmetic fails (`NULL + 1` is NULL) and the user contributes a NULL `retained` flag, which `AVG` ignores — usually wrong; filter at the user CTE. The `::int` cast turns boolean to 0/1 for `AVG` to average; an alternative is `COUNT(*) FILTER (WHERE retained) / COUNT(*)`. Edge case: signup_dt + N is in the future — the activity table doesn't contain future rows, so retention is artificially low. The production form filters users whose `signup_dt + N <= current_date` before computing the average — this query as shown is the interview answer, not the dashboard query. Tie semantics: not applicable; `EXISTS` is boolean. Day-boundary semantics: `BETWEEN signup_dt + 1 AND signup_dt + N` is inclusive on both ends, which means N=7 actually checks 7 days (day +1 through day +7), not 8. Spec is `+1 .. +N` — clear.

#### Solution

```sql
-- Postgres 17/18.
WITH horizons(n) AS (VALUES (1), (7), (30)),
flagged AS (
  SELECT h.n, u.user_id,
         EXISTS (
           SELECT 1 FROM activity a
           WHERE a.user_id = u.user_id
             AND a.dt BETWEEN u.signup_dt + 1 AND u.signup_dt + h.n
         ) AS retained
  FROM users u CROSS JOIN horizons h
)
SELECT n,
       ROUND(AVG(retained::int)::numeric, 3) AS retention
FROM flagged
GROUP BY n
ORDER BY n;
```

*Source: Folk interview question — Stripe growth-eng screen*

---

### 95. Churn Definition: 28-Day No-Activity

#### Problem

Given `users(user_id, signup_dt)` and `activity(user_id, dt)`, return users considered churned as of `'2026-05-01'`: signed up at least 28 days ago, AND have no activity in the trailing 28-day window ending at the cutoff. Output user_id and `days_since_last_activity` (NULL if never active).

**Tables:** `users`, `activity`

**Expected output (sample):**

| user_id | days_since_last_activity |
|---------|--------------------------|
| 14      | 53                       |
| 99      | NULL                     |

*Why interviewers ask this: churn definition is product-specific and senior candidates clarify it explicitly. The trap is dropping never-active users — they DO count as churned if they signed up far enough back.*

#### Pattern

`LEFT JOIN` aggregate (per-user last-activity date from a pre-aggregated CTE) + dual filter: tenure ≥ 28 days AND (last_dt < cutoff − 28 days OR last_dt IS NULL). NULL preservation across the LEFT JOIN is load-bearing.

#### Explanation

**Clarify first:** "churned" can mean lapsed-once (was active, hasn't been recently), never-activated (signed up, never used), or temporarily-inactive (active but missed the window). The spec here is union of "no activity in last 28 days AND tenured 28+ days" — both lapsed and never-activated count. State this. The headline mechanic is a `LEFT JOIN` against a per-user max-activity aggregate, so never-active users survive with NULL last-activity. The `WHERE` clause has two disjunctive churn conditions: `last_dt IS NULL` (never active) OR `last_dt < cutoff - 28 days` (active but old). The naive trap is `INNER JOIN` to activity — drops never-active users from the result, contradicting the spec. The second naive trap is `WHERE last_dt < cutoff - 28 days` without the `IS NULL` branch — same drop. The aggregate-in-CTE form is faster than a per-user correlated `MAX` subquery: one scan of activity with `GROUP BY user_id` vs per-user scans. The activity CTE filters by `dt <= cutoff` so future activity (in test data with future dates) doesn't pollute the aggregate. Date arithmetic: `DATE - INTERVAL` returns timestamp in some forms; `DATE '2026-05-01' - INTERVAL '28 days'` returns timestamp — cast or compare against date directly. NULL handling for output: `CASE WHEN la.last_dt IS NOT NULL THEN cutoff - last_dt END` produces NULL for never-active users (explicit `END` without `ELSE` defaults to NULL), matching the spec. Edge case: a user who signed up exactly 28 days ago — `signup_dt <= cutoff - 28 days` includes them (the boundary day counts). Tie semantics: not applicable. Production note: this is a snapshot query — to track *when* churn happened, you'd add a `churn_dt = last_dt + 28 days` column.

#### Solution

```sql
-- Postgres 17/18.
WITH last_active AS (
  SELECT user_id, MAX(dt) AS last_dt
  FROM activity
  WHERE dt <= DATE '2026-05-01'
  GROUP BY user_id
)
SELECT u.user_id,
       CASE WHEN la.last_dt IS NOT NULL
            THEN DATE '2026-05-01' - la.last_dt END AS days_since_last_activity
FROM users u
LEFT JOIN last_active la USING (user_id)
WHERE u.signup_dt <= DATE '2026-05-01' - INTERVAL '28 days'
  AND (la.last_dt IS NULL OR la.last_dt < DATE '2026-05-01' - INTERVAL '28 days')
ORDER BY u.user_id;
```

*Source: StrataScratch — Meta churn-definition adaptation*

---

### 96. Conversion Lag Per Cohort

#### Problem

Given `signups(user_id, signup_dt)` and `purchases(user_id, purchase_dt)`, for each signup-week cohort return the median and 90th-percentile lag (in days) between signup and **first** purchase. Cohorts with no purchases yield NULL.

**Tables:** `signups`, `purchases`

**Expected output (sample):**

| cohort_week | median_lag | p90_lag |
|-------------|------------|---------|
| 2026-01-04  | 3          | 17      |
| 2026-01-11  | 5          | 28      |

*Why interviewers ask this: percentile-of-cohort lag is what feeds conversion timing dashboards. The trap is `PERCENTILE_CONT` vs `PERCENTILE_DISC` — for a "lag in days" metric, `CONT` (interpolating) is right; for "which actual customer hit the threshold" semantics, `DISC` is right.*

#### Pattern

Per-user `MIN(purchase_dt)` → `lag_days = first_dt - signup_dt`; aggregate `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lag_days)` and `PERCENTILE_CONT(0.9)` per `date_trunc('week', signup_dt)` cohort.

#### Explanation

The headline composition is per-user-first-purchase + per-cohort-percentile. Step 1: `MIN(purchase_dt)` per user is the first purchase. Step 2: `lag_days = first_dt - signup_dt` is the conversion lag. Step 3: `PERCENTILE_CONT(0.5)` and `(0.9)` over `lag_days` per cohort gives median and p90. The percentile choice: `PERCENTILE_CONT` interpolates linearly between the two surrounding values when the percentile falls between data points — appropriate for a continuous quantity like "days of lag". `PERCENTILE_DISC` returns one of the actual data points — appropriate when the answer should be a real observation ("which lag value is the median?"). For dashboards reporting "median lag", `CONT` is the convention. The naive alternative is `ROW_NUMBER`-based percentile picking — works but 20 lines vs 2. Cohort assignment: `date_trunc('week', signup_dt)` — Postgres ISO weeks (Monday-start). The `LEFT JOIN` from signups to first_purchase preserves never-purchased users; their `lag_days` is NULL; `PERCENTILE_CONT` ignores NULLs by ordered-set-aggregate convention, so a cohort where all users converted contributes to the median, and never-converted users are silently dropped — *this is a subtle correctness concern*: the "median lag" you compute is the median among converters, not the median across the cohort. State this. The "Cohorts with no purchases yield NULL" spec is handled because `PERCENTILE_CONT` over an empty set returns NULL. NULL handling: signup_dt or purchase_dt NULLs propagate to NULL lag — ignored. Edge case: a purchase made on the same day as signup has `lag_days = 0` — counts as fastest conversion. Tie semantics: `PERCENTILE_CONT` interpolates between equal values trivially (returns the value). Production note: at growth-eng scale, materialize per-(cohort, day) first-purchase counts and compute percentiles from the histogram — faster than scanning per-user lags for billions of rows.

#### Solution

```sql
-- Postgres 17/18.
WITH first_purchase AS (
  SELECT user_id, MIN(purchase_dt) AS first_dt
  FROM purchases
  GROUP BY user_id
),
lagged AS (
  SELECT s.user_id,
         date_trunc('week', s.signup_dt)::date AS cohort_week,
         (fp.first_dt - s.signup_dt) AS lag_days
  FROM signups s
  LEFT JOIN first_purchase fp USING (user_id)
)
SELECT cohort_week,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lag_days) AS median_lag,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY lag_days) AS p90_lag
FROM lagged
WHERE lag_days IS NOT NULL
GROUP BY cohort_week
ORDER BY cohort_week;
```

*Source: DataLemur — "Conversion timing" (Stripe tag) — adapted*

---

### 97. Cohort A/B Test Lift With Significance Tag

#### Problem

Given `assignments(user_id, variant)` (`'A'` or `'B'`) and `conversions(user_id)`, compute per-variant conversion rate and the relative lift of B over A. Also return a coarse significance tag: `'significant'` when |lift| ≥ 0.05 and each variant has at least 1000 users, else `'inconclusive'`.

**Tables:** `assignments`, `conversions`

**Expected output (sample):**

| variant | users | converted | rate   | lift_vs_a | tag           |
|---------|-------|-----------|--------|-----------|---------------|
| A       | 12000 | 1860      | 0.155  | 0.000     | significant   |
| B       | 11850 | 2105      | 0.178  | 0.148     | significant   |

*Why interviewers ask this: A/B-test lift is the experimentation-eng workhorse. The senior signal is calling out that "significance" by fixed-threshold lift is wrong — real significance uses proportion testing (z-score, chi-square, or Welch's t-test). The query is a stand-in.*

#### Pattern

Three-CTE pipeline: per-variant aggregate (users, converted), per-variant rate (converted / users), scalar A-rate joined back for lift calculation; `CASE` produces the significance tag from compound predicates.

#### Explanation

**State the caveat first:** real A/B significance uses proportion testing — two-proportion z-score or chi-square — not "is the lift bigger than 5%". The fixed-threshold tag in the spec is a coarse proxy used in dashboards as a sanity check. Senior candidates note this and then code the spec'd version. The headline composition is three CTEs: (1) `per_variant` does the conversion counts via `LEFT JOIN conversions + COUNT(*) FILTER (WHERE c.user_id IS NOT NULL)` — the `LEFT JOIN + FILTER` form treats absence of conversion correctly; (2) `rates` adds the rate column with `NULLIF(users, 0)` guarding against an empty variant; (3) `with_a` adds the A-rate as a scalar column for lift computation. The scalar-subquery-in-SELECT approach `(SELECT rate FROM rates WHERE variant = 'A')` is clean here because there's exactly one A variant; for multi-arm experiments you'd JOIN by variant_id. The `CASE` for the tag tests three predicates: |lift| ≥ 5%, B has ≥ 1000 users, A has ≥ 1000 users. The naive alternatives include computing the lift via window function — `rate / FIRST_VALUE(rate) OVER (ORDER BY ...) - 1` — works but doesn't give A its self-lift of 0 cleanly. NULL handling: empty variants (no users assigned) survive the CTEs with NULL rate and `NULLIF` guards prevent division-by-zero; the `CASE` evaluates NULL comparisons as UNKNOWN → ELSE branch → 'inconclusive', correctly. The two `users >= 1000` checks must apply to *both* arms; checking only one would miss the asymmetric case where A has plenty and B doesn't. Edge case: a third (C) variant present in `assignments` — gets its own row with lift computed against A, but the significance tag uses A and B's user counts, so a tiny C with significant lift is correctly tagged inconclusive only via the user count predicate. Multi-arm extension would parameterize the baseline variant.

#### Solution

```sql
-- Postgres 17/18.
WITH per_variant AS (
  SELECT a.variant,
         COUNT(*) AS users,
         COUNT(*) FILTER (WHERE c.user_id IS NOT NULL) AS converted
  FROM assignments a
  LEFT JOIN conversions c USING (user_id)
  GROUP BY a.variant
),
rates AS (
  SELECT variant, users, converted,
         converted::numeric / NULLIF(users, 0) AS rate
  FROM per_variant
),
with_a AS (
  SELECT r.*, (SELECT rate FROM rates WHERE variant = 'A') AS a_rate
  FROM rates r
)
SELECT variant, users, converted,
       ROUND(rate, 3) AS rate,
       ROUND(((rate - a_rate) / NULLIF(a_rate, 0))::numeric, 3) AS lift_vs_a,
       CASE
         WHEN ABS(rate - a_rate) / NULLIF(a_rate, 0) >= 0.05
              AND users >= 1000
              AND (SELECT users FROM rates WHERE variant = 'A') >= 1000
           THEN 'significant'
         ELSE 'inconclusive'
       END AS tag
FROM with_a
ORDER BY variant;
```

*Source: Folk interview question — Stripe / Block experimentation screen*

---

## Temporal Queries & As-Of Joins

Temporal queries — as-of joins, SCD2 lookups, bitemporal reconstruction, range overlap — are core to fintech, ledger systems, and any audit-bearing pipeline. Postgres has the best native range support of any mainstream RDBMS: `tstzrange`, the `&&` overlap operator, GiST indexes for range probes, and `EXCLUDE` constraints for "no overlapping rows" enforced at the database layer. Interviewers want to see you reach for these instead of hand-coding `start < end AND end > start` predicates that the planner can't index. These 5 problems probe the full stack — point-in-time lookup, LOCF carry, overlap detection, gap-coverage with EXCLUDE constraints, and bitemporal as-of-believed reconstruction.

### 98. Point-In-Time Customer State (As-Of Join)

#### Problem

Given `customer_state(customer_id, valid_from, valid_to, plan)` (slowly-changing-dimension type 2; `valid_to` is exclusive, NULL for current) and `events(event_id, customer_id, ts)`, for each event return the plan the customer was on at `ts`.

**Tables:** `customer_state`, `events`

**Expected output (sample):**

| event_id | customer_id | ts                  | plan     |
|----------|-------------|---------------------|----------|
| 1        | 17          | 2026-04-02 10:11:00 | starter  |
| 2        | 17          | 2026-05-09 18:30:00 | premium  |

*Why interviewers ask this: as-of joins are the load-bearing primitive for any ledger, audit, or time-series billing system. The senior signal is reaching for `LATERAL` and indexing on `(customer_id, valid_from DESC)` immediately.*

#### Pattern

`LATERAL` correlated subquery returning the single SCD2 row covering each event's timestamp via `valid_from <= ts AND (valid_to IS NULL OR ts < valid_to)`, ordered `valid_from DESC LIMIT 1` for stability under bad SCD2 data.

#### Explanation

The headline mechanic is `LATERAL` joining one SCD2 row per event. For each event we look up the single state row whose validity covers the event's `ts`. The `LIMIT 1` with `ORDER BY valid_from DESC` is defensive — if the SCD2 data is well-formed, exactly one row covers any timestamp per customer; if it's malformed (overlapping validity windows from a buggy import), the latest-starting one wins, matching the "most recent declared state" intent. The naive alternative is a direct JOIN: `JOIN customer_state s ON s.customer_id = e.customer_id AND s.valid_from <= e.ts AND (s.valid_to IS NULL OR e.ts < s.valid_to)`. This works for clean data but explodes to multiple rows per event under malformed SCD2 data, and the planner can't always use the right index because the predicate is a range-and-equality combination. `LATERAL` with explicit `LIMIT 1` forces the per-event lookup semantics. The index strategy is `CREATE INDEX ON customer_state (customer_id, valid_from DESC)` — equality on customer_id + sort by valid_from descending lets the planner do an index range scan and stop at the first row, which is O(log N) per event. Without that index, the query is O(N·M) range join — catastrophic at 100M events. The exclusive `valid_to` convention (`ts < valid_to` not `ts <= valid_to`) is the convention for half-open intervals — `[from, to)` — which means an SCD2 row ending exactly at noon and another starting exactly at noon don't both cover noon. NULL handling: `valid_to IS NULL` means "currently effective"; the `COALESCE` form `ts < COALESCE(valid_to, 'infinity'::timestamp)` is equivalent and sometimes clearer. Edge case: an event whose customer_id has no SCD2 history yet — the `LEFT JOIN LATERAL` preserves the event with `plan = NULL`; the `LEFT` (vs `JOIN`) is load-bearing here. Tie semantics: two SCD2 rows with identical `valid_from` — `ORDER BY valid_from DESC LIMIT 1` picks one arbitrarily; add `id DESC` as tiebreaker for determinism.

#### Solution

```sql
-- Postgres 17/18.
SELECT e.event_id, e.customer_id, e.ts, s.plan
FROM events e
LEFT JOIN LATERAL (
  SELECT plan
  FROM customer_state s
  WHERE s.customer_id = e.customer_id
    AND s.valid_from <= e.ts
    AND (s.valid_to IS NULL OR e.ts < s.valid_to)
  ORDER BY s.valid_from DESC
  LIMIT 1
) s ON TRUE
ORDER BY e.event_id;
```

*Source: Folk interview question — Stripe / Plaid SCD2 screen*

---

### 99. Last-Observation-Carried-Forward (LOCF) Time Series

#### Problem

Given `quotes(ticker, ts, bid)` (sparse — only ticks when bid changes) and a continuous `ticks(ts)` grid, return for each `(ticker, ticks.ts)` the most recent bid from `quotes` at or before that tick. Tickers with no quote yet at a given tick output NULL.

**Tables:** `quotes`, `ticks`, `tickers`

**Expected output (sample):**

| ticker | ts                    | bid     |
|--------|-----------------------|---------|
| AAPL   | 2026-05-12 09:30:00   | 184.20  |
| AAPL   | 2026-05-12 09:30:01   | 184.20  |
| AAPL   | 2026-05-12 09:30:02   | 184.25  |

*Why interviewers ask this: LOCF is the universal quant/time-series "fill in the gaps" primitive. The senior signal is using `LATERAL` with `ORDER BY ts DESC LIMIT 1` immediately rather than reaching for `MAX(ts) OVER (...)`-then-self-join.*

#### Pattern

CROSS JOIN tick-grid × tickers + `LATERAL` per-cell quote lookup: `ORDER BY q.ts DESC LIMIT 1` on `q.ts <= grid.ts` — Postgres-idiomatic LOCF (last observation carried forward) with NULL preservation for un-quoted tickers.

#### Explanation

The headline mechanic is "for each (tick, ticker) cell, find the latest quote at or before that tick". The grid drives the join: `CROSS JOIN ticks × tickers` materialises every required output cell, then `LEFT JOIN LATERAL` looks up the most recent quote per cell. The `LEFT` is load-bearing — tickers with no quote yet at the current tick produce NULL rather than dropping. The naive alternative is the window-function form: `MAX(ts) OVER (PARTITION BY ticker ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` to get the latest quote-ts per row, then self-join back to `quotes`. Works but harder to read and benchmarks similarly. The other alternative is `DISTINCT ON (ticker, grid.ts) bid FROM ticks CROSS JOIN tickers LEFT JOIN quotes ON ...` — fragile because `DISTINCT ON` requires the `ORDER BY` to lead with the distinct-on columns. Index strategy: `CREATE INDEX ON quotes (ticker, ts DESC)` lets the planner do an index-only top-1 scan per cell — O(log N) per LOCF lookup. Without it, the query is O(grid_size × quotes_per_ticker) — catastrophic for HFT data with millions of quotes per ticker per day. The TSDB note: real systems (InfluxDB, TimescaleDB hypertables, kdb) have native `last_value(bid, ts)` LOCF functions that materialize as one pass — the SQL form here is one interview test, but if you're hiring a quant data eng who reaches for SQL when the team has TimescaleDB, that's a concern. NULL handling: tickers with no quotes at all produce NULL `bid` in every row — correct. Edge case: ticker with a quote exactly at the tick `ts` — `q.ts <= g.ts` includes it (inclusive), so the quote at the tick wins over older quotes — matches LOCF semantics. Tie semantics: two quotes at identical ts — `ORDER BY ts DESC LIMIT 1` picks one; add `id DESC` tiebreaker for determinism.

#### Solution

```sql
-- Postgres 17/18.
SELECT tk.ticker, g.ts, q.bid
FROM ticks g
CROSS JOIN tickers tk
LEFT JOIN LATERAL (
  SELECT bid
  FROM quotes q
  WHERE q.ticker = tk.ticker
    AND q.ts <= g.ts
  ORDER BY q.ts DESC
  LIMIT 1
) q ON TRUE
ORDER BY tk.ticker, g.ts;
```

*Source: Folk interview question — Two Sigma time-series screen (LOCF)*

---

### 100. Find Overlapping Reservations (Range Conflict)

#### Problem

Given `reservations(id, room_id, period)` where `period` is a `tstzrange`, return every pair of overlapping reservations within the same room. Output `(id_a, id_b)` with `id_a < id_b`.

**Tables:** `reservations`

**Expected output (sample):**

| id_a | id_b |
|------|------|
| 14   | 22   |
| 19   | 41   |

*Why interviewers ask this: range overlap is the canonical "do you reach for Postgres-native types or hand-roll start/end comparisons" probe. Mid-level candidates write `a.start < b.end AND b.start < a.end`; senior candidates use `&&` and a GiST index.*

#### Pattern

Range overlap self-join via the `&&` operator (`a.period && b.period`) under same-room equi-join, with `id_a < id_b` for unordered-pair dedup; GiST index on `(room_id, period)` is the load-bearing optimisation.

#### Explanation

The headline mechanic is the `&&` range-overlap operator paired with a GiST index. `&&` returns true iff two ranges share at least one point. The naive alternative — `a.period.lower < b.period.upper AND b.period.lower < a.period.upper` — works for closed-on-left, open-on-right ranges, but: (1) it gets the boundary semantics wrong for other range conventions; (2) Postgres can't use a B-tree index on a derived expression like `lower(period)`; (3) writing it correctly under all boundary conventions is genuinely hard — `[1, 5)` overlapping `[5, 10)` is false by half-open convention but trips up `<=` checks. `&&` encapsulates the convention. Index strategy: `CREATE INDEX ON reservations USING GIST (room_id, period)` — GiST supports the `&&` operator natively (B-tree doesn't). The compound `(room_id, period)` form lets the planner do an equi-search on `room_id` then a range probe within. Without GiST, the self-join is O(N²) — every pair of reservations in the same room is checked. The `id_a < id_b` predicate is critical: an `a JOIN b ON a.room_id = b.room_id AND a.period && b.period` self-join produces every unordered pair twice (a,b) and (b,a) plus self-pairs (a,a) — the `<` strictly less than predicate dedupes both. NULL handling: NULL `period` ranges produce NULL `&&` results (treated as false in WHERE), so NULL-period rows are silently dropped — usually correct, but if "all reservations must have a period" is an invariant, add a NOT NULL CHECK. Edge case: `empty` ranges (lower = upper with open boundary) — `&&` against an empty range is always false; tests pass. Tie semantics not applicable. Production: this is the rooms-availability check inside a `tstzrange` model — for prevention rather than detection, use the `EXCLUDE` constraint (problem #29) at write time.

#### Solution

```sql
-- Postgres 17/18.
SELECT a.id AS id_a, b.id AS id_b
FROM reservations a
JOIN reservations b
  ON a.room_id = b.room_id
 AND a.id < b.id
 AND a.period && b.period
ORDER BY id_a, id_b;
```

*Source: Adapted from Celko, "SQL for Smarties" — interval overlap puzzles*

---

### 101. Continuous Coverage with EXCLUDE Constraint

#### Problem

Design a table that stores non-overlapping room bookings (enforced by the database, not the app) and write the query that returns gaps in coverage longer than 1 hour for a given room and day.

**Tables:** `bookings` (with `EXCLUDE` constraint), `rooms`

**Expected output (sample):**

| room_id | gap_start           | gap_end             |
|---------|---------------------|---------------------|
| 5       | 2026-04-01 11:00:00 | 2026-04-01 14:30:00 |

*Why interviewers ask this: it conflates schema design and query writing. The senior signal is reaching for the `EXCLUDE USING GIST` constraint as the source of truth for non-overlap rather than enforcing it in application code.*

#### Pattern

Schema: `EXCLUDE USING gist (room_id WITH =, period WITH &&)` constraint makes overlapping bookings physically impossible. Query: within-room ordered scan with `LAG(upper(period))` to identify gaps where `lower - prev_upper > 1 hour`.

#### Explanation

The headline mechanic is the `EXCLUDE` constraint with `gist`-based composite — `(room_id WITH =, period WITH &&)` means: reject any insert where there's already a row with the same room_id AND an overlapping period. The constraint pairs each column with an operator class — equality for room_id, range overlap for period — and Postgres enforces it on every insert/update. The alternative is application-level reconciliation: check before insert, race condition between check and insert. The database constraint is atomic and the source of truth — the senior architectural choice. Index strategy: the `EXCLUDE` constraint creates its own GiST index, so range queries against the same table also benefit. The gap-finding query: `LAG(upper(period))` per room ordered by `lower(period)` gives the previous booking's end; a gap exists when the current booking's start exceeds the previous end by more than 1 hour. `lower()` and `upper()` extract range boundaries. The naive alternative is a recursive CTE walking bookings sequentially — works but slower. The query as shown only finds gaps *between consecutive bookings*; it doesn't surface "the day starts with no booking until 9 AM" or "the day ends after the last booking with no booking". Production form would generate the day's full hours via `generate_series` and find gaps relative to the day boundaries — much more verbose. NULL handling: NULL `period` would violate the EXCLUDE check trivially (NULL && anything is NULL → not-overlapping) but is usually disallowed at the column level with NOT NULL. Edge case: a booking exactly at the day boundary (`upper(period) = day_end`) — the `lower(period)::date` filter catches it; if you want strict-day bookings, filter on both `lower` and `upper` falling on the target date. Tie semantics: two bookings with identical `lower(period)` violate the EXCLUDE constraint, so they can't both exist — the question is moot.

#### Solution

```sql
-- Postgres 17/18.
-- Schema (illustrative):
-- CREATE TABLE bookings (
--   id      bigserial PRIMARY KEY,
--   room_id int NOT NULL,
--   period  tstzrange NOT NULL,
--   EXCLUDE USING gist (room_id WITH =, period WITH &&)
-- );

WITH per_room AS (
  SELECT room_id,
         lower(period) AS s,
         upper(period) AS e,
         LAG(upper(period)) OVER (PARTITION BY room_id ORDER BY lower(period)) AS prev_e
  FROM bookings
  WHERE lower(period)::date = DATE '2026-04-01'
)
SELECT room_id, prev_e AS gap_start, s AS gap_end
FROM per_room
WHERE prev_e IS NOT NULL
  AND s - prev_e > INTERVAL '1 hour'
ORDER BY room_id, gap_start;
```

*Source: Original — Advanced SQL Practice*

---

### 102. Bitemporal History Reconstruction

#### Problem

Given `account_balance(account_id, valid_from, valid_to, sys_from, sys_to, balance)` (bitemporal — both business time and system time), return the balance for account 42 **as it was believed on `'2026-04-01'`** for the business date `'2026-03-15'`. Bitemporal means a single business state may have been corrected multiple times over system time.

**Tables:** `account_balance`

**Expected output (sample):**

| balance |
|---------|
| 1250.00 |

*Why interviewers ask this: bitemporal is the load-bearing primitive for any regulator-facing ledger. The trap is conflating business time (what happened in the world) with system time (what we knew when). Senior candidates explain both axes explicitly.*

#### Pattern

Two stacked SCD2 lookups in one WHERE clause — one half-open range covering business time (`valid_from..valid_to`), one covering system time (`sys_from..sys_to`); `ORDER BY ... DESC LIMIT 1` for defensive single-row pick under malformed data.

#### Explanation

The headline mechanic is two stacked SCD2 predicates: business time (when was this true *in reality*) AND system time (when did we *believe* it). Both use half-open intervals — `[from, to)`. A single row in `account_balance` represents "between sys_from and sys_to, we believed the balance during business window [valid_from, valid_to)". The query asks: as of system time 2026-04-01, what did we believe about business date 2026-03-15? Both predicates must hold. The naive trap is using only one of the two ranges — a query like "what's the balance on 2026-03-15" without `sys_from/sys_to` returns *all historical beliefs* about that business date, not the one as of a specific knowledge cutoff. For audit reconstruction (regulator says "tell me what your books said on April 1st about March 15th"), you need both axes. The defensive `ORDER BY ... DESC LIMIT 1` is the same SCD2 robustness pattern from #26: if multiple rows satisfy both predicates (shouldn't, by well-formed bitemporal modelling, but happens), pick the latest-asserted one. The half-open interval convention (`< valid_to`, not `<=`) means a state ending exactly at the queried date is not covered — confirm with the data model author. NULL `valid_to` or `sys_to` means "still effective", handled by the `IS NULL` branch. Production framing: real fintech ledgers (Stripe Balance, Plaid Asset Reports, JP Morgan position systems) all use this shape — every correction creates a new sys_from row, the old row gets `sys_to` set to "now". The result: full audit-trail reconstruction at any (business_date, knowledge_date) pair, which is what regulators require. Edge case: querying with a future `sys_at` returns the same answer as querying with `'now'` (latest belief). Querying with a past `sys_at` before any data was loaded returns nothing — correctly. Tie semantics: `valid_from DESC, sys_from DESC` tiebreaker handles multiple revisions with the same effective dates by picking the most recently asserted.

#### Solution

```sql
-- Postgres 17/18.
SELECT balance
FROM account_balance
WHERE account_id = 42
  AND DATE '2026-03-15' >= valid_from
  AND (valid_to IS NULL OR DATE '2026-03-15' < valid_to)
  AND TIMESTAMP '2026-04-01 00:00:00' >= sys_from
  AND (sys_to IS NULL OR TIMESTAMP '2026-04-01 00:00:00' < sys_to)
ORDER BY valid_from DESC, sys_from DESC
LIMIT 1;
```

*Source: Folk interview question — Stripe / Plaid ledger screen*

---

## Hierarchical Aggregation (GROUPING SETS / Pivot)

Hierarchical aggregation tests whether you know the SQL constructs that exist specifically for OLAP-style multi-level rollups — `GROUPING SETS`, `ROLLUP`, `CUBE`, and the `GROUPING()` function that distinguishes "this NULL is a subtotal marker" from "the underlying data was NULL". For pivot/unpivot, Postgres ships `tablefunc.crosstab` for true dynamic pivots and `LATERAL VALUES` for unpivot — both cleaner than chained `CASE/SUM(FILTER)` hand-rolls once the column set gets wide. These 4 problems probe each construct under conditions where the wrong choice produces wrong subtotals or unmaintainable column lists.

### 103. Sales Cube by Region, Product, and Quarter

#### Problem

Given `sales(region, product, quarter, amount)`, produce a multi-level rollup: per-region per-product totals, per-region totals (across products), per-product totals (across regions), and grand total — all in a single result set. Mark subtotal rows with NULLs in the rolled-up dimension columns.

**Tables:** `sales`

**Expected output (sample):**

| region | product | quarter | total  |
|--------|---------|---------|--------|
| EMEA   | widget  | Q1      | 5200   |
| EMEA   | NULL    | NULL    | 18400  |
| NULL   | widget  | NULL    | 22100  |
| NULL   | NULL    | NULL    | 89200  |

*Why interviewers ask this: rollup vs cube vs grouping sets is the basic OLAP literacy probe. Senior candidates list the specific subsets they want; mid-level candidates use `CUBE` and over-generate.*

#### Pattern

`GROUP BY GROUPING SETS ((region, product), (region), (product), ())` — explicit subset list (vs `CUBE` which generates the full power set, or `ROLLUP` which generates the prefix-chain only).

#### Explanation

The headline mechanic is `GROUPING SETS` — an explicit list of column subsets to group by. Each set produces one logical aggregation pass; Postgres evaluates them all in one execution and unions the results. The naive alternatives: `CUBE(region, product)` is shorthand for *all* subsets `{(region, product), (region), (product), ()}` — fine when you want every combo, but for three columns CUBE produces 8 subsets, often more than needed. `ROLLUP(region, product)` is the prefix chain `{(region, product), (region), ()}` — for hierarchies where the order matters (year → quarter → month). The naive non-GROUPING-SETS form is `UNION ALL` of four separate aggregates — works but slower (4 passes) and harder to maintain. The `GROUPING(col)` function distinguishes "this NULL is a subtotal marker" (GROUPING returns 1) from "the underlying data was NULL" (GROUPING returns 0). Critical for downstream consumers that need to render subtotal rows differently. Common mistake: forgetting `GROUPING()` and ordering by `region NULLS LAST` — the grand-total NULL row interleaves with data NULL rows in unpredictable ways. NULL handling: rolled-up columns contain NULL in the output; data NULLs in source columns become indistinguishable from subtotal NULLs unless `GROUPING()` is in the SELECT or ORDER BY. Edge case: an empty subset `()` produces the grand total; omitting it from the GROUPING SETS list omits the grand total — sometimes desired. Performance: GROUPING SETS uses a sort-based or hash-based plan depending on cardinality; for skewed dimensions, expect `HashAggregate` with multiple grouping keys consolidated. The query as shown intentionally writes `NULL::text AS quarter` to keep the schema consistent across rollup levels — the quarter dimension is in the data but not in this rollup; replacing with a literal NULL keeps column count uniform.

#### Solution

```sql
-- Postgres 17/18.
SELECT region, product, NULL::text AS quarter, SUM(amount) AS total
FROM sales
GROUP BY GROUPING SETS (
  (region, product),
  (region),
  (product),
  ()
)
ORDER BY GROUPING(region), region NULLS LAST, GROUPING(product), product NULLS LAST;
```

*Source: TPC-H Benchmark, Query Q1 (adapted to multi-dimensional rollup form)*

---

### 104. Dynamic Pivot of Monthly Revenue

#### Problem

Given `revenue(product, month, amount)` where `month` is an integer 1..12, pivot into one row per product with 12 columns — `m1, m2, ..., m12` — holding the SUM of amount for that month, 0 for months with no rows.

**Tables:** `revenue`

**Expected output (sample):**

| product | m1   | m2   | m3   | ... | m12  |
|---------|------|------|------|-----|------|
| widget  | 1200 | 1500 | 0    | ... | 3400 |
| gadget  | 0    | 800  | 900  | ... | 1100 |

*Why interviewers ask this: pivot is the OLAP question that probes whether you know the `tablefunc.crosstab` extension or fall back to `SUM(...) FILTER` per column. Senior candidates name both and pick crosstab for dynamic-column-list scenarios.*

#### Pattern

`tablefunc.crosstab(source_query, spine_query)` — Postgres's native pivot via the `tablefunc` extension; source query produces `(row_key, category, value)` triples, spine query enumerates the categories (months 1..12) to ensure zero-fill, output column list declared literally with `AS ct(...)`.

#### Explanation

The headline mechanic is `crosstab` — Postgres's native pivot. The function takes two SQL strings: the *source query* producing `(row_key, category_key, value)` triples (sorted by row_key, then category_key) and the *spine query* producing the full category set so missing categories get zero-fill. The crosstab function emits one row per distinct row_key with one column per category. The `AS ct(...)` clause declares the output column types — required because the function returns `record` and the column names/types aren't inferable. The naive alternative is 12 `SUM(amount) FILTER (WHERE month = N) AS mN` columns in a single SELECT — works, more portable (no extension), and arguably clearer for fixed-column-count pivots. `crosstab` wins when the column count is large or dynamic. The trap with crosstab is the requirement that the source query is sorted by `(row_key, category_key)` — getting the sort wrong produces interleaved garbage. The naive alternative #2 is `JSON_OBJECT_AGG(month, amount)` to build a JSON object per product, then extract — works for "any column set" but produces JSON not columns. For dynamic column sets where the column set must be declared at write time, you'd typically generate the column list via a string-building function (plpgsql) — `crosstab_hash` variant exists for unsorted source. NULL handling: missing (product, month) combinations produce NULL in the output (crosstab doesn't zero-fill automatically) — wrap with `COALESCE` if zero-fill is required, or use the FILTER form which produces zero via SUM-over-zero-rows naturally. Edge case: a product with no revenue rows at all wouldn't appear in the output — handle by joining against a `products` table if total coverage matters. Performance: crosstab is one pass; the FILTER form is also one pass but with 12 per-row CASE evaluations.

#### Solution

```sql
-- Postgres 17/18.
-- Requires: CREATE EXTENSION IF NOT EXISTS tablefunc;
SELECT *
FROM crosstab(
  $$SELECT product, month, SUM(amount)::numeric AS amount
    FROM revenue
    GROUP BY product, month
    ORDER BY product, month$$,
  $$SELECT generate_series(1, 12)$$
) AS ct(
  product text,
  m1 numeric, m2 numeric, m3 numeric, m4 numeric,
  m5 numeric, m6 numeric, m7 numeric, m8 numeric,
  m9 numeric, m10 numeric, m11 numeric, m12 numeric
)
ORDER BY product;
```

*Source: LeetCode #2252 — Dynamic Pivoting of a Table*

---

### 105. Dynamic Unpivot of Wide Table

#### Problem

Given `wide(product, m1, m2, ..., m12)` (the output shape of #32), unpivot back to long form `(product, month, amount)` excluding rows where amount is 0.

**Tables:** `wide`

**Expected output (sample):**

| product | month | amount |
|---------|-------|--------|
| widget  | 1     | 1200   |
| widget  | 2     | 1500   |
| widget  | 12    | 3400   |

*Why interviewers ask this: Postgres has no UNPIVOT keyword (unlike Oracle/SQL Server). The senior signal is reaching for `LATERAL VALUES` immediately rather than constructing 12 separate `SELECT product, N AS month, mN AS amount UNION ALL` clauses.*

#### Pattern

`LATERAL (VALUES (1, m1), (2, m2), ..., (12, m12)) u(month, amount)` — Postgres-idiomatic columns-to-rows expansion, no extension required, one row per (product, month) emitted in one pass.

#### Explanation

The headline mechanic is `LATERAL VALUES` — for each row in the outer table, the LATERAL produces 12 (month, amount) tuples from a `VALUES` constructor that references the outer row's columns. Each outer row × 12 inner rows yields a 12× expansion: the unpivot. The naive alternative is 12 `UNION ALL` clauses: `SELECT product, 1 AS month, m1 AS amount FROM wide WHERE m1 <> 0 UNION ALL SELECT product, 2 AS month, m2 AS amount FROM wide WHERE m2 <> 0 ...` — works but produces 12 scans of `wide` and is 12× more code. `LATERAL VALUES` does it in one scan. The third alternative — `JSON_TABLE` (PG 17+) — is shown in #50 and is the right form when the column list is dynamic; for the static 12-month case, `LATERAL VALUES` is cleaner. The `WHERE u.amount <> 0` filter happens after the unpivot; pushing it inside the LATERAL doesn't help because the VALUES list is constructed per outer row regardless. NULL handling: NULL amounts in the wide table become NULL rows in the long form; the `<> 0` predicate is NULL-false (NULL comparison is UNKNOWN), so NULLs are dropped along with zeros — usually fine, but if NULLs should survive as long-form NULL rows, use `WHERE u.amount IS DISTINCT FROM 0`. Edge case: a product with all 12 months equal to 0 produces no long-form rows — correctly omitted under the spec. Tie semantics: not applicable; each (product, month) is unique by construction. Performance: one scan of `wide`, one LATERAL evaluation per row producing 12 tuples — O(N) with low constant. Production framing: this is the inverse of #32; if you control the schema, store long-form rows and pivot at read time rather than store wide and unpivot — long-form is normalized and indexable.

#### Solution

```sql
-- Postgres 17/18.
SELECT w.product, u.month, u.amount
FROM wide w,
LATERAL (
  VALUES
    (1, w.m1), (2, w.m2), (3, w.m3), (4, w.m4),
    (5, w.m5), (6, w.m6), (7, w.m7), (8, w.m8),
    (9, w.m9), (10, w.m10), (11, w.m11), (12, w.m12)
) u(month, amount)
WHERE u.amount <> 0
ORDER BY w.product, u.month;
```

*Source: LeetCode #2253 — Dynamic Unpivoting of a Table*

---

### 106. ROLLUP with Visible Subtotal Labels

#### Problem

Given `expenses(department, category, amount)`, return per-(department, category) totals plus per-department subtotals plus a grand total — and tag each row with its level: `'detail'`, `'department_subtotal'`, or `'grand_total'`.

**Tables:** `expenses`

**Expected output (sample):**

| department | category | amount | level                |
|------------|----------|--------|----------------------|
| eng        | travel   | 4200   | detail               |
| eng        | tools    | 8100   | detail               |
| eng        | NULL     | 12300  | department_subtotal  |
| NULL       | NULL     | 38400  | grand_total          |

*Why interviewers ask this: `ROLLUP` is one of the three OLAP grouping constructs (with `CUBE` and `GROUPING SETS`). The senior signal is using `GROUPING()` to distinguish subtotal NULLs from data NULLs and producing a level column that downstream UIs can render hierarchically.*

#### Pattern

`GROUP BY ROLLUP(department, category)` produces the prefix-chain subsets `{(department, category), (department), ()}`; `GROUPING(department) + GROUPING(category)` arithmetic produces the hierarchy depth, mapped to text labels via `CASE`.

#### Explanation

The headline mechanic is `ROLLUP(a, b)` — the prefix-chain subset list, equivalent to `GROUPING SETS ((a, b), (a), ())`. This shape suits hierarchies where the order of columns matters: department → category, year → quarter → month. For each level the aggregate produces one row per distinct prefix, with NULLs in the rolled-up columns. The naive alternative is three separate aggregates UNIONed — 3 scans vs ROLLUP's 1. `GROUPING(col)` returns 1 if `col` is rolled up (NULL is a subtotal marker) and 0 otherwise. Summing the GROUPING flags gives the depth: 0 = both columns are real (detail), 1 = category rolled up (department subtotal), 2 = both rolled up (grand total). The `CASE` maps depths to human-readable labels. The trap without `GROUPING()` is data NULLs (an expense with a NULL category in the source) — they appear in the result alongside subtotal NULLs and you can't distinguish them. `GROUPING()` is the only safe way. The `ORDER BY GROUPING(department), department NULLS LAST, GROUPING(category), category NULLS LAST` clause is the conventional rendering order: detail rows first (sorted by department then category), department subtotals next (each at the bottom of its block), grand total last. NULL handling: this is the whole point — the `NULLS LAST` clauses ensure subtotal NULLs land after data values, and the `GROUPING()` clauses ensure data NULLs and subtotal NULLs are correctly distinguished. Edge case: a department with one category produces both a detail row and a (numerically identical) subtotal row — sometimes desired, sometimes confusing. Production form might add `HAVING GROUPING(category) = 1 OR EXISTS (...)` to suppress redundant subtotals — overkill for an interview.

#### Solution

```sql
-- Postgres 17/18.
SELECT department, category, SUM(amount) AS amount,
       CASE GROUPING(department) + GROUPING(category)
         WHEN 0 THEN 'detail'
         WHEN 1 THEN 'department_subtotal'
         WHEN 2 THEN 'grand_total'
       END AS level
FROM expenses
GROUP BY ROLLUP(department, category)
ORDER BY GROUPING(department), department NULLS LAST,
         GROUPING(category), category NULLS LAST;
```

*Source: Original — Advanced SQL Practice*

---

## Set Operations, Anti-Joins & Semi-Joins

Set operations and anti/semi joins reward candidates who know the NULL semantics of `IN` vs `EXISTS`, the multiplicity difference between `INTERSECT` and `INTERSECT ALL`, and which form lets the planner pick a hash-anti-join vs a nested-loop. The classic mistake is `WHERE x NOT IN (SELECT y FROM t)` when `t.y` might be NULL — one NULL and the entire predicate evaluates to UNKNOWN, returning zero rows. `NOT EXISTS` has no such trap. These 5 problems exercise each construct in the form a senior interviewer expects: explicit, NULL-safe, plan-friendly.

### 107. Customers Who Never Ordered Product X

#### Problem

Given `customers(id)` and `orders(id, customer_id, product_id)`, return customer ids that have placed at least one order but **no order for `product_id = 99`**.

**Tables:** `customers`, `orders`

**Expected output (sample):**

| customer_id |
|-------------|
| 4           |
| 17          |

*Why interviewers ask this: this is the canonical `NOT IN` NULL-trap test. Senior candidates know that one NULL in the subquery makes `NOT IN` return nothing and reach for `NOT EXISTS` immediately.*

#### Pattern

Compound semi-join + anti-join: `EXISTS (... orders ... customer_id = c.id)` for "has ordered anything" + `NOT EXISTS (... orders ... customer_id = c.id AND product_id = 99)` for "never ordered product 99" — both correlated, both NULL-safe, both indexable.

#### Explanation

The headline mechanic is `NOT EXISTS` as the NULL-safe anti-join. The naive `WHERE c.id NOT IN (SELECT customer_id FROM orders WHERE product_id = 99)` form has a classic NULL trap: if any row in the subquery has `customer_id IS NULL`, the `NOT IN` evaluates `c.id = NULL` to UNKNOWN (not FALSE), and `c.id NOT IN (...)` is `NOT UNKNOWN = UNKNOWN`, which the WHERE clause treats as FALSE — every outer row drops. `NOT EXISTS` has no such issue: it returns TRUE iff the inner correlated query is empty, and NULLs in the inner query don't affect that. The compound here has both an `EXISTS` (semi-join: "at least one order") and a `NOT EXISTS` (anti-join: "no product-99 order"). The planner can convert both to anti/semi join operations and execute in one scan — `EXPLAIN ANALYZE` shows `Hash Anti Join` and `Hash Semi Join` nodes. The alternative `LEFT JOIN ... WHERE x IS NULL` form for anti-join works (and historically was faster on some planners), but `NOT EXISTS` is the modern idiom and benchmarks equivalently in PG 12+. NULL handling: as discussed — `NOT EXISTS` is NULL-safe; `NOT IN` is not. Edge case: a customer with no orders at all fails the `EXISTS` predicate and is correctly excluded — the spec requires "at least one order". Index strategy: `CREATE INDEX ON orders (customer_id)` for the EXISTS check; `CREATE INDEX ON orders (customer_id, product_id) WHERE product_id = 99` (partial) for the NOT EXISTS — or just the composite `(customer_id, product_id)`. Tie semantics not applicable. Production framing: this is the prototype of "customers who haven't done X" queries — segmentation, churn detection, marketing automation. At scale, materialize as a daily-refreshed boolean column on `customers` rather than recompute per query.

#### Solution

```sql
-- Postgres 17/18.
SELECT c.id AS customer_id
FROM customers c
WHERE EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM orders o
  WHERE o.customer_id = c.id AND o.product_id = 99
)
ORDER BY c.id;
```

*Source: Folk interview question — Amazon SDE screen*

---

### 108. Symmetric Difference of Two Sets

#### Problem

Given `set_a(id)` and `set_b(id)`, return the symmetric difference — values in exactly one of the two sets — with a column tagging which side it came from. Deduplicate inputs.

**Tables:** `set_a`, `set_b`

**Expected output (sample):**

| id | only_in |
|----|---------|
| 3  | a       |
| 7  | b       |

*Why interviewers ask this: symmetric difference is the textbook set operation. Senior candidates reach for `EXCEPT` (dedupes by default) over `LEFT JOIN ... WHERE IS NULL` (verbose, doesn't dedupe).*

#### Pattern

Two `EXCEPT` clauses (each computes one side's exclusive elements), tagged with a constant column, combined via `UNION ALL` — `EXCEPT` dedupes by default, `UNION ALL` skips redundant dedup since each side is already exclusive.

#### Explanation

The headline mechanic is `EXCEPT` as set difference — `A EXCEPT B` returns elements in A but not in B, deduplicating both inputs first. The query computes `A EXCEPT B` (only-in-a) and `B EXCEPT A` (only-in-b), tags each with a literal `'a'` or `'b'`, and unions. `UNION ALL` is the right combiner because the two `EXCEPT` results are by construction disjoint — no element can be both in `A\B` and `B\A` — so a `UNION` (with dedup) would waste a hash-distinct pass. The naive alternatives: (1) `FULL OUTER JOIN` of A to B with `WHERE A.id IS NULL OR B.id IS NULL` — works but doesn't dedupe by default and requires four `COALESCE`-and-CASE expressions to construct the output; (2) two `NOT IN` queries — NULL trap; (3) `NOT EXISTS` form — works but more verbose than `EXCEPT`. The `EXCEPT ALL` variant would preserve multiplicity (`A EXCEPT ALL B` returns `count_in_a - count_in_b` copies if positive); spec says "deduplicate", so plain `EXCEPT` is correct. NULL handling: `EXCEPT` treats `NULL = NULL` (unlike `=`), so a NULL value in both sets gets removed by either `EXCEPT`. If you want NULLs in the output, the FULL JOIN form is needed. Edge case: a value present in both sets with different multiplicities — `EXCEPT` dedupes both sides first, so the value appears in neither output (correct for set semantics). The two single-value subqueries inside `EXCEPT` are required because the bare `SELECT id FROM set_a EXCEPT SELECT id FROM set_b` can't directly tag the rows; nesting and tagging via outer SELECT is the workaround. Production framing: this is the "diff two snapshots" query — comparing two versions of a customer list, two days of order ids, etc. Tagging makes the result actionable downstream.

#### Solution

```sql
-- Postgres 17/18.
SELECT id, 'a' AS only_in FROM (
  SELECT id FROM set_a EXCEPT SELECT id FROM set_b
) a
UNION ALL
SELECT id, 'b' FROM (
  SELECT id FROM set_b EXCEPT SELECT id FROM set_a
) b
ORDER BY id;
```

*Source: Adapted from Celko, "SQL Puzzles & Answers" — set algebra puzzles*

---

### 109. Anti-Join: Inactive Sellers (No Sale in 90 Days)

#### Problem

Given `sellers(id, status)` and `sales(seller_id, ts)`, return active sellers (`status = 'active'`) with **no sale** in the last 90 days as of `'2026-05-01'`.

**Tables:** `sellers`, `sales`

**Expected output (sample):**

| seller_id |
|-----------|
| 11        |
| 27        |

*Why interviewers ask this: it's the "inactive entities" lapsed-engagement query — appears in churn detection, supplier review queues, dormant-account cleanups. The senior signal is putting the date predicate *inside* the correlated subquery so only recent sales are scanned.*

#### Pattern

`NOT EXISTS` correlated subquery with the date predicate pushed inside (`sa.ts >= cutoff_date - INTERVAL '90 days'`) so the anti-join scan only touches recent sales rows — combined with the outer `status = 'active'` filter, the planner can use a partial index on the date range.

#### Explanation

The headline mechanic is the predicate-placement choice — pushing the `sa.ts >= cutoff - 90 days` predicate inside the `NOT EXISTS` subquery is what makes the query indexable. If the predicate were in the outer WHERE (`WHERE NOT EXISTS (SELECT 1 FROM sales WHERE seller_id = s.id) AND ts >= cutoff - 90 days`), there's no `ts` column at the outer level — it wouldn't even parse. If you wrote the equivalent with `LEFT JOIN sales ... AND sa.ts >= cutoff - 90 days WHERE sa.seller_id IS NULL`, the predicate in the JOIN's ON clause filters which sales are considered; without it (predicate in WHERE), only sellers with no sales at all would qualify, missing those with sales older than 90 days. The `NOT EXISTS` form with the inner predicate cleanly expresses "no sale within the last 90 days" — the anti-join semantics handle "no row matching" correctly. The planner converts `NOT EXISTS` to a hash anti-join when statistics suggest the anti-side is large enough; for small lookup tables it stays a nested-loop anti-join. Index strategy: `CREATE INDEX ON sales (seller_id, ts DESC)` lets the inner subquery do an index range scan and short-circuit at first match — O(log N) per seller probe. The `status = 'active'` predicate is the outer filter — could benefit from a partial index `CREATE INDEX ON sellers (id) WHERE status = 'active'` if active sellers are a small fraction of all sellers. NULL handling: `NOT EXISTS` is NULL-safe (unlike `NOT IN`). Edge case: a seller with status 'active' but never any sales rows passes the `NOT EXISTS` predicate trivially and is correctly included as inactive. Tie semantics not applicable. Production framing: this query runs nightly to flag dormant sellers for follow-up; at scale, materialize the result as a `seller_status_extended.last_sale_dt` column updated by a daily MERGE (problem #65 shape) rather than recompute via NOT EXISTS each query.

#### Solution

```sql
-- Postgres 17/18.
SELECT s.id AS seller_id
FROM sellers s
WHERE s.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM sales sa
    WHERE sa.seller_id = s.id
      AND sa.ts >= DATE '2026-05-01' - INTERVAL '90 days'
  )
ORDER BY s.id;
```

*Source: DataLemur — "Inactive users" (Amazon tag) — adapted*

---

### 110. Intersection With Multiplicity

#### Problem

Given `bag_a(item)` and `bag_b(item)` (multisets — duplicates count), return the multiset intersection: items in both, repeated `min(count_in_a, count_in_b)` times.

**Tables:** `bag_a`, `bag_b`

**Expected output (sample):**

| item   |
|--------|
| apple  |
| apple  |
| banana |

*Why interviewers ask this: multiset semantics distinguish `INTERSECT` from `INTERSECT ALL`, `UNION` from `UNION ALL`, `EXCEPT` from `EXCEPT ALL`. Senior candidates know all six variants and pick by spec.*

#### Pattern

`INTERSECT ALL` — multiset intersection preserving `min(count_in_a, count_in_b)` per element; no dedup pass, contrast with `INTERSECT` which deduplicates both sides first.

#### Explanation

The headline mechanic is the `ALL` variant of the set operator. SQL's set operations come in six flavours: `UNION`, `UNION ALL`, `INTERSECT`, `INTERSECT ALL`, `EXCEPT`, `EXCEPT ALL`. The non-ALL forms apply set semantics (dedupe both inputs first); the ALL forms apply multiset semantics (preserve multiplicities per element). For intersection: if A has 3 apples and B has 2, `INTERSECT ALL` returns 2 apples; `INTERSECT` returns 1 apple. The spec here ("repeated min(count_in_a, count_in_b) times") is exactly `INTERSECT ALL`. The naive alternative — what you'd write in MySQL where `INTERSECT ALL` isn't supported — is to row-number each side per item (`ROW_NUMBER() OVER (PARTITION BY item ORDER BY ...)`) and inner-join on `(item, row_num)` — works but verbose, and the JOIN gives `min(count_a, count_b)` rows naturally. The second naive alternative is `JOIN bag_a USING (item)` — produces `count_a * count_b` rows per item, way too many. `INTERSECT ALL` is the right answer in two characters. NULL handling: `INTERSECT ALL` treats `NULL = NULL` (unlike `=`), so NULL items in both bags get included; if NULLs should be excluded, filter at input. Edge case: an item in A but not in B contributes zero rows — correct multiset min. Both bags being empty produces empty output. Performance: `INTERSECT ALL` is implemented as hash or merge plus per-key multiplicity tracking; both inputs must be scanned fully. For huge bags, indexing on `item` helps the merge plan. Production framing: multiset operations matter for inventory reconciliation (what's in two warehouse counts), bag-of-words comparison (NLP), and append-log reconciliation. The mid-level mistake of using `INTERSECT` instead of `INTERSECT ALL` is the kind of bug that silently undercounts in production.

#### Solution

```sql
-- Postgres 17/18.
SELECT item FROM bag_a
INTERSECT ALL
SELECT item FROM bag_b
ORDER BY item;
```

*Source: Adapted from Celko, "SQL Puzzles & Answers" — multiset operations*

---

### 111. Semi-Join Via LATERAL EXISTS

#### Problem

Given `orders(id, customer_id, ts)` and `priority_customers(customer_id)`, return orders placed by priority customers — but use a form that's amenable to a streaming pipeline (no JOIN, no IN).

**Tables:** `orders`, `priority_customers`

**Expected output (sample):**

| order_id | customer_id | ts                  |
|----------|-------------|---------------------|
| 14       | 7           | 2026-04-01 10:00:00 |
| 22       | 7           | 2026-04-03 11:00:00 |

*Why interviewers ask this: semi-join semantics — at most one output row per outer row regardless of inner matches — is the streaming-friendly form. Senior candidates reach for `EXISTS` over `IN` because `EXISTS` short-circuits per outer row.*

#### Pattern

`EXISTS` semi-join: `WHERE EXISTS (SELECT 1 FROM priority_customers p WHERE p.customer_id = o.customer_id)` — returns each outer row at most once regardless of inner duplicates, planner short-circuits at first match per outer row.

#### Explanation

The headline mechanic is the semi-join semantic of `EXISTS` — for each outer row, the planner evaluates the correlated inner query and emits the outer row iff the inner query returns at least one row. Critically, the outer row is emitted at most once, even if the inner has many matches. This is the streaming-pipeline-friendly form: no row duplication from a JOIN, no need for a `DISTINCT` to clean up afterwards. The `IN (subquery)` form is semantically equivalent for non-NULL columns and the planner converts both to the same `Hash Semi Join` plan in modern PG — but `EXISTS` is the more idiomatic form when the inner is correlated, and `IN` reads better when the inner is an uncorrelated set. The contrast with explicit `JOIN`: `SELECT o.* FROM orders o JOIN priority_customers p ON p.customer_id = o.customer_id` produces N output rows for N inner matches per outer row — if a customer appears 3 times in `priority_customers` (data bug), every order from that customer appears 3 times in the output. `EXISTS` is immune. The planner choice depends on cardinality: if `priority_customers` is small and `orders` is large, the planner builds a hash on the priority list and probes per order — `Hash Semi Join`. If priority is huge and orders small, the planner inverts — nested-loop with per-priority probes. `EXPLAIN ANALYZE` shows `Hash Semi Join` for the typical case. NULL handling: `EXISTS` is NULL-safe; if `priority_customers.customer_id` is NULL, that row doesn't match any outer row's equality predicate, so it contributes nothing — same as `IN`'s NULL semantics for *positive* membership (the trap is `NOT IN`, not `IN`). Edge case: a customer in `priority_customers` with no orders contributes nothing to the output (no outer row to attach). Production framing: in streaming pipelines (Flink, Kafka Streams), the semi-join is implemented as a hash-set lookup per inbound order — exactly what `EXISTS` represents in SQL. The semantic preservation across SQL → streaming is the senior architectural point.

#### Solution

```sql
-- Postgres 17/18.
SELECT o.id AS order_id, o.customer_id, o.ts
FROM orders o
WHERE EXISTS (
  SELECT 1 FROM priority_customers p
  WHERE p.customer_id = o.customer_id
)
ORDER BY o.ts;
```

*Source: Folk interview question — Stripe / Block streaming-pipeline screen*

---

## Statistical SQL

Statistical SQL tests whether you know Postgres has native `PERCENTILE_CONT`, `REGR_*`, `CORR`, `COVAR_*`, `STDDEV_SAMP/POP`, and `WIDTH_BUCKET` — or whether you'd compute Σxy − nx̄ȳ manually. Knowing the built-ins is the answer; the failure mode is reinventing them in CTEs. The other concern is sample-vs-population semantics: `STDDEV_SAMP` and `VAR_SAMP` divide by n−1 (inferential); `STDDEV_POP` and `VAR_POP` divide by n (descriptive over the full population). Pick deliberately. These 5 problems probe percentile distributions, regression, correlation, outlier rules, and histogram bucketing — the core analytics workload.

### 112. Percentile Bands of Order Value

#### Problem

Given `orders(id, amount)`, return the p25, p50, p75, p90, p99 of `amount`, plus the mean and standard deviation, in a single row.

**Tables:** `orders`

**Expected output (sample):**

| p25  | p50  | p75   | p90   | p99   | mean  | stddev |
|------|------|-------|-------|-------|-------|--------|
| 24.0 | 51.5 | 102.0 | 184.0 | 510.0 | 73.2  | 88.1   |

*Why interviewers ask this: it tests basic statistical-SQL literacy. The trap is candidates computing percentiles via `ROW_NUMBER`-positional picking when `PERCENTILE_CONT` is built in.*

#### Pattern

Multiple `PERCENTILE_CONT(p) WITHIN GROUP (ORDER BY amount)` aggregates in one SELECT — Postgres evaluates all ordered-set aggregates in one sort pass; `AVG` and `STDDEV_SAMP` sit beside them as plain aggregates in the same SELECT.

#### Explanation

The headline mechanic is composing multiple ordered-set aggregates in one SELECT — Postgres recognises that all five `PERCENTILE_CONT(p) WITHIN GROUP (ORDER BY amount)` calls require the same sorted input and reuses the sort. The whole query is one scan + one sort of `orders`. The naive alternative — five `WITH ... AS (SELECT ..., ROW_NUMBER() OVER (ORDER BY amount) AS rn FROM orders), p25 AS (SELECT amount FROM ranked WHERE rn = ...)` — is verbose, doesn't handle non-integer rank positions (the median of an even-count dataset), and serially scans the input. `PERCENTILE_CONT` (continuous) interpolates linearly between the two surrounding values when the percentile falls between data points: for a 4-row dataset, the median is `(row2 + row3) / 2`. `PERCENTILE_DISC` (discrete) returns an actual data point — `row2` for the same case. Use `CONT` for continuous quantities (price, latency); use `DISC` when you need "which actual customer's value is at the percentile". The array form `PERCENTILE_CONT(ARRAY[0.25, 0.5, 0.75, 0.9, 0.99]) WITHIN GROUP (ORDER BY amount)` returns one array column — preferable when the percentile list is dynamic or huge. `STDDEV_SAMP` vs `STDDEV_POP`: SAMP divides by `n-1` (Bessel's correction, sample stddev — use for inferential statistics where the data is a sample of a larger population); POP divides by `n` (population stddev — use when the data IS the population). For "stddev of order amounts" in a dashboard context, POP is technically right (the orders are the whole population for that day) but SAMP is the convention because dashboards generalize. Discuss in the interview. NULL handling: `PERCENTILE_CONT` ignores NULLs; `AVG`/`STDDEV` ignore NULLs. Empty input: all aggregates return NULL. Edge case: a single-row input — median is the value itself, p90 also (no interpolation possible), stddev is NULL by SAMP definition (no degrees of freedom). Production framing: this is the dashboard query for order-value distribution; at billions of rows, approximate percentiles via `tdigest` (extension) or pre-aggregated histograms.

#### Solution

```sql
-- Postgres 17/18.
SELECT
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY amount) AS p25,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY amount) AS p50,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY amount) AS p75,
  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY amount) AS p90,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY amount) AS p99,
  ROUND(AVG(amount)::numeric, 2) AS mean,
  ROUND(STDDEV_SAMP(amount)::numeric, 2) AS stddev
FROM orders;
-- Array form: PERCENTILE_CONT(ARRAY[0.25, 0.5, 0.75, 0.9, 0.99]) WITHIN GROUP (ORDER BY amount)
```

*Source: StrataScratch — "Order value distribution" (Amazon)*

---

### 113. Linear Regression Slope and Intercept

#### Problem

Given `data(x, y)`, compute the OLS slope and intercept of `y` regressed on `x`, plus the R² and the count.

**Tables:** `data`

**Expected output (sample):**

| slope | intercept | r_squared | n   |
|-------|-----------|-----------|-----|
| 2.34  | -1.12     | 0.876     | 412 |

*Why interviewers ask this: the whole answer is "Postgres has these built in". Senior candidates know `REGR_SLOPE`, `REGR_INTERCEPT`, `REGR_R2` exist; mid-level candidates spend 10 minutes writing the Σxy − nx̄ȳ formulas manually.*

#### Pattern

Native ordinary-least-squares regression aggregates: `REGR_SLOPE(y, x)`, `REGR_INTERCEPT(y, x)`, `REGR_R2(y, x)`, `REGR_COUNT(y, x)` — all one-pass aggregates over (x, y) pairs; argument order is `(dependent, independent)`.

#### Explanation

The headline mechanic is "Postgres ships these". The full family is `REGR_SLOPE`, `REGR_INTERCEPT`, `REGR_R2`, `REGR_AVGX`, `REGR_AVGY`, `REGR_COUNT`, `REGR_SXX`, `REGR_SYY`, `REGR_SXY` — covering every OLS quantity plus the sum-of-squares building blocks. Argument order is the SQL standard `(y, x)` — dependent variable first, independent second. The naive alternative is computing the formulas by hand: `slope = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)`, `intercept = (Σy − slope·Σx) / n`, `R² = 1 − Σ(yi − ŷi)² / Σ(yi − ȳ)²`. Each works but introduces opportunities for numerical instability (catastrophic cancellation when `Σx²` and `(Σx)²/n` are close) and is 20+ lines of code where the native aggregates are 4 lines. The native versions use numerically stable algorithms (Welford's online algorithm for variance, etc.) — important at billion-row scale. NULL handling: pairs where either x or y is NULL are ignored by all REGR_* aggregates — consistent with the statistical convention of pairwise-complete observations. Empty or single-pair input: slope/intercept return NULL (insufficient data); `REGR_COUNT` returns 0 (or 1). Edge case: all x values identical (vertical line in xy-plane) — slope is undefined, returns NULL. R² close to 0 means the regression explains little; R² close to 1 means strong fit; R² can go negative for models worse than the mean, but `REGR_R2` (the coefficient of determination from OLS) is always in [0, 1] when fitted to the data the formula assumes. Tie semantics not applicable. Production framing: for any "trend over time", "price vs feature size", "latency vs payload" analytics, the REGR family is the right tool; for multiple regression (multiple independent variables) or non-linear models, dump to Python/R via PL/Python or a separate pipeline.

#### Solution

```sql
-- Postgres 17/18.
SELECT
  REGR_SLOPE(y, x) AS slope,
  REGR_INTERCEPT(y, x) AS intercept,
  REGR_R2(y, x) AS r_squared,
  COUNT(*) AS n
FROM data;
```

*Source: Folk interview question — Two Sigma / Jane Street stats screen*

---

### 114. Pearson Correlation Between Pairs of Series

#### Problem

Given `series(label, x, y)`, return the Pearson correlation between x and y per label, sorted descending by |corr|.

**Tables:** `series`

**Expected output (sample):**

| label | corr   |
|-------|--------|
| AAPL  | 0.847  |
| GOOG  | -0.612 |
| TSLA  | 0.214  |

*Why interviewers ask this: `CORR` is a built-in. Senior candidates know that and don't hand-roll the Pearson formula.*

#### Pattern

`CORR(y, x)` aggregate per partition — Postgres-native Pearson correlation, one-pass per group with numerically stable Welford-style computation; sort by `ABS(CORR(...))` for "strongest signal first" output.

#### Explanation

The headline mechanic is the `CORR` aggregate — Pearson product-moment correlation coefficient, defined as `COVAR(y, x) / (STDDEV(y) · STDDEV(x))`. Postgres computes it in one pass using a numerically stable form (not the textbook three-pass formula). The naive alternative is hand-rolling: `(n·Σxy − Σx·Σy) / sqrt((n·Σx² − (Σx)²) · (n·Σy² − (Σy)²))` — works but vulnerable to catastrophic cancellation at high magnitudes (the numerator is the difference of two large numbers; the denominator squares and subtracts). The native version uses Welford's online algorithm. Companion aggregates: `COVAR_SAMP(y, x)` (sample covariance, divides by n-1), `COVAR_POP` (population covariance, divides by n). The `CORR` function normalises both sides — sample vs population stddev cancel out — so there's only one `CORR`, not `CORR_SAMP` / `CORR_POP`. Sort by `ABS(CORR(y, x))` to surface the strongest correlations regardless of sign — a senior reporting pattern. `ORDER BY` can reference the aggregate directly, no need to repeat in a HAVING. NULL handling: pairs where x or y is NULL are ignored (pairwise-complete). Empty or single-pair groups: CORR returns NULL (need at least two pairs for a covariance). Edge case: constant x or constant y produces a zero denominator — `CORR` returns NULL (vs the hand-rolled form which would divide-by-zero). Edge case 2: perfectly collinear data returns ±1.0 — confirm that's not a sign of a data bug (the two columns may be different units of the same quantity). Tie semantics not applicable. Production framing: Pearson assumes linear relationship — if signals are non-linear, use Spearman rank correlation (no Postgres built-in; compute via `CORR(RANK() OVER (ORDER BY x), RANK() OVER (ORDER BY y))` per group). At quant-firm interviews this distinction is the senior signal.

#### Solution

```sql
-- Postgres 17/18.
SELECT label,
       ROUND(CORR(y, x)::numeric, 3) AS corr
FROM series
GROUP BY label
ORDER BY ABS(CORR(y, x)) DESC;
```

*Source: StrataScratch — "Correlation by group" (Citadel/Two-Sigma tag)*

---

### 115. Outlier Detection via Interquartile Range

#### Problem

Given `measurements(sensor_id, value)`, return readings that are outliers by the IQR rule: `value < q1 - 1.5*iqr` or `value > q3 + 1.5*iqr`, computed per sensor.

**Tables:** `measurements`

**Expected output (sample):**

| sensor_id | value  |
|-----------|--------|
| 14        | 1820.0 |
| 14        | -45.0  |
| 27        | 902.0  |

*Why interviewers ask this: it's the canonical "per-group percentiles + join back" composition. The trap is candidates trying `PERCENTILE_CONT(...) OVER (PARTITION BY sensor_id)` which doesn't exist as a window function.*

#### Pattern

CTE per-sensor IQR bounds via `PERCENTILE_CONT(ARRAY[0.25, 0.75]) WITHIN GROUP (ORDER BY value)` (returns 2-element array per sensor), JOIN back to measurements, filter by `value < q1 - 1.5*(q3-q1) OR value > q3 + 1.5*(q3-q1)`.

#### Explanation

The headline mechanic is the array-form of `PERCENTILE_CONT` — passing an array `[0.25, 0.75]` returns both quartiles in one call, indexed `[1]` and `[2]` (Postgres arrays are 1-based). This is half the cost of two separate `PERCENTILE_CONT(0.25)` and `PERCENTILE_CONT(0.75)` calls — Postgres still sorts once per group, but the array form constructs the result in one pass through the sorted values. Step 2 is the CTE-join-back pattern: compute per-group statistics in a CTE, JOIN to the raw rows, apply the per-row predicate. The naive trap is trying `PERCENTILE_CONT(0.25) OVER (PARTITION BY sensor_id)` — Postgres has no windowed ordered-set aggregates, this is a syntax error. The IQR formula is `q1 - 1.5*iqr` (lower fence) and `q3 + 1.5*iqr` (upper fence) where `iqr = q3 - q1`. The 1.5 multiplier is Tukey's convention for "outliers"; 3.0 is "extreme outliers". State which you're using. Alternative approaches: 3-sigma rule (mean ± 3*stddev) — sensitive to extreme values inflating the stddev; modified z-score using median absolute deviation (MAD) — more robust but no native Postgres aggregate (compute via subqueries). IQR is the senior dashboard default. NULL handling: NULL `value` rows are ignored by `PERCENTILE_CONT`; if you want to surface "missing reading" as an outlier, handle separately. Edge case: a sensor with too few readings (fewer than 4, the minimum for IQR to be meaningful) — q1 and q3 still compute via interpolation but the IQR is artificially narrow; consider filtering sensors with `COUNT(*) >= 20` minimum sample size. Sensors with constant values produce IQR = 0 — every reading equals q1 = q3, the predicates `value < q1 - 0` and `value > q3 + 0` are both false, no outliers — correct degenerate case. Tie semantics: percentile interpolation handles ties trivially. Production framing: real outlier detection runs in streaming pipelines using EWMA (exponentially-weighted moving average) for adaptivity to drift; the SQL form is the batch retrospective sweep.

#### Solution

```sql
-- Postgres 17/18.
WITH bounds AS (
  SELECT sensor_id,
         (PERCENTILE_CONT(ARRAY[0.25, 0.75]) WITHIN GROUP (ORDER BY value))[1] AS q1,
         (PERCENTILE_CONT(ARRAY[0.25, 0.75]) WITHIN GROUP (ORDER BY value))[2] AS q3
  FROM measurements
  GROUP BY sensor_id
)
SELECT m.sensor_id, m.value
FROM measurements m
JOIN bounds b USING (sensor_id)
WHERE m.value < b.q1 - 1.5 * (b.q3 - b.q1)
   OR m.value > b.q3 + 1.5 * (b.q3 - b.q1)
ORDER BY m.sensor_id, m.value;
```

*Source: Folk interview question — Citadel quant-research screen*

---

### 116. Histogram Bucketing with WIDTH_BUCKET

#### Problem

Given `requests(latency_ms)`, return a histogram with 10 equal-width buckets spanning 0..1000ms, plus a final overflow bucket for >1000ms. Output bucket index and count.

**Tables:** `requests`

**Expected output (sample):**

| bucket | range_label | n    |
|--------|-------------|------|
| 1      | 0-100       | 1240 |
| 2      | 100-200     | 870  |
| 11     | >1000       | 42   |

*Why interviewers ask this: `WIDTH_BUCKET` is the Postgres-native histogram primitive. Senior candidates use it; mid-level candidates write CASE chains.*

#### Pattern

`WIDTH_BUCKET(latency_ms, 0, 1000, 10)` — returns 0 for under-range values, 1..10 for in-range, 11 for over-range; group by bucket, count per bucket, label conditionally for the overflow.

#### Explanation

The headline mechanic is `WIDTH_BUCKET(value, lo, hi, n)` — a single function call that assigns each value to a bucket: 0 for value < lo, 1..n for value in [lo, hi), n+1 for value >= hi. The bucket boundaries are `lo + (i-1)·(hi-lo)/n` to `lo + i·(hi-lo)/n` for bucket i. Default semantics are equal-width linear buckets; for log-spaced buckets, take `WIDTH_BUCKET(LN(value), LN(lo), LN(hi), n)`. The naive alternative is a 10-clause `CASE` chain: `CASE WHEN latency_ms < 100 THEN 1 WHEN latency_ms < 200 THEN 2 ... END` — works, 10× longer, and changing the bucket count means rewriting. `WIDTH_BUCKET` is one function call and parametric. Postgres has no `INFINITY` bucket flag, so the overflow bucket is `n+1` and you label it conditionally. The result schema here: bucket index, range label, count. The conditional label uses string concatenation; an alternative is `format('%s-%s', (bucket-1)*100, bucket*100)`. NULL handling: NULL `latency_ms` produces NULL bucket and is silently dropped from GROUP BY — usually correct, but consider explicit `WHERE latency_ms IS NOT NULL` or `COALESCE`. Edge case: negative latency (clock skew, instrumentation bug) gets bucket 0 — useful as a data-quality signal; the query as shown only labels buckets 1..11 in the output, dropping bucket 0 — `WHERE bucket >= 1` would make this explicit. Edge case 2: a value exactly at `hi` (1000) goes to bucket 11 (the half-open `[lo, hi)` convention), not bucket 10 — explicit in the SQL standard. Tie semantics not applicable. Performance: `WIDTH_BUCKET` is one function call per row, then a HashAggregate over the bucket column — O(N) with low constant. Production framing: this is the latency-percentile dashboard query but for *distribution*, not just summary stats — the histogram tells you whether p99 is dragged by a long tail or a sharp jump (bimodal latency). The query as shown is the standard form; for sub-ms buckets at billions of rows, use `histogram_agg` from `tdigest` extension.

#### Solution

```sql
-- Postgres 17/18.
SELECT bucket,
       CASE bucket
         WHEN 11 THEN '>1000'
         ELSE ((bucket - 1) * 100) || '-' || (bucket * 100)
       END AS range_label,
       n
FROM (
  SELECT WIDTH_BUCKET(latency_ms, 0, 1000, 10) AS bucket,
         COUNT(*) AS n
  FROM requests
  GROUP BY 1
) h
ORDER BY bucket;
```

*Source: Folk interview question — FAANG infra/SRE screen*

---

## Top-K, Ranking & Tie-Breakers

Top-K queries look trivial but hide three traps: choosing among `ROW_NUMBER` / `RANK` / `DENSE_RANK` correctly for the tie semantics specified, picking a deterministic tie-breaker so results are stable across runs, and knowing when `DISTINCT ON` beats both for top-1-per-group. Postgres's `DISTINCT ON (cols) ... ORDER BY cols, tiebreaker` is the idiomatic greatest-N-per-group form for N=1 and is materially faster than the window-function alternative because the planner can stop at one row per partition. These 4 problems exercise tie semantics, deterministic ordering, and `DISTINCT ON` vs `ROW_NUMBER` under conditions where each is the right answer.

### 117. Top Three Wineries per Country

#### Problem

Given `wineries(id, country, points)`, return the top three wineries per country by `points`. Break ties with `id ASC`. Countries with fewer than three wineries return what they have, but pad missing ranks with `'No 2nd Winery'` / `'No 3rd Winery'` strings.

**Tables:** `wineries`

**Expected output (sample):**

| country | top_winery   | second_winery   | third_winery   |
|---------|--------------|-----------------|----------------|
| France  | Château X    | Domaine Y       | Vignoble Z     |
| Spain   | Bodega A     | Viña B          | No 3rd Winery  |

*Why interviewers ask this: it composes top-K-per-group + pivot + pad-with-literal-strings — three primitives in one query. The senior signal is the deterministic two-key ORDER BY for the row number.*

#### Pattern

`ROW_NUMBER() OVER (PARTITION BY country ORDER BY points DESC, id ASC)` with deterministic two-key ordering, then pivot via `MAX(name) FILTER (WHERE rn = N)` for N ∈ {1, 2, 3}, with `COALESCE` to literal padding strings for missing ranks.

#### Explanation

The headline composition is three primitives stacked: (1) `ROW_NUMBER` with composite `ORDER BY points DESC, id ASC` — deterministic tie-breaking is critical here because the spec is explicit ("Break ties with id ASC"); without the secondary key, ROW_NUMBER picks arbitrarily and the result is non-reproducible. (2) `FILTER`-conditional aggregates pivot the first three ranks into three columns. (3) `COALESCE` pads NULLs (from countries with <3 wineries) with literal label strings. The naive alternative for top-3 is `RANK()` — but `RANK()` produces ties (two wineries with equal points and id both get rank 1, third winery gets rank 3) — wrong here since the spec wants three distinct slots. `DENSE_RANK` similarly groups ties — wrong. `ROW_NUMBER` is correct: every winery gets a unique rank within its country. The pivot via `FILTER` is clean: `MAX(name) FILTER (WHERE rn = N)` returns the single winery name at rank N per country, NULL if no row with that rank. The `MAX` is required because GROUP BY aggregates a single column over potentially multiple rows; with `FILTER (WHERE rn = N)` reducing the rowset to one row per group, `MAX` is just a "pick the one value" trick. The naive alternative — `STRING_AGG` or `array_agg` of the top-3 — works but produces a single column, not three named columns. NULL handling: countries with fewer than 3 wineries produce NULL second_winery or third_winery; the `COALESCE` substitutes the literal labels. Edge case: tied wineries at exactly position 3 — the `id ASC` tiebreaker picks one deterministically. Production framing: this shape generalises to "top N per group with pad" — leaderboard rows, top-5 customers per region, etc. For top-1, `DISTINCT ON` is faster (problem #47).

#### Solution

```sql
-- Postgres 17/18.
WITH ranked AS (
  SELECT id, country, points,
         ROW_NUMBER() OVER (PARTITION BY country ORDER BY points DESC, id ASC) AS rn,
         (SELECT name FROM wineries w2 WHERE w2.id = wineries.id) AS name
  FROM wineries
)
SELECT country,
       MAX(name) FILTER (WHERE rn = 1) AS top_winery,
       COALESCE(MAX(name) FILTER (WHERE rn = 2), 'No 2nd Winery') AS second_winery,
       COALESCE(MAX(name) FILTER (WHERE rn = 3), 'No 3rd Winery') AS third_winery
FROM ranked
GROUP BY country
ORDER BY country;
```

*Source: LeetCode #2991 — Top Three Wineries*

---

### 118. Top-K with Deterministic Tie-Breaker

#### Problem

Given `employees(id, dept_id, salary, hire_date)`, return the top three highest-paid per department. Break salary ties by earlier `hire_date`; break hire_date ties by lower `id`. Return all winners (no row dropping).

**Tables:** `employees`

**Expected output (sample):**

| dept_id | rank | id | salary | hire_date  |
|---------|------|----|--------|------------|
| A       | 1    | 14 | 220000 | 2018-03-15 |
| A       | 2    | 22 | 195000 | 2020-09-01 |

*Why interviewers ask this: deterministic tie-breaking is the senior-vs-mid signal. Mid-level candidates use `RANK` and don't notice the tie-breaker behaviour; senior candidates pick `ROW_NUMBER` with full composite ordering and explain why.*

#### Pattern

`ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC, hire_date ASC, id ASC)` — three-key composite ordering provides total order; `WHERE rn <= 3` filters to top-3 per department; "no row dropping" requirement is the giveaway for `ROW_NUMBER` over `DENSE_RANK`.

#### Explanation

The headline mechanic is the three-key composite `ORDER BY` for total ordering. The choice between `ROW_NUMBER`, `RANK`, and `DENSE_RANK`: `ROW_NUMBER` assigns unique 1..N within each partition under the given order — every row gets a distinct rank, total ordering required. `RANK` assigns the same rank to tied rows and *skips* the next rank (1, 1, 3, 4...). `DENSE_RANK` assigns the same rank to tied rows without skipping (1, 1, 2, 3...). The spec here is "top three" with explicit tie-breaking — so `ROW_NUMBER` with full composite ordering is exactly right. `RANK` would give two winners at rank 1 and a third at rank 3 (consistent with "all tied for first count"), `DENSE_RANK` would give two winners at rank 1 and a third at rank 2 — both produce 2-or-more rows at rank 1 if ties exist, contradicting "no row dropping" interpreted as deterministic three slots. Forgetting the final `id` tie-breaker — writing `ORDER BY salary DESC, hire_date ASC` — leaves the tie-break for identical-salary-and-hire-date employees to the planner's choice (usually physical scan order), which means the same query returns different results across runs after a VACUUM FULL or table reorganisation. Deterministic full ordering is mandatory for ROW_NUMBER. The naive alternative — `LIMIT 3 PER GROUP` — doesn't exist in SQL (some dialects have `FETCH FIRST 3 ROWS WITH TIES`); the standard form is the windowed-and-filter pattern as shown. NULL handling: `salary DESC NULLS LAST` puts NULL salaries last (default DESC puts NULLs first — surprise! — be explicit). Edge case: a department with only 2 employees produces 2 rows (correctly), not 3 padded — spec doesn't require padding here. Tie semantics: with the three-key composite, ties only occur if two rows share salary, hire_date, AND id — impossible since id is PK. Production framing: this query underpins compensation-benchmarking dashboards; for at-scale runs, partial index `(dept_id, salary DESC)` is the optimisation.

#### Solution

```sql
-- Postgres 17/18.
SELECT dept_id, rn AS rank, id, salary, hire_date
FROM (
  SELECT dept_id, id, salary, hire_date,
         ROW_NUMBER() OVER (
           PARTITION BY dept_id
           ORDER BY salary DESC, hire_date ASC, id ASC
         ) AS rn
  FROM employees
) r
WHERE rn <= 3
ORDER BY dept_id, rn;
```

*Source: DataLemur — "Top earners per department" (Google tag) — adapted*

---

### 119. Greatest-N-Per-Group via DISTINCT ON

#### Problem

Given `events(user_id, ts, kind)`, return for each user their most recent event row (full row, not just the timestamp).

**Tables:** `events`

**Expected output (sample):**

| user_id | ts                  | kind  |
|---------|---------------------|-------|
| 1       | 2026-05-12 10:00:00 | view  |
| 2       | 2026-05-12 09:55:00 | click |

*Why interviewers ask this: `DISTINCT ON` is Postgres-specific. Senior candidates reach for it on top-1-per-group; mid-level candidates default to `ROW_NUMBER() = 1` (portable but slower).*

#### Pattern

`DISTINCT ON (user_id) ... ORDER BY user_id, ts DESC` — Postgres-idiomatic greatest-1-per-group; planner stops at first row per distinct-on value, materially faster than `ROW_NUMBER + WHERE rn = 1` for top-1 (window function evaluates the full ranking even for `WHERE rn = 1`).

#### Explanation

The headline mechanic is `DISTINCT ON (cols)` — keep the first row per distinct combination of `cols` under the given `ORDER BY`. Two rules: (1) `ORDER BY` must lead with the `DISTINCT ON` columns; (2) the remaining `ORDER BY` keys determine which row "wins" within each group. The naive alternative — `ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ts DESC) AS rn`, then `WHERE rn = 1` — is portable across dialects but the window function evaluates the full ranking before the filter, scanning every row in every partition. `DISTINCT ON` lets the planner do a sort + de-duplicate-on-leading-key + stop, which can be materially faster on wide partitions. The third alternative — `SELECT * FROM events WHERE (user_id, ts) IN (SELECT user_id, MAX(ts) FROM events GROUP BY user_id)` — works but doesn't handle ties on `ts` (you'd get multiple winner rows per user), and runs two passes. `DISTINCT ON` picks deterministically (with full ORDER BY) in one. The "top-1 vs top-K" boundary matters: `DISTINCT ON` is exclusively top-1 — for top-3, you need ROW_NUMBER. The implementation note: `DISTINCT ON` is sometimes called the "Postgres extension" because the SQL standard doesn't define it; SQL Server has `WITH TIES`, Oracle has `KEEP`/`ROW_NUMBER`. NULL handling: `DISTINCT ON` treats NULL as a distinct value (one group per NULL). Edge case: ties on `ts` — `DISTINCT ON` picks arbitrarily under just `ORDER BY user_id, ts DESC`; add `kind ASC` or `id ASC` for determinism. Production framing: this is the "latest activity per user" query that powers user-detail dashboards; for at-scale runs, a covering index `(user_id, ts DESC) INCLUDE (kind)` makes it index-only.

#### Solution

```sql
-- Postgres 17/18.
SELECT DISTINCT ON (user_id) user_id, ts, kind
FROM events
ORDER BY user_id, ts DESC;
```

*Source: Adapted from Celko / Postgres folklore — DISTINCT ON idiom*

---

### 120. Median Within Group via Window-Free Aggregate

#### Problem

Given `salaries(dept_id, salary)`, return per-department median salary in one pass.

**Tables:** `salaries`

**Expected output (sample):**

| dept_id | median_salary |
|---------|---------------|
| A       | 85000         |
| B       | 72000         |

*Why interviewers ask this: testing whether you know the aggregate form of `PERCENTILE_CONT`. Senior candidates write 2 lines; mid-level candidates write 20 lines of `ROW_NUMBER` + middle-row averaging.*

#### Pattern

`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) GROUP BY dept_id` — ordered-set aggregate form, one pass per group, interpolating for even-count partitions.

#### Explanation

The headline mechanic is the aggregate form of `PERCENTILE_CONT`. The function comes in two shapes: aggregate form (with `GROUP BY`) and ordered-set aggregate form (with `WITHIN GROUP`). For per-group medians, the natural form is `GROUP BY dept_id` + `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary)` — one row per department, one ordered-set aggregate over each group's salaries. The naive alternative is the textbook MySQL form using `ROW_NUMBER`: rank salaries within department, count, pick the middle row (or average two for even counts) — 20 lines vs 2. The `PERCENTILE_CONT` form handles even-count partitions automatically via interpolation: median of (10, 20) is 15. `PERCENTILE_DISC` would return 10 (the actual data point at the 50th percentile under one-indexed counting). For salary medians, `CONT` is the convention because salaries are treated as continuous; for "which actual employee is the median earner", use `DISC`. The window-form trap: `PERCENTILE_CONT(...) OVER (PARTITION BY dept_id)` does not exist in Postgres — ordered-set aggregates have no windowed form. For per-row median (excluding self), the `LATERAL` form from problem #4 is the workaround. NULL handling: NULL salaries are ignored by `PERCENTILE_CONT`. Empty partitions don't appear in GROUP BY output. Edge case: a department with one employee has median equal to that employee's salary — trivial. Tie semantics: ties on salary don't affect median (interpolation still works). Production framing: median is more robust than mean for compensation data (immune to outliers). At billions of rows, exact median via `PERCENTILE_CONT` is sort-bound; use approximate algorithms (`approx_percentile` from `tdigest` extension) for streaming/dashboard use.

#### Solution

```sql
-- Postgres 17/18.
SELECT dept_id,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median_salary
FROM salaries
GROUP BY dept_id
ORDER BY dept_id;
```

*Source: Folk interview question — FAANG data-eng screen*

---

## Postgres-Specific Power Features

This section is the "do you know what Postgres can actually do" probe. JSONB extraction (`->`, `->>`, `@?`, `JSON_TABLE`), array aggregation and containment operators, `MERGE` for idempotent upsert/delete, `generate_series` as a calendar spine, full-text search with `tsvector`/`ts_rank_cd` — these are the features that turn 100-line MySQL/Snowflake hand-rolls into 10-line Postgres-native queries. Interviewers at PG-heavy shops (Stripe, Plaid, Block, Citus customers) use these to separate "I learned SQL on MySQL/SQL Server" from "I've actually used the Postgres docs". These 6 problems exercise each native construct in its idiomatic form.

### 121. JSONB Path Extraction with Aggregation

#### Problem

Given `events(id, payload jsonb)` where each `payload` has shape `{"user": {"id": int, "tier": text}, "items": [{"sku": text, "qty": int}, ...]}`, return per-tier total quantity ordered across all events.

**Tables:** `events`

**Expected output (sample):**

| tier   | total_qty |
|--------|-----------|
| gold   | 2840      |
| silver | 9120      |

*Why interviewers ask this: JSONB is the canonical "do you know how Postgres handles semi-structured data" probe. Senior candidates know `->` vs `->>` semantics and reach for `jsonb_array_elements` immediately.*

#### Pattern

`jsonb_array_elements(payload->'items')` as a LATERAL set-returning function — expands the items array to one row per item per event; `->` for nested-jsonb path traversal, `->>` for terminal text extraction, cast to int for the qty sum.

#### Explanation

The headline mechanic is `jsonb_array_elements` as a set-returning function expanding arrays into rows. Combined with the implicit LATERAL semantics of comma-join (`FROM events, LATERAL jsonb_array_elements(...)`) it yields one row per (event, item) pair, ready to aggregate. The `->` vs `->>` distinction is the senior-vs-mid signal: `->` returns jsonb (suitable for further traversal: `payload->'user'->'id'`), `->>` returns text (terminal; the value as a string). Mixing them up — using `payload->>'user'->'id'` — fails at parse time because the text result can't be further traversed with `->`. Number extraction requires `->>` (returns text) then explicit cast: `(item->>'qty')::int`. The naive alternative without `jsonb_array_elements` would be to keep `payload->'items'` as a jsonb array and use `jsonb_array_length`+`jsonb_path_query` per index — works but verbose and slow. JSON_TABLE (problem #50) is the cleaner declarative form when the column set is fixed. Other path operators: `@?` checks jsonpath existence (`payload @? '$.user.tier ? (@ == "gold")'`); `@@` evaluates a jsonpath as boolean; `#>` and `#>>` take an array path (`payload #> '{user, tier}'`). Index strategy: `CREATE INDEX ON events USING GIN (payload)` supports `@>` containment queries; `CREATE INDEX ON events USING GIN ((payload->'user'->>'tier'))` supports exact-match on the tier path. For this query (no filter, just aggregation), no index helps. NULL handling: jsonb NULL (the JSON literal `null`) is distinct from SQL NULL — `->>` extracting a JSON null returns the SQL string `'null'`, not SQL NULL. Wrap with `NULLIF(..., 'null')::text` for safety. Edge case: events with empty `items` array contribute nothing (the LATERAL produces no rows). Events with no `items` key at all — `payload->'items'` returns SQL NULL, `jsonb_array_elements(NULL)` returns no rows — correctly omitted. Production framing: JSONB is the "denormalized event log" backbone of many ingestion pipelines; the aggregation queries here are the standard "explode the array and group" shape.

#### Solution

```sql
-- Postgres 17/18.
SELECT payload->'user'->>'tier' AS tier,
       SUM((item->>'qty')::int) AS total_qty
FROM events,
LATERAL jsonb_array_elements(payload->'items') AS item
GROUP BY payload->'user'->>'tier'
ORDER BY total_qty DESC;
```

*Source: DataLemur — "JSON payload analysis" (Stripe tag) — adapted*

---

### 122. JSON_TABLE for Tabular Projection of JSON

#### Problem

Given `responses(id, body jsonb)` where each `body` has `{"answers": [{"q": int, "a": text, "score": numeric}, ...]}`, project each answer into a row with id, question_id, score using `JSON_TABLE`.

**Tables:** `responses`

**Expected output (sample):**

| response_id | q | a       | score |
|-------------|---|---------|-------|
| 1           | 1 | yes     | 0.9   |
| 1           | 2 | no      | 0.4   |
| 2           | 1 | maybe   | 0.7   |

*Why interviewers ask this: `JSON_TABLE` is new in PG 17 — the SQL/JSON standard tabular projection. Senior candidates know it's the cleaner replacement for `jsonb_array_elements + manual ->>` chains when the projection is fixed.*

#### Pattern

`JSON_TABLE(r.body, '$.answers[*]' COLUMNS (q int PATH '$.q', a text PATH '$.a', score numeric PATH '$.score'))` — SQL/JSON declarative projection (PG 17+); the root jsonpath `$.answers[*]` iterates the array, each `COLUMNS` entry maps a sub-jsonpath to a typed column.

#### Explanation

The headline mechanic is `JSON_TABLE` — SQL/JSON's declarative tabular projection added in PG 17 (standard since SQL:2016). It takes a JSONB source, a root jsonpath that defines the row stream, and a COLUMNS clause that maps sub-jsonpaths to typed columns. The whole thing is one function call producing a relational shape. The naive alternative is `jsonb_array_elements(body->'answers') + manual ->> extraction + cast` (problem #49's pattern) — works fine when the column count is small, gets verbose at 5+ columns and easy to get wrong with type coercion. `JSON_TABLE` is the right form for fixed projections. The path `$.answers[*]` is jsonpath syntax: `$` is root, `.answers` traverses the key, `[*]` iterates the array. Each `COLUMNS` row specifies the SQL column name, type, and the relative path from the row context. Optional clauses: `ON ERROR` controls behavior when the path doesn't resolve (`NULL ON ERROR` is default; `ERROR ON ERROR` raises); `ON EMPTY` controls behavior when the path resolves to empty (similar). For deeply nested or alternate-form data, `NESTED PATH '$.subarray[*]' COLUMNS (...)` produces a "left outer" expansion — one row per parent for unmatched sub-elements. `JSON_TABLE` vs `jsonb_array_elements`: declarative vs functional, fixed projection vs flexible. NULL handling: missing jsonb fields produce SQL NULL in the projected column (under `NULL ON ERROR` default); set explicit `ERROR ON ERROR` for stricter validation. Edge case: responses with no `answers` key produce no rows in the output (LATERAL semantics drop the row from the join entirely); use `LEFT JOIN JSON_TABLE` if you want to preserve responses with empty answers. Production framing: `JSON_TABLE` replaces a class of brittle JSONB extraction code with one declarative call; for high-throughput pipelines reading semi-structured ingestion, it's the right tool.

#### Solution

```sql
-- Postgres 17/18.
SELECT r.id AS response_id, j.*
FROM responses r,
JSON_TABLE(
  r.body, '$.answers[*]'
  COLUMNS (
    q     int     PATH '$.q',
    a     text    PATH '$.a',
    score numeric PATH '$.score'
  )
) j
ORDER BY r.id, j.q;
```

*Source: LeetCode #2253 (adapted to JSON_TABLE form) / Original*

---

### 123. MERGE for Idempotent Upsert

#### Problem

You have a `target(account_id, balance, updated_at)` table and a `staging(account_id, new_balance, event_ts)` table of deltas. Write a single statement that: updates rows in target where staging's event_ts is newer; inserts rows in target that don't exist; deletes rows in target whose `account_id` appears with `new_balance IS NULL` in staging (a tombstone).

**Tables:** `target`, `staging`

**Expected output:** No result set; modifies N rows.

*Why interviewers ask this: `MERGE` is the SQL-standard upsert-and-delete. Senior candidates know that `INSERT ON CONFLICT` can't delete, and that `MERGE` is the idempotent primitive needed for at-least-once delivery pipelines.*

#### Pattern

`MERGE INTO target USING staging ON join_predicate` with three `WHEN` branches: `WHEN MATCHED AND ... THEN DELETE`, `WHEN MATCHED AND ... THEN UPDATE`, `WHEN NOT MATCHED AND ... THEN INSERT` — single atomic statement, three operations, ordering of `WHEN` clauses determines precedence.

#### Explanation

The headline mechanic is `MERGE` (PG 15+) — the SQL-standard data-modifying statement that combines INSERT, UPDATE, and DELETE in one statement with predicate-based branch selection. Each row in `staging` is joined to `target` via the `ON` predicate; the matched/unmatched outcome plus the `WHEN ... AND` extra predicate selects which branch fires. Critically, branches are evaluated in order — the first matching branch wins. The naive alternative — `INSERT INTO target ... ON CONFLICT (account_id) DO UPDATE SET ...` — works for upsert (the common case) but: (1) can't DELETE in the same statement; (2) always fires the UPDATE even when values are unchanged (polluting WAL); (3) re-running it isn't idempotent in the strict sense — it writes the same values again. The dual alternative `DELETE FROM target WHERE ...; INSERT INTO target ...` is two statements (non-atomic without explicit transaction, and the reader between sees inconsistent state). `MERGE` is one atomic statement with no double-fire. The branch order in this query is meaningful: `WHEN MATCHED AND s.new_balance IS NULL THEN DELETE` fires first — a tombstone in staging deletes the target row regardless of event_ts. Then `WHEN MATCHED AND s.event_ts > t.updated_at THEN UPDATE` — only update if staging is newer. Finally `WHEN NOT MATCHED AND s.new_balance IS NOT NULL THEN INSERT` — only insert if the staging row is a real value (not a tombstone for a non-existent target). The implicit fourth branch (matched but no condition fires) is a no-op — exactly the idempotency we want. PG 17 added `RETURNING` support and `WHEN NOT MATCHED BY SOURCE` (for "target rows with no staging match — delete or mark"). NULL handling: the `IS NULL` and `IS NOT NULL` predicates are correct (vs `= NULL` which is always UNKNOWN). Edge case: multiple staging rows mapping to the same target row — `MERGE` raises an error ("cannot affect row a second time"); pre-aggregate staging if this can happen. Tie semantics: not applicable in single-row matching. Production framing: this is the idempotent-upsert primitive that bridges at-least-once delivery (Kafka, S3 lifecycle, retry queues) to exactly-once data semantics; problem #65 builds on this for daily-revenue refresh.

#### Solution

```sql
-- Postgres 17/18.
MERGE INTO target t
USING staging s
  ON t.account_id = s.account_id
WHEN MATCHED AND s.new_balance IS NULL THEN
  DELETE
WHEN MATCHED AND s.event_ts > t.updated_at THEN
  UPDATE SET balance = s.new_balance, updated_at = s.event_ts
WHEN NOT MATCHED AND s.new_balance IS NOT NULL THEN
  INSERT (account_id, balance, updated_at)
  VALUES (s.account_id, s.new_balance, s.event_ts);
```

*Source: Folk interview question — Stripe / Plaid ledger upsert screen*

---

### 124. Array Aggregation and Set Membership

#### Problem

Given `user_roles(user_id, role)`, return one row per user with their roles as a sorted text array, and a boolean indicating whether they hold both `'admin'` and `'auditor'` roles.

**Tables:** `user_roles`

**Expected output (sample):**

| user_id | roles                  | is_admin_auditor |
|---------|------------------------|------------------|
| 1       | {admin,auditor,reader} | true             |
| 2       | {reader}               | false            |

*Why interviewers ask this: array aggregation + containment is Postgres-specific. Senior candidates use `@>` for "set contains all of these elements"; mid-level candidates chain `bool_or` aggregates.*

#### Pattern

`ARRAY_AGG(DISTINCT role ORDER BY role)` produces a sorted-deduped array per user; `@>` (contains) operator tests whether the array contains every element of a literal `ARRAY['admin', 'auditor']` — cleaner than `BOOL_OR(role='admin') AND BOOL_OR(role='auditor')`.

#### Explanation

The headline composition is `ARRAY_AGG` + `@>`. `ARRAY_AGG(role ORDER BY role)` produces an array with the rows ordered (postgres aggregates can take their own ORDER BY clause); `DISTINCT` ensures duplicates aren't aggregated twice. The naive alternative for the "has both" check is two `BOOL_OR` calls: `BOOL_OR(role = 'admin') AND BOOL_OR(role = 'auditor') AS is_admin_auditor` — works, fine for two values, gets ugly for many. The `@>` operator (array contains all elements) generalises: `ARRAY_AGG(role) @> ARRAY['admin', 'auditor', 'reviewer']` tests for three. Companion array operators: `&&` (overlap — has at least one common element), `<@` (contained by), `||` (concatenate), `array_length(arr, 1)` (length of first dimension). The `DISTINCT` inside `ARRAY_AGG` matters for the containment check: if user 1 had two 'admin' role rows and no 'auditor', `ARRAY_AGG(role)` without `DISTINCT` is `{admin, admin}`, and `@> ARRAY['admin', 'auditor']` returns false — correct. With `DISTINCT` and a user with both roles, the result is `{admin, auditor}` which `@>` correctly affirms. Equivalently `ARRAY_AGG(role) @> ARRAY['admin', 'auditor']` works without DISTINCT because `@>` is multiset-permissive — checking element presence ignores multiplicity. The query as shown uses DISTINCT for both the roles output column (sorted-deduped is the user-friendly form) and the containment check (idiomatic). NULL handling: `ARRAY_AGG` includes NULLs by default; filter via `ARRAY_AGG(role) FILTER (WHERE role IS NOT NULL)` or `ARRAY_AGG(role ORDER BY role)` (NULLs sort last, present in output) — depends on whether NULL-role rows should appear. Edge case: a user with no role rows is absent from `user_roles` and thus absent from the GROUP BY output — to surface them with empty arrays, `LEFT JOIN` from `users` to `user_roles`. Production framing: array-aggregated columns make great denormalized payloads for cache layers and API responses; the containment query supports role-based access checks.

#### Solution

```sql
-- Postgres 17/18.
SELECT user_id,
       ARRAY_AGG(DISTINCT role ORDER BY role) AS roles,
       ARRAY_AGG(DISTINCT role) @> ARRAY['admin', 'auditor'] AS is_admin_auditor
FROM user_roles
GROUP BY user_id
ORDER BY user_id;
```

*Source: DataLemur — "User permissions" (Google tag) — adapted*

---

### 125. Generate Series for Calendar Spine

#### Problem

Given `sales(dt, amount)` with gaps (some days have no sales), produce a continuous daily series from `'2026-04-01'` to `'2026-04-30'` showing the day's total (0 for empty days) and the 7-day rolling sum.

**Tables:** `sales`

**Expected output (sample):**

| dt         | day_total | rolling_7 |
|------------|-----------|-----------|
| 2026-04-01 | 0         | 0         |
| 2026-04-02 | 1200      | 1200      |
| 2026-04-08 | 900       | 5340      |

*Why interviewers ask this: `generate_series` is Postgres's canonical calendar-spine generator. Senior candidates use it to drive the join (preserving zero-rows days); mid-level candidates join from the sales table and lose empty days.*

#### Pattern

`generate_series(start_date, end_date, INTERVAL '1 day')` creates the date spine; `LEFT JOIN` an aggregated-per-day CTE onto the spine; `COALESCE(..., 0)` for empty days; `SUM(...) OVER (ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` for the rolling-7 sum.

#### Explanation

The headline mechanic is `generate_series` as the join-driver. The spine — every day in the interval — is generated first as a CTE; sales are aggregated per day separately; the spine `LEFT JOIN`s the aggregate. The join direction matters critically: joining from `sales` to the spine drops days with no sales; the spine must be the outer side. `generate_series` accepts integer, numeric, timestamp, and date arguments; the interval form (`generate_series(start_dt, end_dt, INTERVAL '1 day')`) is the calendar-spine form. The rolling-7 sum uses `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` — since the spine has no gaps, `ROWS` and `RANGE BETWEEN INTERVAL '6 days' PRECEDING` are equivalent here; `ROWS` is more explicit. The naive alternative is a recursive CTE counting up dates — works but verbose; `generate_series` is one function call. Without the spine, the rolling sum on the raw sales data would be wrong because gaps would skip days. The naive zero-fill alternative is `COALESCE` in the SELECT alone — but if the empty day is missing from the sales table, there's no row to COALESCE; the spine guarantees a row exists for every day. NULL handling: `LEFT JOIN` produces NULL for empty days; `COALESCE(..., 0)` substitutes; the windowed `SUM(COALESCE(...))` correctly treats empty days as zeros. Edge case: the rolling-7 sum at the start of the spine has fewer than 7 rows in its frame — Postgres correctly sums what's available (4 days at day 4, etc.); the frame's lower bound is "UNBOUNDED" capped by the partition boundary. Production framing: this pattern is the "always-visible time-series dashboard" form; the zero-fill is essential for chart libraries that interpolate over missing dates. At billions of rows, partition `sales` on `dt` (monthly) and use BRIN indexes; the generate_series spine is cheap.

#### Solution

```sql
-- Postgres 17/18.
WITH spine AS (
  SELECT generate_series(DATE '2026-04-01', DATE '2026-04-30', INTERVAL '1 day')::date AS dt
),
agg AS (
  SELECT dt, SUM(amount) AS day_total
  FROM sales
  GROUP BY dt
)
SELECT sp.dt,
       COALESCE(a.day_total, 0) AS day_total,
       SUM(COALESCE(a.day_total, 0)) OVER (
         ORDER BY sp.dt
         ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
       ) AS rolling_7
FROM spine sp
LEFT JOIN agg a USING (dt)
ORDER BY sp.dt;
```

*Source: Original — Advanced SQL Practice (canonical PG calendar-spine)*

---

### 126. Full-Text Search With Ranking

#### Problem

Given `documents(id, body text)` indexed with a `tsvector` column, return the top 10 documents matching `'machine & learning & !buzzword'` with their relevance score.

**Tables:** `documents`

**Expected output (sample):**

| id   | rank  |
|------|-------|
| 142  | 0.83  |
| 7    | 0.61  |

*Why interviewers ask this: Postgres FTS is the "before you reach for Elasticsearch" answer for many shops. Senior candidates know `tsvector`/`tsquery`, the `@@` operator, and `ts_rank_cd` vs `ts_rank` distinction.*

#### Pattern

Postgres FTS pipeline: `to_tsvector('english', body)` lexes and stems the document text into a `tsvector`; `to_tsquery('english', '...')` parses the query string with `&`/`|`/`!`/`<->` operators into a `tsquery`; `@@` operator tests match; `ts_rank_cd(vector, query)` returns a relevance score using cover-density ranking; GIN index on the tsvector for fast filtering.

#### Explanation

The headline mechanic is the Postgres FTS pipeline: text → tsvector → match → rank. `to_tsvector('english', body)` normalises words (lowercase, stem, drop stop-words) producing a sorted list of lexemes with positions. `to_tsquery('english', 'machine & learning & !buzzword')` parses the query — `&` AND, `|` OR, `!` NOT, `<->` phrase-adjacency, `:*` prefix. The `@@` operator tests whether the tsvector satisfies the tsquery. For ranking, `ts_rank_cd` uses cover-density (cares about how close matched terms are in the document) while `ts_rank` is frequency-based (just counts matches). For multi-word queries where word proximity matters, `ts_rank_cd` is the right choice. The naive alternative is `LIKE '%machine%' AND LIKE '%learning%' AND NOT LIKE '%buzzword%'` — works but: (1) no stemming (misses "machines" and "learns"); (2) no relevance ranking; (3) `LIKE` can't use a B-tree index for substring matching, scans every row. FTS with GIN is O(log N) per query. Index strategy: `CREATE INDEX ON documents USING GIN (to_tsvector('english', body))` builds an inverted index on lexemes — the GIN supports the `@@` operator natively. For multiple language searches, store the tsvector in its own column with a trigger to maintain it (`UPDATE TRIGGER`). The boolean tsquery operators map to standard query language: `<->` (followed by) is the bigram operator, `<N>` is "N words apart". Real-world phrase queries combine: `'"machine learning"' & 'buzzword:*'`. The LATERAL form in the solution materialises the tsquery once per query rather than per row — minor optimization. NULL handling: NULL bodies produce NULL tsvectors which `@@` evaluates to NULL (treated as false); no special handling needed. Edge case: a document with no matching lexemes returns `ts_rank_cd = 0` and is filtered by the `@@` predicate before the ranking step. Production framing: Postgres FTS is great for medium-scale text search (millions of docs, sub-second queries). At hundreds of millions of docs or hundreds of QPS, the team usually migrates to Elasticsearch/OpenSearch for sharding and richer query DSL; before then, FTS is the right tool.

#### Solution

```sql
-- Postgres 17/18.
SELECT id,
       ts_rank_cd(to_tsvector('english', body), q) AS rank
FROM documents,
LATERAL to_tsquery('english', 'machine & learning & !buzzword') AS q
WHERE to_tsvector('english', body) @@ q
ORDER BY rank DESC
LIMIT 10;
```

*Source: Folk interview question — FAANG search-team screen*

---

## Query Plan Reasoning & Index Strategy

This section is the "can you read `EXPLAIN ANALYZE`" probe — the bar that separates a working SQL writer from someone you'd trust with a production query path. The questions are structural: rewriting `IN (subquery)` to favour hash-semi-join, composite index column ordering for range+equality lookups, partial indexes for skewed predicates, CTE materialization fences (the PG 12+ inlining default and when it bites), and `INCLUDE` for covering index-only scans. Every problem here presents a bad plan paraphrased in cost-line form and asks for the rewrite or index DDL that makes it good. These 5 problems are the ones interviewers use to filter mid-level from senior.

### 127. Convert IN-Subquery to Semi-Join Plan

#### Problem

The query below filters orders against a customer list. `EXPLAIN` shows a nested-loop with a sequential scan inside. Rewrite for an index-driven plan; reason about what plan you expect.

```sql
SELECT id, customer_id
FROM orders
WHERE customer_id IN (SELECT id FROM customers WHERE tier = 'gold');
```

**Tables:** `orders`, `customers` (with `(tier)` index and `orders.customer_id` index)

**Expected output:** No result set; this is a plan-reasoning problem (semantically the query is unchanged).

*Why interviewers ask this: the senior signal is reading the cost lines, identifying the killer node, and proposing a structural rewrite — not just adding indexes.*

#### Pattern

`NOT EXISTS` (or explicit `EXISTS`) rewrite of `IN (subquery)` to coerce hash-semi-join: planner builds a small hash on the gold-customer set, scans orders once, probes per row. Stable plan regardless of statistics drift.

#### Explanation

The headline plan-reasoning concern: modern Postgres planners often flatten `IN (subquery)` to a `Hash Semi Join` automatically, but only when `pg_statistic` says the inner set is small enough relative to the outer. On a stats-stale table (after a bulk insert without an `ANALYZE`), the planner falls back to nested-loop with the inner sub-select re-executed per outer row — catastrophic for million-row outer tables. The senior fix is structurally coercing the semi-join: rewrite as `EXISTS` (correlated) so the planner can't pick a nested-loop-with-subquery shape — only a hash or nested-loop *semi-join*. Both are O(N) in orders; the hash variant is preferred for small `customers` sets.

**Bad plan (the trap):**

```
Nested Loop  (cost=0.43..184505.62 rows=1200 width=12) (actual time=0.32..847.21)
  ->  Index Scan on customers_tier_idx  (cost=0.42..15.50 rows=420 width=4) (actual rows=420)
        Index Cond: (tier = 'gold')
  ->  Index Scan using orders_customer_id_idx on orders  (cost=0.43..439.10 rows=3 width=12)
        Index Cond: (customer_id = customers.id)
  Planning Time: 0.14 ms
  Execution Time: 847.83 ms
```

Killer node: 420 inner iterations × index scan on orders per customer. Fine at 420 customers; quadratic dread at 4M.

**Good plan (after rewrite):**

```
Hash Semi Join  (cost=15.50..6843.00 rows=1200 width=12) (actual time=2.4..89.1)
  Hash Cond: (orders.customer_id = customers.id)
  ->  Seq Scan on orders  (cost=0..4310 rows=300000 width=12)
  ->  Hash  (cost=15.42..15.42 rows=420 width=4)
        ->  Index Scan on customers_tier_idx  (cost=0.42..15.42 rows=420)
              Index Cond: (tier = 'gold')
  Execution Time: 91.5 ms
```

Killer node eliminated: orders scanned once, hash built once on gold customers (420 entries — fits in `work_mem`). 10× faster.

The trade: if `customers` after the tier filter is large (millions), the hash blows past `work_mem` and spills to disk — the plan stays correct but slows. At that point you'd partition customers by tier or move the join to a materialized view. NULL handling: `EXISTS` (and `IN`) treat NULL `customer_id` correctly — no rows match. Edge case: customers with no orders — irrelevant, the query is "orders by gold customers", customers without orders never contribute. Tie semantics not applicable. Production framing: `EXPLAIN ANALYZE` is the senior tool; comparing plan trees before and after rewrites is how database performance work actually happens.

#### Solution

```sql
-- Postgres 17/18.
-- Rewritten for predictable hash semi-join plan:
SELECT o.id, o.customer_id
FROM orders o
WHERE EXISTS (
  SELECT 1 FROM customers c
  WHERE c.id = o.customer_id AND c.tier = 'gold'
);
-- Equivalent and often faster on large orders, smaller customers.
```

*Source: Original — Advanced SQL Practice (plan reasoning)*

---

### 128. Index for Range + Equality Lookup

#### Problem

The query `SELECT * FROM events WHERE user_id = $1 AND ts >= $2 AND ts < $3 ORDER BY ts DESC LIMIT 100;` is slow. Recommend an index and explain why the order matters.

**Tables:** `events(id, user_id, ts, payload)`

**Expected output:** No result set; index-strategy reasoning.

*Why interviewers ask this: composite-index column ordering is the bread-and-butter of database performance. The senior signal is naming the "equality first, range last" rule and explaining why sort direction matters for the LIMIT.*

#### Pattern

Composite B-tree index `(user_id, ts DESC)` — equality column first for index probe, range column with explicit DESC for `ORDER BY ts DESC LIMIT 100` satisfied by forward index scan (no sort node). Forward scan is faster than backward because of B-tree leaf-link traversal direction.

#### Explanation

The headline rule: for composite B-tree indexes with mixed equality and range predicates, put equality columns first, range columns last. Reason: the B-tree storage layout is lexicographic — `(user_id, ts)` orders rows by `user_id` first, then `ts` within each user. An equality predicate on `user_id` narrows to one contiguous slice of the index; the range predicate on `ts` then traverses within that slice. If the column order were reversed `(ts, user_id)`, the planner would have to scan every `ts` range and filter by `user_id` per row — O(range_size) instead of O(matching_rows). The sort direction matters for the LIMIT: with `ts DESC` in the index, `ORDER BY ts DESC LIMIT 100` is satisfied by a forward scan of the index starting at the highest `ts` value — no Sort node, query stops at 100 rows. Without `DESC` (index is `ts ASC`), Postgres uses a backward scan — still works, slightly more overhead from leaf-link traversal in the non-default direction, and historically forward was meaningfully faster (modern PG has narrowed the gap).

**Bad plan (no index, or wrong column order):**

```
Limit  (cost=24830..24830 rows=100 width=124)
  ->  Sort  (cost=24830..25080 rows=10000 width=124) (actual time=312..313)
        Sort Key: ts DESC
        Sort Method: top-N heapsort (Memory: 28kB)
        ->  Seq Scan on events  (cost=0..18430 rows=10000 width=124) (actual rows=10000)
              Filter: ((user_id = 17) AND (ts >= '2026-04-01') AND (ts < '2026-05-01'))
              Rows Removed by Filter: 9990000  -- 10M rows scanned, 10K kept
  Execution Time: 318.4 ms
```

Killer: Seq Scan over 10M rows to find 10K matches, then sort.

**Good plan (composite index):**

```
Limit  (cost=0.43..21.50 rows=100 width=124) (actual time=0.04..0.81)
  ->  Index Scan using events_user_ts_idx on events  (cost=0.43..2110 rows=10000 width=124)
        Index Cond: ((user_id = 17) AND (ts >= '2026-04-01') AND (ts < '2026-05-01'))
  Execution Time: 0.87 ms
```

Killer eliminated: index probe to (user_id=17), range scan within DESC-ordered ts, stops at 100 rows. 365× faster.

The third alternative — BRIN on `ts` alone — works if `events` is roughly time-ordered on disk (append-only insert pattern); BRIN is tiny (1 KB per million rows vs B-tree's ~30 MB per million) but only filters block ranges, not individual rows. For high-cardinality `user_id` with append-only `ts`, the composite B-tree is the right primary; BRIN can supplement for archival range scans. NULL handling: NULL `user_id` would sort first or last per `NULLS FIRST/LAST`; the equality predicate skips NULLs naturally. Edge case: a user with no events in the range returns zero rows in 0.05ms — index probes to nothing, exits. Production framing: this is the "user activity history" query that every product surface needs; making it index-only requires `INCLUDE (payload_size)` (problem #59) or covering all returned columns.

#### Solution

```sql
-- Postgres 17/18.
CREATE INDEX events_user_ts_idx
  ON events (user_id, ts DESC);

-- For very high cardinality user_id and large per-user history,
-- also consider BRIN on ts alone if the table is time-ordered on disk:
-- CREATE INDEX events_ts_brin ON events USING BRIN (ts);
```

*Source: Original — Advanced SQL Practice (plan reasoning)*

---

### 129. Partial Index for Skewed Predicate

#### Problem

Most rows in `orders(status, customer_id, ts)` have `status = 'completed'`, but the recurring query filters on `status = 'refunded'`. The full `(status, customer_id)` index is huge. Propose an index strategy.

**Tables:** `orders`

**Expected output:** No result set; index-strategy reasoning.

*Why interviewers ask this: partial indexes are the Postgres-specific tool for skewed predicate distributions. Senior candidates recognise "most rows have one value of X" as the signal for partial-index design.*

#### Pattern

Partial index `CREATE INDEX ON orders (customer_id, ts DESC) WHERE status = 'refunded'` — indexes only the 1% of rows matching the WHERE clause, so index size shrinks ~100× vs the full composite. Don't put `status` in the index columns — the partial-where already encodes it.

#### Explanation

The headline mechanic is partial indexes — `CREATE INDEX ... WHERE predicate` indexes only rows matching the predicate. For a query `WHERE status = 'refunded' AND customer_id = $1 ORDER BY ts DESC` where refunded is 1% of all rows, the partial index is 100× smaller than the full `(status, customer_id, ts)` composite. Size matters for two reasons: (1) less memory pressure (the index fits in `shared_buffers` more easily); (2) faster index maintenance on writes (only refunded rows trigger an index update). The planner can use a partial index only when the query's WHERE clause logically implies the index's WHERE clause — `WHERE status = 'refunded' AND customer_id = X` does imply `WHERE status = 'refunded'`, so the planner uses it. The naive alternative is the full composite `(status, customer_id, ts)` — works but the rare-status rows are buried in a B-tree dominated by completed rows, and every refunded query traverses the same nodes. Don't put `status` in the partial index columns — it's redundant (the partial-where filters it) and inflates the key size; instead, index on the columns the query actually filters and orders by (`customer_id, ts DESC`).

**Bad plan (no partial, full composite (status, customer_id, ts) used):**

```
Index Scan using orders_status_customer_ts_idx  (cost=0.56..820.10 rows=12)
  Index Cond: ((status = 'refunded') AND (customer_id = 17))
  Buffers: shared hit=240    -- 240 pages fetched (index is huge)
  Execution Time: 18.4 ms
```

**Good plan (partial index):**

```
Index Scan using orders_refunded_customer_ts_idx  (cost=0.42..21.50 rows=12)
  Index Cond: (customer_id = 17)
  Buffers: shared hit=4      -- 4 pages (index is small)
  Execution Time: 0.32 ms
```

50× fewer page fetches.

NULL handling: if `status` can be NULL, the partial `WHERE status = 'refunded'` excludes them (NULL = 'refunded' is UNKNOWN); be deliberate. Edge case: the query must include `WHERE status = 'refunded'` literally — `WHERE status IN ('refunded', 'cancelled')` won't use the partial index because the planner can't prove implication. The constant must appear as written. Tie semantics not applicable. Production framing: partial indexes are massively underused — every column with a long-tail value distribution is a candidate. Examples: `WHERE is_active = true` (most users are active), `WHERE soft_deleted = false` (most rows aren't deleted), `WHERE region = 'US'` (if regional split is skewed).

#### Solution

```sql
-- Postgres 17/18.
CREATE INDEX orders_refunded_customer_ts_idx
  ON orders (customer_id, ts DESC)
  WHERE status = 'refunded';

-- Query that uses it:
-- SELECT * FROM orders
-- WHERE status = 'refunded' AND customer_id = $1
-- ORDER BY ts DESC LIMIT 10;
```

*Source: Original — Advanced SQL Practice (plan reasoning)*

---

### 130. CTE Materialization Boundary

#### Problem

This query is slower than the equivalent inline subquery. Explain why and rewrite.

```sql
WITH recent AS (
  SELECT * FROM events WHERE ts > now() - INTERVAL '1 day'
)
SELECT r.user_id, COUNT(*) FROM recent r
WHERE r.kind = 'click' GROUP BY r.user_id;
```

**Tables:** `events`

**Expected output:** No result set; plan reasoning.

*Why interviewers ask this: CTE materialization is a Postgres-version gotcha. Senior candidates know the PG 12+ inlining default and when it bites; they reach for `NOT MATERIALIZED` explicitly or rewrite as a subquery.*

#### Pattern

CTE inlining boundary: PG ≤ 11 always materialized non-recursive CTEs (predicate pushdown blocked); PG 12+ inlines by default unless the CTE is referenced multiple times or marked `MATERIALIZED`. Fix: rewrite as an inline subquery or annotate `NOT MATERIALIZED`.

#### Explanation

The headline behaviour: prior to PG 12, every non-recursive CTE was a materialization fence — the inner query ran to completion, results were stored in a tuplestore, and outer-query predicates couldn't be pushed inside. PG 12 changed the default: non-recursive CTEs referenced exactly once are inlined; CTEs referenced multiple times or explicitly marked `MATERIALIZED` are still materialized. The query as written should inline on PG 12+ — but interview-grade plan reasoning means knowing what *can* go wrong. If the CTE were referenced twice, or run on PG 11 (legacy support), the materialization-fence plan would emerge: the `kind = 'click'` predicate stays in the outer query, the inner CTE pulls every event in the last day regardless of kind, materialized into a tuplestore, then filtered. That's wasted I/O if `kind = 'click'` is a small fraction. The fix is structural: either inline the predicates directly (no CTE) or use `WITH recent AS NOT MATERIALIZED (...)` to force inlining regardless of reference count.

**Bad plan (materialized CTE):**

```
HashAggregate  (cost=24300..24400 rows=8000)
  Group Key: r.user_id
  ->  Subquery Scan on r
        Filter: (kind = 'click')
        Rows Removed by Filter: 380000   -- whole CTE pulled, filtered after
        ->  CTE Scan on recent
              ->  Index Scan on events_ts_idx
                    Index Cond: (ts > now() - '1 day'::interval)
                    Rows: 400000
  Execution Time: 412 ms
```

Killer: 400K rows materialized, then 380K rows discarded.

**Good plan (inline form or NOT MATERIALIZED):**

```
HashAggregate  (cost=4250..4350 rows=8000)
  Group Key: events.user_id
  ->  Index Scan on events_ts_kind_idx
        Index Cond: (ts > now() - '1 day' AND kind = 'click')
        Rows: 20000
  Execution Time: 28 ms
```

Predicate pushdown into the index scan, 15× faster.

NULL handling: `kind` IS NULL would be excluded by the `= 'click'` predicate (NULL comparison is UNKNOWN). Edge case: a CTE that's recursive (`WITH RECURSIVE`) is always materialized — that's by definition; `NOT MATERIALIZED` can't be used. Tie semantics not applicable. Production framing: this is the "CTE is great for readability but check the plan" lesson. The legacy Postgres-CTE-as-optimization-fence trick (intentionally materializing to *prevent* a bad pushdown) still works with explicit `MATERIALIZED`; modern code should be deliberate about which behaviour you want.

#### Solution

```sql
-- Postgres 17/18.
-- Option A: inline form (planner pushes everything down).
SELECT user_id, COUNT(*)
FROM events
WHERE ts > now() - INTERVAL '1 day'
  AND kind = 'click'
GROUP BY user_id;

-- Option B: hint with NOT MATERIALIZED if you want CTE syntax for readability.
WITH recent AS NOT MATERIALIZED (
  SELECT * FROM events WHERE ts > now() - INTERVAL '1 day'
)
SELECT user_id, COUNT(*)
FROM recent
WHERE kind = 'click'
GROUP BY user_id;
```

*Source: Original — Advanced SQL Practice (plan reasoning)*

---

### 131. Covering Index With INCLUDE

#### Problem

The query `SELECT user_id, ts, payload_size FROM events WHERE user_id = $1 ORDER BY ts DESC LIMIT 50;` does an Index Scan + Heap Fetch. Make it index-only.

**Tables:** `events`

**Expected output:** No result set; index-strategy reasoning.

*Why interviewers ask this: the `INCLUDE` clause is the elegant fix for covering-index needs. Senior candidates know it lets you add columns to the leaf without bloating the key.*

#### Pattern

Covering index via `INCLUDE`: `CREATE INDEX ON events (user_id, ts DESC) INCLUDE (payload_size)` — extra columns stored in leaf pages but not part of the sort key. Plus `VACUUM` to keep the visibility map current so the planner trusts an Index Only Scan.

#### Explanation

The headline mechanic is `INCLUDE` columns — a B-tree extension introduced in PG 11 that stores extra columns in leaf pages without including them in the sort key. The naive alternative is putting `payload_size` in the index columns proper: `CREATE INDEX ON events (user_id, ts DESC, payload_size)` — gets index-only-scan but increases the B-tree key size, reducing fanout (more levels, more I/O per descent) and slowing inserts (every column change requires an index update; if `payload_size` is more volatile than necessary, you pay extra). `INCLUDE` puts the column in the leaf without making it part of the key — same index-only benefit, smaller fanout, faster inserts. The visibility map matters critically: an Index Only Scan checks the heap's visibility map to verify each tuple is visible to the current transaction. If the visibility map is stale (recently inserted rows haven't been visited by `VACUUM`), the planner falls back to fetching the heap row — defeating the index-only scan. Run `VACUUM` regularly (Postgres autovacuum normally handles this, but bulk-loaded tables may need a manual `VACUUM`).

**Bad plan (no INCLUDE, plain index scan + heap fetches):**

```
Limit  (cost=0.43..43.10 rows=50 width=18) (actual time=0.04..2.31)
  ->  Index Scan using events_user_ts_idx on events  (cost=0.43..210 rows=500)
        Index Cond: (user_id = 17)
        Rows Removed by Filter: 0
        Heap Fetches: 50    -- 50 separate heap page reads
  Execution Time: 2.4 ms
```

**Good plan (INCLUDE + recent VACUUM):**

```
Limit  (cost=0.43..3.15 rows=50 width=18) (actual time=0.04..0.18)
  ->  Index Only Scan using events_user_ts_payloadsize_idx on events
        Index Cond: (user_id = 17)
        Heap Fetches: 0     -- no heap pages read
  Execution Time: 0.21 ms
```

10× faster, heap untouched.

NULL handling: `INCLUDE` columns can contain NULLs without affecting the index. Edge case: a recent INSERT followed immediately by the query — visibility map is stale, plan falls back to heap fetches; subsequent autovacuum fixes it. Tie semantics not applicable. Production framing: index-only scans are the holy grail for read-heavy paths. Use `INCLUDE` for the columns you select but don't filter on; the `(user_id, ts)` key handles filter+sort, `INCLUDE (payload_size)` covers the SELECT. For wider projection lists, the index gets large — at some point, just project the columns you need and let the heap fetch handle the rest.

#### Solution

```sql
-- Postgres 17/18.
CREATE INDEX events_user_ts_payloadsize_idx
  ON events (user_id, ts DESC)
  INCLUDE (payload_size);

-- After VACUUM, expect:
-- Limit
--   -> Index Only Scan using events_user_ts_payloadsize_idx
--        Heap Fetches: 0
```

*Source: Original — Advanced SQL Practice (plan reasoning)*

---

## FAANG / Fintech Interview Capstones

These are the "tell me how you'd build X" questions that bridge SQL skill to system design. Each one composes multiple advanced patterns — recursive CTE + graph algorithm + production-shape concerns; multi-table joins on benchmark-scale data; idempotent refresh strategy under concurrent reads; arbitrage cycle detection. The interview is not "write the perfect query" — it's "show me you can compose primitives, name the production trade-offs, and tell me where this lives in a real architecture (materialized view? Kafka stream? Citus partition?)". These 6 problems are the closing rounds.

### 132. Real-Time Fraud Ring Detection (Connected Components)

#### Problem

Given `transactions(txn_id, from_account, to_account, ts)`, find connected components of accounts that have transacted with each other in the past 24 hours (treat the graph as undirected for ring detection). Return each account with its component id (smallest account id in the component).

**Tables:** `transactions`

**Expected output (sample):**

| account_id | component_id |
|------------|--------------|
| 14         | 14           |
| 27         | 14           |
| 41         | 14           |
| 88         | 88           |

#### Pattern

Recursive CTE BFS labelling each node with min-reachable id.

#### Explanation

Union-Find done in SQL — the algorithm being mimicked is connected-components via label propagation: each node starts labelled as itself, the recursive step propagates `MIN(label)` along edges until labels stabilise. The build undirected edges step is a `UNION` of `(from, to)` and `(to, from)`; without that, you'd only find one-directional reachability. The termination condition is the implicit "no new (node, label) pair beats the prior minimum" — encoded here as `WHERE LEAST(w.label, e.b) < w.label`. The duplicate-row pruning matters: `UNION` (without `ALL`) dedupes per iteration, so a node converges to its component's MIN-id and stops emitting. The naive alternative — a single `WITH RECURSIVE bfs AS (...) UNION ALL` without the LEAST-propagation — produces every (start, reachable) pair, which is `O(V²)` worst-case and explodes on dense graphs. NULL handling: rows where `from_account = to_account` (self-transactions) are filtered implicitly by the `LEAST` comparison; if you needed to surface isolated accounts (never transacted), you'd `LEFT JOIN` from a master accounts list and `COALESCE` the component id to the account id itself.

**Production framing:** in real fintech systems this query lives in two forms — a streaming incremental graph maintained in Kafka Streams or Flink for sub-second ring detection, and a daily batch in Postgres / BigQuery / Snowflake for retrospective audit. The batch form is what this query is. Real production runs it against a 90-day window over hundreds of millions of edges, partitioned on `date_trunc('day', ts)` with parallel workers fanning out per day. The risk team consumes the output as `(component_id, size, total_volume)` aggregates piped into Looker — components above a size or volume threshold create a SAR (Suspicious Activity Report) review ticket. The graph-DB alternative (Neo4j, TigerGraph, Memgraph) is faster per query but adds an operational tier; most shops stick with SQL until ring-detection latency becomes the bottleneck.

#### Solution

```sql
-- Postgres 17/18.
WITH RECURSIVE edges AS (
  SELECT from_account AS a, to_account AS b
  FROM transactions
  WHERE ts > now() - INTERVAL '24 hours'
  UNION
  SELECT to_account, from_account
  FROM transactions
  WHERE ts > now() - INTERVAL '24 hours'
),
nodes AS (
  SELECT a AS node FROM edges
  UNION
  SELECT b FROM edges
),
walk AS (
  SELECT node, node AS label
  FROM nodes

  UNION

  SELECT e.b, LEAST(w.label, e.b)
  FROM walk w
  JOIN edges e ON e.a = w.node
  WHERE LEAST(w.label, e.b) < w.label
     OR NOT EXISTS (SELECT 1 FROM walk w2 WHERE w2.node = e.b)
)
SELECT node AS account_id, MIN(label) AS component_id
FROM walk
GROUP BY node
ORDER BY component_id, account_id;
```

*Source: Folk interview question — Stripe / Block fraud-eng screen*

---

### 133. FX Triangular Arbitrage Detection

#### Problem

Given `fx_rates(base, quote, rate, ts)` storing the latest cross-rates between currencies, find all triangles `(A, B, C)` where `rate(A→B) * rate(B→C) * rate(C→A) > 1.001` (arbitrage opportunity above noise threshold). Use the most recent rate per (base, quote) pair.

**Tables:** `fx_rates`

**Expected output (sample):**

| a   | b   | c   | edge   |
|-----|-----|-----|--------|
| USD | EUR | JPY | 1.0034 |
| USD | GBP | CHF | 1.0021 |

#### Pattern

`DISTINCT ON` for latest rate + self-join × 3 with cycle constraint.

#### Explanation

Two-step composition: first reduce `fx_rates` to "latest rate per ordered pair" via `DISTINCT ON (base, quote) ... ORDER BY base, quote, ts DESC` — this is Postgres-idiomatic for top-1-per-group and lets the planner stop at one row per pair. Second, three-way self-join the latest set, joining A→B, B→C, C→A with the `a < b < c` ordering to dedupe rotational duplicates (the same triangle appears 6 times unordered). The arbitrage edge is the product of the three rates; > 1.001 filters out floating-point noise. The naive alternative is materializing every triangle in a CTE first and filtering after — same result but the join filter doesn't push down as aggressively. Tie semantics on `ts`: if two rate rows share the same timestamp, `DISTINCT ON` picks one arbitrarily — in practice add `ts DESC, id DESC` for determinism. The 1.001 threshold encodes noise tolerance, not true profitability — real arbitrage accounts for transaction costs, slippage, and inventory cost, which raise the threshold materially.

**Production framing:** in production this lives in a low-latency in-memory store (Redis, Aerospike, or a custom L1 cache) refreshed on every quote tick, not in Postgres. The SQL form here is what gets written for the *backtest* and the *post-trade reconciliation* — running over a historical FX tick warehouse to identify missed opportunities or model regressions. A Two Sigma / Jane Street interview uses this question to probe both: can you write the SQL composition (DISTINCT ON + three-way self-join + cycle predicate), and can you reason about why no trading firm actually runs this in SQL on live data? The answer to the second part is "latency budget is microseconds, and SQL parse+plan is milliseconds."

#### Solution

```sql
-- Postgres 17/18.
WITH latest AS (
  SELECT DISTINCT ON (base, quote) base, quote, rate
  FROM fx_rates
  ORDER BY base, quote, ts DESC
)
SELECT ab.base AS a, ab.quote AS b, bc.quote AS c,
       ROUND((ab.rate * bc.rate * ca.rate)::numeric, 4) AS edge
FROM latest ab
JOIN latest bc ON ab.quote = bc.base AND ab.base < bc.quote
JOIN latest ca ON bc.quote = ca.base AND ca.quote = ab.base
WHERE ab.rate * bc.rate * ca.rate > 1.001
ORDER BY edge DESC;
```

*Source: Folk interview question — Two Sigma / Jane Street FX screen*

---

### 134. TPC-H Pricing Summary Report (Q1 Adapted)

#### Problem

From the TPC-H `lineitem` table, for orders shipped on or before `'1998-12-01' - INTERVAL '90 days'`, produce a pricing summary grouped by `(l_returnflag, l_linestatus)` showing sum of quantity, sum of extended price, sum of discounted price, sum of charge (price × (1−discount) × (1+tax)), and the row count.

**Tables:** `lineitem`

**Expected output (sample):**

| l_returnflag | l_linestatus | sum_qty   | sum_base_price | sum_disc_price | sum_charge   | n_rows |
|--------------|--------------|-----------|----------------|----------------|--------------|--------|
| A            | F            | 37734107  | 56586554400.73 | 53758257134.87 | 55909065222  | 1478493|
| R            | F            | 37719753  | 56568041380.90 | 53741292684.60 | 55889619119  | 1478870|

#### Pattern

Multi-column GROUP BY with derived columns inside `SUM`.

#### Explanation

TPC-H Q1 is the textbook OLAP pricing summary — a single-table scan with derived arithmetic inside the aggregates, grouped by two low-cardinality columns. The headline mechanic is "push compute into the aggregate" — `SUM(l_extendedprice * (1 - l_discount))` is one pass; computing the discounted price per row in a CTE first and aggregating after is two passes (and the planner often inlines anyway, but writing it expressively as one statement helps readers). Naive alternative: a subquery that computes discounted_price per row in a derived table — same result, worse readability, marginal plan difference. The frame here is `GROUP BY` with no windowing because the rollup is flat — no per-row context is needed in the output. Edge case: rows where `(1 + l_tax)` overflows numeric precision are not a concern for SF1 but become real at SF1000+; cast to `numeric(38, 4)` explicitly if you're materialising the result.

**Production framing:** TPC-H is a *benchmark*, so the production framing is benchmarking itself — this query is what you run to size hardware, evaluate columnar engines (Citus, Hydra, ParadeDB), and validate query-planner regressions across Postgres versions. On a partitioned `lineitem` (partitioned on `l_shipdate` monthly), with `max_parallel_workers_per_gather = 4` and BRIN indexes on `l_shipdate`, this hits <500ms on SF1 (6 GB), <8s on SF10 (60 GB) on commodity hardware. A FAANG data-eng interview uses it to probe partitioning strategy, parallel-query tuning, and whether you'd recognise that `HashAggregate` is the right node here rather than `GroupAggregate` (which would require a sort).

#### Solution

```sql
-- Postgres 17/18.
SELECT l_returnflag,
       l_linestatus,
       SUM(l_quantity) AS sum_qty,
       SUM(l_extendedprice) AS sum_base_price,
       SUM(l_extendedprice * (1 - l_discount)) AS sum_disc_price,
       SUM(l_extendedprice * (1 - l_discount) * (1 + l_tax)) AS sum_charge,
       COUNT(*) AS n_rows
FROM lineitem
WHERE l_shipdate <= DATE '1998-12-01' - INTERVAL '90 days'
GROUP BY l_returnflag, l_linestatus
ORDER BY l_returnflag, l_linestatus;
```

*Source: TPC-H Benchmark, Query Q1*

---

### 135. TPC-H Local Supplier Volume (Q5 Adapted)

#### Problem

From TPC-H, return per-nation revenue for suppliers and customers in the same nation within a specified region for a given year, ordered by revenue desc. Revenue = `l_extendedprice * (1 - l_discount)`. Use region `'ASIA'`, year `1994`.

**Tables:** `customer`, `orders`, `lineitem`, `supplier`, `nation`, `region`

**Expected output (sample):**

| n_name   | revenue       |
|----------|---------------|
| INDONESIA| 55502041.16   |
| VIETNAM  | 55295086.99   |
| CHINA    | 53724494.25   |

#### Pattern

Six-table join with date predicate and matching-nation constraint.

#### Explanation

TPC-H Q5 is a six-way join with three filtering predicates: the region, the year, and the customer-nation-equals-supplier-nation constraint that defines "local supplier". The clever bit is that `c_nationkey = s_nationkey` predicate — it's a join condition that drastically reduces the join cardinality, and where you place it matters: in the `JOIN ... ON` clause it can drive index choice; in a `WHERE` clause after the join, the planner usually pushes it down anyway but reads less clearly. The three predicates do real planner work: date range on `orders` (BRIN-indexable if the table is time-ordered), region equality on `region` (constant predicate, ~1 row), and nation match (selectivity ~1/25 for 25 nations). The naive alternative — joining all six tables then filtering — produces the same result but lets the planner pick worse join orders if statistics are stale; explicit predicates in the `ON` clauses give the planner more hints. Tie semantics: `o_orderdate` ranges use `>=` and `<` so the year boundary is unambiguous — never `BETWEEN` for date ranges with time components (BETWEEN is inclusive on both ends, which double-counts midnight boundary rows).

**Production framing:** Q5 stresses the join planner — six tables, mixed cardinalities, multiple filtering predicates. In production analytics (Citus, Hydra, Snowflake) this kind of query lives in a nightly batch that powers regional sales dashboards, not in interactive queries. Hash-join with parallel workers is the expected plan on Postgres; the join order matters less than the index strategy because the planner uses `pg_statistic` to estimate cardinalities. Real shops materialize a fact table `(nation, year_month, revenue)` rebuilt daily so the dashboard doesn't pay the join cost on every load — the SQL form here is what generates that fact table.

#### Solution

```sql
-- Postgres 17/18.
SELECT n.n_name,
       ROUND(SUM(l.l_extendedprice * (1 - l.l_discount))::numeric, 2) AS revenue
FROM customer c
JOIN orders o ON o.o_custkey = c.c_custkey
JOIN lineitem l ON l.l_orderkey = o.o_orderkey
JOIN supplier s ON s.s_suppkey = l.l_suppkey AND s.s_nationkey = c.c_nationkey
JOIN nation n ON n.n_nationkey = s.s_nationkey
JOIN region r ON r.r_regionkey = n.n_regionkey
WHERE r.r_name = 'ASIA'
  AND o.o_orderdate >= DATE '1994-01-01'
  AND o.o_orderdate <  DATE '1995-01-01'
GROUP BY n.n_name
ORDER BY revenue DESC;
```

*Source: TPC-H Benchmark, Query Q5*

---

### 136. TPC-H Returned Item Reporting (Q10 Adapted)

#### Problem

From TPC-H, return the top 20 customers (by lost revenue from returned items) in a given quarter — Q4 1993. Lost revenue = `l_extendedprice * (1 - l_discount)` summed across lineitems with `l_returnflag = 'R'`.

**Tables:** `customer`, `orders`, `lineitem`, `nation`

**Expected output (sample):**

| c_custkey | c_name              | revenue     | c_acctbal | n_name   |
|-----------|---------------------|-------------|-----------|----------|
| 57040     | Customer#000057040  | 734235.25   | 632.87    | JAPAN    |
| 143347    | Customer#000143347  | 721002.69   | 2557.47   | EGYPT    |

#### Pattern

Four-table join with selective predicate + top-K.

#### Explanation

TPC-H Q10 is a four-way join + filter + aggregate + top-K — the canonical "top N customers by metric over period" shape. Selectivity flows from two filters: the quarter (`o_orderdate` in [1993-10-01, 1994-01-01)) and the return flag (`l_returnflag = 'R'`, ~25% of lineitems). The aggregate runs over the resulting (~6% × 25% = 1.5%) slice of lineitems. The naive alternative — using `ROW_NUMBER() OVER (ORDER BY revenue DESC) <= 20` over the fully aggregated customer set — works but does an extra sort and window-function pass; `ORDER BY revenue DESC LIMIT 20` is one sort with a top-K shortcut. Index strategy: BRIN on `o_orderdate` if the orders table is time-ordered on disk (which it usually is for append-only OLTP→OLAP pipelines), B-tree composite `(l_returnflag, l_orderkey)` if returns are heavily skewed and you query the rare side, otherwise the default `l_orderkey` PK index suffices. Tie semantics on the LIMIT: if customer 21 has identical revenue to customer 20, `ORDER BY revenue DESC LIMIT 20` picks one arbitrarily — add `c_custkey ASC` as tiebreaker for determinism. NULL handling: `c_acctbal` can be negative (indebted customers) — that's a feature, not a bug, in the TPC-H model.

**Production framing:** Q10 is the prototype of "find me my top-N most-impactful Xs" — the question that powers customer success dashboards, churn-risk reports, fraud-priority queues. In production it lives as a daily-refreshed materialized view keyed on `(customer_id, quarter)` so the dashboard reads from a small pre-aggregated table instead of recomputing the join every page load. The LIMIT 20 boundary is usually a UI concern (top page of a table); the underlying aggregate computes all customers and the LIMIT is applied at read time. A FAANG data-eng interview uses this question to probe materialized-view strategy, refresh idempotency, and whether you'd recognise that the join cost is sub-dominant to the aggregate cost at this scale.

#### Solution

```sql
-- Postgres 17/18.
SELECT c.c_custkey, c.c_name,
       ROUND(SUM(l.l_extendedprice * (1 - l.l_discount))::numeric, 2) AS revenue,
       c.c_acctbal,
       n.n_name
FROM customer c
JOIN orders o ON o.o_custkey = c.c_custkey
JOIN lineitem l ON l.l_orderkey = o.o_orderkey
JOIN nation n ON n.n_nationkey = c.c_nationkey
WHERE o.o_orderdate >= DATE '1993-10-01'
  AND o.o_orderdate <  DATE '1994-01-01'
  AND l.l_returnflag = 'R'
GROUP BY c.c_custkey, c.c_name, c.c_acctbal, n.n_name
ORDER BY revenue DESC
LIMIT 20;
```

*Source: TPC-H Benchmark, Query Q10*

---

### 137. Idempotent Daily Aggregate Refresh (Materialized View Strategy)

#### Problem

Daily revenue is rolled up from `orders` into a `daily_revenue(dt, total, n_orders, refreshed_at)` table. Refresh once per day, but the job must be **idempotent** (running twice in a row should not change results) and **incremental** (only recompute days where `orders` changed). Write the refresh statement and explain how change detection works.

**Tables:** `orders`, `daily_revenue`

**Expected output:** No result set; modifies daily_revenue.

#### Pattern

`MERGE` with computed source per day + change-marker column on `orders`.

#### Explanation

Idempotence is the headline concern: running the refresh twice in a row, with no underlying data change, must produce zero modifications. `MERGE` gives this for free via `WHEN MATCHED AND (d.total, d.n_orders) IS DISTINCT FROM (s.total, s.n_orders)` — the predicate is false when rows already match, so no UPDATE fires. The naive alternative — `DELETE FROM daily_revenue WHERE dt IN (...); INSERT ...` — is destructive and not idempotent under concurrent reads (a reader between DELETE and INSERT sees missing rows). `INSERT ... ON CONFLICT (dt) DO UPDATE SET ...` works but always fires the UPDATE even when values are unchanged, polluting the WAL and triggering downstream cascade. Incrementality comes from `changed_days` — only recompute days where some order's `updated_at` is newer than the last refresh; this requires the orders table to maintain `updated_at` (a trigger or app-level write). The `IS DISTINCT FROM` is NULL-safe equality — `=` returns NULL when either side is NULL, which would skip rows that need updating; `IS DISTINCT FROM` treats NULL as a value. Tie semantics: if two orders share the same `placed_at` second, they're both in the same day-bucket and counted correctly — no ordering concerns.

**Production framing:** this query lives as a cron job (Airflow, dbt, or Postgres `pg_cron`) running once a day at low-traffic hours. The output `daily_revenue` table feeds the executive dashboard and the finance-reconciliation pipeline. Idempotency matters because the job runs under at-least-once semantics — if the worker crashes mid-job, the orchestrator retries, and a non-idempotent refresh would double-count. The `last_refresh_ts` watermark must be advanced *after* the MERGE commits, in the same transaction, otherwise a crash between MERGE and watermark-advance produces a re-run that re-MERGEs the same days (harmless thanks to idempotency, but wasteful). At Stripe / Plaid-scale, daily revenue rollups feed downstream pipelines that compute fees, taxes, partner payouts — every step has to be exactly-once at the data level even though the infrastructure is at-least-once at the message level. `MERGE` is the idempotent primitive that bridges the gap.

#### Solution

```sql
-- Postgres 17/18.
WITH last_refresh AS (
  SELECT COALESCE(MAX(refreshed_at), TIMESTAMP 'epoch') AS ts FROM daily_revenue
),
changed_days AS (
  SELECT DISTINCT date_trunc('day', placed_at)::date AS dt
  FROM orders, last_refresh lr
  WHERE updated_at > lr.ts
),
source AS (
  SELECT date_trunc('day', placed_at)::date AS dt,
         SUM(amount) AS total,
         COUNT(*) AS n_orders,
         now() AS refreshed_at
  FROM orders
  WHERE date_trunc('day', placed_at)::date IN (SELECT dt FROM changed_days)
  GROUP BY 1
)
MERGE INTO daily_revenue d
USING source s
  ON d.dt = s.dt
WHEN MATCHED AND (d.total, d.n_orders) IS DISTINCT FROM (s.total, s.n_orders) THEN
  UPDATE SET total = s.total, n_orders = s.n_orders, refreshed_at = s.refreshed_at
WHEN NOT MATCHED THEN
  INSERT (dt, total, n_orders, refreshed_at)
  VALUES (s.dt, s.total, s.n_orders, s.refreshed_at);
```

*Source: Folk interview question — Stripe / Plaid data-pipeline screen*
