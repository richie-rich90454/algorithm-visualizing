/**
 * quiescence-search.ts - Quiescence Search
 *
 * Cutting off a search at a fixed depth can misjudge a position in the middle
 * of a capture sequence. Quiescence search extends the horizon by following
 * forcing capture moves until a quiet position is reached, so leaf evaluations
 * are made only when the dust has settled. Here the tree mixes decision nodes
 * with horizon nodes that may carry capture chains.
 *
 * Time proportional to the extended tree; space O(depth of capture chains).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface QNode {
    type: "max" | "min" | "horizon";
    v?: number;
    children?: QNode[];
    captures?: QNode[];
}

interface Flat {
    id: string;
    node: QNode;
    parent: string | null;
}

function flatten(node: QNode, id: string, parent: string | null, out: Flat[]): void {
    out.push({ id, node, parent });
    (node.children ?? []).forEach((child, i) => flatten(child, `${id}-${i}`, id, out));
    (node.captures ?? []).forEach((child, i) => flatten(child, `${id}c-${i}`, id, out));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { root?: QNode } | null) ?? {};
    const root: QNode = task.root ?? {
        type: "max",
        children: [
            {
                type: "min",
                children: [
                    { type: "horizon", v: 2, captures: [{ type: "horizon", v: 5, captures: [{ type: "horizon", v: 4 }] }] },
                    { type: "horizon", v: 6 },
                ],
            },
            {
                type: "min",
                children: [
                    { type: "horizon", v: 1, captures: [{ type: "horizon", v: 7 }] },
                    { type: "horizon", v: 8 },
                ],
            },
        ],
    };

    const flat: Flat[] = [];
    flatten(root, "n", null, flat);
    const states = new Map<string, EntityState>(flat.map((f) => [f.id, "unvisited" as EntityState]));
    const values = new Map<string, number>(flat.map((f) => [f.id, 0]));
    const edges = flat.filter((f) => f.parent !== null).map((f) => ({
        id: `edge-${f.parent}-${f.id}`,
        sourceId: String(f.parent),
        targetId: f.id,
        label: f.node.captures ? "capture" : "",
        state: "idle" as EntityState,
        directed: false,
    }));
    const view = (): VisualEntity[] =>
        flat.map((f) => ({
            id: f.id,
            type: "node" as const,
            label: f.node.type === "horizon" ? `Q=${values.get(f.id) ?? f.node.v ?? 0}` : String(values.get(f.id) ?? 0),
            value: values.get(f.id) ?? 0,
            state: states.get(f.id) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: f.parent ?? "root", kind: f.node.type },
        }));

    let step = 0;
    let terminals = 0;
    yield {
        stepNumber: step, entities: view(), edges,
        description: `Quiescence search on a tree with ${flat.length} nodes; horizon nodes with captures are extended until quiet.`,
        codeLineNumber: 0, layout: "tree",
        meta: { nodes: flat.length, terminals: 0 },
    };
    step += 1;

    function* quiesce(f: Flat, isMax: boolean): Generator<VisualFrame, number, unknown> {
        const node = f.node;
        if (node.type === "horizon") {
            let best = node.v ?? 0;
            const captures = node.captures ?? [];
            for (const cap of captures) {
                const capFlat = flat.find((x) => x.id === `${f.id}c-${captures.indexOf(cap)}`);
                if (!capFlat) continue;
                const val = yield* quiesce(capFlat, !isMax);
                best = isMax ? Math.max(best, val) : Math.min(best, val);
            }
            if (captures.length === 0) terminals += 1;
            values.set(f.id, best);
            states.set(f.id, "comparing");
            yield {
                stepNumber: step, entities: view(), edges,
                description: `Horizon ${f.id} searched ${captures.length} capture(s) and settled on ${best}.`,
                codeLineNumber: captures.length > 0 ? 3 : 2,
                layout: "tree",
                meta: { node: f.id, quiet: captures.length === 0, value: best, terminals },
            };
            step += 1;
            states.set(f.id, "sorted");
            return best;
        }
        const children = node.children ?? [];
        let best = isMax ? -Infinity : Infinity;
        for (let i = 0; i < children.length; i += 1) {
            const childFlat = flat.find((x) => x.id === `${f.id}-${i}`);
            if (!childFlat) continue;
            const val = yield* quiesce(childFlat, !isMax);
            best = isMax ? Math.max(best, val) : Math.min(best, val);
        }
        values.set(f.id, best);
        states.set(f.id, "comparing");
        yield {
            stepNumber: step, entities: view(), edges,
            description: `${isMax ? "MAX" : "MIN"} node ${f.id} backed up ${best} from its children.`,
            codeLineNumber: 5,
            layout: "tree",
            meta: { node: f.id, isMax, value: best },
        };
        step += 1;
        states.set(f.id, "sorted");
        return best;
    }

    const value = yield* quiesce(flat[0] ?? { id: "n", node: root, parent: null }, true);
    states.set("n", "sorted");
    yield {
        stepNumber: step, entities: view(), edges,
        description: `Quiescence value ${value} after extending every active capture line to a quiet leaf.`,
        codeLineNumber: 6, layout: "tree",
        meta: { value, optimal: value, terminals, nodes: flat.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A fixed-depth evaluation can stop right in the middle of an exchange and give a wildly wrong score. Quiescence search keeps going along forcing moves, usually captures, until the position is quiet, then evaluates. The horizon adapts to the tactics instead of falling at an arbitrary ply.",
        invariants: [
            "Only forcing capture moves extend the search past the horizon.",
            "A horizon node with no captures is a quiet leaf and is evaluated directly.",
            "At every decision node the usual max or min backup still applies.",
        ],
        correctness:
            "Following every active capture line enumerates the same terminal positions a full minimax of the extended tree would, and applying max and min at the corresponding nodes gives the same backed-up value. Because quiet leaves are exact evaluations and no other moves are considered, the quiescence score is the minimax value of the extended tree.",
        complexityRationale:
            "Work is proportional to the size of the extended capture tree rather than the full game tree; in quiet positions only one extra evaluation is needed, while tactical positions can be much larger. Stack space follows the longest capture chain.",
        uses: [
            "Chess and checkers engines avoiding the horizon effect",
            "Any fixed-depth search where tactical moves dominate leaf scores",
            "Evaluation functions that are only reliable in stable positions",
        ],
        references: [
            "Bratko, Michie, and Bridgland, Pattern Recognition in Chess (1982)",
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, adversarial search chapter",
        ],
        workedExample:
            "A horizon node shows a static score of 2, but it has a capture leading to 5 and a recapture leading to 4. Quiescence follows the chain and records 4 as the settled value instead of the misleading 2, so the parent MAX node sees the real tactical outcome.",
    },
    id: "quiescence-search",
    name: "Quiescence Search",
    category: "game",
    complexity: { time: "O(extended tree)", space: "O(capture chain depth)" },
    defaultInput: {
        root: {
            type: "max",
            children: [
                { type: "min", children: [
                    { type: "horizon", v: 2, captures: [{ type: "horizon", v: 5, captures: [{ type: "horizon", v: 4 }] }] },
                    { type: "horizon", v: 6 },
                ] },
                { type: "min", children: [
                    { type: "horizon", v: 1, captures: [{ type: "horizon", v: 7 }] },
                    { type: "horizon", v: 8 },
                ] },
            ],
        },
    },
    visualType: "tree",
    run,
    pseudocode: [
        "walk the game tree from the root with minimax alternation",
        "at a horizon node read its static evaluation",
        "if capture continuations exist, evaluate each one recursively",
        "take the best static or capture value for the mover",
        "at decision nodes back up max or min of child quiescence values",
        "continue until every line reaches a quiet leaf",
        "report the root value of the extended tree",
    ],
};

export default module;
