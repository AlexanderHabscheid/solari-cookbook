import type { MissionPack } from "./types.js"

export const missionPacks: MissionPack[] = [
  {
    id: "commerce-core",
    name: "Commerce core",
    description: "Can an agent discover the policies and support paths that determine a purchase?",
    missions: [
      "Find and reach the returns or refund policy.",
      "Find and reach the shipping or delivery information.",
      "Find and reach the customer support or contact page.",
    ],
  },
  {
    id: "saas-evaluation",
    name: "SaaS evaluation",
    description: "Can an agent evaluate a software product without talking to sales?",
    missions: [
      "Find and reach the pricing page.",
      "Find and reach the API or developer documentation.",
      "Find and reach the security, trust, or privacy information.",
    ],
  },
  {
    id: "content-discovery",
    name: "Content discovery",
    description: "Can an agent understand and navigate a publisher's public information architecture?",
    missions: [
      "Find and open the newest published article or post.",
      "Find and reach the site's topic or category index.",
      "Find and reach the about, editorial, or contact page.",
    ],
  },
]

export function getMissionPack(id: string): MissionPack {
  const pack = missionPacks.find((candidate) => candidate.id === id)
  if (!pack) throw new Error("Unknown mission pack. Pick a standard map.")
  return pack
}
