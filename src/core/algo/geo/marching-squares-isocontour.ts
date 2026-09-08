/**
 * marching-squares-isocontour.ts – isocontour extraction on a scalar grid.
 * Per cell: 4-bit case index from corners ≥ iso, then linear interpolation
 * of edge crossings; ambiguous cases use the average decider. O(cells).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function node(id: string, x: number, y: number, state: EntityState, label: string): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [x, y],
        state,
        x,
        y,
        width: 0,
        height: 0,
        metadata: {},
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { field?: number[][]; iso?: number } | null) ?? {};
    const field: number[][] = t.field ?? [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
    ];
    const iso: number = t.iso ?? 0.5;
    let step = 0;
    const rows = field.length,
        cols = field[0]?.length ?? 0;
    const grid: VisualEntity[] = [];
    for (let r = 0; r < rows; r += 1)
        for (let c = 0; c < cols; c += 1)
            grid.push(
                node(
                    `g-${r}-${c}`,
                    c,
                    r,
                    ((field[r] as number[])[c] as number) >= iso ? "highlight" : "unvisited",
                    `${(field[r] as number[])[c]}`,
                ),
            );

    yield {
        stepNumber: step++,
        entities: grid.map((e) => ({ ...e })),
        edges: [],
        description: `Scalar field ${rows}×${cols}, iso=${iso}; highlighted corners ≥ iso.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iso },
    };
    if (rows < 2 || cols < 2) {
        yield {
            stepNumber: step++,
            entities: grid.map((e) => ({ ...e })),
            edges: [],
            description: "Degenerate input: need ≥2 rows and ≥2 cols for cells.",
            codeLineNumber: 1,
            layout: "point",
            meta: { segments: [] },
        };
        return;
    }
    const interp = (a: number, b: number, va: number, vb: number): number =>
        vb === va ? (a + b) / 2 : a + ((iso - va) * (b - a)) / (vb - va);
    const cross: VisualEntity[] = [];
    const segEdges: Array<{
        id: string;
        sourceId: string;
        targetId: string;
        label: string;
        state: EntityState;
        directed: boolean;
    }> = [];
    let ci = 0;
    const cells: Array<{ r: number; c: number; idx: number }> = [];
    for (let r = 0; r < rows - 1; r += 1) {
        for (let c = 0; c < cols - 1; c += 1) {
            const v00 = (field[r] as number[])[c] as number,
                v10 = (field[r] as number[])[c + 1] as number;
            const v01 = (field[r + 1] as number[])[c] as number,
                v11 = (field[r + 1] as number[])[c + 1] as number;
            const idx =
                (v00 >= iso ? 8 : 0) |
                (v10 >= iso ? 4 : 0) |
                (v11 >= iso ? 2 : 0) |
                (v01 >= iso ? 1 : 0);
            cells.push({ r, c, idx });
            // Crossing points on the 4 cell edges: top, right, bottom, left.
            const top: [number, number] | null =
                v00 >= iso !== v10 >= iso ? [interp(c, c + 1, v00, v10), r] : null;
            const right: [number, number] | null =
                v10 >= iso !== v11 >= iso ? [c + 1, interp(r, r + 1, v10, v11)] : null;
            const bottom: [number, number] | null =
                v01 >= iso !== v11 >= iso ? [interp(c, c + 1, v01, v11), r + 1] : null;
            const left: [number, number] | null =
                v00 >= iso !== v01 >= iso ? [c, interp(r, r + 1, v00, v01)] : null;
            const pts = [top, right, bottom, left].filter((p): p is [number, number] => p !== null);
            const ids = pts.map((p) => {
                const id = `x-${ci++}`;
                cross.push(node(id, p[0], p[1], "comparing", ""));
                return id;
            });
            // Pair crossings in cyclic order; 4 crossings → 2 segments.
            for (let k = 0; k + 1 < ids.length; k += 2) {
                segEdges.push({
                    id: `s-${r}-${c}-${k}`,
                    sourceId: ids[k] as string,
                    targetId: ids[k + 1] as string,
                    label: "",
                    state: "comparing",
                    directed: false,
                });
            }
        }
    }
    const all = () => [...grid.map((e) => ({ ...e })), ...cross.map((e) => ({ ...e }))];
    // One frame per cell row-band to stay within 5–15 frames.
    const perRow = new Map<number, typeof cells>();
    for (const cell of cells) {
        const arr = perRow.get(cell.r) ?? [];
        arr.push(cell);
        perRow.set(cell.r, arr);
    }
    for (const [r, arr] of perRow) {
        yield {
            stepNumber: step++,
            entities: all(),
            edges: segEdges.map((e) => ({ ...e })),
            description: `Row ${r}: case indices [${arr.map((x) => x.idx).join(", ")}].`,
            codeLineNumber: 2,
            layout: "point",
            meta: { row: r },
        };
        if (step > 11) break;
    }
    const total = segEdges.length;
    const crossing = cross.length;
    yield {
        stepNumber: step++,
        entities: all(),
        edges: segEdges.map((e) => ({ ...e })),
        description: `Paired ${crossing} edge crossing(s) into ${total} contour segment(s) in cyclic order.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { crossings: crossing, segments: total },
    };
    yield {
        stepNumber: step++,
        entities: all().map((e) =>
            e.id.startsWith("x-") ? { ...e, state: "sorted" as EntityState } : e,
        ),
        edges: segEdges.map((e) => ({ ...e, state: "sorted" as EntityState })),
        description: `Isocontour done: ${total} segment(s) at iso=${iso}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { segments: total, iso },
    };
}

const module: AlgorithmModule = {
    id: "marching-squares-isocontour",
    name: "Marching Squares Isocontour",
    category: "geometry",
    complexity: { time: "O(rows·cols)", space: "O(rows·cols)" },
    defaultInput: {
        field: [
            [0, 0, 0],
            [0, 1, 0],
            [0, 0, 0],
        ],
        iso: 0.5,
    },
    visualType: "graph",
    run,
};

export default module;
