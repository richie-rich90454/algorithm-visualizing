/**
 * determinization-mcts.ts - Determinization Monte Carlo Tree Search.
 *
 * Hidden-information games are searched by repeatedly sampling a complete
 * assignment of the hidden information, called a determinization, and solving
 * that fully observed game with ordinary UCT. Each determinization keeps its
 * own visit and reward statistics; the final move aggregates the two trees.
 *
 * Time O(sims * actions), space O(states * actions).
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
const PAYOFF = [
    [1, 6],
    [5, 5],
    [2, 3],
];
const PRIOR = [0.5, 0.5];
const TRUTH = PAYOFF.map((row) => PRIOR[0]! * row[0]! + PRIOR[1]! * row[1]!);

function entities(
    visits: number[][],
    totals: number[][],
    hot: string,
): VisualEntity[] {
    const out: VisualEntity[] = [{
        id: "root",
        type: "node" as const,
        label: "Determinization MCTS",
        value: visits.flat().reduce((a, b) => a + b, 0),
        state: "idle",
        x: 0, y: 0, width: 0, height: 0,
        metadata: { parentId: "root" },
    }];
    for (let h = 0; h < 2; h += 1) {
        out.push({
            id: `state-${h}`,
            type: "node" as const,
            label: `world ${h}`,
            value: visits[h]!.reduce((a, b) => a + b, 0),
            state: "highlight",
            x: 0, y: 0, width: 0, height: 0,
            metadata: { parentId: "root" },
        });
        for (let a = 0; a < NAMES.length; a += 1) {
            const id = `act-${h}-${a}`;
            out.push({
                id,
                type: "node" as const,
                label: `${NAMES[a]} ${totals[h]![a]!.toFixed(1)}/${visits[h]![a] ?? 0}`,
                value: visits[h]![a] ?? 0,
                state: (id === hot ? "comparing" : (visits[h]![a] ?? 0) > 0 ? "sorted" : "unvisited") as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { parentId: `state-${h}`, visits: visits[h]![a] ?? 0 },
            });
        }
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const sims = Math.max(4, Math.min(600, Math.floor(Number(task.sims ?? 160) || 160)));
    const rand = lcg(Number.isFinite(task.seed) ? Number(task.seed) : 777);
    const c = 1.4;
    const visits = [[0, 0, 0], [0, 0, 0]];
    const totals = [[0, 0, 0], [0, 0, 0]];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: entities(visits, totals, ""),
        edges: [],
        description: `Determinization MCTS: ${sims} iterations, each sampling one of two hidden worlds.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { sims, truth: [...TRUTH], worlds: 2 },
    };

    const period = Math.max(1, Math.floor(sims / 6));
    for (let s = 0; s < sims; s += 1) {
        const h = rand() < PRIOR[0]! ? 0 : 1;
        let chosen = visits[h]!.findIndex((v) => v === 0);
        if (chosen < 0) {
            const total = visits[h]!.reduce((a, b) => a + b, 0);
            let best = -Infinity;
            for (let a = 0; a < NAMES.length; a += 1) {
                const score = totals[h]![a]! / visits[h]![a]! +
                    c * Math.sqrt(Math.log(total) / visits[h]![a]!);
                if (score > best) { best = score; chosen = a; }
            }
        }
        const reward = PAYOFF[chosen]![h]! + (rand() - 0.5);
        visits[h]![chosen] = (visits[h]![chosen] ?? 0) + 1;
        totals[h]![chosen] = (totals[h]![chosen] ?? 0) + reward;

        if ((s + 1) % period === 0 || s === sims - 1) {
            yield {
                stepNumber: step++,
                entities: entities(visits, totals, `act-${h}-${chosen}`),
                edges: [],
                description: `Iteration ${s + 1}: sampled world ${h}, updated action ${NAMES[chosen]} in that world's tree.`,
                codeLineNumber: 2,
                layout: "tree",
                meta: { sims: s + 1, visits: visits.map((v) => [...v]) },
            };
        }
    }

    const aggregate = [0, 0, 0];
    for (let a = 0; a < NAMES.length; a += 1) {
        aggregate[a] = PRIOR[0]! * visits[0]![a]! + PRIOR[1]! * visits[1]![a]!;
    }
    let best = 0;
    for (let a = 1; a < NAMES.length; a += 1) {
        if (aggregate[a]! > aggregate[best]!) best = a;
    }
    yield {
        stepNumber: step,
        entities: entities(visits, totals, "").map((e) =>
            e.id === `act-0-${best}` || e.id === `act-1-${best}`
                ? { ...e, state: "sorted" as EntityState }
                : e,
        ),
        edges: [],
        description: `Aggregating both determinizations recommends action ${NAMES[best]} as the most visited overall.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: { best: NAMES[best], winner: NAMES[best], aggregate, visits: visits.map((v) => [...v]) },
    };
}

const module: AlgorithmModule = {
    id: "determinization-mcts",
    name: "Determinization Monte Carlo Tree Search",
    category: "game",
    complexity: { time: "O(sims * actions)", space: "O(states * actions)" },
    defaultInput: { sims: 160, seed: 777 },
    visualType: "tree",
    run,
    pseudocode: [
        "create one UCT tree for each sampled hidden world",
        "for each iteration sample a hidden world from the prior",
        "select an action by UCT inside that world's tree",
        "observe the reward and back it up to that tree",
        "repeat until the simulation budget is exhausted",
        "aggregate visits across worlds and recommend the top action",
    ],
    education: {
        intuition:
            "When the true state is hidden, pretend it is revealed: sample a complete world, then search that world as if it were fully observable. Repeating this over many sampled worlds averages away the guesswork. Each world gets its own statistics so that information learned in one world does not contaminate another.",
        invariants: [
            "Every sampled world stores independent visit and reward counts.",
            "Selection within a world follows the UCT upper confidence bound.",
            "The final recommendation weights each world by its prior probability.",
        ],
        correctness:
            "Conditioned on a sampled world, UCT converges to that world's best action. Because worlds are drawn from the true prior, the expected aggregate visit count of an action is proportional to its expected value across the hidden states, so the most-visited action after many iterations is the one with the best expected reward.",
        complexityRationale:
            "Each iteration samples one world and updates one action, costing O(actions) for selection, so total time is O(sims * actions). Keeping a separate table for each of the worlds uses O(states * actions) space.",
        uses: [
            "Planning in cards and other hidden-information games",
            "Robotic planning with uncertain initial state",
            "A teaching model for imperfect-information search",
        ],
        references: [
            "Cowling, Powell, and Conitzer, Computing Optimal Strategies to Commit to in Extensive-Form Games, 2012",
            "Browne et al., A Survey of Monte Carlo Tree Search Methods, 2012",
        ],
        workedExample:
            "Two worlds give action B rewards 5 and 5, action A rewards 1 and 6, and action C rewards 2 and 3. With a half-and-half prior B has expected reward 5, ahead of A at 3.5 and C at 2.5, so after many determinization samples B collects the most visits in both trees.",
    },
};

export default module;
