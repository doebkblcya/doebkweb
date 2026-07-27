---
title: "View Transitions 故障报告"
date: 2026-07-28
summary: "Astro View Transitions API 在实际项目中的故障现象与排查记录"
---

# View Transitions 故障报告

## 背景

doebkweb 使用 Astro View Transitions（VT）实现页面间的无缝导航。VT 截获链接点击，用 `fetch` 拉取新页面 HTML，然后替换 `<body>` 内容——整个过程不会触发浏览器完整导航，JS 运行时（`window`、变量、定时器、事件监听器）持续存活。

## 核心问题

**VT 只替换 DOM，不执行 `<body>` 中的 `<script>` 标签。** 这是 Astro 的既定行为，不是 bug，但带来了系统性的交互故障。

```
初次访问 → 脚本执行 → addEventListener 挂在 DOM 元素上 ✅
VT 切走再切回 → 新页面有新 DOM → 脚本不执行 → 元素没有监听器 ❌
```

## 两类故障

### Bug 1：首页 Persist 契约违反

`transition:persist` 要求元素在所有参与 VT 的页面中都存在。VinylPlayer 和 Sidebar 需要 persist（音乐播放状态、导航高亮），但首页不想显示它们。

**临时方案**：首页渲染这些组件但用 CSS 隐藏（`body:not(.has-sidebar) .sidebar { display: none }`）。

**后果**：
- 首页音乐不停止（清理脚本在 VT 下不执行）
- DOM 状态在首页与其他页面之间可能不一致
- 架构脆弱，每次加新页面都要考虑 persist 契约

**最终方案**：保留这个模式（它是 VT 下必要的代价），但明确它是例外而非规则。只有真正有跨页面运行时状态的组件才 persist。

### Bug 2：页面交互在 VT 后全部失效

受影响的文件和交互：

| 文件 | 失效的交互 |
|---|---|
| `photos.astro` | 关闭按钮、上/下切换、背景点击关闭、键盘导航 |
| `docs/index.astro` | 排序按钮、搜索输入、搜索 focus、外部点击关闭、Escape 关闭 |
| `music.astro` | 搜索输入、排序按钮、专辑架点击播放 |
| `index.astro` | 首页音乐停止 + 播放器重置脚本 |

共计 **13 处**，刷新后恢复正常——因为刷新触发了完整页面加载，脚本重新执行。

## 修复方案

### 规则：非 persist 元素的交互全部使用 inline HTML 属性

```
✅ 正确：
<button onclick="window.__vt_doSomething()">按钮</button>

❌ 错误：
<script>
  document.getElementById("btn").addEventListener("click", () => { ... });
</script>
```

### 具体实践

1. **交互入口**：`onclick`、`oninput`、`onfocus` 等 inline 属性
2. **业务逻辑**：放在 `window.__vt_xxx` 全局函数中
3. **DOM 引用**：每次调用时 `document.getElementById()` 重新获取，不缓存在闭包中
4. **document 级监听**（keyboard、外部点击）：存 `window.__vt_xxx`，每次脚本执行先 `removeEventListener` 旧函数再注册新函数
5. **Persist 组件**：用 `dataset.ready` 守卫防止重入

### 修复后文件结构示例

```astro
<!-- photos.astro -->
<button onclick="window.__vt_closePhoto()">关闭</button>
<button onclick="window.__vt_navPhoto(-1)">上一张</button>
<div class="lightbox" onclick="window.__vt_closeIfBackdrop(event, this)">

<script define:vars={{ photosJson }}>
  var PHOTOS = JSON.parse(photosJson);

  window.__vt_closePhoto = function () {
    var lb = document.getElementById("lightbox");  // 每次重读
    if (!lb) return;
    lb.classList.remove("is-open");
  };

  // Keyboard — document 级，remove-before-add 防累积
  if (window.__vt_photos_onKeydown) {
    document.removeEventListener("keydown", window.__vt_photos_onKeydown);
  }
  window.__vt_photos_onKeydown = function (e) { ... };
  document.addEventListener("keydown", window.__vt_photos_onKeydown);
</script>
```

## 经验教训

### 调试误区

1. **方向反复**：最初认为是监听累积、`const` 重复声明、闭包作用域等问题，逐一尝试后都失败
2. **测试盲区**：`browser_navigate` 是完整页面加载，不触发 VT。必须通过点击侧边栏链接触发 client-side 导航才能复现
3. **根因定位漫长**：最终的根因（VT 不执行 body 脚本）是 Astro 的既定行为，但花了大量时间在 JS 层面的假说上

### 架构反思

这次经历引出了一个根本问题：MPA 架构下 VT 是否值得。VT 带来的唯一不可替代价值是跨页面音乐无缝播放。如果不需要这个特性，删除 VT 可以消除全部 13 处隐患，且以后不需要任何约束。最终选择了保留 VT，接受 inline onclick 作为项目规范。

## 相关文件

- 项目规则：`CLAUDE.md` 中「View Transitions」段落
- 受影响文件：`photos.astro`、`docs/index.astro`、`music.astro`、`index.astro`
- Persist 组件：`VinylPlayer.astro`、`Sidebar.astro`
