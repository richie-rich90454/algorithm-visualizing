/**
 * weighted-fair-queuing.ts - Weighted Fair Queuing Packet Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Weighted fair queuing shares a link among several flows according to their
 * weights. For each packet it computes a virtual finish time equal to the
 * flow's previous finish time plus the packet length divided by the flow's
 * weight, then transmits packets in increasing finish-time order. A flow with
 * twice the weight finishes each packet in half the virtual time and therefore
 * receives roughly twice the bandwidth.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p log p) to sort p packets by virtual finish time
 *   Space: O(p) for the per-packet finish times
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is a flow; each cell is one queued packet sized by its length.
 *   - The packet currently being transmitted is yellow; served ones are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Flow = { id: string; weight: number; packets: number[] };
type Scheduled = { flow: number; packet: number; finish: number; label: string };

/** Build the flow-by-packet grid for one frame. */
function makeCells(
    flows: Flow[],
    scheduled: Scheduled[],
    servedCount: number,
    activeIndex: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const served = new Set(scheduled.slice(0, servedCount).map((s) => `${s.flow}:${s.packet}`));
    const active = scheduled[activeIndex];
    flows.forEach((flow, flowIndex) => {
        flow.packets.forEach((size, packetIndex) => {
            const key = `${flowIndex}:${packetIndex}`;
            let state: EntityState = "idle";
            if (served.has(key)) state = "sorted";
            if (active && active.flow === flowIndex && active.packet === packetIndex) state = "comparing";
            entities.push({
                id: `packet-${flowIndex}-${packetIndex}`,
                type: "cell" as const,
                label: `${flow.id}:${size}`,
                value: size,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: flowIndex, col: packetIndex, size, weight: flow.weight },
            });
        });
    });
    return entities;
}

/** The weighted fair queuing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { flows?: Array<{ id?: string; weight?: number; packets?: number[] }> } | null) ?? {};
    const defaultFlows: Flow[] = [
        { id: "A", weight: 1, packets: [4, 2, 6] },
        { id: "B", weight: 2, packets: [3, 3] },
        { id: "C", weight: 1, packets: [5, 5, 5] },
    ];
    const flows: Flow[] = Array.isArray(task.flows) && task.flows.length > 0
        ? task.flows.map((flow, index) => ({
            id: typeof flow.id === "string" ? flow.id : `F${index}`,
            weight: typeof flow.weight === "number" && flow.weight > 0 ? flow.weight : 1,
            packets: Array.isArray(flow.packets) ? flow.packets.map(Number) : [],
        }))
        : defaultFlows;

    const scheduled: Scheduled[] = [];
    flows.forEach((flow, flowIndex) => {
        let finish = 0;
        flow.packets.forEach((size, packetIndex) => {
            finish += size / flow.weight;
            scheduled.push({
                flow: flowIndex,
                packet: packetIndex,
                finish,
                label: `${flow.id}${packetIndex}`,
            });
        });
    });
    scheduled.sort((a, b) =>
        a.finish - b.finish || a.flow - b.flow || a.packet - b.packet);

    const totalPackets = scheduled.length;
    const rows = flows.length;
    yield {
        stepNumber: 0,
        entities: makeCells(flows, scheduled, 0, -1),
        edges: [],
        description: `Scheduling ${totalPackets} packet(s) across ${flows.length} weighted flow(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols: Math.max(1, ...flows.map((f) => f.packets.length)), virtualTime: 0, served: 0, order: [], finishTimes: [] },
    };
    let step = 1;

    for (let i = 0; i < totalPackets; i += 1) {
        const current = scheduled[i] as Scheduled;
        yield {
            stepNumber: step,
            entities: makeCells(flows, scheduled, i, i),
            edges: [],
            description: `Transmit ${current.label}: finish time ${current.finish.toFixed(4)} for a size-${(flows[current.flow]?.packets[current.packet] ?? 0)} packet.`,
            codeLineNumber: i === 0 ? 1 : i === 1 ? 2 : 3,
            layout: "grid",
            meta: {
                rows,
                cols: Math.max(1, ...flows.map((f) => f.packets.length)),
                virtualTime: current.finish,
                served: i + 1,
                order: scheduled.slice(0, i + 1).map((s) => s.label),
                finishTimes: scheduled.slice(0, i + 1).map((s) => s.finish),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(flows, scheduled, totalPackets, -1),
        edges: [],
        description: `All ${totalPackets} packet(s) transmitted in ${rows} flow(s); final virtual time ${(scheduled[totalPackets - 1]?.finish ?? 0).toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows,
            cols: Math.max(1, ...flows.map((f) => f.packets.length)),
            virtualTime: scheduled[totalPackets - 1]?.finish ?? 0,
            served: totalPackets,
            order: scheduled.map((s) => s.label),
            finishTimes: scheduled.map((s) => s.finish),
        },
    };
}

/** The weighted fair queuing module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Give each flow a virtual clock that runs faster when its weight is larger. Every packet reserves the next slot on its flow's clock, and the scheduler always sends whichever packet finishes its slot earliest. Heavier-weighted flows accumulate finish times more slowly for the same bytes, so they win more slots and get more bandwidth.",
        invariants: [
            "A flow's finish times strictly increase with each of its packets.",
            "Packets within a flow are transmitted in arrival order.",
            "The finish time of a packet equals its start time plus size divided by weight.",
        ],
        correctness:
            "In weighted fair queuing, a packet's virtual finish time is the cumulative service its flow has been allotted, which is the packet length divided by the flow weight. Transmitting in finish-time order is the packet-by-packet approximation of generalized processor sharing, so over any busy period each flow receives service proportional to its weight. Sorting by finish time with a stable tie-break transmits packets in the exact order the virtual-clock algorithm would choose.",
        complexityRationale:
            "Computing finish times scans all p packets once, and sorting them costs O(p log p) time. The scheduled list and the grid of packets use O(p) space.",
        uses: [
            "Fair bandwidth sharing in network routers and switches",
            "Quality-of-service scheduling for voice and video traffic",
            "CPU and storage schedulers that apportion weight among tenants",
        ],
        references: [
            "Demers, Keshav, and Shenker, Analysis and Simulation of a Fair Queueing Algorithm, 1989",
            "Parekh and Gallager, A Generalized Processor Sharing Approach to Flow Control, 1993",
        ],
        workedExample:
            "Flow A with weight 1 sends a size-4 packet, finishing at virtual time 4. Flow B with weight 2 sends a size-4 packet, finishing at 2. Even though A's packet was listed first, B's packet is transmitted first because its heavier weight gives it the earlier finish time.",
    },
    id: "weighted-fair-queuing",
    name: "Weighted Fair Queuing",
    category: "production-systems",
    complexity: { time: "O(p log p)", space: "O(p)" },
    defaultInput: {
        flows: [
            { id: "A", weight: 1, packets: [4, 2, 6] },
            { id: "B", weight: 2, packets: [3, 3] },
            { id: "C", weight: 1, packets: [5, 5, 5] },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each flow set its virtual finish time to zero",
        "for each packet in a flow",
        "add packet size divided by flow weight to the finish time",
        "record the finish time for that packet",
        "sort all packets by finish time with a stable tie-break",
        "transmit packets in sorted order",
        "done: report the service order and final virtual time",
    ],
};

export default module;
