/**
 * Python ML Service Bridge
 * Sends ML computation requests to the Python FastAPI service on port 3002.
 */
import axios from "axios";
import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";

const PYTHON_ML_URL = process.env.PYTHON_ML_URL || "http://127.0.0.1:3002";

export async function callPythonML(
    algorithmId: string,
    dataset: any[],
    variables: Record<string, string[]>,
    params: Record<string, any>,
    onLog?: (msg: string) => void
): Promise<AnalysisResult> {
    const yieldLoop = () => new Promise(r => setTimeout(r, 10));

    if (onLog) { onLog(`[Python ML] 正在将任务转发至 Python ML 服务 (${algorithmId})...`); await yieldLoop(); }

    const payload = { algorithm: algorithmId, dataset, variables, params };

    let result: any;
    try {
        const response = await axios.post(`${PYTHON_ML_URL}/run`, payload, {
            timeout: 600000,
            headers: { "Content-Type": "application/json" }
        });
        result = response.data;
    } catch (err: any) {
        const detail = err?.response?.data?.detail || err?.message || String(err);
        throw new Error(`Python ML 服务错误: ${detail}`);
    }

    // Emit Python logs through Node.js onLog
    if (onLog && result.logs) {
        for (const msg of result.logs) {
            onLog(msg);
            await yieldLoop();
        }
    }

    return result as AnalysisResult;
}

export async function runCustomPythonCode(
    code: string,
    dataset: any[],
    tests?: string[]
): Promise<any> {
    const payload = { code, dataset, tests };
    try {
        const response = await axios.post(`${PYTHON_ML_URL}/run-code`, payload, {
            timeout: 600000,
            headers: { "Content-Type": "application/json" }
        });
        return response.data;
    } catch (err: any) {
        const detail = err?.response?.data?.detail || err?.message || String(err);
        throw new Error(`Python ML 服务错误: ${detail}`);
    }
}


export async function isPythonMLAvailable(): Promise<boolean> {
    try {
        const res = await axios.get(`${PYTHON_ML_URL}/health`, { timeout: 3000 });
        return res.data?.ok === true;
    } catch {
        return false;
    }
}
