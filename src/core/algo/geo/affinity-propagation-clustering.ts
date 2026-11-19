/**
 * affinity-propagation-clustering.ts - Clustering by message passing.
 *
 * Every point is a candidate exemplar. Points exchange responsibility (how
 * well suited a candidate is to a particular point) and availability (how much
 * support a candidate gets from the rest of the data). Candidates whose net
 * message is positive become exemplars, and each point joins its best one.
 *
 * Time: O(iterations * n^2). Space: O(n^2).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function buildSimilarity(points: Pt[], preference: number): number[][] {
    return points.map((p, i) =>
        points.map((q, j) =>
            i === j ? preference : -((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2),
        ),
    );
}

function node(id: string, p: Pt, state: EntityState, label: string, cluster: number): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [p[0], p[1]],
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { cluster },
    };
}

const CLUSTER_STATES: EntityState[] = ["sorted", "visited", "active", "highlight", "path", "comparing"];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        points?: Pt[];
        similarity?: number[][];
        preference?: number;
        damping?: number;
        maxIterations?: number;
    } | null) ?? {};
    const points: Pt[] = task.points ?? [
        [0, 0],
        [1, 0.2],
        [2, -0.1],
        [8, 8],
        [8.5, 7.7],
        [7.8, 8.3],
    ];
    const n = points.length;
    const damping = typeof task.damping === "number" ? Math.max(0, Math.min(0.99, task.damping)) : 0.7;
    const maxIterations = typeof task.maxIterations === "number" ? Math.max(1, Math.floor(task.maxIterations)) : 80;
    const S: number[][] =
        task.similarity && task.similarity.length === n
            ? task.similarity.map((row) => [...row])
            : buildSimilarity(points, Number.NEGATIVE_INFINITY);
    const preference =
        typeof task.preference === "number"
            ? task.preference
            : (() => {
                  const off: number[] = [];
                  for (let i = 0; i < n; i += 1) {
                      for (let j = 0; j < n; j += 1) {
                          if (i !== j) off.push(S[i]![j] as number);
                      }
                  }
                  off.sort((x, y) => x - y);
                  return off.length > 0 ? (off[Math.floor(off.length / 2)] as number) : 0;
              })();
    for (let i = 0; i < n; i += 1) {
        (S[i] as number[])[i] = preference;
    }

    if (n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No points: no clusters to form.",
            codeLineNumber: 0,
            layout: "point",
            meta: { exemplars: [], assignments: [], iterations: 0, clusters: 0 },
        };
        return;
    }

    const r = S.map(() => S[0]!.map(() => 0));
    const a = S.map(() => S[0]!.map(() => 0));
    let step = 0;

    yield {
        stepNumber: step,
        entities: points.map((p, i) => node(`p-${i}`, p, "unvisited", String(i), -1)),
        edges: [],
        description: `Starting affinity propagation on ${n} candidate exemplars.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { exemplars: [], assignments: [], iterations: 0, clusters: 0 },
    };
    step += 1;

    let iterations = 0;
    for (; iterations < maxIterations; iterations += 1) {
        for (let i = 0; i < n; i += 1) {
            for (let k = 0; k < n; k += 1) {
                let best = -Infinity;
                for (let k2 = 0; k2 < n; k2 += 1) {
                    if (k2 === k) continue;
                    best = Math.max(best, (a[i] as number[])[k2] as number + (S[i] as number[])[k2] as number);
                }
                (r[i] as number[])[k] = (S[i] as number[])[k] as number - best;
            }
        }
        for (let k = 0; k < n; k += 1) {
            let incomingSelf = 0;
            for (let i2 = 0; i2 < n; i2 += 1) {
                if (i2 === k) continue;
                incomingSelf += Math.max(0, (r[i2] as number[])[k] as number);
            }
            for (let i = 0; i < n; i += 1) {
                let minValue = 0;
                if (i !== k) {
                    let other = (r[k] as number[])[k] as number;
                    for (let i2 = 0; i2 < n; i2 += 1) {
                        if (i2 === i || i2 === k) continue;
                        other += Math.max(0, (r[i2] as number[])[k] as number);
                    }
                    minValue = Math.min(0, other);
                }
                const target = i === k ? incomingSelf : minValue;
                (a[i] as number[])[k] =
                    damping * ((a[i] as number[])[k] as number) + (1 - damping) * target;
            }
        }

        const exemplars: number[] = [];
        for (let k = 0; k < n; k += 1) {
            if ((r[k] as number[])[k] as number + ((a[k] as number[])[k] as number) > 0) {
                exemplars.push(k);
            }
        }
        yield {
            stepNumber: step,
            entities: points.map((p, i) =>
                node(`p-${i}`, p, exemplars.includes(i) ? "pivot" : "unvisited", String(i), -1),
            ),
            edges: [],
            description: `Iteration ${iterations + 1}: ${exemplars.length} candidate exemplar(s).`,
            codeLineNumber: 3,
            layout: "point",
            meta: { iteration: iterations + 1, exemplars, clusters: exemplars.length },
        };
        step += 1;
    }

    const exemplars: number[] = [];
    for (let k = 0; k < n; k += 1) {
        if ((r[k] as number[])[k] as number + ((a[k] as number[])[k] as number) > 0) {
            exemplars.push(k);
        }
    }
    const effective = exemplars.length > 0 ? exemplars : [0];
    const assignments: number[] = [];
    const scores: number[] = [];
    for (let i = 0; i < n; i += 1) {
        let bestK = effective[0] as number;
        let bestScore = -Infinity;
        for (const k of effective) {
            const score = (r[i] as number[])[k] as number + ((a[i] as number[])[k] as number);
            scores.push(score);
            if (score > bestScore) {
                bestScore = score;
                bestK = k;
            }
        }
        assignments.push(effective.includes(i) ? i : bestK);
    }
    const selfScores = Array.from({ length: n }, (_, k) =>
        (r[k] as number[])[k] as number + ((a[k] as number[])[k] as number),
    );
    const clusterOf = (i: number): number => Math.max(0, effective.indexOf(assignments[i] as number));

    yield {
        stepNumber: step,
        entities: points.map((p, i) =>
            node(`p-${i}`, p, i === assignments[i] ? "pivot" : CLUSTER_STATES[clusterOf(i)] as EntityState, String(i), clusterOf(i)),
        ),
        edges: points.map((_, i) => ({
            id: `assign-${i}`,
            sourceId: `p-${i}`,
            targetId: `p-${assignments[i]}`,
            label: "",
            state: "path" as EntityState,
            directed: true,
        })),
        description: `Done: ${effective.length} exemplar(s) after ${iterations} iteration(s).`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            exemplars: effective,
            assignments,
            iterations,
            clusters: effective.length,
            selfScores,
            scores,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine every data point campaigning to represent a cluster. Points send responsibility messages saying how much better one candidate is than the others, and candidates send availability messages saying how much support they have from the group. After enough rounds the strongest candidates stand as exemplars and the rest attach to them.",
        invariants: [
            "Responsibilities compare a candidate against all other candidates for the same point.",
            "Availabilitys never exceed zero for non-self pairs, reflecting only positive support.",
            "Damping keeps each message between its old value and its newly computed value.",
        ],
        correctness:
            "The updates are coordinate ascent on an energy that rewards high similarity to an exemplar and penalizes having too many exemplars. At a fixed point, a candidate with positive self-availability plus self-responsibility is closer to its own members than any competing candidate, so the exemplar set is consistent. Assigning each point to the exemplar with the largest combined message is then the best response for that point, giving a stable clustering.",
        complexityRationale:
            "Each of the t iterations updates n squared responsibilities and n squared availabilitys, each in constant time for a fixed n scan, so time is O(t * n^2). Storing both message matrices uses O(n^2) space.",
        uses: [
            "Grouping documents without choosing the number of clusters in advance",
            "Selecting representative images or gene profiles",
            "Topic discovery where exemplars are real data points",
        ],
        references: [
            "Frey and Dueck, Clustering by Passing Messages Between Data Points, Science 315, 2007",
            "Dueck, Affinity Propagation: Clustering by Message Passing, 2009",
        ],
        workedExample:
            "With four points forming two tight pairs, the two points inside each pair exchange the strongest responsibilities and availabilities. Their self messages turn positive, so both become exemplars and each partner points to the exemplar in its own pair.",
    },
    id: "affinity-propagation-clustering",
    name: "Affinity Propagation Clustering",
    category: "geometry",
    complexity: { time: "O(t * n^2)", space: "O(n^2)" },
    defaultInput: {
        points: [
            [0, 0],
            [1, 0.2],
            [2, -0.1],
            [8, 8],
            [8.5, 7.7],
            [7.8, 8.3],
        ],
        damping: 0.7,
        maxIterations: 80,
    },
    visualType: "point",
    run,
    pseudocode: [
        "build the similarity matrix with preferences on the diagonal",
        "initialize responsibilities and availabilities to zero",
        "for each iteration",
        "update each responsibility from competing candidates",
        "update each availability from supporting points",
        "apply damping to stabilize the messages",
        "pick exemplars with positive combined self message",
        "assign each point to its strongest exemplar",
        "done: return exemplars and cluster assignments",
    ],
};

export default module;
