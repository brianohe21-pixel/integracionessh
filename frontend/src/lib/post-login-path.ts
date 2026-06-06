import { fetchAuthSession } from "aws-amplify/auth";

export const ADMIN_HOME = "/admin/users";
export const MEMBER_HOME = "/bots";
export const ADVISOR_HOME = "/inbox";

export async function getPostLoginPath(): Promise<string> {
  try {
    const session = await fetchAuthSession();
    const role = session.tokens?.idToken?.payload?.["custom:role"];
    if (role === "admin") return ADMIN_HOME;
    if (role === "advisor") return ADVISOR_HOME;
    return MEMBER_HOME;
  } catch {
    return MEMBER_HOME;
  }
}
