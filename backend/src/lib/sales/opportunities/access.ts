import type { AuthContext } from "../../../types/index.js";
import { getAdvisorByCognitoUserId } from "../../dynamodb/advisor.repository.js";
import type { Opportunity, SalesTask, SequenceEnrollment } from "../../../types/index.js";

export async function resolveAdvisorIdForAuth(auth: AuthContext): Promise<string | null> {
  if (auth.role !== "advisor") return null;
  const advisor = await getAdvisorByCognitoUserId(auth.tenantId, auth.userId);
  return advisor?.advisorId ?? null;
}

export function canAdvisorAccessOpportunity(
  advisorId: string | null,
  opportunity: Opportunity
): boolean {
  if (!advisorId) return true;
  return opportunity.assignedAdvisorId === advisorId;
}

export function canAdvisorAccessTask(advisorId: string | null, task: SalesTask): boolean {
  if (!advisorId) return true;
  return task.advisorId === advisorId;
}

export function canAdvisorAccessEnrollment(
  advisorId: string | null,
  enrollment: SequenceEnrollment,
  opportunity?: Opportunity | null
): boolean {
  if (!advisorId) return true;
  if (enrollment.assignedAdvisorId === advisorId) return true;
  if (opportunity?.assignedAdvisorId === advisorId) return true;
  return false;
}

export function filterOpportunitiesForAdvisor(
  advisorId: string | null,
  opportunities: Opportunity[]
): Opportunity[] {
  if (!advisorId) return opportunities;
  return opportunities.filter((opp) => opp.assignedAdvisorId === advisorId);
}
