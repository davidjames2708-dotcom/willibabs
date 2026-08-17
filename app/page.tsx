"use client";

import {
  Archive,
  Asterisk,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Edit3,
  Eraser,
  Flame,
  Flag,
  FileText,
  FolderCog,
  HeartPulse,
  Image,
  Inbox,
  List,
  Lock,
  Mail,
  MailCheck,
  Menu,
  Minimize2,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  RefreshCw,
  Reply,
  ReplyAll,
  Forward,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  UsersRound,
  Plus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Paintbrush,
  X
} from "lucide-react";
import { ChangeEvent, FormEvent, KeyboardEvent, PointerEvent, UIEvent, useEffect, useMemo, useRef, useState } from "react";

type Folder = "Inbox" | "Starred" | "Drafts" | "Sent" | "Archive" | "Junk" | "Trash";
type AppName = "Mail" | "Contacts" | "Calendar" | "Files" | "Settings";
type MailboxProvider = "imap" | "resend" | "mixed" | "saved";
type MailboxPageResponse = {
  messages?: MailMessage[];
  demo?: boolean;
  provider?: MailboxProvider;
  hasMore?: boolean;
  total?: number;
  message?: string;
  error?: string;
};
type SendState = "idle" | "sending" | "sent" | "error";
type SettingsGroup = "Preferences" | "Folders" | "Identities" | "Responses" | "Domain" | "Health";
type CalendarMode = "Day" | "Week" | "Month" | "Agenda";
type SortingColumn = "None" | "Date" | "From" | "Subject";
type SortingOrder = "ascending" | "descending";
type ListMode = "List" | "Compact" | "Comfortable";
type TextAlign = "left" | "center" | "right" | "justify";
type MailboxMode = "demo" | "imap" | "resend";

const COMPOSE_FONTS = ["Verdana", "Times New Roman", "Arial", "Georgia", "Tahoma", "Courier New"];
const COMPOSE_FONT_SIZES = ["10pt", "12pt", "14pt", "16pt", "18pt", "20pt", "24pt", "36pt"];

function cssFontFamily(font: string) {
  return font.includes(" ") ? `"${font}", Times, serif` : font;
}

function wrapRangeWithStyles(range: Range, styles: Record<string, string>) {
  const span = document.createElement("span");

  Object.entries(styles).forEach(([property, value]) => {
    span.style.setProperty(property, value);
  });

  const contents = range.extractContents();
  span.appendChild(contents.childNodes.length ? contents : document.createTextNode("\u200b"));
  stampStyles(span, styles);
  range.insertNode(span);

  const wrapped = document.createRange();
  wrapped.selectNodeContents(span);
  return wrapped;
}

function stampStyles(root: HTMLElement, styles: Record<string, string>) {
  Object.entries(styles).forEach(([property, value]) => {
    root.style.setProperty(property, value);

    if (property === "font-size") {
      root.removeAttribute("size");
    }
  });

  root.querySelectorAll("span, font, p, div").forEach((node) => {
    const element = node as HTMLElement;

    Object.entries(styles).forEach(([property, value]) => {
      element.style.setProperty(property, value);

      if (property === "font-size") {
        element.removeAttribute("size");
      }
    });
  });
}

type FolderItem = {
  name: Folder;
  icon: typeof Inbox;
};

type AttachmentDraft = {
  name: string;
  size: number;
  type: string;
  content: string;
};

