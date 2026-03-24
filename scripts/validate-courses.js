const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../client/src/CourseData.ts');
const content = fs.readFileSync(file, 'utf8');

const stageCount = (content.match(/stage:\s*\d+/g) || []).length;
const checkpointFactory = /function\s+makeCheckpoints\s*\(/.test(content);
const exerciseFactory = /function\s+makeExerciseCells\s*\(/.test(content);
const tutorialFactory = /function\s+makeTutorialCells\s*\(/.test(content);

if (stageCount < 18) {
  console.error(`Course stage count too low: ${stageCount} (expected >= 18)`);
  process.exit(1);
}
if (!checkpointFactory || !exerciseFactory || !tutorialFactory) {
  console.error('Missing required course factories (tutorial/exercise/checkpoints).');
  process.exit(1);
}

const requiredTokens = [
  'exerciseCheckpoints',
  'completionCriteria',
  'bootstrapCode',
  'checkpointTests',
  'starterCode',
  'requiresFill',
  'checkAlias',
  'referenceSolution',
  "phase: LessonPhase",
  'buildTutorialRunnableCode',
];

for (const token of requiredTokens) {
  if (!content.includes(token)) {
    console.error(`Missing required token in CourseData.ts: ${token}`);
    process.exit(1);
  }
}

const stepCheckMentions = (content.match(/step_\d+\.check\(\)/g) || []).length;
const fillBlankMentions = (content.match(/____/g) || []).length;

if (stepCheckMentions < 6) {
  console.error(`Not enough step check aliases found: ${stepCheckMentions} (expected >= 6)`);
  process.exit(1);
}
if (fillBlankMentions < 10) {
  console.error(`Not enough fill-in placeholders found: ${fillBlankMentions} (expected >= 10)`);
  process.exit(1);
}

const noModelStageLines = [1, 2, 3, 4].map((n) => {
  const m = content.match(new RegExp(String.raw`\{\s*stage:\s*${n},[^\n]*`));
  return m ? m[0] : '';
});

if (noModelStageLines.some((x) => !x)) {
  console.error('Unable to locate one or more stage lines for 1-4.');
  process.exit(1);
}

const forbiddenModelTokens = ['fit', 'predict', 'train_test_split', 'RandomForest', 'DecisionTree'];
for (const [idx, line] of noModelStageLines.entries()) {
  for (const token of forbiddenModelTokens) {
    if (line.includes(token)) {
      console.error(`Forbidden modeling token "${token}" found in stage ${idx + 1} blueprint.`);
      process.exit(1);
    }
  }
}

const lesson1MustHave = ['read_csv', 'read_excel', 'DataFrame', 'matplotlib'];
for (const token of lesson1MustHave) {
  if (!content.includes(token)) {
    console.error(`Lesson 1 required token missing: ${token}`);
    process.exit(1);
  }
}

console.log('Course validation passed.');
console.log(`- stages: ${stageCount}`);
console.log('- factories: tutorial/exercise/checkpoints present');
console.log('- phase + fill-in + tutorial alignment tokens: present');
console.log('- L1-L4 modeling guard: passed');
console.log('- L1 required topics: read_csv/read_excel/DataFrame/matplotlib present');
console.log(`- step checks: ${stepCheckMentions}`);
console.log(`- fill placeholders: ${fillBlankMentions}`);
