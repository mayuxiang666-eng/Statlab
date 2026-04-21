import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Robust .env loading: Search in Server dir and Root dir
const pathsToTry = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
];
pathsToTry.forEach(p => {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true });
    console.log(`[Config] Loaded .env from: ${p}`);
  }
});

import { EventEmitter } from "events";
import cors from "cors";
import multer from "multer";
import { parse as parseSync } from "csv-parse/sync";
import { parse as csvParse } from "csv-parse";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import bcrypt from "bcryptjs";
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


import { authRouter } from "./routes/auth";
import { authMiddleware, AuthRequest } from "./middleware/auth";
import mysql from "mysql2/promise";

const app = express();
const prisma = new PrismaClient();
const pool = mysql.createPool(process.env.DATABASE_URL!);
const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(50);

app.use(cors() as any);
app.use(express.json({ limit: "10mb" }));

// --- Auth Routes ---
app.use("/api/auth", authRouter);

// ── Startup: ensure share columns exist (no full migration needed) ──
(async () => {
  try {
    const conn = await pool.getConnection();
    const [[{ TABLE_NAME }]] = await conn.query<any[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RunRecord' LIMIT 1`
    );
    if (TABLE_NAME) {
      const [cols] = await conn.query<any[]>(`SHOW COLUMNS FROM \`RunRecord\` LIKE 'isPublic'`);
      if (!cols.length) {
        await conn.query(`ALTER TABLE \`RunRecord\` ADD COLUMN \`isPublic\` TINYINT(1) NOT NULL DEFAULT 0`);
        await conn.query(`ALTER TABLE \`RunRecord\` ADD COLUMN \`sharedNote\` VARCHAR(255) NULL`);
        await conn.query(`ALTER TABLE \`RunRecord\` ADD COLUMN \`sharedAt\` DATETIME NULL`);
        console.log("[Migration] Added share columns to RunRecord");
      }
    }

    // ── GitHub Projects table ──
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`github_projects\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT,
        \`url\` VARCHAR(512) NOT NULL,
        \`category\` VARCHAR(100) DEFAULT '其他',
        \`tags\` VARCHAR(512) DEFAULT '[]',
        \`author\` VARCHAR(100) NOT NULL,
        \`userId\` VARCHAR(100) NULL,
        \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Ensure userId column exists (for tables created before this migration)
    const [gpCols] = await conn.query<any[]>(`SHOW COLUMNS FROM \`github_projects\` LIKE 'userId'`);
    if (!gpCols.length) {
      await conn.query(`ALTER TABLE \`github_projects\` ADD COLUMN \`userId\` VARCHAR(100) NULL AFTER \`author\``);
    }
    console.log("[Migration] github_projects table ready");

    conn.release();
  } catch (e) {
    console.warn("[Migration] Share columns setup skipped:", e);
  }
})();

// ── GitHub Projects API ──
app.get("/api/github-projects", async (_req, res) => {
  try {
    const [rows]: any = await pool.execute(
      `SELECT * FROM github_projects ORDER BY createdAt DESC`
    );
    const projects = rows.map((r: any) => ({
      ...r,
      tags: (() => { try { return JSON.parse(r.tags); } catch { return []; } })()
    }));
    res.json(projects);
  } catch (err) {
    console.error("fetch projects error", err);
    res.status(500).json({ error: "获取项目列表失败" });
  }
});

