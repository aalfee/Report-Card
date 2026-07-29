import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildApiUrl, resolveApiBaseUrl } from './config';

const API_BASE_URL = resolveApiBaseUrl();

async function fetchJson(pathname, options = {}) {
  const url = buildApiUrl(pathname, API_BASE_URL);
  const timeoutMs = options.timeout || 15000;
  const { timeout, ...requestOptions } = options;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(requestOptions.headers || {}),
      },
      signal: controller ? controller.signal : undefined,
      ...requestOptions,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = data?.message || response.statusText || 'Request failed';
      throw new Error(error);
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('The request timed out. Check your network connection or backend address.');
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function readPersistedSession() {
  try {
    const stored = await AsyncStorage.getItem('walker-session');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

async function persistSession(session) {
  try {
    if (session) {
      await AsyncStorage.setItem('walker-session', JSON.stringify(session));
      return;
    }
    await AsyncStorage.removeItem('walker-session');
  } catch (error) {
    // Ignore storage failures so the app can still run in a limited environment.
  }
}

export async function login(email, password) {
  const result = await fetchJson('/api/auth/login', {
    method: 'POST',
    timeout: 15000,
    body: JSON.stringify({ email, password }),
  });

  await persistSession({ token: result?.token, user: result?.user, email });
  return result;
}

export async function saveWalk(token, payload) {
  const response = await fetch(buildApiUrl('/api/walks', API_BASE_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: 20000,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to save walk');
  }

  return data;
}

export async function getWalks(token) {
  return fetchJson('/api/walks', {
    method: 'GET',
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getDocuments() {
  return fetchJson('/api/documents', {
    method: 'GET',
    timeout: 15000,
  });
}

export async function getDocumentById(documentId) {
  return fetchJson(`/api/documents/${documentId}`, {
    method: 'GET',
    timeout: 15000,
  });
}

export async function getStoredSession() {
  return readPersistedSession();
}

export async function clearStoredSession() {
  await persistSession(null);
}
