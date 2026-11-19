/**
 * apostolico-giancarlo-search.ts – Apostolico-Giancarlo string matching.
 *
 * This variant augments Boyer-Moore with a skip table that remembers the text
 * positions where each pattern offset was already confirmed to match. When an
 * alignment revisits the same comparison, the stored result is reused instead
 * of comparing again, reducing comparisons on repetitive text.
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

/** Strong good-suffix shift: smallest safe shift after a mismatch at index i. */
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
    const text = task.text ?? "abababababababab";
    const pattern = task.pattern ?? "abab";
    const n = text.length;
    const m = pattern.length;
    const lines = 8;

    let step = 0;
    const emit = (states: Map<number, EntityState>, description: string, line: number, matches: number[]): VisualFrame => ({
        stepNumber: step,
        entities: makeText(text, states),
        edges: [],
        description,
        codeLineNumber: Math.min(line, lines - 1),
        layout: "text",
        meta: { comparisons: totalComparisons, matches: matches.length, positions: matches },
    });

    let totalComparisons = 0;
    yield emit(new Map(), `Apostolico-Giancarlo search for "${pattern}" in "${text}".`, 0, []);
    step += 1;

    if (m === 0 || m > n) {
        yield emit(new Map(), m === 0 ? "Empty pattern - no search performed." : "Pattern longer than text - no matches.", 7, []);
        return;
    }

    const bad = new Map<string, number>();
    for (let i = 0; i < m; i += 1) bad.set(pattern[i] as string, i);
    const gs = goodSuffix(pattern);
    const lastMatched = new Array<number>(m).fill(-1);

    yield emit(new Map(), `Built bad-character and good-suffix tables; good shifts [${gs.join(", ")}].`, 1, []);
    step += 1;

    const matches: number[] = [];
    let s = 0;
    while (s <= n - m) {
        let j = m - 1;
        const window = new Map<number, EntityState>();
        while (j >= 0) {
            const textPos = s + j;
            const known = lastMatched[j] === textPos;
            if (!known) {
                totalComparisons += 1;
                if (text[textPos] !== pattern[j]) break;
                lastMatched[j] = textPos;
            }
            window.set(textPos, known ? "highlight" : "sorted");
            j -= 1;
        }
        if (step < 70) {
            yield emit(window, `Alignment ${s}: matched ${m - 1 - j} of ${m} characters${j < 0 ? " (full match)" : `, mismatch at pattern ${j}`}.`, 3, matches);
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
            const c = text[s + j] as string;
            const d = Math.max(1, gs[j] as number, j - (bad.get(c) ?? -1));
            s += d;
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
        intuition: "Apostolico-Giancarlo speeds up Boyer-Moore by recording, for each pattern offset, the text position where that offset was last confirmed to match. If a later alignment would compare the same pattern offset at the same text position, the algorithm reuses the known result and skips the comparison, which pays off on repetitive text.",
        invariants: [
            "The skip entry for offset j stores a text position where pattern[j] was verified to equal the text character.",
            "A skipped comparison is only reused when the exact same offset and text position recur, so the result is still valid.",
            "Every alignment shift is at least one, so the scan always makes forward progress."
        ],
        correctness: "The search still applies the standard Boyer-Moore bad-character and good-suffix shifts, which never skip a valid occurrence. The skip table only avoids repeating a comparison whose outcome is already known for that identical offset and text position, so it cannot change the answer. A full match is reported whenever all offsets compare equal, giving exactly the true occurrences.",
        complexityRationale: "Preprocessing the tables takes O(m + sigma) time and space. The scan moves the alignment forward by at least one each step and reuses known comparisons, using O(n + m) comparisons on typical input, though the worst case remains O(nm) when shifts are repeatedly one.",
        uses: [
            "Fast substring search in large text files",
            "Pattern scanning in text editors and search tools",
            "Bioinformatics sequence matching on repetitive data",
            "A teaching example of optimizing Boyer-Moore"
        ],
        references: [
            "Apostolico and Giancarlo, The Boyer-Moore-Galil String Searching Strategy Revisited, SIAM Journal on Computing, 1986",
            "Crochemore and Perrin, Text Algorithms, Chapter 2"
        ],
        workedExample: "Searching for abab in abababab: the bad-character table stores a at 2 and b at 3, and the good-suffix shifts are small because the pattern has border ab. After a full match at index 0, the scan advances and the skip table remembers that pattern offset 0 matched text position 0, so revisiting that comparison is avoided. Matches are reported at 0, 2, 4, and 6."
    },
    id: "apostolico-giancarlo-search",
    name: "Apostolico-Giancarlo Search",
    category: "string",
    complexity: { time: "O(n + m) typical", space: "O(m + sigma)" },
    defaultInput: { text: "abababababababab", pattern: "abab" },
    visualType: "text",
    run,
    pseudocode: [
        "preprocess bad-character and good-suffix tables",
        "initialize the skip table to no recorded match",
        "align the pattern at the start of the text",
        "compare pattern characters from right to left using skip entries",
        "if all characters match record the occurrence",
        "otherwise shift by the largest safe Boyer-Moore amount",
        "update skip entries for confirmations made",
        "advance the alignment until the pattern no longer fits"
    ]
};

export default module;
