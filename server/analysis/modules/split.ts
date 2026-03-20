import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";

const spec: AlgorithmSpec = {
  id: "ml.split",
  name: "Train/Test 切分",
  category: "ml",
  subcategory: "prep",
  description: "按比例或k-fold 划分数据",
  explanation: "就像学校里的模拟考。我们把一部分数据拿去让模型学习（训练集），剩下的藏起来等会儿考它（测试集），这样就能知道它到底学会了没有。",
  inputSpec: [
    { id: "features", label: "任意特征", acceptedTypes: ["numeric", "categorical"], min: 1 }
  ],
  paramSchema: [
    { key: "testSize", label: "测试比例", type: "number", default: 0.2, min: 0.1, max: 0.5 },
    { key: "k", label: "K 折数量 (可选)", type: "number", default: 0, min: 0, max: 10, step: 1 }
  ],
  citation: "Hastie, Tibshirani, Friedman (2009)."
};

async function run({ dataset, params }: any): Promise<AnalysisResult> {
  const testSize = Number(params.testSize || 0.2);
  const k = Number(params.k || 0);
  const n = dataset.length;
  const testN = Math.floor(n * testSize);
  const trainN = n - testN;
  const folds = k > 1 ? Array.from({ length: k }, (_, i) => `${i + 1} / ${k}`) : [];
  return {
    tables: [
      { title: "切分结果", columns: ["集合", "样本数"], rows: [["训练集", trainN], ["测试集", testN]] },
      { title: "K-fold", columns: ["折"], rows: folds.map((f) => [f]) }
    ],
    figures: [],
    assumptions: ["样本独立同分布"],
    warnings: [],
    narrative: `按 ${testSize * 100}% 划分测试集${k > 1 ? `，并提供 ${k} 折交叉验证框架` : ""}。`,
    citation: spec.citation
  };
}

export default { spec, run };
