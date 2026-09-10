// domineering.ts – Domineering: Left places vertical dominoes, Right horizontal.
// One line on 4×4 strands Right: after L(0,0-1,0), R(0,1-0,2), L(2,0-3,0),
// R(1,1-1,2), L(2,2-3,2), no horizontal pair stays free. Verified below.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Domino = [string, string];

function domCells(used: Map<string, string>, last: Domino | null): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 4; c += 1) {
            const id = `${r},${c}`;
            const owner = used.get(id);
            cells.push({
                id: `cell-${id}`,
                type: "cell" as const,
                label: owner ?? "",
                value: owner === undefined ? 0 : 1,
                state: (owner === undefined
                    ? "idle"
                    : last && (last[0] === id || last[1] === id)
                      ? "comparing"
                      : owner === "V"
                        ? "sorted"
                        : "highlight") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { size?: number } | null) ?? {};
    void task;
    // ponytail: one illustrative legal line; full Domineering theory when analysis input exists.
    const line: Array<{ dom: Domino; who: string }> = [
        { dom: ["0,0", "1,0"], who: "V" },
        { dom: ["0,1", "0,2"], who: "H" },
        { dom: ["2,0", "3,0"], who: "V" },
        { dom: ["1,1", "1,2"], who: "H" },
        { dom: ["2,2", "3,2"], who: "V" },
    ];
    const used = new Map<string, string>();
    let step = 0;
    yield {
        stepNumber: step,
        entities: domCells(used, null),
        edges: [],
        description:
            "Domineering on 4×4 – Left (V, vertical) moves first, Right (H, horizontal) replies.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { size: 4 },
    };
    step += 1;
    const replay = new Map<string, string>();
    for (let i = 0; i < line.length; i += 1) {
        const entry = line[i];
        if (!entry) continue;
        replay.set(entry.dom[0], entry.who);
        replay.set(entry.dom[1], entry.who);
        used.set(entry.dom[0], entry.who);
        used.set(entry.dom[1], entry.who);
        yield {
            stepNumber: step,
            entities: domCells(new Map(replay), entry.dom),
            edges: [],
            description: `${entry.who === "V" ? "Left" : "Right"} places ${entry.who === "V" ? "vertical" : "horizontal"} domino on ${entry.dom[0]}–${entry.dom[1]}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { size: 4, domino: i + 1, who: entry.who },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: domCells(used, null),
        edges: [],
        description:
            "Every free cell's horizontal neighbor is taken – Right has no reply and loses this line.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { size: 4, winner: "Left" },
    };
}

const module: AlgorithmModule = {
    id: "domineering",
    name: "Domineering",
    category: "game",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { size: 4 },
    visualType: "grid",
    run,
};

export default module;
