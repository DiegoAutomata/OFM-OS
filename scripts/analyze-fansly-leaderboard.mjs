import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const authorizationBases = new Set([
  "fansly_written_permission",
  "client_authorized_export",
]);

const featureDefinitions = {
  directReader: /\b(u|you|ur|your|yours)\b/i,
  firstPerson: /\b(i|im|i'm|ive|i've|my|me)\b/i,
  conversationCta:
    /\b(dm|message|text|tell me|say hi|come say hi|send me|talk to me)\b/i,
  question: /\?/,
  emoji: /\p{Extended_Pictographic}/u,
  textingShorthand: /\b(im|ive|u|ur|dont|cant|wont|wanna|gonna|lil|lol|idk)\b/i,
  ageDisclosure: /(?:^|\D)(?:1[89]|[2-9]\d)(?:\D|$)/,
  salesLanguage:
    /\b(sale|discount|subscribe|subscription|free trial|ppv|customs?|menu|bundle|tip|promo)\b/i,
  link: /https?:\/\/|(?:^|\s)www\./i,
  sceneSignal:
    /\b(when|while|then|till|until|somehow|catch me|i sit|i wake|i start|i get|i look|i can be)\b/i,
  contrastSignal: /\b(but|till|until|then|somehow|dont let|do not let|looks? .* but)\b/i,
};

const rateMetrics = Object.keys(featureDefinitions).map((name) => `${name}Rate`);

export function analyzeLeaderboardDataset(dataset) {
  validateDataset(dataset);
  const snapshots = [...dataset.snapshots].sort((left, right) =>
    left.month.localeCompare(right.month),
  );
  const records = snapshots.flatMap((snapshot) =>
    snapshot.entries.map((entry) => buildRecord(snapshot.month, entry)),
  );
  const latestByCreator = new Map();
  for (const record of records) latestByCreator.set(record.creatorKey, record);
  const creatorWeightedRecords = [...latestByCreator.values()];

  const byMonth = Object.fromEntries(
    snapshots.map((snapshot) => [
      snapshot.month,
      summarize(records.filter((record) => record.month === snapshot.month)),
    ]),
  );
  const byRankBand = Object.fromEntries(
    ["1-25", "26-100", "101-250", "251-500"].map((band) => [
      band,
      summarize(records.filter((record) => record.rankBand === band)),
    ]),
  );

  return {
    generatedAt: new Date().toISOString(),
    source: {
      authorizationBasis: dataset.source.authorizationBasis,
      collectedAt: dataset.source.collectedAt,
      description: dataset.source.description ?? "Authorized Fansly leaderboard export",
    },
    coverage: {
      months: snapshots.map((snapshot) => snapshot.month),
      snapshotCount: snapshots.length,
      entryCount: records.length,
      uniqueCreatorCount: latestByCreator.size,
      repeatedCreatorEntries: records.length - latestByCreator.size,
      completeTop500Snapshots: snapshots.filter(
        (snapshot) => snapshot.entries.length === 500,
      ).length,
    },
    methodology: {
      entryWeighted:
        "Every month-rank appearance counts once; useful for describing leaderboard inventory.",
      creatorWeighted:
        "Only the latest observed bio per creator counts; reduces repeated-winner bias.",
      interpretation:
        "Associations are descriptive and do not prove that a bio caused revenue or rank.",
      privacy:
        "Aggregate output excludes usernames and raw biographies.",
    },
    entryWeighted: summarize(records),
    creatorWeighted: summarize(creatorWeightedRecords),
    byMonth,
    byRankBand,
    topVsLowerContrast: compareBands(byRankBand["1-25"], byRankBand["251-500"]),
    ruleCandidates: deriveRuleCandidates(byRankBand["1-25"], byRankBand["251-500"]),
    warnings: buildWarnings(snapshots, records, latestByCreator.size),
  };
}

