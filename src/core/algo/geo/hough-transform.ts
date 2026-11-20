/**
 * hough-transform.ts - Standard Hough transform for line detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Hough transform detects lines in a set of edge (feature) points. A line
 * is written in normal form x cos(theta) + y sin(theta) = rho. Every feature
 * point votes for all (theta, rho) bins on which it could lie. A real line
 * produces many coincident votes, so the accumulator peak identifies the line
 * even when the points are not given in any order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * T) for n points and T angle bins
 *   Space: O(T * D) for the (theta, rho) accumulator
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Feature points that vote into the current peak are highlighted.
 *   - The best line so far is drawn between two boundary endpoints.
 *   - The final frame reports the winning (theta, rho) and its vote count.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

const DEG: number = Math.PI / 180;
const THETA_BINS = 180; // 0 to 179 degrees, one degree apart.

/** Rounded normal distance of a point from a given angle bin. */
function rhoOf(point: Pt, thetaDeg: number): number {
    const theta = thetaDeg * DEG;
    return Math.round(point[0] * Math.cos(theta) + point[1] * Math.sin(theta));
}

/** Two boundary points on the line x cos(theta) + y sin(theta) = rho. */
function lineEndpoints(thetaDeg: number, rho: number, bounds: { minX: number; maxX: number; minY: number; maxY: number }): [Pt, Pt] {
    const theta = thetaDeg * DEG;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const foot: Pt = [rho * cos, rho * sin];
    const dir: Pt = [-sin, cos];
    // Extend far enough to span the whole point bounding box.
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1) + 2;
    return [
        [foot[0] - dir[0] * span, foot[1] - dir[1] * span],
        [foot[0] + dir[0] * span, foot[1] + dir[1] * span],
    ];
}

/** Build entities: feature points plus optional line endpoints. */
function makeEntities(
    points: Pt[],
    states: Map<number, EntityState>,
    line: [Pt, Pt] | null,
): VisualEntity[] {
    const entities: VisualEntity[] = points.map(([x, y], index) => ({
        id: `pt-${index}`,
        type: "node" as const,
        label: `${index}`,
        value: [x, y],
        state: states.get(index) ?? "unvisited",
        x,
        y: -y,
        width: 0,
        height: 0,
        metadata: { x, y, index, kind: "feature" },
    }));
    if (line) {
        entities.push({
            id: "line-a",
            type: "node" as const,
            label: "A",
            value: line[0],
            state: "path",
            x: line[0][0],
            y: -line[0][1],
            width: 0,
            height: 0,
            metadata: { x: line[0][0], y: line[0][1], kind: "endpoint" },
        });
        entities.push({
            id: "line-b",
            type: "node" as const,
            label: "B",
            value: line[1],
            state: "path",
            x: line[1][0],
            y: -line[1][1],
            width: 0,
            height: 0,
            metadata: { x: line[1][0], y: line[1][1], kind: "endpoint" },
        });
    }
    return entities;
}

