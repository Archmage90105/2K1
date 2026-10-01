// ЭКРАН ДЛЯ ЗРИТЕЛЕЙ. Ничего не нажимается: всё управляется с пульта.
const $ = id => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

let state = loadState();
let lastSeq = state.seq;
let timers = [];
const cards = {};

// Сцена 1920×1080 масштабируется целиком
function fit() {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    $("stage").style.transform = `translate(-50%, -50%) scale(${k})`;
}
addEventListener("resize", fit);

function createRing(n) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "ring");
    svg.setAttribute("viewBox", "0 0 200 200");
    const r = 94, circ = 2 * Math.PI * r, gap = 24;
    const segs = [];
    for (let i = 0; i < n; i++) {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", 100);
        c.setAttribute("cy", 100);
        c.setAttribute("r", r);
        c.setAttribute("stroke-dasharray", `${circ / n - gap} ${circ}`);
        // поворот только здесь (в атрибуте), svg в CSS не вращается
        const rot = -90 + (360 / n) * i + (gap / 2 / circ) * 360;
        c.setAttribute("transform", `rotate(${rot} 100 100)`);
        c.setAttribute("class", "seg");
        svg.appendChild(c);
        segs.push(c);
    }
    return { svg, segs };
}

// Карточки создаются один раз, потом только обновляются
// Подбираем число рядов так, чтобы аватары были максимально крупными
function layout() {
    const n = players.length;
    let best = null;
    for (let r = 1; r <= 3; r++) {
        const c = Math.ceil(n / r);
        const av = Math.min(300, 1760 / c - 70, (620 / r - 40) / 1.36);
        if (!best || av > best.av) best = { c, av };
    }
    const g = $("players").style;
    g.setProperty("--cols", best.c);
    g.setProperty("--av", best.av + "px");
    g.setProperty("--k", Math.max(0.55, best.av / 300));
}

function build() {
    layout();
    players.forEach(p => {
        const card = document.createElement("article");
        card.className = "card";

        const vis = document.createElement("div");
        vis.className = "visual";
        const ring = createRing(p.maxLives);
        vis.appendChild(ring.svg);

        const img = new Image();
        img.className = "photo";
        img.alt = p.name;
        img.onerror = () => {
            img.remove();
            const ph = document.createElement("div");
            ph.className = "placeholder";
            ph.textContent = p.name.charAt(0).toUpperCase();
            vis.appendChild(ph);
        };
        if (p.photo) img.src = p.photo; else img.onerror();
        vis.appendChild(img);

        const name = document.createElement("div");
        name.className = "name";
        name.textContent = p.name;

        const res = document.createElement("div");
        res.className = "result";

        const place = document.createElement("div");
        place.className = "place";

        card.append(vis, name, res, place);
        $("players").appendChild(card);
        cards[p.id] = { card, segs: ring.segs, res, place };
    });
}

// Темп анимации потери жизни: чем больше ошибившихся, тем короче шаг на каждого,
// но не короче STEP_MIN и не длиннее STEP_MAX (мс). Ошибки показываются строго по очереди.
const STEP_TOTAL = 4000, STEP_MIN = 900, STEP_MAX = 1700;

// animate = true только в момент показа результата
function paint(s, animate) {
    timers.forEach(clearTimeout);
    timers = [];

    const q = questions[s.q];
    const showRes = s.phase !== "answering";
    const { sorted, places } = rankPlayers(s);

    $("qNum").textContent = s.q + 1;
    $("qTotal").textContent = questions.length;
    $("questionText").textContent = q.text;
    $("status").classList.toggle("show", showRes);
    $("status").textContent = showRes
        ? `ПРАВИЛЬНЫЙ ОТВЕТ: ${q.answer ? "ДА" : "НЕТ"}`
        : "УЧАСТНИКИ ВЫБИРАЮТ ОТВЕТ";

    const wrongIds = animate
        ? s.players.filter(p => p.prevLives > 0 && p.answer !== q.answer).map(p => p.id)
        : [];
    const step = Math.max(STEP_MIN, Math.min(STEP_MAX, STEP_TOTAL / Math.max(1, wrongIds.length)));

    s.players.forEach((sp, i) => {
        const c = cards[sp.id];

        // при анимации сначала рисуем состояние ДО ответа
        const shown = animate ? sp.prevLives : sp.lives;
        const gone = animate ? sp.prevLives <= 0 : sp.lives <= 0;   // уже выбыл (серый)
        c.segs.forEach((g, k) => g.setAttribute("class", "seg" + (k >= shown ? " lost" : "")));
        c.card.className = "card" + (gone ? " eliminated" : "");

        const was = sp.prevLives > 0;
        const ok = sp.answer === q.answer;
        let text = "", cls = "";
        if (showRes && was) {
            const a = sp.answer === null ? "—" : sp.answer ? "ДА" : "НЕТ";
            text = `${a}  ${ok ? "✓ ВЕРНО" : "✕ ОШИБКА"}`;
            cls = ok ? "correct" : "wrong";
        } else if (sp.lives <= 0) {
            text = "ВЫБЫЛ";
            cls = "wrong";
        }
        c.res.textContent = text;
        c.res.className = "result " + cls + (animate ? "" : " visible");

        c.place.textContent = sp.lives <= 0 ? `${places[sp.id]} МЕСТО` : "";
        c.place.className = "place" + (!animate || gone ? " visible" : "");

        if (!animate) return;

        const wi = wrongIds.indexOf(sp.id);
        const isWrong = wi >= 0;
        timers.push(setTimeout(() => {
            c.res.classList.add("visible");
            if (!isWrong) return;
            c.card.classList.add("wrong-anim");
            const seg = c.segs[sp.lives];
            if (seg) {
                seg.style.setProperty("--dur", `${step * 0.8}ms`);
                seg.setAttribute("class", "seg losing");
            }
            // карточка гаснет и получает место только после того, как погас сегмент
            if (sp.lives <= 0) {
                timers.push(setTimeout(() => {
                    c.card.classList.add("eliminated");
                    c.place.classList.add("visible");
                }, step * 0.85));
            }
        }, isWrong ? 700 + wi * step : i * 120));
    });

    if (animate) {
        timers.push(setTimeout(() => paint(state, false), 700 + wrongIds.length * step + 1200));
    }

    const fin = s.phase === "finished";
    $("finish").classList.toggle("hidden", !fin);
    if (fin) {
        $("rating").innerHTML = sorted.map(p =>
            `<div class="rate${places[p.id] === 1 ? " first" : ""}"><span class="pl">${places[p.id]}</span>` +
            `<span>${playerMeta(p.id).name}</span><span class="rc">верных: ${p.correct}</span></div>`
        ).join("");
    }
}

// Состояние меняется с пульта (событие storage) или клавишами в этом же окне (commit)
function sync() {
    const animate = state.phase === "results" && state.seq !== lastSeq;
    lastSeq = state.seq;
    paint(state, animate);
}
function commit() { saveState(state); sync(); }

addEventListener("storage", e => {
    if (e.key !== STORE_KEY) return;
    state = loadState();
    sync();
});

// F — полноэкранный режим
addEventListener("keydown", handleHotkey);
addEventListener("keydown", e => {
    if (e.code === "KeyF") {
        document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    }
});

fit();
build();
paint(state, false);