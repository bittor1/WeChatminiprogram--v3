// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const soundSettingsCollection = db.collection('soundSettings')
const pageSoundBindingsCollection = db.collection('pageSoundBindings')
const userSoundsCollection = db.collection('userSounds')

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
    case 'saveUserSound':
      return await saveUserSound(OPENID, event.soundData)
    case 'getUserSounds':
      return await getUserSounds(OPENID)
    case 'deleteUserSound':
      return await deleteUserSound(OPENID, event.soundId)
    case 'bindPageSound':
      return await bindPageSound(OPENID, event.pageId, event.soundId)
    case 'getPageSound':
      return await getPageSound(event.pageId)
    case 'playPageSound':
      return await playPageSound(event.pageId)
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

/**
 * 保存用户录制的音效到音效库
 * @param {string} openid 用户的openid
 * @param {object} soundData 音效数据
 */
async function saveUserSound(openid, soundData) {
  if (!soundData || !soundData.fileId) {
    return {
      success: false,
      message: '缺少音效数据'
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
    
    // 保存音效到用户音效库
    const soundRes = await userSoundsCollection.add({
      data: {
        userId: userId,
        fileId: soundData.fileId,
        duration: soundData.duration || 0,
        name: soundData.name || '投票音效',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      message: '音效保存成功',
      soundId: soundRes._id
    }
  } catch (err) {
    console.error('保存用户音效失败:', err)
    return {
      success: false,
      message: '保存音效失败',
      error: err.message
    }
  }
}

/**
 * 获取用户的音效库
 * @param {string} openid 用户的openid
 */
async function getUserSounds(openid) {
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
    
    // 获取用户的所有音效
    const soundsRes = await userSoundsCollection.where({
      userId: userId
    }).orderBy('createTime', 'desc').get()
    
    return {
      success: true,
      data: soundsRes.data || []
    }
  } catch (err) {
    console.error('获取用户音效失败:', err)
    return {
      success: false,
      message: '获取音效失败',
      error: err.message
    }
  }
}

/**
 * 删除用户音效
 * @param {string} openid 用户的openid
 * @param {string} soundId 音效ID
 */
async function deleteUserSound(openid, soundId) {
  if (!soundId) {
    return {
      success: false,
      message: '缺少音效ID'
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
    
    // 验证音效是否属于该用户
    const soundRes = await userSoundsCollection.doc(soundId).get()
    
    if (!soundRes.data || soundRes.data.userId !== userId) {
      return {
        success: false,
        message: '音效不存在或无权限删除'
      }
    }
    
    // 删除音效记录
    await userSoundsCollection.doc(soundId).remove()
    
    // TODO: 可以考虑删除云存储中的文件，但需要小心处理可能的引用
    
    return {
      success: true,
      message: '音效删除成功'
    }
  } catch (err) {
    console.error('删除用户音效失败:', err)
    return {
      success: false,
      message: '删除音效失败',
      error: err.message
    }
  }
}

/**
 * 绑定音效到页面
 * @param {string} openid 用户的openid
 * @param {string} pageId 页面ID
 * @param {string} soundId 音效ID
 */
async function bindPageSound(openid, pageId, soundId) {
  if (!pageId || !soundId) {
    return {
      success: false,
      message: '缺少页面ID或音效ID'
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
    
    // 验证音效是否属于该用户
    const soundRes = await userSoundsCollection.doc(soundId).get()
    
    if (!soundRes.data || soundRes.data.userId !== userId) {
      return {
        success: false,
        message: '音效不存在或无权限使用'
      }
    }
    
    // 检查是否已有绑定记录
    const existingBinding = await pageSoundBindingsCollection.where({
      pageId: pageId
    }).get()
    
    if (existingBinding.data && existingBinding.data.length > 0) {
      // 更新现有绑定
      await pageSoundBindingsCollection.doc(existingBinding.data[0]._id).update({
        data: {
          soundId: soundId,
          userId: userId,
          updateTime: db.serverDate()
        }
      })
    } else {
      // 创建新绑定
      await pageSoundBindingsCollection.add({
        data: {
          pageId: pageId,
          soundId: soundId,
          userId: userId,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
    }
    
    return {
      success: true,
      message: '音效绑定成功'
    }
  } catch (err) {
    console.error('绑定页面音效失败:', err)
    return {
      success: false,
      message: '绑定音效失败',
      error: err.message
    }
  }
}

/**
 * 获取页面绑定的音效
 * @param {string} pageId 页面ID
 */
async function getPageSound(pageId) {
  if (!pageId) {
    return {
      success: false,
      message: '缺少页面ID'
    }
  }
  
  try {
    // 查询页面绑定的音效
    const bindingRes = await pageSoundBindingsCollection.where({
      pageId: pageId
    }).get()
    
    if (!bindingRes.data || bindingRes.data.length === 0) {
      return {
        success: true,
        data: null,
        message: '该页面暂无绑定音效'
      }
    }
    
    const binding = bindingRes.data[0]
    
    // 获取音效详情
    const soundRes = await userSoundsCollection.doc(binding.soundId).get()
    
    if (!soundRes.data) {
      return {
        success: false,
        message: '音效文件不存在'
      }
    }
    
    return {
      success: true,
      data: {
        soundId: binding.soundId,
        fileId: soundRes.data.fileId,
        duration: soundRes.data.duration,
        name: soundRes.data.name,
        bindingTime: binding.updateTime
      }
    }
  } catch (err) {
    console.error('获取页面音效失败:', err)
    return {
      success: false,
      message: '获取页面音效失败',
      error: err.message
    }
  }
}

/**
 * 记录页面音效播放
 * @param {string} pageId 页面ID
 */
async function playPageSound(pageId) {
  if (!pageId) {
    return {
      success: false,
      message: '缺少页面ID'
    }
  }
  
  try {
    // 这里可以记录播放统计等信息
    // 暂时只返回成功，后续可扩展
    
    return {
      success: true,
      message: '播放记录成功'
    }
  } catch (err) {
    console.error('记录音效播放失败:', err)
    return {
      success: false,
      message: '记录播放失败',
      error: err.message
    }
  }
}