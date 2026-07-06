import { createHash, randomBytes } from "node:crypto";
import { getSupabaseAdmin, hasSupabaseConfig } from "./supabase";
import { readEnv } from "./env";

const settingKey = "operator_access_code";

type OperatorCodeSetting = {
  salt: string;
  hash: string;
};

export async function isOperatorAuthorized(request: Request) {
  const providedCode = request.headers.get("x-operator-code") || "";
  if (!providedCode) return false;

  const stored = await readStoredOperatorCode();
  if (stored) {
    return hashOperatorCode(providedCode, stored.salt) === stored.hash;
  }

  return providedCode === defaultOperatorCode();
}

export async function updateOperatorAccessCode(newCode: string) {
  const normalized = newCode.trim();
  if (normalized.length < 4) {
    throw new Error("Operator access code must be at least 4 characters.");
  }
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase is required to save operator settings.");
  }

  const salt = randomBytes(16).toString("hex");
  const value: OperatorCodeSetting = {
    salt,
    hash: hashOperatorCode(normalized, salt),
  };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("app_settings").upsert({
    key: settingKey,
    value,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function readStoredOperatorCode() {
  if (!hasSupabaseConfig()) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", settingKey)
    .maybeSingle();

  if (error || !data?.value) return null;
  const value = data.value as Partial<OperatorCodeSetting>;
  if (!value.salt || !value.hash) return null;
  return value as OperatorCodeSetting;
}

function defaultOperatorCode() {
  return readEnv("OPERATOR_ACCESS_CODE", "admin");
}

function hashOperatorCode(code: string, salt: string) {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function unauthorizedResponse() {
  return Response.json(
    { ok: false, error: "Invalid operator access code." },
    { status: 401 },
  );
}
