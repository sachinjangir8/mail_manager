import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, generateIdempotencyKey } from "../../src/utils/crypto";

describe("Crypto & Security Token Encryption Tests", () => {
  it("encrypts and decrypts OAuth tokens accurately using AES-256-GCM", () => {
    const secretToken = "xoxb-1234567890-slack-super-secret-token";
    const encrypted = encryptToken(secretToken);

    expect(encrypted).not.toBe(secretToken);
    expect(encrypted.split(":")).toHaveLength(3); // iv:tag:ciphertext

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(secretToken);
  });

  it("throws an error when tampering with ciphertext or auth tag", () => {
    const secret = "test-token-secret";
    const encrypted = encryptToken(secret);
    const [iv, tag, ciphertext] = encrypted.split(":");

    // Alter ciphertext
    const tamperedCipher = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === "aa" ? "bb" : "aa");
    const tamperedPayload = `${iv}:${tag}:${tamperedCipher}`;

    expect(() => decryptToken(tamperedPayload)).toThrow();
  });

  it("produces deterministic SHA-256 idempotency keys", () => {
    const key1 = generateIdempotencyKey(["tenant_1", "campaign_1", "recipient@test.com", "0"]);
    const key2 = generateIdempotencyKey(["tenant_1", "campaign_1", "recipient@test.com", "0"]);
    const key3 = generateIdempotencyKey(["tenant_1", "campaign_1", "recipient@test.com", "1"]);

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toHaveLength(64); // SHA-256 hex
  });
});
