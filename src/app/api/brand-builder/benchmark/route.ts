import { isOperatorAuthorized, unauthorizedResponse } from "@/lib/auth";
import { generateQualityBenchmark } from "@/features/brand-builder/generator";
import { benchmarkRequestSchema } from "@/features/brand-builder/schemas";

export const maxDuration = 600;

export async function POST(request: Request) {
  if (!(await isOperatorAuthorized(request))) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { profile, model } = benchmarkRequestSchema.parse(body);
    const result = await generateQualityBenchmark(profile, model);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("Brand quality run failed", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Brand quality run failed.",
      },
      { status: 500 },
    );
  }
}
