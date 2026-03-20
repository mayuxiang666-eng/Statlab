"""
Shared utilities for Python ML service.
"""
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split
from typing import Any


def preprocess_dataset(dataset: list[dict], features: list[str], target: str,
                       impute: str = "mean", one_hot: bool = True,
                       scale: str = "standard", test_size: float = 0.2):
    """Preprocess dataset: impute, encode, scale, split."""
    # --- Safety: ensure target is a plain string, not a list ---
    if isinstance(target, list):
        target = target[0] if target else ""
    target = str(target)

    if not dataset:
        raise ValueError("数据集为空")

    df = pd.DataFrame(dataset)

    # Force all column names to strings to avoid numeric-Index membership check bugs
    df.columns = [str(c) for c in df.columns]

    # Build a plain Python set of available column names for safe membership testing
    available_cols: set[str] = set(df.columns.tolist())

    if target not in available_cols:
        raise ValueError(f"目标列 '{target}' 在数据集中不存在")

    # Remove target from features to prevent duplicate columns
    features = [str(f) for f in features if str(f) != target]

    # Deduplicated column list: target first, then features
    all_cols = list(dict.fromkeys([target] + features))
    cols_to_use = [c for c in all_cols if c in available_cols]
    df = df[cols_to_use].copy()

    # Target column → numeric Series (now guaranteed to be a 1-D Series)
    df[target] = pd.to_numeric(df[target], errors="coerce")
    df = df.dropna(subset=[target])
    
    if df.empty:
        raise ValueError("数据处理后为空（可能目标列全为非数值或空值）")

    y = df[target].values.astype(float)

    # Only keep features that actually survived the column filter
    features = [f for f in features if f in df.columns.tolist()]
    feat_df = df[features].copy()

    numeric_feats: list[str] = []
    categorical_feats: list[str] = []
    for col in features:
        s_numeric = pd.to_numeric(feat_df[col], errors="coerce")
        non_na_count = feat_df[col].notna().sum()
        if non_na_count == 0:
            numeric_feats.append(col) # empty col
            continue
        
        # If more than 80% of non-NaN values are numeric, we definitely treat it as numeric
        # This avoids treating a numeric col as categorical just because of one "NA" string.
        if (s_numeric.notna().sum() / non_na_count) > 0.8:
            numeric_feats.append(col)
        else:
            categorical_feats.append(col)

    # Impute numeric features
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

    # One-Hot encode categorical features
    final_feature_names = list(numeric_feats)
    if one_hot and categorical_feats:
        # Pre-check: if any categorical feature has > 100 unique values, 
        # it's likely a mis-identified numeric or ID column. 
        # One-hot encoding it would cause a feature explosion.
        safe_categorical = []
        for col in categorical_feats:
            unique_count = feat_df[col].nunique()
            if unique_count <= 100:
                safe_categorical.append(col)
            else:
                # Log or handle too-many-categories case
                print(f"[Warning] Column '{col}' has {unique_count} unique values. Skipping one-hot encoding for safety.")
        
        if safe_categorical:
            dummies = pd.get_dummies(feat_df[safe_categorical], drop_first=False, dtype=float)
            feat_df = pd.concat([feat_df[numeric_feats], dummies], axis=1)
            final_feature_names = [str(c) for c in feat_df.columns]
        else:
            feat_df = feat_df[numeric_feats]
    else:
        feat_df = feat_df[numeric_feats]

    if feat_df.empty:
        X = np.zeros((len(y), 0))
    else:
        X = feat_df.values.astype(float)

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)

    # Scaling
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
    report = classification_report(y_true, y_pred, labels=list(range(len(labels))),
                                   target_names=labels, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(labels)))).tolist()
    return {"accuracy": acc, "report": report, "confusion_matrix": cm}


def compute_shap_values(model, X_train: np.ndarray, feature_names: list, model_type: str = "tree") -> list[dict]:
    """Compute SHAP feature importances. Returns list of {feature, importance}."""
    try:
        import shap
        if model_type == "tree":
            explainer = shap.TreeExplainer(model)
            sample = X_train[:min(500, len(X_train))]
            shap_vals = explainer.shap_values(sample)
            if isinstance(shap_vals, list):
                shap_vals = shap_vals[0]
            importance = np.abs(shap_vals).mean(axis=0)
        else:
            sample = X_train[:min(200, len(X_train))]
            explainer = shap.Explainer(model.predict, sample)
            shap_vals = explainer(sample).values
            importance = np.abs(shap_vals).mean(axis=0)
        
        result = [{"feature": f, "importance": round(float(v), 6)} for f, v in zip(feature_names, importance)]
        return sorted(result, key=lambda x: -x["importance"])
    except Exception:
        # Fallback to model's own feature importances
        if hasattr(model, "feature_importances_"):
            fi = model.feature_importances_
            result = [{"feature": f, "importance": round(float(v), 6)} for f, v in zip(feature_names, fi)]
            return sorted(result, key=lambda x: -x["importance"])
        return [{"feature": f, "importance": 0.0} for f in feature_names]


