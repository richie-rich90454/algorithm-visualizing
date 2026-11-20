/**
 * paranoid-search.ts - Paranoid Search for Multi-Player Games
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Paranoid search approximates a multi-player game by assuming every opponent
 * cooperates to minimize the root player's payoff. Nodes belonging to the
 * root player maximize that payoff; nodes belonging to any other player
 * minimize it. With two players this is ordinary minimax, but with three or
 * more it gives the root player a conservative, safe value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^d) without pruning
 *   Space: O(d) for the recursion stack plus the tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A node being backed up is YELLOW (comparing).
 *   - A node with its final paranoid value is GREEN (sorted).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    leaves?: number[];
    players?: number;
}

function buildTree(depth: number, branch: number, id: { value: number }, parent: string | null): VisualEntity[] {
    const current = id.value;
    id.value += 1;
    const nodes: VisualEntity[] = [
        {
            id: `node-${current}`,
            type: "node",
            label: String(current),
            value: current,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent ?? "root", depth },
        },
    ];
    if (depth > 0) {
        for (let i = 0; i < branch; i += 1) nodes.push(...buildTree(depth - 1, branch, id, `node-${current}`));
    }
    return nodes;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const leaves = task.leaves ?? [4, 2, 7, 1, 8, 3, 6, 5, 2, 9, 4, 1, 7, 3, 6, 8, 2, 5, 4, 9, 1, 6, 3, 7, 5, 2, 8];
    const players = Math.max(2, Math.min(4, Math.floor(task.players ?? 3)));
    const counter = { value: 0 };
    const nodes = buildTree(3, 3, counter, null);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const children = new Map<string, string[]>();
    for (const node of nodes) {
        const parent = String(node.metadata["parentId"]);
        const list = children.get(parent) ?? [];
        list.push(node.id);
        children.set(parent, list);
    }
    const leafIds = nodes.filter((node) => (children.get(node.id) ?? []).length === 0).map((node) => node.id);
    leafIds.forEach((id, index) => {
        const node = byId.get(id);
        if (node) node.label = String(leaves[index] ?? 0);
    });
    const root = nodes[0]?.id ?? "";
    const events: Array<{ id: string; value: number; depth: number }> = [];

    const evaluate = (nodeId: string, depth: number): number => {
        const kids = children.get(nodeId) ?? [];
        const node = byId.get(nodeId);
        if (kids.length === 0) {
            const value = Number(node?.label ?? 0);
            events.push({ id: nodeId, value, depth });
            return value;
        }
        let value = depth % players === 0 ? -Infinity : Infinity;
        for (const child of kids) {
            const childValue = evaluate(child, depth + 1);
            value = depth % players === 0 ? Math.max(value, childValue) : Math.min(value, childValue);
        }
        if (node) node.label = String(value);
        events.push({ id: nodeId, value, depth });
        return value;
    };
    const value = evaluate(root, 0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: [],
        description: `Paranoid search on a ternary depth-three tree with ${players} players; root player is player zero.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { players, leaves: leaves.length, value: 0 },
    };
    step += 1;

    for (const event of events) {
        const node = byId.get(event.id);
        if (node) node.state = "comparing";
        yield {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node })),
            edges: [],
            description: `Node ${event.id} at depth ${event.depth} (player ${event.depth % players}) backs up ${event.value}.`,
            codeLineNumber: event.depth === 0 ? 5 : 4,
            layout: "tree",
            meta: { node: event.id, player: event.depth % players, value: event.value, players },
        };
        step += 1;
        if (node) node.state = "sorted";
    }

    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: [],
        description: `Paranoid game value for the root player is ${value}, assuming all ${players - 1} opponents collude.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { value, optimal: value, players, evaluated: events.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "With more than two players, exact game-tree values depend on how opponents will vote or form coalitions. Paranoid search takes the pessimistic route: it assumes every opponent chooses the move worst for the root player. That turns the game into a two-level alternation between the root player maximizing and everybody else minimizing.",
        invariants: [
            "Nodes belonging to the root player take the maximum child value.",
            "Nodes belonging to any other player take the minimum child value.",
            "Leaf scores are utilities for the root player only.",
        ],
        correctness:
            "Because all opponents are assumed to coordinate against the root player, their joint best response at any non-root node is the minimum child value. The root player's best response is the maximum child value. Backing up those operations recursively computes the value of the game under that worst-case coalition assumption.",
        complexityRationale:
            "Every node of the b-ary depth-d tree is visited once, giving O(b^d) time, and the recursion stack uses O(d) space in addition to the tree itself.",
        uses: [
            " conservative strategy selection in multiplayer board games",
            " security games with several possible adversaries",
            " a baseline before adding coalition or voting models",
        ],
        references: [
            "Korf, Multi-Player Alpha-Beta Search (1988)",
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, adversarial search",
        ],
        workedExample:
            "In a three-player tree, if the root player's first move leads to opponent nodes with values 2 and 5, the paranoid value of that move is 2. If the second move leads to values 4 and 6, its paranoid value is 4, so the root player chooses the second move and the game value is 4.",
    },
    id: "paranoid-search",
    name: "Paranoid Search (Multi-Player)",
    category: "game",
    complexity: { time: "O(b^d)", space: "O(d)" },
    defaultInput: {
        leaves: [4, 2, 7, 1, 8, 3, 6, 5, 2, 9, 4, 1, 7, 3, 6, 8, 2, 5, 4, 9, 1, 6, 3, 7, 5, 2, 8],
        players: 3,
    },
    visualType: "tree",
    run,
    pseudocode: [
        "build a depth-three game tree with utilities for the root player",
        "mark each internal node with the player whose turn it is",
        "at a root-player node back up the maximum child value",
        "at any other node back up the minimum child value",
        "use leaf scores as the utilities of terminal positions",
        "continue until the root has a backed-up value",
        "done: the root player's value against a united opposition",
    ],
};

export default module;