app.post("/api/github-projects", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { title, description, url, category, tags } = req.body;
    if (!title || !url) {
      return res.status(400).json({ error: "标题和链接为必填项" });
    }
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    const author = currentUser?.username || "匿名用户";
    const tagsJson = JSON.stringify(tags || []);

    const [result]: any = await pool.execute(
      `INSERT INTO github_projects (title, description, url, category, tags, author, userId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description || "", url, category || "其他", tagsJson, author, req.userId]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error("create project error", err);
    res.status(500).json({ error: "项目分享失败" });
  }
});

app.put("/api/github-projects/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const { title, description, url, category, tags } = req.body;

    // Check ownership
    const [rows]: any = await pool.execute(`SELECT * FROM github_projects WHERE id = ?`, [projectId]);
    if (!rows.length) return res.status(404).json({ error: "项目不存在" });

    const project = rows[0];
    if (project.userId !== req.userId) {
      return res.status(403).json({ error: "只有原作者可以编辑此项目" });
    }

    const tagsJson = JSON.stringify(tags || []);
    await pool.execute(
      `UPDATE github_projects SET title = ?, description = ?, url = ?, category = ?, tags = ? WHERE id = ?`,
      [title || project.title, description ?? project.description, url || project.url, category || project.category, tagsJson, projectId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("update project error", err);
    res.status(500).json({ error: "更新项目失败" });
  }
});

app.delete("/api/github-projects/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);

    // Check ownership
    const [rows]: any = await pool.execute(`SELECT * FROM github_projects WHERE id = ?`, [projectId]);
    if (!rows.length) return res.status(404).json({ error: "项目不存在" });

    const project = rows[0];
    if (project.userId !== req.userId && req.userId !== 'admin') { // Allow admin or owner
      return res.status(403).json({ error: "只有作者或管理员可以删除此项目" });
    }

    await pool.execute(`DELETE FROM github_projects WHERE id = ?`, [projectId]);
    res.json({ ok: true });
  } catch (err) {
    console.error("delete project error", err);
    res.status(500).json({ error: "删除项目失败" });
  }
});

// ── Share a run record (toggle public) ──
app.post("/api/run/:id/share", authMiddleware, async (req: AuthRequest, res) => {
  const runId = Number(req.params.id);
  const { note, isPublic = true } = req.body as { note?: string; isPublic?: boolean };
  
  try {
    const run = await prisma.runRecord.findFirst({ where: { id: runId, userId: req.userId } });
    console.log(`[Share] runId=${runId}, userId=${req.userId}, found=${!!run}`);
    
    if (!run) {
      return res.status(404).json({ error: "Report not found or permission denied" });
    }

    await prisma.runRecord.update({
      where: { id: runId },
      data: {
        isPublic: !!isPublic,
        sharedNote: note || null,
        sharedAt: isPublic ? new Date() : null
      }
    });

    res.json({ ok: true, isPublic });
  } catch (err) {
    console.error("share error", err);
    res.status(500).json({ error: "分享失败" });
  }
});

// Added explicit unshare endpoint for frontend compatibility
app.post("/api/run/:id/unshare", authMiddleware, async (req: AuthRequest, res) => {
  const runId = Number(req.params.id);
  try {
    const run = await prisma.runRecord.findFirst({ where: { id: runId, userId: req.userId } });
    if (!run) return res.status(404).json({ error: "Report not found or permission denied" });

    await prisma.runRecord.update({
      where: { id: runId },
      data: { isPublic: false, sharedAt: null }
    });
    res.json({ ok: true, isPublic: false });
  } catch (err) {
    console.error("unshare error", err);
    res.status(500).json({ error: "取消分享失败" });
  }
});

// ── Public gallery — no auth, lists all shared runs ──
app.get("/api/public/reports", async (_req, res) => {
  try {
    const records = await prisma.runRecord.findMany({
      where: { 
        isPublic: true,
        status: 'completed'
      },
      include: {
        dataset: true,
        user: true
      },
      orderBy: { sharedAt: "desc" },
      take: 100
    }) as any[];

    const mapped = records.map(r => ({
      id: r.id,
      algorithmId: r.algorithmId,
      analysisName: r.analysisName,
      analystName: r.analystName,
      status: r.status,
      createdAt: r.createdAt,
      sharedNote: r.sharedNote,
      sharedAt: r.sharedAt,
      datasetName: r.dataset?.name,
      authorName: r.user?.name,
      authorUsername: r.user?.username
    }));

    res.json(mapped);
  } catch (err) {
    console.error("public reports error", err);
    res.status(500).json({ error: "获取公开报告失败" });
  }
});

// ── Single public report (no auth, for sharing view) ──
app.get("/api/public/reports/:id", async (req, res) => {
  try {
    const runId = Number(req.params.id);
    const r = await prisma.runRecord.findFirst({
      where: { id: runId, isPublic: true },
      include: { dataset: true, user: true }
    }) as any;

    if (!r) return res.status(404).json({ error: "报告不存在或未公开" });

    const result = {
      id: r.id,
      algorithmId: r.algorithmId,
      analysisName: r.analysisName,
      analystName: r.analystName,
      status: r.status,
      result: r.result ? JSON.parse(r.result) : null,
      params: r.params ? JSON.parse(r.params) : null,
      variables: r.variables ? JSON.parse(r.variables) : null,
      createdAt: r.createdAt,
      sharedNote: r.sharedNote,
      datasetName: r.dataset?.name,
      authorName: r.user?.name,
      authorUsername: r.user?.username
    };
    res.json(result);
  } catch (err) {
    console.error("public report detail error", err);
    res.status(500).json({ error: "获取报告失败" });
  }
});

// ── Dataset row preview for reporting center ──
app.get("/api/datasets/:id/preview", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const dsId = Number(req.params.id);
    const ds = await prisma.dataset.findFirst({ where: { id: dsId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!ds || !ds.versions.length) return res.status(404).json({ error: "Dataset not found" });
    const ver = ds.versions[0];
    const summary = JSON.parse(ver.summary || "{}");
    const filePath = ver.path;
    if (!fs.existsSync(filePath)) return res.json({ columns: summary.columns || [], rows: [] });
    const ext = path.extname(filePath).toLowerCase();
    let rows: any[][] = [];
    let columns: string[] = [];
    if (ext === ".csv") {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = parseSync(raw, { columns: true, skip_empty_lines: true });
      columns = parsed.length ? Object.keys(parsed[0]) : [];
      rows = parsed.slice(0, 100);
    } else if ([".xlsx", ".xls"].includes(ext)) {
      const wb = XLSX.readFile(filePath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (data.length) { 
        columns = data[0] as string[]; 
        rows = data.slice(1, 101).map(arr => {
            const rowObj: any = {};
            columns.forEach((col, idx) => {
                rowObj[col] = arr[idx];
            });
            return rowObj;
        });
      }
    }
    res.json({ datasetName: ds.name, columns, rows, rowCount: summary.rowCount || 0, colCount: columns.length });
  } catch (err) {
    console.error("dataset preview error", err);
    res.status(500).json({ error: "预览失败" });
  }
});


// 批量删除运行历史
app.post("/api/run-history/batch-delete", authMiddleware, async (req: AuthRequest, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: "ids must be an array" });
  try {
    const numIds = ids.map(id => Number(id)).filter(id => !Number.isNaN(id));
    if (numIds.length > 0) {
      await prisma.runRecord.deleteMany({ 
        where: { 
          id: { in: numIds },
          userId: req.userId // Isolation
        } 
      });
    }

    // Remove usage of recent_run.json
    res.json({ ok: true });
  } catch (err) {
    console.error("batch delete error", err);
    res.status(500).json({ error: "批量删除失败" });
  }
});

// 删除单条运行历史（报告）
app.delete("/api/run-history/:id", authMiddleware, async (req: AuthRequest, res) => {
  const raw = req.params.id;
  const idNum = Number(raw);
  const isNum = !Number.isNaN(idNum);
  try {
    if (isNum) {
      await prisma.runRecord.deleteMany({ 
        where: { 
          id: idNum,
          userId: req.userId // Isolation
        } 
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("delete run-history error", err);
    res.status(500).json({ error: "删除失败" });
  }
});

// --- Learning Progress API ---

app.get("/api/learning/progress", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [rows]: any = await pool.execute(
      "SELECT * FROM learningprogress WHERE userId = ?",
      [req.userId]
    );
    if (rows.length === 0) {
      return res.json({ completed: [], score: 0, badges: [], quality: {} });
    }
    const p = rows[0];
    res.json({
      score: p.score,
      completed: JSON.parse(p.completed || "[]"),
      badges: JSON.parse(p.badges || "[]"),
      quality: JSON.parse(p.quality || "{}")
    });
  } catch (err) {
    console.error("fetch progress error", err);
    res.status(500).json({ error: "加载进度失败" });
  }
});

// --- GenAI Lesson Content Management ---

// In compiled mode __dirname = dist/server/src, so we go up 3 levels to reach deploy_bundle/server
const LESSONS_FILE = path.resolve(__dirname, "../../../data/gen_ai_lessons.json");

app.get("/api/learning/lessons", async (_req, res) => {
  try {
    if (!fs.existsSync(LESSONS_FILE)) {
      return res.status(404).json({ error: "Lesson data not found" });
    }
    const data = fs.readFileSync(LESSONS_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("fetch lessons error", err);
    res.status(500).json({ error: "获取课程内容失败" });
  }
});

app.post("/api/learning/lessons/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    const isAdmin = currentUser?.username === 'admin' || currentUser?.username === 'root';
    
    if (!isAdmin) {
      return res.status(403).json({ error: "仅限管理员操作" });
    }

    const lessonId = req.params.id;
    const updateData = req.body;

    if (!fs.existsSync(LESSONS_FILE)) {
      return res.status(404).json({ error: "Lesson data not found" });
    }

    const raw = fs.readFileSync(LESSONS_FILE, "utf-8");
    let lessons = JSON.parse(raw);

    const index = lessons.findIndex((l: any) => l.id === lessonId);
    if (index === -1) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // Merge updates
    lessons[index] = { ...lessons[index], ...updateData };

    fs.writeFileSync(LESSONS_FILE, JSON.stringify(lessons, null, 2), "utf-8");
    res.json({ ok: true, lesson: lessons[index] });
  } catch (err) {
    console.error("update lesson error", err);
    res.status(500).json({ error: "更新课程内容失败" });
  }
});

// --- PowerBI Lesson Content Management ---

const PBI_LESSONS_FILE = path.resolve(__dirname, "../../../data/power_bi_lessons.json");

app.get("/api/powerbi/lessons", async (_req, res) => {
  try {
    if (!fs.existsSync(PBI_LESSONS_FILE)) {
      return res.status(404).json({ error: "PowerBI Lesson data not found" });
    }
    const data = fs.readFileSync(PBI_LESSONS_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("fetch pbi lessons error", err);
    res.status(500).json({ error: "获取 PowerBI 课程内容失败" });
  }
});

app.post("/api/powerbi/lessons/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    const isAdmin = currentUser?.username === 'admin' || currentUser?.username === 'root';
    
    if (!isAdmin) {
      return res.status(403).json({ error: "仅限管理员操作" });
    }

    const lessonId = req.params.id;
    const updateData = req.body;

    if (!fs.existsSync(PBI_LESSONS_FILE)) {
      return res.status(404).json({ error: "PowerBI Lesson data not found" });
    }

    const raw = fs.readFileSync(PBI_LESSONS_FILE, "utf-8");
    let lessons = JSON.parse(raw);

    const index = lessons.findIndex((l: any) => l.id === lessonId);
    if (index === -1) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // Merge updates
    lessons[index] = { ...lessons[index], ...updateData };

    fs.writeFileSync(PBI_LESSONS_FILE, JSON.stringify(lessons, null, 2), "utf-8");
    res.json({ ok: true, lesson: lessons[index] });
  } catch (err) {
    console.error("update pbi lesson error", err);
    res.status(500).json({ error: "更新 PowerBI 课程内容失败" });
  }
});

app.post("/api/learning/progress", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { score, completed, badges, quality } = req.body;
    await pool.execute(
      `INSERT INTO learningprogress (userId, score, completed, badges, quality, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       score = VALUES(score), 
       completed = VALUES(completed), 
       badges = VALUES(badges), 
       quality = VALUES(quality),
       updatedAt = VALUES(updatedAt)`,
      [
        req.userId, 
        score || 0, 
        JSON.stringify(completed || []), 
        JSON.stringify(badges || []), 
        JSON.stringify(quality || {}),
        new Date()
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("save progress error", err);
    res.status(500).json({ error: "保存进度失败" });
  }
});

app.get("/api/learning/records", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [exercises]: any = await pool.execute(
      "SELECT * FROM LabExerciseRecord WHERE userId = ? ORDER BY ts DESC LIMIT 100",
      [req.userId]
    );
    const [wrong]: any = await pool.execute(
      "SELECT * FROM WrongQuestion WHERE userId = ? ORDER BY ts DESC LIMIT 200",
      [req.userId]
    );
    const [challenges]: any = await pool.execute(
      "SELECT * FROM ChallengeAttempt WHERE userId = ? ORDER BY ts DESC LIMIT 50",
      [req.userId]
    );

    res.json({
      exerciseRuns: exercises.map((e: any) => ({
        ...e,
        passed: !!e.passed,
        isFinalStep: !!e.isFinalStep,
        checkpointResults: JSON.parse(e.checkpointResults || "[]"),
        tests: JSON.parse(e.tests || "[]")
      })),
      wrongQuestions: wrong,
      challengeAttempts: challenges.map((c: any) => ({
        ...c,
        passed: !!c.passed
      }))
    });
  } catch (err) {
    console.error("fetch records error", err);
    res.status(500).json({ error: "加载学习记录失败" });
  }
});

app.post("/api/learning/exercise-run", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const r = req.body;
    await pool.execute(
      `INSERT INTO LabExerciseRecord (id, userId, ts, courseId, courseTitle, cellId, cellLabel, code, passed, isFinalStep, error, checkpointResults, tests)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id, req.userId, r.ts, r.courseId, r.courseTitle, r.cellId, r.cellLabel || null, 
        r.code, r.passed ? 1 : 0, r.isFinalStep ? 1 : 0, r.error || null,
        JSON.stringify(r.checkpointResults || []), JSON.stringify(r.tests || [])
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("save exercise run error", err);
    res.status(500).json({ error: "保存练习记录失败" });
  }
});

