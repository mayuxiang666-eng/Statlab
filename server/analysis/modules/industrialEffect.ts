import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { callPythonML } from "../pythonBridge";

const spec: AlgorithmSpec = {
  id: "ml.industrialEffect",
  name: "工业多参数影响分析",
  category: "ml",
  subcategory: "diagnosis",
  description: "针对工艺/设备参数的条件化非线性影响诊断，自动定位阈值、交互与区间建议。(Python sklearn)",
  explanation: "结合树模型、条件相关、分段阈值与PDP/ICE，输出可解释的工况区间与操作建议，适用于良率、能耗、质量分等工业指标。使用 Python sklearn + SHAP 实现真正的高性能计算。",
  inputSpec: [
    { id: "target", label: "目标(连续值)", acceptedTypes: ["numeric"], min: 1, max: 1 },
    { id: "features", label: "工艺/设备参数", acceptedTypes: ["numeric", "categorical"], min: 1 }
  ],
  paramSchema: [
    {
      key: "targetDirection", label: "目标方向", type: "select", options: [
        { label: "越高越好（如良率、强度）", value: "higher" },
        { label: "越低越好（如能耗、缺陷率）", value: "lower" }
      ], default: "higher"
    },
    { key: "testSize", label: "验证集比例", type: "number", default: 0.2, min: 0.1, max: 0.4, step: 0.05 },
    { key: "trees", label: "随机森林树数量", type: "number", default: 100, min: 20, max: 500, step: 20 },
    {
      key: "scale", label: "特征缩放", type: "select", options: [
        { label: "Z-Score", value: "standard" },
        { label: "0-1", value: "minmax" },
        { label: "不缩放", value: "none" }
      ], default: "standard"
    },
    {
      key: "impute", label: "缺失填补", type: "select", options: [
        { label: "均值", value: "mean" },
        { label: "中位数", value: "median" },
        { label: "补零", value: "zero" }
      ], default: "mean"
    },
    { key: "oneHot", label: "自动独热编码", type: "boolean", default: true },
    { key: "topK", label: "重点特征个数", type: "number", default: 5, min: 3, max: 10, step: 1 },
    { key: "ruleDepth", label: "联合规则树深度", type: "number", default: 3, min: 2, max: 5, step: 1 },
    { key: "minRuleSupport", label: "最小规则支持度", type: "number", default: 0.05, min: 0.01, max: 0.2, step: 0.01 },
    { key: "customFeatureExpressions", label: "自定义衍生列公式 (如: A/B, A+B)", type: "string", default: "", placeholder: "输入特征公式，每行一个，如: Width / Height" }
  ],
  citation: "基于解释性树模型与部分依赖分析的工业工况诊断流程"
};

async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
  // Map targetDirection param to higherBetter boolean for Python service
  const pythonParams = {
    ...params,
    higherBetter: params.targetDirection !== "lower"
  };
  return callPythonML("ml.industrialEffect", dataset, variables, pythonParams, onLog);
}

export default { spec, run };
