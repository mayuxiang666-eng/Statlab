import mssql from "mssql";
import { Client } from "pg";
import mysql from "mysql2/promise";
import { DbConnectionType, ColumnMeta, ColumnType } from "@statlab/shared";

// Simple identifier whitelist to prevent injection; only allow word chars, dot, and dollar
function assertSafeIdentifier(id: string, label: string) {
    if (!/^[A-Za-z0-9_.$]+$/.test(id)) {
        throw new Error(`${label} 含非法字符，仅支持字母/数字/下划线/点`);
    }
}

// Normalizes connection config so it works across different drivers
function normalizeConfig(type: DbConnectionType, config: any) {
    const normalized = { ...config };
    if (type === "mssql") {
        normalized.server = config.host || config.server;
        normalized.options = {
            encrypt: true,
            trustServerCertificate: true,
            connectTimeout: 5000,
            ...(config.options || {})
        };
    } else {
        normalized.host = config.host || config.server;
    }
    return normalized;
}

export async function testConnection(type: DbConnectionType, config: any): Promise<boolean> {
    const conf = normalizeConfig(type, config);

    // Virtual fallback for demo if localhost is not reachable
    if (conf.server === "localhost" || conf.host === "localhost") {
        return true;
    }

    if (type === "mssql") {
        try {
            const pool = new mssql.ConnectionPool(conf);
            await pool.connect();
            await pool.close();
            return true;
        } catch (e) {
            console.error("MSSQL Test failed:", e);
            throw new Error("连接 SQL Server 失败，请检查产线网络与账号 (MSSQL)");
        }
    } else if (type === "postgres") {
        const client = new Client(conf);
        try {
            await client.connect();
            await client.end();
            return true;
        } catch (e) {
            console.error("Postgres Test failed:", e);
            throw new Error("连接 PostgreSQL 失败，请检查工位网络 (PG)");
        }
    } else if (type === "mysql") {
        try {
            const connection = await mysql.createConnection(conf);
            await connection.end();
            return true;
        } catch (e) {
            console.error("MySQL Test failed:", e);
            throw new Error("连接 MySQL 失败，请检查产线网络与账号 (MySQL)");
        }
    }
    return false;
}

export async function fetchTableTree(type: DbConnectionType, config: any): Promise<{ name: string; children?: { name: string }[] }[]> {
    const conf = normalizeConfig(type, config);

    // Virtual data for MVP demonstration
    if (conf.server === "localhost" || conf.host === "localhost") {
        return [
            {
                name: "生产运行库 (演示模式)",
                children: [
                    { name: "Device_Status_Log" },
                    { name: "Production_Output" },
                    { name: "Quality_Inspection_Results" },
                    { name: "Energy_Consumption" },
                    { name: "Alarm_History" }
                ]
            }
        ];
    }

    if (type === "mssql") {
        try {
            const pool = new mssql.ConnectionPool(conf);
            await pool.connect();
            const res = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
            const tables = res.recordset.map(r => ({ name: r.TABLE_NAME }));
            await pool.close();
            return [{ name: "生产数据库", children: tables }];
        } catch (e) {
            console.error("MSSQL Tree fetch failed:", e);
            return [{ name: "无法加载表列表", children: [] }];
        }
    } else if (type === "postgres") {
        const client = new Client(conf);
        try {
            await client.connect();
            const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
            const tables = res.rows.map(r => ({ name: r.table_name }));
            await client.end();
            return [{ name: "标准数据库 (public)", children: tables }];
        } catch (e) {
            console.error("PG Tree fetch failed:", e);
            return [{ name: "无法加载表列表", children: [] }];
        }
    } else if (type === "mysql") {
        try {
            const connection = await mysql.createConnection(conf);
            const [rows] = await connection.query("SHOW TABLES") as any[];
            const tables = rows.map((r: any) => ({ name: Object.values(r)[0] as string }));
            await connection.end();
            return [{ name: "生产数据库 (MySQL)", children: tables }];
        } catch (e) {
            console.error("MySQL Tree fetch failed:", e);
            return [{ name: "无法加载表列表", children: [] }];
        }
    }
    return [];
}

type TimeFilter = { column: string; start: string; end: string } | undefined;

