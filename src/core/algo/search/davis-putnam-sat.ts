/**
 * davis-putnam-sat.ts - Davis-Putnam SAT Algorithm
 *
 * The Davis-Putnam procedure decides propositional satisfiability by removing
 * a variable with resolution. Every clause containing the variable is resolved
 * against every clause containing its negation, and the original clauses are
 * discarded. Unit clauses and pure literals are simplified first. An empty
 * clause proves unsatisfiability; eliminating every clause proves satisfiability.
 *
 * Time: exponential in the worst case (clause count can grow at each step)
 * Space: proportional to the largest clause set reached
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SatInput {
    clauses: number[][];
}

type Status = "searching" | "satisfiable" | "unsatisfiable";

/** Return a canonical clause, or null when it is a tautology. */
function normalize(clause: number[]): number[] | null {
    const unique = new Set(clause);
    for (const literal of unique) {
        if (unique.has(-literal)) {
            return null;
        }
    }
    return [...unique].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
}

function clauseKey(clause: number[]): string {
    return [...clause].sort((a, b) => a - b).join(",");
}

/** Set a literal true: drop satisfied clauses and delete its negation. */
function assign(clauses: number[][], literal: number): number[][] | null {
    const result: number[][] = [];
    for (const clause of clauses) {
        if (clause.includes(literal)) {
            continue;
        }
        const shortened = clause.filter((entry) => entry !== -literal);
        if (shortened.length === 0) {
            return null;
        }
        result.push(shortened);
    }
    return result;
}

function variableCount(clauses: number[][]): number {
    let maximum = 0;
    for (const clause of clauses) {
        for (const literal of clause) {
            maximum = Math.max(maximum, Math.abs(literal));
        }
    }
    return maximum;
}

