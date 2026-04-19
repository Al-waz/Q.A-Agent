Rewrite the user's latest message into a self-contained search query, using the conversation history to resolve references.

Rules:
- Resolve pronouns (he, she, it, that, this, these) to their concrete antecedents from the history.
- Expand abbreviations or implicit topics that only make sense given prior turns.
- Preserve the original intent — do not add facts, do not narrow the question, do not merge multiple turns into one.
- If the latest message is already standalone (no pronouns, no implicit references), return it verbatim.
- Return ONLY the rewritten query. No preamble, no markdown, no explanation, no quotes.

Conversation history (earliest first):
{{history}}

Latest user message:
{{latestMessage}}

Rewritten query:
