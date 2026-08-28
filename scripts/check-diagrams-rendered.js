/**
 * Ground-truth geometry check for the architecture diagrams.
 *
 * scripts/check-diagrams.ts reasons about the SPEC: it approximates each edge
 * as an L and asks whether that L crosses a box. That approximation is wrong
 * often enough to matter — React Flow renders a smoothstep curve whose lane
 * offset moves the corners, so a spec the static checker calls clean can still
 * render edges straight through a box. Confirmed on web-crawler, which passed
 * the static check while 13 of its 22 arrows were unclickable.
 *
 * So this one measures what is actually on the screen: it samples every
 * rendered path and asks whether the sample lands inside a rendered box.
 * Slower and needs a browser, which is why the static check still exists as
 * the fast gate — but this is the one that tells the truth.
 *
 * Usage:
 *   bunx serve -s mobile/dist -l 8099 &
 *   node scripts/check-diagrams-rendered.js <id> [id ...]
 */
const { chromium } = require("playwright");

const BASE = process.env.DIAGRAM_BASE || "http://localhost:8099";
// A sample this far inside a box is genuinely covered, not just meeting the
// border where the edge legitimately attaches.
// NEGATIVE inset: an edge running along a box's border is as bad as one
// running through it — it reads as a line glued to the side of the box. This
// checker used to inset by +6 and so reported those as clean.
const INSET = -10;

async function checkOne(page, id) {
  await page.goto(`${BASE}/diagram/${id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3200);

  return page.evaluate((inset) => {
    const boxes = [...document.querySelectorAll(".react-flow__node")]
      .filter(
        (n) =>
          !n.classList.contains("react-flow__node-zone") &&
          !n.classList.contains("react-flow__node-serviceGroup"),
      )
      .map((n) => {
        const r = n.getBoundingClientRect();
        return {
          label: (n.innerText || "").split("\n").slice(0, 2).join(" ").trim().slice(0, 32),
          x: r.left + inset,
          y: r.top + inset,
          r: r.right - inset,
          b: r.bottom - inset,
        };
      });

    const buried = [];
    const labelHits = [];

    for (const edge of document.querySelectorAll(".react-flow__edge")) {
      const id = edge.getAttribute("data-id");
      const p = edge.querySelector(".react-flow__edge-path");
      if (!p) continue;
      const len = p.getTotalLength();
      if (!len) continue;
      const ctm = p.getScreenCTM();
      const svg = p.ownerSVGElement;
      if (!ctm || !svg) continue;

      const pt = svg.createSVGPoint();
      const steps = Math.max(24, Math.ceil(len / 5));
      let covered = 0;
      const hitting = new Set();
      for (let i = 0; i <= steps; i++) {
        // Skip the first and last tenth: that is where the edge attaches to its
        // own endpoints, and counting those reports every edge as buried in the
        // boxes it connects.
        const f = i / steps;
        if (f < 0.1 || f > 0.9) continue;
        const q = p.getPointAtLength((len * i) / steps);
        pt.x = q.x;
        pt.y = q.y;
        const s = pt.matrixTransform(ctm);
        for (const bx of boxes) {
          if (s.x > bx.x && s.x < bx.r && s.y > bx.y && s.y < bx.b) {
            covered++;
            hitting.add(bx.label);
            break;
          }
        }
      }
      // A couple of samples at the very ends are the attachment, not a crossing.
      if (covered > 2) {
        buried.push({
          id,
          pct: Math.round((covered / steps) * 100),
          boxes: [...hitting],
        });
      }
    }

    // Edge labels must not sit on a box either.
    for (const l of document.querySelectorAll(".react-flow__edgelabel-renderer > div")) {
      const r = l.getBoundingClientRect();
      if (!r.width) continue;
      const on = boxes.find(
        (bx) => r.left < bx.r && r.right > bx.x && r.top < bx.b && r.bottom > bx.y,
      );
      if (on) labelHits.push({ text: (l.innerText || "").trim().slice(0, 28), box: on.label });
    }

    // Readability: the zoom fitView settled on, and what that makes of the text.
    const vp = document.querySelector(".react-flow__viewport");
    const m = vp && vp.style.transform.match(/scale\(([\d.]+)\)/);
    const zoom = m ? parseFloat(m[1]) : null;
    const labelPx = zoom ? Math.round(11.5 * zoom * 10) / 10 : null;
    // Crossings between rendered paths.
    const polys = [...document.querySelectorAll(".react-flow__edge-path")].map((p) => {
      const len = p.getTotalLength();
      const ctm = p.getScreenCTM();
      const svg = p.ownerSVGElement;
      const pt = svg.createSVGPoint();
      const pts = [];
      const steps = Math.max(10, Math.ceil(len / 4));
      for (let i = 0; i <= steps; i++) {
        const q = p.getPointAtLength((len * i) / steps);
        pt.x = q.x;
        pt.y = q.y;
        const s = pt.matrixTransform(ctm);
        pts.push([s.x, s.y]);
      }
      return pts;
    });
    const ccw = (p, q, r) => (r[1] - p[1]) * (q[0] - p[0]) > (q[1] - p[1]) * (r[0] - p[0]);
    const cross = (a, b, c, d) => ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
    let crossings = 0;
    for (let i = 0; i < polys.length; i++)
      for (let j = i + 1; j < polys.length; j++)
        for (let a = 0; a < polys[i].length - 1; a++)
          for (let b = 0; b < polys[j].length - 1; b++)
            if (cross(polys[i][a], polys[i][a + 1], polys[j][b], polys[j][b + 1])) crossings++;
    return { boxCount: boxes.length, buried, labelHits, zoom, labelPx, crossings };
  }, INSET);
}

(async () => {
  const ids = process.argv.slice(2);
  if (!ids.length) {
    console.error("usage: node scripts/check-diagrams-rendered.js <id> [id ...]");
    process.exit(2);
  }
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

  let failing = 0;
  for (const id of ids) {
    const { boxCount, buried, labelHits, zoom, labelPx, crossings } = await checkOne(page, id);
    const stats = `zoom ${zoom?.toFixed(2)} · labels ${labelPx}px · ${boxCount} boxes · ${crossings} crossings`;
    const bad = buried.length || labelHits.length || crossings > 0 || (zoom != null && zoom < 0.78);
    if (!bad) {
      console.log(`✓ ${id.padEnd(22)} ${stats}`);
      continue;
    }
    failing++;
    console.log(`\n✗ ${id.padEnd(22)} ${stats}`);
    for (const b of buried) {
      console.log(`    edge ${b.id}: ${b.pct}% of its length is under/along ${b.boxes.join(", ")}`);
    }
    for (const l of labelHits) {
      console.log(`    label "${l.text}" sits on box "${l.box}"`);
    }
  }
  console.log(`\n${ids.length} diagram(s): ${ids.length - failing} clean, ${failing} failing`);
  await browser.close();
  process.exit(failing ? 1 : 0);
})();
