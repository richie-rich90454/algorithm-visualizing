/**
 * merkle-patricia-tree.ts - Merkle Patricia Trie (small exact model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Merkle Patricia trie stores key/value pairs in a radix tree whose nodes
 * hold a cryptographic hash of their subtree. Path compression merges chains
 * of single children, and each node's hash is derived from its path fragment,
 * its value, and the ordered hashes of its children. The root hash therefore
 * commits to every key and value in the structure: changing one value changes
 * the root hash.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is a SMALL TEACHING MODEL. Keys are hexadecimal nibble strings and the
 * node hash is a 32-bit FNV-1a checksum, chosen so the full structure can be
 * replayed on a canvas. FNV-1a is NOT a production-strength cryptographic
 * hash: it is not collision resistant. Use a real hash such as Keccak-256 in
 * any security-sensitive Merkle tree. The trie and hashing steps shown here
 * are mathematically exact for the toy hash.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(total key length) insertions; O(number of nodes) hashing
 *   Space: O(total key length) for the compressed trie
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Trie nodes are circles; edges connect a parent to each child.
 *   - A freshly inserted node is yellow; a node just hashed is purple.
 *   - The root is green on the final frame and its hash is reported.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface TrieNode {
    id: string;
    prefix: string;
    value: string | null;
    children: Map<string, TrieNode>;
}

let nextId = 0;
function newId(): string {
    nextId += 1;
    return `node-${nextId}`;
}

/** Deterministic 32-bit FNV-1a over a canonical string (toy hash, not secure). */
function toyHash(text: string): string {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Insert a key/value pair into the compressed trie rooted at the given node. */
function insert(root: TrieNode, key: string, value: string): void {
    let node = root;
    let consumed = 0;
    for (;;) {
        const remaining = key.slice(consumed);
        if (remaining === "") {
            node.value = value;
            return;
        }
        const nibble = remaining[0] ?? "";
        const child = node.children.get(nibble);
        if (!child) {
            node.children.set(nibble, {
                id: newId(),
                prefix: remaining,
                value,
                children: new Map(),
            });
            return;
        }
        let common = 0;
        while (
            common < child.prefix.length &&
            common < remaining.length &&
            child.prefix[common] === remaining[common]
        ) {
            common += 1;
        }
        if (common === child.prefix.length) {
            node = child;
            consumed += common;
            continue;
        }
        const split: TrieNode = {
            id: newId(),
            prefix: child.prefix.slice(0, common),
            value: null,
            children: new Map(),
        };
        const lower: TrieNode = {
            id: child.id,
            prefix: child.prefix.slice(common),
            value: child.value,
            children: child.children,
        };
        split.children.set(lower.prefix[0] ?? "", lower);
        node.children.set(nibble, split);
        const tail = remaining.slice(common);
        if (tail === "") {
            split.value = value;
        } else {
            split.children.set(tail[0] ?? "", {
                id: newId(),
                prefix: tail,
                value,
                children: new Map(),
            });
        }
        return;
    }
}

/** Look up a key by walking the compressed trie. */
function lookup(root: TrieNode, key: string): string | null {
    let node = root;
    let consumed = 0;
    while (consumed < key.length) {
        const nibble = key[consumed];
        const child = nibble === undefined ? undefined : node.children.get(nibble);
        if (!child || !key.startsWith(child.prefix, consumed)) {
            return null;
        }
        node = child;
        consumed += child.prefix.length;
    }
    return consumed === key.length ? node.value : null;
}

/** Compute the hash of every node bottom-up, keyed by node id. */
function hashAll(node: TrieNode, hashes: Map<string, string>): string {
    const parts: string[] = [node.prefix, node.value ?? ""];
    const entries = [...node.children.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [nibble, child] of entries) {
        parts.push(`${nibble}:${hashAll(child, hashes)}`);
    }
    const hash = toyHash(parts.join("|"));
    hashes.set(node.id, hash);
    return hash;
}

/** Collect nodes in post-order so hashing can be shown one node at a time. */
function postOrder(node: TrieNode, out: TrieNode[] = []): TrieNode[] {
    const entries = [...node.children.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [, child] of entries) {
        postOrder(child, out);
    }
    out.push(node);
    return out;
}

/** Build the drawable trie: node entities plus parent-to-child edges. */
function toDrawing(
    root: TrieNode,
    hashes: Map<string, string>,
    highlighted: string | null,
    state: EntityState,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const walk = (node: TrieNode, parent: string | null, depth: number): void => {
        const hash = hashes.get(node.id) ?? "";
        const fragment = node.prefix === "" ? "root" : node.prefix;
        const short = fragment.length > 6 ? `${fragment.slice(0, 4)}..` : fragment;
        entities.push({
            id: node.id,
            type: "node",
            label: hash ? `${short}:${hash.slice(0, 4)}` : short,
            value: { prefix: node.prefix, value: node.value, hash },
            state:
                node.id === highlighted
                    ? state
                    : node.id === root.id && hashes.has(root.id)
                      ? "sorted"
                      : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent ?? "", depth, prefix: node.prefix, hash },
        });
        for (const [nibble, child] of [...node.children.entries()].sort((a, b) =>
            a[0].localeCompare(b[0]),
        )) {
            edges.push({
                id: `edge-${node.id}-${child.id}`,
                sourceId: node.id,
                targetId: child.id,
                label: nibble,
                state: "idle",
                directed: true,
            });
            walk(child, node.id, depth + 1);
        }
    };
    walk(root, null, 0);
    return { entities, edges };
}

