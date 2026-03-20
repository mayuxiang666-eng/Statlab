import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { callPythonML } from "../pythonBridge";

const spec: AlgorithmSpec = {
  id: "ml.logistic",
  name: "Logistic 分类",
  category: "ml",
  subcategory: "classification",
  description: "二/多分类 + ROC/AUC + 混淆矩阵热力图 (Python sklearn)",
  explanation: "专门用来预测二分类选择（违约或不违约、患病或正常）。通过 Python sklearn 的逻辑回归引擎，实现高精度分类与特征重要度分析。",
  inputSpec: [
    { id: "target", label: "目标(分类)", acceptedTypes: ["categorical"], min: 1, max: 1 },
    { id: "features", label: "特征变量", acceptedTypes: ["numeric", "categorical"], min: 1 }
  ],
  paramSchema: [
    { key: "testSize", label: "测试集比例", type: "number", default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
    { key: "cv", label: "交叉验证折数 (0=关闭)", type: "number", default: 0, min: 0, max: 10, step: 1 },
    { key: "scale", label: "特征缩放", type: "select", options: [{ label: "标准化", value: "standard" }, { label: "归一化", value: "minmax" }, { label: "不缩放", value: "none" }], default: "standard" },
    { key: "impute", label: "缺失值填补", type: "select", options: [{ label: "均值", value: "mean" }, { label: "中位数", value: "median" }, { label: "零", value: "zero" }], default: "mean" },
    { key: "oneHot", label: "自动独热编码 (One-Hot)", type: "boolean", default: true },
  ],
  citation: "Hosmer & Lemeshow (2013). Applied Logistic Regression"
};

async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
  return callPythonML("ml.logistic", dataset, variables, params, onLog);
}

export default { spec, run };
