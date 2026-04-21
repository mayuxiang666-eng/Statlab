path = r"d:\statlab\deploy_bundle\client\src\App.tsx"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

stack = []
for i, char in enumerate(content):
    if char == '{':
        stack.append(i)
    elif char == '}':
        if stack:
            stack.pop()
        else:
            print(f"Extra closing brace at char {i}")
            # print surrounding context
            start = max(0, i - 50)
            end = min(len(content), i + 50)
            print(f"Context: {content[start:end]}")

if stack:
    print(f"{len(stack)} unclosed opening braces. Last one at char {stack[-1]}")
    start = max(0, stack[-1] - 50)
    end = min(len(content), stack[-1] + 50)
    print(f"Context: {content[start:end]}")
else:
    print("Braces are balanced (globally)")
