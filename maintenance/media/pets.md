# 猫咪透明视频

用户提供校准后的透明 PNG 帧与时间线，AI 导出两套透明视频、静态 WebP 封面，上传并验证 R2 后更新 `src/data/pets.json`。上传、版本路径、检查和清理遵守 [媒体维护入口](README.md)；原件保持不变，不提交视频或 PNG 帧到 Git。

## 输入与导出

输入目录按 `猫名/动作/` 组织，每个动作有 `frames/`、`timeline.json` 和 `frames.ffconcat`；现有猫名为小狼、小小狼、小薯，动作待机、歪头、舔爪、打哈欠。时间线各帧含 `file`、`time_ms`、`duration_ms`，ffconcat 相对引用同目录帧。使用校准母版，避免从小尺寸 WebP 再转码。

`tools/prepare-pets.mjs` 从母版导出 360×480、24 fps 的 VP9 透明 WebM 和透明 HEVC MOV，可用 `--width 240` 比较小尺寸。封面取待机首帧，转静态 WebP。输出 `uploads.json` 和 `pets-draft.json`，不上传、不修改网站清单。输入不得被改写，输出必须是新版本目录；已有视频不覆盖。

导出前用 `tools/pet-alpha.mjs` 修正蓝幕抠图在白毛内部留下的半透明方块：主体深处恢复不透明，轮廓附近渐变过渡，保留原有毛发边缘与肢体之间的透明空隙。只修改派生帧的 alpha，不修改母版和 RGB；视频与封面使用同一份修正结果。检查黑底合成时身体是否出现灰块，避免误把抠图问题当成码率问题。

需要 FFmpeg（libvpx-vp9、ProRes 4444 编码）和 macOS 的 Swift/AVFoundation。HEVC 用 `export-pet-hevc.swift` 的原生编码器，保留透明层元数据；不要用普通 HEVC 或 ProRes 4444 作为网页交付文件。处理工具通过参数数组调用编码器，不执行素材中的脚本。

示例由 AI 在项目根目录执行，输入改为用户提供的校准母版目录：

```bash
mkdir -p tmp
swiftc -parse-as-library maintenance/media/tools/export-pet-hevc.swift -o tmp/export-pet-hevc
FFMPEG_BINARY=/absolute/path/to/ffmpeg PET_HEVC_ENCODER="$PWD/tmp/export-pet-hevc" \
  node maintenance/media/tools/prepare-pets.mjs \
  --input /absolute/path/to/校准母版 \
  --output materials/processed/pets-新版本 \
  --version 新版本
```

`--version` 必须是唯一的 ASCII 日期版本，如 `20261004-v2`。上面的“新版本”仅示意，执行时替换。中间 ProRes 导出成功后由工具清理；失败时保留供排查。其他平台先报告缺少原生透明 HEVC 编码环境，不把不透明视频作为兼容版。

## 待机循环与动作资料

需要改善动作切换时，先对单只猫运行本地 `tools/analyze-pet-seams.mjs --input <猫名目录> --output <本地报告.json>`。程序缩为 120×160，比较透明轮廓、亮度与边缘，对头部加权；不调用 AI/API、不上传序列图，只复核少量候选。分数只辅助选帧，实际姿态是否自然由用户播放验收。

导出时增加 `--cat <id> --analysis <报告.json>`，仅生成指定猫的草稿。待机在首尾各半秒内选择接近的边界，补三帧预乘 alpha 过渡；三个交互动作保留全部原帧。验证上传后仅替换这只猫的数据，其余猫保持现状。

已验收的循环选帧保存为 `idleRange`：`first`、`last` 是原始时间线从零起算的索引，`sourceFrames` 是原母版帧数，`loopBlendFrames` 是补充过渡帧数。修改裁切时复用这一范围，不重新筛选或对已截取的片段再次删帧。当前范围：小狼 6～84、小小狼 7～137、小薯 0～144，均补 3 帧过渡。

## 透明留白与脚底对齐

只调整待机裁切时，给导出命令增加 `--idle-only --crop-idle`，并用 `--cat` 和 `--analysis` 传入该猫已验收的选帧范围、保留的 `seams`。只导出待机及封面，草稿中其他动作由 AI 从现有公开清单原样保留，不替换或预加载。

