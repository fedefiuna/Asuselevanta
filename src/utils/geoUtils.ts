export interface BarrioCentroid {
  barrio: string;
  lat: number;
  lng: number;
  keywords?: string[];
}

/**
 * Approximate boundary polygon enclosing the municipality of Asunción (Distrito Capital).
 * [lat, lng] vertices in clockwise order following the Río Paraguay and the limits with
 * Mariano Roque Alonso, Luque, Fernando de la Mora, and Lambaré.
 */
export const ASUNCION_BOUNDARY_POLYGON: [number, number][] = [
  [-25.2130, -57.5670], // Viñas Cué / Río Paraguay Norte
  [-25.2250, -57.5500], // Zeballos Cué límite Mariano Roque Alonso
  [-25.2370, -57.5380], // Límite Transchaco / MRA
  [-25.2550, -57.5270], // Límite Luque / Parque Guasú Metropolitano
  [-25.2800, -57.5230], // Avda. Madame Lynch y Santa Teresa (Límite Fernando de la Mora)
  [-25.2950, -57.5300], // Avda. Mariscal López y Calle Última
  [-25.3180, -57.5480], // Avda. Eusebio Ayala y Calle Última
  [-25.3320, -57.5660], // Avda. Fernando de la Mora y Defensores del Chaco (4 Mojones)
  [-25.3480, -57.5950], // Límite Lambaré (Avda. Defensores del Chaco / Arroyo Lambaré)
  [-25.3620, -57.6250], // Límite Lambaré / Cerro Lambaré / Arroyo Lambaré
  [-25.3480, -57.6520], // Itá Enramada / Costa Río Paraguay
  [-25.3200, -57.6620], // Sajonia / Varadero / Río Paraguay
  [-25.2810, -57.6500], // Puerto de Asunción / Bahía
  [-25.2650, -57.6200], // Costanera / Bahía de Asunción
  [-25.2350, -57.5900], // Bañado Norte / Botánico Norte
  [-25.2130, -57.5670]  // Cierre en Viñas Cué
];

/**
 * Checks whether a given latitude and longitude coordinate lies within the
 * municipal limits of the City of Asunción using ray-casting point-in-polygon.
 */
export function isLocationInAsuncion(lat: number, lng: number): boolean {
  // Fast bounding-box check
  // Asunción sits approximately between lat -25.365 to -25.205 and lng -57.675 to -57.515
  if (lat > -25.205 || lat < -25.365 || lng < -57.675 || lng > -57.515) {
    return false;
  }

  // Ray-casting point-in-polygon
  const vs = ASUNCION_BOUNDARY_POLYGON;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export const ASUNCION_BARRIO_CENTROIDS: BarrioCentroid[] = [
  { barrio: 'Villa Morra', lat: -25.2974, lng: -57.5882, keywords: ['villa morra', 'morra', 'mariscal lópez'] },
  { barrio: 'Recoleta', lat: -25.3088, lng: -57.6045, keywords: ['recoleta', 'choferes del chaco', 'cementerio'] },
  { barrio: 'Sajonia', lat: -25.2825, lng: -57.6412, keywords: ['sajonia', 'defensores del chaco', 'estadio'] },
  { barrio: 'San Cristóbal', lat: -25.2985, lng: -57.5682, keywords: ['san cristobal', 'san cristóbal', 'denis roa'] },
  { barrio: 'Carmelitas', lat: -25.2789, lng: -57.5684, keywords: ['carmelitas', 'españa', 'san martín', 'paseo la galería'] },
  { barrio: 'Centro Histórico', lat: -25.2818, lng: -57.6350, keywords: ['centro', 'catedral', 'palma', 'estrella', 'plaza uruguaya', 'costanera'] },
  { barrio: 'Las Mercedes', lat: -25.2890, lng: -57.6180, keywords: ['las mercedes', 'mercedes', 'perú', 'españa'] },
  { barrio: 'Trinidad', lat: -25.2620, lng: -57.5780, keywords: ['trinidad', 'botánico', 'jardín botánico', 'santísima trinidad'] },
  { barrio: 'San Pablo', lat: -25.3210, lng: -57.5790, keywords: ['san pablo', 'abasto', 'mercado abasto', 'de la victoria'] },
  { barrio: 'Vista Alegre', lat: -25.3190, lng: -57.6150, keywords: ['vista alegre', 'fernando de la mora', 'médicos del chaco'] },
  { barrio: 'Los Laureles', lat: -25.3080, lng: -57.5750, keywords: ['los laureles', 'laureles', 'eusebio ayala'] },
  { barrio: 'Mburucuyá', lat: -25.2690, lng: -57.5620, keywords: ['mburucuya', 'mburucuyá', 'primer presidente', 'santa teresa'] },
  { barrio: 'Zeballos Cué', lat: -25.2340, lng: -57.5610, keywords: ['zeballos cue', 'zeballos cué', 'las colinas', 'viñas cue'] },
  { barrio: 'Barrio Obrero', lat: -25.3015, lng: -57.6385, keywords: ['obrero', 'barrio obrero', 'cerro porteño', 'la olla'] },
  { barrio: 'Herrera', lat: -25.2925, lng: -57.5555, keywords: ['herrera', 'lillo', 'madame lynch'] },
  { barrio: 'Bella Vista', lat: -25.2665, lng: -57.6050, keywords: ['bella vista', 'artigas', 'cuba'] },
  { barrio: 'Ciudad Nueva', lat: -25.3020, lng: -57.6180, keywords: ['ciudad nueva', 'kubitschek', 'teodoro s. mongelós'] },
  { barrio: 'Pinozá', lat: -25.3120, lng: -57.6170, keywords: ['pinoza', 'pinozá', 'próceres de mayo'] }
];

/**
 * Calculates Euclidean / approximate spherical distance between two lat/lng coordinates in km.
 */
export function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Accurately finds the closest Asunción neighborhood given latitude and longitude.
 */
export function getEstimatedBarrio(lat: number, lng: number): { barrio: string; distanceKm: number; isInsideAsuncion: boolean } {
  const isInside = isLocationInAsuncion(lat, lng);
  let closest = ASUNCION_BARRIO_CENTROIDS[0];
  let minDistance = Number.MAX_VALUE;

  for (const item of ASUNCION_BARRIO_CENTROIDS) {
    const dist = calculateDistanceKm(lat, lng, item.lat, item.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = item;
    }
  }

  return {
    barrio: isInside ? closest.barrio : `${closest.barrio} (Fuera del Ejido)`,
    distanceKm: Math.round(minDistance * 100) / 100,
    isInsideAsuncion: isInside
  };
}

/**
 * Matches an address string against known Asunción neighborhoods.
 */
export function matchBarrioFromText(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const item of ASUNCION_BARRIO_CENTROIDS) {
    if (lower.includes(item.barrio.toLowerCase())) {
      return item.barrio;
    }
    if (item.keywords) {
      for (const kw of item.keywords) {
        if (lower.includes(kw)) {
          return item.barrio;
        }
      }
    }
  }

  return null;
}

