---
title: JSON-LD context
description: The JSON-LD context that maps TextRefs records to RDF vocabularies.
maturity: working-draft
sidebar:
  order: 5
---

TextRefs records are plain JSON that becomes linked data through a published JSON-LD context. The context maps TextRefs terms onto a small TextRefs ontology namespace (`tr:`) plus established vocabularies — SKOS for labels, schemes, and mapping relations, Dublin Core Terms for dates and provenance, schema.org for URLs and providers, and XSD for date typing.

The `v1` context is served at:

```text
https://textrefs.org/contexts/v1.jsonld
```

## Vocabularies

| Prefix    | Namespace                              | Used for                                                                   |
| --------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `tr`      | `https://textrefs.org/ontology#`       | TextRefs object types, keys, and TextRefs-specific metadata                |
| `skos`    | `http://www.w3.org/2004/02/skos/core#` | Labels, schemes (`inScheme`), and mapping relations                        |
| `dcterms` | `http://purl.org/dc/terms/`            | `created`, `modified`, `source`, `language`, `license`, `conformsTo`       |
| `schema`  | `https://schema.org/`                  | `url`, `provider`, `edition`, `creator`, `familyName`, `givenName`, `name` |
| `xsd`     | `http://www.w3.org/2001/XMLSchema#`    | `xsd:date` typing for `created` / `modified` / `last_checked`              |

## Mapping relations

The MVP mapping relations map directly onto SKOS:

- `exactMatch` → `skos:exactMatch`
- `closeMatch` → `skos:closeMatch`

Published `Work` records additionally carry direct `exactMatch` / `closeMatch` arrays derived from their accepted mapping assertions, so SKOS-aware consumers get real `skos:exactMatch` / `skos:closeMatch` edges from the work IRI to the mapped identifiers without dereferencing the reified `MappingAssertion` records.

Use `exactMatch` only when the mapped object identifies the same reference with sufficient precision. If there is uncertainty about segmentation, edition, translation, coverage, or locator alignment, use `closeMatch`. See [Specification §10](/standard/specification/#10-mappingassertion).

## The context document

```json
{
  "@context": {
    "tr": "https://textrefs.org/ontology#",
    "skos": "http://www.w3.org/2004/02/skos/core#",
    "dcterms": "http://purl.org/dc/terms/",
    "schema": "https://schema.org/",
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    "id": "@id",
    "type": "@type",
    "Work": "tr:Work",
    "CitationSystem": "tr:CitationSystem",
    "CanonicalReference": "tr:CanonicalReference",
    "MappingAssertion": "tr:MappingAssertion",
    "key": "tr:key",
    "preferred_label": "skos:prefLabel",
    "description": "dcterms:description",
    "creators": "schema:creator",
    "kind": "tr:creatorKind",
    "family": "schema:familyName",
    "given": "schema:givenName",
    "name": "schema:name",
    "inScheme": { "@id": "skos:inScheme", "@type": "@id" },
    "work_key": "tr:workKey",
    "citation_system_key": "tr:citationSystemKey",
    "locator": "tr:locator",
    "status": "tr:status",
    "source": "dcterms:source",
    "created": { "@id": "dcterms:created", "@type": "xsd:date" },
    "modified": { "@id": "dcterms:modified", "@type": "xsd:date" },
    "relation": "tr:relation",
    "exactMatch": { "@id": "skos:exactMatch", "@type": "@id" },
    "closeMatch": { "@id": "skos:closeMatch", "@type": "@id" },
    "subject": { "@id": "tr:subject", "@type": "@id" },
    "target": "tr:target",
    "identifier": { "@id": "tr:identifier", "@type": "@id" },
    "conforms_to": { "@id": "dcterms:conformsTo", "@type": "@id" },
    "resolver_targets": "tr:resolverTargets",
    "provider": "schema:provider",
    "url": { "@id": "schema:url", "@type": "@id" },
    "language": "dcterms:language",
    "edition": "schema:bookEdition",
    "access": "tr:access",
    "license": { "@id": "dcterms:license", "@type": "@id" },
    "license_url": { "@id": "dcterms:license", "@type": "@id" },
    "superseded_by": { "@id": "dcterms:isReplacedBy", "@type": "@id" },
    "last_checked": { "@id": "tr:lastChecked", "@type": "xsd:date" },
    "locator_regex": "tr:locatorRegex"
  }
}
```

`key`, `work_key`, and `citation_system_key` are plain strings in the core JSON format. Rich bibliographic and authority data — catalogue records, edition histories, subject classifications — belongs in external systems and is connected to TextRefs records through `MappingAssertion`s. The one in-record exception is the optional `Work.creators` array, which carries minimal authorship for citation rendering (see [Specification §6](/standard/specification/#6-work)). The `license` term carries the canonical SPDX licence IRI (`https://spdx.org/licenses/{id}`, derived from the authored SPDX identifier at compile time); `license_url` (optional fallback for non-SPDX terms) carries an IRI. Both map to an IRI-typed `dcterms:license`. `MappingAssertion.source` is a plain string in v0.1 — a structured **W3C PROV-O** mapping (`prov:wasDerivedFrom`) is reserved for a later context version.
