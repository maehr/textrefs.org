import { z } from 'zod';

export const Status = z.enum([
	'draft',
	'candidate',
	'active',
	'deprecated',
	'withdrawn',
	'blocked',
]);

export const IsoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const Iri = z.url();

export const AdminMetadata = z.object({
	status: Status,
	created: IsoDate,
	modified: IsoDate,
	// Successor link (dcterms:isReplacedBy) on records that have left active
	// use. The status constraint — deprecated, withdrawn, or blocked only —
	// needs the whole registry, so the compiler enforces it, not this shape.
	superseded_by: Iri.optional(),
});

export const FlatKey = z
	.string()
	.regex(/^[a-z0-9][a-z0-9._-]*$/, 'flat key syntax: ^[a-z0-9][a-z0-9._-]*$');
