import { NextResponse } from "next/server";
import { simpleParser } from "mailparser";
import { requireSession } from "../session-utils";
import { configuredClient, folderPaths, getConfiguredFolder, type MailboxFolder } from "../mail-utils";
import { isNeonInboxConfigured, readResendInbox } from "../resend-inbox-store";

export const runtime = "nodejs";

function cleanText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMessageDate(value?: Date | string) {
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

function formatAddressList(value: { text?: string } | Array<{ text?: string }> | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value.map((address) => address.text).filter(Boolean).join(", ") || fallback;
  }

  return value?.text || fallback;
}

export async function GET(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const folder = getConfiguredFolder(url.searchParams.get("folder"));
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 50);
  const resendMessages = folder === "Inbox" ? await readResendInbox(limit) : [];
  const client = await configuredClient();

  if (!client) {
    if (folder === "Inbox" && (resendMessages.length || isNeonInboxConfigured())) {
      return NextResponse.json({
        ok: true,
        provider: "resend",
        messages: resendMessages,
        message: resendMessages.length ? "Inbox synced from Resend receiving." : "Resend receiving is configured. No inbound messages found yet."
      });
    }

    return NextResponse.json({
      ok: true,
      demo: true,
      messages: [],
      message: "IMAP is not configured yet, so the demo inbox is still being shown."
    });
  }

  const mailbox = folderPaths[folder];

  try {
    await client.connect();
    const lock = await client.getMailboxLock(mailbox);

    try {
      const opened = await client.mailboxOpen(mailbox);
      if (!opened.exists) {
        return NextResponse.json({ ok: true, messages: [] });
      }

      const start = Math.max(opened.exists - limit + 1, 1);
      const fetched = [];

      for await (const message of client.fetch(`${start}:*`, { uid: true, flags: true, internalDate: true, source: true })) {
        if (!message.source) {
          continue;
        }

        const parsed = await simpleParser(message.source);
        const from = parsed.from?.value[0];
        const to = formatAddressList(parsed.to, "");
        const bodyText = cleanText(parsed.text || parsed.html || "");
        const { date, time } = formatMessageDate(parsed.date ?? message.internalDate);
        const firstAttachment = parsed.attachments[0];

        fetched.push({
          id: `imap-${folder.toLowerCase()}-${message.uid}`,
          folder,
          from: from?.name || from?.address || "Unknown sender",
          fromEmail: from?.address || "",
          to,
          subject: parsed.subject || "(No subject)",
          snippet: bodyText.slice(0, 160) || "No preview available.",
          body: bodyText ? bodyText.split(/\n+/).filter(Boolean) : ["No message body available."],
          time,
          date,
          unread: !message.flags?.has("\\Seen"),
          starred: Boolean(message.flags?.has("\\Flagged")),
          label: "IMAP",
          hasAttachment: parsed.attachments.length > 0,
          attachmentName: firstAttachment?.filename
        });
      }

      return NextResponse.json({
        ok: true,
        provider: folder === "Inbox" && resendMessages.length ? "mixed" : "imap",
        messages: folder === "Inbox" ? [...resendMessages, ...fetched.reverse()] : fetched.reverse()
      });
    } finally {
      lock.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailbox sync failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await client.logout().catch(() => undefined);
  }
}
