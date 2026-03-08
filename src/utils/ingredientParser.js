/**
 * ingredientParser.js
 *
 * Parses free-form Portuguese ingredient strings into structured shopping items:
 * - Splits multi-ingredient strings (e.g. "Azeite q.b., 3 dentes de alho, 1 folha de louro")
 * - Extracts quantity + unit from each item
 * - Normalises ingredient names (removes prep instructions, maps rice types, etc.)
 * - Converts cups/spoons to grams or ml
 * - Aggregates identical ingredients, summing quantities
 * - Formats the result as a human-readable "300 g de tomate cherry" string
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

// ─── Fish / meat cut normalisation ───────────────────────────────────────────

/** Maps plural cut words to their singular form. */
const CUT_SINGULAR = {
  lombos: 'lombo', filetes: 'filete', postas: 'posta',
  tranches: 'tranche', medalhões: 'medalhão',
};

/**
 * For cut-type ingredients, defines the typical weight of one piece (in grams)
 * and the singular/plural display words.
 * Used to express aggregated weight as a piece count on the shopping list.
 */
const CUT_UNITS = {
  'lombo de salmão':    { singular: 'lombo',  plural: 'lombos',  weightPerUnit: 150 },
  'filete de salmão':   { singular: 'filete', plural: 'filetes', weightPerUnit: 150 },
  'posta de salmão':    { singular: 'posta',  plural: 'postas',  weightPerUnit: 200 },
  'lombo de bacalhau':  { singular: 'lombo',  plural: 'lombos',  weightPerUnit: 200 },
  'filete de bacalhau': { singular: 'filete', plural: 'filetes', weightPerUnit: 150 },
  'posta de bacalhau':  { singular: 'posta',  plural: 'postas',  weightPerUnit: 200 },
  'lombo de pescada':   { singular: 'lombo',  plural: 'lombos',  weightPerUnit: 150 },
  'filete de pescada':  { singular: 'filete', plural: 'filetes', weightPerUnit: 150 },
  'tranche de salmão':  { singular: 'tranche', plural: 'tranches', weightPerUnit: 150 },
  'lombo de corvina':   { singular: 'lombo',  plural: 'lombos',  weightPerUnit: 150 },
  'lombo de robalo':    { singular: 'lombo',  plural: 'lombos',  weightPerUnit: 150 },
  'lombo de dourada':   { singular: 'lombo',  plural: 'lombos',  weightPerUnit: 150 },
  'peito de frango':    { singular: 'peito',  plural: 'peitos',  weightPerUnit: 200 },
  'coxa de frango':     { singular: 'coxa',   plural: 'coxas',   weightPerUnit: 150 },
  'perna de frango':    { singular: 'perna',  plural: 'pernas',  weightPerUnit: 200 },
};

/**
 * Canned ingredients: converts weight (g) to unit count (rounded up).
 * Also used to normalise unit-based entries (lata/emb./unid.) to the same display.
 */
const CANNED_UNITS = {
  'atum em lata': { singular: 'lata', plural: 'latas', label: 'atum', weightPerUnit: 120 },
};

// ─── Cup/spoon conversion factors ─────────────────────────────────────────────
const CUP_TO_GRAMS         = 200;   // 1 chávena dry goods
const CUP_TO_ML            = 200;   // 1 chávena liquid
const TBSP_TO_GRAMS        = 12;    // 1 colher de sopa dry  (12–15 g; using 12)
const TBSP_TO_ML           = 15;    // 1 colher de sopa liquid
const DESSERT_SPOON_TO_GRAMS = 10;  // 1 colher de sobremesa dry  (≈ 9–10 g)
const DESSERT_SPOON_TO_ML  = 10;    // 1 colher de sobremesa liquid (= 2 CC × 5 ml)
const TSP_TO_GRAMS         = 4;     // 1 colher de chá dry  (≈ 4–5 g)
const TSP_TO_ML            = 5;     // 1 colher de chá liquid
const COFFEE_SPOON_TO_GRAMS = 1.5;  // 1 colher de café dry
const COFFEE_SPOON_TO_ML   = 2.5;   // 1 colher de café liquid

