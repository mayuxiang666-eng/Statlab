import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { callPythonML } from "../pythonBridge";

const spec: AlgorithmSpec = {
  id: "ml.ridge",
  name: "Ridge 回归",
  category: "ml",
  subcategory: "regression",
  description: "L2 正则，输出 RMSE/MAE/R²+ 象限分析图 (Python sklearn)",
  explanation: "岭回归是普通线性回归的克制版。当多个指标高度相关（如工资和薪水同时放入）时，普通回归会不稳定，而岭回归会自动压制权重，防止过拟合。",
  inputSpec: [
    { id: "target", label: "目标", acceptedTypes: ["numeric"], min: 1, max: 1 },
    { id: "features", label: "特征", acceptedTypes: ["numeric", "categorical"], min: 1 }
  ],
  paramSchema: [
    { key: "alpha", label: "正则系数 alpha", type: "number", default: 1.0, min: 0.001, max: 100, step: 0.1 },
    { key: "testSize", label: "测试集比例", type: "number", default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
    { key: "cv", label: "交叉验证折数 (0=关闭)", type: "number", default: 0, min: 0, max: 10, step: 1 },
    { key: "scale", label: "特征缩放", type: "select", options: [{ label: "标准化 (Z-score)", value: "standard" }, { label: "归一化 (Min-Max)", value: "minmax" }, { label: "不缩放", value: "none" }], default: "standard" },
    { key: "impute", label: "缺失值填补", type: "select", options: [{ label: "均值填补", value: "mean" }, { label: "中位数填补", value: "median" }, { label: "零填补", value: "zero" }], default: "mean" },
    { key: "oneHot", label: "自动独热编码 (One-Hot)", type: "boolean", default: true },
    { key: "autoTune", label: "自动调参 (RidgeCV)", type: "boolean", default: false },
  ],
  citation: "Hoerl & Kennard (1970). Ridge Regression"
};

async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
  return callPythonML("ml.ridgeReg", dataset, variables, params, onLog);
}

export default { spec, run };
