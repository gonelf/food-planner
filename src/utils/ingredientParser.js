/**
 * ingredientParser.js
 *
 * Converts recipe ingredients into shopping list items.
 *
 * Supports two ingredient formats:
 *   - Structured objects: { qty, unit, name, prep }  ← new, preferred
 *   - Legacy free-text strings                        ← kept for compatibility
 *
 * Pipeline: parse → normalise name → aggregate → format for display
 */

// ─── Rice type normalisation ──────────────────────────────────────────────────
// Maps substrings found in rice ingredient names to common store names.
const RICE_TYPE_MAP = [
  { pattern: /arbóreo|arbório/i,            name: 'arroz de sushi' }, // per user spec
  { pattern: /carolino/i,                   name: 'arroz carolino' },
  { pattern: /agulha/i,                     name: 'arroz agulha' },
  { pattern: /basmati/i,                    name: 'arroz basmati' },
  { pattern: /jasmim|jasmine/i,             name: 'arroz jasmim' },
  { pattern: /vaporizado/i,                 name: 'arroz vaporizado' },
  { pattern: /calrose|sushi|grão[\s-]+curto/i, name: 'arroz de sushi' },
  { pattern: /integral/i,                   name: 'arroz integral' },
  { pattern: /selvagem/i,                   name: 'arroz selvagem' },
];

// ─── Liquid keywords (cup → ml instead of grams) ─────────────────────────────
const LIQUID_KEYWORDS = [
  'leite', 'água', 'vinho', 'azeite', 'óleo', 'caldo',
  'sumo', 'vinagre', 'nata', 'iogurte', 'molho',
];

// ─── Cup/spoon conversion factors ─────────────────────────────────────────────
const CUP_TO_GRAMS  = 200;   // 1 chávena dry goods
const CUP_TO_ML     = 200;   // 1 chávena liquid
const TBSP_TO_GRAMS = 12;
const TBSP_TO_ML    = 15;
const TSP_TO_GRAMS  = 4;
const TSP_TO_ML     = 5;

// ─── Preparation patterns ─────────────────────────────────────────────────────
//
// Two-stage model: quantity | ingredient | preparation
//
// Stage 1 – PREP_START_RE: detects where preparation begins and strips
//   everything from that point to the end of the string.
//   "1 cebola suada em azeite"  → "1 cebola"
//   "bacalhau demolhado desfiado" → "bacalhau"
//
// Stage 2 – PREP_MODIFIER_RE: removes standalone modifiers that can appear
//   anywhere within the ingredient name (size, state, etc.).
//   "2 cebolas grandes" → "2 cebolas"

// Strips from the first preparation word to the end of the string.
const PREP_START_RE = [
  // Parenthesised instructions: (sem pele), (sem espinhas), …
  /\s*\([^)]*\)/g,
  // Past-participle cooking verbs (optionally preceded by bem/muito)
  // e.g. suada, picado, cortadas, demolhado, desfiado, refogada, temperado …
  /\s+(?:(?:bem|muito)\s+)?(?:picad|cortad|fatiad|esmagad|demolhad|desfiad|cozid|assad|laminad|lavad|temperad|marinad|ralad|suad|refogad)[ao]s?\b.*/gi,
  // "em [shape]" cutting styles or "em [fat/liquid]" cooking medium
  /\s+em\s+(?:finas?\s+)?(?:meias-luas|cubos?|rodelas?|tiras?|pedaços?|juliana|picadinho|cubinhos?|azeite|manteiga|óleo|gordura|banha)\b.*/gi,
  // Other prep phrases
  /\s+(?:a\s+rigor|num\s+ralador\s+(?:grosso|fino)|de\s+véspera|previamente\b.*)\b.*/gi,
];

// Removes standalone modifiers (replaced with space, cleaned up later).
const PREP_MODIFIER_RE = [
  /\s+(?:muito\s+)?finamente\b/gi,
  /\s+(?:secos?|frios?|quentes?|mornos?|soltos?)\b/gi,
  /\s+fresco[s]?\b(?!\s+de\s+coentros|\s+de\s+salsa)/gi,
  /\s+autêntico\b/gi,
  /\s+(?:grandes?|pequen[oa]s?|médi[oa]s?|gross[oa]s?|alt[oa]s?|madur[oa]s?|fin[oa]s?)\b/gi,
];

