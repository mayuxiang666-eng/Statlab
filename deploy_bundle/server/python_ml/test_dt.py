import sys
sys.path.insert(0, './algorithms')
import decision_tree
import traceback

payload = {
    'dataset': [{'A': 1, 'B': 0}, {'A': 2, 'B': 1}, {'A': 3, 'B': 0}, {'A': 4, 'B': 1}],
    'variables': {'target': ['B'], 'features': ['A']},
    'params': {}
}

try:
    print(decision_tree.run(payload))
except Exception as e:
    print('ERROR:', e)
    traceback.print_exc()
