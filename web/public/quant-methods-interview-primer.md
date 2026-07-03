---
type: interview-prep
---

# Quantitative Methods in Finance Interview Primer — 335 Questions

Comprehensive Q+A primer for quantitative-finance interviews — the maths tested at trading firms, hedge funds, and banks for quant, quant-dev, and quant-research roles. The mathematical counterpart to the Finance Domain primer (which is fluency-not-maths for engineers): this one does the maths. Covers probability & statistics, distributions, stochastic processes & Brownian motion, stochastic calculus & Itô's lemma, the time value of money & fixed income, portfolio theory & CAPM, options, the Black-Scholes-Merton model, the Greeks & hedging, risk-neutral pricing & martingales, volatility modeling, numerical methods (Monte Carlo, trees, PDEs), interest-rate models, VaR & risk measures, time series, linear algebra & optimization, statistical arbitrage, and quant brainteasers.

Every answer pairs the formula with intuition — what it means, why it's true, when it breaks — in plain ASCII notation (the reader renders no LaTeX), with step-by-step derivations, worked numeric examples, and numpy-style pseudocode for the numerical methods. Warm-up ("what is a martingale", "put-call parity", "define variance") to senior ("derive the Black-Scholes PDE via delta-hedging", "Girsanov / change of measure intuition", "why does the vol smile exist", "ES vs VaR and coherence", "cointegration-based pairs trade"), plus a full brainteaser round.

1. [[#Probability & Statistics for Finance]]
2. [[#Distributions in Finance]]
3. [[#Stochastic Processes & Brownian Motion]]
4. [[#Stochastic Calculus & Itô's Lemma]]
5. [[#Time Value of Money & Interest Rates]]
6. [[#Fixed Income Analytics]]
7. [[#Portfolio Theory & Optimization]]
8. [[#CAPM & Factor Models]]
9. [[#Options & Derivatives Fundamentals]]
10. [[#The Black-Scholes-Merton Model]]
11. [[#The Greeks & Hedging]]
12. [[#Risk-Neutral Pricing & Martingales]]
13. [[#Volatility Modeling]]
14. [[#Numerical Methods — Monte Carlo]]
15. [[#Numerical Methods — Trees & PDEs]]
16. [[#Interest Rate Models]]
17. [[#Value at Risk & Risk Measures]]
18. [[#Time Series Analysis]]
19. [[#Linear Algebra & Optimization for Quants]]
20. [[#Statistical Arbitrage & Quant Strategies]]
21. [[#Quant Interview Problems & Brainteasers]]

## Probability & Statistics for Finance

### Summary

**What this topic covers**

The probability and statistics toolkit that every quant interview is built on, before a single line of stochastic calculus or option pricing appears. Three concern areas live here: (1) the **first and second moments** — expectation E[X], variance Var(X)=E[X^2]-E[X]^2, higher moments, and how covariance Cov(X,Y) and correlation Corr(X,Y)=Cov(X,Y)/(sigma_X*sigma_Y) glue random variables together into portfolios; (2) the **conditioning machinery** — conditional probability, conditional expectation E[X|Y], the law of iterated expectations E[E[X|Y]]=E[X], Bayes' rule, and independence, which are the language later used for martingales and risk-neutral pricing; and (3) the **inference layer** — the law of large numbers (LLN), the Central Limit Theorem (CLT), estimators and their bias, maximum likelihood estimation (MLE), and basic hypothesis testing. The 16 questions here range from "define variance" warm-ups to "derive the MLE of a Gaussian" and Bayesian brainteasers. Everything downstream — Monte Carlo error bars, VaR, regression betas, the CLT justification for Normal returns — silently rests on this material.

**Mental model**

Think of a random variable as a machine that outputs numbers with a distribution, and think of statistics as running that machine and trying to reverse-engineer its settings. Two mental moves recur. First, **expectation is a linear operator** and variance is not: E[aX+bY]=a*E[X]+b*E[Y] always, but Var(X+Y)=Var(X)+Var(Y)+2*Cov(X,Y), so the cross term (covariance) is where all portfolio diversification lives. Second, **conditioning is just updating your bet as information arrives**: E[X|Y] is itself a random variable (a function of Y), and averaging it back over Y recovers the unconditional mean — that is the law of iterated expectations, the single most-used identity in quant finance. On the inference side, the LLN says averages converge to the truth, and the CLT says the *error* around that truth is Gaussian and shrinks like 1/sqrt(n). Almost every "how accurate is my estimate" question is a CLT question in disguise.

**Key terms**

- **Expectation E[X]** — the probability-weighted average; sum_i p_i*x_i (discrete) or integral x*f(x) dx (continuous).
- **Variance Var(X)** — E[(X-mu)^2] = E[X^2]-E[X]^2; spread in squared units. Standard deviation sigma = sqrt(Var).
- **Covariance Cov(X,Y)** — E[XY]-E[X]E[Y]; sign and scale of co-movement.
- **Correlation Corr(X,Y)** — Cov(X,Y)/(sigma_X*sigma_Y), in [-1,1]; scale-free co-movement.
- **Conditional expectation E[X|Y]** — the best guess of X given Y; a random variable, a function of Y.
- **Law of iterated expectations (tower rule)** — E[E[X|Y]] = E[X]; average the conditional means back out.
- **Bayes' rule** — P(A|B) = P(B|A)*P(A)/P(B); invert a conditional using the prior.
- **Independence** — P(A and B)=P(A)P(B); implies Cov=0, but Cov=0 does NOT imply independence.
- **LLN** — sample mean Xbar_n -> mu as n grows.
- **CLT** — sqrt(n)*(Xbar_n - mu) -> Normal(0, sigma^2); the estimation error is asymptotically Gaussian.
- **Estimator / bias** — a rule that maps data to a guess; bias = E[estimator] - true value.
- **MLE** — the parameter that maximizes the likelihood (probability) of the observed data.

**Why interviewers ask this**

This is the layer that separates candidates who can *manipulate* probability from those who only *recite* it. Junior signal: can you write Var(X)=E[X^2]-E[X]^2 and compute a covariance without stalling? Senior signal: do you instinctively reach for the tower rule to collapse a nested expectation, know that zero correlation is weaker than independence, and can you derive an MLE and state whether it is biased (the Gaussian variance MLE divides by n, not n-1, so it is biased low)? The conditional-expectation questions are the real filter — risk-neutral pricing is *all* conditional expectation, so an interviewer who watches you fumble E[X|Y] knows the stochastic-calculus section will collapse. Bayes and brainteaser questions test whether you can keep base rates straight under pressure, which is exactly the discipline a trader needs when a signal fires.

**Common confusions**

- "Uncorrelated means independent" — false. Corr(X,Y)=0 only kills the *linear* relationship; X and X^2 can be uncorrelated yet perfectly dependent.
- "Variance is linear" — no. Var(aX)=a^2*Var(X), and variance of a sum carries a covariance cross-term.
- "E[X|Y] is a number" — it is a random variable (a function of Y). E[X|Y=y] for a fixed y is a number.
- "The sample variance with 1/n is unbiased" — dividing by n is the MLE and is biased; dividing by n-1 (Bessel's correction) is unbiased.
- "Bigger sample removes bias" — no; more data shrinks *variance* (and the CLT error), but a biased estimator stays biased.
- "The CLT needs the data to be Normal" — no; that is the whole point. Sums of many finite-variance variables become Normal regardless of the underlying shape.

**What follows from this topic**

These primitives feed everything. The CLT is the theoretical license behind modeling returns as Normal and behind Monte Carlo error bars of O(1/sqrt(N)). Conditional expectation and the tower rule become the definition of a martingale and the engine of risk-neutral valuation. Covariance and correlation scale up into the covariance matrix Sigma of portfolio theory, VaR, and PCA. MLE reappears in calibrating GARCH and fitting distributions. If the tower rule or the difference between correlation and independence feels shaky here, patch it before touching stochastic processes — the later material assumes it as reflex.

### Q1. Define expectation and variance, and prove Var(X) = E[X^2] - E[X]^2.

**Expectation** is the probability-weighted average of outcomes: E[X] = sum_i p_i*x_i (discrete) or integral x*f(x) dx (continuous). It is linear: E[aX + bY] = a*E[X] + b*E[Y] for any random variables, independent or not.

**Variance** measures spread around the mean: Var(X) = E[(X - mu)^2], where mu = E[X]. It is in squared units; sigma = sqrt(Var(X)) is the standard deviation.

Proof, expanding the square and using linearity:

```text
Var(X) = E[(X - mu)^2]
       = E[X^2 - 2*mu*X + mu^2]
       = E[X^2] - 2*mu*E[X] + mu^2
       = E[X^2] - 2*mu^2 + mu^2      (since E[X] = mu)
       = E[X^2] - mu^2
       = E[X^2] - E[X]^2
```

Intuition: the "mean of the square" always exceeds the "square of the mean" (Jensen for the convex function x^2), and the gap is exactly the variance.

### Q2. A fair die is rolled. Compute E[X] and Var(X).

Outcomes 1..6, each with probability 1/6.

```text
E[X]   = (1+2+3+4+5+6)/6 = 21/6 = 3.5
E[X^2] = (1+4+9+16+25+36)/6 = 91/6 ≈ 15.1667
Var(X) = E[X^2] - E[X]^2 = 91/6 - (3.5)^2 = 15.1667 - 12.25 = 2.9167
sigma  = sqrt(2.9167) ≈ 1.708
```

Sanity check: the standard deviation ~1.7 is a bit more than a third of the 5-wide range, which is the right ballpark for a roughly flat distribution.

### Q3. Define covariance and correlation. Why is correlation often preferred?

**Covariance** measures the direction and scale of joint movement:

```text
Cov(X,Y) = E[(X - E[X])*(Y - E[Y])] = E[XY] - E[X]*E[Y]
```

Positive means they tend to move together; negative, opposite. But its magnitude depends on the units and volatilities of X and Y, so you cannot compare two covariances directly.

**Correlation** normalizes it into a unit-free number in [-1, 1]:

```text
Corr(X,Y) = Cov(X,Y) / (sigma_X * sigma_Y)
```

Preferred because it is scale-invariant: rescaling X (say, from dollars to cents) leaves Corr unchanged but multiplies Cov by 100. Corr = +1 means a perfect increasing linear relationship, -1 perfect decreasing, 0 no *linear* relationship. In finance, correlation is the input to diversification: a portfolio of two assets has lower variance than the weighted average of their variances whenever their correlation is below 1.

### Q4. If Var(X)=4, Var(Y)=9, and Corr(X,Y)=0.5, what is Var(X+Y)?

Use Var(X+Y) = Var(X) + Var(Y) + 2*Cov(X,Y), with Cov = Corr*sigma_X*sigma_Y.

```text
sigma_X = 2, sigma_Y = 3
Cov(X,Y) = 0.5 * 2 * 3 = 3
Var(X+Y) = 4 + 9 + 2*3 = 19
```

If they were uncorrelated, the answer would be 13; if perfectly correlated (Corr=1), it would be (2+3)^2 = 25. The cross-term is exactly the diversification (or concentration) effect — positive correlation adds risk, negative correlation cancels it.

### Q5. State and explain the law of iterated expectations. Give a finance use.

The **law of iterated expectations** (tower rule) says:

```text
E[ E[X | Y] ] = E[X]
```

E[X|Y] is your refined estimate of X once you know Y; averaging that refined estimate over all values of Y must recover the plain, unconditioned average of X — otherwise knowing Y and then forgetting it would change your belief, which is incoherent.

Concrete example: split analysts into "bullish" (prob 0.4, expected return 8%) and "bearish" (prob 0.6, expected return -2%). Then E[return] = 0.4*8% + 0.6*(-2%) = 3.2% - 1.2% = 2%. You conditioned on the analyst view, then averaged out.

Finance use: it is the backbone of risk-neutral pricing and of any tree/Monte Carlo where you value by stepping back one period at a time — each backward step is a conditional expectation, and the tower rule guarantees the nested steps compose into the correct unconditional price. It also proves that a martingale's expected future value equals its current value.

### Q6. Two coins: one fair, one double-headed. You pick one at random and flip Heads. What is the probability it's the double-headed coin?

Bayes' rule. Let D = double-headed, F = fair, H = observed Heads. Priors P(D)=P(F)=1/2. Likelihoods P(H|D)=1, P(H|F)=1/2.

```text
P(D|H) = P(H|D)*P(D) / [ P(H|D)*P(D) + P(H|F)*P(F) ]
       = (1 * 0.5) / (1 * 0.5 + 0.5 * 0.5)
       = 0.5 / 0.75
       = 2/3
```

Intuition: before flipping, the two coins were equally likely. Heads is twice as likely to come from the double-headed coin (1 vs 1/2), so the posterior tilts 2:1 toward it. If you flipped Heads twice, the update would go to 4/5; a single Tails would immediately prove it is the fair coin (posterior 1).

### Q7. Does zero correlation imply independence? Give a counterexample.

No. Independence implies zero correlation, but not the reverse — correlation only captures *linear* dependence.

Counterexample: let X be Uniform on [-1, 1] and set Y = X^2. Clearly Y is fully determined by X, so they are as dependent as possible. But:

```text
Cov(X,Y) = E[X*X^2] - E[X]*E[X^2]
         = E[X^3] - 0*E[X^2]
         = 0          (E[X^3] = 0 by symmetry, E[X] = 0)
```

So Corr(X,Y) = 0 while Y is a deterministic function of X. The lesson for finance: uncorrelated assets can still crash together (nonlinear tail dependence), which is exactly why correlation-based risk models understate joint tail losses. The one clean case where zero correlation does imply independence is when (X,Y) are *jointly* Normal.

### Q8. State the CLT and explain why it matters in finance.

The **Central Limit Theorem**: if X_1, ..., X_n are i.i.d. with mean mu and finite variance sigma^2, then the standardized sample mean converges to a standard Normal:

```text
sqrt(n) * (Xbar_n - mu) / sigma  ->  N(0, 1)   as n -> infinity
```

Equivalently, Xbar_n is approximately N(mu, sigma^2/n) for large n. The remarkable part: this holds *regardless of the shape* of the underlying distribution, as long as the variance is finite.

Why it matters: (1) it is the theoretical justification for modeling aggregate quantities (e.g., a return that is the sum of many small independent shocks) as Normal; (2) it sets the accuracy of Monte Carlo — the estimation error of a simulated price shrinks like sigma/sqrt(N), i.e. O(1/sqrt(N)), so cutting the error in half needs 4x the paths; (3) it underpins confidence intervals and parametric VaR. The crucial caveat: real returns have *fat tails* and volatility clustering, so the finite-variance i.i.d. assumptions are violated at short horizons — which is precisely why Normal models underestimate crash risk.

### Q9. What is an unbiased estimator? Why does sample variance divide by n-1?

An estimator theta_hat of a parameter theta is **unbiased** if E[theta_hat] = theta — on average, across many samples, it hits the truth. Bias = E[theta_hat] - theta.

The sample mean Xbar is unbiased for mu. But if you plug Xbar into the variance formula, you get a downward bias, because the data hug their *own* sample mean more tightly than the true mean:

```text
E[ (1/n) * sum_i (X_i - Xbar)^2 ] = ((n-1)/n) * sigma^2   (biased low)
```

Dividing by n-1 instead of n exactly corrects this (Bessel's correction):

```text
s^2 = (1/(n-1)) * sum_i (X_i - Xbar)^2,   E[s^2] = sigma^2   (unbiased)
```

Intuition: you "used up" one degree of freedom estimating the mean, so only n-1 independent squared deviations remain. Note this is a deliberate trade — the 1/n version is the MLE and has lower mean-squared error in some cases, so unbiasedness is a choice, not an absolute good.

### Q10. Derive the MLE for the mean of a Normal distribution with known variance.

Given i.i.d. data x_1, ..., x_n from N(mu, sigma^2) with sigma^2 known, the likelihood is the product of the densities:

```text
L(mu) = prod_i (1 / sqrt(2*pi*sigma^2)) * exp( -(x_i - mu)^2 / (2*sigma^2) )
```

Take logs (maximizing log-likelihood is equivalent and easier):

```text
ln L(mu) = const - (1/(2*sigma^2)) * sum_i (x_i - mu)^2
```

Differentiate with respect to mu and set to zero:

```text
d/dmu ln L = (1/sigma^2) * sum_i (x_i - mu) = 0
=> sum_i x_i - n*mu = 0
=> mu_hat = (1/n) * sum_i x_i = Xbar
```

The MLE of the mean is just the sample average — reassuringly. (If sigma^2 were also unknown, its MLE would be (1/n)*sum (x_i - Xbar)^2, which divides by n and is biased low, as in Q9.) MLE is the workhorse for calibrating finance models — GARCH parameters, jump intensities, and copulas are all fit by maximizing likelihood.

### Q11. Explain a hypothesis test at a high level, using a trading-strategy example.

A hypothesis test asks whether an observed effect is real or could plausibly be noise. You set up:

- **Null hypothesis H0** — the skeptical default (e.g., "the strategy's true mean daily return is zero").
- **Alternative H1** — what you hope to show ("mean return > 0").
- **Test statistic** — e.g., t = Xbar / (s / sqrt(n)), the mean return in standard-error units.
- **p-value** — the probability of seeing a statistic this extreme *if H0 were true*. Small p means the data are surprising under the null.

If p is below a chosen significance level alpha (say 0.05), you reject H0. Example: a strategy shows Xbar = 0.05% daily over n = 250 days with s = 0.8%. Then SE = 0.8%/sqrt(250) ≈ 0.0506%, so t ≈ 0.05/0.0506 ≈ 0.99 — not significant, the edge is indistinguishable from noise. Two dangers loom in finance: **Type I error** (false positive — declaring a dead strategy alive) is amplified by **multiple testing** (try 100 strategies and ~5 look "significant" at 5% by pure chance), and short samples give the t-test little power. This is why quants insist on out-of-sample validation.

### Q12. E[X]=0 and Var(X)=1. What can you say about P(|X| >= 2)?

Without knowing the distribution, use **Chebyshev's inequality**, which bounds tail probability by variance alone:

```text
P(|X - mu| >= k*sigma) <= 1 / k^2
```

Here mu = 0, sigma = 1, k = 2:

```text
P(|X| >= 2) <= 1/4 = 0.25
```

So at most 25% of the mass lies beyond two standard deviations — for *any* distribution with unit variance. The bound is loose: if X were actually standard Normal, P(|X| >= 2) ≈ 0.0455, far below 0.25. Chebyshev is the price of assuming nothing about shape. It is the intuition behind why bounding risk with only mean and variance (as parametric VaR does) is conservative for well-behaved distributions but can badly misprice genuinely fat-tailed ones.

### Q13. What is the difference between the LLN and the CLT?

Both describe the sample mean Xbar_n of i.i.d. draws, but they answer different questions.

| | Law of Large Numbers | Central Limit Theorem |
|---|---|---|
| Statement | Xbar_n -> mu | sqrt(n)*(Xbar_n - mu) -> N(0, sigma^2) |
| What it says | the average converges to the truth | the *error* around the truth is Gaussian |
| Scale | Xbar_n stabilizes at a point | fluctuations shrink like sigma/sqrt(n) |
| Gives you | consistency (point estimate is right) | confidence intervals, error bars |

Analogy: the LLN promises that if you flip a fair coin forever, the fraction of heads goes to 0.5. The CLT tells you *how fast* and *how spread out* the fraction is around 0.5 after n flips — roughly Normal with standard deviation 0.5/sqrt(n). In Monte Carlo pricing, the LLN says your simulated price converges to the true price; the CLT gives you the standard error you quote alongside it.

### Q14. E[X]=1, E[Y|X]=2X. Find E[Y].

Straight application of the tower rule:

```text
E[Y] = E[ E[Y|X] ] = E[2X] = 2*E[X] = 2*1 = 2
```

You never needed the joint distribution — conditioning on X, then averaging over X, collapses cleanly. This pattern (compute the inner conditional expectation as a function of the conditioning variable, then take its expectation) is exactly how you evaluate expectations in tree and PDE pricing, and how you show a discounted price process is a martingale.

### Q15. Explain Simpson's paradox and why it matters for interpreting data.

Simpson's paradox: a trend that appears in every subgroup can reverse when the groups are pooled. It arises when a lurking variable is unevenly distributed across groups.

Toy example: strategy A beats strategy B in both a low-volatility regime and a high-volatility regime, yet B beats A overall — because B happened to trade mostly in the favorable regime while A was stuck in the harsh one. The aggregate mixes the regime effect with the strategy effect.

```text
                 Low-vol regime      High-vol regime      Pooled
Strategy A       10% (few trades)    2%  (many trades)    ~3%
Strategy B       9%  (many trades)   1%  (few trades)     ~8%
```

Why it matters: naive pooling of P&L, win rates, or default rates across heterogeneous conditions (regimes, sectors, time periods) can invert the true relationship. The fix is to condition on the confounder — analyze like-for-like, or model the regime explicitly. It is a concrete reminder that E[X] over a mixed population is not the story; E[X | regime] is.

### Q16. You flip a fair coin until the first Heads. What is the expected number of flips?

Let N be the number of flips until (and including) the first Heads. This is Geometric with success probability p = 1/2. The clean way is a one-step recursion on the expectation using conditioning on the first flip:

```text
E[N] = 1 + (1/2)*0 + (1/2)*E[N]
```

Interpretation: you always spend 1 flip. With probability 1/2 you get Heads and stop (0 more flips); with probability 1/2 you get Tails and are back where you started, expecting E[N] more. Solve:

```text
E[N] = 1 + (1/2)*E[N]
(1/2)*E[N] = 1
E[N] = 2
```

So on average 2 flips. General result: for a Geometric with success probability p, E[N] = 1/p. This "condition on the first step and recurse" trick is the seed for the harder expected-flips brainteasers (E[flips to HH] = 6, E[flips to HT] = 4), which trip people up precisely because overlapping patterns break the clean memoryless recursion.

## Distributions in Finance

### Summary

**What this topic covers**

The specific probability distributions a quant must know cold, and — more importantly — *which* distribution fits *which* financial quantity and why. Three concern areas: (1) the **workhorse pair** — the Normal N(mu, sigma^2) for log-returns and the **lognormal** for prices, plus the crucial link that if ln(S) is Normal then S is lognormal, which is why we model stock *prices* as lognormal and *returns* as Normal; (2) the **shape diagnostics** — skewness and kurtosis, excess kurtosis > 0 as the signature of fat tails, and how these numbers expose the ways real returns depart from Normal; and (3) the **realistic distributions and stylized facts** — the Student-t for fat tails, the Poisson for jump counts, and the empirical regularities of asset returns (fat tails, volatility clustering, negative skew, the leverage effect), together with the QQ-plot diagnostic and the central lesson that the Normal distribution *underestimates tail risk*. The 16 questions run from "what are the moments of a Normal" to "why is the equity return distribution negatively skewed" and "read this QQ plot." This topic is where idealized probability meets messy market data.

**Mental model**

Hold two pictures side by side. The **Normal** is the smooth, symmetric bell — fully described by its mean and variance, with tails that decay so fast that a 5-sigma move is essentially impossible (once in ~14,000 years of trading days). It is mathematically gorgeous and empirically wrong in the tails. The **lognormal** is what you get when you exponentiate a Normal: prices can't go negative and percentage changes compound multiplicatively, so log-price is the natural additive quantity — model ln(S) as a Normal random walk and S automatically becomes lognormal, positive and right-skewed. The third picture is the **real return distribution**: more peaked in the middle, with much fatter tails than Normal (excess kurtosis often 3-10+), a left skew in equities, and volatility that clusters in bursts. The mental discipline is to always ask "what does the Normal assumption cost me here?" The answer, almost always, is that it prices tail events as far rarer than they are — which is exactly the risk that blows up trading desks.

**Key terms**

- **Normal N(mu, sigma^2)** — symmetric bell; skewness 0, kurtosis 3; sums of Normals are Normal.
- **Lognormal** — distribution of S when ln(S) ~ Normal; positive, right-skewed; models prices.
- **Log-return** — ln(S_t / S_{t-1}); additive over time, modeled as Normal.
- **Skewness** — third standardized moment; asymmetry. Negative = long left tail.
- **Kurtosis** — fourth standardized moment; tail heaviness. Normal = 3.
- **Excess kurtosis** — kurtosis - 3; > 0 means fatter-than-Normal tails (leptokurtic).
- **Fat tails (leptokurtosis)** — extreme moves far more likely than Normal predicts.
- **Student-t** — bell-shaped but fat-tailed; degrees of freedom nu controls tail weight.
- **Poisson** — count of rare events (jumps) in an interval; single parameter lambda.
- **Volatility clustering** — big moves follow big moves; volatility is autocorrelated.
- **Leverage effect** — volatility rises when prices fall; drives negative skew in equities.
- **QQ plot** — quantiles of data vs a reference distribution; fat tails bend the ends off the line.

**Why interviewers ask this**

The lognormal-vs-Normal question is a rite of passage — it tests whether you understand *why* Black-Scholes models prices as lognormal (positive, multiplicative) rather than Normal, and whether you can keep "returns Normal / prices lognormal" straight under pressure. Getting it backwards is a hard fail. Beyond that, this topic separates the candidate who memorized "returns are Normal" from the one who *knows it is a convenient lie* and can enumerate exactly how real returns violate it: fat tails, negative skew, vol clustering. That second candidate is the one you trust to build a risk model, because they will not be blindsided when a 6-sigma day arrives (as it does every few years). Interviewers also probe the practical consequence: if you price options assuming Normal returns, you systematically misprice out-of-the-money options — which is the empirical origin of the volatility smile.

**Common confusions**

- "Stock returns are lognormal" — no; stock *prices* are lognormal, *returns* (log-returns) are Normal. It is the exponential that flips one into the other.
- "Fat tails mean higher volatility" — not necessarily; fat tails are about the *shape* (kurtosis), not the overall spread. A fat-tailed distribution can have the same variance as a Normal but far more extreme outliers.
- "Kurtosis measures peakedness" — the modern view is that kurtosis is driven overwhelmingly by the *tails*, not the central peak.
- "Skewness of returns is positive because stocks go up" — equity *returns* are typically *negatively* skewed (crashes are sharp, rallies are gradual).
- "Normal is fine because of the CLT" — the CLT needs finite variance and i.i.d.; at short horizons returns are neither, so tails stay fat.
- "A lognormal can be negative" — never; exp() is always positive, which is the whole point for prices.

**What follows from this topic**

Getting distributions right is the bridge to pricing and risk. The lognormal price model is the terminal distribution of geometric Brownian motion, which is the engine of Black-Scholes — S_T = S_0*exp((mu - sigma^2/2)*T + sigma*W_T) is lognormal by construction. Fat tails and negative skew are the empirical facts that break the constant-volatility Black-Scholes world and *create* the volatility smile and skew. Kurtosis and the failure of Normal tails motivate the entire risk-management apparatus — VaR, Expected Shortfall, stress testing — and the search for better models (Student-t, jump-diffusion, stochastic volatility). Volatility clustering is exactly what GARCH is built to capture in the time-series topic. If you internalize *how* real returns depart from Normal here, the rest of the primer's "why doesn't the simple model work" questions answer themselves.

### Q1. State the key properties of the Normal distribution.

The Normal N(mu, sigma^2) has density:

```text
f(x) = (1 / (sigma*sqrt(2*pi))) * exp( -(x - mu)^2 / (2*sigma^2) )
```

Core properties:

- **Two parameters fully describe it**: mean mu (location) and variance sigma^2 (spread). All higher moments are determined.
- **Symmetric** about mu: skewness = 0, and kurtosis = 3 (excess kurtosis 0) by definition.
- **68-95-99.7 rule**: ~68% of mass within 1 sigma, ~95% within 2 sigma, ~99.7% within 3 sigma.
- **Closed under linear combinations**: if X ~ N(mu_X, sigma_X^2) and Y ~ N(mu_Y, sigma_Y^2) are jointly Normal, then aX + bY is Normal. Sums of Normals stay Normal.
- **Thin tails**: density decays like exp(-x^2), so extreme moves are astronomically rare — a 5-sigma event has probability ~3e-7.

That last property is both its charm and its downfall in finance: real markets deliver 5-sigma moves far more often than "once every 14,000 years," which is the entire motivation for fat-tailed alternatives.

### Q2. Why do we model stock prices as lognormal but returns as Normal?

Two reasons, and they are the same reason viewed differently.

**Prices can't be negative, and change multiplicatively.** A stock at 100 can go to 200 or to 50 — proportional moves, not additive. So the natural additive quantity is the *log* price. Model the log-return ln(S_t / S_{t-1}) as Normal (a sum of many small independent shocks, CLT-flavored), and log-prices follow a Normal random walk.

**Exponentiating a Normal gives a lognormal.** If ln(S_T) is Normal, then S_T = exp(Normal) is by definition **lognormal** — necessarily positive and right-skewed:

```text
ln(S_T / S_0) ~ Normal   <=>   S_T is lognormal
S_T = S_0 * exp( (mu - sigma^2/2)*T + sigma*W_T )
```

Consequences: (1) prices stay positive, matching reality (a Normal price model would allow negative prices); (2) returns are symmetric and additive, so they aggregate cleanly across time; (3) the right skew of the lognormal reflects that a stock can rise unboundedly but only fall to zero. This is exactly the terminal distribution under geometric Brownian motion, and it is why Black-Scholes lives in log-space.

### Q3. Define skewness and kurtosis. What are their values for a Normal?

Both are *standardized* moments — dimensionless shape descriptors after centering and scaling by sigma.

**Skewness** is the third standardized moment — asymmetry:

```text
Skew = E[ (X - mu)^3 ] / sigma^3
```

Positive skew = long right tail (occasional big gains); negative skew = long left tail (occasional big losses). Symmetric distributions have skew 0.

**Kurtosis** is the fourth standardized moment — tail heaviness:

```text
Kurt = E[ (X - mu)^4 ] / sigma^4
```

For the Normal, **Skew = 0 and Kurt = 3**. Because 3 is the benchmark, people report **excess kurtosis = Kurt - 3**; excess > 0 (leptokurtic) means fatter tails than Normal, excess < 0 (platykurtic) means thinner. Equity returns typically show negative skew and excess kurtosis of several units — the quantitative fingerprint of "crashes are sharp and fat tails are real."

### Q4. What are fat tails, and why does the Normal distribution underestimate tail risk?

**Fat tails** (leptokurtosis) means extreme outcomes occur far more often than a Normal with the same variance would predict. The distribution has more mass in the far tails (and often a sharper central peak), giving excess kurtosis > 0.

Why the Normal understates risk: its tails decay like exp(-x^2/2), which is extraordinarily fast. Under a Normal, a daily move beyond 5 sigma should happen roughly once in 14,000 years. Empirically, equity indices deliver such moves every few years — October 1987 was a ~20-sigma event under a Normal, which the model says is impossible many times over the age of the universe.

The practical cost: any risk measure built on Normality — parametric VaR = z*sigma*sqrt(h)*V, for instance — will systematically report the odds of a catastrophic loss as far lower than reality. Portfolios that look "safe" at 99% VaR can still be exposed to devastating 99.9% tail events. This single fact drives the shift toward fat-tailed models (Student-t, jump-diffusion), Expected Shortfall over VaR, and mandatory stress testing.

### Q5. Compare the Student-t distribution with the Normal. Why is it used in finance?

The **Student-t** is a symmetric bell like the Normal but with a single extra knob — degrees of freedom nu — that controls tail fatness.

| | Normal | Student-t |
|---|---|---|
| Tails | thin, exp(-x^2) decay | fat, power-law decay |
| Kurtosis | 3 (excess 0) | > 3; grows as nu shrinks |
| Parameter for tails | none | nu (degrees of freedom) |
| Limit | — | -> Normal as nu -> infinity |
| Extreme-move odds | tiny | materially higher |

As nu decreases, the tails get fatter; for nu <= 4 the kurtosis is infinite, and for nu <= 2 the variance is infinite. Around nu = 4-6 the shape matches empirical daily equity returns reasonably well.

Why finance uses it: it captures fat tails with just one extra parameter, so VaR and option models built on a Student-t assign realistic (non-negligible) probability to crashes. It is a minimal, tractable upgrade over the Normal — you keep symmetry and a closed form but stop pretending extreme moves can't happen. Its main limitation: plain Student-t is still symmetric, so it does not capture the negative skew of equity returns without further extension.

### Q6. What is the leverage effect, and how does it relate to skewness?

The **leverage effect** is the empirical tendency for volatility to rise when prices fall, and to fall (or rise less) when prices climb — volatility and returns are negatively correlated.

The classic mechanical story: as a firm's equity value drops, its debt-to-equity ratio (leverage) rises, making the equity riskier and hence more volatile. In practice the effect is larger than leverage alone explains, so "volatility feedback" and panic-selling dynamics also contribute.

Link to skewness: because down-moves are accompanied by *increased* volatility, the left tail of the return distribution gets stretched — losses cluster and amplify, while up-moves come with calmer markets. The result is **negative skew** in equity index returns: sharp, violent drawdowns versus slower grinding rallies ("stocks take the stairs up and the elevator down"). This is also why equity implied-volatility surfaces show a downward *skew* — out-of-the-money puts (crash protection) trade at higher implied vol than out-of-the-money calls, pricing in exactly this asymmetric tail risk.

### Q7. List the main stylized facts of asset returns.

The empirical regularities that show up across markets, assets, and eras — and that any serious model must confront:

- **Fat tails (leptokurtosis)** — extreme returns far more frequent than Normal predicts; excess kurtosis positive.
- **Volatility clustering** — large moves follow large moves, calm follows calm; volatility is highly autocorrelated even though returns themselves are nearly uncorrelated.
- **Negative skew (equities)** — crashes are sharper than rallies; the return distribution has a long left tail.
- **Leverage effect** — volatility rises when prices fall (negative return-vol correlation).
- **Near-zero autocorrelation of returns** — raw returns are almost unpredictable (weak-form efficiency), yet *squared* or *absolute* returns are strongly autocorrelated (that's the vol clustering).
- **Aggregational Gaussianity** — as you lengthen the horizon (daily -> monthly -> yearly), the return distribution looks progressively more Normal, as the CLT slowly kicks in.
- **Gain/loss asymmetry** — large drawdowns are observed over shorter timescales than equally large gains.

The through-line: returns are approximately unpredictable in *sign* but highly structured in *magnitude*. Models that ignore this (constant-volatility Normal) misprice tails and options; GARCH, stochastic volatility, and jump models exist to capture these facts.

### Q8. What is a QQ plot, and how do you read one for fat tails?

A **QQ (quantile-quantile) plot** graphs the quantiles of your data against the quantiles of a reference distribution (usually the Normal). If the data truly follow the reference, the points fall on a straight 45-degree line.

Reading the deviations:

```text
     data
   quantile
      |            . .   <- upper tail bends UP above the line
      |         .
      |      .
      |   .              <- middle sits on the line
      | .
      .                  <- lower tail bends DOWN below the line
      +----------------- theoretical (Normal) quantile
```

- **Fat tails**: the plot is S-shaped (or has upturned/downturned ends) — the low quantiles fall *below* the line and the high quantiles rise *above* it. The data's extremes are more extreme than the Normal predicts.
- **Negative skew**: the plot is asymmetric — the lower (left) tail deviates more than the upper.
- **Straight line**: the Normal fit is good.

For daily equity returns you almost always see the fat-tail S-shape: the tails peel away from the Normal line, a visual confirmation of positive excess kurtosis. It is the quickest diagnostic in a quant's toolkit for "is Normality reasonable here?" — and the answer, for short-horizon returns, is reliably no.

### Q9. What is the Poisson distribution and where do jumps come in?

The **Poisson** distribution counts the number of rare, independent events in a fixed interval, with a single rate parameter lambda:

```text
P(N = k) = exp(-lambda) * lambda^k / k!,   k = 0, 1, 2, ...
E[N] = Var(N) = lambda
```

A hallmark is that its mean equals its variance, both lambda.

In finance it models the *arrival of jumps* — sudden discontinuous moves from news, earnings surprises, central-bank shocks, or crashes that a continuous diffusion cannot produce. In a **jump-diffusion** model (Merton), the price follows geometric Brownian motion *plus* a compound-Poisson jump term: between jumps it diffuses smoothly, and jumps arrive at Poisson rate lambda with random sizes:

```text
dS/S = mu*dt + sigma*dW + (jump term arriving at Poisson rate lambda)
```

Adding Poisson jumps injects exactly the fat tails and (with negatively-biased jump sizes) the negative skew that pure Gaussian diffusion lacks. It is one of the standard fixes for the volatility smile — jumps make out-of-the-money options more valuable, matching observed prices.

### Q10. Given daily returns with mean 0.05% and daily vol 1%, what is the annualized volatility?

Assuming i.i.d. returns, variance scales linearly with time, so volatility scales with the square root of time. With ~252 trading days per year:

```text
sigma_annual = sigma_daily * sqrt(252)
             = 1% * sqrt(252)
             = 1% * 15.87
             ≈ 15.9%
```

The mean annualizes linearly (0.05% * 252 ≈ 12.6%), but volatility annualizes by sqrt(252) because independent variances add. This sqrt(t) scaling is the same rule behind Brownian motion's sqrt(t) spread and is a constant fixture of quant mental math — the handy shortcut is sqrt(252) ≈ 16, so "1% daily vol ≈ 16% annual vol." The caveat: sqrt(t) scaling assumes i.i.d. returns; with volatility clustering and autocorrelation, realized multi-day vol departs from the naive sqrt(t) extrapolation.

### Q11. Why does the sum of independent Normal returns stay Normal, and what does that imply for horizon scaling?

The Normal family is **closed under addition of independent members**: if X ~ N(mu_1, sigma_1^2) and Y ~ N(mu_2, sigma_2^2) are independent, then:

```text
X + Y ~ N( mu_1 + mu_2,  sigma_1^2 + sigma_2^2 )
```

Means add, and *variances* add (not standard deviations). You can prove it via moment-generating functions: the MGF of a Normal is exp(mu*t + sigma^2*t^2/2), and the MGF of an independent sum is the product, which is again a Normal MGF.

Implication for horizon scaling: if daily log-returns are i.i.d. N(mu, sigma^2), then the h-day return is a sum of h of them, so:

```text
h-day return ~ N( h*mu,  h*sigma^2 )
mean scales like h,  volatility scales like sqrt(h)
```

This is the mathematical basis for the sqrt(t) volatility rule and for the "square-root-of-time" VaR scaling. It also explains **aggregational Gaussianity**: even if single-period returns are somewhat non-Normal, summing many of them pulls the aggregate toward Normal via the CLT — which is why monthly and annual returns look more Gaussian than daily ones.

### Q12. What is the mean and variance of a lognormal, given ln(S) ~ N(mu, sigma^2)?

If ln(S) ~ N(mu, sigma^2), then S is lognormal, and its moments are *not* simply exp(mu) — the convexity of exp adds a variance correction:

```text
E[S]   = exp( mu + sigma^2 / 2 )
Var(S) = exp( 2*mu + sigma^2 ) * ( exp(sigma^2) - 1 )
```

The key subtlety is the **+sigma^2/2** in the mean. Because exp is convex, Jensen's inequality gives E[exp(X)] > exp(E[X]) — the mean of the price sits *above* exp of the mean log-price. This is exactly why, under geometric Brownian motion, the log-price drifts at (mu - sigma^2/2) even though the price grows at rate mu:

```text
S_T = S_0 * exp( (mu - sigma^2/2)*T + sigma*W_T )
E[S_T] = S_0 * exp(mu*T)     (the -sigma^2/2 and +sigma^2/2 cancel)
```

The sigma^2/2 term is the single most common place candidates slip — forgetting it makes the drift of the log inconsistent with the growth rate of the price. It is a direct consequence of Ito's lemma applied to ln(S), which the stochastic-calculus topic derives in full.

### Q13. Interpreter check: a return series has skewness -0.8 and excess kurtosis 5. Describe the distribution and its risk implications.

The two numbers together paint a clear picture.

**Skewness -0.8** (negative, moderate): the distribution is asymmetric with a longer, heavier *left* tail. Large losses are more extreme (though not necessarily more frequent) than large gains — the classic equity signature of sharp crashes versus gradual rallies.

**Excess kurtosis 5** (kurtosis 8, well above the Normal's 3): decidedly fat-tailed (leptokurtic). Extreme moves in *both* directions occur far more often than a Normal with the same variance would allow, and the center is likely more peaked.

Risk implications:

- A Normal-based VaR will **badly understate** the probability and size of large losses — the true left tail is both fatter (kurtosis) and heavier (negative skew).
- You should prefer **Expected Shortfall** (which averages over the tail) to VaR (a single quantile), because ES captures how bad the losses are *beyond* the threshold.
- Consider a fat-tailed, skewable model — a skewed Student-t, or a jump-diffusion — for pricing and risk.
- Option-implied volatility will show a **negative skew** (out-of-the-money puts richer), consistent with the negative return skew.

In one line: this is a realistic equity return series, and any Gaussian model applied to it is quietly mispricing the downside.

### Q14. Why do longer-horizon returns look more Normal than daily returns?

Because of **aggregational Gaussianity**, a direct consequence of the CLT. A monthly return is (approximately) the sum of ~21 daily log-returns; an annual return is the sum of ~252. Summing many finite-variance shocks pulls the aggregate distribution toward Normal, washing out the fat tails and skew visible at the daily frequency.

```text
daily return  = one noisy, fat-tailed, skewed shock
monthly return = sum of ~21 daily shocks   -> closer to Normal
annual return  = sum of ~252 daily shocks  -> closer still to Normal
```

The caveats matter, though: the CLT convergence assumes the shocks are roughly i.i.d. with finite variance. Real returns have **volatility clustering** (dependence) and near-infinite-variance tails in stress periods, so the convergence is slow and incomplete — even monthly returns retain some excess kurtosis. And during a crash, the "sum of many small independent shocks" picture collapses into "one giant correlated shock," so long-horizon returns can still deliver fat left tails. The practical takeaway: Normality is a *better* approximation at longer horizons but never an exact one, and it fails precisely when it matters most.

### Q15. Why is the sum of lognormal variables not lognormal, and why does this complicate basket pricing?

The lognormal family is **not closed under addition**. If A and B are lognormal (i.e. ln(A) and ln(B) are Normal), then A + B has no lognormal distribution — because the log of a sum is not the sum of logs, so ln(A + B) is not Normal. Contrast this with the Normal family, which *is* closed under addition, and with lognormals under *multiplication* (a product of lognormals is lognormal, since logs add).

```text
Normal:     X, Y Normal      =>  X + Y   Normal        (closed)
Lognormal:  A, B lognormal   =>  A * B   lognormal      (closed, logs add)
Lognormal:  A, B lognormal   =>  A + B   NOT lognormal  (logs don't add)
```

Why it complicates finance: a basket or index is a *sum* (weighted) of individual stock prices. If each stock is lognormal under Black-Scholes, the basket is a sum of lognormals, so it is **not** lognormal — and there is no exact closed-form Black-Scholes formula for a basket or Asian option (which averages prices, also a sum). Practitioners resort to approximations (moment-matching to a lognormal, e.g. matching the first two moments) or Monte Carlo. The same non-closure is why an arithmetic-average Asian option has no clean formula while a geometric-average one does (a product of lognormals stays lognormal). It is a recurring trap: "everything is lognormal" breaks the moment you add rather than multiply.

### Q16. X ~ N(0,1). Compute E[e^X] and connect it to the lognormal mean.

e^X is lognormal (the exponential of a Normal), so this computes the mean of a lognormal. Use the Normal moment-generating function E[e^(t*X)] = exp(t*mu + t^2*sigma^2/2), here with mu = 0, sigma = 1, t = 1:

```text
E[e^X] = exp( 0 + 1^2 * 1 / 2 ) = exp(1/2) ≈ 1.6487
```

The striking part: even though X has mean 0, e^X has mean e^(1/2) ≈ 1.65, well above 1 = e^0. That gap is **Jensen's inequality** in action — exp is convex, so E[exp(X)] > exp(E[X]). The excess exactly equals the sigma^2/2 in the exponent.

This is the same sigma^2/2 that appears everywhere in GBM. If ln(S_T/S_0) ~ N(m, s^2), then E[S_T/S_0] = exp(m + s^2/2); to make the expected gross return exp(mu*T), the log-drift m must be (mu - sigma^2/2)*T — the drift is *lowered* by sigma^2/2 to compensate for the convexity boost of exponentiating. The general rule to memorize: for Z ~ N(0,1) and any constant a, E[exp(a*Z)] = exp(a^2/2). It is the workhorse behind computing Black-Scholes expectations by hand.

## Stochastic Processes & Brownian Motion

### Summary

**What this topic covers**

The continuous-time probability that turns "returns are random" into a precise mathematical object you can do calculus on. Three concern areas: (1) the **random walk to continuous limit** — how discrete coin-flip walks scale, under sqrt(t), into a continuous process, and why that limit is the natural model for prices; (2) the **Wiener process (Brownian motion) W_t** and its defining properties — W_0 = 0, independent stationary Gaussian increments W_t - W_s ~ N(0, t-s), continuous paths that are nowhere differentiable, and quadratic variation equal to t; and (3) the **structural properties that matter for pricing** — the martingale property E[X_t | F_s] = X_s and why it is the mathematical heart of "no free lunch," the Markov property, and geometric Brownian motion dS = mu*S*dt + sigma*S*dW as the standard price model, decomposed into a deterministic drift and a random diffusion. The 16 questions run from "what is a martingale" and "define Brownian motion" to "why is W_t nowhere differentiable" and "solve the GBM SDE." This is the launchpad for Ito's lemma and Black-Scholes — you cannot price a derivative without first knowing what W_t *is*.

**Mental model**

Picture a drunkard taking a coin-flip step every instant. Zoom out and speed up the flips while shrinking the steps in the right proportion — each step of size sqrt(dt) in time dt — and the jagged walk converges to **Brownian motion**: a continuous, infinitely wiggly path whose position at time t is Normal with variance t. That sqrt(t) scaling (not t) is the signature of diffusion and the reason volatility scales with sqrt(time). The path is continuous — no jumps — yet so rough that it has *no derivative anywhere*: over any interval, however tiny, it wiggles infinitely, so "velocity" is undefined. This is why you can't write dW/dt and why ordinary calculus fails, forcing the Ito calculus. The second mental move is to split any price process into two parts: a **drift** (mu*S*dt, the predictable trend) and a **diffusion** (sigma*S*dW, the random shock). A **martingale** is the special case of pure diffusion with zero drift — a "fair game" where the best forecast of tomorrow is today's value. Risk-neutral pricing is exactly the trick of changing the drift so discounted prices become martingales.

**Key terms**

- **Random walk** — discrete sum of i.i.d. steps; S_n = sum of n +/-1 flips.
- **Wiener process / Brownian motion W_t** — the continuous limit; the canonical source of randomness.
- **Independent increments** — W_t - W_s is independent of the path up to time s.
- **Stationary increments** — the distribution of W_t - W_s depends only on t - s.
- **W_t - W_s ~ N(0, t-s)** — increments are Gaussian with variance equal to elapsed time.
- **Nowhere differentiable** — continuous paths with no well-defined slope at any point.
- **Quadratic variation** — sum of squared increments over [0,t] converges to t (not 0).
- **Filtration F_s** — the information available up to time s; "what you know now."
- **Martingale** — E[X_t | F_s] = X_s; a fair game, best forecast is the current value.
- **Markov property** — the future depends only on the present state, not the full history.
- **Geometric Brownian motion (GBM)** — dS = mu*S*dt + sigma*S*dW; the standard price model.
- **Drift vs diffusion** — the deterministic mu-term vs the random sigma*dW-term.

**Why interviewers ask this**

This is the gateway to everything quantitative. An interviewer probing Brownian motion is checking whether you can reason in continuous time at all — a prerequisite for Ito's lemma, the Black-Scholes PDE, and risk-neutral valuation. The martingale question is the sharpest filter: a candidate who can state E[X_t | F_s] = X_s *and explain why it encodes "no arbitrage"* is thinking like a derivatives quant; one who only recites the formula is not. The "why is W_t nowhere differentiable / what is (dW)^2" questions test whether you understand *why* a special calculus is needed — the answer, quadratic variation, is the seed of the entire Ito toolkit. And GBM is the model you will reference in every pricing question, so getting the drift/diffusion decomposition and the sqrt(t) scaling instant-fast is table stakes. Senior candidates connect these dots: martingale -> risk-neutral measure -> Girsanov -> Black-Scholes.

**Common confusions**

- "Brownian motion is differentiable somewhere" — no; it is continuous *everywhere* and differentiable *nowhere*. Continuity and differentiability are different properties.
- "Variance of W_t is sigma*t" — for standard Brownian motion Var(W_t) = t; the standard deviation is sqrt(t). The sigma comes in when you scale it.
- "A martingale must have zero mean" — it must have constant *conditional* expectation equal to the current value; E[X_t] = X_0, which need not be zero.
- "Independent increments means the process values are independent" — no; W_t and W_s are correlated (Cov(W_s, W_t) = min(s,t)); it's the *increments* over disjoint intervals that are independent.
- "(dW)^2 is negligible like (dt)^2" — the opposite: (dW)^2 = dt is first-order and cannot be dropped; that is the crux of Ito calculus.
- "Markov and martingale are the same" — Markov is about *dependence on history*; martingale is about the *expected value* being flat. A process can be one without the other.

**What follows from this topic**

Brownian motion is the atom from which the rest of continuous-time finance is built. The quadratic-variation rule (dW)^2 = dt is precisely the ingredient that makes Ito's lemma differ from ordinary calculus, and applying Ito to ln(S) under GBM yields the lognormal price distribution of the previous topic. The martingale property becomes the definition of the risk-neutral measure Q — the fundamental theorem of asset pricing says no-arbitrage is equivalent to the existence of a measure under which discounted prices are martingales, and Girsanov's theorem is the tool that changes the drift from mu to r to get there. GBM is the price dynamics plugged into the Black-Scholes PDE. Master this topic and the pricing sections read as applications; skip it and they read as magic.

### Q1. What is a Wiener process (Brownian motion)? State its defining properties.

A **Wiener process** (standard Brownian motion) W_t is the canonical continuous-time random process, defined by four properties:

1. **W_0 = 0** — it starts at the origin.
2. **Independent increments** — for any 0 <= s < t, the increment W_t - W_s is independent of the entire history up to time s.
3. **Stationary Gaussian increments** — W_t - W_s ~ N(0, t - s): Normally distributed, mean 0, and variance equal to the elapsed time. In particular W_t ~ N(0, t).
4. **Continuous paths** — the function t -> W_t is continuous (almost surely), with no jumps.

```text
W_0 = 0
W_t - W_s ~ N(0, t-s)   for s < t
Var(W_t) = t,  so std dev = sqrt(t)
Cov(W_s, W_t) = min(s, t)
```

Two facts every quant memorizes: the variance grows *linearly* in time (so the spread grows like sqrt(t)), and despite being continuous, the paths are **nowhere differentiable** — infinitely wiggly at every scale. Brownian motion is the building block: every diffusion model, including GBM and Black-Scholes, is driven by dW.

### Q2. Why is Brownian motion continuous but nowhere differentiable?

**Continuous** because increments over small time steps are small: W_t - W_s ~ N(0, t-s) has standard deviation sqrt(t-s), which goes to 0 as t -> s. So the path has no jumps.

**Nowhere differentiable** because the increment scales like sqrt(dt), not dt. Consider the difference quotient over a step dt:

```text
(W_{t+dt} - W_t) / dt   has std dev   sqrt(dt) / dt = 1 / sqrt(dt)
```

As dt -> 0, that blows up to infinity. The path moves by sqrt(dt) in time dt — infinitely faster than the linear dt that a derivative would require. So the "slope" is undefined at every point: over any interval, no matter how small, the path oscillates infinitely and has infinite total variation.

Intuition: a differentiable curve looks like a straight line when you zoom in enough. Brownian motion looks *equally jagged at every zoom level* (statistical self-similarity) — it never smooths out. This roughness is not a technicality; it is exactly why dW cannot be treated as dt, why (dW)^2 = dt survives to first order, and why finance needs Ito calculus instead of ordinary calculus.

### Q3. What is the quadratic variation of Brownian motion, and why does it matter?

**Quadratic variation** is the limit of the sum of squared increments as you partition [0, t] into ever-finer pieces:

```text
QV = lim  sum_i ( W_{t_{i+1}} - W_{t_i} )^2  =  t
```

Remarkably, this does *not* go to zero (as it would for a smooth function) — it converges to t. The heuristic: each increment W_{t_{i+1}} - W_{t_i} has variance (t_{i+1} - t_i), so E[(increment)^2] = (t_{i+1} - t_i), and summing gives t; the variance of the sum vanishes, so the limit is deterministic.

This is the rigorous meaning of the shorthand rule:

```text
(dW)^2 = dt,   dt*dW = 0,   (dt)^2 = 0
```

Why it matters: this single fact is what makes Ito calculus differ from ordinary calculus. When you Taylor-expand a function f(W_t), the second-order term (1/2)*f''*(dW)^2 does NOT vanish — it becomes (1/2)*f''*dt, a first-order contribution. That surviving term is the "Ito correction" and is the source of the -sigma^2/2 drift adjustment in log-prices, the extra term in Ito's lemma, and ultimately the structure of the Black-Scholes PDE. A smooth function has zero quadratic variation; Brownian motion's non-zero QV is what breaks the chain rule.

### Q4. Define a martingale and explain why it matters in finance.

A stochastic process X_t is a **martingale** (with respect to a filtration F_t representing available information) if:

```text
E[ X_t | F_s ] = X_s   for all s < t
```

In words: given everything you know up to time s, your best forecast of the future value X_t is simply the current value X_s. There is no predictable drift — it is a "fair game." (Two technical conditions also hold: E[|X_t|] is finite, and X_t is adapted to F_t.)

Why it matters in finance: a martingale is the mathematical form of **no arbitrage / no free lunch**. If a discounted price were a *submartingale* (expected to rise), you could earn a riskless expected profit; if a supermartingale, you could short it. The **fundamental theorem of asset pricing** states that a market is arbitrage-free *if and only if* there exists a probability measure (the risk-neutral measure Q) under which all discounted asset prices are martingales. Pricing then reduces to taking an expectation under Q:

```text
V_0 = exp(-r*T) * E^Q[ payoff ]
```

The whole machinery of risk-neutral valuation, replication, and Girsanov's change of measure exists to *construct* the martingale measure. Note a martingale is not required to have zero value — just constant conditional expectation; E[X_t] = X_0 for all t.

### Q5. Is Brownian motion a martingale? What about W_t^2?

**W_t is a martingale.** Using independent increments, condition on the information up to s:

```text
E[ W_t | F_s ] = E[ W_s + (W_t - W_s) | F_s ]
              = W_s + E[ W_t - W_s ]      (increment independent of F_s)
              = W_s + 0                    (increment has mean 0)
              = W_s
```

So the best forecast of future Brownian motion is its current value — it is a fair game.

**W_t^2 is NOT a martingale.** Compute its conditional expectation:

```text
E[ W_t^2 | F_s ] = E[ (W_s + (W_t - W_s))^2 | F_s ]
                = W_s^2 + 2*W_s*E[W_t - W_s] + E[(W_t - W_s)^2]
                = W_s^2 + 0 + (t - s)
                = W_s^2 + (t - s)   >  W_s^2
```

It drifts upward by (t - s) — it is a *submartingale*. But notice that **W_t^2 - t** IS a martingale, since E[W_t^2 - t | F_s] = W_s^2 + (t-s) - t = W_s^2 - s. This is a compact restatement of quadratic variation: subtracting the "clock" t exactly compensates the systematic growth. Spotting the compensator that turns a process into a martingale is a core quant skill (it is what risk-neutral discounting does for prices).

### Q6. Distinguish the Markov property from the martingale property.

They describe different things and neither implies the other.

**Markov property** — the future depends only on the *present state*, not the full history:

```text
P( X_t in A | F_s ) = P( X_t in A | X_s )
```

The path taken to reach X_s is irrelevant; the current position summarizes everything needed to predict the future. It is a statement about *what information is relevant*.

**Martingale property** — the *expected* future value equals the current value:

```text
E[ X_t | F_s ] = X_s
```

It is a statement about the *drift* being zero (a fair game).

| | Markov | Martingale |
|---|---|---|
| About | dependence on history | expected future value |
| Says | future needs only present state | best forecast is current value |
| Example that is one but not the other | GBM with drift (Markov, not martingale) | some path-dependent fair games |

Brownian motion is *both*. Geometric Brownian motion with positive drift is Markov (its future depends only on current S) but *not* a martingale (it is expected to grow at rate mu). The distinction matters: risk-neutral pricing needs the *martingale* property (achieved by changing the drift to r), while the Markov property is what lets us price with a PDE in the current state variables alone.

### Q7. Write the SDE for geometric Brownian motion and interpret each term.

**Geometric Brownian motion** is the standard model for a positive asset price:

```text
dS = mu*S*dt + sigma*S*dW
```

Dividing by S makes the interpretation crisp — it is a statement about *returns*:

```text
dS/S = mu*dt + sigma*dW
```

- **mu*dt** — the **drift**: the deterministic, predictable part. mu is the expected instantaneous return per unit time; over dt the price is expected to grow by mu*S*dt.
- **sigma*dW** — the **diffusion**: the random shock. sigma is the volatility, and dW is the Brownian increment (~ N(0, dt)). This term has mean zero, so it adds no expected return but all the risk.

Both terms are proportional to S, which is the "geometric" part: a 100 stock and a 1000 stock have the same *percentage* dynamics, so the model is scale-free and — crucially — keeps S positive (the shocks are multiplicative, not additive). Contrast with arithmetic Brownian motion dS = mu*dt + sigma*dW, where the drift and shock are absolute, allowing S to go negative. GBM's return-based form is exactly why it produces a lognormal price distribution and underpins Black-Scholes.

### Q8. Solve the GBM SDE to get S_T explicitly.

Start from dS = mu*S*dt + sigma*S*dW and apply Ito's lemma to f = ln(S). The Ito correction is what makes this different from ordinary calculus. With f_S = 1/S, f_SS = -1/S^2:

```text
d(ln S) = f_S*dS + (1/2)*f_SS*(dS)^2
        = (1/S)*(mu*S*dt + sigma*S*dW) + (1/2)*(-1/S^2)*(sigma^2*S^2*dt)
        = mu*dt + sigma*dW - (1/2)*sigma^2*dt
        = (mu - sigma^2/2)*dt + sigma*dW
```

using (dS)^2 = sigma^2*S^2*dt (from (dW)^2 = dt). So ln(S) is arithmetic Brownian motion with drift (mu - sigma^2/2). Integrating from 0 to T:

```text
ln(S_T) - ln(S_0) = (mu - sigma^2/2)*T + sigma*W_T
S_T = S_0 * exp( (mu - sigma^2/2)*T + sigma*W_T )
```

Since W_T ~ N(0, T), ln(S_T) is Normal, so **S_T is lognormal**. The famous **-sigma^2/2** term is the Ito correction: it is why the *log-price* drifts slower than mu even though E[S_T] = S_0*exp(mu*T) (the +sigma^2/2 from the lognormal mean exactly cancels it). Forgetting this term is the single most common GBM mistake.

### Q9. Show that under GBM, E[S_T] = S_0 * exp(mu*T).

From the solution S_T = S_0 * exp( (mu - sigma^2/2)*T + sigma*W_T ), take the expectation. The only random part is exp(sigma*W_T), and W_T ~ N(0, T), so we need the mean of a lognormal — use E[exp(a*Z)] = exp(a^2/2) for Z ~ N(0,1), or directly the MGF of a Normal:

```text
E[ exp(sigma*W_T) ] = exp( (1/2)*sigma^2*T )     (since W_T ~ N(0, T))
```

Therefore:

```text
E[S_T] = S_0 * exp( (mu - sigma^2/2)*T ) * E[ exp(sigma*W_T) ]
       = S_0 * exp( (mu - sigma^2/2)*T ) * exp( (1/2)*sigma^2*T )
       = S_0 * exp( mu*T )
```

The -sigma^2/2 in the exponent and the +sigma^2/2 from the lognormal mean cancel exactly, leaving clean exponential growth at rate mu. This is the reassuring check: even though the *median* of S_T is S_0*exp((mu - sigma^2/2)*T) (below the mean, because the lognormal is right-skewed), the *mean* grows at the full drift rate mu. The gap between mean and median is the volatility drag — a real effect, e.g. why a volatile asset with zero mean log-return still has positive expected price but a median that erodes.

### Q10. Explain why prices scale with sqrt(t), using Brownian motion.

Because Brownian motion has variance proportional to *time*, its *standard deviation* — the typical size of a move — is proportional to the *square root* of time:

```text
W_t ~ N(0, t)   =>   Var(W_t) = t   =>   std dev(W_t) = sqrt(t)
```

So over an interval of length t, the typical displacement of Brownian motion is sqrt(t), not t. Doubling the horizon does not double the expected move — it multiplies it by sqrt(2) ≈ 1.41.

For asset prices, the diffusion term sigma*dW inherits this: the standard deviation of the log-return over horizon t is sigma*sqrt(t). That is precisely the volatility-scaling rule from the distributions topic:

```text
sigma over horizon t  =  sigma_per_unit_time * sqrt(t)
sigma_annual = sigma_daily * sqrt(252)   (~16 * sigma_daily)
```

Why sqrt and not linear? Because Brownian increments over disjoint intervals are *independent*, so their *variances* add (linear in t), and standard deviation is the square root of variance. If the increments were perfectly correlated (a deterministic trend), the move would scale linearly with t instead. The sqrt(t) law is the fingerprint of accumulated independent randomness, and it shows up everywhere: option time value, VaR horizon scaling, and the width of Monte Carlo confidence intervals.

### Q11. What is a filtration, and why is it needed to define a martingale?

A **filtration** F_t is a growing family of information sets: F_s is contained in F_t for s < t, representing "everything observable up to time t." As time passes you learn more and never forget, so the information only accumulates. Formally it is an increasing sequence of sigma-algebras, but the intuition is simply *the information available at each moment*.

It is essential to the martingale definition because a martingale is a statement about a *conditional* expectation:

```text
E[ X_t | F_s ] = X_s
```

The condition "| F_s" means "given all information available at time s." Without specifying *what you know*, the conditional expectation — and hence "fair game" — is undefined. The same process can be a martingale with respect to one filtration and not another, depending on what information is included.

This matters in pricing because the risk-neutral valuation formula V_0 = exp(-r*T)*E^Q[payoff] is really a conditional expectation given today's information F_0, and as time passes the option value V_t = exp(-r*(T-t))*E^Q[payoff | F_t] updates as F_t grows. A process must also be **adapted** to the filtration (its value at time t is known given F_t) — you cannot trade on information you do not yet have, which rules out look-ahead and is the formal guardrail against cheating in backtests.

### Q12. Contrast arithmetic and geometric Brownian motion for modeling prices.

Two candidate price models, differing in whether the drift and volatility are absolute or proportional.

| | Arithmetic BM | Geometric BM |
|---|---|---|
| SDE | dS = mu*dt + sigma*dW | dS = mu*S*dt + sigma*S*dW |
| Solution | S_T = S_0 + mu*T + sigma*W_T | S_T = S_0*exp((mu - sigma^2/2)*T + sigma*W_T) |
| Distribution of S_T | Normal | Lognormal |
| Can go negative? | Yes | No |
| Moves are | absolute (dollar) | proportional (percentage) |
| Volatility | constant in dollar terms | constant in percentage terms |

**Geometric Brownian motion wins for equities**: (1) prices stay positive (you cannot lose more than 100%); (2) percentage returns, not dollar changes, are what is stationary in markets — a 1% move means the same thing at 100 or at 1000; (3) it yields the lognormal terminal distribution that matches the "returns Normal, prices lognormal" fact and powers Black-Scholes.

Arithmetic BM is not useless — it is a reasonable model for quantities that *can* legitimately go negative or that move in absolute terms: interest rate *spreads*, some spread/basis trades, and (with mean reversion added) short rates in the Vasicek model. Choosing the right one is about respecting the sign and scale behavior of the quantity you are modeling.

### Q13. A stock follows GBM. Write pseudocode to simulate one price path.

Discretize the exact GBM solution over steps of size dt — using the *exact* lognormal step avoids discretization drift error. Each step multiplies by exp((mu - sigma^2/2)*dt + sigma*sqrt(dt)*Z) with Z standard Normal:

```python
import numpy as np

def simulate_gbm_path(S0, mu, sigma, T, n_steps):
    dt = T / n_steps
    path = np.empty(n_steps + 1)
    path[0] = S0
    drift = (mu - 0.5 * sigma**2) * dt      # Ito-corrected log drift
    diffusion = sigma * np.sqrt(dt)         # sqrt(dt) scaling of the shock
    for i in range(1, n_steps + 1):
        Z = np.random.standard_normal()     # one N(0,1) shock per step
        path[i] = path[i-1] * np.exp(drift + diffusion * Z)
    return path

# Example: S0=100, mu=8%/yr, sigma=20%/yr, 1 year, daily steps
p = simulate_gbm_path(100, 0.08, 0.20, 1.0, 252)
```

Key points an interviewer looks for: (1) the **-0.5*sigma^2** Ito correction in the log drift — omitting it biases the path upward; (2) the **sqrt(dt)** scaling on the shock, the Brownian signature; (3) one fresh independent N(0,1) draw per step (independent increments); (4) using exp() so the price stays positive. To price an option you would simulate many such paths, take the payoff at T (or along the path for path-dependent options), average, and discount by exp(-r*T) — with r replacing mu under the risk-neutral measure. The Monte Carlo error shrinks like O(1/sqrt(N)) in the number of paths.

### Q14. Interview brainteaser: Brownian motion starts at 0. What is the probability it is positive at time t=1? And what is E[W_1 | W_2 = x]?

**Part 1 — P(W_1 > 0).** Since W_1 ~ N(0, 1), it is symmetric about 0, so:

```text
P(W_1 > 0) = 1/2
```

By symmetry there is exactly a 50% chance of being above the starting point — no drift means no directional bias.

**Part 2 — E[W_1 | W_2 = x].** Use the fact that for a Brownian bridge / jointly Normal increments, the conditional expectation is linear. Intuitively, W_1 is "halfway" to W_2 in time, and with W_0 = 0 the best linear interpolation is:

```text
E[W_1 | W_2 = x] = (1/2) * x
```

Derivation via the jointly-Normal projection formula E[W_1 | W_2] = Cov(W_1,W_2)/Var(W_2) * W_2, with Cov(W_1, W_2) = min(1,2) = 1 and Var(W_2) = 2:

```text
E[W_1 | W_2 = x] = (1 / 2) * x = x/2
```

The interpolation is linear in time because Brownian increments are independent and Gaussian — given the endpoints, the expected midpoint sits proportionally between them. (The conditional *variance* is not zero: Var(W_1 | W_2) = 1 - 1^2/2 = 1/2, the Brownian bridge still fluctuates around the interpolated mean.) This linear-interpolation-plus-bridge-noise picture is the basis of the Brownian bridge construction used in variance-reduction for Monte Carlo.

### Q15. Compute the covariance Cov(W_s, W_t) of a Wiener process.

Take s < t and split W_t into the part up to s plus the later increment: W_t = W_s + (W_t - W_s). Then use bilinearity of covariance:

```text
Cov(W_s, W_t) = Cov( W_s, W_s + (W_t - W_s) )
             = Cov(W_s, W_s) + Cov( W_s, W_t - W_s )
             = Var(W_s) + 0
             = s
```

The second term is zero because the increment (W_t - W_s) over [s, t] is independent of W_s (independent increments), so their covariance vanishes. For general times the result is:

```text
Cov(W_s, W_t) = min(s, t)
```

Two lessons. First, the process values *are* correlated even though the increments are not — Corr(W_s, W_t) = min(s,t)/sqrt(s*t) = sqrt(s/t) for s < t, which is large for nearby times and decays as the times separate. Second, the min(s,t) covariance function is the defining "kernel" of Brownian motion; it is exactly what you would supply to a Gaussian-process description of W_t, and it reappears when constructing the Brownian bridge and in the covariance of discretized paths used in simulation.

### Q16. Show that M_t = exp(sigma*W_t - 0.5*sigma^2*t) is a martingale.

This is the **stochastic (Doléans) exponential** — the single most important martingale in pricing, because it is the density that changes measure in Girsanov's theorem. To check the martingale property, condition on F_s (s < t) and split off the independent increment:

```text
E[ M_t | F_s ] = E[ exp(sigma*W_t - 0.5*sigma^2*t) | F_s ]
             = exp(-0.5*sigma^2*t) * exp(sigma*W_s) * E[ exp(sigma*(W_t - W_s)) | F_s ]
```

The increment W_t - W_s ~ N(0, t-s) is independent of F_s, and E[exp(sigma*Z)] = exp(0.5*sigma^2*(t-s)) for that Normal:

```text
E[ exp(sigma*(W_t - W_s)) ] = exp( 0.5*sigma^2*(t - s) )

E[ M_t | F_s ] = exp(-0.5*sigma^2*t) * exp(sigma*W_s) * exp(0.5*sigma^2*(t-s))
             = exp( sigma*W_s - 0.5*sigma^2*s )
             = M_s
```

So E[M_t | F_s] = M_s — a martingale. Intuition: exp(sigma*W_t) alone drifts upward (its expectation grows like exp(0.5*sigma^2*t) by Jensen), and the deterministic term -0.5*sigma^2*t is *exactly* the compensator that cancels that drift, leaving a fair game. This is the same -sigma^2/2 correction as in GBM, and it is why the discounted stock price exp(-r*t)*S_t is a martingale under the risk-neutral measure. Recognizing the compensator that turns exp(sigma*W_t) into a martingale is the conceptual seed of Girsanov and risk-neutral valuation.
## Stochastic Calculus & Itô's Lemma

### Summary

**What this topic covers**

The calculus you need to actually derive Black-Scholes rather than just quote it. Three concern areas: (1) **why ordinary calculus breaks** for functions of Brownian motion — the sample paths of W_t are continuous but nowhere differentiable, so `dW/dt` does not exist and Riemann-Stieltjes integration fails; (2) the **Itô integral** and its multiplication table (`(dW)^2 = dt`, `dt^2 = 0`, `dt*dW = 0`) — the single algebraic fact that everything else falls out of; (3) **Itô's lemma** — the stochastic chain rule — and its two canonical applications: `f = ln(S)` (which solves geometric Brownian motion and produces the lognormal distribution of prices), and the derivation of the drift/diffusion of any derivative V(t,S), which feeds straight into the Black-Scholes PDE. The 16 questions run from "what is quadratic variation" up to "derive the SDE for S^2 and check it's a martingale under the right drift". Master this and BSM, risk-neutral pricing, and the Greeks stop being memorised and start being derived.

**Mental model**

Think of an SDE `dS = mu*S*dt + sigma*S*dW` as shorthand for an integral equation: `S_T = S_0 + integral_0^T mu*S dt + integral_0^T sigma*S dW`. The first integral is ordinary (pathwise Riemann); the second is the Itô integral, defined as a limit of left-point sums `sum sigma(t_i)*(W_{t_{i+1}} - W_{t_i})`. The "left-point" choice is not cosmetic — it makes the integral a martingale (non-anticipating), which is why finance uses Itô rather than Stratonovich. The one thing that makes stochastic calculus different from ordinary calculus: over a small step dt, `dW ~ sqrt(dt)` in size, so `(dW)^2 ~ dt` is first-order, NOT negligible. In ordinary calculus you Taylor-expand and drop second-order terms; here the second-order term in dW survives and becomes a first-order dt term. That surviving term is the entire content of Itô's lemma — the extra `0.5*sigma^2*S^2*f_SS*dt` drift correction. Everything downstream (the `-sigma^2/2` in the lognormal drift, the theta term in the BSM PDE) is this one correction.

**Key terms**

- **Wiener process / Brownian motion (W_t)** — W_0 = 0, independent increments, W_t - W_s ~ N(0, t-s), continuous paths, nowhere differentiable.
- **Itô integral** — integral_0^T H_t dW_t, defined as an L2 limit of LEFT-endpoint Riemann sums; a martingale when H is adapted and square-integrable.
- **Adapted / non-anticipating** — the integrand at time t uses only information up to t (the filtration F_t); required for the martingale property.
- **Itô's lemma** — the stochastic chain rule: for f(t, S) with dS = a*dt + b*dW, `df = (f_t + a*f_S + 0.5*b^2*f_SS)*dt + b*f_S*dW`.
- **Itô correction** — the extra `0.5*b^2*f_SS*dt` term that ordinary calculus does not have; comes from `(dW)^2 = dt`.
- **Quadratic variation** — [W]_T = limit of sum (W_{t_{i+1}} - W_{t_i})^2 = T (not zero); the reason Itô calculus exists.
- **Geometric Brownian motion (GBM)** — dS = mu*S*dt + sigma*S*dW; solution S_T = S_0*exp((mu - sigma^2/2)*T + sigma*W_T).
- **Lognormal** — if ln(S) is Normal then S is lognormal; GBM makes prices lognormal and log-returns Normal.
- **Multiplication rules** — (dW)^2 = dt, dt^2 = 0, dt*dW = 0; the whole Itô toolkit.
- **Martingale** — E[X_t | F_s] = X_s for s <= t; a driftless Itô process (only a dW term) is a local martingale.
- **Stratonovich integral** — the midpoint alternative that obeys ordinary chain rule; not used for pricing because it is not a martingale.

**Why interviewers ask this**

This is the single strongest signal that separates "read a finance book" from "can do quant work". A junior candidate quotes Itô's lemma; a strong candidate can tell you *why* the `0.5*sigma^2*S^2*f_SS` term is there (because (dW)^2 = dt is order dt, not order dt^2) and can rederive `d(ln S)` on the whiteboard without notes. Interviewers probe: can you get the sign and coefficient of the Itô correction right? Do you understand that `E[W_T] = 0` but `E[W_T^2] = T`? Can you explain why S is lognormal but returns are Normal? These are the mechanical skills that every subsequent derivation — BSM PDE, risk-neutral drift = r, the Greeks — is built from. Getting Itô right early tells the interviewer the rest of the pricing conversation can go fast.

**Common confusions**

- "dW/dt is the derivative of Brownian motion" — it does not exist; W_t is nowhere differentiable. That is precisely why we need a new integral.
- "(dW)^2 is negligible like dx^2 in ordinary calculus" — no. (dW)^2 = dt is first-order and is the whole point.
- "The stock drifts at mu, so ln(S) drifts at mu too" — wrong; ln(S) drifts at mu - sigma^2/2. The gap is the Itô correction.
- "mu - sigma^2/2 is a risk-neutral thing" — no, it appears under any measure; it is a pure calculus fact from Itô, independent of pricing.
- "E[S_T] = S_0*exp((mu - sigma^2/2)*T)" — wrong; that is exp(median). E[S_T] = S_0*exp(mu*T); the -sigma^2/2 is exactly cancelled by Jensen convexity of exp.
- "Itô and Stratonovich give the same answer" — different drift terms; finance uses Itô for the martingale property.

**What follows from this topic**

Itô's lemma is the engine room. Applying it to a derivative V(t,S) and eliminating the dW term by delta-hedging *is* the Black-Scholes PDE derivation. The lognormal solution of GBM is what you integrate to get the BSM closed form and what you step forward in Monte Carlo (`S_{t+dt} = S_t*exp((r - sigma^2/2)*dt + sigma*sqrt(dt)*Z)`). The martingale property of the driftless Itô integral is the mathematical content of risk-neutral valuation and Girsanov's theorem (change of measure shifts the drift, leaves the sigma*dW alone). Quadratic variation reappears as realized variance in the volatility topic. If Brownian motion, martingales, or GBM feel shaky, review the Probability and Stochastic Processes topics first.

### Q1. What is a Wiener process (Brownian motion), and why is it the building block of continuous-time finance?

A **Wiener process** W_t is the continuous-time limit of a symmetric random walk. Four defining properties:

```text
1. W_0 = 0
2. Independent increments: W_t - W_s independent of the past (of F_s), for s < t
3. Gaussian increments: W_t - W_s ~ N(0, t - s)   (mean 0, variance = elapsed time)
4. Continuous sample paths (but nowhere differentiable)
```

**Intuition.** Over a horizon T the displacement W_T ~ N(0, T), so typical size is sqrt(T) — Brownian motion spreads like sqrt(time), the diffusion signature. Increments are independent (Markov, memoryless) and stationary. It is the unique continuous process with independent Gaussian increments, which is why it is the canonical noise source: the Central Limit Theorem forces the limit of any well-behaved random walk to be Gaussian, so W_t is the natural continuous driver. Asset models bolt drift and scale onto it: `dS = mu*S*dt + sigma*S*dW`. The catch that makes new calculus necessary: paths are continuous but so jagged that dW/dt is undefined everywhere.

### Q2. Why can't we use ordinary calculus on functions of Brownian motion? What is quadratic variation?

Ordinary calculus assumes a smooth path where, over a small step, the change is order dt and (change)^2 is negligible (order dt^2). Brownian motion violates this: over dt the move dW is order sqrt(dt), so (dW)^2 is order dt — first order, not negligible.

**Quadratic variation** makes this precise. Partition [0,T] into n pieces and sum squared increments:

```text
[W]_T = lim_{n->inf} sum_{i} (W_{t_{i+1}} - W_{t_i})^2

Each term ~ N(0, dt) squared, so E[(dW)^2] = dt.
Summing n = T/dt terms:  E[ sum (dW)^2 ] = n*dt = T.
The variance of the sum -> 0, so the limit is the constant T (not random).
```

So `[W]_T = T`. For a smooth function the quadratic variation is 0 (squared increments are order dt^2, sum to 0). Brownian motion has *finite non-zero* quadratic variation and *infinite* first variation (total path length). That single fact — squared increments accumulate to real time — is why we get the extra Itô term and why `(dW)^2 = dt` as a differential rule.

### Q3. State the Itô multiplication rules and justify them.

```text
(dW)^2 = dt
dt*dW  = 0
dt^2   = 0
```

**Justification (heuristic, but the right one).**

- `(dW)^2 = dt`: from quadratic variation, sum of (dW)^2 converges to elapsed time; E[(dW)^2] = dt and the fluctuation around dt vanishes in the limit, so in the dt-algebra (dW)^2 behaves as the deterministic quantity dt.
- `dt*dW = 0`: dt is order 1, dW is order sqrt(dt), so the product is order dt^1.5 — smaller than dt, drop it.
- `dt^2 = 0`: order dt^2, smaller than dt, drop it.

Rule of thumb for sizing: **keep everything up to order dt**. Since dW ~ sqrt(dt), that means keep dt, dW, and (dW)^2 = dt, but discard dt*dW and dt^2. These three rules are the complete toolkit — every Itô calculation is just Taylor-expanding and applying this table.

### Q4. State Itô's lemma for f(t, S) where dS = mu*S*dt + sigma*S*dW, and derive it.

**Itô's lemma:**

```text
df = ( f_t + mu*S*f_S + 0.5*sigma^2*S^2*f_SS ) dt  +  sigma*S*f_S dW
```

where f_t = df/dt, f_S = df/dS, f_SS = d^2f/dS^2.

**Derivation.** Taylor-expand f(t + dt, S + dS) to second order:

```text
df = f_t*dt + f_S*dS + 0.5*f_SS*(dS)^2 + (higher order, dropped)

Compute (dS)^2 with the multiplication rules:
(dS)^2 = (mu*S*dt + sigma*S*dW)^2
       = mu^2*S^2*dt^2 + 2*mu*sigma*S^2*dt*dW + sigma^2*S^2*(dW)^2
       = 0            + 0                       + sigma^2*S^2*dt
       = sigma^2*S^2*dt

Substitute dS and (dS)^2:
df = f_t*dt + f_S*(mu*S*dt + sigma*S*dW) + 0.5*f_SS*sigma^2*S^2*dt

Collect dt and dW terms:
df = ( f_t + mu*S*f_S + 0.5*sigma^2*S^2*f_SS ) dt + sigma*S*f_S dW
```

The extra `0.5*sigma^2*S^2*f_SS*dt` — the **Itô correction** — is what ordinary calculus (which would give only `f_t*dt + f_S*dS`) misses. It comes entirely from (dW)^2 = dt surviving the expansion.

### Q5. Apply Itô's lemma to f = ln(S) with dS = mu*S*dt + sigma*S*dW. Why does the -sigma^2/2 appear?

Take f(S) = ln(S). Then f_t = 0, f_S = 1/S, f_SS = -1/S^2.

```text
d(ln S) = ( 0 + mu*S*(1/S) + 0.5*sigma^2*S^2*(-1/S^2) ) dt + sigma*S*(1/S) dW
        = ( mu - sigma^2/2 ) dt + sigma dW
```

**Why the -sigma^2/2.** ln is a concave function (f_SS < 0). Over each step the price can go up or down; because ln is concave, an up-move gains less log than a down-move loses (log penalises volatility). The Itô term `0.5*f_SS*sigma^2*S^2 = -0.5*sigma^2` is exactly this concavity penalty — the average drag that volatility imposes on the log price. So although S drifts at mu, its logarithm drifts more slowly, at mu - sigma^2/2. This is pure calculus, true under any measure; it is not a risk-neutrality assumption.

### Q6. Solve the GBM SDE. Show S_T is lognormal.

From Q5, d(ln S) = (mu - sigma^2/2)*dt + sigma*dW has *constant* coefficients, so it integrates trivially:

```text
integral_0^T d(ln S) = integral_0^T (mu - sigma^2/2) dt + integral_0^T sigma dW

ln(S_T) - ln(S_0) = (mu - sigma^2/2)*T + sigma*(W_T - W_0)
ln(S_T) = ln(S_0) + (mu - sigma^2/2)*T + sigma*W_T

Exponentiate:
S_T = S_0 * exp( (mu - sigma^2/2)*T + sigma*W_T )
```

Since W_T ~ N(0, T), the exponent is Normal:

```text
ln(S_T) ~ N( ln(S_0) + (mu - sigma^2/2)*T ,  sigma^2*T )
```

ln(S_T) Normal means **S_T is lognormal**. This is why quant models put prices as lognormal (always positive, multiplicative) and log-returns as Normal (additive, symmetric). Note you cannot solve GBM by naive integration of dS = mu*S*dt + sigma*S*dW as if it were an ODE `S = S_0*exp(mu*T + ...)` — you must go through ln(S) with Itô, which is exactly what produces the -sigma^2/2.

### Q7. E[S_T] = ? Reconcile it with the -sigma^2/2 in the exponent.

```text
S_T = S_0 * exp( (mu - sigma^2/2)*T + sigma*W_T )

For a Normal X ~ N(m, v):  E[exp(X)] = exp(m + v/2)   (lognormal mean formula)

Here X = (mu - sigma^2/2)*T + sigma*W_T, with
  m = (mu - sigma^2/2)*T,   v = sigma^2*T

E[S_T] = S_0 * exp( (mu - sigma^2/2)*T + 0.5*sigma^2*T )
       = S_0 * exp( mu*T )
```

**The reconciliation.** The -sigma^2/2 in the exponent and the +sigma^2/2 from the lognormal mean formula (Jensen / convexity of exp) cancel exactly, leaving **E[S_T] = S_0*exp(mu*T)** — the price grows at the full drift mu in expectation. The -sigma^2/2 term describes the *median/typical* path (exp of the mean log), which lies below the mean because the lognormal is right-skewed. So: mean grows at mu, median grows at mu - sigma^2/2. A classic interview trap is to quote the median as the mean.

### Q8. Why is the Itô integral defined with left-endpoints, and why does that make it a martingale?

The Itô integral is `integral_0^T H_t dW_t = lim sum H(t_i)*(W_{t_{i+1}} - W_{t_i})` — the integrand is evaluated at the **left** endpoint t_i of each interval.

**Why left.** At t_i, H(t_i) is known (adapted / non-anticipating) and independent of the future increment (W_{t_{i+1}} - W_{t_i}), which has mean 0. Therefore each term has conditional expectation zero:

```text
E[ H(t_i)*(W_{t_{i+1}} - W_{t_i}) | F_{t_i} ] = H(t_i) * E[W_{t_{i+1}} - W_{t_i} | F_{t_i}] = H(t_i)*0 = 0
```

Summing, the running integral has zero conditional expected increment, so it is a **martingale**: E[integral | F_s] = value at s. Financially, this is the "you cannot bet on information you do not yet have" condition — the trading gain from a self-financing strategy is a martingale under the right measure, which is the backbone of no-arbitrage pricing. The **Stratonovich** integral uses the midpoint, obeys the ordinary chain rule, but is *not* a martingale — so finance uses Itô.

### Q9. Is Brownian motion a martingale? Is W_t^2? Is exp(sigma*W_t - 0.5*sigma^2*t)?

**W_t is a martingale.** E[W_t | F_s] = E[W_s + (W_t - W_s) | F_s] = W_s + 0 = W_s (independent increment with mean 0).

**W_t^2 is NOT a martingale** — it has positive drift. By Itô with f = x^2 (f_x = 2x, f_xx = 2), dW_t^2 = 2*W_t*dW + dt. The +dt drift means E[W_t^2] = t is increasing. But **W_t^2 - t IS a martingale** (subtracting the compensator removes the drift). This -t compensator is quadratic variation again.

**exp(sigma*W_t - 0.5*sigma^2*t) IS a martingale** — the **exponential martingale** (stochastic exponential). Check with Itô, f = exp(sigma*W - 0.5*sigma^2*t):

```text
df = f_t*dt + f_W*dW + 0.5*f_WW*dt
   = (-0.5*sigma^2)f*dt + sigma*f*dW + 0.5*sigma^2*f*dt
   = sigma*f*dW           (drift terms cancel)
```

Pure dW, no drift, so it is a martingale. The -0.5*sigma^2*t is precisely the correction that kills the drift E[exp(sigma*W_t)] = exp(0.5*sigma^2*t) would otherwise carry. This object is the Radon-Nikodym derivative in Girsanov's change of measure.

### Q10. Compute E[W_t^2], E[W_t^4], and E[W_s*W_t]. 

Using W_t ~ N(0, t):

```text
E[W_t]   = 0
E[W_t^2] = Var(W_t) = t
E[W_t^4] = 3*t^2        (for N(0,v), 4th moment = 3*v^2; kurtosis of Normal = 3)
```

For the **covariance** with s < t, split W_t = W_s + (W_t - W_s):

```text
E[W_s*W_t] = E[W_s*(W_s + (W_t - W_s))]
           = E[W_s^2] + E[W_s]*E[W_t - W_s]    (independence of the increment)
           = s + 0
           = s = min(s, t)
```

So **Cov(W_s, W_t) = min(s, t)** — a standard result. Correlation = min(s,t)/sqrt(s*t) = sqrt(s/t) for s < t. These moments are exactly what you use to compute E and Var of Itô integrals and to price variance-based payoffs.

### Q11. Use the Itô isometry to compute Var( integral_0^T sigma dW ).

The **Itô isometry** turns the variance of a stochastic integral into an ordinary integral of the squared integrand:

```text
E[ ( integral_0^T H_t dW_t )^2 ] = integral_0^T E[H_t^2] dt
```

(The integral has mean 0 since it is a martingale, so this second moment IS the variance.) For a constant integrand H_t = sigma:

```text
Var( integral_0^T sigma dW ) = integral_0^T sigma^2 dt = sigma^2 * T
```

Consistent with `integral_0^T sigma dW = sigma*W_T ~ N(0, sigma^2*T)`. The isometry is the workhorse for computing variances of hedging errors and simulated payoffs: cross terms E[dW_i * dW_j] vanish for i != j (independent increments), so only the diagonal `integral E[H^2] dt` survives — the continuous analogue of "variance of a sum of independent terms is the sum of variances".

### Q12. Derive the SDE for V = S^2 where dS = mu*S*dt + sigma*S*dW.

Apply Itô's lemma with f(S) = S^2: f_t = 0, f_S = 2S, f_SS = 2.

```text
dV = ( f_t + mu*S*f_S + 0.5*sigma^2*S^2*f_SS ) dt + sigma*S*f_S dW
   = ( 0 + mu*S*(2S) + 0.5*sigma^2*S^2*(2) ) dt + sigma*S*(2S) dW
   = ( 2*mu + sigma^2 )*S^2 dt + 2*sigma*S^2 dW
   = ( 2*mu + sigma^2 )*V dt + 2*sigma*V dW
```

So S^2 is itself a GBM with drift (2*mu + sigma^2) and vol 2*sigma. The extra +sigma^2 in the drift is the Itô term (f_SS = 2 > 0, convex function, so volatility *adds* drift here — opposite sign to the concave ln case). Sanity check: E[S_T^2] = S_0^2*exp((2*mu + sigma^2)*T), which matches computing the second moment of the lognormal directly. This "derive the SDE for g(S)" is a staple whiteboard question; the recipe is always: identify f_S and f_SS, plug into the lemma, collect terms.

### Q13. What is Girsanov's theorem in intuitive terms, and how does it relate to Itô?

**Girsanov's theorem** says you can change the probability measure (from the real-world P to the risk-neutral Q) in a way that **shifts the drift of the process but leaves the volatility term unchanged**. Under P, `dS = mu*S*dt + sigma*S*dW^P`. Girsanov lets you rewrite this as `dS = r*S*dt + sigma*S*dW^Q`, where `dW^Q = dW^P + ((mu - r)/sigma)*dt` is a Brownian motion under Q. The quantity (mu - r)/sigma is the **market price of risk** you absorb into the drift.

```text
Under P (real world):  dS = mu*S*dt + sigma*S*dW^P
Under Q (risk-neutral): dS = r *S*dt + sigma*S*dW^Q      (drift mu -> r, sigma untouched)
```

**Relation to Itô.** The change-of-measure density is the exponential martingale from Q9, `exp(-lambda*W_t - 0.5*lambda^2*t)` with lambda = (mu-r)/sigma — and you verify it is a valid density (a martingale with mean 1) using Itô. Intuitively: since only the drift moves and the sigma*dW part is untouched, and since drift doesn't affect the *quadratic variation*, the volatility sigma is measure-invariant. That is why you can estimate sigma from data but must use r (not mu) for pricing — the pillar of risk-neutral valuation.

### Q14. Sketch how Itô's lemma leads to the Black-Scholes PDE (the delta-hedge argument).

Let V(t, S) be an option price. Apply Itô:

```text
dV = ( V_t + mu*S*V_S + 0.5*sigma^2*S^2*V_SS ) dt + sigma*S*V_S dW
```

Form a hedged portfolio: long one option, short V_S = Delta units of stock: Pi = V - V_S*S.

```text
dPi = dV - V_S*dS
    = ( V_t + 0.5*sigma^2*S^2*V_SS ) dt + sigma*S*V_S dW  -  V_S*(mu*S*dt + sigma*S*dW)
    = ( V_t + 0.5*sigma^2*S^2*V_SS ) dt        (the dW terms and the mu*S*V_S dt CANCEL)
```

The dW (and mu) vanish — the portfolio is **instantaneously riskless**, so by no-arbitrage it must earn the risk-free rate: dPi = r*Pi*dt = r*(V - V_S*S)*dt. Equate:

```text
V_t + 0.5*sigma^2*S^2*V_SS = r*(V - S*V_S)
=> V_t + 0.5*sigma^2*S^2*V_SS + r*S*V_S - r*V = 0
```

That is the **Black-Scholes PDE**. Note mu disappeared — the expected return of the stock does not enter the option price. Itô's lemma supplied the dV expression; delta-hedging killed the randomness; no-arbitrage supplied the r. The Derivatives Pricing / BSM topic solves this PDE for the closed form.

### Q15. What is the difference between an Itô process being a "local martingale" versus a true martingale, and why does a quant care?

An Itô process with no dt term, `dX = H_t*dW`, is always a **local martingale** — locally driftless. It is a **true martingale** (E[X_t | F_s] = X_s globally) only if the integrand is well-behaved enough, e.g. `E[integral_0^T H_t^2 dt] < infinity` (or the Novikov condition for exponential martingales).

**Why a quant cares.** Pricing by discounted expectation, `V_0 = exp(-r*T)*E^Q[payoff]`, relies on the discounted price being a *true* martingale, not merely local. If it is only a local martingale, the "expected value = current price" identity can fail and you get **strict local martingales** — the source of asset-price bubbles in some models and of mispricings when a naive Monte Carlo integrand has heavy tails. In practice: (1) check integrability before trusting a martingale pricing argument; (2) the Novikov condition E[exp(0.5*integral lambda^2 dt)] < inf is what guarantees Girsanov's density is a true martingale so the measure change is legitimate. This is the kind of rigor that distinguishes a quant researcher from someone who only manipulates formulas.

### Q16. Discretise GBM for Monte Carlo. Why use the exact log scheme rather than the naive Euler step?

**Naive Euler** on dS = mu*S*dt + sigma*S*dW:

```text
S_{t+dt} = S_t + mu*S_t*dt + sigma*S_t*sqrt(dt)*Z,   Z ~ N(0,1)
```

This can produce **negative prices** (a large negative Z overshoots) and only converges with O(dt) bias. **Exact log scheme** discretises d(ln S) = (mu - sigma^2/2)*dt + sigma*dW, which has constant coefficients, so it is exact over any step:

```text
S_{t+dt} = S_t * exp( (mu - sigma^2/2)*dt + sigma*sqrt(dt)*Z )
```

```python
import numpy as np
def gbm_paths(S0, mu, sigma, T, steps, n):
    dt = T / steps
    Z = np.random.standard_normal((n, steps))
    logdrift = (mu - 0.5 * sigma**2) * dt
    incr = logdrift + sigma * np.sqrt(dt) * Z
    logpaths = np.log(S0) + np.cumsum(incr, axis=1)
    return np.exp(logpaths)   # always positive; exact GBM marginals
```

**Advantages.** (1) Prices stay strictly positive (exp is always > 0). (2) No time-discretisation bias in the marginal distribution of S_T — you can take one giant step to T for a European payoff. (3) The `-sigma^2/2` is the Itô correction from Q5; forgetting it is the most common Monte Carlo bug — it biases the mean of every simulated path. Under risk-neutral pricing swap mu for r and discount the mean payoff at exp(-r*T); error shrinks as O(1/sqrt(N)) in the number of paths.

## Time Value of Money & Interest Rates

### Summary

**What this topic covers**

The arithmetic of "a dollar today is worth more than a dollar tomorrow" and the term structure that formalises it. Three concern areas: (1) **discounting and compounding** — present value, future value, discrete vs continuous compounding, the discount factor as the atomic unit of pricing; (2) **the yield curve and its rates** — spot (zero) rates, forward rates, par yields, and the no-arbitrage relationships that tie them together; and (3) **curve construction** — bootstrapping a zero curve from traded instruments, and the day-count / compounding conventions that make quoted rates comparable. The 15 questions run from "what is PV" up to "bootstrap a two-year zero curve from a bill and two coupon bonds and derive the implied one-year forward". This is the plumbing under every fixed-income and derivatives price: every cashflow gets discounted by a factor pulled off a curve, and the curve is built by no-arbitrage. Cross-reference the **Finance Domain** primer for what these instruments *are*; here we do the maths of pricing them.

**Mental model**

A discount factor `DF(0,T) = P(0,T)` is the price today of receiving 1 unit at time T with certainty — one number that carries all the interest-rate information for maturity T. Every fixed cashflow is priced by multiplying it by its DF and summing: `PV = sum CF_i * DF(0,t_i)`. Rates are just alternative *encodings* of the same DFs: a spot rate is the single rate that reproduces DF(0,T) (`DF = exp(-z*T)` continuous, or `1/(1+z)^T` annual); a forward rate is the rate locked in today for a future period, defined so that "invest to t1 then roll to t2" equals "invest straight to t2" — a no-arbitrage identity, not a forecast. The yield curve is the whole function T -> z(T). The mental discipline: keep discount factors as the source of truth and convert to whatever rate convention the quote demands, being religious about compounding frequency and day count — most "wrong answers" in rates interviews are convention mismatches, not conceptual errors.

**Key terms**

- **Present value (PV)** — today's value of a future cashflow: PV = CF * DF(0,T).
- **Future value (FV)** — value at a later date of money invested now: FV = PV * (1+r)^n or PV*exp(r*T).
- **Discount factor DF(0,T)** — price today of 1 paid at T; DF = exp(-z*T) (continuous) or 1/(1+z)^T (annual).
- **Spot / zero rate z(T)** — the single rate for a pure zero-coupon investment maturing at T; the yield of a zero-coupon bond.
- **Forward rate f(t1,t2)** — rate agreed today for lending/borrowing between future times t1 and t2, set by no-arbitrage from spot rates.
- **Par yield** — the coupon rate at which a bond of a given maturity prices exactly at par (100).
- **Yield curve / term structure** — the function mapping maturity to rate (spot, par, or forward).
- **Bootstrapping** — iteratively extracting zero rates from prices of instruments of increasing maturity.
- **Nominal vs effective rate** — quoted (with a compounding frequency) vs the true annualised growth after compounding.
- **Day-count convention** — the rule (Act/360, Act/365, 30/360, Act/Act) converting calendar dates to a year fraction.
- **Compounding frequency** — how often interest is added (annual, semi-annual, continuous); changes the rate number for the same DF.

**Why interviewers ask this**

Rates are where sloppy candidates reveal themselves through convention errors. A junior signal is discounting a semi-annual bond with an annual factor, or confusing a forward rate (locked, no-arbitrage) with a forecast of future spot rates. A strong candidate treats discount factors as primitive, converts cleanly between continuous and discrete compounding, and can derive the forward rate from two spot rates on demand — and explain that the forward is what you can *lock in today*, not a prediction. Interviewers also probe economic intuition: what does an inverted curve imply, why is the par yield a weighted blend of zero rates, and why bootstrapping must proceed shortest-maturity-first. These are daily-use skills on any rates, credit, or derivatives desk, and they underpin the whole Fixed Income topic that follows.

**Common confusions**

- "The forward rate is the market's forecast of the future spot rate" — no; it is the arbitrage-locked rate. Under the pure expectations hypothesis they coincide, but in reality forwards carry a risk/term premium.
- "Yield and spot rate are the same" — a coupon bond's YTM is a single blended rate; spot rates are per-maturity zeros. YTM is a messy average of the relevant zeros.
- "Higher compounding frequency means a higher rate" — for the *same* effective return the quoted nominal rate is *lower* at higher frequency; more frequent compounding does more work per unit of quoted rate.
- "Discounting and the yield curve are annual by default" — always ask the day count and frequency; Act/360 vs Act/365 alone shifts the number.
- "You can bootstrap in any order" — no; each step needs all shorter zeros already solved, so you go from the shortest maturity outward.
- "Continuous compounding is just a theoretical curiosity" — it is the default in derivatives maths because exp(-r*T) composes cleanly and matches the Itô/BSM framework.

**What follows from this topic**

Discount factors and the zero curve are the direct input to **Fixed Income Analytics** (bond pricing, YTM, duration, convexity all consume DFs) and to every derivative price (the r in exp(-r*T) and in the risk-neutral drift is read off this curve). Forward rates are the underlyings of FRAs, swaps, and the interest-rate models (Vasicek, CIR, Hull-White, HJM, LMM) in the rates-modelling topic. Continuous compounding here is the same r that appears in Black-Scholes and in risk-neutral valuation. If discounting or the spot/forward distinction feels shaky, fix it before Fixed Income — duration and convexity are just sensitivities of these same discounted sums.

### Q1. Define present value and future value. Why is a dollar today worth more than a dollar tomorrow?

**Future value** is what money grows to; **present value** is the reverse — today's worth of a future amount. With an annual rate r over n years:

```text
FV = PV * (1 + r)^n
PV = FV / (1 + r)^n
```

**Why a dollar today is worth more.** Three reasons, in order of importance: (1) **opportunity / time value** — a dollar today can be invested to earn r, so it becomes 1+r tomorrow; equivalently, to have 1 tomorrow you only need 1/(1+r) today. (2) **Inflation** — future dollars typically buy less. (3) **Risk** — a promised future dollar may not arrive. Discounting formalises (1); inflation and credit risk are layered on via real rates and credit spreads. The mechanical takeaway: comparing cashflows at different dates requires bringing them all to a common date (usually today) via discount factors before you add or subtract them. Adding un-discounted cashflows across time is the cardinal sin of finance maths.

### Q2. Contrast discrete and continuous compounding. Convert between them.

**Discrete** compounding m times per year at nominal rate r_m, then continuous as the limit m -> infinity:

```text
FV (discrete, m per year, n years) = PV * (1 + r_m/m)^(m*n)
FV (continuous)                    = PV * exp(r_c * T)
DF (continuous)                    = exp(-r_c * T)
```

As m -> infinity, (1 + r_c/m)^(m*T) -> exp(r_c*T) (the definition of e). **Conversion** between a continuous rate r_c and an m-times-compounded rate r_m for the same growth:

```text
exp(r_c) = (1 + r_m/m)^m
r_c = m * ln(1 + r_m/m)
r_m = m * ( exp(r_c/m) - 1 )
```

Worked: r_m = 5% semi-annual (m=2) -> r_c = 2*ln(1 + 0.05/2) = 2*ln(1.025) = 0.04939 = 4.939% continuous. **Why quants default to continuous:** discount factors multiply cleanly (exp(-r*t1)*exp(-r*t2) = exp(-r*(t1+t2))), it matches the Itô/Black-Scholes framework, and there is no frequency to track. Markets quote discretely; maths uses continuous — convert at the boundary.

### Q3. What is a discount factor, and why treat it as the primitive object rather than the rate?

A **discount factor** DF(0,T) = P(0,T) is the price today of a riskless 1 paid at T:

```text
DF(0,T) = exp(-z*T)     (continuous zero rate z)
        = 1/(1+z)^T     (annual zero rate z)
PV of a cashflow CF at T  =  CF * DF(0,T)
```

**Why it is the primitive.** (1) It is *convention-free* — a pure price. All the ambiguity (compounding frequency, day count) lives in how you *quote* it as a rate; the DF itself is one unambiguous number. (2) Pricing is linear in DFs: any fixed-cashflow instrument is `sum CF_i * DF(0,t_i)` — you never need rates at all to compute a price, only DFs. (3) No-arbitrage constraints are cleaner on DFs: they must be positive and (usually) decreasing in T. (4) Forward rates and par yields are just algebraic re-expressions of ratios of DFs. Rates exist for human intuition and quoting; DFs exist for computation. A quant keeps the DF curve as the state and derives rates on demand — this avoids an entire class of compounding-mismatch bugs.

### Q4. Define spot (zero) rates and forward rates. Derive the forward rate from two spot rates.

**Spot (zero) rate** z(T): the rate on a pure zero-coupon investment from now to T. **Forward rate** f(t1,t2): the rate, agreed today, for investing over the future window [t1, t2].

**No-arbitrage derivation.** Two ways to have money at t2 must give the same result, else arbitrage: (a) invest to t2 at the spot z(t2); (b) invest to t1 at z(t1), then roll from t1 to t2 at the forward f(t1,t2) locked in today. Equate growth factors (annual compounding):

```text
(1 + z2)^t2 = (1 + z1)^t1 * (1 + f)^(t2 - t1)

Solve for the forward f = f(t1, t2):
(1 + f)^(t2 - t1) = (1 + z2)^t2 / (1 + z1)^t1
f = [ (1 + z2)^t2 / (1 + z1)^t1 ]^(1/(t2 - t1)) - 1
```

In **continuous compounding** it is cleaner (forward = slope of the spot-times-T line):

```text
exp(z2*t2) = exp(z1*t1) * exp(f*(t2 - t1))
f(t1,t2) = ( z2*t2 - z1*t1 ) / (t2 - t1)
```

Numeric: z1 = 4% (1yr), z2 = 5% (2yr), continuous -> f(1,2) = (0.05*2 - 0.04*1)/(2-1) = 0.06 = 6%. The forward exceeds both spots because the curve is upward-sloping — the second year must "make up" for the higher two-year average.

### Q5. Is the forward rate a forecast of the future spot rate?

**No — it is an arbitrage-locked rate, not a forecast.** The forward f(t1,t2) is the rate you can *contract today* to earn over [t1,t2] (via a forward-rate agreement or by trading two zeros). It is fixed by today's spot curve alone, with no expectation about the future. Three views of the relationship:

- **Pure expectations hypothesis**: forwards *equal* expected future spot rates. Clean, but empirically rejected — it ignores risk.
- **Liquidity/term premium**: forwards = expected future spots + a positive term premium (investors demand compensation for holding longer duration), so forwards tend to sit *above* realised future spots on average. This is the standard real-world view.
- **Market segmentation**: supply/demand at each maturity distorts the relationship further.

**Practical consequence.** You can lock in the forward today with certainty; you cannot lock in the future spot. Using the forward as a point forecast systematically over-predicts future rates in an upward-sloping curve because of the embedded term premium. In risk-neutral pricing, however, the forward *is* the correct expected value (under the forward measure) — which is why swaps and FRAs are priced off forwards regardless of any real-world forecast.

### Q6. Bootstrap a zero curve from bond prices. Walk through a worked example.

**Bootstrapping** extracts zero rates one maturity at a time, shortest first, because each coupon bond's price depends only on zeros at or before its maturity — all but the last already known.

Given (annual coupons, face 100):

```text
Instrument A: 1yr zero, price 96.15  (pays 100 at t=1)
Instrument B: 2yr bond, 5% coupon, price 99.00  (pays 5 at t=1, 105 at t=2)

Step 1 -- solve DF(1) from A:
96.15 = 100 * DF(1)  ->  DF(1) = 0.9615  ->  z1 = 1/DF(1) - 1 = 4.00%

Step 2 -- solve DF(2) from B, using known DF(1):
99.00 = 5*DF(1) + 105*DF(2)
99.00 = 5*0.9615 + 105*DF(2)
99.00 = 4.8075 + 105*DF(2)
DF(2) = (99.00 - 4.8075) / 105 = 0.89707
z2 = (1/DF(2))^(1/2) - 1 = (1/0.89707)^0.5 - 1 = 5.55%
```

Now the whole zero curve {z1 = 4.00%, z2 = 5.55%} is known, and any 1-2 year fixed cashflow can be priced. Extend to 3yr with a 3yr bond (reusing DF(1), DF(2), solving DF(3)), and so on. The **order matters**: you cannot solve DF(2) before DF(1). In practice you also interpolate (log-linear on DFs) for maturities between traded instruments and use deposits/futures/swaps rather than bonds, but the shortest-first substitution logic is identical.

### Q7. Given the zero curve from Q6, derive the implied one-year forward rate f(1,2).

From Q6, annual zeros: z1 = 4.00%, z2 = 5.55%. Use the no-arbitrage identity (annual compounding):

```text
(1 + z2)^2 = (1 + z1)^1 * (1 + f(1,2))^1
(1.0555)^2 = (1.04) * (1 + f)
1.11408    = 1.04 * (1 + f)
1 + f = 1.11408 / 1.04 = 1.07123
f(1,2) = 7.12%
```

Equivalently via discount factors: 1 + f(1,2) = DF(1)/DF(2) = 0.9615 / 0.89707 = 1.0718, f ~ 7.1% (small rounding difference). The one-year forward (7.1%) sits *above* both spot rates because the curve slopes up — the second year of the two-year investment must earn enough to pull the average from 4.0% up to 5.55%. This forward is exactly the fixed rate a 1x2 FRA would lock in today.

### Q8. What is a par yield, and how does it relate to spot rates?

The **par yield** for maturity T is the coupon rate c that makes a bond with that coupon price exactly at par (100). Setting price = face and solving:

```text
100 = c * sum_{i=1..N} DF(t_i) + 100 * DF(t_N)

=> c = ( 100 * (1 - DF(t_N)) ) / ( 100 * sum_{i} DF(t_i) )
     = ( 1 - DF(t_N) ) / ( sum_{i=1..N} DF(t_i) )
```

So the par yield is the final principal's "shortfall from 1" spread evenly over the annuity of discount factors. **Relationship to spot rates:** the par yield is a *DF-weighted average* of the zero rates across the bond's life — it blends all the relevant spots into one coupon. Consequences: on an upward-sloping curve, par yield < spot rate at the same maturity (because it averages in lower earlier zeros), and both sit below the forward rate. The three curves — par, spot, forward — are three encodings of the same DFs, ordered forward > spot > par when the curve rises, and reversed when it inverts. Swap curves are typically quoted as par rates, which is why bootstrapping a swap curve solves for the DFs that reproduce given par yields.

### Q9. Explain day-count conventions and why they matter.

A **day-count convention** is the rule that turns two calendar dates into a year fraction (the "tau" that multiplies a rate into an actual interest amount):

```text
Interest = Notional * rate * DayCountFraction(start, end)

Act/360:  actual days / 360      (money markets, USD LIBOR/SOFR, most floating legs)
Act/365:  actual days / 365      (GBP money markets, some deposits)
30/360:   assumes 30-day months, 360-day year  (US corporate/agency fixed coupons)
Act/Act:  actual days / actual days in year  (US Treasuries, most govvies)
```

**Why it matters.** For a 90-day period at 5%: Act/360 gives 5% * 90/360 = 1.250%, while Act/365 gives 5% * 90/365 = 1.233% — a ~1.7 bp difference on the *same* stated rate, purely from convention. Across a large notional or a swap's many periods, these add up to real money and to basis between legs quoted on different conventions. It also means a quoted "5%" is not comparable across instruments until normalised. Getting the day count wrong is the classic rates-desk error; interviewers include it to check you know a rate is meaningless without its convention. The discount factor (Q3) sidesteps this — it is convention-free — which is another reason to keep DFs as the primitive.

### Q10. Distinguish nominal (stated) and effective annual rates, with a conversion.

The **nominal (stated) rate** is the quoted annual rate before accounting for intra-year compounding; the **effective annual rate (EAR)** is the true annual growth after compounding is applied:

```text
EAR = (1 + r_nom/m)^m - 1        (m compounding periods per year)
EAR = exp(r_nom) - 1              (continuous compounding)
```

Worked: 12% nominal compounded monthly (m=12): EAR = (1 + 0.12/12)^12 - 1 = (1.01)^12 - 1 = 12.68%. Compounded continuously: EAR = exp(0.12) - 1 = 12.75%. **Key intuition:** for a fixed nominal rate, more frequent compounding raises the effective rate (interest earns interest sooner) — 12% monthly (12.68%) beats 12% annual (12.00%). Conversely, for a *target* effective rate, higher frequency needs a *lower* nominal quote. EAR is the only apples-to-apples way to compare, say, a monthly-compounded loan against a quarterly-compounded one. This is the same continuous-vs-discrete machinery as Q2, viewed from the "compare products" angle rather than the "convert for maths" angle.

### Q11. What does the shape of the yield curve tell you? Interpret normal, inverted, and flat.

The yield curve plots rate against maturity. Shapes and their standard readings:

- **Upward-sloping (normal)** — longer rates > shorter rates. The usual state; reflects a positive term premium (compensation for duration risk) and/or expectations of rising short rates / growth. Forwards sit above spots above par yields.
- **Inverted** — short rates > long rates. Historically a recession signal: the market expects the central bank to cut rates in the future (weak growth ahead), pulling long yields below current short yields. Forwards sit below spots.
- **Flat** — rates roughly equal across maturities. Often a transition state between normal and inverted; term premium roughly offsetting expected rate changes.
- **Humped** — mid-maturities highest; a transitional/technical shape.

**Caveat.** Shape mixes two things — *expected future short rates* and the *term premium* — so it is a noisy signal, not a clean forecast. But the empirical link between inversion (e.g. 2s10s or 3m-10y) and subsequent recessions is one of the most-watched macro indicators. For a quant the practical use is different: the shape determines the *forward* curve, which prices FRAs, swaps, and the drift of rate models — regardless of the macro interpretation.

### Q12. Price an annuity and a perpetuity in closed form.

An **annuity** pays a fixed C at the end of each of n periods; a **perpetuity** pays C forever. With a constant per-period rate r, sum the geometric series of discounted cashflows:

```text
Perpetuity:  PV = sum_{i=1..inf} C/(1+r)^i = C / r

Annuity:     PV = sum_{i=1..n} C/(1+r)^i = (C/r) * ( 1 - 1/(1+r)^n )
```

**Derivation of the annuity** (annuity = perpetuity now minus a perpetuity starting at year n):

```text
PV = C/r  -  (C/r) * 1/(1+r)^n  =  (C/r) * ( 1 - (1+r)^(-n) )
```

Worked: C = 10, r = 5%, n = 10 -> PV = (10/0.05)*(1 - 1.05^(-10)) = 200*(1 - 0.6139) = 200*0.3861 = 77.22. Sanity check the perpetuity intuition: C/r says a permanent 10/year at 5% is worth 200 — i.e. 200 invested at 5% throws off 10/year forever, exactly self-consistent. These closed forms are the backbone of bond pricing (a coupon bond = an annuity of coupons + a discounted redemption), loan amortisation, and dividend-discount valuation, and they let you avoid summing cashflow-by-cashflow.

### Q13. Given continuous zero rates z(1)=3%, z(2)=3.5%, z(3)=4%, price a 3-year 4% annual-coupon bond (face 100).

Build discount factors DF(t) = exp(-z(t)*t), then sum discounted cashflows. Coupons of 4 at t=1,2 and 104 (coupon + face) at t=3:

```text
DF(1) = exp(-0.03*1) = 0.97045
DF(2) = exp(-0.035*2) = exp(-0.07) = 0.93239
DF(3) = exp(-0.04*3) = exp(-0.12) = 0.88692

Price = 4*DF(1) + 4*DF(2) + 104*DF(3)
      = 4*0.97045 + 4*0.93239 + 104*0.88692
      = 3.8818 + 3.7296 + 92.240
      = 99.85
```

The bond prices just below par (99.85) because its 4% coupon is only marginally above the blended discount level of an upward-sloping curve topping out at 4% — the higher discounting in year 3 pulls the price under 100. Note each cashflow is discounted at *its own maturity's zero rate*, not at a single yield — that per-maturity discounting is the correct, arbitrage-free method. Solving for the single rate y that reproduces 99.85 across all three cashflows would give the bond's YTM (see Fixed Income), which here would sit just below 4%.

### Q14. What is a forward rate agreement (FRA), and how is it priced/valued off the curve?

A **forward rate agreement** locks in an interest rate for a future borrowing/lending period. A "t1 x t2 FRA" at fixed rate K on notional L settles at t1 based on the realised reference rate versus K over [t1,t2].

**Fair fixed rate.** At inception the FRA is worth zero when K equals the forward rate f(t1,t2) implied by the curve (Q4):

```text
K = f(t1,t2)  =  ( DF(t1)/DF(t2) - 1 ) / (t2 - t1)      (simple compounding)
```

**Value after inception.** As the curve moves, the current forward f drifts away from the locked K, and the FRA's value is the PV of that rate difference over the accrual:

```text
V (to the fixed-rate payer) = L * (f(t1,t2) - K) * (t2 - t1) * DF(t2)
```

Intuition: you locked K; the market now offers f; you gain (f - K) per unit notional over the period, discounted back. A FRA is the atomic building block of a swap — a fixed-for-floating swap is a strip of FRAs, one per reset — so pricing FRAs off the forward curve is exactly how swaps are valued. This is why the forward curve (not a forecast, but the arbitrage-locked rates of Q5) is the true underlying of the rates market.

### Q15. Two projects: A pays 100 in exactly 1 year; B pays 51 at 6 months and 51 at 12 months. At a 6% continuously-compounded flat rate, which is worth more?

Discount each cashflow by exp(-r*t) with r = 6% continuous:

```text
DF(0.5) = exp(-0.06*0.5) = exp(-0.03) = 0.97045
DF(1.0) = exp(-0.06*1.0) = exp(-0.06) = 0.94176

Project A: PV = 100 * DF(1.0)            = 100 * 0.94176 = 94.18
Project B: PV = 51*DF(0.5) + 51*DF(1.0)  = 51*0.97045 + 51*0.94176
             = 49.49 + 48.03 = 97.52
```

**Project B wins (97.52 vs 94.18).** Two reasons an interviewer wants you to articulate: (1) B pays *more* in total (102 vs 100), and (2) B pays *earlier* (half at 6 months), so less discounting erodes it — time value favours front-loaded cashflows. This is the whole point of the topic in miniature: you cannot compare 100-at-1yr against 102-spread-out by eyeballing totals; you must discount every cashflow to a common date first. It also previews duration — B has a shorter effective maturity (lower duration), so it is both worth more here and less sensitive to rate changes.

## Fixed Income Analytics

### Summary

**What this topic covers**

The pricing and risk maths of bonds — turning the discounting machinery of the previous topic into tradeable risk numbers. Three concern areas: (1) **pricing and yield** — a bond as a sum of discounted cashflows, and the yield to maturity (YTM) as the single rate that reproduces its price; (2) **first-order rate risk** — Macaulay duration (weighted-average time to cashflows) and modified duration (the price sensitivity -1/P * dP/dy), plus DV01/PV01 for a per-basis-point dollar figure; and (3) **second-order risk and its uses** — convexity, the duration+convexity P&L approximation, why convexity benefits the holder, and how duration matching immunises a portfolio against parallel rate moves. The 16 questions run from "price this bond" and "what is YTM" up to "why is convexity valuable" and "immunise this liability". Duration and convexity are the fixed-income analogues of the option Greeks (delta and gamma) — they are the sensitivities every rates, credit, and ALM desk quotes and hedges on. Cross-reference the **Finance Domain** primer for what these instruments are used for; here we compute the risk.

**Mental model**

A bond price P(y) is a decreasing, convex function of its yield y. Everything in this topic is a term in the Taylor expansion of P around the current yield:

```text
dP/P ≈ -ModDur * dy + 0.5 * Convexity * dy^2
```

The linear term is **modified duration** — the slope, your first-order rate risk; the quadratic term is **convexity** — the curvature, which is always positive for a plain bond and therefore always works in the holder's favour (price falls less than the linear estimate when rates rise, and rises more when they fall). Macaulay duration is the intuition behind the slope: the price is dominated by whichever cashflows are largest and latest, so duration is the *balance point in time* of the (discounted) cashflows — a zero-coupon bond's duration equals its maturity, a coupon bond's is less. DV01 just rescales modified duration into "dollars per basis point" for trading. Hold this picture — price as a convex curve in yield, duration the tangent, convexity the bend — and every question is reading off a derivative of that curve.

**Key terms**

- **Bond price** — P = sum of coupon and principal cashflows discounted at the yield or the zero curve.
- **Yield to maturity (YTM)** — the single constant rate y that makes the discounted cashflows equal the market price; the bond's internal rate of return if held to maturity.
- **Clean vs dirty price** — dirty (full) price includes accrued interest; clean price = dirty - accrued (the quoted number).
- **Macaulay duration** — the present-value-weighted average time to receive the cashflows, in years.
- **Modified duration** — ModDur = MacDur/(1 + y/m); the percentage price change per unit change in yield: -1/P * dP/dy.
- **DV01 / PV01** — dollar value of a 1 basis-point yield change = ModDur * P * 0.0001.
- **Convexity** — the second-order sensitivity, (1/P) * d^2P/dy^2; curvature of the price-yield curve.
- **P&L approximation** — dP/P ≈ -ModDur*dy + 0.5*Convexity*dy^2.
- **Immunisation** — matching asset and liability duration (and ideally convexity) so a parallel rate move leaves net value unchanged.
- **Key-rate / curve risk** — sensitivity to moves in individual points of the curve, capturing non-parallel (steepening/twist) risk that duration misses.
- **Pull to par** — a bond's price converging to face value as it approaches maturity, all else equal.

**Why interviewers ask this**

Fixed income is where a candidate proves they can turn a pricing formula into a *risk* number and hedge it. A junior signal is confusing Macaulay with modified duration, or thinking duration is "years to maturity" (it is not, for a coupon bond). A strong candidate derives modified duration as -1/P * dP/dy, explains the 1/(1+y) factor connecting it to Macaulay, quotes DV01 as the tradeable unit, and — the senior tell — explains *why convexity is always good for the holder* and how to exploit it (a barbell versus a bullet of equal duration). Interviewers also probe the limits: duration assumes a small *parallel* shift, so it misses large moves (need convexity) and curve twists (need key-rate durations). These are exactly the numbers on a rates trader's or ALM manager's screen, so fluency signals desk-readiness.

**Common confusions**

- "Duration is the bond's maturity" — only for a zero-coupon bond. Coupon bonds have duration *less* than maturity because early coupons pull the balance point in.
- "Macaulay and modified duration are the same" — they differ by the factor 1/(1 + y/m); Macaulay is a time (years), modified is a sensitivity (%/unit yield).
- "Duration alone gives the price change" — only to first order and for small parallel moves; for large moves you need the convexity term, and it systematically *underestimates* the price for a long position (convexity is a free positive correction).
- "Convexity is a nuisance term" — it is a benefit to the holder: positive convexity means gains are amplified and losses cushioned relative to the linear estimate.
- "YTM is the return you will earn" — only if you can reinvest coupons at YTM and hold to maturity; reinvestment risk breaks this.
- "DV01 and duration are different risk concepts" — DV01 is just modified duration expressed in dollars per basis point.

**What follows from this topic**

Duration and convexity are the direct fixed-income cousins of **delta and gamma** in the options Greeks topic — same Taylor-expansion logic, different underlying. DV01 and duration matching feed portfolio hedging and the risk (VaR) topic, where a parametric bond VaR is essentially DV01 times a yield volatility. Key-rate durations connect to the PCA-of-the-yield-curve result (level/slope/curvature factors) in the linear-algebra topic. The whole apparatus consumes the discount factors and zero curve from **Time Value of Money & Interest Rates**, so if bootstrapping or spot/forward rates feel shaky, revisit that first — duration is just the sensitivity of those same discounted sums.

### Q1. Price a coupon bond. Write the general formula and a worked example.

A bond's price is the sum of its cashflows discounted at yield y (compounded m times per year, N total periods, coupon C per period, face F):

```text
P = sum_{i=1..N} C/(1 + y/m)^i  +  F/(1 + y/m)^N
```

The coupon stream is an annuity plus the discounted redemption, so in closed form:

```text
P = (C/(y/m)) * ( 1 - 1/(1+y/m)^N )  +  F/(1+y/m)^N
```

Worked: 3-year bond, 5% annual coupon on face 100 (C=5, m=1, N=3), yield y = 6%:

```text
P = 5/1.06 + 5/1.06^2 + 105/1.06^3
  = 4.717 + 4.450 + 88.163
  = 97.33
```

The bond trades at a **discount** (97.33 < 100) because its 5% coupon is below the 6% yield the market demands — buyers pay less than par to make up the yield shortfall via a redemption gain. If the coupon exceeded the yield it would trade at a **premium** (> 100); if coupon = yield, exactly at par. As maturity approaches, the price is "pulled to par". Alternatively, discount each cashflow at its own zero rate off the curve (Time Value topic) for the arbitrage-free price; YTM is the single-rate summary of that.

### Q2. What is yield to maturity, and what are its limitations?

**Yield to maturity** is the single constant rate y that makes the discounted cashflows equal the observed market price — the bond's internal rate of return if held to maturity:

```text
Market Price = sum_{i=1..N} CF_i / (1 + y/m)^i     (solve for y)
```

There is no closed form; solve numerically (Newton-Raphson, using duration as the derivative). YTM is the standard way to quote and compare bonds on one number.

**Limitations.** (1) **Reinvestment assumption** — YTM is only the realised return if every coupon is reinvested at y itself; if rates fall you reinvest coupons at less, and the realised return is below YTM (reinvestment risk). (2) **Hold-to-maturity assumption** — sell early and your return depends on the price then. (3) **Single-rate fiction** — a real curve is not flat; YTM is a complicated cashflow-weighted average of the relevant zero rates, so two bonds with the same YTM but different coupons have different exposures to different parts of the curve. (4) It is **not additive** across a portfolio. For pricing, per-maturity zero rates are correct; YTM is a communication and relative-value tool, not a true discount rate.

### Q3. Define Macaulay duration and give its formula.

**Macaulay duration** is the present-value-weighted average time (in years) until the bond's cashflows are received — the "balance point" of the cashflow timeline:

```text
MacDur = ( sum_{i=1..N} t_i * PV(CF_i) ) / P
where PV(CF_i) = CF_i / (1 + y/m)^i  and  P = sum PV(CF_i)
```

Each cashflow's time t_i is weighted by the fraction of the bond's total present value it represents. Worked, using the Q1 bond (5% annual coupon, y=6%, P=97.33):

```text
t=1: PV = 4.717, weight = 4.717/97.33 = 0.04846, t*w = 0.04846
t=2: PV = 4.450, weight = 0.04572,               t*w = 0.09143
t=3: PV = 88.163, weight = 0.90581,              t*w = 2.71744
MacDur = 0.04846 + 0.09143 + 2.71744 = 2.857 years
```

So although the bond matures in 3 years, its duration is ~2.86 years — the early coupons pull the balance point below maturity. Intuition: duration is *when, on average, you get your money back* in PV terms. A **zero-coupon bond** has MacDur exactly equal to its maturity (one cashflow at the end); adding coupons always lowers it.

### Q4. Define modified duration and derive its link to Macaulay duration.

**Modified duration** measures the percentage price change per unit change in yield — the direct sensitivity:

```text
ModDur = - (1/P) * dP/dy
```

**Derivation from the price formula.** Differentiate P = sum CF_i/(1+y/m)^i with respect to y:

```text
dP/dy = sum_i  CF_i * (-i/m) * (1 + y/m)^(-i-1)
      = -(1/(1+y/m)) * (1/m) * sum_i  i * CF_i/(1+y/m)^i
      = -(1/(1+y/m)) * P * MacDur          (since (1/m)*sum i*PV = P*MacDur in years)

Therefore:
ModDur = -(1/P)*dP/dy = MacDur / (1 + y/m)
```

So **ModDur = MacDur / (1 + y/m)** — modified duration is Macaulay divided by one-plus-the-periodic-yield. Using the Q3 bond: ModDur = 2.857 / 1.06 = 2.695. **Interpretation:** a 1% (100bp) rise in yield changes the price by about -ModDur% = -2.695%. Macaulay is a *time* (years); modified is a *sensitivity* (% price per unit yield). The 1/(1+y/m) factor is the small correction that converts "average time" into "actual slope of the price-yield curve".

### Q5. What is DV01 (PV01), and how does it relate to modified duration?

**DV01** ("dollar value of an 01") is the change in a bond's price for a 1 basis-point (0.0001) move in yield — the tradeable, dollar-denominated risk unit:

```text
DV01 = -dP/dy * 0.0001 = ModDur * P * 0.0001
```

Worked, Q3 bond (ModDur = 2.695, P = 97.33):

```text
DV01 = 2.695 * 97.33 * 0.0001 = 0.02623  (about 2.6 cents per 100 face per bp)
```

**Relation to duration.** DV01 is simply modified duration rescaled: duration is a *percentage* sensitivity, DV01 is the *dollar* sensitivity for one basis point. Traders prefer DV01 because it is additive in dollars across a portfolio (unlike yields/durations, which need PV-weighting to aggregate) and it directly answers "how much do I make/lose per bp?" — the number you hedge on. To make a portfolio rate-neutral you size positions so their DV01s net to zero; to hedge a bond with a future you buy DV01-equivalent notional. PV01 is essentially the same idea (sometimes defined off a 1bp move in the par/swap rate rather than the yield); on a single bond they coincide in practice.

### Q6. Define convexity and write the second-order price approximation.

**Convexity** is the second-order sensitivity of price to yield — the curvature of the price-yield relationship:

```text
Convexity = (1/P) * d^2P/dy^2 = (1/P) * sum_i  ( i*(i+1)/m^2 ) * CF_i/(1+y/m)^(i+2)
```

It combines with modified duration in the **second-order Taylor expansion** of the price:

```text
dP/P  ≈  -ModDur * dy  +  0.5 * Convexity * dy^2
dP    ≈  -ModDur * P * dy  +  0.5 * Convexity * P * dy^2
```

The first term (duration) is the tangent line; the second (convexity) is the curvature correction. Because convexity is **positive** for a plain vanilla bond and the term carries dy^2 (always >= 0), the convexity contribution is always *positive* regardless of the direction of the rate move. So duration alone *underestimates* the price when rates fall (misses upside curvature) and *overestimates* the loss when rates rise (misses the cushion). The larger the yield move, the more the dy^2 term matters — for small moves duration suffices; for big moves you must include convexity. This is the exact fixed-income analogue of delta (duration) plus gamma (convexity) in the options Greeks.

### Q7. A bond has ModDur=7, Convexity=90, priced at 100. Estimate the price change for a +100bp and a -100bp yield move.

Use dP/P ≈ -ModDur*dy + 0.5*Convexity*dy^2 with dy = +/-0.01:

```text
Rates UP 100bp (dy = +0.01):
  duration term  = -7 * 0.01        = -0.0700  (-7.00%)
  convexity term = 0.5*90*0.01^2    = +0.0045  (+0.45%)
  total dP/P     = -0.0655  ->  price ~ 100*(1 - 0.0655) = 93.45

Rates DOWN 100bp (dy = -0.01):
  duration term  = -7 * (-0.01)     = +0.0700  (+7.00%)
  convexity term = 0.5*90*(-0.01)^2 = +0.0045  (+0.45%)
  total dP/P     = +0.0745  ->  price ~ 100*(1 + 0.0745) = 107.45
```

**Notice the asymmetry:** the price falls 6.55% but rises 7.45% for the same-size move — the gain exceeds the loss by 0.90% (twice the convexity term). That asymmetry *is* the value of positive convexity. Duration alone would have predicted a symmetric +/-7.00%; convexity adds +0.45% in *both* directions, cushioning the downside and boosting the upside. This is why, all else equal, a holder prefers more convexity — and why in a curve rally high-convexity bonds outperform their duration-implied returns.

### Q8. Why is convexity "good" for the holder, and how do you get more of it?

**Why it is good.** From the P&L approximation, the convexity term 0.5*Convexity*dy^2 is *positive for any yield move* (dy^2 >= 0, Convexity > 0). So relative to the straight-line duration estimate, a long bond position:

- **gains more** than predicted when yields fall, and
- **loses less** than predicted when yields rise.

The price-yield curve bends *above* its own tangent everywhere — the holder is on the favourable side of the curvature. Positive convexity is effectively a free long-volatility position in rates: the bigger the move (either way), the better you do versus a linear instrument of the same duration.

**How to get more of it (at equal duration).** A **barbell** (mix of very short and very long bonds) has *more* convexity than a **bullet** (single intermediate maturity) of the same modified duration, because convexity grows with the *dispersion* of cashflow times (it is like a variance of maturities, whereas duration is the mean). So barbell vs bullet at matched duration is the classic convexity trade: the barbell outperforms if yields make a large move in either direction, the bullet outperforms in a static or small-move market (you pay for convexity via lower yield). Nothing is free — the market prices convexity, so higher-convexity bonds typically offer slightly lower yields.

### Q9. Explain immunisation and duration matching.

**Immunisation** protects a portfolio's net worth against interest-rate moves by matching the interest-rate sensitivity of assets to that of liabilities. The core technique is **duration matching**: set the (dollar-)duration of assets equal to that of liabilities so a parallel yield shift moves both sides by the same amount and the net value is unchanged.

```text
Condition 1 (value):    PV(assets) = PV(liabilities)
Condition 2 (duration): ModDur(assets)*PV(assets) = ModDur(liabilities)*PV(liabilities)
                        (equivalently, match dollar duration / DV01)
```

Intuition: to first order, dP = -ModDur * P * dy on each side; matching ModDur*P makes the two dPs cancel for any small parallel dy. A classic use is a pension or insurer funding a known future liability — buy assets whose duration equals the liability's so rate moves do not open a funding gap.

**Refinements.** (1) Duration matching only neutralises *small parallel* shifts; adding a **convexity match** (assets convexity >= liabilities) improves protection against larger moves and is generally favourable to the asset holder. (2) It does not protect against *non-parallel* moves (twists/steepening) — that needs **key-rate duration** matching across multiple points of the curve. (3) Durations drift as time passes and yields move, so an immunised portfolio must be **rebalanced** periodically. Duration matching is the fixed-income version of delta-hedging: neutralise the first-order sensitivity, then worry about the second order.

### Q10. What is key-rate (partial) duration and what risk does it capture that duration misses?

Modified duration assumes the *entire* yield curve shifts up or down by the same amount — a **parallel** move. Real curves also **steepen, flatten, and twist**, and a single duration number is blind to these. **Key-rate durations** (also called partial durations) decompose a bond's or portfolio's rate risk into sensitivities to moves at *individual* points of the curve (e.g. 2y, 5y, 10y, 30y):

```text
KRD(t_k) = -(1/P) * dP/dy_k    (sensitivity to a 1-unit move in the zero rate at maturity t_k, others held fixed)

sum_k KRD(t_k) ≈ total modified duration   (parallel move = simultaneous unit shift at all key points)
```

**What it captures.** Two portfolios can have identical total duration yet very different key-rate profiles — one concentrated at 5y, another barbelled at 2y and 30y. Under a *parallel* move they behave the same; under a *steepener* (long rates up more than short) the barbell loses on its 30y bucket while the bullet is protected. Key-rate durations expose exactly this **curve risk**. On a desk you hedge each key-rate bucket separately (with the on-the-run bond or swap of that maturity) to be neutral to the whole curve, not just its level. This connects to the PCA result that curve moves decompose into level (parallel, ~duration), slope, and curvature factors — key-rate durations are the practical, bucketed version of that decomposition.

### Q11. How does bond price change as it approaches maturity ("pull to par")?

Holding yield constant, a bond's price converges to its face value as maturity approaches — the **pull to par**:

```text
As remaining time t -> 0, every DF = 1/(1+y/m)^i -> 1, so P -> sum of face + final coupon -> ~par
```

- A **discount** bond (coupon < yield, price < 100) drifts *up* toward 100 as it ages.
- A **premium** bond (coupon > yield, price > 100) drifts *down* toward 100.
- A **par** bond (coupon = yield) stays near 100 throughout.

**Why.** The gap between price and par exists only because the coupon differs from the market yield; that gap is amortised over the shrinking remaining life until, at maturity, you receive exactly face. This price drift is a *predictable* return component (sometimes called "rolldown" when combined with moving along an upward-sloping curve) distinct from the return caused by yield *changes*. It matters for total-return attribution: a bond bought at a discount earns part of its return from pull-to-par even if yields never move. It also means duration and convexity are computed at a point in time and evolve as the bond ages — another reason immunised portfolios need rebalancing.

### Q12. A zero-coupon bond and a 10% coupon bond both mature in 10 years. Which has higher duration, and why?

The **zero-coupon bond has the higher duration** — in fact its duration equals its maturity (10 years), the maximum possible for that maturity.

**Why.** Macaulay duration is the PV-weighted average time to cashflows. The zero pays *everything* at year 10, so its balance point is exactly 10 years. The coupon bond pays 10% each year *before* maturity, and those early cashflows carry positive weight at times 1, 2, ..., 9 — dragging the average time below 10. The bigger the coupon, the more weight sits early, the *lower* the duration:

```text
Zero-coupon 10y:        MacDur = 10.0 years (single cashflow at t=10)
10% coupon 10y (y=10%): MacDur ~ 6.8 years  (early coupons pull it in)
```

**Consequences.** The zero is the *most* rate-sensitive 10-year instrument — highest modified duration, biggest price swing per bp. This is why zeros (or STRIPS) are the tool of choice for taking pure duration exposure or for precisely immunising a long-dated liability: one cashflow, duration equal to maturity, no reinvestment risk. Conversely, high-coupon bonds are shorter-duration and more defensive for the same maturity. General rule: duration *rises* with maturity, *falls* with coupon, and *falls* with yield.

### Q13. Why does modified duration decrease as the coupon rate or the yield rises?

Both effects come from *where the present value sits in time*.

**Higher coupon -> lower duration.** A larger coupon puts more cashflow (and more PV weight) in the *early* years relative to the final principal. Since duration is the PV-weighted average *time*, shifting weight earlier pulls the average down. A zero-coupon bond (no early cashflows) has the maximum duration = maturity; the more coupon you add, the further duration falls below maturity.

**Higher yield -> lower duration.** Discounting at a higher yield shrinks the PV of *distant* cashflows more than near ones (the discount factor 1/(1+y)^t falls faster for large t as y rises). So the far-dated principal — which dominates duration — loses relative weight, pulling the average time (and thus duration) down:

```text
At higher y, the weight w_i = PV(CF_i)/P tilts toward small t_i
=> sum t_i * w_i decreases  => duration decreases
```

There is also the explicit 1/(1+y/m) factor in ModDur = MacDur/(1+y/m), which mechanically shrinks modified duration as y rises, on top of the Macaulay effect. **Practical upshot:** duration is not a fixed property — it moves with the market. As yields fall, durations *extend* (bonds get more sensitive, amplifying the rally); as yields rise, durations *shorten*. That state-dependence of duration is itself a manifestation of convexity.

### Q14. Compare bond risk measures: YTM, duration, DV01, convexity. When do you use each?

Each answers a different question about the same price-yield curve:

```text
Measure      | What it is                         | Units          | Use for
-------------|------------------------------------|----------------|---------------------------
YTM          | single rate reproducing the price  | % (rate)       | quoting, relative value
Macaulay dur | PV-weighted avg time to cashflows  | years          | intuition, immunisation
Modified dur | -1/P * dP/dy (1st-order sens.)     | % per unit y   | % price move per yield move
DV01/PV01    | ModDur * P * 1bp (1st-order, cash)  | cash per bp    | trading, hedging, aggregation
Convexity    | 1/P * d^2P/dy^2 (2nd-order)        | (per unit y)^2 | large moves, barbell vs bullet
```

**How they fit together.** YTM is a *level* summary (what rate am I earning); duration/DV01 are the *first-order risk* (how much do I move per rate change) — duration for percentages and intuition, DV01 for dollars and hedging; convexity is the *second-order correction* for large moves and the source of the barbell-vs-bullet trade. The full risk picture is the Taylor expansion `dP/P ≈ -ModDur*dy + 0.5*Convexity*dy^2`, with YTM setting the point you expand around. On a desk you quote YTM to compare bonds, hedge on DV01 to net your book to zero, and watch convexity when you expect volatility or hold a large directional position. The parallel to options is exact: YTM ~ moneyness/level, duration ~ delta, convexity ~ gamma.

### Q15. Estimate a 1-day 99% VaR for a bond position using DV01 and yield volatility.

A parametric (variance-covariance) VaR for a bond flows straight from its DV01 and the volatility of its yield. Steps:

```text
Given: position DV01 = D dollars per bp
       daily yield volatility  sigma_y  (in bp per day)
       confidence z-score      z (99% one-tailed -> z = 2.33)

1-day 99% VaR ≈ z * sigma_y * DV01
```

Worked: a position with DV01 = 5,000 dollars/bp and daily yield vol of 8 bp:

```text
1-day 99% VaR ≈ 2.33 * 8 * 5000 = 93,200 dollars
```

Interpretation: on ~1 day in 100, the loss from yield moves alone is expected to exceed ~93k dollars. **Assumptions and caveats.** (1) It is *linear* — it uses only DV01 (duration), so it ignores convexity; for large moves or option-embedded bonds the true tail loss differs and you add a convexity/gamma term or move to full-revaluation VaR. (2) It assumes yield changes are (approximately) Normal, which understates fat tails — Expected Shortfall (E[loss | loss > VaR]) is the coherent complement. (3) For a portfolio, aggregate DV01s across key-rate buckets with the yield covariance matrix (VaR = z * sqrt(dv' * Sigma * dv)) to capture curve correlations. This ties the duration/DV01 machinery directly into the Risk/VaR topic — bond VaR is essentially "DV01 times how much yields wiggle".

### Q16. What is the difference between clean price and dirty price, and why does the quoted price "sawtooth"?

The **dirty (full) price** is what the buyer actually pays — the true PV of all remaining cashflows. The **clean price** is the quoted price, stripped of accrued interest so the number does not jump on coupon dates:

```text
Dirty price = Clean price + Accrued interest
Accrued interest = Coupon * (days since last coupon / days in coupon period)   [per day-count convention]
```

**Why strip accrued.** Between coupon dates the dirty price rises steadily as the next coupon "accrues" — the holder is continuously earning toward it. On the coupon date the coupon is paid and the dirty price *drops* by the coupon amount. Plotting the dirty price over time therefore produces a **sawtooth**: a smooth climb, a sharp drop at each coupon, repeat. That sawtooth is pure accrual bookkeeping, not a change in the bond's value or yield, and it would make clean price comparison across dates misleading. Quoting the **clean** price removes the accrued component so the quoted number reflects only value changes from yield and credit moves — a smooth series you can compare day to day. At settlement the buyer still pays dirty = clean + accrued, compensating the seller for the coupon interest earned but not yet paid. Day-count convention (Q9 of the Time Value topic) determines exactly how accrued is computed.
## Portfolio Theory & Optimization

### Summary

**What this topic covers**

The mathematics of combining risky assets into a portfolio: how expected return and risk aggregate, and how to choose weights optimally. Three concern areas live here: (1) the **algebra of a portfolio** — return as `w'*mu`, variance as `w'*Sigma*w`, and why the cross-terms (covariances) are the whole story; (2) **Markowitz mean-variance optimization** — minimizing variance subject to a target return via a Lagrangian, tracing out the **efficient frontier**, and the geometry of the minimum-variance and tangency portfolios; and (3) the **Sharpe-maximizing tangency portfolio**, the capital market line, two-fund separation, and how real-world constraints (long-only, box, turnover) turn a clean closed form into a quadratic program. The 16 questions here move from "compute a two-asset variance" to "why does mean-variance blow up on estimation error and what do practitioners do about it." This topic is the bridge from probability/statistics into asset pricing — [[CAPM & Factor Models]] is the equilibrium consequence of everyone holding the tangency portfolio.

**Mental model**

Think of a portfolio as a single random variable built by linear combination: `r_p = sum_i w_i*r_i`. Two facts flow from linearity. Expected return is just the weighted average, `E[r_p] = w'*mu` — no free lunch there. But variance is a *quadratic* form, `Var(r_p) = w'*Sigma*w = sum_i sum_j w_i*w_j*Cov(r_i, r_j)`, and the off-diagonal covariance terms are what make diversification work. If assets were perfectly correlated, risk would also just be a weighted average and there would be nothing to gain. Because correlations are below 1, mixing assets destroys risk faster than it destroys return — that is the "only free lunch in finance." Geometrically, plot every achievable portfolio in (risk, return) space: you get a bullet-shaped region whose upper-left boundary is the **efficient frontier**. Add a risk-free asset and the best you can do is a straight line from `r_f` tangent to the bullet — the **capital market line** — touching at the one risky portfolio that maximizes the Sharpe ratio. Every investor then holds just that portfolio plus cash. Optimization is the machinery to find those weights.

**Key terms**

- **Weight vector w** — fractions of capital in each asset; long-only means w >= 0, fully invested means `w'*1 = 1` (1 is the ones vector). Shorts allow negative weights.
- **Expected return** — `mu_p = w'*mu`, linear in weights.
- **Portfolio variance** — `sigma_p^2 = w'*Sigma*w`, a quadratic form; `sigma_p` is the standard deviation.
- **Covariance matrix Sigma** — symmetric, positive semi-definite; diagonal = variances, off-diagonal = covariances = `rho_ij*sigma_i*sigma_j`.
- **Diversification** — risk reduction from imperfect correlation; only idiosyncratic risk diversifies away, systematic risk remains.
- **Efficient frontier** — set of portfolios with minimum variance for each level of expected return; the upper boundary of the feasible set.
- **Global minimum-variance portfolio (GMV)** — the single lowest-variance portfolio, `w = Sigma^{-1}*1 / (1'*Sigma^{-1}*1)`; needs no return forecast.
- **Tangency portfolio** — the risky portfolio maximizing Sharpe; `w proportional to Sigma^{-1}*(mu - r_f*1)`.
- **Sharpe ratio** — `(r_p - r_f)/sigma_p`, excess return per unit of total risk; slope of the capital market line.
- **Capital market line (CML)** — line from `r_f` through the tangency portfolio; `E[r_p] = r_f + Sharpe_tan*sigma_p`.
- **Two-fund separation** — every efficient portfolio is a mix of two funds (risk-free + tangency); investors differ only in the mix.
- **Quadratic program (QP)** — minimize `0.5*w'*Sigma*w` subject to linear constraints; the standard solver form once constraints are added.

**Why interviewers ask this**

Portfolio theory is where a candidate proves they can turn finance intuition into linear algebra and back. The junior signal is mechanical: can you write down `w'*Sigma*w`, expand a two-asset variance, and compute a Sharpe ratio without fumbling the risk-free subtraction. The senior signal is judgment about *why the clean theory fails in practice*: mean-variance optimizers are notoriously unstable, treating tiny differences in estimated `mu` as huge conviction and producing extreme, flip-flopping weights ("error maximization"). A strong candidate volunteers the estimation-error problem, mentions that `mu` is far harder to estimate than `Sigma`, and knows the practical fixes — shrinkage (Ledoit-Wolf), Black-Litterman, resampling, adding constraints, or just running the minimum-variance portfolio which needs no return forecast. Interviewers also probe the geometry (why the frontier is a hyperbola, why adding an asset can only help) to see whether you understand the theory or memorized formulas.

**Common confusions**

- "Diversification eliminates all risk" — no. It removes idiosyncratic (asset-specific) risk; systematic/market risk cannot be diversified away and is what gets priced in [[CAPM & Factor Models]].
- "Portfolio risk is the weighted average of asset risks" — false, that would ignore covariances. It equals the weighted average only when correlation is exactly 1. Below 1, portfolio sigma is strictly less.
- "The tangency portfolio is the global minimum-variance portfolio" — different portfolios. GMV minimizes variance ignoring return; tangency maximizes Sharpe. GMV needs only Sigma; tangency needs mu too.
- "More assets always lower variance" — adding assets weakly expands the feasible set so the frontier can only improve or stay the same, but a *naive equal weight* on a highly correlated new asset need not help; the benefit is from the optimizer using it.
- "Sharpe uses raw return" — it uses *excess* return over the risk-free rate; forgetting to subtract `r_f` is a classic slip.
- "The optimal weights are stable" — mean-variance weights are extremely sensitive to the `mu` estimate; small input changes swing weights wildly.

**What follows from this topic**

Mean-variance is the foundation the rest of asset pricing sits on. If every investor holds the tangency portfolio (two-fund separation), then in equilibrium the tangency portfolio must be the market portfolio — which is exactly the logic that produces the **CAPM** in [[CAPM & Factor Models]], where beta measured against that market portfolio becomes the single priced risk. The covariance matrix here reappears as the object you decompose with PCA and estimate with shrinkage; the Sharpe ratio reappears as the performance metric in stat-arb backtests. And the risk of a portfolio, measured here by variance, is generalized in the risk chapters into VaR and Expected Shortfall. Options and derivatives ([[Options & Derivatives Fundamentals]]) then give you tools to reshape a portfolio's payoff distribution beyond what weights alone can do.

### Q1. Derive the expected return and variance of a two-asset portfolio.

Let weights `w_A` and `w_B = 1 - w_A`, returns `r_A`, `r_B` with means `mu_A`, `mu_B`, standard deviations `sigma_A`, `sigma_B`, and correlation `rho`.

**Expected return** is linear:

```text
mu_p = w_A*mu_A + w_B*mu_B
```

**Variance** uses `Var(aX + bY) = a^2*Var(X) + b^2*Var(Y) + 2*a*b*Cov(X,Y)` with `Cov = rho*sigma_A*sigma_B`:

```text
sigma_p^2 = w_A^2*sigma_A^2 + w_B^2*sigma_B^2 + 2*w_A*w_B*rho*sigma_A*sigma_B
```

The intuition: return averages, but risk gets a discount from the cross term whenever `rho < 1`. If `rho = 1`, the expression is a perfect square `(w_A*sigma_A + w_B*sigma_B)^2`, so `sigma_p` is just the weighted average of the sigmas — no diversification. If `rho = -1`, you can pick weights to drive `sigma_p` to zero.

### Q2. Show how diversification reduces variance when correlation is below 1. Give a concrete number.

Take two assets each with `sigma = 20%`, equally weighted (`w_A = w_B = 0.5`).

```text
sigma_p^2 = 0.25*0.04 + 0.25*0.04 + 2*0.25*rho*0.04
          = 0.02 + 0.02*rho
```

Now vary rho:

| rho | sigma_p^2 | sigma_p |
|---|---|---|
| +1.0 | 0.0400 | 20.0% |
| +0.5 | 0.0300 | 17.3% |
| 0.0 | 0.0200 | 14.1% |
| -1.0 | 0.0000 | 0.0% |

At `rho = 1` you keep the full 20%. At `rho = 0` risk drops to `20%/sqrt(2) = 14.1%` while expected return is unchanged — pure free lunch. At `rho = -1` the two assets perfectly hedge and risk vanishes. The general lesson: it is **correlation, not the individual volatilities, that determines the diversification benefit**. Lower correlation means steeper risk reduction for the same return.

### Q3. With N equally-weighted assets, what happens to portfolio variance as N grows?

Assume every asset has variance `s^2` and every pair has the same covariance `c = rho*s^2`. With `w_i = 1/N`:

```text
sigma_p^2 = N*(1/N^2)*s^2 + N*(N-1)*(1/N^2)*c
          = s^2/N + (1 - 1/N)*c
```

As `N -> infinity`, the first term (average variance / N) vanishes and the second term converges to `c = rho*s^2`:

```text
lim sigma_p^2 = c = rho*s^2
```

**Interpretation.** The idiosyncratic part (`s^2/N`) diversifies away completely, but the common covariance floor `c` does not. This is the mathematical statement of "you cannot diversify away systematic risk." If `rho = 0`, the floor is zero and enough assets drive variance to zero (the law of large numbers). If `rho > 0`, you hit an irreducible floor — the market factor. This directly motivates [[CAPM & Factor Models]]: only the undiversifiable part earns a risk premium.

### Q4. Set up the Markowitz mean-variance problem and solve it with Lagrange multipliers.

**Problem** (minimize variance for a target return `m`, allowing shorts, fully invested):

```text
minimize    0.5 * w'*Sigma*w
subject to  w'*mu = m          (hit target return)
            w'*1  = 1          (weights sum to 1)
```

Form the Lagrangian with multipliers lambda, gamma:

```text
L = 0.5*w'*Sigma*w - lambda*(w'*mu - m) - gamma*(w'*1 - 1)
```

Set the gradient in w to zero:

```text
dL/dw = Sigma*w - lambda*mu - gamma*1 = 0
=>  w = Sigma^{-1}*(lambda*mu + gamma*1)
```

So the optimal weights are a linear combination of two fixed vectors, `Sigma^{-1}*mu` and `Sigma^{-1}*1`, with lambda and gamma pinned down by plugging back into the two constraints (a 2x2 linear system in lambda, gamma). 

**Key consequence — two-fund separation.** Because every efficient w is a mix of the same two vectors regardless of the target m, every efficient portfolio is a blend of two "funds." Trace m over a range and you sweep out the **efficient frontier**, which is a hyperbola in (sigma, return) space.

### Q5. Derive the global minimum-variance portfolio.

Drop the return constraint — just minimize variance subject to weights summing to 1:

```text
minimize   0.5*w'*Sigma*w   s.t.   w'*1 = 1
```

Lagrangian gives `Sigma*w = gamma*1`, so `w proportional to Sigma^{-1}*1`. Normalize so weights sum to 1:

```text
w_GMV = Sigma^{-1}*1 / (1'*Sigma^{-1}*1)
```

Notice it depends **only on Sigma, not on mu**. That is why GMV is popular in practice: expected returns are extremely hard to estimate, so a portfolio that ignores them entirely sidesteps the biggest source of error and often out-of-samples the "optimal" tangency portfolio. For the two-asset case it reduces to the closed form:

```text
w_A = (sigma_B^2 - rho*sigma_A*sigma_B) / (sigma_A^2 + sigma_B^2 - 2*rho*sigma_A*sigma_B)
```

### Q6. What is the efficient frontier, and why is it a hyperbola?

The **efficient frontier** is the set of portfolios giving the maximum expected return for each level of risk (equivalently, minimum variance for each target return). It is the upper-left boundary of the feasible cloud of all portfolios.

**Why a hyperbola.** From Q4, minimum variance at target return m has the form `sigma_p^2 = a*m^2 + b*m + c` for constants a, b, c that come from `mu' Sigma^{-1} mu`, `mu' Sigma^{-1} 1`, `1' Sigma^{-1} 1`. A quadratic relationship between `sigma_p^2` and m plots as a parabola in (variance, return) space and as a **hyperbola** in (sigma, return) space (taking the square root). The leftmost point of the hyperbola is the global minimum-variance portfolio; the upper branch above it is "efficient," the lower branch is dominated (same risk, lower return — nobody rational holds it).

Only the upper branch is the efficient frontier. Any portfolio strictly inside the hyperbola is inefficient: you can get more return for the same risk by moving to the boundary.

### Q7. Introduce a risk-free asset. Derive the capital market line and the tangency portfolio.

With a risk-free rate `r_f`, you can combine cash with any risky portfolio P. A mix `(1 - a)` in cash and `a` in P gives:

```text
E[r] = r_f + a*(E[r_P] - r_f)
sigma = a*sigma_P
=>  E[r] = r_f + ((E[r_P] - r_f)/sigma_P) * sigma
```

This is a straight line from `r_f` with slope = Sharpe ratio of P. To get the best possible line (highest return per risk), rotate it up until it is **tangent** to the efficient frontier. The tangency point is the risky portfolio with the **maximum Sharpe ratio**, and that line is the **capital market line (CML)**:

```text
E[r_p] = r_f + Sharpe_tangency * sigma_p
```

Solving `maximize (w'*mu - r_f)/sqrt(w'*Sigma*w)` yields:

```text
w_tan  proportional to  Sigma^{-1}*(mu - r_f*1)
```

then normalize to sum to 1. **Two-fund separation now sharpens**: every investor holds only cash + the tangency portfolio, differing solely in the split. Risk appetite sets a (how much in the tangency fund), not which risky assets to own.

### Q8. Derive the Sharpe-maximizing weights and explain the intuition of Sigma^{-1}(mu - r_f).

Maximizing the Sharpe ratio `SR(w) = (w'*mu - r_f) / sqrt(w'*Sigma*w)` — the scale of w cancels, so fix `w'*(mu - r_f*1) = 1` and minimize `w'*Sigma*w`. Lagrange gives `Sigma*w proportional to (mu - r_f*1)`, so:

```text
w_tan proportional to Sigma^{-1}*(mu - r_f*1)
```

**Intuition of `Sigma^{-1}*(mu - r_f*1)`.** The vector `(mu - r_f*1)` is the excess-return signal: how attractive each asset looks on its own. Multiplying by `Sigma^{-1}` does two things: it **scales down** assets with high variance and, crucially, **disentangles correlated bets** — if two assets are highly correlated, `Sigma^{-1}` prevents you from double-counting the same underlying exposure, shrinking the combined position. So you tilt toward high excess-return assets, penalized for their own risk and for redundancy with what you already hold. This is exactly why the optimizer is fragile: `Sigma^{-1}` amplifies estimation noise, especially when assets are near-collinear (Sigma near-singular).

### Q9. Compute the tangency portfolio for two assets — a worked example.

Assets: `mu_A = 10%`, `mu_B = 6%`, `sigma_A = 20%`, `sigma_B = 12%`, `rho = 0.2`, `r_f = 2%`.

Excess returns: `mu_A - r_f = 0.08`, `mu_B - r_f = 0.04`. Covariance `Cov = 0.2*0.20*0.12 = 0.0048`. Sigma:

```text
Sigma = [ 0.0400  0.0048 ]
        [ 0.0048  0.0144 ]
```

The unnormalized tangency weights are `Sigma^{-1}*(excess)`. Rather than invert by hand, use the standard two-asset formula (z = unnormalized weights):

```text
z_A = ( (mu_A-r_f)*sigma_B^2 - (mu_B-r_f)*Cov ) / det
z_B = ( (mu_B-r_f)*sigma_A^2 - (mu_A-r_f)*Cov ) / det
```

Numerators (det cancels on normalization):

```text
z_A ~ 0.08*0.0144 - 0.04*0.0048 = 0.001152 - 0.000192 = 0.000960
z_B ~ 0.04*0.0400 - 0.08*0.0048 = 0.001600 - 0.000384 = 0.001216
```

Normalize: `w_A = 0.960/(0.960+1.216) = 44%`, `w_B = 56%`. Portfolio excess return `= 0.44*0.08 + 0.56*0.04 = 0.0576`; variance `= 0.44^2*0.04 + 0.56^2*0.0144 + 2*0.44*0.56*0.0048 = 0.014165`, so `sigma_p = 11.9%`. Sharpe `= 0.0576/0.119 = 0.484` — higher than either asset alone (A: 0.40, B: 0.33). Diversification bought a better risk-return trade-off.

### Q10. What is two-fund separation and why does it matter?

**Statement.** With a risk-free asset, every mean-variance-efficient portfolio is a combination of just two funds: the risk-free asset and the single tangency portfolio. Investors differ only in how much they put in each — nobody needs a bespoke basket of risky assets.

**Why it is true.** From Q7, the CML is the efficient frontier once cash exists, and every point on it is `(1-a)` cash plus `a` tangency. Risk preference sets a; the *composition of the risky part is identical for everyone*.

**Why it matters.** (1) It is the logical seed of the **CAPM**: if all investors hold the same tangency portfolio, in equilibrium that portfolio must be the value-weighted market portfolio, which makes market beta the only priced risk (see [[CAPM & Factor Models]]). (2) Practically, it justifies index-fund investing — hold the market plus adjust cash for risk tolerance. (3) It cleanly separates the *investment* decision (find the tangency portfolio, a return-maximization problem) from the *financing/risk* decision (how much leverage or cash), which can be delegated to different desks.

### Q11. Why do real portfolios need constraints, and how does the problem become a quadratic program?

The closed-form Markowitz solution allows arbitrary shorts and leverage, so it routinely spits out extreme, unrealizable weights (e.g. +400% in one asset, -300% in another). Real mandates impose constraints:

- **Long-only:** `w >= 0` (no shorting).
- **Budget:** `w'*1 = 1` (fully invested).
- **Box limits:** `w_i <= 5%` (concentration caps).
- **Sector/turnover/tracking-error limits:** linear or quadratic side constraints.

Once you add inequality constraints there is no closed form, so you write it as a **quadratic program**:

```text
minimize   0.5*w'*Sigma*w - q*w'*mu     (q = risk-aversion knob)
subject to A*w <= b,  Aeq*w = beq
```

The objective is convex (Sigma is PSD) and constraints are linear, so it is a convex QP solved by interior-point or active-set methods, respecting the KKT conditions. In Python you would hand `Sigma`, `mu`, and the constraint matrices to `cvxpy` or `scipy.optimize`. Sweeping the risk-aversion `q` traces the constrained efficient frontier. Constraints also act as implicit regularization — they tame the estimation-error instability of the unconstrained solution.

### Q12. Why is mean-variance optimization so sensitive to inputs? What is "error maximization"?

The optimizer computes `w proportional to Sigma^{-1}*(mu - r_f*1)`. Two problems compound:

1. **mu is barely estimable.** With T years of data, the standard error of a mean return scales like `sigma/sqrt(T)`. For `sigma = 20%` and 20 years, the SE on the annual mean is ~4.5% — comparable to the mean itself. You essentially do not know mu.
2. **Sigma^{-1} amplifies noise.** When assets are correlated, Sigma has small eigenvalues; inverting divides by them, magnifying tiny estimation errors into huge weight swings. The optimizer interprets noise as signal.

Michaud called this **"error maximization"**: mean-variance systematically overweights assets whose returns were *overestimated* and underweights those *underestimated*, because those are exactly the assets that look most attractive. The output is extreme, unstable, and flips sign on tiny input changes.

**Fixes:** shrink Sigma toward a structured target (Ledoit-Wolf); shrink or replace mu (Black-Litterman blends a prior/equilibrium view with your forecasts); add constraints; resample (average over many bootstrapped optimizations); or just run the minimum-variance portfolio, which uses no mu at all.

### Q13. What is the Sharpe ratio, what are its limitations, and how does it relate to the information ratio?

**Definition.** `Sharpe = (r_p - r_f)/sigma_p` — excess return per unit of total volatility. It is the slope of the line from the risk-free asset to the portfolio, so maximizing Sharpe = getting on the steepest capital-allocation line. Higher is better; a Sharpe of 1 is good, 2 is excellent, 3+ is rare and suspicious for a strategy.

**Limitations.** (1) It penalizes upside and downside volatility equally — a strategy with big positive surprises is punished. (2) It assumes returns are roughly normal; for skewed/fat-tailed payoffs (e.g. short options, which look great until they blow up) it understates tail risk. The **Sortino ratio** fixes this by using only downside deviation. (3) It is easy to game by selling tail risk (steady small gains, rare huge loss). (4) It is scale-dependent on the measurement frequency — annualize consistently (`SR_annual = SR_daily*sqrt(252)`).

**Information ratio.** `IR = (r_p - r_benchmark)/tracking_error`, i.e. Sharpe measured against a benchmark instead of cash, using active return over the standard deviation of active return. It measures skill at *beating a benchmark*, the natural metric for an active manager. Sharpe judges the whole portfolio; IR judges the active bets on top of the benchmark.

### Q14. How do you estimate the covariance matrix, and why is shrinkage used?

The naive estimate is the **sample covariance matrix** `S = (1/(T-1)) * sum_t (r_t - r_bar)*(r_t - r_bar)'`. Two failure modes:

- **Dimensionality.** With N assets you must estimate `N*(N+1)/2` parameters. If the number of observations T is not much larger than N, S is noisy and, when `T < N`, **singular** (not invertible) — fatal because the optimizer needs `Sigma^{-1}`.
- **Extreme eigenvalues.** Sample estimation pushes the largest eigenvalues too high and smallest too low, exactly the small eigenvalues that `Sigma^{-1}` divides by.

**Shrinkage (Ledoit-Wolf)** pulls the noisy sample matrix toward a structured, well-conditioned target F (e.g. constant-correlation, or a single-factor model):

```text
Sigma_hat = delta*F + (1 - delta)*S
```

with the shrinkage intensity `delta` in (0,1) chosen to minimize expected error. This guarantees invertibility, damps the extreme eigenvalues, and dramatically stabilizes the resulting weights out of sample. Related tools: factor-model covariance (Sigma from a small number of factors plus diagonal idiosyncratic risk) and PCA-based cleaning (keep the top eigenvalues, treat the rest as noise). The theme: impose structure to trade a little bias for a large variance reduction.

### Q15. A portfolio manager says "I added an asset and my optimal Sharpe went up." Can adding an asset ever hurt?

**In theory, no.** Expanding the investable universe weakly enlarges the feasible set — every portfolio you could form before is still available (just put zero weight on the new asset). So the maximum achievable Sharpe (and the whole efficient frontier) can only improve or stay the same. The new asset helps strictly whenever its excess return is not perfectly explained by the existing assets, i.e. it has a nonzero "alpha" relative to the current tangency portfolio. Formally, the tangency Sharpe rises unless `mu_new - r_f = beta*(mu_tan - r_f)` exactly (the new asset is redundant).

**In practice, yes it can hurt.** The theoretical result assumes you *know* the true mu and Sigma. In reality, adding an asset means estimating a new row/column of Sigma and a new mu from noisy data. That extra estimation error can degrade *out-of-sample* performance even though in-sample Sharpe mechanically rises. So a manager who sees in-sample Sharpe climb with every added asset is likely overfitting. The honest test is out-of-sample: does the richer universe still win on held-out data after transaction costs.

### Q16. Contrast risk parity with mean-variance optimization.

**Mean-variance** chooses weights to maximize Sharpe (or minimize variance for a target return); it needs both mu and Sigma and is fragile because mu is nearly unknowable.

**Risk parity** ignores mu entirely and instead equalizes each asset's *risk contribution* to the portfolio. Asset i's marginal contribution to risk is `w_i * (Sigma*w)_i / sigma_p`; risk parity solves for weights so that all N contributions are equal:

```text
w_i * (Sigma*w)_i = w_j * (Sigma*w)_j   for all i, j
```

**Why people use it.** By dropping mu (the noisiest input) it sidesteps error maximization, and by balancing risk rather than dollars it avoids the trap of a "60/40" portfolio actually being ~90% equity risk. It typically overweights low-volatility assets (bonds), then applies leverage to reach a target volatility — which is why it depends on being able to borrow cheaply and is exposed to funding/rate shocks.

**Trade-off.** Risk parity is more robust but explicitly leaves return forecasting on the table; it is a bet that risk-balancing plus leverage beats trying to forecast mu. It sits alongside minimum-variance (Q5) in the family of "estimation-error-aware" alternatives to full mean-variance. There is no free lunch — you trade optimality-if-inputs-are-right for robustness-when-inputs-are-wrong.

## CAPM & Factor Models

### Summary

**What this topic covers**

How expected returns are determined by exposure to risk factors. Three concern areas live here: (1) the **Capital Asset Pricing Model** — the equilibrium result that a single number, market beta, prices every asset via `E[r_i] = r_f + beta_i*(E[r_m] - r_f)`, with beta defined as `Cov(r_i, r_m)/Var(r_m)`; (2) the **decomposition of risk** into systematic (priced) and idiosyncratic (diversifiable, not priced), the security market line, and what alpha means; and (3) **multi-factor models** — Arbitrage Pricing Theory, the Fama-French three-factor model (market, size SMB, value HML) plus momentum, and how you estimate factor exposures by regression. The 16 questions run from "what is beta" and "compute it from a covariance" to "why did CAPM fail empirically and what replaced it." This topic is the equilibrium payoff of [[Portfolio Theory & Optimization]]: if everyone holds the tangency portfolio and it equals the market, beta is all that matters.

**Mental model**

CAPM answers one question: for bearing risk, what return should I *expect*? Its answer is that you are only rewarded for risk you **cannot diversify away**. Total risk splits into two parts. Idiosyncratic risk (a factory fire, a lawsuit) washes out in a large portfolio, so the market pays you nothing for holding it — you could have diversified it for free. Systematic risk (recessions, rate shocks) hits everything at once and cannot be diversified, so it commands a premium. **Beta** measures how much of the market's systematic swings an asset amplifies: beta 1 moves with the market, beta 2 is twice as jumpy, beta 0.5 is defensive. Expected return is then just the risk-free rate plus beta times the market's risk premium — a straight line, the security market line. Factor models generalize this: instead of one systematic factor (the market), returns load on several (size, value, momentum), each carrying its own premium. A "factor" is a source of common, undiversifiable variation; its "risk premium" is the extra return earned for being exposed to it.

**Key terms**

- **CAPM** — `E[r_i] = r_f + beta_i*(E[r_m] - r_f)`; expected return is linear in market beta.
- **Beta** — `Cov(r_i, r_m)/Var(r_m)`; sensitivity of asset i to the market; the slope of regressing `r_i` on `r_m`.
- **Market risk premium** — `E[r_m] - r_f`; the reward per unit of beta.
- **Alpha** — return not explained by the model; `alpha = actual return - CAPM-predicted return`; the intercept in the regression.
- **Systematic risk** — undiversifiable, market-wide risk; the only risk CAPM prices.
- **Idiosyncratic risk** — asset-specific, diversifiable risk; not priced.
- **Security market line (SML)** — plot of expected return vs beta; slope = market risk premium; all assets should lie on it in equilibrium.
- **APT** — Arbitrage Pricing Theory; returns are a linear function of several factors, derived from no-arbitrage rather than equilibrium.
- **Factor** — a source of common return variation (market, size, value, momentum) with an associated risk premium.
- **SMB / HML** — Fama-French factors: Small Minus Big (size premium) and High Minus Low book-to-market (value premium).
- **Momentum (WML/UMD)** — factor going long recent winners, short recent losers.
- **Factor loading** — an asset's regression coefficient on a factor; its beta to that factor.

**Why interviewers ask this**

CAPM is the canonical asset-pricing model, so it tests whether a candidate can move between three registers: the *derivation* (why beta and not total variance is what matters), the *statistics* (beta is a regression slope; alpha is the intercept; how you estimate them and read the t-stats), and the *critique* (CAPM is empirically weak — the SML is too flat, low-beta stocks outperform, and size/value/momentum earn premia CAPM cannot explain). Junior candidates recite the formula. Senior candidates explain *why only systematic risk is priced* (a diversifiable risk earns no premium because someone can hold it for free), know that beta is estimated by OLS of excess returns, and can articulate the shift from single-factor CAPM to multi-factor Fama-French — and why "factor investing" is now an industry. Interviewers also probe whether you understand that a high-alpha strategy might just be loading on an unpriced-in-your-model factor.

**Common confusions**

- "Beta measures total risk" — no, beta measures only *systematic* risk (co-movement with the market). Total risk is standard deviation; two assets with the same sigma can have very different betas.
- "Higher beta always means higher realized return" — CAPM is about *expected* return; realized returns are noisy, and empirically the high-beta premium is much smaller than CAPM predicts (the SML is too flat).
- "Alpha is skill" — alpha relative to CAPM may vanish once you add size/value/momentum factors; much "alpha" is really uncompensated factor exposure ("alpha is just beta you haven't identified yet").
- "Idiosyncratic risk should be rewarded" — it is not priced because it is diversifiable; the market only pays for risk you are forced to bear.
- "CAPM and the CML are the same line" — the CML plots return vs *total* risk (sigma) for efficient portfolios; the SML plots return vs *beta* for all assets. Different x-axes.
- "APT and CAPM are the same" — APT allows multiple factors and rests on no-arbitrage, not on the strong equilibrium/utility assumptions of CAPM.

**What follows from this topic**

Factor models are the working language of quantitative equity: the covariance matrix in [[Portfolio Theory & Optimization]] is often *built* from a factor model (Sigma = B*F*B' + diagonal idiosyncratic), which is exactly the shrinkage-by-structure idea. The regression machinery here (OLS to estimate beta) is the same used across quant finance for signals and hedging. Alpha and the information ratio connect to strategy evaluation in statistical arbitrage. And the notion of a priced risk factor foreshadows the risk-neutral pricing story in [[Options & Derivatives Fundamentals]], where instead of a real-world risk premium you switch to a measure under which every asset earns the risk-free rate.

### Q1. State the CAPM and define every term.

```text
E[r_i] = r_f + beta_i * ( E[r_m] - r_f )
```

- `E[r_i]` — expected return on asset i.
- `r_f` — risk-free rate (e.g. T-bill).
- `E[r_m]` — expected return on the market portfolio (all risky assets, value-weighted).
- `E[r_m] - r_f` — the **market risk premium**, the reward for bearing one unit of market risk.
- `beta_i = Cov(r_i, r_m)/Var(r_m)` — asset i's sensitivity to the market.

**Reading it.** Expected return has two pieces: the time value of money (`r_f`, what you get for waiting) plus a risk reward (`beta_i` times the market premium, what you get for bearing undiversifiable risk). An asset with `beta = 0` earns just `r_f` — its risk is all diversifiable, so the market pays nothing extra. An asset with `beta = 1` earns the full market return. `beta > 1` amplifies the market; `beta < 0` (e.g. gold in some regimes) earns *below* `r_f` because it hedges, and investors pay for insurance.

### Q2. Derive beta as Cov(r_i, r_m)/Var(r_m), and connect it to a regression.

Regress asset excess return on market excess return:

```text
r_i - r_f = alpha_i + beta_i*(r_m - r_f) + epsilon_i
```

The OLS slope that minimizes the variance of the residual epsilon is:

```text
beta_i = Cov(r_i - r_f, r_m - r_f) / Var(r_m - r_f) = Cov(r_i, r_m)/Var(r_m)
```

(the constant `r_f` drops out of variances/covariances). So **beta is literally the slope of the best-fit line of the asset's returns against the market's** — how many percent the asset moves, on average, per 1% market move. 

Why this specific quantity prices risk: in a well-diversified portfolio, an asset's own variance is mostly diversified away; what survives is its *contribution to portfolio risk*, which is its covariance with the market. Normalizing that covariance by `Var(r_m)` gives beta, the unit in which the market pays a premium. Alpha is the intercept — return the market factor does not explain.

### Q3. Decompose total risk into systematic and idiosyncratic. Why is only systematic risk priced?

Take the CAPM regression `r_i = r_f + beta_i*(r_m - r_f) + epsilon_i`. Variance splits cleanly because `epsilon_i` is uncorrelated with the market by construction:

```text
Var(r_i) = beta_i^2 * Var(r_m)  +  Var(epsilon_i)
           \___systematic___/     \_idiosyncratic_/
```

- **Systematic** (`beta^2 * Var(r_m)`): co-movement with the market; hits every asset at once; cannot be diversified.
- **Idiosyncratic** (`Var(epsilon)`): asset-specific noise; uncorrelated across assets, so it averages out in a large portfolio.

**Why only systematic risk earns a premium.** Idiosyncratic risk can be eliminated for free by holding many assets (Q3 of portfolio theory showed variance -> the covariance floor as N grows). A rational, diversified investor bears no idiosyncratic risk, so the market cannot pay a premium for it — anyone demanding compensation would be undercut by someone who diversified it away. Only the risk that *survives diversification* is risk everyone is forced to hold, and that is what commands a reward. Hence expected return depends on beta, not on total variance.

### Q4. Compute a beta from numbers.

Stock A vs the market: `Cov(r_A, r_m) = 0.018`, `Var(r_m) = 0.012`.

```text
beta_A = 0.018 / 0.012 = 1.5
```

Stock A amplifies the market by 1.5x. With `r_f = 3%` and `E[r_m] = 9%`:

```text
E[r_A] = 0.03 + 1.5*(0.09 - 0.03) = 0.03 + 1.5*0.06 = 0.12 = 12%
```

Sanity checks: beta 1 would give 9% (the market); beta 0 gives 3% (the risk-free rate); beta 1.5 sits above the market, consistent with taking 1.5x the systematic risk. If you also knew A's total volatility, you could back out its idiosyncratic piece via `Var(r_A) = beta^2*Var(r_m) + Var(eps)` — but note that extra idiosyncratic risk does **not** raise A's expected return under CAPM.

### Q5. What is the security market line, and what does it mean for an asset to be above it?

The **SML** plots expected return against beta:

```text
E[r]
  |               .  SML: E[r] = r_f + beta*(E[r_m]-r_f)
  |            .
  |         .   * asset above line -> underpriced (positive alpha)
  |      .    o asset below line  -> overpriced  (negative alpha)
  |   .
 r_f-+___________________________ beta
     0        1
```

Every asset should plot *on* the SML in equilibrium. Its slope is the market risk premium; its intercept is `r_f`; the market portfolio sits at `(beta=1, E[r_m])`.

**Above the line** means the asset offers more expected return than its beta justifies — **positive alpha**, i.e. underpriced. Investors buy it, pushing its price up and expected return down until it falls back onto the line. **Below the line** = negative alpha, overpriced, sell it. So alpha is the vertical distance from the SML, and in an efficient market it should be zero. Note the SML (return vs beta, for all assets) differs from the capital market line (return vs total sigma, for efficient portfolios only).

### Q6. What is alpha, and how do you interpret a strategy with positive alpha?

**Alpha** is the intercept in the excess-return regression `r_p - r_f = alpha + beta*(r_m - r_f) + eps` — the average return *not explained* by market exposure. Positive alpha means the strategy beat what its beta alone would predict.

Three interpretations, in increasing skepticism:
1. **Genuine skill / mispricing** — the manager found real edge the market missed.
2. **Uncompensated factor exposure** — the "alpha" is really a loading on a risk factor missing from your model. Regress against Fama-French + momentum and CAPM alpha often shrinks to zero: it was a value or size tilt, not skill. Hence "yesterday's alpha is today's beta."
3. **Luck or data-mining** — with enough backtests, some strategy shows positive alpha by chance; the fix is out-of-sample testing and t-stats.

The professional stance: an alpha is only credible if it survives (a) controlling for known factors, (b) transaction costs, and (c) out-of-sample validation. A statistically significant alpha (high t-stat, e.g. > 3 given multiple-testing) against a *multi-factor* benchmark is the real prize; alpha against CAPM alone is weak evidence.

### Q7. What are CAPM's assumptions, and what are the main empirical criticisms?

**Assumptions.** (1) Investors are mean-variance optimizers with the same one-period horizon. (2) Homogeneous expectations — everyone agrees on mu and Sigma. (3) Frictionless markets: no taxes, no transaction costs, unlimited borrowing/lending at `r_f`. (4) All assets tradable and infinitely divisible; everyone is a price taker. Under these, everyone holds the tangency = market portfolio, giving the SML.

**Criticisms.**
- **The SML is too flat.** Empirically, low-beta stocks earn more than CAPM predicts and high-beta stocks less — the "low-volatility anomaly." Betting-against-beta strategies exploit this.
- **Size and value effects.** Small-cap and high book-to-market (value) stocks have historically earned returns CAPM cannot explain — the seed of Fama-French.
- **Momentum.** Past winners keep winning over 3-12 months; pure CAPM has no room for it.
- **Roll's critique.** The true market portfolio (all wealth: stocks, bonds, human capital, real estate) is unobservable; any test uses a proxy, so CAPM is arguably untestable.
- **Single period / static.** Real investors have multi-period horizons and changing investment opportunities.

The upshot: CAPM is the right *intuition* (only systematic risk is priced) with the wrong *count of factors* — which is why multi-factor models replaced it.

### Q8. Explain Arbitrage Pricing Theory and how it differs from CAPM.

**APT** posits that asset returns are driven by a linear combination of K systematic factors plus idiosyncratic noise:

```text
r_i = E[r_i] + b_i1*F_1 + b_i2*F_2 + ... + b_iK*F_K + epsilon_i
```

and, by a **no-arbitrage** argument, expected excess return is a linear function of the factor loadings times each factor's risk premium `lambda_k`:

```text
E[r_i] - r_f = b_i1*lambda_1 + ... + b_iK*lambda_k
```

**Differences from CAPM.**
- **Foundation:** APT rests on *no-arbitrage* (if two portfolios with identical factor exposures had different returns, you could arbitrage), not on the strong equilibrium/utility assumptions of CAPM. Weaker, more general assumptions.
- **Factors:** APT allows *several* factors (inflation, GDP, rates, credit spreads), and does not tell you what they are — you choose/discover them. CAPM has exactly one, the market.
- **Testability:** APT's agnosticism about factor identity is a strength (flexible) and a weakness (no theory says which factors). CAPM is more falsifiable but empirically weaker.

CAPM is the special case of APT with a single factor equal to the market. Fama-French is essentially APT made concrete with empirically chosen factors.

### Q9. Describe the Fama-French three-factor model and add momentum.

Fama and French augmented CAPM with two empirically motivated factors:

```text
r_i - r_f = alpha + b*(r_m - r_f) + s*SMB + h*HML + eps
```

- **Market** `(r_m - r_f)` — as in CAPM.
- **SMB (Small Minus Big)** — return of small-cap minus large-cap stocks; captures the **size premium**.
- **HML (High Minus Low)** — return of high book-to-market (value) minus low (growth) stocks; captures the **value premium**.

Adding **momentum** (Carhart four-factor) appends:

- **WML / UMD (Winners Minus Losers, Up Minus Down)** — long past-12-month winners, short losers; captures the **momentum premium**.

The loadings `s`, `h`, and the momentum coefficient tell you the portfolio's tilts. A fund's return that looked like alpha under CAPM often shows up as a positive `s` and `h` here — it was a small-value tilt, not skill. Fama-French dramatically raises explanatory power (R^2 often 0.9+ for diversified equity portfolios). Later work added **profitability (RMW)** and **investment (CMA)** for a five-factor model. The whole "factor investing"/smart-beta industry is built on harvesting these premia cheaply.

### Q10. What exactly is a "factor" and a "risk premium"?

A **factor** is a source of *common, systematic variation* in returns — something that moves many assets together and cannot be diversified away. The market is a factor; so are size, value, momentum, and macro variables like rates or inflation. Operationally a factor is usually a *long-short portfolio* (e.g. long value, short growth) whose return series `F_t` is the factor. An asset's exposure to it is its **loading** (regression beta on `F`).

A **risk premium** is the *extra expected return* earned for bearing exposure to a factor — the price the market attaches to that risk. For the market factor it is `E[r_m] - r_f`; for HML it is the average return of the value-minus-growth portfolio. Formally, expected excess return = sum over factors of (loading * premium).

**Why premia exist.** Two stories. (1) **Risk-based:** the factor pays off badly in bad times (recessions), so investors demand compensation to hold it — a rational premium. (2) **Behavioral:** systematic mistakes (overreaction, underreaction) create mispricing that persists because of limits to arbitrage. Momentum is often explained behaviorally; value/size have both stories. A "risk premium" you cannot tie to either — bad-times payoff or a persistent behavioral cause — is probably a data-mined artifact.

### Q11. How do you estimate beta by OLS? Show the regression and pitfalls.

Collect T periods of excess returns and run:

```text
y_t = r_i,t - r_f,t         (asset excess return)
x_t = r_m,t - r_f,t         (market excess return)
y_t = alpha + beta*x_t + eps_t
```

```python
import numpy as np
X = np.column_stack([np.ones_like(x), x])   # intercept + market
coef = np.linalg.lstsq(X, y, rcond=None)[0] # [alpha, beta]
alpha, beta = coef
# standard errors from residual variance:
resid = y - X @ coef
s2 = resid @ resid / (len(y) - 2)
cov = s2 * np.linalg.inv(X.T @ X)
se_beta = np.sqrt(cov[1, 1])
t_beta = beta / se_beta
```

**Pitfalls.** (1) *Window choice* — too short = noisy, too long = stale (beta drifts). 2-5 years of weekly/monthly data is common. (2) *Frequency* — daily data introduces microstructure noise and non-synchronous trading (illiquid stocks look lower-beta; Dimson correction lags). (3) *Non-stationarity* — beta changes with leverage and business conditions. (4) *Heteroskedasticity/autocorrelation* — use robust (Newey-West) standard errors. (5) *Shrinkage* — raw betas are noisy; practitioners shrink toward 1 (Blume adjustment: `beta_adj = 0.67*beta_raw + 0.33*1`) because betas mean-revert.

### Q12. If a stock has zero beta, must its expected return equal the risk-free rate? Even if it is very volatile?

**Yes, under CAPM.** Set `beta = 0` in `E[r] = r_f + beta*(E[r_m]-r_f)` and you get `E[r] = r_f`, regardless of the stock's total volatility. A zero-beta stock is uncorrelated with the market, so all of its (possibly large) variance is idiosyncratic — and idiosyncratic risk is diversifiable, hence unpriced. Held inside a diversified portfolio its standalone volatility contributes nothing to systematic risk, so the market offers no premium for it.

This is the single most counterintuitive CAPM result and a favorite interview trap: **a wildly volatile stock can have the same expected return as a T-bill** if that volatility is uncorrelated with the market. The volatility feels scary in isolation but is free to eliminate. (In reality the empirical low-vol anomaly says such stocks often earn *more* than `r_f`, which is one of the failures motivating multi-factor models — but the clean CAPM answer is exactly `r_f`.)

### Q13. Portfolio beta: how do betas aggregate, and how do you hedge market exposure?

**Beta is linear in weights** because covariance is linear:

```text
beta_p = sum_i w_i * beta_i
```

A portfolio's market exposure is just the weighted average of its holdings' betas — much simpler than variance, which needs the whole covariance matrix. Example: 60% in beta-1.2 equities and 40% in beta-0.0 cash gives `beta_p = 0.6*1.2 = 0.72`.

**Hedging to market-neutral.** To strip out market risk, short enough of the market (via index futures/ETF) to drive portfolio beta to zero. If you hold V dollars with beta `beta_p`, short `beta_p * V` dollars of the market:

```text
beta_hedged = beta_p - (beta_p*V)/V * 1 = 0
```

More generally, the number of index-future contracts to hedge is `N = -beta_p * V / (futures_price * multiplier)`. After hedging, the portfolio's return is (ideally) pure alpha plus idiosyncratic noise — the goal of a market-neutral or equity long-short strategy. This is the practical payoff of beta: it is the exact dose of systematic exposure you can add or remove at will.

### Q14. Why is a factor model a good way to build the covariance matrix?

Estimating the full N-by-N sample covariance needs `N*(N+1)/2` parameters and is noisy/singular when observations are scarce (see [[Portfolio Theory & Optimization]] Q14). A **factor model** imposes structure: assume returns are driven by K << N common factors,

```text
r = alpha + B*f + eps
```

where B is the N-by-K loading matrix, f the factor returns, and eps idiosyncratic. Then the covariance factorizes:

```text
Sigma = B * F * B' + D
```

with F the K-by-K factor covariance and D a diagonal matrix of idiosyncratic variances. Now you estimate only `N*K` loadings + a small `K*K` factor covariance + N diagonal terms — far fewer parameters, so much less noise. The result is **guaranteed well-conditioned and invertible** (great for the optimizer's `Sigma^{-1}`), and interpretable (you can see each asset's exposures). This is the same "impose structure to beat estimation error" idea as shrinkage — indeed, Ledoit-Wolf often shrinks toward a single-factor (CAPM) covariance target. Risk models like Barra are industrial-strength versions of exactly this.

### Q15. What is the low-volatility (or betting-against-beta) anomaly, and why does it challenge CAPM?

Empirically, low-beta and low-volatility stocks have delivered **higher risk-adjusted returns** than high-beta stocks — the opposite of CAPM's prediction that return rises with beta. Plotted, the realized SML is much *flatter* than theory (sometimes even downward-sloping): high-beta stocks underdeliver, low-beta overdeliver.

**Why it challenges CAPM.** CAPM says the slope of expected return vs beta equals the positive market premium. If the realized slope is near zero, either beta is not priced as CAPM claims or the model is missing something.

**Explanations.** (1) *Leverage constraints* (Frazzini-Pedersen): investors who want high returns but cannot borrow bid up high-beta stocks instead, overpricing them and depressing their future returns — so a strategy that *levers up low-beta and shorts high-beta* ("betting against beta") earns a premium. (2) *Lottery preferences:* some investors overpay for volatile, lottery-like stocks, overpricing high-vol names. (3) *Benchmarking:* managers judged against an index avoid low-beta stocks, leaving them cheap. The anomaly is now itself a **factor** (BAB), reinforcing the theme that CAPM's single-factor world is too simple.

### Q16. "Alpha is just beta you don't understand yet." Explain and give the professional takeaway.

The slogan means that much of what looks like manager skill (alpha) is really *exposure to a systematic risk factor* the evaluation model failed to include. A manager who tilts toward small, cheap, high-momentum stocks will show large positive alpha under **CAPM**, because CAPM only controls for the market. Regress the same returns against **Fama-French + momentum** and the alpha typically collapses toward zero, while the size/value/momentum loadings light up. The "skill" was a harvestable factor premium available cheaply through a passive factor ETF — beta, not alpha.

**Professional takeaway.** (1) Always evaluate performance against the *richest reasonable factor model*, not just the market; alpha is only meaningful relative to what you have controlled for. (2) True alpha — return unexplained by all known factors, robust out-of-sample and net of costs — is rare and valuable; most apparent alpha is disguised factor beta or luck. (3) This reframes active management: identify which premia you are collecting, pay factor-fund prices for factor exposure, and reserve alpha fees for the genuinely unexplained residual. It is the same regression discipline used to hedge and to build factor covariance models throughout this primer.

## Options & Derivatives Fundamentals

### Summary

**What this topic covers**

The building blocks of derivatives before any stochastic-calculus pricing: what calls and puts pay, how their payoffs combine, and what no-arbitrage alone (no probability model) tells you about prices. Three concern areas live here: (1) the **contracts and payoffs** — calls `max(S-K, 0)`, puts `max(K-S, 0)`, long vs short, and the payoff-diagram language used to reason about every strategy; (2) the **model-free relationships** — put-call parity `C - P = S - K*exp(-r*T)`, no-arbitrage price bounds, intrinsic vs time value, moneyness, and forward/futures pricing `F = S*exp((r-q)*T)`; and (3) **strategy construction** — covered calls, protective puts, spreads, and straddles as sums of these payoffs. The 16 questions run from "draw a call payoff" to "derive put-call parity by no-arbitrage and use it to price a synthetic." Everything here is derived from replication and arbitrage, not from a distribution — which is exactly what makes it bullet-proof and the natural on-ramp to Black-Scholes and risk-neutral pricing.

**Mental model**

Think of every derivative as a *payoff function of the underlying at expiry* plus a *cost today*, and think of pricing as **replication**: if you can build a package of stock, cash, and other options that pays exactly what a target instrument pays in every future state, the two must cost the same today — otherwise you arbitrage. That single principle (the law of one price) generates almost all of this topic without any probability. Payoff diagrams are the visual algebra: draw profit against the terminal stock price `S_T`, and complex strategies become sums of hockey-stick lines. A call is a right, not an obligation, so its holder has *limited downside* (the premium) and *unlimited upside* — an asymmetry that is the whole point. The seller has the mirror image. Time value exists because before expiry there is still a chance the option moves further into the money; it decays to zero at expiry, leaving only intrinsic value. Forwards are the simplest derivative: lock a price now, pay later, and no-arbitrage forces `F = S*exp((r-q)*T)`.

**Key terms**

- **Call option** — right to *buy* the underlying at strike K; payoff `max(S_T - K, 0)`.
- **Put option** — right to *sell* at K; payoff `max(K - S_T, 0)`.
- **Long vs short** — long = holder (paid premium, has the right); short = writer (received premium, has the obligation).
- **Strike K / expiry T** — the agreed price and date.
- **Premium** — the price paid today for the option.
- **Moneyness** — ITM (in the money, positive intrinsic), ATM (at the money, S ~ K), OTM (out of the money, zero intrinsic).
- **Intrinsic value** — payoff if exercised now: `max(S-K, 0)` for a call, `max(K-S, 0)` for a put.
- **Time value** — option price minus intrinsic value; the premium for remaining optionality.
- **Put-call parity** — `C - P = S - K*exp(-r*T)`; a model-free link between call, put, stock, and bond.
- **Forward/futures price** — `F = S*exp((r-q)*T)`; the no-arbitrage delivery price (q = dividend/carry yield).
- **European vs American** — exercise only at T vs any time up to T.
- **Payoff vs profit** — payoff ignores the premium; profit = payoff minus (premium grown at r).

**Why interviewers ask this**

Derivatives fundamentals separate candidates who *reason from no-arbitrage* from those who memorized formulas. The junior signal is fluency with payoffs: draw a call and a put, know who has the obligation, compute a straddle's break-evens. The senior signal is the ability to *derive* relationships by replication — proving put-call parity by constructing two portfolios with identical terminal payoffs, or bounding an option's price without any model. Interviewers love put-call parity because it tests whether you understand that a call, a put, the stock, and a bond are three degrees of freedom, not four: given any three you can synthesize the fourth. They also probe intuition (why is a call worth more than its intrinsic value? why might an American call on a non-dividend stock never be exercised early?) because these reveal whether you grasp optionality and carry. This is the foundation the entire Black-Scholes and Greeks apparatus is built on.

**Common confusions**

- "The option payoff includes the premium" — payoff is `max(S-K,0)`; *profit* subtracts the premium. Break-even is strike +/- premium, not the strike.
- "Put-call parity needs a pricing model" — it is pure no-arbitrage, model-free; it holds for European options regardless of how S moves.
- "Time value can be negative" — for European options deep ITM it can look like the option trades below intrinsic due to discounting, but properly measured against the *forward*, time value is non-negative.
- "Buying a call is always bullish leverage with no downside" — downside is capped at the premium, but that premium is 100% at risk; OTM calls expire worthless routinely.
- "Futures and forward prices are always identical" — equal under deterministic rates; they differ when rates are correlated with the underlying because futures are marked-to-market daily.
- "Higher volatility helps the option seller" — higher vol *raises* option value, hurting the short; sellers are short volatility.

**What follows from this topic**

These no-arbitrage relationships are the skeleton that Black-Scholes puts flesh on: put-call parity means you only ever need to price a call, and the forward price `F = S*exp((r-q)*T)` is the drift the underlying takes under the risk-neutral measure. The idea that price = cost of a replicating portfolio becomes, under a probability model, `price = exp(-r*T)*E^Q[payoff]` — risk-neutral valuation. Payoff-diagram thinking scales up to the Greeks (delta is the slope of the price curve, gamma its curvature) and to volatility trading (a straddle is a bet on realized vs implied vol). And the bounds derived here are the sanity checks every pricing model must respect. Master replication and arbitrage here and the rest of derivatives pricing is "the same idea with a distribution attached."

### Q1. Define calls and puts, and draw their payoff diagrams at expiry.

A **call** gives the right to *buy* at strike K; a **put** the right to *sell* at K. At expiry the holder exercises only if it is profitable, giving kinked payoffs:

```text
Long CALL payoff = max(S_T - K, 0)      Long PUT payoff = max(K - S_T, 0)

payoff                                   payoff
  |            /                          |\
  |           /                           | \
  |          /                            |  \
  |         /                             |   \
  0________/________ S_T                  0____\________ S_T
          K                                    K
```

The call pays nothing below K, then rises 1-for-1 above it (unlimited upside). The put pays `K` at `S_T = 0`, declines to zero at K, then stays flat (upside capped at K because the stock cannot go below zero). These are *payoffs*, ignoring the premium; subtract the premium (grown at the risk-free rate) to get *profit*, which shifts each line down and sets the break-even at `K + call_premium` or `K - put_premium`.

### Q2. Draw the short positions and explain the risk asymmetry.

Shorts are the mirror image (reflect across the horizontal axis) — the writer's payoff is the negative of the holder's:

```text
Short CALL = -max(S_T-K,0)             Short PUT = -max(K-S_T,0)

  0____________ S_T                      0___________/ S_T
       \    K                             \    K    /
        \                                  \       /
         \                                  \     /
          \  (unlimited loss)                (loss down to -K)
```

**Asymmetry.** The option *holder* has limited loss (the premium) and, for a call, unlimited gain — a convex, insurance-like payoff. The *writer* has the opposite: they collect a small premium up front (their maximum profit) but face large or unlimited losses. A short call has *theoretically unlimited* loss (stock can rise without bound); a short put's loss is bounded at `K` (stock floored at zero) but can still be severe. This is why naked option selling is dangerous: you are picking up pennies (premium) in front of a steamroller. Sellers are compensated for bearing that tail risk — and for being short volatility, since higher vol raises the value of what they owe.

### Q3. Distinguish intrinsic value, time value, and moneyness.

**Intrinsic value** = payoff if exercised right now = `max(S-K, 0)` for a call, `max(K-S, 0)` for a put. It is never negative — you would not exercise at a loss.

**Time value** = option price - intrinsic value. It is the premium for *remaining optionality*: the chance the option moves further into the money before expiry. It is largest at-the-money (most uncertainty about final moneyness) and decays to zero at expiry, when only intrinsic value remains.

**Moneyness** describes where the spot sits relative to the strike:

| | Call | Put |
|---|---|---|
| In the money (ITM) | S > K | S < K |
| At the money (ATM) | S ~ K | S ~ K |
| Out of the money (OTM) | S < K | S > K |

An OTM option has *zero* intrinsic value — it is *all* time value. A deep-ITM option is mostly intrinsic value with little time value (little uncertainty left about whether it finishes ITM). Example: stock at 105, call strike 100, price 8 -> intrinsic 5, time value 3, and it is ITM.

### Q4. Prove put-call parity by no-arbitrage.

Consider two portfolios on a European call and put with the same K and T (no dividends):

```text
Portfolio A: long 1 call + cash K*exp(-r*T) invested at r
Portfolio B: long 1 put  + 1 share of stock
```

Value each at expiry T, for both `S_T > K` and `S_T <= K`:

```text
                    S_T <= K        S_T > K
Portfolio A:   0 + K = K        (S_T-K)+K = S_T
Portfolio B:  (K-S_T)+S_T = K    0 + S_T = S_T
```

In **every** state the two portfolios pay identically (K if below strike, `S_T` if above — both are `max(S_T, K)`). By the law of one price they must cost the same today:

```text
C + K*exp(-r*T) = P + S
=>  C - P = S - K*exp(-r*T)
```

No probabilities, no model — just replication. If the equality broke, say `C - P > S - K*exp(-r*T)`, you would short the expensive side (sell call, buy put, buy stock, borrow) and lock in a riskless profit. Arbitrage forces parity.

### Q5. Use put-call parity to build a synthetic position and to spot mispricing.

Rearranging `C - P = S - K*exp(-r*T)` lets you synthesize any leg from the other three:

```text
Synthetic call:   C = P + S - K*exp(-r*T)        (put + stock + borrow)
Synthetic stock:  S = C - P + K*exp(-r*T)         (call - put + bond)
Synthetic put:    P = C - S + K*exp(-r*T)
Conversion:       S - C + P = K*exp(-r*T)  (riskless bond)
```

**Mispricing example.** Say `S = 100`, `K = 100`, `T = 1`, `r = 5%`, so `K*exp(-r*T) = 95.12`. Parity requires `C - P = 100 - 95.12 = 4.88`. Suppose the market shows `C = 8`, `P = 2`, so `C - P = 6 > 4.88` — the call is rich relative to the put. Arbitrage: **sell the call, buy the put, buy the stock, and borrow** `K*exp(-r*T)`. Net cash in today = `8 - 2 - 100 + 95.12 = 1.12`; at expiry the long put + stock + short call combo is worth exactly K = 100, which repays the loan, leaving the `1.12` as riskless profit. Traders run this "conversion/reversal" arbitrage to keep parity tight; deviations reflect only frictions (borrow cost, dividends, early-exercise for American).

### Q6. Derive the no-arbitrage price bounds for a European call.

Let C be a European call, no dividends. Two bounds fall out of no-arbitrage:

**Upper bound: C <= S.** The call can never be worth more than the stock — it is the right to *buy* the stock, which is worth at most owning the stock outright. If `C > S`, sell the call and buy the stock; you profit and are fully hedged.

**Lower bound: C >= max(S - K*exp(-r*T), 0).** From put-call parity `C = P + S - K*exp(-r*T)`, and since `P >= 0`, we get `C >= S - K*exp(-r*T)`. Also `C >= 0` (limited liability). Combine:

```text
max(S - K*exp(-r*T), 0)  <=  C  <=  S
```

**Key consequence.** The lower bound `S - K*exp(-r*T)` *exceeds the intrinsic value* `S - K` (because `K*exp(-r*T) < K`). So a European call always trades **above its intrinsic value** while time remains — the extra is time value, driven by the discounting of the strike and the option's convexity. The analogous put bounds are `max(K*exp(-r*T) - S, 0) <= P <= K*exp(-r*T)`.

### Q7. Show that an American call on a non-dividend-paying stock is never optimally exercised early.

Take an American call, strike K, no dividends. Compare exercising now versus holding.

Exercising now yields intrinsic value `S - K`. But from Q6, the call is worth at least `S - K*exp(-r*T)` if held (a European call already dominates intrinsic; the American is worth at least the European):

```text
C_American >= S - K*exp(-r*T) > S - K   (since exp(-r*T) < 1 for r>0, T>0)
```

So the *live* option is always worth strictly more than the `S - K` you would get by exercising. Two intuitions for **why you should never exercise early**: (1) exercising throws away the remaining time value; (2) by waiting you keep your cash (you have not yet paid K), earning interest on it, and you retain downside protection — if the stock crashes you simply do not exercise. Since there are no dividends to capture by owning the stock early, there is no offsetting benefit. Therefore an American call on a non-dividend stock has the *same value as the European* call — you may as well never exercise before T. (Puts and dividend-paying calls **can** be worth exercising early, so this result is call-and-no-dividend specific.)

### Q8. Derive the forward price by no-arbitrage. Extend to a dividend/carry yield.

A forward locks in a price F to buy the asset at T. To find F with no arbitrage, replicate the forward with a **cash-and-carry**: buy the asset now for S, financed by borrowing at r; at T you owe `S*exp(r*T)` and hold the asset. This exactly delivers the asset at T at a locked cost:

```text
F = S*exp(r*T)      (no income on the asset)
```

If `F` were higher, sell the forward and do cash-and-carry for riskless profit; if lower, do the reverse (short the asset, lend the cash). 

**With a continuous income/carry yield q** (dividends on a stock, a foreign interest rate on FX, a convenience yield on a commodity), holding the asset earns q, which offsets the financing cost:

```text
F = S*exp((r - q)*T)
```

Intuition: F is the spot compounded at the *net cost of carry* r - q. If the asset pays you to hold it (q > r), the forward trades *below* spot (backwardation); if carrying is expensive (q < r), it trades above (contango). This F is also the drift the underlying takes under the risk-neutral measure — the bridge to Black-Scholes.

### Q9. How do forwards and futures differ, and when do their prices diverge?

**Contract mechanics.** A **forward** is a single OTC agreement settled once at expiry — no cash changes hands until T. A **future** is exchange-traded, standardized, and **marked-to-market daily**: gains/losses are settled every day through a margin account, backed by a clearinghouse (so almost no counterparty risk).

**Pricing.** Under *deterministic* interest rates the two have the same theoretical price, `F = S*exp((r-q)*T)`. They **diverge when rates are stochastic and correlated with the underlying**, because daily marking interacts with reinvesting/financing the daily cashflows:

- If the underlying is *positively* correlated with rates, a futures holder tends to receive daily gains when rates are high (reinvest at high rates) and pay losses when rates are low (borrow cheaply) — an advantage — so **futures price > forward price**.
- If *negatively* correlated, the reverse, so **futures < forward**.

The gap is tiny for short maturities and small for most equities, but material for long-dated interest-rate products (e.g. the "convexity adjustment" between Eurodollar futures and forward rates). Other practical differences: futures have daily margin/liquidity demands and basis risk from standardization; forwards have counterparty/credit risk but exact customization.

### Q10. Build a covered call and a protective put as payoff combinations.

Both combine stock with one option; draw the summed payoff.

**Covered call** = long stock + short call (strike K). You own the stock and sell someone the right to buy it at K, collecting premium.

```text
profit
  |        _______  (capped at K - S0 + premium)
  |       /
  |      /
  |_____/___________ S_T
       /  K
  ----/  (downside = stock, cushioned by premium)
```

Caps your upside at K in exchange for premium income; you keep full downside (minus the premium cushion). It is a bet that the stock stays flat-to-mildly-up, and a way to monetize a holding — but you are short the tail if it rallies.

**Protective put** = long stock + long put (strike K). Insurance: the put floors your loss at `K - premium`.

```text
profit
  |          /
  |         /
  |________/  <- floor at (K - S0 - premium)
  |       K
  |_______________ S_T
```

Below K the put gains offset stock losses (loss capped); above K you keep the upside minus the put premium paid. Same shape as a long call (put-call parity: stock + put = call + bond). It is portfolio insurance — you pay a premium to cap the downside.

### Q11. Construct a bull call spread and compute its break-even and max payoff.

A **bull call spread** = long a call at low strike K1 + short a call at higher strike K2 (K2 > K1), same expiry. You buy cheap upside and sell away the far upside to reduce cost.

```text
payoff
  |         ______  (capped at K2 - K1)
  |        /
  |       /
  0______/________ S_T
       K1   K2
```

Let net premium paid = `c1 - c2` (long call costs more than the short one). Then:

```text
Max loss   = net premium paid            (if S_T <= K1)
Max payoff = (K2 - K1) - net premium     (if S_T >= K2)
Break-even = K1 + net premium
```

**Worked example.** K1 = 100 (call costs 6), K2 = 110 (call costs 2). Net premium = 4. Max loss = 4 (below 100). Max profit = (110-100) - 4 = 6 (above 110). Break-even = 104. It is a *defined-risk bullish* bet: cheaper than an outright call and profitable on a moderate rise, at the cost of capping gains above K2. A **bear put spread** is the mirror (long high-strike put, short low-strike put) for a defined-risk bearish view.

### Q12. Explain a long straddle. What is it a bet on, and where are the break-evens?

A **long straddle** = long a call + long a put at the *same* strike K (usually ATM) and expiry. You pay both premiums and profit from a large move in *either* direction.

```text
payoff
  |\            /
  | \          /
  |  \        /
  |   \______/
  0__________________ S_T
          K
break-even  K-(c+p)   K+(c+p)
```

```text
Payoff  = |S_T - K|
Cost    = c + p  (call premium + put premium)
Break-evens = K - (c + p)  and  K + (c + p)
Max loss    = c + p  (if S_T = K exactly)
```

**What it is a bet on.** A straddle is *long volatility* — it profits if realized volatility exceeds what the premiums imply, regardless of direction. You buy it before an event (earnings, a vote) expecting a big move; you lose if the stock sits still and the premiums decay (theta). Formally you are betting **realized vol > implied vol** priced into the options. The mirror trade, a **short straddle**, is short volatility: collect both premiums, profit if the stock barely moves, but face large losses on a big move. A **strangle** is the cheaper OTM version (call and put at different strikes), needing an even bigger move to pay off.

### Q13. Why is an option worth more than its intrinsic value? What drives time value?

An option's price = intrinsic value + **time value**, and time value is positive whenever expiry is in the future because of **optionality plus carry**.

**Optionality (convexity).** The payoff `max(S-K, 0)` is convex — asymmetric. Before expiry the stock can still move; upside moves increase the payoff without bound while downside moves are floored at zero. By Jensen's inequality, this asymmetry makes the expected payoff strictly greater than the payoff at today's price. The more uncertainty (volatility, time), the larger this premium — hence time value peaks at-the-money and grows with vol and with time to expiry.

**Carry / discounting.** For a call, the lower no-arbitrage bound is `S - K*exp(-r*T) > S - K`: by not exercising you defer paying the strike and earn interest on that cash, adding value.

Together these mean a live option always exceeds intrinsic value. Time value **decays** (theta) as expiry nears — accelerating near the end for ATM options — because there is progressively less time for a favorable move. At expiry, uncertainty is gone and only intrinsic value remains. This is the seed of the Greeks: vega measures sensitivity of the time-value premium to volatility, theta its decay through time.

### Q14. Is an option's value increasing or decreasing in volatility, in strike, and in time? Give the intuition.

Reason from the convex payoff and no-arbitrage — no formula needed.

- **Volatility (both calls and puts increase).** Higher vol widens the distribution of `S_T`. Because the payoff is floored at zero (limited downside) but open on one side, fatter tails help: the extra upside is captured, the extra downside is truncated. So more vol = more valuable option. This is why long options = long vol, short options = short vol.
- **Strike K.** A **call** *decreases* in K (right to buy cheaper is worth more, so lower K = higher call value). A **put** *increases* in K (right to sell higher is worth more).
- **Time to expiry T.** For American options, more time is always weakly better (more chances, more optionality) so value increases in T. For **European** options it *usually* increases but not strictly always — a European put can occasionally be worth less with more time because the discounting of the strike (you receive K later) can dominate; European calls on non-dividend stocks always increase in T.
- **Interest rate r.** Calls increase (you defer paying K, worth more when r is high); puts decrease (you receive K later).

These monotonicity facts are model-free arbitrage results and the qualitative content of the Greeks (vega > 0, rho sign, theta).

### Q15. Explain a risk reversal and a butterfly as payoff combinations, and what each expresses.

Both are multi-leg structures assembled from the payoff algebra.

**Risk reversal** = long an OTM call (strike K2) + short an OTM put (strike K1), K1 < K2, same expiry. Often structured for near-zero net premium (the put premium funds the call).

```text
profit
  |            /
  |           /
  |__________/________ S_T
      K1     K2
  ---/  (downside like short put)
```

It is a *bullish, leveraged directional* bet: you gain on a rally above K2 and are exposed to losses below K1 — synthetically similar to being long the stock but skewed. In FX/equities the *price* of a risk reversal (call IV minus put IV) is a market-quoted measure of **skew** — how much more the market pays for downside puts than upside calls.

**Butterfly** = long one call at K1, short two calls at K2, long one call at K3, equally spaced (K2 in the middle). Cheap, defined risk.

```text
payoff
  |        /\
  |       /  \
  0______/____\______ S_T
      K1  K2  K3
```

It pays off maximally if the stock finishes right at K2 and expires worthless outside `[K1, K3]`. It is a bet that the stock **pins near K2** — i.e. a bet on *low* realized volatility / low movement, with strictly limited loss (the small net premium). The opposite view (big move away from the center) is a short butterfly.

### Q16. Two options differ only in strike. What must be true about their prices? (Vertical spread arbitrage bounds.)

For two European calls with strikes `K1 < K2`, same expiry, no-arbitrage forces three monotonicity/convexity constraints:

**1. Monotonic in strike:** `C(K1) >= C(K2)`. A call to buy at a lower strike is worth at least as much as one at a higher strike (more valuable right). Violation -> buy the cheap low-strike call, sell the dear high-strike call for riskless profit.

**2. Bounded slope:** `C(K1) - C(K2) <= (K2 - K1)*exp(-r*T)`. The price drop between strikes cannot exceed the discounted strike gap, because a bull call spread's payoff is capped at `K2 - K1`. Its cost cannot exceed the present value of its max payoff.

```text
0 <= C(K1) - C(K2) <= (K2 - K1)*exp(-r*T)
```

**3. Convexity in strike (butterfly):** for `K1 < K2 < K3` equally spaced, `C(K1) - 2*C(K2) + C(K3) >= 0`. Call price is a convex function of strike. If it were violated, a long butterfly (Q15) would have a positive payoff for zero or negative cost — free money.

These are the model-free constraints any valid option surface must satisfy; arbitrage-free pricing models (Black-Scholes and beyond) are guaranteed to respect them, and quoted-market surfaces are checked against them to catch stale or erroneous prices. They are the strike-dimension analogue of the calendar (time) and put-call parity constraints.
## The Black-Scholes-Merton Model

### Summary

**What this topic covers**

The single most-tested result in quant interviews: the Black-Scholes-Merton (BSM) model for pricing European options. This topic has 16 questions and works through four layers. (1) The **assumptions** — the underlying follows geometric Brownian motion (GBM) with constant volatility sigma and constant risk-free rate r, markets are frictionless and continuous, short-selling and continuous rehedging are allowed, no arbitrage, and (baseline) no dividends. (2) The **derivation** — how a delta-hedged portfolio of one option and -Delta shares becomes instantaneously riskless, forcing it to earn r, which yields the BSM partial differential equation (PDE). (3) The **closed-form** call and put formulas with d1, d2, and the standard normal CDF N(.). (4) The **risk-neutral** reading — price = discounted expected payoff under the measure Q where the drift is r, not the real-world drift mu. Then the honest part: every assumption is wrong in some way, which is why the volatility smile exists.

**Mental model**

BSM is not really a formula — it is a **hedging argument**. The core insight (Black, Scholes, Merton, 1973) is that an option's randomness comes entirely from the same dW that drives the stock. So if you hold the option and short exactly Delta = dV/dS shares, the two dW terms cancel and over the next instant your portfolio has **no risk**. A riskless portfolio can only earn the risk-free rate r, or someone arbitrages you. Setting the portfolio's Itô drift equal to r*(portfolio value) gives a PDE that V(S,t) must satisfy — no mu anywhere, because hedging removed it. That is why two people who disagree about the stock's expected return still agree on the option price: the drift got hedged away. The closed form is just the solution of that PDE for a call/put payoff, and equivalently the discounted expectation of the payoff in a world where the stock drifts at r. Hold both pictures at once: PDE (hedging) and expectation (risk-neutral) are the same thing.

**Key terms**

- **GBM** — dS = mu*S*dt + sigma*S*dW; the assumed price dynamics, giving lognormal prices.
- **Delta-hedged portfolio** — Pi = V - Delta*S, chosen so the dW term vanishes.
- **BSM PDE** — V_t + 0.5*sigma^2*S^2*V_SS + r*S*V_S - r*V = 0.
- **d1, d2** — the standardized log-moneyness terms; d2 = d1 - sigma*sqrt(T).
- **N(.)** — standard normal CDF; N(d1) is the call delta, N(d2) the risk-neutral prob of finishing in-the-money.
- **Risk-neutral measure Q** — the pricing measure where drift = r and discounted prices are martingales.
- **Implied volatility** — the sigma that makes BSM match the market price; the model's one free input.
- **Volatility smile/skew** — implied vol varying with strike, direct evidence BSM's constant-vol assumption is false.
- **Dividend yield q** — continuous payout; replaces S with S*exp(-q*T) in the formula.
- **Time value vs intrinsic** — BSM value above the immediate exercise payoff, from optionality.

**Why interviewers ask this**

BSM separates people who **memorized** a formula from people who **understand** it. Anyone can write down d1 and d2; the signal is whether you can (a) derive the PDE from the hedging argument without notes, (b) explain why mu disappears, (c) interpret N(d2) as a probability and N(d1) as a delta, and (d) name what breaks in reality. Junior candidates recite the formula; senior candidates lead with "it's a no-arbitrage hedging argument" and treat the closed form as a corollary. Trading-desk interviewers especially care about the limitations — they trade the smile daily, so a candidate who thinks constant vol is fine is a red flag. Expect follow-ups pushing on every assumption.

**Common confusions**

- "The option's expected return matters" — no; the real-world drift mu is hedged away and never enters the price. Only r and sigma matter.
- "N(d2) is the probability the option ends in-the-money" — yes, but under the **risk-neutral** measure Q, not the real world. It is not the true probability.
- "N(d1) is also a probability" — it is the delta (and the ITM probability under the stock-numeraire measure); do not call it "the" probability.
- "BSM assumes the stock earns r" — only under Q for pricing. Under the real measure it earns mu; the two agree on the option price via hedging.
- "Higher volatility could lower an option's value" — never for a vanilla; vega is always positive because more dispersion helps the capped payoff.

**What follows from this topic**

BSM is the hub of derivatives pricing. Its sensitivities are [[The Greeks & Hedging]] — delta-hedging is literally the derivation. Its expectation form is generalized and justified in [[Risk-Neutral Pricing & Martingales]] (the measure Q, Girsanov, the fundamental theorem). Its broken constant-vol assumption motivates the volatility-modeling topics (smile, local vol, stochastic vol, GARCH). When there is no closed form (American, path-dependent, exotic), you fall back to trees, finite-difference PDE solvers, and Monte Carlo — all of which ultimately discretize either this PDE or this expectation.

### Q1. State the assumptions of the Black-Scholes-Merton model.

Interviewers want a crisp list, then awareness of which ones actually bite.

- **Underlying follows GBM**: dS = mu*S*dt + sigma*S*dW, so returns are normal and prices lognormal.
- **Constant, known volatility sigma** and **constant, known risk-free rate r**.
- **No arbitrage** and the ability to **borrow/lend at r** freely.
- **Frictionless, continuous markets**: no transaction costs, no taxes, infinitely divisible assets, short-selling allowed, and you can rehedge continuously.
- **No dividends** (baseline; extendable to a continuous yield q).
- **European exercise** — payoff only at maturity T (so no early-exercise problem).

Which ones matter most: **constant volatility is empirically false** (the smile), **continuous costless hedging is impossible** (discrete rehedging + costs), and GBM has **no jumps** and **thin tails**, whereas real returns jump and are fat-tailed. r being constant is a minor sin for equities, a bigger one for long-dated rate products.

### Q2. Derive the Black-Scholes-Merton PDE via a delta-hedged portfolio.

Let V(S,t) be the option value with dS = mu*S*dt + sigma*S*dW. By Itô's lemma:

```text
dV = ( V_t + mu*S*V_S + 0.5*sigma^2*S^2*V_SS )*dt + sigma*S*V_S*dW
```

Build a portfolio: long one option, short Delta shares, Pi = V - Delta*S.

```text
dPi = dV - Delta*dS
    = ( V_t + mu*S*V_S + 0.5*sigma^2*S^2*V_SS )*dt + sigma*S*V_S*dW
      - Delta*( mu*S*dt + sigma*S*dW )
```

Choose **Delta = V_S** to kill the dW (risk) term:

```text
dPi = ( V_t + 0.5*sigma^2*S^2*V_SS )*dt
```

Pi is now instantaneously riskless, so by no-arbitrage it must earn r: dPi = r*Pi*dt = r*(V - S*V_S)*dt. Equate:

```text
V_t + 0.5*sigma^2*S^2*V_SS = r*(V - S*V_S)
=> V_t + 0.5*sigma^2*S^2*V_SS + r*S*V_S - r*V = 0
```

That is the BSM PDE. The mu term cancelled the moment we set Delta = V_S — the whole point.

### Q3. Why does the drift mu disappear from the option price?

Because the hedge removes it. The option and the stock share the **same** source of randomness, dW. Holding -V_S shares against the option cancels the dW term exactly, so the hedged portfolio's growth no longer depends on which direction (or how fast, mu) the stock is expected to move — only on its **variance** (sigma) and the cost of carry (r).

Intuition: the price of an option is the cost of the hedging strategy that replicates it. That cost depends on how much the stock **wiggles** (sigma) and the **rate** at which you finance the hedge (r), not on your opinion of where the stock is headed. So a bull and a bear who agree on sigma and r must agree on the option price. This is exactly why risk-neutral pricing works: you may as well pretend everyone is risk-neutral and the drift is r, because the drift was never in the answer.

### Q4. Write down the Black-Scholes formula for a European call and put.

For a non-dividend stock:

```text
C = S*N(d1) - K*exp(-r*T)*N(d2)
P = K*exp(-r*T)*N(-d2) - S*N(-d1)

d1 = ( ln(S/K) + (r + sigma^2/2)*T ) / ( sigma*sqrt(T) )
d2 = d1 - sigma*sqrt(T)
```

N(.) is the standard normal CDF; S is spot, K strike, T time to maturity, r the risk-free rate, sigma the volatility. Read the call as: **S*N(d1)** is the present value of receiving the stock if exercised, and **K*exp(-r*T)*N(d2)** is the present value of paying the strike, weighted by the risk-neutral probability N(d2) of exercise. Note C and P automatically satisfy put-call parity C - P = S - K*exp(-r*T), since N(d1) - N(-d1) = ... actually since N(d1)+N(-d1)=1 and N(d2)+N(-d2)=1, subtracting the two formulas gives S - K*exp(-r*T).

### Q5. What is the risk-neutral valuation interpretation of the BSM price?

The BSM price equals the **discounted expected payoff under the risk-neutral measure Q**:

```text
V_0 = exp(-r*T) * E^Q[ payoff(S_T) ]
```

Under Q the stock drifts at r (not mu): S_T = S_0*exp((r - sigma^2/2)*T + sigma*W_T^Q), which is lognormal. For a call, computing exp(-r*T)*E^Q[max(S_T - K, 0)] with that lognormal density gives exactly S*N(d1) - K*exp(-r*T)*N(d2).

Why is this legitimate even though real investors are risk-averse and the stock really drifts at mu? Because the option is **replicable** by dynamically trading the stock and bond, and the replicating cost does not depend on mu (Q3). So you are free to compute that cost in the most convenient world — the risk-neutral one — where all assets earn r and you just discount expected payoffs. This is the bridge to [[Risk-Neutral Pricing & Martingales]].

### Q6. What is the interpretation of N(d2) and N(d1)?

**N(d2)** is the **risk-neutral probability that the option finishes in-the-money**, i.e. Q(S_T > K). In the term K*exp(-r*T)*N(d2), it weights the strike you pay by the chance you actually exercise.

**N(d1)** is the option's **delta** — the number of shares to hold to hedge — and equals the ITM probability under the measure that uses the **stock as numeraire**. In the term S*N(d1), it is the risk-neutral expected value of receiving the stock conditional on exercise, appropriately discounted.

The subtlety interviewers probe: N(d2) < N(d1), and **neither is the real-world probability of finishing ITM** (that would use the real drift mu, giving d2_real with mu in place of r). N(d2) uses r. Conflating "risk-neutral ITM probability" with "actual probability" is a classic error.

### Q7. How does the formula change with a continuous dividend yield q?

A stock paying a continuous dividend yield q grows more slowly under Q: dS = (r - q)*S*dt + sigma*S*dW. Replace S with its dividend-adjusted forward value by discounting spot at q:

```text
C = S*exp(-q*T)*N(d1) - K*exp(-r*T)*N(d2)
P = K*exp(-r*T)*N(-d2) - S*exp(-q*T)*N(-d1)

d1 = ( ln(S/K) + (r - q + sigma^2/2)*T ) / ( sigma*sqrt(T) )
d2 = d1 - sigma*sqrt(T)
```

The same substitution prices options on an index (q = dividend yield), on a currency (q = foreign rate, the Garman-Kohlhagen model), or on a future (q = r, giving the Black-76 model where the forward drifts at zero). The generic rule: replace S with the present value of the forward, F*exp(-r*T) where F = S*exp((r - q)*T).

### Q8. What are the main limitations of the Black-Scholes model?

- **Constant volatility is false** — a single sigma cannot fit all strikes; the market shows a **smile/skew**. If BSM were right, implied vol would be flat across strikes. It is not.
- **No jumps** — GBM has continuous paths, but real prices gap (earnings, crashes). Jumps create fat tails and fatten the skew, especially short-dated.
- **Thin tails / wrong distribution** — lognormal underprices extreme moves; real returns have excess kurtosis.
- **Continuous, costless hedging is impossible** — you rehedge discretely and pay spreads, so the perfect replication argument leaks; this creates real P&L variance (gamma/discreteness) not captured by the price.
- **Constant, single r** — bites long-dated and rate-sensitive products; stochastic rates matter there.
- **Frictionless assumptions** — no transaction costs, unlimited shorting, perfect divisibility, no liquidity constraints.

Practitioners keep the BSM formula as a **quoting convention** (implied vol is just BSM run backwards) but layer smile/skew, local vol, stochastic vol (Heston), or jump models on top to price consistently across strikes.

### Q9. Why is vega always positive for a vanilla option?

Vega = dV/dsigma > 0 for any vanilla call or put. Intuition: the payoff max(S_T - K, 0) is **convex** and **floored at zero**. More volatility spreads the terminal distribution wider; the extra upside is unbounded and increases expected payoff, while the extra downside is capped at zero (you just do not exercise). By Jensen's inequality, more dispersion of S_T raises E[max(S_T - K, 0)]. So more vol = more valuable, always, for a long vanilla.

This is also why you cannot have a negative implied vol and why the BSM price is **monotonic in sigma** — which is exactly what lets you invert the price to get a unique implied volatility. (For exotics with concave or capped-both-sides payoffs, e.g. some digitals or barriers, vega can flip sign — but not for vanillas.)

### Q10. How would you numerically compute the implied volatility from a market price?

Implied vol is the sigma solving BSM(sigma) = market_price. Because vega > 0, the price is strictly increasing in sigma, so the root is unique and easy to find.

```python
from scipy.stats import norm
from math import log, sqrt, exp

def bs_call(S, K, T, r, sigma):
    d1 = (log(S/K) + (r + 0.5*sigma**2)*T) / (sigma*sqrt(T))
    d2 = d1 - sigma*sqrt(T)
    return S*norm.cdf(d1) - K*exp(-r*T)*norm.cdf(d2)

def implied_vol(price, S, K, T, r):
    # Newton-Raphson using vega; bisection as a robust fallback
    sigma = 0.2
    for _ in range(100):
        d1 = (log(S/K) + (r + 0.5*sigma**2)*T) / (sigma*sqrt(T))
        vega = S*norm.pdf(d1)*sqrt(T)
        diff = bs_call(S, K, T, r, sigma) - price
        if abs(diff) < 1e-8:
            return sigma
        sigma -= diff/vega          # Newton step
    return sigma
```

Newton-Raphson converges fast because vega is the exact derivative. Near-zero vega (deep ITM/OTM) makes Newton unstable, so production code brackets the root and falls back to **bisection** for robustness.

### Q11. Show that the Black-Scholes call and put prices satisfy put-call parity.

Put-call parity says C - P = S - K*exp(-r*T). Subtract the BSM formulas:

```text
C - P = [ S*N(d1) - K*exp(-r*T)*N(d2) ] - [ K*exp(-r*T)*N(-d2) - S*N(-d1) ]
      = S*( N(d1) + N(-d1) ) - K*exp(-r*T)*( N(d2) + N(-d2) )
```

Since N(x) + N(-x) = 1 for any x (symmetry of the normal):

```text
C - P = S*(1) - K*exp(-r*T)*(1) = S - K*exp(-r*T)
```

Exactly parity. The deeper point: parity is a **model-free, no-arbitrage** identity (long call + short put replicates a forward on the stock), so **any** correct model must reproduce it — BSM does so automatically. This is also why call and put share the same implied vol at a given strike: given C, parity pins P, so they cannot carry different vols.

### Q12. What boundary and terminal conditions solve the BSM PDE for a call?

The PDE V_t + 0.5*sigma^2*S^2*V_SS + r*S*V_S - r*V = 0 needs conditions to select the call solution:

- **Terminal (at t = T)**: V(S, T) = max(S - K, 0) — the payoff.
- **At S = 0**: V(0, t) = 0 — a worthless stock gives a worthless call.
- **As S -> infinity**: V(S, t) ~ S - K*exp(-r*(T - t)) — deep ITM, the call behaves like the forward.

Solving the PDE backward in time from the payoff (via a change of variables that turns it into the heat equation) yields the closed form. This is exactly what a **finite-difference** scheme does numerically: discretize S and t on a grid, impose these boundaries, and step backward from t = T to t = 0. For a put, only the payoff and the large-S/small-S limits change.

### Q13. Explain the connection between the BSM PDE and the heat equation.

With the substitutions x = ln(S), tau = T - t, and pulling out a discounting/drift factor, the BSM PDE transforms into the **standard heat (diffusion) equation** u_tau = u_xx. That is why BSM has a clean closed form: the heat equation's fundamental solution is a Gaussian, and convolving the (transformed) payoff with that Gaussian produces the N(.) terms.

The intuition worth stating: **option pricing is diffusion run backward**. Uncertainty about S_T spreads out like heat; the value today is a Gaussian-weighted average of future payoffs. This is the same fact as the risk-neutral expectation V_0 = exp(-r*T)*E^Q[payoff] — the Feynman-Kac theorem is precisely the statement that this class of parabolic PDE has a solution equal to an expectation over a diffusion. PDE and expectation are two faces of one object.

### Q14. A trader says the option is "cheap" because the stock will rally. Is that a valid BSM argument?

No — that confuses **direction with volatility**. BSM does not care about the expected direction of the stock (mu is hedged away, Q3). Under the model, an option is "cheap" or "rich" only relative to its **implied volatility** versus the trader's forecast of **realized volatility**. Buying an option is a bet on volatility (and convexity/gamma), not on direction — a delta-hedged long option makes money if realized vol exceeds the implied vol paid, regardless of which way the stock goes.

If the trader genuinely has a directional view, the honest position is stock (or a delta position), not an unhedged option priced off vol. The correct reformulation: "I think realized vol will exceed the X% implied, so the option is cheap" — that is a valid BSM/vol argument. "The stock will rally so calls are cheap" is not; the rally view is already priced into spot, and the call's value depends on vol.

### Q15. What is the delta-hedging replication argument in words, and why does it justify the price?

Start with cash equal to the BSM price. At every instant hold Delta = V_S shares (financed by borrowing/lending at r) and rebalance continuously. Because Delta is exactly the option's sensitivity to S, this stock+bond portfolio's value tracks the option's value move-for-move; by maturity it is worth exactly the payoff, whatever path the stock took. So the **BSM price is the cost of manufacturing the option** from the stock and bond.

Why that fixes the price: if the option traded above the replication cost, sell the option and run the cheaper replicating strategy for a riskless profit; if below, buy it and short the replicant. No-arbitrage forces price = replication cost. This is the whole edifice: the formula is not a forecast, it is the **price of a hedging recipe**. It connects directly to [[The Greeks & Hedging]] (delta is the recipe) and to completeness in [[Risk-Neutral Pricing & Martingales]] (replication is possible exactly when the market is complete, which is when the price is unique).

### Q16. How do interest rates and time-to-maturity affect a call's value, and why?

- **Higher r raises a call's value.** A call defers paying the strike K until exercise; higher r means the present value K*exp(-r*T) of that deferred payment is smaller, so the call is worth more. Formally rho = dC/dr = K*T*exp(-r*T)*N(d2) > 0. (For a put, rho < 0.)
- **Longer T generally raises a vanilla's value** — more time means more volatility (sigma*sqrt(T) grows, widening the terminal distribution) and more discounting benefit on K. For a European call on a non-dividend stock, longer is always at least as valuable. (Exceptions: deep-ITM European **puts** can decrease with T because the discounting of the received strike dominates, and dividends can make longer-dated calls worth less.)

The clean way to say it: a call is long **volatility** (sigma*sqrt(T)) and long the **carry** on the deferred strike (r*T). Both usually push value up with T, but competing discounting effects on the strike can reverse this for puts and dividend-payers.

## The Greeks & Hedging

### Summary

**What this topic covers**

The **Greeks** — the partial derivatives of an option's price with respect to its inputs — and how traders use them to hedge. This topic has 16 questions. The first-order Greeks: **Delta** (dV/dS), **Vega** (dV/dsigma), **Theta** (dV/dt), **Rho** (dV/dr). The key second-order Greek: **Gamma** (d^2V/dS^2), the curvature of value in the underlying. We cover what each measures, the closed-form BSM expressions, how a book is delta-hedged and why that hedge must be rebalanced, the **gamma-theta tradeoff** (you pay theta to be long gamma), gamma P&L over a move (~ 0.5*Gamma*(dS)^2), vega/volatility risk, and hedging a whole portfolio including higher-order Greeks. A worked delta-hedge example ties it together.

**Mental model**

Think of the Greeks as a **Taylor expansion** of your option value around the current market. If the stock moves dS, vol moves dsigma, and time moves dt, then:

```text
dV ~ Delta*dS + 0.5*Gamma*(dS)^2 + Vega*dsigma + Theta*dt + Rho*dr
```

Every risk you run is one term. **Delta** is your directional exposure — neutralize it and you no longer care about small moves. **Gamma** is how fast your delta changes — it is the convexity that delta-hedging cannot remove, and it is why you must rebalance. **Vega** is your exposure to the market's vol estimate. **Theta** is the rent you pay (or collect) for holding optionality as time passes. The fundamental trade: **long options = long gamma + long vega, but short theta**. You are paid in convexity (you profit from big moves via gamma) and you pay for it in time decay. Hedging is the art of choosing which of these terms to zero out and which to keep as your intended bet.

**Key terms**

- **Delta** — dV/dS; shares-equivalent exposure. Call delta = N(d1) in (0,1); put delta = N(d1)-1 in (-1,0).
- **Gamma** — d^2V/dS^2; rate of change of delta. Same for a call and its put; largest at-the-money near expiry.
- **Vega** — dV/dsigma; sensitivity to volatility. Always positive for vanillas; peaks ATM.
- **Theta** — dV/dt; time decay. Usually negative for long options (value bleeds as expiry nears).
- **Rho** — dV/dr; sensitivity to the rate. Positive for calls, negative for puts.
- **Delta-neutral** — a position with net delta 0; first-order insensitive to small S moves.
- **Gamma P&L** — the convexity profit ~ 0.5*Gamma*(dS)^2 earned by a delta-hedged long-gamma book.
- **Long gamma / short gamma** — long options profit from realized moves; short options (sold) suffer from them.
- **Vega risk** — P&L from implied vol changing, independent of spot.
- **Higher-order Greeks** — vanna (dDelta/dsigma), volga/vomma (dVega/dsigma), charm (dDelta/dt), speed (dGamma/dS).

**Why interviewers ask this**

The Greeks are the working vocabulary of any options desk, so this is a fluency and intuition test at once. Junior candidates can define delta; senior candidates instantly say "long options means long gamma, short theta, and the two are linked by the P&L identity." The gamma-theta tradeoff is the single most-probed idea — it reveals whether you understand that option pricing is fair precisely because the gamma you are paid in is offset by the theta you pay. Interviewers also test hedging judgment: what does a delta hedge leave unhedged (gamma, vega), why must you rebalance, and what happens to a short-gamma book in a crash (you buy high, sell low — negative convexity). Getting call delta = N(d1) and gamma being identical for calls/puts right are basic gates.

**Common confusions**

- "Delta-hedging makes a position riskless" — only to first order and only instantaneously. Gamma and vega remain; you must rehedge, and rehedging is where gamma P&L and theta play out.
- "Gamma differs between a call and a put" — it does not. Same strike/expiry call and put have **identical** gamma and vega (they differ only by the linear forward, which has zero gamma).
- "Theta is always bad" — for long options yes, but if you are **short** options theta is your income; the question is whether realized gamma losses exceed it.
- "Long gamma is free" — no; you pay theta every day for it. It only pays off if realized vol beats implied.
- "Vega and gamma are the same bet" — related but distinct: gamma cares about **realized** moves (spot moving), vega about **implied** vol (the market's estimate re-pricing). You can be long one and short the other.

**What follows from this topic**

The Greeks come straight out of differentiating the [[The Black-Scholes-Merton Model]] formula, and delta itself is the hedge ratio from that model's derivation. Vega risk motivates the whole volatility-modeling stack (smile, local/stochastic vol) — a book that is vega-exposed needs a model of how implied vol moves. Gamma and theta reappear in discrete-hedging analyses and in the P&L attribution that desks run daily. When Greeks have no closed form (exotics), you bump-and-reprice using the same trees/PDE/Monte-Carlo tools, and correlated multi-asset Greeks pull in the covariance and risk machinery of the risk topics.

### Q1. Define delta and give the Black-Scholes delta of a call and a put.

**Delta = dV/dS** — the sensitivity of the option value to a small change in the underlying, i.e. the shares-equivalent exposure. Under Black-Scholes:

```text
Call delta = N(d1),          in (0, 1)
Put  delta = N(d1) - 1,      in (-1, 0)
```

A call delta of 0.6 means the option gains about 0.60 in value for a one-point rise in the stock, and you hedge it by shorting 0.6 shares. Deep-ITM calls have delta near 1 (move like stock), deep-OTM near 0 (barely respond); ATM is around 0.5. Put delta is negative — puts gain when the stock falls. Note call delta - put delta = N(d1) - (N(d1)-1) = 1, which is just the derivative of put-call parity (long call + short put = long forward, delta 1). Delta is also, loosely, the risk-neutral probability of finishing ITM (equal to N(d1) here).

### Q2. Define gamma and explain why it is the same for a call and a put.

**Gamma = d^2V/dS^2** — the rate of change of delta as the stock moves; the **convexity** of the value curve. In Black-Scholes:

```text
Gamma = N'(d1) / ( S*sigma*sqrt(T) )
```

where N'(.) is the standard normal PDF. Gamma is **positive** for long vanillas and **identical for a call and its same-strike put**. Why: put-call parity says C - P = S - K*exp(-r*T). Differentiate twice in S — the right side is linear in S, so its second derivative is zero. Hence C_SS = P_SS, i.e. equal gamma. (The same argument gives equal vega, since the parity right side has no sigma either.)

Gamma is **largest at-the-money and near expiry**, where delta swings fastest from 0 to 1 over a tiny range of S. Long gamma is good — it means your delta automatically gets longer as the stock rises and shorter as it falls, so you buy low and sell high when rehedging.

### Q3. Define vega, theta, and rho.

- **Vega = dV/dsigma** — sensitivity to volatility. BSM: Vega = S*N'(d1)*sqrt(T), always positive for vanillas, largest ATM and for longer maturities. (Vega is not a Greek letter, but the trade name stuck.)
- **Theta = dV/dt** — sensitivity to the passage of time (time decay). Usually **negative** for long options: value bleeds as expiry approaches because there is less time for favorable moves. Theta is most negative for ATM options near expiry.
- **Rho = dV/dr** — sensitivity to the risk-free rate. **Positive for calls** (rho = K*T*exp(-r*T)*N(d2)), **negative for puts**. Usually the least important Greek for short-dated equity options but matters for long-dated and rate products.

Rule of thumb signs for a long call: Delta +, Gamma +, Vega +, Theta -, Rho +. For a long put: Delta -, Gamma +, Vega +, Theta -, Rho -.

### Q4. Explain the gamma-theta tradeoff.

They are two sides of the same coin: **you pay theta to be long gamma.** A long option position has positive gamma (you profit from big moves) and negative theta (you lose value as time passes). These are linked through the BSM PDE itself. Take a delta-hedged position (V_S term hedged); the PDE reduces to:

```text
Theta + 0.5*sigma^2*S^2*Gamma = r*(hedged value)
=> Theta ~ - 0.5*sigma^2*S^2*Gamma        (ignoring the small carry term)
```

So theta and gamma have **opposite signs and are proportional**. Long gamma forces negative theta and vice versa. The economics: being long gamma lets you buy-low/sell-high while delta-rehedging, earning the convexity P&L — but the option's price already charges you for that privilege via daily time decay. You come out ahead only if **realized** volatility exceeds the **implied** vol you paid. A short-gamma book is the mirror: you collect theta but bleed on every large move.

### Q5. Derive the gamma P&L of a delta-hedged option over a move dS.

Take a delta-hedged position and Taylor-expand the value change in S:

```text
dV ~ Delta*dS + 0.5*Gamma*(dS)^2 + Theta*dt
Hedge P&L = -Delta*dS      (short Delta shares)
Total ~ 0.5*Gamma*(dS)^2 + Theta*dt
```

The **Delta*dS** terms cancel (that is the hedge), leaving:

```text
Hedged P&L ~ 0.5*Gamma*(dS)^2 + Theta*dt
```

The **0.5*Gamma*(dS)^2** is the **gamma P&L** — always positive for long gamma, and it grows with the **square** of the move (big moves pay disproportionately). The **Theta*dt** is the cost. Substituting Theta ~ -0.5*sigma^2*S^2*Gamma:

```text
Hedged P&L ~ 0.5*Gamma*( (dS)^2 - sigma^2*S^2*dt )
```

You make money when realized variance (dS)^2 beats the implied variance sigma^2*S^2*dt priced in. That is the precise statement of "long gamma profits when realized vol exceeds implied."

### Q6. Walk through a concrete delta-hedging example.

Say you sell one ATM call, S = 100, delta = 0.5, so you are short 0.5 delta from the option. To be delta-neutral you **buy 0.5 shares**.

- Stock rises to 102. The call's delta rises (positive gamma) to, say, 0.58. Your option position is now short 0.58 delta but you only hold 0.5 shares -> net short ~0.08 delta. To rehedge, **buy 0.08 more shares at 102**.
- Stock falls back to 98. Delta drops to ~0.42; you now hold too many shares (0.58 vs 0.42 needed) -> **sell 0.16 shares at 98**.

Notice the pattern: as the short-gamma hedger you **buy high (102) and sell low (98)** — you lose money rebalancing. That realized loss is your gamma P&L (negative, because you are short gamma), and it is offset by the **theta you collect** from the option decaying. If the stock had barely moved, theta income would dominate and you profit. If it whipsawed violently (realized vol > implied), your rehedging losses exceed theta and you lose. A long-gamma (option-buyer) hedger does the opposite: buys low, sells high, and profits from big moves.

### Q7. What does a delta hedge leave unhedged?

A delta hedge only zeros the **first-order** sensitivity to spot. It leaves:

- **Gamma** — your delta itself changes as S moves, so the hedge is stale the instant the stock moves; you must rebalance, and the rebalancing is where gamma/theta P&L is realized.
- **Vega** — if implied volatility changes, the option reprices even with spot pinned; a delta hedge does nothing for this.
- **Theta** — the deterministic time decay is not a hedge target but shows up in P&L.
- **Rho** and other higher-order terms.

So delta-hedging turns a directional bet into a **volatility bet**: a delta-hedged long option is long realized vol (via gamma) and long implied vol (via vega). To also neutralize gamma or vega you need **other options** (you cannot hedge convexity with the linear underlying) — e.g. buy/sell options at another strike to offset gamma and vega simultaneously.

### Q8. How do you make a book both delta- and gamma-neutral?

You cannot neutralize gamma with the underlying (stock has zero gamma), so you need a **second option**. Procedure:

1. Use a traded option to zero the book's **gamma**: choose a quantity n2 of option 2 so n2*Gamma2 = -Gamma_book.
2. Adding option 2 changes the book's delta, so **then** re-neutralize delta with the underlying (which has delta 1, gamma 0, so it does not disturb the gamma hedge).

```text
Step 1: n2 = -Gamma_book / Gamma2         (kills gamma)
Step 2: shares = -( Delta_book + n2*Delta2 )   (kills delta with the stock)
```

Order matters: hedge the higher-order Greek (gamma) with the instrument that has it (an option), then clean up delta with the cheap linear instrument (stock). To also be **vega-neutral** you generally need a **third** instrument (another option), since gamma and vega are separate exposures. Each additional Greek you neutralize costs one more independent hedging instrument.

### Q9. Why is gamma largest for at-the-money options near expiry?

Gamma measures how fast delta transitions from ~0 (OTM) to ~1 (ITM). Near expiry, an ATM option's fate is decided by tiny moves around K: a hair above K it will be exercised (delta ~1), a hair below it expires worthless (delta ~0). So delta flips almost discontinuously right at the strike as T -> 0 — that near-vertical delta curve is **huge gamma**. Formally Gamma = N'(d1)/(S*sigma*sqrt(T)); as T -> 0 the sqrt(T) in the denominator drives gamma to a tall spike at S = K (and to ~0 elsewhere).

Practical consequence: **short-dated ATM options are dangerous to be short.** Their gamma explodes, so a small spot move demands large hedge rebalances and can generate big losses (this is "gamma risk" or "pin risk" near expiry). Longer-dated options have gamma spread smoothly over a wide range of S.

### Q10. What is vega risk and how does it differ from gamma?

**Vega risk** is P&L from a change in **implied** volatility — the market re-marking option prices even if spot never moves. **Gamma** concerns **realized** volatility — actual spot moving and your delta hedge needing rebalancing. They are distinct bets:

| | Gamma | Vega |
|---|---|---|
| Driver | Realized moves in S | Change in implied vol |
| Timescale | Continuous, path-dependent | Marks-to-market instantly on vol repricing |
| Hedge with | Rehedging delta captures its P&L | Other options at different strikes/expiries |
| Sign for long option | Positive (profit from big moves) | Positive (profit if implied vol rises) |

You can be long one and short the other by trading a **calendar** or **ratio** spread: e.g. long a long-dated option (lots of vega, little gamma) and short a short-dated option (lots of gamma, little vega) gives you positive vega but negative gamma. Desks manage vega across a whole **volatility surface** (strike x expiry), not a single number, because the smile means different strikes carry different implied vols.

### Q11. You are short a straddle. Describe your Greek exposures and the risk.

A short straddle = short one ATM call + short one ATM put, same strike/expiry. Exposures:

- **Delta ~ 0** at inception (short call delta ~ -0.5, short put delta ~ +0.5 cancel).
- **Gamma: very negative** — you are short two options at the strike with the highest gamma.
- **Vega: very negative** — you lose if implied vol rises.
- **Theta: positive** — you collect decay from both options; this is your income.

The bet: you are **short volatility** — you want the stock to sit near K and realized vol to come in below implied. The **risk is severe and convex**: a large move in either direction hurts you (short gamma), and it hurts more than linearly. If you delta-hedge, you are forced to buy high and sell low on every swing (short-gamma rebalancing loss). A vol spike simultaneously slams your vega. This is the classic "picking up pennies in front of a steamroller" position: steady theta income punctuated by rare, large losses.

### Q12. What are some higher-order Greeks and when do they matter?

Beyond delta/gamma/vega/theta/rho, the cross- and higher-order sensitivities:

- **Vanna = dDelta/dsigma = dVega/dS** — how delta shifts when vol moves (or vega when spot moves). Central to hedging skew, since a spot move changes the relevant implied vol.
- **Volga (vomma) = dVega/dsigma** — convexity of value in vol; matters for vol-of-vol and pricing options on the smile.
- **Charm = dDelta/dt** — delta decay over time; matters for hedges held over weekends/expiry.
- **Speed = dGamma/dS** — how gamma changes with spot; matters for large moves and barrier options.

When they matter: for **vanilla, short-dated, delta/gamma-hedged** books, the first- and second-order Greeks capture nearly all the P&L and these are second-order corrections. They become important for **large moves** (speed), **long-dated or vol-sensitive** books (volga), **skew-aware hedging** (vanna), and **exotics** (barriers, digitals) where the payoff kinks make higher-order terms blow up. On a vanilla desk you watch vanna and volga during vol regime changes.

### Q13. If you delta-hedge continuously, is the position truly riskless? Why do we not do it in practice?

In the **idealized BSM world** — continuous rehedging, no transaction costs, GBM with the exact sigma — yes, continuous delta-hedging perfectly replicates the option and the position is riskless; that is the whole derivation of the price. In **practice it is not**, for three reasons:

- **Discrete hedging** — you rebalance at intervals, not continuously, so gamma P&L over each interval is random (you capture 0.5*Gamma*((dS)^2 - E[(dS)^2])), leaving residual variance.
- **Transaction costs** — each rebalance pays the bid-ask spread; hedging more often reduces replication error but raises costs. There is an optimal (finite) hedge frequency; infinitely frequent hedging costs infinite money.
- **Model risk** — realized vol is not the constant sigma you assumed, the process jumps, and vol itself moves (vega). If realized vol differs from implied, your hedged P&L is nonzero even with perfect execution.

So real desks hedge **discretely**, accept residual gamma/vega risk, and manage it at the book level. The BSM "riskless" claim is a limit, not an operational reality.

### Q14. A long-gamma trader is happy in choppy markets. Explain the P&L intuition.

Long gamma = long options, delta-hedged. From the gamma P&L identity, each rebalancing period earns ~0.5*Gamma*(dS)^2. The (dS)^2 means **any** move, up or down, contributes positively — so **more choppiness (more realized variance) = more profit**. Mechanically, the long-gamma hedger's delta gets longer as the stock rises and shorter as it falls, so rehedging means **selling into rallies and buying into dips** — buy low, sell high — locking in profit on every oscillation.

The cost is **theta**: they pay time decay every day. So a long-gamma trader wants a **choppy, high-realized-vol** market to out-earn the theta they are bleeding. If the market goes dead quiet (realized vol below the implied they paid), the theta bill wins and they lose. The break-even is exactly realized vol = implied vol. Choppy markets tilt the (dS)^2 term above the theta cost, hence the happiness.

### Q15. How does put-call parity constrain the Greeks of a call and put?

Differentiate put-call parity C - P = S - K*exp(-r*T) with respect to each variable:

- **Delta**: dC/dS - dP/dS = 1 => Call delta - Put delta = 1 (e.g. call 0.6, put -0.4).
- **Gamma**: second derivative in S of the right side is 0 => Gamma_call = Gamma_put (identical).
- **Vega**: right side has no sigma => Vega_call = Vega_put (identical).
- **Theta**: differentiate in t; the K*exp(-r*T) term gives a small rate correction, so thetas differ only by that carry term.
- **Rho**: dC/dr - dP/dr = K*T*exp(-r*T) => their rhos differ by exactly that amount (call rho positive, put rho negative).

The headline results: **same-strike calls and puts share identical gamma and vega**, their deltas differ by exactly 1, and their rhos differ by the discounted-strike carry. This is why you can hedge a put's gamma/vega risk with a call and vice versa, and why both quote off the **same implied vol**.

### Q16. What happens to a short-gamma book during a market crash?

It gets hurt badly, and the damage is **self-reinforcing**. Short gamma means your delta moves **against** you: as the market falls sharply, a short-gamma (e.g. short puts) book becomes rapidly **long delta** just as prices drop, so to stay delta-neutral you must **sell into the falling market** — buy high, sell low, realizing large rebalancing losses that scale with (dS)^2. Simultaneously a crash spikes **implied vol**, and short-gamma books are typically **short vega** too, so the vol spike inflicts a second, immediate mark-to-market loss.

The systemic angle interviewers like: when many dealers are short gamma (e.g. having sold puts), their forced hedge-selling **amplifies** the downdraft — everyone sells as the market falls, feeding the crash. This is the "negative gamma feedback loop." The lesson: short-gamma positions earn steady theta in calm times but carry rare, correlated, convex tail losses — you must size them for the crash, not the average day.

## Risk-Neutral Pricing & Martingales

### Summary

**What this topic covers**

The theoretical engine under all of derivatives pricing: **risk-neutral valuation**. This topic has 16 questions. The core objects: the **risk-neutral measure Q**, under which **discounted asset prices are martingales**; the **change of measure** (Girsanov's theorem) that turns the real-world drift mu into the risk-free rate r via the **market price of risk**; the **Fundamental Theorem of Asset Pricing** (no-arbitrage exists iff a risk-neutral measure exists; the market is complete iff that measure is unique); the general pricing formula V_0 = E^Q[ exp(-integral_0^T r dt) * payoff ]; the role of the **numeraire** (why we discount and what we discount by); and **replication** — the reason risk-neutral pricing gives the right answer even though real investors are risk-averse.

**Mental model**

Risk-neutral pricing is a **change of accounting units, not a claim about psychology**. Nobody believes investors are actually risk-neutral. The trick: pick a "unit of account" (a **numeraire**, usually the money-market account B_t = exp(integral r dt)). Under a cleverly chosen probability measure Q, every tradable asset priced **in those units** (S_t/B_t) becomes a **martingale** — it has no drift, its best forecast is its current value. Once prices are driftless martingales, today's value of any payoff is simply its expected future value in those units: V_0/B_0 = E^Q[V_T/B_T], i.e. V_0 = E^Q[exp(-integral r dt)*payoff]. The reason you may legitimately swap the real drift mu for r is **replication**: a derivative's payoff can be manufactured by dynamically trading the underlying and bond, and the cost of that replication does not depend on mu — so you compute it in whatever measure is convenient, and Q (where everything drifts at r) is the convenient one. Risk preferences are already baked into the observed price of the underlying; you inherit them for free and never model them.

**Key terms**

- **Martingale** — a process with E^Q[X_t | F_s] = X_s; no drift, "fair game," best forecast of the future is today's value.
- **Risk-neutral measure Q** — the probability measure under which discounted tradable prices are martingales.
- **Real-world (physical) measure P** — the true probabilities, under which the stock drifts at mu.
- **Numeraire** — the asset prices are quoted in; deflating by it turns prices into martingales.
- **Market price of risk** — lambda = (mu - r)/sigma; the excess return per unit of risk, the amount Girsanov shifts the drift.
- **Girsanov's theorem** — the change-of-measure result that rescales the drift while preserving volatility.
- **Radon-Nikodym derivative** — dQ/dP; the density that reweights probabilities between measures.
- **Fundamental Theorem of Asset Pricing (FTAP)** — no-arbitrage <=> Q exists; completeness <=> Q unique.
- **Complete market** — every payoff is replicable by trading available assets; then prices are unique.
- **Replication** — reproducing a derivative's payoff with a self-financing portfolio of underlying + bond.
- **Feynman-Kac** — the bridge making the risk-neutral expectation equal to the PDE solution.

**Why interviewers ask this**

This is the deepest conceptual material in the primer and separates people who can **compute** from people who **understand why the computation is valid**. The classic trap question — "the stock really earns mu > r, so why do we discount its option at r?" — instantly reveals depth. A junior answer conflates "risk-neutral" with "investors do not care about risk"; a senior answer says "it is a replication argument; the drift is hedged away, and Q is just the measure that makes discounted prices martingales." Quant-research and desk-strat roles lean on this daily: every pricing library is an implementation of V_0 = E^Q[discounted payoff]. Interviewers also probe the FTAP (what does an arbitrage-free market guarantee, what does completeness add) and the numeraire idea (why change numeraire — it simplifies rate/FX products).

**Common confusions**

- "Risk-neutral means investors are risk-neutral" — no. It is a pricing measure obtained by a change of variables; real investors are risk-averse and the stock still drifts at mu in reality.
- "We discount at r because that is the true expected return" — we discount at r because under Q the drift **is** r; the real expected return mu was removed by hedging/replication.
- "Changing measure changes the volatility" — Girsanov changes only the **drift**; sigma is invariant. Volatility is a measure-independent (pathwise, quadratic-variation) quantity.
- "N(d2) is the real probability of exercise" — it is the **Q**-probability; the physical probability uses mu and is different.
- "Every market has a unique price for every payoff" — only **complete** markets do. Incomplete markets (stochastic vol, jumps) have many valid Q's and hence a price **range**.

**What follows from this topic**

This is the formal justification of [[The Black-Scholes-Merton Model]]: BSM's V = exp(-r*T)*E^Q[payoff] is a special case, and Feynman-Kac is why its PDE and expectation forms coincide. The martingale/replication view underpins [[The Greeks & Hedging]] (delta is the replicating hedge ratio) and every numerical method — Monte Carlo simulates paths **under Q**, trees use risk-neutral probabilities p, and PDE solvers discretize the risk-neutral PDE. Incompleteness (many Q's) is the doorway to volatility modeling and to interest-rate models, where the numeraire choice (money-market vs forward-measure vs annuity) is a working tool for pricing caps, swaptions, and FX.

### Q1. What is a martingale, and why does it matter for pricing?

A **martingale** is a stochastic process X_t whose expected future value, given all information up to now, equals its current value:

```text
E[ X_t | F_s ] = X_s   for all t >= s
```

It is a "fair game": no drift, no predictable trend — the best forecast of tomorrow is today's value. (A **submartingale** drifts up, a **supermartingale** down.)

Why it matters: the central theorem of pricing is that **there exists a measure Q under which every discounted tradable asset is a martingale**. Once discounted prices are martingales, pricing is trivial — the value today of a future payoff is just its discounted expectation, because the martingale property says E^Q[future/numeraire] = present/numeraire. Arbitrage is precisely the ability to construct a portfolio that drifts up with no risk, i.e. that is **not** a martingale under any consistent measure; so "no arbitrage" and "a martingale measure exists" turn out to be the same statement (the FTAP).

### Q2. What is the risk-neutral measure Q?

Q is the probability measure under which **discounted prices of tradable assets are martingales**. Concretely, using the money-market account B_t = exp(integral_0^t r ds) as numeraire, Q is the measure that makes S_t/B_t a martingale:

```text
S_0 = E^Q[ exp(-integral_0^T r dt) * S_T ]
```

Under Q, the stock's drift is the risk-free rate r (not the real-world mu): dS = r*S*dt + sigma*S*dW^Q. It is **not** the real distribution of prices — under the physical measure P the stock drifts at mu. Q is an artificial but arbitrage-consistent measure engineered so that pricing reduces to discounted expectation.

The name is because in this measure every asset earns r regardless of its riskiness — exactly how a risk-neutral investor (who demands no risk premium) would price. But it is a computational device: real investors are risk-averse, and Q reprices probabilities to absorb their risk premia so we do not have to model them.

### Q3. Explain the intuition of Girsanov's theorem / change of measure.

Girsanov's theorem says you can **change the drift of a Brownian motion by changing the probability measure, while leaving the volatility unchanged.** Going from the physical measure P (stock drifts at mu) to the risk-neutral Q (drifts at r), you define a new Brownian motion:

```text
dW^Q = dW^P + lambda*dt,    lambda = (mu - r)/sigma  (the market price of risk)
```

Substituting into dS = mu*S*dt + sigma*S*dW^P turns it into dS = r*S*dt + sigma*S*dW^Q. The drift went from mu to r; sigma is untouched.

Intuition: you are not changing the paths, only **reweighting how likely each path is**. Paths where the stock did well get down-weighted, poor paths up-weighted, by just enough to remove the risk premium (mu - r) and make the discounted price a driftless martingale. The reweighting is the Radon-Nikodym density dQ/dP. The amount of shift, lambda = (mu - r)/sigma, is the **excess return per unit of volatility** — the market price of risk, which is the same for all assets driven by that Brownian motion (no-arbitrage forces it to be).

### Q4. What is the market price of risk?

The **market price of risk** is lambda = (mu - r)/sigma — the **excess expected return per unit of volatility** an asset earns for bearing risk (essentially the Sharpe ratio of the risk factor). It is the quantity by which Girsanov shifts the drift when moving from P to Q.

The key no-arbitrage result: **all assets driven by the same source of randomness must have the same market price of risk.** If asset A offered a higher (mu-r)/sigma than asset B for the same dW, you would lever into A and short B for a risk-free excess return. So lambda is a property of the **risk factor**, not the individual asset. This is exactly the CAPM idea in continuous time — expected excess return is proportional to exposure (sigma) times a common price of risk (lambda). Risk-neutral pricing works by **subtracting out** this lambda (setting the effective drift to r), which is why option prices do not depend on any individual asset's mu.

### Q5. State the Fundamental Theorem of Asset Pricing.

Two parts:

- **First FTAP**: A market is **arbitrage-free if and only if there exists at least one risk-neutral (equivalent martingale) measure Q** under which discounted asset prices are martingales. No-arbitrage <=> Q exists.
- **Second FTAP**: An arbitrage-free market is **complete if and only if that risk-neutral measure Q is unique.** Completeness <=> Q unique.

Consequences for pricing:

- If **no Q exists**, there is an arbitrage — a money pump.
- If **Q exists and is unique** (complete market, e.g. BSM with one stock + one Brownian driver), every derivative has a **single** arbitrage-free price: V_0 = E^Q[discounted payoff].
- If **Q exists but is not unique** (incomplete market — stochastic vol, jumps, more risk factors than hedging instruments), there is a **range** of arbitrage-free prices, one per admissible Q; the market picks one via supply/demand (this is where model/parameter choice matters).

This theorem is why "no free lunch" and "price = risk-neutral expectation" are the same idea, and it delineates when a price is unique.

### Q6. Write the general risk-neutral pricing equation and explain each piece.

```text
V_0 = E^Q[ exp(-integral_0^T r_t dt) * payoff(T) ]
```

- **E^Q[.]** — expectation under the risk-neutral measure Q (where drift = r, discounted prices are martingales). Not the real-world expectation.
- **exp(-integral_0^T r_t dt)** — the stochastic discount factor: the money-market numeraire B_0/B_T. If rates are constant this is just exp(-r*T); if r_t is stochastic it stays inside the expectation, coupled to the payoff.
- **payoff(T)** — the contract's cashflow at maturity (max(S_T-K,0) for a call, etc.), a function of the Q-dynamics of the underlying(s).

Reading it: today's price is the **expected discounted payoff in a world where every asset drifts at the risk-free rate.** For BSM (constant r, lognormal S_T under Q) this integral has a closed form; for anything path-dependent or high-dimensional you evaluate the expectation by **Monte Carlo** (simulate S under Q, average discounted payoffs) or the equivalent PDE. When r is stochastic, discount factor and payoff are correlated, which is exactly why interest-rate products need care about the numeraire (Q8, Q9).

### Q7. Why does risk-neutral pricing give the right price even though investors are risk-averse?

Because of **replication**, not because anyone is risk-neutral. A derivative's payoff can be **manufactured** by a self-financing, dynamically rebalanced portfolio of the underlying and the bond (the delta-hedging argument). By no-arbitrage, the derivative must cost exactly what that replicating portfolio costs. Crucially, **the cost of replication does not depend on the real drift mu** — hedging cancels the mu term (see [[The Black-Scholes-Merton Model]]). Since mu is where risk preferences would enter, the price is preference-free.

So you are free to compute the replication cost in **any** measure that gives the same price; the risk-neutral measure Q is chosen purely because it makes the computation trivial (discount the expected payoff). Investors' risk aversion is **already embedded in the observed price and volatility of the underlying**; you inherit it automatically and never have to model utility functions. In short: risk aversion is priced into the hedging instruments, and the derivative just inherits it through the hedge. (This only works when the market is **complete** — replication must actually be possible; otherwise a unique price does not exist, Q5.)

### Q8. What is a numeraire and why do we discount?

A **numeraire** is the asset you quote all other prices in terms of — the "unit of account." We discount because a dollar tomorrow is not a dollar today; expressing prices relative to a growing asset (the money-market account B_t = exp(integral r dt)) puts all cashflows in comparable, present-value units.

The deep point: **for every choice of numeraire N there is a corresponding measure Q^N under which prices deflated by N are martingales.** With the money-market numeraire you get the standard risk-neutral measure and V_0 = E^Q[exp(-integral r dt)*payoff]. But you can choose other numeraires:

- **Money-market account B_t** -> standard risk-neutral measure.
- **Zero-coupon bond P(t,T)** -> the **T-forward measure**, under which the forward price is a martingale and (if the payoff is at T) discounting comes **out** of the expectation: V_0 = P(0,T)*E^{Q_T}[payoff]. This tames stochastic-rate discounting.
- **Annuity** -> the **swap measure**, natural for pricing swaptions.

Changing numeraire is a working tool: pick the one that makes the awkward term (a stochastic discount factor, a ratio) into a martingale so the expectation simplifies.

### Q9. Why change numeraire in practice? Give an example.

You change numeraire to **make a hard expectation easy** — specifically to turn the quantity you are averaging into a martingale so its drift vanishes. The classic example is an option whose payoff is at time T when **interest rates are stochastic**. Under the standard risk-neutral (money-market) measure, the discount factor exp(-integral_0^T r dt) is random and **correlated** with the payoff, so it cannot be pulled out of the expectation:

```text
V_0 = E^Q[ exp(-integral_0^T r dt) * payoff ]     (discount stuck inside)
```

Switch to the **T-forward measure** Q_T, using the zero-coupon bond P(t,T) as numeraire. Under Q_T the discounting factors out cleanly:

```text
V_0 = P(0,T) * E^{Q_T}[ payoff ]
```

Now you only need the payoff's distribution under Q_T, and the messy stochastic discounting is gone (absorbed into the observable bond price P(0,T)). This is standard for pricing caps/floors and bond options. Similarly, the **swap (annuity) measure** makes the swap rate a martingale, which is why swaptions are quoted in a Black-76 form. Numeraire changes are just the FX between measures — pick the currency that makes your product simplest.

### Q10. Prove that the discounted stock price is a martingale under Q.

Under Q the stock follows dS = r*S*dt + sigma*S*dW^Q. Let the discounted price be Z_t = S_t/B_t = S_t*exp(-r*t) (constant r). Apply the product/Itô rule:

```text
dZ = d( S*exp(-r*t) )
   = exp(-r*t)*dS - r*exp(-r*t)*S*dt
   = exp(-r*t)*( r*S*dt + sigma*S*dW^Q ) - r*exp(-r*t)*S*dt
   = exp(-r*t)*sigma*S*dW^Q
```

The dt (drift) terms cancel exactly, leaving **dZ = sigma*Z*dW^Q** — a driftless process. A stochastic integral with respect to Brownian motion and no drift is a martingale, so E^Q[Z_t | F_s] = Z_s. That is precisely the statement S_0 = E^Q[exp(-r*T)*S_T]: the discounted stock is a fair game under Q.

This is the defining property that **pins down** Q — Q is chosen to be exactly the measure making this drift cancel (which, by Girsanov, requires shifting the real drift mu to r). Every tradable, discounted by the numeraire, is a martingale under the corresponding measure.

### Q11. What is a complete market and why does it matter?

A market is **complete** if **every** contingent payoff can be **replicated** by a self-financing portfolio of the available traded assets. Completeness matters because, by the Second FTAP, it is exactly the condition under which the risk-neutral measure Q is **unique**, and therefore every derivative has a **single** no-arbitrage price.

- **Complete** (e.g. standard BSM: one stock + one bond, one Brownian driver): the number of independent traded assets matches the number of risk factors, so any payoff is hedgeable, Q is unique, price is unique. Pricing is unambiguous.
- **Incomplete** (stochastic volatility, jumps, more risk sources than hedging instruments): some risks cannot be perfectly hedged, so many Q's are consistent with no-arbitrage, giving a **range** of prices. The market selects one Q via supply/demand and risk premia (e.g. the volatility risk premium in a Heston model), and calibration to liquid instruments is how you pin it down.

Interview takeaway: "unique price" is a **completeness** claim, not a given. Real markets are incomplete, which is why model and parameter choice genuinely move prices for exotics.

### Q12. How is the binomial tree's risk-neutral probability an instance of this theory?

In a one-step binomial model the stock goes up to S*u or down to S*d. The **risk-neutral probability** of an up-move is:

```text
p = ( exp(r*dt) - d ) / ( u - d )
```

and the option price is the discounted expected payoff under p:

```text
V = exp(-r*dt) * [ p*V_up + (1 - p)*V_down ]
```

This is the full risk-neutral machinery in miniature. Notice: (1) p is chosen precisely so the **discounted stock price is a martingale**: exp(-r*dt)*[p*S*u + (1-p)*S*d] = S. (2) p is **not** the real probability of an up-move — it is the pricing (Q) probability, with the real drift replaced by r. (3) The model is **complete** (two states, two assets — stock and bond — span all payoffs), so p is unique and the price is unique, matching the Second FTAP. (4) The requirement d < exp(r*dt) < u is exactly the **no-arbitrage** condition; violate it and p leaves [0,1], signaling an arbitrage (First FTAP). The tree is discrete risk-neutral pricing, and it converges to BSM as dt -> 0.

### Q13. State the Feynman-Kac theorem and its role here.

**Feynman-Kac** says the solution of a certain class of parabolic PDEs can be written as an **expectation over a diffusion**. For the pricing PDE

```text
V_t + r*S*V_S + 0.5*sigma^2*S^2*V_SS - r*V = 0,   V(S,T) = payoff(S)
```

Feynman-Kac gives the solution as

```text
V(S,t) = E^Q[ exp(-r*(T - t)) * payoff(S_T) | S_t = S ]
```

where S evolves under the risk-neutral dynamics dS = r*S*dt + sigma*S*dW^Q. This is the exact **bridge** between the two ways of pricing: the **PDE / hedging** view ([[The Black-Scholes-Merton Model]]) and the **expectation / risk-neutral** view. They are the same object.

Its practical role: it justifies pricing by **Monte Carlo** (simulate S_T under Q, average the discounted payoff) as an alternative to solving the PDE, and vice versa. When dimensionality is low, solve the PDE (finite differences); when high or path-dependent, simulate the expectation. Feynman-Kac guarantees they give the same price.

### Q14. Under Q, what is the expected return of a risky stock, and does that contradict reality?

Under the risk-neutral measure Q, **every asset — including a risky stock — has expected return equal to the risk-free rate r**: E^Q[dS/S] = r*dt. No asset earns a risk premium under Q; that is the whole point of the measure.

This does **not** contradict reality, because Q is not the real (physical) measure P. Under P the stock really does drift at mu = r + lambda*sigma > r, earning a risk premium (market price of risk lambda times its volatility). Q is a **fictional accounting measure** in which we have already stripped out that premium (via Girsanov) so that pricing reduces to plain discounting at r. We use P to forecast/estimate real returns and risk; we use Q to **price** derivatives. The two coexist: the same paths, reweighted. Confusing the two is the classic error — "if the stock earns mu, why price its option at r?" — resolved by noting the option is priced under Q, where by construction everything earns r, and that this is valid because of replication (Q7).

### Q15. In an incomplete market, why is there no unique price? Give an example.

In an **incomplete** market some risk cannot be perfectly hedged, so a derivative's payoff cannot be exactly replicated — and by the Second FTAP the risk-neutral measure Q is **not unique**. Each admissible Q gives a different (still arbitrage-free) price, producing a whole **interval** of no-arbitrage prices rather than a single number.

Example: **stochastic volatility** (e.g. Heston), where volatility itself is a second random factor dsigma driven by its own Brownian motion. Now there are **two** sources of risk (spot and vol) but typically only **one** liquid hedging instrument (the stock) — you cannot trade "volatility" directly to hedge it. The **volatility risk cannot be replicated**, so different assumptions about the **volatility risk premium** (the market price of vol risk) give different Q's and different option prices, all arbitrage-free. Jump models are similar: you cannot hedge a random jump with continuous stock trading. The market resolves this by **calibrating** the model to observed liquid option prices (the smile), which pins down the specific Q the market is using. So the price is set by supply/demand and risk premia, not by pure no-arbitrage alone.

### Q16. Summarize the logical chain from "no arbitrage" to "price = discounted expected payoff."

The full argument, which a strong candidate can recite end to end:

```text
1. No arbitrage
   => (First FTAP) a risk-neutral measure Q exists, under which
      discounted tradable prices are martingales.

2. Girsanov: moving from P to Q shifts the drift mu -> r
   (by lambda = (mu - r)/sigma) and leaves sigma unchanged.
   Under Q, dS = r*S*dt + sigma*S*dW^Q.

3. Martingale property of the discounted price:
   V_0 / B_0 = E^Q[ V_T / B_T ]
   => V_0 = E^Q[ exp(-integral_0^T r dt) * payoff ].

4. If the market is complete (Second FTAP => Q unique), the payoff
   is replicable, so this price is the UNIQUE no-arbitrage price and
   equals the cost of the delta-hedging replication strategy.

5. Feynman-Kac: that expectation equals the solution of the pricing
   PDE (the hedging/BSM view). Expectation and PDE are the same object.
```

The one-sentence version: **no-arbitrage guarantees a martingale measure; under it, price = discounted expected payoff; replication (completeness) makes that price unique and preference-free; and the drift never appears because hedging removed it.** Every pricing tool — closed-form BSM, binomial trees (Q12), Monte Carlo, finite-difference PDE — is an implementation of one of the equivalent forms in this chain.
## Volatility Modeling

### Summary

**What this topic covers**

Volatility is the single most important — and most slippery — parameter in derivatives pricing. Black-Scholes assumes it is a known constant; the market says otherwise. This topic covers the three faces of volatility and the models built to reconcile them. (1) The **kinds of vol**: historical / realized volatility (measured from past returns), implied volatility (backed out of a traded option price by inverting Black-Scholes-Merton), and forward / instantaneous vol. (2) The **empirical facts BSM cannot explain**: the volatility smile and skew, the volatility surface across strike and maturity, volatility clustering, and the variance risk premium (realized usually sits below implied). (3) The **models that fix BSM**: local volatility (Dupire), GARCH(1,1) for time-varying vol, and stochastic volatility (Heston) where vol itself is a random process. Plus the **VIX** — the market's ~30-day implied-vol "fear gauge" — and the idea of trading vol as an asset class in its own right. The 16 questions here move from "what is implied vol" to "why does the equity skew exist" and "what does Heston add over local vol".

**Mental model**

Think of volatility as having a *term structure and a strike structure simultaneously* — a two-dimensional surface, not a number. Realized vol is backward-looking: it is a statistic of what returns actually did. Implied vol is forward-looking and market-implied: it is the number you must plug into BSM to reproduce the option's traded price, so it is really "the market's risk-neutral expectation of future vol, plus a risk premium, distorted by supply and demand". Because BSM assumes constant vol, if the model were literally true every strike and maturity on a name would imply the *same* number — a flat surface. It never does. The shape of the deviation (a downward skew in equity indices, a symmetric smile in FX) is the market telling you its true return distribution has fatter tails and more negative skew than the lognormal BSM assumes. Every vol model — local, GARCH, stochastic — is an attempt to build a process whose implied-vol surface matches what you observe.

**Key terms**

- **Realized (historical) volatility** — annualized standard deviation of past log returns; a measured statistic.
- **Implied volatility (IV)** — the sigma that makes the BSM price equal the market price; found by numerical inversion (Newton on vega).
- **Volatility smile** — IV plotted against strike curves up at the wings (deep ITM/OTM); typical of FX.
- **Volatility skew (smirk)** — IV higher for low strikes than high; the equity-index shape.
- **Volatility surface** — IV as a function of both strike (or moneyness) and maturity.
- **Local volatility** — a deterministic function sigma(S,t) fitted to reproduce the whole surface (Dupire).
- **Stochastic volatility** — vol is its own random process with its own noise (Heston, SABR).
- **GARCH(1,1)** — discrete-time model where tomorrow's variance depends on today's shock and today's variance; captures clustering.
- **VIX** — CBOE index, model-free ~30-day implied vol of the S&P 500; the "fear gauge".
- **Variance risk premium** — the gap by which implied vol tends to exceed subsequent realized vol.
- **Leverage effect** — negative correlation between returns and vol; a stock falling raises its vol.
- **Vega** — sensitivity of option value to vol; how you get "long/short vol".

**Why interviewers ask this**

Vol is where a candidate reveals whether they *believe* Black-Scholes or merely *use* it. A junior recites the formula; a quant knows the formula is wrong in a specific, exploitable way and can describe exactly how — "constant vol implies a flat surface, the market shows a skew, therefore the risk-neutral density has a fat left tail". Interviewers probe: can you distinguish realized from implied without fumbling? Can you explain *why* the equity skew slopes down (crash-o-phobia, leverage, put demand) rather than just assert it exists? Do you know that IV is not a forecast of realized but a price that embeds a risk premium? The strongest signal is understanding the smile as a statement about the *pricing distribution*, and knowing the trade-off ladder from BSM to local vol to stochastic vol. This is core to any options-desk, vol-arb, or derivatives-quant role.

**Common confusions**

- "Implied vol is a forecast of future realized vol." It is a risk-neutral price; on average it exceeds realized (the variance risk premium), so it is a biased forecast.
- "The smile means the model is broken for one strike." No — a single underlying has one true distribution; the smile is the *whole* surface disagreeing with lognormal at once.
- "Higher IV means the stock will go up/down." IV is directionless; it prices the *magnitude* of moves, not the sign.
- "Local vol and stochastic vol are the same fix." Local vol is deterministic and fits today's surface exactly but predicts unrealistic future smile dynamics; stochastic vol adds a second random driver and models how the smile *moves*.
- "VIX is realized volatility." VIX is *implied* — a forward-looking basket of SPX option prices, not a backward statistic.
- "Vega is constant." Vega peaks near ATM and decays for deep ITM/OTM; it also depends on time to maturity.

**What follows from this topic**

Volatility ties the whole primer together. It is the input to Black-Scholes and the thing the Greeks (especially vega and gamma) measure sensitivity to. The failure of constant vol motivates the numerical methods that follow — you calibrate local/stochastic vol models with Monte Carlo, trees, and PDE solvers. GARCH links forward into the Time Series topic (it is a conditional-heteroskedasticity model); the variance risk premium links to risk-neutral valuation and the P-vs-Q measure distinction. Understanding the skew is prerequisite to VaR done properly, since fat tails are exactly what a Normal VaR understates.

### Q1. What is the difference between historical (realized) and implied volatility?

**Historical / realized volatility** is a *measurement* of what returns actually did. You take a window of past log returns, compute their standard deviation, and annualize:

```text
r_i     = ln(S_i / S_{i-1})
sigma_hat = sqrt( (1/(n-1)) * sum_{i=1..n} (r_i - r_bar)^2 )
annualized: sigma_ann = sigma_hat * sqrt(252)   (252 trading days)
```

**Implied volatility** is a *price*, not a measurement. Given a traded option price, it is the single sigma you must feed into the Black-Scholes formula to reproduce that price. Because BSM is monotonic in vol (vega > 0), the inversion is unique and you solve it numerically (Newton-Raphson using vega, or a bisection).

The key intuition: realized is backward-looking and objective (real-world measure P); implied is forward-looking and risk-neutral (measure Q), so it embeds both the market's expectation of future variance *and* a risk premium for bearing variance risk. That is why they differ systematically — see the variance-risk-premium question.

### Q2. How do you back out implied volatility from a market price?

There is no closed form — vega is smooth and positive, so you root-find. Newton-Raphson converges fast because you have the analytic derivative (vega):

```python
from scipy.stats import norm
import numpy as np

def bs_call(S, K, r, T, sigma):
    d1 = (np.log(S/K) + (r + 0.5*sigma**2)*T) / (sigma*np.sqrt(T))
    d2 = d1 - sigma*np.sqrt(T)
    return S*norm.cdf(d1) - K*np.exp(-r*T)*norm.cdf(d2)

def bs_vega(S, K, r, T, sigma):
    d1 = (np.log(S/K) + (r + 0.5*sigma**2)*T) / (sigma*np.sqrt(T))
    return S*norm.pdf(d1)*np.sqrt(T)          # dV/dsigma

def implied_vol(price, S, K, r, T, sigma0=0.2, tol=1e-8):
    sigma = sigma0
    for _ in range(100):
        diff = bs_call(S, K, r, T, sigma) - price
        if abs(diff) < tol:
            return sigma
        sigma -= diff / bs_vega(S, K, r, T, sigma)   # Newton step
    return sigma
```

Practical notes: vega collapses for deep ITM/OTM options, so Newton can diverge in the wings — fall back to bisection there. Also implied vol is only meaningful within no-arbitrage bounds; a quoted price outside the intrinsic-value bound has no real root.

### Q3. What is the volatility smile, and what does it look like for equity indices?

If Black-Scholes were literally true, every strike on a given maturity would imply the *same* vol — the plot of IV against strike would be flat. It never is. Plotting implied vol against strike (or moneyness) gives a curved shape.

- **FX options**: a roughly symmetric **smile** — IV rises for both deep OTM puts and deep OTM calls, because large moves in either direction are more likely than lognormal predicts.
- **Equity indices**: a **skew** (or "smirk") — IV is *higher* for low strikes (OTM puts) and lower for high strikes (OTM calls). It slopes down left-to-right.

```text
Equity index implied-vol skew:

IV |*
   | *
   |   *
   |     *___
   |         *_____
   +-------------------- strike
    low K            high K
   (OTM puts)      (OTM calls)
```

The skew is a direct statement that the market's risk-neutral distribution of index returns has a **fat left tail and negative skew** — big down-moves are priced as more likely than a lognormal allows.

### Q4. Why does the equity volatility skew exist?

Several reinforcing reasons, all contradicting the constant-vol lognormal assumption:

1. **Crash risk / fat left tail.** Equity markets fall faster and harder than they rise (1987, 2008, 2020). The true return distribution is negatively skewed and leptokurtic, so OTM puts are worth more than lognormal says — pushing their implied vol up.

2. **Leverage effect.** As a firm's equity falls, its debt-to-equity ratio rises, making the equity riskier, so volatility *rises when price falls*. This negative price-vol correlation bends the surface into a downward skew.

3. **Supply and demand.** Institutions are structurally long equities and buy OTM puts as crash insurance ("portfolio protection"). Persistent demand for downside puts bids up their price and hence their implied vol; call overwriters sell upside, depressing high-strike IV.

The unifying point: BSM assumes a single constant vol and a lognormal terminal distribution. The skew is the market pricing in a distribution that is fatter-tailed and left-skewed than that — the deviation *is* the correction.

### Q5. What is the volatility surface?

The volatility surface is implied vol as a function of **two** variables — strike (or moneyness) and time to maturity:

```text
IV = sigma_impl(K, T)
```

A cross-section at fixed T is the smile/skew; a cross-section at fixed K is the **term structure** of vol (which is usually upward-sloping in calm markets — longer horizons price more uncertainty — and can invert during stress, when near-dated fear spikes).

The surface is the object a desk actually maintains and calibrates to. Any consistent pricing model must reproduce it. It must be **arbitrage-free**: no calendar arbitrage (total variance sigma^2*T must be non-decreasing in T for fixed moneyness) and no butterfly arbitrage (the implied risk-neutral density must be non-negative across strikes). Local-vol and stochastic-vol models are, in effect, machines for producing an arbitrage-free surface that matches quotes.

### Q6. What is local volatility, and what does the Dupire model give you?

**Local volatility** replaces the constant sigma in BSM with a *deterministic function of spot and time*, sigma_loc(S,t), while keeping a single Brownian driver:

```text
dS = r*S*dt + sigma_loc(S,t)*S*dW
```

Dupire's insight (1994): given a complete, arbitrage-free surface of European option prices C(K,T), there is a *unique* local-vol function that reproduces every quote exactly. The Dupire formula expresses it from the surface's derivatives:

```text
sigma_loc^2(K,T) = ( dC/dT + r*K*dC/dK ) / ( 0.5 * K^2 * d2C/dK2 )
```

(all derivatives of the call price with respect to strike K and maturity T).

Strengths: it fits today's surface perfectly and is a single-factor, complete-market model so hedging is clean. Weakness: its *forward smile dynamics* are unrealistic — as spot moves, the model predicts the smile flattens and shifts in a way markets don't actually follow, so it mis-prices forward-starting and cliquet products. That flaw is precisely what stochastic vol addresses.

### Q7. What is GARCH(1,1) and what stylized fact does it capture?

**GARCH(1,1)** (Generalized AutoRegressive Conditional Heteroskedasticity) is a discrete-time model where the *conditional variance* of tomorrow's return depends on today's squared shock and today's variance:

```text
r_t     = mu + eps_t,   eps_t = sigma_t * z_t,   z_t ~ N(0,1)
sigma_t^2 = omega + alpha*eps_{t-1}^2 + beta*sigma_{t-1}^2
```

- `alpha` weights the most recent shock (reaction),
- `beta` weights yesterday's variance (persistence),
- `omega` sets the long-run level.

It captures **volatility clustering** — the stylized fact that "large moves follow large moves". A big shock (large eps^2) raises sigma_t^2, which keeps subsequent vol elevated, which decays back toward the long-run variance omega/(1 - alpha - beta). Stationarity requires **alpha + beta < 1**; the closer to 1, the more persistent (slower mean-reversion) the vol. GARCH also naturally produces fat-tailed unconditional returns even with Normal innovations — another observed stylized fact. It links directly to the Time Series topic, where it is the canonical conditional-heteroskedasticity model.

### Q8. What is stochastic volatility, and how does Heston differ from local vol?

**Stochastic volatility** makes volatility its own random process with its *own* Brownian motion, correlated with the price. The **Heston** model:

```text
dS = r*S*dt + sqrt(v)*S*dW1
dv = kappa*(theta - v)*dt + xi*sqrt(v)*dW2
corr(dW1, dW2) = rho
```

- `v` is the instantaneous variance (mean-reverting to theta at speed kappa),
- `xi` is the "vol of vol",
- `rho` is the price-vol correlation — negative rho produces the equity skew (down moves come with rising vol).

Versus local vol: local vol has *one* random driver and fits today's surface with a deterministic sigma(S,t), but gives unrealistic future smiles. Heston has *two* drivers, so the smile itself can move stochastically — it models **smile dynamics**, which matters for forward-starting, barrier, and cliquet products. The market is *incomplete* under Heston (you cannot perfectly hedge with the underlying alone; you also need another option to hedge vega). Heston is popular because it has a semi-closed-form characteristic function, so European options price fast via Fourier methods. SABR is the other workhorse, especially for rates.

### Q9. What is the VIX and why is it called the "fear gauge"?

The **VIX** is the CBOE Volatility Index: a **model-free** estimate of the S&P 500's expected volatility over the next ~30 days, expressed as an annualized percentage. It is *implied*, not realized — it is computed from a strip of out-of-the-money SPX put and call prices across strikes (a variance-swap-style replication), not from a single Black-Scholes inversion:

```text
VIX ~ sqrt( (2/T) * sum_i (dK_i / K_i^2) * exp(r*T) * Q(K_i) ) * 100
```

where Q(K_i) is the price of the OTM option at strike K_i.

It is the "fear gauge" because it spikes when investors rush to buy downside protection: crashes send put demand — and thus OTM put prices and implied vol — sharply higher, so VIX jumps. It is strongly *negatively* correlated with the S&P itself (big down days = big VIX up days). A VIX of 15 is calm; 30+ signals stress; 80 was the 2008/2020 panic peak. VIX futures and options let you trade the level of implied vol directly — vol as an asset.

### Q10. Why is realized volatility usually lower than implied volatility?

This is the **variance risk premium**. Empirically, the vol implied by option prices tends to sit *above* the volatility that subsequently materializes. Reasons:

1. **Insurance premium.** Options are insurance against large moves. Sellers of vol (option writers) demand compensation for bearing the risk of a crash, so they charge more than the actuarially "fair" expected variance. Buyers accept it because the payoff is negatively correlated with their portfolios (it pays off in crashes, exactly when they need it).

2. **Risk-neutral vs real-world measure.** Implied vol lives under the risk-neutral measure Q; realized is measured under the real-world measure P. The premium is precisely the price of the difference — the market pays up for protection against the fat left tail.

The practical consequence: systematically *selling* variance (short straddles, short vol, variance swaps) has historically earned a positive premium — but with a fat-tailed, negatively-skewed payoff (you collect small premiums and occasionally blow up). "Picking up pennies in front of a steamroller." It is not free money; it is compensation for tail risk.

### Q11. What does it mean to be "long volatility" or "short volatility"?

Being long or short vol means your P&L benefits from vol rising or falling, independent of direction. The measure is **vega** (dV/dsigma):

- **Long vol**: you own options (long straddle, long gamma). Value rises if implied vol rises; you profit from *large* realized moves in either direction; you *pay* theta (time decay) while you wait.
- **Short vol**: you have written options. You collect theta and profit if the underlying stays calm; you lose if vol spikes or a big move happens.

The deep link is the **gamma-theta trade-off**. A delta-hedged long-option position has positive gamma: each time the underlying moves you re-hedge and lock in a profit proportional to `0.5*Gamma*(dS)^2`. But you pay for that convexity through theta decay. Net P&L over a period is roughly:

```text
P&L ~ 0.5 * Gamma * S^2 * ( realized_var - implied_var ) * dt
```

So a delta-hedged long-vol position makes money exactly when **realized vol > implied vol** — you are betting realized will exceed the level you paid. That equation *is* the definition of trading vol as an asset.

### Q12. Compare the ways of estimating/quoting volatility.

| Type | Source | Measure | Looking | Use |
|---|---|---|---|---|
| Realized / historical | Past returns' std dev | Real-world (P) | Backward | Baseline, GARCH input |
| Implied (BSM inversion) | A single option price | Risk-neutral (Q) | Forward | Quote a single option |
| Local vol sigma(S,t) | Whole surface (Dupire) | Q | Forward, deterministic | Exotics consistent with surface |
| Stochastic vol (Heston) | Surface + dynamics | Q | Forward, random | Smile dynamics, forward-start |
| GARCH conditional | Return time series | P | Forward forecast | Risk mgmt, vol forecasting |
| VIX / variance swap | Strip of OTM options | Q | Forward ~30d | Trade vol level directly |

The through-line: realized and GARCH are P-measure statistics/forecasts; implied, local, stochastic, and VIX are Q-measure prices. The systematic gap between them is the variance risk premium.

### Q13. If a stock's realized vol is 20% but ATM options imply 25%, what might you infer and do?

First, *do not* immediately conclude "options are overpriced, sell vol". The 5-point gap is roughly the normal **variance risk premium** — implied sitting above realized is the baseline state of the world, not an anomaly. You would ask: is 5 points wide or narrow *relative to this name's history*? Compare the implied-realized spread to its own distribution.

If the spread is unusually wide and you believe it will mean-revert, a **delta-hedged short-vol** position (short straddle, or short variance) harvests the premium — you profit if realized stays near 20%. But you are now short gamma and short the left tail: a single gap move or vol spike can wipe out months of premium. Size it small, and know that the payoff is negatively skewed.

Conversely, if you expect an earnings event or macro shock, realized could exceed implied and you would want to be **long** vol despite paying the premium. The trade is a view on *realized minus implied*, hedged of direction. The whole point is that the number to trade is the spread, not the level.

### Q14. Constant-vol Black-Scholes is wrong. Why is it still the market's lingua franca?

Because implied vol is a *coordinate change*, not a belief. Traders do not think BSM is true; they use it as a bijective dictionary between an option's dollar price and a single number (its implied vol) that is far easier to compare, interpolate, and quote across strikes and maturities. Quoting "25 vol" instead of "4.10 dollars" normalizes away spot, strike, rate, and time, so two very different options become comparable.

The workflow is: observe market prices, invert BSM to get the implied-vol surface, then *use a better model* (local or stochastic vol) calibrated to that surface to price and hedge exotics. BSM is the measuring stick; the real model does the pricing. It survives because it is closed-form, monotonic in vol, and universally understood — a shared language, even though everyone knows its literal assumptions (constant vol, lognormal, continuous costless hedging, no jumps) are false. The smile is literally the market annotating *where and how* the dictionary is lying.

### Q15. What is the leverage effect and how do models capture it?

The **leverage effect** is the empirically observed *negative correlation between an equity's returns and its volatility*: when the price falls, volatility tends to rise (and vice versa). Two stories: (1) a *financial-leverage* mechanism — as equity value drops, the firm's debt-to-equity ratio rises, making the remaining equity intrinsically riskier; (2) a *behavioral/volatility-feedback* mechanism — bad news and fear raise uncertainty. Empirically the effect is stronger than pure leverage explains.

Models capture it through a **negative correlation parameter**. In Heston, `corr(dW1, dW2) = rho < 0` couples down-moves in S to up-moves in v, which mechanically produces the downward equity skew. In GARCH-family models the asymmetry is captured by variants like **EGARCH** or **GJR-GARCH**, which let negative shocks raise next-period variance more than positive shocks of the same size. The leverage effect is thus one of the fundamental reasons the equity skew is *persistent* and one-directional rather than a symmetric smile.

### Q16. A trader says "vol is cheap here." Operationally, what are they claiming and how would they express it?

They are claiming that **implied vol is low relative to the volatility they expect to be realized** over the option's life (or low relative to its historical range / to an upcoming catalyst). "Cheap" is a statement about the *price of variance*, directionless.

To express a long-vol view while staying delta-neutral:

- **Long straddle/strangle**, then delta-hedge — positive gamma, so you profit if realized exceeds the implied you paid (`0.5*Gamma*S^2*(realized_var - implied_var)*dt`), while paying theta.
- **Long a variance swap** — the cleanest pure-vol instrument, paying `realized_var - strike_var` with no path-dependent hedging error.
- **Long VIX futures/calls** — if the view is specifically on ~30-day SPX implied vol spiking.

The risks: if realized comes in below implied, theta bleeds the position; and long-vega positions lose if the implied-vol *level* itself drops even before expiry. The discipline is that "cheap" must be quantified — cheap versus realized forecast, versus term structure, or versus historical percentile — not asserted.

## Numerical Methods — Monte Carlo

### Summary

**What this topic covers**

When an option has no closed-form price — because the payoff is path-dependent, the basket is high-dimensional, or the dynamics are too rich for Black-Scholes — you simulate. This topic covers **Monte Carlo pricing**: the workhorse for exotics and high-dimensional problems. It covers (1) the mechanics — simulating geometric Brownian motion paths under the risk-neutral measure and averaging discounted payoffs; (2) the **convergence law** — Monte Carlo error shrinks as O(1/sqrt(N)), the single most important fact about it, with all its consequences (quadrupling paths only halves the error); (3) **variance reduction** — antithetic variates, control variates, and importance sampling, the techniques that buy accuracy without brute-forcing N; (4) **where MC shines and where it fails** — brilliant for Asian/barrier/basket options, weak for American / early-exercise (which needs Longstaff-Schwartz least-squares MC); and (5) **quasi-random / low-discrepancy sequences** (Sobol) that improve the convergence rate. Expect Python/numpy pseudocode throughout. The 16 questions run from "how do you simulate GBM" to "price an Asian option with antithetic variates and estimate the standard error".

**Mental model**

Risk-neutral valuation says an option's price is the *expected discounted payoff under the risk-neutral measure Q*: `V = exp(-r*T) * E^Q[payoff]`. Monte Carlo is nothing more than a numerical way to compute that expectation — replace the integral with a sample average. You generate many possible futures for the underlying (each a simulated price path where the drift is the risk-free rate r, not the real-world mu), compute the payoff on each, average them, and discount. The Law of Large Numbers guarantees the average converges to the true expectation; the Central Limit Theorem tells you *how fast* and gives you an error bar. The core mental image is a cloud of simulated paths fanning out from today's spot; the price is the discounted average of what the option pays across that cloud. Everything sophisticated — variance reduction, quasi-random numbers, LSM for early exercise — is a technique to get the same answer with fewer paths or to handle payoffs where "the payoff on each path" is itself an optimization problem.

**Key terms**

- **Risk-neutral simulation** — paths driven by drift r (not mu), because pricing lives under measure Q.
- **GBM discretization** — the exact step `S_{t+dt} = S_t*exp((r - sigma^2/2)*dt + sigma*sqrt(dt)*Z)`.
- **Standard error (SE)** — sample-std / sqrt(N); the O(1/sqrt(N)) convergence rate.
- **Confidence interval** — estimate +/- 1.96*SE for 95%.
- **Antithetic variates** — pair each path Z with its mirror -Z to cancel variance.
- **Control variate** — subtract a correlated quantity with known expectation to reduce variance.
- **Importance sampling** — shift the sampling distribution toward the region that matters (deep OTM tails).
- **Path-dependent option** — payoff depends on the whole path (Asian = average, barrier = touch).
- **Longstaff-Schwartz (LSM)** — least-squares regression to price American/early-exercise options by MC.
- **Low-discrepancy / quasi-random (Sobol, Halton)** — deterministic sequences that fill space more evenly than pseudo-random, improving convergence.
- **Euler vs exact scheme** — for GBM the log-step is exact; Euler discretization introduces bias for general SDEs.
- **Weak vs strong convergence** — accuracy of the distribution/expectation vs accuracy of individual paths.

**Why interviewers ask this**

Monte Carlo is where quant *dev* and quant *researcher* skills meet: you must know the finance (risk-neutral drift r, discounting) *and* write correct, vectorized numerical code. Interviewers test three things. (1) **Do you use the risk-free drift?** Simulating under mu instead of r is the classic blunder that reveals someone who has not internalized risk-neutral valuation. (2) **Do you know the convergence rate cold?** "How many more paths to halve the error?" — answer *four times*, because error ~ 1/sqrt(N). Getting this wrong is disqualifying. (3) **Can you reason about variance reduction and when MC is the wrong tool?** Knowing that American options break naive MC (you can't peek at the future to decide exercise) and require LSM is a strong senior signal. They may ask you to write the GBM simulation on a whiteboard — so know the log-Euler step and the numpy vectorization by heart.

**Common confusions**

- "Simulate with the real-world drift mu." No — pricing is under Q, so the drift is r (for a non-dividend asset). mu is only for real-world scenario/risk simulation.
- "More paths always fixes accuracy fast." Convergence is only O(1/sqrt(N)); halving error needs 4x paths. That is *slow* — hence variance reduction.
- "Monte Carlo gives an exact price." It gives an *estimate* with a standard error; always report the confidence interval.
- "MC handles American options fine." Naive MC cannot — the exercise decision must not look ahead. You need Longstaff-Schwartz regression.
- "Antithetic variates always halve the variance." They help most when the payoff is monotonic/near-linear in Z; for symmetric payoffs the gain can be small or nil.
- "Quasi-random is just another RNG." Sobol sequences are *deterministic and low-discrepancy*, improving convergence toward O(1/N) — you cannot use CLT standard errors on them directly.

**What follows from this topic**

Monte Carlo is one leg of the numerical-methods tripod; the sister topic (Trees & PDEs) covers the others and explains the crucial division of labor — MC for path-dependent and high-dimensional, trees/PDE for low-dimensional and early-exercise. MC is also the engine behind **Monte Carlo VaR** in the risk topic, and behind calibrating the stochastic-vol models from the Volatility topic. The reliance on drawing correlated normals connects to Cholesky decomposition in the linear-algebra material (`X = L*Z`), and the O(1/sqrt(N)) rate is a direct application of the Central Limit Theorem from probability.

### Q1. How do you price a European option by Monte Carlo?

Risk-neutral valuation: the price is the discounted expected payoff under Q. For a European option you only need the *terminal* price S_T, so you can jump straight there with the exact lognormal solution — no need to step through the path:

```text
S_T   = S_0 * exp( (r - sigma^2/2)*T + sigma*sqrt(T)*Z ),   Z ~ N(0,1)
price = exp(-r*T) * (1/N) * sum_{i=1..N} payoff(S_T^i)
```

For a call, payoff = max(S_T - K, 0).

```python
import numpy as np

def mc_european_call(S0, K, r, sigma, T, N=1_000_000, seed=0):
    rng = np.random.default_rng(seed)
    Z = rng.standard_normal(N)
    ST = S0 * np.exp((r - 0.5*sigma**2)*T + sigma*np.sqrt(T)*Z)
    payoff = np.maximum(ST - K, 0.0)
    price = np.exp(-r*T) * payoff.mean()
    se = np.exp(-r*T) * payoff.std(ddof=1) / np.sqrt(N)   # standard error
    return price, se
```

Two non-negotiables: the drift is **r**, not the real-world mu (we are under the risk-neutral measure), and you **discount** by exp(-r*T). Always return the standard error alongside the price — a MC price without an error bar is meaningless.

### Q2. Why is the drift r and not mu in risk-neutral Monte Carlo?

Because the price of a derivative is its expected discounted payoff under the **risk-neutral measure Q**, and under Q the drift of every traded asset is the risk-free rate. This is the content of risk-neutral valuation / the fundamental theorem of asset pricing: discounted asset prices are martingales under Q, which forces the drift of S to be r (or r - q with a dividend yield q).

Intuitively, we are not forecasting where the stock will *actually* go (that would need the real-world drift mu and a risk premium). We are replicating the payoff with a self-financing hedge; the cost of that hedge does not depend on the asset's expected return — the mu cancels out during delta-hedging (as in the BSM PDE derivation). Girsanov's theorem makes this precise: changing from P to Q shifts the Brownian motion's drift from mu to r while leaving the volatility unchanged. So we simulate `dS = r*S*dt + sigma*S*dW` under Q. Using mu would price the option as if you could earn a risk premium risklessly — an arbitrage.

### Q3. What is the convergence rate of Monte Carlo, and why does it matter?

Monte Carlo error is **O(1/sqrt(N))** — this follows directly from the Central Limit Theorem. The estimator is a sample mean, so its standard error is:

```text
SE = sigma_payoff / sqrt(N)
95% CI: estimate +/- 1.96 * SE
```

The critical consequence: to **halve** the error you need **4x** the paths; to cut error by 10x you need **100x** the paths. Accuracy is expensive and improvement is slow. That single fact motivates the entire field of variance reduction and quasi-Monte Carlo.

Contrast with a PDE/tree solver in *one* dimension, which converges far faster. But MC's error rate is **independent of dimension** — O(1/sqrt(N)) whether you have 1 underlying or 100. A grid method suffers the *curse of dimensionality* (cost explodes exponentially in dimension). That is exactly why MC wins for high-dimensional baskets: its slow-but-dimension-free rate beats a grid's fast-but-exponential rate once you have more than ~3-4 factors.

### Q4. How do you simulate a full GBM price path (for path-dependent payoffs)?

For path-dependent options (Asian, barrier, lookback) you need the whole trajectory, so you step through time. Discretize [0,T] into m steps of size dt = T/m and apply the exact log-step at each:

```text
S_{t+dt} = S_t * exp( (r - sigma^2/2)*dt + sigma*sqrt(dt)*Z_t ),   Z_t ~ N(0,1) iid
```

```python
import numpy as np

def gbm_paths(S0, r, sigma, T, m, N, seed=0):
    rng = np.random.default_rng(seed)
    dt = T / m
    Z = rng.standard_normal((N, m))
    increments = (r - 0.5*sigma**2)*dt + sigma*np.sqrt(dt)*Z
    logS = np.log(S0) + np.cumsum(increments, axis=1)
    S = np.exp(logS)
    S = np.hstack([np.full((N, 1), S0), S])   # prepend S0 column
    return S    # shape (N, m+1)
```

Note the log-Euler step is **exact** for GBM (no discretization bias), because the SDE for ln(S) has constant coefficients. For a general SDE (e.g. Heston's variance process) you would use an Euler-Maruyama step and incur discretization bias that shrinks with smaller dt.

### Q5. Simulate GBM and price an Asian (average-price) call option.

An arithmetic-average Asian call pays `max(A - K, 0)` where A is the average of the underlying over the monitoring dates. It has no simple closed form (the sum of lognormals isn't lognormal), so MC is the natural tool. Reuse the path simulator, then average along each path:

```python
import numpy as np

def mc_asian_call(S0, K, r, sigma, T, m=50, N=200_000, seed=0):
    rng = np.random.default_rng(seed)
    dt = T / m
    Z = rng.standard_normal((N, m))
    incr = (r - 0.5*sigma**2)*dt + sigma*np.sqrt(dt)*Z
    S = S0 * np.exp(np.cumsum(incr, axis=1))     # (N, m), monitoring dates
    A = S.mean(axis=1)                           # arithmetic average per path
    payoff = np.maximum(A - K, 0.0)
    disc = np.exp(-r*T)
    price = disc * payoff.mean()
    se = disc * payoff.std(ddof=1) / np.sqrt(N)
    return price, se
```

Because averaging *dampens* volatility, the Asian call is cheaper than the equivalent European call, and its payoff has lower variance — so MC converges a bit faster here than for a plain vanilla. This is the canonical "MC shines for path-dependent" example: no PDE dimension blow-up, just average along the path.

### Q6. What are antithetic variates and why do they reduce variance?

**Antithetic variates**: for every random draw Z you also use its mirror image -Z, and average the two payoffs. Since Z and -Z are both standard normal, each is a valid draw, but they are *negatively correlated*, so their average has lower variance than two independent draws.

```python
import numpy as np

def mc_call_antithetic(S0, K, r, sigma, T, N=500_000, seed=0):
    rng = np.random.default_rng(seed)
    Z = rng.standard_normal(N // 2)
    def payoff(Zv):
        ST = S0*np.exp((r - 0.5*sigma**2)*T + sigma*np.sqrt(T)*Zv)
        return np.maximum(ST - K, 0.0)
    P = 0.5*(payoff(Z) + payoff(-Z))     # average of antithetic pair
    disc = np.exp(-r*T)
    return disc*P.mean(), disc*P.std(ddof=1)/np.sqrt(len(P))
```

Why it works: Var((X + Y)/2) = (Var X + Var Y + 2*Cov(X,Y))/4. If Cov(X,Y) < 0 the variance drops below the independent case. The mirroring makes the payoffs move oppositely — a high Z path and its low -Z path partly cancel. The gain is largest when the payoff is monotonic in Z (like a call); for payoffs symmetric in Z the negative correlation can vanish and the technique gives little.

### Q7. What is a control variate?

A **control variate** exploits a related quantity whose expectation you know *exactly* to correct your noisy estimate. Suppose you want E[X] (the exotic's payoff) and you have a correlated Y (e.g. the vanilla payoff, or the geometric-average Asian which *does* have a closed form) with known E[Y]. Then:

```text
X_cv = X - c*(Y - E[Y])
```

is an unbiased estimator of E[X] (since E[Y - E[Y]] = 0), and its variance is minimized at c* = Cov(X,Y)/Var(Y), giving:

```text
Var(X_cv) = Var(X) * (1 - corr(X,Y)^2)
```

So the variance shrinks by the factor (1 - rho^2) — if X and Y are 95% correlated you cut variance ~90%. The classic finance example: price an **arithmetic** Asian (no closed form) using the **geometric** Asian as the control, because the geometric version *has* an analytic price and is extremely correlated with the arithmetic one. Control variates are usually the most powerful single variance-reduction trick when a good, correlated, closed-form control exists.

### Q8. What is importance sampling and when do you need it?

**Importance sampling** shifts the sampling distribution toward the region that actually contributes to the payoff, then re-weights to stay unbiased. You need it when the payoff is dominated by *rare* events that ordinary sampling almost never hits — deep out-of-the-money options, tail risk / VaR, barrier options far from the barrier.

The idea: to estimate E_f[g(X)] where under density f the important region is rarely sampled, draw from a better-placed density h and correct with the likelihood ratio:

```text
E_f[g(X)] = E_h[ g(X) * f(X)/h(X) ]
```

The ratio `f/h` is the importance weight. For a deep-OTM call you might *shift the drift upward* so paths land near/above the strike far more often, then multiply each payoff by the likelihood ratio between the original and shifted measures (a Radon-Nikodym / Girsanov weight). Done well, nearly every path contributes a nonzero payoff and variance collapses. Done badly (a mismatched h that makes the weight blow up), it can *increase* variance — so the sampling density must be chosen carefully to match where the integrand's mass is.

### Q9. Why does Monte Carlo struggle with American options?

An American option can be exercised at any time, so its value requires an *optimal stopping* decision: at each moment, exercise if the intrinsic value exceeds the **continuation value** (the expected discounted value of holding). The problem is that continuation value is a *conditional expectation of the future*, and naive Monte Carlo runs paths *forward* — at time t on a single path you do not know the future, so you cannot evaluate "what's it worth to keep holding?" without looking ahead. Using the realized future of the *same* path to decide exercise is cheating (perfect foresight) and grossly overprices the option.

Trees and PDE solvers handle this naturally because they sweep *backward* from expiry, so the continuation value at each node is already computed. That backward induction is exactly what forward MC lacks. The fix within MC is **Longstaff-Schwartz least-squares MC (LSM)**: at each exercise date, regress the (discounted) realized continuation values across paths against functions of the current state to *estimate* the continuation value as a function of the state, then apply the exercise rule using that fitted estimate — no per-path look-ahead. That is the subject of the next question.

### Q10. Sketch how Longstaff-Schwartz (LSM) prices an American option.

LSM makes American pricing tractable in Monte Carlo by *estimating* the continuation value with cross-sectional regression, working backward through exercise dates:

```text
1. Simulate N full paths forward.
2. At maturity, set cashflow = intrinsic payoff on each path.
3. Step backward through each earlier exercise date t:
   a. Take the in-the-money paths at t (only they face a real decision).
   b. Regress the discounted future cashflow (Y) on basis functions of
      the current spot S_t (e.g. 1, S, S^2)  ->  estimated continuation value.
   c. Exercise the path if intrinsic(S_t) > estimated continuation.
      Otherwise keep the existing future cashflow.
4. Discount each path's realized cashflow to t=0 and average.
```

The regression turns "expected value of holding" into a fitted function of the state, so the exercise decision uses *no* per-path future information — it uses only the current spot and a rule learned across the cross-section of paths. Choice of basis functions (polynomials, Laguerre) matters. LSM has a slight low-bias (the fitted rule is suboptimal) but is the standard way to price Bermudan/American and callable exotics by simulation.

### Q11. When should you use Monte Carlo versus a tree or PDE?

The decision is driven by **dimension** and **early exercise**:

| Situation | Best tool | Why |
|---|---|---|
| Low-dim (1-2 factors), European or American | Tree / PDE | Fast, accurate; backward induction handles early exercise |
| Path-dependent (Asian, barrier, lookback) | Monte Carlo | Payoff needs the whole path; easy to simulate |
| High-dimensional basket (many underlyings) | Monte Carlo | Error O(1/sqrt(N)) is dimension-independent; grids explode |
| American / Bermudan, low-dim | Tree / PDE | Natural early-exercise handling |
| American, high-dim | Monte Carlo + LSM | Grids infeasible; LSM restores early exercise |

The unifying principle: MC's error rate does not depend on dimension, so it is the *only* feasible method once you pass ~3-4 factors (curse of dimensionality kills grids). But MC runs forward, so vanilla MC cannot do early exercise — you need LSM. Trees/PDE run backward and handle early exercise natively but suffer exponential cost in dimension. Choose MC for high-dimensional or path-dependent; choose tree/PDE for low-dimensional, especially with early exercise.

### Q12. What are low-discrepancy (quasi-random) sequences and what do they buy you?

Pseudo-random numbers, being genuinely random, clump and leave gaps — so filling d-dimensional space evenly is slow (O(1/sqrt(N))). **Low-discrepancy sequences** (Sobol, Halton, Faure) are *deterministic* sequences engineered to spread points as uniformly as possible, minimizing the "discrepancy" (the gap between the fraction of points in a region and that region's volume).

Used in place of pseudo-random draws, **quasi-Monte Carlo** can approach a convergence rate of roughly O((log N)^d / N) — close to O(1/N), dramatically better than O(1/sqrt(N)) for moderate dimensions. So you reach a target accuracy with far fewer paths.

Caveats: (1) Because the points are deterministic, you *cannot* form a standard-error confidence interval by the CLT — you use **randomized QMC** (e.g. Sobol with random digital shifts) across several batches to get an error estimate. (2) The advantage degrades in very high effective dimension. (3) The uniform draws must be mapped to normals via the *inverse CDF* (not Box-Muller, which scrambles the low-discrepancy structure). Sobol is the standard choice on options desks for its good high-dimensional properties.

### Q13. How do you generate correlated asset paths for a basket option?

You need draws whose covariance matches the target correlation matrix. Use the **Cholesky decomposition**: factor the correlation (or covariance) matrix Sigma = L*L' with L lower-triangular, then transform a vector of independent standard normals Z:

```text
X = L * Z    =>    Cov(X) = L*Cov(Z)*L' = L*I*L' = Sigma
```

```python
import numpy as np

def correlated_gbm_terminal(S0, r, sigma, T, corr, N, seed=0):
    # S0, sigma: arrays length d;  corr: (d,d) correlation matrix
    rng = np.random.default_rng(seed)
    d = len(S0)
    L = np.linalg.cholesky(corr)            # Sigma = L L'
    Z = rng.standard_normal((N, d))
    W = Z @ L.T                             # correlated normals, cov = corr
    drift = (r - 0.5*sigma**2)*T
    ST = S0 * np.exp(drift + sigma*np.sqrt(T)*W)
    return ST                              # (N, d) terminal prices
```

Each column now has the right marginal (driven by its own sigma) and the cross-correlation you specified. This is the standard way to price basket, rainbow, and worst-of/best-of options — and MC handles the high dimension gracefully where a grid could not. Cholesky requires Sigma to be positive semi-definite; a non-PSD estimated correlation matrix must be repaired first.

### Q14. You ran 10,000 paths and got a price of 5.00 with standard error 0.08. How many paths for SE = 0.01?

Use the O(1/sqrt(N)) law. Standard error scales as SE proportional to 1/sqrt(N), so:

```text
SE_new / SE_old = sqrt(N_old / N_new)
0.01 / 0.08 = sqrt(10000 / N_new)
1/8 = sqrt(10000 / N_new)
1/64 = 10000 / N_new
N_new = 640,000
```

You need **64x** the paths (10,000 -> 640,000) to shrink the error 8-fold. That is the whole painful story of Monte Carlo in one calculation: an 8x accuracy gain costs 64x the compute. It is why practitioners reach for variance reduction (antithetic, control variates) and quasi-random sequences instead of brute force — a control variate that cuts variance 10x is worth 10x the paths for free. Also report the price *with* its interval: 5.00 +/- 1.96*0.08, i.e. roughly [4.84, 5.16] at 95%.

### Q15. How do you compute Greeks (like delta) by Monte Carlo?

Three approaches, in increasing sophistication:

1. **Finite differences (bump-and-revalue).** Reprice at S0 and S0*(1+h), take the difference:

```text
delta ~ ( V(S0*(1+h)) - V(S0) ) / (S0*h)
```

Crucial trick: use the **same random numbers** (same seed) for both bumps — "common random numbers" — otherwise the MC noise swamps the small difference. A central difference (bump up and down) is more accurate. Simple but biased in h and noisy.

2. **Pathwise derivative.** Differentiate the payoff along each path analytically and average. For a call, dPayoff/dS0 = (S_T/S0)*1{S_T > K}, giving a lower-variance, unbiased delta — but requires the payoff to be differentiable (fails for digitals/barriers at the discontinuity).

3. **Likelihood ratio method.** Differentiate the *density* rather than the payoff; works for discontinuous payoffs (digitals) where pathwise fails, but has higher variance.

Rule of thumb: pathwise for smooth payoffs (low variance), likelihood-ratio for discontinuous ones, and common-random-number finite differences as the robust general-purpose fallback. Never bump with fresh random numbers — the variance ruins the estimate.

### Q16. What is the difference between weak and strong convergence of a simulation scheme?

They measure two different things about how a discretized SDE approximates the true process as the time step dt shrinks:

- **Strong convergence** concerns the *accuracy of the individual paths*: how close the simulated S_T is to the true S_T on the *same* Brownian path, in expectation of the error `E[ |S_T^approx - S_T^exact| ]`. It matters when the pathwise trajectory itself matters (e.g. path-dependent payoffs, or when you need the sample path to be right).

- **Weak convergence** concerns the *accuracy of expectations / distributions*: how close `E[g(S_T^approx)]` is to `E[g(S_T^exact)]`. For *option pricing* this is what you actually care about — you want the right expected payoff, not the right individual path.

The Euler-Maruyama scheme has strong order 0.5 and weak order 1.0; the Milstein scheme improves strong order to 1.0. For pricing, weak order is the relevant one, so Euler is often adequate. For GBM specifically the *log*-scheme is **exact** (no discretization error at all, any dt), because ln(S) follows a Brownian motion with constant coefficients — which is why European MC needs only a single step. The distinction matters most for models like Heston whose variance process must be discretized and can even go negative under naive Euler.

## Numerical Methods — Trees & PDEs

### Summary

**What this topic covers**

The grid-based alternatives to Monte Carlo — the tools that run *backward* from expiry and therefore handle early exercise naturally. This topic covers (1) the **binomial tree**: the discrete-time, no-arbitrage model where the underlying moves up by u or down by d each step, priced by risk-neutral backward induction, and its convergence to Black-Scholes as the step count grows; (2) a fully worked **two-step tree** so the mechanics are concrete; (3) **American options and early exercise** — the thing trees and PDEs do gracefully and naive Monte Carlo cannot — by comparing continuation value against intrinsic value at every node; (4) **finite-difference methods** that discretize the Black-Scholes PDE directly on a grid — the explicit, implicit, and Crank-Nicolson schemes — and their **stability** properties (explicit is only conditionally stable); and (5) the overall **trees vs Monte Carlo vs PDE** trade-off, dimension by dimension. The 16 questions run from "what is the risk-neutral probability in a one-step tree" through a hand-computed two-step valuation to "why is the explicit scheme unstable and Crank-Nicolson preferred".

**Mental model**

Both trees and PDEs price by the same principle as everything else — risk-neutral expectation of discounted payoff — but they compute it on a *grid* and sweep *backward from the known payoff at expiry*. A binomial tree is the most transparent version: model the future as a branching lattice of up/down moves, assign each branch a *risk-neutral* probability p (chosen so the discounted expected next-step price equals today's price — the no-arbitrage condition), fill in the option payoff at the final nodes, then roll backward, at each node taking the discounted risk-neutral expectation of its two children. Because you visit each node knowing the value of *holding* (the two children), you can, at an American node, simply overwrite with the intrinsic value whenever early exercise is worth more. Finite-difference methods do the same thing in the continuous limit: they lay a grid over price and time and approximate the Black-Scholes PDE's derivatives with differences, marching backward from the terminal payoff. The tree is really an explicit finite-difference scheme in disguise.

**Key terms**

- **Binomial tree** — discrete lattice; each step the underlying goes up by factor u or down by d.
- **u, d** — up/down move sizes; commonly d = 1/u with u = exp(sigma*sqrt(dt)) (Cox-Ross-Rubinstein).
- **Risk-neutral probability p** — p = (exp(r*dt) - d)/(u - d); the no-arbitrage weight, NOT a real-world probability.
- **Backward induction** — fill terminal payoffs, then discount expected values back node by node.
- **Continuation value** — value of *holding* the option at a node = discounted risk-neutral expectation of children.
- **Intrinsic value** — payoff if exercised now; at American nodes, value = max(continuation, intrinsic).
- **Convergence** — binomial price -> Black-Scholes as the number of steps -> infinity.
- **Black-Scholes PDE** — V_t + 0.5*sigma^2*S^2*V_SS + r*S*V_S - r*V = 0.
- **Finite differences** — approximate PDE derivatives on a grid: explicit, implicit, Crank-Nicolson.
- **Explicit scheme** — new value from known later values directly; simple but only *conditionally* stable.
- **Implicit scheme** — solve a linear system each step; *unconditionally* stable.
- **Crank-Nicolson** — average of explicit and implicit; second-order accurate in time, stable.

**Why interviewers ask this**

Trees are the cleanest way to prove a candidate *understands* risk-neutral valuation rather than memorizing Black-Scholes. Ask someone to price a two-step tree by hand and you immediately see whether they know where p comes from (no-arbitrage, not real-world odds), whether they discount correctly, and whether they can handle an American node. It is also the canonical setting to explain **why early exercise breaks Monte Carlo but not trees** — a favorite senior question that tests understanding of forward vs backward induction. On the PDE side, interviewers probe whether you can connect the abstract Black-Scholes PDE to a concrete numerical scheme and whether you know the stability trap: the explicit method blows up unless the time step is small enough relative to the space step. Getting the risk-neutral probability formula, the backward-induction mechanics, and the explicit-stability condition right marks a candidate who has actually implemented pricers, not just read about them.

**Common confusions**

- "p is the real-world probability of an up move." No — p is the *risk-neutral* probability, engineered so the asset earns r; the real-world probability never enters the price.
- "d must be 1/u." That is just the CRR convention (it centers the tree); other parameterizations (Jarrow-Rudd) exist.
- "Trees and Monte Carlo are interchangeable." They are complementary: trees run backward (great for early exercise, low dimension), MC runs forward (great for path-dependent, high dimension).
- "The explicit finite-difference scheme is always fine." It is only *conditionally* stable — too large a time step and errors explode; implicit and Crank-Nicolson are unconditionally stable.
- "A binomial tree can price a high-dimensional basket." Node count explodes exponentially with the number of underlyings — trees are for 1 (maybe 2) factors; use MC beyond that.
- "More tree steps always converge smoothly." Binomial convergence to BSM *oscillates* (the sawtooth) as you add steps; averaging adjacent step counts or using CRR-with-drift smooths it.

**What follows from this topic**

Trees and PDEs are the other two legs of the numerical-methods tripod alongside Monte Carlo, and the division of labor — backward grid methods for low-dimensional/early-exercise, forward simulation for path-dependent/high-dimensional — is the single most useful practical takeaway of the whole numerical block. The binomial tree is also a pedagogical bridge *back* to Black-Scholes: taking its continuous limit reproduces the BSM formula, tying the discrete no-arbitrage argument to the PDE. The finite-difference schemes solve the same BSM PDE derived in the Black-Scholes topic, and the American-option material connects forward to Longstaff-Schwartz in the Monte Carlo topic as the simulation-based alternative for high-dimensional early exercise.

### Q1. What is the one-step binomial model and where does the risk-neutral probability come from?

In one step of length dt the underlying either goes **up** to S*u or **down** to S*d. The key claim: the option's price does *not* depend on the real-world probability of up vs down. Instead you find the price by no-arbitrage. Construct a portfolio of delta shares plus a bond that replicates the option's two payoffs; its cost today is the option price. Equivalently — and more elegantly — you find the **risk-neutral probability** p under which the asset earns the risk-free rate:

```text
Under Q, discounted stock is a martingale:
  S = exp(-r*dt) * ( p*S*u + (1-p)*S*d )
Solve for p:
  p = ( exp(r*dt) - d ) / ( u - d )
```

Then the option price is the discounted risk-neutral expected payoff:

```text
V = exp(-r*dt) * ( p*V_up + (1-p)*V_down )
```

The intuition: p is *not* anyone's belief about the market. It is the unique weight that makes the stock's expected growth equal to r, which is exactly the no-arbitrage condition. For p to be a valid probability in (0,1) we need d < exp(r*dt) < u — otherwise there is a riskless arbitrage.

### Q2. How do you choose u and d (the Cox-Ross-Rubinstein parameterization)?

The tree parameters must be chosen so that, as the number of steps grows, the tree's dynamics match geometric Brownian motion with volatility sigma — i.e. so the binomial price converges to Black-Scholes. The **Cox-Ross-Rubinstein (CRR)** choice sets:

```text
u = exp( sigma*sqrt(dt) )
d = 1/u = exp( -sigma*sqrt(dt) )
p = ( exp(r*dt) - d ) / ( u - d )
```

Setting d = 1/u makes the tree **recombining** (an up-then-down move lands at the same node as down-then-up), so after n steps there are only n+1 terminal nodes rather than 2^n — that is what makes trees computationally feasible. It also centers the lattice on the initial spot.

The u and d are calibrated to reproduce the variance of log-returns: over a step, the log-return has variance sigma^2*dt, which the +/- sigma*sqrt(dt) jumps match to leading order. Other conventions exist — **Jarrow-Rudd** sets p = 1/2 and adjusts u,d for the drift instead — but CRR is the textbook default. All valid parameterizations converge to the same BSM price in the limit.

### Q3. Walk through pricing a European call with a two-step binomial tree.

Take S0 = 100, K = 100, r = 5% per year, sigma set so u = 1.2, d = 1/1.2 = 0.8333, each step dt = 1 year (T = 2). Risk-neutral p:

```text
p = (exp(r*dt) - d)/(u - d) = (exp(0.05) - 0.8333)/(1.2 - 0.8333)
  = (1.05127 - 0.8333)/(0.36667) = 0.21794/0.36667 = 0.5944
1 - p = 0.4056
```

Build the price tree and terminal payoffs (call, K = 100):

```text
Prices:                         Terminal payoff max(S-K,0):
             S_uu = 144                V_uu = 44
           /                         /
   S_u = 120                   (roll back)
  /          \                       \
S0 = 100      S_ud = 100  -->         V_ud = 0
  \          /                       /
   S_d = 83.33                       \
           \                          \
             S_dd = 69.44             V_dd = 0
```

Backward induction. First to the step-1 nodes:

```text
V_u = exp(-r*dt)*( p*V_uu + (1-p)*V_ud )
    = exp(-0.05)*( 0.5944*44 + 0.4056*0 ) = 0.95123*26.15 = 24.88
V_d = exp(-0.05)*( 0.5944*0 + 0.4056*0 ) = 0
```

Then to the root:

```text
V0 = exp(-0.05)*( p*V_u + (1-p)*V_d )
   = 0.95123*( 0.5944*24.88 + 0.4056*0 ) = 0.95123*14.79 = 14.07
```

The two-step price is **~14.07**. Add more steps and it converges to the Black-Scholes value. The whole method is: payoffs at the leaves, then repeatedly `discount * risk-neutral expectation` back to the root.

### Q4. How does the binomial price converge to Black-Scholes?

As the number of steps n grows (dt = T/n -> 0), the binomial tree's terminal distribution of log-prices is a sum of n iid up/down increments. By the **Central Limit Theorem**, that sum converges to a Normal — so the terminal price becomes lognormal, exactly the Black-Scholes assumption. With the CRR parameters (u = exp(sigma*sqrt(dt)), d = 1/u, and the risk-neutral p), the mean and variance of the log-return match GBM's, so the binomial price converges to the Black-Scholes price:

```text
binomial price (n steps) --> BSM price   as n --> infinity
```

The convergence is O(1/n) but **oscillatory** — plotting price against n shows a sawtooth that straddles the true value, because whether a node sits exactly at the strike flips as n changes parity. Practitioners smooth this by averaging n and n+1 step trees, or by using a finer parameterization near the strike. The takeaway: the binomial model is not a different theory from Black-Scholes — it is a discrete no-arbitrage scheme whose continuous limit *is* Black-Scholes, which is why it is the standard teaching bridge to the formula.

### Q5. How do you price an American option on a tree, and why can't naive Monte Carlo do it?

On a tree it is almost trivial because you sweep backward, so at each node you already know the value of *holding*. At every node compute:

```text
continuation = exp(-r*dt) * ( p*V_up + (1-p)*V_down )   # value of holding
intrinsic    = payoff if exercised now                   # e.g. max(K - S, 0) for a put
V_node       = max( continuation, intrinsic )            # American: exercise if better
```

You take the max at every node, capturing the optimal early-exercise decision. For a European option you would skip the max and just use continuation.

Naive Monte Carlo can't do this because it runs *forward*: standing at time t on a single simulated path, you do not know the continuation value (the expected value of the future) without looking at that path's own future — which is perfect foresight and overprices the option. The exercise decision needs a *conditional expectation of the future*, which backward induction gives you for free but forward simulation does not. The workaround is Longstaff-Schwartz LSM, which *estimates* the continuation value by regressing across paths. So: trees/PDE handle early exercise natively (backward), MC needs LSM (regression to fake backward information).

### Q6. When would an American call be exercised early, and when is it never optimal?

**American call on a non-dividend-paying stock: never exercise early** — it is always worth at least as much alive as exercised. Two reasons: (1) exercising throws away the remaining *time value* / optionality; (2) you pay the strike K early, losing the interest you could earn on it (the discounting benefit of paying K later). Formally, for a non-dividend stock C_american = C_european, because early exercise gives max(S-K,0) = S-K, but holding is worth at least S - K*exp(-r*tau) > S - K. So the American call feature is worthless without dividends.

**When it *is* optimal**: (1) an American *call* on a **dividend-paying** stock, just before a large dividend — exercising captures the dividend that would otherwise drop the stock (and forgone by the option holder); (2) an American *put*, which can be optimal to exercise early even without dividends — deep in the money, exercising gets you K now to earn interest on, and there is limited further upside (S can only fall to 0). This asymmetry is exactly why put pricing genuinely needs the American machinery (trees/PDE) while the vanilla call does not.

### Q7. What is the Black-Scholes PDE that finite-difference methods solve?

Every non-dividend European derivative value V(S,t) satisfies the **Black-Scholes partial differential equation**:

```text
V_t + 0.5*sigma^2*S^2*V_SS + r*S*V_S - r*V = 0
```

where V_t = dV/dt, V_S = dV/dS (delta), V_SS = d2V/dS2 (gamma). It is derived by forming a **delta-hedged, riskless portfolio** (long the option, short delta shares); the randomness cancels, so the portfolio must earn r, and matching terms gives the PDE. Notice the real-world drift mu is absent — the hallmark of risk-neutral valuation.

To price by finite differences you solve this PDE *backward in time* from the known terminal condition (the payoff, e.g. V(S,T) = max(S-K,0)) subject to boundary conditions in S (e.g. V(0,t) = 0 and V -> S - K*exp(-r*(T-t)) as S -> infinity for a call). You lay a grid over (S, t), replace the derivatives with finite-difference approximations, and march the solution from t = T back to t = 0. The three standard schemes — explicit, implicit, Crank-Nicolson — differ in *which time level* they evaluate the space derivatives at, which drives their stability and accuracy.

### Q8. Explain the explicit, implicit, and Crank-Nicolson finite-difference schemes.

All three discretize the BSM PDE on a grid and differ in *when* the spatial derivatives (V_S, V_SS) are evaluated relative to the time step being solved:

- **Explicit.** The new (earlier-time) value at a node is written directly in terms of *already-known* values at the next time level. Each node updates independently — cheap, no linear solve. But it is only **conditionally stable**: the time step must be small relative to (space step)^2 or the solution blows up. It is essentially the trinomial-tree scheme.

- **Implicit (backward Euler).** The spatial derivatives are evaluated at the *unknown* current time level, so each time step requires solving a tridiagonal linear system (fast with the Thomas algorithm). **Unconditionally stable** — any time step works — but only first-order accurate in time.

- **Crank-Nicolson.** The *average* of explicit and implicit (a trapezoidal rule in time). Also requires a tridiagonal solve, is **unconditionally stable**, and is **second-order accurate in time** — the best accuracy-for-cost, so it is the practitioner default. Its one wrinkle: it can produce spurious oscillations near non-smooth payoffs (the kink at the strike), often damped by taking a couple of fully-implicit steps first ("Rannacher smoothing").

Comparison:

```text
Scheme          Stability            Time accuracy   Cost per step
Explicit        conditional          O(dt)           cheap, no solve
Implicit        unconditional        O(dt)           tridiagonal solve
Crank-Nicolson  unconditional        O(dt^2)         tridiagonal solve
```

### Q9. Why is the explicit scheme only conditionally stable?

In the explicit scheme, each new value is a weighted combination of the three neighboring known values at the next time level. If the weights are all positive and sum to 1 the update is a genuine averaging and errors stay bounded — but if the time step dt is too large relative to the space step dS, one of those "weights" goes **negative**, and the scheme amplifies rather than damps small errors, so rounding noise explodes into garbage.

The condition (for the heat-equation form the BSM PDE reduces to) is roughly:

```text
dt <= (dS)^2 / (sigma^2 * S^2)     (schematically: dt ~ (dS)^2)
```

So halving the space step forces the time step down by a *factor of four* — you pay dearly in the number of time steps for spatial resolution. This is the same conditional-stability limit (a CFL-type condition) that appears throughout numerical PDEs. The **implicit** and **Crank-Nicolson** schemes avoid it entirely: because they solve for all nodes simultaneously (a linear system coupling the whole time level), they are *unconditionally* stable and let you take large time steps limited only by accuracy, not by stability. That freedom is why they are preferred despite the per-step cost of a linear solve.

### Q10. Compare trees, Monte Carlo, and PDE methods.

| Dimension of comparison | Binomial/Trinomial Tree | Monte Carlo | Finite-Difference PDE |
|---|---|---|---|
| Direction | Backward from expiry | Forward simulation | Backward from expiry |
| Early exercise (American) | Native (max at each node) | Hard — needs LSM | Native (max at each node) |
| Path-dependent (Asian, barrier) | Awkward (needs augmented state) | Natural — simulate the path | Awkward (extra dimensions) |
| High dimension (baskets) | Infeasible (exponential nodes) | Excellent (dimension-independent error) | Infeasible (curse of dimensionality) |
| Convergence / error | O(1/n), oscillatory | O(1/sqrt(N)), slow but robust | O(dt) or O(dt^2), fast in low dim |
| Greeks | Easy (read off adjacent nodes) | Needs care (bump / pathwise) | Easy (grid derivatives) |
| Best for | Low-dim American/vanilla | Path-dependent, high-dim | Low-dim, smooth PDEs, American |

The one-line summary practitioners carry: **grid methods (trees/PDE) for low-dimensional and early-exercise; Monte Carlo for path-dependent and high-dimensional.** The crossover is dimension ~3-4: below it, backward grid methods are faster and give Greeks cheaply; above it, only MC's dimension-independent O(1/sqrt(N)) survives the curse of dimensionality.

### Q11. How do you get option Greeks from a tree or a PDE grid?

Both methods give Greeks almost for free because you already have the option value at neighboring grid points — you just take finite differences, and delta/gamma can be read *from the tree you already built* without repricing.

On a binomial tree, use the nodes at the first (and second) time step:

```text
delta ~ ( V_up - V_down ) / ( S_up - S_down )              # from step-1 nodes
gamma ~ [ (V_uu - V_ud)/(S_uu - S_ud) - (V_ud - V_dd)/(S_ud - S_dd) ]
        / ( 0.5*(S_uu - S_dd) )                            # from step-2 nodes
theta ~ ( V_ud - V0 ) / (2*dt)                             # step-2 middle node vs root
```

On a finite-difference grid it is even more direct: delta = (V[i+1] - V[i-1])/(2*dS) and gamma = (V[i+1] - 2*V[i] + V[i-1])/dS^2 are exactly the spatial differences the scheme already computes, at the S0 node. Vega and rho require a small reprice with bumped sigma or r (they are not on the grid axes). This is a real advantage over Monte Carlo, where Greeks need bump-and-revalue with common random numbers or pathwise/likelihood-ratio estimators — trees and PDEs hand you delta and gamma as a byproduct of the pricing sweep.

### Q12. Price an American put with a two-step tree to show early exercise.

Use S0 = 100, K = 100, u = 1.2, d = 0.8333, r = 5%, dt = 1, p = 0.5944 (same tree as the call example). Terminal put payoffs max(K - S, 0):

```text
Prices:              American put payoffs at leaves:
S_uu = 144            V_uu = max(100-144,0) = 0
S_ud = 100            V_ud = max(100-100,0) = 0
S_dd = 69.44          V_dd = max(100-69.44,0) = 30.56
```

Roll back to step-1 nodes, taking max(continuation, intrinsic):

```text
Node u (S=120):  cont = e^-0.05*(0.5944*0 + 0.4056*0) = 0
                 intrinsic = max(100-120,0) = 0  ->  V_u = 0

Node d (S=83.33): cont = e^-0.05*(0.5944*0 + 0.4056*30.56)
                       = 0.95123*12.395 = 11.79
                 intrinsic = max(100-83.33,0) = 16.67
                 V_d = max(11.79, 16.67) = 16.67  <-- EARLY EXERCISE
```

At node d, exercising now (16.67) beats holding (11.79), so the American holder exercises. Roll to the root:

```text
V0 = e^-0.05*( 0.5944*0 + 0.4056*16.67 ) = 0.95123*6.761 = 6.43
```

The American put is worth **~6.43**. A European put on the same tree would use 11.79 (not 16.67) at node d, giving a *lower* value — the difference is the **early-exercise premium**. This is exactly the value a forward Monte Carlo cannot capture without LSM.

### Q13. What are the boundary and terminal conditions for solving the BSM PDE numerically?

A PDE alone does not determine the price — you need the **terminal condition** (the payoff, since we solve backward from expiry) and **boundary conditions** at the edges of the S-grid. For a European call:

```text
Terminal (t = T):   V(S, T) = max(S - K, 0)             # the payoff
Lower boundary:     V(0, t) = 0                          # worthless if S hits 0
Upper boundary:     V(S_max, t) -> S_max - K*exp(-r*(T-t))   # deep ITM ~ forward value
```

For a European put:

```text
Terminal:           V(S, T) = max(K - S, 0)
Lower boundary:     V(0, t) = K*exp(-r*(T-t))            # get K (discounted) if S=0
Upper boundary:     V(S_max, t) -> 0                     # worthless deep OTM
```

You choose S_max large enough (commonly 3-4x the strike or several standard deviations of ln(S)) that the boundary approximation is harmless. For an **American** option you additionally impose the early-exercise constraint V(S,t) >= intrinsic(S) at every grid point each time step (equivalently, solve a linear complementarity problem, or just take max(computed, intrinsic) after each step). Getting these conditions right is as important as the scheme itself — a wrong boundary quietly biases the whole grid.

### Q14. A binomial tree is really a finite-difference scheme. Explain.

The binomial (and especially the trinomial) tree is not a separate theory from the PDE approach — it is the **explicit finite-difference discretization** of the Black-Scholes PDE, viewed in the right coordinates. Change variables to x = ln(S); the BSM PDE becomes a constant-coefficient convection-diffusion (heat) equation. The explicit scheme updates each node from a weighted average of three neighbors at the next time level — up, middle, down — which is *exactly* a trinomial tree, where those weights are the risk-neutral probabilities.

The binomial tree is the two-branch special case (drop the middle node), and its risk-neutral p plays the role of the explicit-scheme weights. This immediately explains two things: (1) why binomial trees converge to Black-Scholes — they are a consistent discretization of its PDE; and (2) why trees inherit the explicit scheme's **conditional stability** — you cannot take arbitrarily coarse steps, and the probabilities p, 1-p must stay in [0,1] (the stability/positivity condition). It also tells you the *implicit* and *Crank-Nicolson* schemes are strictly more powerful cousins of the tree — same PDE, better stability — which is why serious pricers use PDE grids rather than trees for production.

### Q15. What are the practical limitations of trees and PDE grids?

1. **Curse of dimensionality.** Both are grid methods, so cost grows exponentially with the number of underlyings. A tree on d assets needs ~(steps)^d nodes; a PDE grid needs points in d spatial dimensions. Beyond ~3 factors they become infeasible and you switch to Monte Carlo, whose error is dimension-independent.

2. **Path dependence is awkward.** Asian, barrier, and lookback payoffs depend on the path, not just the terminal S, so you must *augment the state* (add a dimension for the running average or max), which raises cost. Barriers also need the grid aligned to the barrier level to avoid large errors. MC handles these naturally.

3. **Oscillatory / non-smooth-payoff issues.** Binomial convergence oscillates (sawtooth); Crank-Nicolson can oscillate near the payoff kink or a barrier (fixed by Rannacher start-up steps). Discontinuous payoffs (digitals) stress grids.

4. **Boundary truncation and grid design.** You must cap S_max artificially and choose grid spacing; poor choices bias the price or resolve gamma badly near the strike.

The consolation: within their sweet spot — low-dimensional, especially American/early-exercise — trees and PDEs are fast, give accurate Greeks off the grid, and are the right tool. Match the method to the payoff's dimension and path-dependence.

### Q16. You need to price a 5-asset worst-of American basket option. Which method and why?

This one is a genuine tension because the two features pull in opposite directions:

- **5 assets (high dimension)** screams **Monte Carlo** — a tree or PDE grid over 5 correlated underlyings is infeasible (curse of dimensionality; node/grid count explodes exponentially). MC's error stays O(1/sqrt(N)) regardless of dimension.
- **American / early exercise** screams **tree or PDE** — but those are ruled out by the dimension.

Resolution: use **Monte Carlo with Longstaff-Schwartz (LSM)**. Simulate the 5 correlated asset paths (draw normals, correlate them via Cholesky `X = L*Z`), evaluate the worst-of payoff `max(K - min(S_1,...,S_5), 0)` (or its call analog) along each path, and handle early exercise by LSM: at each exercise date, regress discounted future cashflows on basis functions of the current state to *estimate* the continuation value, then exercise where intrinsic exceeds it. This restores the backward-looking exercise decision that vanilla forward MC lacks, while keeping MC's dimension-independent convergence.

The reasoning the interviewer wants: identify that dimension kills the grid methods, that early exercise kills vanilla MC, and that LSM is precisely the bridge — MC for the dimension, regression for the early-exercise decision. Add variance reduction (antithetic, control variate on the European price) to tame the O(1/sqrt(N)) cost.
## Interest Rate Models

### Summary

**What this topic covers**

Modeling the term structure of interest rates and pricing the instruments that depend on it — bonds, caps, floors, and swaptions. This is where quant interviews move from "one stock, one volatility" (the Black-Scholes world) to "a whole curve that moves and mean-reverts." The 16 questions here cover: why rates are harder to model than equities; the classic **short-rate models** — **Vasicek**, **CIR**, and **Hull-White**; the intuition of **mean reversion**; the two "modern" framework families — **HJM** (the whole forward-rate curve) and the **LIBOR Market Model / BGM** (observable market forward rates); calibration to liquid caps and swaptions; and a glance at how you actually price a zero-coupon bond, a cap/floor, and a swaption once you have a model. Everything stays in ASCII maths with the intuition attached — you should leave able to write down `dr = a*(b - r)*dt + sigma*dW`, say what each term does, and explain why CIR keeps rates non-negative but Vasicek does not.

**Mental model**

An equity is one number; a yield curve is an infinite family of numbers (a rate for every maturity) that must move together arbitrage-free. So interest-rate modeling has an extra dimension of difficulty. Two intuitions carry most of it. First, **rates mean-revert**: unlike a stock (which can drift to the moon under GBM), short rates are pulled back toward a long-run level b by economic forces (central banks, inflation targeting). The generic mean-reverting drift is `a*(b - r)`: when r is above b the drift is negative, when below b it is positive, and a controls the speed. Second, **you must fit today's observed curve exactly** or you are quoting arbitrageable prices — this is why practitioners prefer Hull-White (Vasicek made time-dependent) over plain Vasicek, and why HJM/LMM model the whole curve directly. Think of short-rate models as "model r, integrate to get the curve" and HJM/LMM as "model the curve (or its forward rates) directly."

**Key terms**

- **Short rate r_t** — the instantaneous risk-free rate; the object short-rate models evolve as an SDE.
- **Mean reversion** — the pull-back-to-a-level property; drift `a*(b - r)`, speed a, long-run mean b.
- **Vasicek** — `dr = a*(b - r)*dt + sigma*dW`; Gaussian, tractable, but r can go negative.
- **CIR (Cox-Ingersoll-Ross)** — `dr = a*(b - r)*dt + sigma*sqrt(r)*dW`; the sqrt(r) diffusion vanishes at r=0, keeping rates non-negative (under the Feller condition `2*a*b >= sigma^2`).
- **Hull-White** — Vasicek with a time-dependent long-run level theta(t): `dr = (theta(t) - a*r)*dt + sigma*dW`, chosen to fit the initial curve exactly.
- **Affine term structure** — models where bond price = `exp(A(t,T) - B(t,T)*r)`; Vasicek, CIR, Hull-White all belong to this tractable family.
- **HJM (Heath-Jarrow-Morton)** — models the whole instantaneous forward-rate curve f(t,T); its key result is that no-arbitrage forces the forward drift to be determined entirely by the volatility structure.
- **LIBOR Market Model (LMM / BGM)** — models discrete, observable market forward rates (each lognormal under its own forward measure), consistent with Black's cap/swaption formulas.
- **Cap / floor** — a strip of interest-rate options (caplets/floorlets) that cap/floor a floating payment.
- **Swaption** — an option to enter an interest-rate swap; the main calibration instrument for the swaption vol surface.

**Why interviewers ask this**

Rates modeling separates the candidate who has only seen equity Black-Scholes from one who understands term-structure quant work — the bread and butter of a bank's rates desk. Juniors can recite "Vasicek is mean-reverting"; the signal an interviewer wants is deeper: why is mean reversion the defining feature of rates, what breaks when a Gaussian model lets r go negative (and why did that stop mattering after 2015's negative-rate regime), why do we bother with Hull-White over Vasicek (curve fit), and what conceptual leap HJM makes (model the curve, not the short rate). At the senior end they probe calibration — "you have a swaption vol surface, how do you fit LMM?" — which tests whether you connect abstract SDEs to tradable instruments. It is also a maturity check: knowing the model zoo and *when each is used* rather than memorizing one formula.

**Common confusions**

- "Vasicek is wrong because rates can go negative" — post-2015, negative rates are real; Vasicek's Gaussianity is a feature, not only a bug. The historical objection was theoretical, not fatal.
- Confusing the **speed** a with the **level** b in `a*(b - r)`: a is 1/(time to revert), b is where it reverts to.
- Thinking CIR is non-negative "because of the sqrt" alone — it also needs the Feller condition `2*a*b >= sigma^2` to stay strictly positive.
- Believing short-rate models fit today's curve automatically — plain Vasicek/CIR do NOT; you need the time-dependent Hull-White extension for an exact fit.
- Treating HJM as a specific model — it is a *framework*; a choice of forward-vol structure gives you a specific model (and can reproduce Hull-White).
- Confusing the short rate r_t (instantaneous) with observable market forwards (discrete, e.g. 3-month LIBOR) — LMM exists precisely to model the observable ones.

**What follows from this topic**

Rates modeling is the natural sequel to the stochastic-calculus and risk-neutral-valuation topics: the same `V = exp(-...)*E^Q[payoff]` machinery, but now the discount factor itself is stochastic, so `V = E^Q[exp(-integral_0^T r_s ds) * payoff]`. Calibration connects to the **Volatility** topic (caps/swaptions have their own implied-vol surfaces, the analog of the equity smile). The mean-reversion SDEs reappear in the **Time Series** topic as the discrete-time cousin (an AR(1) process is a discretized Ornstein-Uhlenbeck / Vasicek), and the whole apparatus feeds the **VaR & Risk** topic when you shock a yield curve.

### Q1. Why is modeling interest rates harder than modeling a stock price?

Three structural reasons, all worth stating out loud in an interview.

**It is a curve, not a number.** A stock is a single scalar S_t. An interest rate "level" is really an entire term structure — a rate for every maturity T — and all those points must move together in an arbitrage-free way. You are modeling an infinite-dimensional object (or a high-dimensional one after discretization), not a single diffusion.

**Rates mean-revert; stocks (under GBM) do not.** GBM lets S drift exponentially with no anchor. Short rates are tethered to a long-run level by central-bank policy and macro forces, so the right drift is a pull-back term `a*(b - r)`, not a constant `mu*S`. Getting this qualitative feature right is the whole game.

**You must fit today's prices exactly.** With one stock you calibrate one volatility. With rates you must reprice the entire observed discount curve (dozens of liquid bonds/swaps) AND the cap/swaption vol surface simultaneously — otherwise your model quotes arbitrageable prices against liquid instruments. This is why time-homogeneous models (Vasicek, CIR) are usually upgraded to time-inhomogeneous ones (Hull-White) that fit the curve by construction.

A fourth, subtler point: the discount factor is now itself stochastic, so pricing becomes `V = E^Q[exp(-integral_0^T r_s ds) * payoff]` — the rate you discount at is the very thing you are modeling.

### Q2. Write down the Vasicek model and explain each term.

```text
dr = a*(b - r)*dt + sigma*dW
```

- **r** — the instantaneous short rate.
- **a** — the speed of mean reversion (units 1/time). Large a snaps r back fast; roughly, the half-life of a deviation is `ln(2)/a`.
- **b** — the long-run mean level the rate reverts to.
- **a*(b - r)** — the mean-reverting drift: positive when r < b (pulls up), negative when r > b (pulls down), zero at r = b.
- **sigma** — the (constant, absolute) volatility of rate moves.
- **dW** — Brownian increment.

Vasicek is an **Ornstein-Uhlenbeck** process. Because the noise term `sigma*dW` is additive and independent of r, r is **Gaussian**: r_t is normally distributed, which makes bond prices and options analytically tractable (it is an affine model). The flip side of Gaussianity is that r can become **negative** with positive probability — historically seen as its main flaw, though negative rates became real post-2015.

Its mean and variance converge:

```text
E[r_t]   -> b
Var[r_t] -> sigma^2 / (2*a)   as t -> infinity
```

### Q3. Write down the CIR model and explain why it keeps rates non-negative.

```text
dr = a*(b - r)*dt + sigma*sqrt(r)*dW
```

Same mean-reverting drift as Vasicek, but the diffusion is `sigma*sqrt(r)` instead of `sigma`. The intuition for non-negativity:

As r approaches 0, the `sqrt(r)` factor shrinks the random shock toward zero, so the noise "switches off" exactly where it would otherwise push r negative. Meanwhile the drift `a*(b - r)` at r=0 is `a*b > 0`, a strictly positive push upward. Volatility dies and drift stays positive at the boundary, so r is reflected back up.

For r to stay **strictly** positive (never even touch 0), you need the **Feller condition**:

```text
2*a*b >= sigma^2
```

If this fails, r can hit 0 (but bounces back, never going negative). CIR is also affine and analytically tractable; its distribution is (scaled) non-central chi-squared. The state-dependent vol has an economic bonus: rate volatility rises with the level of rates, which matches data better than constant vol.

### Q4. What does Hull-White add over Vasicek, and why does that matter?

Vasicek is **time-homogeneous** — constant a, b, sigma — so it produces a model-implied yield curve that generally will NOT match today's observed curve. Trading off a curve you can't reprice is a non-starter.

**Hull-White** makes the reversion level time-dependent:

```text
dr = (theta(t) - a*r)*dt + sigma*dW
```

Here theta(t) is a deterministic function chosen so the model reproduces the **entire initial discount curve exactly**. You back theta(t) out from today's forward curve:

```text
theta(t) = f_T(0,t) + a*f(0,t) + (sigma^2/(2*a))*(1 - exp(-2*a*t))
```

(where f(0,t) is today's instantaneous forward rate). So Hull-White = "Vasicek with a calibrated, time-varying target" — you keep Gaussian tractability and analytic bond/option formulas, but now the model is arbitrage-free against the observed curve by construction. This exact-fit property is exactly why desks use Hull-White (and its multi-factor cousins) over plain Vasicek for pricing and hedging.

### Q5. Give the intuition for mean reversion. How would you estimate the speed a?

**Intuition.** Interest rates are not free to wander like a stock — central banks target inflation, and macro forces bound rates in a range. So when r is unusually high it tends to fall, and when unusually low it tends to rise. The drift `a*(b - r)` encodes exactly this restoring force: it is proportional to how far r is from its long-run home b, like a spring. The parameter a is the spring stiffness; a rate perturbed by an amount x decays back with characteristic half-life `ln(2)/a`.

**Estimation.** Discretize the Ornstein-Uhlenbeck SDE over a step dt — it becomes an **AR(1)** regression:

```text
r_{t+1} = c + phi*r_t + eps
```

with `phi = exp(-a*dt)`, so `a = -ln(phi)/dt`, and the long-run mean `b = c/(1 - phi)`. Run an OLS regression of r_{t+1} on r_t on historical short-rate data; phi is the slope. A slope near 1 means slow reversion (small a); a slope well below 1 means fast reversion. This is the same math as testing for a unit root — see the Time Series topic, where an AR(1) with phi=1 is a random walk (no mean reversion).

### Q6. What is the general pricing formula once rates are stochastic?

With a stochastic short rate, the discount factor is no longer deterministic. The risk-neutral price of any claim paying H at time T is:

```text
V_0 = E^Q[ exp(-integral_0^T r_s ds) * H ]
```

The zero-coupon bond is the special case H = 1:

```text
P(0,T) = E^Q[ exp(-integral_0^T r_s ds) ]
```

The key difficulty versus Black-Scholes: the discount factor `exp(-integral r_s ds)` is now a random variable that is *correlated with the payoff*, so you cannot pull it out of the expectation as `exp(-r*T)`. For affine models (Vasicek, CIR, Hull-White) this expectation has a closed form:

```text
P(t,T) = exp( A(t,T) - B(t,T)*r_t )
```

The functions A and B come from solving a pair of ODEs (Riccati ODEs). This **affine** structure is precisely why these three models are the workhorses — bond prices, and hence the whole curve, are explicit functions of the current short rate.

### Q7. Sketch the Vasicek zero-coupon bond price.

Vasicek is affine, so `P(t,T) = exp(A(t,T) - B(t,T)*r_t)` with:

```text
B(t,T) = (1 - exp(-a*(T - t))) / a
A(t,T) = (B(t,T) - (T - t)) * (a^2*b - sigma^2/2) / a^2  -  sigma^2*B(t,T)^2 / (4*a)
```

You do not need to memorize A exactly for most interviews, but you should be able to say:

- The bond price is **log-linear** in the current short rate r_t: higher r today means lower bond price (rates up, prices down), and the sensitivity is `-B(t,T)`.
- `B(t,T)` plays the role of a **duration**: it grows with maturity but saturates at 1/a because of mean reversion (long bonds are less sensitive per unit maturity than a non-mean-reverting model would predict).
- The continuously compounded yield `R(t,T) = -ln(P)/(T-t)` is affine in r_t, so the whole yield curve is pinned by one state variable — the model can only produce a limited set of curve shapes, which is why multi-factor extensions exist.

### Q8. What is the HJM framework and its central insight?

**HJM (Heath-Jarrow-Morton)** models the entire **instantaneous forward-rate curve** f(t,T) directly, rather than modeling the short rate and deriving the curve. You specify the forward-rate dynamics:

```text
df(t,T) = alpha(t,T)*dt + sigma(t,T)*dW
```

The central result — the **HJM drift condition** — is that no-arbitrage *forces* the drift to be a specific function of the volatility:

```text
alpha(t,T) = sigma(t,T) * integral_t^T sigma(t,u) du
```

**The insight:** once you choose the forward-rate **volatility structure** sigma(t,T), the drift is completely determined — you have no freedom left. Intuitively, if the drift were anything else you could construct an arbitrage across bonds of different maturities. So the entire model is parameterized by the volatility function alone.

HJM is a **framework**, not one model: pick sigma(t,T) constant and you recover Ho-Lee; pick `sigma*exp(-a*(T-t))` and you recover Hull-White. Its weakness is that it works with instantaneous forwards, which are not directly observable, and generic HJM models are non-Markovian (path-dependent, hard to compute) — which motivates the LIBOR Market Model.

### Q9. What is the LIBOR Market Model (LMM / BGM) and why was it a breakthrough?

HJM models unobservable *instantaneous* forward rates. The **LIBOR Market Model** (also called BGM, for Brace-Gatarek-Musiela) instead models the **discrete, observable market forward rates** — e.g. the set of 3-month or 6-month forward rates L_i that actually underlie caps and swaps.

Its defining feature: each forward rate L_i is modeled as **lognormal under its own forward measure**:

```text
dL_i / L_i = sigma_i(t)*dW_i   (under the T_{i+1}-forward measure)
```

**Why it was a breakthrough:** the market was already quoting caps and swaptions using **Black's formula**, which *assumes* the forward rate is lognormal. LMM is the arbitrage-free multi-rate model *consistent with that market convention* — so it reproduces Black's cap prices exactly and lets you calibrate directly to quoted Black implied vols. It bridged the gap between the theoretical no-arbitrage world (HJM) and the practical market-quote world.

The cost: under a single common measure the different L_i's have measure-dependent drifts (you handle this via the "change of numeraire" bookkeeping), and it is high-dimensional, so LMM pricing is usually done by Monte Carlo.

### Q10. How do you price a caplet, and how does it connect to Black's formula?

A **cap** protects a floating-rate borrower: it is a strip of **caplets**, each paying, at the end of a period, the excess of the floating rate over the strike. A single caplet on forward rate L with strike K, notional N, accrual tau, resetting at T and paying at T+tau has time-(T+tau) payoff:

```text
payoff = N * tau * max(L - K, 0)
```

Because the payoff is `max(forward rate - K, 0)` and LMM/market convention makes the forward rate lognormal, the caplet prices with **Black's formula** (the same shape as Black-Scholes, forward version):

```text
Caplet = N*tau*P(0,T+tau) * [ L0*N(d1) - K*N(d2) ]
d1 = ( ln(L0/K) + 0.5*sigma^2*T ) / ( sigma*sqrt(T) )
d2 = d1 - sigma*sqrt(T)
```

where L0 is today's forward rate, sigma is the caplet's Black vol, and P(0,T+tau) is today's discount factor to the payment date. A **floorlet** is the put analog (`max(K - L, 0)`). A cap is just the sum of its caplet prices; the quoted "cap vol" is a single flat vol that reprices the whole strip.

### Q11. What is a swaption and why is it the key calibration instrument?

A **swaption** is an option to enter an interest-rate swap at a fixed strike rate on a future date. A **payer** swaption is the right to pay fixed / receive floating (valuable if rates rise); a **receiver** swaption is the right to receive fixed (valuable if rates fall). It is essentially a call/put on the forward swap rate, and it too is quoted with a **Black formula** on the forward swap rate.

**Why it drives calibration:** swaptions are the most liquid volatility instruments on the rates market, quoted across a grid of option expiries and underlying swap tenors — the **swaption vol cube/surface**. To use a model (Hull-White, LMM) for pricing exotics, you first choose its parameters (the sigma structure, the mean-reversion a) so the model **reprices this liquid swaption surface**. That is calibration: match the model's swaption prices to market swaption prices, then trust the calibrated model to price the illiquid exotic consistently. Caps calibrate the per-forward vols; swaptions add the crucial **correlation/covariance** information between forward rates, which caps alone cannot pin down.

### Q12. Compare short-rate models, HJM, and LMM.

| Aspect | Short-rate (Vasicek/CIR/Hull-White) | HJM | LMM / BGM |
|---|---|---|---|
| Models | the instantaneous short rate r_t | the whole instantaneous forward curve f(t,T) | discrete observable forward rates L_i |
| State dimension | 1 (or few) factors | infinite-dim curve | one factor per forward rate |
| Fits initial curve | only Hull-White exactly | yes, by construction | yes, by construction |
| Observable inputs | no (r is instantaneous) | no (instantaneous forwards) | yes (market forwards, Black vols) |
| Tractability | high (affine, closed-form bonds) | often non-Markovian, hard | high-dim, needs Monte Carlo |
| Typical use | Bermudan swaptions, quick pricing, curve modeling | theoretical backbone / special cases | complex path-dependent rate exotics |

The mental one-liner: **short-rate models are simplest and analytically friendly but restrictive; HJM is the general no-arbitrage theory of the forward curve; LMM is HJM made practical by modeling the rates the market actually quotes.**

### Q13. Why can Vasicek produce negative rates, and does it matter?

**Why:** the diffusion term is `sigma*dW` — additive Gaussian noise that is independent of the level of r. Since r is normally distributed with nonzero variance, it has positive probability of being below zero. Nothing in the SDE prevents r from crossing zero; the drift `a*(b - r)` only pulls it toward b, it does not enforce a floor.

**Does it matter?** Historically this was Vasicek's headline flaw, and it motivated CIR (whose `sqrt(r)` diffusion vanishes at zero). But:

- Post-2015, several major economies (EUR, JPY, CHF) actually had **negative policy rates**, so a model that permits negative rates became a feature, not a bug — CIR's inability to go negative became the *wrong* assumption for those markets.
- The probability of deeply negative rates in Vasicek is often small over realistic horizons, and Gaussianity buys huge analytic tractability (closed-form bonds and options, easy correlation via multi-factor Gaussian models).

So the honest interview answer: negative rates in Vasicek are real, but whether they are a problem depends entirely on the rate regime you are modeling. Practitioners often use shifted-lognormal or Gaussian models precisely to accommodate negative rates.

### Q14. Discretize the Vasicek/OU process for simulation.

Because Vasicek is linear Gaussian, you can simulate it **exactly** (no Euler bias). Over a step of size dt:

```python
import numpy as np

def simulate_vasicek(r0, a, b, sigma, dt, n_steps, n_paths):
    r = np.full(n_paths, r0)
    # exact transition: r_{t+dt} = b + (r_t - b)*e^{-a dt} + noise
    mean_factor = np.exp(-a*dt)
    std = sigma*np.sqrt((1 - np.exp(-2*a*dt))/(2*a))
    out = np.empty((n_steps+1, n_paths))
    out[0] = r
    for t in range(1, n_steps+1):
        z = np.random.standard_normal(n_paths)
        r = b + (r - b)*mean_factor + std*z
        out[t] = r
    return out
```

The exact scheme uses the fact that, conditional on r_t, the next value is normal with mean `b + (r_t - b)*exp(-a*dt)` and variance `sigma^2*(1 - exp(-2*a*dt))/(2*a)`. A cruder **Euler-Maruyama** step would be `r += a*(b - r)*dt + sigma*sqrt(dt)*z`, which is fine for small dt but introduces discretization error. For CIR you generally must use Euler with a reflection/full-truncation fix (or the exact non-central chi-squared scheme) because `sqrt(r)` can otherwise send r negative numerically.

### Q15. Brainteaser: a rate follows dr = a*(b - r)*dt + sigma*dW with r_0 above b. What is E[r_t], and what is the long-run distribution?

Take expectations of the SDE. The `dW` term has mean zero, so:

```text
dE[r_t] = a*(b - E[r_t])*dt
```

This is a linear ODE; solving it:

```text
E[r_t] = b + (r_0 - b)*exp(-a*t)
```

Since r_0 > b, the term `(r_0 - b)` is positive but is multiplied by the decaying `exp(-a*t)`, so **E[r_t] decays monotonically from r_0 down to b** — the rate is expected to drift back toward its long-run mean, which is exactly what mean reversion says. The half-life of the gap is `ln(2)/a`.

For the **long-run (stationary) distribution**, note r is Gaussian (OU process). As t -> infinity the mean -> b and the variance -> `sigma^2/(2*a)`, so:

```text
r_infinity ~ Normal( b, sigma^2/(2*a) )
```

Sanity checks: faster reversion (bigger a) means a tighter stationary spread (variance falls as 1/a), and bigger sigma means a wider one. This is the continuous-time analog of the stationary variance of an AR(1) process.

### Q16. In one line each, when would you reach for Vasicek, CIR, Hull-White, and LMM?

- **Vasicek** — when you want the simplest analytically tractable mean-reverting Gaussian model and don't need an exact curve fit; good for intuition and quick analytics, tolerant of (or wanting) negative rates.
- **CIR** — when non-negativity of rates is essential (a positive-rate regime) and you want state-dependent vol that rises with the rate level.
- **Hull-White** — the practical default for pricing and hedging a single-curve book: keeps Gaussian tractability but fits today's curve exactly via theta(t), so it prices Bermudan swaptions and other rate exotics arbitrage-free against the market.
- **LMM / BGM** — when you need a model consistent with market-quoted Black cap/swaption vols and are pricing complex, path-dependent, multi-rate exotics where matching the full vol surface and forward-rate correlations matters; accept Monte Carlo cost.

## Value at Risk & Risk Measures

### Summary

**What this topic covers**

How a desk or firm answers "how much could we lose?" in one number — and why that one number is trickier than it looks. The 16 questions here cover: the precise **definition of Value at Risk (VaR)**; the **three standard methods** to compute it — **historical simulation**, **parametric / variance-covariance**, and **Monte Carlo** — with their trade-offs; **Expected Shortfall (ES / CVaR)** and why regulators moved to it; the four **coherent-risk-measure axioms** (monotonicity, subadditivity, positive homogeneity, translation invariance) and the crucial fact that **VaR is not subadditive** (it can punish diversification) while **ES is coherent**; **backtesting** VaR (the Kupiec test); **stress testing**; and the model's limitations, sharpened by the 2008 critique. The recurring theme: VaR is a useful, intuitive, communicable summary, but it is a *quantile*, not an *average of the tail* — and that distinction has real mathematical and regulatory consequences.

**Mental model**

Picture the probability distribution of your portfolio's P&L over the next day. VaR at 99% is a **line drawn on the loss axis**: the loss level such that only 1% of outcomes are worse. It answers "on a bad day, how bad, at the threshold?" — but it says **nothing about how bad the worst 1% actually gets**. Expected Shortfall stands one step further into the tail and answers "*given* we breach the VaR line, what is the average loss beyond it?" — so ES always sits at or beyond VaR and it "sees" the shape of the tail. The second core intuition is that VaR is a *quantile*, and quantiles don't add up nicely: merge two portfolios and the combined quantile can exceed the sum of the individual quantiles, which absurdly says diversification *increased* risk. That single defect — non-subadditivity — is why the theory of coherent risk measures exists and why Basel moved the regulatory standard from 99% VaR to 97.5% ES.

**Key terms**

- **VaR_alpha (horizon h)** — the loss that will not be exceeded with probability alpha over horizon h; equivalently the alpha-quantile of the loss distribution. E.g. 99% 1-day VaR of 1m means "1% chance of losing more than 1m tomorrow."
- **Confidence level alpha** — the probability the loss stays within VaR (95%, 99%, 97.5%).
- **Historical simulation** — reprice the portfolio under actual historical return scenarios; VaR = the empirical quantile.
- **Parametric / variance-covariance** — assume returns are (multivariate) normal; `VaR = z_alpha * sigma * sqrt(h) * V`.
- **Monte Carlo VaR** — simulate many scenarios from an assumed model, reprice, take the quantile.
- **Expected Shortfall / CVaR** — the average loss conditional on being beyond VaR: `ES = E[loss | loss > VaR]`.
- **Coherent risk measure** — one satisfying monotonicity, subadditivity, positive homogeneity, and translation invariance.
- **Subadditivity** — `risk(A + B) <= risk(A) + risk(B)`; risk of the whole never exceeds the sum of the parts (diversification cannot hurt).
- **Backtesting** — comparing realized breaches ("exceptions") to the model's predicted rate; the **Kupiec** POF test checks the count.
- **Stress testing** — evaluating losses under specific extreme but plausible scenarios, complementing statistical VaR.

**Why interviewers ask this**

Risk questions are a fast filter for whether a candidate understands risk beyond a spreadsheet. Anyone can quote "99% VaR"; the signal is precision — can you state the horizon and confidence, translate 99% to z = 2.33, and immediately name what VaR does NOT tell you (the size of the tail beyond it)? The senior signal is the coherence discussion: knowing that VaR can violate subadditivity, being able to construct a two-asset counterexample, and explaining why that pushed regulators to ES. Interviewers at risk-heavy shops also want operational judgment — pros and cons of the three methods, why you backtest, why you also stress test, and the humility to recite the 2008 critique (VaR under-measures tail risk, assumes stable correlations, and breeds false confidence). It is equal parts math, regulation, and epistemics.

**Common confusions**

- "VaR is the maximum I can lose" — no; it is a threshold you exceed alpha-complement of the time. Losses beyond VaR are unbounded; VaR is explicitly silent about them.
- Confusing 99% VaR (a quantile) with the *expected* loss — VaR is not an average; ES is the tail average.
- Forgetting the two parameters: a VaR number is meaningless without **both** the confidence level and the **horizon**.
- Thinking VaR is always subadditive — it is subadditive for elliptical (e.g. normal) returns, but NOT in general; it can fail for fat-tailed or nonlinear (option) portfolios.
- Assuming parametric VaR handles options — the normal/linear approximation breaks for nonlinear payoffs; you need full revaluation or Monte Carlo.
- Believing a good backtest validates the model's tail — passing Kupiec only checks the breach *frequency*, not the *severity* of breaches (that is ES's job).

**What follows from this topic**

VaR ties the whole quant syllabus into a risk number. The parametric method rests directly on the **Normal distribution** and the covariance matrix from **portfolio theory** (`sigma_p^2 = w'*Sigma*w`), so VaR is the risk-management face of Markowitz. Monte Carlo VaR reuses the **simulation** machinery (GBM paths, Cholesky for correlated shocks) from the numerical-methods topic. The tail-behavior discussion connects to **fat tails / kurtosis** from the distributions topic — the reason normal VaR under-measures risk. And the time-scaling `sqrt(h)` and volatility inputs connect to the **volatility / GARCH** topic, since a VaR is only as good as its variance forecast.

### Q1. Define Value at Risk precisely.

**VaR at confidence level alpha over horizon h is the loss that will not be exceeded with probability alpha.** Formally, if L is the loss (a positive number for a loss) over the horizon:

```text
VaR_alpha = inf { x : P(L <= x) >= alpha }
```

i.e. VaR is the **alpha-quantile of the loss distribution**. Equivalently, the probability of a loss *worse* than VaR is `1 - alpha`.

The two parameters are non-negotiable — a VaR number is meaningless without both:
- **Confidence alpha** — e.g. 99% (so 1% of days are worse) or 97.5%.
- **Horizon h** — e.g. 1 day, 10 days.

Concrete reading: "the 99% 1-day VaR is 1m" means "there is a 1% chance we lose more than 1m over the next trading day" — equivalently, we expect to lose more than 1m on about 1 day in 100. Crucially, VaR says how deep the *threshold* is, not how bad the loss is when you breach it.

### Q2. What are the three main methods for computing VaR?

**1. Historical simulation.** Take the portfolio's current positions and revalue them under each of the last N historical scenarios (e.g. the daily return vectors of the past 250-500 days). Sort the resulting P&Ls; the VaR is the empirical quantile (e.g. the 5th-worst of 500 for 99%). No distributional assumption — the data supplies the distribution.

**2. Parametric (variance-covariance / delta-normal).** Assume returns are multivariate normal. Compute the portfolio's volatility from the covariance matrix and read VaR off the normal quantile:

```text
VaR_alpha = z_alpha * sigma_p * sqrt(h) * V
sigma_p   = sqrt( w' * Sigma * w )
```

where z_alpha is the standard-normal quantile (1.65 for 95%, 2.33 for 99%), V is portfolio value, and h scales to the horizon.

**3. Monte Carlo.** Assume a model for risk factors (e.g. correlated GBM), simulate many forward scenarios, fully reprice the portfolio in each, and take the quantile of simulated losses.

All three answer the same question; they differ in how they generate the loss distribution — from history, from a formula, or from a simulated model.

### Q3. Derive the parametric VaR formula for a single normally-distributed position.

Let the position value be V and its return R over the horizon be normal: `R ~ Normal(mu, sigma^2)`. The loss is `L = -V*R`. We want the loss threshold exceeded with probability `1 - alpha`:

```text
P(L > VaR) = 1 - alpha
P(-V*R > VaR) = 1 - alpha
P(R < -VaR/V) = 1 - alpha
```

Standardize R: `(R - mu)/sigma` is standard normal, so `-VaR/V = mu + sigma*z_{1-alpha}`, where `z_{1-alpha}` is the lower `(1-alpha)` quantile = `-z_alpha`. Rearranging:

```text
VaR = V*( z_alpha*sigma - mu )
```

Over a short (e.g. 1-day) horizon the drift mu is tiny relative to volatility, so it is standard to **drop mu** and use:

```text
VaR_alpha = z_alpha * sigma * V
```

To scale from a 1-period sigma to horizon h, use the square-root-of-time rule (valid under i.i.d. returns): `sigma_h = sigma*sqrt(h)`, giving the standard `VaR = z_alpha * sigma * sqrt(h) * V`. Numeric example: V = 10m, daily sigma = 2%, 99% (z = 2.33), 1-day: `VaR = 2.33 * 0.02 * 10m = 466k`.

### Q4. What are z_alpha for the common confidence levels?

These are the standard-normal quantiles you should have memorized for parametric VaR:

```text
alpha = 90%   ->  z = 1.28
alpha = 95%   ->  z = 1.645
alpha = 97.5% ->  z = 1.96
alpha = 99%   ->  z = 2.33
alpha = 99.9% ->  z = 3.09
```

The two you truly must know cold are **95% -> 1.645** and **99% -> 2.33**. Note 97.5% -> 1.96 is the number Basel's ES standard uses, and it is also the familiar two-sided 95% confidence-interval z. A quick sanity check in interviews: moving from 95% to 99% multiplies parametric VaR by `2.33/1.645 ~ 1.42`, so a 99% VaR is roughly 40% larger than the 95% figure for the same book.

### Q5. Compare the three VaR methods (pros and cons).

| Method | Pros | Cons |
|---|---|---|
| **Historical simulation** | No distributional assumption; captures fat tails, skew, real correlations; handles nonlinear/option payoffs via full reval; easy to explain | Assumes the past repeats; limited tail data (a 99% VaR from 250 days rests on ~2-3 points); slow to react to regime change; equal weight to old data |
| **Parametric (var-cov)** | Fast, closed-form, only needs mean/covariance; scales analytically; transparent | Assumes normality (understates fat tails); linear/delta approximation breaks for options; unstable covariance estimates; misses skew |
| **Monte Carlo** | Flexible model (fat tails, jumps, stochastic vol); handles nonlinearity and path dependence; full distribution, easy ES too | Computationally heavy (full reval x many paths); model risk (only as good as assumed dynamics); slow convergence O(1/sqrt(N)) |

Rule of thumb: **parametric** for a quick, linear, roughly-normal book; **historical** as the transparent regulatory default; **Monte Carlo** when the book has significant optionality or you need a non-normal model.

### Q6. Define Expected Shortfall and contrast it with VaR.

**Expected Shortfall (ES), also called Conditional VaR (CVaR)** or expected tail loss, is the **average loss conditional on the loss exceeding VaR**:

```text
ES_alpha = E[ L | L > VaR_alpha ]
```

Equivalently it is the average of all the losses in the worst `(1 - alpha)` tail. For a continuous distribution:

```text
ES_alpha = (1/(1-alpha)) * integral_alpha^1 VaR_u du
```

**Contrast:** VaR is a **point** (the quantile — "how deep is the threshold?"); ES is an **average over the tail beyond that point** ("*given* we're past the threshold, how bad on average?"). Consequences:

- ES >= VaR always (the tail average is at least the tail's entry point).
- ES is **sensitive to the shape/severity of the tail**; VaR is blind to everything beyond the quantile. Two portfolios with identical VaR can have wildly different ES if one has a fatter tail.
- ES is a **coherent** risk measure (in particular subadditive); VaR is not. This is why Basel III's FRTB replaced 99% VaR with **97.5% ES** as the regulatory standard.

Numeric intuition: for a standard normal loss, 99% VaR = 2.33 sigma but 99% ES ~ 2.67 sigma — the tail average sits notably beyond the quantile.

### Q7. State the four axioms of a coherent risk measure.

A risk measure rho is **coherent** (Artzner-Delbaen-Eber-Heath, 1999) if for all positions X, Y:

- **Monotonicity** — if X <= Y in every state (X always loses at least as much), then `rho(X) >= rho(Y)`. Worse outcomes -> at least as much measured risk.
- **Subadditivity** — `rho(X + Y) <= rho(X) + rho(Y)`. Merging portfolios never increases total risk; diversification can only help. This is the key one.
- **Positive homogeneity** — `rho(lambda*X) = lambda*rho(X)` for lambda >= 0. Doubling the position doubles the risk (scale invariance).
- **Translation invariance** — `rho(X + c) = rho(X) - c` for a certain cash amount c. Adding riskless cash reduces measured risk one-for-one (it's a capital buffer).

Positive homogeneity + subadditivity together imply **convexity** (`rho(lambda X + (1-lambda) Y) <= lambda rho(X) + (1-lambda) rho(Y)`), which is what makes risk-based optimization well-behaved. **ES satisfies all four; VaR satisfies all but subadditivity.**

### Q8. Show with an example that VaR is not subadditive.

Subadditivity fails when tail events are "lumpy." Classic construction: two independent defaultable bonds.

Each bond A and B pays a small coupon of +2 with probability 0.98, but suffers a loss of -100 with probability 0.02 (a rare default). Take the **95% VaR** of each individually. Since the default probability (2%) is *less* than the 5% tail, the 95%-quantile loss falls in the non-default region:

```text
VaR_95(A) = VaR_95(B) = -2   (i.e. a gain of 2; the 5% quantile misses the default)
```

Now hold both, independent. The probability that **at least one** defaults is `1 - 0.98^2 = 0.0396 ~ 3.96% > 5%`? Actually 3.96% < 5%, so refine: probability of at least one default 3.96%, which is within the worst 5%. So the 5% tail of the combined book now *includes* single-default scenarios with loss around 100:

```text
VaR_95(A + B) ~ 98   (a default shows up inside the 5% tail)
```

Then:

```text
VaR_95(A + B) = 98   >   VaR_95(A) + VaR_95(B) = -2 + -2 = -4
```

The combined VaR exceeds the sum of the parts — **diversification appears to increase risk**, which is absurd. That is the subadditivity violation. ES, by averaging over the whole tail, does not have this pathology. The general lesson: VaR can be non-subadditive for skewed/fat-tailed or default-type (discrete jump) exposures; it *is* subadditive when returns are elliptical (e.g. multivariate normal).

### Q9. Why did regulators move from VaR to Expected Shortfall?

Two linked reasons, both crystallized after 2008.

**VaR ignores the tail's severity.** By construction VaR is silent about losses beyond the quantile. A book can have an acceptable 99% VaR while hiding catastrophic losses just past it (a "cliff" in the tail). ES, being the average over that tail, captures how bad the worst `(1 - alpha)` outcomes actually are, which is exactly what a capital buffer should protect against.

**VaR is not subadditive.** Because it can penalize diversification (Q8), VaR is not a coherent risk measure, so risk aggregation and capital allocation across desks can behave perversely. ES is coherent (subadditive), so aggregating ES across desks is sound and it plays well with portfolio optimization (it is convex).

Concretely, Basel III's **FRTB** (Fundamental Review of the Trading Book) replaced the old **99% VaR** market-risk capital standard with **97.5% ES**. The 97.5% ES is calibrated to be roughly comparable to 99% VaR for normal distributions but strictly better in the tails and coherent by construction. The move is the regulatory embodiment of "measure the average of the tail, not just its edge."

### Q10. How do you backtest a VaR model? Explain the Kupiec test.

**Backtesting** compares the model's predicted breach rate to reality. For a 99% 1-day VaR, you expect the actual daily loss to exceed the VaR estimate on about **1% of days**. Each such exceedance is an "**exception**." Count exceptions over, say, 250 trading days: you expect ~2.5. Too many means the model under-measures risk; far too few means it is overly conservative (wasting capital).

**Kupiec's POF (Proportion of Failures) test** formalizes "is the observed exception rate consistent with the model's `p = 1 - alpha`?" With N observations and x exceptions, the likelihood-ratio statistic is:

```text
LR_POF = -2 * ln[ ( (1-p)^(N-x) * p^x ) / ( (1-(x/N))^(N-x) * (x/N)^x ) ]
```

Under the null (the model is correct), `LR_POF` is chi-squared with 1 degree of freedom, so you reject if it exceeds 3.84 (5% level). Intuition: it asks whether the empirical failure frequency x/N is far enough from the target p to be implausible by chance.

Limitation worth stating: Kupiec only checks the **number** of exceptions (unconditional coverage), not whether they **cluster** in time. Clustering (breaches bunching in a crisis) signals the model doesn't react to volatility; **Christoffersen's** test adds an independence check. And no frequency test captures exception *severity* — that is precisely the gap ES is meant to fill. Basel's traffic-light system (green/amber/red zones) is essentially a Kupiec-style exception count.

### Q11. What is stress testing and why do you need it on top of VaR?

**Stress testing** evaluates portfolio losses under **specific, severe, plausible scenarios** rather than from the statistical distribution of everyday returns. Two flavors:

- **Historical scenarios** — replay a named crisis: the 1987 crash, 2008 (Lehman), the 2020 COVID shock, a specific rate spike.
- **Hypothetical scenarios** — construct shocks: "equities -20%, credit spreads +200bp, USD +10%, correlations -> 1."

**Why you need it beyond VaR:** VaR is estimated from a recent, "normal" window and typically assumes stable volatilities and correlations. Exactly in a crisis those assumptions fail — volatility jumps, diversification vanishes as correlations spike to 1, and the loss lands in the tail region VaR under-samples. Historical VaR based on 250 calm days simply has no data for a once-in-a-decade move. Stress testing deliberately probes those tail regimes, is not tied to a probability estimate (it answers "what if" not "how likely"), and reveals concentration and correlation risks a single VaR number hides. Regulators require it precisely because 2007-08 showed statistical VaR gave false comfort right before the worst losses.

### Q12. Give the parametric VaR of a two-asset portfolio.

Let weights (dollar amounts) be w_A and w_B, daily vols sigma_A and sigma_B, and correlation rho. The portfolio's daily P&L standard deviation is:

```text
sigma_p = sqrt( w_A^2*sigma_A^2 + w_B^2*sigma_B^2 + 2*rho*w_A*w_B*sigma_A*sigma_B )
```

and (dropping drift) the parametric VaR is:

```text
VaR_p = z_alpha * sigma_p * sqrt(h)
```

The diversification shows up through rho: if `rho < 1`, `sigma_p` is strictly less than `w_A*sigma_A + w_B*sigma_B`, so:

```text
VaR_p  <  VaR_A + VaR_B    (when rho < 1)
```

That inequality is exactly **subadditivity holding** — and it always holds in the parametric/normal world, which is why the non-subadditivity pathology of Q8 only appears with non-elliptical (fat-tailed, default-type) distributions, not in the Gaussian var-cov model. Numeric: w_A = w_B = 5m, sigma_A = sigma_B = 2%, rho = 0.5, 99% 1-day: `sigma_p = sqrt(2*(5m*0.02)^2*(1+0.5)) = sqrt(2*10000^2*1.5) ~ 173.2k`, `VaR = 2.33*173.2k ~ 404k`, versus `VaR_A + VaR_B = 2*233k = 466k` — diversification saves ~62k.

### Q13. How do you compute VaR and ES from a Monte Carlo simulation?

Simulate many portfolio P&L scenarios, sort, and read off the quantile (VaR) and the tail average (ES):

```python
import numpy as np

def var_es_from_pnl(pnl, alpha=0.99):
    # pnl: array of simulated P&L (losses are negative)
    losses = -pnl
    losses_sorted = np.sort(losses)              # ascending
    idx = int(np.ceil(alpha * len(losses))) - 1  # alpha-quantile index
    var = losses_sorted[idx]
    es  = losses_sorted[idx:].mean()             # average of the tail beyond VaR
    return var, es

# example: correlated normal risk factors via Cholesky
np.random.seed(0)
n = 200_000
Sigma = np.array([[0.0004, 0.0002],[0.0002, 0.0009]])  # daily cov of 2 assets
L = np.linalg.cholesky(Sigma)
z = np.random.standard_normal((n, 2))
rets = z @ L.T                          # correlated returns
weights = np.array([5_000_000, 5_000_000])
pnl = rets @ weights                    # portfolio P&L per scenario
var99, es99 = var_es_from_pnl(pnl, 0.99)
```

Key points: (1) ES falls out almost for free once you have the sorted losses — just average the tail, which is one reason ES is easy in Monte Carlo/historical frameworks. (2) The estimate's error scales as **O(1/sqrt(N))**, and the *tail* quantile is the noisiest part, so tail VaR/ES need many paths (or variance reduction / importance sampling focused on the tail). (3) Cholesky (`Sigma = L*L'`, `X = L*z`) is the standard way to inject the correlation structure into the shocks.

### Q14. What were the main criticisms of VaR after the 2008 crisis?

The crisis turned textbook caveats into headline failures:

- **It ignores tail severity.** VaR says nothing about losses beyond the quantile, and 2008's losses lived deep in that ignored tail. Firms with "acceptable" VaR still blew up. (Motivated the shift to ES.)
- **Normality understates fat tails.** Parametric VaR assumed roughly-normal returns; real returns have excess kurtosis, so genuine tail events are far more likely than the model implied — the fabled "25-sigma events, several days in a row" quip.
- **Correlations are unstable and spike in crises.** VaR's diversification benefit assumes stable correlations; in a crash correlations converge to 1 and the assumed diversification evaporates exactly when needed.
- **Short, calm estimation windows.** VaR estimated on a recent quiet period is procyclical — it reads *low* just before a storm and only rises after losses hit, giving false comfort and amplifying deleveraging.
- **Non-subadditivity / gaming.** Being incoherent, VaR can be manipulated and misallocates capital; it can even reward concentration.
- **False precision / model risk.** A single confident-looking number bred overconfidence and displaced judgment. Nassim Taleb's critique: VaR gives the illusion of measuring the unmeasurable tail.

The constructive response: complement VaR with **ES**, **stress testing**, longer/stressed calibration windows, and explicit tail-risk analysis rather than trusting one Gaussian quantile.

### Q15. If daily VaR is X, what is the 10-day VaR? State the assumption.

Under the **square-root-of-time rule**:

```text
VaR(10-day) = VaR(1-day) * sqrt(10) ~ 3.16 * VaR(1-day)
```

More generally `VaR(h) = VaR(1)*sqrt(h)`. This comes from variance scaling linearly with time: for i.i.d. returns, the variance over h days is h times the daily variance, so the standard deviation (and hence VaR, which is proportional to it) scales with `sqrt(h)`. Basel's 10-day market-risk horizon is often obtained by scaling a 1-day figure this way.

**The assumptions — and why they can fail:**
- Returns are **i.i.d.** with **zero autocorrelation**. If returns are positively autocorrelated (trending/momentum), true multi-period variance exceeds h*sigma^2 and sqrt-time **understates** risk; mean-reverting returns make it overstate.
- **Constant volatility** over the horizon (no vol clustering / GARCH effects).
- **Zero drift** (fine for short horizons, less so as h grows).
- It scales volatility, so it is only exact for the *distributional spread*; for nonlinear (option) books the quantile does not scale so cleanly.

So sqrt-time is a convenient approximation, exact only for i.i.d. zero-drift returns; real markets' vol clustering and autocorrelation make it a rough rule.

### Q16. Brainteaser: a portfolio has 99% 1-day VaR of 1m. On how many days per year do you expect a loss worse than 1m, and does that mean the worst loss is 1m?

**Expected breach count.** 99% VaR means a loss exceeds 1m with probability `1 - 0.99 = 1%` on any given day. With ~252 trading days a year:

```text
expected exceptions = 0.01 * 252 ~ 2.5 days per year
```

So you should see roughly 2 to 3 days a year worse than the VaR — and that is a feature, not a bug. If you saw zero, the model is too conservative; if you saw 10+, it is under-measuring risk (and would fail a Kupiec backtest).

**Is 1m the worst loss? No — emphatically.** VaR is a *threshold*, not a *maximum*. On the ~2.5 breach days the loss is worse than 1m, and VaR says **nothing** about *how much* worse. It could be 1.1m or 20m. That "how bad when you breach" question is answered by **Expected Shortfall**: `ES = E[loss | loss > 1m]`, the average of exactly those tail days. This is the single most important conceptual point about VaR — it tells you where the tail *begins*, never how far it *extends*.

## Time Series Analysis

### Summary

**What this topic covers**

The statistics of data indexed by time — prices, returns, rates — and the models quants use to describe, forecast, and trade them. The 16 questions here cover: **stationarity** (constant mean, variance, and autocovariance) and why nearly every model demands it; **autocorrelation** via the **ACF and PACF**; the linear model family **AR(p), MA(q), ARMA, ARIMA** and what each captures; **GARCH** for **conditional heteroskedasticity** and the empirical fact of **volatility clustering**; **cointegration** — two non-stationary I(1) series whose *linear combination* is stationary, the mathematical backbone of **pairs trading** — and how it differs fundamentally from correlation; **unit-root testing** via the **ADF test**; the **random walk** as the model of unpredictable prices (weak-form EMH); and **differencing** as the standard route from a non-stationary series to a stationary one. The thread throughout: prices are non-stationary and (nearly) unpredictable, but *returns*, *volatility*, and *spreads between related series* have exploitable structure.

**Mental model**

Start from a hard empirical fact: **price levels are non-stationary** — a stock price wanders, its mean and variance drift, and (weak EMH) its next move is essentially unforecastable, a random walk. So you almost never model prices directly. You **transform to stationarity** — usually by taking **returns** (a first difference of log prices) — and *then* look for structure. Three kinds of structure are worth hunting: (1) **linear autocorrelation** in the level of the (stationary) series — captured by ARMA; (2) **autocorrelation in the variance** — the calm-and-storm clustering of volatility, captured by GARCH; and (3) **shared trends across two series** — even when each price is a non-stationary random walk, a specific *combination* of them can be stationary and mean-reverting (cointegration), which you trade. The unifying tool is the **autocorrelation function**: it tells you whether "today" carries information about "tomorrow." Stationarity is the admission ticket; without it, sample means and t-stats are meaningless and regressions are spurious.

**Key terms**

- **Stationarity (weak)** — constant mean, constant variance, and autocovariance that depends only on the lag, not on time.
- **Autocovariance / autocorrelation** — covariance/correlation of the series with its own lagged values; ACF as a function of lag k.
- **ACF** — autocorrelation at each lag; **PACF** — partial autocorrelation, the correlation at lag k after removing the effect of intermediate lags.
- **AR(p)** — autoregressive: today is a linear function of the last p values plus noise.
- **MA(q)** — moving average: today is a linear function of the last q *shocks* (errors).
- **ARMA(p,q)** — combines AR and MA on a stationary series.
- **ARIMA(p,d,q)** — ARMA applied after differencing d times; the "I" handles non-stationary (integrated) series.
- **Integrated of order d, I(d)** — needs differencing d times to become stationary; a random walk is I(1).
- **Unit root** — an AR root on the unit circle; its presence means the series is non-stationary (a random walk has one).
- **GARCH** — models time-varying conditional variance; captures volatility clustering.
- **Cointegration** — two (or more) I(1) series with a stationary linear combination; implies a long-run equilibrium they revert to.
- **ADF (Augmented Dickey-Fuller) test** — a hypothesis test for a unit root (i.e. for non-stationarity).

**Why interviewers ask this**

Time series is where finance data actually lives, so it separates candidates who can *model* markets from those who only price instruments. The junior signal is definitional precision — can you state the three conditions for stationarity, and explain why regressing one random walk on another gives a spuriously significant result? The senior signal is the cointegration-versus-correlation distinction: understanding that two assets can be highly correlated in returns yet drift apart forever (no tradable relationship), while two *cointegrated* assets are tethered by a stationary, mean-reverting spread you can trade — this is the intellectual core of statistical arbitrage. Interviewers also probe GARCH (do you know *why* volatility clusters and why constant-variance models fail on returns?) and ADF/differencing (the practical mechanics of getting to stationarity). It rewards someone who connects the statistics to a trade.

**Common confusions**

- Confusing **correlation** with **cointegration** — correlation is about co-movement of *changes*; cointegration is about a stationary *long-run level relationship*. High correlation does NOT imply cointegration, and vice versa.
- Thinking returns are stationary but forgetting that *prices* are not — you must difference first.
- Believing a random walk is mean-reverting — it is not; shocks are permanent, the variance grows without bound.
- Reading ACF/PACF backwards — AR(p) cuts off in the **PACF** at lag p; MA(q) cuts off in the **ACF** at lag q.
- Assuming a significant regression between two price series is meaningful — it is often **spurious** if both are I(1) and not cointegrated.
- Treating GARCH volatility as constant — GARCH's whole point is *conditional* (time-varying) variance; the unconditional variance is constant but the one-step forecast is not.

**What follows from this topic**

Time series is the empirical scaffolding under much of the rest of the quant syllabus. **GARCH** is the discrete-time, data-driven face of the **volatility** topic — it estimates the very sigma that feeds Black-Scholes, VaR, and option pricing, and its volatility clustering is the reason parametric VaR (Normal, constant vol) under-measures tail risk. **Cointegration** and mean-reverting spreads are the statistical engine of **pairs trading / statistical arbitrage** in the stat-arb topic, and the AR(1) mean-reversion here is the discrete cousin of the **Vasicek / Ornstein-Uhlenbeck** process from the interest-rate topic. The random-walk result formalizes **weak-form market efficiency**, and unit-root/stationarity discipline is what keeps a backtest from being fooled by spurious regressions.

### Q1. Define (weak) stationarity and explain why it matters.

A series is **weakly (covariance) stationary** if its first two moments are stable over time:

```text
1. E[X_t]          = mu           (constant mean, no trend)
2. Var(X_t)        = sigma^2      (constant variance)
3. Cov(X_t, X_{t+k}) = gamma(k)   (autocovariance depends only on the lag k, not on t)
```

Intuitively: the statistical "rules" generating the data don't change over time — the process looks the same whether you observe it now or a year from now, up to shifting the window.

**Why it matters:** almost every estimation and inference tool silently assumes it.
- A **sample mean or variance** only estimates a fixed population quantity if that quantity exists and is constant — meaningless for a drifting series.
- **Standard errors, t-stats, and R-squared** rely on stationarity; applied to non-stationary series they are badly biased, producing **spurious regressions** (apparently significant relationships between unrelated random walks).
- Forecasting requires that the past resembles the future — i.e. stationarity.

Prices are typically **non-stationary** (they trend and their variance grows), so the standard move is to transform to a stationary series (usually returns / first differences) before modeling. Stationarity is the entry ticket to the whole toolkit.

### Q2. What are the ACF and PACF, and how do you read them?

The **autocorrelation function (ACF)** at lag k is the correlation between the series and itself k periods earlier:

```text
ACF(k) = Cov(X_t, X_{t-k}) / Var(X_t) = gamma(k)/gamma(0)
```

It measures total linear dependence at lag k, including dependence transmitted *through* the intermediate lags.

The **partial autocorrelation function (PACF)** at lag k is the correlation between X_t and X_{t-k} **after removing the linear effect of the intermediate lags** X_{t-1}, ..., X_{t-k+1} — the "direct" lag-k relationship, e.g. the coefficient on X_{t-k} in a regression on all lags up to k.

**How to read them (model identification):**

| Model | ACF | PACF |
|---|---|---|
| AR(p) | decays / tails off (geometric or damped sine) | **cuts off after lag p** |
| MA(q) | **cuts off after lag q** | decays / tails off |
| ARMA(p,q) | tails off | tails off |

Mnemonic: **AR shows its order in the PACF; MA shows its order in the ACF.** So a PACF with two significant spikes then nothing suggests AR(2); an ACF that cuts off at lag 1 suggests MA(1). For raw prices the ACF decays *extremely slowly* (near 1 at all lags) — a tell-tale sign of non-stationarity / a unit root.

### Q3. Explain AR(p), MA(q), ARMA, and ARIMA — what does each capture?

**AR(p) — autoregressive.** Today is a linear function of its own past p values plus a shock:

```text
X_t = c + phi_1*X_{t-1} + ... + phi_p*X_{t-p} + eps_t
```

Captures **momentum/persistence**: the level today depends on recent levels. Shocks have effects that decay geometrically.

**MA(q) — moving average.** Today is a linear function of the past q *shocks* (not levels):

```text
X_t = mu + eps_t + theta_1*eps_{t-1} + ... + theta_q*eps_{t-q}
```

Captures **short-lived shock effects**: a surprise affects the series for exactly q periods then vanishes completely.

**ARMA(p,q)** — combines both on a **stationary** series; parsimoniously models series with both persistence and short-run shock dynamics.

**ARIMA(p,d,q)** — ARMA applied *after differencing the series d times*. The **"I" (Integrated)** handles **non-stationarity**: if a price is I(1), difference once (d=1) to get stationary returns, then fit ARMA(p,q) to those. So ARIMA(1,1,1) means: difference once, then model with AR(1)+MA(1). This is the standard pipeline for a trending series: difference to stationarity, then model the autocorrelation that remains.

### Q4. What is a random walk, and why does it model unpredictable prices?

A **random walk** (with drift) is:

```text
X_t = mu + X_{t-1} + eps_t,     eps_t ~ white noise (mean 0, i.i.d.)
```

The best forecast of tomorrow is today (plus drift): `E[X_t | X_{t-1}] = mu + X_{t-1}`. The **change** `X_t - X_{t-1} = mu + eps_t` is pure unforecastable noise. That is exactly the statement of **weak-form market efficiency**: past prices contain no information that predicts future *returns* beyond the drift — you cannot beat the market with charts of past prices alone.

Key properties that make it non-stationary:
- **Shocks are permanent.** Iterating, `X_t = X_0 + mu*t + sum eps_i` — every past shock stays in the level forever (contrast AR(1) with |phi|<1, where shocks decay). It has a **unit root** (phi = 1).
- **Variance grows without bound.** `Var(X_t) = t*sigma^2` — it fans out over time, violating constant-variance stationarity.
- **No mean reversion.** It does not return to any fixed level; it wanders.

So prices ~ random walk (I(1), non-stationary, unpredictable levels), while **returns = the differences = white-noise-like and stationary**. This is why quants model returns, not prices.

### Q5. What is a unit root, and how does the ADF test detect it?

Consider the AR(1) process `X_t = phi*X_{t-1} + eps_t`. The behavior hinges on phi:

- `|phi| < 1` — **stationary**, mean-reverting; shocks decay.
- `phi = 1` — a **unit root**; this is a random walk — non-stationary, shocks permanent, variance growing.

A **unit root** thus means the series is non-stationary (integrated). Testing "is phi = 1?" is awkward directly, so rewrite by subtracting X_{t-1}:

```text
delta X_t = (phi - 1)*X_{t-1} + eps_t = gamma*X_{t-1} + eps_t,   gamma = phi - 1
```

Now the unit-root hypothesis is `gamma = 0` versus the stationary alternative `gamma < 0`. The **Dickey-Fuller test** is essentially a t-test on gamma from this regression. The **Augmented Dickey-Fuller (ADF)** test adds lagged difference terms to soak up any serial correlation in eps:

```text
delta X_t = alpha + beta*t + gamma*X_{t-1} + sum_{i=1..k} delta_i * delta X_{t-i} + eps_t
```

Crucially, under the null the statistic does **not** follow a standard t-distribution — you compare against special **Dickey-Fuller critical values** (more negative than the normal ones). Reading it:

```text
H0: gamma = 0  -> unit root -> NON-stationary
H1: gamma < 0  -> stationary (mean-reverting)
```

A sufficiently **negative** ADF statistic (below the critical value) **rejects** the unit root, concluding stationarity. This is the standard test used to (a) confirm a series needs differencing and (b) test whether a candidate cointegration spread is stationary.

### Q6. What is differencing and how does it produce stationarity?

**Differencing** replaces the series with its period-to-period changes:

```text
first difference:  delta X_t = X_t - X_{t-1}
```

A random walk `X_t = X_{t-1} + eps_t` is non-stationary, but its first difference is `delta X_t = eps_t`, pure white noise — **stationary**. That is the whole idea: an I(1) ("integrated of order 1") series becomes I(0) (stationary) after differencing once. Some series need it twice (I(2), difference the differences), but in finance one difference usually suffices.

In practice for prices you take the **log return**, which is a first difference of the log price:

```text
r_t = ln(P_t) - ln(P_{t-1}) = ln(P_t / P_{t-1})
```

Log prices are I(1); log returns are (approximately) stationary, which is exactly why all the ARMA/GARCH machinery is applied to returns. The "d" in **ARIMA(p,d,q)** is literally the number of times you difference before fitting ARMA. Caution: **over-differencing** a series that is already stationary introduces a spurious MA unit root and inflates variance — difference only enough to remove the unit root (use ADF to check), no more.

### Q7. What is conditional heteroskedasticity and volatility clustering?

**Heteroskedasticity** means non-constant variance. **Conditional** heteroskedasticity means the variance *at time t, given the past*, changes over time — even if the *unconditional* (long-run) variance is constant.

**Volatility clustering** is the empirical fact that drives it: in financial returns, **large moves tend to be followed by large moves (of either sign), and calm by calm.** Turbulent periods and quiet periods come in runs. Mandelbrot noted it in 1963. Formally, while returns themselves show almost no autocorrelation (consistent with weak EMH — you can't predict the *direction*), their **squared or absolute** returns show strong, slowly-decaying positive autocorrelation — you *can* predict the *magnitude* / risk.

This matters everywhere in quant finance:
- A constant-variance model (like plain Black-Scholes or Gaussian parametric VaR) is empirically wrong; it under-predicts risk during turbulent clusters and over-predicts during calm ones.
- It is a chief source of **fat tails** in the *unconditional* return distribution: mixing high-vol and low-vol regimes produces excess kurtosis even if each regime is Gaussian.

Modeling it — letting today's variance depend on recent shocks and recent variance — is exactly what **ARCH/GARCH** does.

### Q8. Write down GARCH(1,1) and interpret each term.

**ARCH(q)** (Engle) lets the conditional variance depend on recent squared shocks; **GARCH(p,q)** (Bollerslev) adds dependence on recent variances. The workhorse **GARCH(1,1)** for a return with shock eps_t = sigma_t * z_t (z_t ~ i.i.d. mean 0, var 1) is:

```text
sigma_t^2 = omega + alpha*eps_{t-1}^2 + beta*sigma_{t-1}^2
```

- **omega > 0** — a constant baseline variance.
- **alpha*eps_{t-1}^2** — the **ARCH** term: a big shock yesterday (large eps^2) raises today's variance. This is the *reaction* to news; large alpha means volatility responds sharply to shocks.
- **beta*sigma_{t-1}^2** — the **GARCH** term: yesterday's variance persists into today. Large beta means volatility is *sticky* / slowly mean-reverting.

Together `alpha + beta` controls **persistence** of volatility (how long a shock's effect on variance lasts); it must satisfy `alpha + beta < 1` for the process to be stationary with a finite long-run variance:

```text
unconditional variance = omega / (1 - alpha - beta)
```

In equity data `alpha + beta` is typically ~0.95-0.99 — volatility is highly persistent, which is precisely volatility clustering. GARCH(1,1) reproduces clustering *and* generates fat unconditional tails, making it the standard vol-forecasting model feeding VaR and option pricing. (Extensions like **EGARCH/GJR-GARCH** add the **leverage effect** — negative returns raise vol more than positive ones.)

### Q9. Explain cointegration and how it differs from correlation.

Two series X_t and Y_t are **cointegrated** if each is individually **I(1)** (non-stationary — a random walk) but some **linear combination is I(0)** (stationary):

```text
X_t ~ I(1),  Y_t ~ I(1),   but   Z_t = Y_t - beta*X_t ~ I(0)  (stationary)
```

Economically: the two prices each wander unpredictably, but they are **tethered** — they share a common stochastic trend, so the *spread* Z_t between them is mean-reverting around a long-run equilibrium. If they drift apart, forces pull them back.

**How it differs from correlation** — the single most tested distinction:

| | Correlation | Cointegration |
|---|---|---|
| Operates on | *changes/returns* (short-run co-movement) | *levels* (long-run relationship) |
| Question | do they move together day-to-day? | are they tethered over the long run? |
| Time scale | short-term | long-run equilibrium |
| Stability | can be high yet non-tradable | implies a mean-reverting, tradable spread |

Two random walks can be **highly correlated by chance yet never cointegrated** — they drift apart forever, and betting on their spread eventually blows up. Conversely, two series can be cointegrated with **low return correlation** on any given day. Correlation tells you they wiggle together; cointegration tells you their *gap* comes back. Only the latter supports a mean-reversion trade. You test it by regressing Y on X to get beta, then running an **ADF test on the residual** Z_t (Engle-Granger) — if the residual is stationary, they cointegrate.

### Q10. How does cointegration underpin a pairs trade?

**Pairs trading** exploits a stationary, mean-reverting spread between two **cointegrated** assets (e.g. two firms in the same sector, or a stock and its close substitute). The logic:

**Step 1 — find the relationship.** Establish that Stock A and Stock B are cointegrated: run the regression `A_t = alpha + beta*B_t + Z_t` and confirm via ADF that the residual spread `Z_t = A_t - alpha - beta*B_t` is stationary. beta is the **hedge ratio**.

**Step 2 — trade the spread's mean reversion.** Standardize the spread into a z-score `z = (Z_t - mean(Z))/std(Z)`. Because Z is stationary, it reverts to its mean, so:
- When `z` is high (spread wide, A rich vs B): **short A, long beta units of B**.
- When `z` is low (spread narrow/negative): **long A, short beta units of B**.
- Exit (unwind) as `z` reverts toward 0; stop out if it keeps widening.

```text
Spread Z_t (stationary, mean-reverting):
   +2 ----short the spread here----   (sell A, buy B)
    0 ----revert to mean, take profit----
   -2 ----long the spread here-----   (buy A, sell B)
```

**Why cointegration (not just correlation) is essential:** the trade bets the spread *comes back*. Only cointegration guarantees the spread is stationary and mean-reverting; a merely-correlated pair can wander apart permanently, turning a "temporary divergence" into an unbounded loss. The position is (approximately) **market-neutral** — long one, short the other — so it profits from *relative* mispricing regardless of market direction. This is the canonical statistical-arbitrage strategy. Beware: cointegration relationships can **break** (structural change, a merger, a regime shift), so real pairs trades use stops and re-test the relationship.

### Q11. Why is regressing one random walk on another dangerous (spurious regression)?

Take two **independent** random walks X_t and Y_t — by construction totally unrelated. Regress Y on X:

```text
Y_t = a + b*X_t + eps_t
```

You will frequently get a **large R-squared and a hugely significant t-statistic on b** — apparent strong evidence of a relationship that does not exist. This is **spurious regression** (Granger-Newbold, 1974).

**Why it happens:** OLS inference assumes stationary variables with well-behaved (stationary) errors. But if X and Y are both I(1) and unrelated, the regression residual eps_t is *also* I(1) (non-stationary) — it doesn't revert, it wanders. The classical standard-error formulas are invalid; the t-statistic does not follow a t-distribution and diverges as the sample grows, so "significance" is an artifact of the shared non-stationarity (both series trend, so they *look* related). The R-squared reflects two trends, not a genuine link.

**The fixes:**
- **Difference first**: regress returns on returns (stationary), not levels on levels.
- **Or test for cointegration**: a regression of two I(1) series is only meaningful if they are cointegrated — i.e. the residual eps_t is *stationary* (pass an ADF test). If the residual has a unit root, the relationship is spurious; if it is stationary, you have a genuine long-run equilibrium (and a tradable spread).

The practical lesson for backtesting: a beautiful in-sample regression between price levels is a classic trap.

### Q12. Fit and forecast an AR(1) / test for a unit root in code.

A compact pipeline: difference to returns, check stationarity, fit an AR model.

```python
import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller
from statsmodels.tsa.arima.model import ARIMA

# prices: a pandas Series of a price level
log_prices = np.log(prices)
returns = log_prices.diff().dropna()          # first difference -> (approx) stationary

# 1. Unit-root / stationarity check
adf_stat, pval, *_ = adfuller(log_prices)     # expect: FAIL to reject -> non-stationary
adf_r,   pval_r, *_ = adfuller(returns)        # expect: reject -> stationary

print("log-price ADF p =", pval)               # high p (> 0.05): unit root present
print("returns   ADF p =", pval_r)             # low  p (< 0.05): stationary

# 2. Fit ARIMA(1,1,0) on log prices == AR(1) on returns
model = ARIMA(log_prices, order=(1, 1, 0)).fit()
print(model.summary())

# 3. One-step-ahead forecast
fc = model.forecast(steps=1)
```

Interpretation notes to say out loud: ADF on the **level** should *fail* to reject the unit root (prices non-stationary); ADF on **returns** should reject it (returns stationary). The AR(1) coefficient on returns is typically tiny and often insignificant — consistent with weak EMH (returns are close to unforecastable). The value is usually less in point-forecasting returns and more in modeling their **variance** (GARCH) or **cross-asset** structure (cointegration).

### Q13. What is the Efficient Market Hypothesis in time-series terms?

The **weak-form EMH** says prices already reflect all information in *past prices*, so past prices cannot predict future returns. In time-series language this is precisely: **prices follow a (sub)martingale / random walk**, and **returns are unforecastable** (serially uncorrelated, mean equal to the required return / drift):

```text
E[r_t | past prices] = drift   (constant),   Cov(r_t, r_{t-k}) ~ 0
```

Empirical support: the return ACF is near zero at all lags, and AR models on returns have coefficients close to zero. That is why technical strategies based purely on past prices should not systematically work under weak-form efficiency.

But note the important nuance that keeps quants employed: EMH concerns the **conditional mean** of returns, not the **conditional variance**. Returns being unpredictable in *direction* is fully consistent with their *magnitude* being highly predictable — that is exactly volatility clustering / GARCH. So "prices are a random walk" (unforecastable levels) and "volatility is forecastable" (clustering) coexist. The semi-strong and strong forms extend efficiency to all public and all private information respectively, but the weak form is the one that maps directly onto the random-walk time-series model.

### Q14. Brainteaser: an AR(1) has coefficient phi. When is it stationary, and what is its long-run variance?

Take the zero-mean AR(1) `X_t = phi*X_{t-1} + eps_t`, with eps white noise of variance sigma^2.

**Stationarity condition:** `|phi| < 1`. Intuition: iterate backwards, `X_t = sum_{k>=0} phi^k * eps_{t-k}`. This infinite sum converges (finite variance) only if `phi^k -> 0`, i.e. `|phi| < 1`. At `phi = 1` you have a random walk (unit root, non-stationary, variance grows without bound); at `|phi| > 1` it explodes.

**Long-run (unconditional) variance:** using stationarity, `Var(X_t) = Var(X_{t-1}) = V`. Take variance of both sides (eps independent of X_{t-1}):

```text
V = phi^2 * V + sigma^2
V = sigma^2 / (1 - phi^2)
```

Sanity checks: as `phi -> 0` the variance is just sigma^2 (pure noise, no persistence); as `phi -> 1` the denominator `(1 - phi^2) -> 0` so the variance **blows up** — exactly the random-walk boundary where stationarity fails. The autocorrelation function is also clean: `ACF(k) = phi^k`, a geometric decay — which is why an AR(1) shows a slowly-tailing ACF and a single PACF spike at lag 1. Note this is the discrete-time analog of the **Vasicek/Ornstein-Uhlenbeck** stationary variance `sigma^2/(2*a)` from the rates topic — mean reversion at speed related to `(1 - phi)`.

### Q15. How is GARCH volatility used in practice, and how does it connect to VaR and options?

GARCH's output is a **one-step-ahead conditional volatility forecast** sigma_t, and that forecast plugs directly into the risk and pricing machinery:

**Volatility forecasting.** GARCH(1,1) gives `sigma_t^2 = omega + alpha*eps_{t-1}^2 + beta*sigma_{t-1}^2`, so after a turbulent day (large eps^2) it *raises* tomorrow's vol forecast, and it mean-reverts toward the long-run `omega/(1 - alpha - beta)` over quiet periods. This is a far better risk input than a naive rolling standard deviation because it reacts to clustering.

**VaR.** Parametric VaR is `z_alpha * sigma * V`. Feeding it a **GARCH conditional sigma** instead of a static one makes VaR **responsive**: it widens automatically in turbulent regimes and tightens in calm ones — addressing exactly the "VaR reads low right before a storm" critique from the risk topic. This is "conditional" or "filtered" VaR.

**Options.** Realized-vol clustering and GARCH's fat unconditional tails are part of *why the volatility smile exists* — constant-vol Black-Scholes is wrong. GARCH option-pricing models (Duan) and, more broadly, continuous-time stochastic-vol models (**Heston**) are the pricing-world response to the same empirical fact GARCH captures in discrete time. So GARCH is the statistical bridge from observed return data to the sigma that risk and pricing both consume — see the **volatility** topic for the pricing side.

### Q16. Walk through the full pipeline from a raw price series to a tradable time-series model.

A clean end-to-end recipe you can narrate in an interview:

**1. Plot and inspect.** Look for trends, level shifts, changing variance. Raw prices almost always look non-stationary (wandering level, growing spread).

**2. Transform to stationarity.** Take **log returns** `r_t = ln(P_t/P_{t-1})` (a first difference). Confirm with an **ADF test**: fail to reject on prices (unit root), reject on returns (stationary). Difference only as much as needed — avoid over-differencing.

**3. Identify the mean model.** Inspect the **ACF/PACF** of returns to pick ARMA orders (PACF cutoff -> AR order, ACF cutoff -> MA order); compare candidates by **AIC/BIC**. For single-asset returns this mean model is usually weak (weak EMH), so expect small coefficients.

**4. Model the variance.** Test the residuals' squared values for autocorrelation (ARCH effects). If present — it usually is — fit **GARCH(1,1)** (or GJR/EGARCH for leverage) to capture volatility clustering.

**5. Look for cross-asset structure.** For a stat-arb idea, test candidate pairs for **cointegration** (regress levels, ADF the residual). A stationary spread gives a mean-reverting, tradable signal.

**6. Validate honestly.** Check residuals are white noise (Ljung-Box), and **backtest out-of-sample** guarding against look-ahead bias, survivorship bias, and overfitting/data-snooping, netting transaction costs. Judge the strategy on **out-of-sample Sharpe**, and re-test that any cointegration relationship still holds — these relationships break.

The through-line: transform to stationarity, model the mean (ARMA), model the variance (GARCH), and hunt cross-series equilibria (cointegration) — then prove it survives out of sample before risking capital.
## Linear Algebra & Optimization for Quants

### Summary

**What this topic covers**

The linear algebra and optimization that quants actually reach for daily — not a full course, but the working subset. Four concern areas: (1) **vectors and matrices as portfolio objects** — a weight vector `w`, a return vector `mu`, and the **covariance matrix** `Sigma` that turns them into portfolio mean `w'*mu` and variance `w'*Sigma*w`; (2) **the covariance matrix's structure** — symmetric, positive-semidefinite, why estimates go bad, and how to fix them; (3) **decompositions** — **eigenvalues/eigenvectors and PCA** (applied to the yield curve to extract level/slope/curvature, and to reduce dimensionality), and the **Cholesky decomposition** `Sigma = L*L'` used to generate **correlated normal draws** `X = L*Z` for Monte Carlo; and (4) **optimization** — **OLS regression** `beta = (X'X)^-1 * X'y`, **Lagrange multipliers** for equality-constrained problems (Markowitz), and **convex optimization / KKT** for inequality constraints (no shorting, position limits). The 16 questions here connect straight to portfolio theory, risk, and Monte Carlo. This is the mathematical machinery under almost every other quant topic.

**Mental model**

Think of a portfolio as a point in a high-dimensional space, one axis per asset, and its risk as a *quadratic form* in that space: `variance = w'*Sigma*w`. The covariance matrix `Sigma` bends that space — it stretches some directions (high-variance combinations) and flattens others (diversified, low-variance combinations). Its **eigenvectors are those principal directions** and its **eigenvalues are the variances along them**. That single geometric picture unifies most of the topic: PCA is "look along the biggest-eigenvalue axes"; a valid covariance matrix is one where every direction has non-negative variance (positive-semidefinite, all eigenvalues >= 0); Cholesky `L` is the "square root" of `Sigma` that reshapes a spherical cloud of independent normals `Z` into the correct ellipsoid `X = L*Z`; and Markowitz optimization is "find the lowest point on the `w'*Sigma*w` bowl subject to constraints." Once you see risk as a quadratic bowl and `Sigma` as the thing that shapes it, the algebra stops being abstract.

**Key terms**

- **Covariance matrix (Sigma)** — Sigma_ij = Cov(r_i, r_j); symmetric, diagonal holds variances, always positive-semidefinite.
- **Positive-semidefinite (PSD)** — w'*Sigma*w >= 0 for all w; equivalently all eigenvalues >= 0. Positive-definite means > 0 (invertible, no zero-variance combo).
- **Eigenvalue / eigenvector** — Sigma*v = lambda*v; v is a direction unchanged in orientation, lambda its scaling (the variance along v).
- **PCA (principal component analysis)** — eigendecomposition of the covariance/correlation matrix; components ordered by variance explained.
- **Cholesky decomposition** — Sigma = L*L' with L lower-triangular; the numerically cheap "matrix square root" for PSD matrices.
- **OLS (ordinary least squares)** — beta = (X'X)^-1 * X'y; the linear fit minimizing sum of squared residuals.
- **Lagrange multiplier (lambda)** — the shadow price attached to an equality constraint; appears when you optimize subject to `g(w) = 0`.
- **KKT conditions** — Karush-Kuhn-Tucker; the first-order optimality conditions generalizing Lagrange to inequality constraints.
- **Convex problem** — convex objective over a convex feasible set; any local optimum is global, so it is reliably solvable.
- **Condition number** — ratio of largest to smallest eigenvalue; large means ill-conditioned, so the inverse amplifies estimation noise.

**Why interviewers ask this**

Linear algebra separates people who *use* quant formulas from people who *understand* them. A junior can quote "minimum-variance portfolio"; a senior can write the Lagrangian, take the gradient, and solve for `w`. Interviewers probe three signals. (1) **Do you know why `Sigma` must be PSD** — and what breaks (negative "variance", Cholesky fails, optimizer returns nonsense) when a noisy sample estimate isn't? (2) **Can you connect decompositions to real problems** — PCA to the yield curve's level/slope/curvature, Cholesky to correlated Monte Carlo draws? Naming the application proves you have done it, not just read it. (3) **Can you set up a constrained optimization from scratch** — Lagrangian, gradient, solve — rather than reciting the closed form. Getting the covariance-matrix and OLS mechanics right is table stakes at any quant desk; fumbling them ends the interview early.

**Common confusions**

- "Correlation and covariance are interchangeable" — correlation is covariance normalized by the two standard deviations, Corr = Cov(X,Y)/(sigma_X*sigma_Y), so it is unit-free and in [-1, 1]; covariance is scale-dependent.
- "Any symmetric matrix of numbers is a valid covariance matrix" — no; it must also be PSD. Sample estimates with more assets than observations are often not, so shrinkage is needed.
- "PCA components are the original assets" — they are *linear combinations* (eigenvectors), often with clear meaning (level, slope) but not individual securities.
- "Cholesky and eigendecomposition are the same" — both factor `Sigma`, but Cholesky (`L*L'`, triangular, O(n^3)/3) is cheaper and used for simulation; eigendecomposition exposes variance directions and is used for PCA.
- "OLS needs normal errors" — unbiasedness needs only zero-mean errors uncorrelated with regressors; normality is needed only for the exact t/F inference, not for the point estimate.
- "More factors always fit better" — in-sample yes, out-of-sample no; overfitting is the enemy, which is exactly why PCA/dimensionality reduction earns its keep.

**What follows from this topic**

This is the engine room. Portfolio theory (`w'*Sigma*w`, Markowitz, the efficient frontier) is Lagrange multipliers applied to this covariance matrix. Monte Carlo pricing of multi-asset payoffs *depends* on Cholesky to inject correlation into the driving normals. Risk models (VaR, factor models) lean on PCA and OLS. CAPM's beta is literally an OLS slope, `beta = Cov(r_i, r_m)/Var(r_m)`. Time-series and stat-arb work (cointegration, factor regressions) is regression on top of this. Master the covariance matrix and the three decompositions here and the rest of the quant toolkit becomes applied linear algebra.

### Q1. Why must a covariance matrix be symmetric and positive-semidefinite, and what does PSD mean geometrically?

**Symmetry** is immediate: `Cov(r_i, r_j) = Cov(r_j, r_i)`, so `Sigma_ij = Sigma_ji`.

**Positive-semidefinite** means `w'*Sigma*w >= 0` for every weight vector `w`. The reason is that `w'*Sigma*w` *is* the variance of the portfolio return `w'*r`, and a variance can never be negative:

```text
Var(w'*r) = w'*Cov(r)*w = w'*Sigma*w >= 0
```

**Geometrically**, `Sigma` maps the unit sphere of weight vectors into an ellipsoid whose axes point along the eigenvectors, with axis lengths set by the eigenvalues (the variances in those directions). PSD says none of those axes has negative length — no direction in weight space has negative variance. A zero eigenvalue means a direction with exactly zero variance: a portfolio combination that is risk-free / perfectly redundant (e.g. a duplicated asset), which also makes `Sigma` singular and non-invertible.

### Q2. How does OLS regression work, and derive the normal-equation estimate beta = (X'X)^-1 X'y.

OLS fits `y = X*beta + eps` by choosing `beta` to minimize the sum of squared residuals `S(beta) = (y - X*beta)'*(y - X*beta)`.

Expand and differentiate:

```text
S(beta) = y'y - 2*beta'*X'y + beta'*X'X*beta
dS/dbeta = -2*X'y + 2*X'X*beta = 0
=> X'X*beta = X'y            (the "normal equations")
=> beta = (X'X)^-1 * X'y      (if X'X is invertible)
```

**Intuition**: the residual vector `y - X*beta` must be orthogonal to every regressor (every column of `X`), i.e. `X'*(y - X*beta) = 0`. That is exactly the normal equations — OLS projects `y` onto the column space of `X`, and the fitted values `X*beta` are that projection.

**Assumptions** for the estimate to be unbiased and efficient (Gauss-Markov): linearity, `E[eps|X]=0` (errors uncorrelated with regressors), homoskedasticity (constant error variance), no perfect multicollinearity (`X'X` invertible), and independent errors. Normality of `eps` is needed only for exact finite-sample t and F tests.

```python
import numpy as np
# beta = (X'X)^-1 X'y, but never literally invert - use lstsq for stability
beta, *_ = np.linalg.lstsq(X, y, rcond=None)
```

### Q3. What is PCA, and how do you compute it from a covariance matrix?

PCA finds an orthogonal set of directions (principal components) that successively capture the most variance. It is the **eigendecomposition of the covariance (or correlation) matrix**:

```text
Sigma = V * Lambda * V'
```

where `V`'s columns are orthonormal eigenvectors and `Lambda` is diagonal with eigenvalues `lambda_1 >= lambda_2 >= ...` (the variance explained by each component). The first PC is the eigenvector with the largest eigenvalue — the direction of maximum variance. The fraction of total variance explained by component k is `lambda_k / sum(lambda_i)`.

**Intuition**: rotate the coordinate axes to align with the natural spread of the data; the new axes are uncorrelated, and you keep only the few that matter. Use the **correlation** matrix (standardize first) when variables are on different scales, otherwise the largest-variance variable dominates.

```python
import numpy as np
Sigma = np.cov(returns, rowvar=False)          # assets in columns
vals, vecs = np.linalg.eigh(Sigma)             # eigh: symmetric, ascending
order = np.argsort(vals)[::-1]                  # descending
vals, vecs = vals[order], vecs[:, order]
explained = vals / vals.sum()
```

### Q4. Apply PCA to the yield curve — what are the level, slope, and curvature factors?

Take daily changes in yields across maturities (2y, 5y, 10y, 30y, ...), form their covariance matrix, and eigendecompose it. Empirically, three components explain ~95-99% of the variance, with a strikingly consistent shape:

- **PC1 = Level (~85-90%)** — eigenvector loadings all the same sign and roughly equal, so all yields move up/down together. A parallel shift of the curve.
- **PC2 = Slope (~5-10%)** — loadings monotonic from negative to positive, so short and long ends move in opposite directions. A steepening/flattening.
- **PC3 = Curvature (~1-3%)** — loadings positive at the ends, negative in the middle (or vice versa), a "butterfly" — the belly moves relative to the wings.

**Why it matters**: instead of hedging dozens of correlated tenors, a desk hedges three factors (level, slope, curvature). It is dimensionality reduction that maps onto tradeable, intuitive risks — and it is the same math as the covariance eigendecomposition in Q3, applied to rates. PCA-based hedging and butterfly/steepener trades come directly from this decomposition.

### Q5. What is the Cholesky decomposition and why do quants use it?

For a symmetric positive-definite matrix `Sigma`, the Cholesky decomposition is the unique factorization

```text
Sigma = L * L'
```

with `L` lower-triangular and positive diagonal. It is the "matrix square root" and is the cheapest stable factorization of a PD matrix (about n^3/3 operations, half of LU).

**Primary quant use: generating correlated normal random variables for Monte Carlo.** If `Z` is a vector of independent standard normals (`Cov(Z) = I`), then `X = L*Z` has the desired covariance:

```text
Cov(X) = Cov(L*Z) = L*Cov(Z)*L' = L*I*L' = L*L' = Sigma
```

So Cholesky lets you turn a spherical cloud of independent draws into a correctly-correlated one — essential for pricing multi-asset options, basket options, and portfolio risk simulation. It also solves linear systems and tests positive-definiteness (the factorization fails cleanly if `Sigma` is not PD).

### Q6. Show how to generate two correlated normals with correlation rho by hand.

For the 2x2 case you do not even need a solver. Take `Z1, Z2` independent standard normals and set:

```text
X1 = Z1
X2 = rho*Z1 + sqrt(1 - rho^2)*Z2
```

Check: `Var(X1)=1`, `Var(X2)=rho^2 + (1-rho^2) = 1`, and `Cov(X1,X2) = rho*Var(Z1) = rho`. So `Corr(X1,X2)=rho`. This is exactly the Cholesky factor of the correlation matrix

```text
Sigma = [[1, rho],[rho, 1]]  =>  L = [[1, 0],[rho, sqrt(1-rho^2)]]
```

and `X = L*Z` reproduces the formula above. It only works with `|rho| <= 1`; at `rho = 1` the second variance term vanishes and the two variables become identical (the matrix is only PSD, not PD).

```python
import numpy as np
L = np.linalg.cholesky([[1, rho], [rho, 1]])
Z = np.random.standard_normal((2, n))
X = L @ Z                    # rows now correlated with corr rho
```

### Q7. Why do sample covariance matrices often fail to be positive-definite, and how do you fix it?

**Cause**: with `n` assets but only `T` observations, the sample covariance matrix has rank at most `T`. If `T < n` (or even `T` close to `n`), it is singular or near-singular — some eigenvalues are zero or tiny, so it is only PSD, not PD. Estimation noise also drags small eigenvalues negative in derived/cleaned matrices. Consequences: Cholesky fails, the inverse `(Sigma)^-1` blows up (huge condition number), and mean-variance optimizers produce wild, unstable weights.

**Fixes**:
- **Shrinkage (Ledoit-Wolf)**: `Sigma_hat = (1-a)*S + a*F`, blending the noisy sample `S` toward a structured target `F` (e.g. constant-correlation or diagonal). Pulls eigenvalues toward the mean, restoring PD-ness and stability.
- **Eigenvalue clipping / RMT**: floor tiny or negative eigenvalues at a small positive value and rebuild `Sigma = V*Lambda_clipped*V'`.
- **Factor models**: model `Sigma = B*F*B' + D` (a few factors plus diagonal idiosyncratic variance), which is PD by construction and low-noise.
- **Add ridge**: `Sigma + eps*I` nudges all eigenvalues up by `eps`.

The unifying idea: the problem is the *smallest* eigenvalues (pure noise), so every fix lifts or stabilizes them.

### Q8. Derive the minimum-variance portfolio using Lagrange multipliers.

Minimize variance `w'*Sigma*w` subject to fully invested `w'*1 = 1` (1 is a vector of ones). Form the Lagrangian:

```text
L(w, lambda) = w'*Sigma*w - lambda*(w'*1 - 1)
```

Set gradients to zero:

```text
dL/dw = 2*Sigma*w - lambda*1 = 0   =>  w = (lambda/2)*Sigma^-1 * 1
dL/dlambda = w'*1 - 1 = 0
```

Impose the budget constraint to solve for the multiplier, giving the closed form:

```text
w_mvp = (Sigma^-1 * 1) / (1' * Sigma^-1 * 1)
```

**Intuition**: `Sigma^-1 * 1` tilts weight toward assets that are low-variance and low-correlation with the rest (they carry the least marginal risk); the denominator just normalizes so the weights sum to 1. Notice the minimum-variance portfolio does **not** depend on expected returns `mu` at all — only on the covariance structure. That is why it is popular in practice: `mu` is notoriously hard to estimate, `Sigma` less so.

### Q9. What are the KKT conditions and when do you need them instead of plain Lagrange multipliers?

Plain Lagrange multipliers handle **equality** constraints (`g(w)=0`). Real portfolios add **inequality** constraints — no short selling (`w_i >= 0`), position limits (`w_i <= cap`), a leverage cap. The **KKT (Karush-Kuhn-Tucker) conditions** are the first-order optimality conditions for that general case. For minimize `f(w)` s.t. `h(w)=0` and `g(w) <= 0`:

```text
Stationarity:            grad f + sum(lambda_j*grad h_j) + sum(mu_k*grad g_k) = 0
Primal feasibility:      h(w)=0,  g(w) <= 0
Dual feasibility:        mu_k >= 0
Complementary slackness: mu_k * g_k(w) = 0
```

**Complementary slackness is the key idea**: for each inequality either the constraint is slack (`g_k < 0`) and its multiplier `mu_k = 0` (it is not binding), or it binds (`g_k = 0`) with `mu_k > 0`. So the optimizer figures out *which* constraints are active. For a **convex** problem (convex objective, convex feasible set — which mean-variance is, since `w'*Sigma*w` is convex when `Sigma` is PSD), KKT conditions are both necessary and sufficient, and any local optimum is the global optimum. That is why constrained Markowitz problems are solved reliably by quadratic-programming solvers.

### Q10. Why is convexity so important in portfolio optimization?

A problem is **convex** if the objective is a convex function and the feasible set is a convex set. Mean-variance optimization qualifies: `w'*Sigma*w` is convex because `Sigma` is PSD (its Hessian `2*Sigma` is PSD), and linear equality/inequality constraints define a convex polytope.

**Why it matters**:
- **Any local minimum is the global minimum.** No risk of the optimizer getting stuck in a bad local solution — the answer you get is *the* answer.
- **KKT conditions are sufficient, not just necessary**, so you can certify optimality.
- **Reliable, fast solvers exist** (quadratic programming, interior-point, second-order cone programming) with guaranteed convergence.

Contrast with non-convex objectives (e.g. cardinality constraints "hold at most 20 names", or maximizing a raw Sharpe with integer lots) which become combinatorially hard and need heuristics. The practical lesson: formulate portfolio problems as convex whenever possible — minimize variance, or minimize variance minus a risk-aversion-weighted return `w'*Sigma*w - gamma*w'*mu` — so you inherit global optimality and industrial-strength solvers.

### Q11. What is the condition number of a matrix and why do quants care?

The condition number (for a symmetric PD matrix) is the ratio of the largest to smallest eigenvalue:

```text
kappa(Sigma) = lambda_max / lambda_min
```

It measures how much the solution of `Sigma*x = b` (or `Sigma^-1`) amplifies input error. A large `kappa` means **ill-conditioned**: tiny changes in the data cause huge changes in the inverse, so `Sigma^-1` and any optimizer using it are numerically unstable.

**Why quants care**: covariance matrices of many correlated assets have tiny smallest eigenvalues (near-redundant combinations), so `kappa` is huge. Mean-variance weights `w ~ Sigma^-1 * mu` then swing wildly — the optimizer takes enormous offsetting long/short positions in near-collinear assets ("error maximization"). This is *why* shrinkage/regularization (Q7) matters: it lifts `lambda_min`, cutting the condition number and taming the weights. Rule of thumb: if `kappa ~ 10^k`, expect to lose about k digits of accuracy in the solve.

### Q12. Given expected returns and a covariance matrix, how do you find the maximum-Sharpe (tangency) portfolio?

The tangency portfolio maximizes the Sharpe ratio `(w'*mu - r_f) / sqrt(w'*Sigma*w)`. With excess returns `mu_e = mu - r_f*1`, the unconstrained maximizer has a clean closed form:

```text
w_tangency = (Sigma^-1 * mu_e) / (1' * Sigma^-1 * mu_e)
```

**Derivation sketch**: maximizing a Sharpe ratio is scale-invariant in `w`, so it reduces to a Lagrangian very similar to Q8 but with `mu_e` in place of the ones vector; solving gives `w proportional to Sigma^-1 * mu_e`, then normalize to sum to 1.

**Intuition**: `Sigma^-1 * mu_e` rewards assets with high excess return *per unit of marginal risk* and penalizes those correlated with the rest. It is the same "invert the covariance, tilt by the signal" structure as the minimum-variance portfolio (Q8), except the signal is expected excess return rather than the ones vector. Two-fund separation says every investor's optimal risky holding is this one portfolio scaled by risk appetite.

```python
import numpy as np
mu_e = mu - r_f
w = np.linalg.solve(Sigma, mu_e)   # solve, don't invert
w = w / w.sum()
```

### Q13. Explain the difference between the eigendecomposition and the SVD, and where each shows up in quant work.

**Eigendecomposition** `A = V*Lambda*V^-1` applies to square matrices; for a symmetric PSD covariance matrix it specializes to `Sigma = V*Lambda*V'` with orthonormal `V` and real non-negative eigenvalues. This is PCA (Q3, Q4) — variance directions of a covariance matrix.

**SVD (singular value decomposition)** `X = U*S*V'` applies to *any* rectangular matrix (e.g. the raw `T x n` data matrix of returns). `U` and `V` are orthonormal, `S` diagonal with non-negative singular values.

**The link**: the eigenvectors of `X'X` are the right singular vectors `V`, and the eigenvalues are the squared singular values. So you can do PCA either by eigendecomposing the covariance matrix `Sigma = X'X/(T-1)` *or* by taking the SVD of the (centered) data matrix directly — and the SVD route is numerically more stable because it never forms `X'X` (which squares the condition number). Where each shows up: SVD for stable PCA, least-squares (`lstsq` uses it), low-rank approximation, and de-noising; eigendecomposition for the covariance structure, risk factors, and matrix functions.

### Q14. In the linear factor model r = B*f + eps, how do you estimate the factor loadings and reconstruct the covariance matrix?

A linear factor model writes each asset's return as exposure to a few common factors plus idiosyncratic noise:

```text
r = alpha + B*f + eps
```

where `B` is the `n x k` matrix of factor loadings (betas), `f` the `k` factor returns, and `eps` the asset-specific residuals (assumed uncorrelated with `f` and across assets).

**Estimating B**: if the factors `f` are observable (e.g. Fama-French market/SMB/HML), regress each asset's returns on the factors by OLS (Q2) — each row of `B` is one asset's regression slopes. If factors are *not* observable, extract them by PCA (statistical factor model).

**Reconstructing covariance**:

```text
Sigma = B * Cov(f) * B' + D
```

where `Cov(f)` is the `k x k` factor covariance and `D` is diagonal with the idiosyncratic variances. This is PD by construction and, crucially, replaces `~n^2/2` noisy pairwise covariances with `~n*k` loadings plus `k^2` factor covariances — far fewer parameters, so the estimate is stable and invertible. This factor structure is the standard fix for the ill-conditioning of Q7 and Q11.

### Q15. Write numpy pseudocode to price a two-asset basket option by Monte Carlo with correlation.

The whole point of Cholesky (Q5-Q6) is injecting correlation into the driving normals. Price a European basket call on `0.5*S1 + 0.5*S2` under risk-neutral GBM:

```python
import numpy as np

def basket_call_mc(S0, r, sigma, rho, K, T, n=1_000_000, seed=0):
    rng = np.random.default_rng(seed)
    # correlation matrix -> Cholesky factor
    C = np.array([[1.0, rho], [rho, 1.0]])
    L = np.linalg.cholesky(C)
    Z = rng.standard_normal((2, n))
    W = L @ Z                              # correlated normals, shape (2, n)
    # risk-neutral GBM terminal prices: drift r - sigma^2/2
    drift = (r - 0.5 * sigma**2) * T
    ST = S0[:, None] * np.exp(drift[:, None] + sigma[:, None] * np.sqrt(T) * W)
    basket = 0.5 * ST[0] + 0.5 * ST[1]
    payoff = np.maximum(basket - K, 0.0)
    price = np.exp(-r * T) * payoff.mean()
    stderr = np.exp(-r * T) * payoff.std(ddof=1) / np.sqrt(n)
    return price, stderr
```

Key points: risk-neutral drift is `r - sigma^2/2` (not the real-world mu), correlation enters only through `L @ Z`, the price is the discounted mean payoff, and the standard error scales as `O(1/sqrt(n))`. Change `rho` and the basket's variance changes, which changes the option value — that is the correlation risk the Cholesky step captures.

### Q16. What is regularization (ridge / lasso) in regression, and why is it used in quant models?

Plain OLS (Q2) minimizes squared error and, with many correlated predictors, overfits — huge, unstable coefficients that fit in-sample noise and fail out-of-sample. Regularization adds a penalty on coefficient size:

```text
Ridge (L2):   minimize ||y - X*beta||^2 + alpha*||beta||^2
              => beta = (X'X + alpha*I)^-1 * X'y
Lasso (L1):   minimize ||y - X*beta||^2 + alpha*sum|beta_i|
```

**Ridge** shrinks all coefficients toward zero and, notice, adds `alpha*I` to `X'X` — literally the ridge fix from Q11 that improves conditioning and guarantees invertibility even with collinear regressors. It keeps every predictor but tames them. **Lasso** shrinks *and* zeroes out weak predictors (the L1 corner encourages exact zeros), so it does automatic feature selection — useful when you have hundreds of candidate signals and want a sparse, interpretable model.

**Why quants use it**: financial data is noisy with a low signal-to-noise ratio and many correlated features, so unpenalized fits overfit badly. `alpha` is chosen by cross-validation (ideally respecting time order, no look-ahead). The theme echoes the whole topic: the danger is the small-eigenvalue / noise directions, and regularization is the disciplined way to suppress them.

## Statistical Arbitrage & Quant Strategies

### Summary

**What this topic covers**

How quants build, test, and honestly evaluate systematic trading strategies — and why so many that look brilliant on paper lose money live. Four concern areas: (1) **the flagship stat-arb strategy** — **pairs trading**: find a **cointegrated** pair, trade the mean-reverting spread with entry/exit at z-score bands, and understand why cointegration (not mere correlation) is what makes it work; (2) **the two great strategy families** — **mean reversion vs momentum**, and how a raw signal becomes a sized position; (3) **backtesting and its many ways to lie** — **look-ahead bias**, **survivorship bias**, **overfitting / data-snooping**, in-sample vs out-of-sample, and the multiple-testing problem; and (4) **the reality checks** — **transaction costs and slippage**, performance metrics (**Sharpe ratio**, information ratio, max drawdown), and capacity / alpha decay. The 16 questions here are deliberately practical and skeptical. The through-line: a backtest is a hypothesis, not a track record, and most edge is eaten by costs, bias, and crowding. This is the sister topic to the mathematical machinery in Linear Algebra & Optimization.

**Mental model**

Treat every strategy as a claim about a repeatable statistical inefficiency, and treat yourself as its harshest referee. A signal is a forecast; a strategy is a signal plus sizing plus costs; a backtest is a *simulation* of that strategy on history — and history is a single, non-repeatable sample that you can accidentally memorize. The core tension is signal versus noise: markets are near-efficient, so real edges are small and fragile, while the number of patterns you can dredge from data is effectively infinite. That asymmetry is why the default outcome of an unconstrained search is a beautiful equity curve that is pure overfit. Good quant practice is therefore mostly *defensive*: separate in-sample from out-of-sample, budget your degrees of freedom, subtract realistic costs, and assume any edge decays as others find it. Pairs trading crystallizes the positive case — cointegration gives a statistical *reason* to expect mean reversion, so the trade rests on structure, not on a curve fit.

**Key terms**

- **Cointegration** — two non-stationary (I(1)) price series whose linear combination (the spread) is stationary; the basis for a mean-reverting pair.
- **Spread / z-score** — spread = P_A - beta*P_B; z = (spread - mean)/std; trade when z hits a band.
- **Mean reversion** — the bet that a series returns to its average (fade extremes).
- **Momentum** — the bet that recent trends persist (ride winners).
- **Look-ahead bias** — using information in the backtest that was not available at decision time.
- **Survivorship bias** — testing only on assets that still exist, ignoring the ones that died.
- **Overfitting / data-snooping** — tuning a strategy to historical noise; inflated by testing many variants.
- **In-sample vs out-of-sample** — data used to build vs data reserved to validate; only the latter is honest evidence.
- **Slippage** — the gap between the price you assumed and the price you actually get; part of transaction cost.
- **Sharpe ratio** — (return - risk-free) / volatility; risk-adjusted return, usually annualized.
- **Information ratio** — active return over a benchmark divided by tracking error.
- **Max drawdown** — largest peak-to-trough equity decline; the pain metric.
- **Capacity / alpha decay** — how much money a strategy can absorb before its edge erodes; edges fade as they get crowded.

**Why interviewers ask this**

This topic tests judgment, not just math. Anyone can code a moving-average crossover; the signal an interviewer wants is *skepticism* — do you instinctively ask "what would make this backtest lie?" (1) **Do you know cointegration is different from correlation**, and can you explain why the distinction is the whole game for pairs trading? (2) **Can you enumerate the biases** — look-ahead, survivorship, overfitting, multiple testing — and, more importantly, describe concrete guards against each (point-in-time data, purged cross-validation, out-of-sample holdout, cost modeling)? (3) **Do you respect costs and capacity** — can you explain why a high-Sharpe high-turnover backtest can be worthless after slippage, and why edges decay as they get crowded? Juniors present the equity curve; seniors present the equity curve *and* the three reasons it might be fake. The desk is trusting you not to light money on fire, so demonstrated paranoia is the hire signal.

**Common confusions**

- "Correlated pairs are tradeable pairs" — correlation is about co-movement of returns and can be spurious; you need *cointegration* (a stationary spread) for a mean-reversion trade with a statistical anchor.
- "A great backtest means a great strategy" — it usually means you overfit; the more variants you tried, the more likely the winner is luck.
- "Higher Sharpe is always better" — not if it comes from high turnover that costs eat, from a short unrepresentative sample, or from ignoring tail/drawdown risk.
- "Out-of-sample proves it works" — only if you never peeked; reusing the holdout to iterate quietly turns it into in-sample.
- "Transaction costs are a rounding error" — for high-frequency/high-turnover strategies they are the dominant term and routinely flip a paper edge negative.
- "My edge will last" — alpha decays; publication, crowding, and your own market impact erode it. Capacity is finite.

**What follows from this topic**

Stat arb is where the rest of the quant toolkit gets deployed and stress-tested. Cointegration and stationarity come straight from the time-series topic (ADF tests, I(1) series). Position sizing and risk budgeting lean on portfolio theory and the covariance machinery (`w'*Sigma*w`) from Linear Algebra & Optimization. Performance metrics (Sharpe, drawdown) connect to risk management and VaR. And the skeptical, out-of-sample mindset here is exactly the discipline you carry into every model you build — including the brainteasers and reasoning of the interview itself. Learn to distrust your own backtest and you have learned the most valuable thing on the buy side.

### Q1. What is cointegration, and why is it the right concept for pairs trading rather than correlation?

**Cointegration** applies to two (or more) individually non-stationary series — prices that wander like random walks, I(1) — whose *linear combination* is stationary. If `P_A` and `P_B` are both I(1) but `P_A - beta*P_B` is I(0) (mean-reverting, stable mean and variance), the pair is cointegrated and that combination is the tradeable **spread**.

**Why not correlation?** Correlation measures whether *returns* move together on short horizons; it says nothing about the *levels* drifting apart forever. Two series can be highly correlated in returns yet steadily diverge in price (no stable relationship to revert to) — trading that as a pair is a slow disaster. Conversely, two series can be cointegrated (tethered in the long run) even with modest short-term correlation. Pairs trading is a bet that the spread reverts to its mean; that bet only has a statistical anchor if the spread is *stationary*, which is exactly what cointegration guarantees and correlation does not.

Test it in two classic ways: **Engle-Granger** (regress `P_A` on `P_B`, then run an ADF unit-root test on the residual spread — reject the unit root => stationary => cointegrated) or the **Johansen** test for multiple series.

### Q2. Walk through a complete pairs-trading strategy with entry and exit rules.

```text
1. Universe & pairing: pick economically related candidates (same sector, e.g.
   Stock A and Stock B), so any relationship has a reason to persist.
2. Test cointegration: regress P_A on P_B -> hedge ratio beta; ADF-test the
   residual spread = P_A - beta*P_B. Keep only pairs with a stationary spread.
3. Build the signal: z = (spread - rolling_mean) / rolling_std.
4. Entry:  z > +2  -> spread rich  -> SHORT spread (short A, long beta*B)
           z < -2  -> spread cheap -> LONG  spread (long A,  short beta*B)
5. Exit:   |z| < 0.5 (revert to mean) -> close.
6. Stop:   |z| > 4 or cointegration breaks (rolling ADF fails) -> bail;
           the relationship may have structurally changed.
```

**Intuition**: the position is dollar-neutral (roughly market-hedged), so you are betting on the *relative* value converging, not on market direction. Profit comes from the spread oscillating around its mean. **Risk**: the anchor is a statistical estimate that can break — a merger, a shock, a regime change — so a spread that "should" revert instead trends away. That is why a stop and a rolling re-test of cointegration matter: the deadliest pairs trade is doubling down on a spread that has permanently de-cointegrated.

### Q3. What is the difference between mean-reversion and momentum strategies, and can both be true?

**Mean reversion** bets that extremes reverse: buy what has fallen, sell what has risen, expecting a pull back to the mean (pairs trading, short-term reversal, over-reaction fades). It profits in **range-bound, noisy** conditions and loses in strong trends.

**Momentum** bets that trends persist: buy recent winners, sell recent losers (time-series momentum, cross-sectional momentum, trend following). It profits in **trending** conditions and loses at sharp reversals (momentum "crashes").

**Can both be true? Yes — on different horizons.** Empirically, very short horizons (days) show reversal (microstructure, over-reaction), intermediate horizons (3-12 months) show momentum (under-reaction, herding), and long horizons (3-5 years) show reversal again (valuation). They are not contradictory because they describe different frequencies. This is why many quant books run *both*: a short-horizon mean-reversion sleeve and an intermediate-horizon momentum sleeve, whose returns are often lowly correlated, improving the combined Sharpe. The skill is matching the strategy to the horizon and regime, not declaring one universally right.

### Q4. How do you turn a raw signal into a position size?

A signal (say a z-score, or a forecast of expected return) is a *view*; sizing translates it into risk-controlled exposure. Common approaches, from simple to principled:

- **Threshold / binary**: full position when the signal crosses a band, flat otherwise (the pairs-trading rule in Q2). Simple, but chunky and turnover-heavy.
- **Linear / proportional**: position proportional to signal strength, `size = clip(k*signal, -cap, +cap)`. Scales conviction smoothly.
- **Volatility targeting**: scale so the position contributes a fixed risk, `size proportional to signal / sigma`. Keeps risk stable across assets and time — a low-vol asset gets a bigger notional than a high-vol one for the same signal.
- **Risk-budgeted / mean-variance**: at the portfolio level, `w proportional to Sigma^-1 * expected_returns` (the tangency-portfolio logic from the linear algebra topic), sizing many signals jointly given their covariance.
- **Kelly / fractional Kelly**: size to maximize long-run log-growth, `f* = edge/odds`; in practice use a fraction (half-Kelly) because full Kelly is brutally volatile and sensitive to estimation error.

**Key discipline**: cap position size and portfolio risk, target volatility, and account for turnover — a signal that flips constantly generates costs that can erase its edge (Q9). Sizing is where a good forecast becomes a good *strategy*, or dies.

### Q5. What is look-ahead bias, and give three concrete ways it sneaks into a backtest.

**Look-ahead bias** is using information in a backtest that would not have been available at the moment of the simulated decision. It is the most insidious backtest error because it silently inflates results and is easy to introduce accidentally.

Three concrete examples:
- **Using a bar's close to trade at that same bar's open/close.** If your signal uses today's closing price, you cannot also execute at today's close — you would trade at the next bar. Off-by-one indexing here can manufacture huge fake profits.
- **Restated / point-in-time data.** Fundamental data (earnings, GDP) is revised after release. Backtesting on the *final revised* number uses knowledge you did not have on the original release date. You must use point-in-time data as it was known then.
- **Full-sample statistics.** Normalizing a signal with the mean/std of the *entire* series (including the future), or picking the cointegration hedge ratio from the whole sample, leaks future information into past decisions. Use only trailing/rolling windows.

**Guard**: enforce a strict information timeline — at each simulated timestamp, the strategy may touch only data with a timestamp <= now (accounting for release/settlement lags). If a fix to remove look-ahead sharply degrades your backtest, the original edge was the leak.

### Q6. Explain survivorship bias and its effect on backtested returns.

**Survivorship bias** is testing a strategy only on assets that *survived* to the present, silently excluding those that were delisted, went bankrupt, or were acquired. Because failures are dropped, the sample is skewed toward winners, and backtested returns are biased *upward*.

Concrete effect: backtest a "buy cheap stocks" strategy on today's index constituents over 20 years, and you never buy the cheap stocks that then went to zero and left the index — so your value strategy looks far safer and more profitable than it was. The bias is largest for strategies tilted toward risky/distressed names (value, small-cap, high-yield) and for long lookbacks. It also hits fund databases: dead funds vanish, so the surviving average overstates the industry's real performance.

**Guard**: use a **point-in-time universe** that includes delisted securities with their delisting returns (proper databases like CRSP retain them). At each historical date, trade only the assets that were actually investable *then*, and carry positions in names that later died through to their delisting outcome. If your data vendor only gives current constituents, assume your backtest is optimistic.

### Q7. What is overfitting / data-snooping, and how does testing many strategies make it worse?

**Overfitting** is fitting a strategy to the historical *noise* rather than a real, repeatable signal, so it looks great in-sample and fails out-of-sample. It happens whenever you have many degrees of freedom (parameters, rules, features) relative to the information in the data.

**Multiple testing / data-snooping makes it dramatically worse.** If you try 1 random strategy, the chance it clears a "significant" bar by luck is small. If you try 1000, you *expect* about 50 to clear a 5%-luck bar by chance alone — and you will proudly report the best one. The more variants, parameter grids, and universes you search, the higher the best backtest's Sharpe climbs *purely from selection*, even with zero true edge. This is the "backtest overfitting" problem: the reported Sharpe is a maximum over many trials, so it is biased high.

**Guards**:
- **Hold out** a true out-of-sample period you touch exactly once.
- **Deflate** for the number of trials (deflated Sharpe ratio, or a higher significance bar; a rough rule multiplies the required t-stat as trials grow).
- **Limit degrees of freedom** — prefer few, economically motivated parameters over big grids.
- **Cross-validate with purging/embargo** to avoid leakage across folds.
- Demand an *economic reason* the edge should exist; a strategy with no story is probably a curve fit.

### Q8. Why is out-of-sample testing essential, and how can it still be corrupted?

**In-sample** data is what you use to build and tune the strategy; **out-of-sample (OOS)** is data reserved, untouched, to validate it. OOS is essential because in-sample performance is contaminated by fitting — the only honest evidence a strategy generalizes is that it works on data it never saw during construction.

**How OOS gets corrupted (turning it silently back into in-sample)**:
- **Peeking / iterating on the holdout.** Run on OOS, see it fail, tweak the strategy, re-run on the *same* OOS — after a few rounds you have fit the holdout. Each look spends its independence.
- **Look-ahead in preprocessing.** Standardizing/scaling using statistics computed over the whole dataset (including OOS) leaks the future into the past.
- **Leakage across folds.** In cross-validation, overlapping windows or features that span the fold boundary let training data bleed into validation. Fix with **purging** (drop samples near the boundary) and an **embargo** gap.
- **Reusing a public dataset the whole industry has mined.** The "out-of-sample" period is out-of-sample only for you, not for the collective search that shaped conventional wisdom.

The discipline: decide the strategy fully in-sample, then run OOS **once**. If it fails, you do not get to quietly re-roll — you go back to the drawing board with fresh data.

### Q9. How do transaction costs and slippage affect a strategy, and why do they kill high-frequency backtests?

A gross backtest assumes you trade at the mid price for free. Reality subtracts several costs per trade:
- **Commissions/fees** — explicit, per share/contract.
- **Bid-ask spread** — you buy at the ask, sell at the bid; you cross half the spread each side.
- **Slippage / market impact** — your own order moves the price against you, worse for large size and thin liquidity.
- **Financing/borrow** — cost of leverage and of shorting.

**Why high-turnover strategies die**: costs scale with *turnover*. Net return roughly equals gross return minus (turnover * cost-per-trade). A strategy trading 100x a year at 5 bps round-trip pays ~500 bps annually — often more than its entire gross edge.

```text
net_return ~= gross_return - turnover * cost_per_round_trip
```

A beautiful high-Sharpe, high-frequency backtest frequently has a tiny per-trade edge multiplied by enormous turnover; subtract realistic costs and it goes negative. This is why cost modeling is not optional: model spread, impact (often ~ sqrt(size/ADV)), and fees, and evaluate the strategy on *net* returns. The higher the frequency, the more the entire result hinges on getting costs right. Many "alphas" are simply unmodeled costs.

### Q10. Define the Sharpe ratio and explain how to annualize it and what a good value is.

The **Sharpe ratio** is risk-adjusted return: excess return per unit of volatility.

```text
Sharpe = (E[r_p] - r_f) / sigma_p
```

where `r_p` is the strategy return, `r_f` the risk-free rate, and `sigma_p` the volatility of the excess return.

**Annualizing**: if you compute Sharpe from returns at frequency with `k` periods per year (daily: k~252, monthly: k=12), and returns are roughly i.i.d.,

```text
Sharpe_annual = Sharpe_per_period * sqrt(k)
```

The `sqrt(k)` comes from return scaling linearly with time while volatility scales with sqrt(time).

**Interpretation** (annualized, net of costs): < 1 is unremarkable, ~1 is decent, ~2 is strong, > 3 is either an elite high-capacity strategy or (more often for a backtest) a sign of overfitting or unmodeled costs. **Caveats**: Sharpe assumes returns are roughly normal and i.i.d.; it understates the risk of strategies with fat tails or negative skew (selling options, carry) that show a smooth curve until they blow up, and it can be inflated by autocorrelated/illiquid marks. Always pair it with max drawdown and a look at the return distribution.

### Q11. What is the difference between the Sharpe ratio and the information ratio?

Both are return-per-unit-risk, but relative to different baselines.

**Sharpe ratio** measures excess return over the **risk-free rate**, per unit of **total volatility**: `(r_p - r_f)/sigma_p`. It answers "how good is this in absolute, standalone terms?"

**Information ratio (IR)** measures **active return over a benchmark**, per unit of **tracking error** (the volatility of the active return): `(r_p - r_b)/sigma(r_p - r_b)`. It answers "how good is this manager at beating their benchmark?"

**When each matters**: Sharpe suits absolute-return / hedge-fund strategies with no natural benchmark. IR suits benchmark-relative mandates (a long-only equity manager judged vs the S&P 500) — a fund can have a mediocre Sharpe but a great IR if it reliably adds a little alpha with low tracking error. The **fundamental law of active management** links IR to skill and breadth: `IR ~= IC * sqrt(breadth)`, where IC is the information coefficient (skill/correlation of forecasts with outcomes) and breadth is the number of independent bets. It says you get a high IR either by being very skilled or by making many independent bets — the quantitative case for diversified systematic strategies.

### Q12. What is maximum drawdown and why do quants care about it beyond volatility?

**Maximum drawdown (MDD)** is the largest peak-to-trough decline in cumulative equity over the sample, as a percentage of the peak:

```text
MDD = max over t of [ (peak-so-far - equity_t) / peak-so-far ]
```

**Why it matters beyond volatility/Sharpe**:
- **It is the pain metric.** Investors and risk managers experience the path, not the summary statistic. A 50% drawdown means you need a 100% gain just to recover — and most investors (or their capital) do not survive to see the recovery; they redeem or get stopped out at the bottom.
- **It captures tail and path risk that Sharpe hides.** Two strategies with identical Sharpe can have wildly different drawdowns if one has fat tails or serial correlation. Negative-skew strategies (selling options) look smooth then suffer a catastrophic drawdown that volatility understated.
- **It governs survivability and leverage.** Drawdown limits determine how much leverage you can run and whether you get to keep trading. The related **Calmar ratio** (annual return / MDD) explicitly trades off return against worst-case pain.

Quants therefore report MDD, drawdown duration (time under water), and the return distribution alongside Sharpe — because a strategy that cannot be *held* through its drawdowns is not a real strategy.

### Q13. What is capacity and alpha decay, and why does a profitable strategy stop working?

**Capacity** is how much capital a strategy can deploy before its own trading erodes its edge. As you scale up, your orders move prices against you (market impact grows with size relative to liquidity, roughly ~ sqrt(size/ADV)), so realized returns fall. Every strategy has a capacity ceiling; high-frequency and small-cap strategies especially so.

**Alpha decay** is the tendency of an edge to weaken over time. Causes:
- **Crowding**: once others discover the same signal, competition arbitrages it away — more capital chasing the same inefficiency shrinks it.
- **Publication effect**: documented anomalies (value, momentum, various factor premia) tend to shrink markedly after publication.
- **Regime change**: the structural cause of the edge disappears (a rule change, a new market participant, a technology shift).
- **Your own impact**: at scale, you *are* the crowd; you trade away your own alpha.

**Why a good backtest strategy stops working live**: some of it was overfit and never real; some was real but is now crowded or capacity-constrained; and market impact/costs at live size were larger than the backtest assumed. The practical implications: prize *uncorrelated, capacity-aware, economically-grounded* edges, keep researching to replace decaying signals, and never assume a historical edge is permanent. Alpha is a depreciating asset.

### Q14. Why do "most backtests lie" — summarize the main reasons.

A backtest is a simulation, and every simplifying assumption is a place for optimism to leak in. The recurring culprits:

- **Overfitting / multiple testing** (Q7) — the reported result is the best of many trials, biased high by selection.
- **Look-ahead bias** (Q5) — using information not available at decision time inflates returns.
- **Survivorship bias** (Q6) — testing only on survivors skews the universe toward winners.
- **Unmodeled or underestimated costs** (Q9) — spread, slippage, impact, borrow; the higher the turnover, the more the whole result depends on these.
- **Ignoring capacity / market impact** (Q13) — the backtest assumes you can trade any size at the shown price.
- **Regime dependence** — the sample was a benign period; the strategy is fragile to conditions not in the data.
- **Data errors** — bad ticks, splits/dividends handled wrong, timestamp misalignment.
- **Non-stationarity of the anchor** — relationships (like a cointegration) break; the past is not a stationary draw of the future.

**The meta-point**: markets are near-efficient, so a spectacular backtest is *prior evidence of a mistake*, not of genius. The professional stance is to assume the backtest is wrong until it survives out-of-sample testing, realistic costs, capacity analysis, and an economic rationale. Deflate, hold out, cost it, and demand a story.

### Q15. How would you design a robust backtesting framework to avoid these pitfalls?

Build the discipline into the process, not the good intentions:

```text
1. Data: point-in-time, survivorship-free universe (include delisted names with
   delisting returns); corporate-action-adjusted; validated for bad ticks.
2. Information timeline: at each timestamp, expose ONLY data known then; add
   realistic release/settlement lags. Signal at t -> trade at t+1, no same-bar fills.
3. Split: reserve a true out-of-sample period touched exactly ONCE. Develop and
   tune only on the in-sample block.
4. Validation: walk-forward or purged/embargoed cross-validation (no leakage
   across fold boundaries).
5. Costs: model commissions + spread + impact (~ sqrt(size/ADV)) + borrow;
   evaluate on NET returns only.
6. Capacity: cap size vs ADV; stress the strategy at target AUM.
7. Degrees of freedom: few, economically motivated parameters; log every variant
   tried and DEFLATE the Sharpe for the number of trials.
8. Robustness: test across sub-periods and regimes, parameter neighborhoods
   (edge should be a plateau, not a spike), and simple perturbations.
9. Report: net Sharpe, max drawdown + duration, turnover, capacity, and the
   economic thesis for WHY the edge exists.
```

The framework's job is to make it *hard to fool yourself*: point-in-time data kills look-ahead and survivorship, the single-use holdout and trial-counting kill data-snooping, and net-of-cost/capacity evaluation kills the "great on paper" illusion. If the edge survives all of that and has a reason to exist, it might be real.

### Q16. Compare mean-reversion and momentum on a table of when each wins and loses.

| Dimension | Mean reversion | Momentum |
|---|---|---|
| Core bet | extremes reverse to the mean | trends persist |
| Trade | fade moves: buy dips, sell rips | ride moves: buy winners, sell losers |
| Best regime | range-bound, choppy, high noise | strong, sustained trends |
| Worst regime | strong trends (keeps fading a runner) | sharp reversals ("momentum crash") |
| Typical horizon | intraday to days (also long-horizon value) | ~3-12 months (intermediate) |
| Return profile | many small wins, occasional big loss when trend breaks | many small losses, occasional big win; negative skew at reversals |
| Turnover / costs | often high (frequent entries/exits) -> cost-sensitive | moderate; rebalances periodically |
| Classic example | pairs trading, short-term reversal | time-series & cross-sectional momentum, trend following |
| Failure mode | spread that de-cointegrates and trends away | crowded trade unwinding violently |

**Takeaway**: they are complementary, not rival — different horizons and regimes (Q3). A common construction runs a short-horizon mean-reversion sleeve and an intermediate-horizon momentum sleeve; their low correlation raises the combined Sharpe and softens each one's worst regime. The art is regime awareness and correct horizon matching, plus honest costs, since mean reversion's edge is especially fragile to turnover-driven transaction costs.

## Quant Interview Problems & Brainteasers

### Summary

**What this topic covers**

The pure problem-solving round — the probability puzzles, expected-value games, and quick derivations that trading firms and quant desks use to watch you *think*. This topic is worked examples, not theory: (1) **expected-value classics** — the famous E[flips to get HH] = 6 vs E[flips to get HT] = 4, dice and coin games, solved by first-step / Markov-chain reasoning; (2) **martingales and optional stopping** — fair-game arguments, gambler's ruin, and random walks; (3) **conditional probability and Bayes** — Monty Hall, the two-child problem, the disease-test paradox; (4) **combinatorics and counting**; (5) **mental math and Fermi estimation** — "how many...?"; and (6) a few **quick-fire "price this / derive this"** option asks that connect to the rest of the primer. The 16 questions each get worked fully, and the topic closes with *strategy*: how to reason aloud, define variables, exploit symmetry and recursion, and sanity-check under pressure. The content matters, but the meta-skill — structured thinking made audible — is what actually gets tested.

**Mental model**

A brainteaser is not a trivia question; it is a live demo of how you decompose an unfamiliar problem. The interviewer is running a simulation of what it is like to work with you, so *how* you get there matters as much as the answer. Three reflexes carry most problems. (1) **Define variables and condition on the first step.** Let E be the quantity you want, then ask "what happens on the first flip / first move?" and write E in terms of itself — recursion and first-step analysis crack the majority of expected-value and random-walk problems. (2) **Exploit symmetry and invariants.** Fair games are martingales (expected future value = current value), so many gambling problems collapse to "the expectation cannot change." (3) **Reframe with Bayes when intuition rebels** — Monty Hall and disease tests feel wrong because System-1 ignores the base rate or the extra information in *how* data arrived; writing `P(A|B) = P(B|A)*P(A)/P(B)` forces the truth. Always finish by sanity-checking: does the number have the right sign, the right limits, the right order of magnitude?

**Key terms**

- **Expected value E[X]** — the probability-weighted average outcome; linear: `E[X+Y]=E[X]+E[Y]` always.
- **First-step analysis** — condition on the first move and write the expectation recursively.
- **Markov chain** — a process where the next state depends only on the current state; states here are "progress toward the target pattern".
- **Martingale** — a fair game: `E[X_{n+1} | history] = X_n`; expectation is conserved.
- **Optional stopping theorem** — for a martingale and a nice stopping time, `E[X_stop] = X_0`.
- **Gambler's ruin** — a random walk between 0 and N; gives ruin probabilities and expected duration.
- **Conditional probability** — `P(A|B) = P(A and B)/P(B)`; the workhorse of the tricky puzzles.
- **Bayes' theorem** — `P(A|B) = P(B|A)*P(A)/P(B)`; invert a conditional using the base rate.
- **Base rate** — the unconditional prior `P(A)`; ignoring it causes the disease-test paradox.
- **Fermi estimation** — decompose an unknown quantity into estimable factors and multiply.
- **Symmetry argument** — using a problem's structure to deduce an answer without brute computation.
- **Sanity check** — verifying sign, boundary limits, and order of magnitude of an answer.

**Why interviewers ask this**

These rounds test raw quantitative reasoning under mild pressure — exactly the daily job of pricing, hedging, and sizing bets with incomplete information. Firms care less about whether you have memorized the answer (many are famous) and more about the *process*: do you define notation cleanly, decompose the problem, reason out loud so they can follow, catch your own errors, and sanity-check? A candidate who blurts "6" to the HH problem scores worse than one who sets up the Markov chain, explains *why* HH and HT differ, and arrives at 6 transparently. Interviewers probe for: comfort with expectation and conditioning, recognizing martingale/symmetry structure, resistance to the Bayesian traps (base-rate neglect), numeracy without a calculator, and grace under partial information. The signal is a mind that stays organized when it does not immediately see the answer — because that is what trading a novel situation actually feels like.

**Common confusions**

- "HH and HT should take the same expected number of flips" — they do not (6 vs 4); overlapping patterns like HH can waste a partial match, while HT cannot.
- "Monty Hall is 50/50 after a door opens" — no; switching wins 2/3 because the host's choice is informative, conditioned on where the car is.
- "The two-child problem is always 1/2" — the answer depends on *how* you learned a child is a boy; the information channel changes the conditioning.
- "A positive test means you probably have the disease" — not if the disease is rare; the base rate dominates and most positives are false (base-rate neglect).
- "In gambler's ruin a fair game means I will break even" — with a target, the probability of hitting it is your fraction of the total stake, and the expected duration can be large.
- "Expected value tells the whole story" — a bet with positive EV can still ruin you (variance, the Kelly/betting-size question); EV is necessary, not sufficient.

**What follows from this topic**

The reasoning here is the connective tissue of the whole primer. First-step / recursive analysis is the discrete cousin of the dynamic-programming and tree methods used to price American options. Martingales and optional stopping are the finite-state shadow of risk-neutral pricing (discounted prices are martingales under Q) and of Brownian-motion arguments. Conditional expectation and Bayes underlie filtering, calibration, and updating views. Fermi estimation is exactly the market-sizing and capacity thinking from the strategy topics. And the "reason aloud, define variables, exploit symmetry, sanity-check" discipline is precisely how you should attack the *derivation* questions elsewhere in this primer — Black-Scholes, the Greeks, VaR. Master the habits here and every other topic gets easier to reason through live.

### Q1. What is the expected number of coin flips to get two heads in a row (HH)?

Let E be the expected number of flips to reach HH from scratch. Use first-step analysis on the *state of progress*. Define:
- `E0` = expected flips from having no progress (or a tail just seen)
- `E1` = expected flips from having exactly one trailing head

```text
From E0: flip once.
  H (prob 1/2) -> go to state E1
  T (prob 1/2) -> stay at E0
  E0 = 1 + (1/2)*E1 + (1/2)*E0

From E1: flip once.
  H (prob 1/2) -> DONE
  T (prob 1/2) -> back to E0
  E1 = 1 + (1/2)*0 + (1/2)*E0
```

Solve: from the second equation `E1 = 1 + E0/2`. Substitute into the first:

```text
E0 = 1 + (1/2)(1 + E0/2) + (1/2)E0
E0 = 1 + 1/2 + E0/4 + E0/2
E0 - (3/4)E0 = 3/2
(1/4)E0 = 3/2  =>  E0 = 6
```

So **E[flips to HH] = 6**. Sanity check: it must exceed the expected flips to get a single head (which is 2), and exceed HT (4, next question) because HH is "harder" to complete — 6 fits.

### Q2. Why is the expected number of flips to get HT only 4, when HH is 6?

Set up HT the same way. Progress states:
- `E0` = no progress
- `E1` = just saw an H (waiting for a T)

```text
From E0:
  H (1/2) -> E1
  T (1/2) -> E0        (a leading T is useless, stay)
  E0 = 1 + (1/2)E1 + (1/2)E0

From E1:
  T (1/2) -> DONE
  H (1/2) -> E1        (another H keeps us "just saw H", NO reset)
  E1 = 1 + (1/2)*0 + (1/2)E1  =>  E1 = 2
```

Then `E0 = 1 + (1/2)(2) + (1/2)E0 => (1/2)E0 = 2 => E0 = 4`. So **E[HT] = 4**.

**Why the difference?** The asymmetry is in what happens when the pattern *breaks*:
- For **HH**, if you have one H and flip a T, you lose all progress and reset to zero — the wasted partial match costs you.
- For **HT**, once you have an H you can *never* go backward: any extra H just keeps you in "waiting for T", and the T finishes. There is no way to squander a partial match.

Overlapping patterns (HH, and worse HHH) are "self-destructive" — a failure erases progress — so they take longer. Non-self-overlapping patterns (HT) are efficient. This is the intuition behind Conway's leading-number algorithm and why, counterintuitively, different two-letter patterns have different waiting times even though each has probability 1/4 in any fixed two flips.

### Q3. Two players flip a fair coin; the first to see their assigned pattern wins. Can pattern choice matter (Penney's game)?

Yes — and startlingly, the game is **non-transitive**. In Penney's game, player 1 picks a length-3 pattern, then player 2, seeing it, can always pick a pattern that beats it more than half the time.

The trick: to beat an opponent's pattern `XYZ`, choose `(not Y) X Y` — prepend the opposite of their second bit to the first two of theirs. Example:

```text
Opponent picks HHH -> you pick THH. You win with probability 7/8.
  (The only way HHH appears before THH is if the first three flips are HHH,
   probability 1/8; otherwise some T precedes the run of H's, and THH lands first.)
Opponent picks HHT -> you pick THH, win 3/4.
Opponent picks HTH -> you pick HHT, win 2/3.
```

**Why non-transitive?** Winning is not about a pattern's standalone waiting time; it is about which pattern tends to *appear first in the same shared sequence*, which depends on how one pattern's suffix feeds the other's prefix. Because A beats B, B beats C, C beats D, and D beats A can all hold, there is no "best" pattern — the second mover always has the edge. The lesson for interviews: standalone expectations (Q1/Q2) do not compose into head-to-head odds; you must reason about the shared sequence and overlap structure. Like rock-paper-scissors, information (moving second) is an advantage.

### Q4. Explain the Monty Hall problem and why switching wins 2/3 of the time.

Three doors, one hides a car, two hide goats. You pick a door. The host — who *knows* what is behind each door — opens one of the other two, always revealing a goat, then offers you the switch. Should you?

**Yes, switch — it wins with probability 2/3.** The clean argument:

```text
Your initial pick is right with prob 1/3, wrong with prob 2/3.
Case A (prob 1/3): you picked the car. Host opens a goat. Switching LOSES.
Case B (prob 2/3): you picked a goat. The host is FORCED to open the other
                   goat, so the remaining door is the car. Switching WINS.
=> Switch wins 2/3, stay wins 1/3.
```

**Why it feels like 50/50 but isn't**: the host's action is *not random* — he conditions on knowing the car's location and always avoids it. That injects information. Your original door keeps its 1/3 prior; the host's reveal concentrates the remaining 2/3 onto the single unopened door rather than splitting it. A decisive intuition pump: imagine **100 doors**, you pick one (1/100 chance right), the host opens 98 goats and leaves one other door. That surviving door carries the other 99/100 — obviously switch. The key subtlety in interviews: this relies on the host *knowingly* revealing a goat. If the host opened a door at random and it happened to be a goat, the update is different (then it is 50/50). Always state the assumption.

### Q5. The two-child problem: a family has two children and at least one is a boy. What is the probability both are boys?

The classic answer is **1/3** — but the real lesson is that it depends on *how you obtained the information*.

**Version 1 ("at least one is a boy", e.g. a truthful yes to 'do you have any boys?')**: equally likely birth orderings are BB, BG, GB, GG. Condition on "at least one boy" eliminates GG:

```text
Remaining equally-likely: {BB, BG, GB}
P(both boys | at least one boy) = 1 / 3
```

**Version 2 ("the older child is a boy")**: this fixes one slot. Outcomes with older = boy are BB, BG. So `P(BB) = 1/2`. Specifying *which* child changes the answer.

**Version 3 ("I met one of the children and it was a boy", or "one is a boy born on a Tuesday")**: the information channel matters. If you randomly meet one child and see a boy, you are more likely to be in a two-boy family (two chances to show a boy), pushing the probability back toward 1/2. The Tuesday-boy variant famously gives ~13/27.

**The interview point**: state your assumption about *how the information arrived* before answering. The number is not a property of the family alone; it is a property of the family *and the observation process*. Conflating "at least one boy" with "this specific child is a boy" is the trap.

### Q6. A disease affects 1 in 1000 people. A test is 99% accurate. You test positive — what is the chance you have it?

This is the base-rate / false-positive paradox. Assume "99% accurate" means 99% sensitivity (`P(pos|disease)=0.99`) and 99% specificity (`P(pos|healthy)=0.01`). Apply Bayes:

```text
P(disease) = 0.001,  P(healthy) = 0.999
P(pos) = P(pos|dis)*P(dis) + P(pos|healthy)*P(healthy)
       = 0.99*0.001 + 0.01*0.999
       = 0.00099 + 0.009990 = 0.01098

P(disease|pos) = P(pos|dis)*P(dis) / P(pos)
              = 0.00099 / 0.01098 ~= 0.090
```

So only about **9%** — despite a "99% accurate" test, a positive result means you probably do *not* have the disease.

**Why**: the disease is rare (base rate 1/1000), so among 1000 people you expect ~1 true positive but ~10 false positives (1% of the 999 healthy). True positives are outnumbered ~10 to 1. A natural-frequency framing makes it obvious:

```text
Per 100,000 people:  ~100 have it -> ~99 test positive (true)
                     ~99,900 healthy -> ~999 test positive (false)
  P(disease|pos) ~= 99 / (99 + 999) ~= 9%
```

The interview lesson: never ignore the base rate. Test accuracy alone is meaningless without the prior prevalence — the reason rare-event screening produces mostly false alarms, and a caution that applies to trading signals with low hit rates too.

### Q7. Gambler's ruin: you bet 1 unit per fair coin flip, start with k units, and stop at 0 or N. What is the probability you reach N?

With a **fair** game (win/lose 1 unit with prob 1/2 each), your wealth is a martingale. By the optional stopping theorem the expected final wealth equals the start:

```text
E[final] = k
final is 0 (prob 1 - p) or N (prob p), where p = P(reach N)
=> N*p + 0*(1-p) = k  =>  p = k/N
```

So **P(reach N) = k/N** — your probability of hitting the target is simply your starting fraction of the total stake. Start with 30 of a 100 target, you have a 30% chance.

**Expected duration** (fair game): `E[number of steps] = k*(N-k)`. Starting at the midpoint gives the longest game.

**Biased version** (win prob `q != 1/2`, ratio `r = (1-q)/q`): martingale intuition still works with a transformed variable, giving

```text
P(reach N) = (1 - r^k) / (1 - r^N)
```

**Interview intuition**: against an infinitely rich house (`N -> infinity`) with a fair game, `p = k/N -> 0` — you are eventually ruined with probability 1, even though the game is fair, because you have finite capital and the house does not. With any house edge (`q < 1/2`, `r > 1`), ruin is even more certain. This is why "the house always wins" and why bet-sizing/bankroll management (Kelly) matters more than a positive expectation alone.

### Q8. What is a martingale, and how does the optional stopping theorem crack betting problems?

A **martingale** is a fair-game process: given all history up to now, the expected next value equals the current value.

```text
E[X_{n+1} | X_0, ..., X_n] = X_n     (fair: no drift)
```

Consequences: `E[X_n] = X_0` for all n — expectation is conserved. A submartingale drifts up (`>= X_n`), a supermartingale drifts down.

The **optional stopping theorem (OST)** says that for a martingale and a "nice" stopping time tau (bounded, or with finite expected value under mild conditions), the expected value at the stopping time still equals the start:

```text
E[X_tau] = X_0
```

**Why this is a superpower for betting problems**: it lets you compute a probability or expected time *without* summing an infinite series. Gambler's ruin (Q7) falls out in one line — wealth is a martingale, so `E[wealth at stop] = start`, giving `p = k/N` immediately. It also proves you cannot beat a fair game with any clever stopping rule: `E[final wealth] = E[initial wealth]`, no matter how you decide when to quit. The martingale-betting "system" (double after each loss) *seems* to guarantee profit, but OST (plus finite capital) shows the expected gain is zero and the rare catastrophic loss exactly offsets the many small wins. **Connection to finance**: under the risk-neutral measure Q, discounted asset prices are martingales — the same conserved-expectation logic underlies option pricing, which is why this concept is everywhere in the primer.

### Q9. Roll a fair die repeatedly and sum the rolls; what is the expected number of rolls until the running total is a multiple of some target — or simpler, what is E[rolls until you see a 6]?

Start with the clean building block. Each roll shows a 6 with probability 1/6 independently, so the number of rolls until the first 6 is **geometric**, and its expectation is the reciprocal:

```text
E[rolls until first 6] = 1/p = 1/(1/6) = 6
```

First-step derivation (to show the reasoning aloud): let E be the expected rolls.

```text
E = 1 + (1/6)*0 + (5/6)*E     (one roll; success ends it, else start over)
E - (5/6)E = 1  =>  (1/6)E = 1  =>  E = 6
```

**A richer variant interviewers like**: "roll until you get a 6, and sum all the rolls — what is the expected sum?" Use the fact that each non-terminal roll is uniform on {1,2,3,4,5} (mean 3) and there are on average 5 such rolls before the final 6, plus the 6 itself:

```text
E[sum] = E[non-6 rolls] * E[value | not 6] + 6
       = 5 * 3 + 6 = 21
```

(The number of non-6 rolls is `E[total] - 1 = 5`.) **The transferable trick**: geometric waiting times give `1/p` instantly, and **linearity of expectation** lets you handle the sum by separating "how many rolls" from "value per roll" — even though those are dependent, linearity does not care. Always reach for `E[X]=1/p` and linearity before setting up messy conditioning.

### Q10. You have 100 cables (200 ends) in a dark room and randomly tie ends together in pairs; what is the expected number of loops formed?

A classic linearity-of-expectation problem — direct computation is a nightmare, but the expectation decomposes beautifully. With `n` cables you have `2n` ends. Pair them up randomly; each closed chain is a "loop". Track the expected number of loops by thinking about when a loop *closes*.

Set it up by successive tying. Pick any free end; tie it to another random free end. If you tie an end to *the other end of the same current chain*, you close a loop; otherwise you extend a chain.

```text
With 2n ends, tie the first end: it has (2n - 1) other ends to join, exactly 1 of
which closes a loop. So P(close a loop this step) = 1/(2n - 1).
After that tie, 2 ends are consumed; repeat with (2n - 2) ends: next closing
probability 1/(2n - 3), and so on.

E[loops] = 1/(2n-1) + 1/(2n-3) + ... + 1/3 + 1/1
```

For **n = 100** (200 ends):

```text
E[loops] = 1/199 + 1/197 + ... + 1/3 + 1/1
        = sum of reciprocals of odd numbers 1..199
        ~= (1/2)*ln(200) + (ln2)/2 + gamma/2  ~= 3.28
```

So about **3.28 loops** expected. **Why linearity saves you**: you never compute the distribution of loop counts; you sum the per-step closing probabilities, because expectation is additive even though the steps are dependent. The general formula `sum_{k=1..n} 1/(2k-1)` grows like `~0.5*ln(n)` — slowly. This "sum indicator expectations" move (define an indicator for each possible loop-closing event, sum their probabilities) is one of the most reusable tools in the quant-interview kit.

### Q11. Estimate how many golf balls fit inside a Boeing 747 (a Fermi problem) — how do you attack it?

Fermi problems test structured estimation, not knowledge. Decompose into factors you *can* estimate, keep round numbers, and multiply — aiming for the right order of magnitude.

```text
1. Cabin volume of a 747 (treat as a cylinder):
   length ~ 60 m, diameter ~ 6 m -> radius 3 m.
   V ~ pi * r^2 * L ~ 3 * 9 * 60 ~ 1600 m^3. Round to ~ 1500 m^3.
   (Discount for seats/structure? Rough estimate, leave as-is or halve.)
2. Convert to cm^3: 1 m^3 = 10^6 cm^3, so ~ 1.5 * 10^9 cm^3.
3. Golf ball: diameter ~ 4.3 cm, radius ~ 2.15 cm.
   V_ball ~ (4/3)*pi*r^3 ~ 4.2 * 10 ~ 42 cm^3. Round to ~ 40 cm^3.
4. Packing efficiency: spheres pack at ~ 64% (random) to 74% (optimal).
   Use ~ 0.65. Effective ball volume "footprint" ~ 40 / 0.65 ~ 60 cm^3.
5. Count = cabin volume / effective ball volume
       ~ 1.5e9 / 60 ~ 2.5 * 10^7.
```

So roughly **20-30 million golf balls**. **What the interviewer wants**: that you (1) *state assumptions out loud* (cabin as a cylinder, ignore seats or explicitly discount), (2) *decompose* into volume-of-container / volume-per-item / packing factor, (3) keep arithmetic tractable with round numbers and powers of ten, and (4) *sanity-check* the magnitude (tens of millions is plausible; billions or thousands would be wrong). The exact number is irrelevant; the transparent, checkable *method* is the entire signal. Do not reach for a phantom precise figure — show the scaffolding.

### Q12. A stick is broken at two uniformly random points; what is the probability the three pieces form a triangle?

Let the stick have length 1 and the two break points be `x` and `y`, each uniform on [0,1] and independent. The three pieces form a triangle iff no single piece exceeds 1/2 (the triangle inequality: each side less than the sum of the other two, i.e. less than 1/2 of the total).

Work in the unit square of `(x, y)`. It is cleanest to think of the three piece lengths. Order the two cuts as `a = min(x,y)`, `b = max(x,y)`; pieces are `a`, `b - a`, `1 - b`. The triangle condition (each < 1/2) fails in exactly three regions:

```text
Fail if:  a > 1/2        (first piece too long)
   or     1 - b > 1/2    (i.e. b < 1/2, last piece too long)
   or     b - a > 1/2    (middle piece too long)
```

By symmetry each failure region has area 1/8 of the relevant space, and they are disjoint. Carrying the geometry through the unit square:

```text
P(triangle) = 1/4
```

**Intuition / sanity check**: it is less than 1/2 because it is "easy" for one piece to be over half the stick. A quick symmetry-and-geometry route: map the problem to the region where all three pieces are under 1/2; this carves the unit square into a small central triangle whose area is 1/4 of the total. **Interview value**: this rewards translating a word problem into a geometric probability (area = probability under a uniform distribution), using ordering/symmetry to simplify, and checking the answer against intuition (a number between 0 and 1/2 feels right). If you had guessed 1/2, the sanity check "one piece easily exceeds half" flags it.

### Q13. Quick-fire: what is the fair price of a bet that pays 1 dollar if a fair coin comes up heads, and how does that generalize to risk-neutral option pricing?

The bet pays 1 on heads, 0 on tails, coin fair. Ignoring time value, the fair price is the expected payoff:

```text
Price = E[payoff] = (1/2)*1 + (1/2)*0 = 0.50 dollars
```

Pay more and you lose in expectation; pay less and the counterparty does. **Generalization**: the fair price of any claim is the *expected payoff under the correct probabilities, discounted for time*. In finance the subtlety is *which* probabilities — and the answer is the **risk-neutral** measure, not the real-world one.

```text
Option price = exp(-r*T) * E^Q[ payoff ]
```

Under the risk-neutral measure Q, all assets drift at the risk-free rate r (not their real expected return), because you can *hedge* the risk away. A one-period binomial illustrates it: a stock goes up to `S*u` or down to `S*d`; the risk-neutral up-probability is

```text
p = (exp(r*dt) - d) / (u - d)
```

and the option is `exp(-r*dt) * [ p*V_up + (1-p)*V_down ]`. Note p is *not* the real probability of an up move — it is the probability that makes the discounted stock a martingale (Q8). **The through-line**: pricing = discounted expected payoff, but under the measure that reflects no-arbitrage/hedging, so the coin-flip "expected value" intuition survives, with the twist that the "coin" is weighted by replication cost, not by real-world odds.

### Q14. Quick-fire: derive put-call parity from a no-arbitrage argument.

Put-call parity links a European call and put with the same strike K and expiry T. Consider two portfolios:

```text
Portfolio A: one call (C) + cash K*exp(-r*T) invested at the risk-free rate.
Portfolio B: one put  (P) + one share of stock (S).
```

At expiry, both are worth `max(S_T, K)`:

```text
If S_T > K:  A = (S_T - K) + K = S_T ;   B = 0 + S_T = S_T
If S_T <= K: A = 0 + K = K       ;       B = (K - S_T) + S_T = K
```

Same payoff in every state => by no-arbitrage they must cost the same today:

```text
C + K*exp(-r*T) = P + S
=>  C - P = S - K*exp(-r*T)
```

**Intuition**: a call plus cash to buy the stock at K replicates a put plus the stock — both are "floored" ways to end up holding the better of stock or strike. **Why it matters in interviews**: it needs *no model* (no Black-Scholes, no distribution assumption) — only no-arbitrage and replication, so it is the cleanest demonstration of the replication mindset. Corollaries drop out instantly: if you know C you know P; a synthetic stock is `C - P + K*exp(-r*T)`; and violations imply a riskless arbitrage. This is the kind of "derive this" ask where showing the two-portfolio payoff table *is* the answer.

### Q15. 100 prisoners, 100 boxes, each finds their own number by opening at most 50 boxes — what strategy beats the astronomically small odds?

Each of 100 prisoners must find their own number among 100 boxes (numbers 1-100 shuffled inside), opening at most 50 boxes; *all* must succeed or all are executed. Independent random guessing gives success `(1/2)^100` — effectively zero. Yet a strategy achieves **~31%**.

**The cycle-following strategy**: each prisoner starts at the box labeled with their *own* number, then goes to the box labeled with the number they *find inside*, and repeats — following the permutation's cycle.

```text
Prisoner k: open box k -> read number n1 -> open box n1 -> read n2 -> ...
Because they started at "their own number", the cycle they trace leads back to
the box containing their number -- IF that cycle has length <= 50.
```

Every prisoner succeeds **iff the random permutation has no cycle longer than 50**. So success probability = P(longest cycle <= 50):

```text
P(a cycle of length L > 50 exists) = sum_{L=51..100} 1/L
P(success) = 1 - sum_{L=51..100} 1/L  ~= 1 - (ln100 - ln50) = 1 - ln2 ~= 0.307
```

About **31%** — independent of the number of prisoners, converging to `1 - ln2`.

**Why it works**: the strategy *correlates* the prisoners' fates. Instead of 100 independent 1/2 coin flips, everyone fails together (a long cycle exists) or a whole cohort succeeds. You cannot raise each individual's success above 1/2, but you can *couple* the failures so they pile onto the same bad permutations, leaving a large fraction of permutations where *everyone* wins. **Interview lesson**: when independent odds look hopeless, look for a strategy that introduces dependence/structure so the good and bad outcomes concentrate. This coupling idea recurs in risk (correlated defaults) and portfolio construction.

### Q16. How should you actually reason through a brainteaser in a quant interview?

The answer is often known to the interviewer; your *process* is what is graded. A reliable playbook:

- **Restate and clarify.** Repeat the problem, pin down ambiguities out loud ("is the host choosing knowingly?", "are draws with replacement?"). Many puzzles (two-child, Monty Hall) hinge entirely on the information process — surface it before computing.
- **Define variables cleanly.** Name the unknown (`let E = expected flips`), the states, the probabilities. Clear notation prevents errors and lets the interviewer follow you.
- **Reach for the standard tools in order.** Linearity of expectation (works even under dependence), first-step / recursive conditioning, symmetry, martingale/optional-stopping, Bayes for conditional traps, indicators for counting. Ask "what happens on the first step?" — it cracks most EV and random-walk problems.
- **Think out loud, structured.** Narrate the decomposition, not a stream of consciousness. Silence reads as being stuck; rambling reads as disorganized. Aim for "here is my plan; here is step one."
- **Exploit symmetry and small cases.** Solve n=1 or n=2, look for a pattern, then generalize. Symmetry often gives the answer with no algebra.
- **Sanity-check the answer.** Right sign? Sensible boundary limits (probability in [0,1], expectation positive)? Right order of magnitude (Fermi)? For "switch wins 2/3", test the 100-door extreme. A self-caught error scores *better* than a wrong answer you did not notice.
- **Be graceful under partial progress.** If stuck, state what you *do* know, try a simpler version, and reason toward it. Composure under incomplete information is precisely the trading skill they are hiring for.

The meta-signal: an organized mind that stays structured when the answer is not obvious. That is worth more than instant recall of any single puzzle.
