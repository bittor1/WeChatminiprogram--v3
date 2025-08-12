// 云函数入口文件
const cloud = require('wx-server-sdk')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const path = require('path')
const os = require('os')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * 视频转GIF云函数
 * @param {Object} event 
 * @param {string} event.fileID 视频文件的云存储ID
 * @param {number} event.width GIF宽度，默认200px
 * @param {number} event.height GIF高度，默认200px，保持为0则按比例缩放
 * @param {number} event.duration GIF长度（秒），默认5秒
 * @param {number} event.fps GIF帧率，默认10
 */
exports.main = async (event, context) => {
  try {
    const { fileID, width = 200, height = 0, duration = 5, fps = 10 } = event
    const db = cloud.database()
    const _ = db.command
    
    if (!fileID) {
      return {
        success: false,
        message: '缺少文件ID'
      }
    }

    // 下载云存储中的视频文件
    const tmpVideoPath = path.join(os.tmpdir(), `video_${Date.now()}.mp4`)
    const tmpGifPath = path.join(os.tmpdir(), `output_${Date.now()}.gif`)
    
    console.log('下载视频文件:', fileID)
    const videoRes = await cloud.downloadFile({
      fileID
    })
    const videoBuffer = videoRes.fileContent
    fs.writeFileSync(tmpVideoPath, videoBuffer)
    
    // 使用ffmpeg处理视频
    console.log('开始处理视频转GIF')
    await new Promise((resolve, reject) => {
      let command = ffmpeg(tmpVideoPath)
        .setDuration(duration)
        .fps(fps)
        .size(`${width}x${height}`)
        .on('end', () => {
          console.log('视频转换GIF完成')
          resolve()
        })
        .on('error', (err) => {
          console.error('视频转换GIF失败:', err)
          reject(err)
        })
      
      command.output(tmpGifPath)
        .format('gif')
        .run()
    })
    
    // 上传处理后的GIF文件到云存储
    const gifBuffer = fs.readFileSync(tmpGifPath)
    console.log('上传GIF文件到云存储')
    const uploadRes = await cloud.uploadFile({
      cloudPath: `gifs/${Date.now()}.gif`,
      fileContent: gifBuffer
    })
    
    // 删除临时文件
    try {
      fs.unlinkSync(tmpVideoPath)
      fs.unlinkSync(tmpGifPath)
    } catch (err) {
      console.error('删除临时文件失败:', err)
    }
    
    return {
      success: true,
      fileID: uploadRes.fileID
    }
    
  } catch (error) {
    console.error('视频转GIF失败:', error)
    return {
      success: false,
      message: error.message || '处理失败',
      error
    }
  }
} 