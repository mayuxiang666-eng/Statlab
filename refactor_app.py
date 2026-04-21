import re
path = r"d:\statlab\deploy_bundle\client\src\App.tsx"

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Remove alias in import
c = c.replace('Database as DbIcon,', 'Database,')

# 2. Update usage
c = c.replace('<DbIcon ', '<Database ')

# 3. Add debug log
if 'console.log("Lucide Icons Loaded"' not in c:
    c = c.replace('import { Language, t } from "./locales";', 
                  'import { Language, t } from "./locales";\nconsole.log("StatLab Debug: Icons Loaded");')

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(c)

print("Refactored App.tsx")
