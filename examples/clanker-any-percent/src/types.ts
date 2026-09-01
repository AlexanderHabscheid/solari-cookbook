export type Challenge = {
  url: string
  goal: string
}

export type BrowserMode = "standard" | "stealth"

export type RunOptions = {
  model?: string
  browserMode?: BrowserMode
  packId?: string
  suiteId?: string
  scheduled?: boolean
}

export type ElementCandidate = {
  id: number
  tag: string
  text: string
  type: string
}

export type AgentAction = {
  kind: "click" | "type" | "press_enter" | "scroll" | "done" | "fail"
  target: number | null
  text: string | null
  reason: string
}

export type RunStep = {
  number: number
  action: AgentAction["kind"]
  reason: string
  url: string
}

export type FailureCategory = "none" | "navigation" | "missing_content" | "interaction" | "captcha" | "redirect" | "unsafe" | "other"

export type RegressionAlert = {
  kind: "success" | "performance"
  previousRunId: string
  message: string
}

export type RunResult = {
  id: string
  createdAt: string
  url: string
  host: string
  goal: string
  status: "LOCKED IN" | "COOKED"
  passed: boolean
  timeMs: number
  actions: number
  redirects: number
  bossFights: number
  aura: number
  confidence: number
  failureCategory: FailureCategory
  evidence: string
  lastWords: string
  sessionId: string
  replayUrl: string | null
  isDemo?: boolean
  model?: string
  browserMode?: BrowserMode
  packId?: string
  suiteId?: string
  scheduled?: boolean
  regression?: RegressionAlert
  steps: RunStep[]
}

export type MissionPack = {
  id: string
  name: string
  description: string
  missions: string[]
}

export type SuiteResult = {
  id: string
  host: string
  pack: MissionPack
  model: string
  browserMode: BrowserMode
  completionRate: number
  alerts: RegressionAlert[]
  runs: RunResult[]
}

export type DomainReport = {
  host: string
  isPreview: boolean
  totalRuns: number
  uniqueMissions: number
  passedRuns: number
  completionRate: number
  medianTimeMs: number | null
  medianActions: number | null
  readinessLabel: string
  trendPoints: number | null
  failureCategories: Array<{ category: string; count: number }>
  failedMissions: Array<{ goal: string; count: number }>
  variants: Array<{ packId: string; model: string; browserMode: BrowserMode; totalRuns: number; completionRate: number; medianTimeMs: number | null }>
  regressions: Array<{ runId: string; goal: string; alert: RegressionAlert }>
  runs: RunResult[]
}
