# Fansly Leaderboard Research Data Contract

This project does not crawl Fansly. Analysis accepts only data supplied under one of
these provenance conditions:

- `fansly_written_permission`: Fansly has authorized the collection and analysis;
- `client_authorized_export`: a client with the necessary rights supplied an export.

The analyzer intentionally consumes only leaderboard month, rank, public username and
public profile bio. Do not include images, videos, messages, subscriber data, legal
names, contact details or other private information.

## Input shape

```json
{
  "source": {
    "authorizationBasis": "client_authorized_export",
    "collectedAt": "2026-07-10T12:00:00.000Z",
    "description": "June 2026 leaderboard export"
  },
  "snapshots": [
    {
      "month": "2026-06",
      "entries": [
        {
          "rank": 1,
          "username": "public_username",
          "bio": "Public profile bio"
        }
      ]
    }
  ]
}
```

Each month may contain ranks 1-500 at most. Months and ranks must be unique within
their respective scopes.

## Analysis safeguards

- Reports contain aggregates, not usernames or raw biographies.
- Entry-weighted results describe leaderboard appearances.
- Creator-weighted results keep only the latest bio per creator to reduce repeated-
  winner bias.
- Rank-band differences are descriptive correlations. They do not establish that a
  bio caused revenue.
- A candidate prompt rule is emitted only when both comparison bands contain at least
  20 observations and differ by at least 10 percentage points.
- Raw wording from top creators must never be copied into OFMS prompts or canonical
  examples.
