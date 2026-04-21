import numpy as np
import pandas as pd
from scipy import stats

def calculate_cpk(df, target_col, usl=None, lsl=None, subgroup_size=1):
    """
    Calculate Process Capability Indices (Cp, Cpk, Pp, Ppk)
    """
    data = df[target_col].dropna().values
    if len(data) < 2:
        return {"error": "Insufficient data (need at least 2 points)"}
    
    mu = np.mean(data)
    # Overall standard deviation (for Pp/Ppk)
    sigma_total = np.std(data, ddof=1)
    
    # Within-subgroup standard deviation (for Cp/Cpk)
    # Simple estimate if subgroup_size=1: use moving range
    if subgroup_size <= 1:
        # Moving Range estimate: MR_bar / d2(2) where d2(2) = 1.128
        mr = np.abs(np.diff(data))
        sigma_within = np.mean(mr) / 1.128
    else:
        # Pooled standard deviation for subgroups
        reshaped = data[:(len(data)//subgroup_size)*subgroup_size].reshape(-1, subgroup_size)
        subgroup_stds = np.std(reshaped, axis=1, ddof=1)
        sigma_within = np.sqrt(np.mean(subgroup_stds**2))

    results = {
        "mean": float(mu),
        "sigma_total": float(sigma_total),
        "sigma_within": float(sigma_within),
        "usl": usl,
        "lsl": lsl,
        "n": len(data)
    }

    # Cp / Cpk (Potential / Within)
    if usl is not None and lsl is not None:
        results["cp"] = float((usl - lsl) / (6 * sigma_within))
        cpu = (usl - mu) / (3 * sigma_within)
        cpl = (mu - lsl) / (3 * sigma_within)
        results["cpk"] = float(min(cpu, cpl))
        results["cpu"] = float(cpu)
        results["cpl"] = float(cpl)
    elif usl is not None:
        results["cpk"] = float((usl - mu) / (3 * sigma_within))
    elif lsl is not None:
        results["cpk"] = float((mu - lsl) / (3 * sigma_within))

    # Pp / Ppk (Overall)
    if usl is not None and lsl is not None:
        results["pp"] = float((usl - lsl) / (6 * sigma_total))
        ppu = (usl - mu) / (3 * sigma_total)
        ppl = (mu - lsl) / (3 * sigma_total)
        results["ppk"] = float(min(ppu, ppl))
    elif usl is not None:
        results["ppk"] = float((usl - mu) / (3 * sigma_total))
    elif lsl is not None:
        results["ppk"] = float((mu - lsl) / (3 * sigma_total))

    # Normality Test (Shapiro-Wilk)
    if len(data) >= 3:
        stat, p = stats.shapiro(data)
        results["normality"] = {"p_value": float(p), "is_normal": p > 0.05}
    
    # Yield Estimation (using Ppk/sigma_total for actual fallout)
    if usl is not None and lsl is not None:
        p_total = stats.norm.cdf(usl, mu, sigma_total) - stats.norm.cdf(lsl, mu, sigma_total)
        results["yield"] = float(p_total)
        results["ppm"] = float((1 - p_total) * 1e6)
    
    # Sigma Level (Z-score)
    if "yield" in results:
        results["sigma_level"] = float(stats.norm.ppf(results["yield"]) + 1.5) # +1.5 for industrial shift

    # Auto Insights
    insights = []
    if results.get("cp", 0) > 1.33 and results.get("cpk", 0) < 1.0:
        insights.append("过程受控且波动较小(Cp高)，但均值显著偏离中心(Cpk低)，建议通过调机纠偏。")
    elif results.get("cp", 0) < 1.0:
        insights.append("过程自身能力不足(基于波动)，建议通过DOE寻找变异源或更新工艺。")
    
    if results.get("normality", {}).get("is_normal") == False:
        insights.append("数据呈现非正态分布，以上指数仅供参考，建议检查是否存在异常点或进行数据变换。")
    
    if results.get("cpk", 0) < 1.33:
        insights.append("当前过程能力评价为：不足或临界。建议加严监控相关工序。")
    else:
        insights.append("过程能力优秀，维持当前管控水平即可。")
        
    results["insights"] = insights
    return results
