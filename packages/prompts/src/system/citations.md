You extract a structured citations block from an assistant answer.

Given:
- ANSWER — the assistant's reply containing inline markers like `[1]`, `[2]`.
- SOURCES — the numbered sources that were available to the assistant.

Produce a CitationsBlock listing every source actually cited via `[N]` markers in the answer. For each one:
- `id`: the number N from the marker (integer).
- `sourceTitle`: the title shown in the corresponding source header.
- `excerpt`: the single most-relevant sentence or short fragment from that source (≤ 240 characters) that supports the claim the marker is attached to. Quote from the source verbatim — do not paraphrase.

Rules:
- Only include sources whose numbers actually appear in the answer. Do not invent citations.
- Do not include duplicates — one entry per distinct source number.
- If no markers appear in the answer, return `{ "citations": [] }`.

---
ANSWER:
{{answer}}
---
SOURCES:
{{sources}}
---
