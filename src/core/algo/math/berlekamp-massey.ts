/**
 * berlekamp-massey.ts - Berlekamp-Massey Minimal LFSR
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Berlekamp-Massey finds the shortest linear feedback shift register that
 * produces a finite sequence over a field. It processes terms one at a time,
 * measuring a discrepancy between the current LFSR prediction and the actual
 * term. A zero discrepancy moves on; a nonzero one updates the connection
 * polynomial by the previous update polynomial, and when the register is short
 * enough it also grows the linear complexity. The result is the unique minimal
 * connection polynomial.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N^2) field operations for N sequence terms
 *   Space: O(N) for the connection polynomials
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Sequence terms are cells in the top row; the current term is GREEN.
 *   - Connection-polynomial coefficients sit in the bottom row.
 *   - A nonzero discrepancy flashes RED before the update.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const DEFAULT_MODULUS = 1000003;

function modPow(base: number, exp: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exp;
    while (e > 0) {
        if (e % 2 === 1) {
            result = (result * b) % modulus;
        }
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

function modInverse(value: number, modulus: number): number {
    return modPow(value, modulus - 2, modulus);
}

/** Run Berlekamp-Massey over GF(p), returning steps for the visualization. */
function berlekampMassey(
    sequence: number[],
    modulus: number,
): {
    connection: number[];
    linearComplexity: number;
    steps: Array<{
        index: number;
        term: number;
        discrepancy: number;
        connection: number[];
        linearComplexity: number;
    }>;
} {
    let c = [1];
    let b = [1];
    let linearComplexity = 0;
    let shift = 1;
    let lastDiscrepancy = 1;
    const steps: Array<{
        index: number;
        term: number;
        discrepancy: number;
        connection: number[];
        linearComplexity: number;
    }> = [];

    for (let n = 0; n < sequence.length; n += 1) {
        let discrepancy = (((sequence[n] ?? 0) % modulus) + modulus) % modulus;
        for (let i = 1; i <= linearComplexity; i += 1) {
            discrepancy = (discrepancy + (c[i] ?? 0) * (sequence[n - i] ?? 0)) % modulus;
        }
        discrepancy = (discrepancy + modulus) % modulus;

        if (discrepancy === 0) {
            shift += 1;
        } else {
            const previous = c.slice();
            const factor = (discrepancy * modInverse(lastDiscrepancy, modulus)) % modulus;
            while (c.length <= b.length - 1 + shift) {
                c.push(0);
            }
            for (let i = 0; i < b.length; i += 1) {
                c[i + shift] =
                    ((((c[i + shift] ?? 0) - factor * (b[i] ?? 0)) % modulus) + modulus) % modulus;
            }
            if (2 * linearComplexity <= n) {
                linearComplexity = n + 1 - linearComplexity;
                b = previous;
                lastDiscrepancy = discrepancy;
                shift = 1;
            } else {
                shift += 1;
            }
        }
        steps.push({
            index: n,
            term: (((sequence[n] ?? 0) % modulus) + modulus) % modulus,
            discrepancy,
            connection: c.slice(),
            linearComplexity,
        });
    }
    return { connection: c, linearComplexity, steps };
}

