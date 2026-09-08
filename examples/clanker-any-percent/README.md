# CLANKER ANY%

[![CLANKER monitor](https://github.com/AlexanderHabscheid/clanker-any-percent/actions/workflows/clanker-monitor.yml/badge.svg)](https://github.com/AlexanderHabscheid/clanker-any-percent/actions/workflows/clanker-monitor.yml)
[![Live app](https://img.shields.io/badge/live-cook_the_clanker-c7ff00?style=flat-square&labelColor=090909)](https://clanker-any-percent.vercel.app)

**[Run CLANKER](https://clanker-any-percent.vercel.app)** · **[Mint a Kanu challenge](https://clanker-any-percent.vercel.app/c?url=https%3A%2F%2Fgetkanu.com%2F&goal=Open+Kanu%27s+Book+a+Demo+scheduling+interface.+Do+not+enter+data+or+book.&frame=Book+a+call)**

> Your landing page looks great. Can a clanker figure out how to become your customer?

Test whether an AI browser can reach a predeclared milestone on a public website.

Paste a URL, a mission, and a win condition such as visible text (`$49/month`)
or a final URL path/query fragment (`/pricing`). Embedded scheduling flows can
instead declare a visible frame title (`Book a call`). A recorded Solari browser gets 12 moves.
Afterward CLANKER checks the predeclared condition in code and produces a
shareable `LOCKED IN` or `COOKED` card with time, actions, redirects, CAPTCHA
boss fights, aura, and a Solari replay. Both conditions must pass when both are
provided.

Anyone can mint a public challenge URL before spending a credit. The URL freezes
the start page, mission, and checks; recipients can copy, post, and run the same
contract. It needs no account or new persistence layer.

That distinction is the product: the agent does not grade its own work, and the
headline domain score excludes older AI-judged runs whenever deterministic
receipts exist. Reports disclose the evidence basis, keep each journey under a
stable contract ID, and require three runs with the same contract, model, browser
mode and evaluator before displaying `REPEATED CHECKS`. Rule-checked runs skip the separate judge call, reducing
model cost.

## Why this repository exists

This is the clean, standalone home for CLANKER. It was built as a Solari
cookbook use case for Pinetree Research's public shipping challenge. The
[original implementation inside the required cookbook fork](https://github.com/AlexanderHabscheid/solari-cookbook/tree/main/examples/clanker-any-percent)
remains public as provenance; this repository is the link to star, clone, and
share.

The joke is also the benchmark: the public learns which sites browser agents can
actually use, while site owners get replayable agentic-UX failures for free.
Every tested domain receives a public Agent Readiness Report with completion
rate, median successful time, recurring failure categories, trend, failed
missions, and links to the underlying runs. The score is simply the observed
condition-match rate, not a certification of site-wide agent readiness.

## What a receipt proves

- Text matching ignores case and collapses whitespace. It checks the complete
  final page's `innerText`, including off-screen content—not just the agent's
  truncated observation. Canvas, images and embedded frame text are not checked.
- URL matching is case-sensitive and checks path + query, not host or hash.
- Embedded-frame matching checks the case-insensitive `title` of a visible
  iframe. It does not inspect cross-origin contents or prove form submission.
- Both supplied conditions must pass. Empty contracts cannot pass vacuously.
- A matching condition does **not** prove an arbitrary natural-language goal,
  purchase, signup, correct plan choice, or a website-caused failure. Choose
  specific checks and inspect the replay. The agent can see the criteria.
- Reports separate cohorts by contract, provider, model, mode and evaluator version.
  Mixed cohorts have no aggregate trend. Three repeats is a minimum evidence
  gate, not statistical confidence; websites and model aliases can still change.
- Synthetic demo results never contribute when real results exist.

### A useful first case study

With a willing site owner, define one milestone (e.g. reaching `/pricing` with
the expected plan name), run it three times, inspect failures, and repeat after
a documented owner-approved fix. Keep the contract and agent settings fixed.
Publish all outcomes and replay links, including failures; don't claim causation
or adoption from the demo. No real-customer case study is included yet.

This design takes execution-based evaluation from [OSWorld](https://arxiv.org/abs/2404.07972)
and versioned comparison discipline from [OSWorld-V2's benchmark releases](https://github.com/xlang-ai/OSWorld-V2/blob/main/benchmark_releases/README.md),
but only implements narrow browser text/path checks—not those benchmark suites.

## Run

```bash
npm install
export SOLARI_API_KEY=slr_live_...
export GROQ_API_KEY=gsk_...
export OPENAI_API_KEY=sk-...
npm start
```

Open <http://localhost:3000>. `See rigged demo` works without keys. When both
providers are configured, Groq is the default and uses `qwen/qwen3.8-27b` for
vision + strict JSON actions; OpenAI remains an explicit fallback when Groq is
absent. Override with `GROQ_MODEL` or `OPENAI_MODEL`, or change `PORT`.
Paid plans can opt into managed stealth and CAPTCHA solving with
`SOLARI_STEALTH=true` and `SOLARI_CAPTCHA=true`; both default off so the app
works on the free plan. CAPTCHA encounters are still detected and scored.

Public deployments require `CLANKER_LIVE_RUNS=true` in addition to `SOLARI_API_KEY`
and either `GROQ_API_KEY` (preferred) or `OPENAI_API_KEY`. The app reserves a
default `$5/day` budget using a conservative `$0.25/run` estimate, then applies
the smaller of that ceiling and `CLANKER_DAILY_RUN_LIMIT` (six by default).
Configure `CLANKER_DAILY_BUDGET_USD` and `CLANKER_ESTIMATED_RUN_COST_USD` for a
tighter local guard. This is a reservation guard, not a billing guarantee:
provider spend limits are authoritative, and failed attempts plus concurrent
serverless instances can still race. Set a hard `$5` spend limit in the Groq
console (and OpenAI if you keep the fallback) before enabling public runs. On Vercel, run evidence is
stored in a connected private Blob store; local development keeps using JSONL.

## Synthetic monitoring

Three standardized mission packs ship with the project: `commerce-core`,
`saas-evaluation`, and `content-discovery`. Each pack contains three stable
missions so results remain comparable across deployments.

Mission packs use a strict screenshot judge because expected proof is
site-specific. Public app runs ask the user for deterministic proof. Reports
label and separate both evidence classes instead of presenting them as equally
strong.

```bash
npm run monitor -- https://example.com commerce-core
```

The command records every run, prints machine-readable JSON, and exits `2` when
a previously successful mission fails or a successful mission becomes at least
1.5× and three seconds slower than its recent baseline. That makes regression
alerts work in any cron service or CI system without another backend.

Preview cost before creating any browser or model request:

```bash
CLANKER_DRY_RUN=true npm run monitor -- https://example.com commerce-core
```

Compare up to three models and both Solari browser modes explicitly:

```bash
CLANKER_MODELS=qwen/qwen3.8-27b \
CLANKER_BROWSER_MODES=standard,stealth \
npm run monitor -- https://example.com saas-evaluation
```

That example runs 12 browser tasks, so use it deliberately. The default runs
one model × one browser mode × three missions. Domain reports group results by
mission contract, provider, model, browser mode and evaluator version, and surface
regression alerts with replay links.

The included `.github/workflows/clanker-monitor.yml` runs weekly only after
repository variable `CLANKER_MONITOR_URL` is configured. Add repository secrets
`SOLARI_API_KEY` and `GROQ_API_KEY`; `OPENAI_API_KEY` is optional fallback.
Optionally set `CLANKER_MONITOR_PACK`.
Manual workflow runs are also supported.

## Safety boundary

- Public `http(s)` hosts only; DNS-resolved private networks are rejected.
- The clanker stays on the submitted site.
- Password inputs are invisible to it.
- Login, personal data, uploads, purchases, posting, messaging, deletion, and
  final application/form submission are forbidden in the model prompt.
- High-risk final-action labels are blocked again in deterministic code.
- Page text is treated as untrusted content, not instructions.

Every session is recorded, and the browser/client are released in `finally`.

## Check

```bash
npm run check
```
