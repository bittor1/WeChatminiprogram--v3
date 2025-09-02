# 视频加载500错误修复指南

## 📋 问题诊断

**错误信息：**
```
[渲染层网络层错误] Failed to load local image resource /pages/index/cloud://cloud1-2g2sby6z920b76cb.636c-cloud1-2g2sby6z920b76cb-1373835033/videos/1756588256944.mp4 
the server responded with a status of 500 (HTTP/1.1 500 Internal Server Error)
```

**问题分析：**

1. **路径错误**：云存储URL被错误地与页面路径组合：`/pages/index/cloud://...`
2. **云函数处理失败**：500错误表明videoToGif云函数在处理视频时遇到问题
3. **FFmpeg依赖问题**：可能缺少FFmpeg层或配置不当

## 🛠️ 解决方案

### 1. 修复云存储URL路径问题

**问题原因：** 在某些情况下，相对路径会被错误地与当前页面路径组合。

**解决方法：** 在使用云存储文件时，确保使用正确的URL格式。

**修复代码 - 在 `utils/cloudUtils.js` 中添加URL修复函数：**

```javascript
/**
 * 修复云存储URL格式
 * @param {string} url 可能有问题的URL
 * @returns {string} 修复后的URL
 */
const fixCloudStorageUrl = (url) => {
  if (!url) return url;
  
  // 如果URL以 /pages/ 开头且包含 cloud://，提取正确的云存储URL
  if (url.includes('/pages/') && url.includes('cloud://')) {
    const cloudUrlMatch = url.match(/cloud:\/\/[^\/\s]+\/[^\s]*/);
    if (cloudUrlMatch) {
      return cloudUrlMatch[0];
    }
  }
  
  // 如果已经是正确的云存储URL，直接返回
  if (url.startsWith('cloud://')) {
    return url;
  }
  
  return url;
};
```

### 2. 增强videoToGif云函数错误处理

**修复代码 - 更新 `cloudfunctions/videoToGif/index.js`：**

```javascript
// 在现有代码基础上添加更好的错误处理
exports.main = async (event, context) => {
  try {
    const { fileID, width = 200, height = 0, duration = 5, fps = 10 } = event
    
    // 验证输入参数
    if (!fileID) {
      return {
        success: false,
        message: '缺少文件ID',
        errorCode: 'MISSING_FILE_ID'
      }
    }

    // 修复可能的URL格式问题
    const fixedFileID = fixCloudStorageUrl(fileID);
    console.log(`处理视频转GIF，原始fileID: ${fileID}, 修复后: ${fixedFileID}`)
    
    // 验证云存储文件ID格式
    if (!fixedFileID.startsWith('cloud://')) {
      return {
        success: false,
        message: '无效的云存储文件ID格式',
        errorCode: 'INVALID_FILE_ID_FORMAT'
      }
    }

    // 检查FFmpeg是否可用
    try {
      const ffmpegPath = '/opt/ffmpeg/bin/ffmpeg';  // 云函数中FFmpeg路径
      if (!fs.existsSync(ffmpegPath)) {
        throw new Error('FFmpeg 未找到');
      }
      ffmpeg.setFfmpegPath(ffmpegPath);
    } catch (err) {
      console.error('FFmpeg 检查失败:', err);
      return {
        success: false,
        message: 'FFmpeg 服务不可用，请联系管理员',
        errorCode: 'FFMPEG_NOT_AVAILABLE'
      }
    }
    
    // 原有的处理逻辑...
    
  } catch (error) {
    console.error('视频转GIF失败:', error)
    
    // 提供更详细的错误信息
    let errorMessage = '处理失败';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.message.includes('download')) {
      errorMessage = '视频文件下载失败';
      errorCode = 'DOWNLOAD_FAILED';
    } else if (error.message.includes('ffmpeg') || error.message.includes('FFmpeg')) {
      errorMessage = '视频处理失败';
      errorCode = 'PROCESSING_FAILED';
    } else if (error.message.includes('upload')) {
      errorMessage = 'GIF文件上传失败';
      errorCode = 'UPLOAD_FAILED';
    }
    
    return {
      success: false,
      message: errorMessage,
      errorCode: errorCode,
      error: error.message
    }
  }
}

// 添加URL修复函数
function fixCloudStorageUrl(url) {
  if (!url) return url;
  
  if (url.includes('/pages/') && url.includes('cloud://')) {
    const cloudUrlMatch = url.match(/cloud:\/\/[^\/\s]+\/[^\s]*/);
    if (cloudUrlMatch) {
      return cloudUrlMatch[0];
    }
  }
  
  if (url.startsWith('cloud://')) {
    return url;
  }
  
  return url;
}
```

### 3. 添加客户端错误处理

**修复代码 - 更新视频处理逻辑：**

在 `pages/create/create.js` 的 `processVideoToGif` 方法中：

