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
 * multiplicative-order-finding – Multiplicative Order.
 * Shrinks ord = phi by prime factors while a^(ord/q) = 1.
 * Default ord_11(2) = 10. Time O(sqrt(phi) + log phi).
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
    const t = (input as { a?: number; n?: number } | null) ?? {};
    const a = typeof t.a === "number" ? Math.trunc(t.a) : 2;
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 11;
    let step = 0;
    if (!(n >= 2) || !(a >= 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs a >= 1, n >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    let g = a,
        m = n;
    while (m !== 0) {
        const r = g - Math.trunc(g / m) * m;
        g = m;
        m = r;
    }
    if (g !== 1) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `gcd=${g}`, g, "swapped")],
            edges: [],
            description: `gcd(${a}, ${n}) = ${g} != 1 – no order exists.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    let ord = n - 1;
    // shrink with Euler's totient bound only if n prime; else brute-force up to n
    const phi = n - 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `a=${a}`, a, "idle"), C(0, 1, `n=${n}`, n, "idle")],
        edges: [],
        description: `Order of ${a} mod ${n}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    let tmp = phi;
    const fac: number[] = [];
    for (let d = 2; d * d <= tmp; d += 1) {
        if (tmp - Math.trunc(tmp / d) * d === 0) {
            fac.push(d);
            while (tmp - Math.trunc(tmp / d) * d === 0) tmp = Math.trunc(tmp / d);
        }
    }
    if (tmp > 1) fac.push(tmp);
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `ord|${phi}`, phi, "highlight"),
            ...fac.map((q, i) => C(1, i, `${q}`, q, "idle")),
        ],
        edges: [],
        description: `Order divides ${phi} = factors [${fac}]; try shrinking.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    for (const q of fac) {
        const cand = Math.trunc(ord / q);
        if (ord - cand * q === 0 && modPow(a, cand, n) === 1) {
            ord = cand;
            yield {
                stepNumber: step,
                entities: [
                    C(0, 0, `/${q}`, q, "comparing"),
                    C(0, 1, `ord=${ord}`, ord, "highlight"),
                ],
                edges: [],
                description: `${a}^${ord} = 1 mod ${n} – shrink to ${ord}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { ord },
            };
            step += 1;
        } else if (ord - cand * q === 0) {
            yield {
                stepNumber: step,
                entities: [
                    C(0, 0, `/${q}`, q, "comparing"),
                    C(0, 1, `${a}^${cand}=${modPow(a, cand, n)}`, modPow(a, cand, n), "idle"),
                ],
                edges: [],
                description: `${a}^${cand} != 1 mod ${n} – keep ${ord}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { ord },
            };
            step += 1;
        }
    }
    if (modPow(a, ord, n) !== 1) {
        for (let k = 1; k <= n; k += 1) {
            if (modPow(a, k, n) === 1) {
                ord = k;
                break;
            }
        }
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `ord=${ord}`, ord, "sorted")],
        edges: [],
        description: `ord_${n}(${a}) = ${ord}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ord },
    };
}
const module: AlgorithmModule = {
    id: "multiplicative-order-finding",
    name: "Multiplicative Order Finding",
    category: "math",
    complexity: { time: "O(sqrt(n) + log n)", space: "O(1)" },
    defaultInput: { a: 2, n: 11 },
    visualType: "grid",
    run,
};
export default module;
