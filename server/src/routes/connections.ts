import express from "express";
import { PrismaClient } from "@prisma/client";
import { encrypt, decrypt } from "../crypto";
import { DB_PRESETS } from "../db-presets";
import { testConnection, fetchTableTree, previewTable, autoTagVariables } from "../db-connector";
import { DbConnectionType, DbConnectionInfo } from "@statlab/shared";

export const connectionRouter = express.Router();
const prisma = new PrismaClient();

// Memory cache for active "Range Control" datasets
// In production, use Redis or SQLite cache
export const DATASET_CACHE = new Map<string, any>();

connectionRouter.get("/presets", (req, res) => {
    const list: DbConnectionInfo[] = DB_PRESETS.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        isPreset: true
    }));
    res.json(list);
});

connectionRouter.get("/saved", async (req, res) => {
    const saved = await prisma.savedConnection.findMany();
    const list: DbConnectionInfo[] = saved.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type as DbConnectionType,
        isPreset: false
    }));
    res.json(list);
});

async function resolveConfig(connectionId: string) {
    const preset = DB_PRESETS.find(p => p.id === connectionId);
    if (preset) return { type: preset.type, config: preset.config };

    const saved = await prisma.savedConnection.findUnique({ where: { id: connectionId } });
    if (!saved) throw new Error("连接信息未找到");

    return {
        type: saved.type as DbConnectionType,
        config: {
            host: saved.host,
            port: saved.port,
            database: saved.database,
            user: saved.user,
            password: decrypt(saved.password)
        }
    };
}

connectionRouter.post("/custom/test", async (req, res) => {
    const { type, host, port, database, user, password } = req.body;
    try {
        await testConnection(type, { host, port, database, user, password });
        res.json({ ok: true, message: "连接成功" });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

connectionRouter.post("/:connectionId/test", async (req, res) => {
    try {
        const { type, config } = await resolveConfig(req.params.connectionId);
        await testConnection(type, config);
        res.json({ ok: true, message: "连接成功" });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

connectionRouter.post("/custom/save", async (req, res) => {
    const { name, type, host, port, database, user, password } = req.body;
    try {
        const saved = await prisma.savedConnection.create({
            data: {
                name, type, host, port: Number(port), database, user,
                password: encrypt(password)
            }
        });
        res.json({ id: saved.id, name: saved.name });
    } catch (err: any) {
        res.status(500).json({ error: "保存失败" });
    }
});

// Update saved connection (rename or creds)
connectionRouter.patch("/:connectionId", async (req, res) => {
    const { connectionId } = req.params;
    const { name, host, port, database, user, password, type } = req.body;
    try {
        const data: any = {};
        if (name) data.name = name;
        if (type) data.type = type;
        if (host) data.host = host;
        if (port !== undefined) data.port = Number(port);
        if (database) data.database = database;
        if (user) data.user = user;
        if (password) data.password = encrypt(password);
        const saved = await prisma.savedConnection.update({ where: { id: connectionId }, data });
        res.json({ ok: true, saved });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "更新失败" });
    }
});

// Delete saved connection
connectionRouter.delete("/:connectionId", async (req, res) => {
    const { connectionId } = req.params;
    try {
        await prisma.savedConnection.delete({ where: { id: connectionId } });
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "删除失败" });
    }
});

connectionRouter.get("/:connectionId/tree", async (req, res) => {
    try {
        const { type, config } = await resolveConfig(req.params.connectionId);
        const tree = await fetchTableTree(type, config);
        res.json(tree);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

connectionRouter.post("/:connectionId/preview", async (req, res) => {
    const { table, columns, timeFilter, limit } = req.body;
    try {
        const { type, config } = await resolveConfig(req.params.connectionId);
        const preview = await previewTable(
            type,
            config,
            table,
            limit || 100,
            columns,
            timeFilter ? { column: timeFilter.column, start: timeFilter.start, end: timeFilter.end } : undefined
        );
        const tagged = autoTagVariables(preview.columns);
        res.json({ ...preview, tagged });
    } catch (err: any) {
        const msg = err?.message || "预览失败";
        const status = msg.includes("非法字符") ? 400 : 500;
        res.status(status).json({ error: msg });
    }
});

connectionRouter.post("/dataset/build", async (req, res) => {
    const { connectionId, table, rangeFilters, sampling, columns, timeColumn } = req.body;

    if (!rangeFilters || (!rangeFilters.timeRangePreset && !rangeFilters.timeRange)) {
        return res.status(400).json({ error: "制造数据量大，请先选择分析时间段 (范围控制)" });
    }

    const now = Date.now();
    const presetToMs = (preset?: string) => {
        if (preset === "1h") return 3600_000;
        if (preset === "1d") return 24 * 3600_000;
        if (preset === "7d") return 7 * 24 * 3600_000;
        if (preset === "30d") return 30 * 24 * 3600_000;
        return 0;
    };

    const start = rangeFilters?.timeRange?.start
        || (rangeFilters?.timeRangePreset ? new Date(now - presetToMs(rangeFilters.timeRangePreset)).toISOString() : undefined);
    const end = rangeFilters?.timeRange?.end || new Date().toISOString();
    const useTimeFilter = timeColumn && start;

    try {
        const { type, config } = await resolveConfig(connectionId);
        let limit = 100000;
        if (sampling === "10k") limit = 10000;
        if (sampling === "1k") limit = 1000;

        // In MVP, we fetch once and store in memory.
        // In production, store metadata and query dynamically from analysis engine.
        const fullData = await previewTable(type, config, table, limit, columns, useTimeFilter ? { column: timeColumn, start, end } : undefined);
        const datasetId = `db-${Date.now()}`;

        DATASET_CACHE.set(datasetId, {
            id: datasetId,
            sourceType: "db",
            name: `${table} (${rangeFilters.timeRangePreset || "自定义范围"})`,
            columns: fullData.columns,
            previewRows: fullData.rows,
            appliedFilters: rangeFilters
        });

        res.json({ datasetId });
    } catch (err: any) {
        const msg = err?.message || "构建失败";
        const status = msg.includes("非法字符") ? 400 : 500;
        res.status(status).json({ error: msg });
    }
});

connectionRouter.get("/dataset/:datasetId", (req, res) => {
    const ds = DATASET_CACHE.get(req.params.datasetId);
    if (!ds) return res.status(404).json({ error: "数据集过时或不存在，请重新取数" });
    res.json(ds);
});
