// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readParserError, tolerateBtcppXml } from './xml-input';

const FIXTURES = join(__dirname, '__fixtures__', 'btcpp');

describe('tolerateBtcppXml', () => {
  it.each([
    ['<A _skipIf="a && b"/>', '<A _skipIf="a &amp;&amp; b"/>'],
    ["<A _skipIf='a && b'/>", "<A _skipIf='a &amp;&amp; b'/>"],
    ['<A code="x < 3"/>', '<A code="x &lt; 3"/>'],
    ['<A code="x > 3 && y < 2" b="1"/>', '<A code="x > 3 &amp;&amp; y &lt; 2" b="1"/>'],
    ['<A code="say \'<hi>\'"/>', '<A code="say \'&lt;hi>\'"/>'],
    ['<A code=\'say "<hi>"\'/>', '<A code=\'say "&lt;hi>"\'/>'],
    ['<A x="&nbsp;"/>', '<A x="&amp;nbsp;"/>'],
    ['<A x="&#X26;"/>', '<A x="&amp;#X26;"/>'],
    ['<p>salt & pepper</p>', '<p>salt &amp; pepper</p>'],
  ])('escapes what tinyxml2 tolerates: %s', (input, expected) => {
    expect(tolerateBtcppXml(input)).toBe(expected);
  });

  it.each([
    '<A x="&amp; &lt; &gt; &quot; &apos; &#38; &#x26; &#x2F;"/>',
    '<!-- a && b < c --><A/>',
    '<A><![CDATA[a && b < c]]></A>',
    '<?xml version="1.0" encoding="UTF-8"?><?pi a && b?><A/>',
    '<input_port name="goal">The robot\'s goal, "quoted"</input_port>',
    '<A x="1">\n  <B y=\'2\'/>\n</A>',
  ])('leaves well-formed XML alone: %s', (xml) => {
    expect(tolerateBtcppXml(xml)).toBe(xml);
  });

  it('only escapes inside attribute values, not between tags', () => {
    expect(tolerateBtcppXml('<A x="it\'s"/>it\'s & <B y="<"/>')).toBe('<A x="it\'s"/>it\'s &amp; <B y="&lt;"/>');
  });

  it('moves whitespace before the declaration after it, keeping line numbers', () => {
    const xml = '\n\n  <?xml version="1.0"?>\n<root/>';
    const tolerated = tolerateBtcppXml(xml);
    expect(tolerated.startsWith('<?xml version="1.0"?>')).toBe(true);
    expect(tolerated.split('\n').length).toBe(xml.split('\n').length);
    expect(tolerated.indexOf('<root/>')).toBe(xml.indexOf('<root/>'));
  });

  it('strips a byte order mark', () => {
    expect(tolerateBtcppXml('\uFEFF<root/>')).toBe('<root/>');
  });

  it('copies an unterminated comment or tag through', () => {
    expect(tolerateBtcppXml('<root><!-- a && b')).toBe('<root><!-- a && b');
    expect(tolerateBtcppXml('<root><A x="a && b')).toBe('<root><A x="a &amp;&amp; b');
  });

  it.each(readdirSync(FIXTURES).filter((f) => f.endsWith('.xml')))('leaves the %s fixture unchanged', (file) => {
    const xml = readFileSync(join(FIXTURES, file), 'utf8');
    expect(tolerateBtcppXml(xml)).toBe(xml.replace(/^\uFEFF/, ''));
  });
});

// Element shapes and messages captured from real Firefox, Chrome and WebKit
const FIREFOX_NS = 'http://www.mozilla.org/newlayout/xml/parsererror.xml';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

const firefoxError = (text: string, source: string) => {
  const el = document.createElementNS(FIREFOX_NS, 'parsererror');
  el.append(text);
  const sourcetext = document.createElementNS(FIREFOX_NS, 'sourcetext');
  sourcetext.append(source);
  el.append(sourcetext);
  return el;
};

const webkitError = (message: string) => {
  const el = document.createElementNS(XHTML_NS, 'parsererror');
  const h3 = (text: string) => Object.assign(document.createElementNS(XHTML_NS, 'h3'), { textContent: text });
  const div = Object.assign(document.createElementNS(XHTML_NS, 'div'), { textContent: message });
  el.append(h3('This page contains the following errors:'), div, h3('Below is a rendering of the page up to the first error.'));
  return el;
};

const plainError = (text: string, ns: string | null = null) => {
  const el = document.createElementNS(ns, 'parsererror');
  el.textContent = text;
  return el;
};

describe('readParserError', () => {
  it('reads Firefox, whose position is two lines below the message', () => {
    const error = firefoxError(
      'XML Parsing Error: not well-formed\nLocation: about:blank\nLine Number 3, Column 37:',
      '  <Script code="a := 1" _skipIf="a && b"/>\n------------------------------------^'
    );
    expect(readParserError(error)).toEqual({ message: 'not well-formed', line: 3, column: 37 });
  });

  it('reads a localized Firefox', () => {
    const error = firefoxError(
      "Erreur d'analyse XML : mal formé\nEmplacement : https://www.behaviortrees.com/editor\nNuméro de ligne 7, Colonne 32 :",
      '<A 1="2"/>\n---^'
    );
    expect(readParserError(error)).toEqual({ message: 'mal formé', line: 7, column: 32 });
  });

  it('reads Chrome, whose message runs into the trailing heading', () => {
    const error = webkitError('error on line 7 at column 32: Unexpected token inside opening tag: Ã');
    expect(readParserError(error)).toEqual({ message: 'Unexpected token inside opening tag: Ã', line: 7, column: 32 });
  });

  it('keeps only the first line of a multi-line Chrome message', () => {
    const error = webkitError(
      'error on line 2 at column 8: Invalid processing instruction: <?xml\nThe XML spec only allows "<?xml" at the very beginning of the file'
    );
    expect(readParserError(error)).toEqual({ message: 'Invalid processing instruction: <?xml', line: 2, column: 8 });
  });

  it('reads Safari', () => {
    const error = webkitError('error on line 3 at column 37: xmlParseEntityRef: no name\n');
    expect(readParserError(error)).toEqual({ message: 'xmlParseEntityRef: no name', line: 3, column: 37 });
  });

  it('reads jsdom, which uses the Firefox namespace with a one-line message', () => {
    expect(readParserError(plainError('1:27: unclosed tag: BehaviorTree', FIREFOX_NS))).toEqual({
      message: 'unclosed tag: BehaviorTree',
      line: 1,
      column: 27,
    });
  });

  it('reads the CLI xmldom shim', () => {
    expect(readParserError(plainError('2:5: unclosed xml tag'))).toEqual({ message: 'unclosed xml tag', line: 2, column: 5 });
  });

  it('falls back to the first line when there is no position', () => {
    expect(readParserError(plainError('something broke\nmore'))).toEqual({ message: 'something broke' });
  });
});
