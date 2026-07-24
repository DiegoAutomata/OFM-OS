import { beforeEach, describe, expect, it, vi } from "vitest";
import { camiExample } from "@/features/brand-builder/examples";

const generateQualityBenchmarkMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  isOperatorAuthorized: vi.fn().mockResolvedValue(true),
  unauthorizedResponse: vi.fn(),
}));
vi.mock("@/features/brand-builder/generator", () => ({
  generateQualityBenchmark: generateQualityBenchmarkMock,
}));

import { POST } from "./route";

describe("POST /api/brand-builder/benchmark", () => {
  beforeEach(() => {
    generateQualityBenchmarkMock.mockReset();
  });

  it("runs a selected benchmark model and returns three quality routes with aggregate metrics", async () => {
    generateQualityBenchmarkMock.mockResolvedValue({
      output: { routes: [{ routeId: "route_1" }, { routeId: "route_2" }, { routeId: "route_3" }] },
      provider: "openai/gpt-5.6-terra",
      metrics: {
        attempts: 3,
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        costUsd: 0.01,
        responseTimeMs: 900,
      },
    });

    const request = new Request("http://localhost/api/brand-builder/benchmark", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-operator-code": "admin",
      },
      body: JSON.stringify({ profile: camiExample.input, model: "openai/gpt-5.6-terra" }),
    });
    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.provider).toBe("openai/gpt-5.6-terra");
    expect(payload.output.routes).toHaveLength(3);
    expect(payload.metrics.totalTokens).toBe(150);
    expect(generateQualityBenchmarkMock).toHaveBeenCalledWith(
      camiExample.input,
      "openai/gpt-5.6-terra",
    );
  });
});
