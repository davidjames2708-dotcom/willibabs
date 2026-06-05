import { NextResponse } from "next/server";
import { simpleParser } from "mailparser";
import { configuredClient, folderPaths, parseMessageId } from "../mail-utils";
import { requireSession } from "../session-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const index = Number(url.searchParams.get("index") ?? 0);
  const target = parseMessageId(id);

  if (!target) {
    return NextResponse.json({ error: "Only live IMAP message attachments can be downloaded." }, { status: 400 });
  }

  const client = await configuredClient();

  if (!client) {
    return NextResponse.json({ error: "IMAP is not configured." }, { status: 400 });
  }

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folderPaths[target.folder]);

    try {
      await client.mailboxOpen(folderPaths[target.folder]);
      const messages = client.fetch(`${target.uid}`, { uid: true, source: true }, { uid: true });

      for await (const message of messages) {
        if (!message.source) {
          continue;
        }

        const parsed = await simpleParser(message.source);
        const attachment = parsed.attachments[index];

        if (!attachment) {
          return NextResponse.json({ error: "Attachment was not found." }, { status: 404 });
        }

        const body = new ArrayBuffer(attachment.content.byteLength);
        new Uint8Array(body).set(attachment.content);

        return new NextResponse(body, {
          headers: {
            "Content-Type": attachment.contentType || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${(attachment.filename || "attachment").replace(/"/g, "")}"`
          }
        });
      }
    } finally {
      lock.release();
    }

    return NextResponse.json({ error: "Message was not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attachment download failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await client.logout().catch(() => undefined);
  }
}
