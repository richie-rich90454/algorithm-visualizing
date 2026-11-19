/**
 * warnsdorff-knights-tour.ts - Warnsdorff's Rule for the Knight's Tour
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A knight's tour visits every square of a chessboard exactly once with legal
 * knight moves. Warnsdorff's rule is a greedy heuristic: from the current
 * square, move to the unvisited square with the fewest onward unvisited moves.
 * Steering toward the most constrained squares first avoids stranding them,
 * and on ordinary boards it finds a complete tour almost every time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) squares, each scanning 8 moves and counting onward degree
 *   Space: O(n^2) for the visited set and the tour path
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Board squares are nodes at their (row, col) coordinates.
 *   - The current square is YELLOW (comparing), visited squares are CYAN (path).
 *   - Each accepted move draws a CYAN edge between consecutive squares.
 */
import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Coord = [number, number];

const KNIGHT_MOVES: Coord[] = [
    [1, 2],
    [2, 1],
    [-1, 2],
    [-2, 1],
    [1, -2],
    [2, -1],
    [-1, -2],
    [-2, -1],
];

function cellId(r: number, c: number): string {
    return `sq-${r}-${c}`;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { size?: number; start?: Coord } | null) ?? {};
    const size =
        typeof task.size === "number"
            ? Math.max(1, Math.min(8, Math.floor(task.size)))
            : 5;
    const board: Coord[] = [];
    for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) board.push([r, c]);
    }

    const nodes: VisualEntity[] = board.map(([r, c]) => ({
        id: cellId(r, c),
        type: "node" as const,
        label: `${r},${c}`,
        value: [r, c],
        state: "unvisited" as const,
        x: c,
        y: r,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const edges: VisualEdge[] = [];

    let step = 0;
    const snap = (description: string, line: number, meta: Record<string, number | string | boolean> = {}): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber: line,
        layout: "point",
        meta,
    });

    if (board.length === 0) {
        yield snap("Empty board - no tour exists.", 7, { complete: false, steps: 0, n: size });
        return;
    }

    const rawStart = task.start ?? [0, 0];
    const start: Coord =
        rawStart[0] >= 0 && rawStart[0] < size && rawStart[1] >= 0 && rawStart[1] < size
            ? [rawStart[0], rawStart[1]]
            : [0, 0];

    const visited = new Set<string>();
    const path: Coord[] = [start];
    visited.add(`${start[0]},${start[1]}`);
    const startNode = byId.get(cellId(start[0], start[1]));
    if (startNode) startNode.state = "comparing";

    yield snap(`Place the knight on square (${start[0]},${start[1]}) of a ${size}x${size} board.`, 0, {
        n: size,
        steps: 1,
        complete: false,
    });
    step += 1;

    const onward = (r: number, c: number): Coord[] => {
        const out: Coord[] = [];
        for (const [dr, dc] of KNIGHT_MOVES) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size && !visited.has(`${nr},${nc}`)) {
                out.push([nr, nc]);
            }
        }
        return out;
    };

    let complete = true;
    while (path.length < size * size) {
        const [cr, cc] = path[path.length - 1] as Coord;
        const candidates = onward(cr, cc);
        if (candidates.length === 0) {
            complete = false;
            break;
        }
        candidates.sort((a, b) => {
            const da = onward(a[0], a[1]).length;
            const db = onward(b[0], b[1]).length;
            return da - db || a[0] - b[0] || a[1] - b[1];
        });
        const [nr, nc] = candidates[0] as Coord;
        const picked = byId.get(cellId(nr, nc));
        if (picked) picked.state = "comparing";

        edges.push({
            id: `move-${path.length - 1}`,
            sourceId: cellId(cr, cc),
            targetId: cellId(nr, nc),
            label: "",
            state: "path",
            directed: true,
        });
        const previous = byId.get(cellId(cr, cc));
        if (previous) previous.state = "path";

        visited.add(`${nr},${nc}`);
        path.push([nr, nc]);
        yield snap(
            `Move ${path.length - 1}: jump to (${nr},${nc}), the candidate with the fewest onward moves (${onward(nr, nc).length}).`,
            5,
            { n: size, steps: path.length, complete: false, current: `${nr},${nc}` },
        );
        step += 1;
    }

    const last = path[path.length - 1] as Coord;
    const lastNode = byId.get(cellId(last[0], last[1]));
    if (lastNode) lastNode.state = "path";
    const pathText = path.map(([r, c]) => `${r},${c}`).join("|");
    yield snap(
        complete
            ? `Complete tour: all ${size * size} squares visited exactly once.`
            : `Incomplete tour: stranded after ${path.length} of ${size * size} squares.`,
        7,
        { n: size, steps: path.length, complete, path: pathText },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A knight's tour must land on every square once. Instead of searching blindly, Warnsdorff's rule always moves to the currently reachable square with the fewest onward options. Squares with low degree are the easiest to strand, so visiting them early keeps the tour alive.",
        invariants: [
            "Every visited square appears exactly once in the path.",
            "Consecutive path squares are always a legal knight move apart.",
            "The chosen next square minimizes the number of unvisited knight neighbors.",
        ],
        correctness:
            "The rule is a heuristic, not a proof of success: it is not guaranteed to find a tour on every board and start. When it terminates with all n squared squares visited, the recorded path is a valid tour by construction because each step was a legal knight move to an unvisited square. The visualization reports the complete flag honestly rather than claiming success it did not achieve.",
        complexityRationale:
            "There are n squared squares; selecting each next square scans at most 8 knight moves and counts onward degree for each candidate, which is constant work per square. Total time is O(n squared) and the visited set plus path use O(n squared) space.",
        uses: [
            "Solving knight's-tour puzzles and chessboard demonstrations",
            "A classic example of a greedy heuristic with strong empirical results",
            "Path-planning demonstrations where degree-based ordering avoids dead ends",
        ],
        references: [
            "Warnsdorff, Des Rosselsprits, 1823",
            "Knuth, The Art of Computer Programming, Volume 1, search heuristics",
        ],
        workedExample:
            "On a 5 by 5 board starting at (0,0), the knight first goes to (1,2), whose onward degree is the smallest among the legal moves. Repeating the rule visits all 25 squares exactly once and ends at (3,3), producing a complete tour.",
    },
    id: "warnsdorff-knights-tour",
    name: "Warnsdorff Knight's Tour",
    category: "graph",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { size: 5, start: [0, 0] },
    visualType: "point",
    run,
    pseudocode: [
        "place the knight on the starting square and mark it visited",
        "while the tour has fewer than n squared squares",
        "list all unvisited squares reachable by a knight move",
        "count the onward unvisited moves of each candidate",
        "choose the candidate with the fewest onward moves",
        "move there, mark it visited, and record the directed edge",
        "if no candidate exists the tour is stranded",
        "done: report whether every square was visited once",
    ],
};

export default module;
