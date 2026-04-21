import re

path = r"d:\statlab\deploy_bundle\client\src\PracticalLabs.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update scenarios with Missions
new_scenarios = """const PRACTICAL_SCENARIOS = [
  {
    id: 'motor_vibration',
    x: 400, y: 40,
    title: '电机振动异常预警实战',
    icon: 'Zap',
    difficulty: 'Intermediate',
    duration: '30 min',
    branch: 'ml',
    requires: '系统入门',
    mission: '任务：3号生产线电机运行不稳，请利用时序信号检测预测性维护关键点。',
    desc: '处理时序振动信号，提取频域特征，训练异常检测模型以实现提前 2 小时故障预警。',
    skills: ['FFT 变换', 'Isolation Forest', '时序滑动窗口'],
    status: 'completed',
    next: ['yield_opt', 'deep_fault']
  },
  {
    id: 'yield_opt',
    x: 200, y: 230,
    title: 'A-Line 涂装产线良率根因分析',
    icon: 'Target',
    difficulty: 'Advanced',
    duration: '45 min',
    branch: 'stats',
    requires: '线性回归基础',
    mission: '急诊：涂装车间良率环比下降 5%，请找出影响薄膜均匀度的核心工艺变量。',
    desc: '基于涂装车间 30 天的传感器数据，分析温度、湿度与涂层厚度对良率的影响，并找出最优工艺区间。',
    skills: ['多元逐步回归', '中继效应分析', '工艺参数优化'],
    status: 'ready',
    next: ['stock_demand']
  },
  {
    id: 'deep_fault',
    x: 600, y: 230,
    title: '基于 CNN 的轴承损伤分类',
    icon: 'Brain',
    difficulty: 'Advanced',
    duration: '50 min',
    branch: 'dl',
    requires: '神经网络基础',
    mission: '挑战：利用声音信号转化为图像，识别轴承微小裂纹造成的声学指纹差异。',
    desc: '将振动信号转化为格拉姆角场图像，利用卷积神经网络进行高精度损伤等级分类。',
    skills: ['信号图像化', 'CNN 架构', '模型轻量化'],
    status: 'locked'
  },
  {
    id: 'stock_demand',
    x: 400, y: 420,
    title: '物流仓库库存需求预测',
    icon: 'Star',
    difficulty: 'Expert',
    duration: '60 min',
    branch: 'stats',
    requires: '时间序列基础',
    mission: '优化：半导体备件库房库存积压严重，请建立精准的月度需求预测模型。',
    desc: '结合历史发货量与生产计划，构建多步时间序列预测模型，优化安全库存水平。',
    skills: ['Auto-ARIMA', 'XGBoost', '库存补货算法'],
    status: 'locked'
  }
];"""

# Replace the scenario array
content = re.sub(r"const PRACTICAL_SCENARIOS = \[.*?\];", new_scenarios, content, flags=re.DOTALL)

# Add Career Tier indicator
tier_html = """            <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--accent)', color: 'white', fontWeight: 800 }}>TIER 2</span>
                    <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 800 }}>中级工业分析师</div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>当前总进度: 25%</div>
                <div style={{ width: 140, height: 4, background: 'var(--bg-soft)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ width: '25%', height: '100%', background: 'var(--accent)' }}></div>
                </div>
            </div>"""

content = content.replace("""            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>当前进度: 25%</div>
                <div style={{ width: 120, height: 4, background: 'var(--bg-soft)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ width: '25%', height: '100%', background: 'var(--accent)' }}></div>
                </div>
            </div>""", tier_html)

# Add Mission display in Detail Panel
mission_html = """          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{selected.title}</h2>
          <div style={{ padding: '8px 12px', background: 'rgba(255,154,0,0.1)', borderLeft: '3px solid var(--accent)', borderRadius: '0 8px 8px 0', marginBottom: 20, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
            {selected.mission}
          </div>"""

content = content.replace("<h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{selected.title}</h2>", mission_html)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("PracticalLabs.tsx updated with Missions and Tiers")
