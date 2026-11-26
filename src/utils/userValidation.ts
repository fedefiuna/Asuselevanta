import { AdminLevel, AdminUser } from '../types';

/**
 * Normalizes a Paraguayan Cédula de Identidad (C.I.) by removing dots, spaces, and dashes.
 */
export function normalizeCI(raw: string): string {
  return (raw || '').replace(/[\s.-]/g, '').trim();
}

/**
 * Checks whether a normalized or raw C.I. is valid (5 to 10 numeric digits).
 */
export function isValidCI(raw: string): boolean {
  const clean = normalizeCI(raw);
  return /^\d{5,10}$/.test(clean);
}

/**
 * Formats a clean numeric C.I. for display (e.g., 4567890 -> 4.567.890).
 */
export function formatCI(raw: string): string {
  const clean = normalizeCI(raw);
  if (!/^\d+$/.test(clean)) return raw.trim();
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface CitizenRegistrationInput {
  cedula: string;
  fullName: string;
  phone?: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  error?: string;
  data?: T;
}

export function validateCitizenRegistration(
  input: CitizenRegistrationInput
): ValidationResult<{ id: string; ci: string; fullName: string; phone?: string }> {
  const cleanCI = normalizeCI(input.cedula);
  const cleanName = (input.fullName || '').trim();
  const cleanPhone = input.phone?.trim() || undefined;

  if (!cleanCI) {
    return { valid: false, error: 'El número de Cédula de Identidad (C.I.) es obligatorio.' };
  }
  if (!isValidCI(cleanCI)) {
    return {
      valid: false,
      error: 'Ingresa un número de C.I. válido (solo números, entre 5 y 10 dígitos).'
    };
  }
  if (!cleanName || cleanName.length < 3) {
    return { valid: false, error: 'Por favor, ingresa tu Nombre y Apellido para identificarte.' };
  }

  return {
    valid: true,
    data: {
      id: cleanCI,
      ci: cleanCI,
      fullName: cleanName,
      phone: cleanPhone
    }
  };
}

export interface AdminRegistrationInput {
  ci: string;
  employeeNumber: string;
  fullName: string;
  level: AdminLevel;
  password: string;
  email?: string;
}

export function validateAdminRegistration(
  input: AdminRegistrationInput
): ValidationResult<{
  id: string;
  ci: string;
  employeeNumber: string;
  fullName: string;
  level: AdminLevel;
  password: string;
  email?: string;
}> {
  const cleanCI = normalizeCI(input.ci);
  const cleanEmp = (input.employeeNumber || '').trim();
  const cleanName = (input.fullName || '').trim();
  const cleanPassword = (input.password || '').trim();
  const cleanEmail = input.email?.trim().toLowerCase() || undefined;

  if (!cleanCI) {
    return { valid: false, error: 'El número de C.I. es obligatorio (será el ID del perfil).' };
  }
  if (!isValidCI(cleanCI)) {
    return {
      valid: false,
      error: 'El número de C.I. debe contener entre 5 y 10 dígitos numéricos.'
    };
  }
  if (!cleanEmp || cleanEmp.length < 2) {
    return { valid: false, error: 'El número de empleado es obligatorio.' };
  }
  if (!cleanName || cleanName.length < 3) {
    return { valid: false, error: 'El Nombre y Apellido es obligatorio (mínimo 3 caracteres).' };
  }
  if (input.level !== 1 && input.level !== 2) {
    return { valid: false, error: 'Debes seleccionar el Nivel 1 o Nivel 2.' };
  }
  if (!cleanPassword || cleanPassword.length < 4) {
    return { valid: false, error: 'Define una contraseña de acceso de al menos 4 caracteres.' };
  }

  return {
    valid: true,
    data: {
      id: cleanCI,
      ci: cleanCI,
      employeeNumber: cleanEmp,
      fullName: cleanName,
      level: input.level,
      password: cleanPassword,
      email: cleanEmail
    }
  };
}

/**
 * Nivel 1: Solo visualización.
 * Nivel 2: Control completo (puede cambiar estados, solucionar en lote, reabrir, editar bitácora y crear perfiles).
 */
export function canAdminEditReports(admin: AdminUser | null | undefined): boolean {
  return !!admin && admin.level === 2;
}

export function canAdminManageProfiles(admin: AdminUser | null | undefined): boolean {
  return !!admin && admin.level === 2;
}
