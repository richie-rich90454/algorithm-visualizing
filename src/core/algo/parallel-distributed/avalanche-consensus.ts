/**
 * avalanche-consensus.ts - Avalanche Consensus (Repeated Random Subsampling)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Avalanche replaces all-to-all voting with repeated small random polls. A
 * node asks k randomly chosen peers which color they prefer. If at least alpha
 * of them prefer another color, the node switches; if alpha consecutive polls
 * agree with its current color, its confidence grows, and after beta consecutive
 * successes the color is finalized. A strong initial majority rapidly pulls the
 * whole network to one color without a leader or a fixed quorum.
 *
 * This deterministic teaching simulation uses a seeded generator for the
 * samples so every replay is identical.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * N * k) sampled replies
 *   Space: O(N) for colors and confidence counters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node is a graph node labeled with its current color.
 *   - Color zero is blue, color one orange, color two violet.
 *   - A finalized node turns green and keeps its color permanently.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface AvalancheData {
    nodes: number;
    initialColors: number[];
    colors: number[];
    confidence: number[];
    finalized: boolean[];
    rounds: number;
    k: number;
    alpha: number;
    beta: number;
}

/** Deterministic Avalanche repeated-subsampling simulation. */
export function simulateAvalanche(
    initialColors: number[],
    rounds: number,
    k: number,
    alpha: number,
    beta: number,
    seed: number,
): AvalancheData {
    const n = initialColors.length;
    const colors = [...initialColors];
    const confidence = Array<number>(n).fill(0);
    const finalized = Array<boolean>(n).fill(false);
    let state = (seed | 0) || 1;
    const random = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };

    for (let round = 0; round < Math.max(0, Math.floor(rounds)); round += 1) {
        for (let i = 0; i < n; i += 1) {
            if (finalized[i]) continue;
            const pool = Array.from({ length: n }, (_, j) => j).filter((j) => j !== i);
            for (let p = pool.length - 1; p > 0; p -= 1) {
                const j = Math.floor(random() * (p + 1));
                const tmp = pool[p];
                pool[p] = pool[j] ?? p;
                pool[j] = tmp ?? j;
            }
            const sample = pool.slice(0, Math.min(Math.max(1, Math.floor(k)), pool.length));
            const counts = new Map<number, number>();
            for (const j of sample) counts.set(colors[j] ?? 0, (counts.get(colors[j] ?? 0) ?? 0) + 1);
            let bestColor = -1;
            let bestCount = -1;
            for (const [color, count] of counts) {
                if (count > bestCount || (count === bestCount && (bestColor === -1 || color < bestColor))) {
                    bestColor = color;
                    bestCount = count;
                }
            }
            if (bestCount >= alpha) {
                if (bestColor === colors[i]) confidence[i] = (confidence[i] ?? 0) + 1;
                else {
                    colors[i] = bestColor;
                    confidence[i] = 1;
                }
            } else {
                confidence[i] = 0;
            }
            if ((confidence[i] ?? 0) >= beta) finalized[i] = true;
        }
    }

    return { nodes: n, initialColors: [...initialColors], colors, confidence, finalized, rounds, k, alpha, beta };
}

/** Graph nodes colored by their current preference. */
function makeNodes(data: AvalancheData): VisualEntity[] {
    return data.colors.map((color, index) => {
        let state: EntityState = "highlight";
        if (data.finalized[index]) state = "sorted";
        else if (color === 0) state = "active";
        else if (color === 1) state = "comparing";
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: `C${color}${data.finalized[index] ? "*" : ""}`,
            value: color,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, color, confidence: data.confidence[index] ?? 0, finalized: data.finalized[index] ?? false },
        };
    });
}

