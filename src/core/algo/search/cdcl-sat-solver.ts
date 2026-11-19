/**
 * cdcl-sat-solver.ts - CDCL SAT Solver
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Conflict-Driven Clause Learning decides a Boolean formula by assigning one
 * variable at a time, propagating unit clauses, and analyzing each conflict to
 * learn a new clause. The learned clause records why the conflict happened,
 * forces an asserting literal, and lets the solver backjump several levels at
 * once. This is the engine behind modern SAT solvers and is a strict extension
 * of plain DPLL, which never learns.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  exponential worst case; learned clauses prune the search sharply
 *   Space: O(clauses + assignments), growing with learned clauses
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per variable: above baseline true, on baseline false, below
 *     baseline unassigned.
 *   - Decisions are yellow, propagated assignments green, conflicts red.
 *   - Meta reports decisions, conflicts, learned clauses, and the final model.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    vars: number,
    values: Array<boolean | undefined>,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    const out: VisualEntity[] = [];
    for (let v = 1; v <= vars; v += 1) {
        const val = values[v];
        const text = val === true ? "T" : val === false ? "F" : "?";
        out.push({
            id: `bar-${v}`,
            type: "bar" as const,
            label: `x${v}=${text}`,
            value: val === true ? 1 : val === false ? 0 : -1,
            state: states.get(v) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { variable: v, value: text },
        });
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { clauses?: number[][]; variables?: number } | null) ?? {};
    const given = Array.isArray(task.clauses) ? task.clauses : [[1, 2], [-1, 2], [-2, 3]];
    let vars = typeof task.variables === "number" ? task.variables : 0;
    for (const clause of given) for (const lit of clause) vars = Math.max(vars, Math.abs(lit));

    const clauses: number[][] = given.map((c) => [...c]);
    const values: Array<boolean | undefined> = new Array(vars + 1).fill(undefined);
    const levelOf: number[] = new Array(vars + 1).fill(-1);
    const reasonOf: number[] = new Array(vars + 1).fill(-1);
    const trail: number[] = [];
    const trailLim: number[] = [0];
    let currentLevel = 0;
    let step = 0;
    let decisions = 0;
    let conflicts = 0;
    let learnedCount = 0;
    let verdict = "UNKNOWN";
    let model: number[] = [];

    const snap = (
        description: string,
        codeLineNumber: number,
        states: Map<number, EntityState> = new Map(),
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(vars, values, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: {
            verdict,
            decisions,
            conflicts,
            learned: learnedCount,
            variables: vars,
            level: currentLevel,
            model: [...model],
        },
    });

    const litValue = (lit: number): boolean | undefined => {
        const val = values[Math.abs(lit)];
        return val === undefined ? undefined : lit > 0 ? val : !val;
    };
    const assign = (lit: number, level: number, reason: number): void => {
        const v = Math.abs(lit);
        values[v] = lit > 0;
        levelOf[v] = level;
        reasonOf[v] = reason;
        trail.push(v);
    };
    const propagate = (): number => {
        let assigned = false;
        do {
            assigned = false;
            let conflict = -1;
            for (let ci = 0; ci < clauses.length; ci += 1) {
                const clause = clauses[ci] as number[];
                let satisfied = false;
                let unassigned = 0;
                let unitLit = 0;
                for (const lit of clause) {
                    const val = litValue(lit);
                    if (val === true) {
                        satisfied = true;
                        break;
                    }
                    if (val === undefined) {
                        unassigned += 1;
                        unitLit = lit;
                    }
                }
                if (satisfied) continue;
                if (unassigned === 0) {
                    conflict = ci;
                    break;
                }
                if (unassigned === 1) {
                    assign(unitLit, currentLevel, ci);
                    assigned = true;
                    break;
                }
            }
            if (conflict >= 0) return conflict;
        } while (assigned);
        return -1;
    };
    const analyze = (conflictIdx: number): { learned: number[]; bt: number } => {
        const learned: number[] = [0];
        const seen = new Set<number>();
        let pathC = 0;
        let p = 0;
        let idx = trail.length - 1;
        let ci = conflictIdx;
        do {
            const clause = clauses[ci] as number[];
            for (const q of clause) {
                const v = Math.abs(q);
                if (v === p) continue;
                if (!seen.has(v) && (levelOf[v] as number) > 0) {
                    seen.add(v);
                    if ((levelOf[v] as number) >= currentLevel) pathC += 1;
                    else learned.push(q);
                }
            }
            while (idx >= 0 && !seen.has(trail[idx] as number)) idx -= 1;
            p = trail[idx] as number;
            ci = reasonOf[p] as number;
            seen.delete(p);
            pathC -= 1;
        } while (pathC > 0 && ci >= 0);
        learned[0] = -p;
        let bt = 0;
        for (let j = 1; j < learned.length; j += 1) {
            const lv = levelOf[Math.abs(learned[j] as number)] as number;
            if (lv > bt) bt = lv;
        }
        return { learned, bt };
    };
    const backtrack = (bt: number): void => {
        while (currentLevel > bt) {
            while (trail.length > (trailLim[currentLevel] as number)) {
                const v = trail.pop() as number;
                values[v] = undefined;
                levelOf[v] = -1;
                reasonOf[v] = -1;
            }
            trailLim.pop();
            currentLevel -= 1;
        }
    };

    yield snap(`Initial formula: ${clauses.length} clause(s) over ${vars} variable(s).`, 0);
    step += 1;

    let guard = 0;
    for (;;) {
        guard += 1;
        if (guard > 20000) {
            verdict = "TIMEOUT";
            break;
        }

        const conflict = propagate();
        const assignedStates = new Map<number, EntityState>();
        for (const v of trail) assignedStates.set(v, "visited");
        yield snap(
            conflict >= 0
                ? `Propagation found a conflict in clause ${conflict}.`
                : `Propagation assigned ${trail.length} variable(s) without conflict.`,
            2,
            assignedStates,
        );
        step += 1;

        if (conflict >= 0) {
            conflicts += 1;
            const conflictVars = new Map<number, EntityState>();
            for (const lit of clauses[conflict] as number[]) conflictVars.set(Math.abs(lit), "error");
            yield snap(`Conflict ${conflicts} at decision level ${currentLevel}.`, 4, conflictVars);
            step += 1;

            if (currentLevel === 0) {
                verdict = "UNSAT";
                break;
            }

            const { learned, bt } = analyze(conflict);
            clauses.push(learned);
            learnedCount += 1;
            yield snap(`Learned clause [${learned.join(", ")}]; backjumping to level ${bt}.`, 5, conflictVars);
            step += 1;

            backtrack(bt);
            assign(learned[0] as number, bt, clauses.length - 1);
            yield snap(
                `Asserting literal ${learned[0]} at level ${bt}.`,
                6,
                new Map([[Math.abs(learned[0] as number), "active"]]),
            );
            step += 1;
            continue;
        }

        let next = 0;
        for (let v = 1; v <= vars; v += 1) {
            if (values[v] === undefined) {
                next = v;
                break;
            }
        }
        if (next === 0) {
            verdict = "SAT";
            model = trail.map((v) => (values[v] ? v : -v));
            break;
        }

        decisions += 1;
        currentLevel += 1;
        trailLim.push(trail.length);
        assign(next, currentLevel, -1);
        yield snap(`Decision ${decisions}: assume x${next} = true at level ${currentLevel}.`, 3, new Map([[next, "comparing"]]));
        step += 1;
    }

    const finalStates = new Map<number, EntityState>();
    for (let v = 1; v <= vars; v += 1) {
        finalStates.set(v, verdict === "SAT" ? "sorted" : verdict === "UNSAT" ? "error" : "idle");
    }
    yield snap(
        `Result ${verdict} after ${decisions} decision(s) and ${conflicts} conflict(s).`,
        9,
        finalStates,
    );

    void model;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A SAT solver tries to make a formula true by guessing variable values. When a guess leads to a contradiction, plain DPLL simply undoes the last guess. CDCL is smarter: it looks at the conflict, derives a short clause that explains why the whole combination cannot work, and learns it. That learned clause becomes a new unit rule that forces the solver out of the bad region and lets it jump back several decisions at once.",
        invariants: [
            "Every assigned variable stores the decision level and the clause that forced it.",
            "Learned clauses are logical consequences of the original formula, so adding them preserves satisfiability.",
            "After backjumping, the learned clause is unit and its first literal is forced true.",
        ],
        correctness:
            "Unit propagation only assigns a literal when every other literal in a clause is false, so it never destroys a satisfying assignment. The 1-UIP conflict analysis resolves the conflict clause with reason clauses until a single literal from the current level remains; the resulting clause is implied by the formula by repeated resolution. Backjumping to the second-highest level in that clause leaves exactly one unassigned literal, which propagation must set true. Each learned clause rules out at least one previously explored assignment, so with finitely many variables the search terminates. Level-zero conflict means no assignment works (UNSAT); all variables assigned without conflict means the model satisfies every clause (SAT).",
        complexityRationale:
            "Each propagation pass scans the clauses, and conflicts add learned clauses, so the worst case remains exponential in the number of variables. Memory holds the formula, the trail, and the growing learned-clause database, all bounded by the number of clauses generated during the search.",
        uses: [
            "Hardware and software formal verification",
            "Automated planning and scheduling encoded as Boolean constraints",
            "Circuit equivalence checking and bounded model checking",
        ],
        references: [
            "Marques-Silva and Sakallah, GRASP: A Search Algorithm for Propositional Satisfiability, 1999",
            "Moskewicz et al., Chaff: Engineering an Efficient SAT Solver, 2001",
        ],
        workedExample:
            "Consider clauses [1,2], [-1,2], [-2,3]. Propagation at level 0 does nothing, so the solver decides x1 true. Clause [-1,2] then forces x2 true, which forces x3 true from [-2,3], and every clause is satisfied, so the answer is SAT with model (1,2,3). A formula whose clauses conflict at level zero is reported UNSAT without any decision.",
    },
    id: "cdcl-sat-solver",
    name: "CDCL SAT Solver",
    category: "searching",
    complexity: { time: "exponential worst case", space: "O(clauses + assignments)" },
    defaultInput: { clauses: [[1, 2], [-1, 2], [-2, 3]], variables: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "store the clauses and start with no variables assigned",
        "repeat unit propagation until no clause is unit",
        "if a clause is falsified, a conflict has occurred",
        "choose an unassigned variable and decide it true at a new level",
        "analyze the conflict by resolution to learn a clause",
        "learned clauses prune future search and force an asserting literal",
        "backjump to the second-highest level in the learned clause",
        "if conflict appears at level zero, report unsatisfiable",
        "if every variable is assigned, report the satisfying model",
        "done: verdict of satisfiable or unsatisfiable",
    ],
};

export default module;
