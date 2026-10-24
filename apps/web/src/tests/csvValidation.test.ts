import { parseRecipientsContent } from "@reachinbox/shared";
import { describe, expect, it } from "vitest";

describe("Frontend CSV and Recipient Parsing Tests", () => {
  it("extracts multiple emails and eliminates duplicates", () => {
    const raw = "alice@domain.com, bob@domain.com, ALICE@DOMAIN.COM";
    const result = parseRecipientsContent(raw);

    expect(result.valid).toEqual(["alice@domain.com", "bob@domain.com"]);
    expect(result.duplicates).toEqual(["alice@domain.com"]);
  });

  it("identifies bad email strings and maintains invalid list", () => {
    const raw = "good@domain.com, notanemail, bad@domain";
    const result = parseRecipientsContent(raw);

    expect(result.valid).toEqual(["good@domain.com"]);
    expect(result.invalid).toContain("notanemail");
    expect(result.invalid).toContain("bad@domain");
  });
});
