// Turns a store listing into a base nut and a flavor, so a salt-and-pepper
// cashew is not averaged into the plain cashew price.

export const FLAVORS = [
  {
    id: "salt-pepper",
    label: "Salt & pepper",
    patterns: [/salt\s*(?:&|and|n)\s*pepper/, /salt\s*pepper/, /kali\s*mirch/],
  },
  {
    id: "peri-peri",
    label: "Peri peri",
    patterns: [/peri[\s-]*peri/, /piri[\s-]*piri/],
  },
  {
    id: "cream-onion",
    label: "Cream & onion",
    patterns: [/cream\s*(?:&|and|n)\s*onion/],
  },
  {
    id: "cheese",
    label: "Cheese",
    patterns: [/\bcheese\b/, /cheesy/],
  },
  {
    id: "pudina",
    label: "Pudina",
    patterns: [/pudina/, /\bmint\b/],
  },
  {
    id: "masala",
    label: "Masala",
    patterns: [/\bmasala\b/, /chatpata/, /\bachari\b/],
  },
  {
    id: "chilli",
    label: "Chilli",
    patterns: [/chilli/, /chili/, /schezwan/, /sichuan/],
  },
  {
    id: "caramel",
    label: "Caramel / honey",
    patterns: [/caramel/, /\bhoney\b/, /jaggery/],
  },
  {
    id: "chocolate",
    label: "Chocolate",
    patterns: [/chocolate/, /\bcocoa\b/],
  },
  {
    id: "salted",
    label: "Salted",
    patterns: [/\bsalted\b/, /\bnamkeen\b/],
  },
  {
    id: "roasted",
    label: "Roasted",
    patterns: [/\broasted\b/],
  },
  {
    id: "plain",
    label: "Plain",
    patterns: [/\bplain\b/, /\braw\b/, /unflavou?red/, /\bnatural\b/, /unroasted/],
  },
];

const MIX_PATTERNS = [/\bgift\b/, /\bcombo\b/, /trail\s*mix/, /\braisins?\b/, /\bkishmish\b/];

const BASES = [
  { id: "makhana", label: "Makhana", patterns: [/makhana/, /fox\s*nuts?/, /phool\s*makhana/, /lotus\s*seeds?/] },
  { id: "cashew", label: "Cashew", patterns: [/cashews?/, /\bkaju\b/] },
  { id: "almond", label: "Almond", patterns: [/almonds?/, /\bbadam\b/] },
];

const VARIETIES = [
  { label: "Mamra", pattern: /mamra/ },
  { label: "Kashmiri", pattern: /kashmiri/ },
  { label: "California", pattern: /california/ },
  { label: "Australian", pattern: /australian/ },
];

const PREMIUM_VARIETIES = new Set(["Mamra", "Kashmiri"]);

export const FAMILIES = [
  {
    id: "almond",
    name: "Almonds",
    alsoCalled: "Badam, badam giri",
    query: "almonds",
    synonyms: { almonds: ["badam", "badam giri"] },
    category: "Nuts & Seeds",
    flavorIds: ["plain", "roasted", "salted"],
    guidance:
      "Search the word almonds. Plain, roasted, and salted packs all come back together, and the breakdown below keeps their prices apart. A search for only “salted almonds” would hide the plain price.",
  },
  {
    id: "cashew",
    name: "Cashews",
    alsoCalled: "Kaju",
    query: "cashews",
    synonyms: { cashews: ["kaju"] },
    category: "Nuts & Seeds",
    flavorIds: ["plain", "roasted", "salted", "salt-pepper", "peri-peri", "masala"],
    guidance:
      "Search cashews, not “salt and pepper cashews”. Salt & pepper, peri peri, masala, and plain packs all contain the word cashew, so one scrape can be split afterwards. Salt & pepper is priced on its own and is not folded into plain.",
  },
  {
    id: "makhana",
    name: "Makhana",
    alsoCalled: "Fox nuts, phool makhana",
    query: "makhana",
    synonyms: { makhana: ["fox nuts", "phool makhana", "lotus seeds"] },
    category: "Snacks & Namkeens",
    flavorIds: ["plain", "roasted", "salted", "peri-peri", "cream-onion", "pudina", "cheese", "masala", "salt-pepper"],
    guidance:
      "Stores title the same snack as makhana, fox nuts, or phool makhana. Search makhana once so peri peri, cream & onion, pudina, cheese, and plain land in one list, then read each flavor’s own price.",
  },
];

