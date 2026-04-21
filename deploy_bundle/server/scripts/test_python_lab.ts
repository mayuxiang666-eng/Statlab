import { PrismaClient } from "@prisma/client";
process.env.PYTHON_ML_URL = "http://127.0.0.1:4002";
import { runCustomPythonCode } from "../analysis/pythonBridge";
import * as fs from "fs";
import * as path from "path";
import { parse as parseSync } from "csv-parse/sync";

const prisma = new PrismaClient();

function loadDataset(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  let csv = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  return parseSync(csv, { columns: true, skip_empty_lines: true });
}

async function test() {
  const code = `
import warnings
warnings.filterwarnings('ignore')
import numpy as np
import pandas as pd

np.random.seed(42)

if 'df' not in locals() or df is None:
    df = pd.DataFrame()

if df.empty:
    print('WARN: dataset is empty, bind a dataset before running exercises.')
else:
    df.columns = [str(c).strip().replace('\\ufeff', '') for c in df.columns]
    before_rows = len(df)
    df = df.drop_duplicates().reset_index(drop=True)
    print(f'OK: dataset loaded: {len(df)} rows, {len(df.columns)} cols')

from io import StringIO
if not df.empty:
    csv_text = df.head(50).to_csv(index=False)
    df_csv = pd.read_csv(StringIO(csv_text))
    print("SUCCESS: Read CSV inside Python ML. shape:", df_csv.shape)
else:
    print("DF IS EMPTY, cannot run CSV logic.")
  `;

  try {
    const version = await prisma.datasetVersion.findFirst({ where: { id: 2 } });
    if (!version) throw new Error("Housing dataset version ID 2 not found.");
    
    console.log("Loading dataset from:", version.path);
    const dataset = loadDataset(version.path);
    console.log("Passed dataset rows:", dataset.length);

    console.log("Calling Python ML...");
    const result = await runCustomPythonCode(code, dataset as any);
    console.log("Python output logs:");
    console.dir(result.logs, { depth: null });
    if (!result.success) console.error("Error:", result.error);

  } catch (err: any) {
    console.error("Test failed ERROR MESSAGE:", err.message);
    console.error("Test failed ERROR STACK:", err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

test();

