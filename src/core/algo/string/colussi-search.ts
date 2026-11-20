/**
 * colussi-search.ts – Colussi string matching.
 *
 * Colussi's variant of Boyer-Moore replaces the usual rightmost-occurrence
 * shift with a table built from the previous occurrence of each pattern
 * symbol, and adds a lookahead table recording how far a partial match can be
 * reused. The scan still runs right to left, but the shift is capped by the
 * good-suffix value so no occurrence is ever skipped.
 *
 *  Time:  O(nm) worst case, O(n + m) typical
 *  Space: O(m + sigma) for the tables
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

function makeText(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(text).map((char) => {
        const index = Number(char.metadata["index"]);
        return { ...char, state: states.get(index) ?? "idle" };
    });
}

/** Distance from each pattern position to the previous occurrence of its symbol. */
function previousOccurrenceShift(p: string): number[] {
    const m = p.length;
    const d = new Array<number>(m);
    for (let i = 0; i < m; i += 1) {
        let prev = -1;
        for (let k = i - 1; k >= 0; k -= 1) {
            if (p[k] === p[i]) {
                prev = k;
                break;
            }
        }
        d[i] = prev === -1 ? i + 1 : i - prev;
    }
    return d;
}

/** Good-suffix shift: smallest safe shift after a mismatch at index i. */
function goodSuffix(p: string): number[] {
    const m = p.length;
    const shift = new Array<number>(m).fill(m);
    for (let i = 0; i < m; i += 1) {
        for (let d = 1; d <= m; d += 1) {
            let ok = true;
            const qStart = Math.max(0, i + 1 - d);
            const qEnd = m - 1 - d;
            for (let q = qStart; q <= qEnd; q += 1) {
                if (p[q] !== p[q + d]) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                shift[i] = d;
                break;
            }
        }
    }
    return shift;
}

/** Lookahead length: longest prefix that is also a suffix ending near index i. */
function lookahead(p: string): number[] {
    const m = p.length;
    const h = new Array<number>(m).fill(0);
    for (let i = 0; i < m; i += 1) {
        let best = 0;
        for (let k = Math.min(i + 1, m); k > 0; k -= 1) {
            if (p.slice(0, k) === p.slice(m - k)) {
                best = k;
                break;
            }
        }
        h[i] = best;
    }
    return h;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = task.text ?? "abcabcabcabcabc";
    const pattern = task.pattern ?? "abcabc";
    const n = text.length;
    const m = pattern.length;
    const lines = 8;
    let comparisons = 0;
    let step = 0;

    const emit = (states: Map<number, EntityState>, description: string, line: number, matches: number[]): VisualFrame => ({
        stepNumber: step,
        entities: makeText(text, states),
        edges: [],
        description,
        codeLineNumber: Math.min(line, lines - 1),
        layout: "text",
        meta: { comparisons, matches: matches.length, positions: matches },
    });

    yield emit(new Map(), `Colussi search for "${pattern}" in "${text}".`, 0, []);
    step += 1;
    if (m === 0 || m > n) {
        yield emit(new Map(), m === 0 ? "Empty pattern - nothing to search for." : "Pattern longer than text - no matches.", 7, []);
        return;
    }

    const d = previousOccurrenceShift(pattern);
    const gs = goodSuffix(pattern);
    const h = lookahead(pattern);
    yield emit(new Map(), `Previous-occurrence shifts [${d.join(", ")}]; lookahead [${h.join(", ")}].`, 1, []);
    step += 1;

    const matches: number[] = [];
    let s = 0;
    while (s <= n - m) {
        let j = m - 1;
        const window = new Map<number, EntityState>();
        while (j >= 0) {
            comparisons += 1;
            if (text[s + j] !== pattern[j]) break;
            window.set(s + j, "sorted");
            j -= 1;
        }
        if (step < 70) {
            yield emit(window, `Alignment ${s}: ${m - 1 - j} matching characters${j < 0 ? " (full match)" : `, lookahead ${h[j]} at index ${j}`}.`, 3, matches);
            step += 1;
        }
        if (j < 0) {
            matches.push(s);
            const found = new Map<number, EntityState>();
            for (let k = s; k < s + m; k += 1) found.set(k, "path");
            if (step < 70) {
                yield emit(found, `Pattern found at index ${s}.`, 5, matches);
                step += 1;
            }
            s += 1;
        } else {
            // Cap the previous-occurrence shift with the safe good-suffix shift.
            const shift = Math.max(1, Math.min(gs[j] as number, d[j] as number));
            s += shift;
        }
    }

    const final = new Map<number, EntityState>();
    for (const start of matches) {
        for (let k = start; k < start + m; k += 1) final.set(k, "sorted");
    }
    yield emit(final, matches.length === 0
        ? `"${pattern}" does not occur in "${text}".`
        : `"${pattern}" occurs at ${matches.join(", ")}.`, 7, matches);
}

const module: AlgorithmModule = {
    education: {
        intuition: "Colussi's algorithm refines Boyer-Moore by deriving the shift from the previous occurrence of each pattern symbol and by computing a lookahead that says how many characters of a partial match can be trusted. The two tables together let the scan choose a safe jump without rescanning the entire pattern.",
        invariants: [
            "The shift table d at index i is the distance back to the previous equal symbol, or i plus one when none exists.",
            "The applied shift never exceeds the good-suffix shift, so it cannot skip a valid alignment.",
            "Each shift is at least one, so the alignment index strictly increases."
        ],
        correctness: "The good-suffix shift is known to be safe for Boyer-Moore: it moves the pattern only as far as the already matched suffix permits. Capping the previous-occurrence shift with this safe value can only make the jump shorter, which never hides an occurrence. Comparing all offsets right to left at every alignment therefore reports exactly the true occurrences.",
        complexityRationale: "Building the previous-occurrence table uses O(m sigma) or O(m) with hashing, the lookahead scan is O(m squared), and the good-suffix table is O(m squared) in this teaching version. The search itself advances at least one position per alignment, so it uses O(nm) time in the worst case and O(n + m) on typical text.",
        uses: [
            "Substring search with a small alphabet",
            "Text-scanning routines in editors and tools",
            "A teaching bridge between Boyer-Moore and one-way algorithms",
            "Pattern detection in log processing"
        ],
        references: [
            "Colussi, Faster Pattern Matching Algorithms, 1988",
            "Crochemore and Perrin, Text Algorithms, Chapter 2"
        ],
        workedExample: "For pattern abcabc the previous occurrence of a is at index 3, giving a shift of 3 at position 0, and the lookahead records the border abc of length 3. Searching abcabcabc reports a full match at index 0 and another at index 3; at each mismatch the shift is capped by the good-suffix value so the second match is not skipped."
    },
    id: "colussi-search",
    name: "Colussi Search",
    category: "string",
    complexity: { time: "O(nm) worst case", space: "O(m + sigma)" },
    defaultInput: { text: "abcabcabcabcabc", pattern: "abcabc" },
    visualType: "text",
    run,
    pseudocode: [
        "build the previous-occurrence shift table",
        "build the lookahead table from pattern borders",
        "build the good-suffix shift table",
        "align the pattern at the start of the text",
        "compare pattern characters from right to left",
        "on a full match record the starting index",
        "on a mismatch shift by the capped safe amount",
        "report every occurrence found in the text"
    ]
};

export default module;