type MailMessage = {
  id: string;
  folder: Folder;
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

type ComposeDraft = {
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
};

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

type SearchFilters = {
  from: string;
  to: string;
  subject: string;
  label: string;
  unreadOnly: boolean;
  starredOnly: boolean;
  attachmentsOnly: boolean;
};

type Preferences = {
  language: string;
  timeZone: string;
  timeFormat: string;
  refresh: string;
  interfaceSkin: string;
  listLayout: string;
  showUnreadCounts: boolean;
  checkAllFolders: boolean;
  markPreviewRead: string;
  defaultSort: string;
  messageOrder: string;
  showDeletedMessages: boolean;
  previewPane: boolean;
  displayHtml: boolean;
  remoteImages: boolean;
  preferPlainText: boolean;
  openLinksNewWindow: boolean;
  showAttachments: boolean;
  composeHtml: string;
  autoSaveDraft: string;
  replyMode: string;
  composeFont: string;
  composeSignature: string;
  spellcheck: boolean;
  saveSentMail: boolean;
  rowsPerPage: number;
  addressBookMode: string;
  contactDisplay: string;
  autocomplete: boolean;
  skipDeletedContacts: boolean;
  draftsFolder: string;
  sentFolder: string;
  junkFolder: string;
  trashFolder: string;
  archiveFolder: string;
  keepAlive: string;
  compactOnLogout: boolean;
  emptyTrashOnLogout: boolean;
  requestReceipts: boolean;
  signature: string;
  displayName: string;
  replyTo: string;
};

type HealthItem = {
  label: string;
  status: string;
  tone: "good" | "warn" | "bad";
  detail: string;
};

type StorageItem = {
  file: string;
  exists: boolean;
  bytes: number;
  updatedAt: string;
};

type HealthReport = {
  summary: {
    ready: number;
    total: number;
    domain: string;
    mode: string;
  };
  checks: HealthItem[];
  dnsChecks: HealthItem[];
  storage: StorageItem[];
};

type MailSetup = {
  mailboxAddress: string;
  mailDomain: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPass: string;
  imapPassConfigured?: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpPassConfigured?: boolean;
  mailFrom: string;
  updatedAt?: string;
};

const mailboxAddress = process.env.NEXT_PUBLIC_MAILBOX_ADDRESS ?? "info@willibabsdigitalsolutions.com";
const mailDomain = process.env.NEXT_PUBLIC_MAIL_DOMAIN ?? mailboxAddress.split("@")[1] ?? "example.com";
const autoSyncMinutes = Number(process.env.NEXT_PUBLIC_AUTO_SYNC_MINUTES ?? 3);
const mailboxPageSize = 300;
const visibleMessageStep = 100;

const refreshedMessage: MailMessage = {
  id: "m-refresh-001",
  folder: "Inbox",
  from: "Roundcube Sync",
  fromEmail: "sync@willibabsdigitals.com",
  to: mailboxAddress,
  subject: "Mailbox refreshed successfully",
  snippet: "This message appeared after refreshing the mailbox, so the refresh control is now active.",
  body: [
    "Your mailbox refresh action completed successfully.",
    "In the live app this is where the client would request the latest messages from the mail server."
  ],
  time: "Just now",
  date: "Today",
  unread: true,
  starred: false,
  label: "System"
};

const emptyDraft: ComposeDraft = {
  from: mailboxAddress,
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: ""
};

const legacyMailboxAddress = "support@willibabsdigitalsolutions.com";

function normalizeMailboxAddress(value = "") {
  return value.replaceAll(legacyMailboxAddress, mailboxAddress);
}

function normalizeComposeDraft(draft: ComposeDraft): ComposeDraft {
  return {
    ...draft,
    from: normalizeMailboxAddress(draft.from || mailboxAddress)
  };
}

const emptyMailSetup: MailSetup = {
  mailboxAddress,
  mailDomain,
  imapHost: "",
  imapPort: 993,
  imapSecure: true,
  imapUser: mailboxAddress,
  imapPass: "",
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: mailboxAddress,
  smtpPass: "",
  mailFrom: mailboxAddress
};

const folders: FolderItem[] = [
  { name: "Inbox", icon: Inbox },
  { name: "Starred", icon: Star },
  { name: "Drafts", icon: Edit3 },
  { name: "Sent", icon: Send },
  { name: "Archive", icon: Archive },
  { name: "Junk", icon: Flame },
  { name: "Trash", icon: Trash2 }
];

const appRail: Array<{ label: AppName; icon: typeof Mail }> = [
  { label: "Mail", icon: Mail },
  { label: "Contacts", icon: UsersRound },
  { label: "Calendar", icon: CalendarDays },
  { label: "Files", icon: FileText },
  { label: "Settings", icon: Settings }
];

const initialMessages: MailMessage[] = [
  {
    id: "m-001",
    folder: "Inbox",
    from: "Ada Coleman",
    fromEmail: "ada@northstar.studio",
    to: mailboxAddress,
    subject: "Updated launch notes for Priscilla Mail",
    snippet: "I added the onboarding sequence, DNS checklist, and launch blockers to the shared brief.",
    body: [
      "Hi Priscilla,",
      "I added the onboarding sequence, DNS checklist, and launch blockers to the shared brief. The remaining decisions are the default sender name, support address, and whether we want daily digest notifications enabled for the first release.",
      "The interface is already strong. Once the real mailbox sync is connected, the product will feel much more alive."
    ],
    time: "9:42 AM",
    date: "Today",
    unread: true,
    starred: true,
    label: "Launch",
    hasAttachment: true,
    attachmentName: "launch-checklist.pdf"
  },
  {
    id: "m-002",
    folder: "Inbox",
    from: "Marcus Lee",
    fromEmail: "marcus@clearpath.dev",
    to: mailboxAddress,
    subject: "SMTP credentials and DNS records",
    snippet: "The SPF, DKIM, and DMARC records are ready for review before we switch sending on.",
    body: [
      "Hello,",
      "The SPF, DKIM, and DMARC records are ready for review before we switch sending on. I also included a fallback SMTP profile in case the primary relay rate-limits during testing.",
      "Please confirm the MAIL_FROM value before we move this to production."
    ],
    time: "8:16 AM",
    date: "Today",
    unread: true,
    starred: false,
    label: "Security"
  },
  {
    id: "m-003",
    folder: "Inbox",
    from: "Nora Patel",
    fromEmail: "nora@clientdesk.io",
    to: mailboxAddress,
    subject: "Client contact import",
    snippet: "The first CSV contains 128 contacts with company names, tags, and preferred reply windows.",
    body: [
      "Good morning,",
      "The first CSV contains 128 contacts with company names, tags, and preferred reply windows. I marked twelve contacts as VIP because they should appear higher in search and suggestions.",
      "Let me know if you want the import grouped by company or by relationship stage."
    ],
    time: "Yesterday",
    date: "May 13",
    unread: false,
    starred: false,
    label: "Contacts",
    hasAttachment: true,
    attachmentName: "client-import.csv"
  },
  {
    id: "m-004",
    folder: "Sent",
    from: "Priscilla Mail",
    fromEmail: mailboxAddress,
    to: "support@northstar.studio",
    subject: "Re: Updated launch notes for Priscilla Mail",
    snippet: "Thanks, I will review the checklist and send the final sender details today.",
    body: [
      "Thanks, I will review the checklist and send the final sender details today.",
      "Please keep the DNS checklist in the shared folder so we can track everything in one place."
    ],
    time: "Yesterday",
    date: "May 13",
    unread: false,
    starred: false,
    label: "Launch"
  },
  {
    id: "m-005",
    folder: "Archive",
    from: "Billing Desk",
    fromEmail: "billing@relaymail.example",
    to: mailboxAddress,
    subject: "Monthly relay usage summary",
    snippet: "Your current sending usage is below the included limit for the month.",
    body: [
      "Your current sending usage is below the included limit for the month.",
      "Storage, delivery logs, and bounce reports are available in the admin console."
    ],
    time: "Mon",
    date: "May 11",
    unread: false,
    starred: false,
    label: "Billing"
  }
];

const initialContacts: Contact[] = [
  { id: "contact-ada", name: "Ada Coleman", email: "ada@northstar.studio", company: "Northstar Studio", tag: "Launch" },
  { id: "contact-marcus", name: "Marcus Lee", email: "marcus@clearpath.dev", company: "Clearpath Dev", tag: "Security" },
  { id: "contact-nora", name: "Nora Patel", email: "nora@clientdesk.io", company: "Clientdesk", tag: "Contacts" }
];

const events = [
  { title: "DNS verification", time: "Today, 2:00 PM", owner: "Marcus Lee" },
  { title: "Launch review", time: "Tomorrow, 10:30 AM", owner: "Ada Coleman" },
  { title: "Contact import QA", time: "Friday, 1:00 PM", owner: "Nora Patel" }
];

const settingRows = [
  { label: "Display name", value: "Priscilla Mail" },
  { label: "Mailbox", value: mailboxAddress },
  { label: "Signature", value: "Best regards, Priscilla" },
  { label: "Notifications", value: "Desktop and digest enabled" },
  { label: "SMTP status", value: "Demo outbox active. Add .env.local credentials for live delivery." }
];

const settingsGroups: Array<{ name: SettingsGroup; icon: typeof Settings }> = [
  { name: "Preferences", icon: SlidersHorizontal },
  { name: "Folders", icon: Inbox },
  { name: "Identities", icon: UserRound },
  { name: "Responses", icon: Edit3 },
  { name: "Domain", icon: ShieldCheck },
  { name: "Health", icon: HeartPulse }
];

const preferenceSections = [
  "User Interface",
  "Mailbox View",
  "Displaying Messages",
  "Composing Messages",
  "Address Book",
  "Special Folders",
  "Server Settings"
];

const folderSettings = ["Inbox", "Drafts", "Sent", "Archive", "Junk", "Trash"];

const responseTemplates = [
  {
    title: "Support acknowledgement",
    body: "Thanks for your message. I received it and will respond shortly."
  },
  {
    title: "Meeting follow-up",
    body: "Thank you for the meeting. I will send the next steps once I review the notes."
  }
];

const domainRecords = [
  {
    type: "MX",
    host: mailDomain,
    value: `10 mail.${mailDomain}`,
    purpose: "Receives messages sent to your domain."
  },
  {
    type: "TXT",
    host: mailDomain,
    value: `v=spf1 include:${mailDomain} ~all`,
    purpose: "Authorizes your mail server to send for this domain."
  },
  {
    type: "TXT",
    host: `default._domainkey.${mailDomain}`,
    value: "v=DKIM1; k=rsa; p=PASTE_PROVIDER_PUBLIC_KEY_HERE",
    purpose: "Signs outgoing mail so recipients can verify it was not changed."
  },
  {
    type: "TXT",
    host: `_dmarc.${mailDomain}`,
    value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${mailDomain}`,
    purpose: "Tells receivers what to do if SPF or DKIM fails."
  }
];

function fileToAttachment(file: File) {
  return new Promise<AttachmentDraft>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const content = result.includes(",") ? result.split(",")[1] : result;
      resolve({
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        content
      });
    };
    reader.onerror = () => reject(new Error("Attachment could not be read."));
    reader.readAsDataURL(file);
  });
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function htmlToReadableText(value = "") {
  const normalized = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|tr|h[1-6])>/gi, "\n")
    .replace(/&nbsp;/gi, " ");

  if (typeof window !== "undefined") {
    const element = window.document.createElement("div");
    element.innerHTML = normalized;
    return (element.textContent || element.innerText || "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  return normalized
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeOutgoingHtml(value = "") {
  if (typeof window !== "undefined") {
    const parser = new window.DOMParser();
    const parsedDocument = parser.parseFromString(value, "text/html");
    const element = window.document.createElement("div");
    element.innerHTML = parsedDocument.body?.innerHTML || value;
    element.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());
    element.querySelectorAll("*").forEach((node) => {
      Array.from(node.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const content = attribute.value.trim().toLowerCase();

        if (name.startsWith("on") || ((name === "href" || name === "src") && content.startsWith("javascript:"))) {
          node.removeAttribute(attribute.name);
        }
      });
    });
    return element.innerHTML.trim();
  }

  const bodyMatch = value.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  const bodyStyle = bodyMatch?.[1].match(/style=["']([^"']*)["']/i)?.[1];
  const html = bodyMatch?.[2] ?? value;
  const wrappedHtml = bodyStyle ? `<div style="${bodyStyle}">${html}</div>` : html;

  return wrappedHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?<\/embed>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .trim();
}

function cleanOutgoingBody(value = "") {
  const html = sanitizeOutgoingHtml(value);
  const readable = htmlToReadableText(html)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!readable || readable === "..." || readable === "\u2026") {
    return { html: "", text: "" };
  }

  return { html, text: readable };
}
function messageBodyLooksHtml(value = "") {
  return /<\/?(?:html|body|div|p|span|strong|b|em|i|u|br|font|ul|ol|li|blockquote|table|tbody|tr|td|th|h[1-6])\b|\sstyle\s*=/i.test(value);
}

function renderMessageBody(message: MailMessage) {
  const htmlBody = message.folder === "Sent" && message.body.some(messageBodyLooksHtml);

  if (htmlBody) {
    return (
      <div
        className="formatted-message-body"
        dangerouslySetInnerHTML={{ __html: sanitizeOutgoingHtml(message.body.join("")) }}
      />
    );
  }

  return message.body.map((paragraph) => <p key={paragraph}>{htmlToReadableText(paragraph)}</p>);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + days);
  return nextDate;
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(date.getMonth() + months);
  return nextDate;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(date), mondayOffset);
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatWeekRange(date: Date) {
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  const startText = weekStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric"
  });
  const endText = weekEnd.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: "numeric"
  });

  return `${startText} - ${endText}`;
}

function formatCalendarHeader(date: Date, mode: CalendarMode) {
  if (mode === "Day") {
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  if (mode === "Month") {
    return formatMonthYear(date);
  }

  if (mode === "Agenda") {
    return `Agenda for ${formatMonthYear(date)}`;
  }

  return formatWeekRange(date);
}

function getMonthGrid(date: Date) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const startOffset = firstOfMonth.getDay() === 0 ? -6 : 1 - firstOfMonth.getDay();
  const gridStart = addDays(firstOfMonth, startOffset);

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => addDays(gridStart, weekIndex * 7 + dayIndex))
  );
}

export default function Home() {
  const [activeApp, setActiveApp] = useState<AppName>("Mail");
  const [activeFolder, setActiveFolder] = useState<Folder>("Inbox");
  const [activeSettingsGroup, setActiveSettingsGroup] = useState<SettingsGroup>("Preferences");
  const [activePreference, setActivePreference] = useState("User Interface");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("Week");
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarSearch, setCalendarSearch] = useState("");
  const [messages, setMessages] = useState<MailMessage[]>(initialMessages);
  const [selectedId, setSelectedId] = useState(initialMessages[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    from: "",
    to: "",
    subject: "",
    label: "",
    unreadOnly: false,
    starredOnly: false,
    attachmentsOnly: false
  });
  const [visibleLimit, setVisibleLimit] = useState(25);
  const [sortNewest, setSortNewest] = useState(true);
  const [sortingColumn, setSortingColumn] = useState<SortingColumn>("None");
  const [sortingOrder, setSortingOrder] = useState<SortingOrder>("descending");
  const [listMode, setListMode] = useState<ListMode>("List");
  const [draftSortingColumn, setDraftSortingColumn] = useState<SortingColumn>("None");
  const [draftSortingOrder, setDraftSortingOrder] = useState<SortingOrder>("descending");
  const [draftListMode, setDraftListMode] = useState<ListMode>("List");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [folderHasMore, setFolderHasMore] = useState<Partial<Record<Folder, boolean>>>({});
  const [folderMessageTotals, setFolderMessageTotals] = useState<Partial<Record<Folder, number>>>({});
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<ComposeDraft>(emptyDraft);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [editorToolbarOpen, setEditorToolbarOpen] = useState(true);
  const [bodyBold, setBodyBold] = useState(false);
  const [bodyItalic, setBodyItalic] = useState(false);
  const [bodyUnderline, setBodyUnderline] = useState(false);
  const [bodyAlign, setBodyAlign] = useState<TextAlign>("left");
  const [bodyFont, setBodyFont] = useState("Verdana");
  const [bodySize, setBodySize] = useState("10pt");
  const [bodyColor, setBodyColor] = useState("#0f1f2e");
  const [bodyHighlight, setBodyHighlight] = useState("#ffffff");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState("");
  const [mobileFoldersOpen, setMobileFoldersOpen] = useState(false);
  const [mobileMessageOpen, setMobileMessageOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const [forwardMenuOpen, setForwardMenuOpen] = useState(false);
  const [markMenuOpen, setMarkMenuOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [threadsOn, setThreadsOn] = useState(true);
  const [notice, setNotice] = useState("Ready");
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [loginEmail, setLoginEmail] = useState(mailboxAddress);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [mailboxMode, setMailboxMode] = useState<MailboxMode>("demo");
  const [setupConfigured, setSetupConfigured] = useState(false);
  const [sendingConfigured, setSendingConfigured] = useState(false);
  const [sendingProvider, setSendingProvider] = useState<"none" | "resend" | "smtp">("none");
  const [mailSetup, setMailSetup] = useState<MailSetup>(emptyMailSetup);
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupStatus, setSetupStatus] = useState("Waiting for provider setup");
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [serverActionStatus, setServerActionStatus] = useState("Waiting for a server action");
  const [sentSyncStatus, setSentSyncStatus] = useState("Waiting for sent mail");
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [contactSearch, setContactSearch] = useState("");
  const [activeContactGroup, setActiveContactGroup] = useState("All");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactDraft, setContactDraft] = useState<Contact>({
    id: "",
    name: "",
    email: "",
    company: "",
    tag: "General",
    phone: "",
    title: "",
    address: "",
    website: "",
    notes: ""
  });
  const [preferences, setPreferences] = useState<Preferences>({
    language: "English",
    timeZone: "Auto",
    timeFormat: "12-hour",
    refresh: "Every 5 minutes",
    interfaceSkin: "Elastic",
    listLayout: "Widescreen",
    showUnreadCounts: true,
    checkAllFolders: false,
    markPreviewRead: "After 5 seconds",
    defaultSort: "Date",
    messageOrder: "Descending",
    showDeletedMessages: false,
    previewPane: true,
    displayHtml: true,
    remoteImages: false,
    preferPlainText: false,
    openLinksNewWindow: true,
    showAttachments: true,
    composeHtml: "Always",
    autoSaveDraft: "Every 5 minutes",
    replyMode: "Start new message above original",
    composeFont: "Verdana",
    composeSignature: "Automatically",
    spellcheck: true,
    saveSentMail: true,
    rowsPerPage: 50,
    addressBookMode: "List",
    contactDisplay: "Display name",
    autocomplete: true,
    skipDeletedContacts: true,
    draftsFolder: "Drafts",
    sentFolder: "Sent",
    junkFolder: "Junk",
    trashFolder: "Trash",
    archiveFolder: "Archive",
    keepAlive: "Every 5 minutes",
    compactOnLogout: false,
    emptyTrashOnLogout: false,
    requestReceipts: false,
    signature: "Best regards,\nPriscilla",
    displayName: "Priscilla Mail",
    replyTo: ""
  });
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const contactImportRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorSelectionRef = useRef<Range | null>(null);
  const loginSubmitIntentRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const sessionTimeout = window.setTimeout(() => {
      if (mounted) {
        setAuthenticated(false);
        setSessionChecking(false);
      }
    }, 5000);

    async function checkSession() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = (await response.json()) as {
          authenticated?: boolean;
          email?: string;
          mode?: "imap" | "demo";
          passwordConfigured?: boolean;
          setupConfigured?: boolean;
          sendingConfigured?: boolean;
          sendingProvider?: "none" | "resend" | "smtp";
          setup?: Partial<MailSetup>;
        };

        if (!mounted) {
          return;
        }

        setAuthenticated(false);
        setLoginEmail(data.email || mailboxAddress);
        setMailboxMode(data.mode ?? "demo");
        setPasswordConfigured(Boolean(data.passwordConfigured));
        setSetupConfigured(Boolean(data.setupConfigured));
        setSendingConfigured(Boolean(data.sendingConfigured));
        setSendingProvider(data.sendingProvider ?? "none");
        if (data.setup) {
          setMailSetup((current) => ({
            ...current,
            ...data.setup,
            imapPass: "",
            smtpPass: ""
          }));
        }
        if (data.authenticated) {
          await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
        }
      } catch {
        if (mounted) {
          setAuthenticated(false);
        }
      } finally {
        if (mounted) {
          window.clearTimeout(sessionTimeout);
          setSessionChecking(false);
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
      window.clearTimeout(sessionTimeout);
    };
  }, []);

  useEffect(() => {
    try {
      const savedDraft = window.localStorage.getItem("priscilla-compose-draft");
      if (savedDraft) {
        setComposeDraft(normalizeComposeDraft(JSON.parse(savedDraft) as ComposeDraft));
      }
    } catch {
      window.localStorage.removeItem("priscilla-compose-draft");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("priscilla-compose-draft", JSON.stringify(composeDraft));
  }, [composeDraft]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    fetch("/api/contacts")
      .then(async (response) => {
        if (handleUnauthorizedResponse(response)) {
          return null;
        }

        const data = (await response.json()) as { contacts?: Contact[] };
        return data.contacts ?? null;
      })
      .then((serverContacts) => {
        if (serverContacts?.length) {
          setContacts(serverContacts);
        }
      })
      .catch(() => undefined);

    fetch("/api/preferences")
      .then(async (response) => {
        if (handleUnauthorizedResponse(response)) {
          return null;
        }

        const data = (await response.json()) as { preferences?: Partial<Preferences> };
        return data.preferences ?? null;
      })
      .then((serverPreferences) => {
        if (serverPreferences) {
          setPreferences((current) => ({ ...current, ...serverPreferences }));
        }
      })
      .catch(() => undefined);

    fetch("/api/folders")
      .then(async (response) => {
        if (handleUnauthorizedResponse(response)) {
          return null;
        }

        const data = (await response.json()) as { folders?: Array<{ name?: string; path?: string }> };
        return data.folders ?? null;
      })
      .then((serverFolders) => {
        if (serverFolders) {
          const defaultNames = new Set(folderSettings);
          setCustomFolders(
            serverFolders
              .map((folder) => folder.name || folder.path || "")
              .filter((name) => name && !defaultNames.has(name))
          );
        }
      })
      .catch(() => undefined);

    fetch("/api/setup")
      .then(async (response) => {
        if (handleUnauthorizedResponse(response)) {
          return null;
        }

        const data = (await response.json()) as { setup?: Partial<MailSetup> };
        return data.setup ?? null;
      })
      .then((serverSetup) => {
        if (serverSetup) {
          setMailSetup((current) => ({
            ...current,
            ...serverSetup,
            imapPass: "",
            smtpPass: ""
          }));
          setSetupStatus(serverSetup.updatedAt ? "Provider setup saved" : "Waiting for provider setup");
        }
      })
      .catch(() => undefined);

    loadHealthReport(true);
    refreshMailbox(true, "Inbox");
  }, [authenticated]);

  useEffect(() => {
    if (composeOpen && editorRef.current && editorRef.current.innerHTML !== composeDraft.body) {
      editorRef.current.innerHTML = composeDraft.body;
    }
  }, [composeOpen, composeDraft.body]);

  useEffect(() => {
    if (!composeOpen || preferences.autoSaveDraft === "Never") {
      return;
    }

    const intervalMinutes = preferences.autoSaveDraft === "Every minute" ? 1 : preferences.autoSaveDraft === "Every 10 minutes" ? 10 : 5;
    const timer = window.setInterval(() => {
      const currentBody = editorRef.current?.innerHTML ?? composeDraft.body;

      if (composeDraft.to || composeDraft.subject || htmlToReadableText(currentBody)) {
        saveDraftToServer(true);
      }
    }, intervalMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [composeOpen, composeDraft, preferences.autoSaveDraft]);

  useEffect(() => {
    if (!authenticated || autoSyncMinutes <= 0) {
      return;
    }

    const syncTimer = window.setInterval(() => {
      refreshMailbox(true);
    }, autoSyncMinutes * 60 * 1000);

    return () => window.clearInterval(syncTimer);
  }, [authenticated]);

  const visibleMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const folderMessages = messages.filter((message) => {
      if (activeFolder === "Starred") {
        return message.starred && message.folder !== "Trash";
      }

      return message.folder === activeFolder;
    });

    const searched = normalizedQuery
      ? folderMessages.filter((message) =>
          [
            message.from,
            message.fromEmail,
            message.to,
            message.subject,
            message.snippet,
            message.label,
            message.attachmentName ?? ""
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        )
      : folderMessages;

    const filtered = searched.filter((message) => {
      const fromMatch = !searchFilters.from.trim() || `${message.from} ${message.fromEmail}`.toLowerCase().includes(searchFilters.from.trim().toLowerCase());
      const toMatch = !searchFilters.to.trim() || message.to.toLowerCase().includes(searchFilters.to.trim().toLowerCase());
      const subjectMatch = !searchFilters.subject.trim() || message.subject.toLowerCase().includes(searchFilters.subject.trim().toLowerCase());
      const labelMatch = !searchFilters.label.trim() || message.label.toLowerCase().includes(searchFilters.label.trim().toLowerCase());
      const unreadMatch = !searchFilters.unreadOnly || message.unread;
      const starredMatch = !searchFilters.starredOnly || message.starred;
      const attachmentMatch = !searchFilters.attachmentsOnly || Boolean(message.hasAttachment);

      return fromMatch && toMatch && subjectMatch && labelMatch && unreadMatch && starredMatch && attachmentMatch;
    });

    const sorted = [...filtered].sort((left, right) => {
      let comparison = 0;

      if (sortingColumn === "From") {
        comparison = left.from.localeCompare(right.from);
      } else if (sortingColumn === "Subject") {
        comparison = left.subject.localeCompare(right.subject);
      } else {
        comparison = messages.indexOf(left) - messages.indexOf(right);
      }

      return sortingOrder === "ascending" ? comparison : -comparison;
    });

    return sorted;
  }, [activeFolder, messages, query, searchFilters, sortingColumn, sortingOrder]);

  const displayedMessages = useMemo(() => visibleMessages.slice(0, visibleLimit), [visibleLimit, visibleMessages]);
  const displayedMessageIds = useMemo(() => displayedMessages.map((message) => message.id), [displayedMessages]);
  const selectedDisplayedCount = displayedMessageIds.filter((id) => selectedMessageIds.includes(id)).length;

  const selectedMessage = useMemo(() => {
    return messages.find((message) => message.id === selectedId) ?? visibleMessages[0];
  }, [messages, selectedId, visibleMessages]);
  const hasSelectedMessage = activeApp === "Mail" && (Boolean(selectedMessage) || selectedMessageIds.length > 0);

  function messagePerson(message: MailMessage) {
    if (message.folder === "Sent" || message.folder === "Drafts") {
      return {
        label: "To",
        name: message.to || "(No recipient)",
        detail: `From: ${message.fromEmail || message.from}`
      };
    }

    return {
      label: "From",
      name: message.from,
      detail: message.fromEmail
    };
  }

  function personInitials(value: string) {
    const cleaned = value.replace(/^to:\s*/i, "").replace(/[<>().,]/g, " ").trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "M";
    const second = parts.length > 1 ? parts[1][0] : parts[0]?.[1] ?? "";
    return `${first}${second}`.toUpperCase();
  }

  const folderCounts = useMemo(() => {
    return folders.reduce<Record<Folder, number>>((counts, folder) => {
      counts[folder.name] =
        folder.name === "Starred"
          ? messages.filter((message) => message.starred && message.folder !== "Trash").length
          : messages.filter((message) => message.folder === folder.name).length;
      return counts;
    }, {} as Record<Folder, number>);
  }, [messages]);

  const statusItems = useMemo(
    () => [
      {
        label: "Sending",
        value: sendingConfigured ? (sendingProvider === "resend" ? "Resend ready" : "SMTP ready") : "Not ready",
        tone: sendingConfigured ? "good" : "warn"
      },
      {
        label: "Inbox",
        value: mailboxMode === "imap" ? "IMAP connected" : mailboxMode === "resend" ? "Resend receiving" : "Demo mode",
        tone: mailboxMode === "imap" || mailboxMode === "resend" ? "good" : "warn"
      },
      {
        label: "Auto sync",
        value: autoSyncMinutes > 0 ? `Every ${autoSyncMinutes} min` : "Off",
        tone: autoSyncMinutes > 0 ? "good" : "warn"
      },
      {
        label: "Last synced",
        value: lastSyncedAt || "Not yet",
        tone: lastSyncedAt ? "good" : "warn"
      },
      {
        label: "Server actions",
        value: serverActionStatus,
        tone: serverActionStatus.includes("failed") ? "bad" : serverActionStatus.includes("Waiting") ? "warn" : "good"
      },
      {
        label: "Sent sync",
        value: sentSyncStatus,
        tone: sentSyncStatus.includes("not") || sentSyncStatus.includes("Waiting") ? "warn" : "good"
      },
      {
        label: "Workspace lock",
        value: passwordConfigured ? "Enabled" : "Password login",
        tone: passwordConfigured ? "good" : "warn"
      }
    ],
    [lastSyncedAt, mailboxMode, passwordConfigured, sendingConfigured, sendingProvider, sentSyncStatus, serverActionStatus]
  );

  const emptyText = useMemo(() => {
    if (query.trim()) {
      return {
        title: "No results found",
        body: `There are no messages matching "${query.trim()}".`
      };
    }

    return {
      title: `${activeFolder} is empty`,
      body: "There are no messages in this folder yet."
    };
  }, [activeFolder, query]);

  function showNotice(message: string) {
    setNotice(message);
  }

  function handleUnauthorizedResponse(response: Response) {
    if (response.status !== 401) {
      return false;
    }

    setAuthenticated(false);
    setLoginPassword("");
    setLoginError("Your mailbox session expired. Please unlock the mailbox again.");
    showNotice("Mailbox locked");
    return true;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submittedByUser = event.nativeEvent.isTrusted || loginSubmitIntentRef.current;
    loginSubmitIntentRef.current = false;

    if (!submittedByUser) {
      return;
    }
    setLoginLoading(true);
    setLoginError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = (await response.json()) as { error?: string; mode?: "imap" | "demo" };

      if (!response.ok) {
        throw new Error(data.error ?? "Mailbox login failed.");
      }

      setAuthenticated(true);
      setLoginPassword("");
      setMailboxMode(data.mode ?? "demo");
      setLoginError("");
      showNotice("Mailbox unlocked");
      window.setTimeout(() => {
        void refreshMailbox(true, "Inbox");
      }, 0);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mailbox login failed.";

      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  }

  function markLoginSubmitIntent(event: KeyboardEvent<HTMLFormElement | HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      loginSubmitIntentRef.current = true;
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          resetCode,
          password: resetPassword,
          confirmPassword: resetConfirmPassword
        })
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Password reset failed.");
      }

      setResetMode(false);
      setLoginPassword("");
      setResetCode("");
      setResetPassword("");
      setResetConfirmPassword("");
      setLoginError("");
      showNotice(data.message ?? "Password reset");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Password reset failed.");
    }
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    setAuthenticated(false);
    setLoginPassword("");
    setAccountMenuOpen(false);
    setAccountPanelOpen(false);
    showNotice("Mailbox locked");
  }

  function closeMenus() {
    setLabelMenuOpen(false);
    setMoreMenuOpen(false);
    setOptionsMenuOpen(false);
    setSelectMenuOpen(false);
    setForwardMenuOpen(false);
    setMarkMenuOpen(false);
  }

  function chooseApp(app: AppName) {
    setActiveApp(app);
    setMobileFoldersOpen(false);
    setMobileMessageOpen(false);
    closeMenus();
    showNotice(`${app} opened`);
  }

  function chooseFolder(folder: Folder) {
    setActiveApp("Mail");
    setActiveFolder(folder);
    setMobileFoldersOpen(false);
    setMobileMessageOpen(false);
    setSelectedMessageIds([]);
    setSelectMode(false);
    closeMenus();
    const nextMessage = messages.find((message) => {
      if (folder === "Starred") {
        return message.starred && message.folder !== "Trash";
      }

      return message.folder === folder;
    });
    setSelectedId(nextMessage?.id ?? "");
    showNotice(`${folder} opened`);
    void refreshMailbox(true, folder);
  }

  function selectMessage(message: MailMessage) {
    if (selectMode) {
      toggleMessageSelection(message.id);
      return;
    }

    const readMessage = { ...message, unread: false };

    setSelectedId(message.id);
    setMobileMessageOpen(true);
    setMessages((currentMessages) =>
      currentMessages.map((item) => (item.id === message.id ? readMessage : item))
    );

    if (message.unread) {
      syncMailboxAction("mark-read", [message.id], undefined, [readMessage], true);
    }

    showNotice("Message opened");
  }

  function toggleMessageSelection(messageId: string) {
    setSelectedMessageIds((currentIds) => {
      const nextIds = currentIds.includes(messageId)
        ? currentIds.filter((id) => id !== messageId)
        : [...currentIds, messageId];
      setSelectMode(nextIds.length > 0);
      showNotice(`${nextIds.length} message${nextIds.length === 1 ? "" : "s"} selected`);
      return nextIds;
    });
  }

  function applySelection(selection: "All" | "Current page" | "Unread" | "Flagged" | "Invert" | "None") {
    const visibleIds = visibleMessages.map((message) => message.id);

    if (selection === "All" || selection === "Current page") {
      setSelectedMessageIds(visibleIds);
      setSelectMode(true);
      showNotice(`${visibleIds.length} message${visibleIds.length === 1 ? "" : "s"} selected`);
    }

    if (selection === "Unread") {
      const unreadIds = visibleMessages.filter((message) => message.unread).map((message) => message.id);
      setSelectedMessageIds(unreadIds);
      setSelectMode(true);
      showNotice(`${unreadIds.length} unread message${unreadIds.length === 1 ? "" : "s"} selected`);
    }

    if (selection === "Flagged") {
      const flaggedIds = visibleMessages.filter((message) => message.starred).map((message) => message.id);
      setSelectedMessageIds(flaggedIds);
      setSelectMode(true);
      showNotice(`${flaggedIds.length} flagged message${flaggedIds.length === 1 ? "" : "s"} selected`);
    }

    if (selection === "Invert") {
      const invertedIds = visibleIds.filter((id) => !selectedMessageIds.includes(id));
      setSelectedMessageIds(invertedIds);
      setSelectMode(true);
      showNotice(`${invertedIds.length} message${invertedIds.length === 1 ? "" : "s"} selected`);
    }

    if (selection === "None") {
      setSelectedMessageIds([]);
      setSelectMode(false);
      showNotice("Selection cleared");
    }

    setSelectMenuOpen(false);
  }

  function actionTargetIds() {
    if (selectedMessageIds.length) {
      return selectedMessageIds;
    }

    return selectedMessage ? [selectedMessage.id] : [];
  }

  function messageCountLabel(count: number) {
    return `${count} message${count === 1 ? "" : "s"}`;
  }

  function updateSelectedMessages(update: Partial<MailMessage> | ((message: MailMessage) => Partial<MailMessage>)) {
    const targetIds = actionTargetIds();

    if (!targetIds.length) {
      showNotice("Select a message first");
      return 0;
    }

    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        targetIds.includes(message.id)
          ? { ...message, ...(typeof update === "function" ? update(message) : update) }
          : message
      )
    );

    return targetIds.length;
  }

  function syncMailboxAction(
    action: "move" | "mark-read" | "mark-unread" | "star" | "unstar" | "delete",
    ids: string[],
    folder?: Folder,
    messageSnapshotsOverride?: MailMessage[],
    silent = false
  ) {
    if (!ids.length) {
      return;
    }

    const messageSnapshots = messageSnapshotsOverride ?? messages.filter((message) => ids.includes(message.id));

    fetch("/api/mailbox/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids, folder, messages: messageSnapshots })
    })
      .then(async (response) => {
        const data = (await response.json()) as { error?: string; demo?: boolean; message?: string };

        if (handleUnauthorizedResponse(response)) {
          setServerActionStatus("Session expired");
          return;
        }

        if (!response.ok) {
          throw new Error(data.error ?? "Mailbox action could not sync.");
        }

        if (data.demo || data.message) {
          const message = data.message ?? "Mailbox action applied locally";
          setServerActionStatus(message);
          if (!silent) {
            showNotice(message);
          }
        } else {
          setServerActionStatus("Mailbox action saved");
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Mailbox action failed";
        setServerActionStatus(message);
        showNotice(message);
      });
  }

  function moveSelectedMessages(folder: Folder) {
    const targetIds = actionTargetIds();
    const count = updateSelectedMessages({ folder });

    if (!count) {
      return;
    }

    syncMailboxAction("move", targetIds, folder);
    setSelectedId("");
    setSelectedMessageIds([]);
    setSelectMode(false);
    showNotice(`${messageCountLabel(count)} moved to ${folder}`);
  }

  function deleteSelectedMessages() {
    const targetIds = selectedMessageIds;

    if (!targetIds.length) {
      showNotice("Select messages to delete");
      return;
    }

    if (activeFolder === "Trash") {
      syncMailboxAction("delete", targetIds);
      setMessages((currentMessages) => currentMessages.filter((message) => !targetIds.includes(message.id)));
      setSelectedId("");
      setSelectedMessageIds([]);
      setSelectMode(false);
      showNotice(`${messageCountLabel(targetIds.length)} deleted`);
      return;
    }

    setMessages((currentMessages) =>
      currentMessages.map((message) => (targetIds.includes(message.id) ? { ...message, folder: "Trash" } : message))
    );
    syncMailboxAction("move", targetIds, "Trash");
    setSelectedId("");
    setSelectedMessageIds([]);
    setSelectMode(false);
    showNotice(`${messageCountLabel(targetIds.length)} moved to Trash`);
  }

  function openCompose(prefill: Partial<ComposeDraft> = {}, showRecipientPicker = false) {
    setComposeDraft((draft) => normalizeComposeDraft({ ...draft, ...prefill }));
    setAttachments([]);
    setRecipientPickerOpen(showRecipientPicker);
    setSendError("");
    setSendState("idle");
    setEditorToolbarOpen(true);
    setBodyBold(false);
    setBodyItalic(false);
    setBodyUnderline(false);
    setBodyAlign("left");
    setBodyFont(preferences.composeFont || "Verdana");
    setBodySize("10pt");
    setComposeOpen(true);
  }

  function emailOnly(value: string) {
    const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match?.[0] ?? value.trim();
  }

  function splitRecipients(value: string) {
    return value
      .split(/[;,]/)
      .map((recipient) => recipient.trim())
      .filter(Boolean);
  }

  function isValidEmailAddress(value: string) {
    const email = emailOnly(value);
    return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email) && !email.includes("..");
  }

  function invalidRecipients(...values: string[]) {
    return values.flatMap(splitRecipients).filter((recipient) => !isValidEmailAddress(recipient));
  }

  function addRecipient(email: string) {
    const recipients = uniqueRecipients([...splitRecipients(composeDraft.to), email]);
    updateDraft("to", recipients.join(", "));
    showNotice(`${email} selected`);
  }

  function removeRecipient(email: string) {
    const normalizedEmail = emailOnly(email).toLowerCase();
    const recipients = splitRecipients(composeDraft.to).filter(
      (recipient) => emailOnly(recipient).toLowerCase() !== normalizedEmail
    );
    updateDraft("to", recipients.join(", "));
    showNotice(`${email} removed`);
  }

  function uniqueRecipients(recipients: string[]) {
    const ownAddress = emailOnly(mailboxAddress).toLowerCase();
    const seen = new Set<string>();

    return recipients.filter((recipient) => {
      const normalized = emailOnly(recipient).toLowerCase();

      if (!normalized || normalized === ownAddress || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
  }

  function replyTargetMessage() {
    if (selectedMessageIds.length > 1) {
      showNotice("Open one message before replying");
      return null;
    }

    if (selectedMessageIds.length === 1) {
      const selected = messages.find((message) => message.id === selectedMessageIds[0]);

      if (selected) {
        return selected;
      }
    }

    if (!selectedMessage) {
      showNotice("Select a message first");
      return null;
    }

    return selectedMessage;
  }

  function quotedReplyBody(message: MailMessage) {
    const body = message.body.map((paragraph) => htmlToReadableText(paragraph)).join("\n> ") || htmlToReadableText(message.snippet);
    return `\n\nOn ${message.date}, ${message.from} wrote:\n> ${body}`;
  }

  function composeReply(all = false) {
    const message = replyTargetMessage();

    if (!message) {
      return;
    }

    const sender = message.fromEmail || emailOnly(message.from);
    const replyAllRecipients = uniqueRecipients([sender, ...splitRecipients(message.to)]);
    const recipients = all ? replyAllRecipients : uniqueRecipients([sender]);

    openCompose({
      to: recipients.join(", "),
      subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
      body: ""
    });
    setSelectedMessageIds([]);
    setSelectMode(false);
    closeMenus();
    showNotice(all ? "Reply all ready" : "Reply ready");
  }

  function composeForward() {
    const message = replyTargetMessage();

    if (!message) {
      return;
    }

    openCompose({
      subject: message.subject.startsWith("Fwd:") ? message.subject : `Fwd: ${message.subject}`,
      body: `\n\nForwarded message:\nFrom: ${message.from} <${message.fromEmail}>\nSubject: ${message.subject}\n\n${message.body.map((paragraph) => htmlToReadableText(paragraph)).join("\n\n")}`
    }, true);
    setSelectedMessageIds([]);
    setSelectMode(false);
    closeMenus();
    showNotice("Forward ready");
  }

  function composeForwardAttachment() {
    const message = replyTargetMessage();

    if (!message) {
      return;
    }

    openCompose({
      subject: message.subject.startsWith("Fwd:") ? message.subject : `Fwd: ${message.subject}`,
      body: `\n\nForwarded as attached transcript:\n${message.subject}`
    }, true);
    setAttachments([
      {
        name: `${message.subject.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "message"}.txt`,
        size: message.body.map((paragraph) => htmlToReadableText(paragraph)).join("\n\n").length,
        type: "text/plain",
        content: btoa(unescape(encodeURIComponent(message.body.map((paragraph) => htmlToReadableText(paragraph)).join("\n\n"))))
      }
    ]);
    setSelectedMessageIds([]);
    setSelectMode(false);
    closeMenus();
    showNotice("Forward attachment ready");
  }

  function runMailboxAction(action: string) {
    closeMenus();

    if (action === "Archive") {
      moveSelectedMessages("Archive");
      return;
    }

    if (action === "Delete") {
      if (activeFolder === "Trash") {
        const targetIds = actionTargetIds();

        if (!targetIds.length) {
          showNotice("Select a message first");
          return;
        }

        syncMailboxAction("delete", targetIds);
        setMessages((currentMessages) => currentMessages.filter((message) => !targetIds.includes(message.id)));
        setSelectedId("");
        setSelectedMessageIds([]);
        setSelectMode(false);
        showNotice(`${messageCountLabel(targetIds.length)} deleted`);
        return;
      }

      moveSelectedMessages("Trash");
      return;
    }

    if (action === "Junk") {
      const targetIds = actionTargetIds();
      const count = updateSelectedMessages({ label: "Junk", folder: "Junk" });
      if (!count) {
        return;
      }
      syncMailboxAction("move", targetIds, "Junk");
      setSelectedId("");
      setSelectedMessageIds([]);
      setSelectMode(false);
      showNotice(`${messageCountLabel(count)} marked as junk`);
      return;
    }

    if (action === "Move to Inbox") {
      moveSelectedMessages("Inbox");
      return;
    }

    if (action === "Move to Sent") {
      moveSelectedMessages("Sent");
      return;
    }

    if (action === "Move to Drafts") {
      moveSelectedMessages("Drafts");
      return;
    }

    if (action === "Restore") {
      moveSelectedMessages("Inbox");
      return;
    }

    if (action === "Marked as read") {
      const targetIds = actionTargetIds();
      const count = updateSelectedMessages({ unread: false });
      if (count) {
        syncMailboxAction("mark-read", targetIds);
        showNotice(`${messageCountLabel(count)} marked as read`);
      }
      return;
    }

    if (action === "Marked as unread") {
      const targetIds = actionTargetIds();
      const count = updateSelectedMessages({ unread: true });
      if (count) {
        syncMailboxAction("mark-unread", targetIds);
        showNotice(`${messageCountLabel(count)} marked as unread`);
      }
      return;
    }

    if (action === "Starred") {
      const targetIds = actionTargetIds();
      const shouldStar = selectedMessageIds.length
        ? messages.filter((message) => selectedMessageIds.includes(message.id)).some((message) => !message.starred)
        : !selectedMessage?.starred;
      const count = updateSelectedMessages({ starred: shouldStar });
      if (count) {
        syncMailboxAction(shouldStar ? "star" : "unstar", targetIds);
        showNotice(shouldStar ? `${messageCountLabel(count)} starred` : `${messageCountLabel(count)} unstarred`);
      }
      return;
    }

    if (action === "Print") {
      window.print();
      showNotice("Print dialog opened");
      return;
    }

    if (action === "View source") {
      if (!selectedMessage) {
        showNotice("Select a message first");
        return;
      }

      const sourceBody = selectedMessage.body.map((paragraph) => htmlToReadableText(paragraph)).join("\n\n");

      openCompose({
        to: mailboxAddress,
        subject: `Source: ${selectedMessage.subject}`,
        body: `From: ${selectedMessage.from} <${selectedMessage.fromEmail}>\nTo: ${selectedMessage.to}\nDate: ${selectedMessage.date}\nSubject: ${selectedMessage.subject}\n\n${sourceBody}`
      });
      showNotice("Message source opened in compose");
      return;
    }

    showNotice(`${action} is ready`);
  }

  function updateDraft(field: keyof ComposeDraft, value: string) {
    setComposeDraft((draft) => ({ ...draft, [field]: field === "from" ? normalizeMailboxAddress(value) : value }));
  }

  async function saveDraftToServer(silent = false) {
    const currentDraft = {
      ...composeDraft,
      body: editorRef.current?.innerHTML ?? composeDraft.body
    };
    setComposeDraft(currentDraft);

    const response = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentDraft)
    });
    const data = (await response.json()) as { error?: string; demo?: boolean; message?: string };

    if (handleUnauthorizedResponse(response)) {
      return;
    }

    if (!response.ok) {
      if (!silent) {
        showNotice(data.error ?? "Draft could not be saved");
      }
      return;
    }

    const readableBody = htmlToReadableText(currentDraft.body);
    const draftMessage: MailMessage = {
      id: `draft-${Date.now()}`,
      folder: "Drafts",
      from: "Priscilla Mail",
      fromEmail: currentDraft.from,
      to: currentDraft.to || "(No recipient)",
      subject: currentDraft.subject || "(No subject)",
      snippet: readableBody.slice(0, 120) || "Draft message",
      body: readableBody ? readableBody.split(/\n+/).filter(Boolean) : ["Draft message"],
      time: "Just now",
      date: "Today",
      unread: false,
      starred: false,
      label: data.demo ? "Local draft" : "IMAP draft",
      hasAttachment: attachments.length > 0,
      attachmentName: attachments[0]?.name
    };

    setMessages((currentMessages) => [draftMessage, ...currentMessages.filter((message) => message.id !== draftMessage.id)]);
    if (!silent) {
      showNotice(data.message ?? "Draft saved");
    }
  }

  function downloadAttachment(message: MailMessage) {
    if (!message.id.startsWith("imap-")) {
      showNotice("Demo attachments do not have downloadable file data yet");
      return;
    }

    window.open(`/api/attachment?id=${encodeURIComponent(message.id)}&index=0`, "_blank", "noopener,noreferrer");
    showNotice("Attachment download started");
  }

  async function savePreferences() {
    const response = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences)
    });

    if (handleUnauthorizedResponse(response)) {
      return;
    }

    showNotice(response.ok ? "Settings saved to server" : "Settings could not be saved");
  }

  async function loadHealthReport(silent = false) {
    if (!silent) {
      setHealthLoading(true);
      showNotice("Checking system health");
    }

    try {
      const response = await fetch("/api/health", { cache: "no-store" });

      if (handleUnauthorizedResponse(response)) {
        return;
      }

      const data = (await response.json()) as HealthReport & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Health check failed.");
      }

      setHealthReport(data);

      if (!silent) {
        showNotice("System health updated");
      }
    } catch (error) {
      if (!silent) {
        showNotice(error instanceof Error ? error.message : "Health check failed");
      }
    } finally {
      setHealthLoading(false);
    }
  }

  function updateMailSetup<K extends keyof MailSetup>(key: K, value: MailSetup[K]) {
    setMailSetup((current) => ({ ...current, [key]: value }));
  }

  async function saveMailSetup(test = false) {
    setSetupSaving(true);
    setSetupStatus(test ? "Testing provider connections..." : "Saving provider setup...");

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...mailSetup, test })
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        setup?: Partial<MailSetup>;
        imap?: { ok: boolean; message: string };
        smtp?: { ok: boolean; message: string };
      };

      if (handleUnauthorizedResponse(response)) {
        return;
      }

      if (!response.ok) {
        const detail = [data.imap?.message, data.smtp?.message].filter(Boolean).join(" ");
        throw new Error(detail || data.error || "Mail setup could not be saved.");
      }

      if (data.setup) {
        setMailSetup((current) => ({
          ...current,
          ...data.setup,
          imapPass: "",
          smtpPass: ""
        }));
      }

      const hasImap = Boolean(data.setup?.imapPassConfigured);
      const hasSending = sendingConfigured || Boolean(data.setup?.smtpPassConfigured);
      setSetupConfigured(hasImap && hasSending);
      setSendingConfigured(hasSending);
      setMailboxMode(data.setup?.imapPassConfigured ? "imap" : "demo");
      setSetupStatus(data.message ?? "Mail setup saved.");
      showNotice(data.message ?? "Mail setup saved");
      loadHealthReport(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mail setup could not be saved.";
      setSetupStatus(message);
      showNotice(message);
    } finally {
      setSetupSaving(false);
    }
  }

  async function saveContact() {
    if (!contactDraft.name.trim() || !contactDraft.email.trim()) {
      showNotice("Contact name and email are required");
      return;
    }

    if (!isValidEmailAddress(contactDraft.email)) {
      showNotice("Contact email is not valid");
      return;
    }

    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contactDraft)
    });
    const data = (await response.json()) as { contact?: Contact; contacts?: Contact[]; error?: string };

    if (handleUnauthorizedResponse(response)) {
      return;
    }

    if (!response.ok || !data.contact) {
      showNotice(data.error ?? "Contact could not be saved");
      return;
    }

    setContacts(data.contacts ?? [data.contact, ...contacts.filter((contact) => contact.id !== data.contact?.id)]);
    setContactDraft({ id: "", name: "", email: "", company: "", tag: "General", phone: "", title: "", address: "", website: "", notes: "" });
    setSelectedContactIds([]);
    showNotice("Contact saved");
  }

  async function deleteContact(contactId: string) {
    const response = await fetch(`/api/contacts?id=${encodeURIComponent(contactId)}`, { method: "DELETE" });
    const data = (await response.json()) as { contacts?: Contact[]; error?: string };

    if (handleUnauthorizedResponse(response)) {
      return;
    }

    if (!response.ok) {
      showNotice(data.error ?? "Contact could not be deleted");
      return;
    }

    setContacts(data.contacts ?? contacts.filter((contact) => contact.id !== contactId));
    setSelectedContactIds((ids) => ids.filter((id) => id !== contactId));
    showNotice("Contact deleted");
  }

  async function deleteSelectedContacts() {
    if (!selectedContactIds.length) {
      showNotice("Select contacts first");
      return;
    }

    const response = await fetch(`/api/contacts?ids=${encodeURIComponent(selectedContactIds.join(","))}`, { method: "DELETE" });
    const data = (await response.json()) as { contacts?: Contact[]; error?: string };

    if (handleUnauthorizedResponse(response)) {
      return;
    }

    if (!response.ok) {
      showNotice(data.error ?? "Contacts could not be deleted");
      return;
    }

    setContacts(data.contacts ?? contacts.filter((contact) => !selectedContactIds.includes(contact.id)));
    setSelectedContactIds([]);
    showNotice("Selected contacts deleted");
  }

  function toggleContactSelection(contactId: string) {
    setSelectedContactIds((ids) =>
      ids.includes(contactId) ? ids.filter((id) => id !== contactId) : [...ids, contactId]
    );
  }

  function emailSelectedContacts() {
    const recipients = contacts
      .filter((contact) => selectedContactIds.includes(contact.id))
      .map((contact) => contact.email)
      .filter(isValidEmailAddress);

    if (!recipients.length) {
      showNotice("Select valid contacts first");
      return;
    }

    openCompose({ to: recipients.join(", ") });
    showNotice(`${recipients.length} contact${recipients.length === 1 ? "" : "s"} added`);
  }

  function exportContacts() {
    const rows = [
      ["Name", "Email", "Company", "Group", "Phone", "Title", "Website", "Address", "Notes"],
      ...contacts.map((contact) => [
        contact.name,
        contact.email,
        contact.company,
        contact.tag,
        contact.phone ?? "",
        contact.title ?? "",
        contact.website ?? "",
        contact.address ?? "",
        contact.notes ?? ""
      ])
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "contacts.csv";
    link.click();
    URL.revokeObjectURL(url);
    showNotice("Contacts exported");
  }

  async function importContacts(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    const rows = text
      .split(/\r?\n/)
      .map((row) => row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")))
      .filter((row) => row.some(Boolean));
    const imported = rows
      .slice(rows[0]?.[0]?.toLowerCase() === "name" ? 1 : 0)
      .map<Contact>((row, index) => ({
        id: `contact-import-${Date.now()}-${index}`,
        name: row[0] || row[1] || "Imported contact",
        email: row[1] || "",
        company: row[2] || "",
        tag: row[3] || "Imported",
        phone: row[4] || "",
        title: row[5] || "",
        website: row[6] || "",
        address: row[7] || "",
        notes: row[8] || ""
      }))
      .filter((contact) => isValidEmailAddress(contact.email));

    if (imported.length) {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: imported })
      });
      const data = (await response.json()) as { contacts?: Contact[]; error?: string };

      if (handleUnauthorizedResponse(response)) {
        return;
      }

      if (!response.ok) {
        showNotice(data.error ?? "Contacts could not be imported");
        return;
      }

      setContacts(data.contacts ?? imported);
    }
    event.target.value = "";
    showNotice(`${imported.length} contact${imported.length === 1 ? "" : "s"} imported`);
  }

  async function createFolder() {
    const folderName = newFolderName.trim();

    if (!folderName) {
      showNotice("Folder name is required");
      return;
    }

    const response = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName })
    });
    const data = (await response.json()) as { error?: string };

    if (handleUnauthorizedResponse(response)) {
      return;
    }

    if (!response.ok) {
      showNotice(data.error ?? "Folder could not be created");
      return;
    }

    setCustomFolders((current) => Array.from(new Set([...current, folderName])));
    setNewFolderName("");
    showNotice("Folder created");
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      showNotice("Browser notifications are not supported");
      return;
    }

    const permission = await Notification.requestPermission();
    showNotice(permission === "granted" ? "Notifications enabled" : "Notifications not enabled");

    if (permission === "granted") {
      new Notification("Priscilla Webmail", { body: "New mail notifications are ready." });
    }
  }

  function addContactRecipient() {
    const nextContact = contacts.find((contact) => !composeDraft.to.includes(contact.email));

    if (!nextContact) {
      showNotice("All demo contacts are already added");
      return;
    }

    updateDraft("to", composeDraft.to ? `${composeDraft.to}, ${nextContact.email}` : nextContact.email);
    showNotice(`${nextContact.name} added`);
  }

  function addRecipientField() {
    setShowCcBcc(true);
    showNotice("Cc and Bcc fields opened");
  }

  function keepEditorFocus(event: PointerEvent<HTMLElement>) {
    event.preventDefault();
  }

  function saveEditorSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (editor.contains(range.commonAncestorContainer)) {
      editorSelectionRef.current = range.cloneRange();
    }
  }

  function restoreEditorSelection() {
    const editor = editorRef.current;

    if (!editor) {
      return false;
    }

    editor.focus();
    const selection = window.getSelection();

    if (!selection) {
      return false;
    }

    selection.removeAllRanges();

    if (editorSelectionRef.current) {
      try {
        selection.addRange(editorSelectionRef.current);
        return true;
      } catch {
        editorSelectionRef.current = null;
      }
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.addRange(range);
    editorSelectionRef.current = range.cloneRange();
    return true;
  }

  function syncEditorBody() {
    updateDraft("body", editorRef.current?.innerHTML ?? "");
  }

  function syncFormatState() {
    saveEditorSelection();

    try {
      setBodyBold(document.queryCommandState("bold"));
      setBodyItalic(document.queryCommandState("italic"));
      setBodyUnderline(document.queryCommandState("underline"));
    } catch {
      return;
    }
  }

  function currentEditorRange() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer) ? range : null;
  }

  function runEditorCommand(command: string, value?: string) {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    restoreEditorSelection();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);

    if (command === "hiliteColor") {
      document.execCommand("backColor", false, value);
    }

    saveEditorSelection();
    syncEditorBody();
    syncFormatState();
  }

  function applyInlineStyles(styles: Record<string, string>, applyToEditor = false) {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    restoreEditorSelection();
    const range = currentEditorRange();
    const hasSelection = Boolean(range && !range.collapsed);

    if (hasSelection && range) {
      const wrapped = wrapRangeWithStyles(range, styles);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(wrapped);
      editorSelectionRef.current = wrapped.cloneRange();
    } else if (editor.innerText.trim()) {
      stampStyles(editor, styles);
      restoreEditorSelection();
    } else if (range) {
      const wrapped = wrapRangeWithStyles(range, styles);
      const caret = document.createRange();
      caret.selectNodeContents(wrapped.startContainer);
      caret.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(caret);
      editorSelectionRef.current = caret.cloneRange();
    }

    if (applyToEditor) {
      Object.entries(styles).forEach(([property, value]) => {
        editor.style.setProperty(property, value);
      });
    }

    saveEditorSelection();
    syncEditorBody();
  }

  function setEditorFont(font: string) {
    setBodyFont(font);
    applyInlineStyles({ "font-family": cssFontFamily(font) }, true);
  }

  function setEditorSize(size: string) {
    setBodySize(size);
    applyInlineStyles({ "font-size": size }, true);
  }

  function handleToolbarImageClick() {
    if (!editorToolbarOpen) {
      setEditorToolbarOpen(true);
      showNotice("Formatting toolbar opened");
      return;
    }

    saveEditorSelection();
    imageInputRef.current?.click();
  }

  function handleEditorImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showNotice("Choose an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const editor = editorRef.current;
      const imageSrc = typeof reader.result === "string" ? reader.result : "";

      if (!editor || !imageSrc) {
        showNotice("Image could not be inserted");
        return;
      }

      restoreEditorSelection();
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${imageSrc}" alt="${file.name.replace(/"/g, "")}" style="max-width:100%;height:auto;" />`
      );
      saveEditorSelection();
      syncEditorBody();
      showNotice("Image inserted");
    };
    reader.readAsDataURL(file);
  }

  function openListOptions() {
    setSelectMenuOpen(false);
    setForwardMenuOpen(false);
    setMarkMenuOpen(false);
    setMoreMenuOpen(false);
    setDraftSortingColumn(sortingColumn);
    setDraftSortingOrder(sortingOrder);
    setDraftListMode(listMode);
    setOptionsMenuOpen(true);
  }

  function saveListOptions() {
    setSortingColumn(draftSortingColumn);
    setSortingOrder(draftSortingOrder);
    setSortNewest(draftSortingOrder === "descending");
    setListMode(draftListMode);
    setOptionsMenuOpen(false);
    showNotice("List options saved");
  }

  function runMailboxMenuAction(action: "Compact" | "Empty" | "Mark all as read" | "Manage folders") {
    setAccountMenuOpen(false);

    if (action === "Compact") {
      setListMode((mode) => (mode === "Compact" ? "List" : "Compact"));
      showNotice(listMode === "Compact" ? "List mode restored" : "Compact list enabled");
      return;
    }

    if (action === "Empty") {
      const visibleIds = new Set(visibleMessages.map((message) => message.id));

      if (visibleIds.size === 0) {
        showNotice(`${activeFolder} is already empty`);
        return;
      }

      setMessages((currentMessages) => {
        if (activeFolder === "Starred") {
          return currentMessages.map((message) =>
            visibleIds.has(message.id) ? { ...message, starred: false } : message
          );
        }

        return currentMessages.filter((message) => !visibleIds.has(message.id));
      });
      setSelectedId("");
      setSelectedMessageIds([]);
      showNotice(activeFolder === "Starred" ? "Flagged messages cleared" : `${activeFolder} emptied`);
      return;
    }

    if (action === "Mark all as read") {
      const visibleIds = new Set(visibleMessages.map((message) => message.id));
      setMessages((currentMessages) =>
        currentMessages.map((message) => (visibleIds.has(message.id) ? { ...message, unread: false } : message))
      );
      showNotice("All visible messages marked as read");
      return;
    }

    setActiveApp("Settings");
    setActiveSettingsGroup("Folders");
    setMobileFoldersOpen(false);
    showNotice("Manage folders opened");
  }

  function applyMailboxPage(data: MailboxPageResponse, syncFolder: Folder, offset: number) {
    if (data.demo) {
      setFolderHasMore((current) => ({ ...current, [syncFolder]: false }));
      setMailboxMode("demo");
      setLastSyncedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      setMessages((currentMessages) => {
        const alreadyAdded = currentMessages.some((message) => message.id === refreshedMessage.id);

        if (alreadyAdded) {
          return currentMessages.map((message) =>
            message.id === refreshedMessage.id ? { ...message, time: "Just now", unread: true } : message
          );
        }

        return [refreshedMessage, ...currentMessages];
      });
      setSelectedId(refreshedMessage.id);
      return;
    }

    setMailboxMode(data.provider === "resend" ? "resend" : "imap");
    setFolderHasMore((current) => ({ ...current, [syncFolder]: Boolean(data.hasMore) }));
    setFolderMessageTotals((current) => ({ ...current, [syncFolder]: data.total ?? offset + (data.messages?.length ?? 0) }));
    setLastSyncedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));

    if (!data.messages?.length) {
      if (offset === 0) {
        setMessages((currentMessages) => currentMessages.filter((message) => message.folder !== syncFolder));
        setSelectedId("");
      }

      return;
    }

    if (offset === 0) {
      setVisibleLimit((limit) => Math.max(Math.min(limit, visibleMessageStep), Math.min(data.messages!.length, visibleMessageStep)));
    }

    setMessages((currentMessages) => {
      const incomingIds = new Set(data.messages?.map((message) => message.id));

      if (offset === 0) {
        const otherMessages = currentMessages.filter(
          (message) => message.folder !== syncFolder && !incomingIds.has(message.id)
        );
        return [...data.messages!, ...otherMessages];
      }

      const existingIds = new Set(currentMessages.map((message) => message.id));
      const nextMessages = data.messages!.filter((message) => !existingIds.has(message.id));

      return [...currentMessages, ...nextMessages];
    });

    if (offset === 0) {
      setSelectedId(data.messages[0].id);
    }
  }

  async function fetchMailboxPage(syncFolder: Folder, offset: number) {
    const response = await fetch(`/api/mailbox?folder=${encodeURIComponent(syncFolder)}&limit=${mailboxPageSize}&offset=${offset}`);
    const data = (await response.json()) as MailboxPageResponse;

    if (handleUnauthorizedResponse(response)) {
      return null;
    }

    if (!response.ok) {
      throw new Error(data.error ?? "Mailbox refresh failed");
    }

    return data;
  }

  async function refreshMailbox(silent = false, targetFolder?: Folder) {
    if (refreshInFlightRef.current) {
      if (!silent) {
        showNotice("Mailbox refresh is already running");
      }
      return;
    }

    const folderToSync = targetFolder ?? activeFolder;
    const syncFolder = folderToSync === "Starred" ? "Inbox" : folderToSync;
    let fastNoticeShown = false;
    let fastTimer: number | undefined;

    refreshInFlightRef.current = true;
    setRefreshing(true);
    closeMenus();
    setQuery("");
    setSelectedMessageIds([]);
    setSelectMode(false);
    setActiveApp("Mail");
    setActiveFolder(syncFolder);

    if (!silent) {
      showNotice("Refreshing mailbox...");
      fastTimer = window.setTimeout(() => {
        fastNoticeShown = true;
        setRefreshing(false);
        showNotice("Showing current messages. Loading the rest in the background...");
      }, 300);
    }

    try {
      let offset = 0;
      let data = await fetchMailboxPage(syncFolder, offset);

      if (!data) {
        return;
      }

      applyMailboxPage(data, syncFolder, offset);

      while (data.hasMore && data.messages?.length) {
        offset += data.messages.length;
        data = await fetchMailboxPage(syncFolder, offset);

        if (!data) {
          return;
        }

        applyMailboxPage(data, syncFolder, offset);
      }

      const providerName = data.provider === "resend" ? "Resend" : data.provider === "saved" ? "saved mail" : "IMAP";
      if (!silent) {
        showNotice(data.demo ? data.message ?? "Demo mailbox refreshed" : `${syncFolder} fully synced from ${providerName}`);
      } else if (!fastNoticeShown) {
        showNotice(`${syncFolder} auto-synced`);
      }
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Mailbox refresh failed");
    } finally {
      refreshInFlightRef.current = false;
      if (fastTimer) {
        window.clearTimeout(fastTimer);
      }
      setRefreshing(false);
    }
  }

  async function loadMoreMessages() {
    if (visibleMessages.length > displayedMessages.length) {
      setVisibleLimit((limit) => limit + visibleMessageStep);
      return;
    }

    if (refreshing || loadingMoreMessages || query.trim() || activeFolder === "Starred" || !folderHasMore[activeFolder]) {
      return;
    }

    const loadedCount = messages.filter((message) => message.folder === activeFolder).length;
    setLoadingMoreMessages(true);

    try {
      const response = await fetch(`/api/mailbox?folder=${encodeURIComponent(activeFolder)}&limit=${mailboxPageSize}&offset=${loadedCount}`);
      const data = (await response.json()) as MailboxPageResponse;

      if (handleUnauthorizedResponse(response)) {
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "More messages could not be loaded.");
      }

      if (data.messages?.length) {
        setMessages((currentMessages) => {
          const existingIds = new Set(currentMessages.map((message) => message.id));
          const nextMessages = data.messages!.filter((message) => !existingIds.has(message.id));

          return [...currentMessages, ...nextMessages];
        });
        setVisibleLimit((limit) => limit + data.messages!.length);
        setFolderMessageTotals((current) => ({ ...current, [activeFolder]: data.total ?? loadedCount + data.messages!.length }));
      }

      setFolderHasMore((current) => ({ ...current, [activeFolder]: Boolean(data.hasMore) }));
      showNotice(data.hasMore ? `Loaded more ${activeFolder} messages` : `All loaded ${activeFolder} messages are visible`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "More messages could not be loaded.");
    } finally {
      setLoadingMoreMessages(false);
    }
  }

  function handleMessageListScroll(event: UIEvent<HTMLDivElement>) {
    const list = event.currentTarget;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;

    if (distanceFromBottom < 360) {
      void loadMoreMessages();
    }
  }

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    try {
      const nextAttachments = await Promise.all(files.map(fileToAttachment));
      setAttachments((currentAttachments) => [...currentAttachments, ...nextAttachments]);
      showNotice(`${files.length} attachment${files.length > 1 ? "s" : ""} added`);
    } catch {
      showNotice("Attachment could not be added");
    }

    event.target.value = "";
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedBody = cleanOutgoingBody(editorRef.current?.innerHTML ?? composeDraft.body);
    const currentDraft = {
      ...composeDraft,
      body: cleanedBody.html
    };
    setComposeDraft(currentDraft);

    if (!currentDraft.to.trim() || !currentDraft.subject.trim() || !cleanedBody.text) {
      setSendState("error");
      setSendError("Recipient, subject, and message body are required.");
      return;
    }

    const invalidAddresses = invalidRecipients(currentDraft.to, currentDraft.cc, currentDraft.bcc);

    if (invalidAddresses.length) {
      const invalidList = invalidAddresses.join(", ");
      setSendState("error");
      setSendError(`Invalid email address${invalidAddresses.length === 1 ? "" : "es"}: ${invalidList}`);
      showNotice("Email address is not valid");
      return;
    }

    setSendState("sending");
    setSendError("");

    let data: { error?: string; demo?: boolean; message?: string; sentMessage?: MailMessage; sentSynced?: boolean; sentSyncPending?: boolean } = {};
    let response: Response;

    try {
      response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...currentDraft,
          body: cleanedBody.html,
          attachments
        })
      });
      data = (await response.json().catch(() => ({}))) as typeof data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The message could not be sent.";
      setSendError(message);
      setSendState("error");
      showNotice("Message could not be sent");
      return;
    }

    if (handleUnauthorizedResponse(response)) {
      setSendState("idle");
      return;
    }

    if (!response.ok) {
      setSendError(data.error ?? "The message could not be sent.");
      setSendState("error");
      showNotice("Message could not be sent");
      return;
    }

    const readableBody = cleanedBody.text;
    const sentMessage: MailMessage = data.sentMessage
      ? {
          ...data.sentMessage,
          time: data.sentMessage.time || "Just now",
          date: data.sentMessage.date || "Today"
        }
      : {
          id: `m-${Date.now()}`,
          folder: "Sent",
          from: "Priscilla Mail",
          fromEmail: currentDraft.from,
          to: currentDraft.to,
          subject: currentDraft.subject,
          snippet: readableBody.slice(0, 120),
          body: cleanedBody.html ? [cleanedBody.html] : ["Message sent."],
          time: "Just now",
          date: "Today",
          unread: false,
          starred: false,
          label: "Sent",
          hasAttachment: attachments.length > 0,
          attachmentName: attachments[0]?.name
        };

    setMessages((currentMessages) => [sentMessage, ...currentMessages]);
    setSentSyncStatus(data.demo ? "Demo Sent folder" : data.sentSynced ? "Synced to IMAP Sent" : data.sentSyncPending ? "Sent sync continuing" : "Sent, not copied to IMAP");
    setSendState("sent");
    setComposeDraft(emptyDraft);
    setAttachments([]);
    setShowCcBcc(false);
    window.localStorage.removeItem("priscilla-compose-draft");
    showNotice(data.demo ? "Message saved to demo Sent folder" : data.sentSynced ? "Message sent and synced to Sent" : "Message sent");
    setTimeout(() => {
      setComposeOpen(false);
      setSendState("idle");
    }, 900);
  }

  function renderAppPanel() {
    if (activeApp === "Contacts") {
      const contactGroups = ["All", ...Array.from(new Set(contacts.map((contact) => contact.tag || "General")))];
      const normalizedContactSearch = contactSearch.trim().toLowerCase();
      const visibleContacts = contacts.filter((contact) => {
        const groupMatch = activeContactGroup === "All" || contact.tag === activeContactGroup;
        const searchMatch =
          !normalizedContactSearch ||
          [contact.name, contact.email, contact.company, contact.tag, contact.phone, contact.title, contact.website, contact.notes]
            .join(" ")
            .toLowerCase()
            .includes(normalizedContactSearch);

        return groupMatch && searchMatch;
      });
      const allVisibleContactsSelected =
        visibleContacts.length > 0 && visibleContacts.every((contact) => selectedContactIds.includes(contact.id));

      return (
        <section className="utility-panel" aria-label="Contacts">
          <div className="panel-heading">
            <div>
              <span>Contacts</span>
              <h1>Address book</h1>
            </div>
            <div className="contact-heading-actions">
              <input ref={contactImportRef} hidden accept=".csv,text/csv" type="file" onChange={importContacts} />
              <button onClick={() => contactImportRef.current?.click()}>
                <Upload size={17} />
                Import
              </button>
              <button onClick={exportContacts}>
                <Download size={17} />
                Export
              </button>
            </div>
          </div>

          <div className="contact-tools">
            <label className="contact-search">
              <Search size={17} />
              <input
                aria-label="Search contacts"
                placeholder="Search contacts"
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
              />
            </label>
            <div className="contact-groups" aria-label="Contact groups">
              {contactGroups.map((group) => (
                <button
                  className={group === activeContactGroup ? "active" : ""}
                  key={group}
                  onClick={() => {
                    setActiveContactGroup(group);
                    setSelectedContactIds([]);
                  }}
                >
                  {group}
                </button>
              ))}
            </div>
            <div className="contact-bulk-actions">
              <label>
                <input
                  checked={allVisibleContactsSelected}
                  type="checkbox"
                  onChange={(event) => {
                    setSelectedContactIds(event.target.checked ? visibleContacts.map((contact) => contact.id) : []);
                  }}
                />
                <span>{selectedContactIds.length ? `${selectedContactIds.length} selected` : "Select"}</span>
              </label>
              <button disabled={!selectedContactIds.length} onClick={emailSelectedContacts}>
                <Send size={16} />
                Email
              </button>
              <button disabled={!selectedContactIds.length} onClick={deleteSelectedContacts}>
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>

          <div className="inline-editor contact-editor">
            <input
              aria-label="Contact name"
              placeholder="Name"
              value={contactDraft.name}
              onChange={(event) => setContactDraft((draft) => ({ ...draft, name: event.target.value }))}
            />
            <input
              aria-label="Contact email"
              placeholder="Email"
              value={contactDraft.email}
              onChange={(event) => setContactDraft((draft) => ({ ...draft, email: event.target.value }))}
            />
            <input
              aria-label="Contact company"
              placeholder="Company"
              value={contactDraft.company}
              onChange={(event) => setContactDraft((draft) => ({ ...draft, company: event.target.value }))}
            />
            <input
              aria-label="Contact title"
              placeholder="Job title"
              value={contactDraft.title ?? ""}
              onChange={(event) => setContactDraft((draft) => ({ ...draft, title: event.target.value }))}
            />
            <input
              aria-label="Contact group"
              placeholder="Group"
              value={contactDraft.tag}
              onChange={(event) => setContactDraft((draft) => ({ ...draft, tag: event.target.value }))}
            />
            <input
              aria-label="Contact phone"
              placeholder="Phone"
              value={contactDraft.phone ?? ""}
              onChange={(event) => setContactDraft((draft) => ({ ...draft, phone: event.target.value }))}
            />
            <input
              aria-label="Contact website"
              placeholder="Website"
              value={contactDraft.website ?? ""}
              onChange={(event) => setContactDraft((draft) => ({ ...draft, website: event.target.value }))}
            />
            <input
              aria-label="Contact address"
              placeholder="Address"
              value={contactDraft.address ?? ""}
              onChange={(event) => setContactDraft((draft) => ({ ...draft, address: event.target.value }))}
            />
            <input
              aria-label="Contact notes"
              placeholder="Notes"
              value={contactDraft.notes ?? ""}
              onChange={(event) => setContactDraft((draft) => ({ ...draft, notes: event.target.value }))}
            />
            <button onClick={saveContact}>
              <Check size={17} />
              Save
            </button>
            {contactDraft.id ? (
              <button
                className="secondary-inline"
                onClick={() => setContactDraft({ id: "", name: "", email: "", company: "", tag: "General", phone: "", title: "", address: "", website: "", notes: "" })}
              >
                <X size={17} />
                Clear
              </button>
            ) : null}
          </div>
          <div className="utility-list">
            {visibleContacts.map((contact) => (
              <article className="utility-card" key={contact.id}>
                <label className="contact-select">
                  <input
                    aria-label={`Select ${contact.name}`}
                    checked={selectedContactIds.includes(contact.id)}
                    type="checkbox"
                    onChange={() => toggleContactSelection(contact.id)}
                  />
                </label>
                <div className="avatar">{contact.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{contact.name}</strong>
                  <span>{contact.email}</span>
                  <small>{[contact.title, contact.company, contact.phone].filter(Boolean).join(" · ")}</small>
                </div>
                <button onClick={() => openCompose({ to: contact.email })}>
                  <Send size={15} />
                  {contact.tag}
                </button>
                <button aria-label={`Edit ${contact.name}`} onClick={() => setContactDraft(contact)}>
                  <Edit3 size={16} />
                </button>
                <button aria-label={`Delete ${contact.name}`} onClick={() => deleteContact(contact.id)}>
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
            {!visibleContacts.length ? (
              <div className="empty-mailbox contact-empty">
                <UsersRound size={42} />
                <strong>No contacts found</strong>
                <p>Add a contact, import a CSV, or clear your search.</p>
              </div>
            ) : null}
          </div>
        </section>
      );
    }

    if (activeApp === "Calendar") {
      const today = startOfDay(new Date());
      const displayedDate = startOfDay(calendarDate);
      const weekDays = Array.from({ length: calendarMode === "Day" ? 1 : 7 }, (_, index) =>
        addDays(calendarMode === "Day" ? displayedDate : startOfWeek(displayedDate), index)
      );
      const currentDayIndex = weekDays.findIndex((day) => isSameDay(day, today));
      const timeSlots = ["all-day", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
      const miniWeeks = getMonthGrid(displayedDate);
      const visibleEvents = events.filter((event) =>
        `${event.title} ${event.time} ${event.owner}`.toLowerCase().includes(calendarSearch.trim().toLowerCase())
      );

      function moveCalendar(direction: -1 | 1) {
        if (calendarMode === "Month" || calendarMode === "Agenda") {
          setCalendarDate((date) => addMonths(date, direction));
          return;
        }

        setCalendarDate((date) => addDays(date, calendarMode === "Day" ? direction : direction * 7));
      }

      return (
        <section className="calendar-app" aria-label="Calendar">
          <aside className="calendar-sidebar">
            <label className="calendar-search">
              <Search size={19} />
              <input aria-label="Find calendars" placeholder="Find calendars..." />
            </label>
            <div className="calendar-list">
              {["Default", "cPanel CalDAV Calendar"].map((calendar, index) => (
                <button className={index === 0 ? "calendar-source active" : "calendar-source"} key={calendar}>
                  <CalendarDays size={17} />
                  <span>{calendar}</span>
                  <span className="calendar-toggle" aria-hidden="true" />
                  <span className="calendar-eye" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="mini-calendar">
              <div className="mini-nav">
                <button aria-label="Previous month" onClick={() => setCalendarDate((date) => addMonths(date, -1))}>{"<"}</button>
                <select
                  aria-label="Month"
                  value={displayedDate.getMonth()}
                  onChange={(event) =>
                    setCalendarDate((date) => new Date(date.getFullYear(), Number(event.target.value), date.getDate()))
                  }
                >
                  {Array.from({ length: 12 }, (_, monthIndex) => (
                    <option key={monthIndex} value={monthIndex}>
                      {new Date(2026, monthIndex, 1).toLocaleDateString("en-US", { month: "long" })}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Year"
                  value={displayedDate.getFullYear()}
                  onChange={(event) =>
                    setCalendarDate((date) => new Date(Number(event.target.value), date.getMonth(), date.getDate()))
                  }
                >
                  {Array.from({ length: 7 }, (_, index) => displayedDate.getFullYear() - 3 + index).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button aria-label="Next month" onClick={() => setCalendarDate((date) => addMonths(date, 1))}>{">"}</button>
              </div>
              <div className="mini-grid header">
                {["Wk", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <strong key={day}>{day}</strong>
                ))}
              </div>
              {miniWeeks.map((week, weekIndex) => (
                <div className="mini-grid" key={week.map((day) => day.toDateString()).join("-")}>
                  <button aria-label={`Week ${weekIndex + 1}`} type="button">{weekIndex + 1}</button>
                  {week.map((day) => (
                    <button
                      className={`${day.getMonth() !== displayedDate.getMonth() ? "muted" : ""} ${
                        isSameDay(day, today) ? "today" : ""
                      } ${isSameDay(day, displayedDate) ? "selected" : ""}`}
                      key={day.toDateString()}
                      onClick={() => setCalendarDate(day)}
                    >
                      {day.getDate()}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </aside>

          <section className="calendar-main">
            <header className="calendar-topbar">
              <label className="calendar-search main-search">
                <Search size={19} />
                <input
                  aria-label="Search calendar"
                  placeholder="Search..."
                  value={calendarSearch}
                  onChange={(event) => setCalendarSearch(event.target.value)}
                />
              </label>
              <div className="calendar-range">
                <strong>{formatCalendarHeader(displayedDate, calendarMode)}</strong>
                <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
              </div>
              <div className="calendar-nav-buttons">
                <button aria-label={`Previous ${calendarMode.toLowerCase()}`} onClick={() => moveCalendar(-1)}>{"<"}</button>
                <button
                  className="today-button"
                  onClick={() => {
                    setCalendarDate(new Date());
                    showNotice("Today selected");
                  }}
                >
                  Today
                </button>
                <button aria-label={`Next ${calendarMode.toLowerCase()}`} onClick={() => moveCalendar(1)}>{">"}</button>
              </div>
            </header>
            <div className="calendar-modebar">
              {(["Day", "Week", "Month", "Agenda"] as CalendarMode[]).map((mode) => (
                <button className={mode === calendarMode ? "active" : ""} key={mode} onClick={() => setCalendarMode(mode)}>
                  {mode}
                </button>
              ))}
            </div>
            {calendarMode === "Month" ? (
              <div className="month-calendar" aria-label="Month calendar">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <strong key={day}>{day}</strong>
                ))}
                {miniWeeks.flat().map((day) => (
                  <button
                    className={`${day.getMonth() !== displayedDate.getMonth() ? "muted" : ""} ${
                      isSameDay(day, today) ? "current-day" : ""
                    } ${isSameDay(day, displayedDate) ? "selected-day" : ""}`}
                    key={day.toDateString()}
                    onClick={() => {
                      setCalendarDate(day);
                      setCalendarMode("Day");
                    }}
                  >
                    <span>{day.getDate()}</span>
                  </button>
                ))}
              </div>
            ) : calendarMode === "Agenda" ? (
              <div className="agenda-list">
                {visibleEvents.map((event) => (
                  <article key={event.title}>
                    <CalendarDays size={20} />
                    <div>
                      <strong>{event.title}</strong>
                      <span>{event.time}</span>
                      <small>{event.owner}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div
                className={calendarMode === "Day" ? "week-calendar day-calendar" : "week-calendar"}
                aria-label={`${calendarMode} calendar`}
              >
                <div className="week-header">
                  <span />
                  {weekDays.map((day) => (
                    <strong className={isSameDay(day, today) ? "current-day" : ""} key={day.toDateString()}>
                      {day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </strong>
                  ))}
                </div>
                {timeSlots.map((slot) => (
                  <div className="week-row" key={slot}>
                    <time>{slot}</time>
                    {weekDays.map((day) => (
                      <button
                        aria-label={`${slot} on ${day.toLocaleDateString("en-US")}`}
                        className={isSameDay(day, today) ? "current-day" : ""}
                        key={`${slot}-${day.toDateString()}`}
                        onClick={() => {
                          setCalendarDate(day);
                          showNotice(`${slot} on ${day.toLocaleDateString("en-US")} selected`);
                        }}
                      />
                    ))}
                  </div>
                ))}
                {currentDayIndex >= 0 ? (
                  <div
                    className={`time-marker ${calendarMode === "Day" ? "day-marker" : `week-marker marker-day-${currentDayIndex}`}`}
                  />
                ) : null}
              </div>
            )}
          </section>
        </section>
      );
    }

    if (activeApp === "Files") {
      const attachedMessages = messages.filter((message) => message.hasAttachment);

      return (
        <section className="utility-panel" aria-label="Files">
          <div className="panel-heading">
            <div>
              <span>Files</span>
              <h1>Mail attachments</h1>
            </div>
            <button onClick={() => showNotice("File search opened")}>
              <Search size={17} />
              Find
            </button>
          </div>
          <div className="utility-list">
            {attachedMessages.map((message) => (
              <article className="utility-card" key={message.id}>
                <FileText size={24} />
                <div>
                  <strong>{message.attachmentName}</strong>
                  <span>{message.subject}</span>
                  <small>{message.from}</small>
                </div>
                <button aria-label={`Download ${message.attachmentName}`} onClick={() => downloadAttachment(message)}>
                  <Download size={16} />
                </button>
              </article>
            ))}
          </div>
        </section>
      );
    }

    return (
      <section className="roundcube-settings" aria-label="Settings">
        <aside className="settings-taskbar" aria-label="Settings groups">
          <div className="settings-title">
            <Settings size={20} />
            <strong>Settings</strong>
          </div>
          {settingsGroups.map((group) => {
            const Icon = group.icon;
            return (
              <button
                className={activeSettingsGroup === group.name ? "active" : ""}
                key={group.name}
                onClick={() => setActiveSettingsGroup(group.name)}
              >
                <Icon size={18} />
                <span>{group.name}</span>
              </button>
            );
          })}
        </aside>

        <aside className="settings-section-list" aria-label="Settings sections">
          {activeSettingsGroup === "Preferences"
            ? preferenceSections.map((section) => (
                <button
                  className={activePreference === section ? "active" : ""}
                  key={section}
                  onClick={() => setActivePreference(section)}
                >
                  {section}
                </button>
              ))
            : null}
          {activeSettingsGroup === "Folders"
            ? folderSettings.map((folder) => (
                <button className={folder === "Inbox" ? "active" : ""} key={folder}>
                  {folder}
                </button>
              ))
            : null}
          {activeSettingsGroup === "Identities" ? (
            <>
              <button className="active">{mailboxAddress}</button>
              <button>admin@willibabsdigitals.com</button>
            </>
          ) : null}
          {activeSettingsGroup === "Responses"
            ? responseTemplates.map((template, index) => (
                <button className={index === 0 ? "active" : ""} key={template.title}>
                  {template.title}
                </button>
              ))
            : null}
          {activeSettingsGroup === "Domain" ? (
            <>
              <button className="active">DNS records</button>
              <button>Authentication</button>
              <button>Provider setup</button>
            </>
          ) : null}
          {activeSettingsGroup === "Health" ? (
            <>
              <button className="active">System status</button>
              <button>DNS checks</button>
              <button>Storage</button>
            </>
          ) : null}
        </aside>

        <section className="settings-detail">
          <header className="settings-detail-header">
            <div>
              <span>{activeSettingsGroup}</span>
              <h1>{activeSettingsGroup === "Preferences" ? activePreference : activeSettingsGroup}</h1>
            </div>
            {activeSettingsGroup === "Health" ? (
              <button className="save-settings" disabled={healthLoading} onClick={() => loadHealthReport(false)}>
                <RefreshCw size={17} />
                {healthLoading ? "Checking..." : "Refresh"}
              </button>
            ) : (
              <button className="save-settings" onClick={savePreferences}>
                <Check size={17} />
                Save
              </button>
            )}
          </header>

          {activeSettingsGroup === "Preferences" ? (
            <form className="roundcube-form">
              {activePreference === "User Interface" ? (
                <>
                  <label>
                    <span>Language</span>
                    <select value={preferences.language} onChange={(event) => setPreferences((current) => ({ ...current, language: event.target.value }))}>
                      <option>English</option>
                      <option>French</option>
                      <option>Spanish</option>
                    </select>
                  </label>
                  <label>
                    <span>Time zone</span>
                    <select value={preferences.timeZone} onChange={(event) => setPreferences((current) => ({ ...current, timeZone: event.target.value }))}>
                      <option>Auto</option>
                      <option>America/New_York</option>
                      <option>America/Los_Angeles</option>
                      <option>UTC</option>
                    </select>
                  </label>
                  <label>
                    <span>Time format</span>
                    <select value={preferences.timeFormat} onChange={(event) => setPreferences((current) => ({ ...current, timeFormat: event.target.value }))}>
                      <option>12-hour</option>
                      <option>24-hour</option>
                    </select>
                  </label>
                  <label>
                    <span>Interface skin</span>
                    <select value={preferences.interfaceSkin} onChange={(event) => setPreferences((current) => ({ ...current, interfaceSkin: event.target.value }))}>
                      <option>Elastic</option>
                      <option>Classic</option>
                      <option>Larry</option>
                    </select>
                  </label>
                  <label>
                    <span>Refresh</span>
                    <select value={preferences.refresh} onChange={(event) => setPreferences((current) => ({ ...current, refresh: event.target.value }))}>
                      <option>Every minute</option>
                      <option>Every 5 minutes</option>
                      <option>Every 15 minutes</option>
                      <option>Manually</option>
                    </select>
                  </label>
                </>
              ) : null}

              {activePreference === "Mailbox View" ? (
                <>
                  <label>
                    <span>Layout</span>
                    <select value={preferences.listLayout} onChange={(event) => setPreferences((current) => ({ ...current, listLayout: event.target.value }))}>
                      <option>Widescreen</option>
                      <option>Desktop</option>
                      <option>List</option>
                    </select>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.previewPane} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, previewPane: event.target.checked }))} />
                    <span>Show preview pane</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.showUnreadCounts} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, showUnreadCounts: event.target.checked }))} />
                    <span>Show unread counts in folders</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.checkAllFolders} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, checkAllFolders: event.target.checked }))} />
                    <span>Check all folders for new messages</span>
                  </label>
                  <label>
                    <span>Mark previewed messages read</span>
                    <select value={preferences.markPreviewRead} onChange={(event) => setPreferences((current) => ({ ...current, markPreviewRead: event.target.value }))}>
                      <option>Immediately</option>
                      <option>After 5 seconds</option>
                      <option>After 30 seconds</option>
                      <option>Never</option>
                    </select>
                  </label>
                  <label>
                    <span>Rows per page</span>
                    <input value={preferences.rowsPerPage} inputMode="numeric" onChange={(event) => setPreferences((current) => ({ ...current, rowsPerPage: Number(event.target.value) || current.rowsPerPage }))} />
                  </label>
                  <label>
                    <span>Default sort column</span>
                    <select value={preferences.defaultSort} onChange={(event) => setPreferences((current) => ({ ...current, defaultSort: event.target.value }))}>
                      <option>Date</option>
                      <option>From</option>
                      <option>Subject</option>
                      <option>Size</option>
                    </select>
                  </label>
                  <label>
                    <span>Message order</span>
                    <select value={preferences.messageOrder} onChange={(event) => setPreferences((current) => ({ ...current, messageOrder: event.target.value }))}>
                      <option>Descending</option>
                      <option>Ascending</option>
                    </select>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.showDeletedMessages} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, showDeletedMessages: event.target.checked }))} />
                    <span>Show deleted messages</span>
                  </label>
                </>
              ) : null}

              {activePreference === "Displaying Messages" ? (
                <>
                  <label className="checkbox-row">
                    <input checked={preferences.displayHtml} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, displayHtml: event.target.checked }))} />
                    <span>Display HTML messages</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.remoteImages} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, remoteImages: event.target.checked }))} />
                    <span>Display remote inline images</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.preferPlainText} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, preferPlainText: event.target.checked }))} />
                    <span>Prefer plain text messages</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.openLinksNewWindow} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, openLinksNewWindow: event.target.checked }))} />
                    <span>Open message links in a new window</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.showAttachments} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, showAttachments: event.target.checked }))} />
                    <span>Show attachment previews</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.requestReceipts} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, requestReceipts: event.target.checked }))} />
                    <span>Ask before sending read receipts</span>
                  </label>
                </>
              ) : null}

              {activePreference === "Composing Messages" ? (
                <>
                  <label>
                    <span>Compose HTML messages</span>
                    <select value={preferences.composeHtml} onChange={(event) => setPreferences((current) => ({ ...current, composeHtml: event.target.value }))}>
                      <option>Always</option>
                      <option>Never</option>
                      <option>On reply to HTML message only</option>
                    </select>
                  </label>
                  <label>
                    <span>Reply mode</span>
                    <select value={preferences.replyMode} onChange={(event) => setPreferences((current) => ({ ...current, replyMode: event.target.value }))}>
                      <option>Start new message above original</option>
                      <option>Start new message below original</option>
                      <option>Do not quote original message</option>
                    </select>
                  </label>
                  <label>
                    <span>Default font</span>
                    <select value={preferences.composeFont} onChange={(event) => setPreferences((current) => ({ ...current, composeFont: event.target.value }))}>
                      {COMPOSE_FONTS.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Automatically save draft</span>
                    <select value={preferences.autoSaveDraft} onChange={(event) => setPreferences((current) => ({ ...current, autoSaveDraft: event.target.value }))}>
                      <option>Every minute</option>
                      <option>Every 5 minutes</option>
                      <option>Every 10 minutes</option>
                      <option>Never</option>
                    </select>
                  </label>
                  <label>
                    <span>Add signature</span>
                    <select value={preferences.composeSignature} onChange={(event) => setPreferences((current) => ({ ...current, composeSignature: event.target.value }))}>
                      <option>Automatically</option>
                      <option>Only for new messages</option>
                      <option>Only for replies and forwards</option>
                      <option>Never</option>
                    </select>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.spellcheck} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, spellcheck: event.target.checked }))} />
                    <span>Check spelling before sending</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.saveSentMail} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, saveSentMail: event.target.checked }))} />
                    <span>Save sent messages</span>
                  </label>
                </>
              ) : null}

              {activePreference === "Address Book" ? (
                <>
                  <label>
                    <span>Default address book</span>
                    <select value={preferences.addressBookMode} onChange={(event) => setPreferences((current) => ({ ...current, addressBookMode: event.target.value }))}>
                      <option>List</option>
                      <option>Business cards</option>
                      <option>Grouped</option>
                    </select>
                  </label>
                  <label>
                    <span>Contact name display</span>
                    <select value={preferences.contactDisplay} onChange={(event) => setPreferences((current) => ({ ...current, contactDisplay: event.target.value }))}>
                      <option>Display name</option>
                      <option>First Last</option>
                      <option>Last, First</option>
                      <option>Email address</option>
                    </select>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.autocomplete} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, autocomplete: event.target.checked }))} />
                    <span>Use contacts for autocompletion</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.skipDeletedContacts} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, skipDeletedContacts: event.target.checked }))} />
                    <span>Skip deleted contacts in search</span>
                  </label>
                </>
              ) : null}

              {activePreference === "Special Folders" ? (
                <>
                  <label>
                    <span>Drafts</span>
                    <select value={preferences.draftsFolder} onChange={(event) => setPreferences((current) => ({ ...current, draftsFolder: event.target.value }))}>
                      {[...folderSettings, ...customFolders].map((folder) => <option key={folder}>{folder}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Sent</span>
                    <select value={preferences.sentFolder} onChange={(event) => setPreferences((current) => ({ ...current, sentFolder: event.target.value }))}>
                      {[...folderSettings, ...customFolders].map((folder) => <option key={folder}>{folder}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Junk</span>
                    <select value={preferences.junkFolder} onChange={(event) => setPreferences((current) => ({ ...current, junkFolder: event.target.value }))}>
                      {[...folderSettings, ...customFolders].map((folder) => <option key={folder}>{folder}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Trash</span>
                    <select value={preferences.trashFolder} onChange={(event) => setPreferences((current) => ({ ...current, trashFolder: event.target.value }))}>
                      {[...folderSettings, ...customFolders].map((folder) => <option key={folder}>{folder}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Archive</span>
                    <select value={preferences.archiveFolder} onChange={(event) => setPreferences((current) => ({ ...current, archiveFolder: event.target.value }))}>
                      {[...folderSettings, ...customFolders].map((folder) => <option key={folder}>{folder}</option>)}
                    </select>
                  </label>
                </>
              ) : null}

              {activePreference === "Server Settings" ? (
                <>
                  <label>
                    <span>Keep-alive</span>
                    <select value={preferences.keepAlive} onChange={(event) => setPreferences((current) => ({ ...current, keepAlive: event.target.value }))}>
                      <option>Every minute</option>
                      <option>Every 5 minutes</option>
                      <option>Every 15 minutes</option>
                      <option>Disabled</option>
                    </select>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.compactOnLogout} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, compactOnLogout: event.target.checked }))} />
                    <span>Compact Inbox on logout</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.emptyTrashOnLogout} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, emptyTrashOnLogout: event.target.checked }))} />
                    <span>Empty Trash on logout</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={preferences.requestReceipts} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, requestReceipts: event.target.checked }))} />
                    <span>Handle delivery status notifications</span>
                  </label>
                </>
              ) : null}
            </form>
          ) : null}

          {activeSettingsGroup === "Folders" ? (
            <div className="folders-settings">
              {[...folderSettings, ...customFolders].map((folder) => (
                <article key={folder}>
                  <div>
                    <strong>{folder}</strong>
                    <span>{folder === "Inbox" ? "Subscribed, default folder" : customFolders.includes(folder) ? "Custom folder" : "Subscribed folder"}</span>
                  </div>
                  <label>
                    <input defaultChecked type="checkbox" />
                    Visible
                  </label>
                </article>
              ))}
              <div className="inline-editor">
                <input
                  aria-label="New folder name"
                  placeholder="New folder name"
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                />
                <button className="secondary-action" onClick={createFolder}>
                  <Edit3 size={17} />
                  Create folder
                </button>
              </div>
            </div>
          ) : null}

          {activeSettingsGroup === "Identities" ? (
            <form className="roundcube-form identity-form">
              <label>
                <span>Display name</span>
                <input value={preferences.displayName} onChange={(event) => setPreferences((current) => ({ ...current, displayName: event.target.value }))} />
              </label>
              <label>
                <span>Email</span>
                <input defaultValue={mailboxAddress} />
              </label>
              <label>
                <span>Organization</span>
                <input defaultValue="Priscilla Webmail" />
              </label>
              <label>
                <span>Reply-To</span>
                <input placeholder="optional" value={preferences.replyTo} onChange={(event) => setPreferences((current) => ({ ...current, replyTo: event.target.value }))} />
              </label>
              <label className="signature-field">
                <span>Signature</span>
                <textarea value={preferences.signature} onChange={(event) => setPreferences((current) => ({ ...current, signature: event.target.value }))} />
              </label>
            </form>
          ) : null}

          {activeSettingsGroup === "Responses" ? (
            <div className="responses-settings">
              {responseTemplates.map((template) => (
                <article key={template.title}>
                  <strong>{template.title}</strong>
                  <p>{template.body}</p>
                  <button onClick={() => showNotice("Response editor opened")}>Edit</button>
                </article>
              ))}
              <button className="secondary-action" onClick={() => showNotice("New response opened")}>
                <Edit3 size={17} />
                Create response
              </button>
            </div>
          ) : null}

          {activeSettingsGroup === "Domain" ? (
            <div className="domain-settings">
              <section className="domain-summary">
                <div>
                  <span>Mail domain</span>
                  <strong>{mailSetup.mailDomain || mailDomain}</strong>
                </div>
                <div>
                  <span>Mailbox</span>
                  <strong>{mailSetup.mailboxAddress || mailboxAddress}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{setupConfigured ? "Mail ready" : sendingConfigured ? "Sending ready" : "Setup required"}</strong>
                </div>
              </section>

              <section className="setup-status-panel" aria-label="Mail setup status">
                {statusItems.map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong className={`status-pill ${item.tone}`}>{item.value}</strong>
                  </article>
                ))}
              </section>

              <section className="roundcube-form provider-setup" aria-label="Provider setup">
                <label>
                  <span>Mailbox address</span>
                  <input
                    type="email"
                    value={mailSetup.mailboxAddress}
                    onChange={(event) => updateMailSetup("mailboxAddress", event.target.value)}
                  />
                </label>
                <label>
                  <span>Mail domain</span>
                  <input
                    value={mailSetup.mailDomain}
                    onChange={(event) => updateMailSetup("mailDomain", event.target.value)}
                  />
                </label>
                <label>
                  <span>IMAP host</span>
                  <input
                    placeholder="imap.example.com"
                    value={mailSetup.imapHost}
                    onChange={(event) => updateMailSetup("imapHost", event.target.value)}
                  />
                </label>
                <label>
                  <span>IMAP port</span>
                  <input
                    min={1}
                    max={65535}
                    type="number"
                    value={mailSetup.imapPort}
                    onChange={(event) => updateMailSetup("imapPort", Number(event.target.value))}
                  />
                </label>
                <label className="checkbox-row">
                  <span>IMAP encryption</span>
                  <input
                    checked={mailSetup.imapSecure}
                    type="checkbox"
                    onChange={(event) => updateMailSetup("imapSecure", event.target.checked)}
                  />
                </label>
                <label>
                  <span>IMAP username</span>
                  <input
                    value={mailSetup.imapUser}
                    onChange={(event) => updateMailSetup("imapUser", event.target.value)}
                  />
                </label>
                <label>
                  <span>IMAP password</span>
                  <input
                    placeholder={mailSetup.imapPassConfigured ? "Saved password unchanged" : "App password"}
                    type="password"
                    value={mailSetup.imapPass}
                    onChange={(event) => updateMailSetup("imapPass", event.target.value)}
                  />
                </label>
                <label>
                  <span>SMTP host</span>
                  <input
                    placeholder="smtp.example.com"
                    value={mailSetup.smtpHost}
                    onChange={(event) => updateMailSetup("smtpHost", event.target.value)}
                  />
                </label>
                <label>
                  <span>SMTP port</span>
                  <input
                    min={1}
                    max={65535}
                    type="number"
                    value={mailSetup.smtpPort}
                    onChange={(event) => updateMailSetup("smtpPort", Number(event.target.value))}
                  />
                </label>
                <label className="checkbox-row">
                  <span>SMTP SSL</span>
                  <input
                    checked={mailSetup.smtpSecure}
                    type="checkbox"
                    onChange={(event) => updateMailSetup("smtpSecure", event.target.checked)}
                  />
                </label>
                <label>
                  <span>SMTP username</span>
                  <input
                    value={mailSetup.smtpUser}
                    onChange={(event) => updateMailSetup("smtpUser", event.target.value)}
                  />
                </label>
                <label>
                  <span>SMTP password</span>
                  <input
                    placeholder={mailSetup.smtpPassConfigured ? "Saved password unchanged" : "App password"}
                    type="password"
                    value={mailSetup.smtpPass}
                    onChange={(event) => updateMailSetup("smtpPass", event.target.value)}
                  />
                </label>
                <label>
                  <span>From address</span>
                  <input
                    type="email"
                    value={mailSetup.mailFrom}
                    onChange={(event) => updateMailSetup("mailFrom", event.target.value)}
                  />
                </label>
                <div className="provider-actions">
                  <span>{setupStatus}</span>
                  <button className="secondary-action" disabled={setupSaving} type="button" onClick={() => saveMailSetup(false)}>
                    <Check size={17} />
                    Save setup
                  </button>
                  <button className="save-settings" disabled={setupSaving} type="button" onClick={() => saveMailSetup(true)}>
                    <ShieldCheck size={17} />
                    Test & save
                  </button>
                </div>
              </section>

              <section className="setup-checklist" aria-label="Launch checklist">
                <article>
                  <Check size={17} />
                  <div>
                    <strong>{sendingProvider === "resend" ? "Resend sending" : "SMTP sending"}</strong>
                    <span>{sendingConfigured ? "Compose sends live mail through your configured sending provider." : "Add Resend or SMTP credentials in .env.local for live delivery."}</span>
                  </div>
                </article>
                <article>
                  <RefreshCw size={17} />
                  <div>
                    <strong>Inbox auto sync</strong>
                    <span>Runs every {autoSyncMinutes > 0 ? `${autoSyncMinutes} minute${autoSyncMinutes === 1 ? "" : "s"}` : "0 minutes"} when enabled.</span>
                  </div>
                </article>
                <article>
                  <Archive size={17} />
                  <div>
                    <strong>Server message actions</strong>
                    <span>Delete, Archive, Mark, Star, and Move sync to IMAP for real IMAP messages.</span>
                  </div>
                </article>
                <article>
                  <Lock size={17} />
                  <div>
                    <strong>Workspace lock</strong>
                    <span>
                      {passwordConfigured
                        ? "Enabled. Visitors must log in with email and password."
                        : "Email/password login is active for this webmail."}
                    </span>
                  </div>
                </article>
              </section>

              <div className="dns-records">
                {domainRecords.map((record) => (
                  <article key={`${record.type}-${record.host}`}>
                    <div className="dns-record-type">{record.type}</div>
                    <div>
                      <span>Host</span>
                      <code>{record.host}</code>
                    </div>
                    <div>
                      <span>Value</span>
                      <code>{record.value}</code>
                    </div>
                    <p>{record.purpose}</p>
                  </article>
                ))}
              </div>

              <section className="security-box roundcube-note">
                <ShieldCheck size={22} />
                <div>
                  <strong>Publish these at your DNS provider</strong>
                  <p>Replace the placeholder mail server and DKIM public key with the exact records from your email host before going live.</p>
                </div>
              </section>
            </div>
          ) : null}

          {activeSettingsGroup === "Health" ? (
            <div className="health-settings">
              <section className="domain-summary">
                <div>
                  <span>Readiness</span>
                  <strong>
                    {healthReport ? `${healthReport.summary.ready}/${healthReport.summary.total} ready` : "Not checked"}
                  </strong>
                </div>
                <div>
                  <span>Domain</span>
                  <strong>{healthReport?.summary.domain ?? mailSetup.mailDomain ?? "not set"}</strong>
                </div>
                <div>
                  <span>Mode</span>
                  <strong>{healthReport?.summary.mode ?? "Waiting"}</strong>
                </div>
              </section>

              <section className="health-grid" aria-label="System checks">
                {(healthReport?.checks ?? []).map((check) => (
                  <article key={check.label}>
                    <div>
                      <span>{check.label}</span>
                      <strong>{check.status}</strong>
                    </div>
                    <strong className={`status-pill ${check.tone}`}>{check.tone}</strong>
                    <p>{check.detail}</p>
                  </article>
                ))}
              </section>

              <section className="dns-records health-dns" aria-label="DNS verification">
                {(healthReport?.dnsChecks ?? []).map((check) => (
                  <article key={check.label}>
                    <div className="dns-record-type">{check.label}</div>
                    <div>
                      <span>Status</span>
                      <strong className={`status-pill ${check.tone}`}>{check.status}</strong>
                    </div>
                    <div>
                      <span>Result</span>
                      <code>{check.detail}</code>
                    </div>
                  </article>
                ))}
              </section>

              <section className="storage-list" aria-label="Local storage status">
                {(healthReport?.storage ?? []).map((record) => (
                  <article key={record.file}>
                    <FileText size={18} />
                    <div>
                      <strong>{record.file}</strong>
                      <span>
                        {record.exists
                          ? `${record.bytes} bytes${record.updatedAt ? `, updated ${new Date(record.updatedAt).toLocaleString()}` : ""}`
                          : "Not created yet"}
                      </span>
                    </div>
                    <strong className={`status-pill ${record.exists ? "good" : "warn"}`}>
                      {record.exists ? "Found" : "Missing"}
                    </strong>
                  </article>
                ))}
              </section>

              {!healthReport ? (
                <section className="security-box roundcube-note">
                  <HeartPulse size={22} />
                  <div>
                    <strong>Run a health check</strong>
                    <p>Use Refresh to check login, provider setup, DNS records, and local app storage.</p>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          <section className="security-box roundcube-note">
            <Lock size={22} />
            <div>
              <strong>Server settings note</strong>
              <p>{sendingConfigured ? "Live sending is active. Add IMAP credentials to receive client messages in this webmail." : "Demo sending is active until Resend or SMTP credentials are added. Use DKIM/SPF/DMARC for live mail."}</p>
            </div>
          </section>
        </section>
      </section>
    );
  }

  if (sessionChecking) {
    return (
      <main className="mail-lock-screen">
        <section className="mail-lock-card" aria-live="polite">
          <div className="webmail-logo">Webmail</div>
          <div>
            <h1>Checking session</h1>
            <p>Verifying whether this browser already has a valid mailbox session.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="mail-lock-screen">
        <form
          autoComplete="off"
          className="mail-lock-card"
          onKeyDown={markLoginSubmitIntent}
          onSubmit={resetMode ? handleResetPassword : handleLogin}
        >
          <div className="webmail-logo">Webmail</div>
          <label>
            <span>Email Address</span>
            <input
              autoFocus
              autoComplete="username"
              type="email"
              disabled={loginLoading}
              suppressHydrationWarning
              value={loginEmail}
              onChange={(event) => {
                setLoginEmail(event.target.value);
                setLoginError("");
              }}
            />
          </label>
          {!resetMode ? (
            <label>
              <span>Password</span>
              <input
                type="password"
                autoComplete="off"
                disabled={loginLoading}
                suppressHydrationWarning
                value={loginPassword}
                onChange={(event) => {
                  setLoginPassword(event.target.value);
                  setLoginError("");
                }}
              />
            </label>
          ) : (
            <>
              <label>
                <span>Reset Code</span>
                <input
                  autoComplete="one-time-code"
                  type="password"
                  suppressHydrationWarning
                  value={resetCode}
                  onChange={(event) => {
                    setResetCode(event.target.value);
                    setLoginError("");
                  }}
                />
              </label>
              <label>
                <span>New Password</span>
                <input
                  autoComplete="new-password"
                  minLength={12}
                  pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
                  title="Use at least 12 characters with uppercase, lowercase, number, and symbol."
                  type="password"
                  suppressHydrationWarning
                  value={resetPassword}
                  onChange={(event) => {
                    setResetPassword(event.target.value);
                    setLoginError("");
                  }}
                />
              </label>
              <label>
                <span>Confirm Password</span>
                <input
                  autoComplete="new-password"
                  minLength={12}
                  type="password"
                  suppressHydrationWarning
                  value={resetConfirmPassword}
                  onChange={(event) => {
                    setResetConfirmPassword(event.target.value);
                    setLoginError("");
                  }}
                />
              </label>
            </>
          )}
          {loginError ? <p className="send-error">{loginError}</p> : null}
          <button
            className="send-button webmail-login-button"
            type="submit"
            disabled={loginLoading}
            onKeyDown={markLoginSubmitIntent}
            onPointerDown={() => {
              loginSubmitIntentRef.current = true;
            }}
          >
            {resetMode ? "Reset Password" : loginLoading ? "Logging in..." : "Log in"}
          </button>
          <button
            className="reset-password-link"
            type="button"
            disabled={loginLoading}
            onClick={() => {
              setResetMode((mode) => !mode);
              setLoginError("");
            }}
          >
            {resetMode ? "Back to Log in" : "Reset Password"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="webmail-shell">
      <aside className="app-rail" aria-label="Apps">
        <button className="brand-mark" aria-label="Priscilla Mail" onClick={() => chooseApp("Mail")}>
          <Mail size={21} />
        </button>
        {appRail.map((item) => {
          const Icon = item.icon;
          return (
            <button
              aria-label={item.label}
              className={item.label === activeApp ? "rail-button active" : "rail-button"}
              key={item.label}
              onClick={() => chooseApp(item.label)}
              title={item.label}
            >
              <Icon size={21} />
            </button>
          );
        })}
      </aside>

      <aside className={mobileFoldersOpen ? "folder-pane open" : "folder-pane"}>
        <div className="account-card">
          <button
            className="account-identity"
            aria-controls="account-menu"
            aria-expanded={accountMenuOpen}
            aria-haspopup={true}
            aria-label={`Mailbox options for ${loginEmail || mailboxAddress}`}
            onClick={() => setAccountMenuOpen((open) => !open)}
            title="Mailbox options"
          >
            <span>Signed in as</span>
            <strong>{loginEmail || mailboxAddress}</strong>
          </button>
          <button
            aria-controls="account-menu"
            aria-expanded={accountMenuOpen}
            aria-haspopup={true}
            aria-label="Account menu"
            onClick={() => setAccountMenuOpen((open) => !open)}
            title="Account menu"
          >
            <MoreHorizontal size={18} />
          </button>
          {accountMenuOpen ? (
            <div className="floating-menu account-menu" id="account-menu">
              <button onClick={() => runMailboxMenuAction("Compact")}>
                <Minimize2 size={17} />
                Compact
              </button>
              <button onClick={() => runMailboxMenuAction("Empty")}>
                <Eraser size={17} />
                Empty
              </button>
              <button onClick={() => runMailboxMenuAction("Mark all as read")}>
                <MailCheck size={17} />
                Mark all as read
              </button>
              <button onClick={() => runMailboxMenuAction("Manage folders")}>
                <FolderCog size={17} />
                Manage folders
              </button>
              <button onClick={handleLogout}>
                <Lock size={17} />
                Logout
              </button>
            </div>
          ) : null}
        </div>

        <button className="compose-button sidebar-compose-button" onClick={() => openCompose()}>
          <Edit3 size={17} />
          Compose
        </button>

        <nav className="mobile-app-switcher" aria-label="Mobile apps">
          {appRail.map((item) => {
            const Icon = item.icon;

            return (
              <button
                aria-label={item.label}
                className={item.label === activeApp ? "active" : ""}
                key={item.label}
                onClick={() => chooseApp(item.label)}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <nav className="folders" aria-label="Mailbox folders">
          {folders.map((folder) => {
            const Icon = folder.icon;

            return (
              <button
                className={folder.name === activeFolder && activeApp === "Mail" ? "folder-row active" : "folder-row"}
                key={folder.name}
                onClick={() => chooseFolder(folder.name)}
              >
                <Icon size={18} />
                <span>{folder.name}</span>
                <small>{folderCounts[folder.name] ?? 0}</small>
              </button>
            );
          })}
        </nav>

        <section className="mail-health" aria-label="Mailbox health">
          <div>
            <ShieldCheck size={18} />
            <strong>{mailboxMode === "imap" || mailboxMode === "resend" ? "Live mail" : sendingConfigured ? "Sending live" : "Demo mode"}</strong>
          </div>
          <p>{mailboxMode === "imap" ? "Inbox sync and server actions are connected to IMAP." : mailboxMode === "resend" ? "Inbox sync is connected to Resend receiving." : sendingConfigured ? "Outgoing mail uses Resend. Add receiving or IMAP to show client messages here." : "Add Resend or SMTP plus receiving credentials to switch from demo mode to live mail."}</p>
          <div className="status-list">
            {statusItems.slice(0, 4).map((item) => (
              <div className="status-row" key={item.label}>
                <span>{item.label}</span>
                <strong className={`status-pill ${item.tone}`}>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="storage-bar">
            <span />
          </div>
          <small>42 MB of 10 GB used</small>
        </section>
      </aside>

      {mobileFoldersOpen ? (
        <button
          className="mobile-scrim"
          aria-label="Close mailbox folders"
          onClick={() => setMobileFoldersOpen(false)}
        />
      ) : null}

      <section className="mail-workspace">
        <header className="top-bar">
          <button className="icon-button mobile-only" onClick={() => setMobileFoldersOpen(true)} title="Menu" aria-label="Open mailbox folders">
            <Menu size={20} />
          </button>
          <label className="search-box">
            <Search size={19} />
            <input
              aria-label={activeApp === "Mail" ? "Search mail" : `Search ${activeApp.toLowerCase()}`}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                showNotice("Search updated");
              }}
              placeholder={activeApp === "Mail" ? "Search mail" : `Search ${activeApp.toLowerCase()}`}
            />
          </label>
          {query ? (
            <button className="clear-search" onClick={() => setQuery("")}>
              Clear
            </button>
          ) : null}
          <button
            className="icon-button"
            onClick={() => setAdvancedSearchOpen((open) => !open)}
            title="Advanced search"
            aria-label="Advanced search"
          >
            <SlidersHorizontal size={19} />
          </button>
          <div className="top-actions">
            <button className="icon-button" onClick={() => refreshMailbox()} disabled={refreshing} title="Refresh" aria-label="Refresh mailbox">
              <RefreshCw size={19} />
            </button>
            <button className="icon-button" onClick={enableNotifications} title="Notifications" aria-label="Notifications">
              <Bell size={19} />
            </button>
            <button className="icon-button" onClick={handleLogout} title="Logout" aria-label="Logout">
              <Lock size={19} />
            </button>
            <button className="profile-chip" onClick={() => setAccountPanelOpen(true)} title="Mailbox profile" aria-label="Mailbox profile">
              PM
            </button>
          </div>
        </header>

        {advancedSearchOpen && activeApp === "Mail" ? (
          <section className="advanced-search" aria-label="Advanced mail search">
            <input
              aria-label="Search sender"
              placeholder="From"
              value={searchFilters.from}
              onChange={(event) => setSearchFilters((filters) => ({ ...filters, from: event.target.value }))}
            />
            <input
              aria-label="Search recipient"
              placeholder="To"
              value={searchFilters.to}
              onChange={(event) => setSearchFilters((filters) => ({ ...filters, to: event.target.value }))}
            />
            <input
              aria-label="Search subject"
              placeholder="Subject"
              value={searchFilters.subject}
              onChange={(event) => setSearchFilters((filters) => ({ ...filters, subject: event.target.value }))}
            />
            <input
              aria-label="Search label"
              placeholder="Label"
              value={searchFilters.label}
              onChange={(event) => setSearchFilters((filters) => ({ ...filters, label: event.target.value }))}
            />
            <label>
              <input
                checked={searchFilters.unreadOnly}
                type="checkbox"
                onChange={(event) => setSearchFilters((filters) => ({ ...filters, unreadOnly: event.target.checked }))}
              />
              Unread
            </label>
            <label>
              <input
                checked={searchFilters.starredOnly}
                type="checkbox"
                onChange={(event) => setSearchFilters((filters) => ({ ...filters, starredOnly: event.target.checked }))}
              />
              Starred
            </label>
            <label>
              <input
                checked={searchFilters.attachmentsOnly}
                type="checkbox"
                onChange={(event) => setSearchFilters((filters) => ({ ...filters, attachmentsOnly: event.target.checked }))}
              />
              Attachments
            </label>
            <button
              onClick={() =>
                setSearchFilters({
                  from: "",
                  to: "",
                  subject: "",
                  label: "",
                  unreadOnly: false,
                  starredOnly: false,
                  attachmentsOnly: false
                })
              }
            >
              Clear filters
            </button>
          </section>
        ) : null}

        <div className="toolbar command-strip" aria-label="Mailbox actions">
          <div className="command-side left-commands folder-command-heading">
            <strong>{activeApp === "Mail" ? activeFolder : activeApp}</strong>
            {activeApp === "Mail" ? (
              <div className="toolbar-selection-actions">
                <label className="toolbar-select" title="Select visible messages">
                  <input
                    checked={displayedMessages.length > 0 && selectedDisplayedCount === displayedMessages.length}
                    disabled={displayedMessages.length === 0}
                    type="checkbox"
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedMessageIds(displayedMessageIds);
                        setSelectMode(true);
                        showNotice(`${messageCountLabel(displayedMessageIds.length)} selected`);
                        return;
                      }

                      setSelectedMessageIds([]);
                      setSelectMode(false);
                      showNotice("Selection cleared");
                    }}
                  />
                  <span>{selectedMessageIds.length ? `${selectedMessageIds.length} selected` : "Select"}</span>
                </label>
                <button
                  className="toolbar-delete-selected"
                  disabled={selectedMessageIds.length === 0}
                  onClick={deleteSelectedMessages}
                  title="Delete selected messages"
                  aria-label="Delete selected messages"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </div>
            ) : null}
            <button
              className={refreshing ? "folder-command-icon refreshing" : "folder-command-icon"}
              disabled={refreshing}
              onClick={() => refreshMailbox()}
              title="Refresh mailbox"
              aria-label="Refresh mailbox"
            >
              <RefreshCw size={22} />
            </button>
            <div className="menu-wrap">
              <button
                className={selectMenuOpen ? "folder-command-icon active" : "folder-command-icon"}
                onClick={() => {
                  setSelectMenuOpen((open) => !open);
                  setForwardMenuOpen(false);
                  setMarkMenuOpen(false);
                  setMoreMenuOpen(false);
                }}
                title="Folder options"
                aria-label="Folder options"
              >
                <MoreVertical size={22} />
              </button>
              {selectMenuOpen ? (
                <div className="floating-menu command-menu selection-menu">
                  <div className="selection-menu-title">
                    <span className="selection-title-icon">
                      <Check size={13} />
                    </span>
                    Selection
                  </div>
                  <button onClick={() => applySelection("All")}>
                    <Asterisk size={17} />
                    All
                  </button>
                  <button onClick={() => applySelection("Current page")}>
                    <List size={17} />
                    Current page
                  </button>
                  <button onClick={() => applySelection("Unread")}>
                    <Mail size={17} />
                    Unread
                  </button>
                  <button onClick={() => applySelection("Flagged")}>
                    <Flag size={17} />
                    Flagged
                  </button>
                  <button onClick={() => applySelection("Invert")}>
                    <Check size={17} />
                    Invert
                  </button>
                  <button onClick={() => applySelection("None")}>
                    <X size={17} />
                    None
                  </button>
                  <button
                    onClick={() => {
                      setThreadsOn((enabled) => !enabled);
                      setSelectMenuOpen(false);
                      showNotice(threadsOn ? "Threads off" : "Threads on");
                    }}
                  >
                    <UsersRound size={17} />
                    {threadsOn ? "Turn threads off" : "Turn threads on"}
                  </button>
                  <button onClick={openListOptions}>
                    <SlidersHorizontal size={17} />
                    List options
                  </button>
                  <button onClick={() => runMailboxMenuAction("Mark all as read")}>
                    <MailCheck size={17} />
                    Mark all as read
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="command-side right-commands message-command-actions">
            <button aria-label="Reply" className="command-button muted" disabled={!hasSelectedMessage} onClick={() => composeReply(false)} title="Reply">
              <Reply size={21} />
              <span>Reply</span>
            </button>
            <button aria-label="Reply all" className="command-button muted" disabled={!hasSelectedMessage} onClick={() => composeReply(true)} title="Reply all">
              <ReplyAll size={21} />
              <span>Reply all</span>
            </button>
            <div className="menu-wrap">
              <button
                className="command-button muted"
                disabled={!hasSelectedMessage}
                aria-label="Forward"
                onClick={composeForward}
                title="Forward"
              >
                <Forward size={21} />
                <span>Forward</span>
              </button>
              <button
                className={forwardMenuOpen ? "command-button forward-menu-button active" : "command-button forward-menu-button muted"}
                disabled={!hasSelectedMessage}
                aria-label="Forward options"
                onClick={() => {
                  setForwardMenuOpen((open) => !open);
                  setMarkMenuOpen(false);
                  setMoreMenuOpen(false);
                }}
                title="Forward options"
              >
                <ChevronDown size={18} />
                <span>Options</span>
              </button>
              {forwardMenuOpen ? (
                <div className="floating-menu command-menu">
                  <button onClick={composeForward}>
                    <Forward size={17} />
                    Forward inline
                  </button>
                  <button onClick={composeForwardAttachment}>
                    <Paperclip size={17} />
                    Forward as attachment
                  </button>
                </div>
              ) : null}
            </div>
            <button aria-label="Delete" className="command-button muted" disabled={!hasSelectedMessage} onClick={() => runMailboxAction("Delete")} title="Delete">
              <Trash2 size={21} />
              <span>Delete</span>
            </button>
            <button aria-label="Archive" className="command-button muted" disabled={!hasSelectedMessage} onClick={() => runMailboxAction("Archive")} title="Archive">
              <Archive size={21} />
              <span>Archive</span>
            </button>
            <button aria-label="Junk" className="command-button muted" disabled={!hasSelectedMessage} onClick={() => runMailboxAction("Junk")} title="Junk">
              <Flame size={21} />
              <span>Junk</span>
            </button>
          </div>
        </div>

        {activeApp === "Mail" ? (
          <div className={mobileMessageOpen ? "mail-grid mobile-message-open" : "mail-grid"}>
            <section className="message-pane" aria-label="Message list">
              <div className="inbox-summary">
                <div>
                  <Sparkles size={17} />
                  <span>{activeFolder === "Inbox" ? "Priority inbox" : activeFolder}</span>
                </div>
                <button
                  onClick={() => {
                    const nextOrder = sortingOrder === "descending" ? "ascending" : "descending";
                    setSortingOrder(nextOrder);
                    setSortNewest(nextOrder === "descending");
                    showNotice(nextOrder === "ascending" ? "Sorted ascending" : "Sorted descending");
                  }}
                >
                  {sortingOrder === "descending" ? "descending" : "ascending"}
                  <ChevronDown size={15} />
                </button>
              </div>

              <div
                className={visibleMessages.length ? `message-list ${listMode.toLowerCase()}-mode` : "message-list empty-list"}
                onScroll={handleMessageListScroll}
              >
                {visibleMessages.length ? (
                  <>
                  {displayedMessages.map((message) => (
                    <article
                      aria-label={`${selectedMessageIds.includes(message.id) ? "Selected" : "Open"} message: ${message.subject}`}
                      className={[
                        "message-card",
                        message.id === selectedMessage?.id ? "active" : "",
                        selectedMessageIds.includes(message.id) ? "selected" : "",
                        selectMode ? "selectable" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={message.id}
                      onClick={() => selectMessage(message)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectMessage(message);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="message-meta">
                        <label className="message-select" onClick={(event) => event.stopPropagation()}>
                          <input
                            aria-label={`Select ${message.subject}`}
                            checked={selectedMessageIds.includes(message.id)}
                            type="checkbox"
                            onChange={() => {
                              setSelectMode(true);
                              toggleMessageSelection(message.id);
                            }}
                          />
                          <span className={selectedMessageIds.includes(message.id) ? "message-check checked" : "message-check"}>
                            {selectedMessageIds.includes(message.id) ? <Check size={13} /> : null}
                          </span>
                        </label>
                        <strong>
                          {messagePerson(message).label}: {messagePerson(message).name}
                        </strong>
                        <time>{message.time}</time>
                      </div>
                      <div className="message-subject">
                        {message.unread ? <span className="unread-dot" /> : null}
                        <span>{message.subject}</span>
                      </div>
                      <p>{htmlToReadableText(message.snippet)}</p>
                      <div className="message-flags">
                        {message.starred ? <Star className="starred" size={16} /> : null}
                        <small>{message.label}</small>
                        {message.hasAttachment ? <Paperclip size={15} /> : null}
                      </div>
                    </article>
                  ))}
                  {visibleMessages.length > displayedMessages.length || folderHasMore[activeFolder] ? (
                    <button className="load-more" disabled={loadingMoreMessages} onClick={() => void loadMoreMessages()}>
                      {loadingMoreMessages ? "Loading more messages..." : "Load more messages"}
                    </button>
                  ) : null}
                  {folderMessageTotals[activeFolder] ? (
                    <p className="message-load-count">
                      Showing {Math.min(displayedMessages.length, folderMessageTotals[activeFolder] ?? displayedMessages.length)} of {folderMessageTotals[activeFolder]} messages
                    </p>
                  ) : null}
                  </>
                ) : (
                  <div className="empty-mailbox">
                    <Inbox size={44} />
                    <strong>{emptyText.title}</strong>
                    <p>{emptyText.body}</p>
                  </div>
                )}
              </div>
            </section>

            <section className="preview-pane" aria-label="Message preview">
              {selectedMessage ? (
                <article className="message-preview">
                  <div className="preview-actions">
                    <button
                      className="mobile-preview-back"
                      onClick={() => setMobileMessageOpen(false)}
                    >
                      <ChevronDown size={17} />
                      Back
                    </button>
                    <button onClick={() => composeReply(false)}>
                      <Undo2 size={17} />
                      Reply
                    </button>
                    <button onClick={() => composeReply(true)}>
                      <ReplyAll size={17} />
                      Reply all
                    </button>
                    <button onClick={composeForward}>
                      <Send size={17} />
                      Forward
                    </button>
                    <button onClick={() => runMailboxAction("Archive")}>
                      <Archive size={17} />
                      Archive
                    </button>
                    <button onClick={() => runMailboxAction("Delete")}>
                      <Trash2 size={17} />
                      Delete
                    </button>
                  </div>
                  <div className="preview-heading">
                    <div>
                      <span className="tag-pill">{selectedMessage.label}</span>
                      <h2>{selectedMessage.subject}</h2>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={selectedMessage.starred ? "Unstar message" : "Star message"}
                      onClick={() => runMailboxAction("Starred")}
                      title={selectedMessage.starred ? "Unstar" : "Star"}
                    >
                      <Star className={selectedMessage.starred ? "starred" : ""} size={18} />
                    </button>
                  </div>
                  <div className="sender-card">
                    <div className="avatar">{personInitials(messagePerson(selectedMessage).name)}</div>
                    <div>
                      <strong>
                        {messagePerson(selectedMessage).label}: {messagePerson(selectedMessage).name}
                      </strong>
                      <span>{messagePerson(selectedMessage).detail}</span>
                    </div>
                    <time>{selectedMessage.date}</time>
                  </div>
                  <div className="preview-body">
                    {renderMessageBody(selectedMessage)}
                  </div>
                  {selectedMessage.hasAttachment ? (
                    <div className="attachment-row">
                      <Paperclip size={18} />
                      <span>{selectedMessage.attachmentName}</span>
                      <button onClick={() => downloadAttachment(selectedMessage)}>
                        <Download size={16} />
                        Download
                      </button>
                    </div>
                  ) : null}
                  <button className="inline-reply" onClick={() => composeReply(false)}>
                    <Edit3 size={17} />
                    Write a reply
                  </button>
                </article>
              ) : (
                <div className="empty-preview">
                  <Mail size={44} />
                  <strong>{emptyText.title}</strong>
                  <p>{emptyText.body}</p>
                  <div className="empty-actions">
                    <button onClick={() => refreshMailbox()}>
                      <RefreshCw size={17} />
                      Refresh
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          renderAppPanel()
        )}
      </section>

      <div className="notice-pill" role="status">
        {notice}
      </div>

      {optionsMenuOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="List options">
          <section className="list-options-modal">
            <header>
              <h2>List options</h2>
                    <button type="button" onClick={() => setOptionsMenuOpen(false)} title="Close list options" aria-label="Close list options">
                <X size={22} />
              </button>
            </header>
            <div className="list-options-form">
              <label>
                <span>Sorting column</span>
                <select
                  value={draftSortingColumn}
                  onChange={(event) => setDraftSortingColumn(event.target.value as SortingColumn)}
                >
                  <option>None</option>
                  <option>Date</option>
                  <option>From</option>
                  <option>Subject</option>
                </select>
              </label>
              <label>
                <span>Sorting order</span>
                <select
                  value={draftSortingOrder}
                  onChange={(event) => setDraftSortingOrder(event.target.value as SortingOrder)}
                >
                  <option>descending</option>
                  <option>ascending</option>
                </select>
              </label>
              <label>
                <span>List mode</span>
                <select value={draftListMode} onChange={(event) => setDraftListMode(event.target.value as ListMode)}>
                  <option>List</option>
                  <option>Compact</option>
                  <option>Comfortable</option>
                </select>
              </label>
            </div>
            <footer>
              <button className="save-button" type="button" onClick={saveListOptions}>
                <Check size={20} />
                Save
              </button>
              <button className="cancel-button" type="button" onClick={() => setOptionsMenuOpen(false)}>
                <X size={18} />
                Cancel
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {accountPanelOpen ? (
        <div className="compose-backdrop" role="dialog" aria-modal="true" aria-label="Account profile">
          <section className="profile-panel">
            <div className="compose-header">
              <strong>Account profile</strong>
              <button type="button" onClick={() => setAccountPanelOpen(false)} title="Close profile" aria-label="Close profile">
                <X size={18} />
              </button>
            </div>
            <div className="profile-body">
              <div className="profile-avatar">PM</div>
              <h2>Priscilla Mail</h2>
              <p>{mailboxAddress}</p>
              <div className="settings-grid compact">
                <article className="setting-row">
                  <span>Role</span>
                  <strong>Mailbox owner</strong>
                </article>
                <article className="setting-row">
                  <span>Session</span>
                  <strong>Demo signed in</strong>
                </article>
              </div>
              <button className="compose-button" onClick={() => chooseApp("Settings")}>
                <Settings size={17} />
                Open settings
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {composeOpen ? (
        <div className="compose-backdrop" role="dialog" aria-modal="true" aria-label="Compose email">
          <form className="compose-window roundcube-compose" onSubmit={handleSend}>
            <div className="compose-header">
              <strong>New message</strong>
              <button type="button" onClick={() => setComposeOpen(false)} title="Close compose" aria-label="Close compose">
                <X size={18} />
              </button>
            </div>
            <div className="compose-fields">
              <label className="compose-row">
                <span>From</span>
                <input
                  name="from"
                  type="text"
                  inputMode="email"
                  value={composeDraft.from}
                  onChange={(event) => updateDraft("from", event.target.value)}
                />
                <button type="button" onClick={() => showNotice("Sender identity editable")} title="Edit sender" aria-label="Edit sender">
                  <Edit3 size={17} />
                </button>
              </label>
              <label className="compose-row">
                <span>To</span>
                <input
                  name="to"
                  type="text"
                  inputMode="email"
                  placeholder={recipientPickerOpen ? "Type a Gmail address, e.g. client@gmail.com" : ""}
                  required
                  value={composeDraft.to}
                  onChange={(event) => updateDraft("to", event.target.value)}
                />
                <button type="button" onClick={addContactRecipient} title="Add contact" aria-label="Add contact">
                  <UsersRound size={18} />
                </button>
                <button type="button" onClick={addRecipientField} title="Add recipient field" aria-label="Add recipient field">
                  <Plus size={20} />
                </button>
              </label>
              {recipientPickerOpen ? (
                <section className="recipient-picker" aria-label="Forward recipient picker">
                  <div className="recipient-picker-heading">
                    <strong>Select who to forward to</strong>
                    <span>You can also type any Gmail address in the To field.</span>
                  </div>
                  {splitRecipients(composeDraft.to).length ? (
                    <div className="selected-recipients" aria-label="Selected recipients">
                      {splitRecipients(composeDraft.to).map((recipient) => (
                        <button type="button" key={recipient} onClick={() => removeRecipient(recipient)}>
                          {recipient}
                          <X size={13} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="recipient-options">
                    {contacts.map((contact) => {
                      const selected = splitRecipients(composeDraft.to)
                        .map((recipient) => emailOnly(recipient).toLowerCase())
                        .includes(contact.email.toLowerCase());

                      return (
                        <button
                          className={selected ? "selected" : ""}
                          type="button"
                          key={contact.email}
                          onClick={() => (selected ? removeRecipient(contact.email) : addRecipient(contact.email))}
                        >
                          <span>{contact.name}</span>
                          <small>{contact.email}</small>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
              {showCcBcc ? (
                <>
                  <label className="compose-row">
                    <span>Cc</span>
                    <input
                      name="cc"
                      type="text"
                      inputMode="email"
                      placeholder="optional"
                      value={composeDraft.cc}
                      onChange={(event) => updateDraft("cc", event.target.value)}
                    />
                  </label>
                  <label className="compose-row">
                    <span>Bcc</span>
                    <input
                      name="bcc"
                      type="text"
                      inputMode="email"
                      placeholder="optional"
                      value={composeDraft.bcc}
                      onChange={(event) => updateDraft("bcc", event.target.value)}
                    />
                  </label>
                </>
              ) : null}
              <label className="compose-row">
                <span>Subject</span>
                <input
                  name="subject"
                  placeholder=""
                  required
                  value={composeDraft.subject}
                  onChange={(event) => updateDraft("subject", event.target.value)}
                />
              </label>
              <div className="editor-toolbar">
                <input
                  ref={imageInputRef}
                  accept="image/*"
                  aria-label="Insert image"
                  hidden
                  type="file"
                  onChange={handleEditorImageChange}
                />
                <button
                  type="button"
                  onPointerDown={keepEditorFocus}
                  onClick={handleToolbarImageClick}
                  title={editorToolbarOpen ? "Insert image" : "Show formatting toolbar"}
                  aria-label={editorToolbarOpen ? "Insert image" : "Show formatting toolbar"}
                >
                  <Image size={18} />
                </button>
                {editorToolbarOpen ? (
                  <div className="format-toolbar" aria-label="Message formatting">
                    <button className="close-format" type="button" onPointerDown={keepEditorFocus} onClick={() => setEditorToolbarOpen(false)} title="Hide toolbar" aria-label="Hide formatting toolbar">
                      <X size={18} />
                    </button>
                    <button aria-label="Bold" className={bodyBold ? "active" : ""} type="button" onPointerDown={keepEditorFocus} onClick={() => {
                      setBodyBold((enabled) => !enabled);
                      runEditorCommand("bold");
                    }} title="Bold">
                      <Bold size={17} />
                    </button>
                    <button aria-label="Italic" className={bodyItalic ? "active" : ""} type="button" onPointerDown={keepEditorFocus} onClick={() => {
                      setBodyItalic((enabled) => !enabled);
                      runEditorCommand("italic");
                    }} title="Italic">
                      <Italic size={17} />
                    </button>
                    <button aria-label="Underline" className={bodyUnderline ? "active" : ""} type="button" onPointerDown={keepEditorFocus} onClick={() => {
                      setBodyUnderline((enabled) => !enabled);
                      runEditorCommand("underline");
                    }} title="Underline">
                      <Underline size={17} />
                    </button>
                    <button aria-label="Align left" className={bodyAlign === "left" ? "active" : ""} type="button" onPointerDown={keepEditorFocus} onClick={() => {
                      setBodyAlign("left");
                      runEditorCommand("justifyLeft");
                    }} title="Align left">
                      <AlignLeft size={17} />
                    </button>
                    <button aria-label="Align center" className={bodyAlign === "center" ? "active" : ""} type="button" onPointerDown={keepEditorFocus} onClick={() => {
                      setBodyAlign("center");
                      runEditorCommand("justifyCenter");
                    }} title="Align center">
                      <AlignCenter size={17} />
                    </button>
                    <button aria-label="Align right" className={bodyAlign === "right" ? "active" : ""} type="button" onPointerDown={keepEditorFocus} onClick={() => {
                      setBodyAlign("right");
                      runEditorCommand("justifyRight");
                    }} title="Align right">
                      <AlignRight size={17} />
                    </button>
                    <button aria-label="Justify" className={bodyAlign === "justify" ? "active" : ""} type="button" onPointerDown={keepEditorFocus} onClick={() => {
                      setBodyAlign("justify");
                      runEditorCommand("justifyFull");
                    }} title="Justify">
                      <AlignJustify size={17} />
                    </button>
                    <select
                      value={bodyFont}
                      onPointerDown={saveEditorSelection}
                      onChange={(event) => setEditorFont(event.target.value)}
                      aria-label="Font family"
                    >
                      {COMPOSE_FONTS.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                    <select
                      value={bodySize}
                      onPointerDown={saveEditorSelection}
                      onChange={(event) => setEditorSize(event.target.value)}
                      aria-label="Font size"
                    >
                      {COMPOSE_FONT_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <label className="color-control" title="Text color" onPointerDown={saveEditorSelection}>
                      <span>A</span>
                      <input aria-label="Text color" type="color" value={bodyColor} onChange={(event) => {
                        setBodyColor(event.target.value);
                        runEditorCommand("foreColor", event.target.value);
                      }} />
                    </label>
                    <label className="color-control" title="Highlight color" onPointerDown={saveEditorSelection}>
                      <Paintbrush size={17} />
                      <input aria-label="Highlight color" type="color" value={bodyHighlight} onChange={(event) => {
                        setBodyHighlight(event.target.value);
                        runEditorCommand("hiliteColor", event.target.value);
                      }} />
                    </label>
                  </div>
                ) : null}
              </div>
              <div
                className="rich-editor"
                contentEditable
                ref={editorRef}
                role="textbox"
                aria-multiline="true"
                aria-label="Message body"
                style={{ fontFamily: cssFontFamily(bodyFont), fontSize: bodySize, textAlign: bodyAlign }}
                onInput={syncEditorBody}
                onBlur={() => {
                  saveEditorSelection();
                  syncEditorBody();
                }}
                onPointerUp={syncFormatState}
                onKeyUp={syncFormatState}
                onSelect={saveEditorSelection}
                suppressContentEditableWarning
              />
            </div>
            {attachments.length ? (
              <div className="compose-attachments">
                {attachments.map((attachment) => (
                  <span key={`${attachment.name}-${attachment.size}`}>
                    <Paperclip size={14} />
                    {attachment.name}
                    <small>{formatBytes(attachment.size)}</small>
                    <button
                      type="button"
                      aria-label={`Remove attachment ${attachment.name}`}
                      onClick={() =>
                        setAttachments((currentAttachments) =>
                          currentAttachments.filter((item) => item.name !== attachment.name)
                        )
                      }
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {sendError ? <p className="send-error">{sendError}</p> : null}
            <div className="compose-footer">
              <input ref={fileInputRef} aria-label="Add attachments" hidden multiple type="file" onChange={handleAttachmentChange} />
              <button className="secondary-action" type="button" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={17} />
                Attach
              </button>
              <button className="secondary-action" type="button" onClick={() => saveDraftToServer()}>
                <Edit3 size={17} />
                Save draft
              </button>
              <button className="send-button" disabled={sendState === "sending"} type="submit">
                {sendState === "sent" ? <Check size={17} /> : <Send size={17} />}
                {sendState === "sending" ? "Sending..." : sendState === "sent" ? "Sent" : "Send"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
