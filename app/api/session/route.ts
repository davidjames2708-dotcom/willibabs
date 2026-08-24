import { NextResponse } from "next/server";
import { configuredLoginEmail, firstLocalLoginEmail, hasAnyLocalPassword } from "../auth-store";
import { configuredClient } from "../mail-utils";
import { getSession } from "../session-utils";
import { isImapConfigured, isResendConfigured, isSmtpConfigured, publicMailSetup, readMailSetup } from "../setup-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  const setup = await readMailSetup();
  const sendingConfigured = isResendConfigured() || isSmtpConfigured(setup);
  return NextResponse.json({
    ok: true,
    authenticated: Boolean(session),
    email: session?.email || configuredLoginEmail() || (await firstLocalLoginEmail()) || setup.mailboxAddress,
    mode: (await configuredClient()) ? "imap" : "demo",
    setup: publicMailSetup(setup),
    setupConfigured: isImapConfigured(setup) && sendingConfigured,
    sendingConfigured,
    sendingProvider: isResendConfigured() ? "resend" : isSmtpConfigured(setup) ? "smtp" : "none",
    passwordConfigured: Boolean(setup.imapHost || process.env.WEBMAIL_LOGIN_PASSWORD || process.env.MAILBOX_PASSWORD || (await hasAnyLocalPassword()))
  });
}
