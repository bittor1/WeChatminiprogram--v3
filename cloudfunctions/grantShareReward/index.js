// 引入云开发服务端SDK
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 获取今日零点的Date对象
function getStartOfDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// 主函数
exports.main = async (event, context) => {
    console.log('云函数收到请求:', event);
    
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const DAILY_LIMIT = 5; // 每日奖励上限次数
    const shareType = event.shareType || 'vote'; // 默认为投票类型
    const userId = event.userId || '';
    const itemId = event.itemId || '';
    
    console.log('用户信息:', {openid, userId, itemId, shareType});

    try {
        // 1. 查询用户今日已分享获得奖励的次数
        const todayStart = getStartOfDay();
        console.log('查询今日分享记录，开始时间:', todayStart);
        
        const countResult = await db.collection('share_logs')
            .where({
                _openid: openid,
                shareTime: db.command.gte(todayStart),
                shareType: shareType
            })
            .count();
        
        const todayCount = countResult.total;
        console.log('今日已分享次数:', todayCount);

        // 2. 检查是否已达到每日上限
        if (todayCount >= DAILY_LIMIT) {
            console.log('已达到每日上限');
            return {
                success: false,
                code: 'LIMIT_REACHED',
                message: `今日${shareType === 'vote' ? '投票' : '减票'}奖励已达上限(${DAILY_LIMIT}次)`,
                remainingTimes: 0
            };
        }

        // 3. 记录本次分享
        console.log('记录本次分享');
        const addResult = await db.collection('share_logs').add({
            data: {
                _openid: openid,
                shareTime: new Date(),
                shareType: shareType,
                userId: userId,
                itemId: itemId
            }
        });
        
        console.log('分享记录添加结果:', addResult);
        
        // 4. 返回成功信息
        return {
            success: true,
            code: 'SUCCESS',
            message: `分享成功，已获得${shareType === 'vote' ? '投票' : '减票'}奖励！`,
            remainingTimes: DAILY_LIMIT - (todayCount + 1),
            shareType: shareType
        };

    } catch (error) {
        console.error('grantShareReward function error:', error);
        return {
            success: false,
            code: 'DATABASE_ERROR',
            message: '服务器繁忙，请稍后再试',
            error: error.message
        };
    }
}; 