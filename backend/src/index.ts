/**
 * Serveur Express — skyview backend AROME HD
 *
 * Endpoints :
 *   GET /api/weather?lat=45.19&lng=5.73
 *     → WeatherData (aujourd'hui + demain, profils verticaux 0-5000 m par 100 m)
 *
 *   GET /api/health
 *     → { status, cache, uptime }
 *
 * Cache : TTL configurable via CACHE_TTL_MINUTES (défaut 60 min).
 * Clé de cache : "lat2_lng2_YYYY-MM-DD" (arrondi à 2 décimales ≈ ~1 km)
 */

import express from 'express';
import cors from 'cors';
import { fetchAromeData } from './aromeClient.js';
import { normalize } from './normalizer.js';
import { TTLCache } from './cache.js';
import type { WeatherData } from './types.js';

const PORT             = parseInt(process.env.PORT ?? '3001', 10);
const CACHE_TTL_MS     = parseInt(process.env.CACHE_TTL_MINUTES ?? '60', 10) * 60_000;
const ALLOWED_ORIGINS  = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map(s => s.trim());

const app   = express();
const cache = new TTLCache<WeatherData>(CACHE_TTL_MS);

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: (origin, cb) => {
    // Autoriser les requêtes sans origin (curl, Postman, SSR) et les origines listées
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`Origin non autorisée : ${origin}`));
  },
}));

app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────────────

function cacheKey(lat: number, lng: number): string {
  const today = new Date().toISOString().split('T')[0];
  return `${lat.toFixed(2)}_${lng.toFixed(2)}_${today}`;
}

function parseCoord(raw: unknown, name: string): number {
  const n = parseFloat(String(raw));
  if (isNaN(n)) throw new Error(`Paramètre invalide : ${name}`);
  return n;
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** Données météo pour un point */
app.get('/api/weather', async (req, res) => {
  try {
    const lat = parseCoord(req.query.lat, 'lat');
    const lng = parseCoord(req.query.lng, 'lng');

    const key    = cacheKey(lat, lng);
    const cached = cache.get(key);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.json(cached);
      return;
    }

    console.log(`[AROME] Fetch → lat=${lat} lng=${lng}`);
    const raw  = await fetchAromeData(lat, lng);
    const data = normalize(raw, lat, lng);

    cache.set(key, data);
    res.setHeader('X-Cache', 'MISS');
    res.json(data);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AROME] Erreur :', msg);
    res.status(502).json({ error: msg });
  }
});

/** Santé du service */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    cache: cache.stats(),
    ttlMin: CACHE_TTL_MS / 60_000,
  });
});

// ── Démarrage ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✓ skyview-backend démarré sur http://localhost:${PORT}`);
  console.log(`  Cache TTL : ${CACHE_TTL_MS / 60_000} min`);
  console.log(`  Origins   : ${ALLOWED_ORIGINS.join(', ')}`);
});
