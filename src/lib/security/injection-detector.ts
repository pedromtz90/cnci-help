/**
 * Prompt Injection Detector — FAQs-CNCI
 *
 * Lightweight, zero-dependency regex scanner for prompt injection attempts.
 * Covers English and Spanish patterns.
 *
 * Risk levels:
 *   'none'   — no match
 *   'low'    — single weak signal (let through, log)
 *   'medium' — moderate signal (let through, log)
 *   'high'   — strong signal (block, return safe fallback)
 */

interface InjectionPattern {
  pattern: RegExp;
  category: string;
  weight: number;
}

const PATTERNS: InjectionPattern[] = [
  // English — override
  { pattern: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|prompts?)/i, category: 'override', weight: 3 },
  { pattern: /disregard\s+(all|any|previous|your)/i, category: 'override', weight: 3 },
  { pattern: /new\s+instructions?\s*:/i, category: 'override', weight: 3 },
  { pattern: /override\s+(your|the|all)/i, category: 'override', weight: 3 },
  // English — identity change
  { pattern: /you\s+are\s+now\s+/i, category: 'identity_change', weight: 3 },
  { pattern: /act\s+as\s+(if\s+you\s+(are|were)|a\s|an\s)/i, category: 'identity_change', weight: 2 },
  { pattern: /pretend\s+(you\s+(are|were)|to\s+be)/i, category: 'identity_change', weight: 2 },
  // English — memory wipe
  { pattern: /forget\s+(everything|all|your|previous)/i, category: 'memory_wipe', weight: 3 },
  // English — prompt extraction
  { pattern: /system\s*prompt/i, category: 'prompt_extraction', weight: 2 },
  { pattern: /repeat\s+(your|the)\s+(system|initial)\s+(prompt|instructions?)/i, category: 'prompt_extraction', weight: 3 },
  { pattern: /what\s+(are|is)\s+your\s+(instructions?|rules?|system\s*prompt)/i, category: 'prompt_extraction', weight: 2 },
  // English — jailbreak
  { pattern: /\bDAN\b.*mode/i, category: 'jailbreak', weight: 3 },
  { pattern: /developer\s+mode/i, category: 'jailbreak', weight: 3 },
  { pattern: /without\s+(any\s+)?(restrictions?|limits?|filters?|rules?)/i, category: 'jailbreak', weight: 2 },
  // Spanish — override
  { pattern: /ignora\s+(todas?\s+)?(las\s+)?(instrucciones?|reglas?|indicaciones?)/i, category: 'override', weight: 3 },
  { pattern: /nuevas?\s+instrucciones?\s*:/i, category: 'override', weight: 3 },
  { pattern: /anula\s+(tus?\s+)?(instrucciones?|reglas?)/i, category: 'override', weight: 3 },
  // Spanish — identity change
  { pattern: /ahora\s+eres\s+/i, category: 'identity_change', weight: 3 },
  { pattern: /act[uú]a\s+como\s+/i, category: 'identity_change', weight: 2 },
  { pattern: /finge\s+(ser|que\s+(eres|tienes))/i, category: 'identity_change', weight: 2 },
  { pattern: /cambia\s+tu\s+(rol|personalidad|comportamiento|identidad)/i, category: 'identity_change', weight: 3 },
  { pattern: /a\s+partir\s+de\s+ahora\s+(eres|ser[aá]s|actuar[aá]s)/i, category: 'identity_change', weight: 3 },
  // Spanish — memory wipe
  { pattern: /olvida\s+(todo|tus?\s+instrucciones?|lo\s+anterior)/i, category: 'memory_wipe', weight: 3 },
  { pattern: /borra\s+(tu\s+)?(memoria|contexto|instrucciones?)/i, category: 'memory_wipe', weight: 3 },
  // Spanish — prompt extraction
  { pattern: /repite\s+(tu|el)\s+(prompt|instrucciones?|sistema)/i, category: 'prompt_extraction', weight: 3 },
  { pattern: /cu[aá]les?\s+son\s+tus?\s+(instrucciones?|reglas?)/i, category: 'prompt_extraction', weight: 2 },
  { pattern: /mu[eé]strame\s+tu\s+(prompt|instrucciones?|contexto)/i, category: 'prompt_extraction', weight: 2 },
];

export interface DetectionResult {
  isSuspicious: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  matchedCategories: string[];
}

export function detectInjection(message: string): DetectionResult {
  const matchedCategories: string[] = [];
  let totalWeight = 0;

  for (const { pattern, category, weight } of PATTERNS) {
    if (pattern.test(message)) {
      matchedCategories.push(category);
      totalWeight += weight;
    }
  }

  const riskLevel =
    totalWeight === 0 ? 'none' :
    totalWeight <= 2  ? 'low'  :
    totalWeight <= 5  ? 'medium' :
                        'high';

  return { isSuspicious: matchedCategories.length > 0, riskLevel, matchedCategories };
}
