import fs from 'node:fs/promises';

// Source: GovTech GoWhere CDCVouchersGoWhere public directory feed.
const SOURCE_URL = 'https://prd-tmp.cdn.gowhere.gov.sg/assets/cdcvouchersgowhere/data.gzip?v=2';
const argv = process.argv.slice(2);
const inputPath = argv.includes('--input') ? argv[argv.indexOf('--input') + 1] : null;
const outputPath = argv.includes('--output') ? argv[argv.indexOf('--output') + 1] : './cdc-merchants.csv';

const R = (category, subcategory, confidence, pattern) => ({category, subcategory, confidence, pattern});
const RULES = [
  R('Healthcare', 'Dental', 'High', /\bDENT(AL|IST|ISTRY)\b|ORTHODONT|DENTURE/i),
  R('Healthcare', 'Clinic / medical', 'High', /\bCLINIC\b|\bMEDICAL\b|MEDICAL CENT(RE|ER)|\bPOLYCLINIC\b|CHIROPRACT|PHYSIOTHERAP|ACUPUNCTURE|\bTCM\b|TRADITIONAL CHINESE MEDICINE/i),
  R('Healthcare', 'Optical', 'High', /OPTIC(AL|IAN|S)?\b|OPTOMETR|EYEWEAR|SPECTACLE/i),
  R('Healthcare', 'Pharmacy / health products', 'High', /PHARMAC|DISPENSARY|HEALTH SUPPLEMENT|HERBAL MEDICINE/i),

  R('Beauty & Wellness', 'Massage / spa', 'High', /MASSAGE|\bSPA\b|REFLEXOLOGY|FOOT REFLEX|BODY THERAPY|NAIL(S)?\b|MANICURE|PEDICURE|FACIAL|AESTHETIC|BEAUT(E|Y)|BEAUTE/i),
  R('Beauty & Wellness', 'Hair / barber', 'High', /HAIR\b|HAIRCUT|BARBER|SALO(O)?N\b|HAIRDRESS|HAIR STUDIO/i),
  R('Pets', 'Pet supplies / grooming', 'High', /\bPET(S)?\b|PET GROOMING|AQUARIUM|AQUATIC PET|VETERINAR|AROWANA/i),
  R('Electronics & Mobile', 'Phones / accessories', 'High', /\bMOBILE\b|CELLULAR|HANDPHONE|PHONE REPAIR|PHONE ACCESS|COMMUNICATIONS|TELECOM|IPHONE/i),
  R('Electronics & Mobile', 'Electronics / computer', 'High', /ELECTRONIC|COMPUTER|LAPTOP|GADGET|ELECTRICAL APPLIANCE|IT ACCESSOR|CCTV|SMART DEVICE/i),
  R('Transport & Automotive', 'Automotive / bicycle', 'High', /CAR WASH|CAR ACCESS|TYRE|TIRE|AUTO(MOTIVE)?\b|MOTORCYCLE|MOTORBIKE|BICYCLE|BIKE SHOP|\bCYCLES\b|BIKESCOOTER|SCOOTER|CYCLE SHOP|CAR SERVICE|VEHICLE/i),
  R('Fashion & Accessories', 'Clothing / tailoring', 'High', /CLOTH(ING|ES)?\b|GARMENT|FASHION|APPAREL|TAILOR|BOUTIQUE|UNIFORM|UNDER ?WEAR|SHOE(S)?\b|FOOTWEAR|TEXTILE/i),
  R('Fashion & Accessories', 'Jewellery / accessories', 'High', /JEWELL?ERY|GOLD ?SMITH|WATCH(S)?\b|HAND ?BAG|ACCESSORI(ES|ZE)/i),
  R('Home & Hardware', 'Hardware / DIY', 'High', /HARDWARE|TOOLS? SHOP|DIY|PAINT SHOP|LOCKSMITH|PLUMBING|ELECTRICAL SUPPL|LIGHTING|BUILDING MATERIAL/i),
  R('Home & Hardware', 'Household / furnishing', 'High', /HOUSEHOLD|HOMEWARE|HOM(E|ES) (LIVING|DECOR|FURNISH)|FURNITURE|CURTAIN|MATTRESS|BEDDING|KITCHENWARE|SUNDRY/i),
  R('Books, Printing & Stationery', 'Printing / stationery', 'High', /PRINT(ING|ER)?\b|STATIONE?RY|PHOTOCOP|BOOK ?SHOP|BOOKSTORE|SCHOOL SUPPL|INK CARTRIDGE/i),
  R('Gifts & Florists', 'Flowers / gifts', 'High', /FLORIST|FLOWER|BOUQUET|GIFT(S)?\b|HAMPER|TOY(S)?\b|BALLOON/i),
  R('Services & Repairs', 'Laundry / cleaning', 'High', /LAUNDRY|DRY CLEAN|ALTERATION|CLEANING SERVICE|COIN WASH/i),
  R('Services & Repairs', 'Repair / other', 'High', /\bREPAIR(S)?\b|KEY DUPLICAT|COBBLER|PHOTO STUDIO|PHOTOGRAPHY|SERVICE CENTRE/i),

  R('Bakeries & Desserts', 'Bakery / bread', 'High', /BAKERY|BAKER(S)?\b|BAKEINC|BREAD|PASTR(Y|IES)|CAKE|BAGEL|CROISSANT|BUN(S)?\b|CONFECTIONERY/i),
  R('Bakeries & Desserts', 'Dessert / sweets', 'High', /DESSERT|ICE ?CREAM|GELATO|WAFFLE|WAFFLES|PANCAKE|SWEET(S)?\b|CHENDOL|CENDOL|SOYA BEAN|BEANCURD|TANG YUAN|\bACAI\b/i),
  R('Cafés & Drinks', 'Café / coffee', 'High', /\bCAF(E|ES|ETERIA)\b|COFFEE|\bKOPI\b|TEA HOUSE|TEAHOUSE|TEA ROOM|KOPITIAM|BREW BAR|BREWTOPIA/i),
  R('Cafés & Drinks', 'Drinks / juice', 'High', /BUBBLE TEA|MILK TEA|FRUIT JUICE|JUICE|SMOOTHIE|\bDRINK(S)?\b|BEVERAGE|\bITEA\b|\bSAR?BAT\b|\bTEA\b/i),

  R('Groceries & Markets', 'Fresh meat / seafood', 'High', /FRESH (CHICKEN|FISH|SEAFOOD|PORK|MEAT)|FISHMONGER|BUTCHER|MEAT STALL|PORK STALL|FISH STALL|SEAFOOD STALL|POULTRY STALL/i),
  R('Groceries & Markets', 'Fresh produce', 'High', /VEGETABLE(S)?|FRUIT(S)?\b|DURIAN|FRESH PRODUCE|EGG STALL|WET MARKET|FRESH GREENS/i),
  R('Groceries & Markets', 'Supermart / provision', 'High', /SUPERMART|SUPERMARKET|MINI ?MART|MINIMARKET|PROVISION|GROC(ER|ERY|ERIES)|MART\b|\bVALU\$|\bVALUE\$|CONVENIENCE STORE|BUY N SAVE/i),
  R('Groceries & Markets', 'Food supplies / dried goods', 'Medium', /DRIED GOODS|FOODSTUFF|FOOD SUPPL|FROZEN FOOD|GRAIN(S)?\b|RICE WHOLESAL|SPICE(S)?\b|\bTONIC\b/i),

  R('Restaurants & Food', 'Restaurant / bistro', 'High', /RESTAURANT|BISTRO|EATING HOUSE|STEAKHOUSE|PIZZERIA|DINER\b|HOT ?POT|FOOD ?COURT|FOOD CENTRE|KITCHEN\b/i),
  R('Restaurants & Food', 'Hawker / cooked food', 'High', /KWAY CHAP|KUEY CHAP|KWAY TEOW|KW(E|A)Y T(E|O)OW|BEE HOON|MEE\b|MIAN\b|NOODLE|RICE\b|NASI\b|BIRYANI|BRIYANI|PORRIDGE|SOUP\b|YONG TAU FU|BAK KUT TEH|ROTI PRATA|CHAR KWAY|CURRY\b|HOKKIEN|DIM SUM|DIMS?UM|CHICKEN RICE|DUCK RICE|ROASTED|ROAST MEAT|WANTON|WONTON|LAKSA|SATAY|WESTERN GRILL|WESTERN FOOD|\bBBQ\b|ROJAK|MALA\b|FISHBALL|FRIED CARROT|FRIED PRAWN|ZHI CHAR|ZI CHAR|ZHU CHAO|BAN MIAN|MUTTON|MURTABAK|POP(I|P)AH|MAKAN|SIZZLING HOTPLATE|NGOH HIANG|WU XIANG|PRAWN FRITTER|TOM YUM|KEBAB|DUMPLING|AYAM PENYET|LAO HUO TANG|VEGETERIAN|MIXED VEG|\bTENDERBEST\b/i),
  R('Restaurants & Food', 'Cuisine / prepared meals', 'Medium', /CUISINE|COOKED FOOD|\bFOOD\b|\bF&B\b|DELICAC(Y|IES)|VEGETARIAN|SEAFOOD|STEAK|SUSHI|SASHIMI|JAPANESE|KOREAN|THAI\b|INDIAN\b|MUSLIM\b|MALAY\b|CHINESE\b|\bPIZZA\b|\bBURGER\b|\bGRILL\b|\bWOK\b|\bSNACK(S)?\b|\bTASTE\b|\bEATERY\b|\bDINING\b/i),
  R('Other Retail', 'Retail / supplies', 'Medium', /\bRETAIL\b|SHOP\b|\bSTORE\b|TRADING\b|GENERAL MERCHANT|\bSUPPL(Y|IES)\b|COLLECTIBLES/i),
];

