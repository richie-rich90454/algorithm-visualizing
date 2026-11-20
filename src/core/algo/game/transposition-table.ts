/**
 * transposition-table.ts - Transposition Table
 *
 * A transposition table caches the result of a searched position so the same
 * position reached by a different move order is not analyzed again. Each entry
 * stores the value plus a flag saying whether it is exact, a lower bound, or an
 * upper bound; a probe can return immediately when the stored bound is tight
 * enough for the current alpha-beta window.
 *
 * Time O(b^(d/2)) with reuse; space O(number of positions stored).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Flag = "EXACT" | "LOWER" | "UPPER";
interface Entry { value: number; depth: number; flag: Flag }

function depthOf(size: number): number {
    let d = 0;
    let n = 1;
    while (n * 2 <= size) {
        n *= 2;
        d += 1;
    }
    return d;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { leaves?: number[] } | null) ?? {};
    const supplied = Array.isArray(task.leaves) && task.leaves.length >= 2 ? task.leaves : [3, 5, 2, 6, 1, 4, 7, 2];
    const depth = depthOf(supplied.length);
    const leaves = supplied.slice(0, 2 ** depth).map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0));
    const firstLeaf = 2 ** depth;
    const total = 2 ** (depth + 1) - 1;
    const table = new Map<string, Entry>();
    let stores = 0;
    let hits = 0;
    let probes = 0;

    const cells = (): VisualEntity[] =>
        Array.from({ length: total }, (_, i) => i + 1).map((idx) => {
            const e = table.get(`node-${idx}`);
            return {
                id: `cell-${idx}`,
                type: "cell" as const,
                label: e ? `${e.value}/${e.flag[0]}` : String(idx),
                value: e ? e.value : idx,
                state: (e ? (e.flag === "EXACT" ? "sorted" : "highlight") : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: Math.floor((idx - 1) / 4), col: (idx - 1) % 4, index: idx },
            };
        });

    const alphaBeta = (i: number, alpha0: number, beta0: number, isMax: boolean, d: number): number => {
        const key = `node-${i}`;
        probes += 1;
        const entry = table.get(key);
        if (entry && entry.depth >= d) {
            if (entry.flag === "EXACT") {
                hits += 1;
                return entry.value;
            }
            if (entry.flag === "LOWER" && entry.value >= beta0) {
                hits += 1;
                return entry.value;
            }
            if (entry.flag === "UPPER" && entry.value <= alpha0) {
                hits += 1;
                return entry.value;
            }
        }
        if (i >= firstLeaf) return leaves[i - firstLeaf] ?? 0;
        const originalAlpha = alpha0;
        let alpha = alpha0;
        let beta = beta0;
        let value: number;
        if (isMax) {
            value = -Infinity;
            for (const child of [i * 2, i * 2 + 1]) {
                if (child > total) continue;
                value = Math.max(value, alphaBeta(child, alpha, beta, false, d - 1));
                alpha = Math.max(alpha, value);
                if (alpha >= beta) break;
            }
        } else {
            value = Infinity;
            for (const child of [i * 2, i * 2 + 1]) {
                if (child > total) continue;
                value = Math.min(value, alphaBeta(child, alpha, beta, true, d - 1));
                beta = Math.min(beta, value);
                if (alpha >= beta) break;
            }
        }
        const flag: Flag = value <= originalAlpha ? "UPPER" : value >= beta0 ? "LOWER" : "EXACT";
        table.set(key, { value, depth: d, flag });
        stores += 1;
        return value;
    };

    let step = 0;
    yield {
        stepNumber: step, entities: cells(), edges: [],
        description: `Transposition table on a depth-${depth} tree; each slot holds a value, depth, and bound flag.`,
        codeLineNumber: 0, layout: "grid",
        meta: { depth, leaves: [...leaves], slots: total, rows: 2, cols: 4, stores: 0, hits: 0, probes: 0 },
    };
    step += 1;

    const firstValue = alphaBeta(1, -Infinity, Infinity, true, depth);
    yield {
        stepNumber: step, entities: cells(), edges: [],
        description: `First search stored ${stores} node result(s), including root value ${firstValue}, in the table.`,
        codeLineNumber: 4, layout: "grid",
        meta: { pass: 1, value: firstValue, stores, hits, probes, rows: 2, cols: 4 },
    };
    step += 1;

    const secondValue = alphaBeta(1, -Infinity, Infinity, true, depth);
    yield {
        stepNumber: step, entities: cells(), edges: [],
        description: `Second search reused ${hits} cached bound(s) and returned ${secondValue} without re-analyzing known positions.`,
        codeLineNumber: 5, layout: "grid",
        meta: { pass: 2, value: secondValue, stores, hits, probes, rows: 2, cols: 4 },
    };
    step += 1;

    yield {
        stepNumber: step, entities: cells(), edges: [],
        description: `Both searches returned ${secondValue}; ${hits} probe(s) hit cached entries out of ${probes} total probes.`,
        codeLineNumber: 6, layout: "grid",
        meta: { value: secondValue, optimal: secondValue, firstValue, stores, hits, probes, entries: table.size, rows: 2, cols: 4 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Many move orders transpose into the same position. A transposition table remembers what was learned about a position the first time it was searched, so a later visit can reuse the answer instead of redoing the work. Storing whether the score was exact or only a bound tells us when reuse is safe for the current window.",
        invariants: [
            "A table entry records a value, the depth searched, and an exact, lower, or upper flag.",
            "An exact entry is returned directly; bound entries are returned only when they settle the window.",
            "The cached value for a position never depends on the path used to reach it.",
        ],
        correctness:
            "Fail-soft alpha-beta classifies its result relative to the original window: below alpha is an upper bound, at or above beta is a lower bound, and in between is exact. Returning an exact value is always correct, and returning a bound is correct only when it already proves a cutoff or fail-low for the current window. Reuse therefore preserves the minimax value, which is why both searches return the same score.",
        complexityRationale:
            "A probe and store are constant-time hash operations; with many transpositions the effective search tree shrinks dramatically, approaching O(b^(d/2)) with good ordering while the table uses O(positions) space.",
        uses: [
            "Chess engines where move transpositions are common",
            "Any search over a graph rather than a pure tree",
            "Iterative deepening that reuses earlier iteration results",
        ],
        references: [
            "Slate and Atkin, Chess 4.5 - The Northwestern University Chess Program (1977)",
            "Knuth and Moore, An Analysis of Alpha-Beta Pruning (1975)",
        ],
        workedExample:
            "Reaching a position by move order A-B and later by B-A produces the same key. If the first visit stored an exact value of 5, the second visit returns 5 immediately. If it stored only a lower bound of 7 and beta is 6, that still proves a cutoff, so the bound is returned safely.",
    },
    id: "transposition-table",
    name: "Transposition Table",
    category: "game",
    complexity: { time: "O(b^(d/2)) with reuse", space: "O(positions stored)" },
    defaultInput: { leaves: [3, 5, 2, 6, 1, 4, 7, 2] },
    visualType: "grid",
    run,
    pseudocode: [
        "create an empty table indexed by position key",
        "before searching a node, probe its table entry",
        "return an exact value or a conclusive bound immediately",
        "otherwise search the children with alpha-beta",
        "classify the result as exact, lower, or upper bound",
        "store the value, depth, and flag for later visits",
        "report the root value and the table reuse statistics",
    ],
};

export default module;
