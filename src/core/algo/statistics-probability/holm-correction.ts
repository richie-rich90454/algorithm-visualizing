/**
 * holm-correction.ts - Holm Step-Down Multiple Testing Correction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When many hypotheses are tested at once, comparing each raw p value with a
 * single alpha produces too many false positives. Holm's step-down procedure
 * sorts the p values, then walks from the smallest upward comparing the i-th
 * sorted value with alpha divided by (m - i + 1). It stops at the first value
 * that fails, and rejects every smaller hypothesis. It is uniformly more
 * powerful than the Bonferroni correction while still controlling the family
 * wise error rate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m log m) for m p values (dominated by sorting)
 *   Space: O(m) for the sorted order and adjusted p values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per hypothesis shows its raw p value.
 *   - The current sorted position is highlighted while it is tested.
 *   - The final frame marks rejected hypotheses green and retained ones red.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Hypothesis {
    index: number;
    p: number;
}

/** Build one bar per hypothesis in its original order. */
function makeBars(
    pValues: number[],
    order: number[],
    current: number,
    rejected: Set<number>,
    done: boolean,
): VisualEntity[] {
    return pValues.map((p, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = rejected.has(index) ? "sorted" : "error";
        } else if (order[current] === index) {
            state = "comparing";
        } else if (rejected.has(index)) {
            state = "visited";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `H${index + 1}:${p.toFixed(3)}`,
            value: p,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, p, rank: order.indexOf(index) },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pValues?: number[]; alpha?: number } | null) ?? {};
    const raw = Array.isArray(task.pValues)
        ? task.pValues.map((p) => Number(p)).filter((p) => Number.isFinite(p) && p >= 0 && p <= 1)
        : [];
    const pValues = raw.length > 0 ? raw : [0.01, 0.04, 0.03, 0.2, 0.005];
    const alpha = typeof task.alpha === "number" && Number.isFinite(task.alpha)
        ? Math.min(1, Math.max(0, task.alpha))
        : 0.05;
    const m = pValues.length;

    const order = pValues
        .map((p, index): Hypothesis => ({ index, p }))
        .sort((a, b) => a.p - b.p || a.index - b.index)
        .map((h) => h.index);

    // Holm adjusted p values: running maximum of (m - rank) * p, capped at one.
    const adjusted = new Array<number>(m).fill(0);
    let running = 0;
    const rejected = new Set<number>();
    let stopRank = m;
    for (let rank = 0; rank < m; rank += 1) {
        const idx = order[rank] as number;
        running = Math.max(running, (m - rank) * (pValues[idx] as number));
        adjusted[idx] = Math.min(1, running);
    }

    // Step down: reject until the first raw p value above its threshold.
    for (let rank = 0; rank < m; rank += 1) {
        const idx = order[rank] as number;
        const threshold = alpha / (m - rank);
        if ((pValues[idx] as number) > threshold) {
            stopRank = rank;
            break;
        }
        rejected.add(idx);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(pValues, order, -1, rejected, false),
        edges: [],
        description: `Testing ${m} hypotheses with Holm's step-down procedure at alpha ${alpha}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { m, alpha, phase: "setup", pValues, order, rejectedCount: 0 },
    };
    step += 1;

    for (let rank = 0; rank < m; rank += 1) {
        const idx = order[rank] as number;
        const p = pValues[idx] as number;
        const threshold = alpha / (m - rank);
        const passes = p <= threshold;
        yield {
            stepNumber: step,
            entities: makeBars(pValues, order, rank, rejected, false),
            edges: [],
            description: `Sorted position ${rank + 1}: H${idx + 1} has p ${p.toFixed(4)} versus threshold ${threshold.toFixed(4)}; ${passes ? "reject" : "stop, retain the rest"}.`,
            codeLineNumber: passes ? 2 : 3,
            layout: "array",
            meta: {
                m,
                alpha,
                phase: "test",
                rank,
                hypothesis: idx,
                p,
                threshold,
                passes,
                adjP: adjusted[idx],
                rejectedCount: rejected.size,
            },
        };
        step += 1;
        if (!passes) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(pValues, order, -1, rejected, true),
        edges: [],
        description: `Rejected ${rejected.size} of ${m} hypotheses while controlling the family wise error rate at ${alpha}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            m,
            alpha,
            phase: "done",
            order,
            rejected: [...rejected].sort((a, b) => a - b),
            rejectedCount: rejected.size,
            adjustedPValues: adjusted,
            stopRank,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Testing many hypotheses at one fixed threshold makes false positives likely. Holm's method first orders the evidence from strongest to weakest, then uses a slightly stricter threshold for the strongest test and relaxes it step by step. As soon as one test fails, every weaker one is retained, which keeps the overall false-positive risk bounded without being as conservative as plain Bonferroni.",
        invariants: [
            "The sorted order is nondecreasing in the raw p values.",
            "Each threshold alpha/(m - rank) is at least alpha/m and at most alpha.",
            "Once a hypothesis is retained, all larger p values in the order are retained too.",
        ],
        correctness:
            "The step-down rule rejects H(rank) only if every earlier, smaller p value also passed its own threshold, so the event of any false rejection is contained in the event that some true hypothesis has p value at most alpha/(m - rank) among the ranked true hypotheses. Bonferroni reasoning on that largest rank bounds this probability by alpha, giving family wise error control. Because alpha/(m - rank) is larger than alpha/m for rank greater than zero, every Bonferroni rejection is also a Holm rejection, so the procedure is uniformly more powerful.",
        complexityRationale:
            "Sorting the m p values costs O(m log m), and the single step-down pass plus the running-maximum computation for adjusted values each cost O(m). Only the sorted order, a running maximum, and one adjusted value per hypothesis are stored, giving O(m) space.",
        uses: [
            "Post hoc comparisons after an analysis of variance",
            "Genomics and other high dimensional multiple testing",
            "A/B test families where several metrics are checked at once",
        ],
        references: [
            "Holm, A Simple Sequentially Rejective Multiple Test Procedure, Scandinavian Journal of Statistics, 1979",
            "Benjamini and Hochberg, Controlling the False Discovery Rate, 1995 (comparison)",
        ],
        workedExample:
            "With p values 0.01, 0.04, 0.03, 0.20, 0.005 and alpha 0.05, the sorted order is 0.005, 0.01, 0.03, 0.04, 0.20. The thresholds are 0.010, 0.0125, 0.0167, 0.025, 0.05. The first four pass and the fifth fails, so four hypotheses are rejected, whereas Bonferroni with threshold 0.010 would reject only two.",
    },
    id: "holm-correction",
    name: "Holm Step-Down Correction",
    category: "statistics-probability",
    complexity: { time: "O(m log m)", space: "O(m)" },
    defaultInput: { pValues: [0.01, 0.04, 0.03, 0.2, 0.005], alpha: 0.05 },
    visualType: "array",
    run,
    pseudocode: [
        "sort the m p values in ascending order",
        "set an adjusted maximum to zero",
        "for rank from zero to m - 1 compare p with alpha over (m - rank)",
        "stop at the first p above its threshold and retain the rest",
        "reject every hypothesis before the stopping rank",
        "report the rejected set and adjusted p values",
    ],
};

export default module;
