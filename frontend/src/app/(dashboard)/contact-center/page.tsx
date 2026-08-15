"use client";

import { useMemo, useState } from "react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ContactCenterDialpad } from "@/components/contact-center/ContactCenterDialpad";
import { ContactCenterWallboard } from "@/components/contact-center/ContactCenterWallboard";
import { useBots } from "@/hooks/useBots";
import { useAdvisors } from "@/hooks/useAdvisors";
import {
  useAssignAdvisorVoice,
  useContactCenterCampaigns,
  useContactCenterIvr,
  useContactCenterQueues,
  useCreateIvr,
  useCreateQueue,
  useCreateVoiceCampaign,
  usePauseVoiceCampaign,
  useSaveRouting,
  useStartVoiceCampaign,
} from "@/hooks/useContactCenter";
import { useT } from "@/i18n/context";
import { PhoneCall } from "lucide-react";

type TabId = "dial" | "queues" | "ivr" | "routing" | "agents" | "campaigns" | "wallboard";

export default function ContactCenterPage() {
  const t = useT();
  const [tab, setTab] = useState<TabId>("dial");
  const { data: bots = [] } = useBots();
  const voiceBots = bots.filter((bot) => bot.telephonyEnabled);
  const [botId, setBotId] = useState(voiceBots[0]?.botId ?? "");
  const selectedBotId = botId || voiceBots[0]?.botId || "";
  const queuesQuery = useContactCenterQueues(selectedBotId || undefined);
  const ivrQuery = useContactCenterIvr(selectedBotId || undefined);
  const campaignsQuery = useContactCenterCampaigns(selectedBotId || undefined);
  const { data: advisors = [] } = useAdvisors();
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

  const queues = queuesQuery.data?.items ?? [];
  const ivrs = ivrQuery.data?.items ?? [];
  const campaigns = campaignsQuery.data?.items ?? [];
  const firstQueueId = queues[0]?.queueId ?? "";

  const tabs = useMemo(
    () => [
      { id: "dial" as const, label: t("contactCenter.tabDial") },
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={selectedBotId} onChange={(event) => setBotId(event.target.value)}>
          {voiceBots.map((bot) => (
            <option key={bot.botId} value={bot.botId}>
              {bot.name}
            </option>
          ))}
        </Select>
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

      {tab === "queues" ? (
        <Card padding="md" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              value={queueName}
              onChange={(event) => setQueueName(event.target.value)}
              placeholder={t("contactCenter.queueName")}
            />
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
                <li key={queue.queueId} className="flex justify-between rounded-lg border border-default px-3 py-2">
                  <span>{queue.name}</span>
                  <span className="text-secondary">{queue.strategy}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "ivr" ? (
        <Card padding="md" className="space-y-4">
          <Input
            value={ivrName}
            onChange={(event) => setIvrName(event.target.value)}
            placeholder={t("contactCenter.ivrName")}
          />
          <Textarea
            value={ivrPrompt}
            onChange={(event) => setIvrPrompt(event.target.value)}
            placeholder={t("contactCenter.prompt")}
          />
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
          <Select
            value={routingMode}
            onChange={(event) => setRoutingMode(event.target.value as typeof routingMode)}
          >
            <option value="ai">{t("contactCenter.modeAi")}</option>
            <option value="ivr">{t("contactCenter.modeIvr")}</option>
            <option value="queue">{t("contactCenter.modeQueue")}</option>
          </Select>
          <Select value={routingQueueId} onChange={(event) => setRoutingQueueId(event.target.value)}>
            <option value="">{t("contactCenter.tabQueues")}</option>
            {queues.map((queue) => (
              <option key={queue.queueId} value={queue.queueId}>
                {queue.name}
              </option>
            ))}
          </Select>
          <Select value={routingIvrId} onChange={(event) => setRoutingIvrId(event.target.value)}>
            <option value="">{t("contactCenter.tabIvr")}</option>
            {ivrs.map((flow) => (
              <option key={flow.ivrFlowId} value={flow.ivrFlowId}>
                {flow.name}
              </option>
            ))}
          </Select>
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
        <Card padding="md" className="space-y-3">
          {advisors.map((advisor) => (
            <div key={advisor.advisorId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{advisor.name}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void assignVoice.mutateAsync({
                    advisorId: advisor.advisorId,
                    queueIds: queues.map((queue) => queue.queueId),
                    voiceEnabled: true,
                  })
                }
              >
                {t("contactCenter.assignQueues")}
              </Button>
            </div>
          ))}
        </Card>
      ) : null}

      {tab === "campaigns" ? (
        <Card padding="md" className="space-y-4">
          <Input
            value={campaignName}
            onChange={(event) => setCampaignName(event.target.value)}
            placeholder={t("contactCenter.createCampaign")}
          />
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
          <Textarea
            value={campaignRecipients}
            onChange={(event) => setCampaignRecipients(event.target.value)}
            placeholder={t("contactCenter.recipients")}
            rows={6}
          />
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
