import assert from "node:assert/strict"
import test from "node:test"

import { buildDomainReport, demoResult, detectRegression, isPrivateAddress, scoreRun } from "../src/core.js"
import { getMissionPack } from "../src/mission-packs.js"

test("blocks private address ranges", () => {
  for (const address of ["127.0.0.1", "10.0.0.4", "172.20.1.1", "192.168.1.1", "::1", "fd00::1"]) {
    assert.equal(isPrivateAddress(address), true, address)
  }
  assert.equal(isPrivateAddress("8.8.8.8"), false)
})

test("successful fast runs gain aura while failures lose it", () => {
  assert.deepEqual(scoreRun({ passed: true, timeMs: 10_000, actions: 3, redirects: 0, bossFights: 0 }), {
    status: "LOCKED IN",
    aura: 84,
    lastWords: "Zero hesitation. Generational clicking.",
  })
  const failed = scoreRun({ passed: false, timeMs: 20_000, actions: 6, redirects: 1, bossFights: 1 })
  assert.equal(failed.status, "COOKED")
  assert.ok(failed.aura < 0)
})

test("builds an evidence-backed domain readiness report", () => {
  const runs = [
    { ...demoResult, isDemo: false, id: "00000001", createdAt: "2026-01-01T00:00:00Z", passed: false, failureCategory: "navigation" as const, goal: "Find returns", timeMs: 30_000 },
    { ...demoResult, isDemo: false, id: "00000002", createdAt: "2026-01-02T00:00:00Z", passed: false, failureCategory: "navigation" as const, goal: "Find returns", timeMs: 25_000 },
    { ...demoResult, isDemo: false, id: "00000003", createdAt: "2026-01-03T00:00:00Z", passed: true, timeMs: 10_000 },
    { ...demoResult, isDemo: false, id: "00000004", createdAt: "2026-01-04T00:00:00Z", passed: true, timeMs: 20_000 },
  ]
  const report = buildDomainReport("www.ikea.com", runs)

  assert.equal(report.completionRate, 50)
  assert.equal(report.isPreview, false)
  assert.equal(report.medianTimeMs, 15_000)
  assert.equal(report.trendPoints, 100)
  assert.deepEqual(report.failureCategories, [{ category: "navigation", count: 2 }])
  assert.deepEqual(report.failedMissions, [{ goal: "Find returns", count: 2 }])
  assert.deepEqual(report.variants, [{ packId: "ad-hoc", model: "gpt-5.4-mini", browserMode: "standard", totalRuns: 4, completionRate: 50, medianTimeMs: 15_000 }])
  assert.equal(buildDomainReport("ikea.com", [demoResult]).isPreview, true)
})

test("standard packs and deterministic regression alerts need no model call", () => {
  assert.equal(getMissionPack("commerce-core").missions.length, 3)
  const baseline = { ...demoResult, isDemo: false, id: "baseline", createdAt: "2026-01-01T00:00:00Z", goal: "Find returns" }
  const cooked = { ...baseline, id: "current", createdAt: "2026-01-02T00:00:00Z", passed: false }
  assert.deepEqual(detectRegression(cooked, [baseline]), {
    kind: "success",
    previousRunId: "baseline",
    message: "Previously passed; now cooked.",
  })

  const history = [1, 2, 3].map((number) => ({ ...baseline, id: `fast-${number}`, createdAt: `2026-01-0${number}T00:00:00Z`, timeMs: 10_000 }))
  const slow = { ...baseline, id: "slow", createdAt: "2026-01-04T00:00:00Z", timeMs: 20_000 }
  assert.equal(detectRegression(slow, history)?.kind, "performance")
})
