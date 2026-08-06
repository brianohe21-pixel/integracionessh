export interface FlowPipelineResult {
  handled: boolean;
  halt: boolean;
  status?: "active" | "waiting" | "completed" | "failed";
  errorMessage?: string;
}
