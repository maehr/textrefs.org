// Runtime schemas for the registry's YAML *source* files (`data/works/*.yaml`,
// `data/systems/*.yaml`). These are compiler inputs, not published records, so
// they live here rather than in `standard/schema/`. The published shapes stay
// authoritative — see `standard/schema/` — but a typo in source YAML used to
// slip through an unchecked `as WorkSource` cast and surface much later, or not
// at all. Objects are strict: an unknown key is an authoring error.
import { z } from 'zod';
import { FlatKey, IsoDate, Status } from '../standard/schema/common.js';

export const ResolverEntrySource = z
	.strictObject({
		url: z.string().min(1).optional(),
		url_by: z.record(z.string(), z.record(z.string(), z.string())).optional(),
		provider: z.string().min(1).optional(),
		edition: z.string().min(1).optional(),
		language: z.string().min(2).optional(),
		access: z.enum(['open', 'paywalled', 'restricted', 'unknown']).optional(),
		license: z.string().min(1).optional(),
		license_url: z.string().min(1).optional(),
		last_checked: IsoDate.optional(),
	})
	.refine((r) => r.url !== undefined || r.url_by !== undefined, {
		message: 'resolver needs either url or url_by',
	});

export type ResolverEntrySource = z.infer<typeof ResolverEntrySource>;

export const ReferenceSource = z.union([
	z.string().min(1),
	z.strictObject({
		locator: z.string().min(1),
		extra_resolvers: z.array(ResolverEntrySource).optional(),
	}),
]);

export type ReferenceSource = z.infer<typeof ReferenceSource>;

const Counts = z.array(z.number().int().positive());
const PageRange = z.tuple([
	z.number().int().positive(),
	z.number().int().positive(),
]);

export const ReferenceRangeSource = z.discriminatedUnion('kind', [
	z.strictObject({
		kind: z.literal('integer'),
		from: z.number().int(),
		to: z.number().int(),
	}),
	z.strictObject({ kind: z.literal('book_line'), counts: Counts }),
	z.strictObject({ kind: z.literal('book_chapter'), counts: Counts }),
	z.strictObject({
		kind: z.literal('book_chapter_verse'),
		book: z.string().min(1),
		counts: Counts,
	}),
	z.strictObject({ kind: z.literal('chapter_verse'), counts: Counts }),
	z.strictObject({
		kind: z.literal('bekker'),
		page_ranges: z.array(PageRange),
		lines_per_column: z.number().int().positive(),
	}),
	z.strictObject({
		kind: z.literal('stephanus'),
		page_range: PageRange,
		sections: z.array(z.string().min(1)).optional(),
	}),
]);

export type ReferenceRangeSource = z.infer<typeof ReferenceRangeSource>;

export const MappingSource = z.strictObject({
	relation: z.enum(['exactMatch', 'closeMatch']),
	identifier: z.string().min(1),
	conforms_to: z
		.union([z.string().min(1), z.array(z.string().min(1))])
		.optional(),
	source: z.string().min(1),
	status: Status,
	created: IsoDate,
	modified: IsoDate,
});

export type MappingSource = z.infer<typeof MappingSource>;

export const CreatorSource = z.discriminatedUnion('kind', [
	z.strictObject({
		kind: z.literal('person'),
		family: z.string().min(1),
		given: z.string().min(1).optional(),
	}),
	z.strictObject({ kind: z.literal('literal'), name: z.string().min(1) }),
]);

export type CreatorSource = z.infer<typeof CreatorSource>;

// One citation system's worth of authoring: which system, what status its
// references carry, and the resolvers and locators scoped to it. Resolver URL
// templates belong to the block because their variables come from that
// system's `locator_regex` capture groups (ADR-0005).
const systemBlockFields = {
	citation_system: FlatKey,
	reference_status: Status.optional(),
	resolvers: z.array(ResolverEntrySource).optional(),
	references: z.array(ReferenceSource).optional(),
	references_range: z.array(ReferenceRangeSource).optional(),
};

export const AdditionalSystemSource = z.strictObject(systemBlockFields);

export type SystemBlockSource = z.infer<typeof AdditionalSystemSource>;

export const WorkSource = z
	.strictObject({
		work: z.strictObject({
			key: FlatKey,
			preferred_label: z.string().min(1),
			status: Status,
			created: IsoDate,
			modified: IsoDate,
			superseded_by: z.string().min(1).optional(),
			creators: z.array(CreatorSource).optional(),
		}),
		// The top-level block is the work's PREFERRED citation system: the one
		// whose references also get the bare `/cite/{work}/{locator}` alias.
		...systemBlockFields,
		mappings: z.array(MappingSource).optional(),
		// Fallback systems. Each is reviewed on its own and defaults to `draft`
		// references, so adding one never promotes data by inheritance.
		additional_systems: z.array(AdditionalSystemSource).optional(),
	})
	.superRefine((src, ctx) => {
		const seen = new Set<string>([src.citation_system]);
		(src.additional_systems ?? []).forEach((block, i) => {
			if (seen.has(block.citation_system)) {
				ctx.addIssue({
					code: 'custom',
					message: `citation system "${block.citation_system}" is declared more than once for this work`,
					path: ['additional_systems', i, 'citation_system'],
				});
			}
			seen.add(block.citation_system);
		});
	});

export type WorkSource = z.infer<typeof WorkSource>;

export const SystemSource = z.strictObject({
	key: FlatKey,
	preferred_label: z.string().min(1),
	description: z.string().min(1),
	locator_regex: z.string().min(1),
	status: Status,
	created: IsoDate,
	modified: IsoDate,
	superseded_by: z.string().min(1).optional(),
	// Per-chapter verse counts for chapter/verse systems. When present, the
	// compiler exposes a `verseGlobal` template variable (cumulative 1..N
	// across chapters) for resolvers whose anchors use a single running counter.
	chapter_sizes: z.array(z.number().int().positive()).optional(),
});

export type SystemSource = z.infer<typeof SystemSource>;

/** Parse one source file, reporting the file name and field path on failure. */
export function parseSource<T extends z.ZodType>(
	schema: T,
	raw: unknown,
	file: string,
): z.infer<T> {
	const parsed = schema.safeParse(raw);
	if (parsed.success) return parsed.data;
	console.error(`✗ ${file}: invalid source`);
	for (const issue of parsed.error.issues) {
		console.error(`    ${issue.path.join('.') || '(root)'}: ${issue.message}`);
	}
	throw new Error(`invalid source file: ${file}`);
}
