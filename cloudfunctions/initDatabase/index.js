// 云函数入口文件 - 初始化数据库集合
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  
  console.log('开始初始化数据库集合...')
  
  try {
    // 需要创建的集合列表
    const collections = [
      'users',
      'userSounds', 
      'soundSettings',
      'pageSoundBindings'
    ]
    
    const results = []
    
    for (const collectionName of collections) {
      try {
        // 尝试在每个集合中插入一个临时文档，这会自动创建集合
        const tempDoc = await db.collection(collectionName).add({
          data: {
            _temp: true,
            createTime: db.serverDate(),
            createdBy: 'initDatabase'
          }
        })
        
        // 立即删除临时文档
        await db.collection(collectionName).doc(tempDoc._id).remove()
        
        results.push({
          collection: collectionName,
          status: 'created',
          message: `集合 ${collectionName} 创建成功`
        })
        
        console.log(`✅ 集合 ${collectionName} 初始化成功`)
        
      } catch (err) {
        console.error(`❌ 集合 ${collectionName} 初始化失败:`, err)
        results.push({
          collection: collectionName,
          status: 'error',
          message: `集合 ${collectionName} 创建失败: ${err.message}`
        })
      }
    }
    
    // 如果用户不存在，创建用户记录
    if (OPENID) {
      try {
        const userRes = await db.collection('users').where({
          openid: OPENID
        }).get()
        
        if (!userRes.data || userRes.data.length === 0) {
          await db.collection('users').add({
            data: {
              openid: OPENID,
              createTime: db.serverDate(),
              updateTime: db.serverDate(),
              createdBy: 'initDatabase'
            }
          })
          
          results.push({
            collection: 'users',
            status: 'user_created',
            message: '用户记录创建成功'
          })
          
          console.log(`✅ 用户记录创建成功: ${OPENID}`)
        } else {
          results.push({
            collection: 'users', 
            status: 'user_exists',
            message: '用户记录已存在'
          })
          
          console.log(`ℹ️ 用户记录已存在: ${OPENID}`)
        }
      } catch (err) {
        console.error('创建用户记录失败:', err)
        results.push({
          collection: 'users',
          status: 'user_error',
          message: `创建用户记录失败: ${err.message}`
        })
      }
    }
    
    const successCount = results.filter(r => r.status === 'created' || r.status === 'user_created').length
    const totalCount = collections.length
    
    return {
      success: true,
      message: `数据库初始化完成！成功创建 ${successCount}/${totalCount} 个集合`,
      results: results,
      openid: OPENID,
      env: cloud.DYNAMIC_CURRENT_ENV
    }
    
  } catch (err) {
    console.error('数据库初始化失败:', err)
    return {
      success: false,
      message: '数据库初始化失败',
      error: err.message,
      openid: OPENID
    }
  }
}
