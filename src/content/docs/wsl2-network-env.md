---
title: "WSL2 网络环境备忘"
date: 2026-08-07
updated: 2026-08-09
summary: "WSL2 网络与代理实测备忘：代理 env 注入机制、SSH 直连、DNS 污染、FlyClash 混合端口等踩坑结论"
---


> 整理日期：2026-08-07；最近更新：2026-08-09。全部结论基于本机实测（WSL2 + Arch Linux）。
> 场景：网线接入 + FlyClash（Windows 侧，规则模式，**未开 TUN**）+ 镜像网络模式。

## 0. 结论速览（2026-08-07 实测）

1. **代理是「进程级自觉」，不是系统级**：Windows 靠「程序认不认系统代理 API」，WSL 靠「进程 env 有没有 HTTP_PROXY」——两边同构，四个象限（见第 4 节）
2. **WSL 的代理 env 来源**：FlyClash「系统代理」→ Windows 注册表 → WSL `autoProxy` 自动注入，**不是手动配置的**（见 3.1）
3. **SSH 默认不走代理**：裸 TCP 协议不认 HTTP_PROXY；git over SSH 同样直连（见第 7 节）
4. **DNS 污染在路由器/运营商链路，可忽略**：走代理的流量由 FlyClash 自行解析，客户端 DNS 结果无关（见第 5 节）
5. **Windows 侧实测**：7890 客户端 = Edge / QQ / 微信；**Steam 直连**（铁证：45.121.184.101:27018）（见 4.1）
6. **TUN 模式不建议现在开**：收益低（按需配置已覆盖）、风险高（与 dnsTunneling/镜像网络叠加未验证）（见第 8 节）
7. **2026-08-09：WSL 侧全覆盖落地为 `wslproxy` 一键开关**（systemd 全局 + 容器 + SSH，注册在 ~/.zshrc，见第 11 节）
8. **2026-08-09：镜像网络下 iptables REDIRECT 被 WSL2 relay 机制拦截**，经典 redsocks 透明代理方案不可行（见 8.4）
9. **2026-08-09：FlyClash 7890 混合端口的 SOCKS5 是坏的**（HTTP CONNECT 正常、SOCKS5 超时）；SSH ProxyCommand 必须用专用 SOCKS 端口 **7891**
10. **2026-08-09：DNS 污染 4/4 未复现**（间歇性）；systemd 进程配 env 后走代理实测正常（见 8.4 / 第 11 节）

## 1. 物理链路

```
网线 → Realtek 2.5GbE 网卡 → 路由器 192.168.3.1 → 中国移动上海（双栈）
  公网出口：IPv4 120.204.214.222 / IPv6 2409:8a1e:...
  局域网：192.168.3.42/24
```

## 2. WSL2 镜像网络（.wslconfig 关键项）

| 配置 | 作用 |
|---|---|
| `networkingMode=mirrored` | WSL 共享 Windows 物理网卡（eth1 = 192.168.3.42），**无独立 IP，出口与 Windows 相同** |
| `hostAddressLoopback=true` | 宿主机 IP（192.168.3.42）与 WSL 双向互访；**127.0.0.1 在镜像模式下本来就可双向访问**（2026-08-08 修正：旧表述"7890 依赖此机制"有误） |
| `dnsTunneling=true` | DNS 走 Windows 侧代理（nameserver 10.255.255.254） |
| `autoProxy=true` | WSL 自动继承 Windows 系统代理设置 |

**loopback 共享机制（2026-08-09 实测，镜像网络的实现细节，很关键）**：
- 所有 TCP 流量先查 fib 规则 `1: from all ipproto tcp lookup 127/128`，然后才落到 main 表
- 表 127 = `127.0.0.1 via 169.254.73.152 dev loopback0`（loopback0 是 WSL2 专用虚拟设备）
- 表 128 = `192.168.3.42 via 169.254.73.152 dev eth1`
- **影响**：被 NAT 改写目标到 127.0.0.1 的包（REDIRECT/DNAT）会被 relay 按**源地址**判定方向——源不是 127.0.0.1 就当"宿主机发起的连接"转发到 Windows 侧，无人监听则**静默吞掉**（表现为超时，不是拒绝）

