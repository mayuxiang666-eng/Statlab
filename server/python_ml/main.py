"""
StatLab Python ML Service - FastAPI Application
Runs on port 3002, called from Node.js ML bridge modules.
"""
import sys
import os

# Fix encoding issues on Windows terminals
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any
import traceback

from utils import execute_python_code, build_python_env_status

app = FastAPI(title="StatLab Python ML Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class MLRequest(BaseModel):
    algorithm: str
    dataset: list[dict]
    variables: dict[str, Any]
    params: dict[str, Any] = {}


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "StatLab Python ML",
        "env": build_python_env_status(),
    }


@app.post("/run")
def run_algorithm(req: MLRequest):
    algo = req.algorithm
    print(f"[Python ML] Received task: {algo} with {len(req.dataset)} samples")
    payload = {"dataset": req.dataset, "variables": req.variables, "params": req.params}

    try:
        if algo == "ml.randomForestReg":
            from algorithms.rf_regression import run
        elif algo == "ml.xgboostReg":
            from algorithms.xgboost_reg import run
        elif algo == "ml.lightgbmReg":
            from algorithms.lightgbm_reg import run
        elif algo == "ml.decisionTree":
            from algorithms.decision_tree import run
        elif algo == "ml.ridgeReg" or algo == "ml.ridge":
            from algorithms.ridge_reg import run
        elif algo == "ml.lassoReg" or algo == "ml.lasso":
            from algorithms.lasso_reg import run
        elif algo == "ml.industrialEffect":
            from algorithms.industrial_effect import run
        elif algo == "ml.randomForest":
            from algorithms.rf_classifier import run
        elif algo == "ml.logistic":
            from algorithms.logistic_reg import run
        elif algo == "ml.kmeans":
            from algorithms.kmeans import run
        elif algo == "ml.timeSeries":
            from algorithms.time_series import run
        else:
            raise HTTPException(status_code=404, detail=f"Algorithm '{algo}' not available in Python ML service")

        result = run(payload)
        return result

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[Python ML Error]: {e}\n{tb}")
        raise HTTPException(status_code=500, detail=f"ML Error: {str(e)}")


@app.post("/run-code")
def run_custom_code(req: dict):
    code = req.get("code", "")
    dataset = req.get("dataset", [])
    tests = req.get("tests", [])
    step_tests = req.get("stepTests", [])
    return execute_python_code(code, dataset, tests, step_tests)


if __name__ == "__main__":
    import uvicorn

    print("[Python ML] StatLab Python ML Service starting on port 3002...")
    uvicorn.run("main:app", host="0.0.0.0", port=3002, log_level="warning", reload=True)
