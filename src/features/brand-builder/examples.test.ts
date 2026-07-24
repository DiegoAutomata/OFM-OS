import { describe, expect, it } from "vitest";
import {
  ariExample,
  canonicalExamples,
  clientApprovedExamples,
  emmaExample,
  kiaraExample,
  selectCanonicalExamples,
  sofiaExample,
  zoeExample,
} from "./examples";

describe("canonical quality anchors", () => {
  it("selects the gamer example for a matching profile", () => {
    expect(selectCanonicalExamples(zoeExample.input, 1)[0]?.input.name).toBe("Zoe Hart");
  });

  it("selects a trans example for a matching profile", () => {
    const selected = selectCanonicalExamples(kiaraExample.input, 2);
    expect(selected.some((example) => example.input.identityGender === "Trans Woman")).toBe(true);
  });

  it.each([
    [emmaExample.input, "Emma Brooks"],
    [sofiaExample.input, "Sofía Lane"],
    [ariExample.input, "Ari Bell"],
  ])("selects the exact client-approved anchor for its profile", (profile, name) => {
    expect(selectCanonicalExamples(profile, 1)[0]?.input.name).toBe(name);
  });

  it("normalizes Spanish and English gender labels for anchor selection", () => {
    const selected = selectCanonicalExamples(
      { ...emmaExample.input, identityGender: "Cis Woman" },
      2,
    );
    expect(selected.some((example) => example.input.name === "Emma Brooks")).toBe(true);
  });

  it("keeps every approved example within the public word contract", () => {
    for (const example of canonicalExamples) {
      const words = example.bio.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(55);
      expect(words).toBeLessThanOrEqual(90);
    }
  });

  it("registers the three client-approved examples as canonical anchors", () => {
    expect(clientApprovedExamples.map((example) => example.input.name)).toEqual([
      "Emma Brooks",
      "Sofía Lane",
      "Ari Bell",
    ]);
  });
});
