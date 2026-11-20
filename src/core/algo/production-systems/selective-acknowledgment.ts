/**
 * selective-acknowledgment.ts - TCP Selective Acknowledgment (SACK) Scoreboard
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Selective acknowledgment lets a TCP receiver tell the sender exactly which
 * out-of-order segments arrived. The sender keeps a scoreboard of received
 * ranges, fills in the holes between the cumulative acknowledgment and the
 * highest SACKed segment, and retransmits only the missing segments instead of
 * going back to the last one acknowledged in order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(total + blocks * range) to mark and scan the scoreboard
 *   Space: O(total) for the received bitmap and gap list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per segment shows received (1) or missing (0).
 *   - The segment acknowledged or retransmitted this step is highlighted.
 *   - meta tracks the cumulative ACK, gap count, and retransmission list.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SackInput {
    total?: number;
    cumulativeAck?: number;
    sackBlocks?: Array<[number, number]>;
    retransmitLimit?: number;
}

export interface SackResult {
    received: boolean[];
    holes: number[];
    retransmit: number[];
    highest: number;
}

/** Build the scoreboard and decide which missing segments to send again. */
export function scoreboard(input: SackInput): SackResult {
    const total = Math.max(0, Math.floor(input.total ?? 10));
    const cumulativeAck = Math.max(0, Math.min(total, Math.floor(input.cumulativeAck ?? 0)));
    const blocks = input.sackBlocks ?? [[6, 7], [9, 10]];
    const limit = Math.max(0, Math.floor(input.retransmitLimit ?? 3));
    const received = Array.from({ length: total }, () => false);
    for (let i = 0; i < cumulativeAck; i += 1) received[i] = true;
    for (const [start, end] of blocks) {
        const lo = Math.max(1, Math.floor(start));
        const hi = Math.min(total, Math.floor(end));
        for (let i = lo; i <= hi; i += 1) received[i - 1] = true;
    }
    let highest = cumulativeAck;
    for (let i = 0; i < total; i += 1) {
        if (received[i]) highest = Math.max(highest, i + 1);
    }
    const holes: number[] = [];
    for (let i = cumulativeAck; i < highest; i += 1) {
        if (!received[i]) holes.push(i + 1);
    }
    const retransmit = holes.slice(0, limit);
    return { received, holes, retransmit, highest };
}

