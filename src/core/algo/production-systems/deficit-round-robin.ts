/**
 * deficit-round-robin.ts - Deficit Round Robin Packet Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Deficit round robin serves several packet flows with a byte-level quantum.
 * Each active flow accumulates a deficit each round, and transmits head packets
 * while its deficit covers their sizes. Unused credit carries to the next
 * round, but a flow that empties its queue resets its deficit to zero. The
 * result is fair even when packets have different lengths, without sorting or
 * per-packet timestamps.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(P + R * F) for P packets, R rounds, and F flows
 *   Space: O(P) for the flow queues and the send log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One cell per flow shows its head packet size and current deficit.
 *   - A transmitting flow is highlighted; an emptied flow turns green.
 *   - meta carries the send order, deficits, and round count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FlowInput {
    id: string;
    packets: number[];
}

interface Flow {
    id: string;
    queue: number[];
    deficit: number;
}

/** Result of one complete deficit round robin run. */
export interface DrrResult {
    sent: string[];
    rounds: number;
    deficits: number[];
}

/** Serve all flows until their queues are empty, using a byte quantum. */
export function simulate(inputFlows: FlowInput[], quantum: number): DrrResult {
    const flows: Flow[] = inputFlows.map((flow) => ({
        id: String(flow.id),
        queue: Array.isArray(flow.packets) ? flow.packets.map((size) => Math.max(0, Math.floor(size))) : [],
        deficit: 0,
    }));
    const sent: string[] = [];
    let rounds = 0;
    const guard = flows.reduce((total, flow) => total + flow.queue.length + 1, 1) * Math.max(1, quantum);
    while (flows.some((flow) => flow.queue.length > 0) && rounds < guard) {
        rounds += 1;
        for (const flow of flows) {
            if (flow.queue.length === 0) {
                continue;
            }
            flow.deficit += quantum;
            while (flow.queue.length > 0 && flow.deficit >= (flow.queue[0] ?? Infinity)) {
                const size = flow.queue.shift() ?? 0;
                flow.deficit -= size;
                sent.push(`${flow.id}:${size}`);
            }
            if (flow.queue.length === 0) {
                flow.deficit = 0;
            }
        }
    }
    return { sent, rounds, deficits: flows.map((flow) => flow.deficit) };
}

/** Build one cell per flow showing its head packet and credit. */
function makeCells(flows: Flow[], active: number): VisualEntity[] {
    return flows.map((flow, index) => {
        const head = flow.queue[0] ?? 0;
        let state: EntityState = "idle";
        if (flow.queue.length === 0) {
            state = "sorted";
        } else if (index === active) {
            state = "comparing";
        }
        return {
            id: `flow-${index}`,
            type: "cell" as const,
            label: `${flow.id}: head ${head}, deficit ${flow.deficit}`,
            value: head,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, head, deficit: flow.deficit, pending: flow.queue.length },
        };
    });
}

