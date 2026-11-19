/**
 * kamada-kawai-layout.ts - Kamada-Kawai Graph Layout
 *
 * Draws a graph so that Euclidean distance between two vertices approximates
 * their graph-theoretic distance. It first computes all-pairs shortest paths,
 * turns them into ideal spring lengths, then minimizes the total stress with a
 * two-dimensional Newton step per vertex. Unlike a force-directed simulation
 * it uses an explicit energy function and second derivatives.
 *
 * Time O(n^3 + iterations * n^2), space O(n^2).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = { x: number; y: number };

function makePoints(labels: string[], pos: Pt[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return labels.map((label, index) => {
        const p = pos[index] ?? { x: 0, y: 0 };
        return {
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: [p.x, p.y],
            state: states.get(index) ?? "unvisited",
            x: p.x,
            y: p.y,
            width: 0,
            height: 0,
            metadata: { label, index },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; idealLength?: number } | null) ?? {};
    const graph = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "D"],
        C: ["A", "D"],
        D: ["B", "C", "E"],
        E: ["D"],
    };
    const L0 = typeof task.idealLength === "number" && task.idealLength > 0 ? task.idealLength : 60;
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])].sort();
    const n = labels.length;
    const indexOf = new Map(labels.map((label, i) => [label, i]));
    let step = 0;

    const edgePairs: Array<[number, number]> = [];
    const seen = new Set<string>();
    for (const [u, vs] of Object.entries(graph)) {
        const i = indexOf.get(u);
        if (i === undefined) continue;
        for (const v of vs) {
            const j = indexOf.get(v);
            if (j === undefined || i === j) continue;
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (seen.has(key)) continue;
            seen.add(key);
            edgePairs.push([Math.min(i, j), Math.max(i, j)]);
        }
    }
    const edges = edgePairs.map(([i, j]) => ({
        id: `edge-${labels[i]}-${labels[j]}`,
        sourceId: `node-${labels[i]}`,
        targetId: `node-${labels[j]}`,
        label: "",
        state: "idle" as const,
        directed: false,
    }));

    const frame = (
        pos: Pt[],
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        energy: number,
        iteration: number,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makePoints(labels, pos, states),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "point",
        meta: { energy, iteration, n, idealLength: L0 },
    });

    if (n === 0) {
        yield frame([], new Map(), "Empty graph - there is nothing to lay out.", 0, 0, 0);
        return;
    }

    // All-pairs shortest paths via Floyd-Warshall.
    const dist: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)),
    );
    for (const [i, j] of edgePairs) {
        dist[i]![j] = 1;
        dist[j]![i] = 1;
    }
    for (let k = 0; k < n; k += 1) {
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                const via = dist[i]![k]! + dist[k]![j]!;
                if (via < dist[i]![j]!) dist[i]![j] = via;
            }
        }
    }

    let maxFinite = 1;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            if (Number.isFinite(dist[i]![j]!)) maxFinite = Math.max(maxFinite, dist[i]![j]!);
        }
    }
    const ideal: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) =>
            Number.isFinite(dist[i]![j]!) ? L0 * dist[i]![j]! : L0 * (maxFinite + 2),
        ),
    );

    const pos: Pt[] = labels.map((_, i) => ({
        x: (n === 1 ? 0 : 120 * Math.cos((2 * Math.PI * i) / n)),
        y: (n === 1 ? 0 : 120 * Math.sin((2 * Math.PI * i) / n)),
    }));

    const energyOf = (p: Pt[]): number => {
        let energy = 0;
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                const dx = p[i]!.x - p[j]!.x;
                const dy = p[i]!.y - p[j]!.y;
                const d = Math.max(1e-6, Math.hypot(dx, dy));
                const diff = d - ideal[i]![j]!;
                energy += 0.5 * diff * diff;
            }
        }
        return energy;
    };

    yield frame(pos, new Map(), `Computed all-pairs graph distances; initial layout stress is ${energyOf(pos).toFixed(1)}.`, 1, energyOf(pos), 0);
    step += 1;

    const iterations = 40;
    for (let iter = 1; iter <= iterations; iter += 1) {
        for (let v = 0; v < n; v += 1) {
            let gx = 0;
            let gy = 0;
            let hxx = 0;
            let hyy = 0;
            let hxy = 0;
            for (let j = 0; j < n; j += 1) {
                if (j === v) continue;
                const dx = pos[v]!.x - pos[j]!.x;
                const dy = pos[v]!.y - pos[j]!.y;
                const d = Math.max(1e-6, Math.hypot(dx, dy));
                const L = ideal[v]![j]!;
                const f = (d - L) / d;
                gx += f * dx;
                gy += f * dy;
                const common = L / (d * d * d);
                hxx += 1 - L / d + common * dx * dx;
                hyy += 1 - L / d + common * dy * dy;
                hxy += common * dx * dy;
            }
            const det = hxx * hyy - hxy * hxy;
            if (!Number.isFinite(det) || Math.abs(det) < 1e-9) continue;
            let sx = (-gx * hyy + gy * hxy) / det;
            let sy = (gx * hxy - gy * hxx) / det;
            const mag = Math.hypot(sx, sy);
            const cap = 2 * L0;
            if (mag > cap) {
                sx = (sx / mag) * cap;
                sy = (sy / mag) * cap;
            }
            pos[v] = { x: pos[v]!.x + 0.6 * sx, y: pos[v]!.y + 0.6 * sy };
        }
        if (iter % 4 === 0 || iter === iterations) {
            const energy = energyOf(pos);
            const states = new Map<number, EntityState>();
            states.set(iter % n, "active");
            yield frame(
                pos,
                states,
                `Iteration ${iter}: Newton steps reduce graph-distance stress to ${energy.toFixed(1)}.`,
                4,
                energy,
                iter,
            );
            step += 1;
        }
    }

    const finalEnergy = energyOf(pos);
    const done = new Map<number, EntityState>(labels.map((_, i) => [i, "sorted"] as [number, EntityState]));
    yield frame(
        pos,
        done,
        `Kamada-Kawai placed ${n} vertices with final stress ${finalEnergy.toFixed(1)}.`,
        6,
        finalEnergy,
        iterations,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A good drawing keeps vertices that are close in the graph close on the screen. Kamada and Kawai turn every shortest-path distance into a target Euclidean distance, then treat the mismatch between target and actual distance as spring energy. Each vertex is moved by a Newton step that uses both the slope and the curvature of its share of the energy, which converges much faster than moving by gradient alone.",
        invariants: [
            "The shortest-path distances are computed once and never change during optimization.",
            "The stress energy decreases or stays flat after a damped Newton step.",
            "Every vertex has finite coordinates at every iteration.",
        ],
        correctness:
            "The energy is the sum of squared deviations between actual and ideal distances, so it is nonnegative and minimized when the drawing matches all graph distances exactly. Solving the 2 by 2 Newton system gives the stationary direction of that vertex's energy contribution, and damping plus a step cap keeps the update finite. Repeated minimization lowers total stress, producing a drawing that preserves graph distances as closely as the geometry allows.",
        complexityRationale:
            "Floyd-Warshall computes all-pairs shortest paths in O(n^3) time and O(n^2) space. Each of the fixed number of optimization passes updates n vertices, each scanning all n others, for O(iterations * n^2) additional time, and the ideal-distance matrix uses O(n^2) space.",
        uses: [
            "Automatic graph drawing and visualization tools",
            "Laying out social and dependency networks for readability",
            "Preserving hop distances when embedding graphs in two dimensions",
        ],
        references: [
            "Kamada and Kawai, An Algorithm for Drawing General Undirected Graphs, Information Processing Letters, 1989",
            "di Battista, Eades, Tamassia and Tollis, Graph Drawing, Chapter on force-directed methods",
        ],
        workedExample:
            "For a path A-B-C-D with ideal edge length 60, the shortest-path targets are 60, 120 and 180. Starting from a circle, the Newton steps stretch the path until adjacent vertices sit about 60 units apart and the endpoints about 180 units apart, driving the stress toward zero.",
    },
    id: "kamada-kawai-layout",
    name: "Kamada-Kawai Layout",
    category: "graph",
    complexity: { time: "O(n³ + iterations·n²)", space: "O(n²)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["A", "D"], C: ["A", "D"], D: ["B", "C", "E"], E: ["D"] } },
    visualType: "point",
    run,
    pseudocode: [
        "compute all-pairs shortest paths on the graph",
        "set each ideal distance to length times hop count",
        "seed vertices on a circle at finite positions",
        "for each vertex sum the stress gradient and Hessian",
        "solve the two by two Newton system for a step",
        "damp the step and move the vertex",
        "repeat for a fixed number of passes",
        "done: vertices approximate their graph distances",
    ],
};

export default module;