app.post("/api/learning/wrong-question", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const w = req.body;
    await pool.execute(
      `INSERT INTO WrongQuestion (id, userId, ts, courseId, courseTitle, questionId, question, selectedAnswer, correctAnswer, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        w.id, req.userId, w.ts, w.courseId, w.courseTitle, w.questionId, w.question, 
        w.selectedAnswer, w.correctAnswer, w.explanation
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("save wrong question error", err);
    res.status(500).json({ error: "保存错题记录失败" });
  }
});

app.post("/api/learning/challenge-attempt", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const c = req.body;
    await pool.execute(
      `INSERT INTO ChallengeAttempt (id, userId, ts, courseId, courseTitle, score, passed, correct, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id, req.userId, c.ts, c.courseId, c.courseTitle, c.score, 
        c.passed ? 1 : 0, c.correct, c.total
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("save challenge attempt error", err);
    res.status(500).json({ error: "保存挑战记录失败" });
  }
});

const uploadDir = path.resolve(__dirname, "../uploads");
app.use(express.static(path.join(__dirname, "../../client/dist")));

// ─── Shared Log Stream (SSE) ────────────────────────────────────────────────
let logClients: any[] = [];
app.get("/api/logs/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const client = { res };
  logClients.push(client);
  req.on("close", () => {
    logClients = logClients.filter(c => c !== client);
  });
});
const broadcastLog = (msg: string) => {
  const data = JSON.stringify({ msg });
  logClients.forEach(c => c.res.write(`data: ${data}\n\n`));
};
// ──────────────────────────────────────────────────────────────────────────────
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
  { key: "advertising", path: path.resolve(__dirname, "../../samples/Advertising.csv"), label: "广告投放与销售额" },
  { key: "housing", path: path.resolve(__dirname, "../../samples/Housing.csv"), label: "房价影响因素分析" },
  { key: "employee", path: path.resolve(__dirname, "../../samples/Employee.csv"), label: "员工绩效与压力分析" },
  { key: "finance", path: path.resolve(__dirname, "../../samples/pro/finance_stock_prices.csv"), label: "金融股票价格" },
  { key: "medical", path: path.resolve(__dirname, "../../samples/pro/medical_patient_records.csv"), label: "医疗患者记录" },
  { key: "energy", path: path.resolve(__dirname, "../../samples/pro/energy_consumption.csv"), label: "建筑能耗" },
  { key: "manufacturing", path: path.resolve(__dirname, "../../samples/pro/manufacturing_quality.csv"), label: "制造质量控制" },
];

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

