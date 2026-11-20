/**
 * read-repair.ts - Read Repair in a Replicated Key-Value Store
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dynamo-style stores keep several replicas of each key. When a coordinator
 * reads a key it asks every replica, compares their version stamps, elects the
 * newest value as the winner, and writes that value back to any replica that
 * answered with an older version. This opportunistic repair heals divergence
 * caused by a write that reached only a subset of replicas, without a separate
 * anti-entropy sweep.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) for r replicas (one read and comparison per replica)
 *   Space: O(r) for the gathered replies and the repair list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per replica shows its value and version stamp.
 *   - Stale replicas are red, the winning replicas are green, and repaired
 *     replicas are highlighted as they are written back.
 *   - Metadata reports the winner, the stale list, and the number of repairs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Replica {
    value: string;
    version: number;
}

interface ReadRepairInput {
    replicas?: Replica[];
}

function normalize(input: unknown): Replica[] {
    const task = (input as ReadRepairInput | null) ?? {};
    const raw = Array.isArray(task.replicas) && task.replicas.length > 0
        ? task.replicas
        : [
              { value: "blue", version: 3 },
              { value: "blue", version: 3 },
              { value: "blue", version: 3 },
              { value: "red", version: 2 },
          ];
    return raw.map((r) => ({
        value: String(r?.value ?? ""),
        version: Math.max(0, Math.floor(Number(r?.version ?? 0)) || 0),
    })).slice(0, 16);
}

function makeEntities(
    replicas: Replica[],
    stale: Set<number>,
    winners: Set<number>,
    repaired: Set<number>,
    phase: "gather" | "compare" | "repair" | "done",
): VisualEntity[] {
    return replicas.map((replica, index) => {
        let state: EntityState = "idle";
        if (phase === "compare" || phase === "repair" || phase === "done") {
            if (repaired.has(index)) state = "sorted";
            else if (winners.has(index)) state = "path";
            else if (stale.has(index)) state = phase === "done" ? "sorted" : "error";
        }
        return {
            id: `replica-${index}`,
            type: "cell",
            label: `${replica.value}@${replica.version}`,
            value: `${replica.value}@${replica.version}`,
            state,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                col: index,
                row: 0,
                index,
                value: replica.value,
                version: replica.version,
            },
        };
    });
}

/** The read-repair generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const replicas = normalize(input);
    const maxVersion = Math.max(...replicas.map((r) => r.version));
    const winners = new Set<number>();
    const stale = new Set<number>();
    replicas.forEach((r, index) => {
        if (r.version === maxVersion) winners.add(index);
        else stale.add(index);
    });
    // Majority value among the up-to-date replicas is the winning value.
    const tally = new Map<string, number>();
    for (const index of winners) {
        const value = replicas[index]!.value;
        tally.set(value, (tally.get(value) ?? 0) + 1);
    }
    let winningValue = "";
    let bestCount = -1;
    for (const [value, count] of tally) {
        if (count > bestCount) {
            winningValue = value;
            bestCount = count;
        }
    }
    const distinctWinnerValues = new Set([...winners].map((i) => replicas[i]!.value));
    const conflict = distinctWinnerValues.size > 1 && bestCount * 2 <= winners.size;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(replicas, stale, winners, new Set(), "gather"),
        edges: [],
        description: `Coordinator reads key from ${replicas.length} replicas and gathers their versioned values.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { replicas: replicas.length, maxVersion: 0, winningValue: "", stale: [], repairs: 0, conflict: false, rows: 1, cols: replicas.length },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(replicas, stale, winners, new Set(), "compare"),
        edges: [],
        description: `Comparing stamps: newest version is ${maxVersion}; ${stale.size} replica(s) are stale.${conflict ? " Top-version values disagree (conflict)." : ""}`,
        codeLineNumber: 1,
        layout: "grid",
        meta: {
            replicas: replicas.length,
            maxVersion,
            winningValue,
            stale: [...stale],
            repairs: 0,
            conflict,
            rows: 1,
            cols: replicas.length,
        },
    };
    step += 1;

    const repaired = new Set<number>();
    for (const index of [...stale].sort((a, b) => a - b)) {
        replicas[index] = { value: winningValue, version: maxVersion };
        repaired.add(index);
        yield {
            stepNumber: step,
            entities: makeEntities(replicas, stale, winners, repaired, "repair"),
            edges: [],
            description: `Repairing replica ${index}: writing "${winningValue}" at version ${maxVersion}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                replicas: replicas.length,
                maxVersion,
                winningValue,
                stale: [...stale],
                repairs: repaired.size,
                conflict,
                rows: 1,
                cols: replicas.length,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(replicas, new Set(), winners, new Set(replicas.keys()), "done"),
        edges: [],
        description: `Read repair complete: ${repaired.size} write(s) issued; all replicas now agree on "${winningValue}" at version ${maxVersion}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            replicas: replicas.length,
            maxVersion,
            winningValue,
            stale: [],
            repairs: repaired.size,
            conflict,
            finalValues: replicas.map((r) => `${r.value}@${r.version}`),
            done: true,
            rows: 1,
            cols: replicas.length,
        },
    };
}

/** The read-repair module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When several copies of a record drift apart, a read is a free chance to fix them. Ask every replica for its value and version stamp, treat the newest stamp as authoritative, and write that value back to every lagging replica. Reads gradually heal the store instead of waiting for a background repair job.",
        invariants: [
            "A winner is a replica whose version equals the maximum observed version.",
            "Every stale replica has a version strictly less than the maximum.",
            "A repair only writes the winning value at the winning version, never an older one.",
        ],
        correctness:
            "The maximum version is the most recent write observed, so its value is the authoritative one (with a majority breaking ties among equal stamps). Every repair writes exactly that value and stamp to a replica whose stamp was older, which cannot lose newer data. After all stale replicas are repaired, every replica holds the same newest version, so a subsequent read is consistent.",
        complexityRationale:
            "The coordinator performs one comparison per replica and one write per stale replica, so the work is O(r) time and O(r) space for r replicas. This is far cheaper than a full anti-entropy scan of the entire keyspace.",
        uses: [
            "Dynamo-style eventually consistent key-value stores",
            "Quorum reads that reconcile divergent replicas",
            "Healing partially applied writes after a network partition",
        ],
        references: [
            "DeCandia et al., Dynamo: Amazon's Highly Available Key-value Store, 2007",
            "Lakshman and Malik, Cassandra: A Decentralized Structured Storage System, 2010",
        ],
        workedExample:
            "Four replicas report blue@3, blue@3, blue@3, and red@2. The newest version is 3 and all three up-to-date replicas agree on blue, so blue is the winner. The red@2 replica is stale and is rewritten to blue@3, leaving all four replicas equal.",
    },
    id: "read-repair",
    name: "Read Repair",
    category: "parallel-distributed",
    complexity: { time: "O(r)", space: "O(r)" },
    defaultInput: {
        replicas: [
            { value: "blue", version: 3 },
            { value: "blue", version: 3 },
            { value: "blue", version: 3 },
            { value: "red", version: 2 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the key from every replica",
        "find the maximum version stamp",
        "select the winning value among newest replicas",
        "mark every replica with an older stamp stale",
        "write the winning value to each stale replica",
        "done: report the repairs and final agreement",
    ],
};

export default module;
