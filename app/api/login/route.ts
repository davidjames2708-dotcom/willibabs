import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import {
  configuredLoginEmail,
  configuredLoginPassword,
  configuredLoginPasswords,
  hasAnyLocalPassword,
  hasLocalPassword,
  setLocalPassword,
  validateLocalPassword
} from "../auth-store";
import { configuredClient } from "../mail-utils";
import { setSessionCookie } from "../session-utils";
import { readMailSetup } from "../setup-store";

export const runtime = "nodejs";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 60 * 60 * 1000;

type LoginAttempt = {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
};

const loginAttempts = new Map<string, LoginAttempt>();

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function attemptKey(email: string, request: Request) {
  return `${email || "unknown"}:${clientIp(request)}`;
}

function resetAttempt(key: string) {
  loginAttempts.delete(key);
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || now - current.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: now, lockedUntil: 0 });
    return;
  }

  const nextCount = current.count + 1;
  loginAttempts.set(key, {
    count: nextCount,
    firstAttemptAt: current.firstAttemptAt,
    lockedUntil: nextCount >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_LOCKOUT_MS : current.lockedUntil
  });
}

function isLocked(key: string) {
  const current = loginAttempts.get(key);

  if (!current?.lockedUntil) {
    return false;
  }

  if (current.lockedUntil <= Date.now()) {
    loginAttempts.delete(key);
    return false;
  }

  return true;
}

function imapLoginMessage(error: unknown, host: string, port: number) {
  const details = error as { code?: string; response?: string; message?: string };

  if (details.code === "ETIMEDOUT" || details.message?.includes("Failed to establish connection")) {
    return `Could not reach the IMAP server at ${host}:${port}. Check the incoming server host from your hosting panel.`;
  }

  if (details.code === "ECONNREFUSED") {
    return `The IMAP server refused the connection at ${host}:${port}. Check the IMAP port and SSL settings.`;
  }

  if (details.response) {
    return details.response;
  }

  return details.message || "Mailbox login failed. Check the IMAP host, port, email address, and password.";
}

async function validateImapLogin(email: string, password: string) {
  const setup = await readMailSetup();
  const host = setup.imapHost;
  const port = setup.imapPort;

  if (!host || !password) {
    return false;
  }

  const client = new ImapFlow({
    host,
    port,
    secure: setup.imapSecure,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 30000,
    auth: { user: email, pass: password },
    tls: {
      rejectUnauthorized: process.env.IMAP_TLS_REJECT_UNAUTHORIZED !== "false"
    }
  });

  try {
    await client.connect();
    return true;
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as { email?: string; password?: string };
  const setup = await readMailSetup();
  const normalizedEmail = normalizeEmail(email);
  const key = attemptKey(normalizedEmail, request);
  const expectedEmail = configuredLoginEmail() || normalizeEmail(setup.mailboxAddress);
  const configuredPassword = configuredLoginPassword();
  const configuredPasswords = configuredLoginPasswords();
  const localAuthExists = await hasAnyLocalPassword();

  if (isLocked(key)) {
    return NextResponse.json({ error: "Too many failed login attempts. Try again later." }, { status: 429 });
  }

  if (!normalizedEmail || !password) {
    recordFailedAttempt(key);
    return NextResponse.json({ error: "Email address and password are required." }, { status: 400 });
  }

  if (expectedEmail && localAuthExists && normalizedEmail !== expectedEmail) {
    recordFailedAttempt(key);
    return NextResponse.json({ error: "This mailbox is not available on this webmail." }, { status: 401 });
  }

  let authenticated = false;
  let imapError = "";

  if (configuredPasswords.length) {
    authenticated = configuredPasswords.includes(password);
  }

  if (!authenticated && (await hasLocalPassword(normalizedEmail))) {
    authenticated = await validateLocalPassword(normalizedEmail, password);
  }

  if (!authenticated && setup.imapHost) {
    try {
      authenticated = await validateImapLogin(normalizedEmail, password);
    } catch (error) {
      imapError = imapLoginMessage(error, setup.imapHost, setup.imapPort);
    }
  }

  if (!authenticated && !localAuthExists && !configuredPassword && !setup.imapHost) {
    if (password.length < 8) {
      return NextResponse.json({ error: "Use at least 8 characters for the first login password." }, { status: 400 });
    }

    await setLocalPassword(normalizedEmail, password);
    authenticated = true;
  }

  if (!authenticated) {
    recordFailedAttempt(key);
    return NextResponse.json({ error: "Invalid email address or password." }, { status: 401 });
  }

  resetAttempt(key);

  const client = await configuredClient();
  const response = NextResponse.json({ ok: true, mode: client ? "imap" : "demo", warning: imapError || undefined });
  await setSessionCookie(response, normalizedEmail, password);

  return response;
}
