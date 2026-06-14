const CURRENCIES = ["USD", "JPY", "EUR", "GBP", "AUD", "NZD", "CAD", "CHF"];
const SCORE_OPTIONS = [
  { value: "", label: "--" },
  { value: "1", label: "+1" },
  { value: "0", label: "0" },
  { value: "-1", label: "-1" },
];

const form = document.getElementById("checklist-form");
const datePicker = document.getElementById("date-picker");
const todayBtn = document.getElementById("today-btn");
const eventsBody = document.querySelector("#events-table tbody");
const addEventRowBtn = document.getElementById("add-event-row");
const strengthBody = document.querySelector("#strength-matrix tbody");
const exportBtn = document.getElementById("export-btn");
const saveStatus = document.getElementById("save-status");
const dataSourceNotice = document.getElementById("data-source-notice");
const strengthSuggestion = document.getElementById("strength-suggestion");

const crossPairDetails = document.getElementById("cross-pair-details");
const cpPairName = document.getElementById("cp-pair-name");
const cpBaseName = document.getElementById("cp-base-name");
const cpQuoteName = document.getElementById("cp-quote-name");
const cpBaseMemo = document.getElementById("cp-base-memo");
const cpQuoteMemo = document.getElementById("cp-quote-memo");
const cpRateMemo = document.getElementById("cp-rate-memo");
const cpSurpriseMemo = document.getElementById("cp-surprise-memo");
const cpEventsBody = document.querySelector("#cp-events-table tbody");
const cpBias = document.getElementById("cp-bias");
const cpReason = document.getElementById("cp-reason");
const cpBreakdown = document.getElementById("cp-breakdown");

let currentCrossPair = null;

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function storageKey(dateStr) {
  return `fxcheck_${dateStr}`;
}

function makeSelect(options) {
  const select = document.createElement("select");
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    select.appendChild(o);
  }
  return select;
}

function createEventRow(rowData = {}) {
  const tr = document.createElement("tr");
  const fields = ["time", "indicator", "forecast", "previous", "up", "down"];
  for (const f of fields) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.dataset.field = f;
    input.value = rowData[f] || "";
    td.appendChild(input);
    tr.appendChild(td);
  }
  const tdRemove = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "削除";
  removeBtn.className = "row-remove";
  removeBtn.addEventListener("click", () => {
    tr.remove();
    saveCurrentData();
  });
  tdRemove.appendChild(removeBtn);
  tr.appendChild(tdRemove);
  return tr;
}

function createStrengthRow(currency, rowData = {}) {
  const tr = document.createElement("tr");
  tr.dataset.currency = currency;

  const tdCur = document.createElement("td");
  tdCur.textContent = currency;
  tr.appendChild(tdCur);

  const fields = ["policy", "data", "risk"];
  for (const f of fields) {
    const td = document.createElement("td");
    const select = makeSelect(SCORE_OPTIONS);
    select.dataset.field = f;
    select.value = rowData[f] || "";
    select.addEventListener("change", () => {
      recalcTotal(tr);
      updateStrengthSuggestion();
      saveCurrentData();
    });
    td.appendChild(select);
    tr.appendChild(td);
  }

  const tdTotal = document.createElement("td");
  tdTotal.className = "total-cell";
  tdTotal.textContent = "0";
  tr.appendChild(tdTotal);

  recalcTotal(tr);
  return tr;
}

function recalcTotal(tr) {
  const selects = tr.querySelectorAll("select");
  let total = 0;
  selects.forEach((s) => {
    const v = parseInt(s.value, 10);
    if (!isNaN(v)) total += v;
  });
  tr.querySelector(".total-cell").textContent = total;
}

function updateStrengthSuggestion() {
  const totals = [];
  strengthBody.querySelectorAll("tr").forEach((tr) => {
    const total = parseInt(tr.querySelector(".total-cell").textContent, 10) || 0;
    totals.push({ currency: tr.dataset.currency, total });
  });

  const allZero = totals.every((t) => t.total === 0);
  if (allZero) {
    strengthSuggestion.hidden = true;
    return;
  }

  const max = Math.max(...totals.map((t) => t.total));
  const min = Math.min(...totals.map((t) => t.total));
  const strong = totals.filter((t) => t.total === max).map((t) => t.currency);
  const weak = totals.filter((t) => t.total === min).map((t) => t.currency);

  strengthSuggestion.hidden = false;
  strengthSuggestion.innerHTML =
    `<strong>本日の強弱:</strong> 強い ＝ ${strong.join("・")}（${max >= 0 ? "+" + max : max}） / ` +
    `弱い ＝ ${weak.join("・")}（${min >= 0 ? "+" + min : min}）<br>` +
    `→ 強い通貨を買い・弱い通貨を売る組み合わせ（例：${strong[0]}/${weak[0]} や ${weak[0]}/${strong[0]}）が、本日トレンドが出やすいペアの目安です。`;
}

