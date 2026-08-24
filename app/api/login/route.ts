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

export async function POST() {
  return NextResponse.json(
    { error: "Mailbox login is turned off on this portfolio demo." },
    { status: 403 },
  );
}
