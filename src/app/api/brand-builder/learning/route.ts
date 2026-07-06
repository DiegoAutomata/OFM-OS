import { isOperatorAuthorized, unauthorizedResponse } from "@/lib/auth";
import { feedbackReviewSchema } from "@/features/brand-builder/schemas";
import {
  listLearningFeedback,
  reviewLearningFeedback,
} from "@/features/brand-builder/storage";

export async function GET(request: Request) {
  if (!(await isOperatorAuthorized(request))) return unauthorizedResponse();

  try {
    return Response.json({ ok: true, ...(await listLearningFeedback()) });
  } catch (error) {
    return learningError(error);
  }
}

export async function PATCH(request: Request) {
  if (!(await isOperatorAuthorized(request))) return unauthorizedResponse();

  try {
    const review = feedbackReviewSchema.parse(await request.json());
    await reviewLearningFeedback(review);
    return Response.json({ ok: true });
  } catch (error) {
    return learningError(error);
  }
}

function learningError(error: unknown) {
  console.error("Brand learning request failed", error);
  return Response.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : "Brand learning request failed.",
    },
    { status: 500 },
  );
}