/** The Avalanche generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        colors?: number[]; rounds?: number; k?: number; alpha?: number; beta?: number; seed?: number;
    } | null) ?? {};
    const initialColors = Array.isArray(task.colors) && task.colors.length > 0
        ? task.colors.map((c) => (typeof c === "number" ? c : 0))
        : [0, 0, 0, 1, 1];
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.floor(task.rounds)) : 6;
    const k = typeof task.k === "number" ? Math.max(1, Math.floor(task.k)) : Math.max(1, initialColors.length - 1);
    const alpha = typeof task.alpha === "number" ? Math.max(1, Math.floor(task.alpha)) : Math.ceil(k / 2);
    const beta = typeof task.beta === "number" ? Math.max(1, Math.floor(task.beta)) : 3;
    const seed = typeof task.seed === "number" ? task.seed : 7;
    const n = initialColors.length;

    yield {
        stepNumber: 0,
        entities: makeNodes(simulateAvalanche(initialColors, 0, k, alpha, beta, seed)),
        edges: [],
        description: `Avalanche with ${n} nodes: each node polls ${k} random peers and needs ${alpha} agreeing replies and ${beta} consecutive successes to finalize.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { nodes: n, round: 0, finalized: 0, colors: initialColors, phase: "setup" },
    };

    for (let round = 1; round <= rounds; round += 1) {
        const data = simulateAvalanche(initialColors, round, k, alpha, beta, seed);
        yield {
            stepNumber: round,
            entities: makeNodes(data),
            edges: [],
            description: `Poll ${round}: ${data.finalized.filter(Boolean).length} of ${n} node(s) finalized; preferences [${data.colors.join(", ")}].`,
            codeLineNumber: round < rounds ? 2 : 5,
            layout: "graph",
            meta: {
                nodes: n,
                round,
                finalized: data.finalized.filter(Boolean).length,
                colors: data.colors,
                confidence: data.confidence,
                finalizedFlags: data.finalized.map((f) => (f ? 1 : 0)),
                phase: "poll",
            },
        };
    }
}

/** The Avalanche module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Ask a few randomly chosen neighbors what they think, not everybody. If a clear majority of that small sample disagrees with you, change your mind. If several samples in a row agree with your current choice, lock it in. A strong initial majority snowballs through the network, and once a node has enough consecutive confirmations its decision is final.",
        invariants: [
            "A node switches color only when at least alpha sampled peers prefer another color.",
            "Confidence counts consecutive agreeing polls and resets otherwise.",
            "A finalized node never changes its color again.",
        ],
        correctness:
            "When one color has a strict majority, any sample of peers favors that color in expectation, and a node that adopts it keeps seeing it in later samples, so confidence reaches beta and the node finalizes. Safety follows because two finalized colors would require a run of beta consecutive alpha-majority polls for each from overlapping node populations; once a supermajority of nodes holds one color, later polls cannot produce the required majority for a rival color. Random subsampling therefore converges to the initial majority with high probability.",
        complexityRationale:
            "Each of the rounds polls k peers at each of N nodes, so the work is O(rounds * N * k), independent of the full network size per poll. State per node is its color, a confidence counter, and a finalized flag, giving O(N) space.",
        uses: [
            "Avalanche family ledgers such as Avalanche and Snowtrace consensus",
            "Fast agreement in large, well-connected peer-to-peer networks",
            "Teaching probabilistic consensus and metastability",
        ],
        references: [
            "Beckstrom, Rohrer, and Vural, Avalanche Consensus White Paper, 2019",
            "Beckstrom, Snowball to Avalanche: A Family of Consensus Protocols, 2018",
        ],
        workedExample:
            "Five nodes start as colors 0, 0, 0, 1, 1 and each node polls the other four with alpha three and beta three. The minority nodes see three zeros in their sample and switch to zero; repeated agreeing polls then raise confidence to three for every node, so all five finalize on color zero.",
    },
    id: "avalanche-consensus",
    name: "Avalanche Consensus",
    category: "parallel-distributed",
    complexity: { time: "O(rounds*N*k)", space: "O(N)" },
    defaultInput: { colors: [0, 0, 0, 1, 1], rounds: 6, k: 4, alpha: 2, beta: 3, seed: 7 },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize every node with a color and zero confidence",
        "repeat for a number of polling rounds",
        "choose k random peers and tally their colors",
        "if a color has alpha votes adopt it and reset confidence to one",
        "otherwise if it matches the current color increment confidence",
        "clear confidence when no color reaches alpha",
        "finalize a node when confidence reaches beta",
        "done: report the final colors and finalized nodes",
    ],
};

export default module;
