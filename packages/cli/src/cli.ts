import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { getExample, listExamples, listNodeTypes } from './core/catalog';
import { convertTree, CONVERT_TARGETS, type ConvertTarget } from './core/convert';
import { listGuides, readGuide } from './core/guides';
import { createEditorLink, InvalidTreeError } from './core/link';
import { validateTree, type Finding } from './core/validate';
import { VERSION } from './version';

const HELP = `behaviortrees ${VERSION}: validate, convert and share behavior trees

Usage: behaviortrees <command> [file] [options]

Commands:
  validate [file]          Check a tree for errors (exits 1 if there are any)
  convert [file] --to <f>  Convert to behavior3, btcpp-v4 or btcpp-v3
  link [file]              Print a link that opens the tree in the editor
  nodes                    List the built-in behavior3 node types
  examples [id]            List example trees, or print one as JSON
  guides [slug]            List the behaviortrees.com guides, or print one
  mcp                      Run the MCP server over stdio

Files can be behavior3 JSON (a tree or a project) or BehaviorTree.CPP XML.
Leave out the file, or pass -, to read from stdin.

Options:
  --to <format>    convert: behavior3, btcpp-v4 or btcpp-v3
  -o, --out <path> convert: write to a file instead of stdout
  --open           link: also open it in your browser
  --json           print machine-readable JSON
  -h, --help       show this help
  -v, --version    show the version

Docs: https://www.behaviortrees.com/llms.txt`;

class UsageError extends Error {}

const readInput = async (file: string | undefined): Promise<string> => {
	if (file && file !== '-') return readFile(file, 'utf8');
	if (process.stdin.isTTY) throw new UsageError('Give a file, or pipe a tree into stdin');
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
};

const print = (value: unknown) => process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);

const formatFinding = (finding: Finding) =>
	`${finding.level.padEnd(7)}  ${finding.tree ? `${finding.tree}: ` : ''}${finding.message}`;

const openInBrowser = (url: string) => {
	const [command, args] =
		process.platform === 'darwin'
			? ['open', [url]]
			: process.platform === 'win32'
				? ['cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]]
				: ['xdg-open', [url]];
	spawn(command, args as string[], { detached: true, stdio: 'ignore' }).unref();
};

async function main(argv: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			to: { type: 'string' },
			out: { type: 'string', short: 'o' },
			open: { type: 'boolean' },
			json: { type: 'boolean' },
			help: { type: 'boolean', short: 'h' },
			version: { type: 'boolean', short: 'v' },
		},
	});
	const [command, arg] = positionals;

	if (values.version) return print(VERSION), 0;
	if (values.help || !command || command === 'help') return print(HELP), command || values.help ? 0 : 1;

	switch (command) {
		case 'validate': {
			const result = await validateTree(await readInput(arg));
			if (values.json) {
				print(result);
			} else {
				for (const tree of result.trees) {
					print(`${tree.title} (${tree.nodes} node${tree.nodes === 1 ? '' : 's'})`);
				}
				for (const finding of result.findings) print(formatFinding(finding));
				const errors = result.findings.filter((finding) => finding.level === 'error').length;
				print(result.valid ? 'Valid.' : `${errors} error${errors === 1 ? '' : 's'}.`);
			}
			return result.valid ? 0 : 1;
		}

		case 'convert': {
			if (!values.to || !CONVERT_TARGETS.includes(values.to as ConvertTarget)) {
				throw new UsageError(`convert needs --to ${CONVERT_TARGETS.join(' | ')}`);
			}
			const result = await convertTree(await readInput(arg), values.to as ConvertTarget);
			if (values.out) await writeFile(values.out, result.output);
			else process.stdout.write(result.output);
			for (const issue of result.issues) process.stderr.write(`${formatFinding(issue)}\n`);
			return 0;
		}

		case 'link': {
			try {
				const link = await createEditorLink(await readInput(arg));
				if (values.json) print(link);
				else print(link.url);
				for (const finding of link.findings.filter((f) => f.level !== 'info')) {
					process.stderr.write(`${formatFinding(finding)}\n`);
				}
				if (values.open) openInBrowser(link.url);
				return 0;
			} catch (error) {
				if (!(error instanceof InvalidTreeError)) throw error;
				process.stderr.write(`${error.message}\n`);
				return 1;
			}
		}

		case 'nodes': {
			const nodes = listNodeTypes();
			if (values.json) return print(nodes), 0;
			for (const node of nodes) print(`${node.name.padEnd(20)} ${node.category.padEnd(10)} ${node.description ?? ''}`);
			return 0;
		}

		case 'examples': {
			if (arg) {
				const example = getExample(arg);
				if (!example) throw new UsageError(`No example "${arg}". Run "behaviortrees examples" to list them.`);
				return print(example), 0;
			}
			const examples = listExamples();
			if (values.json) return print(examples), 0;
			for (const example of examples) print(`${example.id.padEnd(26)} ${example.title}`);
			return 0;
		}

		case 'guides': {
			if (arg) return print(await readGuide(arg)), 0;
			const guides = await listGuides();
			if (values.json) return print(guides), 0;
			for (const guide of guides) print(`${guide.slug.padEnd(36)} ${guide.title}`);
			return 0;
		}

		case 'mcp': {
			const [{ serveStdio }, { createMcpServer }] = await Promise.all([
				import('@modelcontextprotocol/server/stdio'),
				import('./mcp'),
			]);
			serveStdio(createMcpServer);
			return -1;
		}

		default:
			throw new UsageError(`Unknown command "${command}". Run "behaviortrees --help".`);
	}
}

main(process.argv.slice(2)).then(
	(code) => {
		if (code >= 0) process.exitCode = code;
	},
	(error) => {
		process.stderr.write(`behaviortrees: ${error instanceof Error ? error.message : String(error)}\n`);
		if (error instanceof UsageError) process.stderr.write('Run "behaviortrees --help" for usage.\n');
		process.exitCode = error instanceof UsageError ? 2 : 1;
	},
);
