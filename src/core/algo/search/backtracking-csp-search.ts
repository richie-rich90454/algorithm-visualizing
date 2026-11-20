/**
 * backtracking-csp-search.ts – Backtracking CSP Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Solves a tiny constraint problem (X≠Y and Y≠Z over {1,2}) by assigning
 * variables in order and undoing bad choices. Each variable tries its domain
 * values one at a time: inconsistent values are rejected immediately, and
 * when a variable exhausts its domain the search backtracks to the previous
 * variable and tries its next value. The first full consistent assignment is
 * a solution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^n) worst – every combination may be tried (d values, n vars)
 *   Space: O(n) – the assignment stack plus remaining-value lists
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Fresh consistent assignments are YELLOW (comparing).
 *   - Rejected values flash PINK (highlight); backtracked vars RED (swapped).
 *   - A full solution turns GREEN (sorted); one cell per variable.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Complete and sound: tries everything, accepts only consistent answers.
 *   - Chronological backtracking is the baseline every CSP speedup beats.
 *   - Forward checking and arc consistency prune what this explores blindly.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const VARS = ["X", "Y", "Z"];

function makeCells(
    assign: Map<string, number>,
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    return VARS.map((v) => ({
        id: `cell-${v}`,
        type: "cell" as const,
        label: assign.has(v) ? `${v}=${assign.get(v)}` : `${v}=?`,
        value: assign.get(v) ?? 0,
        state: states.get(v) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { variable: v, value: assign.get(v) ?? -1 },
    }));
}

function consistent(assign: Map<string, number>): boolean {
    if (assign.has("X") && assign.has("Y") && assign.get("X") === assign.get("Y")) return false;
    if (assign.has("Y") && assign.has("Z") && assign.get("Y") === assign.get("Z")) return false;
    return true;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { domains?: Record<string, number[]> } | null) ?? {};
    const domains: Record<string, number[]> = {};
    for (const v of VARS) {
        const d = task.domains?.[v];
        domains[v] = Array.isArray(d) && d.length > 0 ? [...(d as number[])] : [1, 2];
    }
    let step = 0;
    let backtracks = 0;
    const assign = new Map<string, number>();

    yield {
        stepNumber: step,
        entities: makeCells(assign),
        edges: [],
        description: `Backtracking over ${VARS.join(", ")} with constraints X≠Y, Y≠Z.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { backtracks },
    };
    step += 1;
    const stack: Array<{ v: string; next: number[] }> = [
        { v: "X", next: [...(domains["X"] as number[])] },
    ];
    while (stack.length > 0 && step < 13) {
        const top = stack[stack.length - 1] as { v: string; next: number[] };
        if (top.next.length === 0) {
            stack.pop();
            const prev = stack.length > 0 ? (stack[stack.length - 1] as { v: string }).v : null;
            if (prev !== null) assign.delete(top.v);
            backtracks += 1;
            yield {
                stepNumber: step,
                entities: makeCells(assign, new Map([[top.v, "swapped"]])),
                edges: [],
                description: `${top.v} exhausted its domain – backtracking (${backtracks}).`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { backtracks },
            };
            step += 1;
            continue;
        }
        const value = top.next.shift() as number;
        assign.set(top.v, value);
        if (!consistent(assign)) {
            assign.delete(top.v);
            yield {
                stepNumber: step,
                entities: makeCells(assign, new Map([[top.v, "highlight"]])),
                edges: [],
                description: `${top.v}=${value} violates a constraint – trying the next value.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { backtracks },
            };
            step += 1;
            continue;
        }
        yield {
            stepNumber: step,
            entities: makeCells(assign, new Map([[top.v, "comparing"]])),
            edges: [],
            description: `Assigned ${top.v}=${value}; still consistent.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { backtracks },
        };
        step += 1;
        if (assign.size === VARS.length) {
            const done = new Map<string, EntityState>(
                VARS.map((v) => [v, "sorted"] as [string, EntityState]),
            );
            yield {
                stepNumber: step,
                entities: makeCells(assign, done),
                edges: [],
                description: `Solution ${VARS.map((v) => `${v}=${assign.get(v)}`).join(", ")} with ${backtracks} backtrack(s).`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { backtracks, solution: [...assign.entries()].map(([k, v]) => `${k}=${v}`) },
            };
            return;
        }
        const idx = VARS.indexOf(top.v);
        stack.push({
            v: VARS[idx + 1] as string,
            next: [...(domains[VARS[idx + 1] as string] as number[])],
        });
    }
    yield {
        stepNumber: step,
        entities: makeCells(assign),
        edges: [],
        description: "No solution exists for these domains.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { backtracks },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Backtracking CSP search assigns variables one at a time and undoes choices that lead to conflict. Each variable tries its domain values in turn; inconsistent values are rejected immediately and exhausting a domain forces a step back.",
        "invariants": [
            "Every assignment on the current stack is consistent with all previously assigned variables.",
            "Variables are assigned in a fixed order, so stack depth equals the number of assigned variables."
        ],
        "correctness": "The search tries every consistent combination in depth-first order; if a solution exists it lies on some branch that is eventually explored, and any returned complete assignment satisfies all constraints by construction.",
        "complexityRationale": "With n variables and d values the worst case explores d^n combinations, O(d^n) time. The assignment stack and remaining-value lists use O(n) space.",
        "uses": [
            "Solving small constraint satisfaction problems",
            "Implementing map coloring and puzzle solvers",
            "Foundation for forward-checking solvers"
        ],
        "references": [
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, Chapter 6",
            "Knuth, The Art of Computer Programming, Vol. 4B, Section 7.2.2"
        ],
        "workedExample": "For X != Y and Y < Z over {1,2}, try X=1, then Y=1 is rejected as equal, then Y=2 forces Z above 2 and fails; backtrack to X=2, Y=1, Z=2, which satisfies both constraints."
    },
    id: "backtracking-csp-search",
    name: "Backtracking CSP Search",
    category: "searching",
    complexity: { time: "O(d^n)", space: "O(n)" },
    defaultInput: { domains: { X: [1, 2], Y: [1, 2], Z: [1, 2] } },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty assignment and a stack of untried domain values",
        "assign the next value to the current variable in order",
        "if the value violates a constraint: reject it and try the next",
        "if a variable exhausts its domain: backtrack to the previous variable",
        "if every variable is assigned consistently: return the solution",
        "done: return solution or report that none exists for these domains",
    ],
};

export default module;
