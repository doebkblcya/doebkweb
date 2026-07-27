---
title: "WSL2 环境下 ncm-cli 音频播放方案"
date: 2026-07-26
summary: "在 WSL2 Linux 环境中实现 NetEase Cloud Music CLI 的音频输出配置"
---

# WSL2 环境下 ncm-cli 音频播放方案

## 背景

在 WSL2 Arch Linux 中安装 `ncm-cli`（网易云音乐 CLI）后，终端本身不具备音频播放能力，需要借助 WSLg 自带的 PulseAudio 服务端来实现播放。

## 环境

- **系统**: WSL2 + Arch Linux
- **播放器后端**: mpv
- **音频服务**: WSLg 自带的 PulseAudio Server
- **PulseAudio 地址**: `unix:/mnt/wslg/PulseServer`（WSLg 自动设置）

## 安装

```bash
sudo pacman -S mpv libpulse pulseaudio-utils
```

| 包 | 作用 |
|---|---|
| `mpv` | ncm-cli 的播放后端 |
| `libpulse` | mpv 的 PulseAudio 音频输出支持 |
| `pulseaudio-utils` | 提供 `pactl` 等诊断工具 |

## 验证

```bash
# 确认已连上 WSLg 的 PulseAudio Server
pactl info

# 用 mpv 测试播放
mpv --ao=pulse <音频文件>

# 确认 ncm-cli 配置
ncm-cli config list | grep player
```

## 原理

```
ncm-cli → mpv → libpulse → /mnt/wslg/PulseServer (WSLg) → Windows 音频 → 扬声器
```

WSLg 在 Windows 侧运行 PulseAudio Server，通过 Unix socket (`/mnt/wslg/PulseServer`) 暴露给 WSL2 内的应用。环境变量 `PULSE_SERVER` 由 WSLg 自动设置，值为 `unix:/mnt/wslg/PulseServer`。

## 前提条件

- Windows 10 21H2 或 Windows 11（WSLg 可用）
- WSL2 配置中 systemd 已启用（`/etc/wsl.conf` 中 `[boot] systemd=true`）

## 参考

- [WSLg 架构文档](https://github.com/microsoft/wslg)