// ─── Preparation-word patterns to strip from ingredient names ─────────────────
const PREP_RE = [
  /\s*\([^)]*\)/g,                          // (anything in brackets)
  /\s+(?:muito\s+)?finamente\b/gi,
  /\s+(?:bem\s+)?ralad[ao]s?\b/gi,
  /\s+(?:bem\s+)?picad[ao]s?\b/gi,
  /\s+(?:bem\s+)?cortad[ao]s?\b/gi,
  /\s+(?:bem\s+)?fatiados?\b/gi,
  /\s+(?:bem\s+)?esmagad[ao]s?\b/gi,
  /\s+(?:bem\s+)?demolhad[ao]s?\b/gi,
  /\s+(?:bem\s+)?desfiados?\b/gi,
  /\s+(?:bem\s+)?cozidos?\b/gi,
  /\s+(?:bem\s+)?assados?\b/gi,
  /\s+(?:bem\s+)?laminad[ao]s?\b/gi,
  /\s+(?:bem\s+)?lavad[ao]s?\b/gi,
  /\s+secos?\b/gi,
  /\s+frios?\b/gi,
  /\s+quentes?\b/gi,
  /\s+mornos?\b/gi,
  /\s+soltos?\b/gi,
  /\s+previamente\b/gi,
  /\s+em\s+(?:finas\s+)?(?:meias-luas|cubos?|rodelas?|tiras?|pedaços?|juliana|picadinho|cubinhos?)\b/gi,
  /\s+a\s+rigor\b/gi,
  /\s+num\s+ralador\s+(?:grosso|fino)\b/gi,
  /\s+de\s+véspera\b/gi,
  /\s+(?:grandes?|pequen[oa]s?|médi[oa]s?|gross[oa]s?|alt[oa]s?|madur[oa]s?|fin[oa]s?)\b/gi,
  /\s+autêntico\b/gi,
  /\s+fresco[s]?\b(?!\s+de\s+coentros|\s+de\s+salsa)/gi,  // keep "coentros frescos" etc? → simpler: strip "fresco"
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
  { re: /^colheres?\s+de\s+sopa\b\s*(?:de\s+)?/i,        unit: 'colher de sopa',       type: 'spoon' },
  { re: /^c\.\s*de\s*sopa\b\s*(?:de\s+)?/i,              unit: 'colher de sopa',       type: 'spoon' },
  { re: /^c\.s\.\b\s*(?:de\s+)?/i,                       unit: 'colher de sopa',       type: 'spoon' },
  { re: /^colheres?\s+de\s+sobremesa\b\s*(?:de\s+)?/i,   unit: 'colher de sobremesa',  type: 'spoon' },
  { re: /^c\.\s*de\s*sobremesa\b\s*(?:de\s+)?/i,         unit: 'colher de sobremesa',  type: 'spoon' },
  { re: /^c\.sob\.\b\s*(?:de\s+)?/i,                     unit: 'colher de sobremesa',  type: 'spoon' },
  { re: /^colheres?\s+de\s+chá\b\s*(?:de\s+)?/i,         unit: 'colher de chá',        type: 'spoon' },
  { re: /^c\.\s*de\s*chá\b\s*(?:de\s+)?/i,               unit: 'colher de chá',        type: 'spoon' },
  { re: /^c\.c\.\b\s*(?:de\s+)?/i,                       unit: 'colher de chá',        type: 'spoon' },
  { re: /^colheres?\s+de\s+caf[eé]\b\s*(?:de\s+)?/i,     unit: 'colher de café',       type: 'spoon' },
  { re: /^c\.\s*de\s*caf[eé]\b\s*(?:de\s+)?/i,           unit: 'colher de café',       type: 'spoon' },
  { re: /^c\.caf\.\b\s*(?:de\s+)?/i,                     unit: 'colher de café',       type: 'spoon' },
  { re: /^latas?\b\s*(?:de\s+)?/i,                 unit: 'lata',           type: 'count' },
  { re: /^frascos?\b\s*(?:de\s+)?/i,               unit: 'frasco',         type: 'count' },
  { re: /^embalagens?\b\s*(?:de\s+)?/i,            unit: 'embalagem',      type: 'count' },
  { re: /^unidades?\b\s*(?:de\s+)?/i,              unit: 'un',             type: 'count',   factor: 1 },
  { re: /^unid\.\s*(?:de\s+)?/i,                   unit: 'un',             type: 'count',   factor: 1 },
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

  for (const re of PREP_RE) {
    name = name.replace(re, ' ');
  }

  // Clean up whitespace, trailing commas/connectors
  name = name.replace(/\s+/g, ' ').trim();
  name = name.replace(/[,\s]+$/, '').trim();
  name = name.replace(/\s+(e|ou)\s*$/, '').trim();

  name = name.toLowerCase();

  // Rice normalisation
  if (/^arroz\b/.test(name)) return normaliseRice(name);

  // "lombos/filetes/postas de X" → normalise to singular "lombo/filete/posta de X"
  const fishCutMatch = name.match(/^(lombos?|filetes?|postas?|tranches?|medalhões?)\s+(?:de\s+)?(.+)$/);
  if (fishCutMatch) {
    const cut = CUT_SINGULAR[fishCutMatch[1]] ?? fishCutMatch[1];
    return `${cut} de ${fishCutMatch[2].trim()}`;
  }

  // "dentes de alho" → "alho"
  if (/^dentes?\s+de\s+alho$/.test(name)) return 'alho';

  // Eggs: strip size designation (M, L, S, XL, XS) and normalise plural → singular
  if (/^ovos?(?:\s+(?:xl|xs|[mls]))?$/.test(name)) return 'ovo';

  // "folha de louro" → "louro"
  if (/^folha[s]?\s+de\s+louro$/.test(name)) return 'louro';

  // Canned tuna: normalise all conserva/lata/azeite/posta variants to "atum em lata"
  if (/^atum\b/.test(name) && /\b(conserva|lata|azeite|posta|natural)\b/.test(name)) {
    return 'atum em lata';
  }

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
      let gramsPerUnit, mlPerUnit;
      switch (unit) {
        case 'colher de sopa':
          gramsPerUnit = TBSP_TO_GRAMS;         mlPerUnit = TBSP_TO_ML;         break;
        case 'colher de sobremesa':
          gramsPerUnit = DESSERT_SPOON_TO_GRAMS; mlPerUnit = DESSERT_SPOON_TO_ML; break;
        case 'colher de café':
          gramsPerUnit = COFFEE_SPOON_TO_GRAMS;  mlPerUnit = COFFEE_SPOON_TO_ML;  break;
        default: // colher de chá
          gramsPerUnit = TSP_TO_GRAMS;           mlPerUnit = TSP_TO_ML;
      }
      return isLiquid(name)
        ? { valueInBase: quantity * mlPerUnit,    baseUnit: 'ml' }
        : { valueInBase: quantity * gramsPerUnit, baseUnit: 'g'  };
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

  // Cut-type ingredients (lombo, filete, posta, peito…): express as piece count
  const cut = CUT_UNITS[name];
  if (cut) {
    const totalGrams = sumBase != null
      ? sumBase
      : (quantity != null && type !== 'qb' && type !== 'nounit'
          ? toBase(quantity, unit, type, name)?.valueInBase
          : null);
    if (totalGrams != null) {
      const count = Math.ceil(totalGrams / cut.weightPerUnit);
      const [, ingredient] = name.split(/ de (.+)/);
      const unitLabel = count === 1 ? cut.singular : cut.plural;
      return `${count} ${unitLabel} de ${ingredient}`;
    }
  }

  // Canned items (e.g. "atum em lata"): express as can count, rounding up
  const canned = CANNED_UNITS[name];
  if (canned) {
    // Weight-based (aggregated or single): convert grams → cans
    const totalGrams = sumBase != null
      ? sumBase
      : (quantity != null && type !== 'qb' && type !== 'nounit'
          ? toBase(quantity, unit, type, name)?.valueInBase
          : null);
    if (totalGrams != null) {
      const count = Math.ceil(totalGrams / canned.weightPerUnit);
      const unitLabel = count === 1 ? canned.singular : canned.plural;
      return `${count} ${unitLabel} de ${canned.label}`;
    }
    // Count-based (lata / emb. / unid.): keep as can count
    if (quantity != null && type === 'count') {
      const count = Math.ceil(quantity);
      const unitLabel = count === 1 ? canned.singular : canned.plural;
      return `${count} ${unitLabel} de ${canned.label}`;
    }
  }

  // Garlic: convert cloves to heads + optional half head (10 cloves = 1 head, 5 = 1/2)
  // Remaining dentes (< 5) are shown separately. E.g. 17 → "1 e 1/2 cabeças + 2 dentes"
  if (name === 'alho' && unit === 'dente') {
    const cloves = Math.round(quantity ?? 0);
    const fullHeads = Math.floor(cloves / 10);
    const remainder = cloves % 10;
    const hasHalf = remainder >= 5;
    const leftover = hasHalf ? remainder - 5 : remainder;
    const parts = [];
    if (fullHeads > 0 || hasHalf) {
      if (fullHeads === 0) {
        parts.push('1/2 cabeça de alho');
      } else if (hasHalf) {
        parts.push(`${fullHeads} e 1/2 cabeças de alho`);
      } else {
        parts.push(fullHeads === 1 ? '1 cabeça de alho' : `${fullHeads} cabeças de alho`);
      }
    }
    if (leftover > 0) parts.push(`${leftover} ${leftover === 1 ? 'dente' : 'dentes'} de alho`);
    return parts.length > 0 ? parts.join(' + ') : `${cloves} dentes de alho`;
  }

  // Eggs: express as dúzias / 1/2 dúzia / individual eggs (12 eggs = 1 dúzia, 6 = 1/2)
  // E.g. 18 → "1 dúzia e 1/2 de ovos", 14 → "1 dúzia de ovos + 2 ovos"
  if (name === 'ovo' && (unit === 'un' || !unit)) {
    const eggs = Math.round(quantity ?? 0);
    const dozens = Math.floor(eggs / 12);
    const remainder = eggs % 12;
    const hasHalf = remainder >= 6;
    const leftover = hasHalf ? remainder - 6 : remainder;
    const parts = [];
    if (dozens > 0 || hasHalf) {
      if (dozens === 0) {
        parts.push('1/2 dúzia de ovos');
      } else if (hasHalf) {
        parts.push(`${dozens} dúzia${dozens > 1 ? 's' : ''} e 1/2 de ovos`);
      } else {
        parts.push(dozens === 1 ? '1 dúzia de ovos' : `${dozens} dúzias de ovos`);
      }
    }
    if (leftover > 0) parts.push(`${leftover} ${leftover === 1 ? 'ovo' : 'ovos'}`);
    return parts.length > 0 ? parts.join(' + ') : `${eggs} ovos`;
  }

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

