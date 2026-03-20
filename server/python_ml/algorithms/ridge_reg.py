"""Ridge Regression using scikit-learn."""
import numpy as np
from sklearn.linear_model import Ridge, RidgeCV
from sklearn.model_selection import cross_val_score
from utils import (preprocess_dataset, regression_metrics,
                   build_prediction_chart, build_scatter_chart, build_residual_chart)


def run(payload: dict) -> dict:
    dataset = payload["dataset"]
    variables = payload["variables"]
    params = payload.get("params", {})
    logs = []

    target = variables.get("target", [None])[0]
    features = variables.get("features", [])
    if not target or not features:
        raise ValueError("缺少变量")

    impute = params.get("impute", "mean")
    one_hot = bool(params.get("oneHot", True))
    scale = params.get("scale", "standard")
    test_size = float(params.get("testSize", 0.3))
    alpha = float(params.get("alpha", 1.0))
    cv_folds = int(params.get("cv", 0))
    auto_tune = bool(params.get("autoTune", False))

    logs.append(f"[Ridge] 开始训练，共 {len(dataset)} 样本，{len(features)} 特征")
    X_train, X_test, y_train, y_test, feat_names, scaler = preprocess_dataset(
        dataset, features, target, impute, one_hot, scale, test_size
    )
    logs.append(f"[Ridge] 训练集: {len(X_train)}，测试集: {len(X_test)}")

    if auto_tune:
        logs.append("[Ridge] 自动调参: 使用 RidgeCV 选择最优 alpha...")
        alphas = [0.01, 0.1, 1.0, 10.0, 100.0]
        ridge_cv = RidgeCV(alphas=alphas, cv=5)
        ridge_cv.fit(X_train, y_train)
        alpha = ridge_cv.alpha_
        logs.append(f"[Ridge] 最优 alpha={alpha}")

    model = Ridge(alpha=alpha)
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    train_preds = model.predict(X_train)
    metrics = regression_metrics(y_test, preds)
    train_metrics = regression_metrics(y_train, train_preds)
    logs.append(f"[Ridge] 训练完成 | 测试集 R²={metrics['r2']}，RMSE={metrics['rmse']}")

    # Coefficients
    coefs = list(zip(feat_names, model.coef_.tolist()))
    coef_rows = sorted(coefs, key=lambda x: -abs(x[1]))

    cv_rows = []
    cv_r2_mean = 0
    if cv_folds >= 2:
        scores = cross_val_score(Ridge(alpha=alpha), X_train, y_train, cv=cv_folds, scoring="r2")
        cv_r2_mean = round(float(scores.mean()), 3)
        cv_rows = [[f"第 {i+1} 折", "-", round(float(s), 4), "-"] for i, s in enumerate(scores)]

    tables = [
        {
            "title": "📊 回归评估指标",
            "columns": ["指标", "测试集", "训练集"],
            "rows": [
                ["alpha (正则化强度)", alpha, ""],
                ["R² (决定系数)", metrics["r2"], train_metrics["r2"]],
                ["RMSE", metrics["rmse"], train_metrics["rmse"]],
                ["MAE", metrics["mae"], train_metrics["mae"]],
                ["截距 (Intercept)", round(float(model.intercept_), 4), ""]
            ]
        },
        {
            "title": "📋 回归系数",
            "columns": ["特征", "系数"],
            "rows": [[f, round(float(c), 6)] for f, c in coef_rows]
        }
    ]
    if cv_rows:
        tables.append({"title": f"🔁 {cv_folds} 折交叉验证 (平均 R²={cv_r2_mean})",
                       "columns": ["折次", "样本量", "R²", "RMSE"], "rows": cv_rows})

    # Coefficient bar chart
    figures = [
        {
            "title": "📊 回归系数",
            "type": "echarts",
            "option": {
                "tooltip": {},
                "xAxis": {"type": "value"},
                "yAxis": {"type": "category", "data": [f for f, _ in reversed(coef_rows)]},
                "series": [{"type": "bar", "data": [round(float(c), 6) for _, c in reversed(coef_rows)],
                            "itemStyle": {"color": "#3b82f6"}}],
                "grid": {"left": 120, "right": 30, "top": 10, "bottom": 30}
            }
        },
        build_prediction_chart(y_test, preds),
        build_scatter_chart(y_test, preds),
        build_residual_chart(y_test, preds)
    ]

    warnings = []
    if train_metrics["r2"] - metrics["r2"] > 0.2:
        warnings.append(f"过拟合风险：训练 R²({train_metrics['r2']}) >> 测试 R²({metrics['r2']})")
    if metrics["r2"] < 0.5:
        warnings.append("R² 低于 0.5，模型解释力有限")

    return {
        "tables": tables, "figures": figures, "warnings": warnings, "logs": logs,
        "assumptions": [f"缺失值: {impute}填补", f"特征缩放: {scale}", f"alpha={alpha}"],
        "narrative": f"Ridge 回归 | R²={metrics['r2']}，RMSE={metrics['rmse']}，alpha={alpha}",
        "citation": "Hoerl & Kennard (1970). Ridge Regression",
        "extras": {
            "regression": {
                "type": "linear", "featureNames": feat_names,
                "coefficients": [c for _, c in coefs],
                "intercept": float(model.intercept_), "metrics": metrics,
                "evaluation": _verdict(metrics["r2"], metrics["rmse"])
            }
        }
    }


def _verdict(r2, rmse):
    if r2 >= 0.8: return f"模型表现优秀（R²={r2}，RMSE={rmse}）"
    if r2 >= 0.6: return f"模型表现良好（R²={r2}，RMSE={rmse}）"
    if r2 >= 0.4: return f"模型表现一般（R²={r2}，RMSE={rmse}）"
    return f"模型解释力较弱（R²={r2}，RMSE={rmse}）"
