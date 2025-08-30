// 云函数入口文件
const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 获取数据库引用
const db = cloud.database();

/**
 * 初始化数据库集合
 * 创建必要的集合
 */
exports.main = async (event, context) => {
  console.log('开始初始化数据库...');
  
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  
  // 定义results对象用于存储各个初始化步骤的结果
  const results = {
    collections: [],
    indexes: [],
    message: '数据库初始化完成'
  };
  
  // 获取管理员权限验证
  const isAdmin = await checkAdminPermission(OPENID);
  
  if (!event.forceInit && !isAdmin) {
    return {
      success: false,
      message: '权限不足，需要管理员权限'
    };
  }

  try {
    // 创建集合
    const collections = [
      'entries',      // 榜单条目
      'users',        // 用户信息
      'orders',       // 订单记录
      'votes',        // 投票记录
      'sounds',       // 自定义音效
      'achievements', // 事迹记录
      'danmakus',     // 弹幕记录
      'comments',     // 评论记录
      'comment_likes' // 评论点赞记录
    ];
    
    // 检查并创建集合
    for (const collName of collections) {
      try {
        // 尝试查询集合，如果失败则创建
        await db.collection(collName).limit(1).get();
        results.collections.push({
          collection: collName,
          status: 'already_exists'
        });
        console.log(`${collName}集合已存在`);
      } catch (err) {
        if (err.errCode === -502005) {
          // 集合不存在，创建集合
          await db.createCollection(collName);
          results.collections.push({
            collection: collName,
            status: 'created'
          });
          console.log(`${collName}集合创建成功`);
        } else {
          console.error(`检查${collName}集合时出错:`, err);
          throw err;
        }
      }
    }
    
    // 注意：微信云开发数据库不支持手动创建索引
    // 索引会根据查询模式自动创建
    results.indexes.push({
      message: '索引将根据查询模式自动创建'
    });

    console.log('数据库初始化完成');
    
    return {
      success: true,
      message: '数据库初始化完成',
      results: results
    };
    
  } catch (err) {
    console.error('初始化数据库失败:', err);
    return {
      success: false,
      error: err.message || err.errMsg || '未知错误',
      errCode: err.errCode || -1
    };
  }
};

/**
 * 检查是否有管理员权限
 * @param {string} openid 用户的openid
 */
async function checkAdminPermission(openid) {
  // 如果openid为空或undefined，直接返回false
  if (!openid) {
    console.log('openid为空，跳过管理员权限检查');
    return false;
  }
  
  try {
    // 在生产环境中，应该从数据库或配置中读取管理员列表
    // 这里简化为硬编码
    const adminOpenids = ['admin_openid_1', 'admin_openid_2'];
    const isAdmin = adminOpenids.includes(openid);
    console.log('管理员权限检查结果:', isAdmin);
    return isAdmin;
  } catch (error) {
    console.error('管理员权限检查失败:', error);
    return false;
  }
} 