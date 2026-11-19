/**
 * lemke-howson-nash.ts - Lemke-Howson Algorithm for Bimatrix Nash Equilibrium
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Lemke-Howson algorithm finds a mixed-strategy Nash equilibrium of a
 * two-player game by walking along edges of two best-response polytopes. Each
 * vertex carries labels: a pure strategy that is unused, or an opponent pure
 * strategy that is a best response. A pair of vertices whose labels together
 * cover every strategy is an equilibrium after normalization. Starting from
 * the origin, we drop one label, pivot along the unique edge that drops it,
 * and alternate polytopes on the duplicated label until the pair is fully
 * labelled again.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(number of pivots) - exponential in the worst case, constant for
 *          the 2x2 games visualized here
 *   Space: O(V + E) for the polytope vertices and their adjacency
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are the vertices of the two best-response polytopes.
 *   - Edges connect adjacent vertices; the highlighted edge joins the current pair.
 *   - The final green node pair is the fully labelled equilibrium.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Label = "R0" | "R1" | "C0" | "C1";
type Constraint = { a: number; b: number; rhs: number; label: Label };
type Vertex = {
    id: string;
    poly: "P" | "Q";
    x0: number;
    x1: number;
    labels: Set<Label>;
    adjacency: string[];
};

const ALL_LABELS: Label[] = ["R0", "R1", "C0", "C1"];
const TOL = 1e-8;

/** Solve a two-by-two linear system, returning null for singular systems. */
function solve2(a: number, b: number, c: number, d: number, e: number, f: number): [number, number] | null {
    const det = a * d - b * c;
    if (Math.abs(det) < TOL) return null;
    return [(e * d - b * f) / det, (a * f - e * c) / det];
}

/** Enumerate feasible vertices of a two-dimensional best-response polytope. */
function verticesOf(poly: "P" | "Q", A: number[][], B: number[][]): Vertex[] {
    // Feasible region is written as a·x ≤ rhs, so nonnegativity x_i ≥ 0 is
    // stored with a negative coefficient. A label is active when the
    // corresponding inequality is tight (x_i = 0 or an opponent best response).
    const constraints: Constraint[] = poly === "P"
        ? [
              { a: -1, b: 0, rhs: 0, label: "R0" },
              { a: 0, b: -1, rhs: 0, label: "R1" },
              { a: B[0]?.[0] ?? 0, b: B[1]?.[0] ?? 0, rhs: 1, label: "C0" },
              { a: B[0]?.[1] ?? 0, b: B[1]?.[1] ?? 0, rhs: 1, label: "C1" },
          ]
        : [
              { a: -1, b: 0, rhs: 0, label: "C0" },
              { a: 0, b: -1, rhs: 0, label: "C1" },
              { a: A[0]?.[0] ?? 0, b: A[0]?.[1] ?? 0, rhs: 1, label: "R0" },
              { a: A[1]?.[0] ?? 0, b: A[1]?.[1] ?? 0, rhs: 1, label: "R1" },
          ];

    const found: Vertex[] = [];
    for (let i = 0; i < constraints.length; i += 1) {
        for (let j = i + 1; j < constraints.length; j += 1) {
            const c1 = constraints[i];
            const c2 = constraints[j];
            if (!c1 || !c2) continue;
            const point = solve2(c1.a, c1.b, c2.a, c2.b, c1.rhs, c2.rhs);
            if (!point) continue;
            const [x0, x1] = point;
            if (x0 < -TOL || x1 < -TOL) continue;
            if (constraints.some((c) => c.a * x0 + c.b * x1 > c.rhs + TOL)) continue;
            const labels = new Set<Label>([c1.label, c2.label]);
            // In two dimensions any shared active constraint gives an edge.
            found.push({
                id: `${poly}-${found.length}`,
                poly,
                x0: Math.max(0, x0),
                x1: Math.max(0, x1),
                labels,
                adjacency: [],
            });
        }
    }
    for (const v of found) {
        for (const w of found) {
            if (v === w) continue;
            const shared = [...v.labels].filter((label) => w.labels.has(label));
            if (shared.length === 1) v.adjacency.push(w.id);
        }
    }
    return found;
}

/** Find a vertex whose label set is exactly the given pair. */
function byLabels(vertices: Vertex[], wanted: Label[]): Vertex | undefined {
    return vertices.find((v) => wanted.every((l) => v.labels.has(l)) && v.labels.size === wanted.length);
}

/** Normalize a nonnegative pair into a probability distribution. */
function normalize(a: number, b: number): [number, number] {
    const sum = a + b;
    return sum > TOL ? [a / sum, b / sum] : [0.5, 0.5];
}

