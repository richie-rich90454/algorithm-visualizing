/**
 * medusa-decoding.ts - Medusa Tree Speculative Verification
 *
 * Scope: Medusa attaches several decoding heads to a language model so they
 * propose a tree of candidate continuations in parallel; the target model then
 * verifies the tree and accepts the longest matching path. This implements that
 * exact, lossless verification core. The "models" are small deterministic toy
 * next-token functions so the arithmetic is reproducible; this is not a neural
 * network and makes no claim about real model quality.
 *
 * Time:  O(branch^depth) nodes generated and verified
 * Space: O(branch^depth) for the proposal tree
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MedusaInput {
    lastToken?: number;
    vocabSize?: number;
    depth?: number;
    branch?: number;
}

interface TreeNode {
    id: string;
    token: number;
    parentId: string;
    level: number;
}

/** Deterministic toy target model: greedy next token from the last token. */
function targetNext(token: number, vocab: number): number {
    return (5 * token + 3) % vocab;
}

/** Deterministic toy Medusa head proposal. */
function propose(token: number, head: number, vocab: number): number {
    return (7 * token + 3 * head + 1) % vocab;
}

/** Turn a tree node list into layout-ready entities with per-node states. */
function makeEntities(
    nodes: TreeNode[],
    states: Map<string, EntityState>,
    correctedToken: number | null,
): VisualEntity[] {
    const entities: VisualEntity[] = nodes.map((node) => ({
        id: node.id,
        type: "node" as const,
        label: String(node.token),
        value: node.token,
        state: states.get(node.id) ?? ("idle" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { level: node.level, parentId: node.parentId, token: node.token },
    }));
    if (correctedToken !== null) {
        entities.push({
            id: "corrected",
            type: "node",
            label: `${correctedToken}*`,
            value: correctedToken,
            state: "highlight" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { level: -1, parentId: "n0", token: correctedToken, corrected: true },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MedusaInput | null) ?? {};
    const vocab = Math.max(2, Math.trunc(task.vocabSize ?? 12));
    const depth = Math.max(1, Math.min(Math.trunc(task.depth ?? 3), 5));
    const branch = Math.max(1, Math.min(Math.trunc(task.branch ?? 2), 4));
    const last = Math.max(0, Math.trunc(task.lastToken ?? 4)) % vocab;

    // Build the proposal tree level by level.
    const nodes: TreeNode[] = [{ id: "n0", token: last, parentId: "", level: 0 }];
    let frontier = ["n0"];
    for (let level = 1; level <= depth; level += 1) {
        const nextFrontier: string[] = [];
        for (const parentId of frontier) {
            const parent = nodes.find((node) => node.id === parentId);
            for (let head = 0; head < branch; head += 1) {
                const id = `n${nodes.length}`;
                nodes.push({
                    id,
                    token: propose(parent?.token ?? last, head, vocab),
                    parentId,
                    level,
                });
                nextFrontier.push(id);
            }
        }
        frontier = nextFrontier;
    }

    // Greedy target continuation for comparison.
    const greedy: number[] = [];
    let cursor = last;
    for (let i = 0; i <= depth; i += 1) {
        cursor = targetNext(cursor, vocab);
        greedy.push(cursor);
    }

    // Enumerate every root-to-leaf path and keep the longest matching prefix.
    const leaves = nodes.filter((node) => node.level === depth);
    let bestPath: TreeNode[] = [];
    let bestMatch = -1;
    const chainOf = (leaf: TreeNode): TreeNode[] => {
        const chain: TreeNode[] = [];
        let current: TreeNode | undefined = leaf;
        while (current && current.level > 0) {
            chain.unshift(current);
            current = nodes.find((node) => node.id === current?.parentId);
        }
        return chain;
    };
    for (const leaf of leaves) {
        const chain = chainOf(leaf);
        let matched = 0;
        while (matched < chain.length && chain[matched]?.token === greedy[matched]) {
            matched += 1;
        }
        if (matched > bestMatch) {
            bestMatch = matched;
            bestPath = chain;
        }
    }
    const acceptedLen = Math.max(0, bestMatch);
    const output = greedy.slice(0, Math.min(acceptedLen + 1, greedy.length));
    const targetCalls = acceptedLen + 1;
    const correctedToken = (greedy[acceptedLen] ?? last) as number;

    let step = 0;
    const initialStates = new Map<string, EntityState>([["n0", "pivot"]]);
    yield {
        stepNumber: step,
        entities: makeEntities(nodes, initialStates, null),
        edges: nodes
            .filter((node) => node.parentId !== "")
            .map((node) => ({
                id: `edge-${node.parentId}-${node.id}`,
                sourceId: node.parentId,
                targetId: node.id,
                label: String(node.token),
                state: "idle" as EntityState,
                directed: true,
            })),
        description: `Medusa proposed ${nodes.length - 1} candidate tokens in a depth-${depth} tree; verifying against the target model.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: {
            nodes: nodes.length,
            vocab,
            depth,
            branch,
            output,
            greedy,
            acceptedLen,
            targetCalls,
        },
    };
    step += 1;

    // Reveal verification level by level.
    for (let level = 1; level <= depth; level += 1) {
        const states = new Map<string, EntityState>([["n0", "pivot"]]);
        for (const node of nodes) {
            if (node.level > level) {
                continue;
            }
            const onChosen = bestPath.some((chosen) => chosen.id === node.id);
            if (node.level <= acceptedLen && onChosen) {
                states.set(node.id, "path");
            } else if (node.level === level) {
                states.set(node.id, "comparing");
            } else {
                states.set(node.id, "visited");
            }
        }
        yield {
            stepNumber: step,
            entities: makeEntities(nodes, states, null),
            edges: nodes
                .filter((node) => node.parentId !== "")
                .map((node) => ({
                    id: `edge-${node.parentId}-${node.id}`,
                    sourceId: node.parentId,
                    targetId: node.id,
                    label: String(node.token),
                    state: (bestPath.some((chosen) => chosen.id === node.id) ? "path" : "idle") as EntityState,
                    directed: true,
                })),
            description: `Verifying level ${level}: ${bestPath.filter((node) => node.level <= acceptedLen).length} token(s) accepted so far on the longest matching path.`,
            codeLineNumber: level === depth ? 4 : 3,
            layout: "tree",
            meta: {
                nodes: nodes.length,
                vocab,
                depth,
                branch,
                level,
                output,
                greedy,
                acceptedLen,
                targetCalls,
            },
        };
        step += 1;
    }

    const finalStates = new Map<string, EntityState>([["n0", "pivot"]]);
    for (const node of nodes) {
        if (node.level === 0) {
            continue;
        }
        if (node.level <= acceptedLen && bestPath.some((chosen) => chosen.id === node.id)) {
            finalStates.set(node.id, "path");
        } else {
            finalStates.set(node.id, "error");
        }
    }
    yield {
        stepNumber: step,
        entities: makeEntities(nodes, finalStates, correctedToken),
        edges: nodes
            .filter((node) => node.parentId !== "")
            .map((node) => ({
                id: `edge-${node.parentId}-${node.id}`,
                sourceId: node.parentId,
                targetId: node.id,
                label: String(node.token),
                state: (bestPath.some((chosen) => chosen.id === node.id) ? "path" : "idle") as EntityState,
                directed: true,
            })),
        description: `Accepted ${acceptedLen} proposed token(s) plus corrected token ${correctedToken}; ${targetCalls} target-model call(s) instead of ${depth + 1}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: {
            nodes: nodes.length,
            vocab,
            depth,
            branch,
            output,
            greedy,
            acceptedLen,
            targetCalls,
            correctedToken,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Medusa adds small extra heads to a language model that each guess several future tokens, forming a tree of possibilities. The target model checks the tree in one pass and accepts the longest path that matches what it would have produced greedily. Because verification is exact, the output is always identical to ordinary greedy decoding.",
        invariants: [
            "Every proposed node is a child of exactly one parent, forming a rooted tree.",
            "The accepted path is a prefix of the target model's greedy continuation.",
            "The corrected token is the target model's next token after the accepted prefix, so decoding stays lossless.",
        ],
        correctness:
            "Verification enumerates every root-to-leaf path and measures how many leading tokens agree with the greedy sequence. Accepting a path of length k is valid because all k tokens were confirmed by the target model. The appended correction is the target model's own next token, so the emitted sequence is exactly the greedy sequence the model would have produced without speculation.",
        complexityRationale:
            "A tree of depth d with branching factor b has O(b^d) nodes, all generated and checked once, giving O(b^d) time and space. The win in practice is that the b^d checks happen in one batched model pass rather than b^d sequential passes.",
        uses: [
            "Speeding up large language model inference",
            "Parallel draft-and-verify decoding",
            "Reducing wall-clock latency without changing output quality",
        ],
        references: [
            "Cai et al., Medusa: Simple LLM Inference Acceleration with Multi-Head Decoding, 2024",
            "Leviathan, Kalman and Matias, Fast Inference from Transformers via Speculative Decoding, 2023",
        ],
        workedExample:
            "With last token 4, the target greedy chain might be 1, 8, 3 while a Medusa branch proposes 1, 8, 9. Verification accepts 1 and 8, rejects 9, and appends the target's correction 3, producing 1, 8, 3 in a single verification pass.",
    },
    id: "medusa-decoding",
    name: "Medusa Decoding (Tree Verification)",
    category: "ml-ai",
    complexity: { time: "O(branch^depth)", space: "O(branch^depth)" },
    defaultInput: { lastToken: 4, vocabSize: 12, depth: 3, branch: 2 },
    visualType: "tree",
    run,
    pseudocode: [
        "build the proposal tree of candidate continuations",
        "compute the target model greedy continuation",
        "for each root-to-leaf candidate path",
        "count the leading tokens matching the greedy chain",
        "accept the path with the longest matching prefix",
        "reject the first mismatching node",
        "append the target correction after the accepted prefix",
        "done: report accepted tokens and target calls",
    ],
};

export default module;
