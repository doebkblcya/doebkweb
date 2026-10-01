---
title: "Astro ClientRouter 生命周期故障记录"
date: 2026-07-28
updated: 2026-09-09
summary: "从 ViewTransitions 到 ClientRouter：跨页播放器、脚本去重与页面状态残留的原因和修复"
---

> 历史记录：本文描述移除音乐播放前的架构。本站现在使用普通多页面导航与原生页面转场，已移除 ClientRouter 和播放器。当前约束见仓库 `AGENT.md`。

# Astro ClientRouter 生命周期故障记录

## 背景

本站需要音乐在页面之间连续播放，因此使用 Astro 的客户端路由。这个组件在 Astro 4 中名为 `ViewTransitions`，Astro 5 改名为 `ClientRouter`；它不仅控制视觉过渡，也会拦截站内链接、获取下一页 HTML 并替换页面 DOM。

普通多页面导航会创建新的 document。ClientRouter 导航则保留当前 JavaScript 运行环境，并把新页面的 body 换入当前 document。这个差异让播放器可以持续，也改变了脚本生命周期。

## 根因

Astro 打包后的 module script 在同一 document 内去重执行。页面第一次访问时，脚本可以把事件绑定到当前 DOM；离开再返回时，页面节点已经是新实例，而 module 不一定重新执行。

```text
首次进入
  module 执行 → 监听器绑定到节点 A

离开页面
  节点 A 被移除 → module 和全局监听仍可能存活

返回页面
  节点 B 被插入 → module 已执行过 → B 没有旧监听器
```

如果代码还保留动画帧、Motion 控制器或 window/document 监听，就会出现另一类问题：旧页面逻辑继续修改新页面，导致按钮、人物、标题或抽屉状态叠加。

## 曾出现的症状

- 页面交互刷新后正常，站内跳转回来后失效。
- document 级事件重复注册，一次操作触发多次。
- 主题属性在文档交换后恢复为服务器输出值。
- 持久化 Sidebar 后切换语言，链接和文案仍来自旧语言。
- 首页展开后进入关于页，再返回首页，人物、标题与按钮处于不同步状态。

这些现象不是 View Transition 动画本身造成的，而是 DOM 所有权和脚本生命周期没有统一。

## 当前架构

### ClientRouter 只负责导航

`BaseLayout.astro` 使用：

```astro
<html transition:animate="none">
  <ClientRouter fallback="swap" />
</html>
```

根页面不做左右滑动或淡入淡出。这样仍保留客户端导航和持久化能力，同时避免旧、新页面快照与首页动效叠加。

### 只持久化真实跨页状态

```text
#audio       persist
#vinyl-app   persist
Sidebar      不 persist
首页 hero    不 persist
页面内容      不 persist
```

audio 保存真实播放位置，VinylPlayer 保存播放器 UI。Sidebar 必须根据语言和当前路径重建；首页必须每次得到新的初始状态。

### 页面交互使用组件生命周期

首页用 Custom Element 包裹：

```js
class HomeHero extends HTMLElement {
  connectedCallback() {
    const controller = new AbortController();

    window.addEventListener("wheel", this.onWheel, {
      passive: false,
      signal: controller.signal,
    });

    this.dispose = () => {
      controller.abort();
      this.animation?.stop();
      cancelAnimationFrame(this.frame);
    };
  }

  disconnectedCallback() {
    this.dispose?.();
  }
}
```

浏览器每次插入新 `<home-hero>` 都会调用 `connectedCallback`；页面被换走时调用 `disconnectedCallback`。事件、动画和 DOM 的生命周期因此属于同一实例。

## 兼容旧代码

Sidebar、设置、文档列表、音乐页和摄影页仍有 inline handler 与 `window.__vt_*`。这些代码维护时必须：

1. 每次执行都查询当前 DOM，不缓存已经被换走的节点。
2. document/window 事件采用 remove-before-add，避免重复。
3. 初始化函数保持幂等。
4. 不把页面临时状态误放进 persist。

这是迁移期间的兼容方案。新交互优先 Custom Element，不再扩大全局函数集合。

## 主题的特殊处理

BaseLayout 在首帧前从 localStorage 写入 `data-theme` 与 `data-theme-mode`。ClientRouter 交换根属性后，Sidebar 的 `astro:after-swap` 处理器再次应用主题。这个处理器属于跨页面 UI 同步，不属于页面组件状态。

## 正确测试方式

直接打开 URL 只测试完整页面加载，无法覆盖这个问题。回归测试必须包含：

1. 直接打开目标页。
2. 从其他页面点击站内链接进入。
3. 离开后再次返回。
4. 浏览器前进和后退。
5. 快速连续输入和动画反向。
6. 检查 audio/VinylPlayer 仍是同一 DOM 实例。
7. 检查页面节点只有一份，控制台没有运行时异常。

本站首页已经按以上矩阵验证“首页 → 关于我 → 首页”和 history 往返。

## DevTools 注入脚本与站点错误的区分

调试 ClientRouter 时，Chrome DevTools 的 Performance 实时指标可能注入 Web Vitals 采集代码。若控制台堆栈只显示 `VM...`、`<anonymous>`、`reportAllChanges` 和读取 `startTime`，而没有 `/_astro/` 资源或仓库文件，应先关闭该实时指标并重新加载页面。这类异常不属于页面组件生命周期，也不应通过修改路由或播放器规避。

文档搜索是另一条独立链路：Pagefind 只在生产构建后生成。文档列表在开发模式直接跳过初始化，因此 `pnpm dev` 不会请求不存在的 `/pagefind/pagefind.js`；搜索回归应使用 build + preview。

## 结论

ClientRouter 对本站仍有价值，因为跨页音乐是明确需求。成熟的做法不是把所有页面做成持久化 SPA，而是把持久化范围限制在播放器，让每个页面拥有自己的挂载和销毁生命周期。

项目协作规则见 `AGENT.md`，整体结构见 `docs/architecture.md`。
