import { promises as dns } from "dns";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { firstLocalLoginEmail, hasAnyLocalPassword } from "../auth-store";
import { isImapConfigured, isResendConfigured, isSmtpConfigured, readMailSetup } from "../setup-store";
import { requireSession } from "../session-utils";

export const runtime = "nodejs";

type HealthTone = "good" | "warn" | "bad";

function item(label: string, ok: boolean, detail: string, warnOnly = false) {
  return {
    label,
    status: ok ? "Ready" : warnOnly ? "Needs attention" : "Missing",
    tone: ok ? "good" : warnOnly ? "warn" : "bad",
    detail
  };
}

async function fileStatus(filename: string) {
  const target = path.join(process.cwd(), ".dist", filename);

  try {
    const stats = await fs.stat(target);
    return {
      file: filename,
      exists: true,
      bytes: stats.size,
      updatedAt: stats.mtime.toISOString()
    };
  } catch {
    return {
      file: filename,
      exists: false,
      bytes: 0,
      updatedAt: ""
    };
  }
}

async function checkMx(domain: string) {
  try {
    const records = await dns.resolveMx(domain);
    return {
      label: "MX",
      tone: records.length ? "good" : "bad",
      status: records.length ? "Found" : "Missing",
      detail: records.length
        ? records.sort((left, right) => left.priority - right.priority).map((record) => `${record.priority} ${record.exchange}`).join(", ")
        : "No MX records were found."
    };
  } catch (error) {
    return {
      label: "MX",
      tone: "warn",
      status: "Unable to check",
      detail: error instanceof Error ? error.message : "DNS lookup failed."
    };
  }
}

async function checkTxt(label: string, host: string, matcher: (value: string) => boolean, missingText: string) {
  try {
    const records = await dns.resolveTxt(host);
    const flatRecords = records.map((record) => record.join(""));
    const match = flatRecords.find(matcher);

    return {
      label,
      tone: match ? "good" : "bad",
      status: match ? "Found" : "Missing",
      detail: match || missingText
    };
  } catch (error) {
    return {
      label,
      tone: "warn",
      status: "Unable to check",
      detail: error instanceof Error ? error.message : "DNS lookup failed."
    };
  }
}

async function checkHost(label: string, host: string) {
  try {
    const records = await dns.lookup(host, { all: true });
    return {
      label,
      tone: records.length ? "good" : "bad",
      status: records.length ? "Resolved" : "Missing",
      detail: records.length ? records.map((record) => record.address).join(", ") : `${host} did not resolve.`
    };
  } catch (error) {
    return {
      label,
      tone: "warn",
      status: "Unable to check",
      detail: error instanceof Error ? error.message : "Host lookup failed."
    };
  }
}

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const setup = await readMailSetup();
  const domain = setup.mailDomain || setup.mailboxAddress.split("@")[1] || "";
  const storage = await Promise.all([
    fileStatus("auth.json"),
    fileStatus("sessions.json"),
    fileStatus("preferences.json"),
    fileStatus("contacts.json"),
    fileStatus("setup.json")
  ]);

  const checks = [
    item("Login password", await hasAnyLocalPassword(), `Login email: ${(await firstLocalLoginEmail()) || setup.mailboxAddress || "not set"}`),
    item("IMAP setup", isImapConfigured(setup), setup.imapHost ? `${setup.imapUser} at ${setup.imapHost}:${setup.imapPort}` : "Incoming mail server is not configured."),
    item("Resend API", isResendConfigured(), isResendConfigured() ? `Sending domain: ${domain || "not set"}` : "Set RESEND_API_KEY to send through Resend."),
    item("SMTP fallback", isSmtpConfigured(setup), setup.smtpHost ? `${setup.smtpUser} at ${setup.smtpHost}:${setup.smtpPort}` : "Outgoing SMTP fallback is not configured.", true),
    item("Session secret", Boolean(process.env.SESSION_SECRET), process.env.SESSION_SECRET ? "Custom session secret is set." : "Set SESSION_SECRET before production.", true),
    item("Setup encryption", Boolean(process.env.SETUP_SECRET || process.env.SESSION_SECRET), process.env.SETUP_SECRET ? "Custom setup encryption secret is set." : "Set SETUP_SECRET before production.", true),
    item("Reset code", Boolean(process.env.WEBMAIL_RESET_CODE), process.env.WEBMAIL_RESET_CODE ? "Password reset code is configured." : "Set WEBMAIL_RESET_CODE to enable reset password.", true)
  ];

  const dnsChecks = domain
    ? await Promise.all([
        checkMx(domain),
        setup.imapHost
          ? checkHost("IMAP host", setup.imapHost)
          : Promise.resolve({
              label: "IMAP host",
              tone: "bad" as HealthTone,
              status: "Missing",
              detail: "Add an incoming IMAP host to receive mail in this webmail."
            }),
        checkTxt("SPF", domain, (value) => value.toLowerCase().startsWith("v=spf1"), "No SPF TXT record was found."),
        checkTxt("DKIM", `default._domainkey.${domain}`, (value) => value.toLowerCase().startsWith("v=dkim1"), "No default DKIM TXT record was found."),
        checkTxt("DMARC", `_dmarc.${domain}`, (value) => value.toLowerCase().startsWith("v=dmarc1"), "No DMARC TXT record was found.")
      ])
    : [
        {
          label: "DNS",
          tone: "warn" as HealthTone,
          status: "Skipped",
          detail: "Add a mail domain before DNS can be checked."
        }
      ];

  const scoreItems = [...checks, ...dnsChecks];
  const ready = scoreItems.filter((check) => check.tone === "good").length;

  return NextResponse.json({
    ok: true,
    summary: {
      ready,
      total: scoreItems.length,
      domain: domain || "not set",
      mode: isResendConfigured() || isImapConfigured(setup) || isSmtpConfigured(setup) ? "Live capable" : "Demo/setup mode"
    },
    checks,
    dnsChecks,
    storage
  });
}
