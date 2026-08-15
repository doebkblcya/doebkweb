/**
 * 关于页内容数据 — 唯一数据源（类比 src/data/music.json）。
 *
 * ⚠️ 文案为初稿，站长自行修订：
 * 替换各字段文本即可，页面结构与样式无需改动。
 *
 * 约定：
 * - 整页均为内容，仅中文、不翻译；只有页面抬头（"关于我"）走 i18n（t.about.title）
 */

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
    // TODO: 定位语待站长提供（当前为占位）
    tagline: "喜欢把折腾过的事情记下来。",
  },

  intro: {
    title: "自述",
    paragraphs: [
      "我是 doebkblcya，一个喜欢把折腾过的事情「记下来」的人。平时写代码，也拍照、听歌，遇到搞不懂的问题就顺手整理成文档。",
      "这个站最初只是想给自己留一块不被算法和平台定义的地方。这里的文档是写给自己看的笔记，照片是路过的时间，唱片架是按心情排的曲单——都只对自己诚实。",
      "如果你也在折腾类似的东西，或者只是路过，欢迎随便逛逛。某篇笔记帮到了你、某张照片让你停了一下，就是这个空间最开心的事。",
    ],
  },

  contact: {
    title: "联系",
    github: "https://github.com/doebkblcya",
    email: "doebkblcya@gmail.com",
  },
};
