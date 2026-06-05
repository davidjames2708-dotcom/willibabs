import { NextResponse } from "next/server";
import { requireSession } from "../../session-utils";
import { configuredClient, folderPaths, parseMessageId, type MailboxFolder } from "../../mail-utils";

export const runtime = "nodejs";

type MailboxAction = "move" | "mark-read" | "mark-unread" | "star" | "unstar" | "delete";

type ActionPayload = {
  action?: MailboxAction;
  ids?: string[];
  folder?: MailboxFolder;
};

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const payload = (await request.json()) as ActionPayload;
  const { action, ids = [], folder = "Inbox" } = payload;

  if (!action || ids.length === 0) {
    return NextResponse.json({ error: "Action and message ids are required." }, { status: 400 });
  }

  const targets = ids.map(parseMessageId).filter(Boolean) as Array<{ folder: MailboxFolder; uid: number }>;

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, demo: true, message: "Only IMAP messages can be synced to the mail server." });
  }

  const client = await configuredClient();

  if (!client) {
    return NextResponse.json({ ok: true, demo: true, message: "IMAP is not configured, so the action was only applied in the browser." });
  }

  try {
    await client.connect();

    const grouped = targets.reduce<Record<MailboxFolder, number[]>>((groups, target) => {
      groups[target.folder] = groups[target.folder] ?? [];
      groups[target.folder].push(target.uid);
      return groups;
    }, {} as Record<MailboxFolder, number[]>);

    for (const [sourceFolder, uids] of Object.entries(grouped) as Array<[MailboxFolder, number[]]>) {
      const lock = await client.getMailboxLock(folderPaths[sourceFolder]);

      try {
        await client.mailboxOpen(folderPaths[sourceFolder]);

        if (action === "move") {
          await client.messageMove(uids, folderPaths[folder], { uid: true });
        } else if (action === "delete") {
          await client.messageMove(uids, folderPaths.Trash, { uid: true });
        } else if (action === "mark-read") {
          await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
        } else if (action === "mark-unread") {
          await client.messageFlagsRemove(uids, ["\\Seen"], { uid: true });
        } else if (action === "star") {
          await client.messageFlagsAdd(uids, ["\\Flagged"], { uid: true });
        } else if (action === "unstar") {
          await client.messageFlagsRemove(uids, ["\\Flagged"], { uid: true });
        }
      } finally {
        lock.release();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailbox action failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await client.logout().catch(() => undefined);
  }
}
