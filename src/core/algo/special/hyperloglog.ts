/**
 * hyperloglog.ts – HyperLogLog cardinality estimator.
 * Eight registers record the longest run of leading zeros per hashed
 * key; the harmonic mean of 2^register estimates distinct keys, with
 * linear-counting correction for small ranges.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function hash32(s: string): number {
    let h = 2166136261;
    for (const ch of s) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

const rho = (w: number, bits: number): number => {
    for (let i = 1; i <= bits; i += 1) if ((w >>> (bits - i)) & 1) return i;
    return bits + 1;
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { keys?: string[] } | null) ?? {};
    const keys =
        Array.isArray(cfg.keys) && cfg.keys.length > 0
            ? (cfg.keys as string[]).slice(0, 10)
            : ["a", "b", "c", "d", "e", "f"];
    const m = 8;
    const reg = new Array<number>(m).fill(0);
    let step = 0;
    const estimate = (): number => {
        const alpha = 0.673;
        const sum = reg.reduce((s, r) => s + 2 ** -r, 0);
        const raw = (alpha * m * m) / sum;
        if (raw <= 2.5 * m) {
            const zeros = reg.filter((r) => r === 0).length;
            if (zeros > 0) return m * Math.log(m / zeros);
        }
        return raw;
    };
    const frame = (desc: string, line: number, hot: number): VisualFrame => {
        const entities: VisualEntity[] = reg.map((v, i) => ({
            id: `reg-${i}`,
            type: "cell" as const,
            label: String(v),
            value: v,
            state: (i === hot ? "comparing" : v > 0 ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                estimate: Math.round(estimate() * 100) / 100,
                trueCount: new Set(keys.slice(0, line)).size,
            },
        };
    };
    yield frame(`Eight empty registers; adding [${keys.join(",")}].`, 0, -1);
    step += 1;
    keys.forEach((k, t) => {
        const h = hash32(k);
        const idx = h & (m - 1);
        const r = rho(h >>> 3, 29);
        if (r > (reg[idx] ?? 0)) reg[idx] = r;
        void t;
    });
    for (let t = 0; t < keys.length; t += 1) {
        const h = hash32(keys[t] ?? "");
        const idx = h & (m - 1);
        yield frame(`Added "${keys[t]}" → register ${idx} (longest zero-run wins).`, t + 1, idx);
        step += 1;
    }
    const truth = new Set(keys).size;
    yield frame(
        `Done: estimate ${estimate().toFixed(2)} vs true distinct ${truth}.`,
        keys.length + 1,
        -1,
    );
}

const module: AlgorithmModule = {
    id: "hyperloglog",
    name: "HyperLogLog",
    category: "data-structures",
    complexity: { time: "O(1) add", space: "O(m)" },
    defaultInput: { keys: ["a", "b", "c", "d", "e", "f"] },
    visualType: "grid",
    run,
};

export default module;
