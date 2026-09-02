import type { Metadata } from "next";
import { UserManualPage } from "@/components/docs/UserManualPage";

export const metadata: Metadata = {
  title: "User Manual",
  description:
    "Guides for onboarding, bots, channels, inbox, and automation flows on the Agent Platform.",
};

export default function UserManualRoutePage() {
  return <UserManualPage />;
}
