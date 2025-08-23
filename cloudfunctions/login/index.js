// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * 验证场景值是否有效
 * @param {object} db 数据库实例
 * @param {string} scene 场景值
 * @returns {object} 验证结果，包含isValid和record
 */
async function validateScene(db, scene) {
  // 检查场景值格式
  if (!scene || typeof scene !== 'string' || scene.length < 5) {
    return { isValid: false };
  }
  
  // 检查场景值是否存在且未过期
  const result = await db.collection('scanlogin_auth')
    .where({
      scene: scene,
      expire: 1
    })
    .get();
  
  if (result.data.length === 0) {
    return { isValid: false };
  }
  
  // 检查是否已过期
  const record = result.data[0];
  if (record.expiresAt && new Date() > new Date(record.expiresAt)) {
    return { isValid: false };
  }
  
  return { isValid: true, record };
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  let openid = wxContext.OPENID;
  
  // 如果有code参数，则通过code获取openid
  if (event.code) {
    try {
      // 直接使用cloud.getWXContext()获取的openid，不需要额外调用code2Session
      console.log('通过wx.login获取的code登录:', event.code);
      console.log('当前用户openid:', openid);
      
      // 返回登录成功结果
      return {
        code: 200,
        msg: '登录成功',
        openid: openid
      };
    } catch (err) {
      console.error('通过code获取openid失败:', err);
      return {
        code: 500,
        msg: '登录失败',
        error: err.message || err
      };
    }
  }
  
  // 以下是原有的扫码登录逻辑
  const scene = event.scene;
  
  // 参数验证
  if (!scene) {
    return {
      code: 400,
      msg: '缺少必要参数scene'
    };
  }
  
  try {
    const token = Date.now().toString(36) + Math.random().toString(36).substr(2, 10);
    const userInfo = event.userInfo || null;
    
    const db = cloud.database();
    
    // 验证场景值
    const { isValid, record } = await validateScene(db, scene);
    if (!isValid) {
      return {
        code: 404,
        msg: '无效的登录请求或已过期'
      };
    }
    
    // 检查用户是否存在
    const userCollection = db.collection('users');
    const userResult = await userCollection.where({
      _openid: openid
    }).get();
    
    let userData = null;
    
    if (userResult.data && userResult.data.length > 0) {
      // 用户已存在，更新登录时间
      userData = userResult.data[0];
      await userCollection.doc(userData._id).update({
        data: {
          lastLoginTime: db.serverDate()
        }
      });
    } else if (userInfo) {
      // 用户不存在，创建新用户
      const newUser = {
        _openid: openid,
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
      
      const addResult = await userCollection.add({
        data: newUser
      });
      
      userData = {
        _id: addResult._id,
        ...newUser
      };
    } else {
      // 没有用户信息，使用默认值
      userData = {
        _openid: openid,
        nickname: '微信用户',
        avatarUrl: '/images/placeholder-user.jpg'
      };
    }
    
    // 更新登录状态
    const updateResult = await db.collection('scanlogin_auth')
      .where({
        scene: scene,
        expire: 1
      })
      .update({
        data: {
          openid: openid,
          authTime: db.serverDate(),
          status: 3, // 已授权
          token: token,
          userInfo: userData
        }
      });
    
    if (updateResult.stats.updated === 0) {
      return {
        code: 404,
        msg: '无效的登录请求或已过期'
      };
    }
    
    // 记录登录日志
    await db.collection('login_logs').add({
      data: {
        scene: scene,
        openid: openid,
        token: token,
        createTime: db.serverDate(),
        deviceInfo: event.deviceInfo || {},
        success: true
      }
    }).catch(err => {
      console.error('记录登录日志失败:', err);
      // 日志记录失败不影响主流程
    });
    
    return {
      code: 200,
      msg: '登录成功',
      token: token,
      userInfo: userData
    };
  } catch (err) {
    console.error('登录失败:', err);
    
    // 记录错误日志
    try {
      const db = cloud.database();
      await db.collection('login_logs').add({
        data: {
          scene: scene,
          openid: openid,
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
      code: 500,
      msg: '登录失败',
      error: err.message || err
    };
  }
} 