export function formatLeaderboardMarkdown(report) {
  const percent = (value) => `${(value * 100).toFixed(1)}%`;
  const metricRows = [
    ["Median words", "medianWordCount", (value) => value.toFixed(1)],
    ["Direct reader", "directReaderRate", percent],
    ["Conversation CTA", "conversationCtaRate", percent],
    ["Question", "questionRate", percent],
    ["Texting shorthand", "textingShorthandRate", percent],
    ["Emoji", "emojiRate", percent],
    ["Scene signal", "sceneSignalRate", percent],
    ["Contrast/reversal", "contrastSignalRate", percent],
    ["Sales language", "salesLanguageRate", percent],
  ];
  const bands = ["1-25", "26-100", "101-250", "251-500"];
  const lines = [
    "# Authorized Fansly Leaderboard Bio Analysis",
    "",
    `Months: ${report.coverage.months.join(", ")}`,
    `Entries: ${report.coverage.entryCount}`,
    `Unique creators: ${report.coverage.uniqueCreatorCount}`,
    `Complete top-500 snapshots: ${report.coverage.completeTop500Snapshots}`,
    "",
    "## Rank-band patterns",
    "",
    `| Metric | ${bands.join(" | ")} |`,
    `| --- | ${bands.map(() => "---:").join(" | ")} |`,
    ...metricRows.map(([label, key, formatter]) =>
      `| ${label} | ${bands
        .map((band) => formatter(report.byRankBand[band][key]))
        .join(" | ")} |`,
    ),
    "",
    "## Candidate rules for human review",
    "",
    ...(report.ruleCandidates.length > 0
      ? report.ruleCandidates.map((candidate) =>
          `- ${candidate.finding} (${candidate.evidence})`,
        )
      : ["- No rank-band difference cleared the conservative evidence threshold."]),
    "",
    "## Method limits",
    "",
    "- The leaderboard contains only creators who opted into a contest.",
    "- Rank reflects total revenue, not the isolated effect of profile copy.",
    "- Repeated creators are reported separately to reduce winner-persistence bias.",
    "- Aggregate findings may inform prompts; raw phrases must never become templates.",
    ...report.warnings.map((warning) => `- ${warning}`),
    "",
  ];
  return lines.join("\n");
}

function validateDataset(dataset) {
  if (!dataset || typeof dataset !== "object") throw new Error("Input must be an object.");
  if (!authorizationBases.has(dataset.source?.authorizationBasis)) {
    throw new Error(
      "source.authorizationBasis must document Fansly permission or a client-authorized export.",
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(dataset.source?.collectedAt ?? "")) {
    throw new Error("source.collectedAt must be an ISO timestamp.");
  }
  if (!Array.isArray(dataset.snapshots) || dataset.snapshots.length === 0) {
    throw new Error("At least one leaderboard snapshot is required.");
  }
  if (dataset.snapshots.length > 24) throw new Error("A maximum of 24 snapshots is supported.");

  const seenMonths = new Set();
  for (const snapshot of dataset.snapshots) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(snapshot.month ?? "")) {
      throw new Error(`Invalid snapshot month: ${snapshot.month ?? "missing"}.`);
    }
    if (seenMonths.has(snapshot.month)) throw new Error(`Duplicate month: ${snapshot.month}.`);
    seenMonths.add(snapshot.month);
    if (!Array.isArray(snapshot.entries) || snapshot.entries.length === 0) {
      throw new Error(`${snapshot.month} has no entries.`);
    }
    if (snapshot.entries.length > 500) {
      throw new Error(`${snapshot.month} exceeds the public top-500 limit.`);
    }
    const ranks = new Set();
    for (const entry of snapshot.entries) {
      if (!Number.isInteger(entry.rank) || entry.rank < 1 || entry.rank > 500) {
        throw new Error(`${snapshot.month} contains an invalid rank.`);
      }
      if (ranks.has(entry.rank)) throw new Error(`${snapshot.month} repeats rank ${entry.rank}.`);
      ranks.add(entry.rank);
      if (typeof entry.username !== "string" || !entry.username.trim()) {
        throw new Error(`${snapshot.month} rank ${entry.rank} has no username.`);
      }
      if (typeof entry.bio !== "string") {
        throw new Error(`${snapshot.month} rank ${entry.rank} has no bio string.`);
      }
    }
  }
}

