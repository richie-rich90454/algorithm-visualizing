/**
 * condorcet-method.ts - Condorcet Method
 *
 * A Condorcet winner is a candidate who defeats every opponent in a head to
 * head majority vote. The method builds the pairwise preference matrix from
 * the ballots, checks each row against the strict majority threshold, and
 * reports the winner when one exists. When no candidate beats all others the
 * method reports a Condorcet cycle, the classic failure mode where majority
 * preference is intransitive.
 *
 * Time O(v * m^2) for v ballots over m candidates; space O(m^2).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function solve(ballots: number[][], m: number): { pairwise: number[][]; winner: number; cycle: number[]; majority: number } {
    const pairwise = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    const pos = ballots.map((ballot) => {
        const p = new Map<number, number>();
        ballot.forEach((c, i) => p.set(c, i));
        return p;
    });
    for (let i = 0; i < m; i += 1) {
        for (let j = 0; j < m; j += 1) {
            if (i === j) continue;
            for (const p of pos) {
                const pi = p.get(i);
                const pj = p.get(j);
                if (pi !== undefined && pj !== undefined && pi < pj) pairwise[i]![j] = (pairwise[i]![j] ?? 0) + 1;
            }
        }
    }
    const majority = ballots.length / 2;
    let winner = -1;
    for (let i = 0; i < m && winner < 0; i += 1) {
        let beatsAll = true;
        for (let j = 0; j < m; j += 1) {
            if (i === j) continue;
            if ((pairwise[i]![j] ?? 0) <= majority) {
                beatsAll = false;
                break;
            }
        }
        if (beatsAll) winner = i;
    }

    let cycle: number[] = [];
    if (winner < 0) {
        const beats = (x: number, y: number): boolean => (pairwise[x]![y] ?? 0) > (pairwise[y]![x] ?? 0);
        outer: for (let i = 0; i < m; i += 1) {
            for (let j = 0; j < m; j += 1) {
                for (let k = 0; k < m; k += 1) {
                    if (i !== j && j !== k && k !== i && beats(i, j) && beats(j, k) && beats(k, i)) {
                        cycle = [i, j, k];
                        break outer;
                    }
                }
            }
        }
    }
    return { pairwise, winner, cycle, majority };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ballots?: number[][]; candidates?: number } | null) ?? {};
    const supplied = Array.isArray(task.ballots) && task.ballots.length >= 1
        ? task.ballots.map((b) => (Array.isArray(b) ? b.filter((x) => Number.isInteger(x)) : []))
        : [[0, 1, 2], [0, 2, 1], [1, 0, 2]];
    let maxSeen = -1;
    for (const ballot of supplied) for (const c of ballot) maxSeen = Math.max(maxSeen, c);
    const m = Math.max(2, typeof task.candidates === "number" ? Math.floor(task.candidates) : maxSeen + 1);
    const result = solve(supplied, m);

    const grid = (focus: number): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let i = 0; i < m; i += 1) {
            for (let j = 0; j < m; j += 1) {
                const count = result.pairwise[i]?.[j] ?? 0;
                let state: EntityState = "idle";
                if (i === j) state = "idle";
                else if (focus === i) state = "comparing";
                else if (result.winner === i || (result.cycle.includes(i) && result.cycle.includes(j))) state = "sorted";
                out.push({
                    id: `cell-${i}-${j}`,
                    type: "cell",
                    label: i === j ? "-" : String(count),
                    value: count,
                    state,
                    x: 0, y: 0, width: 0, height: 0,
                    metadata: { row: i, col: j, rowCandidate: i, colCandidate: j, count },
                });
            }
        }
        return out;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: grid(-1),
        edges: [],
        description: `Condorcet analysis of ${supplied.length} ballots over ${m} candidates; building the head to head matrix.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: m, cols: m, candidates: m, ballots: supplied.length, majority: result.majority, winner: result.winner, cycle: [...result.cycle], pairwise: result.pairwise.flat() },
    };
    step += 1;

    for (let i = 0; i < m; i += 1) {
        const beats = Array.from({ length: m }, (_, j) => j).filter((j) => j !== i && (result.pairwise[i]?.[j] ?? 0) > result.majority);
        yield {
            stepNumber: step,
            entities: grid(i),
            edges: [],
            description: `Candidate ${i} defeats ${beats.length} of ${m - 1} opponents by a strict majority of ${result.majority}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: m, cols: m, candidate: i, defeats: beats, majority: result.majority, winner: result.winner, pairwise: result.pairwise.flat() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: grid(-1),
        edges: [],
        description: result.winner >= 0
            ? `Candidate ${result.winner} beats every opponent and is the Condorcet winner.`
            : `No candidate beats all others; the majority cycle is ${result.cycle.length ? result.cycle.join(" beats ") + " beats " + result.cycle[0] : "unresolved"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: m, cols: m, winner: result.winner, cycle: [...result.cycle], majority: result.majority,
            pairwise: result.pairwise.flat(), candidates: m,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of assigning points, a Condorcet method asks a simpler question: if we pit every pair of candidates against each other, is there one candidate who would beat every rival by majority vote? If so, that candidate is the clear choice. If not, the pairwise preferences may form a rock paper scissors cycle, which reveals that majority opinion is not always transitive.",
        invariants: [
            "The pairwise entry i,j counts ballots ranking i above j.",
            "For each pair the two counts sum to the number of voters who ranked both candidates.",
            "A Condorcet winner must have every entry of its row strictly above half the voter count.",
        ],
        correctness:
            "The matrix entry is computed directly from ballot positions, so it is the exact number of voters preferring i to j. A strict majority requires more than half of all ballots, and checking every opponent verifies the definition of a Condorcet winner. When no row passes, a search over ordered triples finds an intransitive cycle if one exists, which correctly witnesses the absence of a candidate that beats all others.",
        complexityRationale:
            "Building the m by m matrix scans each ballot over each ordered pair, costing O(v * m^2) time; the winner check and triple search are O(m^2) and O(m^3), dominated by the matrix construction, with O(m^2) space.",
        uses: [
            "Choosing a single winner when a majority favorite exists",
            "Detecting intransitive majority preferences in committees",
            "Comparing voting rules in social choice courses",
        ],
        references: [
            "Condorcet, Essai sur l'application de l'analyse a la probabilite des decisions (1785)",
            "Arrow, Social Choice and Individual Values (1951)",
        ],
        workedExample:
            "Three ballots rank 0 above 1 above 2, 1 above 2 above 0, and 2 above 0 above 1. Two voters prefer 0 to 1, two prefer 1 to 2, and two prefer 2 to 0, so each candidate loses to another and the pairwise relation cycles with no Condorcet winner.",
    },
    id: "condorcet-method",
    name: "Condorcet Method",
    category: "game",
    complexity: { time: "O(v * m^2)", space: "O(m^2)" },
    defaultInput: { ballots: [[0, 1, 2], [0, 2, 1], [1, 0, 2]], candidates: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the ballots and the candidate count",
        "initialize the pairwise win matrix to zero",
        "for each pair count ballots preferring the first candidate",
        "set the majority threshold to half the voter count",
        "find a candidate whose whole row exceeds the threshold",
        "if none exists search for a three candidate majority cycle",
        "report the Condorcet winner or the cycle",
    ],
};

export default module;
