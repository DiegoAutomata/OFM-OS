import { z } from "zod";

const dollarQuoteSchema = z.object({
  casa: z.string(),
  nombre: z.string(),
  compra: z.number().positive(),
  venta: z.number().positive(),
  fechaActualizacion: z.string(),
});

const quoteUrls = {
  blue: "https://dolarapi.com/v1/dolares/blue",
  official: "https://dolarapi.com/v1/dolares/oficial",
} as const;

export async function GET() {
  try {
    const [blue, official] = await Promise.all(
      Object.entries(quoteUrls).map(async ([kind, url]) => {
        const response = await fetch(url, {
          headers: { "user-agent": "OFM-OS/1.0" },
          next: { revalidate: 300 },
        });
        if (!response.ok) throw new Error(`Quote provider returned ${response.status}.`);
        return [kind, dollarQuoteSchema.parse(await response.json())] as const;
      }),
    );

    return Response.json({
      ok: true,
      quotes: Object.fromEntries([blue, official]),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load exchange rates.",
      },
      { status: 502 },
    );
  }
}
