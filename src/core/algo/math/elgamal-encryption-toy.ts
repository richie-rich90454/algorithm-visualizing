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
 * elgamal-encryption-toy – Toy ElGamal Encryption.
 * Tiny prime 11 keeps every power checkable by hand.
 * Default m=5 -> (c1,c2) = (5,9), decrypts to 5. Time O(log p).
 */
function modPow(b: number, e: number, m: number): number {
    let r = 1;
    let x = ((b % m) + m) % m;
    let k = e;
    while (k > 0) {
        if (k % 2 === 1) r = (r * x) % m;
        x = (x * x) % m;
        k = Math.trunc(k / 2);
    }
    return r;
}
function modInv(a: number, p: number): number {
    const v = ((a % p) + p) % p;
    for (let x = 1; x < p; x += 1) if ((v * x) % p === 1) return x;
    return 0;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t =
        (input as { p?: number; g?: number; x?: number; m?: number; k?: number } | null) ?? {};
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 11;
    const g = typeof t.g === "number" ? Math.trunc(t.g) : 2;
    const x = typeof t.x === "number" ? Math.trunc(t.x) : 3;
    const m = typeof t.m === "number" ? Math.trunc(t.m) : 5;
    const k = typeof t.k === "number" ? Math.trunc(t.k) : 4;
    let step = 0;
    if (!(p >= 3) || !(m >= 1) || m >= p) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs prime p, 1 <= m < p).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const h = modPow(g, x, p);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `p=${p}`, p, "idle"), C(0, 1, `m=${m}`, m, "idle")],
        edges: [],
        description: `ElGamal mod ${p}: encrypt message ${m}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `g=${g}`, g, "idle"),
            C(0, 1, `x=${x}`, x, "idle"),
            C(0, 2, `h=${h}`, h, "highlight"),
        ],
        edges: [],
        description: `Keygen: h = ${g}^${x} = ${h} mod ${p}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { h },
    };
    step += 1;
    const c1 = modPow(g, k, p);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `c1=${c1}`, c1, "comparing")],
        edges: [],
        description: `c1 = ${g}^${k} = ${c1} mod ${p}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { c1 },
    };
    step += 1;
    const s = modPow(h, k, p);
    const c2 = (m * s) % p;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `s=${s}`, s, "comparing"), C(0, 1, `c2=${c2}`, c2, "highlight")],
        edges: [],
        description: `Shared ${h}^${k} = ${s}; c2 = ${m}x${s} = ${c2}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { c2 },
    };
    step += 1;
    const s2 = modPow(c1, x, p);
    const dec = (c2 * modInv(s2, p)) % p;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `m=${dec}`, dec, dec === m ? "sorted" : "swapped")],
        edges: [],
        description: `Decrypt ${c2} / ${c1}^${x}=${s2} = ${dec}${dec === m ? " – matches" : " – MISMATCH"}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { dec },
    };
}
const module: AlgorithmModule = {
    id: "elgamal-encryption-toy",
    name: "ElGamal Encryption (Toy)",
    category: "math",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { p: 11, g: 2, x: 3, m: 5, k: 4 },
    visualType: "grid",
    run,
};
export default module;
