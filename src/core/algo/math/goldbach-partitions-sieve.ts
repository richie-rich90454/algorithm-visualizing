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
 * goldbach-partitions-sieve – Goldbach Partitions.
 * Sieves to n, pairs each prime p with q = n-p if prime.
 * Default 20 = 3+17 = 7+13 (2 partitions). Time O(n log log n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 20;
    let step = 0;
    if (!(n >= 4) || n % 2 !== 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs even n >= 4).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const isP = new Array<boolean>(n + 1).fill(true);
    isP[0] = false;
    isP[1] = false;
    for (let i = 2; i * i <= n; i += 1)
        if (isP[i]) for (let j = i * i; j <= n; j += i) isP[j] = false;
    const primes: number[] = [];
    for (let i = 2; i <= n; i += 1) if (isP[i]) primes.push(i);
    yield {
        stepNumber: step,
        entities: primes.map((p, i) => C(0, i, `${p}`, p, "idle")),
        edges: [],
        description: `Primes to ${n}: [${primes}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const parts: Array<[number, number]> = [];
    for (const p of primes) {
        if (p > n / 2) break;
        const q = n - p;
        if (isP[q]) {
            parts.push([p, q]);
            if (parts.length <= 3) {
                yield {
                    stepNumber: step,
                    entities: [C(0, 0, `${p}`, p, "comparing"), C(0, 1, `${q}`, q, "sorted")],
                    edges: [],
                    description: `${n} - ${p} = ${q}, prime – partition ${parts.length}.`,
                    codeLineNumber: 1,
                    layout: "grid",
                    meta: {},
                };
                step += 1;
            }
        } else if (p <= 7) {
            yield {
                stepNumber: step,
                entities: [C(0, 0, `${p}`, p, "comparing"), C(0, 1, `${q}`, q, "idle")],
                edges: [],
                description: `${n} - ${p} = ${q}, composite – skip.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: {},
            };
            step += 1;
        }
        if (step > 12) break;
    }
    yield {
        stepNumber: step,
        entities: parts.flatMap(([p, q], i) => [
            C(0, 2 * i, `${p}`, p, "sorted"),
            C(0, 2 * i + 1, `${q}`, q, "sorted"),
        ]),
        edges: [],
        description: `${n} has ${parts.length} partition(s): ${parts.map(([p, q]) => `${p}+${q}`).join(", ")}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { count: parts.length },
    };
}
const module: AlgorithmModule = {
    id: "goldbach-partitions-sieve",
    name: "Goldbach Partitions",
    category: "math",
    complexity: { time: "O(n log log n)", space: "O(n)" },
    defaultInput: { n: 20 },
    visualType: "grid",
    run,
};
export default module;
