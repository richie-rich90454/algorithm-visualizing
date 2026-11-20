/**
 * blue-active-queue-management.ts - BLUE Active Queue Management
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BLUE (Feng, Kandlur, Saha and Shin, 2002) manages a router queue using a
 * single drop/mark probability. Unlike RED it does not use average queue
 * length: it raises the probability only on actual queue overflow and lowers
 * it only when the link has been idle. A freeze interval prevents overreaction
 * to bursts of consecutive events.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n observed queue events
 *   Space: O(n) for the recorded probability and drop series
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observed event; height encodes the current drop probability.
 *   - Overflow events are red, idle events blue, and drops are highlighted.
 *   - meta carries the probability and drop series for independent checking.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface QueueEvent {
    queueLen: number;
    coin?: number;
}

/** Build probability bars for the events observed so far. */
function makeBars(probabilities: number[], drops: number[], kinds: string[], current: number): VisualEntity[] {
    return probabilities.map((probability, index) => {
        let state: EntityState = "idle";
        if (kinds[index] === "overflow") {
            state = "error";
        } else if (kinds[index] === "idle") {
            state = "highlight";
        }
        if (drops[index] === 1) {
            state = "swapped";
        }
        if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${kinds[index]}:p=${probability.toFixed(3)}`,
            value: probability,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, probability, dropped: drops[index] === 1, kind: kinds[index] ?? "normal" },
        };
    });
}

/** Simulate BLUE over a stream of queue-length observations. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        events?: QueueEvent[];
        capacity?: number;
        increment?: number;
        decrement?: number;
        idleThreshold?: number;
        freezeTime?: number;
    } | null) ?? {};
    const events: QueueEvent[] = task.events ?? [
        { queueLen: 5 }, { queueLen: 9 }, { queueLen: 12 }, { queueLen: 12 },
        { queueLen: 6 }, { queueLen: 2 }, { queueLen: 0 }, { queueLen: 0 },
        { queueLen: 0 }, { queueLen: 4 }, { queueLen: 11 }, { queueLen: 3 },
    ];
    const capacity = Math.max(1, Math.floor(Number(task.capacity ?? 10)) || 10);
    const increment = Math.min(1, Math.max(0, Number(task.increment ?? 0.02)));
    const decrement = Math.min(1, Math.max(0, Number(task.decrement ?? 0.005)));
    const idleThreshold = Math.max(1, Math.floor(Number(task.idleThreshold ?? 2)) || 2);
    const freezeTime = Math.max(1, Math.floor(Number(task.freezeTime ?? 1)) || 1);

    let probability = 0;
    let lastUpdate = -freezeTime;
    let emptyRun = 0;
    const probabilities: number[] = [];
    const drops: number[] = [];
    const kinds: string[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `BLUE AQM over ${events.length} event(s), capacity ${capacity}, increment ${increment}, decrement ${decrement}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { probabilities: [], drops: [], kinds: [], finalProbability: 0 },
    };
    step += 1;

    for (let t = 0; t < events.length; t += 1) {
        const event = events[t];
        if (!event) {
            continue;
        }
        const queueLen = Math.max(0, Math.floor(Number(event.queueLen)) || 0);
        let kind = "normal";
        if (queueLen >= capacity) {
            kind = "overflow";
            emptyRun = 0;
        } else if (queueLen === 0) {
            emptyRun += 1;
            if (emptyRun >= idleThreshold) {
                kind = "idle";
            }
        } else {
            emptyRun = 0;
        }

        if (kind !== "normal" && t - lastUpdate >= freezeTime) {
            if (kind === "overflow") {
                probability += increment;
            } else {
                probability -= decrement;
            }
            probability = Math.min(1, Math.max(0, probability));
            lastUpdate = t;
        }

        const provided = Number(event.coin);
        const coin = Number.isFinite(provided) ? Math.min(1, Math.max(0, provided)) : ((t * 37) % 101) / 101;
        const dropped = coin < probability ? 1 : 0;

        probabilities.push(probability);
        drops.push(dropped);
        kinds.push(kind);

        yield {
            stepNumber: step,
            entities: makeBars(probabilities, drops, kinds, probabilities.length - 1),
            edges: [],
            description: `t${t}: queue ${queueLen} (${kind}), p=${probability.toFixed(3)}, packet ${dropped ? "dropped" : "forwarded"}.`,
            codeLineNumber: kind === "overflow" ? 3 : kind === "idle" ? 5 : 7,
            layout: "array",
            meta: {
                probabilities: [...probabilities],
                drops: [...drops],
                kinds: [...kinds],
                finalProbability: probability,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, drops, kinds, -1),
        edges: [],
        description: `BLUE finished with p=${probability.toFixed(3)} and ${drops.reduce((a, b) => a + b, 0)} drop(s) over ${events.length} event(s).`,
        codeLineNumber: 8,
        layout: "array",
        meta: {
            probabilities: [...probabilities],
            drops: [...drops],
            kinds: [...kinds],
            finalProbability: probability,
            totalDrops: drops.reduce((a, b) => a + b, 0),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Keep one number: how likely you are to drop a packet. Increase it only when the queue really overflows and decrease it only when the link has gone quiet. Waiting for real signals instead of an average queue length makes BLUE reactive to genuine congestion but calm during harmless bursts.",
        invariants: [
            "The drop probability always stays between zero and one.",
            "The probability changes only on an overflow or a sustained-idle event past the freeze interval.",
            "A packet is dropped exactly when its coin is below the current probability.",
        ],
        correctness:
            "Overflow is the definitive sign of congestion, so raising p there reduces future arrivals; a sustained empty queue is the definitive sign of underuse, so lowering p there invites more traffic. Because the probability can only move in those two situations and is clamped to the unit interval, the controller is stable and monotone in the direction of the observed signal.",
        complexityRationale:
            "Each event needs a constant number of arithmetic operations and one emitted frame, so time is linear in the number of events. Storing the probability, drop and kind per event uses three arrays of length n, giving linear space.",
        uses: [
            "Congestion control in IP routers and switches",
            "Early congestion signaling for TCP flows",
            "A simpler alternative to RED in high-speed networks",
        ],
        references: [
            "Feng, Kandlur, Saha and Shin, BLUE: A New Class of Active Queue Management Algorithms, 2002",
            "RFC 7567, IETF Recommendations Regarding Active Queue Management",
        ],
        workedExample:
            "With capacity 10, increment 0.02 and decrement 0.005, an overflow at queue length 12 raises p to 0.02. Two empty observations lower it by 0.005 each to 0.01. A later overflow raises it again, so the probability tracks real congestion rather than transient queue length.",
    },
    id: "blue-active-queue-management",
    name: "BLUE Active Queue Management",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        events: [
            { queueLen: 5 }, { queueLen: 9 }, { queueLen: 12 }, { queueLen: 12 },
            { queueLen: 6 }, { queueLen: 2 }, { queueLen: 0 }, { queueLen: 0 },
            { queueLen: 0 }, { queueLen: 4 }, { queueLen: 11 }, { queueLen: 3 },
        ],
        capacity: 10,
        increment: 0.02,
        decrement: 0.005,
        idleThreshold: 2,
        freezeTime: 1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "set drop probability p to zero",
        "for each observed queue event at time t",
        "if queue length reaches capacity, classify as overflow",
        "if overflow and t minus last update reaches freeze time, add increment to p",
        "if queue has been empty past the idle threshold, classify as idle",
        "if idle and freeze time elapsed, subtract decrement from p",
        "clamp p into the interval from zero to one",
        "drop the packet when a random coin is below p",
        "after all events, report probabilities and total drops",
    ],
};

export default module;
