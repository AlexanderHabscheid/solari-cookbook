import { readFile } from "node:fs/promises"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"

import { buildDomainReport, demoResult, detectRegression, validateChallenge } from "./core.js"
import { missionPacks } from "./mission-packs.js"
import { allRuns, dailyRunCount, getRun, leaderboard, loadRuns, runsForHost, saveRun } from "./store.js"
import type { DomainReport, RunResult } from "./types.js"

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8")
const port = Number(process.env.PORT ?? 3000)
let running = false

const liveRunsEnabled = process.env.CLANKER_LIVE_RUNS === "true"
  && Boolean(process.env.SOLARI_API_KEY)
  && Boolean(process.env.OPENAI_API_KEY)
const configuredDailyRunLimit = Number(process.env.CLANKER_DAILY_RUN_LIMIT ?? 6)
const dailyRunLimit = Number.isFinite(configuredDailyRunLimit)
  ? Math.max(1, Math.min(100, Math.floor(configuredDailyRunLimit)))
  : 6

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  })
  response.end(JSON.stringify(value))
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character)
}

function reportFor(host: string): DomainReport {
  const runs = runsForHost(host)
  if (!runs.length && host.toLowerCase().replace(/^www\./, "") === demoResult.host) runs.push(demoResult)
  return buildDomainReport(host, runs)
}

function html(response: ServerResponse, run?: RunResult, report?: DomainReport): void {
  const title = report
    ? `${report.host} Agent Readiness${report.isPreview ? " Preview" : `: ${report.completionRate}%`}`
    : run ? `${run.status}: ${run.host} ANY%` : "CLANKER ANY%"
  const description = report
    ? report.isPreview
      ? `Demo Agent Readiness Report for ${report.host} · replace with live, replayable runs.`
      : `${report.passedRuns}/${report.totalRuns} missions completed · ${report.readinessLabel} · replayable agent UX evidence.`
    : run
    ? `${(run.timeMs / 1_000).toFixed(2)}s · ${run.aura > 0 ? "+" : ""}${run.aura} aura · ${run.goal}`
    : "Make an AI clanker speedrun any website. Watch the replay. Farm aura."
  const shareMeta = [
    `<meta property="og:title" content="${escapeAttribute(title)}">`,
    `<meta property="og:description" content="${escapeAttribute(description)}">`,
    '<meta property="og:type" content="website">',
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escapeAttribute(title)}">`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}">`,
  ].join("\n  ")
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
    "x-content-type-options": "nosniff",
  })
  response.end(page.replace("<!-- SHARE_META -->", shareMeta).replace("<title>CLANKER ANY%</title>", `<title>${escapeAttribute(title)}</title>`))
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > 8_192) throw new Error("Mission essay detected. Nobody is reading all that.")
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://local").pathname
  if (/^\/(?:r|d|api\/(?:leaderboard|domains|runs))(?:\/|$)/.test(path)) await loadRuns()
  if (request.method === "GET" && path === "/") {
    html(response)
    return
  }
  if (request.method === "GET" && /^\/r\/[a-f0-9]{8}$/.test(path)) {
    const id = path.slice("/r/".length)
    html(response, id === demoResult.id ? demoResult : getRun(id))
    return
  }
  if (request.method === "GET" && path.startsWith("/d/")) {
    const host = path.slice("/d/".length).toLowerCase()
    if (!/^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/.test(host)) {
      json(response, 400, { error: "That domain report is cooked." })
      return
    }
    html(response, undefined, reportFor(host))
    return
  }
  if (request.method === "GET" && path === "/api/demo") {
    json(response, 200, demoResult)
    return
  }
  if (request.method === "GET" && path === "/api/leaderboard") {
    json(response, 200, leaderboard())
    return
  }
  if (request.method === "GET" && path === "/api/packs") {
    json(response, 200, missionPacks)
    return
  }
  if (request.method === "GET" && path === "/api/config") {
    json(response, 200, { liveRunsEnabled, dailyRunLimit })
    return
  }
  if (request.method === "GET" && path.startsWith("/api/domains/")) {
    const host = path.slice("/api/domains/".length).toLowerCase()
    if (!/^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/.test(host)) {
      json(response, 400, { error: "That domain report is cooked." })
      return
    }
    json(response, 200, reportFor(host))
    return
  }
  if (request.method === "GET" && path.startsWith("/api/runs/")) {
    const id = path.slice("/api/runs/".length)
    const run = id === demoResult.id ? demoResult : getRun(id)
    json(response, run ? 200 : 404, run ?? { error: "Run got memory-holed." })
    return
  }
  if (request.method !== "POST" || path !== "/api/runs") {
    json(response, 404, { error: "Wrong map, lil bro." })
    return
  }
  if (running) {
    json(response, 429, { error: "One clanker is already fighting for its life. Queue diff." })
    return
  }
  if (!liveRunsEnabled) {
    json(response, 503, { error: "Live runs are locked while the deployment keys rotate. The free replay lab still works." })
    return
  }

  running = true
  try {
    if (await dailyRunCount() >= dailyRunLimit) {
      json(response, 429, { error: "Today's public credit budget got cooked. Replays and reports are still free." })
      return
    }
    const challenge = await validateChallenge(await readJson(request))
    const { runChallenge } = await import("./runner.js")
    const result = await runChallenge(challenge)
    result.regression = detectRegression(result, allRuns())
    await saveRun(result)
    json(response, 200, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catastrophic skill issue."
    json(response, 400, { error: message })
  } finally {
    running = false
  }
})

server.listen(port, () => console.log(`CLANKER ANY% spawned at http://localhost:${port}`))
