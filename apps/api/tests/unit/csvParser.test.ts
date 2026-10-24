import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail, parseRecipientsContent } from "@reachinbox/shared";

describe("Email CSV and Recipient Parser Unit Tests", () => {
  it("normalizes email addresses correctly (lowercase and trim)", () => {
    expect(normalizeEmail("   JOHN.DOE@EXAMPLE.COM  ")).toBe("john.doe@example.com");
  });

  it("validates valid and invalid email formats strictly", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user.name+tag@sub.domain.co")).toBe(true);
    expect(isValidEmail("invalid-email")).toBe(false);
    expect(isValidEmail("@missinguser.com")).toBe(false);
    expect(isValidEmail("missingdomain@")).toBe(false);
    expect(isValidEmail("user@domain..com")).toBe(false);
  });

  it("parses CSV with 'email' header and quoted fields", () => {
    const csvData = `email,name,company
"john@example.com","John Doe","Acme Corp"
"jane@domain.io","Jane Smith","Globex"
"invalid-email-address","Bad User","Fake"
`;
    const result = parseRecipientsContent(csvData);
    expect(result.valid).toEqual(["john@example.com", "jane@domain.io"]);
    expect(result.invalid).toEqual(["invalid-email-address"]);
    expect(result.duplicates).toEqual([]);
    expect(result.totalRaw).toBe(3);
  });

  it("removes duplicate recipients while preserving first occurrence", () => {
    const rawList = `
      test1@example.com
      test2@example.com
      TEST1@EXAMPLE.COM
      test3@example.com
      test2@example.com
    `;
    const result = parseRecipientsContent(rawList);
    expect(result.valid).toEqual(["test1@example.com", "test2@example.com", "test3@example.com"]);
    expect(result.duplicates).toEqual(["test1@example.com", "test2@example.com"]);
  });

  it("handles UTF-8 BOM, semicolons, tabs, and empty lines cleanly", () => {
    const content = `\uFEFFuserA@domain.com;123;ABC\n\n\nuserB@domain.com\t456\tXYZ\n`;
    const result = parseRecipientsContent(content);
    expect(result.valid).toContain("usera@domain.com");
    expect(result.valid).toContain("userb@domain.com");
    expect(result.invalid).toEqual([]);
  });
});
