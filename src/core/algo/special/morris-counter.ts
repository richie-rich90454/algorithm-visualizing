/**
 * morris-counter.ts – Morris Approximate Counter.
 * Counts 20 events in ~log n bits: with counter c, increment it with
 * probability 2^-c; the unbiased estimate is 2^c-1.
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
    const cfg = (input as { events?: number; seed?: number } | null) ?? {};
    const events = Math.max(1, Math.min(40, cfg.events ?? 20));
    const rnd = lcg(cfg.seed ?? 17);
    let c = 0;
    let step = 0;
    const frame = (seen: number, desc: string): VisualFrame => {
        const est = 2 ** c - 1;
        const entities: VisualEntity[] = [
            {
                id: "ctr",
                type: "cell" as const,
                label: `c=${c}`,
                value: c,
                state: "comparing" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            },
            {
                id: "est",
                type: "cell" as const,
                label: `≈${est}`,
                value: est,
                state: "sorted" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 1 },
            },
            {
                id: "seen",
                type: "cell" as const,
                label: `n=${seen}`,
                value: seen,
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 2 },
            },
        ];
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(seen, 6),
            layout: "grid",
            meta: { counter: c, estimate: est, events: seen },
        };
    };
    yield frame(0, `Counting ${events} events with a tiny counter (estimate 2^c-1).`);
    step += 1;
    for (let i = 1; i <= events; i += 1) {
        if (rnd() < 2 ** -c) c += 1;
        if (i % 4 === 0 || i === events) {
            yield frame(i, `After ${i} events: c=${c}, estimate ${2 ** c - 1} (true ${i}).`);
            step += 1;
        }
    }
    yield frame(events, `Done: true count ${events}, estimate ${2 ** c - 1} from counter c=${c}.`);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The Morris counter estimates a large event count with very few bits. It stores a small integer c and, on each event, increments c only with probability 2^-c. As c grows, increments become rarer so c rises roughly like log2 of the true count. The estimate is 2^c minus 1.",
        "invariants": [
            "The counter c never decreases.",
            "At value c the probability of incrementing is exactly 2^-c.",
            "The estimate 2^c minus 1 is designed to be unbiased for the event count."
        ],
        "correctness": "Under this increment rule the expected value of 2^c minus 1 after n events equals n, so the estimate is unbiased, and its relative error is on the order of 1/sqrt(2^c), improving as the count grows. The trade-off is deliberate approximation in exchange for exponentially fewer bits.",
        "complexityRationale": "Each event draws one random number and possibly increments, O(1) time. After n events the counter is about log2(n), requiring only O(log log n) bits of storage.",
        "uses": [
            "Counting events in memory-constrained embedded systems and switches",
            "Approximate packet and flow counting in routers",
            "Streaming telemetry where exact counts are too costly",
            "Probabilistic counting in high-speed hardware"
        ],
        "references": [
            "Morris, Counting Large Numbers of Events in Small Registers, Communications of the ACM, 1978",
            "Mitzenmacher and Upfal, Probability and Computing, Chapter 11"
        ],
        "workedExample": "Start with c=0 and estimate 2^0-1=0. The first event increments with probability 1, giving c=1 and estimate 1. Later events increment with probability 1/2, then 1/4, and so on. After 20 events c is around 4 or 5, giving an estimate near 15 to 31, reported against the true count of 20."
    },
    id: "morris-counter",
    name: "Morris Counter",
    category: "data-structures",
    complexity: { time: "O(n)", space: "O(log log n)" },
    defaultInput: { events: 20, seed: 17 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize tiny counter c <- 0 for events total",
        "for each event roll random with probability 2^-c",
        "increment c only when the roll succeeds",
        "estimate count as 2^c minus 1",
        "sample progress at every fourth event",
        "compare estimate against true events seen",
        "done: approximate count from logarithmic bits",
    ],
};

export default module;
