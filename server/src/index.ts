import express from "express";
import { EventEmitter } from "events";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parse as parseSync } from "csv-parse/sync";
import { parse as csvParse } from "csv-parse";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import {
  RunRequestSchema,
  DatasetInfo,
  DatasetVersionMeta,
  ColumnMeta
} from "@statlab/shared";
import registry from "../analysis/registry";
import { connectionRouter, DATASET_CACHE } from "./routes/connections";
import { predictFromModelPackage, MAX_PREDICT_ROWS } from "./predict";
import { runCustomPythonCode } from "../analysis/pythonBridge";


const app = express();
const prisma = new PrismaClient();
const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(50);

app.use(cors() as any);
app.use(express.json({ limit: "10mb" }));

// 批量删除运行历史
app.post("/api/run-history/batch-delete", async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: "ids must be an array" });
  try {
    const numIds = ids.map(id => Number(id)).filter(id => !Number.isNaN(id));
    if (numIds.length > 0) {
      await prisma.runRecord.deleteMany({ where: { id: { in: numIds } } });
    }

    const filePath = path.resolve(__dirname, "../recent_run.json");
    if (fs.existsSync(filePath)) {
      try {
        const arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const filtered = arr.filter((r: any) => !ids.map(String).includes(String(r.id)));
        fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), "utf-8");
      } catch (e) {
        console.warn("recent_run.json cleanup failed", e);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("batch delete error", err);
    res.status(500).json({ error: "批量删除失败" });
  }
});

// 删除单条运行历史（报告）
app.delete("/api/run-history/:id", async (req, res) => {
  const raw = req.params.id;
  const idNum = Number(raw);
  const isNum = !Number.isNaN(idNum);
  try {
    // 1) 删除数据库记录（若为数值型主键）
    if (isNum) {
      await prisma.runRecord.deleteMany({ where: { id: idNum } });
    }

    // 2) 同步清理 recent_run.json（如果存在）
    const filePath = path.resolve(__dirname, "../recent_run.json");
    if (fs.existsSync(filePath)) {
      try {
        const arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const idx = arr.findIndex((r: any) => String(r.id) === String(raw));
        if (idx !== -1) {
          arr.splice(idx, 1);
          fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), "utf-8");
        }
      } catch (e) { }
    }

    // 不再因不存在报错，保证前端删除请求幂等
    res.json({ ok: true });
  } catch (err) {
    console.error("delete run-history error", err);
    res.status(500).json({ error: "删除失败" });
  }
});
const uploadDir = path.resolve(__dirname, "../uploads");
const samplePath = path.resolve(__dirname, "../../sample.csv");
const fontCandidates: { p: string; family?: string }[] = [
  { p: path.resolve(__dirname, "../assets/fonts/NotoSansSC-Regular.otf") },
  { p: path.resolve(__dirname, "../assets/fonts/simhei.ttf") },
  { p: path.resolve(__dirname, "../fonts/NotoSansSC-Regular.otf") },
  { p: "C:/Windows/Fonts/simhei.ttf" },
  { p: "C:/Windows/Fonts/simfang.ttf" },
  { p: "C:/Windows/Fonts/simkai.ttf" },
  { p: "C:/Windows/Fonts/msyh.ttc", family: "Microsoft YaHei" },
  { p: "C:/Windows/Fonts/simsun.ttc", family: "SimSun" },
  { p: "/usr/share/fonts/truetype/noto/NotoSansSC-Regular.otf" },
  { p: "/usr/share/fonts/opentype/noto/NotoSansSC-Regular.otf" },
  { p: "/System/Library/Fonts/PingFang.ttc", family: "PingFang SC" }
];

const SAMPLE_DATASETS = [
  { key: "sample", path: path.resolve(__dirname, "../sample.csv"), label: "【Sample】示例数据" },
  { key: "advertising", path: path.resolve(__dirname, "../../samples/Advertising.csv"), label: "【Sample】广告投放与销售额" },
  { key: "housing", path: path.resolve(__dirname, "../../samples/Housing.csv"), label: "【Sample】房价影响因素分析" },
  { key: "iris", path: path.resolve(__dirname, "../../samples/Iris.csv"), label: "【Sample】鸢尾花卉 (Iris)" },
  { key: "employee", path: path.resolve(__dirname, "../../samples/Employee.csv"), label: "【Sample】员工绩效与压力分析" },
  { key: "finance", path: path.resolve(__dirname, "../../samples/pro/finance_stock_prices.csv"), label: "【Sample】金融股票价格" },
  { key: "medical", path: path.resolve(__dirname, "../../samples/pro/medical_patient_records.csv"), label: "【Sample】医疗患者记录" },
  { key: "energy", path: path.resolve(__dirname, "../../samples/pro/energy_consumption.csv"), label: "【Sample】建筑能耗" },
  { key: "manufacturing", path: path.resolve(__dirname, "../../samples/pro/manufacturing_quality.csv"), label: "【Sample】制造质量控制" },


];

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

const OLLAMA_HOST = "http://10.246.97.159:11434";
const OLLAMA_MODEL = "deepseek-r1:1.5b";

const logAiEvent = (msg: string, extra?: Record<string, unknown>) => {
  const payload = extra ? { msg, ...extra } : { msg };
  console.log(`[AI] ${msg}`, extra ? JSON.stringify(extra) : "");
};

