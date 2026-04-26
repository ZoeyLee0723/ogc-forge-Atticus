<h1 align="center">OGCForge - 基于 OGC 协议的空间数据与分析平台</h1>

<p align="center">   
  <img src="https://img.shields.io/badge/Vue-3.x-brightgreen" alt="Vue 3"/>   
  <img src="https://img.shields.io/badge/OpenLayers-7.x-%231f6fab" alt="OpenLayers"/>   
  <img src="https://img.shields.io/badge/Node.js-18+%20339933?logo=node.js&logoColor=white" alt="Node.js"/>   
  <img src="https://img.shields.io/badge/PostGIS-3.x-%233e9cb6" alt="PostGIS"/>   
  <img src="https://img.shields.io/badge/GeoServer-2.24+-green?logo=geoserver" alt="GeoServer"/>   
  <br>   
  <sub>🔨 Built with ❤️ by Developers, for Geographers</sub>
</p>

## 🌟 致谢

这是我的第一个开源项目。在此，我要特别感谢过去那个在课堂上认真听课的自己，感谢老师的悉心指导，感谢同学们的陪伴，同时也深深感激 AI 助手与开源社区提供的强大助力。没有你们的启发与支撑，就没有这个项目的诞生。

## 📖 项目简介

**OGCForge** 是一个用于演示基于 OGC (Open Geospatial Consortium) 协议的空间数据增删改查及空间分析的全栈实战平台。本项目旨在打通前端可视化与后端空间计算的生命周期，展示如何在现代 Web 架构下优雅地处理地理空间数据。

核心能力包括：

- **标准化数据交互**：严格遵循 OGC WFS 协议，实现对空间要素的完整 CRUD（增删改查）操作。
- **多引擎空间分析**：突破单一计算瓶颈，创新性地集成了三种缓冲区分析引擎，横向对比了不同架构下的空间计算模式。

## ✨ 核心功能特点

### 1. 基于 WFS 的空间数据管理

全面接入 OGC Web Feature Service (WFS) 协议，不仅能在地图上渲染空间要素，更支持通过前端交互直接对 GeoServer 数据源进行事务操作（WFS-T），包括属性更新、要素删除与新增。

### 2. 全栈缓冲区空间分析

平台提供了三种截然不同的缓冲区分析方案，覆盖了从纯前端到数据库内核的全链路计算场景：

- **🎨 前端计算**：使用 `Turf.js` 在浏览器端进行轻量级、零延迟的快速空间分析，适合小范围预览。
- **⚙️ 服务端计算**：遵循 OGC WPS (Web Processing Service) 协议，依托 GeoServer 的 WPS 扩展进行规范化的服务端空间分析。
- **🚀 数据库内核计算**：直连 `PostgreSQL + PostGIS`，利用 `::geography` 球面数据类型进行高精度、米制单位的硬核空间计算，彻底避免椭球变形问题，适合海量数据与企业级场景。

## 🗂 目录

- [环境依赖](#环境依赖)
- [安装步骤](#安装步骤)
- [使用方法](#使用方法)
- [项目结构](#项目结构)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

## 🔧 环境依赖

在开始安装之前，请确保您的系统已准备好以下环境[3](@ref)[8](@ref)：

- **Node.js** >= 16.0
- **PostgreSQL** (需安装 PostGIS 扩展)
- **GeoServer** >= 2.24 (**必须安装 WPS 扩展包**，否则无法使用 WPS 空间分析功能)

## 🚀 安装步骤

为了完整运行本项目的所有功能，您需要按照以下顺序配置环境与数据[2](@ref)[8](@ref)：

### 1. 数据库准备与数据导入

本项目依赖 PostgreSQL + PostGIS 存储空间数据。为保证前端 WFS 事务与后端 API 能直连成功，请**严格按照以下配置**创建数据库：

- **用户名**: `postgres`
- **密码**: `123456`
- **数据库名**: `ogcforge`

创建数据库后，请启用 PostGIS 扩展，并将项目 `src/data` 目录下提供的图层数据，通过 PostGIS 自带的工具（如 `shp2pgsql` 或 PGAdmin 的导入功能）原封不动地加载至 `ogcforge` 数据库中。

### 2. GeoServer 配置与图层发布

- 确保您的 GeoServer 已安装 **WPS 扩展包**。
- 在 GeoServer 中建立指向 `ogcforge` 数据库的存储仓，并发布对应的图层。
- 🎬 **详细配置与发布操作，请观看我的 B站视频教程：** [点击前往 B站 观看配置教程](*此处替换为你的B站视频链接*)

### 3. 启动 PostGIS 分析后端

若需使用基于 PostGIS 的高精度缓冲区分析功能，需启动 Node.js 中间件：

````bash
# 进入 node-server 目录
cd node-server

# 安装依赖
npm install

# 确认 .env 文件中的数据库配置正确 (默认已匹配上述数据库配置)
# DB_USER=postgres
# DB_PASSWORD=123456
# DB_NAME=ogcforge

# 启动服务
node server.js

### 4. 启动前端开发服务器
回到项目根目录，启动 Vue 前端：
```bash
# 安装依赖
npm install

# 运行项目
npm run dev
````

## 🎮 使用方法

- **空间数据增删改查**：在地图上点击任意要素，弹出的属性面板中可直接进行属性的编辑与保存（WFS-T更新），或执行要素的删除操作（WFS-T删除）。
- **缓冲区空间分析**：选中要素后，在属性面板中选择分析模式：
  - 点击 **Turf缓冲** 进行前端快速计算。
  - 点击 **WPS缓冲** 发起 GeoServer WPS 服务端计算。
  - 点击 **数据库缓冲** 调用 Node.js + PostGIS 后端进行高精度球面计算。
  - 输入半径（米）并确认，即可在地图上查看分析结果。

## 📁 项目结构

清晰展示项目的文件组织结构，让用户快速理解代码布局：

```
OGCForge/
├── node-server/           # PostGIS 缓冲区分析 Node.js 后端
│   ├── server.js          # Express 服务入口与 SQL 逻辑
│   └── package.json
├── src/
│   ├── api/ogc/           # WFS 事务请求封装
│   ├── assets/            # 静态资源
│   ├── components/        # Vue 组件 (含要素编辑弹窗等)
│   ├── composables/       # 核心组合式函数 (Turf/WPS/PostGIS分析逻辑)
│   ├── data/              # 🗄️ 项目所需导入的图层数据
│   └── App.vue
├── package.json
└── README.md
```

## 🤝 贡献指南

我们非常欢迎并感谢任何形式的贡献！良好的贡献指南能够规范项目贡献者的协作行为，促进开源生态建设。请遵循以下流程：

1. Fork 本仓库
2. 创建特性分支 (git checkout -b feature/AmazingSpatialFeature)
3. 提交更改 (git commit -m 'Add some AmazingSpatialFeature')
4. 推送到分支 (git push origin feature/AmazingSpatialFeature)
5. 发起 Pull Request

## 📄 许可证

本项目采用 MIT 许可证开源。开放源代码许可协议更容易为他人作出贡献，而不必寻求特别的许可，同时它也可以保护你作为原创者的权利。详情请参阅 LICENSE 文件。
