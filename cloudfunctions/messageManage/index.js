// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const messagesCollection = db.collection('messages')
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  const { action, data } = event
  
  // 根据不同的操作执行不同的功能
  switch (action) {
    case 'create':
      return await createMessage(data)
    case 'getUserMessages':
      return await getUserMessages(OPENID, event.userId)
    case 'markAsRead':
      return await markAsRead(OPENID, event.messageId)
    case 'markAllAsRead':
      return await markAllAsRead(OPENID)
    case 'deleteMessage':
      return await deleteMessage(OPENID, event.messageId)
    default:
      return {
        success: false,
        message: '未知操作类型'
      }
  }
}

/**
 * 创建消息
 * @param {object} messageData 消息数据
 */
async function createMessage(messageData) {
  if (!messageData || !messageData.receiverId) {
    return {
      success: false,
      message: '缺少必要的消息数据'
    }
  }
  
  try {
    // 构建消息数据
    const message = {
      ...messageData,
      read: false,
      createTime: db.serverDate(),
      _createTime: Date.now()
    }
    
    // 添加到数据库
    const result = await messagesCollection.add({
      data: message
    })
    
    return {
      success: true,
      message: '消息创建成功',
      data: {
        id: result._id
      }
    }
  } catch (err) {
    console.error('创建消息失败:', err)
    return {
      success: false,
      message: '创建消息失败',
      error: err.message
    }
  }
}

/**
 * 获取用户消息列表
 * @param {string} openid 用户的openid
 * @param {string} userId 指定用户ID查询(可选)
 */
async function getUserMessages(openid, userId) {
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
    
    // 获取用户的消息
    const messagesRes = await messagesCollection
      .where({
        receiverId: user._id
      })
      .orderBy('createTime', 'desc')
      .get()
    
    return {
      success: true,
      data: messagesRes.data || [],
      unreadCount: (messagesRes.data || []).filter(msg => !msg.read).length
    }
  } catch (err) {
    console.error('获取用户消息失败:', err)
    return {
      success: false,
      message: '获取用户消息失败',
      error: err.message
    }
  }
}

/**
 * 标记消息为已读
 * @param {string} openid 用户的openid
 * @param {string} messageId 消息ID
 */
async function markAsRead(openid, messageId) {
  if (!messageId) {
    return {
      success: false,
      message: '缺少消息ID'
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
    
    // 验证消息是否属于该用户
    const messageRes = await messagesCollection.doc(messageId).get()
    
    if (!messageRes.data) {
      return {
        success: false,
        message: '消息不存在'
      }
    }
    
    if (messageRes.data.receiverId !== userId) {
      return {
        success: false,
        message: '无权操作此消息'
      }
    }
    
    // 标记为已读
    await messagesCollection.doc(messageId).update({
      data: {
        read: true,
        readTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      message: '消息已标记为已读'
    }
  } catch (err) {
    console.error('标记消息已读失败:', err)
    return {
      success: false,
      message: '操作失败',
      error: err.message
    }
  }
}

/**
 * 标记所有消息为已读
 * @param {string} openid 用户的openid
 */
async function markAllAsRead(openid) {
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
    
    // 标记该用户的所有未读消息为已读
    await messagesCollection.where({
      receiverId: userId,
      read: false
    }).update({
      data: {
        read: true,
        readTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      message: '所有消息已标记为已读'
    }
  } catch (err) {
    console.error('标记所有消息已读失败:', err)
    return {
      success: false,
      message: '操作失败',
      error: err.message
    }
  }
}

/**
 * 删除消息
 * @param {string} openid 用户的openid
 * @param {string} messageId 消息ID
 */
async function deleteMessage(openid, messageId) {
  if (!messageId) {
    return {
      success: false,
      message: '缺少消息ID'
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
    
    // 验证消息是否属于该用户
    const messageRes = await messagesCollection.doc(messageId).get()
    
    if (!messageRes.data) {
      return {
        success: false,
        message: '消息不存在'
      }
    }
    
    if (messageRes.data.receiverId !== userId) {
      return {
        success: false,
        message: '无权操作此消息'
      }
    }
    
    // 删除消息
    await messagesCollection.doc(messageId).remove()
    
    return {
      success: true,
      message: '消息删除成功'
    }
  } catch (err) {
    console.error('删除消息失败:', err)
    return {
      success: false,
      message: '删除消息失败',
      error: err.message
    }
  }
} 