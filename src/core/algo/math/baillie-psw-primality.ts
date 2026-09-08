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
 * baillie-psw-primality – Baillie-PSW Primality Test.
 * Stage 1 Miller-Rabin base 2; stage 2 Lucas would follow.
 * Default n=21 fails base 2 (composite), Lucas skipped honestly.
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
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 21;
    let step = 0;
    if (!(n >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    if (n % 2 === 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, `${n}`, n, "swapped")],
            edges: [],
            description: `${n} is even – composite${n === 2 ? ", except 2 is prime" : ""}.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { prime: n === 2 },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle")],
        edges: [],
        description: `Baillie-PSW on ${n}: stage 1 Miller-Rabin base 2.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    let d = n - 1,
        s = 0;
    while (d % 2 === 0) {
        d = Math.trunc(d / 2);
        s += 1;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `d=${d}`, d, "comparing"), C(0, 1, `s=${s}`, s, "comparing")],
        edges: [],
        description: `${n}-1 = ${d} x 2^${s}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { d, s },
    };
    step += 1;
    let x = modPow(2, d, n);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `x=${x}`, x, "comparing")],
        edges: [],
        description: `2^${d} mod ${n} = ${x}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { x },
    };
    step += 1;
    if (x === 1 || x === n - 1) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `x=${x}`, x, "highlight")],
            edges: [],
            description: `Passes base 2 – Lucas stage would run next (demo stops here).`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {},
        };
        return;
    }
    let comp = true;
    for (let r = 1; r < s; r += 1) {
        x = (x * x) % n;
        yield {
            stepNumber: step,
            entities: [C(0, 0, `x=${x}`, x, "comparing")],
            edges: [],
            description: `Square ${r}: x = ${x} mod ${n}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { x },
        };
        step += 1;
        if (x === n - 1) {
            comp = false;
            break;
        }
        if (step > 10) break;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, comp ? "swapped" : "highlight")],
        edges: [],
        description: comp
            ? `Never hit +-1 – ${n} is COMPOSITE (Lucas stage skipped).`
            : `Hit -1 – passes base 2; Lucas stage would run next.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { composite: comp },
    };
}
const module: AlgorithmModule = {
    id: "baillie-psw-primality",
    name: "Baillie-PSW Primality",
    category: "math",
    complexity: { time: "O(log^3 n)", space: "O(1)" },
    defaultInput: { n: 21 },
    visualType: "grid",
    run,
};
export default module;
