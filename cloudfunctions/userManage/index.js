// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const db = cloud.database()
  
  // 根据action参数执行不同操作
  switch(event.action) {
    case 'saveUserInfo':
      return await saveUserInfo(db, event, openid);
    case 'updateUserInfo':
      return await updateUserInfo(db, event, openid);
    case 'getUserInfo':
      return await getUserInfo(db, openid);
    default:
      return {
        code: 400,
        msg: '未知的操作类型'
      }
  }
}

/**
 * 保存用户信息
 * @param {object} db 数据库实例
 * @param {object} event 事件对象
 * @param {string} openid 用户openid
 */
async function saveUserInfo(db, event, openid) {
  try {
    // 使用传入的openid或当前用户的openid
    const userOpenid = event.openid || openid;
    
    if (!userOpenid) {
      return {
        code: 400,
        msg: '缺少用户标识'
      };
    }
    
    // 获取用户信息
    const userInfo = event.userInfo || {};
    
    // 查询用户是否已存在
    const userResult = await db.collection('users').where({
      _openid: userOpenid
    }).get();
    
    let userData = null;
    
    if (userResult.data && userResult.data.length > 0) {
      // 用户已存在，更新信息
      userData = userResult.data[0];
      
      await db.collection('users').doc(userData._id).update({
        data: {
          nickname: userInfo.nickName || userData.nickname,
          avatarUrl: userInfo.avatarUrl || userData.avatarUrl,
          gender: userInfo.gender !== undefined ? userInfo.gender : userData.gender,
          lastLoginTime: db.serverDate()
        }
      });
      
      // 重新获取更新后的用户信息
      const updatedUser = await db.collection('users').doc(userData._id).get();
      userData = updatedUser.data;
    } else {
      // 用户不存在，创建新用户
      const newUser = {
        _openid: userOpenid,
        nickname: userInfo.nickName || '',
        avatarUrl: userInfo.avatarUrl || '',
        gender: userInfo.gender || 0,
        votes: 0,
        nominationsCount: 0,
        votesCount: 0,
        receivedVotesCount: 0,
        createTime: db.serverDate(),
        lastLoginTime: db.serverDate()
      };
      
      const addResult = await db.collection('users').add({
        data: newUser
      });
      
      userData = {
        _id: addResult._id,
        ...newUser
      };
    }
    
    return {
      code: 200,
      msg: '保存用户信息成功',
      userInfo: userData
    };
  } catch (err) {
    console.error('保存用户信息失败:', err);
    return {
      code: 500,
      msg: '保存用户信息失败',
      error: err.message || err
    };
  }
}

/**
 * 更新用户信息（用于授权后完善信息）
 * @param {object} db 数据库实例
 * @param {object} event 事件对象
 * @param {string} openid 用户openid
 */
async function updateUserInfo(db, event, openid) {
  try {
    if (!openid) {
      return {
        success: false,
        message: '用户未登录'
      };
    }
    
    const userData = event.userData || {};
    
    // 查询现有用户
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();
    
    if (userResult.data && userResult.data.length > 0) {
      const existingUser = userResult.data[0];
      
      // 更新用户信息
      const updateData = {
        nickname: userData.nickname || existingUser.nickname,
        avatarUrl: userData.avatarUrl || existingUser.avatarUrl,
        isInfoComplete: userData.isInfoComplete !== undefined ? userData.isInfoComplete : true,
        lastUpdateTime: db.serverDate()
      };
      
      await db.collection('users').doc(existingUser._id).update({
        data: updateData
      });
      
      // 返回更新后的用户信息
      const updatedUserInfo = {
        ...existingUser,
        ...updateData
      };
      
      return {
        success: true,
        message: '用户信息更新成功',
        user: updatedUserInfo
      };
    } else {
      return {
        success: false,
        message: '用户不存在'
      };
    }
  } catch (err) {
    console.error('更新用户信息失败:', err);
    return {
      success: false,
      message: '更新用户信息失败',
      error: err.message || err
    };
  }
}

/**
 * 获取用户信息
 * @param {object} db 数据库实例
 * @param {string} openid 用户openid
 */
async function getUserInfo(db, openid) {
  try {
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();
    
    if (userResult.data && userResult.data.length > 0) {
      return {
        code: 200,
        msg: '获取用户信息成功',
        userInfo: userResult.data[0]
      };
    } else {
      return {
        code: 404,
        msg: '用户不存在'
      };
    }
  } catch (err) {
    console.error('获取用户信息失败:', err);
    return {
      code: 500,
      msg: '获取用户信息失败',
      error: err.message || err
    };
  }
} 