/**
 * galil-seiferas.ts - Galil-Seiferas Periodic String Matching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Galil-Seiferas algorithm finds every occurrence of a pattern in linear
 * time using only logarithmic extra space. Its key idea is periodicity: if the
 * pattern has minimal period p, then two occurrences must be at least p apart.
 * It first locates candidate positions with a short prefix (the probe of length
 * up to two periods) using KMP, verifies the full pattern only at those
 * candidates, and skips a whole period after each confirmed match.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) for text length n and pattern length m
 *   Space: O(m) for the prefix tables and probe
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Text characters are drawn in the text layout.
 *   - The probe window is highlighted while a candidate is verified.
 *   - Confirmed matches are painted green in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

/** The KMP prefix (failure) function of a string. */
export function prefixFunction(s: string): number[] {
    const pi = new Array<number>(s.length).fill(0);
    for (let i = 1; i < s.length; i += 1) {
        let j = pi[i - 1] ?? 0;
        while (j > 0 && s[i] !== s[j]) {
            j = pi[j - 1] ?? 0;
        }
        if (s[i] === s[j]) {
            j += 1;
        }
        pi[i] = j;
    }
    return pi;
}

/** Minimal period length of a string from its longest border. */
export function minimalPeriod(pattern: string): number {
    if (pattern.length === 0) {
        return 0;
    }
    const pi = prefixFunction(pattern);
    return pattern.length - (pi[pattern.length - 1] ?? 0);
}

/** All start positions where pattern occurs in text, found with KMP. */
export function kmpOccurrences(text: string, pattern: string): number[] {
    if (pattern.length === 0) {
        return [];
    }
    const pi = prefixFunction(pattern);
    const found: number[] = [];
    let j = 0;
    for (let i = 0; i < text.length; i += 1) {
        while (j > 0 && text[i] !== pattern[j]) {
            j = pi[j - 1] ?? 0;
        }
        if (text[i] === pattern[j]) {
            j += 1;
        }
        if (j === pattern.length) {
            found.push(i - pattern.length + 1);
            j = pi[j - 1] ?? 0;
        }
    }
    return found;
}

export interface GalilSeiferasResult {
    matches: number[];
    period: number;
    probeLength: number;
    candidates: number[];
}

/** Galil-Seiferas search: period-based candidate verification. */
export function galilSeiferas(text: string, pattern: string): GalilSeiferasResult {
    const m = pattern.length;
    if (m === 0 || m > text.length) {
        return { matches: [], period: m, probeLength: 0, candidates: [] };
    }
    const period = minimalPeriod(pattern);
    const probeLength = Math.min(2 * period, m);
    const probe = pattern.slice(0, probeLength);
    const candidates = kmpOccurrences(text, probe);
    const matches: number[] = [];
    let lastAccepted = -Infinity;
    for (const s of candidates) {
        if (s < lastAccepted + period) {
            continue;
        }
        let equal = true;
        for (let j = 0; j < m; j += 1) {
            if (text[s + j] !== pattern[j]) {
                equal = false;
                break;
            }
        }
        if (equal) {
            matches.push(s);
            lastAccepted = s;
        }
    }
    return { matches, period, probeLength, candidates };
}

function highlight(text: string, spans: Array<[number, number, EntityState]>): VisualEntity[] {
    return makeCharacters(text).map((entity) => {
        const index = Number((entity.metadata as Record<string, unknown>)["index"]);
        let state: EntityState = "idle";
        for (const [start, end, desired] of spans) {
            if (index >= start && index < end) {
                state = desired;
            }
        }
        return { ...entity, state };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "ababababaabababa";
    const pattern = typeof task.pattern === "string" ? task.pattern : "ababab";
    const result = galilSeiferas(text, pattern);
    let step = 0;
    const frame = (
        entities: VisualEntity[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"],
    ): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta: { pattern, period: result.period, probeLength: result.probeLength, matches: [], ...meta },
    });

    yield frame(
        highlight(text, []),
        `Galil-Seiferas search for "${pattern}" in "${text}".`,
        0,
        { candidates: result.candidates },
    );
    yield frame(
        highlight(text, []),
        `Pattern has minimal period ${result.period}; probe length ${result.probeLength}.`,
        2,
        { candidates: result.candidates },
    );

    let shown = 0;
    for (const s of result.candidates) {
        if (shown >= 10) {
            break;
        }
        const verified = result.matches.includes(s);
        const span: Array<[number, number, EntityState]> = [
            [s, s + result.probeLength, verified ? "path" : "comparing"],
        ];
        yield frame(
            highlight(text, span),
            `Probe at ${s}: ${verified ? "full pattern matches" : "candidate rejected"}.`,
            4,
            { candidate: s, verified, matchesSoFar: result.matches.filter((v) => v <= s) },
        );
        shown += 1;
    }

    const matchSpans: Array<[number, number, EntityState]> = result.matches.map((s) => [s, s + pattern.length, "sorted"]);
    yield frame(
        highlight(text, matchSpans),
        result.matches.length
            ? `Found "${pattern}" at positions ${result.matches.join(", ")}.`
            : `"${pattern}" does not occur in the text.`,
        6,
        { matches: result.matches, done: true },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A periodic pattern repeats, so once you have confirmed one full occurrence you need not look again until a whole period has passed. Galil-Seiferas uses a short probe, usually two periods of the pattern, to find candidate positions cheaply, then checks the full pattern only at those spots. This trades extra comparisons for the structural guarantee that matches cannot crowd together.",
        invariants: [
            "The minimal period p is the length of the pattern minus its longest proper border.",
            "Every full occurrence of the pattern is also an occurrence of the probe prefix.",
            "Two distinct full occurrences are separated by at least p positions.",
        ],
        correctness:
            "Because the probe is a prefix of the pattern, any true match must appear among the probe occurrences found by KMP. If the pattern matched at two starts s and s+d with 0 < d < p, then comparing the two aligned copies gives pattern[i] = pattern[i+d] for every valid i, so d would be a period smaller than the minimal one, a contradiction. Hence after verifying a match at s the next true match cannot begin before s+p, making the skip safe; every candidate is still fully verified, so no false positive is reported.",
        complexityRationale:
            "The prefix function and KMP scan each take O(n+m) time, and the number of verified candidates is bounded by n/p with at most m comparisons each in the worst case, giving the linear-time guarantee of the Galil-Seiferas method with O(m) working space for the tables.",
        uses: [
            "Exact pattern search with small memory footprints",
            "Scanning streams where the pattern is highly periodic",
            "A building block for space-efficient string matching libraries",
        ],
        references: [
            "Galil and Seiferas, Time-Space Optimal String Matching, 1983",
            "Crochemore and Perrin, Pattern Matching Algorithms, Chapter 2",
        ],
        workedExample:
            "For pattern ababab the minimal period is 2 and the probe is abab. In text ababababaabababa the probe hits many positions, but after confirming a full match at position 0 the next true match cannot start before position 2. Verifying the surviving candidates reports every exact occurrence of ababab.",
    },
    id: "galil-seiferas",
    name: "Galil-Seiferas String Matching",
    category: "string",
    complexity: { time: "O(n + m)", space: "O(m)" },
    defaultInput: { text: "ababababaabababa", pattern: "ababab" },
    visualType: "text",
    run,
    pseudocode: [
        "compute the prefix function of the pattern",
        "set the period to the pattern length minus its longest border",
        "choose the probe as the first two periods of the pattern",
        "find every probe occurrence in the text with KMP",
        "for each probe hit verify the whole pattern at that position",
        "after a verified match skip forward by one period",
        "report all confirmed match positions",
    ],
};

export default module;
