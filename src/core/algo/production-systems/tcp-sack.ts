/**
 * tcp-sack.ts - TCP Selective Acknowledgment (SACK) Scoreboard
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * With cumulative acknowledgments alone a sender cannot tell which packets
 * arrived out of order after a gap. Selective acknowledgment lets the receiver
 * report additional contiguous blocks that it has buffered. The sender keeps a
 * scoreboard of all sequence numbers and retransmits exactly the holes: packets
 * that are neither below the cumulative ACK nor inside a SACK block.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + k) for n outstanding packets and k SACK blocks
 *   Space: O(n) for the scoreboard
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each outstanding packet is a cell labeled with its sequence number.
 *   - Cumulative-ACK packets turn green, SACK packets blue, holes red.
 *   - Holes are then retransmitted one at a time and turn green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Block = [number, number];

/** Build one cell per packet with a state derived from the scoreboard. */
function buildEntities(
    total: number,
    cumulative: number,
    blocks: Block[],
    retransmitted: Set<number>,
): VisualEntity[] {
    return Array.from({ length: total }, (_, i) => {
        const seq = i + 1;
        const cumAcked = seq <= cumulative;
        const sacked = blocks.some(([lo, hi]) => seq >= lo && seq <= hi);
        const hole = !cumAcked && !sacked;
        const state: EntityState = retransmitted.has(seq)
            ? "sorted"
            : cumAcked
              ? "sorted"
              : sacked
                ? "visited"
                : hole
                  ? "error"
                  : "idle";
        return {
            id: `pkt-${seq}`,
            type: "cell" as const,
            label: String(seq),
            value: seq,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i, seq, cumAcked, sacked, hole },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { total?: number; cumulativeAck?: number; sackBlocks?: Block[] } | null) ?? {};
    const total = Math.max(1, Math.floor(task.total ?? 10));
    const cumulative = Math.max(0, Math.min(total, Math.floor(task.cumulativeAck ?? 2)));
    const blocks: Block[] = Array.isArray(task.sackBlocks)
        ? task.sackBlocks.map(([lo, hi]) => [Math.max(1, lo), Math.min(total, hi)] as Block)
        : [
              [4, 5],
              [8, 9],
          ];
    const retransmitted = new Set<number>();
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(total, cumulative, blocks, retransmitted),
        edges: [],
        description: `Tracking ${total} outstanding packet(s) with a SACK scoreboard.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: total, total, cumulativeAck: cumulative, sackBlocks: blocks, retransmit: [], phase: "start" },
    };

    yield {
        stepNumber: step++,
        entities: buildEntities(total, cumulative, blocks, retransmitted),
        edges: [],
        description: `Cumulative ACK ${cumulative}: packets 1 through ${cumulative} arrived in order.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: 1, cols: total, total, cumulativeAck: cumulative, sackBlocks: blocks, retransmit: [], phase: "cumulative" },
    };

    for (let i = 0; i < blocks.length; i += 1) {
        const [lo, hi] = blocks[i] ?? [0, 0];
        yield {
            stepNumber: step++,
            entities: buildEntities(total, cumulative, blocks, retransmitted),
            edges: [],
            description: `SACK block ${i + 1}: packets ${lo} through ${hi} arrived out of order and are buffered.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: total,
                total,
                cumulativeAck: cumulative,
                sackBlocks: blocks,
                retransmit: [],
                phase: "sack",
                index: i,
            },
        };
    }

    const holes: number[] = [];
    for (let seq = 1; seq <= total; seq += 1) {
        const cumAcked = seq <= cumulative;
        const sacked = blocks.some(([lo, hi]) => seq >= lo && seq <= hi);
        if (!cumAcked && !sacked) holes.push(seq);
    }
    yield {
        stepNumber: step++,
        entities: buildEntities(total, cumulative, blocks, retransmitted),
        edges: [],
        description: `Scoreboard complete: ${holes.length} hole(s) need retransmission (${holes.join(", ") || "none"}).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: 1, cols: total, total, cumulativeAck: cumulative, sackBlocks: blocks, retransmit: holes.slice(), phase: "holes" },
    };

    for (const seq of holes) {
        retransmitted.add(seq);
        yield {
            stepNumber: step++,
            entities: buildEntities(total, cumulative, blocks, retransmitted),
            edges: [],
            description: `Retransmitting packet ${seq}, the only missing segment at this hole.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                rows: 1,
                cols: total,
                total,
                cumulativeAck: cumulative,
                sackBlocks: blocks,
                retransmit: holes.slice(),
                phase: "retransmit",
                seq,
            },
        };
    }

    yield {
        stepNumber: step++,
        entities: buildEntities(total, cumulative, blocks, retransmitted),
        edges: [],
        description: `All ${total} packet(s) are now accounted for after ${holes.length} retransmission(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 1, cols: total, total, cumulativeAck: cumulative, sackBlocks: blocks, retransmit: holes, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A cumulative ACK says everything up to a sequence number arrived, but says nothing about what arrived after a gap. SACK adds a list of received blocks. The sender marks everything covered by the cumulative ACK or a SACK block, and whatever is left is genuinely lost and must be sent again.",
        invariants: [
            "A packet below the cumulative ACK or inside a SACK block is already received.",
            "Only unacknowledged, unsacked packets are retransmitted.",
            "After retransmission every sequence number in the window is accounted for.",
        ],
        correctness:
            "The scoreboard partitions the window into three disjoint sets: cumulatively acknowledged packets, selectively acknowledged packets, and holes. A SACK block reports data the receiver has buffered, so those packets do not need resending. Cumulative ACKs cover a prefix that is known to be in order. The complement of those two sets is exactly the set of missing packets, so retransmitting it recovers all lost data without duplicating received data unnecessarily.",
        complexityRationale:
            "Building the scoreboard scans n packets once and checks each packet against k SACK blocks, giving O(n + k) with a simple linear scan. The scoreboard itself stores one flag per packet, so space is O(n).",
        uses: [
            "Loss recovery in TCP during multiple losses in one window",
            "High-bandwidth links where a single loss would otherwise force a full retransmit",
            "Wireless networks with frequent out-of-order delivery",
        ],
        references: [
            "RFC 2018, TCP Selective Acknowledgment Options",
            "RFC 6675, A Conservative Loss Recovery Algorithm Based on SACK",
        ],
        workedExample:
            "Ten packets are outstanding, the cumulative ACK is 2, and SACK blocks report 4-5 and 8-9. Packets 1-2, 4-5 and 8-9 are received, leaving holes 3, 6, 7 and 10. Only those four are retransmitted.",
    },
    id: "tcp-sack",
    name: "TCP Selective Acknowledgment (SACK)",
    category: "production-systems",
    complexity: { time: "O(n + k)", space: "O(n)" },
    defaultInput: { total: 10, cumulativeAck: 2, sackBlocks: [[4, 5], [8, 9]] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize a scoreboard for all outstanding packets",
        "mark every sequence number up to the cumulative ACK as received",
        "mark every sequence number in each SACK block as received",
        "collect the unmarked sequence numbers as holes",
        "retransmit each hole and mark it received",
        "done: every packet in the window is accounted for",
    ],
};

export default module;
