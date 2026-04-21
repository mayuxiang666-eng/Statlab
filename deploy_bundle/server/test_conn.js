const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const users = await prisma.user.findMany({ take: 1 });
    console.log('Connection successful, users found:', users.length);
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
