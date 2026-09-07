// How a TextRefs IRI is spelled, in one place.
//
// The four record types put their key or their UUID after a fixed prefix, and
// that prefix was written out at ten call sites across `scripts/compile.ts`,
// `scripts/validate-data.ts` and `src/lib/find.ts` before this module existed.
// A prefix is not interesting enough to get wrong twice.
//
// This module MUST stay dependency-free. `src/lib/find.ts` ships to the browser
// inside the `/find/` bundle, so anything imported here travels with it; that
// is the same rule its own header states about `standard/schema/`, which pulls
// in Zod. Nothing below imports anything.
//
// The canonical form is fixed by the specification and by the `id` regexes in
// `standard/schema/`. Those regexes stay written out: a pattern is checked
// against a string, and deriving one from the other would make each half prove
// the other rather than prove the spelling.

export const BASE = 'https://textrefs.org';

/** `https://textrefs.org/id/work/{key}` */
export function workIri(key: string): string {
	return `${BASE}/id/work/${key}`;
}

/** `https://textrefs.org/id/system/{key}` */
export function systemIri(key: string): string {
	return `${BASE}/id/system/${key}`;
}

/** `https://textrefs.org/id/ref/{uuid}` */
export function refIri(uuid: string): string {
	return `${BASE}/id/ref/${uuid}`;
}

/** `https://textrefs.org/id/mapping/{uuid}` */
export function mappingIri(uuid: string): string {
	return `${BASE}/id/mapping/${uuid}`;
}
