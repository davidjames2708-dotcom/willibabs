import crypto from "crypto";
import { promises as fs } from "fs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import path from "path";

const SESSION_COOKIE = "priscilla_mail_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const SESSION_VERSION = 4;
const sessionsPath = path.join(process.cwd(), ".dist", "sessions.json");

type SessionRecord = {
  id: string;
  email: string;
  password?: string;
  expiresAt: number;
  createdAt: string;
};

function sessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.WEBMAIL_LOGIN_PASSWORD ||
    process.env.SMTP_PASS ||
    "priscilla-dev-session-secret"
  );
}

function sign(value: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function encryptionKey() {
  return crypto.createHash("sha256").update(sessionSecret()).digest();
}

function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSecret(value?: string) {
  if (!value) {
    return "";
  }

  const [ivValue, tagValue, encryptedValue] = value.split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    return "";
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function readSessionRecords() {
  try {
    const records = JSON.parse(await fs.readFile(sessionsPath, "utf8")) as SessionRecord[];
    const now = Date.now();
    return records.filter((record) => record.expiresAt > now);
  } catch {
    return [];
  }
}

async function writeSessionRecords(records: SessionRecord[]) {
  await fs.mkdir(path.dirname(sessionsPath), { recursive: true });
  await fs.writeFile(sessionsPath, JSON.stringify(records, null, 2));
}

function createSessionToken(sessionId: string) {
  return `${SESSION_VERSION}.${sessionId}.${sign(`${SESSION_VERSION}.${sessionId}`)}`;
}

function readSessionId(token?: string) {
  const [version, sessionId, signature] = token?.split(".") ?? [];

  if (version !== String(SESSION_VERSION) || !sessionId || !signature) {
    return null;
  }

  if (!timingSafeEqual(sign(`${version}.${sessionId}`), signature)) {
    return null;
  }

  return sessionId;
}

export async function createSession(email: string, password: string) {
  const records = await readSessionRecords();
  const id = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;

  await writeSessionRecords([
    {
      id,
      email,
      password: encryptSecret(password),
      expiresAt,
      createdAt: new Date().toISOString()
    },
    ...records.filter((record) => record.email !== email)
  ]);

  return createSessionToken(id);
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = readSessionId(cookieStore.get(SESSION_COOKIE)?.value);

  if (!sessionId) {
    return null;
  }

  const records = await readSessionRecords();
  const record = records.find((item) => item.id === sessionId);

  if (!record) {
    return null;
  }

  return {
    email: record.email,
    password: decryptSecret(record.password)
  };
}

export async function hasValidSession() {
  return Boolean(await getSession());
}

export async function requireSession() {
  if (await hasValidSession()) {
    return null;
  }

  return NextResponse.json({ error: "Your mailbox session has expired. Please unlock the mailbox again." }, { status: 401 });
}

export async function setSessionCookie(response: NextResponse, email: string, password: string) {
  response.cookies.set(SESSION_COOKIE, await createSession(email, password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });
}

export async function clearSessionCookie(response: NextResponse) {
  const cookieStore = await cookies();
  const sessionId = readSessionId(cookieStore.get(SESSION_COOKIE)?.value);

  if (sessionId) {
    const records = await readSessionRecords();
    await writeSessionRecords(records.filter((record) => record.id !== sessionId));
  }

  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
