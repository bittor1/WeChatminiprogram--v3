// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const danmakusCollection = db.collection('danmakus')
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  const { action, targetId, text, color } = event
  
  // 根据不同的操作执行不同的功能
  switch (action) {
    case 'add':
      return await addDanmaku(OPENID, targetId, text, color)
    case 'get':
      return await getDanmakus(targetId)
    case 'getByUser':
      return await getDanmakusByUser(OPENID)
    default:
      return {
        success: false,
        message: '未知操作类型'
      }
  }
}

/**
 * 添加弹幕
 * @param {string} openid 用户的openid
 * @param {string} targetId 目标条目ID
 * @param {string} text 弹幕内容
 * @param {string} color 弹幕颜色
 */
async function addDanmaku(openid, targetId, text, color) {
  if (!targetId || !text) {
    return {
      success: false,
      message: '缺少必要参数'
    }
  }
  
  try {
    // 检查danmakus集合是否存在，如果不存在则创建
    try {
      await db.collection('danmakus').limit(1).get()
    } catch (err) {
      if (err.errCode === -502005) {
        console.log('danmakus集合不存在，尝试创建')
        await db.createCollection('danmakus')
        console.log('danmakus集合创建成功')
      } else {
        throw err
      }
    }
    
    // 添加弹幕记录
    const danmakuData = {
      _openid: openid,
      targetId,
      text,
      color: color || '#ffffff', // 默认白色
      top: Math.floor(Math.random() * 80) + 10, // 10% - 90%的位置
      duration: Math.floor(Math.random() * 5000) + 5000, // 5-10秒
      createTime: db.serverDate()
    }
    
    const result = await danmakusCollection.add({
      data: danmakuData
    })
    
    return {
      success: true,
      message: '弹幕发送成功',
      danmakuId: result._id
    }
  } catch (err) {
    console.error('弹幕发送失败:', err)
    return {
      success: false,
      message: '弹幕发送失败',
      error: err.message
    }
  }
}

/**
 * 获取指定条目的弹幕
 * @param {string} targetId 目标条目ID
 */
async function getDanmakus(targetId) {
  if (!targetId) {
    return {
      success: false,
      message: '缺少目标ID'
    }
  }
  
  try {
    // 检查danmakus集合是否存在，如果不存在则创建
    try {
      await db.collection('danmakus').limit(1).get()
    } catch (err) {
      if (err.errCode === -502005) {
        console.log('danmakus集合不存在，尝试创建')
        await db.createCollection('danmakus')
        console.log('danmakus集合创建成功')
        return {
          success: true,
          data: []
        }
      } else {
        throw err
      }
    }
    
    // 获取弹幕列表，按创建时间排序
    const danmakus = await danmakusCollection
      .where({
        targetId: targetId
      })
      .orderBy('createTime', 'asc')
      .get()
    
    return {
      success: true,
      data: danmakus.data
    }
  } catch (err) {
    console.error('获取弹幕失败:', err)
    return {
      success: false,
      message: '获取弹幕失败',
      error: err.message
    }
  }
}

/**
 * 获取用户发送的弹幕
 * @param {string} openid 用户的openid
 */
async function getDanmakusByUser(openid) {
  try {
    // 检查danmakus集合是否存在，如果不存在则创建
    try {
      await db.collection('danmakus').limit(1).get()
    } catch (err) {
      if (err.errCode === -502005) {
        console.log('danmakus集合不存在，尝试创建')
        await db.createCollection('danmakus')
        console.log('danmakus集合创建成功')
        return {
          success: true,
          data: []
        }
      } else {
        throw err
      }
    }
    
    // 获取用户发送的弹幕，按创建时间排序
    const danmakus = await danmakusCollection
      .where({
        _openid: openid
      })
      .orderBy('createTime', 'desc')
      .get()
    
    return {
      success: true,
      data: danmakus.data
    }
  } catch (err) {
    console.error('获取用户弹幕失败:', err)
    return {
      success: false,
      message: '获取用户弹幕失败',
      error: err.message
    }
  }
} 