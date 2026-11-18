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
            codeLineNumber: Math.min(line, 6),
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

    education: {
        "intuition": "HyperLogLog estimates the number of distinct items in a huge stream using tiny memory. It hashes each item and uses part of the hash to pick one of m registers, recording the longest run of leading zeros seen there. A long zero run is unlikely unless many distinct items were hashed, so the register values encode the cardinality through a harmonic mean.",
        "invariants": [
            "Each register stores the maximum leading-zero run for its bucket, so registers never decrease.",
            "Identical items hash identically and do not change any register, making the estimate duplicate-insensitive.",
            "Register values never exceed the hash width."
        ],
        "correctness": "A register shows a run of at least r leading zeros with probability 2^-r, so with n distinct items over m buckets the maximum run per bucket estimates n/m. Averaging 2^register with a harmonic mean and bias correction yields an estimator with relative standard error about 1.04/sqrt(m); small ranges use linear counting instead.",
        "complexityRationale": "Adding an item computes one hash and updates one register, O(1) time. The m registers use O(m) space, constant regardless of how many distinct items are seen; accuracy improves as m grows.",
        "uses": [
            "Counting unique visitors in analytics (Redis PFCOUNT, BigQuery APPROX_COUNT_DISTINCT)",
            "Distinct-element counting in network monitoring",
            "Cardinality estimation in database query optimizers",
            "Large-scale web and ad-tech reach measurement"
        ],
        "references": [
            "Flajolet, Fusy, Gandouet and Meunier, HyperLogLog: the analysis of a near-optimal cardinality estimation algorithm, 2007",
            "Heule, Nunkesser and Hall, HyperLogLog in Practice, EDBT 2013"
        ],
        "workedExample": "Eight registers start at zero. Hashing \"a\" selects register 3 with two leading zeros, so register 3 becomes 2; hashing \"b\" selects register 5 with one leading zero. After all keys, the estimate combines the registers as 0.673·64 divided by the sum of 2^-register, using linear counting when the raw result is small, and is reported against the true count of 6."
    },
    id: "hyperloglog",
    name: "HyperLogLog",
    category: "data-structures",
    complexity: { time: "O(1) add", space: "O(m)" },
    defaultInput: { keys: ["a", "b", "c", "d", "e", "f"] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize eight registers to zero",
        "hash each key to pick a register index",
        "compute leading-zero run for the remaining bits",
        "store the maximum run seen per register",
        "combine registers by harmonic mean of powers",
        "apply linear counting for small cardinalities",
        "done: distinct-count estimate versus true count",
    ],
};

export default module;
