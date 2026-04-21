# Mockup: Industrial Data Health & Lineage View

This mockup demonstrates the "Data Health Dashboard" and "Data Provenance" features as proposed in the CEO Strategic Review.

## 1. Data Health View (Preview Mode: 'Health')

```html
<div class="data-health-container" style="display: grid; grid-template-columns: 1fr 2fr; gap: 24px; padding: 24px; background: #f8f9fa;">
  
  <!-- Left Side: Health Summary -->
  <div class="health-summary-panel" style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #eee;">
    <h3 style="margin-top: 0; font-size: 16px; color: #1a1a1a; display: flex; align-items: center; gap: 8px;">
      <i class="lucide-activity" style="color: #ff9a00;"></i> 数据健康评分 (Health Score)
    </h3>
    <div class="health-gauge" style="text-align: center; padding: 30px 0;">
      <div style="font-size: 56px; font-weight: 800; color: #52c41a;">92<span style="font-size: 18px; color: #8c8c8c;">/100</span></div>
      <div style="font-size: 14px; color: #52c41a; font-weight: 600; margin-top: 8px;">
        <i class="lucide-trending-up"></i> 极佳 (Excellent)
      </div>
    </div>
    
    <div class="quality-metrics" style="margin-top: 24px;">
      <div class="metric-row" style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px;">
        <span style="color: #606060;">完整度 (Completeness)</span>
        <span style="font-weight: 600;">99.8%</span>
      </div>
      <div style="height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; margin-bottom: 20px;">
        <div style="width: 99.8%; height: 100%; background: #52c41a;"></div>
      </div>
      
      <div class="metric-row" style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px;">
        <span style="color: #606060;">一致性 (Consistency)</span>
        <span style="font-weight: 600;">94.2%</span>
      </div>
      <div style="height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; margin-bottom: 20px;">
        <div style="width: 94.2%; height: 100%; background: #1890ff;"></div>
      </div>

       <div class="metric-row" style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px;">
        <span style="color: #606060;">有效性 (Validity)</span>
        <span style="font-weight: 600;">88.5%</span>
      </div>
      <div style="height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden;">
        <div style="width: 88.5%; height: 100%; background: #ff9a00;"></div>
      </div>
    </div>
  </div>

  <!-- Right Side: Distribution & Correlation Preview -->
  <div class="health-details-grid" style="display: grid; grid-template-rows: auto 1fr; gap: 24px;">
    
    <!-- Correlation Heatmap Preview -->
    <div class="card" style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #eee;">
      <h3 style="margin: 0 0 16px 0; font-size: 15px; font-weight: 600;">关键特征相关性 (Correlation Matrix)</h3>
      <div class="heatmap-placeholder" style="height: 200px; background: #fafafa; border-radius: 8px; display: grid; grid-template-columns: repeat(6, 1fr); grid-template-rows: repeat(6, 1fr); gap: 2px;">
        <!-- Mock Heatmap Blocks -->
        <div style="background: rgba(24,144,255,1);"></div><div style="background: rgba(24,144,255,0.6);"></div><div style="background: rgba(24,144,255,0.2);"></div><div style="background: rgba(24,144,255,0.1);"></div><div style="background: rgba(24,144,255,0.05);"></div><div style="background: rgba(24,144,255,0.01);"></div>
        <div style="background: rgba(24,144,255,0.6);"></div><div style="background: rgba(24,144,255,1);"></div><div style="background: rgba(24,144,255,0.4);"></div><div style="background: rgba(24,144,255,0.1);"></div><div style="background: rgba(24,144,255,0.02);"></div><div style="background: rgba(24,144,255,0.01);"></div>
        <div style="background: rgba(24,144,255,0.2);"></div><div style="background: rgba(24,144,255,0.4);"></div><div style="background: rgba(24,144,255,1);"></div><div style="background: rgba(24,144,255,0.2);"></div><div style="background: rgba(24,144,255,0.05);"></div><div style="background: rgba(24,144,255,0.02);"></div>
        <div style="background: rgba(24,144,255,0.1);"></div><div style="background: rgba(24,144,255,0.1);"></div><div style="background: rgba(24,144,255,0.2);"></div><div style="background: rgba(24,144,255,1);"></div><div style="background: rgba(24,144,255,0.3);"></div><div style="background: rgba(24,144,255,0.1);"></div>
        <div style="background: rgba(24,144,255,0.05);"></div><div style="background: rgba(24,144,255,0.02);"></div><div style="background: rgba(24,144,255,0.05);"></div><div style="background: rgba(24,144,255,0.3);"></div><div style="background: rgba(24,144,255,1);"></div><div style="background: rgba(24,144,255,0.4);"></div>
        <div style="background: rgba(24,144,255,0.01);"></div><div style="background: rgba(24,144,255,0.01);"></div><div style="background: rgba(24,144,255,0.02);"></div><div style="background: rgba(24,144,255,0.1);"></div><div style="background: rgba(24,144,255,0.4);"></div><div style="background: rgba(24,144,255,1);"></div>
      </div>
    </div>

    <!-- Feature Distributions -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="card" style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #eee;">
        <div style="font-size: 13px; font-weight: 600; color: #606060; margin-bottom: 12px;">温度 (Temperature) 分布</div>
        <div style="height: 80px; display: flex; align-items: flex-end; gap: 4px;">
           <div style="flex: 1; background: #1890ff; opacity: 0.2; height: 30%;"></div>
           <div style="flex: 1; background: #1890ff; opacity: 0.4; height: 50%;"></div>
           <div style="flex: 1; background: #1890ff; opacity: 0.8; height: 90%;"></div>
           <div style="flex: 1; background: #1890ff; opacity: 1; height: 100%;"></div>
           <div style="flex: 1; background: #1890ff; opacity: 0.8; height: 80%;"></div>
           <div style="flex: 1; background: #1890ff; opacity: 0.4; height: 40%;"></div>
           <div style="flex: 1; background: #1890ff; opacity: 0.1; height: 10%;"></div>
        </div>
      </div>
      <div class="card" style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #eee;">
        <div style="font-size: 13px; font-weight: 600; color: #606060; margin-bottom: 12px;">压力 (Pressure) 分布</div>
        <div style="height: 80px; display: flex; align-items: flex-end; gap: 4px;">
           <div style="flex: 1; background: #52c41a; opacity: 0.1; height: 10%;"></div>
           <div style="flex: 1; background: #52c41a; opacity: 0.3; height: 40%;"></div>
           <div style="flex: 1; background: #52c41a; opacity: 0.6; height: 60%;"></div>
           <div style="flex: 1; background: #52c41a; opacity: 1; height: 90%;"></div>
           <div style="flex: 1; background: #52c41a; opacity: 0.7; height: 100%;"></div>
           <div style="flex: 1; background: #52c41a; opacity: 0.2; height: 30%;"></div>
           <div style="flex: 1; background: #52c41a; opacity: 0.1; height: 5%;"></div>
        </div>
      </div>
    </div>
  </div>
</div>
```

