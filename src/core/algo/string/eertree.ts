/**
 * eertree.ts – Eertree (palindromic tree)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An eertree is a tree of all distinct palindromic substrings of a string,
 * built online in O(n). Two root nodes handle the odd and even base cases;
 * each palindrome node stores its length and a suffix link to its longest
 * proper palindromic suffix. When a new character is appended, the tree
 * searches from the longest palindromic suffix for a palindromic extension,
 * creating at most one new node per character.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) amortised – each append does O(1) amortised work
 *   Space: O(n · alphabet) for the transitions
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The current palindrome node is YELLOW (comparing).
 *   - Suffix-link edges are highlighted PINK (highlight).
 *   - Distinct palindromes accumulate in the tree.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Every distinct palindrome appears exactly once as a node.
 *   - The suffix-link structure is the same idea as KMP's failure function.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Eertree generator.
 *
 * @param input `{ text }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "ababa";

    let step = 0;
    let nodeCount = 0;

    // Node fields: length, suffix link, children (char → node), and whether
    // the node is a root (roots have negative lengths).
    const len: number[] = [];
    const link: number[] = [];
    const children: Array<Map<string, number>> = [];

    // Two roots: node 0 = even root (length -1), node 1 = odd root (length 0).
    // The even root links to itself; the odd root links back to the even root
    // so the suffix-link walk always terminates at the even root.
    const addNode = (length: number, suffix: number): number => {
        len.push(length);
        link.push(suffix);
        children.push(new Map());
        return nodeCount++;
    };

    const evenRoot = addNode(-1, 0);
    void evenRoot;
    const oddRoot = addNode(0, 0);
    void oddRoot;

    // `last` is the longest palindromic suffix of the current prefix.
    let last = oddRoot;

    const buildFrame = (message: string): VisualFrame => {
        const entities: VisualEntity[] = [];
        for (let i = 0; i < nodeCount; i += 1) {
            entities.push({
                id: `node-${i}`,
                type: "node" as const,
                label: `len${len[i]}`,
                value: i,
                state: i === last ? "comparing" : "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            });
        }
        const edges: VisualEdge[] = [];
        for (let s = 0; s < nodeCount; s += 1) {
            for (const [char, target] of children[s] ?? []) {
                edges.push({
                    id: `edge-${s}-${target}-${char}`,
                    sourceId: `node-${s}`,
                    targetId: `node-${target}`,
                    label: char,
                    state: "idle",
                    directed: true,
                });
            }
            // Suffix-link edges (visualised distinctly).
            const sl = link[s];
            if (sl !== undefined && sl !== s && sl >= 0) {
                edges.push({
                    id: `link-${s}-${sl}`,
                    sourceId: `node-${s}`,
                    targetId: `node-${sl}`,
                    label: "link",
                    state: "highlight",
                    directed: true,
                });
            }
        }
        return {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "graph",
            meta: { palindromes: nodeCount - 2 },
        };
    };

    yield buildFrame(`Eertree of "${text}" – roots for odd/even palindromes created.`);
    step += 1;

    // Extend the tree character by character.
    for (let pos = 0; pos < text.length; pos += 1) {
        const char = text[pos] as string;

        // Find the longest palindromic suffix that can be extended by `char`.
        let cur = last;
        for (;;) {
            const curLen = len[cur] ?? 0;
            const left = pos - 1 - curLen;
            if (left >= 0 && text[left] === char) {
                break;
            }
            cur = link[cur] ?? 0;
        }

        // Does the child already exist?
        const existing = children[cur]?.get(char);
        if (existing !== undefined) {
            last = existing;
            yield buildFrame(`Character "${char}" – reused existing palindrome node ${last}.`);
            step += 1;
            continue;
        }

        // Create a new palindrome node.
        const newLen = (len[cur] ?? 0) + 2;
        const newNode = addNode(newLen, 0);
        children[cur]?.set(char, newNode);

        // Determine its suffix link.
        if (newLen === 1) {
            link[newNode] = oddRoot;
        } else {
            let suf = link[cur] ?? 0;
            for (;;) {
                const sufLen = len[suf] ?? 0;
                const left = pos - 1 - sufLen;
                if (left >= 0 && text[left] === char) {
                    const candidate = children[suf]?.get(char);
                    if (candidate !== undefined) {
                        link[newNode] = candidate;
                        break;
                    }
                }
                suf = link[suf] ?? 0;
            }
        }

        last = newNode;
        yield buildFrame(
            `Character "${char}" – new palindrome node ${newNode} (length ${newLen}).`,
        );
        step += 1;
    }

    yield buildFrame(`Eertree complete – ${nodeCount - 2} distinct palindrome(s).`);
}

/** The Eertree module, registered with the engine. */
const module: AlgorithmModule = {
    id: "eertree",
    name: "Eertree (Palindromic Tree)",
    category: "string",
    complexity: { time: "O(n)", space: "O(n·σ)" },
    // "ababa" yields the palindromes a, b, aba, bab, ababa.
    defaultInput: { text: "ababa" },
    visualType: "graph",
    run,
};

export default module;
