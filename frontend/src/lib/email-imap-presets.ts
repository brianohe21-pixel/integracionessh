export type ImapPresetId =
  | "gmail"
  | "outlook"
  | "yahoo"
  | "icloud"
  | "zoho"
  | "godaddy"
  | "hostinger";

export interface ImapPreset {
  id: ImapPresetId;
  labelKey: string;
  hintKey?: string;
  host: string;
  port: number;
  useTls: boolean;
  mailbox: string;
}

export const IMAP_PRESETS: ImapPreset[] = [
  {
    id: "gmail",
    labelKey: "emailChannel.imapPresetGmail",
    hintKey: "emailChannel.imapPresetHintGmail",
    host: "imap.gmail.com",
    port: 993,
    useTls: true,
    mailbox: "INBOX",
  },
  {
    id: "outlook",
    labelKey: "emailChannel.imapPresetOutlook",
    hintKey: "emailChannel.imapPresetHintOutlook",
    host: "outlook.office365.com",
    port: 993,
    useTls: true,
    mailbox: "INBOX",
  },
  {
    id: "yahoo",
    labelKey: "emailChannel.imapPresetYahoo",
    hintKey: "emailChannel.imapPresetHintYahoo",
    host: "imap.mail.yahoo.com",
    port: 993,
    useTls: true,
    mailbox: "INBOX",
  },
  {
    id: "icloud",
    labelKey: "emailChannel.imapPresetIcloud",
    hintKey: "emailChannel.imapPresetHintIcloud",
    host: "imap.mail.me.com",
    port: 993,
    useTls: true,
    mailbox: "INBOX",
  },
  {
    id: "zoho",
    labelKey: "emailChannel.imapPresetZoho",
    host: "imap.zoho.com",
    port: 993,
    useTls: true,
    mailbox: "INBOX",
  },
  {
    id: "godaddy",
    labelKey: "emailChannel.imapPresetGodaddy",
    host: "imap.secureserver.net",
    port: 993,
    useTls: true,
    mailbox: "INBOX",
  },
  {
    id: "hostinger",
    labelKey: "emailChannel.imapPresetHostinger",
    host: "imap.hostinger.com",
    port: 993,
    useTls: true,
    mailbox: "INBOX",
  },
];

export function matchImapPreset(host: string, port: number, useTls: boolean): ImapPresetId | null {
  const normalizedHost = host.trim().toLowerCase();
  if (!normalizedHost) return null;

  const match = IMAP_PRESETS.find(
    (preset) =>
      preset.host === normalizedHost &&
      preset.port === port &&
      preset.useTls === useTls
  );

  return match?.id ?? null;
}
