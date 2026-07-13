import { beforeEach, describe, expect, it, vi } from "vitest";
import { camiExample, samplePlaybook } from "./examples";

const generateObjectMock = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({ generateObject: generateObjectMock }));
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

describe("GPT-5.5 three-stage quality pipeline", () => {
  beforeEach(() => generateObjectMock.mockReset());

  it("uses exactly three GPT-5.5 calls and aggregates real usage", async () => {
    generateObjectMock
      .mockResolvedValueOnce(result(strategy, 100, 50, 0.001))
      .mockResolvedValueOnce(result(drafts, 200, 100, 0.002))
      .mockResolvedValueOnce(result(reviewed, 300, 150, 0.003));

    const generated = await generateQualityBenchmark(camiExample.input);

    expect(generateObjectMock).toHaveBeenCalledTimes(3);
    expect(generateObjectMock.mock.calls.map(([call]) => call.model)).toEqual([
      "openai/gpt-5.5",
      "openai/gpt-5.5",
      "openai/gpt-5.5",
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

  it("does not make a fourth call when final validation fails", async () => {
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
      .mockResolvedValueOnce(result(invalidReview, 300, 150, 0.003));

    await expect(generateQualityBenchmark(camiExample.input)).rejects.toThrow();
    expect(generateObjectMock).toHaveBeenCalledTimes(3);
  });
});
