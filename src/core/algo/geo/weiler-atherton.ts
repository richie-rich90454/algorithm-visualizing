/**
 * weiler-atherton.ts - Weiler-Atherton Polygon Clipping
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Clips a subject polygon against a clip polygon by splitting both boundaries
 * at their crossings, then walking a path that alternates between the two
 * boundaries. Starting at a point where the subject enters the clip region,
 * the walk follows the subject edge until it exits; there it hops to the clip
 * boundary and follows it until the clip exits the subject, hopping back. The
 * closed path is the intersection polygon. This is distinct from
 * Sutherland-Hodgman, which clips against one half-plane at a time, and from
 * Greiner-Hormann, which links intersections with cross-reference pointers
 * rather than alternating entry and exit walks.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n*m) to find crossings plus O(n+m) for the walks
 *   Space: O(n+m) for the split boundary rings and the output
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Subject vertices are ACTIVE nodes; clip vertices are VISITED nodes.
 *   - Boundary crossings are HIGHLIGHT nodes.
 *   - The traced output boundary is drawn as a path of edges between output nodes.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

interface Crossing {
    point: Pt;
    subjEdge: number;
    clipEdge: number;
    t: number;
    s: number;
    subjEnter: boolean;
    clipEnter: boolean;
}

interface RingNode {
    point: Pt;
    cross: number | null;
}

function inside(p: Pt, poly: Pt[]): boolean {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const a = poly[i] as Pt;
        const b = poly[j] as Pt;
        if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
            c = !c;
        }
    }
    return c;
}

function segInter(a: Pt, b: Pt, c: Pt, d: Pt): { t: number; s: number; point: Pt } | null {
    const rx = b[0] - a[0];
    const ry = b[1] - a[1];
    const ux = d[0] - c[0];
    const uy = d[1] - c[1];
    const den = rx * uy - ry * ux;
    if (Math.abs(den) < 1e-12) {
        return null;
    }
    const qx = c[0] - a[0];
    const qy = c[1] - a[1];
    const t = (qx * uy - qy * ux) / den;
    const s = (qx * ry - qy * rx) / den;
    const eps = 1e-9;
    if (t > eps && t < 1 - eps && s > eps && s < 1 - eps) {
        return { t, s, point: [a[0] + t * rx, a[1] + t * ry] };
    }
    return null;
}

function area(poly: Pt[]): number {
    let sum = 0;
    for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i] as Pt;
        const b = poly[(i + 1) % poly.length] as Pt;
        sum += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(sum) / 2;
}

function samePoint(a: Pt, b: Pt): boolean {
    return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

/** Result of one clipped traversal. */
function clip(subject: Pt[], clipPoly: Pt[]): { output: Pt[][]; crosses: Crossing[] } {
    const crosses: Crossing[] = [];
    for (let i = 0; i < subject.length; i += 1) {
        const a = subject[i] as Pt;
        const b = subject[(i + 1) % subject.length] as Pt;
        for (let j = 0; j < clipPoly.length; j += 1) {
            const c = clipPoly[j] as Pt;
            const d = clipPoly[(j + 1) % clipPoly.length] as Pt;
            const hit = segInter(a, b, c, d);
            if (hit) {
                crosses.push({
                    point: hit.point,
                    subjEdge: i,
                    clipEdge: j,
                    t: hit.t,
                    s: hit.s,
                    subjEnter: false,
                    clipEnter: false,
                });
            }
        }
    }

    const eps = 1e-4;
    for (const cross of crosses) {
        const a = subject[cross.subjEdge] as Pt;
        const b = subject[(cross.subjEdge + 1) % subject.length] as Pt;
        const before: Pt = [a[0] + (b[0] - a[0]) * Math.max(0, cross.t - eps), a[1] + (b[1] - a[1]) * Math.max(0, cross.t - eps)];
        const after: Pt = [a[0] + (b[0] - a[0]) * Math.min(1, cross.t + eps), a[1] + (b[1] - a[1]) * Math.min(1, cross.t + eps)];
        cross.subjEnter = !inside(before, clipPoly) && inside(after, clipPoly);

        const c = clipPoly[cross.clipEdge] as Pt;
        const d = clipPoly[(cross.clipEdge + 1) % clipPoly.length] as Pt;
        const cBefore: Pt = [c[0] + (d[0] - c[0]) * Math.max(0, cross.s - eps), c[1] + (d[1] - c[1]) * Math.max(0, cross.s - eps)];
        const cAfter: Pt = [c[0] + (d[0] - c[0]) * Math.min(1, cross.s + eps), c[1] + (d[1] - c[1]) * Math.min(1, cross.s + eps)];
        cross.clipEnter = !inside(cBefore, subject) && inside(cAfter, subject);
    }

    if (crosses.length === 0) {
        if (subject.length > 0 && inside(subject[0] as Pt, clipPoly)) {
            return { output: [subject.slice()], crosses };
        }
        if (clipPoly.length > 0 && inside(clipPoly[0] as Pt, subject)) {
            return { output: [clipPoly.slice()], crosses };
        }
        return { output: [], crosses };
    }

    // Split each boundary into a cyclic ring of original and crossing points.
    const subjRing: RingNode[] = [];
    subject.forEach((p, i) => {
        subjRing.push({ point: p, cross: null });
        const onEdge: Array<{ ci: number; t: number }> = [];
        crosses.forEach((cross, ci) => {
            if (cross.subjEdge === i) {
                onEdge.push({ ci, t: cross.t });
            }
        });
        onEdge.sort((a, b) => a.t - b.t);
        onEdge.forEach(({ ci }) => subjRing.push({ point: (crosses[ci] as Crossing).point, cross: ci }));
    });
    const clipRing: RingNode[] = [];
    clipPoly.forEach((p, i) => {
        clipRing.push({ point: p, cross: null });
        const onEdge: Array<{ ci: number; s: number }> = [];
        crosses.forEach((cross, ci) => {
            if (cross.clipEdge === i) {
                onEdge.push({ ci, s: cross.s });
            }
        });
        onEdge.sort((a, b) => a.s - b.s);
        onEdge.forEach(({ ci }) => clipRing.push({ point: (crosses[ci] as Crossing).point, cross: ci }));
    });
    const subjIndexOf = new Map<number, number>();
    const clipIndexOf = new Map<number, number>();
    subjRing.forEach((node, i) => {
        if (node.cross !== null) subjIndexOf.set(node.cross, i);
    });
    clipRing.forEach((node, i) => {
        if (node.cross !== null) clipIndexOf.set(node.cross, i);
    });

    const output: Pt[][] = [];
    const used = new Set<number>();
    crosses.forEach((cross, startCross) => {
        if (!cross.subjEnter || used.has(startCross)) {
            return;
        }
        const startIdx = subjIndexOf.get(startCross);
        if (startIdx === undefined) {
            return;
        }
        const path: Pt[] = [];
        const seen = new Set<number>();
        let ring: RingNode[] = subjRing;
        let idx = startIdx;
        let switched = false;
        const maxSteps = 4 * (subjRing.length + clipRing.length) + 8;

        for (let step = 0; step < maxSteps; step += 1) {
            const node = ring[idx] as RingNode;
            if (path.length === 0 || !samePoint(path[path.length - 1] as Pt, node.point)) {
                path.push(node.point);
            }
            if (node.cross !== null) {
                seen.add(node.cross);
                used.add(node.cross);
            }
            const nextIdx = (idx + 1) % ring.length;
            const nextNode = ring[nextIdx] as RingNode;

            if (ring === subjRing && idx === startIdx && switched) {
                break;
            }
            if (nextNode.cross !== null) {
                const ci = nextNode.cross;
                const nextCross = crosses[ci] as Crossing;
                if (ring === subjRing) {
                    if (!nextCross.subjEnter) {
                        const jump = clipIndexOf.get(ci);
                        if (jump === undefined) break;
                        ring = clipRing;
                        idx = jump;
                        switched = true;
                        continue;
                    }
                } else if (!nextCross.clipEnter) {
                    const jump = subjIndexOf.get(ci);
                    if (jump === undefined) break;
                    ring = subjRing;
                    idx = jump;
                    continue;
                }
            }
            idx = nextIdx;
            if (seen.size > crosses.length + 1) {
                break;
            }
        }
        if (path.length >= 3 && area(path) > 1e-7) {
            output.push(path);
        }
    });

    return { output, crosses };
}