function buildStrengthMatrix(data = {}) {
  strengthBody.innerHTML = "";
  for (const cur of CURRENCIES) {
    const rowData = (data.strength && data.strength[cur]) || {};
    strengthBody.appendChild(createStrengthRow(cur, rowData));
  }
  updateStrengthSuggestion();
}

function buildEventsTable(events = []) {
  eventsBody.innerHTML = "";
  const rows = events.length ? events : [{}, {}];
  for (const ev of rows) {
    eventsBody.appendChild(createEventRow(ev));
  }
}

function collectFormData() {
  const data = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    data[el.name] = el.value;
  }

  data.events = [];
  eventsBody.querySelectorAll("tr").forEach((tr) => {
    const ev = {};
    tr.querySelectorAll("input").forEach((input) => {
      ev[input.dataset.field] = input.value;
    });
    if (Object.values(ev).some((v) => v)) data.events.push(ev);
  });

  data.strength = {};
  strengthBody.querySelectorAll("tr").forEach((tr) => {
    const cur = tr.dataset.currency;
    const entry = {};
    tr.querySelectorAll("select").forEach((s) => {
      entry[s.dataset.field] = s.value;
    });
    data.strength[cur] = entry;
  });

  data.cross_pair = currentCrossPair;

  return data;
}

function renderCrossPair(crossPair) {
  if (!crossPair) {
    crossPairDetails.hidden = true;
    return;
  }

  crossPairDetails.hidden = false;
  cpPairName.textContent = crossPair.pair || "";
  cpBaseName.textContent = crossPair.base || "";
  cpQuoteName.textContent = crossPair.quote || "";
  cpBaseMemo.textContent = crossPair.base_flow_memo || "";
  cpQuoteMemo.textContent = crossPair.quote_flow_memo || "";
  cpRateMemo.textContent = crossPair.rate_diff_memo || "";
  cpSurpriseMemo.textContent = crossPair.surprise_memo || "";
  cpBias.textContent = crossPair.scenario_bias || "";
  cpReason.textContent = crossPair.scenario_reason || "";
  cpBreakdown.textContent = crossPair.scenario_breakdown || "";

  cpEventsBody.innerHTML = "";
  for (const ev of crossPair.events || []) {
    const tr = document.createElement("tr");
    for (const f of ["time", "indicator", "forecast", "previous", "up", "down"]) {
      const td = document.createElement("td");
      td.textContent = ev[f] || "";
      tr.appendChild(td);
    }
    cpEventsBody.appendChild(tr);
  }
}

function populateForm(data = {}) {
  for (const el of form.elements) {
    if (!el.name) continue;
    el.value = data[el.name] || "";
  }
  buildEventsTable(data.events || []);
  buildStrengthMatrix(data);
  currentCrossPair = data.cross_pair || null;
  renderCrossPair(currentCrossPair);
}

async function loadDate(dateStr) {
  datePicker.value = dateStr;
  const raw = localStorage.getItem(storageKey(dateStr));
  if (raw) {
    populateForm(JSON.parse(raw));
    saveStatus.textContent = "保存済みデータを読み込みました";
    dataSourceNotice.hidden = true;
    return;
  }

  try {
    const res = await fetch(`data/${dateStr}.json`);
    if (res.ok) {
      const data = await res.json();
      populateForm(data);
      saveStatus.textContent = "新規（未保存）";
      dataSourceNotice.hidden = false;
      dataSourceNotice.textContent =
        "AIが下調べした「たたき台」を表示しています。内容を確認・編集して、自分の判断で確定させてください。編集すると自動保存されます。";
      return;
    }
  } catch (e) {
    // データファイルがない場合は無視して空フォームを表示
  }

  populateForm({});
  saveStatus.textContent = "新規（未保存）";
  dataSourceNotice.hidden = true;
}

let saveTimer = null;
function saveCurrentData() {
  dataSourceNotice.hidden = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const dateStr = datePicker.value || todayStr();
    const data = collectFormData();
    localStorage.setItem(storageKey(dateStr), JSON.stringify(data));
    saveStatus.textContent = `保存しました (${new Date().toLocaleTimeString("ja-JP")})`;
  }, 300);
}

