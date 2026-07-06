import { isOperatorAuthorized, unauthorizedResponse } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await isOperatorAuthorized(request))) {
    return unauthorizedResponse();
  }
  return Response.json({ ok: true });
}
