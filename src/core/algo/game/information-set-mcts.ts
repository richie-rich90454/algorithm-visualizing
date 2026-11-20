/**
 * information-set-mcts.ts - Information Set Monte Carlo Tree Search.
 *
 * In an imperfect-information game a player cannot tell which concrete state
 * they are in, only which information set they occupy. ISMCTS stores visit and
 * reward statistics on information-set nodes rather than on game states, and
 * each iteration samples one determinization consistent with the observation
 * before traversing the tree. The recommendation is a strategy: one move per
 * information set.
 *
 * Time O(sims * actions), space O(infoSets * actions).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Input = { sims?: number; seed?: number };

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const NAMES = ["A", "B", "C"];
const SETS = ["I0", "I1"];
/** Reward of each action inside each information set. */
const PAYOFF = [
    [1, 5, 2],
    [6, 4, 3],
];

function entities(
    visits: number[][],
    totals: number[][],
    hot: string,
): VisualEntity[] {
    const out: VisualEntity[] = [{
        id: "root",
        type: "node" as const,
        label: "Information Set MCTS",
        value: visits.flat().reduce((a, b) => a + b, 0),
        state: "idle",
        x: 0, y: 0, width: 0, height: 0,
        metadata: { parentId: "root" },
    }];
    for (let i = 0; i < SETS.length; i += 1) {
        out.push({
            id: `info-${i}`,
            type: "node" as const,
            label: SETS[i]!,
            value: visits[i]!.reduce((a, b) => a + b, 0),
            state: "highlight",
            x: 0, y: 0, width: 0, height: 0,
            metadata: { parentId: "root" },
        });
        for (let a = 0; a < NAMES.length; a += 1) {
            const id = `move-${i}-${a}`;
            out.push({
                id,
                type: "node" as const,
                label: `${NAMES[a]} ${totals[i]![a]!.toFixed(1)}/${visits[i]![a] ?? 0}`,
                value: visits[i]![a] ?? 0,
                state: (id === hot ? "comparing" : (visits[i]![a] ?? 0) > 0 ? "sorted" : "unvisited") as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { parentId: `info-${i}`, visits: visits[i]![a] ?? 0 },
            });
        }
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const sims = Math.max(6, Math.min(600, Math.floor(Number(task.sims ?? 180) || 180)));
    const rand = lcg(Number.isFinite(task.seed) ? Number(task.seed) : 31337);
    const c = 1.4;
    const visits = [[0, 0, 0], [0, 0, 0]];
    const totals = [[0, 0, 0], [0, 0, 0]];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: entities(visits, totals, ""),
        edges: [],
        description: `ISMCTS builds a strategy over ${SETS.length} information sets with ${NAMES.length} actions each, using ${sims} samples.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { sims, infoSets: [...SETS] },
    };

    const period = Math.max(1, Math.floor(sims / 6));
    for (let s = 0; s < sims; s += 1) {
        const info = rand() < 0.5 ? 0 : 1;
        let chosen = visits[info]!.findIndex((v) => v === 0);
        if (chosen < 0) {
            const total = visits[info]!.reduce((a, b) => a + b, 0);
            let best = -Infinity;
            for (let a = 0; a < NAMES.length; a += 1) {
                const score = totals[info]![a]! / visits[info]![a]! +
                    c * Math.sqrt(Math.log(total) / visits[info]![a]!);
                if (score > best) { best = score; chosen = a; }
            }
        }
        const reward = PAYOFF[info]![chosen]! + (rand() - 0.5);
        visits[info]![chosen] = (visits[info]![chosen] ?? 0) + 1;
        totals[info]![chosen] = (totals[info]![chosen] ?? 0) + reward;

        if ((s + 1) % period === 0 || s === sims - 1) {
            yield {
                stepNumber: step++,
                entities: entities(visits, totals, `move-${info}-${chosen}`),
                edges: [],
                description: `Sample ${s + 1}: information set ${SETS[info]} chose ${NAMES[chosen]} and stored the reward on its own node.`,
                codeLineNumber: 2,
                layout: "tree",
                meta: { sims: s + 1, visits: visits.map((v) => [...v]) },
            };
        }
    }

    const bestPerSet: number[] = [];
    for (let i = 0; i < SETS.length; i += 1) {
        let best = 0;
        for (let a = 1; a < NAMES.length; a += 1) {
            if ((visits[i]![a] ?? 0) > (visits[i]![best] ?? 0)) best = a;
        }
        bestPerSet.push(best);
    }
    yield {
        stepNumber: step,
        entities: entities(visits, totals, "").map((e) => {
            for (let i = 0; i < SETS.length; i += 1) {
                if (e.id === `move-${i}-${bestPerSet[i]}`) return { ...e, state: "sorted" as EntityState };
            }
            return e;
        }),
        edges: [],
        description: `Final strategy: ${SETS.map((s, i) => `${s} plays ${NAMES[bestPerSet[i]!]}`).join(", ")}.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: { best: bestPerSet.map((b) => NAMES[b]), winner: NAMES[bestPerSet[0]!] },
    };
}

const module: AlgorithmModule = {
    id: "information-set-mcts",
    name: "Information Set Monte Carlo Tree Search",
    category: "game",
    complexity: { time: "O(sims * actions)", space: "O(infoSets * actions)" },
    defaultInput: { sims: 180, seed: 31337 },
    visualType: "tree",
    run,
    pseudocode: [
        "create a tree node for each information set",
        "for every simulation sample a consistent determinization",
        "select an action by UCT at the current information set",
        "observe the sampled reward and back it up to that node",
        "repeat until the simulation budget is exhausted",
        "choose the most visited action in each information set",
    ],
    education: {
        intuition:
            "A player who cannot distinguish two states must use the same plan in both. ISMCTS reflects this by attaching statistics to information sets instead of to concrete states. Each iteration fills in one hidden detail, plays the game, and credits the information-set node that actually made the decision.",
        invariants: [
            "All states inside one information set share a single statistics node.",
            "Selection at each information set follows the UCT bound.",
            "The output assigns exactly one action to every information set.",
        ],
        correctness:
            "Because every sampled determinization is consistent with the observation, backing up to the shared node estimates the value of a single strategy across all states in the information set. UCT then concentrates visits on the action with the largest expected reward there, so the per-set recommendation is the best action available given the player's information.",
        complexityRationale:
            "Each simulation selects and updates one action, costing O(actions), so time is O(sims * actions). Storing one row of statistics per information set uses O(infoSets * actions) space.",
        uses: [
            "Computer poker and other imperfect-information games",
            "Planning under partial observability",
            "Computing a behavioral strategy rather than a single best move",
        ],
        references: [
            "Cowling, Powell, and Conitzer, Information Set Monte Carlo Tree Search, 2012",
            "Browne et al., A Survey of Monte Carlo Tree Search Methods, 2012",
        ],
        workedExample:
            "Two information sets I0 and I1 offer actions A, B, and C. In I0 action B pays 5 on average, while in I1 action A pays 6. After many samples the most-visited actions are B in I0 and A in I1, giving a valid strategy that depends only on what the player can observe.",
    },
};

export default module;
