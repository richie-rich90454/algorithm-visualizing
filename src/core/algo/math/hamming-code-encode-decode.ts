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
 * hamming-code-encode-decode – Hamming(7,4) Encode and Fix.
 * Parities cover halves of positions; syndrome locates one error.
 * Default data 1011 -> [0,1,1,0,0,1,1]; fixes error at 6.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { data?: number[]; error?: number } | null) ?? {};
    const data = Array.isArray(t.data) ? [...(t.data as number[])] : [1, 0, 1, 1];
    const err = typeof t.error === "number" ? Math.trunc(t.error) : 6;
    let step = 0;
    if (data.length !== 4 || data.some((v) => v !== 0 && v !== 1) || !(err >= 1) || err > 7) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs 4 bits and 1 <= error <= 7).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: data.map((v, i) => C(0, i, `${v}`, v, "idle")),
        edges: [],
        description: `Data [${data}] into positions 3,5,6,7.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const [d1, d2, d3, d4] = [
        data[0] as number,
        data[1] as number,
        data[2] as number,
        data[3] as number,
    ];
    const p1 = d1 ^ d2 ^ d4,
        p2 = d1 ^ d3 ^ d4,
        p3 = d2 ^ d3 ^ d4;
    const code = [p1, p2, d1, p3, d2, d3, d4];
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `p1=${p1}`, p1, "comparing"),
            C(0, 1, `p2=${p2}`, p2, "comparing"),
            C(0, 2, `p3=${p3}`, p3, "comparing"),
        ],
        edges: [],
        description: `Parities p1=${p1}, p2=${p2}, p3=${p3} (even parity).`,
        codeLineNumber: 1,
        layout: "grid",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: code.map((v, i) => C(0, i, `${v}`, v, "sorted")),
        edges: [],
        description: `Codeword [${code}].`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { code },
    };
    step += 1;
    const rx = [...code];
    rx[err - 1] = 1 - (rx[err - 1] as number);
    yield {
        stepNumber: step,
        entities: rx.map((v, i) => C(0, i, `${v}`, v, i === err - 1 ? "swapped" : "idle")),
        edges: [],
        description: `Noise flips position ${err}: [${rx}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const s1 = (rx[0] as number) ^ (rx[2] as number) ^ (rx[4] as number) ^ (rx[6] as number);
    const s2 = (rx[1] as number) ^ (rx[2] as number) ^ (rx[5] as number) ^ (rx[6] as number);
    const s3 = (rx[3] as number) ^ (rx[4] as number) ^ (rx[5] as number) ^ (rx[6] as number);
    const syn = s1 + 2 * s2 + 4 * s3;
    rx[syn - 1] = 1 - (rx[syn - 1] as number);
    const fixed = rx.every((v, i) => v === code[i]);
    yield {
        stepNumber: step,
        entities: rx.map((v, i) => C(0, i, `${v}`, v, fixed ? "sorted" : "swapped")),
        edges: [],
        description: `Syndrome ${s3}${s2}${s1} = ${syn}; flip ${syn} -> [${rx}] ${fixed ? "matches" : "MISMATCH"}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { syn, fixed },
    };
}
const module: AlgorithmModule = {
    id: "hamming-code-encode-decode",
    name: "Hamming Code (7,4)",
    category: "math",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { data: [1, 0, 1, 1], error: 6 },
    visualType: "grid",
    run,
};
export default module;