/** The deficit round robin generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { flows?: FlowInput[]; quantum?: number } | null) ?? {};
    const source: FlowInput[] = Array.isArray(task.flows) && task.flows.length > 0
        ? task.flows.map((flow) => ({
              id: String(flow.id),
              packets: Array.isArray(flow.packets) ? flow.packets.map((size) => Math.max(0, Math.floor(size))) : [],
          }))
        : [
              { id: "A", packets: [500, 1000, 1500] },
              { id: "B", packets: [1000] },
              { id: "C", packets: [700, 700] },
          ];
    const quantum = Math.max(1, Math.floor(task.quantum ?? 1000));
    const flows: Flow[] = source.map((flow) => ({ ...flow, queue: flow.packets.slice(), deficit: 0 }));
    const result = simulate(source, quantum);

    yield {
        stepNumber: 0,
        entities: makeCells(flows, -1),
        edges: [],
        description: `Deficit round robin with quantum ${quantum} over ${flows.length} flow(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: flows.length, quantum, sent: [] as string[], rounds: 0, done: false },
    };

    const sent: string[] = [];
    let step = 1;
    let rounds = 0;
    const guard = flows.reduce((total, flow) => total + flow.queue.length + 1, 1) * quantum;
    while (flows.some((flow) => flow.queue.length > 0) && rounds < guard) {
        rounds += 1;
        const activeFlows: number[] = [];
        for (let i = 0; i < flows.length; i += 1) {
            const flow = flows[i];
            if (!flow || flow.queue.length === 0) {
                continue;
            }
            activeFlows.push(i);
            flow.deficit += quantum;
            while (flow.queue.length > 0 && flow.deficit >= (flow.queue[0] ?? Infinity)) {
                const size = flow.queue.shift() ?? 0;
                flow.deficit -= size;
                sent.push(`${flow.id}:${size}`);
            }
            if (flow.queue.length === 0) {
                flow.deficit = 0;
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(flows, activeFlows[0] ?? -1),
            edges: [],
            description: `Round ${rounds}: served ${activeFlows.length} flow(s); ${sent.length} packet(s) sent so far.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: flows.length,
                quantum,
                sent: sent.slice(),
                rounds,
                deficits: flows.map((flow) => flow.deficit),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(flows, -1),
        edges: [],
        description: `All ${sent.length} packet(s) sent in ${result.rounds} round(s) with quantum ${quantum}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: flows.length,
            quantum,
            sent: result.sent,
            rounds: result.rounds,
            deficits: result.deficits,
            done: true,
        },
    };
}

/** The deficit round robin module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine giving each queue a sticker book of byte credits. Every round you add the same number of credits to each nonempty queue, then send packets while the credits cover their length. A short packet leaves leftover credit for later, which is why unequal packet sizes do not bias the scheduler the way simple round robin would.",
        invariants: [
            "A flow only sends a packet when its deficit is at least that packet's size.",
            "Deficit never becomes negative after a transmission.",
            "A flow whose queue empties resets its deficit to zero so credit cannot accumulate while idle.",
        ],
        correctness:
            "Every nonempty flow receives quantum new credits each round, so after a bounded number of rounds its deficit exceeds the largest packet it still holds; hence no flow starves. The service order inside a round follows the fixed flow order and consumes exactly the packet sizes, so the send log is a faithful replay. Because each packet is dequeued once, every packet is sent exactly once and none is invented.",
        complexityRationale:
            "Each packet is enqueued and dequeued once, and each round touches each flow once, so the time is O(P + R times F) for P packets, R rounds, and F flows. Storage holds the queues and the send log, both O(P).",
        uses: [
            "Fair queueing of variable-length packets in network switches",
            "Bandwidth sharing among competing traffic classes",
            "Scheduling cells in high-speed routers where per-packet sorting is too costly",
        ],
        references: [
            "Shreedhar and Varghese, Efficient Fair Queueing Using Deficit Round Robin, 1996",
            "Peterson and Davie, Computer Networks, Chapter on Quality of Service",
        ],
        workedExample:
            "With quantum 1000, flow A holding packets of 500, 1000, and 1500 bytes and flow B holding one 1000-byte packet, round one sends A's 500 and 1000 byte packets and B's 1000 byte packet. A's leftover 500 credit then helps send its 1500 byte packet in round two, illustrating how credit carries across rounds.",
    },
    id: "deficit-round-robin",
    name: "Deficit Round Robin",
    category: "production-systems",
    complexity: { time: "O(P + R * F)", space: "O(P)" },
    defaultInput: {
        flows: [
            { id: "A", packets: [500, 1000, 1500] },
            { id: "B", packets: [1000] },
            { id: "C", packets: [700, 700] },
        ],
        quantum: 1000,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the flows, their packet sizes, and the quantum",
        "while any flow still has packets",
        "for each nonempty flow add the quantum to its deficit",
        "send head packets while the deficit covers their size",
        "subtract each sent packet size from the deficit",
        "reset the deficit to zero when a flow empties",
        "repeat until every queue is empty",
        "done: report the send order and the round count",
    ],
};

export default module;
