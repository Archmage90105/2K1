// НАСТРОЙКИ: участники и вопросы без правки файлов
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
let P = players.map(p => ({ name: p.name, photo: p.photo }));
let Q = questions.map(q => ({ text: q.text, answer: q.answer }));
let photoIdx = 0;
$("lives").value = players[0] ? players[0].maxLives : 3;

function msg(t, err) { $("msg").textContent = t; $("msg").className = err ? "err" : ""; }

function render() {
    $("plist").innerHTML = P.map((p, i) => `<div class="row">
        <div class="th" data-act="photo" data-i="${i}" title="Загрузить фото"><span>${esc((p.name || "?")[0].toUpperCase())}</span>${p.photo ? `<img src="${esc(p.photo)}" onerror="this.remove()">` : ""}</div>
        <input data-k="p" data-f="name" data-i="${i}" value="${esc(p.name)}" placeholder="Имя">
        <button data-act="delP" data-i="${i}">✕</button></div>`).join("");
    $("qlist").innerHTML = Q.map((q, i) => `<div class="row">
        <span class="n">${i + 1}</span>
        <input data-k="q" data-f="text" data-i="${i}" value="${esc(q.text)}" placeholder="Текст вопроса">
        <select data-k="q" data-f="answer" data-i="${i}"><option value="1" ${q.answer ? "selected" : ""}>ДА</option><option value="0" ${q.answer ? "" : "selected"}>НЕТ</option></select>
        <button data-act="up" data-i="${i}">↑</button><button data-act="down" data-i="${i}">↓</button>
        <button data-act="delQ" data-i="${i}">✕</button></div>`).join("");
}

document.addEventListener("input", e => {
    const t = e.target;
    if (!t.dataset.f) return;
    const item = (t.dataset.k === "p" ? P : Q)[+t.dataset.i];
    item[t.dataset.f] = t.dataset.f === "answer" ? t.value === "1" : t.value;
});

document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const i = +b.dataset.i, a = b.dataset.act;
    if (a === "photo") { photoIdx = i; $("file").click(); return; }
    if (a === "addP") P.push({ name: "", photo: "" });
    if (a === "addQ") Q.push({ text: "", answer: true });
    if (a === "delP") P.splice(i, 1);
    if (a === "delQ") Q.splice(i, 1);
    if (a === "up" && i > 0) [Q[i - 1], Q[i]] = [Q[i], Q[i - 1]];
    if (a === "down" && i < Q.length - 1) [Q[i + 1], Q[i]] = [Q[i], Q[i + 1]];
    render();
});

// Фото: обрезаем до квадрата 400×400 и храним как JPEG в браузере
$("file").onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
        const s = Math.min(img.width, img.height), c = document.createElement("canvas");
        c.width = c.height = 400;
        c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 400, 400);
        P[photoIdx].photo = c.toDataURL("image/jpeg", 0.85);
        URL.revokeObjectURL(img.src);
        render();
    };
    img.src = URL.createObjectURL(f);
    e.target.value = "";
};

function buildConfig() {
    const lives = Math.max(1, Math.min(5, +$("lives").value || 3));
    return {
        players: P.map((p, i) => ({ id: i + 1, name: p.name.trim(), photo: p.photo, maxLives: lives })),
        questions: Q.map(q => ({ text: q.text.trim(), answer: q.answer }))
    };
}

$("save").onclick = () => {
    const c = buildConfig();
    if (!c.players.length || !c.questions.length) return msg("Нужен хотя бы один участник и один вопрос", true);
    if (c.players.some(p => !p.name) || c.questions.some(q => !q.text)) return msg("Заполните все имена и тексты вопросов", true);
    if (localStorage.getItem(STORE_KEY) && !confirm("Игра будет начата заново. Продолжить?")) return;
    try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
        localStorage.removeItem(STORE_KEY);
        msg("Сохранено. Игра сброшена — обновите пульт и экран.");
    } catch (err) {
        msg("Не удалось сохранить (возможно, слишком много фото)", true);
    }
};

$("export").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(buildConfig())], { type: "application/json" }));
    a.download = "quiz-config.json";
    a.click();
};

$("import").onclick = () => $("jsonFile").click();
$("jsonFile").onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
        try {
            const c = JSON.parse(r.result);
            P = c.players.map(p => ({ name: String(p.name), photo: p.photo || "" }));
            Q = c.questions.map(q => ({ text: String(q.text), answer: !!q.answer }));
            if (c.players[0]) $("lives").value = c.players[0].maxLives || 3;
            render();
            msg("Копия загружена — нажмите «Сохранить», чтобы применить");
        } catch (err) { msg("Не удалось прочитать файл", true); }
    };
    r.readAsText(f);
    e.target.value = "";
};

$("reset").onclick = () => {
    if (!confirm("Вернуть участников и вопросы из файлов data/? Игра начнётся заново.")) return;
    localStorage.removeItem(CONFIG_KEY);
    localStorage.removeItem(STORE_KEY);
    location.reload();
};

render();
