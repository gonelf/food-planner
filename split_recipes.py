import json
import os

with open('/Users/goncalohenriques/Documents/github/food-planner/data/recipes.json', 'r') as f:
    data = json.load(f)

for i in range(10):
    batch = data[i*10:(i+1)*10]
    batch_file = f'/Users/goncalohenriques/Documents/github/food-planner/data/batch_{i+1}.json'
    with open(batch_file, 'w') as f:
        json.dump(batch, f, indent=2, ensure_ascii=False)
        f.write('\n')

print("Batch files successfully recreated.")
