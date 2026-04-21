import re
path = r"d:\statlab\deploy_bundle\client\src\App.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the import block specifically
# It might be spread over multiple lines
pattern = r'import \{\s*Database, FileText, Upload, Plus, Download, Trash2, Table, BarChart4\s*\} from "lucide-react";'
replacement = 'import {\n  Database as DbIcon, FileText, Upload, Plus, Download, Trash2, Table, BarChart4, Cpu, Zap, Layers, PlayCircle, Loader2\n} from "lucide-react";'

if 'Database,' in content and 'DbIcon' not in content:
    content = content.replace('Database, FileText, Upload, Plus, Download, Trash2, Table, BarChart4', 
                               'Database as DbIcon, FileText, Upload, Plus, Download, Trash2, Table, BarChart4, Cpu, Zap, Layers, PlayCircle, Loader2')
else:
    # If the above fails, try a more flexible approach
    content = re.sub(r'import\s+\{\s*Database,', 'import {\n  Database as DbIcon,', content)
    # Ensure other icons are there
    if 'Cpu,' not in content:
         content = content.replace('BarChart4', 'BarChart4, Cpu, Zap, Layers, PlayCircle, Loader2')

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Imports fixed")
