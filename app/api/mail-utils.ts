import { promises as fs } from "fs";
import path from "path";
import { ImapFlow } from "imapflow";
import { getSession } from "./session-utils";
import { isImapConfigured, readMailSetup } from "./setup-store";

export type MailboxFolder = "Inbox" | "Sent" | "Drafts" | "Archive" | "Junk" | "Trash";

export const folderPaths: Record<MailboxFolder, string> = {
  Inbox: process.env.IMAP_INBOX_FOLDER ?? "INBOX",
  Sent: process.env.IMAP_SENT_FOLDER ?? "Sent",
  Drafts: process.env.IMAP_DRAFTS_FOLDER ?? "Drafts",
  Archive: process.env.IMAP_ARCHIVE_FOLDER ?? "Archive",
  Junk: process.env.IMAP_JUNK_FOLDER ?? "Junk",
  Trash: process.env.IMAP_TRASH_FOLDER ?? "Trash"
};

export function getConfiguredFolder(value: string | null): MailboxFolder {
  if (value === "Sent" || value === "Drafts" || value === "Archive" || value === "Junk" || value === "Trash") {
    return value;
  }

  return "Inbox";
}

export async function configuredClient() {
  const session = await getSession();
  const setup = await readMailSetup();
  const host = setup.imapHost;
  const port = setup.imapPort;
  const user = setup.imapUser || session?.email || "";
  const pass = setup.imapPass || session?.password || "";
  const secure = setup.imapSecure;

  if (!isImapConfigured({ ...setup, imapUser: user, imapPass: pass })) {
    return null;
  }

  return new ImapFlow({
    host,
    port,
    secure,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 30000,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.IMAP_TLS_REJECT_UNAUTHORIZED !== "false"
    }
  });
}

export function parseMessageId(id: string) {
  const match = id.match(/^imap-(inbox|sent|drafts|archive|junk|trash)-(\d+)$/i);

  if (!match) {
    return null;
  }

  const folderKey = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  return {
    folder: folderKey as MailboxFolder,
    uid: Number(match[2])
  };
}

export function header(value = "") {
  return value.replace(/\r?\n/g, " ").trim();
}

export function htmlToText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export const preferencesPath = path.join(process.cwd(), ".dist", "preferences.json");

export async function readPreferences() {
  try {
    return JSON.parse(await fs.readFile(preferencesPath, "utf8")) as Record<string, unknown>;
  } catch {
    return {
      language: "English",
      timeZone: "Auto",
      timeFormat: "12-hour",
      refresh: "Every 5 minutes",
      previewPane: true,
      displayHtml: true,
      remoteImages: false,
      composeHtml: "Always",
      autoSaveDraft: "Every 5 minutes",
      rowsPerPage: 50
    };
  }
}

export async function writePreferences(preferences: Record<string, unknown>) {
  await fs.mkdir(path.dirname(preferencesPath), { recursive: true });
  await fs.writeFile(preferencesPath, JSON.stringify(preferences, null, 2));
}
