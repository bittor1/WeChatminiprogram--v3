// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  
  // 从请求中获取订单信息
  const { totalFee, body, outTradeNo } = event;
  
  try {
    // 调用微信支付统一下单接口
    const res = await cloud.cloudPay.unifiedOrder({
      "body": body || "伦敦必吃榜-付费服务",
      "outTradeNo": outTradeNo,
      "spbillCreateIp": "127.0.0.1",
      "subMchId": "1900000000", // 商户号，需替换为您申请的微信支付商户号
      "totalFee": totalFee,
      "envId": cloud.DYNAMIC_CURRENT_ENV,
      "functionName": "pay_callback" // 支付结果通知的云函数
    });
    
    return {
      success: true,
      payment: res.payment, // 客户端用于发起支付的参数
      outTradeNo
    };
  } catch (err) {
    console.error("统一下单失败", err);
    return {
      success: false,
      error: err,
      message: "获取支付参数失败"
    };
  }
}; 