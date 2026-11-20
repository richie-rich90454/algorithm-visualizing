/**
 * hierarchical-token-bucket.ts - Hierarchical Token Bucket Scheduler
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A hierarchical token bucket gives every traffic class its own token bucket
 * with a rate and a burst size, and arranges the classes under a parent bucket.
 * Time passing refills every bucket up to its burst. A packet from a class is
 * sent when that class has enough tokens; when it does not, the class may
 * borrow the tokens from its parent bucket, which is the mechanism that lets a
 * class use capacity its siblings are not using. A packet that cannot be
 * served by either bucket is dropped.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p + c) for p packets and c classes (one refill per class per tick)
 *   Space: O(c) for the token buckets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per class; its height is the current token balance.
 *   - A served packet is green, a borrowed packet amber, a drop red.
 *   - meta carries each class's tokens and the packet verdicts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BucketSpec {
    name?: string;
    rate?: number;
    burst?: number;
    parent?: string;
}
interface Packet {
    cls?: string;
    size?: number;
    t?: number;
}
interface HtbInput {
    buckets?: BucketSpec[];
    packets?: Packet[];
}

/** Build one bar per bucket with a focus colour. */
function makeBars(
    names: string[],
    tokens: number[],
    bursts: number[],
    focus: number,
    focusState: EntityState,
): VisualEntity[] {
    return names.map((name, i) => ({
        id: `bucket-${i}`,
        type: "bar" as const,
        label: `${name}:${(tokens[i] ?? 0).toFixed(1)}`,
        value: tokens[i] ?? 0,
        state: (i === focus ? focusState : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, burst: bursts[i] ?? 0, tokens: tokens[i] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HtbInput | null) ?? {};
    const specs: BucketSpec[] = Array.isArray(task.buckets) && task.buckets.length > 0
        ? task.buckets
        : [
            { name: "root", rate: 0.08, burst: 30 },
            { name: "voice", rate: 0.02, burst: 10, parent: "root" },
            { name: "data", rate: 0.05, burst: 20, parent: "root" },
        ];
    const packets: Packet[] = Array.isArray(task.packets)
        ? task.packets
        : [
            { cls: "voice", size: 8, t: 0 },
            { cls: "voice", size: 8, t: 20 },
            { cls: "voice", size: 8, t: 40 },
            { cls: "data", size: 15, t: 50 },
            { cls: "data", size: 15, t: 60 },
            { cls: "voice", size: 20, t: 70 },
            { cls: "data", size: 10, t: 200 },
        ];

    const names = specs.map((spec, i) => String(spec.name ?? `class-${i}`));
    const indexOf = new Map(names.map((name, i) => [name, i] as const));
    const rates = specs.map((spec) => Math.max(0, Number(spec.rate) || 0));
    const bursts = specs.map((spec) => Math.max(1, Number(spec.burst) || 1));
    const parents = specs.map((spec) => (spec.parent ? (indexOf.get(spec.parent) ?? -1) : -1));
    const tokens = bursts.slice();
    const verdicts: string[] = [];
    let sent = 0;
    let borrowed = 0;
    let dropped = 0;
    let lastTime = Number(packets[0]?.t) || 0;
    let step = 0;
    const emit = (description: string, codeLine: number, focus: number, focusState: EntityState) => ({
        stepNumber: step++,
        entities: makeBars(names, tokens, bursts, focus, focusState),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "array" as const,
        meta: {
            names: names.slice(),
            tokens: tokens.slice(),
            bursts: bursts.slice(),
            verdicts: verdicts.slice(),
            sent,
            borrowed,
            dropped,
        },
    });

    yield emit(`Hierarchical token bucket with ${names.length} class(es).`, 0, -1, "idle");

    for (let i = 0; i < packets.length; i += 1) {
        const packet = packets[i] ?? {};
        const time = Number(packet.t) || 0;
        const size = Math.max(0, Number(packet.size) || 0);
        const classIndex = indexOf.get(String(packet.cls ?? "")) ?? -1;
        const elapsed = Math.max(0, time - lastTime);
        lastTime = time;
        for (let c = 0; c < tokens.length; c += 1) {
            tokens[c] = Math.min(bursts[c] ?? 0, (tokens[c] ?? 0) + (rates[c] ?? 0) * elapsed);
        }

        if (classIndex < 0) {
            verdicts.push("unknown");
            dropped += 1;
            yield emit(`Packet ${i} names an unknown class; dropped.`, 6, -1, "error");
            continue;
        }
        if ((tokens[classIndex] ?? 0) >= size) {
            tokens[classIndex] = (tokens[classIndex] ?? 0) - size;
            verdicts.push("sent");
            sent += 1;
            yield emit(`Packet ${i} of ${size} byte(s) sent from class "${names[classIndex]}".`, 4, classIndex, "sorted");
            continue;
        }
        const parent = parents[classIndex] ?? -1;
        if (parent >= 0 && (tokens[parent] ?? 0) >= size) {
            tokens[parent] = (tokens[parent] ?? 0) - size;
            verdicts.push("borrowed");
            borrowed += 1;
            yield emit(`Packet ${i} borrowed ${size} token(s) from parent "${names[parent]}".`, 6, parent, "comparing");
            continue;
        }
        verdicts.push("dropped");
        dropped += 1;
        yield emit(`Packet ${i} dropped: neither class nor parent has ${size} token(s).`, 6, classIndex, "error");
    }

    yield emit(
        `Finished: ${sent} sent, ${borrowed} borrowed and ${dropped} dropped packet(s).`,
        8,
        -1,
        "idle",
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Give each traffic class a bucket that fills with tokens over time up to a burst cap, and connect the buckets in a tree. A packet spends one token per byte from its own bucket when it can. If that bucket is short, try the parent bucket, which represents capacity the class is allowed to borrow from its siblings' idle time. Dropping is the last resort. This is the core of Linux HTB queuing.",
        invariants: [
            "No bucket ever holds more tokens than its burst capacity or a negative balance.",
            "Tokens are added at the bucket's configured rate times elapsed time.",
            "A packet is served from its own bucket first and only then from its parent.",
        ],
        correctness:
            "Refilling caps each bucket at its burst, so the balance stays within bounds. When a class has enough tokens, spending them is exactly the local rate limit. When it does not, borrowing draws from the parent only if the parent can cover the whole packet, so the parent's own guarantee is never overrun. Every branch therefore either spends real tokens from an authorized bucket or drops, and no packet is served without capacity.",
        complexityRationale:
            "For each packet the scheduler refills every bucket once and performs a constant number of comparisons, so the work is O(p + c). Storing one rate, burst and balance per class uses O(c) space.",
        uses: [
            "Quality-of-service scheduling in routers and Linux traffic control",
            "Guaranteeing bandwidth shares to different service classes",
            "Lending spare capacity from a parent to a busy child class",
        ],
        references: [
            "Devera, Linux Advanced Routing and Traffic Control HOWTO, chapter on HTB",
            "Cisco, Hierarchical Token Bucket configuration guide",
        ],
        workedExample:
            "A root bucket with burst 30 feeds voice and data children. At time zero each child is full, so an 8-byte voice packet is sent from the voice bucket. A 20-byte voice packet later finds only 12 tokens; if the root still holds 25 tokens the packet is borrowed from the root and counted as borrowed. If neither bucket can cover it, the packet is dropped.",
    },
    id: "hierarchical-token-bucket",
    name: "Hierarchical Token Bucket",
    category: "production-systems",
    complexity: { time: "O(p + c)", space: "O(c)" },
    defaultInput: {
        buckets: [
            { name: "root", rate: 0.08, burst: 30 },
            { name: "voice", rate: 0.02, burst: 10, parent: "root" },
            { name: "data", rate: 0.05, burst: 20, parent: "root" },
        ],
        packets: [
            { cls: "voice", size: 8, t: 0 },
            { cls: "voice", size: 8, t: 20 },
            { cls: "voice", size: 8, t: 40 },
            { cls: "data", size: 15, t: 50 },
            { cls: "data", size: 15, t: 60 },
            { cls: "voice", size: 20, t: 70 },
            { cls: "data", size: 10, t: 200 },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "create a token bucket with a rate and burst for each class",
        "start every bucket full and note the first packet time",
        "for each packet add rate times elapsed time to every bucket",
        "cap each bucket at its burst capacity",
        "if the packet's own bucket has enough tokens, spend them",
        "otherwise spend the tokens from its parent bucket if possible",
        "if neither bucket can serve it, drop the packet",
        "record the verdict for this packet",
        "done: report sent, borrowed and dropped counts",
    ],
};

export default module;
