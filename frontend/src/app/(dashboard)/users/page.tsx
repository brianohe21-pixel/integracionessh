"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, UserCheck, UserX, UsersRound } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { UsersTab } from "@/components/users/UsersTab";
import { TeamsTab } from "@/components/users/TeamsTab";
import { RolesTab } from "@/components/users/RolesTab";
import {
  useOrganizationTeams,
  useTenantMembers,
} from "@/hooks/useTenantMembers";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useT } from "@/i18n/context";
import { MEMBER_HOME } from "@/lib/post-login-path";

type UserCenterTab = "users" | "teams" | "roles";

export default function UserCenterPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccessUserCenter, isAdvisor, loading: roleLoading } = useTenantRole();
  const { data: membersData } = useTenantMembers();
  const { data: teamsData } = useOrganizationTeams();

  const [tab, setTab] = useState<UserCenterTab>("users");

  useEffect(() => {
    if (!roleLoading && isAdvisor) {
      router.replace(MEMBER_HOME);
    }
  }, [isAdvisor, roleLoading, router]);

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested === "users" || requested === "teams" || requested === "roles") {
      setTab(requested);
    }
  }, [searchParams]);

  const members = membersData?.members ?? [];
  const teams = teamsData?.teams ?? [];

  const stats = useMemo(() => {
    const activeUsers = members.filter((member) => member.enabled).length;
    const inactiveUsers = members.filter((member) => !member.enabled).length;
    const supervisors = members.filter(
      (member) => member.role === "supervisor" && member.enabled
    ).length;
    return { activeUsers, inactiveUsers, supervisors, teamCount: teams.length };
  }, [members, teams]);

  function selectTab(nextTab: UserCenterTab) {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`/users?${params.toString()}`, { scroll: false });
  }

  if (roleLoading || isAdvisor) return null;
  if (!canAccessUserCenter) {
    router.replace(MEMBER_HOME);
    return null;
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("userCenter.title")}
        subtitle={t("userCenter.subtitle")}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("userCenter.statActiveUsers")}
          value={String(stats.activeUsers)}
          icon={<UserCheck className="h-5 w-5 text-success" />}
          compact
        />
        <StatCard
          label={t("userCenter.statInactiveUsers")}
          value={String(stats.inactiveUsers)}
          icon={<UserX className="h-5 w-5 text-danger" />}
          compact
        />
        <StatCard
          label={t("userCenter.statTeams")}
          value={String(stats.teamCount)}
          icon={<UsersRound className="h-5 w-5 text-accent" />}
          compact
        />
        <StatCard
          label={t("userCenter.statSupervisors")}
          value={String(stats.supervisors)}
          icon={<Users className="h-5 w-5 text-accent" />}
          compact
        />
      </div>

      <Tabs
        value={tab}
        onChange={(value) => selectTab(value as UserCenterTab)}
        items={[
          { id: "users", label: t("userCenter.tabUsers"), count: members.length },
          { id: "teams", label: t("userCenter.tabTeams"), count: teams.length },
          { id: "roles", label: t("userCenter.tabRoles") },
        ]}
        className="mb-6 w-full max-w-lg"
      />

      {tab === "users" ? <UsersTab /> : tab === "teams" ? <TeamsTab /> : <RolesTab />}
    </DashboardPage>
  );
}
