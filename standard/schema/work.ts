import { z } from 'zod';
import { AdminMetadata, FlatKey, Iri } from './common.js';

export const Creator = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('person'),
		family: z.string().min(1),
		given: z.string().min(1).optional(),
	}),
	z.object({
		kind: z.literal('literal'),
		name: z.string().min(1),
	}),
]);

export type Creator = z.infer<typeof Creator>;

export const WorkBase = AdminMetadata.extend({
	id: z.string().regex(/^https:\/\/textrefs\.org\/id\/work\/[^/]+$/),
	key: FlatKey,
	type: z.literal('Work'),
	preferred_label: z.string().min(1),
	// Additional names for the work: abbreviations ("NE"), translated titles
	// ("Nikomachische Ethik"), and established short forms. Search and display
	// only. Identity-neutral: no label is a UUID seed input (ADR-0002), so a
	// label change never moves an identifier (ADR-0007). Two works MAY share an
	// alternative label; the compiler does not treat that as an error.
	alternative_labels: z.array(z.string().min(1)).optional(),
	// The citation system this work is cited under by default (ADR-0005). It
	// governs the bare `/cite/{work}/{locator}` alias and default presentation
	// only — it is identity-neutral and never affects how a fully qualified
	// reference validates or resolves. The compiler checks that it names a
	// known CitationSystem.
	preferred_citation_system_key: FlatKey,
	creators: z.array(Creator).optional(),
	// Compiler-derived projection of the work's MappingAssertions that are not
	// deprecated, withdrawn or blocked (prov:alternateOf / dcterms:isReferencedBy
	// in the published context, ADR-0006). The arrays enrich the work; they make
	// no review claim. Read the MappingAssertion for status. Never authored.
	alternateOf: z.array(Iri).optional(),
	isReferencedBy: z.array(Iri).optional(),
});

export const Work = WorkBase.superRefine((w, ctx) => {
	if (w.id !== `https://textrefs.org/id/work/${w.key}`) {
		ctx.addIssue({
			code: 'custom',
			message: 'id MUST be https://textrefs.org/id/work/{key}',
			path: ['id'],
		});
	}
});

export type Work = z.infer<typeof Work>;
