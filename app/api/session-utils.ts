import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "priscilla_mail_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const SESSION_VERSION = 5;

type SessionRecord = {
  email: string;
  password?: string;
  expiresAt: number;
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

function encodeSession(record: SessionRecord) {
  return Buffer.from(JSON.stringify(record), "utf8").toString("base64url");
}

function createSessionToken(record: SessionRecord) {
  const payload = encodeSession(record);
  return `${SESSION_VERSION}.${payload}.${sign(`${SESSION_VERSION}.${payload}`)}`;
}

function readSessionToken(token?: string) {
  const [version, payload, signature] = token?.split(".") ?? [];

  if (version !== String(SESSION_VERSION) || !payload || !signature) {
    return null;
  }

  if (!timingSafeEqual(sign(`${version}.${payload}`), signature)) {
    return null;
  }

  try {
    const record = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionRecord;

    if (!record.email || record.expiresAt <= Date.now()) {
      return null;
    }

    return record;
  } catch {
    return null;
  }
}

export async function createSession(email: string, password: string) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;

  return createSessionToken({
    email,
    password: encryptSecret(password),
    expiresAt
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const record = readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);

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
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
