// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const entriesCollection = db.collection('entries')
const achievementsCollection = db.collection('achievements')
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  const { action, nominationData, achievement } = event
  
  // 根据不同的操作执行不同的功能
  switch (action) {
    case 'getUserNominations':
      return await getUserNominations(OPENID, event.userId)
    case 'createNomination':
      return await createNomination(OPENID, nominationData)
    case 'updateNomination':
      return await updateNomination(OPENID, nominationData)
    case 'deleteNomination':
      return await deleteNomination(OPENID, event.nominationId)
    case 'addAchievement':
      return await addAchievement(OPENID, achievement)
    case 'getUserAchievements':
      return await getUserAchievements(event.userId)
    default:
      return {
        success: false,
        message: '未知操作类型'
      }
  }
}

/**
 * 获取用户提名列表
 * @param {string} openid 用户的openid
 * @param {string} userId 指定的用户ID（可选）
 */
async function getUserNominations(openid, userId) {
  try {
    // 获取用户信息
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
    
    // 获取用户的提名记录
    const nominationsRes = await entriesCollection
      .where({
        createdBy: user._id
      })
      .orderBy('createdAt', 'desc')
      .get()
    
    return {
      success: true,
      data: nominationsRes.data || []
    }
  } catch (err) {
    console.error('获取用户提名失败:', err)
    return {
      success: false,
      message: '获取用户提名失败',
      error: err.message
    }
  }
}

/**
 * 创建新提名
 * @param {string} openid 用户的openid
 * @param {object} nominationData 提名数据
 */
async function createNomination(openid, nominationData) {
  if (!nominationData) {
    return {
      success: false,
      message: '缺少提名数据'
    }
  }
  
  try {
    // 调试信息：检查openid和查询条件
    console.log('createNomination 调试信息:', {
      openid: openid,
      queryCondition: { _openid: openid }
    });
    
    // 获取用户信息
    const userRes = await db.collection('users').where({
      _openid: openid
    }).get()
    
    // 调试信息：检查查询结果
    console.log('用户查询结果:', {
      dataLength: userRes.data ? userRes.data.length : 0,
      userData: userRes.data
    });
    
    if (!userRes.data || userRes.data.length === 0) {
      console.log('用户不存在，无法创建提名');
      return {
        success: false,
        message: '用户不存在'
      }
    }
    
    const userId = userRes.data[0]._id;
    
    // 构建提名数据
    const nomination = {
      ...nominationData,
      createdBy: userId,
      votes: 0,
      trend: 'stable',
      hotLevel: 1,
      createdAt: db.serverDate(),
      _createTime: Date.now()
    }
    
    // 添加到数据库
    const result = await entriesCollection.add({
      data: nomination
    })
    
    return {
      success: true,
      message: '提名创建成功',
      data: {
        id: result._id
      }
    }
  } catch (err) {
    console.error('创建提名失败:', err)
    return {
      success: false,
      message: '创建提名失败',
      error: err.message
    }
  }
}

/**
 * 更新提名
 * @param {string} openid 用户的openid
 * @param {object} nominationData 提名数据
 */
async function updateNomination(openid, nominationData) {
  if (!nominationData || !nominationData._id) {
    return {
      success: false,
      message: '缺少提名数据或ID'
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
    
    // 验证提名是否属于该用户
    const nominationRes = await entriesCollection.doc(nominationData._id).get()
    
    if (!nominationRes.data) {
      return {
        success: false,
        message: '提名不存在'
      }
    }
    
    if (nominationRes.data.createdBy !== userId) {
      return {
        success: false,
        message: '无权更新此提名'
      }
    }
    
    // 构建更新数据，禁止更新敏感字段
    const updateData = { ...nominationData }
    delete updateData._id
    delete updateData.createdBy
    delete updateData.createdAt
    delete updateData._createTime
    delete updateData.votes
    delete updateData.hotLevel
    
    // 更新提名
    await entriesCollection.doc(nominationData._id).update({
      data: updateData
    })
    
    return {
      success: true,
      message: '提名更新成功'
    }
  } catch (err) {
    console.error('更新提名失败:', err)
    return {
      success: false,
      message: '更新提名失败',
      error: err.message
    }
  }
}

/**
 * 删除提名
 * @param {string} openid 用户的openid
 * @param {string} nominationId 提名ID
 */
async function deleteNomination(openid, nominationId) {
  if (!nominationId) {
    return {
      success: false,
      message: '缺少提名ID'
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
    
    // 验证提名是否属于该用户
    const nominationRes = await entriesCollection.doc(nominationId).get()
    
    if (!nominationRes.data) {
      return {
        success: false,
        message: '提名不存在'
      }
    }
    
    if (nominationRes.data.createdBy !== userId) {
      return {
        success: false,
        message: '无权删除此提名'
      }
    }
    
    // 删除提名
    await entriesCollection.doc(nominationId).remove()
    
    // 可选：从云存储中删除相关图片
    if (nominationRes.data.avatarUrl && nominationRes.data.avatarUrl.includes('cloud://')) {
      try {
        await cloud.deleteFile({
          fileList: [nominationRes.data.avatarUrl]
        })
      } catch (e) {
        console.error('删除提名图片失败:', e)
        // 不影响主流程，继续执行
      }
    }
    
    return {
      success: true,
      message: '提名删除成功'
    }
  } catch (err) {
    console.error('删除提名失败:', err)
    return {
      success: false,
      message: '删除提名失败',
      error: err.message
    }
  }
} 

/**
 * 添加新事迹
 * @param {string} openid 用户的openid
 * @param {object} achievement 事迹数据
 */
async function addAchievement(openid, achievement) {
  if (!achievement || !achievement.content || !achievement.userId) {
    return {
      success: false,
      message: '缺少事迹数据'
    }
  }
  
  try {
    // 获取当前用户信息
    const userRes = await db.collection('users').where({
      _openid: openid
    }).get()
    
    if (!userRes.data || userRes.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      }
    }
    
    const currentUser = userRes.data[0]
    
    // 构建事迹数据
    const achievementData = {
      ...achievement,
      content: achievement.content.trim(),
      createdBy: currentUser._id,
      creatorName: currentUser.name || '匿名用户',
      creatorAvatar: currentUser.avatar || '',
      createdAt: db.serverDate(),
      _createTime: Date.now()
    }
    
    // 添加到数据库
    const result = await achievementsCollection.add({
      data: achievementData
    })
    
    return {
      success: true,
      message: '事迹添加成功',
      data: {
        id: result._id
      }
    }
  } catch (err) {
    console.error('添加事迹失败:', err)
    return {
      success: false,
      message: '添加事迹失败',
      error: err.message
    }
  }
} 

/**
 * 获取用户事迹记录
 * @param {string} userId 目标用户ID
 */
async function getUserAchievements(userId) {
  if (!userId) {
    return {
      success: false,
      message: '缺少用户ID'
    }
  }
  
  try {
    // 查询该用户的所有事迹
    const achievementsRes = await achievementsCollection
      .where({
        userId: userId  // 确保这里的字段名与提交事迹时使用的字段名一致
      })
      .orderBy('_createTime', 'desc')
      .limit(100)  // 限制返回数量，避免数据过多
      .get()
    
    return {
      success: true,
      data: achievementsRes.data || []
    }
  } catch (err) {
    console.error('获取用户事迹失败:', err)
    return {
      success: false,
      message: '获取用户事迹失败',
      error: err.message
    }
  }
} 