export interface GeocodeResult {
  barrio: string;
  address: string;
  source: 'nominatim' | 'centroid';
  city?: string;
}

/**
 * Pure helper to extract a clean street name / address from a Nominatim address payload,
 * falling back to the representative barrio street when no road is returned.
 */
export function extractStreetAddressFromNominatim(
  addr: Record<string, string | undefined> | null | undefined,
  lat: number,
  lng: number,
  fallbackBarrio: string
): string {
  if (addr) {
    const road = addr.road || addr.pedestrian || addr.footway || addr.street || addr.residential;
    const houseNumber = addr.house_number ? ` N° ${addr.house_number}` : '';
    if (road && road.trim() !== '') {
      return `${road.trim()}${houseNumber}`;
    }
  }
  const cleanBarrio = fallbackBarrio.replace(/\s*\(Fuera del Ejido\)$/, '').trim();
  const barrioStreet = getBarrioAutoAddress(cleanBarrio);
  if (barrioStreet) {
    return barrioStreet;
  }
  return `Punto vial (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

/**
 * Performs reverse geocoding via OpenStreetMap Nominatim with barrio street fallback.
 */
export async function reverseGeocodeAsuncion(lat: number, lng: number, timeoutMs = 3000): Promise<GeocodeResult> {
  const fallback = getEstimatedBarrio(lat, lng);
  const cleanFallbackBarrio = fallback.barrio.replace(/\s*\(Fuera del Ejido\)$/, '').trim();
  const fallbackStreet = getBarrioAutoAddress(cleanFallbackBarrio) || `Punto vial (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  const fallbackResult: GeocodeResult = {
    barrio: fallback.barrio,
    address: fallbackStreet,
    source: 'centroid'
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AsuncionSeLevanta/1.0 (reporte-ciudadano-asuncion)'
      }
    });
    clearTimeout(timer);

    if (!response.ok) {
      return fallbackResult;
    }

    const data = await response.json();
    if (!data || !data.address) {
      return fallbackResult;
    }

    const addr = data.address;
    const suburb = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district;

    // Match barrio from Nominatim response or fallback to closest centroid
    let matchedBarrio = suburb ? matchBarrioFromText(suburb) : null;
    if (!matchedBarrio && data.display_name) {
      matchedBarrio = matchBarrioFromText(data.display_name);
    }
    if (!matchedBarrio) {
      matchedBarrio = fallback.barrio;
    }

    const constructedAddress = extractStreetAddressFromNominatim(addr, lat, lng, matchedBarrio);

    return {
      barrio: matchedBarrio,
      address: constructedAddress,
      source: 'nominatim',
      city: addr.city || 'Asunción'
    };
  } catch (err) {
    // Graceful offline fallback
    return fallbackResult;
  }
}

