import { isOperatorAuthorized, unauthorizedResponse } from "@/lib/auth";
import { generateBrandPlaybook } from "@/features/brand-builder/generator";
import { generateBrandingSchema } from "@/features/brand-builder/schemas";

export async function POST(request: Request) {
  if (!(await isOperatorAuthorized(request))) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { intake } = generateBrandingSchema.parse(body);
    const result = await generateBrandPlaybook(intake);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("Brand generation failed", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Brand generation failed.",
      },
      { status: 500 },
    );
  }
}
