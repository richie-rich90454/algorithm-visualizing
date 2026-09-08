/**
 * Maximal Rectangle: row histograms + monotonic stack largest rectangle.
 * Time O(m*n), Space O(n). Default -> area 6.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const r = matrix[row];
        if (!r) continue;
        for (let col = 0; col < r.length; col += 1) {
            const value = r[col];
            if (value === undefined) continue;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

function largestRect(heights: number[]): number {
    const hs = [...heights, 0];
    const stack: number[] = [];
    let best = 0;
    for (let i = 0; i < hs.length; i += 1) {
        while (stack.length > 0 && (hs[stack[stack.length - 1] as number] ?? 0) > (hs[i] ?? 0)) {
            const h = hs[stack.pop() as number] ?? 0;
            const left = stack.length === 0 ? 0 : (stack[stack.length - 1] as number) + 1;
            const area = h * (i - left);
            if (area > best) best = area;
        }
        stack.push(i);
    }
    return best;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: string[][] } | null) ?? {};
    const matrix = task.matrix ?? [
        ["1", "0", "1", "0", "0"],
        ["1", "0", "1", "1", "1"],
        ["1", "1", "1", "1", "1"],
        ["1", "0", "0", "1", "0"],
    ];
    let step = 0;
    if (matrix.length === 0 || (matrix[0] ?? []).length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty matrix \u2013 area 0.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const m = matrix.length;
    const cols = (matrix[0] ?? []).length;
    const heights: number[][] = Array.from({ length: m }, () => new Array<number>(cols).fill(0));
    let best = 0;
    yield {
        stepNumber: step,
        entities: makeCells(heights),
        edges: [],
        description: `Largest all-'1' rectangle in ${m}x${cols} via column histograms.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m, cols },
    };
    step += 1;
    for (let i = 0; i < m; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            heights[i][j] =
                (matrix[i]?.[j] ?? "0") === "1" ? (i > 0 ? (heights[i - 1]?.[j] ?? 0) : 0) + 1 : 0;
        }
        const rowBest = largestRect(heights[i] ?? []);
        if (rowBest > best) best = rowBest;
        const states = new Map<string, EntityState>([[`${i},${cols - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(heights, states),
            edges: [],
            description: `Row ${i} histogram: best ${rowBest}; global ${best}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { m, cols },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(heights),
        edges: [],
        description: `Traceback: max rectangle area = ${best}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer: best },
    };
}

const module: AlgorithmModule = {
    id: "maximal-rectangle-binary-matrix",
    name: "Maximal Rectangle (Binary Matrix)",
    category: "dynamic-programming",
    complexity: { time: "O(m\u00b7n)", space: "O(n)" },
    defaultInput: {
        matrix: [
            ["1", "0", "1", "0", "0"],
            ["1", "0", "1", "1", "1"],
            ["1", "1", "1", "1", "1"],
            ["1", "0", "0", "1", "0"],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
