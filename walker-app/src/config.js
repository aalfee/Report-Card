const DEFAULT_API_BASE_URL = 'https://backend-zeta-bice-10.vercel.app';

function getExpoApiBaseUrl() {
  try {
    const constants = require('expo-constants');
    return constants?.expoConfig?.extra?.apiBaseUrl || constants?.manifest2?.extra?.apiBaseUrl || null;
  } catch (error) {
    return null;
  }
}

function resolveApiBaseUrl(explicitBaseUrl) {
  const fromEnv = explicitBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || getExpoApiBaseUrl();
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, '');
  }
  return DEFAULT_API_BASE_URL;
}

function buildApiUrl(pathname, explicitBaseUrl) {
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${resolveApiBaseUrl(explicitBaseUrl)}${normalizedPathname}`;
}

module.exports = {
  DEFAULT_API_BASE_URL,
  resolveApiBaseUrl,
  buildApiUrl,
};
