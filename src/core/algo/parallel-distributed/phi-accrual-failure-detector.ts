/**
 * phi-accrual-failure-detector.ts - Phi-Accrual Failure Detector (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A phi-accrual failure detector does not give a binary "up or down" answer.
 * It keeps a sliding window of recent heartbeat inter-arrival times, estimates
 * their mean and variance, and for a current pause t reports phi = -log10 of
 * the probability that a healthy process would pause longer than t. A large
 * phi means suspicion is high: phi = 8 means there is only a one-in-ten-million
 * chance a correct process would be this late. Applications choose their own
 * threshold, so the same detector serves both fast and cautious systems.
 *
 * This is a deterministic teaching simulation with integer-scaled jitter. It
 * uses a normal distribution and an erf approximation; production detectors
 * may use different distributions or online estimation. Only the accrual
 * formula and the sliding-window statistics are faithful.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(w) per observation for a window of w samples
 *   Space: O(w) for the window
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each probe tick is a cell; green means a heartbeat arrived, red a miss.
 *   - phi value drives the color of the suspect bar: idle, comparing, or error.
 *   - meta carries the window, mean, variance, phi, and suspicion verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Abramowitz-Stegun 7.1.26 complementary error function, stable in the tail. */
export function erfc(x: number): number {
    const a = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * a);
    const y = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
    return x < 0 ? 2 - y : y;
}

/** Abramowitz-Stegun approximation of the error function. */
export function erf(x: number): number {
    return 1 - erfc(x);
}

/** Probability that a normal sample with the given mean and sd exceeds x. */
function tailProbability(x: number, mean: number, sd: number): number {
    if (sd <= 1e-12) {
        return x <= mean ? 1 : 1e-300;
    }
    const z = (x - mean) / (Math.sqrt(2) * sd);
    return Math.max(0.5 * erfc(z), 1e-300);
}

/** Phi accrual for an elapsed pause t given a window of inter-arrival times. */
export function computePhi(elapsed: number, window: number[]): number {
    if (window.length === 0) {
        return 0;
    }
    const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
    const variance = window.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / window.length;
    const sd = Math.sqrt(variance);
    const probability = tailProbability(elapsed, mean, sd);
    if (probability <= 0) {
        return Number.MAX_SAFE_INTEGER;
    }
    return -Math.log10(probability);
}

export interface PhiSample {
    tick: number;
    heartbeat: boolean;
    elapsed: number;
    mean: number;
    sd: number;
    phi: number;
    suspected: boolean;
}

/** Deterministic heartbeat trace with jitter and an optional crash at a tick. */
export function simulatePhi(
    ticks: number,
    interval: number,
    jitter: number,
    threshold: number,
    windowSize: number,
    crashAt: number,
    seed: number,
): PhiSample[] {
    let state = seed >>> 0;
    const random = (): number => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
    const samples: PhiSample[] = [];
    const window: number[] = [];
    let lastHeartbeat = 0;
    let lastActualArrival = 0;

    for (let tick = 1; tick <= ticks; tick += 1) {
        const heartbeat = tick >= crashAt ? false : Math.abs(random() - 0.5) * 2 * jitter < 0.5;
        let elapsed = tick - lastHeartbeat;
        if (heartbeat) {
            const gap = tick - lastActualArrival;
            window.push(gap);
            if (window.length > windowSize) {
                window.shift();
            }
            lastActualArrival = tick;
            lastHeartbeat = tick;
            elapsed = 0;
        }
        const mean = window.length > 0 ? window.reduce((sum, value) => sum + value, 0) / window.length : 0;
        const variance = window.length > 0 ? window.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / window.length : 0;
        const phi = computePhi(elapsed, window);
        samples.push({
            tick,
            heartbeat,
            elapsed,
            mean,
            sd: Math.sqrt(variance),
            phi,
            suspected: phi >= threshold,
        });
    }
    return samples;
}

/** Build tick cells for one frame. */
function makeCells(samples: PhiSample[], visible: number): VisualEntity[] {
    return samples.map((sample) => {
        const shown = sample.tick <= visible;
        let state: EntityState = "unvisited";
        if (shown) {
            state = sample.heartbeat ? "sorted" : sample.suspected ? "error" : "comparing";
        }
        return {
            id: `tick-${sample.tick}`,
            type: "cell" as const,
            label: shown
                ? `t${sample.tick} ${sample.heartbeat ? "HB" : "miss"} phi=${Number.isFinite(sample.phi) ? sample.phi.toFixed(1) : "MAX"}`
                : `t${sample.tick} ?`,
            value: sample.tick,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                row: 0,
                col: sample.tick - 1,
                tick: sample.tick,
                heartbeat: sample.heartbeat,
                elapsed: sample.elapsed,
                phi: sample.phi,
                suspected: sample.suspected,
            },
        };
    });
}

