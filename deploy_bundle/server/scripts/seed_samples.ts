import { PrismaClient } from "@prisma/client";
import { parse as parseSync } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function inferColumns(records: Record<string, string>[]) {
  if (records.length === 0) return [];
  const keys = Object.keys(records[0]);
  return keys.map((key) => {
    const values = records.map((r) => r[key]).filter((v) => v !== undefined && v !== null);
    const numericCount = values.filter((v) => !isNaN(Number(v))).length;
    const missingCount = values.filter((v) => v === "" || v === null).length;
    const type = numericCount / Math.max(values.length, 1) > 0.7 ? "numeric" : "categorical";
    return { name: key, type, missingRate: values.length === 0 ? 0 : missingCount / values.length };
  });
}

function loadDataset(filePath: string) {
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
  return parseSync(csv, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
}

async function createDatasetFromFile(filePath: string, originalFilename: string, name: string) {
  const records = loadDataset(filePath);
  const rowCount = records.length;
  const sampleRecords = records.slice(0, 2000);
  const columns = inferColumns(sampleRecords);
  const sampleRows = sampleRecords.slice(0, 200);

  const dataset = await prisma.dataset.create({
    data: {
      name,
      userId: null, // userId=null means it is a shared dataset visible to all
      originalFilename,
      versions: {
        create: {
          version: 1,
          path: filePath,
          summary: JSON.stringify({ columns, sampleRows, rowCount })
        }
      }
    }
  });
  return dataset;
}

const SAMPLE_DATASETS = [
  { path: path.join(__dirname, "../../samples/Advertising.csv"), label: "广告投放与销售额" },
  { path: path.join(__dirname, "../../samples/Housing.csv"), label: "房价影响因素分析" },
  { path: path.join(__dirname, "../../samples/Employee.csv"), label: "员工绩效与压力分析" },
  { path: path.join(__dirname, "../../samples/Iris.csv"), label: "鸢尾花品种分类" },
  { path: path.join(__dirname, "../../samples/pro/finance_stock_prices.csv"), label: "金融股票价格" },
  { path: path.join(__dirname, "../../samples/pro/medical_patient_records.csv"), label: "医疗患者记录" },
  { path: path.join(__dirname, "../../samples/pro/energy_consumption.csv"), label: "建筑能耗" },
  { path: path.join(__dirname, "../../samples/pro/manufacturing_quality.csv"), label: "制造质量控制" },
];

async function main() {
  const existing = await prisma.dataset.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((d) => d.name));

  for (const s of SAMPLE_DATASETS) {
    if (!fs.existsSync(s.path)) {
      console.log(`[SKIP] File not found: ${s.path}`);
      continue;
    }
    if (existingNames.has(s.label)) {
      console.log(`[SKIP] Already exists in DB: ${s.label}`);
      continue;
    }
    await createDatasetFromFile(s.path, path.basename(s.path), s.label);
    console.log(`[OK] Seeded: ${s.label}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
