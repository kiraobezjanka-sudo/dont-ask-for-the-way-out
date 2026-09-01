import { GameModel } from "./game-model.js";

const model = new GameModel();
const $ = (selector) => document.querySelector(selector);
const screens = { start: $("#start-screen"), game: $("#game-screen"), ending: $("#ending-screen") };
const intelFlags = { "#intel-school": "knowsSchool", "#intel-culvert": "knowsCulvert" };
let audio = null;
let soundOn = false;
let frameId = null;

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => element.classList.toggle("is-visible", key === name));
}

function startGame() {
  model.reset();
  model.start();
  showScreen("game");
  render();
  startClock();
  $("#choices button")?.focus();
  playTone(145, 0.18);
}

function render() {
  const state = model.snapshot();
  if (["won", "lost", "finished"].includes(state.status)) return renderEnding(state);
  if (state.status === "idle") return showScreen("start");

  const { node } = state;
  $("#step-label").textContent = `РАЗГОВОР ${String(node.step).padStart(2, "0")} / 10`;
  $("#scene-kicker").textContent = node.kicker.toUpperCase();
  $("#speaker-name").textContent = node.speaker.toUpperCase();
  $("#speech-text").textContent = node.text;
  $("#trust-value").textContent = `${state.trust}%`;
  $("#danger-value").textContent = `${state.danger}%`;
  $("#trust-fill").style.width = `${state.trust}%`;
  $("#danger-fill").style.width = `${state.danger}%`;
  $("#portrait").style.setProperty("--mutation", `${Math.max(18, state.danger)}%`);
  document.body.classList.toggle("high-danger", state.danger >= 55);

  $("#step-dots").innerHTML = Array.from({ length: 10 }, (_, index) => `<i class="${index < node.step ? "done" : ""}"></i>`).join("");
  for (const [selector, flag] of Object.entries(intelFlags)) $(selector).classList.toggle("found", state.flags.includes(flag));

  const recent = state.history.slice(-2);
  const exchange = $("#last-exchange");
  exchange.hidden = recent.length < 2;
  exchange.innerHTML = recent.length >= 2 ? `<span>${escapeHtml(recent[1].text)}</span>` : "";

  const choices = $("#choices");
  choices.innerHTML = "";
  state.availableChoices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = `choice-button${choice.direct ? " dangerous-choice" : ""}`;
    button.dataset.choiceId = choice.id;
    button.innerHTML = `<span class="choice-number">${index + 1}</span><span>${escapeHtml(choice.text)}</span><i>↗</i>`;
    button.addEventListener("click", () => makeChoice(choice.id));
    choices.append(button);
  });
  renderLog(state);
}

function makeChoice(choiceId) {
  const choice = model.node.choices.find((item) => item.id === choiceId);
  if (!choice) return;
  playTone(choice.direct ? 62 : 220 + Math.max(0, choice.trust ?? 0) * 3, choice.direct ? 0.8 : 0.12);
  model.choose(choiceId);
  render();
}

function renderLog(state) {
  $("#log-content").innerHTML = state.history.map((entry) => `<p class="log-entry ${entry.speaker === "Миша" ? "boy" : ""}"><strong>${escapeHtml(entry.speaker)}</strong>${escapeHtml(entry.text)}</p>`).join("") || "<p class='empty-log'>Запись пуста.</p>";
  $("#log-content").scrollTop = $("#log-content").scrollHeight;
}

function renderEnding(state) {
  cancelAnimationFrame(frameId);
  showScreen("ending");
  $("#ending-screen").dataset.result = state.status;
  $("#ending-eyebrow").textContent = state.ending.eyebrow;
  $("#ending-title").textContent = state.ending.title;
  $("#ending-text").textContent = state.ending.text;
  $("#ending-trust").textContent = `${state.trust}%`;
  $("#ending-danger").textContent = `${state.danger}%`;
  $("#ending-intel").textContent = `${Object.values(intelFlags).filter((flag) => state.flags.includes(flag)).length} / ${Object.keys(intelFlags).length}`;
  $("#ending-symbol").textContent = state.status === "won" ? "↗" : state.status === "lost" ? "☢" : "∞";
  document.body.classList.remove("high-danger");
  $("#restart-button").focus();
}

function togglePause(forceResume = false) {
  if (model.status === "running" && !forceResume) model.pause();
  else if (model.status === "paused") model.resume();
  else return;
  const paused = model.status === "paused";
  $("#pause-overlay").hidden = !paused;
  $("#game-screen").inert = paused;
  if (paused) $("#resume-button").focus(); else $("#choices button")?.focus();
}

function toggleLog(open = null) {
  const drawer = $("#log-drawer");
  const shouldOpen = open ?? !drawer.classList.contains("open");
  drawer.classList.toggle("open", shouldOpen);
  drawer.setAttribute("aria-hidden", String(!shouldOpen));
  $("#log-button").setAttribute("aria-expanded", String(shouldOpen));
}

function startClock() {
  cancelAnimationFrame(frameId);
  const tick = () => {
    const seconds = Math.floor(model.elapsedMs() / 1000);
    $("#timer").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    if (["running", "paused"].includes(model.status)) frameId = requestAnimationFrame(tick);
  };
  tick();
}

function initAudio() {
  if (audio) return;
  audio = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(frequency, duration) {
  if (!soundOn) return;
  initAudio();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.68), audio.currentTime + duration);
  gain.gain.setValueAtTime(0.055, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}

$("#start-button").addEventListener("click", startGame);
$("#restart-button").addEventListener("click", startGame);
$("#pause-button").addEventListener("click", () => togglePause());
$("#resume-button").addEventListener("click", () => togglePause(true));
$("#log-button").addEventListener("click", () => toggleLog());
$("#close-log").addEventListener("click", () => toggleLog(false));
$("#sound-button").addEventListener("click", () => {
  soundOn = !soundOn;
  $("#sound-button").textContent = `ЗВУК: ${soundOn ? "ВКЛ" : "ВЫКЛ"}`;
  $("#sound-button").setAttribute("aria-pressed", String(soundOn));
  playTone(180, 0.2);
});

document.addEventListener("keydown", (event) => {
  if (["Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3", "Escape", "KeyP", "KeyR", "Enter"].includes(event.code)) event.preventDefault();
  if (model.status === "idle" && event.code === "Enter") return startGame();
  if (["won", "lost", "finished"].includes(model.status) && event.code === "KeyR") return startGame();
  if (model.status === "paused" && ["Escape", "KeyP", "Enter"].includes(event.code)) return togglePause(true);
  if (model.status === "running" && ["Escape", "KeyP"].includes(event.code)) return togglePause();
  if (model.status === "running") {
    const index = { Digit1: 0, Numpad1: 0, Digit2: 1, Numpad2: 1, Digit3: 2, Numpad3: 2 }[event.code];
    if (index !== undefined) $("#choices").children[index]?.click();
  }
});

render();
