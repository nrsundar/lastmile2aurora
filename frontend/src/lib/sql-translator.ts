/**
 * Client-side Oracle → PostgreSQL SQL translator.
 * Handles the top 15 Oracle quirks without needing a backend API call.
 */

interface TranslationResult {
  original: string;
  translated: string;
  changes: string[];
  issues: string[];
}

const RULES: Array<{ name: string; pattern: RegExp; replace: string | ((match: string, ...args: string[]) => string) }> = [
  { name: "SYSDATE → CURRENT_TIMESTAMP", pattern: /\bSYSDATE\b/gi, replace: "CURRENT_TIMESTAMP" },
  { name: "Remove FROM DUAL", pattern: /\s+FROM\s+DUAL\b/gi, replace: "" },
  { name: "NVL → COALESCE", pattern: /\bNVL\s*\(/gi, replace: "COALESCE(" },
  { name: "NVL2(a,b,c) → CASE WHEN a IS NOT NULL THEN b ELSE c END", pattern: /\bNVL2\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, replace: "CASE WHEN $1 IS NOT NULL THEN $2 ELSE $3 END" },
  { name: "DECODE → CASE", pattern: /\bDECODE\s*\(\s*([^,]+),\s*([^)]+)\)/gi, replace: (_match, expr, rest) => {
    const parts = rest.split(",").map((s: string) => s.trim());
    let sql = `CASE ${expr.trim()}`;
    for (let i = 0; i < parts.length - 1; i += 2) {
      if (i + 1 < parts.length) sql += ` WHEN ${parts[i]} THEN ${parts[i + 1]}`;
    }
    if (parts.length % 2 === 1) sql += ` ELSE ${parts[parts.length - 1]}`;
    sql += " END";
    return sql;
  }},
  { name: "ROWNUM ≤ N → LIMIT N", pattern: /\bWHERE\s+ROWNUM\s*<=\s*(\d+)/gi, replace: "LIMIT $1" },
  { name: "ROWNUM < N → LIMIT N-1", pattern: /\bWHERE\s+ROWNUM\s*<\s*(\d+)/gi, replace: (_m, n) => `LIMIT ${parseInt(n) - 1}` },
  { name: "AND ROWNUM ≤ N → (move to end as LIMIT)", pattern: /\bAND\s+ROWNUM\s*<=\s*(\d+)/gi, replace: "LIMIT $1" },
  { name: "seq.NEXTVAL → nextval('seq')", pattern: /(\w+)\.NEXTVAL/gi, replace: "nextval('$1')" },
  { name: "seq.CURRVAL → currval('seq')", pattern: /(\w+)\.CURRVAL/gi, replace: "currval('$1')" },
  { name: "SUBSTR → SUBSTRING", pattern: /\bSUBSTR\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, replace: "SUBSTRING($1 FROM $2 FOR $3)" },
  { name: "TO_DATE → ::date or TO_DATE", pattern: /\bTO_DATE\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/gi, replace: "'$1'::date" },
  { name: "TRUNC(date) → DATE_TRUNC('day', date)", pattern: /\bTRUNC\s*\(\s*(SYSDATE|CURRENT_TIMESTAMP|[^,)]+)\s*\)/gi, replace: "DATE_TRUNC('day', $1)" },
  { name: "Remove Oracle hints /*+ ... */", pattern: /\/\*\+[^*]*\*\//g, replace: "" },
  { name: "(+) outer join → LEFT JOIN (flagged)", pattern: /(\w+\.\w+)\s*=\s*(\w+\.\w+)\s*\(\+\)/gi, replace: "$1 = $2 /* TODO: convert to LEFT JOIN */" },
  { name: "|| concat (compatible)", pattern: /\|\|/g, replace: "||" }, // no-op, just note it's compatible
];

export function translateOracleToPostgres(sql: string): TranslationResult {
  let translated = sql.trim();
  const changes: string[] = [];
  const issues: string[] = [];

  for (const rule of RULES) {
    const before = translated;
    if (typeof rule.replace === "string") {
      translated = translated.replace(rule.pattern, rule.replace);
    } else {
      translated = translated.replace(rule.pattern, rule.replace as any);
    }
    if (translated !== before) {
      changes.push(rule.name);
    }
  }

  // Move LIMIT to end if it's in the middle
  const limitMatch = translated.match(/\bLIMIT\s+(\d+)\b(.*?)(ORDER\s+BY\s+.+)$/i);
  if (limitMatch) {
    translated = translated.replace(/\bLIMIT\s+\d+\b/, "").trim();
    translated = translated.replace(/(ORDER\s+BY\s+.+)$/i, `$1 LIMIT ${limitMatch[1]}`);
    changes.push("Moved LIMIT after ORDER BY");
  }

  // Flag potential issues
  if (/\bCONNECT\s+BY\b/i.test(translated)) issues.push("CONNECT BY detected — use WITH RECURSIVE in PostgreSQL");
  if (/\bMERGE\s+INTO\b/i.test(translated)) issues.push("MERGE detected — use INSERT ... ON CONFLICT DO UPDATE");
  if (/\(\+\)/.test(translated)) issues.push("Oracle (+) outer join syntax — rewrite as explicit LEFT/RIGHT JOIN");
  if (/\bf-string\b|{.*}/i.test(sql)) issues.push("Possible f-string/template — review for SQL injection");

  // Clean up extra whitespace
  translated = translated.replace(/\s+/g, " ").trim();

  return { original: sql, translated, changes, issues };
}