## 3. 代理链路（FlyClash）

- **位置**：Windows 侧（`C:\Program Files\FlyClash`），内核为 mihomo.exe，监听 `127.0.0.1:7890`（mixed-port）
- WSL 进程通过 env `HTTP_PROXY/HTTPS_PROXY=http://127.0.0.1:7890` 走代理
- **规则判断（国内直连 / 国外走节点）在 Windows 侧完成**，WSL 只负责把流量丢过去
- 实测出口：
  - 代理访问国内 → `120.204.214.222`（上海移动，直连）
  - 代理访问国外 → `172.104.76.152`（美国 Linode 节点）

### 3.1 代理 env 从哪来（实测链路）

```
① FlyClash 开启「系统代理」开关
② 写入 Windows 注册表：
   HKCU\...\Internet Settings\ProxyEnable  = 1
   HKCU\...\Internet Settings\ProxyServer  = 127.0.0.1:7890
③ .wslconfig 的 autoProxy=true → WSL 启动/新会话时读取注册表
④ 注入进程 env：HTTP_PROXY / HTTPS_PROXY / NO_PROXY（大小写双份）
```

判定依据：`~/.zshrc` 等 4 个 shell 配置文件、`/etc/environment`、`/etc/profile.d` 均无 proxy 配置；注册表实测有值。

**要点**：
- **动态同步**：改 FlyClash 端口后，新开的 WSL 会话自动拿到新端口，无需改任何 WSL 配置
- **NO_PROXY 是 autoProxy 生成的私有网段排除集**（10.* / 172.16-31.* / 192.168.* / localhost）——覆盖 docker 网段 172.17.* 只是私有网段的副产物，不是专门为 Docker 配的
- **配套设计**：autoProxy 注入的是 `127.0.0.1`——镜像模式下 loopback 双向互通（经 WSL2 relay，见第 2 节），`hostAddressLoopback` 管的是宿主机 IP 192.168.3.42 的双向互访（2026-08-08 修正）

## 4. 进程级分流（核心认知：代理是进程级的，不是系统级的）

### 4.1 四个象限（Windows + WSL 对称）

| 进程类型 | 判定方式 | 走代理 | 直连 |
|---|---|---|---|
| Windows 认系统代理的程序 | WinINET/WinHTTP API | **Edge / QQ / 微信**（实测 7890 客户端） | — |
| Windows 不认的程序 | 自研网络栈/raw socket | — | **Steam**（实测直连 45.121.184.101:27018，Steam CM 端口 27000-27050 段） |
| WSL 有 env 的进程 | HTTP_PROXY 存在 | curl / wget / git / pip | — |
| WSL 无 env 的进程 | systemd 服务环境干净 | — | docker daemon / 容器 |

> **为什么 WSL 会分裂**：autoProxy 注入的是「用户交互会话」的 env；systemd 服务（docker daemon 等）env 干净 → 直连。
> **为什么会有「Windows 都走代理」的错觉**：浏览器（最高频程序）默认认系统代理，观感上「好像全走了」；游戏/Steam/原生程序不认，只是看不见。
> **注意**：QQ/微信/Edge「连了 7890」≠「流量绕国外」——规则模式判断为国内目标时仍然直连（出口 120.204.214.222），只是「委托 FlyClash 做路由判断」。

### 4.2 实测数据

