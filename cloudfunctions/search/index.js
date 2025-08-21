// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  const { action, keyword, category, limit = 20, skip = 0 } = event
  
  // 根据不同的操作执行不同的功能
  switch (action) {
    case 'searchNominations':
      return await searchNominations(keyword, category, limit, skip)
    case 'searchByLocation':
      return await searchByLocation(event.location, event.radius, limit, skip)
    case 'getRecommendations':
      return await getRecommendations(OPENID, limit)
    case 'getPopularSearches':
      return await getPopularSearches(limit)
    default:
      return {
        success: false,
        message: '未知操作类型'
      }
  }
}

/**
 * 搜索提名
 * @param {string} keyword 搜索关键词
 * @param {string} category 分类过滤（可选）
 * @param {number} limit 每页数量
 * @param {number} skip 跳过记录数
 */
async function searchNominations(keyword, category, limit = 20, skip = 0) {
  try {
    // 记录搜索关键词
    if (keyword) {
      await logSearch(keyword);
    }
    
    // 构建查询条件
    let query = {}
    
    // 如果提供了关键词，添加模糊搜索条件
    if (keyword && keyword.trim()) {
      // 分词处理关键词
      const keywords = keyword.trim().split(/\s+/).filter(k => k);
      
      if (keywords.length > 0) {
        // 构建OR条件，匹配任一关键词
        const orConditions = keywords.map(k => {
          return {
            name: db.RegExp({
              regexp: k,
              options: 'i'
            })
          }
        });
        
        // 再添加描述字段的搜索
        keywords.forEach(k => {
          orConditions.push({
            description: db.RegExp({
              regexp: k,
              options: 'i'
            })
          });
          
          // 修改为搜索location字段
          orConditions.push({
            location: db.RegExp({
              regexp: k,
              options: 'i'
            })
          });
        });
        
        query = _.or(orConditions);
      }
    }
    
    // 如果提供了分类，添加分类过滤
    if (category) {
      query = _.and([
        query,
        { category: category }
      ]);
    }
    
    // 执行搜索查询
    const searchResult = await db.collection('entries')
      .where(query)
      .orderBy('votes', 'desc')
      .skip(skip)
      .limit(limit)
      .get();
    
    // 获取总记录数
    const countResult = await db.collection('entries')
      .where(query)
      .count();
    
    return {
      success: true,
      data: searchResult.data,
      total: countResult.total,
      hasMore: skip + searchResult.data.length < countResult.total
    };
  } catch (err) {
    console.error('搜索提名失败:', err);
    return {
      success: false,
      message: '搜索失败',
      error: err.message
    };
  }
}

/**
 * 根据位置搜索提名
 * @param {object} location 位置坐标 {latitude, longitude}
 * @param {number} radius 搜索半径（公里）
 * @param {number} limit 每页数量
 * @param {number} skip 跳过记录数
 */
async function searchByLocation(location, radius = 5, limit = 20, skip = 0) {
  if (!location || !location.latitude || !location.longitude) {
    return {
      success: false,
      message: '缺少位置信息'
    }
  }
  
  try {
    // 使用聚合操作计算距离并筛选
    const result = await db.collection('entries')
      .aggregate()
      .geoNear({
        distanceField: 'distance', // 输出的距离字段名
        spherical: true,
        near: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude]
        },
        maxDistance: radius * 1000, // 转换为米
        query: {
          location: _.exists(true) // 确保有位置字段
        }
      })
      .skip(skip)
      .limit(limit)
      .end()
    
    // 计算总数（这是一个近似值，因为geoNear不支持直接计数）
    const approximateTotal = await db.collection('entries')
      .where({
        location: _.exists(true) // 确保有位置字段
      })
      .count()
    
    return {
      success: true,
      data: result.list,
      total: approximateTotal.total,
      hasMore: result.list.length >= limit // 近似判断
    }
  } catch (err) {
    console.error('位置搜索失败:', err)
    return {
      success: false,
      message: '位置搜索失败',
      error: err.message
    }
  }
}

/**
 * 获取推荐提名
 * @param {string} openid 用户的openid
 * @param {number} limit 返回数量
 */
