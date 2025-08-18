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
 * 创建必要的集合和索引
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  
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
      'sounds'        // 自定义音效
    ];
    
    const createResults = [];
    
    // 检查并创建集合
    for (const collName of collections) {
      try {
        // 尝试查询集合，如果失败则创建
        await db.collection(collName).limit(1).get();
        createResults.push({
          collection: collName,
          status: 'already_exists'
        });
      } catch (err) {
        if (err.errCode === -502005) {
          // 集合不存在，创建集合
          await db.createCollection(collName);
          createResults.push({
            collection: collName,
            status: 'created'
          });
        } else {
          throw err;
        }
      }
    }
    
    // 创建索引
    const indexResults = [];
    
    // entries集合上的votes降序索引
    try {
      await db.collection('entries').createIndex({
        name: 'votes_desc',
        unique: false,
        keys: {
          votes: -1 // 降序
        }
      });
      
      indexResults.push({
        collection: 'entries',
        index: 'votes_desc',
        status: 'created'
      });
    } catch (err) {
      if (err.errCode !== -501001) { // 索引已存在
        throw err;
      }
      
      indexResults.push({
        collection: 'entries',
        index: 'votes_desc',
        status: 'already_exists'
      });
    }
    
    // users集合上的openid索引
    try {
      await db.collection('users').createIndex({
        name: 'openid',
        unique: true,
        keys: {
          openid: 1 // 升序
        }
      });
      
      indexResults.push({
        collection: 'users',
        index: 'openid',
        status: 'created'
      });
    } catch (err) {
      if (err.errCode !== -501001) { // 索引已存在
        throw err;
      }
      
      indexResults.push({
        collection: 'users',
        index: 'openid',
        status: 'already_exists'
      });
    }
    
    // 检查是否需要初始化示例数据
    const initSampleData = event.initSampleData === true;
    let sampleDataResult = { status: 'skipped' };
    
    if (initSampleData) {
      sampleDataResult = await createSampleData();
    }
    
    return {
      success: true,
      results: {
        collections: createResults,
        indexes: indexResults,
        sampleData: sampleDataResult
      }
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
  // 在生产环境中，应该从数据库或配置中读取管理员列表
  // 这里简化为硬编码
  const adminOpenids = ['admin_openid_1', 'admin_openid_2'];
  return adminOpenids.includes(openid);
}

/**
 * 创建示例数据
 */
async function createSampleData() {
  const now = db.serverDate();
  
  try {
    // 清空已有数据
    await clearCollection('entries');
    
    // 创建示例用户
    const userResult = await db.collection('users').add({
      data: {
        openid: 'sample_user_openid',
        nickName: '示例用户',
        avatarUrl: '/public/placeholder-user.jpg',
        createdAt: now
      }
    });
    
    // 创建示例榜单条目
    const entries = [
      {
        name: '张三',
        avatarUrl: '/public/placeholder-user.jpg',
        votes: 1250,
        trend: 'up',
        hotLevel: 5,
        isGif: false,
        createdBy: userResult._id,
        createdAt: now
      },
      {
        name: '李四',
        avatarUrl: '/public/placeholder-user.jpg',
        votes: 1120,
        trend: 'up',
        hotLevel: 4,
        isGif: false,
        createdBy: userResult._id,
        createdAt: now
      },
      {
        name: '王五',
        avatarUrl: '/public/placeholder-user.jpg',
        votes: 980,
        trend: 'stable',
        hotLevel: 3,
        isGif: true,
        createdBy: userResult._id,
        createdAt: now
      }
    ];
    
    const entriesResults = await Promise.all(
      entries.map(entry => db.collection('entries').add({ data: entry }))
    );
    
    return {
      status: 'success',
      users: 1,
      entries: entriesResults.length
    };
  } catch (err) {
    console.error('创建示例数据失败:', err);
    return {
      status: 'failed',
      error: err.message || err.errMsg || '未知错误'
    };
  }
}

/**
 * 清空集合中的所有数据
 * @param {string} collName 集合名称
 */
async function clearCollection(collName) {
  try {
    // 获取集合中的所有文档
    const MAX_LIMIT = 100;
    const countResult = await db.collection(collName).count();
    const total = countResult.total;
    
    if (total === 0) return true;
    
    // 计算需要分几次请求
    const batchTimes = Math.ceil(total / MAX_LIMIT);
    
    // 分批获取所有ID并删除
    for (let i = 0; i < batchTimes; i++) {
      const result = await db.collection(collName)
        .limit(MAX_LIMIT)
        .get();
      
      const ids = result.data.map(item => item._id);
      
      // 批量删除
      if (ids.length > 0) {
        await db.collection(collName)
          .where({
            _id: db.command.in(ids)
          })
          .remove();
      }
    }
    
    return true;
  } catch (err) {
    console.error(`清空集合 ${collName} 失败:`, err);
    throw err;
  }
} 