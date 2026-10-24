import crypto from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM

export function encryptToken(plainText: string): string {
  if (!plainText) return "";
  const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Output: iv:tag:ciphertext
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptToken(encryptedData: string): string {
  if (!encryptedData) return "";
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function generateIdempotencyKey(parts: string[]): string {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}
