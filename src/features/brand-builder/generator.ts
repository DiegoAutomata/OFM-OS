import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { franc } from "franc-min";
import { z } from "zod";
import { readEnv } from "@/lib/env";
import { selectCanonicalExamples } from "./examples";
import { selectRelevantRules } from "./memory";
import { generateMockBrandPlaybook } from "./mock-generator";
import {
  brandDraftSchema,
  brandPlaybookSchema,
  brandStrategySchema,
  reviewedPlaybookSchema,
  type BrandPlaybook,
  type ModelIntake,
  type ModelProfile,
  type ReviewedPlaybook,
} from "./schemas";
import { selectApprovedMemory } from "./storage";

export const brandBuilderModel = "openai/gpt-5.5" as const;

export interface GenerationMetrics {
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number | null;
  responseTimeMs: number;
  stages?: Array<{
    name: "strategy" | "writing" | "review";
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number | null;
    responseTimeMs: number;
  }>;
}

interface StageResult<T> {
  object: T;
  metrics: GenerationMetrics;
}

export async function generateBrandPlaybook(intake: ModelIntake) {
  const apiKey = readEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    const output = brandPlaybookSchema.parse({
      ...generateMockBrandPlaybook(intake),
      modelName: intake.profile.name,
    });
    validateFinalPlaybook(intake.profile, output);
    return {
      output,
      provider: "mock",
      metrics: emptyMetrics(),
      warnings: ["OPENROUTER_API_KEY is not configured; returned deterministic mock output."],
    };
  }

  return generateWithGpt55(intake.profile, apiKey);
}

export async function generateQualityBenchmark(profile: ModelProfile) {
  const apiKey = readEnv("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for a real quality run.");
  return generateWithGpt55(profile, apiKey);
}

async function generateWithGpt55(profile: ModelProfile, apiKey: string) {
  const relevantRules = selectRelevantRules(profile);
  const qualityAnchors = selectCanonicalExamples(profile, 2).map((example) => ({
    model: example.input.name,
    input: example.input,
    approvedBio: example.bio,
    lesson: example.lesson,
  }));
  const approvedMemory = await selectApprovedMemory(profile, 4);

  const strategy = await runStage({
    apiKey,
    name: "strategy",
    schema: brandStrategySchema,
    temperature: 0.35,
    maxOutputTokens: 3_000,
    system: strategySystemPrompt(),
    prompt: JSON.stringify(
      { profile, relevantRules, qualityAnchors, approvedMemory },
      null,
      2,
    ),
  });

  const writing = await runStage({
    apiKey,
    name: "writing",
    schema: brandDraftSchema,
    temperature: 0.8,
    maxOutputTokens: 3_000,
    system: writingSystemPrompt(),
    prompt: JSON.stringify(
      {
        profile,
        strategy: strategy.object,
        relevantRules,
        qualityAnchors,
        approvedMemory,
      },
      null,
      2,
    ),
  });

  const review = await runStage({
    apiKey,
    name: "review",
    schema: reviewedPlaybookSchema,
    temperature: 0.25,
    maxOutputTokens: 5_000,
    system: reviewSystemPrompt(),
    prompt: JSON.stringify(
      {
        profile,
        strategy: strategy.object,
        drafts: writing.object,
        relevantRules,
        qualityAnchors,
        approvedMemory,
      },
      null,
      2,
    ),
  });

  const output = assemblePlaybook(profile.name, review.object);
  validateFinalPlaybook(profile, output);
  return {
    output,
    provider: brandBuilderModel,
    metrics: aggregateMetrics([
      ["strategy", strategy.metrics],
      ["writing", writing.metrics],
      ["review", review.metrics],
    ]),
    warnings: [],
  };
}

async function runStage<T>({
  apiKey,
  name,
  schema,
  system,
  prompt,
  temperature,
  maxOutputTokens,
}: {
  apiKey: string;
  name: "strategy" | "writing" | "review";
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
}): Promise<StageResult<T>> {
  const openrouter = createOpenRouter({ apiKey });
  const startedAt = performance.now();
  const result = await (async () => {
    try {
      return await generateObject({
        model: openrouter(brandBuilderModel),
        schema,
        schemaName: `${name}_brand_builder_output`,
        schemaDescription: "Return only the JSON object that satisfies this schema.",
        output: "object",
        system,
        prompt,
        temperature,
        maxOutputTokens,
        maxRetries: 0,
        experimental_repairText: async ({ text }) => extractJsonObject(text),
      });
    } catch (error) {
      throw new Error(
        `GPT-5.5 ${name} stage failed: ${error instanceof Error ? error.message : "unknown provider error"}`,
      );
    }
  })();
  const responseTimeMs = performance.now() - startedAt;
  return {
    object: result.object,
    metrics: {
      attempts: 1,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      totalTokens: result.usage.totalTokens ?? 0,
      costUsd: readOpenRouterCost(result.providerMetadata),
      responseTimeMs,
      stages: [
        {
          name,
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0,
          costUsd: readOpenRouterCost(result.providerMetadata),
          responseTimeMs,
        },
      ],
    },
  };
}

