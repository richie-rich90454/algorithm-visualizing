/**
 * minhash-lsh.ts – MinHash + LSH candidate pairs.
 * Sets {1,2,3,4} vs {3,4,5,6} (true Jaccard 2/6): six (ax+b mod 7)
 * hashes form signatures, signature agreement estimates similarity,
 * and 2 bands of 3 rows flag the pair as a candidate.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const HASHES: Array<[number, number]> = [
    [1, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [2, 3],
    [5, 1],
];
const P = 7;

const sig = (set: number[]): number[] =>
    HASHES.map(([a, b]) => Math.min(...set.map((x) => (a * x + b) % P)));

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { a?: number[]; b?: number[] } | null) ?? {};
    const A = Array.isArray(cfg.a) && cfg.a.length > 0 ? (cfg.a as number[]) : [1, 2, 3, 4];
    const B = Array.isArray(cfg.b) && cfg.b.length > 0 ? (cfg.b as number[]) : [3, 4, 5, 6];
    const sA = sig(A);
    const sB = sig(B);
    const agree = sA.filter((v, i) => v === sB[i]).length;
    const inter = A.filter((x) => B.includes(x)).length;
    const truth = inter / new Set([...A, ...B]).size;
    let step = 0;
    const frame = (rows: number, desc: string): VisualFrame => {
        const entities: VisualEntity[] = [];
        [sA, sB].forEach((s, r) =>
            s.slice(0, rows).forEach((v, c) => {
                entities.push({
                    id: `mh-${r}-${c}`,
                    type: "cell" as const,
                    label: String(v),
                    value: v,
                    state: (sA[c] === sB[c] ? "sorted" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col: c },
                });
            }),
        );
        if (entities.length === 0) {
            entities.push({
                id: "mh-empty",
                type: "cell" as const,
                label: "∅",
                value: "∅",
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: rows,
            layout: "grid",
            meta: {
                agree,
                estimate: Math.round((agree / HASHES.length) * 100) / 100,
                trueJaccard: Math.round(truth * 100) / 100,
            },
        };
    };
    yield frame(
        0,
        `A={${A}}} vs B={${B}}: true Jaccard ${inter}/${new Set([...A, ...B]).size}=${truth.toFixed(2)}.`,
    );
    step += 1;
    for (let r = 1; r <= HASHES.length; r += 1) {
        const [a, b] = HASHES[r - 1] as [number, number];
        yield frame(
            r,
            `Hash ${r} (h=${a}x+${b} mod 7): mins ${sA[r - 1]} vs ${sB[r - 1]} ${sA[r - 1] === sB[r - 1] ? "agree" : "differ"}.`,
        );
        step += 1;
    }
    const bandHit =
        [0, 1, 2].every((i) => sA[i] === sB[i]) || [3, 4, 5].every((i) => sA[i] === sB[i]);
    yield frame(
        HASHES.length,
        `Agreement ${agree}/${HASHES.length} ≈ ${(agree / HASHES.length).toFixed(2)}; LSH bands ${bandHit ? "match → CANDIDATE pair" : "differ → not a candidate"}.`,
    );
}

const module: AlgorithmModule = {
    id: "minhash-lsh",
    name: "MinHash + LSH",
    category: "data-structures",
    complexity: { time: "O(k·n)", space: "O(k)" },
    defaultInput: { a: [1, 2, 3, 4], b: [3, 4, 5, 6] },
    visualType: "grid",
    run,
};

export default module;
