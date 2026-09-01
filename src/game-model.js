import { dialogue, endings, DIRECT_REQUEST_ENDING } from "./game-data.js";

const clamp = (value) => Math.max(0, Math.min(100, value));

export class GameModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.status = "idle";
    this.nodeId = "n1";
    this.trust = 18;
    this.danger = 12;
    this.flags = new Set();
    this.history = [];
    this.endingId = null;
    this.startedAt = null;
    this.pausedAt = null;
    this.totalPausedMs = 0;
    return this.snapshot();
  }

  start(now = Date.now()) {
    if (this.status !== "idle") return this.snapshot();
    this.status = "running";
    this.startedAt = now;
    this.history.push({ speaker: "Система", text: "Контакт установлен. Не формулируйте прямую просьбу о выходе." });
    return this.snapshot();
  }

  pause(now = Date.now()) {
    if (this.status !== "running") return false;
    this.status = "paused";
    this.pausedAt = now;
    return true;
  }

  resume(now = Date.now()) {
    if (this.status !== "paused") return false;
    this.totalPausedMs += Math.max(0, now - this.pausedAt);
    this.pausedAt = null;
    this.status = "running";
    return true;
  }

  get node() {
    const node = dialogue[this.nodeId];
    const variant = node.textVariants?.find((candidate) => {
      const hasRequirements = candidate.requires?.every((flag) => this.flags.has(flag)) ?? true;
      const hasExcludedFlag = candidate.excludes?.some((flag) => this.flags.has(flag)) ?? false;
      return hasRequirements && !hasExcludedFlag;
    });
    return variant ? { ...node, text: variant.text } : node;
  }

  availableChoices() {
    if (this.status !== "running") return [];
    return this.node.choices.filter((choice) => {
      const hasRequirements = !choice.requires || choice.requires.every((flag) => this.flags.has(flag));
      const excluded = choice.unlessAll?.every((flag) => this.flags.has(flag));
      return hasRequirements && !excluded;
    });
  }

  choose(choiceId) {
    if (this.status !== "running") return { ok: false, reason: "not-running", snapshot: this.snapshot() };
    const choice = this.node.choices.find((item) => item.id === choiceId);
    if (!choice) return { ok: false, reason: "unknown-choice", snapshot: this.snapshot() };
    if (choice.requires && !choice.requires.every((flag) => this.flags.has(flag))) {
      return { ok: false, reason: "locked-choice", snapshot: this.snapshot() };
    }
    if (choice.unlessAll?.every((flag) => this.flags.has(flag))) {
      return { ok: false, reason: "locked-choice", snapshot: this.snapshot() };
    }

    this.history.push({ speaker: "Миша", text: choice.text });
    this.history.push({ speaker: "Вера", text: choice.reply });
    this.trust = clamp(this.trust + (choice.trust ?? 0));
    this.danger = clamp(this.danger + (choice.danger ?? 0));
    for (const flag of choice.set ?? []) this.flags.add(flag);

    if (choice.direct) return this.finish(DIRECT_REQUEST_ENDING, choiceId);
    if (this.danger >= 72 && this.node.step < 10) return this.finish("suspicion", choiceId);
    if (choice.endingBy === "bond") {
      const endingId = this.trust >= 72 && this.flags.has("boxPromise") ? "alliance" : "resident";
      return this.finish(endingId, choiceId);
    }
    if (choice.ending) return this.finish(choice.ending, choiceId);
    if (choice.next) this.nodeId = choice.next;
    return { ok: true, terminal: false, choiceId, snapshot: this.snapshot() };
  }

  finish(endingId, choiceId = null) {
    const ending = endings[endingId];
    if (!ending) throw new Error(`Неизвестная концовка: ${endingId}`);
    this.endingId = endingId;
    this.status = ending.status;
    return { ok: true, terminal: true, choiceId, endingId, snapshot: this.snapshot() };
  }

  elapsedMs(now = Date.now()) {
    if (!this.startedAt) return 0;
    const endpoint = this.pausedAt ?? now;
    return Math.max(0, endpoint - this.startedAt - this.totalPausedMs);
  }

  snapshot(now = Date.now()) {
    return {
      status: this.status,
      nodeId: this.nodeId,
      node: this.node,
      trust: this.trust,
      danger: this.danger,
      flags: [...this.flags],
      history: this.history.map((entry) => ({ ...entry })),
      endingId: this.endingId,
      ending: this.endingId ? endings[this.endingId] : null,
      elapsedMs: this.elapsedMs(now),
      availableChoices: this.availableChoices().map((choice) => ({ ...choice })),
    };
  }
}