/**
 * Representative primary streets and notable intersections for all Asunción neighborhoods.
 * Used to automatically populate addresses when a user selects their barrio.
 */
export const BARRIO_PRIMARY_STREETS: Record<string, { mainStreet: string; streets: string[] }> = {
  'Villa Morra': {
    mainStreet: 'Av. Mariscal López c/ Cruz del Defensor',
    streets: [
      'Av. Mariscal López c/ Cruz del Defensor',
      'Av. San Martín c/ Lillo',
      'Senador Long c/ Av. España',
      'Dr. Morra c/ Andrade',
      'Malutín c/ Guido Spano'
    ]
  },
  'Recoleta': {
    mainStreet: 'Av. Choferes del Chaco c/ Av. Mariscal López',
    streets: [
      'Av. Choferes del Chaco c/ Av. Mariscal López',
      'Av. Boggiani c/ R.I. 2 Ytororó',
      'O’Higgins c/ Guido Spano',
      'Av. Eusebio Ayala c/ Choferes del Chaco',
      'Pacheco c/ Charles de Gaulle'
    ]
  },
  'Carmelitas': {
    mainStreet: 'Av. Santa Teresa c/ Av. Aviadores del Chaco',
    streets: [
      'Av. Santa Teresa c/ Av. Aviadores del Chaco',
      'Av. España c/ Av. San Martín',
      'Av. Molas López c/ San Martín',
      'Nuestra Señora del Carmen c/ San Rafael',
      'Dr. Morra c/ Bertoni'
    ]
  },
  'San Cristóbal': {
    mainStreet: 'Av. Denis Roa c/ Moisés Bertoni',
    streets: [
      'Av. Denis Roa c/ Moisés Bertoni',
      'Av. Mariscal López c/ Denis Roa',
      'Guido Spano c/ Coronel Escurra',
      'Del Maestro c/ Bélgica',
      'Lillo c/ Denis Roa'
    ]
  },
  'Centro Histórico': {
    mainStreet: 'Calle Palma c/ 14 de Mayo',
    streets: [
      'Calle Palma c/ 14 de Mayo',
      'Estrella c/ Alberdi',
      'Oliva c/ Chile',
      'Yegros c/ 25 de Mayo',
      'Av. Costanera c/ 15 de Agosto'
    ]
  },
  'Las Mercedes': {
    mainStreet: 'Av. España c/ Av. General Santos',
    streets: [
      'Av. España c/ Av. General Santos',
      'Av. Perú c/ Mariscal Estigarribia',
      'Washington c/ Juan de Salazar',
      'Padre Cardozo c/ Defensa Nacional',
      'Teniente Ruiz c/ San José'
    ]
  },
  'Sajonia': {
    mainStreet: 'Av. Carlos Antonio López c/ Colón',
    streets: [
      'Av. Carlos Antonio López c/ Colón',
      'Comandante Gamarra c/ Mayor Martínez',
      'Capitán Gwynn c/ Alférez Silva',
      'Mallorquín c/ Testanova',
      'Cnel. Lázaro de Rivera c/ Río de la Plata'
    ]
  },
  'San Pablo': {
    mainStreet: 'Av. de la Victoria c/ Av. Eusebio Ayala',
    streets: [
      'Av. de la Victoria c/ Av. Eusebio Ayala',
      'Av. Defensores del Chaco c/ Guatambú',
      'Calle Ybapobó c/ Guatambú',
      'Paso de Patria c/ Cnel. Cazal',
      'Teniente Rolón Votta c/ Av. Fernando de la Mora'
    ]
  },
  'Trinidad': {
    mainStreet: 'Av. Santísima Trinidad c/ Av. Artigas',
    streets: [
      'Av. Santísima Trinidad c/ Av. Artigas',
      'Av. Primer Presidente c/ Itapúa',
      'Av. Santísima Trinidad c/ Sacramento',
      'Capitán Lombardo c/ Vía Férrea',
      'Av. Madame Lynch c/ Sinforiano Buzó'
    ]
  },
  'Barrio Obrero': {
    mainStreet: 'Av. Quinta (Acuña de Figueroa) c/ Antequera',
    streets: [
      'Av. Quinta (Acuña de Figueroa) c/ Antequera',
      'Av. Estados Unidos c/ 21 Proyectadas',
      'México c/ 14 Proyectadas',
      'Caballero c/ 18 Proyectadas',
      'Nuestra Señora de la Asunción c/ 11 Proyectadas'
    ]
  },
  'Herrera': {
    mainStreet: 'Av. Madame Lynch c/ Lillo',
    streets: [
      'Av. Madame Lynch c/ Lillo',
      'Av. Mariscal López c/ Madame Lynch',
      'Denis Roa c/ Sucre',
      'Lillo c/ R.I. 6 Boquerón',
      'Antolín Irala c/ Concejal Vargas'
    ]
  },
  'Mburucuyá': {
    mainStreet: 'Av. Santísima Trinidad c/ Salvador del Mundo',
    streets: [
      'Av. Santísima Trinidad c/ Salvador del Mundo',
      'Av. Primer Presidente c/ Julio Correa',
      'Av. Santísima Trinidad c/ Congreso de Colombia',
      'Capitán Carpinelli c/ Cnel. Alejo Silva'
    ]
  },
  'Los Laureles': {
    mainStreet: 'Av. Eusebio Ayala c/ Av. Boggiani',
    streets: [
      'Av. Eusebio Ayala c/ Av. Boggiani',
      'Av. R.I. 18 Pitiantuta c/ Facundo Machaín',
      'Av. República Argentina c/ Souza',
      'Tte. Zotti c/ Hassler'
    ]
  },
  'Vista Alegre': {
    mainStreet: 'Av. Fernando de la Mora c/ Médicos del Chaco',
    streets: [
      'Av. Fernando de la Mora c/ Médicos del Chaco',
      'Av. Eusebio Ayala c/ Bartolomé de las Casas',
      'Nazareth c/ Guaraníes',
      'Tte. Alcorta c/ 12 de Octubre'
    ]
  },
  'Ciudad Nueva': {
    mainStreet: 'Av. Juscelino Kubitschek c/ Av. Mariscal López',
    streets: [
      'Av. Juscelino Kubitschek c/ Av. Mariscal López',
      'Teodoro S. Mongelós c/ 22 de Septiembre',
      'Cerro Corá c/ Mayor Fleitas',
      'Herminio Giménez c/ Paí Pérez'
    ]
  },
  'Pinozá': {
    mainStreet: 'Av. Próceres de Mayo c/ Av. Fernando de la Mora',
    streets: [
      'Av. Próceres de Mayo c/ Av. Fernando de la Mora',
      'Av. General Santos c/ Pirizal',
      'Calle Battilana c/ Ana Díaz',
      'Tarumá c/ Amancio González'
    ]
  },
  'Bella Vista': {
    mainStreet: 'Av. General José Gervasio Artigas c/ Cusmanich',
    streets: [
      'Av. General José Gervasio Artigas c/ Cusmanich',
      'Av. Venezuela c/ San Salvador',
      'Calle Cuba c/ Cnel. Montiel',
      'Av. Brasilia c/ San Antonio'
    ]
  },
  'Zeballos Cué': {
    mainStreet: 'Av. Carlos Antonio López c/ Las Colinas',
    streets: [
      'Av. Carlos Antonio López c/ Las Colinas',
      'Tte. Claudio Acosta c/ San Ramón',
      'Calle 24 de Junio c/ San Rafael',
      'Cnel. Bóveda c/ Costanera Norte'
    ]
  }
};

/**
 * Returns the default primary street address for a given barrio in Asunción.
 */
export function getBarrioAutoAddress(barrioName: string): string {
  if (!barrioName || barrioName.trim() === '') return '';
  const match = BARRIO_PRIMARY_STREETS[barrioName.trim()];
  if (match) return match.mainStreet;
  return `Av. Principal c/ Cruce de ${barrioName}`;
}

/**
 * Returns list of alternative street suggestions for a selected barrio.
 */
export function getBarrioStreetSuggestions(barrioName: string): string[] {
  if (!barrioName || barrioName.trim() === '') return [];
  const match = BARRIO_PRIMARY_STREETS[barrioName.trim()];
  if (match) return match.streets;
  return [`Intersección principal en ${barrioName}`, `Av. de acceso a ${barrioName}`];
}

/**
 * Looks up centroid coordinates for a given barrio name.
 */
export function getBarrioCentroid(barrioName: string): { lat: number; lng: number } | null {
  if (!barrioName) return null;
  const found = ASUNCION_BARRIO_CENTROIDS.find(
    (b) => b.barrio.toLowerCase().trim() === barrioName.toLowerCase().trim()
  );
  return found ? { lat: found.lat, lng: found.lng } : null;
}

