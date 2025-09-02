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
      return await getUserMessages(OPENID, event.userId, event.messageType)
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
  console.log('[messageManage] 创建消息请求:', messageData)
  
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
    
    console.log('[messageManage] 准备保存的消息数据:', message)
    
    // 添加到数据库
    const result = await messagesCollection.add({
      data: message
    })
    
    console.log('[messageManage] 消息创建成功:', result._id)
    
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
 * @param {string} messageType 消息类型过滤(可选)
 */
async function getUserMessages(openid, userId, messageType) {
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
    
    // 构建查询条件
    let queryCondition = {
      receiverId: user._id
    }
    
    // 根据消息类型过滤
    if (messageType && messageType !== 'all') {
      queryCondition.type = messageType
    }
    
    // 获取用户的消息
    const messagesRes = await messagesCollection
      .where(queryCondition)
      .orderBy('createTime', 'desc')
      .get()
    
    // 如果是查询所有消息，则统计各类型的数量
    let counts = { all: 0, comment: 0, vote: 0, system: 0 }
    if (!messageType || messageType === 'all') {
      const allMessagesRes = await messagesCollection
        .where({ receiverId: user._id })
        .get()
      
      const allMessages = allMessagesRes.data || []
      counts.all = allMessages.length
      counts.comment = allMessages.filter(msg => msg.type === 'comment').length
      counts.vote = allMessages.filter(msg => msg.type === 'vote').length
      counts.system = allMessages.filter(msg => msg.type === 'system').length
    }
    
    return {
      success: true,
      data: messagesRes.data || [],
      unreadCount: (messagesRes.data || []).filter(msg => !msg.read).length,
      counts: counts
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