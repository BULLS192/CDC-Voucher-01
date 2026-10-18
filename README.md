# CDC Voucher Merchant Directory (Singapore)

A categorized, searchable directory of CDC voucher hawker and heartland merchants in Singapore, based on the official [GoWhere directory](https://www.gowhere.gov.sg/cdcvouchers).

## Open the search app

**[CDC Voucher Finder SG — live search app](https://cdc-voucher-finder-sg.airycoot16.chatgpt.site)**

The responsive website searches the **25,822-outlet snapshot (18 October 2026)** by merchant name, food/shop keyword, street/address, postal code or sector. Browse 17 mapped categories plus Unclassified, filter GoWhere-marked budget meals, sort, and open map links. The hosted website is **public and shareable without a ChatGPT account**. It is currently deployed on ChatGPT Sites, not GitHub Pages.

The reproducible static app source lives in `web/` and the compact-data builder in `scripts/build-app-data.py`. To prepare a local standalone copy after generating the enriched CSV:

```bash
python3 scripts/build-app-data.py --input cdc-merchants-enriched.csv --output web/merchants.json
```

Then serve `web/` from a static HTTP server. The generated snapshot is not committed to this repo; the published website bundles a dated snapshot. The app is an independent community tool, not an official live voucher eligibility checker.

## Browse the directory

**[Open the Google Sheet — 25,822 outlet records, 18 October 2026](https://docs.google.com/spreadsheets/d/1F-ooGv1LLRclS0br7xPMcsu1GCh7-l8j7IwMN_tAvJs/edit)**

- **Overview:** snapshot counts and instructions.
- **Merchants:** filterable listing with merchant name, category, subcategory, classification confidence, address, postal code and sector, voucher type, budget meal, map link, source ID/date, and optional suggestions.

Google Sheet access depends on the owner's sharing settings.

## Result and limitations

| Level | Outlets | How to interpret |
| --- | ---: | --- |
| Category assigned from names/known outlet patterns/GoWhere budget-meal flag | **19,741** | Best available rule-based category; not an official classification |
| **Unclassified** with a separate optional category suggestion | **2,194** | Pattern-based machine-learning suggestion in columns M–N, not verified |
| Unclassified without a defensible suggestion | **3,887** | Insufficient information to determine what is sold |
| **Total** | **25,822** | One record per listed outlet, not one per business brand |

**No one needs to review 6,081 individual entries.** Use the main Category and Subcategory filters for ordinary browsing. An unclear name remains *Unclassified*; a statistical suggestion never overwrites the primary category.

The optional suggestions are trained from the program's own high-confidence rules, not independent ground truth. A “Strong name similarity” score does **not** guarantee a correct category. Always check a business directly when the shop type matters.

Categories include Restaurants & Food, Cafés & Drinks, Bakeries & Desserts, Groceries & Markets, Beauty & Wellness, Healthcare, Fashion & Accessories, Home & Hardware, Electronics & Mobile, Pets, Services & Repairs, Gifts & Florists, Other Retail, Books/Printing/Stationery, Transport & Automotive, Sports & Hobbies, and Religious & Cultural Goods.

This covers **hawker and heartland** voucher merchants only, **not** supermarket voucher retailers. Merchant availability can change; check GoWhere before making a journey.

## Regenerate

The primary rule-based categorizer needs **Node.js 18+** and no third-party packages:

```bash
node scripts/build-directory.mjs --output cdc-merchants.csv
```

Or use a saved JSON snapshot instead of fetching live:

```bash
node scripts/build-directory.mjs --input data.json --output cdc-merchants.csv
```

To generate the **optional, unverified suggestion columns** from a finished categorized CSV, use Python 3 with NumPy and scikit-learn:

```bash
python3 scripts/suggest-categories.py --input cdc-merchants.csv --output cdc-merchants-enriched.csv
```

The second script uses character n-gram similarity, a conservative threshold, and qualitative *Strong/Moderate* names rather than a claimed probability of correctness.

Source: GovTech GoWhere public feed at `https://prd-tmp.cdn.gowhere.gov.sg/assets/cdcvouchersgowhere/data.gzip?v=2`. Feed format and availability may change. Raw records and generated CSVs are deliberately not committed to this public repo. Check any relevant source usage terms before redistributing.

## Future enhancements

- Cross-reference public establishment registries or business descriptions where legally and technically available.
- Maintain a small audited brand mapping keyed by merchant ID/chain name.
- Detect changed, added or removed outlets across snapshots.
- Improve neighbourhood browsing using postal sectors, and prioritise useful repeated chains without asking people to inspect thousands of opaque listings.

Independent community project. Not an official government list or live sync.
