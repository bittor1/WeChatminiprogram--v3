# Search Logs Collection Structure

## 集合名称
search_logs

## 权限设置
- 读取：仅管理员
- 写入：仅云函数

## 字段结构

| 字段名称 | 类型 | 必填 | 描述 |
| ------- | ---- | ---- | ---- |
| _id | string | 是 | 文档ID，系统自动生成 |
| keyword | string | 是 | 搜索关键词，统一小写处理 |
| createTime | date | 是 | 搜索记录创建时间 |

## 索引设置

| 索引字段 | 排序方向 | 说明 |
| ------- | ------- | ---- |
| keyword | 升序 | 用于查询特定关键词的搜索记录 |
| createTime | 降序 | 用于按时间排序 |

## 查询示例

### 1. 获取最近的搜索记录
```javascript
db.collection('search_logs')
  .orderBy('createTime', 'desc')
  .limit(100)
  .get()
```

### 2. 获取热门搜索关键词
```javascript
const db = cloud.database()
const $ = db.command.aggregate

db.collection('search_logs')
  .aggregate()
  .group({
    _id: '$keyword',
    count: $.sum(1)
  })
  .sort({
    count: -1
  })
  .limit(10)
  .end()
```

### 3. 获取特定时间段内的搜索趋势
```javascript
const db = cloud.database()
const $ = db.command.aggregate
const _ = db.command
const oneWeekAgo = new Date()
oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

db.collection('search_logs')
  .aggregate()
  .match({
    createTime: _.gte(oneWeekAgo)
  })
  .group({
    _id: {
      keyword: '$keyword',
      day: $.dateToString({
        date: '$createTime',
        format: '%Y-%m-%d'
      })
    },
    count: $.sum(1)
  })
  .group({
    _id: '$_id.keyword',
    dailyCounts: $.push({
      date: '$_id.day',
      count: '$count'
    }),
    totalCount: $.sum('$count')
  })
  .sort({
    totalCount: -1
  })
  .limit(10)
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

1. **定期清理触发器**：每月自动清理超过3个月的搜索日志记录，以节省存储空间。

```javascript
exports.main = async (event, context) => {
  const db = cloud.database();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  try {
    const result = await db.collection('search_logs')
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

1. 搜索日志仅记录有意义的关键词（长度大于1的关键词）。

2. 关键词统一转为小写存储，便于统计和分析。

3. 搜索日志应当设置适当的TTL（Time-To-Live）或定期清理，避免过度积累。

4. 搜索日志数据可用于改进搜索功能和用户体验，例如提供热门搜索建议。 