const productionFallback = "https://www.chawanfarms.com";

export function resolveAuthBaseUrl(input: {
  configuredUrl?: string;
  appEnvironment: string;
  nodeEnvironment: string;
}): string {
  const isProduction = input.appEnvironment === "production" || input.nodeEnvironment === "production";
  const configuredUrl = input.configuredUrl?.trim();

  if (!configuredUrl) return isProduction ? productionFallback : "http://localhost:3000";

  try {
    const parsed = new URL(configuredUrl);
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (isProduction && (parsed.protocol !== "https:" || isLocal)) return productionFallback;
    return parsed.origin;
  } catch {
    return isProduction ? productionFallback : "http://localhost:3000";
  }
}

export function googleCallbackUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/auth/callback/google`;
}
