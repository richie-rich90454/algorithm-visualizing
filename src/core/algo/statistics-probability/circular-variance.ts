/**
 * circular-variance.ts - Circular Variance of Angles
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ordinary variance is meaningless for angles because zero and two pi are the
 * same direction. Circular variance treats each angle as a unit vector and
 * averages those vectors. The length R of the mean resultant lies between zero
 * and one, and the circular variance is 1 - R: it is zero when every angle is
 * identical and approaches one when the directions are spread uniformly around
 * the circle. The angle of the resultant is the mean direction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n angles
 *   Space: O(n) for the plotted unit-vector nodes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each angle is a node on the unit circle at (cos, sin).
 *   - A separate node marks the mean resultant vector.
 *   - The final frame turns the resultant green and reports R and the variance.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CircularInput {
    angles?: number[];
}

function makeNodes(angles: number[], meanCos: number, meanSin: number, current: number, done: boolean): VisualEntity[] {
    const nodes: VisualEntity[] = angles.map((angle, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "visited";
        } else if (index === current) {
            state = "comparing";
        } else if (index < current) {
            state = "visited";
        }
        return {
            id: `angle-${index}`,
            type: "node" as const,
            label: angle.toFixed(2),
            value: angle,
            state,
            x: Math.cos(angle),
            y: Math.sin(angle),
            width: 0,
            height: 0,
            metadata: { index, angle, cos: Math.cos(angle), sin: Math.sin(angle) },
        };
    });
    nodes.push({
        id: "resultant",
        type: "node" as const,
        label: "mean",
        value: meanCos,
        state: done ? "sorted" : "active",
        x: meanCos,
        y: meanSin,
        width: 0,
        height: 0,
        metadata: { index: -1, cos: meanCos, sin: meanSin },
    });
    return nodes;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CircularInput | null) ?? {};
    const angles: number[] = Array.isArray(task.angles)
        ? task.angles.map((a) => Number(a) || 0)
        : [0, 0.2, -0.1, 0.35, 0.05];
    const n = angles.length;
    const sumCos = angles.reduce((total, a) => total + Math.cos(a), 0);
    const sumSin = angles.reduce((total, a) => total + Math.sin(a), 0);
    const meanCos = n === 0 ? 0 : sumCos / n;
    const meanSin = n === 0 ? 0 : sumSin / n;
    const resultantLength = Math.sqrt(meanCos * meanCos + meanSin * meanSin);
    const variance = 1 - resultantLength;
    const meanAngle = Math.atan2(meanSin, meanCos);
    const clamped = Math.max(1e-12, resultantLength);
    const circularStd = Math.sqrt(-2 * Math.log(clamped));
    let step = 0;

    const frame = (current: number, done: boolean, description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step,
        entities: makeNodes(angles, meanCos, meanSin, current, done),
        edges: [],
        description,
        codeLineNumber,
        layout: "point",
        meta: {
            n,
            meanCos,
            meanSin,
            resultantLength,
            variance,
            meanAngle,
            circularStd,
        },
    });

    yield frame(-1, false, `Placing ${n} angles as unit vectors and averaging them.`, 0);
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield frame(i, false, `Angle ${i} = ${(angles[i] ?? 0).toFixed(4)} radians added to the running resultant.`, 2);
        step += 1;
    }

    yield frame(-1, true, `Mean resultant length R = ${resultantLength.toFixed(4)}; circular variance 1 - R = ${variance.toFixed(4)}.`, 5);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Angles wrap around, so saying that zero and 360 degrees are far apart is wrong. Instead, picture each direction as a point on the unit circle and imagine each point pulling with equal strength. If all the directions agree, the pulls add to a long arrow; if they cancel out, the arrow nearly vanishes. Circular variance is one minus the arrow's average length.",
        invariants: [
            "Every plotted angle sits on the unit circle at cosine and sine of the angle.",
            "The resultant length R always lies between zero and one.",
            "Circular variance equals one minus R and is therefore between zero and one.",
        ],
        correctness:
            "Representing an angle by its unit vector makes the representation continuous across the branch cut, so averaging the vectors is well defined. The mean resultant is the average of those vectors and its length R is at most the average of the lengths, which is one, and at least zero, giving R in zero to one. Circular variance is defined as 1 - R, so it is zero only when every vector points the same way and tends to one as the vectors cancel. The mean direction is the argument of the resultant, and the circular standard deviation is defined as the square root of minus twice the log of R.",
        complexityRationale:
            "Computing the sine and cosine sums touches each angle once, so time is O(n); the unit-circle nodes and one resultant node use O(n) space.",
        uses: [
            "Summarizing wind direction or animal orientation data",
            "Analyzing cyclic phenomena such as time of day or compass bearings",
            "Measuring concentration of directional survey responses",
        ],
        references: [
            "Mardia and Jupp, Directional Statistics, Chapter 2",
            "Fisher, Statistical Analysis of Circular Data, Chapter 2",
        ],
        workedExample:
            "For angles 0, pi/2, pi, and 3 pi/2 the four unit vectors cancel, so the mean resultant has length zero and the circular variance is one. For four identical angles the resultant length is one and the variance is zero.",
    },
    id: "circular-variance",
    name: "Circular Variance",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { angles: [0, 0.2, -0.1, 0.35, 0.05] },
    visualType: "point",
    run,
    pseudocode: [
        "read the list of angles in radians",
        "sum the cosine and the sine of every angle",
        "divide both sums by the count to get the mean resultant vector",
        "set R to the length of the mean resultant",
        "set circular variance to one minus R",
        "set the mean direction to the angle of the resultant",
        "done: report R, variance, mean direction, and circular standard deviation",
    ],
};

export default module;
