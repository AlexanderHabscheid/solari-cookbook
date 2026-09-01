import { randomBytes } from "node:crypto"

import { detectRegression, validateChallenge } from "./core.js"
import { getMissionPack } from "./mission-packs.js"
import { runChallenge } from "./runner.js"
import { allRuns, saveRun } from "./store.js"
import type { BrowserMode, RunOptions, SuiteResult } from "./types.js"

export async function runMissionPack(input: {
  url: string
  packId: string
  model?: string
  browserMode?: BrowserMode
  scheduled?: boolean
}): Promise<SuiteResult> {
  const pack = getMissionPack(input.packId)
  const suiteId = randomBytes(4).toString("hex")
  const model = input.model ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini"
  const browserMode = input.browserMode ?? "standard"
  const first = await validateChallenge({ url: input.url, goal: pack.missions[0] })
  const history = allRuns()
  const runs = []

  for (const goal of pack.missions) {
    const options: RunOptions = { model, browserMode, packId: pack.id, suiteId, scheduled: input.scheduled }
    const run = await runChallenge({ url: first.url, goal }, options)
    run.regression = detectRegression(run, history)
    await saveRun(run)
    runs.push(run)
    history.push(run)
  }

  const passed = runs.filter(({ passed }) => passed).length
  return {
    id: suiteId,
    host: new URL(first.url).hostname.replace(/^www\./, ""),
    pack,
    model,
    browserMode,
    completionRate: Math.round((passed / runs.length) * 100),
    alerts: runs.flatMap(({ regression }) => regression ? [regression] : []),
    runs,
  }
}
