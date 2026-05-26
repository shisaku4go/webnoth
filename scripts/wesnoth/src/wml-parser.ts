/**
 * WML (Wesnoth Markup Language) Parser
 *
 * Parses WML files into a tree of WmlNode objects.
 * Handles:
 *   - [tag] / [/tag] nesting
 *   - key=value pairs (including _ "translated strings")
 *   - {MACRO_NAME args...} invocations (expanded via dictionary)
 *   - #textdomain, # comments → skipped
 *   - #define / #enddef → captured into macro dictionary
 *   - #undef → removes macros from the dictionary
 *   - [+tag] merge syntax (appends to most recent same-named tag)
 *   - String concatenation with + operator
 *   - Parameterized macro expansion with positional arguments
 *   - Parenthesized arguments: {MACRO (arg with spaces)}
 *
 * Limitations (recorded for future phases):
 *   - Preprocessor conditionals (#ifdef, #else, #endif) are not handled
 *   - WML formula syntax $(...) is not evaluated
 */

export interface WmlNode {
  tag: string;
  attributes: Record<string, string>;
  children: WmlNode[];
  /** Macro invocations found at this level that weren't expanded */
  macros: string[];
}

/** Structured macro definition with separated params and body */
export interface MacroEntry {
  params: string[];
  body: string;
}

export type MacroDictionary = Map<string, MacroEntry>;

/**
 * Parse WML macro arguments, respecting parenthesized groups.
 *
 * WML allows arguments containing spaces to be wrapped in parentheses:
 *   {MY_MACRO (value with spaces) simple_arg}
 *   → ["value with spaces", "simple_arg"]
 *
 * Handles nested parentheses: {MACRO (a (b c) d)} → ["a (b c) d"]
 */
function parseMacroArgs(argsString: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < argsString.length; i++) {
    const ch = argsString[i];
    if (ch === '(' && depth === 0) {
      depth++;
      continue;
    }
    if (ch === '(') {
      depth++;
      current += ch;
      continue;
    }
    if (ch === ')' && depth === 1) {
      depth = 0;
      if (current.length > 0) {
        args.push(current.trim());
        current = '';
      }
      continue;
    }
    if (ch === ')') {
      depth--;
      current += ch;
      continue;
    }
    if (/\s/.test(ch) && depth === 0) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    args.push(current);
  }
  return args;
}

/**
 * Parse the portion of a #define line after the macro name,
 * extracting parameter names and any inline body.
 *
 * @param restAfterName - The text following the macro name on the #define line
 *
 * Examples (input → output):
 *   ""                       → { params: [], bodyStart: "" }
 *   " PARAM1 PARAM2"         → { params: ["PARAM1", "PARAM2"], bodyStart: "" }
 *   " PARAM foo={PARAM}#enddef" → { params: ["PARAM"], bodyStart: "foo={PARAM}#enddef" }
 */
function parseDefineLine(restAfterName: string): {
  params: string[];
  bodyStart: string;
} {
  const trimmed = restAfterName.trim();
  if (trimmed.length === 0) {
    return { params: [], bodyStart: '' };
  }

  // Separate param tokens from the body portion.
  // Param tokens are UPPERCASE_WORDS. The first non-uppercase token starts the body.
  const tokens = trimmed.split(/\s+/);
  const params: string[] = [];
  let bodyStartIdx = tokens.length;

  for (let i = 0; i < tokens.length; i++) {
    // A param name is all-uppercase letters, digits, and underscores
    if (/^[A-Z_][A-Z0-9_]*$/.test(tokens[i])) {
      params.push(tokens[i]);
    } else {
      bodyStartIdx = i;
      break;
    }
  }

  const bodyStart = tokens.slice(bodyStartIdx).join(' ');
  return { params, bodyStart };
}

/**
 * Split a WML value string by comma, respecting quotes.
 * Splits up to maxSplit times.
 */
function splitValuesByComma(s: string, maxSplit: number): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let splits = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && (i === 0 || s[i - 1] !== '\\')) {
      inQuote = !inQuote;
      current += ch;
    } else if (ch === ',' && !inQuote && splits < maxSplit) {
      parts.push(current.trim());
      current = '';
      splits++;
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts;
}

