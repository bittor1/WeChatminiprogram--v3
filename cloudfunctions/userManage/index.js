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
        nickname: userInfo.nickName || '微信用户',
        avatarUrl: userInfo.avatarUrl || '/images/placeholder-user.jpg',
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