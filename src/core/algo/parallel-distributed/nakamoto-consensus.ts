/**
 * nakamoto-consensus.ts - Longest-Chain Rule (Nakamoto Consensus Teachable Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Nakamoto consensus lets an unpermissioned network agree on one transaction
 * history by following the chain with the most accumulated proof-of-work. This
 * module implements exactly that teachable core: given a block tree with
 * parent links and per-block work, it computes cumulative work, selects the
 * heaviest tip, walks back to genesis to form the canonical chain, and reports
 * a reorganization when the winner differs from a previously observed tip.
 * Mining, difficulty adjustment, and networking are out of scope.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for cumulative work and the canonical walk on n blocks
 *   Space: O(n) for the work map and chain path
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree nodes are blocks; directed edges run from parent to child.
 *   - The selected chain is highlighted and the reorg verdict is reported.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Block { id: string; parent: string | null; work: number }
interface NakamotoInput { blocks?: Block[]; previousTip?: string }

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NakamotoInput | null) ?? {};
    const blocks: Block[] = Array.isArray(task.blocks) && task.blocks.length > 0
        ? task.blocks.map((b) => ({ id: String(b.id), parent: b.parent ?? null, work: typeof b.work === "number" ? b.work : 1 }))
        : [
              { id: "G", parent: null, work: 1 },
              { id: "A", parent: "G", work: 1 },
              { id: "B", parent: "A", work: 1 },
              { id: "C", parent: "B", work: 1 },
              { id: "X", parent: "A", work: 1 },
              { id: "Y", parent: "X", work: 1 },
              { id: "Z", parent: "Y", work: 1 },
              { id: "W", parent: "Z", work: 1 },
          ];
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const cumulative = new Map<string, number>();
    const compute = (id: string): number => {
        const cached = cumulative.get(id);
        if (cached !== undefined) return cached;
        const block = byId.get(id);
        const parentWork = block?.parent ? compute(block.parent) : 0;
        const value = parentWork + (block?.work ?? 0);
        cumulative.set(id, value);
        return value;
    };
    for (const block of blocks) compute(block.id);

    let tip = blocks[0]?.id ?? "";
    for (const block of blocks) {
        const work = cumulative.get(block.id) ?? 0;
        const bestWork = cumulative.get(tip) ?? 0;
        if (work > bestWork || (work === bestWork && block.id < tip)) tip = block.id;
    }
    const chain: string[] = [];
    let cursor: string | null = tip;
    const guard = blocks.length + 1;
    for (let i = 0; i < guard && cursor !== null; i += 1) {
        chain.push(cursor);
        cursor = byId.get(cursor)?.parent ?? null;
    }
    chain.reverse();
    const chainSet = new Set(chain);
    const previousTip = typeof task.previousTip === "string" ? task.previousTip : "";
    const reorg = previousTip !== "" && previousTip !== tip && byId.has(previousTip);

    const edges: VisualEdge[] = blocks
        .filter((b) => b.parent !== null && byId.has(b.parent))
        .map((b) => ({
            id: `edge-${b.parent}-${b.id}`,
            sourceId: `node-${b.parent}`,
            targetId: `node-${b.id}`,
            label: String(b.work),
            state: (chainSet.has(b.id) && chainSet.has(b.parent ?? "") ? "path" : "idle") as EntityState,
            directed: true,
        }));

    const makeNodes = (phase: string): VisualEntity[] =>
        blocks.map((b) => {
            const value = phase === "work" ? (cumulative.get(b.id) ?? 0) : b.work;
            const state: EntityState = phase === "chain" && chainSet.has(b.id)
                ? "sorted"
                : phase === "work"
                    ? "comparing"
                    : "unvisited";
            return {
                id: `node-${b.id}`,
                type: "node" as const,
                label: `${b.id}:${value}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { blockId: b.id, parentId: b.parent ?? "", work: b.work, cumulative: cumulative.get(b.id) ?? 0 },
            };
        });

    const base = { n: blocks.length, tip, chain, cumulative: JSON.stringify(Object.fromEntries(cumulative)), previousTip };
    yield {
        stepNumber: 0,
        entities: makeNodes("setup"),
        edges,
        description: `Block tree of ${blocks.length} blocks; each edge is labeled with its block work.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { ...base, phase: "setup", reorg: false },
    };
    yield {
        stepNumber: 1,
        entities: makeNodes("work"),
        edges,
        description: `Cumulative work is the sum along each path; the heaviest tip is ${tip} with ${cumulative.get(tip) ?? 0}.`,
        codeLineNumber: 1,
        layout: "tree",
        meta: { ...base, phase: "work", reorg: false },
    };
    yield {
        stepNumber: 2,
        entities: makeNodes("chain"),
        edges,
        description: `Canonical chain from genesis to ${tip}: ${chain.join(" -> ")}.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { ...base, phase: "chain", reorg },
    };
    yield {
        stepNumber: 3,
        entities: makeNodes("chain"),
        edges,
        description: reorg
            ? `Reorganization: the old tip ${previousTip} was replaced by heavier tip ${tip}.`
            : `No reorganization: the heaviest tip remains ${tip}.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { ...base, phase: "verdict", reorg },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Nodes in a proof-of-work blockchain do not vote on the winner. Each node simply follows the chain that represents the most accumulated work. If a competing branch later becomes heavier, the node switches to it, which is a reorganization. This module implements that longest-heaviest-chain selection rule on a small block tree.",
        invariants: [
            "A block's cumulative work is its own work plus its parent's cumulative work.",
            "The canonical chain is the path from genesis to the tip with the greatest cumulative work.",
            "Ties are broken by lexical block id so the result is deterministic.",
        ],
        correctness:
            "Cumulative work is defined recursively from genesis, so every path sum is exact. Selecting the maximum cumulative tip and walking parent links returns the unique heaviest path, because each block has one parent. If the selected tip differs from a previously observed tip that still exists in the tree, the node must have switched to a heavier branch, which is exactly a reorganization.",
        complexityRationale:
            "Computing cumulative work visits each block once and the tip walk visits at most the chain length, so time is O(n). The work map, chain path, and node list all use O(n) space.",
        uses: [
            "Choosing the canonical chain in proof-of-work cryptocurrencies",
            "Understanding chain reorganizations and confirmation depth",
            "Teaching the longest-chain rule before studying proof of stake",
        ],
        references: [
            "Nakamoto, Bitcoin: A Peer-to-Peer Electronic Cash System, 2008",
            "Gervais et al., On the Security and Performance of Proof of Work Blockchains, 2016",
        ],
        workedExample:
            "Genesis has work one. Chain A-B-C reaches cumulative work four, while branch X-Y-Z-W reaches work five. The node follows the branch ending at W, walks back through Z, Y, X, and A to genesis, and reports a reorganization if its previous tip was C.",
    },
    id: "nakamoto-consensus",
    name: "Nakamoto Consensus (Longest-Chain Rule)",
    category: "parallel-distributed",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        blocks: [
            { id: "G", parent: null, work: 1 },
            { id: "A", parent: "G", work: 1 },
            { id: "B", parent: "A", work: 1 },
            { id: "C", parent: "B", work: 1 },
            { id: "X", parent: "A", work: 1 },
            { id: "Y", parent: "X", work: 1 },
            { id: "Z", parent: "Y", work: 1 },
            { id: "W", parent: "Z", work: 1 },
        ],
        previousTip: "B",
    },
    visualType: "tree",
    run,
    pseudocode: [
        "read the block tree with parent links and per-block work",
        "compute cumulative work from genesis down each branch",
        "choose the tip with the greatest cumulative work",
        "break work ties by lexical block identifier",
        "walk parent links from the tip back to genesis",
        "reverse the path to form the canonical chain",
        "report a reorganization if the tip changed",
        "done: report the canonical chain and verdict",
    ],
};

export default module;
