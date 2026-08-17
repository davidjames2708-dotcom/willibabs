import { neon } from "@neondatabase/serverless";
import { promises as fs } from "fs";
import path from "path";

export type StoredSentMessage = {
  id: string;
  folder: "Sent";
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  body: string[];
  time: string;
  date: string;
  unread: false;
  starred: boolean;
  label: string;
  hasAttachment?: boolean;
  attachmentName?: string;
  sentAt: string;
};

const sentStorePath = path.join(process.cwd(), ".dist", "sent-messages.json");
const sentMessageCapacity = 3000;

type SentRow = {
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
  sent_at: string;
};

function database() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  return neon(process.env.DATABASE_URL);
}

async function ensureSentTable() {
  const sql = database();

  if (!sql) {
    if (process.env.VERCEL) {
      throw new Error("DATABASE_URL is required to keep sent messages on Vercel.");
    }

    return null;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS sent_messages (
      id text PRIMARY KEY,
      from_name text NOT NULL DEFAULT '',
      from_email text NOT NULL DEFAULT '',
      recipients text NOT NULL DEFAULT '',
      subject text NOT NULL DEFAULT '',
      snippet text NOT NULL DEFAULT '',
      body jsonb NOT NULL DEFAULT '[]'::jsonb,
      display_time text NOT NULL DEFAULT '',
      display_date text NOT NULL DEFAULT '',
      unread boolean NOT NULL DEFAULT false,
      starred boolean NOT NULL DEFAULT false,
      label text NOT NULL DEFAULT 'Sent',
      has_attachment boolean NOT NULL DEFAULT false,
      attachment_name text,
      sent_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  return sql;
}

function cleanText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMessageDate(value: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = value.toDateString() === today.toDateString();
  const previousDay = value.toDateString() === yesterday.toDateString();

  return {
    date: sameDay ? "Today" : previousDay ? "Yesterday" : value.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: sameDay ? value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : value.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  };
}

async function readAllSentMessages() {
  try {
    const messages = JSON.parse(await fs.readFile(sentStorePath, "utf8")) as StoredSentMessage[];

    return Array.isArray(messages) ? messages : [];
  } catch {
    return [];
  }
}

function rowToMessage(row: SentRow): StoredSentMessage {
  return {
    id: row.id,
    folder: "Sent",
    from: row.from_name,
    fromEmail: row.from_email,
    to: row.recipients,
    subject: row.subject,
    snippet: row.snippet,
    body: row.body,
    time: row.display_time,
    date: row.display_date,
    unread: false,
    starred: row.starred,
    label: row.label,
    hasAttachment: row.has_attachment,
    attachmentName: row.attachment_name ?? undefined,
    sentAt: row.sent_at
  };
}

export async function readStoredSentMessages(limit = 50, offset = 0) {
  const sql = await ensureSentTable().catch(() => null);

  if (sql) {
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
        sent_at::text
      FROM sent_messages
      ORDER BY sent_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    ` as SentRow[];

    return rows.map(rowToMessage);
  }

  const messages = await readAllSentMessages();

  return messages
    .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime())
    .slice(offset, offset + limit);
}

export async function saveStoredSentMessage(message: {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{ name?: string }>;
}) {
  const sentAt = new Date();
  const { date, time } = formatMessageDate(sentAt);
  const readableBody = cleanText(message.body);
  const storedMessage: StoredSentMessage = {
    id: `sent-${sentAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    folder: "Sent",
    from: "Priscilla Mail",
    fromEmail: message.from,
    to: message.to,
    subject: message.subject || "(No subject)",
    snippet: readableBody.slice(0, 160) || "Message sent.",
    body: message.body ? [message.body] : ["Message sent."],
    time,
    date,
    unread: false,
    starred: false,
    label: "Sent",
    hasAttachment: Boolean(message.attachments?.length),
    attachmentName: message.attachments?.[0]?.name,
    sentAt: sentAt.toISOString()
  };
  const sql = await ensureSentTable();

  if (sql) {
    await sql`
      INSERT INTO sent_messages (
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
        sent_at,
        updated_at
      )
      VALUES (
        ${storedMessage.id},
        ${storedMessage.from},
        ${storedMessage.fromEmail},
        ${storedMessage.to},
        ${storedMessage.subject},
        ${storedMessage.snippet},
        ${JSON.stringify(storedMessage.body)}::jsonb,
        ${storedMessage.time},
        ${storedMessage.date},
        ${storedMessage.unread},
        ${storedMessage.starred},
        ${storedMessage.label},
        ${Boolean(storedMessage.hasAttachment)},
        ${storedMessage.attachmentName ?? null},
        ${storedMessage.sentAt},
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
        sent_at = EXCLUDED.sent_at,
        updated_at = now()
    `;

    return storedMessage;
  }

  const existingMessages = await readAllSentMessages();
  const nextMessages = [storedMessage, ...existingMessages.filter((item) => item.id !== storedMessage.id)].slice(0, sentMessageCapacity);
  await fs.mkdir(path.dirname(sentStorePath), { recursive: true });
  await fs.writeFile(sentStorePath, JSON.stringify(nextMessages, null, 2));

  return storedMessage;
}
