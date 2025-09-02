// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const votesCollection = db.collection('votes')
const entriesCollection = db.collection('entries')
const dailyVoteRecordsCollection = db.collection('dailyVoteRecords')
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
    case 'vote': // 新的投票逻辑
      return await newVote(OPENID, targetId, 'up')
    case 'downvote': // 新的减票逻辑
      return await newVote(OPENID, targetId, 'down')
    case 'getTodayVoteStatus': // 获取今日投票状态
      return await getTodayVoteStatus(OPENID, targetId)
    case 'getShareReward': // 分享获得奖励
      return await getShareReward(OPENID, targetId, event.voteType)
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
              userQuery._openid = openid
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
      _openid: openid
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
      _openid: openid
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

/**
 * 获取今日日期字符串 (YYYY-MM-DD格式)
 */
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取用户信息
 * @param {string} openid 用户的openid
 */
async function getUserInfo(openid) {
  const userRes = await db.collection('users').where({
    _openid: openid
  }).get();
  
  if (!userRes.data || userRes.data.length === 0) {
    throw new Error('用户不存在');
  }
  
  return userRes.data[0];
}

/**
 * 新的投票逻辑 - 支持每日限制和奖励机制
 * @param {string} openid 用户的openid
 * @param {string} entryId 档案ID
 * @param {string} voteType 投票类型：'up' 或 'down'
 */
