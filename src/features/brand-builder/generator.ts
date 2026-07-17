import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, generateText } from "ai";
import { franc } from "franc-min";
import { z } from "zod";
import { readEnv } from "@/lib/env";
import { approvedStylePrinciples, selectCanonicalExamples } from "./examples";
import { selectRelevantRules } from "./memory";
import { generateMockBrandPlaybook } from "./mock-generator";
import {
  brandDraftSchema,
  brandPlaybookSchema,
  brandStrategySchema,
  reviewedPlaybookSchema,
  type BrandPlaybook,
  type BrandDraft,
  type BrandStrategy,
  type ModelIntake,
  type ModelProfile,
  type ReviewedPlaybook,
} from "./schemas";
import { selectApprovedMemory } from "./storage";

export const supportedBrandBuilderModels = [
  "openai/gpt-5.5",
  "openai/gpt-5.6-terra",
] as const;

export type BrandBuilderModel = (typeof supportedBrandBuilderModels)[number];

export const brandBuilderModel: BrandBuilderModel = "openai/gpt-5.6-terra";

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

interface GenerationBudget {
  callsUsed: number;
  readonly maxCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number | null;
}

type StageValidator<T> = (object: T) => string[];

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

  return generateWithModel(intake.profile, apiKey, brandBuilderModel);
}

export async function generateQualityBenchmark(
  profile: ModelProfile,
  model: BrandBuilderModel = brandBuilderModel,
) {
  const apiKey = readEnv("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for a real quality run.");
  return generateWithModel(profile, apiKey, model);
}

