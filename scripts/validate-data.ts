import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { v5 as uuidv5 } from 'uuid';
import { compileRegistry } from './compile.js';
import {
	Work,
	CitationSystem,
	CanonicalReference,
	MappingAssertion,
} from '../standard/schema/index.js';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

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
	for (const issue of issues) {
		const path = issue.path.map((p) => String(p)).join('.');
		console.error(`    ${path || '(root)'}: ${issue.message}`);
	}
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
	const expected = `https://textrefs.org/id/ref/${uuidv5(seed, REFERENCE_NS)}`;
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
	const expected = `https://textrefs.org/id/mapping/${uuidv5(seed, MAPPING_NS)}`;
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
function termNames(context: Record<string, unknown>): string[] {
	return Object.keys(context).filter((term) => !term.startsWith('@'));
}

function scopedContextOf(
	definition: unknown,
): Record<string, unknown> | undefined {
	if (
		!definition ||
		typeof definition !== 'object' ||
		Array.isArray(definition)
	)
		return undefined;
	const scoped = (definition as { '@context'?: unknown })['@context'];
	if (!scoped || typeof scoped !== 'object' || Array.isArray(scoped))
		return undefined;
	return scoped as Record<string, unknown>;
}

// A term-scoped context defines its terms only under the term that owns it, so
// the check has to follow that scope. Flattening every scoped term into one set
// would accept `identifier` on a Work, where the context no longer defines it
// and expansion would silently drop the value.
const rootTerms = new Set(termNames(contextDoc['@context']));
const scopedTerms = new Map<string, Set<string>>();
for (const [term, definition] of Object.entries(contextDoc['@context'])) {
	const scoped = scopedContextOf(definition);
	if (scoped) scopedTerms.set(term, new Set(termNames(scoped)));
}

const unmapped = new Set<string>();
function walk(node: unknown, inScope: Set<string>): void {
	if (Array.isArray(node)) {
		for (const item of node) walk(item, inScope);
		return;
	}
	if (node === null || typeof node !== 'object') return;
	for (const [k, v] of Object.entries(node)) {
		if (!inScope.has(k)) unmapped.add(k);
		// A property-scoped context propagates to the nodes below it.
		const scoped = scopedTerms.get(k);
		walk(v, scoped ? new Set([...inScope, ...scoped]) : inScope);
	}
}

for (const r of registry.works) walk(r, rootTerms);
for (const r of registry.systems) walk(r, rootTerms);
for (const r of registry.references) walk(r, rootTerms);
for (const r of registry.mappings) walk(r, rootTerms);

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
