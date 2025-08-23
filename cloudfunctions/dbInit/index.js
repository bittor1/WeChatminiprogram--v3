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
  
  // 定义results对象用于存储各个初始化步骤的结果
  const results = {
    collections: [],
    indexes: [],
    sampleData: null,
    scanloginAuth: null,
    danmakus: null
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
      'danmakus'      // 弹幕记录
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
      } catch (err) {
        if (err.errCode === -502005) {
          // 集合不存在，创建集合
          await db.createCollection(collName);
          results.collections.push({
            collection: collName,
            status: 'created'
          });
        } else {
          throw err;
        }
      }
    }
    
    // 创建索引
    // entries集合上的votes降序索引
    try {
      await db.collection('entries').createIndex({
        name: 'votes_desc',
        unique: false,
        keys: {
          votes: -1 // 降序
        }
      });
      
      results.indexes.push({
        collection: 'entries',
        index: 'votes_desc',
        status: 'created'
      });
    } catch (err) {
      if (err.errCode !== -501001) { // 索引已存在
        throw err;
      }
      
      results.indexes.push({
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
      
      results.indexes.push({
        collection: 'users',
        index: 'openid',
        status: 'created'
      });
    } catch (err) {
      if (err.errCode !== -501001) { // 索引已存在
        throw err;
      }
      
      results.indexes.push({
        collection: 'users',
        index: 'openid',
        status: 'already_exists'
      });
    }

    // 在dbInit云函数中添加scanlogin_auth集合的初始化

    // 添加初始化scanlogin_auth集合的函数
    async function initScanLoginAuth(db) {
      console.log('开始初始化scanlogin_auth集合...');
      
      try {
        // 1. 创建集合（如果不存在）
        try {
          await db.createCollection('scanlogin_auth');
          console.log('创建scanlogin_auth集合成功');
        } catch (e) {
          // 集合可能已存在，忽略错误
          console.log('scanlogin_auth集合已存在或创建失败:', e);
        }
        
        // 2. 创建索引
        try {
          // 2.1 场景值索引
          await db.collection('scanlogin_auth').createIndex({
            scene: 1
          }, {
            name: 'scene_index',
            unique: true
          });
          console.log('创建scene索引成功');
          
          // 2.2 状态和过期复合索引
          await db.collection('scanlogin_auth').createIndex({
            status: 1,
            expire: 1
          }, {
            name: 'status_expire_index'
          });
          console.log('创建status_expire复合索引成功');
          
          // 2.3 openid索引
          await db.collection('scanlogin_auth').createIndex({
            openid: 1
          }, {
            name: 'openid_index',
            sparse: true // 稀疏索引，因为初始openid为null
          });
          console.log('创建openid索引成功');
          
          // 2.4 创建时间索引（用于TTL）
          await db.collection('scanlogin_auth').createIndex({
            createTime: 1
          }, {
            name: 'createTime_index',
            expireAfterSeconds: 86400 // 1天后自动删除
          });
          console.log('创建createTime TTL索引成功');
          
        } catch (e) {
          console.error('创建索引失败:', e);
          throw e;
        }
        
        console.log('scanlogin_auth集合初始化完成');
        return {
          success: true,
          message: 'scanlogin_auth集合初始化成功'
        };
      } catch (error) {
        console.error('scanlogin_auth集合初始化失败:', error);
        return {
          success: false,
          message: 'scanlogin_auth集合初始化失败',
          error: error
        };
      }
    }

    // 在主函数中调用scanlogin_auth初始化
    // 在exports.main函数中的适当位置添加：
    // const scanloginAuthResult = await initScanLoginAuth(db);
    // results.scanloginAuth = scanloginAuthResult;
    
    // 检查是否需要初始化示例数据
    const shouldInitSampleData = event.initSampleData === true;

    // 初始化示例数据
    if (shouldInitSampleData) {
      results.sampleData = await createSampleData();
    } else {
      results.sampleData = {
        status: 'skipped',
        message: '未请求初始化示例数据'
      };
    }
    
    // 初始化scanlogin_auth集合的索引
    const scanloginAuthResult = await initScanLoginAuth(db);
    results.scanloginAuth = scanloginAuthResult;

    /**
     * 初始化danmakus集合
     */
    async function initDanmakusCollection() {
      try {
        // 检查集合是否存在
        try {
          await db.collection('danmakus').limit(1).get();
          console.log('danmakus集合已存在');
        } catch (err) {
          if (err.errCode === -502005) {
            // 集合不存在，创建集合
            console.log('danmakus集合不存在，开始创建...');
            await db.createCollection('danmakus');
            console.log('danmakus集合创建成功');
          } else {
            throw err;
          }
        }
        
        // 创建索引
        try {
          // 按创建时间创建索引，用于排序
          await db.collection('danmakus').createIndex({
            name: 'createTime',
            unique: false,
            keys: {
              createTime: 1 // 1表示升序，-1表示降序
            }
          });
          console.log('danmakus集合createTime索引创建成功');
          
          // 按targetId创建索引，用于查询特定条目的弹幕
          await db.collection('danmakus').createIndex({
            name: 'targetId',
            unique: false,
            keys: {
              targetId: 1
            }
          });
          console.log('danmakus集合targetId索引创建成功');
          
          // 按openid创建索引，用于查询用户的弹幕
          await db.collection('danmakus').createIndex({
            name: 'openid',
            unique: false,
            keys: {
              openid: 1
            }
          });
          console.log('danmakus集合openid索引创建成功');
        } catch (err) {
          console.error('创建danmakus集合索引失败:', err);
        }
        
        return true;
      } catch (err) {
        console.error('初始化danmakus集合失败:', err);
        return false;
      }
    }

    // 初始化所有集合
    async function initAllCollections() {
      // 初始化danmakus集合
      const danmakusResult = await initDanmakusCollection();
      results.danmakus = danmakusResult;
    }

    // 在主函数中调用initAllCollections
    await initAllCollections();

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
        avatarUrl: '/images/placeholder-user.jpg',
        createdAt: now
      }
    });
    
    // 创建示例榜单条目
    const entries = [
      {
        name: '张三',
        avatarUrl: '/images/placeholder-user.jpg',
        votes: 1250,
        trend: 'up',
        hotLevel: 5,
        isGif: false,
        createdBy: userResult._id,
        createdAt: now
      },
      {
        name: '李四',
        avatarUrl: '/images/placeholder-user.jpg',
        votes: 1120,
        trend: 'up',
        hotLevel: 4,
        isGif: false,
        createdBy: userResult._id,
        createdAt: now
      },
      {
        name: '王五',
        avatarUrl: '/images/placeholder-user.jpg',
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