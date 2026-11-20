/**
 * variational-inference-elbo.ts - Mean-Field Variational Inference and the ELBO
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Variational inference replaces an intractable posterior with a tractable
 * approximation q by maximizing the evidence lower bound (ELBO). For a bivariate
 * normal target with correlation rho, the mean-field family is the product of
 * two normals. Coordinate-ascent variational inference (CAVI) updates each
 * factor in turn to the exact conditional of that coordinate, which for a
 * normal target has a closed form. Every update is guaranteed not to decrease
 * the ELBO, so the factors converge to the best factorized approximation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations) closed-form updates (constant work per update)
 *   Space: O(1) for the variational parameters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes trace (iteration, ELBO) so the monotone ascent is visible.
 *   - The final node is GREEN; earlier ones are GRAY.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Params {
    m1: number;
    m2: number;
    s1: number;
    s2: number;
}

/** Build the ELBO trace nodes recorded so far. */
function makeNodes(values: number[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `elbo-${index}`,
        type: "node" as const,
        label: value.toFixed(3),
        value,
        state: (index === values.length - 1 ? "sorted" : "unvisited") as EntityState,
        x: index,
        y: value,
        width: 0,
        height: 0,
        metadata: { iteration: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { rho?: number; mean?: [number, number]; iterations?: number } | null) ?? {};
    const rawRho = typeof task.rho === "number" ? task.rho : 0.8;
    const rho = Math.max(-0.99, Math.min(0.99, rawRho));
    const mean = task.mean ?? [1.5, -0.5];
    const mu1 = mean[0] ?? 0;
    const mu2 = mean[1] ?? 0;
    const iterations =
        typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 12;

    // Precision matrix of Sigma = [[1, rho], [rho, 1]].
    const det = 1 - rho * rho;
    const l11 = 1 / det;
    const l12 = -rho / det;

    const params: Params = { m1: 0, m2: 0, s1: 1, s2: 1 };

    /** Exact ELBO of the current factorized Gaussian under the target. */
    const elbo = (p: Params): number => {
        const d1 = p.m1 - mu1;
        const d2 = p.m2 - mu2;
        const trace = l11 * (p.s1 + d1 * d1) + 2 * l12 * d1 * d2 + l11 * (p.s2 + d2 * d2);
        return -0.5 * Math.log(det) - 0.5 * trace + 1 + 0.5 * (Math.log(p.s1) + Math.log(p.s2));
    };

    const values: number[] = [elbo(params)];
    yield {
        stepNumber: 0,
        entities: makeNodes(values),
        edges: [],
        description: `Initializing mean-field q with m=(0, 0) and unit variances; ELBO ${values[0]?.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {
            iteration: 0,
            m1: params.m1,
            m2: params.m2,
            s1: params.s1,
            s2: params.s2,
            elbo: values[0],
        },
    };

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        // CAVI: each factor becomes the exact conditional of its coordinate.
        params.m1 = mu1 - (l12 / l11) * (params.m2 - mu2);
        params.s1 = 1 / l11;
        params.m2 = mu2 - (l12 / l11) * (params.m1 - mu1);
        params.s2 = 1 / l11;
        values.push(elbo(params));

        yield {
            stepNumber: iteration,
            entities: makeNodes(values),
            edges: [],
            description: `CAVI pass ${iteration}: updated q1 mean to ${params.m1.toFixed(3)}, ELBO now ${values[iteration]?.toFixed(4)}.`,
            codeLineNumber: iteration % 2 === 1 ? 3 : 5,
            layout: "point",
            meta: {
                iteration,
                m1: params.m1,
                m2: params.m2,
                s1: params.s1,
                s2: params.s2,
                elbo: values[iteration],
            },
        };
    }

    yield {
        stepNumber: iterations + 1,
        entities: makeNodes(values),
        edges: [],
        description: `Converged near m=(${params.m1.toFixed(3)}, ${params.m2.toFixed(3)}); final ELBO ${values[values.length - 1]?.toFixed(4)}.`,
        codeLineNumber: 8,
        layout: "point",
        meta: {
            iteration: iterations + 1,
            m1: params.m1,
            m2: params.m2,
            s1: params.s1,
            s2: params.s2,
            elbo: values[values.length - 1],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When the exact posterior is too complicated to work with, pick a simpler family of distributions and find the member closest to the posterior. Closeness is measured by the ELBO, a lower bound on the log evidence. Mean-field variational inference assumes the coordinates are independent, then optimizes one factor at a time while holding the others fixed.",
        invariants: [
            "The approximation factorizes into one independent normal per coordinate.",
            "Each CAVI update sets a factor to the exact conditional given the others.",
            "The ELBO never decreases after a coordinate update.",
        ],
        correctness:
            "Coordinate ascent on the ELBO is exact for the conjugate exponential family: updating one factor to the conditional q*(z_j) proportional to exp of the expected complete log joint maximizes the ELBO with respect to that factor. For a multivariate normal target the conditional of a coordinate given the rest is normal with mean mu_j minus the standardized precision-weighted deviation of the others and variance one over the diagonal precision. Repeating these monotone updates converges to the stationary point, which is the best factorized approximation.",
        complexityRationale:
            "Each factor update is a handful of arithmetic operations with the precision entries, so one sweep is constant time and the whole run is O(iterations). Only the four variational parameters and the scalar ELBO are stored, giving O(1) space.",
        uses: [
            "Approximate Bayesian inference for large or intractable posteriors",
            "Latent-variable models such as variational autoencoders",
            "Fast alternatives to Markov chain Monte Carlo when speed matters more than exactness",
        ],
        references: [
            "Jordan, Ghahramani, Jaakkola and Saul, An Introduction to Variational Methods for Graphical Models, 1999",
            "Murphy, Machine Learning: A Probabilistic Perspective, chapter 21",
        ],
        workedExample:
            "For a target with mean (1.5, -0.5) and correlation 0.8, the precision diagonal is about 2.78, so each optimal factor variance is about 0.36. Starting from m=(0, 0), the first update sets m1 to about 0.1 using the current m2, then m2 to about -1.3 using the new m1. The iterates converge to (1.5, -0.5) and the ELBO rises to 0.5 times the log of 1 minus rho squared.",
    },
    id: "variational-inference-elbo",
    name: "Variational Inference (ELBO)",
    category: "statistics-probability",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { rho: 0.8, mean: [1.5, -0.5], iterations: 12 },
    visualType: "point",
    run,
    pseudocode: [
        "choose a factorized Gaussian approximation q",
        "compute the target precision matrix",
        "for each coordinate-ascent pass",
        "update q1 to the conditional of coordinate one",
        "recompute the evidence lower bound",
        "update q2 to the conditional of coordinate two",
        "recompute the evidence lower bound",
        "repeat until the bound stops increasing",
        "done: report the fitted factors and final ELBO",
    ],
};

export default module;
