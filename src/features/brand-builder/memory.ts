import type { ModelProfile } from "./schemas";

export interface MemoryRule {
  id: string;
  scope: "global" | "archetype" | "market";
  title: string;
  rule: string;
}

export const coreBrandRules: MemoryRule[] = [
  {
    id: "discovery-first",
    scope: "global",
    title: "Discovery-first bio",
    rule: "For new models, create familiarity, aura, curiosity, and a first fantasy. Do not write aggressive conversion copy.",
  },
  {
    id: "one-fantasy-per-bio",
    scope: "global",
    title: "One fantasy engine",
    rule: "Build each bio around one instantly understood scene and tension. Every sentence must advance that same fantasy, create curiosity, or deliver the CTA.",
  },
  {
    id: "texture-is-optional",
    scope: "global",
    title: "Texture is optional",
    rule: "Hobbies, outfits, music, work and daily-life details are context, not a checklist. Use no more than two only when they intensify the central fantasy.",
  },
  {
    id: "visible-traits-implicit",
    scope: "global",
    title: "Do not narrate the profile photo",
    rule: "Do not inventory ordinary physical traits the viewer can already see. A distinctive trait may appear only inside a joke, consequence or scene.",
  },
  {
    id: "natural-self-description",
    scope: "global",
    title: "Implicit personality",
    rule: "Never make the creator announce an archetype or describe herself with stacked adjectives. Demonstrate personality through what she says, notices and does.",
  },
  {
    id: "short-in-character-cta",
    scope: "global",
    title: "CTA continues the scene",
    rule: "End with a brief invitation to DM that continues the exact scene or tension. Avoid generic, long or repeated calls to action.",
  },
  {
    id: "no-public-boundaries",
    scope: "global",
    title: "Boundaries stay internal",
    rule: "Forbidden content is a hard internal constraint. Never announce restrictions or content the creator does not make in the public bio.",
  },
  {
    id: "no-ai-cliches",
    scope: "global",
    title: "No AI copywriting",
    rule: "Avoid polished mystery, empty danger language, poetic filler, third-person archetype labels and phrases such as 'a little dangerous', 'by day/by night', or 'the girl your friends warned you about'.",
  },
  {
    id: "no-trait-listing",
    scope: "global",
    title: "No trait listing",
    rule: "Never summarize the form as a list of traits. Select one or two strong signals and turn them into a scene or character tension.",
  },
  {
    id: "natural-voice",
    scope: "global",
    title: "Natural creator voice",
    rule: "Bios should sound like the model texting, not like an agency, a corporate copywriter, or an AI.",
  },
  {
    id: "trans-central-not-flat",
    scope: "archetype",
    title: "Trans identity handling",
    rule: "When identity is Trans Woman, keep it central, but combine it with personality, assets, fetishes, tone, and fantasy. Do not make trans the only concept.",
  },
  {
    id: "trans-route-diversity",
    scope: "archetype",
    title: "Trans route diversity",
    rule: "Do not reuse one trans reveal, confession or domination CTA across profiles. Build distinct tensions for curiosity, attraction and confirmed power dynamics without shaming identity.",
  },
  {
    id: "confirmed-fetishes-only",
    scope: "global",
    title: "Confirmed niches only",
    rule: "Use domination, humiliation, sissy, degradation or similarly specific fantasies only when the profile explicitly confirms them and never contradict a forbidden-content boundary.",
  },
  {
    id: "emoji-by-character",
    scope: "archetype",
    title: "Emoji usage by archetype",
    rule: "Use 1-3 subtle emojis for young, playful, sweet, soft, gamer, yoga, girl-next-door, or spoiled characters. Use fewer or none for mature, strict, elegant, office, sadistic, or serious archetypes.",
  },
  {
    id: "fansly-market-reference",
    scope: "market",
    title: "Fansly leaderboard as market reference",
    rule: "Use top profiles only for archetypes, niche clarity, and language signals. Do not copy hard-selling bios, content menus, prices, PPV, custom requests, ratings, or bundle language into v1 outputs.",
  },
];

export function selectRelevantRules(profile: ModelProfile) {
  const text = [
    profile.identityGender,
    profile.styleTags.join(" "),
    profile.realPersonality,
    profile.comfortablePersonalityOnline.join(" "),
    profile.availableAssets,
    profile.confirmedFetishesOrNiches,
  ]
    .join(" ")
    .toLowerCase();

  return coreBrandRules.filter((rule) => {
    if (rule.scope === "global" || rule.scope === "market") {
      return true;
    }
    if (profile.identityGender.toLowerCase().includes("trans")) {
      return true;
    }
    return /sweet|soft|playful|gamer|yoga|girl|spoiled|princess|latina/.test(text);
  });
}
