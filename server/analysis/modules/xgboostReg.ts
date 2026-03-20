import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { callPythonML } from "../pythonBridge";

const spec: AlgorithmSpec = {
    id: "ml.xgboostReg",
    name: "XGBoost 回归",
    category: "ml",
    subcategory: "regression",
    description: "极端梯度提升树 (Python xgboost)",
    explanation: "XGBoost 是机器学习界的竞赛王者。通过不断纠正上一次预测的错误（计算残差）来生长新的树，每一棵新树都是冲着填补前面的漏洞去的。不仅预测极其精准，还自带系统优化加速功能。",
    inputSpec: [
        { id: "target", label: "目标(数值)", acceptedTypes: ["numeric"], min: 1, max: 1 },
        { id: "features", label: "特征", acceptedTypes: ["numeric", "categorical"], min: 1 }
    ],
    paramSchema: [
        { key: "n_estimators", label: "迭代数 (n_estimators)", type: "number", default: 100, min: 10, max: 1000, step: 10 },
        { key: "learning_rate", label: "学习率 (eta)", type: "number", default: 0.1, min: 0.01, max: 1.0, step: 0.01 },
        { key: "max_depth", label: "最大深度", type: "number", default: 6, min: 1, max: 20, step: 1 },
        { key: "subsample", label: "子采样率", type: "number", default: 0.8, min: 0.1, max: 1.0, step: 0.1 },
        { key: "testSize", label: "测试集比例", type: "number", default: 0.2, min: 0.1, max: 0.5, step: 0.05 },
        { key: "cv", label: "交叉验证折数 (0=关闭)", type: "number", default: 0, min: 0, max: 10, step: 1 },
        { key: "scale", label: "特征缩放", type: "select", options: [{ label: "标准化", value: "standard" }, { label: "归一化", value: "minmax" }, { label: "不缩放", value: "none" }], default: "standard" },
        { key: "impute", label: "缺失值填补", type: "select", options: [{ label: "均值", value: "mean" }, { label: "中位数", value: "median" }, { label: "零", value: "zero" }], default: "mean" },
        { key: "oneHot", label: "自动独热编码 (One-Hot)", type: "boolean", default: true },
        { key: "autoTune", label: "智能超参数调优 (AutoTune)", type: "boolean", default: true },
    ],
    citation: "Chen, T., & Guestrin, C. (2016). XGBoost: A Scalable Tree Boosting System"
};

async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
    return callPythonML("ml.xgboostReg", dataset, variables, params, onLog);
}

export default { spec, run };
