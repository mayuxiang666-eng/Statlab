import os
import re
import json

def extract_strings(directory):
    chinese_re = re.compile(r'[\u4e00-\u9fa5]+')
    strings = set()
    
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in root or '.git' in root or 'dist' in root or '__pycache__' in root:
            continue
        for file in files:
            if file.endswith('.ts') or file.endswith('.tsx') or file.endswith('.js') or file.endswith('.py'):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for line in lines:
                            # We want to catch strings containing Chinese
                            # It could be single quotes, double quotes, or backticks
                            # A simple approach: find all quotes
                            matches = re.findall(r'(["\'`])(.*?[\u4e00-\u9fa5]+.*?)(\1)', line)
                            for match in matches:
                                s = match[1]
                                # remove expressions like ${} 
                                s = re.sub(r'\$\{.*?\}', '', s)
                                s = s.strip()
                                if s and chinese_re.search(s):
                                    strings.add(s)
                            
                            # Also check for JSX text nodes: >xxx<
                            jsx_matches = re.findall(r'>([^<]*[\u4e00-\u9fa5]+[^<]*)<', line)
                            for m in jsx_matches:
                                s = m.strip()
                                if s and chinese_re.search(s):
                                    # remove variables {}
                                    s = re.sub(r'\{.*?\}', '', s)
                                    s = s.strip()
                                    if s and chinese_re.search(s):
                                        strings.add(s)
                except Exception as e:
                    pass
    
    return list(strings)

all_str = extract_strings('.')
with open('extracted_chinese.json', 'w', encoding='utf-8') as f:
    json.dump(all_str, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(all_str)} strings.")
