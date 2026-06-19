const CURRENCIES = ["USD", "JPY", "EUR", "GBP", "AUD", "NZD", "CAD", "CHF"];

const dateSelect = document.getElementById("date-select");
const todayBtn = document.getElementById("today-btn");
const lastUpdated = document.getElementById("last-updated");
const noDataNotice = document.getElementById("no-data-notice");
const checklistContent = document.getElementById("checklist-content");

const riskSentiment = document.getElementById("risk-sentiment");
const usdFlowMemo = document.getElementById("usd-flow-memo");
const counterFlowMemo = document.getElementById("counter-flow-memo");
const rateDiffChange = document.getElementById("rate-diff-change");
const cbToneChange = document.getElementById("cb-tone-change");
const rateDiffMemo = document.getElementById("rate-diff-memo");
const surpriseUsd = document.getElementById("surprise-usd");
const surpriseCounter = document.getElementById("surprise-counter");
const surpriseMemo = document.getElementById("surprise-memo");
const eventsBody = document.querySelector("#events-table tbody");
const strengthBody = document.querySelector("#strength-matrix tbody");
const strengthSuggestion = document.getElementById("strength-suggestion");
const scenarioBias = document.getElementById("scenario-bias");
const scenarioReason = document.getElementById("scenario-reason");
const scenarioBreakdown = document.getElementById("scenario-breakdown");

const exportBtn = document.getElementById("export-btn");
const actionStatus = document.getElementById("action-status");

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

let currentData = null;
let availableDates = [];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${dateStr}(${WEEKDAYS[d.getDay()]})`;
}

async function loadManifest() {
  try {
    const res = await fetch("data/manifest.json");
    if (res.ok) {
      const dates = await res.json();
      availableDates = [...dates].sort().reverse();
    }
  } catch (e) {
    availableDates = [];
  }

  dateSelect.innerHTML = "";
  for (const d of availableDates) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = formatDateLabel(d);
    dateSelect.appendChild(opt);
  }
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

function renderEventsTable(events = []) {
  eventsBody.innerHTML = "";
  for (const ev of events) {
    const tr = document.createElement("tr");
    for (const f of ["time", "indicator", "forecast", "previous", "up", "down"]) {
      const td = document.createElement("td");
      td.textContent = ev[f] || "";
      tr.appendChild(td);
    }
    eventsBody.appendChild(tr);
  }
}

function renderStrengthMatrix(strength = {}) {
  strengthBody.innerHTML = "";
  for (const cur of CURRENCIES) {
    const entry = strength[cur] || {};
    const tr = document.createElement("tr");

    const tdCur = document.createElement("td");
    tdCur.textContent = cur;
    tr.appendChild(tdCur);

    let total = 0;
    for (const f of ["policy", "data", "risk"]) {
      const td = document.createElement("td");
      td.textContent = SCORE_LABELS[entry[f]] || SCORE_LABELS[""];
      tr.appendChild(td);
      const v = parseInt(entry[f], 10);
      if (!isNaN(v)) total += v;
    }

    const tdTotal = document.createElement("td");
    tdTotal.textContent = total > 0 ? `+${total}` : `${total}`;
    tr.appendChild(tdTotal);

    strengthBody.appendChild(tr);
  }
  updateStrengthSuggestion(strength);
}

function updateStrengthSuggestion(strength = {}) {
  const totals = CURRENCIES.map((cur) => {
    const entry = strength[cur] || {};
    const total = ["policy", "data", "risk"].reduce((sum, f) => {
      const v = parseInt(entry[f], 10);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    return { currency: cur, total };
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

function renderChecklist(data) {
  riskSentiment.textContent = label("risk_sentiment", data.risk_sentiment);
  usdFlowMemo.textContent = data.usd_flow_memo || "";
  counterFlowMemo.textContent = data.counter_flow_memo || "";
  rateDiffChange.textContent = label("rate_diff_change", data.rate_diff_change);
  cbToneChange.textContent = label("cb_tone_change", data.cb_tone_change);
  rateDiffMemo.textContent = data.rate_diff_memo || "";
  surpriseUsd.textContent = label("surprise_usd", data.surprise_usd);
  surpriseCounter.textContent = label("surprise_counter", data.surprise_counter);
  surpriseMemo.textContent = data.surprise_memo || "";
  scenarioBias.textContent = data.scenario_bias || "";
  scenarioReason.textContent = data.scenario_reason || "";
  scenarioBreakdown.textContent = data.scenario_breakdown || "";

  renderEventsTable(data.events || []);
  renderStrengthMatrix(data.strength || {});
}

async function loadDate(dateStr) {
  if (availableDates.includes(dateStr)) {
    dateSelect.value = dateStr;
  }
  actionStatus.textContent = "";

  try {
    const res = await fetch(`data/${dateStr}.json`);
    if (res.ok) {
      const data = await res.json();
      currentData = data;
      checklistContent.hidden = false;
      noDataNotice.hidden = true;
      lastUpdated.hidden = false;
      lastUpdated.textContent = `最終更新：${data.generated_at || dateStr}`;
      renderChecklist(data);
      renderCrossPair(data.cross_pair || null);
      return;
    }
  } catch (e) {
    // データファイルがない場合は下の「データなし」表示にフォールバック
  }

  currentData = null;
  checklistContent.hidden = true;
  noDataNotice.hidden = false;
  lastUpdated.hidden = true;
  renderCrossPair(null);
}

function buildMarkdown() {
  const data = currentData || {};
  const dateStr = dateSelect.value || todayStr();
  const events = data.events || [];
  const strength = data.strength || {};

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
  for (const ev of events) {
    md += `| ${ev.time || ""} | ${ev.indicator || ""} | ${ev.forecast || ""} | ${ev.previous || ""} | ${ev.up || ""} | ${ev.down || ""} |\n`;
  }
  md += `\n---\n\n`;

  md += `## 通貨強弱マトリクス\n\n`;
  md += `| 通貨 | 金融政策 | 経済データ | リスク相性 | 合計 |\n`;
  md += `|---|---|---|---|---|\n`;
  for (const cur of CURRENCIES) {
    const s = strength[cur] || {};
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

dateSelect.addEventListener("change", () => {
  loadDate(dateSelect.value);
});

todayBtn.addEventListener("click", () => {
  loadDate(todayStr());
});

exportBtn.addEventListener("click", async () => {
  const md = buildMarkdown();
  try {
    await navigator.clipboard.writeText(md);
    actionStatus.textContent = "Markdownをコピーしました";
  } catch (e) {
    actionStatus.textContent = "コピーに失敗しました（手動で選択してください）";
  }
});

(async () => {
  await loadManifest();
  loadDate(todayStr());
})();
