// Pure, DOM-free logic ported directly from license-agreement-builder's
// app.js. Formulas and rounding are carried over exactly -- this file
// generates figures that end up on a legal document, so it deliberately
// mirrors the original line-for-line rather than being "improved".

const MS_PER_DAY = 86400000;

export function parseAmount(value) {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

export function parseMoneyString(str) {
  const n = parseFloat(String(str || "").replace(/[£,]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function formatCurrency(n) {
  const sign = n < 0 ? "-" : "";
  return sign + "£" + Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Just the number part, no £ - for template spots that already have a
// literal £ baked into the surrounding text.
export function formatMoneyPlain(n) {
  return formatCurrency(n).replace("£", "");
}

export function sumItems(items) {
  return (items || []).reduce((total, item) => total + parseAmount(item.amount), 0);
}

export function ukDateToInputValue(ukDateStr) {
  const m = String(ukDateStr || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function inputValueToDate(inputValue) {
  if (!inputValue) return null;
  const parts = inputValue.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

// Same conversion, but for the UI's "as imported vs now" diff display.
export function ukDateForDisplay(inputValue) {
  const d = inputValueToDate(inputValue);
  if (!d) return "(blank)";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Same conversion, for feeding the merge itself - a genuinely blank date
// should merge as an empty string, not the word "(blank)".
export function ukDateForMerge(inputValue) {
  const d = inputValueToDate(inputValue);
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinalSuffix(day) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

// "7th December 2026" - matches the document's existing "1st March" /
// "7th December" wording for season dates, plus the year since this one
// isn't a fixed recurring date.
export function formatOrdinalDate(date) {
  if (!date) return "";
  const day = date.getDate();
  return `${day}${ordinalSuffix(day)} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/* Tree Tops' 4 areas, identified by the first two letters of the pitch
 * number (e.g. "OP" in "OP-E16"). Used only as a fallback before the
 * shared area_seasons table has loaded. */
export const DEFAULT_AREA_SEASON_MAP = [
  { prefix: "OM", seasonLength: 10.5 },
  { prefix: "YH", seasonLength: 9 },
  { prefix: "PN", seasonLength: 9 },
  { prefix: "OP", seasonLength: 9 },
];

export function deriveSeasonLengthForPitch(pitchSite, areaSeasonMap) {
  const prefix = String(pitchSite || "").slice(0, 2).toUpperCase();
  const match = areaSeasonMap.find((m) => m.prefix.toUpperCase() === prefix);
  return { seasonLength: match ? match.seasonLength : 9, prefix, matched: !!match };
}

/* 9-month season: 1 Mar - 7 Dec. 10.5-month season: 1 Feb - 15 Dec. */
export function getSeasonDates(seasonLength, year) {
  return seasonLength === 10.5
    ? { start: new Date(year, 1, 1), end: new Date(year, 11, 15) }
    : { start: new Date(year, 2, 1), end: new Date(year, 11, 7) };
}

/* How much of the current season is left to charge for, from the
 * licence start date to the end of the season. Returned to 1 decimal
 * place; a starting point staff can override. */
export function computeMonthsToCharge(licenceStartDate, seasonLength) {
  if (!licenceStartDate) return seasonLength;
  const { start, end } = getSeasonDates(seasonLength, licenceStartDate.getFullYear());
  const totalDays = (end - start) / MS_PER_DAY;
  let remainingDays = (end - licenceStartDate) / MS_PER_DAY;
  remainingDays = Math.max(0, Math.min(remainingDays, totalDays));
  return Math.round((remainingDays / totalDays) * seasonLength * 10) / 10;
}

/* Campmanager's "Unit Category" (e.g. "OP-Band 1a") matches the Pitch
 * Fees table's description with " Pitch Fees" appended. */
export function lookupPitchFeeFullYear(pitchBand, pitchBandsTable) {
  if (!pitchBand || !pitchBandsTable.length) return null;
  const target = (pitchBand.trim() + " Pitch Fees").toLowerCase();
  const row = pitchBandsTable.find((r) => r.description.toLowerCase() === target);
  return row ? row.gross_price : null;
}

export function computePitchFeeProrataAmount(unit, seasonLength, pitchFeeMonths, pitchBandsTable) {
  const fullYear = lookupPitchFeeFullYear(unit ? unit.pitchBand : "", pitchBandsTable);
  if (fullYear === null) return 0;
  return (fullYear / seasonLength) * parseAmount(pitchFeeMonths);
}

// pitchFeeIncluded defaults to true (bundled into the window price, as
// it's always been) - staff can flip it off when the pitch fee is being
// charged as an add-on instead, on top of the window price.
export function computeCaravanAmount(price, unit, seasonLength, pitchBandsTable) {
  const pitchFeeIncluded = price.pitchFeeIncluded !== false;
  return (
    parseAmount(price.windowPrice) -
    (pitchFeeIncluded ? computePitchFeeProrataAmount(unit, seasonLength, price.pitchFeeMonths, pitchBandsTable) : 0) -
    parseAmount(price.ratesCurrentYear) -
    sumItems(price.includedItems)
  );
}

/* Campmanager joins joint owners' titles and first names with "&" (or
 * similar) into a single field each, e.g. Title "Mr & Mrs", First Name
 * "Jane & Mark" - split those apart into one entry per person. */
export function splitJointField(value) {
  return String(value || "")
    .split(/\s*(?:&|\/|,|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* A best-effort, by-no-means-complete list of common British first names
 * by gender, spanning generations. Used only to sanity-check title/
 * first-name pairing - never authoritative, always overridable. */
const FEMALE_NAMES = new Set(
  "jane,mary,margaret,susan,patricia,jennifer,linda,barbara,elizabeth,dorothy,carol,sandra,donna,ruth,sharon,michelle,laura,sarah,kimberly,deborah,jessica,shirley,cynthia,angela,melissa,brenda,amy,anna,rebecca,virginia,kathleen,pamela,martha,debra,amanda,stephanie,carolyn,christine,marie,janet,catherine,frances,ann,joyce,diane,alice,julie,heather,teresa,doris,gloria,evelyn,jean,cheryl,mildred,katherine,joan,ashley,judith,rose,janice,kelly,nicole,judy,christina,kathy,theresa,beverly,denise,tammy,irene,lori,rachel,marilyn,andrea,kathryn,louise,sara,anne,jacqueline,wanda,bonnie,julia,ruby,lois,tina,phyllis,norma,paula,diana,annie,lillian,emily,robin,peggy,crystal,gladys,rita,dawn,connie,florence,tracy,edna,tiffany,carmen,rosa,cindy,grace,wendy,victoria,edith,kim,sherry,sylvia,josephine,thelma,shannon,sheila,ethel,ellen,elaine,marjorie,carrie,charlotte,monica,esther,pauline,emma,juanita,anita,rhonda,hazel,amber,eva,debbie,april,leslie,clara,lucille,jamie,joanne,eleanor,valerie,danielle,megan,alicia,suzanne,michele,gail,bertha,darlene,veronica,jill,erin,geraldine,lauren,cathy,joann,lorraine,kristin,hannah,natalie,kayla,alexis,olivia,chloe,isabella,sophie,ella,lily,poppy,daisy,freya,phoebe,harriet,matilda,willow,imogen,evie,holly,molly,abigail,katie,zoe,ellie,amelia,isla,niamh,aoife,ffion,gwen,maureen,brenda,pat,val,gaynor,denise,yvonne,bridget,fiona,alison,tracey,karen,lesley,gillian,vera,olive,winifred,agnes,nancy,marion,jayne,shelagh,ivy,eileen,muriel,kathrine".split(",")
);
const MALE_NAMES = new Set(
  "mark,john,james,robert,michael,william,david,richard,joseph,thomas,charles,christopher,daniel,matthew,anthony,donald,paul,andrew,joshua,kenneth,kevin,brian,george,edward,ronald,timothy,jason,jeffrey,ryan,jacob,gary,nicholas,eric,jonathan,stephen,larry,justin,scott,brandon,benjamin,samuel,gregory,frank,raymond,alexander,patrick,jack,dennis,jerry,tyler,aaron,jose,adam,nathan,henry,douglas,zachary,peter,kyle,walter,ethan,jeremy,harold,carl,keith,roger,gerald,christian,terry,sean,arthur,austin,noah,lawrence,jesse,joe,bryan,billy,jordan,albert,dylan,bruce,willie,gabriel,alan,juan,logan,wayne,ralph,roy,eugene,randy,vincent,russell,louis,philip,bobby,johnny,bradley,liam,oscar,harry,leo,oliver,alfie,charlie,freddie,archie,theo,stanley,reggie,norman,derek,colin,trevor,graham,malcolm,clive,barry,neil,gordon,ian,martin,simon,nigel,owen,glen,howard,leonard,victor,cecil,cyril,reginald,ernest,herbert,horace,percy,wilfred,sidney,geoffrey,leslie,maurice,bernard,clifford,dennis,ronnie,ken,les,mike,steve,dave,rob,bill,tony,pete,gareth,rhys,dylan,huw,gwyn".split(",")
);

function guessNameGender(name) {
  const n = String(name || "").trim().toLowerCase().split(/\s+/)[0];
  if (!n) return null;
  const isF = FEMALE_NAMES.has(n);
  const isM = MALE_NAMES.has(n);
  if (isF && !isM) return "F";
  if (isM && !isF) return "M";
  return null;
}

function titleGender(title) {
  const t = String(title || "").trim().toLowerCase().replace(/\./g, "");
  if (t === "mr") return "M";
  if (t === "mrs" || t === "miss" || t === "ms") return "F";
  return null;
}

/* If we can recognise both first names' likely gender and both titles
 * are gendered, and the pairing is backwards for BOTH people (swapping
 * fixes both at once), auto-swap the titles. Only acts when confident;
 * mutates the passed-in array in place and returns whether it swapped,
 * matching the original's contract. */
export function autoCorrectTitlePairing(people) {
  if (people.length !== 2) return false;
  const [a, b] = people;
  const aNameGender = guessNameGender(a.firstName);
  const bNameGender = guessNameGender(b.firstName);
  const aTitleGender = titleGender(a.title);
  const bTitleGender = titleGender(b.title);
  if (!aNameGender || !bNameGender || !aTitleGender || !bTitleGender) return false;

  const currentlyWrong = aNameGender !== aTitleGender && bNameGender !== bTitleGender;
  const swapWouldFixIt = aNameGender === bTitleGender && bNameGender === aTitleGender;
  if (currentlyWrong && swapWouldFixIt) {
    [a.title, b.title] = [b.title, a.title];
    return true;
  }
  return false;
}

/* Best-guess pairing of split titles with split first names, by
 * position - a starting point, not the answer; each row stays fully
 * editable. */
export function derivePeopleFromRow(row) {
  const titles = splitJointField(row["Unit Customer Title"]);
  const firstNames = splitJointField(row["Unit Customer First Name"]);
  const lastName = (row["Unit Customer Last Name"] || "").trim();
  const count = Math.max(titles.length, firstNames.length, 1);
  const people = [];
  for (let i = 0; i < count; i++) {
    people.push({ title: titles[i] || "", firstName: firstNames[i] || "", lastName });
  }
  const autoSwapped = autoCorrectTitlePairing(people);
  return { people, autoSwapped };
}

export function personFullName(person) {
  return [person.title, person.firstName, person.lastName].filter(Boolean).join(" ");
}

export function joinNamesNaturally(names) {
  const list = names.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} & ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;
}

/* The Pitch Fees CSV has no header row: col 0 is a description (e.g.
 * "OP-Band 1a Pitch Fees"), col 3 is the net price, col 6 is the gross
 * (inc VAT) full-year price - that gross figure is what "Pitch Fee per
 * full year, including any VAT" needs. Column 5 (VAT%) is confirmed
 * unused anywhere and deliberately dropped. */
export function parsePitchBandsCsv(text, Papa) {
  const result = Papa.parse(text, { skipEmptyLines: true });
  return result.data
    .filter((cols) => cols.length >= 7 && cols[0])
    .map((cols) => ({
      description: String(cols[0]).trim(),
      net_price: parseMoneyString(cols[3]),
      gross_price: parseMoneyString(cols[6]),
    }));
}

// This wizard never writes back to Campmanager - if staff correct the
// pitch band or a licence date here, that same correction needs making
// there too or the two systems drift apart.
export function getCampmanagerChanges(unit, originalUnit) {
  if (!unit || !originalUnit) return [];
  const changes = [];
  if (unit.pitchBand !== originalUnit.pitchBand) {
    changes.push(`Pitch band: "${originalUnit.pitchBand || "(blank)"}" → "${unit.pitchBand || "(blank)"}"`);
  }
  if (unit.licenceStart !== originalUnit.licenceStart) {
    changes.push(`Licence start date: ${ukDateForDisplay(originalUnit.licenceStart)} → ${ukDateForDisplay(unit.licenceStart)}`);
  }
  if (unit.licenceEnd !== originalUnit.licenceEnd) {
    changes.push(`Licence end date: ${ukDateForDisplay(originalUnit.licenceEnd)} → ${ukDateForDisplay(unit.licenceEnd)}`);
  }
  return changes;
}

// Campmanager has no dedicated "has WiFi" flag, so Unit Registration is
// repurposed to record it: if an included/additional item mentions
// WiFi but Campmanager doesn't have this recorded, remind staff to set
// it there too, so the next sale's auto-detection keeps working.
export function getWifiRegistrationReminder(selectedRow, price) {
  const row = selectedRow || {};
  if (!price || (row["Unit Registration"] || "").trim()) return null;
  const items = [...(price.includedItems || []), ...(price.additionalItems || [])];
  const mentionsWifi = items.some((item) => /wifi/i.test(item.description || ""));
  if (!mentionsWifi) return null;
  return `Set the "Unit Registration" field in Campmanager to "WiFi" — an included/additional item mentions WiFi but Campmanager doesn't have this recorded.`;
}

export function suggestedFileName(selectedRow, people) {
  const row = selectedRow || {};
  const site = (row["Unit Site"] || "pitch").replace(/[^A-Za-z0-9-]/g, "");
  const lastName = people[0] ? (people[0].lastName || "").replace(/[^A-Za-z0-9-]/g, "") : "";
  return `Purchase and Licence Agreement - ${site}${lastName ? " - " + lastName : ""}.docx`;
}

/* Assembles every tag the converted template expects. Nothing here
 * should throw on missing data - a skipped step just merges as blank
 * or zero rather than blocking generation. */
export function buildMergeData({ selectedRow, customer, unit, price, people, buildSpec, firstOwner, specialTerms, seasonLength, pitchBandsTable }) {
  const row = selectedRow || {};
  const cust = customer || {};
  const u = unit || {};
  const p = price || {};
  const ppl = people || [];

  const signeeFullNames = ppl.map(personFullName).filter(Boolean);

  // Pro-rata whenever fewer months than the full season are being
  // charged for (a manually-overridden pitchFeeMonths counts too).
  const pitchFeeMonthsNum = parseAmount(p.pitchFeeMonths);
  const isProRata = pitchFeeMonthsNum < seasonLength - 0.05;
  const licenceStartDate = inputValueToDate(u.licenceStart);
  const seasonEndYear = licenceStartDate ? licenceStartDate.getFullYear() : new Date().getFullYear();
  const proRataEndDate = isProRata ? formatOrdinalDate(getSeasonDates(seasonLength, seasonEndYear).end) : "";

  // Normally bundled into the window price (subtracted from the
  // caravan's own value); staff can mark it as an add-on instead, so it
  // shows under Additional Costs and is charged on top of the window
  // price rather than out of it.
  const pitchFeeIncluded = p.pitchFeeIncluded !== false;
  const pitchFeeAmount = computePitchFeeProrataAmount(u, seasonLength, p.pitchFeeMonths, pitchBandsTable);
  const pitchFeeDescription = isProRata ? `Pitch Fees (Pro-rata until ${proRataEndDate})` : "Pitch Fees";
  const pitchFeeLineItem = { description: pitchFeeDescription, amount: formatCurrency(pitchFeeAmount) };

  const includedItems = [
    { description: p.caravanDescription || "Caravan", amount: formatCurrency(computeCaravanAmount(p, u, seasonLength, pitchBandsTable)) },
    ...(pitchFeeIncluded ? [pitchFeeLineItem] : []),
    { description: "Rates, Water & Refuse", amount: formatCurrency(parseAmount(p.ratesCurrentYear)) },
    ...(p.includedItems || []).map((item) => ({ description: item.description, amount: formatCurrency(parseAmount(item.amount)) })),
  ];
  const additionalItems = [
    ...(pitchFeeIncluded ? [] : [pitchFeeLineItem]),
    ...(p.additionalItems || []).map((item) => ({ description: item.description, amount: formatCurrency(parseAmount(item.amount)) })),
  ];

  const windowPriceTotal = parseAmount(p.windowPrice);
  const grandTotal = windowPriceTotal + sumItems(p.additionalItems || []) + (pitchFeeIncluded ? 0 : pitchFeeAmount);
  const completionDate = p.completionType === "fixed" ? ukDateForMerge(p.completionDate) : "";
  const estimatedCompletionDate = p.completionType === "estimated" ? ukDateForMerge(p.completionDate) : "";

  return {
    Unit_Customer_Title: joinNamesNaturally(ppl.map((x) => x.title).filter(Boolean)),
    Unit_Customer_First_Name: joinNamesNaturally(ppl.map((x) => x.firstName).filter(Boolean)),
    Unit_Customer_Last_Name: joinNamesNaturally([...new Set(ppl.map((x) => x.lastName).filter(Boolean))]),
    Unit_Customer_Address_Line_1: cust.addressLine1 || "",
    Unit_Customer_Address_Line_2: cust.addressLine2 || "",
    Unit_Customer_Address_Line_3: cust.addressLine3 || "",
    Unit_Customer_Address_CityTown: cust.cityTown || "",
    Unit_Customer_Address_Country: cust.country || "",
    Unit_Customer_Address_Postcode: cust.postcode || "",
    Unit_Customer_Telephone: cust.telephone || "",
    Unit_Customer_Mobile: cust.mobile || "",
    Unit_Customer_Email: cust.email || "",

    Unit_Make: row["Unit Make"] || "",
    Unit_Model: row["Unit Model"] || "",
    Unit_Year: row["Unit Year"] || "",
    Unit_Length: row["Unit Length"] || "",
    Unit_Width: row["Unit Width"] || "",
    Unit_Serial_Number: row["Unit Serial Number"] || "",
    Unit_Site: row["Unit Site"] || "",
    Unit_Licence_Start: ukDateForMerge(u.licenceStart),
    Unit_Licence_End: ukDateForMerge(u.licenceEnd),

    en1647_box: buildSpec === "EN 1647" ? "☒" : "☐",
    bs3632_box: buildSpec === "BS 3632" ? "☒" : "☐",
    first_owner_yes_box: firstOwner === "yes" ? "☒" : "☐",
    first_owner_no_box: firstOwner === "no" ? "☒" : "☐",

    special_terms: specialTerms || "None",

    pitch_fee_current_year: formatMoneyPlain(pitchFeeAmount),
    pitch_fee_full_year: formatMoneyPlain(lookupPitchFeeFullYear(u.pitchBand, pitchBandsTable) || 0),
    is_pro_rata: isProRata,
    pro_rata_end_date: proRataEndDate,
    current_year: String(new Date().getFullYear()),

    rates_payment_year: String(p.ratesPaymentYear || ""),
    rates_current_year: formatMoneyPlain(parseAmount(p.ratesCurrentYear)),
    rates_full_year: formatMoneyPlain(parseAmount(p.ratesFullYear)),

    included_items: includedItems,
    agreed_purchase_price: formatCurrency(windowPriceTotal),
    additional_items: additionalItems,
    agreed_total_purchase_price: formatCurrency(grandTotal),

    deposit_amount: formatCurrency(parseAmount(p.deposit && p.deposit.amount)),
    deposit_date: ukDateForMerge(p.deposit && p.deposit.date),
    partex_amount: formatCurrency(parseAmount(p.partExchange && p.partExchange.amount)),
    partex_date: ukDateForMerge(p.partExchange && p.partExchange.date),
    balance_amount: formatCurrency(
      Math.max(grandTotal - parseAmount(p.deposit && p.deposit.amount) - parseAmount(p.partExchange && p.partExchange.amount), 0)
    ),
    balance_date: ukDateForMerge(p.balanceDate),
    completion_date: completionDate,
    estimated_completion_date: estimatedCompletionDate,

    signee_names_joined: joinNamesNaturally(signeeFullNames),
    signees: signeeFullNames.length ? signeeFullNames : [""],
  };
}
