import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'joe@dealership.local' },
    update: {},
    create: {
      name: 'Joe',
      email: 'joe@dealership.local',
      roles: [UserRole.ADMIN]
    }
  });

  await prisma.user.upsert({
    where: { email: 'rachel@dealership.local' },
    update: {},
    create: {
      name: 'Rachel',
      email: 'rachel@dealership.local',
      roles: [UserRole.ADMIN, UserRole.APPROVER]
    }
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
