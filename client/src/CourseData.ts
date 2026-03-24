export interface LabCheckpoint {
  id: string;
  title: string;
  tests: string[];
  hint: string;
  blocking: boolean;
}

export interface NotebookCell {
  id: string;
  type: 'markdown' | 'code' | 'objective' | 'summary';
  content: string;
  label?: string;
  isLocked?: boolean;
  placeholder?: string;
  isEditing?: boolean;
  starterCode?: string;
  checkpointTests?: string[];
  expectedPatterns?: string[];
  dependsOn?: string[];
  difficultyTag?: 'warmup' | 'core' | 'challenge';
  prompt?: string;
  requiresFill?: boolean;
  placeholders?: string[];
  checkAlias?: string;
  referenceSolution?: string;
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
  kind?: 'single' | 'fill';
  question: string;
  options?: string[];
  correctIndex?: number;
  answerText?: string;
  explanation: string;
}

export interface CompletionCriteria {
  minPassedCheckpoints: number;
  requireFinalTestPass: boolean;
  requiredVariables: string[];
}

export type LessonPhase = 'data-foundation' | 'modeling';

export interface LabCourse {
  id: string;
  stage: number;
  chapter: string;
  title: string;
  objective: string;
  prerequisites: string[];
  skills: string[];
  recommendedDataset: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Practical';
  duration: string;
  tags: string[];
  bootstrapCode: string;
  tutorialCells: NotebookCell[];
  exerciseCells: NotebookCell[];
  exerciseCheckpoints: LabCheckpoint[];
  completionCriteria: CompletionCriteria;
  practice?: LabPractice;
  quiz?: QuizQuestion[];
  points: number;
  phase: LessonPhase;
  badgeId: string;
}

export interface LessonStep {
  id: string;
  title: string;
  teachingNote: string;
  prompt: string;
  tutorialCode: string;
  starterTemplate: string;
  referenceSolution: string;
  checkpointTests: string[];
  hint: string;
  expectedPatterns?: string[];
  dependsOn?: string[];
  difficultyTag: 'warmup' | 'core' | 'challenge';
  checkAlias: string;
  forbiddenPatterns?: string[];
}

type LessonBlueprint = {
  stage: number;
  title: string;
  objective: string;
  prerequisites: string[];
  skills: string[];
  recommendedDataset: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Practical';
  duration: string;
  tags: string[];
  focusCols: string[];
  targetCol: string;
  modelImport: string;
  modelName: string;
};

const COMMON_BOOTSTRAP = `import warnings
warnings.filterwarnings('ignore')
import numpy as np
import pandas as pd

np.random.seed(42)

if 'df' not in locals() or df is None:
    df = pd.DataFrame()

if df.empty:
    print('WARN: dataset is empty, bind a dataset before running exercises.')
else:
    df.columns = [str(c).strip().replace('\\ufeff', '') for c in df.columns]
    text_cols = df.select_dtypes(include=['object']).columns.tolist()
    for col in text_cols:
        df[col] = df[col].astype(str).str.replace('\\ufeff', '', regex=False).str.replace('\\ufffd', '', regex=False).str.strip()
    before_rows = len(df)
    df = df.drop_duplicates().reset_index(drop=True)
    removed_dup = before_rows - len(df)
    print(f'OK: dataset loaded: {len(df)} rows, {len(df.columns)} cols')
    if removed_dup > 0:
        print(f'INFO: removed {removed_dup} duplicated rows automatically for practice stability.')
    print('Columns preview:', df.columns[:8].tolist())
`;

function buildTutorialRunnableCode(cell: NotebookCell): string {
  const source = cell.content || '';
  const ref = (cell.referenceSolution || '').trim();
  const lines = source.split('\n');
  const result: string[] = [];
  let insertedRef = false;

  for (const line of lines) {
    if (/step_\d+\.check\(\)/.test(line)) continue;
    if (/(____|TODO)/.test(line)) {
      if (!insertedRef && ref) {
        result.push('# Tutorial runnable answer');
        ref.split('\n').forEach((r) => result.push(r));
        insertedRef = true;
      }
      continue;
    }
    result.push(line);
  }

  return result.join('\n').trim();
}

function makeTutorialCells(prefix: string, bp: LessonBlueprint): NotebookCell[] {
  const exerciseCodeCells = makeExerciseCells(prefix, bp).filter((c) => c.type === 'code');
  const tutorialCells: NotebookCell[] = [
    {
      id: `${prefix}_t0`,
      type: 'objective',
      isLocked: true,
      content: `## Learning Goals\n- ${bp.objective}\n- Follow step-by-step runnable examples\n- Understand each step before coding by yourself`,
    },
    {
      id: `${prefix}_t0b`,
      type: 'markdown',
      isLocked: true,
      content: `### Prerequisites\n${bp.prerequisites.map((x) => `- ${x}`).join('\n')}\n\n### Key Skills\n${bp.skills.map((x) => `- ${x}`).join('\n')}`,
    },
  ];

  exerciseCodeCells.forEach((cell, idx) => {
    const runnable = buildTutorialRunnableCode(cell);

    tutorialCells.push({
      id: `${prefix}_t_m${idx + 1}`,
      type: 'markdown',
      isLocked: true,
      content: `### Step ${idx + 1}: ${cell.label || `Step ${idx + 1}`}\n${cell.prompt || 'Read the code and understand why this step is needed.'}\n\n- Why this step: build a minimal data-to-result loop.\n- Observe: row count, column names, and key intermediate variables.\n- Common errors: undefined names, wrong columns, unfilled placeholders.`,
    });

    tutorialCells.push({
      id: `${prefix}_t_c${idx + 1}`,
      type: 'code',
      label: `Tutorial Step ${idx + 1}`,
      isLocked: true,
      content: runnable,
      checkpointTests: cell.checkpointTests,
      checkAlias: cell.checkAlias,
      difficultyTag: cell.difficultyTag,
    });
  });

  tutorialCells.push({
    id: `${prefix}_t_end`,
    type: 'summary',
    isLocked: true,
    content: `### Wrap-up\nTutorial and Exercise now share the same chapter steps.\nSwitch to Exercise mode and complete the same checkpoints by filling blanks.`,
  });

  return tutorialCells;
}

