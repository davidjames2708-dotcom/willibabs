import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { getSession, requireSession } from "../session-utils";
import { isSmtpConfigured, readMailSetup } from "../setup-store";

export const runtime = "nodejs";

type SendPayload = {
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  attachments?: Array<{
    name?: string;
    type?: string;
    content?: string;
  }>;
};

function header(value = "") {
  return value.replace(/\r?\n/g, " ").trim();
}

function htmlToText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function emailOnly(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? value.trim();
}

function splitRecipients(value = "") {
  return value
    .split(/[;,]/)
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

function isValidEmailAddress(value: string) {
  const email = emailOnly(value);
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email) && !email.includes("..");
}

function invalidRecipients(...values: Array<string | undefined>) {
  return values.flatMap((value) => splitRecipients(value ?? "")).filter((recipient) => !isValidEmailAddress(recipient));
}

function htmlBody(value: string) {
  return value.includes("<") ? value : value.replace(/\n/g, "<br />");
}

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

async function sendWithResend(message: {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments: SendPayload["attachments"];
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: message.from,
      to: splitRecipients(message.to),
      cc: splitRecipients(message.cc),
      bcc: splitRecipients(message.bcc),
      subject: message.subject,
      text: htmlToText(message.body),
      html: htmlBody(message.body),
      attachments: message.attachments
        ?.filter((attachment) => attachment.name && attachment.content)
        .map((attachment) => ({
          filename: attachment.name,
          content: attachment.content,
          content_type: attachment.type
        }))
    })
  });

  const result = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };

  if (!response.ok) {
    throw new Error(result.message || result.error || "Resend could not send the email.");
  }

  return result.id || "";
}

async function appendToSentFolder(message: {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}) {
  const session = await getSession();
  const setup = await readMailSetup();
  const host = setup.imapHost;
  const port = setup.imapPort;
  const user = setup.imapUser || session?.email || "";
  const pass = setup.imapPass || session?.password || "";

  if (!host || !user || !pass) {
    return false;
  }

  const sentFolder = process.env.IMAP_SENT_FOLDER ?? "Sent";
  const client = new ImapFlow({
    host,
    port,
    secure: setup.imapSecure,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 30000,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.IMAP_TLS_REJECT_UNAUTHORIZED !== "false"
    }
  });

  const rawMessage = [
    `From: ${header(message.from)}`,
    `To: ${header(message.to)}`,
    message.cc ? `Cc: ${header(message.cc)}` : "",
    message.bcc ? `Bcc: ${header(message.bcc)}` : "",
    `Subject: ${header(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    message.body.includes("<") ? message.body : htmlToText(message.body).replace(/\n/g, "<br />")
  ]
    .filter(Boolean)
    .join("\r\n");

  try {
    await client.connect();
    await client.append(sentFolder, rawMessage, ["\\Seen"], new Date());
    return true;
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const payload = (await request.json()) as SendPayload;
  const { from: requestedFrom, to, cc, bcc, subject, body, attachments = [] } = payload;
  const session = await getSession();

  if (!to || !subject || !body) {
    return NextResponse.json(
      { error: "Recipient, subject, and message body are required." },
      { status: 400 }
    );
  }

  const invalidAddresses = invalidRecipients(to, cc, bcc);

  if (invalidAddresses.length) {
    return NextResponse.json(
      {
        error: `Invalid email address${invalidAddresses.length === 1 ? "" : "es"}: ${invalidAddresses.join(", ")}`
      },
      { status: 400 }
    );
  }

  const setup = await readMailSetup();
  const host = setup.smtpHost;
  const port = setup.smtpPort;
  const user = setup.smtpUser || session?.email || "";
  const pass = setup.smtpPass || session?.password || "";
  const from = setup.mailFrom || requestedFrom || user;

  if (resendConfigured()) {
    const resendId = await sendWithResend({ from, to, cc, bcc, subject, body, attachments });
    const sentSynced = await appendToSentFolder({ from, to, cc, bcc, subject, body }).catch(() => false);

    return NextResponse.json({ ok: true, provider: "resend", resendId, sentSynced });
  }

  if (!isSmtpConfigured({ ...setup, smtpUser: user, smtpPass: pass, mailFrom: from })) {
    return NextResponse.json({
      ok: true,
      demo: true,
      message: "Resend or SMTP is not configured, so the message was saved to the demo Sent folder."
    });
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: setup.smtpSecure,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from,
    to,
    cc,
    bcc,
    subject,
    text: body,
    html: htmlBody(body),
    attachments: attachments
      .filter((attachment) => attachment.name && attachment.content)
      .map((attachment) => ({
        filename: attachment.name,
        content: attachment.content,
        encoding: "base64",
        contentType: attachment.type
      }))
  });

  const sentSynced = await appendToSentFolder({ from, to, cc, bcc, subject, body }).catch(() => false);

  return NextResponse.json({ ok: true, sentSynced });
}
