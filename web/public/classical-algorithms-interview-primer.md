---
type: interview-prep
---

# Classical Algorithms Interview Primer — 335 Questions

The per-algorithm deep dive — one focused topic per classical ML algorithm. A Machine Learning companion and the algorithm-mechanics counterpart to the ML Fundamentals primer (which owns the cross-cutting concepts — bias-variance, metrics, cross-validation, leakage): this one goes deep on each algorithm's core idea, how it's trained/fit (the maths), key hyperparameters, complexity, strengths/weaknesses, and when to use it.

Covers linear regression, regularized linear models (Ridge/Lasso/Elastic Net), logistic regression, Naive Bayes, k-nearest neighbors, decision trees, random forests, bagging & ensemble foundations, gradient boosting, XGBoost, LightGBM & CatBoost, support vector machines, kernels & the kernel trick, k-means, hierarchical & density clustering, Gaussian mixtures & EM, PCA, non-linear & supervised dimensionality reduction, algorithm selection & tradeoffs, hyperparameters & practical implementation, and an interview/whiteboard capstone.

Every answer states the objective/loss, how it's optimized, the key knobs and their bias-variance effect, the complexity, and the decisive tradeoff — in plain ASCII maths (the reader renders no LaTeX — e.g. `grad = X^T (p - y)`, `Gini = 1 - sum(p_k^2)`, `margin = 2/||w||`) with sklearn-style pseudocode. Warm-up ("what does logistic regression predict", "what is a support vector", "what is a principal component") to senior ("derive the logistic-regression gradient", "explain the kernel trick", "how does a random forest reduce variance", "why does XGBoost dominate tabular", "prove PCA maximizes variance / relate it to SVD").

1. [[#Linear Regression]]
2. [[#Regularized Linear Models (Ridge, Lasso, Elastic Net)]]
3. [[#Logistic Regression]]
4. [[#Naive Bayes]]
5. [[#k-Nearest Neighbors]]
6. [[#Decision Trees]]
7. [[#Random Forests]]
8. [[#Bagging & Ensemble Foundations]]
9. [[#Gradient Boosting (GBM)]]
10. [[#XGBoost]]
11. [[#LightGBM & CatBoost]]
12. [[#Support Vector Machines]]
13. [[#Kernels & the Kernel Trick]]
14. [[#k-Means Clustering]]
15. [[#Hierarchical & Density Clustering]]
16. [[#Gaussian Mixture Models & EM]]
17. [[#PCA]]
18. [[#Non-Linear & Supervised Dimensionality Reduction]]
19. [[#Algorithm Selection & Tradeoffs]]
20. [[#Hyperparameters & Practical Implementation]]
21. [[#Classical Algorithms Interview & Whiteboard Playbooks]]

## Linear Regression

### Summary

**What this topic covers**

Linear regression is the "hello world" of supervised learning and the algorithm every ML interview opens with — precisely because it looks trivial and is not. This topic owns the mechanics of fitting a linear model `yhat = w·x + b` by least squares: the **objective** (mean squared error), the **two ways to solve it** (the closed-form normal equation vs iterative gradient descent) and when each wins, the **statistical assumptions** it rests on (the Gauss-Markov conditions) and exactly what breaks when they fail, **multicollinearity** and why it makes coefficients untrustworthy, and how you **diagnose** a fit (residual plots, R^2, VIF). The 16 questions here go from "what does it minimize" up to "derive the normal equation and state its cost." Regularization (Ridge/Lasso/Elastic Net) is a separate topic that builds directly on this one — here we cover the unpenalized ordinary least squares (OLS) baseline and its failure modes. Cross-cutting ideas (bias-variance, overfitting, CV) belong to the ML Fundamentals primer; we reference them and stay on the algorithm internals.

**Mental model**

Picture a cloud of points in feature space with a continuous target. Linear regression finds the single hyperplane that sits "closest" to all of them, where "closest" is measured by the **sum of squared vertical distances** (residuals). Squaring — rather than taking absolute values — is what makes the problem smooth and gives it a unique closed-form solution: the loss surface is a convex paraboloid in weight space, so there is exactly one bottom and calculus finds it directly. Geometrically, the fitted values `yhat = Xw` are the **orthogonal projection** of `y` onto the column space of `X`; the residual vector `y - yhat` is perpendicular to every feature, which is literally what the normal equations `X^T(y - Xw) = 0` say. That projection view is the whole algorithm: OLS is "project the target onto the span of the features." Everything else — assumptions, multicollinearity, diagnostics — is about whether that projection is *trustworthy* and *interpretable*, not whether it exists.

**Key terms**

- **Residual** — `e_i = y_i - yhat_i`, the vertical gap between actual and predicted; OLS minimizes sum of `e_i^2`.
- **MSE / RSS** — mean (or sum of) squared residuals; the loss being minimized. `RSS = sum (y_i - yhat_i)^2`.
- **Normal equation** — closed-form solution `w = (X^T X)^-1 X^T y` that sets the gradient to zero.
- **Design matrix X** — the n-by-p matrix of features (a column of 1s absorbs the intercept `b`).
- **Gauss-Markov assumptions** — linearity, zero-mean errors, homoscedasticity, no autocorrelation, no perfect multicollinearity; under them OLS is BLUE (Best Linear Unbiased Estimator).
- **Homoscedasticity** — constant error variance across all x; the opposite (fanning residuals) is heteroscedasticity.
- **Multicollinearity** — features that are linearly correlated; makes `X^T X` near-singular and coefficients unstable.
- **VIF (Variance Inflation Factor)** — `1/(1 - R_j^2)` from regressing feature j on the rest; > 5–10 flags multicollinearity.
- **R^2** — fraction of target variance explained, `1 - RSS/TSS`; adjusted R^2 penalizes extra features.
- **Coefficient** — `w_j` is the expected change in y per unit change in `x_j`, holding other features fixed.

**Why interviewers ask this**

Linear regression is the fastest way to tell a junior from a senior. A junior recites "it fits a line to minimize error." A senior can (1) **derive the normal equation** by setting the gradient of `||y - Xw||^2` to zero, (2) explain *why* you would ever avoid that closed form (the `O(p^3)` matrix inverse, numerical instability under multicollinearity, memory on huge n), (3) state the **assumptions** and — the real test — say what specifically goes wrong when each is violated (heteroscedasticity breaks your standard errors, not your point estimates; multicollinearity inflates coefficient variance without hurting predictions). It is also the honesty check: interpreting a coefficient as "effect holding all else equal" only holds if the features aren't collinear. Getting these right signals you understand the model from the inside, which is the whole point of the algorithm-mechanics round.

**Common confusions**

- "Linear regression means the relationship is a straight line" — it means linear *in the parameters*. `y = w1*x + w2*x^2` is still linear regression; you just engineered a feature.
- "You always solve it with the normal equation" — sklearn's `LinearRegression` uses SVD/least-squares, not a raw inverse, precisely to survive multicollinearity; on large/sparse data you use gradient descent (SGD) instead.
- "A high R^2 means a good model" — R^2 only measures in-sample variance explained; it never decreases when you add features, says nothing about causation, generalization, or whether the assumptions hold.
- "Multicollinearity hurts predictions" — it mainly wrecks *coefficient interpretation and stability*; predictions can stay fine. That distinction is a classic senior signal.
- "OLS needs the errors to be normally distributed" — no; Gauss-Markov gives you BLUE without normality. Normality is only needed for exact t/F-based confidence intervals and p-values.

**What follows from this topic**

Everything downstream. The instability of OLS coefficients under multicollinearity is the entire motivation for **Regularized Linear Models** (Ridge shrinks, Lasso selects) — read that next. Swapping the squared loss for log-loss and wrapping the linear score in a sigmoid gives you **Logistic Regression**, the classification sibling. The projection/least-squares machinery reappears in **PCA** (which diagonalizes `X^T X`). And the assumption-checking discipline here — plot residuals, don't trust a metric blindly — is the same discipline the ML Fundamentals primer formalizes as bias-variance and validation.

### Q1. What does linear regression predict, and what does it minimize?

It predicts a **continuous** target as a linear combination of features:

```
yhat = w·x + b = w1*x1 + w2*x2 + ... + wp*xp + b
```

It is trained to minimize the **sum of squared residuals** (equivalently the mean squared error):

```
L(w, b) = sum_i (y_i - yhat_i)^2 = ||y - Xw||^2
```

The squared term is the whole design choice: it makes the loss a smooth convex bowl in weight space, so there is a single global minimum with a closed-form solution, and it penalizes large errors quadratically (an error of 4 costs 16x an error of 1). The output is a real number — this is **regression**, not classification.

### Q2. Derive the normal equation.

Start from the loss `L(w) = (y - Xw)^T (y - Xw)`. Expand:

```
L(w) = y^T y - 2 w^T X^T y + w^T X^T X w
```

Take the gradient with respect to w and set it to zero:

```
dL/dw = -2 X^T y + 2 X^T X w = 0
=>  X^T X w = X^T y            (the "normal equations")
=>  w = (X^T X)^-1 X^T y
```

The name comes from the geometry: the residual `y - Xw` is orthogonal ("normal") to the column space of X, i.e. `X^T (y - Xw) = 0`. Because L is convex, this stationary point is the global minimum. The intercept is handled by prepending a column of 1s to X.

### Q3. Normal equation vs gradient descent — when do you use each?

| | Normal equation | Gradient descent |
|---|---|---|
| Form | Closed form, one shot | Iterative |
| Cost | `O(np^2 + p^3)` (build + invert `X^T X`) | `O(np)` per step |
| Scales with features p | Badly — `p^3` inverse | Well |
| Scales with samples n | Fine until n huge | Great (SGD/mini-batch) |
| Hyperparameters | None | Learning rate, epochs |
| Numerical issues | Fails/unstable if `X^T X` near-singular | Robust; handles sparse data |

Rule of thumb: **small-to-moderate p (say < 10^4) and data that fits in memory → normal equation** (or better, an SVD-based least-squares solver). **Very large p, huge n, sparse features, or streaming data → gradient descent (SGD)**. The `p^3` inverse is the killer: at p = 10,000 that is 10^12 operations. In practice sklearn uses SVD, which is more stable than forming `X^T X` explicitly.

### Q4. What is the time complexity of fitting linear regression?

For the normal equation: forming `X^T X` costs `O(np^2)`, inverting (or Cholesky/LU factoring) it costs `O(p^3)`, so total is `O(np^2 + p^3)`. Prediction is `O(p)` per example. For gradient descent: each full-batch step is `O(np)` (one pass over the data), times the number of iterations. SVD-based solvers (what sklearn actually uses) are also `O(np^2)` but far more numerically stable than explicitly inverting `X^T X`, because they avoid squaring the condition number.

### Q5. State the Gauss-Markov assumptions. Why do they matter?

The Gauss-Markov theorem says OLS is **BLUE** (Best Linear Unbiased Estimator — lowest variance among linear unbiased estimators) when:

1. **Linearity** — the true relationship is linear in the parameters.
2. **Zero-mean errors** — `E[e | X] = 0` (the model is correctly specified, no omitted systematic effect).
3. **Homoscedasticity** — errors have constant variance.
4. **No autocorrelation** — errors are uncorrelated across observations.
5. **No perfect multicollinearity** — X has full column rank so `X^T X` is invertible.

They matter because they are the fine print behind every claim you make from the model. Notably, **normality of errors is not required** for BLUE — it is only needed for exact t-tests, F-tests, and confidence intervals. Point estimates stay valid under Gauss-Markov alone.

### Q6. What breaks when each assumption is violated?

- **Non-linearity** — the model is biased; residual plots show curvature. Fix: add polynomial/interaction features or switch model.
- **Heteroscedasticity** — coefficients stay unbiased but their **standard errors are wrong**, so p-values and confidence intervals lie. Fix: robust (sandwich) standard errors, weighted least squares, or transform y (e.g. log).
- **Autocorrelation** (common in time series) — again unbiased coefficients but understated standard errors → false significance. Fix: GLS, add lags, or Newey-West errors.
- **Multicollinearity** — coefficients become high-variance and unstable (flip sign with tiny data changes); predictions can still be fine. Fix: drop/combine features, PCA, or regularize (Ridge).
- **Omitted variable / non-zero-mean errors** — coefficients become **biased** (omitted variable bias). This is the serious one for interpretation.

The senior move is to distinguish violations that bias the *estimates* (non-linearity, omitted variables) from those that only corrupt the *inference/standard errors* (heteroscedasticity, autocorrelation).

### Q7. What is multicollinearity and why is it a problem?

Multicollinearity is when features are linearly correlated — one feature is (nearly) a linear combination of others. Then `X^T X` becomes near-singular (tiny eigenvalues), and since the coefficient covariance is proportional to `(X^T X)^-1`, coefficient **variance blows up**. Symptoms: huge standard errors, coefficients that flip sign or magnitude wildly when you add/remove a row or feature, and individually insignificant coefficients despite a high overall R^2.

Crucially it is a problem for **interpretation and stability, not necessarily prediction** — if two features move together, the model can't tell which deserves the credit, but their *combined* contribution (and the predictions) can be accurate. You detect it with the **Variance Inflation Factor**: `VIF_j = 1 / (1 - R_j^2)` where `R_j^2` comes from regressing feature j on all the others; VIF > 5 (or 10) flags trouble. Fixes: remove redundant features, combine them, use PCA, or — most directly — Ridge regression, which adds `lambda*I` to `X^T X` and makes it invertible again.

### Q8. How do you interpret a linear regression coefficient?

`w_j` is the expected change in the target for a **one-unit increase in `x_j`, holding all other features fixed**. That "holding others fixed" clause is doing enormous work: it is only meaningful if the features are not collinear (otherwise you can't move one while freezing the rest, and the coefficient is unstable). Two more caveats: (1) the scale matters — a coefficient on income-in-dollars and income-in-thousands differ by 1000x, which is why you standardize features before comparing coefficient magnitudes; (2) it is an **associational**, not causal, statement unless the design supports causal claims. The sign and rough magnitude are the interpretable payoff of linear models and the main reason you'd pick one over a black-box model.

### Q9. What is R^2 and what are its limitations?

R^2 is the fraction of target variance the model explains:

```
R^2 = 1 - RSS/TSS = 1 - sum(y_i - yhat_i)^2 / sum(y_i - ybar)^2
```

R^2 = 1 is a perfect fit; R^2 = 0 is no better than predicting the mean; it can go **negative** on test data if the model is worse than the mean. Limitations: (1) it **never decreases** when you add a feature, even a random one — so it rewards overfitting; use **adjusted R^2** which penalizes extra parameters. (2) It says nothing about whether the assumptions hold, whether residuals are patterned, or whether the model generalizes. (3) A high R^2 does not imply causation or a correct model. Always pair it with residual diagnostics and out-of-sample error.

### Q10. What residual diagnostics would you run on a linear fit?

Plot the residuals — they encode every assumption violation:

- **Residuals vs fitted values** — should be a structureless band around zero. Curvature ⇒ non-linearity; a fan/cone shape ⇒ heteroscedasticity.
- **Q-Q plot of residuals** — checks normality (needed for valid p-values/CIs); heavy tails or skew show up as departures from the diagonal.
- **Residuals vs each feature** — leftover pattern ⇒ that feature needs a transform or interaction.
- **Residuals vs time / order** — trends or cycles ⇒ autocorrelation.
- **Leverage / Cook's distance** — flags influential outliers that dominate the fit.

The discipline: don't read a single number (R^2), look at the residuals. Most real problems announce themselves visually.

### Q11. Is linear regression high-bias or high-variance? How does it sit on the bias-variance spectrum?

Unregularized linear regression is a **high-bias, low-variance** model when the number of features is small relative to samples: it can only express hyperplanes, so if the truth is non-linear it is systematically wrong (bias), but it is stable across resamples (low variance). The variance rises sharply as p approaches n or under multicollinearity — with p >= n the fit can interpolate and coefficients explode. This is exactly why regularization exists: it trades a little bias for a large cut in variance in the high-dimensional / collinear regime. (The bias-variance decomposition itself is owned by the ML Fundamentals primer; here the point is where linear regression lands on it and how p and collinearity move it.)

### Q12. How do you fit a linear model with gradient descent? Give the update rule.

Minimize `L(w) = (1/n) * ||y - Xw||^2` by repeatedly stepping downhill. The gradient is:

```
grad = -(2/n) * X^T (y - Xw)
```

and the update with learning rate eta is:

```
w := w - eta * grad = w + (2*eta/n) * X^T (y - Xw)
```

```python
# batch gradient descent for OLS
w = np.zeros(p)
for _ in range(epochs):
    resid = y - X @ w          # n-vector
    grad  = -(2/n) * X.T @ resid
    w    -= eta * grad
```

For huge/sparse data use **SGD** or mini-batches (gradient on a subset per step). Because the OLS loss is convex, gradient descent converges to the global optimum given a small enough learning rate; too large an eta diverges. Features should be standardized first so the loss bowl isn't badly elongated (which slows convergence).

### Q13. Why standardize features for gradient descent but not (strictly) for the normal equation?

The normal equation solves the system exactly in one shot, so feature scaling doesn't change the fitted predictions — it only rescales the coefficients. Gradient descent is different: if features live on wildly different scales, the loss surface becomes a long narrow valley (elongated ellipsoid), and gradient descent zig-zags slowly across it, needing a tiny learning rate to avoid diverging on the steep axis. **Standardizing** (zero mean, unit variance) makes the bowl round, so a single learning rate works across all directions and convergence is fast. Scaling is also required the moment you add regularization — Ridge/Lasso penalties are scale-sensitive — which is why "standardize first" is the default habit.

### Q14. Can linear regression fit non-linear relationships?

Yes — as long as it stays linear *in the parameters*. You engineer non-linear features and regress on them:

```
yhat = w1*x + w2*x^2 + w3*x^3 + w4*sin(x) + ...
```

is still solved by ordinary least squares because the unknowns (the w's) enter linearly. This is **polynomial / basis-function regression**. The catch is the bias-variance tradeoff: higher-degree polynomials fit training data better but oscillate wildly and overfit (Runge's phenomenon), and they reintroduce multicollinearity between `x`, `x^2`, `x^3`. Splines and regularization tame this. What linear regression *cannot* do is learn the non-linear basis itself — that is where trees and neural nets earn their keep.

### Q15. When would you choose linear regression over a tree-based model, and vice versa?

**Choose linear regression when**: you want interpretable coefficients ("each extra bedroom adds $X"), the relationship is roughly linear/additive, you have limited data (its strong bias resists overfitting), you need calibrated extrapolation beyond the training range, or you need fast training and tiny models. It is the interpretable baseline every project should start with.

**Choose gradient-boosted trees / random forests when**: relationships are non-linear with complex interactions, features are on mixed scales or include categoricals, there is missing data, and predictive accuracy matters more than reading off coefficients. Trees capture interactions automatically but **cannot extrapolate** (they predict flat outside the training range) and are less interpretable. On typical tabular problems the boosted-tree wins on accuracy; linear regression wins on transparency and small-data robustness. Often you fit both and compare.

### Q16. What is the closed-form solution's failure mode, and how does Ridge fix it?

The normal equation `w = (X^T X)^-1 X^T y` requires `X^T X` to be **invertible** (full rank). It fails or becomes numerically unstable when features are perfectly or nearly collinear, or when p > n (more features than samples) — then `X^T X` is singular / has near-zero eigenvalues, the inverse blows up, and coefficients become enormous and arbitrary. **Ridge regression** fixes this directly by adding `lambda*I` to the matrix:

```
w = (X^T X + lambda*I)^-1 X^T y
```

Adding a positive constant to the diagonal lifts every eigenvalue by lambda, guaranteeing invertibility and shrinking the coefficients toward zero — stabilizing them at the cost of a little bias. This is the mathematical bridge from OLS to the next topic; whenever OLS is unstable, regularization is the answer.

## Regularized Linear Models (Ridge, Lasso, Elastic Net)

### Summary

**What this topic covers**

This topic is about the single most important upgrade to plain least squares: adding a **penalty on coefficient size** to the loss. That one change buys you stability under multicollinearity, resistance to overfitting when p is large, and — for the L1 variant — automatic **feature selection**. We cover the three canonical penalized regressions: **Ridge (L2)**, which shrinks all coefficients smoothly and has a clean closed form; **Lasso (L1)**, which drives some coefficients to *exactly* zero (sparsity) and why its geometry does that; and **Elastic Net**, which mixes both to get selection plus grouped-feature stability. Around them: the **coefficient path** (how weights evolve as lambda changes), choosing **lambda by cross-validation**, and the non-negotiable preprocessing step of **standardizing features first**. The 16 questions run from "what does L2 do" to "why exactly does L1 produce zeros and L2 doesn't." This builds directly on the Linear Regression topic — read that first for the OLS baseline and the multicollinearity problem these methods solve.

**Mental model**

Plain OLS minimizes error only. Regularized regression minimizes **error plus a budget on how big the coefficients can get** — `loss = fit_error + lambda * penalty(w)`. Picture the OLS solution as the bottom of an elliptical error bowl, and the penalty as a constraint region centered at the origin that the solution is pulled into. **Ridge** uses a round L2 ball (`sum w^2`), so the solution is dragged toward zero smoothly in all directions but rarely lands exactly on an axis — every feature keeps a small weight. **Lasso** uses a diamond-shaped L1 ball (`sum |w|`) whose **sharp corners sit on the axes**; the elliptical error contours are very likely to first touch the diamond at a corner, and a corner means some coordinates are exactly zero — that is feature selection falling out of the geometry. `lambda` is the dial: 0 recovers OLS, large lambda crushes all coefficients toward zero (more bias, less variance). You are buying variance reduction with bias, and choosing how much via cross-validation.

**Key terms**

- **Regularization** — adding a penalty on model complexity (here, coefficient magnitude) to the loss to reduce overfitting.
- **L2 / Ridge penalty** — `lambda * sum(w_j^2)`; smooth shrinkage, keeps all features, differentiable everywhere.
- **L1 / Lasso penalty** — `lambda * sum(|w_j|)`; produces exact zeros → sparse models, non-differentiable at 0.
- **Elastic Net** — convex combination `lambda*(alpha*sum|w| + (1-alpha)*sum w^2)`; selection + grouping.
- **lambda (alpha in sklearn)** — regularization strength; larger = more shrinkage, more bias, less variance.
- **Shrinkage** — pulling coefficients toward zero to trade bias for reduced variance.
- **Sparsity** — a solution with many exactly-zero coefficients; equivalent to feature selection.
- **Coefficient path** — the trajectory of each coefficient as lambda sweeps from 0 to infinity.
- **Coordinate descent** — the workhorse optimizer for Lasso; updates one coefficient at a time via soft-thresholding.
- **Soft-thresholding** — the L1 update `sign(z)*max(|z|-t, 0)`; the operation that creates exact zeros.
- **Standardization** — zero-mean/unit-variance scaling; mandatory so the penalty treats features fairly.

**Why interviewers ask this**

"L1 vs L2" is one of the most common ML interview questions, and it separates memorizers from understanders instantly. The junior answer is "L1 gives sparsity, L2 doesn't." The senior answer explains **why**: the L1 ball has corners on the axes so the constrained optimum lands there, the L2 ball is round so it doesn't; equivalently, L1's constant-magnitude gradient can push a coefficient all the way to zero and pin it, while L2's gradient shrinks proportionally and vanishes near zero. Interviewers also probe the practical wrapper: why you standardize first (the penalty is scale-sensitive — an unscaled feature with a large range gets under-penalized), how you pick lambda (cross-validation, not eyeballing), and when Ridge beats Lasso (correlated features, when you want to keep everything) versus when Lasso beats Ridge (you want a sparse, interpretable subset). It is the cleanest test of whether you understand the bias-variance tradeoff as an actual mechanism.

**Common confusions**

- "Lasso is strictly better because it selects features" — no; with correlated features Lasso arbitrarily picks one and zeros the rest (unstable), while Ridge keeps and shares among them. Elastic Net exists precisely to fix this.
- "Regularization always improves the model" — it improves *generalization when variance is the problem*; if the model is underfitting (high bias), adding a penalty makes it worse. lambda must be tuned.
- "You penalize the intercept too" — you don't; the bias term `b` is left unpenalized so shrinkage doesn't depend on where you center y.
- "L2 can also zero out coefficients with enough lambda" — it drives them arbitrarily small but not exactly zero (except in degenerate cases); only L1's corner geometry gives true zeros.
- "Scaling doesn't matter, it's still linear" — it matters enormously here: because the penalty sums coefficient magnitudes, features on larger scales get unfairly small penalties. Standardize inside the CV fold to avoid leakage.

**Common confusions resolved, you move on to what these methods connect to.**

**What follows from this topic**

Ridge is the direct cure for the multicollinearity failure mode raised in **Linear Regression** (it makes `X^T X + lambda*I` invertible). The exact same L1/L2 penalties reappear in **Logistic Regression** (penalized log-loss — `C` in sklearn is `1/lambda`) and in **SVMs** (the `0.5*||w||^2` term is L2 regularization; `C` trades margin against error). The idea of a penalty controlling model complexity generalizes to `lambda` and `gamma` in **XGBoost** and weight decay in neural nets. And the coefficient-path / soft-thresholding machinery is the cleanest concrete example of the bias-variance tradeoff that the ML Fundamentals primer treats abstractly.

### Q1. What is regularization and why do we do it?

Regularization adds a penalty on model complexity to the training loss so the optimizer prefers simpler models. For linear models that means penalizing coefficient magnitude:

```
loss = fit_error + lambda * penalty(w)
```

The purpose is to **reduce variance / overfitting** at the cost of a little bias. Unpenalized OLS with many features (or collinear features) produces large, high-variance coefficients that fit training noise; the penalty shrinks them toward zero, making the model more stable and generalizing better. `lambda` sets the strength: zero gives back OLS, large lambda gives a heavily shrunk, high-bias model. It is the most direct, tunable knob on the bias-variance tradeoff.

### Q2. Write the Ridge and Lasso objectives.

Both start from the OLS squared-error loss and add a penalty (the intercept is not penalized):

```
Ridge (L2):  L(w) = ||y - Xw||^2 + lambda * sum_j w_j^2
Lasso (L1):  L(w) = ||y - Xw||^2 + lambda * sum_j |w_j|
```

Ridge penalizes the **squared** magnitude (the L2 norm), Lasso the **absolute** magnitude (the L1 norm). That single difference — squared vs absolute — is the source of every behavioral difference between them: Ridge shrinks smoothly and keeps all features; Lasso produces exact zeros and selects a subset.

### Q3. Derive the closed-form solution for Ridge.

Minimize `L(w) = (y - Xw)^T(y - Xw) + lambda * w^T w`. Take the gradient and set to zero:

```
dL/dw = -2 X^T(y - Xw) + 2*lambda*w = 0
=>  (X^T X + lambda*I) w = X^T y
=>  w = (X^T X + lambda*I)^-1 X^T y
```

Compare to OLS `w = (X^T X)^-1 X^T y`: Ridge just adds `lambda*I` to the matrix before inverting. That has two beautiful consequences: it **guarantees invertibility** (every eigenvalue is lifted by lambda, so no zero eigenvalues even under perfect collinearity or p > n), and it **shrinks** the solution toward zero. Ridge has a clean closed form precisely because the L2 penalty is smooth and quadratic — the loss stays a differentiable convex bowl.

### Q4. Why does Lasso have no closed-form solution?

Because the L1 penalty `sum |w_j|` is **not differentiable at zero** — it has a kink (the absolute value function's corner). You can't just set a gradient to zero and solve, because the derivative doesn't exist exactly where the interesting action (coefficients hitting zero) happens. Instead Lasso is solved by iterative methods that handle the non-smoothness: **coordinate descent** (the standard, used by sklearn/glmnet) cycles through coefficients one at a time, applying a **soft-thresholding** update to each; or LARS (least-angle regression), which traces the whole path. The non-differentiability that blocks a closed form is the *same* property that produces exact zeros — it's a feature, not a bug.

### Q5. Explain WHY L1 produces sparsity but L2 does not.

Two equivalent explanations.

**Geometric (constraint view).** Penalized regression is equivalent to minimizing the error subject to keeping the coefficient vector inside a ball. The L2 ball is a **round sphere**; the L1 ball is a **diamond with sharp corners lying on the axes**. The elliptical error contours expand until they first touch the ball — and for the diamond, the first contact is very likely at a **corner**, where one or more coordinates are exactly zero. The round sphere has no corners, so contact happens at a generic point with all coordinates nonzero.

**Gradient view.** The L1 penalty's gradient has **constant magnitude** `lambda` regardless of how small `w_j` is, so it keeps pushing a coefficient toward zero and then pins it there (the pull from the fit term must exceed lambda to move it off zero). The L2 penalty's gradient is `2*lambda*w_j`, which **shrinks as `w_j` shrinks** and vanishes at zero — so it damps coefficients but never has the "force" to hold them exactly at zero. Constant push (L1) → exact zeros; proportional push (L2) → smooth shrinkage.

### Q6. What is soft-thresholding and where does it come from?

Soft-thresholding is the single-coordinate update that solves Lasso via coordinate descent. For one coefficient, holding the others fixed, the L1-penalized least-squares subproblem has the closed-form solution:

```
w_j = sign(z_j) * max(|z_j| - lambda, 0)
```

where `z_j` is the OLS update for that coordinate. Read it literally: if the unpenalized coefficient's magnitude is below the threshold lambda, the result is **exactly zero**; otherwise it is shrunk toward zero by lambda. That `max(..., 0)` clipping is precisely where the exact zeros come from. Ridge's analogous per-coordinate update is a smooth `z_j / (1 + lambda)` — proportional shrink, never clipped to zero. Seeing these two update rules side by side is the crispest possible answer to "why L1 zeros and L2 doesn't."

### Q7. Ridge vs Lasso — when do you use each?

| | Ridge (L2) | Lasso (L1) |
|---|---|---|
| Coefficients | Shrunk, all nonzero | Many exactly zero |
| Feature selection | No | Yes (built in) |
| Closed form | Yes | No (coordinate descent) |
| Correlated features | Keeps & shares weight | Arbitrarily picks one |
| p > n | Handles well | Selects at most n features |
| Best when | Many small effects, multicollinearity | Few strong effects, want sparsity |

**Use Ridge** when you believe most features matter a little and you mainly want to tame multicollinearity and variance while keeping every feature. **Use Lasso** when you believe only a handful of features truly matter and you want an automatically selected, interpretable sparse model. When features are correlated *and* you want selection, neither is ideal alone — reach for Elastic Net.

### Q8. What is Elastic Net and what problem does it solve?

Elastic Net combines both penalties:

```
L(w) = ||y - Xw||^2 + lambda * ( alpha * sum|w_j| + (1 - alpha) * sum w_j^2 )
```

The `alpha` mixing parameter interpolates between pure Lasso (`alpha = 1`) and pure Ridge (`alpha = 0`). It solves Lasso's two big weaknesses: (1) with a **group of correlated features**, Lasso arbitrarily keeps one and zeros the rest (unstable to resampling), whereas Elastic Net's L2 component encourages correlated features to be **selected together with shared weight** (the "grouping effect"); (2) when **p > n**, pure Lasso can select at most n features, while Elastic Net can select more. You get L1's sparsity and L2's stability at once — at the cost of tuning a second hyperparameter (alpha) alongside lambda.

### Q9. What is the coefficient path?

The coefficient path is the plot of each coefficient's value as `lambda` sweeps from large (heavy penalty) down to zero (OLS). At very large lambda all coefficients are ~0; as lambda decreases they grow. For **Lasso** the path is piecewise-linear and features "switch on" one at a time as lambda drops below the threshold at which each escapes zero — so the path directly shows the *order of importance* and gives a whole family of models to choose from. For **Ridge** every coefficient is nonzero throughout and shrinks smoothly toward zero as lambda grows. Reading the path helps you pick lambda and understand which features are robust (enter early, stay) versus marginal (enter late, small). Algorithms like LARS compute the entire Lasso path efficiently.

### Q10. How do you choose lambda?

By **cross-validation**, not by eye. Sweep a grid of lambda values (typically log-spaced), and for each, estimate out-of-sample error via k-fold CV; pick the lambda minimizing CV error, or apply the **one-standard-error rule** (choose the largest lambda within 1 SE of the minimum for a simpler, more robust model).

```python
from sklearn.linear_model import RidgeCV, LassoCV
# LassoCV cross-validates lambda (called alpha in sklearn) automatically
model = LassoCV(alphas=np.logspace(-4, 1, 50), cv=5).fit(X, y)
best_lambda = model.alpha_
```

Two critical practicalities: (1) **standardize inside each CV fold** (fit the scaler on the training fold only) to avoid leakage; a `Pipeline` does this correctly. (2) Note sklearn calls the strength `alpha` for Ridge/Lasso but uses `C = 1/lambda` for logistic/SVM — opposite direction, a classic gotcha.

### Q11. Why must you standardize features before regularizing?

Because the penalty sums coefficient magnitudes, and a coefficient's magnitude depends on its feature's scale. A feature measured in millimeters gets a coefficient ~1000x larger than the same feature in meters — so the L1/L2 penalty would punish the millimeter version far more, purely because of units. Without standardization the penalty is applied **unfairly and arbitrarily** across features, and Lasso would preferentially zero out large-scale features. Standardizing (zero mean, unit variance) puts every feature on equal footing so the penalty reflects genuine importance, not measurement units. (Plain OLS is scale-invariant in its predictions, which is why this step is specific to regularized models.) Do the scaling inside the CV fold to prevent test-set statistics leaking into training.

### Q12. Do you penalize the intercept? Why not?

No — the intercept (bias) term is left out of the penalty. Penalizing it would make the solution depend on the arbitrary choice of where you center the target: shifting all y values by a constant would then change the shrinkage, which makes no sense. Leaving `b` unpenalized keeps the model **equivariant to shifts in y** — the intercept just absorbs the mean. In practice implementations center y (and the features) so the intercept can be fit separately and excluded from `sum w^2` / `sum |w|`. Same logic applies to penalized logistic regression.

### Q13. How does regularization interact with the bias-variance tradeoff?

Regularization is the cleanest concrete instance of the tradeoff. At `lambda = 0` you have OLS: lowest bias, highest variance (coefficients free to chase noise). As lambda increases, coefficients shrink toward zero: **bias rises** (the model is pulled away from the unbiased least-squares fit) while **variance falls** (coefficients become stable, insensitive to the particular training sample). At `lambda = infinity` all coefficients are zero: maximum bias (predict the mean), minimum variance. The CV-optimal lambda sits at the sweet spot where the sum of squared bias plus variance (the expected test error) is minimized. This is why regularization helps only when variance was the problem — if the model underfits, more shrinkage just adds bias and hurts.

### Q14. What is the Bayesian interpretation of Ridge and Lasso?

They are **maximum a posteriori (MAP)** estimates under different priors on the coefficients. Ridge corresponds to a **Gaussian prior** `w ~ Normal(0, tau^2)`: the log-prior is quadratic in w, which is exactly the L2 penalty, and lambda is inversely related to the prior variance (a tighter prior = stronger shrinkage). Lasso corresponds to a **Laplace (double-exponential) prior** `w ~ Laplace(0, b)`: its log-prior is `-|w|/b`, exactly the L1 penalty. The Laplace prior has a sharp peak at zero and heavier tails, which is the probabilistic reason Lasso favors solutions where many coefficients are exactly zero but a few are large. This view also explains the names: "shrinkage toward the prior mean of zero."

### Q15. In what sense is Ridge related to PCA / the SVD?

Write X via its SVD `X = U S V^T`. Ridge shrinks the least-squares solution **direction by direction along the principal axes**, and the shrinkage factor for the i-th singular direction is `s_i^2 / (s_i^2 + lambda)`. High-variance directions (large singular values `s_i`) are barely shrunk; low-variance directions (small `s_i` — exactly the ill-conditioned ones responsible for multicollinearity) are shrunk hard toward zero. So Ridge preferentially suppresses the unstable, low-variance directions — a "soft" version of principal component regression (which would hard-threshold them to zero). This is the precise mechanism behind "Ridge tames multicollinearity": it damps the near-null directions of `X^T X` that make OLS explode.

### Q16. Can you regularize without shrinking predictive power too much — what's the practical recipe?

Yes, and the recipe is standard: (1) **standardize** features (in a pipeline, fit on train folds only); (2) start with **Ridge** as a safe default when you want to keep all features and just stabilize; switch to **Lasso** or **Elastic Net** when you want a sparse, interpretable model; (3) **cross-validate lambda** over a log-spaced grid, optionally using the one-standard-error rule for a simpler model; (4) for correlated feature groups prefer **Elastic Net** to avoid Lasso's arbitrary selection; (5) inspect the **coefficient path** to sanity-check which features survive. The result trades a small, controlled amount of bias for a large reduction in variance — you rarely lose meaningful predictive power, and you often gain generalization plus (with L1) a cleaner, smaller model.

## Logistic Regression

### Summary

**What this topic covers**

Logistic regression is the linear model's crossover into classification, and the single most-asked "explain/derive it" algorithm in ML interviews. This topic owns: what it actually predicts — a **probability** via the sigmoid, not a class and not a continuous value; why it is **classification despite the name**; how it is fit — **maximum likelihood**, equivalently minimizing **log-loss** (cross-entropy), a convex objective with **no closed form** solved by gradient descent or Newton's method (IRLS); the clean **gradient `X^T(p - y)`** and its derivation; the **log-odds / logit** view that makes the decision boundary linear; the extension to **multiclass** via softmax or one-vs-rest; **regularization** (the same L1/L2 penalties from the previous topic); and interpretation via **odds ratios** plus the practical matter of **calibration**. The 16 questions run from warm-up ("what does it predict") to the derivation the interviewer really wants ("derive the gradient of the log-loss"). It builds on Linear Regression (the linear score `w·x + b`) and Regularized Linear Models (the penalties); the cross-cutting classification metrics (precision/recall/ROC) live in ML Fundamentals.

**Mental model**

Take the linear model's raw score `z = w·x + b`, which ranges over all reals, and squash it through the **sigmoid** `p = 1/(1 + exp(-z))` into `(0, 1)` so it reads as a probability of the positive class. The model is "linear in the log-odds": the log of the odds `p/(1-p)` equals `w·x + b`, so a one-unit change in a feature adds a fixed amount to the log-odds (multiplies the odds by a constant) — that is the interpretable heart of it. The decision boundary `p = 0.5` is exactly `w·x + b = 0`, a **hyperplane** — so despite the S-shaped probability curve, logistic regression is a **linear classifier**. Training asks: choose w, b so that the predicted probabilities make the observed labels as likely as possible (maximum likelihood). Because the negative log-likelihood (log-loss) is convex in the parameters, there is a single global optimum and gradient descent reliably finds it. The whole model is "linear score → sigmoid → probability → threshold."

**Key terms**

- **Sigmoid (logistic function)** — `sigma(z) = 1/(1 + exp(-z))`; maps reals to `(0,1)`; has the tidy derivative `sigma'(z) = sigma(z)(1 - sigma(z))`.
- **Logit / log-odds** — `log(p/(1-p)) = w·x + b`; the inverse of the sigmoid; linear in the features.
- **Odds** — `p/(1-p)`; `exp(w_j)` is the odds ratio, the multiplicative effect on odds per unit of feature j.
- **Log-loss / cross-entropy** — `-sum[ y*log(p) + (1-y)*log(1-p) ]`; the loss being minimized; equals negative log-likelihood.
- **Maximum likelihood (MLE)** — fit by maximizing the probability of the observed labels; equivalent to minimizing log-loss.
- **Decision boundary** — `w·x + b = 0` (where p = 0.5); a hyperplane → linear classifier.
- **Softmax** — the multiclass generalization; `p_k = exp(z_k)/sum_j exp(z_j)`.
- **One-vs-rest (OvR)** — multiclass by training one binary classifier per class.
- **IRLS / Newton's method** — second-order optimizer (iteratively reweighted least squares) for logistic regression.
- **Calibration** — whether predicted probabilities match observed frequencies; logistic regression is usually well-calibrated.
- **C (sklearn)** — inverse regularization strength, `C = 1/lambda`; smaller C = stronger penalty.

**Why interviewers ask this**

It is the perfect interview algorithm because a candidate can engage at every level. The warm-up ("what does it predict?") filters people who think the "regression" in the name means it outputs continuous values or that it outputs a class directly rather than a probability. The core ("how is it fit?") tests whether you know it is maximum likelihood / log-loss, convex, and has **no closed form** — a surprisingly common miss. The senior signal is **deriving the gradient** `X^T(p - y)` from the log-likelihood and noting it is the *identical form* to linear regression's gradient (with p replacing the linear prediction) — that structural echo is a "do you really understand this" flag. Beyond the maths, interviewers probe interpretation (odds ratios, not probabilities directly), the linear decision boundary, why you'd pick it over an SVM or a tree, regularization, and calibration. Few models reward depth this cleanly.

**Common confusions**

- "Logistic regression is a regression algorithm" — it is a **classification** algorithm. It regresses the log-odds, then classifies by thresholding the probability.
- "It outputs a class" — it outputs a **probability**; the class comes from thresholding (default 0.5, but you tune the threshold for imbalanced costs).
- "It has a closed-form solution like linear regression" — no; the log-loss is convex but transcendental, so you need iterative optimization (GD or Newton-IRLS).
- "The coefficient is the change in probability" — no; `w_j` is the change in **log-odds**; `exp(w_j)` is the **odds ratio**. The probability change is non-linear (depends where on the S-curve you are).
- "The decision boundary is non-linear because the sigmoid is curved" — the boundary is where `p = 0.5`, i.e. `w·x + b = 0`, which is **linear**. The curve is in the probability, not the boundary.
- "You minimize MSE" — you minimize **log-loss**; MSE on top of a sigmoid is non-convex and gives vanishing gradients, so it is avoided.

**What follows from this topic**

Logistic regression is the reference point for every other classifier. Swap its hinge-free log-loss for **hinge loss** and you get the linear **SVM** (both are linear classifiers with L2 regularization; the comparison is a favorite interview question). Its log-loss and softmax output layer are exactly what sits atop a **neural network** for classification — logistic regression *is* a single-neuron net. Its L1/L2 penalties come straight from **Regularized Linear Models**. And its probability outputs are the natural input to the calibration and threshold/metric discussion (ROC, precision-recall) owned by the ML Fundamentals primer. Master this and most of classification is a variation on a theme you already know.

### Q1. What does logistic regression predict?

It predicts the **probability** that an example belongs to the positive class:

```
z = w·x + b
p = P(y = 1 | x) = sigmoid(z) = 1 / (1 + exp(-z))
```

The linear score `z` can be any real number; the sigmoid squashes it into `(0, 1)` so it reads as a probability. To get a class label you threshold — predict class 1 if `p >= 0.5` (equivalently `z >= 0`), else class 0. So the raw output is a calibrated probability, not a hard label and not a continuous target — this is **classification**. The name "regression" is historical: it regresses the log-odds of the class onto the features.

### Q2. Why is it called "regression" if it does classification?

Because it **regresses the log-odds** (the logit of the class probability) as a linear function of the features:

```
log( p / (1 - p) ) = w·x + b
```

The right-hand side is an ordinary linear regression — a linear combination of features — but the thing being predicted is the log-odds of the positive class, not a continuous outcome. You then map that back through the sigmoid to a probability and threshold to a class. So mechanically it is linear regression on a transformed (log-odds) target, which is where the "regression" comes from; functionally it is a classifier. It is a generalized linear model with a logit link.

### Q3. What is the sigmoid function and why use it?

```
sigmoid(z) = 1 / (1 + exp(-z))
```

It maps the whole real line into `(0, 1)`, is smooth and monotonic, gives 0.5 at z = 0, and saturates toward 0 and 1 at the extremes — exactly the shape you want to turn an unbounded linear score into a probability. Two properties make it the natural choice: (1) its inverse is the **logit** `log(p/(1-p))`, so a linear model in the features becomes a linear model in the log-odds — clean interpretation; (2) it has the tidy derivative

```
sigmoid'(z) = sigmoid(z) * (1 - sigmoid(z))
```

which makes the log-loss gradient collapse to the elegant `p - y` form. It is also the maximum-entropy / canonical link for the Bernoulli distribution, which is the principled reason it appears.

### Q4. How is logistic regression trained — what's the objective?

By **maximum likelihood**: choose w, b to maximize the probability of the observed labels. For Bernoulli labels the likelihood of one example is `p^y * (1-p)^(1-y)`. Taking the negative log over all examples gives the **log-loss** (binary cross-entropy) to minimize:

```
L(w,b) = -sum_i [ y_i * log(p_i) + (1 - y_i) * log(1 - p_i) ]
```

Maximizing likelihood is exactly minimizing this. The objective is **convex** in (w, b), so there is a single global optimum — but it is **not** solvable in closed form (unlike linear regression), because the sigmoid makes the stationary-point equations transcendental. So you optimize iteratively with gradient descent or Newton's method (IRLS).

### Q5. Derive the gradient of the log-loss.

Let `p_i = sigmoid(z_i)`, `z_i = w·x_i + b`. The loss for one example is `-[y*log(p) + (1-y)*log(1-p)]`. Differentiate with respect to z using `dp/dz = p(1-p)`:

```
dL/dp = -( y/p - (1-y)/(1-p) ) = (p - y) / (p(1-p))
dL/dz = dL/dp * dp/dz = (p - y)/(p(1-p)) * p(1-p) = p - y
```

The `p(1-p)` terms cancel — that is the magic of pairing sigmoid with log-loss. Then by the chain rule `dz/dw = x`, so for the full dataset:

```
dL/dw = sum_i (p_i - y_i) * x_i = X^T (p - y)
dL/db = sum_i (p_i - y_i)
```

The gradient is `X^T(p - y)` — the same form as linear regression's `X^T(yhat - y)`, with the predicted probability p in place of the linear prediction. This is why it is such a clean, favorite derivation.

### Q6. Why not just use mean squared error as the loss?

Two reasons. (1) **Non-convexity** — wrapping MSE `sum(y - sigmoid(z))^2` around the sigmoid gives a non-convex loss surface with local minima, so gradient descent can get stuck; log-loss is convex and has a unique global optimum. (2) **Vanishing gradients** — with MSE the gradient contains an extra `sigmoid'(z) = p(1-p)` factor, which is near zero when the model is confidently wrong (p near 0 or 1), so a badly-misclassified example produces almost no gradient and learning stalls. With log-loss those terms cancel to give `p - y`, so a confident mistake produces a large gradient and gets corrected fast. Log-loss is also the principled choice — it is the negative log-likelihood of the Bernoulli model.

### Q7. What is the gradient descent update rule for logistic regression?

Using the gradient `X^T(p - y)`, the batch update with learning rate eta is:

```
p = sigmoid(X @ w + b)
w := w - eta * X^T (p - y)
b := b - eta * sum(p - y)
```

```python
w = np.zeros(p_dim); b = 0.0
for _ in range(epochs):
    z = X @ w + b
    p = 1 / (1 + np.exp(-z))     # predicted probabilities
    grad_w = X.T @ (p - y)
    grad_b = (p - y).sum()
    w -= eta * grad_w
    b -= eta * grad_b
```

Because the loss is convex, this converges to the global optimum for a small enough eta. For faster convergence you can use Newton's method (below) or off-the-shelf solvers like L-BFGS (sklearn's default). Standardize features first so the loss surface is well-conditioned.

### Q8. What is Newton's method / IRLS here, and why use it?

Newton's method uses second-order (curvature) information, updating with the inverse Hessian:

```
w := w - H^-1 * grad,   where H = X^T W X,  W = diag(p_i (1 - p_i))
```

Each step turns out to be a **weighted least squares** solve, so the algorithm is called **IRLS (Iteratively Reweighted Least Squares)** — you repeatedly solve a reweighted linear regression, the weights being `p_i(1-p_i)`. Compared to plain gradient descent it converges in far fewer iterations (quadratically near the optimum) and needs no learning-rate tuning — great when p is modest so the `O(p^3)` Hessian solve per step is cheap. For large p or huge n, first-order methods (SGD, L-BFGS) scale better. sklearn's `lbfgs`, `newton-cg`, and `liblinear` solvers are the practical incarnations.

### Q9. What is the log-odds / logit interpretation, and why is the boundary linear?

Invert the sigmoid: `p = sigmoid(z)` implies `log(p/(1-p)) = z = w·x + b`. So the model says the **log-odds are linear in the features**. Consequences: (1) a one-unit increase in feature j adds `w_j` to the log-odds and multiplies the odds by `exp(w_j)` (the odds ratio) — a constant multiplicative effect, the clean interpretation. (2) The decision boundary is the set where `p = 0.5`, i.e. `p/(1-p) = 1`, i.e. `log-odds = 0`, i.e. `w·x + b = 0` — a **hyperplane**. So even though the probability curves smoothly, the classifier partitions space with a flat boundary: logistic regression is a **linear classifier**. It can only separate classes that are (roughly) linearly separable in the given feature space; you add non-linear features to get curved boundaries.

### Q10. How do you interpret the coefficients?

`w_j` is the change in **log-odds** of the positive class per one-unit increase in feature j, holding others fixed. More intuitively, `exp(w_j)` is the **odds ratio**: it multiplies the odds of the positive outcome. For example `w_j = 0.7` gives `exp(0.7) ~ 2`, so a one-unit increase in feature j roughly **doubles the odds**. Sign tells direction (positive w pushes toward class 1). Note the effect on *probability* is non-linear — the same odds ratio moves probability a lot near p = 0.5 and little near 0 or 1, because of the S-curve. As with linear models, coefficients are only interpretable "holding others fixed" if features aren't collinear, and you should standardize before comparing magnitudes. This odds-ratio interpretability is a major reason logistic regression dominates in medicine, credit scoring, and other regulated domains.

### Q11. How does logistic regression handle multiclass problems?

Two standard approaches:

**Softmax (multinomial) regression** — the direct generalization. Have one weight vector per class, compute a score `z_k = w_k·x + b_k`, and normalize with softmax:

```
p_k = exp(z_k) / sum_j exp(z_j)
```

Train by minimizing multiclass cross-entropy. This models all classes jointly and is the principled choice (sklearn's `multi_class='multinomial'`).

**One-vs-Rest (OvR)** — train K independent binary logistic classifiers, each "class k vs everything else," and at predict time pick the class with the highest probability. Simpler and parallelizable but the probabilities aren't jointly normalized and can be less calibrated.

Softmax is generally preferred when classes are mutually exclusive; OvR is a fine, cheap default and historically sklearn's.

### Q12. How do you regularize logistic regression?

Add the same L1/L2 penalties from linear models to the log-loss:

```
L2:  minimize  log-loss + lambda * sum(w_j^2)
L1:  minimize  log-loss + lambda * sum(|w_j|)
```

L2 shrinks coefficients smoothly (stabilizes, handles multicollinearity, prevents weights blowing up on separable data); L1 produces sparse models with feature selection; Elastic Net mixes both. Regularization is especially important here because on **perfectly separable** data the unpenalized MLE diverges — the weights run to infinity chasing ever-more-confident probabilities — and a penalty keeps them finite. Watch the sklearn convention: strength is parameterized as **`C = 1/lambda`**, so *smaller C means stronger* regularization (the opposite direction to Ridge/Lasso's `alpha`). The intercept is not penalized. Standardize features first.

### Q13. What is calibration, and is logistic regression calibrated?

A classifier is **calibrated** if its predicted probabilities match observed frequencies — among examples it says are 70% likely positive, about 70% actually are. Logistic regression is usually **well-calibrated out of the box** because it is trained by maximum likelihood to produce honest Bernoulli probabilities (log-loss is a proper scoring rule) — this is a genuine advantage over models like SVMs (whose scores aren't probabilities) or naive Bayes (over-confident due to its independence assumption), which need post-hoc calibration (Platt scaling, isotonic regression). Caveats: heavy regularization, class imbalance, or misspecification can degrade calibration, so you still check with a **reliability diagram** and metrics like the Brier score or log-loss. When you need trustworthy probabilities (risk scoring, expected-value decisions), logistic regression's calibration is a strong reason to prefer it.

### Q14. Logistic regression vs linear SVM — compare them.

| | Logistic regression | Linear SVM |
|---|---|---|
| Loss | Log-loss (cross-entropy) | Hinge loss |
| Output | Calibrated probability | Signed distance (not a probability) |
| Boundary | Linear hyperplane | Linear hyperplane (max-margin) |
| Fit driven by | All points (weighted) | Only support vectors near the margin |
| Regularization | L1/L2 penalty | `0.5*||w||^2` (L2), C trades margin vs error |
| Best when | Want probabilities, interpretability | Want max-margin separation, high-dim |

Both are linear classifiers with L2 regularization; they differ mainly in the loss. Log-loss cares about every point's probability (points far on the correct side still nudge the boundary a little), while hinge loss ignores points comfortably beyond the margin (only **support vectors** matter). Choose logistic regression when you need **calibrated probabilities** and interpretability; choose SVM when you want a **maximum-margin** boundary or plan to use the kernel trick for non-linearity. On many linear problems their accuracy is similar.

### Q15. What are the assumptions and limitations of logistic regression?

Assumptions: (1) the **log-odds are linear** in the features (the big one — curved relationships need engineered/interaction features); (2) observations are **independent**; (3) little **multicollinearity** (same coefficient-instability issue as linear regression); (4) reasonably large sample per feature. Limitations: it can only draw **linear decision boundaries** in the given feature space, so it underfits genuinely non-linear problems unless you add basis functions; it is sensitive to **outliers in feature space** and to **complete separation** (weights diverge without regularization); and it doesn't capture feature interactions automatically (unlike trees). It also assumes you've handled scaling if regularized. When these bite, you move to trees/boosting (non-linear, interaction-aware) or kernel SVMs — trading interpretability for flexibility.

### Q16. When would you choose logistic regression as your model?

Choose it when: you need **interpretable** results (odds ratios you can explain to a regulator or clinician), you need **calibrated probabilities** for downstream expected-value decisions or thresholding, the signal is roughly **linear in the log-odds**, you have limited data (its strong bias resists overfitting), or you want a **fast, robust baseline** to benchmark fancier models against. It is the default first classifier on tabular data for exactly the reasons linear regression is the default first regressor — transparent, cheap, well-understood, hard to badly overfit. Move to gradient-boosted trees when non-linear interactions dominate and accuracy outweighs interpretability, or to kernel SVMs for max-margin separation in high dimensions. Even then, logistic regression is the baseline that tells you whether the fancy model is actually earning its complexity.
## Naive Bayes

### Summary

**What this topic covers**

Naive Bayes is the canonical **generative, probabilistic classifier** — it models how the data was produced and inverts that model with Bayes' rule to score classes. This topic covers the mechanics that make it work and the assumption that makes it fast: **Bayes' rule** as the scoring engine, the **conditional-independence ("naive") assumption**, the three practical variants (**Gaussian**, **Multinomial**, **Bernoulli**), **Laplace / additive smoothing** to survive unseen features, and the **log-space** trick that keeps a product of thousands of tiny probabilities from underflowing to zero. It also covers *why* a model built on a blatantly false assumption remains a strong, hard-to-beat baseline for text and spam. The 16 questions here go from "state Bayes' rule" up to "derive why the independence assumption barely hurts classification accuracy" and "when does Naive Bayes beat logistic regression." This is the **generative** counterpart to the discriminative linear models; contrast it with Logistic Regression throughout.

**Mental model**

Naive Bayes asks a different question than a discriminative model. Instead of learning a boundary that separates classes (logistic regression), it learns **what each class looks like** — a little probabilistic story per class — then, given a new point, asks "which class's story most likely generated this?" Formally it picks the class y maximizing the **posterior** P(y | x). By Bayes' rule that posterior is proportional to `P(y) * P(x | y)`: the class **prior** times the **likelihood** of the features given the class. The full joint `P(x | y)` over all features is intractable to estimate, so Naive Bayes makes the wild simplifying bet that **features are conditionally independent given the class**, factoring it into `prod_i P(x_i | y)`. That turns an impossible joint-density estimation into counting one feature at a time. Training is a single pass tallying frequencies (or fitting per-feature Gaussians); prediction multiplies those factors. No iterative optimization, no gradient — closed-form maximum-likelihood estimates.

**Key terms**

- **Prior `P(y)`** — how common each class is before seeing any features; estimated as the class frequency.
- **Likelihood `P(x_i | y)`** — probability of feature value x_i under class y; the per-feature model you actually fit.
- **Posterior `P(y | x)`** — the quantity you want; what you rank classes by.
- **Evidence `P(x)`** — the normalizer; constant across classes, so it drops out of the argmax.
- **Conditional independence** — the naive assumption: `P(x | y) = prod_i P(x_i | y)`.
- **MAP decision** — pick the class with maximum posterior: `argmax_y P(y) * prod_i P(x_i | y)`.
- **Gaussian NB** — continuous features; each `P(x_i | y)` is a normal with a per-class mean/variance.
- **Multinomial NB** — count/frequency features (word counts); likelihood from token frequencies.
- **Bernoulli NB** — binary presence/absence features; explicitly models the absence of a feature.
- **Laplace / additive smoothing** — add alpha to every count so no probability is ever exactly zero.
- **Log-space** — sum log-probabilities instead of multiplying probabilities to avoid numeric underflow.
- **Generative model** — models `P(x, y)` (how data is generated), vs a discriminative model of `P(y | x)`.

**Why interviewers ask this**

Naive Bayes is the cheapest way to test whether a candidate genuinely understands **probability and Bayes' rule**, not just sklearn calls. A junior recites "it assumes independence." A senior can (1) write Bayes' rule and explain why the evidence term vanishes in the argmax, (2) explain why an assumption that is *obviously false* ("free" and "money" are not independent in spam) still yields a good *classifier* — because you only need the argmax ranking to be right, not the probabilities to be calibrated, (3) pick the correct variant for the data type, and (4) explain why you must smooth and why you work in log-space. It also probes the **generative-vs-discriminative** distinction, a favorite lens for comparing it against logistic regression. Getting the smoothing and log-space answers right signals someone who has actually shipped a text classifier, not just read about one.

**Common confusions**

- "The independence assumption must hold or it breaks" — false. It's routinely violated and NB still classifies well; it only wrecks the *calibration* of the probabilities, not usually the argmax.
- "Naive Bayes outputs reliable probabilities" — no. Because dependent features get double-counted, posteriors are pushed toward 0 or 1 (overconfident). Use it to *rank*, not as a calibrated probability.
- "Gaussian vs Multinomial doesn't matter" — it matters a lot; using Gaussian NB on word counts or Multinomial on continuous data is a modeling error.
- "It needs lots of data" — the opposite; NB's high bias makes it shine with *little* data and it converges to its (asymptotically worse) ceiling faster than logistic regression.
- "Smoothing is optional" — without it, one unseen feature value drives the whole product to zero and vetoes the class regardless of all other evidence.
- "It learns a decision boundary like logistic regression" — Gaussian NB with shared variance actually yields a linear boundary, but it *arrives* there generatively, by modeling each class, not by optimizing a discriminative loss.

**What follows from this topic**

Naive Bayes is the generative bookend to **Logistic Regression** (discriminative) — the two are a classic "same linear boundary, opposite philosophies" comparison and share the softmax/log-odds machinery. Its speed and text strength make it the baseline you beat with heavier models like **SVMs** (with kernels) or **gradient-boosted trees**. The probability-calibration weakness previews the calibration discussion in the ML Fundamentals primer. And the "high bias, low variance, converges fast" profile is a concrete instance of the bias-variance tradeoff that governs every algorithm in this primer.

### Q1. State Bayes' rule and show how Naive Bayes uses it to classify.

Bayes' rule relates the posterior to the likelihood and prior:

```text
P(y | x) = P(y) * P(x | y) / P(x)
```

To classify, you pick the class with the highest posterior. The evidence `P(x)` is the same for every class, so it drops out of the argmax:

```text
yhat = argmax_y  P(y) * P(x | y)
```

The remaining problem is `P(x | y)` — the joint likelihood of all features given the class — which is intractable to estimate directly. Naive Bayes applies the conditional-independence assumption to factor it:

```text
yhat = argmax_y  P(y) * prod_i P(x_i | y)
```

Now every term is a simple one-feature quantity you can estimate by counting (or by fitting a per-feature distribution). Training = estimate `P(y)` and each `P(x_i | y)`; prediction = plug in and take the argmax.

### Q2. What is the "naive" conditional-independence assumption, and why is it usually false?

The assumption is that, **given the class label**, every feature is independent of every other:

```text
P(x_1, x_2, ..., x_d | y) = prod_i P(x_i | y)
```

It's almost always false. In spam, the words "free" and "prize" co-occur far more than independence predicts; in medical data, symptoms are correlated. The point isn't that the assumption is true — it's that it makes an otherwise impossible density estimation (a joint over d features needs exponentially many parameters) into d separate one-dimensional estimates, each requiring only a handful of counts. You trade a huge amount of statistical realism for tractability and speed, and empirically the trade pays off for classification.

### Q3. If the independence assumption is clearly wrong, why does Naive Bayes still classify well?

Because **classification only needs the argmax to be correct, not the probabilities**. Even when correlated features cause NB to mis-estimate the *magnitude* of the posteriors (double-counting evidence pushes them toward 0 or 1), the *ranking* of classes is often still right — the true class usually still comes out on top. Zhang's 2004 analysis showed the dependencies frequently cancel out across classes, leaving the decision unchanged. So NB's probabilities are poorly calibrated (overconfident), but its **decisions** are robust. If you needed the probabilities themselves — for thresholding, expected-value decisions, or ranking by confidence — that overconfidence would matter and you'd calibrate or switch models.

### Q4. Compare the Gaussian, Multinomial, and Bernoulli variants. When do you use each?

They differ only in how `P(x_i | y)` is modeled:

| Variant | Feature type | Likelihood model | Typical use |
|---|---|---|---|
| Gaussian | Continuous | Normal per (feature, class): fit mean + variance | Numeric features, e.g. sensor/measurement data |
| Multinomial | Counts / frequencies | Token frequency per class | Text with word counts or TF-IDF |
| Bernoulli | Binary (present/absent) | Per-feature Bernoulli; models absence explicitly | Short text, presence-of-word features |

Gaussian NB models each feature as a bell curve within each class. Multinomial models documents as draws from a per-class word distribution and cares about *how many* times a token appears. Bernoulli only cares *whether* a token appears and, crucially, penalizes the **absence** of expected tokens — which can help on short documents. Choosing the wrong variant for the data type is a modeling error, not a tuning detail.

### Q5. Derive the Gaussian Naive Bayes likelihood for a continuous feature.

For Gaussian NB you assume each feature, within a class, follows a normal distribution. During training you compute, for each class y and feature i, the sample mean `mu_iy` and variance `var_iy` from the training rows of that class:

```text
P(x_i | y) = (1 / sqrt(2*pi*var_iy)) * exp( -(x_i - mu_iy)^2 / (2*var_iy) )
```

Prediction plugs the new feature value into this density for each class and multiplies across features (in log-space):

```python
import numpy as np

def log_gaussian(x, mu, var):
    # log N(x; mu, var), summed per class over features
    return -0.5 * (np.log(2 * np.pi * var) + (x - mu) ** 2 / var)

# score(class) = log P(y) + sum_i log_gaussian(x_i, mu_iy, var_iy)
```

With a shared variance across classes this reduces to a linear decision boundary; with per-class variances it becomes quadratic.

### Q6. What is Laplace (additive) smoothing and what disaster does it prevent?

Consider Multinomial NB. If a word never appeared in the spam training set, its estimated `P(word | spam) = 0`. Since the score is a **product** of per-feature probabilities, that single zero drives the entire product to zero — one unseen word can veto the spam class no matter how spammy everything else is. **Additive smoothing** fixes this by adding a pseudocount alpha to every count:

```text
P(x_i | y) = (count(x_i, y) + alpha) / (count(y) + alpha * V)
```

where V is the vocabulary size (number of possible feature values). `alpha = 1` is Laplace smoothing; smaller alpha (Lidstone) smooths less. It guarantees no probability is ever exactly zero, so a single novel feature can't wipe out a class.

### Q7. Why does Naive Bayes compute everything in log-space?

Because you're multiplying many probabilities, each well below 1. A 1,000-word document multiplies 1,000 factors like 0.001 — the product underflows to 0.0 in floating point, and every class collapses to zero, destroying the comparison. Taking logs converts the product to a **sum**, which stays in a safe numeric range:

```text
log P(y | x) = log P(y) + sum_i log P(x_i | y)   (+ const)
```

argmax is preserved because log is monotonic. So you accumulate log-priors plus log-likelihoods and compare those sums. It's a numerical-stability necessity, not an approximation.

### Q8. Why is Naive Bayes such a strong baseline for text classification and spam?

Several reasons align for text. (1) **High dimensionality is free** — NB estimates one parameter per (word, class) independently, so tens of thousands of features cost nothing and don't cause overfitting the way they would for a model estimating interactions. (2) **Tiny training cost** — a single count pass, trivially updatable online as new emails arrive. (3) **Works with little labeled data** — its high bias means it needs few examples to reach its ceiling. (4) **The independence assumption is least harmful for the argmax**, as covered above. The result is a classifier you can train in milliseconds that is genuinely hard to beat by a meaningful margin on bag-of-words spam/topic tasks — which is exactly why it's the baseline you must justify beating.

### Q9. Naive Bayes vs logistic regression — generative vs discriminative.

They model the *same* problem from opposite ends:

| | Naive Bayes | Logistic Regression |
|---|---|---|
| Models | `P(x, y)` — generative | `P(y | x)` — discriminative |
| Learns | Per-class feature distributions | A decision boundary directly |
| Assumes feature independence | Yes (baked in) | No — handles correlated features |
| Training | Counting, closed form | Iterative (gradient descent) |
| Small data | Strong (high bias, converges fast) | Weaker until more data |
| Asymptotic accuracy | Lower (biased by independence) | Higher (fewer assumptions) |
| Calibrated probabilities | No (overconfident) | Yes |

Ng and Jordan's classic result: NB has higher asymptotic error but approaches it with far fewer examples, so it **wins on small datasets and loses on large ones**. With enough data, prefer logistic regression; with scarce data or streaming updates, prefer NB.

### Q10. What is the difference between a generative and a discriminative classifier?

A **generative** model learns the full joint distribution `P(x, y)` — effectively "how is the data generated for each class?" — and derives `P(y | x)` from it via Bayes' rule (Naive Bayes, GMMs, LDA). Because it models `P(x | y)`, it can also *generate* synthetic data and naturally handle missing features. A **discriminative** model learns `P(y | x)` (or just the boundary) directly, spending all its capacity on the classification task rather than on modeling the input distribution (logistic regression, SVM, most neural nets). Discriminative models usually classify better with enough data because they don't waste effort modeling `P(x)`; generative models can be better with little data and offer the side benefits of a full probabilistic story.

### Q11. What is the training and prediction complexity of Naive Bayes?

Let n = training examples, d = features, c = classes. **Training is O(n * d)** — a single pass tallying counts (or accumulating sums for Gaussian means/variances), which is why it's essentially instant and trivially parallel/online. Space is **O(c * d)** to store the per-class, per-feature parameters. **Prediction is O(c * d)** per example — for each class, sum d log-likelihoods. There is no iterative optimization, no matrix inversion, no hyperparameter search beyond the smoothing constant. This linear-in-data, no-iteration profile is the single biggest reason it's used as a first-pass baseline and in latency-sensitive, high-volume pipelines like spam filtering.

### Q12. Does Naive Bayes require feature scaling? Does it handle irrelevant or correlated features?

**Scaling:** Multinomial and Bernoulli NB use counts/binary values and don't need scaling. Gaussian NB fits a per-feature variance, so it's scale-invariant too — it adapts to each feature's spread automatically. So, unlike kNN or SVM, NB doesn't require standardization. **Irrelevant features:** an uninformative feature contributes roughly the same `P(x_i | y)` to every class, so it cancels in the argmax and does little harm. **Correlated features** are the real weakness: because independence is assumed, two correlated features get their shared evidence counted twice, inflating confidence and skewing the posterior. That double-counting is what wrecks calibration, though it often leaves the argmax intact.

### Q13. How does Bernoulli Naive Bayes differ from Multinomial, concretely?

Multinomial NB models **counts** — a document is a bag of tokens and repeated words add evidence; it ignores words that don't appear. Bernoulli NB models **binary presence** — each vocabulary word is a yes/no feature — and it explicitly includes a term for words that are **absent**:

```text
P(x | y) = prod_i [ p_iy^x_i * (1 - p_iy)^(1 - x_i) ]
```

where `x_i` is 1 if word i is present. The `(1 - p_iy)` factor means a document is penalized for *not* containing words the class usually has. Bernoulli often wins on **short** texts (tweets, subject lines) where absence is informative; Multinomial wins on longer documents where frequency carries signal.

### Q14. Can Naive Bayes learn a non-linear decision boundary?

Gaussian NB with **per-class variances** produces a **quadratic** boundary (the variance terms don't cancel), so yes, it can be non-linear. Gaussian NB with a **shared** variance collapses to a linear boundary. Multinomial and Bernoulli NB with their log-likelihoods also yield linear boundaries in the feature (count) space. So NB is not restricted to linear boundaries, but its flexibility is limited and structured — it comes from the per-class distribution shapes, not from an expressive hypothesis class. If you need genuinely flexible non-linear boundaries, that's the domain of kernel SVMs, trees, and boosting, not Naive Bayes.

### Q15. When would you NOT use Naive Bayes?

Avoid it when (1) **features are strongly correlated and you need calibrated probabilities** — the double-counting makes the posteriors untrustworthy for thresholding or expected-value decisions; (2) **you have abundant data and want maximum accuracy** — a discriminative model (logistic regression, boosting) will overtake it; (3) **feature interactions carry the signal** — NB can't represent "A and B together mean spam but neither alone does," because it treats features independently; (4) **continuous features are wildly non-Gaussian** and you're stuck with Gaussian NB (bin them or switch variants/models). Its sweet spot is the opposite: high-dimensional, sparse, low-data, latency-sensitive classification like text and spam where you want a fast, decent baseline immediately.

### Q16. How would you turn Naive Bayes into an online / streaming classifier?

Because training is just accumulating sufficient statistics (counts for Multinomial/Bernoulli; running means and variances for Gaussian), you never need to revisit old data — you update the tallies incrementally as each example arrives:

```python
from sklearn.naive_bayes import MultinomialNB

clf = MultinomialNB()
# first call must declare all classes up front
clf.partial_fit(X_batch1, y_batch1, classes=[0, 1])
# subsequent mini-batches update the counts in place
clf.partial_fit(X_batch2, y_batch2)
```

This makes NB ideal for **evolving streams** like spam, where the vocabulary and class balance drift and you want the model to adapt continuously without a full retrain. Contrast with logistic regression, which also supports `partial_fit` via SGD but requires a learning-rate schedule; NB's update is a parameter-free count bump.

## k-Nearest Neighbors

### Summary

**What this topic covers**

k-Nearest Neighbors (kNN) is the purest **instance-based, lazy learner** — it does no training at all and defers every computation to prediction time. This topic covers what that means and what it costs: the **predict-time majority-vote / mean-of-neighbors** rule, the choice of **distance metric** (Euclidean, Manhattan, cosine), how **k trades bias against variance**, why **feature scaling is mandatory** (and what happens without it), the **curse of dimensionality** that quietly breaks kNN in high dimensions, and the data structures (**KD-tree, ball-tree, approximate NN**) that rescue its brutal O(n·d)-per-query cost. The 16 questions run from "what does kNN predict" up to "why does every point become equidistant in high dimensions" and "when does kNN beat a parametric model." kNN is the algorithm that makes **bias-variance**, **distance metrics**, and **scaling** concrete, and it's the natural foil to model-based classifiers throughout this primer.

**Mental model**

kNN's entire philosophy is "**similar inputs have similar outputs**, so to predict a new point, look at the training points nearest to it and copy their answer." There is no model, no weights, no learned boundary — the training set *is* the model. To classify, you compute the distance from the query to every stored point, take the k closest, and return their **majority class**; to regress, return their **mean**. The decision boundary is implicit and can be arbitrarily wiggly — it's a Voronoi-like partition induced by the data. The single knob k controls how many neighbors get a vote: k=1 memorizes the training set exactly (a jagged boundary, zero training error, high variance); large k averages over a wide neighborhood (a smooth boundary, more bias). Because distance is the whole game, the geometry of your feature space — its scale and its dimensionality — determines whether "nearest" means anything at all.

**Key terms**

- **Lazy / instance-based learning** — no training phase; the algorithm stores data and works entirely at query time.
- **k** — the number of nearest neighbors that vote; the primary hyperparameter.
- **Distance metric** — how "nearness" is measured; Euclidean (L2), Manhattan (L1), cosine, Minkowski.
- **Euclidean distance** — `sqrt(sum_i (a_i - b_i)^2)`; straight-line distance, the default.
- **Manhattan distance** — `sum_i |a_i - b_i|`; L1, more robust to outliers, better in some high-dim settings.
- **Cosine similarity** — angle between vectors; used when magnitude is irrelevant (text, embeddings).
- **Majority vote** — classification output: the most common class among the k neighbors.
- **Distance weighting** — weight each neighbor's vote by 1/distance so closer points count more.
- **Curse of dimensionality** — in high dimensions distances concentrate and "nearest" loses meaning.
- **KD-tree / ball-tree** — space-partitioning structures that speed up neighbor search in low-to-moderate dimensions.
- **Approximate NN (ANN)** — trade exactness for speed (HNSW, LSH) to scale to millions of points.
- **Decision boundary** — for kNN, an implicit, non-parametric, piecewise boundary induced by the data.

**Why interviewers ask this**

kNN is deceptively simple, which is why it's a great probe: the algorithm is one sentence, but the *consequences* are deep. A junior says "find the k closest points and vote." A senior explains (1) that k directly parameterizes the **bias-variance tradeoff** — and can derive which direction is which — (2) *why* scaling is non-negotiable (an unscaled large-range feature dominates the distance and silently becomes the only feature), (3) the **curse of dimensionality**, with the intuition that in high dimensions all pairwise distances converge so "nearest" is meaningless, and (4) the **cost model** — free training, expensive prediction — and how KD-trees or ANN address it. It's also a clean way to contrast **lazy vs eager** learning and **non-parametric vs parametric** models. Whiffing on scaling or the curse of dimensionality signals someone who has used the sklearn class but never reasoned about the geometry.

**Common confusions**

- "kNN has a training phase" — essentially none; `fit` just stores the data (or builds an index). All the work is at predict time.
- "Scaling is a nice-to-have" — no; without it the feature with the largest numeric range dominates the distance and the others are effectively ignored.
- "Bigger k is always better / smaller k is always better" — neither; k is a bias-variance dial. k=1 overfits, k=n underfits to the majority class.
- "kNN works fine in high dimensions" — it degrades badly; distance concentration makes all neighbors roughly equidistant.
- "k should be small so it's precise" — small k is *low bias but high variance* (noisy); precision isn't the framing, variance is.
- "kNN's cost is in training" — inverted; training is O(1)-ish, prediction is the expensive part (O(n·d) naively per query).
- "The distance metric doesn't matter much" — it defines the whole geometry; cosine vs Euclidean can flip results entirely on text/embeddings.

**What follows from this topic**

kNN is the concrete instance of **non-parametric, lazy learning** to contrast with everything parametric and eager (linear/logistic regression, trees, SVMs) elsewhere in this primer. Its k-vs-smoothness behavior is the cleanest illustration of the **bias-variance tradeoff** that governs model complexity everywhere. The scaling requirement it shares with **SVMs** (both are distance/geometry-based) — a recurring "which algorithms need standardization" theme. The curse of dimensionality motivates the **dimensionality-reduction** topics (PCA, t-SNE, UMAP). And its distance machinery is the same machinery underneath **k-means** clustering, so this topic sets up that one directly.

### Q1. What does kNN predict, and how — for classification and regression?

kNN makes a prediction by looking at the k training points closest to the query in feature space. For **classification**, it returns the **majority class** among those k neighbors (ties broken by distance, or by reducing k):

```text
yhat = mode( labels of the k nearest training points )
```

For **regression**, it returns the **mean** (or distance-weighted mean) of the neighbors' target values:

```text
yhat = (1/k) * sum over the k nearest points of y_i
```

There is no learned function or parameters — the prediction is computed fresh from the stored data every time. That's the defining trait: the training set itself is the model.

### Q2. Why is kNN called a "lazy" learner, and what does training actually do?

It's "lazy" because it **defers all computation to prediction time**. The `fit` step does essentially no learning — it just stores the training data (or builds a spatial index like a KD-tree to speed up later searches). No parameters are estimated, no loss is optimized, no boundary is fitted. All the real work — computing distances to every stored point, sorting, voting — happens when a query arrives. This is the opposite of an **eager** learner (logistic regression, a decision tree, an SVM), which does the expensive work up front during training and then predicts cheaply. The tradeoff: kNN has instant training and expensive, memory-heavy prediction.

### Q3. How does k control the bias-variance tradeoff?

k sets how many neighbors vote, which sets how smooth the decision function is:

- **Small k (k=1)** — the prediction follows individual points, so the boundary is jagged and sensitive to noise. **Low bias, high variance** — it can fit any local structure but overreacts to noisy or mislabeled points. Training error is zero (each point is its own nearest neighbor).
- **Large k** — the prediction averages over a wide neighborhood, smoothing out noise but also washing out real local structure. **High bias, low variance**. At k=n, every query returns the global majority class — maximum bias.

So k is a direct complexity dial. You tune it (typically via cross-validation) to the sweet spot; a common rule of thumb is starting near `sqrt(n)`, and using an **odd** k for binary classification to avoid tied votes.

### Q4. Why is feature scaling mandatory for kNN?

Because kNN's distance sums contributions from every feature, and a feature with a large numeric range **dominates** that sum. Suppose one feature is age (0-100) and another is income (0-100,000). Euclidean distance is `sqrt((age_diff)^2 + (income_diff)^2)` — the income term is thousands of times larger, so distance is effectively *just* income and age is ignored. The model silently collapses to one feature. **Standardizing** (z-score) or **min-max scaling** every feature to a comparable range fixes this so each contributes fairly:

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier

# scale INSIDE the pipeline so the scaler is fit on train folds only (no leakage)
model = make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=15))
```

This is the single most common kNN mistake. Scale first, and scale inside cross-validation to avoid leakage.

### Q5. Compare Euclidean, Manhattan, and cosine distance. When do you use each?

| Metric | Formula | Behavior / use |
|---|---|---|
| Euclidean (L2) | `sqrt(sum_i (a_i - b_i)^2)` | Straight-line; the default for continuous, scaled features |
| Manhattan (L1) | `sum_i \|a_i - b_i\|` | Grid distance; more robust to outliers, sometimes better in high dim |
| Cosine | `1 - (a·b)/(\|\|a\|\| \|\|b\|\|)` | Angle only; ignores magnitude — text, TF-IDF, embeddings |

Euclidean penalizes large single-feature differences heavily (the square); Manhattan treats all coordinates linearly and is steadier when outliers or many dimensions are involved. Cosine measures *orientation*, not distance, so two documents with the same word proportions but different lengths are "close" — which is why it dominates for text and embedding vectors where magnitude is a nuisance. The metric defines the geometry, so it's a genuine modeling choice, not a detail.

### Q6. What is the curse of dimensionality and how does it break kNN?

As dimensionality d grows, distances **concentrate** — the gap between the nearest and farthest points shrinks relative to the average distance, so *every* point becomes roughly equidistant from the query. Formally, `(dist_max - dist_min) / dist_min -> 0` as d grows. When the nearest neighbor is barely nearer than the farthest, "nearest" carries almost no information and the vote becomes near-random. Compounding this, the volume of the space explodes: to keep the same *density* of neighbors you'd need exponentially more data, so in high dimensions your k "neighbors" are actually far away and not similar at all. This is why kNN, which relies entirely on local distance being meaningful, degrades sharply past a few dozen informative dimensions — and why you reduce dimensions (PCA) or select features before applying it.

### Q7. What is the time and space complexity of kNN?

Let n = training points, d = features. **Training** is O(n·d) just to store the data (O(1) conceptually — no learning), or O(n·d·log n) if you build a KD/ball-tree index. **Prediction (naive brute force)** is **O(n·d)** per query — you compute the distance to all n points (each costing d), then select the k smallest. **Space** is **O(n·d)** — the entire training set must stay in memory. This is the defining cost profile: free to train, expensive and memory-hungry to predict, and it scales linearly with the dataset size at *every* prediction. For large n this is the bottleneck that spatial indexes and approximate methods exist to fix.

### Q8. How do KD-trees, ball-trees, and approximate NN speed up prediction?

Brute-force O(n·d) per query is too slow for large n, so we index the training data:

- **KD-tree** — recursively splits space along axis-aligned hyperplanes. Neighbor queries prune whole branches, giving roughly O(log n) per query in **low dimensions** — but it degenerates toward brute force above ~20 dimensions.
- **Ball-tree** — partitions with nested hyperspheres instead of axis-aligned boxes; handles moderate dimensions and non-Euclidean metrics better than KD-trees.
- **Approximate NN (ANN)** — gives up exactness for speed: **LSH** (locality-sensitive hashing) and graph methods like **HNSW** find *probably*-nearest neighbors in sub-linear time, scaling to millions of vectors (the backbone of modern vector databases).

sklearn's `algorithm='auto'` picks KD/ball-tree or brute force based on data shape. Above moderate dimensions, exact trees stop helping (curse of dimensionality again) and ANN is the practical answer.

### Q9. What is distance-weighted kNN and why use it?

In plain kNN all k neighbors vote equally — a point at distance 0.1 counts the same as one at distance 5. **Distance-weighted** kNN weights each neighbor's vote by a decreasing function of distance, usually `1 / distance` (or a Gaussian kernel), so closer neighbors influence the prediction more:

```python
KNeighborsClassifier(n_neighbors=15, weights='distance')
```

Benefits: (1) it softens the choice of k — distant "neighbors" contribute little, so a slightly-too-large k does less harm; (2) it breaks ties naturally; (3) it produces smoother regression surfaces. The cost is added sensitivity to the distance metric and scaling, and a risk of a single very-close point dominating. It's often a strict improvement over uniform weighting when neighbors vary a lot in distance.

### Q10. Is kNN parametric or non-parametric? What does that imply?

kNN is **non-parametric** — it makes no assumption about the functional form of the decision boundary and has no fixed set of parameters learned from data. The "parameters" effectively *are* the entire training set, and model complexity grows with n. Implications: (1) it can represent **arbitrarily complex, wiggly boundaries** that a linear model never could; (2) it needs **more data** to generalize well, especially as dimensions grow; (3) it has **no compact model** to ship — you must carry the whole dataset; (4) it makes **no distributional assumptions**, so it's flexible but offers no interpretable coefficients or extrapolation. Contrast with a **parametric** model (linear/logistic regression) that compresses the data into a fixed few weights, assumes a form, extrapolates, but can't fit shapes outside that form.

### Q11. How does the choice of k relate to overfitting and underfitting?

k=1 **overfits**: the model reproduces the training labels exactly (each training point is its own neighbor, so training error is 0), and the boundary contorts around every noisy point — great on train, poor on test. Increasing k **regularizes** by averaging over more neighbors, smoothing the boundary and improving generalization up to a point. Push k too high and the model **underfits** — it averages over so wide a neighborhood that local structure vanishes; at k=n it always predicts the global majority. So the validation-error curve against k is U-shaped: pick k at the bottom of the U via cross-validation. This is the bias-variance tradeoff made unusually literal — a single integer that slides you from high variance to high bias.

### Q12. When does kNN work well, and when does it fail?

**Works well when:** the dataset is **low-dimensional** (few, informative, scaled features), the decision boundary is **irregular** (kNN captures shapes parametric models can't), you have **enough data** to densely populate the space, and prediction latency isn't critical. It's also a strong, assumption-free baseline and the engine behind recommendation and retrieval systems.

**Fails when:** dimensionality is **high** (curse of dimensionality), n is **large** and you need fast predictions (O(n) per query), features aren't **scaled**, there are many **irrelevant features** (they add noise to the distance), or the data is very **imbalanced** (the majority class swamps neighborhoods). In those cases prefer a parametric or tree-based model, reduce dimensions first, or move to approximate NN.

### Q13. How does kNN handle imbalanced data, and how can you mitigate it?

Poorly, by default. If 95% of points are class A, most neighborhoods are dominated by class A regardless of the query, so the minority class is systematically under-predicted — plain majority voting is biased toward the frequent class. Mitigations: (1) **distance weighting**, so a few very close minority neighbors can outweigh many distant majority ones; (2) **resampling** the training data (oversample minority / undersample majority, e.g. SMOTE) before fitting; (3) **class-weighted voting** that scales each class's votes inversely to its frequency; (4) **adjusting the decision threshold** on the neighbor-proportion score rather than using a hard majority; and (5) evaluating with **precision/recall/F1**, not accuracy, so the imbalance is visible. The geometry is unchanged, so these all work by re-weighting or rebalancing the vote.

### Q14. kNN vs k-means — what's the difference?

They're constantly confused because both use "k" and distances, but they solve different problems:

| | kNN | k-means |
|---|---|---|
| Task | **Supervised** classification/regression | **Unsupervised** clustering |
| "k" means | Number of neighbors to vote | Number of clusters to form |
| Uses labels | Yes | No |
| "Training" | None (lazy) | Iterative centroid fitting (Lloyd's) |
| Output | A prediction per query | A cluster assignment + k centroids |

kNN answers "what label does this new point get, based on nearby labeled points?" k-means answers "how do I partition unlabeled data into k groups?" The only real overlap is that both rely on a distance metric and both need feature scaling. Mixing them up in an interview is a classic tell.

### Q15. Can kNN be used for regression? How, and what does the fit look like?

Yes. kNN regression predicts the **average** (optionally distance-weighted) target of the k nearest neighbors:

```text
yhat(x) = (1/k) * sum over k nearest y_i
```

The resulting function is a **piecewise-constant** surface: it's flat within each region where the neighbor set doesn't change, then jumps as neighbors swap in and out. Small k produces a spiky, high-variance fit that chases noise; large k produces a smooth, flat, high-bias fit. Distance weighting turns the steps into smoother transitions. A key limitation: because predictions are averages of *observed* targets, kNN regression **cannot extrapolate** beyond the range of the training targets — outside the data cloud it just returns the nearest edge points' average, flatlining. That's fine for interpolation, poor for trends.

### Q16. How do you choose k in practice?

Treat k as a hyperparameter and select it with **cross-validation**: sweep a range of k values, measure validation performance (accuracy/F1 for classification, MSE for regression) for each, and pick the k at the best-scoring / lowest-error point — the bottom of the U-shaped bias-variance curve.

```python
from sklearn.model_selection import GridSearchCV

param_grid = {"kneighborsclassifier__n_neighbors": range(1, 31, 2)}
search = GridSearchCV(model, param_grid, cv=5, scoring="f1_macro")
search.fit(X_train, y_train)  # model = scaler + kNN pipeline
```

Rules of thumb to seed the search: start near `sqrt(n)`; use an **odd** k for binary problems to avoid ties; and remember the scaler must be inside the CV pipeline so each fold's scaling is fit only on its training portion. Don't hand-pick k on the test set — that leaks and inflates your estimate.

## Decision Trees

### Summary

**What this topic covers**

Decision trees are the **recursive, axis-aligned partitioning** models — they carve feature space into rectangles by asking one-feature yes/no questions and predicting a constant in each region. This topic covers the CART algorithm end to end: how a tree **greedily chooses splits** to reduce impurity (**Gini** and **entropy** for classification, **variance / MSE** for regression), why single trees have **high variance and overfit**, and the full toolbox for controlling that — **pre-pruning** (max_depth, min_samples_leaf/split) and **post-pruning** (cost-complexity). It covers the traits that make trees beloved — they handle **mixed data types**, need **no feature scaling**, and are **interpretable** — and the trait that dooms a lone tree: **instability**, where a tiny data change produces a completely different tree. That instability is exactly what motivates ensembles. The 16 questions go from "what is a decision tree" to "derive the cost-complexity pruning objective" and "why is one tree rarely used alone." This topic is the foundation for **Random Forests**, **Gradient Boosting**, and **XGBoost / LightGBM**.

**Mental model**

A decision tree is a flowchart learned from data. Starting at the root with all the training data, it asks: "**which single feature, split at which threshold, best separates the target?**" It tries every feature and every candidate threshold, scores each split by how much it **reduces impurity** (makes the child nodes more homogeneous than the parent), and greedily takes the best one. Then it recurses on each child, splitting again and again, until a stopping rule fires (pure node, max depth, too few samples). Each leaf predicts a constant — the **majority class** (classification) or the **mean target** (regression) of the training points that landed there. Geometrically, because every split is on one feature, the tree partitions space into **axis-aligned rectangles**, and the prediction is piecewise-constant across them. The tree is greedy (it never reconsiders an earlier split) and, left unchecked, will keep splitting until every leaf is pure — perfectly memorizing the training set. Controlling *when it stops* is the whole art.

**Key terms**

- **CART** — Classification And Regression Trees; the standard binary-split algorithm sklearn implements.
- **Root / internal node / leaf** — the top node, decision nodes, and terminal prediction nodes.
- **Split** — a test `feature <= threshold` that sends samples left or right.
- **Impurity** — how mixed a node's labels are; splitting aims to reduce it.
- **Gini impurity** — `1 - sum_k p_k^2`; probability a random label is misclassified by the node's class distribution.
- **Entropy** — `- sum_k p_k * log2(p_k)`; information-theoretic impurity; drives information gain.
- **Information gain** — parent impurity minus weighted child impurity; the split's score.
- **Variance / MSE reduction** — the regression impurity criterion; minimize within-node target variance.
- **Greedy / axis-aligned** — splits chosen locally-optimally, one feature at a time, giving rectangular regions.
- **Pre-pruning** — stop growing early via max_depth, min_samples_split, min_samples_leaf.
- **Post-pruning / cost-complexity** — grow full, then prune back weak subtrees using a complexity penalty alpha.
- **Instability** — high sensitivity: a small change in data can yield a very different tree.

**Why interviewers ask this**

Trees are the gateway to the most important family in tabular ML — random forests and gradient boosting — so interviewers check the foundation before going there. A junior can describe the flowchart. A senior can (1) **write an impurity measure and compute information gain** for a split, (2) explain *why* trees overfit (greedy growth to pure leaves = memorization) and enumerate the **specific knobs** that fix it and which way each moves bias-variance, (3) explain **cost-complexity pruning** as a regularized objective, and (4) articulate the **instability** problem and connect it directly to why **bagging** (random forests) and **boosting** exist. Trees also test whether you understand the difference between **Gini and entropy** (usually negligible), and why trees uniquely **don't need scaling** and **handle mixed types**. If you can't explain instability, the entire ensemble section that follows will sound like memorized facts rather than understood mechanics.

**Common confusions**

- "Trees need feature scaling" — they don't; splits are threshold comparisons on one feature at a time, so monotonic rescaling changes nothing.
- "Gini vs entropy is a big decision" — it almost never matters for accuracy; both favor pure nodes and give near-identical trees. Gini is slightly cheaper (no log).
- "A deeper tree is a better tree" — deeper means lower bias but exploding variance; unbounded depth memorizes noise.
- "Trees find the globally optimal split structure" — no; growth is **greedy** and locally optimal, which is why a single early split can lock in a suboptimal tree.
- "Pruning and setting max_depth are the same" — pre-pruning stops early (may stop too soon and miss a good later split); post-pruning grows full then trims (more principled, sees the whole tree first).
- "One decision tree is a strong model" — rarely; its variance/instability is why it's almost always used inside a forest or a boosted ensemble.
- "Trees can only classify" — CART does regression too, predicting the leaf mean and splitting on variance/MSE.

**What follows from this topic**

Everything in the tree-ensemble family builds directly on this. **Instability + high variance** is the exact problem **bagging / random forests** solve by averaging many decorrelated trees. **High bias of shallow trees** is what **gradient boosting** exploits by adding shallow trees sequentially to correct residuals. **XGBoost** and **LightGBM** are engineering-optimized boosting of trees with regularized split objectives. The impurity and split-gain mechanics here reappear (with a regularized twist) in XGBoost's gain formula. And "trees need no scaling, handle mixed types, but can't extrapolate" is a recurring entry in the algorithm-selection decision matrix. Master this topic and the entire ensemble section becomes a set of variations on one theme.

### Q1. What is a decision tree and how does it make a prediction?

A decision tree is a model that predicts by routing an input through a series of single-feature yes/no tests. Starting at the **root**, each internal node asks a question like `feature_j <= threshold`; the answer sends the sample left or right to a child node. This repeats until the sample reaches a **leaf**, which holds the prediction:

- **Classification** — the leaf predicts the **majority class** of training samples that fell there (and class proportions give probabilities).
- **Regression** — the leaf predicts the **mean target** of its training samples.

Geometrically, the tree partitions feature space into axis-aligned rectangles, one per leaf, and predicts a constant in each. Prediction is just a walk from root to leaf — O(depth), typically O(log n) for a balanced tree — making inference very fast.

### Q2. How is a decision tree trained? Describe the CART algorithm.

CART grows the tree **greedily and recursively**:

1. Start with all training data at the root.
2. For **every feature** and **every candidate threshold**, evaluate the split — how much it reduces impurity (Gini/entropy for classification, variance/MSE for regression).
3. Choose the single split with the **largest impurity reduction** and partition the node into two children.
4. **Recurse** on each child with its subset of data.
5. **Stop** when a rule fires: node is pure, max_depth reached, too few samples to split, or no split improves impurity.

Each resulting leaf predicts the majority class or mean target of its samples. "Greedy" is key: the best split is chosen **locally** at each node and never reconsidered, so CART doesn't search for the globally optimal tree (that's NP-hard) — it takes the locally best step every time.

### Q3. What is Gini impurity and how is it used to choose a split?

Gini impurity measures how mixed a node's labels are — the probability that a randomly chosen sample is misclassified if labeled by the node's class distribution:

```text
Gini = 1 - sum_k p_k^2
```

where `p_k` is the fraction of class k in the node. Gini is 0 for a pure node (one class) and maximal for a uniform mix. To score a split, CART computes the **weighted average** Gini of the two children and picks the split that minimizes it (equivalently, maximizes the reduction from the parent):

```text
Gini_split = (n_left/n) * Gini_left + (n_right/n) * Gini_right
```

Every candidate (feature, threshold) is evaluated this way and the lowest `Gini_split` wins. It's the default criterion in sklearn because it's slightly cheaper than entropy (no logarithm) and gives essentially equivalent trees.

### Q4. Compare Gini impurity and entropy. Does the choice matter?

Both measure node impurity and both are minimized by pure nodes:

| | Gini | Entropy |
|---|---|---|
| Formula | `1 - sum_k p_k^2` | `- sum_k p_k * log2(p_k)` |
| Split score | Minimize weighted Gini | Maximize information gain |
| Cost | Cheaper (no log) | Slightly costlier (log) |
| Range (binary) | 0 to 0.5 | 0 to 1 |

In practice the choice **rarely affects accuracy** — the two disagree on the best split only occasionally, and resulting trees are near-identical. Entropy penalizes impurity slightly more steeply and can produce marginally more balanced trees; Gini is faster because it avoids logarithms. The honest interview answer: they're interchangeable for accuracy, Gini is the sensible default for speed, and if someone is tuning between them they're almost certainly optimizing the wrong thing.

### Q5. What is information gain?

Information gain is the reduction in **entropy** achieved by a split — it quantifies how much a split "cleans up" the labels:

```text
InfoGain = Entropy(parent) - [ (n_left/n)*Entropy(left) + (n_right/n)*Entropy(right) ]
```

You compute the parent's entropy, then the weighted entropy of the children after splitting, and the difference is the information gained. CART (with the entropy criterion) picks the split with the **maximum information gain** at each node — the split that most reduces uncertainty about the class. It's the entropy analog of Gini reduction. One caveat behind the historical **information gain ratio** (used in C4.5): raw information gain is biased toward high-cardinality features that split into many tiny pure groups, so the gain *ratio* normalizes by the split's own entropy to counteract that bias.

### Q6. How are regression trees different — what's the split criterion?

Regression trees have the same recursive structure but predict a **continuous value** and split to reduce **variance / MSE** instead of classification impurity. A node's impurity is the variance of its target values; a split is scored by the weighted variance of its children:

```text
node impurity = (1/n) * sum_i (y_i - ybar)^2      (variance / MSE)
split score   = (n_left/n)*Var_left + (n_right/n)*Var_right   (minimize)
```

CART tries every (feature, threshold) and picks the split that most reduces total within-node variance — i.e., groups similar target values together. Each **leaf predicts the mean** of its training targets. The result is a piecewise-constant regression surface (flat steps), which is why a single regression tree can't produce smooth trends or extrapolate beyond the training target range — it can only output means of leaves it has seen.

### Q7. Why do decision trees overfit, and what does an overfit tree look like?

Trees overfit because, left unconstrained, CART keeps splitting until **every leaf is pure** — each leaf may contain a single training point. At that extreme the tree has zero training error because it has effectively **memorized the training set**, including its noise and outliers. The boundary becomes a maze of tiny rectangles carved to isolate individual points, none of which generalize. Symptoms: very deep trees, leaves with 1-2 samples, near-perfect train accuracy but poor and unstable test accuracy. The root cause is that trees are **high-variance** models with essentially unlimited capacity — they can fit any training set exactly. This is precisely why you must **constrain growth** (pre-pruning) or **trim after** (post-pruning), and why a single tree's variance is the problem ensembles were invented to solve.

### Q8. What is pre-pruning, and which hyperparameters control it?

Pre-pruning (early stopping) **halts tree growth before it fully fits** by imposing constraints during construction:

- **max_depth** — cap the number of levels; the bluntest, most effective control on complexity.
- **min_samples_split** — a node needs at least this many samples to be split at all.
- **min_samples_leaf** — every leaf must retain at least this many samples, preventing tiny slivers.
- **max_leaf_nodes** — cap the total number of leaves.
- **min_impurity_decrease** — only split if impurity drops by at least this much.

Each of these **raises bias and lowers variance** — tighter constraints give a simpler, more general tree. The weakness of pre-pruning is its **short-sightedness (the horizon effect)**: it may stop at a node whose split looks useless even though a *further* split beneath it would have been valuable, so it can prune too early. That's the motivation for post-pruning.

### Q9. What is cost-complexity (post-)pruning?

Post-pruning **grows the tree fully, then trims it back**, avoiding pre-pruning's short-sightedness by seeing the whole tree before deciding. **Cost-complexity pruning** (minimal cost-complexity, or "weakest-link" pruning) defines a penalized objective that trades off fit against size:

```text
R_alpha(T) = R(T) + alpha * |leaves(T)|
```

where R(T) is the tree's training error (or total leaf impurity) and `|leaves(T)|` is the number of leaves. The penalty `alpha >= 0` prices each leaf. For a given alpha you find the subtree minimizing `R_alpha`; larger alpha forces a smaller tree. The algorithm iteratively removes the subtree whose removal increases error least per leaf removed (the "weakest link"), generating a nested sequence of trees for increasing alpha. You then pick **alpha by cross-validation**. It's a cleaner, more principled regularizer than guessing max_depth.

```python
from sklearn.tree import DecisionTreeClassifier

path = DecisionTreeClassifier().cost_complexity_pruning_path(X_train, y_train)
# path.ccp_alphas gives candidate alphas; CV over them to pick the best
best = DecisionTreeClassifier(ccp_alpha=0.002).fit(X_train, y_train)
```

### Q10. Why don't decision trees need feature scaling?

Because every split is a **threshold comparison on a single feature at a time** — `feature_j <= t`. The tree only cares about the *ordering* of a feature's values, not their magnitudes or units. Any **monotonic transformation** (scaling, log, standardization) preserves that ordering, so it produces exactly the same splits and the same tree. Contrast with distance-based (kNN, SVM, k-means) or gradient-based (linear/logistic regression) models, where features on different scales distort distances or dominate the loss and *must* be standardized. Trees are immune. This scale-invariance, plus native handling of mixed numeric/categorical types and missing values, is a big part of why tree ensembles are the go-to for messy tabular data with minimal preprocessing.

### Q11. How do decision trees handle categorical features and missing values?

**Categorical features:** CART splits by partitioning the categories into two groups (e.g. `{red, blue}` vs `{green}`); for a k-category feature there are `2^(k-1) - 1` possible binary partitions, evaluated to find the best. High-cardinality categoricals are a hazard — they offer many splits and can overfit (and information gain is biased toward them). Note: scikit-learn's implementation doesn't natively accept string categoricals, so you must encode them; libraries like LightGBM and CatBoost do handle them natively and better.

**Missing values:** trees handle them gracefully. Strategies include **surrogate splits** (a backup feature that mimics the primary split when its value is missing, used by CART) and **default directions** (send missing values down a learned default branch, used by XGBoost). Either way you often don't need to impute — a real advantage over most models.

### Q12. Why are decision trees considered interpretable?

Because the model *is* its explanation. A prediction is a **path of human-readable rules**: "income <= 50k AND age > 40 AND owns_home = yes -> approve." You can trace exactly why any input got its output, inspect the whole tree as a flowchart, and read off which features and thresholds drive decisions — no post-hoc explanation tooling required. Feature importance falls out naturally (total impurity reduction attributed to each feature). This transparency makes single trees valuable in **regulated or high-stakes settings** (credit, healthcare) where decisions must be auditable and explained to non-technical stakeholders. The irony: the moment you fix a tree's accuracy by bundling hundreds of them into a forest or boosted ensemble, you **lose** this interpretability — the individual clarity doesn't survive the averaging. That tension (accuracy vs interpretability) is a recurring interview theme.

### Q13. What is the instability of decision trees, and why does it matter?

Instability means a **small change in the training data can produce a completely different tree**. Because growth is greedy, if a slightly different sample changes which feature wins the **root** split, every subtree below inherits that change and cascades — the whole structure reorganizes. So two trees trained on 99%-overlapping data can look entirely different and split on different features. This is another face of trees being **high-variance** estimators. Why it matters: (1) it undermines the interpretability advantage (which explanation do you trust if it flips with a few rows?), and (2) it's the *precise* property that **bagging** exploits — averaging many trees trained on bootstrap samples cancels their independent, high-variance errors. Instability is a bug for a single tree and a feature for an ensemble.

### Q14. What is the time complexity of building a decision tree?

Let n = samples, p = features. At each node, CART evaluates every feature (p of them), and for each it must consider thresholds, which requires the feature's values in sorted order — sorting costs O(n log n). Across a balanced tree of depth ~log n with the data partitioned among nodes at each level, the standard result is:

```text
Training:   O(p * n * log n)     (dominant term; sorting features per level)
Prediction: O(depth) ~ O(log n)  per sample, for a balanced tree
```

Training is roughly linear in features and n-log-n in samples — cheap enough that building thousands of trees for a forest or boosted ensemble is practical. Prediction is very fast (a single root-to-leaf walk). Memory is O(number of nodes), typically O(n) in the worst case of a fully grown tree.

### Q15. Why is a single decision tree rarely used alone?

Because a single tree sits at a bad point on the bias-variance curve: constrain it (shallow) and it's **too biased** to be accurate; let it grow and it's **too high-variance and unstable** to generalize. There's no depth that makes one tree both accurate and stable on non-trivial data. Ensembles resolve this two ways:

- **Bagging / Random Forests** — train many deep (low-bias, high-variance) trees on bootstrap samples with random feature subsets, then **average**. Averaging cancels the independent variance, keeping low bias while slashing variance and instability.
- **Boosting (GBM, XGBoost, LightGBM)** — add many shallow (high-bias, low-variance) trees **sequentially**, each correcting the previous ensemble's errors, driving down bias.

So the single tree isn't a final model — it's the **weak learner** that ensembles combine. Its flaws (variance, instability, bias when shallow) map exactly onto what forests and boosting are engineered to fix, which is why the tree topic is the launchpad for the entire ensemble section.

### Q16. Decision tree vs logistic regression — when would you pick each?

They occupy opposite corners of the modeling space:

| | Decision Tree | Logistic Regression |
|---|---|---|
| Boundary | Axis-aligned, non-linear, piecewise | Single linear boundary |
| Feature interactions | Captured automatically (nested splits) | Must be added manually |
| Scaling needed | No | Yes |
| Mixed types / missing | Handled natively | Needs encoding/imputation |
| Extrapolation | No (leaf means) | Yes (linear extends) |
| Interpretability | Rules / flowchart | Coefficients / odds ratios |
| Variance | High (unstable) | Low (stable) |

Pick a **tree** when relationships are non-linear, features interact, data is messy/mixed-type, and you want rule-based explanations. Pick **logistic regression** when the relationship is roughly linear-in-log-odds, you want a stable low-variance model with calibrated probabilities and interpretable coefficients, or you need to extrapolate. In practice, on tabular data, you rarely use a lone tree — you reach for a **tree ensemble** to get the tree's flexibility without its variance, and keep logistic regression as the interpretable linear baseline.
## Random Forests

### Summary

**What this topic covers**

Random forests — the workhorse ensemble that fixed the single decision tree's biggest flaw (high variance) with two ideas stacked on top of each other: **bagging** and **random feature selection at each split**. This topic goes deep on *why* averaging many decorrelated trees reduces variance without inflating bias, how a forest is actually grown, and what every knob does. The 16 questions here cover: the bagging + feature-subsampling mechanism, why decorrelation (not just averaging) is the whole trick, out-of-bag (OOB) error as free validation, the two flavours of feature importance (impurity vs permutation) and their biases, the key hyperparameters (n_estimators, max_features, max_depth, min_samples_leaf), train/predict complexity, the extrapolation limitation, and the head-to-head against a single tree and against gradient boosting. Decision trees themselves (Gini/entropy, pruning, greedy splits) are assumed — this topic builds directly on them.

**Mental model**

A single deep tree is a low-bias, high-variance estimator: it fits the training set almost perfectly but a small change in the data gives a very different tree. Averaging many such trees would kill the variance — *if* the trees were independent. The variance of an average of B identically-distributed variables each with variance sigma^2 and pairwise correlation rho is:

`Var = rho*sigma^2 + (1-rho)/B * sigma^2`

Push B up and the second term vanishes, but the first term `rho*sigma^2` is a floor set by how correlated the trees are. So the real lever is **reducing rho**. Bagging alone (bootstrap resample the rows, train a tree per sample) decorrelates a bit, but the trees still tend to agree on the same strong features near the root. Random forests add the key twist: **at every split, consider only a random subset of features** (max_features, e.g. sqrt(p) for classification). This forces trees to use different features, drives rho down, and shrinks that floor. That is the entire insight — the forest trades a tiny bias increase for a large variance reduction.

**Key terms**

- **Bagging (bootstrap aggregating)** — train each model on a bootstrap sample (sample n rows with replacement) and average their predictions.
- **Bootstrap sample** — n rows drawn with replacement; ~63.2% of rows appear, the rest are out-of-bag.
- **max_features** — number of features randomly considered at each split; the decorrelation knob (sqrt(p) classification, p/3 regression are defaults).
- **Decorrelation** — the mechanism that lowers pairwise tree correlation rho so averaging actually reduces variance.
- **OOB error** — validation error estimated on each tree's out-of-bag rows; a free, held-out-like estimate with no separate split.
- **Impurity importance (MDI)** — total impurity decrease attributed to a feature; fast but biased toward high-cardinality / continuous features.
- **Permutation importance** — drop in accuracy when a feature's values are shuffled; slower, model-agnostic, more trustworthy.
- **n_estimators** — number of trees; more never hurts accuracy (only compute), so set it as high as budget allows.
- **Fully grown trees** — RF trees are usually grown deep (low bias) and left unpruned; the ensemble controls variance.
- **Aggregation** — average of class probabilities (or majority vote) for classification, mean for regression.

**Why interviewers ask this**

Random forests are the canonical "explain how an ensemble reduces variance" question, and the answer separates candidates sharply. A junior says "it averages lots of trees so it's more stable" — true but incomplete. A senior names the variance-of-a-correlated-average formula, points at the `rho*sigma^2` floor, and explains that **feature subsampling exists specifically to lower rho** — averaging alone hits a wall. Interviewers also probe OOB (do you know you get validation for free?), the impurity-importance bias (a classic trap — high-cardinality features look artificially important), and the extrapolation limitation (a forest can never predict outside the training range because leaves output training averages). Getting the decorrelation story crisp signals you understand ensembles from the inside, not as a black box.

**Common confusions**

- "Random forest = bagging" — bagging is only half of it; the per-split random feature subset is the part that decorrelates and gives RF its name.
- "More trees can overfit" — no. Adding trees only reduces variance of the average; test error plateaus, it does not rise. You overfit via tree depth, not tree count.
- "Impurity importance is objective" — it is biased toward high-cardinality and continuous features; prefer permutation importance for real conclusions.
- "OOB is a poor man's CV so I still need a validation set" — OOB is a legitimate near-unbiased estimate; it can replace CV for model selection on large data.
- "RF extrapolates like linear regression" — it cannot. Every prediction is an average of training-leaf values, bounded by the training range.

**What follows from this topic**

Random forests are one branch of the ensemble family tree; the sibling branch is boosting. The next topic, **Bagging & Ensemble Foundations**, generalizes what you just saw (bagging vs boosting vs stacking vs voting, the bias-variance view of each). **Gradient Boosting (GBM)** is the other major tree ensemble — sequential, bias-reducing, and usually more accurate on tabular data but harder to tune. Keep the RF-vs-GBM contrast (parallel/variance vs sequential/bias) in your pocket; it is the single most common ensemble follow-up.

### Q1. What is a random forest and what problem does it solve?

A random forest is an **ensemble of decision trees** built to fix the single tree's fatal weakness: **high variance**. One deep CART tree fits training data almost perfectly but is unstable — resample the data and you get a very different tree, so it generalizes poorly.

The forest builds many trees, each on a different bootstrap sample of the rows AND restricted to a random subset of features at each split, then averages them (mean for regression, majority vote / averaged probabilities for classification). Averaging many high-variance, low-bias trees drives variance down while keeping bias roughly unchanged.

```python
from sklearn.ensemble import RandomForestClassifier
clf = RandomForestClassifier(n_estimators=300, max_features="sqrt")
clf.fit(X, y)          # trees train independently, in parallel
clf.predict(X_test)    # aggregate over all trees
```

Net effect: near the accuracy of a well-tuned model with almost no tuning, robust to outliers and irrelevant features, and no feature scaling required.

### Q2. How exactly does a random forest reduce variance? Give the maths.

Consider B identically-distributed trees, each with variance sigma^2 and pairwise correlation rho. The variance of their average is:

`Var(avg) = rho*sigma^2 + (1 - rho)/B * sigma^2`

Two terms. The second, `(1-rho)/B * sigma^2`, shrinks to zero as you add trees (B -> infinity). The first, `rho*sigma^2`, is a **floor** — no amount of averaging removes it. It depends only on how correlated the trees are.

So the design goal is to **lower rho**. Bagging (different row samples) decorrelates a little, but trees still latch onto the same dominant features near the root, keeping rho high. The random feature subset at each split forces trees apart, lowering rho and dropping the floor. Bias barely moves because each tree is still an unbiased-ish deep fit. That is why the forest wins: big variance cut, negligible bias cost.

### Q3. What are the two sources of randomness in a random forest, and why both?

1. **Bootstrap row sampling (bagging)** — each tree trains on n rows sampled with replacement, so each tree sees a slightly different dataset. This gives some tree-to-tree diversity and enables OOB error.

2. **Random feature subset at each split** — when choosing a split, the tree considers only `max_features` randomly chosen features (not all p). This is the decisive one: without it, every tree would greedily split on the same strong predictor at the root and the trees would be highly correlated.

Both exist to reduce the pairwise correlation rho between trees. Bagging alone is "bagged trees"; adding per-split feature sampling is what makes it a *random forest*. Feature sampling contributes far more decorrelation, especially when a few features dominate.

### Q4. What is max_features and how does it trade off bias and variance?

`max_features` is the number of features randomly considered at each split — the primary decorrelation knob.

- **Small max_features** (e.g. sqrt(p)): trees are forced to use varied features -> lower correlation rho -> lower ensemble variance, but each individual tree is slightly weaker (higher bias) because it sometimes can't split on the best feature.
- **Large max_features** (-> p): each tree is stronger individually but trees look alike -> high rho -> the averaging buys you less.

Defaults: `sqrt(p)` for classification, `p/3` for regression. Tune it if you have many irrelevant features (raise it so trees can find signal) or highly correlated strong features (lower it to force diversity). It is the one RF knob most worth tuning.

### Q5. What is out-of-bag (OOB) error and why is it free?

Each bootstrap sample leaves out about **36.8%** of rows (since `(1 - 1/n)^n -> 1/e ~= 0.368`). For any given row, roughly a third of the trees never saw it during training — those are its OOB trees.

To get the OOB prediction for a row, aggregate only over the trees that did *not* train on it, then compare to the true label across all rows. The result is a near-unbiased generalization estimate — like cross-validation, but computed as a byproduct of training with no extra model fits.

```python
rf = RandomForestClassifier(n_estimators=500, oob_score=True)
rf.fit(X, y)
print(rf.oob_score_)   # held-out-like accuracy, no separate split
```

On large datasets OOB can replace a validation split entirely. Caveat: it is noisier with few trees, and it is not identical to k-fold CV.

### Q6. Compare impurity-based vs permutation feature importance.

| | Impurity (MDI) | Permutation |
|---|---|---|
| How | Sum impurity decrease from splits on the feature | Drop in score when the feature's values are shuffled |
| Speed | Free (computed during training) | Slow (re-score per feature) |
| Bias | Inflates high-cardinality / continuous features | Model-agnostic, far less biased |
| Data | Training data (can reflect overfitting) | Any set, ideally held-out |
| Correlated features | Splits importance arbitrarily | Both may look unimportant (either can substitute) |

Impurity importance is the default `feature_importances_` and is fine for a quick look, but it systematically over-credits features with many split points (high-cardinality categoricals, continuous vars). For any decision you'll act on, use **permutation importance on held-out data**. Both mishandle correlated features — shuffle one and the model leans on its correlated twin, so importance looks deflated.

### Q7. Why can't a random forest extrapolate?

A tree's prediction for any input is the **average of the training targets in the leaf** that input falls into. Leaves are bounded regions defined by training data, and their output values are averages of training y. A forest averages these — so every prediction is a weighted average of training labels and is **bounded by the training target range**.

If you train on x in [0, 10] with a rising trend and ask for x = 100, the forest returns roughly the value of the rightmost leaf — flat, not the extrapolated trend. Linear regression would keep rising. This makes RF (and all tree ensembles, including GBM) unsuitable for problems needing extrapolation beyond observed ranges — time-series trends, physical laws. Use a linear/parametric model there, or detrend first.

### Q8. What are the key hyperparameters of a random forest?

- **n_estimators** — number of trees. More is strictly better for accuracy (variance keeps dropping, then plateaus); cost is linear compute. Set as high as budget allows, e.g. 300-1000.
- **max_features** — features per split; the decorrelation knob (sqrt(p) / p/3 defaults). The one most worth tuning.
- **max_depth** — how deep each tree grows. Default None (fully grown) is usually fine since the ensemble controls variance; cap it only to save memory/time or on very noisy data.
- **min_samples_leaf / min_samples_split** — minimum rows per leaf/split; raising them smooths predictions and shrinks the model.
- **bootstrap** — whether to sample rows with replacement (True enables OOB).

RF is famously forgiving — defaults often win. If you tune, do max_features first, then min_samples_leaf.

### Q9. What is the time and space complexity of training and prediction?

**Training**: building one tree is roughly `O(n * m * log n)` where n = rows, m = max_features considered per split (not all p, thanks to feature subsampling). For B trees: `O(B * n * m * log n)`. Because trees are independent, this is **embarrassingly parallel** across cores — wall-clock scales with B/cores.

**Prediction**: `O(B * depth)` per row — traverse each tree from root to leaf, aggregate. Depth is ~log n for balanced trees.

**Space**: `O(B * nodes)` — the model stores every node of every tree, so forests can be large in memory (hundreds of deep trees). This is the practical downside: fast to train in parallel, but the serialized model can be big and predict latency grows with n_estimators.

### Q10. Random forest vs a single decision tree — when does the forest win, and when not?

| | Single tree | Random forest |
|---|---|---|
| Bias | Low | Low (~same) |
| Variance | High | Much lower |
| Accuracy | Lower, unstable | Higher, stable |
| Interpretability | High (readable rules) | Low (hundreds of trees) |
| Training | Fast | B x slower (but parallel) |
| Extrapolation | No | No |

The forest wins on accuracy and stability almost always — that's the point. You keep the single tree only when **interpretability is the requirement** (you must show a human the exact decision path), or the model must be tiny/fast. A single tree is also a fine, fast baseline. But for predictive performance, a forest dominates a lone tree with essentially no tuning.

### Q11. Are random forests prone to overfitting? Can adding trees overfit?

Random forests are **resistant** to overfitting, and crucially, **adding more trees never causes overfitting**. Each new tree only reduces the variance of the averaged estimator; test error decreases then plateaus — it does not rise with n_estimators. (Breiman proved the generalization error converges as B grows.)

Where RF *can* overfit is through the **individual trees' capacity** on noisy data — very deep trees with min_samples_leaf=1 can memorize noise, and averaging only partly cancels it. If you see overfitting, raise min_samples_leaf, cap max_depth, or lower max_features — do not reduce n_estimators (that only adds variance back). This is the opposite of boosting, where more estimators *can* overfit.

### Q12. How do random forests handle missing values, categoricals, and feature scaling?

- **Scaling**: not needed. Splits are threshold comparisons (x < t), invariant to monotone rescaling. This is a big convenience vs SVM/kNN.
- **Categoricals**: CART splits handle them, but sklearn's implementation needs numeric input, so you one-hot or ordinal-encode. High-cardinality categoricals inflate impurity importance and bloat one-hot dimensionality — a known friction (CatBoost handles these natively).
- **Missing values**: classic RF has no built-in handling in sklearn (impute first); some implementations use surrogate splits or send missing rows both ways. XGBoost/LightGBM learn a default direction for missing, which RF lacks.
- **Mixed types / outliers**: robust. Outliers land in a leaf and get averaged down; irrelevant features are mostly ignored by splits.

### Q13. What is Extra Trees (Extremely Randomized Trees) and how does it differ from RF?

Extra Trees pushes randomization one step further. A random forest, at each split, searches for the **best threshold** among the candidate features. Extra Trees instead picks **random thresholds** for each candidate feature and takes the best among those random splits — and by default it does **not bootstrap** (uses the whole dataset per tree).

Effect: even more decorrelation (lower rho) and much faster training (no exhaustive threshold search), at the cost of slightly higher bias per tree. Often comparable accuracy to RF, sometimes better on noisy data, and faster.

```python
from sklearn.ensemble import ExtraTreesClassifier
ExtraTreesClassifier(n_estimators=300)  # random split thresholds
```

Mnemonic: RF randomizes *which features*; Extra Trees randomizes *which features AND where to split*.

### Q14. How does a random forest produce class probabilities, and are they calibrated?

For classification, each tree outputs a class distribution at the leaf (fraction of each class among that leaf's training rows). The forest **averages these per-tree distributions** across all trees to produce `predict_proba`. Majority voting is the argmax of this average.

Are they calibrated? **Roughly, but not perfectly.** RF probabilities tend to be pushed away from 0 and 1 (biased toward the middle) because averaging many trees smooths extremes — a forest rarely outputs 0.0 or 1.0. If you need well-calibrated probabilities (e.g. for expected-value decisions), wrap it in `CalibratedClassifierCV` (isotonic or Platt scaling) on held-out data. This calibration caveat is common to many ensembles.

### Q15. Random forest vs gradient boosting — how do you choose?

| | Random forest | Gradient boosting |
|---|---|---|
| How trees combine | Parallel, independent, averaged | Sequential, each fixes prior errors |
| Reduces | Variance | Bias (and variance) |
| Trees | Deep, fully grown | Shallow (depth 3-8) |
| Tuning | Forgiving, few knobs | Sensitive (eta, depth, n_estimators) |
| Overfit risk from #trees | None | Yes (needs early stopping) |
| Peak accuracy on tabular | Good | Usually higher |
| Parallelism | Full | Limited (sequential) |

Reach for **RF** as a fast, robust baseline with minimal tuning, when you want parallel training and stability. Reach for **gradient boosting (XGBoost/LightGBM)** when you want maximum tabular accuracy and can afford to tune. In practice RF is the "get a strong number in five minutes" tool; boosting is the "win the leaderboard" tool.

### Q16. Your random forest is accurate but the model is 2 GB and predictions are too slow. What are your options?

The model size and predict latency both scale with `n_estimators x tree size`. Levers:

- **Fewer, shallower trees**: cap `max_depth` and raise `min_samples_leaf` — this is the biggest size lever; it prunes the number of nodes drastically with modest accuracy loss.
- **Reduce n_estimators**: find the plateau point on the OOB/validation curve; often 100 trees match 500 within noise.
- **Post-hoc pruning / distillation**: train a smaller model (or a single tree / GBM) to mimic the forest's predictions.
- **Switch to gradient-boosted trees**: shallow-tree boosting often matches RF accuracy with far fewer, smaller trees -> much smaller model and faster inference.
- **Quantize / compress the leaf values**, or serve with a fast inference library (treelite).

Diagnose first: plot accuracy vs n_estimators and vs max_depth to find where you're paying for size you don't need.

## Bagging & Ensemble Foundations

### Summary

**What this topic covers**

The general theory of ensembles — the conceptual layer above any specific algorithm. Random forests and gradient boosting are instances; this topic explains the *taxonomy* they live in and *why* combining models works at all. The 16 questions cover: the four ensemble families (**bagging**, **boosting**, **stacking/blending**, **voting**) and a comparison table across them, the **bootstrap** and its 63.2% coverage, the **bias-variance decomposition** view of why bagging cuts variance and boosting cuts bias, why **diversity** among base learners is the necessary condition for an ensemble to beat its members, the leakage trap in stacking (and how out-of-fold predictions fix it), hard vs soft voting, and — importantly — **when NOT to ensemble**. This is the map; Random Forests (bagging) and Gradient Boosting (boosting) are the two territories explored in depth in their own topics.

**Mental model**

Every model's expected error decomposes as **bias^2 + variance + irreducible noise**. Ensembles are two different attacks on this decomposition. **Bagging** attacks *variance*: train many high-variance, low-bias models on resampled data and average them — averaging independent errors cancels them, so variance falls while bias stays put (RF is the archetype). **Boosting** attacks *bias*: start with a weak, high-bias learner and add more learners sequentially, each correcting the residual errors of the ensemble so far — the combined model becomes progressively less biased (GBM/AdaBoost). **Stacking** attacks *both* by learning, via a meta-model, the best way to combine diverse base models. The unifying requirement across all of them is **diversity**: if the base models make the *same* errors, combining them changes nothing. Bagging manufactures diversity via data resampling and feature subsampling; boosting via reweighting toward hard examples; stacking via using genuinely different algorithms. No diversity, no benefit.

**Key terms**

- **Ensemble** — a model that combines predictions of multiple base learners to beat any single one.
- **Base learner / weak learner** — a component model; "weak" means only slightly better than chance (boosting's raw material).
- **Bagging** — parallel: train base models on bootstrap samples, aggregate by average/vote; reduces variance.
- **Boosting** — sequential: each model corrects its predecessors' errors; reduces bias.
- **Stacking** — train a meta-learner on base models' out-of-fold predictions; learns how to combine them.
- **Blending** — like stacking but the meta-learner uses a single holdout set instead of out-of-fold CV; simpler, more leakage-prone.
- **Voting** — combine classifiers by hard vote (majority label) or soft vote (average probabilities).
- **Bootstrap** — sample n rows with replacement; ~63.2% distinct rows, the rest OOB.
- **Diversity** — base models must make different errors; the necessary condition for any ensemble gain.
- **Meta-learner** — the second-stage model in stacking that combines base predictions.
- **Out-of-fold (OOF) predictions** — base predictions generated via CV so the meta-learner never trains on in-sample predictions (prevents leakage).

**Why interviewers ask this**

This topic tests whether you understand ensembles *as a family* rather than memorizing "random forest good." The signature question — "**bagging vs boosting**" — sorts candidates instantly: a strong answer ties bagging to *variance reduction / parallel / independent* and boosting to *bias reduction / sequential / dependent*, and explains the mechanism via bias-variance, not just "one's parallel and one's sequential." Interviewers also probe the **diversity** requirement (why averaging identical models is pointless), the **stacking leakage trap** (a favourite senior gotcha — training the meta-learner on in-sample base predictions leaks), and judgment: **when NOT to ensemble** (interpretability, latency, tiny data). Getting the bias-variance framing right is the difference between reciting definitions and understanding *why* each technique works.

**Common confusions**

- "Bagging and boosting both just combine trees, so they're similar" — they are near-opposites: bagging is parallel and cuts variance, boosting is sequential and cuts bias.
- "Ensembling always improves accuracy" — only if base models are diverse and individually decent; averaging correlated or identically-wrong models does nothing.
- "Boosting reduces variance like bagging" — primarily it reduces bias; it can even *increase* variance and overfit if run too long (hence early stopping).
- "Stacking is just averaging" — no; a meta-learner *learns* the weights (and can be non-linear), and it must train on out-of-fold predictions or it leaks.
- "Voting needs calibrated probabilities" — hard voting doesn't, but soft voting does; averaging miscalibrated probabilities can hurt.

**What follows from this topic**

This is the parent frame for two of the most important algorithms in the primer. **Random Forests** is the deep dive on the bagging branch — bootstrap + feature subsampling to decorrelate and cut variance. **Gradient Boosting (GBM)**, and then XGBoost / LightGBM, are the deep dive on the boosting branch — sequential residual-fitting to cut bias. The bias-variance vocabulary here is owned in full by the sister **ML Fundamentals** primer; reference it. Keep the bagging-vs-boosting table in memory — nearly every tree-ensemble interview funnels back to it.

### Q1. What is an ensemble method and why does combining models beat a single model?

An ensemble combines the predictions of multiple base learners into one stronger prediction. It beats a single model because of the **bias-variance decomposition** of error (`bias^2 + variance + noise`) — ensembles reduce one or both of the reducible terms.

The intuition: if you have several models whose errors are **partly independent**, their mistakes tend to cancel when you average. Formally, averaging B models each with variance sigma^2 and pairwise correlation rho gives variance `rho*sigma^2 + (1-rho)/B*sigma^2` — less than sigma^2 whenever rho < 1. Boosting instead reduces bias by sequentially adding learners that fix residual errors.

The catch: the base models must be **diverse** (make different errors) and individually competent. Averaging identical models, or models that are all wrong the same way, gains nothing. Diversity is the fuel.

### Q2. Explain the difference between bagging and boosting.

| | Bagging | Boosting |
|---|---|---|
| Training | Parallel, independent | Sequential, dependent |
| Data per model | Bootstrap sample | Full data, reweighted toward errors |
| Goal | Reduce **variance** | Reduce **bias** |
| Base learner | Strong, low-bias (deep trees) | Weak, high-bias (stumps/shallow) |
| Combine | Average / majority vote | Weighted sum |
| Overfit from more models | No | Yes (needs early stopping) |
| Example | Random forest | AdaBoost, gradient boosting |

**Bagging** trains many independent high-variance models on resampled data and averages them — the averaging cancels variance. **Boosting** trains models one after another, each focusing on the examples the ensemble still gets wrong, driving down bias. The one-line summary: bagging fixes overfitting (variance), boosting fixes underfitting (bias). This mechanism difference is why they use opposite base learners (deep vs shallow) and why only boosting overfits with more rounds.

### Q3. What is the bootstrap and why is ~63.2% of the data used per sample?

The bootstrap draws a sample of size n from the dataset **with replacement**. Some rows appear multiple times, some not at all.

The probability a specific row is *not* picked in one draw is `(1 - 1/n)`; across n independent draws it's `(1 - 1/n)^n`, which converges to `1/e ~= 0.368` as n grows. So on average **63.2%** of rows are distinct in any bootstrap sample and **36.8%** are left out (out-of-bag).

This matters twice: (1) it creates the data diversity that makes bagged models differ; (2) the ~37% OOB rows give a free validation set per model (OOB error). The bootstrap is also a general statistical tool for estimating the sampling distribution of any statistic without parametric assumptions.

### Q4. Give the bias-variance view of why bagging reduces variance but not bias.

Bagging averages B models trained on bootstrap samples of the same distribution. Each model has roughly the **same bias** as a single model (resampling doesn't systematically shift the fit), so the average's bias is unchanged — bagging does *not* help bias.

Variance is where it acts. The average of B identically-distributed models with variance sigma^2 and correlation rho has variance:

`rho*sigma^2 + (1-rho)/B * sigma^2`

As B grows the second term vanishes; the residual `rho*sigma^2` depends on decorrelation. So bagging pays off most for **high-variance, low-bias** base learners (deep unpruned trees) whose errors are somewhat independent. It's pointless for stable, high-bias learners (e.g. linear regression) — there's little variance to remove and the bias just stays.

### Q5. Give the bias-variance view of why boosting reduces bias.

Boosting starts with a weak, **high-bias** learner (a shallow tree that underfits) and adds learners sequentially, each fit to the errors (residuals / gradient) the current ensemble still makes. Every added term corrects a piece of the systematic error, so the combined model's **bias falls** as rounds accumulate — you are literally building a more expressive function by summing many small corrections.

The cost: as the ensemble grows it starts fitting noise, so **variance rises** and it can overfit — the opposite risk profile from bagging. That's why boosting needs a learning rate (shrinkage), a bounded number of rounds, and **early stopping**. So: bagging = variance down / bias flat; boosting = bias down / variance up (until controlled). They are complementary attacks on the error decomposition.

### Q6. What is stacking, and what is the leakage trap?

Stacking trains a **meta-learner** to combine several diverse base models. Base models (say a random forest, an SVM, a logistic regression) each predict, and their predictions become the *features* for a second-stage meta-model that learns the best combination.

The leakage trap: if you train base models on the full training set and then feed **their in-sample predictions** to the meta-learner, those predictions are overfit-optimistic — the base models have already seen those rows — and the meta-learner learns to over-trust them. It looks great on train, fails on test.

The fix is **out-of-fold (OOF) predictions**: use k-fold CV so each row's base-model prediction comes from a model that did *not* train on that row. The meta-learner then trains on honest, held-out-quality predictions.

```python
from sklearn.ensemble import StackingClassifier
StackingClassifier(estimators=[("rf", rf), ("svm", svm)],
                   final_estimator=LogisticRegression(), cv=5)  # cv -> OOF
```

### Q7. What is the difference between stacking and blending?

Both learn a meta-model on base predictions; they differ in how they generate the training data for the meta-learner:

- **Stacking**: uses **k-fold out-of-fold** predictions — every training row gets a base prediction from a fold where it was held out. Uses all data, lower variance, but more code and more compute.
- **Blending**: splits off a single **holdout set**; base models train on the rest, predict on the holdout, and the meta-learner trains only on that holdout. Simpler and faster, but wastes data and is more prone to overfitting the small holdout (higher variance, more leakage-adjacent risk).

Blending is the quick-and-dirty version; stacking is the principled version. Kaggle winners historically use stacking (or careful blending) with multiple levels. For most production work, the extra complexity of either rarely beats a well-tuned single GBM.

### Q8. Explain hard voting vs soft voting.

Both combine multiple classifiers:

- **Hard voting**: each classifier votes for a class label; the ensemble predicts the **majority** label. Ignores confidence — a 0.51 and a 0.99 prediction count equally.
- **Soft voting**: average the **predicted probabilities** across classifiers, then take the argmax. Weights confident predictions more, usually more accurate — *if* the probabilities are well-calibrated.

```python
from sklearn.ensemble import VotingClassifier
VotingClassifier([("lr", lr), ("rf", rf)], voting="soft")
```

Soft voting generally wins when base models output meaningful probabilities. But if some models are miscalibrated (RF pushes toward the middle, SVM needs Platt scaling), averaging their probabilities can hurt — hard voting or calibrating first can be safer. Voting is the simplest ensemble: no meta-learner, no training beyond the base models.

### Q9. Why is diversity among base learners necessary, and how does each ensemble create it?

If all base models make the **same errors** on the same rows, combining them cannot fix those errors — the ensemble just reproduces one model. Gains come only from errors that are at least partly **independent**, so they cancel on aggregation. Diversity is the necessary condition.

How each family manufactures it:
- **Bagging**: different bootstrap samples + random feature subsets (RF) -> different trees.
- **Boosting**: reweighting toward previously-misclassified examples -> each learner specializes on different hard cases.
- **Stacking/voting**: use genuinely **different algorithms** (linear + tree + kernel) that have different inductive biases.

The recurring formula `rho*sigma^2 + (1-rho)/B*sigma^2` makes this precise: the benefit is governed by how low you can push rho. High diversity = low rho = big variance reduction.

### Q10. When should you NOT use an ensemble?

- **Interpretability is required** — a regulator or clinician needs to see the exact decision rule; a single tree or linear model is auditable, 500 trees are not.
- **Latency / memory constrained** — ensembles are B models; inference cost and model size scale with B. Edge/real-time may demand one small model.
- **Tiny datasets** — with little data the base models are all fit to nearly the same points (low diversity), so the ensemble barely helps and just adds cost.
- **A single model already suffices** — if a well-tuned linear/GBM meets the target, an ensemble of ensembles adds complexity and maintenance burden for marginal gain.
- **The base learner is stable/high-bias** (e.g. linear regression) — bagging it does almost nothing since there's little variance to remove.

Judgment signal: know that ensembles trade interpretability, size, and simplicity for accuracy — and that the trade isn't always worth it.

### Q11. AdaBoost vs gradient boosting — how do they differ within the boosting family?

Both are sequential boosting, but they correct errors differently:

- **AdaBoost** reweights the **data**: after each weak learner, misclassified examples get higher weights so the next learner focuses on them; final prediction is a weighted vote where accurate learners get more say. It's equivalent to a stagewise fit of an **exponential loss**.
- **Gradient boosting** reweights via the **gradient**: each new learner is fit to the **negative gradient of an arbitrary differentiable loss** (residuals for MSE). This generalizes AdaBoost to any loss (log-loss, Huber, quantile) and is the basis of XGBoost/LightGBM.

Practically, gradient boosting subsumed AdaBoost because it handles any loss, regression and classification uniformly, and plugs into second-order optimizations. AdaBoost is now mostly of historical/pedagogical interest; GBM is the modern default.

### Q12. Does bagging help linear models? Why is it mostly used with trees?

Bagging helps only when the base learner is **high-variance and low-bias** — resampling produces meaningfully different models whose errors cancel. Deep decision trees are the poster child: unstable, they swing wildly with data changes, so averaging them pays off hugely.

Linear/logistic regression is the opposite: **stable and higher-bias**. Bootstrap samples produce nearly identical fitted lines (low rho, but also low individual variance), so averaging them barely changes anything — you remove little variance and can't touch the bias. That's why you rarely see bagged linear regression.

Rule of thumb: bag models that overfit (deep trees, fully-grown kNN with small k); don't bother bagging models that are already stable. If your base model underfits, you want **boosting**, not bagging.

### Q13. In one sentence each, place random forest, AdaBoost, XGBoost, and a voting classifier in the taxonomy.

- **Random forest** — *bagging*: parallel bootstrap-sampled deep trees with per-split feature randomization, averaged to reduce variance.
- **AdaBoost** — *boosting*: sequential weak learners with example reweighting toward errors, minimizing exponential loss to reduce bias.
- **XGBoost** — *boosting*: sequential shallow trees fit to the second-order gradient of a regularized loss, the tabular accuracy default.
- **Voting classifier** — *voting*: combine independently-trained diverse models by hard (majority) or soft (probability-average) vote, no meta-learner.

The organizing axes: **parallel vs sequential** (bagging/voting vs boosting) and **what error term is attacked** (variance vs bias). Stacking would be the fifth: a meta-learner trained on out-of-fold base predictions, attacking both.

### Q14. How does averaging reduce variance mathematically? Walk through the independent case.

Take B base models with predictions f_1..f_B, each unbiased with variance sigma^2. The ensemble is their mean `F = (1/B) sum f_i`.

If the models are **perfectly independent** (rho = 0):

`Var(F) = (1/B^2) sum Var(f_i) = (1/B^2) * B*sigma^2 = sigma^2 / B`

Variance drops by a factor of B — ten independent models cut variance tenfold, and bias is unchanged (mean of unbiased estimators is unbiased). That's the ideal.

Reality: models trained on overlapping bootstrap samples are **correlated** (rho > 0), so the true variance is `rho*sigma^2 + (1-rho)/B*sigma^2`. The `sigma^2/B` term is the independent part; the `rho*sigma^2` term is the irreducible floor. This is exactly why random forests work so hard (feature subsampling) to push rho toward zero.

### Q15. Can an ensemble perform worse than its best base model? When?

Yes. Ensembling is not a free lunch:

- **Correlated errors**: if base models all fail on the same hard region, averaging preserves the failure and may dilute a single model that happened to get it right.
- **A weak model drags the average**: in simple averaging/voting, including a much worse model pulls the mean toward its errors. (Weighted combination or stacking can mitigate, but naive voting won't.)
- **Miscalibrated soft voting**: averaging badly-calibrated probabilities can be worse than the best-calibrated member alone.
- **Overfit meta-learner (stacking)**: if trained with leakage (in-sample base predictions), the stack overfits and generalizes worse than a base model.

The guardrails: ensure base models are **diverse and individually decent**, weight or select members rather than dumping everything in, and validate the ensemble against the best single model — don't assume the combination wins.

### Q16. How does the number of base models affect bagging vs boosting differently?

- **Bagging (e.g. RF)**: more models is **monotonically safe**. Each added model only shrinks the `(1-rho)/B*sigma^2` variance term; test error falls then **plateaus** at the `rho*sigma^2` floor. You never overfit by adding trees — you just spend compute for diminishing returns. Pick B where the curve flattens.
- **Boosting (e.g. GBM)**: more rounds is a **double-edged** knob. Early rounds reduce bias and improve test error; past the optimum, added rounds fit noise and test error **rises** — classic overfitting. So the number of estimators is a critical regularization parameter, tuned via a validation curve and **early stopping**, and traded off against the learning rate.

This asymmetry is a favourite interview point: "can more trees hurt?" — No for RF, Yes for boosting. It follows directly from parallel-independent (bagging) vs sequential-dependent (boosting).

## Gradient Boosting (GBM)

### Summary

**What this topic covers**

Gradient boosting — the algorithm behind XGBoost, LightGBM, and most winning tabular models. This topic owns the *core* GBM mechanics; the library-specific engineering (XGBoost's regularized second-order objective, LightGBM's histograms) lives in its own topic. The 16 questions here cover: the **additive, forward-stagewise** model of weak learners; the key insight that each new tree is fit to the **negative gradient of the loss** (residuals for squared error) — i.e. boosting as **gradient descent in function space**; the update `F_m = F_{m-1} + eta*h_m`; the **learning rate (shrinkage) vs n_estimators** tradeoff; **tree depth as interaction order**; why GBM has low bias but overfits without regularization -> **early stopping**, **subsampling (stochastic gradient boosting)**, and shrinkage; how it handles **any differentiable loss** (regression, classification, ranking); and the sharp contrasts with bagging/random forests. This is the bridge from ensemble theory to the XGBoost/LightGBM deep dive.

**Mental model**

Think of gradient boosting as **gradient descent, but the parameter you're optimizing is the whole prediction function**. You want a function F that minimizes a loss L(y, F(x)) summed over the data. Ordinary gradient descent nudges numeric parameters in the negative-gradient direction. GBM does the same in *function space*: at each step it computes the negative gradient of the loss with respect to the current predictions (the "pseudo-residuals" — for squared error these are literally the residuals y - F(x)), then **fits a small tree to those pseudo-residuals**, and adds a shrunk version of that tree to the running model:

`F_m(x) = F_{m-1}(x) + eta * h_m(x)`

Each tree is a step *downhill* on the loss surface, correcting whatever the ensemble currently gets wrong. Start with a constant (the mean, or log-odds), then add hundreds of shallow trees, each a small correction. Because it keeps reducing the residual error, GBM drives **bias** down — the opposite of bagging. The price is that it will happily fit noise if you let it run too long, so shrinkage + early stopping are not optional.

**Key terms**

- **Additive model** — the prediction is a sum of many weak learners: `F(x) = sum_m eta*h_m(x)`.
- **Forward stagewise** — trees are added one at a time; earlier trees are frozen when fitting later ones.
- **Weak learner** — a shallow tree (depth 3-8), individually barely better than guessing.
- **Pseudo-residual** — the negative gradient of the loss at the current prediction; what each new tree is trained to predict.
- **Negative gradient** — the direction that most decreases the loss; residuals `y - F(x)` for squared error.
- **Learning rate / shrinkage (eta)** — scales each tree's contribution; smaller = slower, more robust, needs more trees.
- **n_estimators (M)** — number of boosting rounds / trees; traded off against eta.
- **max_depth** — tree depth; controls the **interaction order** of features the model can capture.
- **Stochastic gradient boosting** — subsample rows (and columns) per tree to add randomness and reduce overfitting.
- **Early stopping** — halt when validation loss stops improving; the primary regularizer against too many trees.
- **Gradient descent in function space** — the framing that makes "fit to the negative gradient" rigorous.

**Why interviewers ask this**

Gradient boosting is the most important tabular algorithm and one of the most misunderstood, so it's a favourite discriminator. The key question — "**how does gradient boosting work / why fit to the negative gradient?**" — sorts candidates by whether they can state the function-space gradient-descent view. A junior says "each tree fixes the previous tree's errors"; a senior says "each tree approximates the negative gradient of the loss, so boosting is gradient descent in function space, and for squared error the gradient *is* the residual." Interviewers then probe the **eta vs n_estimators** tradeoff (the central tuning tension), why GBM overfits and how to stop it (early stopping, subsampling, shrinkage), depth as interaction order, and the RF-vs-GBM contrast. It's the natural launchpad to "why does XGBoost dominate."

**Common confusions**

- "Boosting fits each tree to the previous tree's residual" — only exactly true for squared-error loss; in general each tree fits the **negative gradient** of the loss, which equals the residual *only* for MSE.
- "More trees always helps like in random forests" — false. Past the optimum, extra boosting rounds overfit and raise test error; RF trees never do.
- "Lower learning rate is strictly better" — it generalizes better but requires proportionally more trees and compute; it's a tradeoff, not a free win.
- "GBM uses deep trees" — it uses **shallow** trees (weak learners); depth controls interaction order, and deep trees overfit fast in boosting.
- "Gradient boosting and gradient descent are unrelated" — gradient boosting *is* gradient descent, performed in function space with trees as the step direction.

**What follows from this topic**

This is the theoretical core that the next topic — **XGBoost / LightGBM / CatBoost** — builds real systems on. XGBoost adds a regularized objective and a second-order (Newton) approximation using gradients *and* Hessians; LightGBM adds histogram binning and leaf-wise growth for speed; CatBoost adds ordered boosting and native categoricals. All of them are engineering refinements of the `F_m = F_{m-1} + eta*h_m` idea you master here. The bias-variance and bootstrap groundwork comes from **Bagging & Ensemble Foundations**; the RF contrast from **Random Forests**. If GBM's function-space view is fuzzy, the XGBoost internals won't land — anchor this first.

### Q1. What is gradient boosting, in one clear explanation?

Gradient boosting builds an **additive model of weak learners** (shallow trees) **sequentially**, where each new tree corrects the errors of the ensemble built so far. The final prediction is the sum of all trees:

`F(x) = F_0(x) + eta*h_1(x) + eta*h_2(x) + ... + eta*h_M(x)`

Start with a constant baseline F_0 (the target mean for regression, log-odds for classification). At each round m, compute how wrong the current model is via the **negative gradient of the loss** (pseudo-residuals), fit a small tree h_m to those, and add a shrunk version to the model. Repeat for M rounds.

```python
from sklearn.ensemble import GradientBoostingRegressor
GradientBoostingRegressor(n_estimators=500, learning_rate=0.05, max_depth=3).fit(X, y)
```

The result: low bias (it keeps reducing residual error), strong tabular accuracy — but it overfits if unregularized, so learning rate + early stopping matter.

### Q2. Why is it called "gradient" boosting? Explain fitting the negative gradient.

Because each tree is fit to the **negative gradient of the loss function** with respect to the current predictions — it's gradient descent performed in *function space*.

You want F minimizing `sum_i L(y_i, F(x_i))`. The direction that most reduces this loss at point i is the negative gradient `g_i = -dL/dF(x_i)`. In ordinary gradient descent you'd step parameters by -g. Here, F is a function, so instead you **fit a tree h_m to the pseudo-residuals g_i** and take a step:

`F_m = F_{m-1} + eta * h_m`

For **squared-error loss** L = 0.5*(y - F)^2, the gradient is `dL/dF = -(y - F)`, so the negative gradient is exactly the residual `y - F` — which is why "fit the next tree to the residuals" is the special case people remember. For log-loss the pseudo-residual is `y - p`. Generalizing from residuals to gradients is what lets GBM use **any differentiable loss**.

### Q3. Walk through one boosting iteration in detail.

Given the current model F_{m-1}:

1. **Compute pseudo-residuals** for every training row: `r_i = -[dL(y_i, F(x_i))/dF(x_i)]` evaluated at F_{m-1}. (For MSE: `r_i = y_i - F_{m-1}(x_i)`.)
2. **Fit a regression tree** h_m to predict these r_i from x. The tree partitions feature space into leaves.
3. **Compute the optimal leaf value** for each leaf — the constant that minimizes the loss for rows in that leaf (for MSE it's their mean residual; general loss uses a line-search / Newton step).
4. **Update**: `F_m(x) = F_{m-1}(x) + eta * h_m(x)`, shrinking the tree's contribution by the learning rate eta.
5. Repeat for M rounds (or until early stopping).

The final prediction sums the initial constant and all shrunk trees. Each step is a small downhill move on the loss surface; hundreds of them compose an expressive, low-bias function.

### Q4. Explain the learning rate (shrinkage) and its tradeoff with the number of trees.

The learning rate `eta` (0 < eta <= 1) scales each tree's contribution: `F_m = F_{m-1} + eta*h_m`. It's regularization — small eta means each tree makes only a tiny correction, so no single tree dominates and the model generalizes better.

The tradeoff with n_estimators (M) is tight and roughly **reciprocal**: halving eta needs about double the trees to reach the same training fit. So:
- **Small eta (0.01-0.05) + large M**: better generalization, slower training, the standard high-accuracy recipe.
- **Large eta (0.1-0.3) + small M**: faster, more prone to overfitting, coarser steps.

You do *not* tune them independently — fix a small eta you can afford, then use **early stopping** to pick M automatically at the validation optimum. "Lower eta is better but costs more trees" is the crisp interview line.

### Q5. What does tree depth control in gradient boosting?

`max_depth` controls the **interaction order** — how many features a single tree can combine in one decision path. A depth-1 tree (a stump) is a purely additive model: each tree uses one feature, so the model captures **no feature interactions**. A depth-d tree can capture interactions among up to d features.

- **Shallow (depth 1-2)**: mostly additive, low variance, may underfit if the true function has interactions.
- **Medium (depth 3-6)**: captures modest interactions; the typical sweet spot for tabular data.
- **Deep (depth 8+)**: captures high-order interactions but overfits fast and slows training — in boosting, deep trees are usually a mistake.

Unlike random forests (deep trees, controlled by averaging), boosting uses **shallow weak learners** and relies on many rounds. Depth is one of the three knobs that actually matter (with eta and n_estimators).

### Q6. Why does gradient boosting overfit, and how do you prevent it?

GBM overfits because it **keeps reducing training error** — every added tree fits the current residuals, and past the point where residuals are real signal, trees start fitting **noise**. Bias keeps falling but variance climbs, so test error turns back up. (Contrast RF, where more trees never overfit.)

Regularization levers:
- **Learning rate (shrinkage)** — small eta so each tree contributes little.
- **Early stopping** — monitor validation loss, halt when it stops improving; the primary control on M.
- **Subsampling (stochastic GB)** — train each tree on a random fraction of rows (and columns), adding variance-reducing randomness.
- **Tree constraints** — cap max_depth, raise min_samples_leaf, limit number of leaves.
- **Explicit penalties** — L1/L2 on leaf weights (XGBoost's lambda/alpha), min gain to split (gamma).

The standard recipe: small eta + many trees + early stopping + subsample ~0.8. Depth and min_child_weight tune the rest.

### Q7. What is stochastic gradient boosting?

Stochastic gradient boosting (Friedman) adds **randomness via subsampling**: at each round, fit the tree on a **random subsample of the training rows** (typically 50-80%, drawn *without* replacement) rather than all of them. Modern implementations also subsample **columns** per tree or per split.

Two benefits: (1) it injects diversity that **reduces variance / overfitting** (a bagging-like effect layered onto boosting), and (2) it **speeds up** each round since trees see fewer rows.

```python
GradientBoostingRegressor(subsample=0.8)   # row subsampling per tree
# XGBoost: subsample=0.8, colsample_bytree=0.8
```

The `subsample` fraction is a genuine regularizer — values around 0.5-0.8 often improve test accuracy over 1.0. It's why XGBoost/LightGBM expose both `subsample` and `colsample_*` knobs.

### Q8. Random forest vs gradient boosting — contrast the mechanisms.

| | Random forest | Gradient boosting |
|---|---|---|
| Training | Parallel, independent trees | Sequential, each fits prior errors |
| Attacks | Variance | Bias (primarily) |
| Trees | Deep, fully grown | Shallow weak learners |
| Combine | Average / vote (equal weight) | Weighted additive sum with shrinkage |
| More trees | Never overfits (plateaus) | Can overfit (needs early stopping) |
| Tuning | Forgiving | Sensitive (eta, depth, M) |
| Parallelism | Full | Limited (sequential rounds) |
| Typical accuracy | Strong baseline | Usually higher on tabular |

The core difference: RF **averages independent high-variance trees to cut variance**; GBM **sequentially adds low-depth trees to cut bias**. That single distinction explains every row — the base-learner depth, the overfitting behaviour, the tuning sensitivity, and the parallelism. Choose RF for a fast robust baseline, GBM for peak tabular accuracy when you can tune.

### Q9. How does gradient boosting do classification if it fits regression trees?

Even for classification, GBM's trees are **regression trees fit to gradients**. The trick: model the **log-odds**, not the probability directly.

Start with F_0 = log-odds of the base rate. At each round, convert the current scores to probabilities via the sigmoid `p = 1/(1+exp(-F))`, then compute pseudo-residuals from the **log-loss** gradient, which works out to `r_i = y_i - p_i` (label minus predicted probability). Fit a regression tree to these residuals, update F in log-odds space, and only apply the sigmoid at the end to read off a probability.

For multiclass, fit one regression tree per class per round against the softmax gradients. So "gradient boosting for classification" is really **additive logistic regression built from regression trees** — the loss changes (log-loss instead of MSE) but the machinery is identical.

### Q10. What loss functions can gradient boosting use, and why does that matter?

Any **differentiable** loss — that's GBM's headline flexibility, since it only needs the loss's gradient (and, for second-order methods, its Hessian):

- **Regression**: squared error (MSE), absolute error (MAE, robust to outliers), Huber (a blend), quantile loss (for prediction intervals).
- **Classification**: log-loss / deviance (binary and multiclass via softmax), exponential loss (recovers AdaBoost).
- **Ranking**: pairwise / listwise objectives (LambdaMART — GBM's home turf in search ranking).

Because you plug in any loss and GBM fits its negative gradient, one algorithm covers regression, classification, robust regression, quantile estimation, and ranking. That generality is exactly what separates gradient boosting from AdaBoost (fixed exponential loss) and is why XGBoost lets you pass a custom objective — supply grad + hess and it just works.

### Q11. How do you tune a gradient boosting model? Which hyperparameters matter most?

Tune the few that matter, in rough priority:

1. **learning_rate (eta)** and **n_estimators** together — fix a small eta (0.05-0.1) you can afford, then let **early stopping** on a validation set choose n_estimators. This pair dominates.
2. **max_depth** (or num_leaves in LightGBM) — the interaction order; try 3-8.
3. **subsample** and **colsample_bytree** — ~0.7-0.9 for stochastic regularization.
4. **min_child_weight / min_samples_leaf** — larger = smoother, less overfit.
5. **lambda / alpha / gamma** (XGBoost) — L2/L1 leaf penalties and min split gain, for fine regularization.

```python
xgb.XGBClassifier(learning_rate=0.05, max_depth=4,
                  subsample=0.8, colsample_bytree=0.8,
                  n_estimators=2000, early_stopping_rounds=50)
```

Strategy: small eta + early stopping first, then depth, then subsampling, then penalties. Don't grid-search everything — most of the win is in eta/depth/n_estimators.

### Q12. Why can't gradient boosting be fully parallelized like random forests?

Because boosting is **sequential by definition**: tree m is fit to the residuals of the model *including* trees 1..m-1. You cannot compute tree m before tree m-1 exists — there's a hard data dependency across rounds. Random forests have no such dependency (every tree trains on its own bootstrap sample independently), so they parallelize trivially across cores.

What GBM *can* parallelize is **within** a single tree's construction — evaluating candidate splits across features, building histograms, computing gradients over rows. That's exactly where XGBoost and LightGBM spend their engineering: parallel split-finding, histogram binning, and cache-aware data layout. But the **outer loop over boosting rounds stays serial**. This is a genuine scalability tradeoff versus bagging and a common interview point.

### Q13. What is the initial prediction F_0 in gradient boosting?

F_0 is the **constant that minimizes the loss before any tree is added** — the best single-number guess.

- **Squared error (regression)**: F_0 = **mean of y** (the constant minimizing MSE).
- **Absolute error**: F_0 = **median of y**.
- **Log-loss (binary classification)**: F_0 = **log-odds of the positive rate**, `log(p/(1-p))` where p is the base rate.

Starting from the loss-optimal constant means the first tree already works on the *residual* structure rather than re-learning the mean, which speeds convergence and stabilizes training. Conceptually it's the "zeroth" term of the additive model; every subsequent tree is a correction on top of this baseline.

### Q14. What are pseudo-residuals and how do they generalize plain residuals?

A **pseudo-residual** is the negative gradient of the loss with respect to the current prediction, evaluated per row:

`r_i = -[ dL(y_i, F(x_i)) / dF(x_i) ]` at F = F_{m-1}

It's the direction that most reduces this row's loss — what the next tree should predict.

For **squared error** L = 0.5*(y-F)^2, `dL/dF = -(y-F)`, so `r_i = y_i - F(x_i)` — the ordinary residual. That's the intuitive special case. But for other losses the pseudo-residual differs: for **log-loss** it's `y_i - p_i`; for **MAE** it's `sign(y_i - F(x_i))` (just the sign, which is why MAE boosting is robust to outliers — big errors don't get big gradients). Generalizing "residual" to "negative gradient" is precisely what lets one algorithm optimize any differentiable loss.

### Q15. What is the role of the Hessian / second-order information in modern gradient boosting?

Plain GBM uses only the **first-order** gradient (steepest descent in function space). XGBoost and friends add the **second-order term** (the Hessian) — a Newton-style step. Expand the loss with a second-order Taylor approximation around the current prediction:

`L ~= sum_i [ g_i * f(x_i) + 0.5 * h_i * f(x_i)^2 ] + regularization`

where g_i is the gradient and h_i the Hessian at row i. Using h_i gives better-scaled steps: the optimal leaf weight becomes `-sum(g)/(sum(h) + lambda)` and the split-gain formula uses both G and H sums. This converges faster and more stably than first-order, and the Hessian naturally weights rows by their loss curvature.

It's the key mathematical upgrade from classic GBM to XGBoost — same additive framework, but Newton's method instead of gradient descent. (Detailed in the XGBoost topic.)

### Q16. When would you choose gradient boosting, and when would you avoid it?

**Choose GBM when:**
- The data is **tabular / structured** with mixed numeric + categorical features — it's the accuracy default (XGBoost/LightGBM win most tabular Kaggle competitions).
- You have a **medium-to-large** dataset and can afford to tune.
- You need a **specific loss** — quantile intervals, ranking, robust regression.
- You want strong accuracy from features without heavy engineering (handles non-linearities and interactions automatically).

**Avoid or reconsider when:**
- You need **interpretability / auditability** — hundreds of trees are opaque; use a linear model or single tree (or add SHAP, at cost).
- **Very small data** — it overfits and a regularized linear model may match it.
- **Low-latency / tiny-memory** deployment — the model is large and inference is sequential per tree.
- Data is **unstructured** (images, audio, text) — deep learning dominates there.
- The task needs **extrapolation** beyond the training range — like all tree models, GBM can't.

The heuristic: tabular + accuracy-first -> gradient boosting; interpretability/latency/tiny-data/unstructured -> something else.
## XGBoost

### Summary

**What this topic covers**

XGBoost (eXtreme Gradient Boosting) as an algorithm, not just a library — why it dominated tabular ML competitions and production pipelines from ~2015 onward. This topic assumes you already understand plain gradient boosting (see the **Gradient boosting (GBM)** topic); here we go into what XGBoost adds *on top* of GBM: (1) a **regularized objective** that penalizes tree complexity, (2) a **second-order (Newton) approximation** that uses both the gradient and the Hessian of the loss, (3) the **split-gain formula** that falls directly out of that objective, (4) **sparsity-aware** split finding with a learned default direction for missing values, (5) the **weighted quantile sketch** for approximate split proposals, and (6) the **systems engineering** (column blocks, cache-aware access, out-of-core, parallel split finding) that made it fast. The 16 questions here cover the objective and its derivation, the key hyperparameters and their bias-variance effect, complexity, and the "why does XGBoost win on tabular" interview classic.

**Mental model**

XGBoost is gradient boosting where each new tree is chosen to minimize a **regularized second-order Taylor expansion** of the loss around the current prediction. Plain GBM fits each tree to the negative gradient (a first-order / steepest-descent view). XGBoost goes one order further: for each training row it computes `g_i` (first derivative of loss wrt the current prediction) and `h_i` (second derivative, the Hessian), then treats tree-building as an optimization problem in `g` and `h`. Because the objective also charges a penalty per leaf (`gamma`) and an L2 penalty on leaf weights (`lambda`), the optimal leaf value and the *value of a split* both have closed forms. So instead of a heuristic impurity like Gini, XGBoost has a principled **gain** number: how much the regularized objective improves if I make this split. Trees are grown greedily, splits with negative gain are pruned, and each tree's contribution is shrunk by the learning rate `eta` before being added. Everything else — histograms, missing-value handling, subsampling, parallelism — is engineering around that core.

**Key terms**

- **Regularized objective** — `Obj = sum loss(y_i, yhat_i) + sum over trees Omega(tree)`, where `Omega(f) = gamma*T + 0.5*lambda*sum(w_j^2)` penalizes the number of leaves T and the leaf weights w_j.
- **Gradient g_i / Hessian h_i** — first and second derivatives of the loss wrt the current prediction for row i; XGBoost needs both.
- **Second-order approximation** — Taylor-expand the loss to 2nd order so the per-leaf optimal weight and split gain have closed forms.
- **Optimal leaf weight** — `w_j* = -G_j / (H_j + lambda)`, where `G_j = sum g_i` and `H_j = sum h_i` over rows in leaf j.
- **Split gain** — `Gain = 0.5*[ G_L^2/(H_L+lambda) + G_R^2/(H_R+lambda) - (G_L+G_R)^2/(H_L+H_R+lambda) ] - gamma`.
- **gamma (min_split_loss)** — minimum gain required to keep a split; acts as pre-pruning / complexity control.
- **lambda / alpha** — L2 and L1 penalties on leaf weights (`reg_lambda`, `reg_alpha`).
- **eta (learning_rate)** — shrinkage applied to each tree; smaller eta needs more trees but generalizes better.
- **Sparsity-aware split finding** — each split learns a **default direction** for missing (or zero, in sparse data) values.
- **Weighted quantile sketch** — approximate split-point proposal using candidate quantiles weighted by the Hessian.
- **colsample_bytree / subsample** — column and row subsampling, adding randomness that decorrelates trees and regularizes.
- **min_child_weight** — minimum sum of Hessians `H_j` in a child; a larger value blocks splits on thin, noisy leaves.

**Why interviewers ask this**

XGBoost is *the* tabular baseline, so "why does it work" separates people who ran `XGBClassifier()` from people who understand it. A junior answer stops at "it's boosting with regularization and it's fast." A senior answer derives the leaf-weight and gain formulas from the second-order objective, explains that the Hessian is what makes it "second-order" (versus GBM's first-order gradient step), and can map each major hyperparameter to a bias-variance lever: `eta` and `n_estimators` trade off together, `max_depth` / `min_child_weight` / `gamma` control per-tree complexity, `subsample` / `colsample_bytree` add regularizing randomness, `lambda` / `alpha` shrink leaf weights. Bonus signal: knowing the sparsity-aware missing-value trick and that XGBoost does *not* impute — it learns which way missing goes.

**Common confusions**

- "XGBoost fits residuals" — only loosely. It fits a tree to minimize a second-order approximation using g AND h; for squared error the gradient equals the residual, but for log-loss it does not.
- "The Hessian is a nice-to-have" — no, it defines the objective; the optimal leaf weight `-G/(H+lambda)` and the gain formula are pure consequences of using h.
- "gamma and lambda do the same thing" — gamma penalizes the *number of leaves* (structure), lambda penalizes *leaf weight magnitude* (value). Different regularizers.
- "XGBoost imputes missing values" — it does not impute; it learns a default branch direction per split.
- "More trees always helps" — with fixed eta, too many trees overfit; use early stopping on a validation set.
- "XGBoost is level-wise, LightGBM is leaf-wise, so XGBoost is always slower" — XGBoost also has a leaf-wise / histogram mode (`grow_policy='lossguide'`, `tree_method='hist'`); the classic contrast is the default, not a hard limit.

**What follows from this topic**

This topic is the bridge between **Gradient boosting (GBM)** (the general algorithm) and **LightGBM & CatBoost** (the faster/categorical successors). The split-gain and regularized-objective ideas here recur there. The bias-variance framing of hyperparameters connects to the **Hyperparameters & implementation** topic in the ML Fundamentals sister primer — reference it rather than re-deriving bias-variance. For "when do I reach for boosting vs a linear model vs an SVM," see **Algorithm selection & tradeoffs**.

### Q1. What is XGBoost and how does it differ from plain gradient boosting?

XGBoost is a gradient-boosted decision tree algorithm that keeps GBM's core idea — build an additive model of shallow trees, each correcting the previous ensemble's errors — but adds a **regularized objective** and a **second-order optimization** of it, plus a lot of systems engineering.

The differences that matter:

- **Regularization in the objective.** Plain GBM's objective is just the training loss; XGBoost adds `Omega(tree) = gamma*T + 0.5*lambda*sum(w_j^2)`, penalizing the number of leaves and the leaf weights. This is baked into split selection, not bolted on afterward.
- **Second-order (Newton) step.** GBM fits each tree to the negative gradient (first-order). XGBoost uses both the gradient `g_i` and Hessian `h_i`, giving closed-form optimal leaf weights and a principled split gain.
- **Sparsity-aware splits.** A learned default direction handles missing values natively.
- **Engineering.** Approximate split finding via a weighted quantile sketch, column-block storage for parallel/cache-friendly split search, and out-of-core support for data bigger than RAM.

Net effect: same conceptual algorithm, but better-regularized, more accurate per tree, and dramatically faster in practice.

### Q2. Derive the optimal leaf weight and the split-gain formula.

Start from the regularized objective at boosting round t, where we add a tree `f_t`:

```
Obj(t) = sum_i loss(y_i, yhat_i^(t-1) + f_t(x_i)) + Omega(f_t)
```

Taylor-expand the loss to second order around the current prediction `yhat^(t-1)`. With `g_i = d loss / d yhat` and `h_i = d^2 loss / d yhat^2`:

```
Obj(t) ~= sum_i [ g_i*f_t(x_i) + 0.5*h_i*f_t(x_i)^2 ] + gamma*T + 0.5*lambda*sum_j w_j^2
```

A tree assigns every row in leaf j the same weight `w_j`. Group rows by leaf and let `G_j = sum g_i`, `H_j = sum h_i` over leaf j:

```
Obj(t) = sum_j [ G_j*w_j + 0.5*(H_j + lambda)*w_j^2 ] + gamma*T
```

This is quadratic in each `w_j`; minimize by setting the derivative to zero:

```
w_j* = -G_j / (H_j + lambda)
```

Substituting back gives the objective for a fixed tree structure:

```
Obj* = -0.5 * sum_j G_j^2/(H_j + lambda) + gamma*T
```

The term `G_j^2/(H_j+lambda)` is a "quality score" for a leaf (lower Obj is better). Splitting one leaf into L and R changes the objective; the **gain** is the improvement:

```
Gain = 0.5*[ G_L^2/(H_L+lambda) + G_R^2/(H_R+lambda) - (G_L+G_R)^2/(H_L+H_R+lambda) ] - gamma
```

XGBoost evaluates this gain for every candidate split and picks the max; if the best gain is negative, it does not split (that is what `gamma` controls). This is the single most important formula to be able to reproduce in an interview.

### Q3. Why is the Hessian important — what does "second-order" buy you?

The Hessian `h_i` weights each row by the local curvature of the loss. Three concrete benefits:

1. **Closed-form leaf weights.** Because the objective is quadratic in the leaf weight, the optimum is exactly `-G/(H+lambda)` — no line search per leaf, unlike first-order GBM which fits a value then optionally does a separate step-size search.
2. **A principled split criterion.** The gain formula uses `G^2/(H+lambda)`, so splits are judged by how much they reduce the *actual regularized loss*, not a proxy impurity like Gini.
3. **Better handling of different losses.** For squared error `h_i = 1` (constant), so the second order collapses to something residual-like. But for log-loss `h_i = p_i*(1 - p_i)` — rows the model is unsure about (p near 0.5) get more weight, rows it is confident about get little. That adaptive weighting is exactly Newton's method and it converges faster than plain gradient steps.

`min_child_weight` is literally a threshold on `sum h_i` in a child, which for regression means "minimum number of rows" but for classification means "minimum confidence mass" — a subtle point worth mentioning.

### Q4. How does XGBoost handle missing values?

It does **not** impute. For each split, XGBoost tries sending all missing-valued rows to the left child and to the right child, computes the gain both ways, and stores whichever direction gives higher gain as that split's **default direction**. At predict time, a row missing that feature simply follows the learned default branch.

This "sparsity-aware split finding" also makes training on sparse data (one-hot columns, bag-of-words) efficient: the algorithm only enumerates the non-missing/non-zero entries when scanning for splits, then assigns the sparse entries to the default direction in one shot. So the per-split cost scales with the number of *present* values, not the full matrix.

Practical implication: do not blindly fill NaNs with 0 or the mean before XGBoost — you may destroy signal it would have learned to route. Let it see the missingness.

### Q5. Walk through the key hyperparameters and their bias-variance effect.

Group them by what they control:

**Number and size of steps**
- **eta / learning_rate** (default 0.3, usually lower): shrinks each tree's contribution. Lower eta = slower learning = less variance but needs more trees. Higher eta = risk of overfitting.
- **n_estimators / num_round**: number of boosting rounds. More trees reduce bias but eventually overfit; pair with early stopping.

**Per-tree complexity (control overfitting)**
- **max_depth** (typ. 3–8): deeper trees model higher-order interactions but overfit. The main variance knob.
- **min_child_weight**: minimum Hessian sum per child; larger = more conservative = less variance.
- **gamma / min_split_loss**: minimum gain to make a split; larger = fewer splits = less variance.

**Randomization (regularize + speed)**
- **subsample** (row sampling, 0.5–1.0) and **colsample_bytree/bylevel/bynode** (column sampling): each tree sees a random subset, decorrelating trees and reducing overfitting, similar in spirit to a random forest.

**Weight penalties**
- **lambda (reg_lambda, L2)** and **alpha (reg_alpha, L1)**: shrink leaf weights; L1 can push some to zero.

Typical tuning recipe: fix a low eta (e.g. 0.05), tune `max_depth` and `min_child_weight` first, then `subsample`/`colsample_bytree`, then `gamma`/`lambda`, and finally raise `n_estimators` with early stopping.

### Q6. Why did XGBoost become the default for tabular data?

Several reinforcing reasons:

- **Accuracy on heterogeneous tabular data.** Trees handle mixed numeric/categorical scales, non-linearities, and interactions without feature engineering; boosting drives bias down; regularization keeps variance in check. On typical structured datasets it beats linear models and often neural nets.
- **Robust defaults + strong tunability.** It works reasonably out of the box and rewards tuning, so it fits both quick baselines and squeezed-out competition solutions.
- **Speed and scale.** Approximate split finding, histogram mode, parallel split search, cache-aware access, and out-of-core support made it fast enough for large data when it launched.
- **Missing-value handling and sparsity awareness** remove a whole preprocessing step.
- **Ecosystem.** sklearn-compatible API, GPU support, feature importance, early stopping, wide language bindings.

In interviews, the crisp version: "Gradient boosting gives low bias by fitting errors sequentially; XGBoost's regularized second-order objective and engineering made that both accurate and fast on exactly the messy, mixed-type, medium-sized tables that dominate real business problems — where deep nets historically underperform."

### Q7. What is the split-gain formula telling you intuitively, and what is gamma's role?

`Gain = 0.5*[G_L^2/(H_L+lambda) + G_R^2/(H_R+lambda) - (G_L+G_R)^2/(H_L+H_R+lambda)] - gamma`.

Read `G^2/(H+lambda)` as a leaf's "score" — how strongly and confidently the gradients in that leaf point in one direction. The bracket is (score of left child) + (score of right child) - (score if we had not split). A split is worth making only if separating the rows lets each side point more coherently than the combined parent, i.e. the children's summed score exceeds the parent's.

**gamma** is a flat toll subtracted from every split's gain. If the structural improvement doesn't clear `gamma`, the split is rejected. So gamma is a pre-pruning / minimum-improvement threshold: raise it to get smaller, more conservative trees (higher bias, lower variance). It complements `lambda`, which instead shrinks the *magnitude* of leaf weights.

### Q8. What is the time and space complexity of training XGBoost?

For the **exact greedy** algorithm, the dominant cost is scanning candidate splits. Sorting each feature once costs `O(n log n)` per feature; finding the best split at a node scans the sorted values. Overall a rough bound is `O(K * d * n * log n)` for K trees over d features and n rows (the log n from sorting; XGBoost caches sorted column blocks so it sorts once, not per node).

The **approximate / histogram** method (`tree_method='hist'` or `'approx'`) buckets each feature into a fixed number of bins (say q), so split search at a node is `O(d * q)` instead of `O(d * n)`; building histograms is `O(n * d)` per level. This is what makes large-n training feasible and is the same idea LightGBM is built around.

Space is `O(n * d)` for the data plus the sorted **column blocks** (the compressed sparse structure that enables parallel, cache-friendly split finding and out-of-core training when it exceeds RAM).

### Q9. What is the weighted quantile sketch and why "weighted"?

For large data you cannot test every possible split point, so XGBoost proposes a set of candidate split points from feature quantiles (the "approximate" algorithm). The twist: instead of ordinary quantiles that weight every row equally, XGBoost weights each row by its **Hessian h_i** when computing the quantiles.

Why weight by h? Because the second-order objective can be rewritten as a weighted squared error where each row's weight is exactly `h_i`. So a row with large curvature contributes more to the loss and deserves finer split resolution around it. The **weighted quantile sketch** is a data structure that computes these Hessian-weighted approximate quantiles in a streaming, mergeable way (supporting distributed and out-of-core settings). Result: candidate splits are placed where they matter most for the loss, with accuracy close to the exact greedy search at a fraction of the cost.

### Q10. How does XGBoost achieve parallelism if boosting is sequential?

The boosting *rounds* are inherently sequential — tree t depends on tree t-1's predictions. XGBoost does not parallelize across rounds. Instead it parallelizes *within* the construction of a single tree:

- **Feature-parallel split finding.** Data is stored in sorted, compressed **column blocks**. Finding the best split means, for each feature, scanning its column to evaluate gains — and different features can be scanned by different threads simultaneously, then the best is reduced.
- **Cache-aware access.** Gradient/Hessian statistics are prefetched into cache-friendly buffers so the split scan does not stall on random memory access.
- **Out-of-core.** Blocks are compressed on disk and streamed, with sharding across disks, so datasets larger than RAM still train.

So the answer to "isn't boosting serial?" is: yes across trees, but each tree's split search over features and data is embarrassingly parallel, and that is where the speedup comes from.

### Q11. How do you prevent overfitting in XGBoost?

Multiple, complementary levers:

1. **Shrinkage (eta).** Lower learning rate + more rounds generalizes better than a few aggressive trees.
2. **Early stopping.** Monitor a validation metric and stop when it stops improving (`early_stopping_rounds`); this picks `n_estimators` for you.
3. **Tree complexity limits.** `max_depth`, `min_child_weight`, `gamma` — shallower trees, minimum child mass, minimum split gain.
4. **Subsampling.** `subsample` (rows) and `colsample_bytree` (columns) inject randomness that decorrelates trees.
5. **Weight penalties.** `lambda` (L2) and `alpha` (L1) on leaf weights.

```python
from xgboost import XGBClassifier

model = XGBClassifier(
    n_estimators=2000, learning_rate=0.03,
    max_depth=4, min_child_weight=5, gamma=0.5,
    subsample=0.8, colsample_bytree=0.8,
    reg_lambda=2.0, reg_alpha=0.0,
    eval_metric="auc", early_stopping_rounds=50,
)
model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
```

The order of impact is usually eta + early stopping first, then depth and subsampling, then the explicit penalties.

### Q12. XGBoost vs random forest — when would you pick each?

Both are tree ensembles, but they attack error differently:

| | Random forest | XGBoost |
|---|---|---|
| Ensemble type | Bagging (parallel) | Boosting (sequential) |
| Reduces mainly | Variance | Bias (then variance via regularization) |
| Trees | Deep, decorrelated | Shallow, additive |
| Tuning | Little; robust defaults | More; rewards careful tuning |
| Overfitting | Hard to overfit by adding trees | Can overfit; needs eta/early stopping |
| Speed | Trivially parallel | Sequential rounds, parallel splits |

Pick **random forest** when you want a strong, low-effort baseline, need robustness with minimal tuning, or want simple parallelism and OOB validation. Pick **XGBoost** when you want the highest accuracy on tabular data and are willing to tune, when you have missing values you want handled natively, or when you need to squeeze out performance. In practice XGBoost usually edges out RF on accuracy but at the cost of tuning effort and overfitting risk.

### Q13. How does XGBoost compute feature importance, and what are the caveats?

XGBoost exposes several importance types:

- **weight / frequency** — how many times a feature is used in a split. Biased toward high-cardinality features (more possible split points).
- **gain** — total gain contributed by splits on that feature (usually the most meaningful default).
- **cover** — total Hessian (sample coverage) of splits on the feature.
- **total_gain / total_cover** — sums rather than averages.

Caveats: these are all impurity/gain-based and share the classic tree-importance biases — they inflate high-cardinality and continuous features, are unstable under correlated features (importance splits arbitrarily between correlated columns), and reflect *training* structure, not out-of-sample effect. For a more faithful, model-agnostic picture use **permutation importance** on held-out data or **SHAP values** (XGBoost has fast native SHAP support), which attribute each prediction to features consistently. Mention SHAP in a senior interview.

### Q14. What loss functions can XGBoost optimize, and what does that require?

Any loss that is twice-differentiable in the prediction, because the algorithm needs a gradient `g` and Hessian `h` per row. Built-ins include squared error (`reg:squarederror`), logistic (`binary:logistic`), softmax (`multi:softmax`/`softprob`), Poisson, gamma, Tweedie, and ranking objectives (`rank:pairwise`, `rank:ndcg`). 

You can also supply a **custom objective**: a function returning `(grad, hess)` given predictions and labels. For example, for squared error `g = yhat - y` and `h = 1`; for logistic `g = p - y` and `h = p*(1-p)`. As long as you can hand XGBoost those two arrays, it will optimize your loss with the same machinery. This is why "XGBoost handles any differentiable loss" is a genuine feature, not marketing — the second-order objective only ever touches the loss through g and h.

### Q15. What is the difference between tree_method='exact', 'approx', and 'hist'?

- **exact** — the original greedy algorithm: for each node, enumerate every possible split point on every feature using pre-sorted column blocks. Most accurate split selection, but `O(n)` per feature per node; does not scale to very large n and cannot use the histogram optimizations.
- **approx** — proposes candidate split points per node using the weighted quantile sketch, then evaluates only those. Recomputes candidate points per node (local proposals). Much cheaper for large data.
- **hist** — buckets each feature into a fixed number of bins *once*, then builds gradient/Hessian **histograms** per node and scans bins (`O(bins)` not `O(n)`). Fastest, low memory, supports GPU; this is the LightGBM-style approach that XGBoost adopted. Default in modern XGBoost.

For most work today `hist` is the right choice; `exact` only for small data where you want the theoretically best splits.

### Q16. Does XGBoost handle categorical features, and how should you encode them?

Historically XGBoost had **no native categorical support** — you had to encode categoricals yourself: one-hot for low cardinality, or target/ordinal encoding for high cardinality (being careful about leakage — do target encoding inside CV folds). One-hot plays fine with sparsity-aware splits but blows up dimensionality for high-cardinality features.

Recent XGBoost versions added **experimental native categorical support** (`enable_categorical=True` with pandas `category` dtype), where the tree can make partition-based splits on category subsets rather than requiring one-hot. But it is newer and less battle-tested than CatBoost's or LightGBM's categorical handling. So the honest interview answer: XGBoost can now handle categoricals natively, but if categoricals are central to your problem, **CatBoost** (ordered target statistics) or **LightGBM** (native categorical splits) are usually the better-engineered choice — which is exactly the segue into the next topic.

## LightGBM & CatBoost

### Summary

**What this topic covers**

The two gradient-boosting libraries that followed XGBoost and specialized: **LightGBM** (Microsoft) for raw speed and scale on large data, and **CatBoost** (Yandex) for correctness on categorical-heavy data and out-of-the-box robustness. This topic assumes the **XGBoost** and **Gradient boosting (GBM)** topics; here we focus on what is *different*. For LightGBM: **histogram-based** split finding, **leaf-wise (best-first)** tree growth versus XGBoost's level-wise growth, and the two headline tricks — **GOSS** (Gradient-based One-Side Sampling) and **EFB** (Exclusive Feature Bundling). For CatBoost: **ordered boosting** (a permutation-based scheme that fights the target-leakage / prediction-shift problem inherent to boosting) and native **categorical** handling via **ordered target statistics**. The 16 questions cover each mechanism, the failure modes they fix, a head-to-head comparison table, and the practical "which one do I reach for" decision. The point is not library trivia — it is understanding the algorithmic ideas (histograms, leaf-wise growth, gradient-biased sampling, ordered statistics) well enough to reason about speed and overfitting.

**Mental model**

All three (XGBoost, LightGBM, CatBoost) are gradient-boosted trees; they differ in how they find splits and grow trees. **LightGBM** is "make boosting fast": bin every continuous feature into a histogram once, so split search costs O(bins) not O(rows); grow **leaf-wise** (always split the leaf with the highest gain anywhere in the tree) instead of level-wise, which reaches lower loss with fewer splits but grows unbalanced, deeper trees that overfit unless you cap `num_leaves`; and shrink the data itself with GOSS (keep all large-gradient rows, subsample small-gradient ones) and EFB (bundle mutually-exclusive sparse features into one). **CatBoost** is "make boosting correct on categoricals": ordinary target encoding leaks the label, and standard boosting reuses the same rows to compute gradients that were used to fit the model (prediction shift). CatBoost fixes both with **ordering** — for each row, statistics and gradients are computed using only rows that came *before* it in a random permutation, so a row's own label never contaminates its own features or gradient.

**Key terms**

- **Histogram-based splitting** — bin continuous features into discrete buckets; build per-bin gradient histograms and scan bins for the best split. Big speed and memory win.
- **Leaf-wise (best-first) growth** — split the single leaf with maximum gain across the whole tree; lower loss per split but unbalanced, deeper trees.
- **Level-wise (depth-wise) growth** — XGBoost's default: grow all nodes at a depth before going deeper; more balanced, easier to regularize by depth.
- **num_leaves** — LightGBM's main complexity knob (leaf-wise has no natural depth); the key overfitting control.
- **GOSS (Gradient-based One-Side Sampling)** — keep all rows with large gradients, randomly sample rows with small gradients, and up-weight those sampled to keep statistics unbiased.
- **EFB (Exclusive Feature Bundling)** — bundle sparse features that are rarely nonzero simultaneously into a single feature, cutting effective feature count.
- **Prediction shift** — the bias from using the same training rows both to fit the model and to compute the gradients used to fit the next tree.
- **Ordered boosting** — CatBoost's fix: for each row use a model trained only on rows preceding it in a random permutation.
- **Ordered target statistics** — CatBoost's categorical encoding: replace a category with a label average computed only from earlier rows in a permutation, avoiding target leakage.
- **Oblivious (symmetric) trees** — CatBoost's default tree type: the same split condition on every node at a given depth; acts as regularization and gives very fast inference.
- **Categorical feature** — a variable with discrete unordered levels; the thing CatBoost handles natively and the others historically needed encoding for.

**Why interviewers ask this**

Once someone says "I use gradient boosting," the natural follow-up is "XGBoost, LightGBM, or CatBoost, and why?" A weak candidate treats them as interchangeable. A strong candidate can say: LightGBM when data is large and mostly numeric and I want speed (histogram + leaf-wise + GOSS/EFB); CatBoost when I have many categorical features or want strong defaults with less tuning and less overfitting (ordered boosting + ordered target stats); XGBoost as the mature, widely-supported middle ground. Deeper signal comes from explaining *why* leaf-wise growth overfits (so you cap num_leaves), *why* ordinary target encoding leaks (so ordered target statistics exist), and *what problem* GOSS solves (small-gradient rows are already well-fit, so spend compute on the hard ones). It is a compact test of whether you understand boosting mechanics, not just APIs.

**Common confusions**

- "LightGBM is just XGBoost but faster" — the speed comes from specific algorithmic choices (histogram, leaf-wise, GOSS, EFB), each with tradeoffs; leaf-wise in particular changes overfitting behavior.
- "Leaf-wise is strictly better than level-wise" — it reaches lower training loss per split but overfits small datasets; you must cap `num_leaves` / `min_data_in_leaf`.
- "CatBoost is only for categorical data" — it is excellent there, but ordered boosting helps on purely numeric data too, and its defaults are strong.
- "Target encoding is safe if I just take the mean" — naive target encoding leaks the label and causes prediction shift; that is the whole reason ordered target statistics exist.
- "num_leaves and max_depth are the same knob" — in leaf-wise growth `num_leaves` is primary; `max_depth` is a secondary cap. `num_leaves <= 2^max_depth`.
- "GOSS is just random subsampling" — it is biased sampling (keep big gradients, sample small ones) with reweighting to stay unbiased, not uniform subsampling.

**What follows from this topic**

This closes the boosting arc that runs **Gradient boosting (GBM)** → **XGBoost** → **LightGBM & CatBoost**. The categorical-encoding and leakage discussion connects to the data-leakage material in the ML Fundamentals sister primer — reference it. For "given my dataset, do I even want boosting versus a linear model, SVM, or random forest," go to **Algorithm selection & tradeoffs**, where gradient-boosted trees are named the tabular default.

### Q1. What is LightGBM and what makes it faster than XGBoost?

LightGBM is a gradient-boosting framework built for speed and scale on large datasets. Four ideas drive its speed:

1. **Histogram-based split finding.** It bins each continuous feature into a small number of discrete buckets (default 255) once, then builds a per-bin histogram of gradients/Hessians at each node and scans bins. Split search is O(#bins) instead of O(#rows), and binned data is far smaller in memory. (XGBoost later added this as `tree_method='hist'`.)
2. **Leaf-wise growth.** It splits the leaf with the highest gain anywhere in the tree, reaching a lower loss with fewer splits than level-wise growth.
3. **GOSS.** It keeps all large-gradient rows and subsamples small-gradient (already well-fit) rows, so each tree trains on fewer rows without much accuracy loss.
4. **EFB.** It bundles sparse, mutually-exclusive features into single features, reducing the effective feature count.

The combination makes LightGBM typically several times faster than exact XGBoost with comparable accuracy, especially as rows and features grow.

### Q2. Explain histogram-based split finding and its tradeoffs.

Instead of considering every distinct feature value as a candidate split point, LightGBM discretizes each feature into a fixed number of **bins** (e.g. 255) up front. During tree building, at each node it accumulates the sum of gradients and Hessians into per-bin histograms in a single O(n) pass over the rows, then evaluates split gain by scanning the O(#bins) boundaries.

Benefits:
- **Speed**: split search is O(#bins) not O(#distinct values ~ n).
- **Memory**: features stored as small bin indices (e.g. uint8), not floats.
- **A histogram subtraction trick**: a node's histogram equals its parent's minus its sibling's, so you only build the smaller child's histogram and subtract — roughly halving histogram work.

Tradeoff: binning is a lossy approximation of split points, so you can miss the exact optimal threshold. In practice, with a few hundred bins the accuracy cost is negligible and far outweighed by the speed. Fewer bins = faster + more regularization but coarser splits; more bins = finer but slower.

### Q3. Leaf-wise vs level-wise tree growth — what is the difference and why does it matter?

**Level-wise (depth-wise)** growth, XGBoost's default, expands all nodes at the current depth before descending — the tree stays balanced and depth is a clean complexity knob.

**Leaf-wise (best-first)** growth, LightGBM's default, always splits the single leaf with the highest gain anywhere in the tree, regardless of depth. So it drives training loss down faster with the same number of leaves, but the tree grows **unbalanced and deep** along the informative branches.

Why it matters:
- Leaf-wise usually gets **lower loss for a fixed number of leaves** — more accurate per unit of tree.
- But it **overfits more readily**, especially on small datasets, because it will keep chasing gain down a narrow path.
- The fix is to constrain it: cap **num_leaves**, set **min_data_in_leaf** (minimum rows per leaf), and optionally **max_depth**. Getting `num_leaves` right is the single most important LightGBM tuning decision, and a common beginner mistake is leaving it high on small data.

### Q4. What is GOSS (Gradient-based One-Side Sampling)?

GOSS is LightGBM's way of training each tree on fewer rows without biasing the result. The insight: a row's **gradient magnitude** measures how poorly the current model fits it. Rows with small gradients are already well-predicted and contribute little new information; rows with large gradients are where the model still has work to do.

So GOSS:
1. Sorts rows by absolute gradient.
2. **Keeps the top a% large-gradient rows entirely.**
3. **Randomly samples b% of the remaining small-gradient rows.**
4. **Up-weights the sampled small-gradient rows by (1-a)/b** when computing information gain, so the gradient statistics remain (approximately) unbiased despite dropping rows.

The result is fewer rows per split evaluation — a speedup — while concentrating attention on the hard examples, and the reweighting keeps the gain estimates honest. It is a smarter alternative to uniform row subsampling.

### Q5. What is EFB (Exclusive Feature Bundling)?

EFB reduces the effective number of features on **sparse, high-dimensional** data. In such data (think one-hot encodings, bag-of-words) many features are **mutually exclusive** — they are rarely nonzero at the same time. EFB bundles such features into a single "bundle" feature by giving each original feature a disjoint range of bin values, so a bundle can be scanned as one feature.

Concretely, if feature A takes bins 0–9 and feature B is exclusive with A, EFB offsets B's values (e.g. add 10) so A and B occupy non-overlapping bin ranges within one combined feature. Finding a maximal set of mutually-exclusive features to bundle is graph-coloring-like (NP-hard), so LightGBM uses a greedy heuristic that allows a small conflict rate. The payoff: histogram building cost scales with the number of *bundles*, not the original feature count — a large speedup on sparse data with essentially no accuracy loss.

### Q6. What is CatBoost and what problem does it primarily solve?

CatBoost is a gradient-boosting library from Yandex whose two signature contributions are **native categorical feature handling** and **ordered boosting**, both aimed at a subtle but real bias in standard boosting/encoding pipelines: **target leakage / prediction shift**.

The problem: two common practices leak the label. (1) **Target (mean) encoding** replaces a category with the average label for that category — but if you include a row's own label in that average, the feature secretly encodes the target. (2) Standard boosting computes the gradients used to fit tree t from the *same* rows the model was trained on, so predictions are biased on the training set (prediction shift), and this bias compounds over rounds.

CatBoost fixes both with **ordering**: impose a random permutation and, for each row, compute categorical statistics and gradients using only the rows that come *before* it. A row therefore never sees its own label. On top of that it uses **oblivious (symmetric) trees** for regularization and fast inference. The result is a boosting library with strong defaults, good resistance to overfitting, and excellent handling of categorical-heavy tabular data with little manual encoding.

### Q7. Explain ordered boosting and the prediction-shift problem it fixes.

**Prediction shift**: in ordinary gradient boosting, the model is trained on the full training set, then the residuals/gradients used to fit the next tree are computed on those *same* rows. Because each row helped fit the model, the model's prediction on it is optimistically biased, so the gradients are biased, and this bias accumulates across boosting rounds. The model's error distribution on training data no longer matches unseen data — a leakage-flavored overfitting.

**Ordered boosting** removes it. Fix a random permutation of the data. For computing the gradient of row i, use a model `M_i` that was trained only on the rows *before* i in the permutation — i.e. a model that has never seen row i. Then row i's gradient is genuinely out-of-sample, so it is unbiased. Conceptually you maintain a series of models of increasing training-set size; each row's gradient comes from the model that excludes it. CatBoost approximates this efficiently (using several permutations to reduce variance) rather than literally training n models. Net effect: gradients are computed as if on held-out data, killing prediction shift and reducing overfitting, which is especially valuable on smaller datasets.

### Q8. How does CatBoost handle categorical features (ordered target statistics)?

Naive target encoding — replace category c with the mean label over all rows where the category equals c — leaks the label because a row's own target is in that mean. CatBoost uses **ordered target statistics** instead.

Fix a random permutation. For each row i, compute the category's encoding using only rows *before* i in the permutation that share the same category value:

```
encoding_i = (sum of y over prior rows with same category + prior*a) / (count of prior rows with same category + a)
```

where `a` is a smoothing weight and `prior` is a global prior (e.g. overall mean label). Because only preceding rows contribute, row i's own label never enters its encoding — no leakage. CatBoost also generates **feature combinations** (encodings of category interactions) greedily during tree building, capturing interactions like (city, device) automatically. This is why CatBoost usually beats manual one-hot or naive target encoding on categorical data: it gets the statistical benefit of target encoding without the leakage, and it discovers useful category combinations for you.

### Q9. Compare XGBoost, LightGBM, and CatBoost.

| Dimension | XGBoost | LightGBM | CatBoost |
|---|---|---|---|
| Split finding | Exact or histogram | Histogram (default) | Histogram |
| Tree growth | Level-wise (leaf-wise optional) | Leaf-wise (best-first) | Oblivious/symmetric trees |
| Speed on large data | Good (hist mode) | Fastest | Good |
| Categorical handling | Encode manually (native is newer) | Native categorical splits | Native ordered target statistics (best) |
| Overfitting control | Regularized objective, tuning | num_leaves, min_data_in_leaf | Ordered boosting, symmetric trees |
| Prediction shift / leakage | Present (standard boosting) | Present | Fixed via ordered boosting |
| Default robustness | Needs tuning | Needs tuning (num_leaves!) | Strong defaults |
| Inference speed | Fast | Fast | Very fast (oblivious trees) |
| Maturity/ecosystem | Largest | Large | Growing |

Rules of thumb: **LightGBM** for large, mostly-numeric data where speed matters; **CatBoost** for categorical-heavy data or when you want strong results with minimal tuning; **XGBoost** as the mature, universally-supported default. All three are excellent — on a given dataset the winner is often decided by tuning and data characteristics, not a universal ranking.

### Q10. When would you pick CatBoost over LightGBM?

Pick **CatBoost** when:
- **Many categorical features, especially high-cardinality ones** (user IDs, zip codes, product SKUs). Its ordered target statistics beat manual encoding and avoid the leakage that naive target encoding introduces.
- **You want strong out-of-the-box results with little tuning.** CatBoost's defaults are notably good; LightGBM demands careful `num_leaves`/`min_data_in_leaf` tuning to avoid overfitting.
- **Overfitting is a concern on a smaller dataset.** Ordered boosting reduces prediction-shift bias, and symmetric trees regularize.
- **Fast inference matters.** Oblivious trees evaluate the same split per level, enabling very fast, vectorized prediction.

Pick **LightGBM** when the data is large and predominantly numeric, training throughput is the priority, and you are comfortable tuning. In short: CatBoost optimizes for correctness/robustness on categoricals and defaults; LightGBM optimizes for raw speed on big numeric data.

### Q11. Why can leaf-wise growth overfit, and how do you control it?

Leaf-wise growth always splits the leaf with the highest gain anywhere in the tree. On a small or noisy dataset it will keep finding "gainful" splits deep down a narrow branch — splits that fit noise, not signal — because there is no depth ceiling stopping it. Level-wise growth is more constrained: it must expand a whole level, spreading splits out, and depth caps complexity cleanly.

Controls in LightGBM:
- **num_leaves** — the primary knob; keep it well below `2^max_depth`. Smaller = less overfitting.
- **min_data_in_leaf (min_child_samples)** — require enough rows per leaf so splits are statistically supported.
- **max_depth** — a hard cap on how deep leaf-wise can go.
- **min_gain_to_split (like gamma)** — minimum gain to make a split.
- **feature_fraction / bagging_fraction** — column/row subsampling for regularization.
- **lambda_l1 / lambda_l2** — leaf-weight penalties.

```python
import lightgbm as lgb
model = lgb.LGBMClassifier(
    num_leaves=31, max_depth=-1, min_child_samples=50,
    learning_rate=0.03, n_estimators=3000,
    feature_fraction=0.8, bagging_fraction=0.8, bagging_freq=1,
    reg_lambda=1.0,
)
```

### Q12. What are oblivious (symmetric) trees and why does CatBoost use them?

An **oblivious (symmetric) tree** uses the **same split condition on every node at a given depth**. So a depth-6 tree is described by just 6 (feature, threshold) pairs, and every row is routed by comparing against those 6 conditions — effectively indexing into a table of `2^6 = 64` leaf values.

Why CatBoost uses them:
- **Regularization.** Forcing the whole level to share one split is a strong constraint that limits overfitting — a form of built-in regularization, complementing ordered boosting.
- **Very fast inference.** Prediction is a fixed sequence of comparisons producing a bit index into a leaf array — branch-free and cache-friendly, which vectorizes well and is excellent for low-latency serving.
- **Simplicity/stability.** Fewer degrees of freedom per tree makes the ensemble more stable.

The tradeoff is less flexibility per tree (a symmetric tree is weaker than a fully free tree of the same depth), but boosting compensates across many trees, and the regularization + speed usually win for CatBoost's target use cases.

### Q13. Does using GOSS/leaf-wise change how you should tune LightGBM versus XGBoost?

Yes. Because LightGBM grows leaf-wise, the *primary* complexity knob is **num_leaves**, not **max_depth** as in XGBoost. A common mistake is porting an XGBoost config (max_depth=6) directly and leaving num_leaves at a high default — leaf-wise growth then overfits. Set `num_leaves` deliberately (well below `2^max_depth`) and use `min_data_in_leaf` to prevent tiny, noisy leaves.

Other differences:
- **min_data_in_leaf / min_child_samples** matters more in LightGBM because leaf-wise reaches thin leaves quickly.
- **max_bin** (histogram bins) is a LightGBM/hist-specific knob trading speed vs split resolution.
- If using **GOSS** (`boosting_type='goss'`), you cannot also use bagging subsample the same way — GOSS is itself the sampling scheme.
- Learning rate + n_estimators + early stopping logic is the same as XGBoost.

So the mental switch is: in XGBoost you think in **depth**; in LightGBM you think in **num_leaves + min_data_in_leaf**.

### Q14. Are LightGBM and CatBoost also second-order (Newton) like XGBoost?

LightGBM: yes. It uses the same gradient + Hessian (second-order) formulation as XGBoost — the leaf values and split gains are computed from summed gradients and Hessians. Its innovations (histogram, leaf-wise, GOSS, EFB) are about *how it searches and samples*, not about abandoning the second-order objective. GOSS in particular is defined in terms of gradients, and the up-weighting keeps the gain estimates unbiased.

CatBoost: it builds on the gradient-boosting framework and can use second-order information, but its defining changes are **ordered boosting** (how gradients are computed to avoid prediction shift) and **ordered target statistics** (categorical encoding), plus symmetric trees. So all three sit on the same additive-model-of-trees-fit-to-loss-derivatives foundation; they diverge in split search (histograms), growth policy (leaf-wise vs symmetric), sampling (GOSS), and leakage handling (ordered boosting).

### Q15. What is the complexity/scaling story for LightGBM versus XGBoost?

The dominant cost in boosted trees is split finding. XGBoost exact is roughly `O(K * d * n log n)` (sorted scans); LightGBM (and XGBoost hist) replace the per-node `O(n)` scan with an `O(#bins)` scan after an `O(n)` histogram build.

LightGBM's per-tree cost is roughly `O(n * d)` to build histograms plus `O(#leaves * #bins)` to find splits — and it shrinks each factor:
- **Histograms** make split evaluation depend on `#bins`, not distinct values.
- **Histogram subtraction** halves histogram construction (build the small child, subtract for the sibling).
- **GOSS** shrinks the effective `n` (rows) per iteration.
- **EFB** shrinks the effective `d` (features) on sparse data.

So LightGBM scales better as both n and d grow, which is why it is the usual pick for large data. Memory is also lower because features are stored as small bin indices. Boosting rounds remain sequential for all three; parallelism is within-tree (feature/data parallel) or via distributed histogram merging.

### Q16. A stakeholder says "just use XGBoost, it always wins." How do you respond?

Push back with nuance, not dogma. XGBoost is an excellent, mature default, but "always wins" is false:

- On **large, numeric datasets**, **LightGBM** usually trains several times faster at comparable accuracy (histogram + leaf-wise + GOSS/EFB) — meaningful when you retrain often or the data is huge.
- On **categorical-heavy data**, **CatBoost** often wins accuracy and saves you from building leakage-prone target encoders, thanks to ordered target statistics and ordered boosting.
- On **small/noisy data**, CatBoost's ordered boosting and symmetric trees can overfit less than an untuned leaf-wise LightGBM or an aggressive XGBoost.
- All three are highly tunable, so on any single dataset the ranking often flips with tuning; the honest approach is to try the two or three plausible candidates with cross-validation.

The senior framing: they are variations on the same gradient-boosted-tree theme with different engineering tradeoffs. Pick based on data size, categorical content, latency needs, and tuning budget — and validate empirically rather than by reputation.

## Support Vector Machines

### Summary

**What this topic covers**

Support Vector Machines (SVMs) as a maximum-margin classifier (and, less centrally, regressor). This topic owns the geometry and optimization of SVMs: the **maximum-margin hyperplane**, why `margin = 2/||w||` turns "maximize margin" into "minimize 0.5*||w||^2", what **support vectors** are, the **soft-margin** formulation with slack variables and the **C** hyperparameter, the **hinge-loss** view that connects SVMs to regularized empirical risk minimization, and the **dual** formulation that depends only on dot products — which is the doorway to kernels (kernels get their own topic; here we motivate why the dual matters). We also cover practical realities: SVMs shine in high-dimensional, small-to-medium datasets, they need **feature scaling**, they scale poorly to very large n (`O(n^2)`–`O(n^3)`), and they output distances not probabilities (use **Platt scaling** for calibrated probabilities). The 16 questions run from warm-ups ("what is a support vector") to senior derivations ("derive the SVM dual and the role of the kernel"). The kernel trick itself is treated in the **Kernels & the kernel trick** topic — reference it.

**Mental model**

An SVM draws the decision boundary that is as far as possible from the nearest points of either class. Among the infinitely many hyperplanes that separate two classes, the SVM picks the one with the widest "street" (margin) between them. The street's width is `2/||w||`, so a wider margin means a smaller `||w||`; maximizing margin becomes minimizing `0.5*||w||^2` subject to every point being on the correct side by at least a unit distance (`y_i*(w·x_i + b) >= 1`). Only the points sitting exactly on the edges of the street — the **support vectors** — determine `w` and `b`; everything farther away is irrelevant, which is what makes the solution sparse and robust. Real data is not cleanly separable, so we allow violations via **slack** and pay for them with the penalty **C**: large C = intolerant of margin violations (narrow, hard margin, low bias/high variance), small C = tolerant (wide margin, more regularized). Solving the **dual** rewrites everything in terms of dot products `x_i·x_j`, and replacing those with a kernel gives non-linear boundaries for free.

**Key terms**

- **Hyperplane** — the decision surface `w·x + b = 0`; in 2D a line, in 3D a plane, in p-D a (p-1)-dimensional flat.
- **Margin** — the distance between the two class-boundary "gutters"; equals `2/||w||` for the canonical scaling `y_i*(w·x_i+b) >= 1`.
- **Maximum-margin classifier** — the separating hyperplane that maximizes the margin (hard margin, separable case).
- **Support vectors** — the training points lying on the margin (or inside it / misclassified in the soft case); they alone define the boundary.
- **Slack variable (xi_i)** — how far a point is allowed to violate its margin constraint in the soft-margin formulation.
- **C** — the penalty on total slack; controls the margin-width vs violation tradeoff (bias-variance knob). Large C = hard, small C = soft.
- **Hinge loss** — `max(0, 1 - y_i*(w·x_i+b))`; zero when a point is correctly outside the margin, linear in the violation otherwise.
- **Primal** — the `0.5*||w||^2 + C*sum(xi)` formulation in `w`, `b`, `xi`.
- **Dual** — the equivalent problem in Lagrange multipliers `alpha_i`, depending only on dot products `x_i·x_j`; enables kernels.
- **KKT conditions** — the optimality conditions linking primal and dual; they identify support vectors (nonzero alpha).
- **Kernel** — a function `K(x_i, x_j)` computing an inner product in a higher-dimensional space without the explicit mapping (see the Kernels topic).
- **Platt scaling** — fitting a logistic function to SVM scores to produce calibrated probabilities.

**Why interviewers ask this**

SVMs are a favorite because they force you to reason about **optimization and geometry** together, unlike tree ensembles where you can hand-wave. Junior candidates can state "it finds the best separating line"; senior candidates can explain *why* maximizing the margin is `minimize 0.5*||w||^2`, what the constraints mean, how the soft margin and C trade off bias and variance, and — the real filter — why the **dual** matters (it depends only on dot products, so kernels slot in). Being able to connect hinge loss + L2 penalty to the broader regularized-ERM picture signals you see SVMs as one instance of a general framework, not an isolated trick. It also tests practical judgment: scaling features, why SVMs struggle at large n, and that they do not natively output probabilities.

**Common confusions**

- "SVM maximizes accuracy" — no, it maximizes the *margin* subject to (soft) correctness; margin is a proxy for generalization, not training accuracy.
- "All training points matter" — only the support vectors do; moving or deleting a non-support-vector point does not change the boundary.
- "Large C = more regularization" — backwards. Large C penalizes violations *more*, giving a narrower, harder margin and *less* regularization (more overfitting).
- "The kernel trick is unique to SVMs" — the dual's dependence on dot products enables kernels, but kernels also appear in kernel PCA, Gaussian processes, etc.
- "SVMs give probabilities" — they give signed distances to the hyperplane; calibrated probabilities require Platt scaling or isotonic regression.
- "SVMs are great for huge datasets" — training is `O(n^2)`–`O(n^3)`; they are strong for small-to-medium n, especially high-dimensional (text), not millions of rows.

**What follows from this topic**

The dual formulation here is the setup for the **Kernels & the kernel trick** topic — the whole point of the dual is that it depends only on dot products, so replacing them with a kernel yields non-linear SVMs. The hinge-loss + L2 view connects SVMs to **Logistic regression** (log-loss + L2) — a classic compare-and-contrast. For when to choose an SVM versus a boosted tree or a linear model, see **Algorithm selection & tradeoffs**. Feature scaling and pipeline-in-CV practicalities live in the ML Fundamentals sister primer — reference, don't duplicate.

### Q1. What is a support vector machine, in one paragraph?

A support vector machine is a supervised classifier that finds the **maximum-margin hyperplane** separating two classes: among all decision boundaries that separate the data, it picks the one with the greatest distance to the nearest points of each class. Those nearest points are the **support vectors**, and they alone determine the boundary. For non-separable data it uses a **soft margin** — allowing some points to violate the margin, penalized by a hyperparameter **C** — trading margin width against classification errors. Its decision function is `f(x) = sign(w·x + b)`. Crucially, the optimization can be written in a **dual** form depending only on dot products between training points, which lets you swap in a **kernel** to get non-linear boundaries without ever computing the high-dimensional mapping. SVMs excel in high-dimensional, small-to-medium datasets and need features scaled to a comparable range.

### Q2. Why does maximizing the margin equal minimizing 0.5*||w||^2?

Fix the canonical scaling so the closest points satisfy `y_i*(w·x_i + b) = 1`. The two margin boundaries are then `w·x + b = +1` and `w·x + b = -1`. The perpendicular distance between these two parallel hyperplanes is:

```
margin = 2 / ||w||
```

(The distance from a point to a hyperplane `w·x+b=0` is `|w·x+b|/||w||`; the two gutters are at values +1 and -1, a total separation of `2/||w||`.)

Maximizing `2/||w||` is the same as minimizing `||w||`, which is the same as minimizing `0.5*||w||^2` (the square and the 0.5 make it a smooth convex quadratic, nicer for optimization and derivatives). So the **hard-margin** primal is:

```
minimize   0.5 * ||w||^2
subject to y_i * (w·x_i + b) >= 1  for all i
```

A convex quadratic program: minimizing a quadratic objective under linear constraints, so it has a unique global optimum.

### Q3. What exactly is a support vector?

A support vector is a training point that lies **on the margin boundary** (or, in the soft-margin case, inside the margin or on the wrong side). Equivalently, in the dual solution it is a point whose Lagrange multiplier `alpha_i > 0`.

Two consequences make this the key concept:

1. **The boundary depends only on support vectors.** `w = sum_i alpha_i * y_i * x_i`, and `alpha_i = 0` for all non-support-vectors — so they drop out. You could delete every non-support-vector point and get the identical model.
2. **Sparsity and robustness.** Usually only a small fraction of points are support vectors, so the model is defined by few points and is insensitive to the many points far from the boundary — moving them does nothing.

This is the geometric heart of SVMs: the decision surface is pinned by the handful of points closest to it.

### Q4. What is the soft-margin SVM and what does C do?

Real data is rarely perfectly separable (and a hard margin would overfit noise even when it is). The soft margin introduces a **slack variable** `xi_i >= 0` per point, measuring how far it is allowed to violate its margin constraint:

```
minimize   0.5*||w||^2 + C * sum_i xi_i
subject to y_i*(w·x_i + b) >= 1 - xi_i,   xi_i >= 0
```

`xi_i = 0` means the point is correctly outside the margin; `0 < xi_i < 1` means it is inside the margin but correctly classified; `xi_i > 1` means it is misclassified.

**C** is the price of slack:
- **Large C** — violations are expensive, so the optimizer keeps the margin narrow to avoid them. Fits training data hard → low bias, high variance (overfitting risk).
- **Small C** — violations are cheap, so it accepts a wider margin with more points inside it. More regularized → higher bias, lower variance.

So C is the SVM's core bias-variance knob, tuned by cross-validation (often on a log grid).

### Q5. Explain the hinge-loss view of SVMs.

The soft-margin SVM is exactly regularized empirical risk minimization with the **hinge loss**. Eliminate the slack variables using `xi_i = max(0, 1 - y_i*(w·x_i+b))` and the primal becomes an unconstrained objective:

```
minimize   sum_i max(0, 1 - y_i*(w·x_i + b))  +  (1/(2C)) * ||w||^2
```

The first term is the total **hinge loss**; the second is L2 regularization. The hinge loss `max(0, 1 - y*f(x))`:
- is **0** when a point is correctly classified *and* outside the margin (`y*f(x) >= 1`) — correct, confident points cost nothing;
- grows **linearly** with the size of the violation otherwise.

This framing is powerful: it puts SVMs in the same family as logistic regression (which uses **log-loss** + L2) — same regularizer, different loss. The hinge loss is zero past the margin (giving sparse support vectors and a hard cutoff), while log-loss is always positive (every point nudges the boundary, giving probabilistic outputs). Same skeleton, different flesh.

### Q6. Derive the dual formulation and explain why it matters.

Start from the hard-margin primal and form the Lagrangian with multipliers `alpha_i >= 0`:

```
L(w, b, alpha) = 0.5*||w||^2 - sum_i alpha_i * [ y_i*(w·x_i + b) - 1 ]
```

Set derivatives to zero (stationarity):

```
dL/dw = 0  ->  w = sum_i alpha_i * y_i * x_i
dL/db = 0  ->  sum_i alpha_i * y_i = 0
```

Substitute `w` back into L to eliminate the primal variables. You get the **dual** problem in the alphas alone:

```
maximize   sum_i alpha_i - 0.5 * sum_i sum_j alpha_i*alpha_j*y_i*y_j*(x_i·x_j)
subject to alpha_i >= 0,   sum_i alpha_i*y_i = 0
```

(In the soft-margin case the only change is a box constraint `0 <= alpha_i <= C`.)

**Why it matters:** the dual objective and the resulting decision function `f(x) = sign(sum_i alpha_i*y_i*(x_i·x) + b)` depend on the data **only through dot products `x_i·x_j`**. Replace every dot product with a kernel `K(x_i, x_j)` — an inner product in some higher-dimensional feature space — and you get a non-linear SVM in that space without ever computing the mapping. That is the **kernel trick**, and the dual is what makes it possible. It also reveals sparsity: KKT conditions force `alpha_i = 0` for all non-support-vectors.

### Q7. What are the KKT conditions telling you about support vectors?

The Karush-Kuhn-Tucker (KKT) conditions are the optimality conditions for the constrained problem. The key one is **complementary slackness**:

```
alpha_i * [ y_i*(w·x_i + b) - 1 + xi_i ] = 0
```

Reading it case by case (soft margin, `0 <= alpha_i <= C`):

- **alpha_i = 0** — the constraint is inactive; the point is strictly outside the margin, correctly classified. **Not** a support vector.
- **0 < alpha_i < C** — the point sits exactly on the margin (`y_i*f(x_i) = 1`, `xi_i = 0`). A "free" support vector; these are used to solve for `b`.
- **alpha_i = C** — the point is inside the margin or misclassified (`xi_i > 0`). A "bound" support vector.

So the alphas both *identify* the support vectors (nonzero) and *classify* them (on the margin vs violating it). This is why the solution is sparse: optimality itself forces most alphas to zero.

### Q8. How does an SVM make predictions, in primal and dual form?

**Primal:** once you have `w` and `b`, prediction is a single dot product:

```
f(x) = sign(w·x + b)
```

Cheap — `O(p)` per prediction in p dimensions. This is what a **linear** SVM uses.

**Dual / kernelized:** `w = sum_i alpha_i*y_i*x_i` may live in an implicit (possibly infinite-dimensional) space, so you cannot store it explicitly. Instead you predict via kernels over the support vectors:

```
f(x) = sign( sum_{i in SV} alpha_i*y_i*K(x_i, x) + b )
```

Cost is `O(#support_vectors * kernel_eval)` per prediction — so inference slows down as the number of support vectors grows, which for hard problems can be a large fraction of the training set. This is a practical downside of kernel SVMs at prediction time and a reason linear SVMs (via `w` directly) are preferred when a linear boundary suffices.

### Q9. Why must you scale features before training an SVM?

Because the objective `0.5*||w||^2` and the distance/margin geometry depend on the **scale of each feature**. Features with large numeric ranges dominate `||w||` and the dot products, so the margin is effectively measured mostly along those axes and the SVM under-weights small-scale features. For RBF/Gaussian kernels it is even more acute: `K = exp(-gamma*||x_i - x_j||^2)` uses Euclidean distance, which is dominated by large-range features, so an unscaled feature can swamp the kernel.

The fix is to standardize (zero mean, unit variance) or min-max scale every feature before fitting, and — critically — fit the scaler on the training fold only, applying it to validation/test, ideally inside a pipeline so scaling happens within each CV fold and does not leak:

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

model = make_pipeline(StandardScaler(), SVC(C=1.0, kernel="rbf", gamma="scale"))
```

Forgetting to scale is one of the most common reasons an SVM "mysteriously" underperforms.

### Q10. What is the computational complexity of SVMs, and why do they struggle at scale?

Training a kernel SVM means solving a quadratic program over the `n x n` kernel (Gram) matrix. In practice, solvers like SMO run in roughly **`O(n^2)` to `O(n^3)`** time depending on data and C, and materializing/using the kernel matrix is up to **`O(n^2)` memory**. So cost grows super-linearly with the number of training rows.

Consequences:
- SVMs are excellent for **small-to-medium n** (thousands to low tens of thousands), especially with **high dimensionality** (e.g. text with many features), where they are competitive and sample-efficient.
- They become impractical for **millions of rows** — training is too slow and the kernel matrix too big.

Mitigations: use a **linear** SVM (LinearSVC / liblinear, roughly `O(n*p)`) when a linear boundary is adequate, use SGD-based hinge-loss training for large linear problems, subsample, or switch to gradient-boosted trees, which handle large n far better. Prediction cost also scales with the number of support vectors for kernel SVMs.

### Q11. How do you get probability estimates out of an SVM?

An SVM natively outputs a **signed distance** to the hyperplane (`w·x + b`), not a probability — larger magnitude means more confident, but it is not calibrated to [0,1]. To get probabilities:

- **Platt scaling** — fit a logistic (sigmoid) function to the SVM decision scores using a held-out set (or internal CV): `P(y=1|x) = 1 / (1 + exp(A*f(x) + B))`, learning A and B. This is what sklearn's `SVC(probability=True)` does under the hood (via internal cross-validation), which is why enabling it makes training slower.
- **Isotonic regression** — a non-parametric monotonic calibration, more flexible but needs more data.

Caveats: the calibrated probabilities come from a separate fit, so they can be inconsistent with the hard `predict()` decision at the margin, and enabling `probability=True` adds cross-validated calibration cost. If you genuinely need well-calibrated probabilities out of the box, **logistic regression** is often the more natural choice.

### Q12. SVM vs logistic regression — how do they compare?

They are close cousins — both linear classifiers fitting `w·x + b` with L2 regularization — differing mainly in the loss:

| | Logistic regression | SVM (linear) |
|---|---|---|
| Loss | Log-loss (cross-entropy) | Hinge loss |
| Output | Calibrated probabilities | Signed distance (probabilities need Platt) |
| Points that matter | All points influence the fit | Only support vectors |
| Boundary emphasis | Maximizes likelihood | Maximizes margin |
| Kernels | Not standard | Natural via the dual |
| Robust to outliers | Less (log-loss unbounded) | More (hinge caps at the margin street) |
| Best when | You need probabilities/interpretability | High-dim, want margin/kernels |

Practically: use **logistic regression** when you want probabilities, interpretable coefficients / odds ratios, or a fast baseline on large data. Use an **SVM** for high-dimensional problems (text), when the maximum-margin inductive bias helps, or when you want a non-linear kernel boundary. On linearly separable, well-scaled data they often perform similarly; the choice hinges on whether you need probabilities and whether you want kernels.

### Q13. What is SVR — how does the SVM idea extend to regression?

**Support Vector Regression (SVR)** applies the same margin idea to regression using an **epsilon-insensitive tube**. Instead of separating classes, SVR fits a function `f(x) = w·x + b` such that predictions within `epsilon` of the true target incur **no loss** — the model only cares about errors larger than epsilon:

```
loss = max(0, |y - f(x)| - epsilon)
minimize  0.5*||w||^2 + C * sum_i (epsilon-insensitive loss)
```

Geometry: fit the flattest tube of half-width epsilon that contains most points; points **outside** the tube become support vectors and pay a C-weighted penalty. So SVR has three knobs: **epsilon** (tube width / tolerance), **C** (penalty on out-of-tube errors), and the **kernel** (with gamma) for non-linear regression. Like classification SVMs it is sparse (only out-of-tube points matter), needs scaled features, and can use kernels for non-linearity. It is a reasonable choice for small-to-medium regression problems, though gradient-boosted trees usually win on larger tabular data.

### Q14. When would you choose an SVM over a random forest or gradient boosting?

Prefer an **SVM** when:
- **High-dimensional, small-to-medium data** — e.g. text classification with thousands of features and thousands of examples, where SVMs are sample-efficient and the margin bias generalizes well.
- **Clear margin structure** — problems where a maximum-margin boundary (possibly kernelized) fits the geometry, and features are continuous and scalable.
- **You want a well-understood convex optimum** with strong theoretical grounding.

Prefer **trees / gradient boosting** when:
- **Large n** — SVM's `O(n^2)`–`O(n^3)` training is prohibitive; boosting scales far better.
- **Mixed types, missing values, categoricals, or features on wildly different scales** — trees handle these without scaling; SVMs need careful preprocessing.
- **You want feature importance / interpretability** and minimal tuning.

In modern practice, gradient-boosted trees are the default for tabular data, and SVMs have receded to niches (text, some bioinformatics, small high-dim problems). Knowing *why* — mainly the scaling limitation and preprocessing burden — is the point of the question.

### Q15. What does the C hyperparameter's effect look like, and how do you tune it (with gamma)?

**C** trades margin width against violations: small C = wide, soft margin (more bias, less variance, smoother boundary); large C = narrow, hard margin (less bias, more variance, wiggly boundary that chases training points). With an RBF kernel there is a second knob, **gamma**, controlling each point's reach: small gamma = far reach = smooth boundary; large gamma = short reach = each point carves out its own island (overfitting).

They interact, so tune them **jointly** on a log grid via cross-validation:

```python
from sklearn.model_selection import GridSearchCV
from sklearn.svm import SVC

grid = {"C": [0.1, 1, 10, 100], "gamma": [1e-3, 1e-2, 1e-1, 1]}
search = GridSearchCV(SVC(kernel="rbf"), grid, cv=5, scoring="accuracy")
search.fit(X_train_scaled, y_train)
```

Rules of thumb: high C + high gamma overfits (near-perfect train, poor test); low C + low gamma underfits. Start with `gamma='scale'` (sklearn default, `1/(n_features * X.var())`) and C around 1, then search outward. Always scale features first, and put scaling inside the pipeline so it is fit per fold.

### Q16. Can SVMs do multiclass classification? How?

The core SVM is inherently **binary** (one separating hyperplane), so multiclass is handled by combining binary SVMs:

- **One-vs-One (OvO)** — train one SVM per pair of classes: `K*(K-1)/2` classifiers for K classes. Predict by majority vote across all pairwise classifiers. This is sklearn's `SVC` default. Each classifier trains on only the two relevant classes' data, so individual problems are small — well-suited to SVMs' `O(n^2)` cost, though you train many classifiers.
- **One-vs-Rest (OvR / one-vs-all)** — train K classifiers, each separating one class from all others; predict the class whose classifier gives the highest decision score. Fewer classifiers (K), but each trains on the full dataset and faces class imbalance.

There are also true multiclass SVM formulations (Crammer-Singer), but OvO/OvR dominate in practice. OvO is generally preferred for kernel SVMs because each sub-problem is smaller despite there being more of them; OvR is common for linear SVMs where per-classifier training on all data is cheaper.
## Kernels & the Kernel Trick

### Summary

**What this topic covers**

The single idea that turns a linear model into a non-linear one **without paying for the non-linearity explicitly**: the kernel. This topic sits directly on top of **SVM** — that primer showed the dual objective depends only on dot products `x·x'`; here we exploit that. We cover what a kernel actually is (an implicit inner product in a higher-dimensional feature space), the **kernel trick** (compute `K(x,x')` directly, never the mapping `phi`), the common kernels (**linear**, **polynomial**, **RBF/Gaussian**), the meaning of the **gamma** and **C** hyperparameters and how they trade bias against variance, **Mercer's condition** (which functions are valid kernels), the practical **C/gamma grid search**, and where kernels show up beyond SVM (kernel PCA, Gaussian processes, kernel ridge regression). The 16 questions run from "what is a kernel" up to "derive why the trick works from the SVM dual" and "why does RBF overfit as gamma grows." This is the topic that separates candidates who memorised "SVMs use kernels" from those who can explain *why the dual makes it possible.*

**Mental model**

You want a non-linear boundary. The honest approach: map each point into a richer feature space with `phi(x)` — e.g. add all pairwise products `x_i*x_j` — then fit a *linear* model there. A line in the rich space is a curve back in the original space. The problem: that space can be huge or infinite-dimensional, so computing `phi(x)` is expensive or impossible. The escape hatch: many learners (SVM's dual, ridge regression, PCA) only ever touch the data through **inner products** `phi(x)·phi(x')`. A **kernel** `K(x,x')` is a function that returns exactly that inner product *without building phi*. So you swap every `x·x'` for `K(x,x')` and you are silently training in the high-dimensional space at low-dimensional cost. That swap is the **kernel trick**. RBF corresponds to an *infinite*-dimensional phi — you could never write it down, yet `exp(-gamma*||x-x'||^2)` is one cheap line. The kernel is a **similarity measure**: high when points are close, low when far.

**Key terms**

- **Feature map (phi)** — the (possibly implicit, possibly infinite-dim) transform lifting x into a space where the problem is linearly separable.
- **Kernel K(x,x')** — a function equal to `phi(x)·phi(x')`; an inner product in feature space computed without phi.
- **Kernel trick** — replacing dot products with a kernel so you train in feature space without ever computing phi.
- **Linear kernel** — `K = x·x'`; no lift; equivalent to a plain linear SVM.
- **Polynomial kernel** — `K = (x·x' + c)^d`; feature space = all monomials up to degree d; c and d are knobs.
- **RBF / Gaussian kernel** — `K = exp(-gamma*||x-x'||^2)`; infinite-dimensional feature space; the default.
- **gamma** — RBF width knob; how far one training point's influence reaches. Large gamma = narrow, wiggly, high variance.
- **C** — SVM soft-margin regularization; large C = fit training hard (low bias/high variance).
- **Mercer's condition** — a symmetric K is a valid kernel iff its Gram matrix is positive semi-definite for all inputs.
- **Gram / kernel matrix** — the n-by-n matrix K_ij = K(x_i, x_j); everything the kernel method sees.
- **Kernel PCA / Gaussian process** — non-SVM methods that also rely only on inner products, so kernels drop straight in.

**Why interviewers ask this**

"Explain the kernel trick" is the single most common SVM follow-up, and it is a sharp senior/junior discriminator. A junior says "kernels let SVMs do non-linear boundaries" — true but shallow. A senior explains *the mechanism*: the dual objective depends only on `x_i·x_j`, so replacing that inner product with `K(x_i,x_j)` trains in a higher-dimensional space at no extra cost — and can name that RBF's space is infinite-dimensional, which is why you never compute phi. The really strong signal is connecting three things: (1) the dual is what *enables* the trick, (2) gamma and C are the bias-variance knobs you grid-search, and (3) the same trick generalises to any inner-product-only algorithm. Interviewers also probe intuition on gamma — candidates who can say "large gamma = each point only influences its immediate neighbourhood = overfitting" demonstrate they understand the geometry, not just the formula.

**Common confusions**

- "The kernel trick maps data to a higher dimension" — subtly wrong emphasis. It lets you *behave as if* you mapped, without ever doing the mapping. The point is you never compute phi.
- "gamma is the regularization parameter" — no. **C** is the SVM regularization. gamma is the RBF kernel's width. They interact but are different knobs.
- "Higher gamma = more regularization" — backwards. Higher gamma = *more* flexible, wigglier boundary, *more* overfitting.
- "Any similarity function is a kernel" — only if it satisfies Mercer's condition (PSD Gram matrix). Otherwise the optimisation is not convex/valid.
- "Polynomial degree d = number of features" — d is the max monomial degree; the feature space dimension grows combinatorially in d, not linearly.
- "Kernels are an SVM thing" — the trick works for any inner-product-only method: kernel ridge, kernel PCA, Gaussian processes, kernel k-means.

**What follows from this topic**

This closes out the **SVM** thread — SVM gives the max-margin objective and the dual, kernels give it non-linearity. From here the natural jumps are **PCA** (kernel PCA is the same trick applied to variance directions) and the clustering topics, where RBF-style similarity underlies spectral methods. The bias-variance framing of C and gamma links back to the **ML Fundamentals** primer's bias-variance and cross-validation material — grid-searching C and gamma is the canonical "tune two interacting hyperparameters with CV" exercise. If SVM felt abstract, kernels are where its dual formulation suddenly pays off.

### Q1. What is a kernel, in one sentence, and why do we care?

A **kernel** `K(x, x')` is a function that computes the inner product of two points *after* they have been mapped into some higher-dimensional feature space — `K(x, x') = phi(x)·phi(x')` — but it does so **without ever computing phi(x)**.

Why we care: a linear model in a rich enough feature space is a non-linear model back in the original space. Building that feature space explicitly is expensive (or impossible — it can be infinite-dimensional). The kernel gives you the geometry of that space through one cheap similarity number. Think of `K` as a **similarity measure**: large when x and x' are alike, near zero when they are far apart.

### Q2. Explain the kernel trick and why it works.

Many learning algorithms — most cleanly the **SVM dual** — only ever reference the data through **dot products** `x_i · x_j`. Look at the dual objective:

```
maximize   sum_i a_i  -  0.5 * sum_i sum_j a_i a_j y_i y_j (x_i · x_j)
```

The features x appear *only* inside `(x_i · x_j)`. So if you want to train in a mapped space, you would replace that with `(phi(x_i) · phi(x_j))`. The **trick**: that quantity is exactly `K(x_i, x_j)`. So you substitute:

```
(x_i · x_j)   ->   K(x_i, x_j)
```

and you are now optimising the same convex problem, but in the high-dimensional feature space — at the cost of evaluating K, never phi. Prediction is the same story: the decision function `f(x) = sum_i a_i y_i (x_i · x) + b` becomes `sum_i a_i y_i K(x_i, x) + b`. The mapping phi is *implicit* everywhere. That substitution, made possible because the whole method is expressible in inner products, is the kernel trick.

### Q3. Why is the SVM dual, specifically, what makes kernels possible?

Because the **dual expresses everything in dot products of data points**, whereas the primal is written in terms of the weight vector `w`, which lives in feature space.

- **Primal**: minimize `0.5*||w||^2` subject to `y_i (w·phi(x_i) + b) >= 1`. Here `w` has the dimensionality of the feature space — for RBF that is *infinite*, so you literally cannot store or optimise it.
- **Dual**: maximize over the a_i, and the objective and the final classifier touch the data only through `phi(x_i)·phi(x_j) = K(x_i, x_j)`.

So the dual sidesteps the infinite-dimensional `w` entirely and works with the finite n-by-n **Gram matrix** `K_ij`. That is why "kernelisation" is a dual-side phenomenon: any algorithm you can rewrite to depend only on inner products can be kernelised; the SVM dual is the textbook example.

### Q4. What are the common kernels and when would you use each?

| Kernel | Formula | Feature space | Use when |
|---|---|---|---|
| **Linear** | `K = x·x'` | original space (no lift) | high-dim data (text/TF-IDF), n < p, want speed + interpretability |
| **Polynomial** | `K = (x·x' + c)^d` | monomials up to degree d | known interaction structure, moderate degree (d=2,3) |
| **RBF / Gaussian** | `K = exp(-gamma*||x-x'||^2)` | infinite-dimensional | default; smooth non-linear boundary, no prior structure |
| **Sigmoid** | `K = tanh(k*x·x' + c)` | (neural-net-like) | rarely; not always Mercer-valid |

Practical rule: **start with linear** on high-dimensional sparse data (it often wins and is far faster); reach for **RBF** as the general-purpose non-linear default; use **polynomial** only when you specifically want degree-d interactions. If linear already separates well, kernels buy you nothing but cost.

### Q5. Explain the RBF kernel and the role of gamma.

```
K(x, x') = exp(-gamma * ||x - x'||^2)
```

It is a **similarity that decays with distance**: two identical points give `K = 1`, and it falls smoothly toward 0 as they separate. **gamma controls how fast it decays** — the reach of each training point's influence.

- **Small gamma** — wide bumps; each point influences a large region; smooth, near-linear boundary; **high bias, low variance** (can underfit).
- **Large gamma** — narrow bumps; each point only affects its immediate neighbourhood; the boundary wraps tightly around individual points; **low bias, high variance** (overfits, in the limit memorises the training set).

Geometrically, RBF places a Gaussian bump on each support vector and the decision surface is a weighted sum of those bumps; gamma is the bump width. It is the single most important knob for an RBF SVM, tuned jointly with C.

### Q6. What is the difference between C and gamma?

They are **different knobs on different objects**, and confusing them is a classic tell.

- **C** — the **soft-margin regularization** of the SVM itself (the slack penalty). Large C = penalise misclassification heavily = fit the training data hard = narrow margin, low bias, high variance. Small C = tolerate more violations = wider margin, higher bias, lower variance.
- **gamma** — the **RBF kernel's width**. Large gamma = wigglier boundary (as above). It is a property of the kernel, not the SVM optimisation.

Both push toward overfitting when increased, which is why you grid-search them **together** — high C with high gamma is the maximally overfit corner; low C with low gamma is the maximally smooth corner.

### Q7. How do you tune C and gamma in practice?

A **2D grid search with cross-validation**, usually on a logarithmic scale, because both span orders of magnitude.

```python
from sklearn.svm import SVC
from sklearn.model_selection import GridSearchCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

param_grid = {
    "svc__C": [0.1, 1, 10, 100, 1000],
    "svc__gamma": [1e-4, 1e-3, 1e-2, 1e-1, 1],
}
pipe = make_pipeline(StandardScaler(), SVC(kernel="rbf"))
# scaling MUST be inside the pipeline so it is refit per CV fold (no leakage)
grid = GridSearchCV(pipe, {f"svc__{k.split('__')[1]}": v
                           for k, v in param_grid.items()}, cv=5)
grid.fit(X, y)
```

Key points the interviewer wants: (1) **log-spaced grids**, (2) **scale features first** (RBF uses Euclidean distance, so unscaled features dominate), (3) **scaling inside the CV pipeline** to avoid leakage, (4) the optimum is usually a diagonal band — high C compensates for low gamma and vice versa. For larger search spaces, randomized or Bayesian search beats exhaustive grid.

### Q8. What is Mercer's condition and why does it matter?

**Mercer's condition**: a symmetric function `K(x, x')` is a valid kernel — i.e. it genuinely corresponds to an inner product `phi(x)·phi(x')` in *some* feature space — **if and only if** its Gram matrix `K_ij = K(x_i, x_j)` is **positive semi-definite (PSD)** for every finite set of inputs.

Why it matters: the kernel trick assumes such a phi exists. If K is not PSD, there is no feature space it corresponds to, the SVM's quadratic program is **no longer convex**, and you lose the guarantee of a unique global optimum (the solver can misbehave). Linear, polynomial, and RBF all satisfy Mercer's condition; the sigmoid kernel does **not** for all parameter settings, which is why it is used cautiously. Practically it also means you can *build* new valid kernels by combining valid ones — sums, products, and positive scalings of Mercer kernels are Mercer kernels.

### Q9. Can you use kernels outside of SVMs?

Yes — **any algorithm expressible purely through inner products can be kernelised.** The SVM is the famous case but far from the only one.

- **Kernel PCA** — standard PCA finds eigenvectors of the covariance (built from dot products); swap in K and you get non-linear principal components.
- **Kernel ridge regression** — ridge regression's solution depends only on `X X^T`; kernelise it for non-linear regression.
- **Gaussian processes** — the covariance/kernel function *is* the model; RBF is the default GP kernel, controlling smoothness.
- **Kernel k-means / spectral clustering** — cluster in feature space via the Gram matrix, enabling non-convex clusters.

The unifying idea: kernels are a modular way to inject non-linearity into linear methods. Whenever you see an algorithm written in terms of `x_i·x_j`, you can kernelise it.

### Q10. Why does RBF SVM overfit as gamma increases?

Because large gamma makes each training point's Gaussian bump **narrow**, so its influence does not reach its neighbours. In the extreme, every training point sits on its own tall, thin spike and the decision boundary loops tightly around each one to classify it correctly — the model effectively becomes a **1-nearest-neighbour lookup** that memorises the training set. Training accuracy heads to 100% while test accuracy collapses: classic overfitting. The kernel matrix approaches the identity (each point similar only to itself), so the model captures noise as if it were signal. This is the visual you should be able to describe: as gamma grows, the boundary goes from a smooth curve to an archipelago of tiny islands around individual points.

### Q11. What does the polynomial kernel's feature space look like?

For `K(x, x') = (x·x' + c)^d`, the implicit feature map `phi(x)` contains **all monomials of the input features up to degree d** — original features, their squares, and cross-products (interactions).

Take a 2D input `x = (x1, x2)` with `d = 2, c = 1`. Expanding `(x1*x1' + x2*x2' + 1)^2` shows phi(x) contains the terms:

```
1, x1, x2, x1^2, x2^2, x1*x2   (each with a constant weight)
```

So a degree-2 polynomial kernel lets a linear separator use squares and pairwise products — enough to draw ellipses and hyperbolas. The constant `c` trades off the influence of higher- vs lower-order terms (`c=0` gives pure degree-d monomials). The dimension of this space grows combinatorially with d, which is exactly why you compute K instead of phi — and why high d overfits and gets numerically unstable.

### Q12. When would you prefer a linear kernel over RBF?

- **High-dimensional, sparse data** (text as TF-IDF, bag-of-words, genomics): data is often already linearly separable in the original high-dim space, so lifting adds nothing. Linear wins on accuracy *and* speed.
- **n >> or << p edge cases**: with very many features relative to samples, RBF tends to overfit; linear is safer.
- **Speed / scale**: linear SVMs have specialised solvers (LIBLINEAR, SGD) that scale to millions of samples; RBF needs the n-by-n Gram matrix (O(n^2) memory, O(n^2)-O(n^3) time), impractical for huge n.
- **Interpretability**: a linear SVM has explicit feature weights you can inspect; RBF's decision surface is opaque.

Rule of thumb: **try linear first.** If it already separates well, an RBF kernel only adds cost and overfitting risk. Reserve RBF for lower-dimensional data with genuine non-linear structure.

### Q13. What is the Gram (kernel) matrix and what are its cost implications?

The **Gram matrix** (or kernel matrix) is the n-by-n matrix `K_ij = K(x_i, x_j)` of all pairwise kernel evaluations. It is *everything* a kernel method sees about the data — the algorithm never touches the raw features again once K is formed.

Cost implications, which are the whole scalability story of kernel SVMs:

- **Memory**: O(n^2) to store K. At n = 100,000 that is 10^10 entries — tens of gigabytes. This alone rules out RBF SVMs on large datasets.
- **Time**: training is roughly O(n^2) to O(n^3) depending on the solver, because it manipulates K.

This is why kernel SVMs are excellent for **small-to-medium** datasets (thousands to low tens of thousands) and why practitioners switch to **linear SVMs, tree ensembles, or approximations** (Nystrom, random Fourier features) beyond that. The Gram matrix must also be PSD (Mercer) for the optimisation to be well-posed.

### Q14. Can you construct new valid kernels from existing ones?

Yes — Mercer kernels are **closed under several operations**, which lets you compose custom kernels while guaranteeing validity. If K1 and K2 are valid kernels, then so are:

- `K1 + K2` (sum)
- `c * K1` for `c > 0` (positive scaling)
- `K1 * K2` (product)
- `f(x) * K1(x,x') * f(x')` for any function f
- `exp(K1)` and polynomials of K1 with non-negative coefficients

Why it matters: you can encode domain knowledge — e.g. sum a kernel over text features with a kernel over numeric features to handle mixed data, each with its own gamma. This is heavily used in Gaussian processes, where practitioners build structured kernels (add a periodic kernel to an RBF to model "smooth trend plus seasonality"). The closure properties are what make kernel design a compositional, safe activity rather than guesswork.

### Q15. RBF SVM vs a neural network — how do they relate?

Both produce non-linear decision boundaries, but they get there differently.

- **RBF SVM** — a **fixed** implicit feature map (the infinite-dim RBF space) plus a *convex* optimisation. No representation learning: the features are dictated by the kernel; you only tune C and gamma. Guaranteed global optimum. Shines on **small-to-medium** data; scales poorly (O(n^2) Gram matrix).
- **Neural network** — **learns** its feature representation through backprop; non-convex, many local optima, needs lots of data and tuning, but scales to millions of examples and unstructured data (images, audio, text) where the right features are not obvious.

Interview framing: RBF SVM = "fixed non-linear features + convex solve, great when data is limited"; neural net = "learned features + non-convex solve, great when data is abundant." An RBF SVM is sometimes described as a shallow network with one hidden unit per support vector — the connection is that both are weighted sums of basis functions.

### Q16. What is kernel PCA and how does it differ from ordinary PCA?

**Ordinary PCA** finds the orthogonal directions of maximum variance — the eigenvectors of the covariance matrix — which are **linear** combinations of the original features. It cannot uncover curved structure (e.g. data on a spiral or a swiss roll).

**Kernel PCA** applies the kernel trick: it performs PCA in the implicit feature space defined by a kernel. Because PCA can be rewritten to depend only on inner products, you replace them with `K(x_i, x_j)`, form and centre the n-by-n kernel matrix, and take *its* eigenvectors. The resulting principal components are **non-linear** in the original features, so kernel PCA can unfold manifolds that linear PCA cannot.

Differences: kernel PCA needs a kernel choice (and gamma), works with the O(n^2) kernel matrix rather than the O(p^2) covariance matrix (so it scales with samples, not features), and loses the clean "these are linear directions in feature space" interpretability. It is the bridge between PCA and non-linear dimensionality reduction, and a clean demonstration that the kernel trick is not SVM-specific.

## k-Means Clustering

### Summary

**What this topic covers**

The default unsupervised clustering algorithm and the one every interview reaches for first. This topic owns k-means end to end: the **objective** it minimises (within-cluster sum of squares, aka inertia), **Lloyd's algorithm** (the assign-then-update loop) and why it only reaches a **local** optimum, the **k-means++** initialization that makes it reliable, the perennial problem of **choosing k** (elbow, silhouette, gap statistic), the **assumptions** baked in (spherical, similar-size clusters, Euclidean geometry) and the concrete ways it **fails** (non-convex shapes, varying density, outliers, unscaled features), the **mini-batch** variant for scale, its **O(n*k*i*d)** complexity, and the standard comparison to **GMM**. The 16 questions span warm-up ("what does k-means optimise") through senior ("prove Lloyd's algorithm converges", "why can't it separate two moons"). This is the algorithm interviewers use to test whether you understand not just *how* to run a clusterer but *when its assumptions break* — which is where most candidates get exposed.

**Mental model**

k-means answers one question: "put every point into one of k groups so that points in a group are as close as possible to their group's centre." A cluster is defined entirely by its **centroid** — the mean of its members. The algorithm alternates two cheap steps until nothing moves: (1) **assign** each point to the nearest centroid, (2) **move** each centroid to the mean of the points now assigned to it. Each step can only decrease (or hold) the total within-cluster squared distance — the **inertia** — so the process is guaranteed to converge. But it converges to a **local** minimum determined by where the centroids started, which is why initialization matters and why you run it multiple times. Geometrically, k-means carves the space into a **Voronoi diagram**: straight-line boundaries equidistant between centroids. That single fact explains its greatest weakness — it can only draw **convex, roughly spherical** cluster boundaries, so it fails the moment the true clusters are elongated, nested, or crescent-shaped.

**Key terms**

- **Centroid** — the mean position of the points in a cluster; k-means represents each cluster by one.
- **Inertia / WCSS** — within-cluster sum of squares, `sum over clusters sum over points ||x - centroid||^2`; the objective to minimise.
- **Lloyd's algorithm** — the iterative assign-nearest / recompute-mean loop; the standard k-means solver.
- **k-means++** — a seeding scheme that picks initial centroids spread far apart, improving speed and solution quality.
- **Local minimum** — the (possibly suboptimal) solution Lloyd's converges to; depends on initialization.
- **Voronoi cell** — the region of space closest to a given centroid; k-means clusters are Voronoi cells (convex).
- **Elbow method** — plot inertia vs k, pick the k where the curve bends.
- **Silhouette score** — per-point measure of how well it fits its cluster vs the next-nearest; averages to a k-quality score in [-1, 1].
- **Gap statistic** — compares inertia to that expected under a random reference distribution to choose k.
- **Mini-batch k-means** — updates centroids on small random batches; trades a little quality for large speedups.
- **n_init** — number of random restarts; the best (lowest-inertia) run is kept.

**Why interviewers ask this**

k-means is the "do you actually understand clustering, or did you just call `.fit()`" filter. The warm-up ("what does it optimise") separates people who know it minimises inertia from those who wave at "groups similar points." The real signal is the **failure modes**: a strong candidate volunteers, unprompted, that k-means assumes spherical equal-size clusters, is sensitive to scale and outliers, needs k chosen in advance, and only finds a local optimum — and can *draw* why two moons or two concentric rings defeat it (Voronoi boundaries are linear). Seniors go further: they explain **k-means++** and *why* random init is bad, connect k-means to **GMM** as its hard-assignment special case, and reason about **choosing k** as an ill-posed problem with heuristic answers rather than a single correct value. Getting the assumptions wrong — or claiming k-means "finds the optimal clustering" — is a fast disqualifier.

**Common confusions**

- "k-means finds the global optimum" — no. Lloyd's algorithm finds a **local** minimum of inertia; the result depends on initialization, which is why n_init > 1 and k-means++ exist.
- "k-means and KNN are related" — unrelated beyond both using distances. KNN is *supervised* classification with a k *neighbours*; k-means is *unsupervised* clustering with k *clusters*.
- "You don't need to scale features" — you must. k-means uses Euclidean distance, so a feature on a larger scale dominates the clustering.
- "There is a correct k the algorithm finds" — k is a *hyperparameter you choose*; elbow/silhouette/gap are heuristics, not a ground truth.
- "k-means handles any cluster shape" — only convex, roughly spherical, similar-density blobs. Crescents, rings, and elongated clusters break it.
- "Centroids are actual data points" — they are means, generally not equal to any real point (that is k-medoids, which uses actual points).

**What follows from this topic**

k-means is the springboard into the rest of clustering. Its failures *motivate* the next topic, **Hierarchical & Density Clustering** — DBSCAN exists precisely to handle the arbitrary shapes and noise k-means cannot, and hierarchical clustering removes the "choose k upfront" burden. Its hard-assignment nature contrasts with **GMM & EM** (soft, probabilistic, elliptical clusters — k-means is GMM with spherical equal covariances and hard assignments). The scaling and distance sensitivities tie back to the **ML Fundamentals** primer's feature-scaling discussion. Master k-means's assumptions and you have the yardstick against which every other clustering algorithm is compared.

### Q1. What does k-means actually optimise?

k-means minimises the **within-cluster sum of squares (WCSS)**, also called **inertia**: the total squared Euclidean distance from each point to its cluster's centroid.

```
minimize   J = sum over clusters c  sum over points x in c  ||x - mu_c||^2
```

where `mu_c` is the centroid (mean) of cluster c. Equivalently, it partitions the data into k groups so that each group is as compact as possible around its mean. Two things fall out of this objective: (1) the optimal centroid for a fixed assignment is the **mean** of its members (which is *why* the update step uses the mean — the mean minimises squared distance), and (2) because it is squared Euclidean distance, k-means is **sensitive to scale and outliers** and biased toward **spherical, equal-variance** clusters. Minimising inertia exactly is NP-hard, so we use Lloyd's algorithm to find a local minimum.

### Q2. Walk through Lloyd's algorithm step by step.

Lloyd's algorithm is the standard k-means solver — a two-step loop:

```python
def kmeans(X, k):
    centroids = kmeans_plus_plus_init(X, k)   # seed k centroids
    while not converged:
        # 1. ASSIGN: each point to its nearest centroid
        labels = [argmin_c distance(x, centroids[c]) for x in X]
        # 2. UPDATE: move each centroid to the mean of its members
        for c in range(k):
            centroids[c] = mean(X[labels == c])
    return labels, centroids
```

1. **Initialise** k centroids (ideally via k-means++).
2. **Assignment step** — assign each point to the nearest centroid (Euclidean). This partitions space into Voronoi cells.
3. **Update step** — recompute each centroid as the mean of the points assigned to it.
4. **Repeat** 2-3 until assignments stop changing (or centroids move less than a tolerance, or max iterations reached).

Each iteration is O(n*k*d). Both steps monotonically decrease inertia, guaranteeing convergence — but to a local minimum set by the initialization.

### Q3. Prove (informally) that Lloyd's algorithm converges.

The argument is **monotone decrease of a bounded objective**. Inertia J is non-negative (bounded below by 0) and each of the two steps can only decrease or hold J:

- **Assignment step** — reassigning each point to its *nearest* centroid cannot increase any point's squared distance versus its previous assignment, so J does not increase.
- **Update step** — for a fixed assignment, the point that minimises the sum of squared distances to a set of points is their **mean**. Moving each centroid to the mean therefore minimises J for that assignment, so J does not increase.

Since J decreases monotonically and is bounded below, it converges. Because there are only finitely many possible assignments of n points to k clusters (at most k^n), the algorithm cannot cycle forever without repeating a state, so it reaches a fixed point in finite steps. Crucially this proves convergence to a **local** minimum, not the global one — the fixed point depends entirely on where the centroids started.

### Q4. Why does k-means only find a local minimum, and what do we do about it?

Because Lloyd's algorithm is a **greedy coordinate descent** on a **non-convex** objective: it improves inertia at every step but can get trapped in a basin determined by the initial centroids. Different seeds land in different local minima — sometimes badly wrong (e.g. two centroids sharing one true cluster while a real cluster gets none).

Mitigations:

- **Multiple restarts (`n_init`)** — run k-means several times from different random seeds and keep the run with the **lowest inertia**. sklearn defaults to n_init=10.
- **k-means++ initialization** — spread the initial centroids far apart so restarts start from good, diverse configurations, sharply reducing the chance of a bad local minimum.

Together these make k-means reliable in practice despite the theoretical NP-hardness of the global optimum. The key interview point: k-means is *deterministic given its seeds* but *sensitive to them*, so we hedge with restarts.

### Q5. What is k-means++ and why does it matter?

**k-means++** is a smarter initialization that chooses starting centroids that are **spread out** instead of picking k points uniformly at random.

```python
def kmeans_plus_plus_init(X, k):
    centroids = [random_point(X)]                 # 1st centroid: random
    for _ in range(k - 1):
        # distance from each point to its nearest existing centroid
        d2 = [min(dist(x, c)**2 for c in centroids) for x in X]
        # pick next centroid with probability proportional to d2
        centroids.append(sample(X, weights=d2))
    return centroids
```

Each new centroid is sampled with probability proportional to its **squared distance to the nearest existing centroid**, so points far from current centroids are likely to be chosen — you avoid clumping seeds inside one true cluster.

Why it matters: (1) it makes each restart start from a good configuration, so you need fewer restarts and rarely hit a bad local minimum; (2) it has a theoretical guarantee — expected inertia within O(log k) of optimal; (3) it usually converges in fewer iterations. It is the default in sklearn (`init="k-means++"`) for exactly these reasons.

### Q6. How do you choose k?

There is no single correct k — it is a hyperparameter, and these are the standard heuristics:

- **Elbow method** — plot inertia vs k. Inertia always decreases as k grows (more centroids = tighter fit), but the *rate* of improvement drops off; pick the k at the "elbow" where adding clusters stops helping much. Subjective and often ambiguous.
- **Silhouette score** — for each point, compare its mean distance to its own cluster (a) vs the nearest other cluster (b): `s = (b - a) / max(a, b)`, ranging [-1, 1]. Average over all points; choose the k with the **highest** silhouette. More principled than the elbow.
- **Gap statistic** — compare the clustering's inertia to the inertia expected under a random uniform reference distribution; pick the k with the largest gap. More rigorous, more compute.

In practice combine domain knowledge with silhouette (or gap). The interview signal is knowing that **choosing k is ill-posed** and that these are heuristics, not oracles.

### Q7. Why does the elbow method work, and what is its weakness?

**Why it works**: inertia decreases monotonically as k rises — with k = n every point is its own cluster and inertia is 0. Early on, adding a cluster splits a genuinely distinct group and inertia drops sharply. Once k exceeds the number of *real* clusters, extra clusters only carve up already-tight groups, so inertia falls slowly. The **elbow** is where that transition happens — the point of diminishing returns, a proxy for the true number of clusters.

**Weakness**: the elbow is often **not sharp**. On real data the inertia curve bends gradually, so the "elbow" is subjective and different people read different k. It also assumes clusters are the k-means-friendly kind (spherical, similar size). When there is no clear elbow, silhouette or the gap statistic give a more decisive answer. That ambiguity is exactly why interviewers like the follow-up "and what's wrong with the elbow method?"

### Q8. What assumptions does k-means make?

Four load-bearing assumptions, each a potential failure mode:

1. **Spherical (isotropic) clusters** — because it uses plain Euclidean distance and represents a cluster by a single centre, it assumes clusters are round blobs. Elongated or correlated clusters break it.
2. **Similar-size / similar-density clusters** — inertia is a global sum, so a large-variance cluster gets "split" to reduce total inertia, and small clusters get swallowed. It is biased toward equal-radius clusters.
3. **Euclidean geometry is meaningful** — distances must be comparable across dimensions, which requires **feature scaling**.
4. **k is known** — you must specify the number of clusters in advance.

Additionally it assumes **convex** clusters (Voronoi cells are convex) and is **sensitive to outliers** (a far point drags its centroid). Naming these unprompted is the senior signal — it shows you know *when not to use it*, not just how to run it.

### Q9. Give concrete examples of when k-means fails.

- **Non-convex shapes (two moons, concentric rings)** — Voronoi boundaries are straight lines, so k-means cannot wrap around a crescent or separate nested rings. It slices them geometrically, ignoring the true structure.
- **Clusters of very different size or density** — the global inertia objective splits the big/loose cluster and merges the small/tight ones, because that lowers total WCSS.
- **Outliers** — since centroids are means, a single distant point drags its centroid away and distorts the cluster (means are not robust).
- **Unscaled features** — a feature measured in thousands dominates one measured in fractions; the clustering keys off the large-scale feature only.
- **Non-globular / manifold data** — data on a curved manifold (swiss roll) has no meaningful centroid.

The fix for shape/density problems is **DBSCAN** or spectral clustering; for size/covariance it is **GMM**; for outliers, remove them or use k-medoids; for scale, standardise first. Being able to say "here's the failure *and* here's what I'd reach for instead" is the strong answer.

### Q10. Why must you scale features before k-means?

Because k-means clusters by **Euclidean distance**, and Euclidean distance is dominated by whichever feature has the largest numeric range. Example: clustering people by `age` (0-100) and `income` (0-100,000). Without scaling, `||x - mu||^2` is almost entirely the income term — age contributes negligibly — so the clusters are effectively income-only, and the age dimension is ignored regardless of its relevance.

Standardising (z-score: subtract mean, divide by std) or min-max scaling puts every feature on a comparable footing so each contributes proportionally to the distance. This is one of the most common practical k-means mistakes. Note the subtlety: scaling *equalises* feature influence, which is usually what you want — but if you genuinely believe one feature should matter more, scaling is a modelling decision, not a mere preprocessing step. Either way, unscaled k-means is almost always a bug.

### Q11. What is the time and space complexity of k-means?

**Time**: O(n * k * i * d) where n = points, k = clusters, i = iterations to converge, d = dimensions. Each iteration computes the distance from every point to every centroid (n*k*d work) and does that i times. This is **linear in n**, which is why k-means scales far better than O(n^2) methods like hierarchical clustering or kernel SVMs — it is the workhorse for large datasets.

**Space**: O(n*d + k*d) — the data plus the centroids; modest.

Caveats: i is usually small (tens of iterations) but not bounded a priori; k-means++ adds an O(n*k*d) seeding pass; and running n_init restarts multiplies the whole cost by n_init. In very high dimensions the curse of dimensionality erodes the meaningfulness of Euclidean distance (a reason to run PCA first). For truly large n, **mini-batch k-means** cuts the per-iteration cost dramatically.

### Q12. What is mini-batch k-means and what does it trade off?

**Mini-batch k-means** speeds up Lloyd's algorithm by updating centroids using small **random batches** of data instead of the full dataset each iteration.

```python
# each iteration:
batch = random_sample(X, size=b)          # b << n
labels = assign_to_nearest(batch, centroids)
# gradient-style update: nudge centroids toward batch means
for c in clusters:
    centroids[c] = (1 - lr) * centroids[c] + lr * mean(batch[labels == c])
```

Instead of recomputing each centroid as the exact mean of all its members, it takes a **running, learning-rate-weighted update** from each mini-batch. Per-iteration cost drops from O(n*k*d) to O(b*k*d) with b << n.

**Trade-off**: slightly **worse (higher) inertia** — the solution is a bit noisier and less optimal — in exchange for **much faster** training and lower memory, enabling k-means on datasets too large to fit in memory or too slow for full Lloyd's. For massive data the small quality loss is well worth the speedup; for small data, use full k-means.

### Q13. Compare k-means and GMM.

They are close cousins — k-means is essentially a hard-assignment, spherical special case of a Gaussian Mixture Model.

| | k-means | GMM |
|---|---|---|
| Assignment | **Hard** (one cluster each) | **Soft** (probability per cluster) |
| Cluster shape | Spherical, equal variance | **Elliptical** (full covariance per cluster) |
| Fit by | Lloyd's algorithm | **Expectation-Maximization** |
| Cluster represented by | Centroid (mean) | Mean + covariance + mixing weight |
| Output | Labels | Labels + membership probabilities |
| Cost | Cheaper, fewer parameters | More parameters, slower, can hit singularities |

The deep connection: **GMM with spherical, equal covariances and hard assignments reduces to k-means.** GMM generalises k-means by letting clusters be **elliptical** (via covariance matrices) and assignments **soft** (a point can be 70% cluster A / 30% cluster B). Use GMM when clusters overlap or are stretched/correlated and you want probabilities; use k-means when clusters are roughly round and you want speed and simplicity.

### Q14. How is k-means related to KNN? (trick question)

**They are essentially unrelated** — a common trap because both start with "k" and use distances. The differences are fundamental:

| | k-means | KNN |
|---|---|---|
| Learning type | **Unsupervised** (no labels) | **Supervised** (needs labels) |
| Task | Clustering | Classification / regression |
| What k means | number of **clusters** | number of **neighbours** consulted |
| Training | iterative centroid fitting | none (**lazy** — stores data) |
| Prediction | assign to nearest centroid | vote among k nearest points |

k-means *learns* k centroids to partition unlabelled data; KNN *memorises* labelled data and classifies a new point by the majority label of its k nearest neighbours. The only shared DNA is Euclidean distance. If an interviewer asks "how does k in k-means compare to k in KNN," the correct answer is "they refer to completely different things" — conflating them is a classic junior mistake.

### Q15. Is k-means guaranteed to use exactly k clusters? What about empty clusters?

k-means *targets* k clusters, but Lloyd's algorithm can produce an **empty cluster** — a centroid to which no point is nearest (common with bad initialization or an outlier-driven seed). When that happens the "cluster" has no members, so its mean is undefined.

Implementations handle this rather than crash:

- **Reinitialise** the empty centroid — e.g. place it at the point **farthest** from its current centroid (the highest-inertia point), effectively stealing a poorly-served point to seed a new cluster.
- Or drop it and continue with fewer clusters.

sklearn relocates empty-cluster centroids automatically. The takeaway for interviews: k is an *upper target*, not an iron guarantee, and empty clusters are a symptom of poor initialization — another argument for **k-means++**, which spreads seeds and makes empty clusters rare. If you consistently get empty clusters, k is probably too large for the data.

### Q16. How do you evaluate clustering quality without ground-truth labels?

Since clustering is unsupervised, you usually lack labels, so you use **internal validation** metrics that measure cluster cohesion and separation:

- **Silhouette score** — per point, `s = (b - a) / max(a, b)` where a = mean intra-cluster distance, b = mean distance to the nearest other cluster. Near +1 = well-clustered, near 0 = on a boundary, negative = probably misassigned. Average across points.
- **Davies-Bouldin index** — average ratio of within-cluster scatter to between-cluster separation; **lower is better**.
- **Calinski-Harabasz index** — ratio of between-cluster to within-cluster dispersion; **higher is better**.
- **Inertia** — useful for the elbow but always decreases with k, so not a standalone quality measure.

If you *do* have labels (benchmarking), use **external** metrics: Adjusted Rand Index or Normalized Mutual Information, which compare predicted clusters to true classes while correcting for chance. The honest caveat every senior mentions: these metrics reward k-means-style compact convex clusters, so they can *penalise* a correct DBSCAN clustering of crescents. Metrics guide, they do not decide — validate against the downstream use.

## Hierarchical & Density Clustering

### Summary

**What this topic covers**

The two major clustering families that pick up where **k-means** leaves off. **Agglomerative hierarchical clustering** builds a bottom-up tree (**dendrogram**) by repeatedly merging the closest clusters according to a **linkage** rule (single, complete, average, Ward) — and lets you choose k *after* seeing the structure by cutting the tree. **DBSCAN** takes a density view: it grows clusters from dense regions (parametrised by **eps** and **min_samples**), discovers **arbitrary shapes**, explicitly labels **outliers as noise**, and needs no k at all. This topic covers how each is built, the linkage choices and what they do, reading and cutting a dendrogram, DBSCAN's core/border/noise point taxonomy, the eps/min_samples knobs and how to set them, the strengths and the sharp weaknesses (hierarchical's O(n^2) cost; DBSCAN's struggle with **varying density**), and — the payoff question — a full **k-means vs hierarchical vs DBSCAN** comparison across shape, k, noise, scale, and cost. The 16 questions run from "what is a dendrogram" to "why does DBSCAN fail on varying density" and "when would you pick each."

**Mental model**

Two opposite philosophies. **Hierarchical (agglomerative)**: start with every point as its own cluster, then repeatedly glue the two *closest* clusters together, recording each merge, until everything is one cluster. The record is a **dendrogram** — a tree whose branch heights show *how far apart* things were when merged. You get *all* values of k at once and choose one by slicing the tree horizontally. The whole behaviour hinges on how you define "distance between two clusters" — the **linkage**. **Density-based (DBSCAN)**: forget centroids and trees; a cluster is a **contiguous dense region**. Plant yourself on any point, ask "do I have at least min_samples neighbours within radius eps?" — if yes you are a *core* point and your neighbourhood joins your cluster, recursively. Points in no dense region are **noise**. This is why DBSCAN finds crescents and rings that k-means cannot, and why it is the go-to when you have outliers and no idea how many clusters exist — but also why wildly varying density confuses its single global eps.

**Key terms**

- **Agglomerative clustering** — bottom-up: each point starts alone, closest clusters merge repeatedly.
- **Dendrogram** — the tree of merges; branch height = distance at which clusters joined; cut it to get k.
- **Linkage** — the rule for inter-cluster distance: single, complete, average, or Ward.
- **Single linkage** — distance = closest pair; chains, finds non-globular shapes but suffers "chaining."
- **Complete linkage** — distance = farthest pair; compact, equal-diameter clusters.
- **Average linkage** — distance = mean over all pairs; a middle ground.
- **Ward linkage** — merges that minimise the increase in within-cluster variance; k-means-like, the common default.
- **DBSCAN** — density-based clustering via eps and min_samples; finds arbitrary shapes, labels noise.
- **eps** — DBSCAN neighbourhood radius; the key density scale knob.
- **min_samples** — points required within eps for a point to be a **core** point.
- **Core / border / noise point** — dense-region centre / edge-of-cluster / unclustered outlier.

**Why interviewers ask this**

These algorithms test whether you can move *beyond* k-means and match an algorithm to the data's structure. The core signals: (1) knowing hierarchical clustering **defers the choice of k** and produces an interpretable dendrogram, and being able to explain **linkage** differences (especially why single linkage chains and why Ward behaves like k-means); (2) knowing DBSCAN clusters by **density**, so it handles **arbitrary shapes and noise** without a preset k — and, critically, that it **fails on varying density** because eps is global. The killer question is the three-way comparison: an interviewer wants you to reason "the data has outliers and weird shapes → DBSCAN; I want a hierarchy/no fixed k → agglomerative; I have big, round, well-separated blobs → k-means." Candidates who only know k-means look one-dimensional; knowing when to reach for density- or hierarchy-based methods signals real breadth. Complexity awareness (hierarchical is O(n^2)+, so it does not scale) is the senior detail.

**Common confusions**

- "DBSCAN needs the number of clusters" — it does **not**; it discovers k from density. That is a headline advantage over k-means.
- "Hierarchical clustering scales fine" — it does not. Naive agglomerative is O(n^3), optimised O(n^2) with O(n^2) memory — impractical past ~10k points.
- "DBSCAN has no hyperparameters to tune" — it has two, **eps** and **min_samples**, and it is *very* sensitive to eps.
- "Ward linkage works with any distance" — Ward is defined for **Euclidean** distance (it minimises variance); pairing it with other metrics is ill-defined.
- "Cutting a dendrogram anywhere is fine" — the cut height determines k and the clusters; where you cut is a real modelling decision.
- "DBSCAN handles varying density" — it struggles: a single global eps cannot be simultaneously right for a dense cluster and a sparse one (HDBSCAN addresses this).

**What follows from this topic**

This topic completes the clustering arc opened by **k-means**: hierarchical removes the "choose k upfront" constraint, DBSCAN removes the "spherical, no-outliers" constraint. Together the three form the standard clustering decision matrix every interview expects. The density and connectivity ideas here also foreshadow **GMM & EM** (soft, probabilistic clustering for overlapping elliptical groups) and connect to manifold methods in the dimensionality-reduction topics — DBSCAN and single-linkage both key off local neighbourhood structure, the same intuition **t-SNE** and **UMAP** exploit. If k-means is the default, this topic is the toolkit for when the default's assumptions break.

### Q1. What is agglomerative hierarchical clustering?

**Agglomerative** hierarchical clustering is a **bottom-up** method: every point starts as its own singleton cluster, and you repeatedly **merge the two closest clusters** until a single cluster contains everything.

```python
def agglomerative(X, linkage):
    clusters = [[x] for x in X]          # each point its own cluster
    while len(clusters) > 1:
        # find the two clusters with minimum inter-cluster distance
        a, b = argmin_pair(clusters, linkage)
        merge(a, b)                       # record this merge + its distance
    return dendrogram_of_merges
```

The sequence of merges (and the distance at each) forms a **dendrogram** — a tree you can cut at any height to obtain any number of clusters. The defining choice is the **linkage** function: how you measure distance *between clusters* (not just points). Its opposite, **divisive** clustering, is top-down (start with one cluster, recursively split) but is rarely used because splitting is expensive. The big selling points: you do **not** choose k in advance, and the dendrogram is highly interpretable.

### Q2. What is a dendrogram and how do you use it to pick k?

A **dendrogram** is the tree diagram recording the agglomerative merge history. Leaves are individual points; each internal node is a merge; the **height** of a node is the **distance** (per the linkage) at which those two clusters joined. Tall vertical links mean two dissimilar clusters were forced together; short links mean very similar clusters merged early.

To pick k, you **cut the dendrogram with a horizontal line**: the number of vertical branches the line crosses is the number of clusters, and each crossed branch is one cluster. Cut low → many small clusters; cut high → few large ones.

Practical heuristic: cut where there is a **large vertical gap** — a tall stretch with no merges — because that means the next merge would fuse two genuinely dissimilar groups. The main advantage over k-means: you see the whole hierarchy first and choose k *afterward*, rather than committing blindly upfront. The cut height is a real modelling decision.

### Q3. Explain the linkage methods and how they differ.

**Linkage** defines the distance between two *clusters* (given point-to-point distances):

| Linkage | Inter-cluster distance | Behaviour |
|---|---|---|
| **Single** | distance between the **closest** pair | finds elongated/non-globular shapes; suffers **chaining** (clusters string together via bridges) |
| **Complete** | distance between the **farthest** pair | compact, roughly equal-diameter clusters; sensitive to outliers |
| **Average** | **mean** distance over all cross pairs | compromise between single and complete |
| **Ward** | merge that **minimises the increase in within-cluster variance** | k-means-like spherical clusters; common default; Euclidean only |

- **Single** is greedy about the nearest link, so it can follow a thin bridge of points and merge two clusters that are mostly far apart — good for non-convex shapes, bad when clusters aren't well-separated.
- **Complete** is conservative (worst-case distance), giving tight balls but breaking large clusters.
- **Ward** tends to produce the most k-means-like, balanced clusters and is the usual go-to for general data.

The linkage choice changes the clusters as much as k does — it is the central hierarchical hyperparameter.

### Q4. What is chaining and which linkage causes it?

**Chaining** is the tendency of **single linkage** to merge clusters that are individually far apart because a thin "chain" or bridge of intermediate points connects them. Since single linkage defines cluster distance as the **closest pair**, a single pair of nearby points is enough to fuse two otherwise-distant groups — the clusters string together end-to-end like a chain rather than forming compact blobs.

This is a **double-edged** property:

- **Upside** — it lets single linkage trace **elongated, non-convex** shapes (spirals, snakes) that complete/Ward linkage would fragment. It behaves somewhat like DBSCAN's connectivity.
- **Downside** — with noisy or poorly-separated data, a few bridging points collapse clusters that should stay separate, producing one sprawling low-quality cluster.

Complete and Ward linkage resist chaining because they consider the farthest pair / total variance, not just the nearest link. When an interviewer asks "why might single linkage give one giant cluster," chaining is the answer.

### Q5. What is the time and space complexity of hierarchical clustering, and why does it matter?

**Time**: naive agglomerative is **O(n^3)** (each of n merges scans all pairwise distances); with priority queues / optimised algorithms (e.g. SLINK for single linkage) it drops to **O(n^2 log n)** or **O(n^2)**. **Space**: **O(n^2)** to hold the pairwise distance matrix.

Why it matters: this is the algorithm's **defining limitation**. The O(n^2) memory alone makes it impractical beyond roughly **10,000-50,000 points** — at n = 100,000 the distance matrix is 10^10 entries. So despite its interpretability and not needing k upfront, hierarchical clustering **does not scale**, and for large datasets you fall back to k-means (O(n*k*i*d), linear in n) or DBSCAN (roughly O(n log n) with spatial indexing). This scalability gap is the standard senior trade-off: hierarchical gives you a rich, choose-k-later dendrogram, but only on small-to-medium data.

### Q6. What is DBSCAN and how does it define a cluster?

**DBSCAN** (Density-Based Spatial Clustering of Applications with Noise) defines a cluster as a **contiguous region of high point density**, separated from other clusters by regions of low density. It has two parameters: **eps** (a radius) and **min_samples** (a count).

It classifies every point into one of three types:

- **Core point** — has at least `min_samples` points (including itself) within radius `eps`. It sits in a dense region.
- **Border point** — within `eps` of a core point but does not itself have min_samples neighbours; on the edge of a cluster.
- **Noise point** — neither core nor border; belongs to no cluster (an **outlier**).

A cluster is grown by starting at a core point and recursively absorbing everything **density-reachable** from it — all core points within eps, and their eps-neighbourhoods — until no more points can be added. Because clusters follow density rather than distance-to-a-centre, DBSCAN finds **arbitrary shapes**, needs **no k**, and **labels outliers as noise** — exactly the things k-means cannot do.

### Q7. Define core, border, and noise points in DBSCAN.

Given parameters **eps** (radius) and **min_samples**:

- **Core point** — a point with **at least min_samples** points within distance eps (counting itself). It is in the interior of a dense region and can *grow* a cluster: everything in its eps-neighbourhood joins its cluster.
- **Border point** — a point that is **within eps of a core point** but does **not** itself have min_samples neighbours. It belongs to the cluster of a core point that reached it but cannot recruit new members (it is on the cluster's fringe).
- **Noise point** — a point that is **neither core nor border**: not dense enough itself and not within eps of any core point. DBSCAN labels it an **outlier** (typically cluster label -1) and leaves it unclustered.

This taxonomy is what gives DBSCAN its two signature abilities: growing arbitrarily-shaped clusters (via chains of core points) and explicitly **rejecting outliers** rather than forcing every point into a cluster the way k-means does. Border points also introduce mild non-determinism — one reachable from two clusters is assigned to whichever claims it first.

### Q8. How do you choose eps and min_samples?

- **min_samples** — a rough rule is `min_samples >= d + 1` (d = dimensions), commonly set to **2*d**. Larger values ignore more points as noise and produce denser-required clusters; smaller values are noise-sensitive. It also sets the minimum meaningful cluster size.
- **eps** — the sensitive one. The standard technique is the **k-distance graph**: for each point compute the distance to its k-th nearest neighbour (k = min_samples), sort these distances ascending, and plot. Look for the **"knee/elbow"** — the sharp rise where points transition from being inside dense clusters to being outliers — and set eps there.

```python
from sklearn.neighbors import NearestNeighbors
nbrs = NearestNeighbors(n_neighbors=min_samples).fit(X)
dists, _ = nbrs.kneighbors(X)
kth = sorted(dists[:, -1])   # k-distance for each point, sorted
# plot kth; eps = the elbow value
```

Two cautions: **scale features first** (eps is a single global distance, so unscaled features distort it), and remember DBSCAN is **very sensitive to eps** — too small labels everything noise, too large merges distinct clusters into one.

### Q9. Why does DBSCAN struggle with clusters of varying density?

Because DBSCAN uses a **single global eps** (and min_samples) for the entire dataset, but "dense enough to be a cluster" is a *relative* notion. If one true cluster is tight and another is sparse:

- Choose a **small eps** suited to the dense cluster → the sparse cluster's points fail the min_samples test and get labelled **noise** (the sparse cluster disappears).
- Choose a **large eps** suited to the sparse cluster → the dense cluster and its surroundings merge together, and nearby distinct clusters get **fused** into one.

There is no single eps that is simultaneously correct for both densities. This is DBSCAN's central weakness and the mirror image of its strength: a fixed density threshold is great when all clusters share a density, fatal when they do not. The fix is **HDBSCAN** (Hierarchical DBSCAN), which builds a hierarchy over a *range* of density levels and extracts clusters at their locally-appropriate density, removing the single-eps constraint (though you still set min_cluster_size).

### Q10. What are the advantages of DBSCAN over k-means?

- **No k required** — DBSCAN discovers the number of clusters from the data's density; k-means demands k upfront.
- **Arbitrary cluster shapes** — density-connectivity traces crescents, rings, and elongated clusters; k-means only draws convex Voronoi cells.
- **Outlier handling** — DBSCAN explicitly labels sparse points as **noise** (-1); k-means forces every point into a cluster, so outliers distort centroids.
- **Robust to shape and, partly, to outliers** — the clustering is driven by dense cores, not by means that a single far point can drag.

The trade-offs (so you give a balanced answer): DBSCAN needs **eps/min_samples** tuning and is sensitive to eps, **struggles with varying density**, and degrades in **high dimensions** (distance concentration makes a good global eps hard to find). Rule of thumb: reach for DBSCAN when you have **noisy data with irregular cluster shapes and an unknown number of clusters**; stick with k-means for large, round, well-separated blobs where you know k.

### Q11. Compare k-means, hierarchical, and DBSCAN.

The payoff comparison — match the algorithm to the data:

| | k-means | Hierarchical (agglomerative) | DBSCAN |
|---|---|---|---|
| Need k upfront? | **Yes** | No (cut dendrogram after) | **No** (finds it) |
| Cluster shape | Convex/spherical only | Depends on linkage | **Arbitrary** |
| Handles outliers? | No (forced assignment) | No | **Yes** (labels noise) |
| Key params | k | k, linkage | eps, min_samples |
| Complexity | **O(n*k*i*d)**, scales | O(n^2)+, small data only | ~O(n log n) with index |
| Cluster sizes | Similar sizes assumed | Flexible | Density-based |
| Varying density | Struggles | OK | **Struggles** |
| Output | Flat labels | Dendrogram (hierarchy) | Labels + noise |
| Determinism | Seed-dependent | Deterministic | Mostly (border-point ambiguity) |

**When each wins**: k-means for **large, round, well-separated** clusters with known k and a need for speed; hierarchical for **small data** where you want an interpretable **hierarchy** and to defer k; DBSCAN for **noisy data with arbitrary shapes** and an unknown cluster count (but uniform-ish density). Being able to state these three "when each wins" cases crisply is the exact signal this topic tests.

### Q12. When would you choose hierarchical clustering over k-means?

- **You don't know k** and want to explore — the dendrogram shows cluster structure at *every* granularity, so you choose k after seeing it rather than guessing upfront.
- **You want an interpretable hierarchy** — the tree itself is the deliverable (taxonomies, phylogenetics, document/topic hierarchies, gene expression), where nested relationships matter, not just a flat partition.
- **Non-globular clusters** (with single/average linkage) that k-means' convex boundaries would mangle.
- **Deterministic results** — no random initialization, so the same data always gives the same tree (k-means varies by seed).
- **Small datasets** — where O(n^2) cost is affordable.

You would **not** choose it for **large data** (O(n^2)+ memory and time kill it) — that is exactly where k-means' linear-in-n cost wins. So the decision is largely: small + want-a-hierarchy-or-unknown-k → hierarchical; large + known-k + round clusters → k-means. Hierarchical trades scalability for interpretability and flexibility in choosing k.

### Q13. Is DBSCAN deterministic?

**Mostly, but not entirely.** Given fixed eps and min_samples, the sets of **core points** and **noise points** are completely determined — those assignments never change across runs. The only ambiguity is **border points**: a border point that lies within eps of core points from **two different clusters** gets assigned to whichever cluster's core reaches it **first**, which depends on the order in which points are processed.

So:

- **Core points and noise** — fully deterministic.
- **Border points on cluster boundaries** — can flip between adjacent clusters depending on iteration order.

In practice this affects only a small number of boundary points and rarely changes the overall clustering meaningfully, but it is a correct nuance to raise — it is the honest answer to "is DBSCAN deterministic?" (Contrast with k-means, whose *entire* result depends on random initialization.) If strict reproducibility of border assignments matters, fix the data ordering.

### Q14. Does DBSCAN require feature scaling?

**Yes — critically.** DBSCAN's entire notion of a cluster rests on **eps**, a single global distance radius applied uniformly across all dimensions (Euclidean by default). If features are on different scales, the distance is dominated by the large-scale feature, so eps effectively measures density in that one dimension and ignores the others — exactly the same failure as unscaled k-means, and arguably worse because there is only one eps to get right for the whole space.

Example: clustering by `age` (0-100) and `salary` (0-100,000) unscaled means eps is essentially a salary threshold; age contributes nothing to whether two points are "neighbours."

Standardise (z-score) or normalise features **before** DBSCAN so every dimension contributes proportionally to the neighbourhood test. This also makes the k-distance elbow (used to choose eps) meaningful. The general rule: **any distance-based algorithm — k-means, KNN, SVM-RBF, DBSCAN, hierarchical — needs feature scaling.**

### Q15. What is HDBSCAN and what problem does it solve?

**HDBSCAN** (Hierarchical DBSCAN) is an extension that fixes DBSCAN's biggest weakness: the **single global eps** that cannot cope with clusters of **varying density**.

Instead of fixing one eps, HDBSCAN considers DBSCAN across a **whole range of density levels**, builds a **hierarchy** of clusters (like agglomerative clustering, but density-based), and then extracts the clusters that are most **stable / persistent** across that range — each at its own locally appropriate density. So a dense cluster and a sparse cluster can both be recovered from the same run.

Benefits:

- Handles **varying density** clusters (DBSCAN's failure mode).
- Replaces the fiddly, highly-sensitive **eps** with the more intuitive **min_cluster_size**.
- Still finds arbitrary shapes, still labels noise, still needs no k.

Trade-off: more compute and a slightly more complex model. In practice, when someone reaches for DBSCAN but the data has clusters of differing density, HDBSCAN is the modern default. It is a good "what would you do about DBSCAN's varying-density problem?" follow-up answer.

### Q16. How does DBSCAN's density-connectivity find non-convex clusters that k-means cannot?

Because DBSCAN grows clusters by **transitive local reachability**, not distance to a global centre. A cluster is the set of points you can reach by hopping from **core point to core point**, each hop within eps. As long as a shape is a **continuously dense path** — a crescent, a spiral, an S-curve, two interlocking rings — the chain of overlapping eps-neighbourhoods traces it exactly, however curved it is. Density is a **local** property, so the global geometry can be arbitrary.

k-means, by contrast, assigns each point to the **nearest centroid**, carving space into **convex Voronoi cells** with straight-line boundaries. It has no way to represent a crescent: the centroid of a crescent sits *outside* the crescent, and a straight boundary cannot wrap around a curve or separate two nested rings (both rings share the same centre, so a centroid-based method cannot distinguish them).

The classic demonstrations — **two moons** and **concentric circles** — are perfectly separated by DBSCAN and hopelessly split by k-means. This local-density-vs-global-centroid distinction is the single clearest reason to reach for DBSCAN.
## Gaussian Mixture Models & EM

### Summary

**What this topic covers**

Gaussian Mixture Models (GMMs) as a **soft**, **probabilistic** clustering model, and **Expectation-Maximization (EM)** as the algorithm that fits them. Where k-means gives each point one hard label, a GMM says "point x is 70% cluster A, 25% cluster B, 5% cluster C" — a full posterior over clusters. This topic covers the generative story (data = a weighted sum of k Gaussians), the E-step / M-step loop, how GMM strictly **generalizes k-means** (k-means falls out as GMM with spherical equal-variance components and hard assignment), how covariance shape lets GMM model **elliptical, correlated, differently-sized** clusters, choosing the number of components with **BIC / AIC**, and the failure modes (singular covariances, local optima, initialization sensitivity). The 16 questions run from "what is soft clustering" to "derive the EM updates and explain why the likelihood never decreases." It pairs with the k-means topic (the hard-assignment special case) and PCA (both are unsupervised latent-structure models).

**Mental model**

A GMM is a **generative model**: to sample a point, first roll a weighted die to pick a cluster k (with probability pi_k, the mixing weight), then draw x from that cluster's Gaussian N(mu_k, Sigma_k). The density is

  p(x) = sum_k pi_k * N(x | mu_k, Sigma_k),  with sum_k pi_k = 1.

Fitting means recovering pi, mu, Sigma from unlabeled data. We can't do it in closed form because we don't know which cluster generated each point — that's a **hidden/latent variable** z. EM breaks the chicken-and-egg: given current parameters, compute the **responsibility** r_nk = P(z_n = k | x_n) (a soft assignment, the **E-step**); given responsibilities, update each cluster's weight, mean, and covariance as a responsibility-weighted average (the **M-step**). Iterate. Each round is guaranteed not to decrease the data log-likelihood, so it climbs to a local optimum. k-means is the "hard" limit of this loop: shrink every covariance to a tiny sphere and responsibilities collapse to 0/1.

**Key terms**

- **Mixture component** — one of the k Gaussians; has a mean mu_k, covariance Sigma_k, and weight pi_k.
- **Mixing weight (pi_k)** — prior probability of a point coming from component k; the pi_k sum to 1.
- **Responsibility (r_nk)** — posterior probability that point n belongs to component k; the soft assignment computed in the E-step.
- **Soft clustering** — each point gets a probability distribution over clusters, not a single label.
- **Latent variable (z)** — the unobserved cluster identity of each point; what makes direct MLE intractable.
- **E-step** — with parameters fixed, compute responsibilities (posterior over clusters via Bayes' rule).
- **M-step** — with responsibilities fixed, re-estimate pi, mu, Sigma by responsibility-weighted MLE.
- **Covariance type** — spherical / diagonal / tied / full; controls cluster shape and parameter count.
- **BIC / AIC** — penalized-likelihood scores for choosing k (and covariance type) — lower is better.
- **Singularity** — a component collapsing onto a single point, driving one covariance to zero and the likelihood to infinity.
- **Log-likelihood** — sum_n log(sum_k pi_k N(x_n|mu_k,Sigma_k)); EM monotonically increases it.

**Why interviewers ask this**

GMM/EM is the cleanest interview vehicle for testing whether you understand **latent-variable models** and **iterative MLE** — ideas that reappear in HMMs, topic models, and variational inference. A junior answer says "it's like k-means but with probabilities." A senior answer explains *why* you need EM (the log-of-a-sum has no closed-form MLE because the cluster labels are hidden), can sketch the E and M updates, knows that EM only finds a **local** optimum so initialization (often k-means++) matters, and can state the failure modes (singular covariance, label switching, needing regularization). Being able to say "k-means is EM for a GMM with isotropic fixed covariance and hard assignment" in one sentence is a strong senior signal — it shows you see the family, not just the recipe.

**Common confusions**

- "GMM is just k-means" — no; GMM assigns probabilities and fits full covariances, so it models elliptical, overlapping, unequal-size clusters that k-means cannot.
- "EM finds the global optimum" — it does not; it monotonically increases the likelihood to a **local** max. Run several restarts.
- "More components always fit better" — raw likelihood always improves with more components (overfitting); that's exactly why you use BIC/AIC, which penalize parameter count.
- "Responsibilities are hard labels" — they are soft posteriors in [0,1]; you only argmax them at the end if you want a hard label.
- "The E-step changes the parameters" — no; the E-step only computes responsibilities. The M-step changes mu/Sigma/pi.

**What follows from this topic**

GMM sharpens the **k-means** topic (see it as the hard, spherical special case) and connects to **PCA** as another unsupervised latent-structure method (mixture-of-PPCA is the bridge). The BIC/AIC model-selection idea recurs whenever you pick a number of clusters or components. The EM pattern — alternate between inferring hidden variables and re-fitting parameters — generalizes far beyond clustering, and the covariance-shape discussion previews why choosing the right distance/geometry matters across clustering algorithms.

### Q1. What is a Gaussian Mixture Model and how does it differ from k-means?

A GMM models the data as coming from a **weighted sum of k Gaussian distributions**:

  p(x) = sum_k pi_k * N(x | mu_k, Sigma_k),  sum_k pi_k = 1.

Each Gaussian is a cluster with its own mean mu_k, covariance Sigma_k, and weight pi_k. Fitting recovers those parameters from unlabeled data.

The headline difference from k-means is **soft vs hard assignment**. k-means gives every point exactly one cluster label. A GMM gives every point a **probability distribution over clusters** (the responsibilities) — point x might be 0.7 cluster A, 0.3 cluster B. Two more differences follow from the covariance:

- GMM learns **cluster shape** (full Sigma_k) so clusters can be **elliptical, rotated, and different sizes**; k-means assumes spherical, equal-size clusters (it only tracks a centroid).
- GMM is **generative** — it defines a probability density you can sample from, evaluate likelihoods with, and use for anomaly detection; k-means only partitions space.

The cost: GMM has more parameters (a full covariance is O(d^2) per component), is slower, and is more prone to overfitting and singularities.

### Q2. Explain the EM algorithm used to fit a GMM. Why can't we just maximize the likelihood directly?

We want the parameters (pi, mu, Sigma) that maximize the data log-likelihood

  log L = sum_n log( sum_k pi_k * N(x_n | mu_k, Sigma_k) ).

The problem is the **log of a sum**: because each point's cluster label z_n is **hidden**, the sum over k sits inside the log and there's no closed-form solution — setting the derivative to zero gives coupled equations. If we *knew* the labels, MLE would be trivial (just fit a Gaussian per group).

EM sidesteps this by alternating:

- **E-step** — fix the parameters, and for each point compute the **responsibility** (posterior cluster probability) via Bayes' rule:

  r_nk = pi_k * N(x_n | mu_k, Sigma_k) / sum_j pi_j * N(x_n | mu_j, Sigma_j).

- **M-step** — fix the responsibilities and re-estimate the parameters by responsibility-weighted MLE. Let N_k = sum_n r_nk:

  pi_k    = N_k / N
  mu_k    = (1/N_k) sum_n r_nk * x_n
  Sigma_k = (1/N_k) sum_n r_nk * (x_n - mu_k)(x_n - mu_k)^T

Repeat until the log-likelihood stops improving. Intuitively, the E-step guesses "which cluster made each point" softly, and the M-step re-fits each Gaussian to the points it's responsible for.

### Q3. Why is EM guaranteed to converge, and what does it converge to?

EM is guaranteed to **not decrease** the data log-likelihood at every iteration, and since the likelihood is bounded above (for a regularized model), the sequence converges. The reason: EM implicitly maximizes a **lower bound** on the log-likelihood (built from Jensen's inequality). The E-step makes that bound **tight** at the current parameters (by setting the responsibilities to the true posterior), and the M-step **maximizes** the bound. Raising a bound that already touches the objective can only raise the objective — hence monotone improvement.

What it converges to is only a **local** maximum (or a saddle point), **not** the global optimum. Different initializations give different answers. Practical consequences:

- Use several **random restarts** and keep the run with the highest likelihood.
- Initialize with **k-means++** centroids (sklearn's default) rather than pure random — it converges faster and to better optima.
- It converges to a *point in parameter space*, but that point can be degenerate (a singular covariance) — see the singularity question.

### Q4. How exactly does GMM generalize k-means? Show k-means is a special case.

k-means is the **hard-assignment, spherical-covariance limit** of a GMM fit by EM. Take a GMM and impose three restrictions:

1. **Equal, spherical covariances** — Sigma_k = sigma^2 * I for all k (same isotropic variance).
2. **Equal weights** — pi_k = 1/k.
3. Let **sigma^2 -> 0**.

As sigma^2 shrinks, the responsibility

  r_nk = exp(-||x_n - mu_k||^2 / 2sigma^2) / sum_j exp(-||x_n - mu_j||^2 / 2sigma^2)

becomes a **winner-take-all**: the nearest centroid gets responsibility 1 and all others 0 — a **hard assignment**. The E-step becomes "assign each point to the nearest centroid" (the k-means assignment step), and the M-step's weighted mean becomes the plain mean of assigned points (the k-means update step).

So the mapping is exact:

| | k-means | GMM |
|---|---|---|
| Assignment | Hard (nearest centroid) | Soft (responsibilities) |
| Covariance | Fixed spherical | Learned (spherical/diag/full) |
| Weights | Equal | Learned pi_k |
| Cluster shape | Circular, equal size | Elliptical, any size |
| Objective | Minimize inertia (SSE) | Maximize likelihood |

The upshot: GMM can do everything k-means can, plus model elliptical/overlapping clusters and give probabilities — at higher cost and risk of singularities.

### Q5. What are responsibilities and how are they computed?

A **responsibility** r_nk is the **posterior probability that point n was generated by component k**, given the current parameters. It's the soft cluster assignment produced in the E-step, computed by Bayes' rule — prior (mixing weight) times likelihood (the component density), normalized over components:

  r_nk = pi_k * N(x_n | mu_k, Sigma_k) / sum_j [ pi_j * N(x_n | mu_j, Sigma_j) ].

Properties:

- Each row sums to 1: sum_k r_nk = 1 (it's a distribution over clusters for point n).
- N_k = sum_n r_nk is the **effective number of points** assigned to component k — the M-step uses it as the denominator.
- To get a hard label at the end, take argmax_k r_nk. The max responsibility also doubles as a **confidence** — points in cluster overlaps have flat responsibilities (all near 1/k), which is useful information k-means throws away.

### Q6. Write pseudocode for fitting a GMM with EM.

```python
import numpy as np

def fit_gmm(X, k, n_iter=100, tol=1e-4):
    n, d = X.shape
    # init: k-means++ centroids in practice; here random points
    mu = X[np.random.choice(n, k, replace=False)]
    Sigma = np.array([np.cov(X.T) for _ in range(k)])  # (k, d, d)
    pi = np.full(k, 1.0 / k)
    prev_ll = -np.inf

    for _ in range(n_iter):
        # E-step: responsibilities r[n, k]
        r = np.zeros((n, k))
        for j in range(k):
            r[:, j] = pi[j] * gaussian_pdf(X, mu[j], Sigma[j])
        ll = np.sum(np.log(r.sum(axis=1)))       # data log-likelihood
        r /= r.sum(axis=1, keepdims=True)         # normalize per point

        # M-step: update pi, mu, Sigma
        Nk = r.sum(axis=0)                         # effective counts
        pi = Nk / n
        mu = (r.T @ X) / Nk[:, None]
        for j in range(k):
            diff = X - mu[j]
            Sigma[j] = (r[:, j, None] * diff).T @ diff / Nk[j]
            Sigma[j] += 1e-6 * np.eye(d)           # regularize vs singular

        if abs(ll - prev_ll) < tol:               # converged
            break
        prev_ll = ll
    return pi, mu, Sigma, r
```

The `1e-6 * I` added to each covariance is the standard guard against singularities. In practice use `sklearn.mixture.GaussianMixture(n_components=k, covariance_type='full')`.

### Q7. What is the singularity problem in GMMs and how do you prevent it?

A **singularity** happens when one component collapses onto a **single data point** (or a set of near-identical points). Its mean sits exactly on that point, so the covariance shrinks toward zero, the Gaussian's peak density -> infinity, and therefore the **likelihood -> infinity**. EM, which is climbing the likelihood, is happy to march straight into this degenerate solution — it's a genuine (unbounded) maximum, just a useless one that fits noise.

It shows up mostly with **full covariances**, **small data**, or **too many components**.

Fixes:

- **Covariance regularization** — add a small ridge to each covariance, Sigma_k + epsilon * I (sklearn's `reg_covar`). This is the standard fix and caps the peak density.
- **Restart** when a component collapses — detect a tiny determinant and re-initialize that component.
- Use a **simpler covariance type** (diagonal, tied, or spherical) to reduce free parameters.
- Use **fewer components**, or a **Bayesian GMM** (`BayesianGaussianMixture`) with a prior that pushes unneeded components' weights to zero and resists collapse.

### Q8. How do you choose the number of components k in a GMM?

Unlike k-means' elbow-on-inertia, GMM gives you a proper **likelihood**, so you use **penalized-likelihood** criteria that trade fit against complexity. Fit the model for a range of k and pick the k that minimizes:

- **BIC** = -2 * log L + p * log(n)
- **AIC** = -2 * log L + 2 * p

where p is the number of free parameters (means + covariances + weights, which grows fast for full covariances) and n is the sample size. Both reward higher likelihood and penalize more parameters; **lower is better**.

- **BIC** penalizes complexity more heavily (the log(n) factor), so it prefers **fewer** components and is the usual default for clustering — it's consistent (picks the true k as n grows if the model is correct).
- **AIC** penalizes less, tends to pick **more** components, and is better when you care about predictive density than recovering the "true" number of groups.

```python
from sklearn.mixture import GaussianMixture
bic = [GaussianMixture(k, covariance_type='full').fit(X).bic(X)
       for k in range(1, 11)]
best_k = 1 + int(np.argmin(bic))
```

You can also grid over **covariance_type** at the same time. If clusters are for a downstream task, validate against that task's metric instead.

### Q9. What do the different covariance_type options mean and how do they trade off?

`covariance_type` controls the **shape and count** of covariance parameters, trading flexibility against parameters-to-estimate (and thus overfitting/singularity risk):

| Type | Shape of each cluster | Params per component | When |
|---|---|---|---|
| **spherical** | Circle/ball, one variance | 1 | Few data, isotropic clusters (closest to k-means) |
| **diag** | Axis-aligned ellipse | d | Features roughly independent; high-d and cheap |
| **tied** | All clusters share one full Sigma | d(d+1)/2 total | Clusters same shape/orientation, differ only in location |
| **full** | Any ellipse, rotated | d(d+1)/2 each | Enough data; clusters differ in shape and correlation |

Full is the most expressive but has the most parameters (O(k*d^2)), needs the most data, and is the most singularity-prone. Spherical is the most constrained and stable. The right pick depends on your data-to-dimension ratio; you can let **BIC** choose the type as well as k.

### Q10. How does a GMM handle overlapping clusters better than k-means?

k-means draws **hard Voronoi boundaries**: every point in the overlap is forced to one side, and the centroid update then gets pulled by points that really belong to the other cluster. It also can't represent that a point is *ambiguous*.

A GMM handles overlap natively because it's **soft and probabilistic**:

- Points in the overlap get **split responsibilities** (e.g. 0.55 / 0.45), so each cluster's mean/covariance update is only *partially* influenced by ambiguous points — the fit isn't distorted the way a hard assignment distorts a centroid.
- The learned **covariances** let two clusters legitimately overlap in space while remaining distinct distributions; k-means, with spherical equal clusters, has to carve them apart.
- You get a **confidence** out of the model — flat responsibilities flag the ambiguous region, which is often exactly what you want to surface (e.g. borderline customers).

The tradeoff is that GMM is slower, needs more data to estimate covariances, and can still fail if clusters overlap so heavily that the components become unidentifiable.

### Q11. Can a GMM be used for density estimation and anomaly detection? How?

Yes — that's a direct benefit of GMM being a **generative** model, not just a partitioner. After fitting, p(x) = sum_k pi_k N(x | mu_k, Sigma_k) is a full **probability density** over the input space. You can:

- **Density estimation** — evaluate p(x) for any new point; the GMM approximates the data distribution as a smooth multimodal density (a flexible alternative to a single Gaussian or a kernel density estimate).
- **Anomaly detection** — points with **low likelihood** (or low log-likelihood, `score_samples` in sklearn) are unlikely under the learned model, hence outliers. Set a threshold on log p(x) (e.g. a low percentile of training scores) and flag anything below it.
- **Sampling / generation** — draw synthetic data by sampling a component from pi then a point from that Gaussian.

```python
gmm = GaussianMixture(n_components=5).fit(X_train)
scores = gmm.score_samples(X_test)      # log-likelihood per point
threshold = np.percentile(gmm.score_samples(X_train), 2)
anomalies = X_test[scores < threshold]
```

This is why GMM shows up in fraud/novelty detection where k-means (no density) can't help.

### Q12. What is the time complexity of fitting a GMM, and how does it scale?

Per EM iteration, the dominant cost is evaluating each of n points against each of k components in d dimensions. With **full** covariances you also invert/factorize each d-by-d covariance:

- **E-step**: O(n * k * d^2) — each Gaussian density needs a quadratic form with the (precomputed) inverse covariance; the inverse itself is O(k * d^3) per iteration.
- **M-step**: O(n * k * d^2) — the weighted outer products to form covariances dominate.

Total: **O(i * n * k * d^2)** for i iterations (plus O(i * k * d^3) for the inversions). Space is O(n*k) for responsibilities plus O(k*d^2) for covariances.

Scaling notes:

- **Diagonal/spherical** covariances drop the d^2 to d, making high-dimensional GMMs tractable.
- It's **linear in n**, so large-sample-wise it's fine, but the **d^2/d^3** factors hurt in high dimensions — reduce with PCA first, or use diagonal covariance.
- Convergence (number of iterations i) depends heavily on initialization; k-means++ init keeps i small.

### Q13. Why does GMM initialization matter, and how is it typically initialized?

Because EM only finds a **local** optimum, the starting point decides which optimum you land in — bad init can give poorly separated clusters, slow convergence, or an early singularity. The likelihood surface is non-convex and multimodal, so this isn't a minor detail.

Typical initialization strategy (sklearn's default, `init_params='kmeans'`):

1. Run **k-means** (itself seeded by k-means++) to get k centroids.
2. Use those centroids as the initial **means**.
3. Initialize each **covariance** from the empirical covariance of the points assigned to that centroid (or the global covariance).
4. Initialize **weights** from the cluster proportions.

Then run several **restarts** (`n_init`) and keep the fit with the highest log-likelihood. Alternatives include `k-means++` (means only) and random responsibilities. The guiding principle: give EM a reasonable, well-separated starting configuration so it doesn't waste iterations or collapse.

### Q14. How does a GMM differ from k-means in what it optimizes?

They optimize **different objectives**:

- **k-means** minimizes **inertia** — the within-cluster sum of squared Euclidean distances, sum_n ||x_n - mu_{c(n)}||^2, over hard assignments c(n). It's a distance/variance objective with no probabilistic meaning.
- **GMM** maximizes the **data log-likelihood** under the mixture density, sum_n log(sum_k pi_k N(x_n|mu_k,Sigma_k)). It's a statistical objective — "how probable is this data under the model."

Consequences of the difference:

- k-means implicitly assumes isotropic equal clusters and Euclidean geometry; GMM's likelihood explicitly accounts for **covariance shape and cluster weight**, so it can prefer an elliptical fit that k-means' distance objective would never choose.
- k-means' objective is a special case of the negative log-likelihood when covariances are fixed spherical and assignments hard — which is exactly why k-means is the hard limit of GMM (see the generalization question).
- GMM's likelihood is comparable across models (enables BIC/AIC); k-means' inertia always decreases with k and isn't comparable across covariance assumptions.

### Q15. What are the main limitations and failure modes of GMMs?

- **Local optima** — EM only finds a local likelihood max; results depend on init, so you need restarts. No global guarantee.
- **Singularities** — a component can collapse onto a point, sending a covariance to zero and the likelihood to infinity; requires covariance regularization.
- **Choosing k** — you must specify the number of components; BIC/AIC help but assume the data is genuinely Gaussian-mixture-shaped.
- **Gaussian assumption** — GMM assumes clusters are (mixtures of) Gaussians. Strongly non-Gaussian, heavy-tailed, or non-convex (e.g. two moons) shapes are modeled poorly — DBSCAN or spectral clustering can beat it there.
- **Curse of dimensionality** — full covariances need O(d^2) parameters each; in high dimensions you either lack the data to estimate them (overfitting/singularities) or must restrict to diagonal covariance.
- **Cost** — slower than k-means, especially with full covariances and many components.
- **Identifiability / label switching** — components are exchangeable, so the labeling of clusters isn't unique across runs (matters if you compare parameter vectors, not for the clustering itself).

### Q16. When would you choose a GMM over k-means or DBSCAN?

Choose **GMM** when:

- Clusters are **elliptical / correlated / different sizes** — GMM's full covariances capture shape that k-means can't.
- You need **soft assignments or probabilities** — cluster-membership confidence, or points that legitimately belong to several clusters (e.g. mixed customer segments).
- You want a **generative density** for sampling, likelihood evaluation, or **anomaly detection**.
- The data is plausibly a **mixture of Gaussians** and you have enough samples per dimension to estimate covariances.

Choose **k-means** instead when you want speed and simplicity, clusters are roughly spherical and equal-size, and a hard label is all you need — it's the pragmatic default and the fast initializer for GMM anyway.

Choose **DBSCAN** (or spectral/hierarchical) instead when clusters are **non-convex or arbitrary-shaped** (Gaussians won't fit), you don't know k, or you need explicit **noise/outlier** labels and clusters of varying density are less of a concern. The one-liner: k-means for fast spherical partitioning, GMM for probabilistic elliptical clusters and density, DBSCAN for arbitrary shapes and outliers.

## PCA

### Summary

**What this topic covers**

Principal Component Analysis — the workhorse **linear, unsupervised dimensionality reduction** method. This topic covers what PCA actually computes (orthogonal directions of **maximum variance**, which are the **eigenvectors of the covariance matrix**), the two equivalent views that make it click (maximize projected variance = minimize reconstruction error), why in practice you compute it via the **SVD of the centered data** rather than by eigendecomposing the covariance matrix, and the practical craft: **standardizing** features first, choosing the number of components from **cumulative explained variance**, **whitening**, and the uses — compression, **visualization**, denoising, and decorrelation. It also covers PCA's limits — it's linear, unsupervised (blind to labels), and produces components that are hard to interpret. The 16 questions run from "what is a principal component" up to "prove PCA maximizes variance and relate it to the SVD." It sits next to the GMM topic (both unsupervised latent-structure) and sets up the non-linear/supervised DR topic (t-SNE, UMAP, LDA, ICA).

**Mental model**

Picture a cloud of correlated 2-D points shaped like a tilted cigar. PCA finds a **new orthogonal coordinate system aligned with the cloud**: the first axis (PC1) points along the direction the data varies most (the long axis of the cigar), PC2 is perpendicular and captures the next-most variance, and so on. Formally, center the data, form the covariance Cov = (1/n) X^T X, and take its **eigenvectors** as the axes and **eigenvalues** as the variance along each. Rotate the data into this basis and the axes are now uncorrelated and ordered by importance. Dimensionality reduction is then just **dropping the last few axes** — the ones with tiny eigenvalues carry little variance, so throwing them away loses little information. The magic is that "direction of maximum variance" and "direction that reconstructs the data with least squared error" turn out to be the *same* direction — variance you keep is error you avoid.

**Key terms**

- **Principal component** — an orthonormal direction (eigenvector of the covariance) along which the data varies; PCs are ranked by variance captured.
- **Covariance matrix** — Cov = (1/n) X^T X on centered data (p-by-p); its eigenvectors/eigenvalues define the PCs.
- **Eigenvalue** — the **variance** of the data along its eigenvector; the explained variance of that component.
- **Explained variance ratio** — an eigenvalue divided by the sum of all eigenvalues; fraction of total variance a PC captures.
- **Loading** — the weight of an original feature in a principal component (entries of the eigenvector).
- **Score** — a data point's coordinate in the PC basis (the projection X * V).
- **SVD** — X = U S V^T; the numerically preferred route to PCA (columns of V are the PCs, singular values give the variances).
- **Centering** — subtracting the feature means; mandatory, or PC1 just points at the data's offset from the origin.
- **Standardizing** — scaling each feature to unit variance; needed when features are on different scales.
- **Whitening** — rescaling each PC to unit variance so the transformed features are decorrelated *and* equal-variance.
- **Reconstruction error** — squared error when projecting to k PCs and back; PCA minimizes it for every k.
- **Scree / cumulative-variance plot** — eigenvalues (or their cumulative sum) vs component index; used to pick k.

**Why interviewers ask this**

PCA is the standard probe for **linear algebra fluency in an ML context**. A junior answer is "it reduces dimensions." A senior answer states precisely what PCA computes (eigenvectors of the covariance, ranked by variance), gives **both** equivalent derivations (max variance via a Lagrange multiplier that lands on the eigenvalue equation; min reconstruction error), explains **why SVD is preferred** over forming X^T X (squaring the condition number, numerical stability, no need to materialize the covariance), and knows the practical traps: you must **center**, you should **standardize** when scales differ, and you must fit PCA **inside** cross-validation to avoid leakage. It also tests judgment — knowing PCA is unsupervised (so the top PCs aren't guaranteed to be the discriminative ones), linear (so it can't unfold non-linear manifolds), and interpretability-destroying.

**Common confusions**

- "PCA does feature selection" — no; it builds new features that are **linear combinations** of all originals. It's feature *extraction*, not selection.
- "PCA needs no preprocessing" — it requires **centering**, and it needs **standardizing** whenever features are on different scales, or high-variance-because-of-units features dominate.
- "PCA is supervised / improves classification directly" — it's **unsupervised**; it ignores labels, so the max-variance directions may not be the class-separating ones (that's LDA's job).
- "More components is more information but always better to reduce" — you keep components to hit a **cumulative explained-variance** target; too few loses signal, too many defeats the purpose.
- "The covariance eigen-route and the SVD give different answers" — they give the **same** PCs; SVD is just the stabler way to compute them.
- "PCA removes noise" — only insofar as noise lives in low-variance directions; if noise has high variance, PCA keeps it.

**What follows from this topic**

PCA is the baseline every other dimensionality-reduction method is compared against in the **non-linear & supervised DR** topic — t-SNE/UMAP for non-linear visualization, LDA for the **supervised** counterpart, ICA for independence rather than decorrelation. The SVD connection ties PCA to matrix factorization broadly (recommenders, latent semantic analysis). The standardize-inside-CV point reinforces the leakage discipline from the ML Fundamentals primer, and whitening/decorrelation connects to why some models (and GMMs with diagonal covariance) behave better on PCA-rotated inputs.

### Q1. What is a principal component, and what does PCA actually compute?

A **principal component** is an orthonormal direction in feature space along which the data has **maximum variance**, subject to being orthogonal to all earlier components. PCA computes an ordered set of these directions.

Concretely, PCA:

1. **Centers** the data (subtract each feature's mean).
2. Forms the **covariance matrix** Cov = (1/n) X^T X (p-by-p for p features).
3. Takes its **eigenvectors** (the principal components) and **eigenvalues** (the variance along each).
4. **Ranks** components by eigenvalue — PC1 has the largest variance, PC2 the next, etc.

The eigenvectors form a new orthogonal basis; projecting the data onto the top k of them gives a k-dimensional representation that keeps as much variance as any linear k-D projection can. So PCA computes "the rotation of the coordinate axes that decorrelates the features and orders them by variance," and dimensionality reduction is keeping the top few axes.

### Q2. Prove that the first principal component is the direction of maximum variance.

Let the data be centered, and let w be a unit vector (||w|| = 1). The variance of the data projected onto w is

  Var(Xw) = (1/n) * (Xw)^T (Xw) = w^T [ (1/n) X^T X ] w = w^T C w,

where C = (1/n) X^T X is the covariance matrix. We want the unit w maximizing w^T C w. Set up the Lagrangian with the constraint w^T w = 1:

  L(w, lambda) = w^T C w - lambda (w^T w - 1).

Differentiate and set to zero:

  dL/dw = 2 C w - 2 lambda w = 0   =>   C w = lambda w.

So the optimum w is an **eigenvector** of C, and lambda is its **eigenvalue**. Substituting back, the variance achieved is w^T C w = w^T (lambda w) = lambda. To **maximize** the variance we therefore pick the eigenvector with the **largest eigenvalue** — that's PC1, and its variance equals the top eigenvalue. The second PC maximizes variance subject to being orthogonal to the first, which gives the second-largest eigenvector, and so on by induction. This is the whole of PCA: eigen-decompose the covariance and rank by eigenvalue.

### Q3. What are the two equivalent views of PCA (max variance vs min reconstruction error)?

PCA can be derived two ways that provably give the **same** components:

**Maximum variance** — find the orthonormal directions that maximize the variance of the projected data (the derivation above; the answer is the top eigenvectors of the covariance).

**Minimum reconstruction error** — find the k-dimensional subspace such that projecting each point onto it and back minimizes the total **squared reconstruction error**, sum_n ||x_n - x_hat_n||^2, where x_hat_n is x_n projected onto the subspace. The best such subspace is spanned by the **same** top-k eigenvectors.

They're equivalent because of a variance-decomposition identity: for centered data, **total variance = retained (projected) variance + reconstruction error**. That sum is constant, so maximizing the retained variance is exactly the same as minimizing the reconstruction error. This duality is why PCA is simultaneously "the best-preserving projection" and "the best low-rank approximation" of the data — it's the intuition behind using PCA for both compression and denoising.

### Q4. How is PCA computed via SVD, and why is SVD preferred over eigendecomposing the covariance?

Center the data matrix X (n-by-p) and take its **singular value decomposition**:

  X = U S V^T,

where U (n-by-n) and V (p-by-p) are orthogonal and S is diagonal with singular values s_1 >= s_2 >= ... The connection to PCA:

- The **columns of V are the principal components** (eigenvectors of X^T X).
- The **eigenvalues** of the covariance are lambda_i = s_i^2 / n, so each **explained variance = s_i^2 / n**.
- The **scores** (projected data) are X V = U S.

Why SVD is numerically preferred over forming Cov = X^T X and eigendecomposing it:

- Forming X^T X **squares the condition number**, amplifying rounding errors — nearly collinear features become numerically catastrophic. SVD works on X directly, avoiding this.
- You **never materialize** the p-by-p covariance, which matters when p is large.
- SVD is **more stable** and comes with well-tested truncated variants (`TruncatedSVD`, randomized SVD) that compute only the top-k components efficiently for large or sparse data.

sklearn's `PCA` uses SVD internally for exactly these reasons.

### Q5. Why must you center (and often standardize) the data before PCA?

**Centering (mandatory).** PCA measures variance *around the mean*. If you don't subtract the feature means, the covariance is computed around the origin, and PC1 will point toward the data's **overall offset from the origin** rather than its direction of spread — you'd be modeling the mean, not the variance. Every PCA implementation centers first.

**Standardizing (situational but usually needed).** PCA is **scale-sensitive** because variance depends on units. A feature measured in millimeters has ~10^6 times the variance of the same feature in kilometers, so it would dominate PC1 purely because of its unit. When features are on **different scales** (income in dollars vs age in years), standardize each to unit variance (z-score) first, so PCA reflects **correlation structure**, not arbitrary units. This is equivalent to running PCA on the **correlation matrix** instead of the covariance matrix.

You'd skip standardizing only when all features share the same meaningful unit and their variances are genuinely comparable (e.g. pixel intensities). And crucially, fit the scaler and PCA **inside cross-validation** (on the training fold only) to avoid leakage.

### Q6. How do you choose the number of principal components to keep?

The standard approach is the **cumulative explained-variance** rule: sort components by eigenvalue, compute the cumulative fraction of total variance they explain, and keep enough components to reach a target (commonly **90–95%**).

```python
from sklearn.decomposition import PCA
pca = PCA().fit(X)
cum = np.cumsum(pca.explained_variance_ratio_)
k = np.argmax(cum >= 0.95) + 1        # components for 95% variance
```

Alternatives / complements:

- **Scree plot / elbow** — plot eigenvalues vs index and cut where the curve flattens ("elbow").
- **Kaiser criterion** — keep components with eigenvalue > 1 (only meaningful on standardized data, where average eigenvalue is 1).
- **Downstream CV** — if PCA feeds a model, treat k as a hyperparameter and pick the k that maximizes the downstream cross-validated metric. sklearn's `PCA(n_components=0.95)` even lets you pass the variance target directly.
- For **visualization**, you just take k = 2 or 3 regardless.

The choice trades compression (fewer components) against information retained (more components).

### Q7. What is the time and space complexity of PCA?

Let n = samples, p = features, k = components kept.

**Full PCA (all components):**

- Forming the covariance X^T X is O(n * p^2); eigendecomposing/SVD is O(p^3). So roughly **O(n*p^2 + p^3)**.
- Space is O(p^2) for the covariance (or O(np) if you keep X).

**Truncated / randomized SVD (only top k):**

- **O(n * p * k)** — far cheaper when you only need a few components, which is the usual case. This is what `TruncatedSVD` and `PCA(svd_solver='randomized')` do.

The takeaways: PCA is **cubic in the number of features** (p^3) for the full decomposition — so very high-dimensional data (p >> n) is expensive the naive way, and you'd use randomized/truncated SVD or work in the dual (eigendecompose the n-by-n Gram matrix, O(n^3), when n < p). Prediction/transform is cheap: projecting a new point is O(p * k) (a matrix multiply against the loadings).

### Q8. What is whitening, and when do you want it?

**Whitening** (sphering) is an optional post-step that not only rotates the data into the PC basis but also **rescales each component to unit variance**. Where plain PCA gives scores X V, whitening divides each component by its singular value (or sqrt of its eigenvalue):

  x_white = (X V) / s   (component-wise),

so the transformed features are **decorrelated AND all have variance 1** — the covariance becomes the identity.

When you want it:

- Some downstream algorithms assume **isotropic, equal-variance** inputs — e.g. **ICA** typically whitens first, and distance-based methods can benefit.
- It removes the dominance of high-variance components so every retained direction contributes equally.

When you don't: whitening **amplifies low-variance directions**, which are often **noise** — so it can hurt signal-to-noise. It also throws away the relative-importance information encoded in the eigenvalues. Use it only when a downstream method needs equal-variance, decorrelated inputs; otherwise leave PCA unwhitened. In sklearn it's `PCA(whiten=True)`.

### Q9. What are the main uses of PCA?

- **Compression / dimensionality reduction** — represent p features with k << p components while keeping most variance; shrinks storage and speeds up downstream models (and mitigates the curse of dimensionality).
- **Visualization** — project to 2 or 3 PCs to eyeball structure in high-dimensional data (though for non-linear structure, t-SNE/UMAP are better).
- **Denoising** — reconstruct data from only the top components; noise that lives in low-variance directions is discarded (the min-reconstruction-error view). Used in image denoising and as "PCA denoising."
- **Decorrelation** — the PC basis has uncorrelated features by construction; helpful for models that struggle with multicollinearity (e.g. linear regression on collinear predictors — principal components regression).
- **Speeding up / regularizing learning** — fewer, decorrelated inputs can reduce overfitting and training time.

The common thread: PCA finds a compact linear coordinate system that preserves the dominant variance, which happens to serve compression, viewing, cleaning, and decorrelating all at once.

### Q10. What are the limitations of PCA?

- **Linear only** — PCA can only find linear subspaces; it cannot unfold non-linear manifolds (a Swiss roll, two concentric circles). Use kernel PCA, t-SNE, or UMAP for those.
- **Unsupervised** — it ignores labels, so the max-variance directions are **not guaranteed to be the discriminative ones**. A feature that perfectly separates classes but has low variance can be discarded. LDA is the supervised alternative.
- **Loses interpretability** — components are **linear combinations of all features**, so "PC1 = 0.3*age - 0.5*income + ..." rarely maps to a meaningful concept. You trade interpretable features for compact ones.
- **Scale-sensitive** — results depend on standardization; forget to standardize and unit choices dominate.
- **Assumes variance = importance** — high-variance noise is kept, low-variance signal is dropped. If your signal is subtle, PCA can throw it away.
- **Assumes roughly Gaussian / second-order structure** — PCA only uses means and covariances; it can't capture higher-order or non-Gaussian structure (ICA can).
- **Global, linear projection** — one basis for the whole dataset; no local adaptation.

### Q11. How does PCA relate to the SVD, precisely?

PCA **is** the SVD of the centered data matrix — they compute the same thing. For centered X = U S V^T:

- The **principal components** (eigenvectors of the covariance C = (1/n) X^T X) are the **right singular vectors** — the columns of **V**.
- The **eigenvalues** of C (the variances along each PC) are **lambda_i = s_i^2 / n**, the squared singular values scaled by n.
- The **scores** (data in PC coordinates) are **X V = U S** — projecting onto the components.
- Keeping the top k components is exactly the **truncated SVD**, X_k = U_k S_k V_k^T, which is the best rank-k approximation of X (Eckart–Young theorem) — the min-reconstruction-error view.

The reason to go through SVD rather than eigendecomposing X^T X is purely numerical (SVD avoids squaring the condition number and never forms the covariance). Conceptually: PCA = "SVD of centered data, keep the top singular directions." This also connects PCA to the broader family of matrix-factorization methods (LSA/latent semantic analysis is truncated SVD on a term-document matrix; the same math powers many recommender approaches).

### Q12. Should you apply PCA before or after the train/test split, and why?

**Fit PCA on the training set only**, then apply the *fitted* transform to the test set — never fit on the full dataset. Fitting PCA involves computing means, scales, and the covariance/SVD from the data; if you fit on all rows before splitting, information from the test rows **leaks** into the components, giving optimistically biased evaluation.

The correct pattern is a **pipeline** so the scaler and PCA are re-fit on each training fold inside cross-validation:

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression

pipe = make_pipeline(StandardScaler(), PCA(n_components=0.95),
                     LogisticRegression())
# cross_val_score refits scaler+PCA on each fold's train split only
```

This ensures the standardization statistics and the principal axes are learned only from training data in every fold. The same discipline applies to any unsupervised preprocessing (scaling, imputation, target encoding) — fit on train, transform test. This ties back to the leakage rules in the ML Fundamentals primer.

### Q13. What is the difference between the loadings and the scores in PCA?

- **Loadings** are the entries of the **eigenvectors** (the columns of V) — they tell you **how much each original feature contributes** to each principal component. A loading of 0.6 for "income" on PC1 means income weighs 0.6 in that component's linear combination. Loadings describe the *directions*.
- **Scores** are the **coordinates of the data points in the PC basis** — the projected data, X V. They tell you **where each sample sits** along each component. Scores are what you feed to a downstream model or plot for visualization.

Put differently: loadings map features -> components (the recipe), scores map samples -> components (the result). When you make a PCA scatterplot, the axes are components and the dots are **scores**; if you want to interpret what an axis means, you inspect the **loadings**. Eigenvalues, separately, tell you how much variance each component (each score column) carries.

### Q14. Can PCA be used for denoising? How does that work?

Yes. The mechanism is the **min-reconstruction-error** view: PCA splits the data's variance into high-variance directions (top components) and low-variance directions (bottom components). If the **signal is structured** (correlated, high-variance) and the **noise is small and unstructured** (spread thinly across many low-variance directions), then:

1. Project the data onto the top-k components (dropping the low-variance tail).
2. Reconstruct back into the original space: x_hat = mean + scores_k * V_k^T.

The reconstruction discards the low-variance directions where most of the noise lived, so x_hat is a **cleaned** version of x. This is used for image denoising and signal cleanup.

The critical caveat: it only works if **noise has lower variance than signal**. If the noise is high-variance (large, structured), PCA keeps it and drops your subtle signal instead. So PCA denoising assumes the classic "signal in the top components, noise in the tail" structure — verify that assumption before trusting it.

### Q15. When would you NOT use PCA?

- **When you need interpretable features** — PCs are opaque linear combinations; if stakeholders need "which original features matter," PCA destroys that. Use feature selection or a sparse method instead.
- **When the structure is non-linear** — PCA can't unfold curved manifolds; a Swiss roll or concentric circles need kernel PCA, t-SNE, or UMAP.
- **When the task is supervised and you want class separation** — PCA is blind to labels, so top PCs may not separate classes. Use **LDA** (supervised) or just let a good classifier do its own feature weighting.
- **When features are already few / low-dimensional** — there's nothing to compress, and you'd only lose interpretability.
- **When the informative signal is low-variance** — PCA would discard it; variance and importance aren't the same.
- **With tree-based models on tabular data** — gradient-boosted trees handle raw, correlated, mixed-scale features well and even benefit from the original interpretable splits; PCA rarely helps and can hurt (it destroys axis-aligned structure trees exploit and mixes features into non-monotone combinations).

### Q16. How does PCA handle correlated features, and why is that useful?

Correlated features are exactly what PCA is built to exploit. Correlation means the data lives near a **lower-dimensional subspace** — if two features are highly correlated, their scatter is essentially one direction plus noise. PCA detects this because correlation shows up as **large off-diagonal covariance entries**, and eigendecomposition **rotates the axes to diagonalize the covariance**: the new components are **uncorrelated by construction**, and the redundant correlated variation collapses into a few high-variance components while the near-constant residual directions get tiny eigenvalues you can drop.

Why that's useful:

- **Multicollinearity fix** — linear/logistic regression coefficients become unstable when predictors are collinear; running the regression on the decorrelated principal components (principal components regression) stabilizes it.
- **Compression** — correlated features are redundant, so PCA represents them with fewer components at little information loss.
- **Decorrelated inputs** — some models train faster or better on uncorrelated features.

The flip side: because PCA merges correlated features into combined components, you lose the ability to talk about the original features individually — the interpretability cost again.

## Non-Linear & Supervised Dimensionality Reduction

### Summary

**What this topic covers**

The dimensionality-reduction methods you reach for when **PCA isn't the right tool** — because the structure is non-linear, or because you have labels and want to use them. Four methods and where each beats PCA: **t-SNE** (non-linear, preserves **local** neighborhoods, the gold standard for 2-D visualization, but **non-deterministic** and easy to misread); **UMAP** (faster than t-SNE, preserves more **global** structure, usable as general-purpose reduction not just plotting); **LDA / Linear Discriminant Analysis** (the **supervised** counterpart to PCA — maximizes between-class over within-class scatter, is simultaneously a classifier and a reducer, and is capped at C-1 dimensions for C classes); and **ICA / Independent Component Analysis** (finds statistically **independent** rather than merely uncorrelated components — the tool for blind **source separation**). The 15 questions run from "what does t-SNE do and how do I read its plot" to "how does LDA differ from PCA" and "how does ICA differ from PCA." It builds directly on the PCA topic (the linear, unsupervised baseline) and pairs with the clustering topics for the "how do I see my clusters" workflow.

**Mental model**

Sort the methods on two axes: **linear vs non-linear**, and **unsupervised vs supervised**. PCA is linear + unsupervised. **LDA** is the linear + **supervised** cousin — same "find good axes" idea, but the axes maximize *class separation* instead of raw variance. **ICA** is linear + unsupervised but changes the *goal*: instead of uncorrelated, maximum-variance directions, it finds **statistically independent** sources (the cocktail-party problem — unmix overlapping voices). **t-SNE** and **UMAP** are **non-linear** + unsupervised: they don't find axes at all; they build a low-D map that tries to keep points that were **neighbors in high-D** as neighbors in 2-D, so they reveal curved manifolds and cluster structure PCA flattens. The key mental caution: t-SNE/UMAP embeddings are for **seeing** structure, not for measuring it — the coordinates are not features and the between-cluster distances/sizes are not meaningful.

**Key terms**

- **t-SNE** — t-distributed Stochastic Neighbor Embedding; non-linear, neighbor-preserving embedding for 2-D/3-D visualization.
- **Perplexity** — t-SNE's main knob; a soft estimate of how many neighbors each point has (typical 5–50); sets the local/global balance.
- **UMAP** — Uniform Manifold Approximation and Projection; graph-based non-linear reduction, faster than t-SNE, keeps more global structure.
- **Local structure** — which points are near which; what t-SNE/UMAP preserve well.
- **Global structure** — relative positions/distances of far-apart clusters; poorly preserved by t-SNE, better by UMAP.
- **LDA** — Linear Discriminant Analysis; supervised linear reduction maximizing between-class / within-class scatter.
- **Between-class scatter (S_B)** — spread of class means around the overall mean; LDA maximizes projection onto it.
- **Within-class scatter (S_W)** — spread of points around their own class mean; LDA minimizes projection onto it.
- **C-1 bound** — LDA yields at most (number of classes - 1) discriminant directions.
- **ICA** — Independent Component Analysis; finds statistically independent (not just uncorrelated) sources; used for blind source separation.
- **Statistical independence** — a stronger condition than zero correlation; requires non-Gaussian sources to be identifiable.
- **Non-determinism** — t-SNE/UMAP give different embeddings across runs/seeds; PCA/LDA are deterministic.

**Why interviewers ask this**

This topic separates candidates who **understand the tool's assumptions** from those who cargo-cult a `TSNE()` call. The single most common real-world mistake it probes: **reading a t-SNE plot literally** — clustering on its coordinates, or inferring that a big gap or a large blob means something. A senior candidate knows t-SNE preserves *local* neighborhoods only, that distances and cluster sizes are not interpretable, that it's non-deterministic and perplexity-dependent, and that you should never feed its output to a downstream model. The topic also tests whether you know the **supervised** option exists — reaching for **LDA** when you have labels and want separation, and understanding it's both a reducer and a Bayes-optimal-under-Gaussian classifier. And **ICA vs PCA** tests the subtle but important distinction between **uncorrelated** and **independent**.

**Common confusions**

- "t-SNE clusters the data" — it does **not**; it's a visualization. Cluster with k-means/DBSCAN in the original (or PCA) space, then color the t-SNE plot.
- "Distances/gaps in a t-SNE plot are meaningful" — they are **not**; only local neighborhoods are trustworthy. Cluster sizes are meaningless too (t-SNE equalizes density).
- "LDA is the same as PCA" — no; LDA is **supervised** and maximizes class separation, PCA is unsupervised and maximizes variance. (Confusingly, "LDA" also names Latent Dirichlet Allocation — a different topic-modeling method.)
- "ICA and PCA do the same thing" — PCA gives **uncorrelated** components ranked by variance; ICA gives statistically **independent** components with no natural ordering, and needs non-Gaussian data.
- "UMAP and t-SNE preserve global distances" — UMAP does better than t-SNE but neither is a faithful metric embedding; don't over-trust global geometry.
- "You can transform new points with t-SNE" — classic t-SNE has no out-of-sample transform; UMAP does.

**What follows from this topic**

This closes the dimensionality-reduction arc that started with **PCA** (the linear, unsupervised baseline you compare everything against). The visualization methods (t-SNE, UMAP) pair naturally with the **clustering** topics — the standard workflow is *cluster in feature space, then plot the labels on a t-SNE/UMAP map*. LDA connects back to the linear-classification family (it's a generative Gaussian classifier as well as a reducer) and to the supervised-vs-unsupervised framing that runs through the whole primer. Knowing when to pick each of these versus PCA is part of the broader **algorithm-selection** judgment the primer builds toward.

### Q1. What does t-SNE do, and how is it different from PCA?

t-SNE (t-distributed Stochastic Neighbor Embedding) is a **non-linear** dimensionality-reduction method built for **visualization** — it maps high-dimensional data to 2-D or 3-D so that points which were **close neighbors in high-D stay close in the map**. It works by (1) converting high-D distances into probabilities that point i would pick point j as a neighbor (a Gaussian around each point), (2) defining similar neighbor-probabilities in the low-D map using a heavy-tailed **Student-t** distribution, and (3) moving the low-D points to **minimize the KL divergence** between the two neighbor distributions via gradient descent.

Differences from PCA:

| | PCA | t-SNE |
|---|---|---|
| Type | Linear | Non-linear |
| Preserves | Global variance directions | **Local** neighborhoods |
| Output use | Features + viz | **Viz only** |
| Deterministic | Yes | **No** (random init/seed) |
| New points | Yes (linear transform) | No out-of-sample map |
| Speed | Fast | Slow (O(n^2), Barnes-Hut O(n log n)) |

The reason to use t-SNE over PCA: PCA is a linear projection, so it **flattens** curved manifolds and can pile distinct clusters on top of each other; t-SNE can **unfold** non-linear structure and produces much cleaner cluster separation in the picture. The price is that its coordinates and distances are not literally interpretable.

### Q2. What is perplexity in t-SNE and how does it affect the result?

**Perplexity** is t-SNE's main hyperparameter — a smooth measure of the **effective number of neighbors** each point considers when building its high-D neighbor distribution (it sets the bandwidth of the Gaussian around each point). Roughly, "how many near neighbors define each point's local neighborhood." Typical values are **5 to 50**.

Its effect:

- **Low perplexity** (e.g. 5) focuses on very **local** structure — you get many small, tight clumps, and the global arrangement gets unreliable (can shatter real clusters into fragments).
- **High perplexity** (e.g. 50) considers a **broader** neighborhood — clusters merge and fine local detail is smoothed away.

Because the "right" perplexity depends on dataset size and density, the standard advice is to **try several** and look for structure that's stable across them — features that appear at only one perplexity are suspect. Perplexity should also be smaller than the number of points. It's the knob that trades local detail against a more global view, and it's a big reason two t-SNE runs can look different.

### Q3. Why should you not cluster on t-SNE coordinates or read cluster sizes and distances literally?

Because t-SNE only faithfully preserves **local neighborhoods**, and it deliberately **distorts** everything else:

- **Distances between clusters are meaningless** — t-SNE's cost function cares about keeping neighbors together, not about how far apart separate groups sit. Two clusters far apart in the plot may be no more different than two that are close.
- **Cluster sizes are meaningless** — t-SNE **equalizes density**: it expands dense regions and contracts sparse ones, so a big blob doesn't mean a big or spread-out cluster.
- **It's non-deterministic and perplexity-dependent** — the same data gives different layouts across seeds and settings; apparent gaps can be artifacts.
- **It can manufacture apparent clusters** from noise at some settings.

So clustering (k-means/DBSCAN) directly on the 2-D t-SNE output would be clustering on distorted, unstable coordinates — you'd be measuring artifacts. The correct workflow: **cluster in the original (or PCA-reduced) space**, where distances are meaningful, then **use t-SNE only to visualize** by coloring points with their cluster labels. Treat the plot as a qualitative picture, never as data.

### Q4. How does UMAP compare to t-SNE?

Both are **non-linear, neighbor-preserving** embeddings for visualization, but UMAP (Uniform Manifold Approximation and Projection) differs on several practical axes:

| | t-SNE | UMAP |
|---|---|---|
| Speed | Slow | **Faster**, scales to larger n |
| Global structure | Poorly preserved | **Better** preserved (distances between clusters more meaningful) |
| Out-of-sample | No transform | **Yes** — can embed new points |
| Basis | Probabilistic (KL of neighbor distributions) | Graph / manifold + fuzzy topology |
| Main knobs | perplexity | n_neighbors, min_dist |
| Determinism | Non-deterministic | Non-deterministic (but more stable) |

Practically: **UMAP is faster, preserves more of the global layout, and can transform new data**, which makes it usable as a **general-purpose** reduction step (feeding a downstream model), not just a plotting tool — though feeding non-linear embeddings to models still needs care. t-SNE often still gives slightly crisper *local* cluster separation for pure visualization. UMAP's `n_neighbors` plays a role like perplexity (local vs global balance) and `min_dist` controls how tightly points pack. The usual caveats still apply — neither gives a faithful metric embedding, so don't over-read global geometry even with UMAP.

### Q5. What is LDA (Linear Discriminant Analysis) and how does it differ from PCA?

LDA is a **supervised** linear dimensionality-reduction method (and a classifier). Where PCA finds directions of maximum **variance** ignoring labels, LDA uses the labels to find directions that best **separate the classes** — it maximizes **between-class scatter** relative to **within-class scatter**:

  maximize  J(w) = (w^T S_B w) / (w^T S_W w),

where S_B measures how far the class means are from the overall mean, and S_W measures the spread of points around their own class mean. The best directions come from the eigenvectors of S_W^-1 S_B.

| | PCA | LDA |
|---|---|---|
| Uses labels | No (unsupervised) | **Yes** (supervised) |
| Objective | Max variance | Max class separation |
| Output dims | Up to p | At most **C-1** (C classes) |
| Also a classifier | No | **Yes** |

The intuition: PCA might keep a high-variance direction that doesn't distinguish classes at all, while LDA keeps low-variance directions if they separate the classes. Use **LDA when you have labels and want discriminative low-D features**; use PCA when you're unsupervised. (Note: "LDA" is overloaded — Linear Discriminant Analysis here, versus Latent Dirichlet Allocation in topic modeling.)

### Q6. Why is LDA limited to at most C-1 dimensions?

Because the **between-class scatter matrix S_B** has rank at most **C-1** for C classes, and LDA's discriminant directions come from the (nonzero) eigenvectors of S_W^-1 S_B.

The reason S_B has rank C-1: it's built from the C class means measured relative to the global mean. But the global mean is a weighted average of the class means, so the C mean-deviation vectors are **linearly dependent** — they satisfy one linear constraint (they sum, weighted, to zero). That leaves only **C-1** independent directions, so S_B can have at most C-1 nonzero eigenvalues, and everything beyond that has zero between-class separation to offer.

Practical consequences:

- **Binary classification (C=2)** -> LDA gives you exactly **1** dimension — a single discriminant axis onto which you project and threshold.
- A 10-class problem -> at most **9** LDA dimensions, regardless of how many original features you had.

This is a hard structural cap, unlike PCA which can return up to p (number of features) components. If you need more reduced dimensions than C-1, LDA can't provide them and you'd combine it with PCA or use a different method.

### Q7. How is LDA both a classifier and a dimensionality reducer?

LDA has a **generative** interpretation that makes it a classifier, and that same math yields the reduction axes.

**As a classifier**, LDA assumes each class is Gaussian with its own mean but a **shared covariance** matrix. Applying Bayes' rule under those assumptions gives **linear decision boundaries**, and you classify a point by which class's Gaussian (weighted by the prior) gives it the highest posterior. It's Bayes-optimal when the shared-covariance-Gaussian assumption holds. (Relax the shared-covariance assumption and you get **QDA**, with quadratic boundaries.)

**As a reducer**, the directions that maximize between-class over within-class scatter (eigenvectors of S_W^-1 S_B) are exactly the axes onto which you project to do that classification with least information loss — a C-1-dimensional subspace where the classes are maximally separated.

So it's one model with two uses: project onto the discriminant axes to **reduce/visualize**, or apply the full Gaussian rule to **classify**. In sklearn, `LinearDiscriminantAnalysis` exposes both — `.transform()` for the reduced features and `.predict()` for classification. This dual nature is why LDA is a favorite interview example of the supervised-reduction idea.

### Q8. What is ICA and how does it differ from PCA?

ICA (Independent Component Analysis) decomposes a multivariate signal into components that are **statistically independent**, not merely uncorrelated. The canonical use is **blind source separation** — the **cocktail-party problem**: several microphones each record a mix of several simultaneous speakers, and ICA recovers the individual voices without knowing the mixing.

The crucial distinction from PCA:

- **PCA** produces **uncorrelated** components (zero linear correlation), ranked by **variance**, and its directions are **orthogonal**.
- **ICA** produces **statistically independent** components — a **stronger** condition (independence implies uncorrelated, not vice versa). It has **no variance ordering** and the components need not be orthogonal.

| | PCA | ICA |
|---|---|---|
| Criterion | Uncorrelated (2nd-order) | **Independent** (all orders) |
| Uses | Compression, variance | **Source separation** |
| Ordering | By variance | None inherent |
| Assumption | — | Sources **non-Gaussian** |

ICA works by finding a linear unmixing that makes the components **maximally non-Gaussian** (by the Central Limit Theorem, mixtures of independent sources look more Gaussian than the sources themselves, so maximizing non-Gaussianity — e.g. via kurtosis or negentropy in FastICA — recovers the sources). It's typically run **after whitening** (often PCA whitening) as a preprocessing step.

### Q9. Why does ICA require the sources to be non-Gaussian?

Because if the sources were Gaussian, **independence would be unidentifiable** — you couldn't tell the true sources from any rotation of them.

Two reasons stack up:

1. For Gaussian variables, **uncorrelated already implies independent**. So once you've whitened the data (made the components uncorrelated and unit-variance), a Gaussian distribution is **rotationally symmetric** — any orthogonal rotation of the whitened components is *also* a set of independent, unit-variance Gaussians. There's no unique answer; ICA has nothing left to optimize.

2. ICA's engine is **maximizing non-Gaussianity**. By the Central Limit Theorem, a **mixture** of independent sources is *more Gaussian* than the individual sources. So ICA searches for the unmixing directions that make the recovered components **as non-Gaussian as possible** (measured by kurtosis or negentropy) — those maximally non-Gaussian directions are the original sources. If the sources are themselves Gaussian, "most non-Gaussian" gives no signal to follow.

Consequence: ICA can separate non-Gaussian sources (voices, EEG signals, natural images — all non-Gaussian) but **at most one** of the underlying sources may be Gaussian; more than one Gaussian source and they're inseparable. This is the fundamental reason ICA and PCA target different problems — PCA is happy with Gaussian data, ICA needs non-Gaussianity.

### Q10. When should you use each method versus PCA? Give a decision guide.

| Method | Linear? | Supervised? | Best for | Key caveat |
|---|---|---|---|---|
| **PCA** | Yes | No | Compression, decorrelation, general reduction, denoising | Linear only; ignores labels |
| **LDA** | Yes | **Yes** | Supervised reduction / class separation, also a classifier | At most C-1 dims; assumes Gaussian classes, shared covariance |
| **t-SNE** | No | No | 2-D/3-D **visualization** of clusters/manifolds | Viz only; distances/sizes not meaningful; slow; non-deterministic |
| **UMAP** | No | No (has supervised mode) | Faster visualization; some global structure; general-purpose reduction | Still don't over-read geometry; non-deterministic |
| **ICA** | Yes | No | **Source separation**, independent signals | Needs non-Gaussian sources; no variance ordering |

Quick heuristics:

- **Have labels, want discriminative features?** -> LDA.
- **Just want to compress / decorrelate / speed up a model?** -> PCA.
- **Want to *see* high-D structure in a picture?** -> t-SNE or UMAP (UMAP if you need speed, some global structure, or to transform new points).
- **Want to unmix independent signals (audio, EEG)?** -> ICA.
- **Non-linear manifold you want to keep as features?** -> UMAP (or kernel PCA), with care.

Default: reach for **PCA first** (fast, deterministic, well-understood); escalate to the others only when its linear/unsupervised assumptions block you.

### Q11. Why is t-SNE non-deterministic, and what problems does that cause?

t-SNE is non-deterministic because it **starts from a random initialization** and optimizes a non-convex KL-divergence objective by gradient descent. Different random seeds land in different local minima, so the **layout changes run to run** — clusters appear in different positions, orientations, and sometimes different apparent groupings. Stochastic elements in the optimization (and the perplexity setting) compound this.

Problems it causes:

- **Non-reproducibility** — a plot you show today may look different when regenerated; fix the `random_state` for reproducible figures.
- **Over-interpretation risk** — apparent gaps, sub-clusters, or arrangements may be **artifacts** of one particular seed rather than real structure. The defense is to run **multiple seeds and perplexities** and trust only structure that's **stable** across them.
- **No stable coordinate system** — because the axes and positions aren't fixed, you can't use the coordinates as features or compare embeddings across datasets.

This is a big part of why t-SNE is "visualization only." (PCA and LDA, by contrast, are deterministic — same input, same output — because they solve a closed-form eigenproblem.) UMAP is also non-deterministic but tends to be more stable across runs.

### Q12. Can t-SNE or UMAP transform new, unseen data points?

**Classic t-SNE cannot.** It computes an embedding by optimizing the positions of a **fixed set** of points against each other; there's no learned function mapping input space to the 2-D map, so there's no way to place a new point without re-running the whole optimization (which would also move all the existing points). This is a real limitation for any production pipeline — you can't fit on train and transform test.

**UMAP can.** UMAP learns an approximate mapping of the manifold, so it exposes a `.transform()` method that embeds new points into the existing space (fit once, transform later — the sklearn-style API). That out-of-sample capability is one of the main reasons UMAP is usable as a **general-purpose** reduction step feeding a downstream model, whereas t-SNE stays confined to one-off visualization.

If you specifically need t-SNE-like local structure *and* out-of-sample transform, use UMAP, or parametric t-SNE variants (which train a neural network to approximate the mapping). And regardless of which you use, remember the geometry caveats — being able to transform new points doesn't make the distances metrically meaningful.

### Q13. How does LDA's objective (between-class vs within-class scatter) actually work?

LDA looks for a projection direction w that makes the classes **far apart** (means well separated) while keeping each class **tight** (small internal spread). It captures both goals in a single ratio — the **Fisher criterion**:

  J(w) = (w^T S_B w) / (w^T S_W w),

where:

- **S_B (between-class scatter)** = sum over classes of n_c * (mu_c - mu)(mu_c - mu)^T — how far each class mean mu_c sits from the global mean mu. **Numerator: bigger = better separation.**
- **S_W (within-class scatter)** = sum over classes of the scatter of points around their own class mean — how spread out each class is. **Denominator: smaller = tighter classes.**

Maximizing this ratio (via a generalized eigenproblem) means projecting onto directions where class means separate the most **per unit of internal spread**. Setting the gradient to zero gives

  S_W^-1 S_B w = lambda w,

so the LDA directions are the top eigenvectors of **S_W^-1 S_B**, and there are at most C-1 of them (S_B's rank). Intuitively: it's like PCA, but the "variance" being maximized is *between-class* variance and it's *normalized by* within-class variance — so a direction only wins if it separates the class centroids without smearing the classes together.

### Q14. What is the standard workflow for visualizing high-dimensional clusters?

The correct pipeline separates **where you cluster** from **where you visualize**:

1. **Preprocess** — standardize features (and optionally reduce with PCA first, both to denoise and to speed up the embedding; e.g. PCA to ~30-50 dims before t-SNE).
2. **Cluster in a meaningful space** — run k-means / GMM / DBSCAN on the original (or PCA-reduced) features, where distances are real. This is where cluster *assignments* come from.
3. **Embed for viewing** — run **t-SNE or UMAP** down to 2-D purely for the picture.
4. **Plot and color** — scatter the 2-D embedding, coloring each point by its cluster label from step 2 (or by a known class label).
5. **Interpret cautiously** — check whether clusters land coherently in the map; but do **not** read distances/sizes literally, and validate across seeds/perplexities.

```python
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.manifold import TSNE

Xr = PCA(n_components=30).fit_transform(X_scaled)   # denoise/speed
labels = KMeans(n_clusters=k, n_init=10).fit_predict(Xr)  # cluster here
emb = TSNE(n_components=2, perplexity=30,
           random_state=0).fit_transform(Xr)         # embed for viz
# scatter emb, color = labels
```

The cardinal rule this workflow encodes: **cluster in feature space, visualize in embedding space** — never the reverse.

### Q15. What are the key limitations of non-linear embedding methods like t-SNE and UMAP?

- **Not metric-faithful** — they preserve local neighborhoods but distort **global distances and cluster sizes**, so you can't read the geometry literally (t-SNE especially; UMAP is better but still not exact).
- **Non-deterministic** — different seeds/settings give different layouts; structure must be confirmed across runs. Not reproducible without fixing the seed.
- **Hyperparameter-sensitive** — perplexity (t-SNE) or n_neighbors/min_dist (UMAP) materially change the picture; wrong settings can fragment real clusters or invent fake ones.
- **Visualization-first, not feature-first** — the coordinates are for the eye, not for downstream models; feeding them into a classifier is usually a mistake (t-SNE also has no out-of-sample transform).
- **Can manufacture structure** — at some settings they show clean "clusters" in random or uniform data, tempting over-interpretation.
- **Cost** — t-SNE is slow (O(n^2), Barnes-Hut O(n log n)); both need enough data and tuning; large datasets often need subsampling or a PCA pre-step.
- **No importance/ordering** — unlike PCA there's no ranked, interpretable set of directions or explained-variance to reason about.

The overarching limitation: they are **exploratory visualization tools**. Use them to *generate hypotheses about structure*, then confirm those hypotheses with clustering, metrics, and models operating in the original feature space.
## Algorithm Selection & Tradeoffs

### Summary

**What this topic covers**

This is the **decision layer** of the primer — how to pick a classical algorithm for a given problem and, just as important, how to *justify* that pick out loud in an interview. It assumes you already know each algorithm from the inside (the earlier per-algorithm topics own the mechanics) and now asks the meta-question: given a dataset with N rows, P features, a mix of numeric and categorical columns, some missing values, a latency budget, and an interpretability requirement, which family do you reach for and why? The 16 questions here build a **decision framework** across the axes that actually drive the choice — data size, dimensionality, linearity of the boundary, interpretability need, training and inference cost, native handling of categoricals / missing / scale, and whether you must extrapolate — then apply it to concrete scenarios. It also covers the strong defaults every practitioner leans on (tabular → gradient-boosted trees; linear/logistic as the interpretable baseline; SVM/kNN for small-to-medium; Naive Bayes for text), the bias-variance and interpretability-vs-accuracy profile of each family, and the "no free lunch" theorem that stops you from claiming any one algorithm is universally best.

**Mental model**

Algorithm selection is **constraint satisfaction, not a beauty contest**. You rarely pick the model with the best possible accuracy in the abstract; you pick the one that satisfies the binding constraint — a latency SLA, a regulator who needs an explanation, a dataset of 500 rows, a feature matrix with 50,000 sparse columns. The mental move is to *rank the constraints first, then eliminate families that violate the hard ones, then optimize accuracy inside what survives*. A useful default sequence for tabular data: start with a **logistic/linear baseline** (fast, interpretable, tells you if the problem is even learnable), then jump to **gradient-boosted trees** (the accuracy workhorse), and only reach for SVMs, kNN, or deep nets if something specific pushes you there. Overlay two spectrums on every candidate: the **bias-variance** dial (linear = high bias / low variance; deep trees and kNN with small k = low bias / high variance) and the **interpretability-vs-accuracy** dial (linear/tree = glass box; boosted-tree ensembles / kernel SVM = accurate black boxes). Where a problem sits on those two dials usually names the winner.

**Key terms**

- **No free lunch theorem** — averaged over all possible problems, no algorithm beats any other; superiority is always relative to a data distribution, so "best model" only means "best for this data."
- **Inductive bias** — the built-in assumptions a family makes (linear = additive linear boundary; trees = axis-aligned splits; kNN = nearby points share labels). Match the bias to the true structure.
- **Interpretability** — how readily a human can explain a prediction; linear coefficients and shallow trees are glass boxes, kernel SVMs and large ensembles are not.
- **Extrapolation** — predicting outside the training range; linear models extrapolate (a line continues), tree-based models **cannot** (they output a constant beyond the last split).
- **Parametric vs non-parametric** — parametric (linear, logistic, Naive Bayes) fix the parameter count up front; non-parametric (kNN, trees, RBF-SVM) grow capacity with data.
- **Eager vs lazy** — eager learners (most) do work at training time; lazy learners (kNN) defer all work to predict time.
- **Curse of dimensionality** — as P grows, distance-based methods (kNN, RBF-SVM, k-means) degrade because everything becomes roughly equidistant.
- **Training vs inference cost** — separate budgets; a kNN is free to train but slow to serve, an SVM is costly to train but cheap to serve.
- **Strong default** — the family you should reach for absent a reason not to: gradient-boosted trees for tabular, logistic as the baseline, Naive Bayes for high-dim sparse text.
- **Interpretability-vs-accuracy frontier** — the empirical tradeoff where the most accurate tabular models are usually the least directly interpretable.

**Why interviewers ask this**

This separates people who *collect* algorithms from people who *deploy* them. A junior candidate lists five models and their textbook accuracies; a senior candidate asks about the data size, the label balance, the latency budget, and whether the stakeholder needs an explanation — *then* names one model and defends it against the two nearest alternatives. Interviewers use "which algorithm would you use for X?" as an open-ended probe precisely because there is no single right answer: they are grading the *reasoning*, the awareness of constraints, and whether you know the strong defaults without over-claiming. Naming gradient-boosted trees as the tabular default and being able to say *why* (handles mixed types, missing values, non-linearity, monotone-ish interactions, minimal preprocessing) is a strong senior signal. So is invoking "no free lunch" to refuse a universal answer while still committing to a concrete recommendation.

**Common confusions**

- "Deep learning always wins" — on tabular data of typical size, gradient-boosted trees usually match or beat neural nets with far less tuning; deep learning dominates perception (images, audio, text), not spreadsheets.
- "More complex model = better" — complexity buys variance; on small or noisy data a linear/logistic baseline often generalizes better than a boosted ensemble.
- "Random forest can extrapolate" — it cannot; no tree-based model predicts outside the training target range, which disqualifies them for genuine trend extrapolation.
- "Accuracy is the only axis" — latency, interpretability, retraining cost, and robustness to distribution shift often outweigh a fractional accuracy gain.
- "Pick the model, then look at the data" — backwards; the data's size, shape, and constraints choose the family for you.

**What follows from this topic**

The choice you defend here is realized in **Hyperparameters & Practical Implementation** (once you've picked the family, which knobs matter and how to tune them without leaking), and rehearsed for interviews in **Classical Algorithms Interview & Whiteboard Playbooks** (the crisp "compare A vs B for this dataset" answer). The bias-variance framing leans on the sister **ML Fundamentals** primer — reference it, don't re-derive it here.

### Q1. Walk me through your decision framework for choosing a classical ML algorithm.

Rank the constraints, eliminate on the hard ones, then optimize accuracy inside what survives. I reason across seven axes:

- **Data size (N)** — tiny N (hundreds) favours high-bias models (linear, Naive Bayes, small-k kNN, linear SVM); large N lets low-bias models (boosted trees, RBF-SVM up to a point) shine. SVMs choke past ~100k rows because training is O(N^2)-O(N^3).
- **Dimensionality (P)** — high P with sparse features (text) favours linear/logistic and Naive Bayes; distance-based methods (kNN, RBF-SVM, k-means) suffer the curse of dimensionality.
- **Linearity of the boundary** — if a linear boundary suffices, logistic/linear-SVM is fast and interpretable; if not, trees/boosting/kernels/kNN capture non-linearity.
- **Interpretability need** — a regulator or clinician needs a glass box (linear coefficients, shallow tree); a ranking backend just needs accuracy (boosted ensemble is fine).
- **Training / inference cost** — kNN is free to train, slow to serve; SVM is slow to train, fast to serve; boosted trees are moderate both ways.
- **Native handling of categoricals / missing / scale** — tree ensembles eat mixed types and missing values with minimal prep; linear/SVM/kNN/k-means need scaling and encoding.
- **Extrapolation** — if you must predict outside the training range, only linear-family models extrapolate; trees output a flat constant.

I state the binding constraint first, name one model, then defend it against the two nearest alternatives.

### Q2. Give me the "which algorithm?" matrix — the strong defaults by scenario.

| Scenario | Default choice | Why |
|---|---|---|
| Tabular, accuracy-first | **Gradient-boosted trees** (XGBoost/LightGBM) | Handles mixed types, non-linearity, missing values; minimal prep; SOTA on tabular |
| Tabular, need explanation | **Logistic / linear regression** | Coefficients = odds ratios / effects; monotone, auditable |
| Small-medium, non-linear | **RBF SVM** or **random forest** | SVM strong in modest N/high P; RF robust with little tuning |
| High-dim sparse text | **Multinomial Naive Bayes** or **linear SVM / logistic** | Linear models dominate sparse high-dim; NB is a fast baseline |
| Few rows, need a baseline fast | **kNN** or **Naive Bayes** | Zero/near-zero training, instant sanity check |
| Unlabeled, want groups | **k-means** (spherical) / **DBSCAN** (arbitrary shape) / **GMM** (soft) | Match cluster geometry to the algorithm |
| Need to compress / visualize | **PCA** (linear) / **t-SNE, UMAP** (viz only) | Variance-preserving vs neighborhood-preserving |
| Must extrapolate a trend | **Linear / regularized linear** | Only family that continues beyond training range |

The matrix is a starting point, not a verdict — I confirm against the actual N, P, and constraints before committing.

### Q3. Why are gradient-boosted trees the default for tabular data?

Because they satisfy the most common tabular constraints out of the box with the least effort:

- **Non-linearity and interactions** — trees model arbitrary axis-aligned regions and, at depth d, up to d-way feature interactions, without you specifying them.
- **Mixed types and scale-invariance** — splits are threshold-based, so no scaling is needed and numeric/ordinal features coexist; only categoricals need encoding (CatBoost handles even those natively).
- **Missing values** — XGBoost/LightGBM learn a default split direction for missing entries, so no imputation is required.
- **Low bias with controlled variance** — boosting drives bias down by fitting the residual sequentially, while shrinkage (eta), shallow trees, and subsampling control variance.
- **Robust to irrelevant features and monotone transforms** — a monotone transform of a feature leaves the splits unchanged.

The tradeoff is interpretability (a 500-tree ensemble is a black box, mitigated by SHAP) and no extrapolation. But for "here's a spreadsheet, predict the target accurately," they win with minimal tuning — which is why they dominate Kaggle tabular competitions and most production tabular pipelines.

### Q4. When would you deliberately NOT use gradient-boosted trees?

Several situations flip the default:

- **You must extrapolate.** Trees predict a constant beyond the last split, so any genuine trend continuation (forecasting a rising series past its historical max) needs a linear-family model.
- **Hard interpretability requirement.** If a regulator, clinician, or credit adjudicator needs a per-feature, sign-and-magnitude explanation, a logistic regression with odds ratios beats a boosted ensemble plus a SHAP approximation.
- **Very small data.** With a few hundred noisy rows, a boosted ensemble overfits; a regularized linear model or Naive Bayes generalizes better.
- **Extreme dimensionality / sparsity (text).** On 50k sparse TF-IDF features, linear SVM / logistic / Naive Bayes are faster and usually more accurate than trees, which struggle to find good splits in sparse high-dim space.
- **Ultra-low-latency or tiny-footprint serving.** A single linear model is a dot product; a 1000-tree ensemble is heavier, though still fast.
- **Perceptual data (images, audio, raw text sequences).** That's deep learning's turf, not classical trees.

Naming these unprompted signals you treat the default as a default, not dogma.

### Q5. Explain the bias-variance profile of the main algorithm families.

- **Linear / logistic regression** — **high bias, low variance.** Strong assumption (linear/log-odds boundary), stable across resamples. Underfits non-linear structure; great when the assumption roughly holds or data is scarce.
- **Regularized linear (ridge/lasso)** — pushes bias up further to cut variance; the lambda knob slides you along the tradeoff.
- **Naive Bayes** — **high bias** (independence assumption) but very low variance; a strong, stable baseline especially for text.
- **kNN** — bias-variance is set by k: small k = **low bias, high variance** (jagged boundary), large k = high bias, low variance (smooth). It's non-parametric, so capacity grows with data.
- **Decision tree (deep)** — **low bias, high variance**; memorizes training data, unstable to small changes.
- **Random forest** — takes high-variance deep trees and **averages the variance away** via bagging + feature subsampling; net = low bias, reduced variance.
- **Gradient boosting** — sequentially **reduces bias** by fitting residuals; net low bias, and variance is controlled by shrinkage/depth/subsampling (can overfit without them).
- **SVM** — C and the kernel set the dial: large C / small-gamma-RBF = low bias/high variance; small C = higher bias.

The one-liner: bagging attacks variance, boosting attacks bias, regularization trades one for the other.

### Q6. Rank the main families on the interpretability-vs-accuracy spectrum.

From most interpretable (and typically lower ceiling on tabular accuracy) to least:

1. **Linear / logistic regression** — glass box; each coefficient is a signed effect / log-odds. Lowest capacity but fully auditable.
2. **Single decision tree (shallow)** — a readable flowchart; a human can trace any prediction. Higher capacity than linear, still interpretable.
3. **Naive Bayes** — interpretable via per-feature likelihood contributions, but the independence assumption caps accuracy.
4. **kNN** — "explained" by its nearest neighbours (case-based), but no global model to inspect.
5. **Random forest / gradient-boosted trees** — high accuracy on tabular, but a black box; interpret post-hoc with feature importance, partial dependence, or SHAP.
6. **Kernel SVM** — accurate non-linear boundaries, essentially opaque (support vectors in an implicit feature space).

The senior point: this is a **frontier, not a law** — you buy accuracy with opacity on tabular data, and the right position on the frontier is set by the stakeholder, not by you. When both are required, techniques like monotone constraints on GBMs or SHAP explanations let you push the frontier outward.

### Q7. How does data size (N) change which algorithm you pick?

- **Tiny N (hundreds).** Favour high-bias, low-variance models that can't overfit much: regularized linear/logistic, Naive Bayes, linear SVM, small-k kNN. Avoid deep boosted ensembles — they memorize noise.
- **Medium N (thousands to ~100k).** The sweet spot for **RBF-SVM** (still tractable) and **random forests / gradient boosting**, which now have enough data to fit low-bias models without overfitting.
- **Large N (hundreds of thousands to millions).** **SVMs fall out** (O(N^2)-O(N^3) training); reach for **LightGBM** (histogram + GOSS scales well), linear models with SGD, or mini-batch methods. kNN also degrades — O(N) per query at serving time.
- **Very large N.** Linear models with stochastic gradient descent, or distributed gradient boosting; consider deep learning if the data is perceptual.

Two costs scale differently: SVM training and naive kNN serving both blow up with N, while linear models and histogram-based boosting stay near-linear. Always separate the *training* budget from the *inference* budget — they can pick different winners.

### Q8. How does dimensionality (P) change the choice?

High P attacks distance- and density-based methods through the **curse of dimensionality**: as P grows, pairwise distances concentrate (nearest and farthest neighbours become nearly equidistant), so **kNN, RBF-SVM, and k-means** degrade or need dimensionality reduction first.

- **High P, sparse (text/TF-IDF, one-hot).** Linear models thrive — **logistic regression, linear SVM, multinomial Naive Bayes**. The boundary is effectively linear in a rich space, and these models are fast and memory-light on sparse matrices.
- **High P, dense.** Consider **PCA** to reduce before a distance-based model, or use a model that does implicit feature selection (**lasso**, tree ensembles).
- **P >> N (wide data, e.g. genomics).** Regularization is mandatory — **ridge/lasso/elastic net** or linear SVM; tree ensembles can work but risk spurious splits.
- **Low P.** Almost anything works; non-linear methods (kernels, kNN) are safe.

The tell: if you hear "thousands of sparse features," say linear/NB; if you hear "high-dimensional dense and I'm using kNN," say "reduce dimensionality first or switch families."

### Q9. State the no free lunch theorem and how you'd use it in an interview.

**No free lunch (NFL):** averaged over *all* possible data-generating distributions, every learning algorithm has the same expected performance — no algorithm is universally superior. Any real superiority is a statement about a *specific* data distribution matching an algorithm's inductive bias.

How I use it in an interview: NFL is the reason I refuse to answer "what's the best algorithm?" in the abstract — and the reason I *still* commit to a concrete recommendation once you tell me the data. It reframes the question from "which algorithm is best" to "which algorithm's assumptions match this data's structure." Practically, it justifies (a) always trying a strong default plus a baseline rather than betting everything on one family, (b) validating empirically on *your* data rather than trusting benchmark leaderboards, and (c) explaining *why* a model wins here (its inductive bias matches the structure) rather than claiming it's best everywhere. Invoking NFL, then still giving a decisive pick, is exactly the balance of humility and commitment interviewers want.

### Q10. You have 500 labeled rows, 20 numeric features, roughly linear structure. What do you use and why?

**Logistic regression (with light L2 regularization), or a linear SVM.** Reasoning by constraint:

- **N is tiny (500).** This is the binding constraint — I need a high-bias, low-variance model that can't overfit 500 rows. Boosted ensembles and deep trees would memorize noise.
- **P is small (20) and dense.** No curse-of-dimensionality problem; distance and linear methods both fine.
- **Structure is roughly linear.** A linear boundary suffices, so the strong assumption of logistic/linear-SVM is a feature, not a limitation — it matches the data.
- **Bonus: interpretability.** Logistic gives odds ratios for free, useful for explaining the model.

I'd standardize the features, use cross-validation (with only 500 rows, k-fold or repeated CV, not a single holdout) to tune lambda, and keep a Naive Bayes or small-k kNN as a sanity baseline. If CV showed clear non-linearity, I'd step up to a small random forest — but I'd *start* linear because the data size makes it the safe, defensible choice.

### Q11. You have 2 million rows of mixed numeric/categorical tabular data with missing values. What do you use?

**LightGBM (gradient-boosted trees).** Constraint-by-constraint:

- **N = 2M** rules out SVMs (O(N^2)-O(N^3)) and makes naive kNN serving too slow. It favours histogram-based boosting, which is near-linear in N.
- **Mixed types + missing values** strongly favour tree ensembles: threshold splits are scale-invariant, and LightGBM/XGBoost learn a **default direction for missing values** — no imputation needed. LightGBM also has native categorical handling; CatBoost is an alternative if categoricals dominate.
- **LightGBM over XGBoost specifically** at this scale because histogram binning + GOSS (gradient-based one-side sampling) + EFB (exclusive feature bundling) make it much faster on large data, with leaf-wise growth squeezing out accuracy.

Plan: baseline logistic regression first (fast, tells me the problem is learnable and gives a floor), then LightGBM with early stopping on a validation fold, tuning eta / num_leaves / min_child_samples. Watch for target leakage if I add target-encoded categoricals. If the stakeholder needed explanations, I'd add SHAP or impose monotone constraints.

### Q12. You need to classify text (spam vs not) from sparse high-dimensional features. What do you use?

**Multinomial Naive Bayes as the baseline, linear SVM or logistic regression as the workhorse.**

- **High-dim sparse (tens of thousands of TF-IDF/count features)** is the classic home turf for linear models — the boundary is effectively linear in this rich space, and these models handle sparse matrices efficiently in time and memory.
- **Naive Bayes** is the go-to first cut: near-instant to train, surprisingly strong on text despite its false independence assumption, and a great accuracy floor. Use multinomial (counts) or Bernoulli (presence/absence) with Laplace smoothing to avoid zero probabilities, and work in log-space to avoid underflow.
- **Linear SVM / logistic regression** usually beat NB once tuned — the SVM's max-margin objective handles high-dim well, logistic gives calibrated-ish probabilities and interpretable weights per token.
- **Not tree ensembles or RBF-SVM:** trees struggle to find good splits in sparse high-dim space, and RBF distances collapse under the curse of dimensionality.

I'd start NB for a floor, then linear SVM/logistic with L2, tuning C via cross-validation.

### Q13. Compare parametric vs non-parametric algorithms and when each is preferable.

**Parametric** models fix the number of parameters up front, independent of N — linear/logistic regression, Naive Bayes, linear SVM. **Non-parametric** models let complexity grow with the data — kNN, decision trees, kernel SVM (support vectors scale with N), k-means (arguably).

| | Parametric | Non-parametric |
|---|---|---|
| Capacity | Fixed | Grows with data |
| Data need | Works with little data | Needs more data to shine |
| Bias/variance | Higher bias, lower variance | Lower bias, higher variance |
| Assumptions | Strong (functional form) | Weak / flexible |
| Inference cost | Cheap, constant | Often grows with N (kNN, SVM) |
| Extrapolation | Yes (linear) | Poor (trees, kNN) |

Prefer **parametric** when data is scarce, the functional form is roughly known, you need extrapolation, or you need cheap constant-time serving. Prefer **non-parametric** when you have plenty of data, the structure is complex/unknown, and you can afford the flexibility and serving cost. The strong tabular default (boosted trees) is non-parametric, which is why it needs enough data to avoid overfitting.

### Q14. How do interpretability requirements constrain algorithm choice in a regulated setting?

In regulated domains (credit, insurance, healthcare) you often must produce a **per-decision, per-feature explanation** that a human and an auditor can defend — "denied because income-to-loan ratio below threshold X," not "the ensemble said so." That constraint is frequently *binding*, overriding a fractional accuracy gain.

- **First choice: logistic / linear regression.** Coefficients are signed effects / odds ratios; adverse-action reasons fall out directly. Fully auditable and monotone.
- **Second: a shallow decision tree** — a readable flowchart, though less stable.
- **If you need more accuracy:** a **monotonically-constrained GBM** (XGBoost/LightGBM support monotone constraints) keeps the model well-behaved and pairs it with **SHAP** for per-prediction attributions — but post-hoc explanations are an approximation, which a strict regulator may not accept.
- **Avoid** kernel SVMs and unconstrained deep ensembles where explanations are hardest.

The senior framing: interpretability is a *hard constraint* here, so I eliminate black boxes first and optimize accuracy only within the glass-box (or provably-monotone) set — and I say so explicitly rather than defaulting to the most accurate model.

### Q15. Why can't tree-based models extrapolate, and when does that decide the algorithm?

A decision tree partitions feature space into regions and predicts a **constant** (the mean/majority of training targets) within each region. Beyond the range seen in training, there are no new splits — the input falls into the outermost leaf and gets that leaf's constant. So a random forest or gradient-boosted model trained on x in [0, 100] will predict a flat value for x = 500; it literally *cannot* continue a trend. Averaging (RF) or summing (GBM) constants still yields a bounded, flat surface outside the training envelope.

**Linear-family models extrapolate** because yhat = w·x + b keeps increasing with x — the line continues.

This decides the algorithm whenever the task genuinely requires predicting outside the training range: forecasting a monotonically growing time series past its historical maximum, pricing beyond observed levels, or any physical trend that continues. There, I use a linear/regularized-linear model (or add explicit trend features), not tree ensembles. For interpolation within the training range — the common case — trees are fine, and this limitation doesn't bite.

### Q16. How do you justify an algorithm choice convincingly in an interview?

Use a four-beat structure that shows constraint-driven reasoning, not memorized rankings:

1. **Interrogate the problem first.** Ask/state N, P, feature types, missing data, the label balance, the latency budget, and whether an explanation is required. This alone signals seniority — juniors jump straight to a model name.
2. **Name the binding constraint.** "The regulator needs an explanation" or "we have only 500 rows" or "2M rows rules out SVM." Lead with the constraint that eliminates whole families.
3. **Commit to one model and one reason per axis.** "LightGBM: handles the mixed types and missing values natively, scales to 2M rows via histograms, and gives strong accuracy with little prep." Don't hedge across five options.
4. **Defend against the two nearest alternatives and state the tradeoff you're accepting.** "I'd prefer it over random forest for accuracy-per-tuning, and over logistic regression because the relationship is clearly non-linear — accepting reduced interpretability, which I'd recover with SHAP."

Close by invoking **no free lunch** — "best is relative to this data" — and mentioning you'd still validate empirically with cross-validation. Decisive, constraint-driven, and empirically humble is the winning tone.

## Hyperparameters & Practical Implementation

### Summary

**What this topic covers**

Once you've chosen a family, this topic is about making it *work* — the **key hyperparameters per algorithm**, what each one does to the bias-variance tradeoff, a sane **tuning strategy** that doesn't waste compute, the **API shape** of sklearn / XGBoost / LightGBM, and the practical gotchas that silently wreck real pipelines (leakage, unscaled distance models, target-encoding traps, k-means on unscaled data). The 16 questions cover: which few knobs actually matter for each algorithm (GBM's eta / n_estimators / max_depth; RF's n_estimators / max_features; SVM's C / gamma; kNN's k; k-means' k / init); coarse-to-fine tuning with cross-validation; **pipelines** and why scaling must be fit *inside* each CV fold to avoid leakage; and rough **time/space complexity** so you can predict what will and won't scale. This is the counterpart to the selection topic — that one picks the family, this one configures it and ships it without shooting yourself in the foot. Cross-cutting concepts (cross-validation mechanics, leakage in general) live in the sister **ML Fundamentals** primer; here we apply them to concrete algorithms.

**Mental model**

Every algorithm has a **capacity dial and a regularization dial**, and tuning is mostly about balancing them against your data size. Rather than searching a huge grid, identify the two or three hyperparameters that dominate for each family, tune *those* coarse-to-fine with cross-validation, and leave the rest at sensible defaults. For boosting the mental model is a **budget split**: lower the learning rate (eta) for a smoother fit but buy more trees (n_estimators) to compensate, and cap max_depth to limit interaction order — these three trade off against each other. For anything distance- or gradient-based (kNN, SVM, k-means, PCA, linear models with regularization) the silent prerequisite is **feature scaling**, and the second silent killer is **data leakage** — any statistic learned from data (a scaler's mean, an imputer's fill value, a target encoding) must be fit on the *training* fold only, then applied to validation. That's what a `Pipeline` enforces mechanically. Get scaling, leakage-free CV, and the two-or-three key knobs right, and you've captured 90% of practical model performance.

**Key terms**

- **Hyperparameter** — a setting fixed before training (eta, k, C, max_depth), tuned via validation — as opposed to a parameter (weights) learned during training.
- **Learning rate / shrinkage (eta)** — in boosting, how much each new tree contributes; lower = slower, more robust, needs more trees.
- **n_estimators** — number of trees; in RF more never hurts (variance averages out), in GBM more eventually overfits without early stopping.
- **max_depth / num_leaves** — tree size; controls interaction order and capacity (bias-variance).
- **max_features** — features considered per split in a random forest; the decorrelation knob.
- **C (SVM)** — inverse regularization; large C fits hard (low bias/high variance), small C widens the margin (high bias).
- **gamma (RBF)** — kernel reach; large gamma = wiggly local boundary (overfit), small gamma = smooth.
- **Pipeline** — an sklearn object chaining preprocessing + model so transforms are fit only on training folds, preventing leakage.
- **Cross-validation (CV)** — resampling to estimate out-of-sample performance and pick hyperparameters (mechanics in ML Fundamentals).
- **Data leakage** — information from validation/test (or the target) sneaking into training, inflating CV scores and collapsing in production.
- **Target/mean encoding** — replacing a category with its mean target; powerful but leaks unless done out-of-fold.
- **class_weight / scale_pos_weight** — reweighting classes to handle imbalance without resampling.
- **Early stopping** — halt boosting when a validation metric stops improving; the practical alternative to tuning n_estimators.

**Why interviewers ask this**

Selection shows you know *what* to use; this shows you can actually *ship* it. Interviewers probe hyperparameters to check you understand mechanism, not menus — can you say *which direction* max_depth moves the bias-variance tradeoff and *why*, rather than reciting a grid? The leakage questions are the sharpest filter: a candidate who fits a `StandardScaler` on the whole dataset before cross-validating, or target-encodes a categorical on the full data, has leaked — and a good interviewer will catch it. Knowing that scaling belongs *inside* the CV fold (via a Pipeline), that kNN/SVM/k-means/PCA need scaling and trees don't, that RF can't extrapolate, and that target encoding must be out-of-fold, is exactly the practical maturity that separates someone who has trained a model in a notebook from someone who has debugged one in production. Complexity questions confirm you can predict what scales.

**Common confusions**

- "More trees overfit a random forest" — no; RF averages, so more trees only stabilize the estimate (compute cost aside). It's *boosting* where too many trees overfit.
- "Scale everything always" — trees and Naive Bayes are scale-invariant; scaling matters for kNN, SVM, k-means, PCA, and regularized linear models.
- "Grid-search everything" — wasteful; tune the two or three knobs that matter, coarse-to-fine, and use random or Bayesian search over grid for large spaces.
- "Fit the scaler once on all data" — that leaks validation statistics; fit inside each fold via a Pipeline.
- "eta and n_estimators are independent" — they trade off; halving eta roughly doubles the trees you need.

**What follows from this topic**

The tuning and pipeline discipline here is the practical payoff of **Algorithm Selection & Tradeoffs** (which picks the family) and leans on **ML Fundamentals** for CV and leakage theory. The mechanism-level "why does this knob move bias-variance" answers feed directly into **Classical Algorithms Interview & Whiteboard Playbooks**, where you explain the same algorithms on a whiteboard.

### Q1. What are the key hyperparameters of gradient boosting and how does each affect bias-variance?

Three dominate; the rest are secondary regularization:

- **Learning rate / shrinkage (eta)** — scales each tree's contribution: F_m = F_{m-1} + eta * h_m. **Lower eta = more regularization** (slower, less overfitting) but needs more trees. Typical 0.01-0.1.
- **n_estimators (number of trees)** — more trees keep reducing bias but eventually **overfit**; controlled in practice by **early stopping** on a validation set. eta and n_estimators trade off: halve eta, roughly double the trees.
- **max_depth (or num_leaves in LightGBM)** — the **interaction order**; depth-d trees model up to d-way feature interactions. Deeper = lower bias / higher variance. Tabular sweet spot is often 3-8.

Secondary knobs, all **regularizers** (raise bias, cut variance):
- **subsample** — row sampling per tree (stochastic gradient boosting).
- **colsample_bytree / colsample_bylevel** — feature sampling.
- **min_child_weight / min_child_samples** — minimum leaf mass.
- **lambda (L2) / alpha (L1) / gamma** — leaf-weight and split penalties (XGBoost).

Strategy: fix a smallish eta, set n_estimators high with early stopping, then tune max_depth and the subsampling/min-child regularizers.

### Q2. What are the key hyperparameters of a random forest, and why does n_estimators behave differently than in boosting?

Two knobs matter most:

- **n_estimators** — number of trees. Because RF **averages** independent (bagged, feature-subsampled) trees, more trees only **reduce variance and stabilize** the estimate — they never overfit. You pick n_estimators by diminishing returns vs compute, not by validation-set overfitting. This is the opposite of boosting, where trees are added *sequentially to fit residuals*, so too many trees overfit the training signal.
- **max_features** — the number of features considered at each split; the **decorrelation** knob. Smaller max_features = more decorrelated trees = more variance reduction but higher individual-tree bias. Defaults: sqrt(P) for classification, P/3 for regression.

Supporting knobs control individual tree capacity (usually left deep in RF, since averaging tames the variance):
- **max_depth / min_samples_leaf / min_samples_split** — regularize each tree.
- **bootstrap** — whether to sample rows with replacement (enables OOB error, a free validation estimate).

So: crank n_estimators as high as compute allows, tune max_features for decorrelation, and only cap tree depth if trees are so deep they hurt.

### Q3. Explain the SVM hyperparameters C and gamma and their bias-variance effect.

- **C** — the **soft-margin / regularization** parameter (inverse regularization strength). The objective is minimize 0.5*||w||^2 + C * sum(hinge slack). **Large C** penalizes margin violations heavily → the model fits training points hard → narrow margin, **low bias / high variance** (overfit risk). **Small C** tolerates violations → wider margin, **high bias / low variance** (smoother, more robust).

- **gamma** (RBF kernel K(x,x') = exp(-gamma*||x-x'||^2)) — the **reach** of a single training example. **Large gamma** = short reach = each point influences only its immediate neighbourhood → wiggly, complex boundary → **low bias / high variance** (overfit). **Small gamma** = long reach = smooth, near-linear boundary → high bias.

They interact, so tune them **jointly** on a 2D grid (log-spaced, e.g. C and gamma each over 1e-3..1e3), typically via cross-validation. Classic behaviour: large C *and* large gamma is the overfitting corner; small C and small gamma underfits. And crucially — **scale features first**, because both the RBF distance and the margin are scale-sensitive.

### Q4. What is the key hyperparameter of kNN, and how does it trade off bias and variance?

The single dominant knob is **k**, the number of neighbours:

- **Small k (e.g. k=1)** — the prediction follows the nearest point(s) exactly → **low bias, high variance**: a jagged boundary that memorizes noise. k=1 has zero training error but is very sensitive.
- **Large k** — averages over many neighbours → **high bias, low variance**: a smooth boundary. Too large and it washes out real structure (at k=N it predicts the global majority/mean).

Pick k by cross-validation; a common heuristic starting point is k ~ sqrt(N), and use an **odd k** for binary classification to avoid ties. Secondary choices:

- **distance metric** — Euclidean (default), Manhattan, or cosine (text).
- **weights** — uniform vs distance-weighted (closer neighbours count more).
- **algorithm** — brute force vs KD-tree / ball-tree for faster neighbour lookup in low dimensions.

The non-negotiable prerequisite isn't a hyperparameter but a preprocessing step: **scale the features**, or the largest-range feature dominates the distance.

### Q5. What are the key hyperparameters of k-means, and which matters most?

- **k (number of clusters)** — the fundamental choice, and k-means can't learn it. Pick it with the **elbow method** (plot inertia vs k, look for the bend), **silhouette score**, or the **gap statistic**, informed by domain knowledge.
- **init** — the seeding strategy. **k-means++** (default) spreads initial centroids to reduce the chance of a bad local minimum; it matters a lot because Lloyd's algorithm only converges to a *local* optimum.
- **n_init** — number of random restarts; keep the best (lowest inertia) run. Guards against unlucky initializations.
- **max_iter / tol** — convergence controls (usually fine at defaults).

k matters most (it defines the problem), init/n_init second (they determine whether you find a good local optimum). And as with all distance-based methods, **scale the features first** — k-means minimizes Euclidean within-cluster sum of squares, so an unscaled large-range feature dominates the clustering. Use **MiniBatchKMeans** for large N.

### Q6. Describe a sane hyperparameter tuning strategy.

Don't grid-search everything — spend compute where it pays off:

1. **Establish a baseline** with defaults and a simple model; know the floor before tuning.
2. **Tune only the two or three knobs that matter** per algorithm (GBM: eta + n_estimators + max_depth; RF: n_estimators + max_features; SVM: C + gamma; kNN: k). Leave the rest at defaults.
3. **Coarse-to-fine.** First a wide, log-spaced grid to find the good region, then a narrow search around the best point.
4. **Use cross-validation** for every candidate (see ML Fundamentals for CV mechanics) so you're optimizing out-of-sample performance, not training fit. Pick the config with the best mean CV score, favouring simpler models within one standard error.
5. **Prefer random or Bayesian search over full grid** when the space is large — random search covers important dimensions more efficiently; Bayesian (Optuna, Hyperopt) is sample-efficient.
6. **Exploit early stopping** for boosting instead of tuning n_estimators directly.
7. **Tune inside a Pipeline** so preprocessing is refit per fold (no leakage), and hold out a final untouched test set for the last, unbiased estimate.

The theme: few knobs, coarse-to-fine, CV-driven, leakage-free.

### Q7. Show the sklearn estimator API shape and why its consistency matters.

Every sklearn estimator follows the same **fit / predict / transform** contract:

```python
from sklearn.ensemble import RandomForestClassifier

model = RandomForestClassifier(n_estimators=300, max_features="sqrt")
model.fit(X_train, y_train)          # learn parameters
preds  = model.predict(X_test)       # class labels
proba  = model.predict_proba(X_test) # calibrated-ish probabilities
score  = model.score(X_test, y_test) # default metric (accuracy/R^2)
```

- **Transformers** (scalers, encoders, PCA) implement `fit` + `transform` (and `fit_transform`).
- **Predictors** implement `fit` + `predict` (+ `predict_proba` / `decision_function` for classifiers).

Why it matters: because the interface is uniform, you can **swap any model into the same code**, drop transformers and estimators into a `Pipeline`, and wrap the whole thing in `GridSearchCV` / `cross_val_score` without rewriting anything. Hyperparameters go in the constructor; learned parameters get trailing underscores (`model.feature_importances_`, `pca.components_`). That consistency is what makes experimentation and leakage-safe cross-validation ergonomic.

### Q8. Show the XGBoost / LightGBM API shape and how it differs from sklearn.

Both ship a **native API** and an **sklearn-compatible wrapper**:

```python
import xgboost as xgb

# sklearn-style wrapper — drops into Pipeline / GridSearchCV
clf = xgb.XGBClassifier(
    n_estimators=1000, learning_rate=0.05, max_depth=6,
    subsample=0.8, colsample_bytree=0.8, eval_metric="logloss")
clf.fit(X_train, y_train,
        eval_set=[(X_val, y_val)], early_stopping_rounds=50)

# native API — DMatrix, explicit params, more control
dtrain = xgb.DMatrix(X_train, label=y_train)
dval   = xgb.DMatrix(X_val, label=y_val)
booster = xgb.train({"eta": 0.05, "max_depth": 6, "objective": "binary:logistic"},
                    dtrain, num_boost_round=1000,
                    evals=[(dval, "val")], early_stopping_rounds=50)
```

LightGBM mirrors this (`LGBMClassifier` / `lgb.train` with `Dataset`). Key differences from vanilla sklearn: (1) a **validation set and early stopping** are first-class — you set n_estimators high and let early stopping choose the count; (2) native **missing-value handling** and (in LightGBM) **categorical features** without manual encoding; (3) a native binary data format (DMatrix/Dataset) for speed and out-of-core training. Use the sklearn wrapper for pipeline integration, the native API for maximum control.

### Q9. What is an sklearn Pipeline and why is it essential for avoiding leakage?

A `Pipeline` chains preprocessing steps and a final estimator into one object with a single `fit` / `predict`:

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.model_selection import cross_val_score

pipe = Pipeline([
    ("scale", StandardScaler()),
    ("svm",   SVC(C=1.0, gamma="scale")),
])
scores = cross_val_score(pipe, X, y, cv=5)   # scaler refit each fold
```

It's essential because it makes preprocessing **fold-aware**. When `cross_val_score` splits the data, it calls `pipe.fit` on each training fold — so the `StandardScaler` learns its mean/std from *that fold's training rows only*, then applies them to the held-out rows. If you instead scaled the whole dataset once before CV, the scaler would have seen validation rows, **leaking** their statistics into training and inflating your CV score. The same applies to imputers, target encoders, and PCA. Pipelines also prevent train/serve skew (the exact same transforms run at predict time) and make the whole preprocessing-plus-model unit tunable in one `GridSearchCV`.

### Q10. Which algorithms require feature scaling and which don't?

**Scaling required** (anything using distances, dot products, or gradient geometry):

- **kNN, k-means, hierarchical/DBSCAN** — Euclidean distance is dominated by large-range features without scaling.
- **SVM (especially RBF)** — margin and kernel distances are scale-sensitive.
- **PCA** — maximizes variance, so an unscaled high-variance feature hijacks the components; standardize unless features share units.
- **Regularized linear (ridge/lasso)** — the penalty sum(w^2) or sum(|w|) is unfair if features are on different scales; standardize so the penalty is comparable.
- **Neural nets / any gradient descent** — scaling speeds and stabilizes convergence.

**Scaling not required** (invariant to monotone per-feature transforms):

- **Decision trees, random forests, gradient boosting** — splits are threshold-based; scaling a feature doesn't change the split order.
- **Naive Bayes** — works on per-feature likelihoods, not cross-feature distances.

The interview tell: if asked "do I need to scale for XGBoost?" say no (and explain why — threshold splits); if asked about kNN/SVM/k-means/PCA, say yes, and scale *inside* the CV fold via a Pipeline.

### Q11. Explain target encoding leakage and how to do it safely.

**Target (mean) encoding** replaces a categorical value with the mean of the target for that category — powerful for high-cardinality categoricals. The trap: if you compute each category's mean using **the same rows you then train on**, every row's encoded feature contains information about *its own* label. The model learns to read the leaked target, CV scores look great, and it **collapses in production** where the true label isn't available.

Safe approaches:

- **Out-of-fold encoding.** Split into folds; encode each fold's rows using target means computed from the *other* folds only. Nested/K-fold target encoding.
- **Leave-one-out** — encode each row using the category mean excluding that row.
- **Smoothing / additive priors.** Blend the category mean with the global mean, weighted by category count, so rare categories don't get extreme leaked values: enc = (n*cat_mean + m*global_mean) / (n + m).
- **CatBoost's ordered target statistics** — computes the encoding using only rows seen "before" each example, structurally preventing leakage.

Always fit the encoding **inside the CV fold / Pipeline**, never on the full dataset — the same discipline as scaling.

### Q12. How do you handle class imbalance at the algorithm/implementation level?

Several levers, roughly in order of preference:

- **class_weight / scale_pos_weight** — reweight the loss so minority-class errors count more. sklearn's `class_weight="balanced"`; XGBoost's `scale_pos_weight = n_neg/n_pos`. Cheap, no data duplication, usually the first thing to try.
- **Resampling** — oversample the minority (or **SMOTE**, synthetic interpolation) or undersample the majority. Do it **inside the CV fold** (via imblearn's Pipeline) or you leak; oversampling before splitting duplicates rows across train and validation.
- **Threshold tuning** — don't accept the default 0.5; pick the decision threshold from a precision-recall curve to match the business cost.
- **Right metrics** — accuracy is meaningless at 99:1; use PR-AUC, F1, recall at fixed precision, or balanced accuracy (metric choice lives in ML Fundamentals).

The senior point: imbalance is usually a **loss-weighting and threshold** problem, not a "must oversample" problem — try class weights first, resample inside the pipeline if needed, and always evaluate on imbalance-aware metrics.

### Q13. State the rough training and inference complexity of the main algorithms.

Let N = rows, P = features, k = neighbours/clusters, T = trees, i = iterations.

| Algorithm | Train | Predict | Notes |
|---|---|---|---|
| Linear (normal eq) | O(N*P^2 + P^3) | O(P) | P^3 to invert; use GD for large P |
| Linear (SGD) | O(N*P) per epoch | O(P) | Scales to huge N/sparse |
| Logistic regression | O(N*P) per iter | O(P) | Iterative (no closed form) |
| kNN | O(1) (store data) | O(N*P) per query | Lazy; slow serving, KD-tree helps low-dim |
| Naive Bayes | O(N*P) | O(P*classes) | One pass, very fast |
| Decision tree | O(N*P*log N) | O(depth) | Sorting features to split |
| Random forest | O(T*N*P*log N) | O(T*depth) | Embarrassingly parallel |
| Gradient boosting | O(T*N*P*log N) | O(T*depth) | Sequential (can't parallelize across trees) |
| SVM (kernel) | O(N^2) to O(N^3) | O(n_sv*P) | Poor for large N; serving scales with support vectors |
| k-means | O(N*k*i*P) | O(k*P) | Per iteration N*k*P |
| PCA | O(N*P^2 + P^3) | O(P*components) | Or truncated SVD O(N*P*components) |

The load-bearing facts: **SVM's O(N^2-3)** kills it past ~100k rows; **kNN's O(N) per query** kills serving latency; **GBM is sequential** (unlike RF); **PCA/linear have a P^3** term that bites in high dimensions.

### Q14. Which hyperparameters trade off against each other, and how do you tune them jointly?

The classic coupled pairs:

- **eta and n_estimators (boosting).** They multiply into total learning capacity: F = sum(eta * h_m). Halve eta and you roughly double the trees needed. Tune jointly by fixing a small eta and using **early stopping** to pick n_estimators automatically, rather than gridding both.
- **C and gamma (RBF SVM).** C sets margin hardness, gamma sets boundary wiggliness; both push toward overfitting when large, so the good region is a diagonal band in (C, gamma) space. Tune on a **joint 2D log-spaced grid**, never one at a time.
- **max_features and n_estimators (RF).** Smaller max_features decorrelates trees but raises individual-tree bias, which more trees then average down — so they interact, though RF is forgiving.
- **k and distance weighting (kNN).** A larger k with distance-weighting behaves differently than a larger k uniform.

General principle: hyperparameters that jointly control the bias-variance dial are **not separable**, so a one-at-a-time (coordinate) search can miss the optimum. Use a joint grid for small coupled sets (C/gamma), and random or Bayesian search for larger spaces.

### Q15. What are the most common practical gotchas that silently break a model?

The recurring foot-guns:

- **Leakage via preprocessing on the full dataset.** Fitting a scaler, imputer, or PCA before the train/test split leaks statistics. Fix: fit inside the CV fold via a Pipeline.
- **Target-encoding leakage.** Mean-encoding a category on the same rows you train on. Fix: out-of-fold encoding with smoothing.
- **Forgetting to scale kNN / SVM / k-means / PCA.** The largest-range feature dominates the distance/variance. Fix: standardize (inside the pipeline).
- **Expecting a tree model to extrapolate.** RF/GBM predict a flat constant outside the training range. Fix: linear model or explicit trend features.
- **Ignoring class imbalance.** 99% accuracy on a 99:1 problem is the null model. Fix: class weights, thresholds, PR-AUC.
- **Overfitting the validation set by tuning too much.** Fix: a final untouched test set; nested CV for honest estimates.
- **Train/serve skew.** Different preprocessing in training vs production. Fix: ship the whole Pipeline.
- **Too many boosting trees without early stopping.** Silent overfit. Fix: early stopping on a validation metric.

Naming these unprompted is a strong practical-maturity signal.

### Q16. When and how would you use dimensionality reduction as a preprocessing step, and what's the leakage risk?

**When:** reach for PCA (or truncated SVD for sparse data) before a distance-based model (kNN, RBF-SVM, k-means) when P is large and features are correlated — it fights the curse of dimensionality, decorrelates features, denoises, and speeds training. Use it also for visualization (2-3 components) and to compress before a downstream model. Skip it for tree ensembles (they handle high-dim and irrelevant features fine, and PCA destroys the interpretable axis-aligned splits).

**How:** standardize first (PCA maximizes variance, so unequal scales hijack the components), then keep enough components to reach a target **cumulative explained variance** (e.g. 95%), chosen by cross-validated downstream performance rather than in isolation.

**The leakage risk:** PCA is *fit* on data — it learns the principal axes from the covariance structure. If you fit PCA on the full dataset before splitting, the components have seen the validation rows, leaking information. Fix: put PCA **inside the Pipeline** so it's refit on each training fold and merely `transform`s the validation fold:

```python
Pipeline([("scale", StandardScaler()),
          ("pca", PCA(n_components=0.95)),
          ("knn", KNeighborsClassifier())])
```

Same discipline as scaling and target encoding — any data-derived transform belongs inside the fold.

## Classical Algorithms Interview & Whiteboard Playbooks

### Summary

**What this topic covers**

This is the **pure explain/derive/compare** topic — the set-piece questions an interviewer asks to confirm you understand each classical algorithm *from the inside* and can reason on a whiteboard without a library. It gathers the canonical derivations and comparisons scattered across the per-algorithm topics into rehearsable playbooks: **derive the logistic-regression gradient** and show it's X^T(p - y); **explain the kernel trick**; **how does a random forest reduce variance**; **why does XGBoost dominate tabular data**; **how does k-means converge and how can it fail**; **what does PCA actually compute** and its link to SVD; **L1 vs L2**; **bagging vs boosting**; **compare two algorithms for a given dataset**; **implement k-means or a decision-tree split in pseudocode**; and **state the complexity** of an algorithm. The 16 questions here are deliberately overlapping with earlier topics — the point is not new material but *delivery*: crisp, structured, whiteboard-ready answers. The final questions cover the meta-skill of **structuring an algorithm-explanation answer** so you sound like someone who has implemented these, not memorized them.

**Mental model**

Every good algorithm-explanation answer has the **same four-beat skeleton**: (1) the **objective** — what is it optimizing? (2) the **mechanism** — how does it optimize that (the update rule, the greedy split, the iteration)? (3) the **key knobs and complexity** — what controls it and what does it cost? (4) the **decisive tradeoff** — the one-line reason you'd pick it or not. Internalize that skeleton and you can answer *any* "explain algorithm X" question without floundering. For derivations, the mental model is "start from the loss, take the gradient, simplify to the clean form" — the logistic gradient X^T(p - y) and the SVM dual both fall out this way. For comparisons, name the *axis* that distinguishes them (bagging reduces variance / boosting reduces bias; L1 gives sparsity / L2 shrinks; PCA is linear-global / t-SNE is non-linear-local) rather than listing disconnected facts. The whiteboard-coding questions (k-means, a decision-tree split) reward showing the loop structure and the stopping condition, not perfect syntax.

**Key terms**

- **Objective / loss** — the quantity an algorithm minimizes (MSE, log-loss, hinge, inertia); every explanation should name it first.
- **Gradient** — the derivative of the loss w.r.t. parameters; for logistic regression it simplifies to X^T(p - y).
- **Kernel trick** — replacing dot products x·x' with K(x,x') to work in an implicit high-dim space without computing the mapping.
- **Variance reduction** — averaging decorrelated estimators (bagging/RF) to shrink the variance term of the error.
- **Bias reduction** — sequentially fitting residuals (boosting) to shrink the bias term.
- **Newton / second-order** — using the Hessian as well as the gradient (XGBoost's split gain); faster, better-directed steps.
- **Lloyd's algorithm** — the assign-then-update iteration that (locally) minimizes k-means inertia.
- **Local minimum** — a solution better than its neighbours but not globally best; k-means and neural nets converge to one.
- **Eigenvector / eigenvalue** — the principal directions and their variances that PCA extracts from the covariance matrix.
- **SVD** — singular value decomposition X = U S V^T; the numerically preferred route to PCA (V holds the components).
- **L1 / L2 penalty** — sum(|w|) (sparsity, corners) vs sum(w^2) (shrinkage, smooth).
- **Convexity** — a single global minimum (linear/logistic/SVM losses); guarantees gradient descent finds the optimum.

**Why interviewers ask this**

These are the questions that cannot be faked. "Derive the logistic-regression gradient" or "explain the kernel trick" instantly separates a candidate who *understands* the algorithm from one who has only *called* it. Interviewers ask them because the answers are compact, unambiguous, and highly diagnostic: either you can get from the log-loss to X^T(p - y), or you can't; either you can explain why bagging cuts variance but not bias, or you're guessing. They also test communication — can you explain PCA to a smart colleague in ninety seconds with the right level of maths? A junior recites a definition; a senior gives the objective, the mechanism, the tradeoff, and *why it works*, adjusting depth to the interviewer's cues. Nailing these playbooks is the difference between "knows the library" and "knows the algorithm."

**Common confusions**

- "Bagging reduces bias" — no; bagging reduces *variance* by averaging. Boosting reduces *bias* by sequential residual-fitting.
- "The kernel trick maps data to high dimensions" — it *implicitly* works in that space via K(x,x'); it never explicitly computes the mapping (that's the whole point).
- "PCA does feature selection" — no; it creates new features (linear combinations of all originals), it doesn't select a subset.
- "k-means finds the global optimum" — it finds a *local* optimum of a non-convex objective; initialization (k-means++) and restarts matter.
- "L1 and L2 both zero out features" — only L1 (the corner of the constraint region) produces exact zeros; L2 shrinks toward but never to zero.

**What follows from this topic**

This topic is the rehearsal layer over the whole primer — every derivation and comparison here has its mechanics grounded in the per-algorithm topics and its selection logic in **Algorithm Selection & Tradeoffs** and **Hyperparameters & Practical Implementation**. Cross-cutting theory (bias-variance decomposition, convexity, evaluation) lives in the sister **ML Fundamentals** primer; here we deliver it as interview set-pieces.

### Q1. Derive the gradient of logistic regression's log-loss.

Set up: prediction p_i = sigmoid(z_i) where z_i = w·x_i + b, sigmoid(z) = 1/(1 + exp(-z)). Labels y_i in {0, 1}. The loss is the negative log-likelihood (log-loss):

```
L = -sum_i [ y_i*log(p_i) + (1 - y_i)*log(1 - p_i) ]
```

Two facts make it clean. First, the derivative of the sigmoid: sigmoid'(z) = sigmoid(z)*(1 - sigmoid(z)) = p*(1 - p). Second, differentiate one term of L w.r.t. p_i then chain through z_i to w.

Differentiate L w.r.t. z_i:

```
dL/dp_i = -( y_i/p_i - (1 - y_i)/(1 - p_i) )
dp_i/dz_i = p_i*(1 - p_i)
dL/dz_i = dL/dp_i * dp_i/dz_i = -( y_i*(1 - p_i) - (1 - y_i)*p_i ) = p_i - y_i
```

The p_i*(1-p_i) cancels beautifully, leaving **dL/dz_i = p_i - y_i** (the prediction error). Then chain to the weights, dz_i/dw = x_i:

```
dL/dw = sum_i (p_i - y_i) * x_i   =>   in matrix form:  grad = X^T (p - y)
```

So the gradient is **X^T (p - y)** — features times prediction errors, identical in form to linear regression's gradient. Gradient descent: w <- w - lr * X^T(p - y). The loss is convex, so this converges to the global optimum.

### Q2. Explain the kernel trick as if on a whiteboard.

**Objective:** many algorithms (SVM, PCA, ridge) only ever use the data through **dot products** x_i·x_j, never the raw vectors. A linear boundary in the input space may be hopeless, but a linear boundary in a *higher-dimensional* feature space phi(x) can separate the same data (e.g. lift 1D points to (x, x^2) and a parabola becomes a line).

**The trick:** you'd like to work in phi-space, but phi might be huge or infinite-dimensional, so computing phi(x) explicitly is impossible. A **kernel** K(x, x') = phi(x)·phi(x') gives you the dot product *in that space directly*, from the original vectors, without ever forming phi. Substitute K wherever a dot product appears and you get a non-linear model at the cost of the original-space computation. That substitution is the kernel trick.

**Common kernels:**
- Linear: K = x·x' (no lift).
- Polynomial: K = (x·x' + c)^d (degree-d interactions).
- RBF/Gaussian: K = exp(-gamma*||x - x'||^2) (implicitly infinite-dimensional; gamma = reach).

Any K satisfying **Mercer's condition** (symmetric positive semi-definite) corresponds to some valid phi. The payoff: non-linear decision boundaries with linear-model machinery. The cost: you now work with the N-by-N kernel matrix, so kernels scale poorly with N.

### Q3. How does a random forest reduce variance? Be precise.

Start from the variance of an average. If you average T identically-distributed estimators each with variance sigma^2 and pairwise correlation rho, the variance of the mean is:

```
Var(mean) = rho*sigma^2 + (1 - rho)/T * sigma^2
```

As T grows, the second term vanishes, leaving **rho*sigma^2**. So the floor on variance reduction is set by the **correlation rho between trees** — averaging only helps to the extent the trees are *decorrelated*.

A single deep decision tree is low-bias but high-variance. Random forests attack the variance in two stacked ways:

1. **Bagging (bootstrap aggregating)** — train each tree on a bootstrap resample of the rows. This makes the trees somewhat different, reducing rho below 1.
2. **Random feature subsetting** — at each split, consider only a random subset (max_features) of features. This is the crucial extra step: it stops every tree from keying on the same one or two dominant features, driving rho *further* down. Bagging alone leaves trees correlated through shared strong predictors; feature subsetting breaks that.

Because it only averages, RF **reduces variance without adding bias** (each tree stays low-bias), which is why more trees never overfit — they just push the (1-rho)/T term toward zero. The whole trick is decorrelation.

### Q4. Why does XGBoost dominate tabular data? Give the technical reasons.

It's gradient boosting plus a stack of engineering and statistical improvements that together nail the tabular use case:

- **Regularized objective.** The loss adds an explicit tree-complexity penalty: Obj = sum(loss) + gamma*T_leaves + 0.5*lambda*sum(leaf_weight^2). This directly controls overfitting, which plain GBM leaves to depth/shrinkage alone.
- **Second-order (Newton) optimization.** It uses both the gradient g and the Hessian h of the loss per instance, giving a closed-form optimal leaf weight -G/(H+lambda) and a principled **split gain** = 0.5*[ G_L^2/(H_L+lambda) + G_R^2/(H_R+lambda) - G^2/(H+lambda) ] - gamma. Better-directed steps than first-order GBM.
- **Sparsity-aware split finding.** Learns a **default direction** for missing values, so missing data and sparse one-hot features are handled natively — no imputation.
- **Systems engineering.** Weighted quantile sketch for approximate splits, column-block layout for cache efficiency, parallel split-finding, and out-of-core support make it fast on real data.
- **The tabular fit itself.** Trees natively handle mixed types, non-linearity, interactions (via depth), and scale-invariance; boosting drives bias low; regularization controls variance.

Net: near-SOTA accuracy on tabular data with modest tuning and minimal preprocessing. The tradeoffs — a black box and no extrapolation — rarely bite on tabular prediction, which is why it (and LightGBM) became the Kaggle and production default.

### Q5. How does k-means converge, and how can it fail?

**Objective:** minimize within-cluster sum of squares (inertia) = sum over clusters, sum over points, ||x - centroid||^2.

**Lloyd's algorithm** alternates two steps that each never increase inertia:
1. **Assignment** — assign each point to its nearest centroid (minimizes inertia holding centroids fixed).
2. **Update** — set each centroid to the mean of its assigned points (the mean is the inertia-minimizing center holding assignments fixed).

Repeat until assignments stop changing. Because inertia is bounded below and monotonically non-increasing across a finite number of possible assignments, the algorithm **must converge** — but only to a **local minimum**, since the objective is non-convex.

**How it fails:**
- **Bad local optima** from poor initialization — mitigated by **k-means++** seeding and multiple restarts (n_init).
- **Wrong k** — it can't learn the number of clusters; choose via elbow/silhouette/gap.
- **Non-spherical / unequal-size / varying-density clusters** — it assumes isotropic Euclidean blobs, so it splits elongated or crescent shapes wrongly (use GMM for elliptical, DBSCAN for arbitrary shapes).
- **Unscaled features** — Euclidean distance lets a large-range feature dominate; standardize first.
- **Outliers** — the mean is not robust, so outliers drag centroids.

The crisp summary: guaranteed convergence, only to a local optimum, under strong geometric assumptions.

### Q6. What does PCA actually compute, and how does it relate to SVD?

**Objective:** find the orthogonal directions of **maximum variance** in the data (equivalently, the directions that minimize reconstruction error). Center the data (subtract the mean) first.

**Via covariance/eigendecomposition:** form the covariance matrix C = (1/n) X^T X (X centered). Its **eigenvectors** are the principal components (directions), and each **eigenvalue** is the variance captured along that direction. Rank components by eigenvalue; keep the top ones. So PCA = eigendecomposition of the covariance matrix.

**Via SVD (numerically preferred):** decompose the centered data directly, X = U S V^T. Then:
- The **columns of V** are the principal components (eigenvectors of X^T X).
- The **singular values** relate to variances by eigenvalue_i = s_i^2 / n.
- The **projected/transformed data** (scores) = U S = X V.

SVD is preferred because it avoids explicitly forming X^T X (which squares the condition number and loses precision) and truncated SVD gives the top-k components efficiently for large or sparse data.

**Why max-variance:** projecting onto the top eigenvectors both maximizes retained variance and minimizes squared reconstruction error — the two are equivalent by the Pythagorean decomposition (total variance = retained + lost). Use PCA for compression, visualization, denoising, and decorrelation; standardize first if features differ in scale.

### Q7. Prove (sketch) that PCA maximizes variance along the first component.

Set up: centered data X, and we want the unit direction w (||w||=1) that maximizes the variance of the projections z = X w. The variance of the projected data is:

```
Var(z) = (1/n) * (X w)^T (X w) = w^T [ (1/n) X^T X ] w = w^T C w
```

where C is the covariance matrix. So we maximize w^T C w subject to w^T w = 1. Use a **Lagrange multiplier**:

```
Lagrangian = w^T C w - lambda*(w^T w - 1)
d/dw = 2*C*w - 2*lambda*w = 0   =>   C w = lambda w
```

That's exactly the **eigenvector equation**: the maximizing w is an eigenvector of C, and lambda is its eigenvalue. Substituting back, the objective value is w^T C w = w^T (lambda w) = lambda. So variance along w equals its eigenvalue, and to *maximize* variance you pick the eigenvector with the **largest eigenvalue** — the first principal component. The second component maximizes remaining variance subject to being orthogonal to the first, giving the second-largest eigenvector, and so on. This is why PCA is the eigendecomposition of the covariance matrix, ordered by eigenvalue.

### Q8. L1 vs L2 regularization — compare and explain why L1 produces sparsity.

Both add a penalty to the loss to shrink weights and reduce overfitting:

| | L2 (Ridge) | L1 (Lasso) |
|---|---|---|
| Penalty | lambda*sum(w^2) | lambda*sum(|w|) |
| Effect | Shrinks all weights toward 0 | Drives some weights **exactly to 0** |
| Feature selection | No (keeps all) | Yes (sparse) |
| Solution | Closed form (X^TX + lambda I)^-1 X^T y | No closed form (coordinate descent) |
| Correlated features | Shares weight among them | Arbitrarily picks one |
| Geometry | Circular constraint | Diamond (corners on axes) |

**Why L1 gives exact zeros — the geometric argument:** minimizing the loss subject to a penalty budget is equivalent to constraining ||w|| within a region. The L2 constraint region is a **circle/sphere** (smooth); the loss contours generically first touch it at a point with all coordinates non-zero. The L1 region is a **diamond/cross-polytope** with sharp **corners on the axes**; the loss contours are very likely to first touch a corner, and at a corner some coordinates are exactly zero. So L1's non-differentiable corners produce exact sparsity, while L2's smooth boundary only shrinks.

**Elastic Net** combines both (lambda1*sum(|w|) + lambda2*sum(w^2)) to get sparsity plus stable handling of correlated features. Standardize features first so the penalty is applied fairly.

### Q9. Bagging vs boosting — compare on every axis that matters.

Both are tree ensembles, but they attack opposite error terms:

| | Bagging (e.g. Random Forest) | Boosting (e.g. GBM/XGBoost) |
|---|---|---|
| Primary target | Reduce **variance** | Reduce **bias** |
| Tree training | **Parallel**, independent | **Sequential**, each fits prior residual |
| Base learner | Deep, low-bias, high-variance trees | Shallow, high-bias, weak trees |
| Combination | Average / majority vote | Weighted sum (additive model) |
| Overfitting w/ more trees | No (averaging stabilizes) | Yes (needs shrinkage / early stopping) |
| Data weighting | Uniform (bootstrap) | Emphasizes hard/residual cases |
| Parallelism | Easy across trees | Hard (sequential dependency) |
| Tuning | Robust, little tuning | More sensitive (eta, depth, n_estimators) |
| Typical accuracy | Strong, safe | Usually higher (SOTA tabular) |

**Bagging** trains many high-variance trees on bootstrap samples and averages them; averaging decorrelated estimators shrinks variance (RF adds feature subsetting to decorrelate further). **Boosting** builds an additive model F_m = F_{m-1} + eta*h_m where each weak learner fits the **negative gradient** of the loss (the residuals), progressively reducing bias.

One-liner: **bagging averages independent low-bias/high-variance models to cut variance; boosting sequentially adds high-bias/low-variance models to cut bias.** Boosting usually wins on accuracy but needs more careful tuning and can overfit; bagging is more forgiving and parallel.

### Q10. Implement k-means in pseudocode.

Show the loop structure, the two alternating steps, and the stopping condition — syntax is secondary:

```python
def kmeans(X, k, max_iter=100, tol=1e-4):
    # X: (n, d) data, already scaled
    centroids = kmeans_plus_plus_init(X, k)   # spread seeds, not pure random

    for _ in range(max_iter):
        # 1. Assignment: each point to nearest centroid
        # dist(i, j) = squared Euclidean from point i to centroid j
        labels = argmin_over_j( squared_distances(X, centroids) )

        # 2. Update: recompute each centroid as the mean of its members
        new_centroids = []
        for j in range(k):
            members = X[labels == j]
            if len(members) == 0:
                new_centroids.append(reseed_empty_cluster(X))  # handle empty
            else:
                new_centroids.append(members.mean(axis=0))
        new_centroids = stack(new_centroids)

        # 3. Convergence check
        shift = max_norm(new_centroids - centroids)
        centroids = new_centroids
        if shift < tol:
            break

    return labels, centroids
```

Key points to mention aloud: initialize with **k-means++** (spreads seeds, avoids bad local minima) and run **multiple restarts** keeping the lowest inertia; **handle empty clusters** by reseeding; convergence is guaranteed because inertia monotonically decreases, but only to a **local** optimum; complexity is **O(n*k*i*d)** per the loop.

### Q11. Implement a decision-tree split in pseudocode.

The core operation is choosing the (feature, threshold) that maximizes impurity reduction:

```python
def best_split(X, y):
    best_gain = 0
    best_feature, best_threshold = None, None
    parent_impurity = gini(y)                 # 1 - sum(p_k^2)
    n = len(y)

    for feature in range(num_features):
        # sort rows by this feature so thresholds are midpoints between values
        values = sorted(unique(X[:, feature]))
        for threshold in midpoints(values):
            left  = y[X[:, feature] <= threshold]
            right = y[X[:, feature] >  threshold]
            if len(left) == 0 or len(right) == 0:
                continue

            # weighted child impurity
            w_left  = len(left) / n
            w_right = len(right) / n
            child_impurity = w_left*gini(left) + w_right*gini(right)

            gain = parent_impurity - child_impurity
            if gain > best_gain:
                best_gain = gain
                best_feature, best_threshold = feature, threshold

    return best_feature, best_threshold, best_gain

def gini(y):
    # impurity = 1 - sum of squared class proportions
    return 1 - sum((count(y, c) / len(y)) ** 2 for c in classes(y))
```

Then the tree recurses: apply `best_split`, partition into left/right, and repeat until a **stopping condition** (max_depth reached, node pure, or below min_samples_leaf). Talking points: it's **greedy** (locally best split, no backtracking) and produces **axis-aligned** splits; use Gini or entropy for classification, variance/MSE for regression; the sort-per-feature makes split-finding **O(n*p*log n)**; and unpruned trees overfit, so add cost-complexity pruning or depth limits.

### Q12. Compare logistic regression and SVM for a classification task.

Both fit linear boundaries (SVM non-linearly with kernels), but differ in objective and behaviour:

| | Logistic Regression | SVM |
|---|---|---|
| Objective | Minimize log-loss (max likelihood) | Maximize margin (min 0.5||w||^2 + C*hinge) |
| Output | Calibrated **probabilities** | Signed distance; probabilities need Platt scaling |
| Driven by | **All** points (every point contributes to the loss) | Only the **support vectors** (points near the boundary) |
| Non-linearity | Needs explicit feature engineering | **Kernel trick** (RBF, poly) for free |
| High dimensions | Strong, especially sparse text | Strong, especially small-N/high-P |
| Large N | Scales well (SGD) | Poor — O(N^2)-O(N^3) training |
| Interpretability | High (coefficients = odds ratios) | Low (kernel), moderate (linear) |
| Robustness to outliers | Sensitive (log-loss unbounded) | More robust (hinge ignores well-classified points) |

**When to pick which:** use **logistic regression** when you need probabilities, interpretability, or you have large N — it's the default interpretable baseline. Use an **SVM** when you have small-to-medium N with high dimensionality and possibly a non-linear boundary (RBF kernel), and you don't need calibrated probabilities. For huge sparse text both work; logistic is usually chosen for speed and probability outputs. The decisive axes: probabilities + scale favour logistic; margin robustness + kernel non-linearity on modest data favour SVM.

### Q13. Compare XGBoost and LightGBM.

Both are high-performance gradient-boosted tree libraries; the differences are in *how they build trees*:

| | XGBoost | LightGBM |
|---|---|---|
| Split finding | Pre-sorted / approximate quantile | **Histogram-based** (bin features) |
| Tree growth | **Level-wise** (depth-first balanced) | **Leaf-wise** (best-first, grow highest-gain leaf) |
| Speed on large data | Fast | **Faster** (histograms + sampling) |
| Sampling tricks | Row/col subsampling | **GOSS** (keep large-gradient rows) + **EFB** (bundle sparse features) |
| Overfitting on small data | More conservative | Leaf-wise can **overfit** — cap num_leaves |
| Categorical features | Manual encoding | **Native** categorical support |
| Missing values | Default direction (sparsity-aware) | Default direction |

**LightGBM's speed** comes from three ideas: **histogram binning** (discretize each feature into ~255 bins, so split-finding scans bins not sorted values), **GOSS** (gradient-based one-side sampling — keep all large-gradient instances and subsample small-gradient ones, since large gradients carry more information), and **EFB** (exclusive feature bundling — merge mutually-exclusive sparse features into one, shrinking effective dimensionality). **Leaf-wise growth** picks the single highest-gain leaf to split (vs XGBoost growing a whole level), yielding deeper, more accurate trees per iteration but more overfitting risk on small data.

**When to pick:** LightGBM for large datasets and speed (default at scale); XGBoost for smaller data, maximum robustness, or when its regularized objective and maturity are preferred. CatBoost if categoricals dominate (ordered boosting fights target leakage).

### Q14. State the complexity of an algorithm on demand — walk through kNN and SVM.

Interviewers often ask "what's the complexity of X?" cold. Structure the answer as **train / predict / space**, and explain *what drives* each.

**kNN** (N points, d features, k neighbours):
- **Train: O(1)** (or O(N*d) to just store) — it's a lazy learner, no model is fit.
- **Predict: O(N*d) per query** naively — compute the distance to every stored point, then a partial sort for the k nearest. This is the killer: serving cost grows with the training-set size. KD-trees/ball-trees cut it to ~O(log N) in **low** dimensions but degrade to O(N) in high dimensions (curse of dimensionality); approximate NN (HNSW) helps at scale.
- **Space: O(N*d)** — must keep all training data.

**SVM** (N points, d features):
- **Train: O(N^2) to O(N^3)** — the dual optimization works with the N-by-N kernel/Gram matrix, so it scales super-linearly and becomes impractical past ~100k rows. This is the decisive limitation.
- **Predict: O(n_sv * d)** — only the support vectors participate; sparse solutions (few support vectors) predict fast.
- **Space: O(N^2)** for the kernel matrix during training, O(n_sv * d) for the model.

The meta-skill: give train/predict/space, name the *driver* (kNN's per-query scan, SVM's Gram matrix), and state the practical consequence (kNN slow to serve, SVM doesn't scale to large N).

### Q15. How do you structure an algorithm-explanation answer in an interview?

Use a consistent **four-beat skeleton** so you never ramble, and scale the depth to the interviewer's cues:

1. **Objective — what does it optimize?** Open with the one thing it minimizes/maximizes: "Logistic regression minimizes log-loss," "SVM maximizes the margin," "k-means minimizes within-cluster variance." This immediately signals you understand it, not just its API.
2. **Mechanism — how does it optimize that?** The update rule or procedure: "gradient descent on X^T(p-y)," "Lloyd's assign-then-recompute iteration," "greedy impurity-reducing splits." Include the key equation in ASCII if it's a derivation question.
3. **Knobs and cost — what controls it and what does it cost?** The two or three hyperparameters and their bias-variance effect, plus rough complexity: "eta/depth/n_estimators; O(T*N*P*log N), sequential."
4. **Decisive tradeoff — when would you (not) use it?** One crisp line: "great on tabular, but a black box and can't extrapolate."

Extra tactics: **start high-level, then offer to go deeper** ("I can derive the gradient if useful") so you match the interviewer's depth; **use a concrete tiny example** for intuition (lift 1D points to add the kernel trick); and **volunteer the tradeoff** unprompted — it's the senior signal. Objective, mechanism, knobs+cost, tradeoff — that skeleton answers any "explain algorithm X."

### Q16. Explain gradient boosting from scratch as if deriving it on a whiteboard.

**Goal:** build an additive model F(x) = sum_m eta * h_m(x) that minimizes a differentiable loss L(y, F), where each h_m is a weak learner (shallow tree).

**The key insight — it's gradient descent in function space.** Ordinary gradient descent updates parameters: theta <- theta - lr * dL/dtheta. Gradient boosting updates the *function*: at stage m, we want to move F in the direction that most decreases the loss, which is the **negative gradient of the loss w.r.t. the current predictions**:

```
pseudo_residual_i = -[ dL(y_i, F(x_i)) / dF(x_i) ]   evaluated at F = F_{m-1}
```

For squared error L = 0.5*(y - F)^2, this negative gradient is exactly **(y - F)**, the ordinary residual — which is why "boosting fits the residuals" is the MSE special case. For other losses (log-loss, etc.) it's the generalized residual.

**The algorithm:**
1. Initialize F_0 = a constant (e.g. the mean of y, or log-odds for classification).
2. For m = 1..M:
   a. Compute pseudo-residuals r_i = negative gradient at F_{m-1}.
   b. **Fit a weak learner h_m to the pseudo-residuals** (a regression tree predicting r from x).
   c. Update: **F_m = F_{m-1} + eta * h_m**, where eta is the learning rate / shrinkage.
3. Output F_M.

**Why it works:** each tree points the ensemble down the loss gradient, so bias falls monotonically. **eta** shrinks each step for robustness (smaller eta needs more trees); **tree depth** sets the interaction order; regularization / early stopping stops it overfitting. XGBoost refines this with a second-order (Newton) step using the Hessian and an explicit complexity penalty. The one-liner: **gradient boosting is gradient descent in function space, adding one tree per step that fits the negative gradient of the loss.**