function makeExerciseCells(prefix: string, bp: LessonBlueprint): NotebookCell[] {
  if (bp.stage === 1) {
    return [
      { id: `${prefix}_e1`, type: 'markdown', content: '### Step 1: Read CSV\nUse pandas to read CSV text and preview rows.' },
      {
        id: `${prefix}_e2`,
        type: 'code',
        label: 'Step 1 - CSV',
        prompt: '?? `pd.read_csv` ?? CSV ?????? `df_csv`?',
        requiresFill: true,
        placeholders: ['____'],
        checkAlias: 'step_1.check()',
        starterCode: `from io import StringIO
csv_text = df.head(50).to_csv(index=False)
# ??????? ____ ??? pd.read_csv(...) ???
df_csv = ____
print(df_csv.head(3))

step_1.check()`,
        content: `from io import StringIO
csv_text = df.head(50).to_csv(index=False)
# ??????? ____ ??? pd.read_csv(...) ???
df_csv = ____
print(df_csv.head(3))

step_1.check()`,
        referenceSolution: `df_csv = pd.read_csv(StringIO(csv_text))`,
        checkpointTests: [`assert 'df_csv' in locals(), 'df_csv is missing'`, `assert len(df_csv) > 0, 'df_csv should not be empty'`],
        expectedPatterns: ['read_csv', 'StringIO'],
        difficultyTag: 'warmup',
      },
      { id: `${prefix}_e3`, type: 'markdown', content: '### Step 2: Read Excel\nUse pandas to read an in-memory Excel buffer.' },
      {
        id: `${prefix}_e4`,
        type: 'code',
        label: 'Step 2 - Excel',
        prompt: '?? `pd.read_excel` ???????? Excel?',
        requiresFill: true,
        placeholders: ['____'],
        checkAlias: 'step_2.check()',
        starterCode: `from io import BytesIO
excel_buffer = BytesIO()
df_csv.head(50).to_excel(excel_buffer, index=False)
excel_buffer.seek(0)
try:
    # ??????? ____ ??? pd.read_excel(excel_buffer)
    df_excel = ____
except Exception:
    df_excel = df_csv.copy()
print(df_excel.head(3))

step_2.check()`,
        content: `from io import BytesIO
excel_buffer = BytesIO()
df_csv.head(50).to_excel(excel_buffer, index=False)
excel_buffer.seek(0)
try:
    # ??????? ____ ??? pd.read_excel(excel_buffer)
    df_excel = ____
except Exception:
    df_excel = df_csv.copy()
print(df_excel.head(3))

step_2.check()`,
        referenceSolution: `df_excel = pd.read_excel(excel_buffer)`,
        checkpointTests: [`assert 'df_excel' in locals(), 'df_excel is missing'`, `assert len(df_excel) > 0, 'df_excel should not be empty'`],
        dependsOn: [`${prefix}_e2`],
        difficultyTag: 'warmup',
      },
      { id: `${prefix}_e5`, type: 'markdown', content: '### Step 3: DataFrame basics\nInspect shape and columns.' },
      {
        id: `${prefix}_e6`,
        type: 'code',
        label: 'Step 3 - DataFrame',
        prompt: '? `df_excel` ?? `shape` ? `columns` ???',
        requiresFill: true,
        placeholders: ['____'],
        checkAlias: 'step_3.check()',
        starterCode: `# You need to fill: replace ____ with df_excel.shape
shape_info = ____
# You need to fill: replace ____ with a list of column names
columns_info = ____
print(shape_info)
print(columns_info[:8])
df_excel.info()

step_3.check()`,
        content: `# You need to fill: replace ____ with df_excel.shape
shape_info = ____
# You need to fill: replace ____ with a list of column names
columns_info = ____
print(shape_info)
print(columns_info[:8])
df_excel.info()

step_3.check()`,
        referenceSolution: `shape_info = df_excel.shape
columns_info = df_excel.columns.tolist()`,
        checkpointTests: [`assert 'shape_info' in locals(), 'shape_info is missing'`, `assert 'columns_info' in locals() and len(columns_info) > 0, 'columns_info missing'`],
        dependsOn: [`${prefix}_e4`],
        difficultyTag: 'core',
      },
      { id: `${prefix}_e7`, type: 'markdown', content: '### Step 4: Basic cleaning\nRemove duplicates and missing rows.' },
      {
        id: `${prefix}_e8`,
        type: 'code',
        label: 'Step 4 - Clean',
        prompt: '?????? DataFrame??? + ?????',
        requiresFill: true,
        placeholders: ['____'],
        checkAlias: 'step_4.check()',
        starterCode: `# You need to fill: replace ____ with dedup + dropna + reset_index expression
df_clean = ____
print(df_clean.shape)

step_4.check()`,
        content: `# You need to fill: replace ____ with dedup + dropna + reset_index expression
df_clean = ____
print(df_clean.shape)

step_4.check()`,
        referenceSolution: `df_clean = df_excel.drop_duplicates().dropna().reset_index(drop=True)`,
        checkpointTests: [`assert 'df_clean' in locals(), 'df_clean is missing'`, `assert len(df_clean) <= len(df_excel), 'cleaned rows should not increase'`],
        dependsOn: [`${prefix}_e6`],
        difficultyTag: 'core',
      },
      { id: `${prefix}_e9`, type: 'markdown', content: '### Step 5: Summary statistics\nGenerate describe and groupby summary.' },
      {
        id: `${prefix}_e10`,
        type: 'code',
        label: 'Step 5 - Summary',
        prompt: '?? `describe` ??? `groupby` ????',
        requiresFill: true,
        placeholders: ['____'],
        checkAlias: 'step_5.check()',
        starterCode: `summary_df = df_clean.describe(include='all')
group_col = df_clean.columns[0]
# You need to fill: replace ____ with a groupby count expression
group_stats = ____
print(summary_df.head())
print(group_stats.head())

step_5.check()`,
        content: `summary_df = df_clean.describe(include='all')
group_col = df_clean.columns[0]
# You need to fill: replace ____ with a groupby count expression
group_stats = ____
print(summary_df.head())
print(group_stats.head())

step_5.check()`,
        referenceSolution: `group_stats = df_clean.groupby(group_col).size().reset_index(name='count')`,
        checkpointTests: [`assert 'summary_df' in locals(), 'summary_df is missing'`, `assert 'group_stats' in locals() and len(group_stats) > 0, 'group_stats missing'`],
        dependsOn: [`${prefix}_e8`],
        difficultyTag: 'challenge',
      },
      { id: `${prefix}_e11`, type: 'markdown', content: '### Step 6: Matplotlib plot\nDraw your first chart and print final message.' },
      {
        id: `${prefix}_e12`,
        type: 'code',
        label: 'Step 6 - Plot',
        prompt: '?? `matplotlib` ????????scatter plot??',
        requiresFill: true,
        placeholders: ['____'],
        checkAlias: 'step_6.check()',
        starterCode: `import matplotlib.pyplot as plt
num_cols = df_clean.select_dtypes(include='number').columns.tolist()
if len(num_cols) >= 2:
    x, y = num_cols[0], num_cols[1]
elif len(num_cols) == 1:
    x, y = num_cols[0], num_cols[0]
else:
    x, y = df_clean.columns[0], df_clean.columns[0]

plt.figure(figsize=(6, 4))
# You need to fill: replace ____ with a single plt.scatter(...) line
____
plt.title('Beginner Plot Preview')
plt.tight_layout()
final_message = 'PASS: data basics complete'
print(final_message)

step_6.check()`,
        content: `import matplotlib.pyplot as plt
num_cols = df_clean.select_dtypes(include='number').columns.tolist()
if len(num_cols) >= 2:
    x, y = num_cols[0], num_cols[1]
elif len(num_cols) == 1:
    x, y = num_cols[0], num_cols[0]
else:
    x, y = df_clean.columns[0], df_clean.columns[0]

plt.figure(figsize=(6, 4))
# You need to fill: replace ____ with a single plt.scatter(...) line
____
plt.title('Beginner Plot Preview')
plt.tight_layout()
final_message = 'PASS: data basics complete'
print(final_message)

step_6.check()`,
        referenceSolution: `plt.scatter(df_clean[x], df_clean[y], alpha=0.5)`,
        checkpointTests: [`assert 'final_message' in locals(), 'final_message is missing'`, `assert 'PASS' in str(final_message), 'final_message must include PASS'`],
        dependsOn: [`${prefix}_e10`],
        difficultyTag: 'challenge',
      },
    ];
  }

  if (bp.stage <= 4) {
    return [
      { id: `${prefix}_e1`, type: 'markdown', content: '### Step 1: Inspect dataset\nPrint shape and preview rows.' },
      { id: `${prefix}_e2`, type: 'code', label: 'Step 1 - Inspect', prompt: 'Print df shape and head.', requiresFill: true, placeholders: ['____'], checkAlias: 'step_1.check()', starterCode: `print(____)\nprint(df.head())\n\nstep_1.check()`, content: `print(____)\nprint(df.head())\n\nstep_1.check()`, referenceSolution: `print(df.shape)`, checkpointTests: [`assert 'df' in locals(), 'df missing'`, `assert len(df) > 0, 'dataset empty'`], difficultyTag: 'warmup' },
      { id: `${prefix}_e3`, type: 'markdown', content: '### Step 2: DataFrame operations\nApply cleaning/filtering operation.' },
      { id: `${prefix}_e4`, type: 'code', label: 'Step 2 - Operate', prompt: 'Create work_df with one core operation.', requiresFill: true, placeholders: ['____'], checkAlias: 'step_2.check()', starterCode: `work_df = df.copy()\nwork_df = ____\nprint(work_df.shape)\n\nstep_2.check()`, content: `work_df = df.copy()\nwork_df = ____\nprint(work_df.shape)\n\nstep_2.check()`, referenceSolution: `work_df = work_df.drop_duplicates().reset_index(drop=True)`, checkpointTests: [`assert 'work_df' in locals(), 'work_df missing'`], dependsOn: [`${prefix}_e2`], difficultyTag: 'warmup' },
      { id: `${prefix}_e5`, type: 'markdown', content: '### Step 3: Column profile\nCreate numeric column list.' },
      { id: `${prefix}_e6`, type: 'code', label: 'Step 3 - Profile', prompt: 'Find numeric columns.', requiresFill: true, placeholders: ['____'], checkAlias: 'step_3.check()', starterCode: `num_cols = ____\nprint(num_cols[:8])\n\nstep_3.check()`, content: `num_cols = ____\nprint(num_cols[:8])\n\nstep_3.check()`, referenceSolution: `num_cols = work_df.select_dtypes(include='number').columns.tolist()`, checkpointTests: [`assert 'num_cols' in locals(), 'num_cols missing'`], dependsOn: [`${prefix}_e4`], difficultyTag: 'core' },
      { id: `${prefix}_e7`, type: 'markdown', content: '### Step 4: Missing values\nCreate cleaned dataframe.' },
      { id: `${prefix}_e8`, type: 'code', label: 'Step 4 - Missing', prompt: 'Drop missing values.', requiresFill: true, placeholders: ['____'], checkAlias: 'step_4.check()', starterCode: `clean_df = ____\nprint(clean_df.shape)\n\nstep_4.check()`, content: `clean_df = ____\nprint(clean_df.shape)\n\nstep_4.check()`, referenceSolution: `clean_df = work_df.dropna().reset_index(drop=True)`, checkpointTests: [`assert 'clean_df' in locals(), 'clean_df missing'`], dependsOn: [`${prefix}_e6`], difficultyTag: 'core' },
      { id: `${prefix}_e9`, type: 'markdown', content: '### Step 5: Summary\nGenerate describe table.' },
      { id: `${prefix}_e10`, type: 'code', label: 'Step 5 - Summary', prompt: 'Create summary_df.', requiresFill: true, placeholders: ['____'], checkAlias: 'step_5.check()', starterCode: `summary_df = ____\nprint(summary_df.head())\n\nstep_5.check()`, content: `summary_df = ____\nprint(summary_df.head())\n\nstep_5.check()`, referenceSolution: `summary_df = clean_df.describe(include='all')`, checkpointTests: [`assert 'summary_df' in locals(), 'summary_df missing'`], dependsOn: [`${prefix}_e8`], difficultyTag: 'challenge' },
      { id: `${prefix}_e11`, type: 'markdown', content: '### Step 6: Plot\nUse matplotlib and finish with PASS.' },
      { id: `${prefix}_e12`, type: 'code', label: 'Step 6 - Plot', prompt: 'Draw one chart and set final_message.', requiresFill: true, placeholders: ['____'], checkAlias: 'step_6.check()', starterCode: `import matplotlib.pyplot as plt\nnum_cols = clean_df.select_dtypes(include='number').columns.tolist()\nif len(num_cols) > 0:\n    ____\nplt.tight_layout()\nfinal_message = 'PASS: data foundation complete'\nprint(final_message)\n\nstep_6.check()`, content: `import matplotlib.pyplot as plt\nnum_cols = clean_df.select_dtypes(include='number').columns.tolist()\nif len(num_cols) > 0:\n    ____\nplt.tight_layout()\nfinal_message = 'PASS: data foundation complete'\nprint(final_message)\n\nstep_6.check()`, referenceSolution: `clean_df[num_cols[0]].hist(bins=20)`, checkpointTests: [`assert 'final_message' in locals(), 'final_message missing'`, `assert 'PASS' in str(final_message), 'must include PASS'`], dependsOn: [`${prefix}_e10`], difficultyTag: 'challenge' },
    ];
  }

  return [
    { id: `${prefix}_e1`, type: 'markdown', content: '### Step 1: Dataset inspection\nPrint dataset shape and columns.' },
    {
      id: `${prefix}_e2`,
      type: 'code',
      label: 'Step 1 - Inspect',
      starterCode: `print(df.shape)\nprint(df.columns.tolist())`,
      content: `print(df.shape)\nprint(df.columns.tolist())`,
      checkpointTests: [`assert 'df' in locals(), 'df is missing'`, `assert len(df) > 0, 'dataset is empty'`],
      expectedPatterns: ['df.shape', 'df.columns'],
      difficultyTag: 'warmup',
    },
    { id: `${prefix}_e3`, type: 'markdown', content: `### Step 2: Clean target\nDrop rows where ${bp.targetCol} is missing and create clean_df.` },
    {
      id: `${prefix}_e4`,
      type: 'code',
      label: 'Step 2 - Clean',
      starterCode: `clean_df = df.dropna(subset=['${bp.targetCol}'])\nprint(clean_df.shape)`,
      content: `clean_df = df.dropna(subset=['${bp.targetCol}'])\nprint(clean_df.shape)`,
      checkpointTests: [`assert 'clean_df' in locals(), 'clean_df is missing'`, `assert '${bp.targetCol}' in clean_df.columns, 'target column missing'`],
      dependsOn: [`${prefix}_e2`],
      difficultyTag: 'warmup',
    },
    { id: `${prefix}_e5`, type: 'markdown', content: `### Step 3: Feature matrix\nBuild features and X with: ${bp.focusCols.join(', ')}.` },
    {
      id: `${prefix}_e6`,
      type: 'code',
      label: 'Step 3 - Features',
      starterCode: `features = ${JSON.stringify(bp.focusCols)}\nX = clean_df[features]\nprint(X.head())`,
      content: `features = ${JSON.stringify(bp.focusCols)}\nX = clean_df[features]\nprint(X.head())`,
      checkpointTests: [`assert 'X' in locals(), 'X is missing'`, `assert 'features' in locals() and len(features) >= 3, 'need at least 3 features'`],
      dependsOn: [`${prefix}_e4`],
      difficultyTag: 'core',
    },
    { id: `${prefix}_e7`, type: 'markdown', content: `### Step 4: Train model\nTrain ${bp.modelName}.` },
    {
      id: `${prefix}_e8`,
      type: 'code',
      label: 'Step 4 - Train',
      starterCode: `from sklearn.model_selection import train_test_split\n${bp.modelImport}\n\ny = clean_df['${bp.targetCol}']\ntrain_X, val_X, train_y, val_y = train_test_split(X, y, random_state=42)\nmodel = ${bp.modelName}\nmodel.fit(train_X, train_y)\nprint('trained')`,
      content: `from sklearn.model_selection import train_test_split\n${bp.modelImport}\n\ny = clean_df['${bp.targetCol}']\ntrain_X, val_X, train_y, val_y = train_test_split(X, y, random_state=42)\nmodel = ${bp.modelName}\nmodel.fit(train_X, train_y)\nprint('trained')`,
      checkpointTests: [`assert 'model' in locals(), 'model is missing'`, `assert 'train_X' in locals() and len(train_X) > 0, 'train set is empty'`],
      dependsOn: [`${prefix}_e6`],
      difficultyTag: 'core',
    },
    { id: `${prefix}_e9`, type: 'markdown', content: '### Step 5: Evaluate\nCompute MAE as mae.' },
    {
      id: `${prefix}_e10`,
      type: 'code',
      label: 'Step 5 - Evaluate',
      starterCode: `from sklearn.metrics import mean_absolute_error\npreds = model.predict(val_X)\nmae = mean_absolute_error(val_y, preds)\nprint('MAE=', round(mae, 4))`,
      content: `from sklearn.metrics import mean_absolute_error\npreds = model.predict(val_X)\nmae = mean_absolute_error(val_y, preds)\nprint('MAE=', round(mae, 4))`,
      checkpointTests: [`assert 'mae' in locals(), 'mae is missing'`, `assert mae >= 0, 'mae must be non-negative'`],
      dependsOn: [`${prefix}_e8`],
      difficultyTag: 'challenge',
    },
    { id: `${prefix}_e11`, type: 'markdown', content: '### Step 6: Final submit\nCreate final_message and include PASS.' },
    {
      id: `${prefix}_e12`,
      type: 'code',
      label: 'Step 6 - Final Check',
      starterCode: `final_message = 'PASS: lesson complete'\nprint(final_message)`,
      content: `final_message = 'PASS: lesson complete'\nprint(final_message)`,
      checkpointTests: [`assert 'final_message' in locals(), 'final_message is missing'`, `assert 'PASS' in str(final_message), 'must include PASS keyword'`],
      dependsOn: [`${prefix}_e10`],
      difficultyTag: 'challenge',
    },
  ];
}