/** The phi-accrual generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        ticks?: number;
        interval?: number;
        jitter?: number;
        threshold?: number;
        windowSize?: number;
        crashAt?: number;
        seed?: number;
    } | null) ?? {};
    const ticks = Math.min(80, Math.max(2, Math.floor(Number(task.ticks ?? 20)) || 20));
    const interval = Math.max(1, Math.floor(Number(task.interval ?? 5)) || 5);
    const jitter = Math.max(0, Math.min(interval - 1, Math.floor(Number(task.jitter ?? 1)) || 1));
    const threshold = Math.max(1, Number(task.threshold ?? 8));
    const windowSize = Math.max(2, Math.floor(Number(task.windowSize ?? 10)) || 10);
    const crashAt = Math.max(1, Math.min(ticks + 1, Math.floor(Number(task.crashAt ?? ticks + 1)) || ticks + 1));
    const seed = Math.floor(Number(task.seed ?? 42)) || 42;
    const samples = simulatePhi(ticks, interval, jitter, threshold, windowSize, crashAt, seed);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeCells(samples, 0),
        edges: [],
        description: `Phi-accrual detector: ${ticks} probe ticks, threshold phi ${threshold}, window ${windowSize}, crash at tick ${crashAt >= ticks + 1 ? "none" : crashAt}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: ticks, ticks, threshold, windowSize, interval, phi: 0, suspected: false, verdict: "monitoring" },
    };

    for (const sample of samples) {
        yield {
            stepNumber: step++,
            entities: makeCells(samples, sample.tick),
            edges: [],
            description: `Tick ${sample.tick}: ${sample.heartbeat ? "heartbeat arrived; window mean ${sample.mean.toFixed(2)}" : "no heartbeat; elapsed ${sample.elapsed}"}; phi ${Number.isFinite(sample.phi) ? sample.phi.toFixed(2) : "MAX"}${sample.suspected ? " - SUSPECT" : " - trust"}.`,
            codeLineNumber: sample.heartbeat ? 2 : sample.suspected ? 6 : 4,
            layout: "grid",
            meta: {
                rows: 1,
                cols: ticks,
                ticks,
                threshold,
                windowSize,
                interval,
                tick: sample.tick,
                heartbeat: sample.heartbeat,
                elapsed: sample.elapsed,
                mean: sample.mean,
                sd: sample.sd,
                phi: sample.phi,
                suspected: sample.suspected,
                verdict: sample.suspected ? "suspect" : "trust",
            },
        };
    }

    const firstSuspect = samples.find((sample) => sample.suspected);
    yield {
        stepNumber: step,
        entities: makeCells(samples, ticks),
        edges: [],
        description: firstSuspect
            ? `First suspicion at tick ${firstSuspect.tick}, ${firstSuspect.tick - crashAt} tick(s) after the last heartbeat; threshold phi ${threshold}.`
            : `No suspicion: phi stayed below ${threshold} over ${ticks} ticks.`,
        codeLineNumber: 8,
        layout: "grid",
        meta: {
            rows: 1,
            cols: ticks,
            ticks,
            threshold,
            windowSize,
            interval,
            phi: samples[samples.length - 1]?.phi ?? 0,
            suspected: samples[samples.length - 1]?.suspected ?? false,
            firstSuspectTick: firstSuspect?.tick ?? -1,
            detectionLatency: firstSuspect ? firstSuspect.tick - crashAt : -1,
            verdict: firstSuspect ? "suspected" : "trusted",
            note: "teaching model: normal distribution with erf approximation",
        },
    };
}

/** The phi-accrual failure detector module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of declaring a process dead after a fixed timeout, watch how late its heartbeats usually are and measure how unusual the current delay is. The detector reports phi, a logarithmic suspicion level that grows the longer a heartbeat is missing. Applications pick their own phi threshold, so one detector can serve both impatient and patient services.",
        invariants: [
            "The sliding window holds only the most recent w inter-arrival times.",
            "A heartbeat resets the elapsed pause to zero and adds one sample to the window.",
            "Phi is zero at the moment a heartbeat arrives and increases monotonically as the pause grows.",
        ],
        correctness:
            "Phi is defined as minus the base-ten logarithm of the tail probability of the normal distribution fitted to the window. A longer pause has a smaller tail probability and therefore a larger phi, so suspicion accrues monotonically. A threshold phi equals a chosen false-positive rate: phi = 8 means the chance a healthy process is this late is about ten to the minus eight, so crossing it is strong evidence of failure. The sliding window adapts the mean and variance to current network conditions.",
        complexityRationale:
            "Each observation sums and sums-squared the window of w samples to estimate mean and variance, then evaluates one erf approximation, so the work is O(w) per tick and O(w) space for the window.",
        uses: [
            "Failure detection in distributed systems such as Cassandra and Akka",
            "Tuning detection speed against false-positive rate with a single knob",
            "Adjusting to variable network latency without fixed timeouts",
        ],
        references: [
            "Hayashibara, Betoulaize, and Katayama, The Phi Accrual Failure Detector, 2004",
            "Hayashibara et al., A Failure Detector for Large-Scale Systems, 2011",
        ],
        workedExample:
            "With inter-arrival times around five ticks and a small variance, a heartbeat arriving on time gives phi zero. If the monitored process crashes, each subsequent tick increases elapsed time; once the normal tail probability drops below ten to the minus eight, phi reaches eight and the detector suspects. With a typical window the first suspicion appears several ticks after the last heartbeat.",
    },
    id: "phi-accrual-failure-detector",
    name: "Phi-Accrual Failure Detector",
    category: "parallel-distributed",
    complexity: { time: "O(w) per tick", space: "O(w)" },
    defaultInput: { ticks: 20, interval: 5, jitter: 1, threshold: 8, windowSize: 10, crashAt: 8, seed: 42 },
    visualType: "grid",
    run,
    pseudocode: [
        "seed the window with recent heartbeat inter-arrival times",
        "on each tick record whether a heartbeat arrived",
        "if it did, append the gap and evict the oldest sample",
        "otherwise increase the time since the last heartbeat",
        "estimate the mean and variance of the window",
        "compute the normal tail probability of the current pause",
        "set phi to minus log base ten of that probability",
        "suspect when phi reaches the application threshold",
        "done: report the first suspicion tick and latency",
    ],
};

export default module;
