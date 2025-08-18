const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-2g2sby6z920b76cb'
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, userData } = event;

  switch (action) {
    case 'login': {
      // userData now contains { nickname: '...', avatarUrl: 'cloud://...' }
      return login(openid, userData);
    }
    case 'getUserInfo': {
      return getUserInfo(openid);
    }
    default: {
      return {
        success: false,
        message: '未知的操作类型'
      };
    }
  }
};

// 用户登录或注册
async function login(openid, userData) {
  try {
    const users = db.collection('users');
    const userResult = await users.where({
      _openid: openid
    }).get();

    let userId;

    if (userResult.data.length > 0) {
      // 用户已存在，更新用户信息
      userId = userResult.data[0]._id;
      await users.doc(userId).update({
        data: {
          name: userData.nickname,
          avatarUrl: userData.avatarUrl, // This is now a cloud fileID
          lastLoginTime: new Date()
        }
      });
    } else {
      // 用户不存在，创建新用户
      const newUser = {
        _openid: openid,
        name: userData.nickname,
        avatarUrl: userData.avatarUrl, // This is a cloud fileID
        votes: 0,
        nominationsCount: 0,
        votesCount: 0,
        receivedVotesCount: 0,
        createTime: new Date(),
        lastLoginTime: new Date()
      };
      const addUserResult = await users.add({
        data: newUser
      });
      userId = addUserResult._id;
    }
    
    const finalUserInfo = (await users.doc(userId).get()).data;

    return {
      success: true,
      user: finalUserInfo, // 改为 user 字段以匹配客户端期望
      data: finalUserInfo, // 保留 data 字段以兼容其他可能依赖此字段的代码
      message: '登录成功'
    };
  } catch (err) {
    console.error('登录或注册失败:', err);
    return {
      success: false,
      message: '登录失败'
    };
  }
}

// 获取用户信息
async function getUserInfo(openid) {
  try {
    const users = db.collection('users');
    const userResult = await users.where({
      _openid: openid
    }).get();

    if (userResult.data.length > 0) {
      return {
        success: true,
        data: userResult.data[0]
      };
    } else {
      return {
        success: false,
        message: '用户不存在'
      };
    }
  } catch (err) {
    console.error('获取用户信息失败:', err);
    return {
      success: false,
      message: '获取用户信息失败'
    };
  }
}