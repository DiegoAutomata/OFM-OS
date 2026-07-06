import { isOperatorAuthorized, unauthorizedResponse } from "@/lib/auth";
import { saveApprovedBranding } from "@/features/brand-builder/storage";
import { saveBrandingSchema } from "@/features/brand-builder/schemas";

export async function POST(request: Request) {
  if (!(await isOperatorAuthorized(request))) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const payload = saveBrandingSchema.parse(body);
  const result = await saveApprovedBranding(payload);
  return Response.json({ ok: true, ...result });
}
