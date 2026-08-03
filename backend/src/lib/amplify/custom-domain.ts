import {
  AmplifyClient,
  CreateDomainAssociationCommand,
  DeleteDomainAssociationCommand,
  GetDomainAssociationCommand,
  ListAppsCommand,
  UpdateDomainAssociationCommand,
  type DomainAssociation,
  type SubDomainSetting,
} from "@aws-sdk/client-amplify";

export interface DomainDnsRecord {
  type: string;
  name: string;
  value: string;
  purpose: "certificate" | "subdomain";
}

export interface ResellerDomainDnsInfo {
  rootDomain: string;
  prefix: string;
  domainStatus: string;
  statusReason?: string;
  subdomainVerified: boolean;
  ready: boolean;
  cnameTarget: string;
  dnsRecords: DomainDnsRecord[];
}

function amplifyClient(): AmplifyClient {
  return new AmplifyClient({});
}

function branchName(): string {
  const branch = process.env.AMPLIFY_BRANCH_NAME?.trim();
  if (!branch) {
    throw Object.assign(new Error("AMPLIFY_BRANCH_NAME is not configured"), {
      statusCode: 500,
    });
  }
  return branch;
}

function appName(): string {
  const name = process.env.AMPLIFY_APP_NAME?.trim();
  if (!name) {
    throw Object.assign(new Error("AMPLIFY_APP_NAME is not configured"), {
      statusCode: 500,
    });
  }
  return name;
}

export function splitFqdn(domain: string): { rootDomain: string; prefix: string } {
  const host = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) {
    throw Object.assign(new Error("Invalid domain"), { statusCode: 400 });
  }
  if (parts.length === 2) {
    return { rootDomain: host, prefix: "" };
  }
  return {
    rootDomain: parts.slice(-2).join("."),
    prefix: parts.slice(0, -2).join("."),
  };
}

function parseDnsLine(line: string | undefined, purpose: DomainDnsRecord["purpose"]): DomainDnsRecord | null {
  if (!line?.trim()) return null;
  const parts = line.trim().split(/\s+/).filter(Boolean);
  const types = new Set(["CNAME", "A", "AAAA", "TXT", "ALIAS"]);

  if (parts.length >= 3) {
    const first = parts[0]!.toUpperCase();
    const second = parts[1]!.toUpperCase();

    // Amplify format: "omnichannel CNAME dxxx.cloudfront.net"
    if (types.has(second)) {
      return {
        type: second,
        name: parts[0]!.replace(/\.$/, ""),
        value: parts.slice(2).join(" ").replace(/\.$/, ""),
        purpose,
      };
    }

    // Alternate format: "CNAME omnichannel dxxx.cloudfront.net"
    if (types.has(first)) {
      return {
        type: first,
        name: parts[1]!.replace(/\.$/, ""),
        value: parts.slice(2).join(" ").replace(/\.$/, ""),
        purpose,
      };
    }
  }

  if (parts.length === 2) {
    return {
      type: "CNAME",
      name: parts[0]!.replace(/\.$/, ""),
      value: parts[1]!.replace(/\.$/, ""),
      purpose,
    };
  }

  return null;
}

function extractCnameTarget(dnsRecord: string | undefined, fqdn: string): string {
  const parsed = parseDnsLine(dnsRecord, "subdomain");
  if (parsed?.value) return parsed.value.replace(/\.$/, "");
  return (process.env.FRONTEND_URL ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "") || fqdn;
}

function toDnsInfo(association: DomainAssociation, fqdn: string, prefix: string): ResellerDomainDnsInfo {
  const sub = (association.subDomains ?? []).find(
    (s) => (s.subDomainSetting?.prefix ?? "") === prefix
  );
  const certLine =
    association.certificateVerificationDNSRecord ??
    association.certificate?.certificateVerificationDNSRecord;
  const dnsRecords: DomainDnsRecord[] = [];
  const cert = parseDnsLine(certLine, "certificate");
  if (cert) dnsRecords.push(cert);
  const subRecord = parseDnsLine(sub?.dnsRecord, "subdomain");
  if (subRecord) dnsRecords.push(subRecord);

  const domainStatus = association.domainStatus ?? "UNKNOWN";
  const subdomainVerified = Boolean(sub?.verified);

  return {
    rootDomain: association.domainName ?? splitFqdn(fqdn).rootDomain,
    prefix,
    domainStatus,
    ...(association.statusReason ? { statusReason: association.statusReason } : {}),
    subdomainVerified,
    ready: domainStatus === "AVAILABLE" && subdomainVerified,
    cnameTarget: extractCnameTarget(sub?.dnsRecord, fqdn),
    dnsRecords,
  };
}

