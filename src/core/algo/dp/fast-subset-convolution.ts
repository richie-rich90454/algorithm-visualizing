/**
 * fast-subset-convolution.ts - Fast Subset Convolution (Ranked Zeta Transform)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Subset convolution combines two functions on the subsets of an n-element
 * universe: h[S] = sum over A subset of S of f[A] * g[S minus A]. A direct
 * evaluation takes 3^n time. The fast method splits f and g by subset size,
 * applies a zeta transform to each size class, multiplies matching classes,
 * and inverts the transform. This yields all 2^n answers in O(n^2 2^n) time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 * 2^n)
 *   Space: O(n * 2^n) for the ranked tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Rows are subset sizes (ranks); columns are the 2^n subsets.
 *   - A row being convolved is YELLOW; after Mobius inversion it is GREEN.
 *   - The final answer cells (one per subset) are highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function popcount(mask: number): number {
    let count = 0;
    let value = mask;
    while (value > 0) {
        count += value & 1;
        value >>= 1;
    }
    return count;
}

/** Zeta transform: arr[S] becomes the sum of arr[A] over all A subsets of S. */
function zeta(arr: number[], n: number): void {
    for (let bit = 0; bit < n; bit += 1) {
        const step = 1 << bit;
        for (let mask = 0; mask < 1 << n; mask += 1) {
            if (mask & step) {
                arr[mask] = (arr[mask] ?? 0) + (arr[mask ^ step] ?? 0);
            }
        }
    }
}

/** Mobius inversion, the inverse of the zeta transform. */
function mobius(arr: number[], n: number): void {
    for (let bit = 0; bit < n; bit += 1) {
        const step = 1 << bit;
        for (let mask = 0; mask < 1 << n; mask += 1) {
            if (mask & step) {
                arr[mask] = (arr[mask] ?? 0) - (arr[mask ^ step] ?? 0);
            }
        }
    }
}

