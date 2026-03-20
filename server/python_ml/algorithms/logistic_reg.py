"""Logistic Regression using scikit-learn."""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix, roc_auc_score
from sklearn.preprocessing import label_binarize
from utils import preprocess_dataset


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
    C = float(params.get("C", 1.0))
    max_iter = int(params.get("maxIter", 200))
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

    feat_names = list(numeric_feats)
    if one_hot and categorical_feats:
        dummies = pd.get_dummies(feat_df[categorical_feats], dtype=float)
        feat_df = pd.concat([feat_df[numeric_feats], dummies], axis=1)
        feat_names = list(feat_df.columns)

    from sklearn.preprocessing import StandardScaler, MinMaxScaler
    X = feat_df.values.astype(float)
    scaler = None
    if scale == "standard":
        scaler = StandardScaler(); X = scaler.fit_transform(X)
    elif scale == "minmax":
        scaler = MinMaxScaler(); X = scaler.fit_transform(X)

    y_str = df[target].astype(str).values
    labels = sorted(set(y_str))
    label_map = {l: i for i, l in enumerate(labels)}
    y = np.array([label_map.get(v, 0) for v in y_str])

    logs.append(f"[Logistic] 共 {len(y)} 样本，类别: {', '.join(labels)}")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
    logs.append(f"[Logistic] 训练集: {len(X_train)}，测试集: {len(X_test)}")

    model = LogisticRegression(C=C, max_iter=max_iter, random_state=42, multi_class="auto")
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    proba = model.predict_proba(X_test)
    acc = round(float(accuracy_score(y_test, preds)), 4)
    cm = confusion_matrix(y_test, preds, labels=list(range(len(labels)))).tolist()
    logs.append(f"[Logistic] 训练完成 | 准确率: {acc}")

    # AUC
    try:
        if len(labels) == 2:
            auc = round(float(roc_auc_score(y_test, proba[:, 1])), 4)
        else:
            y_bin = label_binarize(y_test, classes=list(range(len(labels))))
            auc = round(float(roc_auc_score(y_bin, proba, multi_class="ovr")), 4)
    except Exception:
        auc = "N/A"

    # Coefficients
    coefs = model.coef_
    if len(labels) == 2:
        coef_list = list(zip(feat_names, coefs[0].tolist()))
    else:
        coef_list = [(f, float(np.mean([coefs[i][j] for i in range(len(labels))])))
                     for j, f in enumerate(feat_names)]
    coef_list = sorted(coef_list, key=lambda x: -abs(x[1]))

    cv_rows = []
    cv_mean = 0
    if cv_folds >= 2:
        scores = cross_val_score(LogisticRegression(C=C, max_iter=max_iter, random_state=42),
                                 X_train, y_train, cv=cv_folds, scoring="accuracy")
        cv_mean = round(float(scores.mean()), 3)
        cv_rows = [[f"第 {i+1} 折", round(float(s), 4)] for i, s in enumerate(scores)]

    tables = [
        {"title": "📊 分类评估指标", "columns": ["指标", "值"],
         "rows": [["准确率", acc], ["AUC", auc], ["正则化强度 C", C], ["训练迭代次数", max_iter]]},
        {"title": "📋 回归系数 (|系数| 排序)", "columns": ["特征", "系数"],
         "rows": [[f, round(c, 6)] for f, c in coef_list]},
        {"title": "📋 混淆矩阵", "columns": ["实际\\预测"] + labels,
         "rows": [[labels[i]] + row for i, row in enumerate(cm)]}
    ]
    if cv_rows:
        tables.append({"title": f"🔁 {cv_folds} 折交叉验证", "columns": ["折次", "准确率"], "rows": cv_rows})

    figures = [
        {
            "title": "📊 系数重要度",
            "type": "echarts",
            "option": {
                "tooltip": {},
                "xAxis": {"type": "value"},
                "yAxis": {"type": "category", "data": [f for f, _ in reversed(coef_list[:15])]},
                "series": [{"type": "bar", "data": [round(c, 6) for _, c in reversed(coef_list[:15])],
                            "itemStyle": {"color": "#3b82f6"}}],
                "grid": {"left": 120, "right": 30, "top": 10, "bottom": 30}
            }
        }
    ]

    return {
        "tables": tables, "figures": figures,
        "warnings": [] if acc >= 0.7 else ["准确率低于 70%，建议增加特征或数据"],
        "logs": logs, "assumptions": [f"缺失值: {impute}填补", f"缩放: {scale}", f"C={C}"],
        "narrative": f"Logistic 回归 | 准确率={acc}，AUC={auc}",
        "citation": "Cox, D.R. (1958). The Regression Analysis of Binary Sequences"
    }
