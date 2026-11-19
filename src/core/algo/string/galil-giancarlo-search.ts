/**
 * galil-giancarlo-search.ts – Galil-Giancarlo string matching.
 *
 * After a full match this variant jumps by the pattern's period instead of
 * one character. The overlap with the previous match is then known to agree
 * with the pattern prefix, so only the newly exposed characters need to be
 * checked. Between matches it uses ordinary Boyer-Moore shifts.
 *
 *  Time:  O(n + m) comparisons in practice, O(nm) worst case
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

/** Prefix function, used to obtain the pattern period. */
function prefixFunction(p: string): number[] {
    const pi = new Array<number>(p.length).fill(0);
    for (let i = 1; i < p.length; i += 1) {
        let j = pi[i - 1] as number;
        while (j > 0 && p[i] !== p[j]) j = pi[j - 1] as number;
        if (p[i] === p[j]) j += 1;
        pi[i] = j;
    }
    return pi;
}

/** Strong good-suffix shift after a mismatch at index i. */
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = task.text ?? "aaaaaabaaaaaabaaaaaab";
    const pattern = task.pattern ?? "aaaaaab";
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

    yield emit(new Map(), `Galil-Giancarlo search for "${pattern}" in "${text}".`, 0, []);
    step += 1;
    if (m === 0 || m > n) {
        yield emit(new Map(), m === 0 ? "Empty pattern - nothing to search for." : "Pattern longer than text - no matches.", 7, []);
        return;
    }

    const pi = prefixFunction(pattern);
    const period = m - (pi[m - 1] as number);
    const good = goodSuffix(pattern);
    const bad = new Map<string, number>();
    for (let i = 0; i < m; i += 1) bad.set(pattern[i] as string, i);

    yield emit(new Map(), `Border length ${pi[m - 1]} gives period ${period}; shifts [${good.join(", ")}].`, 1, []);
    step += 1;

    const matches: number[] = [];
    let s = 0;
    let knownPrefix = 0;
    while (s <= n - m) {
        let j = m - 1;
        const window = new Map<number, EntityState>();
        while (j >= 0) {
            if (j >= knownPrefix) {
                comparisons += 1;
                if (text[s + j] !== pattern[j]) break;
            }
            window.set(s + j, j >= knownPrefix ? "sorted" : "visited");
            j -= 1;
        }
        if (step < 70) {
            yield emit(window, `Alignment ${s}: ${knownPrefix} known from the period, ${m - 1 - j} newly checked.`, 4, matches);
            step += 1;
        }
        if (j < 0) {
            matches.push(s);
            const found = new Map<number, EntityState>();
            for (let k = s; k < s + m; k += 1) found.set(k, "path");
            if (step < 70) {
                yield emit(found, `Pattern found at index ${s}; next jump is the period ${period}.`, 5, matches);
                step += 1;
            }
            s += period;
            knownPrefix = m - period;
        } else {
            const c = text[s + j] as string;
            const shift = Math.max(1, good[j] as number, j - (bad.get(c) ?? -1));
            s += shift;
            knownPrefix = 0;
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
        intuition: "When Boyer-Moore finds a match, advancing by only one character rechecks a long overlap. Galil and Giancarlo observed that the pattern's period guarantees the overlap still matches, so the scan can jump by a full period and verify only the newly exposed characters. This keeps the linear-time behavior of Boyer-Moore while cutting redundant comparisons.",
        invariants: [
            "The pattern period equals the pattern length minus its longest border.",
            "After a match, the overlap at the shifted alignment agrees with the pattern prefix by periodicity.",
            "Between matches the Boyer-Moore shift is safe, so no occurrence is skipped."
        ],
        correctness: "If the pattern matches at s and has period p, then for the alignment s + p the overlapping text equals the pattern suffix of length m - p, which by periodicity equals the pattern prefix of that length. Those positions are therefore known matches and only the p new positions require checking. Between matches the good-suffix and bad-character shifts move the pattern without discarding any valid alignment, so every occurrence is found.",
        complexityRationale: "The prefix function and good-suffix table take O(m) and O(m squared) respectively in this teaching version. Each alignment advances by at least one and after a match by the period, so the scan performs O(n + m) comparisons on typical input with an O(nm) worst case.",
        uses: [
            "Fast substring search over long repetitive text",
            "Pattern scanning where matches are frequent",
            "Bioinformatics searches on repetitive sequences",
            "A teaching example of periodicity-based skipping"
        ],
        references: [
            "Galil, On Improving the Worst Case Running Time of the Boyer-Moore String Matching Algorithm, 1979",
            "Crochemore and Perrin, Text Algorithms, Chapter 2"
        ],
        workedExample: "For pattern aaaaab the longest border is empty, so the period is 6 and a match forces a jump of six characters. For pattern abab the border ab gives period 2, so after a match at index 0 the scan jumps to index 2, knows the first two positions already match, and only checks the last two characters."
    },
    id: "galil-giancarlo-search",
    name: "Galil-Giancarlo Search",
    category: "string",
    complexity: { time: "O(n + m) typical", space: "O(m + sigma)" },
    defaultInput: { text: "aaaaaabaaaaaabaaaaaab", pattern: "aaaaaab" },
    visualType: "text",
    run,
    pseudocode: [
        "compute the prefix function and the pattern period",
        "build bad-character and good-suffix shift tables",
        "align the pattern and set the known prefix to zero",
        "compare from right to left, skipping the known prefix",
        "on a full match record the occurrence",
        "advance by the period and set the known prefix to length minus period",
        "on a mismatch apply a Boyer-Moore shift and clear the known prefix",
        "report every occurrence found"
    ]
};

export default module;