const OLLAMA_HOST = "http://10.246.97.159:11434";
const OLLAMA_MODEL = "deepseek-r1:1.5b";

const logAiEvent = (msg: string, extra?: Record<string, unknown>) => {
  console.log(`[AI] ${msg}`, extra ? JSON.stringify(extra) : "");
};

app.use("/api/connections", authMiddleware, connectionRouter);

app.get("/api/ai/models", async (_req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_HOST}/api/tags`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "无法连接到 Ollama 服务" });
  }
});

app.post("/api/ai/chat", authMiddleware, async (req: AuthRequest, res) => {
  logAiEvent("chat_request_received", { ts: new Date().toISOString(), userId: req.userId });
  try {
    const { messages } = req.body;
    const systemMsg = {
      role: 'system',
      content: '你是一个高效的 StatLab 数据专家。如果用户问的是简单问题（如问候、简单概念定义、单行确认等），请直接、精炼地回答，不要进行冗长的思考或前缀说明；只有当涉及复杂数据分析结果解读时，才进行深度分析。'
    };

    const response = await axios.post(`${OLLAMA_HOST}/api/chat`, {
      model: OLLAMA_MODEL,
      messages: [systemMsg, ...messages],
      stream: true, 
      options: { num_predict: 512, temperature: 0.7, top_p: 0.9 },
      keep_alive: "24h" 
    }, { responseType: 'stream', timeout: 300000 });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    response.data.on('data', (chunk: Buffer) => res.write(chunk));
    response.data.on('end', () => res.end());
    response.data.on('error', (err: any) => {
      if (!res.headersSent) res.status(500).json({ error: "AI 助手流式响应异常" });
      else res.end();
    });
  } catch (err: any) {
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

app.get("/api/datasets", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin or root
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    const isAdmin = currentUser?.username === 'admin' || currentUser?.username === 'root';

    const data = await prisma.dataset.findMany({
      where: isAdmin ? {} : {
        OR: [
          { userId: req.userId },
          { userId: null }
        ]
      },
      include: { versions: true },
      orderBy: { createdAt: "desc" }
    });
    const mapped: DatasetInfo[] = data.map((d) => ({
      id: d.id,
      name: d.name,
      originalFilename: d.originalFilename,
      createdAt: d.createdAt.toISOString(),
      versions: d.versions.map((v) => versionToMeta({ ...v, dataset: d })),
      canDelete: isAdmin || (!!d.userId && d.userId === req.userId)
    }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch datasets" });
  }
});

app.get("/api/datasets/:datasetId/versions/:versionId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const versionId = Number(req.params.versionId);
    const v = await prisma.datasetVersion.findFirst({ 
      where: { 
        id: versionId,
        dataset: { OR: [{ userId: req.userId }, { userId: null }] }
      } 
    });
    if (!v) return res.status(404).json({ error: "version not found or access denied" });
    res.json(versionToMeta(v));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch version" });
  }
});

app.get("/api/datasets/version/:versionId/full-data", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const versionId = Number(req.params.versionId);
    const v = await prisma.datasetVersion.findFirst({ 
      where: { 
        id: versionId,
        dataset: { OR: [{ userId: req.userId }, { userId: null }] }
      } 
    });
    if (!v) return res.status(404).json({ error: "version not found" });

    const fullData = loadDataset(v.path);
    res.json(fullData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load full dataset data" });
  }
});

app.post("/api/datasets/import-sample/:name", authMiddleware, async (req: AuthRequest, res) => {
  const name = req.params.name;
  
  const resolveSample = (p: string) => {
    const trials = [
      path.resolve(__dirname, "../../", p),              // For explicit dev
      path.resolve(__dirname, "../../../../../", p),      // For dist/server/src
      path.resolve(process.cwd(), p),                     // If executed at root
      path.resolve(process.cwd(), "..", p)                // If executed at server/
    ];
    for (const t of trials) {
      if (fs.existsSync(t)) return t;
    }
    return trials[0];
  };

  const sampleMap: Record<string, { path: string, label: string }> = {
    advertising: { path: resolveSample("samples/Advertising.csv"), label: "广告投放与销售额" },
    housing: { path: resolveSample("samples/Housing.csv"), label: "房价影响因素分析" },
    employee: { path: resolveSample("samples/Employee.csv"), label: "员工绩效与压力分析" },
    finance: { path: resolveSample("samples/pro/finance_stock_prices.csv"), label: "金融股票价格" },
    medical: { path: resolveSample("samples/pro/medical_patient_records.csv"), label: "医疗患者记录" },
    energy: { path: resolveSample("samples/pro/energy_consumption.csv"), label: "建筑能耗" },
    manufacturing: { path: resolveSample("samples/pro/manufacturing_quality.csv"), label: "制造质量" }
  };
  const config = sampleMap[name.toLowerCase()];
  if (!config) return res.status(404).json({ error: "sample not found" });

  try {
    const result = await createDatasetFromFile(config.path, `${name}.csv`, config.label, req.userId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to import sample" });
  }
});

app.post("/api/datasets/upload", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  try {
    const ext = path.extname(req.file.originalname || "").toLowerCase();
    let storedPath = req.file.path;
    if (ext && !req.file.path.endsWith(ext)) {
      const targetPath = `${req.file.path}${ext}`;
      fs.renameSync(req.file.path, targetPath);
      storedPath = targetPath;
    }

    const result = await createDatasetFromFile(storedPath, req.file.originalname, req.file.originalname, req.userId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to import" });
  }
});

app.delete("/api/datasets/:datasetId", authMiddleware, async (req: AuthRequest, res) => {
  const datasetId = Number(req.params.datasetId);
  try {
    // Allow deleting current-user datasets and seeded shared datasets.
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    const isAdmin = currentUser?.username === 'admin' || currentUser?.username === 'root';
    
    const dataset = await prisma.dataset.findFirst({
      where: isAdmin ? { id: datasetId } : {
        id: datasetId,
        userId: req.userId
      }
    });
    if (!dataset) return res.status(403).json({ error: "Access denied: dataset is not owned by current user" });

    await prisma.runRecord.deleteMany({ where: { datasetId } });
    await prisma.datasetVersion.deleteMany({ where: { datasetId } });
    await prisma.dataset.delete({ where: { id: datasetId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to delete dataset" });
  }
});

app.delete("/api/datasets/version/:versionId", authMiddleware, async (req: AuthRequest, res) => {
  const versionId = Number(req.params.versionId);
  if (Number.isNaN(versionId)) return res.status(400).json({ error: "invalid version id" });
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    const isAdmin = currentUser?.username === 'admin' || currentUser?.username === 'root';

    const version = await prisma.datasetVersion.findFirst({ 
      where: isAdmin ? { id: versionId } : { 
        id: versionId,
        dataset: { userId: req.userId }
      } 
    });
    if (!version) return res.status(404).json({ error: "version not found or access denied" });

    const versionCount = await prisma.datasetVersion.count({ where: { datasetId: version.datasetId } });
    if (versionCount <= 1) return res.status(400).json({ error: "至少保留一个版本" });

    await prisma.runRecord.deleteMany({ where: { datasetVersionId: versionId } });
    await prisma.datasetVersion.delete({ where: { id: versionId } });
    res.json({ ok: true });
  } catch (err) {
    console.error("delete version error", err);
    res.status(500).json({ error: "failed to delete version" });
  }
});

app.get("/api/datasets/version/:versionId/download", authMiddleware, async (req: AuthRequest, res) => {
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
    const version = await prisma.datasetVersion.findFirst({
      where: { 
        id: versionId,
        dataset: { OR: [{ userId: req.userId }, { userId: null }] }
      },
      include: { dataset: true }
    });
    if (!version) return res.status(404).json({ error: "version not found or access denied" });

    const filename = `${version.dataset.name.replace(/\.[^/.]+$/, "")}_v${version.version}.csv`;
    res.download(version.path, filename);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to download dataset" });
  }
});

app.post("/api/run", authMiddleware, async (req: AuthRequest, res) => {
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
      version = await prisma.datasetVersion.findFirst({ 
        where: { 
          id: Number(datasetVersionId),
          dataset: {
            OR: [
              { userId: req.userId },
              { userId: null }
            ]
          }
        } 
      });
      if (!version) return res.status(404).json({ error: "dataset version not found or access denied" });
      dataset = loadDataset(version.path);
    }

    // Apply data filters if present
    const filters = params.dataFilters as any;
    if (filters && typeof filters === "object") {
      dataset = dataset.filter(row => {
        for (const [feat, condition] of Object.entries(filters)) {
          const valStr = String(row[feat] ?? "");
          const numVal = Number(valStr);
          const cond = condition as any;
          if (cond.min !== undefined && !isNaN(numVal) && numVal < cond.min) return false;
          if (cond.max !== undefined && !isNaN(numVal) && numVal > cond.max) return false;
          if (cond.eq !== undefined && cond.eq !== "" && valStr !== cond.eq) return false;
          if (cond.contains !== undefined && cond.contains !== "" && !valStr.toLowerCase().includes(cond.contains.toLowerCase())) return false;
        }
        return true;
      });
    }

    const runRecord = await prisma.runRecord.create({
      data: {
        userId: req.userId,
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
        broadcastLog(line);
        console.log("[ML LOG]", msg);
      };
      const result = await module.run({ dataset, variables, params, version, onLog });
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

app.get("/api/python-lab/health", async (req, res) => {
  try {
    const { getPythonMLHealth } = require("../analysis/pythonBridge");
    const health = await getPythonMLHealth();
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/python-lab/run", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { code, datasetVersionId, tests, stepTests } = req.body;
    let dataset: any[] = [];
    console.log(`[PythonLab Run] Request datasetVersionId: ${datasetVersionId}`);
    if (datasetVersionId) {
      const version = await prisma.datasetVersion.findFirst({ 
        where: { 
          id: Number(datasetVersionId),
          dataset: { OR: [{ userId: req.userId }, { userId: null }] }
        },
        include: { dataset: true }
      });
      console.log(`[PythonLab Run] Found version? ${!!version}, path: ${version?.path}, dataset name: ${version?.dataset?.name}`);
      if (version) {
        dataset = loadDataset(version.path);
        console.log(`[PythonLab Run] loadDataset returned array of length: ${dataset.length}`);
      }
    }
    const result = await runCustomPythonCode(code, dataset, tests, stepTests);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/run-history", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const records = await prisma.runRecord.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { dataset: true }
    });
    const mapped = records.map((r) => ({
      id: String(r.id),
      algoId: r.algorithmId,
      algoName: "",
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

app.post("/api/run/:runId/predict", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const runId = Number(req.params.runId);
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: "rows must be an array" });
    if (rows.length > MAX_PREDICT_ROWS) return res.status(400).json({ error: `Too many rows, max ${MAX_PREDICT_ROWS}` });

    const run = await prisma.runRecord.findFirst({
      where: {
        id: runId,
        userId: req.userId
      }
    });

    if (!run) return res.status(404).json({ error: "Runtime record not found or access denied" });
    if (run.status !== "completed" || !run.result) {
      return res.status(400).json({ error: "Model is not ready for prediction" });
    }

    const result = JSON.parse(run.result);
    // Registry models often store the package in extras or as the core result
    const modelPackage = result.extras?.modelPackage || result.modelPackage || result;
    
    if (!modelPackage || !modelPackage.type) {
      return res.status(400).json({ error: "Record does not contain a valid model package" });
    }

    const predictionResult = predictFromModelPackage(modelPackage, rows);
    res.json(predictionResult);
  } catch (err: any) {
    console.error("Prediction error:", err);
    res.status(500).json({ error: err.message || "Prediction failed" });
  }
});

// ─── Data Processing API ────────────────────────────────────────────────────
app.post("/api/datasets/:datasetId/process", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const datasetId = Number(req.params.datasetId);
    const { versionId, operation, columns } = req.body as {
      versionId: number;
      operation: string;
      columns: string[];
    };

    const version = await prisma.datasetVersion.findFirst({ 
      where: { 
        id: versionId,
        dataset: { OR: [{ userId: req.userId }, { userId: null }] }
      },
      include: { dataset: true }
    });
    if (!version) return res.status(404).json({ error: "version not found or access denied" });

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

    // If the original dataset was shared (null userId), create a NEW dataset for this user
    let targetDatasetId = datasetId;
    if (version.dataset.userId === null) {
        const newDataset = await prisma.dataset.create({
            data: {
                name: `[处理] ${version.dataset.name}`,
                userId: req.userId,
                originalFilename: version.dataset.originalFilename,
            }
        });
        targetDatasetId = newDataset.id;
    }

    // Determine next version number for the target dataset
    const allVersions = await prisma.datasetVersion.findMany({ where: { datasetId: targetDatasetId }, orderBy: { version: "desc" } });
    const nextVersion = (allVersions[0]?.version ?? 0) + 1;

    const newVersion = await prisma.datasetVersion.create({
      data: {
        datasetId: targetDatasetId,
        version: nextVersion,
        path: newPath,
        summary: JSON.stringify({ columns: newColumns, sampleRows, rowCount })
      }
    });

    res.json({
      datasetId: targetDatasetId,
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

app.get("/api/stats/:versionId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const version = await prisma.datasetVersion.findFirst({
      where: { id: Number(req.params.versionId) },
    });
    if (!version) return res.status(404).json({ error: "Version not found" });

    const data = loadDataset(version.path);
    const columns = Object.keys(data[0] || {});
    const stats: Record<string, any> = { rowCount: data.length };

    for (const col of columns) {
       const rawVals = data.map(r => r[col]);
       const nullCount = rawVals.filter(v => v === null || v === undefined || v === "").length;
       const uniqueCount = new Set(rawVals).size;
       
       const numericVals = rawVals.map(v => Number(v)).filter(v => !isNaN(v) && v !== null);
       
       if (numericVals.length > 0) {
          numericVals.sort((a, b) => a - b);
          const mean = numericVals.reduce((a, b) => a + b, 0) / numericVals.length;
          const std = Math.sqrt(numericVals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(numericVals.length - 1, 1));
          
          const getPercentile = (p: number) => {
            const pos = (numericVals.length - 1) * p;
            const base = Math.floor(pos);
            const rest = pos - base;
            if (numericVals[base + 1] !== undefined) {
              return numericVals[base] + rest * (numericVals[base + 1] - numericVals[base]);
            } else {
              return numericVals[base];
            }
          };

          stats[col] = {
            type: 'numeric',
            mean: Number(mean.toFixed(4)),
            std: Number(std.toFixed(4)),
            min: numericVals[0],
            max: numericVals[numericVals.length - 1],
            q1: Number(getPercentile(0.25).toFixed(4)),
            q2: Number(getPercentile(0.50).toFixed(4)),
            q3: Number(getPercentile(0.75).toFixed(4)),
            count: numericVals.length,
            nullCount,
            uniqueCount
          };
       } else {
          stats[col] = {
            type: 'categorical',
            nullCount,
            uniqueCount,
            count: rawVals.length - nullCount
          };
       }
    }
    res.json(stats);
  } catch (err) {
    console.error("Stats calculation error:", err);
    res.status(500).json({ error: "Failed to compute stats" });
  }
});

app.post("/api/process", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { datasetVersionIds, steps, outputName } = req.body;
    if (!req.body || (datasetVersionIds === undefined && steps === undefined)) {
       return res.status(400).json({ error: "Invalid request body" });
    }
    if (!Array.isArray(datasetVersionIds) || datasetVersionIds.length === 0) {
      return res.status(400).json({ error: "No dataset versions specified" });
    }

    const newVersions = [];
    const totalLogs = [];

    for (const datasetVersionId of datasetVersionIds) {
      const version = await prisma.datasetVersion.findFirst({
        where: {
          id: Number(datasetVersionId),
          dataset: { OR: [{ userId: req.userId }, { userId: null }] }
        },
        include: { dataset: true }
      });
      if (!version) continue;

      let data: Record<string, string>[] = loadDataset(version.path);
      const logs: string[] = [];
      let totalModified = 0;

      // ... existing steps loop ...
      for (const step of steps) {
        let op = step.type;
        const params = step.params || {};
        const selectedCols = params.selectedCols || [];

        if (op === "normalize") op = "minmax";
        if (op === "fill_missing") op = "fill_mean";
        if (op === "encode") op = "label_encode";
        if (op === "filter") op = "sql_filter";

        const columns = Object.keys(data[0] || {});
        const targetCols = selectedCols.length > 0 ? selectedCols : columns.filter((col) => {
          const vals = data.slice(0, 100).map((r) => Number(r[col])).filter((v) => !isNaN(v));
          return vals.length > 0;
        });

        switch (op) {
          case "minmax": {
            const targetMin = params.min ?? 0;
            const targetMax = params.max ?? 1;
            const rangeInfo: Record<string, { min: number; max: number }> = {};
            for (const col of targetCols) {
              const vals = data.map((r) => Number(r[col])).filter((v) => !isNaN(v));
              if (vals.length > 0) rangeInfo[col] = { min: Math.min(...vals), max: Math.max(...vals) };
            }
            data = data.map((row) => {
              const updated = { ...row };
              for (const col of Object.keys(rangeInfo)) {
                const v = Number(row[col]);
                if (!isNaN(v)) {
                  const { min, max } = rangeInfo[col];
                  const scaled = max === min ? 0 : (v - min) / (max - min);
                  updated[col] = String((scaled * (targetMax - targetMin) + targetMin).toFixed(4));
                }
              }
              return updated;
            });
            logs.push(`[Normalize] Processed ${Object.keys(rangeInfo).length} columns.`);
            break;
          }
          case "standardize": {
            const statInfo: Record<string, { mean: number; sd: number }> = {};
            for (const col of targetCols) {
              const vals = data.map((r) => Number(r[col])).filter((v) => !isNaN(v));
              if (vals.length > 0) {
                const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(vals.length - 1, 1));
                statInfo[col] = { mean, sd };
              }
            }
            data = data.map((row) => {
              const updated = { ...row };
              for (const col of Object.keys(statInfo)) {
                const v = Number(row[col]);
                if (!isNaN(v)) {
                  const { mean, sd } = statInfo[col];
                  updated[col] = sd === 0 ? "0" : String(((v - mean) / sd).toFixed(4));
                }
              }
              return updated;
            });
            logs.push(`[Standardize] Processed ${Object.keys(statInfo).length} columns.`);
            break;
          }
          case "fill_mean": {
                const method = params.method || "mean";
                const constVal = params.value || "0";
                if (method === "constant") {
                  data = data.map(row => {
                    const updated = { ...row };
                    for (const col of targetCols) {
                      if (!updated[col] || updated[col] === "") { updated[col] = constVal; totalModified++; }
                    }
                    return updated;
                  });
                } else {
                  for (const col of targetCols) {
                    const vals = data.map(r => Number(r[col])).filter(v => !isNaN(v));
                    if (vals.length === 0) continue;
                    let fillVal = 0;
                    if (method === "mean") fillVal = vals.reduce((a,b)=>a+b,0)/vals.length;
                    else fillVal = vals.sort((a,b)=>a-b)[Math.floor(vals.length/2)];
                    data = data.map(row => {
                       if (!row[col] || row[col] === "") { totalModified++; return { ...row, [col]: String(fillVal.toFixed(4)) }; }
                       return row;
                    });
                  }
                }
                logs.push(`[Fill] Processed ${targetCols.length} columns via ${method}.`);
                break;
          }
          case "label_encode": {
            for (const col of targetCols) {
              const mapping: Record<string, number> = {};
              let idx = 0;
              data.forEach(r => { if (r[col] && mapping[r[col]] === undefined) mapping[r[col]] = idx++; });
              data = data.map(row => (row[col] ? { ...row, [col]: String(mapping[row[col]]) } : row));
            }
            logs.push(`[Encode] Applied label encoding to ${targetCols.length} columns.`);
            break;
          }
          case "add_col": {
            const colTitle = params.columnTitle || "New_Column";
            const formula = params.content || "";
            const columns = Object.keys(data[0] || {});
            
            data = data.map(row => {
              let evalStr = formula;
              // Sort columns by length descending to prevent partial replacements (e.g. "Col10" replaced by "Col1")
              const sortedCols = [...columns].sort((a, b) => b.length - a.length);
              
              sortedCols.forEach(col => {
                const escapedCol = col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedCol}\\b`, 'g');
                const val = row[col];
                
                // Determine if value is numeric or string for appropriate JS evaluation
                const isNum = val !== "" && val !== null && !isNaN(Number(val));
                const formattedVal = isNum ? val : `"${String(val).replace(/"/g, '\\"')}"`;
                evalStr = evalStr.replace(regex, formattedVal);
              });

              let finalVal: any = evalStr;
              try {
                // Basic safety check for characters allowed in formula
                if (/^[ \d.+\-*/%()"'a-zA-Z\u4e00-\u9fa5,]*$/.test(evalStr)) {
                   finalVal = eval(evalStr);
                }
              } catch (e) {
                // If evaluation fails, keep the substituted string as is
              }
              
              return { ...row, [colTitle]: String(finalVal) };
            });
            logs.push(`[AddColumn] Added new column "${colTitle}" using formula evaluation.`);
            break;
          }
          case "sql_filter": {
            const query = params.query || "";
            const column = params.column;
            const op_type = params.operator || "==";
            const value = params.value;

            if (column && value !== undefined) {
               data = data.filter(row => {
                  const v = row[column];
                  const qv = String(value);
                  const nv = Number(v);
                  const nqv = Number(value);
                  
                  switch (op_type) {
                    case "==": return v === qv;
                    case "!=": return v !== qv;
                    case ">": return !isNaN(nv) && nv > nqv;
                    case "<": return !isNaN(nv) && nv < nqv;
                    case ">=": return !isNaN(nv) && nv >= nqv;
                    case "<=": return !isNaN(nv) && nv <= nqv;
                    case "contains": return v && v.includes(qv);
                    default: return true;
                  }
               });
               logs.push(`[Filter] Applied condition: ${column} ${op_type} ${value}.`);
            } else {
              const match = query.match(/(\w+)\s*([><=])\s*([\d.]+)/);
              if (match) {
                const [_, col, qOp, qVal] = match;
                const threshold = Number(qVal);
                const beforeCount = data.length;
                data = data.filter(r => {
                  const val = Number(r[col]);
                  if (isNaN(val)) return true;
                  if (qOp === ">") return val > threshold;
                  if (qOp === "<") return val < threshold;
                  if (qOp === "=") return val === threshold;
                  return true;
                });
                logs.push(`[Filter] Query "${query}" removed ${beforeCount - data.length} rows.`);
              }
            }
            break;
          }
          case "join":
          case "merge": {
            const targetId = params.targetDatasetId;
            const leftKey = params.leftKey;
            const rightKey = params.rightKey;
            const joinType = params.joinType || "inner";

            if (!targetId || !leftKey || !rightKey) {
              logs.push(`[Join] Skipped due to missing parameters (targetId=${targetId}, left=${leftKey}, right=${rightKey}).`);
              break;
            }

            const targetVersion = await prisma.datasetVersion.findFirst({
              where: { datasetId: Number(targetId) },
              orderBy: { version: "desc" }
            });

            if (!targetVersion) {
              logs.push(`[Join] Target dataset version not found for ID ${targetId}.`);
              break;
            }

            const targetData = loadDataset(targetVersion.path);
            const joinedData: any[] = [];
            
            data.forEach(lRow => {
              const matches = targetData.filter(rRow => String(rRow[rightKey]) === String(lRow[leftKey]));
              if (matches.length > 0) {
                matches.forEach(m => joinedData.push({ ...m, ...lRow }));
              } else if (joinType === "left" || joinType === "outer") {
                joinedData.push({ ...lRow });
              }
            });
            
            data = joinedData;
            logs.push(`[Join] Joined with dataset ${targetId} (${joinType}). Resulting rows: ${data.length}`);
            break;
          }
        }
      }

      // Final CSV Build
      const finalKeys = Object.keys(data[0] || {});
      const csvStr = [finalKeys.join(","), ...data.map(r => finalKeys.map(k => `"${(r[k]||"").replace(/"/g,'""')}"`).join(","))].join("\n");
      const finalFilename = `batch_${Date.now()}_${path.basename(version.path)}`;
      const finalPath = path.join(uploadDir, finalFilename);
      fs.writeFileSync(finalPath, csvStr);

      const allVersions = await prisma.datasetVersion.findMany({ where: { datasetId: version.datasetId }, orderBy: { version: "desc" } });
      
      let targetDatasetId = version.datasetId;
      let targetVersionNum = (allVersions[0]?.version ?? 0) + 1;

      // If user provided a name, create a NEW top-level dataset
      if (outputName) {
        const dsName = datasetVersionIds.length > 1 ? `${outputName} (${version.dataset.name})` : outputName;
        const newDataset = await prisma.dataset.create({
          data: {
            name: dsName,
            userId: req.userId,
            originalFilename: version.dataset.originalFilename
          }
        });
        targetDatasetId = newDataset.id;
        targetVersionNum = 1;
      }

      const sample = data.slice(0, 100);
      const newV = await prisma.datasetVersion.create({
        data: {
          datasetId: targetDatasetId,
          version: targetVersionNum,
          path: finalPath,
          summary: JSON.stringify({ columns: inferColumns(data.slice(0, 800)), sampleRows: sample, rowCount: data.length })
        },
        include: { dataset: true }
      });
      newVersions.push(versionToMeta(newV));
      totalLogs.push(...logs);
    }

    res.json({ newVersions, logs: totalLogs });
  } catch (error: any) {
    console.error("Batch Process Error:", error);
    res.status(500).json({ error: error.message || "Batch process failed" });
  }
});

