export interface BaiduCredentials {
  appKey: string;
  secretKey: string;
  redirectUri: string;
}
let current: BaiduCredentials = { appKey: "", secretKey: "", redirectUri: "oob" };
export function configureBaidu(config?: BaiduCredentials): void {
  if (config) current = config;
}
export function credentials(): BaiduCredentials {
  return current;
}
