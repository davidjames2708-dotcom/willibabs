import { NextResponse } from "next/server";
import { configuredClient, folderPaths, header, htmlToText } from "../mail-utils";
import { requireSession } from "../session-utils";

export const runtime = "nodejs";

type DraftPayload = {
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const payload = (await request.json()) as DraftPayload;
  const from = payload.from || process.env.MAIL_FROM || process.env.SMTP_USER || "draft@example.com";
  const subject = payload.subject || "(No subject)";
  const body = payload.body || "";

  if (!payload.to && !subject && !body) {
    return NextResponse.json({ error: "Draft content is required." }, { status: 400 });
  }

  const client = await configuredClient();

  if (!client) {
    return NextResponse.json({ ok: true, demo: true, message: "Draft saved in the browser because IMAP is not configured." });
  }

  const rawMessage = [
    `From: ${header(from)}`,
    payload.to ? `To: ${header(payload.to)}` : "",
    payload.cc ? `Cc: ${header(payload.cc)}` : "",
    payload.bcc ? `Bcc: ${header(payload.bcc)}` : "",
    `Subject: ${header(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "X-Priscilla-Draft: yes",
    "Content-Type: text/html; charset=utf-8",
    "",
    body.includes("<") ? body : htmlToText(body).replace(/\n/g, "<br />")
  ]
    .filter(Boolean)
    .join("\r\n");

  try {
    await client.connect();
    await client.append(folderPaths.Drafts, rawMessage, ["\\Draft"], new Date());
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft save failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await client.logout().catch(() => undefined);
  }
}
