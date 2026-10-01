// ПУЛЬТ ОПЕРАТОРА
const $ = id => document.getElementById(id);
let state = loadState();

function commit() { saveState(state); render(); }
function newGame() {
    if (!confirm("Начать игру заново? Жизни и ответы будут сброшены.")) return;
    state = freshState();
    commit();
}

function render() {
    const q = questions[state.q], ph = state.phase;
    $("qInfo").textContent = `Вопрос ${state.q + 1} из ${questions.length}`;
    $("phase").textContent = { answering: "Приём ответов", results: "Результаты показаны", finished: "Игра завершена" }[ph];
    $("qText").textContent = q.text;
    $("qAns").textContent = q.answer ? "ДА" : "НЕТ";

    $("rows").innerHTML = state.players.map((p, i) => {
        const m = playerMeta(p.id), dead = p.lives <= 0;
        const dis = ph !== "answering" || dead ? "disabled" : "";
        return `<div class="row ${dead ? "dead" : ""}">
            <div class="n">${i + 1}</div><div class="nm">${m.name} <small style="color:#8592ad;font-weight:400">верных: ${p.correct}</small></div>
            <div class="ans">
              <button data-act="ans" data-i="${i}" data-v="1" class="yes ${p.answer === true ? "on" : ""}" ${dis}>ДА</button>
              <button data-act="ans" data-i="${i}" data-v="0" class="no ${p.answer === false ? "on" : ""}" ${dis}>НЕТ</button>
            </div>
            <div class="lv">${"●".repeat(p.lives)}${"○".repeat(m.maxLives - p.lives)}</div>
            <div class="adj">
              <button data-act="life" data-i="${i}" data-d="-1">−1</button>
              <button data-act="life" data-i="${i}" data-d="1">${dead ? "Вернуть" : "+1"}</button>
            </div></div>`;
    }).join("");

    const act = active(), answered = act.filter(p => p.answer !== null).length;
    $("hint").textContent = ph === "answering" ? `Ответили: ${answered} из ${act.length}` : "";
    $("showBtn").disabled = ph !== "answering" || !allAnswered();
    $("resetBtn").disabled = ph !== "answering";
    $("nextBtn").disabled = ph !== "results";
    $("nextBtn").textContent = gameOver() ? "Финал →" : "Следующий вопрос →";
}

$("rows").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    const i = +b.dataset.i;
    if (b.dataset.act === "ans") {
        const v = b.dataset.v === "1";
        // повторный клик по выбранному ответу снимает его
        setAnswer(i, state.players[i].answer === v ? null : v);
    } else {
        changeLives(i, +b.dataset.d);
    }
});

$("showBtn").onclick = showResults;
$("nextBtn").onclick = nextQuestion;
$("resetBtn").onclick = resetAnswers;
$("newGame").onclick = newGame;
$("openAdmin").onclick = () => window.open("admin.html", "quizAdmin");
$("openStage").onclick = () => window.open("index.html", "quizStage");
// убираем фокус с кнопок, чтобы Space/Enter не нажимали их второй раз
document.addEventListener("click", () => document.activeElement && document.activeElement.blur());

document.addEventListener("keydown", handleHotkey);

// Пульт синхронизируется, если состояние изменили с экрана (клавиши работают в обоих окнах)
addEventListener("storage", e => {
    if (e.key === STORE_KEY) { state = loadState(); render(); }
});

// Подсказка, если окно пульта не в фокусе (клавиши идут в то окно, где фокус)
function checkFocus() { $("focusWarn").hidden = document.hasFocus(); }
addEventListener("focus", checkFocus);
addEventListener("blur", checkFocus);
checkFocus();

render();