// Runs the editor's real BT.CPP import/export over the corpus that run.sh
// downloads, writing the files the BT.CPP checker then loads. Run through
// vitest (see vitest.config.ts here) for jsdom's DOMParser; not part of
// `pnpm test`.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { b3ToProject, parseImportedJson } from '../../src/lib/behavior/b3';
import { BtcppIssue, btcppToProject, BtcppVersion, parseBtcppXml, projectToBtcpp } from '../../src/lib/behavior/btcpp';
import { DEFAULT_NODES } from '../../src/lib/behavior/defaults';
import { Project } from '../../src/types';

const CORPUS = process.env.BTCPP_CORPUS ?? '';
const OUT = process.env.BTCPP_OUT ?? '';

type Entry = { file: string; source: string; issues: BtcppIssue[] };

const xmlFiles = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.xml')).sort();

it('exports the corpus', () => {
  expect(CORPUS && OUT, 'set BTCPP_CORPUS and BTCPP_OUT (run.sh does)').toBeTruthy();
  const report: Entry[] = [];

  const write = (project: Project, version: BtcppVersion, group: string, name: string, source: string) => {
    const { xml, issues } = projectToBtcpp(project, { version, layout: 'horizontal' });
    const dir = join(OUT, `v${version}`, group);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.xml`), xml);
    report.push({ file: `v${version}/${group}/${name}.xml`, source, issues });
  };

  // Nav2's own trees, written back in the version their distro uses
  for (const [distro, version] of [['humble', 3], ['jazzy', 4]] as const) {
    const dir = join(CORPUS, `nav2-${distro}`, 'trees');
    for (const file of xmlFiles(dir)) {
      const imported = parseBtcppXml(readFileSync(join(dir, file), 'utf8'), DEFAULT_NODES, 'horizontal');
      if (imported.kind !== 'trees') throw new Error(`${file} has no trees`);
      const errors = imported.issues.filter((i) => i.level === 'error');
      expect(errors, `import of ${distro}/${file}`).toEqual([]);
      write(btcppToProject(imported, file), version, 'nav2', `${distro}-${basename(file, '.xml')}`, `nav2-${distro}/trees/${file}`);
    }
  }

  // The behavior3 examples, translated to both versions
  const examples = join(dirname(createRequire(import.meta.url).resolve('@behaviortrees/examples/package.json')), 'trees');
  for (const file of readdirSync(examples).filter((f) => f.endsWith('.json')).sort()) {
    const imported = parseImportedJson(JSON.parse(readFileSync(join(examples, file), 'utf8')));
    const project =
      imported.kind === 'project'
        ? imported.project
        : imported.kind === 'tree'
          ? b3ToProject({ trees: [imported.tree], custom_nodes: imported.tree.custom_nodes })
          : undefined;
    if (!project) continue;
    for (const version of [3, 4] as const) {
      write(project, version, 'examples', basename(file, '.json'), `examples/${file}`);
    }
  }

  writeFileSync(join(OUT, 'export-report.json'), JSON.stringify(report, null, 2));
  const counts = { error: 0, warning: 0, info: 0 };
  report.forEach((entry) => entry.issues.forEach((issue) => counts[issue.level]++));
  console.log(`Exported ${report.length} files: ${counts.error} errors, ${counts.warning} warnings, ${counts.info} notes`);

  // An export the editor itself flags as invalid is a failure before BT.CPP sees it
  const withErrors = report.filter((entry) => entry.issues.some((i) => i.level === 'error'));
  expect(withErrors.map((e) => e.file)).toEqual([]);
});
