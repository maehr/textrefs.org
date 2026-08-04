import type { CompiledRegistry } from '../../scripts/compile.js';

const fixtureWorkIri = 'https://textrefs.org/id/work/fixture.work';
const fixtureRefIri =
	'https://textrefs.org/id/ref/00000000-0000-5000-8000-000000000001';

export const fixtureRegistry: CompiledRegistry = {
	works: [
		{
			id: fixtureWorkIri,
			key: 'fixture.work',
			type: 'Work',
			preferred_label: 'Fixture Work',
			status: 'active',
			created: '2026-01-01',
			modified: '2026-01-01',
		},
	],
	systems: [
		{
			id: 'https://textrefs.org/id/system/fixture-section',
			key: 'fixture-section',
			type: 'CitationSystem',
			preferred_label: 'Fixture section',
			description: 'Single positive integer section number.',
			locator_regex: '^(?<section>\\d+)$',
			status: 'active',
			created: '2026-01-01',
			modified: '2026-01-01',
		},
	],
	references: [
		{
			id: fixtureRefIri,
			type: 'CanonicalReference',
			work_key: 'fixture.work',
			citation_system_key: 'fixture-section',
			locator: '1',
			resolver_targets: [
				{
					url: 'https://example.org/fixture-work/1',
					language: 'en',
					provider: 'Example',
					access: 'open',
				},
			],
			status: 'active',
			created: '2026-01-01',
			modified: '2026-01-01',
		},
	],
	mappings: [
		{
			id: 'https://textrefs.org/id/mapping/00000000-0000-5000-8000-000000000002',
			type: 'MappingAssertion',
			subject: fixtureWorkIri,
			relation: 'exactMatch',
			target: {
				identifier: 'https://example.org/fixture-work',
			},
			source: 'Local fixture for fast site validation.',
			status: 'active',
			created: '2026-01-01',
			modified: '2026-01-01',
		},
	],
	aliases: {
		'fixture/1': fixtureRefIri,
		'https://example.org/fixture-work': fixtureWorkIri,
	},
	warnings: 0,
};
