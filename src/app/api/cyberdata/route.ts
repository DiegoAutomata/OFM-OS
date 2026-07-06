import { isOperatorAuthorized, unauthorizedResponse } from "@/lib/auth";
import { listSavedModels } from "@/features/brand-builder/storage";

export async function GET(request: Request) {
  if (!(await isOperatorAuthorized(request))) return unauthorizedResponse();
  try {
    const result = await listSavedModels();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load CyberData.",
      },
      { status: 500 },
    );
  }
}
