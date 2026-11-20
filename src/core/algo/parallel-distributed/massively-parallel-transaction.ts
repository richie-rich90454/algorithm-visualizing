/**
 * massively-parallel-transaction.ts - Massively Parallel Transaction Commit
 *
 * A transaction that touches many shards uses a binary aggregation tree instead
 * of a flat coordinator. Each shard votes in parallel, votes are combined by
 * logical AND up the tree in logarithmic rounds, the root decides, and the
 * decision is broadcast back down. One aborting shard aborts the whole tree.
 *
 * Time:  O(shards) messages across O(log shards) parallel rounds
 * Space: O(shards) for the tree, votes, and per-node aggregates
 *
 * Visualization: a tree shows the coordinator hierarchy; votes glow during
 * aggregation, and the final frame is green for commit or red for abort.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Tree = {
    edges: Array<[number, number]>;
    parentOf: Map<number, number>;
    levels: number[][];
    root: number;
};

/** Build a balanced binary aggregation tree over `count` leaf shards. */
export function buildTree(count: number): Tree {
    const edges: Array<[number, number]> = [];
    const parentOf = new Map<number, number>();
    let current = Array.from({ length: count }, (_, i) => i);
    const levels: number[][] = [current.slice()];
    let nextId = count;
    while (current.length > 1) {
        const next: number[] = [];
        for (let i = 0; i < current.length; i += 2) {
            const left = current[i] as number;
            if (i + 1 < current.length) {
                const right = current[i + 1] as number;
                const parent = nextId;
                nextId += 1;
                edges.push([parent, left], [parent, right]);
                parentOf.set(left, parent);
                parentOf.set(right, parent);
                next.push(parent);
            } else {
                next.push(left);
            }
        }
        current = next;
        levels.push(current.slice());
    }
    return { edges, parentOf, levels, root: current[0] as number };
}

/** Build tree nodes; leaves show their vote, internal nodes show their aggregate. */
function makeNodes(
    tree: Tree,
    shardCount: number,
    votes: boolean[],
    aggregate: Map<number, boolean>,
    states: Map<number, EntityState>,
): VisualEntity[] {
    const ids = new Set<number>();
    for (const [parent, child] of tree.edges) {
        ids.add(parent);
        ids.add(child);
    }
    ids.add(tree.root);
    return [...ids].sort((a, b) => a - b).map((id) => {
        const isLeaf = id < shardCount;
        const value = isLeaf ? (votes[id] ?? true) : (aggregate.get(id) ?? true);
        return {
            id: `node-${id}`,
            type: "node" as const,
            label: isLeaf ? `S${id}:${value ? "Y" : "N"}` : (aggregate.has(id) ? (value ? "Y" : "N") : "?"),
            value: value ? "commit" : "abort",
            state: states.get(id) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                role: isLeaf ? "shard" : "coordinator",
                index: isLeaf ? id : -1,
                vote: isLeaf ? value : true,
                parentId: !isLeaf && tree.parentOf.has(id) ? `node-${tree.parentOf.get(id)}` : "",
            },
        };
    });
}

/** Directed parent-to-child edges for the coordinator tree. */
function makeEdges(tree: Tree, active: number | null): VisualEdge[] {
    return tree.edges.map(([parent, child], i) => ({
        id: `edge-${i}`,
        sourceId: `node-${parent}`,
        targetId: `node-${child}`,
        label: "",
        state: i === active ? "active" : "idle",
        directed: true,
    }));
}

