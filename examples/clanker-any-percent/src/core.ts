import { lookup } from "node:dns/promises"
import { createHash } from "node:crypto"
import { isIP } from "node:net"

import type { BrowserMode, Challenge, DomainReport, FailureCategory, RegressionAlert, RunResult } from "./types.js"

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"])

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase()
  if (normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true
  }
  if (isIP(normalized) !== 4) return false

  const octets = normalized.split(".").map(Number)
  const [a, b] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b !== undefined && b >= 64 && b <= 127)
  )
}

export async function validateChallenge(value: unknown): Promise<Challenge> {
  if (!value || typeof value !== "object") throw new Error("Drop a URL and a mission, gang.")
  const record = value as Record<string, unknown>
  const goal = String(record.goal ?? "").trim()
  let url: URL

  try {
    url = new URL(String(record.url ?? "").trim())
  } catch {
    throw new Error("That URL is absolutely cooked.")
  }
  if (!(["http:", "https:"] as string[]).includes(url.protocol)) throw new Error("Only public http(s) sites enter the arena.")
  if (url.username || url.password) throw new Error("Credentials are banned from the arena.")
  if (goal.length < 8 || goal.length > 220) throw new Error("Mission must be 8–220 characters. Lock in.")

  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Private networks are not a speedrun category.")
  }
  if (isIP(hostname) && isPrivateAddress(hostname)) throw new Error("Private networks are not a speedrun category.")

  const addresses = await lookup(hostname, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("That host resolves somewhere the clanker is not allowed to go.")
  }

  url.hash = ""
  return { url: url.toString(), goal }
}

export function scoreRun(input: {
  passed: boolean
  timeMs: number
  actions: number
  redirects: number
  bossFights: number
}): Pick<RunResult, "status" | "aura" | "lastWords"> {
  const seconds = Math.ceil(input.timeMs / 1000)
  const penalties = seconds + input.actions * 2 + input.redirects * 4 + input.bossFights * 15
  const aura = input.passed ? Math.max(1, 100 - penalties) : -Math.min(99, 25 + penalties)
  const status = input.passed ? "LOCKED IN" : "COOKED"
  const lastWords = input.passed
    ? aura > 66
      ? "Zero hesitation. Generational clicking."
      : "Ugly run. Still counts. Mods approved it."
    : input.bossFights
      ? "A CAPTCHA touched grass on its behalf. Run invalid."
      : "Bro saw the navigation and folded instantly."
  return { status, aura, lastWords }
}

export function runId(challenge: Challenge): string {
  const digest = createHash("sha1").update(`${challenge.url}:${challenge.goal}:${Date.now()}`).digest("hex").slice(0, 8)
  return digest
}

const median = (values: number[]): number | null => {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
}

function failureCategory(run: RunResult): FailureCategory {
  if (run.failureCategory && run.failureCategory !== "none") return run.failureCategory
  if (run.bossFights) return "captcha"
  if (run.redirects >= 3) return "redirect"
  return "other"
}

const runModel = (run: RunResult) => run.model ?? "gpt-5.4-mini"
const runBrowserMode = (run: RunResult): BrowserMode => run.browserMode ?? "standard"

export function detectRegression(current: RunResult, history: RunResult[]): RegressionAlert | undefined {
  const comparable = history
    .filter((run) => run.host === current.host && run.goal === current.goal)
    .filter((run) => runModel(run) === runModel(current) && runBrowserMode(run) === runBrowserMode(current))
    .filter((run) => run.packId === current.packId)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))

  const previous = comparable[0]
  if (previous?.passed && !current.passed) {
    return { kind: "success", previousRunId: previous.id, message: "Previously passed; now cooked." }
  }

  const baseline = comparable.filter(({ passed }) => passed).slice(0, 5)
  const baselineMs = median(baseline.map(({ timeMs }) => timeMs))
  if (current.passed && baseline.length >= 3 && baselineMs !== null && current.timeMs > baselineMs * 1.5 && current.timeMs - baselineMs > 3_000) {
    return {
      kind: "performance",
      previousRunId: baseline[0]!.id,
      message: `Still passed, but ${(current.timeMs / baselineMs).toFixed(1)}× slower than its recent baseline.`,
    }
  }
}

