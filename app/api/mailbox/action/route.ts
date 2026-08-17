import { NextResponse } from "next/server";
import { deleteLocalMessages, upsertLocalMessages, type StoredMailMessage } from "../../local-message-store";
import { requireSession } from "../../session-utils";
import type { MailboxFolder } from "../../mail-utils";

export const runtime = "nodejs";

type MailboxAction = "move" | "mark-read" | "mark-unread" | "star" | "unstar" | "delete";

type ActionPayload = {
  action?: MailboxAction;
  ids?: string[];
  folder?: MailboxFolder;
  messages?: StoredMailMessage[];
};

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const payload = (await request.json()) as ActionPayload;
  const { action, ids = [], folder = "Inbox", messages = [] } = payload;

  if (!action || ids.length === 0) {
    return NextResponse.json({ error: "Action and message ids are required." }, { status: 400 });
  }

  if (action === "move" && messages.length) {
    await upsertLocalMessages(messages, folder);
  } else if (action === "delete") {
    await deleteLocalMessages(ids, messages);
  } else if ((action === "mark-read" || action === "mark-unread" || action === "star" || action === "unstar") && messages.length) {
    await upsertLocalMessages(messages, messages[0].folder);
  }

  return NextResponse.json({
    ok: true,
    message: "Mailbox action saved."
  });
}
