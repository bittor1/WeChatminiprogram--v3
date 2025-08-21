# Content Review Logs Collection Structure

## 集合名称
content_review_logs

## 权限设置
- 读取：仅管理员
- 写入：仅云函数

## 字段结构

| 字段名称 | 类型 | 必填 | 描述 |
| ------- | ---- | ---- | ---- |
| _id | string | 是 | 文档ID，系统自动生成 |
| type | string | 是 | 审核类型：'text'(文本),'image'(图片) |
| contentType | string | 是 | 内容类型：'comment'(评论),'nomination'(提名),'avatar'(头像),'unknown'(未知) |
| content | string | 是 | 被审核的内容（图片为URL，文本为内容片段） |
| pass | boolean | 是 | 是否通过审核：true(通过),false(未通过) |
| result | object | 是 | 审核结果详情（微信API返回或错误信息） |
| createTime | date | 是 | 审核记录创建时间 |

## 索引设置

| 索引字段 | 排序方向 | 说明 |
| ------- | ------- | ---- |
| type | 升序 | 用于查询不同类型的审核记录 |
| pass | 升序 | 用于查询通过/未通过的记录 |
| contentType | 升序 | 用于查询不同内容类型的记录 |
| createTime | 降序 | 用于按时间排序 |

## 查询示例

### 1. 获取最近失败的审核记录
```javascript
db.collection('content_review_logs')
  .where({
    pass: false
  })
  .orderBy('createTime', 'desc')
  .limit(20)
  .get()
```

### 2. 获取特定类型内容的审核记录
```javascript
db.collection('content_review_logs')
  .where({
    contentType: 'nomination'
  })
  .orderBy('createTime', 'desc')
  .get()
```

### 3. 获取审核失败率统计
```javascript
const db = cloud.database()
const $ = db.command.aggregate
db.collection('content_review_logs')
  .aggregate()
  .match({
    createTime: db.command.gte(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 最近7天
  })
  .group({
    _id: '$contentType',
    total: $.sum(1),
    passed: $.sum($.cond({ if: '$pass', then: 1, else: 0 })),
    failed: $.sum($.cond({ if: '$pass', then: 0, else: 1 }))
  })
  .end()
```

## 数据库权限设置（JSON格式）

```json
{
  "read": "auth.is_administrator == true",
  "write": "auth.is_administrator == true"
}
```

## 触发器设置（建议）

1. **定期清理触发器**：每月自动清理超过3个月的日志记录，以节省存储空间。

```javascript
exports.main = async (event, context) => {
  const db = cloud.database();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  try {
    const result = await db.collection('content_review_logs')
      .where({
        createTime: db.command.lt(threeMonthsAgo)
      })
      .remove();
    
    return {
      success: true,
      deleted: result.deleted
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
```

## 注意事项

1. 审核日志应当仅记录必要的信息，避免存储完整的敏感内容。

2. 对于文本内容，建议只存储前100个字符，足够用于调试和分析。

3. 日志记录应当设置适当的TTL（Time-To-Live）或定期清理，避免过度积累。

4. 审核失败率过高时应当发出系统告警，可能是内容质量问题或审核系统异常。 