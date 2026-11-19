/**
 * minimal-string-generator.ts - Minimal String Generator per Position
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For every position i of a text, the minimal string generator is the shortest
 * prefix of the suffix text[i..] that does not also occur at an earlier start
 * position. Its length equals one plus the longest common prefix shared by
 * suffix i with any suffix starting before i. These lengths are the building
 * block of the LZ family of compressors and of the string-generator encoding.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) with direct character comparisons for a text of length n
 *   Space: O(n) for the generator lengths and the displayed characters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Positions already processed are GREEN; the current position is CYAN.
 *   - Characters of the current generator substring are highlighted.
 *   - meta carries every generator length and substring, plus the sum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "ababac";
    const n = text.length;

    let step = 0;
    const frame = (
        description: string,
        line: number,
        current: number,
        generatorLength: number,
        generators: number[],
        longestMatches: number[],
    ): VisualFrame => {
        const entities: VisualEntity[] = makeCharacters(text).map((entity) => {
            const i = Number(entity.metadata["index"]);
            let state: EntityState = "idle";
            if (i < current) {
                state = "sorted";
            }
            if (i === current) {
                state = "active";
            }
            if (i >= current && i < current + generatorLength && generatorLength > 0) {
                state = "path";
            }
            return { ...entity, state };
        });
        return {
            stepNumber: step,
            entities,
            edges: [],
            description,
            codeLineNumber: line,
            layout: "text",
            meta: {
                generators: [...generators],
                generatorSubstrings: generators.map((length, i) => text.slice(i, i + length)),
                longestMatches: [...longestMatches],
                sum: generators.reduce((total, value) => total + value, 0),
                length: n,
            },
        };
    };

    yield frame(`Computing minimal string generators for "${text}".`, 0, -1, 0, [], []);
    step += 1;

    if (n === 0) {
        yield frame("An empty text has no positions and no generators.", 6, -1, 0, [], []);
        step += 1;
        return;
    }

    const generators: number[] = [];
    const longestMatches: number[] = [];
    for (let i = 0; i < n; i += 1) {
        let longest = 0;
        for (let j = 0; j < i; j += 1) {
            let matched = 0;
            while (
                i + matched < n &&
                j + matched < n &&
                text[i + matched] === text[j + matched]
            ) {
                matched += 1;
            }
            if (matched > longest) {
                longest = matched;
            }
        }
        const generatorLength = Math.min(longest + 1, n - i);
        generators.push(generatorLength);
        longestMatches.push(longest);
        yield frame(
            `Position ${i}: longest match with an earlier suffix is ${longest}, so the generator is ${JSON.stringify(text.slice(i, i + generatorLength))} of length ${generatorLength}.`,
            3,
            i,
            generatorLength,
            generators,
            longestMatches,
        );
        step += 1;
    }

    yield frame(
        `All generators computed; their lengths are [${generators.join(", ")}] with sum ${generators.reduce((total, value) => total + value, 0)}.`,
        6,
        -1,
        0,
        generators,
        longestMatches,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "At each position, look back at every suffix that started earlier and measure how long a prefix you share with the worst of them. Adding one more character guarantees your generator is different from all earlier starts. That shortest distinguishing prefix is the position's string generator and is exactly what compression schemes record instead of the repeated text.",
        invariants: [
            "For a position i, the reported length is at most the number of remaining characters n - i.",
            "The generator prefix at i does not appear at any earlier start position.",
            "longestMatches[i] is the maximum longest common prefix of suffix i with any earlier suffix.",
        ],
        correctness:
            "For a fixed position i, a prefix of length L fails to be a generator precisely when some earlier suffix shares that whole prefix, which happens exactly when L is at most the longest common prefix with some earlier suffix. Taking the maximum over earlier suffixes gives the longest non-distinguishing length M, so M + 1 is the smallest distinguishing length, capped at the remaining text length. The direct comparisons compute each longest common prefix exactly, hence every reported generator is minimal and unique to its start.",
        complexityRationale:
            "For each of the n positions the algorithm scans up to i earlier suffixes and compares up to n characters, costing O(n^3) in the direct implementation. Only the generator lengths, match lengths, and character entities are retained, using O(n) space.",
        uses: [
            "The generator step of LZ77 and LZ78 compression families",
            "Computing the string-generator encoding of genomic sequences",
            "Finding shortest distinguishing prefixes for dictionary indexing",
        ],
        references: [
            "Gusfield, Algorithms on Strings, Trees and Sequences, chapter on suffix structures",
            "Crochemore and Perrin, Strings and Algorithms, chapter on string generators",
        ],
        workedExample:
            'For "ababac", position 0 has no earlier suffix so its generator is "a". At position 2 the suffix "abac" shares the two-character prefix "ab" with the suffix at 0, so the generator is the three-character "aba". At position 4 the longest earlier match is one character, giving "ba".',
    },
    id: "minimal-string-generator",
    name: "Minimal String Generator",
    category: "string",
    complexity: { time: "O(n³)", space: "O(n)" },
    defaultInput: { text: "ababac" },
    visualType: "text",
    run,
    pseudocode: [
        "let n be the length of the text",
        "for each position i from zero to n minus one",
        "set longest to zero",
        "for each earlier start j less than i",
        "extend the common prefix of suffixes i and j and keep its maximum length",
        "set the generator length to the maximum plus one, capped by n minus i",
        "record the generator substring of that length",
        "report all generator lengths and their sum",
    ],
};

export default module;
