/**
 * renewal-process.ts - Renewal Process and Renewal Mass
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A renewal process places events at cumulative sums of independent positive
 * interarrival times. The epoch S_i is the time of the i-th renewal and the
 * counting function N(t) is the number of epochs not exceeding t. For a
 * discrete interarrival distribution f, the renewal mass u(t) is the
 * probability that a renewal occurs exactly at time t. It satisfies the
 * renewal equation u(0) = 1 and u(t) = sum_k f(k) u(t-k), which is evaluated
 * here by a forward convolution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for epochs and counts, O(T d) for mass up to time T with d delays
 *   Space: O(n + T) for epochs, counts, and the renewal-mass sequence
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero of the grid holds interarrival times and their cumulative epochs.
 *   - Row one holds the renewal mass u(t) for each discrete time.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Cumulative renewal epochs from a list of positive interarrival times. */
export function renewalEpochs(interarrivals: number[]): number[] {
    const epochs: number[] = [];
    let total = 0;
    for (const gap of interarrivals) {
        total += gap;
        epochs.push(total);
    }
    return epochs;
}

/** Counting function N(t): number of renewal epochs at or before t. */
export function countRenewals(epochs: number[], t: number): number {
    let count = 0;
    for (const epoch of epochs) {
        if (epoch <= t) {
            count += 1;
        }
    }
    return count;
}

/** Renewal mass u(t) by the discrete renewal equation, f indexed so f[k]=P(gap=k). */
export function renewalMass(pmf: number[], horizon: number): number[] {
    const u: number[] = new Array(horizon + 1).fill(0);
    u[0] = 1;
    for (let t = 1; t <= horizon; t += 1) {
        let sum = 0;
        for (let k = 1; k < pmf.length && k <= t; k += 1) {
            sum += (pmf[k] ?? 0) * (u[t - k] ?? 0);
        }
        u[t] = sum;
    }
    return u;
}

