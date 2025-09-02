# Cursor 规则配置完全指南

根据[Cursor官方文档](https://docs.cursor.com/en/context/rules#user-rules)，我已经为您配置了现代化的Cursor规则系统。

## 🎯 已配置的Project Rules

### 📁 目录结构
```
.cursor/rules/
├── precision-execution.mdc     # 精确执行工程师规则 (Always)
└── wechat-compliance.mdc       # 微信小程序合规规则 (Auto Attached)
```

### 📋 规则详情

#### 1. Precision Execution Engineer (精确执行工程师)
- **类型**: Always (始终应用)
- **功能**: 防止AI幻觉，确保任务准确完成
- **作用域**: 全项目
- **文件**: `.cursor/rules/precision-execution.mdc`

#### 2. WeChat Compliance Engineer (微信小程序合规工程师)
- **类型**: Auto Attached (自动附加)
- **功能**: 确保微信小程序代码符合官方规范
- **触发条件**: 处理以下文件时自动激活
  - `**/*.wxml`
  - `**/*.wxss`
  - `**/*.wxs`
  - `**/miniprogram/**/*.js`
  - `**/miniprogram/**/*.ts`
  - `**/cloudfunctions/**/*.js`
  - `**/cloudcontainer/**/*`
  - `**/pages/**/*.js`
  - `**/components/**/*.js`
- **文件**: `.cursor/rules/wechat-compliance.mdc`

## 🌐 需要配置的User Rules (全局规则)

请在Cursor设置中配置以下User Rules：

### 步骤1：打开Cursor设置
- 按 `Ctrl/⌘ + Shift + J` 
- 或 `Ctrl/⌘ + Shift + P` 然后输入 "Cursor Settings"

### 步骤2：导航到User Rules
- 进入 `Cursor Settings → Rules`
- 在User Rules部分添加以下内容：

### 步骤3：添加核心工具集成规则
在User Rules文本框中粘贴：

```
# 核心工具集成 (Core Tools Integration)
# 类型: always (始终应用)
# 描述: 强制使用三个核心工具进行综合分析和反馈

每次回答时，必须按顺序使用以下三个核心工具进行综合分析和确认：

## 1. Sequential Thinking (必须使用)
- 在开始任何任务前，使用Sequential Thinking工具分解和分析问题
- 将复杂任务分解为可管理的步骤
- 在每个关键决策点使用思考过程
- 用于规划、设计和解决方案验证

## 2. Context7 (获取最新技术文档)
- 当涉及技术实现时，使用Context7获取最新的官方文档
- 特别是微信小程序相关的API和规范
- 确保所有技术方案基于最新的官方文档
- 在代码生成前验证API的可用性和正确性

## 3. Interactive Feedback (关键点确认)
- 在每个关键阶段与用户确认方案
- 在实施重大更改前征求用户意见
- 提供项目目录和工作摘要供用户审查
- 确保解决方案符合用户期望

## 使用顺序
1. **首先**：使用Sequential Thinking分析和规划
2. **然后**：使用Context7获取必要的技术文档（如需要）
3. **接着**：执行具体的开发任务
4. **最后**：使用Interactive Feedback与用户确认结果

## 强制要求
- 这三个工具的使用是**强制性的**，不可跳过
- 每次对话都必须遵循这个工作流程
- 即使是简单的任务也要经过思考和确认过程
- 确保所有决策都有充分的思考和用户确认

## 例外情况
- 只有当用户明确表示"不需要确认"或"直接执行"时，才可以跳过Interactive Feedback
- Sequential Thinking在任何情况下都不能跳过
- Context7在涉及技术文档查询时必须使用

# 项目设置
项目类型：微信小程序
云环境：腾讯云开发
主要语言：JavaScript
框架：微信小程序原生框架

# 重要指令
- 严格遵守微信小程序开发规范
- 禁止在WXML中使用函数调用
- 禁止在前端暴露敏感信息
- 确保所有API调用符合微信官方文档
- 始终使用简体中文回复
```

## 🔍 验证配置

### 检查Project Rules
1. 在Cursor中打开项目
2. 按 `Ctrl/⌘ + Shift + J` 打开设置
3. 导航到 `Rules` 部分
4. 应该能看到两个Project Rules：
   - `precision-execution` (Always)
   - `wechat-compliance` (Auto Attached)

### 测试规则激活
1. **测试Always规则**: 开始任何AI对话，应该看到精确执行行为
2. **测试Auto Attached规则**: 打开任何`.wxml`或微信小程序文件，规则应自动激活
3. **测试User Rules**: AI应该始终使用三个核心工具

## 📚 规则类型说明

根据[Cursor官方文档](https://docs.cursor.com/en/context/rules#user-rules)：

| 规则类型 | 描述 | 何时使用 |
|---------|------|---------|
| **Always** | 始终包含在模型上下文中 | 基础行为和核心原则 |
| **Auto Attached** | 当引用匹配glob模式的文件时包含 | 特定文件类型的专门规则 |
| **Agent Requested** | AI决定是否包含，必须提供描述 | 可选的专门知识 |
| **Manual** | 仅在使用@ruleName明确提及时包含 | 按需专门指导 |

## 🔄 规则管理

### 查看活动规则
活动规则会显示在Agent侧边栏中。

### 编辑规则
1. 直接编辑 `.cursor/rules/*.mdc` 文件
2. 或通过 `Cursor Settings > Rules` 界面

### 创建新规则
使用 `New Cursor Rule` 命令或通过设置界面。

### 生成规则
在对话中使用 `/Generate Cursor Rules` 命令从现有对话生成规则。

## 🚨 重要提醒

1. **重启Cursor**: 配置完成后重启Cursor以确保规则加载
2. **版本控制**: `.cursor/rules` 目录已自动加入版本控制
3. **团队共享**: 团队成员clone项目后会自动获得这些规则
4. **User Rules**: 需要每个开发者个人在设置中配置

## ✅ 配置检查清单

- [ ] 创建了 `.cursor/rules` 目录
- [ ] 创建了 `precision-execution.mdc` 文件
- [ ] 创建了 `wechat-compliance.mdc` 文件
- [ ] 在Cursor Settings中配置了User Rules
- [ ] 重启了Cursor IDE
- [ ] 验证规则在设置中可见
- [ ] 测试了规则激活效果

现在您的Cursor IDE已经配置了完整的规则系统，确保AI助手始终遵循精确执行、微信小程序合规和工具使用的最佳实践！


