/**
 * kent-distribution.ts - Kent (5-parameter Fisher-Bingham) Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Kent distribution is a probability distribution on the unit sphere. It
 * concentrates around a mean direction through a concentration parameter kappa
 * and stretches or flattens the concentration in an orthogonal shape direction
 * through a shape parameter beta. This module evaluates its log density and
 * approximates its normalizing constant by quadrature over the sphere, then
 * replays the density along a meridian through the mean direction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(uSteps * phiSteps + samples)
 *   Space: O(samples) for the displayed profile
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each sample direction is a node placed at its projection on the xy plane.
 *   - The highlighted node is the direction whose density is being evaluated.
 *   - The final frame marks every direction with its density value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec3 = [number, number, number];

interface KentInput {
    meanTheta?: number;
    meanPhi?: number;
    kappa?: number;
    beta?: number;
    steps?: number;
}

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Orthonormal basis: mean direction, shape direction, and their cross product. */
export function kentBasis(theta: number, phi: number): [Vec3, Vec3, Vec3] {
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const mu1: Vec3 = [st * cp, st * sp, ct];
    const mu2: Vec3 = [ct * cp, ct * sp, -st];
    const mu3: Vec3 = [-sp, cp, 0];
    return [mu1, mu2, mu3];
}

/** Direction on the sphere from cosine of the polar angle and azimuth. */
function direction(u: number, phi: number): Vec3 {
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    return [r * Math.cos(phi), r * Math.sin(phi), u];
}

/** Log of the unnormalized density at a unit direction. */
export function kentLogDensity(
    x: Vec3,
    kappa: number,
    beta: number,
    basis: [Vec3, Vec3, Vec3],
): number {
    const a = dot(x, basis[0]);
    const b = dot(x, basis[1]);
    const c = dot(x, basis[2]);
    return kappa * a + beta * (b * b - c * c);
}

/** Normalizing constant by the midpoint rule in cos(theta) and trapezoid in phi. */
export function kentNormalizer(
    kappa: number,
    beta: number,
    basis: [Vec3, Vec3, Vec3],
    uSteps = 48,
    phiSteps = 96,
): number {
    const du = 2 / uSteps;
    const dphi = (2 * Math.PI) / phiSteps;
    let total = 0;
    for (let i = 0; i < uSteps; i += 1) {
        const u = -1 + (i + 0.5) * du;
        for (let j = 0; j < phiSteps; j += 1) {
            const phi = j * dphi;
            total += Math.exp(kentLogDensity(direction(u, phi), kappa, beta, basis));
        }
    }
    return total * du * dphi;
}

