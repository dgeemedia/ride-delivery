// test-prisma.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const userCount = await prisma.user.count();
    console.log('SUCCESS - Connected to Supabase!');
    console.log('Users in DB:', userCount);

    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('\nTables found in Supabase:');
    tables.forEach(t => console.log(' -', t.table_name));

  } catch (err) {
    console.log('FAILED:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();