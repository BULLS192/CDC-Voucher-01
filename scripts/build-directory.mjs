import fs from 'node:fs/promises';

// Source: GovTech GoWhere CDCVouchersGoWhere public directory feed.
const SOURCE_URL = 'https://prd-tmp.cdn.gowhere.gov.sg/assets/cdcvouchersgowhere/data.gzip?v=2';
const argv = process.argv.slice(2);
const inputPath = argv.includes('--input') ? argv[argv.indexOf('--input') + 1] : null;
const outputPath = argv.includes('--output') ? argv[argv.indexOf('--output') + 1] : './cdc-merchants.csv';

const R = (category, subcategory, confidence, pattern) => ({category, subcategory, confidence, pattern});
// Brand patterns are intentionally specific. They take precedence over branch
// names in brackets (for example "MR BEAN (TAMPINES MART)" is not a grocery).
// Public source examples: tianmaco.com, gov.sg climate-voucher retailer lists,
// and official merchant descriptions; broad, unexplained transliterations are
// deliberately not assigned a category here.
const BRAND_RULES = [
  R('Restaurants & Food', 'Known food outlet', 'Medium', /\b(?:BASIL KING|DING JI|HONG KAO LIAO LI|YU PAN|CHARCOAL MASTER|MANA LAGI|FATTY BOM BOM|MARUHACHI|SOLDIER CHICKEN|ASHES BURNNIT|BORED TACOS|CHOPS & SEAR|IPOH TUCK KEE|XI DE LI)\b/i),
  R('Bakeries & Desserts', 'Known bakery / snack outlet', 'Medium', /\b(?:PRIMA DELI|BENGAWAN SOLO|BAKE INC|DELISNACKS?|SL TWO MUFFIN|MR BEAN|SWEET BEAN)\b/i),
  R('Cafés & Drinks', 'Known drink outlet', 'Medium', /\b(?:SWEETTALK|CHA MULAN|KAFFE & TOAST)\b/i),
  R('Groceries & Markets', 'Provision / general store', 'Medium', /\b(?:TIAN MA GROUP|ACE MARKETPLACE|OFFER & SAVE SUPERSTORE|NEE SOON ESSENTIALS|BALA STORES)\b/i),
  R('Healthcare', 'Clinic / health', 'Medium', /\b(?:HEARTLANDHEALTH|DENTICARE|ONECARE|AMAZING HEARING)\b/i),
  R('Beauty & Wellness', 'Hair / barber', 'Medium', /\b(?:ORIGIN BEECHOO|PAN'S FINE CUTS|NEIGHBOURING CUT)\b/i),
  R('Fashion & Accessories', 'Fashion / lingerie', 'Medium', /\b(?:BRANDS OUTLET|SORELLA)\b/i),
  R('Home & Hardware', 'Household / hardware', 'Medium', /\b(?:STR JAPAN|NIPPON HOME)\b/i),
  R('Electronics & Mobile', 'Telecom / mobile', 'High', /\b(?:SINGTEL EXCLUSIVE RETAILER|HENGHENG96MOBILE)\b/i),
];
const RULES = [
  R('Healthcare', 'Dental', 'High', /\bDENT(AL|IST|ISTRY)\b|ORTHODONT|DENTURE/i),
  R('Healthcare', 'Optical / hearing care', 'High', /HEARING AID|HEARING CENT(RE|ER)|\bOPTIQUE\b|VISION CARE|\bEYE CENT(RE|ER)\b|\bEYELAB\b/i),
  R('Healthcare', 'Clinic / medical', 'High', /\bCLINIC\b|\bMEDICAL\b|MEDICAL CENT(RE|ER)|\bPOLYCLINIC\b|CHIROPRACT|PHYSIOTHERAP|ACUPUNCTURE|\bTCM\b|TRADITIONAL CHINESE MEDICINE/i),
  R('Healthcare', 'Optical', 'High', /OPTIC(AL|IAN|S)?\b|OPTOMETR|EYEWEAR|SPECTACLE/i),
  R('Healthcare', 'Pharmacy / health products', 'High', /PHARMAC|DISPENSARY|HEALTH SUPPLEMENT|HERBAL MEDICINE/i),
  R('Healthcare', 'Health products / therapeutic services', 'Medium', /\bHEALTH(CARE)?\b|HEALTH PRODUCTS|HERBAL LAB|GINSENG|BIRD[S]? ?NEST|BIRDNEST|\bREHAB\b|THERAPY\b|EYECARE|EYEVISER|MYOPTIX|\bOPTIX\b/i),

  R('Beauty & Wellness', 'Massage / spa', 'High', /MASSAGE|\bSPA\b|REFLEXOLOGY|FOOT REFLEX|BODY THERAPY|NAIL(S)?\b|MANICURE|PEDICURE|FACIAL|AESTHETIC|BEAUT(E|Y)|BEAUTE/i),
  R('Beauty & Wellness', 'Beauty / cosmetics', 'High', /BEAUTI|EYELASH|EYEBROW|\bLASH(ES)?\b|\bCOSMETIC(S)?\b|SKIN\s?CARE|\bSKIN\s?&\s?BODY\b|\bMAKEUP\b|\bDERM\b/i),
  R('Beauty & Wellness', 'Hair / barber', 'High', /HAIR\b|HAIRCUT|BARBER|SALO(O)?N\b|HAIRDRESS|HAIR STUDIO/i),
  R('Beauty & Wellness', 'Hair / barber', 'High', /\bSNIP\b|SNIP AVENUE|HAIRKRAFT|HAIRCRAFT|\bHAIRZ\b|\bNEIGHBOURING CUT\b|\bHAIRCUTS\b/i),
  R('Beauty & Wellness', 'Wellness', 'Medium', /\bWELLNESS\b|HOLISTIC WELLNESS|SLIMMING|\bSKINCARE\b|\bSKIN\s?LAB\b|DERMAMEDIC/i),
  R('Pets', 'Pet supplies / grooming', 'High', /\bPET(S)?\b|PET GROOMING|AQUARIUM|AQUATIC PET|VETERINAR|AROWANA/i),
  R('Pets', 'Pet supplies / grooming', 'Medium', /\bPAWS\b|\bSINGAPAWS\b|\bPUPPY\b|\bDOG(S)?\b|\bBARKDOG\b|\bBETTA\b|AQUATICS?\b|\bCHINCHILLA\b|\bVETEXPRESS\b/i),
  R('Electronics & Mobile', 'Phones / accessories', 'High', /\bMOBILE\b|CELLULAR|HANDPHONE|PHONE REPAIR|PHONE ACCESS|COMMUNICATIONS|TELECOM|IPHONE/i),
  R('Electronics & Mobile', 'Electronics / computer', 'High', /ELECTRONIC|COMPUTER|LAPTOP|GADGET|ELECTRICAL APPLIANCE|IT ACCESSOR|CCTV|SMART DEVICE/i),
  R('Electronics & Mobile', 'Phones / accessories', 'High', /MOBILECOMM|CALLMOBILE|\bTELE\s?(SHOP|TESS)\b|\bIT[- ]?FIX(ED)?\b/i),
  R('Electronics & Mobile', 'Phones / accessories', 'High', /\bMOBILES\b|MOBILE\d|\d+MOBILE\b|TECHMOBILE|IMOBILE|MOBILERELATION/i),
  R('Electronics & Mobile', 'Computers / gaming', 'Medium', /GAMEWERKS|GAMING SHOP|GAME CONSOLE|VIDEO GAMES|PC REPAIR/i),
  R('Transport & Automotive', 'Automotive / bicycle', 'High', /CAR WASH|CAR ACCESS|TYRE|TIRE|AUTO(MOTIVE)?\b|MOTORCYCLE|MOTORBIKE|BICYCLE|BIKE SHOP|\bCYCLES\b|BIKESCOOTER|SCOOTER|CYCLE SHOP|CAR SERVICE|VEHICLE/i),
  R('Transport & Automotive', 'Bicycles / cycling', 'High', /\bCYCLING\b|\bBIKE\b|\bBIKES\b/i),
  R('Sports & Hobbies', 'Sports / outdoor hobbies', 'High', /\bSPORT(S|Z)?\b|\bARCHERY\b|\bANGLING\b|FISHING TACKLE|\bTACKLE WORLD\b|\bSPORTING GOODS\b/i),
  R('Fashion & Accessories', 'Clothing / tailoring', 'High', /CLOTH(ING|ES)?\b|GARMENT|FASHION|APPAREL|TAILOR|BOUTIQUE|UNIFORM|UNDER ?WEAR|SHOE(S)?\b|FOOTWEAR|TEXTILE/i),
  R('Fashion & Accessories', 'Jewellery / accessories', 'High', /JEWELL?ERY|GOLD ?SMITH|WATCH(S)?\b|HAND ?BAG|ACCESSORI(ES|ZE)/i),
  R('Fashion & Accessories', 'Clothing / accessories', 'Medium', /\bABAYA(T)?\b|\bHIJAB\b|\bTUDUNG\b|LEATHERCRAFT|\bBRA(S)?\b|\bLUGGAGE\b/i),
  R('Home & Hardware', 'Hardware / DIY', 'High', /HARDWARE|TOOLS? SHOP|DIY|PAINT SHOP|LOCKSMITH|PLUMBING|ELECTRICAL SUPPL|LIGHTING|BUILDING MATERIAL/i),
  R('Home & Hardware', 'Household / furnishing', 'High', /HOUSEHOLD|HOMEWARE|HOM(E|ES) (LIVING|DECOR|FURNISH)|FURNITURE|CURTAIN|MATTRESS|BEDDING|KITCHENWARE|SUNDRY/i),
  R('Home & Hardware', 'Household / furnishing', 'High', /JAPAN HOME|\bHOUSEWARE\b|\bHOME[- ]?LINK\b|PLASTIC WARES?|PLASTIC HOUSE|\bHOME ESSENTIALS\b/i),
  R('Home & Hardware', 'Household / furnishing', 'Medium', /\bNIPPON HOME\b|\bLINEN\b|\bTOWEL(S)?\b|\bHOME & LIFESTYLE\b|\bPAINT(S)?\b|PAINTING SUPPLIES/i),
  R('Books, Printing & Stationery', 'Printing / stationery', 'High', /PRINT(ING|ER)?\b|STATIONE?RY|PHOTOCOP|BOOK ?SHOP|BOOKSTORE|SCHOOL SUPPL|INK CARTRIDGE/i),
  R('Gifts & Florists', 'Flowers / gifts', 'High', /FLORIST|FLOWER|BOUQUET|GIFT(S)?\b|HAMPER|TOY(S)?\b|BALLOON/i),
  R('Gifts & Florists', 'Plants / gardening', 'Medium', /POTTED PLANT|PLANT NURSERY|GARDEN CENTRE|GARDENING|SUCCULENT/i),
  R('Religious & Cultural Goods', 'Prayer / incense supplies', 'High', /\bJOSS\b|\bINCENSE\b|PRAYER GOODS|RELIGIOUS GOODS|JOSS STICK|\bDEITY\b|\bTEMPLE SUPPLIES\b/i),
  R('Services & Repairs', 'Laundry / cleaning', 'High', /LAUNDRY|DRY CLEAN|ALTERATION|CLEANING SERVICE|COIN WASH/i),
  R('Services & Repairs', 'Laundry / cleaning', 'High', /LAUNDRETTE|LAUNDROMAT|\bWASH\b|KLEEN KLEEN/i),
  R('Services & Repairs', 'Repair / other', 'High', /\bREPAIR(S)?\b|KEY DUPLICAT|COBBLER|PHOTO STUDIO|PHOTOGRAPHY|SERVICE CENTRE/i),

  R('Bakeries & Desserts', 'Bakery / bread', 'High', /BAKERY|BAKER(S)?\b|BAKEINC|BREAD|PASTR(Y|IES)|CAKE|BAGEL|CROISSANT|BUN(S)?\b|CONFECTIONERY/i),
  R('Bakeries & Desserts', 'Bakery / bread', 'High', /\bBAKES\b|\bBAGUETTE\b|\bCOOKIE(S)?\b|\bOVEN\b|\bBISCUIT(S)?\b|\bTART(S)?\b|\bPANDAN\s?CHIFFON\b/i),
  R('Bakeries & Desserts', 'Bakery / bread', 'High', /\bBAKE\b|\d+BAKES\b|\bBAKE\s?_?\s?OF\b|\bMUFFIN(S)?\b|\bCRUST\b/i),
  R('Bakeries & Desserts', 'Bakery / bread', 'High', /\bSWEE HENG\b|\bSIEW POW\b|\bSIEW PAU\b|\bPOW\b|\bCONFECTIONARY\b|\bBREADTALK\b/i),
  R('Bakeries & Desserts', 'Dessert / sweets', 'High', /DESSERT|ICE ?CREAM|GELATO|WAFFLE|WAFFLES|PANCAKE|SWEET(S)?\b|CHENDOL|CENDOL|SOYA BEAN|BEANCURD|TANG YUAN|\bACAI\b/i),
  R('Bakeries & Desserts', 'Dessert / sweets', 'High', /\bSOYBEAN\b|\bMUAH CHEE\b|\bPISANG GORENG\b|\bGORENG PISANG\b|\bTAU SUAN\b|\bSOYA\b/i),
  R('Bakeries & Desserts', 'Kueh / traditional snacks', 'High', /\bKUEH\b|\bKUIH\b|\bONDEH\b|\bKUE\b|\bKUIH[- ]?MUIH\b|\bKUEH[- ]?MUEH\b|TAU HUAY/i),
  R('Bakeries & Desserts', 'Snacks / buns', 'Medium', /\bPAU\b|\bBAO\s?DIM\b|\bHANDMADE BAO\b|\bSNACKS\b/i),
  R('Cafés & Drinks', 'Café / coffee', 'High', /\bCAF(E|ES|ETERIA)\b|COFFEE|\bKOPI\b|TEA HOUSE|TEAHOUSE|TEA ROOM|KOPITIAM|BREW BAR|BREWTOPIA/i),
  R('Cafés & Drinks', 'Drinks / juice', 'High', /BUBBLE TEA|MILK TEA|FRUIT JUICE|JUICE|SMOOTHIE|\bDRINK(S)?\b|BEVERAGE|\bITEA\b|\bSAR?BAT\b|\bTEA\b/i),
  R('Cafés & Drinks', 'Drinks / tea', 'High', /\bTASTEA\b|\bEACH A CUP\b|\bSUGARCANE\b|\bSUGAR CANE\b|\bCHA TAN\b|\bKA FEI\b|\bFEI CHA\b/i),
  R('Cafés & Drinks', 'Drinks / café', 'High', /\bTEH TARIK\b|\bKAFFE\b|\bTOAST\b|\bBREW\b|\bBARISTA\b|\bCUP OF\b|\bLIHO\b|\bCHICHA\b|\bGONG CHA\b|\bBORN JUICY\b/i),
  R('Cafés & Drinks', 'Drinks / café', 'High', /CAFE\d+|\bKOFFEE\b|\bCOFEE\b|\bDRINKAHOLIC\b|\bSWEET TALK\b/i),

  R('Groceries & Markets', 'Fresh meat / seafood', 'High', /FRESH (CHICKEN|FISH|SEAFOOD|PORK|MEAT)|FISHMONGER|BUTCHER|MEAT STALL|PORK STALL|FISH STALL|SEAFOOD STALL|POULTRY STALL/i),
  R('Groceries & Markets', 'Fresh meat / seafood', 'High', /\bPOULTRY\b|CHICKEN STALL|PORK SELLER|\bPORK\s?SHOP\b|FRESH SEA GOODS|\bFROZEN GOODS\b|FROZEN SEAFOOD|FISH MARKET/i),
  R('Groceries & Markets', 'Fresh meat / seafood', 'High', /\bFISHERIES\b|\bFISHMONGERS\b|\bFRESH\s?CHILL\s?PORK\b|\bFRESH\s?PORK\b|\bFISH\s?SELLER\b|\bFISH\s?VENDOR\b|RAW MEAT|\bMEAT\s?POULTRY\b/i),
  R('Groceries & Markets', 'Fresh produce', 'High', /VEGETABLE(S)?|FRUIT(S)?\b|DURIAN|FRESH PRODUCE|EGG STALL|WET MARKET|FRESH GREENS/i),
  R('Groceries & Markets', 'Fresh produce', 'High', /\bVEG\b|\bVEGGIES\b|\bEGGS\b|\bEGG\s?SELLER\b|GREENGROCER|FRESH GREENS|\bFRESH FRUITS\b/i),
  R('Groceries & Markets', 'Fresh produce', 'High', /VEGATABLE|\bFRESH\s?VEGS\b|FRUITSOMANIA|PINEAPPLE STALL|\bFRESH EGG\b/i),
  R('Groceries & Markets', 'Supermart / provision', 'High', /SUPERMART|SUPERMARKET|MINI ?MART|MINIMARKET|PROVISION|GROC(ER|ERY|ERIES)|MART\b|\bVALU\$|\bVALUE\$|CONVENIENCE STORE|BUY N SAVE/i),
  R('Groceries & Markets', 'Supermart / provision', 'Medium', /\bBARGAIN CENTRE\b|\bSUPERVALUE\b|\bTIDBITS\b|DRY GOODS|\bPRODUCE MART\b/i),
  R('Groceries & Markets', 'Supermart / provision', 'Medium', /\bSMARKET\b|\bVALUEHUB\b|\bBUDGETVALUE\b|\bDOLLAR\s?HOUSE\b|\bSUPER BUDGET\b|\bMINI\s?MARKET\b|\bPROVISON\b/i),
  R('Groceries & Markets', 'Food supplies / dried goods', 'Medium', /DRIED GOODS|FOODSTUFF|FOOD SUPPL|FROZEN FOOD|GRAIN(S)?\b|RICE WHOLESAL|SPICE(S)?\b|\bTONIC\b/i),

  R('Restaurants & Food', 'Restaurant / bistro', 'High', /RESTAURANT|BISTRO|EATING HOUSE|STEAKHOUSE|PIZZERIA|DINER\b|HOT ?POT|FOOD ?COURT|FOOD CENTRE|KITCHEN\b/i),
  R('Restaurants & Food', 'Hawker / cooked food', 'High', /\bWESTERN\b|YONG TAU FOO|YONG TAO HU|YONG TAU FU|MEEHOON|MEE HOON|\bRAMEN\b|DONBURI|SHOKUDO|\bMOOKATA\b|\bCHEONG FUN\b|\bCLAYPOT\b|\bPRATA\b|\bYOUTIAO\b|\bYOUTIAO\b|\bBAKSO\b|\bMAMAK\b|\bWARONG\b|\bWARUNG\b|NASI PADANG|\bAMBENG\b|\bPAO FAN\b|\bPRAWN MEE\b|\bWANTON MEE\b|\bMEE SIAM\b|\bMEE REBUS\b|\bPOPIAH\b|\bMEE GORENG\b|\bZICHAR\b|\bCHAR SIEW\b|\bSHU SHI\b/i),
  R('Restaurants & Food', 'Hawker / cooked food', 'High', /\bBEEHOON\b|\bBAI LI XIANG BEEHOON\b|\bZHI CHAR\b|\bTZE CHAR\b|\bLIANG BAN\b|\bSTIR FRY\b|\bBRAISED\b|\bPENYET\b|\bIKAN BAKAR\b|\bROTI\b|\bHALAL FOOD\b|\bPISANG GORENG\b|\bGORENG PISANG\b|\bPOT\s?RICE\b|\bBARBECUE MEAT\b|\bBAK KWA\b|\bBARBE?CUE\b|\bMUTTON SOUP\b|\bBEEF NOODLE\b|\bGRILL\b|\bCRISPY GORENG\b|\bGORENG\b|\bHAO CHI\b/i),
  R('Restaurants & Food', 'Hawker / cooked food', 'High', /\bROASTER(S)?\b|\bROSTED\b|\bCHARGRILL(ED)?\b|\bGRILLHOOD\b|\bKITCHENETTE\b|\bHANDMADE NOODL\b|\bYONG TAUFU\b|\bYONG TAO FOO\b|\bYONG TAO FU\b|\bNIANG TAU FU\b|\bMA LA XIANG GUO\b|\bCHICKEN WING\b|\bROASTERS\b|\bJJAJANG\b|\bTOFU SOUP\b|\bHAINANESE CHICKEN\b/i),
  R('Restaurants & Food', 'Prepared dishes', 'High', /\bFRIED\b|\bROAST\b|\bROASTING\b|\bGRILLED\b|\bBBQ\b|\bCHICKEN WINGS\b|\bSKEWER(S)?\b|\bHOTPLATE\b|\bSOTO\b|\bCURRY PUFF\b|\bPASTA\b|\bSPAGHETTI\b|\bMASALAA?\b|\bDAL\s?CHA\b/i),
  R('Restaurants & Food', 'Hawker / cooked food', 'High', /KWAY CHAP|KUEY CHAP|KWAY TEOW|KW(E|A)Y T(E|O)OW|BEE HOON|MEE\b|MIAN\b|NOODLE|RICE\b|NASI\b|BIRYANI|BRIYANI|PORRIDGE|SOUP\b|YONG TAU FU|BAK KUT TEH|ROTI PRATA|CHAR KWAY|CURRY\b|HOKKIEN|DIM SUM|DIMS?UM|CHICKEN RICE|DUCK RICE|ROASTED|ROAST MEAT|WANTON|WONTON|LAKSA|SATAY|WESTERN GRILL|WESTERN FOOD|\bBBQ\b|ROJAK|MALA\b|FISHBALL|FRIED CARROT|FRIED PRAWN|ZHI CHAR|ZI CHAR|ZHU CHAO|BAN MIAN|MUTTON|MURTABAK|POP(I|P)AH|MAKAN|SIZZLING HOTPLATE|NGOH HIANG|WU XIANG|PRAWN FRITTER|TOM YUM|KEBAB|DUMPLING|AYAM PENYET|LAO HUO TANG|VEGETERIAN|MIXED VEG|\bTENDERBEST\b/i),
  R('Restaurants & Food', 'Food / prepared meals', 'Medium', /\bCHEF\b|\bEATS\b|\bDELICIOUS\b|\bDELIGHTS?\b|\bYUMMY\b|\bGOURMET\b|\bFLAVOU?R(S)?\b|\bBREAKFAST\b|\bGASTRONOMY\b|\bSHI WU\b|\bHAO CHI\b|\bJIAK\b|\bBAO FAN\b|\bPAO FANG\b|\bXIAO SHI\b/i),
  R('Restaurants & Food', 'Named eateries', 'Medium', /\bQI JI\b|\bTAMAN SELERA\b|\bCHUAN XIANG LOU\b|\bJUST NANYANG\b|\bIZAKAYA\b|\bJJ?AJANG\b|\bDULUKALA\b|\bPERANAKAN\b|\bMAKAN\b|\bCHINATOWN BEEF\b|\bFAMOUS PRATA\b|\bEAT BAR\b/i),
  R('Restaurants & Food', 'Cuisine / prepared meals', 'Medium', /CUISINE|COOKED FOOD|\bFOOD\b|\bF&B\b|DELICAC(Y|IES)|VEGETARIAN|SEAFOOD|STEAK|SUSHI|SASHIMI|JAPANESE|KOREAN|THAI\b|INDIAN\b|MUSLIM\b|MALAY\b|CHINESE\b|\bPIZZA\b|\bBURGER\b|\bGRILL\b|\bWOK\b|\bSNACK(S)?\b|\bTASTE\b|\bEATERY\b|\bDINING\b/i),
  R('Other Retail', 'Retail / supplies', 'Medium', /\bRETAIL\b|SHOP\b|\bSTORE\b|TRADING\b|GENERAL MERCHANT|\bSUPPL(Y|IES)\b|COLLECTIBLES/i),
];

function classify(name, merchant = {}) {
  const normalized = String(name || '').normalize('NFKC').toUpperCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
  // Context overrides: generic terms can mean something different in a dish
  // or service name. Apply these before individual keyword rules.
  if (/MIXED VEG RICE|\bVEG FOOD\b|\bVEG RICE\b|\bFRIED KUEH TEOW\b|\bPAU DIM SUM\b|\bDIM SUM\b/.test(normalized)) {
    return {category: 'Restaurants & Food', subcategory: 'Hawker / cooked food', confidence: 'High'};
  }
  if (/\bSPA\b|\bMASSAGE\b|\bREFLEXOLOGY\b/.test(normalized)) {
    return {category: 'Beauty & Wellness', subcategory: 'Spa / massage', confidence: 'High'};
  }
  for (const rule of BRAND_RULES) {
    if (rule.pattern.test(normalized)) return {category: rule.category, subcategory: rule.subcategory, confidence: rule.confidence};
  }
  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) return {category: rule.category, subcategory: rule.subcategory, confidence: rule.confidence};
  }
  // An actual GoWhere budget-meal flag is stronger evidence than a generic merchant name.
  if (merchant.filters?.secondary?.budgetmeal) {
    return {category: 'Restaurants & Food', subcategory: 'Budget meal outlet', confidence: 'High'};
  }
  // No manual review request: leave an honest "Unclassified" label until a
  // trustworthy source reveals what the merchant actually offers.
  return {category: 'Unclassified', subcategory: 'Insufficient listing details', confidence: 'Insufficient evidence'};
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
  const cls = classify(merchant.name, merchant);
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
