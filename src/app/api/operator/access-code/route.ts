import { isOperatorAuthorized, unauthorizedResponse, updateOperatorAccessCode } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await isOperatorAuthorized(request))) {
    return unauthorizedResponse();
  }

  const body = (await request.json()) as { newCode?: string };
  if (!body.newCode) {
    return Response.json({ ok: false, error: "New access code is required." }, { status: 400 });
  }

  try {
    await updateOperatorAccessCode(body.newCode);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to update access code.",
      },
      { status: 400 },
    );
  }
}