def build_prediction_chart(y_test, preds) -> dict:
    """Build ECharts prediction tracking figure."""
    return {
        "title": "📈 测试集预测追踪图",
        "type": "echarts",
        "explanation": "追踪测试集（验证集）中真实值与预测值的波动趋势。两条曲线越接近，说明模型捕捉时间或序列趋势的能力越强。",
        "option": {
            "tooltip": {"trigger": "axis"},
            "legend": {"data": ["真实值", "预测值"], "top": 10},
            "xAxis": {"type": "category", "data": list(range(len(y_test))), "name": "样本序号"},
            "yAxis": {"type": "value", "scale": True, "name": "数值"},
            "series": [
                {"name": "真实值", "type": "line", "data": [round(float(v), 4) for v in y_test],
                 "itemStyle": {"color": "#3b82f6"}, "symbol": "circle", "symbolSize": 4},
                {"name": "预测值", "type": "line", "data": [round(float(v), 4) for v in preds],
                 "itemStyle": {"color": "#10b981"}, "symbol": "circle", "symbolSize": 4}
            ],
            "dataZoom": [{"type": "slider", "show": True, "bottom": 0, "height": 20}],
            "grid": {"left": "10%", "right": "10%", "top": 50, "bottom": 40, "containLabel": True}
        }
    }


def build_scatter_chart(y_test, preds) -> dict:
    """Build actual vs predicted scatter chart."""
    scatter = [[round(float(a), 3), round(float(p), 3)] for a, p in zip(y_test, preds)]
    all_vals = [v for pair in scatter for v in pair]
    min_v = min(all_vals) if all_vals else 0
    max_v = max(all_vals) if all_vals else 1
    return {
        "title": "🎯 预测 vs 实际（测试集象限图）",
        "type": "echarts",
        "explanation": "将预测值与真实值进行点对点比对。数据点越靠近 45 度红色虚线（完美预测线），说明预测精度越高，分布越均匀则代表没有系统性偏差。",
        "option": {
            "tooltip": {"formatter": "实际: {c0}<br/>预测: {c1}"},
            "xAxis": {"name": "实际值", "nameLocation": "center", "nameGap": 30, "type": "value",
                      "min": min_v * 0.95, "max": max_v * 1.05},
            "yAxis": {"name": "预测值", "nameLocation": "center", "nameGap": 40, "type": "value",
                      "min": min_v * 0.95, "max": max_v * 1.05},
            "series": [
                {"type": "scatter", "data": scatter, "symbolSize": 7,
                 "itemStyle": {"color": "rgba(139,92,246,0.7)", "borderColor": "#7c3aed", "borderWidth": 1}},
                {"type": "line",
                 "data": [[min_v * 0.95, min_v * 0.95], [max_v * 1.05, max_v * 1.05]],
                 "lineStyle": {"type": "dashed", "color": "#ef4444", "width": 2},
                 "symbol": "none", "name": "完美预测"}
            ],
            "legend": {"data": ["预测点", "完美预测"]},
            "grid": {"left": 60, "right": 20, "top": 30, "bottom": 60}
        }
    }


def build_residual_chart(y_test, preds) -> dict:
    """Build residual distribution chart."""
    residual = [[round(float(p), 3), round(float(a - p), 3)] for a, p in zip(y_test, preds)]
    pred_vals = [v[0] for v in residual]
    return {
        "title": "📉 残差分布",
        "type": "echarts",
        "explanation": "残差 = 实际值 - 预测值。理想的残差分布应围绕 0 水平线上下随机波动；若呈现明显漏斗形状或曲线形状，说明模型可能存在异方差性或未捕捉的非线性关系。",
        "option": {
            "tooltip": {},
            "xAxis": {"name": "预测值", "type": "value"},
            "yAxis": {"name": "残差", "type": "value"},
            "series": [
                {"type": "scatter", "data": residual, "symbolSize": 7,
                 "itemStyle": {"color": "rgba(99,102,241,0.7)"}},
                {"type": "line",
                 "data": [[min(pred_vals) if pred_vals else 0, 0], [max(pred_vals) if pred_vals else 1, 0]],
                 "lineStyle": {"type": "dashed", "color": "#94a3b8"}, "symbol": "none"}
            ],
            "grid": {"left": 60, "right": 20, "top": 30, "bottom": 60}
        }
    }


