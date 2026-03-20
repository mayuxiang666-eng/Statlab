import { DbConnectionType } from "@statlab/shared";

export interface PresetConfig {
    id: string;
    name: string;
    type: DbConnectionType;
    config: any; // Database specific connection config
}

// In a real factory, these would be in environment variables or a vault.
// We keep credentials ONLY on the server.
export const DB_PRESETS: PresetConfig[] = [
    {
        id: "preset-mes",
        name: "MES 生产执行系统 (产线 A)",
        type: "mssql",
        config: {
            server: "localhost", // Placeholder
            port: 1433,
            database: "MES_DB_PROD",
            user: "mes_reader",
            password: "dummy_password_mes",
            options: { encrypt: false, trustServerCertificate: true }
        }
    },
    {
        id: "preset-qc",
        name: "质检系统 (质量中心库)",
        type: "postgres",
        config: {
            host: "localhost",
            port: 5432,
            database: "QC_PROD",
            user: "qc_analytics",
            password: "dummy_password_qc"
        }
    },
    {
        id: "preset-iot",
        name: "设备状态库 (IOT 平台)",
        type: "postgres",
        config: {
            host: "localhost",
            port: 5432,
            database: "DEVICE_IOT",
            user: "iot_user",
            password: "dummy_password_iot"
        }
    },
    {
        id: "preset-mysql-sample",
        name: "生产看板数据库 (MySQL)",
        type: "mysql",
        config: {
            host: "localhost",
            port: 3306,
            database: "dashboard_db",
            user: "viewer",
            password: "dummy_password_mysql"
        }
    }
];
