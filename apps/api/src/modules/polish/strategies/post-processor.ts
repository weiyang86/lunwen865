function fixSpacesBetweenCjkAndAscii(text: string): string {
  let out = text;
  out = out.replace(/([\u4e00-\u9fff])([A-Za-z0-9])/g, '$1 $2');
  out = out.replace(/([A-Za-z0-9])([\u4e00-\u9fff])/g, '$1 $2');
  return out;
}

function normalizePunctuation(text: string): string {
  let out = text;
  out = out.replace(/\s+([，。！？；：、])/g, '$1');
  out = out.replace(/([，。！？；：、])\s+/g, '$1');
  out = out.replace(/,+/g, '，');
  out = out.replace(/\.+/g, '。');
  out = out.replace(/!+/g, '！');
  out = out.replace(/\?+/g, '？');
  return out;
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n');
}

export function postProcess(text: string): string {
  let out = text ?? '';
  out = normalizeNewlines(out);
  out = normalizePunctuation(out);
  out = fixSpacesBetweenCjkAndAscii(out);
  out = out.replace(/[ \t]{2,}/g, ' ');
  return out.trim();
}
