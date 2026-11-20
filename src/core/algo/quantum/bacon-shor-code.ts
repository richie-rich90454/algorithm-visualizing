/**
 * bacon-shor-code.ts - Bacon-Shor Subsystem Code Error Correction
 *
 * The nine data qubits are arranged in a three by three grid. Z-type stabilizer
 * checks compare adjacent rows and reveal the row of an X error, while X-type
 * checks compare adjacent columns and reveal the column of a Z error. The
 * undisclosed coordinate is a gauge degree of freedom, so several corrections
 * differ merely by a gauge operator and leave the encoded logical state unchanged.
 *
 * Limits of the demo: a single X error and a single Z error at arbitrary grid
 * positions, perfect Pauli measurements with no readout error, no syndrome
 * repetition, and no modeling of continuous rotations or circuit-level noise.
 * The simulation tracks Pauli frames rather than full density matrices.
 *
 * Time: O(1) for nine qubits. Space: O(1).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

export interface PauliError {
    type: "X" | "Z";
    index: number;
}

export interface Syndrome {
    /** Z-type row-pair checks, triggered by X errors. */
    zRowFlips: boolean[][];
    /** X-type column-pair checks, triggered by Z errors. */
    xColFlips: boolean[][];
    /** Row decoded from the Z-type checks. */
    xRow: number | null;
    /** Column decoded from the X-type checks. */
    zColumn: number | null;
}

/** Measure the Z row-pair parities and X column-pair parities of an error frame. */
export function baconShorSyndrome(errors: PauliError[]): Syndrome {
    const zRowFlips = [[false, false], [false, false], [false, false]];
    const xColFlips = [[false, false], [false, false], [false, false]];
    for (const error of errors) {
        const row = Math.floor(error.index / 3);
        const col = error.index % 3;
        if (error.type === "X") {
            if (row === 0) {
                zRowFlips[0]![0] = !zRowFlips[0]![0];
            } else if (row === 1) {
                zRowFlips[1]![0] = !zRowFlips[1]![0];
                zRowFlips[1]![1] = !zRowFlips[1]![1];
            } else {
                zRowFlips[2]![1] = !zRowFlips[2]![1];
            }
        } else {
            if (col === 0) {
                xColFlips[0]![0] = !xColFlips[0]![0];
            } else if (col === 1) {
                xColFlips[1]![0] = !xColFlips[1]![0];
                xColFlips[1]![1] = !xColFlips[1]![1];
            } else {
                xColFlips[2]![1] = !xColFlips[2]![1];
            }
        }
    }
    const decode = (flips: boolean[]) => flips[0] && flips[1] ? 1 : flips[0] ? 0 : flips[1] ? 2 : null;
    const rows = zRowFlips.map((entry) => decode(entry as boolean[]));
    const cols = xColFlips.map((entry) => decode(entry as boolean[]));
    const xRows = rows.filter((value) => value !== null);
    const zCols = cols.filter((value) => value !== null);
    return {
        zRowFlips,
        xColFlips,
        xRow: xRows.length === 1 ? xRows[0] as number : null,
        zColumn: zCols.length === 1 ? zCols[0] as number : null,
    };
}

/** Decode the syndrome into a gauge-equivalent correction on one row and column. */
export function baconShorCorrect(errors: PauliError[]): {
    correction: PauliError[];
    syndrome: Syndrome;
    residual: Syndrome;
    cleared: boolean;
    logicalPreserved: boolean;
} {
    const syndrome = baconShorSyndrome(errors);
    const correction: PauliError[] = [];
    if (syndrome.xRow !== null) {
        correction.push({ type: "X", index: syndrome.xRow * 3 });
    }
    if (syndrome.zColumn !== null) {
        correction.push({ type: "Z", index: syndrome.zColumn });
    }
    const residual = baconShorSyndrome([...errors, ...correction]);
    const cleared = residual.xRow === null && residual.zColumn === null;
    const logicalPreserved = cleared && syndrome.xRow !== null && syndrome.zColumn !== null;
    return { correction, syndrome, residual, cleared, logicalPreserved };
}

function syndromeMeta(syndrome: Syndrome) {
    return {
        zRowFlips: syndrome.zRowFlips.map((row) => [...row]),
        xColFlips: syndrome.xColFlips.map((col) => [...col]),
        xRow: syndrome.xRow,
        zColumn: syndrome.zColumn,
    };
}

function errorsMeta(errors: PauliError[]) {
    return errors.map((error) => ({ type: error.type, index: error.index }));
}

function cellLabel(index: number, syndrome: Syndrome): string {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const xFlip = syndrome.zRowFlips[row]?.[Math.min(col, 1)] ? "X" : "";
    const zFlip = syndrome.xColFlips[col]?.[Math.min(row, 1)] ? "Z" : "";
    return `q${row}${col}${xFlip || zFlip ? ":" + xFlip + zFlip : ""}`;
}