| 测试 | 命令 | 结果 |
|---|---|---|
| 直连国内 | `curl --noproxy '*' https://www.baidu.com` | HTTP 200 ✅ |
| 直连国外 | `curl --noproxy '*' https://www.google.com` | 失败 ❌（被墙，符合预期） |
| 代理访问国外 | `curl -x http://127.0.0.1:7890 https://ipinfo.io/ip` | 172.104.76.152（美国节点）✅ |
| 代理访问国内 | `curl -x http://127.0.0.1:7890 https://myip.ipip.net` | 120.204.214.222（规则直连）✅ |
| Windows 7890 客户端 | `Get-NetTCPConnection -RemotePort 7890` | Edge / QQ / WeChatAppEx |
| Windows Steam 连接 | netstat 抓 steam.exe PID | 直连 45.121.184.101:27018（不走 7890） |

> ⚠️ **教训：在 WSL 里测「直连」必须加 `--noproxy '*'`**，否则 curl 静默读取 env 代理，测的全是代理链路（曾把「走代理访问 Google」误判成「IPv4 直连 Google 可通」）。

## 5. DNS（dnsTunneling）

**实际解析链路（2026-08-07 实测修正）：**

```
WSL 进程查询
  → 10.255.255.254（WSL dnsTunneling，只转发不判断）
  → Windows 系统解析器
  → 192.168.3.1（路由器）← 实测：Windows 网卡 DNS 指向路由器
  → 运营商 DNS（中国移动）
  → 国外域名返回假 IP（实测 google.com 被返回 Facebook 的 69.171.235.22）
```

**要点**：
- **FlyClash 没有劫持系统 DNS**（实测网卡 DNS = 192.168.3.1）；污染发生在路由器/运营商链路，来源未定位，但不需要修
- **可以忽略的原因**：
  - 走代理的流量：curl 只发**域名**（HTTP CONNECT / SOCKS5），**由 FlyClash 自己解析**（用它的上游 DNS），客户端 getent 结果完全用不上
  - 直连国内：DNS 正常
  - 直连国外：DNS 对了也被墙，结果没区别
- **唯一的边缘影响**：某个不被墙的海外资源想直连时（公司海外服务器、特定 CDN），假 IP 会连错地方 → 用 `--resolve` / `/etc/hosts` / 换 DNS（如 223.5.5.5）
- **2026-08-09 复测**：google.com / github.com / gitlab.com / raw.githubusercontent.com 本地解析 **4/4 全部为真 IP**（与 DoH 对照一致）→ **污染确认是间歇性的**（8-07 的 google.com→69.171.235.22 未复现）
- **2026-08-09 新增**：SSH 走代理后（wslproxy，ProxyCommand 把域名交给 mihomo 解析），**本地 DNS 污染不再影响 SSH**；终端直连场景仍按上文处理

## 6. Docker 相关推论

1. **docker pull 不走代理** → 需要给 dockerd 单独配代理（systemd drop-in）：
   ```bash
   sudo mkdir -p /etc/systemd/system/docker.service.d
   sudo tee /etc/systemd/system/docker.service.d/proxy.conf > /dev/null <<'EOF'
   [Service]
   Environment="HTTP_PROXY=http://127.0.0.1:7890"
   Environment="HTTPS_PROXY=http://127.0.0.1:7890"
   Environment="NO_PROXY=172.17.0.0/16,localhost,127.0.0.1"
   EOF
   sudo systemctl daemon-reload && sudo systemctl restart docker
   ```
   （daemon 跑在 WSL 主栈，127.0.0.1 可达 FlyClash——**2026-08-09 实测 systemd 进程连 127.0.0.1:7890 正常**）
   > **2026-08-09 更新**：此配置已由 `wslproxy on` 统一接管（systemd 全局注入，见第 11 节），本节保留作手动参考

2. **容器内访问代理不通**：容器里的 127.0.0.1 是容器自己。方案：
   - `--network host`（共享 WSL 网络栈，loopback 机制恢复）
   - 或 FlyClash 开「允许局域网连接」后，容器用 `http://192.168.3.42:7890`

3. **云端 LLM API**：
   - 国内 API（DeepSeek / 通义 / Kimi）→ 容器直连即可 ✅
   - 国外 API（OpenAI / Anthropic / Claude）→ **容器里必须配代理**（第 2 条方案），否则连接超时

