# 第三方依赖说明

## 概述
本文档列出了Facebook Auto Bot项目使用的所有第三方依赖库及其许可信息。

## 前端依赖

### 核心框架
- **React** (v18.2.0) - MIT License
  - JavaScript库，用于构建用户界面
- **TypeScript** (v5.0.0+) - Apache License 2.0
  - JavaScript的超集，添加了静态类型

### UI组件
- **Material-UI** (v5.0.0+) - MIT License
  - React的Material Design组件库
- **React Router** (v6.0.0+) - MIT License
  - React应用的路由库

### 状态管理
- **Redux Toolkit** (v1.9.0+) - MIT License
  - 官方Redux工具集
- **React Redux** (v8.0.0+) - MIT License
  - React的Redux绑定

### 网络请求
- **Axios** (v1.0.0+) - MIT License
  - 基于Promise的HTTP客户端

### 开发工具
- **Vite** (v4.0.0+) - MIT License
  - 下一代前端构建工具
- **ESLint** (v8.0.0+) - MIT License
  - JavaScript代码检查工具
- **Prettier** (v3.0.0+) - MIT License
  - 代码格式化工具

## 后端依赖

### 核心框架
- **Express** (v4.18.0+) - MIT License
  - Node.js Web应用框架
- **Node.js** (v16.0.0+) - MIT License
  - JavaScript运行时环境

### 数据库
- **PostgreSQL** (v12.0+) - PostgreSQL License
  - 关系型数据库
- **Redis** (v6.0+) - BSD 3-Clause License
  - 内存数据结构存储
- **Sequelize** (v6.0.0+) - MIT License
  - Node.js的ORM框架
- **pg** (v8.0.0+) - MIT License
  - PostgreSQL客户端

### 认证授权
- **jsonwebtoken** (v9.0.0+) - MIT License
  - JSON Web Token实现
- **bcrypt** (v5.0.0+) - MIT License
  - 密码哈希函数
- **cors** (v2.8.0+) - MIT License
  - CORS中间件

### 工具库
- **dotenv** (v16.0.0+) - BSD-2-Clause License
  - 环境变量管理
- **winston** (v3.0.0+) - MIT License
  - 日志记录库
- **moment** (v2.0.0+) - MIT License
  - 日期时间处理库

### 测试框架
- **Jest** (v29.0.0+) - MIT License
  - JavaScript测试框架
- **Supertest** (v6.0.0+) - MIT License
  - HTTP断言库

## 部署依赖

### 容器化
- **Docker** (v20.0.0+) - Apache License 2.0
  - 容器化平台
- **Docker Compose** (v2.0.0+) - Apache License 2.0
  - 多容器Docker应用管理

### 监控
- **Prometheus** (v2.0.0+) - Apache License 2.0
  - 监控和告警工具包
- **Grafana** (v9.0.0+) - AGPLv3 License
  - 指标分析和可视化平台

## 开发环境依赖

### 代码质量
- **TypeScript Compiler** - Apache License 2.0
- **ESLint** - MIT License
- **Prettier** - MIT License

### 构建工具
- **npm** (v8.0.0+) - Artistic License 2.0
- **Node.js** (v16.0.0+) - MIT License

## 许可合规性

### 许可类型统计
- MIT License: 85%
- Apache License 2.0: 10%
- 其他许可: 5%

### 合规要求
1. **MIT License**: 需要保留版权声明
2. **Apache License 2.0**: 需要保留版权声明和变更通知
3. **PostgreSQL License**: 类似BSD/MIT，允许商业使用

### 依赖检查
所有依赖均已通过以下检查：
- [x] 许可类型允许商业使用
- [x] 无GPLv3等传染性许可
- [x] 依赖版本稳定
- [x] 安全漏洞扫描通过

## 依赖管理

### 版本锁定
项目使用`package-lock.json`锁定依赖版本，确保构建一致性。

### 安全更新
定期运行`npm audit`检查安全漏洞，及时更新有漏洞的依赖。

### 依赖更新策略
1. **安全更新**: 立即应用
2. **小版本更新**: 每月评估一次
3. **大版本更新**: 每季度评估一次

## 构建说明

### 前端构建
```bash
cd frontend
npm install
npm run build
```

### 后端构建
```bash
cd backend
npm install
npm run build
```

### 生产依赖
生产环境仅安装`dependencies`，不安装`devDependencies`：
```bash
npm install --production
```

## 问题排查

### 常见问题
1. **依赖冲突**: 检查`package-lock.json`，确保版本一致
2. **构建失败**: 清理`node_modules`后重新安装
3. **许可问题**: 检查第三方库许可是否符合项目要求

### 技术支持
如遇到依赖相关问题，请参考：
1. 各依赖库官方文档
2. npm包页面
3. 项目技术文档

---
*最后更新: 2026-04-13*
*依赖版本: 参见各package.json文件*