function makeCheckpoints(prefix: string): LabCheckpoint[] {
  return [
    { id: `${prefix}_cp1`, title: 'Step 1 checkpoint', tests: [`assert True`], hint: 'Complete step 1 code.', blocking: true },
    { id: `${prefix}_cp2`, title: 'Step 2 checkpoint', tests: [`assert True`], hint: 'Complete step 2 code.', blocking: true },
    { id: `${prefix}_cp3`, title: 'Step 3 checkpoint', tests: [`assert True`], hint: 'Complete step 3 code.', blocking: true },
    { id: `${prefix}_cp4`, title: 'Step 4 checkpoint', tests: [`assert True`], hint: 'Complete step 4 code.', blocking: true },
    { id: `${prefix}_cp5`, title: 'Step 5 checkpoint', tests: [`assert True`], hint: 'Complete step 5 code.', blocking: false },
    { id: `${prefix}_cp6`, title: 'Step 6 checkpoint', tests: [`assert True`], hint: 'Complete step 6 code.', blocking: false },
  ];
}

function makeQuiz(bp: LessonBlueprint): QuizQuestion[] {
  if (bp.stage <= 4) {
    return [
      { id: `${bp.stage}_q1`, kind: 'single', question: 'Which pandas function is used to read CSV files?', options: ['pd.read_csv', 'pd.read_excel', 'pd.DataFrame', 'pd.concat'], correctIndex: 0, explanation: 'CSV files are loaded with pd.read_csv.' },
      { id: `${bp.stage}_q2`, kind: 'single', question: 'What does the first value of df.shape represent?', options: ['Number of rows', 'Number of columns', 'Missing count', 'Data type count'], correctIndex: 0, explanation: 'The first value of df.shape is row count.' },
      { id: `${bp.stage}_q3`, kind: 'single', question: 'What does drop_duplicates() do?', options: ['Removes duplicate rows', 'Drops missing values only', 'Sorts rows', 'Renames columns'], correctIndex: 0, explanation: 'drop_duplicates removes repeated rows based on all columns by default.' },
      { id: `${bp.stage}_q4`, kind: 'single', question: 'Which library is used here for plotting?', options: ['matplotlib', 'seaborn only', 'plotly only', 'statsmodels'], correctIndex: 0, explanation: 'The lesson uses matplotlib.pyplot for beginner plotting.' },
      { id: `${bp.stage}_q5`, kind: 'single', question: 'Which function reads Excel files?', options: ['pd.read_excel', 'pd.read_csv', 'pd.to_excel', 'pd.ExcelWriter'], correctIndex: 0, explanation: 'Excel files are loaded with pd.read_excel.' },
      { id: `${bp.stage}_q6`, kind: 'single', question: 'Which command previews the first 5 rows of a DataFrame?', options: ['df.head()', 'df.tail()', 'df.info()', 'df.describe()'], correctIndex: 0, explanation: 'df.head() is the standard quick preview command.' },
      { id: `${bp.stage}_q7`, kind: 'single', question: 'Which method removes duplicate rows?', options: ['drop_duplicates()', 'dropna()', 'duplicated()', 'unique()'], correctIndex: 0, explanation: 'drop_duplicates() removes repeated rows.' },
      { id: `${bp.stage}_q8`, kind: 'single', question: 'Which property gives DataFrame column names?', options: ['df.columns', 'df.shape', 'df.values', 'df.index.name'], correctIndex: 0, explanation: 'df.columns returns the column index.' },
      { id: `${bp.stage}_q9`, kind: 'single', question: 'Which matplotlib call is valid for a scatter plot?', options: ['plt.scatter(x, y)', 'plt.hist(x, y)', 'plt.barh(x, y, z)', 'plt.plot() with no args only'], correctIndex: 0, explanation: 'plt.scatter(x, y) creates a scatter chart.' },
      { id: `${bp.stage}_q10`, kind: 'single', question: 'Which method returns summary statistics?', options: ['describe()', 'info()', 'head()', 'value_counts()'], correctIndex: 0, explanation: 'describe() returns summary statistics for columns.' },
    ];
  }

  return [
    { id: `${bp.stage}_q1`, kind: 'single', question: 'What is the main purpose of train_test_split?', options: ['Create train/validation sets', 'Scale numeric data', 'Encode categories', 'Drop missing rows'], correctIndex: 0, explanation: 'train_test_split separates data for training and evaluation.' },
    { id: `${bp.stage}_q2`, kind: 'single', question: 'What does MAE stand for?', options: ['Mean Absolute Error', 'Model Accuracy Error', 'Maximum Absolute Estimate', 'Mean Average Evaluation'], correctIndex: 0, explanation: 'MAE stands for Mean Absolute Error.' },
    { id: `${bp.stage}_q3`, kind: 'single', question: 'Which method trains the model?', options: ['fit', 'predict', 'score', 'transform'], correctIndex: 0, explanation: 'fit() is used to train a model on training data.' },
    { id: `${bp.stage}_q4`, kind: 'single', question: 'What does overfitting usually mean?', options: ['Great train score, poor validation score', 'Poor train and validation score', 'Data has duplicates', 'Columns are not numeric'], correctIndex: 0, explanation: 'Overfitting means the model memorizes training data and generalizes poorly.' },
    { id: `${bp.stage}_q5`, kind: 'single', question: 'Which method generates predictions?', options: ['predict', 'fit', 'split', 'transform'], correctIndex: 0, explanation: 'predict() generates predictions for new features.' },
    { id: `${bp.stage}_q6`, kind: 'single', question: 'Which metric is used in this regression path?', options: ['MAE', 'AUC', 'F1', 'LogLoss'], correctIndex: 0, explanation: 'The course uses Mean Absolute Error (MAE).' },
    { id: `${bp.stage}_q7`, kind: 'single', question: 'train_test_split belongs to which module?', options: ['sklearn.model_selection', 'sklearn.metrics', 'sklearn.preprocessing', 'numpy.random'], correctIndex: 0, explanation: 'train_test_split comes from sklearn.model_selection.' },
    { id: `${bp.stage}_q8`, kind: 'single', question: 'Which set should be used for final quick validation in lessons?', options: ['Validation set', 'Training set only', 'Random mixed rows after training', 'Any set is identical'], correctIndex: 0, explanation: 'Validation set estimates generalization performance.' },
    { id: `${bp.stage}_q9`, kind: 'single', question: 'If train score is high but validation score is poor, this is usually:', options: ['Overfitting', 'Underfitting', 'Perfect fit', 'Data leakage-proofing'], correctIndex: 0, explanation: 'That pattern indicates overfitting.' },
    { id: `${bp.stage}_q10`, kind: 'single', question: 'Which call starts model training with features and labels?', options: ['model.fit(X_train, y_train)', 'model.predict(X_train)', 'model.score(X_train)', 'model.transform(X_train)'], correctIndex: 0, explanation: 'fit() trains the model on training data.' },
  ];
}

