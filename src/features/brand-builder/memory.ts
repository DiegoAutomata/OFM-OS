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
    rule: "Build each bio as a compact micro-story: identity hook, instantly understood scene, escalating tension or reversal, then a CTA that completes the same fantasy.",
  },
  {
    id: "reader-inside-scene",
    scope: "global",
    title: "Make the reader participate",
    rule: "Address the reader directly and give them a role in the scene. The bio should make them imagine what happens between creator and reader, not merely observe a description.",
  },
  {
    id: "texture-is-optional",
    scope: "global",
    title: "Texture is optional",
    rule: "Hobbies, outfits, work, body details and daily-life facts are raw material, not a checklist. Select only the few signals that intensify one scene; omit everything else.",
  },
  {
    id: "visible-traits-implicit",
    scope: "global",
    title: "Physical details need a job",
    rule: "Never inventory the profile photo. A distinctive physical trait may be used as proof inside a joke, contrast, consequence or power dynamic when the profile supports it.",
  },
  {
    id: "natural-self-description",
    scope: "global",
    title: "Identity, not label dumping",
    rule: "A short, memorable identity anchor is allowed when the profile supports it. Never stack generic archetype labels or adjectives. Demonstrate the rest of the personality through what she says, notices and does.",
  },
  {
    id: "identity-before-inventory",
    scope: "global",
    title: "One ownable identity anchor",
    rule: "Give each route one profile-specific identity anchor before adding texture: a real role, visual signature, recurring setting, relationship energy, skill, or supported niche. The anchor must make this creator easier to remember without borrowing another creator's character world.",
  },
  {
    id: "specific-reader-role",
    scope: "global",
    title: "Reader role, not generic engagement",
    rule: "The reader should have a specific role, choice, challenge, consequence or invitation inside the route. A bare 'DM me' is insufficient unless the surrounding sentence tells the reader what to say, choose, admit or do in this creator's world.",
  },
  {
    id: "offer-truthfulness",
    scope: "global",
    title: "Do not invent operations",
    rule: "Only promise replies, custom work, priority access, free content, schedules, streams, daily posting, pricing, discounts, tiers, all-access, or external products when the current intake explicitly confirms that operational capability. In ordinary bio generation, use an in-character invitation to message without promising a response or service level.",
  },
  {
    id: "bio-versus-offer-system",
    scope: "global",
    title: "Keep the bio focused",
    rule: "The bio sells identity, feeling and the first interaction. Content catalogs, tier menus, prices, release calendars, FAQ details and fulfillment policies belong in other product surfaces, not in a 55-90 word discovery bio.",
  },
  {
    id: "route-world-coherence",
    scope: "global",
    title: "One coherent world per route",
    rule: "A strong route makes its identity anchor, scene, tension, reader role and CTA feel like one small world. Do not combine unrelated assets, niches or tones just because they all appear in the intake.",
  },
  {
    id: "route-diversity-by-engine",
    scope: "global",
    title: "Distinct emotional engines",
    rule: "The three routes must differ in emotional engine and reader role, not merely swap outfits or synonyms. For example, challenge, intimacy, playful trouble, competence, comfort, or rivalry may be distinct only when independently supported by the intake.",
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
    id: "texting-register",
    scope: "global",
    title: "Character-specific texting register",
    rule: "Use contractions and native chat shorthand such as im, u, dont or lol only when they fit the creator's age, personality and market. Natural imperfection is useful; a repeated house style is not.",
  },
  {
    id: "compressed-emotional-payoff",
    scope: "global",
    title: "Compression with emotional payoff",
    rule: "In 55-90 words, create a clear feeling such as challenge, trouble, safety, jealousy, curiosity or surrender. Cut any sentence that only restates intake data.",
  },
  {
    id: "anchors-are-not-templates",
    scope: "global",
    title: "Transfer patterns, never content",
    rule: "Approved examples calibrate scene, tension, specificity, compression and CTA quality. Never borrow their setting, wardrobe, body feature, kink, wording or sentence rhythm unless the current profile independently supports it.",
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
    rule: "Use the manually reviewed leaderboard only for structural patterns: immediate identity clarity, coherent brand worlds, specific reader participation, honest offer boundaries, clear tier logic and catalog organization. For v1 bios, never copy profiles' names, characters, content menus, prices, PPV, customs, ratings, discounts, schedules, or bundle language.",
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

  const isTrans = /\btrans\b/.test(profile.identityGender.toLowerCase());
  const isEmojiFriendly =
    /sweet|soft|playful|gamer|yoga|girl.next.door|spoiled|princess|cute|brat|college/.test(
      text,
    );

  return coreBrandRules.filter((rule) => {
    if (rule.scope === "global" || rule.scope === "market") return true;
    if (rule.id === "trans-central-not-flat" || rule.id === "trans-route-diversity") {
      return isTrans;
    }
    if (rule.id === "emoji-by-character") return isEmojiFriendly;
    return false;
  });
}