function makeFrame(clauses: number[][], status: Status, description: string, line: number): VisualFrame {
    const rows = Math.max(1, clauses.length);
    const cols = Math.max(
        1,
        ...clauses.map((clause) => clause.length),
    );
    const entities: VisualEntity[] = [];
    if (clauses.length === 0) {
        entities.push({
            id: "cell-0-0",
            type: "cell" as const,
            label: "no clauses",
            value: "",
            state: "sorted" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: 0 },
        });
    } else {
        for (let row = 0; row < clauses.length; row += 1) {
            const clause = clauses[row] as number[];
            for (let col = 0; col < cols; col += 1) {
                const literal = clause[col];
                entities.push({
                    id: `cell-${row}-${col}`,
                    type: "cell" as const,
                    label: literal === undefined ? "-" : String(literal),
                    value: literal ?? 0,
                    state: literal === undefined ? "idle" : literal > 0 ? "active" : "highlight",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col },
                });
            }
        }
    }
    return {
        stepNumber: 0,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows,
            cols,
            status,
            variables: variableCount(clauses),
            clauses: clauses.map((clause) => clause.join(" ")),
        },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<SatInput> | null) ?? {};
    const raw = Array.isArray(task.clauses)
        ? task.clauses
        : [
              [1, 2],
              [-1, 3],
              [-2, 3],
              [3],
          ];
    let clauses: number[][] = raw
        .map((clause) => normalize([...clause]))
        .filter((clause): clause is number[] => clause !== null);
    let step = 0;
    let eliminated = 0;

    const emit = (status: Status, description: string, line: number): VisualFrame => {
        const frame = makeFrame(clauses, status, description, line);
        frame.stepNumber = step;
        step += 1;
        return frame;
    };

    yield emit("searching", "Starting Davis-Putnam resolution on the given clause set.", 0);

    let status: Status = "searching";
    while (status === "searching") {
        if (clauses.some((clause) => clause.length === 0)) {
            status = "unsatisfiable";
            break;
        }
        if (clauses.length === 0) {
            status = "satisfiable";
            break;
        }

        const unit = clauses.find((clause) => clause.length === 1);
        if (unit) {
            const literal = unit[0] as number;
            const simplified = assign(clauses, literal);
            if (simplified === null) {
                clauses = [[]];
                yield emit(
                    "unsatisfiable",
                    `Unit literal ${literal} produced an empty clause - formula is unsatisfiable.`,
                    1,
                );
                status = "unsatisfiable";
                break;
            }
            clauses = simplified;
            yield emit("searching", `Unit propagation set literal ${literal} and simplified the clauses.`, 1);
            continue;
        }

        const signs = new Map<number, Set<number>>();
        for (const clause of clauses) {
            for (const literal of clause) {
                const variable = Math.abs(literal);
                const seen = signs.get(variable) ?? new Set<number>();
                seen.add(Math.sign(literal));
                signs.set(variable, seen);
            }
        }
        let pureLiteral = 0;
        for (const [variable, seen] of signs) {
            if (seen.size === 1) {
                pureLiteral = variable * (seen.has(1) ? 1 : -1);
                break;
            }
        }
        if (pureLiteral !== 0) {
            clauses = clauses.filter((clause) => !clause.includes(pureLiteral));
            yield emit("searching", `Pure literal ${pureLiteral} satisfies its clauses and can be removed.`, 2);
            continue;
        }

        const first = clauses[0]?.[0] ?? 0;
        const variable = Math.abs(first);
        const positive = clauses.filter((clause) => clause.includes(variable));
        const negative = clauses.filter((clause) => clause.includes(-variable));
        const others = clauses.filter(
            (clause) => !clause.includes(variable) && !clause.includes(-variable),
        );
        const resolvents = new Map<string, number[]>();
        for (const left of positive) {
            for (const right of negative) {
                const merged = [
                    ...left.filter((literal) => literal !== variable),
                    ...right.filter((literal) => literal !== -variable),
                ];
                const resolvent = normalize(merged);
                if (resolvent !== null) {
                    resolvents.set(clauseKey(resolvent), resolvent);
                }
            }
        }
        clauses = [...others, ...resolvents.values()];
        eliminated += 1;
        yield emit(
            "searching",
            `Resolved variable ${variable} away into ${resolvents.size} resolvent clause(s).`,
            4,
        );
        if (clauses.some((clause) => clause.length === 0)) {
            status = "unsatisfiable";
        }
    }

    const message =
        status === "satisfiable"
            ? `No clauses remain after ${eliminated} elimination(s): the formula is satisfiable.`
            : `An empty clause was derived after ${eliminated} elimination(s): unsatisfiable.`;
    yield emit(status, message, 6);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Resolution lets a variable disappear without guessing its truth value. For a variable x, pair every clause containing x with every clause containing not x and merge the two, dropping the complementary literals. If the pair cancels completely it produces an empty clause, which proves the whole formula cannot be satisfied.",
        invariants: [
            "Each derived clause is implied by the clauses it was resolved from.",
            "Unit propagation and pure literal removal preserve satisfiability.",
            "Once a variable is eliminated it no longer appears in any clause.",
        ],
        correctness:
            "Resolution is sound because a resolvent follows from its two parent clauses, and complete in this setting because repeatedly removing variables either empties the clause set (a satisfying assignment exists) or derives the empty clause. Unit propagation and pure literal elimination are satisfiability-preserving simplifications, so the final verdict matches the original formula.",
        complexityRationale:
            "Resolving on one variable forms a product of the positive and negative clause counts, and clause sets can grow, so the procedure is exponential in the worst case. Space is bounded by the largest intermediate clause set held during elimination.",
        uses: [
            "Foundational reasoning about propositional satisfiability",
            "A teaching step toward DPLL and modern CDCL solvers",
            "Preprocessing clause sets by unit and pure literal simplification",
        ],
        references: [
            "Davis and Putnam, A Computing Procedure for Quantification Theory, 1960",
            "Knuth, The Art of Computer Programming, Volume 4, Satisfiability",
        ],
        workedExample:
            "For clauses [1], [-1, 2], [-2], unit propagation sets 1 true, leaving [2], whose unit sets 2 true, leaving [-2] and deriving the empty clause. The formula is unsatisfiable. For [1, 2] and [3] the unit 3 is pure and removed, then 1 and 2 are pure, so no clauses remain and the formula is satisfiable.",
    },
    id: "davis-putnam-sat",
    name: "Davis-Putnam SAT",
    category: "searching",
    complexity: { time: "Exponential", space: "O(clause set)" },
    defaultInput: {
        clauses: [
            [1, 2],
            [-1, 3],
            [-2, 3],
            [3],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with the given clause set",
        "apply unit propagation until no unit clause remains",
        "remove any clause satisfied by a pure literal",
        "if no clauses remain, report satisfiable",
        "choose a variable and resolve every positive clause with every negative clause",
        "if the empty clause appears, report unsatisfiable",
        "done: report the final verdict",
    ],
};

export default module;
