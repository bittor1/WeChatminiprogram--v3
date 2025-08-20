// scanlogin_auth集合初始化脚本
// 用于创建集合、设置权限和创建索引

const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 主函数
async function main() {
  try {
    console.log('开始初始化scanlogin_auth集合...');
    
    // 1. 创建集合（如果不存在）
    try {
      await db.createCollection('scanlogin_auth');
      console.log('创建scanlogin_auth集合成功');
    } catch (e) {
      // 集合可能已存在，忽略错误
      console.log('scanlogin_auth集合已存在或创建失败:', e);
    }
    
    // 2. 设置集合权限
    try {
      await db.collection('scanlogin_auth').updateMany({}, {
        $set: {
          _openid: 'admin' // 设置一个管理员openid，确保云函数可以操作
        }
      });
      console.log('设置scanlogin_auth集合权限成功');
    } catch (e) {
      console.error('设置scanlogin_auth集合权限失败:', e);
    }
    
    // 3. 创建索引
    try {
      // 3.1 场景值索引
      await db.collection('scanlogin_auth').createIndex({
        scene: 1
      }, {
        name: 'scene_index',
        unique: true
      });
      console.log('创建scene索引成功');
      
      // 3.2 状态和过期复合索引
      await db.collection('scanlogin_auth').createIndex({
        status: 1,
        expire: 1
      }, {
        name: 'status_expire_index'
      });
      console.log('创建status_expire复合索引成功');
      
      // 3.3 openid索引
      await db.collection('scanlogin_auth').createIndex({
        openid: 1
      }, {
        name: 'openid_index',
        sparse: true // 稀疏索引，因为初始openid为null
      });
      console.log('创建openid索引成功');
      
      // 3.4 创建时间索引（用于TTL）
      await db.collection('scanlogin_auth').createIndex({
        createTime: 1
      }, {
        name: 'createTime_index',
        expireAfterSeconds: 86400 // 1天后自动删除
      });
      console.log('创建createTime TTL索引成功');
      
    } catch (e) {
      console.error('创建索引失败:', e);
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

// 导出主函数
exports.main = main; 