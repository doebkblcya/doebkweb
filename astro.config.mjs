import { defineConfig } from 'astro/config';

/**
 * 给 markdown 渲染出的 <table> 包一层 .table-wrap 横向滚动容器，
 * 防止窄屏下列宽被压扁（大表格改为横向滚动）。
 */
function rehypeTableWrap() {
  return function (tree) {
    walk(tree);
  };
  function walk(node) {
    if (!node || !Array.isArray(node.children)) return;
    const wrapped = [];
    for (const child of node.children) {
      if (child.type === "element" && child.tagName === "table") {
        wrapped.push({
          type: "element",
          tagName: "div",
          properties: { className: ["table-wrap"] },
          children: [child],
        });
      } else {
        walk(child);
        wrapped.push(child);
      }
    }
    node.children = wrapped;
  }
}

/**
 * 移除 markdown 正文开头的 h1 —— 与 frontmatter title 渲染的页面标题重复，
 * md 文件保持原样，纯渲染层处理。
 */
function rehypeDropLeadingH1() {
  return function (tree) {
    const kids = tree.children;
    if (kids.length && kids[0].type === "element" && kids[0].tagName === "h1") {
      kids.shift();
    }
  };
}

export default defineConfig({
  site: 'https://www.doebkblcya.com',
  output: 'static',
  markdown: {
    shikiConfig: {
      theme: "github-light",
    },
    rehypePlugins: [rehypeTableWrap, rehypeDropLeadingH1],
  },
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
