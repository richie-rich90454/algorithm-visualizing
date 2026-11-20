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
 * hensel-lifting-root – Hensel Lifting.
 * Lifts root r of f mod p^k via t = f(r)/p^k, c = -t/f'(r).
 * Default x^2=2: 3 mod 7 lifts to 10 mod 49. Time O(log p).
 */
function modInv(a: number, p: number): number {
    const v = ((a % p) + p) % p;
    for (let x = 1; x < p; x += 1) if ((v * x) % p === 1) return x;
    return 0;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { p?: number; r?: number; power?: number; target?: number } | null) ?? {};
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 7;
    const r0 = typeof t.r === "number" ? Math.trunc(t.r) : 3;
    const e = typeof t.power === "number" ? Math.trunc(t.power) : 2;
    const a = typeof t.target === "number" ? Math.trunc(t.target) : 2;
    let step = 0;
    if (!(p >= 2) || !(e >= 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs prime p, power >= 1).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const f = (x: number): number => x * x - a;
    const fp = (x: number): number => 2 * x;
    if (((f(r0) % p) + p) % p !== 0) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `r=${r0}`, r0, "swapped")],
            edges: [],
            description: `${r0}^2 = ${r0 * r0} != ${a} mod ${p} – not a root, stopping honestly.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `f=x^2-${a}`, a, "idle"), C(0, 1, `p=${p}`, p, "idle")],
        edges: [],
        description: `Lift a root of x^2 = ${a} from mod ${p} to mod ${p}^${e}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `r=${r0}`, r0, "comparing"), C(0, 1, `p=${p}`, p, "idle")],
        edges: [],
        description: `Root ${r0}^2 = ${r0 * r0} = ${a} mod ${p}; f' = ${fp(r0)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    let r = r0;
    let mod = p;
    for (let k = 1; k < e; k += 1) {
        const next = mod * p;
        const t0 = Math.trunc(f(r) / mod);
        const t0m = ((t0 % p) + p) % p;
        const inv = modInv(((fp(r) % p) + p) % p, p);
        if (inv === 0) {
            yield {
                stepNumber: step,
                entities: [C(0, 0, `r=${r}`, r, "swapped")],
                edges: [],
                description: `f'(r) = 0 mod ${p} – cannot lift, stopping honestly.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { step },
            };
            return;
        }
        const c = (((p - ((t0m * inv) % p)) % p) + p) % p;
        yield {
            stepNumber: step,
            entities: [C(0, 0, `r=${r}`, r, "comparing"), C(0, 1, `mod=${mod}`, mod, "idle")],
            edges: [],
            description: `f(${r}) = ${f(r)}; t = f(r)/${mod} = ${t0m} mod ${p}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { t0m },
        };
        step += 1;
        r = r + c * mod;
        mod = next;
        yield {
            stepNumber: step,
            entities: [C(0, 0, `c=${c}`, c, "comparing"), C(0, 1, `r=${r}`, r, "highlight")],
            edges: [],
            description: `Correction c = -t/f'(r) = ${c}; new r = ${r} mod ${mod}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { r, mod },
        };
        step += 1;
    }
    const ok = (((r * r - a) % mod) + mod) % mod === 0;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `r=${r}`, r, ok ? "sorted" : "swapped")],
        edges: [],
        description: ok
            ? `${r}^2 = ${r * r} = ${a} mod ${mod} – lifted root verified.`
            : `Check failed – stopping honestly.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { r, ok },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Hensel lifting refines a solution of a polynomial congruence modulo a prime into a solution modulo a higher power of that prime. It uses a first-order Taylor step: measure how far the current root is from satisfying the equation, then correct it using the inverse of the derivative. Each lift doubles the number of correct p-adic digits.",
        "invariants": [
            "The current residue r satisfies f(r) = 0 modulo the current power of p.",
            "The derivative f'(r) is nonzero modulo p so its inverse exists.",
            "Each lift increases the modulus by a factor of p while preserving the congruence."
        ],
        "correctness": "Taylor expansion gives f(r + c*p^k) = f(r) + c*p^k*f'(r) modulo p^(k+1). Choosing c to cancel f(r)/p^k requires dividing by f'(r), which is invertible by assumption, so the corrected r satisfies the congruence to the next power. Induction lifts the root as far as needed.",
        "complexityRationale": "Each lift performs a few arithmetic operations on numbers of size O(log power), costing O(log p) time per level. With only the current root, modulus, and derivative stored, space is O(1).",
        "uses": [
            "Lifting modular square roots in primality and factoring routines",
            "p-adic methods in number theory and algebraic geometry",
            "Solving polynomial congruences to high prime powers"
        ],
        "references": [
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 5",
            "Koblitz, p-adic Numbers, p-adic Analysis, and Zeta-Functions, Chapter 1"
        ],
        "workedExample": "Start with r = 3 satisfying r^2 = 2 mod 7 since 9 = 2 mod 7. With f'(r) = 2r = 6 and its inverse 6 mod 7, the correction cancels (r^2-2)/7, giving a residue modulo 49 whose square is 2 mod 49."
    },
    id: "hensel-lifting-root",
    name: "Hensel Lifting",
    category: "math",
    complexity: { time: "O(log p) per lift", space: "O(1)" },
    defaultInput: { p: 7, r: 3, power: 2, target: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "check the starting root mod p with nonzero derivative",
        "measure the error t = f(r)/mod mod p",
        "correct with c = −t/f′(r) and lift r higher",
        "verify r² ≡ a at the new modulus",
        "done: lifted root verified, or honest stop",
    ],
};
export default module;
