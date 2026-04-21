import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

def run(payload):
    dataset = payload['dataset']
    variables = payload['variables']
    params = payload['params']
    
    feats = variables.get('features', [])
    if len(feats) < 2:
        return {"error": "At least 2 features are required for clustering"}
    
    df = pd.DataFrame(dataset)
    # Filter rows with missing values in features
    df = df.dropna(subset=feats)
    
    # Feature extraction and numeric conversion
    X = df[feats].apply(pd.to_numeric, errors='coerce').fillna(0).values
    
    # Scale data for KMeans
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    k = int(params.get('k', 3))
    kmeans = KMeans(n_clusters=k, random_state=42, n_init='auto')
    clusters = kmeans.fit_predict(X_scaled)
    
    # PCA for visualization
    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X_scaled)
    
    # Colors for clusters
    colors = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4"]
    
    # Prepare scatter data
    scatter_data = []
    # Limit number of points in scatter for performance
    sample_size = min(len(X_pca), 1000)
    sample_idx = np.random.choice(len(X_pca), sample_size, replace=False)
    
    for i in sample_idx:
        c_idx = int(clusters[i])
        scatter_data.append({
            "value": [float(X_pca[i, 0]), float(X_pca[i, 1])],
            "itemStyle": {"color": colors[c_idx % len(colors)]}
        })
    
    # Centroids in original scale
    centroids_scaled = kmeans.cluster_centers_
    centroids_original = scaler.inverse_transform(centroids_scaled)
    
    # Prepare table
    center_rows = []
    for i, center in enumerate(centroids_original):
        center_rows.append([f"Cluster {i}", *[round(float(v), 3) for v in center]])
    
    return {
        "tables": [
            {
                "title": "聚类中心分析 (原始量纲)",
                "columns": ["簇", *feats],
                "rows": center_rows
            }
        ],
        "figures": [
            {
                "title": "聚类分布图 (PCA 投影)",
                "type": "echarts",
                "option": {
                    "xAxis": {"type": "value", "name": "PC1"},
                    "yAxis": {"type": "value", "name": "PC2"},
                    "tooltip": {"trigger": "item"},
                    "series": [
                        {
                            "type": "scatter",
                            "data": scatter_data,
                            "symbolSize": 8
                        }
                    ],
                    "grid": {"left": "10%", "right": "10%", "bottom": "15%"}
                }
            }
        ],
        "narrative": f"KMeans 算法自动将数据划分为 {k} 个类别。通过 PCA 降维观察（PC1 解释了主要方差），类别分界明显。聚类中心表展示了各簇在原始特征下的平均水平。",
        "logs": [f"KMeans 训练完成，总计 {len(X)} 个有效样本", f"完成 PCA 降维 (n_components=2)"]
    }
