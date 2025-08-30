// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token } = event;
  const db = cloud.database();
  
  try {
    if (!token) {
      return {
        valid: false,
        message: '缺少token参数'
      };
    }
    
    // 查询token是否存在且未过期
    const userResult = await db.collection('users')
      .where({
        token: token,
        tokenExpiry: db.command.gt(new Date())
      })
      .get();
    
    if (userResult.data && userResult.data.length > 0) {
      const userData = userResult.data[0];
      
      // 更新最后活跃时间
      await db.collection('users').doc(userData._id).update({
        data: {
          lastActiveTime: db.serverDate()
        }
      });
      
      return {
        valid: true,
        message: 'token有效',
        userInfo: userData
      };
    } else {
      return {
        valid: false,
        message: 'token无效或已过期'
      };
    }
  } catch (err) {
    console.error('验证token失败:', err);
    return {
      valid: false,
      message: '验证失败',
      error: err.message || err
    };
  }
}
