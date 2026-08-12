// The sitemap filter in `astro.config.mjs` is the third leg of ADR-0003's
// "noindex, excluded from sitemap and search" rule. It runs against the fixture
// registry here, which carries both `active` and `draft` records — the real
// registry is entirely `draft` under ADR-0004, so it cannot show that the
// predicate discriminates rather than excluding everything under `/id/`.
process.env.TEXTREFS_REGISTRY_FIXTURE = '1';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNoindexPredicate } from './noindex.js';

const isNoindex = buildNoindexPredicate();

test('draft record pages are excluded', () => {
	assert.equal(isNoindex('/id/system/fixture-alternate/'), true);
	assert.equal(
		isNoindex('/id/ref/00000000-0000-5000-8000-000000000003/'),
		true,
	);
});

test('active record pages are kept', () => {
	assert.equal(isNoindex('/id/work/fixture.work/'), false);
	assert.equal(isNoindex('/id/system/fixture-section/'), false);
	assert.equal(
		isNoindex('/id/ref/00000000-0000-5000-8000-000000000001/'),
		false,
	);
});

test('documentation pages are kept', () => {
	assert.equal(isNoindex('/'), false);
	assert.equal(isNoindex('/standard/specification/'), false);
	assert.equal(isNoindex('/reg/'), false);
});

test('paginated reference browsers follow their work', () => {
	// fixture.work is active, so its browser pages stay in the sitemap.
	assert.equal(isNoindex('/reg/work/fixture.work/refs/1/'), false);
});
