const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveApiBaseUrl, buildApiUrl } = require('./config');

test('resolveApiBaseUrl uses an explicit override when provided', () => {
  assert.equal(resolveApiBaseUrl('http://192.168.1.25:4000'), 'http://192.168.1.25:4000');
});

test('buildApiUrl appends the path to the configured base URL', () => {
  assert.equal(buildApiUrl('/api/auth/login', 'https://example.com'), 'https://example.com/api/auth/login');
});

test('resolveApiBaseUrl falls back to the hosted backend URL', () => {
  assert.equal(resolveApiBaseUrl(), 'https://backend-zeta-bice-10.vercel.app');
});
