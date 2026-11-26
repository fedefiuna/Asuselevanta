/** Límite de frecuencia en memoria (ventana deslizante). Suficiente para una instancia; con varias, usar Redis/Supabase. */
export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();

  return {
    /** Devuelve true si la acción está permitida y la registra. */
    take(key: string): boolean {
      const t = now();
      const recent = (hits.get(key) || []).filter((ts) => t - ts < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      return true;
    },
    /** Limpia claves vencidas para que el Map no crezca sin límite. */
    sweep() {
      const t = now();
      for (const [k, list] of hits) {
        const recent = list.filter((ts) => t - ts < windowMs);
        if (recent.length === 0) hits.delete(k);
        else hits.set(k, recent);
      }
    }
  };
}
