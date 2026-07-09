import type { Metadata } from "next";
import { ApiDocsPage } from "@/components/docs/ApiDocsPage";

export const metadata: Metadata = {
  title: "API Reference",
  description:
    "REST API documentation for sending WhatsApp messages and managing calls with API keys.",
};

export default function ApiDocsRoutePage() {
  return <ApiDocsPage />;
}
