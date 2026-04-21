import re
path = r"d:\statlab\deploy_bundle\client\src\App.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix broken tags (multiple icons inside < >)
content = content.replace('<BarChart4, Cpu, Zap, Layers, PlayCircle, Loader2', '<BarChart4')

# Ensure imports are correct and not duplicate
# Import line should look like: Database, FileText, Upload, Plus, Download, Trash2, Table, BarChart4, Cpu, Zap, Layers, PlayCircle, Loader2
# But wait, my previous script might have messed it up.
# Let's check line 21
lines = content.splitlines()
if len(lines) > 20:
    import_line = lines[20]
    if 'BarChart4, Cpu, Zap, Layers, PlayCircle, Loader2, Cpu,' in import_line:
        lines[20] = '  Database, FileText, Upload, Plus, Download, Trash2, Table, BarChart4, Cpu, Zap, Layers, PlayCircle, Loader2'

content = "\n".join(lines)

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("App.tsx cleaned up.")
