/**
 * virtual-clock.ts - Virtual Clock Scheduling
 *
 * Virtual Clock gives each flow its own auxiliary clock that runs at a rate
 * inversely proportional to the flow's reserved bandwidth. When a packet of
 * length L arrives at time t on a flow with rate r, its timestamp becomes
 * max(clock, t) plus L over r. Packets are transmitted in timestamp order, so
 * each flow is paced according to its reservation and idle time is not banked.
 *
 * Time O(n log n) for n packets from the final sort, space O(n + flows).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface VirtualClockInput {
    packets?: Array<{ flow: string; arrival: number; length: number }>;
    rates?: Record<string, number>;
}

export interface VcStep {
    index: number;
    flow: string;
    arrival: number;
    length: number;
    tag: number;
}

/** Assign virtual-clock timestamps and return the transmission order. */
export function virtualClock(
    packets: Array<{ flow: string; arrival: number; length: number }>, rates: Record<string, number>,
): { steps: VcStep[]; order: number[] } {
    const clocks: Record<string, number> = {};
    const steps = packets.map((packet, index) => {
        const rate = Math.max(1e-9, rates[packet.flow] ?? 1);
        const current = clocks[packet.flow] ?? 0;
        const tag = Math.max(current, packet.arrival) + packet.length / rate;
        clocks[packet.flow] = tag;
        return { index, flow: packet.flow, arrival: packet.arrival, length: packet.length, tag };
    });
    const order = steps.map((s) => s.index).sort((a, b) => (steps[a]!.tag - steps[b]!.tag) || (a - b));
    return { steps, order };
}

const COLUMNS = ["packet", "flow", "arrival", "tag"];

function makeCells(steps: VcStep[], revealed: number, active: number, order: number[], showOrder: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    steps.forEach((s, row) => {
        const display = [s.index, s.flow, s.arrival, s.tag];
        COLUMNS.forEach((column, col) => {
            const shown = row <= revealed || (showOrder && order.includes(row));
            const state: EntityState = row === active
                ? "comparing"
                : shown ? "sorted" : "idle";
            const value = display[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${typeof value === "string" ? value : value.toFixed(2)}` : "?",
                value: shown ? value : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as VirtualClockInput | null) ?? {};
    const packets: Array<{ flow: string; arrival: number; length: number }> = Array.isArray(task.packets) && task.packets.length > 0
        ? task.packets
        : [
            { flow: "A", arrival: 0, length: 10 },
            { flow: "B", arrival: 0, length: 10 },
            { flow: "A", arrival: 2, length: 10 },
            { flow: "B", arrival: 3, length: 10 },
            { flow: "A", arrival: 5, length: 10 },
            { flow: "B", arrival: 6, length: 10 },
        ];
    const rates: Record<string, number> = task.rates && typeof task.rates === "object" ? task.rates : { A: 2, B: 1 };
    const result = virtualClock(packets, rates);
    const base = { rows: packets.length, cols: COLUMNS.length, flows: packets.map((p) => p.flow) };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result.steps, -1, -1, result.order, false),
        edges: [],
        description: `Virtual Clock stamps ${packets.length} packet(s) across the listed flows using their reserved rates.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, tags: result.steps.map((s) => s.tag), arrivals: packets.map((p) => p.arrival), order: [] },
    };
    step += 1;

    for (let i = 0; i < result.steps.length; i += 1) {
        const s = result.steps[i]!;
        yield {
            stepNumber: step,
            entities: makeCells(result.steps, i, i, result.order, false),
            edges: [],
            description: `Packet ${i} on flow ${s.flow} at ${s.arrival.toFixed(2)}: clock tag ${s.tag.toFixed(2)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...base, tags: result.steps.map((x) => x.tag), arrivals: packets.map((p) => p.arrival), order: [], active: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.steps, packets.length - 1, -1, result.order, true),
        edges: [],
        description: `Done: transmit order is ${result.order.join(" -> ")} by ascending virtual tag.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...base, tags: result.steps.map((s) => s.tag), arrivals: packets.map((p) => p.arrival), order: result.order, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A fair scheduler must give each flow its reserved share without letting a silent flow save up credit forever. Virtual Clock keeps a private clock per flow that advances by the packet's service time, length divided by the flow's rate. A new packet is stamped with the later of its real arrival and that clock, so an idle flow cannot jump ahead. Sorting all packets by their stamps produces a schedule that paces each flow at its reservation.",
        invariants: [
            "A packet's virtual tag is at least its real arrival time.",
            "For a single flow, tags are nondecreasing in arrival order.",
            "A faster reserved rate yields a smaller increment for the same packet length.",
        ],
        correctness:
            "Setting the clock to max(clock, arrival) plus length over rate is the virtual-scheduling recursion: idle gaps do not accumulate because the clock jumps to the real arrival when it lags. The incremental term is exactly the service time at the reserved rate, so over a busy period the number of stamps per unit time for a flow converges to its rate. Sorting by tag and breaking ties by original index gives a deterministic feasible order. The tests recompute all stamps independently, verify the monotonicity and lower-bound properties, and check that a higher rate produces smaller tags.",
        complexityRationale:
            "Assigning stamps is one pass over n packets with constant work, and the final sort costs O(n log n); the stamped array and the per-flow clocks use O(n plus flows) space.",
        uses: [
            "Fair bandwidth allocation in network schedulers",
            "Quality-of-service guarantees for real-time traffic",
            "Weighted fair queueing variants in routers",
        ],
        references: [
            "Zhang, VirtualClock: A New Traffic Control Algorithm for Packet Switching Networks, ACM TOCS, 1991",
            "Keshav, An Engineering Approach to Computer Networking, Chapter 7",
        ],
        workedExample:
            "Flow A reserved at 2 units per time and flow B at 1 both send a packet of length 10 at time 0. A's tag is 0 plus 10 over 2, which is 5; B's tag is 10. Sorting by tag transmits A first, reflecting its larger share. If A next sends at time 2, its tag is max(5, 2) plus 5, which is 10, so it cannot bank the earlier idle gap.",
    },
    id: "virtual-clock",
    name: "Virtual Clock Scheduling",
    category: "production-systems",
    complexity: { time: "O(n log n)", space: "O(n + flows)" },
    defaultInput: {
        packets: [
            { flow: "A", arrival: 0, length: 10 },
            { flow: "B", arrival: 0, length: 10 },
            { flow: "A", arrival: 2, length: 10 },
            { flow: "B", arrival: 3, length: 10 },
            { flow: "A", arrival: 5, length: 10 },
            { flow: "B", arrival: 6, length: 10 },
        ],
        rates: { A: 2, B: 1 },
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize every flow clock to zero",
        "for each packet in arrival order",
        "set the clock to the later of its current value and the packet arrival time",
        "add the packet length divided by the flow rate to get the tag",
        "store the tag back into the flow clock",
        "sort packet indices by tag and then by original position",
        "done: report the tags and the transmit order",
    ],
};

export default module;
