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
            codeLineNumber: seen,
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
    id: "morris-counter",
    name: "Morris Counter",
    category: "data-structures",
    complexity: { time: "O(n)", space: "O(log log n)" },
    defaultInput: { events: 20, seed: 17 },
    visualType: "grid",
    run,
};

export default module;