export function assemblePlaybook(profileName: string, reviewed: ReviewedPlaybook) {
  const routes = reviewed.routes.map(({ qualityScores, ...route }) => {
    if (Object.values(qualityScores).some((score) => score < 8)) {
      throw new Error(`${route.routeId} did not pass the GPT-5.5 quality review.`);
    }
    return route;
  });
  const recommended = routes.find(
    (route) => route.routeId === reviewed.recommendedRouteId,
  );
  if (!recommended) throw new Error("The recommended route is missing from the review.");
  return brandPlaybookSchema.parse({
    outputVersion: "brand_builder_v1",
    modelName: profileName,
    stageNameSuggestions: reviewed.stageNameSuggestions,
    routes,
    recommendedRouteId: reviewed.recommendedRouteId,
    finalBio: recommended.discoveryBio,
    brandVoice: reviewed.brandVoice,
    operatorNotes: reviewed.operatorNotes,
    qualityWarnings: reviewed.qualityWarnings,
  });
}

export function attachModelName(
  profileName: string,
  generated: Omit<BrandPlaybook, "modelName">,
) {
  return brandPlaybookSchema.parse({ ...generated, modelName: profileName });
}

export function validateFinalPlaybook(profile: ModelProfile, output: BrandPlaybook) {
  const failures: string[] = [];
  if (output.modelName !== profile.name) failures.push("modelName does not match the profile");
  const routeIds = output.routes.map((route) => route.routeId);
  if (new Set(routeIds).size !== 3) failures.push("route IDs are not unique");
  if (output.qualityWarnings.length > 0) failures.push("the review returned quality warnings");

  for (const route of output.routes) {
    const bio = route.discoveryBio;
    if (!isEnglishText(bio)) failures.push(`${route.routeId} is not English`);
    if (!/\b(i|im|i'm|my|me)\b/i.test(bio)) {
      failures.push(`${route.routeId} is not written in first person`);
    }
    if (!/\b(dm|message|text|tell me|say hi|come say hi|send me)\b/i.test(bio)) {
      failures.push(`${route.routeId} has no conversation CTA`);
    }
    if (countEmojis(bio) > 3) failures.push(`${route.routeId} uses more than 3 emojis`);
    if (mentionsPublicBoundary(bio)) {
      failures.push(`${route.routeId} announces a private content boundary`);
    }
  }

  for (let left = 0; left < output.routes.length; left += 1) {
    for (let right = left + 1; right < output.routes.length; right += 1) {
      if (textSimilarity(output.routes[left].discoveryBio, output.routes[right].discoveryBio) > 0.72) {
        failures.push(`route_${left + 1} and route_${right + 1} are too similar`);
      }
      if (textSimilarity(lastSentence(output.routes[left].discoveryBio), lastSentence(output.routes[right].discoveryBio)) > 0.7) {
        failures.push(`route_${left + 1} and route_${right + 1} reuse the same CTA`);
      }
    }
  }

  const selected = output.routes.find((route) => route.routeId === output.recommendedRouteId);
  if (!selected || output.finalBio !== selected.discoveryBio) {
    failures.push("finalBio does not match the recommended route");
  }

  if (failures.length > 0) {
    throw new Error(`GPT-5.5 quality validation failed: ${failures.join("; ")}.`);
  }
  return output;
}

export function isEnglishText(text: string) {
  const normalized = text.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length >= 60 && franc(normalized, { minLength: 60 }) === "eng";
}

function strategySystemPrompt() {
  return [
    "You are the senior brand strategist for early-stage adult creators.",
    "Return only valid JSON. No markdown, no commentary, no prose before or after the JSON object.",
    "Plan exactly three genuinely different discovery-first routes for the supplied verified adult profile.",
    "Each route needs one fantasy engine: one relatable scene, one emotional or sexual tension, and no more than two useful profile details.",
    "Classify everything else as ignored texture. Do not force the intake into the bio.",
    "Personality and niches must be demonstrated through behavior, never announced as labels.",
    "Forbidden content is an internal hard constraint and must never become public copy.",
    "This is non-graphic public profile copy. Do not describe explicit sex acts.",
    "Only use specific power, humiliation, sissy or degradation themes when explicitly confirmed.",
    "The three scenes and CTA mechanics must not overlap.",
  ].join("\n");
}

function writingSystemPrompt() {
  return [
    "You are a specialist creator bio writer. Write exactly three English bios from the approved strategies.",
    "Return only valid JSON. No markdown, no commentary, no prose before or after the JSON object.",
    "Every bio must contain 55-90 words, use first person, include no more than three character-appropriate emojis, and end with a short in-character invitation to DM or message.",
    "Sound like a real creator texting: casual, imperfect and immediate. Adapt slang to the person instead of forcing the same im/u/lol voice on everyone.",
    "Never list traits, body parts, clothes, hobbies, niches or assets. Show the character inside one scene.",
    "Do not narrate visible appearance unless a distinctive trait becomes a joke or consequence.",
    "Avoid agency language, poetic mystery, third-person labels, generic selling and AI phrases such as 'a little dangerous', 'by day/by night', or 'the girl your friends warned you about'.",
    "Do not state content restrictions. Do not copy an example sentence or CTA.",
    "Keep the public bio suggestive but non-graphic; do not describe explicit sex acts.",
    "Every sentence must create the scene, increase tension, reveal behavior or prompt the message.",
  ].join("\n");
}

function reviewSystemPrompt() {
  return [
    "You are the final editor and quality gate. Return a complete three-route Brand Builder playbook in English.",
    "Return only valid JSON. No markdown, no commentary, no prose before or after the JSON object.",
    "Independently score every route for natural voice, curiosity, sexual tension, focus, CTA and boundaries.",
    "If any dimension would score below 8, rewrite that route now and score the rewritten version only.",
    "All three routes must be publishable, distinct and 55-90 words. Do not merely choose one good route and leave two weaker routes.",
    "The creator must speak in first person. Keep one central scene, imply personality, use at most two source details and finish with a short CTA that continues the scene.",
    "Remove trait inventories, visible-body descriptions, forbidden-content statements, empty mystery, AI cliches and repeated trans reveal or domination formulas.",
    "Use confirmed adult niches without contradicting boundaries. Never infer an unconfirmed extreme fetish.",
    "Keep every final bio suggestive but non-graphic so it is suitable for a public profile.",
    "Set qualityWarnings to an empty array only after every route satisfies every requirement.",
  ].join("\n");
}

function aggregateMetrics(
  stages: Array<["strategy" | "writing" | "review", GenerationMetrics]>,
): GenerationMetrics {
  const stageMetrics = stages.map(([name, metrics]) => ({
    name,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    totalTokens: metrics.totalTokens,
    costUsd: metrics.costUsd,
    responseTimeMs: metrics.responseTimeMs,
  }));
  const costs = stageMetrics.map((stage) => stage.costUsd);
  return {
    attempts: stages.length,
    inputTokens: stageMetrics.reduce((sum, stage) => sum + stage.inputTokens, 0),
    outputTokens: stageMetrics.reduce((sum, stage) => sum + stage.outputTokens, 0),
    totalTokens: stageMetrics.reduce((sum, stage) => sum + stage.totalTokens, 0),
    costUsd: costs.every((cost) => cost !== null)
      ? costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0)
      : null,
    responseTimeMs: stageMetrics.reduce((sum, stage) => sum + stage.responseTimeMs, 0),
    stages: stageMetrics,
  };
}

