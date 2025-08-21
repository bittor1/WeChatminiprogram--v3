// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  const { action, content, imageUrl, type } = event
  
  // 根据不同的操作执行不同的功能
  switch (action) {
    case 'reviewText':
      return await reviewText(content, type)
    case 'reviewImage':
      return await reviewImage(imageUrl, type)
    default:
      return {
        success: false,
        message: '未知操作类型'
      }
  }
}

/**
 * 审核文本内容
 * @param {string} content 要审核的文本
 * @param {string} type 内容类型（comment, nomination, etc.）
 */
async function reviewText(content, type) {
  if (!content) {
    return {
      success: false,
      message: '缺少审核内容'
    }
  }
  
  try {
    // 调用微信内容安全API
    const result = await cloud.openapi.security.msgSecCheck({
      content: content
    })
    
    // 记录审核日志
    await logReviewResult({
      type: 'text',
      contentType: type || 'unknown',
      content: content.substring(0, 100), // 仅记录前100个字符
      result: result,
      pass: true
    })
    
    return {
      success: true,
      message: '内容审核通过',
      data: result
    }
  } catch (err) {
    console.error('文本内容审核失败:', err)
    
    // 记录审核日志
    await logReviewResult({
      type: 'text',
      contentType: type || 'unknown',
      content: content.substring(0, 100), // 仅记录前100个字符
      result: err,
      pass: false
    })
    
    // 内容违规
    if (err.errCode === 87014) {
      return {
        success: false,
        message: '内容包含敏感信息，请修改后重试',
        errCode: err.errCode
      }
    }
    
    return {
      success: false,
      message: '内容审核失败',
      error: err.message
    }
  }
}

/**
 * 审核图片内容
 * @param {string} imageUrl 要审核的图片URL
 * @param {string} type 内容类型（avatar, nomination, etc.）
 */
async function reviewImage(imageUrl, type) {
  if (!imageUrl) {
    return {
      success: false,
      message: '缺少图片URL'
    }
  }
  
  try {
    // 如果是云存储链接，需要下载临时文件进行审核
    let fileID = imageUrl;
    
    // 如果不是云文件ID格式，先上传到云存储
    if (!imageUrl.startsWith('cloud://')) {
      // 从网络下载图片
      const res = await cloud.downloadFile({
        url: imageUrl,
        options: {
          timeout: 10000 // 10秒超时
        }
      })
      
      // 上传到云存储
      const uploadResult = await cloud.uploadFile({
        cloudPath: `temp/review_${Date.now()}.jpg`,
        fileContent: res.fileContent
      })
      
      fileID = uploadResult.fileID
    }
    
    // 调用微信内容安全API
    const result = await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: 'image/png',
        value: Buffer.from(fileID)
      }
    })
    
    // 记录审核日志
    await logReviewResult({
      type: 'image',
      contentType: type || 'unknown',
      content: imageUrl,
      result: result,
      pass: true
    })
    
    // 如果是临时上传的图片，审核完后删除
    if (fileID !== imageUrl) {
      await cloud.deleteFile({
        fileList: [fileID]
      })
    }
    
    return {
      success: true,
      message: '图片审核通过',
      data: result
    }
  } catch (err) {
    console.error('图片审核失败:', err)
    
    // 记录审核日志
    await logReviewResult({
      type: 'image',
      contentType: type || 'unknown',
      content: imageUrl,
      result: err,
      pass: false
    })
    
    // 内容违规
    if (err.errCode === 87014) {
      return {
        success: false,
        message: '图片包含敏感内容，请更换后重试',
        errCode: err.errCode
      }
    }
    
    return {
      success: false,
      message: '图片审核失败',
      error: err.message
    }
  }
}

/**
 * 记录审核日志
 * @param {object} logData 日志数据
 */
async function logReviewResult(logData) {
  try {
    await db.collection('content_review_logs').add({
      data: {
        ...logData,
        createTime: db.serverDate()
      }
    })
  } catch (error) {
    console.error('记录审核日志失败:', error)
    // 日志记录失败不影响主流程
  }
}

/**
 * 自动违规内容检测（定时触发器调用）
 */
async function autoReviewContent() {
  const collections = ['nominations', 'comments'];
  let flag = false;
  
  try {
    for (const collection of collections) {
      // 获取最近添加的内容进行审核
      const data = await db.collection(collection)
        .where({
          reviewed: _.neq(true) // 未审核过的内容
        })
        .limit(100)
        .get();
      
      for (const item of data.data) {
        if (item.content) {
          // 审核文本内容
          try {
            const result = await reviewText(item.content, collection);
            
            // 更新审核状态
            await db.collection(collection).doc(item._id).update({
              data: {
                reviewed: true,
                reviewResult: result.success,
                reviewTime: db.serverDate()
              }
            });
            
            // 如果内容违规，通知用户并隐藏内容
            if (!result.success && result.errCode === 87014) {
              flag = true;
              
              // 标记内容为违规
              await db.collection(collection).doc(item._id).update({
                data: {
                  isViolation: true,
                  hidden: true
                }
              });
              
              // 发送违规通知
              await cloud.callFunction({
                name: 'messageManage',
                data: {
                  action: 'create',
                  data: {
                    receiverId: item.userId || item.createdBy,
                    type: 'system',
                    content: `您的${collection === 'nominations' ? '提名' : '评论'}内容包含敏感信息，已被系统自动隐藏。请修改后重新提交。`,
                    nominationId: item.nominationId || item._id
                  }
                }
              });
            }
          } catch (err) {
            console.error(`审核${collection}内容失败:`, err);
          }
        }
      }
    }
    
    return {
      success: true,
      flag: flag
    };
  } catch (err) {
    console.error('自动审核内容失败:', err);
    return {
      success: false,
      error: err.message
    };
  }
} 