## 7. SSH 与代理（实测认知）

**SSH 默认不走代理**——它是裸 TCP 协议（端口 22），根本不识别 `HTTP_PROXY`（那是 HTTP 客户端的约定）。出站、入站两个方向都适用。

| 方向 | 默认行为 | 要代理怎么做 |
|---|---|---|
| 出站（`ssh user@host`） | 直连 | 显式配置（见下） |
| 入站（sshd 服务） | 收直连连接 | 无（没人代理入站） |

**最常踩的坑：Git over SSH**（国内环境典型「HTTPS 快、SSH 慢/超时」的真相）：
```bash
git clone git@github.com:xxx/repo.git   # SSH 通道 → 直连！不走代理
git clone https://github.com/xxx/repo.git  # HTTPS 通道 → 走 http_proxy ✅
```

**让 SSH 走代理**（2026-08-09 已落地，`wslproxy on` 自动配置，见第 11 节）：

- **方案 A（已采用）：`~/.ssh/config` ProxyCommand，代理端口用 7891**
  ```bash
  # wslproxy on 自动写入 ~/.ssh/config（ncat 来自 nmap 包，脚本自动安装）
  # Host 192.168.* 10.* 172.16.* 172.31.* *.local
  #     ProxyCommand none
  # Host *
  #     ProxyCommand ncat --proxy 127.0.0.1:7891 --proxy-type socks5 %h %p
  ```
  ⚠️ **必须用 7891（专用 SOCKS 端口）**：实测本机 7890 混合端口的 SOCKS5 处理是坏的（HTTP CONNECT 正常、SOCKS5 超时；curl 与 ncat 均复现）——最初写 7890 连不上，改 7891 秒通
- **首次连接流程**：接受主机密钥（github.com ED25519 指纹 `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU` = 官方密钥）→ 注册公钥（`ssh-keygen -t ed25519` → `gh ssh-key add ~/.ssh/id_ed25519.pub` 或网页添加）——`Permission denied (publickey)` 是没配密钥，不是代理问题
- **方案 B：proxychains4**（临时用）：`sudo pacman -S proxychains-ng` → `proxychains4 ssh user@host`
- **方案 C：GitHub 专用走 443**（备用）：`ssh -T -p 443 git@ssh.github.com`
- **验证方法**：连接保持期间，WSL `ss -tnp | grep 7891` 与 Windows `Get-NetTCPConnection -LocalPort 7891` 的端口号一一对应（relay 透明桥接），且 ncat 能收到 GitHub 的 `SSH-2.0-...` banner

## 8. TUN 模式（当前未开启）

### 8.1 是什么

| | 系统代理（当前方式） | TUN 模式 |
|---|---|---|
| 原理 | 程序**自愿**交给代理（认设置的才走） | 虚拟网卡（wintun）在**网络层透明拦截**所有 TCP/UDP |
| 谁配合 | 浏览器、有 env 的程序 | 所有程序（游戏、容器、daemon 全部无感） |
| 代价 | 不认的程序裸连（被墙） | 管理员权限；虚拟网卡叠加层 |

### 8.2 弊端（为什么现在不开）

| 弊端 | 具体表现 |
|---|---|
| 与 WSL2 配置可能打架 | 本机有 `dnsTunneling` + `autoProxy`；TUN 默认 DNS 劫持（`dns-hijack: any:53`），两个 DNS 机制叠加有解析紊乱风险——**最大风险点** |
| 虚拟网卡叠加层 | wintun + Hyper-V 虚拟网卡 + 未来 Docker bridge 三层虚拟网络，有 VMware/Hyper-V 冲突案例 |
| WSL/容器行为未验证 | mirrored 模式下 TUN 是否接管 WSL 流量、接管后规则怎么走——需实测 |
| 规则引擎拦截一切 | 规则漏配 → 服务莫名变慢/打不开；排查多一层变量 |
| UDP/游戏走节点变慢 | UDP 经节点转发质量参差，部分节点不支持 |
| 权限与兼容 | 需管理员权限；安全软件/反作弊可能互斥 |
| 性能 | 全部流量过一层虚拟网卡，大流量有吞吐损耗 |

