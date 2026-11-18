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
 * G(i) = i XOR (i >> 1); neighbors differ in exactly one bit.
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
            meta: { step },
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
        meta: { step },
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

    education: {
        "intuition": "A Gray code lists all 2^n binary strings so that consecutive codes differ in exactly one bit. The reflected binary construction builds the list for n from the list for n-1 by prefixing zeros to the original order and ones to the reverse order. A compact formula encodes index i as i XOR (i shifted right by one).",
        "invariants": [
            "The sequence contains all 2^n distinct codes exactly once.",
            "Every adjacent pair differs in a single bit position.",
            "Encoding i as i xor (i >> 1) is a bijection on n-bit values."
        ],
        "correctness": "In the reflected construction the two halves each preserve the one-bit property by induction, and the boundary between them differs only in the new leading bit, so the whole list is a Gray code. The XOR formula is equivalent to this reflected order, which follows because consecutive integers change at the position one less than their lowest set bit.",
        "complexityRationale": "Generating each of the 2^n codes takes constant time, so time is O(2^n). Storing the full sequence also requires O(2^n) space.",
        "uses": [
            "Rotary and optical encoders that change one sensor bit at a time",
            "Reducing switching activity in low-power digital circuits",
            "Gray-code based heuristics in optimization"
        ],
        "references": [
            "Gray, Pulse code communication (1947)",
            "Knuth, The Art of Computer Programming, Vol. 4, Section 7.2.1.1"
        ],
        "workedExample": "For bits = 3 the codes are 000, 001, 011, 010, 110, 111, 101, 100. Each step flips exactly one bit, including the wrap from 100 back to 000."
    },
    id: "gray-code-generation",
    name: "Gray Code Generation",
    category: "math",
    complexity: { time: "O(2^n)", space: "O(2^n)" },
    defaultInput: { bits: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "plan 2^bits values for the Gray sequence",
        "encode G(i) = i xor (i >> 1): one bit flips",
        "done: full Gray sequence of 2^bits codes",
        "adjacent codes always differ by exactly one bit",
        "done: sequence runs 0 to 2^bits − 1",
    ],
};
export default module;
