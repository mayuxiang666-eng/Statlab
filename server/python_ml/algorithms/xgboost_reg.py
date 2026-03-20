"""XGBoost Regression using xgboost library + SHAP."""
import numpy as np
from xgboost import XGBRegressor
from sklearn.model_selection import cross_val_score, GridSearchCV
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
    test_size = float(params.get("testSize", 0.2))
    n_estimators = int(params.get("n_estimators", 100))
    learning_rate = float(params.get("learning_rate", 0.1))
    max_depth = int(params.get("max_depth", 6))
    subsample = float(params.get("subsample", 0.8))
    cv_folds = int(params.get("cv", 0))
    auto_tune = bool(params.get("autoTune", True))

    logs.append(f"[XGBoost] 环境初始化完毕，共 {len(dataset)} 样本，{len(features)} 特征")
    X_train, X_test, y_train, y_test, feat_names, scaler = preprocess_dataset(
        dataset, features, target, impute, one_hot, scale, test_size
    )
    logs.append(f"[XGBoost] 切分完成: 训练集 {len(X_train)}，测试集 {len(X_test)}")

    best_params_note = "未启用自动调参，使用用户设定参数"
    if auto_tune:
        print(f"[XGBoost] Running GridSearchCV on {len(X_train)} samples...")
        logs.append("[XGBoost] 自动调参模式：网格搜索最优参数...")
        sample_size = min(2000, len(X_train))
        Xt, yt = X_train[:sample_size], y_train[:sample_size]
        param_grid = {
            "n_estimators": [50, 100, 200],
            "max_depth": [4, 6, 8],
            "learning_rate": [0.05, 0.1]
        }
        # Use n_jobs=1 for GridSearchCV to avoid over-subscription/hangs on Windows
        xgb_cv = XGBRegressor(subsample=subsample, random_state=42, verbosity=0, n_jobs=-1)
        gs = GridSearchCV(xgb_cv, param_grid, cv=3, scoring="r2", n_jobs=1)
        gs.fit(Xt, yt)
        n_estimators = gs.best_params_["n_estimators"]
        max_depth = gs.best_params_["max_depth"]
        learning_rate = gs.best_params_["learning_rate"]
        best_params_note = f"AutoTune: n_estimators={n_estimators}, max_depth={max_depth}, lr={learning_rate}"
        logs.append(f"[XGBoost] ✨ 调参完成：{best_params_note}")
        print(f"[XGBoost] Grid search finished: {best_params_note}")

    logs.append(f"[XGBoost] 参数配置: eta={learning_rate}, max_depth={max_depth}, subsample={subsample}")
    logs.append(f"[XGBoost] 开始梯度提升主循环，共计 {n_estimators} 次迭代...")
    print(f"[XGBoost] Training final model with n_estimators={n_estimators}...")
    
    xgb = XGBRegressor(n_estimators=n_estimators, learning_rate=learning_rate,
                       max_depth=max_depth, subsample=subsample, random_state=42,
                       verbosity=0, n_jobs=-1)
    xgb.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    print("[XGBoost] Training finished.")
    preds = xgb.predict(X_test)
    train_preds = xgb.predict(X_train)
    metrics = regression_metrics(y_test, preds)
    train_metrics = regression_metrics(y_train, train_preds)
    logs.append(f"[XGBoost] 训练完成 | 测试集 R²={metrics['r2']}，RMSE={metrics['rmse']} | 训练集 R²={train_metrics['r2']}")

    logs.append("[XGBoost] 计算 SHAP 特征重要度...")
    sorted_shap = compute_shap_values(xgb, X_train, feat_names, "tree")

    cv_rows = []
    cv_r2_mean = 0
    if cv_folds >= 2:
        logs.append(f"[XGBoost] 开始 {cv_folds} 折交叉验证...")
        scores = cross_val_score(XGBRegressor(n_estimators=50, learning_rate=learning_rate,
                                              max_depth=max_depth, random_state=42, verbosity=0, n_jobs=-1),
                                 X_train, y_train, cv=cv_folds, scoring="r2")
        cv_r2_mean = round(float(scores.mean()), 3)
        cv_rows = [[f"第 {i+1} 折", "-", round(float(s), 4), "-"] for i, s in enumerate(scores)]
        logs.append(f"[XGBoost] 交叉验证完成 | 平均 R²={cv_r2_mean}")

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

    return {
        "tables": tables,
        "figures": [
            build_prediction_chart(y_test, preds),
            build_scatter_chart(y_test, preds),
            build_importance_chart(sorted_shap),
            build_residual_chart(y_test, preds)
        ],
        "warnings": warnings,
        "logs": logs,
        "assumptions": [f"缺失值: {impute}填补", f"特征缩放: {scale}"],
        "narrative": f"XGBoost 回归 | R²={metrics['r2']}，RMSE={metrics['rmse']}。最重要特征: {sorted_shap[0]['feature'] if sorted_shap else 'N/A'}",
        "citation": "Chen, T., & Guestrin, C. (2016). XGBoost: A Scalable Tree Boosting System",
        "extras": {
            "regression": {
                "type": "nonlinear", "equation": "XGBoost为非线性集成模型，无法给出简单解析方程。",
                "featureNames": feat_names, "coefficients": [], "intercept": 0,
                "metrics": metrics, "evaluation": _verdict(metrics["r2"], metrics["rmse"])
            }
        }
    }


def _verdict(r2, rmse):
    if r2 >= 0.8: return f"模型表现优秀（R²={r2}，RMSE={rmse}）"
    if r2 >= 0.6: return f"模型表现良好（R²={r2}，RMSE={rmse}）"
    if r2 >= 0.4: return f"模型表现一般（R²={r2}，RMSE={rmse}）"
    return f"模型解释力较弱（R²={r2}，RMSE={rmse}）"
