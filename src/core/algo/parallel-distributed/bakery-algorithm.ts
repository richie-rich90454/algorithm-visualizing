/**
 * bakery-algorithm.ts - Lamport Bakery Mutual Exclusion
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The bakery algorithm lets n processes share one critical section without a
 * central lock. On entering the bakery a process raises a choosing flag and
 * takes a ticket one higher than every ticket currently held. It then waits
 * until no other process is choosing and no other ticket sorts before its own,
 * where ties break by process id. Because tickets are unique and served in
 * order, at most one process is ever inside, and every process eventually gets
 * a turn. The algorithm assumes atomic reads and writes of single words.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) ticket scan and O(n) wait checks per critical-section visit
 *   Space: O(n) for the flags and ticket numbers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Processes sit on a circle, colored by their protocol phase.
 *   - Gold means choosing, blue means waiting, green means inside the section.
 *   - meta carries tickets, flags, concurrent count, and entry counts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeNodes(
    count: number,
    pc: number[],
    finished: boolean[],
): VisualEntity[] {
    return Array.from({ length: count }, (_, index) => {
        const angle = (2 * Math.PI * index) / count - Math.PI / 2;
        let state: EntityState = "unvisited";
        if (finished[index]) {
            state = "sorted";
        } else if (pc[index] === 3) {
            state = "active";
        } else if (pc[index] === 2) {
            state = "visited";
        } else if (pc[index] === 1) {
            state = "comparing";
        }
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: `P${index}`,
            value: index,
            state,
            x: 300 + 190 * Math.cos(angle),
            y: 300 + 190 * Math.sin(angle),
            width: 0,
            height: 0,
            metadata: { index, phase: pc[index] ?? 0, finished: finished[index] === true },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { processes?: number; visits?: number } | null) ?? {};
    const count = Math.max(2, Math.min(8, Math.floor(Number(task.processes ?? 4)) || 4));
    const visits = Math.max(1, Math.min(4, Math.floor(Number(task.visits ?? 1)) || 1));

    const choosing = Array.from({ length: count }, () => false);
    const number = Array.from({ length: count }, () => 0);
    const pc = Array.from({ length: count }, () => 0);
    const finished = Array.from({ length: count }, () => false);
    const entries = Array.from({ length: count }, () => 0);
    const round = Array.from({ length: count }, () => 0);
    let maxConcurrent = 0;
    let step = 0;

    const inCS = () => pc.reduce((sum, phase) => sum + (phase === 3 ? 1 : 0), 0);
    const metaFor = (turn: number) => ({
        processes: count,
        visits,
        turn,
        tickets: number.slice(),
        choosing: choosing.map((v) => (v ? 1 : 0)),
        phases: pc.slice(),
        inCS: pc.findIndex((phase) => phase === 3),
        concurrent: inCS(),
        maxConcurrent,
        entries: entries.slice(),
        allFinished: finished.every(Boolean),
    });

    const emit = (turn: number, description: string, codeLine: number) => {
        maxConcurrent = Math.max(maxConcurrent, inCS());
        const frame: VisualFrame = {
            stepNumber: step,
            entities: makeNodes(count, pc, finished),
            edges: [],
            description,
            codeLineNumber: codeLine,
            layout: "point",
            meta: metaFor(turn),
        };
        step += 1;
        return frame;
    };

    yield emit(0, `${count} process(es) enter the bakery; each will request the critical section once per visit.`, 0);

    const canEnter = (i: number): boolean => {
        for (let j = 0; j < count; j += 1) {
            if (j === i) continue;
            if (choosing[j]) return false;
            const nj = number[j] ?? 0;
            const ni = number[i] ?? 0;
            if (nj !== 0 && (nj < ni || (nj === ni && j < i))) return false;
        }
        return true;
    };

    const advance = (i: number, turn: number): VisualFrame | null => {
        if (finished[i]) return null;
        const phase = pc[i];
        if (phase === 0) {
            choosing[i] = true;
            pc[i] = 1;
            return emit(turn, `Process ${i} raises its choosing flag before taking a ticket.`, 1);
        }
        if (phase === 1) {
            let maxTicket = 0;
            for (let j = 0; j < count; j += 1) {
                if (j !== i) maxTicket = Math.max(maxTicket, number[j] ?? 0);
            }
            number[i] = maxTicket + 1;
            choosing[i] = false;
            pc[i] = 2;
            return emit(turn, `Process ${i} takes ticket ${number[i]} and clears its choosing flag.`, 2);
        }
        if (phase === 2) {
            if (canEnter(i)) {
                pc[i] = 3;
                entries[i] = (entries[i] ?? 0) + 1;
                return emit(turn, `Ticket ${number[i]} is next, so process ${i} enters the critical section (visit ${entries[i]}).`, 4);
            }
            return emit(turn, `Process ${i} waits: another choosing flag or earlier ticket blocks it.`, 3);
        }
        const releasedTicket = number[i] ?? 0;
        number[i] = 0;
        pc[i] = 0;
        round[i] = (round[i] ?? 0) + 1;
        if ((round[i] ?? 0) >= visits) {
            finished[i] = true;
            return emit(turn, `Process ${i} releases ticket ${releasedTicket} and leaves after ${visits} visit(s).`, 5);
        }
        return emit(turn, `Process ${i} releases its ticket and will request again.`, 5);
    };

    let turn = 0;
    const maxTurns = count * visits * 16 + 16;
    while (turn < maxTurns && !finished.every(Boolean)) {
        for (let i = 0; i < count; i += 1) {
            if (finished.every(Boolean)) break;
            turn += 1;
            const produced = advance(i, turn);
            if (produced) yield produced;
        }
    }

    yield emit(turn, `All processes completed ${visits} visit(s); the peak number inside at once was ${maxConcurrent}.`, 6);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a bakery with a take-a-number machine. Each process announces that it is choosing, grabs the next ticket, and then waits until everyone with an earlier ticket has been served. Ties are broken by process id, so the order is total and nobody can slip past another process. Since only one ticket is served at a time, only one process enters the protected section.",
        invariants: [
            "Ticket numbers are unique among processes that hold one.",
            "A process enters only after every choosing flag is cleared and no earlier ticket remains.",
            "At most one process occupies the critical section at any moment.",
        ],
        correctness:
            "Mutual exclusion holds because two processes in the section must hold tickets; the one with the larger ticket would have seen the smaller one and waited. The choosing flag closes the race where two processes take tickets simultaneously and could otherwise compare stale numbers. Progress holds because tickets are finite and ordered: among all waiting processes the smallest ticket eventually finds no blocker and enters, so no process waits forever once it holds a ticket. Atomic single-word reads and writes make the flag and ticket updates well defined.",
        complexityRationale:
            "Taking a ticket scans the other n processes, and each wait check also scans them, so a critical-section visit costs O(n) work and O(n) checks. Storage is two n-element arrays of flags and numbers, hence O(n) space.",
        uses: [
            "Mutual exclusion without special atomic instructions beyond single-word reads and writes",
            "A textbook model for ticket locks and fair spin locks",
            "Fairness guarantees in operating-system kernel lock designs",
        ],
        references: [
            "Lamport, A New Solution of Dijkstra's Concurrent Programming Problem, 1974",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter 6",
        ],
        workedExample:
            "Three processes request at once. P0 takes ticket 1, P1 takes 2, P2 takes 3. P0 sees no earlier ticket and enters. P1 and P2 wait. When P0 releases its ticket, P1 becomes the smallest and enters, then P2 follows. At no point are two processes inside, and each got one turn in ticket order.",
    },
    id: "bakery-algorithm",
    name: "Bakery Algorithm",
    category: "parallel-distributed",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { processes: 4, visits: 1 },
    visualType: "point",
    run,
    pseudocode: [
        "set choosing[i] true for the requesting process",
        "set number[i] to one plus the largest ticket held",
        "set choosing[i] false to publish the ticket",
        "for every other process wait while choosing[j] is true",
        "also wait while ticket j precedes ticket i in number and id order",
        "enter the critical section and do the protected work",
        "release the ticket by setting number[i] to zero",
        "repeat for the next visit when requested",
        "done: every process visited without overlap",
    ],
};

export default module;
