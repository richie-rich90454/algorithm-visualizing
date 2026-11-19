/**
 * ac4-arc-consistency.ts – AC-4 Arc Consistency
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AC-4 enforces arc consistency on a binary constraint network by caching,
 * for every variable-value pair, the set of supporting values it has in each
 * neighboring domain and a counter of how many supports are still alive. When
 * a value is deleted, only the counters that relied on it are decremented, so
 * each support is examined a constant number of times overall. This makes the
 * propagation phase cheaper than the revise-and-requeue strategy of AC-3.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(e * d^2) to build supports, O(e * d) to propagate
 *   Space: O(e * d^2) for the stored support sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each cell is one (variable, value) pair in a grid.
 *   - A surviving value is BLUE; a deleted value is RED.
 *   - A value currently in the deletion queue is YELLOW.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Computes the unique greatest arc-consistent subproblem.
 *   - Terminates when the deletion queue is empty.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Constraint {
    a: string;
    b: string;
    pairs: Array<[number, number]>;
}

const key = (v: string, value: number): string => `${v}|${value}`;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { domains?: Record<string, number[]>; constraints?: Constraint[] } | null) ?? {};
    const source = task.domains ?? { A: [1, 2, 3], B: [1, 2, 3], C: [1, 2, 3] };
    const constraints: Constraint[] = task.constraints ?? [
        { a: "A", b: "B", pairs: [[1, 2], [2, 1], [3, 3]] },
        { a: "B", b: "C", pairs: [[1, 3], [2, 2], [3, 1]] },
    ];

    const original: Record<string, number[]> = {};
    const domains: Record<string, number[]> = {};
    for (const [variable, values] of Object.entries(source)) {
        original[variable] = [...values];
        domains[variable] = [...values];
    }
    const variables = Object.keys(domains);
    const cols = variables.reduce((max, v) => Math.max(max, (original[v] ?? []).length), 0);
    let pruned = 0;
    let step = 0;
    const queued = new Set<string>();

    const makeCells = (): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        variables.forEach((variable, row) => {
            (original[variable] ?? []).forEach((value, col) => {
                const k = key(variable, value);
                const alive = (domains[variable] ?? []).includes(value);
                const state: EntityState = !alive
                    ? "error"
                    : queued.has(k)
                        ? "comparing"
                        : "active";
                cells.push({
                    id: `cell-${variable}-${value}`,
                    type: "cell",
                    label: `${variable}=${value}`,
                    value: { variable, value },
                    state,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col, variable, value },
                });
            });
        });
        return cells;
    };

    const frame = (description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { rows: variables.length, cols, pruned },
    });

    yield frame("AC-4 begins with the full domain of every variable.", 0);

    // Directed allowed-pair tables and neighbor lists.
    const allowed = new Map<string, Set<string>>();
    const neighbors: Record<string, Set<string>> = {};
    for (const variable of variables) {
        neighbors[variable] = new Set<string>();
    }
    for (const c of constraints) {
        if (!domains[c.a] || !domains[c.b]) {
            continue;
        }
        neighbors[c.a]!.add(c.b);
        neighbors[c.b]!.add(c.a);
        const forward = new Set<string>();
        const backward = new Set<string>();
        for (const [x, y] of c.pairs) {
            forward.add(`${x}|${y}`);
            backward.add(`${y}|${x}`);
        }
        allowed.set(`${c.a}|${c.b}`, forward);
        allowed.set(`${c.b}|${c.a}`, backward);
    }

    // support[(x,v)] maps a neighbor y to the set of values w that support v.
    const support = new Map<string, Map<string, Set<number>>>();
    for (const variable of variables) {
        for (const value of domains[variable] ?? []) {
            support.set(key(variable, value), new Map<string, Set<number>>());
        }
    }
    for (const [arc, pairSet] of allowed) {
        const [a, b] = arc.split("|") as [string, string];
        for (const value of domains[a] ?? []) {
            const supports = new Set<number>();
            for (const other of domains[b] ?? []) {
                if (pairSet.has(`${value}|${other}`)) {
                    supports.add(other);
                }
            }
            support.get(key(a, value))?.set(b, supports);
        }
    }
    yield frame("Built a support set for every variable-value pair.", 1);

    // Count remaining supports and build the reverse dependency index.
    const count = new Map<string, number>();
    const reverse = new Map<string, Array<[string, number]>>();
    for (const [k, byNeighbor] of support) {
        let total = 0;
        for (const supports of byNeighbor.values()) {
            total += supports.size;
        }
        count.set(k, total);
        const [variable, valueText] = k.split("|") as [string, string];
        const value = Number(valueText);
        for (const [neighbor, supports] of byNeighbor) {
            for (const other of supports) {
                const rk = key(neighbor, other);
                const list = reverse.get(rk) ?? [];
                list.push([variable, value]);
                reverse.set(rk, list);
            }
        }
    }

    const queue: Array<[string, number]> = [];
    for (const [k, total] of count) {
        const [variable, valueText] = k.split("|") as [string, string];
        if (total === 0 && (neighbors[variable]?.size ?? 0) > 0) {
            queue.push([variable, Number(valueText)]);
            queued.add(k);
        }
    }
    yield frame(`Queued ${queue.length} unsupported value(s) for deletion.`, 2);

    while (queue.length > 0) {
        const [variable, value] = queue.shift() as [string, number];
        const k = key(variable, value);
        queued.delete(k);
        if (!(domains[variable] ?? []).includes(value)) {
            continue;
        }
        domains[variable] = (domains[variable] ?? []).filter((v) => v !== value);
        pruned += 1;
        yield frame(`Deleted ${variable}=${value} because it lost all support.`, 3);

        for (const [depVar, depValue] of reverse.get(k) ?? []) {
            const depKey = key(depVar, depValue);
            const next = (count.get(depKey) ?? 0) - 1;
            count.set(depKey, next);
            if (next === 0 && (domains[depVar] ?? []).includes(depValue)) {
                queue.push([depVar, depValue]);
                queued.add(depKey);
            }
        }
    }

    yield frame(`Arc consistency reached after ${pruned} deletion(s).`, 5);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Arc consistency asks whether every value in a variable's domain has at least one supporting value in each neighboring domain. AC-4 answers this by remembering exactly which values support each pair. When a value disappears, only the pairs that depended on that specific support need updating, so work is not repeated from scratch.",
        invariants: [
            "A counter for a variable-value pair equals the number of currently live supports across all of its constraints.",
            "A pair is queued for deletion exactly when its counter has reached zero.",
            "Deleting a value never adds support to any other pair.",
        ],
        correctness:
            "Each counter is decremented once for each support that is deleted, so when a counter reaches zero the pair truly has no remaining support and must be removed. Conversely a pair with a positive counter still has a live supporting value in every neighbor. When the queue empties, every surviving value is supported on every arc, which is exactly arc consistency, and AC-4 computes the unique greatest such subproblem.",
        complexityRationale:
            "Building the support sets examines every pair of values across each constraint, costing O(e d^2). Each support is deleted at most once and triggers one decrement, so propagation is O(e d). Storing all support sets uses O(e d^2) space.",
        uses: [
            "Constraint programming solvers before search begins",
            "Puzzle solvers such as Sudoku and scheduling problems",
            "A fast preprocessing step that prunes domains for backtracking",
        ],
        references: [
            "Besk and CONIN, AC-4: A Fast Arc Consistency Algorithm, 1992",
            "Mackworth, Consistency in Networks of Relations, 1977",
        ],
        workedExample:
            "With domains A,B in {1,2,3} and the constraint that A=2 is only compatible with B=1, if value B=1 is deleted then the counter for A=2 drops to zero and A=2 is queued and removed. No other pair is touched by that deletion.",
    },
    id: "ac4-arc-consistency",
    name: "AC-4 Arc Consistency",
    category: "searching",
    complexity: { time: "O(e d^2)", space: "O(e d^2)" },
    defaultInput: {
        domains: { A: [1, 2, 3], B: [1, 2, 3], C: [1, 2, 3] },
        constraints: [
            { a: "A", b: "B", pairs: [[1, 2], [2, 1], [3, 3]] },
            { a: "B", b: "C", pairs: [[1, 3], [2, 2], [3, 1]] },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with the full domain of every variable",
        "build support sets for each variable-value pair per constraint",
        "count live supports and queue every zero-count pair",
        "while the deletion queue is not empty, remove the next pair",
        "decrement counters of pairs that relied on the deleted value",
        "queue any pair whose counter has just reached zero",
        "done: every surviving value is arc consistent",
    ],
};

export default module;
