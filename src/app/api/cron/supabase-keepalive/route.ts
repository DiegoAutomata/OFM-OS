import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";
import { readEnv } from "@/lib/env";

export async function GET(request: Request) {
  const secret = readEnv("CRON_SECRET");
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    new URL(request.url).searchParams.get("secret") ||
    "";

  if (!secret || provided !== secret) {
    return Response.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  if (!hasSupabaseConfig()) {
    return Response.json({
      ok: false,
      error: "Supabase is not configured.",
    });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("health_checks").insert({
    source: "vercel-cron",
    checked_at: new Date().toISOString(),
  });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
