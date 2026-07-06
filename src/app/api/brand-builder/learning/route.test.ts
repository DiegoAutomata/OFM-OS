import { beforeEach, describe, expect, it, vi } from "vitest";

const listLearningFeedbackMock = vi.hoisted(() => vi.fn());
const reviewLearningFeedbackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  isOperatorAuthorized: vi.fn().mockResolvedValue(true),
  unauthorizedResponse: vi.fn(),
}));
vi.mock("@/features/brand-builder/storage", () => ({
  listLearningFeedback: listLearningFeedbackMock,
  reviewLearningFeedback: reviewLearningFeedbackMock,
}));

import { GET, PATCH } from "./route";

describe("/api/brand-builder/learning", () => {
  beforeEach(() => {
    listLearningFeedbackMock.mockReset();
    reviewLearningFeedbackMock.mockReset();
  });

  it("lists pending feedback for operator review", async () => {
    listLearningFeedbackMock.mockResolvedValue({
      entries: [{ id: "2cbf6435-1684-46df-bbf2-614ec9e56915", status: "pending" }],
    });
    const response = await GET(
      new Request("http://localhost/api/brand-builder/learning", {
        headers: { "x-operator-code": "admin" },
      }),
    );
    const payload = await response.json();
    expect(payload.entries).toHaveLength(1);
  });

  it("approves feedback with an explicit scope", async () => {
    const review = {
      id: "2cbf6435-1684-46df-bbf2-614ec9e56915",
      status: "approved",
      scope: "archetype",
    } as const;
    const response = await PATCH(
      new Request("http://localhost/api/brand-builder/learning", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-operator-code": "admin",
        },
        body: JSON.stringify(review),
      }),
    );
    expect(response.status).toBe(200);
    expect(reviewLearningFeedbackMock).toHaveBeenCalledWith(review);
  });
});
