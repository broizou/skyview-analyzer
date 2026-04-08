/**
 * Cache TTL en mémoire — clé arbitraire, durée configurable.
 * Pas de dépendance externe, nettoyage automatique à l'expiration.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private store = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Retourne des infos de diagnostic */
  stats() {
    let valid = 0;
    const now = Date.now();
    for (const e of this.store.values()) if (e.expiresAt > now) valid++;
    return { total: this.store.size, valid };
  }
}
