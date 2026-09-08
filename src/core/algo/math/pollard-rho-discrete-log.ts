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
 * pollard-rho-discrete-log – Pollard's Rho for Discrete Logs.
 * Tortoise-and-hare random walk; collision solves for x.
 * Default 2^x = 7 mod 11 gives x = 7. Bounded walk, always ends.
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
    const t = (input as { p?: number; g?: number; h?: number } | null) ?? {};
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 11;
    const g = typeof t.g === "number" ? Math.trunc(t.g) : 2;
    const h = typeof t.h === "number" ? Math.trunc(t.h) : 7;
    const q = p - 1;
    let step = 0;
    if (!(p >= 3)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate parameters – nothing to solve.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const nxt = (v: number, a: number, b: number): [number, number, number] => {
        const r = v % 3;
        if (r === 0) return [(v * g) % p, (a + 1) % q, b];
        if (r === 1) return [(v * h) % p, a, (b + 1) % q];
        return [(v * v) % p, (2 * a) % q, (2 * b) % q];
    };
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `g=${g}`, g, "idle"),
            C(0, 1, `h=${h}`, h, "idle"),
            C(0, 2, `p=${p}`, p, "idle"),
        ],
        edges: [],
        description: `Solve ${g}^x = ${h} mod ${p} with Floyd walk from v=1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    let T: [number, number, number] = [1, 0, 0];
    let H: [number, number, number] = [1, 0, 0];
    let answer = -1;
    for (let i = 0; i < 60; i += 1) {
        T = nxt(T[0], T[1], T[2]);
        H = nxt(H[0], H[1], H[2]);
        H = nxt(H[0], H[1], H[2]);
        if (i < 4) {
            yield {
                stepNumber: step,
                entities: [
                    C(0, 0, `T=${T[0]}`, T[0], "comparing"),
                    C(0, 1, `H=${H[0]}`, H[0], "highlight"),
                ],
                edges: [],
                description: `Step ${i + 1}: tortoise=${T[0]}, hare=${H[0]}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { i },
            };
            step += 1;
        }
        if (T[0] === H[0]) {
            const num = (((T[1] - H[1]) % q) + q) % q;
            const den = (((H[2] - T[2]) % q) + q) % q;
            for (let x = 0; x < q; x += 1) {
                if ((den * x) % q === num && modPow(g, x, p) === ((h % p) + p) % p) {
                    answer = x;
                    break;
                }
            }
            break;
        }
    }
    if (answer < 0) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `T=${T[0]}`, T[0], "highlight")],
            edges: [],
            description: `No usable collision within cap – stopping honestly.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `v=${T[0]}`, T[0], "comparing"),
            C(0, 1, `x=${answer}`, answer, "sorted"),
        ],
        edges: [],
        description: `Collision at ${T[0]} solves x = ${answer}; ${g}^${answer} = ${h} mod ${p}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { x: answer },
    };
}
const module: AlgorithmModule = {
    id: "pollard-rho-discrete-log",
    name: "Pollard Rho Discrete Log",
    category: "math",
    complexity: { time: "O(sqrt(p)) expected", space: "O(1)" },
    defaultInput: { p: 11, g: 2, h: 7 },
    visualType: "grid",
    run,
};
export default module;
