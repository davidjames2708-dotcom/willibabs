import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { isResendConfigured, publicMailSetup, readMailSetup, writeMailSetup, type MailSetup } from "../setup-store";
import { requireSession } from "../session-utils";

export const runtime = "nodejs";

type SetupPayload = Partial<MailSetup> & {
  test?: boolean;
};

function clean(value = "") {
  return value.trim();
}

function port(value: unknown, fallback: number) {
  const nextPort = Number(value);
  return Number.isInteger(nextPort) && nextPort > 0 && nextPort < 65536 ? nextPort : fallback;
}

function resendStatus() {
  return isResendConfigured()
    ? { ok: true, message: "Resend API key is configured for sending." }
    : { ok: false, message: "Resend API key is not configured." };
}

async function testImap(setup: MailSetup) {
  if (!setup.imapHost || !setup.imapUser || !setup.imapPass) {
    return { ok: false, message: "IMAP host, username, and password are required." };
  }

  const client = new ImapFlow({
    host: setup.imapHost,
    port: setup.imapPort,
    secure: setup.imapSecure,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 30000,
    auth: { user: setup.imapUser, pass: setup.imapPass },
    tls: { rejectUnauthorized: process.env.IMAP_TLS_REJECT_UNAUTHORIZED !== "false" }
  });

  try {
    await client.connect();
    return { ok: true, message: "IMAP connection verified." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "IMAP connection failed." };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

async function testSmtp(setup: MailSetup) {
  if (!setup.smtpHost || !setup.smtpUser || !setup.smtpPass) {
    return { ok: false, message: "SMTP host, username, and password are required." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: setup.smtpHost,
      port: setup.smtpPort,
      secure: setup.smtpSecure,
      auth: { user: setup.smtpUser, pass: setup.smtpPass }
    });

    await transporter.verify();
    return { ok: true, message: "SMTP connection verified." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "SMTP connection failed." };
  }
}

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json({ ok: true, setup: publicMailSetup(await readMailSetup()) });
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const current = await readMailSetup();
  const payload = (await request.json()) as SetupPayload;
  const setup: MailSetup = {
    mailboxAddress: clean(payload.mailboxAddress) || current.mailboxAddress,
    mailDomain: clean(payload.mailDomain) || clean(payload.mailboxAddress).split("@")[1] || current.mailDomain,
    imapHost: clean(payload.imapHost),
    imapPort: port(payload.imapPort, 993),
    imapSecure: Boolean(payload.imapSecure),
    imapUser: clean(payload.imapUser),
    imapPass: clean(payload.imapPass) || current.imapPass,
    smtpHost: clean(payload.smtpHost),
    smtpPort: port(payload.smtpPort, 587),
    smtpSecure: Boolean(payload.smtpSecure),
    smtpUser: clean(payload.smtpUser),
    smtpPass: clean(payload.smtpPass) || current.smtpPass,
    mailFrom: clean(payload.mailFrom) || clean(payload.mailboxAddress) || current.mailFrom
  };

  if (!setup.mailboxAddress.includes("@")) {
    return NextResponse.json({ error: "A valid mailbox address is required." }, { status: 400 });
  }

  if (payload.test) {
    const [imap, smtp] = await Promise.all([testImap(setup), isResendConfigured() ? resendStatus() : testSmtp(setup)]);
    if (!imap.ok || !smtp.ok) {
      return NextResponse.json({ error: "One or more connection tests failed.", imap, smtp }, { status: 422 });
    }
  }

  await writeMailSetup(setup);

  return NextResponse.json({
    ok: true,
    setup: publicMailSetup(setup),
    message: payload.test ? "Mail setup saved and verified." : "Mail setup saved."
  });
}
