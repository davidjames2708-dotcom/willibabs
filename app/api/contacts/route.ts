import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireSession } from "../session-utils";

export const runtime = "nodejs";

type Contact = {
  id: string;
  name: string;
  email: string;
  company: string;
  tag: string;
  phone?: string;
  title?: string;
  address?: string;
  website?: string;
  notes?: string;
};

const contactsPath = path.join(process.cwd(), ".dist", "contacts.json");

async function readContacts() {
  try {
    return JSON.parse(await fs.readFile(contactsPath, "utf8")) as Contact[];
  } catch {
    return [];
  }
}

async function writeContacts(contacts: Contact[]) {
  await fs.mkdir(path.dirname(contactsPath), { recursive: true });
  await fs.writeFile(contactsPath, JSON.stringify(contacts, null, 2));
}

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json({ ok: true, contacts: await readContacts() });
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const payload = (await request.json()) as Partial<Contact> & { contacts?: Array<Partial<Contact>> };
  const contacts = await readContacts();

  if (Array.isArray(payload.contacts)) {
    const importedContacts = payload.contacts
      .filter((contact) => contact.name?.trim() && contact.email?.trim())
      .map<Contact>((contact, index) => ({
        id: contact.id || `contact-${Date.now()}-${index}`,
        name: contact.name!.trim(),
        email: contact.email!.trim(),
        company: contact.company?.trim() || "",
        tag: contact.tag?.trim() || "Imported",
        phone: contact.phone?.trim() || "",
        title: contact.title?.trim() || "",
        address: contact.address?.trim() || "",
        website: contact.website?.trim() || "",
        notes: contact.notes?.trim() || ""
      }));

    const importedEmails = new Set(importedContacts.map((contact) => contact.email.toLowerCase()));
    const nextContacts = [...importedContacts, ...contacts.filter((contact) => !importedEmails.has(contact.email.toLowerCase()))];

    await writeContacts(nextContacts);
    return NextResponse.json({ ok: true, contacts: nextContacts });
  }

  if (!payload.name?.trim() || !payload.email?.trim()) {
    return NextResponse.json({ error: "Contact name and email are required." }, { status: 400 });
  }

  const contact: Contact = {
    id: payload.id || `contact-${Date.now()}`,
    name: payload.name.trim(),
    email: payload.email.trim(),
    company: payload.company?.trim() || "",
    tag: payload.tag?.trim() || "General",
    phone: payload.phone?.trim() || "",
    title: payload.title?.trim() || "",
    address: payload.address?.trim() || "",
    website: payload.website?.trim() || "",
    notes: payload.notes?.trim() || ""
  };
  const nextContacts = [contact, ...contacts.filter((item) => item.id !== contact.id && item.email !== contact.email)];

  await writeContacts(nextContacts);
  return NextResponse.json({ ok: true, contact, contacts: nextContacts });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const ids = url.searchParams.get("ids");

  if (!id && !ids) {
    return NextResponse.json({ error: "Contact id is required." }, { status: 400 });
  }

  const deleteIds = new Set((ids ? ids.split(",") : [id]).filter(Boolean));
  const contacts = await readContacts();
  const nextContacts = contacts.filter((contact) => !deleteIds.has(contact.id));
  await writeContacts(nextContacts);

  return NextResponse.json({ ok: true, contacts: nextContacts });
}
