import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

type AuthRecord = {
  email: string;
  salt: string;
  hash: string;
  updatedAt: string;
};

const authPath = path.join(process.cwd(), ".dist", "auth.json");

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64url");
}

async function readAuthRecords() {
  try {
    return JSON.parse(await fs.readFile(authPath, "utf8")) as AuthRecord[];
  } catch {
    return [];
  }
}

async function writeAuthRecords(records: AuthRecord[]) {
  await fs.mkdir(path.dirname(authPath), { recursive: true });
  await fs.writeFile(authPath, JSON.stringify(records, null, 2));
}

export async function hasLocalPassword(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const records = await readAuthRecords();
  return records.some((record) => record.email === normalizedEmail);
}

export async function hasAnyLocalPassword() {
  const records = await readAuthRecords();
  return records.length > 0;
}

export async function firstLocalLoginEmail() {
  const records = await readAuthRecords();
  return records[0]?.email ?? "";
}

export async function validateLocalPassword(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const records = await readAuthRecords();
  const record = records.find((item) => item.email === normalizedEmail);

  if (!record) {
    return false;
  }

  const expectedHash = hashPassword(password, record.salt);
  const left = Buffer.from(expectedHash);
  const right = Buffer.from(record.hash);

  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function setLocalPassword(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const records = await readAuthRecords();
  const salt = crypto.randomBytes(16).toString("base64url");
  const nextRecord: AuthRecord = {
    email: normalizedEmail,
    salt,
    hash: hashPassword(password, salt),
    updatedAt: new Date().toISOString()
  };
  const nextRecords = records.filter((record) => record.email !== normalizedEmail);

  await writeAuthRecords([nextRecord, ...nextRecords]);
}

export function configuredLoginEmail() {
  return normalizeEmail(
    process.env.WEBMAIL_LOGIN_EMAIL ||
      process.env.NEXT_PUBLIC_MAILBOX_ADDRESS ||
      process.env.IMAP_USER ||
      process.env.SMTP_USER ||
      ""
  );
}

export function configuredLoginPassword() {
  return process.env.WEBMAIL_LOGIN_PASSWORD || process.env.MAILBOX_PASSWORD || process.env.IMAP_PASS || process.env.SMTP_PASS || "";
}
