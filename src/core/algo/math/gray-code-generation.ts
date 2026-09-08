import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function B(i: number, label: string, value: number, state: EntityState = "idle"): VisualEntity {
    return {
        id: `bar-${i}`,
        type: "bar" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    };
}
/**
 * gray-code-generation – Binary Reflected Gray Code.
 * G(i) = i XOR (i >> 1); neighbours differ in exactly one bit.
 * Default 3 bits: [0,1,3,2,6,7,5,4]. Time O(2^n), space O(2^n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { bits?: number } | null) ?? {};
    const bits = typeof t.bits === "number" ? Math.trunc(t.bits) : 3;
    let step = 0;
    if (!(bits >= 1) || bits > 6) {
        yield {
            stepNumber: 0,
            entities: [B(0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs 1 <= bits <= 6).`,
            codeLineNumber: 0,
            layout: "array",
            meta: {},
        };
        return;
    }
    const codes: number[] = [];
    for (let i = 0; i < 2 ** bits; i += 1) codes.push(i ^ Math.trunc(i / 2));
    yield {
        stepNumber: step,
        entities: codes.map((v, i) => B(i, `${v}`, v, "idle")),
        edges: [],
        description: `${bits}-bit Gray code has ${codes.length} values.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;
    for (let i = 0; i < codes.length; i += 1) {
        if (i > 0 && i < 4) {
            yield {
                stepNumber: step,
                entities: codes.map((v, j) =>
                    B(j, `${v}`, v, j === i ? "comparing" : j < i ? "sorted" : "idle"),
                ),
                edges: [],
                description: `G(${i}) = ${i} xor ${Math.trunc(i / 2)} = ${codes[i]} – one bit flips.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { i },
            };
            step += 1;
        }
    }
    yield {
        stepNumber: step,
        entities: codes.map((v, i) => B(i, `${v}`, v, "sorted")),
        edges: [],
        description: `Full sequence [${codes}].`,
        codeLineNumber: 2,
        layout: "array",
        meta: { codes },
    };
}
const module: AlgorithmModule = {
    id: "gray-code-generation",
    name: "Gray Code Generation",
    category: "math",
    complexity: { time: "O(2^n)", space: "O(2^n)" },
    defaultInput: { bits: 3 },
    visualType: "array",
    run,
};
export default module;