```javascript
processVideoToGif(videoPath) {
  this.setData({
    isProcessing: true,
    showProgress: true,
    processingProgress: 0
  });
  
  wx.showLoading({
    title: '处理中...',
    mask: true
  });
  
  // 上传视频到云存储
  const cloudPath = `videos/${Date.now()}.mp4`;
  
  wx.cloud.uploadFile({
    cloudPath: cloudPath,
    filePath: videoPath,
    success: (uploadRes) => {
      console.log('视频上传成功:', uploadRes);
      
      // 确保fileID格式正确
      const fileID = uploadRes.fileID;
      
      // 调用云函数进行转换
      wx.cloud.callFunction({
        name: 'videoToGif',
        data: {
          fileID: fileID,
          width: 200,
          height: 200,
          duration: 5,
          fps: 10
        }
      })
      .then(res => {
        console.log('云函数返回结果:', res);
        
        if (!res.result || !res.result.success) {
          throw new Error(res.result?.message || '视频处理失败');
        }
        
        const gifFileID = res.result.fileID;
        if (!gifFileID) {
          throw new Error('未获取到GIF文件ID');
        }
        
        // 下载GIF到本地临时文件
        return wx.cloud.downloadFile({
          fileID: gifFileID
        });
      })
      .then(res => {
        const gifFilePath = res.tempFilePath;
        
        // 清除进度更新定时器
        clearInterval(this.updateProgressInterval);
        
        // 更新UI
        this.setData({
          avatar: gifFilePath,
          previewImage: gifFilePath,
          previewConfirmed: true,
          isProcessing: false,
          showProgress: false,
          processingProgress: 100
        });
        
        wx.hideLoading();
        wx.showToast({
          title: '处理完成',
          icon: 'success'
        });
        
        this.checkFormValidity();
      })
      .catch(err => {
        console.error('视频转GIF失败:', err);
        this.handleVideoProcessingError(err);
      });
    },
    fail: (err) => {
      console.error('视频上传失败:', err);
      this.handleVideoProcessingError(err);
    }
  });
},

// 添加错误处理方法
handleVideoProcessingError(error) {
  clearInterval(this.updateProgressInterval);
  
  this.setData({
    isProcessing: false,
    showProgress: false
  });
  
  wx.hideLoading();
  
  let errorMessage = '视频处理失败';
  
  if (error.message) {
    if (error.message.includes('download') || error.message.includes('DOWNLOAD_FAILED')) {
      errorMessage = '视频文件下载失败，请重试';
    } else if (error.message.includes('ffmpeg') || error.message.includes('PROCESSING_FAILED')) {
      errorMessage = '视频处理失败，请选择其他视频';
    } else if (error.message.includes('upload') || error.message.includes('UPLOAD_FAILED')) {
      errorMessage = '文件上传失败，请检查网络';
    }
  }
  
  wx.showModal({
    title: '处理失败',
    content: errorMessage,
    showCancel: false,
    confirmText: '知道了'
  });
  
  // 重置状态，允许用户重新选择
  this.setData({
    previewImage: '',
    tempFilePath: '',
    fileType: '',
    previewConfirmed: false
  });
}
```

### 4. 配置FFmpeg层（如果缺失）

**检查是否有FFmpeg层：**

1. 查看 `ffmpeg-layer` 目录是否存在
2. 确认云函数配置中包含FFmpeg层

**如果需要添加FFmpeg层：**

```json
// 在 cloudfunctions/videoToGif/package.json 中确认dependencies
{
  "dependencies": {
    "fluent-ffmpeg": "^2.1.2",
    "wx-server-sdk": "^3.0.1"
  }
}
```

### 5. 添加回退方案

**在视频处理失败时提供静态图片替代：**

```javascript
// 在 utils/cloudUtils.js 中添加
const videoProcessingFallback = async (originalVideoPath) => {
  try {
    // 使用视频第一帧作为静态图片
    return new Promise((resolve, reject) => {
      wx.createVideoContext('fallback-video').getVideoInfo({
        success: (res) => {
          // 处理视频信息，获取第一帧
          resolve(originalVideoPath);  // 临时返回原路径
        },
        fail: (err) => {
          // 使用默认占位图
          resolve('/images/placeholder-user.jpg');
        }
      });
    });
  } catch (err) {
    return '/images/placeholder-user.jpg';
  }
};
```

## 🔧 部署说明

1. **更新云函数**：
   ```bash
   # 上传更新后的videoToGif云函数
   # 在微信开发者工具中右键点击cloudfunctions/videoToGif，选择"上传并部署"
   ```

2. **更新小程序代码**：
   - 更新 `utils/cloudUtils.js`
   - 更新 `pages/create/create.js`
   - 测试视频上传和处理功能

3. **验证修复**：
   - 测试视频上传功能
   - 验证错误提示是否友好
   - 确认URL格式正确

## 🚨 预防措施

1. **监控云函数日志**：定期检查videoToGif云函数的执行日志
2. **添加用户反馈机制**：让用户能够报告处理失败的情况
3. **文件大小限制**：限制上传视频的大小和时长
4. **错误统计**：收集并分析错误模式

## 📞 后续支持

如果问题仍然存在，请检查：
1. 云开发环境是否正常
2. FFmpeg层是否正确配置
3. 云函数执行日志中的具体错误信息
4. 网络连接是否稳定
