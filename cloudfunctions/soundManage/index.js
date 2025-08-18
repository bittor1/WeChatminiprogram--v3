// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const soundSettingsCollection = db.collection('soundSettings')

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  const { action, settingData } = event
  
  // 根据不同的操作执行不同的功能
  switch (action) {
    case 'getSoundSettings':
      return await getSoundSettings(OPENID, event.userId)
    case 'updateSoundSettings':
      return await updateSoundSettings(OPENID, settingData)
    default:
      return {
        success: false,
        message: '未知操作类型'
      }
  }
}

/**
 * 获取用户音效设置
 * @param {string} openid 用户的openid
 * @param {string} userId 指定的用户ID（可选）
 */
async function getSoundSettings(openid, userId) {
  try {
    // 查询用户
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
    
    // 查询用户音效设置
    const settingRes = await soundSettingsCollection.where({
      userId: user._id
    }).get()
    
    // 如果没有设置记录，返回默认设置
    if (!settingRes.data || settingRes.data.length === 0) {
      return {
        success: true,
        data: {
          userId: user._id,
          enabled: false,
          soundUrl: '',
          isDefault: true
        }
      }
    }
    
    // 返回设置数据
    return {
      success: true,
      data: settingRes.data[0]
    }
  } catch (err) {
    console.error('获取音效设置失败:', err)
    return {
      success: false,
      message: '获取音效设置失败',
      error: err.message
    }
  }
}

/**
 * 更新用户音效设置
 * @param {string} openid 用户的openid
 * @param {object} settingData 设置数据
 */
async function updateSoundSettings(openid, settingData) {
  if (!settingData) {
    return {
      success: false,
      message: '缺少设置数据'
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
    
    // 查询是否已有设置
    const settingRes = await soundSettingsCollection.where({
      userId: userId
    }).get()
    
    if (settingRes.data && settingRes.data.length > 0) {
      // 更新现有设置
      await soundSettingsCollection.doc(settingRes.data[0]._id).update({
        data: {
          ...settingData,
          updateTime: db.serverDate()
        }
      })
    } else {
      // 创建新的设置
      await soundSettingsCollection.add({
        data: {
          userId: userId,
          ...settingData,
          createTime: db.serverDate()
        }
      })
    }
    
    return {
      success: true,
      message: '音效设置更新成功'
    }
  } catch (err) {
    console.error('更新音效设置失败:', err)
    return {
      success: false,
      message: '更新音效设置失败',
      error: err.message
    }
  }
} 