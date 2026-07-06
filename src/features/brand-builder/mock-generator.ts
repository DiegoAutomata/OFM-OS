import { camiExample, milaExample, samplePlaybook } from "./examples";
import type { BrandPlaybook, ModelIntake } from "./schemas";

export function generateMockBrandPlaybook(intake: ModelIntake): BrandPlaybook {
  const name = intake.profile.name || "New Model";
  const isTrans = intake.profile.identityGender.toLowerCase().includes("trans");
  const base = {
    ...samplePlaybook,
    modelName: name,
    stageNameSuggestions: isTrans
      ? [name === "I don't have yet" ? "Mila Noir" : name, "Mila Bloom", "Luna Voss"]
      : [name, `${name.split(" ")[0]} Sol`, `${name.split(" ")[0]} Rose`],
  };

  if (isTrans) {
    return {
      ...base,
      finalBio: milaExample.bio,
      recommendedRouteId: "route_1",
      brandVoice:
        "Spoiled, flirty and direct, with natural confidence and no menu-style selling.",
      operatorNotes:
        "Keep trans identity explicit and central, but combine it with spoiled control tension and personal softness.",
      routes: [
        {
          routeId: "route_1",
          title: "Spoiled Trans Temptation",
          archetype: "Spoiled trans baddie",
          coreTension: "She lets men think they are in control until they realize she is testing them.",
          brandAngle:
            "A Colombian trans girl with black-lingerie confidence, soft shyness, and a control fantasy.",
          discoveryBio: milaExample.bio,
          voiceDirection: "Flirty, casual, teasing, with one playful emoji.",
          whyItFits:
            "It uses trans identity, confidence, toys, lingerie, and spoiled comfort without flattening her into one fetish.",
          whatToAvoid: ["Do not hide that she is trans.", "Do not make it only about surgery."],
        },
        {
          routeId: "route_2",
          title: "Goth Flower Shop Girl",
          archetype: "Soft goth with private intensity",
          coreTension: "She looks sweet at the flower shop, then gets intense when someone earns her attention.",
          brandAngle:
            "A shy goth girl with baddie tattoos, a cat, and a private side that feels more dangerous than expected.",
          discoveryBio:
            "Im Mila, 21, trans and usually acting innocent behind the flower counter lol. I can spend all afternoon making pretty bouquets, then go home and wonder why the confident guy kept forgetting what he came in for. Maybe it was the tattoos... maybe he just got curious. Dm me and tell me which excuse u would use to come back tomorrow 🤭",
          voiceDirection: "Soft goth, teasing, intimate, discovery-first.",
          whyItFits:
            "It uses her real life details as texture and makes the contrast memorable.",
          whatToAvoid: ["Do not overdo flower metaphors.", "Do not make her sound submissive only."],
        },
        {
          routeId: "route_3",
          title: "Flirty Gamer Secret",
          archetype: "Gamer girl with spoiled trans fantasy",
          coreTension: "She acts shy until the game becomes about who obeys first.",
          brandAngle:
            "A gamer/casual trans girl who turns playful attention into a private dominance question.",
          discoveryBio:
            "Im Mila, 21, trans and I love watching confident guys get quiet when I flirt back lol. They start the conversation acting brave, notice im not the shy one anymore and suddenly need a minute to decide what they actually want. I already know they will come back. Dm me and tell me whether u wanna keep pretending or finally be honest 🤭",
          voiceDirection: "Gamer-adjacent, flirty, spoiled, not overly explicit.",
          whyItFits:
            "It uses gamer style and flirty confidence while staying approachable for discovery.",
          whatToAvoid: ["Do not force gamer slang.", "Do not make the bio a fetish checklist."],
        },
      ],
      qualityWarnings: [],
    };
  }

  return {
    ...base,
    finalBio: camiExample.bio,
  };
}
