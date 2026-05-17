/**
 * WML (Wesnoth Markup Language) Parser
 *
 * Parses WML files into a tree of WmlNode objects.
 * Handles:
 *   - [tag] / [/tag] nesting
 *   - key=value pairs (including _ "translated strings")
 *   - {MACRO_NAME args...} invocations (simple constant macros expanded via dictionary)
 *   - #textdomain, # comments → skipped
 *   - #define / #enddef → skipped (macro definitions are loaded separately by macro-loader)
 *   - [+tag] merge syntax (appends to most recent same-named tag)
 *   - String concatenation with + operator
 *
 * Limitations (recorded for future phases):
 *   - Parameterized macros are NOT expanded; stored as macro names
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

export type MacroDictionary = Map<string, string>;

/**
 * Parse WML text content into a tree of WmlNode objects.
 */
export function parseWml(
  content: string,
  baseMacroDictionary?: MacroDictionary,
): WmlNode {
  const macroDictionary: MacroDictionary = new Map(baseMacroDictionary);
  const root: WmlNode = {
    tag: 'root',
    attributes: {},
    children: [],
    macros: [],
  };
  const stack: WmlNode[] = [root];
  const lines = content.split('\n');
  let inDefine = false;
  let defineName = '';
  let defineBody: string[] = [];
  let multiLineKey = '';
  let multiLineValue = '';
  let multiLineQuoteOpen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle #define / #enddef blocks
    const defineMatch = line.match(/^\s*#define\s+(\S+)(.*)$/);
    if (defineMatch) {
      const macroName = defineMatch[1];
      const rest = defineMatch[2].trim();
      if (rest.includes('#enddef')) {
        const body = rest.replace(/\s*#enddef.*$/, '').trim();
        macroDictionary.set(macroName, body);
        continue;
      } else if (rest.length > 0) {
        defineBody = [rest];
      } else {
        defineBody = [];
      }
      inDefine = true;
      defineName = macroName;
      continue;
    }
    if (inDefine) {
      if (line.includes('#enddef')) {
        const before = line.replace(/\s*#enddef.*$/, '').trim();
        if (before.length > 0) defineBody.push(before);
        inDefine = false;
        const bodyStr = defineBody.join('\n').trim();
        macroDictionary.set(defineName, bodyStr);
      } else {
        defineBody.push(line);
      }
      continue;
    }

    // Handle #undef
    const undefMatch = line.match(/^\s*#undef\s+(\S+)/);
    if (undefMatch) {
      macroDictionary.delete(undefMatch[1]);
      continue;
    }

    // Skip comments and preprocessor directives
    if (/^\s*#/.test(line)) continue;

    // Handle multi-line string continuation
    if (multiLineQuoteOpen) {
      multiLineValue += '\n' + line;
      // Check if quote closes on this line
      if (hasClosingQuote(line)) {
        multiLineQuoteOpen = false;
        const currentNode = stack[stack.length - 1];
        currentNode.attributes[multiLineKey] = cleanValue(
          multiLineValue,
          macroDictionary,
        );
        multiLineKey = '';
        multiLineValue = '';
      }
      continue;
    }

    // Trim for tag/key detection
    const trimmed = line.trim();
    if (trimmed === '') continue;

    // Closing tag: [/tagname]
    const closeMatch = trimmed.match(/^\[\/(\w+)\]$/);
    if (closeMatch) {
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
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
      continue;
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
      continue;
    }

    // Macro invocation: {MACRO_NAME ...}
    const macroMatch = trimmed.match(/^\{(.+)\}$/);
    if (macroMatch && !trimmed.includes('=')) {
      const macroContent = macroMatch[1].trim();
      const macroName = macroContent.split(/\s+/)[0];

      // Try to expand simple constant macros and parameterized macros
      if (macroDictionary?.has(macroName)) {
        const fullBody = macroDictionary.get(macroName)!;
        let expansion = fullBody;
        if (macroContent.includes(' ')) {
          const bodyLines = fullBody.split('\n');
          const paramNames = bodyLines[0].trim().split(/\s+/);
          const argValues = macroContent.slice(macroName.length).trim().split(/\s+/);
          expansion = bodyLines.slice(1).join('\n');
          for (let p = 0; p < paramNames.length; p++) {
            if (paramNames[p]) {
              const pName = paramNames[p];
              const pVal = argValues[p] ?? '';
              expansion = expansion.split('{' + pName + '}').join(pVal);
            }
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
      continue;
    }

    // Key=value pair
    const kvMatch = line.match(/^\s*(\w+)\s*=\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2];

      // Check for multi-line strings (unclosed quote)
      if (hasOpenQuote(value)) {
        multiLineKey = key;
        multiLineValue = value;
        multiLineQuoteOpen = true;
        continue;
      }

      const currentNode = stack[stack.length - 1];
      currentNode.attributes[key] = cleanValue(value, macroDictionary);
      continue;
    }

    // Lines with inline macros within other content — record as macros
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const currentNode = stack[stack.length - 1];
      currentNode.macros.push(trimmed.slice(1, -1).trim());
    }
  }

  return root;
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
    let prev = '';
    let maxLoops = 10;
    while (value !== prev && maxLoops > 0) {
      prev = value;
      value = value.replace(/\{([A-Z_:][A-Z0-9_:]*)\}/g, (match, name) => {
        return macros.get(name) ?? match;
      });
      maxLoops--;
    }
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
        let prev = '';
        let maxLoops = 10;
        while (p !== prev && maxLoops > 0) {
          prev = p;
          p = p.replace(/\{([A-Z_:][A-Z0-9_:]*)\}/g, (match, name) => {
            return macros.get(name) ?? match;
          });
          maxLoops--;
        }
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
