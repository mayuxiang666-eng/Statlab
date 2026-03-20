// ─── Data Model ─────────────────────────────────────────────────────────────

export interface NotebookCell {
  id: string;
  type: 'markdown' | 'code' | 'objective' | 'summary';
  content: string;
  isLocked?: boolean;    // Locked cells cannot be edited by learners
  placeholder?: string;  // For fill-in-the-blank guidance
  isEditing?: boolean;
}

export interface LabPractice {
  id: string;
  title: string;
  description: string;
  tests: string[];
  hints: string[];
  solution?: string;
  targetMetrics?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LabCourse {
  id: string;
  stage: 1 | 2 | 3 | 4;  // Stage-gating: must complete in order
  chapter: string;
  title: string;
  objective: string;
  skills: string[];       // Skills learner will gain
  recommendedDataset: string;
  difficulty: '入门' | '进阶' | '实践';
  duration: string;
  tags: string[];
  practice?: LabPractice;
  quiz?: QuizQuestion[];
  points: number;
  badgeId: string;
  cells: NotebookCell[];
}

// ─── Course Library ──────────────────────────────────────────────────────────

export const LAB_COURSES: LabCourse[] = [

  // ── STAGE 1: Python & Data Fundamentals ────────────────────────────────────
  {
    id: 'ch0_eda',
    stage: 1,
    chapter: 'Stage 1 · 数据探索入门',
    title: '广告投放数据 EDA',
    objective: '通过探索一份真实的广告数据集，掌握 Python 数据分析的三大基本工具：数据预览、缺失值处理、可视化趋势图。',
    skills: ['认识 DataFrame', '检测与填补缺失值', '创建派生特征', '绘制散点图'],
    recommendedDataset: 'advertising',
    difficulty: '入门',
    duration: '10 min',
    tags: ['EDA', '可视化', '特征派生'],
    points: 100,
    badgeId: 'explorer',
    quiz: [
      { id: 'q1_1', question: '在 Pandas 中，查看 DataFrame 前几行数据的函数是？', options: ['df.tail()', 'df.head()', 'df.show()', 'df.peek()'], correctIndex: 1, explanation: 'df.head() 默认返回前 5 行，df.tail() 则返回最后几行。' },
      { id: 'q1_2', question: '处理缺失值最常用的均值填补函数是？', options: ['df.drop()', 'df.replace()', 'df.fillna()', 'df.remove()'], correctIndex: 2, explanation: 'fillna() 用于填充 NA/NaN 值。' },
      { id: 'q1_3', question: '如何查看 DataFrame 的行数和列数？', options: ['df.size', 'df.count()', 'df.shape', 'df.length'], correctIndex: 2, explanation: 'df.shape 返回一个包含 (行数, 列数) 的元组。' },
      { id: 'q1_4', question: '想要统计每一列各有多少个缺失值，应该用？', options: ['df.isna().sum()', 'df.nulls()', 'df.missing()', 'df.check()'], correctIndex: 0, explanation: 'df.isna() 返回布尔矩阵，.sum() 对 True (1) 求和即得缺失数。' },
      { id: 'q1_5', question: 'Pandas 中最基本的数据结构（二维表格）叫什么？', options: ['List', 'Array', 'Series', 'DataFrame'], correctIndex: 3, explanation: 'DataFrame 是 Pandas 的核心，代表二维表格；Series 代表一维列。' },
      { id: 'q1_6', question: '如何选取名为 "Sales" 的那一列数据？', options: ['df("Sales")', 'df["Sales"]', 'df.get_row("Sales")', 'df{Sales}'], correctIndex: 1, explanation: '使用方括号语法 df["列名"] 是最常用的列选取方式。' },
      { id: 'q1_7', question: 'df.describe() 的主要作用是？', options: ['删除数据', '绘制图形', '显示数据的基本统计摘要', '修改列名'], correctIndex: 2, explanation: 'describe() 提供均值、标准差、最大/最小值等统计量。' },
      { id: 'q1_8', question: '在散点图中，Matplotlib 的哪个函数用于绘图？', options: ['plt.plot()', 'plt.hist()', 'plt.scatter()', 'plt.bar()'], correctIndex: 2, explanation: 'plt.scatter() 专门用于绘制两个变量之间的散点图。' },
      { id: 'q1_9', question: '如何创建一个名为 "Total" 的新列，它是 A 列和 B 列的和？', options: ['df.add("Total", "A", "B")', 'df["Total"] = df["A"] + df["B"]', 'df.Total = A + B', 'new Column("Total")'], correctIndex: 1, explanation: '直接通过赋值语法 df["新列名"] = 计算结果 即可创建新列。' },
      { id: 'q1_10', question: '若想查看数据中所有列的数据类型，可以使用？', options: ['df.types', 'df.info()', 'df.dtypes', '以上都是'], correctIndex: 3, explanation: 'df.dtypes 返回各列类型，df.info() 提供更详细的内存和类型摘要。' }
    ],
    practice: {
      id: 'eda_basic',
      title: '练习：创建销售效率特征',
      description: '创建名为 sales_per_tv 的新列（Sales ÷ TV），并确认数据集中不再有缺失值。',
      targetMetrics: 'sales_per_tv 列存在 且 缺失值总数为 0',
      tests: [
        'assert "sales_per_tv" in df.columns, "需要创建 sales_per_tv 列，等于 df[\'Sales\'] / (df[\'TV\'] + 1e-6)"',
        'assert int(df.isna().sum().sum()) == 0, "df 中仍有缺失值，请先执行均值填补单元格"',
      ],
      hints: [
        '提示 1：用 df["Sales"] / (df["TV"] + 1e-6) 创建新列，避免除以零',
        '提示 2：先运行"缺失值处理"单元格，再运行验证',
      ],
    },
    cells: [
      {
        id: 'c0_obj',
        type: 'objective',
        isLocked: true,
        content: `## 🎯 本节学习目标

完成本节后，你将能够：
- 使用 **df.head()** 快速预览数据结构
- 使用 **df.isna().sum()** 定位缺失值
- 使用 **均值填补** 修复缺失数据
- 创建一个**派生特征列**
- 用 **matplotlib** 绘制散点图`,
      },
      {
        id: 'c0_m1',
        type: 'markdown',
        isLocked: true,
        content: `### 📖 概念说明：什么是 DataFrame？

\`df\` 是 **DataFrame** 的简称，可以把它想象成一张 Excel 表格。

- **每一列** 是一个特征（例如 TV 广告投入、销售额）
- **每一行** 是一条数据记录
- 系统已将你选择的数据集自动加载为 \`df\`，你无需手动读取文件`,
      },
      {
        id: 'c0_c1',
        type: 'code',
        content: `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

if df.empty:
    print("Please choose the Advertising dataset first.")
else:
    print("Dataset loaded.")`,
      },
      {
        id: 'c0_c1b',
        type: 'code',
        content: `if not df.empty:
    print("Shape:", df.shape)
    print(df.head(3))
else:
    print("Dataset is empty.")`,
      },
      {
        id: 'c0_c1c',
        type: 'code',
        content: `if not df.empty:
    print(df.isna().sum())
else:
    print("Dataset is empty.")`,
      },
      {
        id: 'c0_m_extra1',
        type: 'markdown',
        isLocked: true,
        content: `### 🔍 深入了解你的数据
在处理数据前，建议养成使用 \`df.info()\` 和 \`df.describe()\` 的习惯。
- **df.info()**: 告诉你每列的名称、非空值数量以及数据类型（如 float64, int64, object）。
- **df.describe()**: 自动计算数值列的平均值、标准差、四分位数等，帮助你快速识别异常值。`,
      },
      {
        id: 'c0_m2',
        type: 'markdown',
        isLocked: true,
        content: `### 代码拆解：缺失值处理

把这段代码按 3 步读：
1. 先找到数值列 \`num_cols\`
2. 再用 \`mean_val\` 填补空值
3. 最后创建新列 \`sales_per_tv\`

建议先看变量名，再看每一行做了什么。`,
      },
      {
        id: 'c0_c2',
        type: 'code',
        content: `if df.empty or "Sales" not in df.columns:
    print("Please load the Advertising dataset first.")
else:
    num_cols = df.select_dtypes(include=[np.number]).columns

    for col in num_cols:
        mean_val = df[col].mean()
        df[col] = df[col].fillna(mean_val)

    print("Missing values after fill:", int(df.isna().sum().sum()))`,
      },
      {
        id: 'c0_c2b',
        type: 'code',
        content: `if "Sales" in df.columns and "TV" in df.columns:
    df["sales_per_tv"] = df["Sales"] / (df["TV"] + 1e-6)
    print(df[["TV", "Sales", "sales_per_tv"]].head())
else:
    print("Required columns are missing.")`,
      },
      {
        id: 'c0_m3',
        type: 'markdown',
        isLocked: true,
        content: `### 📖 概念说明：散点图能告诉我们什么？

散点图可以直观地展示两个变量之间的**关系**。

- 点越**集中在一条斜线**附近 → 关系越强（适合用线性回归）
- 点**随机分散** → 两者关系较弱`,
      },
      {
        id: 'c0_c3',
        type: 'code',
        content: `if not df.empty and "TV" in df.columns and "Sales" in df.columns:
    plt.figure(figsize=(8, 5))
    plt.scatter(df["TV"], df["Sales"], alpha=0.6, color="#38bdf8", edgecolors="white", linewidths=0.5)
    plt.xlabel("TV 广告投入（万元）")
    plt.ylabel("销售额（万件）")
    plt.title("TV 广告投入 vs 销售额")
    plt.grid(alpha=0.2)
    # 图形会在下方自动显示，无需调用 plt.show()
else:
    print("⚠️  未找到所需数据列，请确保已加载 Advertising 数据集")`,
      },
      {
        id: 'c0_summary',
        type: 'summary',
        isLocked: true,
        content: `## ✅ 本节小结

**你已学会：**
- ✔ df.shape → 查看数据维度
- ✔ df.isna().sum() → 统计缺失值
- ✔ df[col].fillna(mean) → 均值填补
- ✔ df["new_col"] = ... → 创建新特征
- ✔ plt.scatter() → 绘制散点图

**下一步：** 完成右上角的"练习校验"，然后进入 Stage 2 学习线性回归！`,
      },
    ],
  },

  // ── STAGE 2: Machine Learning Basics ───────────────────────────────────────
  {
    id: 'ch1_reg',
    stage: 2,
    chapter: 'Stage 2 · 机器学习入门',
    title: '房价预测：线性回归',
    objective: '学习用线性回归解决预测问题，理解"训练集/测试集"的思想，计算 R² 与 RMSE 两个核心评估指标。',
    skills: ['train_test_split 数据划分', 'LinearRegression 模型训练', 'R² 分数解读', 'RMSE 误差', '预测对比可视化'],
    recommendedDataset: 'housing',
    difficulty: '入门',
    duration: '15 min',
    tags: ['回归', '线性模型', '评估指标'],
    points: 200,
    badgeId: 'predictor',
    quiz: [
      { id: 'q2_1', question: '线性回归模型中，R² 分数越接近多少代表模型越完美？', options: ['0', '0.5', '1', '-1'], correctIndex: 2, explanation: 'R²（决定系数）范围通常在 0-1 之间，1 表示完美拟合，0 表示不如平均值预测。' },
      { id: 'q2_2', question: '在训练模型前，为什么要将数据划分为训练集和测试集？', options: ['为了让计算速度更快', '为了评估模型在未见数据上的泛化能力', '为了符合 Python 语法', '为了增加特征数量'], correctIndex: 1, explanation: '测试集模拟了真实世界中模型未见过的数据，用于检验其真实表现。' },
      { id: 'q2_3', question: 'Scikit-Learn 中，用于划分数据集的函数是？', options: ['df.split()', 'random_split()', 'train_test_split()', 'data_divider()'], correctIndex: 2, explanation: 'train_test_split 是 sklearn.model_selection 中的标准函数。' },
      { id: 'q2_4', question: 'RMSE（均方根误差）的描述正确的是？', options: ['数值越大代表模型越准', '它衡量预测值与实际值之间的平均差距', '它始终是负数', '它与数据的原始单位无关'], correctIndex: 1, explanation: 'RMSE 是误差的平方根，数值越小代表预测越接近实际值。' },
      { id: 'q2_5', question: '若 X 是特征矩阵，y 是目标向量，训练模型的正确语法是？', options: ['model.learn(X, y)', 'model.train(X, y)', 'model.fit(X, y)', 'model.predict(X, y)'], correctIndex: 2, explanation: 'Scikit-Learn 中统一使用 .fit() 进行模型训练。' },
      { id: 'q2_6', question: '在一个房价预测项目中，"房间数量"、"房屋面积"通常被称为？', options: ['目标 (Target)', '特征 (Features)', '标签 (Labels)', '残差 (Residuals)'], correctIndex: 1, explanation: '用来预测另一个变量的输入变量被称为特征。' },
      { id: 'q2_7', question: 'LinearRegression 属于哪一类机器学习任务？', options: ['无监督学习', '监督学习 - 分类', '监督学习 - 回归', '强化学习'], correctIndex: 2, explanation: '回归任务预测的是连续的数值。' },
      { id: 'q2_8', question: 'train_test_split 中的 random_state 参数的作用是？', options: ['改变随机性', '保证每次运行代码时得到相同的随机划分', '增加训练集大小', '减少由于数据不均导致的误差'], correctIndex: 1, explanation: '设置固定的种子（seed）可以使实验结果具有可重复性。' },
      { id: 'q2_9', question: '如果模型在训练集上表现完美，但在测试集上表现糟糕，这叫？', options: ['欠拟合 (Underfitting)', '过拟合 (Overfitting)', '数据泄露 (Leakage)', '模型收敛'], correctIndex: 1, explanation: '过拟合是指模型过度学习了训练集的噪音或细节。' },
      { id: 'q2_10', question: '线性回归模型预测的目标值必须是？', options: ['离散的分类', '连续的数值', '图片或文档', 'True 或 False'], correctIndex: 1, explanation: '回归问题的目标是预测连续的量。' }
    ],
    practice: {
      id: 'reg_metrics',
      title: '练习：保存模型评估指标',
      description: '训练完线性回归模型后，将 R² 分数保存到变量 r2，将 RMSE 保存到变量 rmse。',
      targetMetrics: 'r2 > 0（说明模型有学习效果）且 rmse 变量已定义',
      tests: [
        'assert "r2" in locals(), "请在代码中创建变量 r2（使用 r2_score 函数）"',
        'assert "rmse" in locals(), "请在代码中创建变量 rmse（使用 mean_squared_error）"',
        'assert r2 > 0, "r2 应大于 0，说明模型比随机猜测更准确"',
      ],
      hints: [
        '提示 1：r2 = r2_score(y_test, y_pred)',
        '提示 2：rmse = mean_squared_error(y_test, y_pred, squared=False)',
        '提示 3：确保先运行了"数据准备"和"模型训练"的单元格',
      ],
    },
    cells: [
      {
        id: 'c1_obj',
        type: 'objective',
        isLocked: true,
        content: `## 🎯 本节学习目标

完成本节后，你将能够：
- 将数据集分为**训练集**和**测试集**
- 用 **LinearRegression** 拟合一个预测模型
- 理解 **R²（决定系数）** 的含义
- 计算 **RMSE（均方根误差）**
- 绘制"预测值 vs 实际值"对比图`,
      },
      {
        id: 'c1_m1',
        type: 'markdown',
        isLocked: true,
        content: `### 📖 概念说明：什么是线性回归？

线性回归试图找到一条最优的**直线**，使它能最好地描述特征与目标之间的关系。

例如：房间数量↑ → 房价↑

**关键概念：**
- **训练集 (80%)**：模型用来学习规律的数据
- **测试集 (20%)**：用来检验模型的数据（模型从未见过）
- **R² 分数**：越接近 1 越好，0 表示和随机猜测一样差
- **RMSE**：平均预测误差，越小越好`,
      },
      {
        id: 'c1_c1',
        type: 'code',
        content: `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

print("✅ 所有库导入成功！")
print("当前数据集列名:", list(df.columns))`,
      },
      {
        id: 'c1_m2',
        type: 'markdown',
        isLocked: true,
        content: `### 📖 准备数据

下面的代码会自动在数据集中寻找价格列（不区分大小写的 "price"），并将其他数值列作为特征。`,
      },
      {
        id: 'c1_c2',
        type: 'code',
        content: `target_col = next((c for c in df.columns if c.lower() == "price"), None)

if not df.empty and target_col:
    y = df[target_col]
    print("Target column:", target_col)
else:
    print("Price column was not found.")`,
      },
      {
        id: 'c1_c2b',
        type: 'code',
        content: `if "target_col" in locals() and target_col:
    X = df.select_dtypes(include=[np.number]).drop(target_col, axis=1)
    print("Feature columns:", list(X.columns))
    print("Rows and columns:", X.shape)
else:
    print("Run the target selection cell first.")`,
      },
      {
        id: 'c1_m3',
        type: 'markdown',
        isLocked: true,
        content: `### 代码拆解：训练与验证

先只看 4 行核心代码：
1. \`train_test_split(...)\`：先拆分数据
2. \`model = LinearRegression()\`：创建模型
3. \`model.fit(...)\`：让模型学习
4. \`model.predict(...)\`：生成预测

阅读时只要先抓住 \`X_train\`、\`X_test\`、\`model\`、\`y_pred\` 这 4 个变量即可。`,
      },
      {
        id: 'c1_c3',
        type: 'code',
        content: `if "X" in locals() and "y" in locals():
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(X_train.shape, X_test.shape)
else:
    print("Please run the data preparation cells first.")`,
      },
      {
        id: 'c1_c3b',
        type: 'code',
        content: `if "X_train" in locals() and "y_train" in locals():
    model = LinearRegression()
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    print(y_pred[:5])
else:
    print("Please run the train/test split cell first.")`,
      },
      {
        id: 'c1_c3c',
        type: 'code',
        content: `if "y_test" in locals() and "y_pred" in locals():
    r2 = r2_score(y_test, y_pred)
    rmse = mean_squared_error(y_test, y_pred, squared=False)
    print(f"R2: {r2:.4f}")
    print(f"RMSE: {rmse:.2f}")
    print(pd.DataFrame({"actual": y_test, "pred": y_pred}).head())
else:
    print("Please run the model training cell first.")`,
      },
      {
        id: 'c1_m4',
        type: 'markdown',
        isLocked: true,
        content: `### 📖 结果可视化

下面我们绘制"预测值 vs 实际值"的散点图。

如果模型很准确，所有点应该紧贴红色虚线（完美预测线）。`,
      },
      {
        id: 'c1_c4',
        type: 'code',
        content: `if "y_test" in locals() and "y_pred" in locals():
    plt.figure(figsize=(8, 6))
    plt.scatter(y_test, y_pred, alpha=0.5, color="#3b82f6", edgecolors="white", linewidths=0.5)
    # 绘制完美预测线（红色虚线）
    mn = min(y_test.min(), y_pred.min())
    mx = max(y_test.max(), y_pred.max())
    plt.plot([mn, mx], [mn, mx], "r--", lw=2, label="完美预测线")
    plt.xlabel("实际房价")
    plt.ylabel("模型预测房价")
    plt.title(f"预测 vs 实际（R² = {r2:.3f}）")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.4)
else:
    print("⚠️  请先运行模型训练单元格")`,
      },
      {
        id: 'c1_summary',
        type: 'summary',
        isLocked: true,
        content: `## ✅ 本节小结

**你已掌握：**
- ✔ train_test_split → 划分训练/测试集
- ✔ model.fit(X_train, y_train) → 训练模型
- ✔ model.predict(X_test) → 生成预测
- ✔ r2_score → 模型准确度（范围 0~1）
- ✔ mean_squared_error(squared=False) → RMSE 误差

**完成练习后，前往 Stage 3 学习特征工程！**`,
      },
    ],
  },

  // ── STAGE 3: Feature Engineering ───────────────────────────────────────────
  {
    id: 'ch2_feat',
    stage: 3,
    chapter: 'Stage 3 · 特征工程进阶',
    title: '员工绩效：Pipeline 管道化',
    objective: '学习如何用 ColumnTransformer 和 Pipeline 规范化数据预处理流程，并通过交叉验证评估模型真实性能。',
    skills: ['StandardScaler 标准化', 'ColumnTransformer', 'Pipeline 管道', '交叉验证 cross_val_score'],
    recommendedDataset: 'employee',
    difficulty: '进阶',
    duration: '15 min',
    tags: ['特征工程', '管道化', '交叉验证'],
    points: 350,
    badgeId: 'engineer',
    quiz: [
      { id: 'q3_1', question: 'Scikit-Learn 中用于自动化预处理和建模流程的工具是？', options: ['GridSearchCV', 'Pipeline', 'ColumnTransformer', 'StandardScaler'], correctIndex: 1, explanation: 'Pipeline 允许将多个转换器和最终估计器串联起来。' },
      { id: 'q3_2', question: '关于特征标准化（StandardScaler），以下说法正确的是？', options: ['它将数据缩放到 0 到 1 之间', '它将数据转换为均值为 0，标准差为 1 的分布', '它只适用于分类变量', '它会删除缺失值'], correctIndex: 1, explanation: 'StandardScaler 执行 Z-score 标准化。' },
      { id: 'q3_3', question: '交叉验证 (Cross Validation) 的核心目的是？', options: ['增加训练数据量', '减少计算时间', '更可靠地估计模型的泛化能力', '自动修正数据的缺失值'], correctIndex: 2, explanation: '通过多次切分训练/测试集，交叉验证能给出比单次划分更稳定的评估。' },
      { id: 'q3_4', question: '在一个 Pipeline 中，最后一步通常是什么？', options: ['StandardScaler', 'SimpleImputer', '一个估计器（如回归或分类模型）', 'PCA'], correctIndex: 2, explanation: 'Pipeline 的最后一步通常是最终的机器学习算法。' },
      { id: 'q3_5', question: 'ColumnTransformer 的主要作用是？', options: ['将多列合并为一列', '对不同的特征列应用不同的预处理步骤', '删除包含缺失值的列', '改变列的名称'], correctIndex: 1, explanation: '例如，对数值列标准化，对类别列进行独热编码。' },
      { id: 'q3_6', question: '若 cv=5，代表进行几折交叉验证？', options: ['1折', '5折', '10折', '50折'], correctIndex: 1, explanation: 'cv 参数指定了数据切分的份数。' },
      { id: 'q3_7', question: '在 Pipeline 中，中间步骤必须实现哪个方法？', options: ['predict', 'fit 和 transform', 'score', 'evaluate'], correctIndex: 1, explanation: '非最后一步的步骤必须是转换器 (Transformers)。' },
      { id: 'q3_8', question: 'fit_transform() 与 transform() 的区别是？', options: ['没有区别', 'fit_transform 同时计算参数并转换，transform 仅使用已有的参数转换', 'transform 更快', 'fit_transform 只能用于测试集'], correctIndex: 1, explanation: '训练集用 fit_transform，测试集只能用 transform。' },
      { id: 'q3_9', question: '如果数据分布极不均匀，标准化（Standardization）相比归一化（Normalization）的优势是？', options: ['更易受异常值影响', '不改变数据分布', '对异常值更具鲁棒性', '计算更简单'], correctIndex: 2, explanation: '标准化不强制限制在固定的 0-1 范围，因此受极端值的影响相对较小。' },
      { id: 'q3_10', question: 'cross_val_score 的返回值通常是？', options: ['一个单一的平均分', '每一折的分数组成的数组', '一个训练好的模型', '最优的参数组合'], correctIndex: 1, explanation: '它返回一个包含各折评估分数的数组。' }
    ],
    practice: {
      id: 'pipeline_cv',
      title: '练习：交叉验证评估 Pipeline',
      description: '构建一个包含 StandardScaler 和 RandomForestRegressor 的 Pipeline，并将 3-fold 交叉验证的平均 R² 保存到 mean_cv。',
      targetMetrics: 'mean_cv > 0（说明模型有效）',
      tests: [
        'assert "mean_cv" in locals(), "请计算 mean_cv（cross_val_score 的均值）"',
        'assert mean_cv > 0, "mean_cv 应大于 0，说明模型比基准更好"',
      ],
      hints: [
        '提示 1：先运行第一个代码单元格检查特征列表',
        '提示 2：scores = cross_val_score(pipeline, X_feat, y_feat, cv=3, scoring="r2")',
        '提示 3：mean_cv = scores.mean()',
      ],
    },
    cells: [
      {
        id: 'c2_obj',
        type: 'objective',
        isLocked: true,
        content: `## 🎯 本节学习目标

完成本节后，你将能够：
- 解释为什么需要**特征标准化**
- 使用 **ColumnTransformer** 对不同列施加不同处理
- 用 **Pipeline** 将预处理和模型打包成一个整体
- 用 **cross_val_score** 进行 K-fold 交叉验证`,
      },
      {
        id: 'c2_m1',
        type: 'markdown',
        isLocked: true,
        content: `### 📖 概念说明：为什么要标准化特征？

想象你用"年龄（0~100）"和"薪资（0~200,000）"来预测绩效。

薪资的数字远比年龄大，模型会误以为薪资更"重要"。

**StandardScaler** 会将所有特征转换成相似的数值范围（均值=0，标准差=1），让模型公平对待每个特征。`,
      },
      {
        id: 'c2_c1',
        type: 'code',
        content: `import pandas as pd
import numpy as np
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor

target = "PerformanceRating"

if target in df.columns:
    num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if c != target]
    X_feat = df[num_cols]
    y_feat = df[target]
    print(f"✅ 目标列: {target}")
    print(f"特征列 ({len(num_cols)} 个):", num_cols)
    print(f"样本数: {len(df)}")
else:
    print(f"⚠️  未找到 {target} 列，请加载 Employee 数据集")`,
      },
      {
        id: 'c2_m2',
        type: 'markdown',
        isLocked: true,
        content: `### 代码拆解：Pipeline 是什么？

这段代码其实只做 3 件事：
1. 定义预处理规则 \`preprocess\`
2. 把预处理和模型打包成 \`pipeline\`
3. 用 \`cross_val_score\` 反复打分

学生可以先看 \`preprocess\`、\`pipeline\`、\`scores\` 这 3 个变量，再回头看每行细节。`,
      },
      {
        id: 'c2_c2',
        type: 'code',
        content: `if "X_feat" in locals() and not X_feat.empty:
    preprocess = ColumnTransformer([
        ("numeric_scaling", StandardScaler(), num_cols)
    ])
    print(preprocess)
else:
    print("Please run the feature preparation cell first.")`,
      },
      {
        id: 'c2_c2b',
        type: 'code',
        content: `if "preprocess" in locals():
    pipeline = Pipeline([
        ("preprocessor", preprocess),
        ("regressor", RandomForestRegressor(n_estimators=100, random_state=42))
    ])
    print(pipeline)
else:
    print("Please build the preprocessor first.")`,
      },
      {
        id: 'c2_c2c',
        type: 'code',
        content: `if "pipeline" in locals():
    scores = cross_val_score(pipeline, X_feat, y_feat, cv=3, scoring="r2")
    mean_cv = scores.mean()
    print("Fold R2 scores:", scores.round(4))
    print(f"Mean R2: {mean_cv:.4f}")
else:
    print("Please build the pipeline first.")`,
      },
      {
        id: 'c2_c2d',
        type: 'code',
        content: `if "pipeline" in locals():
    pipeline.fit(X_feat, y_feat)
    print("Pipeline fitted on all rows.")
else:
    print("Please build the pipeline first.")`,
      },
      {
        id: 'c2_m3',
        type: 'markdown',
        isLocked: true,
        content: `### 📖 残差分析：模型哪里预测得不够好？

**残差 = 实际值 - 预测值**

- 如果残差集中在 0 附近 → 模型预测准确
- 如果残差分布偏斜 → 模型存在系统性偏差`,
      },
      {
        id: 'c2_c3',
        type: 'code',
        content: `if "pipeline" in locals():
    import matplotlib.pyplot as plt
    from sklearn.metrics import mean_squared_error

    y_pred = pipeline.predict(X_feat)
    rmse = mean_squared_error(y_feat, y_pred, squared=False)
    residuals = y_feat - y_pred

    print(f"训练集 RMSE: {rmse:.4f}")

    plt.figure(figsize=(8, 4))
    plt.hist(residuals, bins=20, color="#f59e0b", alpha=0.8, edgecolor="white")
    plt.axvline(0, color="red", linestyle="--", linewidth=1.5, label="零误差线")
    plt.xlabel("残差（实际 - 预测）")
    plt.ylabel("频次")
    plt.title("残差分布直方图")
    plt.legend()
else:
    print("⚠️  请先运行 Pipeline 训练单元格")`,
      },
      {
        id: 'c2_summary',
        type: 'summary',
        isLocked: true,
        content: `## ✅ 本节小结

**你已掌握：**
- ✔ StandardScaler → 特征标准化
- ✔ ColumnTransformer → 对不同列施加不同变换
- ✔ Pipeline → 自动化预处理+建模流程
- ✔ cross_val_score → K-fold 交叉验证
- ✔ 残差分布图 → 诊断模型偏差

**完成练习后，进入 Stage 4：分类算法！**`,
      },
    ],
  },

  // ── STAGE 4: Classification Mini-Project ──────────────────────────────────
  {
    id: 'ch3_clf',
    stage: 4,
    chapter: 'Stage 4 · 迷你项目：分类算法',
    title: '工厂质量控制：随机森林分类',
    objective: '综合运用所学技能，完成一个完整的二分类 ML 项目：数据探索 → 特征工程 → 模型训练 → 评估与解释。',
    skills: ['二分类标签构造', 'RandomForestClassifier', '混淆矩阵', '准确率 acc', '特征重要度可视化'],
    recommendedDataset: 'manufacturing',
    difficulty: '实践',
    duration: '20 min',
    tags: ['分类', '特征重要度', '迷你项目'],
    points: 500,
    badgeId: 'master',
    quiz: [
      { id: 'q4_1', question: '随机森林算法的一个核心优势是？', options: ['运行速度比线性回归快', '自动生成特征重要度且抗过拟合', '不需要任何数学基础', '只适用于极小的数据集'], correctIndex: 1, explanation: '随机森林通过集成多棵决策树来提高泛化能力，并能通过特征重要度解释模型。' },
      { id: 'q4_2', question: '在二分类问题中，PassRate > 0.9 这种操作属于？', options: ['特征缩放', '异常值处理', '构造分类标签', '模型调参'], correctIndex: 2, explanation: '这是将连续数值转换为 0/1 离散标签的过程，即目标定义。' },
      { id: 'q4_3', question: '混淆矩阵 (Confusion Matrix) 中的 "False Positive" 代表？', options: ['实际为正，预测为负', '实际为负，预测为正', '模型预测完全正确', '数据集存在缺失值'], correctIndex: 1, explanation: 'FP 代表误报（False Positive），即把负样本错误地判为了正样本。' },
      { id: 'q4_4', question: 'RandomForestClassifier 中的 n_estimators 参数是指？', options: ['树的最大深度', '森林中决策树的数量', '每个节点的最小样本数', '随机种子的数量'], correctIndex: 1, explanation: '更多的树通常能提升稳定性，但会增加计算开销。' },
      { id: 'q4_5', question: '准确率 (Accuracy) 的定义是？', options: ['预测正确的样本数 / 总样本数', '预测正确的正样本数 / 总正样本数', '模型运行的速度', '特征重要度的平均值'], correctIndex: 0, explanation: '准确率是最直观但有时会因样本极度不均衡而失效的指标。' },
      { id: 'q4_6', question: '随机森林中的每一棵决策树是？', options: ['完全相同的', '在不同的随机数据子集和随机特征子集上训练的', '按顺序训练并互相依赖的', '不需要训练的'], correctIndex: 1, explanation: '这就是 Bagging 思想：通过引入随机性来增加树的多样性。' },
      { id: 'q4_7', question: '如果特征重要度显示变量 A 位居榜首，说明？', options: ['变量 A 是多余的', '变量 A 对模型预测结果的贡献度（通过节点纯度提升衡量）最高', '变量 A 的数值最大', '变量 A 导致了过拟合'], correctIndex: 1, explanation: '重要度衡量了该特征在分裂节点时对降低不确定性的贡献。' },
      { id: 'q4_8', question: 'classification_report 中不包含哪个指标？', options: ['Precision (精确率)', 'Recall (召回率)', 'F1-score', 'RMSE (均方根误差)'], correctIndex: 3, explanation: '分类报告提供分类指标，RMSE 是回归指标。' },
      { id: 'q4_9', question: '在质量控制项目中，提高 "优质批次" 的召回率意味着？', options: ['尽可能减少误报', '尽可能找出所有的优质批次', '让模型运行得更快', '减少输入特征的数量'], correctIndex: 1, explanation: '召回率（Recall）关注的是"找得全不全"。' },
      { id: 'q4_10', question: '如果随机森林只有 1 棵树，它退化为什么算法？', options: ['线性回归', '逻辑回归', '决策树', 'K-近邻'], correctIndex: 2, explanation: '随机森林是多棵决策树的集合。' }
    ],
    practice: {
      id: 'clf_full',
      title: '最终项目验收',
      description: '完成训练后，将准确率保存为 acc，将混淆矩阵保存为 cm（列表格式）。',
      targetMetrics: 'acc > 0.8 且 cm 已定义',
      tests: [
        'assert "acc" in locals(), "请在代码中定义 acc（模型准确率）"',
        'assert "cm" in locals(), "请在代码中定义 cm（混淆矩阵，使用 .tolist()）"',
        'assert acc > 0.5, "acc 应大于 0.5（至少比随机猜测好）"',
      ],
      hints: [
        '提示 1：acc = clf.score(X_clf, y_clf)',
        '提示 2：cm = confusion_matrix(y_clf, clf.predict(X_clf)).tolist()',
        '提示 3：确保已运行数据准备和训练的单元格',
      ],
    },
    cells: [
      {
        id: 'c3_obj',
        type: 'objective',
        isLocked: true,
        content: `## 🎯 迷你项目目标

**任务背景：** 你是一家工厂的数据分析师。工厂每批产品完工后都有一个 \`PassRate\`（合格率）。

你的任务：
1. 将 PassRate > 0.9 的批次标记为"优质批次（1）"
2. 训练一个随机森林分类器来**预测**哪些批次会是优质的
3. 找出影响质量最大的**关键生产参数**

完成后，你将拥有一套完整的 ML 分类项目！`,
      },
      {
        id: 'c3_m1',
        type: 'markdown',
        isLocked: true,
        content: `### 📖 Step 1：探索数据

先看看我们拥有哪些变量，以及目标变量 PassRate 的分布。`,
      },
      {
        id: 'c3_c1',
        type: 'code',
        content: `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import confusion_matrix, accuracy_score, classification_report

if df.empty:
    print("⚠️  请加载 Manufacturing 数据集")
else:
    print("✅ 数据集加载成功！")
    print("列名:", list(df.columns))
    print("样本数:", len(df))

    if "PassRate" in df.columns:
        print(f"\\nPassRate 统计:")
        print(df["PassRate"].describe())
        print(f"\\n> 0.9 的优质批次比例: {(df['PassRate'] > 0.9).mean():.1%}")`,
      },
      {
        id: 'c3_m2',
        type: 'markdown',
        isLocked: true,
        content: `### 📖 Step 2：构造分类标签

我们把 \`PassRate > 0.9\` 定义为"优质"（标签 = 1），其余为"普通"（标签 = 0）。

这是一个**二分类**问题（是/否，优质/普通）。`,
      },
      {
        id: 'c3_c2',
        type: 'code',
        content: `if "PassRate" in df.columns:
    df_clf = df.copy()
    df_clf["is_premium"] = (df_clf["PassRate"] > 0.9).astype(int)
    print(df_clf["is_premium"].value_counts())
else:
    print("PassRate column was not found.")`,
      },
      {
        id: 'c3_c2b',
        type: 'code',
        content: `if "df_clf" in locals():
    drop_cols = ["PassRate", "is_premium"]
    X_clf = df_clf.select_dtypes(include=[np.number]).drop(
        [c for c in drop_cols if c in df_clf.columns], axis=1
    )
    y_clf = df_clf["is_premium"]
    print(list(X_clf.columns))
else:
    print("Please build the label column first.")`,
      },
      {
        id: 'c3_m3',
        type: 'markdown',
        isLocked: true,
        content: `### 代码拆解：随机森林分类

这段代码可以拆成 4 个动作：
1. 创建分类器 \`clf\`
2. 用 \`fit\` 训练它
3. 用 \`predict\` 生成预测
4. 计算 \`acc\` 和 \`cm\`

对初学者来说，先看最后两行指标输出，最容易理解这段代码在做什么。`,
      },
      {
        id: 'c3_c3',
        type: 'code',
        content: `if "X_clf" in locals() and not X_clf.empty:
    clf = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=5)
    clf.fit(X_clf, y_clf)
    print("Model trained.")
else:
    print("Please run the feature selection cell first.")`,
      },
      {
        id: 'c3_c3b',
        type: 'code',
        content: `if "clf" in locals():
    y_pred_clf = clf.predict(X_clf)
    print(y_pred_clf[:10])
else:
    print("Please train the model first.")`,
      },
      {
        id: 'c3_c3c',
        type: 'code',
        content: `if "y_pred_clf" in locals():
    acc = accuracy_score(y_clf, y_pred_clf)
    cm = confusion_matrix(y_clf, y_pred_clf).tolist()
    print(f"Accuracy: {acc:.4%}")
    print(classification_report(y_clf, y_pred_clf, target_names=["normal", "premium"]))
else:
    print("Please generate predictions first.")`,
      },
      {
        id: 'c3_m4',
        type: 'markdown',
        isLocked: true,
        content: `### 📖 Step 4：特征重要度 —— 什么决定了批次质量？

随机森林可以告诉我们，哪些生产参数对预测结果影响最大。

这是工厂优化的关键洞察！`,
      },
      {
        id: 'c3_c4',
        type: 'code',
        content: `if "clf" in locals():
    importances = pd.Series(clf.feature_importances_, index=X_clf.columns)
    importances_sorted = importances.sort_values(ascending=True)

    plt.figure(figsize=(8, max(4, len(importances) * 0.5)))
    colors = ["#8b5cf6" if v == importances_sorted.max() else "#6366f1" for v in importances_sorted.values]
    importances_sorted.plot(kind="barh", color=colors, edgecolor="white")
    plt.title("关键质量影响因素（特征重要度）")
    plt.xlabel("重要度分数")
    plt.tight_layout()
    print(f"✅ 最重要的特征: {importances.idxmax()} (重要度: {importances.max():.4f})")
else:
    print("⚠️  请先运行模型训练单元格")`,
      },
      {
        id: 'c3_summary',
        type: 'summary',
        isLocked: true,
        content: `## 🏆 项目完成！你已掌握完整的 ML 分类流程

**技能清单：**
- ✔ 二分类标签构造
- ✔ RandomForestClassifier 训练
- ✔ accuracy_score 准确率
- ✔ confusion_matrix 混淆矩阵
- ✔ 特征重要度可视化

**你已完成 Python 学习实验室全部 4 个 Stage！** 🎉

恭喜你从"运行代码"成长为"构建 ML 项目"！`,
      },
    ],
  },
];