function makeCells(errors: PauliError[], syndrome: Syndrome, active: number): VisualEntity[] {
    const types = new Map<number, string>();
    for (const error of errors) {
        types.set(error.index, error.type);
    }
    return Array.from({ length: 9 }, (_, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: cellLabel(index, syndrome),
        value: types.get(index) ?? "I",
        state: index === active ? "comparing" : types.has(index) ? "error" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, row: Math.floor(index / 3), col: index % 3, error: types.get(index) ?? "I" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { xError?: number; zError?: number } | null) ?? {};
    const xIndex = typeof task.xError === "number" && task.xError >= 0 && task.xError < 9
        ? Math.floor(task.xError)
        : 5;
    const zIndex = typeof task.zError === "number" && task.zError >= 0 && task.zError < 9
        ? Math.floor(task.zError)
        : 3;
    const errors: PauliError[] = [
        { type: "X", index: xIndex },
        { type: "Z", index: zIndex },
    ];
    const syndrome = baconShorSyndrome(errors);
    const result = baconShorCorrect(errors);
    const trueXRow = Math.floor(xIndex / 3);
    const trueZColumn = zIndex % 3;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(errors, syndrome, -1),
        edges: [],
        description: `Inject an X error at qubit ${xIndex} and a Z error at qubit ${zIndex} in the 3 by 3 Bacon-Shor grid.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            xError: xIndex, zError: zIndex,
            zRowFlips: syndrome.zRowFlips.map((row) => [...row]), xColFlips: syndrome.xColFlips.map((col) => [...col]),
            syndrome: syndromeMeta(syndrome), correction: errorsMeta(result.correction),
        },
    };
    step += 1;

    for (let row = 0; row < 3; row += 1) {
        const active = row * 3;
        yield {
            stepNumber: step,
            entities: makeCells(errors, syndrome, active),
            edges: [],
            description: `Z-type row-pair checks for row ${row}: ${(syndrome.zRowFlips[row] as boolean[]).map((v) => v ? 1 : 0).join(" ")}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                xError: xIndex, zError: zIndex, activeRow: row,
                zRowFlips: syndrome.zRowFlips.map((row) => [...row]), xColFlips: syndrome.xColFlips.map((col) => [...col]),
                syndrome: syndromeMeta(syndrome), correction: errorsMeta(result.correction),
            },
        };
        step += 1;
    }

    for (let col = 0; col < 3; col += 1) {
        const active = col;
        yield {
            stepNumber: step,
            entities: makeCells(errors, syndrome, active),
            edges: [],
            description: `X-type column-pair checks for column ${col}: ${(syndrome.xColFlips[col] as boolean[]).map((v) => v ? 1 : 0).join(" ")}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                xError: xIndex, zError: zIndex, activeCol: col,
                zRowFlips: syndrome.zRowFlips.map((row) => [...row]), xColFlips: syndrome.xColFlips.map((col) => [...col]),
                syndrome: syndromeMeta(syndrome), correction: errorsMeta(result.correction),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.cleared ? [] : errors, syndrome, -1),
        edges: [],
        description: `Decoded X row ${syndrome.xRow} (true ${trueXRow}) and Z column ${syndrome.zColumn} (true ${trueZColumn}); syndrome cleared: ${result.cleared}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            xError: xIndex, zError: zIndex,
            trueXRow, trueZColumn,
            syndrome: syndromeMeta(syndrome), correction: errorsMeta(result.correction), residual: syndromeMeta(result.residual),
            cleared: result.cleared, logicalPreserved: result.logicalPreserved,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A subsystem code stores information in degrees of freedom that are not all directly measured. In the Bacon-Shor layout, stabilizer checks compare adjacent rows with Z operators and adjacent columns with X operators. An X error therefore reveals its row, and a Z error reveals its column, while the undisclosed coordinate is a gauge degree of freedom. Applying a correction at any position with the decoded coordinate fixes the syndrome without touching the logical state.",
        invariants: [
            "An X error flips the Z-type row-pair checks adjacent to its row.",
            "A Z error flips the X-type column-pair checks adjacent to its column.",
            "Two corrections in the same row differ by horizontal gauge operators, so their logical action is identical.",
        ],
        correctness:
            "The Z-type stabilizers are products of two adjacent rows of horizontal gauge operators, so the violated pair identifies the row of an X error. The X-type stabilizers are products of two adjacent columns, so the violated pair identifies the column of a Z error. Logical X is a product across an entire column, hence applying X on any qubit of the decoded row fixes the error up to horizontal gauge operators, which act trivially on the encoded state. Logical Z is a product across a row, giving the analogous argument for Z corrections in the decoded column. Recomputing the syndrome after correction gives no violations, which the test verifies for all placements.",
        complexityRationale:
            "With nine qubits there are a constant number of gauge checks and a constant-size syndrome decode, so both time and space are O(1). For a width-w grid the syndrome has O(w) checks and decoding is O(w).",
        uses: [
            "Fault-tolerant quantum memory with reduced measurement weight",
            "Bias-tailored protection against dephasing noise",
            "A teaching bridge between stabilizer and subsystem codes",
        ],
        references: [
            "Bacon, Operator Quantum Error Correction, 2006",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, 2010",
        ],
        workedExample:
            "An X error on the middle qubit of the center row flips both Z-type row-pair checks, decoding to row one. A correction X on the leftmost qubit of that row clears the syndrome because the two positions differ by horizontal gauge. A Z error on the top qubit of the center column flips both X-type column-pair checks, decoding to column one, and a Z on the top qubit of that column clears the remaining syndrome.",
    },
    id: "bacon-shor-code",
    name: "Bacon-Shor Subsystem Code",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { xError: 5, zError: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "place the nine qubits in a three by three grid",
        "inject one X error and one Z error",
        "measure horizontal Z parity pairs in every row",
        "measure vertical X parity pairs in every column",
        "decode the X row and the Z column from the parity patterns",
        "apply X in the decoded row and Z in the decoded column",
        "recompute the syndrome to confirm it is cleared",
        "done: report the decoded positions and logical status",
    ],
};

export default module;
