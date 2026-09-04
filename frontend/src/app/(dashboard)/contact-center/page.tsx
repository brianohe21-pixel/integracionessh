"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ContactCenterDialpad } from "@/components/contact-center/ContactCenterDialpad";
import { ContactCenterPhoneNumbersTab } from "@/components/contact-center/ContactCenterPhoneNumbersTab";
import { ContactCenterQueueEditor } from "@/components/contact-center/ContactCenterQueueEditor";
import { FormField } from "@/components/contact-center/FormField";
import { ContactCenterWallboard } from "@/components/contact-center/ContactCenterWallboard";
import { useBots } from "@/hooks/useBots";
import { getOutboundCallableBots } from "@/lib/voice-bots";
import { useAdvisors } from "@/hooks/useAdvisors";
import {
  useAssignAdvisorVoice,
  useContactCenterCampaigns,
  useContactCenterIvr,
  useContactCenterQueues,
  useContactCenterWallboard,
  useCreateIvr,
  useCreateQueue,
  useCreateVoiceCampaign,
  useMyPresence,
  usePauseVoiceCampaign,
  useSaveRouting,
  useStartVoiceCampaign,
  useUpdatePresence,
} from "@/hooks/useContactCenter";
import { useT } from "@/i18n/context";
import { Headphones, PhoneCall, Users } from "lucide-react";

type TabId = "dial" | "numbers" | "queues" | "ivr" | "routing" | "agents" | "campaigns" | "wallboard";