// ─── PARSING A SINGLE ITEM ────────────────────────────────────────────────────

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
      } else {
        // Mixed units: for cut-type ingredients, convert counts to grams so they aggregate
        const cutInfo = CUT_UNITS[key];
        if (cutInfo) {
          const gramsA = existing.sumBase
            ?? (baseA?.baseUnit === 'g' ? baseA.valueInBase : existing.quantity * cutInfo.weightPerUnit);
          const gramsB = baseB?.baseUnit === 'g'
            ? baseB.valueInBase
            : item.quantity * cutInfo.weightPerUnit;
          existing.sumBase = gramsA + gramsB;
          existing.sumUnit = 'g';
        }
        // Non-cut mixed units – keep first occurrence
        const cannedInfo = CANNED_UNITS[key];
        if (cannedInfo) {
          const gramsA = existing.sumBase
            ?? (baseA?.baseUnit === 'g' ? baseA.valueInBase : existing.quantity * cannedInfo.weightPerUnit);
          const gramsB = baseB?.baseUnit === 'g'
            ? baseB.valueInBase
            : item.quantity * cannedInfo.weightPerUnit;
          existing.sumBase = gramsA + gramsB;
          existing.sumUnit = 'g';
        }
      }
    }
  }

  return Array.from(map.values());
}