export function buildDomainReport(host: string, input: RunResult[]): DomainReport {
  const normalizedHost = host.toLowerCase().replace(/^www\./, "")
  const runs = input
    .filter((run) => run.host.toLowerCase().replace(/^www\./, "") === normalizedHost)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  const passedRuns = runs.filter(({ passed }) => passed)
  const completionRate = runs.length ? Math.round((passedRuns.length / runs.length) * 100) : 0
  const counts = <T extends string>(values: T[]) => [...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<T, number>())]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count)

  let trendPoints: number | null = null
  if (runs.length >= 4) {
    const chronological = [...runs].reverse()
    const middle = Math.floor(chronological.length / 2)
    const rate = (group: RunResult[]) => (group.filter(({ passed }) => passed).length / group.length) * 100
    trendPoints = Math.round(rate(chronological.slice(middle)) - rate(chronological.slice(0, middle)))
  }

  const readinessLabel = completionRate >= 90
    ? "AGENT NATIVE"
    : completionRate >= 70
      ? "MOSTLY SENTIENT"
      : completionRate >= 40
        ? "NEEDS PATCHES"
        : "HUMANS ONLY"

  const monitoredRuns = runs.filter(({ packId }) => packId)
  const comparableRuns = monitoredRuns.length ? monitoredRuns : runs
  const variantGroups = new Map<string, RunResult[]>()
  for (const run of comparableRuns) {
    const key = `${run.packId ?? "ad-hoc"}\u0000${runModel(run)}\u0000${runBrowserMode(run)}`
    variantGroups.set(key, [...(variantGroups.get(key) ?? []), run])
  }
  const variants = [...variantGroups.values()].map((group) => {
    const passed = group.filter(({ passed }) => passed)
    return {
      packId: group[0]!.packId ?? "ad-hoc",
      model: runModel(group[0]!),
      browserMode: runBrowserMode(group[0]!),
      totalRuns: group.length,
      completionRate: Math.round((passed.length / group.length) * 100),
      medianTimeMs: median(passed.map(({ timeMs }) => timeMs)),
    }
  }).sort((left, right) => right.completionRate - left.completionRate || (left.medianTimeMs ?? Infinity) - (right.medianTimeMs ?? Infinity))

  return {
    host: normalizedHost,
    isPreview: runs.length > 0 && runs.every(({ isDemo }) => isDemo),
    totalRuns: runs.length,
    uniqueMissions: new Set(runs.map(({ goal }) => goal.toLowerCase())).size,
    passedRuns: passedRuns.length,
    completionRate,
    medianTimeMs: median(passedRuns.map(({ timeMs }) => timeMs)),
    medianActions: median(runs.map(({ actions }) => actions)),
    readinessLabel,
    trendPoints,
    failureCategories: counts(runs.filter(({ passed }) => !passed).map(failureCategory))
      .map(({ value: category, count }) => ({ category, count })),
    failedMissions: counts(runs.filter(({ passed }) => !passed).map(({ goal }) => goal))
      .map(({ value: goal, count }) => ({ goal, count })).slice(0, 5),
    variants,
    regressions: runs.filter((run) => run.regression).map((run) => ({ runId: run.id, goal: run.goal, alert: run.regression! })).slice(0, 10),
    runs: runs.slice(0, 12),
  }
}

export const demoResult: RunResult = {
  id: "de006700",
  createdAt: new Date().toISOString(),
  url: "https://www.ikea.com/us/en/",
  host: "ikea.com",
  goal: "Find the cheapest red chair and reach its product page.",
  status: "LOCKED IN",
  passed: true,
  timeMs: 18_420,
  actions: 7,
  redirects: 1,
  bossFights: 0,
  aura: 63,
  confidence: 94,
  failureCategory: "none",
  evidence: "Ended on a red chair product page with a visible $19.99 price after sorting matching results.",
  lastWords: "Ugly run. Still counts. Mods approved it.",
  sessionId: "brw_demo_clanker_locked_in",
  replayUrl: null,
  isDemo: true,
  model: "gpt-5.4-mini",
  browserMode: "standard",
  steps: [
    { number: 1, action: "click", reason: "Opened search", url: "https://www.ikea.com/us/en/" },
    { number: 2, action: "type", reason: "Searched red chair", url: "https://www.ikea.com/us/en/" },
    { number: 3, action: "press_enter", reason: "Sent it", url: "https://www.ikea.com/us/en/" },
    { number: 4, action: "click", reason: "Sorted low to high", url: "https://www.ikea.com/us/en/search/" },
  ],
}
