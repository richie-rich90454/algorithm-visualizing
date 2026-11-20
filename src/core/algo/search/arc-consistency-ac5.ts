/**
 * arc-consistency-ac5.ts - AC-5 Arc Consistency
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AC-5 enforces binary arc consistency by keeping, for every variable-value
 * pair and every neighboring constraint, the explicit set of supporting values
 * in that neighbor. When a value is deleted, it is removed from the support
 * sets that mention it; a pair loses its own support only when one of those
 * sets becomes empty, which triggers a new deletion. Storing support sets
 * rather than plain counters lets the algorithm update exactly the arcs that
 * matter instead of rescanning the whole constraint graph.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(e * d^2) worst case for e binary constraints and domain size d
 *   Space: O(e * d^2) for the stored support sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per variable-value pair; surviving values are IDLE.
 *   - A value that loses all support turns RED (error) and is queued.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The final domains are the greatest arc-consistent subset of the inputs.
 *   - A value is deleted only after a neighbor support set becomes empty.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Constraint {
    a: string;
    b: string;
    pairs: number[][];
}

function makeCells(
    variables: string[],
    allValues: number[],
    domains: Map<string, Set<number>>,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    variables.forEach((variable, row) => {
        allValues.forEach((value, col) => {
            const alive = domains.get(variable)?.has(value) === true;
            cells.push({
                id: `cell-${row}-${value}`,
                type: "cell" as const,
                label: `${variable}=${value}`,
                value: alive ? 1 : 0,
                state: (alive ? "idle" : "error") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, variable, value },
            });
        });
    });
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { domains?: Record<string, number[]>; constraints?: Constraint[] } | null
    ) ?? {};
    const domainInput: Record<string, number[]> =
        task.domains ?? {
            A: [1, 2, 3],
            B: [1, 2, 3],
            C: [1, 2, 3],
        };
    const constraints: Constraint[] = task.constraints ?? [
        { a: "A", b: "B", pairs: [[1, 2], [2, 1], [3, 3]] },
        { a: "B", b: "C", pairs: [[1, 3], [2, 2], [3, 1]] },
    ];
    const variables = Object.keys(domainInput);
    let step = 0;

    const domains = new Map<string, Set<number>>();
    for (const variable of variables) {
        domains.set(variable, new Set(domainInput[variable] ?? []));
    }
    const allValues = [...new Set(variables.flatMap((v) => domainInput[v] ?? []))].sort((a, b) => a - b);
    if (allValues.length === 0) {
        allValues.push(0);
    }

    const neighbors = new Map<string, Set<string>>();
    for (const variable of variables) neighbors.set(variable, new Set<string>());
    const allowed = new Map<string, Set<string>>();
    for (const constraint of constraints) {
        const { a, b } = constraint;
        if (!domains.has(a) || !domains.has(b)) continue;
        (neighbors.get(a) as Set<string>).add(b);
        (neighbors.get(b) as Set<string>).add(a);
        const forward = allowed.get(`${a}->${b}`) ?? new Set<string>();
        const backward = allowed.get(`${b}->${a}`) ?? new Set<string>();
        for (const pair of constraint.pairs) {
            const x = pair[0];
            const y = pair[1];
            if (x === undefined || y === undefined) continue;
            forward.add(`${x},${y}`);
            backward.add(`${y},${x}`);
        }
        allowed.set(`${a}->${b}`, forward);
        allowed.set(`${b}->${a}`, backward);
    }

    const support = new Map<string, Map<number, Set<number>>>();
    for (const variable of variables) {
        for (const neighbor of neighbors.get(variable) as Set<string>) {
            const key = `${variable}->${neighbor}`;
            const table = new Map<number, Set<number>>();
            const relation = allowed.get(key) ?? new Set<string>();
            for (const value of domains.get(variable) as Set<number>) {
                const set = new Set<number>();
                for (const candidate of domains.get(neighbor) as Set<number>) {
                    if (relation.has(`${value},${candidate}`)) set.add(candidate);
                }
                table.set(value, set);
            }
            support.set(key, table);
        }
    }

    const enqueue = (variable: string, value: number, queue: Array<[string, number]>, pending: Set<string>): void => {
        const key = `${variable},${value}`;
        if (pending.has(key)) return;
        pending.add(key);
        queue.push([variable, value]);
    };

    const queue: Array<[string, number]> = [];
    const pending = new Set<string>();
    for (const variable of variables) {
        for (const neighbor of neighbors.get(variable) as Set<string>) {
            const table = support.get(`${variable}->${neighbor}`) as Map<number, Set<number>>;
            for (const [value, set] of table) {
                if (set.size === 0) enqueue(variable, value, queue, pending);
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(variables, allValues, domains),
        edges: [],
        description: `Initialized support sets over ${variables.length} variables; ${queue.length} value(s) start without support.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: variables.length, cols: allValues.length, variables: variables.length, removed: 0, queue: queue.length },
    };
    step += 1;

    let removed = 0;
    while (queue.length > 0) {
        const [deletedVariable, deletedValue] = queue.shift() as [string, number];
        (domains.get(deletedVariable) as Set<number>).delete(deletedValue);
        removed += 1;
        for (const variable of neighbors.get(deletedVariable) as Set<string>) {
            const table = support.get(`${variable}->${deletedVariable}`) as Map<number, Set<number>> | undefined;
            if (!table) continue;
            for (const [value, set] of table) {
                if (!set.has(deletedValue)) continue;
                set.delete(deletedValue);
                if (set.size === 0 && (domains.get(variable) as Set<number>).has(value)) {
                    enqueue(variable, value, queue, pending);
                }
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(variables, allValues, domains),
            edges: [],
            description: `Removed ${deletedVariable}=${deletedValue}; ${queue.length} value(s) now await support checks.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: variables.length, cols: allValues.length, variables: variables.length, removed, queue: queue.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(variables, allValues, domains),
        edges: [],
        description: `Done: arc consistency removed ${removed} value(s) from the domains.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: variables.length, cols: allValues.length, variables: variables.length, removed, queue: 0 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A value is viable only if each neighboring variable has some value that can sit next to it. AC-5 records those supporting values explicitly. When a value disappears from a domain, erase it from the support lists that named it; any pair whose list becomes empty has lost its last reason to exist and must go too.",
        invariants: [
            "A support set contains exactly the currently surviving neighbor values compatible with the pair.",
            "A value is queued for deletion only when one of its support sets is empty.",
            "Domains only shrink, never grow, during propagation.",
        ],
        correctness:
            "Each support set is updated for every deleted neighbor value, so a set is empty exactly when no surviving value supports its pair. Deleting such pairs and propagating the news reaches a fixed point in which every surviving pair has support on every arc, which is arc consistency. Because only unsupported values are removed, the result is the greatest arc-consistent subdomains of the input.",
        complexityRationale:
            "Building all support sets scans every allowed pair, O(e d^2), and each deletion scans the pairs that referenced the value, bounded by the same total; the support tables store one value set per arc pair, O(e d^2) space.",
        uses: [
            "Constraint propagation inside constraint-programming solvers",
            "A pruning step before backtracking search on CSPs",
            "Consistency maintenance in scheduling and configuration tools",
        ],
        references: [
            "Bessiere, Arc Consistency and Constraint Propagation, 2006",
            "Mackworth, Consistency in Networks of Relations, 1977",
        ],
        workedExample:
            "With A, B and C each in 1..3, allowed A-B pairs (1,2), (2,1), (3,3) and B-C pairs (1,3), (2,2), (3,1), value A=1 is supported only by B=2, which in turn is supported only by C=2; removing any of them cascades through the support sets and prunes the chain.",
    },
    id: "arc-consistency-ac5",
    name: "AC-5 Arc Consistency",
    category: "searching",
    complexity: { time: "O(e * d^2)", space: "O(e * d^2)" },
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
        "initialize each domain from the input variables",
        "for every binary constraint store allowed value pairs",
        "build a support set for each pair on each incident arc",
        "queue any pair whose support set is already empty",
        "while the queue is not empty remove a queued pair",
        "erase that value from all support sets that contain it",
        "queue pairs whose support set just became empty",
        "done: report the surviving arc-consistent domains",
    ],
};

export default module;
