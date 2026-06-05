import { NextResponse } from "next/server";
import { readPreferences, writePreferences } from "../mail-utils";
import { requireSession } from "../session-utils";

export const runtime = "nodejs";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json({ ok: true, preferences: await readPreferences() });
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const preferences = (await request.json()) as Record<string, unknown>;
  await writePreferences(preferences);
  return NextResponse.json({ ok: true, preferences });
}