/**
 * Assign pending keys to a WmlNode, splitting the raw value by comma.
 */
function assignPendingKeys(
  node: WmlNode,
  keys: string[],
  rawValue: string,
  macros?: MacroDictionary,
): void {
  const maxSplit = keys.length - 1;
  const valParts = splitValuesByComma(rawValue, maxSplit);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const rawPart = valParts[i] ?? '';
    node.attributes[key] = cleanValue(rawPart, macros);
  }
}

interface DefineState {
  inDefine: boolean;
  defineName: string;
  defineParams: string[];
  defineBody: string[];
}

function tryHandleDefineOrUndef(
  line: string,
  state: DefineState,
  macroDictionary: MacroDictionary,
): boolean {
  // Handle #define / #enddef blocks
  const defineMatch = line.match(/^\s*#define\s+(\S+)(.*)$/);
  if (defineMatch) {
    const macroName = defineMatch[1];
    const rest = defineMatch[2];
    const { params, bodyStart } = parseDefineLine(rest);

    if (bodyStart.includes('#enddef')) {
      // Single-line define with inline body: #define MACRO PARAM foo={PARAM}#enddef
      const body = bodyStart.replace(/\s*#enddef.*$/, '').trim();
      macroDictionary.set(macroName, { params, body });
      return true;
    }

    state.defineParams = params;
    state.defineName = macroName;
    state.defineBody = bodyStart.length > 0 ? [bodyStart] : [];
    state.inDefine = true;
    return true;
  }

  if (state.inDefine) {
    if (line.includes('#enddef')) {
      const before = line.replace(/\s*#enddef.*$/, '').trim();
      if (before.length > 0) state.defineBody.push(before);
      state.inDefine = false;
      const bodyStr = state.defineBody.join('\n').trim();
      macroDictionary.set(state.defineName, {
        params: state.defineParams,
        body: bodyStr,
      });
    } else {
      state.defineBody.push(line);
    }
    return true;
  }

  // Handle #undef
  const undefMatch = line.match(/^\s*#undef\s+(\S+)/);
  if (undefMatch) {
    macroDictionary.delete(undefMatch[1]);
    return true;
  }

  return false;
}

function tryHandleTag(trimmed: string, stack: WmlNode[]): boolean {
  // Closing tag: [/tagname]
  const closeMatch = trimmed.match(/^\[\/(\w+)\]$/);
  if (closeMatch) {
    if (stack.length > 1) {
      stack.pop();
    }
    return true;
  }

  // Merge tag: [+tagname] — append to last child with same tag
  const mergeMatch = trimmed.match(/^\[\+(\w+)\]$/);
  if (mergeMatch) {
    const tagName = mergeMatch[1];
    const parent = stack[stack.length - 1];
    const existing = parent.children.findLast((c) => c.tag === tagName);
    if (existing) {
      stack.push(existing);
    } else {
      // If no existing tag, treat as new
      const node: WmlNode = {
        tag: tagName,
        attributes: {},
        children: [],
        macros: [],
      };
      parent.children.push(node);
      stack.push(node);
    }
    return true;
  }

  // Opening tag: [tagname]
  const openMatch = trimmed.match(/^\[(\w+)\]$/);
  if (openMatch) {
    const node: WmlNode = {
      tag: openMatch[1],
      attributes: {},
      children: [],
      macros: [],
    };
    const parent = stack[stack.length - 1];
    parent.children.push(node);
    stack.push(node);
    return true;
  }

  return false;
}

function tryHandleMacroInvocation(
  trimmed: string,
  stack: WmlNode[],
  macroDictionary: MacroDictionary,
): boolean {
  // Macro invocation: {MACRO_NAME ...}
  const macroMatch = trimmed.match(/^\{(.+)\}$/);
  if (macroMatch && !trimmed.includes('=')) {
    const macroContent = macroMatch[1].trim();
    const macroName = macroContent.split(/\s+/)[0];

    // Try to expand macros from dictionary
    const entry = macroDictionary.get(macroName);
    if (entry) {
      let expansion = entry.body;
      const argsStr = macroContent.slice(macroName.length).trim();

      if (entry.params.length > 0 && argsStr.length > 0) {
        // Parameterized macro: substitute positional arguments
        const argValues = parseMacroArgs(argsStr);
        for (let p = 0; p < entry.params.length; p++) {
          const pName = entry.params[p];
          const pVal = argValues[p] ?? '';
          expansion = expansion.split(`{${pName}}`).join(pVal);
        }
      }
      // Re-parse the expanded content
      const expandedNode = parseWml(expansion, macroDictionary);
      const currentNode = stack[stack.length - 1];
      // Merge expanded content into current node
      for (const child of expandedNode.children) {
        currentNode.children.push(child);
      }
      for (const [key, value] of Object.entries(expandedNode.attributes)) {
        currentNode.attributes[key] = value;
      }
    } else {
      // Record as unexpanded macro
      const currentNode = stack[stack.length - 1];
      currentNode.macros.push(macroContent);
    }
    return true;
  }
  return false;
}

interface ParseState {
  macroDictionary: MacroDictionary;
  stack: WmlNode[];
  defineState: DefineState;
  pendingKeys: string[];
  pendingValue: string;
  multiLineQuoteOpen: boolean;
  skipNewlinesAfterPlus: boolean;
  inHeredoc: boolean;
  heredocValue: string;
}

function handleHeredocContinuation(line: string, state: ParseState): boolean {
  if (!state.inHeredoc) {
    return false;
  }

  const closeIdx = line.indexOf('>>');
  if (closeIdx >= 0) {
    state.heredocValue += line.slice(0, closeIdx);
    const currentNode = state.stack[state.stack.length - 1];
    // Assign empty string to all keys except the last one
    for (let k = 0; k < state.pendingKeys.length - 1; k++) {
      currentNode.attributes[state.pendingKeys[k]] = '';
    }
    const lastKey = state.pendingKeys[state.pendingKeys.length - 1];
    if (lastKey) {
      let val = state.heredocValue;
      if (state.macroDictionary) {
        val = expandConstantMacros(val, state.macroDictionary);
      }
      currentNode.attributes[lastKey] = val.trim();
    }
    state.inHeredoc = false;
    state.pendingKeys = [];
    state.heredocValue = '';
  } else {
    state.heredocValue += `${line}\n`;
  }
  return true;
}

function handleMultilineContinuation(line: string, state: ParseState): boolean {
  if (!state.multiLineQuoteOpen && state.pendingKeys.length === 0) {
    return false;
  }

  let appendStr = line;
  if (state.skipNewlinesAfterPlus) {
    appendStr = line.trimStart();
  }

  if (state.multiLineQuoteOpen) {
    state.pendingValue += `\n${appendStr}`;
    if (hasClosingQuote(line)) {
      state.multiLineQuoteOpen = false;
      // Check if there is a trailing + after the closing quote
      if (state.pendingValue.trimEnd().endsWith('+')) {
        state.skipNewlinesAfterPlus = true;
        return true;
      }
      assignPendingKeys(
        state.stack[state.stack.length - 1],
        state.pendingKeys,
        state.pendingValue,
        state.macroDictionary,
      );
      state.pendingKeys = [];
      state.pendingValue = '';
      state.skipNewlinesAfterPlus = false;
    }
  } else {
    // Continuing due to trailing +
    state.pendingValue += appendStr;
    if (hasOpenQuote(appendStr)) {
      state.multiLineQuoteOpen = true;
      state.skipNewlinesAfterPlus = false;
      return true;
    }
    if (state.pendingValue.trimEnd().endsWith('+')) {
      state.skipNewlinesAfterPlus = true;
      return true;
    }
    assignPendingKeys(
      state.stack[state.stack.length - 1],
      state.pendingKeys,
      state.pendingValue,
      state.macroDictionary,
    );
    state.pendingKeys = [];
    state.pendingValue = '';
    state.skipNewlinesAfterPlus = false;
  }
  return true;
}

function handleKeyValueLine(line: string, state: ParseState): boolean {
  const kvMatch = line.match(/^\s*([\w\s,]+?)\s*=\s*(.*)/);
  if (!kvMatch) {
    return false;
  }

  const keysStr = kvMatch[1];
  const valueStr = kvMatch[2];

  const keys = keysStr
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (keys.length === 0) {
    return true;
  }

  // Check for heredoc start: <<
  const heredocIdx = valueStr.indexOf('<<');
  if (heredocIdx >= 0) {
    state.pendingKeys = keys;
    state.inHeredoc = true;
    state.heredocValue = `${valueStr.slice(heredocIdx + 2)}\n`;
    // Check if heredoc closes on the same line (e.g. code = << blah >>)
    const closeIdx = state.heredocValue.indexOf('>>');
    if (closeIdx >= 0) {
      const actualVal = state.heredocValue.slice(0, closeIdx);
      const currentNode = state.stack[state.stack.length - 1];
      for (let k = 0; k < keys.length - 1; k++) {
        currentNode.attributes[keys[k]] = '';
      }
      let val = actualVal;
      if (state.macroDictionary) {
        val = expandConstantMacros(val, state.macroDictionary);
      }
      currentNode.attributes[keys[keys.length - 1]] = val.trim();
      state.inHeredoc = false;
      state.pendingKeys = [];
      state.heredocValue = '';
    }
    return true;
  }

  // Check for unclosed quote
  if (hasOpenQuote(valueStr)) {
    state.pendingKeys = keys;
    state.pendingValue = valueStr;
    state.multiLineQuoteOpen = true;
    return true;
  }

  // Check for trailing +
  if (valueStr.trimEnd().endsWith('+')) {
    state.pendingKeys = keys;
    state.pendingValue = valueStr;
    state.skipNewlinesAfterPlus = true;
    return true;
  }

  // Complete assignment
  assignPendingKeys(
    state.stack[state.stack.length - 1],
    keys,
    valueStr,
    state.macroDictionary,
  );
  return true;
}

/**
 * Parse WML text content into a tree of WmlNode objects.
 */
export function parseWml(
  content: string,
  baseMacroDictionary?: MacroDictionary,
): WmlNode {
  const state: ParseState = {
    macroDictionary: new Map(baseMacroDictionary),
    stack: [
      {
        tag: 'root',
        attributes: {},
        children: [],
        macros: [],
      },
    ],
    defineState: {
      inDefine: false,
      defineName: '',
      defineParams: [],
      defineBody: [],
    },
    pendingKeys: [],
    pendingValue: '',
    multiLineQuoteOpen: false,
    skipNewlinesAfterPlus: false,
    inHeredoc: false,
    heredocValue: '',
  };

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      tryHandleDefineOrUndef(line, state.defineState, state.macroDictionary)
    ) {
      continue;
    }

    // Skip comments and preprocessor directives (unless in heredoc or multiline string)
    if (!state.inHeredoc && !state.multiLineQuoteOpen && /^\s*#/.test(line)) {
      continue;
    }

    if (handleHeredocContinuation(line, state)) {
      continue;
    }

    if (handleMultilineContinuation(line, state)) {
      continue;
    }

    // Trim for tag/key detection
    const trimmed = line.trim();
    if (trimmed === '') continue;

    if (tryHandleTag(trimmed, state.stack)) {
      continue;
    }

    if (tryHandleMacroInvocation(trimmed, state.stack, state.macroDictionary)) {
      continue;
    }

    if (handleKeyValueLine(line, state)) {
      continue;
    }

    // Lines with inline macros within other content — record as macros
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const currentNode = state.stack[state.stack.length - 1];
      currentNode.macros.push(trimmed.slice(1, -1).trim());
    }
  }

  return state.stack[0];
}

/**
 * Check if a string has an opening quote that hasn't been closed.
 */
function hasOpenQuote(s: string): boolean {
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"' && (i === 0 || s[i - 1] !== '\\')) {
      inQuote = !inQuote;
    }
  }
  return inQuote;
}

