/**
 * codel.ts - CoDel (Controlled Delay) Active Queue Management
 *
 * CoDel attacks bufferbloat by watching the sojourn time of departing packets.
 * While the minimum sojourn over a sliding interval stays above a target, it
 * enters a dropping state and drops packets at an increasing rate proportional
 * to the square root of the drops already made. As soon as the minimum sojourn
 * falls back below the target it leaves the dropping state.
 *
 * Time O(n) for n departing packets with a sliding window, space O(n) for the log.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CoDelInput {
    packets?: Array<{ time: number; sojourn: number }>;
    target?: number;
    interval?: number;
}

export interface CoDelStep {
    time: number;
    sojourn: number;
    minSojourn: number;
    dropping: boolean;
    drop: boolean;
}

/** Run CoDel over a time-ordered stream of departing packets. */
export function codelSteps(
    packets: Array<{ time: number; sojourn: number }>, target: number, interval: number,
): CoDelStep[] {
    let dropping = false;
    let nextDrop = 0;
    let dropCount = 0;
    const window: Array<{ time: number; sojourn: number }> = [];
    return packets.map((packet) => {
        window.push(packet);
        while (window.length > 0 && (window[0]?.time ?? 0) <= packet.time - interval) {
            window.shift();
        }
        const minSojourn = Math.min(...window.map((x) => x.sojourn));
        let drop = false;
        if (minSojourn > target) {
            if (!dropping) {
                dropping = true;
                nextDrop = packet.time + interval;
            } else if (packet.time >= nextDrop) {
                drop = true;
                dropCount += 1;
                nextDrop = packet.time + interval / Math.sqrt(dropCount);
            }
        } else {
            dropping = false;
        }
        return { time: packet.time, sojourn: packet.sojourn, minSojourn, dropping, drop };
    });
}

const COLUMNS = ["time", "sojourn", "min", "drop"];

function makeCells(steps: CoDelStep[], revealed: number, active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    steps.forEach((step, row) => {
        const values = [step.time, step.sojourn, step.minSojourn, step.drop ? "drop" : step.dropping ? "armed" : "ok"];
        COLUMNS.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === active
                ? "comparing"
                : shown ? (step.drop ? "error" : step.dropping ? "active" : "sorted") : "idle";
            const value = values[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${typeof value === "string" ? value : value.toFixed(1)}` : "?",
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
    const task = (input as CoDelInput | null) ?? {};
    const packets: Array<{ time: number; sojourn: number }> = Array.isArray(task.packets) && task.packets.length > 0
        ? task.packets
        : Array.from({ length: 20 }, (_unused, i) => ({
            time: i * 5,
            sojourn: i < 8 ? 4 + i * 0.5 : i < 15 ? 30 - i * 0.5 : 12 - (i - 15) * 2,
        }));
    const target = Math.max(0, Number(task.target ?? 5));
    const interval = Math.max(1e-6, Number(task.interval ?? 100));
    const steps = codelSteps(packets, target, interval);
    const drops = steps.filter((s) => s.drop).length;
    const base = { rows: steps.length, cols: COLUMNS.length, target, interval, drops };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(steps, -1, -1),
        edges: [],
        description: `CoDel monitors ${steps.length} departing packets with target ${target} and interval ${interval}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, minSojourns: steps.map((s) => s.minSojourn), dropped: steps.map((s) => (s.drop ? 1 : 0)) },
    };
    step += 1;

    for (let i = 0; i < steps.length; i += 1) {
        const s = steps[i]!;
        yield {
            stepNumber: step,
            entities: makeCells(steps, i, i),
            edges: [],
            description: `t=${s.time.toFixed(1)}: min sojourn ${s.minSojourn.toFixed(1)}, ${s.drop ? "drop" : s.dropping ? "dropping state armed" : "below target"}.`,
            codeLineNumber: s.drop ? 6 : s.dropping ? 4 : 7,
            layout: "grid",
            meta: { ...base, active: i, minSojourns: steps.map((x) => x.minSojourn), dropped: steps.map((x) => (x.drop ? 1 : 0)) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(steps, steps.length - 1, -1),
        edges: [],
        description: `Done: CoDel dropped ${drops} of ${steps.length} packet(s) as the queue built and drained.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...base, done: true, minSojourns: steps.map((s) => s.minSojourn), dropped: steps.map((s) => (s.drop ? 1 : 0)), droppedTimes: steps.filter((s) => s.drop).map((s) => s.time) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A deep buffer hides congestion because packets wait instead of being lost, and the queue only grows. CoDel measures how long packets actually spend in the queue. If the minimum sojourn over the last interval stays above a target, queues are persistently deep, so it starts dropping packets, and it drops more often the longer that condition lasts. When the minimum falls back below the target, it stops, letting the queue drain without overreacting to a single spike.",
        invariants: [
            "The minimum sojourn is taken over packets that departed within the last interval.",
            "A packet is dropped only while the dropping state is armed and the minimum sojourn exceeds the target.",
            "Between drops the wait grows as the interval divided by the square root of the drop count, so drops accelerate.",
        ],
        correctness:
            "The sliding window drops departures older than one interval, so the tracked minimum reflects only recent queueing. On the first observation above target the state arms and the next drop is scheduled one interval later, giving the queue time to react; subsequent drops use interval over square root of the drop count, a standard control law that increases pressure gradually. Any observation at or below target immediately disarms the state, guaranteeing that drops stop once delay recovers. The tests reimplement the state machine independently, verify that no drop happens while the minimum is at or below target, and check the accelerating schedule.",
        complexityRationale:
            "Each packet is pushed once and removed from the front of the window at most once, so the simulation is O(n) amortized; the per-packet log arrays use O(n) space.",
        uses: [
            "Router and switch queue management to combat bufferbloat",
            "Home gateway and cable modem firmware",
            "Low-latency network tuning alongside fair queueing",
        ],
        references: [
            "Nichols and Jacobson, Controlling Queue Delay, ACM Queue, 2012",
            "RFC 8289, Controlled Delay Active Queue Management",
        ],
        workedExample:
            "With target 5 and interval 100, packets whose minimum sojourn climbs above 5 arm the dropping state at time 100. If the condition persists, the first drop occurs at 200; the next is scheduled 100 over square root of two time units later, roughly 70.7, so drops come faster as the overload continues. Once the minimum falls to 5 or below, dropping stops.",
    },
    id: "codel",
    name: "CoDel Active Queue Management",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { target: 5, interval: 100 },
    visualType: "grid",
    run,
    pseudocode: [
        "keep a sliding window of departures from the last interval",
        "for each departing packet add it to the window and evict old entries",
        "compute the minimum sojourn over the window",
        "if the minimum exceeds the target and not armed, arm and schedule one drop after an interval",
        "if armed and the current time reaches the scheduled drop time, drop the packet",
        "after a drop schedule the next one after interval over square root of the drop count",
        "if the minimum is at or below the target, disarm the dropping state",
        "done: report the total drops",
    ],
};

export default module;
