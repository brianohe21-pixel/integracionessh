import { listTenants } from "../dynamodb/tenant.repository.js";
import { getPlatformBillingConfig } from "../dynamodb/platform-config.repository.js";
import { currentUsagePeriod, getMonthlyUsage } from "../dynamodb/usage.repository.js";
import type { AdminBillingOverview } from "../../types/index.js";

import {
  resolveTenantPricePerMessageCents,
  tenantUsesCustomMessagePrice,
} from "./resolve-message-price.js";

export async function buildAdminBillingOverview(
  period = currentUsagePeriod()
): Promise<AdminBillingOverview> {
  const [config, tenants] = await Promise.all([getPlatformBillingConfig(), listTenants()]);

  const rows = await Promise.all(
    tenants.map(async (tenant) => {
      const usage = await getMonthlyUsage(tenant.tenantId, period);
      const pricePerMessageCents = resolveTenantPricePerMessageCents(
        tenant,
        config.pricePerMessageCents
      );
      const estimatedMessageCostCents = usage.messagesCount * pricePerMessageCents;

      return {
        tenantId: tenant.tenantId,
        name: tenant.name,
        email: tenant.email,
        plan: tenant.plan,
        period,
        messagesCount: usage.messagesCount,
        bulkRecipientsCount: usage.bulkRecipientsCount,
        pricePerMessageCents,
        usesPlatformPrice: !tenantUsesCustomMessagePrice(tenant),
        estimatedMessageCostCents,
      };
    })
  );

  rows.sort((a, b) => b.estimatedMessageCostCents - a.estimatedMessageCostCents);

  const totals = rows.reduce(
    (acc, row) => ({
      messagesCount: acc.messagesCount + row.messagesCount,
      bulkRecipientsCount: acc.bulkRecipientsCount + row.bulkRecipientsCount,
      estimatedMessageCostCents: acc.estimatedMessageCostCents + row.estimatedMessageCostCents,
    }),
    { messagesCount: 0, bulkRecipientsCount: 0, estimatedMessageCostCents: 0 }
  );

  return {
    config,
    period,
    rows,
    totals,
  };
}
