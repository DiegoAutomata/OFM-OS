import { describe, expect, it } from "vitest";
import { generateMockBrandPlaybook } from "./mock-generator";
import { brandBuilderModel, isEnglishText, validateFinalPlaybook } from "./generator";
import { camiExample, milaExample } from "./examples";

const photos = [
  { filename: "one.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
  { filename: "two.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
  { filename: "three.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
];

describe("mock brand generation", () => {
  it("always returns exactly three routes", () => {
    const output = generateMockBrandPlaybook({ profile: camiExample.input, photos });
    expect(output.routes).toHaveLength(3);
    expect(output.routes.map((route) => route.routeId)).toEqual([
      "route_1",
      "route_2",
      "route_3",
    ]);
  });

  it("keeps trans identity explicit and crossed with other signals", () => {
    const output = generateMockBrandPlaybook({ profile: milaExample.input, photos });
    expect(output.finalBio.toLowerCase()).toContain("trans");
    expect(output.routes[0].whyItFits.toLowerCase()).toContain("spoiled");
  });
});

describe("generation model and final validation", () => {
  it("fixes the only production model to GPT-5.5", () => {
    expect(brandBuilderModel).toBe("openai/gpt-5.5");
  });

  it("accepts three publishable mock routes", () => {
    const generated = generateMockBrandPlaybook({ profile: camiExample.input, photos });
    expect(validateFinalPlaybook(camiExample.input, generated)).toBe(generated);
  });

  it("blocks a route without a conversation CTA", () => {
    const generated = generateMockBrandPlaybook({ profile: camiExample.input, photos });
    generated.routes[0].discoveryBio = generated.routes[0].discoveryBio.replace(
      /Dm me.*$/,
      "I will be here stretching after class until the room gets quiet again.",
    );
    generated.finalBio = generated.routes[0].discoveryBio;
    expect(() => validateFinalPlaybook(camiExample.input, generated)).toThrow(
      "has no conversation CTA",
    );
  });
});

describe("English output validation", () => {
  it("accepts English and rejects Spanish prose", () => {
    expect(
      isEnglishText(
        "I am the quiet gamer girl who stays up too late, gets sarcastic when nervous, and secretly loves being the center of your attention.",
      ),
    ).toBe(true);
    expect(
      isEnglishText(
        "Soy la chica gamer que se queda despierta hasta muy tarde, se pone sarcástica cuando está nerviosa y quiere toda tu atención.",
      ),
    ).toBe(false);
  });
});
