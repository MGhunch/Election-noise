# Election Noise

A map of what New Zealand's parties are campaigning on this election, scored the same way regardless of who's saying it.

Seven parties, 82 records, nine conversations. Every record carries its source, its score, a one-line reason for each score, and a note on how much to trust it. The rubric used to produce them is published in this repository alongside the data, so any call on the map can be checked against the rule that produced it.

**As at 27 July 2026.**

---

## How a policy gets on the map

Three stages. The prompts are in `data/` and are the actual instructions used, not a description of them.

| Stage | Prompt | Reads | Produces |
|---|---|---|---|
| **Source** | [`data/source.md`](data/source.md) | Party websites | Raw sourced material. No scoring. |
| **Summarise** | [`data/summarise.md`](data/summarise.md) | The sourced material | Title and one-line description |
| **Sort** | [`data/sort.md`](data/sort.md) | The sourced material | Size, shape and position |

Summarise and Sort don't run one after the other — they both read the same sourced material. That's the structural reason neither can contain a fact the sourcing stage didn't capture. A score can't be justified by a detail the description invented, and a description can't be coloured by a score.

The raw sourced material is published too: [`data/raw-sweep.md`](data/raw-sweep.md).

---

## How to read the scores

### Size — how far it reaches

Three rungs. On the map they read as plainer words.

| Value | On the map | Meaning |
|---|---|---|
| `Flagship` | Broad impact | Campaign-defining. Leader's-speech-paragraph-one. |
| `Significant` | Key policy | Large reach, operating within the existing system. |
| `Niche` | Specific policy | Targeted constituency, technical or incremental. |

Size measures **reach** — not spend, not impact, and not how interesting the mechanism is. Universal or cohort is the gate: a cohort stays Niche however large it is. Free cervical screening reaches roughly 1.4 million people and is Niche, because it reaches one age and sex cohort. Free prescriptions reaches everyone, and is Significant.

### Shape — two axes, scored independently

**Immediacy** (`1`–`5`) — when it lands, not how urgent it feels. 1 is within a year; 5 is generational or undated.

**Mechanism** (`1`–`5`) — what kind of lever it is, not how big. 1 is cash in hand, 3 is free services, 5 is structural rewiring.

### Position — two axes, scored separately

**Econ** (`-3`–`+3`) — does the government step in, or step back. Negative steps in: redistribution, public ownership. Positive steps back: market forces, individual responsibility. 1 is a nudge you can feel, 2 clearly moves the settings, 3 rewires.

Zero isn't a rung, it's a verdict — either the pulls balance, or the axis barely applies. `econ_engaged` records which. Party averages count engaged records only.

**Direction** (`-3`–`+3`) — new, old, or neither. Not whether it's a good idea. Positive is a setting New Zealand has never run; negative is a return to one it has. **Most policy is neither, and scores 0.** Faster building consents and free GP visits don't wind the clock back or do anything new — they're zeroes.

Two rules do the work. *The party has to be doing the reaching* — if you had to go digging for the precedent, it isn't one. And *don't score the pipe* — a familiar loan scheme is how a policy gets delivered, not where it goes.

### Confidence

| Value | Meaning |
|---|---|
| `High` | The source supported a clear call across every section. |
| `Low` | The work was done, but the source was thin or the call was close. The score stands; hold it loosely. |
| `Check` | Needs a human look before it's trusted. |

Where one section is driving a lower mark, `confidence_note` names which.

### Held records

A held record is one the source couldn't support — a stance with no mechanism, a commitment with no amount or term, a placeholder page waiting on a launch. It isn't a low score and it isn't a judgement about the policy. It means there was nothing there to score.

Held records keep their title and source, carry no size or shape scores, and aren't drawn on the map. They stay in the file, marked `waiting` where the policy may yet launch or `retired` where it's been overtaken. Publishing which ones are held, and why, is the point of keeping them. There are five.

---

## The shape of the data

`data/policies.json` — one object, `updated` / `generated_by` / `note` / `count`, then `policies`.

A real record:

