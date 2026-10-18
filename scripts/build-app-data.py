#!/usr/bin/env python3
"""Build a compact browser-search snapshot from the categorized CDC CSV.

Usage: python3 build-data.py --input cdc-merchants-enriched.csv --output dist/merchants.json
The generated file should be checked against the official GoWhere date before publication.
"""

import argparse
import csv
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()

rows = []
categories = []
category_id = {}
dates = set()

with open(args.input, newline='', encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        category = row['Category'] or 'Unclassified'
        if category not in category_id:
            category_id[category] = len(categories)
            categories.append(category)
        dates.add(row['Source Updated'])
        rows.append([
            row['Merchant Name'],
            category_id[category],
            row['Subcategory'],
            row['Classification Confidence'],
            row['Address'],
            row['Postal Code'],
            row['Budget Meal'] == 'Yes',
            row['Map Link'],
            row.get('Suggested Category (unverified)', ''),
            row.get('Suggestion Strength', ''),
        ])

if len(dates) != 1:
    raise SystemExit(f'Expected a single source date; got {dates!r}')
if not rows:
    raise SystemExit('No merchants found')

output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({
    'updated': dates.pop(),
    'categories': categories,
    'rows': rows,
}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(rows):,} outlets, {len(categories)} categories, {output.stat().st_size:,} bytes -> {output}')
