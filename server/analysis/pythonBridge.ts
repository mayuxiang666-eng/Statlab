/**
 * Python ML Service Bridge
 * Sends ML computation requests to the Python FastAPI service on port 3002.
 */
import axios from "axios";
import { AnalysisResult } from "@statlab/shared";

const PYTHON_ML_URL = process.env.PYTHON_ML_URL || "http://127.0.0.1:3002";

export async function callPythonML(
  algorithmId: string,
  dataset: any[],
  variables: Record<string, string[]>,
  params: Record<string, any>,
  onLog?: (msg: string) => void,
): Promise<AnalysisResult> {
  const yieldLoop = () => new Promise((r) => setTimeout(r, 10));

  if (onLog) {
    onLog(`[Python ML] Forwarding task to Python service (${algorithmId})...`);
    await yieldLoop();
  }

  const payload = { algorithm: algorithmId, dataset, variables, params };

  let result: any;
  try {
    const response = await axios.post(`${PYTHON_ML_URL}/run`, payload, {
      timeout: 600000,
      headers: { "Content-Type": "application/json" },
    });
    result = response.data;
  } catch (err: any) {
    const detail = err?.response?.data?.detail || err?.message || String(err);
    throw new Error(`Python ML service error: ${detail}`);
  }

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
  tests?: string[],
  stepTests?: string[],
): Promise<any> {
  const payload = { code, dataset, tests, stepTests };
  try {
    const response = await axios.post(`${PYTHON_ML_URL}/run-code`, payload, {
      timeout: 600000,
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (err: any) {
    const detail = err?.response?.data?.detail || err?.message || String(err);
    throw new Error(`Python ML service error: ${detail}`);
  }
}

export async function getPythonMLHealth(): Promise<any> {
  try {
    const res = await axios.get(`${PYTHON_ML_URL}/health`, { timeout: 3000 });
    return res.data;
  } catch (err: any) {
    return {
      ok: false,
      service: "StatLab Python ML",
      env: {
        healthy: false,
        dependencies: {},
        message: err?.message || "Cannot connect to Python ML service",
      },
    };
  }
}

export async function isPythonMLAvailable(): Promise<boolean> {
  const health = await getPythonMLHealth();
  return health?.ok === true;
}
