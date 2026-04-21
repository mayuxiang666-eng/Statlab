import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
const prisma = new PrismaClient();

async function main() {
  const datasets = await prisma.dataset.findMany({
    select: { id: true, name: true, originalFilename: true, userId: true, versions: { select: { id: true, path: true } } }
  });
  console.log("Datasets in DB:");
  for (const d of datasets) {
    for (const v of d.versions) {
      const exists = fs.existsSync(v.path);
      console.log(`  id=${d.id} name='${d.name}' origFile='${d.originalFilename}' userId=${d.userId} | version.id=${v.id} path=${v.path} EXISTS=${exists}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
