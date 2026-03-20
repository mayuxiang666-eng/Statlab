// ─── Data Model ─────────────────────────────────────────────────────────────

export interface NotebookCell {
  id: string;
  type: 'markdown' | 'code' | 'objective' | 'summary';
  content: string;
  label?: string;        // Descriptive title for the cell (IDE-style)
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
  stage: number;  // Lesson number
  chapter: string;
  title: string;
  objective: string;
  skills: string[];       // Skills learner will gain
  recommendedDataset: string;
  difficulty: '入门' | '进阶' | '实践';
  duration: string;
  tags: string[];
  tutorialCells: NotebookCell[];
  exerciseCells: NotebookCell[];
  practice?: LabPractice;
  quiz?: QuizQuestion[];
  points: number;
  badgeId: string;
}

// ─── Course Library ──────────────────────────────────────────────────────────

export const LAB_COURSES: LabCourse[] = [

  // ── LESSON 1: How Models Work ─────────────────────────────────────────────
  {
    id: 'lesson_1',
    stage: 1,
    chapter: 'Lesson 1',
    title: '模型是如何工作的？',
    objective: '理解机器学习模型的基础概念，认识决策树及其在复杂决策中的应用。',
    skills: ['决策树概念', '模型训练思想', '预测原理'],
    recommendedDataset: 'housing',
    difficulty: '入门',
    duration: '5 min',
    tags: ['概念', '入门'],
    points: 50,
    badgeId: 'thinker',
    tutorialCells: [
      {
        id: 'l1_t1',
        type: 'objective',
        isLocked: true,
        content: `## 🎯 学习目标
在本节结束时，你将理解：
- 什么是机器学习模型
- 决策树（Decision Tree）的工作机制
- 如何从历史数据中捕捉规律`,
      },
      {
        id: 'l1_t2',
        type: 'markdown',
        isLocked: true,
        content: `### 📖 机器学习的核心思想
机器学习不是让电脑直接记住答案，而是让电脑从数据中**学习规律**。

想象你是一个房地产专家。当有人问你某个房子的价格时，你会看：
- 房子的面积
- 房间的数量
- 房子的房龄
- 所在的区域

基于这些信息，你在脑海中建立了一套“规则”。机器学习模型就是把这些规则从你的脑海中转移到代码里。`,
      },
      {
        id: 'l1_t3',
        type: 'markdown',
        isLocked: true,
        content: `### 🌲 什么是决策树？
决策树是最直观的模型之一。它像一个流程图：
1. **第一层判断**：房子是否大于 100 平米？
   - 如果是 → **第二层判断**：是否有花园？
     - 有花园 → 预测价格: 500w
     - 无花园 → 预测价格: 400w
   - 如果不是 → **第二层判断**：距离地铁站是否 < 500m？
     - 距离近 → 预测价格: 350w
     - 距离远 → 预测价格: 280w

模型会从历史成交数据中自动寻找这些最优的“分割点”和“预测值”。`,
      },
    ],
    exerciseCells: [
      {
        id: 'l1_e1',
        type: 'markdown',
        content: `### ✍️ 基础练习：认识数据结构
在这个入门练习中，我们先检查环境是否已加载我们的数据资产容器 \`df\`。`,
      },
      {
        id: 'l1_e2',
        type: 'code',
        label: '环境检查',
        content: `import pandas as pd
# 检查数据容器是否就绪
if 'df' in locals():
    print("✅ 系统数据容器已就绪")
    print(f"数据列包含: {list(df.columns)}")
else:
    print("❌ 数据源未加载，请确保已选择 Housing 数据集")`,
      },
    ],
  },

  // ── LESSON 2: Basic Data Exploration ──────────────────────────────────────
  {
    id: 'lesson_2',
    stage: 2,
    chapter: 'Lesson 2',
    title: '基础数据探索',
    objective: '掌握使用 Pandas 库探索和理解数据集的基本方法。',
    skills: ['Pandas 基础', '数据概览', '描述性统计', '特征筛选'],
    recommendedDataset: 'housing',
    difficulty: '入门',
    duration: '10 min',
    tags: ['EDA', 'Pandas'],
    points: 100,
    badgeId: 'explorer',
    tutorialCells: [
      {
        id: 'l2_t1',
        type: 'markdown',
        isLocked: true,
        content: '### 🚀 步骤 1: 加载并观察数据\n使用 `describe()` 函数来查看房屋数据的数值摘要，包括均值、标准差、最小值、最大值以及分位数。',
      },
      {
        id: 'l2_t2',
        type: 'code',
        label: '查看统计摘要',
        isLocked: true,
        content: `# 运行此单元格
summary = df.describe()
print(summary)`,
      },
      {
        id: 'l2_t3',
        type: 'markdown',
        isLocked: true,
        content: '### 🔍 步骤 2: 预览前 5 行\n查看数据的顶部，了解数据的具体长相，这有助于直观感受特征的含义。',
      },
      {
        id: 'l2_t4',
        type: 'code',
        label: '数据预览',
        isLocked: true,
        content: `# 使用 head 命令
print(df.head())`,
      },
      {
        id: 'l2_t5',
        type: 'markdown',
        isLocked: true,
        content: '### 📊 步骤 3: 检查数据列与类型\n了解数据集包含哪些列以及它们的数据类型（如浮点数、整数或对象）至关重要。',
      },
      {
        id: 'l2_t6',
        type: 'code',
        label: '检查列信息',
        isLocked: true,
        content: `# 查看列名列表
print("Columns:", df.columns.tolist())
# 查看数据类型
print("\\nData Types:")
print(df.dtypes)`,
      },
      {
        id: 'l2_t7',
        type: 'markdown',
        isLocked: true,
        content: '### 📉 步骤 4: 统计特定特征\n我们可以对特定列进行针对性分析。例如，了解房价的分布范围。',
      },
      {
        id: 'l2_t8',
        type: 'code',
        label: '特征深度探索',
        isLocked: true,
        content: `# 计算平均价格
avg_price = df['Price'].mean()
print(f"平均房价: {avg_price:,.2f}")

# 找出最大卧室数量
max_rooms = df['Rooms'].max()
print(f"最大卧室数量: {max_rooms}")`,
      },
    ],
    exerciseCells: [
      {
        id: 'l2_e1',
        type: 'markdown',
        content: '# 练习: 探索你的数据\n\n在这个练习中，你将使用 Pandas 来分析墨尔本的房屋数据。',
      },
      {
        id: 'l2_e2',
        type: 'markdown',
        content: '### 📋 任务 1\n查看数据集的描述性统计信息，并将其保存到变量 `home_data_summary` 中。',
      },
      {
        id: 'l2_e3',
        type: 'code',
        label: '你的代码',
        content: `# 在下方输入你的代码
home_data_summary = ____
print(home_data_summary)`,
      },
      {
        id: 'l2_e4',
        type: 'markdown',
        content: '### 📋 任务 2\n计算该数据集中所有房屋的平均占地面积（Landsize），并保存到变量 `avg_land_size`。',
      },
      {
        id: 'l2_e5',
        type: 'code',
        label: '你的代码',
        content: `# 在下方写下代码
avg_land_size = ____
print(avg_land_size)`,
      },
    ],
    practice: {
      id: 'eda_check',
      title: '数据探索验证',
      description: '请在代码中计算房屋平均价格并保存到变量 average_price。',
      targetMetrics: 'average_price 变量已定义且正确',
      tests: [
        'assert "home_data_summary" in locals()',
        'assert "avg_land_size" in locals()',
        'assert "df" in locals()',
      ],
      hints: ['提示：使用 df["Price"].mean()'],
    },
  },

  // ── LESSON 3: Your First Machine Learning Model ───────────────────────────
  {
    id: 'lesson_3',
    stage: 3,
    chapter: 'Lesson 3',
    title: '你的第一个机器学习模型',
    objective: '学习如何定义特征、选择目标，并使用 Scikit-Learn 训练决策树模型。',
    skills: ['特征选择', '目标变量', 'DecisionTreeRegressor', '模型拟合'],
    recommendedDataset: 'housing',
    difficulty: '入门',
    duration: '15 min',
    tags: ['Scikit-Learn', '建模', '回归'],
    points: 150,
    badgeId: 'builder',
    tutorialCells: [
      {
        id: 'l3_t1',
        type: 'markdown',
        isLocked: true,
        content: `### 🛠️ 建立模型的四个步骤
1. **选择目标 (y)**: 你想预测什么？（例如：房价 Price）
2. **选择特征 (X)**: 你用什么来预测？（例如：面积、房间数）
3. **选择模型**: 你想用哪种数学算法？（例如：DecisionTreeRegressor）
4. **拟合模型**: 让模型从数据中学习规律。`,
      },
      {
        id: 'l3_t2',
        type: 'code',
        label: '建模代码模版',
        isLocked: true,
        content: `from sklearn.tree import DecisionTreeRegressor

# 1. 定义目标
y = df.Price

# 2. 选择特征
features = ['Rooms', 'Bathroom', 'Landsize', 'Lattitude', 'Longtitude']
X = df[features]

# 3. 定义模型
model = DecisionTreeRegressor(random_state=1)

# 4. 拟合
model.fit(X, y)

print("模型训练完成！")`,
      },
    ],
    exerciseCells: [
      {
        id: 'l3_e1',
        type: 'markdown',
        content: `### 🎯 任务: 为你的房屋数据建模
首先，打印出所有的列名，以便选择合适的特征。`,
      },
      {
        id: 'l3_e2',
        type: 'code',
        label: '查看特征库',
        content: `print(df.columns)`,
      },
      {
        id: 'l3_e3',
        type: 'markdown',
        content: `### 📋 步骤 1: 指定预测目标
通常模型的预测目标变量被称为 **y**。请将房价列赋值给 y。`,
      },
      {
        id: 'l3_e4',
        type: 'code',
        label: '定义 y',
        placeholder: 'y = df.____',
        content: `y = df.Price
print("Target defined.")`,
      },
      {
        id: 'l3_e5',
        type: 'markdown',
        content: `### 📋 步骤 2: 创建特征集 X
我们将使用一个特征列表。请从 DataFrame 中选取这些列组成 X。`,
      },
      {
        id: 'l3_e6',
        type: 'code',
        label: '定义 X',
        content: `feature_names = ['Rooms', 'Bathroom', 'Landsize', 'Lattitude', 'Longtitude']
X = df[feature_names]
print(X.head())`,
      },
      {
        id: 'l3_e7',
        type: 'markdown',
        content: `### 📋 步骤 3: 训练模型
现在使用 \`DecisionTreeRegressor\` 并对其进行 \`fit\` 拟合。`,
      },
      {
        id: 'l3_e8',
        type: 'code',
        label: '模型拟合',
        content: `from sklearn.tree import DecisionTreeRegressor

# 定义模型并指定 random_state 以保证结果可重复
iowa_model = DecisionTreeRegressor(random_state=1)

# 拟合模型
iowa_model.fit(X, y)
print("模型拟合成功！")`,
      },
    ],
    practice: {
      id: 'model_fit',
      title: '建模验证',
      description: '确保 X 和 y 已正确定义，且模型已拟合。',
      targetMetrics: 'X 的列数应为 5, y 长度应匹配',
      tests: [
        'assert X.shape[1] == 5, "X 应该有 5 个特征"',
        'assert len(y) == len(df), "y 的长度不正确"',
      ],
      hints: ['检查 feature_names 列表是否包含 5 个元素'],
    },
  },

  // ── LESSON 4: Model Validation ────────────────────────────────────────────
  {
    id: 'lesson_4',
    stage: 4,
    chapter: 'Lesson 4',
    title: '模型验证',
    objective: '学习如何使用验证集评估模型性能，理解 MAE 指标。',
    skills: ['训练/测试集切分', 'MAE 计算', '泛化能力评估'],
    recommendedDataset: 'housing',
    difficulty: '入门',
    duration: '15 min',
    tags: ['验证', '评估'],
    points: 200,
    badgeId: 'validator',
    tutorialCells: [
      {
        id: 'l4_t1',
        type: 'markdown',
        isLocked: true,
        content: `### 📏 为什么需要验证？
你不能用训练过模型的数据来评估模型。这就像学生提前拿到了考试题目。

我们需要将数据切分为两部分：
1. **训练集 (Training Set)**: 模型用来学习规律。
2. **验证集 (Validation Set)**: 模型从未见过，用来测试它的真实表现。

最常用的评估指标是 **MAE (平均绝对误差)**。`,
      },
      {
        id: 'l4_t2',
        type: 'code',
        label: '验证流程示例',
        isLocked: true,
        content: `from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

# 切分数据
train_X, val_X, train_y, val_y = train_test_split(X, y, random_state=0)

# 定义并训练模型
model = DecisionTreeRegressor()
model.fit(train_X, train_y)

# 预测并计算误差
val_predictions = model.predict(val_X)
print(mean_absolute_error(val_y, val_predictions))`,
      },
    ],
    exerciseCells: [
      {
        id: 'l4_e1',
        type: 'markdown',
        content: `### ✍️ 练习：计算验证集 MAE
首先，切分数据。我们使用 \`train_test_split\`。`,
      },
      {
        id: 'l4_e2',
        type: 'code',
        label: '切分数据',
        content: `from sklearn.model_selection import train_test_split

train_X, val_X, train_y, val_y = train_test_split(X, y, random_state=1)
print("Data split complete.")`,
      },
      {
        id: 'l4_e3',
        type: 'code',
        label: '训练验证模型',
        content: `from sklearn.metrics import mean_absolute_error
from sklearn.tree import DecisionTreeRegressor

# 在训练集上训练
iowa_model = DecisionTreeRegressor(random_state=1)
iowa_model.fit(train_X, train_y)

# 在验证集上预测
val_predictions = iowa_model.predict(val_X)

# 计算 MAE
val_mae = mean_absolute_error(val_y, val_predictions)
print(f"验证集 MAE: {val_mae:,.2f}")`,
      },
    ],
    practice: {
      id: 'mae_check',
      title: '验证效果检测',
      description: '确保 val_mae 变量已计算。',
      targetMetrics: 'val_mae 必须是数值且 > 0',
      tests: [
        'assert val_mae > 0, "val_mae 必须是一个正数"',
      ],
      hints: ['确保使用的是 val_X 进行预测'],
    },
  },

  // ── LESSON 5: Underfitting and Overfitting ────────────────────────────────
  {
    id: 'lesson_5',
    stage: 5,
    chapter: 'Lesson 5',
    title: '欠拟合与过拟合',
    objective: '理解模型复杂度的平衡，学习如何寻找最优的树深度。',
    skills: ['过拟合概念', '欠拟合概念', '调参优化'],
    recommendedDataset: 'housing',
    difficulty: '入门',
    duration: '15 min',
    tags: ['优化', '调参'],
    points: 250,
    badgeId: 'optimizer',
    tutorialCells: [
      {
        id: 'l5_t1',
        type: 'markdown',
        isLocked: true,
        content: `### ⚖️ 寻找平衡点
- **过拟合 (Overfitting)**: 树分得太细，模型记住了训练数据的每一个噪音，但在新数据上表现极差。
- **欠拟合 (Underfitting)**: 树分得太粗，模型还没能学到数据中的主要规律。

我们可以通过控制 \`max_leaf_nodes\` (最大叶节点数) 来平衡它。`,
      },
    ],
    exerciseCells: [
      {
        id: 'l5_e1',
        type: 'markdown',
        content: `### ✍️ 练习：比较不同的树深度
编写一个函数来返回不同 \`max_leaf_nodes\` 下的 MAE。`,
      },
      {
        id: 'l5_e2',
        type: 'code',
        label: '定义评估函数',
        content: `def get_mae(max_leaf_nodes, train_X, val_X, train_y, val_y):
    model = DecisionTreeRegressor(max_leaf_nodes=max_leaf_nodes, random_state=0)
    model.fit(train_X, train_y)
    preds_val = model.predict(val_X)
    mae = mean_absolute_error(val_y, preds_val)
    return mae`,
      },
      {
        id: 'l5_e3',
        type: 'code',
        label: '寻找最优解',
        content: `candidate_max_leaf_nodes = [5, 50, 500, 5000]
# 编写循环寻找
for max_leaf_nodes in candidate_max_leaf_nodes:
    my_mae = get_mae(max_leaf_nodes, train_X, val_X, train_y, val_y)
    print(f"Max leaf nodes: {max_leaf_nodes}  \\t\\t Mean Absolute Error:  {my_mae:,.0f}")`,
      },
    ],
    practice: {
      id: 'best_size',
      title: '优化验证',
      description: '确定哪个叶节点数效果最好。',
      targetMetrics: '找到最小的 MAE 对应的节点数',
      tests: [
        'assert "candidate_max_leaf_nodes" in locals(), "列表未定义"',
      ],
      hints: ['通常 50 或 500 的效果优于 5 或 5000'],
    },
  },

  // ── LESSON 6: Random Forests ──────────────────────────────────────────────
  {
    id: 'lesson_6',
    stage: 6,
    chapter: 'Lesson 6',
    title: '随机森林',
    objective: '学习集成学习方法，用随机森林提升预测精度。',
    skills: ['集成学习', 'RandomForestRegressor'],
    recommendedDataset: 'housing',
    difficulty: '入门',
    duration: '10 min',
    tags: ['集成学习', '随机森林'],
    points: 300,
    badgeId: 'ensemble_master',
    tutorialCells: [
      {
        id: 'l6_t1',
        type: 'markdown',
        isLocked: true,
        content: `### 🤝 众人的智慧
单一的一棵决策树往往不够稳健。**随机森林 (Random Forest)** 通过集成许多棵决策树来做出预测。

它的优点：
- 通常比单一决策树更准确
- 不需要精细的调参也能表现良好
- 鲁棒性更强`,
      },
      {
        id: 'l6_t2',
        type: 'code',
        label: '随机森林代码',
        isLocked: true,
        content: `from sklearn.ensemble import RandomForestRegressor

rf_model = RandomForestRegressor(random_state=1)
rf_model.fit(train_X, train_y)
rf_val_mae = mean_absolute_error(val_y, rf_model.predict(val_X))
print(f"随机森林 MAE: {rf_val_mae:,.2f}")`,
      },
    ],
    exerciseCells: [
      {
        id: 'l6_e1',
        type: 'markdown',
        content: `### ✍️ 练习：部署随机森林
直接使用 Scikit-Learn 的 \`RandomForestRegressor\`。`,
      },
      {
        id: 'l6_e2',
        type: 'code',
        label: '训练森林',
        content: `from sklearn.ensemble import RandomForestRegressor

# 定义模型
rf_model = RandomForestRegressor(random_state=1)

# 拟合
rf_model.fit(train_X, train_y)

# 评估
rf_val_mae = mean_absolute_error(val_y, rf_model.predict(val_X))
print(f"Random Forest MAE: {rf_val_mae:,.0f}")`,
      },
    ],
    practice: {
      id: 'rf_check',
      title: '结果对比',
      description: '比较随机森林和决策树的 MAE。',
      targetMetrics: 'rf_val_mae 应小于单一树的 MAE',
      tests: [
        'assert rf_val_mae < val_mae, "随机森林通常应该表现更好"',
      ],
      hints: ['检查 random_state 是否统一'],
    },
  },

  // ── LESSON 7: Machine Learning Competitions ──────────────────────────────
  {
    id: 'lesson_7',
    stage: 7,
    chapter: 'Lesson 7',
    title: '机器学习竞赛入门',
    objective: '将所学应用于实战，完成最终的预测任务并保存结果。',
    skills: ['项目实战', '结果保存', '模型交付'],
    recommendedDataset: 'housing',
    difficulty: '实践',
    duration: '20 min',
    tags: ['竞赛', '完成'],
    points: 500,
    badgeId: 'competition_ranker',
    tutorialCells: [
      {
        id: 'l7_t1',
        type: 'markdown',
        isLocked: true,
        content: `### 🏆 最后的挑战
你已经掌握了机器学习的基础流程。现在是时候把它们全部整合起来了。

在真实的竞赛中，你会：
1. 深入挖掘特征
2. 尝试不同的算法
3. 调整超参数
4. 导出预测结果进行提交`,
      },
    ],
    exerciseCells: [
      {
        id: 'l7_e1',
        type: 'markdown',
        content: `### ✍️ 最终任务：交付你的模型
在这个练习中，你将训练一个最终模型并保存。`,
      },
      {
        id: 'l7_e2',
        type: 'code',
        label: '最终模型训练',
        content: `# 使用所有数据训练最终模型
full_model = RandomForestRegressor(n_estimators=100, random_state=1)
full_model.fit(X, y)
print("Final model trained on full dataset.")`,
      },
      {
        id: 'l7_e3',
        type: 'code',
        label: '生成交付结果',
        content: `test_preds = full_model.predict(X.head(100)) # 模拟测试集
print("Predictions generated for 100 samples.")
print(test_preds[:5])`,
      },
    ],
    practice: {
      id: 'final_cert',
      title: '结业验证',
      description: '确认最终模型已训练。',
      targetMetrics: 'full_model 已创建且状态正确',
      tests: [
        'assert "full_model" in locals(), "未定义最终模型"',
      ],
      hints: ['这是最后一关！加油'],
    },
  },
];
