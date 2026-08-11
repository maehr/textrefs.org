# Implementation notes: ADR-0006 (issues #58 + #59)

> Working notes, not normative. The decision and its follow-up checklist live in
> `decisions/ADR-0006-mapping-relation-vocabulary.md`; this file only carries the
> ordering and verification steps that do not belong in an ADR. Delete once the
> implementation PR is merged.
>
> Branch `feat/mapping-relation-vocabulary`, stacked on `feat/preferred-citation-system`
> (PR [#63](https://github.com/textrefs/textrefs.org/pull/63)) @ `9110d05`. All line
> anchors are against that base.

## Decisions already settled

| Question              | Outcome                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| #58 Work ↔ entity     | `alternateOf` → `prov:alternateOf`                                             |
| #59 Work ↔ page about | `isReferencedBy` → `dcterms:isReferencedBy`                                    |
| `closeMatch`          | removed entirely; re-added additively once `subject` admits CitationSystems    |
| Spec version          | no bump — stays `v0.1.0-draft` per ADR-0004's `maturity: working-draft` clause |
| ADR number            | 0006 — 0005 is claimed by PR #63 and cited four times in ADR-0004              |

## Ordering

Code and docs land in this repo on `feat/mapping-relation-vocabulary`; the 24 record
edits land in `textrefs/registry` as a paired `data/` submodule PR. Both must merge
together — the compiler rejects an unknown relation, so a half-landed change fails
`build:data` either way round.

1. `scripts/source-schema.ts:73` + `standard/schema/mapping-assertion.ts:21` — the enum.
2. `standard/schema/work.ts:31-34` — projection fields and the SKOS comment.
3. `scripts/compile.ts:447-455,474-475` — enum-keyed accumulator replacing the two-way
   branch; leave `setAlias` at `:518` intact with a comment recording that this is
   deliberate (an `isReferencedBy` target stays a lookup alias).
4. `public/contexts/v1.jsonld` — `prov` namespace at `:2-7`, terms at `:40-47`.
5. `api/openapi.yaml:220-230,297`.
6. Prose sweep (full file list in the ADR's follow-up actions).
7. `src/lib/registry.fixture.ts:93` + `scripts/compile.test.ts`.
8. Paired `data/` PR: 12 Wikidata → `alternateOf`, 12 Wikipedia → `isReferencedBy`,
   bump each `modified`; rewrite `data/AGENTS.md:14,41`.

No UI change is needed: `src/pages/id/work/[key]/index.astro` renders `m.relation`
verbatim.

## Verification

1. `npm run build:data` — compiles `data/`, then `validate-data.ts` independently
   recomputes every mapping UUID from `[subject, relation, target.identifier]`
   (`scripts/validate-data.ts:71-75`). This is the real proof the re-mint landed
   consistently: it fails loudly if any record's UUID does not match its new relation.
2. `npm test` — the new mapping coverage in `compile.test.ts`.
3. `npm run verify` — format check, `astro check`, tests, full build.
4. Spot-check `/id/work/homer.odyssey/`: two relation tags, `alternateOf` and
   `isReferencedBy`. Then `/id/mapping/{uuid}/` for a reclassified mapping — it resolves
   at its **new** UUID and 404s at the old one. Expected, and precisely why this lands
   while every record is `draft`.
5. Round-trip one work record through a JSON-LD processor: `isReferencedBy` must expand
   to `http://purl.org/dc/terms/isReferencedBy` with an IRI node value, not a literal —
   the concrete rebuttal to the objection raised in #59.
6. `npm run check:links`.

## After #63 merges

Retarget the PR base from `feat/preferred-citation-system` to `staging`.
