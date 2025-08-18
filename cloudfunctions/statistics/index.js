// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  const { action, timeRange } = event
  
  // 根据不同的操作执行不同的功能
  switch (action) {
    case 'getDashboardStats':
      return await getDashboardStats()
    case 'getRankingTrends':
      return await getRankingTrends(timeRange)
    case 'getUserStats':
      return await getUserStats(OPENID, event.userId)
    case 'getCategoryStats':
      return await getCategoryStats()
    default:
      return {
        success: false,
        message: '未知操作类型'
      }
  }
}

/**
 * 获取首页仪表板统计数据
 */
async function getDashboardStats() {
  try {
    // 获取各类统计数据
    const [
      nominationsCount,
      totalUsers,
      totalVotes,
      todayVotes
    ] = await Promise.all([
      db.collection('entries').count(),
      db.collection('users').count(),
      getTotalVotes(),
      getTodayVotes()
    ])

    // 计算增长率（与昨日相比）
    const yesterdayVotes = await getYesterdayVotes()
    const voteGrowthRate = yesterdayVotes > 0 ? (todayVotes.total / yesterdayVotes - 1) * 100 : 0

    return {
      success: true,
      data: {
        nominationsCount: nominationsCount.total,
        totalUsers: totalUsers.total,
        totalVotes: totalVotes,
        todayVotes: todayVotes.total,
        voteGrowthRate: parseFloat(voteGrowthRate.toFixed(2))
      }
    }
  } catch (err) {
    console.error('获取仪表板统计失败:', err)
    return {
      success: false,
      message: '获取统计数据失败',
      error: err.message
    }
  }
}

/**
 * 获取排名趋势数据
 * @param {string} timeRange 时间范围（week, month, all）
 */
async function getRankingTrends(timeRange = 'week') {
  try {
    let dateFilter = {}
    const now = new Date()
    
    // 根据时间范围设置过滤条件
    if (timeRange === 'week') {
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      dateFilter = _.gte(weekAgo)
    } else if (timeRange === 'month') {
      const monthAgo = new Date(now)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      dateFilter = _.gte(monthAgo)
    }

    // 获取排名前10的条目趋势
    const topNominations = await db.collection('entries')
      .orderBy('votes', 'desc')
      .limit(10)
      .get()

    // 获取每个条目的投票历史
    const trendsData = await Promise.all(
      topNominations.data.map(async (nomination) => {
        let query = db.collection('votes')
          .where({
            targetId: nomination._id
          })
        
        // 添加时间过滤
        if (Object.keys(dateFilter).length > 0) {
          query = query.where({
            createTime: dateFilter
          })
        }
        
        // 按日期分组统计
        const votesAgg = await db.collection('votes')
          .aggregate()
          .match({
            targetId: nomination._id,
            ...(Object.keys(dateFilter).length > 0 ? { createTime: dateFilter } : {})
          })
          .group({
            _id: {
              year: $.dateToString({
                date: '$createTime',
                format: '%Y'
              }),
              month: $.dateToString({
                date: '$createTime',
                format: '%m'
              }),
              day: $.dateToString({
                date: '$createTime',
                format: '%d'
              })
            },
            count: $.sum(1)
          })
          .sort({
            '_id.year': 1,
            '_id.month': 1,
            '_id.day': 1
          })
          .end()

        // 构造趋势数据
        return {
          id: nomination._id,
          name: nomination.name,
          currentVotes: nomination.votes,
          trend: nomination.trend || 'stable',
          dailyVotes: votesAgg.list.map(item => ({
            date: `${item._id.year}-${item._id.month}-${item._id.day}`,
            votes: item.count
          }))
        }
      })
    )

    return {
      success: true,
      data: trendsData
    }
  } catch (err) {
    console.error('获取排名趋势失败:', err)
    return {
      success: false,
      message: '获取排名趋势失败',
      error: err.message
    }
  }
}

/**
 * 获取用户统计数据
 * @param {string} openid 用户的openid
 * @param {string} userId 指定查询的用户ID (可选)
 */
async function getUserStats(openid, userId) {
  try {
    // 获取用户信息
    let userQuery = {}
    if (userId) {
      userQuery._id = userId
    } else {
      userQuery.openid = openid
    }
    
    const userRes = await db.collection('users').where(userQuery).get()
    
    if (!userRes.data || userRes.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      }
    }
    
    const user = userRes.data[0]
    
    // 获取用户提名数量
    const nominationsCount = await db.collection('entries')
      .where({
        createdBy: user._id
      })
      .count()
    
    // 获取用户投票数量
    const votesCount = await db.collection('votes')
      .where({
        userId: user._id
      })
      .count()
    
    // 获取用户收到的投票数量（作为提名人）
    const receivedVotesCount = await db.collection('votes')
      .aggregate()
      .lookup({
        from: 'entries',
        localField: 'targetId',
        foreignField: '_id',
        as: 'entry'
      })
      .match({
        'entry.createdBy': user._id
      })
      .count('total')
      .end()
    
    return {
      success: true,
      data: {
        userId: user._id,
        nominationsCount: nominationsCount.total,
        votesCount: votesCount.total,
        receivedVotesCount: receivedVotesCount.list.length > 0 ? receivedVotesCount.list[0].total : 0
      }
    }
  } catch (err) {
    console.error('获取用户统计失败:', err)
    return {
      success: false,
      message: '获取用户统计失败',
      error: err.message
    }
  }
}

/**
 * 获取分类统计数据
 */
async function getCategoryStats() {
  try {
    // 按分类统计提名数量
    const categoriesAgg = await db.collection('entries')
      .aggregate()
      .group({
        _id: '$category',
        count: $.sum(1),
        totalVotes: $.sum('$votes')
      })
      .sort({
        count: -1
      })
      .end()

    // 处理没有分类的情况
    const result = categoriesAgg.list.map(item => ({
      category: item._id || '未分类',
      count: item.count,
      totalVotes: item.totalVotes,
      averageVotes: parseFloat((item.totalVotes / item.count).toFixed(1))
    }))

    return {
      success: true,
      data: result
    }
  } catch (err) {
    console.error('获取分类统计失败:', err)
    return {
      success: false,
      message: '获取分类统计失败',
      error: err.message
    }
  }
}

/**
 * 获取总投票数
 */
async function getTotalVotes() {
  try {
    const result = await db.collection('entries')
      .aggregate()
      .group({
        _id: null,
        total: $.sum('$votes')
      })
      .end()
    
    return result.list.length > 0 ? result.list[0].total : 0
  } catch (err) {
    console.error('获取总投票数失败:', err)
    return 0
  }
}

/**
 * 获取今日投票数
 */
async function getTodayVotes() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return await db.collection('votes')
      .where({
        createTime: _.gte(today)
      })
      .count()
  } catch (err) {
    console.error('获取今日投票数失败:', err)
    return { total: 0 }
  }
}

/**
 * 获取昨日投票数
 */
async function getYesterdayVotes() {
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const result = await db.collection('votes')
      .where({
        createTime: _.gte(yesterday).and(_.lt(today))
      })
      .count()
    
    return result.total
  } catch (err) {
    console.error('获取昨日投票数失败:', err)
    return 0
  }
} 