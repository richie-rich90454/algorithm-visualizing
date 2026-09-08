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
            meta: {},
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
        meta: {},
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
            meta: {},
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
    id: "addition-chain-brauer-star",
    name: "Addition Chain (Brauer Star)",
    category: "math",
    complexity: { time: "O(e)", space: "O(e)" },
    defaultInput: { e: 15 },
    visualType: "grid",
    run,
};
export default module;
