const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 主函数入口
exports.main = async (event, context) => {
  const { action, userId, achievement } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('[achievementManage] 云函数被调用:', {
    action,
    userId,
    achievement,
    openid
  });

  try {
    let result;
    switch (action) {
      case 'add': 
        result = await addAchievement(userId, achievement, openid);
        console.log('[achievementManage] 添加事迹结果:', result);
        return result;
      case 'get':
        result = await getAchievements(userId);
        console.log('[achievementManage] 获取事迹结果:', result);
        return result;
      case 'delete':
        result = await deleteAchievement(event.achievementId, openid);
        console.log('[achievementManage] 删除事迹结果:', result);
        return result;
      default:
        console.log('[achievementManage] 未知操作:', action);
        return { success: false, message: '未知操作' };
    }
  } catch (error) {
    console.error(`[achievementManage] 事迹管理云函数错误: ${error.message}`, error);
    return { success: false, message: '操作失败', error: error.message };
  }
};

// 添加事迹
async function addAchievement(userId, achievement, openid) {
  // 参数验证
  if (!userId || !achievement || !achievement.content) {
    console.log('[achievementManage] 添加事迹失败: 参数不完整', { userId, achievement });
    return { success: false, message: '参数不完整' };
  }
  
  console.log('[achievementManage] 开始添加事迹，userId:', userId, 'content:', achievement.content);
  
  // 获取用户信息
  let userInfo;
  try {
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();
    
    console.log('[achievementManage] 查询用户信息结果:', userResult.data);
    
    if (userResult.data.length > 0) {
      userInfo = userResult.data[0];
    } else {
      // 如果用户不存在，使用默认值
      console.log('[achievementManage] 用户信息不存在，使用默认值');
      userInfo = {
        name: '用户',
        avatar: '/images/placeholder-user.jpg'
      };
    }
  } catch (error) {
    console.error('[achievementManage] 获取用户信息失败:', error);
    // 使用默认值继续
    userInfo = {
      name: '用户',
      avatar: '/images/placeholder-user.jpg'
    };
  }
  
  // 检查集合是否存在
  try {
    await db.collection('achievements').limit(1).get();
  } catch (err) {
    if (err.errCode === -502005) {
      console.error('[achievementManage] achievements集合不存在，尝试创建');
      try {
        await db.createCollection('achievements');
        console.log('[achievementManage] achievements集合创建成功');
      } catch (createErr) {
        console.error('[achievementManage] 创建集合失败:', createErr);
        return { success: false, message: '数据库集合不存在且无法创建', error: createErr.message };
      }
    } else {
      console.error('[achievementManage] 检查集合时出错:', err);
      return { success: false, message: '检查数据库集合失败', error: err.message };
    }
  }
  
  // 创建事迹
  const achievementData = {
    userId: userId,
    content: achievement.content,
    date: achievement.date,
    type: achievement.type || 'neutral',
    location: achievement.location || '伦敦',
    creatorId: openid,
    creatorName: userInfo.name || '用户',
    creatorAvatar: userInfo.avatar || '/images/placeholder-user.jpg',
    createTime: db.serverDate(),
    updateTime: db.serverDate()
  };
  
  console.log('[achievementManage] 准备添加事迹数据:', achievementData);
  
  try {
    // 添加事迹
    const result = await db.collection('achievements').add({
      data: achievementData
    });
    
    console.log('[achievementManage] 添加事迹成功，ID:', result._id);
    
    return { success: true, achievementId: result._id };
  } catch (error) {
    console.error('[achievementManage] 添加事迹失败:', error);
    return { success: false, message: '添加事迹失败', error: error.message };
  }
}

// 获取事迹列表
async function getAchievements(userId) {
  // 参数验证
  if (!userId) {
    console.log('[achievementManage] 获取事迹失败: 参数不完整，缺少userId');
    return { success: false, message: '参数不完整' };
  }
  
  console.log('[achievementManage] 开始获取事迹列表，userId:', userId);
  
  try {
    // 检查集合是否存在
    try {
      await db.collection('achievements').limit(1).get();
    } catch (err) {
      if (err.errCode === -502005) {
        console.error('[achievementManage] achievements集合不存在，尝试创建');
        try {
          await db.createCollection('achievements');
          console.log('[achievementManage] achievements集合创建成功');
        } catch (createErr) {
          console.error('[achievementManage] 创建集合失败:', createErr);
          return { success: false, message: '数据库集合不存在且无法创建', error: createErr.message };
        }
      } else {
        console.error('[achievementManage] 检查集合时出错:', err);
        return { success: false, message: '检查数据库集合失败', error: err.message };
      }
    }
    
    // 获取事迹列表
    const achievementsResult = await db.collection('achievements')
      .where({
        userId: userId
      })
      .orderBy('createTime', 'desc')
      .get();
    
    console.log('[achievementManage] 获取事迹成功，数量:', achievementsResult.data.length, '数据:', JSON.stringify(achievementsResult.data));
    
    return {
      success: true,
      achievements: achievementsResult.data
    };
  } catch (error) {
    console.error('[achievementManage] 获取事迹列表失败:', error);
    return { success: false, message: '获取事迹列表失败', error: error.message };
  }
}

// 删除事迹
async function deleteAchievement(achievementId, openid) {
  // 参数验证
  if (!achievementId) {
    return { success: false, message: '参数不完整' };
  }
  
  try {
    // 获取事迹信息
    const achievementResult = await db.collection('achievements').doc(achievementId).get();
    const achievement = achievementResult.data;
    
    // 检查权限（只有事迹创建者可以删除）
    if (achievement.creatorId !== openid) {
      return { success: false, message: '没有权限删除此事迹' };
    }
    
    // 删除事迹
    await db.collection('achievements').doc(achievementId).remove();
    
    return { success: true };
  } catch (error) {
    console.error('删除事迹失败:', error);
    return { success: false, message: '删除事迹失败', error: error.message };
  }
} 