function makeCourse(bp: LessonBlueprint): LabCourse {
  const id = `lesson_${bp.stage}`;
  const phase: LessonPhase = bp.stage <= 4 ? 'data-foundation' : 'modeling';
  const foundation = phase === 'data-foundation';

  const practiceTests = foundation
    ? [
        `assert 'df' in locals(), 'df missing'`,
        `assert 'final_message' in locals(), 'final_message missing'`,
        `assert 'PASS' in str(final_message), 'final_message must include PASS'`,
      ]
    : [
        `assert 'X' in locals(), 'X missing'`,
        `assert 'model' in locals(), 'model missing'`,
        `assert 'mae' in locals() and mae >= 0, 'valid mae missing'`,
        `assert 'final_message' in locals(), 'final_message missing'`,
      ];

  return {
    id,
    stage: bp.stage,
    chapter: `Lesson ${bp.stage}`,
    title: bp.title,
    objective: bp.objective,
    prerequisites: bp.prerequisites,
    skills: bp.skills,
    recommendedDataset: bp.recommendedDataset,
    difficulty: bp.difficulty,
    duration: bp.duration,
    tags: bp.tags,
    phase,
    bootstrapCode: COMMON_BOOTSTRAP,
    tutorialCells: makeTutorialCells(id, bp),
    exerciseCells: makeExerciseCells(id, bp),
    exerciseCheckpoints: makeCheckpoints(id),
    completionCriteria: {
      minPassedCheckpoints: 5,
      requireFinalTestPass: true,
      requiredVariables: foundation ? ['df', 'final_message'] : ['df', 'X', 'model', 'mae', 'final_message'],
    },
    practice: {
      id: `${id}_practice`,
      title: `${bp.title} integrated exercise`,
      description: 'Pass at least 5 checkpoints and all final tests.',
      targetMetrics: 'checkpoint pass >= 5 and final tests all pass',
      tests: practiceTests,
      hints: ['Run each step in order, then run final check.'],
    },
    quiz: makeQuiz(bp),
    points: 80 + bp.stage * 20,
    badgeId: `badge_${bp.stage}`,
  };
}

