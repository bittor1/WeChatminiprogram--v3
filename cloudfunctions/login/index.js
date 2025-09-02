// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * 生成用户token
 * @returns {string} 生成的token
 */
function generateToken() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 10);
  return timestamp + random;
}

/**
 * 创建或更新用户信息
 * @param {object} db 数据库实例
 * @param {string} openid 用户openid
 * @param {string} token 用户token
 * @returns {object} 用户信息
 */
async function upsertUser(db, openid, token) {
  const userCollection = db.collection('users');
  
  // 查询用户是否存在
  const userResult = await userCollection.where({
    _openid: openid
  }).get();
  
  const tokenExpiry = new Date();
  tokenExpiry.setDate(tokenExpiry.getDate() + 30); // token有效期30天
  
  if (userResult.data && userResult.data.length > 0) {
    // 用户已存在，更新token和登录时间
    const userData = userResult.data[0];
    await userCollection.doc(userData._id).update({
      data: {
        token: token,
        tokenExpiry: tokenExpiry,
        lastLoginTime: db.serverDate()
      }
    });
    
    // 返回更新后的用户信息
    return {
      ...userData,
      token: token,
      tokenExpiry: tokenExpiry
    };
  } else {
    // 用户不存在，创建新用户（信息不完整，需要后续授权）
    const newUser = {
      _openid: openid,
      nickname: '', // 空昵称，表示需要用户设置
      avatarUrl: '', // 空头像，表示需要用户设置
      gender: 0,
      votes: 0,
      nominationsCount: 0,
      votesCount: 0,
      receivedVotesCount: 0,
      isInfoComplete: false, // 添加标识，表示用户信息不完整
      token: token,
      tokenExpiry: tokenExpiry,
      createTime: db.serverDate(),
      lastLoginTime: db.serverDate()
    };
    
    const addResult = await userCollection.add({
      data: newUser
    });
    
    return {
      _id: addResult._id,
      ...newUser
    };
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const db = cloud.database();
  
  try {
    // 无感登录：仅需要验证用户身份即可
    if (!openid) {
      return {
        success: false,
        code: 401,
        message: '获取用户身份失败'
      };
    }
    
    // 生成新的token
    const token = generateToken();
    
    // 创建或更新用户信息
    const userData = await upsertUser(db, openid, token);
    
    // 记录登录日志
    await db.collection('login_logs').add({
      data: {
        openid: openid,
        token: token,
        loginType: 'silent', // 无感登录标识
        createTime: db.serverDate(),
        deviceInfo: event.deviceInfo || {},
        success: true
      }
    }).catch(err => {
      console.error('记录登录日志失败:', err);
      // 日志记录失败不影响主流程
    });
    
    // 确保用户信息包含openid字段（用于权限验证）
    const userInfoWithOpenid = {
      ...userData,
      openid: userData._openid || openid
    };
    
    return {
      success: true,
      code: 200,
      message: '登录成功',
      data: {
        token: token,
        userInfo: userInfoWithOpenid
      }
    };
  } catch (err) {
    console.error('无感登录失败:', err);
    
    // 记录错误日志
    try {
      await db.collection('login_logs').add({
        data: {
          openid: openid,
          loginType: 'silent',
          createTime: db.serverDate(),
          deviceInfo: event.deviceInfo || {},
          success: false,
          error: err.message || String(err)
        }
      });
    } catch (logErr) {
      console.error('记录错误日志失败:', logErr);
    }
    
    return {
      success: false,
      code: 500,
      message: '登录失败',
      error: err.message || err
    };
  }
} 