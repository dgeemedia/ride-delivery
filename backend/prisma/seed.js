// backend/prisma/seed.js
//
// Creates two pre-approved test accounts:
//   Driver:  driver@diakite.test  / Test1234!
//   Partner: partner@diakite.test / Test1234!
//
// Run from the backend folder:
//   node prisma/seed.js
//   — or —
//   npx prisma db seed      (if "prisma.seed" is set in package.json)

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Config — change credentials here before running
// ─────────────────────────────────────────────────────────────────────────────
const DRIVER = {
  firstName:    'Emeka',
  lastName:     'Okonkwo',
  email:        'driver@diakite.com',
  phone:        '+2348011111111',
  password:     'happen123',

  // Driver profile
  licenseNumber:'LG-DRV-001',
  vehicleType:  'CAR',           // BIKE | CAR | MOTORCYCLE | VAN
  vehicleMake:  'Toyota',
  vehicleModel: 'Camry',
  vehicleYear:  2020,
  vehicleColor: 'Black',
  vehiclePlate: 'LND-432-AA',

  // Lagos Island coords — driver starts online near VI
  currentLat:   6.4281,
  currentLng:   3.4219,
};

const PARTNER = {
  firstName:    'Kunle',
  lastName:     'Balogun',
  email:        'partner@diakite.com',
  phone:        '+2348022222222',
  password:     'happen123',

  // Delivery partner profile
  vehicleType:  'BIKE',          // BIKE | CAR | MOTORCYCLE | VAN
  vehiclePlate: 'LND-221-KJ',

  // Lagos Island coords — partner starts online near Lekki
  currentLat:   6.4433,
  currentLng:   3.5077,
};

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const HASH_ROUNDS = 10;

  console.log('🌱  Seeding test accounts…\n');

  // ── 1. DRIVER ────────────────────────────────────────────────────────────
  const driverPassword = await bcrypt.hash(DRIVER.password, HASH_ROUNDS);

  const driver = await prisma.user.upsert({
    where: { email: DRIVER.email },
    update: {},   // don't overwrite if already exists
    create: {
      firstName:  DRIVER.firstName,
      lastName:   DRIVER.lastName,
      email:      DRIVER.email,
      phone:      DRIVER.phone,
      password:   driverPassword,
      role:       'DRIVER',
      isVerified: true,
      isActive:   true,

      // Wallet created inline
      wallet: {
        create: {
          balance:  5000,   // seed ₦5,000 so earnings screen isn't empty
          currency: 'NGN',
        },
      },

      // Driver profile — isApproved: true skips the review queue
      driverProfile: {
        create: {
          licenseNumber:  DRIVER.licenseNumber,
          vehicleType:    DRIVER.vehicleType,
          vehicleMake:    DRIVER.vehicleMake,
          vehicleModel:   DRIVER.vehicleModel,
          vehicleYear:    DRIVER.vehicleYear,
          vehicleColor:   DRIVER.vehicleColor,
          vehiclePlate:   DRIVER.vehiclePlate,
          licenseImageUrl:'https://placehold.co/400x250/1a1a1a/C9A96E?text=Licence',
          vehicleRegUrl:  'https://placehold.co/400x250/1a1a1a/C9A96E?text=Reg',
          insuranceUrl:   'https://placehold.co/400x250/1a1a1a/C9A96E?text=Insurance',
          isApproved:     true,
          isOnline:       true,
          currentLat:     DRIVER.currentLat,
          currentLng:     DRIVER.currentLng,
          totalRides:     12,
          rating:         4.8,
        },
      },
    },
  });

  console.log(`✅  Driver created`);
  console.log(`    Name  : ${driver.firstName} ${driver.lastName}`);
  console.log(`    Email : ${driver.email}`);
  console.log(`    Phone : ${driver.phone}`);
  console.log(`    Pass  : ${DRIVER.password}`);
  console.log(`    ID    : ${driver.id}\n`);

  // ── 2. DELIVERY PARTNER ───────────────────────────────────────────────────
  const partnerPassword = await bcrypt.hash(PARTNER.password, HASH_ROUNDS);

  const partner = await prisma.user.upsert({
    where: { email: PARTNER.email },
    update: {},
    create: {
      firstName:  PARTNER.firstName,
      lastName:   PARTNER.lastName,
      email:      PARTNER.email,
      phone:      PARTNER.phone,
      password:   partnerPassword,
      role:       'DELIVERY_PARTNER',
      isVerified: true,
      isActive:   true,

      wallet: {
        create: {
          balance:  3000,
          currency: 'NGN',
        },
      },

      deliveryProfile: {
        create: {
          vehicleType:    PARTNER.vehicleType,
          vehiclePlate:   PARTNER.vehiclePlate,
          idImageUrl:     'https://placehold.co/400x250/1a1a1a/C9A96E?text=ID',
          vehicleImageUrl:'https://placehold.co/400x250/1a1a1a/C9A96E?text=Vehicle',
          isApproved:     true,
          isOnline:       true,
          currentLat:     PARTNER.currentLat,
          currentLng:     PARTNER.currentLng,
          totalDeliveries:8,
          rating:         4.6,
        },
      },
    },
  });

  console.log(`✅  Delivery Partner created`);
  console.log(`    Name  : ${partner.firstName} ${partner.lastName}`);
  console.log(`    Email : ${partner.email}`);
  console.log(`    Phone : ${partner.phone}`);
  console.log(`    Pass  : ${PARTNER.password}`);
  console.log(`    ID    : ${partner.id}\n`);

  console.log('🎉  Seed complete. Both accounts are approved and online.');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });