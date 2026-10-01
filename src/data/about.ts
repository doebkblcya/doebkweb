import catsJson from "./cats.json";
import type { Photo } from "./photos";

/** 关于页正文使用中文；猫咪图片与名字来自 cats.json，页面抬头走 i18n。 */

export interface AboutData {
  /** 页面头下方的引导区 */
  hero: {
    name: string;
    quote: string;
  };
  cats: {
    title: string;
    items: Photo[];
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
  cats: {
    title: "我的猫",
    items: catsJson satisfies Photo[],
  },
  contact: {
    title: "联系",
    github: "https://github.com/doebkblcya",
    email: "doebkblcya@gmail.com",
  },
};