export function weightKg(packaging) {
  let text = String(packaging || "").toLowerCase().replace("×", "x");
  text = text.split(/\bor\b/)[0];
  let grams = 0;
  const take = (pattern, calc) => {
    [...text.matchAll(pattern)].forEach((match) => {
      grams += calc(match);
    });
    text = text.replace(pattern, " ");
  };
  take(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g)\b/g, (match) => (
    Number(match[1]) * Number(match[2]) * (match[3] === "kg" ? 1000 : 1)
  ));
  take(/(\d+(?:\.\d+)?)\s*(kg|g)\s*x\s*(\d+)\b/g, (match) => (
    Number(match[1]) * (match[2] === "kg" ? 1000 : 1) * Number(match[3])
  ));
  take(/(\d+(?:\.\d+)?)\s*(kg|g)\b/g, (match) => (
    Number(match[1]) * (match[2] === "kg" ? 1000 : 1)
  ));
  return grams > 0 ? grams / 1000 : 0;
}

export function flavorById(id) {
  return FLAVORS.find((flavor) => flavor.id === id);
}

export function familyIdFromText(text) {
  const name = String(text || "").toLowerCase();
  const base = BASES.find((entry) => entry.patterns.some((pattern) => pattern.test(name)));
  return base ? base.id : null;
}

export function toTitleCase(value) {
  return String(value || "").replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g, (word) => {
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

export function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0%";
  return `${Math.round(number)}%`;
}

export function classifyListing(item) {
  const name = String(item.product_name || item.scraped_name || "").toLowerCase();
  const matchedBases = BASES.filter((base) => base.patterns.some((pattern) => pattern.test(name)));
  const isMix = MIX_PATTERNS.some((pattern) => pattern.test(name)) || matchedBases.length > 1;
  const base = matchedBases[0];

  let flavor = null;
  if (!isMix) {
    flavor = FLAVORS.find((entry) => entry.patterns.some((pattern) => pattern.test(name)));
    if (!flavor) flavor = flavorById("plain");
  }

  const kilos = weightKg(item.packaging_size);
  const shelf = Number(item.discounted_price) || 0;
  const pricePerKg = kilos && shelf ? shelf / kilos : Number(item.price_per_kg) || 0;

  return {
    baseId: base ? base.id : "other",
    baseLabel: base ? base.label : "Other",
    flavorId: isMix ? "mix" : flavor.id,
    flavorLabel: isMix ? "Mix" : flavor.label,
    displayName: toTitleCase(item.product_name || item.scraped_name || ""),
    varieties: VARIETIES.filter((variety) => variety.pattern.test(name)).map((variety) => variety.label),
    comparable: !isMix && pricePerKg > 0,
    pricePerKg,
  };
}

function median(values) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarize(id, rows, allRows) {
  const flavor = flavorById(id);
  const prices = rows.map((row) => row.pricePerKg).filter((price) => price > 0);
  const cheapest = rows
    .filter((row) => row.pricePerKg > 0)
    .sort((a, b) => a.pricePerKg - b.pricePerKg)[0];
  const premium = [
    ...new Set(rows.flatMap((row) => row.varieties.filter((variety) => PREMIUM_VARIETIES.has(variety)))),
  ];

  let emptyHint = "Nothing in this scrape used this flavor.";
  if (id === "roasted" && rows.length === 0) {
    const roastedAndSalted = allRows.some(
      (row) => row.flavorId === "salted" && /\broasted\b/.test(String(row.item.product_name || "").toLowerCase())
    );
    if (roastedAndSalted) {
      emptyHint = "Roasted packs in this scrape are also salted, so they are counted under Salted.";
    }
  }

  const platforms = {};
  rows.forEach((row) => {
    const name = row.item.platform || "Other";
    platforms[name] = (platforms[name] || 0) + 1;
  });

  return {
    id,
    label: flavor ? flavor.label : id,
    rows,
    count: rows.length,
    median: median(prices),
    low: prices.length ? Math.min(...prices) : null,
    high: prices.length ? Math.max(...prices) : null,
    cheapest,
    premium,
    emptyHint,
    platforms: Object.entries(platforms).map(([name, count]) => ({ name, count })),
  };
}

export function buildFlavorReport(items) {
  const classified = (items || []).map((item) => ({ item, ...classifyListing(item) }));
  const counts = {};
  classified.forEach((row) => {
    if (row.baseId !== "other") counts[row.baseId] = (counts[row.baseId] || 0) + 1;
  });
  const baseId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const family = FAMILIES.find((entry) => entry.id === baseId);
  const ids = [...(family ? family.flavorIds : [])];
  classified.forEach((row) => {
    if (row.flavorId !== "mix" && !ids.includes(row.flavorId)) ids.push(row.flavorId);
  });

  return {
    baseId,
    groups: ids.map((id) => summarize(id, classified.filter((row) => row.flavorId === id), classified)),
    mixes: classified.filter((row) => row.flavorId === "mix"),
    classified,
  };
}

export function formatRupee(value, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}`;
}
