/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  PrismaClient,
  UserRole,
  PowerType,
  AssetStatus,
  ProductStatus,
  TricycleCategory,
} from '@prisma/client';
import * as  bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data (in development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...');
    await prisma.auditLog.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.rental.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.product.deleteMany();
    await prisma.coldRoom.deleteMany();
    await prisma.coldBox.deleteMany();
    await prisma.coldPlate.deleteMany();
    await prisma.tricycle.deleteMany();
    await prisma.user.deleteMany();
    await prisma.site.deleteMany();
  }

  // Hash password for all users
  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 1. Create Super Admins
  console.log('👤 Creating Super Admins...');
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@mofresh.rw' },
    update: {},
    create: {
      email: 'admin@mofresh.rw',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+250788000000',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  const superAdmin2 = await prisma.user.upsert({
    where: { email: 'irakozeflamanc+5@gmail.com' },
    update: {},
    create: {
      email: 'irakozeflamanc+5@gmail.com',
      password: hashedPassword,
      firstName: 'flaman',
      lastName: 'super Admin',
      phone: '+250788001111',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  const superAdmin3 = await prisma.user.upsert({
    where: { email: 'munezeromas@gmail.com' },
    update: {},
    create: {
      email: 'munezeromas@gmail.com',
      password: hashedPassword,
      firstName: 'Munezero',
      lastName: 'Mas',
      phone: '+250700000001',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  // 2. Create 3 Sites
  console.log('🏢 Creating sites...');
  const sitesData = [
    { name: 'MoFresh Kigali', location: 'Kigali, Rwanda' },
    { name: 'MoFresh Musanze', location: 'Musanze, Rwanda' },
    { name: 'MoFresh Rubavu', location: 'Rubavu, Rwanda' },
  ];

  const sites = [];
  for (const data of sitesData) {
    // Try to find by name first to avoid duplicates
    let site = await prisma.site.findFirst({ where: { name: data.name } });
    if (!site) {
      site = await prisma.site.create({ data });
    }
    sites.push(site);
  }
  const [site1, site2, site3] = sites;

  // 3. Create Site Managers
  console.log('👥 Creating Site Managers...');
  const manager1 = await prisma.user.upsert({
    where: { email: 'manager1@mofresh.rw' },
    update: { siteId: site1.id },
    create: {
      email: 'manager1@mofresh.rw',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Mutabazi',
      phone: '+250788111111',
      role: UserRole.SITE_MANAGER,
      siteId: site1.id,
      isActive: true,
    },
  });

  const manager2 = await prisma.user.upsert({
    where: { email: 'manager2@mofresh.rw' },
    update: { siteId: site2.id },
    create: {
      email: 'manager2@mofresh.rw',
      password: hashedPassword,
      firstName: 'Alice',
      lastName: 'Uwase',
      phone: '+250788222222',
      role: UserRole.SITE_MANAGER,
      siteId: site2.id,
      isActive: true,
    },
  });

  const manager3 = await prisma.user.upsert({
    where: { email: 'irakozeflamanc+6@gmail.com' },
    update: { siteId: site3.id },
    create: {
      email: 'irakozeflamanc+6@gmail.com',
      password: hashedPassword,
      firstName: 'flaman',
      lastName: 'site manager',
      phone: '+250788333333',
      role: UserRole.SITE_MANAGER,
      siteId: site3.id,
      isActive: true,
    },
  });

  const customManager = await prisma.user.upsert({
    where: { email: 'munezeromas+1@gmail.com' },
    update: { siteId: site1.id },
    create: {
      email: 'munezeromas+1@gmail.com',
      password: hashedPassword,
      firstName: 'Munezero',
      lastName: 'Manager',
      phone: '+250700000002',
      role: UserRole.SITE_MANAGER,
      siteId: site1.id,
      isActive: true,
    },
  });

  // Update sites with manager references (if not already set)
  // Note: Site.managerId is unique. We must check if the manager is already linked.
  const updateSiteWithManager = async (siteId: string, managerId: string) => {
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (site && site.managerId !== managerId) {
      // Check if this manager is already assigned to ANY site
      const otherSite = await prisma.site.findUnique({ where: { managerId } });
      if (otherSite) {
        // Unlink or handle as needed. For seeder, we just skip or update carefully.
        console.log(`⚠️ Manager ${managerId} already assigned to site ${otherSite.id}`);
      } else {
        await prisma.site.update({
          where: { id: siteId },
          data: { managerId },
        });
      }
    }
  };

  await updateSiteWithManager(site1.id, manager1.id);
  await updateSiteWithManager(site2.id, manager2.id);
  await updateSiteWithManager(site3.id, manager3.id);

  // 4. Create Suppliers
  console.log('🚚 Creating Suppliers...');
  const supplier1 = await prisma.user.upsert({
    where: { email: 'supplier1@mofresh.rw' },
    update: { siteId: site1.id },
    create: {
      email: 'supplier1@mofresh.rw',
      password: hashedPassword,
      firstName: 'Emmanuel',
      lastName: 'Kayitare',
      phone: '+250788444444',
      role: UserRole.SUPPLIER,
      siteId: site1.id,
      isActive: true,
    },
  });

  const supplier2 = await prisma.user.upsert({
    where: { email: 'supplier2@mofresh.rw' },
    update: { siteId: site2.id },
    create: {
      email: 'supplier2@mofresh.rw',
      password: hashedPassword,
      firstName: 'Grace',
      lastName: 'Mukamana',
      phone: '+250788555555',
      role: UserRole.SUPPLIER,
      siteId: site2.id,
      isActive: true,
    },
  });

  // 5. Create Clients
  console.log('🛒 Creating Clients...');
  const client1 = await prisma.user.upsert({
    where: { email: 'client1@example.rw' },
    update: { siteId: site1.id },
    create: {
      email: 'client1@example.rw',
      password: hashedPassword,
      firstName: 'Patrick',
      lastName: 'Habimana',
      phone: '+250788666666',
      role: UserRole.CLIENT,
      siteId: site1.id,
      isActive: true,
    },
  });

  const client2 = await prisma.user.upsert({
    where: { email: 'client2@example.rw' },
    update: { siteId: site2.id },
    create: {
      email: 'client2@example.rw',
      password: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Uwimana',
      phone: '+250788777777',
      role: UserRole.CLIENT,
      siteId: site2.id,
      isActive: true,
    },
  });

  // 6. Create Cold Rooms
  console.log('❄️ Creating Cold Rooms...');
  const coldRoomsData = [
    {
      name: 'Cold Room 1A',
      siteId: site1.id,
      totalCapacityKg: 5000,
      temperatureMin: -2,
      temperatureMax: 5,
      powerType: PowerType.GRID,
    },
    {
      name: 'Cold Room 2A',
      siteId: site2.id,
      totalCapacityKg: 3000,
      temperatureMin: -5,
      temperatureMax: 2,
      powerType: PowerType.HYBRID,
    },
    {
      name: 'Cold Room 3A',
      siteId: site3.id,
      totalCapacityKg: 4000,
      temperatureMin: 0,
      temperatureMax: 8,
      powerType: PowerType.OFF_GRID,
    },
  ];

  const coldRooms = [];
  for (const data of coldRoomsData) {
    let room = await prisma.coldRoom.findFirst({ where: { name: data.name, siteId: data.siteId } });
    if (!room) {
      room = await prisma.coldRoom.create({ data });
    }
    coldRooms.push(room);
  }
  const [coldRoom1, coldRoom2, coldRoom3] = coldRooms;

  // 7. Create Cold Boxes
  console.log('📦 Creating Cold Boxes...');
  const coldBoxesData = [
    {
      identificationNumber: 'CB-KGL-001',
      sizeOrCapacity: '50L',
      siteId: site1.id,
      location: 'Warehouse A',
      status: AssetStatus.AVAILABLE,
    },
    {
      identificationNumber: 'CB-KGL-002',
      sizeOrCapacity: '100L',
      siteId: site1.id,
      location: 'Warehouse A',
      status: AssetStatus.AVAILABLE,
    },
    {
      identificationNumber: 'CB-MUS-001',
      sizeOrCapacity: '75L',
      siteId: site2.id,
      location: 'Storage Room B',
      status: AssetStatus.AVAILABLE,
    },
  ];

  for (const data of coldBoxesData) {
    await prisma.coldBox.upsert({
      where: { identificationNumber: data.identificationNumber },
      update: data,
      create: data,
    });
  }

  // 8. Create Cold Plates
  console.log('🧊 Creating Cold Plates...');
  const coldPlatesData = [
    {
      identificationNumber: 'CP-KGL-001',
      coolingSpecification: '-10°C for 8 hours',
      siteId: site1.id,
      status: AssetStatus.AVAILABLE,
    },
    {
      identificationNumber: 'CP-KGL-002',
      coolingSpecification: '-5°C for 6 hours',
      siteId: site1.id,
      status: AssetStatus.AVAILABLE,
    },
    {
      identificationNumber: 'CP-MUS-001',
      coolingSpecification: '-8°C for 10 hours',
      siteId: site2.id,
      status: AssetStatus.AVAILABLE,
    },
  ];

  for (const data of coldPlatesData) {
    await prisma.coldPlate.upsert({
      where: { identificationNumber: data.identificationNumber },
      update: data,
      create: data,
    });
  }

  // 9. Create Tricycles
  console.log('🚲 Creating Tricycles...');
  const tricyclesData = [
    {
      plateNumber: 'TC-KGL-001',
      siteId: site1.id,
      capacity: '200kg',
      category: TricycleCategory.DAIRY,
      status: AssetStatus.AVAILABLE,
    },
    {
      plateNumber: 'TC-MUS-001',
      siteId: site2.id,
      capacity: '150kg',
      category: TricycleCategory.FRUITS_VEGETABLES,
      status: AssetStatus.AVAILABLE,
    },
    {
      plateNumber: 'TC-RUB-001',
      siteId: site3.id,
      capacity: '180kg',
      category: TricycleCategory.MEAT,
      status: AssetStatus.AVAILABLE,
    },
  ];

  for (const data of tricyclesData) {
    await prisma.tricycle.upsert({
      where: { plateNumber: data.plateNumber },
      update: data,
      create: data,
    });
  }

  // 10. Create Products
  console.log('🥛 Creating Products...');
  const productsData = [
    {
      name: 'Fresh Milk',
      category: 'Dairy',
      quantityKg: 500,
      unit: 'Liters',
      supplierId: supplier1.id,
      coldRoomId: coldRoom1.id,
      sellingPricePerUnit: 1000,
      siteId: site1.id,
      status: ProductStatus.IN_STOCK,
    },
    {
      name: 'Cheese',
      category: 'Dairy',
      quantityKg: 100,
      unit: 'Kg',
      supplierId: supplier1.id,
      coldRoomId: coldRoom1.id,
      sellingPricePerUnit: 5000,
      siteId: site1.id,
      status: ProductStatus.IN_STOCK,
    },
    {
      name: 'Tomatoes',
      category: 'Vegetables',
      quantityKg: 300,
      unit: 'Kg',
      supplierId: supplier2.id,
      coldRoomId: coldRoom2.id,
      sellingPricePerUnit: 800,
      siteId: site2.id,
      status: ProductStatus.IN_STOCK,
    },
    {
      name: 'Beef',
      category: 'Meat',
      quantityKg: 200,
      unit: 'Kg',
      supplierId: supplier2.id,
      coldRoomId: coldRoom2.id,
      sellingPricePerUnit: 4500,
      siteId: site2.id,
      status: ProductStatus.IN_STOCK,
    },
  ];

  for (const data of productsData) {
    const existing = await prisma.product.findFirst({
      where: { name: data.name, siteId: data.siteId },
    });
    if (!existing) {
      await prisma.product.create({ data: data as any });
    }
  }

  // Update cold room capacities
  await prisma.coldRoom.update({
    where: { id: coldRoom1.id },
    data: { usedCapacityKg: 600 }, // 500 + 100
  });

  await prisma.coldRoom.update({
    where: { id: coldRoom2.id },
    data: { usedCapacityKg: 500 }, // 300 + 200
  });

  console.log('✅ Database seeding completed successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Super Admin:');
  console.log('  Email: admin@mofresh.rw');
  console.log('  Password: Password123!');
  console.log('');
  console.log('Super Admin (Munezero):');
  console.log('  Email: munezeromas@gmail.com');
  console.log('  Password: Password123!');
  console.log('');
  console.log('Site Manager 1 (Kigali):');
  console.log('  Email: manager1@mofresh.rw');
  console.log('  Password: Password123!');
  console.log('');
  console.log('Site Manager (Munezero - Kigali):');
  console.log('  Email: munezeromas+1@gmail.com');
  console.log('  Password: Password123!');
  console.log('');
  console.log('Site Manager 2 (Musanze):');
  console.log('  Email: manager2@mofresh.rw');
  console.log('  Password: Password123!');
  console.log('');
  console.log('Supplier 1:');
  console.log('  Email: supplier1@mofresh.rw');
  console.log('  Password: Password123!');
  console.log('');
  console.log('Client 1:');
  console.log('  Email: client1@example.rw');
  console.log('  Password: Password123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
