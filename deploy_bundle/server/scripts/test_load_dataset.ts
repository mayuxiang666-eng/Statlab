import * as fs from "fs";
import { parse as parseSync } from "csv-parse/sync";

const filePath = `D:\\statlab\\deploy_bundle\\samples\\Housing.csv`;

function loadDataset(finalPath: string) {
  const buffer = fs.readFileSync(finalPath);
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
  const records = parseSync(csv, { columns: true, skip_empty_lines: true });
  return records as Record<string, string>[];
}

try {
  const data = loadDataset(filePath);
  console.log(`Parsed ${data.length} rows.`);
  if (data.length > 0) {
    console.log("Keys of first row:", Object.keys(data[0]));
    console.log("First row:", data[0]);
  }
} catch (err) {
  console.error(err);
}
