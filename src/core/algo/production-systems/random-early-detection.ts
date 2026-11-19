/**
 * random-early-detection.ts - Random Early Detection (RED)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Random early detection is an active queue management scheme for routers. It
 * maintains an exponentially weighted average of the queue length and drops or
 * marks packets probabilistically before the queue fills. Below a minimum
 * threshold nothing is dropped; above a maximum threshold everything is
 * dropped; between them the drop probability rises linearly from zero to a
 * configured maximum. Early random drops signal senders to slow down before
 * the queue overflows, avoiding global synchronization and tail drop.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(q) for q observed queue lengths, with constant work per arrival
 *   Space: O(q) for the recorded averages, probabilities, and decisions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observation shows the instantaneous queue length.
 *   - A dropped observation is RED, an admitted one GREEN, the current one CYAN.
 *   - meta carries the average history, drop probabilities, and decision log.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RedInput {
    queueLengths?: number[];
    minTh?: number;
    maxTh?: number;
    maxP?: number;
    weight?: number;
    seed?: number;
}

function makeBars(lengths: number[], decisions: number[], current: number): VisualEntity[] {
    return lengths.map((length, index) => {
        let state: EntityState = "idle";
        if (index === current) {
            state = "active";
        } else if (decisions[index] === 1) {
            state = "error";
        } else if (decisions[index] === 0) {
            state = "sorted";
        }
        return {
            id: `obs-${index}`,
            type: "bar" as const,
            label: String(length),
            value: length,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, queue: length },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RedInput | null) ?? {};
    const lengths = Array.isArray(task.queueLengths) && task.queueLengths.length > 0
        ? task.queueLengths.map((value) => Math.max(0, Math.floor(Number(value) || 0)))
        : [2, 4, 6, 8, 10, 9, 7, 5, 3, 12, 14];
    const minTh = Math.max(1, Math.floor(Number(task.minTh) || 5));
    const maxTh = Math.max(minTh + 1, Math.floor(Number(task.maxTh) || 12));
    const maxP = Math.min(1, Math.max(0, Number(task.maxP) || 0.2));
    const weightRaw = Number(task.weight) || 0.002;
    const weight = Math.min(1, Math.max(0, weightRaw));
    const seed = Math.floor(Number(task.seed) || 11) >>> 0 || 1;
    let rng = seed;
    let average = 0;
    const averages: number[] = [];
    const probabilities: number[] = [];
    const decisions: number[] = [];
    let drops = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(lengths, decisions, -1),
        edges: [],
        description: `RED with thresholds ${minTh} and ${maxTh}, max drop probability ${maxP}, and weight ${weight}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            minTh,
            maxTh,
            maxP,
            weight,
            seed,
            averages,
            probabilities,
            decisions,
            drops,
        },
    };
    let step = 1;

    for (let i = 0; i < lengths.length; i += 1) {
        const queue = lengths[i] ?? 0;
        average = (1 - weight) * average + weight * queue;
        let probability: number;
        if (average < minTh) {
            probability = 0;
        } else if (average >= maxTh) {
            probability = 1;
        } else {
            probability = (maxP * (average - minTh)) / (maxTh - minTh);
        }
        rng = (Math.imul(1103515245, rng) + 12345) >>> 1;
        const draw = rng / 2147483648;
        const drop = draw < probability ? 1 : 0;
        drops += drop;
        averages.push(average);
        probabilities.push(probability);
        decisions.push(drop);
        yield {
            stepNumber: step,
            entities: makeBars(lengths, decisions, i),
            edges: [],
            description: `Observation ${i}: queue ${queue}, average ${average.toFixed(2)}, drop probability ${probability.toFixed(3)}, ${drop ? "dropped" : "admitted"}.`,
            codeLineNumber: drop ? 6 : 3,
            layout: "array",
            meta: {
                minTh,
                maxTh,
                maxP,
                weight,
                seed,
                averages: [...averages],
                probabilities: [...probabilities],
                decisions: [...decisions],
                drops,
                queue,
                draw,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(lengths, decisions, -1),
        edges: [],
        description: `Processed ${lengths.length} observation(s); dropped ${drops} packet(s) before the queue could overflow.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            minTh,
            maxTh,
            maxP,
            weight,
            seed,
            averages,
            probabilities,
            decisions,
            drops,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than waiting until a queue is completely full and dropping everything, RED watches a smoothed average of the queue length and starts dropping a small, random fraction of packets as the queue grows. Random drops spread the congestion signal across many flows instead of punishing all senders at once. The average filters out short bursts so a single transient spike does not cause unnecessary drops.",
        invariants: [
            "The average queue length is an exponentially weighted moving average of the observed lengths.",
            "A drop probability is zero below the minimum threshold and one at or above the maximum threshold.",
            "Between the thresholds the drop probability grows linearly up to the configured maximum.",
        ],
        correctness:
            "The EWMA update is applied exactly once per observation, and the piecewise probability function matches the RED definition at every threshold boundary, so it always lies between zero and one. Each drop decision is a comparison of a deterministic uniform draw against that probability, so the replay is reproducible. The companion test recomputes averages, probabilities, and draws with an independent generator, checks that probabilities are monotone nondecreasing in the average, and verifies the full decision log.",
        complexityRationale:
            "Every observation performs a constant number of arithmetic operations, so processing q observations is O(q). The recorded averages, probabilities, and decisions grow with q, giving O(q) space.",
        uses: [
            "Congestion avoidance in IP routers and switches",
            "Avoiding tail drop and global TCP synchronization",
            "A teaching model for active queue management such as CoDel and PIE",
        ],
        references: [
            "Floyd and Jacobson, Random Early Detection Gateways for Congestion Avoidance, 1993",
            "RFC 2309, Recommendations on Queue Management and Congestion Avoidance in the Internet",
        ],
        workedExample:
            "With minimum threshold 5, maximum threshold 12, max probability 0.2, and weight 0.1, an average queue of 8.5 yields probability 0.2 times (8.5 minus 5) over 7, about 0.10. A uniform draw below 0.10 drops the packet; an average below 5 never drops and an average of 12 or more always drops.",
    },
    id: "random-early-detection",
    name: "Random Early Detection",
    category: "production-systems",
    complexity: { time: "O(q)", space: "O(q)" },
    defaultInput: {
        queueLengths: [2, 4, 6, 8, 10, 14, 16, 18, 20, 5, 3],
        minTh: 5,
        maxTh: 12,
        maxP: 0.2,
        weight: 0.5,
        seed: 11,
    },
    visualType: "array",
    run,
    pseudocode: [
        "set the average queue length to zero",
        "for each observed queue length q do",
        "update the average as (1 - w) times the average plus w times q",
        "if the average is below the minimum threshold, admit the packet",
        "if the average is at or above the maximum threshold, drop the packet",
        "otherwise compute a linear drop probability up to maxP",
        "draw a uniform value and drop when it is below that probability",
        "done: report the averages, probabilities, and drop decisions",
    ],
};

export default module;
