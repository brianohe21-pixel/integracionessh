import { useT } from "@/i18n/context";

export function InboxMockup() {
  const t = useT();
  const threads = ["open", "pending", "closed"] as const;

  return (
    <div className="grid min-h-[220px] grid-cols-12 gap-2 rounded-xl border border-default bg-surface p-2">
      <div className="col-span-4 space-y-1.5 border-r border-subtle pr-2">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          {t("userManual.mockups.inbox.listTitle")}
        </p>
        {threads.map((thread, index) => (
          <div
            key={thread}
            className={
              index === 0
                ? "rounded-lg border border-accent/30 bg-accent-muted/25 p-2"
                : "rounded-lg border border-transparent bg-surface-muted/50 p-2"
            }
          >
            <p className="text-[11px] font-medium text-primary">
              {t(`userManual.mockups.inbox.threads.${thread}.name`)}
            </p>
            <p className="truncate text-[10px] text-secondary">
              {t(`userManual.mockups.inbox.threads.${thread}.preview`)}
            </p>
            <span className="mt-1 inline-block rounded bg-surface-muted px-1 py-0.5 text-[9px] text-muted">
              {t(`userManual.mockups.inbox.threads.${thread}.status`)}
            </span>
          </div>
        ))}
      </div>
      <div className="col-span-5 flex flex-col border-r border-subtle pr-2">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          {t("userManual.mockups.inbox.chatTitle")}
        </p>
        <div className="flex-1 space-y-2">
          <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-surface-muted px-2.5 py-1.5 text-[10px] text-secondary">
            {t("userManual.mockups.inbox.messages.incoming")}
          </div>
          <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-accent px-2.5 py-1.5 text-[10px] text-white">
            {t("userManual.mockups.inbox.messages.outgoing")}
          </div>
        </div>
        <div className="mt-2 rounded-lg border border-default bg-surface px-2 py-1.5 text-[10px] text-muted">
          {t("userManual.mockups.inbox.composePlaceholder")}
        </div>
      </div>
      <div className="col-span-3 space-y-2">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          {t("userManual.mockups.inbox.detailTitle")}
        </p>
        <div className="rounded-lg bg-surface-muted/60 p-2">
          <p className="text-[10px] font-medium text-primary">
            {t("userManual.mockups.inbox.detailAssignee")}
          </p>
          <p className="text-[10px] text-secondary">{t("userManual.mockups.inbox.detailAssigneeValue")}</p>
        </div>
        <div className="rounded-lg bg-surface-muted/60 p-2">
          <p className="text-[10px] font-medium text-primary">
            {t("userManual.mockups.inbox.detailNotes")}
          </p>
          <p className="text-[10px] text-secondary">{t("userManual.mockups.inbox.detailNotesValue")}</p>
        </div>
      </div>
    </div>
  );
}
