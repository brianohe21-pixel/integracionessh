import { fetchAuthSession } from "aws-amplify/auth";

export const ADMIN_HOME = "/admin/users";
export const MEMBER_HOME = "/bots";

export async function getPostLoginPath(): Promise<string> {
  try {
    const session = await fetchAuthSession();
    const role = session.tokens?.idToken?.payload?.["custom:role"];
    return role === "admin" ? ADMIN_HOME : MEMBER_HOME;
  } catch {
    return MEMBER_HOME;
  }
}
