/**
 * circular-mean.ts - Circular Mean of Directional Data
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The circular mean gives the average direction of angles on a circle. It
 * converts each angle to a unit vector, averages the horizontal and vertical
 * components, and takes the arctangent of the averages. The length of the
 * resulting vector measures how tightly the directions cluster.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n angles
 *   Space: O(n) for the plotted unit-circle points
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each angle is plotted as a point on the unit circle.
 *   - The angle currently contributing its vector is highlighted.
 *   - The final frame reports the mean direction and resultant length.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makePoints(angles: number[], active: number, done: boolean): VisualEntity[] {
    return angles.map((angle, index) => {
        let state: EntityState = done ? "sorted" : "idle";
        if (!done && index === active) {
            state = "active";
        }
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        return {
            id: `point-${index}`,
            type: "node" as const,
            label: angle.toFixed(2),
            value: angle,
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index, angle, cos: x, sin: y },
        };
    });
}

function wrap(angle: number): number {
    let result = angle;
    while (result < 0) {
        result += 2 * Math.PI;
    }
    while (result >= 2 * Math.PI) {
        result -= 2 * Math.PI;
    }
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { angles?: number[] } | null) ?? {};
    const angles: number[] = Array.isArray(task.angles)
        ? task.angles.slice()
        : [0.1, 0.4, 0.7, 1.0, 0.5, 1.3];
    const n = angles.length;

    yield {
        stepNumber: 0,
        entities: makePoints(angles, -1, false),
        edges: [],
        description: `Circular mean of ${n} direction(s) measured in radians.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n, cosMean: 0, sinMean: 0, meanAngle: 0, resultantLength: 0 },
    };
    let step = 1;

    let cosSum = 0;
    let sinSum = 0;
    for (let i = 0; i < n; i += 1) {
        const angle = angles[i] ?? 0;
        cosSum += Math.cos(angle);
        sinSum += Math.sin(angle);
        yield {
            stepNumber: step,
            entities: makePoints(angles, i, false),
            edges: [],
            description: `Angle ${i + 1} is ${angle.toFixed(3)} radians; component sums are ${cosSum.toFixed(3)} and ${sinSum.toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { n, cosMean: 0, sinMean: 0, meanAngle: 0, resultantLength: 0 },
        };
        step += 1;
    }

    const cosMean = n > 0 ? cosSum / n : 0;
    const sinMean = n > 0 ? sinSum / n : 0;
    const meanAngle = wrap(Math.atan2(sinMean, cosMean));
    const resultantLength = Math.sqrt(cosMean * cosMean + sinMean * sinMean);
    yield {
        stepNumber: step,
        entities: makePoints(angles, -1, true),
        edges: [],
        description: `Mean direction is ${meanAngle.toFixed(4)} radians with resultant length ${resultantLength.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { n, cosMean, sinMean, meanAngle, resultantLength },
    };
}

/** The circular mean module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Averaging angles as ordinary numbers fails at the wrap from two pi back to zero, so directions are turned into points on a unit circle instead. The mean direction is where the average of those points points, and the length of that average tells how concentrated the directions are.",
        invariants: [
            "Every angle contributes one unit vector with coordinates cosine and sine.",
            "The resultant length lies between zero and one.",
            "Rotating every angle by a fixed amount rotates the mean direction by the same amount.",
        ],
        correctness:
            "Averaging the unit vectors gives the mean resultant vector, whose angle is the circular mean. Because the component averages are the first trigonometric moments, the direction they define is the one that minimizes squared angular distance around the circle. The resultant length is the magnitude of that average, reaching one only when all angles coincide and zero when they cancel.",
        complexityRationale:
            "Each angle contributes one sine and cosine and the sums are accumulated in a single pass, so time is linear in n and the plotted points use linear space.",
        uses: [
            "Averaging wind directions and compass bearings",
            "Summarizing animal movement headings",
            "Combining phase estimates in signal processing",
        ],
        references: [
            "Mardia and Jupp, Directional Statistics, Chapter 2",
            "Fisher, Statistical Analysis of Circular Data, 1993",
        ],
        workedExample:
            "For angles zero and pi over two, the component sums are one and one, so the averages are one half each. The arctangent gives pi over four as the mean direction, and the resultant length is the square root of one half, about 0.707, reflecting the spread of the two directions.",
    },
    id: "circular-mean",
    name: "Circular Mean",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { angles: [0.1, 0.4, 0.7, 1.0, 0.5, 1.3] },
    visualType: "point",
    run,
    pseudocode: [
        "read the list of angles in radians",
        "initialize the cosine and sine sums to zero",
        "for each angle add its cosine and sine to the sums",
        "divide both sums by the number of angles",
        "take the arctangent of sine over cosine for the mean direction",
        "compute the resultant length from the two averages",
        "done: report the circular mean and resultant length",
    ],
};

export default module;