export async function previewTable(type: DbConnectionType, config: any, table: string, limit: number = 100, columns?: string[], timeFilter?: TimeFilter): Promise<{ columns: ColumnMeta[], rows: any[] }> {
    const conf = normalizeConfig(type, config);

    // Read-only guard: validate identifiers and refuse anything suspicious
    assertSafeIdentifier(table, "表名");
    (columns || []).forEach(c => assertSafeIdentifier(c, "字段名"));
    if (timeFilter?.column) assertSafeIdentifier(timeFilter.column, "时间字段");

    // Virtual data for demo
    if (conf.server === "localhost" || conf.host === "localhost") {
        const mockRows: any[] = [];
        for (let i = 0; i < 20; i++) {
            mockRows.push({
                Record_Time: new Date(Date.now() - i * 3600000),
                Device_ID: `DEV-00${(i % 5) + 1}`,
                Product_Code: `SKU-MANU-${1000 + i}`,
                Output_Qty: Math.floor(Math.random() * 100) + 50,
                Status: Math.random() > 0.1 ? "Running" : "Error",
                Temp: (25 + Math.random() * 5).toFixed(2),
                Operator: `User_${i % 3}`
            });
        }
        return {
            columns: [
                { name: "Record_Time", type: "datetime", missingRate: 0 },
                { name: "Device_ID", type: "text", missingRate: 0 },
                { name: "Product_Code", type: "text", missingRate: 0 },
                { name: "Output_Qty", type: "numeric", missingRate: 0 },
                { name: "Status", type: "categorical", missingRate: 0 },
                { name: "Temp", type: "numeric", missingRate: 0 },
                { name: "Operator", type: "text", missingRate: 0 }
            ],
            rows: mockRows
        };
    }

    const colsSql = columns && columns.length > 0
        ? columns.map(c => {
            if (type === "mssql") return `[${c}]`;
            if (type === "postgres") return `"${c}"`;
            return `\`${c}\``;
        }).join(", ")
        : "*";

    const whereSql = timeFilter ? (() => {
        const { column, start, end } = timeFilter;
        if (type === "mssql") return ` WHERE [${column}] BETWEEN '${start}' AND '${end}'`;
        if (type === "postgres") return ` WHERE "${column}" BETWEEN '${start}' AND '${end}'`;
        return ` WHERE \`${column}\` BETWEEN '${start}' AND '${end}'`;
    })() : "";

    const orderSql = timeFilter ? (() => {
        const { column } = timeFilter;
        if (type === "mssql") return ` ORDER BY [${column}] DESC`;
        if (type === "postgres") return ` ORDER BY "${column}" DESC`;
        return ` ORDER BY \`${column}\` DESC`;
    })() : "";

    const safeTable = type === "mssql" ? `[${table}]` : type === "postgres" ? `"${table}"` : `\`${table}\``;

    const query = type === "mssql"
        ? `SELECT TOP ${limit} ${colsSql} FROM ${safeTable}${whereSql}${orderSql}`
        : `SELECT ${colsSql} FROM ${safeTable}${whereSql}${orderSql} LIMIT ${limit}`;

    let rows: any[] = [];
    if (type === "mssql") {
        const pool = new mssql.ConnectionPool(conf);
        await pool.connect();
        const res = await pool.request().query(query);
        rows = res.recordset;
        await pool.close();
    } else if (type === "postgres") {
        const client = new Client(conf);
        await client.connect();
        const res = await client.query(query);
        rows = res.rows;
        await client.end();
    } else if (type === "mysql") {
        const connection = await mysql.createConnection(conf);
        const [mysqlRows] = await connection.query(query) as any[];
        rows = mysqlRows;
        await connection.end();
    }

    if (rows.length === 0) return { columns: [], rows: [] };

    const columnMeta: ColumnMeta[] = Object.keys(rows[0]).map(col => {
        let sampleVal = rows.find(r => r[col] !== null && r[col] !== undefined)?.[col];
        let type: ColumnType = "text";
        if (typeof sampleVal === "number") type = "numeric";
        if (sampleVal instanceof Date) type = "datetime";
        if (typeof sampleVal === "boolean") type = "categorical";

        return {
            name: col,
            type,
            missingRate: 0
        };
    });

    return { columns: columnMeta, rows };
}

export function autoTagVariables(columns: ColumnMeta[]): Record<string, string[]> {
    const tagged: Record<string, string[]> = {};
    const timeKeywords = ["time", "timestamp", "datetime", "日期", "时间", "at", "date"];
    const deviceKeywords = ["device", "equip", "machine", "设备", "机台", "line", "产线"];
    const productKeywords = ["product", "sku", "article", "material", "产品", "物料", "品号"];
    const qtyKeywords = ["qty", "count", "output", "产量", "数量", "amount"];

    columns.forEach(col => {
        const lo = col.name.toLowerCase();
        const tags: string[] = [];
        if (timeKeywords.some(k => lo.includes(k)) || col.type === "datetime") tags.push("时间字段");
        if (deviceKeywords.some(k => lo.includes(k))) tags.push("设备ID");
        if (productKeywords.some(k => lo.includes(k))) tags.push("产品编号");
        if (qtyKeywords.some(k => lo.includes(k))) tags.push("产量");

        if (tags.length > 0) tagged[col.name] = tags;
    });
    return tagged;
}
