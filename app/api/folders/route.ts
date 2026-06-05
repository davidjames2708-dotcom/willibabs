import { NextResponse } from "next/server";
import { configuredClient, folderPaths, getConfiguredFolder } from "../mail-utils";
import { requireSession } from "../session-utils";

export const runtime = "nodejs";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const client = await configuredClient();

  if (!client) {
    return NextResponse.json({
      ok: true,
      demo: true,
      folders: Object.keys(folderPaths).map((name) => ({ name, path: folderPaths[name as keyof typeof folderPaths] }))
    });
  }

  try {
    await client.connect();
    const folders = await client.list();
    return NextResponse.json({
      ok: true,
      folders: folders.map((folder) => ({
        name: folder.name,
        path: folder.path,
        subscribed: !folder.flags?.has("\\Noselect")
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Folder list failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { name } = (await request.json()) as { name?: string };
  const folderName = name?.trim();

  if (!folderName) {
    return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
  }

  const client = await configuredClient();

  if (!client) {
    return NextResponse.json({ ok: true, demo: true, folder: { name: folderName, path: folderName } });
  }

  try {
    await client.connect();
    await client.mailboxCreate(folderName);
    return NextResponse.json({ ok: true, folder: { name: folderName, path: folderName } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Folder create failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { from, to } = (await request.json()) as { from?: string; to?: string };

  if (!from || !to?.trim()) {
    return NextResponse.json({ error: "Original and new folder names are required." }, { status: 400 });
  }

  const source = folderPaths[getConfiguredFolder(from)] ?? from;
  const target = to.trim();
  const client = await configuredClient();

  if (!client) {
    return NextResponse.json({ ok: true, demo: true, folder: { name: target, path: target } });
  }

  try {
    await client.connect();
    await client.mailboxRename(source, target);
    return NextResponse.json({ ok: true, folder: { name: target, path: target } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Folder rename failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const folder = url.searchParams.get("folder");

  if (!folder) {
    return NextResponse.json({ error: "Folder is required." }, { status: 400 });
  }

  const protectedFolders = new Set(["Inbox", "Sent", "Drafts", "Archive", "Junk", "Trash"]);

  if (protectedFolders.has(folder)) {
    return NextResponse.json({ error: "Default folders cannot be deleted." }, { status: 400 });
  }

  const client = await configuredClient();

  if (!client) {
    return NextResponse.json({ ok: true, demo: true });
  }

  try {
    await client.connect();
    await client.mailboxDelete(folder);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Folder delete failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await client.logout().catch(() => undefined);
  }
}
