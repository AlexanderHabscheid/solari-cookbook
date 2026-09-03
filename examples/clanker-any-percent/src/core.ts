import { lookup } from "node:dns/promises"
import { createHash } from "node:crypto"
import { isIP } from "node:net"

import type { BrowserMode, Challenge, DomainReport, FailureCategory, RegressionAlert, RunResult, Verification } from "./types.js"

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"])
export const EVALUATION_VERSION = "text-path-frame-v2-12steps"

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

  if (record.success !== undefined && (!record.success || typeof record.success !== "object" || Array.isArray(record.success))) {
    throw new Error("Success receipts must be an object with text or URL criteria.")
  }
  const successRecord = record.success && typeof record.success === "object"
    ? record.success as Record<string, unknown>
    : undefined
  for (const field of ["visibleText", "urlContains", "frameTitle"]) {
    if (successRecord?.[field] !== undefined && typeof successRecord[field] !== "string") throw new Error("Success criteria must be strings.")
  }
  const visibleText = String(successRecord?.visibleText ?? "").trim().replace(/\s+/g, " ")
  const urlContains = String(successRecord?.urlContains ?? "").trim()
  const frameTitle = String(successRecord?.frameTitle ?? "").trim().replace(/\s+/g, " ")
  if (visibleText.length > 160 || urlContains.length > 160 || frameTitle.length > 160) throw new Error("Success receipts must be 160 characters or fewer.")
  if ([visibleText, urlContains, frameTitle].some((criterion) => criterion && criterion.length < 2)) {
    throw new Error("Success receipts need at least two characters.")
  }

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
  const success = visibleText || urlContains || frameTitle
    ? { ...(visibleText && { visibleText }), ...(urlContains && { urlContains }), ...(frameTitle && { frameTitle }) }
    : undefined
  return { url: url.toString(), goal, success }
}

export function journeyId(challenge: Challenge): string | undefined {
  if (!challenge.success?.visibleText && !challenge.success?.urlContains && !challenge.success?.frameTitle) return undefined
  return createHash("sha256").update(JSON.stringify({
    url: challenge.url,
    goal: challenge.goal.toLowerCase(),
    visibleText: challenge.success.visibleText?.toLowerCase(),
    urlContains: challenge.success.urlContains,
    frameTitle: challenge.success.frameTitle?.toLowerCase(),
  })).digest("hex").slice(0, 10)
}

