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

export async function POST() {
  return NextResponse.json(
    { error: "Password reset is turned off on this portfolio demo." },
    { status: 403 },
  );
}
