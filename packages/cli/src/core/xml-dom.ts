import { DOMParser as XmlDomParser } from '@xmldom/xmldom';

// The BT.CPP reader parses XML with the browser's DOMParser. Node has none, so
// this installs one backed by xmldom (pure JS, no dependencies). Browsers
// report malformed XML as a document holding a <parsererror> element, which is
// what the reader checks for; xmldom throws instead, so translate.
const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

class NodeDOMParser {
	parseFromString(text: string, type: string) {
		try {
			return new XmlDomParser({
				onError: (level: string, message: string) => {
					if (level !== 'warning') throw new Error(message);
				},
			}).parseFromString(text, type as 'application/xml');
		} catch (error) {
			// xmldom wraps errors thrown from onError: 'Reporting fatalError "msg" caused Error: msg'
			const raw = String((error as Error).message);
			const [message] = (/caused Error: (.*)/.exec(raw)?.[1] ?? raw).split('\n');
			const at = /line:(\d+),col:(\d+)/.exec(raw);
			const detail = `${at ? `${at[1]}:${at[2]}: ` : ''}${message.trim()}`;
			return new XmlDomParser().parseFromString(`<parsererror>${escapeText(detail)}</parsererror>`, 'application/xml');
		}
	}
}

export const ensureDomParser = async (): Promise<void> => {
	if (typeof globalThis.DOMParser === 'undefined') {
		globalThis.DOMParser = NodeDOMParser as unknown as typeof DOMParser;
	}
};
