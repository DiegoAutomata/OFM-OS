import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function formatBenchmarkReport(results) {
  return `${results
    .map((result) => {
      const cost =
        result.metrics.costUsd === null
          ? "UNAVAILABLE"
          : `$${result.metrics.costUsd.toFixed(6)}`;
      return [
        `PROFILE ${result.profileNumber}: ${result.profileName.toUpperCase()}`,
        "MODEL: GPT-5.5",
        `PIPELINE CALLS: ${result.metrics.attempts}`,
        `INPUT TOKENS: ${result.metrics.inputTokens}`,
        `OUTPUT TOKENS: ${result.metrics.outputTokens}`,
        `TOTAL TOKENS: ${result.metrics.totalTokens}`,
        `COST USD: ${cost}`,
        `RESPONSE TIME: ${(result.metrics.responseTimeMs / 1_000).toFixed(2)} seconds`,
        "",
        ...result.routes.flatMap((route, index) => [
          `ROUTE ${index + 1}: ${route.title}`,
          "BIO:",
          route.discoveryBio,
          "",
        ]),
      ].join("\n").trimEnd();
    })
    .join("\n\n") }\n`;
}

export async function runBenchmark({ endpoint, inputPath, operatorCode, outputPath }) {
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const profiles = Array.isArray(input) ? input : input.profiles;
  if (!Array.isArray(profiles) || profiles.length !== 3) {
    throw new Error("Quality input must contain exactly 3 profiles.");
  }

  const results = [];
  for (const [profileIndex, profile] of profiles.entries()) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-operator-code": operatorCode,
      },
      body: JSON.stringify({ profile }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(
        `Profile ${profileIndex + 1} GPT-5.5 failed: ${payload.error || response.status}`,
      );
    }
    results.push({
      profileNumber: profileIndex + 1,
      profileName: profile.name,
      routes: payload.output.routes,
      metrics: payload.metrics,
    });
    await writeFile(outputPath, formatBenchmarkReport(results), "utf8");
  }

  const report = formatBenchmarkReport(results);
  await writeFile(outputPath, report, "utf8");
  return { outputPath, report, results };
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const inputPath = argument("input");
  const outputPath = argument("output");
  if (!inputPath || !outputPath) {
    throw new Error(
      "Usage: pnpm benchmark:brand --input <profiles.json> --output <report.txt>",
    );
  }
  const endpoint =
    argument("endpoint") || "http://127.0.0.1:3137/api/brand-builder/benchmark";
  const operatorCode = process.env.OFMS_OPERATOR_CODE || "admin";
  const result = await runBenchmark({ endpoint, inputPath, operatorCode, outputPath });
  console.log(result.outputPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
