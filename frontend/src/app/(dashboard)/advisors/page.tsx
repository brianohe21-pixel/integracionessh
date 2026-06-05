"use client";

import { useState } from "react";
import { Plus, Users, Trash2 } from "lucide-react";
import {
  useAdvisors,
  useCreateAdvisor,
  useDeleteAdvisor,
} from "@/hooks/useAdvisors";
import { useBots } from "@/hooks/useBots";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { useT } from "@/i18n/context";

export default function AdvisorsPage() {
  const t = useT();
  const { data: advisors, isLoading } = useAdvisors();
  const { data: bots } = useBots();
  const createAdvisor = useCreateAdvisor();
  const deleteAdvisor = useDeleteAdvisor();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [inviteInfo, setInviteInfo] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInviteInfo(null);
    try {
      const result = await createAdvisor.mutateAsync({
        name,
        phoneNumber,
        ...(inviteEmail ? { inviteEmail } : {}),
        ...(selectedBots.length ? { botIds: selectedBots } : {}),
      });
      if (result.invite) {
        setInviteInfo(
          `${t("advisors.inviteCreated")} ${result.invite.username} / ${result.invite.temporaryPassword}`
        );
      }
      setName("");
      setPhoneNumber("");
      setInviteEmail("");
      setSelectedBots([]);
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("advisors.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("advisors.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          {t("advisors.newAdvisor")}
        </button>
      </div>

      {inviteInfo && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          {inviteInfo}
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500">{t("common.loading")}</p>}

      {!isLoading && advisors?.length === 0 && (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title={t("advisors.emptyTitle")}
          description={t("advisors.emptyDescription")}
        />
      )}

      <div className="space-y-3">
        {advisors?.map((advisor) => (
          <div
            key={advisor.advisorId}
            className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4"
          >
            <div>
              <p className="font-medium text-gray-900">{advisor.name}</p>
              <p className="text-sm text-gray-500">{advisor.phoneNumber}</p>
              {advisor.cognitoUserId && (
                <p className="text-xs text-gray-400 mt-1">{t("advisors.panelAccess")}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={advisor.status === "active" ? "success" : "default"}>
                {advisor.status === "active" ? t("advisors.active") : t("advisors.inactive")}
              </Badge>
              <button
                type="button"
                onClick={() => deleteAdvisor.mutate(advisor.advisorId)}
                className="p-2 text-gray-400 hover:text-red-600"
                aria-label={t("advisors.deactivate")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">{t("advisors.newAdvisor")}</h2>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("advisors.namePlaceholder")}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <input
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={t("advisors.phonePlaceholder")}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t("advisors.emailPlaceholder")}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            {bots && bots.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">{t("advisors.botsOptional")}</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {bots.map((bot) => (
                    <label key={bot.botId} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedBots.includes(bot.botId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBots((prev) => [...prev, bot.botId]);
                          } else {
                            setSelectedBots((prev) => prev.filter((id) => id !== bot.botId));
                          }
                        }}
                      />
                      {bot.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-gray-600"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={createAdvisor.isPending}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg"
              >
                {t("common.save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
