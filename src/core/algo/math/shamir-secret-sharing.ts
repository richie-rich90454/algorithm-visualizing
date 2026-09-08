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
 * shamir-secret-sharing – Shamir Secret Sharing.
 * Deals f(x) = s + c1 x (+...); any threshold points rebuild s.
 * Default s=7 mod 13, f=7+3x, shares (1,10),(2,0),(3,3).
 */
function modInv(a: number, p: number): number {
    const v = ((a % p) + p) % p;
    for (let x = 1; x < p; x += 1) if ((v * x) % p === 1) return x;
    return 0;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { secret?: number; mod?: number } | null) ?? {};
    const s = typeof t.secret === "number" ? Math.trunc(t.secret) : 7;
    const p = typeof t.mod === "number" ? Math.trunc(t.mod) : 13;
    const c1 = 3;
    let step = 0;
    if (!(p >= 2) || !(s >= 0) || s >= p) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs 0 <= secret < mod).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `s=${s}`, s, "highlight"), C(0, 1, `mod=${p}`, p, "idle")],
        edges: [],
        description: `Secret ${s} mod ${p}, threshold 2: f(x) = ${s}+${c1}x.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const shares: Array<[number, number]> = [];
    for (let x = 1; x <= 3; x += 1) shares.push([x, (s + c1 * x) % p]);
    for (let i = 0; i < shares.length; i += 1) {
        const [x, y] = shares[i] as [number, number];
        yield {
            stepNumber: step,
            entities: shares
                .slice(0, i + 1)
                .map(([sx, sy], j) =>
                    C(0, j, `(${sx},${sy})`, sy, j === i ? "comparing" : "sorted"),
                ),
            edges: [],
            description: `Share ${i + 1}: f(${x}) = ${y}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { x, y },
        };
        step += 1;
    }
    const [x0, y0] = shares[0] as [number, number];
    const [x1, y1] = shares[1] as [number, number];
    const l0 = (((((0 - x1) % p) + p) % p) * modInv((((x0 - x1) % p) + p) % p, p)) % p;
    const l1 = (((((0 - x0) % p) + p) % p) * modInv((((x1 - x0) % p) + p) % p, p)) % p;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `L0=${l0}`, l0, "comparing"), C(0, 1, `L1=${l1}`, l1, "comparing")],
        edges: [],
        description: `Lagrange at 0: L0=${l0}, L1=${l1}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { l0, l1 },
    };
    step += 1;
    const rec = (y0 * l0 + y1 * l1) % p;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `s=${rec}`, rec, "sorted")],
        edges: [],
        description: `Rebuilt ${y0}x${l0} + ${y1}x${l1} = ${rec} mod ${p} – secret recovered.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rec },
    };
}
const module: AlgorithmModule = {
    id: "shamir-secret-sharing",
    name: "Shamir Secret Sharing",
    category: "math",
    complexity: { time: "O(t^2)", space: "O(n)" },
    defaultInput: { secret: 7, mod: 13 },
    visualType: "grid",
    run,
};
export default module;