export function verifyOutcome(challenge: Challenge, state: { url: string; text: string; frameTitles?: string[] }): Verification | undefined {
  if (!challenge.success?.visibleText && !challenge.success?.urlContains && !challenge.success?.frameTitle) return undefined
  const pageText = state.text.replace(/\s+/g, " ").toLowerCase()
  const parsedUrl = new URL(state.url)
  const finalUrl = parsedUrl.pathname + parsedUrl.search
  const checks = [
    ...(challenge.success.visibleText ? [{
      kind: "visible_text" as const,
      expected: challenge.success.visibleText,
      passed: pageText.includes(challenge.success.visibleText.toLowerCase()),
    }] : []),
    ...(challenge.success.urlContains ? [{
      kind: "final_url" as const,
      expected: challenge.success.urlContains,
      passed: finalUrl.includes(challenge.success.urlContains),
    }] : []),
    ...(challenge.success.frameTitle ? [{
      kind: "frame_title" as const,
      expected: challenge.success.frameTitle,
      passed: (state.frameTitles ?? []).some((title) => title.toLowerCase().includes(challenge.success!.frameTitle!.toLowerCase())),
    }] : []),
  ]
  return { method: "deterministic", checks, observedUrl: state.url }
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
const runContract = (run: RunResult) => run.contractId ?? createHash("sha256").update(JSON.stringify([run.url, run.goal])).digest("hex").slice(0, 10)
const cohortKey = (run: RunResult) => JSON.stringify([runContract(run), runModel(run), runBrowserMode(run), run.evaluationVersion ?? "legacy", run.packId ?? null, run.verification?.method ?? "ai_judge"])

export function detectRegression(current: RunResult, history: RunResult[]): RegressionAlert | undefined {
  const comparable = history
    .filter((run) => run.host === current.host && run.goal === current.goal)
    .filter((run) => runModel(run) === runModel(current) && runBrowserMode(run) === runBrowserMode(current))
    .filter((run) => run.packId === current.packId)
    .filter((run) => run.contractId === current.contractId)
    .filter((run) => run.url === current.url && run.evaluationVersion === current.evaluationVersion)
    .filter((run) => !run.isDemo && Date.parse(run.createdAt) < Date.parse(current.createdAt))
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
  const matching = input
    .filter((run) => run.host.toLowerCase().replace(/^www\./, "") === normalizedHost)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  const runs = matching.some((run) => !run.isDemo) ? matching.filter((run) => !run.isDemo) : matching
  const verified = runs.filter(({ verification }) => verification?.method === "deterministic")
  const aiJudged = runs.filter(({ verification }) => !verification || verification.method === "ai_judge")
  const scoreRuns = verified.length ? verified : aiJudged
  const passedRuns = scoreRuns.filter(({ passed }) => passed)
  const completionRate = scoreRuns.length ? Math.round((passedRuns.length / scoreRuns.length) * 100) : 0
  const scoreBasis = verified.length ? "deterministic" as const : "ai_judge" as const
  const counts = <T extends string>(values: T[]) => [...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<T, number>())]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count)

  let trendPoints: number | null = null
  if (scoreRuns.length >= 4 && new Set(scoreRuns.map(cohortKey)).size === 1) {
    const chronological = [...scoreRuns].reverse()
    const middle = Math.floor(chronological.length / 2)
    const rate = (group: RunResult[]) => (group.filter(({ passed }) => passed).length / group.length) * 100
    trendPoints = Math.round(rate(chronological.slice(middle)) - rate(chronological.slice(0, middle)))
  }

  const monitoredRuns = scoreRuns.filter(({ packId }) => packId)
  const comparableRuns = monitoredRuns.length ? monitoredRuns : scoreRuns
  const variantGroups = new Map<string, RunResult[]>()
  for (const run of comparableRuns) {
    const key = cohortKey(run)
    variantGroups.set(key, [...(variantGroups.get(key) ?? []), run])
  }
  const variants = [...variantGroups.values()].map((group) => {
    const passed = group.filter(({ passed }) => passed)
    return {
      packId: group[0]!.packId ?? "ad-hoc",
      contractId: runContract(group[0]!),
      evaluationVersion: group[0]!.evaluationVersion ?? "legacy",
      model: runModel(group[0]!),
      browserMode: runBrowserMode(group[0]!),
      totalRuns: group.length,
      completionRate: Math.round((passed.length / group.length) * 100),
      medianTimeMs: median(passed.map(({ timeMs }) => timeMs)),
    }
  }).sort((left, right) => right.completionRate - left.completionRate || (left.medianTimeMs ?? Infinity) - (right.medianTimeMs ?? Infinity))

  const journeyGroups = new Map<string, RunResult[]>()
  for (const run of runs) {
    const key = cohortKey(run)
    journeyGroups.set(key, [...(journeyGroups.get(key) ?? []), run])
  }
  const journeys = [...journeyGroups.values()].map((group) => {
    const passed = group.filter(({ passed }) => passed)
    return {
      contractId: runContract(group[0]!),
      model: runModel(group[0]!),
      browserMode: runBrowserMode(group[0]!),
      evaluationVersion: group[0]!.evaluationVersion ?? "legacy",
      latestRunId: group[0]!.id,
      goal: group[0]!.goal,
      method: group[0]!.verification?.method ?? "ai_judge" as const,
      totalRuns: group.length,
      passedRuns: passed.length,
      completionRate: Math.round((passed.length / group.length) * 100),
      medianTimeMs: median(passed.map(({ timeMs }) => timeMs)),
    }
  }).sort((left, right) => Number(right.method === "deterministic") - Number(left.method === "deterministic") || right.totalRuns - left.totalRuns)

  const hasRepeatedVerifiedJourney = journeys.some(({ method, totalRuns }) => method === "deterministic" && totalRuns >= 3)
  const readinessLabel = runs.length === 0
    ? "NO RECEIPTS"
    : scoreBasis === "ai_judge"
      ? "AI-JUDGED ONLY"
      : !hasRepeatedVerifiedJourney
        ? "NEEDS 3X REPEAT"
        : "REPEATED CHECKS"

  return {
    host: normalizedHost,
    isPreview: runs.length > 0 && runs.every(({ isDemo }) => isDemo),
    totalRuns: runs.length,
    uniqueMissions: new Set(runs.map(({ goal }) => goal.toLowerCase())).size,
    passedRuns: passedRuns.length,
    verifiedRuns: verified.length,
    aiJudgedRuns: aiJudged.length,
    scoreBasis,
    completionRate,
    medianTimeMs: median(passedRuns.map(({ timeMs }) => timeMs)),
    medianActions: median(runs.map(({ actions }) => actions)),
    readinessLabel,
    trendPoints,
    failureCategories: counts(scoreRuns.filter(({ passed }) => !passed).map(failureCategory))
      .map(({ value: category, count }) => ({ category, count })),
    failedMissions: counts(scoreRuns.filter(({ passed }) => !passed).map(({ goal }) => goal))
      .map(({ value: goal, count }) => ({ goal, count })).slice(0, 5),
    variants,
    regressions: runs.filter((run) => run.regression).map((run) => ({ runId: run.id, goal: run.goal, alert: run.regression! })).slice(0, 10),
    journeys,
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
  contractId: "demo00cafe",
  success: { visibleText: "$19.99", urlContains: "/product/" },
  verification: {
    method: "deterministic",
    checks: [
      { kind: "visible_text", expected: "$19.99", passed: true },
      { kind: "final_url", expected: "/product/", passed: true },
    ],
  },
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