### 8.3 结论与触发开关

**不建议现在开**：本机是精心调好的稳定组合（mirrored + dnsTunneling + autoProxy + 未开 TUN），TUN 引入未验证的新变量；现有痛点（容器代理）有按需替代方案。

**什么时候值得开**：
1. 开始玩需要加速的联机游戏（TUN 唯一不可替代的场景）
2. 容器访问国外 API 成为日常且配置繁琐（开之前**先关 dnsTunneling** 再测）
3. 大量「不认代理的程序」影响工作

**如果开，操作顺序**：记录现状（跑一遍第 10 节诊断命令）→ 开 TUN → 测 WSL DNS（`getent hosts baidu.com`）→ 测容器网络 → 出问题先关 dnsTunneling 对比 → 不行就关 TUN 回到按需配置。

### 8.4 透明代理（redsocks + iptables）实测结论（2026-08-09）

**结论：本机不可行（或需脆弱绕行），已放弃，改用第 11 节的 wslproxy 方案。** 实测过程：

1. **iptables 规则能挂**（nat OUTPUT 计数器增长），但 **REDIRECT 改写目标到 127.0.0.1 的包被 relay 静默吞掉**（见第 2 节 relay 机制）：监听器收不到、Windows 侧 netstat 无记录、无 martian 丢弃；`accept_local` / `route_localnet` / `rp_filter` 全开无效——包根本没走本地投递，是路由层被 relay 拦截
2. **DNAT → 192.168.3.42（eth1 IP）能送达**，但 **SO_ORIGINAL_DST 返回 DNAT 目标**而非原始目标（DNAT 原地更新 conntrack 原始元组）→ redsocks 会自连死循环
3. **TPROXY 不可用**：iptables-nft OUTPUT 链报 `Invalid argument`；nft `tproxy` 报 `Operation not supported`；modprobe xt_TPROXY 无效
4. 理论上可用的绕行 recipe（未完整验证）：**mangle MARK（必须在 nat 之前打标——nat 链内打标的规则永远不执行，NAT 后的包不重走 nat 链）→ REDIRECT → `ip rule add priority 0 fwmark X lookup local`** 直送 local 表绕过 relay
5. 普通 loopback 自连（src=127.0.0.1）正常；绑定 src=192.168.3.42 连 127.0.0.1 失败 → relay 按**源地址**判定：非 loopback 源发往 127.0.0.1 的连接按"宿主机连接"处理

**教训**：WSL2 镜像网络不是标准 Linux 网络栈，网络层透明方案（redsocks/TPROXY）全踩在未文档化实现上；务实路线是应用层配置覆盖（第 11 节）。

## 9. 端口 7890

- **7890 是 Clash 系内核（Mihomo/Clash 家族）约定俗成的默认 mixed-port**：HTTP 代理 + SOCKS5 共用同一端口
- 所以 `HTTP_PROXY=http://127.0.0.1:7890` 是 HTTP 代理；socks5 同样走 `127.0.0.1:7890`
- ⚠️ **2026-08-09 实测修正**：本机 FlyClash 配置下 **7890 混合端口的 SOCKS5 是坏的**（curl/ncat 的 SOCKS5 全超时，HTTP CONNECT 正常）；**SOCKS5 用途必须用 7891**（订阅自带 `socks-port: 7891`，实测正常）。SSH ProxyCommand 即踩此坑
- 常见配套端口：7890（mixed）、7891（socks）、9090（controller，管理 API，WSL 用不到）
- 换端口：FlyClash 设置里改 mixed-port 后，**WSL 的 env 变量自动同步**（autoProxy 机制，新会话生效），无需手动改

## 10. 诊断命令速查

