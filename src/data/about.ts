/** 关于页正文使用中文，页面抬头走 i18n；猫咪媒体独立维护在 pets.json。 */

export interface AboutData {
  /** 页面头下方的引导区 */
  hero: {
    name: string;
    intro: string;
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
    intro: "住在上海。\n平时写代码，也拍照、听音乐、玩游戏。\n养过三只猫。",
  },
  contact: {
    title: "联系",
    github: "https://github.com/doebkblcya",
    email: "doebkblcya@gmail.com",
  },
};