function makeEntities(
    subject: Pt[],
    clipPoly: Pt[],
    crosses: Crossing[],
    shownCrosses: number,
    output: Pt[][],
): VisualEntity[] {
    const out: VisualEntity[] = [];
    subject.forEach((p, i) => out.push(node(`s-${i}`, p, "active", "subject", i)));
    clipPoly.forEach((p, i) => out.push(node(`c-${i}`, p, "visited", "clip", i)));
    crosses.slice(0, shownCrosses).forEach((cross, i) =>
        out.push(node(`x-${i}`, cross.point, "highlight", "crossing", i)),
    );
    output.forEach((poly, pi) => {
        poly.forEach((p, i) => out.push(node(`o-${pi}-${i}`, p, "sorted", "output", i)));
    });
    return out;
}

function node(id: string, p: Pt, state: EntityState, role: string, index: number): VisualEntity {
    return {
        id,
        type: "node" as const,
        label: `${role[0]}${index}`,
        value: p,
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { role, index },
    };
}

function makeEdges(subject: Pt[], clipPoly: Pt[], crosses: Crossing[], shownCrosses: number, output: Pt[][]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < subject.length; i += 1) {
        edges.push({ id: `sedge-${i}`, sourceId: `s-${i}`, targetId: `s-${(i + 1) % subject.length}`, label: "", state: "active", directed: false });
    }
    for (let i = 0; i < clipPoly.length; i += 1) {
        edges.push({ id: `cedge-${i}`, sourceId: `c-${i}`, targetId: `c-${(i + 1) % clipPoly.length}`, label: "", state: "visited", directed: false });
    }
    for (let i = 0; i < shownCrosses; i += 1) {
        edges.push({ id: `xedge-${i}`, sourceId: `x-${i}`, targetId: `x-${Math.min(i + 1, shownCrosses - 1)}`, label: "", state: "highlight", directed: false });
    }
    output.forEach((poly, pi) => {
        for (let i = 0; i < poly.length; i += 1) {
            edges.push({
                id: `oedge-${pi}-${i}`,
                sourceId: `o-${pi}-${i}`,
                targetId: `o-${pi}-${(i + 1) % poly.length}`,
                label: "",
                state: "sorted",
                directed: false,
            });
        }
    });
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { subject?: Pt[]; clip?: Pt[] } | null) ?? {};
    const subject: Pt[] = (task.subject ?? [[0, 0], [6, 0], [6, 5], [0, 5]]).map((p) => [p[0], p[1]] as Pt);
    const clipPoly: Pt[] = (task.clip ?? [[3, 2], [9, 2], [9, 7], [3, 7]]).map((p) => [p[0], p[1]] as Pt);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(subject, clipPoly, [], 0, []),
        edges: makeEdges(subject, clipPoly, [], 0, []),
        description: `Clip a ${subject.length}-vertex subject against a ${clipPoly.length}-vertex clip polygon by entry-exit boundary walking.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { subjectVertices: subject.length, clipVertices: clipPoly.length, crossings: 0, outputVertices: 0, area: 0 },
    };
    step += 1;

    const { output, crosses } = clip(subject, clipPoly);
    for (let shown = 1; shown <= crosses.length; shown += 1) {
        const cross = crosses[shown - 1] as Crossing;
        yield {
            stepNumber: step,
            entities: makeEntities(subject, clipPoly, crosses, shown, []),
            edges: makeEdges(subject, clipPoly, crosses, shown, []),
            description: `Crossing ${shown} at (${cross.point[0].toFixed(2)}, ${cross.point[1].toFixed(2)}): subject ${cross.subjEnter ? "enters" : "leaves"} the clip region here.`,
            codeLineNumber: 1,
            layout: "point",
            meta: { subjectVertices: subject.length, clipVertices: clipPoly.length, crossings: shown, outputVertices: 0, area: 0 },
        };
        step += 1;
    }

    const partial: Pt[][] = [];
    for (let pi = 0; pi < output.length; pi += 1) {
        const poly = output[pi] as Pt[];
        for (let k = 1; k <= poly.length; k += 1) {
            partial[pi] = poly.slice(0, k);
            yield {
                stepNumber: step,
                entities: makeEntities(subject, clipPoly, crosses, crosses.length, partial),
                edges: makeEdges(subject, clipPoly, crosses, crosses.length, partial),
                description: `Walking output region ${pi + 1}: ${k} of ${poly.length} boundary point(s) traced.`,
                codeLineNumber: 3,
                layout: "point",
                meta: { subjectVertices: subject.length, clipVertices: clipPoly.length, crossings: crosses.length, outputVertices: k, area: area(partial[pi] as Pt[]) },
            };
            step += 1;
        }
    }

    const totalArea = output.reduce((sum, poly) => sum + area(poly), 0);
    const totalVertices = output.reduce((sum, poly) => sum + poly.length, 0);
    yield {
        stepNumber: step,
        entities: makeEntities(subject, clipPoly, crosses, crosses.length, output),
        edges: makeEdges(subject, clipPoly, crosses, crosses.length, output),
        description: output.length
            ? `Done: traced ${output.length} intersection region(s) with ${totalVertices} boundary point(s) and area ${totalArea.toFixed(2)}.`
            : "Done: the polygons do not overlap, so the intersection is empty.",
        codeLineNumber: 5,
        layout: "point",
        meta: { subjectVertices: subject.length, clipVertices: clipPoly.length, crossings: crosses.length, outputVertices: totalVertices, area: totalArea },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Mark every place where the two outlines cross. Start where the subject steps into the clip region and follow that outline until it steps back out; at that exact corner, switch to the other outline and follow it until it steps back in. Repeating this alternation traces the shared region. The rule works because the boundary of an intersection is made of pieces of the two original boundaries.",
        invariants: [
            "At each crossing the subject-entry flag and the clip-entry flag have opposite truth values.",
            "The walk only follows subject boundary while inside the clip polygon, and clip boundary while inside the subject polygon.",
            "Every crossing is used at most once across all traced regions.",
        ],
        correctness:
            "At a proper crossing, the subject moves from outside the clip to inside it exactly when the clip moves from outside the subject to inside it, so the entry flags are complementary. The boundary of the intersection consists of subject edges lying inside the clip and clip edges lying inside the subject. Starting at an entry and switching boundaries only at an exit therefore keeps the walk on that boundary, and because each crossing is visited at most once the walk closes into a simple cycle enclosing precisely the overlap.",
        complexityRationale:
            "Testing every subject edge against every clip edge costs O(n*m) intersection computations, and computing entry flags is constant work per crossing. Building the split rings and walking them visits O(n+m+k) items, so the total is O(n*m) time and O(n+m) space for the rings and output.",
        uses: [
            "Boolean union, intersection, and difference operations in vector graphics",
            "Overlay analysis and layer intersection in geographic information systems",
            "Clipping polygons to a viewport or a planning permission region",
        ],
        references: [
            "Weiler and Atherton, Hidden Surface Removal Using Polygon Area Sorting, 1977",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 2",
        ],
        workedExample:
            "Clip the square (0,0)-(6,0)-(6,5)-(0,5) against the square (3,2)-(9,2)-(9,7)-(3,7). The outlines cross at (6,2) and (3,5). Starting at (6,2), where the subject enters the clip, the walk follows the subject up to (3,5), then the clip boundary back to (6,2), tracing the overlap square of area 9.",
    },
    id: "weiler-atherton",
    name: "Weiler-Atherton Polygon Clipping",
    category: "geometry",
    complexity: { time: "O(n*m)", space: "O(n+m)" },
    defaultInput: {
        subject: [[0, 0], [6, 0], [6, 5], [0, 5]],
        clip: [[3, 2], [9, 2], [9, 7], [3, 7]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "find every crossing between a subject edge and a clip edge",
        "for each crossing mark whether the subject is entering the clip",
        "start at an entering crossing and follow the subject boundary",
        "at an exiting crossing hop to the clip boundary",
        "follow the clip boundary until the clip exits the subject",
        "hop back to the subject boundary and continue until the start repeats",
        "done: report the closed intersection boundary and its area",
    ],
};

export default module;
