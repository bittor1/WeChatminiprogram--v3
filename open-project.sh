#!/bin/bash
# 快速打开项目脚本

echo "🚀 正在启动伦敦必吃榜小程序..."

# 检查微信开发者工具是否安装
if [ -d "/Applications/wechatwebdevtools.app" ]; then
    echo "✅ 检测到微信开发者工具"
    
    # 使用命令行打开项目
    /Applications/wechatwebdevtools.app/Contents/MacOS/cli open --project /Users/jimmu/vdogo.com/伦敦必吃榜
    
    echo "✅ 项目已在微信开发者工具中打开"
else
    echo "❌ 未检测到微信开发者工具"
    echo "请先下载安装：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html"
    
    # 尝试打开下载页面
    open "https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html"
fi

echo ""
echo "📋 项目信息："
echo "- 项目路径: /Users/jimmu/vdogo.com/伦敦必吃榜"
echo "- AppID: wx29cb754190a5c042"
echo "- 云开发环境: cloud1-2g2sby6z920b76cb"