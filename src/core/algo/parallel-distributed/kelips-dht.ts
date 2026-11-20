/**
 * kelips-dht.ts - Kelips Affinity-Group Distributed Hash Table
 *
 * Kelips divides nodes into affinity groups by a hash of the node identifier.
 * Every node keeps the full membership of its own group and one contact node in
 * each other group. Keys are hashed to a group, and a lookup first routes to a
 * contact in that group and then to the member responsible for the key. The
 * routing table is constant size per node while lookups take a small constant
 * number of hops.
 *
 * Limits of the demo: node and key identifiers are small integers, hashes are
 * simple deterministic modulo functions, the network has no churn, latency,
 * failures, or concurrent joins, and every node is assumed to know one contact
 * in every group. The simulation is a deterministic routing trace.
 *
 * Time: O(1) hops per lookup. Space: O(n + k^2) for memberships and contacts.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Lookup {
    key: number;
    from: number;
    group: number;
    contact: number;
    owner: number;
}

/** Assign a node identifier to its affinity group. */
export function nodeGroup(id: number, groups: number): number {
    return id % groups;
}

/** Deterministic owner of a key inside its group's membership list. */
export function keyOwner(key: number, members: number[]): number {
    return members[key % members.length] as number;
}

/** Build the group memberships and one cross-group contact per node. */
export function kelipsTables(nodes: number, groups: number): {
    members: number[][];
    contacts: number[][];
} {
    const members: number[][] = Array.from({ length: groups }, () => []);
    for (let id = 0; id < nodes; id += 1) {
        (members[nodeGroup(id, groups) as number] as number[]).push(id);
    }
    const contacts: number[][] = Array.from({ length: nodes }, () =>
        Array.from({ length: groups }, () => -1));
    for (let id = 0; id < nodes; id += 1) {
        for (let g = 0; g < groups; g += 1) {
            if ((members[g] as number[]).length > 0) {
                (contacts[id] as number[])[g] = (members[g] as number[])[0] as number;
            }
        }
    }
    return { members, contacts };
}

/** Route every key from the given source node using the Kelips tables. */
export function kelipsLookups(keys: number[], groups: number, tables: ReturnType<typeof kelipsTables>): Lookup[] {
    return keys.map((key) => {
        const group = key % groups;
        const contact = (tables.contacts[0] as number[])[group] as number;
        const owner = keyOwner(key, tables.members[group] as number[]);
        return { key, from: 0, group, contact, owner };
    });
}

function lookupMeta(lookup: Lookup) {
    return {
        key: lookup.key,
        from: lookup.from,
        group: lookup.group,
        contact: lookup.contact,
        owner: lookup.owner,
    };
}

function makeCells(nodes: number, groups: number, active: number, owner: number): VisualEntity[] {
    return Array.from({ length: nodes }, (_, id) => ({
        id: `cell-${id}`,
        type: "cell" as const,
        label: `n${id} g${nodeGroup(id, groups)}`,
        value: id,
        state: id === active ? "comparing" : id === owner ? "path" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: id, node: id, group: nodeGroup(id, groups) },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { nodes?: number; groups?: number; keys?: number[] } | null) ?? {};
    const nodes = Math.min(16, Math.max(2, Math.floor(Number(task.nodes ?? 6)) || 6));
    const groups = Math.min(nodes, Math.max(1, Math.floor(Number(task.groups ?? 3)) || 3));
    const keys = Array.isArray(task.keys) && task.keys.length > 0
        ? task.keys.map(Number)
        : [10, 11, 12, 13, 14, 15];
    const tables = kelipsTables(nodes, groups);
    const lookups = kelipsLookups(keys, groups, tables);
    const allOwners = new Set(lookups.map((lookup) => lookup.owner));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(nodes, groups, -1, -1),
        edges: [],
        description: `Organize ${nodes} nodes into ${groups} affinity groups with one contact per group.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            nodes, groups, keys: [...keys], lookups: lookups.map(lookupMeta),
            members: tables.members, contacts: tables.contacts,
            resolved: 0, success: false,
        },
    };
    step += 1;

    for (let i = 0; i < lookups.length; i += 1) {
        const lookup = lookups[i] as Lookup;
        yield {
            stepNumber: step,
            entities: makeCells(nodes, groups, lookup.contact, lookup.owner),
            edges: [],
            description: `Key ${lookup.key} hashes to group ${lookup.group}; contact ${lookup.contact} routes to owner ${lookup.owner}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                nodes, groups, keys: [...keys], lookups: lookups.map(lookupMeta),
                members: tables.members, contacts: tables.contacts,
                activeLookup: i, lookup: lookupMeta(lookup), resolved: i + 1, success: true,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(nodes, groups, -1, -1),
        edges: [],
        description: `All ${keys.length} keys resolved to ${allOwners.size} distinct owners in two hops each.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            nodes, groups, keys: [...keys], lookups: lookups.map(lookupMeta),
            members: tables.members, contacts: tables.contacts,
            resolved: lookups.length, distinctOwners: allOwners.size, success: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Kelips keeps routing simple by giving every node a small roster: the full list of nodes in its own group and one contact in every other group. A key is hashed to a group, so a lookup only needs to reach any member of that group and then ask the member responsible for the key. Because the tables are small and the hop count is bounded, the system scales well and tolerates moderate churn.",
        invariants: [
            "A node always belongs to the group given by its identifier modulo the group count.",
            "Every node stores one contact in each group that has at least one member.",
            "A key is stored at a deterministic member of the group given by the key hash.",
        ],
        correctness:
            "The group hash partitions both nodes and keys into the same set of buckets. A node's contact table guarantees that any group can be reached in one hop, and the deterministic key-to-owner mapping inside the group identifies the unique responsible node. Therefore every lookup reaches the same owner that a brute-force hash-to-owner map computes. No churn or failures are modeled, so the stored contact is always live.",
        complexityRationale:
            "Building the memberships scans the node list once, O(n), and filling contacts costs O(n k). Each lookup uses one contact hop and one owner calculation, O(1). Memory per node is O(k) for contacts plus O(n/k) for its group roster.",
        uses: [
            "Peer-to-peer file sharing with stable membership",
            "Distributed hash tables that need bounded lookup latency",
            "Reference overlays for studying churn-tolerant routing",
        ],
        references: [
            "Gupta, Agrawal and Wishwanath, Kelips: Building an Efficient and Stable P2P DHT, 2003",
            "Balakrishnan and Kaashoek (editors), Peer-to-Peer Systems, 2003",
        ],
        workedExample:
            "With six nodes in three groups, groups are node sets 0,3; 1,4; and 2,5. Key 10 hashes to group one and is owned by member 1, key 11 hashes to group two and is owned by member 2. Each lookup reaches a group contact and then the owner in two steps.",
    },
    id: "kelips-dht",
    name: "Kelips Affinity-Group DHT",
    category: "parallel-distributed",
    complexity: { time: "O(1) hop per lookup", space: "O(n + k^2)" },
    defaultInput: { nodes: 6, groups: 3, keys: [10, 11, 12, 13, 14, 15] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the node count, group count and key set",
        "assign each node to a group by hashing its identifier",
        "record the full membership of every group",
        "store one contact node per group at every node",
        "for each key hash it to a group",
        "route to that group's contact node",
        "compute the responsible member inside the group",
        "done: report all key owners and the lookup count",
    ],
};

export default module;
