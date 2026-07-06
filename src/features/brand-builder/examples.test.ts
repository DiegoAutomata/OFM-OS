import { describe, expect, it } from "vitest";
import { kiaraExample, selectCanonicalExamples, valentinaExample, zoeExample } from "./examples";

describe("canonical quality anchors", () => {
  it("selects the gamer example for a matching profile", () => {
    expect(selectCanonicalExamples(zoeExample.input, 1)[0]?.input.name).toBe("Zoe Hart");
  });

  it("selects a trans example for a matching profile", () => {
    const selected = selectCanonicalExamples(kiaraExample.input, 2);
    expect(selected.some((example) => example.input.identityGender === "Trans Woman")).toBe(true);
  });

  it("keeps every approved example within the public word contract", () => {
    for (const example of [valentinaExample, zoeExample, kiaraExample]) {
      const words = example.bio.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(55);
      expect(words).toBeLessThanOrEqual(90);
    }
  });
});
