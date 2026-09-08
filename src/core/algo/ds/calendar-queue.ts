/**
 * calendar-queue.ts – Calendar Queue
 *
 * Discrete-event scheduling: time is striped into buckets of adaptive
 * width, so the next event is usually at the head of the current bucket
 * and dequeue rarely scans.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { events?: Array<[string, number]> } | null) ?? {};
    const events = task.events ?? [
        ["a", 1],
        ["b", 5],
        ["c", 2],
        ["d", 8],
    ];
    let step = 0;

    const WIDTH = 4;
    const buckets = new Map<number, Array<[string, number]>>();
    for (const [name, t] of events) {
        const b = Math.floor(t / WIDTH);
        if (!buckets.has(b)) {
            buckets.set(b, []);
        }
        buckets.get(b)?.push([name, t]);
    }
    for (const b of buckets.values()) {
        b.sort((x, y) => x[1] - y[1]);
    }
    const order = [...buckets.keys()].sort((a, b) => a - b);
    const fired: string[] = [];
    const snap = (hotBucket: number, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        order.forEach((b, ri) => {
            (buckets.get(b) ?? []).forEach(([name, t], ki) => {
                entities.push({
                    id: `cq-${b}-${ki}`,
                    type: "cell" as const,
                    label: `${name}@${t}`,
                    value: t,
                    state: (b === hotBucket
                        ? "comparing"
                        : fired.includes(name)
                          ? "sorted"
                          : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: ri, col: ki },
                });
            });
        });
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { buckets: buckets.size, width: WIDTH, fired: fired.length },
        };
    };

    yield snap(-1, `Calendar queue over ${events.length} events – bucket width ${WIDTH}.`, 0);
    step += 1;
    for (const b of order) {
        const bucket = buckets.get(b) ?? [];
        yield snap(b, `Bucket ${b} holds [${bucket.map(([n, t]) => `${n}@${t}`).join(",")}].`, 1);
        step += 1;
        for (const [name] of bucket) {
            fired.push(name);
            yield snap(b, `Fired ${name} – next event at this bucket head.`, 2);
            step += 1;
        }
    }
    yield snap(-1, `All events fired in time order [${fired.join(",")}].`, 3);
}

const module: AlgorithmModule = {
    id: "calendar-queue",
    name: "Calendar Queue",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(n)" },
    defaultInput: {
        events: [
            ["a", 1],
            ["b", 5],
            ["c", 2],
            ["d", 8],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
