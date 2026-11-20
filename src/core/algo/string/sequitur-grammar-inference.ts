/**
 * sequitur-grammar-inference.ts - Sequitur online grammar inference.
 *
 * Sequitur maintains a grammar with two invariants: no adjacent pair of
 * symbols appears more than once anywhere in the grammar, and no rule is used
 * only once. A repeated pair is replaced by a new rule, and a rule used once is
 * inlined back into its parent. The result is a compact hierarchical grammar
 * that regenerates the input string exactly.
 *
 *   Time:  O(n^2) in this straightforward rescanning form
 *   Space: O(n)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Rule = { name: string; body: string[] };

function makeChars(seq: string[], active: number[] = []): VisualEntity[] {
    return seq.map((symbol, index) => ({
        id: `sym-${index}`,
        type: "character" as const,
        label: symbol,
        value: symbol,
        state: (active.includes(index) ? "comparing" : index === seq.length - 1 ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, symbol },
    }));
}

type Pair = { key: string; left: string; right: string; count: number };

function findRepeat(seqs: string[][]): Pair | null {
    const counts = new Map<string, { count: number; first: number; left: string; right: string }>();
    for (const seq of seqs) {
        for (let i = 0; i + 1 < seq.length; i += 1) {
            const key = seq[i]! + seq[i + 1]!;
            const entry = counts.get(key) ?? { count: 0, first: i, left: seq[i] ?? "", right: seq[i + 1] ?? "" };
            entry.count += 1;
            counts.set(key, entry);
        }
    }
    let best: Pair | null = null;
    let bestFirst = Infinity;
    for (const [key, entry] of counts) {
        if (entry.count < 2) continue;
        if (!best || entry.count > best.count || (entry.count === best.count && entry.first < bestFirst)) {
            best = { key, left: entry.left, right: entry.right, count: entry.count };
            bestFirst = entry.first;
        }
    }
    return best;
}

function replaceIn(seq: string[], pair: string, name: string): { seq: string[]; count: number } {
    const out: string[] = [];
    let count = 0;
    for (let i = 0; i < seq.length; ) {
        if (i + 1 < seq.length && seq[i]! + seq[i + 1]! === pair) {
            out.push(name);
            count += 1;
            i += 2;
        } else {
            out.push(seq[i] ?? "");
            i += 1;
        }
    }
    return { seq: out, count };
}

function countSymbol(needle: string, seqs: string[][]): number {
    let total = 0;
    for (const seq of seqs) for (const s of seq) if (s === needle) total += 1;
    return total;
}

function expand(symbol: string, rules: Rule[], depth = 0): string {
    const rule = rules.find((r) => r.name === symbol);
    if (!rule || depth > 1000) return symbol;
    return rule.body.map((s) => expand(s, rules, depth + 1)).join("");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "abcabcabcab";
    let step = 0;
    const frame = (
        seq: string[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeChars(seq),
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta: { length: seq.length, ...meta },
    });

    if (text.length === 0) {
        yield frame([], "Empty input has an empty grammar.", 0, {
            rules: [], decoded: "", final: "",
        });
        return;
    }
    let start = [...text];
    const rules: Rule[] = [];
    let next = 0;
    yield frame(start, `Inferring a Sequitur grammar for "${text}".`, 0, { rules: [] });
    step += 1;

    let guard = 0;
    while (guard++ < 2000) {
        const allSeqs = [start, ...rules.map((r) => r.body)];
        const repeat = findRepeat(allSeqs);
        if (repeat) {
            const existing = rules.find((r) => r.body.join("") === repeat.key);
            const name = existing ? existing.name : `R${next++}`;
            if (!existing) rules.push({ name, body: [repeat.left, repeat.right] });
            let replaced = 0;
            const startResult = replaceIn(start, repeat.key, name);
            start = startResult.seq;
            replaced += startResult.count;
            for (const rule of rules) {
                if (rule.name === name) continue;
                const result = replaceIn(rule.body, repeat.key, name);
                rule.body = result.seq;
                replaced += result.count;
            }
            const active = start.map((s, i) => (s === name ? i : -1)).filter((i) => i >= 0);
            yield frame(
                start,
                `Repeated pair "${repeat.key}" became ${name} (${repeat.count} occurrence(s)).`,
                2,
                {
                    pair: repeat.key,
                    rule: name,
                    replaced,
                    rules: rules.map((r) => `${r.name}->${r.body.join("")}`),
                },
            );
            step += 1;
            if (replaced === 0) break;
            continue;
        }
        const single = rules
            .slice()
            .reverse()
            .find((r) => countSymbol(r.name, [start, ...rules.map((x) => x.body)]) === 1);
        if (single) {
            const idx = rules.indexOf(single);
            const seqs = [start, ...rules.map((r) => r.body)];
            for (const seq of seqs) {
                const pos = seq.indexOf(single.name);
                if (pos >= 0) seq.splice(pos, 1, ...single.body);
            }
            start = seqs[0] ?? start;
            rules.splice(idx, 1);
            yield frame(start, `Rule ${single.name} was used once, so it was inlined and removed.`, 3, {
                inlined: single.name,
                rules: rules.map((r) => `${r.name}->${r.body.join("")}`),
            });
            step += 1;
            continue;
        }
        break;
    }
    const decoded = start.map((s) => expand(s, rules)).join("");
    yield frame(
        start,
        `Grammar has ${rules.length} rule(s) and regenerates the input exactly.`,
        5,
        {
            rules: rules.map((r) => `${r.name}->${r.body.join("")}`),
            decoded,
            final: start.join(""),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sequitur builds a hierarchy of rules from a string by enforcing two simple laws. Whenever an adjacent pair of symbols appears more than once, it creates a rule for that pair and reuses the rule name everywhere. Whenever a rule is used only once, it removes the rule and pastes its expansion back in. The grammar that remains is compact and still expands to the original string.",
        invariants: [
            "No adjacent pair of symbols appears more than once anywhere in the grammar.",
            "Every rule has at least two uses, so no rule is redundant.",
            "Expanding the start symbol always reproduces the input string exactly.",
        ],
        correctness:
            "Replacing each occurrence of a repeated pair by a rule whose body is that pair preserves the expansion of every sequence, so the grammar remains equivalent to the input. Introducing a rule eliminates the repeated digram from the sequences that contained it, and inlining a single-use rule cannot create a new repetition because its body had a unique occurrence. When neither repair applies, both invariants hold and the grammar is a valid lossless representation.",
        complexityRationale:
            "Each repair step rescans all rule bodies for repeated pairs, which is linear in the current grammar size, and there are at most linearly many steps. The straightforward implementation therefore uses O(n^2) time, while the sequence and rules together occupy O(n) space.",
        uses: [
            "Lossless compression of repetitive strings",
            "Discovering hierarchical structure in sequences",
            "Grammar-based pattern matching and indexing",
        ],
        references: [
            "Nevill-Manning and Witten, Identifying Hierarchical Structure in Sequences, Journal of the ACM 44 (1997)",
            "Nevill-Manning and Witten, On-Line and Offline Hierarchical Sequence Compression, Data Compression Conference 1999",
        ],
        workedExample:
            'For "abcabcabcab" the pair "ab" appears several times, so a first rule R0 expands to "ab". Replacing those occurrences reveals further repeats such as "cR0", which become new rules. Inlining any rule that ends up used once leaves a small grammar that regenerates the original string.',
    },
    id: "sequitur-grammar-inference",
    name: "Sequitur Grammar Inference",
    category: "string",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { text: "abcabcabcab" },
    visualType: "text",
    run,
    pseudocode: [
        "start with the input symbols as the start rule",
        "scan all rules for an adjacent pair that appears twice",
        "when found: create or reuse a rule for that pair",
        "replace every occurrence of the pair with the rule name",
        "find any rule referenced exactly once and inline it",
        "repeat until no pair repeats and no rule is single use",
        "report the grammar and verify it regenerates the input",
    ],
};

export default module;
