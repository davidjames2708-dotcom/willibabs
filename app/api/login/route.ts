import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import {
  configuredLoginEmail,
  configuredLoginPassword,
  hasAnyLocalPassword,
  hasLocalPassword,
  setLocalPassword,
  validateLocalPassword
} from "../auth-store";
import { configuredClient } from "../mail-utils";
import { setSessionCookie } from "../session-utils";
import { readMailSetup } from "../setup-store";

export const runtime = "nodejs";

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
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
  const expectedEmail = configuredLoginEmail() || normalizeEmail(setup.mailboxAddress);
  const configuredPassword = configuredLoginPassword();
  const localAuthExists = await hasAnyLocalPassword();

  if (!normalizedEmail || !password) {
    return NextResponse.json({ error: "Email address and password are required." }, { status: 400 });
  }

  if (expectedEmail && localAuthExists && normalizedEmail !== expectedEmail) {
    return NextResponse.json({ error: "This mailbox is not available on this webmail." }, { status: 401 });
  }

  let authenticated = false;
  let imapError = "";

  if (configuredPassword) {
    authenticated = password === configuredPassword;
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
    return NextResponse.json({ error: "Invalid email address or password." }, { status: 401 });
  }

  const client = await configuredClient();
  const response = NextResponse.json({ ok: true, mode: client ? "imap" : "demo", warning: imapError || undefined });
  await setSessionCookie(response, normalizedEmail, password);

  return response;
}
