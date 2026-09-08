/**
 * cohen-sutherland-line-clipping.ts – Cohen–Sutherland: 4-bit outcodes,
 * trivial accept/reject, then iterative endpoint clipping. Default clips
 * (−1,2)→(6,3) to (0,15/7)→(4,19/7).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function node(id: string, x: number, y: number, label: string, state: EntityState): VisualEntity {
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
    const task =
        (input as {
            segment?: [Pt, Pt];
            window?: { minX: number; minY: number; maxX: number; maxY: number };
        } | null) ?? {};
    const seg: [Pt, Pt] = task.segment ?? [
        [-1, 2],
        [6, 3],
    ];
    const win = task.window ?? { minX: 0, minY: 0, maxX: 4, maxY: 4 };
    let step = 0;
    const code = (p: Pt) =>
        (p[0] < win.minX ? 1 : 0) |
        (p[0] > win.maxX ? 2 : 0) |
        (p[1] < win.minY ? 4 : 0) |
        (p[1] > win.maxY ? 8 : 0);
    const show = (a: Pt, b: Pt, desc: string, c: number, st: EntityState) => ({
        stepNumber: step,
        entities: [
            node("a", a[0], a[1], "a", st),
            node("b", b[0], b[1], "b", st),
            node("w0", win.minX, win.minY, "", "idle"),
            node("w1", win.maxX, win.maxY, "", "idle"),
        ],
        edges: [
            {
                id: `s-${step}`,
                sourceId: "a",
                targetId: "b",
                label: "",
                state: "path" as EntityState,
                directed: false,
            },
        ],
        description: desc,
        codeLineNumber: c,
        layout: "point" as const,
        meta: {} as VisualFrame["meta"],
    });
    let [a, b] = seg;
    yield show(
        a,
        b,
        `Segment (${a})→(${b}); outcodes ${code(a).toString(2)}/${code(b).toString(2)}.`,
        0,
        "highlight",
    );
    step += 1;
    let guard = 0;
    for (;;) {
        const ca = code(a),
            cb = code(b);
        if ((ca | cb) === 0) {
            yield show(a, b, "Trivial accept – both endpoints inside.", 1, "comparing");
            step += 1;
            break;
        }
        if ((ca & cb) !== 0) {
            yield {
                stepNumber: step,
                entities: [
                    node("a", a[0], a[1], "a", "swapped"),
                    node("b", b[0], b[1], "b", "swapped"),
                ],
                edges: [],
                description: "Trivial reject – shared outside bit.",
                codeLineNumber: 1,
                layout: "point",
                meta: { clipped: "none" },
            };
            return;
        }
        const out = ca !== 0 ? ca : cb;
        let x = 0,
            y = 0;
        if (out & 8) {
            x = a[0] + ((b[0] - a[0]) * (win.maxY - a[1])) / (b[1] - a[1]);
            y = win.maxY;
        } else if (out & 4) {
            x = a[0] + ((b[0] - a[0]) * (win.minY - a[1])) / (b[1] - a[1]);
            y = win.minY;
        } else if (out & 2) {
            y = a[1] + ((b[1] - a[1]) * (win.maxX - a[0])) / (b[0] - a[0]);
            x = win.maxX;
        } else {
            y = a[1] + ((b[1] - a[1]) * (win.minX - a[0])) / (b[0] - a[0]);
            x = win.minX;
        }
        if (ca !== 0) a = [x, y];
        else b = [x, y];
        yield show(
            a,
            b,
            `Clipped one endpoint → (${a.map((v) => v.toFixed(2))})→(${b.map((v) => v.toFixed(2))}).`,
            2,
            "comparing",
        );
        step += 1;
        if (++guard > 5) break;
    }
    yield {
        stepNumber: step,
        entities: [
            node("a", a[0], a[1], "a", "sorted"),
            node("b", b[0], b[1], "b", "sorted"),
            node("w0", win.minX, win.minY, "", "idle"),
            node("w1", win.maxX, win.maxY, "", "idle"),
        ],
        edges: [
            {
                id: "final",
                sourceId: "a",
                targetId: "b",
                label: "",
                state: "path" as EntityState,
                directed: false,
            },
        ],
        description: `Visible part (${a.map((v) => v.toFixed(2))})→(${b.map((v) => v.toFixed(2))}).`,
        codeLineNumber: 3,
        layout: "point",
        meta: { clipped: [a, b].map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "cohen-sutherland-line-clipping",
    name: "Cohen–Sutherland Line Clipping",
    category: "geometry",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: {
        segment: [
            [-1, 2],
            [6, 3],
        ],
        window: { minX: 0, minY: 0, maxX: 4, maxY: 4 },
    },
    visualType: "graph",
    run,
};

export default module;
