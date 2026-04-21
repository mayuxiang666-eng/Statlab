"""Random Forest Classifier using scikit-learn."""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from utils import compute_shap_values


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
    test_size = float(params.get("testSize", 0.3))
    n_trees = int(params.get("trees", 100))
    cv_folds = int(params.get("cv", 0))

    df = pd.DataFrame(dataset)
    feat_cols = [f for f in features if f in df.columns]

    feat_df = df[feat_cols].copy()
    numeric_feats, categorical_feats = [], []
    for col in feat_cols:
        try:
            feat_df[col] = pd.to_numeric(feat_df[col], errors="raise")
            numeric_feats.append(col)
        except Exception:
            categorical_feats.append(col)

    for col in numeric_feats:
        s = pd.to_numeric(feat_df[col], errors="coerce")
        if s.isna().all():
            feat_df[col] = 0
        elif impute == "mean":
            feat_df[col] = s.fillna(s.mean())
        elif impute == "median":
            feat_df[col] = s.fillna(s.median())
        else:
            feat_df[col] = s.fillna(0)

    all_feat_names = list(numeric_feats)
    if one_hot and categorical_feats:
        dummies = pd.get_dummies(feat_df[categorical_feats], dtype=float)
        feat_df = pd.concat([feat_df[numeric_feats], dummies], axis=1)
        all_feat_names = list(feat_df.columns)

    y_str = df[target].astype(str).values
    labels = sorted(set(y_str))
    label_map = {l: i for i, l in enumerate(labels)}
    y = np.array([label_map.get(v, 0) for v in y_str])
    X = feat_df.values.astype(float)

    logs.append(f"[RF分类] 共 {len(y)} 样本，类别: {', '.join(labels)}")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
    logs.append(f"[RF分类] 训练集: {len(X_train)}，测试集: {len(X_test)}")

    rf = RandomForestClassifier(n_estimators=n_trees, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)
    preds = rf.predict(X_test)
    acc = round(float(accuracy_score(y_test, preds)), 4)
    cm = confusion_matrix(y_test, preds, labels=list(range(len(labels)))).tolist()
    logs.append(f"[RF分类] 训练完成 | 准确率: {acc}")

    sorted_shap = compute_shap_values(rf, X_train, all_feat_names, "tree")

    cv_rows = []
    cv_mean = 0
    if cv_folds >= 2:
        scores = cross_val_score(RandomForestClassifier(n_estimators=min(n_trees, 30), random_state=42, n_jobs=-1),
                                 X_train, y_train, cv=cv_folds, scoring="accuracy")
        cv_mean = round(float(scores.mean()), 3)
        cv_rows = [[f"第 {i+1} 折", round(float(s), 4)] for i, s in enumerate(scores)]

    tables = [
        {"title": "📊 分类评估指标", "columns": ["指标", "值"], "rows": [["准确率", acc], ["样本量", len(y)], ["类别数", len(labels)]]},
        {"title": "🏆 特征重要度 (SHAP)", "columns": ["排名", "特征", "|SHAP| 均值"],
         "rows": [[i+1, r["feature"], r["importance"]] for i, r in enumerate(sorted_shap)]},
        {"title": "📋 混淆矩阵", "columns": ["实际\\预测"] + labels,
         "rows": [[labels[i]] + row for i, row in enumerate(cm)]}
    ]
    if cv_rows:
        tables.append({"title": f"🔁 {cv_folds} 折交叉验证 (平均准确率={cv_mean})",
                       "columns": ["折次", "准确率"], "rows": cv_rows})

    figures = [
        {
            "title": "🏆 特征重要度 (SHAP)",
            "type": "echarts",
            "option": {
                "tooltip": {},
                "xAxis": {"type": "value"},
                "yAxis": {"type": "category", "data": [r["feature"] for r in reversed(sorted_shap[:15])]},
                "series": [{"type": "bar", "data": [r["importance"] for r in reversed(sorted_shap[:15])],
                            "itemStyle": {"color": "#a371f7"}}],
                "grid": {"left": 120, "right": 30, "top": 10, "bottom": 30}
            }
        },
        {
            "title": "📋 混淆矩阵热图",
            "type": "echarts",
            "option": {
                "xAxis": {"type": "category", "data": labels, "name": "预测"},
                "yAxis": {"type": "category", "data": labels, "name": "实际"},
                "visualMap": {"min": 0, "max": max(max(r) for r in cm) if cm else 1,
                              "inRange": {"color": ["#f0f4ff", "#3b82f6"]}},
                "series": [{"type": "heatmap", "data": [[j, i, cm[i][j]] for i in range(len(labels)) for j in range(len(labels))],
                            "label": {"show": True}}],
                "grid": {"left": 80, "right": 40, "top": 30, "bottom": 60}
            }
        }
    ]

    return {
        "tables": tables, "figures": figures, "warnings": [] if acc >= 0.7 else ["准确率低于 70%"],
        "logs": logs, "assumptions": [f"缺失值: {impute}填补"],
        "narrative": f"随机森林分类 | 准确率={acc}，{len(labels)} 个类别",
        "citation": "Breiman, L. (2001). Random Forests"
    }
