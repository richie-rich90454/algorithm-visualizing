/**
 * fq-codel.ts - Flow Queue Controlled Delay (FQ-CoDel)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FQ-CoDel combines per-flow queues with the Controlled Delay active queue
 * manager. Packets from different flows never block one another, because each
 * flow has its own FIFO and the scheduler visits flows in turn. Before a
 * packet is sent, CoDel measures its sojourn time; when packets in a flow stay
 * above a target delay for a whole interval, that flow is dropping packets
 * early so latency does not grow without bound under load.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(ticks * flows) in the round-robin scheduler
 *   Space: O(packets) for the per-flow queues
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per flow shows its current queue depth.
 *   - The flow visited this tick is highlighted; a drop is marked as an error.
 *   - meta tracks the tick, sojourn time, and served versus dropped packets.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FqCodelInput {
    flows?: number[][];
    target?: number;
    interval?: number;
    ticks?: number;
}

export interface FqEvent {
    tick: number;
    flow: number;
    arrival: number;
    sojourn: number;
    dropped: boolean;
}

export interface FqResult {
    events: FqEvent[];
    remaining: number[][];
    served: number;
    dropped: number;
}

/** Run the FQ-CoDel scheduler and return every service or drop event. */
export function simulate(input: FqCodelInput): FqResult {
    const flows = (input.flows ?? [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ]).map((queue) => [...queue]);
    const target = Math.max(0, Math.floor(input.target ?? 4));
    const interval = Math.max(1, Math.floor(input.interval ?? 3));
    const ticks = Math.max(0, Math.floor(input.ticks ?? 12));
    const remaining = flows.map((queue) => [...queue]);
    const firstAbove: Array<number | null> = flows.map(() => null);
    const events: FqEvent[] = [];
    let served = 0;
    let dropped = 0;

    for (let tick = 0; tick < ticks && flows.length > 0; tick += 1) {
        const flow = tick % flows.length;
        const queue = remaining[flow];
        if (!queue || queue.length === 0) {
            continue;
        }
        while (queue.length > 0) {
            const arrival = queue[0] ?? 0;
            const sojourn = tick - arrival;
            if (sojourn > target) {
                if (firstAbove[flow] === null) {
                    firstAbove[flow] = tick;
                } else if (tick - (firstAbove[flow] ?? tick) >= interval) {
                    queue.shift();
                    events.push({ tick, flow, arrival, sojourn, dropped: true });
                    dropped += 1;
                    firstAbove[flow] = null;
                    continue;
                }
            } else {
                firstAbove[flow] = null;
            }
            queue.shift();
            events.push({ tick, flow, arrival, sojourn, dropped: false });
            served += 1;
            break;
        }
    }
    return { events, remaining, served, dropped };
}

function makeEntities(initial: number[][], result: FqResult, upto: number): VisualEntity[] {
    return initial.map((queue, index) => {
        const delivered = result.events
            .slice(0, upto)
            .filter((event) => event.flow === index).length;
        const left = queue.length - delivered;
        const last = result.events[upto - 1];
        const state: EntityState = last?.dropped && last.flow === index
            ? "error"
            : last?.flow === index
                ? "comparing"
                : left === 0
                    ? "sorted"
                    : "idle";
        return {
            id: `flow-${index}`,
            type: "bar" as const,
            label: String(left),
            value: left,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, queued: left },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FqCodelInput | null) ?? {};
    const flows = (task.flows ?? [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ]).map((queue) => [...queue]);
    const target = Math.max(0, Math.floor(task.target ?? 4));
    const interval = Math.max(1, Math.floor(task.interval ?? 3));
    const result = simulate(task);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(flows, result, 0),
        edges: [],
        description: `Scheduling ${flows.length} flow(s) with a ${target}-tick CoDel target and a ${interval}-tick interval.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { flows: flows.length, target, interval, served: 0, dropped: 0 },
    };
    step += 1;

    for (let index = 0; index < result.events.length; index += 1) {
        const event = result.events[index] ?? { tick: 0, flow: 0, arrival: 0, sojourn: 0, dropped: false };
        yield {
            stepNumber: step,
            entities: makeEntities(flows, result, index + 1),
            edges: [],
            description: `Tick ${event.tick}: flow ${event.flow} ${event.dropped ? "drops" : "sends"} a packet that waited ${event.sojourn} tick(s).`,
            codeLineNumber: event.dropped ? 4 : 6,
            layout: "array",
            meta: {
                flows: flows.length,
                target,
                interval,
                tick: event.tick,
                sojourn: event.sojourn,
                served: result.events.slice(0, index + 1).filter((e) => !e.dropped).length,
                dropped: result.events.slice(0, index + 1).filter((e) => e.dropped).length,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(flows, result, result.events.length),
        edges: [],
        description: `FQ-CoDel finished: ${result.served} packet(s) sent, ${result.dropped} dropped for excess delay.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { flows: flows.length, served: result.served, dropped: result.dropped },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single shared queue lets one chatty connection push everybody else's packets to the back, where they sit for a long time. FQ-CoDel gives each flow its own short queue so no flow can hide behind another, and it drops packets that have been waiting too long so the queue stays shallow and interactive traffic stays responsive.",
        invariants: [
            "Each flow keeps its own FIFO, so a packet from one flow is never behind a packet from another.",
            "A flow's first-above-target timer resets whenever its sojourn time falls back to the target.",
            "A packet is dropped only after its flow has continuously exceeded the target for an interval.",
        ],
        correctness:
            "Round-robin visiting guarantees every nonempty flow is inspected once per cycle, which bounds the service any one flow can delay. The CoDel rule drops only when sojourn time has stayed above target for a full interval, so transient bursts pass unharmed while persistent queues are trimmed; together these keep per-flow delay near the target.",
        complexityRationale:
            "Each tick inspects one flow and at most its queue head, so scheduling is O(ticks * flows) in the worst case and linear in the number of packets actually handled. Storing the queues and timers uses O(packets + flows) space.",
        uses: [
            "Home router and access-point queue management to combat bufferbloat",
            "Linux tc fq_codel and the default queue discipline on many systems",
            "Low-latency interactive traffic sharing a link with bulk transfers",
        ],
        references: [
            "K. Nichols and V. Jacobson, Controlling Queue Delay, Communications of the ACM, 2012",
            "T. Høiland-Jørgensen, P. McKenney, and D. Täht, Flow Queue-CoDel, 2018",
        ],
        workedExample:
            "With three flows of four packets each, a target of 4 ticks and an interval of 3, a flow visited at ticks 0, 3, and 6 sees sojourn times 0, 3, and 6. The packet at tick 6 starts the above-target timer, and one still stale at tick 9 is dropped rather than sent.",
    },
    id: "fq-codel",
    name: "FQ-CoDel Queue Management",
    category: "production-systems",
    complexity: { time: "O(ticks * flows)", space: "O(packets)" },
    defaultInput: { flows: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], target: 4, interval: 3, ticks: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "create one FIFO queue and an above-target timer per flow",
        "for each tick, choose the next flow in round-robin order",
        "measure the head packet's sojourn time as now minus arrival",
        "if sojourn exceeds the target, start or extend the above-target timer",
        "drop the packet when the timer has run for a full interval",
        "otherwise dequeue and send the packet, then reset the timer",
        "done: report packets sent and packets dropped",
    ],
};

export default module;
