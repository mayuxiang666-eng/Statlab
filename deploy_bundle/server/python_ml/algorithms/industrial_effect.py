"""Industrial Effect Analysis using scikit-learn RF + Decision Tree + PDP."""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.tree import DecisionTreeRegressor
from sklearn.inspection import partial_dependence
from utils import (
    preprocess_dataset, regression_metrics, compute_shap_values, 
    build_importance_chart, build_prediction_chart, build_scatter_chart, 
    build_residual_chart, build_tree_chart
)


def run(payload: dict) -> dict:
    dataset = payload["dataset"]
    variables = payload["variables"]
    params = payload.get("params", {})
    logs = []

    target = variables.get("target", [None])[0]
    focus = variables.get("focus", [])
    features = variables.get("features", [])
    
    if not target:
        raise ValueError("缺少目标变量")
    if not features:
        features = focus

    impute = params.get("impute", "mean")
    one_hot = bool(params.get("oneHot", True))
    scale = params.get("scale", "standard")
    test_size = float(params.get("testSize", 0.2))
    n_trees = int(params.get("trees", 100))
    rule_depth = min(max(int(params.get("ruleDepth", 3)), 2), 5)
    higher_better = bool(params.get("higherBetter", True))
    filter_rules = params.get("filterRules", {})  # {feature: [min, max]}
    custom_exprs = params.get("customFeatureExpressions", "")

    if custom_exprs:
        df = pd.DataFrame(dataset)
        for expr in str(custom_exprs).split("\n"):
            expr = expr.strip()
            if not expr: continue
            try:
                if "=" in expr:
                    col_name, formula = [part.strip() for part in expr.split("=", 1)]
                    df[col_name] = df.eval(formula)
                else:
                    col_name = expr.replace(" ", "")
                    df[col_name] = df.eval(expr)
                if col_name not in features:
                    features.append(col_name)
                logs.append(f"[衍生特征] 成功生成: {col_name}")
            except Exception as e:
                logs.append(f"[衍生特征] 警告: 公式 '{expr}' 计算失败: {e}")
        dataset = df.to_dict(orient="records")

    logs.append(f"[工业影响] 开始分析，共 {len(dataset)} 样本，{len(features)} 特征")
    
    X_train, X_test, y_train, y_test, feat_names, scaler = preprocess_dataset(
        dataset, features, target, impute, one_hot, scale, test_size
    )
    logs.append(f"[工业影响] 训练集 {len(X_train)}，验证集 {len(X_test)}，特征维度 {len(feat_names)}")

    # Main random forest
    rf = RandomForestRegressor(n_estimators=n_trees, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)
    preds = rf.predict(X_test)
    train_preds = rf.predict(X_train)
    metrics = regression_metrics(y_test, preds)
    train_metrics = regression_metrics(y_train, train_preds)
    logs.append(f"[工业影响] 模型训练完成 | 验证 R²={metrics['r2']}, RMSE={metrics['rmse']} | 训练 R²={train_metrics['r2']}")

    # SHAP importance
    logs.append("[工业影响] 计算 SHAP 特征重要度...")
    sorted_shap = compute_shap_values(rf, X_train, feat_names, "tree")
    logs.append(f"[工业影响] SHAP 计算完成, 最重要: {sorted_shap[0]['feature'] if sorted_shap else 'N/A'}")

    # Target stats
    all_X = np.vstack([X_train, X_test])
    all_y = np.concatenate([y_train, y_test])
    if len(all_y) == 0:
        overall_mean = 0.0
    else:
        overall_mean = float(np.mean(all_y))

    # Rule tree
    logs.append(f"[联合规则] 训练规则树 (深度={rule_depth})...")
    rule_tree = DecisionTreeRegressor(max_depth=rule_depth, random_state=42)
    rule_tree.fit(all_X, all_y)
    
    # Extract rules
    subset_size = min(1000, len(all_X))
    logs.append(f"[联合规则] 规则挖掘完成（使用 {subset_size} 样本)")

    joint_rules = []
    try:
        joint_rules = extract_joint_rules(rule_tree, feat_names, all_X[:subset_size], all_y[:subset_size], overall_mean, higher_better)
    except Exception as e:
        logs.append(f"[联合规则] 提取失败: {e}")
    logs.append(f"[联合规则] 发现 {len(joint_rules)} 条联合规则")

    # Decision tree interpretation
    leaf_ids = rule_tree.apply(all_X[:subset_size])
    leaf_values = rule_tree.tree_.value.flatten()
    leaf_node_counts = {}
    for lid in leaf_ids:
        leaf_node_counts[lid] = leaf_node_counts.get(lid, 0) + 1
    
    tree_interp = {
        "totalLeaves": int(rule_tree.get_n_leaves()),
        "maxDepth": int(rule_tree.get_depth()),
        "leafStats": [{"nodeId": int(k), "samples": v,
                       "meanValue": round(float(leaf_values[k]), 4) if k < len(leaf_values) else 0}
                      for k, v in leaf_node_counts.items()][:20]
    }
    logs.append(f"[决策树解读] 发现 {tree_interp['totalLeaves']} 个叶节点，最大深度 {tree_interp['maxDepth']}")

    # PDP for focus features
    focus_feats = focus if focus else [sorted_shap[0]["feature"]] if sorted_shap else feat_names[:3]
    pdp_series = []
    for feat in focus_feats[:5]:
        if feat in feat_names:
            feat_idx = feat_names.index(feat)
            try:
                pdp_result = partial_dependence(rf, all_X, features=[feat_idx], kind="average", grid_resolution=20)
                pdp_series.append({
                    "feature": feat,
                    "xValues": [round(float(v), 4) for v in pdp_result["grid_values"][0]],
                    "yValues": [round(float(v), 4) for v in pdp_result["average"][0]]
                })
            except Exception as e:
                logs.append(f"[PDP] {feat} 计算失败: {e}")

    # Warnings
    warnings = []
    if train_metrics["r2"] - metrics["r2"] > 0.15:
        warnings.append("发现过拟合倾向：训练优于验证 > 0.15")
    if metrics["r2"] < 0.3:
        warnings.append("⚠️ 致命警告：模型 R² < 0.3，当前输入的工艺参数几乎无法解释目标的波动。")
    elif metrics["r2"] < 0.5:
        warnings.append("模型解释力一般（验证 R² < 0.5），建议补充关键工况特征或增加样本量。")

    # Tables
    tables = [
        {
            "title": "📊 模型评估指标",
            "columns": ["指标", "验证集", "训练集"],
            "rows": [
                ["R² (决定系数)", metrics["r2"], train_metrics["r2"]],
                ["RMSE", metrics["rmse"], train_metrics["rmse"]],
                ["MAE", metrics["mae"], train_metrics["mae"]],
                ["样本量", len(X_test), len(X_train)]
            ]
        },
        {
            "title": "🏆 SHAP 特征重要度",
            "columns": ["排名", "特征", "|SHAP| 均值"],
            "rows": [[i+1, r["feature"], r["importance"]] for i, r in enumerate(sorted_shap[:15])]
        },
        {
            "title": "🔗 联合效应规则",
            "columns": ["规则", "平均目标值", "样本量", "效应"],
            "rows": [[r["rule"], round(r["mean"], 4), r["support"], r["effect"]] for r in joint_rules[:10]]
        },
        {
            "title": "🌳 决策树叶节点分布",
            "columns": ["叶节点", "样本数", "平均目标值"],
            "rows": [[f"叶 {s['nodeId']}", s["samples"], s["meanValue"]] for s in tree_interp["leafStats"]]
        }
    ]

    # Figures
    figures = [
        build_importance_chart(sorted_shap[:15]),
        build_tree_chart(rule_tree, feat_names),
        build_prediction_chart(y_test, preds),
        build_scatter_chart(y_test, preds),
        build_residual_chart(y_test, preds)
    ]
    
    # PDP charts
    for pdp in pdp_series:
        figures.append({
            "title": f"📈 {pdp['feature']} 对 {target} 的边缘效应 (PDP)",
            "type": "echarts",
            "option": {
                "tooltip": {"trigger": "axis"},
                "xAxis": {"type": "category", "data": [str(v) for v in pdp['xValues']], "name": pdp['feature']},
                "yAxis": {"type": "value", "name": target, "scale": True},
                "series": [{"type": "line", "data": pdp['yValues'],
                            "smooth": True, "itemStyle": {"color": "#3b82f6"},
                            "areaStyle": {"color": "rgba(59, 130, 246, 0.1)"}}],
                "grid": {"left": "10%", "right": "10%", "top": 50, "bottom": 50, "containLabel": True}
            }
        })

    return {
        "tables": tables,
        "figures": figures,
        "warnings": warnings,
        "logs": logs,
        "assumptions": [f"缺失值: {impute}", f"缩放: {scale}", f"树数量: {n_trees}"],
        "narrative": f"工业影响分析 | R²={metrics['r2']}，最重要工艺参数: {sorted_shap[0]['feature'] if sorted_shap else 'N/A'}",
        "citation": "Breiman, L. (2001). Random Forests",
        "extras": {
            "treeInterpretation": tree_interp,
            "pdpSeries": pdp_series,
            "jointRules": joint_rules[:10],
            "modelMetrics": metrics
        }
    }


