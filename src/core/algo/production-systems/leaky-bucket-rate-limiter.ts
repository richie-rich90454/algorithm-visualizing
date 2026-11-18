/**
 * leaky-bucket-rate-limiter.ts - Leaky Bucket Rate Limiter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A leaky bucket shapes traffic with a queue of fixed capacity. Arriving
 * requests join the queue; the queue leaks one request out every drain
 * interval. If an arrival finds the bucket full it is rejected. Unlike a token
 * bucket, the leaky bucket enforces a strict output rate with no burst credit.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + total drains) for n arrivals
 *   Space: O(n) for the decision log and frame data
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The top row shows arrivals; the bottom row shows bucket slots.
 *   - An accepted arrival is green, a rejected one is red.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BucketInput {
    capacity?: number;
    drainInterval?: number;
    arrivals?: number[];
}

function makeCells(
    arrivals: number[],
    queueLength: number,
    capacity: number,
    decisions: boolean[],
    current: number,
): VisualEntity[] {
    const entities: VisualEntity[] = arrivals.map((time, index) => {
        let state: EntityState = "idle";
        if (index < decisions.length) {
            state = decisions[index] ? "sorted" : "error";
        }
        if (index === current) {
            state = "comparing";
        }
        return {
            id: `arrival-${index}`,
            type: "cell" as const,
            label: `t=${time}`,
            value: time,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, arrival: time },
        };
    });
    for (let slot = 0; slot < capacity; slot += 1) {
        entities.push({
            id: `slot-${slot}`,
            type: "cell",
            label: slot < queueLength ? "queued" : "-",
            value: slot < queueLength ? 1 : 0,
            state: slot < queueLength ? "visited" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: slot },
        });
    }
    return entities;
}

/** The leaky bucket generator. Arrivals are expected in nondecreasing time order. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BucketInput | null) ?? {};
    const capacity = typeof task.capacity === "number" ? Math.max(1, Math.floor(task.capacity)) : 3;
    const interval = typeof task.drainInterval === "number" && task.drainInterval > 0 ? task.drainInterval : 1;
    const arrivals = Array.isArray(task.arrivals)
        ? [...task.arrivals]
        : [0, 0.5, 1, 1.2, 1.5, 2, 2.1, 3];
    const cols = Math.max(arrivals.length, capacity);

    let queue = 0;
    let nextDrain = interval;
    let drains = 0;
    let accepted = 0;
    let rejected = 0;
    const decisions: boolean[] = [];

    yield {
        stepNumber: 0,
        entities: makeCells(arrivals, queue, capacity, decisions, -1),
        edges: [],
        description: `Leaky bucket holds up to ${capacity} request(s) and drains one every ${interval} time unit(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols, capacity, interval, queue, drains, accepted, rejected, decisions: [] as number[] },
    };
    let step = 1;

    for (let i = 0; i < arrivals.length; i += 1) {
        const time = arrivals[i] ?? 0;
        let drainedNow = 0;
        while (nextDrain <= time + 1e-12) {
            if (queue > 0) {
                queue -= 1;
            }
            drains += 1;
            drainedNow += 1;
            nextDrain += interval;
        }
        const allowed = queue < capacity;
        if (allowed) {
            queue += 1;
            accepted += 1;
        } else {
            rejected += 1;
        }
        decisions.push(allowed);
        yield {
            stepNumber: step,
            entities: makeCells(arrivals, queue, capacity, decisions, i),
            edges: [],
            description: `Arrival ${i} at t=${time}: ${drainedNow} drain(s) first, then ${allowed ? "accepted" : "rejected"}; queue now ${queue}/${capacity}.`,
            codeLineNumber: allowed ? 4 : 5,
            layout: "grid",
            meta: { rows: 2, cols, capacity, interval, queue, drains, accepted, rejected, decisions: decisions.map((d) => (d ? 1 : 0)) },
        };
        step += 1;
    }
}

/** The leaky bucket module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Picture a bucket with a small hole in the bottom. Requests pour in and stack up, while the hole lets them escape at a steady rate. If too many arrive before any drain out, the bucket overflows and new requests are turned away. The hole fixes the output speed, and the bucket size fixes how much temporary slack you allow.",
        invariants: [
            "The queue length never exceeds the capacity and never goes negative.",
            "At most one request drains per interval, and drains happen in time order.",
            "An arrival is accepted only when the queue has room after prior drains.",
        ],
        correctness:
            "Processing all drain instants up to an arrival before admitting that arrival mirrors the physical bucket. Draining reduces the queue by one per elapsed interval, and the capacity check then implements overflow exactly. By induction over arrivals the accept/reject sequence matches the specified leaky-bucket policy.",
        complexityRationale:
            "Each arrival triggers only the drains that occurred since the previous arrival, so over a run the total work is O(n + drains), with O(n) space for the logged decisions and cells.",
        uses: [
            "Shaping network traffic to a fixed output rate",
            "Smoothing bursty requests before a downstream service",
            "Enforcing quality-of-service contracts in routers",
        ],
        references: [
            "ITU-T I.371, Traffic Control and Congestion Control, 1996",
            "Tanenbaum and Wetherall, Computer Networks, Chapter 5",
        ],
        workedExample:
            "With capacity two and one drain per second, arrivals at t=0 and t=0.5 fill the bucket. At t=1 one request drains, so the arrival at t=1 is accepted. A rapid arrival at t=1.1 finds the bucket full and is rejected until the next drain at t=2.",
    },
    id: "leaky-bucket-rate-limiter",
    name: "Leaky Bucket Rate Limiter",
    category: "production-systems",
    complexity: { time: "O(n + drains)", space: "O(n)" },
    defaultInput: { capacity: 3, drainInterval: 1, arrivals: [0, 0.5, 1, 1.2, 1.5, 2, 2.1, 3] },
    visualType: "grid",
    run,
    pseudocode: [
        "set the bucket capacity and drain interval",
        "for each arrival in time order",
        "drain one request per elapsed interval first",
        "if the bucket has room, accept and enqueue it",
        "otherwise reject the request",
        "done: report every accept and reject decision",
    ],
};

export default module;
