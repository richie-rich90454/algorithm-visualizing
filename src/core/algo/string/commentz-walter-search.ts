/**
 * commentz-walter-search.ts – Commentz-Walter multi-pattern search.
 *
 * The algorithm combines Boyer-Moore's right-to-left scanning with a trie of
 * reversed patterns. Starting at each candidate end position, it walks the
 * reversed trie against the text backwards; reaching a terminal node reports
 * a match. A bad-character shift, taken as the minimum over all patterns,
 * advances the scan without skipping any occurrence.
 *
 *  Time:  O(n * maxPatternLength) teaching version
 *  Space: O(total pattern length + alphabet)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

interface TrieNode {
    children: Map<string, TrieNode>;
    out: number[];
}

function makeText(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(text).map((char) => {
        const index = Number(char.metadata["index"]);
        return { ...char, state: states.get(index) ?? "idle" };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; patterns?: string[] } | null) ?? {};
    const text = task.text ?? "the quick brown fox jumps over the lazy dog";
    const patterns = Array.isArray(task.patterns)
        ? task.patterns.filter((p) => typeof p === "string" && p.length > 0)
        : ["the", "quick", "fox", "lazy"];
    const lines = 8;
    let comparisons = 0;
    let step = 0;
    const matches: Array<{ pattern: string; start: number }> = [];

    const emit = (states: Map<number, EntityState>, description: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: makeText(text, states),
        edges: [],
        description,
        codeLineNumber: Math.min(line, lines - 1),
        layout: "text",
        meta: { comparisons, matchCount: matches.length, matches: matches.map((m) => `${m.pattern}@${m.start}`) },
    });

    yield emit(new Map(), `Commentz-Walter search for ${patterns.length} pattern(s) in "${text}".`, 0);
    step += 1;
    if (patterns.length === 0 || text.length === 0) {
        yield emit(new Map(), "No patterns or empty text - nothing to search.", 7);
        return;
    }

    // Build the trie of reversed patterns.
    const root: TrieNode = { children: new Map(), out: [] };
    patterns.forEach((pattern, idx) => {
        let node = root;
        for (let k = pattern.length - 1; k >= 0; k -= 1) {
            const c = pattern[k] as string;
            let next = node.children.get(c);
            if (!next) {
                next = { children: new Map(), out: [] };
                node.children.set(c, next);
            }
            node = next;
        }
        node.out.push(idx);
    });

    // Per-pattern bad-character last occurrences; the scan shift is their minimum.
    const lastTables = patterns.map((p) => {
        const last = new Map<string, number>();
        for (let i = 0; i < p.length; i += 1) last.set(p[i] as string, i);
        return last;
    });
    const minLen = Math.min(...patterns.map((p) => p.length));

    yield emit(new Map(), `Built a reversed-pattern trie with ${patterns.length} terminal entries; shortest pattern has length ${minLen}.`, 1);
    step += 1;

    let i = minLen - 1;
    while (i < text.length) {
        let node: TrieNode = root;
        let depth = 0;
        const window = new Map<number, EntityState>();
        while (i - depth >= 0) {
            const next = node.children.get(text[i - depth] as string);
            if (!next) break;
            comparisons += 1;
            node = next;
            depth += 1;
            window.set(i - depth + 1, "sorted");
            if (node.out.length > 0) {
                const start = i - depth + 1;
                for (const idx of node.out) {
                    matches.push({ pattern: patterns[idx] as string, start });
                }
                if (step < 80) {
                    yield emit(window, `Matched ${node.out.map((idx) => `"${patterns[idx]}"`).join(", ")} ending at ${i} (start ${start}).`, 4);
                    step += 1;
                }
            }
        }
        if (step < 80 && depth === 0) {
            yield emit(new Map(), `No pattern suffix ends at text position ${i}.`, 3);
            step += 1;
        }
        // Bad-character shift: minimum safe jump over every pattern.
        const c = text[i] as string;
        let shift = Number.POSITIVE_INFINITY;
        for (let p = 0; p < patterns.length; p += 1) {
            const m = (patterns[p] as string).length;
            const last = lastTables[p] as Map<string, number>;
            shift = Math.min(shift, m - 1 - (last.get(c) ?? -1));
        }
        i += Math.max(1, shift);
    }

    const final = new Map<number, EntityState>();
    for (const match of matches) {
        const pattern = patterns.find((p) => p === match.pattern) as string;
        for (let k = match.start; k < match.start + pattern.length; k += 1) final.set(k, "sorted");
    }
    const summary = matches.length === 0
        ? "No pattern occurs in the text."
        : `Found ${matches.length} match(es): ${matches.map((m) => `"${m.pattern}"@${m.start}`).join(", ")}.`;
    yield emit(final, summary, 7);
}

const module: AlgorithmModule = {
    education: {
        intuition: "Commentz-Walter searches for several patterns at once by combining Boyer-Moore with a trie of the patterns written backwards. At each candidate end position it walks the reversed trie against the text from right to left, so a single pass can detect any of the patterns. A bad-character shift skips positions that cannot begin a match.",
        invariants: [
            "Each trie root-to-leaf path spells a reversed pattern, so walking it against text backwards matches that pattern forward.",
            "A terminal trie node corresponds to a complete pattern match ending at the current text position.",
            "The scan shift is the minimum of the per-pattern safe shifts, so it never skips a pattern occurrence."
        ],
        correctness: "Walking a reversed pattern from the current text position leftward succeeds exactly when the forward pattern ends at that position, so every terminal node reached is a genuine occurrence. The shift for the current character is bounded by the smallest safe Boyer-Moore shift over all patterns, meaning no pattern's next possible start is passed over. Together these facts ensure all and only real occurrences are reported.",
        complexityRationale: "Building the reversed trie uses space proportional to the total pattern length. At each of up to n alignments the walk follows at most the longest pattern, giving O(n times maximum pattern length) time in this teaching version; the shift table prune reduces work in practice.",
        uses: [
            "Searching for many forbidden or suspect words at once",
            "Virus signature and intrusion detection scanning",
            "Multi-keyword highlighting in text processing",
            "A teaching bridge between Boyer-Moore and Aho-Corasick"
        ],
        references: [
            "Commentz-Walter, A String Matching Algorithm Fast on the Average, 1979",
            "Crochemore and Perrin, Text Algorithms, Chapter 7"
        ],
        workedExample: "With patterns the, quick, fox and lazy over the text about a quick brown fox, the trie stores eht, kciuq, xof and yzal. Starting at the position where fox ends, walking backwards follows x-o-f to a terminal node and reports fox at that start. The bad-character shift then advances the scan to the next viable end position."
    },
    id: "commentz-walter-search",
    name: "Commentz-Walter Search",
    category: "string",
    complexity: { time: "O(n * max pattern length)", space: "O(total pattern length)" },
    defaultInput: { text: "the quick brown fox jumps over the lazy dog", patterns: ["the", "quick", "fox", "lazy"] },
    visualType: "text",
    run,
    pseudocode: [
        "build a trie of the reversed patterns",
        "record terminal nodes with their pattern indices",
        "precompute bad-character shifts for every pattern",
        "start at the shortest pattern length minus one",
        "walk the trie backwards from the current end position",
        "report a match whenever a terminal node is reached",
        "advance by the minimum safe bad-character shift",
        "report all pattern occurrences found"
    ]
};

export default module;
