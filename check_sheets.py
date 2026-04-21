import pandas as pd
file_path = r'd:\statlab\prompt_jsonl (1).xlsx'
try:
    xl = pd.ExcelFile(file_path)
    print(xl.sheet_names)
except Exception as e:
    print(e)
