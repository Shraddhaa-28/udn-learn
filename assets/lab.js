/* Step guide for the UDN cluster lab. Checkboxes + copy. No fake apiserver. */
(function () {
  const LABS = window.UDN_LABS;
  const $ = (id) => document.getElementById(id);
  const storeKey = "udn-cluster-guide-v1";
  const saved = JSON.parse(localStorage.getItem(storeKey) || "{}");
  const state = {
    i: Math.min(Math.max(0, saved.i || 0), LABS.length - 1),
    done: saved.done || {},
  };

  function persist() {
    localStorage.setItem(storeKey, JSON.stringify(state));
  }

  function stepKey(lab, si) {
    return lab.id + ":" + si;
  }

  function copy(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const old = btn.textContent;
      btn.textContent = "copied";
      setTimeout(() => { btn.textContent = old; }, 900);
    }).catch(() => {});
  }

  function paintNav() {
    const nav = $("task-nav");
    nav.innerHTML = "";
    LABS.forEach((lab, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      const steps = lab.steps.length;
      const got = lab.steps.filter((_, si) => state.done[stepKey(lab, si)]).length;
      if (idx === state.i) b.classList.add("on");
      if (got === steps) b.classList.add("done");
      b.innerHTML = "<em>" + lab.n + "</em>" + lab.title;
      b.addEventListener("click", () => go(idx));
      nav.appendChild(b);
    });
  }

  function paint() {
    const lab = LABS[state.i];
    $("kicker").textContent = lab.kicker;
    $("title").textContent = lab.title;
    $("why").textContent = lab.why;
    const doc = $("doc-line");
    doc.innerHTML = "";
    if (lab.doc) {
      const a = document.createElement("a");
      a.href = lab.doc.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Doc: " + lab.doc.label;
      doc.appendChild(a);
    }
    $("progress-label").textContent = "Lab " + lab.n + " of " + LABS[LABS.length - 1].n;
    $("progress-bar").style.width = ((state.i + 1) / LABS.length) * 100 + "%";
    $("next").textContent = state.i === LABS.length - 1 ? "Home" : "Next lab";

    const root = $("steps");
    root.innerHTML = "";
    lab.steps.forEach((step, si) => {
      const key = stepKey(lab, si);
      const card = document.createElement("article");
      card.className = "step" + (state.done[key] ? " done" : "");
      const head = document.createElement("header");
      const check = document.createElement("button");
      check.type = "button";
      check.className = "tick";
      check.setAttribute("aria-pressed", state.done[key] ? "true" : "false");
      check.textContent = state.done[key] ? "✓" : String(si + 1);
      check.addEventListener("click", () => {
        state.done[key] = !state.done[key];
        persist();
        paint();
      });
      const h = document.createElement("h2");
      h.textContent = step.title;
      head.appendChild(check);
      head.appendChild(h);
      card.appendChild(head);
      if (step.do) {
        const p = document.createElement("p");
        p.className = "do";
        p.textContent = step.do;
        card.appendChild(p);
      }
      const block = step.yaml || step.cmd;
      if (block) {
        const pre = document.createElement("div");
        pre.className = "block";
        const bar = document.createElement("div");
        bar.className = "block-bar";
        bar.innerHTML = "<span>" + (step.yaml ? "apply this" : "run this") + "</span>";
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "tiny";
        copyBtn.textContent = "copy";
        const body = step.yaml ? step.yaml : step.cmd;
        copyBtn.addEventListener("click", () => copy(body, copyBtn));
        bar.appendChild(copyBtn);
        const code = document.createElement("pre");
        code.textContent = body;
        pre.appendChild(bar);
        pre.appendChild(code);
        card.appendChild(pre);
        if (step.yaml) {
          const hint = document.createElement("p");
          hint.className = "apply-hint";
          hint.innerHTML = "oc apply -f -  then paste, then a line that is only <code>EOF</code>.";
          card.appendChild(hint);
        }
      }
      if (step.expect) {
        const ex = document.createElement("p");
        ex.className = "expect";
        ex.textContent = "You should see: " + step.expect;
        card.appendChild(ex);
      }
      root.appendChild(card);
    });
    paintNav();
  }

  function go(i) {
    if (i >= LABS.length) {
      window.location.href = "index.html";
      return;
    }
    state.i = (i + LABS.length) % LABS.length;
    persist();
    paint();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("prev").addEventListener("click", () => go(state.i - 1));
  $("next").addEventListener("click", () => go(state.i + 1));
  paint();
})();
