/**
 * cox-proportional-hazards.ts - Cox Proportional Hazards Model
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cox regression estimates how a covariate scales the hazard of an event. It
 * maximizes the partial likelihood: at each observed event time, the subject
 * who failed is compared with the risk set still alive at that time. Newton-
 * Raphson updates the coefficient using the partial-likelihood score and
 * information, with Breslow's correction for tied event times.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) with n subjects in the worst case
 *   Space: O(n) for the risk set and derived sums
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each subject is a node placed at (survival time, covariate value).
 *   - Subjects who experienced the event are green; censored ones are gray.
 *   - The coefficient and partial log-likelihood are reported per iteration.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Subject {
    time: number;
    event: number;
    x: number;
}

/** Build subject nodes, marking events versus censored observations. */
function makeNodes(subjects: Subject[]): VisualEntity[] {
    return subjects.map((subject, index) => ({
        id: `subject-${index}`,
        type: "node" as const,
        label: `${subject.event === 1 ? "E" : "C"}:x=${subject.x}`,
        value: subject.x,
        state: subject.event === 1 ? ("sorted" as EntityState) : ("unvisited" as EntityState),
        x: subject.time,
        y: subject.x,
        width: 0,
        height: 0,
        metadata: { index, time: subject.time, event: subject.event, covariate: subject.x },
    }));
}

/** Score, information, and partial log-likelihood at a given coefficient. */
function evaluate(subjects: Subject[], beta: number): { score: number; info: number; logLik: number } {
    const times = [...new Set(subjects.map((s) => s.time))].sort((a, b) => a - b);
    let score = 0;
    let info = 0;
    let logLik = 0;
    for (const time of times) {
        const risk = subjects.filter((s) => s.time >= time);
        const failures = subjects.filter((s) => s.time === time && s.event === 1);
        if (failures.length === 0) continue;
        let s0 = 0;
        let s1 = 0;
        let s2 = 0;
        for (const r of risk) {
            const w = Math.exp(beta * r.x);
            s0 += w;
            s1 += r.x * w;
            s2 += r.x * r.x * w;
        }
        const mean = s1 / s0;
        score += failures.reduce((sum, f) => sum + f.x, 0) - failures.length * mean;
        info += failures.length * (s2 / s0 - mean * mean);
        logLik += failures.reduce((sum, f) => sum + beta * f.x, 0) - failures.length * Math.log(s0);
    }
    return { score, info, logLik };
}

/** The Cox proportional hazards generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { subjects?: Subject[]; maxIterations?: number; tol?: number } | null) ?? {};
    const subjects: Subject[] = Array.isArray(task.subjects) && task.subjects.length > 0
        ? task.subjects.map((s) => ({ time: Number(s.time), event: Number(s.event), x: Number(s.x) }))
        : [
              { time: 1, event: 1, x: 0 },
              { time: 2, event: 1, x: 1 },
              { time: 3, event: 0, x: 0 },
              { time: 4, event: 1, x: 1 },
              { time: 5, event: 1, x: 1 },
              { time: 6, event: 0, x: 0 },
              { time: 7, event: 1, x: 0 },
          ];
    const maxIterations = typeof task.maxIterations === "number" ? Math.max(1, Math.floor(task.maxIterations)) : 25;
    const tol = typeof task.tol === "number" && task.tol > 0 ? task.tol : 1e-9;

    let beta = 0;
    let current = evaluate(subjects, beta);
    let converged = false;

    yield {
        stepNumber: 0,
        entities: makeNodes(subjects),
        edges: [],
        description: `Cox partial likelihood over ${subjects.length} subjects; start with coefficient beta = 0.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { beta: 0, logLik: current.logLik, score: current.score, iteration: 0, converged: false },
    };
    let step = 1;

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
        if (Math.abs(current.score) < tol || current.info <= 0) {
            converged = Math.abs(current.score) < tol;
            break;
        }
        const update = current.score / current.info;
        beta += update;
        current = evaluate(subjects, beta);
        yield {
            stepNumber: step,
            entities: makeNodes(subjects),
            edges: [],
            description: `Iteration ${iteration}: score ${current.score.toFixed(6)}, information positive; update beta to ${beta.toFixed(6)} with log-likelihood ${current.logLik.toFixed(6)}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: { beta, logLik: current.logLik, score: current.score, iteration, converged: Math.abs(current.score) < tol },
        };
        step += 1;
        if (Math.abs(current.score) < tol) {
            converged = true;
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeNodes(subjects),
        edges: [],
        description: converged
            ? `Converged: beta ${beta.toFixed(6)} (hazard ratio ${Math.exp(beta).toFixed(4)}), partial log-likelihood ${current.logLik.toFixed(6)}.`
            : `Stopped after ${maxIterations} iterations without convergence; beta ${beta.toFixed(6)}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { beta, logLik: current.logLik, score: current.score, iteration: step - 1, converged, hazardRatio: Math.exp(beta) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Cox regression asks how a covariate changes the risk of an event without assuming a shape for the underlying survival curve. At each moment someone fails, compare them with everyone still at risk; a covariate that raises the hazard will show up in more failures among higher-valued subjects. The partial likelihood drops the unknown baseline hazard, leaving a clean objective for the coefficient.",
        invariants: [
            "The risk set at time t is every subject with survival time at least t.",
            "The score is the summed failure covariates minus the risk-set weighted mean.",
            "A positive coefficient means a larger covariate raises the hazard.",
        ],
        correctness:
            "The Cox partial likelihood conditions on the event times, so the baseline hazard cancels and the coefficient is estimated without specifying it. Its score is the derivative of that likelihood and its information is the negative second derivative. Newton-Raphson follows these to the maximum; because the partial likelihood is concave in a single coefficient, the root of the score is the unique maximizer.",
        complexityRationale:
            "Each iteration visits every distinct event time and scans the risk set, costing O(n^2) in the worst case per step. Only the subject list and a few sums are stored, so space is O(n).",
        uses: [
            "Estimating treatment effects on time-to-event outcomes in clinical trials",
            "Modeling customer churn or equipment failure as a function of features",
            "Adjusting survival comparisons for covariates in epidemiology",
        ],
        references: [
            "Cox, Regression Models and Life-Tables, Journal of the Royal Statistical Society, 1972",
            "Breslow, Covariance Analysis of Censored Survival Data, 1974",
        ],
        workedExample:
            "With one binary covariate, if failures cluster among subjects whose covariate is one while the risk set still contains many zeros, the score at beta zero is positive and Newton raises beta. The fitted hazard ratio exp(beta) then quantifies how much more quickly the exposed group fails.",
    },
    id: "cox-proportional-hazards",
    name: "Cox Proportional Hazards",
    category: "statistics-probability",
    complexity: { time: "O(iterations * n^2)", space: "O(n)" },
    defaultInput: {
        subjects: [
            { time: 1, event: 1, x: 0 },
            { time: 2, event: 1, x: 1 },
            { time: 3, event: 0, x: 0 },
            { time: 4, event: 1, x: 1 },
            { time: 5, event: 1, x: 1 },
            { time: 6, event: 0, x: 0 },
            { time: 7, event: 1, x: 0 },
        ],
        maxIterations: 25,
        tol: 1e-9,
    },
    visualType: "point",
    run,
    pseudocode: [
        "set the coefficient beta to zero",
        "at each event time form the set of subjects still at risk",
        "accumulate the partial-likelihood score and information",
        "update beta by score divided by information",
        "repeat until the score is near zero",
        "done: report beta, its hazard ratio, and partial log-likelihood",
    ],
};

export default module;
