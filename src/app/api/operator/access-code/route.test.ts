import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("operator access-code route", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthorized access code changes", async () => {
    vi.stubEnv("OPERATOR_ACCESS_CODE", "secret");
    const response = await POST(
      new Request("http://test.local/api/operator/access-code", {
        method: "POST",
        headers: { "x-operator-code": "wrong" },
        body: JSON.stringify({ newCode: "new-secret" }),
      }),
    );

    expect(response.status).toBe(401);
  });
});
