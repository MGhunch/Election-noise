# Pair

**Reads:** the scored records · **Produces:** proposed pairs

Find the places where two or more parties are working on the same problem. No rescoring happens here. A pair is a claim about a set of records, never a reason to change any of them.

Source, Sort and Summarise all run off the sourced material. This stage runs off their output — it can only see what has already been scored, and it can only say what the scores already support.

---

## The rule

**One problem. Two or more attempts at it.**

That is the whole test. Not a shared topic, not a shared statute, not a shared villain — a shared *problem*, with parties visibly trying to solve it.

Groceries cost too much is a problem. NZ First splits Foodstuffs into two co-operatives; TOP gives the Commerce Commission divestiture powers. Two attempts, one problem. That's a pair.

The Resource Management Act is not a problem. ACT wants property rights to allocate land use, National wants faster commercial consents, NZ First wants one site exempted, Te Pāti Māori wants Māori rights embedded in water decisions. Five parties, one statute, five unrelated problems. Not a pair, and not a cluster either — a big Act has a lot of surface area, and noticing that isn't a finding.

The problem has to be one both parties are answering. **Two parties disagreeing about whether something is a problem at all are not paired.** ACT ending co-governance and Te Pāti Māori restoring a Māori health authority are opposed views about whether the arrangement is the problem or the solution. That's an argument, not a shared attempt.

### What disqualifies

- **A shared topic.** Two health policies are not a pair. Two policies removing the cost of seeing a doctor are.
- **A shared statute.** See the RMA above. The Crimes Act, the Building Act and the Employment Relations Act will all attract unrelated amendments.
- **A shared villain.** Supermarkets attract several unrelated problems — grocery prices, food waste, planning consents. Villain in common, problem not in common.
- **A shared delivery channel.** Two policies running through the same existing loan scheme are not paired by the loan scheme. Same rule as *don't score the pipe* in Sort.
- **One party.** Two records from the same party on one problem is a splitting question for Sort.
- **Held records.** A record whose description reads "insufficient source detail" has nothing to pair on. Neither does anything at `waiting` or `retired` status.

---

## The two gates

A pair is a pair on every field. What changes between fields is **how it reads**, and that is decided by distance, not by judgement.

On each field, take the two axes and compare the records:

**Within two rungs on both axes — they stack.** Same problem, similar answers. Degrees of solution nudge things around, but both parties are working the same corner. This is a samesie.

**Beyond two rungs on either axis — they split.** Same problem, answers pulling apart. This is an opposite.

Two rungs on a five-point scale is about a quadrant. Inside it, the difference is one of degree. Outside it, the parties are making different arguments, and the picture should say so.

The gates are measured, not argued. If a call needs adjudicating, the thresholds are wrong, not the record.

### The same pair reads differently on different fields

This is the most useful thing the stage produces, and it must not be smoothed away.

ACT's performance pay for teachers and TOP's early childhood pay parity are both answers to *how do we keep good teachers*. On Shape they sit at the same coordinates — same timing, same kind of lever. They stack. On Position they are four rungs apart on the economic axis — the widest gap of any pair in the file. They split.

Both readings are true. The parties agree on the problem and on the shape of the intervention, and disagree completely about who pays and how. **Write the line for each field separately.** A pair carries one line per field it appears on, not one line keyed to a type.

---

## Three or more

Three parties on one problem get in. The gates apply the same way: records within two rungs of each other stack together, records beyond it split off.

*The dry-year problem — Green builds a publicly owned generator, NZ First splits the existing gentailers into generation and retail, TOP leaves the structure alone and pays for firming capacity. Three attempts, one problem, and TOP's page rejects NZ First's fix by name.*

Say how many positions there are, not how many parties. Three parties can hold two positions.

---

## The label

**One word, naming the problem.** KiwiSaver · Solar · Supermarkets · Transport · Gentailers · Emissions · Teachers · Doctors · Voting.

The label names the problem, never the topic. *Emissions*, not *Environment*. *Doctors*, not *Health*. A label that could head a policy category has drifted back into the taxonomy that was hiding the pair in the first place.

Where one word genuinely won't carry it, use two. Don't force a word that misleads to keep the rail tidy.

---

## The line

**One sentence per field, twenty-five words maximum.** Names the problem and what the parties are doing about it. Never a hedge, never either party's framing.

Three shapes, picked by what the gate returned on that field:

- **Stack** — *National and NZ First both want KiwiSaver made compulsory.*
- **Split** — *ACT and TOP both have a plan for agriculture in the emissions scheme. They're opposites.*
- **Three or more** — *Three parties have a fix for the dry-year problem. No two of them agree.*

Fill these from confirmed fields. Don't write around the data to make a sentence land.

---

## Confidence

**A pair is only as strong as its weakest record.** Two High records make a High pair. One Low record makes a Low pair, however obvious the match looks. Name which record is the weak one.

Some pairs are stronger than either record alone, because the records were scored as a deliberate like-for-like — the same instrument given the same rungs on purpose. Where that's true, say so. It's a fact about the calibration, not about the policies.

- **High** — the shared problem is explicit in every description.
- **Low** — the match rests on a reading of one or more records, or one record is thin.
- **Check** — needs a human look. Includes any pair whose records sit at different sizes.

That last case earns its own flag. A size mismatch inside a pair is either a real difference in reach or a calibration miss, and the pair is what surfaces it. Green's Drink Swim Fish and TOP's Healthy Oceans both protect 30% of the moana and both end bottom trawling, and they sit at different sizes. That's a question for Sort, raised by Pair.

---

## What this stage must never do

**Never count. Never rank. Never total a party's pairs.**

Record counts are uneven — the largest party file holds more than twice the smallest — and that unevenness is a fact about the sweep, not about the parties. A party appearing in eight pairs is not more consensus-minded than one appearing in three. It has more records.

Any output that ranks parties by pairing publishes a sourcing gap as a finding. Pairs are shown one at a time, on their own merits, or not at all.

---

## Output

Valid JSON, one object per pair:

```json
{
  "id": "",
  "label": "",
  "problem": "",
  "records": ["", ""],
  "shape": { "reads": "", "line": "" },
  "position": { "reads": "", "line": "" },
  "confidence": "",
  "confidence_note": "",
  "status": "waiting"
}
```

`problem` states the shared problem in a phrase. `reads` is `stack` or `split`, set by the gate on that field. `records` holds two ids, or more. `status` is always `waiting` on output — a pair goes live only once a human has confirmed it.

---

## Robot proposes, human disposes

Pairs are a proposal, the same as sizes and directions before them.

The failure mode here is the mirror of Sort's. Sizing went wrong by finding depth everywhere; pairing goes wrong by **finding resemblance everywhere**. Two policies about power prices look like a pair until you ask which problem each one is solving. The disqualifying rules above exist because a first pass proposed matches that shared a topic, a statute, a villain or a delivery channel and nothing else — and because the first version of this prompt gated on shared instrument, which let a five-party Resource Management Act cluster through while excluding the supermarket pair on the grounds that a shared villain wasn't enough.

Every proposed pair lands at `waiting` and is confirmed by hand before it appears. The confirmations and the rejections both get logged, for the same reason the size overrides do.
