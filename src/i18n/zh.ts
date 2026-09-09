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
    menu: "菜单",
  },

  home: {
    quote: "代码是写给人看的，顺便能在机器上运行。",
    welcome: "你好，我是 doebkblcya",
  },

  about: {
    title: "关于我",
    description: "关于 doebkblcya — 个人简介与技术笔记",
  },

  docs: {
    title: "文档",
    description: "技术文档知识库 — 部署、工具链与开发实践",
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
    description: "唱片架 — 黑胶风格音乐播放器与专辑收藏",
    emptyList: "暂无音乐",
    sortAlbum: "专辑名",
    sortArtist: "歌手",
    searchPlaceholder: "搜索专辑或曲目…",
    noResults: "未找到匹配的专辑或曲目",
  },

  photos: {
    title: "摄影",
    description: "摄影画廊 — 照片墙与拍摄札记",
    emptyList: "暂无照片，敬请期待。",
    noNote: "暂无札记",
    viewTimeline: "时间线",
    viewWall: "照片墙",
    searchPlaceholder: "搜索摄影札记…",
    noResults: "无结果",
    loadError: "图片加载失败",
    viewLabel: "照片显示方式",
    close: "关闭照片",
    previous: "上一张",
    next: "下一张",
  },

  notFound: {
    title: "页面未找到",
    description: "你访问的页面不存在，或者已被移动到其他位置。",
    backHome: "返回首页",
  },

  theme: {
    appearance: "外观",
    light: "浅色",
    dark: "深色",
    auto: "自动",
  },

  player: {
    musicPlayer: "音乐播放器",
    idle: "未在播放",
    previous: "上一首",
    play: "播放",
    pause: "暂停",
    next: "下一首",
    playlist: "播放列表",
    notes: "札记",
    volume: "静音或恢复音量",
    volumeSlider: "音量",
    shelf: "专辑架",
  },

  common: {
    skipToContent: "跳至内容",
    settings: "设置",
  },
};
