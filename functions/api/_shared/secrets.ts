export const SECRET_PRESENT = "••••••••";

export function isCredentialSetting(key: string): boolean {
  return /(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)(?:_|$)/i.test(key);
}
