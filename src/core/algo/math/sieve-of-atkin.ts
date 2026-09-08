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
 * sieve-of-atkin – Sieve of Atkin.
 * Flips candidates via 4x^2+y^2, 3x^2+y^2, 3x^2-y^2 mod-12 rules.
 * Default primes to 30 (10 total). Time O(n), space O(n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { limit?: number } | null) ?? {};
    const limit = typeof t.limit === "number" ? Math.trunc(t.limit) : 30;
    let step = 0;
    if (!(limit >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs limit >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const sieve = new Array<boolean>(limit + 1).fill(false);
    const hits: Array<[string, number[]]> = [
        ["4x^2+y^2", []],
        ["3x^2+y^2", []],
        ["3x^2-y^2", []],
    ];
    for (let x = 1; x * x <= limit; x += 1) {
        for (let y = 1; y * y <= limit; y += 1) {
            let k = 4 * x * x + y * y;
            if (k <= limit && (k % 12 === 1 || k % 12 === 5)) {
                sieve[k] = !sieve[k];
                (hits[0]![1] as number[]).push(k);
            }
            k = 3 * x * x + y * y;
            if (k <= limit && k % 12 === 7) {
                sieve[k] = !sieve[k];
                (hits[1]![1] as number[]).push(k);
            }
            k = 3 * x * x - y * y;
            if (x > y && k <= limit && k % 12 === 11) {
                sieve[k] = !sieve[k];
                (hits[2]![1] as number[]).push(k);
            }
        }
    }
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `n=${limit}`, limit, "idle"),
            C(0, 1, "2", 2, "sorted"),
            C(0, 2, "3", 3, "sorted"),
        ],
        edges: [],
        description: `Atkin to ${limit}: 2 and 3 are prime by rule.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    for (const [rule, ks] of hits) {
        const uniq = [...new Set(ks)].sort((u, v) => u - v).slice(0, 8);
        yield {
            stepNumber: step,
            entities: uniq.map((v, i) => C(0, i, `${v}`, v, "comparing")),
            edges: [],
            description: `Rule ${rule} flips [${uniq}${ks.length > 8 ? ", ..." : ""}].`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {},
        };
        step += 1;
    }
    for (let r = 5; r * r <= limit; r += 1) {
        if (sieve[r]) {
            for (let k = r * r; k <= limit; k += r * r) sieve[k] = false;
            if (r <= 7) {
                yield {
                    stepNumber: step,
                    entities: [C(0, 0, `r=${r}`, r, "comparing")],
                    edges: [],
                    description: `Clearing squares of ${r}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: { r },
                };
                step += 1;
            }
        }
    }
    const out = [2, 3].filter((p) => p <= limit);
    for (let i = 5; i <= limit; i += 1) if (sieve[i]) out.push(i);
    yield {
        stepNumber: step,
        entities: out.map((p, i) => C(0, i, `${p}`, p, "sorted")),
        edges: [],
        description: `Primes to ${limit}: [${out}] (${out.length} total).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { count: out.length },
    };
}
const module: AlgorithmModule = {
    id: "sieve-of-atkin",
    name: "Sieve of Atkin",
    category: "math",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { limit: 30 },
    visualType: "grid",
    run,
};
export default module;
