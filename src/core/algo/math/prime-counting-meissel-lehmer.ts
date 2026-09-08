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
            meta: {},
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
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: primes.slice(0, 10).map((p, i) => C(0, i, `${p}`, p, "idle")),
        edges: [],
        description: `Small primes to ${n}: [${primes}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
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
    id: "prime-counting-meissel-lehmer",
    name: "Prime Counting (Meissel-Lehmer)",
    category: "math",
    complexity: { time: "O(n^(2/3))", space: "O(sqrt(n))" },
    defaultInput: { n: 30 },
    visualType: "grid",
    run,
};
export default module;
