/**
 * local-reconstruction-codes.ts - Local Reconstruction Codes
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A local reconstruction code splits data blocks into small groups and stores
 * one local parity block per group, plus two global parity blocks that span
 * every group. A single lost block is rebuilt from its group parity alone, so
 * the repair reads only a few disks. Two losses in different groups each use
 * their own local parity; two losses in the same group are solved from the two
 * global equations. The arithmetic is carried out in GF(256), which makes the
 * global equations independent for distinct block positions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k + g) to encode k blocks in g groups; O(k) to rebuild up to two losses
 *   Space: O(k + g + 2) for data plus local and global parity blocks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row 0 holds data blocks, row 1 local parity, row 2 global parity.
 *   - The block being encoded, erased or rebuilt is highlighted.
 *   - meta carries data, parity, erasures, rebuilt values and the verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const EXP: number[] = new Array(512).fill(0);
const LOG: number[] = new Array(256).fill(0);
let gfSeed = 1;
for (let i = 0; i < 255; i += 1) {
    EXP[i] = gfSeed;
    LOG[gfSeed] = i;
    gfSeed <<= 1;
    if (gfSeed & 0x100) gfSeed ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255] ?? 0;

/** Multiply two GF(256) elements using the log/exp tables. */
function gfMul(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;
    return EXP[(LOG[a] ?? 0) + (LOG[b] ?? 0)] ?? 0;
}

/** Divide two GF(256) elements. */
function gfDiv(a: number, b: number): number {
    if (a === 0) return 0;
    return EXP[((LOG[a] ?? 0) - (LOG[b] ?? 0) + 255) % 255] ?? 0;
}

/** Exponentiate by the primitive element alpha = 2. */
function alphaPow(n: number): number {
    return EXP[((n % 255) + 255) % 255] ?? 1;
}

interface Equation {
    coef: number[];
    rhs: number;
}

/** Solve a square or overdetermined GF(256) system by Gaussian elimination. */
function solve(rows: Equation[], unknowns: number): number[] | null {
    if (unknowns === 0) return [];
    const m = rows.map((row) => [...row.coef, row.rhs]);
    const pivots: number[] = [];
    let rank = 0;
    for (let col = 0; col < unknowns && rank < m.length; col += 1) {
        let pivot = -1;
        for (let r = rank; r < m.length; r += 1) {
            if ((m[r]?.[col] ?? 0) !== 0) {
                pivot = r;
                break;
            }
        }
        if (pivot < 0) continue;
        const tmp = m[rank]!;
        m[rank] = m[pivot]!;
        m[pivot] = tmp;
        const inv = gfDiv(1, m[rank]![col] ?? 0);
        for (let c = col; c <= unknowns; c += 1) m[rank]![c] = gfMul(m[rank]![c] ?? 0, inv);
        for (let r = 0; r < m.length; r += 1) {
            if (r === rank) continue;
            const factor = m[r]?.[col] ?? 0;
            if (factor === 0) continue;
            for (let c = col; c <= unknowns; c += 1) {
                m[r]![c] = (m[r]![c] ?? 0) ^ gfMul(factor, m[rank]![c] ?? 0);
            }
        }
        pivots.push(col);
        rank += 1;
    }
    for (let r = rank; r < m.length; r += 1) {
        let zero = true;
        for (let c = 0; c < unknowns; c += 1) {
            if ((m[r]?.[c] ?? 0) !== 0) {
                zero = false;
                break;
            }
        }
        if (zero && (m[r]?.[unknowns] ?? 0) !== 0) return null;
    }
    if (rank < unknowns) return null;
    const result = new Array<number>(unknowns).fill(0);
    for (let r = 0; r < rank; r += 1) result[pivots[r]!] = m[r]![unknowns] ?? 0;
    return result;
}

interface LrcInput {
    data?: number[];
    groups?: number;
    erasures?: number[];
}

