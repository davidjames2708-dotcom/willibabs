import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type MailSetup = {
  mailboxAddress: string;
  mailDomain: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPass?: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass?: string;
  mailFrom: string;
  updatedAt?: string;
};

const setupPath = path.join(process.cwd(), ".dist", "setup.json");

function secretKey() {
  return crypto
    .createHash("sha256")
    .update(process.env.SETUP_SECRET || process.env.SESSION_SECRET || "priscilla-dev-setup-secret")
    .digest();
}

function encryptSecret(value = "") {
  if (!value) {
    return "";
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSecret(value = "") {
  if (!value) {
    return "";
  }

  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) {
      return "";
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return "";
  }
}

function envSetup(): MailSetup {
  const mailboxAddress = process.env.NEXT_PUBLIC_MAILBOX_ADDRESS || process.env.IMAP_USER || process.env.SMTP_USER || "";

  return {
    mailboxAddress,
    mailDomain: process.env.NEXT_PUBLIC_MAIL_DOMAIN || mailboxAddress.split("@")[1] || "",
    imapHost: process.env.IMAP_HOST || "",
    imapPort: Number(process.env.IMAP_PORT || 993),
    imapSecure: process.env.IMAP_SECURE !== "false",
    imapUser: process.env.IMAP_USER || process.env.SMTP_USER || mailboxAddress,
    imapPass: process.env.IMAP_PASS || process.env.MAILBOX_PASSWORD || "",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpSecure: process.env.SMTP_SECURE === "true",
    smtpUser: process.env.SMTP_USER || process.env.IMAP_USER || mailboxAddress,
    smtpPass: process.env.SMTP_PASS || process.env.MAILBOX_PASSWORD || "",
    mailFrom: process.env.MAIL_FROM || mailboxAddress
  };
}

async function fileSetup() {
  try {
    const stored = JSON.parse(await fs.readFile(setupPath, "utf8")) as MailSetup;

    return {
      ...stored,
      imapPass: decryptSecret(stored.imapPass),
      smtpPass: decryptSecret(stored.smtpPass)
    };
  } catch {
    return null;
  }
}

export async function readMailSetup(): Promise<MailSetup> {
  const env = envSetup();
  const stored = await fileSetup();

  if (!stored) {
    return env;
  }

  return {
    ...env,
    ...stored,
    imapPass: stored.imapPass || env.imapPass,
    smtpPass: stored.smtpPass || env.smtpPass
  };
}

export async function writeMailSetup(setup: MailSetup) {
  await fs.mkdir(path.dirname(setupPath), { recursive: true });
  await fs.writeFile(
    setupPath,
    JSON.stringify(
      {
        ...setup,
        imapPass: encryptSecret(setup.imapPass),
        smtpPass: encryptSecret(setup.smtpPass),
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )
  );
}

export function publicMailSetup(setup: MailSetup) {
  return {
    mailboxAddress: setup.mailboxAddress,
    mailDomain: setup.mailDomain,
    imapHost: setup.imapHost,
    imapPort: setup.imapPort,
    imapSecure: setup.imapSecure,
    imapUser: setup.imapUser,
    imapPassConfigured: hasUsableSecret(setup.imapPass),
    smtpHost: setup.smtpHost,
    smtpPort: setup.smtpPort,
    smtpSecure: setup.smtpSecure,
    smtpUser: setup.smtpUser,
    smtpPassConfigured: hasUsableSecret(setup.smtpPass),
    mailFrom: setup.mailFrom,
    updatedAt: setup.updatedAt
  };
}

function hasUsableSecret(value = "") {
  const normalized = value.trim().toLowerCase();
  return Boolean(
    normalized &&
      !normalized.startsWith("your-") &&
      !normalized.includes("your_") &&
      !normalized.includes("change-this") &&
      !normalized.includes("placeholder")
  );
}

export function isImapConfigured(setup: MailSetup) {
  return Boolean(setup.imapHost && setup.imapUser && hasUsableSecret(setup.imapPass));
}

export function isSmtpConfigured(setup: MailSetup) {
  return Boolean(setup.smtpHost && setup.smtpUser && hasUsableSecret(setup.smtpPass) && setup.mailFrom);
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}
