# Pull Request: 修复页面加载死循环问题

## 问题描述
在 `pages/index/index.js` 中存在死循环问题，会导致页面不断刷新：
- `onLoad` 调用 `refreshData`
- `onShow` 检查数据为空时调用 `refreshData`
- `loadData` 数据为空时也调用 `refreshData`
- 如果数据加载失败，会形成无限循环

## 修复方案

### 1. 添加状态控制 (pages/index/index.js)
```javascript
data: {
  // ... 其他数据
  isRefreshing: false, // 防止重复刷新
  hasInitialized: false // 标记是否已初始化
}
```

### 2. 修改 onShow 逻辑
```javascript
onShow() {
  // 如果已经初始化过，使用常规加载
  if (this.data.hasInitialized) {
    this.loadData();
  }
  // 否则等待 onLoad 中的初始化完成
}
```

### 3. 修改 loadData 方法
- 移除了数据为空时自动调用 `refreshData` 的逻辑

### 4. 改进 refreshData 方法
- 添加 `isRefreshing` 检查，防止重复刷新
- 完成后设置 `hasInitialized = true`
- 错误时也要重置状态

### 5. 优化 app.js
- 将查询限制从 20 条增加到 50 条
- 改进错误处理，返回空数组而不是拒绝 Promise

## 测试建议
1. 正常启动测试 - 确保数据正常加载
2. 网络错误测试 - 模拟网络错误，确保不会死循环
3. 页面切换测试 - 多次切换页面，确保状态正常

## 影响范围
- pages/index/index.js
- app.js

其他文件的修改主要是代码格式化和文档更新。