/** The Merkle Patricia trie generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { entries?: Array<[string, string]>; query?: string } | null
    ) ?? {};
    const raw = Array.isArray(task.entries) ? task.entries : [];
    const entries: Array<[string, string]> = raw
        .filter((pair): pair is [string, string] => Array.isArray(pair) && pair.length === 2)
        .map(([key, value]) => [String(key), String(value)]);
    nextId = 0;
    const root: TrieNode = { id: newId(), prefix: "", value: null, children: new Map() };
    const hashes = new Map<string, string>();
    let step = 0;

    const frame = (
        highlighted: string | null,
        state: EntityState,
        description: string,
        line: number,
        rootHash: string,
    ): VisualFrame => {
        const drawing = toDrawing(root, hashes, highlighted, state);
        return {
            stepNumber: step,
            entities: drawing.entities,
            edges: drawing.edges,
            description,
            codeLineNumber: line,
            layout: "tree",
            meta: { nodes: drawing.entities.length, rootHash, entries: entries.length },
        };
    };

    yield frame(null, "idle", "Start with an empty compressed trie and an empty hash map.", 0, "");
    step += 1;

    for (const [key, value] of entries) {
        insert(root, key, value);
        yield frame(
            null,
            "idle",
            `Insert key "${key}" with value "${value}"; shared prefixes are compressed into one node.`,
            1,
            "",
        );
        step += 1;
    }

    for (const node of postOrder(root)) {
        const hash = hashAll(node, new Map(hashes));
        hashes.set(node.id, hash);
        yield frame(
            node.id,
            "comparing",
            `Hash node "${node.prefix === "" ? "root" : node.prefix}": FNV-1a gives ${hash}.`,
            3,
            "",
        );
        step += 1;
    }

    const rootHash = hashes.get(root.id) ?? toyHash("");
    const query = typeof task.query === "string" ? task.query : null;
    const queryValue = query === null ? null : lookup(root, query);
    yield {
        ...frame(
            root.id,
            "sorted",
            `Root hash ${rootHash} commits to all ${entries.length} entry or entries.`,
            5,
            rootHash,
        ),
        meta: {
            nodes: toDrawing(root, hashes, null, "idle").entities.length,
            rootHash,
            entries: entries.length,
            query: query ?? "",
            queryValue: queryValue ?? "",
            queryFound: queryValue !== null,
        },
    };
}

/** The Merkle Patricia trie module (small exact teaching model). */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Store keys in a radix trie so that shared prefixes collapse into a single branch, then give every node a hash of its own contents plus the ordered hashes of its children. Because a parent's hash depends on its children, the root hash summarizes the whole structure. Change one value and the hash on the path to the root changes, which is exactly how a blockchain state root detects tampering.",
        invariants: [
            "A node's hash is a deterministic function of its path fragment, its value, and its ordered child hashes.",
            "Path compression guarantees no internal node has exactly one child without a stored value.",
            "The lookup walk follows each key's nibbles through node prefixes to the value.",
        ],
        correctness:
            "Induction on the tree gives the result. A leaf's hash commits to its key fragment and value. An internal node's hash commits to its fragment and to every child hash, so by induction it commits to the entire subtree beneath it. At the root, any change to a stored key or value propagates a different hash up the path, so the root hash cannot stay the same when the data changes (for a collision-resistant hash).",
        complexityRationale:
            "Insertion walks one node per diverging prefix, so total work is linear in the summed key length. Hashing visits each node and concatenates its children, which is linear in the number of nodes. The compressed trie stores only the key symbols, so space is also linear in the summed key length.",
        uses: [
            "Cryptocurrency state commitments such as Ethereum's state trie",
            "Authenticating key/value stores and database snapshots",
            "Merkle proofs that a key holds a particular value",
        ],
        references: [
            "Ethereum Foundation, Ethereum Yellow Paper, Appendix D",
            "Merkle, Method of Providing Digital Signatures, 1988",
        ],
        workedExample:
            "Insert do=dog and d=dogg. The root branches on 'd'; one child holds 'o' with the shared remainder, and a value hangs on the shorter key. Hashing bottom-up yields a root digest (shown as eight hex digits) that changes if dog is replaced with cat.",
    },
    id: "merkle-patricia-tree",
    name: "Merkle Patricia Trie",
    category: "cryptography-security",
    complexity: { time: "O(total key length)", space: "O(total key length)" },
    defaultInput: {
        entries: [
            ["do", "dog"],
            ["dog", "puppy"],
            ["doge", "coin"],
            ["horse", "stallion"],
        ],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "create an empty root node",
        "for each key and value insert into the compressed trie",
        "split a child when a key diverges inside its prefix",
        "post-order traversal: hash children then the node",
        "combine fragment, value, and ordered child hashes",
        "done: report the root hash as the commitment",
    ],
};

export default module;
