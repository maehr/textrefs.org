import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsonld from 'jsonld';
import type { ContextDefinition, JsonLdDocument } from 'jsonld';

import { fixtureRegistry } from './registry.fixture.ts';
import {
	ONTOLOGY_IRI,
	ONTOLOGY_NAMESPACE,
	ONTOLOGY_TERMS,
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
	for (const definition of Object.values(context)) {
		const id =
			typeof definition === 'string'
				? definition
				: definition && typeof definition === 'object'
					? (definition as { '@id'?: unknown })['@id']
					: undefined;
		if (typeof id === 'string' && id.startsWith('tr:')) {
			retainedTerms.add(id.slice('tr:'.length));
		}
	}

	assert.deepEqual(
		[...retainedTerms].sort(),
		ONTOLOGY_TERMS.map((term) => term.localName).sort(),
	);
	assert.ok(
		ONTOLOGY_TERMS.every((term) =>
			`${ONTOLOGY_NAMESPACE}${term.localName}`.startsWith(ONTOLOGY_NAMESPACE),
		),
	);
});

test('the published ontology document is valid expandable JSON-LD', async () => {
	const nodes = await jsonld.expand(
		ontologyJsonLd() as unknown as JsonLdDocument,
		{},
	);
	assert.equal(nodes.length, 1);
	assert.equal(nodes[0]?.['@id'], ONTOLOGY_IRI);
	assert.equal(nodes[0]?.['@graph']?.length, ONTOLOGY_TERMS.length);
});
