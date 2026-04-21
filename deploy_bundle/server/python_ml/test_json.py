import sys
sys.path.insert(0, './algorithms')
from main import convert_numpy
import decision_tree
import json
import traceback

payload = {
    'dataset': [{'A': 1, 'B': 0}, {'A': 2, 'B': 1}, {'A': 3, 'B': 0}, {'A': 4, 'B': 1}],
    'variables': {'target': ['B'], 'features': ['A']},
    'params': {}
}

try:
    res = convert_numpy(decision_tree.run(payload))
    print('convert_numpy ok')
    print(json.dumps(res))
    print('dumps ok')
except Exception as e:
    print('ERROR:', e)
    traceback.print_exc()
