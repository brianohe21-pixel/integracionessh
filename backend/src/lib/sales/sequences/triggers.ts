import { listSequences } from "../../dynamodb/sequence.repository.js";
import { enrollOpportunityInSequence } from "../sequences/enroll.js";

export async function triggerSequencesForOpportunity(params: {
  tenantId: string;
  opportunityId: string;
  trigger: "opportunity_created" | "stage_entered";
  stageId?: string;
  pipelineId?: string;
}): Promise<void> {
  const sequences = await listSequences(params.tenantId);
  const matching = sequences.filter((sequence) => {
    if (!sequence.enabled) return false;
    if (sequence.trigger !== params.trigger) return false;
    if (params.trigger === "stage_entered") {
      if (!params.stageId || sequence.triggerStageId !== params.stageId) return false;
      if (sequence.pipelineId && params.pipelineId && sequence.pipelineId !== params.pipelineId) {
        return false;
      }
    }
  return true;
  });

  for (const sequence of matching) {
    await enrollOpportunityInSequence({
      tenantId: params.tenantId,
      sequenceId: sequence.sequenceId,
      opportunityId: params.opportunityId,
    }).catch(() => undefined);
  }
}