/** The Hough transform generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[]; previewEvery?: number } | null) ?? {};
    const points: Pt[] = (task.points ?? [
        [0, 3],
        [1, 3],
        [2, 3],
        [3, 3],
        [4, 3],
        [5, 3],
        [1, 0],
        [4, 7],
    ]).map((p) => [p[0], p[1]] as Pt);
    const previewEvery = Math.max(1, Math.min(THETA_BINS, task.previewEvery ?? 15));

    let step = 0;
    let line: [Pt, Pt] | null = null;
    const emit = (
        states: Map<number, EntityState>,
        edges: VisualEdge[],
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | Array<number | string>>,
        line: [Pt, Pt] | null,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeEntities(points, states, line),
        edges,
        description,
        codeLineNumber,
        layout: "point",
        meta,
    });

    const lineEdge = (): VisualEdge[] =>
        line
            ? [
                  {
                      id: "detected-line",
                      sourceId: "line-a",
                      targetId: "line-b",
                      label: "",
                      state: "path",
                      directed: false,
                  },
              ]
            : [];

    if (points.length === 0) {
        yield emit(new Map(), [], "Hough: no feature points, so no line can be detected.", 0, { thetaBins: THETA_BINS, peakVotes: 0 }, null);
        return;
    }

    let bounds = {
        minX: points[0]?.[0] ?? 0,
        maxX: points[0]?.[0] ?? 0,
        minY: points[0]?.[1] ?? 0,
        maxY: points[0]?.[1] ?? 0,
    };
    for (const [x, y] of points) {
        bounds = {
            minX: Math.min(bounds.minX, x),
            maxX: Math.max(bounds.maxX, x),
            minY: Math.min(bounds.minY, y),
            maxY: Math.max(bounds.maxY, y),
        };
    }

    yield emit(
        new Map(),
        [],
        `Hough: voting over ${THETA_BINS} angle bins for ${points.length} feature points.`,
        1,
        { thetaBins: THETA_BINS, featureCount: points.length },
        null,
    );

    // Accumulate votes for every (theta, rho) bin.
    const accumulator = new Map<string, number>();
    const binVotes: Array<{ theta: number; rho: number; votes: number }> = [];
    for (let theta = 0; theta < THETA_BINS; theta += 1) {
        const counts = new Map<number, number>();
        for (const point of points) {
            const rho = rhoOf(point, theta);
            counts.set(rho, (counts.get(rho) ?? 0) + 1);
        }
        for (const [rho, votes] of counts) {
            accumulator.set(`${theta}:${rho}`, votes);
            binVotes.push({ theta, rho, votes });
        }
    }

    let peak = { theta: 0, rho: 0, votes: 0 };
    for (const bin of binVotes) {
        if (bin.votes > peak.votes) {
            peak = bin;
        }
    }

    line = lineEndpoints(peak.theta, peak.rho, bounds);
    const peakVoters: VisualEdge[] = lineEdge();

    // Show periodic previews of the accumulator as it sweeps angles.
    for (let theta = 0; theta < THETA_BINS; theta += previewEvery) {
        const bestAtTheta = binVotes
            .filter((bin) => bin.theta === theta)
            .reduce<{ rho: number; votes: number }>((best, bin) => (bin.votes > best.votes ? bin : best), { rho: 0, votes: 0 });
        const states = new Map<number, EntityState>();
        for (let i = 0; i < points.length; i += 1) {
            if (rhoOf(points[i] as Pt, theta) === bestAtTheta.rho) {
                states.set(i, "active");
            }
        }
        yield emit(
            states,
            lineEdge(),
            `Hough: at theta ${theta} degrees the strongest rho bin is ${bestAtTheta.rho} with ${bestAtTheta.votes} vote(s).`,
            3,
            {
                theta,
                rho: bestAtTheta.rho,
                votes: bestAtTheta.votes,
                peakVotes: peak.votes,
                accumulatorSize: accumulator.size,
            },
            line,
        );
    }

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < points.length; i += 1) {
        if (rhoOf(points[i] as Pt, peak.theta) === peak.rho) {
            finalStates.set(i, "sorted");
        }
    }
    yield emit(
        finalStates,
        peakVoters,
        `Hough: detected line theta ${peak.theta} degrees, rho ${peak.rho}, with ${peak.votes} vote(s).`,
        5,
        {
            peakTheta: peak.theta,
            peakRho: peak.rho,
            peakVotes: peak.votes,
            featureCount: points.length,
            accumulatorSize: accumulator.size,
        },
        line,
    );
}

/** The Hough transform module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single edge point cannot tell you which line it belongs to, because infinitely many lines pass through it. The Hough transform flips the question: each point votes for every line that could contain it, expressed as an angle and a distance from the origin. Points lying on a real line vote for the same bin, so a strong accumulator peak reveals the line without needing the points in any order.",
        invariants: [
            "Every feature point casts exactly one vote into each angle bin.",
            "A bin's vote count equals the number of feature points on that normal-form line.",
            "The accumulator peak corresponds to the line supported by the most points.",
        ],
        correctness:
            "In normal form, a point (x, y) lies on the line (theta, rho) exactly when x cos(theta) + y sin(theta) = rho. Each collinear point therefore increments the same accumulator bin, and no other bin receives all those votes. The maximum bin has the largest set of collinear support points, so reporting its (theta, rho) yields the dominant line.",
        complexityRationale:
            "There are n feature points and T angle bins, and each point votes once per bin, giving O(n T) time. The accumulator holds at most one entry per occupied (theta, rho) pair, bounded by O(T D) where D is the range of rounded rho values.",
        uses: [
            "Detecting straight edges in images for computer vision",
            "Lane marking detection in driver assistance systems",
            "Finding alignments in scanned documents and circuit boards",
        ],
        references: [
            "Hough, Method and Means for Recognizing Complex Patterns, 1962",
            "Duda and Hart, Use of the Hough Transformation to Detect Lines and Curves in Pictures, 1972",
        ],
        workedExample:
            "Six feature points at (0,3) through (5,3) all lie on y = 3. At theta 90 degrees each computes rho = round(y) = 3, so that bin collects six votes, more than any other bin. The peak (90 degrees, rho 3) reconstructs the horizontal line y = 3.",
    },
    id: "hough-transform",
    name: "Hough Transform (Line Detection)",
    category: "geometry",
    complexity: { time: "O(n * T)", space: "O(T * D)" },
    defaultInput: {
        points: [
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
            [4, 3],
            [5, 3],
            [1, 0],
            [4, 7],
        ],
        previewEvery: 15,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize an empty accumulator over theta and rho bins",
        "for every feature point and every theta bin",
        "compute rho as x cos theta plus y sin theta and round it",
        "cast one vote into the accumulator bin for that pair",
        "after all votes find the bin with the most votes",
        "convert the winning theta and rho back into a line",
        "highlight the points that supported the peak and draw the line",
    ],
};

export default module;
