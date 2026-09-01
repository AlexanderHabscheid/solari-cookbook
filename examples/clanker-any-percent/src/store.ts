import { appendFile, mkdir, readFile } from "node:fs/promises"

import type { RunResult } from "./types.js"

const dataDir = new URL("../data/", import.meta.url)
const dataFile = new URL("runs.jsonl", dataDir)
const runs = new Map<string, RunResult>()

export async function loadRuns(): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  try {
    const lines = (await readFile(dataFile, "utf8")).trim().split("\n").filter(Boolean)
    for (const line of lines) {
      const run = JSON.parse(line) as RunResult
      runs.set(run.id, run)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}

export async function saveRun(run: RunResult): Promise<void> {
  runs.set(run.id, run)
  await appendFile(dataFile, `${JSON.stringify(run)}\n`, "utf8")
}

export function getRun(id: string): RunResult | undefined {
  return runs.get(id)
}

export function runsForHost(host: string): RunResult[] {
  const normalized = host.toLowerCase().replace(/^www\./, "")
  return [...runs.values()].filter((run) => run.host.toLowerCase().replace(/^www\./, "") === normalized)
}

export function allRuns(): RunResult[] {
  return [...runs.values()]
}

export function leaderboard(): RunResult[] {
  return [...runs.values()]
    .filter(({ passed }) => passed)
    .sort((left, right) => left.timeMs - right.timeMs)
    .slice(0, 10)
}
