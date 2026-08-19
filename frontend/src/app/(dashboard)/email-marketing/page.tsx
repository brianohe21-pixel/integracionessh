import { Suspense } from "react";
import { MailrelayDashboard } from "@/components/mailrelay/MailrelayDashboard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EmailMarketingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <MailrelayDashboard />
    </Suspense>
  );
}
