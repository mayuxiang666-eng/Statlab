import sqlite3
import json
import os

db_path = os.path.join(os.path.dirname(__file__), '../db/statlab.sqlite.bak')
out_path = os.path.join(os.path.dirname(__file__), '../db/learning_data.json')

if not os.path.exists(db_path):
    print("Database not found:", db_path)
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

data = {}
tables = ['LearningProgress', 'LabExerciseRecord', 'WrongQuestion', 'ChallengeAttempt', 'User']

for table in tables:
    try:
        cursor.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()
        data[table] = [dict(row) for row in rows]
        print(f"Extracted {len(rows)} rows from {table}")
    except sqlite3.OperationalError as e:
        print(f"Skipping {table}: {e}")
        data[table] = []

with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Data exported to", out_path)
