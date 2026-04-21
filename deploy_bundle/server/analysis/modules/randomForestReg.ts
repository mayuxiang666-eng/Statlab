import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { callPythonML } from "../pythonBridge";

const spec: AlgorithmSpec = {
  id: "ml.randomForestReg",
  name: "随机森林回归",
  category: "ml",
  subcategory: "regression",
  description: "集成树模型回归 + 特征重要度 + 象限图 (Python sklearn)",
  explanation: "随机森林回归通过集成多棵决策树，提升回归预测的准确性和鲁棒性，并能输出 SHAP 特征重要度排名。适合处理非线性和高维特征。",
  inputSpec: [
    { id: "target", label: "目标(数值)", acceptedTypes: ["numeric"], min: 1, max: 1 },
    { id: "features", label: "特征", acceptedTypes: ["numeric", "categorical"], min: 1 }
  ],
  paramSchema: [
    { key: "trees", label: "树数量", type: "number", default: 100, min: 10, max: 500, step: 10 },
    { key: "testSize", label: "测试集比例", type: "number", default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
    { key: "cv", label: "交叉验证折数 (0=关闭)", type: "number", default: 0, min: 0, max: 10, step: 1 },
    { key: "scale", label: "特征缩放", type: "select", options: [{ label: "标准化", value: "standard" }, { label: "归一化", value: "minmax" }, { label: "不缩放", value: "none" }], default: "standard" },
    { key: "impute", label: "缺失值填补", type: "select", options: [{ label: "均值", value: "mean" }, { label: "中位数", value: "median" }, { label: "零", value: "zero" }], default: "mean" },
    { key: "oneHot", label: "自动独热编码 (One-Hot)", type: "boolean", default: true },
    { key: "autoTune", label: "智能超参数调优 (AutoTune)", type: "boolean", default: false },
  ],
  citation: "Breiman, L. (2001). Random Forests"
};

async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
  return callPythonML("ml.randomForestReg", dataset, variables, params, onLog);
}

export default { spec, run };