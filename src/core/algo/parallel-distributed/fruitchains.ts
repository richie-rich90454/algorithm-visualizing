/**
 * fruitchains.ts - FruitChains Fair Blockchain
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FruitChains separates the tasks of proposing transactions and extending the
 * chain. Miners produce lightweight "fruits" that carry transactions, and
 * heavier "blocks" that simply reference a batch of fruits and form the longest
 * chain. Because a block does not need to contain the transactions itself, a
 * miner cannot gain extra reward by withholding fruits, and the protocol gives
 * each miner a share of block rewards close to its share of hashing power.
 *
 * This is a deterministic teaching simulation. A fixed linear congruential
 * generator assigns fruits and blocks to miners according to their power, then
 * packs fruits into blocks in order and links the blocks into a chain. It models
 * fruit accounting and chain linking, but not proof-of-work hashing, forks, or
 * difficulty adjustment.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(fruits + blocks) to assign fruits and link blocks
 *   Space: O(fruits + blocks) for the chain and fruit ledger
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show which block holds each fruit slot and its miner.
 *   - The block currently being filled is highlighted yellow.
 *   - meta carries the fruit ledger, block list, and chain links.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FruitChainInput {
    miners?: number;
    fruits?: number;
    fruitsPerBlock?: number;
    seed?: number;
}

function makeCells(blocks: number[][], blockMiners: number[], fruitsPerBlock: number, active: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let block = 0; block < blocks.length; block += 1) {
        for (let slot = 0; slot < fruitsPerBlock; slot += 1) {
            const fruit = blocks[block]?.[slot];
            const value = fruit === undefined ? -1 : fruit;
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (block === active) {
                state = "active";
            }
            entities.push({
                id: `cell-${block}-${slot}`,
                type: "cell" as const,
                label: fruit === undefined ? "empty" : `f${fruit}/m${blockMiners[block] ?? 0}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: block, col: slot, block, slot, fruit: value, miner: blockMiners[block] ?? 0 },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FruitChainInput | null) ?? {};
    const miners = Math.min(8, Math.max(1, Math.floor(Number(task.miners ?? 3)) || 3));
    const fruitCount = Math.min(64, Math.max(1, Math.floor(Number(task.fruits ?? 12)) || 12));
    const fruitsPerBlock = Math.min(8, Math.max(1, Math.floor(Number(task.fruitsPerBlock ?? 3)) || 3));
    const seed = Math.floor(Number(task.seed ?? 7)) || 7;
    let state = seed >>> 0;
    const nextRandom = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };

    const fruitMiners: number[] = [];
    for (let fruit = 0; fruit < fruitCount; fruit += 1) {
        fruitMiners.push(Math.min(miners - 1, Math.floor(nextRandom() * miners)));
    }
    const blockCount = Math.ceil(fruitCount / fruitsPerBlock);
    const blockMiners: number[] = [];
    for (let block = 0; block < blockCount; block += 1) {
        blockMiners.push(Math.min(miners - 1, Math.floor(nextRandom() * miners)));
    }
    const blocks: number[][] = Array.from({ length: blockCount }, () => []);
    for (let fruit = 0; fruit < fruitCount; fruit += 1) {
        const block = Math.floor(fruit / fruitsPerBlock);
        blocks[block]?.push(fruit);
    }
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(blocks, blockMiners, fruitsPerBlock, -1, false),
        edges: [],
        description: `${fruitCount} fruits assigned to ${miners} miners; packing into ${blockCount} block(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { miners, fruits: fruitCount, fruitsPerBlock, blocks: blockCount, fruitMiners, blockMiners, chain: [], done: false },
    };
    step += 1;

    const chain: Array<{ height: number; miner: number; fruits: number[]; parent: number | null }> = [];
    for (let block = 0; block < blockCount; block += 1) {
        chain.push({
            height: block,
            miner: blockMiners[block] ?? 0,
            fruits: blocks[block] ?? [],
            parent: block === 0 ? null : block - 1,
        });
        yield {
            stepNumber: step,
            entities: makeCells(blocks, blockMiners, fruitsPerBlock, block, false),
            edges: [],
            description: `Block ${block} mined by miner ${blockMiners[block]} references ${(blocks[block] ?? []).length} fruit(s) with parent ${block === 0 ? "genesis" : block - 1}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { miners, fruits: fruitCount, fruitsPerBlock, blocks: blockCount, fruitMiners, blockMiners, chain: [...chain], done: false, block },
        };
        step += 1;
    }

    const allFruits = chain.flatMap((block) => block.fruits);
    const uniqueFruits = new Set(allFruits);
    const valid = uniqueFruits.size === fruitCount && chain.every((block, index) => block.parent === (index === 0 ? null : index - 1));
    yield {
        stepNumber: step,
        entities: makeCells(blocks, blockMiners, fruitsPerBlock, -1, valid),
        edges: [],
        description: `Chain of ${blockCount} block(s) contains ${uniqueFruits.size} distinct fruit(s); ${valid ? "all fruits are included exactly once" : "chain validation failed"}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { miners, fruits: fruitCount, fruitsPerBlock, blocks: blockCount, fruitMiners, blockMiners, chain, included: allFruits.length, unique: uniqueFruits.size, valid, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In a normal blockchain, the miner who extends the chain also has to choose and order every transaction, which creates incentives to reorder or withhold. FruitChains splits the job: small fruits carry transactions, and blocks only commit to a batch of fruits. Because a block is cheap to propose, the chain grows quickly and a miner's block share tracks its hashing power rather than its luck at assembling transactions.",
        invariants: [
            "Every fruit is assigned to exactly one miner by the deterministic draw.",
            "Fruits are packed into blocks in order, each fruit appearing once.",
            "Every block after the first points to the immediately preceding block.",
        ],
        correctness:
            "The simulation assigns each fruit and each block by a seeded pseudo-random draw, then places fruit number i into block floor(i divided by fruits per block), which partitions the fruit set into disjoint consecutive batches. The chain is built by linking block number i to block i minus one, so it is a single valid chain with a genesis predecessor. Counting distinct fruit identifiers equal to the fruit total certifies that no fruit was lost or duplicated, which is the structural guarantee the fairness argument builds on.",
        complexityRationale:
            "Assigning fruits and block miners and then packing the fruits scans each item a constant number of times, so the simulation is O(fruits plus blocks) time. The fruit ledger and block chain are stored explicitly, which is O(fruits plus blocks) space.",
        uses: [
            "Fair reward distribution in proof-of-work blockchains",
            "Teaching the separation of transaction ordering from chain extension",
            "A model for scalable blockchain designs with lightweight proposals",
        ],
        references: [
            "Pass and Shi, FruitChains: A Fair Blockchain, 2017",
            "Nakamoto, Bitcoin: A Peer-to-Peer Electronic Cash System, 2008",
        ],
        workedExample:
            "With three miners, twelve fruits and three fruits per block, the seeded draws assign fruits to miners and produce four blocks. Fruits zero through two go in block zero, three through five in block one, and so on. The final chain has four links to genesis and contains all twelve fruits exactly once.",
    },
    id: "fruitchains",
    name: "FruitChains Fair Blockchain",
    category: "parallel-distributed",
    complexity: { time: "O(fruits + blocks)", space: "O(fruits + blocks)" },
    defaultInput: {
        miners: 3,
        fruits: 12,
        fruitsPerBlock: 3,
        seed: 7,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "seed a deterministic pseudo-random generator",
        "assign each fruit to a miner by hashing power share",
        "assign each block to a miner by hashing power share",
        "pack fruits into consecutive blocks of fixed size",
        "link every block to its predecessor starting at genesis",
        "collect the fruits referenced by all blocks",
        "verify every fruit appears exactly once",
        "done: report the valid fruit block chain",
    ],
};

export default module;