function buildRecord(month, entry) {
  const bio = entry.bio.replace(/\s+/g, " ").trim();
  const words = bio ? bio.split(/\s+/).filter(Boolean) : [];
  return {
    month,
    rank: entry.rank,
    rankBand: rankBand(entry.rank),
    creatorKey: entry.username.trim().toLowerCase(),
    wordCount: words.length,
    sentenceCount: bio ? bio.split(/[.!?]+/).filter((part) => part.trim()).length : 0,
    emojiCount: bio.match(/\p{Extended_Pictographic}/gu)?.length ?? 0,
    ...Object.fromEntries(
      Object.entries(featureDefinitions).map(([name, pattern]) => [name, pattern.test(bio)]),
    ),
  };
}

function rankBand(rank) {
  if (rank <= 25) return "1-25";
  if (rank <= 100) return "26-100";
  if (rank <= 250) return "101-250";
  return "251-500";
}

function summarize(records) {
  if (records.length === 0) {
    return {
      count: 0,
      meanWordCount: 0,
      medianWordCount: 0,
      p25WordCount: 0,
      p75WordCount: 0,
      meanSentenceCount: 0,
      meanEmojiCount: 0,
      ...Object.fromEntries(rateMetrics.map((metric) => [metric, 0])),
    };
  }
  const wordCounts = records.map((record) => record.wordCount).sort((a, b) => a - b);
  return {
    count: records.length,
    meanWordCount: mean(records.map((record) => record.wordCount)),
    medianWordCount: percentile(wordCounts, 0.5),
    p25WordCount: percentile(wordCounts, 0.25),
    p75WordCount: percentile(wordCounts, 0.75),
    meanSentenceCount: mean(records.map((record) => record.sentenceCount)),
    meanEmojiCount: mean(records.map((record) => record.emojiCount)),
    ...Object.fromEntries(
      Object.keys(featureDefinitions).map((name) => [
        `${name}Rate`,
        mean(records.map((record) => (record[name] ? 1 : 0))),
      ]),
    ),
  };
}

function compareBands(top, lower) {
  return Object.fromEntries(
    ["meanWordCount", "medianWordCount", ...rateMetrics].map((metric) => [
      metric,
      Number((top[metric] - lower[metric]).toFixed(4)),
    ]),
  );
}

function deriveRuleCandidates(top, lower) {
  if (top.count < 20 || lower.count < 20) return [];
  const labels = {
    directReaderRate: "Top-ranked bios address the reader directly more often",
    conversationCtaRate: "Top-ranked bios use conversation CTAs more often",
    questionRate: "Top-ranked bios close or engage with questions more often",
    textingShorthandRate: "Top-ranked bios use texting shorthand more often",
    sceneSignalRate: "Top-ranked bios use scene-building language more often",
    contrastSignalRate: "Top-ranked bios use tension or reversal language more often",
    salesLanguageRate: "Top-ranked bios use sales language more often",
  };
  return Object.entries(labels).flatMap(([metric, finding]) => {
    const difference = top[metric] - lower[metric];
    if (Math.abs(difference) < 0.1) return [];
    const direction = difference > 0 ? "+" : "";
    return [
      {
        metric,
        finding:
          difference > 0
            ? finding
            : finding.replace("more often", "less often"),
        evidence: `${direction}${(difference * 100).toFixed(1)} percentage points, top 25 vs ranks 251-500`,
      },
    ];
  });
}

function buildWarnings(snapshots, records, uniqueCreatorCount) {
  const warnings = [];
  if (snapshots.length < 3) warnings.push("Fewer than three snapshots limits temporal inference.");
  if (snapshots.some((snapshot) => snapshot.entries.length < 500)) {
    warnings.push("At least one snapshot is incomplete; rank-band rates may be unbalanced.");
  }
  if (uniqueCreatorCount < records.length * 0.6) {
    warnings.push("Repeated creators dominate the entry-weighted sample; prioritize creator-weighted results.");
  }
  return warnings;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const inputPath = argument("input");
  const jsonPath = argument("json");
  const markdownPath = argument("markdown");
  if (!inputPath || !jsonPath || !markdownPath) {
    throw new Error(
      "Usage: pnpm analyze:leaderboard --input <authorized.json> --json <report.json> --markdown <report.md>",
    );
  }
  const dataset = JSON.parse(await readFile(inputPath, "utf8"));
  const report = analyzeLeaderboardDataset(dataset);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, formatLeaderboardMarkdown(report), "utf8");
  console.log(markdownPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
