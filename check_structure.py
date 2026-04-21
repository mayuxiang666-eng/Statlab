import pandas as pd
file_path = r'd:\statlab\prompt_jsonl (1).xlsx'
try:
    df = pd.read_excel(file_path, sheet_name='编程', nrows=5)
    print(df.to_json(orient='records', force_ascii=False))
except Exception as e:
    print(e)
