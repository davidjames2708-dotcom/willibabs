import { neon } from "@neondatabase/serverless";
import { promises as fs } from "fs";
import path from "path";

export type StoredFolder = "Inbox" | "Sent" | "Drafts" | "Archive" | "Junk" | "Trash";

export type StoredMailMessage = {
  id: string;
  folder: StoredFolder;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  body: string[];
  time: string;
  date: string;
  unread: boolean;
  starred: boolean;
  label: string;
  hasAttachment?: boolean;
  attachmentName?: string;
};

type LocalRow = {
  id: string;
  folder: StoredFolder;
  original_folder: StoredFolder;
  message: StoredMailMessage;
  deleted: boolean;
  updated_at: string;
};

type LocalRecord = {
  id: string;
  folder: StoredFolder;
  originalFolder: StoredFolder;
  message: StoredMailMessage;
  deleted: boolean;
  updatedAt: string;
};

const localStorePath = path.join(process.cwd(), ".dist", "local-mail-messages.json");

function database() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  return neon(process.env.DATABASE_URL);
}

async function ensureLocalMessagesTable() {
  const sql = database();

  if (!sql) {
    return null;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS local_mail_messages (
      id text PRIMARY KEY,
      folder text NOT NULL DEFAULT 'Inbox',
      original_folder text NOT NULL DEFAULT 'Inbox',
      message jsonb NOT NULL,
      deleted boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  return sql;
}

function rowToRecord(row: LocalRow): LocalRecord {
  return {
    id: row.id,
    folder: row.folder,
    originalFolder: row.original_folder,
    message: row.message,
    deleted: row.deleted,
    updatedAt: row.updated_at
  };
}

async function readAllLocalRecords() {
  try {
    const records = JSON.parse(await fs.readFile(localStorePath, "utf8")) as LocalRecord[];

    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

async function writeAllLocalRecords(records: LocalRecord[]) {
  await fs.mkdir(path.dirname(localStorePath), { recursive: true });
  await fs.writeFile(localStorePath, JSON.stringify(records, null, 2));
}

export async function readLocalMessages(folder: StoredFolder, limit = 100, offset = 0) {
  const sql = await ensureLocalMessagesTable().catch(() => null);

  if (sql) {
    const rows = await sql`
      SELECT
        id,
        folder,
        original_folder,
        message,
        deleted,
        updated_at::text
      FROM local_mail_messages
      WHERE folder = ${folder}
        AND deleted = false
      ORDER BY updated_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    ` as LocalRow[];

    return rows.map((row) => ({ ...rowToRecord(row).message, folder }));
  }

  const records = await readAllLocalRecords();

  return records
    .filter((record) => record.folder === folder && !record.deleted)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(offset, offset + limit)
    .map((record) => ({ ...record.message, folder }));
}

export async function readLocalOverridesForFolder(folder: StoredFolder) {
  const sql = await ensureLocalMessagesTable().catch(() => null);

  if (sql) {
    const rows = await sql`
      SELECT
        id,
        folder,
        original_folder,
        message,
        deleted,
        updated_at::text
      FROM local_mail_messages
      WHERE original_folder = ${folder}
    ` as LocalRow[];

    return rows.map(rowToRecord);
  }

  const records = await readAllLocalRecords();

  return records.filter((record) => record.originalFolder === folder);
}

export async function readDeletedLocalMessageIds() {
  const sql = await ensureLocalMessagesTable().catch(() => null);

  if (sql) {
    const rows = await sql`
      SELECT id
      FROM local_mail_messages
      WHERE deleted = true
    ` as Array<{ id: string }>;

    return rows.map((row) => row.id);
  }

  const records = await readAllLocalRecords();

  return records.filter((record) => record.deleted).map((record) => record.id);
}

function inferOriginalFolder(id: string, fallback: StoredFolder): StoredFolder {
  if (id.startsWith("resend-") || id.startsWith("imap-inbox-")) {
    return "Inbox";
  }

  if (id.startsWith("sent-") || id.startsWith("imap-sent-")) {
    return "Sent";
  }

  if (id.startsWith("imap-archive-")) {
    return "Archive";
  }

  if (id.startsWith("imap-trash-")) {
    return "Trash";
  }

  if (id.startsWith("imap-junk-")) {
    return "Junk";
  }

  if (id.startsWith("imap-drafts-")) {
    return "Drafts";
  }

  return fallback;
}

export async function upsertLocalMessages(messages: StoredMailMessage[], folder: StoredFolder) {
  const updatedAt = new Date().toISOString();
  const sql = await ensureLocalMessagesTable().catch(() => null);

  if (sql) {
    for (const message of messages) {
      const existingRows = await sql`
        SELECT
          id,
          folder,
          original_folder,
          message,
          deleted,
          updated_at::text
        FROM local_mail_messages
        WHERE id = ${message.id}
        LIMIT 1
      ` as LocalRow[];
      const existingRecord = existingRows[0] ? rowToRecord(existingRows[0]) : null;
      const originalFolder = inferOriginalFolder(message.id, existingRecord?.originalFolder ?? message.folder);
      const storedMessage = { ...message, folder };

      await sql`
        INSERT INTO local_mail_messages (
          id,
          folder,
          original_folder,
          message,
          deleted,
          updated_at
        )
        VALUES (
          ${message.id},
          ${folder},
          ${originalFolder},
          ${JSON.stringify(storedMessage)}::jsonb,
          false,
          ${updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          folder = EXCLUDED.folder,
          original_folder = EXCLUDED.original_folder,
          message = EXCLUDED.message,
          deleted = false,
          updated_at = EXCLUDED.updated_at
      `;
    }

    return;
  }

  const existingRecords = await readAllLocalRecords();
  const existingById = new Map(existingRecords.map((record) => [record.id, record]));
  const records = messages.map((message) => ({
    id: message.id,
    folder,
    originalFolder: inferOriginalFolder(message.id, existingById.get(message.id)?.originalFolder ?? message.folder),
    message: { ...message, folder },
    deleted: false,
    updatedAt
  }));
  const nextIds = new Set(records.map((record) => record.id));
  await writeAllLocalRecords([...records, ...existingRecords.filter((record) => !nextIds.has(record.id))]);
}

function fallbackDeletedMessage(id: string, folder: StoredFolder): StoredMailMessage {
  return {
    id,
    folder,
    from: "",
    fromEmail: "",
    to: "",
    subject: "(Deleted message)",
    snippet: "",
    body: [],
    time: "",
    date: "",
    unread: false,
    starred: false,
    label: folder
  };
}

export async function deleteLocalMessages(ids: string[], messages: StoredMailMessage[] = []) {
  const updatedAt = new Date().toISOString();
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const sql = await ensureLocalMessagesTable().catch(() => null);

  if (sql) {
    for (const id of ids) {
      const existingRows = await sql`
        SELECT
          id,
          folder,
          original_folder,
          message,
          deleted,
          updated_at::text
        FROM local_mail_messages
        WHERE id = ${id}
        LIMIT 1
      ` as LocalRow[];
      const existingRecord = existingRows[0] ? rowToRecord(existingRows[0]) : null;
      const message = messageById.get(id) ?? existingRecord?.message ?? fallbackDeletedMessage(id, existingRecord?.folder ?? "Inbox");
      const originalFolder = inferOriginalFolder(id, existingRecord?.originalFolder ?? message.folder);

      await sql`
        INSERT INTO local_mail_messages (
          id,
          folder,
          original_folder,
          message,
          deleted,
          updated_at
        )
        VALUES (
          ${id},
          ${message.folder},
          ${originalFolder},
          ${JSON.stringify(message)}::jsonb,
          true,
          ${updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          folder = EXCLUDED.folder,
          original_folder = EXCLUDED.original_folder,
          message = EXCLUDED.message,
          deleted = true,
          updated_at = EXCLUDED.updated_at
      `;
    }

    return;
  }

  const existingRecords = await readAllLocalRecords();
  const nextIds = new Set(ids);
  const existingById = new Map(existingRecords.map((record) => [record.id, record]));
  const updatedRecords = ids.map((id) => {
    const existingRecord = existingById.get(id);
    const message = messageById.get(id) ?? existingRecord?.message ?? fallbackDeletedMessage(id, existingRecord?.folder ?? "Inbox");

    return {
      id,
      folder: message.folder,
      originalFolder: inferOriginalFolder(id, existingRecord?.originalFolder ?? message.folder),
      message,
      deleted: true,
      updatedAt
    };
  });

  await writeAllLocalRecords([...updatedRecords, ...existingRecords.filter((record) => !nextIds.has(record.id))]);
}
