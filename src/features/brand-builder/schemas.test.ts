import { z } from "zod";
import { describe, expect, it } from "vitest";
import { brandPlaybookSchema, modelIntakeSchema } from "./schemas";
import { camiExample, samplePlaybook } from "./examples";

const photos = [
  { filename: "one.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
  { filename: "two.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
  { filename: "three.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
];

describe("Brand Builder schemas", () => {
  it("requires exactly three reference photos", () => {
    expect(() =>
      modelIntakeSchema.parse({ profile: camiExample.input, photos }),
    ).not.toThrow();

    expect(() =>
      modelIntakeSchema.parse({ profile: camiExample.input, photos: photos.slice(0, 2) }),
    ).toThrow();
  });

  it("blocks unverified age before generation", () => {
    expect(() =>
      modelIntakeSchema.parse({
        profile: { ...camiExample.input, ageVerified: false },
        photos,
      }),
    ).toThrow();
  });

  it("emits an OpenAI-compatible array schema for the three routes", () => {
    const jsonSchema = z.toJSONSchema(brandPlaybookSchema) as unknown as {
      properties: {
        routes: { items: unknown; minItems: number; maxItems: number };
      };
    };

    expect(Array.isArray(jsonSchema.properties.routes.items)).toBe(false);
    expect(jsonSchema.properties.routes.minItems).toBe(3);
    expect(jsonSchema.properties.routes.maxItems).toBe(3);
  });

  it("rejects public bios outside the 55-90 word contract", () => {
    expect(() => brandPlaybookSchema.parse(samplePlaybook)).not.toThrow();
    expect(() =>
      brandPlaybookSchema.parse({ ...samplePlaybook, finalBio: "Too short to publish." }),
    ).toThrow("Public bios must contain between 55 and 90 words");
  });
});