// ─── SPLITTING ────────────────────────────────────────────────────────────────

/**
 * Returns true if text looks like the start of a new ingredient item.
 */
function startsNewItem(text) {
  return /^(\d+(?:[,.]\d+)?(?:\/\d+)?|\d+[-–]\d+|q\.b\.|uma?\s+(?:fio|cálice|pitada|punhado)|cerca\s+de\s+\d)/i.test(text.trim());
}

/**
 * Splits a multi-ingredient string on ", " when ≥2 segments look like
 * independent items (i.e. start with a quantity or "q.b.").
 */
function splitIngredientText(text) {
  const segments = text.split(/,\s+/);
  if (segments.length <= 1) return [text];

  const newCount = segments.filter(s => startsNewItem(s)).length;
  if (newCount < 2) return [text];

  const result = [];
  let current = '';
  for (const seg of segments) {
    if (current && startsNewItem(seg)) {
      result.push(current.trim());
      current = seg;
    } else {
      current = current ? `${current}, ${seg}` : seg;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result.filter(s => s.length > 1);
}

// ─── QUANTITY + UNIT PARSING ──────────────────────────────────────────────────

const UNIT_PATTERNS = [
  { re: /^kg\b\s*(?:de\s+)?/i,                    unit: 'kg',             type: 'weight',  factor: 1000 },
  { re: /^quilogramas?\b\s*(?:de\s+)?/i,           unit: 'kg',             type: 'weight',  factor: 1000 },
  { re: /^g\b\s*(?:de\s+)?/i,                      unit: 'g',              type: 'weight',  factor: 1 },
  { re: /^gr\b\s*(?:de\s+)?/i,                     unit: 'g',              type: 'weight',  factor: 1 },
  { re: /^gramas?\b\s*(?:de\s+)?/i,                unit: 'g',              type: 'weight',  factor: 1 },
  { re: /^litros?\b\s*(?:de\s+)?/i,                unit: 'L',              type: 'volume',  factor: 1000 },
  { re: /^l\b\s*(?:de\s+)?/i,                      unit: 'L',              type: 'volume',  factor: 1000 },
  { re: /^dl\b\s*(?:de\s+)?/i,                     unit: 'dl',             type: 'volume',  factor: 100 },
  { re: /^ml\b\s*(?:de\s+)?/i,                     unit: 'ml',             type: 'volume',  factor: 1 },
  { re: /^mililitros?\b\s*(?:de\s+)?/i,            unit: 'ml',             type: 'volume',  factor: 1 },
  { re: /^chávenas?\b\s*(?:de\s+)?/i,              unit: 'chávena',        type: 'cup' },
  { re: /^medidas?\b\s*(?:de\s+)?/i,               unit: 'chávena',        type: 'cup' },
  { re: /^copos?\b\s*(?:de\s+)?/i,                 unit: 'copo',           type: 'cup' },
  { re: /^colheres?\s+de\s+sopa\b\s*(?:de\s+)?/i,  unit: 'colher de sopa', type: 'spoon' },
  { re: /^c\.\s*de\s*sopa\b\s*(?:de\s+)?/i,        unit: 'colher de sopa', type: 'spoon' },
  { re: /^c\.s\.\b\s*(?:de\s+)?/i,                 unit: 'colher de sopa', type: 'spoon' },
  { re: /^colheres?\s+de\s+chá\b\s*(?:de\s+)?/i,   unit: 'colher de chá',  type: 'spoon' },
  { re: /^c\.\s*de\s*chá\b\s*(?:de\s+)?/i,         unit: 'colher de chá',  type: 'spoon' },
  { re: /^c\.c\.\b\s*(?:de\s+)?/i,                 unit: 'colher de chá',  type: 'spoon' },
  { re: /^latas?\b\s*(?:de\s+)?/i,                 unit: 'lata',           type: 'count' },
  { re: /^frascos?\b\s*(?:de\s+)?/i,               unit: 'frasco',         type: 'count' },
  { re: /^embalagens?\b\s*(?:de\s+)?/i,            unit: 'embalagem',      type: 'count' },
  { re: /^dentes?\s+de\s+/i,                       unit: 'dente',          type: 'garlic' },
  { re: /^folhas?\b\s*(?:de\s+)?/i,                unit: 'folha',          type: 'count' },
  { re: /^pacotes?\b\s*(?:de\s+)?/i,               unit: 'pacote',         type: 'count' },
  { re: /^potes?\b\s*(?:de\s+)?/i,                 unit: 'pote',           type: 'count' },
];

/**
 * Parses a number at the start of text.
 * Handles "1", "1,5", "1.5", "3/4", "3-4", "Uma"/"Um".
 */
function parseNumber(text) {
  // "Uma"/"Um" → 1
  const wordMatch = text.match(/^(uma?)\s+/i);
  if (wordMatch) return { value: 1, rest: text.slice(wordMatch[0].length) };

  // Fraction like "3/4 de chávena"
  const fracMatch = text.match(/^(\d+)\/(\d+)\s+(?:de\s+)?/);
  if (fracMatch) {
    return {
      value: parseInt(fracMatch[1]) / parseInt(fracMatch[2]),
      rest: text.slice(fracMatch[0].length),
    };
  }

  // Decimal / integer
  const numMatch = text.match(/^(\d+(?:[,.]\d+)?)\s*/);
  if (numMatch) {
    return {
      value: parseFloat(numMatch[1].replace(',', '.')),
      rest: text.slice(numMatch[0].length),
    };
  }

  // Range "2-3" or "3 a 4" → average
  const rangeMatch = text.match(/^(\d+)\s*[-–a]\s*(\d+)\s*/);
  if (rangeMatch) {
    return {
      value: (parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2,
      rest: text.slice(rangeMatch[0].length),
    };
  }

  return null;
}

/**
 * Extracts { quantity, unit, type, factor, rest } from an ingredient string.
 * Returns null quantity/unit when no number is found.
 */
function parseQuantityAndUnit(text) {
  text = text.trim();

  // "q.b." → no quantity
  if (/^q\.b\./i.test(text)) {
    return { quantity: null, unit: null, type: 'qb', rest: text.replace(/^q\.b\.?\s*/i, '') };
  }

  // "cerca de X"
  text = text.replace(/^cerca\s+de\s+/i, '');

  const num = parseNumber(text);
  if (!num) return { quantity: null, unit: null, type: 'nounit', rest: text };

  const { value: quantity, rest: afterNum } = num;

  for (const { re, unit, type, factor } of UNIT_PATTERNS) {
    const m = afterNum.match(re);
    if (m) {
      const rest = afterNum.slice(m[0].length).trim();
      return { quantity, unit, type, factor: factor || 1, rest };
    }
  }

  // No unit – treat as count
  return { quantity, unit: 'un', type: 'count', factor: 1, rest: afterNum };
}

// ─── INGREDIENT NAME NORMALISATION ───────────────────────────────────────────

function normaliseRice(name) {
  for (const { pattern, name: mapped } of RICE_TYPE_MAP) {
    if (pattern.test(name)) return mapped;
  }
  return 'arroz';
}

/**
 * Cleans up an ingredient name string:
 * removes prep instructions, size words, trailing connectors.
 */
function normaliseIngredientName(raw) {
  let name = raw.trim();

  // Stage 1: strip from the first preparation marker to end of string
  for (const re of PREP_START_RE) {
    name = name.replace(re, '');
  }

  // Stage 2: strip standalone modifiers (size, temperature, etc.)
  for (const re of PREP_MODIFIER_RE) {
    name = name.replace(re, ' ');
  }

  // Clean up whitespace, trailing commas/connectors
  name = name.replace(/\s+/g, ' ').trim();
  name = name.replace(/[,\s]+$/, '').trim();
  name = name.replace(/\s+(e|ou)\s*$/, '').trim();

  name = name.toLowerCase();

  // Rice normalisation
  if (/^arroz\b/.test(name)) return normaliseRice(name);

  // "lombos/filetes/postas de X" → "X"
  const fishCutMatch = name.match(/^(?:lombos?|filetes?|postas?|tranches?|medalhões?)\s+(?:de\s+)?(.+)$/);
  if (fishCutMatch) return fishCutMatch[1].trim();

  // "dentes de alho" → "alho"
  if (/^dentes?\s+de\s+alho$/.test(name)) return 'alho';

  // "folha de louro" → "louro"
  if (/^folha[s]?\s+de\s+louro$/.test(name)) return 'louro';

  return name;
}

// ─── UNIT CONVERSION TO CANONICAL BASE ───────────────────────────────────────

function isLiquid(name) {
  return LIQUID_KEYWORDS.some(k => name.includes(k));
}

/**
 * Converts (quantity, unit, type) to { valueInBase, baseUnit: 'g'|'ml' }.
 * Returns null for count items that cannot be converted.
 */
function toBase(quantity, unit, type, name) {
  switch (type) {
    case 'weight':
      return { valueInBase: quantity * (unit === 'kg' ? 1000 : 1), baseUnit: 'g' };
    case 'volume': {
      const factors = { 'L': 1000, 'dl': 100, 'ml': 1 };
      return { valueInBase: quantity * (factors[unit] || 1), baseUnit: 'ml' };
    }
    case 'cup':
      return isLiquid(name)
        ? { valueInBase: quantity * CUP_TO_ML,    baseUnit: 'ml' }
        : { valueInBase: quantity * CUP_TO_GRAMS, baseUnit: 'g'  };
    case 'spoon': {
      const isTbsp = unit === 'colher de sopa';
      return isLiquid(name)
        ? { valueInBase: quantity * (isTbsp ? TBSP_TO_ML    : TSP_TO_ML),    baseUnit: 'ml' }
        : { valueInBase: quantity * (isTbsp ? TBSP_TO_GRAMS : TSP_TO_GRAMS), baseUnit: 'g'  };
    }
    default:
      return null;
  }
}

// ─── DISPLAY FORMATTING ───────────────────────────────────────────────────────

function fmtNum(n) {
  if (n % 1 === 0) return String(n);
  return n.toFixed(1).replace('.', ',');
}

function fmtGrams(g) {
  return g >= 1000 ? `${fmtNum(g / 1000)} kg` : `${Math.round(g)} g`;
}

function fmtMl(ml) {
  return ml >= 1000 ? `${fmtNum(ml / 1000)} L` : `${Math.round(ml)} ml`;
}

function formatIngredient(item) {
  const { name, quantity, unit, type, sumBase, sumUnit } = item;

  // Aggregated weight or volume
  if (sumBase != null && sumUnit) {
    const qtyStr = sumUnit === 'g' ? fmtGrams(sumBase) : fmtMl(sumBase);
    return `${qtyStr} de ${name}`;
  }

  // q.b. or no quantity
  if (quantity == null || type === 'qb' || type === 'nounit') {
    return type === 'qb' ? `${name} (q.b.)` : name;
  }

  // Convert to base if possible
  const base = toBase(quantity, unit, type, name);
  if (base) {
    const qtyStr = base.baseUnit === 'g' ? fmtGrams(base.valueInBase) : fmtMl(base.valueInBase);
    return `${qtyStr} de ${name}`;
  }

  // Count items: "3 ovos", "2 latas de atum"
  const qtyStr = fmtNum(quantity);
  if (!unit || unit === 'un') return `${qtyStr} ${name}`;

  // unit = 'lata', 'frasco', 'dente', 'folha', etc.
  const plural = quantity !== 1;
  const unitDisplay = plural
    ? (unit.endsWith('a') ? unit + 's' : unit + 's')  // lata→latas, frasco→frascos
    : unit;
  return `${qtyStr} ${unitDisplay} de ${name}`;
}

// ─── STRUCTURED INGREDIENT PARSING ───────────────────────────────────────────

// Maps the unit strings used in the structured recipe format to internal types.
const UNIT_TYPE_MAP = {
  'g':              { type: 'weight', factor: 1 },
  'kg':             { type: 'weight', factor: 1000 },
  'ml':             { type: 'volume', factor: 1 },
  'dl':             { type: 'volume', factor: 100 },
  'L':              { type: 'volume', factor: 1000 },
  'chávena':        { type: 'cup' },
  'copo':           { type: 'cup' },
  'colher de sopa': { type: 'spoon' },
  'colher de chá':  { type: 'spoon' },
  'lata':           { type: 'count' },
  'frasco':         { type: 'count' },
  'embalagem':      { type: 'count' },
  'dente':          { type: 'garlic' },
  'folha':          { type: 'count' },
  'pacote':         { type: 'count' },
  'pote':           { type: 'count' },
};

/**
 * Converts a structured ingredient object { qty, unit, name, prep } into the
 * internal parsed form used by aggregateItems / formatIngredient.
 * The `prep` field is intentionally ignored for shopping list purposes.
 */
function parseStructuredItem({ qty, unit, name }) {
  const normName = normaliseIngredientName(name || '');
  if (!normName || normName.length < 2) return null;

  // q.b. or missing quantity
  if (!qty || qty === 'q.b.') {
    return { name: normName, quantity: null, unit: null, type: qty === 'q.b.' ? 'qb' : 'nounit', factor: 1 };
  }

  // Parse qty string → number
  let quantity;
  if (qty.includes('/')) {
    const [a, b] = qty.split('/').map(Number);
    quantity = a / b;
  } else if (/[-–]/.test(qty)) {
    const parts = qty.split(/[-–]/).map(Number);
    quantity = (parts[0] + parts[1]) / 2;
  } else {
    quantity = parseFloat(String(qty).replace(',', '.'));
  }
  if (isNaN(quantity)) {
    return { name: normName, quantity: null, unit: null, type: 'nounit', factor: 1 };
  }

  // Map unit string → type/factor
  const unitInfo = unit ? UNIT_TYPE_MAP[unit] : null;
  return {
    name:     normName,
    quantity,
    unit:     unit || 'un',
    type:     unitInfo ? unitInfo.type : 'count',
    factor:   unitInfo ? (unitInfo.factor || 1) : 1,
  };
}

// ─── LEGACY STRING PARSING ────────────────────────────────────────────────────

function parseSingleItem(text) {
  if (!text || text.length < 2) return null;

  // Skip pure instruction lines like "Acompanhamento: …"
  if (/^acompanhamento:/i.test(text)) return null;

  const { quantity, unit, type, factor, rest } = parseQuantityAndUnit(text);
  if (!rest || rest.length < 2) return null;

  const name = normaliseIngredientName(rest);
  if (!name || name.length < 2) return null;

  return { name, quantity, unit, type, factor, originalText: text };
}

// ─── AGGREGATION ─────────────────────────────────────────────────────────────

/**
 * Groups parsed items by normalised name, summing quantities where possible.
 */
function aggregateItems(items) {
  const map = new Map();

  for (const item of items) {
    const key = item.name;

    if (!map.has(key)) {
      map.set(key, { ...item });
      continue;
    }

    const existing = map.get(key);

    // Attempt to sum
    if (item.quantity != null && existing.quantity != null) {
      const baseA = toBase(existing.quantity, existing.unit, existing.type, key);
      const baseB = toBase(item.quantity, item.unit, item.type, key);

      if (baseA && baseB && baseA.baseUnit === baseB.baseUnit) {
        // Both convertible to same unit – accumulate in sumBase/sumUnit
        existing.sumBase = (existing.sumBase ?? baseA.valueInBase) + baseB.valueInBase;
        existing.sumUnit = baseA.baseUnit;
      } else if (!baseA && !baseB) {
        // Both plain counts – just add
        existing.quantity += item.quantity;
      }
      // Mixed (e.g. one in g, one in count) – keep first occurrence
    }
  }

  return Array.from(map.values());
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Takes all ingredients from the weekly planner and returns shopping list items.
 *
 * Accepts:
 *   - Structured objects { qty, unit, name, prep }  (new format)
 *   - Free-text strings                              (legacy format)
 *
 * Each returned item: { name, displayText, quantity, unit, type }
 */
export function buildShoppingList(allIngredients) {
  // 1. Parse each ingredient (structured or legacy string)
  const parsed = allIngredients
    .flatMap(ing => {
      if (ing && typeof ing === 'object') {
        const item = parseStructuredItem(ing);
        return item ? [item] : [];
      }
      // Legacy: split multi-ingredient strings then parse each
      return splitIngredientText(String(ing)).map(parseSingleItem).filter(Boolean);
    });

  // 2. Aggregate identical ingredients
  const aggregated = aggregateItems(parsed);

  // 3. Add display text
  return aggregated.map(item => ({
    ...item,
    displayText: formatIngredient(item),
  }));
}
