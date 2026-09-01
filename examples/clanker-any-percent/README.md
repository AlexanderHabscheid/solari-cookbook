# CLANKER ANY%

Live app: <https://clanker-any-percent.vercel.app>

Turn any safe, public website task into a browser-agent speedrun.

Paste a URL and a mission. A recorded Solari browser gets 12 moves to
finish it. A separate AI judge checks the final screen, then the run receives a
shareable `LOCKED IN` or `COOKED` card with time, actions, redirects, CAPTCHA
boss fights, aura, and a Solari replay.

The joke is also the benchmark: the public learns which sites browser agents can
actually use, while site owners get replayable agentic-UX failures for free.
Every tested domain receives a public Agent Readiness Report with completion
rate, median successful time, recurring failure categories, trend, failed
missions, and links to the underlying runs. The score is simply the observed
completion rate—no opaque benchmark math.

## Run

```bash
npm install
export SOLARI_API_KEY=slr_live_...
export OPENAI_API_KEY=sk-...
npm start
```

Open <http://localhost:3000>. `See rigged demo` works without keys. Set
`OPENAI_MODEL` to override `gpt-5.4-mini`, or `PORT` to change the port.
Paid plans can opt into managed stealth and CAPTCHA solving with
`SOLARI_STEALTH=true` and `SOLARI_CAPTCHA=true`; both default off so the app
works on the free plan. CAPTCHA encounters are still detected and scored.

Public deployments require `CLANKER_LIVE_RUNS=true` in addition to both API
keys. `CLANKER_DAILY_RUN_LIMIT` defaults to six completed runs per UTC day so a
viral post cannot turn into an unbounded credit bill. On Vercel, run evidence is
stored in a connected private Blob store; local development keeps using JSONL.

## Synthetic monitoring

Three standardized mission packs ship with the project: `commerce-core`,
`saas-evaluation`, and `content-discovery`. Each pack contains three stable
missions so results remain comparable across deployments.

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
CLANKER_MODELS=gpt-5.4-mini,gpt-5.4 \
CLANKER_BROWSER_MODES=standard,stealth \
npm run monitor -- https://example.com saas-evaluation
```

That example runs 12 browser tasks, so use it deliberately. The default runs
one model × one browser mode × three missions. Domain reports group results by
model and browser mode and surface regression alerts with replay links.

The included `.github/workflows/clanker-monitor.yml` runs weekly only after
repository variable `CLANKER_MONITOR_URL` is configured. Add repository secrets
`SOLARI_API_KEY` and `OPENAI_API_KEY`; optionally set `CLANKER_MONITOR_PACK`.
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
