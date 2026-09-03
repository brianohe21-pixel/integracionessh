import { getAdvisorByCognitoUserId } from "../dynamodb/advisor.repository.js";
import { getMember, putMember, touchMemberLastLogin } from "../dynamodb/member.repository.js";

export async function recordUserLogin(params: {
  tenantId: string;
  userId: string;
  email?: string;
  name?: string;
  role?: string;
}): Promise<void> {
  const tenantId = params.tenantId.trim();
  const userId = params.userId.trim();
  if (!tenantId || !userId) return;

  const existing = await getMember(tenantId, userId);
  if (existing) {
    await touchMemberLastLogin(tenantId, userId);
    return;
  }

  const now = new Date().toISOString();
  const email = params.email?.trim() ?? "";
  const name = params.name?.trim() || email || "User";
  const role = params.role === "advisor" ? "advisor" : "member";

  if (role === "advisor") {
    const advisor = await getAdvisorByCognitoUserId(tenantId, userId);
    if (!advisor) return;

    await putMember(
      {
        userId,
        username: email,
        email,
        name: advisor.name,
        role: "advisor",
        enabled: true,
        createdAt: now,
        advisorId: advisor.advisorId,
        lastLoginAt: now,
      },
      tenantId
    );
    return;
  }

  if (!email) return;

  await putMember(
    {
      userId,
      username: email,
      email,
      name,
      role: "member",
      enabled: true,
      createdAt: now,
      lastLoginAt: now,
    },
    tenantId
  );
}
