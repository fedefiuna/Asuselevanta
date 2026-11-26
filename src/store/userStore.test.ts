import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthHeaders, userStore } from './userStore';

function mockSessionStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, String(val));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      }
    }
  });
}

test('userStore authenticates admin and attaches Bearer token from API without localStorage', async () => {
  mockSessionStorage();
  const originalFetch = globalThis.fetch;

  const calls: Array<{ url: string; method: string; headers?: Record<string, string> }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    calls.push({
      url,
      method,
      headers: (init?.headers as Record<string, string>) || {}
    });

    if (url === '/api/admins/login') {
      return new Response(
        JSON.stringify({
          token: 'adm-token-xyz',
          admin: {
            id: '1000001',
            ci: '1000001',
            employeeNumber: 'EMP-001',
            fullName: 'Ing. Mario Arzamendia',
            email: 'admin@asuncion.gov.py',
            level: 2,
            role: 'administrador'
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url === '/api/admins' && method === 'GET') {
      return new Response(
        JSON.stringify({
          accounts: [
            {
              id: '1000001',
              ci: '1000001',
              employeeNumber: 'EMP-001',
              fullName: 'Ing. Mario Arzamendia',
              level: 2,
              role: 'administrador',
              createdAt: '2026-01-01T00:00:00.000Z'
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url === '/api/admins/logout') {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }) as typeof fetch;

  try {
    const res = await userStore.loginAdmin('1000001', 'admin123');
    assert.equal(res.success, true);
    assert.equal(res.admin?.id, '1000001');
    assert.equal(getAuthHeaders().Authorization, 'Bearer adm-token-xyz');
    assert.equal(userStore.getAdminAccounts().length, 1);

    await userStore.logoutAdmin();
    assert.equal(userStore.getAdmin(), null);
    assert.equal(getAuthHeaders().Authorization, undefined);
    assert.ok(calls.some((c) => c.url === '/api/admins/login' && c.method === 'POST'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('userStore registers citizen via SQLite API and sets X-Citizen-Token header', async () => {
  mockSessionStorage();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/citizens/register') {
      return new Response(
        JSON.stringify({
          token: 'cit-token-123',
          citizen: {
            id: '4567890',
            cedula: '4567890',
            fullName: 'Carlos Benítez',
            phone: '0981 123 456',
            createdAt: '2026-04-10T10:00:00.000Z'
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url === '/api/citizens/logout') {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'Unexpected call' }), { status: 500 });
  }) as typeof fetch;

  try {
    const citizen = await userStore.setCitizen('4.567.890', 'Carlos Benítez', '0981 123 456');
    assert.equal(citizen.id, '4567890');
    assert.equal(getAuthHeaders()['X-Citizen-Token'], 'cit-token-123');

    await userStore.clearCitizen();
    assert.equal(userStore.getCitizen(), null);
    assert.equal(getAuthHeaders()['X-Citizen-Token'], undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