function makeCells(
    interarrivals: number[],
    epochs: number[],
    mass: number[],
    cols: number,
    activeRow: number,
    activeCol: number,
    done: boolean,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const gap = interarrivals[c];
            const epoch = epochs[c];
            const value = r === 0 ? (gap !== undefined ? gap : epoch !== undefined ? epoch : 0) : (mass[c] ?? 0);
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (r === activeRow && c === activeCol) {
                state = "comparing";
            } else if (r === 0 && c < activeCol) {
                state = "visited";
            }
            const label = r === 0
                ? gap !== undefined
                    ? `gap=${gap}`
                    : `S=${epoch ?? 0}`
                : `u=${value.toFixed(3)}`;
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, field: r === 0 ? "epoch" : "mass" },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { interarrivals?: number[]; pmf?: number[]; horizon?: number } | null) ?? {};
    const rawGaps = Array.isArray(task.interarrivals) && task.interarrivals.length > 0
        ? task.interarrivals
        : [1, 2, 1, 3, 2, 1];
    const interarrivals = rawGaps.map((v) => Math.max(1, Math.floor(Number(v) || 1)));
    const rawPmf = Array.isArray(task.pmf) && task.pmf.length > 1 ? task.pmf : [0, 0.5, 0.3, 0.2];
    const pmfSum = rawPmf.reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);
    const pmf = rawPmf.map((v) => (pmfSum > 0 ? Math.max(0, Number(v) || 0) / pmfSum : 0));
    const horizon = Math.max(1, Math.min(20, Math.floor(Number(task.horizon ?? 10) || 10)));
    const epochs = renewalEpochs(interarrivals);
    const mass = renewalMass(pmf, horizon);
    const cols = Math.max(interarrivals.length, horizon + 1);
    const counting: number[] = [];
    for (let t = 0; t <= (epochs[epochs.length - 1] ?? 0) + 2; t += 1) {
        counting.push(countRenewals(epochs, t));
    }
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(interarrivals, epochs, mass, cols, -1, -1, false),
        edges: [],
        description: `Renewal process with ${interarrivals.length} gaps; epochs ${epochs.join(", ")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols, epochs, counting, mass: [], horizon },
    };
    step += 1;

    for (let i = 0; i < epochs.length; i += 1) {
        const t = epochs[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeCells(interarrivals, epochs, mass, cols, 0, i, false),
            edges: [],
            description: `Renewal ${i + 1} occurs at time ${t}; N(${t}) = ${countRenewals(epochs, t)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 2, cols, epochs, counting, mass: [], horizon, renewal: i, time: t, count: countRenewals(epochs, t) },
        };
        step += 1;
    }

    for (let t = 0; t <= horizon; t += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(interarrivals, epochs, mass, cols, 1, t, false),
            edges: [],
            description: `Renewal equation: u(${t}) = ${(mass[t] ?? 0).toFixed(4)} from the interarrival distribution.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: 2, cols, epochs, counting, mass: mass.slice(0, t + 1), horizon, time: t, massValue: mass[t] ?? 0 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(interarrivals, epochs, mass, cols, -1, -1, true),
        edges: [],
        description: `${epochs.length} renewals by time ${epochs[epochs.length -1] ?? 0}; u(${horizon}) = ${(mass[horizon] ?? 0).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 2, cols, epochs, counting, mass, horizon, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A renewal process is a sequence of events whose gaps are drawn independently from the same distribution. Add the gaps to get event times, then count how many events have happened by any deadline. The renewal equation asks a subtler question: what is the chance that an event lands exactly at time t? That probability is built from the chance of an event at every earlier time multiplied by the right gap length.",
        invariants: [
            "Renewal epochs are strictly increasing cumulative sums of positive gaps.",
            "N(t) counts exactly those epochs less than or equal to t.",
            "The discrete renewal mass satisfies u(0) = 1 and u(t) = sum_k f(k) u(t-k).",
        ],
        correctness:
            "By induction the k-th epoch equals the sum of the first k gaps, so scanning epochs and testing epoch <= t counts precisely the renewals up to t. For the mass, a renewal at time t happens exactly when the previous renewal was at t-k and the next gap was k, and those events are independent; summing over k gives the renewal equation. Because every k is strictly less than t, evaluating u in increasing time order uses only already-computed values.",
        complexityRationale:
            "Computing n epochs and each count by a linear scan is O(n) per query, and the mass convolution touches at most d delays for each of T times, giving O(n + T d) time and O(n + T) space to store the displayed sequences.",
        uses: [
            "Modeling equipment failures and replacement schedules",
            "Insurance risk and cumulative claim arrivals",
            "Analyzing packet or customer arrival streams in queues",
        ],
        references: [
            "Ross, Stochastic Processes, Chapter 3",
            "Feller, An Introduction to Probability Theory and Its Applications, Volume I, Chapter XIII",
        ],
        workedExample:
            "With gaps 1, 2, 1, 3 the renewal epochs are 1, 3, 4, 7. At t = 4 we have N(4) = 3. If gaps of length 1, 2, 3 occur with probabilities 0.5, 0.3, 0.2, then u(1) = 0.5, u(2) = 0.3 + 0.25 = 0.55, and u(3) = 0.2 + 0.15 + 0.125 = 0.475.",
    },
    id: "renewal-process",
    name: "Renewal Process",
    category: "statistics-probability",
    complexity: { time: "O(n + T d)", space: "O(n + T)" },
    defaultInput: { interarrivals: [1, 2, 1, 3, 2, 1], pmf: [0, 0.5, 0.3, 0.2], horizon: 10 },
    visualType: "grid",
    run,
    pseudocode: [
        "accumulate the interarrival gaps into renewal epochs",
        "for each epoch report its time and the running count",
        "set the renewal mass at time zero to one",
        "for each later time sum f of k times u of t minus k",
        "store the renewal mass for that time",
        "report epochs, the counting function, and the full mass sequence",
    ],
};

export default module;
