// BT.CPP reads XML with tinyxml2, which loads files a browser's strict parser
// rejects. tinyxml2 takes an attribute value as everything up to its closing
// quote, passes an unknown & through as is, and skips whitespace before the
// XML declaration. Hand-written trees lean on that (_skipIf="a && b",
// code="x < 3"), so this rewrites those spots into well-formed XML before
// parsing. Well-formed input comes back unchanged.

const ENTITY = /&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/y;

// Copied verbatim: an & or < inside these is already legal
const VERBATIM: [open: string, close: string][] = [
  ['<!--', '-->'],
  ['<![CDATA[', ']]>'],
  ['<?', '?>'],
];

const isEntityAt = (text: string, at: number) => {
  ENTITY.lastIndex = at;
  return ENTITY.test(text);
};

export function tolerateBtcppXml(text: string): string {
  // Moving the whitespace after the declaration keeps every line number
  const source = text.replace(/^\uFEFF/, '').replace(/^(\s+)(<\?xml\s[^]*?\?>)/, '$2$1');
  const out: string[] = [];
  let i = 0;
  let copied = 0;
  const replace = (at: number, by: string) => {
    out.push(source.slice(copied, at), by);
    copied = at + 1;
  };

  while (i < source.length) {
    const c = source[i];
    if (c === '&') {
      if (!isEntityAt(source, i)) replace(i, '&amp;');
      i++;
      continue;
    }
    if (c !== '<') {
      i++;
      continue;
    }
    const verbatim = VERBATIM.find(([open]) => source.startsWith(open, i));
    if (verbatim) {
      const end = source.indexOf(verbatim[1], i + verbatim[0].length);
      i = end < 0 ? source.length : end + verbatim[1].length;
      continue;
    }
    // A tag: escape inside quoted attribute values, up to the closing >
    let quote = '';
    for (i++; i < source.length; i++) {
      const d = source[i];
      if (quote) {
        if (d === quote) quote = '';
        else if (d === '<') replace(i, '&lt;');
        else if (d === '&' && !isEntityAt(source, i)) replace(i, '&amp;');
      } else if (d === '"' || d === "'") {
        quote = d;
      } else if (d === '>') {
        i++;
        break;
      }
    }
  }
  out.push(source.slice(copied));
  return out.join('');
}

export type XmlParseError = { message: string; line?: number; column?: number };

const FIREFOX_NS = 'http://www.mozilla.org/newlayout/xml/parsererror.xml';

// Every engine words a parse error its own way:
// - Firefox: "XML Parsing Error: <message>\nLocation: …\nLine Number 7, Column 32:"
//   in its own namespace, then a <sourcetext> child; localized in non-English builds
// - Chrome and Safari: "error on line 7 at column 32: <message>" in a <div>
//   between two <h3> headings
// - jsdom (tests), in Firefox's namespace, and the CLI's xmldom shim: "7:32: <message>"
export function readParserError(error: Element): XmlParseError {
  const firefox = (error.firstChild?.textContent ?? '').split('\n');
  if (error.namespaceURI === FIREFOX_NS && firefox.length >= 3) {
    const [heading, , location] = firefox;
    const at = /(\d+)\D+(\d+)/.exec(location);
    const message = heading.slice(heading.indexOf(':') + 1).trim();
    return at ? { message, line: Number(at[1]), column: Number(at[2]) } : { message };
  }

  const text = (error.getElementsByTagName('div')[0] ?? error).textContent ?? '';
  const firstLine = text.trim().split('\n')[0].trim();
  const at =
    /^error on line (\d+) at column (\d+):\s*(.*)$/i.exec(firstLine) ?? /^(\d+):(\d+):\s*(.*)$/.exec(firstLine);
  return at ? { message: at[3].trim(), line: Number(at[1]), column: Number(at[2]) } : { message: firstLine };
}
