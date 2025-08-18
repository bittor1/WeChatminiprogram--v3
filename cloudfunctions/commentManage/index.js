const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 主函数入口
exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext();
  const userId = wxContext.OPENID;

  try {
    switch (action) {
      case 'add': 
        return await addComment(data, userId);
      case 'reply':
        return await replyComment(data, userId);
      case 'list':
        return await listComments(data);
      case 'listReplies':
        return await listReplies(data);
      case 'delete':
        return await deleteComment(data, userId);
      case 'like':
        return await likeComment(data, userId);
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (error) {
    console.error(`评论管理云函数错误: ${error.message}`, error);
    return { success: false, message: '操作失败', error: error.message };
  }
};

// 添加评论
async function addComment(data, userId) {
  // 参数验证
  if (!data.nominationId || !data.content) {
    return { success: false, message: '参数不完整' };
  }
  
  // 获取用户信息
  let userInfo;
  try {
    const userResult = await db.collection('users').where({
      _openid: userId
    }).get();
    
    if (userResult.data.length > 0) {
      userInfo = userResult.data[0];
    } else {
      // 如果用户不存在，使用默认值
      userInfo = {
        name: '用户',
        avatar: '/public/placeholder-user.jpg'
      };
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
    // 使用默认值继续
    userInfo = {
      name: '用户',
      avatar: '/public/placeholder-user.jpg'
    };
  }
  
  // 创建评论
  const commentData = {
    nominationId: data.nominationId,
    content: data.content,
    creatorId: userId,
    creatorName: userInfo.name || '用户',
    creatorAvatar: userInfo.avatar || '/public/placeholder-user.jpg',
    parentId: null,
    rootId: null,
    replyTo: { userId: null, userName: null },
    createTime: db.serverDate(),
    updateTime: db.serverDate(),
    likes: 0,
    status: 0  // 0-正常，1-删除
  };
  
  try {
    // 添加评论
    const result = await db.collection('comments').add({
      data: commentData
    });
    
    // 更新提名评论数
    await db.collection('nominations').doc(data.nominationId).update({
      data: {
        commentCount: _.inc(1),
        updateTime: db.serverDate()
      }
    });
    
    // 创建消息通知
    await createCommentNotification(data.nominationId, userId);
    
    return { success: true, commentId: result._id };
  } catch (error) {
    console.error('添加评论失败:', error);
    return { success: false, message: '添加评论失败', error: error.message };
  }
}

// 回复评论
async function replyComment(data, userId) {
  // 参数验证
  if (!data.nominationId || !data.content || !data.parentId) {
    return { success: false, message: '参数不完整' };
  }
  
  try {
    // 获取用户信息和父评论信息
    const [userResult, parentComment] = await Promise.all([
      db.collection('users').where({ _openid: userId }).get(),
      db.collection('comments').doc(data.parentId).get()
    ]);
    
    const userInfo = userResult.data.length > 0 ? userResult.data[0] : {
      name: '用户',
      avatar: '/public/placeholder-user.jpg'
    };
    
    // 确定根评论ID
    const rootId = parentComment.data.rootId || parentComment.data._id;
    
    // 创建回复评论
    const commentData = {
      nominationId: data.nominationId,
      content: data.content,
      creatorId: userId,
      creatorName: userInfo.name || '用户',
      creatorAvatar: userInfo.avatar || '/public/placeholder-user.jpg',
      parentId: data.parentId,
      rootId: rootId,
      replyTo: {
        userId: parentComment.data.creatorId,
        userName: parentComment.data.creatorName
      },
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      likes: 0,
      status: 0
    };
    
    // 添加评论
    const result = await db.collection('comments').add({
      data: commentData
    });
    
    // 更新提名评论数
    await db.collection('nominations').doc(data.nominationId).update({
      data: {
        commentCount: _.inc(1),
        updateTime: db.serverDate()
      }
    });
    
    // 创建回复通知
    await createReplyNotification(
      data.nominationId,
      userId,
      parentComment.data.creatorId,
      data.parentId
    );
    
    return { success: true, commentId: result._id };
  } catch (error) {
    console.error('回复评论失败:', error);
    return { success: false, message: '回复评论失败', error: error.message };
  }
}

// 获取评论列表
async function listComments(data) {
  // 参数验证
  if (!data.nominationId) {
    return { success: false, message: '参数不完整' };
  }
  
  const { nominationId, page = 1, pageSize = 10 } = data;
  const skip = (page - 1) * pageSize;
  
  try {
    // 获取总数
    const countResult = await db.collection('comments')
      .where({
        nominationId,
        parentId: null,  // 只获取顶级评论
        status: 0  // 正常状态
      })
      .count();
    
    // 获取顶级评论
    const commentsResult = await db.collection('comments')
      .where({
        nominationId,
        parentId: null,
        status: 0
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();
    
    // 获取每个顶级评论的部分回复
    const topComments = commentsResult.data;
    for (const comment of topComments) {
      // 获取每个顶级评论的前3条回复
      const repliesResult = await db.collection('comments')
        .where({
          rootId: comment._id,
          status: 0
        })
        .orderBy('createTime', 'asc')
        .limit(3)
        .get();
      
      comment.replies = repliesResult.data;
      
      // 获取回复总数
      const replyCountResult = await db.collection('comments')
        .where({
          rootId: comment._id,
          status: 0
        })
        .count();
      
      comment.replyCount = replyCountResult.total;
    }
    
    return {
      success: true,
      comments: topComments,
      total: countResult.total,
      page,
      pageSize
    };
  } catch (error) {
    console.error('获取评论列表失败:', error);
    return { success: false, message: '获取评论列表失败', error: error.message };
  }
}

// 获取回复列表
async function listReplies(data) {
  // 参数验证
  if (!data.rootId) {
    return { success: false, message: '参数不完整' };
  }
  
  const { rootId, page = 1, pageSize = 10 } = data;
  const skip = (page - 1) * pageSize;
  
  try {
    // 获取总数
    const countResult = await db.collection('comments')
      .where({
        rootId,
        status: 0
      })
      .count();
    
    // 获取回复
    const repliesResult = await db.collection('comments')
      .where({
        rootId,
        status: 0
      })
      .orderBy('createTime', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get();
    
    return {
      success: true,
      replies: repliesResult.data,
      total: countResult.total,
      page,
      pageSize
    };
  } catch (error) {
    console.error('获取回复列表失败:', error);
    return { success: false, message: '获取回复列表失败', error: error.message };
  }
}

// 删除评论
async function deleteComment(data, userId) {
  // 参数验证
  if (!data.commentId) {
    return { success: false, message: '参数不完整' };
  }
  
  try {
    // 获取评论信息
    const commentResult = await db.collection('comments').doc(data.commentId).get();
    const comment = commentResult.data;
    
    // 检查权限（只有评论创建者可以删除）
    if (comment.creatorId !== userId) {
      return { success: false, message: '没有权限删除此评论' };
    }
    
    // 软删除评论
    await db.collection('comments').doc(data.commentId).update({
      data: {
        status: 1,  // 1-删除
        updateTime: db.serverDate()
      }
    });
    
    // 如果是顶级评论，更新提名评论数
    if (!comment.parentId) {
      await db.collection('nominations').doc(comment.nominationId).update({
        data: {
          commentCount: _.inc(-1),
          updateTime: db.serverDate()
        }
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('删除评论失败:', error);
    return { success: false, message: '删除评论失败', error: error.message };
  }
}

// 点赞评论
async function likeComment(data, userId) {
  // 参数验证
  if (!data.commentId) {
    return { success: false, message: '参数不完整' };
  }
  
  try {
    // 检查是否已点赞
    const likeRecord = await db.collection('comment_likes')
      .where({
        commentId: data.commentId,
        userId
      })
      .get();
    
    if (likeRecord.data.length > 0) {
      return { success: false, message: '已经点过赞了' };
    }
    
    // 添加点赞记录
    await db.collection('comment_likes').add({
      data: {
        commentId: data.commentId,
        userId,
        createTime: db.serverDate()
      }
    });
    
    // 更新评论点赞数
    await db.collection('comments').doc(data.commentId).update({
      data: {
        likes: _.inc(1),
        updateTime: db.serverDate()
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('点赞评论失败:', error);
    return { success: false, message: '点赞评论失败', error: error.message };
  }
}

// 创建评论通知
async function createCommentNotification(nominationId, commenterId) {
  try {
    // 获取提名信息和评论者信息
    const [nominationResult, commenterResult] = await Promise.all([
      db.collection('nominations').doc(nominationId).get(),
      db.collection('users').where({ _openid: commenterId }).get()
    ]);
    
    const nomination = nominationResult.data;
    const commenter = commenterResult.data.length > 0 ? commenterResult.data[0] : {
      name: '用户',
      avatar: '/public/placeholder-user.jpg'
    };
    
    // 如果评论者不是提名者，则发送通知
    if (nomination.creatorId !== commenterId) {
      await cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'create',
          data: {
            receiverId: nomination.creatorId,
            senderId: commenterId,
            senderName: commenter.name || '用户',
            senderAvatar: commenter.avatar || '/public/placeholder-user.jpg',
            type: 'comment',
            content: `${commenter.name || '用户'} 评论了你的提名`,
            nominationId: nominationId,
            nominationTitle: nomination.title || '提名'
          }
        }
      });
    }
  } catch (error) {
    console.error('创建评论通知失败:', error);
    // 通知失败不影响主流程，继续执行
  }
}

// 创建回复通知
async function createReplyNotification(nominationId, replyerId, receiverId, commentId) {
  try {
    // 获取提名信息和回复者信息
    const [nominationResult, replierResult] = await Promise.all([
      db.collection('nominations').doc(nominationId).get(),
      db.collection('users').where({ _openid: replyerId }).get()
    ]);
    
    const nomination = nominationResult.data;
    const replier = replierResult.data.length > 0 ? replierResult.data[0] : {
      name: '用户',
      avatar: '/public/placeholder-user.jpg'
    };
    
    // 如果回复者不是被回复者，则发送通知
    if (receiverId !== replyerId) {
      await cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'create',
          data: {
            receiverId: receiverId,
            senderId: replyerId,
            senderName: replier.name || '用户',
            senderAvatar: replier.avatar || '/public/placeholder-user.jpg',
            type: 'reply',
            content: `${replier.name || '用户'} 回复了你的评论`,
            relatedId: commentId,
            nominationId: nominationId,
            nominationTitle: nomination.title || '提名'
          }
        }
      });
    }
  } catch (error) {
    console.error('创建回复通知失败:', error);
    // 通知失败不影响主流程，继续执行
  }
} 