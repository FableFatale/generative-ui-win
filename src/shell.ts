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

  // ── 里程碑打标保存函数 ──
  window.saveMilestoneTasks = function(milestoneId) {
    var checkboxes = document.querySelectorAll('.kb-tag-checkbox:checked');
    var taskIds = Array.from(checkboxes).map(function(cb) { return cb.getAttribute('data-task'); });
    fetch('http://127.0.0.1:18700/api/milestone/set-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneId: milestoneId, taskIds: taskIds })
    }).then(function(res) { return res.json(); })
    .then(function(data) {
      console.log('Tasks updated:', data);
      // 关闭面板
      var panel = document.getElementById('tag-panel-' + milestoneId);
      if (panel) panel.style.display = 'none';
      var overlay = document.getElementById('tag-overlay');
      if (overlay) overlay.remove();
      // 刷新看板
      fetch('http://127.0.0.1:18700/api/show');
    }).catch(function(err) {
      console.error('Task update failed:', err);
    });
  };

  // ── DOM update via morphdom ──
  function _setContent(html) {
    // 收集所有带 data-preserve 的输入框值
    var preservedValues = {};
    root.querySelectorAll('input[data-preserve], textarea[data-preserve]').forEach(function(el) {
      var key = el.getAttribute('data-date') || el.id;
      if (key) {
        preservedValues[key] = el.value;
      }
    });

    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    morphdom(root, '<div id="widget-root">' + html + '</div>', {
      onBeforeElUpdated: function(fromEl, toEl) {
        // Skip elements with data-no-morph
        if (fromEl.hasAttribute && fromEl.hasAttribute('data-no-morph')) return false;
        // Skip input/textarea with data-preserve that user is editing
        if ((fromEl.tagName === 'INPUT' || fromEl.tagName === 'TEXTAREA')) {
          if (fromEl.hasAttribute('data-preserve') && document.activeElement === fromEl) {
            return false;
          }
        }
        return true;
      },
      onElUpdated: function(el) {
        // 恢复带 data-preserve 的输入框值
        if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.hasAttribute('data-preserve')) {
          var key = el.getAttribute('data-date') || el.id;
          if (key && preservedValues[key] !== undefined) {
            el.value = preservedValues[key];
          }
        }
      },
      onNodeAdded: function(node) {
        if (node.nodeType === 1 && node.classList) {
          node.classList.add('widget-fade-in');
        }
        return node;
      }
    });
  }

  // 全局事件委托 - 在 document 级别监听所有 input 事件
  document.addEventListener('input', function(e) {
    var el = e.target;
    if (el && el.classList && el.classList.contains('kb-summary-input')) {
      var date = el.getAttribute('data-date');
      var summary = el.value;
      if (date) {
        fetch('http://127.0.0.1:18700/api/report/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: date, summary: summary })
        }).then(function(res) {
          console.log('Saved:', summary);
        }).catch(function(err) {
          console.error('Save failed:', err);
        });
      }
    }
  });

  // 日报卡片点击展开/折叠
  document.addEventListener('click', function(e) {
    var el = e.target;
    // 点击 header 区域触发折叠
    if (el && el.closest && el.closest('.kb-report-header')) {
      var card = el.closest('.kb-report-card');
      if (card) {
        var icon = card.querySelector('.kb-report-icon');
        if (card.classList.contains('kb-fold-expanded')) {
          card.classList.remove('kb-fold-expanded');
          if (icon) icon.textContent = '▶';
        } else {
          card.classList.add('kb-fold-expanded');
          if (icon) icon.textContent = '▼';
        }
      }
    }
    // 状态按钮点击切换里程碑状态
    if (el && el.classList && el.classList.contains('kb-status-btn')) {
      var milestoneId = el.getAttribute('data-milestone');
      var status = el.getAttribute('data-status');
      if (milestoneId && status) {
        fetch('http://127.0.0.1:18700/api/milestone/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ milestoneId: milestoneId, status: status })
        }).then(function(res) {
          console.log('Status updated:', milestoneId, status);
        }).catch(function(err) {
          console.error('Status update failed:', err);
        });
      }
    }
    // 打标按钮点击 - 展开任务勾选面板
    if (el && el.classList && el.classList.contains('kb-tag-btn')) {
      var milestoneId = el.getAttribute('data-milestone');
      if (milestoneId) {
        // 创建遮罩层
        var overlay = document.createElement('div');
        overlay.className = 'kb-tag-overlay';
        overlay.id = 'tag-overlay';
        document.body.appendChild(overlay);

        var panel = document.getElementById('tag-panel-' + milestoneId);
        if (panel) {
          panel.style.display = 'block';
          document.body.appendChild(panel); // 移到 body 下
          // 加载已完成任务列表
          fetch('http://127.0.0.1:18700/api/status')
            .then(function(res) { return res.json(); })
            .then(function(data) {
              var tasks = data.tasks.filter(function(t) { return t.status === 'completed'; });
              var listHtml = tasks.slice(0, 30).map(function(t) {
                var checked = t.milestoneIds && t.milestoneIds.indexOf(milestoneId) >= 0;
                return '<div class="kb-tag-task-item"><input type="checkbox" class="kb-tag-checkbox" data-task="' + t.id + '"' + (checked ? ' checked' : '') + '><span>' + t.title + '</span></div>';
              }).join('');
              var listEl = document.getElementById('tag-tasks-' + milestoneId);
              if (listEl) listEl.innerHTML = listHtml;
            });
        }
      }
    }
    // 点击遮罩层关闭面板
    if (el && el.id === 'tag-overlay') {
      var overlay = document.getElementById('tag-overlay');
      if (overlay) overlay.remove();
      var panels = document.querySelectorAll('.kb-tag-panel');
      panels.forEach(function(p) { p.style.display = 'none'; });
    }
    // 关闭打标面板
    if (el && el.classList && el.classList.contains('kb-tag-close')) {
      var milestoneId = el.getAttribute('data-milestone');
      if (milestoneId) {
        var panel = document.getElementById('tag-panel-' + milestoneId);
        if (panel) panel.style.display = 'none';
        var overlay = document.getElementById('tag-overlay');
        if (overlay) overlay.remove();
      }
    }
    // 保存打标选择
    if (el && el.classList && el.classList.contains('kb-tag-save')) {
      var milestoneId = el.getAttribute('data-milestone');
      if (milestoneId) {
        var checkboxes = document.querySelectorAll('.kb-tag-checkbox:checked');
        var taskIds = Array.from(checkboxes).map(function(cb) { return cb.getAttribute('data-task'); });
        fetch('http://127.0.0.1:18700/api/milestone/set-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ milestoneId: milestoneId, taskIds: taskIds })
        }).then(function(res) { return res.json(); })
        .then(function(data) {
          console.log('Tasks updated:', data);
          // 关闭面板
          var panel = document.getElementById('tag-panel-' + milestoneId);
          if (panel) panel.style.display = 'none';
          var overlay = document.getElementById('tag-overlay');
          if (overlay) overlay.remove();
          // 刷新看板
          fetch('http://127.0.0.1:18700/api/show');
        }).catch(function(err) {
          console.error('Task update failed:', err);
        });
      }
    }
  });

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