def extract_joint_rules(tree, feat_names, X, y, overall_mean, higher_better):
    """Extract joint rules from decision tree leaves."""
    tree_ = tree.tree_
    feature = tree_.feature
    threshold = tree_.threshold
    n_node_samples = tree_.n_node_samples
    value = tree_.value

    rules = []

    def recurse(node, conditions):
        if feature[node] == -2:  # leaf
            leaf_mean = float(value[node][0][0])
            support = int(n_node_samples[node])
            if support < 5:
                return
            effect = leaf_mean - overall_mean
            if abs(effect) < 0.01 * abs(overall_mean) and abs(overall_mean) > 0:
                return
            direction = "↑ 有益" if (effect > 0 and higher_better) or (effect < 0 and not higher_better) else "↓ 不利"
            rules.append({
                "rule": " AND ".join(conditions) if conditions else "(根节点)",
                "mean": leaf_mean,
                "support": support,
                "effect": f"{'+' if effect >= 0 else ''}{round(effect, 4)} {direction}"
            })
        else:
            fname = feat_names[feature[node]] if feature[node] < len(feat_names) else f"feat{feature[node]}"
            thresh = round(float(threshold[node]), 4)
            # Use sklearn's internal children arrays for safe traversal
            recurse(tree_.children_left[node], conditions + [f"{fname} ≤ {thresh}"])
            recurse(tree_.children_right[node], conditions + [f"{fname} > {thresh}"])

    recurse(0, [])
    rules.sort(key=lambda r: abs(float(r["effect"].split()[0].replace("↑", "").replace("↓", "").replace("有益", "").replace("不利", "").strip() or "0")), reverse=True)
    return rules[:15]
