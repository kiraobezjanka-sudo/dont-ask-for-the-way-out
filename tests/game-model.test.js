import test from "node:test";
import assert from "node:assert/strict";
import { dialogue, endings, validateDialogue } from "../src/game-data.js";
import { GameModel } from "../src/game-model.js";

const choosePath = (game, ids) => ids.forEach((id) => assert.equal(game.choose(id).ok, true, `не удалось выбрать ${id}`));
const winningPath = [
  "name-honest", "lost-radio", "ask-ribbon", "ask-reactor", "fear-honest",
  "ask-bell", "guess-school", "promise-until-dawn", "promise-box", "solve-route",
];

test("все узлы и концовки связаны корректно", () => {
  assert.deepEqual(validateDialogue(), []);
  assert.equal(Object.keys(dialogue).length, 10);
  assert.ok(Object.keys(endings).length >= 5);
});

test("основная ветка занимает 10 выборов и приводит к побегу", () => {
  const game = new GameModel();
  game.start(1000);
  choosePath(game, winningPath);
  assert.equal(game.status, "won");
  assert.equal(game.endingId, "escape");
  assert.ok(game.flags.has("knowsSchool"));
  assert.ok(game.flags.has("knowsCulvert"));
  assert.equal(game.history.filter((entry) => entry.speaker === "Миша").length, 10);
});

test("прямая просьба всегда активирует смертельный протокол", () => {
  for (const path of [
    ["ask-exit-early"],
    ["name-honest", "ask-road-out"],
    [...winningPath.slice(0, -1), "ask-final-exit"],
  ]) {
    const game = new GameModel();
    game.start();
    choosePath(game, path);
    assert.equal(game.status, "lost");
    assert.equal(game.endingId, "protocol");
  }
});

test("накопленное подозрение завершает разговор досрочно", () => {
  const game = new GameModel();
  game.start();
  choosePath(game, ["name-question", "ask-hungry-houses", "lie-doctor", "blame-her", "fear-monster"]);
  assert.equal(game.status, "lost");
  assert.equal(game.endingId, "suspicion");
});

test("высокое доверие открывает финал хрупкого союза", () => {
  const game = new GameModel();
  game.start();
  choosePath(game, [...winningPath.slice(0, -1), "stay-or-alliance"]);
  assert.equal(game.status, "finished");
  assert.equal(game.endingId, "alliance");
});

test("осторожный, но холодный разговор приводит к финалу нового жителя", () => {
  const game = new GameModel();
  game.start();
  choosePath(game, [
    "name-question", "ask-hungry-houses", "ask-arm", "ask-reactor", "fear-honest",
    "ring-bell", "guess-well", "promise-until-dawn", "refuse-box", "stay-or-alliance",
  ]);
  assert.equal(game.status, "finished");
  assert.equal(game.endingId, "resident");
});

test("без ориентиров маршрут побега скрыт и северная ошибка доступна", () => {
  const game = new GameModel();
  game.start();
  choosePath(game, ["name-honest", "lost-radio", "ask-ribbon", "blame-her", "fear-honest", "ignore-bell", "guess-well", "promise-until-dawn", "refuse-box"]);
  const ids = game.availableChoices().map((choice) => choice.id);
  assert.ok(!ids.includes("solve-route"));
  assert.ok(ids.includes("guess-wrong-route"));
  assert.ok(ids.length <= 3);
  game.choose("guess-wrong-route");
  assert.equal(game.endingId, "wrongRoute");
});

test("пауза замораживает время и блокирует выбор", () => {
  const game = new GameModel();
  game.start(1000);
  assert.equal(game.pause(2000), true);
  assert.equal(game.elapsedMs(9000), 1000);
  assert.equal(game.choose("name-honest").reason, "not-running");
  assert.equal(game.resume(12000), true);
  assert.equal(game.elapsedMs(13000), 2000);
});

test("перезапуск полностью очищает предыдущую попытку", () => {
  const game = new GameModel();
  game.start();
  game.choose("name-honest");
  game.reset();
  const state = game.snapshot();
  assert.equal(state.status, "idle");
  assert.equal(state.nodeId, "n1");
  assert.deepEqual(state.history, []);
  assert.deepEqual(state.flags, []);
});

test("на каждом достижимом узле не более трёх видимых вариантов", () => {
  const game = new GameModel();
  game.start();
  for (const id of winningPath.slice(0, -1)) {
    assert.ok(game.availableChoices().length <= 3);
    game.choose(id);
  }
  assert.ok(game.availableChoices().length <= 3);
});

test("игра хранит только флаги с будущей проверкой", () => {
  const storedFlags = new Set(Object.values(dialogue).flatMap((node) => node.choices.flatMap((choice) => choice.set ?? [])));
  assert.deepEqual([...storedFlags].sort(), ["boxPromise", "knowsCulvert", "knowsSchool"]);
});