/**
 * Check if a line closes a multi-line quote.
 */
function hasClosingQuote(s: string): boolean {
  let quoteCount = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"' && (i === 0 || s[i - 1] !== '\\')) {
      quoteCount++;
    }
  }
  // An odd number of quotes means the quote state flipped (closed)
  return quoteCount % 2 === 1;
}

/**
 * Resolve constant macro references in a string.
 * Only expands macros with no parameters (constants).
 */
function expandConstantMacros(value: string, macros: MacroDictionary): string {
  let result = value;
  let prev = '';
  let maxLoops = 10;
  while (result !== prev && maxLoops > 0) {
    prev = result;
    result = result.replace(/\{([A-Z_:][A-Z0-9_:]*)\}/g, (match, name) => {
      const entry = macros.get(name);
      if (entry && entry.params.length === 0) {
        return entry.body;
      }
      return match;
    });
    maxLoops--;
  }
  return result;
}

/**
 * Clean a WML value string:
 *  - Remove _ "..." translation markers
 *  - Remove surrounding quotes
 *  - Expand inline macro references
 *  - Handle string concatenation with + operator
 */
function cleanValue(raw: string, macros?: MacroDictionary): string {
  let value = raw.trim();

  // Remove trailing inline comments (# not inside quotes)
  value = stripInlineComment(value);

  // Handle string concatenation: pieces joined with +
  // Example: _ "part1" + "\n\n" + _ "part2"
  if (value.includes('" +') || value.includes('+ _') || value.includes('+ "')) {
    return cleanConcatenatedString(value, macros);
  }

  // Remove translation marker
  value = value.replace(/^_\s*"/, '"');

  // Expand inline macro references like {MACRO_NAME}
  if (macros) {
    value = expandConstantMacros(value, macros);
  }

  // Remove surrounding quotes
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }

  return value.trim();
}

