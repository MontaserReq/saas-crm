const MIN_AUTH_SECRET_LENGTH = 32;
const UNSAFE_SECRET_MARKERS = [
  'change-in-production',
  'replace-with',
  'your-secret',
  'super-secret-jwt-key',
];

export function validateAuthSecret(secret = process.env.AUTH_SECRET): string {
  const value = secret?.trim();
  if (!value) throw new Error('AUTH_SECRET is required');
  if (value.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(`AUTH_SECRET must be at least ${MIN_AUTH_SECRET_LENGTH} characters`);
  }
  const normalized = value.toLowerCase();
  if (UNSAFE_SECRET_MARKERS.some((marker) => normalized.includes(marker))) {
    throw new Error('AUTH_SECRET is not safe for authentication');
  }
  return value;
}

export function getAuthSecret(): string {
  return validateAuthSecret();
}
