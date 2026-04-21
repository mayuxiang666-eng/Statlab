import json
import re

ts_file = r'd:\statlab\deploy_bundle\client\src\GenAiCourseData.ts'
json_file = r'd:\statlab\deploy_bundle\server\data\gen_ai_lessons.json'

with open(ts_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract GEN_AI_LESSONS array
# This is tricky because it's a complex TypeScript object. 
# I'll use a regex to find the start and end of the array, then I'll use a simple parser or just manual extraction if it's not too long.
# Actually, I'll use a python script that can "evaluate" or at least roughly parse the JS object.

# For now, I'll try to find the start of the array
start_marker = "export const GEN_AI_LESSONS: GenAiLesson[] = ["
start_idx = content.find(start_marker)
if start_idx != -1:
    # Find matching closing bracket for the array
    # We can use a simple counter for brackets
    bracket_count = 0
    end_idx = -1
    for i in range(start_idx + len(start_marker) - 1, len(content)):
        if content[i] == '[':
            bracket_count += 1
        elif content[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                end_idx = i + 1
                break
    
    if end_idx != -1:
        lessons_str = content[start_idx + len(start_marker) - 1 : end_idx]
        # Clean up some TS-specific things if any, but since it's just data it might be mostly JSON-like
        # I'll use a very basic replacement to make it valid JSON
        # 1. Replace backticks with " (and escape existing ")
        # 2. Add quotes to keys
        # Actually, it might be easier to just read the file and find the objects.
        
        # Alternative: Let's assume it's well-formatted and just extract it carefully.
        # But wait, I have a better idea. I'll just write a small Node script to import and export it to JSON.
        pass

# I'll use Node to extract the data because it understands TS-like objects better if I just treat it as JS.
