/**
 * longest-repeating-subsequence.ts - Longest Repeating Subsequence (LRS)
 *
 * Finds the longest subsequence that occurs in a string in at least two
 * different ways, meaning the two copies use disjoint sets of positions but
 * keep the left-to-right order. It is the two-sequence LCS recurrence applied
 * to the string with itself, with the extra constraint i != j so a character
 * cannot pair with itself.
 *
 * Time: O(n^2). Space: O(n^2) for the DP matrix used by the visualization.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LrsResult {
    matrix: number[][];
    length: number;
    sequence: string;
    path: Array<[number, number]>;
}

/** Compute the LRS matrix and one reconstructed witness via diagonal DP. */
function solveLrs(text: string): LrsResult {
    const n = text.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = n - 1; j > i; j -= 1) {
            if (text[i] === text[j]) {
                matrix[i] = matrix[i] ?? [];
                matrix[i][j] = (matrix[i + 1]?.[j + 1] ?? 0) + 1;
            } else {
                matrix[i] = matrix[i] ?? [];
                matrix[i][j] = Math.max(matrix[i + 1]?.[j] ?? 0, matrix[i]?.[j + 1] ?? 0);
            }
        }
    }
    let length = 0;
    let startJ = -1;
    for (let j = 1; j < n; j += 1) {
        const value = matrix[0]?.[j] ?? 0;
        if (value > length) {
            length = value;
            startJ = j;
        }
    }
    const path: Array<[number, number]> = [];
    let sequence = "";
    let i = 0;
    let j = startJ;
    while (length > 0 && j >= 0 && i < n && j < n) {
        const diagonal = matrix[i + 1]?.[j + 1] ?? 0;
        if (text[i] === text[j] && (matrix[i]?.[j] ?? 0) === diagonal + 1) {
            path.push([i, j]);
            sequence += text[i];
            i += 1;
            j += 1;
            length -= 1;
        } else if ((matrix[i + 1]?.[j] ?? 0) >= (matrix[i]?.[j + 1] ?? 0)) {
            i += 1;
        } else {
            j += 1;
        }
    }
    return { matrix, length: sequence.length, sequence, path };
}

function makeCells(
    result: LrsResult,
    text: string,
    currentRow: number,
    path: Array<[number, number]> = [],
): VisualEntity[] {
    const n = text.length;
    const onPath = new Set(path.map(([a, b]) => `${a},${b}`));
    const cells: VisualEntity[] = [];
    for (let row = 0; row < n; row += 1) {
        const line = result.matrix[row] ?? [];
        for (let col = 0; col < n; col += 1) {
            const value = line[col] ?? 0;
            let state: EntityState = "idle";
            if (onPath.has(`${row},${col}`)) {
                state = "path";
            } else if (currentRow >= 0 && row === currentRow && col > row) {
                state = "comparing";
            } else if (currentRow >= 0 && row > currentRow) {
                state = "visited";
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, leftChar: text[row] ?? "", topChar: text[col] ?? "" },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { s?: string } | null) ?? {};
    const text = typeof task.s === "string" ? task.s.slice(0, 12) : "abcabc";
    const result = solveLrs(text);
    const n = text.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(result, text, -1),
        edges: [],
        description: `Solving longest repeating subsequence of "${text}" by comparing the string with itself under i not equal to j.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, answer: 0, sequence: "", text },
    };
    step += 1;

    for (let i = n - 1; i >= 0; i -= 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result, text, i),
            edges: [],
            description: `Filling row ${i}: matching suffixes copy the diagonal plus one, otherwise take the larger of the two suffixes below and to the right.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: n, cols: n, answer: 0, sequence: "", row: i, text },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result, text, -1, result.path),
        edges: [],
        description: `Longest repeating subsequence is "${result.sequence}" with length ${result.length}, traced along the highlighted diagonal.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: n,
            cols: n,
            answer: result.length,
            sequence: result.sequence,
            path: result.path.map(([a, b]) => `${a}:${b}`),
            text,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A repeating subsequence appears twice using different characters of the same string. Compare the string against itself with the classic longest-common-subsequence table, but forbid a position from pairing with itself by only filling the strict upper triangle. Equal characters extend the diagonal match by one.",
        invariants: [
            "Cell (i, j) for i < j holds the longest repeating subsequence of the suffixes starting at i and at j.",
            "Only cells with i < j are meaningful; every character must come from two distinct positions.",
            "Rows are filled from the bottom up so each diagonal dependency is final before it is read.",
        ],
        correctness:
            "When text[i] equals text[j] those two distinct positions can be used together, giving one plus the best answer on the suffixes i+1 and j+1. When they differ, one of the two positions must be skipped, so the best value is the maximum of the two neighboring states. The maximum entry in the top row is therefore the longest subsequence realizable in two disjoint copies of the string.",
        complexityRationale:
            "There are n squared upper-triangle states and each takes constant time, giving O(n^2) time and O(n^2) space for the full matrix. A rolling row would reduce space to O(n) if the witness is not needed.",
        uses: [
            "Detecting repeated structure in biological sequences",
            "Measuring self-similarity in strings and time series",
            "A teaching bridge between LCS and constrained DP on a single input",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 15 (LCS)",
            "Gusfield, Algorithms on Strings, Trees and Sequences, Chapter 11",
        ],
        workedExample:
            "For abcabc the table finds matches at positions 0 with 3, 1 with 4, and 2 with 5, so the diagonal contributes three characters and the longest repeating subsequence is abc.",
    },
    id: "longest-repeating-subsequence",
    name: "Longest Repeating Subsequence",
    category: "dynamic-programming",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { s: "abcabc" },
    visualType: "grid",
    run,
    pseudocode: [
        "read string s of length n and allocate an n by n table of zeros",
        "for i from n-1 down to 0",
        "for j from n-1 down to i+1",
        "if s[i] equals s[j] set table[i][j] to table[i+1][j+1] plus one",
        "else set table[i][j] to the larger of table[i+1][j] and table[i][j+1]",
        "answer is the maximum table[0][j] over j greater than zero",
        "walk back along equal-character diagonal steps to print the subsequence",
    ],
};

export default module;
