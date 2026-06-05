import { NextResponse } from "next/server";
import { configuredLoginEmail, setLocalPassword } from "../auth-store";

export const runtime = "nodejs";

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
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

  if (!configuredResetCode) {
    return NextResponse.json({ error: "Password reset is not configured. Add WEBMAIL_RESET_CODE on the server." }, { status: 503 });
  }

  if (!normalizedEmail || !resetCode || !password || !confirmPassword) {
    return NextResponse.json({ error: "Email, reset code, new password, and confirmation are required." }, { status: 400 });
  }

  if (expectedEmail && normalizedEmail !== expectedEmail) {
    return NextResponse.json({ error: "This mailbox is not available on this webmail." }, { status: 401 });
  }

  if (resetCode !== configuredResetCode) {
    return NextResponse.json({ error: "Invalid reset code." }, { status: 401 });
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: "The new passwords do not match." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Use at least 8 characters for the new password." }, { status: 400 });
  }

  await setLocalPassword(normalizedEmail, password);

  return NextResponse.json({
    ok: true,
    message: "Password reset. You can log in with the new password now."
  });
}
