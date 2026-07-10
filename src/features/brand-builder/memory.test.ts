import { describe, expect, it } from "vitest";
import { ariExample, sofiaExample } from "./examples";
import { selectRelevantRules } from "./memory";

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
});
