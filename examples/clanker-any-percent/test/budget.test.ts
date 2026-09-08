import assert from "node:assert/strict"
import test from "node:test"

import { budgetedDailyRunLimit, dailyBudgetUsd, estimatedRunCostUsd } from "../src/budget.js"

test("the default public budget is five dollars with a conservative reservation", () => {
  const environment = {}
  assert.equal(dailyBudgetUsd(environment), 5)
  assert.equal(estimatedRunCostUsd(environment), 0.25)
  assert.equal(budgetedDailyRunLimit(6, environment), 6)
})

test("a tighter configured budget lowers the public run ceiling", () => {
  const environment = { CLANKER_DAILY_BUDGET_USD: "1", CLANKER_ESTIMATED_RUN_COST_USD: "0.25" }
  assert.equal(budgetedDailyRunLimit(6, environment), 4)
})

test("a budget below one reserved run disables new public runs", () => {
  const environment = { CLANKER_DAILY_BUDGET_USD: "0.1", CLANKER_ESTIMATED_RUN_COST_USD: "0.25" }
  assert.equal(budgetedDailyRunLimit(6, environment), 0)
})
