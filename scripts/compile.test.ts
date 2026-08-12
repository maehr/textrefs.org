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
import { v5 as uuidv5 } from 'uuid';
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

// --- Mapping relation vocabulary (ADR-0006) -------------------------------

const mappings = `
mappings:
  - relation: alternateOf
    identifier: 'https://www.wikidata.org/entity/Q1'
    source: manual-curation
    status: active
    created: 2026-01-01
    modified: 2026-01-01
  - relation: isReferencedBy
    identifier: 'https://en.wikipedia.org/wiki/Test'
    source: manual-curation
    status: active
    created: 2026-01-01
    modified: 2026-01-01
`;

const workWithMappings = (extra = '') => ({
	systems: twoSystems,
	works: {
		'test.work': `${workHeader()}
citation_system: primary-section
references:
  - '5'
${mappings}${extra}`,
	},
});

test('the work projection groups every relation onto its own array', () => {
	const reg = compileFixture(workWithMappings());
	const work = reg.works.find((w) => w.key === 'test.work');
	assert.ok(work);
	assert.deepEqual(work.alternateOf, ['https://www.wikidata.org/entity/Q1']);
	assert.deepEqual(work.isReferencedBy, ['https://en.wikipedia.org/wiki/Test']);
	assert.equal(reg.mappings.length, 2);
});

test('tombstoned mappings are excluded from the projection', () => {
	const reg = compileFixture({
		systems: twoSystems,
		works: {
			'test.work': `${workHeader()}
citation_system: primary-section
references:
  - '5'

mappings:
  - relation: alternateOf
    identifier: 'https://www.wikidata.org/entity/Q1'
    source: manual-curation
    status: withdrawn
    created: 2026-01-01
    modified: 2026-01-01
  - relation: isReferencedBy
    identifier: 'https://en.wikipedia.org/wiki/Test'
    source: manual-curation
    status: blocked
    created: 2026-01-01
    modified: 2026-01-01
`,
		},
	});
	const work = reg.works.find((w) => w.key === 'test.work');
	assert.ok(work);
	assert.equal(work.alternateOf, undefined);
	assert.equal(work.isReferencedBy, undefined);
	// The reified assertions survive as tombstones; only the projection drops them.
	assert.equal(reg.mappings.length, 2);
});

test('mapping IRIs are deterministic from [subject, relation, target]', () => {
	const reg = compileFixture(workWithMappings());
	// Recomputed independently here, exactly as validate-data.ts and any
	// third-party implementation would (identifier-syntax, MappingAssertion seed).
	for (const m of reg.mappings) {
		const seed = [m.subject, m.relation, m.target.identifier].join('\n');
		assert.equal(
			m.id,
			`https://textrefs.org/id/mapping/${uuidv5(seed, 'f16bb214-4241-549d-ad41-7b011f02befb')}`,
		);
	}
	// The relation is *in* the seed, so reclassifying a target re-mints its IRI.
	const [alternate, referenced] = reg.mappings;
	assert.notEqual(alternate.id, referenced.id);
});

test('a relation outside the enum is rejected at parse time', (t) => {
	const message = expectCompileError(t, {
		systems: twoSystems,
		works: {
			'test.work': `${workHeader()}
citation_system: primary-section
references:
  - '5'

mappings:
  - relation: closeMatch
    identifier: 'https://en.wikipedia.org/wiki/Test'
    source: manual-curation
    status: active
    created: 2026-01-01
    modified: 2026-01-01
`,
		},
	});
	assert.match(message, /test\.work/);
});

// --- Resolver URL expansion -------------------------------------------------
//
// `vars` (this section's main subject) rides on the same skip-and-warn path as
// a missing template variable, so the pre-existing `url` / `url_by` behaviour
// is pinned here too — it had no coverage before.

const bookChapter = {
	'book-chapter': system(
		'book-chapter',
		'active',
		'^(?<book>[1-4]?[A-Za-z]+)\\.(?<chapter>[1-9][0-9]*)$',
	),
};

/** One work, one resolver, two locators — `Gen.1` and `John.3`. */
const workWithResolver = (resolver: string) => ({
	systems: bookChapter,
	works: {
		'test.work': `${workHeader()}
citation_system: book-chapter
resolvers:
${resolver}
references:
  - 'Gen.1'
  - 'John.3'
`,
	},
});

const urlFor = (reg: CompiledRegistry, locator: string) =>
	reg.references.find((r) => r.locator === locator)?.resolver_targets[0]?.url;

test('a url template expands the locator capture groups', () => {
	const reg = compileFixture(
		workWithResolver(`  - url: 'https://example.org/{book}/{chapter}'`),
	);
	assert.equal(urlFor(reg, 'Gen.1'), 'https://example.org/Gen/1');
	assert.equal(urlFor(reg, 'John.3'), 'https://example.org/John/3');
	assert.equal(reg.warnings, 0);
});

test('url_by picks a whole URL by key, and an absent key skips the entry', () => {
	const reg = compileFixture(
		workWithResolver(`  - url_by:
      book:
        Gen: 'https://example.org/genesis'`),
	);
	assert.equal(urlFor(reg, 'Gen.1'), 'https://example.org/genesis');
	assert.equal(urlFor(reg, 'John.3'), undefined, 'John has no url_by entry');
	assert.equal(reg.warnings, 1);
});

test('vars translates a locator value into the provider vocabulary', () => {
	const reg = compileFixture(
		workWithResolver(`  - vars:
      bookUsfm:
        from: book
        map:
          Gen: GEN
          John: JHN
    url: 'https://example.org/{bookUsfm}.{chapter}/#{bookUsfm}.{chapter}'`),
	);
	assert.equal(urlFor(reg, 'Gen.1'), 'https://example.org/GEN.1/#GEN.1');
	assert.equal(urlFor(reg, 'John.3'), 'https://example.org/JHN.3/#JHN.3');
	assert.equal(reg.warnings, 0);
});

test('a hole in a vars map skips the entry and warns rather than emitting a wrong URL', () => {
	const reg = compileFixture(
		workWithResolver(`  - vars:
      bookUsfm:
        from: book
        map:
          Gen: GEN
    url: 'https://example.org/{bookUsfm}.{chapter}'`),
	);
	assert.equal(urlFor(reg, 'Gen.1'), 'https://example.org/GEN.1');
	assert.equal(urlFor(reg, 'John.3'), undefined, 'John is unmapped');
	assert.equal(reg.warnings, 1);
});

test('vars composes with url_by', () => {
	const reg = compileFixture(
		workWithResolver(`  - vars:
      slug:
        from: book
        map:
          Gen: genesis
          John: john
    url_by:
      slug:
        genesis: 'https://example.org/a'
        john: 'https://example.org/b'`),
	);
	assert.equal(urlFor(reg, 'Gen.1'), 'https://example.org/a');
	assert.equal(urlFor(reg, 'John.3'), 'https://example.org/b');
	assert.equal(reg.warnings, 0);
});

test('a vars name that shadows a locator variable is rejected', (t) => {
	const message = expectCompileError(
		t,
		workWithResolver(`  - vars:
      book:
        from: book
        map:
          Gen: GEN
    url: 'https://example.org/{book}'`),
	);
	assert.match(message, /shadows a locator-derived variable/);
});
