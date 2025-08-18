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

    console.log(`开始处理视频转GIF，参数: fileID=${fileID}, width=${width}, height=${height}, duration=${duration}, fps=${fps}`)
    
    // 下载云存储中的视频文件
    const tmpVideoPath = path.join(os.tmpdir(), `video_${Date.now()}.mp4`)
    const tmpGifPath = path.join(os.tmpdir(), `output_${Date.now()}.gif`)
    
    console.log('下载视频文件:', fileID)
    let videoRes
    try {
      videoRes = await cloud.downloadFile({
        fileID
      })
      console.log('视频下载成功，大小:', videoRes.fileContent.length)
    } catch (err) {
      console.error('视频下载失败:', err)
      return {
        success: false,
        message: '视频下载失败',
        error: err.message
      }
    }
    
    const videoBuffer = videoRes.fileContent
    try {
      fs.writeFileSync(tmpVideoPath, videoBuffer)
      console.log('视频临时文件创建成功:', tmpVideoPath)
    } catch (err) {
      console.error('创建临时视频文件失败:', err)
      return {
        success: false,
        message: '创建临时视频文件失败',
        error: err.message
      }
    }
    
    // 使用ffmpeg处理视频
    console.log('开始处理视频转GIF')
    try {
      await new Promise((resolve, reject) => {
        let command = ffmpeg(tmpVideoPath)
          .setDuration(duration)
          .fps(fps)
          .size(`${width}x${height}`)
          .on('start', cmdline => {
            console.log('FFmpeg命令:', cmdline)
          })
          .on('progress', progress => {
            console.log(`处理进度: ${Math.floor(progress.percent || 0)}%`)
          })
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
    } catch (err) {
      console.error('FFmpeg处理失败:', err)
      // 清理临时文件
      try { fs.unlinkSync(tmpVideoPath) } catch (e) {}
      
      return {
        success: false,
        message: 'FFmpeg处理失败',
        error: err.message
      }
    }
    
    // 上传处理后的GIF文件到云存储
    let uploadRes
    try {
      const gifBuffer = fs.readFileSync(tmpGifPath)
      console.log('GIF文件创建成功，大小:', gifBuffer.length)
      
      console.log('上传GIF文件到云存储')
      uploadRes = await cloud.uploadFile({
        cloudPath: `gifs/${Date.now()}.gif`,
        fileContent: gifBuffer
      })
      console.log('GIF文件上传成功:', uploadRes.fileID)
    } catch (err) {
      console.error('上传GIF文件失败:', err)
      // 清理临时文件
      try { fs.unlinkSync(tmpVideoPath) } catch (e) {}
      try { fs.unlinkSync(tmpGifPath) } catch (e) {}
      
      return {
        success: false,
        message: '上传GIF文件失败',
        error: err.message
      }
    }
    
    // 删除临时文件
    try {
      fs.unlinkSync(tmpVideoPath)
      fs.unlinkSync(tmpGifPath)
      console.log('临时文件清理完成')
    } catch (err) {
      console.error('删除临时文件失败:', err)
      // 不影响结果返回
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
      error: error.message
    }
  }
} 