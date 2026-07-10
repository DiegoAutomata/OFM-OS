import { describe, expect, it } from "vitest";
import {
  analyzeLeaderboardDataset,
  formatLeaderboardMarkdown,
} from "./analyze-fansly-leaderboard.mjs";

const authorizedDataset = {
  source: {
    authorizationBasis: "client_authorized_export",
    collectedAt: "2026-07-10T12:00:00.000Z",
    description: "Synthetic test fixture",
  },
  snapshots: [
    {
      month: "2026-05",
      entries: [
        {
          rank: 1,
          username: "scene_creator",
          bio: "Im Mia and I notice u watching when I walk into the gym lol. I act focused till your form starts falling apart, then I make the set last longer just to test u. Dm me and tell me what breaks first, your confidence or your focus?",
        },
        {
          rank: 300,
          username: "sales_creator",
          bio: "Welcome to my page. Subscribe for daily posts, customs, bundles, discounts and free trials. New content is available every week and there are several subscription options for every fan.",
        },
      ],
    },
    {
      month: "2026-06",
      entries: [
        {
          rank: 2,
          username: "scene_creator",
          bio: "Im Mia and I know u lose focus when I start training lol. I keep counting reps till u forget what number comes next, then smile like I had nothing to do with it. Dm me and tell me if u need a stricter coach tonight?",
        },
        {
          rank: 400,
          username: "generic_creator",
          bio: "This is a creator profile with photos and videos. New posts appear frequently. Subscription tiers provide access to different parts of the page and promotional offers may be available.",
        },
      ],
    },
  ],
};

describe("authorized Fansly leaderboard analysis", () => {
  it("separates entry-weighted and creator-weighted coverage", () => {
    const report = analyzeLeaderboardDataset(authorizedDataset);
    expect(report.coverage).toMatchObject({
      snapshotCount: 2,
      entryCount: 4,
      uniqueCreatorCount: 3,
      repeatedCreatorEntries: 1,
    });
    expect(report.byRankBand["1-25"].directReaderRate).toBe(1);
    expect(report.byRankBand["251-500"].salesLanguageRate).toBe(1);
    expect(report.creatorWeighted.count).toBe(3);
  });

  it("produces an aggregate Markdown report without usernames or raw bios", () => {
    const markdown = formatLeaderboardMarkdown(
      analyzeLeaderboardDataset(authorizedDataset),
    );
    expect(markdown).toContain("Rank-band patterns");
    expect(markdown).not.toContain("scene_creator");
    expect(markdown).not.toContain("your confidence or your focus");
  });

  it("rejects datasets without an authorized provenance", () => {
    expect(() =>
      analyzeLeaderboardDataset({
        ...authorizedDataset,
        source: { ...authorizedDataset.source, authorizationBasis: "scraped" },
      }),
    ).toThrow("authorizationBasis");
  });
});
