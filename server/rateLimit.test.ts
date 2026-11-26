import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from './rateLimit.ts';

test('permite hasta el máximo y luego bloquea, por clave', () => {
  let t = 0;
  const rl = createRateLimiter(2, 1000, () => t);
  assert.equal(rl.take('a'), true);
  assert.equal(rl.take('a'), true);
  assert.equal(rl.take('a'), false);
  assert.equal(rl.take('b'), true);
});

test('la ventana se desliza y sweep limpia claves vencidas', () => {
  let t = 0;
  const rl = createRateLimiter(1, 1000, () => t);
  assert.equal(rl.take('a'), true);
  assert.equal(rl.take('a'), false);
  t = 1001;
  assert.equal(rl.take('a'), true);
  t = 5000;
  rl.sweep();
  assert.equal(rl.take('a'), true);
});
