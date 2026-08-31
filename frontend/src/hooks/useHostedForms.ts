import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { HostedForm, HostedFormSubmission } from "@/types";

export type HostedFormInput = Partial<
  Pick<
    HostedForm,
    | "name"
    | "description"
    | "botId"
    | "fields"
    | "submitLabel"
    | "successTitle"
    | "successMessage"
    | "redirectUrl"
    | "flowId"
    | "crmMapping"
    | "createLeadOnSubmit"
    | "tags"
  >
>;

export function useHostedForms() {
  return useQuery({
    queryKey: ["hosted-forms"],
    queryFn: () => api.get<{ items: HostedForm[] }>("/forms"),
  });
}

export function useHostedForm(formId: string) {
  return useQuery({
    queryKey: ["hosted-forms", formId],
    queryFn: () => api.get<HostedForm>(`/forms/${encodeURIComponent(formId)}`),
    enabled: Boolean(formId),
  });
}

export function useHostedFormSubmissions(formId: string) {
  return useQuery({
    queryKey: ["hosted-forms", formId, "submissions"],
    queryFn: () =>
      api.get<{ items: HostedFormSubmission[] }>(
        `/forms/${encodeURIComponent(formId)}/submissions`
      ),
    enabled: Boolean(formId),
  });
}

export function useHostedFormFlowOptions() {
  return useQuery({
    queryKey: ["hosted-forms", "flow-options"],
    queryFn: () =>
      api.get<{ items: Array<{ flowId: string; name: string; enabled: boolean }> }>(
        "/forms/flow-options"
      ),
  });
}

export function useCreateHostedForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: HostedFormInput) => api.post<HostedForm>("/forms", body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["hosted-forms"] }),
  });
}

export function useUpdateHostedForm(formId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: HostedFormInput) =>
      api.put<HostedForm>(`/forms/${encodeURIComponent(formId)}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hosted-forms"] });
      void qc.invalidateQueries({ queryKey: ["hosted-forms", formId] });
    },
  });
}

export function usePublishHostedForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) =>
      api.post<HostedForm>(`/forms/${encodeURIComponent(formId)}/publish`, {}),
    onSuccess: (_data, formId) => {
      void qc.invalidateQueries({ queryKey: ["hosted-forms"] });
      void qc.invalidateQueries({ queryKey: ["hosted-forms", formId] });
    },
  });
}

export function useUnpublishHostedForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) =>
      api.post<HostedForm>(`/forms/${encodeURIComponent(formId)}/unpublish`, {}),
    onSuccess: (_data, formId) => {
      void qc.invalidateQueries({ queryKey: ["hosted-forms"] });
      void qc.invalidateQueries({ queryKey: ["hosted-forms", formId] });
    },
  });
}

export function useRotateHostedFormKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) =>
      api.post<HostedForm>(`/forms/${encodeURIComponent(formId)}/rotate-key`, {}),
    onSuccess: (_data, formId) => {
      void qc.invalidateQueries({ queryKey: ["hosted-forms"] });
      void qc.invalidateQueries({ queryKey: ["hosted-forms", formId] });
    },
  });
}

export function useDeleteHostedForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) => api.delete(`/forms/${encodeURIComponent(formId)}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["hosted-forms"] }),
  });
}
