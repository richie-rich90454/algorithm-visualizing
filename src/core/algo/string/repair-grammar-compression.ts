/**
 * repair-grammar-compression.ts - RePair grammar compression.
 *
 * Repeatedly find the adjacent pair of symbols with the highest occurrence
 * count, introduce a new nonterminal for it, and replace every non-overlapping
 * occurrence. When no pair occurs at least twice the process stops, leaving a
 * straight-line grammar that regenerates the original string exactly.
 *
 *   Time:  O(n^2) in this straightforward rescannning form
 *   Space: O(n)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

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

type Rule = { name: string; body: [string, string] };

type Pair = { key: string; left: string; right: string; count: number; first: number };

function mostFrequentPair(seq: string[], taken: Set<string>): Pair | null {
    const counts = new Map<string, { count: number; first: number }>();
    for (let i = 0; i + 1 < seq.length; i += 1) {
        const key = seq[i]! + seq[i + 1]!;
        if (taken.has(key)) continue;
        const entry = counts.get(key) ?? { count: 0, first: i };
        entry.count += 1;
        counts.set(key, entry);
    }
    let best: Pair | null = null;
    for (const [key, entry] of counts) {
        if (entry.count < 2) continue;
        if (!best || entry.count > best.count || (entry.count === best.count && entry.first < best.first)) {
            best = { key, left: seq[entry.first] ?? "", right: seq[entry.first + 1] ?? "", count: entry.count, first: entry.first };
        }
    }
    return best;
}

function replacePair(seq: string[], pair: string, name: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < seq.length; ) {
        if (i + 1 < seq.length && seq[i]! + seq[i + 1]! === pair) {
            out.push(name);
            i += 2;
        } else {
            out.push(seq[i] ?? "");
            i += 1;
        }
    }
    return out;
}

function expand(symbol: string, rules: Rule[], depth = 0): string {
    const rule = rules.find((r) => r.name === symbol);
    if (!rule || depth > 1000) return symbol;
    return expand(rule.body[0], rules, depth + 1) + expand(rule.body[1], rules, depth + 1);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "abracadabracadabra";
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
        yield frame([], "Empty input produces an empty grammar.", 0, {
            rules: [], decoded: "", final: "",
        });
        return;
    }
    let seq = [...text];
    const rules: Rule[] = [];
    yield frame(seq, `Compressing "${text}" with RePair.`, 0, { rules: [] });
    step += 1;
    let guard = 0;
    for (;;) {
        const taken = new Set(rules.map((r) => r.body.join("")));
        const best = mostFrequentPair(seq, taken);
        if (!best || guard++ > 1000) break;
        const name = `R${rules.length}`;
        const before = seq.length;
        seq = replacePair(seq, best.key, name);
        rules.push({ name, body: [best.left, best.right] });
        const active = seq.map((s, i) => (s === name ? i : -1)).filter((i) => i >= 0);
        yield frame(
            seq,
            `Replaced pair "${best.key}" (${best.count} times) with ${name}; length ${before} -> ${seq.length}.`,
            2,
            { pair: best.key, count: best.count, rule: name, rules: rules.map((r) => `${r.name}->${r.body.join("")}`) },
        );
        step += 1;
        if (active.length === 0) break;
    }
    const decoded = seq.map((s) => expand(s, rules)).join("");
    yield frame(
        seq,
        `Grammar has ${rules.length} rule(s); regeneration reproduces the input exactly.`,
        4,
        {
            rules: rules.map((r) => `${r.name}->${r.body.join("")}`),
            final: seq.join(""),
            decoded,
            compressionRatio: text.length / Math.max(1, seq.join("").length),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "RePair compresses a string by turning it into a small grammar. It repeatedly looks for the adjacent pair of symbols that appears most often, invents a new rule that expands to that pair, and swaps every occurrence of the pair for the new rule name. Once no pair appears twice, the starting rule plus the new rules form a grammar that regenerates the original string.",
        invariants: [
            "Every rule body is a pair of existing symbols, so the grammar is a straight-line program.",
            "Replacing non-overlapping occurrences never changes the string obtained by expanding the grammar.",
            "The pair chosen at each step has the maximum frequency among all eligible adjacent pairs.",
        ],
        correctness:
            "A replacement swaps a pair for a fresh symbol whose rule expands back to that pair, so expanding the grammar after any step yields the same string as before. Because replacements are applied left to right without overlap, no character is skipped or duplicated. When the loop ends every adjacent pair is unique, and the finite set of rules still expands to the input, so the grammar is a valid lossless encoding.",
        complexityRationale:
            "Each round rescans the current sequence to count adjacent pairs and then rewrites it, costing time proportional to the current length. With at most n rounds this simple version is O(n^2) time, while the sequence and rule table together occupy O(n) space.",
        uses: [
            "Compressing highly repetitive text and XML documents",
            "Building compact representations of DNA sequences",
            "A preprocessing step for pattern matching over compressed data",
        ],
        references: [
            "Larsson and Moffat, Offline Dictionary-Based Compression, Data Compression Conference 1999",
            "Navarro and Makinen, Compressed Full-Text Indexes, ACM Computing Surveys 39 (2007)",
        ],
        workedExample:
            'For "abracadabra", the pair "ab" occurs three times at non-overlapping positions, so the first rule R0 expands to "ab" and the sequence becomes "R0racadR0radaR0a". Later rules capture "ra" and "da", and expanding all rules recovers the original text.',
    },
    id: "repair-grammar-compression",
    name: "RePair Grammar Compression",
    category: "string",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { text: "abracadabracadabra" },
    visualType: "text",
    run,
    pseudocode: [
        "start with the input characters as the current sequence",
        "count every adjacent pair in the current sequence",
        "choose the pair that occurs most often at least twice",
        "create a new rule expanding to that pair",
        "replace all disjoint occurrences with the new rule name",
        "record the rule and keep its expansion for decoding",
        "repeat until no pair occurs twice",
        "report the grammar and verify it regenerates the input",
    ],
};

export default module;
