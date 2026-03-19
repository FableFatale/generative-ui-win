import { SVG_STYLES } from "./svg-styles";

/**
 * Generate the full shell HTML page for a widget.
 * This page connects via WebSocket and uses morphdom for efficient DOM diffing.
 */
export function generateShellHTML(widgetId: string, wsPort: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Widget ${widgetId}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%; height: 100%;
    background: #1a1a1a;
    color: #e0e0e0;
    font-family: 'SF Pro Display', 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    overflow-x: hidden;
  }
  #widget-root {
    width: 100%;
    min-height: 100vh;
    padding: 16px;
  }
  /* New nodes fade in */
  @keyframes widgetFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .widget-fade-in {
    animation: widgetFadeIn 0.3s ease-out both;
  }
  /* SVG styles */
  ${SVG_STYLES}
  /* Scrollbar styling */
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: #1a1a1a; }
  ::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #555; }
  /* Status indicator */
  #widget-status {
    position: fixed; top: 8px; right: 8px;
    width: 8px; height: 8px; border-radius: 50%;
    background: #444; transition: background 0.3s;
    z-index: 9999;
  }
  #widget-status.connected { background: #6bcb77; }
  #widget-status.disconnected { background: #ff6b6b; }
</style>
<script src="https://cdn.jsdelivr.net/npm/morphdom@2.7.4/dist/morphdom-umd.min.js"></script>
</head>
<body>
<div id="widget-status"></div>
<div id="widget-root"></div>
<script>
(function() {
  var root = document.getElementById('widget-root');
  var status = document.getElementById('widget-status');
  var ws = null;
  var messageBuffer = [];
  var connected = false;
  var reconnectTimer = null;
  var widgetId = '${widgetId}';
  var wsPort = ${wsPort};

  // ── Public API: window.widget ──
  window.widget = {
    send: function(data) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message', data: data }));
      }
    },
    id: widgetId
  };

  // ── DOM update via morphdom ──
  function _setContent(html) {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    // Tag new top-level children for fade-in
    var existingIds = new Set();
    Array.from(root.children).forEach(function(c) {
      if (c.id) existingIds.add(c.id);
    });

    morphdom(root, '<div id="widget-root">' + html + '</div>', {
      onBeforeElUpdated: function(fromEl, toEl) {
        // Skip elements with data-no-morph
        if (fromEl.hasAttribute && fromEl.hasAttribute('data-no-morph')) return false;
        return true;
      },
      onElUpdated: function(el) {},
      onNodeAdded: function(node) {
        if (node.nodeType === 1 && node.classList) {
          node.classList.add('widget-fade-in');
        }
        return node;
      }
    });
  }

  // ── Re-execute script tags ──
  function _runScripts() {
    var scripts = root.querySelectorAll('script');
    scripts.forEach(function(oldScript) {
      var newScript = document.createElement('script');
      // Copy attributes
      Array.from(oldScript.attributes).forEach(function(attr) {
        newScript.setAttribute(attr.name, attr.value);
      });
      if (oldScript.src) {
        newScript.src = oldScript.src;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  // ── WebSocket connection ──
  function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

    ws = new WebSocket('ws://127.0.0.1:' + wsPort + '/ws/' + widgetId);

    ws.onopen = function() {
      connected = true;
      status.className = 'connected';
      ws.send(JSON.stringify({ type: 'ready' }));
    };

    ws.onmessage = function(event) {
      try {
        var msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'setContent':
            _setContent(msg.html);
            break;
          case 'runScripts':
            _runScripts();
            break;
          case 'close':
            ws.send(JSON.stringify({ type: 'closed' }));
            ws.close();
            window.close();
            break;
        }
      } catch (e) {
        console.error('Widget message error:', e);
      }
    };

    ws.onclose = function() {
      connected = false;
      status.className = 'disconnected';
      // Attempt reconnect after 2s
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 2000);
    };

    ws.onerror = function() {
      ws.close();
    };
  }

  // ── Notify server on page unload ──
  window.addEventListener('beforeunload', function() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'closed' }));
    }
  });

  connect();
})();
</script>
</body>
</html>`;
}

/**
 * Wrap raw HTML/SVG content into a full document.
 * Used when the caller provides plain HTML instead of a full page.
 */
export function wrapHTML(html: string, isSVG = false): string {
  if (isSVG) {
    return `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;">
  ${html}
</div>`;
  }
  return html;
}
