/* UDN Lab — visual OpenShift classroom */
(function () {
  const $ = (id) => document.getElementById(id);

  const SESSIONS = [
    { id: "intro", n: "IN", title: "Intro", kicker: "Start here", hint: "Click Start. That is the whole guide." },
    { id: "why", n: "01", title: "Why UDN exists", kicker: "Session 01", hint: "Click two doors, then send a packet. Every pod is on the same default network." },
    { id: "islands", n: "02", title: "Isolated networks", kicker: "Session 02", hint: "Select a pod on island A and one on island B, then ping. There is no path." },
    { id: "roles", n: "03", title: "Primary vs secondary", kicker: "Session 03", hint: "Primary is eth0 for every pod. Secondary is extra, and only if you ask." },
    { id: "scope", n: "04", title: "UDN vs CUDN", kicker: "Session 04", hint: "Namespace-scoped UDN vs cluster-scoped CUDN. An empty selector matches everything." },
    { id: "topo", n: "05", title: "Layer 2, Layer 3, Localnet", kicker: "Session 05", hint: "Three pictures. Ask one question: if this workload moves to another node, does the IP stay?" },
    { id: "lab", n: "06", title: "Create order", kicker: "Session 06", hint: "Label the namespace, create the CR, then create pods. Play the happy path, then the trap." },
    { id: "gotchas", n: "07", title: "DNS, registry, policy", kicker: "Session 07", hint: "DNS still returns default-network IPs. The image registry is often unreachable. Policy cannot bridge islands." },
    { id: "virt", n: "08", title: "Virtual machines", kicker: "Session 08", hint: "Live-migrate a VM on Layer 2. The IP stays. That is the point." },
    { id: "connect", n: "09", title: "Connecting UDNs", kicker: "Session 09", hint: "Ping fails until ClusterNetworkConnect exists. Prefer ServiceNetwork first." },
    { id: "field", n: "10", title: "Customer scenarios", kicker: "Session 10", hint: "Pick a story. You get a recommendation and the limitation to mention on the call." },
    { id: "done", n: "★", title: "You did it", kicker: "Curtain call", hint: "Play the ovation. Bow. Then do not promise the image registry." },
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
    const box = $("log");
    box.hidden = false;
    box.textContent = msg;
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

  /* ---------- scenes ---------- */
  function sceneIntro(root) {
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    svg.appendChild(label(40, 70, "UDN Lab", T.lime, 42));
    svg.appendChild(label(40, 112, "OpenShift User Defined Networks. Click pictures. Ten sessions.", T.mute, 16));

    const bits = [
      { x: 40, t: "Diagram", d: "Click it." },
      { x: 320, t: "Play", d: "Fake oc." },
      { x: 600, t: "Ask a doubt", d: "Bottom right." },
    ];
    bits.forEach((b) => {
      svg.appendChild(svgEl("rect", { x: b.x, y: 170, width: 250, height: 110, rx: 16, fill: "#1a1422", stroke: "rgba(201,168,255,0.3)", "stroke-width": 1.5 }));
      svg.appendChild(label(b.x + 22, 218, b.t, T.lime, 20));
      svg.appendChild(label(b.x + 22, 250, b.d, T.cream, 15));
    });
    svg.appendChild(label(40, 360, "That is the guide. Start session 01.", T.cream, 18));
    root.appendChild(svg);
  }

  function sceneDone(root) {
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#12081c", "#0c0814");
    scene.extra.svg = svg;
    svg.appendChild(svgEl("rect", { x: 0, y: 0, width: 70, height: 520, fill: "#2a1848" }));
    svg.appendChild(svgEl("rect", { x: 830, y: 0, width: 70, height: 520, fill: "#2a1848" }));
    svg.appendChild(svgEl("ellipse", { cx: 450, cy: 560, rx: 280, ry: 90, fill: "rgba(201,168,255,0.12)" }));
    svg.appendChild(label(90, 70, "THE ORCHESTRA SWELLS", T.mute, 13));
    svg.appendChild(label(90, 130, "OH MY GOD", T.lime, 48));
    svg.appendChild(label(90, 188, "YOU DID IT", T.cream, 40));
    svg.appendChild(label(90, 230, "A TE who clicked every cartoon. The Geneve tunnel weeps with pride.", T.mute, 14));

    const lines = [
      { y: 280, t: "They said nobody finishes this. Look at you. Finishing this." },
      { y: 328, t: "You now know enough to ruin a design review. Use this power kindly." },
      { y: 376, t: "The 2am ticket is still coming. You will just sound expensive." },
      { y: 424, t: "Do not promise the registry. I am on my knees. In YAML." },
    ];
    lines.forEach((w) => {
      svg.appendChild(svgEl("rect", { x: 90, y: w.y, width: 720, height: 40, rx: 8, fill: "#1a1422", stroke: "rgba(201,168,255,0.22)" }));
      svg.appendChild(label(108, w.y + 26, w.t, T.cream, 14));
    });
    svg.appendChild(label(90, 490, "Play for the standing ovation. Then go. The cluster is waiting. It is not clapping.", T.mute, 13));
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
      log("Click two doors first.");
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
    svg.appendChild(svgEl("rect", { x: 300, y: 120, width: 300, height: 260, rx: 18, fill: "#1f2a38", stroke: "#c9a8ff", "stroke-width": 3 }));
    svg.appendChild(svgEl("text", { x: 450, y: 160, "text-anchor": "middle", fill: "#e8edf4", "font-size": 18, "font-family": "Red Hat Display, sans-serif" }, ["POD / VM"]));
    svg.appendChild(svgEl("text", { x: 450, y: 182, "text-anchor": "middle", fill: "#a898c0", "font-size": 12, "font-family": "Red Hat Text, sans-serif" }, ["namespace: ns-shop"]));
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
    svg.appendChild(label(40, 454, "A namespace may have many secondaries. It may have only one primary.", "#a898c0"));
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
      svg.appendChild(label(40, 64, "Each project owns its island. Developer / project admin territory.", "#a898c0", 13));
      nss.forEach((ns, i) => {
        const c = i < 2 ? "#c9a8ff" : "#9b7ad4";
        svg.appendChild(svgEl("rect", { x: ns.x - 10, y: ns.y - 40, width: 150, height: 200, rx: 14, fill: "none", stroke: c, "stroke-width": 2, "stroke-dasharray": "7 5" }));
        svg.appendChild(label(ns.x, ns.y - 18, "UDN " + (i + 1), c, 12));
        svg.appendChild(podBox(ns.x + 60, ns.y + 50, ns.name, c, ns.name));
      });
    } else {
      svg.appendChild(label(40, 40, "ClusterUserDefinedNetwork — cluster scoped", "#9b7ad4", 16));
      svg.appendChild(label(40, 64, "Admin stretches one network across namespaces with a label selector.", "#a898c0", 13));
      svg.appendChild(svgEl("rect", { x: 40, y: 100, width: 400, height: 280, rx: 18, fill: "#182230", stroke: "#c9a8ff", "stroke-width": 3 }));
      svg.appendChild(label(56, 128, "CUDN shop-net  ·  label: team=shop", "#c9a8ff", 14));
      svg.appendChild(svgEl("rect", { x: 460, y: 100, width: 400, height: 280, rx: 18, fill: "#231818", stroke: "#9b7ad4", "stroke-width": 3 }));
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
      svg.appendChild(svgEl("rect", { x: 60 + i * 280, y: 90, width: 250, height: 110, rx: 12, fill: on ? "#261a38" : "#1b2430", stroke: on ? "#c9a8ff" : "#2a3544", "stroke-width": 2 }));
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
      svg.appendChild(label(80, 410, "OVN will not re-home running pods. Delete and start over.", "#a898c0", 13));
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
    } else {
      svg.appendChild(label(40, 40, "NetworkPolicy cannot bridge two primary UDNs", "#9b7ad4", 18));
      svg.appendChild(podBox(700, 240, "other-udn", "#9b7ad4", "q"));
      svg.appendChild(svgEl("rect", { x: 320, y: 200, width: 240, height: 90, rx: 8, fill: "#2a1614", stroke: "#9b7ad4" }));
      svg.appendChild(label(340, 240, "allow from ns-shop", "#e8edf4", 14));
      svg.appendChild(label(340, 264, "policy exists. path does not.", "#9b7ad4", 13));
      fly(svg, { x: 190, y: 240 }, { x: 700, y: 240 }, { failAt: 0.5, color: "#c9a8ff", dur: 900 });
      svg.appendChild(label(40, 430, "Kubelet health checks also use the default network. A pod can be Ready with a dead UDN NIC.", "#a898c0"));
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
    svg.appendChild(podBox(vmx, 220, "VM  .50", "#c9a8ff", "vm"));
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

    if (bridged) {
      svg.appendChild(svgEl("rect", { x: 340, y: 170, width: 220, height: 70, rx: 10, fill: "#2a1c40", stroke: "#c9a8ff", "stroke-width": 2 }));
      svg.appendChild(label(360, 200, "ClusterNetworkConnect", "#c9a8ff", 13));
      svg.appendChild(label(360, 222, kind, "#c9d4e3", 12));
      svg.appendChild(svgEl("line", { x1: 330, y1: 205, x2: 340, y2: 205, stroke: "#c9a8ff", "stroke-width": 4 }));
      svg.appendChild(svgEl("line", { x1: 560, y1: 205, x2: 570, y2: 205, stroke: "#c9a8ff", "stroke-width": 4 }));
    } else {
      svg.appendChild(label(400, 210, "water", "#9b7ad4"));
    }
    svg.appendChild(label(40, 400, bridged
      ? (kind === "ServiceNetwork" ? "Service-only: ClusterIP works. Direct pod IP across the bridge does not." : "PodNetwork: pod IPs can talk. Isolation is gone for these two islands only.")
      : "Default: islands are silent. Connectivity is an explicit CR, not an accident.", "#a898c0", 14));
    svg.appendChild(label(40, 428, "NetworkPolicy still does not select peers on the other side of the connect. Overlapping IPs across a bridge are not handled.", "#a898c0", 13));
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
    } else {
      await fly(svg, { x: 190, y: 200 }, { x: 710, y: 200 }, { color: "#c9a8ff", dur: 900 });
      log("PodNetwork is on. The islands are wired. Isolation is now your policy problem again.");
    }
  }

  function sceneField(root) {
    const pick = scene.extra.story || "tenant";
    const svg = svgEl("svg", { viewBox: "0 0 900 520" });
    canvasBg(svg, "#16101c", "#0c0814");
    const stories = {
      tenant: {
        title: "Multi-tenant SaaS — 'like OpenStack projects'",
        rec: "Primary Layer-3 CUDN per tenant (or UDN per namespace if they never share).",
        traps: "Label at ns create. Do not select openshift-*. Isolation is default; do not promise registry/S2I.",
      },
      vm: {
        title: "VMs that live-migrate and keep IPs",
        rec: "Primary Layer-2 CUDN. Persistent IPs. Secondary Localnet CUDN if they need a datacenter VLAN.",
        traps: "Virt wants L2/Localnet. L3 primary is a sad migration. Localnet = Secondary only.",
      },
      vlan: {
        title: "Bare-metal VLAN already exists",
        rec: "Secondary ClusterUserDefinedNetwork, topology Localnet, IPAM often Disabled for VMs.",
        traps: "physicalNetworkName must match NNCP bridge-mapping. VLAN on switch AND node.",
      },
      talk: {
        title: "Two isolated apps that must share an API",
        rec: "Keep two primary UDNs. Add ClusterNetworkConnect with ServiceNetwork first, not full PodNetwork.",
        traps: "NetworkPolicy will not span the connect. Overlapping CIDRs + connect = pain. Prefer service-only.",
      },
    };
    const s = stories[pick];
    svg.appendChild(label(40, 50, "Customer story", "#a898c0", 13));
    svg.appendChild(label(40, 82, s.title, "#e8edf4", 20));
    svg.appendChild(svgEl("rect", { x: 40, y: 120, width: 820, height: 120, rx: 12, fill: "#1a1430", stroke: "#c9a8ff" }));
    svg.appendChild(label(60, 160, "RECOMMEND", "#c9a8ff", 12));
    svg.appendChild(label(60, 190, s.rec, "#e8edf4", 16));
    svg.appendChild(svgEl("rect", { x: 40, y: 270, width: 820, height: 140, rx: 12, fill: "#2a2414", stroke: "#9b7ad4" }));
    svg.appendChild(label(60, 310, "SAY THIS BEFORE THEY CUT A TICKET", "#9b7ad4", 12));
    svg.appendChild(label(60, 348, s.traps, "#e8edf4", 15));
    root.appendChild(svg);
  }

  const LESSONS = {
    intro: {
      html: `<p>Click the pictures. Ten sessions. <strong>Ask a doubt</strong> is bottom right.</p>
        <p class="dim">Start session 01 when you are ready. That is the whole speech.</p>`,
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
        <p class="dim"><strong>UDN:</strong> an isolated OVN Layer-2 or Layer-3 segment that can be the pod or VM <em>primary</em> interface. Click Play to watch a cross-tenant ping on the default network.</p>`,
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
        ["chip", "Show UDN (per namespace)", () => { scene.extra.mode = "udn"; paint(); }],
        ["chip", "Show CUDN (shared)", () => { scene.extra.mode = "cudn"; paint(); }],
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
        <p class="dim">Rule of thumb: pods → Layer 3. VMs that migrate → Layer 2. Need a datacenter VLAN → Localnet secondary.</p>`,
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
      html: `<p>DNS lookups for pods still return the default-network IP. The in-cluster image registry is often unreachable from a UDN. NetworkPolicy between different primary UDNs does not take effect. Kubelet health checks can show Ready while the UDN interface is down.</p>`,
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
        ["chip", "DNS lie", () => { scene.extra.gotcha = "dns"; paint(); }],
        ["chip", "Registry blocked", () => { scene.extra.gotcha = "reg"; paint(); }],
        ["chip", "Policy between islands", () => { scene.extra.gotcha = "np"; paint(); }],
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
        <ul><li><code>PodNetwork</code> — pod IPs can talk across the connected networks.</li><li><code>ServiceNetwork</code> — ClusterIP only. Start here.</li></ul>`,
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
      html: `<p>Pick a customer story, then Play. You get a recommendation and the limitation to say out loud. Docs: OpenShift Multiple networks → Primary networks.</p>
        <p class="dim">An empty CUDN selector matches all namespaces, including platform ones.</p>`,
      legend: [["#c9a8ff", "do this"], ["#9b7ad4", "say this"]],
      yaml: `# WHAT: a tenant CUDN — change the label for other customers
# WHY: matchLabels must be explicit. never leave the selector empty
# DETAIL: pods → Layer3 | VMs → Layer2 + Persistent | VLAN → Localnet Secondary
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
          hostSubnet: 24`,
      play: {
        lines: [
          ["cmd", "$ # TE checklist on the call"],
          ["ok", "1. ns labeled at create?  k8s.ovn.org/primary-user-defined-network"],
          ["ok", "2. CR = UDN (one ns) or CUDN (many ns, admin only)"],
          ["ok", "3. topology matches workload  pods=L3  VMs=L2  VLAN=Localnet/Secondary"],
          ["err", "4. do not promise registry, S2I, or NetworkPolicy across islands"],
          ["dim", "if they need two islands to talk: CNC ServiceNetwork first."],
        ],
      },
      onPlay: () => { scene.extra.story = scene.extra.story || "tenant"; paint(); },
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
        why: "Empty selector is the nuclear option. Match explicit tenant labels.",
      },
    },
    done: {
      html: `<p><strong>Oh my god you did it.</strong> The orchestra is a Geneve tunnel. Try not to cry in front of the customer.</p>
        <p>You clicked cartoons until isolation made sense. You now know enough to ruin a design review. Use it kindly. The 2am ticket is still coming — you will just sound expensive.</p>
        <p class="dim">Do not promise the registry. I am on my knees. In YAML. Play the ovation. Bow. Leave.</p>`,
      legend: [["#c9a8ff", "you, allegedly"], ["#9b7ad4", "the cluster, unimpressed"]],
      yaml: `# curtain call
# you finished UDN Lab. the cluster is not clapping.
#
# still do not:
#   - promise the image registry
#   - empty-selector a CUDN
#   - make Localnet primary
#   - "NetworkPolicy will connect the islands"
#
# still do:
#   - label the namespace at birth
#   - pods last
#   - L3 pods / L2 VMs / Localnet secondary
#   - CNC ServiceNetwork first
#
# now go. dramatically.`,
      play: {
        lines: [
          ["cmd", "$ oc get ego"],
          ["ok", "NAME          STATUS     AGE"],
          ["ok", "yours         Inflated   10 sessions"],
          ["cmd", "$ virtctl bow --gracefully"],
          ["ok", "OH MY GOD YOU DID IT"],
          ["err", "warning: image-registry still cannot hear your applause"],
          ["dim", "standing ovation recorded. cluster: 0 claps. take the call anyway."],
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
        log("The Geneve tunnel weeps. You may go. Dramatically.");
      },
      controls: [
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
    const yaml = (L.yamlByTopo && L.yamlByTopo[scene.extra.topo || "l3"]) || L.yaml || "# No CR on this screen.\n# Click Play for the demo.";
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
    const play = (L.playByTopo && L.playByTopo[scene.extra.topo || "l3"]) || L.play;
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
    $("log").hidden = true;
    $("log").textContent = "";
    renderBench(L);

    const legend = $("legend");
    legend.innerHTML = (L.legend || []).map(([c, t]) => `<span><b style="background:${c}"></b>${t}</span>`).join("");

    const controls = $("controls");
    controls.innerHTML = "";
    (L.controls || []).forEach(([kind, text, fn, isOn]) => {
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
