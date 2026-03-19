import { WindowManager } from "../src/window-manager";
import { wrapHTML } from "../src/shell";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function demoStreaming() {
  console.log("=== Demo: Streaming HTML ===");
  const manager = new WindowManager();
  const handle = await manager.open();

  await handle.waitForReady();
  console.log("Widget ready, starting streaming demo...");

  // Phase 1: Title
  handle.setContent(`
    <div style="padding:40px;max-width:800px;margin:0 auto;">
      <h1 style="color:#7c6fe0;font-size:36px;margin-bottom:24px;">
        Streaming Demo
      </h1>
    </div>
  `);
  await sleep(800);

  // Phase 2: Add subtitle
  handle.setContent(`
    <div style="padding:40px;max-width:800px;margin:0 auto;">
      <h1 style="color:#7c6fe0;font-size:36px;margin-bottom:8px;">
        Streaming Demo
      </h1>
      <p style="color:#888;margin-bottom:32px;">
        Content appears progressively, just like streaming from an LLM.
      </p>
    </div>
  `);
  await sleep(800);

  // Phase 3: Add cards
  const colors = ["#7c6fe0", "#4ecdc4", "#ff6b6b", "#ffd93d", "#4a90d9", "#6bcb77"];
  const labels = ["Purple", "Teal", "Coral", "Gold", "Blue", "Green"];

  for (let i = 0; i < colors.length; i++) {
    const cards = colors
      .slice(0, i + 1)
      .map(
        (c, j) => `
        <div style="background:#242424;border:1px solid #333;border-radius:8px;padding:16px;
                    display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:8px;background:${c};flex-shrink:0;"></div>
          <div>
            <div style="font-weight:600;color:#e0e0e0;">${labels[j]}</div>
            <div style="font-size:12px;color:#888;">${c}</div>
          </div>
        </div>`
      )
      .join("\n");

    handle.setContent(`
      <div style="padding:40px;max-width:800px;margin:0 auto;">
        <h1 style="color:#7c6fe0;font-size:36px;margin-bottom:8px;">
          Streaming Demo
        </h1>
        <p style="color:#888;margin-bottom:32px;">
          Content appears progressively, just like streaming from an LLM.
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
          ${cards}
        </div>
      </div>
    `);
    await sleep(500);
  }

  handle.flush();
  await sleep(2000);
  handle.close();
  console.log("Streaming demo complete.\n");
  return manager;
}

async function demoChart() {
  console.log("=== Demo: Chart.js ===");
  const manager = new WindowManager();
  const handle = await manager.open();

  await handle.waitForReady();
  console.log("Widget ready, loading Chart.js demo...");

  handle.setContent(`
    <div style="padding:40px;max-width:800px;margin:0 auto;">
      <h1 style="color:#7c6fe0;font-size:28px;margin-bottom:24px;">Chart.js Demo</h1>
      <canvas id="myChart" width="700" height="400" data-no-morph></canvas>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script>
        Chart.defaults.color = '#e0e0e0';
        Chart.defaults.borderColor = '#333';

        new Chart(document.getElementById('myChart'), {
          type: 'bar',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
              label: 'Revenue ($K)',
              data: [12, 19, 8, 15, 22, 17],
              backgroundColor: [
                '#7c6fe0', '#4ecdc4', '#ff6b6b',
                '#ffd93d', '#4a90d9', '#6bcb77'
              ],
              borderRadius: 4,
              borderSkipped: false,
            }]
          },
          options: {
            responsive: false,
            plugins: {
              legend: { display: false },
              title: {
                display: true,
                text: 'Monthly Revenue 2025',
                font: { size: 18, weight: 600 },
                color: '#e0e0e0',
                padding: { bottom: 20 }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: '#333' },
                ticks: { color: '#888' }
              },
              x: {
                grid: { display: false },
                ticks: { color: '#888' }
              }
            }
          }
        });
      </script>
    </div>
  `);
  handle.runScripts();

  await sleep(5000);
  handle.close();
  console.log("Chart demo complete.\n");
  return manager;
}

async function demoBidirectional() {
  console.log("=== Demo: Bidirectional Communication ===");
  const manager = new WindowManager();
  const handle = await manager.open();

  await handle.waitForReady();
  console.log("Widget ready, loading interactive demo...");

  handle.setContent(`
    <div style="padding:40px;max-width:600px;margin:0 auto;text-align:center;">
      <h1 style="color:#7c6fe0;font-size:28px;margin-bottom:24px;">Pick a Color</h1>
      <div id="options" style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
      </div>
      <p id="status" style="color:#888;margin-top:24px;">Click a color to send it back to Node.js</p>
      <script>
        var colors = [
          { name: 'Purple', hex: '#7c6fe0' },
          { name: 'Teal',   hex: '#4ecdc4' },
          { name: 'Coral',  hex: '#ff6b6b' },
          { name: 'Gold',   hex: '#ffd93d' },
        ];
        var container = document.getElementById('options');
        colors.forEach(function(c) {
          var btn = document.createElement('button');
          btn.textContent = c.name;
          btn.style.cssText =
            'padding:12px 24px;border:none;border-radius:8px;font-size:16px;' +
            'cursor:pointer;color:#fff;background:' + c.hex + ';' +
            'transition:transform 0.15s,opacity 0.15s;';
          btn.onmouseenter = function() { btn.style.opacity = '0.85'; };
          btn.onmouseleave = function() { btn.style.opacity = '1'; };
          btn.onclick = function() {
            window.widget.send({ type: 'colorPicked', color: c.name, hex: c.hex });
            document.getElementById('status').textContent = 'You picked ' + c.name + '!';
            document.getElementById('status').style.color = c.hex;
          };
          container.appendChild(btn);
        });
      </script>
    </div>
  `);
  handle.runScripts();

  console.log("Waiting for user to pick a color...");
  const result = await handle.waitForResult();
  console.log("User picked:", result);

  await sleep(2000);
  handle.close();
  console.log("Bidirectional demo complete.\n");
  return manager;
}

async function main() {
  try {
    // Run demos sequentially
    let mgr: WindowManager;

    mgr = await demoStreaming();
    await mgr.closeAll();

    mgr = await demoChart();
    await mgr.closeAll();

    mgr = await demoBidirectional();
    await mgr.closeAll();

    console.log("All demos complete!");
    process.exit(0);
  } catch (err) {
    console.error("Demo error:", err);
    process.exit(1);
  }
}

main();
