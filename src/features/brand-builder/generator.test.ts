import { describe, expect, it } from "vitest";
import { generateMockBrandPlaybook } from "./mock-generator";
import { brandBuilderModel, isEnglishText, validateFinalPlaybook } from "./generator";
import { camiExample, milaExample } from "./examples";

const photos = [
  { filename: "one.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
  { filename: "two.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
  { filename: "three.jpg", dataUrl: "data:image/jpeg;base64,AA==" },
];

const jadeProfile = {
  ...camiExample.input,
  name: "Jade Monroe",
  age: 31,
  country: "Australia",
  primaryBodyType: "Chubby",
  secondaryBodyType: "Curvy",
  styleTags: ["Cozy", "Casual", "Soft", "Natural"],
  realPersonality: "Calm, affectionate, sarcastic, low-maintenance",
  comfortablePersonalityOnline: [
    "Soft mommy",
    "Needy",
    "Teasing",
    "Affectionate",
    "Lazy girlfriend energy",
  ],
};

const rejectedJadeBios = [
  "I’m Jade, the work-from-home stress baker who ends up with flour on her oversized tee. When my inbox gets annoying, I make something warm and pretend I baked too much for one person. You’re my taste-tester at the counter; I save the best bite, then act like your praise hasn’t worked on me. Coffee, praise, or a shameless excuse to steal it—DM me your pick.",
  "I’m Jade, professionally hard to evict from a warm bed. My oversized tee is draped over a soft belly, something forgettable is playing, and I’ve decided the blankets need me more than the outside world does. You get one chance to tempt me up; make me smile and I might stop pretending I’m too sleepy to care. DM me the exact compliment you’d use.",
  "I’m Jade, home from brunch and holding court from my sofa over a reality-show villain. I changed into a robe, poured another drink, and keep saying I’m not invested—yet one bad defence has me giving you that sleepy-eyed look. Convince me your taste is redeemable and I may be sweet about it. DM me: defend the villain or admit they’re awful.",
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
  it("fixes the only production model to GPT-5.6 Terra", () => {
    expect(brandBuilderModel).toBe("openai/gpt-5.6-terra");
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
      "has no closing conversation CTA",
    );
  });

  it("blocks a friendly lifestyle route without a sensual conversion hook", () => {
    const generated = generateMockBrandPlaybook({ profile: camiExample.input, photos });
    generated.routes[0].discoveryBio =
      "Im Cami, 23, and I spend slow afternoons teaching yoga, drinking tea and choosing music for my next class 😊 I like quiet conversations, thoughtful questions and people who make me laugh after a long day. My little studio always feels calmer once the lights go down. Dm me and tell me which song helps u relax when life gets noisy.";
    generated.finalBio = generated.routes[0].discoveryBio;
    expect(() => validateFinalPlaybook(camiExample.input, generated)).toThrow(
      "has no clear sensual conversion hook",
    );
  });

  it("requires emojis for a profile whose voice is playful and soft", () => {
    const generated = generateMockBrandPlaybook({ profile: camiExample.input, photos });
    generated.routes[0].discoveryBio = generated.routes[0].discoveryBio.replace(
      /\p{Extended_Pictographic}/gu,
      "",
    );
    generated.finalBio = generated.routes[0].discoveryBio;
    expect(() => validateFinalPlaybook(camiExample.input, generated)).toThrow(
      "needs a character-appropriate emoji",
    );
  });

  it.each(rejectedJadeBios)(
    "rejects the previous Jade lifestyle copy for lacking erotic conversion",
    (bio) => {
      const generated = generateMockBrandPlaybook({ profile: jadeProfile, photos });
      generated.routes[0].discoveryBio = bio;
      generated.finalBio = bio;
      expect(() => validateFinalPlaybook(jadeProfile, generated)).toThrow(
        "has no clear sensual conversion hook",
      );
    },
  );

  it("blocks identity contamination between cis and trans profiles", () => {
    const generated = generateMockBrandPlaybook({ profile: camiExample.input, photos });
    generated.routes[0].discoveryBio = generated.routes[0].discoveryBio.replace(
      /im Cami, 23/i,
      "im Cami, 23, trans",
    );
    generated.finalBio = generated.routes[0].discoveryBio;
    expect(() => validateFinalPlaybook(camiExample.input, generated)).toThrow(
      "introduces a trans identity not present in the profile",
    );
  });

  it("blocks unverified operational promises", () => {
    const generated = generateMockBrandPlaybook({ profile: camiExample.input, photos });
    generated.routes[0].discoveryBio =
      "Im Cami, 23, and the yoga teacher who acts all calm until you watch me stretch too long. I get quiet when you stare, then make you pick the pose that got your attention first. Dont pretend it was innocent when your answer says otherwise. I reply to every DM, so message me now.";
    generated.finalBio = generated.routes[0].discoveryBio;
    expect(() => validateFinalPlaybook(camiExample.input, generated)).toThrow(
      "invents an unverified operational promise",
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
