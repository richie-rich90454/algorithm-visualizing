/**
 * strip-packing-dp.ts - Strip Packing / Bin Packing (Bitmask DP)
 *
 * Given item widths and a strip of fixed capacity, pack every item into the
 * fewest strips so that the widths placed in one strip never exceed its
 * capacity. A bitmask DP tries every group containing the lowest remaining
 * item and reuses the optimal answer for the items left over.
 *
 * Time: O(3^n). Space: O(2^n).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    widths?: number[];
    capacity?: number;
}

function buildCells(
    values: number[],
    n: number,
    cols: number,
    active?: number,
): VisualEntity[] {
    return values.map((value, mask) => ({
        id: `cell-${mask}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: (active === mask
            ? "comparing"
            : value > 0
              ? "visited"
              : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(mask / cols), col: mask % cols, mask, strips: value, n },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const widthsInput = Array.isArray(task.widths) ? task.widths.map((w) => Number(w)) : [2, 3, 1, 4, 2, 3];
    const widths = widthsInput.slice(0, 6).map((w) => (Number.isFinite(w) ? Math.max(1, Math.floor(w)) : 1));
    const capacity = Math.max(1, Math.floor(typeof task.capacity === "number" ? task.capacity : 5));
    const n = widths.length;
    const size = 1 << n;
    const cols = 1 << Math.ceil(n / 2);
    const rows = 1 << Math.floor(n / 2);
    const INF = 1e9;

    if (widths.some((w) => w > capacity)) {
        yield {
            stepNumber: 0,
            entities: buildCells(new Array<number>(size).fill(-1), n, cols),
            edges: [],
            description: "An item is wider than the strip capacity, so no packing exists.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { n, capacity, rows, cols, answer: -1, widths, strips: [] },
        };
        return;
    }

    const sum = new Array<number>(size).fill(0);
    for (let mask = 1; mask < size; mask += 1) {
        const bit = mask & -mask;
        const idx = 31 - Math.clz32(bit);
        sum[mask] = (sum[mask ^ bit] ?? 0) + (widths[idx] ?? 0);
    }

    const dp = new Array<number>(size).fill(INF);
    dp[0] = 0;
    let step = 0;
    yield {
        stepNumber: step,
        entities: buildCells(dp.map((v) => (v >= INF ? -1 : v)), n, cols),
        edges: [],
        description: `Start with ${n} items and capacity ${capacity}; dp[0] = 0 strips and all other states are unknown.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, capacity, rows, cols, answer: -1, widths, strips: [] },
    };
    step += 1;

    for (let mask = 1; mask < size; mask += 1) {
        const low = mask & -mask;
        let best = INF;
        let sub = mask;
        while (sub > 0) {
            if ((sub & low) !== 0) {
                const rest = mask ^ sub;
                const groupSum = (sum[mask] ?? 0) - (sum[rest] ?? 0);
                if (groupSum <= capacity) {
                    const candidate = (dp[rest] ?? INF) + 1;
                    if (candidate < best) best = candidate;
                }
            }
            sub = (sub - 1) & mask;
        }
        dp[mask] = best;
        yield {
            stepNumber: step,
            entities: buildCells(
                dp.map((v) => (v >= INF ? -1 : v)),
                n,
                cols,
                mask,
            ),
            edges: [],
            description: `Subset ${mask} (total width ${sum[mask]}) needs ${dp[mask] >= INF ? "no valid packing yet" : String(dp[mask]) + " strip(s)"}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                n,
                capacity,
                rows,
                cols,
                answer: dp[mask] >= INF ? -1 : dp[mask],
                widths,
                strips: [],
            },
        };
        step += 1;
    }

    const answer = dp[size - 1] ?? INF;
    yield {
        stepNumber: step,
        entities: buildCells(
            dp.map((v) => (v >= INF ? -1 : v)),
            n,
            cols,
        ),
        edges: [],
        description: `Done: all ${n} items fit into ${answer} strip(s) of capacity ${capacity}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            n,
            capacity,
            rows,
            cols,
            answer: answer >= INF ? -1 : answer,
            widths,
            strips: [],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A strip is one group of items whose widths add up to at most the capacity. For a set of remaining items, focus on the smallest indexed item: it must share a strip with some collection of the others. Try every such collection, count one strip for it, and add the best answer for the items left over.",
        invariants: [
            "dp[mask] is the fewest strips needed to pack exactly the items in mask.",
            "sum[mask] is the total width of the items in mask and never depends on their order.",
            "Every transition removes at least the lowest set bit, so it reads only smaller, already solved states.",
        ],
        correctness:
            "Consider any optimal packing of mask and the strip containing the lowest indexed item. That strip holds some submask s of mask, whose width is at most the capacity; the other items form mask without s and must be packed optimally. Hence dp[mask] is one plus the minimum dp[mask minus s] over all feasible s. Enumerating every s that contains the lowest bit covers all packings exactly once up to strip order, and dp[0] = 0 anchors the induction.",
        complexityRationale:
            "A set of n items has 2^n states, and enumerating submasks over all states visits each ordered pair of nested subsets once, O(3^n) time. Two arrays of size 2^n hold the sums and answers, so space is O(2^n).",
        uses: [
            "Cutting raw material into the fewest standard lengths",
            "Packing requests into fixed-size memory pages or network frames",
            "A teaching bridge from subset DP to NP-hard partition problems",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 15",
            "Martello and Toth, Bin-Packing Problems, 1990",
        ],
        workedExample:
            "With widths 2, 3, 1, 4 and capacity 5, the item of width 4 pairs with 1 and the two items of width 2 and 3 fill a second strip, so all four items use two strips.",
    },
    id: "strip-packing-dp",
    name: "Strip Packing / Bin Packing (Bitmask DP)",
    category: "dynamic-programming",
    complexity: { time: "O(3^n)", space: "O(2^n)" },
    defaultInput: { widths: [2, 3, 1, 4, 2, 3], capacity: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the item widths and the strip capacity C",
        "let n be the item count and size be one shifted left by n",
        "set dp[0] = 0 and every other dp value to a large sentinel",
        "for each mask from 1 to size minus one, compute the total width sum[mask]",
        "for every submask s of mask containing the lowest set bit",
        "if sum[s] is at most C, relax dp[mask] with one plus dp[mask without s]",
        "report dp[size-1] as the fewest strips needed",
    ],
};

export default module;
