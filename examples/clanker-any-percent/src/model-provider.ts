import OpenAI from "openai"

import type { ModelProvider } from "./types.js"

export const GROQ_DEFAULT_MODEL = "qwen/qwen3.8-27b"
export const OPENAI_DEFAULT_MODEL = "gpt-5.4-mini"
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1"

type Environment = Record<string, string | undefined>

export function configuredProvider(environment: Environment = process.env): ModelProvider | undefined {
  if (environment.GROQ_API_KEY) return "groq"
  if (environment.CLANKER_ALLOW_OPENAI_FALLBACK === "true" && environment.OPENAI_API_KEY) return "openai"
  return undefined
}

export function defaultModel(provider: ModelProvider, environment: Environment = process.env): string {
  return provider === "groq"
    ? environment.GROQ_MODEL ?? GROQ_DEFAULT_MODEL
    : environment.OPENAI_MODEL ?? OPENAI_DEFAULT_MODEL
}

export function modelClient(provider: ModelProvider, environment: Environment = process.env): OpenAI {
  const apiKey = provider === "groq" ? environment.GROQ_API_KEY : environment.OPENAI_API_KEY
  if (!apiKey) throw new Error(`${provider.toUpperCase()}_API_KEY is missing.`)
  return new OpenAI({
    apiKey,
    ...(provider === "groq" ? { baseURL: GROQ_BASE_URL } : {}),
  })
}

export function resolveModel(modelOverride?: string, environment: Environment = process.env, providerOverride?: ModelProvider): {
  provider: ModelProvider
  model: string
  client: OpenAI
} {
  const provider = providerOverride ?? configuredProvider(environment)
  if (!provider) throw new Error("Live runs need SOLARI_API_KEY + GROQ_API_KEY. OpenAI fallback is disabled unless explicitly enabled.")
  return { provider, model: modelOverride ?? defaultModel(provider, environment), client: modelClient(provider, environment) }
}
