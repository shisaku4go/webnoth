function expandSequence(str) {
  const match = str.match(/\[([0-9]+)~([0-9]+)\]/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    const res = [];
    const step = start <= end ? 1 : -1;
    for (let i = start; start <= end ? i <= end : i >= end; i += step) {
      res.push(str.replace(match[0], i.toString()));
    }
    return res;
  }
  const matchComma = str.match(/\[([0-9,]+)\]/);
  if (matchComma) {
    const parts = matchComma[1].split(',');
    const res = [];
    for (const p of parts) {
      res.push(str.replace(matchComma[0], p));
    }
    return res;
  }
  return [str];
}

function parseWmlImageString(rawImage, fallbackDuration) {
  if (!rawImage) return [];

  const results = [];

  let current = '';
  let depth = 0;
  const parts = [];
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

    let imagePart = part;
    let durationPart = '';

    const colonIdx = part.lastIndexOf(':');
    if (colonIdx !== -1) {
      imagePart = part.slice(0, colonIdx);
      durationPart = part.slice(colonIdx + 1);
    }

    const expandedImages = expandSequence(imagePart);
    let expandedDurations = [];

    if (durationPart) {
      if (durationPart.startsWith('[') && durationPart.endsWith(']')) {
        durationPart = durationPart.slice(1, -1);
      }

      const durParts = durationPart.split(',');
      for (const d of durParts) {
        if (d.includes('*')) {
          const splitVal = d.split('*');
          const val = splitVal[0];
          const count = splitVal[1];
          for (let i = 0; i < parseInt(count); i++) {
            expandedDurations.push(parseInt(val));
          }
        } else {
          expandedDurations.push(parseInt(d));
        }
      }
    }

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