async function newVote(openid, entryId, voteType) {
  if (!entryId) {
    return {
      success: false,
      message: '缺少档案ID'
    };
  }

  try {
    // 获取用户信息
    const userInfo = await getUserInfo(openid);
    const userId = userInfo._id;
    const today = getTodayDateString();

    // 检查并创建 dailyVoteRecords 集合
    try {
      await dailyVoteRecordsCollection.limit(1).get();
    } catch (err) {
      if (err.errCode === -502005) {
        console.log('[voteManage] dailyVoteRecords集合不存在，尝试创建');
        try {
          await db.createCollection('dailyVoteRecords');
          console.log('[voteManage] dailyVoteRecords集合创建成功');
        } catch (createErr) {
          console.error('[voteManage] 创建集合失败:', createErr);
          return {
            success: false,
            message: '数据库集合不存在且无法创建',
            error: createErr.message
          };
        }
      } else {
        console.error('[voteManage] 检查集合时出错:', err);
        return {
          success: false,
          message: '检查数据库集合失败',
          error: err.message
        };
      }
    }

    // 检查今日是否已对此类型投票
    const todayRecord = await dailyVoteRecordsCollection.where({
      userId: userId,
      entryId: entryId,
      date: today,
      voteType: voteType
    }).get();

    if (todayRecord.data.length > 0) {
      // 已对此类型投票，需要通过分享获得奖励
      const record = todayRecord.data[0];
      return {
        success: false,
        code: 'NEED_SHARE',
        message: `今日已${voteType === 'up' ? '想吃' : '拒吃'}过，分享可获得额外奖励`,
        hasVoted: true,
        voteType: record.voteType,
        rewardCount: record.rewardCount || 0
      };
    }

    // 执行投票操作
    const voteResult = await performVote(openid, entryId, voteType);
    if (!voteResult.success) {
      return voteResult;
    }

    // 创建今日投票记录
    await dailyVoteRecordsCollection.add({
      data: {
        userId: userId,
        entryId: entryId,
        date: today,
        hasVoted: true,
        voteType: voteType,
        rewardCount: 1, // 首次投票获得1次奖励
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      message: voteType === 'up' ? '想吃成功！' : '拒吃成功！',
      hasVoted: true,
      voteType: voteType,
      rewardCount: 1
    };

  } catch (error) {
    console.error('投票失败:', error);
    return {
      success: false,
      message: error.message || '投票失败'
    };
  }
}

/**
 * 执行实际的投票操作（跳过每日限制检查）
 * @param {string} openid 用户的openid
 * @param {string} entryId 档案ID
 * @param {string} voteType 投票类型
 */
async function performVote(openid, entryId, voteType) {
  if (voteType === 'up') {
    return await executeVoteDirectly(openid, entryId, true);
  } else {
    return await executeVoteDirectly(openid, entryId, false);
  }
}

/**
 * 直接执行投票操作，跳过每日限制检查（因为我们有新的限制逻辑）
 * @param {string} openid 用户的openid
 * @param {string} entryId 档案ID
 * @param {boolean} isUpvote 是否是想吃（true）还是拒吃（false）
 */
async function executeVoteDirectly(openid, entryId, isUpvote) {
  try {
    // 获取用户信息
    const userRes = await db.collection('users').where({
      _openid: openid
    }).get();
    
    if (!userRes.data || userRes.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    const userId = userRes.data[0]._id;
    
    if (isUpvote) {
      // 想吃：添加想吃投票记录并增加votes计数
      await votesCollection.add({
        data: {
          userId: userId,
          targetId: entryId,
          createTime: db.serverDate(),
          type: 'upvote'
        }
      });
      
      // 增加条目的想吃票数
      await entriesCollection.doc(entryId).update({
        data: {
          votes: _.inc(1)
        }
      });
      
      return {
        success: true,
        message: '想吃成功'
      };
      
    } else {
      // 拒吃：删除想吃投票记录并减少votes计数
      const voteRes = await votesCollection.where({
        userId: userId,
        targetId: entryId,
        type: 'free' // 只删除想吃投票
      }).get();
      
      if (voteRes.data.length > 0) {
        // 删除想吃投票记录
        await votesCollection.doc(voteRes.data[0]._id).remove();
      }
      
      // 无论是否有想吃投票记录，都要减少票数（票数可以为负数）
      await entriesCollection.doc(entryId).update({
        data: {
          votes: _.inc(-1)
        }
      });
      
      return {
        success: true,
        message: '拒吃成功'
      };
    }
    
  } catch (error) {
    console.error('执行投票失败:', error);
    return {
      success: false,
      message: '投票失败',
      error: error.message
    };
  }
}

/**
 * 获取今日投票状态
 * @param {string} openid 用户的openid
 * @param {string} entryId 档案ID
 */
async function getTodayVoteStatus(openid, entryId) {
  try {
    const userInfo = await getUserInfo(openid);
    const userId = userInfo._id;
    const today = getTodayDateString();

    // 检查并创建 dailyVoteRecords 集合
    try {
      await dailyVoteRecordsCollection.limit(1).get();
    } catch (err) {
      if (err.errCode === -502005) {
        // 集合不存在，返回默认状态
        return {
          success: true,
          upVote: { hasVoted: false, rewardCount: 0 },
          downVote: { hasVoted: false, rewardCount: 0 }
        };
      }
      throw err;
    }

    // 分别查询想吃和拒吃的记录
    const upVoteRecord = await dailyVoteRecordsCollection.where({
      userId: userId,
      entryId: entryId,
      date: today,
      voteType: 'up'
    }).get();

    const downVoteRecord = await dailyVoteRecordsCollection.where({
      userId: userId,
      entryId: entryId,
      date: today,
      voteType: 'down'
    }).get();

    return {
      success: true,
      upVote: {
        hasVoted: upVoteRecord.data.length > 0,
        rewardCount: upVoteRecord.data.length > 0 ? (upVoteRecord.data[0].rewardCount || 0) : 0
      },
      downVote: {
        hasVoted: downVoteRecord.data.length > 0,
        rewardCount: downVoteRecord.data.length > 0 ? (downVoteRecord.data[0].rewardCount || 0) : 0
      }
    };

  } catch (error) {
    console.error('获取投票状态失败:', error);
    return {
      success: false,
      message: error.message || '获取投票状态失败'
    };
  }
}

/**
 * 分享获得奖励
 * @param {string} openid 用户的openid
 * @param {string} entryId 档案ID
 * @param {string} voteType 投票类型：'up' 或 'down'
 */
async function getShareReward(openid, entryId, voteType) {
  try {
    const userInfo = await getUserInfo(openid);
    const userId = userInfo._id;
    const today = getTodayDateString();

    // 检查并创建 dailyVoteRecords 集合
    try {
      await dailyVoteRecordsCollection.limit(1).get();
    } catch (err) {
      if (err.errCode === -502005) {
        return {
          success: false,
          message: '今日尚未投票，请先投票'
        };
      }
      throw err;
    }

    // 检查今日特定类型的投票记录
    const todayRecord = await dailyVoteRecordsCollection.where({
      userId: userId,
      entryId: entryId,
      date: today,
      voteType: voteType
    }).get();

    if (todayRecord.data.length === 0) {
      return {
        success: false,
        message: `今日尚未${voteType === 'up' ? '想吃' : '拒吃'}，请先投票`
      };
    }

    const record = todayRecord.data[0];
    const currentRewardCount = record.rewardCount || 0;

    // 检查是否已达到奖励上限
    if (currentRewardCount >= 5) {
      return {
        success: false,
        message: '今日奖励次数已达上限（5次）'
      };
    }

    // 执行实际的投票操作（增加票数）
    const voteResult = await executeVoteDirectly(openid, entryId, voteType === 'up');
    if (!voteResult.success) {
      return {
        success: false,
        message: '投票操作失败：' + voteResult.message
      };
    }

    // 增加奖励次数
    await dailyVoteRecordsCollection.doc(record._id).update({
      data: {
        rewardCount: currentRewardCount + 1,
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      message: '分享奖励获得成功！',
      rewardCount: currentRewardCount + 1
    };

  } catch (error) {
    console.error('获取分享奖励失败:', error);
    return {
      success: false,
      message: error.message || '获取分享奖励失败'
    };
  }
} 