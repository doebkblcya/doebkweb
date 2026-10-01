/**
 * 关于页内容数据 — 唯一数据源（类比 src/data/albums.json）。
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
    quote: string;
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
    quote: "And it'll be a long time, before you ever see me again, me again",
  },
  contact: {
    title: "联系",
    github: "https://github.com/doebkblcya",
    email: "doebkblcya@gmail.com",
  },
};
