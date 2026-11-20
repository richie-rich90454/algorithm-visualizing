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

    education: {
        "intuition": "A calendar queue is a priority queue for discrete-event simulation that hashes event times into buckets laid out like calendar days. Bucket width adapts to event density so the next event is usually at the head of the current bucket. Dequeue then rarely scans more than one bucket.",
        "invariants": [
            "Each event sits in the bucket for its time interval.",
            "Events within a bucket are sorted by time.",
            "Bucket width is chosen so average occupancy stays near one."
        ],
        "correctness": "Hashing an event to its time bucket and keeping buckets sorted means the earliest event is in the current or a later bucket, never an earlier one. Scanning from the current bucket in time order therefore returns the true minimum. Resizing buckets when density changes preserves the mapping.",
        "complexityRationale": "With occupancy near one, enqueue and dequeue are O(1) amortized because the hand advances monotonically through buckets. Storage is O(n) for events plus a fixed number of buckets.",
        "uses": [
            "Discrete-event simulation",
            "Network packet scheduling",
            "Timer wheels in operating systems"
        ],
        "references": [
            "Randy Brown, \"Calendar Queues: A Fast O(1) Priority Queue Implementation for the Simulation Event Set Problem\", CACM 1988",
            "Alan Jay Smith, survey of cache memory design and evaluation, 1982"
        ],
        "workedExample": "With buckets covering time 0-9 in width-1 slots, insert events at 1.2, 1.7, and 4.0; the first two share bucket 1 in sorted order. Dequeue returns 1.2, then 1.7, then advances the hand to bucket 4 for 4.0, scanning only a few entries."
    },
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
    pseudocode: [
        "initialize calendar with buckets spanning time range",
        "hash event time to bucket index by modulo width",
        "enqueue event into bucket keeping bucket sorted",
        "compare bucket top times to find global minimum",
        "dequeue earliest event and advance current time",
        "resize bucket count when density passes threshold",
        "done: calendar holds events with dequeue order answer",
    ],
};

export default module;
