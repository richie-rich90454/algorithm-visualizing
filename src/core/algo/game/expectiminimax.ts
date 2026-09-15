/**
 * expectiminimax.ts – Expectiminimax (game tree with chance nodes)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Expectiminimax extends minimax with chance nodes that average their
 * children. Simply: MAX picks the chance node with the higher expected
 * value. Formally: chance nodes back up the mean of leaf utilities while
 * MAX nodes take the max; the demo MAX root picks between chance nodes C1
 * (leaves 10, 0 for EV 5) and C2 (leaves 8, 4 for EV 6), so MAX takes C2.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^d) over the tree
 *   Space: O(d) recursion
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Leaf utilities highlight; evaluated chance nodes flash YELLOW.
 *   - The chosen chance branch paints GREEN with its expected value.
 *   - The root shows the backed-up optimal value and pick.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Chance nodes average; MAX/MIN nodes optimize.
 */
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
        description: `Expectiminimax tree: MAX root over chance C1 and C2 with leaf utilities {${leaves.join(", ")}}.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { leaves: [...leaves], nodes: 7 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: skeleton.map((n) =>
            n.id.startsWith("l") ? { ...n, state: "highlight" as EntityState } : n,
        ),
        edges: [],
        description: `Leaf utilities revealed: chance C1 holds {${leaves[0]}, ${leaves[1]}}, chance C2 holds {${leaves[2]}, ${leaves[3]}}.`,
        codeLineNumber: 1,
        layout: "tree",
        meta: { leaves: [...leaves], c1: [leaves[0], leaves[1]], c2: [leaves[2], leaves[3]] },
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
        description: `Chance node C1 averages leaves: ½×${leaves[0]} + ½×${leaves[1]} = EV ${ev1}.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { ev1, ev2, leaves: [...leaves] },
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
        description: `Chance node C2 averages leaves: ½×${leaves[2]} + ½×${leaves[3]} = EV ${ev2}.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { ev1, ev2, leaves: [...leaves] },
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
        description: `MAX root picks max(EV ${ev1}, EV ${ev2}) = ${best} via chance ${pick}.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: { ev1, ev2, pick, value: best, winning: true },
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
        description: `Expectiminimax value ${best} selects optimal move ${pick} for MAX.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { value: best, optimal: best, pick, ev1, ev2 },
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
    pseudocode: [
        "build MAX root with chance nodes C1 and C2 and utility leaves",
        "reveal leaf utilities under each chance node for scoring",
        "compute EV(C1) ← average of its leaf utilities",
        "compute EV(C2) ← average of its leaf utilities",
        "MAX picks max(EV(C1), EV(C2)) as the best chance to take",
        "highlight the chosen chance branch and back up its value",
        "optimal move is the chance with higher expected value for MAX",
    ],
};

export default module;
