import { AdminLevel, AdminUser, CitizenUser } from '../types';

export interface AdminAccountPublic {
  id: string; // C.I.
  ci: string;
  employeeNumber: string;
  fullName: string;
  email?: string;
  level: AdminLevel;
  role: 'analista' | 'supervisor' | 'administrador';
  createdAt: string;
  createdBy?: string;
}

const CITIZEN_TOKEN_KEY = 'asuncion_citizen_session_token';
const ADMIN_TOKEN_KEY = 'asuncion_admin_session_token';

function readSessionToken(key: string): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
}

function writeSessionToken(key: string, token: string | null) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (token) {
        sessionStorage.setItem(key, token);
      } else {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

let citizenState: CitizenUser | null = null;
let adminState: AdminUser | null = null;
let adminAccountsState: AdminAccountPublic[] = [];
let citizenTokenState: string | null = readSessionToken(CITIZEN_TOKEN_KEY);
let adminTokenState: string | null = readSessionToken(ADMIN_TOKEN_KEY);

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (adminTokenState) {
    headers['Authorization'] = `Bearer ${adminTokenState}`;
  }
  if (citizenTokenState) {
    headers['X-Citizen-Token'] = citizenTokenState;
  }
  return headers;
}

async function hydrateFromSqlite() {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  try {
    const headers = getAuthHeaders();
    const [citRes, admRes] = await Promise.all([
      fetch('/api/citizens/me', { headers, credentials: 'include' }),
      fetch('/api/admins/me', { headers, credentials: 'include' })
    ]);

    if (citRes.ok) {
      const citData = await citRes.json();
      citizenState = citData.citizen || null;
    }
    if (admRes.ok) {
      const admData = await admRes.json();
      adminState = admData.admin || null;
    }
    notify();
    if (adminState) {
      await userStore.refreshAdminAccounts();
    }
  } catch (err) {
    console.error('Error hydrating session from SQLite:', err);
  }
}

let initPromise: Promise<void> | null = null;

export const userStore = {
  init(): Promise<void> {
    if (!initPromise) {
      initPromise = hydrateFromSqlite();
    }
    return initPromise;
  },

  getCitizen(): CitizenUser | null {
    return citizenState;
  },

  async setCitizen(cedula: string, fullName: string, phone?: string): Promise<CitizenUser> {
    const res = await fetch('/api/citizens/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      credentials: 'include',
      body: JSON.stringify({ cedula, fullName, phone })
    });

    const data = await res.json();
    if (!res.ok || !data.citizen) {
      throw new Error(data.error || 'No se pudo registrar el ciudadano en SQLite.');
    }

    citizenState = data.citizen;
    if (data.token) {
      citizenTokenState = data.token;
      writeSessionToken(CITIZEN_TOKEN_KEY, data.token);
    }
    notify();
    return data.citizen;
  },

  async clearCitizen(): Promise<void> {
    try {
      await fetch('/api/citizens/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
    } catch {
      // ignore
    }
    citizenState = null;
    citizenTokenState = null;
    writeSessionToken(CITIZEN_TOKEN_KEY, null);
    notify();
  },

  getAdmin(): AdminUser | null {
    return adminState;
  },

  getAdminAccounts(): AdminAccountPublic[] {
    return adminAccountsState;
  },

  async refreshAdminAccounts(): Promise<AdminAccountPublic[]> {
    if (!adminState && !adminTokenState) {
      adminAccountsState = [];
      return adminAccountsState;
    }
    try {
      const res = await fetch('/api/admins', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        adminAccountsState = Array.isArray(data.accounts) ? data.accounts : [];
        notify();
      }
    } catch (err) {
      console.error('Error loading admin accounts from SQLite:', err);
    }
    return adminAccountsState;
  },

  async createAdminAccount(input: {
    ci: string;
    employeeNumber: string;
    fullName: string;
    level: AdminLevel;
    password: string;
    email?: string;
  }): Promise<{ success: boolean; error?: string; account?: AdminAccountPublic }> {
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(input)
      });
      const data = await res.json();
      if (!res.ok || !data.account) {
        return { success: false, error: data.error || 'No se pudo crear el perfil administrativo.' };
      }

      adminAccountsState = [data.account, ...adminAccountsState];
      notify();
      return { success: true, account: data.account };
    } catch {
      return { success: false, error: 'Error de conexión con el servidor SQLite.' };
    }
  },

  async deleteAdminAccount(targetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/admins/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'No se pudo eliminar el perfil.' };
      }
      adminAccountsState = adminAccountsState.filter((a) => a.id !== targetId);
      notify();
      return { success: true };
    } catch {
      return { success: false, error: 'Error de conexión con el servidor SQLite.' };
    }
  },

  async loginAdmin(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string; admin?: AdminUser }> {
    try {
      const res = await fetch('/api/admins/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (!res.ok || !data.admin) {
        return {
          success: false,
          error: data.error || 'Credenciales no autorizadas.'
        };
      }

      adminState = data.admin;
      if (data.token) {
        adminTokenState = data.token;
        writeSessionToken(ADMIN_TOKEN_KEY, data.token);
      }
      await this.refreshAdminAccounts();
      notify();
      return { success: true, admin: data.admin };
    } catch {
      return {
        success: false,
        error: 'Error de conexión con el servidor SQLite.'
      };
    }
  },

  async logoutAdmin(): Promise<void> {
    try {
      await fetch('/api/admins/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
    } catch {
      // ignore
    }
    adminState = null;
    adminAccountsState = [];
    adminTokenState = null;
    writeSessionToken(ADMIN_TOKEN_KEY, null);
    notify();
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};

if (typeof window !== 'undefined') {
  userStore.init();
}
