# CDC Voucher Merchant Directory (Singapore)

An independently categorised, searchable directory of CDC voucher hawker and heartland merchants in Singapore, based on the official [GoWhere CDC Vouchers directory](https://www.gowhere.gov.sg/cdcvouchers).

## Browse the directory

**[Google Sheet — 25,822 outlets, snapshot from 18 October 2026](https://docs.google.com/spreadsheets/d/1F-ooGv1LLRclS0br7xPMcsu1GCh7-l8j7IwMN_tAvJs/edit)**

- **Overview** tab: counts by category, category shares and caveats.
- **Merchants** tab: filterable directory including merchant name, category, subcategory, classification confidence, address, postal code/sector, voucher type, budget-meal indicator, map link, merchant ID, and source date.

Google Sheet access is subject to the owner's sharing settings.

## Classification

Categories include Restaurants & Food, Cafés & Drinks, Bakeries & Desserts, Groceries & Markets, Beauty & Wellness, Healthcare, Fashion & Accessories, Home & Hardware, Electronics & Mobile, Pets, Services & Repairs, Gifts & Florists, Other Retail, Books/Printing/Stationery, and Transport & Automotive.

Classification is **heuristic and based on merchant names**, not an official GoWhere business classification. In this snapshot:
- 25,822 listed outlets
- 17,609 assigned a probable category
- 8,213 labelled **Needs Verification** because their names did not disclose a merchant type reliably

Even confident labels can be wrong. A row is one listed outlet, not a distinct business brand. The sheet covers **hawker and heartland merchants only**, not supermarkets in the other voucher scheme category.

## Regenerate the CSV

Requirements: Node.js 18+, no third-party packages.

```bash
node scripts/build-directory.mjs --output cdc-merchants.csv
```

The script fetches GoWhere's public directory feed and generates a UTF-8 CSV. To use a saved JSON snapshot:

```bash
node scripts/build-directory.mjs --input data.json --output cdc-merchants.csv
```

Source: `https://prd-tmp.cdn.gowhere.gov.sg/assets/cdcvouchersgowhere/data.gzip?v=2` (availability and format may change).

Raw source snapshots and generated merchant CSVs are **not committed** to this public repository. Respect the source's terms, and verify merchant participation on GoWhere before making a trip.

## Future improvements

- Manually review the **Needs Verification** businesses.
- Add an override file for verified categories and subcategories.
- Compare snapshots to identify added/removed outlets.
- Add district and neighbourhood browsing.

This is an independent community project, not an official government list. The Google Sheet is a dated snapshot, not an automatic live sync.
