/**
 * jonker-volgenant-algorithm.ts - Jonker-Volgenant Assignment
 *
 * A shortest-augmenting-path implementation of the linear assignment problem
 * tuned for dense matrices. Row and column potentials keep reduced costs
 * nonnegative; each row is inserted with a Dijkstra-style search over columns
 * followed by a single augmenting-path flip.
 *
 * Time: O(n^3) for an n by n matrix. Space: O(n^2).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Task = { costs?: number[][] };

function makeCells(costs: number[][], states: Map<string, EntityState>): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < costs.length; row += 1) {
        const line = costs[row] ?? [];
        for (let col = 0; col < line.length; col += 1) {
            const value = line[col] ?? 0;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? "unvisited",
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
    const task = (input as Task | null) ?? {};
    const costs = (Array.isArray(task.costs) ? task.costs : [[8, 4, 7], [5, 2, 3], [9, 4, 8]])
        .filter((row) => Array.isArray(row))
        .map((row) => [...row]);
    const n = costs.length;
    const m = costs[0]?.length ?? 0;
    if (n === 0 || m < n) {
        yield {
            stepNumber: 0,
            entities: makeCells(costs, new Map()),
            edges: [],
            description: n === 0
                ? "Empty cost matrix - there is no assignment to compute."
                : "Fewer columns than rows - no perfect assignment exists.",
            codeLineNumber: 0,
            layout: "matrix",
            meta: { assigned: 0, totalCost: 0, augmentations: 0 },
        };
        return;
    }

    const u = new Array<number>(n + 1).fill(0);
    const v = new Array<number>(m + 1).fill(0);
    const p = new Array<number>(m + 1).fill(0);
    const way = new Array<number>(m + 1).fill(0);
    const frames: VisualFrame[] = [];
    let step = 0;
    let augmentations = 0;
    let scans = 0;

    const assignment = (): Array<[number, number]> => {
        const pairs: Array<[number, number]> = [];
        for (let col = 1; col <= m; col += 1) {
            const row = p[col] ?? 0;
            if (row > 0) {
                pairs.push([row - 1, col - 1]);
            }
        }
        return pairs;
    };
    const totalCost = (): number =>
        assignment().reduce((sum, [row, col]) => sum + (costs[row]?.[col] ?? 0), 0);

    const emit = (activeRow: number, activeCol: number, description: string, codeLineNumber: number): void => {
        const states = new Map<string, EntityState>();
        for (const [row, col] of assignment()) {
            states.set(`${row},${col}`, "sorted");
        }
        if (activeRow >= 0 && activeCol >= 0) {
            const key = `${activeRow},${activeCol}`;
            if (states.get(key) !== "sorted") {
                states.set(key, "comparing");
            }
        }
        frames.push({
            stepNumber: step,
            entities: makeCells(costs, states),
            edges: [],
            description,
            codeLineNumber,
            layout: "matrix",
            meta: {
                rows: n,
                cols: m,
                augmentations,
                scans,
                assigned: assignment().length,
                totalCost: totalCost(),
            },
        });
        step += 1;
    };

    emit(-1, -1, `Jonker-Volgenant assignment on a ${n} by ${m} cost matrix.`, 0);

    for (let i = 1; i <= n; i += 1) {
        p[0] = i;
        let j0 = 0;
        const minv = new Array<number>(m + 1).fill(Infinity);
        const used = new Array<boolean>(m + 1).fill(false);
        let guard = 0;
        do {
            guard += 1;
            used[j0] = true;
            const i0 = p[j0] ?? 0;
            let delta = Infinity;
            let j1 = -1;
            for (let col = 1; col <= m; col += 1) {
                if (used[col]) {
                    continue;
                }
                scans += 1;
                const current = (costs[i0 - 1]?.[col - 1] ?? 0) - (u[i0] ?? 0) - (v[col] ?? 0);
                if (current < (minv[col] ?? Infinity)) {
                    minv[col] = current;
                    way[col] = j0;
                }
                if ((minv[col] ?? Infinity) < delta) {
                    delta = minv[col] ?? Infinity;
                    j1 = col;
                }
            }
            if (j1 < 0 || delta === Infinity) {
                break;
            }
            for (let col = 0; col <= m; col += 1) {
                if (used[col]) {
                    u[p[col] ?? 0] = (u[p[col] ?? 0] ?? 0) + delta;
                    v[col] = (v[col] ?? 0) - delta;
                } else {
                    minv[col] = (minv[col] ?? Infinity) - delta;
                }
            }
            emit(i0 - 1, j1 - 1, `Row ${i0 - 1} scanned column ${j1 - 1}; potentials shifted by ${delta}.`, 3);
            j0 = j1;
        } while ((p[j0] ?? 0) !== 0 && guard <= m + 1);

        let flipGuard = 0;
        while (j0 !== 0 && flipGuard < m + 1) {
            flipGuard += 1;
            const j1 = way[j0] ?? 0;
            p[j0] = p[j1] ?? 0;
            j0 = j1;
        }
        augmentations += 1;
        emit(i - 1, -1, `Augmented row ${i - 1}; ${assignment().length} row(s) now assigned.`, 5);
    }

    emit(-1, -1, `Optimal assignment has total cost ${totalCost()}.`, 6);
    yield* frames;
}

const module: AlgorithmModule = {
    id: "jonker-volgenant-algorithm",
    name: "Jonker-Volgenant Assignment Algorithm",
    category: "flow",
    complexity: { time: "O(n³)", space: "O(n²)" },
    defaultInput: { costs: [[8, 4, 7], [5, 2, 3], [9, 4, 8]] },
    visualType: "matrix",
    run,
    pseudocode: [
        "initialize row and column potentials and an empty assignment",
        "insert the next row as a shortest-path source",
        "scan unvisited columns and track the minimum reduced cost",
        "shift potentials by the minimum to create a zero reduced cost",
        "follow predecessor columns until a free column is reached",
        "flip the augmenting path to assign the new row",
        "read the assignment from the column owners",
        "report the minimum total cost",
    ],
    education: {
        intuition:
            "The Jonker-Volgenant method is the shortest-augmenting-path form of Hungarian assignment. Potentials play the role of row and column prices; each new row is matched by growing a tree of columns with minimum reduced cost until a free column is found, then one path flip extends the matching.",
        invariants: [
            "Every reduced cost equals the true cost minus the two potentials and is never negative.",
            "Each column is owned by at most one row during the augmentation loop.",
            "An augmenting path flip increases the number of assigned rows by exactly one.",
        ],
        correctness:
            "Nonnegative reduced costs make the column search a valid Dijkstra computation, so the first free column reached is the cheapest augmentation available. Extending a minimum-cost matching along a shortest augmenting path preserves optimality for the enlarged set of rows by the standard primal-dual argument. After all rows are inserted the assignment is optimal.",
        complexityRationale:
            "Each of the n insertions scans up to m columns and may repeat at most m times, so dense square input costs O(n^3). The cost matrix, potentials, column owners, and predecessor array occupy O(n^2) space in total.",
        uses: [
            "Dense linear assignment in tracking and data association",
            "Solving many small assignment subproblems in branch and bound",
            "A faster practical alternative to the line-cover Hungarian variant",
        ],
        references: [
            "Jonker and Volgenant, A Shortest Augmenting Path Algorithm for Dense and Sparse Linear Assignment Problems, 1987",
            "Kuhn, The Hungarian Method for the Assignment Problem, 1955",
        ],
        workedExample:
            "On costs [[8,4,7],[5,2,3],[9,4,8]] the first augmentation gives row one column one, the second moves it to column two and assigns row two column one, and the third reassigns the rows so row one takes column zero, row two column two, and row three column one. The final cost is 8+3+4 = 15.",
    },
};

export default module;
