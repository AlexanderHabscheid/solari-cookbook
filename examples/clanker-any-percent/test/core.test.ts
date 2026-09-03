import assert from "node:assert/strict"
import test from "node:test"

import { buildDomainReport, demoResult, detectRegression, isPrivateAddress, journeyId, scoreRun, validateChallenge, verifyOutcome } from "../src/core.js"
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

test("predeclared success contracts produce deterministic receipts", () => {
  const challenge = {
    url: "https://example.com/",
    goal: "Reach the pricing page.",
    success: { visibleText: "$49 / month", urlContains: "/pricing" },
  }
  const receipt = verifyOutcome(challenge, {
    url: "https://example.com/pricing?ref=nav",
    text: "Starter   $49 / month   Contact sales",
  })

  assert.equal(receipt?.method, "deterministic")
  assert.deepEqual(receipt?.checks.map(({ passed }) => passed), [true, true])
  assert.equal(journeyId(challenge)?.length, 10)
  assert.equal(verifyOutcome(challenge, { url: "https://example.com/", text: "Contact sales" })?.checks.every(({ passed }) => passed), false)
  assert.equal(verifyOutcome({ ...challenge, success: {} }, { url: challenge.url, text: "" }), undefined)
  assert.equal(receipt?.observedUrl, "https://example.com/pricing?ref=nav")
  assert.equal(verifyOutcome(challenge, { url: "https://example.com/#/pricing", text: "$49 / month" })?.checks[1]?.passed, false)
  assert.equal(verifyOutcome(challenge, { url: "https://example.com/Pricing", text: "$49 / month" })?.checks[1]?.passed, false)
  assert.notEqual(journeyId(challenge), journeyId({ ...challenge, success: { ...challenge.success, urlContains: "/Pricing" } }))
  assert.equal(verifyOutcome(challenge, { url: "https://example.com/pricing", text: "x".repeat(20_000) + " $49 / month" })?.checks[0]?.passed, true)
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
  assert.equal(report.scoreBasis, "deterministic")
  assert.equal(report.verifiedRuns, 4)
  assert.equal(report.aiJudgedRuns, 0)
  assert.equal(report.medianTimeMs, 15_000)
  assert.equal(report.trendPoints, 100)
  assert.deepEqual(report.failureCategories, [{ category: "navigation", count: 2 }])
  assert.deepEqual(report.failedMissions, [{ goal: "Find returns", count: 2 }])
  assert.deepEqual(report.variants, [{ packId: "ad-hoc", contractId: demoResult.contractId, evaluationVersion: "legacy", model: "gpt-5.4-mini", browserMode: "standard", totalRuns: 4, completionRate: 50, medianTimeMs: 15_000 }])
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
  assert.equal(detectRegression({ ...cooked, contractId: "changed-proof" }, [baseline]), undefined)
  assert.equal(detectRegression({ ...cooked, evaluationVersion: "v2" }, [baseline]), undefined)
  assert.equal(detectRegression(cooked, [{ ...baseline, isDemo: true }]), undefined)

  const history = [1, 2, 3].map((number) => ({ ...baseline, id: `fast-${number}`, createdAt: `2026-01-0${number}T00:00:00Z`, timeMs: 10_000 }))
  const slow = { ...baseline, id: "slow", createdAt: "2026-01-04T00:00:00Z", timeMs: 20_000 }
  assert.equal(detectRegression(slow, history)?.kind, "performance")
})

test("readiness labels require three repeats of one deterministic contract", () => {
  const oneOffs = [1, 2, 3].map((number) => ({ ...demoResult, isDemo: false, id: `one-${number}`, contractId: `contract-${number}` }))
  assert.equal(buildDomainReport("ikea.com", oneOffs).readinessLabel, "NEEDS 3X REPEAT")
  const repeated = oneOffs.map((run) => ({ ...run, contractId: "same-contract" }))
  assert.equal(buildDomainReport("ikea.com", repeated).readinessLabel, "REPEATED CHECKS")
  const differentModels = repeated.map((run, index) => ({ ...run, model: `model-${index}` }))
  assert.equal(buildDomainReport("ikea.com", differentModels).readinessLabel, "NEEDS 3X REPEAT")
  assert.equal(buildDomainReport("ikea.com", differentModels).journeys.length, 3)
  assert.equal(buildDomainReport("ikea.com", []).readinessLabel, "NO RECEIPTS")
})

test("reports exclude demo and AI-judged data from rule-checked rates and mixed trends", () => {
  const checked = { ...demoResult, isDemo: false, passed: false, id: "checked" }
  const judged = { ...demoResult, isDemo: false, id: "judged", contractId: undefined, verification: undefined }
  const report = buildDomainReport("ikea.com", [demoResult, checked, judged])
  assert.equal(report.totalRuns, 2)
  assert.equal(report.completionRate, 0)
  assert.equal(report.aiJudgedRuns, 1)
  const mixed = [1, 2, 3, 4].map((n) => ({ ...checked, id: `mixed-${n}`, contractId: `contract-${n}` }))
  assert.equal(buildDomainReport("ikea.com", mixed).trendPoints, null)
})

test("malformed contracts are rejected before DNS or paid execution", async () => {
  for (const success of [[], "pricing", null, { visibleText: 42 }, { urlContains: "/" }, { visibleText: "x".repeat(161) }]) {
    await assert.rejects(validateChallenge({ url: "https://example.com/", goal: "Find the pricing page", success }), /Success/)
  }
})
