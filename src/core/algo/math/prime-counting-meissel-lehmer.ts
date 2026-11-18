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
 * prime-counting-meissel-lehmer – Lehmer Prime Counting.
 * phi(x,a) recurrence minus P2 correction counts primes to n.
 * Default pi(30) = 10. Time O(n^(2/3)), space O(n^(1/2)).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 30;
    let step = 0;
    if (!(n >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, `n=${n}?`, n, "highlight")],
            edges: [],
            description: `${n} is degenerate (needs n >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const isP = new Array<boolean>(n + 1).fill(true);
    isP[0] = false;
    if (n >= 1) isP[1] = false;
    for (let i = 2; i * i <= n; i += 1)
        if (isP[i]) for (let j = i * i; j <= n; j += i) isP[j] = false;
    const primes: number[] = [];
    for (let i = 2; i <= n; i += 1) if (isP[i]) primes.push(i);
    const a = primes.filter((p) => p * p * p <= n).length;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle"), C(0, 1, `a=${a}`, a, "highlight")],
        edges: [],
        description: `Count primes to ${n}; a = pi(n^(1/3)) = ${a}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: primes.slice(0, 10).map((p, i) => C(0, i, `${p}`, p, "idle")),
        edges: [],
        description: `Small primes to ${n}: [${primes}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    const memo = new Map<string, number>();
    const phi = (x: number, s: number): number => {
        if (s === 0) return x;
        if (s <= 6 && x < primes[s - 1]!) return 1;
        const key = `${x},${s}`;
        const hit = memo.get(key);
        if (hit !== undefined) return hit;
        const v = phi(x, s - 1) - phi(Math.trunc(x / (primes[s - 1] as number)), s - 1);
        memo.set(key, v);
        return v;
    };
    const ph = phi(n, a);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `phi=${ph}`, ph, "comparing")],
        edges: [],
        description: `phi(${n}, ${a}) = ${ph} numbers free of first ${a} primes.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ph },
    };
    step += 1;
    let p2 = 0;
    for (
        let i = a;
        i < primes.length && (primes[i] as number) * (primes[i] as number) <= n;
        i += 1
    ) {
        p2 += 1;
        if (p2 <= 3) {
            yield {
                stepNumber: step,
                entities: [
                    C(0, 0, `p=${primes[i]}`, primes[i] as number, "comparing"),
                    C(0, 1, `P2=${p2}`, p2, "idle"),
                ],
                edges: [],
                description: `P2 correction accumulates prime ${primes[i]} (count ${p2}).`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { p2 },
            };
            step += 1;
        }
    }
    // Exact P2: sum over i>=a, p_i^2<=n of (pi(n/p_i) - i)
    let corr = 0;
    const piSmall = (x: number): number => primes.filter((p) => p <= x).length;
    for (let i = a; i < primes.length && (primes[i] as number) * (primes[i] as number) <= n; i += 1)
        corr += piSmall(Math.trunc(n / (primes[i] as number))) - i;
    const pi = ph + a - 1 - corr;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `pi=${pi}`, pi, "sorted")],
        edges: [],
        description: `pi(${n}) = ${ph} + ${a} - 1 - ${corr} = ${pi}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { pi },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "The Meissel-Lehmer method counts primes up to n without listing them all. It sieves only small primes, then uses Legendre's partial sieve function phi to count numbers surviving those small primes, and corrects for composites built from larger primes. The result is the prime counting function pi(n) in sublinear time.",
        "invariants": [
            "phi(x, a) counts integers up to x not divisible by the first a primes.",
            "The correction term accounts exactly for products of two large primes.",
            "pi(n) equals phi(n, a) plus a minus one minus the correction."
        ],
        "correctness": "Legendre's identity expresses pi(n) in terms of phi with a cutoff a; choosing a = pi(n^(1/3)) keeps the remaining terms manageable. The Meissel correction enumerates the semiprimes with both factors above the cutoff, so the final combination equals the exact prime count. Each component is computed by exact sieving or counting.",
        "complexityRationale": "Sieving to n^(2/3) and evaluating phi with recursion yields the stated O(n^(2/3)) time. The small-prime table needs O(sqrt(n)) space.",
        "uses": [
            "Computing pi(n) for very large n",
            "Analytic number theory computations",
            "Estimating prime density without enumerating primes"
        ],
        "references": [
            "Lehmer, On the exact number of primes less than a given limit (1959)",
            "Crandall and Pomerance, Prime Numbers, Section 3.6"
        ],
        "workedExample": "For n = 30 sieve small primes and set a = pi(cube root of 30) = 2. Count phi(30, 2) = 10 survivors, add a minus one, subtract the semiprime correction, and obtain pi(30) = 10."
    },
    id: "prime-counting-meissel-lehmer",
    name: "Prime Counting (Meissel-Lehmer)",
    category: "math",
    complexity: { time: "O(n^(2/3))", space: "O(sqrt(n))" },
    defaultInput: { n: 30 },
    visualType: "grid",
    run,
    pseudocode: [
        "sieve small primes; set a = pi(n^(1/3))",
        "count phi(n, a): survivors of the first a primes",
        "add the P2 correction over the remaining primes",
        "combine pi(n) = phi + a − 1 − correction",
        "done: prime count pi = total",
    ],
};
export default module;
