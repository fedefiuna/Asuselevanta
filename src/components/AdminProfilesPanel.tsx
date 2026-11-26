import React, { useState, useEffect } from 'react';
import { AdminLevel, AdminUser } from '../types';
import { AdminAccountPublic, userStore } from '../store/userStore';
import { canAdminManageProfiles } from '../utils/userValidation';
import {
  UserPlus,
  ShieldCheck,
  Eye,
  CreditCard,
  BadgeCheck,
  User,
  Lock,
  Mail,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users
} from 'lucide-react';

interface Props {
  currentAdmin: AdminUser | null;
}

export const AdminProfilesPanel: React.FC<Props> = ({ currentAdmin }) => {
  const [accounts, setAccounts] = useState<AdminAccountPublic[]>(userStore.getAdminAccounts());
  const [ci, setCi] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [level, setLevel] = useState<AdminLevel>(1);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    userStore.refreshAdminAccounts();
    const unsub = userStore.subscribe(() => {
      setAccounts(userStore.getAdminAccounts());
    });
    return unsub;
  }, []);

  if (!canAdminManageProfiles(currentAdmin)) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsSubmitting(true);

    const res = await userStore.createAdminAccount({
      ci,
      employeeNumber,
      fullName,
      level,
      password,
      email: email || undefined
    });
    setIsSubmitting(false);

    if (!res.success || !res.account) {
      setError(res.error || 'No se pudo crear el perfil administrativo.');
      return;
    }

    setSuccessMsg(
      `Perfil creado: ${res.account.fullName} (ID C.I.: ${res.account.id} • N° Empleado: ${res.account.employeeNumber} • Nivel ${res.account.level}).`
    );
    setCi('');
    setEmployeeNumber('');
    setFullName('');
    setLevel(1);
    setPassword('');
    setEmail('');
  };

  const handleDelete = async (id: string, name: string) => {
    const res = await userStore.deleteAdminAccount(id);
    if (!res.success) {
      setError(res.error || 'No se pudo eliminar el perfil.');
      return;
    }
    setSuccessMsg(`Perfil de ${name} (C.I. ${id}) eliminado.`);
  };

  return (
    <div className="p-5 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-900 dark:text-emerald-200">
          <span className="font-black block text-sm">
            Gestión de Perfiles Administrativos (Exclusivo Nivel 2)
          </span>
          <p className="mt-1 text-emerald-800 dark:text-emerald-300 leading-relaxed">
            Registra nuevos operadores municipales utilizando su <strong>Número de C.I. como ID</strong>,
            su <strong>Número de Empleado</strong> y <strong>Nombre y Apellido</strong>.
            Los perfiles <strong>Nivel 1</strong> tienen acceso de solo visualización; los de <strong>Nivel 2</strong> tienen control total incluyendo la creación de nuevos perfiles.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Create Admin Profile Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 p-5 space-y-4"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/80 dark:border-zinc-800">
            <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
              Registrar Nuevo Perfil Administrativo
            </h4>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="admin-create-ci"
                className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
              >
                Número de C.I. (ID) <span className="text-emerald-500">*</span>
              </label>
              <div className="relative flex items-center">
                <CreditCard className="w-3.5 h-3.5 text-zinc-400 absolute left-3 pointer-events-none" />
                <input
                  id="admin-create-ci"
                  type="text"
                  inputMode="numeric"
                  value={ci}
                  onChange={(e) => {
                    setCi(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Ej. 3216549"
                  required
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-create-emp"
                className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
              >
                N° de Empleado <span className="text-emerald-500">*</span>
              </label>
              <div className="relative flex items-center">
                <BadgeCheck className="w-3.5 h-3.5 text-zinc-400 absolute left-3 pointer-events-none" />
                <input
                  id="admin-create-emp"
                  type="text"
                  value={employeeNumber}
                  onChange={(e) => {
                    setEmployeeNumber(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Ej. EMP-104"
                  required
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-create-name"
              className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Nombre y Apellido <span className="text-emerald-500">*</span>
            </label>
            <div className="relative flex items-center">
              <User className="w-3.5 h-3.5 text-zinc-400 absolute left-3 pointer-events-none" />
              <input
                id="admin-create-name"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Ej. Lic. Valeria Gómez"
                required
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Nivel de Acceso <span className="text-emerald-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setLevel(1)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  level === 1
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-500/20'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black text-zinc-900 dark:text-zinc-100">
                  <Eye className="w-3.5 h-3.5 text-amber-600" />
                  <span>Nivel 1</span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                  Solo visualización de reportes, mapa y métricas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setLevel(2)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  level === 2
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black text-zinc-900 dark:text-zinc-100">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Nivel 2</span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                  Control completo, edición y crear perfiles.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="admin-create-password"
                className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
              >
                Contraseña <span className="text-emerald-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Lock className="w-3.5 h-3.5 text-zinc-400 absolute left-3 pointer-events-none" />
                <input
                  id="admin-create-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Mínimo 4 caracteres"
                  required
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-create-email"
                className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
              >
                Correo <span className="text-zinc-400 font-normal">(Opcional)</span>
              </label>
              <div className="relative flex items-center">
                <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 pointer-events-none" />
                <input
                  id="admin-create-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@asuncion.gov.py"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear Perfil Administrativo</span>
          </button>
        </form>

        {/* Registered Admin Accounts Table */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/60 dark:bg-zinc-900/60">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                Perfiles Administrativos Registrados ({accounts.length})
              </h4>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
              <thead className="bg-zinc-100/70 dark:bg-zinc-800/70 text-[11px] font-bold uppercase text-zinc-600 dark:text-zinc-400 border-b border-zinc-200/80 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3">ID (C.I.)</th>
                  <th className="px-4 py-3">N° Empleado</th>
                  <th className="px-4 py-3">Nombre y Apellido</th>
                  <th className="px-4 py-3">Nivel</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                {accounts.map((acc) => {
                  const isSelf = acc.id === currentAdmin?.id;
                  const isRoot = acc.id === '1000001';
                  return (
                    <tr key={acc.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition">
                      <td className="px-4 py-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {acc.id}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                        {acc.employeeNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <span>{acc.fullName}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] font-black uppercase">
                              Tú
                            </span>
                          )}
                        </div>
                        {acc.email && (
                          <div className="text-[10px] text-zinc-400">{acc.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {acc.level === 2 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-black border border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck className="w-3 h-3" />
                            Nivel 2 • Completo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-black border border-amber-200 dark:border-amber-800">
                            <Eye className="w-3 h-3" />
                            Nivel 1 • Visualización
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isSelf && !isRoot ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(acc.id, acc.fullName)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title={`Eliminar perfil de ${acc.fullName}`}
                            aria-label={`Eliminar perfil de ${acc.fullName}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-400 italic">Protegido</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