/** Expected payoff of a mixed strategy profile. */
function payoff(M: number[][], x: number[], y: number[]): number {
    let total = 0;
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            total += (x[i] ?? 0) * (M[i]?.[j] ?? 0) * (y[j] ?? 0);
        }
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { A?: number[][]; B?: number[][] } | null) ?? {};
    const A = Array.isArray(task.A) && task.A.length === 2 && task.A.every((r) => Array.isArray(r) && r.length === 2)
        ? task.A
        : [[3, 1], [1, 3]];
    const B = Array.isArray(task.B) && task.B.length === 2 && task.B.every((r) => Array.isArray(r) && r.length === 2)
        ? task.B
        : [[1, 3], [3, 1]];

    const pVertices = verticesOf("P", A, B);
    const qVertices = verticesOf("Q", A, B);
    const allVertices = [...pVertices, ...qVertices];
    const byId = new Map(allVertices.map((v) => [v.id, v]));

    const entityView = (p: Vertex, q: Vertex, visited: Set<string>, done: boolean): VisualEntity[] =>
        allVertices.map((v) => {
            const chosen = v.id === p.id || v.id === q.id;
            const state: EntityState = chosen
                ? (done ? "sorted" : "active")
                : (visited.has(v.id) ? "visited" : "idle");
            return {
                id: v.id,
                type: "node" as const,
                label: `${v.poly}(${v.x0.toFixed(2)},${v.x1.toFixed(2)})`,
                value: [v.x0, v.x1],
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: {
                    polytope: v.poly,
                    labels: [...v.labels].join(","),
                    x0: v.x0,
                    x1: v.x1,
                },
            };
        });

    const edgeView = (p: Vertex, q: Vertex): VisualFrame["edges"] => {
        const edges: VisualFrame["edges"] = [];
        for (const v of allVertices) {
            for (const targetId of v.adjacency) {
                if (v.id >= targetId) continue;
                edges.push({
                    id: `edge-${v.id}-${targetId}`,
                    sourceId: v.id,
                    targetId,
                    label: "",
                    state: "idle",
                    directed: false,
                });
            }
        }
        edges.push({
            id: "current-pair",
            sourceId: p.id,
            targetId: q.id,
            label: "pair",
            state: "path",
            directed: false,
        });
        return edges;
    };

    let step = 0;
    const p0 = byLabels(pVertices, ["R0", "R1"]);
    const q0 = byLabels(qVertices, ["C0", "C1"]);
    if (!p0 || !q0) {
        yield {
            stepNumber: step,
            entities: entityView(pVertices[0] ?? p0 ?? { id: "P-0", poly: "P", x0: 0, x1: 0, labels: new Set(), adjacency: [] },
                qVertices[0] ?? q0 ?? { id: "Q-0", poly: "Q", x0: 0, x1: 0, labels: new Set(), adjacency: [] },
                new Set(), false),
            edges: [],
            description: "Degenerate payoff matrices: no initial origin vertex exists to start the Lemke-Howson path.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { equilibrium: false, pivots: 0 },
        };
        return;
    }

    let p = p0;
    let q = q0;
    const visited = new Set<string>([p.id, q.id]);
    yield {
        stepNumber: step,
        entities: entityView(p, q, visited, false),
        edges: edgeView(p, q),
        description: "Start at the origin pair; drop label R0 and pivot in the row polytope.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { equilibrium: false, pivots: 0, p: [p.x0, p.x1], q: [q.x0, q.x1] },
    };
    step += 1;

    let dropped: Label = "R0";
    let inP = true;
    let pivots = 0;
    let fullyLabeled = false;

    for (let iteration = 0; iteration < 16; iteration += 1) {
        const current = inP ? p : q;
        const neighbors = current.adjacency
            .map((id) => byId.get(id))
            .filter((v): v is Vertex => Boolean(v) && !(v as Vertex).labels.has(dropped));
        const next = neighbors[0];
        if (!next) break;

        const gained = [...next.labels].find((l) => !current.labels.has(l));
        if (inP) p = next;
        else q = next;
        visited.add(next.id);
        pivots += 1;

        const union = new Set<Label>([...p.labels, ...q.labels]);
        fullyLabeled = ALL_LABELS.every((l) => union.has(l));
        yield {
            stepNumber: step,
            entities: entityView(p, q, visited, fullyLabeled),
            edges: edgeView(p, q),
            description: fullyLabeled
                ? `Pivot ${pivots}: the pair is fully labelled; gained ${gained ?? "none"} and reached an equilibrium.`
                : `Pivot ${pivots}: gained label ${gained ?? "none"} in the ${inP ? "row" : "column"} polytope and dropped ${dropped}.`,
            codeLineNumber: fullyLabeled ? 6 : (inP ? 3 : 5),
            layout: "graph",
            meta: {
                equilibrium: fullyLabeled,
                pivots,
                p: [p.x0, p.x1],
                q: [q.x0, q.x1],
                dropped,
                gained: gained ?? "",
            },
        };
        step += 1;

        if (fullyLabeled) break;

        const duplicate = [...p.labels].find((l) => q.labels.has(l));
        if (!duplicate) break;
        dropped = duplicate;
        inP = !inP;
    }

    const x = normalize(p.x0, p.x1);
    const y = normalize(q.x0, q.x1);
    const rowPayoff = payoff(A, x, y);
    const colPayoff = payoff(B, x, y);
    // A best response cannot be improved by deviating to either pure strategy.
    const rowBest = Math.max(
        (A[0]?.[0] ?? 0) * y[0] + (A[0]?.[1] ?? 0) * y[1],
        (A[1]?.[0] ?? 0) * y[0] + (A[1]?.[1] ?? 0) * y[1],
    );
    const colBest = Math.max(
        x[0] * (B[0]?.[0] ?? 0) + x[1] * (B[1]?.[0] ?? 0),
        x[0] * (B[0]?.[1] ?? 0) + x[1] * (B[1]?.[1] ?? 0),
    );
    const equilibrium = fullyLabeled && rowPayoff >= rowBest - 1e-6 && colPayoff >= colBest - 1e-6;

    yield {
        stepNumber: step,
        entities: entityView(p, q, visited, equilibrium),
        edges: edgeView(p, q),
        description: equilibrium
            ? `Nash equilibrium found: row plays (${x[0].toFixed(3)}, ${x[1].toFixed(3)}), column plays (${y[0].toFixed(3)}, ${y[1].toFixed(3)}).`
            : "No fully labelled pair was reached; the game may be degenerate.",
        codeLineNumber: 7,
        layout: "graph",
        meta: {
            equilibrium,
            pivots,
            rowStrategy: x,
            columnStrategy: y,
            rowPayoff,
            colPayoff,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Nash equilibrium is a pair of mixed strategies where neither player can gain by changing strategy alone. Lemke and Howson turned this into a walk: draw each player's best-response polytope, label every facet with a pure strategy, and follow edges from the origin until a pair of vertices shares no missing label. That fully labelled pair is the equilibrium.",
        invariants: [
            "Each vertex of a polytope carries exactly two labels in the two-by-two case.",
            "A pivot removes the dropped label and adds exactly one new label.",
            "At every intermediate pair one label is missing and one label is duplicated.",
        ],
        correctness:
            "A fully labelled vertex pair satisfies the best-response conditions: every pure strategy in a player's support is a best response to the opponent's mixed strategy, so no unilateral deviation can raise that player's payoff. The path is unique because a simple polytope has exactly one edge leaving a vertex when a given label is dropped, and the walk terminates at a second fully labelled pair, which differs from the artificial origin.",
        complexityRationale:
            "Each step is a single pivot along one polytope edge. The number of pivots can be exponential in the strategy counts in the worst case, but for the two-by-two games shown here the walk visits at most the handful of vertices of the two quadrilaterals, so each step is constant work.",
        uses: [
            "Computing an equilibrium of a two-player normal-form game",
            "A constructive proof that every bimatrix game has a Nash equilibrium",
            "A teaching bridge between linear complementarity and game theory",
        ],
        references: [
            "Lemke and Howson, Equilibrium Points of Bimatrix Games (1964)",
            "von Neumann and Morgenstern, Theory of Games and Economic Behavior (1944)",
        ],
        workedExample:
            "In matching pennies shifted to positive payoffs, the origin pair is dropped at label R0. The walk pivots through the row and column quadrilaterals, alternating on duplicated labels, and reaches the two central vertices whose normalized coordinates are (0.5, 0.5) for each player, the unique mixed equilibrium.",
    },
    id: "lemke-howson-nash",
    name: "Lemke-Howson Nash Equilibrium",
    category: "game",
    complexity: { time: "O(pivots)", space: "O(V + E)" },
    defaultInput: { A: [[3, 1], [1, 3]], B: [[1, 3], [3, 1]] },
    visualType: "graph",
    run,
    pseudocode: [
        "build the row and column best-response polytopes",
        "label each facet by a pure strategy of either player",
        "start at the origin pair and drop row label zero",
        "pivot in the active polytope along the edge dropping that label",
        "gained label becomes the duplicate to drop in the other polytope",
        "alternate polytopes on the duplicated label",
        "stop when the vertex pair carries every label",
        "normalize both vertices into mixed strategies",
        "report the equilibrium and expected payoffs",
    ],
};

export default module;
