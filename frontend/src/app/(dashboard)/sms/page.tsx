import { Suspense } from "react";
import { SmsDashboard } from "@/components/sms/SmsDashboard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function SmsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SmsDashboard />
    </Suspense>
  );
}