async function getRecommendations(openid, limit = 10) {
  try {
    // 获取用户信息
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (!userRes.data || userRes.data.length === 0) {
      // 用户不存在，返回热门提名
      return await getHotNominations(limit)
    }
    
    const user = userRes.data[0]
    
    // 获取用户已投票的提名
    const votedNominations = await db.collection('votes')
      .where({
        userId: user._id
      })
      .get()
    
    // 提取已投票的提名ID
    const votedIds = votedNominations.data.map(vote => vote.targetId)
    
    // 查询用户可能喜欢的提名（基于投票历史的分类）
    const userVotedCategories = await db.collection('votes')
      .aggregate()
      .match({
        userId: user._id
      })
      .lookup({
        from: 'entries',
        localField: 'targetId',
        foreignField: '_id',
        as: 'nomination'
      })
      .unwind('$nomination')
      .group({
        _id: '$nomination.category',
        count: $.sum(1)
      })
      .sort({
        count: -1
      })
      .limit(3) // 取用户最常投票的3个分类
      .end()
    
    // 如果用户有投票历史
    if (userVotedCategories.list.length > 0) {
      const preferredCategories = userVotedCategories.list.map(item => item._id).filter(Boolean)
      
      // 如果有明确的分类偏好
      if (preferredCategories.length > 0) {
        // 查询符合用户偏好分类且未投票的提名
        const recommendResult = await db.collection('entries')
          .where({
            category: _.in(preferredCategories),
            _id: _.nin(votedIds) // 排除已投票的
          })
          .orderBy('votes', 'desc')
          .limit(limit)
          .get()
        
        // 如果找到了推荐
        if (recommendResult.data && recommendResult.data.length > 0) {
          return {
            success: true,
            data: recommendResult.data,
            type: 'personalized'
          }
        }
      }
    }
    
    // 如果没有找到个性化推荐，返回热门提名（排除已投票的）
    return await getHotNominations(limit, votedIds)
  } catch (err) {
    console.error('获取推荐提名失败:', err)
    return {
      success: false,
      message: '获取推荐失败',
      error: err.message
    }
  }
}

/**
 * 获取热门提名
 * @param {number} limit 返回数量
 * @param {array} excludeIds 排除的ID列表
 */
async function getHotNominations(limit = 10, excludeIds = []) {
  try {
    let query = {}
    
    // 如果有需要排除的ID
    if (excludeIds && excludeIds.length > 0) {
      query._id = _.nin(excludeIds)
    }
    
    // 获取热门提名
    const hotResult = await db.collection('entries')
      .where(query)
      .orderBy('votes', 'desc')
      .limit(limit)
      .get()
    
    return {
      success: true,
      data: hotResult.data,
      type: 'trending'
    }
  } catch (err) {
    console.error('获取热门提名失败:', err)
    return {
      success: false,
      message: '获取热门提名失败',
      error: err.message
    }
  }
}

/**
 * 获取热门搜索关键词
 * @param {number} limit 返回数量
 */
async function getPopularSearches(limit = 10) {
  try {
    const result = await db.collection('search_logs')
      .aggregate()
      .group({
        _id: '$keyword',
        count: $.sum(1)
      })
      .sort({
        count: -1
      })
      .limit(limit)
      .end()
    
    return {
      success: true,
      data: result.list.map(item => ({
        keyword: item._id,
        count: item.count
      }))
    }
  } catch (err) {
    console.error('获取热门搜索失败:', err)
    return {
      success: false,
      message: '获取热门搜索失败',
      error: err.message
    }
  }
}

/**
 * 记录搜索日志
 * @param {string} keyword 搜索关键词
 */
async function logSearch(keyword) {
  try {
    // 只记录有意义的关键词
    if (keyword && keyword.trim().length > 1) {
      await db.collection('search_logs').add({
        data: {
          keyword: keyword.trim().toLowerCase(), // 统一转小写便于统计
          createTime: db.serverDate()
        }
      })
    }
  } catch (error) {
    console.error('记录搜索日志失败:', error)
    // 搜索日志记录失败不影响主流程
  }
} 