app.use("/api/connections", connectionRouter);

app.get("/api/ai/models", async (_req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_HOST}/api/tags`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "无法连接到 Ollama 服务" });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  logAiEvent("chat_request_received", { ts: new Date().toISOString() });
  try {
    const { messages } = req.body;

    // 注入系统指令：简单问题直接回答，复杂问题才深入分析
    const systemMsg = {
      role: 'system',
      content: '你是一个高效的 StatLab 数据专家。如果用户问的是简单问题（如问候、简单概念定义、单行确认等），请直接、精炼地回答，不要进行冗长的思考或前缀说明；只有当涉及复杂数据分析结果解读时，才进行深度分析。'
    };

    const response = await axios.post(`${OLLAMA_HOST}/api/chat`, {
      model: OLLAMA_MODEL,
      messages: [systemMsg, ...messages],
      stream: true, // 开启流式
      options: {
        num_predict: 512, // 限制回复长度，提速
        temperature: 0.7,
        top_p: 0.9,
      },
      keep_alive: "24h" // 让模型留在内存里，下次提问秒回
    }, {
      responseType: 'stream',
      timeout: 300000 // 5 分钟，避免长回复被客户端超时
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let bytes = 0;
    response.data.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      res.write(chunk);
    });

    response.data.on('end', () => {
      logAiEvent("chat_stream_end", { bytes });
      res.end();
    });

    response.data.on('error', (err: any) => {
      logAiEvent("chat_stream_error", { error: err?.message || String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: "AI 助手流式响应异常" });
      } else {
        res.end();
      }
    });

  } catch (err: any) {
    logAiEvent("chat_request_failed", { error: err?.message || String(err) });
    res.status(500).json({ error: "AI 助手暂时不可用: " + err.message });
  }
});

app.get("/api/ai/test", (_req, res) => {
  res.json({ message: "Server is responsive", time: new Date().toISOString() });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/algorithms", (_req, res) => {
  res.json(registry.map((m) => m.spec));
});

app.get("/api/datasets", async (_req, res) => {
  try {
    const data = await prisma.dataset.findMany({
      include: {
        versions: true
      },
      orderBy: { createdAt: "desc" }
    });
    const mapped: DatasetInfo[] = data.map((d) => ({
      id: d.id,
      name: d.name,
      originalFilename: d.originalFilename,
      createdAt: d.createdAt.toISOString(),
      versions: d.versions.map((v) => versionToMeta(v))
    }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch datasets" });
  }
});

app.get("/api/datasets/:datasetId/versions/:versionId", async (req, res) => {
  try {
    const versionId = Number(req.params.versionId);
    const v = await prisma.datasetVersion.findUnique({ where: { id: versionId } });
    if (!v) return res.status(404).json({ error: "version not found" });
    res.json(versionToMeta(v));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch version" });
  }
});

app.get("/api/datasets/version/:versionId/full-data", async (req, res) => {
  try {
    const versionId = Number(req.params.versionId);
    const v = await prisma.datasetVersion.findUnique({ where: { id: versionId } });
    if (!v) return res.status(404).json({ error: "version not found" });

    const fullData = loadDataset(v.path);
    res.json(fullData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load full dataset data" });
  }
});

app.post("/api/datasets/import-sample", async (_req, res) => {
  try {
    const result = await createDatasetFromFile(samplePath, "sample.csv", "示例数据集");
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to import sample" });
  }
});

app.post("/api/datasets/import-sample/:name", async (req, res) => {
  const name = req.params.name;
  const sampleMap: Record<string, { path: string, label: string }> = {
    advertising: { path: path.resolve(__dirname, "../../samples/Advertising.csv"), label: "广告投放与销售额" },
    housing: { path: path.resolve(__dirname, "../../samples/Housing.csv"), label: "房价影响因素分析" },
    employee: { path: path.resolve(__dirname, "../../samples/Employee.csv"), label: "员工绩效与压力分析" },
    // 专业样本
    finance: { path: path.resolve(__dirname, "../../samples/pro/finance_stock_prices.csv"), label: "金融股票价格" },
    medical: { path: path.resolve(__dirname, "../../samples/pro/medical_patient_records.csv"), label: "医疗患者记录" },
    energy: { path: path.resolve(__dirname, "../../samples/pro/energy_consumption.csv"), label: "建筑能耗" },
    manufacturing: { path: path.resolve(__dirname, "../../samples/pro/manufacturing_quality.csv"), label: "制造质量" }
  };
  const config = sampleMap[name.toLowerCase()];
  if (!config) return res.status(404).json({ error: "sample not found" });

  try {
    const result = await createDatasetFromFile(config.path, `${name}.csv`, config.label);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to import sample" });
  }
});

app.post("/api/datasets/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  try {
    const ext = path.extname(req.file.originalname || "").toLowerCase();
    let storedPath = req.file.path;
    if (ext && !req.file.path.endsWith(ext)) {
      const targetPath = `${req.file.path}${ext}`;
      fs.renameSync(req.file.path, targetPath);
      storedPath = targetPath;
    }

    const result = await createDatasetFromFile(storedPath, req.file.originalname, req.file.originalname);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to import" });
  }
});

app.delete("/api/datasets/:datasetId", async (req, res) => {
  const datasetId = Number(req.params.datasetId);
  try {
    // Delete related records first because SQLite foreign keys without CASCADE will throw errors
    await prisma.runRecord.deleteMany({ where: { datasetId } });
    await prisma.datasetVersion.deleteMany({ where: { datasetId } });
    await prisma.dataset.delete({ where: { id: datasetId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to delete dataset" });
  }
});

// Delete a specific dataset version (keep at least 1 version)
app.delete("/api/datasets/version/:versionId", async (req, res) => {
  const versionId = Number(req.params.versionId);
  if (Number.isNaN(versionId)) return res.status(400).json({ error: "invalid version id" });
  try {
    const version = await prisma.datasetVersion.findUnique({ where: { id: versionId } });
    if (!version) return res.status(404).json({ error: "version not found" });

    const versionCount = await prisma.datasetVersion.count({ where: { datasetId: version.datasetId } });
    if (versionCount <= 1) return res.status(400).json({ error: "至少保留一个版本" });

    // delete run records tied to this version
    await prisma.runRecord.deleteMany({ where: { datasetVersionId: versionId } });
    await prisma.datasetVersion.delete({ where: { id: versionId } });
    res.json({ ok: true });
  } catch (err) {
    console.error("delete version error", err);
    res.status(500).json({ error: "failed to delete version" });
  }
});

app.get("/api/datasets/version/:versionId/download", async (req, res) => {
  const versionIdRaw = req.params.versionId;
  if (versionIdRaw.startsWith("db-")) {
    const ds = DATASET_CACHE.get(versionIdRaw);
    if (!ds) return res.status(404).json({ error: "DB dataset not found or expired" });

    const cols = ds.columns?.map((c: any) => c.name) || Object.keys(ds.previewRows?.[0] || {});
    const header = cols.join(",");
    const lines = (ds.previewRows || []).map((row: any) =>
      cols.map((c: string) => {
        const v = row?.[c];
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return s.includes(",") || s.includes("\n") ? `"${s}"` : s;
      }).join(",")
    );
    const csv = [header, ...lines].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${ds.name || "db_dataset"}.csv"`);
    return res.send(csv);
  }

  const versionId = Number(versionIdRaw);
  if (Number.isNaN(versionId)) return res.status(400).json({ error: "invalid version id" });
  try {
    const version = await prisma.datasetVersion.findUnique({
      where: { id: versionId },
      include: { dataset: true }
    });
    if (!version) return res.status(404).json({ error: "version not found" });

    const filename = `${version.dataset.name.replace(/\.[^/.]+$/, "")}_v${version.version}.csv`;
    res.download(version.path, filename);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to download dataset" });
  }
});

