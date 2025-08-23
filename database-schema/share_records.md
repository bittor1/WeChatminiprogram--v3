# Share Records Collection Structure

## 集合名称
share_records

## 权限设置
- 读取：仅创建者和管理员
- 写入：仅云函数

## 字段结构

| 字段名称 | 类型 | 必填 | 描述 |
| ------- | ---- | ---- | ---- |
| _id | string | 是 | 文档ID，系统自动生成 |
| userId | string | 是 | 分享者的用户ID |
| type | string | 是 | 分享类型：'nomination'(提名),'ranking'(排行榜),'profile'(个人资料) |
| targetId | string | 是 | 分享目标ID（如提名ID、用户ID等） |
| platform | string | 是 | 分享平台：'wechat'(微信),'moments'(朋友圈),'qq'(QQ)等 |
| title | string | 否 | 分享标题 |
| path | string | 是 | 小程序路径，用于跳转 |
| clicks | number | 是 | 点击次数 |
| lastClickTime | date | 否 | 最后点击时间 |
| createTime | date | 是 | 分享记录创建时间 |
| _createTime | number | 是 | 分享记录创建时间戳，用于排序 |

## 索引设置

| 索引字段 | 排序方向 | 说明 |
| ------- | ------- | ---- |
| userId | 升序 | 用于查询用户的分享记录 |
| type, targetId | 升序, 升序 | 用于查询特定类型和目标的分享记录 |
| createTime | 降序 | 用于按时间排序 |

## 查询示例

### 1. 获取用户分享记录
```javascript
db.collection('share_records')
  .where({
    userId: 'user123'
  })
  .orderBy('createTime', 'desc')
  .get()
```

### 2. 获取特定提名的分享记录
```javascript
db.collection('share_records')
  .where({
    type: 'nomination',
    targetId: 'nomination123'
  })
  .get()
```

### 3. 按分享平台统计分享数量
```javascript
const db = cloud.database()
const $ = db.command.aggregate

db.collection('share_records')
  .aggregate()
  .group({
    _id: '$platform',
    count: $.sum(1),
    clicks: $.sum('$clicks')
  })
  .sort({
    count: -1
  })
  .end()
```

### 4. 获取分享最多的提名
```javascript
const db = cloud.database()
const $ = db.command.aggregate

db.collection('share_records')
  .aggregate()
  .match({
    type: 'nomination'
  })
  .group({
    _id: '$targetId',
    count: $.sum(1),
    clicks: $.sum('$clicks')
  })
  .sort({
    count: -1
  })
  .limit(10)
  .end()
```

## 数据库权限设置（JSON格式）

```json
{
  "read": "doc.userId == auth.user_id || auth.is_administrator == true",
  "write": "auth.is_administrator == true"
}
```

## 触发器设置（建议）

1. **分享热度计算触发器**：当分享记录被点击一定次数（如10次）时，触发计算该提名的热度值并更新提名记录。

```javascript
exports.main = async (event, context) => {
  const db = cloud.database();
  const shareId = event.docId;
  
  try {
    // 获取分享记录
    const shareRes = await db.collection('share_records').doc(shareId).get();
    const share = shareRes.data;
    
    // 如果是提名分享且点击数达到阈值
    if (share && share.type === 'nomination' && share.clicks >= 10) {
      // 更新提名热度
      await db.collection('entries').doc(share.targetId).update({
        data: {
          hotLevel: db.command.inc(1)
        }
      });
    }
    
    return { success: true };
  } catch (err) {
    console.error('分享热度计算失败:', err);
    return { success: false, error: err.message };
  }
};
```

## 注意事项

1. 分享记录应当与提名系统紧密集成，当分享带来转化（如投票）时应当有额外奖励机制。

2. 分享点击统计需要防范刷点击行为，可以考虑添加IP限制或用户限制。

3. 分享链接应当支持参数携带，以便于跟踪分享来源和计算转化率。

4. 为避免数据库过大，可以定期归档较早的分享记录或设置TTL。 