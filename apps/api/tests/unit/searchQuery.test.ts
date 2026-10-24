import { describe, expect, it } from "vitest";
import { EmailSearchQuerySchema } from "@reachinbox/shared";

describe("Search Query Schema & Filtering Tests", () => {
  it("validates and defaults pagination parameters", () => {
    const parsed = EmailSearchQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });

  it("accepts valid search queries with status and dates", () => {
    const input = {
      q: "follow-up proposal",
      status: "scheduled",
      page: "2",
      limit: "50",
      startDate: "2026-10-24T00:00:00.000Z",
    };
    const parsed = EmailSearchQuerySchema.parse(input);
    expect(parsed.q).toBe("follow-up proposal");
    expect(parsed.status).toBe("scheduled");
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
  });

  it("rejects invalid status filters", () => {
    expect(() =>
      EmailSearchQuerySchema.parse({
        status: "non_existent_status",
      })
    ).toThrow();
  });
});
