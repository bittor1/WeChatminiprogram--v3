// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const votesCollection = db.collection('votes')
const entriesCollection = db.collection('entries')
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  const { action, targetId, count } = event
  
  // 根据不同的操作执行不同的功能
  switch (action) {
    case 'getUserVotes':
      return await getUserVotes(OPENID, event.userId)
    case 'addFreeVote':
      return await addFreeVote(OPENID, targetId)
    case 'getVoteSummary':
      return await getVoteSummary(targetId)
    case 'vote': // 添加vote操作
      return await addFreeVote(OPENID, targetId)
    case 'downvote': // 添加downvote操作
      return await removeFreeVote(OPENID, targetId)
    default:
      return {
        success: false,
        message: '未知操作类型'
      }
  }
}

/**
 * 获取用户的投票记录
 * @param {string} openid 用户的openid
 * @param {string} userId 指定用户ID查询(可选)
 */
async function getUserVotes(openid, userId) {
  try {
    // 查询用户信息，获取用户ID
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
    
    // 获取用户的投票记录
    const votesRes = await votesCollection
      .where({
        userId: user._id
      })
      .orderBy('createTime', 'desc')
      .get()
    
    // 如果没有投票记录，直接返回空数组
    if (!votesRes.data || votesRes.data.length === 0) {
      return {
        success: true,
        data: []
      }
    }
    
    // 获取所有相关的条目ID
    const entryIds = [...new Set(votesRes.data.map(vote => vote.targetId))]
    
    // 批量获取条目信息
    const entriesRes = await entriesCollection
      .where({
        _id: _.in(entryIds)
      })
      .get()
    
    // 构建条目ID到条目信息的映射
    const entriesMap = {}
    if (entriesRes.data && entriesRes.data.length > 0) {
      entriesRes.data.forEach(entry => {
        entriesMap[entry._id] = {
          id: entry._id,
          name: entry.name,
          avatar: entry.avatarUrl,
          votes: entry.votes
        }
      })
    }
    
    // 合并投票记录与条目信息
    const votes = votesRes.data.map(vote => {
      const entryInfo = entriesMap[vote.targetId] || {
        id: vote.targetId,
        name: '未知条目',
        avatar: '/images/placeholder-user.jpg',
        votes: 0
      }
      
      return {
        id: vote._id,
        entryId: vote.targetId,
        entryName: entryInfo.name,
        entryAvatar: entryInfo.avatar,
        currentVotes: entryInfo.votes,
        count: vote.count,
        type: vote.type, // vote, downvote, free
        date: vote.createTime
      }
    })
    
    return {
      success: true,
      data: votes
    }
  } catch (err) {
    console.error('获取用户投票记录失败:', err)
    return {
      success: false,
      message: '获取用户投票记录失败',
      error: err.message
    }
  }
}

/**
 * 添加免费投票（每个用户每天对每个条目限一次）
 * @param {string} openid 用户的openid
 * @param {string} targetId 投票目标ID
 */