app.post("/api/run", async (req, res) => {
  try {
    const parsed = RunRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const { datasetVersionId, algorithmId, variables, params } = parsed.data;
    const module = registry.find((m) => m.spec.id === algorithmId);
    if (!module) return res.status(404).json({ error: "algorithm not found" });

    let dataset: Record<string, string>[] = [];
    let version: any = null;

    if (String(datasetVersionId).startsWith("db-")) {
      const dbDs = DATASET_CACHE.get(String(datasetVersionId));
      if (!dbDs) return res.status(404).json({ error: "DB dataset not found or expired" });
      dataset = dbDs.previewRows;
      version = { id: dbDs.id, datasetId: 0, version: 0, path: "", summary: "", columns: dbDs.columns, sampleRows: dbDs.previewRows, rowCount: dbDs.previewRows?.length || 0 };
    } else {
      version = await prisma.datasetVersion.findUnique({ where: { id: Number(datasetVersionId) } });
      if (!version) return res.status(404).json({ error: "dataset version not found" });
      dataset = loadDataset(version.path);
    }

    // Apply data filters if present
    const filters = params.dataFilters as Record<string, { min?: number, max?: number, eq?: string, contains?: string }> | undefined;
    if (filters && typeof filters === "object") {
      dataset = dataset.filter(row => {
        for (const [feat, condition] of Object.entries(filters)) {
          const valStr = String(row[feat] ?? "");
          const numVal = Number(valStr);

          if (condition.min !== undefined && !isNaN(numVal) && numVal < condition.min) return false;
          if (condition.max !== undefined && !isNaN(numVal) && numVal > condition.max) return false;
          if (condition.eq !== undefined && condition.eq !== "" && valStr !== condition.eq) return false;
          if (condition.contains !== undefined && condition.contains !== "" && !valStr.toLowerCase().includes(condition.contains.toLowerCase())) return false;
        }
        return true;
      });
      console.log(`[DataFilter] Dataset filtered down to ${dataset.length} rows.`);
    }

    const runRecord = await prisma.runRecord.create({
      data: {
        datasetId: version.datasetId || null,
        datasetVersionId: typeof version.id === 'string' ? null : version.id,
        algorithmId,
        variables: JSON.stringify(variables),
        params: JSON.stringify(params),
        status: "running",
        analysisName: req.body.analysisName || null,
        analystName: req.body.analystName || null
      }
    });

    try {
      const trainingLogs: string[] = [];
      const onLog = (msg: string) => {
        const line = `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${msg}`;
        trainingLogs.push(line);
        logEmitter.emit("log", { runId: runRecord.id, msg: line });
        console.log("[ML LOG]", msg);
      };
      const result = await module.run({ dataset, variables, params, version, onLog });
      // Attach training logs to result for frontend display
      (result as any).trainingLogs = trainingLogs;
      const responsePayload = { ...result, runId: runRecord.id };
      await prisma.runRecord.update({
        where: { id: runRecord.id },
        data: { status: "completed", result: JSON.stringify(responsePayload) }
      });
      res.json(responsePayload);
    } catch (err) {
      console.error(err);
      await prisma.runRecord.update({ where: { id: runRecord.id }, data: { status: "failed", log: String(err) } });
      res.status(500).json({ error: "run failed", detail: String(err) });
    }
  } catch (err) {
    console.error("API /api/run crash:", err);
    res.status(500).json({ error: "internal server error", detail: String(err) });
  }
});

