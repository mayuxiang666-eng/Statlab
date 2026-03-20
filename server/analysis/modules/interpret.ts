import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";

const spec: AlgorithmSpec = {
  id: "ml.interpret",
  name: "模型可解释性",
  category: "ml",
  subcategory: "interpret",
  description: "线性/逻辑回归系数 + 树模型重要度 (占位)",
  explanation: "所谓的“黑盒算法”往往不讲武德只给结果不给原因。但这个解释器算法专门用来「拆解黑盒」，它会给你列出一份详细的话术，告诉你为啥刚才它做出了这样的预测。",
  inputSpec: [
    { id: "weights", label: "权重JSON", acceptedTypes: ["numeric", "categorical"], min: 0 }
  ],
  paramSchema: [
    {
      key: "model", label: "模型类型", type: "select", default: "linear", options: [
        { label: "线性/逻辑回归", value: "linear" },
        { label: "树模型", value: "tree" }
      ]
    }
  ],
  citation: "Molnar, C. (2022). Interpretable ML"
};

async function run({ params }: any): Promise<AnalysisResult> {
  const model = params.model || "linear";
  return {
    tables: [
      {
        title: "解读模板",
        columns: ["提示"],
        rows: model === "linear"
          ? [["系数为正表示与目标正向关系，量纲依赖标准化；请结合置信区间与共线性检查。"]]
          : [["特征重要度越高，说明在树分裂中贡献越大；注意存在偏向高基数特征的风险。"]]
      }
    ],
    figures: [],
    assumptions: ["解读需结合领域知识"],
    warnings: [],
    narrative: "可解释性输出为说明性文本，不代表因果，仅用于模型诊断与沟通。",
    citation: spec.citation
  };
}

export default { spec, run };
