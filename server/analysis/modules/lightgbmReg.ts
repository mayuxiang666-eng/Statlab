import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { callPythonML } from "../pythonBridge";

const spec: AlgorithmSpec = {
  id: "ml.lightgbmReg",
  name: "LightGBM 回归",
  category: "ml",
  subcategory: "regression",
  description: "轻量级梯度提升机 (Python lightgbm)",
  explanation: "微软开源的工业级梯度提升框架。使用直方图算法加速树的构建，速度极快，内存占用小，适合大数据集的高精度回归。",
  inputSpec: [
    { id: "target", label: "目标(连续值)", acceptedTypes: ["numeric"], min: 1, max: 1 },
    { id: "features", label: "特征变量", acceptedTypes: ["numeric", "categorical"], min: 1 }
  ],
  paramSchema: [
    { key: "num_leaves", label: "叶子节点数", type: "number", default: 31, min: 2, max: 256, step: 1 },
    { key: "learning_rate", label: "学习率", type: "number", default: 0.05, min: 0.01, max: 0.5, step: 0.01 },
    { key: "n_estimators", label: "迭代轮次", type: "number", default: 120, min: 10, max: 800, step: 10 },
    { key: "feature_fraction", label: "特征采样率", type: "number", default: 0.8, min: 0.1, max: 1.0, step: 0.1 },
    { key: "testSize", label: "测试验证比例", type: "number", default: 0.2, min: 0.1, max: 0.5, step: 0.05 },
    { key: "cv", label: "交叉验证组数 (0为关)", type: "number", default: 0, min: 0, max: 10, step: 1 },
    { key: "scale", label: "规范化", type: "select", options: [{ label: "Z-Score 标准化", value: "standard" }, { label: "0-1 缩放", value: "minmax" }, { label: "保持原始", value: "none" }], default: "standard" },
    { key: "impute", label: "空值处理", type: "select", options: [{ label: "均值填补", value: "mean" }, { label: "中位数填补", value: "median" }, { label: "补零", value: "zero" }], default: "mean" },
    { key: "oneHot", label: "自动独热编码 (One-Hot)", type: "boolean", default: true },
    { key: "autoTune", label: "智能超参数调优 (AutoTune)", type: "boolean", default: false },
  ],
  citation: "Ke, G. et al. (2017). LightGBM: A Highly Efficient Gradient Boosting Decision Tree"
};

async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
  return callPythonML("ml.lightgbmReg", dataset, variables, params, onLog);
}

export default { spec, run };
