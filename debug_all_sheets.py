import pandas as pd
file_path = r'd:\statlab\prompt_jsonl (1).xlsx'
try:
    xl = pd.ExcelFile(file_path)
    for sheet in xl.sheet_names:
        df = pd.read_excel(file_path, sheet_name=sheet, nrows=2)
        print(f"Sheet: {sheet}")
        print(df.columns.tolist())
        print(df.head(2).to_json(orient='records', force_ascii=False))
        print("---")
except Exception as e:
    print(e)