def build_importance_chart(sorted_shap: list) -> dict:
    """Build feature importance bar chart."""
    return {
        "title": "🏆 特征重要度 (SHAP)",
        "type": "echarts",
        "explanation": "SHAP (SHapley Additive exPlanations) 值代表了每个特征对模型预测结果的贡献度大小。条形越长，其绝对影响越大。这能帮助我们识别工业生产中的「关键质量控制参数」。",
        "option": {
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "xAxis": {"type": "value", "name": "|SHAP| 均值"},
            "yAxis": {"type": "category", "data": [r["feature"] for r in reversed(sorted_shap[:15])]},
            "series": [{"type": "bar", "data": [r["importance"] for r in reversed(sorted_shap[:15])],
                        "itemStyle": {"color": "#a371f7"}, "label": {"show": True, "position": "right"}}],
            "grid": {"left": "25%", "right": "10%", "top": 30, "bottom": 50, "containLabel": True}
        }
    }


def build_tree_chart(tree, feat_names) -> dict:
    """Convert sklearn decision tree to ECharts tree structure."""
    tree_ = tree.tree_
    feature = tree_.feature
    threshold = tree_.threshold
    value = tree_.value

    def get_node(node_id):
        samples = int(tree_.n_node_samples[node_id])
        if feature[node_id] == -2:  # leaf
            val = round(float(value[node_id][0][0]), 3)
            return {"name": f"叶节点\n值: {val}\n(n={samples})", "value": val}
        else:
            fname = feat_names[feature[node_id]] if feature[node_id] < len(feat_names) else f"feat{feature[node_id]}"
            thresh = round(float(threshold[node_id]), 2)
            return {
                "name": f"{fname}\n<= {thresh}?\n(n={samples})",
                "children": [
                    get_node(tree_.children_left[node_id]),
                    get_node(tree_.children_right[node_id])
                ]
            }

    root_data = get_node(0)
    return {
        "title": "🌳 决策树结构图 (联合规则逻辑)",
        "type": "echarts",
        "explanation": "通过决策树提取的最优工况路径。每个节点代表一个判定参数，叶节点对应最终诊断结果。节点内 (n=数量) 表示符合该干线路径的样本量，样本量越大、且目标值越优的路径，越是工业生产中的推荐工况配置。",
        "option": {
            "tooltip": {"trigger": "item", "triggerOn": "mousemove"},
            "series": [{
                "type": "tree",
                "data": [root_data],
                "top": "15%", "bottom": "15%", "left": "10%", "right": "20%",
                "symbolSize": 7,
                "label": {"position": "left", "verticalAlign": "middle", "align": "right", "fontSize": 12},
                "leaves": {"label": {"position": "right", "verticalAlign": "middle", "align": "left"}},
                "expandAndCollapse": True,
                "animationDuration": 550,
                "animationDurationUpdate": 750
            }],
            "grid": {"left": "5%", "right": "5%", "top": "5%", "bottom": "5%"}
        }
    }


def execute_python_code(code: str, dataset: list[dict] = None, tests: list[str] | None = None):
    """
    Executes raw Python code and returns logs (stdout), plots (base64),
    and optional lightweight assertions for练习校验.
    """
    import io
    import sys
    import base64
    import traceback
    import matplotlib.pyplot as plt
    import pandas as pd
    import numpy as np

    # Setup capture
    captured_stdout = io.StringIO()
    sys.stdout = captured_stdout
    
    plots: list[str] = []
    test_results: list[dict[str, Any]] = []
    success = True
    error_msg: str | None = None
    
    # Prepare global environment
    df = pd.DataFrame(dataset) if dataset else pd.DataFrame()
    if not df.empty:
        for col in df.columns:
            try:
                # Use coerce to catch columns with mixed strings/numbers or empty strings
                s_num = pd.to_numeric(df[col], errors='coerce')
                # If more than 50% of the column is numeric, convert it permanently
                if s_num.notna().sum() > 0.5 * len(df):
                    df[col] = s_num
            except Exception:
                pass

    locs = {
        "df": df,
        "pd": pd,
        "np": np,
        "plt": plt,
    }

    try:
        # Clear any existing plots
        plt.close('all')
        
        # Execute user code
        exec(code, locs, locs)

        # Optional practice tests
        if tests:
            for i, test_code in enumerate(tests):
                try:
                    exec(test_code, locs, locs)
                    test_results.append({"name": f"Test {i+1}", "status": "passed"})
                except Exception as te:
                    success = False
                    msg = str(te)
                    test_results.append({"name": f"Test {i+1}", "status": "failed", "message": msg})
        
        # Check if there's an active figure to save
        if plt.get_fignums():
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            buf.seek(0)
            img_b64 = base64.b64encode(buf.read()).decode('utf-8')
            plots.append(img_b64)
            plt.close('all')

    except Exception:
        success = False
        error_msg = traceback.format_exc()
        print(error_msg)
    finally:
        sys.stdout = sys.__stdout__

    return {
        "logs": captured_stdout.getvalue().splitlines(),
        "plots": plots,
        "success": success,
        "error": error_msg,
        "tests": test_results
    }

