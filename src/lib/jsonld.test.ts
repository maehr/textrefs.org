import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsonld from 'jsonld';
import type { ContextDefinition, JsonLdDocument } from 'jsonld';

import { fixtureRegistry } from './registry.fixture.ts';
import { MappingAssertion } from '../../standard/schema/mapping-assertion.js';
import {
	ONTOLOGY_IRI,
	ONTOLOGY_NAMESPACE,
	ONTOLOGY_TERMS,
	ONTOLOGY_VERSION,
	ontologyJsonLd,
} from './ontology.ts';

const projectRoot = join(import.meta.dirname, '..', '..');
const contextDocument = JSON.parse(
	readFileSync(join(projectRoot, 'public', 'contexts', 'v1.jsonld'), 'utf8'),
) as { '@context': Record<string, unknown> };
const context = contextDocument['@context'];

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const DCTERMS = 'http://purl.org/dc/terms/';
const PROV = 'http://www.w3.org/ns/prov#';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const OWL = 'http://www.w3.org/2002/07/owl#';

async function expand(record: object) {
	// The context comes from parsed JSON, whose broad runtime types cannot carry
	// the literal unions in @types/jsonld. The processor remains the authority.
	const document = {
		'@context': context as unknown as ContextDefinition,
		...record,
	} as JsonLdDocument;
	const nodes = await jsonld.expand(document, {});
	assert.equal(nodes.length, 1);
	return nodes[0] as Record<string, unknown>;
}

test('MappingAssertion expands as RDF reification without asserting its relation', async () => {
	for (const [relation, predicate] of [
		['alternateOf', `${PROV}alternateOf`],
		['isReferencedBy', `${DCTERMS}isReferencedBy`],
	] as const) {
		const mapping = structuredClone(fixtureRegistry.mappings[0]);
		mapping.relation = relation;
		const node = await expand(mapping);

		assert.deepEqual(node['@type'], [`${RDF}Statement`]);
		assert.deepEqual(node[`${RDF}subject`], [{ '@id': mapping.subject }]);
		assert.deepEqual(node[`${RDF}predicate`], [{ '@id': predicate }]);
		assert.deepEqual(node[`${RDF}object`], [
			{ '@id': mapping.target.identifier },
		]);

		// RDF reification describes the triple but does not assert it. The direct
		// edge is emitted only by the Work projection for eligible mappings.
		assert.equal(node[predicate], undefined);
	}
});

// `relation` is `@type: "@vocab"`, so a value the context does not define does
// not fail: it expands to a relative IRI resolved against the record URL, and
// the mapping then publishes a predicate in the TextRefs namespace that means
// nothing. The schema enum and the context have to stay in step.
test('every relation the schema allows expands to an absolute IRI', async () => {
	for (const relation of MappingAssertion.shape.relation.options) {
		const mapping = structuredClone(fixtureRegistry.mappings[0]);
		mapping.relation = relation;
		const node = await expand(mapping);
		const predicate = (node[`${RDF}predicate`] as { '@id': string }[])[0]?.[
			'@id'
		];
		assert.match(
			predicate ?? '',
			/^https?:\/\//,
			`relation "${relation}" has no term in the v1 context`,
		);
	}
});

test('Work projections still expand as direct mapping relations', async () => {
	const work = fixtureRegistry.works[0];
	const node = await expand(work);

	assert.deepEqual(node[`${PROV}alternateOf`], [
		{ '@id': work.alternateOf?.[0] },
	]);
	assert.deepEqual(node[`${DCTERMS}isReferencedBy`], [
		{ '@id': work.isReferencedBy?.[0] },
	]);
});

test('generic identifiers and scheme-specific locators reuse established terms', async () => {
	const work = fixtureRegistry.works[0];
	const expandedWork = await expand(work);
	assert.deepEqual(expandedWork[`${DCTERMS}identifier`], [
		{ '@value': work.key },
	]);

	const reference = fixtureRegistry.references[0];
	const expandedReference = await expand(reference);
	assert.deepEqual(expandedReference[`${SKOS}notation`], [
		{ '@value': reference.locator },
	]);
});

test('the ontology defines every TextRefs term retained by the context', () => {
	const retainedTerms = new Set<string>();
	// Scoped contexts can carry `tr:` terms too, so the scan follows them.
	function collect(scope: Record<string, unknown>): void {
		for (const definition of Object.values(scope)) {
			if (typeof definition === 'string') {
				if (definition.startsWith('tr:'))
					retainedTerms.add(definition.slice('tr:'.length));
				continue;
			}
			if (!definition || typeof definition !== 'object') continue;
			const { '@id': id, '@context': scoped } = definition as {
				'@id'?: unknown;
				'@context'?: unknown;
			};
			if (typeof id === 'string' && id.startsWith('tr:'))
				retainedTerms.add(id.slice('tr:'.length));
			if (scoped && typeof scoped === 'object')
				collect(scoped as Record<string, unknown>);
		}
	}
	collect(context);

	assert.deepEqual(
		[...retainedTerms].sort(),
		ONTOLOGY_TERMS.map((term) => term.localName).sort(),
	);
});

test('every ontology term is typed in the default graph', async () => {
	// The point of the document is that a consumer can parse it into one graph
	// and see the vocabulary. Asserting the expanded shape would not catch a
	// named graph, which is where an `@id` beside `@graph` would put the terms.
	const quads = (await jsonld.toRDF(
		ontologyJsonLd() as unknown as JsonLdDocument,
		{ format: 'application/n-quads' },
	)) as unknown as string;
	// A quad in a named graph would carry the graph IRI as a fourth term, so a
	// line that ends right after the object proves the triple is in the default
	// graph.
	for (const term of ONTOLOGY_TERMS) {
		assert.ok(
			quads.includes(
				`<${ONTOLOGY_NAMESPACE}${term.localName}> <${RDF}type> <${OWL}${term.kind}> .\n`,
			),
			`${term.localName} is not typed in the default graph`,
		);
	}
	assert.ok(
		quads.includes(`<${ONTOLOGY_IRI}> <${RDF}type> <${OWL}Ontology> .\n`),
	);
});

test('the ontology version matches the package version', () => {
	const pkg = JSON.parse(
		readFileSync(join(projectRoot, 'package.json'), 'utf8'),
	) as { version: string };
	assert.equal(ONTOLOGY_VERSION, pkg.version);
});
