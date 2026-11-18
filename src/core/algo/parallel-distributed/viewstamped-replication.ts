/**
 * viewstamped-replication.ts - Viewstamped Replication (Primary-Backup Replication)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Viewstamped Replication keeps a replicated log consistent across replicas.
 * In one view, a primary orders client requests with sequence numbers and runs
 * a prepare/commit handshake with a quorum of backups. If the primary fails,
 * the replicas move to a new view; the new primary collects a quorum of view
 * change reports and re-commits the highest request that had been prepared,
 * so no acknowledged operation is lost and no operation is applied twice.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) messages per request and per view change, for r replicas
 *   Space: O(r) for the per-replica logs and prepared tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each replica is a node; the primary is highlighted, a crashed one is red.
 *   - Directed edges show the current PREPARE / PREPAREOK / COMMIT / VIEWCHANGE
 *     message, with the phase written on the edge label.
 *   - Frame metadata carries the view, the phase, the quorum, and every
 *     replica's committed log so the safety property is visible.
 *
 * This is a deterministic simulation of the replication state machine on a
 * small, fixed replica group, not a networked or fault-tolerant implementation.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Replica {
    id: number;
    view: number;
    primary: boolean;
    crashed: boolean;
    log: string[];
    prepared: Map<number, string>;
}

interface Message {
    from: number;
    to: number;
    label: string;
}

function makeNodes(rs: Replica[]): VisualEntity[] {
    return rs.map((r) => {
        const state: EntityState = r.crashed
            ? "error"
            : r.primary
              ? "active"
              : r.log.length > 0
                ? "sorted"
                : "idle";
        return {
            id: `replica-${r.id}`,
            type: "node" as const,
            label: `R${r.id}${r.primary ? " (primary)" : ""}`,
            value: { view: r.view, log: [...r.log], prepared: [...r.prepared.entries()] },
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                replica: r.id,
                view: r.view,
                primary: r.primary,
                crashed: r.crashed,
                committed: r.log.length,
            },
        };
    });
}

function makeEdges(messages: Message[], step: number): VisualEdge[] {
    return messages.map((m, index) => ({
        id: `msg-${step}-${index}`,
        sourceId: `replica-${m.from}`,
        targetId: `replica-${m.to}`,
        label: m.label,
        state: "path" as const,
        directed: true,
    }));
}

function logsOf(rs: Replica[]): string[] {
    return rs.map((r) => (r.crashed ? "-" : r.log.join("")));
}

/** The Viewstamped Replication generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { replicas?: number; requests?: string[]; crashSeq?: number } | null) ?? {};
    const count = Math.max(3, Math.floor(task.replicas ?? 3));
    const requests = Array.isArray(task.requests) && task.requests.length > 0
        ? task.requests.map(String)
        : ["A", "B", "C"];
    const crashSeq = typeof task.crashSeq === "number" ? Math.max(0, Math.floor(task.crashSeq)) : 2;
    const quorum = Math.floor(count / 2) + 1;

    const rs: Replica[] = Array.from({ length: count }, (_, id) => ({
        id,
        view: 0,
        primary: id === 0,
        crashed: false,
        log: [],
        prepared: new Map<number, string>(),
    }));

    let step = 0;
    let phase = "setup";
    const emit = (description: string, codeLine: number, messages: Message[], extra: object = {}) => {
        const frame: VisualFrame = {
            stepNumber: step,
            entities: makeNodes(rs),
            edges: makeEdges(messages, step),
            description,
            codeLineNumber: codeLine,
            layout: "graph",
            meta: {
                phase,
                view: rs[0]?.view ?? 0,
                quorum,
                replicaCount: count,
                logs: logsOf(rs),
                ...extra,
            },
        };
        step += 1;
        return frame;
    };

    yield emit(
        `Starting with ${count} replicas in view 0; a quorum is ${quorum}. Primary is R0.`,
        0,
        [],
    );

    let highestCommittedSeq = 0;
    let crashed = false;

    for (let i = 0; i < requests.length; i += 1) {
        const primary = rs.find((r) => r.primary && !r.crashed);
        if (!primary) {
            break;
        }
        const seq = i + 1;
        const op = requests[i] ?? "";

        phase = "prepare";
        const prepareMsgs: Message[] = rs
            .filter((r) => !r.crashed && r.id !== primary.id)
            .map((r) => ({ from: primary.id, to: r.id, label: `PREPARE(v${primary.view},s${seq},${op})` }));
        yield emit(`Primary R${primary.id} assigns sequence ${seq} to ${op} and sends PREPARE to the backups.`, 2, prepareMsgs, { seq, op });

        phase = "prepare-ok";
        for (const r of rs) {
            if (!r.crashed && r.id !== primary.id) {
                r.prepared.set(seq, op);
            }
        }
        primary.prepared.set(seq, op);
        const okMsgs: Message[] = rs
            .filter((r) => !r.crashed && r.id !== primary.id)
            .map((r) => ({ from: r.id, to: primary.id, label: `PREPAREOK(s${seq})` }));
        yield emit(`Backups store ${op} at sequence ${seq} and reply PREPAREOK; the primary now holds a quorum.`, 3, okMsgs, { seq, op });

        if (seq === crashSeq) {
            phase = "primary-crash";
            primary.crashed = true;
            primary.primary = false;
            crashed = true;
            yield emit(`Primary R${primary.id} crashes after preparing sequence ${seq}, before sending COMMIT.`, 6, [], { seq, op });
            break;
        }

        phase = "commit";
        const commitMsgs: Message[] = rs
            .filter((r) => !r.crashed && r.id !== primary.id)
            .map((r) => ({ from: primary.id, to: r.id, label: `COMMIT(v${primary.view},s${seq},${op})` }));
        yield emit(`A quorum has prepared sequence ${seq}; the primary sends COMMIT for ${op}.`, 4, commitMsgs, { seq, op });

        phase = "apply";
        for (const r of rs) {
            if (!r.crashed) {
                r.log.push(op);
            }
        }
        highestCommittedSeq = seq;
        yield emit(`Every live replica appends ${op} to its log; the client gets a reply.`, 5, [], { seq, op, log: [...(rs.find((r) => !r.crashed)?.log ?? [])] });
    }

    if (crashed) {
        const newView = 1;
        const newPrimaryId = rs.find((r) => !r.crashed)?.id ?? 0;
        phase = "view-change-start";
        for (const r of rs) {
            r.view = newView;
            r.primary = r.id === newPrimaryId;
        }
        yield emit(`The live replicas start a view change to view ${newView}; R${newPrimaryId} is the new primary.`, 6, [], { newView, newPrimaryId });

        phase = "view-change-report";
        const vcMsgs: Message[] = rs
            .filter((r) => !r.crashed && r.id !== newPrimaryId)
            .map((r) => ({ from: r.id, to: newPrimaryId, label: `VIEWCHANGE(v${newView},prepared=${[...r.prepared.entries()].map(([s, o]) => `${s}:${o}`).join(",")})` }));
        yield emit(`Live replicas report their prepared requests to the new primary.`, 7, vcMsgs, { newView, newPrimaryId });

        phase = "view-change-select";
        const quorumReporters = rs.filter((r) => !r.crashed);
        let highestPrepared = 0;
        const chosen = new Map<number, string>();
        for (const r of quorumReporters) {
            for (const [seq, op] of r.prepared.entries()) {
                if (seq > highestPrepared) {
                    highestPrepared = seq;
                }
                if (!chosen.has(seq)) {
                    chosen.set(seq, op);
                }
            }
        }
        yield emit(`From a quorum of reports, the new primary finds the highest prepared sequence ${highestPrepared}.`, 7, [], { highestPrepared, newView });

        phase = "recovery";
        for (let seq = highestCommittedSeq + 1; seq <= highestPrepared; seq += 1) {
            const op = chosen.get(seq);
            if (op === undefined) {
                continue;
            }
            const live = rs.filter((r) => !r.crashed);
            const recoverMsgs: Message[] = live
                .filter((r) => r.id !== newPrimaryId)
                .map((r) => ({ from: newPrimaryId, to: r.id, label: `PREPARE(v${newView},s${seq},${op})` }));
            yield emit(`New primary re-prepares the prepared request ${op} at sequence ${seq} in view ${newView}.`, 8, recoverMsgs, { seq, op, newView });

            for (const r of live) {
                r.prepared.set(seq, op);
                r.log.push(op);
            }
            highestCommittedSeq = seq;
            yield emit(`A quorum commits ${op} at sequence ${seq}; all live replicas now hold it once.`, 8, [], { seq, op, log: [...(live[0]?.log ?? [])] });
        }
    }

    phase = "done";
    const liveLogs = rs.filter((r) => !r.crashed).map((r) => r.log.join(""));
    const consistent = liveLogs.length > 0 && liveLogs.every((l) => l === liveLogs[0]);
    yield emit(
        `Replication complete: ${consistent ? "all live replicas hold the same ordered log" : "replica logs disagree"}.`,
        9,
        [],
        { consistent, finalLogs: logsOf(rs) },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a group of servers that must agree on an ordered list of operations even if one server dies. One server, the primary, assigns each operation a sequence number and asks the others to prepare it. Only after a majority has prepared does the primary commit. If the primary dies, the others elect a new primary, which asks everyone what they had prepared and finishes the highest-numbered operation so it is not lost or duplicated.",
        invariants: [
            "A request is committed only after a quorum has prepared it at the same sequence number.",
            "Committed requests form a prefix of the log that is identical on every live replica.",
            "A view change carries forward the highest prepared request into the new view.",
        ],
        correctness:
            "Any two quorums of 2f+1 replicas intersect in at least one replica. That intersecting replica never reports a lower prepared sequence than the one it acknowledged, so every new primary learns about the highest request that any quorum could have committed. Re-preparing that request in the new view before accepting new work guarantees agreement (all replicas commit the same sequence) and integrity (each sequence is committed at most once).",
        complexityRationale:
            "Each normal request sends one PREPARE and one PREPAREOK to r-1 replicas plus a COMMIT, so O(r) messages; a view change similarly exchanges O(r) reports. Each replica stores its log and prepared table, using O(r) space across the group.",
        uses: [
            "Replicated state machines that must keep a consistent ordered log",
            "Primary-backup replication in distributed storage systems",
            "The protocol family behind early versions of virtual synchrony toolkits",
        ],
        references: [
            "Oki and Liskov, Viewstamped Replication: A New Primary Copy Method, 1988",
            "Liskov and Cowling, Viewstamped Replication Revisited, 2012",
        ],
        workedExample:
            "With three replicas R0, R1, R2 and requests A, B, C, R0 commits A at sequence 1. While preparing B at sequence 2, R0 crashes. R1 becomes primary in view 1, learns from R2 that B was prepared at sequence 2, re-prepares it, and commits it. The final log on R1 and R2 is A, B; C was never prepared and is not committed.",
    },
    id: "viewstamped-replication",
    name: "Viewstamped Replication",
    category: "parallel-distributed",
    complexity: { time: "O(r) messages per request", space: "O(r)" },
    defaultInput: { replicas: 3, requests: ["A", "B", "C"], crashSeq: 2 },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize replicas with a view number and an empty committed log",
        "client sends a request to the current primary",
        "primary assigns the next sequence number and sends PREPARE to backups",
        "backups store the request and reply PREPAREOK to the primary",
        "once a quorum has prepared, primary sends COMMIT to all replicas",
        "each replica appends the request to its log and replies to the client",
        "if the primary fails, replicas start a view change with a higher view",
        "the new primary collects a quorum of reports of prepared requests",
        "it re-prepares and commits the highest prepared request, then resumes",
        "done: all live replicas hold the same ordered log",
    ],
};

export default module;