/** Build the meridian nodes projected to the xy plane. */
function makeNodes(
    thetas: number[],
    phi: number,
    densities: number[],
    states: Map<number, EntityState>,
): VisualEntity[] {
    return thetas.map((theta, i) => {
        const x = Math.sin(theta) * Math.cos(phi);
        const y = Math.sin(theta) * Math.sin(phi);
        return {
            id: `dir-${i}`,
            type: "node" as const,
            label: `${((theta * 180) / Math.PI).toFixed(0)} deg`,
            value: densities[i] ?? 0,
            state: states.get(i) ?? "unvisited",
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i, theta, density: densities[i] ?? 0 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as KentInput | null) ?? {};
    const meanTheta = typeof task.meanTheta === "number" ? task.meanTheta : 0.9;
    const meanPhi = typeof task.meanPhi === "number" ? task.meanPhi : 0.6;
    const kappa = typeof task.kappa === "number" ? task.kappa : 4;
    const beta = typeof task.beta === "number" ? task.beta : 1;
    const steps = Math.max(2, typeof task.steps === "number" ? Math.floor(task.steps) : 20);

    const basis = kentBasis(meanTheta, meanPhi);
    const normalizer = kentNormalizer(kappa, beta, basis);
    const thetas: number[] = [];
    const densities: number[] = [];
    for (let i = 0; i < steps; i += 1) {
        const theta = (Math.PI * i) / (steps - 1);
        const x = direction(Math.cos(theta), meanPhi);
        const logDensity = kentLogDensity(x, kappa, beta, basis);
        thetas.push(theta);
        densities.push(Math.exp(logDensity) / normalizer);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeNodes(thetas, meanPhi, densities, new Map()),
        edges: [],
        description: `Kent density: kappa ${kappa}, beta ${beta}, ${steps} directions along the mean meridian.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {
            kappa,
            beta,
            normalizer,
            samples: thetas.map((theta, i) => [theta, densities[i] ?? 0]),
        },
    };
    step += 1;

    for (let i = 0; i < steps; i += 1) {
        const states = new Map<number, EntityState>([[i, "active"]]);
        yield {
            stepNumber: step,
            entities: makeNodes(thetas, meanPhi, densities, states),
            edges: [],
            description: `Direction ${i}: theta ${(thetas[i] ?? 0).toFixed(2)}, density ${(densities[i] ?? 0).toFixed(5)} after dividing by the normalizer.`,
            codeLineNumber: i % 4 === 0 ? 2 : i % 4 === 1 ? 3 : i % 4 === 2 ? 4 : 5,
            layout: "point",
            meta: {
                index: i,
                theta: thetas[i] ?? 0,
                density: densities[i] ?? 0,
                normalizer,
                samples: thetas.map((theta, k) => [theta, densities[k] ?? 0]),
            },
        };
        step += 1;
    }

    const peak = Math.max(...densities);
    const peakIndex = densities.indexOf(peak);
    const finalStates = new Map<number, EntityState>([[peakIndex, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeNodes(thetas, meanPhi, densities, finalStates),
        edges: [],
        description: `Done: normalizer ${normalizer.toFixed(4)}, peak density ${peak.toFixed(4)} near theta ${(thetas[peakIndex] ?? 0).toFixed(2)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: {
            kappa,
            beta,
            normalizer,
            peakDensity: peak,
            peakTheta: thetas[peakIndex] ?? 0,
            samples: thetas.map((theta, i) => [theta, densities[i] ?? 0]),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Kent distribution is like a bell curve drawn on the surface of a sphere. Kappa controls how tightly points cluster around the mean direction, while beta stretches the cluster along one perpendicular direction and squeezes it along the other. The density is an exponential of a quadratic form in the direction vector, so evaluating it needs only dot products.",
        invariants: [
            "The three basis vectors are mutually orthogonal unit vectors.",
            "The log density is kappa times alignment with the mean plus beta times a shape difference.",
            "Dividing the exponential log density by the normalizer gives a density that integrates to one over the sphere.",
        ],
        correctness:
            "Because the tangent planes of a convex potential lie below the potential, the quadratic log density is exactly the Kent log kernel. Integrating its exponential over the sphere with spherical area measure yields the normalizing constant; the midpoint and trapezoid rule converges to that integral as the grid is refined. The resulting function is nonnegative and integrates to one, so it is a valid spherical density.",
        complexityRationale:
            "The normalizer evaluates the kernel on a uSteps by phiSteps grid, so setup is O(uSteps * phiSteps). Each of the displayed directions costs a constant number of dot products, giving O(samples) additional time and O(samples) space for the profile.",
        uses: [
            "Modeling directional data such as paleomagnetic directions",
            "Orientation statistics in computer vision and robotics",
            "Clustering of unit vectors in bioinformatics",
        ],
        references: [
            "Kent, The Fisher-Bingham Family on the Sphere, Communications in Statistics, 1982",
            "Mardia and Jupp, Directional Statistics, Chapter 9",
        ],
        workedExample:
            "With mean direction at theta 0.9 and phi 0.6, kappa 4, and beta 1, the log density at the mean is 4 because alignment is one and the shape term vanishes. Moving toward the shape direction lowers the alignment to zero but adds beta, giving a log density of 1. The sampled meridian therefore peaks at the mean direction.",
    },
    id: "kent-distribution",
    name: "Kent Distribution (Fisher-Bingham)",
    category: "statistics-probability",
    complexity: { time: "O(uSteps * phiSteps + samples)", space: "O(samples)" },
    defaultInput: { meanTheta: 0.9, meanPhi: 0.6, kappa: 4, beta: 1, steps: 20 },
    visualType: "point",
    run,
    pseudocode: [
        "build an orthonormal mean and shape basis",
        "define log density as kappa times alignment plus the beta shape term",
        "integrate the exponential log density over the sphere",
        "for each sample direction compute the log density",
        "divide by the normalizer to obtain the density",
        "record the value and compare with the peak at the mean",
        "continue until every sample direction is visited",
        "done: report the normalizer and the density profile",
    ],
};

export default module;
