/**
 * Macro Loader
 *
 * Loads WML macro definitions from data/core/macros/ and builds a dictionary
 * of "simple constant" macros that can be expanded inline.
 *
 * A macro is considered a "simple constant" if:
 *   1. It takes no parameters (#define MACRO_NAME with no args)
 *   2. Its body is a single line of text (no nested tags or multi-line content)
 *
 * Complex macros (parameterized, multi-line, or containing tags) are NOT loaded
 * into the dictionary — they will be recorded as unexpanded macro names during parsing.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { MacroDictionary } from './wml-parser.ts';

/**
 * Load all simple constant macros from a directory of .cfg files.
 */
export function loadMacroDictionary(macroDir: string): MacroDictionary {
  const dictionary: MacroDictionary = new Map();
  const files = collectCfgFiles(macroDir);

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    extractSimpleMacros(content, dictionary);
  }

  console.log(
    `  Loaded ${dictionary.size} simple constant macros from ${files.length} files`,
  );
  return dictionary;
}

/**
 * Recursively collect all .cfg files in a directory.
 */
function collectCfgFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...collectCfgFiles(fullPath));
      } else if (entry.endsWith('.cfg')) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return results;
}

/**
 * Extract simple constant macros from WML content.
 *
 * A simple constant macro looks like:
 *   #define MACRO_NAME
 *   single-line-value #enddef
 *
 * or:
 *   #define MACRO_NAME
 *   single-line-value
 *   #enddef
 */
function extractSimpleMacros(
  content: string,
  dictionary: MacroDictionary,
): void {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const defineMatch = lines[i].match(/^\s*#define\s+(\S+)\s*$/);
    if (!defineMatch) continue;

    const macroName = defineMatch[1];

    // Collect body lines until #enddef
    const bodyLines: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const line = lines[j];
      if (/^\s*#enddef\b/.test(line)) break;

      // Check for inline #enddef (e.g., "value #enddef")
      const inlineEnddef = line.match(/^(.+?)\s*#enddef\s*$/);
      if (inlineEnddef) {
        bodyLines.push(inlineEnddef[1].trim());
        break;
      }

      bodyLines.push(line);
    }

    // Skip to after #enddef
    i = j;

    // Only include macros with no parameters (name has no spaces after it in the #define)
    // and a simple single-line body
    if (bodyLines.length === 0) continue;
    if (bodyLines.length > 1) continue;

    const body = bodyLines[0].trim();

    // Skip if body contains tags or complex content
    if (body.startsWith('[') || body.includes('[/')) continue;

    // Skip if body contains macro parameters (starts with { and contains space suggesting args)
    // But allow simple macro references like {OTHER_MACRO}
    if (body.startsWith('{') && body.includes(' ') && body.endsWith('}'))
      continue;

    // This is a simple constant macro
    dictionary.set(macroName, body);
  }
}
