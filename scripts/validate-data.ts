import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { v5 as uuidv5 } from 'uuid';
import { compileRegistry, printIssues } from './compile.js';
import { refIri, mappingIri } from '../standard/iri.js';
import {
	Work,
	CitationSystem,
	CanonicalReference,
	MappingAssertion,
} from '../standard/schema/index.js';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// The namespaces and the seed strings below are deliberately a second,
// independent implementation of what `scripts/compile.ts` does. Do not "fix"
// this by importing `referenceUuid` and `mappingUuid` from the compiler.
//
// This gate exists to prove the compiler's identifiers are deterministic from
// the ADR-0002 tuple. Calling the compiler's own function to compute the
// expected value would make every assertion below a tautology that passes
// whatever the compiler does — including silently re-minting all 86k
// identifiers. Two implementations that must agree is the whole check.
const REFERENCE_NS = 'b1a3670e-2ac7-544c-a1b9-396e0dc193f7';
const MAPPING_NS = 'f16bb214-4241-549d-ad41-7b011f02befb';

const registry = compileRegistry();

let failed = 0;
let checked = 0;

function reportIssue(
	label: string,
	issues: readonly { path: readonly PropertyKey[]; message: string }[],
): void {
	console.error(`✗ ${label}:`);
	printIssues(issues);
	failed++;
}

for (const w of registry.works) {
	const r = Work.safeParse(w);
	checked++;
	if (!r.success) reportIssue(`work/${w.key}`, r.error.issues);
}

for (const s of registry.systems) {
	const r = CitationSystem.safeParse(s);
	checked++;
	if (!r.success) reportIssue(`system/${s.key}`, r.error.issues);
}

for (const ref of registry.references) {
	const r = CanonicalReference.safeParse(ref);
	checked++;
	if (!r.success) {
		reportIssue(`ref/${ref.work_key}/${ref.locator}`, r.error.issues);
		continue;
	}
	const seed = [ref.work_key, ref.citation_system_key, ref.locator].join('\n');
	const expected = refIri(uuidv5(seed, REFERENCE_NS));
	if (ref.id !== expected) {
		console.error(
			`✗ ref/${ref.work_key}/${ref.locator}: UUID not deterministic from seed (got ${ref.id}, expected ${expected})`,
		);
		failed++;
	}
}

for (const m of registry.mappings) {
	const r = MappingAssertion.safeParse(m);
	checked++;
	if (!r.success) {
		reportIssue(`mapping/${m.id}`, r.error.issues);
		continue;
	}
	const seed = [m.subject, m.relation, m.target.identifier].join('\n');
	const expected = mappingIri(uuidv5(seed, MAPPING_NS));
	if (m.id !== expected) {
		console.error(
			`✗ mapping/${m.id}: UUID not deterministic from seed (expected ${expected})`,
		);
		failed++;
	}
}

// JSON-LD context completeness — every emitted record key MUST resolve to a
// mapped term in public/contexts/v1.jsonld. Unmapped keys are silently dropped
// on RDF expansion, so a missing term is a wire-format bug.
const contextPath = join(projectRoot, 'public', 'contexts', 'v1.jsonld');
const contextDoc = JSON.parse(readFileSync(contextPath, 'utf8')) as {
	'@context': Record<string, unknown>;
};
const mappedKeys = new Set(Object.keys(contextDoc['@context']));

const unmapped = new Set<string>();
function walk(node: unknown): void {
	if (Array.isArray(node)) {
		for (const item of node) walk(item);
		return;
	}
	if (node === null || typeof node !== 'object') return;
	for (const [k, v] of Object.entries(node)) {
		if (!mappedKeys.has(k)) unmapped.add(k);
		walk(v);
	}
}

for (const r of registry.works) walk(r);
for (const r of registry.systems) walk(r);
for (const r of registry.references) walk(r);
for (const r of registry.mappings) walk(r);

if (unmapped.size > 0) {
	console.error(
		`\n✗ JSON-LD context is missing terms for emitted keys: ${[...unmapped].sort().join(', ')}`,
	);
	console.error(`  Add them to ${contextPath} or stop emitting the field.`);
	failed += unmapped.size;
}

console.log(
	`\n${checked - failed}/${checked} records valid (works=${registry.works.length}, systems=${registry.systems.length}, refs=${registry.references.length}, mappings=${registry.mappings.length})`,
);
if (failed > 0) process.exit(1);
