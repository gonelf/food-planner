#!/usr/bin/env python3
"""
migrate_ingredients.py

Converts recipe ingredients from free-text strings to structured objects:
  { "qty": "400", "unit": "g", "name": "bacalhau", "prep": "demolhado e desfiado" }

Usage:
  python3 scripts/migrate_ingredients.py

Reads data/batch_*.json, migrates in-place, then rebuilds src/data/recipes.json.
"""

import json
import re
import os
import glob

# ─── Unit patterns ────────────────────────────────────────────────────────────
# (regex, unit_string)
UNIT_PATTERNS = [
    (r'^kg\b\s*(?:de\s+)?',                    'kg'),
    (r'^quilogramas?\b\s*(?:de\s+)?',           'kg'),
    (r'^g\b\s*(?:de\s+)?',                      'g'),
    (r'^gr\b\s*(?:de\s+)?',                     'g'),
    (r'^gramas?\b\s*(?:de\s+)?',                'g'),
    (r'^litros?\b\s*(?:de\s+)?',                'L'),
    (r'^l\b\s*(?:de\s+)?',                      'L'),
    (r'^dl\b\s*(?:de\s+)?',                     'dl'),
    (r'^ml\b\s*(?:de\s+)?',                     'ml'),
    (r'^mililitros?\b\s*(?:de\s+)?',            'ml'),
    (r'^chávenas?\b\s*(?:de\s+)?',              'chávena'),
    (r'^medidas?\b\s*(?:de\s+)?',               'chávena'),
    (r'^copos?\b\s*(?:de\s+)?',                 'copo'),
    (r'^colheres?\s+de\s+sopa\b\s*(?:de\s+)?',  'colher de sopa'),
    (r'^c\.\s*de\s*sopa\b\s*(?:de\s+)?',        'colher de sopa'),
    (r'^c\.s\.\b\s*(?:de\s+)?',                 'colher de sopa'),
    (r'^colheres?\s+de\s+chá\b\s*(?:de\s+)?',   'colher de chá'),
    (r'^c\.\s*de\s*chá\b\s*(?:de\s+)?',         'colher de chá'),
    (r'^c\.c\.\b\s*(?:de\s+)?',                 'colher de chá'),
    (r'^latas?\b\s*(?:de\s+)?',                 'lata'),
    (r'^frascos?\b\s*(?:de\s+)?',               'frasco'),
    (r'^embalagens?\b\s*(?:de\s+)?',            'embalagem'),
    (r'^dentes?\s+de\s+',                        'dente'),
    (r'^folhas?\b\s*(?:de\s+)?',                'folha'),
    (r'^pacotes?\b\s*(?:de\s+)?',               'pacote'),
    (r'^potes?\b\s*(?:de\s+)?',                 'pote'),
]

# ─── Preparation boundary ─────────────────────────────────────────────────────
PREP_BOUNDARY_RE = re.compile(
    r'(?:'
    r'\s+(?:(?:bem|muito)\s+)?'
    r'(?:picad|cortad|fatiad|esmagad|demolhad|desfiad|cozid|assad|laminad|lavad|temperad|marinad|ralad|suad|refogad)[ao]s?\b'
    r'|\s+em\s+(?:finas?\s+)?(?:meias-luas|cubos?|rodelas?|tiras?|pedaços?|juliana|picadinho|cubinhos?|azeite|manteiga|óleo|gordura|banha)\b'
    r'|\s+(?:a\s+rigor|num\s+ralador\s+(?:grosso|fino)|de\s+véspera)'
    r')',
    re.IGNORECASE,
)

# Standalone modifiers to also strip from name (not prep boundary, just noise)
MODIFIER_RE = re.compile(
    r'\s+(?:muito\s+)?finamente\b'
    r'|\s+(?:secos?|frios?|quentes?|mornos?|soltos?)\b'
    r'|\s+fresco[s]?\b'
    r'|\s+autêntico\b'
    r'|\s+(?:grandes?|pequen[oa]s?|médi[oa]s?|gross[oa]s?|alt[oa]s?|madur[oa]s?|fin[oa]s?)\b',
    re.IGNORECASE,
)


def starts_new_item(text):
    t = text.strip()
    # Starts with explicit quantity, OR contains "q.b." anywhere
    return bool(
        re.match(
            r'^(\d+(?:[.,]\d+)?(?:/\d+)?|\d+[-–]\d+|q\.b\.|uma?\s+(?:fio|cálice|pitada|punhado)|cerca\s+de\s+\d)',
            t, re.IGNORECASE
        ) or re.search(r'\bq\.b\.', t, re.IGNORECASE)
    )


def split_multi_ingredient(text):
    """Split 'Azeite q.b., 3 dentes de alho, 1 folha de louro' into 3 items."""
    segments = re.split(r',\s+', text)
    if len(segments) <= 1:
        return [text]
    new_count = sum(1 for s in segments if starts_new_item(s))
    if new_count < 2:
        return [text]
    result = []
    current = ''
    for seg in segments:
        if current and starts_new_item(seg):
            result.append(current.strip())
            current = seg
        else:
            current = (current + ', ' + seg) if current else seg
    if current.strip():
        result.append(current.strip())
    return [s for s in result if len(s) > 1]


