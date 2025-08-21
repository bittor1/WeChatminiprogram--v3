# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个名为"伦敦必吃榜"的微信小程序项目，采用混合架构：
- 前端：微信小程序原生开发（使用原生JS，非框架）
- 后端：基于微信云开发（Cloud Functions）
- 部分页面使用了 Next.js（但主要是小程序项目）

## 常用开发命令

### 小程序开发
```bash
# 使用微信开发者工具打开项目
# 项目AppID: wx29cb754190a5c042

# 云函数本地调试
# 在微信开发者工具中右键云函数文件夹 -> 本地调试

# 上传云函数
# 在微信开发者工具中右键云函数文件夹 -> 上传并部署
```

### Next.js 部分（如果需要）
```bash
npm run dev      # 开发模式
npm run build    # 构建项目
npm run lint     # 代码检查
npm run start    # 生产环境运行
```

## 项目架构

### 小程序端结构
- `/pages/` - 小程序页面
  - `index` - 首页（排行榜）
  - `detail` - 餐厅详情页
  - `create` - 创建提名页
  - `my-nominations` - 我的提名
  - `my-votes` - 我的投票
  - `orders` - 订单页面
  - `deeds-wall` - 善行墙
  - `report-deed` - 汇报善行
- `/components/` - 自定义组件
  - `auth-dialog` - 授权对话框组件
- `/utils/` - 工具函数
- `/service/` - 服务层代码

### 云函数结构
- `/cloudfunctions/` - 所有云函数
  - `userManage` - 用户管理（登录、获取用户信息）
  - `nominationManage` - 提名管理
  - `voteManage` - 投票管理
  - `commentManage` - 评论管理
  - `contentReview` - 内容审核
  - `statistics` - 统计功能
  - `search` - 搜索功能
  - `dbInit` - 数据库初始化

### 数据库集合
- `users` - 用户信息
- `entries` - 餐厅提名条目
- `votes` - 投票记录
- `comments` - 评论记录
- `orders` - 订单记录

## 关键技术点

### 云开发环境
- 环境ID: `cloud1-2g2sby6z920b76cb`
- 所有云函数都需要使用此环境ID初始化

### 用户认证流程
1. 用户点击登录 -> 调用 `wx.getUserProfile` 获取用户信息
2. 上传头像到云存储获取 fileID
3. 调用 `userManage` 云函数的 `login` action
4. 存储用户信息到本地存储

### 文件上传处理
- 所有用户头像和餐厅图片都上传到云存储
- 使用 `wx.cloud.uploadFile` 上传文件
- 数据库中存储的是云存储的 fileID

### API 调用规范
- 所有 API 调用使用相对路径，不使用绝对地址
- 云函数调用使用 `wx.cloud.callFunction`
- 异步操作都需要正确的错误处理

## 注意事项

1. **不要使用已废弃的API**
   - 避免使用 `wx.getUserInfo`（已废弃）
   - 使用 `wx.getUserProfile` 替代

2. **分享功能实现**
   - 使用 `onShareAppMessage` 的 promise 属性处理异步逻辑
   - 朋友圈分享使用 `onShareTimeline`

3. **音频功能**
   - 需要用户授权录音权限
   - 使用 `wx.getRecorderManager()` 管理录音

4. **图片优化**
   - 所有图片使用 `lazy-load` 属性
   - 大图片上传前需要压缩

5. **错误处理**
   - 所有异步操作都需要 try-catch 或 .catch
   - 为用户提供友好的错误提示

6. **数据一致性**
   - 新建的条目初始投票数为0也要显示
   - 避免显示默认测试数据（如"张三"）

## 开发规范

1. **代码风格**
   - 使用2空格缩进
   - 异步函数使用 async/await
   - 适当添加注释说明复杂逻辑

2. **测试要点**
   - 测试新用户注册流程
   - 测试投票功能限制
   - 测试内容审核功能
   - 测试分享奖励机制

3. **性能优化**
   - 使用分页加载大量数据
   - 图片使用懒加载
   - 减少不必要的云函数调用