import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from utils import regression_metrics

def run(payload: dict) -> dict:
    dataset = payload["dataset"]
    variables = payload["variables"]
    params = payload.get("params", {})
    logs = []

    target = variables.get("target", [None])[0]
    time_var = variables.get("time", [None])[0]
    
    if not target:
        raise ValueError("缺少目标变量 (target)")

    # parse dataset
    df = pd.DataFrame(dataset)
    df = df.dropna(subset=[target])
    
    if time_var and time_var in df.columns:
        # Sort by time
        df[time_var] = pd.to_datetime(df[time_var], errors="ignore")
        df = df.sort_values(by=time_var)
        times = df[time_var].apply(str).tolist()
    else:
        times = [str(i) for i in range(len(df))]
        
    y = df[target].values

    p = int(params.get("p", 1))
    d = int(params.get("d", 1))
    q = int(params.get("q", 1))
    steps = int(params.get("steps", 10))

    logs.append(f"[ARIMA] 模型参数: p={p}, d={d}, q={q}")
    logs.append(f"[ARIMA] 目标变量 {target} 有效样本数: {len(y)}")

    model = ARIMA(y, order=(p, d, q))
    model_fit = model.fit()

    logs.append(f"[ARIMA] 拟合完成。AIC: {model_fit.aic:.2f}, BIC: {model_fit.bic:.2f}")

    forecast = model_fit.forecast(steps=steps)
    prediction_train = model_fit.predict(start=0, end=len(y)-1)
    
    metrics = regression_metrics(y, prediction_train)

    tables = [
        {
            "title": "📊 训练集评估指标",
            "columns": ["指标", "数值"],
            "rows": [
                ["AIC", round(model_fit.aic, 2)],
                ["BIC", round(model_fit.bic, 2)],
                ["RMSE", metrics["rmse"]],
                ["MAE", metrics["mae"]]
            ]
        },
        {
            "title": "📅 预测结果",
            "columns": ["预测步数", "预测值"],
            "rows": [[f"+{i+1}", round(float(v), 4)] for i, v in enumerate(forecast)]
        }
    ]

    # Future dates if possible
    future_times = [f"t+{i+1}" for i in range(steps)]

    figures = [
        {
            "title": "📈 ARIMA 预测走势",
            "type": "echarts",
            "option": {
                "tooltip": {"trigger": "axis"},
                "legend": {"data": ["真实值", "训练拟合", "未来预测"]},
                "xAxis": {"type": "category", "data": times + future_times},
                "yAxis": {"type": "value"},
                "series": [
                    {
                        "name": "真实值",
                        "type": "line",
                        "data": [round(float(v), 4) for v in y] + [None]*steps,
                        "itemStyle": {"color": "#3b82f6"}
                    },
                    {
                        "name": "训练拟合",
                        "type": "line",
                        "data": [round(float(v), 4) for v in prediction_train] + [None]*steps,
                        "itemStyle": {"color": "#f59e0b"},
                        "lineStyle": {"type": "dashed"}
                    },
                    {
                        "name": "未来预测",
                        "type": "line",
                        "data": [None]*len(y) + [round(float(v), 4) for v in forecast],
                        "itemStyle": {"color": "#10b981"},
                        "lineStyle": {"width": 3}
                    }
                ],
                "dataZoom": [{"type": "inside"}, {"type": "slider"}],
                "grid": {"left": 50, "right": 50, "top": 40, "bottom": 70}
            }
        }
    ]

    return {
        "tables": tables,
        "figures": figures,
        "warnings": [],
        "logs": logs,
        "assumptions": [f"使用 ARIMA({p},{d},{q})", f"有效样本数={len(y)}"],
        "narrative": f"针对 {target} 的 ARIMA({p},{d},{q}) 模型，AIC={model_fit.aic:.2f}，预测了未来 {steps} 步的走势。",
        "citation": "Box, G. E. P., & Jenkins, G. M. (1970). Time Series Analysis: Forecasting and Control."
    }
