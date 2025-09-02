// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  console.log('[initDatabase] 开始初始化数据库集合');
  
  try {
    // 创建 dailyVoteRecords 集合
    await db.createCollection('dailyVoteRecords');
    console.log('[initDatabase] dailyVoteRecords 集合创建成功');
    
    // 可以在这里添加索引
    // await db.collection('dailyVoteRecords').createIndex({
    //   name: 'idx_user_entry_date',
    //   keys: {
    //     userId: 1,
    //     entryId: 1,
    //     date: 1
    //   },
    //   unique: true
    // });
    
    return {
      success: true,
      message: 'dailyVoteRecords 集合创建成功',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('[initDatabase] 创建集合失败:', error);
    
    // 如果集合已存在，也算成功
    if (error.errCode === -502006) {
      return {
        success: true,
        message: 'dailyVoteRecords 集合已存在',
        timestamp: new Date().toISOString()
      };
    }
    
    return {
      success: false,
      message: '创建集合失败',
      error: error.message,
      errCode: error.errCode
    };
  }
}