"""LightGBM Regression using lightgbm library + SHAP."""
import numpy as np
from lightgbm import LGBMRegressor
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
    num_leaves = int(params.get("num_leaves", 31))
    learning_rate = float(params.get("learning_rate", 0.05))
    n_estimators = int(params.get("n_estimators", 120))
    feature_fraction = float(params.get("feature_fraction", 0.8))
    cv_folds = int(params.get("cv", 0))
    auto_tune = bool(params.get("autoTune", False))

    logs.append(f"[LightGBM] 启动直方图加速引擎...")
    X_train, X_test, y_train, y_test, feat_names, scaler = preprocess_dataset(
        dataset, features, target, impute, one_hot, scale, test_size
    )
    logs.append(f"[LightGBM] 数据准备完毕 (Train: {len(X_train)}, Valid: {len(X_test)})")

    best_params_note = "未启用自动调参，使用用户设定参数"
    if auto_tune:
        print(f"[LightGBM] Running GridSearchCV on {len(X_train)} samples...")
        logs.append("[LightGBM] 自动调参模式：网格搜索最优参数...")
        sample_size = min(2000, len(X_train))
        Xt, yt = X_train[:sample_size], y_train[:sample_size]
        param_grid = {
            "num_leaves": [15, 31, 63],
            "n_estimators": [80, 120, 200],
            "learning_rate": [0.03, 0.05, 0.1]
        }
        lgbm_cv = LGBMRegressor(feature_fraction=feature_fraction, random_state=42, verbose=-1, n_jobs=-1)
        gs = GridSearchCV(lgbm_cv, param_grid, cv=3, scoring="r2", n_jobs=1)
        gs.fit(Xt, yt)
        num_leaves = gs.best_params_["num_leaves"]
        n_estimators = gs.best_params_["n_estimators"]
        learning_rate = gs.best_params_["learning_rate"]
        best_params_note = f"AutoTune: num_leaves={num_leaves}, n_estimators={n_estimators}, lr={learning_rate}"
        logs.append(f"[LightGBM] ✨ 调参完成：{best_params_note}")
        print(f"[LightGBM] Grid search finished: {best_params_note}")

    logs.append(f"[LightGBM] 开始主模型训练 (迭代轮次: {n_estimators}, 特征采样: {int(feature_fraction*len(feat_names))}...)")
    print(f"[LightGBM] Training final model with n_estimators={n_estimators}...")
    
    lgbm = LGBMRegressor(num_leaves=num_leaves, learning_rate=learning_rate,
                          n_estimators=n_estimators, feature_fraction=feature_fraction,
                          random_state=42, verbose=-1, n_jobs=-1)
    lgbm.fit(X_train, y_train,
             eval_set=[(X_test, y_test)])
    print("[LightGBM] Training finished.")
    preds = lgbm.predict(X_test)
    train_preds = lgbm.predict(X_train)
    metrics = regression_metrics(y_test, preds)
    train_metrics = regression_metrics(y_train, train_preds)
    logs.append(f"[LightGBM] 训练完毕 | Train R²={train_metrics['r2']} | Valid R²={metrics['r2']}")

    logs.append("[LightGBM] 计算 SHAP 特征重要度...")
    sorted_shap = compute_shap_values(lgbm, X_train, feat_names, "tree")

    cv_rows = []
    cv_r2_mean = 0
    if cv_folds >= 2:
        logs.append(f"[LightGBM] 开始 {cv_folds} 折交叉验证...")
        scores = cross_val_score(LGBMRegressor(num_leaves=num_leaves, learning_rate=learning_rate,
                                               n_estimators=min(n_estimators, 60), random_state=42, verbose=-1, n_jobs=-1),
                                 X_train, y_train, cv=cv_folds, scoring="r2")
        cv_r2_mean = round(float(scores.mean()), 3)
        cv_rows = [[f"第 {i+1} 折", "-", round(float(s), 4), "-"] for i, s in enumerate(scores)]
        logs.append(f"[LightGBM] 交叉验证完成 | 平均 R²={cv_r2_mean}")

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
        "narrative": f"LightGBM 回归 | R²={metrics['r2']}，RMSE={metrics['rmse']}。最重要特征: {sorted_shap[0]['feature'] if sorted_shap else 'N/A'}",
        "citation": "Ke, G. et al. (2017). LightGBM: A Highly Efficient Gradient Boosting Decision Tree",
        "extras": {
            "regression": {
                "type": "nonlinear", "equation": "LightGBM为非线性集成模型，无法给出简单解析方程。",
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