def parse_qty_and_unit(text):
    """
    Extract (qty_str, unit_str, rest) from the front of text.
    qty_str may be "1", "1/2", "2-3", "q.b.", or None.
    """
    text = text.strip()

    # q.b. at the start
    if re.match(r'^q\.b\.', text, re.IGNORECASE):
        rest = re.sub(r'^q\.b\.?,?\s*', '', text, flags=re.IGNORECASE).strip()
        return 'q.b.', None, rest

    # q.b. anywhere but only when there's no leading number
    # e.g. "Azeite virgem extra q.b." → qty='q.b.', name='azeite virgem extra'
    if not re.match(r'^\d', text) and re.search(r'\bq\.b\.', text, re.IGNORECASE):
        rest = re.sub(r',?\s*q\.b\.?\.?\s*', '', text, flags=re.IGNORECASE).strip()
        return 'q.b.', None, rest

    # "cerca de X"
    text = re.sub(r'^cerca\s+de\s+', '', text, flags=re.IGNORECASE)

    # "Uma"/"Um" → 1
    m = re.match(r'^(uma?)\s+', text, re.IGNORECASE)
    if m:
        qty = '1'
        rest = text[m.end():]
    else:
        # Fraction "3/4"
        m = re.match(r'^(\d+/\d+)\s*(?:de\s+)?', text)
        if not m:
            # Range "2-3"
            m = re.match(r'^(\d+\s*[-–]\s*\d+)\s*', text)
        if not m:
            # Decimal / integer
            m = re.match(r'^(\d+(?:[.,]\d+)?)\s*', text)
        if not m:
            return None, None, text
        qty = m.group(1).replace(' ', '')
        rest = text[m.end():]

    # Try to find unit
    for pattern, unit in UNIT_PATTERNS:
        um = re.match(pattern, rest, re.IGNORECASE)
        if um:
            return qty, unit, rest[um.end():].strip()

    return qty, None, rest.strip()


def split_name_and_prep(text):
    """
    Split 'bacalhau demolhado desfiado (sem espinhas)' into
    name='bacalhau', prep='demolhado desfiado (sem espinhas)'.
    """
    # Extract brackets
    brackets = re.findall(r'\([^)]*\)', text)
    clean = re.sub(r'\s*\([^)]*\)', '', text).strip()

    # Find prep boundary
    m = PREP_BOUNDARY_RE.search(clean)
    if m:
        name_part = clean[:m.start()].strip()
        prep_part = (clean[m.start():].strip() + ' ' +
                     ' '.join(b.strip('()') for b in brackets)).strip()
        prep_part = prep_part or None
    else:
        name_part = clean.strip()
        prep_part = (' '.join(b.strip('()') for b in brackets)).strip() or None

    # If name still has a comma (e.g. "cebola, azeite" from un-split multi-ingredient),
    # take only the first ingredient and discard the rest.
    if ',' in name_part:
        name_part = name_part.split(',')[0]

    # Strip remaining modifiers from name
    name_part = MODIFIER_RE.sub('', name_part).strip()
    # Clean up
    name_part = re.sub(r'\s+', ' ', name_part).strip().lower()
    name_part = re.sub(r'[,\s]+$', '', name_part).strip()

    return name_part, prep_part


def parse_single(text):
    """Parse one ingredient string into { qty, unit, name, prep }."""
    text = text.strip()
    if not text or len(text) < 2:
        return None
    if re.match(r'^acompanhamento:', text, re.IGNORECASE):
        return None

    qty, unit, rest = parse_qty_and_unit(text)
    if not rest or len(rest) < 2:
        return None

    name, prep = split_name_and_prep(rest)
    if not name or len(name) < 2:
        return None

    return {
        'qty':  qty,
        'unit': unit,
        'name': name,
        'prep': prep,
    }


def migrate_ingredients(ingredients):
    """Convert a list of ingredient strings to structured objects."""
    result = []
    for ing in ingredients:
        if isinstance(ing, dict):
            # Already migrated
            result.append(ing)
            continue
        parts = split_multi_ingredient(str(ing))
        for part in parts:
            item = parse_single(part)
            if item:
                result.append(item)
    return result


def migrate_batch(path):
    with open(path, encoding='utf-8') as f:
        recipes = json.load(f)

    for recipe in recipes:
        recipe['ingredients'] = migrate_ingredients(recipe.get('ingredients', []))

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(recipes, f, ensure_ascii=False, indent=2)
        f.write('\n')

    return recipes


def rebuild_master(base_dir):
    """Rebuild src/data/recipes.json from all batch files."""
    all_recipes = []
    for i in range(1, 11):
        path = os.path.join(base_dir, 'data', f'batch_{i}.json')
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                all_recipes.extend(json.load(f))

    master_path = os.path.join(base_dir, 'src', 'data', 'recipes.json')
    with open(master_path, 'w', encoding='utf-8') as f:
        json.dump(all_recipes, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'Rebuilt {master_path} ({len(all_recipes)} recipes)')
    return all_recipes


if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    total_ings = 0
    for i in range(1, 11):
        path = os.path.join(base_dir, 'data', f'batch_{i}.json')
        if not os.path.exists(path):
            print(f'  Skipping missing {path}')
            continue
        recipes = migrate_batch(path)
        count = sum(len(r['ingredients']) for r in recipes)
        total_ings += count
        print(f'  batch_{i}.json → {len(recipes)} recipes, {count} ingredients')

    recipes = rebuild_master(base_dir)
    print(f'\nDone. Total: {len(recipes)} recipes, {total_ings} structured ingredients.')
