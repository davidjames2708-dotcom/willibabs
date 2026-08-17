import crypto from "crypto";
import { NextResponse } from "next/server";
import { upsertResendInboxMessage, type StoredInboxMessage } from "../resend-inbox-store";

export const runtime = "nodejs";

type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: Record<string, unknown>;
};

type ResendReceivedEmail = {
  id?: string;
  to?: string[];
  from?: string;
  created_at?: string;
  subject?: string;
  html?: string | null;
  text?: string | null;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename?: string;
    content_type?: string;
    id?: string;
  }>;
};

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifySvixSignature(payload: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  const id = headers.get("svix-id") || headers.get("webhook-id");
  const timestamp = headers.get("svix-timestamp") || headers.get("webhook-timestamp");
  const signature = headers.get("svix-signature") || headers.get("webhook-signature");

  if (!id || !timestamp || !signature) {
    return false;
  }

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedPayload = `${id}.${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", key).update(signedPayload).digest("base64");

  return signature
    .split(" ")
    .map((part) => part.split(",")[1] || part)
    .some((value) => timingSafeEqual(value, expected));
}

function cleanText(value = "") {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMessageDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = date.toDateString() === today.toDateString();
  const previousDay = date.toDateString() === yesterday.toDateString();

  return {
    date: sameDay ? "Today" : previousDay ? "Yesterday" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: sameDay ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  };
}

function emailOnly(value = "") {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? value.trim();
}

function senderName(value = "") {
  return value.replace(/<[^>]+>/g, "").replace(emailOnly(value), "").replace(/"/g, "").trim() || emailOnly(value) || "Unknown sender";
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function eventEmailId(event: ResendWebhookEvent) {
  return getString(event.data?.email_id) || getString(event.data?.id) || getString(event.data?.emailId);
}

async function retrieveReceivedEmail(id: string) {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as unknown;

  if (isRecord(payload) && isRecord(payload.data)) {
    return payload.data as ResendReceivedEmail;
  }

  return payload as ResendReceivedEmail;
}

function messageFromEmail(email: ResendReceivedEmail, fallback: ResendWebhookEvent): StoredInboxMessage {
  const receivedAt = email.created_at || fallback.created_at || new Date().toISOString();
  const { date, time } = formatMessageDate(receivedAt);
  const from = email.headers?.from || email.from || getString(fallback.data?.from);
  const bodyText = cleanText(email.text || email.html || getString(fallback.data?.text) || getString(fallback.data?.html));
  const firstAttachment = email.attachments?.[0];

  return {
    id: `resend-${email.id || eventEmailId(fallback) || crypto.randomUUID()}`,
    folder: "Inbox",
    from: senderName(from),
    fromEmail: emailOnly(from),
    to: (email.to?.length ? email.to : getStringArray(fallback.data?.to)).join(", "),
    subject: email.subject || getString(fallback.data?.subject) || "(No subject)",
    snippet: bodyText.slice(0, 160) || "No preview available.",
    body: bodyText ? bodyText.split(/\n+/).filter(Boolean) : ["No message body available."],
    time,
    date,
    unread: true,
    starred: false,
    label: "Inbox",
    hasAttachment: Boolean(email.attachments?.length),
    attachmentName: firstAttachment?.filename,
    receivedAt
  };
}

export async function POST(request: Request) {
  const payload = await request.text();

  if (!verifySvixSignature(payload, request.headers)) {
    return NextResponse.json({ error: "Invalid Resend webhook signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as ResendWebhookEvent;

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const id = eventEmailId(event);
  const email = id ? await retrieveReceivedEmail(id) : null;
  const message = messageFromEmail(email ?? ({ id, ...event.data } as ResendReceivedEmail), event);

  await upsertResendInboxMessage(message);

  return NextResponse.json({ ok: true, messageId: message.id });
}
