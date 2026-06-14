import re, os

with open('src/config/categories.js', 'r', encoding='utf-8') as f:
    content = f.read()

csv_files = re.findall(r'csvFile:\s*"([^"]+)"', content)
actual_files = [f for f in os.listdir('src/data') if f.startswith('data_') and f.endswith('.csv')]

print('In categories.js:')
for f in sorted(csv_files):
    exists = f in actual_files
    status = "OK" if exists else "MISSING!"
    print(f'  {f} -> {status}')

print(f'\nOn disk:')
for f in sorted(actual_files):
    referenced = f in csv_files
    status = "Referenced" if referenced else "NOT REFERENCED!"
    print(f'  {f} -> {status}')