function makeEntities(result: SackResult, active: number, retransmitting: boolean): VisualEntity[] {
    return result.received.map((isReceived, index) => ({
        id: `segment-${index + 1}`,
        type: "bar" as const,
        label: isReceived ? "1" : "0",
        value: isReceived ? 1 : 0,
        state: (index === active
            ? retransmitting
                ? "swapped"
                : "comparing"
            : isReceived
                ? "sorted"
                : "error") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { segment: index + 1, received: isReceived },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SackInput | null) ?? {};
    const total = Math.max(0, Math.floor(task.total ?? 10));
    const cumulativeAck = Math.max(0, Math.min(total, Math.floor(task.cumulativeAck ?? 0)));
    const blocks = task.sackBlocks ?? [[6, 7], [9, 10]];
    const result = scoreboard(task);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities({ received: result.received.map(() => false), holes: [], retransmit: [], highest: 0 }, -1, false),
        edges: [],
        description: `Tracking ${total} segments with a cumulative ACK and ${blocks.length} SACK block(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { total, cumulativeAck: 0, blocks: blocks.length, gaps: 0, retransmit: [] as number[] },
    };
    step += 1;

    for (let i = 0; i < cumulativeAck; i += 1) {
        const received = result.received.map((_value, index) => index < i + 1);
        yield {
            stepNumber: step,
            entities: makeEntities({ ...result, received }, i, false),
            edges: [],
            description: `Cumulative acknowledgment covers segment ${i + 1}; all earlier segments are in order.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { total, cumulativeAck: i + 1, blocks: blocks.length, gaps: 0, retransmit: [] as number[] },
        };
        step += 1;
    }

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
        const block = blocks[blockIndex] ?? [0, 0];
        const [start, end] = block;
        const lo = Math.max(1, Math.floor(start));
        const hi = Math.min(total, Math.floor(end));
        for (let segment = lo; segment <= hi; segment += 1) {
            const received = scoreboard({
                total,
                cumulativeAck,
                sackBlocks: [...blocks.slice(0, blockIndex), [start, segment] as [number, number]],
                retransmitLimit: task.retransmitLimit ?? 3,
            }).received;
            yield {
                stepNumber: step,
                entities: makeEntities({ ...result, received }, segment - 1, false),
                edges: [],
                description: `SACK block ${blockIndex + 1} reports segment ${segment} as received out of order.`,
                codeLineNumber: 4,
                layout: "array",
                meta: { total, cumulativeAck, blocks: blockIndex + 1, gaps: result.holes.length, retransmit: result.retransmit },
            };
            step += 1;
        }
    }

    for (const segment of result.retransmit) {
        yield {
            stepNumber: step,
            entities: makeEntities(result, segment - 1, true),
            edges: [],
            description: `Gap detected: retransmitting missing segment ${segment} instead of replaying the whole window.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { total, cumulativeAck, blocks: blocks.length, gaps: result.holes.length, retransmit: result.retransmit },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(result, -1, false),
        edges: [],
        description: `Scoreboard complete: ${result.holes.length} gap(s), ${result.retransmit.length} segment(s) retransmitted.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { total, cumulativeAck, highest: result.highest, gaps: result.holes.length, retransmit: result.retransmit },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain TCP acknowledges only the last byte received in order, so one lost segment makes the sender replay everything after it. With selective acknowledgment, the receiver lists the out-of-order blocks it did get. The sender marks those blocks on a scoreboard and can then fill just the holes, which matters a lot on lossy high-bandwidth links.",
        invariants: [
            "Every segment up to the cumulative acknowledgment is marked as received.",
            "A SACK block marks only segments inside the reported inclusive range.",
            "A hole is a missing segment below the highest received segment, never beyond it.",
        ],
        correctness:
            "The scoreboard is the union of the cumulative prefix and the reported SACK ranges, so a segment is marked received if and only if the receiver actually has it. Scanning the interval between the cumulative ACK and the highest received segment therefore finds exactly the gaps that must be resent; retransmitting those in order closes the window with the fewest duplicate packets.",
        complexityRationale:
            "Marking each block takes time proportional to its range and scanning the window is linear in the number of segments, so the overall work is O(total plus the SACK ranges). The bitmap and gap list use O(total) space.",
        uses: [
            "TCP recovery on wireless and satellite links where losses are common",
            "High-bandwidth transfers that cannot afford go-back-N retransmission",
            "Congestion control algorithms that use the scoreboard to estimate loss",
        ],
        references: [
            "RFC 2018, TCP Selective Acknowledgment Options",
            "RFC 6675, A Conservative Loss Recovery Algorithm Based on Selective Acknowledgment",
        ],
        workedExample:
            "For ten segments with a cumulative ACK of 5 and SACK blocks [6,7] and [9,10], segments 1 through 7 and 9 through 10 are marked received. Segment 8 is the only hole below the highest received segment, so it alone is retransmitted.",
    },
    id: "selective-acknowledgment",
    name: "TCP Selective Acknowledgment Scoreboard",
    category: "production-systems",
    complexity: { time: "O(total + ranges)", space: "O(total)" },
    defaultInput: { total: 10, cumulativeAck: 5, sackBlocks: [[6, 7], [9, 10]], retransmitLimit: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "mark every segment up to the cumulative acknowledgment as received",
        "for each SACK block, mark its inclusive range as received",
        "find the highest segment that is marked received",
        "scan from the cumulative ACK to that highest segment",
        "record every unmarked segment in that range as a gap",
        "retransmit the earliest gaps up to the allowed limit",
        "done: report the gap list and the retransmitted segments",
    ],
};

export default module;
