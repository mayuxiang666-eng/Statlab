"""Decision Tree Classifier using scikit-learn."""
import numpy as np
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.model_selection import cross_val_score
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from utils import preprocess_dataset
import pandas as pd


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
    scale = params.get("scale", "none")
    test_size = float(params.get("testSize", 0.3))
    max_depth = int(params.get("maxDepth", 5))
    cv_folds = int(params.get("cv", 0))

    logs.append(f"[决策树] 开始预处理，共 {len(dataset)} 样本，{len(features)} 特征...")

    # For classification, target is categorical
    df = pd.DataFrame(dataset)
    feat_cols = [f for f in features if f in df.columns]
    
    # Impute numeric features
    feat_df = df[feat_cols].copy()
    for col in feat_cols:
        s = pd.to_numeric(feat_df[col], errors="coerce")
        if s.isna().all():
            feat_df[col] = 0
        elif impute == "mean":
            feat_df[col] = s.fillna(s.mean())
        elif impute == "median":
            feat_df[col] = s.fillna(s.median())
        else:
            feat_df[col] = s.fillna(0)

    y_raw = df[target].dropna()
    valid_idx = feat_df.dropna().index.intersection(y_raw.index)
    X = feat_df.loc[valid_idx].values.astype(float)
    y_str = df[target].loc[valid_idx].astype(str).values

    labels = sorted(set(y_str))
    label_map = {l: i for i, l in enumerate(labels)}
    y = np.array([label_map[v] for v in y_str])

    logs.append(f"[决策树] 有效样本: {len(y)}，类别: {', '.join(labels)}")

    # Split
    from sklearn.model_selection import train_test_split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
    logs.append(f"[决策树] 训练集: {len(X_train)}，测试集: {len(X_test)}，最大深度: {max_depth}")

    dt = DecisionTreeClassifier(max_depth=max_depth, random_state=42)
    dt.fit(X_train, y_train)
    preds = dt.predict(X_test)
    acc = round(float(accuracy_score(y_test, preds)), 4)
    logs.append(f"[决策树] 训练完成 | 准确率: {acc}")

    # Feature importance
    fi = dt.feature_importances_
    feat_imp = sorted(zip(feat_cols, fi), key=lambda x: -x[1])

    # Confusion matrix
    cm = confusion_matrix(y_test, preds, labels=list(range(len(labels)))).tolist()
    
    # Tree text
    tree_text = export_text(dt, feature_names=feat_cols, max_depth=5)

    # Leaf analysis (sample counts per leaf)
    leaf_ids = dt.apply(X_test)
    from collections import Counter
    leaf_counts = Counter(leaf_ids.tolist())
    leaf_rows = [[f"叶节点 {k}", v] for k, v in sorted(leaf_counts.items())]

    # Cross validation
    cv_rows = []
    cv_mean = 0
    if cv_folds >= 2:
        scores = cross_val_score(DecisionTreeClassifier(max_depth=max_depth, random_state=42),
                                 X_train, y_train, cv=cv_folds, scoring="accuracy")
        cv_mean = round(float(scores.mean()), 3)
        cv_rows = [[f"第 {i+1} 折", round(float(s), 4)] for i, s in enumerate(scores)]
        logs.append(f"[决策树] 交叉验证完成 | 平均准确率={cv_mean}")

    tables = [
        {
            "title": "📊 分类评估指标",
            "columns": ["指标", "值"],
            "rows": [["准确率 (Accuracy)", acc], ["叶节点总数", dt.get_n_leaves()], ["树深度", dt.get_depth()]]
        },
        {
            "title": "🏆 特征重要度",
            "columns": ["特征", "重要度"],
            "rows": [[f, round(float(v), 6)] for f, v in feat_imp]
        },
        {
            "title": "📋 混淆矩阵",
            "columns": ["实际\\预测"] + labels,
            "rows": [[labels[i]] + row for i, row in enumerate(cm)]
        },
        {
            "title": "🍃 叶节点样本分布",
            "columns": ["叶节点", "样本数"],
            "rows": leaf_rows
        }
    ]
    if cv_rows:
        tables.append({"title": f"🔁 {cv_folds} 折交叉验证 (平均准确率={cv_mean})",
                       "columns": ["折次", "准确率"], "rows": cv_rows})

    # Feature importance bar chart
    figures = [
        {
            "title": "🏆 特征重要度",
            "type": "echarts",
            "option": {
                "tooltip": {},
                "xAxis": {"type": "value"},
                "yAxis": {"type": "category", "data": [f for f, _ in reversed(feat_imp)]},
                "series": [{"type": "bar", "data": [round(float(v), 6) for _, v in reversed(feat_imp)],
                            "itemStyle": {"color": "#a371f7"}}],
                "grid": {"left": 120, "right": 30, "top": 10, "bottom": 30}
            }
        },
        {
            "title": "📋 混淆矩阵热图",
            "type": "echarts",
            "option": {
                "tooltip": {"formatter": "{b}"},
                "xAxis": {"type": "category", "data": labels, "name": "预测"},
                "yAxis": {"type": "category", "data": labels, "name": "实际"},
                "visualMap": {"min": 0, "max": max(max(row) for row in cm) if cm else 1,
                              "calculable": True, "inRange": {"color": ["#f0f4ff", "#3b82f6"]}},
                "series": [{"type": "heatmap", "data": [[j, i, cm[i][j]] for i in range(len(labels)) for j in range(len(labels))],
                            "label": {"show": True}}],
                "grid": {"left": 80, "right": 40, "top": 30, "bottom": 60}
            }
        }
    ]

    return {
        "tables": tables,
        "figures": figures,
        "warnings": [] if acc >= 0.7 else ["准确率低于 70%，可能需要更多数据或特征调整"],
        "logs": logs,
        "assumptions": [f"缺失值: {impute}填补"],
        "narrative": f"决策树分类 | 准确率={acc}，树深度={dt.get_depth()}，叶节点={dt.get_n_leaves()}",
        "citation": "Breiman, L. et al. (1984). Classification and regression trees.",
        "extras": {"treeText": tree_text[:3000]}
    }
