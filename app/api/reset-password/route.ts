import { NextResponse } from "next/server";
import { configuredLoginEmail, setLocalPassword } from "../auth-store";

export const runtime = "nodejs";

const MAX_RESET_ATTEMPTS = 4;
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_LOCKOUT_MS = 60 * 60 * 1000;

type ResetAttempt = {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
};

const resetAttempts = new Map<string, ResetAttempt>();

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
  resetAttempts.delete(key);
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const current = resetAttempts.get(key);

  if (!current || now - current.firstAttemptAt > RESET_WINDOW_MS) {
    resetAttempts.set(key, { count: 1, firstAttemptAt: now, lockedUntil: 0 });
    return;
  }

  const nextCount = current.count + 1;
  resetAttempts.set(key, {
    count: nextCount,
    firstAttemptAt: current.firstAttemptAt,
    lockedUntil: nextCount >= MAX_RESET_ATTEMPTS ? now + RESET_LOCKOUT_MS : current.lockedUntil
  });
}

function isLocked(key: string) {
  const current = resetAttempts.get(key);

  if (!current?.lockedUntil) {
    return false;
  }

  if (current.lockedUntil <= Date.now()) {
    resetAttempts.delete(key);
    return false;
  }

  return true;
}

function hasStrongPassword(password: string) {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function genericResetError(status = 401) {
  return NextResponse.json({ error: "Password reset could not be completed. Check the details and try again." }, { status });
}

export async function POST(request: Request) {
  const { email, resetCode, password, confirmPassword } = (await request.json()) as {
    email?: string;
    resetCode?: string;
    password?: string;
    confirmPassword?: string;
  };
  const normalizedEmail = normalizeEmail(email);
  const expectedEmail = configuredLoginEmail();
  const configuredResetCode = process.env.WEBMAIL_RESET_CODE;
  const key = attemptKey(normalizedEmail, request);

  if (!configuredResetCode) {
    return NextResponse.json({ error: "Password reset is not configured. Add WEBMAIL_RESET_CODE on the server." }, { status: 503 });
  }

  if (isLocked(key)) {
    return NextResponse.json({ error: "Too many reset attempts. Try again later." }, { status: 429 });
  }

  if (!normalizedEmail || !resetCode || !password || !confirmPassword) {
    recordFailedAttempt(key);
    return genericResetError(400);
  }

  if (expectedEmail && normalizedEmail !== expectedEmail) {
    recordFailedAttempt(key);
    return genericResetError();
  }

  if (resetCode !== configuredResetCode) {
    recordFailedAttempt(key);
    return genericResetError();
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: "The new passwords do not match." }, { status: 400 });
  }

  if (!hasStrongPassword(password)) {
    return NextResponse.json({ error: "Use at least 12 characters with uppercase, lowercase, number, and symbol." }, { status: 400 });
  }

  await setLocalPassword(normalizedEmail, password);
  resetAttempt(key);

  return NextResponse.json({
    ok: true,
    message: "Password reset. You can log in with the new password now."
  });
}
