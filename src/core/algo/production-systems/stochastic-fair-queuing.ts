/**
 * stochastic-fair-queuing.ts - Stochastic Fair Queuing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Stochastic fair queuing approximates per-flow queues without keeping one
 * queue per flow. A hash places flows into a small number of buckets, and the
 * scheduler visits buckets in round-robin order, serving one packet from each
 * flow in the selected bucket. Because the hash is periodically perturbed,
 * flows that collide temporarily are separated after a few rounds, so no flow
 * can monopolize the link for long.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * buckets + packets) per schedule
 *   Space: O(flows + buckets)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per flow shows how many packets remain queued.
 *   - The flow selected in the current step is highlighted; fully drained
 *     flows turn green.
 *   - meta tracks the round, bucket, hash seed, and packets served.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SFQInput {
    flows?: number[][];
    buckets?: number;
    rounds?: number;
    perturbEvery?: number;
}

export interface ServiceEvent {
    round: number;
    bucket: number;
    flow: number;
    packet: number;
}

export interface ScheduleResult {
    served: number[];
    events: ServiceEvent[];
    remaining: number[][];
    seed: number;
}

/** Deterministic hash of a flow id into one of the scheduler buckets. */
export function hashFlow(flow: number, buckets: number, seed: number): number {
    return (flow * 2654435761 + seed * 40503 + 7) % buckets;
}

/** Compute the complete SFQ schedule for the given flow queues. */
export function schedule(input: SFQInput): ScheduleResult {
    const flows = (input.flows ?? [[1, 2, 3], [4, 5], [6, 7, 8, 9]]).map((q) => [...q]);
    const buckets = Math.max(1, Math.floor(input.buckets ?? 4));
    const rounds = Math.max(0, Math.floor(input.rounds ?? 3));
    const perturbEvery = Math.max(1, Math.floor(input.perturbEvery ?? 2));
    const remaining = flows.map((q) => [...q]);
    const served = flows.map(() => 0);
    const events: ServiceEvent[] = [];
    let seed = 0;

    for (let round = 0; round < rounds; round += 1) {
        if (round > 0 && round % perturbEvery === 0) {
            seed += 1;
        }
        const start = round % buckets;
        for (let offset = 0; offset < buckets; offset += 1) {
            const bucket = (start + offset) % buckets;
            for (let flow = 0; flow < flows.length; flow += 1) {
                if (hashFlow(flow, buckets, seed) !== bucket) {
                    continue;
                }
                const packet = remaining[flow]?.shift();
                if (packet !== undefined) {
                    served[flow] = (served[flow] ?? 0) + 1;
                    events.push({ round, bucket, flow, packet });
                }
            }
        }
    }
    return { served, events, remaining, seed };
}

function makeEntities(result: ScheduleResult, initial: number[][]): VisualEntity[] {
    return initial.map((queue, index) => {
        const left = result.remaining[index]?.length ?? 0;
        return {
            id: `flow-${index}`,
            type: "bar" as const,
            label: String(left),
            value: left,
            state: (left === 0 ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, queued: left },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SFQInput | null) ?? {};
    const flows = (task.flows ?? [[1, 2, 3], [4, 5], [6, 7, 8, 9]]).map((q) => [...q]);
    const result = schedule(task);
    const buckets = Math.max(1, Math.floor(task.buckets ?? 4));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities({ ...result, remaining: flows.map((q) => [...q]) }, flows),
        edges: [],
        description: `Scheduling ${flows.length} flow(s) through ${buckets} hash buckets with periodic perturbation.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { flows: flows.length, buckets, round: 0, served: 0, seed: 0 },
    };
    step += 1;

    for (const event of result.events) {
        const snapshot: ScheduleResult = {
            served: result.served,
            events: result.events,
            remaining: flows.map((queue, index) => {
                const done = result.events
                    .slice(0, result.events.indexOf(event) + 1)
                    .filter((e) => e.flow === index).length;
                return queue.slice(done);
            }),
            seed: result.seed,
        };
        yield {
            stepNumber: step,
            entities: makeEntities(snapshot, flows),
            edges: [],
            description: `Round ${event.round + 1}, bucket ${event.bucket}: flow ${event.flow} sends packet ${event.packet}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                flows: flows.length,
                buckets,
                round: event.round + 1,
                bucket: event.bucket,
                flow: event.flow,
                served: result.events.slice(0, result.events.indexOf(event) + 1).length,
                seed: Math.floor(event.round / Math.max(1, Math.floor(task.perturbEvery ?? 2))),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(result, flows),
        edges: [],
        description: `Schedule complete: ${result.events.length} packet(s) served across all flows.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { flows: flows.length, buckets, served: result.events.length, seed: result.seed },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Keeping a separate queue for every flow is expensive when there are thousands of flows. Stochastic fair queuing instead hashes flows into a handful of buckets and services buckets in turn, perturbing the hash now and then so that two flows unlucky enough to collide are eventually split apart.",
        invariants: [
            "Each flow maps to exactly one bucket for a given hash seed.",
            "Within a bucket, flows are served in increasing flow-id order on each visit.",
            "A flow never sends a packet it does not have, and served counts never exceed its queue length.",
        ],
        correctness:
            "Round-robin over buckets guarantees every bucket is visited once per round, and the per-bucket loop serves each flow assigned there at most one packet per visit. When the number of buckets is at least the number of active flows and the hash is collision-free, each flow is served exactly once per round, so long-term throughput is equal; perturbation makes collisions transient rather than permanent.",
        complexityRationale:
            "A round visits every bucket and every flow once, so the schedule costs O(rounds * buckets + flows) plus O(packets) to move packets. Only the flow queues and bucket state are stored, giving O(flows + buckets) space.",
        uses: [
            "Router and switch output queues that must share bandwidth fairly",
            "Congestion management in the Linux tc sfq queuing discipline",
            "Approximate fairness where per-flow state is too costly to maintain",
        ],
        references: [
            "A. Demers, S. Keshav, and S. Shenker, Analysis and Simulation of a Fair Queueing Algorithm, 1989",
            "P. McKenney, Stochastic Fairness Queuing, 1990",
        ],
        workedExample:
            "With three flows and four buckets, flow 0, 1, and 2 hash to distinct buckets. In one round each bucket is visited in turn and each flow sends exactly one packet; after a perturbation the bucket assignment changes but the one-packet-per-visit rule still holds.",
    },
    id: "stochastic-fair-queuing",
    name: "Stochastic Fair Queuing",
    category: "production-systems",
    complexity: { time: "O(rounds * buckets + packets)", space: "O(flows + buckets)" },
    defaultInput: { flows: [[1, 2, 3], [4, 5], [6, 7, 8, 9]], buckets: 4, rounds: 3, perturbEvery: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize one FIFO queue per flow and a round-robin bucket cursor",
        "for each round, perturb the hash when the round reaches the interval",
        "assign every flow to a bucket using the seeded hash",
        "visit each bucket once, starting from the rotating cursor",
        "for every flow in the selected bucket, dequeue and send one packet",
        "continue until all rounds have been served",
        "done: report packets served per flow",
    ],
};

export default module;
