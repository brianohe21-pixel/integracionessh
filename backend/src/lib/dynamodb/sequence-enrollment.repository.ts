import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { SequenceEnrollment, SequenceEnrollmentStatus } from "../../types/index.js";

const enrollmentKeys = (tenantId: string, enrollmentId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `ENROLLMENT#${enrollmentId}`,
});

function gsi1Keys(tenantId: string, nextRunAt: string, enrollmentId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#SEQRUN`,
    GSI1SK: `DUE#${nextRunAt}#ENR#${enrollmentId}`,
  };
}

function stripItem(item: Record<string, unknown>): SequenceEnrollment {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as SequenceEnrollment;
}

export async function getEnrollmentById(
  tenantId: string,
  enrollmentId: string
): Promise<SequenceEnrollment | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: enrollmentKeys(tenantId, enrollmentId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function listEnrollmentsByOpportunity(
  tenantId: string,
  opportunityId: string
): Promise<SequenceEnrollment[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#SEQRUN`,
      },
      ScanIndexForward: true,
    })
  );

  return (result.Items ?? [])
    .filter((item) => String(item.SK ?? "").startsWith("ENROLLMENT#"))
    .map(stripItem)
    .filter((enrollment) => enrollment.opportunityId === opportunityId);
}

export async function listActiveEnrollmentsByOpportunity(
  tenantId: string,
  opportunityId: string
): Promise<SequenceEnrollment[]> {
  const enrollments = await listEnrollmentsByOpportunity(tenantId, opportunityId);
  return enrollments.filter((enrollment) => enrollment.status === "active" || enrollment.status === "paused");
}

export async function createEnrollment(
  enrollment: SequenceEnrollment
): Promise<SequenceEnrollment> {
  const nextRunAt = enrollment.nextRunAt ?? enrollment.createdAt;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...enrollmentKeys(enrollment.tenantId, enrollment.enrollmentId),
        ...gsi1Keys(enrollment.tenantId, nextRunAt, enrollment.enrollmentId),
        ...enrollment,
      },
    })
  );
  return enrollment;
}

export async function updateEnrollment(
  tenantId: string,
  enrollmentId: string,
  updates: Partial<
    Pick<
      SequenceEnrollment,
      | "currentStepIndex"
      | "status"
      | "nextRunAt"
      | "scheduleName"
      | "lastRunAt"
      | "botId"
      | "assignedAdvisorId"
      | "contactPhone"
      | "contactEmail"
    >
  >
): Promise<SequenceEnrollment | null> {
  const existing = await getEnrollmentById(tenantId, enrollmentId);
  if (!existing) return null;

  const merged: SequenceEnrollment = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (updates.status === "paused" || updates.status === "cancelled" || updates.status === "completed") {
    delete merged.scheduleName;
    if (updates.status === "completed" || updates.status === "cancelled") {
      delete merged.nextRunAt;
    }
  }

  const nextRunAt = merged.nextRunAt ?? merged.updatedAt;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...enrollmentKeys(tenantId, enrollmentId),
        ...gsi1Keys(tenantId, nextRunAt, enrollmentId),
        ...merged,
      },
    })
  );
  return merged;
}

export async function cancelEnrollmentsForOpportunity(
  tenantId: string,
  opportunityId: string
): Promise<SequenceEnrollment[]> {
  const active = await listActiveEnrollmentsByOpportunity(tenantId, opportunityId);
  const cancelled: SequenceEnrollment[] = [];
  for (const enrollment of active) {
    const updated = await updateEnrollment(tenantId, enrollment.enrollmentId, {
      status: "cancelled",
    });
    if (updated) cancelled.push(updated);
  }
  return cancelled;
}

export async function listDueEnrollments(
  tenantId: string,
  beforeIso: string
): Promise<SequenceEnrollment[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk AND GSI1SK <= :due",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#SEQRUN`,
        ":due": `DUE#${beforeIso}#ENR#~`,
      },
      ScanIndexForward: true,
      Limit: 50,
    })
  );

  return (result.Items ?? [])
    .filter((item) => String(item.SK ?? "").startsWith("ENROLLMENT#"))
    .map(stripItem)
    .filter((enrollment) => enrollment.status === "active");
}

export function isActiveEnrollmentStatus(status: SequenceEnrollmentStatus): boolean {
  return status === "active" || status === "paused";
}
