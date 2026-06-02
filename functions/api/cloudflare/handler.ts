import type { D1Database, Env } from "../_shared/types";

export type CloudflareDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  getSetting: (db: D1Database, env: unknown, key: string) => Promise<string | undefined>;
};

type CloudflareApiEnvelope = {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: unknown;
};

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function settingValue(deps: CloudflareDeps, db: D1Database, env: Env, key: keyof Env | string) {
  const envValue = stringValue((env as Record<string, unknown>)[key]);
  if (envValue) return envValue;
  return stringValue(await deps.getSetting(db, env, key));
}

function firstCloudflareError(data: CloudflareApiEnvelope) {
  const first = Array.isArray(data.errors) ? data.errors.find((item) => item?.message) : null;
  return first?.message || "Cloudflare API request failed.";
}

async function fetchCloudflareApi(url: string, token: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json().catch(() => ({})) as CloudflareApiEnvelope;
  if (!response.ok || data.success === false) {
    throw new Error(`${firstCloudflareError(data)} HTTP ${response.status}.`);
  }
  return data.result;
}

function deploymentSummary(value: unknown) {
  const deployment = objectValue(value);
  const trigger = objectValue(deployment.deployment_trigger);
  const metadata = objectValue(trigger.metadata);
  const latestStage = objectValue(deployment.latest_stage);
  return {
    id: stringValue(deployment.id),
    url: stringValue(deployment.url),
    environment: stringValue(deployment.environment),
    createdOn: stringValue(deployment.created_on),
    modifiedOn: stringValue(deployment.modified_on),
    status: stringValue(latestStage.status || deployment.stage),
    branch: stringValue(metadata.branch),
    commitHash: stringValue(metadata.commit_hash),
    commitMessage: stringValue(metadata.commit_message),
  };
}

export async function handleCloudflare(deps: CloudflareDeps, request: Request, db: D1Database, env: Env, segments: string[]): Promise<Response> {
  if (request.method !== "GET" || segments[1] !== "pages-logs") {
    return deps.errorJson("Not Found", 404);
  }

  const url = new URL(request.url);
  const accountId = await settingValue(deps, db, env, "CLOUDFLARE_ACCOUNT_ID");
  const projectName = await settingValue(deps, db, env, "CLOUDFLARE_PAGES_PROJECT_NAME");
  const token = await settingValue(deps, db, env, "CLOUDFLARE_PAGES_API_TOKEN")
    || await settingValue(deps, db, env, "CLOUDFLARE_API_TOKEN");
  const missingKeys = [
    ["CLOUDFLARE_ACCOUNT_ID", accountId],
    ["CLOUDFLARE_PAGES_PROJECT_NAME", projectName],
    ["CLOUDFLARE_PAGES_API_TOKEN or CLOUDFLARE_API_TOKEN", token],
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missingKeys.length) {
    return deps.json({
      success: true,
      configured: false,
      missingKeys,
      logs: [],
      docs: {
        deployments: "https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/list/",
        deploymentLogs: "https://developers.cloudflare.com/api/operations/pages-deployment-get-deployment-logs",
      },
    });
  }

  const deploymentIdFromQuery = stringValue(url.searchParams.get("deploymentId"));
  const environment = stringValue(url.searchParams.get("env")) || "production";
  const requestedLimit = Number(url.searchParams.get("limit") || "60");
  const lineLimit = Math.max(1, Math.min(200, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 60));
  const encodedAccount = encodeURIComponent(accountId);
  const encodedProject = encodeURIComponent(projectName);
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${encodedAccount}/pages/projects/${encodedProject}`;

  try {
    let deployment = null as Record<string, unknown> | null;
    let deploymentId = deploymentIdFromQuery;
    if (!deploymentId) {
      const deploymentsUrl = `${baseUrl}/deployments?env=${encodeURIComponent(environment)}&page=1&per_page=1`;
      const deploymentsResult = await fetchCloudflareApi(deploymentsUrl, token);
      const deployments = Array.isArray(deploymentsResult) ? deploymentsResult : [];
      deployment = deployments[0] && typeof deployments[0] === "object" ? deployments[0] as Record<string, unknown> : null;
      deploymentId = stringValue(deployment?.id);
    }
    if (!deploymentId) {
      return deps.json({
        success: true,
        configured: true,
        projectName,
        environment,
        deployment: null,
        logs: [],
        total: 0,
        error: `No ${environment} deployment was returned by Cloudflare Pages.`,
        fetchedAt: new Date().toISOString(),
      });
    }

    const logsUrl = `${baseUrl}/deployments/${encodeURIComponent(deploymentId)}/history/logs`;
    const logsResult = objectValue(await fetchCloudflareApi(logsUrl, token));
    const data = Array.isArray(logsResult.data) ? logsResult.data : [];
    const logs = data
      .map((item) => objectValue(item))
      .map((item) => ({
        ts: stringValue(item.ts),
        line: stringValue(item.line),
      }))
      .filter((item) => item.line)
      .slice(-lineLimit);

    return deps.json({
      success: true,
      configured: true,
      projectName,
      environment,
      deploymentId,
      deployment: deployment ? deploymentSummary(deployment) : { id: deploymentId },
      logs,
      total: Number(logsResult.total || data.length || logs.length),
      includesContainerLogs: logsResult.includes_container_logs === true,
      fetchedAt: new Date().toISOString(),
      source: {
        deploymentsEndpoint: deploymentIdFromQuery ? "" : `/accounts/{account_id}/pages/projects/${projectName}/deployments`,
        logsEndpoint: `/accounts/{account_id}/pages/projects/${projectName}/deployments/${deploymentId}/history/logs`,
      },
    });
  } catch (error) {
    return deps.json({
      success: false,
      configured: true,
      projectName,
      environment,
      deploymentId: deploymentIdFromQuery,
      logs: [],
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString(),
    }, 502);
  }
}