type PdfTable = { title?: string; columns: string[]; rows: (string | number | null | undefined)[][] };
type PdfChart = { title?: string; dataUrl: string };

app.post("/api/reports/pdf", authMiddleware, async (req: AuthRequest, res) => {
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
console.log(`[Config] Final Port selected: ${basePort}`);
seedSampleDatasets()
  .then(() => seedAdminUser())
  .finally(() => startServer(basePort));

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

async function seedAdminUser() {
  try {
    const adminHashed = await bcrypt.hash("123456", 10);
    const rootHashed = await bcrypt.hash("root", 10);
    
    // Seed admin
    const existingAdmin = await prisma.user.findFirst({ where: { username: "admin" } });
    if (!existingAdmin) {
      await prisma.user.create({
        data: { username: "admin", password: adminHashed, name: "Administrator" }
      });
      console.log("Seeded admin user (admin / 123456)");
    } else {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { password: adminHashed }
      });
      console.log("Admin user password refreshed (admin / 123456)");
    }

    // Seed root
    const existingRoot = await prisma.user.findFirst({ where: { username: "root" } });
    if (!existingRoot) {
      await prisma.user.create({
        data: { username: "root", password: rootHashed, name: "Root Admin" }
      });
      console.log("Seeded root user (root / root)");
    } else {
      await prisma.user.update({
        where: { id: existingRoot.id },
        data: { password: rootHashed }
      });
      console.log("Root user password refreshed (root / root)");
    }
  } catch (err) {
    console.warn("Seed users failed:", err);
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

async function createDatasetFromFile(filePath: string, originalFilename: string, name: string, userId?: string) {
  const { sampleRecords, rowCount } = await sampleDataset(filePath, 2000);
  const columns = inferColumns(sampleRecords);
  const sampleRows = sampleRecords.slice(0, 200);
  const dataset = await prisma.dataset.create({
    data: {
      name,
      userId, // Link to user
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
    datasetName: v.dataset?.name,
    version: v.version,
    path: v.path,
    rowCount: summary.rowCount ?? (summary.sampleRows ? summary.sampleRows.length : 0),
    columns: summary.columns || [],
    sampleRows: summary.sampleRows || []
  };
}
