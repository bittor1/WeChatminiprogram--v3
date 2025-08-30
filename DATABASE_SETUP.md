# 数据库设置说明

## 问题描述
当前遇到以下错误：
- 点赞失败：`collection.get:fail -502005 database collection not exist`
- 删除失败：`document.update:fail -502005 database collection not exist`

## 原因分析
云函数中引用的数据库集合 `comments` 和 `comment_likes` 不存在。

## 解决方案
已经修复了 `cloudfunctions/dbInit/index.js` 文件，添加了缺失的集合创建逻辑。

### 新增集合
1. **comments** - 评论记录集合
2. **comment_likes** - 评论点赞记录集合

### 新增索引
**注意：微信云开发数据库不支持手动创建索引，索引会根据查询模式自动创建**

以下索引将在查询时自动创建：
- `comments.createTime` - 按创建时间排序
- `comments.nominationId` - 按提名ID查询
- `comments.parentId` - 按父评论ID查询子评论
- `comments._openid` - 按用户openid权限验证
- `comment_likes.commentId` - 按评论ID查询点赞
- `comment_likes.userId` - 按用户ID查询点赞
- `comment_likes.commentId_userId` - 防止重复点赞的复合唯一索引

## 执行步骤

### 方法1：通过云开发控制台
1. 打开微信开发者工具
2. 进入云开发控制台
3. 找到 `dbInit` 云函数
4. 点击"测试"按钮
5. 输入测试参数：`{"forceInit": true}`
6. 执行云函数

### 方法2：通过代码调用
```javascript
// 在小程序中调用
wx.cloud.callFunction({
  name: 'dbInit',
  data: {
    forceInit: true
  }
}).then(res => {
  console.log('数据库初始化结果:', res);
}).catch(err => {
  console.error('数据库初始化失败:', err);
});
```

## 验证结果
执行成功后，应该看到类似输出：
```
comments集合创建成功
comments集合索引将自动创建
comment_likes集合创建成功
comment_likes集合索引将自动创建
danmakus集合创建成功
danmakus集合索引将自动创建
scanlogin_auth集合创建成功
scanlogin_auth集合索引将自动创建
```

## 注意事项
1. 需要管理员权限或使用 `forceInit: true` 参数
2. 集合创建后，点赞和删除功能应该正常工作
3. 如果仍有问题，检查云函数是否正确部署
