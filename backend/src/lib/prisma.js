// backend/src/lib/prisma.js
// ─────────────────────────────────────────────────────────────────────────────
// Single shared PrismaClient instance for the entire app.
// Never instantiate `new PrismaClient()` directly in controllers —
// always import this instead.
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');

let prisma;

if (!global.__prisma) {
  global.__prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });
}

prisma = global.__prisma;

// Warm up the connection pool on startup so the first HTTP request
// doesn't hit a cold Supabase free-tier pause
prisma.$connect()
  .then(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Prisma connected to Supabase');
    }
  })
  .catch((err) => {
    // Log but don't crash — Prisma will auto-retry on the first query
    console.error('❌ Prisma initial connect failed:', err.message);
  });

module.exports = prisma;