// ─── INGREDIENT CATEGORISATION ───────────────────────────────────────────────

/**
 * Ordered list of ingredient categories. Items are matched top-to-bottom;
 * the first matching category wins.
 */
const INGREDIENT_CATEGORIES = [
  {
    id: 'peixe',
    label: 'Peixe e Marisco',
    keywords: ['bacalhau', 'salmão', 'atum', 'sardinha', 'camarão', 'marisco', 'amêijoa',
      'mexilhão', 'lula', 'polvo', 'cherne', 'robalo', 'dourada', 'truta', 'linguado',
      'corvina', 'pargo', 'gambas', 'berbigão', 'raia', 'solha', 'safio', 'peixe-espada',
      'anchovas', 'cavala', 'pescada'],
  },
  {
    id: 'carnes',
    label: 'Carnes',
    keywords: ['frango', 'peru', 'pato', 'coelho', 'borrego', 'vitela', 'novilho', 'vaca',
      'porco', 'carne', 'chouriço', 'linguiça', 'paio', 'bacon', 'fiambre', 'presunto',
      'alheira', 'farinheira', 'morcela', 'toucinho', 'bife', 'costeleta', 'entrecosto',
      'lombinho', 'peito de frango'],
  },
  {
    id: 'legumes',
    label: 'Legumes e Verduras',
    keywords: ['tomate', 'cebola', 'cenoura', 'batata', 'pimento', 'courgette', 'beringela',
      'espinafres', 'brócolos', 'brócolo', 'couve', 'alface', 'rúcula', 'cogumelo',
      'alho francês', 'alho-francês', 'nabo', 'pepino', 'aipo', 'espargo', 'aspargo',
      'abóbora', 'milho', 'curgete', 'rabanete', 'beterraba', 'funcho', 'agrião',
      'acelga', 'alcachofra', 'cebolo', 'alho', 'feijão verde', 'ervilha'],
  },
  {
    id: 'frutas',
    label: 'Frutas',
    keywords: ['limão', 'laranja', 'maçã', 'banana', 'uva', 'pêra', 'pêssego', 'manga',
      'abacate', 'ananás', 'morango', 'framboesa', 'mirtilo', 'kiwi', 'figo', 'melancia',
      'melão', 'cereja', 'ameixa', 'dióspiro'],
  },
  {
    id: 'laticinios',
    label: 'Laticínios e Ovos',
    keywords: ['leite', 'manteiga', 'queijo', 'natas', 'iogurte', 'ovo', 'requeijão',
      'ricotta', 'mozzarella', 'parmesão', 'creme de leite', 'creme fresco', 'burrata'],
  },
  {
    id: 'cereais',
    label: 'Cereais, Massas e Arroz',
    keywords: ['arroz', 'massa', 'pão', 'esparguete', 'macarrão', 'fusilli', 'farinha',
      'tagliatelle', 'lasanha', 'aveia', 'cuscuz', 'bulgur', 'polenta', 'penne',
      'farfalle', 'rigatoni', 'tortilha', 'tostas', 'panado', 'pão ralado', 'amido'],
  },
  {
    id: 'leguminosas',
    label: 'Leguminosas',
    keywords: ['feijão', 'grão', 'lentilha', 'favas', 'tremoço', 'soja'],
  },
  {
    id: 'condimentos',
    label: 'Condimentos e Especiarias',
    keywords: ['sal', 'pimenta', 'colorau', 'louro', 'cominhos', 'açafrão', 'canela',
      'noz-moscada', 'oregãos', 'orégão', 'tomilho', 'rosmaninho', 'alecrim', 'coentros',
      'salsa', 'manjericão', 'hortelã', 'paprika', 'caril', 'gengibre', 'curcuma',
      'cúrcuma', 'piripiri', 'ervas', 'cravinho', 'cardamomo', 'mostarda', 'vinagre',
      'tabasco', 'açúcar', 'mel', 'flor de sal'],
  },
  {
    id: 'azeite',
    label: 'Azeite e Óleos',
    keywords: ['azeite', 'óleo'],
  },
  {
    id: 'molhos',
    label: 'Molhos e Caldos',
    keywords: ['molho', 'caldo', 'concentrado', 'polpa', 'passata', 'nata de cozinha'],
  },
];

