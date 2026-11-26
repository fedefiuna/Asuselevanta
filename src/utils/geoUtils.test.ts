import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getEstimatedBarrio, 
  calculateDistanceKm, 
  matchBarrioFromText,
  isLocationInAsuncion,
  getBarrioAutoAddress,
  getBarrioStreetSuggestions,
  extractStreetAddressFromNominatim
} from './geoUtils.js';

test('getEstimatedBarrio accurately identifies known Asunción points', () => {
  // Villa Morra coordinates
  const villaMorra = getEstimatedBarrio(-25.2974, -57.5882);
  assert.equal(villaMorra.barrio, 'Villa Morra');
  assert.ok(villaMorra.distanceKm < 0.1);

  // Sajonia (near Defensores del Chaco stadium)
  const sajonia = getEstimatedBarrio(-25.2825, -57.6412);
  assert.equal(sajonia.barrio, 'Sajonia');

  // Centro Histórico (near Palma and Plaza Uruguaya)
  const centro = getEstimatedBarrio(-25.2818, -57.6350);
  assert.equal(centro.barrio, 'Centro Histórico');

  // Recoleta
  const recoleta = getEstimatedBarrio(-25.3088, -57.6045);
  assert.equal(recoleta.barrio, 'Recoleta');

  // Carmelitas (near España & San Martín)
  const carmelitas = getEstimatedBarrio(-25.2789, -57.5684);
  assert.equal(carmelitas.barrio, 'Carmelitas');
});

test('calculateDistanceKm calculates sensible geographic distances', () => {
  // Distance between Villa Morra and Sajonia should be ~5-6 km
  const dist = calculateDistanceKm(-25.2974, -57.5882, -25.2825, -57.6412);
  assert.ok(dist > 4 && dist < 8);

  // Same coordinates should have 0 distance
  const zeroDist = calculateDistanceKm(-25.2974, -57.5882, -25.2974, -57.5882);
  assert.equal(Math.round(zeroDist), 0);
});

test('matchBarrioFromText matches barrio names from textual addresses', () => {
  assert.equal(matchBarrioFromText('Av. Mariscal López c/ San Roque, Barrio Villa Morra'), 'Villa Morra');
  assert.equal(matchBarrioFromText('Calle Palma y Chile, microcentro'), 'Centro Histórico');
  assert.equal(matchBarrioFromText('Defensores del Chaco'), 'Sajonia');
  assert.equal(matchBarrioFromText('Avenida Santísima Trinidad'), 'Trinidad');
  assert.equal(matchBarrioFromText('Dirección desconocida sin barrio'), null);
});

test('isLocationInAsuncion accurately discriminates points inside vs outside Asuncion', () => {
  // Points INSIDE Asunción
  assert.equal(isLocationInAsuncion(-25.2974, -57.5882), true, 'Villa Morra should be inside Asunción');
  assert.equal(isLocationInAsuncion(-25.2818, -57.6350), true, 'Centro Histórico should be inside Asunción');
  assert.equal(isLocationInAsuncion(-25.2825, -57.6412), true, 'Sajonia should be inside Asunción');
  assert.equal(isLocationInAsuncion(-25.2620, -57.5780), true, 'Trinidad should be inside Asunción');
  assert.equal(isLocationInAsuncion(-25.3210, -57.5790), true, 'San Pablo should be inside Asunción');

  // Points OUTSIDE Asunción (Neighboring municipalities or far away)
  assert.equal(isLocationInAsuncion(-25.3390, -57.5090), false, 'San Lorenzo should be outside Asunción');
  assert.equal(isLocationInAsuncion(-25.2690, -57.4890), false, 'Luque center should be outside Asunción');
  assert.equal(isLocationInAsuncion(-25.3750, -57.6100), false, 'Lambaré deep south should be outside Asunción');
  assert.equal(isLocationInAsuncion(-25.1850, -57.5300), false, 'Mariano Roque Alonso north should be outside Asunción');
  assert.equal(isLocationInAsuncion(-25.2700, -57.7000), false, 'Chaco / Río Paraguay far west should be outside Asunción');
  assert.equal(isLocationInAsuncion(-34.6037, -58.3816), false, 'Buenos Aires should definitely be outside Asunción');
});

test('getBarrioAutoAddress and getBarrioStreetSuggestions return correct streets for Asunción barrios', () => {
  const vmStreet = getBarrioAutoAddress('Villa Morra');
  assert.ok(vmStreet.includes('Mariscal López'));

  const centroStreet = getBarrioAutoAddress('Centro Histórico');
  assert.ok(centroStreet.includes('Palma'));

  const sajoniaStreet = getBarrioAutoAddress('Sajonia');
  assert.ok(sajoniaStreet.includes('Carlos Antonio López'));

  const suggestions = getBarrioStreetSuggestions('Recoleta');
  assert.ok(suggestions.length >= 3);
  assert.ok(suggestions.some(s => s.includes('Choferes del Chaco')));

  // Graceful empty input
  assert.equal(getBarrioAutoAddress(''), '');
  assert.deepEqual(getBarrioStreetSuggestions(''), []);
});

test('extractStreetAddressFromNominatim extracts road and house number from map reverse geocode', () => {
  const streetWithNum = extractStreetAddressFromNominatim(
    { road: 'Avenida Mariscal López', house_number: '2540' },
    -25.2974,
    -57.5882,
    'Villa Morra'
  );
  assert.equal(streetWithNum, 'Avenida Mariscal López N° 2540');

  const pedestrianStreet = extractStreetAddressFromNominatim(
    { pedestrian: 'Calle Palma' },
    -25.2818,
    -57.6350,
    'Centro Histórico'
  );
  assert.equal(pedestrianStreet, 'Calle Palma');

  const fallbackStreet = extractStreetAddressFromNominatim(
    { suburb: 'Recoleta' },
    -25.3088,
    -57.6045,
    'Recoleta'
  );
  assert.ok(fallbackStreet.includes('Choferes del Chaco'));
});


