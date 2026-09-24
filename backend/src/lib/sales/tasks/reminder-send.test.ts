import { buildTaskReminderTemplateParams } from "./reminder-send.js";
import type { SalesTask } from "../../../types/index.js";

describe("buildTaskReminderTemplateParams", () => {
  const baseTask: SalesTask = {
    taskId: "task-1",
    tenantId: "tenant-1",
    title: "Llamar de vuelta",
    status: "open",
    createdAt: "2026-09-24T22:00:00.000Z",
    updatedAt: "2026-09-24T22:00:00.000Z",
  };

  it("maps title, due date and contact", () => {
    const params = buildTaskReminderTemplateParams({
      ...baseTask,
      dueAt: "2026-09-25T15:30:00.000Z",
      contactName: "Cliente Prueba",
      contactPhone: "573001112233",
    });

    expect(params.title).toBe("Llamar de vuelta");
    expect(params.dueAt).not.toBe("Sin vencimiento");
    expect(params.contact).toContain("Cliente Prueba");
    expect(params.contact).toContain("573001112233");
  });

  it("uses placeholders when optional fields are missing", () => {
    const params = buildTaskReminderTemplateParams(baseTask);
    expect(params.dueAt).toBe("Sin vencimiento");
    expect(params.contact).toBe("—");
  });

  it("strips newlines from template parameters", () => {
    const params = buildTaskReminderTemplateParams({
      ...baseTask,
      title: "Seguimiento\nurgente",
      contactName: "Ana\tPérez",
    });
    expect(params.title).toBe("Seguimiento urgente");
    expect(params.contact).toBe("Ana Pérez");
  });
});
