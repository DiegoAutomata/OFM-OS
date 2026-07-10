import { z } from "zod";

const publicBioSchema = z
  .string()
  .min(80)
  .refine((value) => {
    const words = value.trim().split(/\s+/).filter(Boolean).length;
    return words >= 55 && words <= 90;
  }, "Public bios must contain between 55 and 90 words.");

export const modelProfileSchema = z.object({
  name: z.string().min(1, "Name or working name is required."),
  identityGender: z.string().min(1),
  age: z.coerce.number().int().min(18),
  ageVerified: z.boolean(),
  country: z.string().min(1),
  city: z.string().optional().default(""),
  primaryBodyType: z.string().min(1),
  secondaryBodyType: z.string().optional().default(""),
  height: z.string().optional().default(""),
  birthday: z.string().optional().default(""),
  zodiacSign: z.string().optional().default(""),
  visualTraits: z.string().min(1),
  styleTags: z.array(z.string()).min(1),
  realPersonality: z.string().min(1),
  comfortablePersonalityOnline: z.array(z.string()).min(1),
  forbiddenContent: z.string().optional().default(""),
  availableAssets: z.string().min(1),
  hobbies: z.string().optional().default(""),
  normalLifeDetails: z.string().optional().default(""),
  musicTaste: z.string().optional().default(""),
  additionalPhysicalTraits: z.string().optional().default(""),
  confirmedFetishesOrNiches: z.string().optional().default(""),
});

export const verifiedModelProfileSchema = modelProfileSchema.refine(
  (profile) => profile.ageVerified,
  {
    path: ["ageVerified"],
    message: "Age must be verified before branding generation.",
  },
);

export const referencePhotoSchema = z.object({
  filename: z.string().min(1),
  dataUrl: z.string().startsWith("data:image/").optional(),
  storagePath: z.string().optional(),
});

export const modelIntakeSchema = z.object({
  profile: verifiedModelProfileSchema,
  photos: z
    .array(referencePhotoSchema)
    .length(3, "Exactly 3 reference photos are required."),
});

export const brandRouteSchema = z.object({
  routeId: z.enum(["route_1", "route_2", "route_3"]),
  title: z.string().min(3),
  archetype: z.string().min(3),
  coreTension: z.string().min(10),
  brandAngle: z.string().min(20),
  discoveryBio: publicBioSchema,
  voiceDirection: z.string().min(10),
  whyItFits: z.string().min(20),
  whatToAvoid: z.array(z.string()).min(1),
});

export const brandPlaybookSchema = z.object({
  outputVersion: z.literal("brand_builder_v1"),
  modelName: z.string().min(1),
  stageNameSuggestions: z.array(z.string()).min(1).max(3),
  routes: z.array(brandRouteSchema).length(3),
  recommendedRouteId: z.enum(["route_1", "route_2", "route_3"]),
  finalBio: publicBioSchema,
  brandVoice: z.string().min(20),
  operatorNotes: z.string().min(20),
  qualityWarnings: z.array(z.string()),
});

export const generateBrandingSchema = z.object({
  intake: modelIntakeSchema,
});

export const benchmarkRequestSchema = z.object({
  profile: verifiedModelProfileSchema,
});

export const strategyRouteSchema = z.object({
  routeId: z.enum(["route_1", "route_2", "route_3"]),
  workingTitle: z.string().min(3),
  centralFantasy: z.string().min(20),
  relatableScene: z.string().min(20),
  coreTension: z.string().min(20),
  selectedDetails: z.array(z.string().min(2)).min(2).max(4),
  ignoredTexture: z.array(z.string()),
  ctaMechanic: z.string().min(10),
  voiceDirection: z.string().min(10),
});

export const brandStrategySchema = z.object({
  routes: z.array(strategyRouteSchema).length(3),
});

export const draftRouteSchema = z.object({
  routeId: z.enum(["route_1", "route_2", "route_3"]),
  title: z.string().min(3),
  bio: publicBioSchema,
});

export const brandDraftSchema = z.object({
  routes: z.array(draftRouteSchema).length(3),
});

export const qualityScoresSchema = z.object({
  naturalVoice: z.number().min(8).max(10),
  curiosity: z.number().min(8).max(10),
  sexualTension: z.number().min(8).max(10),
  sceneAndStory: z.number().min(8).max(10),
  profileSpecificity: z.number().min(8).max(10),
  compression: z.number().min(8).max(10),
  focus: z.number().min(8).max(10),
  cta: z.number().min(8).max(10),
  boundaries: z.number().min(8).max(10),
});

export const reviewedRouteSchema = brandRouteSchema.extend({
  qualityScores: qualityScoresSchema,
});

export const reviewedPlaybookSchema = z.object({
  stageNameSuggestions: z.array(z.string()).min(1).max(3),
  routes: z.array(reviewedRouteSchema).length(3),
  recommendedRouteId: z.enum(["route_1", "route_2", "route_3"]),
  brandVoice: z.string().min(20),
  operatorNotes: z.string().min(20),
  qualityWarnings: z.array(z.string()),
});

export const feedbackEntrySchema = z.object({
  fieldPath: z.string().min(1),
  beforeValue: z.string(),
  afterValue: z.string(),
  reason: z.string().min(5),
  scope: z.enum(["global", "model", "archetype"]).default("archetype"),
});

export const feedbackReviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  scope: z.enum(["global", "archetype"]),
});

export const saveBrandingSchema = z.object({
  intake: modelIntakeSchema,
  draftOutput: brandPlaybookSchema,
  approvedOutput: brandPlaybookSchema,
  feedback: z.array(feedbackEntrySchema),
});

export type ModelProfile = z.infer<typeof modelProfileSchema>;
export type ModelIntake = z.infer<typeof modelIntakeSchema>;
export type BrandPlaybook = z.infer<typeof brandPlaybookSchema>;
export type FeedbackEntry = z.infer<typeof feedbackEntrySchema>;
export type SaveBrandingPayload = z.infer<typeof saveBrandingSchema>;
export type BrandStrategy = z.infer<typeof brandStrategySchema>;
export type BrandDraft = z.infer<typeof brandDraftSchema>;
export type ReviewedPlaybook = z.infer<typeof reviewedPlaybookSchema>;