const BLUEPRINTS: LessonBlueprint[] = [
    { stage: 1, title: 'Python Basics for Data Labs', objective: '????????CSV/Excel ???read_csv/read_excel??DataFrame ?????shape/columns/info???????cleaning?? matplotlib ?????first plot??', prerequisites: ['None'], skills: ['read_csv', 'read_excel', 'DataFrame basics', 'matplotlib basics'], recommendedDataset: 'housing', difficulty: 'Beginner', duration: '20 min', tags: ['Python', 'Data I/O', 'DataFrame', 'Matplotlib'], focusCols: ['Rooms', 'Bathroom', 'Landsize'], targetCol: 'Price', modelImport: '', modelName: '' },
    { stage: 2, title: 'DataFrame Core Operations', objective: 'Practice filtering, sorting, missing-value handling, type conversion, and rename operations.', prerequisites: ['Lesson 1'], skills: ['filtering', 'sorting', 'dropna/fillna', 'astype', 'rename'], recommendedDataset: 'housing', difficulty: 'Beginner', duration: '22 min', tags: ['Pandas', 'DataFrame'], focusCols: ['Rooms', 'Bathroom', 'Car'], targetCol: 'Price', modelImport: '', modelName: '' },
    { stage: 3, title: 'Data Cleaning Practice', objective: 'Handle duplicates, simple outliers, string cleanup, and date columns step by step.', prerequisites: ['Lesson 2'], skills: ['drop_duplicates', 'string cleaning', 'datetime parsing', 'outlier basics'], recommendedDataset: 'housing', difficulty: 'Beginner', duration: '24 min', tags: ['Cleaning'], focusCols: ['Rooms', 'Bedroom2', 'Landsize'], targetCol: 'Price', modelImport: '', modelName: '' },
    { stage: 4, title: 'Visualization Foundations', objective: 'Create line/bar/scatter/hist charts and explain them in simple business language.', prerequisites: ['Lesson 3'], skills: ['line plot', 'bar plot', 'scatter plot', 'histogram'], recommendedDataset: 'housing', difficulty: 'Beginner', duration: '24 min', tags: ['Visualization', 'Matplotlib'], focusCols: ['Rooms', 'Distance', 'Landsize'], targetCol: 'Price', modelImport: '', modelName: '' },
  { stage: 5, title: 'First Model: Regression Starter', objective: 'Start modeling with train_test_split, fit/predict, and MAE evaluation.', prerequisites: ['Lesson 4'], skills: ['train_test_split', 'fit', 'predict', 'MAE'], recommendedDataset: 'housing', difficulty: 'Beginner', duration: '25 min', tags: ['Modeling'], focusCols: ['Rooms', 'Bathroom', 'Landsize', 'Distance'], targetCol: 'Price', modelImport: `from sklearn.tree import DecisionTreeRegressor`, modelName: 'DecisionTreeRegressor(random_state=42)' },
  { stage: 6, title: 'Validation and Tuning Basics', objective: 'Understand validation split, overfitting intuition, and basic parameter comparison.', prerequisites: ['Lesson 5'], skills: ['validation', 'overfitting intuition', 'parameter comparison'], recommendedDataset: 'housing', difficulty: 'Beginner', duration: '24 min', tags: ['Validation', 'Tuning'], focusCols: ['Rooms', 'Bathroom', 'Landsize', 'Car'], targetCol: 'Price', modelImport: `from sklearn.tree import DecisionTreeRegressor`, modelName: 'DecisionTreeRegressor(random_state=42)' },
  { stage: 7, title: 'Underfitting vs Overfitting', objective: 'Tune model complexity and reason about generalization.', prerequisites: ['Lesson 6'], skills: ['max_leaf_nodes', 'generalization'], recommendedDataset: 'housing', difficulty: 'Intermediate', duration: '24 min', tags: ['Bias-Variance'], focusCols: ['Rooms', 'Bathroom', 'Landsize', 'Distance', 'Car'], targetCol: 'Price', modelImport: `from sklearn.tree import DecisionTreeRegressor`, modelName: 'DecisionTreeRegressor(max_leaf_nodes=100, random_state=42)' },
  { stage: 8, title: 'Random Forest Regression', objective: 'Improve robustness using ensemble learning.', prerequisites: ['Lesson 7'], skills: ['RandomForestRegressor', 'ensemble methods'], recommendedDataset: 'housing', difficulty: 'Intermediate', duration: '24 min', tags: ['RandomForest'], focusCols: ['Rooms', 'Bathroom', 'Landsize', 'Distance', 'Car'], targetCol: 'Price', modelImport: `from sklearn.ensemble import RandomForestRegressor`, modelName: 'RandomForestRegressor(n_estimators=120, random_state=42)' },
  { stage: 9, title: 'Feature Engineering Intro', objective: 'Design and compare engineered features.', prerequisites: ['Lesson 8'], skills: ['feature construction', 'feature comparison'], recommendedDataset: 'housing', difficulty: 'Intermediate', duration: '26 min', tags: ['FeatureEng'], focusCols: ['Rooms', 'Bathroom', 'Landsize', 'Distance'], targetCol: 'Price', modelImport: `from sklearn.ensemble import RandomForestRegressor`, modelName: 'RandomForestRegressor(n_estimators=150, random_state=42)' },
  { stage: 10, title: 'Cross Validation', objective: 'Use cross_val_score for more stable model assessment.', prerequisites: ['Lesson 9'], skills: ['KFold', 'cross_val_score'], recommendedDataset: 'housing', difficulty: 'Intermediate', duration: '28 min', tags: ['CV'], focusCols: ['Rooms', 'Bathroom', 'Landsize', 'Car', 'Distance'], targetCol: 'Price', modelImport: `from sklearn.ensemble import RandomForestRegressor`, modelName: 'RandomForestRegressor(n_estimators=120, random_state=42)' },
  { stage: 11, title: 'Pipeline Workflow', objective: 'Encapsulate preprocessing and training into reusable pipelines.', prerequisites: ['Lesson 10'], skills: ['Pipeline', 'reusability'], recommendedDataset: 'housing', difficulty: 'Intermediate', duration: '28 min', tags: ['Pipeline'], focusCols: ['Rooms', 'Bathroom', 'Landsize', 'Distance'], targetCol: 'Price', modelImport: `from sklearn.ensemble import RandomForestRegressor`, modelName: 'RandomForestRegressor(n_estimators=100, random_state=42)' },
  { stage: 12, title: 'Classification Intro', objective: 'Transfer workflow from regression to classification-style tasks.', prerequisites: ['Lesson 11'], skills: ['labels', 'accuracy thinking'], recommendedDataset: 'employee', difficulty: 'Intermediate', duration: '30 min', tags: ['Classification'], focusCols: ['Age', 'WorkLifeBalance', 'PerformanceRating'], targetCol: 'JobSatisfaction', modelImport: `from sklearn.ensemble import RandomForestRegressor`, modelName: 'RandomForestRegressor(n_estimators=80, random_state=42)' },
  { stage: 13, title: 'Time Series Foundations', objective: 'Practice temporal features and rolling-window intuition.', prerequisites: ['Lesson 12'], skills: ['time indexing', 'rolling stats'], recommendedDataset: 'finance', difficulty: 'Intermediate', duration: '30 min', tags: ['TimeSeries'], focusCols: ['Open', 'High', 'Low'], targetCol: 'Close', modelImport: `from sklearn.ensemble import RandomForestRegressor`, modelName: 'RandomForestRegressor(n_estimators=90, random_state=42)' },
  { stage: 14, title: 'Anomaly Detection Basics', objective: 'Detect unusual behavior with threshold-driven workflows.', prerequisites: ['Lesson 13'], skills: ['outlier reasoning', 'threshold checks'], recommendedDataset: 'manufacturing', difficulty: 'Intermediate', duration: '30 min', tags: ['Anomaly'], focusCols: ['Temperature', 'Pressure', 'Vibration'], targetCol: 'DefectRate', modelImport: `from sklearn.tree import DecisionTreeRegressor`, modelName: 'DecisionTreeRegressor(max_depth=6, random_state=42)' },
  { stage: 15, title: 'Model Interpretability', objective: 'Explain which features drive model behavior.', prerequisites: ['Lesson 14'], skills: ['feature importance', 'business interpretation'], recommendedDataset: 'housing', difficulty: 'Intermediate', duration: '28 min', tags: ['Interpretability'], focusCols: ['Rooms', 'Bathroom', 'Distance', 'Landsize', 'Car'], targetCol: 'Price', modelImport: `from sklearn.ensemble import RandomForestRegressor`, modelName: 'RandomForestRegressor(n_estimators=150, random_state=42)' },
  { stage: 16, title: 'Project: Home Price Estimation', objective: 'Run a full end-to-end workflow from checks to delivery.', prerequisites: ['Lesson 15'], skills: ['end-to-end project', 'delivery mindset'], recommendedDataset: 'housing', difficulty: 'Practical', duration: '35 min', tags: ['Project'], focusCols: ['Rooms', 'Bathroom', 'Distance', 'Landsize', 'Car'], targetCol: 'Price', modelImport: `from sklearn.ensemble import RandomForestRegressor`, modelName: 'RandomForestRegressor(n_estimators=200, random_state=42)' },
  { stage: 17, title: 'Error Analysis and Review', objective: 'Review residuals and produce actionable improvement ideas.', prerequisites: ['Lesson 16'], skills: ['error slicing', 'improvement strategy'], recommendedDataset: 'housing', difficulty: 'Practical', duration: '30 min', tags: ['Review'], focusCols: ['Rooms', 'Bathroom', 'Distance', 'Landsize', 'Car'], targetCol: 'Price', modelImport: `from sklearn.ensemble import RandomForestRegressor`, modelName: 'RandomForestRegressor(n_estimators=180, random_state=42)' },
  { stage: 18, title: 'Capstone Challenge', objective: 'Solve a final challenge independently and pass all checkpoints.', prerequisites: ['Lesson 17'], skills: ['independent modeling', 'quality gates'], recommendedDataset: 'advertising', difficulty: 'Practical', duration: '40 min', tags: ['Capstone'], focusCols: ['TV', 'Radio', 'Newspaper'], targetCol: 'Sales', modelImport: `from sklearn.ensemble import RandomForestRegressor`, modelName: 'RandomForestRegressor(n_estimators=200, random_state=42)' },
];

export const LAB_COURSES: LabCourse[] = BLUEPRINTS.map(makeCourse);





















