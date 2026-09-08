const parsePositive = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const DEFAULT_DAILY_BUDGET_USD = 5
export const DEFAULT_ESTIMATED_RUN_COST_USD = 0.25

export function dailyBudgetUsd(environment: Record<string, string | undefined> = process.env): number {
  return parsePositive(environment.CLANKER_DAILY_BUDGET_USD, DEFAULT_DAILY_BUDGET_USD)
}

export function estimatedRunCostUsd(environment: Record<string, string | undefined> = process.env): number {
  return parsePositive(environment.CLANKER_ESTIMATED_RUN_COST_USD, DEFAULT_ESTIMATED_RUN_COST_USD)
}

export function budgetedDailyRunLimit(configuredLimit: number, environment: Record<string, string | undefined> = process.env): number {
  const budgetLimit = Math.floor(dailyBudgetUsd(environment) / estimatedRunCostUsd(environment))
  return Math.max(0, Math.min(configuredLimit, budgetLimit))
}
