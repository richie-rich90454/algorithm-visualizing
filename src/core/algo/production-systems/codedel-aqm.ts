/**
 * codedel-aqm.ts - CoDel Active Queue Management
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CoDel (Controlled Delay) is an active queue management scheme that watches
 * packet sojourn time instead of queue length. When the sojourn time stays
 * above a target delay for a full interval, CoDel enters a dropping state and
 * then drops packets at intervals that shrink as one over the square root of
 * the number of drops, until the queue drains. This keeps delay low without a
 * tuned queue threshold. The module simulates a deterministic single-server
 * FIFO queue and reports exactly which packets CoDel drops.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n packets, with one constant-time decision per departure
 *   Space: O(n) for the schedules, sojourn times, and decision trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per packet shows its sojourn time.
 *   - A dropped packet is red; the packet under review is yellow.
 *   - The target-delay line is the reference in every frame's description.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Packet {
    arrival: number;
    service: number;
}

function makeBars(sojourns: number[], drops: Set<number>, active: number, done: boolean, target: number): VisualEntity[] {
    return sojourns.map((value, index) => {
        let state: EntityState = "idle";
        if (drops.has(index)) {
            state = "error";
        } else if (done) {
            state = value > target ? "comparing" : "sorted";
        } else if (index === active) {
            state = "comparing";
        } else if (index < active) {
            state = "visited";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `p${index}: ${value.toFixed(0)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, sojourn: value, dropped: drops.has(index) },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { packets?: Packet[]; target?: number; interval?: number } | null) ?? {};
    const fallback: Packet[] = [
        { arrival: 0, service: 10 }, { arrival: 0, service: 10 }, { arrival: 0, service: 10 },
        { arrival: 0, service: 10 }, { arrival: 0, service: 10 }, { arrival: 5, service: 10 },
        { arrival: 5, service: 10 }, { arrival: 5, service: 10 }, { arrival: 20, service: 10 },
        { arrival: 20, service: 10 }, { arrival: 20, service: 10 }, { arrival: 30, service: 10 },
        { arrival: 30, service: 10 }, { arrival: 40, service: 10 }, { arrival: 40, service: 10 },
        { arrival: 50, service: 10 },
    ];
    const packets = (Array.isArray(task.packets) ? task.packets : fallback)
        .filter((packet) => packet && Number.isFinite(Number(packet.arrival)) && Number.isFinite(Number(packet.service)))
        .map((packet) => ({ arrival: Number(packet.arrival), service: Math.max(0, Number(packet.service)) }));
    const safePackets = packets.length > 0 ? packets : fallback;
    const target = typeof task.target === "number" && task.target > 0 ? task.target : 10;
    const interval = typeof task.interval === "number" && task.interval > 0 ? task.interval : 50;

    // Deterministic FIFO single-server simulation.
    const departures: number[] = [];
    const sojourns: number[] = [];
    let finish = 0;
    for (const packet of safePackets) {
        finish = Math.max(packet.arrival, finish) + packet.service;
        departures.push(finish);
        sojourns.push(finish - packet.arrival);
    }

    // CoDel state machine evaluated at each departure.
    const drops = new Set<number>();
    const trace: string[] = [];
    let firstAbove: number | null = null;
    let dropping = false;
    let count = 0;
    let dropNext = 0;
    const dropCounts: number[] = [];
    for (let i = 0; i < safePackets.length; i += 1) {
        const now = departures[i] ?? 0;
        const sojourn = sojourns[i] ?? 0;
        if (sojourn > target) {
            if (firstAbove === null) {
                firstAbove = now;
            }
        } else {
            firstAbove = null;
            if (dropping) {
                dropping = false;
                count = 0;
            }
        }
        if (!dropping && firstAbove !== null && now - firstAbove >= interval) {
            dropping = true;
            count = 0;
            dropNext = now;
        }
        let dropped = false;
        if (dropping && now >= dropNext) {
            drops.add(i);
            dropped = true;
            count += 1;
            dropCounts.push(count);
            dropNext = now + interval / Math.sqrt(count);
        }
        trace.push(`p${i}|now ${now}|sojourn ${sojourn.toFixed(1)}|firstAbove ${firstAbove ?? "none"}|dropping ${dropping ? "yes" : "no"}|count ${count}|${dropped ? "DROP" : "keep"}`);
    }

    const meanSojourn = sojourns.reduce((sum, value) => sum + value, 0) / sojourns.length;
    const meta = (phase: string, active: number) => ({
        phase,
        active,
        packetCount: safePackets.length,
        target,
        interval,
        arrivals: safePackets.map((packet) => packet.arrival),
        services: safePackets.map((packet) => packet.service),
        departures,
        sojourns,
        drops: [...drops].sort((a, b) => a - b),
        dropCounts,
        trace,
        droppedCount: drops.size,
        meanSojourn,
        maxSojourn: Math.max(...sojourns),
        firstAbove: firstAbove ?? -1,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(sojourns, drops, -1, false, target),
        edges: [],
        description: `CoDel on ${safePackets.length} packets: target delay ${target}, interval ${interval}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta("setup", -1),
    };
    let step = 1;

    for (let i = 0; i < safePackets.length; i += 1) {
        const dropped = drops.has(i);
        yield {
            stepNumber: step,
            entities: makeBars(sojourns, drops, i, false, target),
            edges: [],
            description: `Packet ${i}: sojourn ${(sojourns[i] ?? 0).toFixed(1)} vs target ${target}; ${trace[i]?.split("|").slice(3).join(" ")}.`,
            codeLineNumber: dropped ? 6 : 3,
            layout: "array",
            meta: meta("decision", i),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(sojourns, drops, -1, true, target),
        edges: [],
        description: `CoDel dropped ${drops.size} of ${safePackets.length} packets; mean sojourn ${meanSojourn.toFixed(1)} (target ${target}).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...meta("done", -1), phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A long queue is not always a bad queue, and a short queue can still carry old packets. CoDel watches how long packets actually wait. If waits stay above a target for a whole interval, the queue is judged persistently full and packets start being dropped. The drops get closer together as the problem persists, which pushes senders to slow down quickly, and the state resets as soon as waits fall back below the target.",
        invariants: [
            "A dropping episode starts only after the sojourn time exceeds the target for a full interval.",
            "Within a dropping episode the gap between drops is the interval divided by the square root of the drop count.",
            "When a packet's sojourn time falls to the target or below, the dropping state and counter reset.",
        ],
        correctness:
            "The FIFO simulation sets each departure to the later of the arrival and the previous departure plus the service time, which is the exact single-server recursion, so sojourn equals departure minus arrival. CoDel's state machine enters the dropping state only after a continuous interval above target, and the shrink schedule uses one over the square root of the drop count, matching the algorithm specification. Resetting on a low-sojourn packet guarantees the scheduler stops dropping once congestion clears.",
        complexityRationale:
            "Each packet update does a constant amount of work in both the FIFO simulation and the CoDel state machine, giving O(n) time; the schedules, sojourn list, and trace occupy O(n) space.",
        uses: [
            "Router and switch queue management to keep latency low",
            "Bufferbloat mitigation in home gateways",
            "Congestion control in high-speed networks",
        ],
        references: [
            "Nichols and Jacobson, Controlling Queue Delay, Communications of the ACM, 2012",
            "RFC 8289, Controlled Delay Active Queue Management",
        ],
        workedExample:
            "With ten millisecond service times and a target of ten, a burst of arrivals builds sojourn times of 10, 20, 30, and 40. Once the first above-target time persists for the full interval, CoDel drops a packet. A later drop is scheduled after interval divided by square root of two, so the second drop comes sooner than the first.",
    },
    id: "codedel-aqm",
    name: "CoDel Active Queue Management",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        packets: [
            { arrival: 0, service: 10 }, { arrival: 0, service: 10 }, { arrival: 0, service: 10 },
            { arrival: 0, service: 10 }, { arrival: 0, service: 10 }, { arrival: 5, service: 10 },
            { arrival: 5, service: 10 }, { arrival: 5, service: 10 }, { arrival: 20, service: 10 },
            { arrival: 20, service: 10 }, { arrival: 20, service: 10 }, { arrival: 30, service: 10 },
            { arrival: 30, service: 10 }, { arrival: 40, service: 10 }, { arrival: 40, service: 10 },
            { arrival: 50, service: 10 },
        ],
        target: 10,
        interval: 50,
    },
    visualType: "array",
    run,
    pseudocode: [
        "simulate the FIFO queue to obtain each packet's departure and sojourn time",
        "record the first time sojourn rises above the target delay",
        "reset the timer whenever sojourn falls back to the target or below",
        "after a full interval above target, enter the dropping state",
        "drop a packet and increment the drop counter",
        "schedule the next drop after interval over square root of the counter",
        "done: report which packets were dropped and the mean sojourn time",
    ],
};

export default module;
