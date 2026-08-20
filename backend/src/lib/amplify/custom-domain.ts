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

const MULTI_PART_PUBLIC_SUFFIXES = [
  "com.co",
  "net.co",
  "nom.co",
  "com.mx",
  "com.br",
  "com.ar",
  "com.pe",
  "com.ec",
  "com.cl",
  "co.uk",
  "org.uk",
  "com.au",
];

const SHARED_HOSTING_ROOTS = new Set(["amplifyapp.com", "vercel.app", "netlify.app"]);

function normalizeHost(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .split("/")[0]!
    .split(":")[0]!;
}

export function splitFqdn(domain: string): { rootDomain: string; prefix: string } {
  const host = normalizeHost(domain);
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) {
    throw Object.assign(new Error("Invalid domain"), { statusCode: 400 });
  }

  const suffix = MULTI_PART_PUBLIC_SUFFIXES.find((item) => host === item || host.endsWith(`.${item}`));
  if (suffix) {
    const suffixLabels = suffix.split(".").length;
    if (parts.length <= suffixLabels + 1) {
      return { rootDomain: host, prefix: "" };
    }
    return {
      rootDomain: parts.slice(-(suffixLabels + 1)).join("."),
      prefix: parts.slice(0, -(suffixLabels + 1)).join("."),
    };
  }

  if (parts.length === 2) {
    return { rootDomain: host, prefix: "" };
  }
  return {
    rootDomain: parts.slice(-2).join("."),
    prefix: parts.slice(0, -2).join("."),
  };
}

export function platformFrontendHost(): string {
  return normalizeHost(process.env.FRONTEND_URL ?? "");
}

export function isReservedPlatformDomain(domain: string): boolean {
  const host = normalizeHost(domain);
  const platformHost = platformFrontendHost();
  if (!host || !platformHost) return false;
  if (platformHost === "localhost" || platformHost === "127.0.0.1") return false;
  if (host === platformHost) return true;

  let platformRoot: string;
  let hostRoot: string;
  try {
    platformRoot = splitFqdn(platformHost).rootDomain;
    hostRoot = splitFqdn(host).rootDomain;
  } catch {
    return false;
  }

  if (SHARED_HOSTING_ROOTS.has(platformRoot)) {
    return host === platformHost || host.endsWith(`.${platformHost}`);
  }

  return hostRoot === platformRoot;
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

async function listAllApps(): Promise<Array<{ appId: string; name?: string }>> {
  const client = amplifyClient();
  const apps: Array<{ appId: string; name?: string }> = [];
  let nextToken: string | undefined;
  do {
    const page = await client.send(new ListAppsCommand({ maxResults: 50, nextToken }));
    for (const app of page.apps ?? []) {
      if (app.appId) apps.push({ appId: app.appId, ...(app.name ? { name: app.name } : {}) });
    }
    nextToken = page.nextToken;
  } while (nextToken);
  return apps;
}

async function resolveAppId(): Promise<string> {
  const configured = process.env.AMPLIFY_APP_ID?.trim();
  if (configured) return configured;

  const name = appName();
  const match = (await listAllApps()).find((app) => app.name === name);
  if (match?.appId) return match.appId;

  throw Object.assign(new Error(`Amplify app not found: ${name}`), { statusCode: 500 });
}

async function getAssociation(
  appId: string,
  domainName: string
): Promise<DomainAssociation | null> {
  try {
    const result = await amplifyClient().send(
      new GetDomainAssociationCommand({ appId, domainName })
    );
    return result.domainAssociation ?? null;
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === "NotFoundException") return null;
    throw error;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isDomainTakenByAnotherApp(error: unknown): boolean {
  return /already associated with another Amplify app/i.test(errorMessage(error));
}

function domainConflictError(fqdn: string, detail?: string): Error {
  const suffix = detail ? ` ${detail}` : " Remove it in the AWS Amplify console and try again.";
  return Object.assign(new Error(`Domain ${fqdn} is already associated with another Amplify app.${suffix}`), {
    statusCode: 409,
  });
}

function candidateDomainNames(rootDomain: string, fqdn: string): string[] {
  const names = [rootDomain];
  const host = normalizeHost(fqdn);
  if (host && host !== rootDomain) names.push(host);
  return names;
}

async function findAssociationsOnOtherApps(
  currentAppId: string,
  domainNames: string[]
): Promise<Array<{ appId: string; domainName: string }>> {
  const uniqueNames = [...new Set(domainNames)];
  const found: Array<{ appId: string; domainName: string }> = [];
  const seen = new Set<string>();

  for (const app of await listAllApps()) {
    if (app.appId === currentAppId) continue;
    for (const domainName of uniqueNames) {
      let association: DomainAssociation | null = null;
      try {
        association = await getAssociation(app.appId, domainName);
      } catch (error) {
        console.error(`Failed to read Amplify domain ${domainName} on app ${app.appId}`, error);
        continue;
      }
      if (!association) continue;
      const resolvedName = association.domainName ?? domainName;
      const key = `${app.appId}:${resolvedName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ appId: app.appId, domainName: resolvedName });
    }
  }

  return found;
}

async function reclaimDomainFromOtherApps(
  currentAppId: string,
  rootDomain: string,
  fqdn: string
): Promise<boolean> {
  const conflicts = await findAssociationsOnOtherApps(
    currentAppId,
    candidateDomainNames(rootDomain, fqdn)
  );
  if (conflicts.length === 0) return false;

  const client = amplifyClient();
  for (const conflict of conflicts) {
    await client.send(
      new DeleteDomainAssociationCommand({
        appId: conflict.appId,
        domainName: conflict.domainName,
      })
    );
    console.warn(
      `Released Amplify domain ${conflict.domainName} from app ${conflict.appId} so it can be attached to ${currentAppId}`
    );
  }
  return true;
}

async function createDomainAssociation(
  appId: string,
  fqdn: string,
  rootDomain: string,
  prefix: string,
  branch: string
): Promise<DomainAssociation> {
  const client = amplifyClient();
  const input = {
    appId,
    domainName: rootDomain,
    subDomainSettings: [{ prefix, branchName: branch }],
    enableAutoSubDomain: false,
  };

  try {
    const created = await client.send(new CreateDomainAssociationCommand(input));
    if (!created.domainAssociation) {
      throw Object.assign(new Error("Failed to create Amplify domain association"), {
        statusCode: 500,
      });
    }
    return created.domainAssociation;
  } catch (error) {
    if (!isDomainTakenByAnotherApp(error)) throw error;

    const reclaimed = await reclaimDomainFromOtherApps(appId, rootDomain, fqdn);
    if (!reclaimed) throw domainConflictError(fqdn);

    const retry = async (): Promise<DomainAssociation> => {
      const created = await client.send(new CreateDomainAssociationCommand(input));
      if (!created.domainAssociation) {
        throw Object.assign(new Error("Failed to create Amplify domain association"), {
          statusCode: 500,
        });
      }
      return created.domainAssociation;
    };

    try {
      return await retry();
    } catch (retryError) {
      if (!isDomainTakenByAnotherApp(retryError)) throw retryError;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        return await retry();
      } catch (finalError) {
        if (!isDomainTakenByAnotherApp(finalError)) throw finalError;
        throw domainConflictError(
          fqdn,
          " It was released from another app, but Amplify has not finished detaching it yet. Retry in a few minutes."
        );
      }
    }
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
    const created = await createDomainAssociation(appId, fqdn, rootDomain, prefix, branch);
    return toDnsInfo(created, fqdn, prefix);
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
