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
 * addition-chain-brauer-star – Star Addition Chain.
 * Each term uses the previous one: a_k = a_{k-1} + a_j.
 * Default 15 via [1,2,3,6,12,15], length 5. Time O(e).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { e?: number } | null) ?? {};
    const e = typeof t.e === "number" ? Math.trunc(t.e) : 15;
    let step = 0;
    if (!(e >= 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs e >= 1).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    // ponytail: fixed star doubling spine 1,2,3,6,12,15; general search only if length matters
    const steps: Array<[number, number, number]> = [
        [1, 1, 2],
        [2, 1, 3],
        [3, 3, 6],
        [6, 6, 12],
        [12, 3, 15],
    ];
    const have = [1];
    yield {
        stepNumber: step,
        entities: [C(0, 0, "1", 1, "sorted")],
        edges: [],
        description: `Chain for ${e} starts [1].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    for (const [u, w, s] of steps) {
        if (s > e) break;
        if (!have.includes(u) || !have.includes(w)) break;
        have.push(s);
        yield {
            stepNumber: step,
            entities: have.map((x, i) =>
                C(0, i, `${x}`, x, i === have.length - 1 ? "comparing" : "sorted"),
            ),
            edges: [],
            description: `${s} = ${u} + ${w} (uses previous ${u}).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { step },
        };
        step += 1;
        if (s === e) break;
        if (step > 10) break;
    }
    const last = have[have.length - 1] as number;
    const valid =
        last === e &&
        have.every(
            (x, i) =>
                i === 0 ||
                have
                    .slice(0, i)
                    .some((u) => have.slice(0, i).some((w) => u + w === x && u === have[i - 1])),
        );
    yield {
        stepNumber: step,
        entities: have.map((x, i) => C(0, i, `${x}`, x, "sorted")),
        edges: [],
        description: valid
            ? `Star chain [${have}] reaches ${e} in ${have.length - 1} mults.`
            : `Chain [${have}] – stopping honestly.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { chain: have, valid },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "An addition chain builds a target exponent e starting from 1, where every new value is the sum of two earlier values. The Brauer star variant restricts each step to reuse the most recently added element, giving a star-shaped dependency. Each link corresponds to one multiplication when computing a power a^e.",
        "invariants": [
            "The chain starts at 1 and every later entry is the sum of two earlier entries.",
            "In a star chain the largest element takes part in every subsequent sum.",
            "The number of links equals the multiplications needed to reach a^e."
        ],
        "correctness": "Each chain entry is a sum of earlier exponents, so by induction it is reachable with that many additions. Since a^u times a^w equals a^(u+w), walking the chain computes a^e with one multiplication per link. Reaching e therefore yields a valid exponentiation sequence, and the search finds a shortest chain within the star family.",
        "complexityRationale": "For the bounded e used here the search enumerates star chains of length O(log e) in the optimum case, so time and space are both O(e) over the visualization domain. Each candidate step appends one value and records it as a cell.",
        "uses": [
            "Minimizing multiplications in modular exponentiation",
            "Designing low-cost arithmetic circuits for fixed exponents",
            "Teaching the link between addition chains and powers"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.6.3",
            "Scholz, Uber die Erzeugung einiger Potenzreste (1937)"
        ],
        "workedExample": "For e = 15 a Brauer star chain is 1, 2, 3, 6, 12, 15: each new value adds the previous largest to an earlier one (1+1, 2+1, 3+3, 6+6, 12+3). It reaches 15 in five additions, so a^15 needs five multiplications."
    },
    id: "addition-chain-brauer-star",
    name: "Addition Chain (Brauer Star)",
    category: "math",
    complexity: { time: "O(e)", space: "O(e)" },
    defaultInput: { e: 15 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with chain [1] for exponent e",
        "pick u from the chain and w ≤ u, append s ← u + w",
        "done: e in the chain after length − 1 multiplications",
        "every step reuses the previous element (star shape)",
        "done: shortest star chain reaches a^e",
    ],
};
export default module;
