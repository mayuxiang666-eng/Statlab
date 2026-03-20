import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { callPythonML } from "../pythonBridge";

const spec: AlgorithmSpec = {
    id: "ml.decisionTree",
    name: "决策树分类 (CART)",
    category: "ml",
    subcategory: "classification",
    description: "树状分类 + 特征重要度 + 混淆矩阵 (Python sklearn)",
    explanation: "像一个不断抽问题的机器人，通过连续抽取是/否的问题，把人群一层层分割开，最终把特征相似的样本分到同一类。直观且非常容易解释。",
    inputSpec: [
        { id: "target", label: "目标(分类)", acceptedTypes: ["categorical"], min: 1, max: 1 },
        { id: "features", label: "特征", acceptedTypes: ["numeric"], min: 1 }
    ],
    paramSchema: [
        { key: "maxDepth", label: "最大深度", type: "number", default: 5, min: 1, max: 20, step: 1 },
        { key: "testSize", label: "测试集比例", type: "number", default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
        { key: "cv", label: "交叉验证折数 (0=关闭)", type: "number", default: 0, min: 0, max: 10, step: 1 },
        { key: "impute", label: "缺失值填补", type: "select", options: [{ label: "均值", value: "mean" }, { label: "中位数", value: "median" }, { label: "零", value: "zero" }], default: "mean" },
    ],
    citation: "Breiman, L., Friedman, J., Stone, C. J., & Olshen, R. A. (1984). Classification and regression trees."
};

async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
    return callPythonML("ml.decisionTree", dataset, variables, params, onLog);
}

export default { spec, run };