/**
 * Assigns a category id to a normalised ingredient name.
 */
function categoriseIngredient(name) {
  const lower = name.toLowerCase();
  for (const cat of INGREDIENT_CATEGORIES) {
    if (cat.keywords.some(kw => new RegExp(`(?<![a-záéíóúâêîôûãõç])${kw}(?![a-záéíóúâêîôûãõç])`, 'i').test(lower))) {
      return cat.id;
    }
  }
  return 'outros';
}

/**
 * Ordered category metadata exported for use in the UI.
 */
export const SHOPPING_CATEGORIES = [
  ...INGREDIENT_CATEGORIES,
  { id: 'outros', label: 'Outros' },
];

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Takes all raw ingredient strings from the weekly planner and returns an
 * array of shopping list items ready for display.
 *
 * Each item: { name, displayText, originalText, quantity, unit, type }
 */
export function buildShoppingList(allIngredientStrings) {
  // 1. Split multi-ingredient strings and flatten
  const split = allIngredientStrings.flatMap(text => splitIngredientText(text));

  // 2. Parse each into structured form
  const parsed = split.map(parseSingleItem).filter(Boolean);

  // 3. Aggregate identical ingredients
  const aggregated = aggregateItems(parsed);

  // 4. Add display text and category
  return aggregated.map(item => ({
    ...item,
    displayText: formatIngredient(item),
    category: categoriseIngredient(item.name),
  }));
}
