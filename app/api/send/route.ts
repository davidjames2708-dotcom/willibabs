import { after, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { getSession, requireSession } from "../session-utils";
import { saveStoredSentMessage } from "../sent-store";
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
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|tr|h[1-6])>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function sanitizeEmailHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?<\/embed>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"')
    .replace(/<font\s+([^>]*)>/gi, (_match, attrs: string) => {
      const styles: string[] = [];
      const face = attrs.match(/face=["']?([^"' >]+)/i)?.[1];
      const color = attrs.match(/color=["']?([^"' >]+)/i)?.[1];
      const size = attrs.match(/size=["']?([^"' >]+)/i)?.[1];
      const sizeMap: Record<string, string> = { "1": "8pt", "2": "10pt", "3": "12pt", "4": "14pt", "5": "18pt", "6": "24pt", "7": "32pt" };

      if (face) {
        styles.push(`font-family: ${face}`);
      }
      if (color) {
        styles.push(`color: ${color}`);
      }
      if (size && sizeMap[size]) {
        styles.push(`font-size: ${sizeMap[size]}`);
      }

      return styles.length ? `<span style="${styles.join("; ")}">` : "<span>";
    })
    .replace(/<\/font>/gi, "</span>")
    .trim();
}

function emailHtmlBody(value: string) {
  const sanitized = sanitizeEmailHtml(value);

  if (!sanitized) {
    return "";
  }

  return `<!doctype html><html><body style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:14px; line-height:1.5; color:#111827;">${sanitized}</body></html>`;
}

function cleanOutgoingBody(value: string) {
  const html = sanitizeEmailHtml(value);
  const readable = htmlToText(html);

  if (!readable || readable === "..." || readable === "â€¦" || readable === "…") {
    return { html: "", text: "" };
  }

  return { html: emailHtmlBody(html), text: readable };
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
      html: message.body,
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
    message.body
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

async function saveSentMessageFallback(message: {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments?: SendPayload["attachments"];
}) {
  return saveStoredSentMessage(message).catch(() => null);
}

function syncSentAfterResponse(message: {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}) {
  after(async () => {
    await appendToSentFolder(message).catch(() => false);
  });
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
  const cleanBody = cleanOutgoingBody(body);

  if (!cleanBody.text) {
    return NextResponse.json(
      { error: "Message body is required." },
      { status: 400 }
    );
  }

  if (resendConfigured()) {
    try {
      const resendId = await sendWithResend({ from, to, cc, bcc, subject, body: cleanBody.html, attachments });
      const sentMessage = await saveSentMessageFallback({ from, to, subject, body: cleanBody.html, attachments });
      syncSentAfterResponse({ from, to, cc, bcc, subject, body: cleanBody.html });

      return NextResponse.json({ ok: true, provider: "resend", resendId, sentMessage, sentSyncPending: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resend could not send the email.";

      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (!isSmtpConfigured({ ...setup, smtpUser: user, smtpPass: pass, mailFrom: from })) {
    const sentMessage = await saveSentMessageFallback({ from, to, subject, body: cleanBody.html, attachments });

    return NextResponse.json({
      ok: true,
      demo: true,
      sentMessage,
      message: "Resend or SMTP is not configured, so the message was saved to the demo Sent folder."
    });
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: setup.smtpSecure,
    auth: { user, pass }
  });

  try {
    await transporter.sendMail({
      from,
      to,
      cc,
      bcc,
      subject,
      text: cleanBody.text,
      html: cleanBody.html,
      attachments: attachments
        .filter((attachment) => attachment.name && attachment.content)
        .map((attachment) => ({
          filename: attachment.name,
          content: attachment.content,
          encoding: "base64",
          contentType: attachment.type
        }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP could not send the email.";

    return NextResponse.json({ error: message }, { status: 502 });
  }

  const sentMessage = await saveSentMessageFallback({ from, to, subject, body: cleanBody.html, attachments });
  syncSentAfterResponse({ from, to, cc, bcc, subject, body: cleanBody.html });

  return NextResponse.json({ ok: true, sentMessage, sentSyncPending: true });
}
