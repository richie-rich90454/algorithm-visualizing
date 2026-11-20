/**
 * forward-checking-search.ts - Backtracking Search with Forward Checking
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Forward checking is a constraint-satisfaction search that sits between
 * plain chronological backtracking and full arc consistency. After a variable
 * is assigned, it looks only at the still-unassigned variables that share a
 * constraint with it and deletes from their domains every value that no
 * longer has support. If any of those domains becomes empty, the branch is
 * abandoned immediately instead of being explored to its leaves.
 *
 * Unlike maintaining arc consistency (consistency-enforcement-search), it
 * does not propagate deletions between the remaining variables; unlike plain
 * backtracking (backtracking-csp-search), it never ignores a domain change.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^n) worst case, but each assignment prunes its neighbors early
 *   Space: O(n*d) for the domains and the assignment stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show a variable's current domain, or its chosen value.
 *   - The assigned variable is GREEN; pruned neighbors flash RED.
 *   - A dead end is PINK; the satisfying assignment turns GREEN at the end.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pair = [number, number];

interface Constraint {
    a: string;
    b: string;
    allowed: Pair[];
}

interface SearchInput {
    variables?: string[];
    domains?: Record<string, number[]>;
    constraints?: Constraint[];
}

interface Snapshot {
    kind: "start" | "assign" | "prune" | "conflict" | "backtrack" | "solution";
    domains: Record<string, number[]>;
    assignment: Record<string, number>;
    focus: string;
    detail: string;
    line: number;
    prunes: number;
    backtracks: number;
}

interface SolveResult {
    events: Snapshot[];
    sat: boolean;
    solution: Record<string, number> | null;
}

/** Whether a pair of values is allowed by a constraint (order matters). */
function allowed(c: Constraint, x: number, y: number): boolean {
    return c.allowed.some(([p, q]) => p === x && q === y);
}

/** Inequality helper used to build the default problem. */
function unequal(a: string, b: string): Constraint {
    const pairs: Pair[] = [];
    for (let x = 1; x <= 3; x += 1) {
        for (let y = 1; y <= 3; y += 1) {
            if (x !== y) pairs.push([x, y]);
        }
    }
    return { a, b, allowed: pairs };
}

/** Run forward-checking search, recording one snapshot per decision. */
function solve(
    variables: string[],
    domains: Record<string, number[]>,
    constraints: Constraint[],
): SolveResult {
    const events: Snapshot[] = [];
    const assignment: Record<string, number> = {};
    let prunes = 0;
    let backtracks = 0;
    let solution: Record<string, number> | null = null;

    const copyDomains = (): Record<string, number[]> => {
        const out: Record<string, number[]> = {};
        for (const v of variables) out[v] = [...(domains[v] ?? [])];
        return out;
    };
    const record = (
        kind: Snapshot["kind"],
        focus: string,
        detail: string,
        line: number,
    ): void => {
        // Keep the replay bounded; the final decision is always kept.
        if (events.length >= 400 && kind !== "solution" && kind !== "conflict") return;
        events.push({
            kind,
            domains: copyDomains(),
            assignment: { ...assignment },
            focus,
            detail,
            line,
            prunes,
            backtracks,
        });
    };

    const consistent = (v: string, value: number): boolean => {
        for (const c of constraints) {
            if (c.a === v && assignment[c.b] !== undefined) {
                if (!allowed(c, value, assignment[c.b]!)) return false;
            }
            if (c.b === v && assignment[c.a] !== undefined) {
                if (!allowed(c, assignment[c.a]!, value)) return false;
            }
        }
        return true;
    };

    const dfs = (index: number): boolean => {
        if (solution) return true;
        if (index >= variables.length) {
            solution = { ...assignment };
            record("solution", "", "All variables assigned consistently - solution found.", 7);
            return true;
        }
        const v = variables[index]!;
        for (const value of [...(domains[v] ?? [])]) {
            if (solution) return true;
            if (!consistent(v, value)) continue;
            assignment[v] = value;
            record("assign", v, `Assign ${v} = ${value}.`, 2);

            const saved = copyDomains();
            let conflict = "";
            const shrunk: string[] = [];
            for (const c of constraints) {
                if (c.a === v && assignment[c.b] === undefined) {
                    const before = domains[c.b]?.length ?? 0;
                    domains[c.b] = (domains[c.b] ?? []).filter((x) => allowed(c, value, x));
                    if (domains[c.b]!.length === 0) conflict = c.b;
                    else if (domains[c.b]!.length < before) shrunk.push(c.b);
                }
                if (c.b === v && assignment[c.a] === undefined) {
                    const before = domains[c.a]?.length ?? 0;
                    domains[c.a] = (domains[c.a] ?? []).filter((x) => allowed(c, x, value));
                    if (domains[c.a]!.length === 0) conflict = c.a;
                    else if (domains[c.a]!.length < before) shrunk.push(c.a);
                }
            }

            if (conflict) {
                prunes += 1;
                record("conflict", conflict, `Forward check empties the domain of ${conflict}.`, 4);
                domains[v] = saved[v]!;
                for (const key of Object.keys(saved)) domains[key] = saved[key]!;
                delete assignment[v];
                backtracks += 1;
                record("backtrack", v, `Backtrack: undo the assignment of ${v}.`, 6);
                continue;
            }

            if (shrunk.length > 0) {
                prunes += shrunk.length;
                record(
                    "prune",
                    shrunk.join(","),
                    `Forward check shrinks ${shrunk.join(", ")} after ${v} = ${value}.`,
                    3,
                );
            }

            if (dfs(index + 1)) return true;

            for (const key of Object.keys(saved)) domains[key] = saved[key]!;
            delete assignment[v];
            backtracks += 1;
            record("backtrack", v, `Backtrack: undo the assignment of ${v}.`, 6);
        }
        return false;
    };

    record("start", "", "Begin forward-checking search over the variables.", 0);
    dfs(0);
    if (!solution) {
        record("solution", "", "No consistent assignment exists - problem is unsatisfiable.", 7);
    }
    return { events, sat: solution !== null, solution };
}

