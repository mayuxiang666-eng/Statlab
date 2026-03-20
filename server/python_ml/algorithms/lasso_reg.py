"""Lasso Regression using scikit-learn."""
import numpy as np
from sklearn.linear_model import Lasso, LassoCV
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
    alpha = float(params.get("alpha", 0.01))
    cv_folds = int(params.get("cv", 0))
    auto_tune = bool(params.get("autoTune", False))

    logs.append(f"[Lasso] 开始训练，共 {len(dataset)} 样本，{len(features)} 特征")
    X_train, X_test, y_train, y_test, feat_names, scaler = preprocess_dataset(
        dataset, features, target, impute, one_hot, scale, test_size
    )
    logs.append(f"[Lasso] 训练集: {len(X_train)}，测试集: {len(X_test)}")

    if auto_tune:
        logs.append("[Lasso] 自动调参: 使用 LassoCV 选择最优 alpha...")
        lasso_cv = LassoCV(cv=5, random_state=42, max_iter=5000)
        lasso_cv.fit(X_train, y_train)
        alpha = lasso_cv.alpha_
        logs.append(f"[Lasso] 最优 alpha={alpha:.6f}")

    model = Lasso(alpha=alpha, max_iter=5000, random_state=42)
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    train_preds = model.predict(X_train)
    metrics = regression_metrics(y_test, preds)
    train_metrics = regression_metrics(y_train, train_preds)
    logs.append(f"[Lasso] 训练完成 | 测试集 R²={metrics['r2']}，RMSE={metrics['rmse']}")

    # Non-zero coefficients (Lasso does feature selection)
    coefs = list(zip(feat_names, model.coef_.tolist()))
    nonzero_coefs = [(f, c) for f, c in coefs if abs(c) > 1e-8]
    zero_coefs = [(f, c) for f, c in coefs if abs(c) <= 1e-8]
    coef_rows = sorted(nonzero_coefs, key=lambda x: -abs(x[1]))
    logs.append(f"[Lasso] 特征选择完成：{len(nonzero_coefs)} 个特征被选中，{len(zero_coefs)} 个被置零")

    cv_rows = []
    cv_r2_mean = 0
    if cv_folds >= 2:
        scores = cross_val_score(Lasso(alpha=alpha, max_iter=5000), X_train, y_train, cv=cv_folds, scoring="r2")
        cv_r2_mean = round(float(scores.mean()), 3)
        cv_rows = [[f"第 {i+1} 折", "-", round(float(s), 4), "-"] for i, s in enumerate(scores)]

    tables = [
        {
            "title": "📊 回归评估指标",
            "columns": ["指标", "测试集", "训练集"],
            "rows": [
                ["alpha (正则化强度)", round(alpha, 6), ""],
                ["R² (决定系数)", metrics["r2"], train_metrics["r2"]],
                ["RMSE", metrics["rmse"], train_metrics["rmse"]],
                ["MAE", metrics["mae"], train_metrics["mae"]],
                ["截距 (Intercept)", round(float(model.intercept_), 4), ""],
                ["被选中特征数", len(nonzero_coefs), f"共 {len(feat_names)} 个"],
            ]
        },
        {
            "title": "📋 非零回归系数 (Lasso 特征选择)",
            "columns": ["特征", "系数"],
            "rows": [[f, round(float(c), 6)] for f, c in coef_rows]
        }
    ]
    if cv_rows:
        tables.append({"title": f"🔁 {cv_folds} 折交叉验证 (平均 R²={cv_r2_mean})",
                       "columns": ["折次", "样本量", "R²", "RMSE"], "rows": cv_rows})

    figures = [
        {
            "title": "📊 Lasso 非零回归系数",
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
    if metrics["r2"] < 0.5:
        warnings.append("R² 低于 0.5，建议增加特征或降低 alpha")
    if len(nonzero_coefs) == 0:
        warnings.append("⚠️ 所有特征系数均被置零，alpha 可能过大，请降低 alpha 值")

    return {
        "tables": tables, "figures": figures, "warnings": warnings, "logs": logs,
        "assumptions": [f"缺失值: {impute}填补", f"特征缩放: {scale}", f"alpha={round(alpha, 6)}"],
        "narrative": f"Lasso 回归 | R²={metrics['r2']}，RMSE={metrics['rmse']}，alpha={round(alpha, 6)}，选中 {len(nonzero_coefs)} 个特征",
        "citation": "Tibshirani, R. (1996). Regression Shrinkage and Selection via the Lasso",
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
