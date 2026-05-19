function expandSequence(str: string): string[] {
  const match = str.match(/\[([0-9]+)~([0-9]+)\]/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    const res: string[] = [];
    const step = start <= end ? 1 : -1;
    for (let i = start; start <= end ? i <= end : i >= end; i += step) {
      res.push(str.replace(match[0], i.toString()));
    }
    return res;
  }
  const matchComma = str.match(/\[([0-9,]+)\]/);
  if (matchComma) {
    const parts = matchComma[1].split(',');
    const res: string[] = [];
    for (const p of parts) {
      res.push(str.replace(matchComma[0], p));
    }
    return res;
  }
  return [str];
}

function parseWmlImageString(
  rawImage: string,
  fallbackDuration?: number,
): { image: string; duration?: number }[] {
  if (!rawImage) return [];

  // WML image path could look like:
  // "peasant-attack[1~5].png:[100*2,150,100*2]"
  // "units/undead-necromancers/ancient-lich-magic-[1,2].png:50"
  // "a.png,b.png:100"

  const results: { image: string; duration?: number }[] = [];

  // Split by comma, but be careful not to split inside brackets.
  // A simple way is to match items.
  // Wait, if we just expand brackets FIRST, we can then split by comma?
  // No, "[100,100,150]" has commas. "[1,2]" has commas.
  // Actually, in WML, comma separated image list is just multiple images.
  // Let's first split the whole string into parts. We can do this by splitting on commas that are NOT inside brackets.

  let current = '';
  let depth = 0;
  const parts: string[] = [];
  for (let i = 0; i < rawImage.length; i++) {
    if (rawImage[i] === '[') depth++;
    else if (rawImage[i] === ']') depth--;
    else if (rawImage[i] === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += rawImage[i];
  }
  if (current) parts.push(current);

  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    // Check if there is a colon for duration
    let imagePart = part;
    let durationPart = '';

    // We look for the last colon, but wait, file paths shouldn't have colons.
    const colonIdx = part.lastIndexOf(':');
    if (colonIdx !== -1) {
      imagePart = part.slice(0, colonIdx);
      durationPart = part.slice(colonIdx + 1);
    }

    const expandedImages = expandSequence(imagePart);
    let expandedDurations: number[] = [];

    if (durationPart) {
      // e.g. "100" or "[100*2,150,100*2]"
      // Let's remove brackets from duration part if present
      if (durationPart.startsWith('[') && durationPart.endsWith(']')) {
        durationPart = durationPart.slice(1, -1);
      }

      const durParts = durationPart.split(',');
      for (const d of durParts) {
        if (d.includes('*')) {
          const [val, count] = d.split('*');
          for (let i = 0; i < parseInt(count); i++) {
            expandedDurations.push(parseInt(val));
          }
        } else {
          expandedDurations.push(parseInt(d));
        }
      }
    }

    // Zip them
    for (let i = 0; i < expandedImages.length; i++) {
      let dur = undefined;
      if (expandedDurations.length > 0) {
        dur = expandedDurations[Math.min(i, expandedDurations.length - 1)];
      } else if (fallbackDuration !== undefined) {
        dur = fallbackDuration;
      }

      results.push({
        image: expandedImages[i],
        duration: dur,
      });
    }
  }

  return results;
}

console.log(parseWmlImageString('peasant-attack[1~5].png:[100*2,150,100*2]'));
console.log(parseWmlImageString('ancient-lich-magic-[2,1].png:50'));
console.log(parseWmlImageString('a.png,b.png:100'));
console.log(parseWmlImageString('a.png,b.png', 50));
console.log(parseWmlImageString('a[1,2].png:[100,200]'));
