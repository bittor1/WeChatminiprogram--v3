// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const shareCollection = db.collection('share_records')
const _ = db.command
const $ = db.command.aggregate

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  const { action, shareData } = event
  
  // 根据不同的操作执行不同的功能
  switch (action) {
    case 'recordShare':
      return await recordShare(OPENID, shareData)
    case 'recordShareClick':
      return await recordShareClick(event.shareId)
    case 'getShareStats':
      return await getShareStats(OPENID, event.nominationId)
    case 'getUserShares':
      return await getUserShares(OPENID)
    case 'getPopularShares':
      return await getPopularShares(event.limit || 10)
    default:
      return {
        success: false,
        message: '未知操作类型'
      }
  }
}

/**
 * 记录分享行为
 * @param {string} openid 用户的openid
 * @param {object} shareData 分享数据
 */
async function recordShare(openid, shareData) {
  if (!shareData || !shareData.type || !shareData.targetId) {
    return {
      success: false,
      message: '缺少分享数据'
    }
  }
  
  try {
    // 获取用户信息
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (!userRes.data || userRes.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      }
    }
    
    const userId = userRes.data[0]._id
    
    // 构建分享记录数据
    const shareRecord = {
      userId: userId,
      type: shareData.type, // ranking, profile, timeline, nomination
      targetId: shareData.targetId, // 被分享的对象ID
      platform: shareData.platform || 'wechat', // 分享平台: wechat, timeline
      title: shareData.title || '', // 分享标题
      path: shareData.path || '', // 小程序路径
      clicks: 0, // 点击次数
      createTime: db.serverDate(),
      _createTime: Date.now()
    }
    
    // 添加分享记录
    const result = await shareCollection.add({
      data: shareRecord
    })
    
    // 如果是提名分享，更新提名的分享计数
    if (shareData.type === 'nomination') {
      await db.collection('entries').doc(shareData.targetId).update({
        data: {
          shareCount: _.inc(1)
        }
      })
    }
    
    // 如果是朋友圈分享，增加一个朋友圈分享计数
    if (shareData.platform === 'timeline') {
      // 更新用户的朋友圈分享计数
      await db.collection('users').doc(userId).update({
        data: {
          timelineShareCount: _.inc(1)
        }
      }).catch(err => {
        // 忽略错误，不影响主流程
        console.error('更新用户朋友圈分享计数失败:', err);
      });
      
      // 如果是针对特定内容的朋友圈分享
      if (shareData.type === 'nomination' || shareData.type === 'profile') {
        await db.collection('entries').doc(shareData.targetId).update({
          data: {
            timelineShareCount: _.inc(1)
          }
        }).catch(err => {
          // 忽略错误，不影响主流程
          console.error('更新提名朋友圈分享计数失败:', err);
        });
      }
    }
    
    return {
      success: true,
      message: '分享记录成功',
      data: {
        shareId: result._id
      }
    }
  } catch (err) {
    console.error('记录分享失败:', err)
    return {
      success: false,
      message: '记录分享失败',
      error: err.message
    }
  }
}

/**
 * 记录分享被点击
 * @param {string} shareId 分享记录ID
 */
async function recordShareClick(shareId) {
  if (!shareId) {
    return {
      success: false,
      message: '缺少分享ID'
    }
  }
  
  try {
    // 更新分享点击次数
    await shareCollection.doc(shareId).update({
      data: {
        clicks: _.inc(1),
        lastClickTime: db.serverDate()
      }
    })
    
    // 获取分享记录
    const shareRes = await shareCollection.doc(shareId).get()
    
    // 如果是提名分享，更新提名的分享点击计数
    if (shareRes.data && shareRes.data.type === 'nomination') {
      await db.collection('entries').doc(shareRes.data.targetId).update({
        data: {
          shareClicks: _.inc(1)
        }
      })
    }
    
    return {
      success: true,
      message: '记录点击成功'
    }
  } catch (err) {
    console.error('记录分享点击失败:', err)
    return {
      success: false,
      message: '记录分享点击失败',
      error: err.message
    }
  }
}

/**
 * 获取特定提名的分享统计
 * @param {string} openid 用户的openid
 * @param {string} nominationId 提名ID
 */
