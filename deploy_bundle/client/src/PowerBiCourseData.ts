export interface PowerBiQuizQuestion {
  id: string;
  questionZh: string;
  questionEn: string;
  optionsZh: string[];
  optionsEn: string[];
  correctIndex: number;
  explanationZh: string;
  explanationEn: string;
}

export interface PowerBiLesson {
  id: string;
  stage: number;
  titleZh: string;
  titleEn: string;
  objectiveZh: string;
  objectiveEn: string;
  duration: string;
  points: number;
  contentZh: string;
  contentEn: string;
  quiz: PowerBiQuizQuestion[];
}

export const POWERBI_LESSONS: PowerBiLesson[] = [
  {
    id: 'pbi_intro',
    stage: 1,
    titleZh: 'Power BI 核心组件与 UI 导航',
    titleEn: 'Core Components & UI Navigation',
    objectiveZh: '全方位掌握 Power BI 三大核心组件分工，深入理解 4 大视图与常用功能区。',
    objectiveEn: 'Master the role of 3 core components and understand the 4 main views & UI areas.',
    duration: '15 min',
    points: 100,
    contentZh: `
# Power BI 全景指南：从桌面到云端

Power BI 不仅仅是一个绘图工具，它是一个由多个组件组成的**企业级生态系统**。

## 1. 核心铁三角 (The Core Trio)

### Power BI Desktop (开发中心)
- **定位**：免费的 Windows 应用，是报表开发的入口。
- **功能**：数据连接、清洗 (Power Query)、建模 (Relationships) 以及可视化设计。
- **输出**：生成 .pbix 文件。

### Power BI Service (发布与中心化管理)
- **定位**：基于 Azure 云的 SaaS 服务。
- **功能**：仪表板 (Dashboard) 创建、报表共享、定时刷新、行级安全性 (RLS) 管理。
- **协作**：工作区 (Workspaces) 和应用 (Apps) 分发中心。

### Power BI Mobile (移动决策)
- **定位**：手机和平板 App。
- **价值**：提供经过专门布局优化的移动端报表，接收警报提醒。

---

## 2. Desktop 界面深度导航

### 四大核心视图
1. **报表视图 (Report View)**：
   - 画布所在地。在这里排列视觉对象，使用“可视化”和“字段”面板进行配置。
2. **数据视图 (Data View)**：
   - 查看原始数据表。在这里检查列格式，定义计算列。
3. **模型视图 (Model View)**：
   - 关系视图。在这里管理表与表之间的连线（1:N），设置文件夹管理度量值。
4. **表格预览 (DAX Query View)**：
   - (最新版) 允许像编写 SQL 一样编写和预览 DAX 表达式结果。

### 关键功能面板
- **功能区 (Ribbon)**：类似 Office，聚合了建模、插入、视图等常用大按钮。
- **筛选器 (Filters)**：管理页面级、报表级以及视觉对象级的筛选逻辑。
- **可视化 (Visuals)**：包含 30+ 种原生图表，并允许从 AppSource 下载自定义视觉对象。
    `,
    contentEn: `
# Power BI Panorama: From Desktop to Cloud

Power BI is more than a charting tool; it's an **enterprise-grade ecosystem**.

## 1. The Core Trio

### Power BI Desktop (Development Center)
- **Role**: Free Windows app for report authoring.
- **Workflow**: Connect, Clean (Power Query), Model (Relationships), and Design.
- **Output**: .pbix files.

### Power BI Service (Publishing & Management)
- **Role**: Azure-based SaaS platform (cloud).
- **Function**: Creating Dashboards, Sharing, Scheduled Refresh, Row-Level Security (RLS).
- **Collaboration**: Workspaces and dedicated App distribution.

### Power BI Mobile (Mobile Decision-Making)
- **Role**: Smartphone and Tablet apps.
- **Value**: Optimized mobile layouts and instant data alerts for decision-makers.

---

## 2. Desktop UI Deep Navigation

### The Four Key Views
1. **Report View**:
   - The Canvas. Arrange visuals here using the "Visualizations" and "Fields" panes.
2. **Data View**:
   - Inspect raw tables. Change data types or define calculated columns here.
3. **Model View**:
   - The Relationship diagram. Manage 1:N links and organize measures into folders.
4. **DAX Query View**:
   - (New Feature) Allows querying DAX like SQL to preview results during development.

### Critical Panes
- **Ribbon**: Office-style toolbar containing major actions (Modeling, Insert, View).
- **Filters**: Manage logic at visual, page, and report levels.
- **Visualizations**: Contains 30+ stock charts + AppSource for thousands of custom add-ins.
    `,
    quiz: [
      {
        id: 'q1_1',
        questionZh: '在 Power BI 工作流中，连接原始数据并建立星型模型的最佳位置是？',
        questionEn: 'In the Power BI workflow, where is the best place to connect to raw data and build a star schema?',
        optionsZh: ['Power BI Service', 'Power BI Desktop', 'Power BI Mobile', 'OneDrive'],
        optionsEn: ['Power BI Service', 'Power BI Desktop', 'Power BI Mobile', 'OneDrive'],
        correctIndex: 1,
        explanationZh: 'Power BI Desktop 是所有开发工作的起点，包含建模和 ETL 引擎。',
        explanationEn: 'Power BI Desktop is the starting point for all authoring, containing the modeling and ETL engines.'
      },
      {
        id: 'q1_2',
        questionZh: '如果您想在多个表之间连线并管理数据的过滤流向，应进入哪个视图？',
        questionEn: 'Which view should you use to link tables and manage data filtering flow?',
        optionsZh: ['报表视图', '数据视图', '模型视图', '筛选器面板'],
        optionsEn: ['Report View', 'Data View', 'Model View', 'Filter Pane'],
        correctIndex: 2,
        explanationZh: '模型视图 (Model View) 专门用于维护表间关系。',
        explanationEn: 'Model View is specifically designed for maintaining relationships between tables.'
      }
    ]
  },
  {
    id: 'pbi_query',
    stage: 2,
    titleZh: 'Power Query 函数库与 ETL 手册',
    titleEn: 'Power Query Library & ETL Manual',
    objectiveZh: '深入学习 Power Query 转换算子，掌握 M 语言核心逻辑与工业级 ETL 处理规范。',
    objectiveEn: 'Deeply study Power Query transformation operators and master M Language logic & ETL standards.',
    duration: '20 min',
    points: 150,
    contentZh: `
# 数据清洗心脏：Power Query 高级手册

在 Power BI 中，超过 80% 的工作是在处理“脏数据”。Power Query (PQ) 是您的主手术刀。

## 1. 核心转换函数库 (The Operator Library)

### 数据结构重塑
- **逆透视 (Unpivot)**:
  - **工业场景**：处理将“1月, 2月, 3月”作为列标题的宽表。
  - **核心价值**：转为“月份”和“值”两列，使其符合 BI 聚合要求的长表格式。
- **透视 (Pivot)**:
  - **核心价值**：反过程，用于重组数据以适配特定的展示逻辑。

### 数据表关联与整合
- **合并查询 (Merge)**:
  - 相当于 SQL 的 **Join**。
  - 支持左外部 (Left Outer)、右外部、完全外部、内部 (Inner) 以及反向 (Anti) 连接。
- **追加查询 (Append)**:
  - 相当于 SQL 的 **UNION ALL**。
  - 用于将同一格式的不同时间段表（如：1月表和2月表）纵向堆叠。

---

## 2. 工业级 ETL 最佳实践指南

### 计算前置原则 (ETL Placement)
- **黄金准则**：能在源端 (SQL) 做的就不在浏览器做；能在 Power Query 做的就不在 DAX 做（计算列）。
- **原因**：PQ 引擎会在加载前对数据进行高度压缩，DAX 计算列会显著增加 .pbix 文件体积。

### M 语言：步骤背后的逻辑
M 是 Power Query 的原生语言。
- **区分大小写**：\`Table.Column\` 与 \`table.column\` 不同。
- **延迟加载**：只有在刷新报表时，转换步骤才会真正按顺序并行执行。

### 常见的 M 函数速查：
- \`Text.Proper\`: 将文本转为首字母大写。
- \`Date.EndOfMonth\`: 获取日期所在月份的最后一天。
- \`Table.SelectRows\`: 执行行过滤逻辑。
    `,
    contentEn: `
# The Heart of Data: Power Query Advanced Manual

In Power BI, over 80% of efforts go into data cleaning. Power Query (PQ) is your precision scalpel.

## 1. Core Transformation Library

### Schema Reshaping
- **Unpivot**:
  - **Industry Case**: Handles wide tables with headers like "Jan, Feb, Mar".
  - **Logic**: Converts them into "Attribute" and "Value" pairs, satisfying long-format requirements for BI.
- **Pivot**:
  - **Logic**: Re-arranges data to fit specific visualization needs.

### Table Integration
- **Merge**:
  - Equivalent to SQL **Join**.
  - Supports Left Outer, Right Outer, Full Outer, Inner, and Anti Joins.
- **Append**:
  - Equivalent to SQL **UNION ALL**.
  - Stacks tables with identical schemas vertically (e.g., merging Jan data and Feb data).

---

## 2. Industrial-Grade ETL Best Practices

### The "Preprocessing" Rule
- **Golden Rule**: If it can be done at the source (SQL), do it there. If not, do it in Power Query instead of DAX Calculated Columns.
- **Why**: PQ compresses data during load; DAX Computed Columns increase .pbix file size significantly.

### M Language Essentials
M is the functional language behind PQ.
- **Case Sensitivity**: \`Table.Column\` is NOT the same as \`table.column\`.
- **Lazy Evaluation**: Steps are executed in order only when data is refreshed.

### Useful M Functions Quick Reference:
- \`Text.Proper\`: Capitalizes first letters.
- \`Date.EndOfMonth\`: Finds last day of the month.
- \`Table.SelectRows\`: Filters table rows.
    `,
    quiz: [
      {
        id: 'q2_1',
        questionZh: '在工业 SCADA 导出数据中，将 12 个月份的列标题转为单列“月份”应该使用什么操作？',
        questionEn: 'In industrial SCADA exports, what operator converts 12 month columns into a single "Month" column?',
        optionsZh: ['转置 (Transpose)', '逆透视 (Unpivot)', '透视 (Pivot)', '拆分列 (Split)'],
        optionsEn: ['Transpose', 'Unpivot', 'Pivot', 'Split'],
        correctIndex: 1,
        explanationZh: '逆透视专门用于将多列标题属性化，是 Power Query 最常用的数据重塑工具。',
        explanationEn: 'Unpivot is designed for attribute-naming multiple columns, the most common reshaping tool in PQ.'
      }
    ]
  },
  {
    id: 'pbi_model',
    stage: 3,
    titleZh: '数字化架构：星型建模百科',
    titleEn: 'Architecture: Star Schema Encyclopedia',
    objectiveZh: '系统掌握事实表、维度表的设计规范，理解 1:N 关系与交叉筛选方向的底层原理。',
    objectiveEn: 'Master Fact & Dimension design standards and understand 1:N relationships & filter directions.',
    duration: '25 min',
    points: 180,
    contentZh: `
# 数据建模：Power BI 性能的终极引擎

如果说 Power Query 是“找材料”，那么建模就是“盖大楼”。好的架构能让报表在亿级数据下秒开。

## 1. 星型架构 (Star Schema) 原理

星型架构是由一个**中心事实表**和多个**周围维度表**组成的结构，形状像一颗星。

### 事实表 (Fact Tables)
- **定义**：业务过程的“记录仪”（如：工单产量、故障停机、销售额）。
- **特征**：行数极多（亿级）、字段以数值和外键为主、高度动态。

### 维度表 (Dimension Tables)
- **定义**：分析数据的“切入点”（如：日期、产品、工厂地图、物料分类）。
- **特征**：行数较少、包含描述性文本、作为筛选器 source。

---

## 2. 关系说明书 (The Relationship Manual)

### 基数 (Cardinality)
- **1:N (一对多)**：标准的建模方式。1 条产品记录对应多条销售记录。
- **1:1 (一对一)**：不常用，通常应合并两表。
- **M:N (多对多)**：高阶场景，如“一辆车有多个司机，一个司机开多辆车”，需通过桥接表解决。

### 交叉筛选方向 (Cross-filter Direction)
- **单向 (Single)**：【推荐】维度表流向事实表。逻辑清晰，性能最优。
- **双向 (Both)**：允许事实表反向过滤维度表。**警告：仅在特殊场景使用，极易造成性能低下或逻辑循环冲突。**

---

## 3. 日期维度：建模之魂
在工业分析中，决不能直接使用事实表中的日期列。
- **日期表 (Date Table)**：必须建立一个连续的、不中断的日期表。
- **AUTO_DATE_TIME**：强烈建议在设置中关闭 Power BI 默认的自动日期层次结构，以节省内存空间。
    `,
    contentEn: `
# Data Modeling: The Engine of Performance

If Power Query is gathering materials, Modeling is architecture. A strong schema allows billion-row reports to load instantly.

## 1. The Star Schema Principles

A center **Fact Table** surrounded by multiple **Dimension Tables**, resembling a star.

### Fact Tables
- **Definition**: The "Recorder" of events (e.g., Production Counts, Downtime, Sales).
- **Features**: Billions of rows possible, quantitative values, foreign keys, highly dynamic.

### Dimension Tables
- **Definition**: The "Entry points" for filtering (e.g., Dates, Products, Factory Maps).
- **Features**: Fewer rows, descriptive text, the source for slicers.

---

## 2. Relationship Manual

### Cardinality
- **1:N (One-to-Many)**: The Gold Standard. One product entry to many sales logs.
- **1:1 (One-to-One)**: Rare, usually implies tables should be merged.
- **M:N (Many-to-Many)**: Advanced cases (one car to many drivers, one driver to many cars). Requires bridge tables.

### Cross-filter Direction
- **Single**: 【Recommended】 Filter flows from Dimension to Fact. Clear logic, best performance.
- **Both**: Fact filters back to Dimension. **Warning: Use sparingly. Can lead to ambiguity and performance collapse.**

---

## 3. Date Dimension: The Soul of BI
Never use raw date columns from your Fact tables for analysis.
- **Calendar Table**: A continuous, gap-free date table is mandatory.
- **Disable Auto-time**: Recommended to turn OFF default Auto Date/Time in settings to minimize memory bloat.
    `,
    quiz: [
      {
        id: 'q3_1',
        questionZh: '在标准星型架构中，存放“产品描述、规格、颜色”等信息的表被称为？',
        questionEn: 'In a standard Star Schema, the table containing "Product descriptions, specs, colors" is called?',
        optionsZh: ['关系表', '事实表', '维度表', '切片器表'],
        optionsEn: ['Relationship Table', 'Fact Table', 'Dimension Table', 'Slicer Table'],
        correctIndex: 2,
        explanationZh: '维度表存放属性 and 描述信息，用于筛选事实表。',
        explanationEn: 'Dimension tables store attributes and descriptions used to filter Facts.'
      }
    ]
  },
  {
    id: 'pbi_dax_basic',
    stage: 4,
    titleZh: 'DAX 函数库：语法核心与上下文',
    titleEn: 'DAX Library: Syntax & Context',
    objectiveZh: '区分 DAX 三大计算对象，理解行上下文与筛选上下文的转换机制。',
    objectiveEn: 'Distinguish calculators and understand the mechanism between Row and Filter Context.',
    duration: '30 min',
    points: 200,
    contentZh: `
# DAX (Data Analysis Expressions) 权威手册

DAX 是基于 Excel 公式进化而来的函数式语言，但其内核完全不同。

## 1. DAX 三大计算对象

| 对象 | 计算时间 | 存储位置 | 典型用途 |
| :--- | :--- | :--- | :--- |
| **度量值 (Measure)** | 交互时 (实时) | 不占 CPU/内存 | 核心 KPI、利润、增长率 |
| **计算列 (Column)** | 刷新时 | 写入磁盘/内存 | 切片器筛选、作为图表轴 |
| **计算表 (Table)** | 刷新时 | 写入磁盘/内存 | 创建特殊的日期表、汇总表 |

---

## 2. 核心语法函数速查

### 聚合函数
- \`SUM(Table[Col])\`: 标准求和。
- \`AVERAGEX(Table, Expression)\`: **迭代函数**。先计算每一行的表达式，再取平均。
- \`COUNTROWS(Table)\`: 统计行数（通常用于统计工单数）。

### 安全除法
- \`DIVIDE(Numerator, Denominator, AlternateResult)\`: 
  - **工业级标准**：自动处理分母为 0 的异常，不会报错。

---

## 3. 理解“上下文 (Context)” —— DAX 的灵魂

### 行上下文 (Row Context)
- 当你在建立计算列或使用 X 函数（如 SUMX）时启动。它知道“当前这一行”是什么。

### 筛选上下文 (Filter Context)
- 这才是 BI 的魅力。当你点击图表上的“2023年”，整个模型就进入了 2023 的筛选上下文。
- **度量值只在筛选上下文中存在。**
    `,
    contentEn: `
# DAX (Data Analysis Expressions) Authoritative Manual

DAX is a functional language evolved from Excel formulas, but its underlying engine is entirely different.

## 1. The Three DAX Calculators

| Object | Timing | Storage | Case |
| :--- | :--- | :--- | :--- |
| **Measure** | On-the-fly (Realtime) | None | Core KPIs, Margins, Growth |
| **Calculated Column** | On Refresh | Persistent | Slicer filters, Axis |
| **Calculated Table** | On Refresh | Persistent | Custom Calendars, Summary Tables |

---

## 2. Core Syntax Quick Reference

### Aggregation
- \`SUM(Table[Col])\`: Standard sum.
- \`AVERAGEX(Table, Expression)\`: **Iterator**. Computes expression for every row first, then averages.
- \`COUNTROWS(Table)\`: Counts rows (e.g., number of work orders).

### Safe Division
- \`DIVIDE(Numerator, Denominator, AlternateResult)\`: 
  - **Standard**: Automatically handles division-by-zero errors.

---

## 3. Understanding "Context" —— The Soul of DAX

### Row Context
- Active when creating Calculated Columns or using X-functions (e.g., SUMX). It knows "the current row".

### Filter Context
- The magic of BI. When you click "2023" on a chart, the whole model enters the "2023" filter state.
- **Measures only exist within Filter Contexts.**
    `,
    quiz: [
      {
        id: 'q4_1',
        questionZh: '哪种 DAX 计算对象在模型刷新后不会占用任何磁盘空间？',
        questionEn: 'Which DAX calculation object takes NO disk space after model refresh?',
        optionsZh: ['计算列 (Calculated Column)', '计算表 (Calculated Table)', '度量值 (Measure)', 'M 语言自定义列'],
        optionsEn: ['Calculated Column', 'Calculated Table', 'Measure', 'M Custom Column'],
        correctIndex: 2,
        explanationZh: '度量值是虚拟存在的计算公式，仅在查询时即时运行，不占用模型存储。',
        explanationEn: 'Measures are virtual formulas that run on-demand, consuming no storage space in the model.'
      }
    ]
  },
  {
    id: 'pbi_advanced_dax',
    stage: 5,
    titleZh: '进阶：CALCULATE 指挥官与时间智能',
    titleEn: 'Adv: CALCULATE & Time Intel',
    objectiveZh: '全面解析 CALCULATE 函数的筛选转换逻辑，掌握工业界常用的同比、环比、YTD 公式。',
    objectiveEn: 'Analyze CALCULATE filter transition and master industrial YoY, MoM, and YTD formulas.',
    duration: '35 min',
    points: 300,
    contentZh: `
# 马力全开：CALCULATE 深度解析

在 DAX 中，几乎所有的复杂业务逻辑最终都会用到 **CALCULATE**。

## 1. CALCULATE：上下文调控器
- **基本语法**：\`CALCULATE(度量值, 筛选1, 筛选2...)\`
- **能力**：它能“强制改变”筛选环境。
  - 示例：\`CALCULATE([Yield], Product[Type] = "A")\`。即使你切片器选的是 B，这个公式也会强制计算 A 的产量。

---

## 2. 时间智能库 (Time Intelligence Functions)

工业报表中最核心的需求：**对比**。

### 同比分析 (Year-on-Year)
- \`Sales LY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Calendar'[Date]))\`
- **含义**：在去年同期的环境下重新计算销售额。

### 环比分析 (Month-over-Month)
- \`Prev Month = CALCULATE([Total Sales], DATEADD('Calendar'[Date], -1, MONTH))\`

### 年初至今 (YTD)
- \`Total YTD = TOTALYTD([Total Sales], 'Calendar'[Date])\`

---

## 3. 筛选覆盖原理解析 (Filter Modifiers)

- **ALL**: 忽略所有的筛选器（通常用于计算占比，作为分母）。
- **FILTER**: 当你的筛选逻辑很复杂（如：\`[Sales] > 1000\`）时，必须嵌套在 FILTER 函数内作为 CALCULATE 的参数。

---

## 4. 工业案例：OEE (设备综合效率) 计算架构

在制造业中，OEE 是衡量生产效率的核心。通过 DAX 实现自动化的 OEE 监控需要多层嵌套逻辑：

### 核心公式拆解：
1. **可用率 (Availability)** = \`DIVIDE([运行时间], [计划时间])\`
2. **表现性 (Performance)** = \`DIVIDE([实际产出], [运行时间] * [理论节拍])\`
3. **质量率 (Quality)** = \`DIVIDE([合格品数], [实际产出])\`
4. **OEE** = \`[可用率] * [表现性] * [质量率]\`

### 高级场景：计算去年同期 OEE 趋势
\`\`\`dax
OEE SPLY = 
CALCULATE(
    [OEE],
    SAMEPERIODLASTYEAR('Calendar'[Date])
)
\`\`\`
> **专家心得**：计算 OEE 时最容易出错的地方是“时间单位”。确保运行时间和计划时间使用相同的颗粒度（通常是分钟），并始终使用 \`DIVIDE\` 避免因传感器故障导致的数据为 0 引起的报表崩溃。
    `,
    contentEn: `
# Full Power: Deep Dive into CALCULATE

In DAX, almost every complex business logic eventually involves **CALCULATE**.

## 1. CALCULATE: The Context Controller
- **Syntax**: \`CALCULATE(Measure, Filter1, Filter2...)\`
- **Capability**: It forces a change in the evaluation environment.
  - Example: \`CALCULATE([Yield], Product[Type] = "A")\`. Even if you select "Type B" on a slicer, this formula computes Type A.

---

## 2. Time Intelligence Library

The core requirement of industrial analytics: **Comparison**.

### YoY Analysis
- \`Sales LY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Calendar'[Date]))\`
- **Meaning**: Re-evaluates Total Sales in the context of the same period last year.

### MoM Analysis
- \`Prev Month = CALCULATE([Total Sales], DATEADD('Calendar'[Date], -1, MONTH))\`

### Year-to-Date (YTD)
- \`Total YTD = TOTALYTD([Total Sales], 'Calendar'[Date])\`

---

## 3. Filter Modifiers

- **ALL**: Ignores all filters (useful for percentage-of-total calculations where ALL is the denominator).
- **FILTER**: Needed when filter logic is complex (e.g., \`[Sales] > 1000\`). Must be nested within FILTER as an argument to CALCULATE.

---

## 4. Business Case: OEE (Overall Equipment Effectiveness)

In manufacturing, OEE is the gold standard for efficiency. Implementing it requires multi-layered DAX logic.

### Formula Breakdown:
1. **Availability** = \`DIVIDE([Run Time], [Planned Prod Time])\`
2. **Performance** = \`DIVIDE([Actual Output], [Run Time] * [Ideal Cycle Time])\`
3. **Quality** = \`DIVIDE([Good Units], [Actual Output])\`
4. **OEE** = \`[Availability] * [Performance] * [Quality]\`

### Pro Scenario: Calculating SPLY (Same Period Last Year) OEE
\`\`\`dax
OEE SPLY = 
CALCULATE(
    [OEE],
    SAMEPERIODLASTYEAR('Calendar'[Date])
)
\`\`\`
> **Expert Tip**: The most common mistake is mixed time units. Ensure Run Time and Planned Time use the same granularity (minutes). Always use \`DIVIDE\` to handle sensor dropouts safely.
    `,
    quiz: [
      {
        id: 'q5_1',
        questionZh: '如果我想计算当前产品在不考虑任何“颜色”筛选下的总销量，应该使用哪个函数？',
        questionEn: 'If I want to calculate sales for a product ignoring any "Color" filters, which function is needed?',
        optionsZh: ['SUM', 'SUMX', 'CALCULATE 配合 ALL', 'FILTER'],
        optionsEn: ['SUM', 'SUMX', 'CALCULATE with ALL', 'FILTER'],
        correctIndex: 2,
        explanationZh: 'ALL 函数用于清除过滤器，配合 CALCULATE 可以实现忽略部分筛选条件的全局计算。',
        explanationEn: 'The ALL function clears filters, allowing global calculations that ignore specific slicers when used with CALCULATE.'
      }
    ]
  },
  {
    id: 'pbi_viz_expert',
    stage: 6,
    titleZh: '大屏与叙事：工业可视化手册',
    titleEn: 'Visual Storytelling: Industrial Viz Manual',
    objectiveZh: '学习工业大屏的设计规范逻辑，掌握自定义 Tooltip、书签与钻取等高级交互。',
    objectiveEn: 'Learn industrial UI design standards and master tooltips, bookmarks, and drill-throughs.',
    duration: '25 min',
    points: 200,
    contentZh: `
# 高端工业看板设计协议

在工厂车间，报表的**可读性**价值远超其视觉酷炫。

## 1. DAR 设计哲学 (Dashboard-Analysis-Report)

- **第一层：Dashboard (概览层)**
  - **核心**：高密度 KPI (良率、OEE、当日停机)。
  - **指标**：一秒钟内反馈“我们赢了吗？”。
- **第二层：Analysis (分析层)**
  - **核心**：交互。趋势图、树状图。
  - **目标**：通过钻取发现异常原因。
- **第三层：Report (报告层)**
  - **核心**：明细。表格、矩阵。
  - **目标**：追溯到具体的工单号或操作员。

---

## 2. 高高级交互功能库

### 页面钻取 (Drill-through)
允许用户右击一个“产线”，自动跳转到一个专门针对该产线的详细页面，且背景筛选自动对齐。

### 辅助工具提示 (Report Page Tooltips)
当鼠标悬停在柱形图上时，可以弹出一个**浮动的微型报表页**，而不是简单的文字。

### 书签与导航 (Bookmarks)
- **应用场景**：通过点击按钮切换“产量视图”和“质量视图”，而无需跳转页面。

---

## 3. 颜色与语义规范
- **红色**：仅限故障、错误、阈值失败。
- **绿色**：正常、达标。
- **辅助色**：使用深蓝、中白或中性灰，避免高饱和度背景造成视觉疲劳。

---

## 4. 工业案例：帕累托分析 (Pareto Analysis) 辅助决策

在质量管理中，80% 的问题通常源于 20% 的缺陷原因。

### DAX 实现逻辑：
1. **计算各缺陷总数**：\`[Total Defects] = SUM(Quality[Count])\`
2. **计算累计占比 (Cumulative %)**：
\`\`\`dax
Cumulative % = 
VAR Total = CALCULATE([Total Defects], ALLSELECTED(Quality[Reason]))
VAR CurrentDefects = [Total Defects]
VAR RankedDefects = 
    SUMX(
        FILTER(
            ALLSELECTED(Quality[Reason]),
            [Total Defects] >= CurrentDefects
        ),
        [Total Defects]
    )
RETURN DIVIDE(RankedDefects, Total)
\`\`\`

### 可视化呈現：
- 使用 **组合图 (Line and Clustered Column Chart)**。
- 柱状图表示各缺陷类别的数量。
- 折线图表示累计百分比。
- 重点关注 80% 线以下的“关键少数”因素。

> **总结**：Power BI 开发的终点不是画图，而是将复杂的数据转化为可被决策者理解的**动作指令**。
    `,
    contentEn: `
# Industrial Dashboard Design Protocol

In a factory setting, **Readability** is worth far more than visual "coolness".

## 1. The DAR Philosophy

- **Level 1: Dashboard (Overview)**
  - **Focus**: High-density KPIs (Yield, OEE, Today's Downtime).
  - **Goal**: Is the production winning right now? (The 1-second test).
- **Level 2: Analysis**
  - **Focus**: Interactivity. Trends, Decomposition trees.
  - **Goal**: Find "The Why" behind anomalies via exploration.
- **Level 3: Report (Details)**
  - **Focus**: Raw accuracy. Matrices and Detail tables.
  - **Goal**: Root cause to specific batch IDs or operators.

---

## 2. Advanced Interaction Library

### Drill-through
Allows right-clicking a "Production Line" to jump to a detail page pre-filtered to that specific line.

### Report Page Tooltips
Hover over a bar to see a **floating miniature report**, rather than plain black text.

### Bookmarks & Selection
- **Case**: Toggle between "Yield View" and "Quality View" using a button without leaving the page.

---

## 3. Semantic Color Standards
- **Red**: Strictly for failure, errors, or safety risks.
- **Green**: Targeted achieved, normal operation.
- **Support**: Use dark blues or soft grays for backgrounds to prevent eye strain during 24/7 monitoring.

---

## 4. Business Case: Pareto Analysis for Quality Control

In quality management (Six Sigma), 80% of problems usually stem from 20% of the causes.

### DAX Logic Implementation:
1. **Total Defects**: \`[Total Defects] = SUM(Quality[Count])\`
2. **Cumulative %**:
\`\`\`dax
Cumulative % = 
VAR Total = CALCULATE([Total Defects], ALLSELECTED(Quality[Reason]))
VAR CurrentDefects = [Total Defects]
VAR RankedDefects = 
    SUMX(
        FILTER(
            ALLSELECTED(Quality[Reason]),
            [Total Defects] >= CurrentDefects
        ),
        [Total Defects]
    )
RETURN DIVIDE(RankedDefects, Total)
\`\`\`

### Visualization setup:
- Use a **Line and Clustered Column Chart**.
- Columns show the count per defect type.
- Line shows the Cumulative Percentage.
- Identify the "Vital Few" factors contributing to the 80% line.

> **Summary**: The goal of Power BI is not creating charts, but transforming complexity into **Actionable Instructions** for decision-makers.
    `,
    quiz: [
      {
        id: 'q6_1',
        questionZh: '在 DAR 设计法中，专注于通过高度交互来探索“异常原因”的一层被称为？',
        questionEn: 'In the DAR approach, which level focuses on exploring "The Why" via heavy interactivity?',
        optionsZh: ['Dashboard 概览层', 'Analysis 分析层', 'Report 报告层', 'Data 数据层'],
        optionsEn: ['Dashboard', 'Analysis', 'Report', 'Data'],
        correctIndex: 1,
        explanationZh: '分析层 (Analysis) 是通过切片器和钻取等操作来探索趋势背后的原因。',
        explanationEn: 'The Analysis level is where users use slicers and drill-throughs to explore the causes behind trends.'
      }
    ]
  }
];
