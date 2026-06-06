import { listAdvisors, touchAdvisorAssignment } from "../dynamodb/advisor.repository.js";
import type { Advisor } from "../../types/index.js";

export async function pickAdvisor(tenantId: string, botId: string): Promise<Advisor | null> {
  const advisors = (await listAdvisors(tenantId)).filter((a) => {
    if (a.status !== "active") return false;
    if (!a.botIds?.length) return true;
    return a.botIds.includes(botId);
  });

  if (advisors.length === 0) return null;

  advisors.sort((a, b) => {
    const aTime = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0;
    const bTime = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0;
    return aTime - bTime;
  });

  const picked = advisors[0];
  await touchAdvisorAssignment(tenantId, picked.advisorId);
  return picked;
}