function emptyMetrics(): GenerationMetrics {
  return {
    attempts: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: null,
    responseTimeMs: 0,
    stages: [],
  };
}

function readOpenRouterCost(metadata: unknown): number | null {
  const cost = (
    metadata as { openrouter?: { usage?: { cost?: unknown } } }
  )?.openrouter?.usage?.cost;
  return typeof cost === "number" && Number.isFinite(cost) ? cost : null;
}

function countEmojis(text: string) {
  return text.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
}

function mentionsPublicBoundary(text: string) {
  return /\b(i (do not|don't|wont|won't) do|no (content|anal|bdsm|piss|outdoor nudity|other people)|nothing with other people)\b/i.test(
    text,
  );
}

function textSimilarity(left: string, right: string) {
  const leftTokens = contentTokens(left);
  const rightTokens = contentTokens(right);
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function contentTokens(text: string) {
  const stopWords = new Set(["the", "and", "that", "this", "with", "your", "you", "im", "for", "but", "when", "like"]);
  return new Set(
    (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (token) => token.length > 2 && !stopWords.has(token),
    ),
  );
}

function lastSentence(text: string) {
  return text.split(/[.!?]+/).filter((part) => part.trim()).at(-1)?.trim() ?? text;
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const source = fenced || text.trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const candidate = source.slice(start, end + 1);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}
