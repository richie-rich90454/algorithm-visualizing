/**
 * pie-aqm.ts - PIE Active Queue Management (Proportional Integral Controller)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PIE (RFC 8033) controls queueing delay directly with a proportional-integral
 * loop. Every dequeue interval it measures the current queue delay, compares it
 * with a target, and adjusts a drop probability using a proportional term for
 * the current error and an integral term for the change since the last sample.
 * It needs no queue-length threshold tuning the way RED does.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n delay samples
 *   Space: O(n) for the recorded probability and drop series
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per delay sample; height encodes the drop probability.
 *   - Samples whose delay is above target are highlighted as congestion.
 *   - meta carries probabilities, delays and drops for independent checking.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DelaySample {
    delay: number;
    coin?: number;
}

/** Build probability bars for the samples observed so far. */
function makeBars(probabilities: number[], delays: number[], drops: number[], current: number): VisualEntity[] {
    return probabilities.map((probability, index) => {
        let state: EntityState = "idle";
        if ((delays[index] ?? 0) > 15) {
            state = "comparing";
        }
        if (drops[index] === 1) {
            state = "swapped";
        }
        if (index === current) {
            state = "active";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `s${index}:p=${probability.toFixed(3)}`,
            value: probability,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, probability, delay: delays[index] ?? 0, dropped: drops[index] === 1 },
        };
    });
}

/** Simulate the PIE proportional-integral controller over delay samples. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        samples?: DelaySample[];
        alpha?: number;
        beta?: number;
        target?: number;
        idleDecay?: number;
    } | null) ?? {};
    const samples: DelaySample[] = task.samples ?? [
        { delay: 2 }, { delay: 5 }, { delay: 10 }, { delay: 18 },
        { delay: 25 }, { delay: 30 }, { delay: 22 }, { delay: 12 },
        { delay: 4 }, { delay: 0 }, { delay: 0 }, { delay: 8 },
    ];
    const alpha = Math.min(1, Math.max(0, Number(task.alpha ?? 0.01)));
    const beta = Math.min(1, Math.max(0, Number(task.beta ?? 0.1)));
    const target = Math.max(0, Number(task.target ?? 15));
    const idleDecay = Math.min(1, Math.max(0, Number(task.idleDecay ?? beta)));

    let probability = 0;
    let lastDelay = target;
    const probabilities: number[] = [];
    const delays: number[] = [];
    const drops: number[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `PIE controller with target delay ${target} ms, alpha ${alpha}, beta ${beta} over ${samples.length} sample(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { probabilities: [], delays: [], drops: [], target, finalProbability: 0 },
    };
    step += 1;

    for (let t = 0; t < samples.length; t += 1) {
        const sample = samples[t];
        if (!sample) {
            continue;
        }
        const delay = Math.max(0, Number(sample.delay));
        const measured = delay === 0 ? 0 : delay;

        probability += alpha * (measured - target) + beta * (measured - lastDelay);
        if (delay === 0) {
            probability *= 1 - idleDecay;
        }
        probability = Math.min(1, Math.max(0, probability));
        lastDelay = measured;

        const coinIn = Number(sample.coin);
        const coin = Number.isFinite(coinIn) ? Math.min(1, Math.max(0, coinIn)) : ((t * 53) % 97) / 97;
        const dropped = coin < probability ? 1 : 0;

        probabilities.push(probability);
        delays.push(delay);
        drops.push(dropped);

        yield {
            stepNumber: step,
            entities: makeBars(probabilities, delays, drops, probabilities.length - 1),
            edges: [],
            description: `Sample ${t}: delay ${delay} ms (target ${target}), p=${probability.toFixed(3)}, packet ${dropped ? "dropped" : "forwarded"}.`,
            codeLineNumber: delay > target ? 3 : delay === 0 ? 5 : 7,
            layout: "array",
            meta: {
                probabilities: [...probabilities],
                delays: [...delays],
                drops: [...drops],
                target,
                finalProbability: probability,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, delays, drops, -1),
        edges: [],
        description: `PIE finished with p=${probability.toFixed(3)} and ${drops.reduce((a, b) => a + b, 0)} drop(s) over ${samples.length} sample(s).`,
        codeLineNumber: 8,
        layout: "array",
        meta: {
            probabilities: [...probabilities],
            delays: [...delays],
            drops: [...drops],
            target,
            finalProbability: probability,
            totalDrops: drops.reduce((a, b) => a + b, 0),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat queueing delay as the signal and steer the drop probability with a thermostat. The proportional term reacts to how far current delay is above the target; the integral term reacts to whether delay is rising or falling. When the link goes idle the probability is decayed so the controller recovers quickly.",
        invariants: [
            "The drop probability always stays between zero and one.",
            "lastDelay always holds the most recently measured delay.",
            "A packet is dropped exactly when its coin is below the current probability.",
        ],
        correctness:
            "When measured delay exceeds the target the proportional term is positive, raising p and shedding load; when delay is below target the term is negative, lowering p. The integral term adds damping based on the delay trend, preventing oscillation. Because updates are clamped to the unit interval, the controller converges toward the target delay under a stable traffic load.",
        complexityRationale:
            "Each sample requires a constant number of arithmetic operations and one frame, so time is linear in the sample count. Three arrays of length n hold the probabilities, delays and drops, giving linear space.",
        uses: [
            "Broadband router queue management in RFC 8033",
            "DOCSIS cable modem congestion control",
            "Data-center switches that need delay-based congestion signaling",
        ],
        references: [
            "RFC 8033, Proportional Integral Controller Enhanced (PIE)",
            "Pan, Park and Psounis, PIE: A Stateless AQM Scheme, 2013",
        ],
        workedExample:
            "With target 15 ms, alpha 0.01 and beta 0.1, a jump from 4 ms to 18 ms contributes 0.01 times 3 plus 0.1 times 14, pushing p upward. A later slide back to 4 ms contributes negative terms, pulling p down again. The probability therefore follows the delay trend rather than a fixed queue length.",
    },
    id: "pie-aqm",
    name: "PIE Active Queue Management",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        samples: [
            { delay: 2 }, { delay: 5 }, { delay: 10 }, { delay: 18 },
            { delay: 25 }, { delay: 30 }, { delay: 22 }, { delay: 12 },
            { delay: 4 }, { delay: 0 }, { delay: 0 }, { delay: 8 },
        ],
        alpha: 0.01,
        beta: 0.1,
        target: 15,
        idleDecay: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "set drop probability p to zero and last delay to target",
        "for each measured queue delay sample",
        "compute proportional term alpha times delay minus target",
        "compute integral term beta times delay minus last delay",
        "if delay is zero, decay p by the idle decay factor",
        "clamp p into the interval from zero to one",
        "set last delay to the measured delay",
        "drop the packet when a random coin is below p",
        "after all samples, report probabilities and total drops",
    ],
};

export default module;
