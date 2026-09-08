import assert from "node:assert/strict"
import test from "node:test"

import { configuredProvider, defaultModel, GROQ_BASE_URL, GROQ_DEFAULT_MODEL, modelClient, OPENAI_DEFAULT_MODEL, resolveModel } from "../src/model-provider.js"

test("Groq wins provider selection when both keys exist", () => {
  const environment = { GROQ_API_KEY: "groq-test", OPENAI_API_KEY: "openai-test" }
  assert.equal(configuredProvider(environment), "groq")
  assert.equal(defaultModel("groq", environment), GROQ_DEFAULT_MODEL)
  assert.equal(resolveModel(undefined, environment, "groq").model, GROQ_DEFAULT_MODEL)
  assert.equal(resolveModel(undefined, environment, "groq").client.baseURL, GROQ_BASE_URL)
})

test("OpenAI remains an explicit fallback", () => {
  const environment = { OPENAI_API_KEY: "openai-test", CLANKER_ALLOW_OPENAI_FALLBACK: "true" }
  assert.equal(configuredProvider(environment), "openai")
  assert.equal(defaultModel("openai", environment), OPENAI_DEFAULT_MODEL)
  assert.equal(modelClient("openai", environment).baseURL, "https://api.openai.com/v1")
})

test("an OpenAI key alone cannot spend credits", () => {
  assert.equal(configuredProvider({ OPENAI_API_KEY: "openai-test" }), undefined)
})
