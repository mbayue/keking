const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const answers = {
  "play spring thief": [
    { pos: "01", song: "Yorushika — Spring Thief", len: "3:47", live: true }, // taste-skill-ignore: queue position, real track content
    { pos: "02", song: "Eve — Kaibutsu", len: "3:25" }, // taste-skill-ignore: queue position, real track content
    { pos: "03", song: "YOASOBI — Yoru ni Kakeru", len: "4:21" }, // taste-skill-ignore: queue position, real track content
  ],
  lyrics: [
    { pos: "♪", song: "Spring Thief — Yorushika", len: "verse 1", live: true }, // taste-skill-ignore: music glyph inside the player fragment
  ],
  "tts good morning everyone": [
    { pos: "🔊", song: "Speaking in voice channel: General", len: "0:04", live: true }, // taste-skill-ignore: TTS status glyph inside the player fragment
  ],
  skip: [
    { pos: "02", song: "Eve — Kaibutsu", len: "3:25", live: true }, // taste-skill-ignore: queue position, real track content
    { pos: "03", song: "YOASOBI — Yoru ni Kakeru", len: "4:21" }, // taste-skill-ignore: queue position, real track content
  ],
};

const answerEl = document.getElementById("demo-answer");
const inputEl = document.getElementById("demo-input");
const demoLine = document.querySelector(".demo-line");

function fitDemo() {
  if (!demoLine) return;
  demoLine.style.fontSize = "";
  const min = 20;
  let size = parseFloat(getComputedStyle(demoLine).fontSize);
  let guard = 40;
  while (inputEl.scrollWidth > inputEl.clientWidth + 1 && size > min && guard-- > 0) {
    size -= 2;
    demoLine.style.fontSize = size + "px";
  }
}

inputEl.addEventListener("input", () => {
  renderAnswer(inputEl.value.trim().toLowerCase());
  fitDemo();
});

window.addEventListener("resize", fitDemo);
window.addEventListener("load", fitDemo);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(fitDemo);
}

function renderAnswer(key) {
  const rows = answers[key];
  answerEl.innerHTML = "";
  if (!rows) {
    const note = document.createElement("p");
    note.className = "answer-note";
    note.textContent = "Unknown command — try one of the examples below.";
    answerEl.appendChild(note);
    return;
  }
  for (const row of rows) {
    const div = document.createElement("div");
    div.className = "answer-row" + (row.live ? " live" : "");
    const pos = document.createElement("span");
    pos.className = "pos";
    pos.textContent = row.pos;
    const song = document.createElement("span");
    song.className = "song";
    const len = document.createElement("span");
    len.className = "len";
    len.textContent = row.len;
    div.append(pos, song, len);
    answerEl.appendChild(div);
  }
  const note = document.createElement("p");
  note.className = "answer-note";
  if (key === "lyrics") {
    note.textContent = "Synced lyrics in the channel, line by line.";
  } else if (key.startsWith("tts")) {
    note.textContent = "Played once, then the queue resumes.";
  } else if (key === "skip") {
    note.textContent = "Skipped. Up next, Kaibutsu.";
  } else {
    note.textContent = "Now playing. Queue: 3 tracks · Lyrics available.";
  }
  answerEl.appendChild(note);
}

document.querySelectorAll(".demo-examples button").forEach((button) => {
  button.addEventListener("click", () => {
    inputEl.value = button.dataset.cmd;
    renderAnswer(button.dataset.cmd);
    fitDemo();
    inputEl.focus();
  });
});

renderAnswer("play spring thief");
fitDemo();

const chips = Array.from(document.querySelectorAll(".chip"));
let chipIndex = 0;

function showChip(index) {
  chipIndex = (index + chips.length) % chips.length;
  chips.forEach((chip, i) => {
    chip.classList.toggle("chip-active", i === chipIndex);
  });
}

if (!reduced && chips.length > 1) {
  setInterval(() => {
    showChip(chipIndex + 1);
  }, 4000);
}

const commands = ["play", "queue", "lyrics", "skip", "shuffle", "loop", "tts", "search", "pause", "now"];
const proofNames = document.getElementById("proof-names");
const litTimers = [];

commands.forEach((name, i) => {
  const span = document.createElement("span");
  span.className = "cmd";
  span.textContent = (i > 0 ? ", " : "") + "/" + name;
  proofNames.appendChild(span);
});
const tail = document.createElement("span");
tail.className = "cmd tail";
tail.textContent = " and 12 more.";
proofNames.appendChild(tail);

const cmdSpans = Array.from(proofNames.querySelectorAll(".cmd"));
let litIndex = -1;

function lightNext() {
  if (litIndex >= 0) {
    cmdSpans[litIndex].classList.remove("lit");
  }
  litIndex = (litIndex + 1) % cmdSpans.length;
  cmdSpans[litIndex].classList.add("lit");
}

lightNext();
if (!reduced) {
  setInterval(lightNext, 2000);
} else {
  cmdSpans.forEach((span) => span.classList.add("lit"));
  litTimers.push(0);
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add("in");
      observer.unobserve(entry.target);
    }
  }
}, { threshold: 0.2 });

document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = (i % 3) * 80 + "ms";
  observer.observe(el);
});
