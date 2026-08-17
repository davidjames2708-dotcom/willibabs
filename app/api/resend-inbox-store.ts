import { neon } from "@neondatabase/serverless";

export type StoredInboxMessage = {
  id: string;
  folder: "Inbox";
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
  receivedAt: string;
};

type InboxRow = {
  id: string;
  from_name: string;
  from_email: string;
  recipients: string;
  subject: string;
  snippet: string;
  body: string[];
  display_time: string;
  display_date: string;
  unread: boolean;
  starred: boolean;
  label: string;
  has_attachment: boolean;
  attachment_name: string | null;
  received_at: string;
};

function database() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  return neon(process.env.DATABASE_URL);
}

async function ensureInboxTable() {
  const sql = database();

  if (!sql) {
    return null;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS resend_inbox_messages (
      id text PRIMARY KEY,
      from_name text NOT NULL DEFAULT '',
      from_email text NOT NULL DEFAULT '',
      recipients text NOT NULL DEFAULT '',
      subject text NOT NULL DEFAULT '',
      snippet text NOT NULL DEFAULT '',
      body jsonb NOT NULL DEFAULT '[]'::jsonb,
      display_time text NOT NULL DEFAULT '',
      display_date text NOT NULL DEFAULT '',
      unread boolean NOT NULL DEFAULT true,
      starred boolean NOT NULL DEFAULT false,
      label text NOT NULL DEFAULT 'Inbox',
      has_attachment boolean NOT NULL DEFAULT false,
      attachment_name text,
      received_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  return sql;
}

function rowToMessage(row: InboxRow): StoredInboxMessage {
  return {
    id: row.id,
    folder: "Inbox",
    from: row.from_name,
    fromEmail: row.from_email,
    to: row.recipients,
    subject: row.subject,
    snippet: row.snippet,
    body: row.body,
    time: row.display_time,
    date: row.display_date,
    unread: row.unread,
    starred: row.starred,
    label: row.label === "Resend" ? "Inbox" : row.label,
    hasAttachment: row.has_attachment,
    attachmentName: row.attachment_name ?? undefined,
    receivedAt: row.received_at
  };
}

export function isNeonInboxConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function readResendInbox(limit = 50, offset = 0) {
  const sql = await ensureInboxTable();

  if (!sql) {
    return [];
  }

  const rows = await sql`
    SELECT
      id,
      from_name,
      from_email,
      recipients,
      subject,
      snippet,
      body,
      display_time,
      display_date,
      unread,
      starred,
      label,
      has_attachment,
      attachment_name,
      received_at::text
    FROM resend_inbox_messages
    ORDER BY received_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  ` as InboxRow[];

  return rows.map(rowToMessage);
}

export async function upsertResendInboxMessage(message: StoredInboxMessage) {
  const sql = await ensureInboxTable();

  if (!sql) {
    throw new Error("DATABASE_URL is required to store inbound Resend messages.");
  }

  await sql`
    INSERT INTO resend_inbox_messages (
      id,
      from_name,
      from_email,
      recipients,
      subject,
      snippet,
      body,
      display_time,
      display_date,
      unread,
      starred,
      label,
      has_attachment,
      attachment_name,
      received_at,
      updated_at
    )
    VALUES (
      ${message.id},
      ${message.from},
      ${message.fromEmail},
      ${message.to},
      ${message.subject},
      ${message.snippet},
      ${JSON.stringify(message.body)}::jsonb,
      ${message.time},
      ${message.date},
      ${message.unread},
      ${message.starred},
      ${message.label},
      ${Boolean(message.hasAttachment)},
      ${message.attachmentName ?? null},
      ${message.receivedAt},
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      from_name = EXCLUDED.from_name,
      from_email = EXCLUDED.from_email,
      recipients = EXCLUDED.recipients,
      subject = EXCLUDED.subject,
      snippet = EXCLUDED.snippet,
      body = EXCLUDED.body,
      display_time = EXCLUDED.display_time,
      display_date = EXCLUDED.display_date,
      unread = EXCLUDED.unread,
      starred = EXCLUDED.starred,
      label = EXCLUDED.label,
      has_attachment = EXCLUDED.has_attachment,
      attachment_name = EXCLUDED.attachment_name,
      received_at = EXCLUDED.received_at,
      updated_at = now()
  `;
}
