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
 * legendre-symbol-euler-criterion – Legendre Symbol via Euler.
 * (a|p) = a^((p-1)/2) mod p, mapped to +1 / -1 / 0.
 * Default (5|11) = 1 since 4^2 = 16 = 5 mod 11. Time O(log p).
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
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: number; p?: number } | null) ?? {};
    const a = typeof t.a === "number" ? Math.trunc(t.a) : 5;
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 11;
    let step = 0;
    if (!(p >= 3)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs odd prime p >= 3).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const am = ((a % p) + p) % p;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `a=${am}`, am, "idle"), C(0, 1, `p=${p}`, p, "idle")],
        edges: [],
        description: `Compute (${a}|${p}) via Euler: a^((p-1)/2) mod p.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    if (am === 0) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, "0", 0, "sorted")],
            edges: [],
            description: `${p} divides ${a} – symbol is 0.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { legendre: 0 },
        };
        return;
    }
    const e = Math.trunc((p - 1) / 2);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `e=${e}`, e, "highlight")],
        edges: [],
        description: `Exponent (p-1)/2 = ${e}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { e },
    };
    step += 1;
    const v = modPow(am, e, p);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${am}^${e}`, v, "comparing")],
        edges: [],
        description: `${am}^${e} mod ${p} = ${v}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { v },
    };
    step += 1;
    const leg = v === 1 ? 1 : -1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${leg}`, leg, "comparing")],
        edges: [],
        description:
            leg === 1
                ? `Result 1 – ${am} is a quadratic residue mod ${p}.`
                : `Result ${p - 1} maps to -1 – non-residue mod ${p}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { legendre: leg },
    };
    step += 1;
    let wit = -1;
    for (let x = 1; x < p; x += 1) {
        if ((x * x) % p === am) {
            wit = x;
            break;
        }
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${leg}`, leg, "sorted")],
        edges: [],
        description:
            wit > 0
                ? `Witness ${wit}^2 = ${wit * wit} = ${am} mod ${p} – confirmed.`
                : `No square root – confirmed non-residue.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { legendre: leg, wit },
    };
}
const module: AlgorithmModule = {
    id: "legendre-symbol-euler-criterion",
    name: "Legendre Symbol (Euler)",
    category: "math",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { a: 5, p: 11 },
    visualType: "grid",
    run,
};
export default module;
