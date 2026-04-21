import re

path = r"d:\statlab\deploy_bundle\client\src\PracticalLabs.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Adjust coordinates to be more centered/compact
# Original: motor_vibration (500, 70), yield_opt (300, 280), deep_fault (700, 280), stock_demand (500, 490)
# New: motor_vibration (400, 40), yield_opt (200, 230), deep_fault (600, 230), stock_demand (400, 420)

content = content.replace("x: 500, y: 70", "x: 400, y: 40")
content = content.replace("x: 300, y: 280", "x: 200, y: 230")
content = content.replace("x: 700, y: 280", "x: 600, y: 230")
content = content.replace("x: 500, y: 490", "x: 400, y: 420")

# Adjust SVG path coordinates (center of nodes)
# Original calc in code: s.x + 70, s.y + 80 (based on 140x160)
# New node size is 100x115 -> center is +50, +57.5
content = content.replace("s.x + 70", "s.x + 50")
content = content.replace("s.y + 80", "s.y + 57")
content = content.replace("nextNode.x + 70", "nextNode.x + 50")
content = content.replace("nextNode.y + 80", "nextNode.y + 57")

# Adjust Hover Card positioning
content = content.replace("left: hovered.x + 150", "left: hovered.x + 110")

# Add padding to Detail Panel to avoid floating buttons
content = content.replace("display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', background: 'var(--bg-raised)'", 
                        "display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', background: 'var(--bg-raised)', paddingBottom: '100px'")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("PracticalLabs.tsx updated with layout fixes")
