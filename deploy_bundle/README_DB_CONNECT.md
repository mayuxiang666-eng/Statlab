# StatLab 制造业数据分析平台 - 数据库连接模块 (MVP)

这个版本新增了「连接生产数据库」功能，专为制造工程师设计，支持从 MES、PLC、质检、设备数据库中直接获取数据进行分析。

## 核心特性
- **生产语言界面**：使用“连接生产数据库”、“取数”、“范围控制”等词汇，告白技术术语。
- **两类连接模式**：
    - **管理员预配置**：工程师直接在下拉框选择“产线A MES”，无需关心 IP 或账号密码。
    - **自定义连接**：高级用户可手动输入 SQL Server 或 PostgreSQL 地址。
- **制造字段自动标注**：自动识别并标注「时间字段」、「设备ID」、「产品编号」、「产量」。
- **范围控制 (Range Control)**：强制要求选择时间段（最近1h/1d/7d/30d）和采样限制，防止大流量拉取导致生产库压力过大。
- **分析体验一致性**：无论是 CSV 还是数据库取数，进入的分析工作台与建模能力完全一致。

## 工程结构
- `server/src/routes/connections.ts`: 核心 API 路由（预设、预览、数据集构建）。
- `server/src/db-connector.ts`: 数据库驱动逻辑 (MSSQL/Postgres) 与字段标注启发式。
- `server/src/crypto.ts`: 数据库凭据 AES 对称加密。
- `client/src/DbConnect.tsx`: 三步走取数组件（连接 -> 预览 -> 范围控制）。
- `shared/src/index.ts`: 统一样份与数据集类型定义。

## 启动指南

### 1. 安装依赖
确保已安装 `mssql` 和 `pg` 驱动：
```bash
cd server
npm install mssql pg crypto-js
npm install @types/mssql @types/pg @types/crypto-js -D
```

### 2. 配置预设 (Presets)
编辑 `server/src/db-presets.ts`，在 `DB_PRESETS` 数组中添加你的工厂数据库连接信息。凭据只保存在后端内存。

### 3. 如何演示
1. 启动后端：`npm run dev` (在 server 目录)
2. 启动前端：`npm run dev` (在 client 目录)
3. 访问浏览器 -> 点击顶部「连接生产数据库」。
4. 步骤一：选择「MES 生产执行系统」进行测试。
5. 步骤二：左侧点击一个业务表，右侧查看自动标注的标签（如：Time -> 时间字段）。
6. 步骤三：选择「最近 1 天」，点击「确认取数」。
7. 系统会自动跳转至分析工作台，此时你可以使用原来的学术统计/机器学习算法直接分析数据库里的数据。

## 安全与约束
- **加密存储**：自定义连接的密码在写入 SQLite 时经过 AES 加密。
- **范围强制**：后端 `/dataset/build` 接口若未检测到范围控制参数将拒绝请求。
- **统一抽象**：前端工作台通过 `datasetId` 获取数据，不感知底层是文件还是数据库。