/** Build the grid of data, local parity and global parity cells. */
function makeCells(
    data: number[],
    groups: number[],
    globals: number[],
    groupCount: number,
    erasures: number[],
    restored: Map<number, number>,
    focus: string | null,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const add = (id: string, row: number, col: number, value: number, kind: string): void => {
        const erased = kind === "data" && erasures.includes(col);
        let state: EntityState = kind === "data" ? "sorted" : "idle";
        if (erased) state = restored.has(col) ? "active" : "error";
        if (focus === id) state = "comparing";
        entities.push({
            id,
            type: "cell" as const,
            label: erased && !restored.has(col) ? "X" : String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col, kind, erased: erased ? 1 : 0 },
        });
    };
    data.forEach((value, i) => add(`data-${i}`, 0, i, value, "data"));
    for (let g = 0; g < groupCount; g += 1) add(`local-${g}`, 1, g, groups[g] ?? 0, "local");
    add("global-0", 2, 0, globals[0] ?? 0, "global");
    add("global-1", 2, 1, globals[1] ?? 0, "global");
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LrcInput | null) ?? {};
    const source = Array.isArray(task.data) && task.data.length > 0
        ? task.data.map((v) => ((Math.floor(Number(v) || 0) % 256) + 256) % 256)
        : [12, 45, 7, 200, 33, 91, 154, 18, 66, 129, 240, 5];
    const groupCount = Math.max(1, Math.min(6, Math.floor(Number(task.groups ?? 3)) || 3));
    const erasures = (Array.isArray(task.erasures)
        ? task.erasures.map((e) => Math.floor(Number(e) || 0))
        : [2, 6]).filter((e) => e >= 0 && e < source.length);
    const data = source.slice();
    const k = data.length;
    const groups: number[] = new Array(groupCount).fill(0);
    const globals: number[] = [0, 0];
    let step = 0;
    const emit = (description: string, codeLine: number, focus: string | null, restored: Map<number, number>, extra: Record<string, unknown>) => ({
        stepNumber: step++,
        entities: makeCells(data, groups, globals, groupCount, erasures, restored, focus),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "grid" as const,
        meta: {
            data: data.slice(),
            groups: groups.slice(),
            globals: globals.slice(),
            erasures: erasures.slice(),
            groupCount,
            ...extra,
        },
    });

    yield emit(`Encoding ${k} data block(s) into ${groupCount} local group(s) plus two global parities.`, 0, null, new Map(), { phase: "init" });

    for (let g = 0; g < groupCount; g += 1) {
        let parity = 0;
        for (let i = g; i < k; i += groupCount) parity ^= data[i] ?? 0;
        groups[g] = parity;
        yield emit(`Local group ${g}: XOR of its data blocks gives parity ${parity}.`, 1, `local-${g}`, new Map(), { phase: "local" });
    }
    for (let gi = 0; gi < 2; gi += 1) {
        let parity = 0;
        for (let i = 0; i < k; i += 1) {
            const exponent = gi === 0 ? i : 2 * i;
            parity ^= gfMul(data[i] ?? 0, alphaPow(exponent));
        }
        globals[gi] = parity;
        yield emit(`Global parity ${gi}: weighted XOR across every data block gives ${parity}.`, 2, `global-${gi}`, new Map(), { phase: "global" });
    }

    yield emit(`Marked ${erasures.length} erased block(s): [${erasures.join(", ")}].`, 3, null, new Map(), { phase: "erasure" });

    const surviving = data.map((value, i) => (erasures.includes(i) ? 0 : value));
    const equations: Equation[] = [];
    for (let g = 0; g < groupCount; g += 1) {
        const coef = new Array<number>(erasures.length).fill(0);
        let rhs = groups[g] ?? 0;
        for (let i = g; i < k; i += groupCount) {
            const at = erasures.indexOf(i);
            if (at >= 0) coef[at] = 1;
            else rhs ^= data[i] ?? 0;
        }
        if (coef.some((c) => c !== 0)) equations.push({ coef, rhs });
    }
    for (let gi = 0; gi < 2; gi += 1) {
        const coef = erasures.map((i) => gfMul(1, alphaPow(gi === 0 ? i : 2 * i)));
        let rhs = globals[gi] ?? 0;
        for (let i = 0; i < k; i += 1) {
            if (erasures.includes(i)) continue;
            rhs ^= gfMul(data[i] ?? 0, alphaPow(gi === 0 ? i : 2 * i));
        }
        equations.push({ coef, rhs });
    }
    const solution = solve(equations, erasures.length);
    const restored = new Map<number, number>();
    if (solution) {
        for (let at = 0; at < erasures.length; at += 1) {
            const index = erasures[at]!;
            const value = solution[at] ?? 0;
            restored.set(index, value);
            surviving[index] = value;
            yield emit(`Rebuilt block ${index} from the parity equations as ${value}.`, 6, `data-${index}`, new Map(restored), { phase: "rebuild" });
        }
    }

    const ok = solution !== null && restored.size === erasures.length && erasures.every((i) => restored.get(i) === (data[i] ?? 0));
    yield emit(
        ok
            ? `Recovered all ${erasures.length} erased block(s) exactly from local and global parity.`
            : "Recovery incomplete: the erased pattern exceeds the two-loss guarantee.",
        8,
        null,
        new Map(restored),
        { phase: "done", recovered: surviving.slice(), ok: ok ? 1 : 0 },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Group the data blocks and write one parity block that is the XOR of each group. A single loss then costs only a small XOR inside its own group instead of reading the whole array. Add two global parities with different weights across all blocks so that two losses in the same group still give two independent equations. Solving those equations in GF(256) returns both missing values.",
        invariants: [
            "Each local parity equals the XOR of the data blocks in its group.",
            "Each global parity is a fixed weighted XOR of every data block.",
            "For any two distinct positions the two global coefficient columns are independent in GF(256).",
        ],
        correctness:
            "Encoding stores exactly the sums described by the parity equations. For a single erasure, its group parity contains every surviving member of the group plus the unknown, so XOR cancels the known terms and leaves the lost block. For two erasures, the local equations cover losses in different groups, while two distinct positions a and b produce global columns alpha^a, alpha^b and alpha^(2a), alpha^(2b) whose determinant is alpha^(a+b)(alpha^b - alpha^a), nonzero whenever a differs from b. Gaussian elimination therefore recovers both values uniquely, so the rebuilt data matches the originals.",
        complexityRationale:
            "Encoding touches each data block once per local group and twice for the global parities, so it is O(k). Rebuilding solves a system with at most a handful of unknowns, again O(k) to form the equations. Storage is k data blocks, one parity per group and two global parities.",
        uses: [
            "Erasure coding in distributed storage with cheap single-disk repair",
            "Azure and similar object stores that favor local reconstruction",
            "Archival arrays where two-disk failures must still be recoverable",
        ],
        references: [
            "Huang et al., Erasure Coding in Windows Azure Storage, USENIX ATC 2012",
            "Rizzo, Effective Erasure Codes for Reliable Computer Communication Protocols, 1997",
        ],
        workedExample:
            "With twelve data blocks in three groups of four, losing block 2 needs only its group parity: XOR the other three blocks in that group with the stored local parity. Losing blocks 2 and 6 at once still works because each belongs to a different group. Losing blocks 2 and 3 uses the two global equations, whose coefficient columns alpha^2, alpha^3 and alpha^4, alpha^6 are independent, so elimination returns both values.",
    },
    id: "local-reconstruction-codes",
    name: "Local Reconstruction Codes",
    category: "production-systems",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: {
        data: [12, 45, 7, 200, 33, 91, 154, 18, 66, 129, 240, 5],
        groups: 3,
        erasures: [2, 6],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "split the data blocks into consecutive local groups",
        "for each group store the XOR of its blocks as local parity",
        "store two global parities with distinct GF(256) weights",
        "mark the erased block positions",
        "collect local and global equations for the missing blocks",
        "solve the system over GF(256) by Gaussian elimination",
        "write each solved value back into its erased block",
        "compare the rebuilt blocks with the original data",
        "done: report the recovered blocks and the verdict",
    ],
};

export default module;
