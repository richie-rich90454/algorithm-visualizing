/**
 * Min cuts for palindromic partition: cuts[i] = min cuts[j-1]+1.
 * Time O(n^2), Space O(n^2). Default "aab" -> 1 cut.
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const raw = (input as { s?: string } | null) ?? {};
    const s = typeof raw.s === "string" ? raw.s : "aab";
    let step = 0;
    if (s.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty string \u2013 zero cuts.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const n = s.length;
    const isPal: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = i; j < n; j += 1) {
            if (s[i] === s[j] && (j - i < 2 || (isPal[i + 1]?.[j - 1] ?? 0) === 1)) isPal[i][j] = 1;
        }
    }
    const cuts: number[] = new Array<number>(n).fill(0);
    yield {
        stepNumber: step,
        entities: makeCells([[...cuts]]),
        edges: [],
        description: `Min cuts for "${s}". cuts[0] = 0.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells([[...cuts]]),
        edges: [],
        description: `Palindrome table seeded: single chars are palindromes.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let i = 1; i < n; i += 1) {
        if ((isPal[0]?.[i] ?? 0) === 1) {
            cuts[i] = 0;
        } else {
            let best = n;
            for (let j = 1; j <= i; j += 1) {
                if ((isPal[j]?.[i] ?? 0) === 1 && (cuts[j - 1] ?? 0) + 1 < best)
                    best = (cuts[j - 1] ?? 0) + 1;
            }
            cuts[i] = best;
        }
        const states = new Map<string, EntityState>([[`0,${i}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells([[...cuts]], states),
            edges: [],
            description: `cuts[${i}] = ${cuts[i]} for "${s.slice(0, i + 1)}".`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells([[...cuts]], new Map([[`0,${n - 1}`, "sorted"]])),
        edges: [],
        description: `Traceback: "${s}" needs ${cuts[n - 1]} cut(s).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer: cuts[n - 1] },
    };
}

const module: AlgorithmModule = {
    id: "palindrome-partitioning-min-cuts",
    name: "Palindrome Partitioning (Min Cuts)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n\u00b2)" },
    defaultInput: { s: "aab" },
    visualType: "grid",
    run,
};

export default module;
