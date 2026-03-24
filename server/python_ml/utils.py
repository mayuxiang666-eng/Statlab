"""Shared utilities for Python ML service (encoding-safe + dedup-safe)."""

from __future__ import annotations

from typing import Any
import base64
import io
import sys
import traceback

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler, StandardScaler


def _normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names/values and remove exact duplicate rows."""
    if df is None:
        return pd.DataFrame()

    if df.empty:
        return df

    # Normalize column names and strip potential BOM.
    df = df.copy()
    df.columns = [str(c).replace("\ufeff", "").strip() for c in df.columns]

    # Normalize text cells for stable comparisons.
    for col in df.columns:
        if pd.api.types.is_object_dtype(df[col]):
            df[col] = df[col].astype(str).str.replace("\ufeff", "", regex=False).str.strip()
            df[col] = df[col].replace({"nan": "", "None": ""})

    # Runtime-level dedupe for practice stability.
    return df.drop_duplicates().reset_index(drop=True)


def preprocess_dataset(
    dataset: list[dict],
    features: list[str],
    target: str,
    impute: str = "mean",
    one_hot: bool = True,
    scale: str = "standard",
    test_size: float = 0.2,
):
    """Preprocess dataset: impute, encode, scale, split."""
    if isinstance(target, list):
        target = target[0] if target else ""
    target = str(target)

    if not dataset:
        raise ValueError("Dataset is empty")

    df = _normalize_dataframe(pd.DataFrame(dataset))
    available_cols: set[str] = set(df.columns.tolist())

    if target not in available_cols:
        raise ValueError(f"Target column '{target}' does not exist in dataset")

    features = [str(f) for f in features if str(f) != target]
    all_cols = list(dict.fromkeys([target] + features))
    cols_to_use = [c for c in all_cols if c in available_cols]
    df = df[cols_to_use].copy()

    df[target] = pd.to_numeric(df[target], errors="coerce")
    df = df.dropna(subset=[target])
    if df.empty:
        raise ValueError("Dataset becomes empty after target numeric conversion")

    y = df[target].values.astype(float)
    features = [f for f in features if f in df.columns.tolist()]
    feat_df = df[features].copy()

    numeric_feats: list[str] = []
    categorical_feats: list[str] = []
    for col in features:
        s_numeric = pd.to_numeric(feat_df[col], errors="coerce")
        non_na_count = feat_df[col].notna().sum()
        if non_na_count == 0:
            numeric_feats.append(col)
            continue
        if (s_numeric.notna().sum() / non_na_count) > 0.8:
            numeric_feats.append(col)
        else:
            categorical_feats.append(col)

    for col in numeric_feats:
        feat_df[col] = pd.to_numeric(feat_df[col], errors="coerce")
        s = feat_df[col]
        if s.isna().all():
            feat_df[col] = 0.0
        elif impute == "mean":
            feat_df[col] = s.fillna(s.mean())
        elif impute == "median":
            feat_df[col] = s.fillna(s.median())
        else:
            feat_df[col] = s.fillna(0.0)

    final_feature_names = list(numeric_feats)
    if one_hot and categorical_feats:
        safe_categorical: list[str] = []
        for col in categorical_feats:
            unique_count = feat_df[col].nunique(dropna=True)
            if unique_count <= 100:
                safe_categorical.append(col)

        if safe_categorical:
            dummies = pd.get_dummies(feat_df[safe_categorical], drop_first=False, dtype=float)
            feat_df = pd.concat([feat_df[numeric_feats], dummies], axis=1)
            final_feature_names = [str(c) for c in feat_df.columns]
        else:
            feat_df = feat_df[numeric_feats]
    else:
        feat_df = feat_df[numeric_feats]

    X = np.zeros((len(y), 0)) if feat_df.empty else feat_df.values.astype(float)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)

    scaler = None
    if scale == "standard" and X_train.shape[1] > 0:
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_test = scaler.transform(X_test)
    elif scale == "minmax" and X_train.shape[1] > 0:
        scaler = MinMaxScaler()
        X_train = scaler.fit_transform(X_train)
        X_test = scaler.transform(X_test)

    return X_train, X_test, y_train, y_test, final_feature_names, scaler


def regression_metrics(y_true, y_pred) -> dict:
    """Compute R2, RMSE, MAE."""
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)
    n = len(y_true)
    if n == 0:
        return {"r2": 0, "rmse": 0, "mae": 0}

    var_y = np.var(y_true)
    if var_y == 0:
        r2 = 1.0 if np.allclose(y_true, y_pred) else 0.0
    else:
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        r2 = round(float(1 - ss_res / max(ss_tot, 1e-10)), 4)

    rmse = round(float(np.sqrt(np.mean((y_true - y_pred) ** 2))), 4)
    mae = round(float(np.mean(np.abs(y_true - y_pred))), 4)
    return {"r2": r2, "rmse": rmse, "mae": mae}


def classification_metrics(y_true, y_pred, labels: list) -> dict:
    """Compute accuracy, per-class precision/recall/f1."""
    from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

    acc = round(float(accuracy_score(y_true, y_pred)), 4)
    report = classification_report(
        y_true,
        y_pred,
        labels=list(range(len(labels))),
        target_names=labels,
        output_dict=True,
        zero_division=0,
    )
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(labels)))).tolist()
    return {"accuracy": acc, "report": report, "confusion_matrix": cm}


def compute_shap_values(model, X_train: np.ndarray, feature_names: list, model_type: str = "tree") -> list[dict]:
    """Compute SHAP feature importances. Fallback to feature_importances_."""
    try:
        import shap

        if model_type == "tree":
            explainer = shap.TreeExplainer(model)
            sample = X_train[: min(500, len(X_train))]
            shap_vals = explainer.shap_values(sample)
            if isinstance(shap_vals, list):
                shap_vals = shap_vals[0]
            importance = np.abs(shap_vals).mean(axis=0)
        else:
            sample = X_train[: min(200, len(X_train))]
            explainer = shap.Explainer(model.predict, sample)
            shap_vals = explainer(sample).values
            importance = np.abs(shap_vals).mean(axis=0)

        result = [{"feature": f, "importance": round(float(v), 6)} for f, v in zip(feature_names, importance)]
        return sorted(result, key=lambda x: -x["importance"])
    except Exception:
        if hasattr(model, "feature_importances_"):
            fi = model.feature_importances_
            result = [{"feature": f, "importance": round(float(v), 6)} for f, v in zip(feature_names, fi)]
            return sorted(result, key=lambda x: -x["importance"])
        return [{"feature": f, "importance": 0.0} for f in feature_names]


def build_prediction_chart(y_test, preds) -> dict:
    return {
        "title": "Prediction Tracking (Test Set)",
        "type": "echarts",
        "explanation": "Compare actual and predicted values over test samples.",
        "option": {
            "tooltip": {"trigger": "axis"},
            "legend": {"data": ["Actual", "Predicted"], "top": 10},
            "xAxis": {"type": "category", "data": list(range(len(y_test))), "name": "Sample Index"},
            "yAxis": {"type": "value", "scale": True, "name": "Value"},
            "series": [
                {"name": "Actual", "type": "line", "data": [round(float(v), 4) for v in y_test], "itemStyle": {"color": "#3b82f6"}, "symbol": "circle", "symbolSize": 4},
                {"name": "Predicted", "type": "line", "data": [round(float(v), 4) for v in preds], "itemStyle": {"color": "#10b981"}, "symbol": "circle", "symbolSize": 4},
            ],
            "dataZoom": [{"type": "slider", "show": True, "bottom": 0, "height": 20}],
            "grid": {"left": "10%", "right": "10%", "top": 50, "bottom": 40, "containLabel": True},
        },
    }


def build_scatter_chart(y_test, preds) -> dict:
    scatter = [[round(float(a), 3), round(float(p), 3)] for a, p in zip(y_test, preds)]
    all_vals = [v for pair in scatter for v in pair]
    min_v = min(all_vals) if all_vals else 0
    max_v = max(all_vals) if all_vals else 1
    return {
        "title": "Predicted vs Actual",
        "type": "echarts",
        "explanation": "Points closer to diagonal indicate better prediction accuracy.",
        "option": {
            "tooltip": {"formatter": "Actual: {c0}<br/>Predicted: {c1}"},
            "xAxis": {"name": "Actual", "nameLocation": "center", "nameGap": 30, "type": "value", "min": min_v * 0.95, "max": max_v * 1.05},
            "yAxis": {"name": "Predicted", "nameLocation": "center", "nameGap": 40, "type": "value", "min": min_v * 0.95, "max": max_v * 1.05},
            "series": [
                {"type": "scatter", "data": scatter, "symbolSize": 7, "itemStyle": {"color": "rgba(59,130,246,0.7)", "borderColor": "#1d4ed8", "borderWidth": 1}},
                {"type": "line", "data": [[min_v * 0.95, min_v * 0.95], [max_v * 1.05, max_v * 1.05]], "lineStyle": {"type": "dashed", "color": "#ef4444", "width": 2}, "symbol": "none", "name": "Ideal"},
            ],
            "legend": {"data": ["Prediction", "Ideal"]},
            "grid": {"left": 60, "right": 20, "top": 30, "bottom": 60},
        },
    }


def build_residual_chart(y_test, preds) -> dict:
    residual = [[round(float(p), 3), round(float(a - p), 3)] for a, p in zip(y_test, preds)]
    pred_vals = [v[0] for v in residual]
    return {
        "title": "Residual Distribution",
        "type": "echarts",
        "explanation": "Residual = Actual - Predicted. Good models show random spread around 0.",
        "option": {
            "tooltip": {},
            "xAxis": {"name": "Predicted", "type": "value"},
            "yAxis": {"name": "Residual", "type": "value"},
            "series": [
                {"type": "scatter", "data": residual, "symbolSize": 7, "itemStyle": {"color": "rgba(99,102,241,0.7)"}},
                {"type": "line", "data": [[min(pred_vals) if pred_vals else 0, 0], [max(pred_vals) if pred_vals else 1, 0]], "lineStyle": {"type": "dashed", "color": "#94a3b8"}, "symbol": "none"},
            ],
            "grid": {"left": 60, "right": 20, "top": 30, "bottom": 60},
        },
    }


def build_importance_chart(sorted_shap: list) -> dict:
    return {
        "title": "Feature Importance (SHAP)",
        "type": "echarts",
        "explanation": "Higher absolute SHAP value means greater model impact.",
        "option": {
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "xAxis": {"type": "value", "name": "Mean |SHAP|"},
            "yAxis": {"type": "category", "data": [r["feature"] for r in reversed(sorted_shap[:15])]},
            "series": [{"type": "bar", "data": [r["importance"] for r in reversed(sorted_shap[:15])], "itemStyle": {"color": "#a371f7"}, "label": {"show": True, "position": "right"}}],
            "grid": {"left": "25%", "right": "10%", "top": 30, "bottom": 50, "containLabel": True},
        },
    }


def build_tree_chart(tree, feat_names) -> dict:
    tree_ = tree.tree_
    feature = tree_.feature
    threshold = tree_.threshold
    value = tree_.value

    def get_node(node_id):
        samples = int(tree_.n_node_samples[node_id])
        if feature[node_id] == -2:
            val = round(float(value[node_id][0][0]), 3)
            return {"name": f"Leaf\\nvalue: {val}\\n(n={samples})", "value": val}
        fname = feat_names[feature[node_id]] if feature[node_id] < len(feat_names) else f"feat{feature[node_id]}"
        thresh = round(float(threshold[node_id]), 2)
        return {
            "name": f"{fname}\\n<= {thresh}?\\n(n={samples})",
            "children": [get_node(tree_.children_left[node_id]), get_node(tree_.children_right[node_id])],
        }

    return {
        "title": "Decision Tree Structure",
        "type": "echarts",
        "explanation": "Tree path rules for model interpretation.",
        "option": {
            "tooltip": {"trigger": "item", "triggerOn": "mousemove"},
            "series": [{"type": "tree", "data": [get_node(0)], "top": "15%", "bottom": "15%", "left": "10%", "right": "20%", "symbolSize": 7, "label": {"position": "left", "verticalAlign": "middle", "align": "right", "fontSize": 12}, "leaves": {"label": {"position": "right", "verticalAlign": "middle", "align": "left"}}, "expandAndCollapse": True, "animationDuration": 550, "animationDurationUpdate": 750}],
            "grid": {"left": "5%", "right": "5%", "top": "5%", "bottom": "5%"},
        },
    }


def build_python_env_status() -> dict:
    checks: dict[str, bool] = {}
    required_modules = ["numpy", "pandas", "sklearn", "matplotlib"]
    for name in required_modules:
        try:
            __import__(name)
            checks[name] = True
        except Exception:
            checks[name] = False
    healthy = all(checks.values())
    return {
        "healthy": healthy,
        "dependencies": checks,
        "message": "Python runtime healthy" if healthy else "Python dependencies missing. Install requirements.txt",
    }


def execute_python_code(
    code: str,
    dataset: list[dict] | None = None,
    tests: list[str] | None = None,
    step_tests: list[str] | None = None,
):
    """Execute code and return logs/plots/tests/checkpoints for PythonLab."""
    import matplotlib.pyplot as plt

    captured_stdout = io.StringIO()
    sys.stdout = captured_stdout

    plots: list[str] = []
    test_results: list[dict[str, Any]] = []
    checkpoint_results: list[dict[str, Any]] = []
    success = True
    error_msg: str | None = None

    env_status = build_python_env_status()

    df = _normalize_dataframe(pd.DataFrame(dataset) if dataset else pd.DataFrame())

    if not df.empty:
        for col in df.columns:
            try:
                s_num = pd.to_numeric(df[col], errors="coerce")
                if s_num.notna().sum() > 0.5 * len(df):
                    df[col] = s_num
            except Exception:
                pass

    dataset_status = {
        "required": True,
        "available": not df.empty,
        "rows": int(len(df)),
        "columns": [str(c) for c in df.columns.tolist()] if not df.empty else [],
        "message": "dataset loaded" if not df.empty else "dataset is empty or not bound",
    }

    locs = {"df": df, "pd": pd, "np": np, "plt": plt}

    try:
        plt.close("all")
        exec(code, locs, locs)

        if step_tests:
            for i, test_code in enumerate(step_tests):
                try:
                    exec(test_code, locs, locs)
                    checkpoint_results.append({"name": f"Checkpoint {i + 1}", "status": "passed"})
                except Exception as te:
                    success = False
                    checkpoint_results.append({"name": f"Checkpoint {i + 1}", "status": "failed", "message": str(te)})

        if tests:
            for i, test_code in enumerate(tests):
                try:
                    exec(test_code, locs, locs)
                    test_results.append({"name": f"Test {i + 1}", "status": "passed"})
                except Exception as te:
                    success = False
                    test_results.append({"name": f"Test {i + 1}", "status": "failed", "message": str(te)})

        if plt.get_fignums():
            buf = io.BytesIO()
            plt.savefig(buf, format="png", bbox_inches="tight")
            buf.seek(0)
            img_b64 = base64.b64encode(buf.read()).decode("utf-8")
            plots.append(img_b64)
            plt.close("all")

    except Exception:
        success = False
        error_msg = traceback.format_exc()
        print(error_msg)
    finally:
        sys.stdout = sys.__stdout__

    next_action = "Continue to next step" if success else "Fix current error and rerun this step"
    if not env_status["healthy"]:
        next_action = "Install Python dependencies: pip install -r server/python_ml/requirements.txt"
    elif not dataset_status["available"]:
        next_action = "Import and bind a dataset before running this step"

    return {
        "logs": captured_stdout.getvalue().splitlines(),
        "plots": plots,
        "success": success,
        "error": error_msg,
        "tests": test_results,
        "checkpointResults": checkpoint_results,
        "envStatus": env_status,
        "datasetStatus": dataset_status,
        "nextRecommendedAction": next_action,
    }