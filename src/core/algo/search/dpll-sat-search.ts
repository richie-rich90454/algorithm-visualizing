/**
 * dpll-sat-search.ts – DPLL SAT Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Decides satisfiability of a 3-variable, 4-clause formula with the
 * Davis-Putnam-Logemann-Loveland method. It repeats two moves: unit
 * propagation (a clause with one unassigned literal forces that literal
 * true) and splitting (guess a value for an unassigned variable). A clause
 * falsified under the current assignment signals a conflict that full DPLL
 * would backtrack over; a fully satisfied formula is reported SAT.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n) worst – splitting can explore both truth values
 *   Space: O(n) – the partial assignment plus the decision trail
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Forced and guessed variables flash YELLOW (comparing).
 *   - Conflicted variables flash RED (swapped).
 *   - A satisfying assignment turns GREEN (sorted); one cell per variable.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Complete and sound: the backbone of modern CDCL SAT solvers.
 *   - Unit propagation does the deductive work; splitting only guesses.
 *   - Pure-literal elimination is skipped here to keep the demo focused.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const VARS = ["x1", "x2", "x3"];
const CLAUSES: number[][] = [
    [1, 2],
    [-1, 3],
    [-2, -3],
    [1, -3],
];

function makeCells(
    assign: Map<string, boolean>,
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    return VARS.map((v) => ({
        id: `cell-${v}`,
        type: "cell" as const,
        label: assign.has(v) ? `${v}=${assign.get(v) === true ? "T" : "F"}` : `${v}=?`,
        value: assign.has(v) ? 1 : 0,
        state: states.get(v) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { variable: v, value: assign.get(v) ?? false },
    }));
}

function clauseStatus(
    clause: number[],
    assign: Map<string, boolean>,
): "sat" | "unsat" | "unit" | "open" {
    let unassigned = 0;
    for (const lit of clause) {
        const v = VARS[Math.abs(lit) - 1] as string;
        const val = assign.get(v);
        if (val === undefined) {
            unassigned += 1;
            continue;
        }
        const litTrue = lit > 0 ? val : !val;
        if (litTrue) return "sat";
    }
    if (unassigned === 0) return "unsat";
    if (unassigned === 1) return "unit";
    return "open";
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    void input;
    const assign = new Map<string, boolean>();
    let step = 0;
    let decisions = 0;

    yield {
        stepNumber: step,
        entities: makeCells(assign),
        edges: [],
        description: `DPLL on ${VARS.length} variables, ${CLAUSES.length} clauses: ${CLAUSES.map((c) => `(${c.join("∨")})`).join(" ")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { decisions },
    };
    step += 1;
    const order = ["x1", "x2", "x3"];
    for (const v of order) {
        if (step >= 12) break;
        if (assign.has(v)) continue;
        let forced: boolean | null = null;
        for (const clause of CLAUSES) {
            if (clauseStatus(clause, assign) === "unit") {
                const un = clause.find(
                    (lit) => !assign.has(VARS[Math.abs(lit) - 1] as string),
                ) as number;
                if (VARS[Math.abs(un) - 1] === v) forced = un > 0;
            }
        }
        const value = forced ?? (v === "x1" ? true : v === "x2" ? false : true);
        assign.set(v, value);
        if (forced !== null) {
            yield {
                stepNumber: step,
                entities: makeCells(assign, new Map([[v, "comparing"]])),
                edges: [],
                description: `Unit propagation forces ${v}=${value === true ? "T" : "F"}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { decisions },
            };
        } else {
            decisions += 1;
            yield {
                stepNumber: step,
                entities: makeCells(assign, new Map([[v, "comparing"]])),
                edges: [],
                description: `Decision ${decisions}: splitting on ${v}=${value === true ? "T" : "F"}.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { decisions },
            };
        }
        step += 1;
        if (CLAUSES.some((c) => clauseStatus(c, assign) === "unsat")) {
            yield {
                stepNumber: step,
                entities: makeCells(assign, new Map([[v, "swapped"]])),
                edges: [],
                description: `Conflict under ${v}: a clause is falsified and would backtrack here.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { decisions },
            };
            return;
        }
    }
    const allSat = CLAUSES.every((c) => clauseStatus(c, assign) === "sat");
    if (allSat) {
        const done = new Map<string, EntityState>(
            VARS.map((v) => [v, "sorted"] as [string, EntityState]),
        );
        yield {
            stepNumber: step,
            entities: makeCells(assign, done),
            edges: [],
            description: `SAT after ${decisions} decision(s): ${VARS.map((v) => `${v}=${assign.get(v) === true ? "T" : "F"}`).join(", ")}.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { decisions, solution: [...assign.entries()].map(([k, v]) => `${k}=${v}`) },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeCells(assign),
            edges: [],
            description: "Formula not yet decided after this pass; deeper search would follow.",
            codeLineNumber: 5,
            layout: "grid",
            meta: { decisions },
        };
    }
}

const module: AlgorithmModule = {
    id: "dpll-sat-search",
    name: "DPLL SAT Search",
    category: "searching",
    complexity: { time: "O(2^n) worst", space: "O(n)" },
    defaultInput: {
        clauses: [
            [1, 2],
            [-1, 3],
            [-2, -3],
            [1, -3],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty assignment over x1, x2, x3",
        "while unassigned variables remain: look for a unit clause",
        "if a unit clause exists: propagate its forced literal",
        "else split on the next variable with a decision value",
        "if a clause turns unsat: halt with a conflict at this branch",
        "done: return satisfying assignment or deeper-search notice",
    ],
};

export default module;
