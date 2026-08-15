/**
 * 关于页内容数据 — 唯一数据源（类比 src/data/music.json）。
 *
 * ⚠️ 当前为占位初稿，沿用旧 about.md 的通用文案。站长自行填写：
 * 替换各字段文本即可，页面结构与样式无需改动。
 *
 * 约定：
 * - 整页均为内容，仅中文、不翻译；只有页面抬头（"关于我"）走 i18n（t.about.title）
 * - `href` 为站点内相对路径（不含语言前缀），页面组件按当前 locale 拼 `/${lang}${href}`
 */

export interface SpaceCard {
  /** 卡片标题（中文，内容不翻译） */
  title: string;
  /** 卡片描述（中文） */
  description: string;
  /** 站点内相对路径，如 "/docs/"（不含语言前缀） */
  href: string;
}

export interface AboutData {
  /** 页面头下方的引导区 */
  hero: {
    name: string;
    tagline: string;
  };
  /** 自述分区（标题 + 段落均为内容） */
  intro: {
    title: string;
    paragraphs: string[];
  };
  /** 空间导览分区（这个空间里有什么） */
  space: {
    title: string;
    cards: SpaceCard[];
  };
  /** 联系分区 */
  contact: {
    title: string;
    github: string;
    email: string;
  };
}

export const about: AboutData = {
  hero: {
    name: "doebkblcya",
    tagline: "你好，我是 doebkblcya。",
  },

  intro: {
    title: "自述",
    paragraphs: [
      "喜欢把折腾过的技术问题整理成文档，这也是这个站点存在的理由。",
      "搭建这个站点的底层动力是：有一个完全属于自己的写作空间——不依赖第三方平台、不面向算法优化，纯纯地记录和整理。",
    ],
  },

  space: {
    title: "这个空间里有什么",
    cards: [
      {
        title: "技术文档",
        description: "部署、工具链、开发实践与技术踩坑记录",
        href: "/docs/",
      },
      {
        title: "摄影",
        description: "照片墙与拍摄札记",
        href: "/photos/",
      },
      {
        title: "音乐",
        description: "唱片架与常听专辑",
        href: "/music/",
      },
    ],
  },

  contact: {
    title: "联系",
    github: "https://github.com/doebkblcya",
    email: "doebkblcya@gmail.com",
  },
};
