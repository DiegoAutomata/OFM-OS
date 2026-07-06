import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/exchange-rate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns blue and official dollar quotes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const isBlue = String(input).endsWith("/blue");
      return new Response(
        JSON.stringify({
          casa: isBlue ? "blue" : "oficial",
          nombre: isBlue ? "Blue" : "Oficial",
          compra: isBlue ? 1200 : 900,
          venta: isBlue ? 1220 : 940,
          fechaActualizacion: "2026-06-19T12:00:00Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.quotes.blue.venta).toBe(1220);
    expect(payload.quotes.official.venta).toBe(940);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a controlled error when the quote provider fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unavailable", { status: 503 }),
    );

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("503");
  });
});
