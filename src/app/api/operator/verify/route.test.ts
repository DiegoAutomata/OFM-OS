import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("operator verify route", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects invalid operator codes", async () => {
    vi.stubEnv("OPERATOR_ACCESS_CODE", "secret");
    const response = await POST(new Request("http://test.local/api/operator/verify"));
    expect(response.status).toBe(401);
  });

  it("accepts the configured operator code", async () => {
    vi.stubEnv("OPERATOR_ACCESS_CODE", "secret");
    const response = await POST(
      new Request("http://test.local/api/operator/verify", {
        method: "POST",
        headers: { "x-operator-code": "secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("accepts admin as the local fallback code", async () => {
    vi.stubEnv("OPERATOR_ACCESS_CODE", "");
    const response = await POST(
      new Request("http://test.local/api/operator/verify", {
        method: "POST",
        headers: { "x-operator-code": "admin" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
