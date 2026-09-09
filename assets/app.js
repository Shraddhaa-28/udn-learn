/* UDN Lab — visual OpenShift classroom */
(function () {
  const $ = (id) => document.getElementById(id);

  const SESSIONS = [
    { id: "intro", n: "IN", title: "Intro", kicker: "Start here", hint: "Click Start. That is the whole guide." },
    { id: "why", n: "01", title: "Why UDN exists", kicker: "Session 01", hint: "Click two pods. Then Ping below the picture." },
    { id: "islands", n: "02", title: "Isolated networks", kicker: "Session 02", hint: "Click a pod on each island. Then Ping below." },
    { id: "roles", n: "03", title: "Primary vs secondary", kicker: "Session 03", hint: "Primary is eth0 for every pod. Secondary is extra, and only if you ask." },
    { id: "scope", n: "04", title: "UDN vs CUDN", kicker: "Session 04", hint: "Namespace-scoped UDN vs cluster-scoped CUDN. An empty selector matches everything." },
    { id: "topo", n: "05", title: "Layer 2, Layer 3, Localnet", kicker: "Session 05", hint: "Pick a topology. Then Ping below the picture." },
    { id: "lab", n: "06", title: "Create order", kicker: "Session 06", hint: "Label the namespace, create the CR, then create pods. Play the happy path, then the trap." },
    { id: "gotchas", n: "07", title: "DNS, registry, policy", kicker: "Session 07", hint: "DNS still returns default-network IPs. The image registry is often unreachable. Policy cannot bridge islands." },
    { id: "virt", n: "08", title: "Virtual machines", kicker: "Session 08", hint: "Live-migrate a VM on Layer 2. The IP stays. That is the point." },
    { id: "connect", n: "09", title: "Connecting UDNs", kicker: "Session 09", hint: "Ping below first (splash). Build CNC. Ping again." },
    { id: "field", n: "10", title: "Customer scenarios", kicker: "Session 10", hint: "Click pods. Ping below. The result is under the button." },
    { id: "done", n: "★", title: "You did it", kicker: "Curtain call", hint: "Click a lie you will not tell. Then Play. The cluster still will not clap." },
  ];

  const storeKey = "udn-lab-v2";
  const saved = JSON.parse(localStorage.getItem(storeKey) || "{}");
  const state = {
    i: Math.min(Math.max(0, saved.i || 0), SESSIONS.length - 1),
    done: new Set(saved.done || []),
    quizOk: saved.quizOk || {},
  };
  const scene = { selected: [], policy: false, extra: {} };

  const T = {
    lime: "#c9a8ff",
    dim: "#9b7ad4",
    deep: "#6b4aa8",
    ink: "#0c0814",
    ink2: "#16101c",
    ink3: "#1c1424",
    mute: "#a898c0",
    cream: "#eee6f8",
  };

  function persist() {
    localStorage.setItem(storeKey, JSON.stringify({
      i: state.i,
      done: [...state.done],
      quizOk: state.quizOk,
    }));
  }

  function svgEl(name, attrs = {}, kids = []) {
    const n = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      n.setAttribute(k, String(v));
    }
    for (const c of kids) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }

  function log(msg) {
    const out = $("ping-out");
    const verdict = $("ping-verdict");
    const detail = $("ping-detail");
    if (!out || !verdict) return;
    const text = String(msg || "").replace(/\s+/g, " ").trim();
    const fail = /splash|reject|unreachable|no path|fail to|cannot help|melt|wrong cable|wrong mapping|new ip|hates this|still isolated|no cnc|no mapping|network is unreachable|dropped|not accessible|not connected|still an island/i.test(text);
    const ok = /delivered|works|succeed|same island|still \.50|service path|servicenetwork: clusterip|mapping matches|island is up|east-west works|packet rode|same ip|packet went|packet stayed|packet left/i.test(text);
    out.classList.remove("ok", "bad");
    if (fail) {
      out.classList.add("bad");
      verdict.textContent = "NO PATH";
    } else if (ok) {
      out.classList.add("ok");
      verdict.textContent = "OK";
    } else {
      verdict.textContent = "NOTE";
    }
    detail.textContent = text;
  }

  function clearPingOut() {
    const out = $("ping-out");
    const verdict = $("ping-verdict");
    const detail = $("ping-detail");
    if (!out) return;
    out.classList.remove("ok", "bad");
    verdict.textContent = "—";
    detail.textContent = "Select two pods, then Ping.";
  }

  function sessionPing() {
    const id = SESSIONS[state.i].id;
    if (id === "why") return whySend();
    if (id === "islands") return islandPing();
    if (id === "topo") return topoPing();
    if (id === "connect") {
      scene.extra.pingSvc = false;
      scene.extra.pingC = false;
      return connectPing();
    }
    if (id === "field") {
      scene.extra.pingSvc = false;
      return fieldPing();
    }
  }

  function pingSessions() {
    return { why: 1, islands: 1, topo: 1, connect: 1, field: 1 };
  }

  function isPingChip(text) {
    return /ping|send packet/i.test(text || "");
  }

  function ensureGlow(svg) {
    if (svg.querySelector("#pktGlow")) return;
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = svgEl("defs");
      svg.insertBefore(defs, svg.firstChild);
    }
    const f = svgEl("filter", { id: "pktGlow", x: "-70%", y: "-70%", width: "240%", height: "240%" });
    f.appendChild(svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "3.2", result: "b" }));
    const merge = svgEl("feMerge");
    merge.appendChild(svgEl("feMergeNode", { in: "b" }));
    merge.appendChild(svgEl("feMergeNode", { in: "SourceGraphic" }));
    f.appendChild(merge);
    defs.appendChild(f);
  }

  function canvasBg(svg, top, bot) {
    const defs = svgEl("defs");
    const id = "g" + Math.random().toString(36).slice(2, 7);
    const lg = svgEl("linearGradient", { id, x1: "0", y1: "0", x2: "0", y2: "1" });
    lg.appendChild(svgEl("stop", { offset: "0%", "stop-color": top }));
    lg.appendChild(svgEl("stop", { offset: "100%", "stop-color": bot }));
    defs.appendChild(lg);
    svg.appendChild(defs);
    svg.appendChild(svgEl("rect", { width: 900, height: 520, fill: `url(#${id})` }));
    ensureGlow(svg);
  }

  function fly(svg, a, b, opts = {}) {
    ensureGlow(svg);
    const color = opts.color || "#c9a8ff";
    const dur = opts.dur || 900;
    const failAt = opts.failAt;
    const c = svgEl("circle", { class: "pkt", r: 6.5, cx: a.x, cy: a.y, fill: color, filter: "url(#pktGlow)" });
    svg.appendChild(c);
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = (now) => {
        let p = Math.min(1, (now - t0) / dur);
        p = p * (2 - p);
        if (failAt != null && p >= failAt) {
          c.setAttribute("fill", "#9b7ad4");
          const x = a.x + (b.x - a.x) * failAt;
          const y = a.y + (b.y - a.y) * failAt;
          c.setAttribute("cx", x);
          c.setAttribute("cy", y);
          const splash = svgEl("circle", { cx: x, cy: y, r: 8, fill: "none", stroke: "#9b7ad4", "stroke-width": 3 });
          svg.appendChild(splash);
          let r = 8;
          const s0 = performance.now();
          const boom = (t) => {
            const q = (t - s0) / 280;
            r = 8 + q * 22;
            splash.setAttribute("r", r);
            splash.setAttribute("opacity", String(1 - q));
            c.setAttribute("opacity", String(1 - q));
            if (q < 1) requestAnimationFrame(boom);
            else { splash.remove(); c.remove(); resolve("fail"); }
          };
          requestAnimationFrame(boom);
          return;
        }
        c.setAttribute("cx", a.x + (b.x - a.x) * p);
        c.setAttribute("cy", a.y + (b.y - a.y) * p);
        if (p < 1) requestAnimationFrame(tick);
        else {
          c.remove();
          resolve("ok");
        }
      };
      requestAnimationFrame(tick);
    });
  }

  function podBox(x, y, name, color, id) {
    const g = svgEl("g", { class: "pod", "data-id": id, transform: `translate(${x},${y})` });
    const bob = svgEl("g", { class: "pod-bob" });
    bob.appendChild(svgEl("ellipse", { cx: 0, cy: 18, rx: 26, ry: 6, fill: "#000", opacity: 0.28 }));
    bob.appendChild(svgEl("rect", { class: "pod-body", x: -30, y: -24, width: 60, height: 42, rx: 12, fill: color, stroke: "rgba(255,255,255,0.22)", "stroke-width": 1.4 }));
    bob.appendChild(svgEl("rect", { x: -24, y: -18, width: 48, height: 10, rx: 5, fill: "#fff", opacity: 0.16 }));
    bob.appendChild(svgEl("circle", { cx: -16, cy: 2, r: 3.2, fill: "#0a0e14", opacity: 0.35 }));
    bob.appendChild(svgEl("circle", { cx: -16, cy: 2, r: 1.6, fill: "#d8fff0" }));
    bob.appendChild(svgEl("text", { x: 0, y: 36, "text-anchor": "middle", fill: "#c5d0de", "font-size": 11, "font-family": "Red Hat Mono, monospace" }, [name]));
    g.appendChild(bob);
    return g;
  }

  function label(x, y, text, color = "#a898c0", size = 12) {
    return svgEl("text", { x, y, fill: color, "font-size": size, "font-family": "Red Hat Text, sans-serif" }, [text]);
  }

  function shakeStage() {
    const st = $("stage");
    st.classList.remove("shake");
    void st.offsetWidth;
    st.classList.add("shake");
  }

  function stamp(svg, x, y, text, color) {
    const g = svgEl("g", { class: "stamp-svg", transform: `translate(${x},${y}) rotate(-12)` });
    const w = Math.max(120, text.length * 11);
    g.appendChild(svgEl("rect", { x: -w / 2, y: -20, width: w, height: 40, rx: 4, fill: "none", stroke: color, "stroke-width": 3 }));
    g.appendChild(svgEl("text", { x: 0, y: 8, "text-anchor": "middle", fill: color, "font-size": 15, "font-family": "Red Hat Display, sans-serif" }, [text]));
    svg.appendChild(g);
  }

  function markSelected(nodes) {
    nodes.forEach((n) => {
      const body = n.querySelector(".pod-body");
      if (!body) return;
      body.setAttribute("stroke", scene.selected.includes(n.dataset.id) ? "#c9a8ff" : "rgba(255,255,255,0.22)");
      body.setAttribute("stroke-width", scene.selected.includes(n.dataset.id) ? 2.6 : 1.4);
    });
  }

  function bindPodPick(p, nodes, msg) {
    p.addEventListener("click", () => {
      const id = p.dataset.id;
      if (scene.selected.includes(id)) scene.selected = scene.selected.filter((x) => x !== id);
      else {
        if (scene.selected.length === 2) scene.selected.shift();
        scene.selected.push(id);
      }
      markSelected(nodes);
      log(scene.selected.length < 2 ? (msg || "Pick a second pod.") : "Ping them.");
    });
  }

  /* ---------- scenes ---------- */
  function sceneIntro(root) {
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    svg.appendChild(label(40, 70, "UDN Classroom", T.lime, 42));
    svg.appendChild(label(40, 112, "OpenShift User Defined Networks. Click the cards. Then click the pictures.", T.mute, 16));

    const bits = [
      { x: 40, t: "Diagram", d: "Click it.", go: () => { log("That's this picture. Sessions are the pills on top. Start 01."); go(1); } },
      { x: 320, t: "Play", d: "Fake oc. Try it.", go: () => { log("Play types fake oc for whatever session you are on."); playDemo(); } },
      { x: 600, t: "Ask a doubt", d: "Bottom right.", go: () => { $("doubt-toggle").click(); log("Ask with product words: Layer2, hostSubnet, Localnet, CUDN."); } },
    ];
    bits.forEach((b) => {
      const r = svgEl("rect", { class: "clickable", x: b.x, y: 170, width: 250, height: 110, rx: 16, fill: "#1a1422", stroke: "rgba(201,168,255,0.45)", "stroke-width": 1.5 });
      r.addEventListener("click", b.go);
      svg.appendChild(r);
      svg.appendChild(label(b.x + 22, 218, b.t, T.lime, 20));
      svg.appendChild(label(b.x + 22, 250, b.d, T.cream, 15));
    });
    svg.appendChild(label(40, 360, "That is the guide. Click a card — or Start session 01.", T.cream, 18));
    svg.appendChild(label(40, 400, "Session 10 is a toy cluster you can ping. The rest is pictures until then.", T.mute, 14));
    root.appendChild(svg);
  }

  function sceneDone(root) {
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#12081c", "#0c0814");
    scene.extra.svg = svg;
    svg.appendChild(svgEl("rect", { x: 0, y: 0, width: 70, height: 520, fill: "#2a1848" }));
    svg.appendChild(svgEl("rect", { x: 830, y: 0, width: 70, height: 520, fill: "#2a1848" }));
    svg.appendChild(label(90, 48, "THIS IS NOT A RED HAT CERT", T.mute, 12));
    svg.appendChild(label(90, 96, "GRADUATED ANYWAY", T.lime, 36));
    svg.appendChild(label(90, 132, "Click a sentence you will never say on a customer call.", T.mute, 14));

    const lies = scene.extra.lies || {};
    const cards = [
      { id: "reg", x: 90, y: 160, a: "Yes, the in-cluster registry", b: "works from a UDN. Trust me.", zap: "It does not. You just volunteered for an S2I ticket at 2am." },
      { id: "sel", x: 470, y: 160, a: "Empty selector is fine.", b: "It means none. Relax.", zap: "It means every namespace. Including openshift-*. Sit down." },
      { id: "ln", x: 90, y: 310, a: "We'll make Localnet the", b: "primary NIC. Customers love that.", zap: "Secondary only. The CR will reject you. So will Virt." },
      { id: "np", x: 470, y: 310, a: "NetworkPolicy will connect", b: "the tenants. It's networking.", zap: "Policy filters a road. It does not build one. CNC exists." },
    ];
    cards.forEach((c) => {
      const g = svgEl("g", { class: "clickable" });
      const box = svgEl("rect", { x: c.x, y: c.y, width: 340, height: 120, rx: 12, fill: lies[c.id] ? "#2a1614" : "#1a1422", stroke: lies[c.id] ? "#9b7ad4" : "rgba(201,168,255,0.35)", "stroke-width": 2 });
      g.appendChild(box);
      g.appendChild(label(c.x + 16, c.y + 42, c.a, T.cream, 15));
      g.appendChild(label(c.x + 16, c.y + 64, c.b, T.cream, 15));
      g.appendChild(label(c.x + 16, c.y + 96, lies[c.id] ? "struck from the script" : "click to refuse", lies[c.id] ? "#9b7ad4" : T.mute, 12));
      g.addEventListener("click", () => {
        scene.extra.lies = Object.assign({}, scene.extra.lies, { [c.id]: true });
        paint();
        log(c.zap);
      });
      svg.appendChild(g);
      if (lies[c.id]) stamp(svg, c.x + 250, c.y + 38, "NOPE", "#9b7ad4");
    });
    svg.appendChild(label(90, 470, "Four refusals. That is the whole diploma. Play if you need applause from a cartoon.", T.mute, 13));
    svg.appendChild(label(90, 496, "The cluster has not noticed. Take the call anyway.", T.mute, 13));
    root.appendChild(svg);
    state.done.add("done");
    persist();
  }

  function sceneWhy(root) {
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    svg.appendChild(label(40, 38, "Default cluster network — one shared Layer-3 hallway", "#8b98ab", 14));

    svg.appendChild(svgEl("rect", { x: 36, y: 72, width: 828, height: 268, rx: 20, fill: "#1c2430", stroke: "rgba(255,255,255,0.06)" }));
    svg.appendChild(svgEl("rect", { x: 36, y: 72, width: 828, height: 52, rx: 20, fill: "#151b24" }));
    svg.appendChild(svgEl("rect", { x: 36, y: 108, width: 828, height: 16, fill: "#151b24" }));
    svg.appendChild(label(56, 104, "THE ONLY PRIMARY NETWORK", "#c9a8ff", 12));
    svg.appendChild(svgEl("rect", { x: 70, y: 168, width: 760, height: 88, rx: 8, fill: "#2a3340" }));
    svg.appendChild(svgEl("polygon", { points: "70,256 830,256 800,300 100,300", fill: "#3a4554" }));
    svg.appendChild(svgEl("line", { x1: 70, y1: 256, x2: 830, y2: 256, stroke: "rgba(255,255,255,0.08)", "stroke-width": 2 }));

    const doors = [
      { x: 110, ns: "ns-shop", c: "#c9a8ff" },
      { x: 220, ns: "ns-shop", c: "#c9a8ff" },
      { x: 360, ns: "ns-bank", c: "#9b7ad4" },
      { x: 470, ns: "ns-bank", c: "#9b7ad4" },
      { x: 620, ns: "ns-ml", c: "#6b4aa8" },
      { x: 730, ns: "ns-ml", c: "#6b4aa8" },
    ];
    const nodes = [];
    doors.forEach((d, i) => {
      const p = podBox(d.x, 210, `pod-${i + 1}`, d.c, `${d.ns}-${i}`);
      p.dataset.ns = d.ns;
      p.dataset.x = d.x;
      p.dataset.y = 210;
      p.addEventListener("click", () => {
        const id = p.dataset.id;
        if (scene.selected.includes(id)) scene.selected = scene.selected.filter((x) => x !== id);
        else {
          if (scene.selected.length === 2) scene.selected.shift();
          scene.selected.push(id);
        }
        nodes.forEach((n) => n.querySelector(".pod-body").setAttribute("stroke", scene.selected.includes(n.dataset.id) ? "#c9a8ff" : "rgba(255,255,255,0.22)"));
        log(scene.selected.length < 2 ? "Select a second door." : "Ready. Send a packet down the hallway.");
      });
      svg.appendChild(p);
      nodes.push(p);
    });

    svg.appendChild(label(90, 328, "shop tenant", "#c9a8ff"));
    svg.appendChild(label(390, 328, "bank tenant", "#9b7ad4"));
    svg.appendChild(label(640, 328, "ml tenant", "#6b4aa8"));
    svg.appendChild(label(40, 392, "NetworkPolicy is a lock on doors. It is not a second hallway.", "#8b98ab"));
    svg.appendChild(label(40, 416, "Click two pods. Then use Send packet. Toggle policy to bounce cross-tenant traffic.", "#8b98ab"));

    const policyFlag = svgEl("text", { x: 640, y: 36, fill: "#9b7ad4", "font-size": 14, "font-family": "Red Hat Mono, monospace" }, [""]);
    svg.appendChild(policyFlag);

    root.appendChild(svg);
    scene.extra.nodes = nodes;
    scene.extra.svg = svg;
    scene.extra.policyFlag = policyFlag;
    scene.policy = false;
    scene.selected = [];
  }

  async function whySend() {
    const nodes = scene.extra.nodes || [];
    if (scene.selected.length < 2) {
      log("Click two pods first.");
      return;
    }
    const a = nodes.find((n) => n.dataset.id === scene.selected[0]);
    const b = nodes.find((n) => n.dataset.id === scene.selected[1]);
    const same = a.dataset.ns === b.dataset.ns;
    const blocked = scene.policy && !same;
    const res = await fly(scene.extra.svg, { x: +a.dataset.x, y: +a.dataset.y }, { x: +b.dataset.x, y: +b.dataset.y }, { failAt: blocked ? 0.55 : null, color: blocked ? "#9b7ad4" : "#c9a8ff" });
    if (res === "fail") log("NetworkPolicy dropped it. Same hallway, different tenant, lock on the door.\nStill one network. The packet had a path — a rule said no.");
    else log("Delivered. Same hallway. Any pod IP can reach any other pod IP unless a policy stops it.\nThat is Kubernetes by design — and the limit UDN was built to escape.");
  }

  function sceneIslands(root) {
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    for (let i = 0; i < 8; i++) {
      svg.appendChild(svgEl("path", { class: "wave", d: `M0 ${70 + i * 55} Q 225 ${58 + i * 55}, 450 ${70 + i * 55} T 900 ${70 + i * 55}`, fill: "none", stroke: "rgba(201,168,255,0.14)", "stroke-width": 2 }));
    }

    function island(x, y, w, h, color, title, cidr) {
      const g = svgEl("g");
      g.appendChild(svgEl("ellipse", { cx: x + w / 2, cy: y + h - 4, rx: w / 2 + 22, ry: 26, fill: "#071820", opacity: 0.55 }));
      g.appendChild(svgEl("rect", { x, y, width: w, height: h, rx: 28, fill: "#182634", stroke: color, "stroke-width": 2.5 }));
      g.appendChild(svgEl("rect", { x: x + 14, y: y + 12, width: w - 28, height: 18, rx: 9, fill: color, opacity: 0.12 }));
      g.appendChild(label(x + 18, y + 28, title, color, 16));
      g.appendChild(label(x + 18, y + 48, cidr, "#a898c0", 12));
      svg.appendChild(g);
    }
    island(40, 80, 300, 280, T.lime, "ISLAND A  shop", "10.100.0.0/16");
    island(560, 80, 300, 280, T.dim, "ISLAND B  bank", "10.100.0.0/16");
    island(300, 400, 300, 96, T.deep, "MAINLAND  default network", "cluster CIDR");

    const pods = [
      { x: 110, y: 180, c: "#c9a8ff", id: "b1", island: "blue", name: "shop-web" },
      { x: 220, y: 180, c: "#c9a8ff", id: "b2", island: "blue", name: "shop-api" },
      { x: 165, y: 270, c: "#c9a8ff", id: "b3", island: "blue", name: "shop-db" },
      { x: 640, y: 180, c: "#9b7ad4", id: "r1", island: "red", name: "bank-web" },
      { x: 750, y: 180, c: "#9b7ad4", id: "r2", island: "red", name: "bank-api" },
      { x: 695, y: 270, c: "#9b7ad4", id: "r3", island: "red", name: "pay" },
      { x: 360, y: 448, c: "#9b7ad4", id: "m1", island: "main", name: "api/dns" },
      { x: 540, y: 448, c: "#9b7ad4", id: "m2", island: "main", name: "registry" },
    ];
    const nodes = [];
    pods.forEach((d) => {
      const p = podBox(d.x, d.y, d.name, d.c, d.id);
      p.dataset.island = d.island;
      p.dataset.x = d.x;
      p.dataset.y = d.y;
      p.addEventListener("click", () => {
        if (scene.selected.includes(d.id)) scene.selected = scene.selected.filter((x) => x !== d.id);
        else {
          if (scene.selected.length === 2) scene.selected.shift();
          scene.selected.push(d.id);
        }
        nodes.forEach((n) => {
          n.querySelector(".pod-body").setAttribute("stroke", scene.selected.includes(n.dataset.id) ? "#c9a8ff" : "rgba(255,255,255,0.22)");
          n.querySelector(".pod-body").setAttribute("stroke-width", scene.selected.includes(n.dataset.id) ? 2.6 : 1.4);
        });
        log(scene.selected.length < 2 ? `Selected ${d.name}. Pick a destination.` : "Ping them.");
      });
      svg.appendChild(p);
      nodes.push(p);
    });

    svg.appendChild(label(390, 250, "NO BRIDGE", "#9b7ad4", 13));
    svg.appendChild(svgEl("path", { class: "flow-line", d: "M340 220 C 430 180, 470 180, 560 220", fill: "none", stroke: "#9b7ad4", "stroke-width": 2 }));

    root.appendChild(svg);
    scene.extra.svg = svg;
    scene.extra.nodes = nodes;
    scene.selected = [];
  }

  async function islandPing() {
    const nodes = scene.extra.nodes || [];
    if (scene.selected.length < 2) { log("Click two pods first."); return; }
    const a = nodes.find((n) => n.dataset.id === scene.selected[0]);
    const b = nodes.find((n) => n.dataset.id === scene.selected[1]);
    const same = a.dataset.island === b.dataset.island;
    const res = await fly(scene.extra.svg, { x: +a.dataset.x, y: +a.dataset.y }, { x: +b.dataset.x, y: +b.dataset.y }, {
      failAt: same ? null : 0.5,
      color: same ? "#c9a8ff" : "#c9a8ff",
      dur: 1100,
    });
    if (res === "fail") log("Splash. There is no path.\nSame CIDR on both islands is fine — they are still different networks.\nNetworkPolicy cannot help. You cannot firewall a road that does not exist.");
    else if (a.dataset.island === "main") log("Mainland services still exist. Islands are isolated from each other, not exiled from the platform.\n(The ugly DNS/registry details are Session 07.)");
    else log("Delivered. Same island. East-west just works.\nMicrosegmentation with NetworkPolicy happens inside this island, not across the water.");
  }

  function sceneRoles(root) {
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    const attached = !!scene.extra.secondary;

    svg.appendChild(label(40, 40, "One pod. How many networks?", "#a898c0", 14));
    // pod chassis
    svg.appendChild(svgEl("rect", { class: "clickable", x: 300, y: 120, width: 300, height: 260, rx: 18, fill: "#1f2a38", stroke: "#c9a8ff", "stroke-width": 3 }));
    svg.appendChild(svgEl("text", { x: 450, y: 160, "text-anchor": "middle", fill: "#e8edf4", "font-size": 18, "font-family": "Red Hat Display, sans-serif" }, ["POD / VM"]));
    svg.appendChild(svgEl("text", { x: 450, y: 182, "text-anchor": "middle", fill: "#a898c0", "font-size": 12, "font-family": "Red Hat Text, sans-serif" }, ["click me · namespace: ns-shop"]));
    // eth0
    svg.appendChild(svgEl("rect", { x: 250, y: 230, width: 90, height: 36, rx: 6, fill: "#c9a8ff" }));
    svg.appendChild(label(258, 253, "eth0 PRIM", "#fff", 12));
    svg.appendChild(svgEl("line", { x1: 80, y1: 248, x2: 250, y2: 248, stroke: "#c9a8ff", "stroke-width": 6 }));
    svg.appendChild(svgEl("rect", { x: 40, y: 200, width: 160, height: 96, rx: 10, fill: "#2a1620", stroke: "#c9a8ff" }));
    svg.appendChild(label(50, 228, "PRIMARY UDN", "#c9a8ff", 13));
    svg.appendChild(label(50, 250, "automatic", "#c9d4e3", 12));
    svg.appendChild(label(50, 270, "every pod in ns", "#c9d4e3", 12));
    svg.appendChild(label(50, 290, "one per namespace", "#c9d4e3", 12));

    if (attached) {
      svg.appendChild(svgEl("rect", { x: 560, y: 230, width: 90, height: 36, rx: 6, fill: "#c9a8ff" }));
      svg.appendChild(label(568, 253, "eth1 SEC", "#0c1016", 12));
      svg.appendChild(svgEl("line", { x1: 650, y1: 248, x2: 820, y2: 248, stroke: "#c9a8ff", "stroke-width": 6 }));
      svg.appendChild(svgEl("rect", { x: 700, y: 200, width: 170, height: 110, rx: 10, fill: "#1a1028", stroke: "#c9a8ff" }));
      svg.appendChild(label(712, 228, "SECONDARY UDN", "#c9a8ff", 13));
      svg.appendChild(label(712, 250, "opt-in annotation", "#c9d4e3", 12));
      svg.appendChild(label(712, 270, "k8s.v1.cni.cncf.io", "#c9d4e3", 11));
      svg.appendChild(label(712, 290, "/networks", "#c9d4e3", 11));
    } else {
      svg.appendChild(label(580, 250, "no extra NIC yet", "#a898c0", 13));
    }
    svg.appendChild(label(40, 430, "Primary is the front door. Secondary is a side dock you ask for.", "#a898c0"));
    svg.appendChild(label(40, 454, "Click the pod (or Attach eth1). A namespace may have many secondaries. Only one primary.", "#a898c0"));
    svg.querySelector("rect.clickable").addEventListener("click", () => {
      scene.extra.secondary = !scene.extra.secondary;
      paint();
      log(scene.extra.secondary
        ? "eth1 attached. Only pods with k8s.v1.cni.cncf.io/networks get a secondary."
        : "eth1 gone. Primary is still automatic for every pod in the namespace.");
    });
    root.appendChild(svg);
  }

  function sceneScope(root) {
    const mode = scene.extra.mode || "udn";
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    const nss = [
      { x: 70, y: 160, name: "ns-shop" },
      { x: 250, y: 160, name: "ns-shop-api" },
      { x: 500, y: 160, name: "ns-bank" },
      { x: 680, y: 160, name: "ns-pay" },
    ];
    if (mode === "udn") {
      svg.appendChild(label(40, 40, "UserDefinedNetwork — namespace scoped", "#c9a8ff", 16));
      svg.appendChild(label(40, 64, "Each project owns its island. Click a dashed box. Developer territory.", "#a898c0", 13));
      nss.forEach((ns, i) => {
        const c = i < 2 ? "#c9a8ff" : "#9b7ad4";
        const box = svgEl("rect", { class: "clickable", x: ns.x - 10, y: ns.y - 40, width: 150, height: 200, rx: 14, fill: "none", stroke: c, "stroke-width": 2, "stroke-dasharray": "7 5" });
        box.addEventListener("click", () => log(ns.name + " has its own UDN. A developer with edit in that namespace can create it. It does not span the cluster."));
        svg.appendChild(box);
        svg.appendChild(label(ns.x, ns.y - 18, "UDN " + (i + 1), c, 12));
        svg.appendChild(podBox(ns.x + 60, ns.y + 50, ns.name, c, ns.name));
      });
    } else if (mode === "empty") {
      svg.appendChild(label(40, 40, "Empty CUDN selector — you selected the whole cluster", "#9b7ad4", 16));
      svg.appendChild(label(40, 64, "matchLabels empty, or {}. That includes default and openshift-*. Don't.", "#a898c0", 13));
      svg.appendChild(svgEl("rect", { x: 40, y: 90, width: 820, height: 300, rx: 18, fill: "#2a1614", stroke: "#9b7ad4", "stroke-width": 3 }));
      svg.appendChild(label(56, 118, "CUDN  ·  namespaceSelector: {}", "#9b7ad4", 14));
      [["default", 140], ["openshift-dns", 300], ["openshift-ingress", 480], ["ns-shop", 660]].forEach(([name, x]) => {
        svg.appendChild(podBox(x, 230, name, "#9b7ad4", name));
      });
      stamp(svg, 720, 140, "ALL NAMESPACES", "#9b7ad4");
      shakeStage();
      svg.appendChild(label(80, 350, "Platform namespaces are now on a tenant network. This is how you break a cluster.", "#e8edf4", 14));
    } else {
      svg.appendChild(label(40, 40, "ClusterUserDefinedNetwork — cluster scoped", "#9b7ad4", 16));
      svg.appendChild(label(40, 64, "Admin stretches one network across namespaces with a label selector. Click a CUDN.", "#a898c0", 13));
      const shop = svgEl("rect", { class: "clickable", x: 40, y: 100, width: 400, height: 280, rx: 18, fill: "#182230", stroke: "#c9a8ff", "stroke-width": 3 });
      shop.addEventListener("click", () => log("CUDN shop-net. Selector team=shop. shop and shop-api share this island. They cannot reach bank."));
      svg.appendChild(shop);
      svg.appendChild(label(56, 128, "CUDN shop-net  ·  label: team=shop", "#c9a8ff", 14));
      const bank = svgEl("rect", { class: "clickable", x: 460, y: 100, width: 400, height: 280, rx: 18, fill: "#231818", stroke: "#9b7ad4", "stroke-width": 3 });
      bank.addEventListener("click", () => log("CUDN bank-net. Different selector = different island. Isolation is default."));
      svg.appendChild(bank);
      svg.appendChild(label(476, 128, "CUDN bank-net  ·  label: team=bank", "#9b7ad4", 14));
      svg.appendChild(podBox(140, 230, "ns-shop", "#c9a8ff", "a"));
      svg.appendChild(podBox(300, 230, "ns-shop-api", "#c9a8ff", "b"));
      svg.appendChild(podBox(560, 230, "ns-bank", "#9b7ad4", "c"));
      svg.appendChild(podBox(740, 230, "ns-pay", "#9b7ad4", "d"));
      svg.appendChild(label(80, 360, "Pods in shop + shop-api talk. They cannot reach bank.", "#a898c0"));
    }
    svg.appendChild(label(40, 480, "Never select default or openshift-* . Empty selector = all namespaces = you just melted isolation.", "#9b7ad4", 12));
    root.appendChild(svg);
  }

  function sceneTopo(root) {
    const t = scene.extra.topo || "l3";
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    scene.extra.svg = svg;

    function machine(x, title) {
      svg.appendChild(svgEl("rect", { x, y: 88, width: 250, height: 280, rx: 14, fill: "#1a1422", stroke: "rgba(201,168,255,0.18)", "stroke-width": 1.5 }));
      svg.appendChild(label(x + 16, 114, title, T.mute, 13));
    }

    if (t === "l3") {
      svg.appendChild(label(40, 36, "Layer 3 = each node is a different street", T.lime, 20));
      svg.appendChild(label(40, 60, "Pods on worker-a get 10.100.1.x. Pods on worker-b get 10.100.2.x. They talk through a router.", T.mute, 13));
      machine(70, "worker-a");
      machine(580, "worker-b");
      svg.appendChild(svgEl("rect", { x: 100, y: 150, width: 190, height: 56, rx: 8, fill: "#241a32", stroke: T.lime }));
      svg.appendChild(label(112, 174, "this node's slice", T.mute, 11));
      svg.appendChild(label(112, 194, "10.100.1.0/24", T.lime, 14));
      svg.appendChild(svgEl("rect", { x: 610, y: 150, width: 190, height: 56, rx: 8, fill: "#241a32", stroke: T.lime }));
      svg.appendChild(label(622, 174, "this node's slice", T.mute, 11));
      svg.appendChild(label(622, 194, "10.100.2.0/24", T.lime, 14));
      svg.appendChild(podBox(195, 270, "pod .1.12", T.lime, "p1"));
      svg.appendChild(podBox(705, 270, "pod .2.40", T.lime, "p2"));
      svg.appendChild(svgEl("rect", { x: 370, y: 248, width: 160, height: 52, rx: 10, fill: "#140e1c", stroke: T.lime, "stroke-width": 2 }));
      svg.appendChild(label(390, 270, "router", T.lime, 14));
      svg.appendChild(label(390, 288, "needed to talk", T.mute, 11));
      svg.appendChild(svgEl("line", { x1: 250, y1: 270, x2: 370, y2: 274, stroke: T.lime, "stroke-width": 3 }));
      svg.appendChild(svgEl("line", { x1: 530, y1: 274, x2: 650, y2: 270, stroke: T.lime, "stroke-width": 3 }));
      svg.appendChild(label(40, 400, "If a VM moved from worker-a to worker-b, it would need a new IP (.2.x).", T.cream, 14));
      svg.appendChild(label(40, 424, "That is why live migration is a poor fit for Layer 3. Pick this for pods.", T.mute, 13));
      svg.appendChild(label(40, 456, "Click Ping — the packet goes through the router, not a shared switch.", T.mute, 13));
      scene.extra.pingFrom = { x: 195, y: 270 };
      scene.extra.pingTo = { x: 705, y: 270 };
      scene.extra.pingVia = { x: 450, y: 274 };
    } else if (t === "l2") {
      svg.appendChild(label(40, 36, "Layer 2 = one switch spanning every node", T.lime, 20));
      svg.appendChild(label(40, 60, "Everyone is on 192.168.100.x. Same street, same broadcast domain, same switch.", T.mute, 13));
      machine(70, "worker-a");
      machine(580, "worker-b");
      svg.appendChild(svgEl("rect", { x: 70, y: 330, width: 760, height: 36, rx: 8, fill: "#241a32", stroke: T.lime, "stroke-width": 2 }));
      svg.appendChild(label(250, 353, "one virtual switch   ·   192.168.100.0/24", T.lime, 14));
      svg.appendChild(podBox(155, 165, "pod .12", T.dim, "p1"));
      svg.appendChild(podBox(665, 165, "pod .80", T.dim, "p2"));
      svg.appendChild(svgEl("line", { x1: 155, y1: 187, x2: 155, y2: 330, stroke: T.dim, "stroke-width": 2 }));
      svg.appendChild(svgEl("line", { x1: 665, y1: 187, x2: 665, y2: 330, stroke: T.dim, "stroke-width": 2 }));
      const moved = !!scene.extra.moved;
      const vmx = moved ? 720 : 210;
      svg.appendChild(podBox(vmx, 248, "VM .50", T.lime, "vm"));
      svg.appendChild(svgEl("line", { x1: vmx, y1: 270, x2: vmx, y2: 330, stroke: T.lime, "stroke-width": 3 }));
      if (moved) {
        svg.appendChild(svgEl("path", { class: "flow-line", d: "M210 248 C 360 120, 520 120, 690 240", fill: "none", stroke: T.dim, "stroke-width": 2 }));
        svg.appendChild(label(40, 400, "The VM moved to worker-b. Address is still 192.168.100.50. MAC is the same.", T.cream, 14));
        svg.appendChild(label(40, 424, "It never left the switch — only the node under it changed. That is live migration.", T.mute, 13));
      } else {
        svg.appendChild(label(40, 400, "Click Live-migrate VM. The VM changes node and keeps .50. Then Ping — same subnet, no router.", T.cream, 14));
        svg.appendChild(label(40, 424, "Pick Layer 2 when VMs must move without getting a new address.", T.mute, 13));
      }
      svg.appendChild(label(40, 456, "Trade-off: the broadcast domain is the whole cluster, so this does not scale like Layer 3.", T.mute, 13));
      scene.extra.pingFrom = { x: 155, y: 165 };
      scene.extra.pingTo = { x: 665, y: 165 };
      scene.extra.pingVia = { x: 450, y: 348 };
    } else {
      svg.appendChild(label(40, 36, "Localnet = plug into a real datacenter VLAN", T.lime, 20));
      svg.appendChild(label(40, 60, "This is not an OVN overlay island. The NIC is bridged onto a physical VLAN on the node.", T.mute, 13));
      machine(70, "OpenShift node");
      svg.appendChild(podBox(195, 200, "VM eth1", T.lime, "v"));
      svg.appendChild(label(120, 248, "secondary NIC only", T.mute, 12));
      svg.appendChild(svgEl("line", { x1: 195, y1: 222, x2: 195, y2: 360, stroke: T.lime, "stroke-width": 4 }));
      svg.appendChild(svgEl("rect", { x: 70, y: 360, width: 760, height: 52, rx: 10, fill: "#241a32", stroke: T.dim, "stroke-width": 2 }));
      svg.appendChild(label(90, 382, "physical VLAN 20", T.lime, 14));
      svg.appendChild(label(90, 402, "OVS bridge mapping  ·  physicalNetworkName must match", T.mute, 12));
      svg.appendChild(svgEl("rect", { x: 580, y: 140, width: 250, height: 160, rx: 14, fill: "#1a1422", stroke: "rgba(201,168,255,0.18)" }));
      svg.appendChild(label(598, 168, "outside the cluster", T.mute, 12));
      svg.appendChild(podBox(705, 230, "bare metal", T.dim, "b"));
      svg.appendChild(svgEl("line", { x1: 705, y1: 252, x2: 705, y2: 360, stroke: T.dim, "stroke-width": 4 }));
      svg.appendChild(label(40, 440, "Use this when a VM must talk to something already on that VLAN — not as a primary UDN.", T.cream, 14));
      svg.appendChild(label(40, 464, "Role is Secondary only. Wrong physicalNetworkName = you bridged the wrong cable.", T.mute, 13));
      scene.extra.pingFrom = { x: 195, y: 200 };
      scene.extra.pingTo = { x: 705, y: 230 };
      scene.extra.pingVia = { x: 450, y: 386 };
    }
    root.appendChild(svg);
  }

  async function topoPing() {
    const svg = scene.extra.svg;
    if (!svg || !scene.extra.pingFrom) return;
    const a = scene.extra.pingFrom;
    const b = scene.extra.pingTo;
    const via = scene.extra.pingVia;
    await fly(svg, a, via, { color: T.lime, dur: 500 });
    await fly(svg, via, b, { color: T.lime, dur: 500 });
    const t = scene.extra.topo || "l3";
    if (t === "l3") log("Packet went worker-a → router → worker-b. Different subnets, so a router is required.");
    else if (t === "l2") log("Packet stayed on the same switch. Same subnet on both nodes.");
    else log("Packet left OVN overlay and rode the physical VLAN to the bare-metal host.");
  }

  function sceneLab(root) {
    const step = scene.extra.step || 0;
    const wrong = !!scene.extra.wrong;
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    svg.appendChild(label(40, 40, "Primary UDN has a strict order. The CR is immutable. The label is birth-only.", "#a898c0", 14));

    const steps = [
      { t: "1. Namespace + label", d: "k8s.ovn.org/primary-user-defined-network" },
      { t: "2. Create UserDefinedNetwork", d: "role: Primary · topology · subnets" },
      { t: "3. Create pods", d: "They attach to the UDN as eth0" },
    ];
    steps.forEach((s, i) => {
      const on = step > i;
      const box = svgEl("rect", { class: "clickable", x: 60 + i * 280, y: 90, width: 250, height: 110, rx: 12, fill: on ? "#261a38" : "#1b2430", stroke: on ? "#c9a8ff" : "#2a3544", "stroke-width": 2 });
      box.addEventListener("click", () => {
        scene.extra.wrong = false;
        scene.extra.step = i + 1;
        paint();
        log(["Namespace labeled at create.", "UDN created. OVN minted a NAD.", "Pods attached. IPs are from YOUR subnet."][i]);
      });
      svg.appendChild(box);
      svg.appendChild(label(80 + i * 280, 130, s.t, on ? "#c9a8ff" : "#e8edf4", 15));
      svg.appendChild(label(80 + i * 280, 158, s.d, "#a898c0", 12));
      if (i < 2) svg.appendChild(svgEl("line", { x1: 310 + i * 280, y1: 145, x2: 340 + i * 280, y2: 145, stroke: "#2a3544", "stroke-width": 3 }));
    });

    if (wrong) {
      svg.appendChild(svgEl("rect", { x: 60, y: 250, width: 780, height: 200, rx: 12, fill: "#2a1614", stroke: "#9b7ad4" }));
      svg.appendChild(label(80, 290, "REJECTED", "#9b7ad4", 18));
      svg.appendChild(label(80, 324, "You created pods first, then tried to add a primary UDN.", "#e8edf4", 14));
      svg.appendChild(label(80, 350, "Or you tried to add the label to an existing namespace.", "#e8edf4", 14));
      svg.appendChild(label(80, 384, "The label can only be set at namespace creation. The UDN CR cannot be patched later.", "#a898c0", 13));
      svg.appendChild(label(80, 410, "OVN will not re-home running pods. Click a step box to do it in order.", "#a898c0", 13));
      stamp(svg, 720, 300, "REJECTED", "#9b7ad4");
      shakeStage();
    } else if (step >= 3) {
      svg.appendChild(svgEl("rect", { x: 60, y: 250, width: 780, height: 200, rx: 12, fill: "#1a1430", stroke: "#c9a8ff" }));
      svg.appendChild(label(80, 290, "NetworkReady", "#c9a8ff", 18));
      svg.appendChild(label(80, 324, "Behind the scenes OVN-Kubernetes minted a NetworkAttachmentDefinition.", "#e8edf4", 14));
      svg.appendChild(label(80, 350, "oc get userdefinednetwork,nad -n ns-shop", "#c9a8ff", 13));
      svg.appendChild(label(80, 384, "oc get pod -o wide   →  IPs from YOUR subnet, not 10.128.x", "#c9a8ff", 13));
    } else {
      svg.appendChild(label(60, 300, "Click Next correct step. Or try the trap: create pods first.", "#a898c0"));
    }
    root.appendChild(svg);
  }

  function sceneGotchas(root) {
    const g = scene.extra.gotcha || "dns";
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    svg.appendChild(podBox(160, 240, "udn-pod", "#c9a8ff", "p"));
    svg.appendChild(svgEl("rect", { x: 80, y: 80, width: 200, height: 70, rx: 10, fill: "#1b2836", stroke: "#c9a8ff" }));
    svg.appendChild(label(100, 120, "primary UDN IP  10.100.0.12", "#c9a8ff", 12));

    if (g === "dns") {
      svg.appendChild(label(40, 40, "DNS still answers with the mainland IP", "#9b7ad4", 18));
      svg.appendChild(svgEl("rect", { x: 560, y: 180, width: 260, height: 140, rx: 12, fill: "#2a2414", stroke: "#9b7ad4" }));
      svg.appendChild(label(580, 230, "CoreDNS", "#9b7ad4", 16));
      svg.appendChild(label(580, 258, "shop-api.ns-shop.svc", "#a898c0", 12));
      svg.appendChild(label(580, 286, "A  10.128.2.15", "#9b7ad4", 14));
      fly(svg, { x: 190, y: 240 }, { x: 560, y: 250 }, { color: "#9b7ad4", dur: 800 });
      svg.appendChild(label(40, 430, "Lookups for pods resolve to the default-network IP, not the UDN IP.", "#a898c0"));
      svg.appendChild(label(40, 454, "Service DNS still works. Pod DNS returns the default-network IP.", "#a898c0"));
    } else if (g === "reg") {
      svg.appendChild(label(40, 40, "Image registry lives on the mainland", "#9b7ad4", 18));
      svg.appendChild(svgEl("rect", { x: 560, y: 180, width: 260, height: 140, rx: 12, fill: "#2a1614", stroke: "#9b7ad4" }));
      svg.appendChild(label(580, 240, "image-registry", "#9b7ad4", 16));
      svg.appendChild(label(580, 268, "openshift-image-registry", "#a898c0", 12));
      fly(svg, { x: 190, y: 240 }, { x: 560, y: 250 }, { failAt: 0.55, color: "#9b7ad4", dur: 900 });
      svg.appendChild(label(40, 430, "UDN pods often cannot pull from the in-cluster registry. S2I and oc new-app break.", "#a898c0"));
    } else if (g === "np") {
      svg.appendChild(label(40, 40, "NetworkPolicy cannot bridge two primary UDNs", "#9b7ad4", 18));
      svg.appendChild(podBox(700, 240, "other-udn", "#9b7ad4", "q"));
      svg.appendChild(svgEl("rect", { x: 320, y: 200, width: 240, height: 90, rx: 8, fill: "#2a1614", stroke: "#9b7ad4" }));
      svg.appendChild(label(340, 240, "allow from ns-shop", "#e8edf4", 14));
      svg.appendChild(label(340, 264, "policy exists. path does not.", "#9b7ad4", 13));
      fly(svg, { x: 190, y: 240 }, { x: 700, y: 240 }, { failAt: 0.5, color: "#c9a8ff", dur: 900 });
      svg.appendChild(label(40, 430, "The policy is valid YAML. There is still no path. Use ClusterNetworkConnect.", "#a898c0"));
    } else if (g === "health") {
      svg.appendChild(label(40, 40, "Ready is a mainland opinion", "#9b7ad4", 18));
      svg.appendChild(svgEl("rect", { x: 80, y: 80, width: 200, height: 70, rx: 10, fill: "#2a1614", stroke: "#9b7ad4" }));
      svg.appendChild(label(100, 120, "UDN eth0  DOWN  10.100.0.12", "#9b7ad4", 12));
      svg.appendChild(svgEl("rect", { x: 560, y: 180, width: 260, height: 140, rx: 12, fill: "#1a1430", stroke: "#c9a8ff" }));
      svg.appendChild(label(580, 230, "kubelet", "#c9a8ff", 16));
      svg.appendChild(label(580, 258, "probes default-network IP", "#a898c0", 12));
      svg.appendChild(label(580, 286, "Ready = true  (lying)", "#c9a8ff", 14));
      fly(svg, { x: 560, y: 250 }, { x: 190, y: 240 }, { color: "#c9a8ff", dur: 800 });
      svg.appendChild(label(40, 430, "Health checks do not prove the primary UDN interface works. oc exec -- ip -br addr.", "#a898c0"));
    } else if (g === "nodeport") {
      svg.appendChild(label(40, 40, "NodePort isolation is not guaranteed", "#9b7ad4", 18));
      svg.appendChild(label(80, 140, "same node", "#a898c0", 13));
      svg.appendChild(podBox(160, 200, "udn-pod", "#c9a8ff", "p"));
      svg.appendChild(svgEl("circle", { cx: 280, cy: 200, r: 18, fill: "#2a1620", stroke: "#9b7ad4" }));
      svg.appendChild(label(266, 204, "NP", "#9b7ad4", 11));
      svg.appendChild(label(520, 140, "other node", "#a898c0", 13));
      svg.appendChild(podBox(600, 200, "udn-pod", "#c9a8ff", "q"));
      svg.appendChild(svgEl("circle", { cx: 740, cy: 200, r: 18, fill: "#1a1430", stroke: "#c9a8ff" }));
      svg.appendChild(label(726, 204, "NP", "#c9a8ff", 11));
      fly(svg, { x: 160, y: 200 }, { x: 280, y: 200 }, { failAt: 0.7, color: "#9b7ad4", dur: 700 });
      fly(svg, { x: 600, y: 200 }, { x: 740, y: 200 }, { color: "#c9a8ff", dur: 700 });
      svg.appendChild(label(40, 430, "Docs: same-node NodePort can fail; different-node can succeed. Do not promise isolation.", "#a898c0"));
    }
    root.appendChild(svg);
  }

  function sceneVirt(root) {
    const moved = !!scene.extra.moved;
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    svg.appendChild(label(40, 40, "Layer-2 CUDN — the VM stays on the same switch", "#c9a8ff", 18));
    svg.appendChild(svgEl("rect", { x: 70, y: 90, width: 320, height: 300, rx: 12, fill: "#1b2430", stroke: "#2a3544" }));
    svg.appendChild(label(90, 120, "node-a", "#a898c0"));
    svg.appendChild(svgEl("rect", { x: 510, y: 90, width: 320, height: 300, rx: 12, fill: "#1b2430", stroke: "#2a3544" }));
    svg.appendChild(label(530, 120, "node-b", "#a898c0"));
    svg.appendChild(svgEl("rect", { x: 70, y: 360, width: 760, height: 26, rx: 6, fill: "#2a1c40", stroke: "#c9a8ff" }));
    svg.appendChild(label(300, 378, "L2 UDN switch  ·  192.168.100.0/24", "#c9a8ff", 13));
    const vmx = moved ? 670 : 230;
    const vm = podBox(vmx, 220, "VM  .50", "#c9a8ff", "vm");
    vm.classList.add("clickable");
    vm.addEventListener("click", () => {
      scene.extra.moved = !scene.extra.moved;
      paint();
      log(scene.extra.moved ? "Clicked the VM. Same IP .50. Different node. That is Layer 2." : "VM is back on node-a. Still .50.");
    });
    svg.appendChild(vm);
    if (moved) {
      svg.appendChild(svgEl("path", { class: "flow-line", d: "M230 220 C 400 80, 520 80, 640 200", fill: "none", stroke: "#9b7ad4", "stroke-width": 2 }));
      svg.appendChild(label(40, 450, "Live migration. Same IP. Same MAC. Persistent IPs exist for this reason.", "#a898c0"));
    } else {
      svg.appendChild(label(40, 450, "Click Live migrate. Watch the VM change node without changing network identity.", "#a898c0"));
    }
    root.appendChild(svg);
  }

  function sceneConnect(root) {
    const bridged = scene.extra.bridged || false;
    const kind = scene.extra.conn || "PodNetwork";
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    svg.appendChild(svgEl("rect", { x: 50, y: 90, width: 280, height: 240, rx: 18, fill: "#1b2836", stroke: "#c9a8ff", "stroke-width": 3 }));
    svg.appendChild(label(70, 120, "UDN A", "#c9a8ff", 16));
    svg.appendChild(podBox(190, 200, "pod A", "#c9a8ff", "a"));
    svg.appendChild(svgEl("rect", { x: 570, y: 90, width: 280, height: 240, rx: 18, fill: "#1b2836", stroke: "#9b7ad4", "stroke-width": 3 }));
    svg.appendChild(label(590, 120, "UDN B", "#9b7ad4", 16));
    svg.appendChild(podBox(710, 200, "pod B", "#9b7ad4", "b"));
    svg.appendChild(svgEl("circle", { cx: 710, cy: 280, r: 16, fill: "#2a1620", stroke: "#9b7ad4" }));
    svg.appendChild(label(698, 284, "svc", "#9b7ad4", 11));

    if (scene.extra.triple) {
      svg.appendChild(svgEl("rect", { x: 310, y: 348, width: 280, height: 78, rx: 14, fill: "#1b2836", stroke: "#6b4aa8", "stroke-width": 2 }));
      svg.appendChild(label(330, 372, "UDN C", "#6b4aa8", 14));
      svg.appendChild(podBox(450, 390, "pod C", "#6b4aa8", "c"));
      if (bridged) {
        svg.appendChild(label(360, 140, "A–B connected. B–C connected. A–C is NOT.", "#9b7ad4", 13));
      }
    }

    if (bridged) {
      svg.appendChild(svgEl("rect", { x: 340, y: 170, width: 220, height: 70, rx: 10, fill: "#2a1c40", stroke: "#c9a8ff", "stroke-width": 2 }));
      svg.appendChild(label(360, 200, "ClusterNetworkConnect", "#c9a8ff", 13));
      svg.appendChild(label(360, 222, kind, "#c9d4e3", 12));
      svg.appendChild(svgEl("line", { x1: 330, y1: 205, x2: 340, y2: 205, stroke: "#c9a8ff", "stroke-width": 4 }));
      svg.appendChild(svgEl("line", { x1: 560, y1: 205, x2: 570, y2: 205, stroke: "#c9a8ff", "stroke-width": 4 }));
    } else {
      svg.appendChild(label(400, 210, "water", "#9b7ad4"));
    }
    if (!scene.extra.triple) {
      svg.appendChild(label(40, 400, bridged
        ? (kind === "ServiceNetwork" ? "Service-only: ClusterIP works. Direct pod IP across the bridge does not." : "PodNetwork: pod IPs can talk. Isolation is gone for these two islands only.")
        : "Default: islands are silent. Click Ping. Connectivity is an explicit CR.", "#a898c0", 14));
      svg.appendChild(label(40, 428, "NetworkPolicy still does not select peers on the other side of the connect. Overlapping IPs across a bridge are rejected.", "#a898c0", 13));
    } else {
      svg.appendChild(label(40, 452, "Ping A→C. Splash. Not transitive. Secondary and Localnet cannot be connected.", "#a898c0", 14));
      svg.appendChild(label(40, 476, "Overlapping pod CIDRs cannot be connected either. Each pair needs its own CNC.", "#a898c0", 13));
    }
    root.appendChild(svg);
    scene.extra.svg = svg;
  }

  async function connectPing() {
    const svg = scene.extra.svg;
    const bridged = scene.extra.bridged;
    const kind = scene.extra.conn || "PodNetwork";
    const toSvc = scene.extra.pingSvc;
    if (!bridged) {
      await fly(svg, { x: 190, y: 200 }, { x: 710, y: 200 }, { failAt: 0.5, dur: 1000 });
      log("No ClusterNetworkConnect. Splash.");
      return;
    }
    if (toSvc) {
      await fly(svg, { x: 190, y: 200 }, { x: 710, y: 280 }, { color: "#c9a8ff", dur: 900 });
      log("Service path works when ServiceNetwork (or both) is enabled.");
      return;
    }
    if (kind === "ServiceNetwork") {
      await fly(svg, { x: 190, y: 200 }, { x: 710, y: 200 }, { failAt: 0.55, dur: 900 });
      log("PodNetwork is off. Direct pod IP is still an island. Hit the Service instead.");
    } else if (scene.extra.triple && scene.extra.pingC) {
      await fly(svg, { x: 190, y: 200 }, { x: 450, y: 390 }, { failAt: 0.55, dur: 900 });
      log("A is connected to B. B is connected to C. A is not connected to C. Not transitive. You need another CNC (or one selector that includes all three).");
    } else {
      await fly(svg, { x: 190, y: 200 }, { x: 710, y: 200 }, { color: "#c9a8ff", dur: 900 });
      log("PodNetwork is on. The islands are wired. Isolation is now your policy problem again.");
    }
  }

  function sceneField(root) {
    const pick = scene.extra.story || "tenant";
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    const nodes = [];
    const titles = {
      do: "Your first island — click Apply, then ping",
      tenant: "SaaS tenants — ping across, then detonate the selector",
      vm: "Click the VM. Layer 2 keeps .50. Layer 3 does not.",
      vlan: "Toggle the mapping. Wrong name = wrong cable.",
      talk: "Two apps, one API — ping the pod vs the Service",
    };
    svg.appendChild(label(40, 36, "Toy cluster  ·  click things", "#a898c0", 13));
    svg.appendChild(label(40, 62, titles[pick] || titles.tenant, "#e8edf4", 18));

    function addPod(x, y, name, color, id, meta) {
      const p = podBox(x, y, name, color, id);
      p.dataset.x = x;
      p.dataset.y = y;
      Object.entries(meta || {}).forEach(([k, v]) => { p.dataset[k] = v; });
      bindPodPick(p, nodes, "Pick a destination, then Ping.");
      svg.appendChild(p);
      nodes.push(p);
      return p;
    }

    if (pick === "do") {
      const applied = !!scene.extra.applied;
      const trap = !!scene.extra.trap;
      svg.appendChild(svgEl("rect", { x: 40, y: 88, width: 380, height: 280, rx: 16, fill: "#1c2430", stroke: "rgba(255,255,255,0.1)" }));
      svg.appendChild(label(56, 114, "default hallway", "#a898c0", 13));
      svg.appendChild(svgEl("rect", { class: "clickable", x: 480, y: 88, width: 380, height: 280, rx: 16, fill: applied ? "#1a1430" : "#14101c", stroke: applied ? "#c9a8ff" : "rgba(201,168,255,0.25)", "stroke-dasharray": applied ? undefined : "8 6" }));
      svg.appendChild(label(496, 114, applied ? "UDN island  10.100.0.0/16" : "click to apply Layer3 UDN", "#c9a8ff", 13));
      if (!applied) {
        addPod(140, 220, "10.128.2.14", "#9b7ad4", "h1", { net: "hall" });
        addPod(280, 220, "10.128.3.22", "#9b7ad4", "h2", { net: "hall" });
        svg.querySelector("rect.clickable").addEventListener("click", () => {
          scene.extra.applied = true;
          scene.extra.trap = false;
          paint();
          log("Namespace labeled. UDN applied. Next pod gets 10.100.x. Copy the CR on the left.");
        });
      } else {
        addPod(140, 220, "hallway leftover", "#6b4aa8", "h1", { net: "hall" });
        addPod(670, 220, "10.100.0.12", "#c9a8ff", "u1", { net: "udn" });
        addPod(780, 220, "10.100.0.13", "#c9a8ff", "u2", { net: "udn" });
      }
      if (trap) {
        stamp(svg, 670, 160, "REJECTED", "#9b7ad4");
        shakeStage();
        svg.appendChild(label(40, 400, "Pods already existed. OVN will not re-home them onto a primary UDN. New namespace.", "#9b7ad4", 14));
      } else {
        svg.appendChild(label(40, 400, applied
          ? "Same island pings. Hallway → island splashes. That's isolation. Copy YAML, oc apply on YOUR cluster."
          : "Those pods share the default overlay. Click the empty island (or Apply UDN) to cut one out.", "#a898c0", 14));
      }
      svg.appendChild(label(40, 428, "Birth label → CR → pods last. CR is immutable. Registry/S2I often fail from a primary UDN.", "#a898c0", 13));
    } else if (pick === "tenant") {
      const empty = !!scene.extra.emptySel;
      if (empty) {
        svg.appendChild(svgEl("rect", { x: 40, y: 88, width: 820, height: 300, rx: 16, fill: "#2a1614", stroke: "#9b7ad4", "stroke-width": 3 }));
        svg.appendChild(label(56, 118, "CUDN  namespaceSelector: {}    includes default + openshift-*", "#9b7ad4", 14));
        addPod(120, 220, "default", "#9b7ad4", "d", { net: "nuke" });
        addPod(280, 220, "openshift-dns", "#9b7ad4", "dns", { net: "nuke" });
        addPod(500, 220, "tenant-a", "#9b7ad4", "a", { net: "nuke" });
        addPod(680, 220, "tenant-b", "#9b7ad4", "b", { net: "nuke" });
        stamp(svg, 760, 140, "ALL NS", "#9b7ad4");
        shakeStage();
        svg.appendChild(label(40, 420, "Empty selector matched the platform. This is how you melt a cluster. Always matchLabels: tenant: a", "#9b7ad4", 14));
      } else {
        svg.appendChild(svgEl("rect", { x: 40, y: 88, width: 390, height: 280, rx: 16, fill: "#1a1430", stroke: "#c9a8ff" }));
        svg.appendChild(label(56, 118, "CUDN tenant-a  ·  Layer3", "#c9a8ff", 14));
        svg.appendChild(svgEl("rect", { x: 470, y: 88, width: 390, height: 280, rx: 16, fill: "#231818", stroke: "#9b7ad4" }));
        svg.appendChild(label(486, 118, "CUDN tenant-b  ·  Layer3", "#9b7ad4", 14));
        addPod(140, 220, "web  .8", "#c9a8ff", "a1", { net: "a" });
        addPod(280, 220, "api  .9", "#c9a8ff", "a2", { net: "a" });
        addPod(570, 220, "web  .8", "#9b7ad4", "b1", { net: "b" });
        addPod(720, 220, "api  .9", "#9b7ad4", "b2", { net: "b" });
        svg.appendChild(label(40, 400, "Same .8 on both sides is fine. Click two pods and Ping. Across tenants: splash. Inside: delivered.", "#a898c0", 14));
        svg.appendChild(label(40, 428, "Then click Empty selector to see the nuclear option. Never ship that.", "#a898c0", 13));
      }
    } else if (pick === "vm") {
      const moved = !!scene.extra.moved;
      const sad = !!scene.extra.l3try;
      svg.appendChild(svgEl("rect", { x: 40, y: 88, width: 390, height: 250, rx: 14, fill: "#1b2430" }));
      svg.appendChild(label(56, 114, "node-a", "#a898c0", 13));
      svg.appendChild(svgEl("rect", { x: 470, y: 88, width: 390, height: 250, rx: 14, fill: "#1b2430" }));
      svg.appendChild(label(486, 114, "node-b", "#a898c0", 13));
      svg.appendChild(svgEl("rect", { x: 40, y: 348, width: 820, height: 28, rx: 6, fill: sad ? "#2a1614" : "#2a1c40", stroke: sad ? "#9b7ad4" : "#c9a8ff" }));
      svg.appendChild(label(300, 367, sad ? "Layer3  ·  new subnet per node  ·  IP will change" : "Layer2 switch  ·  192.168.100.0/24  ·  Persistent IPAM", sad ? "#9b7ad4" : "#c9a8ff", 13));
      const vmx = moved ? 670 : 180;
      const ip = sad && moved ? "VM  .2.40" : "VM  .50";
      const vm = podBox(vmx, 200, ip, sad && moved ? "#9b7ad4" : "#c9a8ff", "vm");
      vm.classList.add("clickable");
      vm.addEventListener("click", () => {
        scene.extra.moved = !scene.extra.moved;
        paint();
        if (scene.extra.l3try && scene.extra.moved) log("Layer 3. New node, new subnet, new IP. TCP sessions die. Virt does not want this.");
        else if (scene.extra.moved) log("Layer 2 + Persistent. Node changed. IP is still .50. MAC too. Click it again to move back.");
        else log("VM is back on node-a.");
      });
      svg.appendChild(vm);
      if (moved) svg.appendChild(svgEl("path", { class: "flow-line", d: "M180 200 C 360 80, 520 80, 640 190", fill: "none", stroke: "#9b7ad4", "stroke-width": 2 }));
      svg.appendChild(label(40, 410, sad
        ? "That is why OpenShift Virtualization documents Layer2 and Localnet — not Layer3 — for VMs."
        : "Click the VM to live-migrate. Then Try Layer 3 to see the sad version. VLAN extra NIC = Localnet Secondary.", "#a898c0", 14));
      svg.appendChild(label(40, 438, "virtctl ssh / oc port-forward / headless services are limited on a primary UDN VM. Check the Virt doc pill.", "#a898c0", 13));
    } else if (pick === "vlan") {
      const mapped = scene.extra.mapped !== false;
      const primary = !!scene.extra.makePrimary;
      svg.appendChild(svgEl("rect", { x: 40, y: 90, width: 280, height: 220, rx: 14, fill: "#1b2430" }));
      svg.appendChild(label(56, 116, "OpenShift node", "#a898c0", 13));
      addPod(180, 180, "VM eth1", "#c9a8ff", "v", { net: "ln" });
      const vlan = svgEl("rect", { class: "clickable", x: 40, y: 340, width: 820, height: 48, rx: 10, fill: mapped ? "#241a32" : "#2a1614", stroke: mapped ? "#c9a8ff" : "#9b7ad4" });
      vlan.addEventListener("click", () => {
        scene.extra.mapped = scene.extra.mapped === false;
        scene.extra.makePrimary = false;
        paint();
        log(scene.extra.mapped === false
          ? "physicalNetworkName does not match the OVS mapping. You bridged the wrong cable."
          : "Mapping matches. VLAN 20 is on the wire. Ping the bare metal.");
      });
      svg.appendChild(vlan);
      svg.appendChild(label(56, 370, mapped ? "VLAN 20  ·  physicalNetworkName: localnet1  ·  click to break the mapping" : "WRONG mapping  ·  click to fix", mapped ? "#c9a8ff" : "#9b7ad4", 14));
      svg.appendChild(svgEl("rect", { x: 580, y: 90, width: 280, height: 220, rx: 14, fill: "#1a1422" }));
      svg.appendChild(label(596, 116, "outside the cluster", "#a898c0", 13));
      addPod(720, 180, "bare metal", "#9b7ad4", "bm", { net: "phy" });
      if (primary) {
        stamp(svg, 220, 140, "PRIMARY REJECTED", "#9b7ad4");
        shakeStage();
      }
      svg.appendChild(label(40, 420, "Localnet is Secondary only. Role Primary is rejected. excludeSubnets keeps physical IPs out of allocation.", "#a898c0", 14));
      svg.appendChild(label(40, 448, "Need north-south to a real VLAN? This. Need migrate-and-keep-IP? Layer 2 overlay, not this.", "#a898c0", 13));
    } else {
      const bridged = !!scene.extra.bridged;
      const kind = scene.extra.conn || "ServiceNetwork";
      svg.appendChild(svgEl("rect", { x: 40, y: 88, width: 300, height: 250, rx: 16, fill: "#1b2836", stroke: "#c9a8ff", "stroke-width": 2 }));
      svg.appendChild(label(56, 114, "UDN shop  primary", "#c9a8ff", 14));
      addPod(190, 200, "shop-web", "#c9a8ff", "a", { net: "shop" });
      svg.appendChild(svgEl("rect", { x: 560, y: 88, width: 300, height: 250, rx: 16, fill: "#1b2836", stroke: "#9b7ad4", "stroke-width": 2 }));
      svg.appendChild(label(576, 114, "UDN bank  primary", "#9b7ad4", 14));
      addPod(710, 180, "bank-api", "#9b7ad4", "b", { net: "bank" });
      const svc = svgEl("circle", { class: "clickable", cx: 710, cy: 280, r: 20, fill: "#2a1620", stroke: "#c9a8ff" });
      svc.addEventListener("click", () => { scene.extra.pingSvc = true; fieldPing(); });
      svg.appendChild(svc);
      svg.appendChild(label(696, 284, "svc", "#c9a8ff", 11));
      if (bridged) {
        svg.appendChild(svgEl("rect", { x: 350, y: 170, width: 200, height: 70, rx: 10, fill: "#2a1c40", stroke: "#c9a8ff" }));
        svg.appendChild(label(368, 200, "CNC  " + kind, "#c9a8ff", 13));
        svg.appendChild(label(368, 222, "click svc or ping pods", "#a898c0", 11));
      } else {
        svg.appendChild(label(400, 210, "no path yet", "#9b7ad4", 14));
      }
      svg.appendChild(label(40, 370, bridged
        ? (kind === "ServiceNetwork" ? "ServiceNetwork: click the svc circle — that path works. Pod IP still splashes. Start here." : "PodNetwork: pod IPs talk. You just rebuilt a hallway between two tenants.")
        : "Click Build CNC. NetworkPolicy will not do this. Overlapping CIDRs cannot be connected. Localnet/Secondary cannot either.", "#a898c0", 14));
      svg.appendChild(label(40, 400, "CNC is symmetric, not transitive. A–B plus B–C does not give A–C. Session 09 has the three-island trick.", "#a898c0", 13));
      svg.appendChild(label(40, 428, "IPv6 Layer3: hostSubnet must be /64. Dual-stack = two CIDRs, different families.", "#a898c0", 13));
    }

    root.appendChild(svg);
    scene.extra.svg = svg;
    scene.extra.nodes = nodes;
  }

  async function fieldPing() {
    const svg = scene.extra.svg;
    const nodes = scene.extra.nodes || [];
    const story = scene.extra.story || "tenant";
    if (story === "talk" && scene.extra.pingSvc) {
      if (!scene.extra.bridged) {
        await fly(svg, { x: 190, y: 200 }, { x: 710, y: 280 }, { failAt: 0.5, dur: 900 });
        log("No CNC. The Service is on the other island. Splash.");
        return;
      }
      await fly(svg, { x: 190, y: 200 }, { x: 710, y: 280 }, { color: "#c9a8ff", dur: 900 });
      log("ServiceNetwork: ClusterIP works. That is the API they asked for. Pod IPs stay isolated.");
      scene.extra.pingSvc = false;
      return;
    }
    if (story === "vm") {
      log("Click the VM to migrate it. Ping is the live-migrate. Layer 2 keeps the IP.");
      return;
    }
    if (scene.selected.length < 2) {
      if (story === "vlan" && nodes.length >= 2) {
        scene.selected = ["v", "bm"];
      } else if (story === "talk") {
        scene.selected = ["a", "b"];
      } else if (story === "do" && scene.extra.applied) {
        scene.selected = ["u1", "h1"];
      } else if (story === "tenant" && !scene.extra.emptySel) {
        scene.selected = ["a1", "b1"];
      } else {
        log("Click two pods first.");
        return;
      }
      markSelected(nodes);
    }
    const a = nodes.find((n) => n.dataset.id === scene.selected[0]);
    const b = nodes.find((n) => n.dataset.id === scene.selected[1]);
    if (!a || !b) { log("Click two pods first."); return; }
    const an = a.dataset.net;
    const bn = b.dataset.net;
    let fail = an !== bn;
    if (story === "vlan") fail = scene.extra.mapped === false;
    if (story === "talk") fail = !scene.extra.bridged || scene.extra.conn === "ServiceNetwork";
    if (story === "do" && scene.extra.trap) fail = true;
    if (story === "tenant" && scene.extra.emptySel) fail = false;
    const res = await fly(svg, { x: +a.dataset.x, y: +a.dataset.y }, { x: +b.dataset.x, y: +b.dataset.y }, {
      failAt: fail ? 0.52 : null,
      color: fail ? "#9b7ad4" : "#c9a8ff",
      dur: 1000,
    });
    if (res === "fail") {
      if (story === "talk") log("Direct pod IP still isolated. That is ServiceNetwork doing its job. Click the svc circle.");
      else if (story === "vlan") log("No mapping (or wrong physicalNetworkName). Packet never reached the VLAN.");
      else if (story === "do") log("No path. Hallway and island are different networks. Same as two tenants.");
      else log("Splash. Different primary UDNs. Same CIDR is allowed. NetworkPolicy cannot build this road.");
    } else if (story === "tenant" && scene.extra.emptySel) {
      log("They can talk because you put the whole cluster on one CUDN. Including openshift-*. Undo this.");
    } else if (story === "vlan") {
      log("Packet rode VLAN 20 to the bare-metal host. East-west and north-south on the underlay.");
    } else if (story === "do") {
      log(an === "udn" ? "Same island. East-west works. Check oc get pod -o wide — 10.100.x not 10.128.x." : "Still on the hallway. Apply the UDN first.");
    } else {
      log("Delivered. Same island. Isolation is the other tenant's problem, not yours.");
    }
  }

  function pickStory(id) {
    scene.extra = { story: id };
    paint();
  }

  const DOC = {
    primary: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/multiple_networks/primary-networks",
    udnApi: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/network_apis/userdefinednetwork-k8s-ovn-org-v1",
    cudnApi: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/network_apis/clusteruserdefinednetwork-k8s-ovn-org-v1",
    multi: "https://docs.okd.io/latest/networking/multiple_networks/understanding-multiple-networks.html",
    about: "https://docs.okd.io/latest/networking/multiple_networks/primary_networks/about-user-defined-networks.html",
    virt: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/virtualization/networking",
    cnc: "https://ovn-kubernetes.io/features/user-defined-networks/cluster-network-connect/",
  };
  const docLink = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

  const LESSONS = {
    intro: {
      html: `<p>Click the pictures. Ten sessions. <strong>Ask a doubt</strong> is bottom right. The intro cards are clickable.</p>
        <p class="dim">Start session 01 when you are ready. Session 10 is a toy cluster you can ping.</p>`,
      legend: [["#c9a8ff", "you"]],
      yaml: `# this panel is the example CR
# lines starting with # are comments`,
      play: {
        lines: [
          ["cmd", "$ # that's the intro"],
          ["ok", "click pictures. ten sessions."],
          ["dim", "Next → 01"],
        ],
      },
      onPlay: () => { state.done.add("intro"); persist(); renderNav(); },
      controls: [
        ["chip", "Start session 01", () => { state.done.add("intro"); persist(); go(1); }],
      ],
    },
    why: {
      html: `<p>By default every pod shares one Layer-3 cluster network. Isolation is NetworkPolicy on that shared network — not a separate network.</p>
        <p>That is enough for simple clusters. It is a poor fit for tenant isolation, custom subnets, or VMs that need a switch as their primary NIC.</p>
        <p class="dim"><strong>UDN:</strong> an isolated OVN Layer-2 or Layer-3 segment that can be the pod or VM <em>primary</em> interface. Click two pods. Then Ping under the picture.</p>`,
      legend: [["#c9a8ff", "shop"], ["#9b7ad4", "bank"], ["#6b4aa8", "ml"]],
      yaml: `# WHAT: a pod on the default cluster network (no UDN)
# WHY: this is the starting point — every namespace still shares one overlay
apiVersion: v1
kind: Pod
metadata:
  name: shop-web
  namespace: ns-shop
spec:
  containers:
    - name: web
      image: quay.io/demo/web`,
      play: {
        lines: [
          ["cmd", "$ oc get pod -A -o wide | head"],
          ["dim", "NAMESPACE   NAME        IP            NODE"],
          ["ok", "ns-shop     shop-web    10.128.2.14   worker-a"],
          ["ok", "ns-bank     bank-api    10.128.3.22   worker-b"],
          ["cmd", "$ oc exec -n ns-shop shop-web -- ping -c1 10.128.3.22"],
          ["ok", "64 bytes from 10.128.3.22: icmp_seq=1 ttl=64 time=0.4 ms"],
          ["dim", "Different tenants, same overlay. Ping succeeds."],
        ],
      },
      onPlay: () => {
        const nodes = scene.extra.nodes || [];
        if (nodes.length > 3) {
          scene.selected = [nodes[0].dataset.id, nodes[2].dataset.id];
          nodes.forEach((n) => n.querySelector(".pod-body").setAttribute("stroke", scene.selected.includes(n.dataset.id) ? "#c9a8ff" : "rgba(255,255,255,0.22)"));
        }
        whySend();
      },
      controls: [
        ["chip", "Send packet", whySend],
        ["chip", "Toggle NetworkPolicy", () => {
          scene.policy = !scene.policy;
          scene.extra.policyFlag.textContent = scene.policy ? "NetworkPolicy ON" : "";
          log(scene.policy ? "NetworkPolicy is on. Cross-tenant packets drop. Still one network." : "NetworkPolicy is off. Any pod IP can reach any other pod IP.");
        }],
      ],
      quiz: {
        q: "Customer: we already have NetworkPolicy. Why UDN?",
        options: [
          ["A", "NetworkPolicy is deprecated."],
          ["B", "Policy filters one network. UDN is a separate network."],
          ["C", "UDN is only for VMs."],
        ],
        ok: 1,
        why: "Yes. Policy still matters inside an island. It does not invent a second island.",
      },
    },
    islands: {
      html: `<p>Same UDN: pods can talk. Different primary UDNs: <strong>no path</strong>. The default cluster network is the mainland for platform namespaces (<code>openshift-*</code>).</p>
        <p class="dim">Both islands can use <code>10.100.0.0/16</code>. Overlapping CIDRs are allowed. NetworkPolicy cannot create connectivity between them.</p>`,
      legend: [["#c9a8ff", "island A"], ["#9b7ad4", "island B"], ["#6b4aa8", "mainland"]],
      yaml: `# WHAT: two primary UDNs in two namespaces
# WHY: each tenant gets an isolated network. the same CIDR is allowed
apiVersion: k8s.ovn.org/v1
kind: UserDefinedNetwork
metadata:
  name: shop-net
  namespace: ns-shop
spec:
  topology: Layer3
  layer3:
    role: Primary
    subnets:
      - cidr: 10.100.0.0/16
        hostSubnet: 24
---
# WHAT: bank uses the same subnet on purpose
# WHY: overlapping IPs show isolation is the network, not unique CIDRs
apiVersion: k8s.ovn.org/v1
kind: UserDefinedNetwork
metadata:
  name: bank-net
  namespace: ns-bank
spec:
  topology: Layer3
  layer3:
    role: Primary
    subnets:
      - cidr: 10.100.0.0/16
        hostSubnet: 24`,
      play: {
        lines: [
          ["cmd", "$ oc get udn -A"],
          ["ok", "NAMESPACE   NAME       TOPOLOGY   ROLE      STATUS"],
          ["ok", "ns-shop     blue-net   Layer3     Primary   NetworkReady"],
          ["ok", "ns-bank     red-net    Layer3     Primary   NetworkReady"],
          ["cmd", "$ oc exec -n ns-shop shop-web -- ping -c1 10.100.1.7"],
          ["err", "ping: connect: Network is unreachable"],
          ["dim", "Same CIDR, different UDNs, no connectivity."],
        ],
      },
      onPlay: () => {
        const nodes = scene.extra.nodes || [];
        const b = nodes.find((n) => n.dataset.id === "b1");
        const r = nodes.find((n) => n.dataset.id === "r1");
        if (b && r) {
          scene.selected = ["b1", "r1"];
          islandPing();
        }
      },
      controls: [["chip", "Ping selected", islandPing]],
      quiz: {
        q: "Two primary UDNs, same subnet, both pods got .7. Can A ping B?",
        options: [
          ["A", "Yes — same IP means same network."],
          ["B", "No path. Overlapping CIDRs are fine. Islands stay isolated."],
          ["C", "OVN rejects the second UDN."],
        ],
        ok: 1,
        why: "Same CIDR, different networks. There is no path.",
      },
    },
    roles: {
      html: `<p><strong>Primary</strong> is eth0 for every pod in the namespace. The namespace must be created with <code>k8s.ovn.org/primary-user-defined-network</code>. One primary per namespace.</p>
        <p><strong>Secondary</strong> is opt-in: annotate the pod with <code>k8s.v1.cni.cncf.io/networks</code>. You can attach more than one.</p>`,
      legend: [["#c9a8ff", "primary"], ["#9b7ad4", "secondary"]],
      yaml: `# WHAT: create the namespace with the primary-UDN label
# WHY: this label can only be set when the namespace is created
apiVersion: v1
kind: Namespace
metadata:
  name: ns-shop
  labels:
    k8s.ovn.org/primary-user-defined-network: ""
---
# WHAT: primary UDN — becomes eth0 for every pod in ns-shop
# WHY: custom subnet as the default interface, not an extra NIC
apiVersion: k8s.ovn.org/v1
kind: UserDefinedNetwork
metadata:
  name: shop-primary
  namespace: ns-shop
spec:
  topology: Layer3
  layer3:
    role: Primary
    subnets:
      - cidr: 10.100.0.0/16
        hostSubnet: 24
---
# WHAT: a pod that also requests a secondary network
# WHY: extra interfaces are opt-in. no annotation means no eth1
apiVersion: v1
kind: Pod
metadata:
  name: shop-web
  namespace: ns-shop
  annotations:
    k8s.v1.cni.cncf.io/networks: shop-extra
spec:
  containers:
    - name: web
      image: quay.io/demo/web`,
      play: {
        lines: [
          ["cmd", "$ oc apply -f shop-primary-udn.yaml"],
          ["ok", "namespace/ns-shop created"],
          ["ok", "userdefinednetwork.k8s.ovn.org/shop-primary created"],
          ["cmd", "$ oc get udn,nad -n ns-shop"],
          ["ok", "NAME                       STATUS         ROLE"],
          ["ok", "udn/shop-primary            NetworkReady   Primary"],
          ["ok", "nad/shop-primary            ovn-k8s-cni-overlay"],
          ["cmd", "$ oc exec -n ns-shop shop-web -- ip -br addr"],
          ["ok", "eth0   10.100.1.12/24    # primary UDN"],
          ["ok", "eth1   192.168.50.8/24   # secondary"],
        ],
      },
      onPlay: () => { scene.extra.secondary = true; paint(); log("eth1 attached. Only pods that request the secondary network get it."); },
      controls: [
        ["chip", "Attach secondary NIC", () => { scene.extra.secondary = true; paint(); log("Secondary attached. Opt-in only."); }],
        ["chip", "Detach secondary", () => { scene.extra.secondary = false; paint(); log("Back to a single front door."); }],
      ],
      quiz: {
        q: "How many primary UDNs can one namespace have?",
        options: [["A", "As many as you want"], ["B", "Exactly one"], ["C", "Zero — primary is cluster-wide only"]],
        ok: 1,
        why: "One front door. Many side docks. That's the rule.",
      },
    },
    scope: {
      html: `<p><code>UserDefinedNetwork</code> is namespace-scoped. <code>ClusterUserDefinedNetwork</code> is cluster-scoped and admin-only. A CUDN selects namespaces with labels and can span them.</p>
        <p class="dim">Do not use an empty selector. That can include <code>default</code> and <code>openshift-*</code>.</p>`,
      legend: [["#c9a8ff", "shop net"], ["#9b7ad4", "bank net"]],
      yaml: `# WHAT: CUDN shared by namespaces labeled team=shop
# WHY: shop and shop-api share one network without each defining a UDN
apiVersion: k8s.ovn.org/v1
kind: ClusterUserDefinedNetwork
metadata:
  name: shop-net
spec:
  namespaceSelector:
    matchLabels:
      team: shop
  network:
    topology: Layer2
    layer2:
      role: Primary
      subnets:
        - 10.100.0.0/16
---
# WHAT: a second CUDN for bank
# WHY: a different selector is a different network. empty selector matches all namespaces
apiVersion: k8s.ovn.org/v1
kind: ClusterUserDefinedNetwork
metadata:
  name: bank-net
spec:
  namespaceSelector:
    matchLabels:
      team: bank
  network:
    topology: Layer3
    layer3:
      role: Primary
      subnets:
        - cidr: 10.200.0.0/16
          hostSubnet: 24`,
      play: {
        lines: [
          ["cmd", "$ oc apply -f cudn.yaml"],
          ["ok", "clusteruserdefinednetwork.k8s.ovn.org/shop-net created"],
          ["ok", "clusteruserdefinednetwork.k8s.ovn.org/bank-net created"],
          ["cmd", "$ oc get ns --show-labels | grep team"],
          ["ok", "ns-shop       team=shop,k8s.ovn.org/primary-user-defined-network="],
          ["ok", "ns-shop-api   team=shop,k8s.ovn.org/primary-user-defined-network="],
          ["ok", "ns-bank       team=bank,k8s.ovn.org/primary-user-defined-network="],
          ["dim", "shop and shop-api share a network. bank does not."],
        ],
      },
      onPlay: () => { scene.extra.mode = "cudn"; paint(); },
      controls: [
        ["chip", "Show UDN (per namespace)", () => { scene.extra.mode = "udn"; paint(); }, () => (scene.extra.mode || "udn") === "udn"],
        ["chip", "Show CUDN (shared)", () => { scene.extra.mode = "cudn"; paint(); }, () => scene.extra.mode === "cudn"],
        ["chip", "Empty selector (trap)", () => { scene.extra.mode = "empty"; paint(); log("Empty selector = every namespace. Including platform."); }, () => scene.extra.mode === "empty"],
      ],
      quiz: {
        q: "Who should create a ClusterUserDefinedNetwork?",
        options: [["A", "Any developer in the project"], ["B", "Cluster admin only"], ["C", "The CNI itself, automatically"]],
        ok: 1,
        why: "CUDN is cluster-wide isolation. Wrong selector = security incident, not a style choice.",
      },
    },
    topo: {
      html: `<p>Topology is how the UDN is wired across nodes. Ask one question: <strong>if this workload moves to another node, does the IP stay?</strong></p>
        <p>Click <strong>Layer 3</strong>, then <strong>Layer 2</strong>, then <strong>Localnet</strong>. Watch the picture. Then click <strong>Ping</strong>.</p>
        <div class="compare">
          <article>
            <h4>Layer 3</h4>
            <p>Each node is a different street.</p>
            <p>worker-a = <code>10.100.1.x</code><br>worker-b = <code>10.100.2.x</code></p>
            <p>Packets go through a <strong>router</strong>.</p>
            <p><strong>Use for pods.</strong></p>
            <p class="dim">A VM that moved would need a new IP. Do not pick this for live migration.</p>
          </article>
          <article>
            <h4>Layer 2</h4>
            <p>One virtual switch on every node.</p>
            <p>Everyone is on <code>192.168.100.x</code>.</p>
            <p>No router between nodes. Same subnet.</p>
            <p><strong>Use for VMs that migrate.</strong></p>
            <p class="dim">IP and MAC stay. The broadcast domain is cluster-wide, so it does not scale like Layer 3.</p>
          </article>
          <article>
            <h4>Localnet</h4>
            <p>Not an overlay island.</p>
            <p>The extra NIC sits on a <strong>real VLAN</strong>.</p>
            <p>Can reach bare metal on that VLAN.</p>
            <p><strong>Always Secondary.</strong></p>
            <p class="dim"><code>physicalNetworkName</code> must match the OVS mapping. Never a primary UDN.</p>
          </article>
        </div>
        <p class="dim">Rule of thumb: pods → Layer 3. VMs that migrate → Layer 2. Need a datacenter VLAN → Localnet secondary. Layer3 IPv6: <code>hostSubnet</code> must be /64. Dual-stack = two CIDRs, different families.</p>`,
      legend: [["#c9a8ff", "this UDN"], ["#9b7ad4", "physical / other"]],
      yamlByTopo: {
        l3: `# WHAT: Layer 3 primary UDN
# WHY: each node gets a slice of 10.100.0.0/16 (hostSubnet 24)
# DETAIL: pods on different nodes have different subnets and use a router
apiVersion: k8s.ovn.org/v1
kind: UserDefinedNetwork
metadata:
  name: shop-l3
  namespace: ns-shop
spec:
  topology: Layer3
  layer3:
    role: Primary
    subnets:
      - cidr: 10.100.0.0/16
        hostSubnet: 24`,
        l2: `# WHAT: Layer 2 primary CUDN
# WHY: one subnet on every node so a VM can migrate and keep its IP
apiVersion: k8s.ovn.org/v1
kind: ClusterUserDefinedNetwork
metadata:
  name: vm-switch
spec:
  namespaceSelector:
    matchLabels:
      tenant: virt
  network:
    topology: Layer2
    layer2:
      role: Primary
      subnets:
        - 192.168.100.0/24
      ipam:
        lifecycle: Persistent`,
        localnet: `# WHAT: Localnet secondary CUDN on VLAN 20
# WHY: the VM extra NIC must sit on a real datacenter VLAN
# DETAIL: role must be Secondary. physicalNetworkName must match the OVS mapping
apiVersion: k8s.ovn.org/v1
kind: ClusterUserDefinedNetwork
metadata:
  name: vlan20
spec:
  namespaceSelector:
    matchLabels:
      tenant: virt
  network:
    topology: Localnet
    localnet:
      role: Secondary
      physicalNetworkName: localnet1
      vlan:
        mode: Access
        access:
          id: 20`,
      },
      yaml: `# click Layer 3, Layer 2, or Localnet — the YAML follows the picture`,
      playByTopo: {
        l3: {
          lines: [
            ["cmd", "$ oc apply -f shop-l3.yaml"],
            ["ok", "userdefinednetwork.k8s.ovn.org/shop-l3 created"],
            ["cmd", "$ oc get pod -o wide"],
            ["ok", "web   10.100.1.12   worker-a"],
            ["ok", "api   10.100.2.40   worker-b"],
            ["dim", "Different streets. Ping must go through a router. A move would change the IP."],
          ],
        },
        l2: {
          lines: [
            ["cmd", "$ oc apply -f vm-switch.yaml"],
            ["ok", "clusteruserdefinednetwork.k8s.ovn.org/vm-switch created"],
            ["ok", "NetworkReady=True  topology=Layer2  ipam=Persistent"],
            ["cmd", "$ virtctl migrate shop-vm"],
            ["ok", "shop-vm  192.168.100.50  worker-a → worker-b"],
            ["dim", "Same switch. IP stayed .50. That is why VMs use Layer 2."],
          ],
        },
        localnet: {
          lines: [
            ["cmd", "$ oc apply -f vlan20.yaml"],
            ["ok", "clusteruserdefinednetwork.k8s.ovn.org/vlan20 created"],
            ["ok", "topology=Localnet  role=Secondary  vlan=20"],
            ["cmd", "$ # this CUDN is Secondary — the VM extra NIC, not eth0"],
            ["ok", "shop-vm  eth0=primary UDN   eth1=vlan20"],
            ["dim", "Packet left OVN overlay and rode the physical VLAN to bare metal."],
          ],
        },
      },
      play: {
        lines: [
          ["cmd", "$ # compare: does the IP survive a node move?"],
          ["ok", "Layer3    per-node subnet     IP would change     use for pods"],
          ["ok", "Layer2    one cluster switch  IP stays            use for VMs"],
          ["ok", "Localnet  physical VLAN       extra NIC only      never primary"],
        ],
      },
      onPlay: () => {
        const t = scene.extra.topo || "l3";
        if (t === "l2") {
          scene.extra.moved = true;
          paint();
        }
      },
      afterPlay: () => topoPing(),
      controls: [
        ["chip", "Layer 3", () => { scene.extra.topo = "l3"; scene.extra.moved = false; paint(); }, () => (scene.extra.topo || "l3") === "l3"],
        ["chip", "Layer 2", () => { scene.extra.topo = "l2"; paint(); }, () => scene.extra.topo === "l2"],
        ["chip", "Localnet", () => { scene.extra.topo = "localnet"; scene.extra.moved = false; paint(); }, () => scene.extra.topo === "localnet"],
        ["chip", "Ping", () => { topoPing(); }],
        ["chip", "Live-migrate VM", () => { scene.extra.topo = "l2"; scene.extra.moved = true; paint(); log("VM is on worker-b. Address is still 192.168.100.50."); }],
      ],
      quiz: {
        q: "A VM must live-migrate and keep the same IP. Which topology?",
        options: [["A", "Layer 3 primary"], ["B", "Layer 2 primary"], ["C", "Localnet primary"]],
        ok: 1,
        why: "Layer 2 is one switch, so the IP does not change. Localnet cannot be primary.",
      },
    },
    lab: {
      html: `<p>Order: 1) namespace with the primary-UDN label  2) UDN CR  3) pods. The CR cannot be changed after create. The label cannot be added later. Existing pods are not moved.</p>`,
      legend: [["#c9a8ff", "ready"], ["#9b7ad4", "rejected"]],
      yaml: `# WHAT: step 1 — namespace with the primary-UDN label at create time
# WHY: the label cannot be added to an existing namespace
apiVersion: v1
kind: Namespace
metadata:
  name: ns-shop
  labels:
    k8s.ovn.org/primary-user-defined-network: ""
---
# WHAT: step 2 — create the UDN CR BEFORE any pods
# WHY: OVN will not re-home running pods. the CR is also immutable
apiVersion: k8s.ovn.org/v1
kind: UserDefinedNetwork
metadata:
  name: shop-net
  namespace: ns-shop
spec:
  topology: Layer3
  layer3:
    role: Primary
    subnets:
      - cidr: 10.100.0.0/16
        hostSubnet: 24
---
# WHAT: step 3 — NOW the pod. it attaches as eth0 on shop-net
# WHY: pods must come last. create them first and the UDN is rejected
apiVersion: v1
kind: Pod
metadata:
  name: shop-web
  namespace: ns-shop
spec:
  containers:
    - name: web
      image: quay.io/demo/web`,
      play: {
        lines: [
          ["cmd", "$ oc apply -f ns-shop.yaml"],
          ["ok", "namespace/ns-shop created"],
          ["cmd", "$ oc apply -f shop-net-udn.yaml"],
          ["ok", "userdefinednetwork.k8s.ovn.org/shop-net created"],
          ["cmd", "$ oc get udn,nad -n ns-shop"],
          ["ok", "udn/shop-net   NetworkReady   Primary"],
          ["ok", "nad/shop-net   ovn-k8s-cni-overlay   # OVN minted this"],
          ["cmd", "$ oc apply -f shop-web.yaml && oc get pod -n ns-shop -o wide"],
          ["ok", "shop-web   1/1   Running   10.100.1.12   worker-a"],
          ["dim", "IP is from YOUR subnet. not 10.128.x. that's how you know it worked."],
        ],
      },
      onPlay: () => { scene.extra.wrong = false; scene.extra.step = 3; paint(); },
      controls: [
        ["chip", "Next correct step", () => { scene.extra.wrong = false; scene.extra.step = Math.min(3, (scene.extra.step || 0) + 1); paint(); log(["", "Namespace labeled.", "UDN created. NAD generated.", "Pods attached to the island."][scene.extra.step]); }],
        ["chip", "Trap: pods first", () => { scene.extra.wrong = true; paint(); log("Pods already existed. OVN will not attach a primary UDN after the fact."); }],
        ["chip", "Patch CR (trap)", () => { scene.extra.wrong = true; paint(); log("The UDN/CUDN CR cannot be patched after create. Plan topology first. Delete and recreate."); }],
        ["chip", "Reset", () => { scene.extra.step = 0; scene.extra.wrong = false; paint(); }],
      ],
      quiz: {
        q: "A namespace already has pods. Can you add a primary UDN to it?",
        options: [["A", "Yes, it hot-swaps eth0"], ["B", "No. Label is birth-only. New namespace."], ["C", "Yes, if you restart OVN"]],
        ok: 1,
        why: "Birth-only label. Immutable CR. New project, or live with the hallway.",
      },
    },
    gotchas: {
      html: `<p>DNS lookups for pods still return the default-network IP. The in-cluster image registry is often unreachable from a UDN. NetworkPolicy between different primary UDNs does not take effect. Kubelet health checks can show Ready while the UDN interface is down. NodePort isolation is not guaranteed (same-node can fail).</p>`,
      legend: [["#9b7ad4", "dns lie"], ["#9b7ad4", "blocked"]],
      yaml: `# WHAT: a NetworkPolicy that tries to allow shop → bank
# WHY: the object is valid. there is still no path between primary UDNs
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-shop
  namespace: ns-bank
spec:
  podSelector: {}
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ns-shop`,
      play: {
        lines: [
          ["cmd", "$ oc exec -n ns-shop shop-web -- nslookup shop-api.ns-shop.svc"],
          ["ok", "Name:  shop-api.ns-shop.svc.cluster.local"],
          ["err", "Address: 10.128.2.15     # default-network IP. not the UDN IP."],
          ["cmd", "$ oc exec -n ns-shop shop-web -- curl -I image-registry.openshift-image-registry.svc"],
          ["err", "curl: (7) Failed to connect — registry is on the mainland"],
          ["dim", "Service DNS works. Pod DNS returns the default-network IP."],
        ],
      },
      onPlay: () => { scene.extra.gotcha = "dns"; paint(); },
      controls: [
        ["chip", "DNS lie", () => { scene.extra.gotcha = "dns"; paint(); }, () => (scene.extra.gotcha || "dns") === "dns"],
        ["chip", "Registry blocked", () => { scene.extra.gotcha = "reg"; paint(); }, () => scene.extra.gotcha === "reg"],
        ["chip", "Policy between islands", () => { scene.extra.gotcha = "np"; paint(); }, () => scene.extra.gotcha === "np"],
        ["chip", "Ready is a lie", () => { scene.extra.gotcha = "health"; paint(); }, () => scene.extra.gotcha === "health"],
        ["chip", "NodePort", () => { scene.extra.gotcha = "nodeport"; paint(); }, () => scene.extra.gotcha === "nodeport"],
      ],
      quiz: {
        q: "NetworkPolicy allows ns-a → ns-b. Different primary UDNs. What happens?",
        options: [["A", "Traffic is allowed"], ["B", "Policy does not take effect — no path"], ["C", "OVN merges the subnets"]],
        ok: 1,
        why: "The policy is true and useless. No road, nothing to allow.",
      },
    },
    virt: {
      html: `<p>Virt wants Layer 2 on the VM's primary NIC so live migrate doesn't change L3 identity. Persistent IPAM exists for that. Need a datacenter VLAN too? Secondary Localnet CUDN (GA 4.19+). Don't promise Localnet as primary.</p>`,
      legend: [["#c9a8ff", "L2 switch"], ["#9b7ad4", "migrate path"]],
      yaml: `# WHAT: Layer-2 CUDN as the VM primary NIC
# WHY: live migration must keep IP and MAC. use Persistent IPAM
apiVersion: k8s.ovn.org/v1
kind: ClusterUserDefinedNetwork
metadata:
  name: vm-l2
spec:
  namespaceSelector:
    matchLabels:
      kubevirt.io/schedule: "true"
  network:
    topology: Layer2
    layer2:
      role: Primary
      subnets:
        - 192.168.100.0/24
      ipam:
        lifecycle: Persistent
---
# WHAT: a VM that uses the default pod network (the primary UDN)
# WHY: the primary UDN is the default pod network — no extra annotation
apiVersion: kubevirt.io/v1
kind: VirtualMachine
metadata:
  name: web-vm
  namespace: ns-virt
spec:
  running: true
  template:
    spec:
      domain:
        devices: {}
      networks:
        - name: udn
          pod: {}`,
      play: {
        lines: [
          ["cmd", "$ oc get vmi web-vm -o jsonpath='{.status.nodeName} {.status.interfaces[0].ipAddress}'"],
          ["ok", "worker-a   192.168.100.50"],
          ["cmd", "$ virtctl migrate web-vm"],
          ["ok", "VMI web-vm was submitted for live migration"],
          ["cmd", "$ oc get vmi web-vm -o jsonpath='{.status.nodeName} {.status.interfaces[0].ipAddress}'"],
          ["ok", "worker-b   192.168.100.50"],
          ["dim", "node changed. IP did not. that's why L2 is the move."],
        ],
      },
      onPlay: () => { scene.extra.moved = true; paint(); log("Same IP .50. Different node."); },
      controls: [
        ["chip", "Live migrate", () => { scene.extra.moved = true; paint(); log("Same IP .50. Different node."); }],
        ["chip", "Reset VM", () => { scene.extra.moved = false; paint(); }],
      ],
      quiz: {
        q: "Where does Localnet attach for VMs?",
        options: [["A", "Primary UDN"], ["B", "Secondary CUDN (or NAD)"], ["C", "The default cluster network"]],
        ok: 1,
        why: "Localnet role is Secondary. Physical network is a side dock.",
      },
    },
    connect: {
      html: `<p>Islands stay silent until an admin ships <code>ClusterNetworkConnect</code>.</p>
        <ul><li><code>PodNetwork</code> — pod IPs can talk across the connected networks.</li><li><code>ServiceNetwork</code> — ClusterIP only. Start here.</li></ul>
        <p class="dim">Symmetric, not transitive: A–B and B–C does not give A–C. Cannot connect Secondary or Localnet. Overlapping pod CIDRs cannot be connected.</p>`,
      legend: [["#c9a8ff", "UDN A"], ["#9b7ad4", "UDN B"], ["#c9a8ff", "connect"]],
      yaml: `# WHAT: connect two isolated primary UDNs
# WHY: they have no path until an admin creates this CR
# DETAIL: ServiceNetwork first. PodNetwork meshes pod IPs across both
apiVersion: k8s.ovn.org/v1
kind: ClusterNetworkConnect
metadata:
  name: shop-to-bank-api
spec:
  connectivity:
    - ServiceNetwork
  connectSubnets:
    - cidr: 100.88.0.0/16
      networkPrefix: 24
  networkSelectors:
    - networkSelectionType: PrimaryUserDefinedNetworks
      primaryUserDefinedNetworks:
        namespaceSelector:
          matchLabels:
            connect: shop-bank`,
      play: {
        lines: [
          ["cmd", "$ oc exec -n ns-shop shop-web -- ping -c1 10.200.1.9"],
          ["err", "ping: connect: Network is unreachable"],
          ["cmd", "$ oc apply -f cnc-shop-bank.yaml"],
          ["ok", "clusternetworkconnect.k8s.ovn.org/shop-to-bank-api created"],
          ["cmd", "$ oc exec -n ns-shop shop-web -- curl -s http://bank-api.ns-bank.svc:8080/health"],
          ["ok", "{\"status\":\"ok\"}"],
          ["dim", "Service path is up. Prefer this before PodNetwork."],
        ],
      },
      onPlay: () => {
        scene.extra.bridged = true;
        scene.extra.conn = "ServiceNetwork";
        paint();
        scene.extra.pingSvc = true;
        connectPing();
      },
      controls: [
        ["chip", "Build connect", () => { scene.extra.bridged = true; paint(); log("ClusterNetworkConnect is in place. Isolation is now selective."); }],
        ["chip", "ServiceNetwork only", () => { scene.extra.bridged = true; scene.extra.conn = "ServiceNetwork"; paint(); }],
        ["chip", "PodNetwork", () => { scene.extra.bridged = true; scene.extra.conn = "PodNetwork"; paint(); }],
        ["chip", "Ping pod B", () => { scene.extra.pingSvc = false; scene.extra.pingC = false; connectPing(); }],
        ["chip", "Ping Service", () => { scene.extra.pingSvc = true; scene.extra.pingC = false; connectPing(); }],
        ["chip", "A–B–C not transitive", () => { scene.extra.triple = true; scene.extra.bridged = true; scene.extra.conn = "PodNetwork"; paint(); log("A talks to B. B talks to C. A does not talk to C."); }, () => !!scene.extra.triple],
        ["chip", "Ping A→C", () => { scene.extra.triple = true; scene.extra.bridged = true; scene.extra.pingC = true; scene.extra.pingSvc = false; scene.extra.conn = "PodNetwork"; connectPing(); }],
      ],
      quiz: {
        q: "Safest first connect between two tenant UDNs that must share an API?",
        options: [["A", "PodNetwork both ways"], ["B", "ServiceNetwork"], ["C", "Disable isolation globally"]],
        ok: 1,
        why: "Expose the API. Do not merge the address spaces.",
      },
    },
    field: {
      html: `<p>The picture is a toy cluster. <strong>Click pods. Spring traps.</strong> Copy the CR when it matches what you want on a throwaway OVN cluster. Play types the <code>oc</code> for that story.</p>
        <p class="docs">
          ${docLink(DOC.primary, "UDN")}
          ${docLink(DOC.about + "#about-the-userdefinednetwork-cr", "UserDefinedNetwork")}
          ${docLink(DOC.about + "#about-the-clusteruserdefinednetwork-cr", "ClusterUserDefinedNetwork")}
          ${docLink(DOC.udnApi, "UDN API")}
          ${docLink(DOC.cudnApi, "CUDN API")}
          ${docLink(DOC.multi, "Primary vs secondary")}
          ${docLink(DOC.about + "#best-practices-for-userdefinednetwork-crs", "Birth label")}
          ${docLink(DOC.about + "#layer-2-and-layer-3-topologies", "Layer 2 / Layer 3")}
          ${docLink(DOC.about + "#creating-a-clusteruserdefinednetwork-cr-for-a-localnet-topology", "Localnet / VLAN")}
          ${docLink(DOC.about + "#additional-configuration-details-for-user-defined-networks", "Persistent IPAM")}
          ${docLink(DOC.about + "#user-defined-network-status-condition-types", "NAD / status")}
          ${docLink(DOC.about + "#limitations-of-a-user-defined-network", "DNS, registry, NetworkPolicy")}
          ${docLink(DOC.about + "#best-practices-for-clusteruserdefinednetwork-crs", "Empty selector")}
          ${docLink(DOC.cnc, "ClusterNetworkConnect")}
          ${docLink(DOC.virt, "Virt networking")}
        </p>
        <h3 class="howto-h">On your test cluster</h3>
        <ol class="howto">
          <li><strong>Confirm OVN.</strong> <code>oc whoami</code> then <code>oc get network.operator cluster -o jsonpath='{.spec.defaultNetwork.type}'</code> — must print <code>OVNKubernetes</code>. ${docLink(DOC.primary, "Doc")}</li>
          <li><strong>CRDs exist.</strong> <code>oc get crd userdefinednetworks.k8s.ovn.org clusteruserdefinednetworks.k8s.ovn.org</code></li>
          <li><strong>Birth-label the namespace at create.</strong> <code>k8s.ovn.org/primary-user-defined-network</code> cannot be patched on later. ${docLink(DOC.about + "#best-practices-for-userdefinednetwork-crs", "Doc")}</li>
          <li><strong>Apply the CR on the left</strong> (chip picks UDN, CUDN, Localnet, or CNC). Wait until it is ready. OVN mints the NAD — you do not. ${docLink(DOC.about + "#creating-a-userdefinednetwork-cr-by-using-the-cli", "Create UDN")} · ${docLink(DOC.about + "#creating-a-clusteruserdefinednetwork-cr-by-using-the-cli", "Create CUDN")}</li>
          <li><strong>Pods last.</strong> Existing pods in that namespace cannot be moved onto a new primary UDN. ${docLink(DOC.about + "#limitations-of-a-user-defined-network", "Doc")}</li>
          <li><strong>Prove it.</strong> Play types the verify commands for this story: island ping, live-migrate, VLAN mapping, or CNC ServiceNetwork.</li>
        </ol>
        <p class="dim">Not production. If the image cannot pull, change it in the YAML before apply. Cleanup: delete the lab namespaces (and any CUDN/CNC you created).</p>`,
      legend: [["#c9a8ff", "click / ping"], ["#9b7ad4", "trap"]],
      yamlByStory: {
        do: `# WHAT: first primary UDN on YOUR test cluster
# WHY: one namespace, Layer3, pods. birth label then CR then pods
# APPLY: oc apply -f this.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: udn-lab-shop
  labels:
    k8s.ovn.org/primary-user-defined-network: ""
---
apiVersion: k8s.ovn.org/v1
kind: UserDefinedNetwork
metadata:
  name: shop-net
  namespace: udn-lab-shop
spec:
  topology: Layer3
  layer3:
    role: Primary
    subnets:
      - cidr: 10.100.0.0/16
        hostSubnet: 24
---
apiVersion: v1
kind: Pod
metadata:
  name: shop-web
  namespace: udn-lab-shop
spec:
  containers:
    - name: tool
      image: registry.redhat.io/rhel9/support-tools
      command: ["sleep", "infinity"]`,
        tenant: `# WHAT: one tenant CUDN — SaaS isolation across namespaces
# WHY: explicit matchLabels. empty selector matches ALL namespaces
# APPLY: oc apply -f this.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: udn-lab-tenant-a
  labels:
    k8s.ovn.org/primary-user-defined-network: ""
    tenant: a
---
apiVersion: k8s.ovn.org/v1
kind: ClusterUserDefinedNetwork
metadata:
  name: tenant-a
spec:
  namespaceSelector:
    matchLabels:
      tenant: a
  network:
    topology: Layer3
    layer3:
      role: Primary
      subnets:
        - cidr: 10.110.0.0/16
          hostSubnet: 24
---
apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: udn-lab-tenant-a
spec:
  containers:
    - name: tool
      image: registry.redhat.io/rhel9/support-tools
      command: ["sleep", "infinity"]`,
        vm: `# WHAT: Layer2 primary CUDN for VMs that live-migrate
# WHY: Virt wants Layer2 + Persistent. Layer3 is the wrong topology
# NEED: OpenShift Virtualization on the cluster
apiVersion: v1
kind: Namespace
metadata:
  name: udn-lab-virt
  labels:
    k8s.ovn.org/primary-user-defined-network: ""
    tenant: virt
---
apiVersion: k8s.ovn.org/v1
kind: ClusterUserDefinedNetwork
metadata:
  name: vm-switch
spec:
  namespaceSelector:
    matchLabels:
      tenant: virt
  network:
    topology: Layer2
    layer2:
      role: Primary
      subnets:
        - 192.168.100.0/24
      ipam:
        lifecycle: Persistent`,
        vlan: `# WHAT: secondary Localnet CUDN onto an existing VLAN
# WHY: Localnet role is Secondary only. change physicalNetworkName to YOUR mapping
# NEED: OVS bridge mapping already on the nodes. oc get nncp first
apiVersion: k8s.ovn.org/v1
kind: ClusterUserDefinedNetwork
metadata:
  name: vlan20
spec:
  namespaceSelector:
    matchLabels:
      tenant: virt
  network:
    topology: Localnet
    localnet:
      role: Secondary
      physicalNetworkName: localnet1
      vlan:
        mode: Access
        access:
          id: 20`,
        talk: `# WHAT: two primary islands, then CNC for ClusterIP only
# WHY: NetworkPolicy cannot connect two primary UDNs. ServiceNetwork first
# APPLY order: namespaces + UDNs first. create pods. THEN the ClusterNetworkConnect
apiVersion: v1
kind: Namespace
metadata:
  name: udn-lab-shop
  labels:
    k8s.ovn.org/primary-user-defined-network: ""
    connect: shop-bank
---
apiVersion: v1
kind: Namespace
metadata:
  name: udn-lab-bank
  labels:
    k8s.ovn.org/primary-user-defined-network: ""
    connect: shop-bank
---
apiVersion: k8s.ovn.org/v1
kind: UserDefinedNetwork
metadata:
  name: shop-net
  namespace: udn-lab-shop
spec:
  topology: Layer3
  layer3:
    role: Primary
    subnets:
      - cidr: 10.100.0.0/16
        hostSubnet: 24
---
apiVersion: k8s.ovn.org/v1
kind: UserDefinedNetwork
metadata:
  name: bank-net
  namespace: udn-lab-bank
spec:
  topology: Layer3
  layer3:
    role: Primary
    subnets:
      - cidr: 10.101.0.0/16
        hostSubnet: 24
---
apiVersion: k8s.ovn.org/v1
kind: ClusterNetworkConnect
metadata:
  name: shop-to-bank
spec:
  connectivity:
    - ServiceNetwork
  connectSubnets:
    - cidr: 100.88.0.0/16
      networkPrefix: 24
  networkSelectors:
    - networkSelectionType: PrimaryUserDefinedNetworks
      primaryUserDefinedNetworks:
        namespaceSelector:
          matchLabels:
            connect: shop-bank`,
      },
      playByStory: {
        do: {
          lines: [
            ["cmd", "$ oc get network.operator cluster -o jsonpath='{.spec.defaultNetwork.type}'"],
            ["ok", "OVNKubernetes"],
            ["cmd", "$ oc apply -f first-udn.yaml   # copy from the left"],
            ["ok", "namespace/udn-lab-shop created"],
            ["ok", "userdefinednetwork.k8s.ovn.org/shop-net created"],
            ["cmd", "$ oc get udn,nad -n udn-lab-shop"],
            ["ok", "shop-net   Layer3   Primary   NetworkReady"],
            ["ok", "nad/shop-net   # OVN minted this. you did not apply a NAD"],
            ["cmd", "$ oc get pod shop-web -n udn-lab-shop -o wide"],
            ["ok", "shop-web   10.100.0.12   # not 10.128.x — that is the island"],
            ["dim", "Cleanup: oc delete ns udn-lab-shop"],
          ],
        },
        tenant: {
          lines: [
            ["cmd", "$ oc apply -f tenant-a.yaml   # ns + CUDN + pod from the left"],
            ["ok", "namespace/udn-lab-tenant-a created"],
            ["ok", "clusteruserdefinednetwork.k8s.ovn.org/tenant-a created"],
            ["cmd", "$ oc get cudn tenant-a"],
            ["ok", "tenant-a   Layer3   Primary   NetworkReady"],
            ["cmd", "$ oc get pod web -n udn-lab-tenant-a -o wide"],
            ["ok", "web   10.110.0.8"],
            ["dim", "Make a second tenant with tenant: b and a different CUDN. Ping across fails."],
            ["err", "Do not leave namespaceSelector empty. That selects openshift-* too."],
          ],
        },
        vm: {
          lines: [
            ["cmd", "$ oc get hyperconverged -A"],
            ["ok", "openshift-cnv   kubevirt-hyperconverged   # skip this story if missing"],
            ["cmd", "$ oc apply -f vm-switch.yaml"],
            ["ok", "clusteruserdefinednetwork.k8s.ovn.org/vm-switch created"],
            ["cmd", "$ oc get cudn vm-switch"],
            ["ok", "vm-switch   Layer2   Primary   NetworkReady"],
            ["dim", "Create a VM in udn-lab-virt. Live-migrate it. The IP stays. That is Layer2 + Persistent."],
            ["err", "Layer3 primary is the wrong topology for that VM."],
          ],
        },
        vlan: {
          lines: [
            ["cmd", "$ oc get nncp,nns"],
            ["ok", "# look for a localnet / bridge-mapping name"],
            ["cmd", "$ # edit physicalNetworkName in the YAML to match YOUR mapping"],
            ["cmd", "$ oc apply -f vlan20.yaml"],
            ["ok", "clusteruserdefinednetwork.k8s.ovn.org/vlan20 created"],
            ["cmd", "$ oc get cudn vlan20"],
            ["ok", "vlan20   Localnet   Secondary   NetworkReady"],
            ["err", "No mapping? Do not apply. Role Primary on Localnet is rejected."],
          ],
        },
        talk: {
          lines: [
            ["cmd", "$ oc apply -f two-islands.yaml   # two ns + two UDNs from the left"],
            ["ok", "userdefinednetwork.k8s.ovn.org/shop-net created"],
            ["ok", "userdefinednetwork.k8s.ovn.org/bank-net created"],
            ["cmd", "$ # create a pod in each ns, expose bank as ClusterIP, THEN apply the CNC"],
            ["cmd", "$ oc apply -f shop-to-bank-cnc.yaml"],
            ["ok", "clusternetworkconnect.k8s.ovn.org/shop-to-bank created"],
            ["dim", "curl bank-api.udn-lab-bank.svc from shop — should work (ServiceNetwork)."],
            ["err", "ping of the bank pod IP still fails. NetworkPolicy would not have connected them."],
          ],
        },
      },
      onPlay: () => {
        scene.extra.story = scene.extra.story || "tenant";
        state.done.add("field");
        persist();
        renderNav();
        fieldPing();
      },
      controls: () => {
        const story = scene.extra.story || "tenant";
        const pick = (id, label) => ["chip", label, () => pickStory(id), () => story === id];
        const base = [
          pick("do", "Your first UDN"),
          pick("tenant", "SaaS tenants"),
          pick("vm", "VMs + migrate"),
          pick("vlan", "Existing VLAN"),
          pick("talk", "Two apps, one API"),
        ];
        const extra = {
          do: [
            ["chip", "Apply UDN", () => { scene.extra.applied = true; scene.extra.trap = false; paint(); log("Island is up. Ping hallway vs island."); }, () => !!scene.extra.applied],
            ["chip", "Ping", fieldPing],
            ["chip", "Pods first (trap)", () => { scene.extra.trap = true; scene.extra.applied = false; paint(); log("Rejected. Birth-only label. Immutable CR. New namespace."); }],
          ],
          tenant: [
            ["chip", "Ping", fieldPing],
            ["chip", "Empty selector", () => { scene.extra.emptySel = !scene.extra.emptySel; paint(); log(scene.extra.emptySel ? "You selected every namespace. Including openshift-*. Undo this." : "Selector is explicit again. tenant: a only."); }, () => !!scene.extra.emptySel],
          ],
          vm: [
            ["chip", "Live migrate", () => { scene.extra.moved = !scene.extra.moved; paint(); log(scene.extra.moved ? "Same IP .50." : "Back on node-a."); }],
            ["chip", "Try Layer 3", () => { scene.extra.l3try = !scene.extra.l3try; scene.extra.moved = true; paint(); log(scene.extra.l3try ? "New subnet. New IP. Virt hates this." : "Back to Layer 2. IP stays."); }, () => !!scene.extra.l3try],
          ],
          vlan: [
            ["chip", "Ping VLAN", fieldPing],
            ["chip", "Break mapping", () => { scene.extra.mapped = scene.extra.mapped === false; paint(); }, () => scene.extra.mapped === false],
            ["chip", "Make primary (trap)", () => { scene.extra.makePrimary = true; paint(); log("Localnet role Primary is rejected. Secondary only."); }],
          ],
          talk: [
            ["chip", "Build CNC", () => { scene.extra.bridged = true; scene.extra.conn = "ServiceNetwork"; paint(); log("ServiceNetwork is up. Ping the pod — splash. Click the svc."); }, () => !!scene.extra.bridged],
            ["chip", "Ping pod", () => { scene.extra.pingSvc = false; fieldPing(); }],
            ["chip", "Ping Service", () => { scene.extra.pingSvc = true; fieldPing(); }],
            ["chip", "PodNetwork", () => { scene.extra.bridged = true; scene.extra.conn = "PodNetwork"; paint(); log("Pod IPs can talk. You merged the islands."); }, () => scene.extra.conn === "PodNetwork"],
          ],
        };
        return base.concat(extra[story] || extra.tenant);
      },
      quiz: {
        q: "Empty CUDN namespaceSelector means…",
        options: [["A", "No namespaces"], ["B", "All namespaces — including platform"], ["C", "Only unlabeled ones"]],
        ok: 1,
        why: "Empty selector is the nuclear option. Match explicit tenant labels.",
      },
    },
    done: {
      html: `<p>You finished a cartoon about overlay isolation. That is a weird flex and also the correct one.</p>
        <p>You can now hear <em>"we'll just use NetworkPolicy"</em> and not flinch. You will flinch later, in the parking lot, at <em>"empty selector should be fine."</em></p>
        <p class="dim">Your prize is posture. Click the four lies on the left until they are dead. Then take the call. Sound like you billed for this. You did. In clicks.</p>`,
      legend: [["#c9a8ff", "the diploma"], ["#9b7ad4", "the lies"]],
      yaml: `# Certificate of UserDefinedCompetence
# unsigned. OVN-Kubernetes does not HR.
apiVersion: k8s.ovn.org/v1
kind: UserDefinedNetwork
metadata:
  name: your-career
  namespace: ns-te
  annotations:
    joke: "this CR is immutable. so is your new personality."
spec:
  topology: Layer3
  layer3:
    role: Primary
    subnets:
      - cidr: 10.finished.0.0/16
        hostSubnet: 24
# if this applies, you used a fake CIDR. do not.`,
      play: {
        lines: [
          ["cmd", "$ oc get diploma"],
          ["err", "error: the server doesn't have a resource type \"diploma\""],
          ["cmd", "$ oc annotate ego knows-udn=true"],
          ["ok", "ego annotated"],
          ["cmd", "$ oc logs deploy/customer --tail=1"],
          ["dim", "so… NetworkPolicy then?"],
          ["ok", "you already have the answer. that is the ovation."],
        ],
      },
      onPlay: async () => {
        const svg = scene.extra.svg;
        if (!svg) return;
        const bursts = [
          [{ x: 90, y: 500 }, { x: 450, y: 40 }],
          [{ x: 810, y: 500 }, { x: 500, y: 50 }],
          [{ x: 90, y: 40 }, { x: 780, y: 200 }],
          [{ x: 810, y: 80 }, { x: 200, y: 300 }],
          [{ x: 450, y: 500 }, { x: 450, y: 80 }],
        ];
        for (const [a, b] of bursts) {
          fly(svg, a, b, { color: T.lime, dur: 650 });
          await sleep(90);
        }
        log("That was the ovation. It was packets. The cluster filed them under noise.");
      },
      controls: [
        ["chip", "Refuse all four", () => {
          scene.extra.lies = { reg: true, sel: true, ln: true, np: true };
          paint();
          log("All four lies are dead. You may now be trusted with a whiteboard.");
        }, () => {
          const l = scene.extra.lies || {};
          return l.reg && l.sel && l.ln && l.np;
        }],
        ["chip", "Encore (intro)", () => go(0)],
        ["chip", "Back to the call", () => go(10)],
      ],
    },
  };

  const K = window.UDN_KNOWLEDGE || { sessions: {}, chunks: [] };
  const DOUBTS = K.sessions;

  const DOUBT_STOP = new Set(["the", "a", "an", "is", "are", "to", "of", "for", "in", "on", "and", "or", "can", "i", "my", "me", "does", "do", "what", "why", "how", "when", "with", "from", "that", "this", "it", "be", "vs", "please", "explain", "tell", "about", "just", "wrong", "would", "get"]);
  const DOUBT_SYN = [
    ["layer2", "layer 2", "layer-2", "l2", "logical switch", "virtual switch"],
    ["layer3", "layer 3", "layer-3", "l3", "hostsubnet", "host subnet", "per-node"],
    ["localnet", "vlan", "physical", "underlay", "ovs", "physicalnetworkname"],
    ["cudn", "clusteruserdefinednetwork", "cluster-scoped", "cluster user defined"],
    ["udn", "userdefinednetwork", "user-defined", "user defined network"],
    ["cnc", "clusternetworkconnect", "network connect", "connect islands"],
    ["primary", "eth0", "front door", "main interface"],
    ["secondary", "eth1", "annotation", "extra nic"],
    ["nad", "networkattachmentdefinition"],
    ["migrate", "live migrate", "live-migrate", "live migration"],
    ["persistent", "ipam", "persistent ip"],
    ["selector", "empty selector", "namespaceselector"],
    ["dns", "nslookup", "coredns"],
    ["registry", "image-registry", "s2i", "new-app"],
    ["networkpolicy", "network policy"],
    ["label", "k8s.ovn.org/primary-user-defined-network"],
    ["vm", "virtual machine", "virtualization", "kubevirt"],
  ];

  function doubtExpand(q) {
    let s = " " + q.toLowerCase() + " ";
    for (const g of DOUBT_SYN) {
      if (g.some((p) => s.includes(p))) s += " " + g.join(" ");
    }
    return s;
  }

  function scoreChunk(q, chunk, sid) {
    const hay = (chunk.title + " " + (chunk.keys || "") + " " + chunk.text).toLowerCase();
    const title = chunk.title.toLowerCase();
    const keys = (chunk.keys || "").toLowerCase();
    const qe = doubtExpand(q);
    const qt = qe.toLowerCase().replace(/[^a-z0-9.#/-]+/g, " ").trim().split(/\s+/).filter((w) => w.length > 1 && !DOUBT_STOP.has(w));
    if (!qt.length) return 0;
    let score = 0;
    let hits = 0;
    for (const t of qt) {
      if (title.includes(t)) { score += 5; hits += 1; }
      else if (keys.includes(t)) { score += 3.2; hits += 1; }
      else if (hay.includes(t)) { score += 1.1; hits += 1; }
    }
    if (qe.includes("layer 2") && hay.includes("layer 2")) score += 6;
    if (qe.includes("layer 3") && hay.includes("layer 3")) score += 6;
    if (/(localnet|vlan)/.test(qe) && hay.includes("localnet")) score += 7;
    if (/(cudn|clusteruserdefined)/.test(qe) && /cudn|clusteruserdefined/.test(hay)) score += 5;
    if (/(hostsubnet|host subnet)/.test(qe) && hay.includes("hostsubnet")) score += 8;
    if (/(vm|virtual)/.test(qe) && /(layer 3|layer3|l3)/.test(qe) && /(migrate|persistent|layer 2)/.test(hay)) score += 14;
    if (hits < 2 && score < 8) return 0;
    if ((chunk.sessions || []).includes(sid)) score *= 1.18;
    return score;
  }

  function doubtRecap(id) {
    const d = DOUBTS[id];
    return d ? d.recap : "";
  }

  function answerDoubt(raw) {
    const q = (raw || "").trim();
    const sid = SESSIONS[state.i].id;
    const ql = q.toLowerCase();
    const recapish = /^(help|confused|idk|huh|\?)$|don'?t understand|dont understand|what is this session|explain this session|explain this$|i('m| am) stuck|i don't get it/.test(ql);
    if (!q || recapish) {
      return { text: doubtRecap(sid) + "\n\nAsk a specific piece from this session. Answers are taken from OpenShift 4.22 and OVN-Kubernetes docs.", jump: null, source: null };
    }
    const ranked = (K.chunks || []).map((c) => ({ c, score: scoreChunk(q, c, sid) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (!ranked.length || ranked[0].score < 5) {
      return {
        text: "I don't have a doc passage that matches that wording.\n\n" + doubtRecap(sid) + "\n\nTry a starter chip, or ask with product words: Layer2, Layer3, hostSubnet, Localnet, CUDN, primary-user-defined-network, ClusterNetworkConnect, Persistent IPAM.",
        jump: null,
        source: null,
      };
    }
    const top = ranked[0].c;
    const second = ranked[1] && ranked[1].score > ranked[0].score * 0.5 ? ranked[1].c : null;
    let text = top.text;
    if (second && second.text && second.text !== top.text) text += "\n\nAlso: " + second.text;
    const other = (top.sessions || []).find((id) => id !== sid);
    const jump = (!(top.sessions || []).includes(sid) && other) ? SESSIONS.find((x) => x.id === other) : null;
    return { text, jump, source: top.url ? { title: top.src, url: top.url } : null };
  }

  /* parked old keyword FAQs — unused
    why: {
      recap: "Default OpenShift: every pod shares one Layer-3 overlay (the hallway). NetworkPolicy can filter traffic on that hallway. It does not create a second network. Use UDN when a tenant needs its own isolated network, its own subnet, or a VM needs a switch as eth0.",
      chips: ["Why not just NetworkPolicy?", "What is the default network?", "When do I actually need UDN?"],
      faqs: [
        { keys: ["networkpolicy", "policy", "already have policy", "why udn", "why not"], a: "NetworkPolicy is a filter on one shared network. UDN is a different network. Policy can stop shop from talking to bank on the hallway. It cannot give bank a private street. If the customer only needs 'deny that namespace', policy is enough. If they need isolation, custom CIDRs, or a VM primary NIC, that is UDN." },
        { keys: ["default network", "hallway", "cluster network", "ovn overlay", "10.128"], a: "The default cluster network is the OVN-Kubernetes pod network every namespace gets unless you replace it. Pods get IPs like 10.128.x. Platform namespaces (openshift-*) stay on this mainland. A primary UDN takes a tenant namespace off that hallway and puts it on its own island." },
        { keys: ["when", "need udn", "use case", "customer"], a: "Reach for UDN when: tenants must not share a network, the app brings its own subnet, or OpenShift Virtualization needs live-migrate without changing IP. Do not sell UDN as a prettier NetworkPolicy." },
      ],
    },
    islands: {
      recap: "Each primary UDN is an island. Same island: pods can talk. Different islands: no path. Overlapping CIDRs are allowed because they are different networks. NetworkPolicy cannot build a bridge between islands.",
      chips: ["Can two UDNs use the same CIDR?", "Why can't A ping B?", "Where do openshift-* namespaces live?"],
      faqs: [
        { keys: ["same cidr", "overlap", "same subnet", "same ip", "10.100"], a: "Yes. Two primary UDNs can both use 10.100.0.0/16. Isolation is the network object, not unique numbers. Two pods can even hold 10.100.1.7 on different islands and never meet. Ping fails with 'network unreachable' — there is no route." },
        { keys: ["ping", "no path", "cannot talk", "unreachable", "isolated"], a: "Different primary UDNs have no path until an admin creates ClusterNetworkConnect (session 09). A NetworkPolicy that 'allows' the other namespace is valid YAML and still useless — there is no road to allow." },
        { keys: ["mainland", "openshift", "default", "platform"], a: "openshift-* and similar platform namespaces stay on the default cluster network (the mainland). Do not select them into a tenant CUDN. Tenants live on islands. The platform stays on the hallway so operators, DNS, and the API keep working." },
      ],
    },
    roles: {
      recap: "Primary = eth0 for every pod in that namespace. One primary per namespace. The namespace must be created with the primary-UDN label. Secondary = extra NIC, only if the pod asks (Multus annotation). You can have several secondaries.",
      chips: ["Primary vs secondary?", "What is the namespace label?", "How do I attach eth1?"],
      faqs: [
        { keys: ["primary", "eth0", "front door", "how many"], a: "Primary is the default interface (eth0) for every pod in the namespace. Exactly one primary per namespace. You do not annotate pods for it — they get it because they were born in that namespace." },
        { keys: ["secondary", "eth1", "annotation", "opt-in", "cni.cncf"], a: "Secondary is extra. Annotate the pod with k8s.v1.cni.cncf.io/networks: <network-name>. No annotation, no eth1. Use secondary for an extra VLAN, a management NIC, or Localnet. Never try to make Localnet the primary." },
        { keys: ["label", "k8s.ovn.org/primary-user-defined-network", "birth", "namespace"], a: "Create the namespace WITH the label k8s.ovn.org/primary-user-defined-network: \"\". You cannot add that label later. Existing namespaces with pods cannot be converted to a primary UDN. New project, or live on the default network." },
      ],
    },
    scope: {
      recap: "UserDefinedNetwork (UDN) lives in one namespace — tenant-sized. ClusterUserDefinedNetwork (CUDN) is cluster-scoped, admin-only, and selects namespaces by label. An empty selector matches everything, including default and openshift-*.",
      chips: ["UDN vs CUDN?", "Who creates a CUDN?", "What if the selector is empty?"],
      faqs: [
        { keys: ["udn vs", "difference", "namespace-scoped", "cluster-scoped", "when cudn", "when udn"], a: "UDN: one namespace defines its own network. Good for a single project. CUDN: cluster admin defines one network and selects many namespaces (shop + shop-api share a network). CUDN is the tool for multi-namespace tenants. Developers should not create CUDNs." },
        { keys: ["empty selector", "match all", "openshift", "default", "nuclear"], a: "namespaceSelector: {} matches all namespaces. That can put default and openshift-* on a tenant network and break the cluster or leak isolation. Always match an explicit tenant label, for example tenant: shop." },
        { keys: ["who", "admin", "rbac", "developer"], a: "CUDN is cluster-scoped. Cluster admin only. A developer in one project should use a namespace UDN, if they are even allowed to. Wrong CUDN selector is a security incident, not a style choice." },
      ],
    },
    topo: {
      recap: "Ask one question: if this workload moves to another node, does the IP stay? Layer 3: each node is a different street, packets use a router, IP would change — use for pods. Layer 2: one virtual switch, same subnet, IP stays — use for VMs that live-migrate. Localnet: extra NIC on a real VLAN, Secondary only, never primary.",
      chips: ["Layer 2 vs Layer 3?", "Why not Layer 3 for VMs?", "What is Localnet?", "What is hostSubnet?"],
      faqs: [
        { keys: ["layer 2 vs", "l2 vs", "difference", "layer3 vs", "switch", "router", "street"], a: "Layer 3 = routed. worker-a gets 10.100.1.x, worker-b gets 10.100.2.x. To talk, you go through a router. Layer 2 = one switch. Everyone is on 192.168.100.x. No router between nodes. Pick Layer 3 for pods. Pick Layer 2 when a VM must move and keep the same IP." },
        { keys: ["live migrate", "live-migrate", "vm move", "same ip", "mac", "why layer 2", "why l2"], a: "On Layer 3 a move means a new street, so a new IP. Live migration must keep IP and MAC or TCP sessions die. Layer 2 is one switch spanning nodes, so the VM changes node and keeps .50. That is why Virtualization uses Layer 2 as primary, often with ipam.lifecycle: Persistent." },
        { keys: ["layer 3", "l3", "pods", "hostsubnet", "per-node", "routed"], a: "Layer 3 carves the UDN CIDR into a slice per node (hostSubnet: 24 on a /16 means each node gets a /24). Pods scale this way. The cost: a workload that moves node would need a new IP. Fine for pods. Awkward for VMs." },
        { keys: ["localnet", "vlan", "physical", "bare metal", "ovs", "physicalnetworkname", "secondary only"], a: "Localnet is not an OVN overlay island. The extra NIC is bridged onto a real datacenter VLAN so a VM can talk to bare metal on that VLAN. Role must be Secondary. physicalNetworkName must match the OVS bridge mapping on the nodes. Wrong name = wrong cable. It cannot be a primary UDN." },
        { keys: ["broadcast", "scale", "tradeoff", "trade-off"], a: "Layer 2 one-switch means the broadcast domain is cluster-wide. That is the trade-off. It is the right tool for VMs that migrate. It is the wrong default for thousands of pods — use Layer 3 there." },
        { keys: ["persistent", "ipam"], a: "ipam.lifecycle: Persistent keeps the same IP for a VM across stop/start and live migrate on Layer 2. Use it on the VM primary CUDN. It does not turn Layer 3 into a migratable switch." },
      ],
    },
    lab: {
      recap: "Order is law: 1) create the namespace WITH the primary-UDN label, 2) create the UDN/CUDN CR, 3) create pods. The CR is immutable. The label cannot be added later. OVN will not re-home running pods. Behind the scenes OVN mints a NetworkAttachmentDefinition (NAD).",
      chips: ["What is the create order?", "Can I add UDN to an existing namespace?", "What is a NAD?"],
      faqs: [
        { keys: ["order", "steps", "sequence", "label first"], a: "1) Namespace + k8s.ovn.org/primary-user-defined-network at create time. 2) UserDefinedNetwork or ClusterUserDefinedNetwork. Wait for NetworkReady. 3) Then pods. Reverse that and you start over." },
        { keys: ["existing", "already has pods", "add later", "hot-swap", "immutable", "patch"], a: "No. You cannot add a primary UDN to a namespace that already has pods. You cannot add the birth label later. You cannot patch topology or subnets on the CR. New namespace, recreate workloads, or stay on the default network." },
        { keys: ["nad", "networkattachmentdefinition", "mint"], a: "You create the UDN CR. OVN-Kubernetes creates a NetworkAttachmentDefinition for you. That NAD is what CNI actually attaches. oc get udn,nad -n <ns> — if the NAD is missing, the UDN is not ready." },
      ],
    },
    gotchas: {
      recap: "Four tickets you will get: DNS for pods still returns the default-network IP. The in-cluster image registry often cannot be reached from a UDN. NetworkPolicy between different primary UDNs does nothing. Kubelet probes can show Ready while the UDN NIC is down.",
      chips: ["Why is DNS wrong?", "Why can't I pull images?", "Does NetworkPolicy work across UDNs?"],
      faqs: [
        { keys: ["dns", "nslookup", "core dns", "service dns", "wrong ip"], a: "Service DNS still works (ClusterIP). Pod DNS lookups often return the default-network IP, not the UDN IP. Do not teach customers to ping pod DNS across a UDN. Use Services, or talk UDN IPs you already know." },
        { keys: ["registry", "image", "pull", "s2i", "new-app", "imagestream"], a: "image-registry lives on the mainland (openshift-image-registry). Primary UDN pods often cannot reach it. Builds, S2I, and oc new-app break. Workaround: mirror to an external registry the UDN can reach, or don't promise in-cluster registry from a UDN." },
        { keys: ["networkpolicy", "policy", "allow", "across"], a: "NetworkPolicy cannot create a path between two primary UDNs. The object applies; traffic still has nowhere to go. To connect islands you need ClusterNetworkConnect (session 09), not a policy." },
        { keys: ["ready", "probe", "health", "kubelet"], a: "Kubelet probes use the default network. A pod can be Ready with a dead UDN interface. Do not trust Ready as proof that the island NIC works. Check the UDN IP with oc exec -- ip -br addr." },
      ],
    },
    virt: {
      recap: "VMs that live-migrate want Layer 2 as the primary NIC, with Persistent IPAM, so IP and MAC stay. Localnet is how you hang an extra NIC on a datacenter VLAN — Secondary CUDN, not primary.",
      chips: ["Why Layer 2 for VMs?", "What is Persistent IPAM?", "Where does Localnet attach?"],
      faqs: [
        { keys: ["migrate", "same ip", "layer 2", "primary nic"], a: "Live migration moves the VM to another node. Layer 2 keeps it on the same switch, so 192.168.100.50 stays 192.168.100.50. Layer 3 would hand it a new subnet. TCP sessions and licenses that bind to IP depend on this." },
        { keys: ["persistent", "ipam", "stop", "start"], a: "ipam.lifecycle: Persistent reserves the address so stop/start and migrate do not reshuffle IPs. Put it on the Layer 2 primary CUDN that the VMs use." },
        { keys: ["localnet", "vlan", "secondary"], a: "Localnet attaches as a secondary NIC (or NAD), not as the VM primary UDN. Primary = Layer 2 overlay for migrate. Extra NIC = Localnet onto the physical VLAN. Two jobs, two networks." },
      ],
    },
    connect: {
      recap: "Islands stay silent until an admin creates ClusterNetworkConnect. ServiceNetwork exposes ClusterIPs across the selected networks — start here. PodNetwork lets pod IPs talk across — wider, more risk.",
      chips: ["What is ClusterNetworkConnect?", "ServiceNetwork vs PodNetwork?", "Who can create it?"],
      faqs: [
        { keys: ["clusternetworkconnect", "cnc", "connect", "bridge"], a: "ClusterNetworkConnect is the admin CR that builds a path between otherwise isolated networks. Without it, ping between primary UDNs fails. Isolation is the default; connect is explicit." },
        { keys: ["servicenetwork", "podnetwork", "safest", "clusterip"], a: "ServiceNetwork: the other side can reach ClusterIP Services, not every pod IP. Start here when two tenants must share an API. PodNetwork: pod IPs on both sides can talk. That is a bigger hole. Do not open PodNetwork because ping would be easier." },
        { keys: ["admin", "who"], a: "CNC is cluster-scoped. Admin only. A tenant cannot punch a hole from their namespace UDN by themselves — that is the point of isolation." },
      ],
    },
    field: {
      recap: "On the call: labeled namespace at create? UDN vs CUDN? Topology matches the workload (pods L3, VMs L2, VLAN Localnet secondary)? Do not promise registry, S2I, or NetworkPolicy across islands. Two islands that must talk: CNC ServiceNetwork first. Never ship an empty CUDN selector.",
      chips: ["SaaS tenants?", "VMs that migrate?", "They already have a VLAN?", "Two apps must share an API?"],
      faqs: [
        { keys: ["saas", "tenant", "multi-tenant"], a: "CUDN per tenant label, Layer 3 primary, explicit matchLabels. Say out loud: overlapping CIDRs are fine; they will not reach each other; registry and S2I may break." },
        { keys: ["vm", "migrate", "virt"], a: "Layer 2 primary CUDN, Persistent IPAM. If they also need a datacenter VLAN, add Localnet as Secondary. Do not make Localnet the primary." },
        { keys: ["vlan", "bare metal", "physical"], a: "Localnet secondary CUDN. physicalNetworkName must match the OVS mapping. Role Secondary. This stitches to the existing VLAN; it does not replace the VM primary network." },
        { keys: ["api", "two apps", "talk", "share"], a: "Keep two primary UDNs. Add ClusterNetworkConnect with ServiceNetwork so they can hit the API Service. Do not merge the address spaces with PodNetwork unless they truly need pod-IP reachability." },
        { keys: ["empty", "selector", "checklist"], a: "Empty CUDN selector = all namespaces, including platform. Always match a tenant label. That is the first thing you inspect in a bad CUDN ticket." },
      ],
    },
  };

  const DOUBT_GLOBAL = [
    { keys: ["#", "hash", "comment", "yaml comment", "what is hash"], a: "In the example CR, a line starting with # is a YAML comment. The cluster ignores it. It is there so you can read WHAT the field is and WHY it exists." },
    { keys: ["what is udn", "user defined network", "userdefinednetwork"], a: "A UserDefinedNetwork is an OVN-Kubernetes CR that creates an isolated Layer-2 or Layer-3 network. As primary, it becomes eth0 for pods in that namespace instead of the default cluster network." },
    { keys: ["ovn", "ovn-kubernetes", "cni"], a: "UDN is an OVN-Kubernetes feature. The default OpenShift pod network is already OVN. UDN asks OVN for extra isolated logical networks, not a second CNI product." },
    { keys: ["help", "stuck", "confused", "don't understand", "dont understand", "explain", "what is this session", "i don't get"], a: null },
  ];

  function doubtTokens(s) {
    return s.toLowerCase().replace(/[^a-z0-9.#/-]+/g, " ").trim().split(/\s+/).filter((w) => w.length > 1);
  }

  function doubtScore(q, keys) {
    const ql = q.toLowerCase();
    const compact = ql.replace(/[^a-z0-9]+/g, "");
    const qt = doubtTokens(q);
    let s = 0;
    for (const k of keys) {
      const kl = k.toLowerCase();
      if (ql.includes(kl)) s += 5 + Math.min(8, kl.length / 3);
      const kc = kl.replace(/[^a-z0-9]+/g, "");
      if (kc.length > 3 && compact.includes(kc)) s += 3;
    }
    const bag = new Set(keys.join(" ").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    for (const t of qt) if (bag.has(t)) s += 1.2;
    return s;
  }

  function doubtRecap(id) {
    const d = DOUBTS[id];
    return d ? d.recap : "";
  }

  function answerDoubt(raw) {
    const q = (raw || "").trim();
    const sid = SESSIONS[state.i].id;
    const here = DOUBTS[sid];
    const ql = q.toLowerCase();
    const recapish = /^(help|confused|idk|huh|\?)$|don'?t understand|dont understand|what is this session|explain this session|explain this$|i('m| am) stuck|i don't get it/.test(ql);
    if (!q || recapish) {
      return { text: doubtRecap(sid) + "\n\nAsk a specific piece: a field, a topology, or 'why would ping fail'.", jump: null };
    }

    let best = { score: 0, a: "", session: sid, jump: null };
    if (here) {
      for (const f of here.faqs) {
        const sc = doubtScore(q, f.keys) + 3;
        if (sc > best.score) best = { score: sc, a: f.a, session: sid, jump: null };
      }
    }
    for (const f of DOUBT_GLOBAL) {
      const sc = doubtScore(q, f.keys);
      if (sc > best.score) best = { score: sc, a: f.a || doubtRecap(sid), session: sid, jump: null };
    }
    for (const [id, pack] of Object.entries(DOUBTS)) {
      if (id === sid) continue;
      for (const f of pack.faqs) {
        const sc = doubtScore(q, f.keys);
        if (sc > best.score) {
          const sess = SESSIONS.find((x) => x.id === id);
          best = { score: sc, a: f.a, session: id, jump: sess };
        }
      }
    }

    if (best.score < 4.5) {
      return {
        text: "I don't have that exact question in this classroom.\n\n" + doubtRecap(sid) + "\n\nTry a starter chip, or ask about Layer 2 / 3, Localnet, primary vs secondary, UDN vs CUDN, create order, DNS, or ClusterNetworkConnect.",
        jump: null,
      };
    }
    if (best.jump && best.jump.id !== sid) {
      return { text: best.a + "\n\nThat is covered in " + best.jump.kicker + " — " + best.jump.title + ".", jump: best.jump };
    }
    return { text: best.a, jump: null };
  }
  */

  let doubtBound = false;
  let doubtFor = null;

  function doubtOpen(open) {
    const wrap = $("doubt");
    const pop = $("doubt-pop");
    const tab = $("doubt-toggle");
    wrap.classList.toggle("open", open);
    pop.hidden = !open;
    tab.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) setTimeout(() => $("doubt-q").focus(), 40);
  }

  function doubtPush(kind, text, jump, source) {
    const thread = $("doubt-thread");
    const el = document.createElement("div");
    el.className = "doubt-msg " + kind;
    el.appendChild(document.createTextNode(text));
    if (source && source.url) {
      const a = document.createElement("a");
      a.className = "src";
      a.href = source.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Doc: " + source.title;
      el.appendChild(a);
    }
    if (jump) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "jump";
      b.textContent = "Open " + jump.kicker;
      b.addEventListener("click", () => { go(SESSIONS.findIndex((s) => s.id === jump.id)); });
      el.appendChild(document.createElement("br"));
      el.appendChild(b);
    }
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
  }

  function doubtWelcome(s) {
    const thread = $("doubt-thread");
    thread.innerHTML = "";
    doubtPush("te", "This session: " + s.title + ".\n\n" + doubtRecap(s.id) + "\n\nAnswers come from OpenShift 4.22 and OVN-Kubernetes docs. Type a doubt, or tap a starter question.");
  }

  function renderDoubtChips(s) {
    const box = $("doubt-suggest");
    box.innerHTML = "";
    const chips = (DOUBTS[s.id] && DOUBTS[s.id].chips) || [];
    chips.forEach((label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", () => askDoubt(label));
      box.appendChild(b);
    });
  }

  function syncDoubt() {
    const s = SESSIONS[state.i];
    $("doubt-session").textContent = s.kicker + " · " + s.title;
    if (doubtFor !== s.id) {
      const prev = doubtFor;
      doubtFor = s.id;
      renderDoubtChips(s);
      if (!prev || !$("doubt").classList.contains("open")) doubtWelcome(s);
      else doubtPush("te", "Now on " + s.kicker + " — " + s.title + ".\n\n" + doubtRecap(s.id));
    }
  }

  function askDoubt(text) {
    const q = (text || "").trim();
    if (!q) return;
    $("doubt-q").value = "";
    doubtOpen(true);
    doubtPush("you", q);
    const ans = answerDoubt(q);
    doubtPush("te", ans.text, ans.jump, ans.source);
  }

  function bindDoubt() {
    if (doubtBound) return;
    doubtBound = true;
    $("doubt-toggle").addEventListener("click", () => doubtOpen(true));
    $("doubt-close").addEventListener("click", () => doubtOpen(false));
    $("doubt-form").addEventListener("submit", (e) => {
      e.preventDefault();
      askDoubt($("doubt-q").value);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && $("doubt").classList.contains("open")) doubtOpen(false);
    });
  }

  /* duplicate lesson block parked so the parser stays happy
    islands: {
      html: `<p>Draw islands. Same island talks. Different islands have <strong>no path</strong>. The default cluster network is the mainland — platform namespaces live there.</p>
        <p class="dim">Both islands may use <code>10.100.0.0/16</code>. Overlapping CIDRs are allowed because they are different networks. Two pods can even hold the same IP and never meet.</p>
        <p>NetworkPolicy is for microsegmentation <em>inside</em> the island. It cannot punch a hole across the water.</p>`,
      legend: [["#c9a8ff", "blue UDN"], ["#9b7ad4", "red UDN"], ["#9b7ad4", "mainland"]],
      controls: [["chip", "Ping selected", islandPing]],
      quiz: {
        q: "Two primary UDNs, same subnet, both pods got .7. Can A ping B?",
        options: [
          ["A", "Yes — same IP means same network."],
          ["B", "No path. Overlapping CIDRs are fine. Islands stay isolated."],
          ["C", "OVN rejects the second UDN."],
        ],
        ok: 1,
        why: "Correct. Same numbers, different worlds.",
      },
    },
    roles: {
      html: `<p><strong>Primary</strong> is automatic: every pod in the namespace gets it as eth0. One primary per namespace. The namespace must be created with <code>k8s.ovn.org/primary-user-defined-network</code>.</p>
        <p><strong>Secondary</strong> is opt-in: annotate the pod with <code>k8s.v1.cni.cncf.io/networks</code>. You can attach several.</p>
        <p class="dim">Old Multus NADs still exist for other CNIs (macvlan, ipvlan). UDN is the OVN-native way to make the <em>front door</em> a custom network.</p>`,
      legend: [["#c9a8ff", "primary"], ["#c9a8ff", "secondary"]],
      controls: [
        ["chip", "Attach secondary NIC", () => { scene.extra.secondary = true; paint(); log("Secondary attached. Only pods that ask for it get eth1."); }],
        ["chip", "Detach secondary", () => { scene.extra.secondary = false; paint(); log("Back to a single front door."); }],
      ],
      quiz: {
        q: "How many primary UDNs can one namespace have?",
        options: [["A", "As many as you want"], ["B", "Exactly one"], ["C", "Zero — primary is cluster-wide only"]],
        ok: 1,
        why: "One front door. Many side docks.",
      },
    },
    scope: {
      html: `<p><code>UserDefinedNetwork</code> lives in a namespace. Tenant-sized. <code>ClusterUserDefinedNetwork</code> is cluster-scoped. Admin-only. It selects namespaces with labels and can span them.</p>
        <p class="dim">CUDN with an empty selector matches everything. That is how you accidentally put <code>default</code> and <code>openshift-*</code> on a tenant network. Don't.</p>`,
      legend: [["#c9a8ff", "shop net"], ["#9b7ad4", "bank net"]],
      controls: [
        ["chip", "Show UDN (per namespace)", () => { scene.extra.mode = "udn"; paint(); }],
        ["chip", "Show CUDN (shared)", () => { scene.extra.mode = "cudn"; paint(); }],
      ],
      quiz: {
        q: "Who should create a ClusterUserDefinedNetwork?",
        options: [["A", "Any developer in the project"], ["B", "Cluster admin only"], ["C", "The CNI itself, automatically"]],
        ok: 1,
        why: "CUDN is a cluster-wide isolation primitive. Wrong selector = security incident.",
      },
    },
    topo: {
      html: `<p><strong>Layer 3:</strong> per-node subnets, routed. Great for pods. Awkward for VM live migration.</p>
        <p><strong>Layer 2:</strong> one switch, one subnet. VMs migrate and keep IP. Broadcast domain is bigger.</p>
        <p><strong>Localnet:</strong> stitch OVN to a physical VLAN. Secondary CUDN. Match <code>physicalNetworkName</code> to the OVS bridge mapping.</p>`,
      legend: [["#c9a8ff", "L3"], ["#c9a8ff", "L2"], ["#9b7ad4", "localnet"]],
      controls: [
        ["chip", "Layer 3", () => { scene.extra.topo = "l3"; paint(); }],
        ["chip", "Layer 2", () => { scene.extra.topo = "l2"; paint(); }],
        ["chip", "Localnet", () => { scene.extra.topo = "localnet"; paint(); }],
      ],
      quiz: {
        q: "Customer wants VMs to live-migrate and keep the same IP. First topology to propose?",
        options: [["A", "Layer 3 primary"], ["B", "Layer 2 primary"], ["C", "Localnet primary"]],
        ok: 1,
        why: "L2 is the switch. Localnet is a secondary physical stitch — it cannot be primary.",
      },
    },
    lab: {
      html: `<p>Order is law:</p><ul><li>Create the namespace <em>with</em> the primary-UDN label.</li><li>Create the UDN/CUDN CR.</li><li>Then create pods.</li></ul>
        <p class="dim">The CR cannot be modified after create. The label cannot be added later. Existing pods will not be re-homed.</p>`,
      legend: [["#c9a8ff", "ready"], ["#9b7ad4", "rejected"]],
      controls: [
        ["chip", "Next correct step", () => { scene.extra.wrong = false; scene.extra.step = Math.min(3, (scene.extra.step || 0) + 1); paint(); log(["", "Namespace labeled.", "UDN created. NAD generated.", "Pods attached to the island."][scene.extra.step]); }],
        ["chip", "Trap: pods first", () => { scene.extra.wrong = true; paint(); log("This is the ticket you will get at 2am."); }],
        ["chip", "Reset", () => { scene.extra.step = 0; scene.extra.wrong = false; paint(); }],
      ],
      quiz: {
        q: "A namespace already has pods. Can you add a primary UDN to it?",
        options: [["A", "Yes, it hot-swaps eth0"], ["B", "No. Label is birth-only. Start a new namespace."], ["C", "Yes, if you restart OVN"]],
        ok: 1,
        why: "Birth-only label. Immutable CR. New project, or live with the hallway.",
      },
    },
    gotchas: {
      html: `<p>These are the tickets. Learn the pictures before the YAML.</p>
        <p class="dim">DNS lies. Registry is often unreachable. Policy between primary UDNs is a no-op. Health checks can show Ready on a dead UDN NIC. NodePort isolation is not guaranteed.</p>`,
      legend: [["#9b7ad4", "dns lie"], ["#9b7ad4", "blocked"]],
      controls: [
        ["chip", "DNS lie", () => { scene.extra.gotcha = "dns"; paint(); }],
        ["chip", "Registry blocked", () => { scene.extra.gotcha = "reg"; paint(); }],
        ["chip", "Policy between islands", () => { scene.extra.gotcha = "np"; paint(); }],
      ],
      quiz: {
        q: "A NetworkPolicy allows ns-a to ns-b. They are on different primary UDNs. What happens?",
        options: [["A", "Traffic is allowed"], ["B", "The policy does not take effect — no connectivity"], ["C", "OVN merges the subnets"]],
        ok: 1,
        why: "No path. The policy is true and useless.",
      },
    },
    virt: {
      html: `<p>OpenShift Virtualization wants Layer 2 for the VM's primary NIC so live migration does not change L3 identity. Persistent IPAM exists for that.</p>
        <p class="dim">Need a datacenter VLAN too? Secondary Localnet CUDN (GA on CUDN in 4.19+). Do not promise Localnet as a primary UDN.</p>`,
      legend: [["#c9a8ff", "L2 switch"], ["#9b7ad4", "migrate path"]],
      controls: [
        ["chip", "Live migrate", () => { scene.extra.moved = true; paint(); log("Same IP .50. Different node. That is the L2 pitch."); }],
        ["chip", "Reset VM", () => { scene.extra.moved = false; paint(); }],
      ],
      quiz: {
        q: "Where does Localnet attach for VMs?",
        options: [["A", "Primary UDN"], ["B", "Secondary CUDN (or NAD)"], ["C", "The default cluster network"]],
        ok: 1,
        why: "Localnet role is Secondary. Physical network is a side dock, not the front door — unless you designed it that way with NAD historically.",
      },
    },
    connect: {
      html: `<p>Islands stay silent until an admin creates <code>ClusterNetworkConnect</code>.</p>
        <ul><li><code>PodNetwork</code> — pod IPs talk.</li><li><code>ServiceNetwork</code> — ClusterIP only.</li></ul>
        <p class="dim">Start with ServiceNetwork. Full pod mesh is how you accidentally rebuild the one-hallway cluster.</p>`,
      legend: [["#c9a8ff", "UDN A"], ["#9b7ad4", "UDN B"], ["#c9a8ff", "connect"]],
      controls: [
        ["chip", "Build connect", () => { scene.extra.bridged = true; paint(); log("Bridge is up. Isolation is now selective."); }],
        ["chip", "ServiceNetwork only", () => { scene.extra.bridged = true; scene.extra.conn = "ServiceNetwork"; paint(); }],
        ["chip", "PodNetwork", () => { scene.extra.bridged = true; scene.extra.conn = "PodNetwork"; paint(); }],
        ["chip", "Ping pod B", () => { scene.extra.pingSvc = false; connectPing(); }],
        ["chip", "Ping Service", () => { scene.extra.pingSvc = true; connectPing(); }],
      ],
      quiz: {
        q: "Safest first connect between two tenant UDNs that must share an API?",
        options: [["A", "PodNetwork both ways"], ["B", "ServiceNetwork"], ["C", "Disable isolation globally"]],
        ok: 1,
        why: "Expose the API. Do not merge the address spaces.",
      },
    },
    field: {
      html: `<p>You are on the customer call. Pick the story. The diagram is the recommendation plus the traps you mention <em>before</em> they hit Session 07.</p>
        <p class="dim">Docs: OpenShift Multiple networks → Primary networks, plus the OVN-Kubernetes UDN OKEP if they want the why under the YAML.</p>`,
      legend: [["#c9a8ff", "do this"], ["#9b7ad4", "say this"]],
      controls: [
        ["chip", "SaaS tenants", () => { scene.extra.story = "tenant"; paint(); }],
        ["chip", "VMs + migrate", () => { scene.extra.story = "vm"; paint(); }],
        ["chip", "Existing VLAN", () => { scene.extra.story = "vlan"; paint(); }],
        ["chip", "Two apps, one API", () => { scene.extra.story = "talk"; paint(); }],
      ],
      quiz: {
        q: "Empty CUDN namespaceSelector means…",
        options: [["A", "No namespaces"], ["B", "All namespaces — including platform"], ["C", "Only unlabeled ones"]],
        ok: 1,
        why: "Empty selector is the nuclear option. Always match explicit tenant labels.",
      },
    },
  */

  function colorYaml(src) {
    return src
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/#.*/g, (m) => `<span class="note">${m}</span>`)
      .replace(/^(\s*[\w./-]+:)/gm, `<span class="k">$1</span>`)
      .replace(/("[^"]*"|'[^']*'|\b\d+\.\d+\.\d+\.\d+\/\d+|\b\d+\/\d+)/g, `<span class="v">$1</span>`);
  }

  function renderBench(L) {
    const yaml = (L.yamlByTopo && L.yamlByTopo[scene.extra.topo || "l3"])
      || (L.yamlByStory && L.yamlByStory[scene.extra.story || "tenant"])
      || L.yaml
      || "# No CR on this screen.\n# Click Play for the demo.";
    $("yaml-view").innerHTML = `<code>${colorYaml(yaml)}</code>`;
    $("yaml-view").dataset.raw = yaml;
    $("term-out").innerHTML = `<code class="term-line dim">Click Play for simulated oc output.</code>`;
    $("term-card").classList.remove("running");
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function playDemo() {
    const L = LESSONS[SESSIONS[state.i].id];
    if (typeof L.onPlay === "function") await L.onPlay();
    const play = (L.playByTopo && L.playByTopo[scene.extra.topo || "l3"])
      || (L.playByStory && L.playByStory[scene.extra.story || "tenant"])
      || L.play;
    if (!play || !play.lines) return;
    const box = $("term-out");
    const card = $("term-card");
    card.classList.add("running");
    box.innerHTML = "";
    for (const [kind, text] of play.lines) {
      const line = document.createElement("div");
      line.className = `term-line ${kind}`;
      line.textContent = text;
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
      await sleep(kind === "cmd" ? 220 : 90);
    }
    card.classList.remove("running");
    if (typeof L.afterPlay === "function") await L.afterPlay();
  }

  function renderNav() {
    const nav = $("session-nav");
    nav.innerHTML = "";
    SESSIONS.forEach((s, idx) => {
      const b = document.createElement("button");
      b.innerHTML = `<em>${s.n}</em><span>${s.title}</span>`;
      if (idx === state.i) b.classList.add("on");
      if (state.done.has(s.id)) b.classList.add("done");
      b.addEventListener("click", () => go(idx));
      nav.appendChild(b);
    });
  }

  function renderQuiz(s) {
    const box = $("quiz");
    const L = LESSONS[s.id];
    if (!L.quiz) { box.hidden = true; return; }
    box.hidden = false;
    const answered = state.quizOk[s.id];
    box.innerHTML = `<h3>Check</h3><p>${L.quiz.q}</p>` + L.quiz.options.map((o, i) =>
      `<label data-i="${i}"><strong>${o[0]}.</strong> ${o[1]}</label>`
    ).join("") + `<div class="feedback"></div>`;
    box.querySelectorAll("label").forEach((lab) => {
      lab.addEventListener("click", () => {
        if (state.quizOk[s.id]) return;
        const i = +lab.dataset.i;
        const ok = i === L.quiz.ok;
        lab.classList.add(ok ? "ok" : "bad");
        box.querySelector(".feedback").textContent = ok ? L.quiz.why : "Try another option.";
        if (ok) {
          state.quizOk[s.id] = true;
          state.done.add(s.id);
          persist();
          renderNav();
          box.querySelectorAll("label")[L.quiz.ok].classList.add("ok");
        }
      });
    });
    if (answered) {
      box.querySelectorAll("label")[L.quiz.ok].classList.add("ok");
      box.querySelector(".feedback").textContent = L.quiz.why;
    }
  }

  function paint() {
    const s = SESSIONS[state.i];
    const L = LESSONS[s.id];
    $("title").textContent = s.title;
    $("kicker").textContent = s.kicker;
    $("stage-hint").textContent = s.hint;
    $("lesson").innerHTML = L.html;
    $("progress-label").textContent = s.id === "intro" ? "Intro" : s.id === "done" ? "Finished" : `Session ${s.n} of 10`;
    $("progress-bar").style.width = `${((state.i + 1) / SESSIONS.length) * 100}%`;
    $("prev").disabled = state.i === 0;
    $("next").textContent = state.i === SESSIONS.length - 1 ? "Start over" : s.id === "intro" ? "Start session 01" : "Next";
    clearPingOut();
    if (s.id === "done") $("ping-detail").textContent = "Click a lie on the diploma. The stamp is the certificate.";
    renderBench(L);

    const legend = $("legend");
    legend.innerHTML = (L.legend || []).map(([c, t]) => `<span><b style="background:${c}"></b>${t}</span>`).join("");

    const canPing = !!pingSessions()[s.id];
    $("ping-btn").hidden = !canPing;
    $("stage-frame").classList.toggle("no-ping", !canPing && s.id !== "done");
    $("stage-frame").classList.toggle("result-only", s.id === "done");
    const extras = $("ping-extras");
    extras.innerHTML = "";

    const controls = $("controls");
    controls.innerHTML = "";
    (typeof L.controls === "function" ? L.controls() : (L.controls || [])).forEach(([kind, text, fn, isOn]) => {
      if (isPingChip(text)) {
        if (canPing && !/^ping$/i.test(text) && !/^ping selected$/i.test(text) && !/^ping vlan$/i.test(text) && !/^ping pod/i.test(text) && !/^send packet$/i.test(text)) {
          const extra = document.createElement("button");
          extra.className = "chip";
          extra.textContent = text;
          extra.addEventListener("click", fn);
          extras.appendChild(extra);
        }
        return;
      }
      const b = document.createElement("button");
      b.className = kind;
      b.textContent = text;
      if (typeof isOn === "function" && isOn()) b.classList.add("active");
      b.addEventListener("click", fn);
      controls.appendChild(b);
    });

    const stage = $("stage");
    stage.innerHTML = "";
    const drawers = { intro: sceneIntro, why: sceneWhy, islands: sceneIslands, roles: sceneRoles, scope: sceneScope, topo: sceneTopo, lab: sceneLab, gotchas: sceneGotchas, virt: sceneVirt, connect: sceneConnect, field: sceneField, done: sceneDone };
    drawers[s.id](stage);
    renderQuiz(s);
    renderNav();
    syncDoubt();
  }

  function go(i) {
    const n = SESSIONS.length;
    state.i = ((i % n) + n) % n;
    scene.selected = [];
    scene.extra = {};
    persist();
    paint();
  }

  $("prev").addEventListener("click", () => go(state.i - 1));
  $("next").addEventListener("click", () => go(state.i + 1));
  $("ping-btn").addEventListener("click", () => sessionPing());
  $("play-demo").addEventListener("click", () => playDemo());
  $("copy-yaml").addEventListener("click", async () => {
    const raw = $("yaml-view").dataset.raw || "";
    try {
      await navigator.clipboard.writeText(raw);
      $("copy-yaml").textContent = "copied";
      setTimeout(() => { $("copy-yaml").textContent = "copy"; }, 1200);
    } catch (e) {
      $("copy-yaml").textContent = "select it";
    }
  });
  bindDoubt();
  renderNav();
  paint();
})();
