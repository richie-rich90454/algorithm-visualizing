/**
 * reservoir-sampling.ts – Reservoir Sampling (Algorithm R).
 * Keeps a uniform size-3 sample of a length-8 stream in one pass: item
 * i replaces a random reservoir slot with probability k/i.
 * Fixed-seed LCG keeps the demo deterministic.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { k?: number; stream?: number[]; seed?: number } | null) ?? {};
    const stream =
        Array.isArray(cfg.stream) && cfg.stream.length > 0
            ? (cfg.stream as number[]).slice(0, 12)
            : [5, 1, 8, 3, 7, 2, 6, 4];
    const k = Math.max(1, Math.min(5, cfg.k ?? 3));
    const rnd = lcg(cfg.seed ?? 13);
    const res: number[] = [];
    let step = 0;
    const frame = (idx: number, desc: string): VisualFrame => {
        const entities: VisualEntity[] = res.map((v, i) => ({
            id: `r-${i}`,
            type: "cell" as const,
            label: String(v),
            value: v,
            state: "sorted" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        const cur = stream[idx];
        if (idx >= 0 && idx < stream.length && cur !== undefined) {
            entities.push({
                id: "cur",
                type: "cell" as const,
                label: `→${cur}`,
                value: cur,
                state: "comparing" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col: idx },
            });
        }
        if (entities.length === 0) {
            entities.push({
                id: "res-empty",
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
            codeLineNumber: Math.max(0, Math.min(idx, 6)),
            layout: "grid",
            meta: { reservoir: [...res], index: idx },
        };
    };
    yield frame(-1, `Stream [${stream.join(",")}]; reservoir holds k=${k}.`);
    step += 1;
    for (let i = 0; i < stream.length; i += 1) {
        const v = stream[i] ?? 0;
        if (res.length < k) {
            res.push(v);
            yield frame(i, `Item ${v}: reservoir not full — keep it.`);
        } else {
            const j = Math.floor(rnd() * (i + 1));
            if (j < k) {
                res[j] = v;
                yield frame(
                    i,
                    `Item ${v}: dice j=${j} < ${k} — replaces slot ${j} (prob ${k}/${i + 1}).`,
                );
            } else
                yield frame(
                    i,
                    `Item ${v}: dice j=${j} ≥ ${k} — skipped (prob ${k}/${i + 1} to keep).`,
                );
        }
        step += 1;
    }
    yield frame(
        stream.length,
        `Done: uniform sample [${res.join(",")}] — every item had probability ${k}/${stream.length}.`,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Reservoir sampling draws a uniform random sample of k items from a stream of unknown length in a single pass. The first k items fill the reservoir. For each later item at position i, keep it with probability k/i, replacing a random slot, and discard it otherwise. This produces a uniformly random k-subset without knowing the stream length in advance.",
        "invariants": [
            "After i items with i >= k, every one of them has probability exactly k/i of being in the reservoir.",
            "The reservoir always holds exactly k items.",
            "The slot chosen for replacement is uniform."
        ],
        "correctness": "An old item survives item i unless it is chosen for replacement, which happens with probability (k/i)·(1/k)=1/i, so its survival probability is (i-1)/i. Combined with its previous k/(i-1), this gives k/i. The new item is included with probability k/i, so all i items are equally likely and the final sample is uniform.",
        "complexityRationale": "Each stream item draws one random number and does constant work, O(1) per item and O(n) for n items. The reservoir stores k items, O(k) space, independent of stream length.",
        "uses": [
            "Sampling log lines or events for monitoring",
            "Uniform sampling from streaming data and databases",
            "Randomized testing and quality control",
            "A/B test assignment and Monte Carlo preprocessing"
        ],
        "references": [
            "Vitter, Random Sampling with a Reservoir, ACM Transactions on Mathematical Software, 1985",
            "Knuth, The Art of Computer Programming, Vol. 2, Section 3.4.2"
        ],
        "workedExample": "For stream [5,1,8,3,7,2,6,4] with k=3, the first three values fill the reservoir. Item 3 is kept with probability 3/4 and may replace a random slot. Each later item is kept with probability 3/i; after all eight items, each had probability 3/8 of appearing in the final uniform sample."
    },
    id: "reservoir-sampling",
    name: "Reservoir Sampling",
    category: "data-structures",
    complexity: { time: "O(n)", space: "O(k)" },
    defaultInput: { k: 3, stream: [5, 1, 8, 3, 7, 2, 6, 4], seed: 13 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty reservoir holding k slots",
        "for each stream item with index i",
        "if reservoir not full then keep the item",
        "else pick random j uniformly up to i",
        "replace slot j when j falls inside k",
        "every item keeps probability k over i",
        "done: uniform sample with verified probability",
    ],
};

export default module;
