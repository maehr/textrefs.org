// ADR-0003 (as amended by ADR-0004) says draft record pages are rendered
// `noindex`, excluded from search, and excluded from the sitemap. The first two
// ship in the record templates; this module supplies the third.
//
// The predicate is derived from record status rather than from a route prefix,
// so it narrows on its own as records are promoted to `active` — the alternative
// (excluding `/id/` wholesale) would keep hiding pages that had earned a place
// in the sitemap.
import {
	loadWorks,
	loadSystems,
	loadReferences,
	loadMappings,
	loadAliases,
	iriToLocal,
	workKeyOf,
} from './registry.js';

function isDraft(record: { status: string }): boolean {
	return record.status === 'draft';
}

/**
 * The IRIs of every record still at `draft`.
 *
 * Shared with `/cite/`, whose alias pages carry no status of their own: an
 * alias is `draft` exactly when the record it redirects to is.
 */
export function draftRecordIris(): Set<string> {
	const iris = new Set<string>();
	for (const record of [
		...loadWorks(),
		...loadSystems(),
		...loadReferences(),
		...loadMappings(),
	]) {
		if (isDraft(record)) iris.add(record.id);
	}
	return iris;
}

/**
 * A predicate over pathnames that is true for pages rendered `noindex`.
 *
 * Built once and reused: the record set is large (one path per reference), so
 * membership is an exact `Set` lookup. Paginated reference browsers live under
 * `/reg/work/{key}/refs/{n}/` and follow their work's status, which is a prefix
 * test over the handful of works rather than an enumeration of page numbers.
 */
export function buildNoindexPredicate(): (pathname: string) => boolean {
	const draftIris = draftRecordIris();
	const paths = new Set<string>();
	for (const iri of draftIris) paths.add(iriToLocal(iri));

	// A `/cite/` alias renders one redirect page per alias, so a draft record
	// reaches the sitemap through its aliases as well as through its own page.
	// An alias holding an external IRI renders no page and needs no entry.
	for (const [alias, target] of Object.entries(loadAliases())) {
		if (alias.includes('://')) continue;
		if (draftIris.has(target)) paths.add(`/cite/${alias}/`);
	}

	const draftWorkPrefixes = loadWorks()
		.filter(isDraft)
		.map((work) => `/reg/work/${workKeyOf(work.id)}/`);

	return (pathname) =>
		paths.has(pathname) ||
		draftWorkPrefixes.some((prefix) => pathname.startsWith(prefix));
}