export default function ContactCenterPage() {
  const t = useT();
  const [tab, setTab] = useState<TabId>("dial");
  const { data: bots = [] } = useBots();
  const voiceBots = getOutboundCallableBots(bots);
  const [numbersBotId, setNumbersBotId] = useState(bots[0]?.botId ?? "");
  const [botId, setBotId] = useState(voiceBots[0]?.botId ?? "");
  const selectedBotId = botId || voiceBots[0]?.botId || "";
  const numbersSelectedBotId = numbersBotId || bots[0]?.botId || "";
  const queuesQuery = useContactCenterQueues(selectedBotId || undefined);
  const ivrQuery = useContactCenterIvr(selectedBotId || undefined);
  const campaignsQuery = useContactCenterCampaigns(selectedBotId || undefined);
  const { data: advisors = [], isLoading: advisorsLoading } = useAdvisors();
  const { data: myPresence } = useMyPresence();
  const { data: wallboard } = useContactCenterWallboard(tab === "agents");
  const updatePresence = useUpdatePresence();
  const createQueue = useCreateQueue();
  const createIvr = useCreateIvr();
  const saveRouting = useSaveRouting();
  const assignVoice = useAssignAdvisorVoice();
  const createCampaign = useCreateVoiceCampaign();
  const startCampaign = useStartVoiceCampaign();
  const pauseCampaign = usePauseVoiceCampaign();

  const [queueName, setQueueName] = useState("Soporte");
  const [ivrName, setIvrName] = useState("Menú principal");
  const [ivrPrompt, setIvrPrompt] = useState("Marque 1 para un asesor");
  const [routingMode, setRoutingMode] = useState<"ai" | "ivr" | "queue">("queue");
  const [routingQueueId, setRoutingQueueId] = useState("");
  const [routingIvrId, setRoutingIvrId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [campaignRecipients, setCampaignRecipients] = useState("");
  const [campaignQueueId, setCampaignQueueId] = useState("");
  const [expandedQueueId, setExpandedQueueId] = useState<string | null>(null);

  const queues = queuesQuery.data?.items ?? [];
  const ivrs = ivrQuery.data?.items ?? [];
  const campaigns = campaignsQuery.data?.items ?? [];
  const firstQueueId = queues[0]?.queueId ?? "";
  const queueIds = queues.map((queue) => queue.queueId);
  const myQueueCount = myPresence?.queueIds?.length ?? 0;
  const mySoftphoneReady =
    myPresence?.state === "available" &&
    myPresence.webrtcConnected &&
    myQueueCount > 0;
  const presenceByAdvisorId = useMemo(
    () => new Map((wallboard?.agents ?? []).map((agent) => [agent.advisorId, agent])),
    [wallboard?.agents]
  );

  function agentStateLabel(advisorId: string) {
    const presence = presenceByAdvisorId.get(advisorId);
    if (!presence) return t("contactCenter.agentNeverConnected");
    if (presence.state === "available" && presence.webrtcConnected) {
      return t("contactCenter.agentReady");
    }
    return presence.state;
  }

  async function assignQueuesToMe() {
    if (queueIds.length === 0) return;
    await updatePresence.mutateAsync({ queueIds });
  }

  const tabs = useMemo(
    () => [
      { id: "dial" as const, label: t("contactCenter.tabDial") },
      { id: "numbers" as const, label: t("contactCenter.tabNumbers") },
      { id: "queues" as const, label: t("contactCenter.tabQueues") },
      { id: "ivr" as const, label: t("contactCenter.tabIvr") },
      { id: "routing" as const, label: t("contactCenter.tabRouting") },
      { id: "agents" as const, label: t("contactCenter.tabAgents") },
      { id: "campaigns" as const, label: t("contactCenter.tabCampaigns") },
      { id: "wallboard" as const, label: t("contactCenter.tabWallboard") },
    ],
    [t]
  );

  return (
    <DashboardPage>
      <PageHeader title={t("contactCenter.title")} subtitle={t("contactCenter.subtitle")} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FormField label={t("contactCenter.voiceAgent")} className="min-w-[200px]">
          <Select value={selectedBotId} onChange={(event) => setBotId(event.target.value)}>
            {voiceBots.map((bot) => (
              <option key={bot.botId} value={bot.botId}>
                {bot.name}
              </option>
            ))}
          </Select>
        </FormField>
        <Tabs items={tabs} value={tab} onChange={setTab} />
      </div>

      {tab === "dial" ? (
        selectedBotId ? (
          <ContactCenterDialpad
            botId={selectedBotId}
            fromNumber={voiceBots.find((bot) => bot.botId === selectedBotId)?.telephonyPhoneNumber}
          />
        ) : (
          <EmptyState
            icon={<PhoneCall className="h-5 w-5" />}
            title={t("contactCenter.dialNoBot")}
          />
        )
      ) : null}

      {tab === "numbers" ? (
        <ContactCenterPhoneNumbersTab
          bots={bots}
          selectedBotId={numbersSelectedBotId}
          onBotChange={setNumbersBotId}
        />
      ) : null}

      {tab === "queues" ? (
        <Card padding="md" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <FormField label={t("contactCenter.queueName")}>
              <Input
                value={queueName}
                onChange={(event) => setQueueName(event.target.value)}
              />
            </FormField>
            <Button
              onClick={() => {
                if (!selectedBotId) return;
                void createQueue.mutateAsync({ botId: selectedBotId, name: queueName });
              }}
            >
              {t("contactCenter.createQueue")}
            </Button>
          </div>
          {queues.length === 0 ? (
            <EmptyState
              icon={<PhoneCall className="h-5 w-5" />}
              title={t("contactCenter.noQueues")}
            />
          ) : (
            <ul className="space-y-2 text-sm">
              {queues.map((queue) => (
                <ContactCenterQueueEditor
                  key={queue.queueId}
                  queue={queue}
                  queues={queues}
                  expanded={expandedQueueId === queue.queueId}
                  onToggle={() =>
                    setExpandedQueueId((current) =>
                      current === queue.queueId ? null : queue.queueId
                    )
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "ivr" ? (
        <Card padding="md" className="space-y-4">
          <FormField label={t("contactCenter.ivrName")}>
            <Input
              value={ivrName}
              onChange={(event) => setIvrName(event.target.value)}
            />
          </FormField>
          <FormField label={t("contactCenter.prompt")}>
            <Textarea
              value={ivrPrompt}
              onChange={(event) => setIvrPrompt(event.target.value)}
            />
          </FormField>
          <Button
            onClick={() => {
              if (!selectedBotId) return;
              const queueId = firstQueueId;
              void createIvr.mutateAsync({
                botId: selectedBotId,
                name: ivrName,
                entryNodeId: "menu",
                nodes: [
                  {
                    nodeId: "menu",
                    type: "menu",
                    prompt: ivrPrompt,
                    options: [
                      { digit: "1", targetType: "queue", targetId: queueId },
                      { digit: "2", targetType: "ai" },
                    ],
                  },
                ],
              });
            }}
          >
            {t("contactCenter.createIvr")}
          </Button>
          <ul className="space-y-2 text-sm">
            {ivrs.map((flow) => (
              <li key={flow.ivrFlowId} className="rounded-lg border border-default px-3 py-2">
                {flow.name} · {flow.nodes.length} nodes
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === "routing" ? (
        <Card padding="md" className="space-y-4">
          <FormField label={t("contactCenter.routingMode")}>
            <Select
              value={routingMode}
              onChange={(event) => setRoutingMode(event.target.value as typeof routingMode)}
            >
              <option value="ai">{t("contactCenter.modeAi")}</option>
              <option value="ivr">{t("contactCenter.modeIvr")}</option>
              <option value="queue">{t("contactCenter.modeQueue")}</option>
            </Select>
          </FormField>
          <FormField label={t("contactCenter.tabQueues")}>
            <Select value={routingQueueId} onChange={(event) => setRoutingQueueId(event.target.value)}>
              <option value="">{t("contactCenter.selectQueue")}</option>
              {queues.map((queue) => (
                <option key={queue.queueId} value={queue.queueId}>
                  {queue.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("contactCenter.tabIvr")}>
            <Select value={routingIvrId} onChange={(event) => setRoutingIvrId(event.target.value)}>
              <option value="">{t("contactCenter.selectIvr")}</option>
              {ivrs.map((flow) => (
                <option key={flow.ivrFlowId} value={flow.ivrFlowId}>
                  {flow.name}
                </option>
              ))}
            </Select>
          </FormField>
          <Button
            onClick={() => {
              if (!selectedBotId) return;
              void saveRouting.mutateAsync({
                botId: selectedBotId,
                body: {
                  telephonyRoutingMode: routingMode,
                  telephonyQueueId: routingQueueId || undefined,
                  telephonyIvrFlowId: routingIvrId || undefined,
                },
              });
            }}
          >
            {t("contactCenter.saveRouting")}
          </Button>
        </Card>
      ) : null}

      {tab === "agents" ? (
        <div className="space-y-4">
          <Card padding="md" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4 text-accent" />
                <span className="font-medium">{t("contactCenter.mySoftphone")}</span>
                {myPresence?.state ? (
                  <span className="text-secondary">· {myPresence.state}</span>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={queueIds.length === 0 || updatePresence.isPending}
                onClick={() => void assignQueuesToMe()}
              >
                {t("contactCenter.assignQueues")}
              </Button>
            </div>
            <p className="text-xs text-secondary">
              {queueIds.length === 0
                ? t("contactCenter.noQueues")
                : mySoftphoneReady
                  ? t("contactCenter.mySoftphoneReady")
                  : myQueueCount > 0
                    ? t("contactCenter.myQueuesAssigned", { count: myQueueCount })
                    : t("contactCenter.myQueuesEmpty")}
            </p>
          </Card>

          {!mySoftphoneReady &&
          advisors.every((advisor) => {
            const presence = presenceByAdvisorId.get(advisor.advisorId);
            return !(
              presence?.state === "available" &&
              presence.webrtcConnected &&
              (presence.queueIds?.length ?? 0) > 0
            );
          }) ? (
            <Card padding="md" className="border-amber-300 bg-amber-50 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              {t("contactCenter.noReadyAgents")}
            </Card>
          ) : null}

          <Card padding="md" className="space-y-3">
            <h3 className="text-sm font-semibold">{t("contactCenter.advisorsSection")}</h3>
            {advisorsLoading ? (
              <p className="text-sm text-secondary">{t("common.loading")}</p>
            ) : advisors.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title={t("contactCenter.noAdvisorsTitle")}
                description={t("contactCenter.noAdvisorsDescription")}
                action={
                  <Link
                    href="/advisors"
                    className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
                  >
                    {t("contactCenter.createAdvisor")}
                  </Link>
                }
              />
            ) : (
              advisors.map((advisor) => (
                <div
                  key={advisor.advisorId}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <span>{advisor.name}</span>
                    <span className="ml-2 text-xs text-secondary">
                      · {agentStateLabel(advisor.advisorId)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={queueIds.length === 0}
                    onClick={() =>
                      void assignVoice.mutateAsync({
                        advisorId: advisor.advisorId,
                        queueIds,
                        voiceEnabled: true,
                      })
                    }
                  >
                    {t("contactCenter.assignQueues")}
                  </Button>
                </div>
              ))
            )}
          </Card>
        </div>
      ) : null}

      {tab === "campaigns" ? (
        <Card padding="md" className="space-y-4">
          <FormField label={t("contactCenter.campaignName")}>
            <Input
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
            />
          </FormField>
          <FormField label={t("contactCenter.tabQueues")}>
            <Select
              value={campaignQueueId || firstQueueId}
              onChange={(event) => setCampaignQueueId(event.target.value)}
            >
              {queues.map((queue) => (
                <option key={queue.queueId} value={queue.queueId}>
                  {queue.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("contactCenter.recipients")}>
            <Textarea
              value={campaignRecipients}
              onChange={(event) => setCampaignRecipients(event.target.value)}
              rows={6}
            />
          </FormField>
          <Button
            onClick={() => {
              if (!selectedBotId) return;
              const recipients = campaignRecipients
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);
              void createCampaign.mutateAsync({
                botId: selectedBotId,
                name: campaignName || "Campaign",
                mode: "progressive",
                fromNumber: voiceBots.find((bot) => bot.botId === selectedBotId)?.telephonyPhoneNumber,
                queueId: campaignQueueId || firstQueueId,
                recipients,
              });
            }}
          >
            {t("contactCenter.createCampaign")}
          </Button>
          {campaigns.length === 0 ? (
            <p className="text-sm text-secondary">{t("contactCenter.noCampaigns")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {campaigns.map((campaign) => (
                <li
                  key={campaign.campaignId}
                  className="flex items-center justify-between rounded-lg border border-default px-3 py-2"
                >
                  <span>
                    {campaign.name} · {campaign.status} · {campaign.nextIndex}/{campaign.recipients.length}
                  </span>
                  {campaign.status === "running" ? (
                    <Button size="sm" variant="secondary" onClick={() => void pauseCampaign.mutateAsync(campaign.campaignId)}>
                      {t("contactCenter.pauseCampaign")}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => void startCampaign.mutateAsync(campaign.campaignId)}>
                      {t("contactCenter.startCampaign")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "wallboard" ? <ContactCenterWallboard showSupervise /> : null}
    </DashboardPage>
  );
}
