import { beforeEach, describe, expect, it, vi } from "vitest";
import { camiExample, samplePlaybook } from "./examples";

const generateObjectMock = vi.hoisted(() => vi.fn());
const generateTextMock = vi.hoisted(() => vi.fn());

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateObject: generateObjectMock, generateText: generateTextMock };
});
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => (model: string) => model,
}));
vi.mock("@/lib/env", () => ({
  readEnv: (key: string, fallback = "") =>
    key === "OPENROUTER_API_KEY" ? "test-openrouter-key" : fallback,
}));
vi.mock("./storage", () => ({ selectApprovedMemory: vi.fn().mockResolvedValue([]) }));

import { generateQualityBenchmark } from "./generator";

const strategy = {
  routes: samplePlaybook.routes.map((route) => ({
    routeId: route.routeId,
    workingTitle: route.title,
    centralFantasy: route.brandAngle,
    relatableScene: route.discoveryBio,
    coreTension: route.coreTension,
    sensualHook: "A profile-confirmed outfit creates a non-graphic double meaning.",
    desireReaction: "The reader imagines losing focus and admits what caught his attention.",
    confirmedAdultSignal: "lingerie",
    emojiDirection: "Use one playful emoji.",
    selectedDetails: ["yoga", "introversion"],
    ignoredTexture: ["music"],
    ctaMechanic: "Ask which pose distracted him.",
    voiceDirection: route.voiceDirection,
  })),
};

const drafts = {
  routes: samplePlaybook.routes.map((route) => ({
    routeId: route.routeId,
    title: route.title,
    bio: route.discoveryBio,
  })),
};

const reviewed = {
  stageNameSuggestions: samplePlaybook.stageNameSuggestions,
  routes: samplePlaybook.routes.map((route) => ({
    ...route,
    qualityScores: {
      naturalVoice: 9,
      identityClarity: 9,
      curiosity: 9,
      sexualTension: 9,
      sceneAndStory: 9,
      profileSpecificity: 9,
      readerParticipation: 9,
      promiseHonesty: 10,
      routeDistinctiveness: 9,
      compression: 9,
      focus: 9,
      cta: 9,
      boundaries: 10,
    },
  })),
  recommendedRouteId: samplePlaybook.recommendedRouteId,
  brandVoice: samplePlaybook.brandVoice,
  operatorNotes: samplePlaybook.operatorNotes,
  qualityWarnings: [],
};

function result(object: unknown, input: number, output: number, cost: number) {
  return {
    object,
    usage: { inputTokens: input, outputTokens: output, totalTokens: input + output },
    providerMetadata: { openrouter: { usage: { cost } } },
  };
}

