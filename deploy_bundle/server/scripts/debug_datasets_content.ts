import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { parse as parseSync } from "csv-parse/sync";

const prisma = new PrismaClient();

function loadDataset(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  let csv = "";
  try {
    csv = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (e) {
    try {
      csv = new TextDecoder("gbk").decode(buffer);
    } catch (e2) {
      csv = buffer.toString("utf-8");
    }
  }
  try {
    return parseSync(csv, { columns: true, skip_empty_lines: true });
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  const datasets = await prisma.dataset.findMany({
    include: { versions: true }
  });
  console.log("=== Datasets in DB ===");
  for (const d of datasets) {
    console.log(`ID: ${d.id}, Name: ${d.name}, OriginalFile: ${d.originalFilename}, UserID: ${d.userId}`);
    for (const v of d.versions) {
      const result = loadDataset(v.path);
      const rowCount = Array.isArray(result) ? result.length : (result ? "ERROR" : "NOT_FOUND");
      console.log(`  Version: ${v.id}, Path: ${v.path}, Exists: ${fs.existsSync(v.path)}, Rows: ${rowCount}`);
      if (typeof result === 'object' && 'error' in result) {
        console.log(`    Parse Error: ${result.error}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