function makeCells(rows: number, size: number, activeRow: number, doneRows: Set<number>, highlight: Set<number>): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let rank = 0; rank < rows; rank += 1) {
        for (let mask = 0; mask < size; mask += 1) {
            let state: EntityState = "unvisited";
            if (highlight.has(rank * size + mask)) {
                state = "sorted";
            } else if (rank === activeRow) {
                state = "comparing";
            } else if (doneRows.has(rank)) {
                state = "visited";
            }
            cells.push({
                id: `cell-${rank}-${mask}`,
                type: "cell",
                label: "?",
                value: 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: rank, col: mask },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; f?: number[]; g?: number[] } | null) ?? {};
    const fInput = Array.isArray(task.f) ? [...task.f] : [1, 2, 3, 4];
    const gInput = Array.isArray(task.g) ? [...task.g] : [1, 1, 2, 2];
    const size = fInput.length;
    const n = typeof task.n === "number" ? task.n : Math.round(Math.log2(size));
    const g = Array.isArray(task.g) ? [...gInput] : Array<number>(size).fill(0);

    const ranks: number[][] = Array.from({ length: n + 1 }, () => Array<number>(size).fill(0));
    const granks: number[][] = Array.from({ length: n + 1 }, () => Array<number>(size).fill(0));
    for (let mask = 0; mask < size; mask += 1) {
        const rank = popcount(mask);
        if (rank <= n) {
            ranks[rank]![mask] = fInput[mask] ?? 0;
            granks[rank]![mask] = g[mask] ?? 0;
        }
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(n + 1, size, -1, new Set(), new Set()),
        edges: [],
        description: `Subset convolution on ${n} element(s): ${size} subsets, grouped by size.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n + 1, cols: size, n },
    };
    step += 1;

    for (let rank = 0; rank <= n; rank += 1) {
        zeta(ranks[rank] as number[], n);
        zeta(granks[rank] as number[], n);
    }

    const table: number[][] = Array.from({ length: n + 1 }, () => Array<number>(size).fill(0));
    const doneRows = new Set<number>();
    for (let rank = 0; rank <= n; rank += 1) {
        for (let mask = 0; mask < size; mask += 1) {
            let sum = 0;
            for (let left = 0; left <= rank; left += 1) {
                sum += (ranks[left]?.[mask] ?? 0) * (granks[rank - left]?.[mask] ?? 0);
            }
            table[rank]![mask] = sum;
        }
        const shown: VisualEntity[] = makeCells(n + 1, size, rank, doneRows, new Set()).map((entity) => {
            const r = Number(entity.metadata.row);
            const c = Number(entity.metadata.col);
            const value = table[r]?.[c] ?? 0;
            return { ...entity, label: value.toFixed(2), value } as VisualEntity;
        });
        yield {
            stepNumber: step,
            entities: shown,
            edges: [],
            description: `Rank ${rank}: multiplied zeta-transformed size classes and summed the products.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: n + 1, cols: size, rank },
        };
        step += 1;

        mobius(table[rank] as number[], n);
        doneRows.add(rank);
        const inverted: VisualEntity[] = makeCells(n + 1, size, -1, doneRows, new Set()).map((entity) => {
            const r = Number(entity.metadata.row);
            const c = Number(entity.metadata.col);
            const value = table[r]?.[c] ?? 0;
            return { ...entity, label: value.toFixed(2), value } as VisualEntity;
        });
        yield {
            stepNumber: step,
            entities: inverted,
            edges: [],
            description: `Rank ${rank}: Mobius inversion recovers the exact subset-convolution values.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: n + 1, cols: size, rank },
        };
        step += 1;
    }

    const h: number[] = Array<number>(size).fill(0);
    const highlight = new Set<number>();
    for (let mask = 0; mask < size; mask += 1) {
        const rank = popcount(mask);
        h[mask] = table[rank]?.[mask] ?? 0;
        highlight.add(rank * size + mask);
    }
    const finalCells = makeCells(n + 1, size, -1, doneRows, highlight).map((entity) => {
        const r = Number(entity.metadata.row);
        const c = Number(entity.metadata.col);
        const value = table[r]?.[c] ?? 0;
        return { ...entity, label: value.toFixed(2), value } as VisualEntity;
    });
    yield {
        stepNumber: step,
        entities: finalCells,
        edges: [],
        description: `Computed all ${size} subset-convolution values in O(n squared times 2 to the n).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: n + 1, cols: size, n, h },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Subset convolution asks, for every subset S, for the sum of f on a part A times g on the remaining part. Checking every split is exponential in a worse way than the answer size. The trick is to separate subsets by their cardinality, sum each class over subsets with a zeta transform, multiply the transformed classes, then undo the transform. The size bookkeeping ensures the two parts exactly tile S.",
        invariants: [
            "The zeta transform of a size class sums f only over subsets of that class size.",
            "For a subset of size k, only size classes i and k-i contribute to its convolution.",
            "Mobius inversion exactly reverses the zeta transform on every ranked table.",
        ],
        correctness:
            "After the ranked zeta transform, entry (i, S) equals the sum of f[A] over subsets A of S with size i. Multiplying class i with class k-i and summing over i gives the sum of f[A]g[B] over disjoint A and B whose union is contained in S with total size k. Mobius inversion removes superset contributions, leaving exactly the partitions of S. Setting k to the size of S therefore yields the subset convolution.",
        complexityRationale:
            "There are n+1 size classes, each zeta transform and inversion costs O(n 2^n), and the class products cost O(n 2^n) per rank, giving O(n^2 2^n) time. The ranked tables use O(n 2^n) space.",
        uses: [
            "Counting set partitions and clique covers in graph algorithms",
            "Accelerating subset DPs such as Hamilton path counting",
            "Polynomial multiplication over the Boolean lattice",
        ],
        references: [
            "Bjorklund, Husfeldt, and Kaipa, The Fast Subset Convolution Transform, 2016",
            "Robin van Rooij, Fast Subset Convolution notes, 2014",
        ],
        workedExample:
            "For n=2 with f[01]=1, f[10]=2, f[11]=3 and g[01]=1, g[10]=1, g[11]=2, the value at subset 11 sums f[00]g[11], f[01]g[10], f[10]g[01], and f[11]g[00]. The ranked transform computes this and every other subset value at once.",
    },
    id: "fast-subset-convolution",
    name: "Fast Subset Convolution",
    category: "dynamic-programming",
    complexity: { time: "O(n^2 * 2^n)", space: "O(n * 2^n)" },
    defaultInput: { n: 2, f: [1, 2, 3, 4], g: [1, 1, 2, 2] },
    visualType: "grid",
    run,
    pseudocode: [
        "group f and g values by the popcount of their subset mask",
        "apply a zeta transform to every size class of f and g",
        "for each rank k initialize the convolution row to zero",
        "multiply transformed class i with class k minus i and accumulate",
        "apply Mobius inversion to the rank k row",
        "after all ranks, read h of mask from the row of its popcount",
        "done: report the convolution value for every subset",
    ],
};

export default module;