const SCORE_LABELS = { "1": "+1", "0": "0", "-1": "-1", "": "未設定" };
const SELECT_LABELS = {
  risk_sentiment: { on: "リスクオン", off: "リスクオフ", neutral: "中立" },
  rate_diff_change: { widen: "拡大", narrow: "縮小", flat: "不変" },
  cb_tone_change: { hawkish: "タカ派寄り", dovish: "ハト派寄り", flat: "不変" },
  surprise_usd: { strong: "強い（上振れ傾向）", weak: "弱い（下振れ傾向）", mixed: "混在" },
  surprise_counter: { strong: "強い（上振れ傾向）", weak: "弱い（下振れ傾向）", mixed: "混在" },
};

function label(field, value) {
  if (!value) return "";
  return (SELECT_LABELS[field] && SELECT_LABELS[field][value]) || value;
}

function buildMarkdown() {
  const data = collectFormData();
  const dateStr = datePicker.value || todayStr();

  let md = `# FXファンダ デイリーチェック\n\n`;
  md += `日付：${dateStr}\n対象ペア：\n\n---\n\n`;

  md += `## 1. ドル全体の流れ（前日〜現在）\n\n`;
  md += `- リスク姿勢：${label("risk_sentiment", data.risk_sentiment)}\n`;
  md += `- メモ：${data.usd_flow_memo || ""}\n\n---\n\n`;

  md += `## 2. 相手通貨側の流れ\n\n`;
  md += `- メモ：${data.counter_flow_memo || ""}\n\n---\n\n`;

  md += `## 3. 金利差の方向性\n\n`;
  md += `- 直近の変化：${label("rate_diff_change", data.rate_diff_change)}\n`;
  md += `- 中銀トーンの変化：${label("cb_tone_change", data.cb_tone_change)}\n`;
  md += `- メモ：${data.rate_diff_memo || ""}\n\n---\n\n`;

  md += `## 4. 経済サプライズの傾向\n\n`;
  md += `- ドル側：${label("surprise_usd", data.surprise_usd)}\n`;
  md += `- 相手通貨側：${label("surprise_counter", data.surprise_counter)}\n`;
  md += `- メモ：${data.surprise_memo || ""}\n\n---\n\n`;

  md += `## 5. 本日のイベント・指標\n\n`;
  md += `| 時間（日本時間） | 指標 / イベント | 予想 | 前回 | 上振れた場合 | 下振れた場合 |\n`;
  md += `|---|---|---|---|---|---|\n`;
  for (const ev of data.events) {
    md += `| ${ev.time || ""} | ${ev.indicator || ""} | ${ev.forecast || ""} | ${ev.previous || ""} | ${ev.up || ""} | ${ev.down || ""} |\n`;
  }
  md += `\n---\n\n`;

  md += `## 通貨強弱マトリクス\n\n`;
  md += `| 通貨 | 金融政策 | 経済データ | リスク相性 | 合計 |\n`;
  md += `|---|---|---|---|---|\n`;
  for (const cur of CURRENCIES) {
    const s = data.strength[cur] || {};
    const total =
      (parseInt(s.policy, 10) || 0) + (parseInt(s.data, 10) || 0) + (parseInt(s.risk, 10) || 0);
    md += `| ${cur} | ${SCORE_LABELS[s.policy] || ""} | ${SCORE_LABELS[s.data] || ""} | ${SCORE_LABELS[s.risk] || ""} | ${total} |\n`;
  }
  md += `\n---\n\n`;

  md += `## 今日のシナリオ\n\n`;
  md += `- バイアス：${data.scenario_bias || ""}\n`;
  md += `- 根拠：${data.scenario_reason || ""}\n`;
  md += `- 崩れる条件：${data.scenario_breakdown || ""}\n`;

  return md;
}

datePicker.addEventListener("change", () => {
  loadDate(datePicker.value);
});

todayBtn.addEventListener("click", () => {
  loadDate(todayStr());
});

addEventRowBtn.addEventListener("click", () => {
  eventsBody.appendChild(createEventRow());
});

form.addEventListener("input", saveCurrentData);
form.addEventListener("change", saveCurrentData);

exportBtn.addEventListener("click", async () => {
  const md = buildMarkdown();
  try {
    await navigator.clipboard.writeText(md);
    saveStatus.textContent = "Markdownをコピーしました";
  } catch (e) {
    saveStatus.textContent = "コピーに失敗しました（手動で選択してください）";
  }
});

loadDate(todayStr());