describe("GPT-5.6 Terra three-stage quality pipeline", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    generateTextMock.mockReset();
  });

  it("uses exactly three GPT-5.6 Terra calls and aggregates real usage", async () => {
    generateObjectMock
      .mockResolvedValueOnce(result(strategy, 100, 50, 0.001))
      .mockResolvedValueOnce(result(drafts, 200, 100, 0.002))
      .mockResolvedValueOnce(result(reviewed, 300, 150, 0.003));

    const generated = await generateQualityBenchmark(camiExample.input);

    expect(generateObjectMock).toHaveBeenCalledTimes(3);
    expect(generateObjectMock.mock.calls.map(([call]) => call.model)).toEqual([
      "openai/gpt-5.6-terra",
      "openai/gpt-5.6-terra",
      "openai/gpt-5.6-terra",
    ]);
    expect(generateObjectMock.mock.calls.every(([call]) => call.maxRetries === 0)).toBe(true);
    expect(generated.output.routes).toHaveLength(3);
    expect(generated.output.finalBio).toBe(generated.output.routes[0].discoveryBio);
    expect(generated.metrics).toMatchObject({
      attempts: 3,
      inputTokens: 600,
      outputTokens: 300,
      totalTokens: 900,
      costUsd: 0.006,
    });
    expect(generated.metrics.stages).toHaveLength(3);
  });

  it("repairs a final-validation failure with one additional model review", async () => {
    const invalidReview = {
      ...reviewed,
      routes: reviewed.routes.map((route, index) =>
        index === 0
          ? { ...route, discoveryBio: route.discoveryBio.replace(/Dm me.*$/, "Stay around if u feel like it.") }
          : route,
      ),
    };
    generateObjectMock
      .mockResolvedValueOnce(result(strategy, 100, 50, 0.001))
      .mockResolvedValueOnce(result(drafts, 200, 100, 0.002))
      .mockResolvedValueOnce(result(invalidReview, 300, 150, 0.003))
      .mockResolvedValueOnce(result(reviewed, 400, 200, 0.004));

    const generated = await generateQualityBenchmark(camiExample.input);

    expect(generateObjectMock).toHaveBeenCalledTimes(4);
    expect(generated.metrics).toMatchObject({
      attempts: 4,
      inputTokens: 1_000,
      outputTokens: 500,
      totalTokens: 1_500,
      costUsd: 0.01,
    });
  });

  it("allows only one final review repair", async () => {
    const invalidReview = {
      ...reviewed,
      routes: reviewed.routes.map((route, index) =>
        index === 0
          ? {
              ...route,
              discoveryBio: route.discoveryBio.replace(
                /Dm me.*$/,
                "Stay around if u feel like it.",
              ),
            }
          : route,
      ),
    };
    generateObjectMock
      .mockResolvedValueOnce(result(strategy, 100, 50, 0.001))
      .mockResolvedValueOnce(result(drafts, 200, 100, 0.002))
      .mockResolvedValueOnce(result(invalidReview, 300, 150, 0.003))
      .mockResolvedValueOnce(result(invalidReview, 400, 200, 0.004));

    await expect(generateQualityBenchmark(camiExample.input)).rejects.toThrow(
      "has no closing conversation CTA",
    );
    expect(generateObjectMock).toHaveBeenCalledTimes(4);
  });

  it("supports an explicit GPT-5.5 benchmark without changing the production default", async () => {
    generateTextMock
      .mockResolvedValueOnce(textResult(strategy, 100, 50, 0.001))
      .mockResolvedValueOnce(textResult(drafts, 200, 100, 0.002))
      .mockResolvedValueOnce(textResult(reviewed, 300, 150, 0.003));

    await generateQualityBenchmark(camiExample.input, "openai/gpt-5.5");

    expect(generateObjectMock).not.toHaveBeenCalled();
    expect(generateTextMock.mock.calls.map(([call]) => call.model)).toEqual([
      "openai/gpt-5.5",
      "openai/gpt-5.5",
      "openai/gpt-5.5",
    ]);
  });

  it("repairs malformed GPT-5.5 text JSON and counts the extra call", async () => {
    generateTextMock
      .mockResolvedValueOnce(textResult("not json", 100, 20, 0.001))
      .mockResolvedValueOnce(textResult(strategy, 110, 50, 0.002))
      .mockResolvedValueOnce(textResult(drafts, 200, 100, 0.003))
      .mockResolvedValueOnce(textResult(reviewed, 300, 150, 0.004));

    const generated = await generateQualityBenchmark(camiExample.input, "openai/gpt-5.5");

    expect(generateTextMock).toHaveBeenCalledTimes(4);
    expect(generated.metrics).toMatchObject({
      attempts: 4,
      inputTokens: 710,
      outputTokens: 320,
      totalTokens: 1_030,
      costUsd: 0.01,
    });
    const repairPrompt = JSON.parse(generateTextMock.mock.calls[1][0].prompt);
    expect(repairPrompt.originalTaskInput).toContain('"name": "Cami Rose"');
    expect(repairPrompt.validationFailure).toContain("No valid JSON object");
  });

  it("stops GPT-5.5 after one contextual repair instead of spending repeatedly", async () => {
    generateTextMock
      .mockResolvedValueOnce(textResult("not json", 100, 20, 0.001))
      .mockResolvedValueOnce(textResult("still not json", 110, 20, 0.002));

    const failedRun = generateQualityBenchmark(camiExample.input, "openai/gpt-5.5");
    await expect(failedRun).rejects.toThrow("strategy repair failed");
    await expect(failedRun).rejects.toThrow(
      "Recorded usage before stop: 2/4 calls, 250 tokens, $0.003000",
    );

    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it("rejects an off-profile strategy before paying for writing or review", async () => {
    const offProfileStrategy = {
      routes: strategy.routes.map((route, index) => ({
        ...route,
        workingTitle: `Tourist walk ${index + 1}`,
        centralFantasy:
          "A visitor follows a scenic public walking route through museums and gardens.",
        relatableScene:
          "The traveler crosses a riverside market and stops beside a public library.",
        coreTension:
          "The visitor must choose between a museum tour and a quiet neighborhood cafe.",
        sensualHook: "Warm city lights make the public architecture look inviting.",
        desireReaction: "The reader wants to explore another landmark before sunset.",
        confirmedAdultSignal: "All characters are 21+ adults.",
        selectedDetails: ["riverside market", "public library"],
        ctaMechanic: "Ask which tourist landmark should come next.",
      })),
    };
    generateTextMock
      .mockResolvedValueOnce(textResult(offProfileStrategy, 100, 100, 0.001))
      .mockResolvedValueOnce(textResult(offProfileStrategy, 150, 100, 0.002));

    await expect(
      generateQualityBenchmark(camiExample.input, "openai/gpt-5.5"),
    ).rejects.toThrow("strategy repair failed");

    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(generateTextMock.mock.calls[1][0].prompt).toContain("Cami Rose");
    expect(generateTextMock.mock.calls[1][0].prompt).toContain(
      "Semantic grounding failed",
    );
  });
});

function textResult(value: unknown, input: number, output: number, cost: number) {
  return {
    text: typeof value === "string" ? value : JSON.stringify(value),
    usage: { inputTokens: input, outputTokens: output, totalTokens: input + output },
    providerMetadata: { openrouter: { usage: { cost } } },
  };
}
