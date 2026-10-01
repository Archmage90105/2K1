// Общее состояние игры. Хранится в localStorage:
// пульт (control.html) пишет, экран (index.html) читает через событие "storage".
const STORE_KEY = "quiz-state-v2";

// Настройки из admin.html (участники, вопросы) перекрывают файлы data/*.js
const CONFIG_KEY = "quiz-config-v1";
(function applyConfig() {
    try {
        const c = JSON.parse(localStorage.getItem(CONFIG_KEY));
        if (c && c.players && c.players.length && c.questions && c.questions.length) {
            players.splice(0, players.length, ...c.players);
            questions.splice(0, questions.length, ...c.questions);
        }
    } catch (e) {}
})();

// Игра заканчивается, когда остался один участник (поставьте false, если не нужно)
const END_WHEN_ONE_LEFT = true;

function freshState() {
    return {
        q: 0,
        phase: "answering",   // answering | results | finished
        seq: 0,               // растёт при каждом "Показать результат" (запускает анимацию)
        players: players.map(p => ({
            id: p.id,
            lives: p.maxLives,
            prevLives: p.maxLives,
            answer: null,
            correct: 0,           // число правильных ответов
            outAt: null           // номер вопроса, на котором выбыл
        }))
    };
}

function loadState() {
    try {
        const s = JSON.parse(localStorage.getItem(STORE_KEY));
        if (s && s.players && s.players.length === players.length &&
            s.players.every((p, i) => p.id === players[i].id) &&
            s.q < questions.length && s.players.every(p => "correct" in p)) return s;
    } catch (e) {}
    return freshState();
}

function saveState(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
}

const playerMeta = id => players.find(p => p.id === id);

// Рейтинг: сначала те, кто в игре; затем больше правильных ответов;
// затем кто выбыл позже; затем больше жизней. Равные показатели — одно место.
function rankPlayers(s) {
    const key = p => p.lives > 0
        ? [1, p.correct, 0, p.lives]
        : [0, p.correct, p.outAt ?? 0, 0];
    const cmp = (a, b) => {
        const x = key(a), y = key(b);
        for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i];
        return 0;
    };
    const sorted = [...s.players].sort(cmp);
    const places = {};
    sorted.forEach(p => { places[p.id] = 1 + sorted.findIndex(o => cmp(o, p) === 0); });
    return { sorted, places };
}

// ===== Действия игры: общие для пульта и экрана =====
// Страница должна объявить глобальные state и commit() (сохранить + перерисовать).
const active = () => state.players.filter(p => p.lives > 0);
const allAnswered = () => active().length > 0 && active().every(p => p.answer !== null);

function gameOver() {
    const n = active().length;
    return n === 0 || state.q >= questions.length - 1 ||
        (END_WHEN_ONE_LEFT && players.length > 1 && n <= 1);
}

function setAnswer(i, v) {
    const p = state.players[i];
    if (state.phase !== "answering" || !p || p.lives <= 0) return;
    p.answer = v;
    commit();
}

function cycleAnswer(i) {
    const p = state.players[i];
    if (!p) return;
    setAnswer(i, p.answer === null ? true : p.answer === true ? false : null);
}

function changeLives(i, d) {
    const p = state.players[i];
    p.lives = Math.max(0, Math.min(playerMeta(p.id).maxLives, p.lives + d));
    if (p.lives <= 0) { if (p.outAt === null) p.outAt = state.q; } else p.outAt = null;
    commit();
}

function showResults() {
    if (state.phase !== "answering" || !allAnswered()) return;
    const correct = questions[state.q].answer;
    state.players.forEach(p => {
        p.prevLives = p.lives;
        if (p.lives > 0) {
            if (p.answer === correct) p.correct++;
            else {
                p.lives--;
                if (p.lives <= 0) p.outAt = state.q;
            }
        }
    });
    state.phase = "results";
    state.seq++;
    commit();
}

function nextQuestion() {
    if (state.phase !== "results") return;
    if (gameOver()) {
        state.phase = "finished";
    } else {
        state.q++;
        state.phase = "answering";
        state.players.forEach(p => { p.answer = null; p.prevLives = p.lives; });
    }
    commit();
}

function resetAnswers() {
    if (state.phase !== "answering") return;
    state.players.forEach(p => p.answer = null);
    commit();
}


function handleHotkey(e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === "Enter") showResults();
    else if (e.code === "Space") { e.preventDefault(); nextQuestion(); }
    else if (e.code === "KeyR") resetAnswers();
    else if (/^Digit[1-9]$/.test(e.code)) cycleAnswer(+e.code.slice(5) - 1);
}