async function resolveAppId(): Promise<string> {
  const configured = process.env.AMPLIFY_APP_ID?.trim();
  if (configured) return configured;

  const name = appName();
  const client = amplifyClient();
  let nextToken: string | undefined;
  do {
    const page = await client.send(new ListAppsCommand({ maxResults: 50, nextToken }));
    const match = (page.apps ?? []).find((app) => app.name === name);
    if (match?.appId) return match.appId;
    nextToken = page.nextToken;
  } while (nextToken);

  throw Object.assign(new Error(`Amplify app not found: ${name}`), { statusCode: 500 });
}

async function getAssociation(
  appId: string,
  rootDomain: string
): Promise<DomainAssociation | null> {
  try {
    const result = await amplifyClient().send(
      new GetDomainAssociationCommand({ appId, domainName: rootDomain })
    );
    return result.domainAssociation ?? null;
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === "NotFoundException") return null;
    throw error;
  }
}

function withPrefix(settings: SubDomainSetting[], prefix: string, branch: string): SubDomainSetting[] {
  const without = settings.filter((s) => (s.prefix ?? "") !== prefix);
  return [...without, { prefix, branchName: branch }];
}

function withoutPrefix(settings: SubDomainSetting[], prefix: string): SubDomainSetting[] {
  return settings.filter((s) => (s.prefix ?? "") !== prefix);
}

export async function ensureResellerDomainInAmplify(fqdn: string): Promise<ResellerDomainDnsInfo> {
  const { rootDomain, prefix } = splitFqdn(fqdn);
  const appId = await resolveAppId();
  const branch = branchName();
  const client = amplifyClient();
  const existing = await getAssociation(appId, rootDomain);

  if (!existing) {
    const created = await client.send(
      new CreateDomainAssociationCommand({
        appId,
        domainName: rootDomain,
        subDomainSettings: [{ prefix, branchName: branch }],
        enableAutoSubDomain: false,
      })
    );
    if (!created.domainAssociation) {
      throw Object.assign(new Error("Failed to create Amplify domain association"), {
        statusCode: 500,
      });
    }
    return toDnsInfo(created.domainAssociation, fqdn, prefix);
  }

  const currentSettings: SubDomainSetting[] = (existing.subDomains ?? []).map((s) => ({
    prefix: s.subDomainSetting?.prefix ?? "",
    branchName: s.subDomainSetting?.branchName ?? branch,
  }));
  const hasPrefix = currentSettings.some((s) => (s.prefix ?? "") === prefix);
  if (hasPrefix) {
    return toDnsInfo(existing, fqdn, prefix);
  }

  const updated = await client.send(
    new UpdateDomainAssociationCommand({
      appId,
      domainName: rootDomain,
      subDomainSettings: withPrefix(currentSettings, prefix, branch),
      enableAutoSubDomain: existing.enableAutoSubDomain,
    })
  );
  if (!updated.domainAssociation) {
    throw Object.assign(new Error("Failed to update Amplify domain association"), {
      statusCode: 500,
    });
  }
  return toDnsInfo(updated.domainAssociation, fqdn, prefix);
}

export async function getResellerDomainDnsInfo(fqdn: string): Promise<ResellerDomainDnsInfo | null> {
  const { rootDomain, prefix } = splitFqdn(fqdn);
  const appId = await resolveAppId();
  const association = await getAssociation(appId, rootDomain);
  if (!association) return null;
  return toDnsInfo(association, fqdn, prefix);
}

export async function removeResellerDomainFromAmplify(fqdn: string): Promise<void> {
  const { rootDomain, prefix } = splitFqdn(fqdn);
  const appId = await resolveAppId();
  const client = amplifyClient();
  const existing = await getAssociation(appId, rootDomain);
  if (!existing) return;

  const branch = branchName();
  const currentSettings: SubDomainSetting[] = (existing.subDomains ?? []).map((s) => ({
    prefix: s.subDomainSetting?.prefix ?? "",
    branchName: s.subDomainSetting?.branchName ?? branch,
  }));
  const remaining = withoutPrefix(currentSettings, prefix);
  if (remaining.length === 0) {
    await client.send(
      new DeleteDomainAssociationCommand({ appId, domainName: rootDomain })
    );
    return;
  }
  if (remaining.length === currentSettings.length) return;

  await client.send(
    new UpdateDomainAssociationCommand({
      appId,
      domainName: rootDomain,
      subDomainSettings: remaining,
      enableAutoSubDomain: existing.enableAutoSubDomain,
    })
  );
}
