// Objectif de course : temps final OU allure. Partagé par index.html et runner.html.
window.Target = (() => {
  const MARATHON_M = 42195;

  // « 3:45 », « 3:45:00 », « 3h45 », « 3h45'30 » (temps) ; « 5:20 », « 5'20 », « 5m20 » (allure)
  function parse(mode, str) {
    const nums = String(str || "").trim().split(/[^0-9]+/).filter(Boolean).map(Number);
    if (!nums.length || nums.some((n) => !isFinite(n))) return null;
    let s;
    if (mode === "time") {
      if (nums.length === 1) s = nums[0] * 3600;                       // « 4 » → 4h
      else if (nums.length === 2) s = nums[0] * 3600 + nums[1] * 60;  // h:mm
      else s = nums[0] * 3600 + nums[1] * 60 + nums[2];                // h:mm:ss
      if (s < 2 * 3600 || s > 8 * 3600) return null;
    } else {
      if (nums.length === 1) s = nums[0] * 60;
      else s = nums[0] * 60 + nums[1];                                  // m:ss par km
      if (s < 150 || s > 720) return null;
    }
    return { mode: mode === "time" ? "time" : "pace", s };
  }

  // Allure en secondes par km (= millisecondes par mètre)
  const paceOf = (t, totalM = MARATHON_M) => t.mode === "time" ? t.s * 1000 / totalM : t.s;
  const timeOf = (t, totalM = MARATHON_M) => t.mode === "time" ? t.s : t.s * totalM / 1000;

  const fmtTime = (s) => {
    s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    return `${h}h${String(m).padStart(2, "0")}` + (ss ? `'${String(ss).padStart(2, "0")}` : "");
  };
  const fmtPace = (s) => { s = Math.round(s); return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}/km`; };

  // Texte complet, ex. « 3h45 · 5'20/km »
  const label = (t, totalM) => `${fmtTime(timeOf(t, totalM))} · ${fmtPace(paceOf(t, totalM))}`;

  const valid = (t) => t && (t.mode === "time" || t.mode === "pace") && isFinite(t.s) && t.s > 0;

  // Objectif par défaut lu dans config.js
  function fromConfig(C) {
    return (C.targetTime && parse("time", C.targetTime)) || (C.targetPace && parse("pace", C.targetPace)) || { mode: "pace", s: 330 };
  }
  return { parse, paceOf, timeOf, fmtTime, fmtPace, label, valid, fromConfig };
})();
