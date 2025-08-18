# Messages Collection Structure

## 集合名称
messages

## 权限设置
- 读取：仅创建者
- 写入：仅管理员和创建者

## 字段结构

| 字段名称 | 类型 | 必填 | 描述 |
| ------- | ---- | ---- | ---- |
| _id | string | 是 | 文档ID，系统自动生成 |
| _openid | string | 否 | 创建者的openid，仅前端创建时自动生成 |
| receiverId | string | 是 | 接收消息的用户ID |
| senderId | string | 否 | 发送消息的用户ID，若为系统消息则为null |
| senderName | string | 是 | 发送者名称，默认为"系统" |
| senderAvatar | string | 是 | 发送者头像URL，默认为占位图片 |
| type | string | 是 | 消息类型：'system'(系统),'vote'(投票),'comment'(评论),'nomination'(提名) |
| content | string | 是 | 消息内容 |
| read | boolean | 是 | 是否已读：false(未读),true(已读) |
| nominationId | string | 否 | 相关提名的ID（如果有） |
| nominationTitle | string | 否 | 相关提名的标题（如果有） |
| readTime | date | 否 | 消息被阅读的时间（如果已读） |
| createTime | date | 是 | 消息创建时间（服务器时间） |
| _createTime | number | 是 | 消息创建时间的时间戳（用于排序） |

## 索引设置

| 索引字段 | 排序方向 | 说明 |
| ------- | ------- | ---- |
| receiverId | 升序 | 用于查询用户收到的消息 |
| read | 升序 | 用于查询未读消息 |
| createTime | 降序 | 用于按时间排序 |

## 查询示例

### 1. 获取用户所有消息
```javascript
db.collection('messages')
  .where({
    receiverId: 'user123'
  })
  .orderBy('createTime', 'desc')
  .get()
```

### 2. 获取用户未读消息
```javascript
db.collection('messages')
  .where({
    receiverId: 'user123',
    read: false
  })
  .orderBy('createTime', 'desc')
  .get()
```

### 3. 获取用户未读消息数量
```javascript
db.collection('messages')
  .where({
    receiverId: 'user123',
    read: false
  })
  .count()
```

### 4. 按类型获取消息
```javascript
db.collection('messages')
  .where({
    receiverId: 'user123',
    type: 'vote'
  })
  .orderBy('createTime', 'desc')
  .get()
```

## 数据库权限设置（JSON格式）

```json
{
  "read": "doc._openid == auth.openid || doc.receiverId == auth.user_id",
  "write": "doc._openid == auth.openid || auth.is_administrator == true"
}
```

## 触发器设置（建议）

1. **新消息通知触发器**：当新消息创建时，可以通过云函数触发器向用户发送订阅消息通知（需要用户事先订阅）。

2. **消息清理触发器**：定期（如每月）清理过期消息（如已读且超过3个月的系统消息）。

## 注意事项

1. 为保证消息的安全性，消息应当由云函数创建和管理，避免直接在小程序端创建消息。

2. 消息应当与用户账户系统深度集成，确保用户ID的一致性。

3. 在显示消息时，应当检查相关的提名或评论是否仍然存在，避免显示已删除内容的相关消息。 