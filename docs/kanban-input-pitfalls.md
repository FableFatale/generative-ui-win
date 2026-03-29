# Kanban 日报输入框踩坑总结

## 问题描述

用户在 Kanban 看板的日报卡片中输入"一句话总结"，输入完成后刷新页面，文字消失。

---

## 踩坑记录

### 坑 1：morphdom DOM diff 导致 input 值丢失

**现象**：用户输入文字后，自动刷新触发 morphdom 更新 DOM，input 元素被替换，值丢失。

**原因**：morphdom 默认会对比新旧 DOM 并替换整个元素，不会保留用户正在输入的值。

**解决方案**：
1. 给 input 添加 `data-preserve` 属性标记需要保留值
2. 在 morphdom 的 `onBeforeElUpdated` 回调中收集所有 `data-preserve` 元素的值
3. 在 `onElUpdated` 回调中恢复这些值

```javascript
// shell.ts - _setContent 函数
var preservedValues = {};
root.querySelectorAll('input[data-preserve], textarea[data-preserve]').forEach(function(el) {
  var key = el.getAttribute('data-date') || el.id;
  if (key) preservedValues[key] = el.value;
});

morphdom(root, '<div id="widget-root">' + html + '</div>', {
  onBeforeElUpdated: function(fromEl, toEl) {
    // 用户正在编辑的输入框跳过更新
    if (fromEl.hasAttribute('data-preserve') && document.activeElement === fromEl) {
      return false;
    }
    return true;
  },
  onElUpdated: function(el) {
    // 恢复保留的值
    if (el.hasAttribute('data-preserve')) {
      var key = el.getAttribute('data-date') || el.id;
      if (key && preservedValues[key] !== undefined) {
        el.value = preservedValues[key];
      }
    }
  }
});
```

---

### 坑 2：事件绑定在 DOM 更新后丢失

**现象**：在 renderer 中给 input 添加 `onblur`/`onchange` 属性，morphdom 更新后事件不触发。

**原因**：
- morphdom 替换元素时，内联事件属性（onblur/onchange）不会被执行
- 即使重新执行 script 标签，属性中的代码也不会被绑定

**解决方案**：使用事件委托，在 document 级别监听 input 事件。

```javascript
// shell.ts - 全局事件委托
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
      });
    }
  }
});
```

---

### 坑 3：跨端口 fetch 请求 404

**现象**：控制台显示 `fetch /api/report/summary 404`，API 没有收到请求。

**原因**：
- Widget shell HTML 由 WidgetServer 提供，运行在动态端口（如 `http://127.0.0.1:xxxxx/widget/xxx`）
- kanban API 在独立端口 `18700`
- 使用相对路径 `fetch('/api/report/summary')` 会请求 WidgetServer 端口，而不是 kanban-server 端口

**解决方案**：使用绝对 URL，明确指定 API 端口。

```javascript
// 错误写法
fetch('/api/report/summary', { ... })

// 正确写法
fetch('http://127.0.0.1:18700/api/report/summary', { ... })
```

---

### 坑 4：浏览器缓存旧的 shell HTML

**现象**：修改 shell.ts 代码并编译后，浏览器窗口仍使用旧代码。

**原因**：
- WidgetServer 的 shell HTML 是动态生成的，但浏览器标签不会自动刷新
- setContent 只更新内容区域，不会重新加载整个 shell 页面

**解决方案**：
1. 添加 `/api/reload` API，强制关闭窗口并重新打开
2. 调用 `currentHandle.close()` 后 `refreshBoard()` 会创建新窗口

```typescript
// kanban-server.ts
if (pathname === "/api/reload") {
  if (currentHandle) currentHandle.close();
  currentHandle = null;
  await refreshBoard();
}
```

---

## 关键代码位置

| 文件 | 作用 |
|------|------|
| `src/shell.ts` | Widget shell HTML，包含 morphdom 和事件委托 |
| `src/kanban-renderer.ts` | 渲染日报卡片，input 带 `data-preserve` 属性 |
| `src/kanban-server.ts` | API 端点 `/api/report/summary`、`/api/reload` |
| `src/kanban-store.ts` | `updateReportSummary()` 保存总结到日报 |

---

## 经验总结

1. **动态 DOM 更新需要特殊处理用户输入**：morphdom/virtual-dom 等库会替换元素，需要主动保留用户输入的值
2. **事件委托比内联事件更可靠**：事件绑定在稳定的父元素（如 document）上，不会被 DOM 更新影响
3. **跨端口/跨域请求要明确指定完整 URL**：相对路径只在同端口下生效
4. **代码更新后要强制刷新窗口**：浏览器不会自动加载新代码，需要关闭重开

---

## 日期

2026-03-29