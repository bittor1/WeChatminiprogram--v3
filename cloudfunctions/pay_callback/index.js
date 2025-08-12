// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const ordersCollection = db.collection('orders');

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  
  // 微信支付成功通知
  const { returnCode, resultCode, outTradeNo, transactionId } = event;
  
  try {
    if (returnCode === 'SUCCESS' && resultCode === 'SUCCESS') {
      console.log('支付成功', outTradeNo, transactionId);
      
      // 更新订单状态
      const orderRes = await ordersCollection.where({
        outTradeNo: outTradeNo
      }).get();
      
      if (orderRes.data && orderRes.data.length > 0) {
        const order = orderRes.data[0];
        
        // 更新订单状态
        await ordersCollection.doc(order._id).update({
          data: {
            status: 'success',
            statusText: '支付成功',
            payTime: new Date(),
            transactionId: transactionId
          }
        });
        
        // 根据订单类型执行不同的业务逻辑
        if (order.type === 'vote') {
          // 给用户增加票数
          await handleVoteOrder(order);
        } else if (order.type === 'downvote') {
          // 处理减票
          await handleDownvoteOrder(order);
        } else if (order.type === 'sound') {
          // 处理音效
          await handleSoundOrder(order);
        }
      }
      
      // 返回成功
      return { returnCode: 'SUCCESS', returnMsg: 'OK' };
    } else {
      console.error('支付失败', event);
      return { returnCode: 'FAIL', returnMsg: '支付结果处理失败' };
    }
  } catch (err) {
    console.error('处理支付回调失败', err);
    return { returnCode: 'FAIL', returnMsg: '支付结果处理异常' };
  }
};

// 处理投票订单
async function handleVoteOrder(order) {
  const db = cloud.database();
  
  // 获取要投票的用户
  const userRes = await db.collection('entries').where({
    _id: order.targetId
  }).get();
  
  if (userRes.data && userRes.data.length > 0) {
    const user = userRes.data[0];
    // 增加票数
    await db.collection('entries').doc(user._id).update({
      data: {
        votes: db.command.inc(order.count)
      }
    });
  }
}

// 处理减票订单
async function handleDownvoteOrder(order) {
  const db = cloud.database();
  
  // 获取要减票的用户
  const userRes = await db.collection('entries').where({
    _id: order.targetId
  }).get();
  
  if (userRes.data && userRes.data.length > 0) {
    const user = userRes.data[0];
    // 减少票数
    await db.collection('entries').doc(user._id).update({
      data: {
        votes: db.command.inc(-1) // 减1票
      }
    });
  }
}

// 处理音效订单
async function handleSoundOrder(order) {
  const db = cloud.database();
  
  // 更新用户的音效设置
  await db.collection('user_settings').where({
    userId: order.userId
  }).update({
    data: {
      customSound: true,
      soundUrl: order.soundUrl || '',
      updatedAt: new Date()
    }
  });
} 