/**
 * persistent-vector.ts - Persistent Vector (Bitmapped Vector Trie)
 *
 * A Clojure-style persistent vector: a wide, fixed-branching trie whose
 * leaves hold values plus a small tail buffer for the newest elements.
 * Every set or push copies only the path to the affected leaf, so old
 * versions stay valid and share all untouched nodes.
 *
 * Time:  O(log_32 n) get/set, amortized O(1) push
 * Space: O(n) shared nodes across versions
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const WIDTH = 4;
const BITS = 2;
const MASK = WIDTH - 1;

type Node = Array<number | Node | undefined>;

interface PVector {
    cnt: number;
    shift: number;
    root: Node;
    tail: number[];
}

const emptyNode = (): Node => new Array<number | Node | undefined>(WIDTH).fill(undefined);

function pushTail(level: number, parent: Node, leaf: Node, cnt: number): Node {
    const subidx = ((cnt - 1) >> level) & MASK;
    const copy = parent.slice();
    if (level === BITS) {
        copy[subidx] = leaf;
        return copy;
    }
    const child = parent[subidx];
    const base = child === undefined || typeof child === "number" ? emptyNode() : child;
    copy[subidx] = pushTail(level - BITS, base, leaf, cnt);
    return copy;
}

function tailOffset(v: PVector): number {
    return v.cnt < WIDTH ? 0 : ((v.cnt - 1) >> BITS) << BITS;
}

function arrayFor(v: PVector, index: number): Node {
    let node = v.root;
    let level = v.shift;
    while (level > 0) {
        const next = node[(index >> level) & MASK];
        node = typeof next === "number" || next === undefined ? emptyNode() : next;
        level -= BITS;
    }
    return node;
}

function get(v: PVector, index: number): number {
    if (index < 0 || index >= v.cnt) return Number.NaN;
    if (index >= tailOffset(v)) return v.tail[index - tailOffset(v)] ?? Number.NaN;
    const leaf = arrayFor(v, index);
    const value = leaf[index & MASK];
    return typeof value === "number" ? value : Number.NaN;
}

function conj(v: PVector, value: number): PVector {
    if (v.tail.length < WIDTH) {
        return { cnt: v.cnt + 1, shift: v.shift, root: v.root, tail: [...v.tail, value] };
    }
    const tailNode: Node = v.tail.slice();
    let root: Node;
    let shift = v.shift;
    if (v.cnt >> BITS > 1 << v.shift) {
        const grown = emptyNode();
        grown[0] = v.root;
        shift = v.shift + BITS;
        root = pushTail(shift, grown, tailNode, v.cnt);
    } else {
        root = pushTail(v.shift, v.root, tailNode, v.cnt);
    }
    return { cnt: v.cnt + 1, shift, root, tail: [value] };
}

function doAssoc(level: number, node: Node, index: number, value: number): Node {
    const copy = node.slice();
    if (level === 0) {
        copy[index & MASK] = value;
    } else {
        const subidx = (index >> level) & MASK;
        const child = copy[subidx];
        copy[subidx] = doAssoc(
            level - BITS,
            typeof child === "number" || child === undefined ? emptyNode() : child,
            index,
            value,
        );
    }
    return copy;
}

function set(v: PVector, index: number, value: number): PVector {
    if (index < 0 || index >= v.cnt) return v;
    if (index >= tailOffset(v)) {
        const tail = v.tail.slice();
        tail[index - tailOffset(v)] = value;
        return { ...v, tail };
    }
    return { ...v, root: doAssoc(v.shift, v.root, index, value) };
}

function flat(v: PVector): number[] {
    const out: number[] = [];
    for (let i = 0; i < v.cnt; i += 1) out.push(get(v, i));
    return out;
}

type Op = ["get", number] | ["set", number, number] | ["push", number];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; ops?: Op[] } | null) ?? {};
    const values = task.values ?? [1, 2, 3, 4, 5, 6, 7];
    const ops: Op[] = task.ops ?? [["get", 2], ["set", 2, 30], ["push", 8], ["get", 2]];

    let vec: PVector = { cnt: 0, shift: BITS, root: emptyNode(), tail: [] };
    let versions = 1;
    let step = 0;
    const gets: Array<{ index: number; value: number }> = [];

    const frame = (message: string, line: number, hot: number): VisualFrame => {
        const data = flat(vec);
        const entities: VisualEntity[] = data.map((value, i) => ({
            id: `slot-${i}`,
            type: "bar" as const,
            label: String(value),
            value,
            state: (i === hot ? "comparing" : i === data.length - 1 ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, chunk: i >> BITS },
        }));
        return {
            stepNumber: step,
            entities: entities.length > 0 ? entities : [],
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "array",
            meta: {
                count: vec.cnt,
                shift: vec.shift,
                versions,
                gets: gets.map((g) => g.value),
                tail: vec.tail.slice(),
            },
        };
    };

    for (const value of values) {
        vec = conj(vec, value);
        versions += 1;
    }
    yield frame(`Built persistent vector with ${values.length} values.`, 0, -1);
    step += 1;

    for (const op of ops) {
        if (op[0] === "get") {
            const value = get(vec, op[1]);
            gets.push({ index: op[1], value });
            yield frame(`get(${op[1]}) returns ${value} on the current version.`, 1, op[1]);
        } else if (op[0] === "set") {
            vec = set(vec, op[1], op[2]);
            versions += 1;
            yield frame(`set(${op[1]}, ${op[2]}) copies one path; old version survives.`, 2, op[1]);
        } else {
            vec = conj(vec, op[1]);
            versions += 1;
            yield frame(`push(${op[1]}) extends the trie or tail.`, 3, vec.cnt - 1);
        }
        step += 1;
    }

    yield frame(`Final vector [${flat(vec).join(", ")}] in ${versions} versions.`, 4, -1);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of the vector as a wide tree whose leaves hold up to four values, with a small tail holding the newest ones. To change one value you copy only the nodes on the path down to its leaf and share everything else, so an older version remains untouched. This is how functional languages offer array-like indexing without breaking immutability.",
        invariants: [
            "The trie leaves plus the tail store the values in index order.",
            "Each version's root and tail fully determine its contents.",
            "An update copies at most one node per trie level.",
        ],
        correctness:
            "Every index maps to a unique leaf slot through its high bits, and the tail covers indices beyond the last full chunk. get follows exactly that mapping. set and push rebuild only the nodes on one path while pointing all other children at the previous version's nodes, so the new version has the requested value and every older version keeps its original contents.",
        complexityRationale:
            "With branching factor 32 the trie depth is logarithmic in n, so get and set take O(log_32 n). A push inserts into the tail in O(1) until it fills, then copies one path, giving amortized O(1). All versions share nodes, so total space is O(n) plus one path per update.",
        uses: [
            "Immutable vectors in Clojure, Scala, and Rust crates",
            "Undo stacks and time-travel debugging in editors",
            "Persistent state in functional UI frameworks",
        ],
        references: [
            "Rich Hickey, Persistent Data Structures and Managed References, 2012",
            "Chris Okasaki, Purely Functional Data Structures, Chapter 3",
        ],
        workedExample:
            "With branching factor four, values 1 through 5 leave 1,2,3,4 in a full leaf and 5 in the tail. set(2,30) copies the leaf so the new version reads 1,2,30,4,5,5 while the old version still reads 1,2,3,4,5. A push of 6 appends to the tail without touching the trie.",
    },
    id: "persistent-vector",
    name: "Persistent Vector",
    category: "data-structures",
    complexity: { time: "O(log n) get/set, amortized O(1) push", space: "O(n) shared" },
    defaultInput: {
        values: [1, 2, 3, 4, 5, 6, 7],
        ops: [["get", 2], ["set", 2, 30], ["push", 8], ["get", 2]],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize empty trie root and tail buffer",
        "get: read tail or descend trie by index bits",
        "set: copy path to leaf and write new value",
        "push: append to tail, migrating it when full",
        "grow a new root level when the trie is full",
        "share untouched nodes across every version",
        "done: report final vector and version count",
    ],
};

export default module;
