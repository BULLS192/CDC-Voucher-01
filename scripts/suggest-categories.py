"""Optional name-only suggestions for genuinely unclassified CDC merchants.

These are *not* verified categories. They belong in separate columns and must
never overwrite the rule-based category. Their strength is relative to the
training labels and is not a calibrated probability of correctness.

Requires scikit-learn and numpy, for example in an existing Python environment.
"""
import argparse
import csv
from collections import Counter

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True, help='Categorized CSV from build-directory.mjs')
parser.add_argument('--output', required=True, help='Enriched CSV with two suggestion columns')
parser.add_argument('--threshold', type=float, default=0.65)
args = parser.parse_args()

if not 0.5 <= args.threshold <= 1:
    parser.error('--threshold must be between 0.5 and 1.0')

with open(args.input, encoding='utf-8-sig', newline='') as handle:
    reader = csv.DictReader(handle)
    headers = reader.fieldnames
    rows = list(reader)

if not headers or 'Merchant Name' not in headers or 'Category' not in headers:
    raise ValueError('Expected the CDC directory CSV headers')

known = [r for r in rows if r['Classification Confidence'] == 'High']
counts = Counter(r['Category'] for r in known)
known = [r for r in known if counts[r['Category']] >= 10]
unknown_indexes = [i for i, r in enumerate(rows) if r['Category'] == 'Unclassified']

model = make_pipeline(
    TfidfVectorizer(analyzer='char', ngram_range=(2, 5), min_df=2,
                    max_features=100000, sublinear_tf=True),
    LogisticRegression(C=3, max_iter=250),
)
model.fit([r['Merchant Name'] for r in known], [r['Category'] for r in known])
if unknown_indexes:
    scores = model.predict_proba([rows[i]['Merchant Name'] for i in unknown_indexes])
    labels = model.classes_[np.argmax(scores, axis=1)]
    strengths = np.max(scores, axis=1)
    for i, predicted, score in zip(unknown_indexes, labels, strengths):
        if score >= args.threshold:
            rows[i]['Suggested Category (unverified)'] = str(predicted)
            rows[i]['Suggestion Strength'] = 'Strong name similarity' if score >= 0.85 else 'Moderate name similarity'

headers = [*headers, 'Suggested Category (unverified)', 'Suggestion Strength']
with open(args.output, 'w', encoding='utf-8', newline='') as handle:
    writer = csv.DictWriter(handle, fieldnames=headers, quoting=csv.QUOTE_ALL)
    writer.writeheader()
    writer.writerows(rows)

suggested = Counter(r.get('Suggestion Strength', '') for r in rows)
print(f'Outlets: {len(rows)} | Unclassified: {len(unknown_indexes)} | '
      f'Strong suggestions: {suggested["Strong name similarity"]} | '
      f'Moderate suggestions: {suggested["Moderate name similarity"]}')
