"""Random Forest Regression using scikit-learn + SHAP."""
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import GridSearchCV, cross_val_score
from utils import (preprocess_dataset, regression_metrics, compute_shap_values,
                   build_prediction_chart, build_scatter_chart, build_residual_chart, build_importance_chart)


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
    n_trees = int(params.get("trees", 100))
    cv_folds = int(params.get("cv", 0))
    auto_tune = bool(params.get("autoTune", False))

    logs.append(f"[RF回归] 开始预处理，共 {len(dataset)} 样本，{len(features)} 特征...")
    X_train, X_test, y_train, y_test, feat_names, scaler = preprocess_dataset(
        dataset, features, target, impute, one_hot, scale, test_size
    )
    logs.append(f"[RF回归] 训练集: {len(X_train)}，测试集: {len(X_test)}")

    best_params_note = "未启用自动调参，使用用户设定参数"
    if auto_tune:
        print(f"[RF回归] Running GridSearchCV on {len(X_train)} samples...")
        logs.append("[RF回归] 开启智能超参数调优，网格搜索中...")
        sample_size = min(2000, len(X_train))
        X_tune, y_tune = X_train[:sample_size], y_train[:sample_size]
        param_grid = {"n_estimators": [50, 100, 200], "max_features": ["sqrt", "log2"]}
        rf_cv = RandomForestRegressor(random_state=42, n_jobs=-1)
        gs = GridSearchCV(rf_cv, param_grid, cv=3, scoring="r2", n_jobs=1)
        gs.fit(X_tune, y_tune)
        n_trees = gs.best_params_["n_estimators"]
        best_params_note = f"AutoTune: n_estimators={n_trees}, max_features={gs.best_params_['max_features']}"
        logs.append(f"[RF回归] ✨ 调参完成：{best_params_note}")
        print(f"[RF回归] Grid search finished: {best_params_note}")

    logs.append(f"[RF回归] 开始构建 {n_trees} 棵回归树集合...")
    print(f"[RF回归] Training final model with n_trees={n_trees}...")
    rf = RandomForestRegressor(n_estimators=n_trees, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)
    print("[RF回归] Training finished.")
    preds = rf.predict(X_test)
    train_preds = rf.predict(X_train)
    metrics = regression_metrics(y_test, preds)
    train_metrics = regression_metrics(y_train, train_preds)
    logs.append(f"[RF回归] 训练完成 | 测试集 R²={metrics['r2']}，RMSE={metrics['rmse']} | 训练集 R²={train_metrics['r2']}")

    logs.append("[RF回归] 计算 SHAP 特征重要度...")
    sorted_shap = compute_shap_values(rf, X_train, feat_names, "tree")
    logs.append(f"[RF回归] SHAP 完成，最重要特征: {sorted_shap[0]['feature'] if sorted_shap else 'N/A'}")

    # Cross validation
    cv_rows = []
    cv_r2_mean = 0
    if cv_folds >= 2:
        logs.append(f"[RF回归] 开始 {cv_folds} 折交叉验证...")
        scores = cross_val_score(RandomForestRegressor(n_estimators=min(n_trees, 50), random_state=42, n_jobs=-1),
                                 X_train, y_train, cv=cv_folds, scoring="r2")
        cv_r2_mean = round(float(scores.mean()), 3)
        cv_rows = [[f"第 {i+1} 折", "-", round(float(s), 4), "-"] for i, s in enumerate(scores)]
        logs.append(f"[RF回归] 交叉验证完成 | 平均 R²={cv_r2_mean}")

    warnings = []
    if train_metrics["r2"] - metrics["r2"] > 0.2:
        warnings.append(f"过拟合风险：训练 R²({train_metrics['r2']}) >> 测试 R²({metrics['r2']})")
    if metrics["r2"] < 0.5:
        warnings.append("R² 低于 0.5，模型解释力有限")

    tables = [
        {
            "title": "📊 回归评估指标",
            "columns": ["指标", "测试集", "训练集"],
            "rows": [
                ["最佳参数组合", best_params_note, ""],
                ["R² (决定系数)", metrics["r2"], train_metrics["r2"]],
                ["RMSE", metrics["rmse"], train_metrics["rmse"]],
                ["MAE", metrics["mae"], train_metrics["mae"]],
            ]
        },
        {
            "title": "🏆 特征重要度 (SHAP)",
            "columns": ["排名", "特征", "|SHAP| 均值"],
            "rows": [[i+1, r["feature"], r["importance"]] for i, r in enumerate(sorted_shap)]
        }
    ]
    if cv_rows:
        tables.append({"title": f"🔁 {cv_folds} 折交叉验证 (平均 R²={cv_r2_mean})",
                       "columns": ["折次", "样本量", "R²", "RMSE"], "rows": cv_rows})

    figures = [
        build_prediction_chart(y_test, preds),
        build_scatter_chart(y_test, preds),
        build_importance_chart(sorted_shap),
        build_residual_chart(y_test, preds)
    ]

    return {
        "tables": tables,
        "figures": figures,
        "warnings": warnings,
        "logs": logs,
        "assumptions": [f"缺失值: {impute}填补", f"特征缩放: {scale}"],
        "narrative": f"随机森林回归 | R²={metrics['r2']}，RMSE={metrics['rmse']}。最重要特征: {sorted_shap[0]['feature'] if sorted_shap else 'N/A'}",
        "citation": "Breiman, L. (2001). Random Forests",
        "extras": {
            "regression": {
                "type": "nonlinear",
                "equation": "随机森林为非线性集成模型，无法给出简单解析方程。",
                "featureNames": feat_names,
                "coefficients": [],
                "intercept": 0,
                "metrics": metrics,
                "evaluation": _verdict(metrics["r2"], metrics["rmse"])
            }
        }
    }


def _verdict(r2, rmse):
    if r2 >= 0.8: return f"模型表现优秀（R²={r2}，RMSE={rmse}）"
    if r2 >= 0.6: return f"模型表现良好（R²={r2}，RMSE={rmse}）"
    if r2 >= 0.4: return f"模型表现一般（R²={r2}，RMSE={rmse}）"
    return f"模型解释力较弱（R²={r2}，RMSE={rmse}）"
