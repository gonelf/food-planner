# Prompt para Geração de Receitas

Usa este prompt para gerar novas receitas com o modelo de IA. Garante que o JSON resultante segue o schema exato definido abaixo.

---

## Prompt

Gera [N] receitas portuguesas para um planeador de refeições familiar (com bebé de 1 ano). Responde **apenas** com JSON válido, sem texto adicional.

Cada receita deve seguir exatamente este schema:

```json
{
  "id": 101,
  "title": "Nome da Receita",
  "category": "Peixe e Conservas",
  "origin": "Portuguesa",
  "dynamics": ["Uma Panela"],
  "time": "30 min",
  "ingredients": [
    { "qty": "400", "unit": "g",   "name": "bacalhau",         "prep": "demolhado e desfiado" },
    { "qty": "1",   "unit": null,  "name": "cebola",           "prep": null },
    { "qty": "3",   "unit": "dente","name": "alho",            "prep": null },
    { "qty": "2",   "unit": "colher de sopa", "name": "azeite","prep": null },
    { "qty": "q.b.","unit": null,  "name": "sal",              "prep": null }
  ],
  "instructions": [
    "Passo 1 em modo imperativo.",
    "Passo 2."
  ],
  "baby_adaptation": "Como adaptar para bebé de 1 ano.",
  "pingo_doce_link": "https://www.pingodoce.pt/on/demandware.store/Sites-pingo-doce-Site/default/Search-Show?q=Nome+da+Receita"
}
```

---

## Regras para o campo `ingredients`

Cada ingrediente é um objeto com 4 campos:

| Campo  | Tipo            | Descrição |
|--------|-----------------|-----------|
| `qty`  | string ou null  | Quantidade numérica (`"400"`, `"1/2"`, `"2-3"`) ou `"q.b."` para _quanto baste_. `null` se não houver quantidade. |
| `unit` | string ou null  | Unidade de medida. Ver lista abaixo. `null` para unidades contáveis sem nome (ovos, cenouras, etc.) |
| `name` | string          | **Apenas o nome do ingrediente**, sem quantidade, unidade ou modo de preparação. Em minúsculas. |
| `prep` | string ou null  | Modo de preparação (ex: `"picado"`, `"demolhado e desfiado"`, `"cortado em rodelas"`). `null` se não aplicável. |

### Unidades permitidas para `unit`

`"g"`, `"kg"`, `"ml"`, `"dl"`, `"L"`, `"chávena"`, `"copo"`, `"colher de sopa"`, `"colher de chá"`, `"lata"`, `"frasco"`, `"embalagem"`, `"dente"`, `"folha"`, `"pacote"`, `"pote"`, `null`

### Exemplos corretos vs incorretos

| ❌ Errado (string antiga) | ✅ Correto (objeto estruturado) |
|--------------------------|-------------------------------|
| `"1 cebola suada em azeite"` | `{ "qty": "1", "unit": null, "name": "cebola", "prep": "suada em azeite" }` |
| `"400g bacalhau demolhado desfiado"` | `{ "qty": "400", "unit": "g", "name": "bacalhau", "prep": "demolhado e desfiado" }` |
| `"3 dentes de alho picados"` | `{ "qty": "3", "unit": "dente", "name": "alho", "prep": "picado" }` |
| `"Azeite virgem extra q.b."` | `{ "qty": "q.b.", "unit": null, "name": "azeite virgem extra", "prep": null }` |
| `"1 lata de tomate pelado"` | `{ "qty": "1", "unit": "lata", "name": "tomate pelado", "prep": null }` |
| `"2 cenouras raladas"` | `{ "qty": "2", "unit": null, "name": "cenoura", "prep": "ralada" }` |
| `"1 frango inteiro cortado em pedaços"` | `{ "qty": "1", "unit": null, "name": "frango inteiro", "prep": "cortado em pedaços" }` |

### Regra importante: não agregar ingredientes

Cada ingrediente deve ser um objeto separado. **Nunca** juntes vários ingredientes numa só string.

| ❌ Errado | ✅ Correto |
|----------|-----------|
| `"Azeite q.b., 3 dentes de alho, 1 folha de louro"` | Três objetos separados |

---

## Valores válidos para outros campos

**`category`** (escolher um):
- `"Peixe e Conservas"`
- `"Base de Leguminosas / Vegetariano"`
- `"Carnes Brancas"`
- `"Massas e Arroz"`
- `"Carnes Vermelhas"`

**`dynamics`** (pode ter vários):
- `"Uma Panela"` — cozinha-se tudo no mesmo recipiente
- `"Amigo do Congelador"` — congela bem
- `"Express"` — pronto em ≤ 20 min
- `"Conforto"` — prato reconfortante

**`time`**: string com minutos, ex: `"25 min"`, `"1h 15 min"`
