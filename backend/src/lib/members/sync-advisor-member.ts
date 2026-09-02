import { getMember, putMember } from "../dynamodb/member.repository.js";

export async function syncAdvisorMemberRecord(params: {
  tenantId: string;
  cognitoUserId: string;
  username: string;
  email: string;
  name: string;
  advisorId: string;
}): Promise<void> {
  const existing = await getMember(params.tenantId, params.cognitoUserId);
  const now = new Date().toISOString();

  await putMember(
    {
      userId: params.cognitoUserId,
      username: params.username,
      email: params.email,
      name: params.name,
      role: "advisor",
      enabled: true,
      createdAt: existing?.createdAt ?? now,
      advisorId: params.advisorId,
    },
    params.tenantId
  );
}
