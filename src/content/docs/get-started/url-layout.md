---
title: URL layout
description: How /id/, /reg/, /cite/, and /api/ fit together on textrefs.org.
sidebar:
  order: 7
---

TextRefs uses four URL prefixes, each with one job. Together they make every registry record citeable, browsable, machine-readable, and short-linkable.

| Prefix   | Role           | What lives there                                                                                                                                                                                                                                      |
| -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/id/`   | **Identifier** | The canonical, persistent URL of every record. Each record is published twice: `/id/.../` (HTML) and a sibling `/id/....json` (JSON-LD).                                                                                                              |
| `/reg/`  | **Browse**     | The human registry browser: filter works and citation systems, then browse paginated reference lists from work pages. Links into `/id/`.                                                                                                              |
| `/cite/` | **Cite**       | Short, memorable URLs (`/cite/{work}/{system}/{locator}` always, and bare `/cite/{work}/{locator}` for the work's preferred system) that redirect to the canonical `/id/` URL. Convenience only. Bare aliases MAY be retargeted. `/id/` is permanent. |
| `/api/`  | **API docs**   | The OpenAPI document that describes the `/id/` URL contract, plus the JSON-LD `@context` at `/contexts/`.                                                                                                                                             |

In one line:

> **`/id/` is the registry. `/reg/` browses it. `/cite/` shortcuts to it. `/api/` documents it.**

## One record, four URLs

Plato's _Republic_ 514a — the Stephanus passage where Socrates begins the Allegory of the Cave — is one canonical reference. Here is what each prefix gives you for it:

- **Canonical identifier** — the URL you cite, link from a paper, or paste into a tool:
  - `https://textrefs.org/id/ref/dc799d4b-9b17-5d76-85aa-dfd001c5321d/` (HTML for browsers)
  - `https://textrefs.org/id/ref/dc799d4b-9b17-5d76-85aa-dfd001c5321d.json` (JSON-LD for machines)
- **Browseable index** — the registry's human entry point, where readers find works, citation systems, and (via the work page) every reference:
  - `https://textrefs.org/reg/`
- **Short alias** — a memorable, hand-typeable shortcut that redirects to the canonical URL. Every reference has a qualified alias. The bare form exists only for the work's preferred citation system:
  - `https://textrefs.org/cite/plato.republic/stephanus/514a` (qualified — always minted)
  - `https://textrefs.org/cite/plato.republic/514a` (bare — minted because Stephanus is Republic's preferred system)
- **Machine contract** — the OpenAPI that describes how `/id/` behaves, so a client knows it can append `.json` to any canonical URL:
  - `https://textrefs.org/api/`

## How machine clients discover the JSON

There is no `Accept`-header content negotiation. Every HTML record page advertises its JSON-LD sibling in the document head:

```html
<link
  rel="alternate"
  type="application/ld+json"
  href="/id/ref/dc799d4b-….json"
/>
```

A client either reads that `<link>` tag, or appends `.json` to the canonical URL. The JSON payload carries the JSON-LD `@context` at [`/contexts/v1.jsonld`](/contexts/v1.jsonld) and is valid JSON-LD by content.

This mirrors how arxiv.org publishes each paper at `/abs/{id}` and `/pdf/{id}` — two static URLs, two representations, no negotiation needed.

## Why four prefixes, not one

Persistent-identifier systems separate concerns. DOI and ORCID each have a canonical resolver URL that _is_ the API. Their documentation lives at a stable but distinct path. W3ID and PURL add short-alias redirects on top. TextRefs follows the same pattern:

- The identifier (`/id/`) is the contract. It must be persistent and stable across editions, providers, and resolver implementations.
- The browser (`/reg/`) is the discovery surface. It can change shape and add features, and citations do not break.
- The alias (`/cite/`) is convenience. Short URLs resolve back to the canonical identifier via `<link rel="canonical">`. The qualified form (`/cite/{work}/{system}/{locator}`) exists for every reference. The bare form (`/cite/{work}/{locator}`) exists only for a work's preferred system and MAY be retargeted if that preference changes. `/id/` is never retargeted.
- The docs (`/api/`) describe the contract for anyone who integrates against `/id/`.

If you only remember one thing: **cite the `/id/` URL, browse from `/reg/`, share the `/cite/` shortcut, and read `/api/` to integrate.**
