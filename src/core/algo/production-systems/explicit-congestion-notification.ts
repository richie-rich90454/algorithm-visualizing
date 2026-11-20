/**
 * explicit-congestion-notification.ts - Explicit Congestion Notification (ECN)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Instead of dropping packets when a queue starts to fill, a router using ECN
 * marks the congestion-experienced bit in packets once the queue length passes
 * a threshold. The receiver echoes that mark back, and the sender reacts by
 * cutting its congestion window. Congestion is signaled without the loss and
 * retransmission cost of a dropped packet.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) for m queue samples
 *   Space: O(m) for the displayed queue and congestion-window history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per queue sample shows the instantaneous queue length.
 *   - A sample at or above the threshold is highlighted as congestion marked.
 *   - The congestion window after each sample is reported in the frame meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the queue-sample cells. */
function buildEntities(queue: number[], threshold: number, upto: number): VisualEntity[] {
    return queue.map((length, col) => {
        const marked = length >= threshold;
        const revealed = col <= upto;
        const state: EntityState = !revealed ? "idle" : marked ? "error" : "sorted";
        return {
            id: `q-${col}`,
            type: "cell" as const,
            label: String(length),
            value: length,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, length, marked, threshold },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { queue?: number[]; threshold?: number; cwnd?: number; factor?: number } | null) ?? {};
    const queue: number[] = Array.isArray(task.queue) ? task.queue : [2, 4, 6, 9, 7, 3, 1, 5, 8, 2];
    const threshold = Math.max(1, Math.floor(task.threshold ?? 6));
    let cwnd = Math.max(1, task.cwnd ?? 16);
    const factor = typeof task.factor === "number" && task.factor > 0 && task.factor < 1 ? task.factor : 0.5;
    const history: number[] = [cwnd];
    const marks: boolean[] = [];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(queue, threshold, -1),
        edges: [],
        description: `Monitoring ${queue.length} queue sample(s) with a marking threshold of ${threshold}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: queue.length, threshold, cwnd, queue: queue.slice(), marks: [], cwndHistory: history.slice(), phase: "start" },
    };

    for (let i = 0; i < queue.length; i += 1) {
        const length = queue[i] ?? 0;
        const marked = length >= threshold;
        marks.push(marked);
        if (marked) cwnd = Math.max(1, cwnd * factor);
        history.push(cwnd);
        yield {
            stepNumber: step++,
            entities: buildEntities(queue, threshold, i),
            edges: [],
            description: marked
                ? `Queue ${length} >= ${threshold}: set the congestion bit; sender cuts window to ${cwnd.toFixed(2)}.`
                : `Queue ${length} < ${threshold}: no mark; window stays at ${cwnd.toFixed(2)}.`,
            codeLineNumber: marked ? 3 : 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: queue.length,
                threshold,
                cwnd,
                queue: queue.slice(),
                marks: marks.slice(),
                cwndHistory: history.slice(),
                phase: "sample",
                index: i,
                marked,
            },
        };
    }

    const markedCount = marks.filter(Boolean).length;
    yield {
        stepNumber: step++,
        entities: buildEntities(queue, threshold, queue.length - 1),
        edges: [],
        description: `ECN pass complete: ${markedCount} mark(s) sent; final congestion window ${cwnd.toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 1,
            cols: queue.length,
            threshold,
            cwnd,
            queue: queue.slice(),
            marks,
            cwndHistory: history,
            phase: "done",
            markedCount,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A router can warn senders before it has to drop a packet. When the queue grows past a threshold it flips a single bit in passing packets. The receiver echoes the warning and the sender shrinks its sending rate. The network stays below the drop point while still telling the sender to slow down.",
        invariants: [
            "A queue sample at or above the threshold is marked as congestion experienced.",
            "The congestion window is reduced only on a marked sample.",
            "The congestion window never drops below one packet.",
        ],
        correctness:
            "The marking rule is a deterministic comparison of each queue length with the threshold, so every crossing sample is flagged and no other sample is. The sender reaction lowers the congestion window by a fixed factor precisely on flagged samples, and clamping at one keeps the window positive. Thus the reported window sequence is exactly the reduction applied to each marked sample, and unmarked samples leave it untouched.",
        complexityRationale:
            "Each of the m queue samples needs one comparison and at most one multiplication, so time is O(m). Storing the queue, the marks and the window history uses O(m) space.",
        uses: [
            "Congestion control in modern TCP (RFC 3168 and DCTCP)",
            "Data-center networks that need low latency and zero loss",
            "Queue management in routers and switches",
        ],
        references: [
            "RFC 3168, The Addition of Explicit Congestion Notification to IP",
            "RFC 8257, TCP Congestion Control with ECN",
        ],
        workedExample:
            "With threshold 6 and window 16, queue samples 2, 4, 6, 9 trigger no mark, mark, mark. The first mark cuts the window to 8, the second to 4; all other samples leave it unchanged.",
    },
    id: "explicit-congestion-notification",
    name: "Explicit Congestion Notification (ECN)",
    category: "production-systems",
    complexity: { time: "O(m)", space: "O(m)" },
    defaultInput: { queue: [2, 4, 6, 9, 7, 3, 1, 5, 8, 2], threshold: 6, cwnd: 16, factor: 0.5 },
    visualType: "grid",
    run,
    pseudocode: [
        "set the congestion window and the marking threshold",
        "for each observed queue length",
        "if the queue length is below the threshold, do nothing",
        "otherwise mark the packet as congestion experienced",
        "on an echoed mark, multiply the window by the reduction factor",
        "clamp the window to at least one packet",
        "done: report the marks and final window",
    ],
};

export default module;
