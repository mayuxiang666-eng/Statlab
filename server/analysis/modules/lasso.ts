import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { callPythonML } from "../pythonBridge";

const spec: AlgorithmSpec = {
  id: "ml.lasso",
  name: "Lasso 回归",
  category: "ml",
  subcategory: "regression",
  description: "L1 正则 + 特征选择 (Python sklearn)",
  explanation: "Lasso 回归在控制模型复杂度的同时，将不重要特征的系数直接压缩为零（自动特征选择）。特别适合特征多、冗余多的场景。",
  inputSpec: [
    { id: "target", label: "目标", acceptedTypes: ["numeric"], min: 1, max: 1 },
    { id: "features", label: "特征", acceptedTypes: ["numeric", "categorical"], min: 1 }
  ],
  paramSchema: [
    { key: "alpha", label: "正则系数 alpha", type: "number", default: 0.01, min: 0.0001, max: 10, step: 0.001 },
    { key: "testSize", label: "测试集比例", type: "number", default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
    { key: "cv", label: "交叉验证折数 (0=关闭)", type: "number", default: 0, min: 0, max: 10, step: 1 },
    { key: "scale", label: "特征缩放", type: "select", options: [{ label: "标准化 (Z-score)", value: "standard" }, { label: "归一化 (Min-Max)", value: "minmax" }, { label: "不缩放", value: "none" }], default: "standard" },
    { key: "impute", label: "缺失值填补", type: "select", options: [{ label: "均值填补", value: "mean" }, { label: "中位数填补", value: "median" }, { label: "零填补", value: "zero" }], default: "mean" },
    { key: "oneHot", label: "自动独热编码 (One-Hot)", type: "boolean", default: true },
    { key: "autoTune", label: "自动调参 (LassoCV)", type: "boolean", default: false },
  ],
  citation: "Tibshirani, R. (1996). Regression Shrinkage and Selection via the Lasso"
};

async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
  return callPythonML("ml.lassoReg", dataset, variables, params, onLog);
}

export default { spec, run };