async function addFreeVote(openid, targetId) {
  if (!targetId) {
    return {
      success: false,
      message: '缺少目标ID'
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
    
    // 检查今天是否已经对该条目进行过免费投票
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const voteRes = await votesCollection
      .where({
        userId: userId,
        targetId: targetId,
        type: 'free',
        createTime: _.gte(today)
      })
      .get()
    
    if (voteRes.data && voteRes.data.length > 0) {
      return {
        success: false,
        message: '今日已对此条目进行过免费投票'
      }
    }
    
    // 添加投票记录
    const voteData = {
      userId: userId,
      targetId: targetId,
      count: 1,
      type: 'free',
      createTime: new Date()
    }
    
    await votesCollection.add({
      data: voteData
    })
    
    // 更新条目的票数
    await entriesCollection.doc(targetId).update({
      data: {
        votes: _.inc(1),
        trend: 'up'
      }
    })
    
    // 创建投票通知
    await createVoteNotification(targetId, userId);

    return {
      success: true,
      message: '投票成功'
    }
  } catch (err) {
    console.error('免费投票失败:', err)
    return {
      success: false,
      message: '投票失败',
      error: err.message
    }
  }
}

/**
 * 减票操作（移除用户的投票）
 * @param {string} openid 用户的openid
 * @param {string} targetId 投票目标ID
 */
async function removeFreeVote(openid, targetId) {
  if (!targetId) {
    return {
      success: false,
      message: '缺少目标ID'
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
    
    // 检查用户是否对该条目投过票
    const voteRes = await votesCollection
      .where({
        userId: userId,
        targetId: targetId
      })
      .get()
    
    if (!voteRes.data || voteRes.data.length === 0) {
      return {
        success: false,
        message: '您还未对此条目投票，无法减票'
      }
    }
    
    // 删除投票记录
    await votesCollection.where({
      userId: userId,
      targetId: targetId
    }).remove()
    
    // 更新条目的票数
    const entryRes = await entriesCollection.doc(targetId).get()
    if (!entryRes.data) {
      return {
        success: false,
        message: '条目不存在'
      }
    }
    
    // 直接减1，允许票数为负数
    const currentVotes = entryRes.data.votes || 0
    const newVotes = currentVotes - 1
    
    await entriesCollection.doc(targetId).update({
      data: {
        votes: newVotes,
        trend: 'down'
      }
    })
    
    return {
      success: true,
      message: '减票成功',
      newVotes: newVotes
    }
  } catch (err) {
    console.error('减票失败:', err)
    return {
      success: false,
      message: '减票失败',
      error: err.message
    }
  }
}

/**
 * 获取投票汇总信息
 * @param {string} targetId 目标条目ID
 */
async function getVoteSummary(targetId) {
  if (!targetId) {
    return {
      success: false,
      message: '缺少目标ID'
    }
  }
  
  try {
    // 获取条目信息
    const entryRes = await entriesCollection.doc(targetId).get()
    
    if (!entryRes.data) {
      return {
        success: false,
        message: '条目不存在'
      }
    }
    
    // 获取投票统计
    const totalVotes = await votesCollection
      .where({
        targetId: targetId
      })
      .count()
    
    // 获取免费投票统计
    const freeVotes = await votesCollection
      .where({
        targetId: targetId,
        type: 'free'
      })
      .count()
    
    // 获取付费投票统计
    const paidVotes = await votesCollection
      .where({
        targetId: targetId,
        type: 'vote'
      })
      .count()
    
    // 获取减票统计
    const downvotes = await votesCollection
      .where({
        targetId: targetId,
        type: 'downvote'
      })
      .count()
    
    return {
      success: true,
      data: {
        targetId: targetId,
        name: entryRes.data.name,
        currentVotes: entryRes.data.votes,
        totalTransactions: totalVotes.total,
        freeVotes: freeVotes.total,
        paidVotes: paidVotes.total,
        downvotes: downvotes.total
      }
    }
  } catch (err) {
    console.error('获取投票统计失败:', err)
    return {
      success: false,
      message: '获取投票统计失败',
      error: err.message
    }
  }
} 

// 创建投票通知
async function createVoteNotification(nominationId, voterId) {
  try {
    // 获取提名信息和投票者信息
    const [nomination, voter] = await Promise.all([
      db.collection('nominations').doc(nominationId).get(),
      db.collection('users').where({ _openid: voterId }).get()
    ]);
    
    const nominationData = nomination.data;
    const voterData = voter.data.length > 0 ? voter.data[0] : {
      name: '用户',
      avatar: '/images/placeholder-user.jpg'
    };
    
    // 如果投票者不是提名者，则发送通知
    if (nominationData.creatorId !== voterId) {
      await cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'create',
          data: {
            receiverId: nominationData.creatorId,
            senderId: voterId,
            senderName: voterData.name || '用户',
            senderAvatar: voterData.avatar || '/images/placeholder-user.jpg',
            type: 'vote',
            content: `${voterData.name || '用户'} 给你的提名投了一票`,
            nominationId: nominationId,
            nominationTitle: nominationData.title || '提名'
          }
        }
      });
    }
  } catch (error) {
    console.error('创建投票通知失败:', error);
    // 通知失败不影响主流程，继续执行
  }
} 