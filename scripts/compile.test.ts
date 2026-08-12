// Compiler coverage for the alias grammar and status dependency rules
// introduced by ADR-0005, on top of ADR-0004's two-state lifecycle.
//
// Each case builds a throwaway registry directory and compiles it, so the tests
// exercise the real YAML → record path (source validation included) rather than
// a hand-written CompiledRegistry.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileRegistry, type CompiledRegistry } from './compile.js';

type RegistryFiles = {
	systems: Record<string, string>;
	works: Record<string, string>;
};

function compileFixture(files: RegistryFiles): CompiledRegistry {
	const root = mkdtempSync(join(tmpdir(), 'textrefs-compile-'));
	try {
		mkdirSync(join(root, 'systems'));
		mkdirSync(join(root, 'works'));
		for (const [name, body] of Object.entries(files.systems)) {
			writeFileSync(join(root, 'systems', `${name}.yaml`), body);
		}
		for (const [name, body] of Object.entries(files.works)) {
			writeFileSync(join(root, 'works', `${name}.yaml`), body);
		}
		return compileRegistry(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

/** Compile expecting failure, without the expected diagnostics spamming stdout. */
function expectCompileError(t: TestContext, files: RegistryFiles): string {
	t.mock.method(console, 'error', () => {});
	try {
		compileFixture(files);
	} catch (e) {
		return e instanceof Error ? e.message : String(e);
	}
	assert.fail('expected compileRegistry to throw');
}

const system = (
	key: string,
	status = 'active',
	regex = '^(?<section>[1-9][0-9]*)$',
) => `
key: ${key}
preferred_label: ${key}
description: Test citation system ${key}.
locator_regex: '${regex}'
status: ${status}
created: 2026-01-01
modified: 2026-01-01
`;

const workHeader = (status = 'active') => `
work:
  key: test.work
  preferred_label: Test Work
  status: ${status}
  created: 2026-01-01
  modified: 2026-01-01
`;

const twoSystems = {
	'primary-section': system('primary-section'),
	'fallback-section': system('fallback-section'),
};

test('a work under two systems mints one bare and two qualified aliases', () => {
	const reg = compileFixture({
		systems: twoSystems,
		works: {
			'test.work': `${workHeader()}
citation_system: primary-section
references:
  - '5'

additional_systems:
  - citation_system: fallback-section
    references:
      - '5'
`,
		},
	});

	const primary = reg.references.find(
		(r) => r.citation_system_key === 'primary-section',
	);
	const fallback = reg.references.find(
		(r) => r.citation_system_key === 'fallback-section',
	);
	assert.ok(primary && fallback, 'both references are compiled');
	assert.notEqual(
		primary.id,
		fallback.id,
		'the same locator under two systems is two identities',
	);

	// Qualified for both, bare only for the preferred system.
	assert.equal(reg.aliases['test.work/primary-section/5'], primary.id);
	assert.equal(reg.aliases['test.work/fallback-section/5'], fallback.id);
	assert.equal(reg.aliases['test.work/5'], primary.id);

	const workAliases = Object.keys(reg.aliases).filter((a) =>
		a.startsWith('test.work/'),
	);
	assert.deepEqual(workAliases.sort(), [
		'test.work/5',
		'test.work/fallback-section/5',
		'test.work/primary-section/5',
	]);
});

test('declaring the same citation system twice is rejected at parse time', (t) => {
	const message = expectCompileError(t, {
		systems: twoSystems,
		works: {
			'test.work': `${workHeader()}
citation_system: primary-section
references:
  - '5'

additional_systems:
  - citation_system: primary-section
    references:
      - '6'
`,
		},
	});
	assert.match(message, /invalid source file/);
});

test('a locator containing "/" is rejected before any alias is minted', (t) => {
	const message = expectCompileError(t, {
		systems: {
			'slashed-section': system(
				'slashed-section',
				'active',
				'^(?<a>[0-9]+)/(?<b>[0-9]+)$',
			),
		},
		works: {
			'test.work': `${workHeader()}
citation_system: slashed-section
references:
  - '1/5'
`,
		},
	});
	assert.match(message, /alias grammar/);
});

test('an active reference under a draft citation system is rejected', (t) => {
	const message = expectCompileError(t, {
		systems: {
			'primary-section': system('primary-section'),
			'fallback-section': system('fallback-section', 'draft'),
		},
		works: {
			'test.work': `${workHeader()}
citation_system: primary-section
references:
  - '5'

additional_systems:
  - citation_system: fallback-section
    reference_status: active
    references:
      - '5'
`,
		},
	});
	assert.match(message, /active reference requires an active citation system/);
});

test('an active work whose preferred citation system is draft is rejected', (t) => {
	const message = expectCompileError(t, {
		systems: { 'primary-section': system('primary-section', 'draft') },
		works: {
			'test.work': `${workHeader()}
citation_system: primary-section
`,
		},
	});
	assert.match(
		message,
		/active work requires an active preferred citation system/,
	);
});

test('a draft fallback system does not downgrade an active work', () => {
	const reg = compileFixture({
		systems: {
			'primary-section': system('primary-section'),
			'fallback-section': system('fallback-section', 'draft'),
		},
		works: {
			'test.work': `${workHeader()}
citation_system: primary-section
references:
  - '5'

additional_systems:
  - citation_system: fallback-section
    references:
      - '5'
`,
		},
	});
	assert.equal(reg.works[0].status, 'active');
	const fallback = reg.references.find(
		(r) => r.citation_system_key === 'fallback-section',
	);
	assert.equal(fallback?.status, 'draft');
});

test('an additional system defaults to draft references even on an active work', () => {
	const reg = compileFixture({
		systems: twoSystems,
		works: {
			'test.work': `${workHeader()}
citation_system: primary-section
references:
  - '5'

additional_systems:
  - citation_system: fallback-section
    references:
      - '5'
`,
		},
	});
	const bySystem = Object.fromEntries(
		reg.references.map((r) => [r.citation_system_key, r.status]),
	);
	assert.equal(bySystem['primary-section'], 'active');
	assert.equal(bySystem['fallback-section'], 'draft');
});

test('every compiled work carries preferred_citation_system_key', () => {
	const reg = compileFixture({
		systems: twoSystems,
		works: {
			'test.work': `${workHeader()}
citation_system: primary-section
references:
  - '5'
`,
		},
	});
	for (const work of reg.works) {
		assert.equal(work.preferred_citation_system_key, 'primary-section');
	}
});
