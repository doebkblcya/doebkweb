import type { UIStrings } from "../types/i18n";

export const ui: UIStrings = {
  site: {
    title: "doebkblcya",
    description: "个人站点 — 程序员名片、技术文档、摄影画廊与唱片架",
  },

  nav: {
    home: "首页",
    about: "关于我",
    docs: "文档",
    music: "音乐",
    photos: "摄影",
    github: "GitHub",
  },

  home: {
    quote: "代码是写给人看的，顺便能在机器上运行。",
    welcome: "你好，我是 doebkblcya",
    welcomeSub: "全栈工程师 · 技术写作者",
  },

  about: {
    title: "关于我",
  },

  docs: {
    title: "文档",
    emptyList: "暂无文档",
    published: "发布于",
    updated: "更新于",
    toc: "目录",
    sortNewest: "最新",
    sortOldest: "最早",
    searchPlaceholder: "搜索文档…",
    searchLoading: "搜索中…",
    searchNoResults: "未找到匹配的文档",
    searchEmptyHint: "试试其他关键词",
    searchResultCount: (n: number) => `找到 ${n} 篇文档`,
    searchKeyboard: "↑↓ 导航  ↵ 打开  Esc 关闭",
  },

  music: {
    title: "音乐",
    emptyList: "暂无音乐",
    sortAlbum: "专辑名",
    sortArtist: "歌手",
    searchPlaceholder: "搜索专辑或曲目…",
    noResults: "未找到匹配的专辑或曲目",
  },

  photos: {
    title: "摄影",
    emptyList: "暂无照片，敬请期待。",
    noNote: "暂无札记",
  },

  notFound: {
    title: "页面未找到",
    description: "你访问的页面不存在，或者已被移动到其他位置。",
    backHome: "返回首页",
  },

  common: {
    skipToContent: "跳至内容",
    settings: "设置",
  },
};
