/**
 * rectangle-union-klee-measure-sweep.ts – Klee's measure (rectangle union).
 * Sweeps distinct x-edges; in each vertical slab the active y-intervals merge
 * and area += width·coveredHeight. O(n²) on tiny inputs, exact.
 * Layout "point": rectangle corners carry true coords; slab edges shown.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Rect = [number, number, number, number];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { rects?: Rect[] } | null) ?? {};
    const rects: Rect[] = task.rects ?? [
        [0, 0, 2, 2],
        [1, 1, 3, 3],
        [2, 0, 4, 1],
    ];
    let step = 0;
    const corners = (states: Map<string, EntityState> = new Map()): VisualEntity[] =>
        rects.flatMap(([x0, y0, x1, y1], r) =>
            [
                [x0, y0],
                [x1, y0],
                [x1, y1],
                [x0, y1],
            ].map(([x, y], c) => ({
                id: `r${r}-c${c}`,
                type: "node" as const,
                label: `R${r}(${x},${y})`,
                value: [x, y],
                state: states.get(`r${r}-c${c}`) ?? "unvisited",
                x,
                y,
                width: 0,
                height: 0,
                metadata: { rect: r, corner: c },
            })),
        );
    const outlines = (): VisualEdge[] =>
        rects.flatMap((_, r) =>
            [0, 1, 2, 3].map((c) => ({
                id: `ro-${r}-${c}`,
                sourceId: `r${r}-c${c}`,
                targetId: `r${r}-c${(c + 1) % 4}`,
                label: "",
                state: "idle",
                directed: false,
            })),
        );
    if (rects.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No rectangles – union area is 0.",
            codeLineNumber: 0,
            layout: "point",
            meta: { area: 0 },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: corners(),
        edges: outlines(),
        description: `Klee sweep over ${rects.length} rectangles – collecting x-events.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const xs = [...new Set(rects.flatMap(([x0, , x1]) => [x0, x1]))].sort((a, b) => a - b);
    let area = 0;
    for (let s = 0; s < xs.length - 1; s += 1) {
        const x0 = xs[s] as number;
        const x1 = xs[s + 1] as number;
        const ivals = rects
            .filter(([rx0, , rx1]) => rx0 <= x0 && rx1 >= x1)
            .map(([, y0, , y1]) => [y0, y1] as [number, number])
            .sort((a, b) => a[0] - b[0]);
        let covered = 0;
        let cur0 = -Infinity;
        let cur1 = -Infinity;
        for (const [y0, y1] of ivals) {
            if (y0 > cur1) {
                covered += Math.max(0, cur1 - cur0);
                cur0 = y0;
                cur1 = y1;
            } else cur1 = Math.max(cur1, y1);
        }
        covered += Math.max(0, cur1 - cur0);
        area += (x1 - x0) * covered;
        const st = new Map<string, EntityState>();
        rects.forEach(([rx0, , rx1], r) => {
            if (rx0 <= x0 && rx1 >= x1)
                for (let c = 0; c < 4; c += 1) st.set(`r${r}-c${c}`, "active");
        });
        yield {
            stepNumber: step,
            entities: corners(st),
            edges: outlines(),
            description: `Slab [${x0}, ${x1}]: covered y=${covered}, running area=${area}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: corners(
            new Map(
                rects.flatMap((_, r) =>
                    [0, 1, 2, 3].map((c) => [`r${r}-c${c}`, "sorted"] as [string, EntityState]),
                ),
            ),
        ),
        edges: outlines(),
        description: `Union area = ${area}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { area },
    };
}

const module: AlgorithmModule = {
    id: "rectangle-union-klee-measure-sweep",
    name: "Rectangle Union (Klee Measure Sweep)",
    category: "geometry",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: {
        rects: [
            [0, 0, 2, 2],
            [1, 1, 3, 3],
            [2, 0, 4, 1],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
