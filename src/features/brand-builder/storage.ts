import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";
import type { ModelProfile, SaveBrandingPayload } from "./schemas";

export interface SavedModelSummary {
  id: string;
  displayName: string;
  identityGender: string;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
  profile: SaveBrandingPayload["intake"]["profile"];
  approvedOutput: SaveBrandingPayload["approvedOutput"] | null;
  photoUrl: string | null;
}

export interface LearningFeedback {
  id: string;
  profileName: string;
  fieldPath: string;
  beforeValue: string;
  afterValue: string;
  reason: string;
  scope: "global" | "archetype";
  status: "pending" | "approved" | "rejected";
  archetypeKey: string;
  createdAt: string;
}

export interface ApprovedMemoryExample {
  beforeValue: string;
  afterValue: string;
  reason: string;
  scope: "global" | "archetype";
}

export async function saveApprovedBranding(payload: SaveBrandingPayload) {
  if (!hasSupabaseConfig()) {
    return {
      persisted: false,
      modelId: `local-${Date.now()}`,
      warning: "Supabase is not configured; nothing was persisted.",
    };
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: profile, error: profileError } = await supabase
    .from("model_profiles")
    .insert({
      display_name: payload.intake.profile.name,
      identity_gender: payload.intake.profile.identityGender,
      profile_payload: payload.intake.profile,
      photo_count: payload.intake.photos.length,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || "Unable to save model profile.");
  }

  await uploadReferencePhotos(profile.id, payload.intake.photos);

  const { data: output, error: outputError } = await supabase
    .from("brand_outputs")
    .insert({
      model_profile_id: profile.id,
      draft_output: payload.draftOutput,
      approved_output: payload.approvedOutput,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (outputError || !output) {
    throw new Error(outputError?.message || "Unable to save brand output.");
  }

  if (payload.feedback.length > 0) {
    const { error } = await supabase.from("feedback_entries").insert(
      payload.feedback.map((entry) => ({
        model_profile_id: profile.id,
        brand_output_id: output.id,
        field_path: entry.fieldPath,
        before_value: entry.beforeValue,
        after_value: entry.afterValue,
        reason: entry.reason,
        scope: entry.scope,
        archetype_key: buildArchetypeKey(payload.intake.profile),
        created_at: now,
      })),
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  return { persisted: true, modelId: profile.id, outputId: output.id };
}

export async function listLearningFeedback(): Promise<{
  entries: LearningFeedback[];
  warning?: string;
}> {
  if (!hasSupabaseConfig()) {
    return { entries: [], warning: "Supabase is not configured." };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("feedback_entries")
    .select(
      "id, field_path, before_value, after_value, reason, scope, review_status, archetype_key, created_at, model_profiles(display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return { entries: [], warning: migrationWarning(error.message) };
  }

  return {
    entries: (data ?? []).map((row) => ({
      id: row.id,
      profileName: relationDisplayName(row.model_profiles),
      fieldPath: row.field_path,
      beforeValue: row.before_value,
      afterValue: row.after_value,
      reason: row.reason,
      scope: row.scope === "global" ? "global" : "archetype",
      status: normalizeReviewStatus(row.review_status),
      archetypeKey: row.archetype_key || "",
      createdAt: row.created_at,
    })),
  };
}

export async function reviewLearningFeedback({
  id,
  status,
  scope,
}: {
  id: string;
  status: "approved" | "rejected";
  scope: "global" | "archetype";
}) {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase is required to review learning feedback.");
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("feedback_entries")
    .update({ review_status: status, scope, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(migrationWarning(error.message));
}

export async function selectApprovedMemory(
  profile: ModelProfile,
  limit = 4,
): Promise<ApprovedMemoryExample[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("feedback_entries")
    .select("before_value, after_value, reason, scope, archetype_key, created_at")
    .eq("review_status", "approved")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return [];

  const targetTokens = new Set(buildArchetypeKey(profile).split(" ").filter(Boolean));
  return (data ?? [])
    .map((row) => ({
      row,
      score:
        row.scope === "global"
          ? 100
          : overlapScore(targetTokens, String(row.archetype_key || "")),
    }))
    .filter(({ row, score }) => row.scope === "global" || score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ row }) => ({
      beforeValue: row.before_value,
      afterValue: row.after_value,
      reason: row.reason,
      scope: row.scope === "global" ? "global" : "archetype",
    }));
}

export function buildArchetypeKey(profile: ModelProfile) {
  return [
    profile.identityGender,
    profile.primaryBodyType,
    profile.styleTags.join(" "),
    profile.comfortablePersonalityOnline.join(" "),
    profile.confirmedFetishesOrNiches,
  ]
    .join(" ")
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.join(" ") ?? "";
}

export async function listSavedModels(): Promise<{
  models: SavedModelSummary[];
  warning?: string;
}> {
  if (!hasSupabaseConfig()) {
    return { models: [], warning: "Supabase is not configured." };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("model_profiles")
    .select(
      "id, display_name, identity_gender, profile_payload, photo_count, created_at, updated_at, brand_outputs(approved_output, created_at)",
    )
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const models = await Promise.all(
    (data ?? []).map(async (row) => {
      const outputs = Array.isArray(row.brand_outputs) ? row.brand_outputs : [];
      const latestOutput = outputs.toSorted((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      )[0];
      const { data: files } = await supabase.storage
        .from("model-reference-photos")
        .list(row.id, { limit: 1, sortBy: { column: "name", order: "asc" } });
      const firstFile = files?.[0];
      const { data: signed } = firstFile
        ? await supabase.storage
            .from("model-reference-photos")
            .createSignedUrl(`${row.id}/${firstFile.name}`, 3600)
        : { data: null };

      return {
        id: row.id,
        displayName: row.display_name,
        identityGender: row.identity_gender,
        photoCount: row.photo_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        profile: row.profile_payload as SavedModelSummary["profile"],
        approvedOutput:
          (latestOutput?.approved_output as SavedModelSummary["approvedOutput"]) ?? null,
        photoUrl: signed?.signedUrl ?? null,
      };
    }),
  );

  return { models };
}

async function uploadReferencePhotos(
  modelProfileId: string,
  photos: SaveBrandingPayload["intake"]["photos"],
) {
  const supabase = getSupabaseAdmin();
  for (const [index, photo] of photos.entries()) {
    if (!photo.dataUrl) {
      continue;
    }
    const match = photo.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      continue;
    }
    const [, mimeType, base64] = match;
    const extension = mimeType.split("/")[1] || "jpg";
    const storagePath = `${modelProfileId}/reference-${index + 1}.${extension}`;
    const bytes = Buffer.from(base64, "base64");
    const { error } = await supabase.storage
      .from("model-reference-photos")
      .upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: true,
      });
    if (error) {
      throw new Error(error.message);
    }
  }
}

function relationDisplayName(value: unknown) {
  if (Array.isArray(value)) return String(value[0]?.display_name ?? "Unknown profile");
  return String((value as { display_name?: unknown } | null)?.display_name ?? "Unknown profile");
}

function normalizeReviewStatus(value: unknown): LearningFeedback["status"] {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function overlapScore(target: Set<string>, candidate: string) {
  return candidate
    .split(" ")
    .filter(Boolean)
    .reduce((score, token) => score + (target.has(token) ? 1 : 0), 0);
}

function migrationWarning(message: string) {
  return /review_status|archetype_key|reviewed_at/i.test(message)
    ? "Run supabase/migrations/20260623_curated_brand_memory.sql before using learning review."
    : message;
}