程序扫描全部保留帧的非零 alpha，取轮廓并集作为一个固定矩形，包含尾巴甩动的最大范围；少量边缘余量保留毛发与编码安全边。补充过渡是首尾帧的混合，其轮廓也在并集内。不要按单帧或逐帧分别裁切，不需要 AI 逐张看图，不改变猫的比例、大小或原母版。

待机与封面尺寸随矩形变化，不再强制 3:4。公开 `framing` 保存参考画布尺寸、固定裁切位置、横向锚点和 `footY`（前爪底部在裁切画布中的位置）；从保留段开头五帧测量前爪基线，用中位数减少边缘噪声。关于页使用共同的参考画布缩放比例和前爪基线，保持猫咪各自原有大小；不让每个裁切矩形分别撑满整列。尾巴可以保留在前爪基线下方。`width`、`height` 与 `framing` 当前对应待机及封面，其他动作未来需独立匹配布局资料。

草稿的可选 `seams` 保存 `fps`、`blendMs`，以及各动作的 `startWaitFrames` 和 `returnIdleMs`，供后续动作衔接开发使用。当前网页只播放待机，不读取动作衔接表、不预热其他动作。后续若启用交互，优先处理“待机 → 单个动作 → 待机”，保留动作主体，不要求不同动作直接互切；首尾匹配与短过渡不能保证生成视频的姿态完全一致。

## 验证与录入

1. 解码全部 WebM，确认宽高、时间和 alpha；FFmpeg 解码时显式选择 `libvpx-vp9`，不能仅检查像素格式声明。HEVC 用 `tools/verify-pet-hevc.swift` 的 Apple 原生解码核验透明背景与不透明主体，检查完整帧序列，不只读扩展名或头部。该工具用 `swiftc -parse-as-library` 编译到 tmp 后，以参数数组传入全部 MOV 文件；失败会返回非零。黑白背景的毛发边缘、动作衔接及实际流畅度交给用户手动测试。
2. 按 `uploads.json` 用 Wrangler 上传；WebM 为 `video/webm`，MOV 为 `video/quicktime`，封面为 `image/webp`，使用新 URL 和 immutable 缓存。全部 CDN GET 返回 200、类型和字节数正确，SHA-256 与已核验的本地文件一致后，才将草稿写入公开清单。
3. 数据含 `id`、`name`、`width`、`height`、`poster` 与 `clips`。`clips` 的 `idle/tilt/lick/yawn` 分别有 `webm`、`hevc`、`durationMs`；时长只供维护；当前网页仅使用待机，其他动作字段保留供后续开发。
4. 执行媒体清单校验、Astro 检查、构建、diff 检查。交付本地预览，由用户手动测试 Chrome 与 Safari/iPhone 的透明背景、三猫待机循环、离开视野与后台暂停、切页和移动端布局。未经本次发布授权不提交或推送页面。

## 网页使用与本地交付

当前仅在关于页原有猫咪位置展示三只待机动画及名字，没有悬浮、拖动或点击动作。浏览器只选择一套格式，封面先显示；页面聚焦、猫咪区域进入视野且未被弹层或抽屉覆盖时加载并循环播放。离开视野、失去焦点或切到后台时暂停；减少动态效果或播放失败时保留封面。无脚本时封面仍可阅读。

`src/data/pets.json` 保留其他动作的已上传地址和可选衔接资料供维护，当前页面只输出并加载待机 URL。提高分辨率、帧率或码率前先比较文件体积与真机效果，不承诺透明视频必然使用硬件解码。

用户需要本地交付时，将网站当前已验收的 WebM、HEVC 和封面原样保存到指定素材目录，附路径、R2 来源、时长、帧数和 SHA-256 清单，不再次转码。本项目当前交付位置是用户提供的 Cat Cat 目录下 `网站素材/待机循环优化版/`；原视频、校准 PNG 母版与其他动作保持不变。验收后的临时对比网站、下载缓存和一次性处理脚本按维护入口清理，不把它们纳入生产网站。
