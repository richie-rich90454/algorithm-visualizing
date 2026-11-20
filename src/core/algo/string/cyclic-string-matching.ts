/**
 * cyclic-string-matching.ts - Matching a Pattern in a Circular String
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A circular string wraps around, so a pattern may begin near the end of the
 * written text and continue at the front. This module tests every possible
 * starting position by comparing each pattern character with the text at the
 * index computed modulo the text length. Every start whose whole pattern
 * agrees is reported, including occurrences that cross the wrap point.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m) for text length n and pattern length m
 *   Space: O(n) for the displayed character row
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The circular text is drawn as a single row of character boxes.
 *   - The current candidate's positions, including wrapped ones, are colored.
 *   - A complete match turns green; the final frame marks every match start.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

interface CyclicInput {
    text?: string;
    pattern?: string;
}

/** Build the text row with the candidate positions highlighted. */
function makeText(
    text: string,
    start: number,
    length: number,
    matched: boolean,
    matchStarts: number[],
): VisualEntity[] {
    return makeCharacters(text).map((entity) => {
        const index = Number(entity.metadata["index"]);
        let state: EntityState = "idle";
        if (matchStarts.includes(index)) {
            state = "sorted";
        }
        if (start >= 0 && length > 0) {
            for (let k = 0; k < length; k += 1) {
                if ((start + k) % text.length === index) {
                    state = matched ? "sorted" : "comparing";
                    break;
                }
            }
        }
        return { ...entity, state };
    });
}

/** The cyclic string matching generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CyclicInput | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "abcabc";
    const pattern = typeof task.pattern === "string" ? task.pattern : "cabc";
    const n = text.length;
    const m = pattern.length;
    const matches: number[] = [];
    let comparisons = 0;

    yield {
        stepNumber: 0,
        entities: makeText(text, -1, 0, false, []),
        edges: [],
        description: `Searching for "${pattern}" in the circular text "${text}" at all ${n} start positions.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { matches: [] as number[], comparisons: 0, start: -1, pattern, wrapped: 0 },
    };

    let step = 1;
    if (n === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty circular text has no start positions to test.",
            codeLineNumber: 4,
            layout: "text",
            meta: { matches: [] as number[], comparisons: 0, start: -1, pattern, wrapped: 0 },
        };
        return;
    }

    if (m === 0) {
        for (let start = 0; start < n; start += 1) {
            matches.push(start);
        }
        yield {
            stepNumber: step,
            entities: makeText(text, -1, 0, false, matches),
            edges: [],
            description: `Empty pattern matches at all ${n} start positions of the circle.`,
            codeLineNumber: 4,
            layout: "text",
            meta: { matches, comparisons: 0, start: -1, pattern, wrapped: 0 },
        };
        return;
    }

    let wrapped = 0;
    for (let start = 0; start < n; start += 1) {
        let matched = true;
        for (let k = 0; k < m; k += 1) {
            comparisons += 1;
            if (pattern[k] !== text[(start + k) % n]) {
                matched = false;
                break;
            }
        }
        if (matched) {
            matches.push(start);
            if (start + m > n) {
                wrapped += 1;
            }
        }
        yield {
            stepNumber: step,
            entities: makeText(text, start, m, matched, []),
            edges: [],
            description:
                `Start ${start}: pattern characters land on ${m} circular positions` +
                `${matched ? " - complete match" : " - mismatch"}.`,
            codeLineNumber: matched ? 4 : 2,
            layout: "text",
            meta: { matches: [...matches], comparisons, start, pattern, wrapped },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeText(text, -1, 0, false, matches),
        edges: [],
        description:
            matches.length === 0
                ? `No circular occurrence of "${pattern}" in "${text}".`
                : `"${pattern}" occurs at starts ${matches.join(", ")} (${wrapped} wrapping).`,
        codeLineNumber: 5,
        layout: "text",
        meta: { matches, comparisons, start: -1, pattern, wrapped, done: true },
    };
}

/** The cyclic string matching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A circular string has no true beginning: after its last character comes its first. To match a pattern in such a string, try every position as a candidate start and read the pattern forward, wrapping the text index around with the modulo operator. A candidate succeeds when the pattern's characters agree with the circular text at every step.",
        invariants: [
            "For candidate start s and pattern offset k, the text index is always (s + k) modulo n.",
            "A candidate is a match exactly when every one of the m comparisons succeeds.",
            "An occurrence wraps precisely when s + m exceeds the text length.",
        ],
        correctness:
            "Every occurrence of the pattern in the circular string must begin at some position s in zero through n minus one, and the module tests all of them. For a fixed start it compares pattern character k with text character (s + k) modulo n, which is the definition of reading m characters around the circle from s. A complete agreement is therefore exactly an occurrence, and a mismatch disqualifies that start, so the final list contains every occurrence and no others.",
        complexityRationale:
            "There are n candidate starts and each compares up to m characters, so the worst-case time is O(nm). The character row and the reported matches use O(n) space, and no auxiliary table is needed.",
        uses: [
            "Searching patterns in circular genomes of bacteria and plasmids",
            "Finding repeated motifs in ring-shaped data structures",
            "Checking rotations of a string for equivalence",
        ],
        references: [
            "Gusfield, Algorithms on Strings, Trees and Sequences, Chapter 1",
            "Crochemore and Rytter, Jewels of Stringology, pattern matching exercises",
        ],
        workedExample:
            'In the circular text "abcabc" the pattern "cabc" matches at start two without wrapping, reading positions two, three, four, and five. It also matches at start five, reading positions five, zero, one, and two, which crosses the wrap point, so the module reports starts two and five with one wrapping occurrence.',
    },
    id: "cyclic-string-matching",
    name: "Cyclic String Matching",
    category: "string",
    complexity: { time: "O(n * m)", space: "O(n)" },
    defaultInput: { text: "abcabc", pattern: "cabc" },
    visualType: "text",
    run,
    pseudocode: [
        "let n be the text length and m the pattern length",
        "for each start position s from zero to n minus one",
        "for each pattern offset k from zero to m minus one",
        "compare pattern k with text at index s plus k modulo n",
        "if a character differs, reject this start",
        "if all characters agree, record s as a match",
        "done: report every matching start and how many wrap",
    ],
};

export default module;
