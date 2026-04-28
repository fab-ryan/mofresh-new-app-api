/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, PowerType, AssetStatus, ProductStatus, TricycleCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeederService {
  private readonly logger = new Logger(SeederService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedDatabase(): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      this.logger.log('🌱 Starting database seeding...');

      // Clean existing data (in development only)
      if (process.env.NODE_ENV === 'development') {
        this.logger.log('🧹 Cleaning existing data...');
        await this.prisma.auditLog.deleteMany();
        await this.prisma.payment.deleteMany();
        await this.prisma.invoiceItem.deleteMany();
        await this.prisma.invoice.deleteMany();
        await this.prisma.orderItem.deleteMany();
        await this.prisma.order.deleteMany();
        await this.prisma.rental.deleteMany();
        await this.prisma.stockMovement.deleteMany();
        await this.prisma.product.deleteMany();
        await this.prisma.coldRoom.deleteMany();
        await this.prisma.coldBox.deleteMany();
        await this.prisma.coldPlate.deleteMany();
        await this.prisma.tricycle.deleteMany();
        await this.prisma.user.deleteMany();
        await this.prisma.site.deleteMany();
      }

      // Hash password for all users
      const hashedPassword = await bcrypt.hash('Password123!', 10);

      // 1. Create Super Admins
      this.logger.log('👤 Creating Super Admins...');
      const superAdmin = await this.prisma.user.upsert({
        where: { email: 'divinngenzi20@gmail.com' },
        update: {},
        create: {
          email: 'divinngenzi20@gmail.com',
          password: hashedPassword,
          firstName: 'Super',
          lastName: 'Admin',
          phone: '+250788000000',
          role: UserRole.SUPPLIER,
          isActive: true,
        },
      });

      const superAdmin2 = await this.prisma.user.upsert({
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

      const superAdmin3 = await this.prisma.user.upsert({
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
      this.logger.log('🏢 Creating sites...');
      const sitesData = [
        { name: 'MoFresh Kigali', location: 'Kigali, Rwanda' },
        { name: 'MoFresh Musanze', location: 'Musanze, Rwanda' },
        { name: 'MoFresh Rubavu', location: 'Rubavu, Rwanda' },
      ];

      const sites = [];
      for (const data of sitesData) {
        let site = await this.prisma.site.findFirst({
          where: { name: data.name },
        });
        if (!site) {
          site = await this.prisma.site.create({ data });
        }
        sites.push(site);
      }
      const [site1, site2, site3] = sites;

      // 3. Create Site Managers
      this.logger.log('👥 Creating Site Managers...');
      const manager1 = await this.prisma.user.upsert({
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

      const manager2 = await this.prisma.user.upsert({
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

      const manager3 = await this.prisma.user.upsert({
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

      const customManager = await this.prisma.user.upsert({
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

      // Update sites with manager references
      const updateSiteWithManager = async (siteId: string, managerId: string) => {
        const site = await this.prisma.site.findUnique({
          where: { id: siteId },
        });
        if (site && site.managerId !== managerId) {
          const otherSite = await this.prisma.site.findUnique({
            where: { managerId },
          });
          if (otherSite) {
            this.logger.warn(`⚠️ Manager ${managerId} already assigned to site ${otherSite.id}`);
          } else {
            await this.prisma.site.update({
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
      this.logger.log('🚚 Creating Suppliers...');
      const supplier1 = await this.prisma.user.upsert({
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

      const supplier2 = await this.prisma.user.upsert({
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
      this.logger.log('🛒 Creating Clients...');
      const client1 = await this.prisma.user.upsert({
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

      const client2 = await this.prisma.user.upsert({
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
      this.logger.log('❄️ Creating Cold Rooms...');
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
        let room = await this.prisma.coldRoom.findFirst({
          where: { name: data.name, siteId: data.siteId },
        });
        if (!room) {
          room = await this.prisma.coldRoom.create({ data });
        }
        coldRooms.push(room);
      }
      const [coldRoom1, coldRoom2, coldRoom3] = coldRooms;

      // 7. Create Cold Boxes
      this.logger.log('📦 Creating Cold Boxes...');
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
        await this.prisma.coldBox.upsert({
          where: { identificationNumber: data.identificationNumber },
          update: data,
          create: data,
        });
      }

      // 8. Create Cold Plates
      this.logger.log('🧊 Creating Cold Plates...');
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
        await this.prisma.coldPlate.upsert({
          where: { identificationNumber: data.identificationNumber },
          update: data,
          create: data,
        });
      }

      // 9. Create Tricycles
      this.logger.log('🚲 Creating Tricycles...');
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
        await this.prisma.tricycle.upsert({
          where: { plateNumber: data.plateNumber },
          update: data,
          create: data,
        });
      }

      // 10. Create Products
      this.logger.log('🥛 Creating Products...');
      const productsData = [
        {
          name: 'Fresh Milk',
          category: 'DAIRY',
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
          category: 'DAIRY',
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
          category: 'VEGETABLES',
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
          category: 'MEAT',
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
        const existing = await this.prisma.product.findFirst({
          where: { name: data.name, siteId: data.siteId },
        });
        if (!existing) {
          await this.prisma.product.create({ data });
        }
      }

      // Update cold room capacities
      await this.prisma.coldRoom.update({
        where: { id: coldRoom1.id },
        data: { usedCapacityKg: 600 }, // 500 + 100
      });

      await this.prisma.coldRoom.update({
        where: { id: coldRoom2.id },
        data: { usedCapacityKg: 500 }, // 300 + 200
      });

      this.logger.log('✅ Database seeding completed successfully!');

      const credentials = {
        superAdmins: [
          { email: 'admin@mofresh.rw', password: 'Password123!' },
          { email: 'munezeromas@gmail.com', password: 'Password123!' },
        ],
        siteManagers: [
          { email: 'manager1@mofresh.rw', password: 'Password123!' },
          { email: 'munezeromas+1@gmail.com', password: 'Password123!' },
          { email: 'manager2@mofresh.rw', password: 'Password123!' },
        ],
        suppliers: [{ email: 'supplier1@mofresh.rw', password: 'Password123!' }],
        clients: [{ email: 'client1@example.rw', password: 'Password123!' }],
      };

      return {
        success: true,
        message: 'Database seeding completed successfully!',
        data: credentials,
      };
    } catch (error) {
      this.logger.error('❌ Seeding failed:', error);
      return {
        success: false,
        message: `Seeding failed: ${(error as Error).message}`,
      };
    }
  }
}
