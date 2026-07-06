import { describe, expect, it } from "vitest";
import { formatBenchmarkReport } from "./run-brand-benchmark.mjs";

describe("plain-text benchmark report", () => {
  it("renders client-readable bios with real metrics and no JSON or Markdown", () => {
    const report = formatBenchmarkReport([
      {
        profileNumber: 1,
        profileName: "Valentina Ríos",
        routes: [
          { title: "Jealous kitchen", discoveryBio: "Im Valentina route one bio." },
          { title: "Beauty salon", discoveryBio: "Im Valentina route two bio." },
          { title: "Salsa dare", discoveryBio: "Im Valentina route three bio." },
        ],
        metrics: {
          attempts: 3,
          inputTokens: 1200,
          outputTokens: 300,
          totalTokens: 1500,
          costUsd: 0.012345,
          responseTimeMs: 2_345,
        },
      },
    ]);

    expect(report).toContain("PROFILE 1: VALENTINA RÍOS");
    expect(report).toContain("MODEL: GPT-5.5");
    expect(report).toContain("PIPELINE CALLS: 3");
    expect(report).toContain("COST USD: $0.012345");
    expect(report).toContain("RESPONSE TIME: 2.35 seconds");
    expect(report.match(/BIO:/g)).toHaveLength(3);
    expect(report).toContain("ROUTE 3: Salsa dare");
    expect(report).not.toContain("{");
    expect(report).not.toContain("#");
    expect(report).not.toContain("modelName");
  });
});
