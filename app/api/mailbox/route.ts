import { NextResponse } from "next/server";
import { requireSession } from "../session-utils";
import { getConfiguredFolder } from "../mail-utils";
import { readDeletedLocalMessageIds, readLocalMessages, readLocalOverridesForFolder, type StoredFolder } from "../local-message-store";
import { isNeonInboxConfigured, readResendInbox } from "../resend-inbox-store";
import { readStoredSentMessages } from "../sent-store";

export const runtime = "nodejs";

const mailboxCapacity = 3000;
const maxPageSize = 300;

export async function GET(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const folder = getConfiguredFolder(url.searchParams.get("folder"));
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), maxPageSize);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
  const localFolder = folder as StoredFolder;
  const poolLimit = mailboxCapacity;
  const localMessages = await readLocalMessages(localFolder, poolLimit, 0);
  const overrides = await readLocalOverridesForFolder(localFolder);
  const deletedIds = await readDeletedLocalMessageIds();
  const hiddenIds = new Set([...overrides.map((record) => record.id), ...deletedIds]);
  const localIds = new Set(localMessages.map((message) => message.id));
  const provider = folder === "Inbox" ? "resend" : folder === "Sent" ? "saved" : "saved";
  const baseMessages =
    folder === "Inbox"
      ? (await readResendInbox(poolLimit, 0)).filter((message) => !hiddenIds.has(message.id) && !localIds.has(message.id))
      : folder === "Sent"
        ? (await readStoredSentMessages(poolLimit, 0)).filter((message) => !hiddenIds.has(message.id) && !localIds.has(message.id))
        : [];
  const allMessages = [...localMessages, ...baseMessages].slice(0, mailboxCapacity);
  const messages = allMessages.slice(offset, offset + limit);
  const total = allMessages.length;

  return NextResponse.json({
    ok: true,
    provider,
    messages,
    hasMore: offset + messages.length < total,
    offset,
    limit,
    total,
    capacity: mailboxCapacity,
    message: messages.length
      ? `${folder} loaded from saved mail.`
      : folder === "Inbox" && isNeonInboxConfigured()
        ? "No saved inbound messages found yet."
        : `${folder} has no saved messages yet.`
  });
}
