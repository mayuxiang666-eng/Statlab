import pandas as pd
file_path = r'd:\statlab\prompt_jsonl (1).xlsx'
try:
    df = pd.read_excel(file_path, sheet_name='编程', nrows=5)
    print("Columns:", df.columns.tolist())
    for i, col in enumerate(df.columns):
        print(f"Col {i} ({col}) samples:")
        print(df[col].head(3).tolist())
except Exception as e:
    print(e)
