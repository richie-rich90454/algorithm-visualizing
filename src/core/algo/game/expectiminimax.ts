// expectiminimax.ts – Expectiminimax on a tiny game-vs-chance tree.
// MAX root picks between chance nodes C1 (leaves 10, 0 → EV 5) and C2
// (leaves 8, 4 → EV 6); expected values are computed, so MAX takes C2.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function tnode(
    id: string,
    label: string,
    parent: string | null,
    state: EntityState = "idle",
    value = 0,
): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: parent ?? "root" },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { leaves?: number[] } | null) ?? {};
    const raw = Array.isArray(task.leaves) ? task.leaves : [10, 0, 8, 4];
    const leaves = [0, 1, 2, 3].map((i) =>
        typeof raw[i] === "number" ? (raw[i] as number) : ([10, 0, 8, 4][i] as number),
    );
    const ev1 = ((leaves[0] as number) + (leaves[1] as number)) / 2;
    const ev2 = ((leaves[2] as number) + (leaves[3] as number)) / 2;
    const pick = ev1 >= ev2 ? "C1" : "C2";
    const best = Math.max(ev1, ev2);
    let step = 0;
    const skeleton = [
        tnode("root", "MAX", null),
        tnode("c1", "CHANCE ½", "root"),
        tnode("c2", "CHANCE ½", "root"),
        tnode("l1", `U=${leaves[0]}`, "c1", "idle", leaves[0] as number),
        tnode("l2", `U=${leaves[1]}`, "c1", "idle", leaves[1] as number),
        tnode("l3", `U=${leaves[2]}`, "c2", "idle", leaves[2] as number),
        tnode("l4", `U=${leaves[3]}`, "c2", "idle", leaves[3] as number),
    ];
    yield {
        stepNumber: step,
        entities: skeleton,
        edges: [],
        description: "Expectiminimax tree: MAX root, two chance nodes, four utility leaves.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { leaves },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: skeleton.map((n) =>
            n.id.startsWith("l") ? { ...n, state: "highlight" as EntityState } : n,
        ),
        edges: [],
        description: `Leaf utilities revealed: C1 <- {${leaves[0]}, ${leaves[1]}}, C2 <- {${leaves[2]}, ${leaves[3]}}.`,
        codeLineNumber: 1,
        layout: "tree",
        meta: { leaves },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: skeleton.map((n) =>
            n.id === "c1"
                ? { ...n, state: "comparing" as EntityState, label: `EV=${ev1}`, value: ev1 }
                : n,
        ),
        edges: [],
        description: `Chance C1: ½×${leaves[0]} + ½×${leaves[1]} = ${ev1}.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { ev1 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: skeleton.map((n) =>
            n.id === "c2"
                ? { ...n, state: "comparing" as EntityState, label: `EV=${ev2}`, value: ev2 }
                : n,
        ),
        edges: [],
        description: `Chance C2: ½×${leaves[2]} + ½×${leaves[3]} = ${ev2}.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { ev2 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: skeleton.map((n) =>
            n.id === "root"
                ? { ...n, state: "sorted" as EntityState, label: `MAX=${best}`, value: best }
                : n.id === pick.toLowerCase()
                  ? { ...n, state: "sorted" as EntityState }
                  : n,
        ),
        edges: [],
        description: `MAX picks max(${ev1}, ${ev2}) = ${best} via ${pick}.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { ev1, ev2, pick, value: best },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: skeleton.map((n) =>
            n.id === "root"
                ? { ...n, state: "sorted" as EntityState, label: `MAX=${best}`, value: best }
                : n,
        ),
        edges: [],
        description: `Expectiminimax value of the position is ${best}.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { value: best },
    };
}

const module: AlgorithmModule = {
    id: "expectiminimax",
    name: "Expectiminimax",
    category: "game",
    complexity: { time: "O(b^d)", space: "O(d)" },
    defaultInput: { leaves: [10, 0, 8, 4] },
    visualType: "tree",
    run,
};

export default module;