async function generateWithModel(
  profile: ModelProfile,
  apiKey: string,
  model: BrandBuilderModel,
) {
  const budget: GenerationBudget = {
    callsUsed: 0,
    maxCalls: 4,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
  };
  try {
  const relevantRules = selectRelevantRules(profile).map(({ id, rule }) => ({ id, rule }));
  const qualityAnchors = selectCanonicalExamples(profile, 2).map((example) => ({
    model: example.input.name,
    approvedBio: example.bio,
    transferableLesson: example.lesson,
    usagePolicy:
      "Style calibration only. The current profile is the sole source of facts. Do not borrow this example's model, setting, kink, wardrobe, wording, CTA or sentence rhythm.",
  }));
  const approvedMemory = await selectApprovedMemory(profile, 4);

  const strategy = await runStage({
    apiKey,
    model,
    budget,
    name: "strategy",
    schema: brandStrategySchema,
    validateObject: (object) => validateStrategyGrounding(profile, object),
    temperature: 0.35,
    maxOutputTokens: 3_000,
    system: strategySystemPrompt(),
    prompt: JSON.stringify(
      {
        profile,
        approvedStylePrinciples,
        relevantRules,
        qualityAnchors,
        approvedMemory,
      },
      null,
      2,
    ),
  });

  const writing = await runStage({
    apiKey,
    model,
    budget,
    name: "writing",
    schema: brandDraftSchema,
    validateObject: (object) => validateDraftGrounding(profile, object),
    temperature: 0.8,
    maxOutputTokens: 1_600,
    system: writingSystemPrompt(),
    prompt: JSON.stringify(
      {
        profile,
        strategy: strategy.object,
        approvedStylePrinciples,
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
    model,
    budget,
    name: "review",
    schema: reviewedPlaybookSchema,
    validateObject: (object) => validateReviewedGrounding(profile, object),
    temperature: 0.25,
    maxOutputTokens: 3_500,
    system: reviewSystemPrompt(),
    prompt: JSON.stringify(
      {
        profile,
        strategy: strategy.object,
        drafts: writing.object,
        approvedStylePrinciples,
        relevantRules,
        qualityAnchors,
        approvedMemory,
      },
      null,
      2,
    ),
  });

  let reviewed = review;
  let output = assemblePlaybook(profile.name, reviewed.object);
  const stages: Array<["strategy" | "writing" | "review", GenerationMetrics]> = [
    ["strategy", strategy.metrics],
    ["writing", writing.metrics],
    ["review", review.metrics],
  ];

  try {
    validateFinalPlaybook(profile, output);
  } catch (error) {
    const validationFailure =
      error instanceof Error ? error.message : "unknown validation failure";
    reviewed = await runStage({
      apiKey,
      model,
      budget,
      name: "review",
      schema: reviewedPlaybookSchema,
      validateObject: (object) => validateReviewedGrounding(profile, object),
      temperature: 0.1,
      maxOutputTokens: 3_500,
      system: `${reviewSystemPrompt()}\nThis is the single allowed final repair. Fix only the deterministic failures while preserving the current profile and route worlds. Return valid JSON only.`,
      prompt: JSON.stringify(
        {
          currentProfile: profile,
          strategy: strategy.object,
          drafts: writing.object,
          priorReview: reviewed.object,
          deterministicValidationFailure: validationFailure,
        },
        null,
        2,
      ),
    });
    stages.push(["review", reviewed.metrics]);
    output = assemblePlaybook(profile.name, reviewed.object);
    validateFinalPlaybook(profile, output);
  }

  return {
    output,
    provider: model,
    metrics: aggregateMetrics(stages),
    warnings: [],
  };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown generation failure";
    throw new Error(`${message} ${formatBudgetUsage(budget)}`, { cause: error });
  }
}

async function runStage<T>({
  apiKey,
  model,
  budget,
  name,
  schema,
  validateObject,
  system,
  prompt,
  temperature,
  maxOutputTokens,
}: {
  apiKey: string;
  model: BrandBuilderModel;
  budget: GenerationBudget;
  name: "strategy" | "writing" | "review";
  schema: z.ZodType<T>;
  validateObject: StageValidator<T>;
  system: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
}): Promise<StageResult<T>> {
  const openrouter = createOpenRouter({ apiKey });
  if (model === "openai/gpt-5.5") {
    return runTextJsonStage({
      model: openrouter(model),
      budget,
      name,
      schema,
      validateObject,
      system,
      prompt,
      temperature,
      maxOutputTokens,
    });
  }

  const startedAt = performance.now();
  consumeModelCall(budget, name);
  const result = await (async () => {
    try {
      return await generateObject({
        model: openrouter(model),
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
        `${model} ${name} stage failed: ${error instanceof Error ? error.message : "unknown provider error"}`,
      );
    }
  })();
  const responseTimeMs = performance.now() - startedAt;
  recordBudgetUsage(budget, result);
  const semanticFailures = validateObject(result.object);
  if (semanticFailures.length > 0) {
    throw new Error(
      `${model} ${name} stage failed semantic grounding: ${semanticFailures.join("; ")}.`,
    );
  }
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

async function runTextJsonStage<T>({
  model,
  budget,
  name,
  schema,
  validateObject,
  system,
  prompt,
  temperature,
  maxOutputTokens,
}: {
  model: Parameters<typeof generateText>[0]["model"];
  budget: GenerationBudget;
  name: "strategy" | "writing" | "review";
  schema: z.ZodType<T>;
  validateObject: StageValidator<T>;
  system: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
}): Promise<StageResult<T>> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  const attempts: GenerationMetrics[] = [];
  const firstStartedAt = performance.now();
  consumeModelCall(budget, name);
  const first = await generateText({
    model,
    system: `${system}\nThe required JSON Schema is:\n${jsonSchema}`,
    prompt,
    temperature,
    maxOutputTokens,
    maxRetries: 0,
  });
  attempts.push(metricsFromCall(name, first, performance.now() - firstStartedAt, budget));

  const firstParsed = parseTextStageObject(first.text, schema, validateObject);
  if (firstParsed.success) {
    return { object: firstParsed.data, metrics: combineStageAttempts(name, attempts) };
  }

  const repairStartedAt = performance.now();
  consumeModelCall(budget, name);
  const repair = await generateText({
    model,
    system: [
      system,
      "This is the single allowed repair for the same task.",
      "The original task and current profile below remain authoritative.",
      "Repair both structure and the reported validation failure without changing subject.",
      "Return only one valid JSON object matching the supplied schema.",
      "Do not add markdown, commentary, or fields outside the schema.",
      "Every bio field must contain 55-90 whitespace-separated words.",
      `Required JSON Schema:\n${jsonSchema}`,
    ].join("\n"),
    prompt: JSON.stringify(
      {
        originalTaskInput: prompt,
        invalidOutput: first.text,
        validationFailure: firstParsed.error,
      },
      null,
      2,
    ),
    temperature: 0,
    maxOutputTokens,
    maxRetries: 0,
  });
  attempts.push(metricsFromCall(name, repair, performance.now() - repairStartedAt, budget));

  const repaired = parseTextStageObject(repair.text, schema, validateObject);
  if (repaired.success) {
    return { object: repaired.data, metrics: combineStageAttempts(name, attempts) };
  }
  throw new Error(`${name} repair failed: ${repaired.error}`);
}

function parseTextStageObject<T>(
  text: string,
  schema: z.ZodType<T>,
  validateObject: StageValidator<T>,
) {
  const candidate = extractJsonObject(text);
  if (!candidate) return { success: false as const, error: "No valid JSON object was found." };
  try {
    const result = schema.safeParse(JSON.parse(candidate));
    if (result.success) {
      const semanticFailures = validateObject(result.data);
      if (semanticFailures.length === 0) {
        return { success: true as const, data: result.data };
      }
      return {
        success: false as const,
        error: `Semantic grounding failed: ${semanticFailures.join("; ")}`,
      };
    }
    return {
      success: false as const,
      error: result.error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; "),
    };
  } catch {
    return { success: false as const, error: "The extracted object is not valid JSON." };
  }
}

function consumeModelCall(
  budget: GenerationBudget,
  stage: "strategy" | "writing" | "review",
) {
  if (budget.callsUsed >= budget.maxCalls) {
    throw new Error(
      `Brand Builder stopped before ${stage}: model-call budget of ${budget.maxCalls} was exhausted.`,
    );
  }
  budget.callsUsed += 1;
}

function validateStrategyGrounding(profile: ModelProfile, strategy: BrandStrategy) {
  const failures: string[] = [];
  const profileCorpus = profileGroundingTokens(profile);
  const adultCorpus = adultSignalTokens(profile);

  for (const route of strategy.routes) {
    const routeLabel = route.routeId;
    const routeText = [
      route.workingTitle,
      route.centralFantasy,
      route.relatableScene,
      route.coreTension,
      route.sensualHook,
      route.desireReaction,
      route.confirmedAdultSignal,
      route.selectedDetails.join(" "),
      route.ctaMechanic,
      route.voiceDirection,
    ].join(" ");
    if (tokenOverlap(routeText, profileCorpus) < 2) {
      failures.push(`${routeLabel} is not grounded in the current profile`);
    }
    if (
      /\b(all characters|21\+|verified adult|consenting adults?)\b/i.test(
        route.confirmedAdultSignal,
      ) ||
      tokenOverlap(route.confirmedAdultSignal, adultCorpus) < 1
    ) {
      failures.push(`${routeLabel} uses an unsupported confirmedAdultSignal`);
    }
    const unsupportedDetails = route.selectedDetails.filter(
      (detail) => tokenOverlap(detail, profileCorpus) < 1,
    );
    if (unsupportedDetails.length > 0) {
      failures.push(
        `${routeLabel} invents selected details: ${unsupportedDetails.join(", ")}`,
      );
    }
  }
  return failures;
}

function validateDraftGrounding(profile: ModelProfile, draft: BrandDraft) {
  const failures: string[] = [];
  const profileCorpus = profileGroundingTokens(profile);
  for (const route of draft.routes) {
    if (tokenOverlap(`${route.title} ${route.bio}`, profileCorpus) < 2) {
      failures.push(`${route.routeId} is not grounded in the current profile`);
    }
    failures.push(...validateBioCore(profile, route.routeId, route.bio));
  }
  return failures;
}

function validateReviewedGrounding(profile: ModelProfile, reviewed: ReviewedPlaybook) {
  const failures: string[] = [];
  const profileCorpus = profileGroundingTokens(profile);
  for (const route of reviewed.routes) {
    const routeText = [
      route.title,
      route.archetype,
      route.coreTension,
      route.brandAngle,
      route.discoveryBio,
      route.whyItFits,
    ].join(" ");
    if (tokenOverlap(routeText, profileCorpus) < 3) {
      failures.push(`${route.routeId} is not grounded in the current profile`);
    }
  }
  return failures;
}

function validateBioCore(profile: ModelProfile, routeId: string, bio: string) {
  const failures: string[] = [];
  if (!/\b(i|im|i'm|my|me)\b/i.test(bio)) {
    failures.push(`${routeId} is not written in first person`);
  }
  if (!hasClosingConversationCta(bio)) {
    failures.push(`${routeId} has no closing conversation CTA`);
  }
  if (!hasSensualConversionHook(bio)) {
    failures.push(`${routeId} has no clear sensual conversion hook`);
  }
  if (shouldUseEmoji(profile) && countEmojis(bio) === 0) {
    failures.push(`${routeId} needs a character-appropriate emoji`);
  }
  return failures;
}

function profileGroundingTokens(profile: ModelProfile) {
  return meaningfulTokens(
    [
      profile.primaryBodyType,
      profile.secondaryBodyType,
      profile.visualTraits,
      profile.styleTags.join(" "),
      profile.realPersonality,
      profile.comfortablePersonalityOnline.join(" "),
      profile.availableAssets,
      profile.hobbies,
      profile.normalLifeDetails,
      profile.additionalPhysicalTraits,
      profile.confirmedFetishesOrNiches,
    ].join(" "),
  );
}

function adultSignalTokens(profile: ModelProfile) {
  return meaningfulTokens(
    [
      profile.primaryBodyType,
      profile.secondaryBodyType,
      profile.visualTraits,
      profile.comfortablePersonalityOnline.join(" "),
      profile.availableAssets,
      profile.additionalPhysicalTraits,
      profile.confirmedFetishesOrNiches,
    ].join(" "),
  );
}

function tokenOverlap(text: string, corpus: Set<string>) {
  return [...meaningfulTokens(text)].filter((token) => corpus.has(token)).length;
}

function meaningfulTokens(text: string) {
  const stopWords = new Set([
    "about",
    "adult",
    "after",
    "always",
    "around",
    "character",
    "content",
    "current",
    "every",
    "from",
    "into",
    "private",
    "reader",
    "route",
    "should",
    "their",
    "there",
    "these",
    "thing",
    "this",
    "through",
    "with",
    "woman",
  ]);
  return new Set(
    (text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? [])
      .filter((token) => token.length >= 4 && !stopWords.has(token))
      .map((token) => token.slice(0, 5)),
  );
}

function metricsFromCall(
  name: "strategy" | "writing" | "review",
  result: {
    usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    providerMetadata?: unknown;
  },
  responseTimeMs: number,
  budget: GenerationBudget,
): GenerationMetrics {
  recordBudgetUsage(budget, result);
  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const totalTokens = result.usage.totalTokens ?? inputTokens + outputTokens;
  const costUsd = readOpenRouterCost(result.providerMetadata);
  return {
    attempts: 1,
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd,
    responseTimeMs,
    stages: [{ name, inputTokens, outputTokens, totalTokens, costUsd, responseTimeMs }],
  };
}

function recordBudgetUsage(
  budget: GenerationBudget,
  result: {
    usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    providerMetadata?: unknown;
  },
) {
  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  budget.inputTokens += inputTokens;
  budget.outputTokens += outputTokens;
  budget.totalTokens += result.usage.totalTokens ?? inputTokens + outputTokens;
  const cost = readOpenRouterCost(result.providerMetadata);
  budget.costUsd =
    budget.costUsd === null || cost === null ? null : budget.costUsd + cost;
}

function formatBudgetUsage(budget: GenerationBudget) {
  const cost =
    budget.costUsd === null ? "cost unavailable" : `$${budget.costUsd.toFixed(6)}`;
  return `Recorded usage before stop: ${budget.callsUsed}/${budget.maxCalls} calls, ${budget.totalTokens} tokens, ${cost}.`;
}

function combineStageAttempts(
  name: "strategy" | "writing" | "review",
  attempts: GenerationMetrics[],
): GenerationMetrics {
  const costs = attempts.map((attempt) => attempt.costUsd);
  const inputTokens = attempts.reduce((sum, attempt) => sum + attempt.inputTokens, 0);
  const outputTokens = attempts.reduce((sum, attempt) => sum + attempt.outputTokens, 0);
  const totalTokens = attempts.reduce((sum, attempt) => sum + attempt.totalTokens, 0);
  const costUsd = costs.every((cost) => cost !== null)
    ? costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0)
    : null;
  const responseTimeMs = attempts.reduce((sum, attempt) => sum + attempt.responseTimeMs, 0);
  return {
    attempts: attempts.length,
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd,
    responseTimeMs,
    stages: [{ name, inputTokens, outputTokens, totalTokens, costUsd, responseTimeMs }],
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
    if (!hasClosingConversationCta(bio)) {
      failures.push(`${route.routeId} has no closing conversation CTA`);
    }
    if (!hasSensualConversionHook(bio)) {
      failures.push(`${route.routeId} has no clear sensual conversion hook`);
    }
    if (shouldUseEmoji(profile) && countEmojis(bio) === 0) {
      failures.push(`${route.routeId} needs a character-appropriate emoji`);
    }
    if (countEmojis(bio) > 3) failures.push(`${route.routeId} uses more than 3 emojis`);
    if (mentionsPublicBoundary(bio)) {
      failures.push(`${route.routeId} announces a private content boundary`);
    }
    if (hasUnverifiedOperationalPromise(bio)) {
      failures.push(`${route.routeId} invents an unverified operational promise`);
    }
    const profileIsTrans = /\btrans\b/i.test(profile.identityGender);
    const bioMentionsTrans = /\btrans\b/i.test(bio);
    if (profileIsTrans && !bioMentionsTrans) {
      failures.push(`${route.routeId} hides the model's trans identity`);
    }
    if (!profileIsTrans && bioMentionsTrans) {
      failures.push(`${route.routeId} introduces a trans identity not present in the profile`);
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
    throw new Error(`Brand Builder quality validation failed: ${failures.join("; ")}.`);
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
    "Each route needs one coherent erotic fantasy engine: a recognizable profile-specific identity anchor, one relatable scene, mandatory non-graphic sexual tension, and a specific reader role.",
    "The conversion goal is adult desire. The reader should finish the bio imagining the creator in a private sensual situation and wanting to see more, not merely wanting to discuss her hobby.",
    "For every route, explicitly plan a sensualHook, the reader's desireReaction, one confirmedAdultSignal drawn from niches/body/assets/persona, and an emojiDirection. These must be visible in the eventual bio, not hidden in strategy metadata.",
    "An ordinary-life detail is only a setup. Turn it into double meaning using a confirmed body feature, outfit, niche, relationship dynamic, or power contrast. Reject routes whose payoff is only coffee, food, TV opinions, compliments, or friendly conversation.",
    "Select two to four mutually reinforcing profile anchors for each route. Name, age and identity do not count toward that budget. Closely related details may form one contrast or proof beat.",
    "Classify everything else as ignored texture. Do not force the intake into the bio.",
    "A brief identity anchor is allowed when it is genuinely supported (for example a real role, supported niche, or relationship energy). Do not label-dump; demonstrate the rest of the personality through behavior.",
    "Plan a CTA that makes the reader reveal an erotic preference, choice, weakness, fantasy, or imagined reaction specific to this route. Do not settle for a bare 'DM me' or a neutral lifestyle question.",
    "The intake does not authorize operational promises. Do not plan claims about replies, custom work, priority, free content, schedules, streams, posting frequency, pricing, discounts, tiers, all-access or external products unless explicitly confirmed in the current profile.",
    "Forbidden content is an internal hard constraint and must never become public copy.",
    "This is non-graphic public profile copy. Do not describe explicit sex acts.",
    "Only use specific power, humiliation, sissy or degradation themes when explicitly confirmed.",
    "The three scenes and CTA mechanics must not overlap.",
    "Approved examples are quality calibration, not templates. Never import an example detail or scenario that is not independently supported by the current profile.",
  ].join("\n");
}

function writingSystemPrompt() {
  return [
    "You are a specialist creator bio writer. Write exactly three English bios from the approved strategies.",
    "Return only valid JSON. No markdown, no commentary, no prose before or after the JSON object.",
    "Every bio must contain 55-90 words, use first person, and end with a short in-character invitation to DM or message.",
    "Every route must contain unmistakable but non-graphic sexual double meaning. Use at least one profile-confirmed niche, sensual asset, body signal, outfit, or power dynamic to make the reader imagine seeing more of her.",
    "A cozy or everyday scene is only the setup, never the payoff. Escalate it into looking, temptation, loss of focus, self-control, teasing, obedience, body worship, or another confirmed erotic reaction.",
    "When the strategy marks the persona as playful, soft, teasing, affectionate, needy, flirty, bratty, or spoiled, use 1-3 fitting emojis. Emojis are emotional punctuation, not decoration. For consistently serious or restrained personas, 0-1 may fit.",
    "Write a compact micro-story, not a static description: establish who she is, put the reader into a believable moment, escalate or reverse the tension, then make the CTA complete that moment.",
    "Open with one memorable identity anchor that is specific to this profile. A short supported label is fine; an adjective pile or copied creator persona is not.",
    "Sound like a real creator texting: casual, imperfect and immediate. Use im/u/dont/lol or similar shorthand only when it fits this specific creator; do not turn it into a mandatory house voice.",
    "Use selected traits, body details, clothes, hobbies, niches or assets only as active evidence inside the scene. Never stack them into an inventory.",
    "A distinctive visible or physical detail is useful when it causes a reaction, joke, contrast or power shift; otherwise omit it.",
    "Address the reader directly and make them imagine a specific erotic choice, challenge, consequence or role. The final invite must reveal what tempts them, what they would watch, where they lose control, which side of her they want, or another route-specific desire—not merely 'DM me'.",
    "Avoid agency language, poetic mystery, third-person labels, generic selling and AI phrases such as 'a little dangerous', 'by day/by night', or 'the girl your friends warned you about'.",
    "Do not state content restrictions. Do not copy an example's sentence, CTA, setting, wardrobe, fetish, detail sequence or cadence.",
    "Never invent operational claims: no reply guarantees, custom requests, priority, free content, schedules, streams, daily posting, pricing, discounts, tiers, all-access, external products or catalog promises unless the profile itself explicitly confirms them.",
    "Keep the public bio suggestive but non-graphic; do not describe explicit sex acts.",
    "Every sentence must create the scene, increase tension, reveal behavior or prompt the message. Cut intake facts that do not earn an emotional payoff.",
  ].join("\n");
}

function reviewSystemPrompt() {
  return [
    "You are the final editor and quality gate. Return a complete three-route Brand Builder playbook in English.",
    "Return only valid JSON. No markdown, no commentary, no prose before or after the JSON object.",
    "Independently score every route for natural voice, identity clarity, curiosity, sexual tension, scene and story, profile specificity, reader participation, promise honesty, route distinctiveness, compression, focus, CTA and boundaries.",
    "Sexual tension below 8 includes any bio that is merely charming, cozy, funny, or conversational. The bio must contain a visible confirmed adult signal plus double meaning that makes the reader imagine seeing or experiencing more of the creator.",
    "Reject neutral CTAs about food, music, TV opinions, compliments, or everyday preferences. The CTA must expose an erotic preference, weakness, fantasy, choice, or reaction while remaining non-graphic.",
    "Enforce the strategy's emojiDirection. Soft, playful, teasing, affectionate, needy, flirty, bratty, or spoiled personas normally need 1-3 fitting emojis; do not return three emoji-free bios for such a profile.",
    "If any dimension would score below 8, rewrite that route now and score the rewritten version only.",
    "All three routes must be publishable, distinct and 55-90 words. Do not merely choose one good route and leave two weaker routes.",
    "The creator must speak in first person. Keep one central scene, make the reader a participant, and finish with a short CTA that continues the scene by asking for a route-specific choice, answer, admission or challenge.",
    "Require one memorable profile-specific identity anchor. Reject adjective piles, generic archetype labels, borrowed creator worlds, and bios whose opening could fit many profiles.",
    "Keep only a few mutually reinforcing source details. Physical details may stay when they actively create the joke, contrast or power shift; remove inventories and decorative facts.",
    "Reject generic copy that could fit many profiles, even if it is fluent. Reject copy that borrows an approved example's content or cadence instead of transferring its quality principles.",
    "Remove forbidden-content statements, empty mystery, AI cliches and repeated trans reveal or domination formulas.",
    "Use confirmed adult niches without contradicting boundaries. Never infer an unconfirmed extreme fetish.",
    "Reject invented operational promises, including reply guarantees, custom work, priority access, free content, schedules, streams, posting cadence, prices, discounts, tiers, all-access, or external products. A scene-specific invitation to DM is allowed but must not promise a response.",
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
    attempts: stages.reduce((sum, [, metrics]) => sum + metrics.attempts, 0),
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

function shouldUseEmoji(profile: ModelProfile) {
  const text = [
    profile.styleTags.join(" "),
    profile.realPersonality,
    profile.comfortablePersonalityOnline.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return /sweet|soft|playful|spoiled|princess|cute|brat|teas|flirt|affection|needy|mommy|girl.next.door|gamer/.test(
    text,
  );
}

function hasSensualConversionHook(text: string) {
  const hasReader = /\b(u|you|your|boys?|men|guys?)\b/i.test(text);
  const hasConfirmedStyleAdultAnchor =
    /\b(naught\w*|teas\w*|innocent|lingerie|lace|panties|stockings?|thighs?|boobs?|breasts?|curves?|ass|hips?|mommy|daddy|dominat\w*|submiss\w*|brat\w*|body worship|socks?|heels?|bikini|toys?|dick|pussy|leggings|sweat|good girl|bad girl|use me|spoil\w*)\b/i.test(
      text,
    );
  const hasEroticReaction =
    /\b(want\w*|watch\w*|star\w*|look\w*|focus|self.control|control|behav\w*|obey\w*|beg\w*|weak|distract\w*|tempt\w*|handle|break|nervous|pretend\w*|hid\w*|need\w*|caught|lose|lost|attention|curious)\b/i.test(
      text,
    );
  const hasGazeTension =
    /\b(look\w*|star\w*|watch\w*|eyes?|focus|attention)\b/i.test(text) &&
    /\b(nervous|weak|distract\w*|innocent|pretend\w*|hid\w*|lose|lost|control|caught|curious)\b/i.test(
      text,
    );
  return hasReader && ((hasConfirmedStyleAdultAnchor && hasEroticReaction) || hasGazeTension);
}

function mentionsPublicBoundary(text: string) {
  return /\b(i (do not|don't|wont|won't) do|no (content|anal|bdsm|piss|outdoor nudity|other people)|nothing with other people)\b/i.test(
    text,
  );
}

function hasUnverifiedOperationalPromise(text: string) {
  return /(i (always |personally )?(reply|respond)|all (my )?dms|dm priority|priority dms?|custom (requests?|content|videos?)|free (content|pics|videos|messages)|daily (posts?|updates?)|stream(s|ing)? (every|on|at)|schedule|subscribe for|first month|% off|discount|tier(s)?|all (videos|pics|content) (are |is )?free|no ppv|i('ll| will) message)/i.test(
    text,
  );
}

function hasClosingConversationCta(text: string) {
  const closingWindow = text.trim().split(/\s+/).slice(-30).join(" ");
  return /\b(dm|message|text|tell me|say hi|come say hi|send me)\b/i.test(
    closingWindow,
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
