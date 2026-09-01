import { appendFile, mkdir, readFile } from "node:fs/promises"

import { BlobNotFoundError, get, list, put } from "@vercel/blob"

import type { RunResult } from "./types.js"

const dataDir = new URL("../data/", import.meta.url)
const dataFile = new URL("runs.jsonl", dataDir)
const blobPrefix = "clanker-runs/"
const runs = new Map<string, RunResult>()

const usesBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN)

function remember(run: RunResult): void {
  runs.set(run.id, run)
}

async function loadBlobRuns(): Promise<void> {
  let cursor: string | undefined
  do {
    const page = await list({ prefix: blobPrefix, cursor, limit: 1_000 })
    await Promise.all(page.blobs.filter(({ pathname }) => pathname.endsWith(".json")).map(async ({ url }) => {
      const result = await get(url, { access: "private", useCache: false })
      if (result?.statusCode !== 200) return
      remember(JSON.parse(await new Response(result.stream).text()) as RunResult)
    }))
    cursor = page.cursor
  } while (cursor)
}

export async function loadRuns(): Promise<void> {
  if (usesBlob()) {
    try {
      await loadBlobRuns()
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) throw error
    }
    return
  }

  await mkdir(dataDir, { recursive: true })
  try {
    const lines = (await readFile(dataFile, "utf8")).trim().split("\n").filter(Boolean)
    for (const line of lines) {
      const run = JSON.parse(line) as RunResult
      remember(run)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}

export async function saveRun(run: RunResult): Promise<void> {
  remember(run)
  if (usesBlob()) {
    const day = run.createdAt.slice(0, 10)
    await put(`${blobPrefix}${day}/${run.id}.json`, JSON.stringify(run), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
    })
    return
  }
  await appendFile(dataFile, `${JSON.stringify(run)}\n`, "utf8")
}

export async function dailyRunCount(day = new Date().toISOString().slice(0, 10)): Promise<number> {
  if (!usesBlob()) return [...runs.values()].filter(({ createdAt }) => createdAt.startsWith(day)).length
  const { blobs } = await list({ prefix: `${blobPrefix}${day}/`, limit: 1_000 })
  return blobs.length
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
