import { loadRuns } from "./store.js"
import { getMissionPack, missionPacks } from "./mission-packs.js"
import { runMissionPack } from "./monitor.js"
import type { BrowserMode } from "./types.js"

const [url, packId] = process.argv.slice(2)
if (!url || !packId) {
  console.error(`Usage: npm run monitor -- <url> <pack>\nPacks: ${missionPacks.map(({ id }) => id).join(", ")}`)
  process.exit(1)
}

const models = (process.env.CLANKER_MODELS ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini").split(",").map((value) => value.trim()).filter(Boolean)
const modes = (process.env.CLANKER_BROWSER_MODES ?? "standard").split(",").map((value) => value.trim())
if (models.length > 3 || modes.length > 2 || modes.some((mode) => !["standard", "stealth"].includes(mode))) {
  throw new Error("Monitor allows at most 3 models and the standard/stealth browser modes.")
}

if (process.env.CLANKER_DRY_RUN === "true") {
  const pack = getMissionPack(packId)
  console.log(JSON.stringify({ url: new URL(url).toString(), pack, models, browserModes: modes, estimatedRuns: pack.missions.length * models.length * modes.length }, null, 2))
  process.exit(0)
}

await loadRuns()
const suites = []
for (const model of models) {
  for (const browserMode of modes as BrowserMode[]) {
    console.error(`Running ${packId} on ${url} with ${model} + Solari ${browserMode}...`)
    suites.push(await runMissionPack({ url, packId, model, browserMode, scheduled: true }))
  }
}

const alerts = suites.flatMap(({ alerts }) => alerts)
console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  url,
  packId,
  variants: suites.map(({ id, model, browserMode, completionRate, runs }) => ({
    id,
    model,
    browserMode,
    completionRate,
    runs: runs.map(({ id: runId, goal, passed, timeMs, replayUrl, regression }) => ({ runId, goal, passed, timeMs, replayUrl, regression })),
  })),
  alerts,
}, null, 2))

process.exitCode = alerts.length ? 2 : 0