## 2. Data Provenance (Workflow Lineage)

```html
<div class="provenance-panel" style="padding: 20px;">
  <div class="lineage-path" style="display: flex; align-items: center; gap: 16px;">
    <!-- Origin -->
    <div class="lineage-node" style="text-align: center;">
      <div style="width: 48px; height: 48px; background: #e6f7ff; border: 1.5px solid #91d5ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #1890ff;">
        <i class="lucide-database"></i>
      </div>
      <div style="font-size: 11px; margin-top: 4px; color: #8c8c8c;">MES_Export.csv</div>
    </div>
    
    <i class="lucide-arrow-right" style="color: #bfbfbf;"></i>
    
    <!-- Step 1: Cleaning -->
    <div class="lineage-node" style="text-align: center;">
      <div style="width: 40px; height: 40px; border: 1px dashed #d9d9d9; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #595959;">
        <i class="lucide-filter" style="font-size: 14px;"></i>
      </div>
      <div style="font-size: 10px; margin-top: 4px; color: #8c8c8c;">数据清洗</div>
    </div>

    <i class="lucide-arrow-right" style="color: #bfbfbf;"></i>
    
    <!-- Step 2: Feature Eng -->
    <div class="lineage-node" style="text-align: center;">
      <div style="width: 40px; height: 40px; border: 1px dashed #d9d9d9; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #595959;">
        <i class="lucide-zap" style="font-size: 14px;"></i>
      </div>
      <div style="font-size: 10px; margin-top: 4px; color: #8c8c8c;">特征工程</div>
    </div>

    <i class="lucide-arrow-right" style="color: #bfbfbf;"></i>

    <!-- Current Version -->
    <div class="lineage-node" style="text-align: center;">
      <div style="width: 48px; height: 48px; background: #fff7e6; border: 1.5px solid #ffd591; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fa8c16;">
        <i class="lucide-file-text"></i>
      </div>
      <div style="font-size: 11px; font-weight: 600; margin-top: 4px; color: #fa8c16;">当前版本 (V3)</div>
    </div>
  </div>
</div>
```