async function getShareStats(openid, nominationId) {
  if (!nominationId) {
    return {
      success: false,
      message: '缺少提名ID'
    }
  }
  
  try {
    // 获取提名的分享统计
    const shareStats = await shareCollection.aggregate()
      .match({
        type: 'nomination',
        targetId: nominationId
      })
      .group({
        _id: null,
        shareCount: $.sum(1),
        clickCount: $.sum('$clicks'),
        platforms: $.addToSet('$platform')
      })
      .end()
    
    // 获取用户对该提名的分享次数
    let userShareCount = 0
    let userClickCount = 0
    
    if (openid) {
      // 获取用户信息
      const userRes = await db.collection('users').where({
        openid: openid
      }).get()
      
      if (userRes.data && userRes.data.length > 0) {
        const userId = userRes.data[0]._id
        
        // 获取用户对该提名的分享统计
        const userShareStats = await shareCollection.aggregate()
          .match({
            userId: userId,
            type: 'nomination',
            targetId: nominationId
          })
          .group({
            _id: null,
            shareCount: $.sum(1),
            clickCount: $.sum('$clicks')
          })
          .end()
        
        if (userShareStats.list.length > 0) {
          userShareCount = userShareStats.list[0].shareCount
          userClickCount = userShareStats.list[0].clickCount
        }
      }
    }
    
    return {
      success: true,
      data: {
        totalShares: shareStats.list.length > 0 ? shareStats.list[0].shareCount : 0,
        totalClicks: shareStats.list.length > 0 ? shareStats.list[0].clickCount : 0,
        platforms: shareStats.list.length > 0 ? shareStats.list[0].platforms : [],
        userShares: userShareCount,
        userClicks: userClickCount,
        conversionRate: userShareCount > 0 ? (userClickCount / userShareCount * 100).toFixed(2) + '%' : '0%'
      }
    }
  } catch (err) {
    console.error('获取分享统计失败:', err)
    return {
      success: false,
      message: '获取分享统计失败',
      error: err.message
    }
  }
}

/**
 * 获取用户的分享记录
 * @param {string} openid 用户的openid
 */
async function getUserShares(openid) {
  try {
    // 获取用户信息
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (!userRes.data || userRes.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      }
    }
    
    const userId = userRes.data[0]._id
    
    // 获取用户分享记录
    const sharesRes = await shareCollection
      .where({
        userId: userId
      })
      .orderBy('createTime', 'desc')
      .get()
    
    // 获取分享的提名信息
    const nominationShares = sharesRes.data.filter(share => share.type === 'nomination')
    const nominationIds = [...new Set(nominationShares.map(share => share.targetId))]
    
    // 批量获取提名信息
    let nominationsMap = {}
    if (nominationIds.length > 0) {
      const nominationsRes = await db.collection('entries')
        .where({
          _id: _.in(nominationIds)
        })
        .get()
      
      nominationsMap = nominationsRes.data.reduce((map, nomination) => {
        map[nomination._id] = nomination
        return map
      }, {})
    }
    
    // 合并分享记录和提名信息
    const shares = sharesRes.data.map(share => {
      const result = {
        id: share._id,
        type: share.type,
        platform: share.platform,
        clicks: share.clicks,
        date: share.createTime
      }
      
      // 添加提名信息（如果有）
      if (share.type === 'nomination' && nominationsMap[share.targetId]) {
        const nomination = nominationsMap[share.targetId]
        result.nomination = {
          id: nomination._id,
          name: nomination.name,
          avatar: nomination.avatarUrl,
          votes: nomination.votes
        }
      }
      
      return result
    })
    
    return {
      success: true,
      data: shares
    }
  } catch (err) {
    console.error('获取用户分享记录失败:', err)
    return {
      success: false,
      message: '获取用户分享记录失败',
      error: err.message
    }
  }
}

/**
 * 获取热门分享
 * @param {number} limit 返回数量限制
 */
async function getPopularShares(limit = 10) {
  try {
    // 获取被分享最多的提名
    const popularNominations = await shareCollection
      .aggregate()
      .match({
        type: 'nomination'
      })
      .group({
        _id: '$targetId',
        shareCount: $.sum(1),
        clickCount: $.sum('$clicks')
      })
      .sort({
        shareCount: -1
      })
      .limit(limit)
      .end()
    
    // 获取提名详情
    const nominationIds = popularNominations.list.map(item => item._id)
    
    if (nominationIds.length === 0) {
      return {
        success: true,
        data: []
      }
    }
    
    const nominationsRes = await db.collection('entries')
      .where({
        _id: _.in(nominationIds)
      })
      .get()
    
    // 构建提名ID到提名信息的映射
    const nominationsMap = {}
    nominationsRes.data.forEach(nomination => {
      nominationsMap[nomination._id] = nomination
    })
    
    // 合并分享统计和提名信息
    const result = popularNominations.list.map(item => {
      const nomination = nominationsMap[item._id] || {
        name: '未知提名',
        avatarUrl: '/public/placeholder.jpg',
        votes: 0
      }
      
      return {
        id: item._id,
        name: nomination.name,
        avatar: nomination.avatarUrl,
        votes: nomination.votes,
        shareCount: item.shareCount,
        clickCount: item.clickCount,
        conversionRate: item.shareCount > 0 ? (item.clickCount / item.shareCount * 100).toFixed(2) + '%' : '0%'
      }
    })
    
    return {
      success: true,
      data: result
    }
  } catch (err) {
    console.error('获取热门分享失败:', err)
    return {
      success: false,
      message: '获取热门分享失败',
      error: err.message
    }
  }
} 