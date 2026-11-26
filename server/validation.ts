import type { IncidentCategory, IncidentSeverity } from '../src/types.ts';
import { isLocationInAsuncion } from '../src/utils/geoUtils.ts';

export const CATEGORIES: IncidentCategory[] = ['Bache', 'Badén en mal estado', 'Alcantarilla sin tapa', 'Suciedad / Basura'];
export const SEVERITIES: IncidentSeverity[] = ['Baja', 'Media', 'Alta', 'Crítica'];

export const LIMITS = {
  description: 1000,
  address: 200,
  barrio: 80,
  name: 120,
  phone: 30,
  // Tope del data-URL (~1.5 MB de imagen real en base64). El cliente comprime antes de enviar.
  photoChars: 2_000_000
};

// Fotos de muestra de la demo (el formulario preselecciona una). Desactivar en producción.
const SAMPLE_PHOTO_HOSTS = ['images.unsplash.com'];

export interface ValidatedReportInput {
  category: IncidentCategory;
  severity: IncidentSeverity;
  description: string;
  photoUrl: string;
  location: { lat: number; lng: number; address: string; barrio: string };
  citizenId?: string;
  citizenName: string;
  citizenPhone?: string;
}

export type ValidationResult =
  | { ok: true; data: ValidatedReportInput }
  | { ok: false; error: string };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Verifica la firma binaria para que "data:image/png" no sea solo una etiqueta. */
function hasImageSignature(dataUrl: string): boolean {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return false;
  const head = Buffer.from(m[2].slice(0, 24), 'base64');
  if (m[1] === 'jpeg') return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (m[1] === 'png') return head.subarray(0, 4).toString('hex') === '89504e47';
  return head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP';
}

export function validatePhoto(photoUrl: unknown, allowSamplePhotos: boolean): string | null {
  if (typeof photoUrl !== 'string' || !photoUrl) return 'Falta la fotografía del reporte.';
  if (photoUrl.startsWith('data:')) {
    if (photoUrl.length > LIMITS.photoChars) return 'La fotografía es demasiado pesada. Intenta con una imagen más liviana.';
    return hasImageSignature(photoUrl) ? null : 'La fotografía debe ser una imagen JPG, PNG o WEBP válida.';
  }
  if (allowSamplePhotos) {
    try {
      const u = new URL(photoUrl);
      if (u.protocol === 'https:' && SAMPLE_PHOTO_HOSTS.includes(u.hostname)) return null;
    } catch {
      // cae al error genérico
    }
  }
  return 'La fotografía debe ser una imagen JPG, PNG o WEBP válida.';
}

export function validateReportInput(body: unknown, opts: { allowSamplePhotos?: boolean } = {}): ValidationResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, any>;

  const category = b.category as IncidentCategory;
  if (!CATEGORIES.includes(category)) return { ok: false, error: 'Categoría inválida.' };

  const severity = (b.severity ?? 'Media') as IncidentSeverity;
  if (!SEVERITIES.includes(severity)) return { ok: false, error: 'Severidad inválida.' };

  const photoError = validatePhoto(b.photoUrl, opts.allowSamplePhotos ?? false);
  if (photoError) return { ok: false, error: photoError };

  const loc = (b.location && typeof b.location === 'object' ? b.location : {}) as Record<string, unknown>;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isLocationInAsuncion(lat, lng)) {
    return { ok: false, error: 'La ubicación debe estar dentro de la ciudad de Asunción.' };
  }

  const barrio = str(loc.barrio);
  if (!barrio || barrio.length > LIMITS.barrio) return { ok: false, error: 'Barrio inválido.' };

  const citizenName = str(b.citizenName);
  if (!citizenName || citizenName.length > LIMITS.name) return { ok: false, error: 'Nombre del ciudadano inválido.' };

  const description = str(b.description);
  if (description.length > LIMITS.description) return { ok: false, error: 'La descripción es demasiado larga.' };

  const address = str(loc.address);
  if (address.length > LIMITS.address) return { ok: false, error: 'La dirección es demasiado larga.' };

  const citizenPhone = str(b.citizenPhone);
  if (citizenPhone.length > LIMITS.phone) return { ok: false, error: 'Teléfono inválido.' };

  return {
    ok: true,
    data: {
      category,
      severity,
      description,
      photoUrl: b.photoUrl,
      location: { lat, lng, address, barrio },
      citizenId: str(b.citizenId) || undefined,
      citizenName,
      citizenPhone: citizenPhone || undefined
    }
  };
}
