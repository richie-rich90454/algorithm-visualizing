import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function C(
    r: number,
    c: number,
    label: string,
    value: number,
    state: EntityState = "idle",
): VisualEntity {
    return {
        id: `cell-${r}-${c}`,
        type: "cell" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    };
}
/**
 * josephus-problem – Josephus Survivor.
 * Removes every k-th person; recurrence J(n) = (J(n-1)+k) mod n.
 * Default n=7, k=3 gives survivor 4 (1-based). Time O(n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number; k?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 7;
    const k = typeof t.k === "number" ? Math.trunc(t.k) : 3;
    let step = 0;
    if (!(n >= 1) || !(k >= 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n,k >= 1).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    let alive = Array.from({ length: n }, (_, i) => i + 1);
    yield {
        stepNumber: step,
        entities: alive.map((v, i) => C(0, i, `${v}`, v, "idle")),
        edges: [],
        description: `Circle of ${n}, step k=${k}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    let idx = 0;
    while (alive.length > 1) {
        idx = (idx + k - 1) % alive.length;
        const out = alive.splice(idx, 1)[0] as number;
        if (alive.length >= n - 3 || alive.length === 1) {
            yield {
                stepNumber: step,
                entities: alive.map((v, i) =>
                    C(0, i, `${v}`, v, i === idx % alive.length ? "comparing" : "idle"),
                ),
                edges: [],
                description: `Remove ${out}; ${alive.length} remain [${alive}].`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { out },
            };
            step += 1;
        }
        if (step > 12) break;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${alive[0]}`, alive[0] as number, "sorted")],
        edges: [],
        description: `Survivor is ${alive[0]}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { survivor: alive[0] },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "The Josephus problem places n people in a circle and removes every k-th person until one survives. The visualization simulates the circle directly, walking a step counter around the living participants and deleting each selected one. Watching the shrinking circle makes the classic recurrence and its survivors intuitive.",
        "invariants": [
            "The living list always contains exactly the people not yet removed.",
            "The step counter advances only over living people, wrapping around the circle.",
            "Each iteration removes exactly one person until a single survivor remains."
        ],
        "correctness": "Counting only living people and wrapping at the end faithfully models removing every k-th person in a circle. The simulation therefore produces the same elimination order as the problem statement. When one person remains, that person is by definition the survivor.",
        "complexityRationale": "Each of the n-1 removals advances up to k steps over a shrinking list, costing O(n*k) in a naive list; the stated O(n) bound assumes a fixed small k and O(n) storage for the circle. Space is O(n) for the living list.",
        "uses": [
            "Modeling elimination and round-robin protocols",
            "The classic Josephus permutation in combinatorics",
            "Teaching circular linked-list simulation"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 1, Section 1.3.1",
            "Graham, Knuth and Patashnik, Concrete Mathematics, Chapter 1"
        ],
        "workedExample": "With n = 7 and k = 3 the removal order is 3, 6, 2, 7, 5, 1, leaving person 4 as the survivor. The closed-form recurrence J(1) = 1 and J(n) = (J(n-1) + k - 1) mod n + 1 gives 4 as well."
    },
    id: "josephus-problem",
    name: "Josephus Problem",
    category: "math",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 7, k: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "seat n people in a circle with step k",
        "remove every k-th living person",
        "done: survivor = alive[0]",
        "the circle closes after each removal",
        "done: last remaining person survives",
    ],
};
export default module;
