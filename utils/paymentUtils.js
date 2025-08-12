/**
 * 支付相关工具函数
 */

/**
 * 发起微信支付
 * @param {Object} orderData 订单数据
 * @param {Number} orderData.totalFee 支付金额（单位：分）
 * @param {String} orderData.body 商品描述
 * @param {String} orderData.outTradeNo 商户订单号
 * @returns {Promise} 支付结果
 */
const requestPayment = (orderData) => {
  return new Promise((resolve, reject) => {
    // 1. 调用云函数获取支付参数
    wx.cloud.callFunction({
      name: 'getWxPayment',
      data: {
        totalFee: orderData.totalFee, // 单位：分
        body: orderData.body,
        outTradeNo: orderData.outTradeNo
      },
      success: res => {
        const paymentData = res.result.payment;
        // 2. 调用微信支付接口
        wx.requestPayment({
          ...paymentData,
          success: (res) => {
            console.log('支付成功', res);
            resolve({
              success: true,
              message: '支付成功',
              orderInfo: orderData
            });
          },
          fail: (err) => {
            console.error('支付失败', err);
            reject({
              success: false,
              message: '支付失败',
              error: err
            });
          }
        });
      },
      fail: err => {
        console.error('获取支付参数失败', err);
        reject({
          success: false,
          message: '获取支付参数失败',
          error: err
        });
      }
    });
  });
};

/**
 * 生成订单信息
 * @param {String} type 订单类型：vote(投票), downvote(减票), sound(音效)
 * @param {Number} count 数量
 * @param {String} userId 用户ID
 * @returns {Object} 订单信息
 */
const generateOrder = (type, count = 1, userId = '') => {
  // 生成订单号
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const outTradeNo = `${year}${month}${day}${hour}${minute}${second}${random}`;
  
  // 价格映射（单位：元）
  const priceMap = {
    vote: 1 * count, // 1元1票
    downvote: 2,     // 2元减1票
    sound: 6,        // 6元自定义音效
  };
  
  const titleMap = {
    vote: `投票充值${count}票`,
    downvote: '减票付费',
    sound: '自定义音效',
  };
  
  // 计算总价（单位：分）
  const totalFee = Math.round(priceMap[type] * 100);
  
  return {
    outTradeNo,
    totalFee,
    body: titleMap[type],
    type,
    count,
    userId,
    createTime: now.getTime()
  };
};

/**
 * 保存订单记录
 * @param {Object} orderData 订单数据
 * @returns {Promise} 保存结果
 */
const saveOrderToDb = (orderData) => {
  return new Promise((resolve, reject) => {
    wx.cloud.database().collection('orders').add({
      data: {
        ...orderData,
        status: 'success',
        statusText: '支付成功',
        date: new Date().toISOString(),
        amount: orderData.totalFee / 100, // 转换为元
      },
      success: res => {
        resolve(res._id);
      },
      fail: err => {
        reject(err);
      }
    });
  });
};

module.exports = {
  requestPayment,
  generateOrder,
  saveOrderToDb
}; 