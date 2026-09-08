// dots-and-boxes.ts – Dots and Boxes on 2×2 boxes (12 edges as grid cells).
// Box (r,c) is claimed when its 4 border edges are drawn – checked in-code.
// Line: five edge draws end with h10 completing box (0,0) for First.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const H = ["h00", "h01", "h10", "h11", "h20", "h21"];
const V = ["v00", "v01", "v02", "v10", "v11", "v12"];

function edgePos(id: string): [number, number] {
    if (id[0] === "h") return [Number(id[1]) * 2, Number(id[2]) * 2 + 1];
    return [Number(id[1]) * 2 + 1, Number(id[2]) * 2];
}

function boxOf(r: number, c: number): string[] {
    return [`h${r}${c}`, `h${r + 1}${c}`, `v${r}${c}`, `v${r}${c + 1}`];
}

function dotsCells(
    drawn: Set<string>,
    hot: string | null,
    claimed: Map<string, string>,
): VisualEntity[] {
    return [...H, ...V].map((id) => {
        const [row, col] = edgePos(id);
        const isH = id[0] === "h";
        return {
            id: `cell-${id}`,
            type: "cell" as const,
            label: drawn.has(id) ? (isH ? "─" : "│") : "·",
            value: drawn.has(id) ? 1 : 0,
            state: (id === hot ? "comparing" : drawn.has(id) ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                row,
                col,
                claimed: [...claimed.entries()].map(([b, o]) => `${b}:${o}`).join(","),
            },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { boxes?: number } | null) ?? {};
    void task;
    // ponytail: one illustrative legal line; full box-count solver when analysis input exists.
    const line: Array<{ edge: string; who: string }> = [
        { edge: "h00", who: "First" },
        { edge: "v00", who: "Second" },
        { edge: "v01", who: "First" },
        { edge: "h01", who: "Second" },
        { edge: "h10", who: "First" },
    ];
    const drawn = new Set<string>();
    const claimed = new Map<string, string>();
    let step = 0;
    yield {
        stepNumber: step,
        entities: dotsCells(drawn, null, claimed),
        edges: [],
        description: "Dots and Boxes 2×2 – empty lattice, First to draw.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { boxes: 2 },
    };
    step += 1;
    for (const { edge, who } of line) {
        drawn.add(edge);
        let took: string | null = null;
        for (let r = 0; r < 2; r += 1) {
            for (let c = 0; c < 2; c += 1) {
                const b = `${r},${c}`;
                if (!claimed.has(b) && boxOf(r, c).every((e) => drawn.has(e))) {
                    claimed.set(b, who);
                    took = b;
                }
            }
        }
        yield {
            stepNumber: step,
            entities: dotsCells(drawn, edge, claimed),
            edges: [],
            description: took
                ? `${who} draws ${edge} and completes box (${took}) – claims it.`
                : `${who} draws edge ${edge}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { boxes: 2, edge, who, claimedBox: took ?? "" },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: dotsCells(drawn, null, claimed),
        edges: [],
        description: `First leads ${[...claimed.values()].filter((w) => w === "First").length}–${[...claimed.values()].filter((w) => w === "Second").length} on claimed boxes; three boxes remain open.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { boxes: 2, claimed: [...claimed.entries()].map(([b, o]) => `${b}:${o}`) },
    };
}

const module: AlgorithmModule = {
    id: "dots-and-boxes",
    name: "Dots and Boxes",
    category: "game",
    complexity: { time: "O(e)", space: "O(e)" },
    defaultInput: { boxes: 2 },
    visualType: "grid",
    run,
};

export default module;