/**
 * Handle concatenated WML strings like:
 *   _ "part1" + "\n" + _ "part2"
 */
function cleanConcatenatedString(
  raw: string,
  macros?: MacroDictionary,
): string {
  // Split on + that's outside of quotes
  const parts: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"' && (i === 0 || raw[i - 1] !== '\\')) {
      inQuote = !inQuote;
      current += ch;
    } else if (ch === '+' && !inQuote) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts
    .map((part) => {
      let p = part.trim();
      // Handle macro reference like {RACIAL_NOTES_ORCS_AND_GOBLINS}
      if (macros) {
        p = expandConstantMacros(p, macros);
      }
      // Remove translation marker
      p = p.replace(/^_\s*"/, '"');
      // Remove quotes
      if (p.startsWith('"') && p.endsWith('"')) {
        p = p.slice(1, -1);
      }
      return p;
    })
    .join('');
}

/**
 * Strip inline comments (# not inside quotes).
 */
function stripInlineComment(s: string): string {
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"' && (i === 0 || s[i - 1] !== '\\')) {
      inQuote = !inQuote;
    } else if (s[i] === '#' && !inQuote) {
      return s.slice(0, i).trimEnd();
    }
  }
  return s;
}

/**
 * Find all child nodes with a specific tag name (non-recursive).
 */
export function findChildren(node: WmlNode, tag: string): WmlNode[] {
  return node.children.filter((c) => c.tag === tag);
}

/**
 * Find the first child node with a specific tag name (non-recursive).
 */
export function findChild(node: WmlNode, tag: string): WmlNode | undefined {
  return node.children.find((c) => c.tag === tag);
}

/**
 * Get a string attribute, returning undefined if not present.
 */
export function getAttr(node: WmlNode, key: string): string | undefined {
  return node.attributes[key];
}

/**
 * Get a numeric attribute, returning undefined if not present or NaN.
 */
export function getNumAttr(node: WmlNode, key: string): number | undefined {
  const v = node.attributes[key];
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Get a comma-separated list attribute, returning empty array if not present.
 */
export function getListAttr(node: WmlNode, key: string): string[] {
  const v = node.attributes[key];
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
