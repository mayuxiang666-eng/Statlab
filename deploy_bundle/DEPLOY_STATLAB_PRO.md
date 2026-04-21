# Statlab 工业 AI 平台：Windows Server 专业部署与更新手册（极简脱水版）

本手册专为工业内网环境设计，跳过繁琐的 IIS 配置与昂贵的容器化方案，采用**全原生 Node.js + Python + NSSM** 的“大直通”架构。针对 Prisma 引擎拦截、Python 环境隔离、内网 IP 访问等实战痛点，提炼出这套最高效、最稳健的部署方案。

---

## 🎯 核心运行架构
*   **前端展示**：基于 Vite 的 React 应用，运行在 `3000` 端口（通过 `npm run preview` 或原生 static-serve）。
*   **计算后端**：Express 核心服务，运行在 `3001` 端口，实时处理业务逻辑。
*   **AI 算力**：Python 3.12 机器学习服务，监听 `3002` 端口，支撑复杂算法。
*   **数据底座**：零配置的 SQLite 数据库，位于 `server/db/statlab.sqlite`，无需安装 MySQL/SQL Server。
*   **后台管家**：利用 **NSSM** 工具，将前端、Node、Python 三大模块全部注册为 Windows 系统服务，实现开机自启、无黑框运行、崩溃自动重启。

---

## ⚙️ 一、基础环境搭台

### 1. 刚需工具
*   **Node.js (LTS 版)**：官网下载 `.msi` 安装包，安装时务必勾选“自动安装必要工具”。
*   **Python 3.12**：从官网下载并安装，确保在命令提示符输入 `python --version` 能正确显示。
*   **NSSM 工具**：前往 [nssm.cc](http://nssm.cc/) 下载，解压后将 `win64/nssm.exe` 所在路径添加到系统环境变量 `Path` 中。

---

## 🔧 二、部署阶段：代码编译与初次上线

将 Statlab 源码拷贝到服务器（如 `C:\APPs\StatLab`），确保不带 `node_modules`。

### 步骤 1：精确匹配服务器 IP
打开并修改核心配置文件：

*   **修改 `server/.env` (后端的命脉)**
    ```env
    PORT=3001
    PYTHON_ML_URL="http://127.0.0.1:3002"
    ENCRYPTION_KEY="your-secret-key-donot-forget"
    ```
*   **修改 `client/.env.production` (前端的指南针)**
    ```env
    # 填入服务器的真实内网 IP
    VITE_API_BASE_URL="http://10.x.x.x:3001/api"
    ```

### 步骤 2：破解墙外封锁并推库建表
在 PowerShell 中运行：
```powershell
# 1. 下载依赖并安装 Python 环境
npm run setup

# 2. 绕过 SSL 证书检查（针对内网防火墙拦截 Prisma 引擎下载）
$env:NODE_TLS_REJECT_UNAUTHORIZED=0
npm --workspace server run db:push
```

### 步骤 3：全栈大火收汁（统一编译）
```powershell
# 编译全栈代码：生成 client/dist 和 server/dist
npm run build
```

---

## 🔌 三、免打扰服务挂载阶段

使用 NSSM 将三大件挂载为系统服务，告别手动点开黑窗口。

### 1. 挂起 AI 算力服务 (StatLab_Python)
```cmd
nssm install StatLab_Python
```
* **Path**: `C:\APPs\StatLab\server\python_ml\.venv\Scripts\python.exe`
* **Arguments**: `C:\APPs\StatLab\server\python_ml\main.py`
* **AppDirectory**: `C:\APPs\StatLab\server\python_ml`

### 2. 挂起计算后端 (StatLab_Node)
```cmd
nssm install StatLab_Node
```
* **Path**: `C:\Program Files\nodejs\node.exe`
* **Arguments**: `C:\APPs\StatLab\server\dist\server\src\index.js`
* **AppDirectory**: `C:\APPs\StatLab\server`

### 3. 挂起前端展示 (StatLab_Web)
```cmd
nssm install StatLab_Web
```
* **Path**: `C:\Program Files\nodejs\npm.cmd`
* **Arguments**: `run preview --workspace client -- --port 3000 --host`
* **AppDirectory**: `C:\APPs\StatLab`

🚨 *（提示：使用 `npm run preview` 配合 `--host` 参数，可以让局域网内其他机器直接通过 IP 访问 3000 端口，无需 IIS 转发。）*

### 4. 启动所有服务
```cmd
nssm start StatLab_Python
nssm start StatLab_Node
nssm start StatLab_Web
```

---

## 🔄 四、日常更新与维护（黄金 5 步曲）

当您需要发布新功能或修复 Bug 时，只需按顺序执行：

1.  **覆盖代码**：将新代码（排除 `node_modules`）直接覆盖到 `C:\APPs\StatLab`。**千万别覆盖 `.env` 文件！**
2.  **补全依赖**：运行 `npm install`。
3.  **同步数据库**：如果修改了数据属性，运行 `npm --workspace server run db:push`。
4.  **重新编译**：运行 `npm run build`。
5.  **重启服务**：
    ```powershell
    nssm restart StatLab_Web
    nssm restart StatLab_Node
    nssm restart StatLab_Python
    ```

---

## 💡 终极排障锦囊
*   **504/无法访问**：检查服务器防火墙是否放行了 `3000`, `3001`, `3002` 端口。
*   **Python 算力报错**：尝试在 `server/python_ml` 目录下手动运行 `.venv\Scripts\python main.py` 排查环境。
*   **数据库锁定**：SQLite 特性，确保没有其他程序（如 SQLite 编辑器）长时间占用此文件。
*   **Prisma 报错**：删除 `server/node_modules/.prisma` 文件夹后重新运行 `npx prisma generate`。

---
**🎉 恭喜！您已成功构建了一套稳健的工业 AI 运行环境！**  
现在，工程师们可以通过 `http://10.x.x.x:3000` 开启他们的 AI 实训之旅了。
