---
title: Citation-system profiles
description: How citation systems constrain locators, with the seed Bekker and Stephanus profiles.
maturity: working-draft
sidebar:
  order: 4
---

Citation-system profiles constrain locator syntax through regular expressions and, where needed, additional documented validation rules. A pull request that adds or changes a citation system MUST include the full profile record.

## Required profile fields

- `id`: persistent system URI.
- `key`: flat stable key used for deterministic UUID seeds.
- `type`: `CitationSystem`.
- `preferred_label`: human-readable label.
- `description`: prose description of the citation tradition and its canonical locator form.
- `locator_regex`: ECMAScript regular expression for machine-checkable locator pre-validation.

See [Specification §7](/standard/specification/#7-citationsystem) for the full normative field list.

## Canonical locator form

Every profile defines exactly one canonical spelling for each reference point. Profiles MUST follow the flat key and locator Unicode rules in [Identifier syntax](/standard/identifier-syntax/). A profile MAY add stricter locator rules for case, digits, punctuation, whitespace, allowed scripts, or non-regex-checkable constraints. Regex-checkable constraints — including canonical ASCII digit forms (leading zeros) and letter case — SHOULD be encoded in `locator_regex`; other constraints MUST be documented in `description`. The machine-actionable contract is the flat key and `locator_regex`.

Because the canonical locator seeds the deterministic reference UUID, alternative spellings of the same reference point (`John.3.16` vs `john.3.16`, `514a1` vs `514a01`) would mint distinct permanent identities. Validators MUST reject non-canonical spellings; they MUST NOT fold them into the canonical form. The enumerated reference data in the registry is the authority on which locators are canonical and attested; `locator_regex` is the machine-checkable floor beneath it.

## Seed profiles

Bekker profile (Aristotelian corpus). Implements **Bekker numbering**, the page-and-column-and-line citation introduced by August Immanuel Bekker's 1831 edition and used as the standard reference scheme for Aristotle:

```json
{
  "key": "bekker",
  "description": "Bekker numbering: page, column (a or b), and line, after August Immanuel Bekker's 1831 Berlin edition. Pages span the whole corpus, roughly 1–1462.",
  "locator_regex": "^[0-9]{3,4}[ab][0-9]{1,2}$"
}
```

Stephanus profile (Platonic corpus). Implements **Stephanus pagination**, the page-and-section citation from Henri Estienne's 1578 edition and used as the standard reference scheme for Plato:

```json
{
  "key": "stephanus",
  "description": "Stephanus pagination: page, section (a–e), and optional sub-line, after Henri Estienne's 1578 edition of Plato's works.",
  "locator_regex": "^[0-9]{1,4}[a-e](?:[0-9]{1,2})?$"
}
```

## Validation rule

Every `CanonicalReference` MUST point to a known `CitationSystem`. Its `locator` MUST be the profile's canonical spelling and MUST match that system's `locator_regex` (see [Specification §8](/standard/specification/#8-canonicalreference)). Regex success is necessary but not sufficient: a usable TextRefs reference must resolve to a registered `CanonicalReference` and satisfy any additional profile validation rules.
