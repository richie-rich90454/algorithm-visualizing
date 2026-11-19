/**
 * knuth-plass.ts - Knuth-Plass Optimal Line Breaking
 *
 * Typesetting a paragraph means choosing where each line ends. Knuth-Plass
 * assigns a squared badness to every candidate line, then uses dynamic
 * programming to find the break sequence with the smallest total badness. The
 * final line is exempt from the penalty, so ragged endings are not punished.
 *
 * Time: O(n^2) for n words
 * Space: O(n) for the suffix costs and break pointers
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TypesetInput {
    words: string[];
    lineWidth: number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<TypesetInput> | null) ?? {};
    const words = Array.isArray(task.words)
        ? [...task.words]
        : ["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog"];
    const lineWidth = typeof task.lineWidth === "number" ? task.lineWidth : 12;
    const n = words.length;
    const lengths = words.map((word) => word.length);
    const cost = Array(n + 1).fill(Infinity) as number[];
    const next = Array(n + 1).fill(n) as number[];
    cost[n] = 0;
    let step = 0;

    const makeGrid = (known: Set<number>): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let col = 0; col <= n; col += 1) {
            const value = known.has(col) ? cost[col] : Infinity;
            entities.push({
                id: `cell-0-${col}`,
                type: "cell" as const,
                label: known.has(col) ? String(value) : "?",
                value: known.has(col) ? value : 0,
                state: known.has(col) ? "path" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col },
            });
            entities.push({
                id: `cell-1-${col}`,
                type: "cell" as const,
                label: col === n ? "end" : String(next[col] ?? n),
                value: col === n ? n : (next[col] ?? n),
                state: known.has(col) ? "active" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col },
            });
        }
        return entities;
    };

    const frame = (known: Set<number>, description: string, line: number, lines: string[]): VisualFrame => {
        const result: VisualFrame = {
            stepNumber: step,
            entities: makeGrid(known),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                rows: 2,
                cols: n + 1,
                lineWidth,
                bestCost: known.has(0) ? cost[0] : -1,
                lines,
            },
        };
        step += 1;
        return result;
    };

    yield frame(new Set([n]), `Choosing line breaks for ${n} words at width ${lineWidth}.`, 0, []);

    const known = new Set<number>([n]);
    for (let i = n - 1; i >= 0; i -= 1) {
        let lineLength = 0;
        let best = Infinity;
        let bestBreak = n;
        for (let j = i; j < n; j += 1) {
            lineLength += (lengths[j] as number) + (j > i ? 1 : 0);
            if (lineLength > lineWidth) {
                break;
            }
            const ragged = j === n - 1 ? 0 : (lineWidth - lineLength) ** 2;
            const candidate = ragged + (cost[j + 1] as number);
            if (candidate < best) {
                best = candidate;
                bestBreak = j + 1;
            }
        }
        cost[i] = best;
        next[i] = bestBreak;
        known.add(i);
        yield frame(
            known,
            `Optimal cost from word ${i} onward is ${best}, breaking after word ${bestBreak - 1}.`,
            3,
            [],
        );
    }

    const lines: string[] = [];
    let cursor = 0;
    while (cursor < n) {
        const end = next[cursor] as number;
        lines.push(words.slice(cursor, end).join(" "));
        cursor = end;
    }
    yield frame(
        known,
        `Optimal paragraph has ${lines.length} line(s) with total badness ${cost[0]}.`,
        5,
        lines,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A line that is much shorter than the target width looks ragged, so Knuth-Plass charges the square of the leftover space. Rather than greedily filling each line, it computes from the end of the paragraph backward: the best cost from word i is the minimum over every legal line ending at j of that line's badness plus the best cost from j onward.",
        invariants: [
            "A candidate line never exceeds the target width.",
            "The last line carries zero badness.",
            "Costs are computed for suffixes, so every needed successor cost is already final.",
        ],
        correctness:
            "Any valid paragraph layout chooses a first break after some word j, and its remaining lines form an optimal layout of the suffix starting at j+1. Trying every legal j and taking the minimum therefore satisfies the optimal substructure, and induction from the empty suffix gives a globally minimal total badness. Following the stored break pointers reconstructs that layout.",
        complexityRationale:
            "For each of the n suffix starts the inner loop can scan up to n words, giving O(n^2) comparisons. Only the cost and break arrays of length n+1 are stored, so auxiliary space is O(n).",
        uses: [
            "Justified paragraph layout in the TeX typesetting system",
            "Web and print engines that balance line lengths",
            "Teaching dynamic programming over intervals of a sequence",
        ],
        references: [
            "Knuth and Plass, Optimal Punctuation, 1981",
            "Knuth, The TeXbook, Chapter 14",
        ],
        workedExample:
            "For words of lengths 3, 5, 3 at width 9, putting the first two words on one line leaves 1 space of badness, while putting only the first leaves 3 squared badness. The dynamic program picks the cheaper first break and then packs the rest, reporting the chosen lines and their total badness.",
    },
    id: "knuth-plass",
    name: "Knuth-Plass Line Breaking",
    category: "dynamic-programming",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        words: ["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog"],
        lineWidth: 12,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set the cost past the last word to zero",
        "for each word position from the end backward, measure candidate line lengths",
        "compute squared badness for a line ending here",
        "add the already known optimal cost of the remaining suffix",
        "keep the smallest total and remember where the line breaks",
        "follow the remembered breaks to reconstruct the paragraph",
        "done: report the chosen lines and total badness",
    ],
};

export default module;