/** The massively parallel transaction generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { shards?: number; votes?: boolean[] } | null) ?? {};
    const shards = typeof task.shards === "number" && task.shards >= 2 ? Math.floor(task.shards) : 7;
    const votes: boolean[] = Array.isArray(task.votes) && task.votes.length === shards
        ? task.votes.map(Boolean)
        : new Array<boolean>(shards).fill(true);
    const tree = buildTree(shards);
    const childrenOf = new Map<number, number[]>();
    for (const [parent, child] of tree.edges) {
        if (!childrenOf.has(parent)) childrenOf.set(parent, []);
        (childrenOf.get(parent) as number[]).push(child);
    }
    const aggregate = new Map<number, boolean>();
    for (let i = 0; i < shards; i += 1) aggregate.set(i, votes[i] ?? true);
    const decision = votes.every(Boolean) ? "commit" : "abort";
    const voteLabels: string[] = votes.map((v) => (v ? "Y" : "N"));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(tree, shards, votes, aggregate, new Map()),
        edges: makeEdges(tree, null),
        description: `${shards} shards cast votes in parallel across a ${tree.levels.length}-level commit tree.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { phase: "votes", shards, votes: voteLabels, decision: "pending", root: tree.root, levels: tree.levels.length },
    };
    step += 1;

    for (let level = 0; level < tree.levels.length; level += 1) {
        const nodes = tree.levels[level] as number[];
        for (const id of nodes) {
            if (id >= shards) {
                const kids = childrenOf.get(id) ?? [];
                aggregate.set(id, kids.every((k) => aggregate.get(k) ?? true));
            }
        }
        const states = new Map<number, EntityState>();
        for (const id of nodes) states.set(id, "comparing");
        yield {
            stepNumber: step,
            entities: makeNodes(tree, shards, votes, aggregate, states),
            edges: makeEdges(tree, null),
            description: `Aggregation level ${level}: ${nodes.length} node(s) combine child votes by logical AND.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { phase: "aggregate", shards, votes: voteLabels, decision: "pending", root: tree.root, level, aggregates: [...aggregate].map(([id, val]) => `${id}:${val ? "Y" : "N"}`) },
        };
        step += 1;
    }

    const rootState = new Map<number, EntityState>([[tree.root, decision === "commit" ? "sorted" : "error"]]);
    yield {
        stepNumber: step,
        entities: makeNodes(tree, shards, votes, aggregate, rootState),
        edges: makeEdges(tree, null),
        description: `Root ${tree.root} decides ${decision}: ${decision === "commit" ? "every shard voted yes" : "at least one shard voted no"}.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { phase: "decision", shards, votes: voteLabels, decision, root: tree.root, aggregates: [...aggregate].map(([id, val]) => `${id}:${val ? "Y" : "N"}`) },
    };
    step += 1;

    for (let level = tree.levels.length - 1; level >= 0; level -= 1) {
        const nodes = tree.levels[level] as number[];
        const states = new Map<number, EntityState>();
        for (const id of nodes) states.set(id, decision === "commit" ? "active" : "error");
        yield {
            stepNumber: step,
            entities: makeNodes(tree, shards, votes, aggregate, states),
            edges: makeEdges(tree, null),
            description: `Decision broadcast reaches level ${level}: ${nodes.length} node(s) apply ${decision}.`,
            codeLineNumber: 5,
            layout: "tree",
            meta: { phase: "broadcast", shards, votes: voteLabels, decision, root: tree.root, level },
        };
        step += 1;
    }

    const finalStates = new Map<number, EntityState>();
    for (const id of aggregate.keys()) finalStates.set(id, decision === "commit" ? "sorted" : "error");
    yield {
        stepNumber: step,
        entities: makeNodes(tree, shards, votes, aggregate, finalStates),
        edges: makeEdges(tree, null),
        description: `Transaction finished: all ${shards} shards ${decision} in O(log shards) tree rounds.`,
        codeLineNumber: 7,
        layout: "tree",
        meta: { phase: "done", shards, votes: voteLabels, decision, root: tree.root, levels: tree.levels.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Asking a single coordinator to collect votes from thousands of shards creates a bottleneck. Arrange the participants as a binary tree instead: every shard votes at a leaf, each internal node combines its children's votes by AND, and the root's value is the global decision in the time it takes a vote to climb the tree. The decision then flows back down.",
        invariants: [
            "Every internal node's aggregate is the logical AND of all shard votes beneath it.",
            "The root aggregate equals the AND of every shard vote.",
            "Each tree edge carries one vote upward and one decision downward.",
        ],
        correctness:
            "By induction on tree height, a leaf's aggregate is its own vote and an internal node's aggregate is the AND of its children, which by induction is the AND of all descendant shards. The root therefore aggregates every shard, so it commits exactly when all votes are yes. Broadcasting that single root value down the tree gives every shard the same decision, preserving atomicity while using only logarithmic rounds.",
        complexityRationale:
            "The binary tree has O(s) edges, each carrying one vote and one decision, O(s) messages, but nodes at the same level act in parallel so the critical path spans the tree height, O(log s) rounds. Storing votes, aggregates, and the tree uses O(s) space.",
        uses: [
            "Atomic commit across sharded, shared-nothing databases",
            "Large-scale consensus and membership voting aggregation",
            "Tree-based reduction of votes in distributed transaction monitors",
        ],
        references: [
            "Bernstein and Newcomer, Principles of Distributed Database Systems, Chapter 8",
            "Lampson, How to Build a Highly Available System Using Consensus, 1996",
        ],
        workedExample:
            "Seven shards vote yes, yes, no, yes, yes, yes, yes. The lowest tree level combines pairs into yes, no, yes, yes; the next into no and yes; the root ANDs those into no. The decision abort is broadcast back down, so all seven shards abort even though only one voted no.",
    },
    id: "massively-parallel-transaction",
    name: "Massively Parallel Transaction Commit",
    category: "parallel-distributed",
    complexity: { time: "O(log shards) rounds", space: "O(shards)" },
    defaultInput: { shards: 7, votes: [true, true, true, true, true, true, true] },
    visualType: "tree",
    run,
    pseudocode: [
        "arrange the shards as leaves of a binary commit tree",
        "each shard casts its yes or no vote in parallel",
        "combine child votes by logical AND at each parent",
        "repeat the AND aggregation level by level up to the root",
        "if the root is yes decide commit otherwise abort",
        "broadcast the decision down every tree edge",
        "each shard applies the received decision locally",
        "done: report the shared commit or abort decision",
    ],
};

export default module;