/** Render one snapshot as a row of domain/assignment cells. */
function makeEntities(
    variables: string[],
    ev: Snapshot,
    sat: boolean,
): VisualEntity[] {
    const focus = ev.focus.split(",");
    return variables.map((v) => {
        let state: EntityState = "idle";
        if (ev.kind === "solution" && sat) {
            state = "sorted";
        } else if (focus.includes(v)) {
            state =
                ev.kind === "conflict"
                    ? "error"
                    : ev.kind === "backtrack"
                      ? "swapped"
                      : ev.kind === "prune"
                        ? "highlight"
                        : "comparing";
        } else if (ev.assignment[v] !== undefined) {
            state = "sorted";
        }
        const chosen = ev.assignment[v];
        return {
            id: `cell-${v}`,
            type: "cell" as const,
            label: chosen !== undefined ? `${v}=${chosen}` : `${v}:{${(ev.domains[v] ?? []).join(",")}}`,
            value: chosen ?? (ev.domains[v] ?? []).join(","),
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { variable: v, assigned: chosen ?? -1 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SearchInput | null) ?? {};
    const variables = Array.isArray(task.variables) && task.variables.length > 0
        ? [...task.variables]
        : ["X", "Y", "Z"];

    const domains: Record<string, number[]> = {};
    for (const v of variables) {
        const d = task.domains?.[v];
        domains[v] = Array.isArray(d) && d.length > 0 ? [...(d as number[])] : [1, 2, 3];
    }

    const fallback = [unequal("X", "Y"), unequal("Y", "Z")];
    const constraints: Constraint[] = Array.isArray(task.constraints) && task.constraints.length > 0
        ? task.constraints
              .filter((c) => c && typeof c.a === "string" && typeof c.b === "string" && Array.isArray(c.allowed))
              .map((c) => ({ a: c.a, b: c.b, allowed: c.allowed }))
        : fallback;

    const result = solve(variables, domains, constraints);
    let step = 0;
    for (const ev of result.events) {
        const last = ev === result.events[result.events.length - 1];
        const sat = last && result.sat;
        yield {
            stepNumber: step,
            entities: makeEntities(variables, ev, sat),
            edges: [],
            description: ev.detail,
            codeLineNumber: ev.line,
            layout: "grid",
            meta: {
                assignmentCount: Object.keys(ev.assignment).length,
                prunes: ev.prunes,
                backtracks: ev.backtracks,
                focus: ev.focus,
                sat,
                solution: sat && result.solution ? JSON.stringify(result.solution) : "",
            },
        };
        step += 1;
    }
}

/** The forward-checking CSP search module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine filling in a crossword one letter at a time. Before writing a letter down, cross out every option it would make impossible in the empty squares that share a word. If any square runs out of options, you know immediately that your letter was wrong and you try the next one. Forward checking does exactly this for variables and their domains.",
        invariants: [
            "An assigned variable keeps a value that is consistent with every already-assigned neighbor.",
            "Every domain contains only values that still have support under constraints to assigned variables.",
            "Undoing a choice restores every domain to exactly the state it had before that choice.",
        ],
        correctness:
            "The search is complete because it tries every domain value at each variable, and sound because a value is chosen only when it is consistent with all assigned neighbors. Forward checking removes only values that cannot appear in any completion of the current partial assignment, so pruning never discards a valid solution; restoring domains on backtrack keeps the branching exhaustive.",
        complexityRationale:
            "In the worst case all d values of n variables are tried, giving O(d^n) time; each assignment scans its incident constraints and filters neighbor domains of size at most d. The recursion stack and the n domain lists use O(n*d) space.",
        uses: [
            "Course timetabling and exam scheduling",
            "Sudoku and other logic-puzzle solvers",
            "Configuration problems such as map coloring and frequency assignment",
        ],
        references: [
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, constraint-satisfaction chapter",
            "Haralick and Elliott, Increasing Tree Search Efficiency for Constraint Satisfaction Problems, 1980",
        ],
        workedExample:
            "With X, Y, Z each in {1,2,3} and constraints X != Y and Y != Z, assign X = 1. Forward checking removes 1 from Y's domain, leaving {2,3}. Assign Y = 2; forward checking removes 2 from Z, leaving {1,3}. Assigning Z = 1 gives the solution X=1, Y=2, Z=1 without ever visiting a contradictory branch.",
    },
    id: "forward-checking-search",
    name: "Forward Checking Search",
    category: "searching",
    complexity: { time: "O(d^n)", space: "O(n*d)" },
    defaultInput: {
        variables: ["X", "Y", "Z"],
        domains: { X: [1, 2, 3], Y: [1, 2, 3], Z: [1, 2, 3] },
        constraints: [
            {
                a: "X",
                b: "Y",
                allowed: [[1, 2], [1, 3], [2, 1], [2, 3], [3, 1], [3, 2]],
            },
            {
                a: "Y",
                b: "Z",
                allowed: [[1, 2], [1, 3], [2, 1], [2, 3], [3, 1], [3, 2]],
            },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "domains ← one list of legal values per variable",
        "for each value of the next unassigned variable v",
        "assign v ← value when it agrees with assigned neighbors",
        "for each unassigned neighbor w, remove unsupported values from domain(w)",
        "if any neighbor domain is empty, report a conflict",
        "otherwise recurse on the remaining variables",
        "on failure restore all domains and unassign v",
        "stop when a full consistent assignment is found",
    ],
};

export default module;
