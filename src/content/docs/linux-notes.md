---
title: "Linux 常用命令笔记"
date: 2026-07-18
category: "devops"
summary: "日常开发中常用的 Linux 命令整理，持续更新。"
---

## 文件操作

```bash
# 查找大文件
find . -type f -size +100M

# 批量重命名
for f in *.txt; do mv "$f" "${f%.txt}.md"; done

# 统计代码行数
find . -name "*.ts" | xargs wc -l
```

## 进程管理

```bash
# 查看端口占用
ss -tlnp | grep 3000

# 后台运行并忽略挂断信号
nohup ./server &

# 查看进程树
ps auxf
```

## 网络

```bash
# 测试端口连通性
nc -zv example.com 443

# 查看 DNS 解析
dig +short example.com

# 监控网络流量
iftop
```

## 系统信息

```bash
# 磁盘使用
df -h

# 内存使用
free -h

# 系统负载
uptime
```

这些命令在日常运维和调试中经常用到，记录下来方便查阅。