```bash
# 真·直连测试（绕过 env 代理）
curl --noproxy '*' -s -o /dev/null -w "%{http_code}" https://www.baidu.com

# 验证代理链路 + 看出口 IP
curl -x http://127.0.0.1:7890 -s https://ipinfo.io/ip

# 本机监听端口（WSL 侧；Windows 侧的监听要看 netstat）
ss -tlnp | grep -E '7890|11434'

# Windows 侧查 7890 客户端进程（从 WSL 调用）
/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -Command \
  'Get-NetTCPConnection -RemotePort 7890 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique'

# Windows 侧查端口占用
/mnt/c/Windows/System32/netstat.exe -ano | findstr :7890

# 查看当前代理 env
env | grep -i proxy

# 查 Windows 系统代理注册表
/mnt/c/Windows/System32/reg.exe query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer

# SSH 直连测试（GitHub）
ssh -T git@github.com   # 走代理版本：ssh -T -p 443 git@ssh.github.com

# WSL2 镜像网络的 relay 路由（loopback 共享机制）
ip route show table 127; ip route show table 128; ip rule | head
ip route get 127.0.0.1 from 192.168.3.42   # 判定 NAT 后包的真实路由

# 验证 SSH 代理链路（保持连接期间两侧对照，端口号一一对应）
ssh -G github.com | grep proxycommand               # 生效配置
ss -tnp | grep 7891                                  # WSL 侧连接
/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile \
  -Command 'Get-NetTCPConnection -LocalPort 7891 | Select LocalPort,RemoteAddress,RemotePort,OwningProcess'

# systemd 服务进程 env 抽查（有 HTTP_PROXY=走代理，无=直连）
tr '\0' '\n' < /proc/$(pgrep -x ollama | head -1)/environ | grep -i proxy

# wslproxy 开关（见第 11 节）
wslproxy status
```

## 11. wslproxy 一键开关（2026-08-09 新增）

**背景**：WSL 侧"全走代理"落地为**应用层配置覆盖**（而非网络层透明方案——8.4 已说明后者在本机不可行）。

**用法**（函数注册在 ~/.zshrc）：
```bash
wslproxy            # 交互菜单：1=systemd 2=容器 3=SSH 4=全开 5=全关 6=状态 0=退出
wslproxy on         # 全开（等价菜单 4）
wslproxy off        # 全关（还原所有配置）
wslproxy status     # 三行状态
```

**三个部件**：

| 部件 | 写入的配置 | 覆盖 |
|---|---|---|
| systemd 全局 | `/etc/systemd/system.conf.d/proxy.conf`（`DefaultEnvironment`） | 所有 systemd 服务 + cron/timer 子进程 |
| 容器 | `/etc/docker/daemon.json` 的 `proxies` 键（python 合并，保留原有配置） | 容器内 HTTP 流量 |
| SSH | `~/.ssh/config` 标记块（`# >>> wslproxy-managed` 区间，ncat → **7891**） | SSH 全部走代理（私有网段自动排除） |

**使用规则**：开 FlyClash → `wslproxy on`；**关 FlyClash 之前先 `wslproxy off`**——程序不会在代理不可达时自动回退直连，带着失效 env 的服务连国内流量都会失败。

**生效时机**：env 是进程启动时读的——`on` 后已运行的服务需重启（docker 脚本自动重启；ollama 需手动 `systemctl restart ollama`）；WSL 重启后所有进程天然带上。

**日常波及盘点（2026-08-09）**：不配代理时直连的只有 systemd 服务——**ollama 拉模型**（含 `ollama pull hf.co/...`，是 daemon 干活）、docker pull、每月一次的 archlinux-keyring-wkd-sync 定时器；终端里跑的 curl / git / hf / pip 早已走会话 env（第 3 节）。`on` 之后全部覆盖。**验证过的关键事实**：systemd 进程连 127.0.0.1:7890 正常（2026-08-09）；systemd 服务配 env 后默认路径 curl 出口=节点 IP。
