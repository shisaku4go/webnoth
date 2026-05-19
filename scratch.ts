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
    // we should recursively expand just in case, but one bracket pair is standard
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

console.log(expandSequence('peasant-attack[1~5].png'));
console.log(expandSequence('ancient-lich-magic-[2,1].png'));