app.post("/api/python-lab/run", async (req, res) => {
  try {
    const { code, datasetVersionId, tests } = req.body;
    let dataset: any[] = [];
    if (datasetVersionId) {
      const version = await prisma.datasetVersion.findUnique({ where: { id: Number(datasetVersionId) } });
      if (version) {
        // Reuse loadDataset function (need to make sure it's accessible or re-import)
        // Actually, loadDataset is defined in this file.
        dataset = loadDataset(version.path);
      }
    }
    const result = await runCustomPythonCode(code, dataset, tests);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.post("/api/run/:id/predict", async (req, res) => {
  try {
    const runId = Number(req.params.id);
    if (Number.isNaN(runId)) return res.status(400).json({ error: "invalid run id" });
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "rows 为空" });
    if (rows.length > MAX_PREDICT_ROWS) return res.status(400).json({ error: `预测行数超过上限 ${MAX_PREDICT_ROWS}` });

    const record = await prisma.runRecord.findUnique({ where: { id: runId } });
    if (!record || !record.result) return res.status(404).json({ error: "run not found or missing result" });

    const parsedResult = JSON.parse(record.result);
    const modelPkg = parsedResult?.extras?.modelPackage;
    if (!modelPkg) return res.status(400).json({ error: "该运行未保存模型，无法预测" });

    try {
      const pred = predictFromModelPackage(modelPkg, rows);
      res.json(pred);
    } catch (err: any) {
      console.error("Predict error", err);
      res.status(500).json({ error: "预测失败", detail: err?.message || String(err) });
    }
  } catch (err) {
    console.error("API /api/run/:id/predict crash:", err);
    res.status(500).json({ error: "internal server error", detail: String(err) });
  }
});

// ─── Live Log Stream (SSE) ────────────────────────────────────────────────────
app.get("/api/logs/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (payload: any) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const listener = (payload: any) => send(payload);
  logEmitter.on("log", listener);

  // heartbeat
  const heartbeat = setInterval(() => res.write(`event: ping\ndata: keepalive\n\n`), 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    logEmitter.off("log", listener);
  });
});

