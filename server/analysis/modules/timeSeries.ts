import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { callPythonML } from "../pythonBridge";

const spec: AlgorithmSpec = {
    id: "ml.timeSeries",
    name: "ARIMA 时间序列",
    category: "ml",
    subcategory: "regression",
    description: "自回归积分滑动平均模型 (Python statsmodels)",
    explanation: "ARIMA 模型适用于预测具有自相关性和一定趋势的时间序列数据。通过指定 (p, d, q) 参数捕捉数据的时间依赖、差分平稳性和移动平均误差。",
    inputSpec: [
        { id: "target", label: "目标值 (数值)", acceptedTypes: ["numeric"], min: 1, max: 1 },
        { id: "time", label: "时间变量 (可选)", acceptedTypes: ["numeric", "datetime"], min: 0, max: 1 }
    ],
    paramSchema: [
        { key: "p", label: "自回归项 (p)", type: "number", default: 1, min: 0, max: 10, step: 1 },
        { key: "d", label: "差分阶数 (d)", type: "number", default: 1, min: 0, max: 5, step: 1 },
        { key: "q", label: "移动平均项 (q)", type: "number", default: 1, min: 0, max: 10, step: 1 },
        { key: "steps", label: "预测步数", type: "number", default: 10, min: 1, max: 100, step: 1 },
    ],
    citation: "Box, G. E. P., & Jenkins, G. M. (1970). Time Series Analysis: Forecasting and Control."
};

async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
    return callPythonML("ml.timeSeries", dataset, variables, params, onLog);
}

export default { spec, run };