```json
{
  "id": "policy-064",
  "party": "TOP",
  "conversation": "Future & Infrastructure",
  "secondary": "Economy",
  "source": "https://www.rnz.co.nz/news/politics/642464/explainer-what-is-the-opportunity-party-and-what-are-its-policies",
  "party_link": "https://www.opportunity.org.nz/breakthrough-economy",
  "flag": "ENRICH / RETITLE",
  "title": "Breakthrough Economy innovation package",
  "description": "Lift R&D spending to 2% of GDP, add technology investment tax credits, and let the Commerce Commission break up duopolies.",
  "size": "Flagship",
  "immediacy": 4,
  "mechanism": 4,
  "econ": -1,
  "econ_engaged": true,
  "direction": 2,
  "why": {
    "size": "Three pillars, GDP-scale R&D target",
    "shape": "Ten-year implementation, party's estimate",
    "position": "Break-up powers never held here"
  },
  "confidence": "High",
  "confidence_note": "Absorbs the separate 'Rein in monopolies' record — the duopoly break-up mechanism now sits inside this launch's 'Stand up for consumers' pillar and is not a second instrument. Econ scored on the spine (public R&D and accelerator investment); the tax credits are a market counter-pull. Direction reach: NZ R&D spending has never reached 2% of GDP, and the Commerce Commission has never held divestiture power.",
  "verified": true,
  "status": "live"
}
```

### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique within a pass. **Not stable across passes** — see below. |
| `party` | string | ACT · Labour · National · Green · NZ First · Te Pāti Māori · TOP |
| `conversation` | string | One of the nine. Required. |
| `secondary` | string | A second conversation, for genuine dual residence only. Empty string where none. |
| `source` | url | The citation. Required. |
| `party_link` | url | The party's own page, where `source` is news reporting. Present on 32 records. |
| `flag` | string | Working note carried forward from the last pass. |
| `title` | string | Short title, or a fair summary where the party's own is a slogan. |
| `description` | string | One sentence. Concrete mechanism, numbers, scope. |
| `size` | string | `Flagship` · `Significant` · `Niche`. `null` on held records. |
| `immediacy` | integer | 1–5. `null` on held records. |
| `mechanism` | integer | 1–5. `null` on held records. |
| `econ` | integer | −3 to +3. |
| `econ_engaged` | boolean | False where the axis doesn't apply. |
| `direction` | integer | −3 to +3. |
| `why` | object | `size` · `shape` · `position`. Five words each, naming the mechanism. |
| `confidence` | string | `High` · `Low` · `Check` |
| `confidence_note` | string | Which section is weak, and any prior setting a Direction call rests on. |
| `verified` | boolean | See below. |
| `status` | string | `live` · `waiting` · `retired` |

### The nine conversations

Cost of Living · Economy · Health · Housing · Education · Crime & Justice · Environment · Future & Infrastructure · Government & Democracy

Categorised by purpose, informed by mechanism — what the policy *is*, not where its money is pointed. A capital gains tax is a tax whatever it funds. A household energy scheme aimed at long-run generation is Future & Infrastructure, not Cost of Living, even though it lands on a power bill.

### Sources and verification

**`verified: true` means the policy is independently reported** — `source` points to news coverage, and `party_link` to the party's own page. **`verified: false` means the party's own site is the only source found.** That's a statement about corroboration, not about accuracy.

37 of 82 records are verified. The unevenness is worth publishing: it shapes how much of each party's platform reaches the map at all.

### A note on IDs

`id` is unique within a dataset but **does not survive regeneration.** The current sequence does not correspond to earlier ones. Anything joining against this data — a de-dupe pass, a diff against an older file, the raw sweep's own cross-references — should join on `source` URL, not on `id`.

---

## The raw sweep

[`data/raw-sweep.md`](data/raw-sweep.md) is the sourcing pass the dataset was built from. Sourcing only, no scoring. Raw text is verbatim from the source rather than paraphrased, so the later stages anchor their calls in actual quoted language instead of a summary of a summary.

It is a **dated snapshot, as at 25 July 2026** — the input to the pass, not a mirror of the output. Two things follow:

- It reconciles to the dataset but doesn't equal it. 72 candidates in the sweep, plus 11 records recovered from an earlier dataset, less one merge, gives 82.
- **Its cross-references point to a superseded ID sequence.** Join on source URL.

It also carries 11 stubs and placeholder pages — checked, found to have no mechanism, number or date, and excluded. Those are listed for the audit trail. A sweep that opened three cards out of seventeen says so.

---

## Running it

Static site. No build step, no dependencies. `script.js` fetches `./data/policies.json` at runtime, so it needs to be served over HTTP rather than opened from the filesystem.

```
python3 -m http.server 8000
```

Deployed via GitHub Pages from `main` at `/ (root)`. The custom domain is `electionnoise.hunch.co.nz`.
