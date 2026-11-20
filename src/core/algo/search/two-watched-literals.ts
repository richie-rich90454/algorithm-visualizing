/**
 * two-watched-literals.ts – Two-Watched-Literals Unit Propagation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two-watched-literals is the unit-propagation engine behind modern SAT
 * solvers. Each clause watches two of its literals. When a watched literal
 * becomes false, the clause is visited only then: it either finds another
 * non-false literal to watch, forces the last remaining literal (a unit), or
 * reports a conflict. Clauses untouched by an assignment cost nothing.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(total literal visits) - each clause is scanned only when a
 *          watched literal is falsified
 *   Space: O(total literals) for the clauses and the two watch lists
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Watched literals are marked with an asterisk in each clause cell.
 *   - A clause whose watch moves is RED (swapped).
 *   - A clause that forces a unit is PINK (highlight).
 *   - A conflict is RED (error); a satisfied formula ends GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Clause = number[];
type Assign = Map<number, boolean>;

interface WatchEvent {
    kind: "init" | "move" | "unit" | "conflict" | "done";
    clause: number;
    detail: string;
    watches: Array<[number, number]>;
    assignment: Assign;
}

interface PropResult {
    conflict: boolean;
    assignment: Assign;
    watches: Array<[number, number]>;
    events: WatchEvent[];
    propagations: number;
}

function truth(lit: number, assign: Assign): boolean | undefined {
    const val = assign.get(Math.abs(lit));
    if (val === undefined) return undefined;
    return lit > 0 ? val : !val;
}

function clauseLabel(index: number, clause: Clause, watches: Array<[number, number]>): string {
    const w = watches[index] ?? [NaN, NaN];
    return `c${index}: ${clause.map((lit) => (lit === w[0] || lit === w[1] ? `*${lit}` : String(lit))).join(" ")}`;
}

function propagate(clauses: Clause[]): PropResult {
    const assign: Assign = new Map();
    const watches: Array<[number, number]> = clauses.map((c) => [c[0] as number, c[1] as number]);
    const watchLists = new Map<number, number[]>();
    const queue: number[] = [];
    const events: WatchEvent[] = [];
    const result: PropResult = { conflict: false, assignment: assign, watches, events, propagations: 0 };

    const addWatch = (lit: number, c: number): void => {
        const list = watchLists.get(lit) ?? [];
        list.push(c);
        watchLists.set(lit, list);
    };
    const removeWatch = (lit: number, c: number): void => {
        const list = watchLists.get(lit) ?? [];
        const at = list.indexOf(c);
        if (at >= 0) list.splice(at, 1);
    };
    const assignLit = (lit: number): boolean => {
        const v = Math.abs(lit);
        const value = lit > 0;
        const current = assign.get(v);
        if (current !== undefined) return current === value;
        assign.set(v, value);
        queue.push(-lit);
        return true;
    };

    // Seed the watch lists; unit clauses are assigned before propagation.
    for (let c = 0; c < clauses.length; c += 1) {
        const clause = clauses[c] as Clause;
        if (clause.length === 0) {
            result.conflict = true;
            return result;
        }
        if (clause.length === 1) {
            const lit = clause[0] as number;
            watches[c] = [lit, lit];
            if (!assignLit(lit)) {
                result.conflict = true;
                return result;
            }
            addWatch(lit, c);
        } else {
            addWatch(clause[0] as number, c);
            addWatch(clause[1] as number, c);
        }
        events.push({
            kind: "init",
            clause: c,
            detail: `Clause c${c} watches literals ${watches[c]?.join(" and ")}.`,
            watches: watches.map((w) => [...w] as [number, number]),
            assignment: new Map(assign),
        });
    }

    let guard = 0;
    while (queue.length > 0 && guard < 100000) {
        guard += 1;
        const falseLit = queue.shift() as number;
        const list = watchLists.get(falseLit) ?? [];
        let i = 0;
        while (i < list.length) {
            const c = list[i] as number;
            const w = watches[c] as [number, number];
            if (w[0] !== falseLit && w[1] !== falseLit) {
                list.splice(i, 1); // stale entry
                continue;
            }
            const other = w[0] === falseLit ? (w[1] as number) : (w[0] as number);
            if (truth(other, assign) === true) {
                i += 1; // clause already satisfied
                continue;
            }

            let replacement: number | undefined;
            for (const lit of clauses[c] as Clause) {
                if (lit === w[0] || lit === w[1]) continue;
                if (truth(lit, assign) !== false) {
                    replacement = lit;
                    break;
                }
            }
            if (replacement !== undefined) {
                watches[c] = [other, replacement];
                removeWatch(falseLit, c);
                addWatch(replacement, c);
                events.push({
                    kind: "move",
                    clause: c,
                    detail: `Literal ${falseLit} became false; c${c} moved its watch to ${replacement}.`,
                    watches: watches.map((x) => [...x] as [number, number]),
                    assignment: new Map(assign),
                });
                continue; // the list shrank, so do not advance i
            }

            if (truth(other, assign) === false) {
                result.conflict = true;
                events.push({
                    kind: "conflict",
                    clause: c,
                    detail: `c${c} has both watched literals false – conflict.`,
                    watches: watches.map((x) => [...x] as [number, number]),
                    assignment: new Map(assign),
                });
                return result;
            }

            result.propagations += 1;
            events.push({
                kind: "unit",
                clause: c,
                detail: `c${c} is unit: forcing literal ${other} true.`,
                watches: watches.map((x) => [...x] as [number, number]),
                assignment: new Map(assign),
            });
            if (!assignLit(other)) {
                result.conflict = true;
                return result;
            }
            i += 1;
        }
    }
    return result;
}

function makeCells(
    clauses: Clause[],
    watches: Array<[number, number]>,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return clauses.map((clause, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: clauseLabel(index, clause, watches),
        value: clause.length,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { clause: index, watched: watches[index]?.join(",") ?? "" },
    }));
}

function assignmentList(assign: Assign): string[] {
    return [...assign.entries()].sort(([a], [b]) => a - b).map(([v, val]) => `x${v}=${val ? "T" : "F"}`);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { clauses?: number[][]; numVars?: number } | null) ?? {};
    const clauses: Clause[] = Array.isArray(task.clauses)
        ? task.clauses.filter((c) => Array.isArray(c))
        : [
              [1],
              [-1, 2, 3],
              [-1, -2],
              [2, 3],
          ];
    const result = propagate(clauses);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(clauses, clauses.map((c) => [c[0] as number, c[1] as number])),
        edges: [],
        description: `Two-watched-literals propagation over ${clauses.length} clause(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { clauses: clauses.length, propagations: 0, conflict: false },
    };
    step += 1;

    for (const event of result.events) {
        const states = new Map<number, EntityState>();
        if (event.kind === "move") states.set(event.clause, "swapped");
        else if (event.kind === "unit") states.set(event.clause, "highlight");
        else if (event.kind === "conflict") states.set(event.clause, "error");
        else if (event.kind === "init") states.set(event.clause, "comparing");
        const line = event.kind === "move" ? 4 : event.kind === "unit" ? 6 : event.kind === "conflict" ? 5 : 1;
        yield {
            stepNumber: step,
            entities: makeCells(clauses, event.watches, states),
            edges: [],
            description: event.detail,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                clauses: clauses.length,
                propagations: result.propagations,
                conflict: result.conflict,
                assignment: assignmentList(event.assignment),
            },
        };
        step += 1;
        if (step > 70) break;
    }

    const finalStates = new Map<number, EntityState>(
        clauses.map((_, index) => [index, result.conflict ? "error" : "sorted"] as [number, EntityState]),
    );
    const watches = result.watches;
    yield {
        stepNumber: step,
        entities: makeCells(clauses, watches, finalStates),
        edges: [],
        description: result.conflict
            ? `Conflict reached after ${result.propagations} forced literal(s).`
            : `Propagation fixed ${assignmentList(result.assignment).length} variable(s) with ${result.propagations} forced literal(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            conflict: result.conflict,
            propagations: result.propagations,
            assignment: assignmentList(result.assignment),
            watches: clauses.map((_, i) => `c${i}:${(watches[i] ?? []).join(",")}`),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Scanning every clause after every assignment is wastesful. Two-watched-literals instead records two literals per clause that are not false. When one of them is falsified, only the clauses watching that literal are examined; each either finds a fresh literal to watch, forces the last open literal, or signals a conflict. Most assignments touch no clause at all.",
        invariants: [
            "A clause is visited only when one of its two watched literals becomes false.",
            "If a clause is not yet satisfied, neither of its watched literals is false.",
            "Watches move only to literals that are currently not false.",
        ],
        correctness:
            "When a watched literal is falsified, any other non-false literal is a sound replacement because the clause still has a possible satisfying assignment through it. If none exists and the other watch is unassigned, the clause can only be satisfied by that literal, so forcing it is sound. If the other watch is also false, the clause can never be satisfied, which is a genuine conflict.",
        complexityRationale:
            "Each clause is scanned only on assignments that falsify a watched literal, and a watch move strictly reduces future visits, so total work is proportional to literal visits. Clauses and two watch lists hold O(total literals) space.",
        uses: [
            "Unit propagation in CDCL SAT solvers such as MiniSat and CaDiCaL",
            "Checking constraints in answer-set and SMT engines",
            "Teaching why lazy data structures make solvers fast",
        ],
        references: [
            "Moskewicz, Madigan, Zhao, Zhang, and Malik, Chaff, DAC 2001",
            "Biere, Heule, van Maaren, and Walsh, Handbook of Satisfiability, Chapter 4",
        ],
        workedExample:
            "For clauses [1], [-1 2 3], [-1 -2], and [2 3], the unit clause forces x1 true. Clause [-1 2 3] moves its watch from -1 to 3 because 3 is still open, while [-1 -2] forces x2 false. Then [2 3] forces x3 true, and no conflict arises.",
    },
    id: "two-watched-literals",
    name: "Two-Watched-Literals",
    category: "searching",
    complexity: { time: "O(total literal visits)", space: "O(total literals)" },
    defaultInput: {
        clauses: [
            [1],
            [-1, 2, 3],
            [-1, -2],
            [2, 3],
        ],
        numVars: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each clause, choose two literals to watch",
        "assign every unit clause and queue its falsified negation",
        "pop a falsified literal and visit clauses watching it",
        "if another literal is not false, move the watch there",
        "if the other watch is true, the clause is already satisfied",
        "if both watches are false, report a conflict",
        "otherwise force the last open watched literal as a unit",
        "done: report the forced assignment or the conflict",
    ],
};

export default module;
