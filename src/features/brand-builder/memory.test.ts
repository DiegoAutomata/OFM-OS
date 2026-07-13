import { describe, expect, it } from "vitest";
import { ariExample, sofiaExample } from "./examples";
import { coreBrandRules, selectRelevantRules } from "./memory";

describe("profile-specific brand rules", () => {
  it("does not send trans-only guidance to a cis playful profile", () => {
    const ids = selectRelevantRules(sofiaExample.input).map((rule) => rule.id);
    expect(ids).not.toContain("trans-central-not-flat");
    expect(ids).not.toContain("trans-route-diversity");
    expect(ids).toContain("emoji-by-character");
  });

  it("sends trans guidance to a Spanish-labeled trans profile", () => {
    const ids = selectRelevantRules(ariExample.input).map((rule) => rule.id);
    expect(ids).toContain("trans-central-not-flat");
    expect(ids).toContain("trans-route-diversity");
  });

  it("keeps leaderboard-derived quality guardrails global", () => {
    const ids = coreBrandRules.map((rule) => rule.id);
    expect(ids).toContain("identity-before-inventory");
    expect(ids).toContain("specific-reader-role");
    expect(ids).toContain("offer-truthfulness");
    expect(ids).toContain("route-world-coherence");
    expect(ids).toContain("route-diversity-by-engine");
  });
});