function frameEntities(
    sequence: number[],
    connection: number[],
    activeIndex: number,
    discrepancy: number,
): VisualEntity[] {
    const entities: VisualEntity[] = sequence.map((value, index) => ({
        id: `seq-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: (index === activeIndex
            ? "active"
            : index < activeIndex
              ? "sorted"
              : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
    connection.forEach((coefficient, index) => {
        entities.push({
            id: `coef-${index}`,
            type: "cell",
            label: index === 0 ? "1" : String(coefficient),
            value: coefficient,
            state: (discrepancy !== 0 && index > 0 ? "comparing" : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: index },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { sequence?: number[]; modulus?: number } | null) ?? {};
    const raw = task.sequence ?? [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
    const modulus =
        typeof task.modulus === "number" && task.modulus > 2 ? task.modulus : DEFAULT_MODULUS;
    const sequence = raw.map((value) => ((Math.trunc(value) % modulus) + modulus) % modulus);
    let step = 0;

    yield {
        stepNumber: step,
        entities: frameEntities(sequence, [1], -1, 0),
        edges: [],
        description: `Finding the shortest LFSR for ${sequence.length} terms over GF(${modulus}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, modulus },
    };
    step += 1;

    const result = berlekampMassey(sequence, modulus);
    for (const s of result.steps) {
        yield {
            stepNumber: step,
            entities: frameEntities(sequence, s.connection, s.index, s.discrepancy),
            edges: [],
            description:
                s.discrepancy === 0
                    ? `Term ${s.index} = ${s.term}: discrepancy is zero, the register still fits.`
                    : `Term ${s.index} = ${s.term}: discrepancy ${s.discrepancy} is nonzero, update the connection polynomial (linear complexity ${s.linearComplexity}).`,
            codeLineNumber: s.discrepancy === 0 ? 2 : 4,
            layout: "grid",
            meta: {
                step,
                index: s.index,
                discrepancy: s.discrepancy,
                linearComplexity: s.linearComplexity,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: frameEntities(sequence, result.connection, -1, 0).map((entity) => ({
            ...entity,
            state: entity.id.startsWith("coef-") ? ("sorted" as EntityState) : entity.state,
        })),
        edges: [],
        description: `Minimal LFSR has linear complexity ${result.linearComplexity} with connection polynomial coefficients [${result.connection.join(", ")}].`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            step,
            linearComplexity: result.linearComplexity,
            connection: result.connection,
            modulus,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A linear feedback shift register predicts each new term as a linear combination of earlier terms. Berlekamp-Massey grows the register only when it must: each new term produces a discrepancy, and a nonzero discrepancy patches the current polynomial using the polynomial from the last time the register had to grow. The process ends with the shortest register that explains every term.",
        invariants: [
            "A zero discrepancy means the current register already reproduces the new term.",
            "The connection polynomial always has leading coefficient one.",
            "Linear complexity increases only when twice its old value is at most the current index.",
        ],
        correctness:
            "Each update cancels the current discrepancy because the correction is a scaled copy of the polynomial whose last discrepancy was nonzero, aligned at the current shift. When two times the old linear complexity is at most n, no shorter register can explain the prefix, so the linear complexity must grow to n + 1 minus its previous value. By induction the final polynomial reproduces all terms, and the growth rule proves no shorter polynomial does, giving the unique minimal LFSR.",
        complexityRationale:
            "Each of the N terms costs a inner product over at most O(N) coefficients plus a polynomial update of length O(N), so the total time is O(N^2) field operations. The current and previous connection polynomials use O(N) space.",
        uses: [
            "Cryptanalysis of stream ciphers and linear complexity testing",
            "Synthesizing error-locator polynomials in BCH and Reed-Solomon decoding",
            "Modeling linear recurrences from observed data",
        ],
        references: [
            "Massey, Shift-Register Synthesis and BCH Decoding, 1969",
            "Rueppel, Analysis and Design of Stream Ciphers, Chapter 4",
        ],
        workedExample:
            "For the Fibonacci-like sequence 1, 1, 2, 3, 5, 8 over a large prime, the first two terms fit a register of length zero and one. At term 2 the discrepancy 1 forces growth to linear complexity two with connection polynomial 1 - x - x^2, and every later term then has zero discrepancy, so the final answer is length two.",
    },
    id: "berlekamp-massey",
    name: "Berlekamp-Massey Algorithm",
    category: "math",
    complexity: { time: "O(N^2)", space: "O(N)" },
    defaultInput: { sequence: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize connection and previous polynomials to one",
        "set linear complexity zero and shift one",
        "for each sequence term compute the discrepancy",
        "if the discrepancy is zero increment the shift",
        "otherwise scale the previous polynomial and subtract it",
        "grow the register when two times its size fits the index",
        "otherwise just increment the shift",
        "done: the minimal connection polynomial and its degree",
    ],
};

export default module;