function classify(name) {
  const normalized = String(name || '').normalize('NFKC').toUpperCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) return {category: rule.category, subcategory: rule.subcategory, confidence: rule.confidence};
  }
  return {category: 'Needs Verification', subcategory: 'Merchant type unclear', confidence: 'Review needed'};
}

// Prefix leading spreadsheet formula operators before CSV import. Keep legitimate @names readable.
function csvCell(value) {
  let str = String(value ?? '');
  if (/^[=+\-\t\r]/.test(str)) str = "'" + str;
  return '"' + str.replaceAll('"', '""') + '"';
}

const raw = inputPath ? await fs.readFile(inputPath, 'utf8') : await (async () => {
  const response = await fetch(SOURCE_URL, {headers: {'accept': 'application/json'}});
  if (!response.ok) throw new Error(`GoWhere feed returned ${response.status}`);
  return response.text();
})();
const source = JSON.parse(raw);
if (!Array.isArray(source.locations) || !source.lastUpdated) throw new Error('Unexpected GoWhere feed format');

const headers = ['Merchant Name','Category','Subcategory','Classification Confidence','Address','Postal Code','Postal Sector','Voucher Type','Budget Meal','Map Link','Merchant ID','Source Updated'];
const rows = [headers.map(csvCell).join(',')];
const counts = {};
const uniqueIds = new Set();
for (const merchant of source.locations) {
  if (uniqueIds.has(merchant.id)) throw new Error(`Duplicate merchant ID: ${merchant.id}`);
  uniqueIds.add(merchant.id);
  const cls = classify(merchant.name);
  counts[cls.category] = (counts[cls.category] || 0) + 1;
  const mapUrl = Number.isFinite(merchant.LAT) && Number.isFinite(merchant.LON)
    ? `https://www.onemap.gov.sg/?lat=${merchant.LAT}&lng=${merchant.LON}` : '';
  const postal = String(merchant.postalCode || '');
  const entry = [merchant.name, cls.category, cls.subcategory, cls.confidence, merchant.address || '', postal, postal.slice(0, 2),
    merchant.filters?.vouchers?.supermarket ? 'Supermarket' : 'Hawker / Heartland',
    merchant.filters?.secondary?.budgetmeal ? 'Yes' : 'No', mapUrl, merchant.id, source.lastUpdated];
  rows.push(entry.map(csvCell).join(','));
}
await fs.writeFile(outputPath, rows.join('\r\n') + '\r\n', 'utf8');
console.log(JSON.stringify({output: outputPath, lastUpdated: source.lastUpdated, outletCount: source.locations.length,
  uniqueIds: uniqueIds.size, categoryCounts: Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]))}, null, 2));