app.get("/api/run-history", async (_req, res) => {
  try {
    const records = await prisma.runRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { dataset: true }
    });
    const mapped = records.map((r) => ({
      id: String(r.id),
      algoId: r.algorithmId,
      algoName: "", // Will be mapped by frontend
      datasetId: r.datasetId,
      datasetVersionId: r.datasetVersionId,
      datasetName: r.dataset?.name || "未知数据集",
      ts: r.createdAt.toLocaleString("zh-CN"),
      status: r.status as "completed" | "failed",
      result: r.result ? JSON.parse(r.result) : null,
      analysisName: r.analysisName,
      analystName: r.analystName
    }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// ─── Data Processing API ────────────────────────────────────────────────────
app.post("/api/datasets/:datasetId/process", async (req, res) => {
  try {
    const datasetId = Number(req.params.datasetId);
    const { versionId, operation, columns } = req.body as {
      versionId: number;
      operation: string;
      columns: string[];
    };

    const version = await prisma.datasetVersion.findUnique({ where: { id: versionId } });
    if (!version) return res.status(404).json({ error: "version not found" });

    let data: Record<string, string>[] = loadDataset(version.path);
    const preview: { removed: number; modified: number; info: string } = { removed: 0, modified: 0, info: "" };

    const numCols = columns.filter((col) => {
      const vals = data.map((r) => Number(r[col])).filter((v) => !isNaN(v));
      return vals.length / Math.max(data.length, 1) > 0.5;
    });

    switch (operation) {
      case "fill_mean": {
        const means: Record<string, number> = {};
        for (const col of numCols) {
          const vals = data.map((r) => Number(r[col])).filter((v) => !isNaN(v));
          means[col] = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
        }
        data = data.map((row) => {
          const updated = { ...row };
          for (const col of numCols) {
            if (updated[col] === "" || updated[col] === null || updated[col] === undefined || isNaN(Number(updated[col]))) {
              updated[col] = String(Number(means[col].toFixed(4)));
              preview.modified++;
            }
          }
          return updated;
        });
        preview.info = `已用均值填充 ${preview.modified} 个缺失值`;
        break;
      }
      case "fill_median": {
        const medians: Record<string, number> = {};
        for (const col of numCols) {
          const vals = data.map((r) => Number(r[col])).filter((v) => !isNaN(v)).sort((a, b) => a - b);
          const mid = Math.floor(vals.length / 2);
          medians[col] = vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
        }
        data = data.map((row) => {
          const updated = { ...row };
          for (const col of numCols) {
            if (updated[col] === "" || isNaN(Number(updated[col]))) {
              updated[col] = String(Number(medians[col].toFixed(4)));
              preview.modified++;
            }
          }
          return updated;
        });
        preview.info = `已用中位数填充 ${preview.modified} 个缺失值`;
        break;
      }
      case "fill_mode": {
        for (const col of columns) {
          const counts: Record<string, number> = {};
          data.forEach((r) => { if (r[col]) counts[r[col]] = (counts[r[col]] || 0) + 1; });
          const mode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
          if (!mode) continue;
          data = data.map((row) => {
            const updated = { ...row };
            if (!updated[col] || updated[col] === "") { updated[col] = mode; preview.modified++; }
            return updated;
          });
        }
        preview.info = `已用众数填充 ${preview.modified} 个缺失值`;
        break;
      }
      case "drop_missing": {
        const before = data.length;
        data = data.filter((row) => columns.every((col) => row[col] !== "" && row[col] !== null && row[col] !== undefined));
        preview.removed = before - data.length;
        preview.info = `已删除 ${preview.removed} 行含缺失值的数据`;
        break;
      }
      case "iqr_clip": {
        for (const col of numCols) {
          const vals = data.map((r) => Number(r[col])).filter((v) => !isNaN(v)).sort((a, b) => a - b);
          const n = vals.length;
          const q1 = vals[Math.floor(n * 0.25)];
          const q3 = vals[Math.floor(n * 0.75)];
          const iqr = q3 - q1;
          const lo = q1 - 1.5 * iqr;
          const hi = q3 + 1.5 * iqr;
          data = data.map((row) => {
            const v = Number(row[col]);
            if (isNaN(v)) return row;
            if (v < lo || v > hi) {
              preview.modified++;
              return { ...row, [col]: String(Number(Math.max(lo, Math.min(hi, v)).toFixed(4))) };
            }
            return row;
          });
        }
        preview.info = `IQR 截断：已处理 ${preview.modified} 个异常值`;
        break;
      }
      case "zscore_filter": {
        const before = data.length;
        const stats: Record<string, { mean: number; sd: number }> = {};
        for (const col of numCols) {
          const vals = data.map((r) => Number(r[col])).filter((v) => !isNaN(v));
          const mean = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
          const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(vals.length - 1, 1));
          stats[col] = { mean, sd };
        }
        data = data.filter((row) =>
          numCols.every((col) => {
            const v = Number(row[col]);
            if (isNaN(v)) return true;
            const { mean, sd } = stats[col];
            return sd === 0 || Math.abs((v - mean) / sd) <= 3;
          })
        );
        preview.removed = before - data.length;
        preview.info = `Z-score 过滤：已删除 ${preview.removed} 个 |Z|>3 的异常行`;
        break;
      }
      case "standardize": {
        const stats: Record<string, { mean: number; sd: number }> = {};
        for (const col of numCols) {
          const vals = data.map((r) => Number(r[col])).filter((v) => !isNaN(v));
          const mean = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
          const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(vals.length - 1, 1));
          stats[col] = { mean, sd };
        }
        data = data.map((row) => {
          const updated = { ...row };
          for (const col of numCols) {
            const v = Number(row[col]);
            if (!isNaN(v)) {
              const { mean, sd } = stats[col];
              updated[col] = sd === 0 ? "0" : String(((v - mean) / sd).toFixed(4));
              preview.modified++;
            }
          }
          return updated;
        });
        preview.info = `Z-score 标准化：${numCols.length} 列，${preview.modified} 个值已转换`;
        break;
      }
      case "minmax": {
        const ranges: Record<string, { min: number; max: number }> = {};
        for (const col of numCols) {
          const vals = data.map((r) => Number(r[col])).filter((v) => !isNaN(v));
          ranges[col] = { min: Math.min(...vals), max: Math.max(...vals) };
        }
        data = data.map((row) => {
          const updated = { ...row };
          for (const col of numCols) {
            const v = Number(row[col]);
            if (!isNaN(v)) {
              const { min, max } = ranges[col];
              updated[col] = max === min ? "0" : String(((v - min) / (max - min)).toFixed(4));
              preview.modified++;
            }
          }
          return updated;
        });
        preview.info = `Min-Max 归一化：${numCols.length} 列已缩放至 [0, 1]`;
        break;
      }
      case "log1p": {
        for (const col of numCols) {
          data = data.map((row) => {
            const v = Number(row[col]);
            if (!isNaN(v) && v >= 0) {
              preview.modified++;
              return { ...row, [col]: String(Math.log1p(v).toFixed(4)) };
            }
            return row;
          });
        }
        preview.info = `对数变换 log(1+x)：${preview.modified} 个值已转换`;
        break;
      }
      case "abs": {
        for (const col of numCols) {
          data = data.map((row) => {
            const v = Number(row[col]);
            if (!isNaN(v)) { preview.modified++; return { ...row, [col]: String(Math.abs(v)) }; }
            return row;
          });
        }
        preview.info = `取绝对值：${preview.modified} 个数值已转换`;
        break;
      }
      case "round": {
        for (const col of numCols) {
          data = data.map((row) => {
            const v = Number(row[col]);
            if (!isNaN(v)) { preview.modified++; return { ...row, [col]: String(Math.round(v)) }; }
            return row;
          });
        }
        preview.info = `数值进位：${preview.modified} 个数值已取整`;
        break;
      }
      case "trim": {
        for (const col of columns) {
          data = data.map((row) => {
            if (row[col]) { preview.modified++; return { ...row, [col]: row[col].trim() }; }
            return row;
          });
        }
        preview.info = `文本去空格：${preview.modified} 个文本已清理`;
        break;
      }
      case "lowercase": {
        for (const col of columns) {
          data = data.map((row) => {
            if (row[col]) { preview.modified++; return { ...row, [col]: row[col].toLowerCase() }; }
            return row;
          });
        }
        preview.info = `全小写转换：${preview.modified} 个文本已转换`;
        break;
      }
      case "uppercase": {
        for (const col of columns) {
          data = data.map((row) => {
            if (row[col]) { preview.modified++; return { ...row, [col]: row[col].toUpperCase() }; }
            return row;
          });
        }
        preview.info = `全大写转换：${preview.modified} 个文本已转换`;
        break;
      }
      case "label_encode": {
        for (const col of columns) {
          const mapping: Record<string, number> = {};
          let i = 0;
          data.forEach(r => {
            if (r[col] !== "" && mapping[r[col]] === undefined) mapping[r[col]] = i++;
          });
          data = data.map(row => {
            if (row[col] !== "") { preview.modified++; return { ...row, [col]: String(mapping[row[col]]) }; }
            return row;
          });
        }
        preview.info = `标签编码：${columns.length} 列已转换为数值类别`;
        break;
      }
      case "to_numeric": {
        for (const col of columns) {
          data = data.map(row => {
            const v = Number(row[col]);
            if (!isNaN(v)) { preview.modified++; return { ...row, [col]: String(v) }; }
            return row;
          });
        }
        preview.info = `类型强转：${preview.modified} 个值已转换为数值`;
        break;
      }
      case "drop_duplicates": {
        const before = data.length;
        const seen = new Set();
        data = data.filter(row => {
          const key = columns.map(c => row[c]).join("|__|");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        preview.removed = before - data.length;
        preview.info = `去重：已删除 ${preview.removed} 行完全重复的数据`;
        break;
      }
        return res.status(400).json({ error: `未知操作: ${operation}` });
    }

    // Write processed data to a new CSV file
    const keys = Object.keys(data[0] || {});
    const csv = [keys.join(","), ...data.map((row) => keys.map((k) => `"${(row[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const newFilename = `processed_${Date.now()}_${operation}.csv`;
    const newPath = path.join(uploadDir, newFilename);
    fs.writeFileSync(newPath, csv, "utf-8");

    // Re-infer columns from processed data
    const sampleRecords = data.slice(0, 800);
    const newColumns = inferColumns(sampleRecords);
    const sampleRows = sampleRecords.slice(0, 200);
    const rowCount = data.length;

    // Determine next version number
    const allVersions = await prisma.datasetVersion.findMany({ where: { datasetId }, orderBy: { version: "desc" } });
    const nextVersion = (allVersions[0]?.version ?? 0) + 1;

    const newVersion = await prisma.datasetVersion.create({
      data: {
        datasetId,
        version: nextVersion,
        path: newPath,
        summary: JSON.stringify({ columns: newColumns, sampleRows, rowCount })
      }
    });

    res.json({
      versionId: newVersion.id,
      version: nextVersion,
      info: preview.info,
      removed: preview.removed,
      modified: preview.modified,
      rowCount: data.length
    });
  } catch (err) {
    console.error("API Data Processing crash:", err);
    res.status(500).json({ error: "internal server error", detail: String(err) });
  }
});

type PdfTable = { title?: string; columns: string[]; rows: (string | number | null | undefined)[][] };
type PdfChart = { title?: string; dataUrl: string };

app.post("/api/reports/pdf", async (req, res) => {
  const {
    html,
    markdown,
    title = "StatLab 报告",
    tables = [],
    charts = [],
    narrative,
    citation,
    summary
  } = req.body || {};

  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const fontName = applyCjkFont(doc);
  doc.font(fontName);

  const reapplyFont = () => { try { doc.font(fontName); } catch { } };

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => {
    const pdf = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=report.pdf");
    res.send(pdf);
  });

  reapplyFont();
  doc.fontSize(18).fillColor("#111827").text(title, { underline: true });
  if (summary) {
    doc.moveDown(0.4);
    reapplyFont();
    doc.fontSize(11).fillColor("#475569").text(summary, { lineGap: 4 });
  }
  doc.moveDown();

  const preface = markdown || stripHtml(html || "");
  if (preface) {
    reapplyFont();
    doc.fontSize(12).fillColor("#0f172a").text(preface, { lineGap: 4 });
    doc.moveDown();
  }

  const normalizedTables: PdfTable[] = Array.isArray(tables) ? tables : [];
  if (normalizedTables.length > 0) {
    reapplyFont();
    doc.fontSize(14).fillColor("#111827").text("数据表", { underline: false });
    doc.moveDown(0.4);
    normalizedTables.forEach((t, idx) => {
      renderTable(doc, t, idx, fontName);
    });
  }

  const normalizedCharts: PdfChart[] = Array.isArray(charts) ? charts.filter((c) => c?.dataUrl) : [];
  if (normalizedCharts.length > 0) {
    doc.addPage();
    reapplyFont();
    doc.fontSize(14).fillColor("#111827").text("图表", { underline: false });
    doc.moveDown(0.4);
    normalizedCharts.forEach((c) => renderChartImage(doc, c, fontName));
  }

  if (narrative) {
    doc.addPage();
    reapplyFont();
    doc.fontSize(14).fillColor("#111827").text("解读", { underline: false });
    doc.moveDown(0.4);
    reapplyFont();
    doc.fontSize(12).fillColor("#0f172a").text(String(narrative), { lineGap: 4 });
  }

  if (citation) {
    doc.moveDown();
    reapplyFont();
    doc.fontSize(13).fillColor("#111827").text("参考", { underline: false });
    doc.moveDown(0.2);
    reapplyFont();
    doc.fontSize(11).fillColor("#475569").text(String(citation), { lineGap: 3 });
  }

  doc.end();
});

const basePort = Number(process.env.PORT) || 3001;
seedSampleDatasets().finally(() => startServer(basePort));

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, "");
}

function applyCjkFont(doc: any): string {
  for (const candidate of fontCandidates) {
    if (!fs.existsSync(candidate.p)) continue;
    try {
      if (candidate.family) {
        doc.registerFont("statlab-cjk", candidate.p, candidate.family);
      } else {
        doc.registerFont("statlab-cjk", candidate.p);
      }
      doc.font("statlab-cjk");
      console.log("[PDF] CJK font loaded:", candidate.p);
      return "statlab-cjk";
    } catch (err) {
      console.warn("[PDF] Failed to load font", candidate.p, err);
    }
  }
  console.warn("[PDF] No CJK font available – Chinese text may be garbled");
  return "Helvetica";
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight: number, fontName?: string) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) {
    doc.addPage();
    if (fontName) (doc as any).font(fontName);
  }
}

function renderTable(doc: PDFKit.PDFDocument, table: PdfTable, idx: number, fontName = "Helvetica") {
  const columns = table.columns || [];
  const rows = table.rows || [];
  if (columns.length === 0) return;

  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = Math.min(140, usableWidth / Math.max(columns.length, 1));
  const baseRowHeight = 20;
  const textSize = colWidth < 40 ? 7 : colWidth < 55 ? 8 : colWidth < 70 ? 9 : columns.length > 6 ? 10 : 11;

  const title = table.title || `表 ${idx + 1}`;
  const applyFont = () => { try { (doc as any).font(fontName); } catch { } };

  const drawHeader = (caption: string) => {
    applyFont();
    doc.fontSize(12).fillColor("#0f172a").text(caption, { underline: false });
    doc.moveDown(0.15);
    const startX = doc.page.margins.left;
    const y = doc.y;
    for (let i = 0; i < columns.length; i++) {
      const x = startX + i * colWidth;
      doc.save();
      doc.rect(x, y, colWidth, baseRowHeight).fillAndStroke("#e2e8f0", "#cbd5e1");
      doc.restore();
      applyFont();
      doc.fillColor("#0f172a").fontSize(textSize).text(
        String(columns[i] ?? ""),
        x + 4, y + 4,
        { width: colWidth - 8, height: baseRowHeight - 6, ellipsis: true }
      );
    }
    doc.y = y + baseRowHeight;
  };

  const bottom = () => doc.page.height - doc.page.margins.bottom;

  const renderRow = (rowData: any[], zebra: boolean) => {
    let maxHeight = baseRowHeight;
    for (let i = 0; i < columns.length; i++) {
      const value = rowData[i] ?? "";
      const h = doc.heightOfString(String(value), { width: colWidth - 8, align: "left" }) + 8;
      if (h > maxHeight) maxHeight = Math.min(h, 100);
    }

    if (doc.y + maxHeight > bottom()) {
      doc.addPage();
      applyFont();
      drawHeader(`${title} (续)`);
    }

    const y = doc.y;
    const startX = doc.page.margins.left;
    for (let i = 0; i < columns.length; i++) {
      const value = rowData[i] ?? "";
      const x = startX + i * colWidth;
      doc.save();
      doc.rect(x, y, colWidth, maxHeight).stroke("#e2e8f0");
      if (zebra) {
        doc.rect(x, y, colWidth, maxHeight).fillOpacity(0.5).fill("#f8fafc");
      }
      doc.restore();
      applyFont();
      doc.fillColor("#111827").fontSize(textSize).text(
        String(value),
        x + 4, y + 4,
        { width: colWidth - 8, height: maxHeight - 6 }
      );
    }
    doc.y = y + maxHeight;
  };

  ensureSpace(doc, baseRowHeight * 2 + 30, fontName);
  drawHeader(title);

  rows.forEach((row, idxRow) => {
    renderRow([...row], idxRow % 2 === 1);
  });

  doc.moveDown();
}

function renderChartImage(doc: PDFKit.PDFDocument, chart: PdfChart, fontName = "Helvetica") {
  const match = typeof chart.dataUrl === "string" ? chart.dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/) : null;
  if (!match) return;
  const maxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const imgHeight = Math.round(maxWidth * (520 / 900));
  const neededHeight = imgHeight + 30;

  ensureSpace(doc, neededHeight, fontName);

  if (chart.title) {
    try { (doc as any).font(fontName); } catch { }
    doc.fontSize(12).fillColor("#0f172a").text(chart.title);
    doc.moveDown(0.2);
  }
  try {
    const buffer = Buffer.from(match[2], "base64");
    doc.image(buffer, doc.page.margins.left, doc.y, {
      fit: [maxWidth, imgHeight],
      align: "center",
      valign: "center"
    });
    doc.y += imgHeight + 10;
  } catch (err) {
    console.warn("[PDF] Failed to render chart image:", chart.title, err);
  }
  doc.moveDown(0.6);
}

function startServer(port: number) {
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`StatLab server running on http://0.0.0.0:${port}`);
  });

  server.on("error", (err: any) => {
    if (err?.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Please stop the occupying process or set PORT/VITE_API_PORT to the same value.`);
    } else {
      console.error("Failed to start server", err);
    }
    process.exit(1);
  });
}

async function seedSampleDatasets() {
  try {
    const existing = await prisma.dataset.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((d) => d.name));
    for (const s of SAMPLE_DATASETS) {
      if (!fs.existsSync(s.path)) continue;
      if (existingNames.has(s.label)) continue;
      await createDatasetFromFile(s.path, path.basename(s.path), s.label);
      console.log(`Seeded sample dataset: ${s.label}`);
    }
  } catch (err) {
    console.warn("Seed sample datasets failed", err);
  }
}

function parseExcelFile(filePath: string): Record<string, string>[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];
  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        normalized[key] = "";
      } else {
        normalized[key] = String(value);
      }
    });
    return normalized;
  });
}

function loadDataset(filePath: string) {
  let finalPath = filePath;
  if (!fs.existsSync(filePath)) {
    const base = path.basename(filePath);
    // Attempt fallback checks
    const fallbacks = [
      path.resolve(__dirname, "../../samples", base),
      path.resolve(__dirname, "../../", base),
      path.resolve(__dirname, "../uploads", base)
    ];
    for (const f of fallbacks) {
      if (fs.existsSync(f)) {
        finalPath = f;
        break;
      }
    }
  }

  const ext = path.extname(finalPath).toLowerCase();
  if (ext === ".xlsx" || ext === ".xls") {
    return parseExcelFile(finalPath);
  }

  const buffer = fs.readFileSync(finalPath);
  let csv = "";
  try {
    // Try UTF-8 first
    csv = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (e) {
    // Fallback to GBK for Chinese Windows users
    try {
      csv = new TextDecoder("gbk").decode(buffer);
      console.log(`[CSV] Fallback to GBK for ${finalPath}`);
    } catch (e2) {
      csv = buffer.toString("utf-8"); // Last resort
    }
  }
  const records = parseSync(csv, { columns: true, skip_empty_lines: true });
  return records as Record<string, string>[];
}

async function createDatasetFromFile(filePath: string, originalFilename: string, name: string) {
  // Stream once to get a preview plus total row count for accurate metadata
  const { sampleRecords, rowCount } = await sampleDataset(filePath, 2000);
  const columns = inferColumns(sampleRecords);
  const sampleRows = sampleRecords.slice(0, 200);
  const dataset = await prisma.dataset.create({
    data: {
      name,
      originalFilename,
      versions: {
        create: {
          version: 1,
          path: filePath,
          summary: JSON.stringify({ columns, sampleRows, rowCount })
        }
      }
    },
    include: { versions: true }
  });
  const info: DatasetInfo = {
    id: dataset.id,
    name: dataset.name,
    originalFilename,
    createdAt: dataset.createdAt.toISOString(),
    versions: dataset.versions.map((v) => versionToMeta(v))
  };
  return info;
}

function inferColumns(records: Record<string, string>[]): ColumnMeta[] {
  if (records.length === 0) return [];
  const keys = Object.keys(records[0]);
  return keys.map((key) => {
    const values = records.map((r) => r[key]).filter((v) => v !== undefined && v !== null);
    const numericCount = values.filter((v) => !isNaN(Number(v))).length;
    const missingCount = values.filter((v) => v === "" || v === null).length;
    const type: ColumnMeta["type"] = numericCount / Math.max(values.length, 1) > 0.7 ? "numeric" : "categorical";
    return {
      name: key,
      type,
      missingRate: values.length === 0 ? 0 : missingCount / values.length
    };
  });
}

async function sampleDataset(filePath: string, sampleLimit = 800): Promise<{ sampleRecords: Record<string, string>[]; rowCount: number }> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".xlsx" || ext === ".xls") {
    const rows = parseExcelFile(filePath);
    return { sampleRecords: rows.slice(0, sampleLimit), rowCount: rows.length };
  }

  return new Promise((resolve, reject) => {
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

    csvParse(csv, { columns: true, skip_empty_lines: true }, (err, records) => {
      if (err) return reject(err);
      if (Array.isArray(records)) {
        resolve({ sampleRecords: records.slice(0, sampleLimit), rowCount: records.length });
      } else {
        resolve({ sampleRecords: [], rowCount: 0 });
      }
    });
  });
}

function versionToMeta(v: any): DatasetVersionMeta {
  const summary = typeof v.summary === "string" ? JSON.parse(v.summary) : (v.summary || {});
  return {
    id: v.id,
    datasetId: v.datasetId,
    version: v.version,
    path: v.path,
    rowCount: summary.rowCount ?? (summary.sampleRows ? summary.sampleRows.length : 0),
    columns: summary.columns || [],
    sampleRows: summary.sampleRows || []
  };
}
