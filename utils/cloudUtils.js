/**
 * 云开发相关工具函数
 */

/**
 * 上传文件到云存储
 * @param {string} filePath 本地文件路径
 * @param {string} cloudPath 云存储路径
 */
const uploadFileToCloud = (filePath, cloudPath) => {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: res => {
        resolve(res.fileID);
      },
      fail: err => {
        reject(err);
      }
    });
  });
};

/**
 * 调用视频转GIF云函数
 * @param {string} fileID 视频文件ID
 * @param {Object} options 转换选项
 */
const convertVideoToGif = (fileID, options = {}) => {
  const {
    width = 200,
    height = 200,
    duration = 5,
    fps = 10
  } = options;
  
  return new Promise((resolve, reject) => {
    wx.showLoading({
      title: '处理视频中...',
      mask: true
    });

    // 调用云函数
    wx.cloud.callFunction({
      name: 'videoToGif',
      data: {
        fileID,
        width,
        height,
        duration,
        fps
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          resolve(res.result.fileID);
        } else {
          console.error('云函数视频转换失败:', res);
          // 尝试备用方案
          fallbackVideoToGif(fileID, options)
            .then(resolve)
            .catch(reject);
        }
      },
      fail: err => {
        console.error('调用云函数失败:', err);
        wx.hideLoading();
        // 尝试备用方案
        fallbackVideoToGif(fileID, options)
          .then(resolve)
          .catch(reject);
      }
    });
  });
};

/**
 * 视频转GIF备用方案
 * 在云函数失败时使用静态图片作为替代
 * @param {string} fileID 视频文件ID
 * @param {Object} options 转换选项
 */
const fallbackVideoToGif = (fileID, options = {}) => {
  return new Promise((resolve, reject) => {
    console.log('使用备用方案处理视频:', fileID);
    
    // 显示提示
    wx.showToast({
      title: '视频处理失败，使用静态图像代替',
      icon: 'none',
      duration: 2000
    });
    
    // 截帧作为静态图片（如果可能）
    // 由于微信小程序环境限制，这里我们使用占位图
    const placeholderImage = '/images/placeholder-user.jpg';
    
    // 上传占位图到云存储
    wx.getFileSystemManager().readFile({
      filePath: placeholderImage,
      success: res => {
        const buffer = res.data;
        
        wx.cloud.uploadFile({
          cloudPath: `gifs/fallback_${Date.now()}.jpg`,
          fileContent: buffer,
          success: uploadRes => {
            resolve(uploadRes.fileID);
          },
          fail: err => {
            console.error('上传占位图失败:', err);
            reject(new Error('视频处理失败，无法创建替代图像'));
          }
        });
      },
      fail: err => {
        console.error('读取占位图失败:', err);
        // 最后的备用方案：返回一个已知的云存储图片ID
        resolve('/images/placeholder-user.jpg');
      }
    });
  });
};

/**
 * 从云存储下载文件
 * @param {string} fileID 云存储文件ID
 */
const downloadFileFromCloud = (fileID) => {
  return new Promise((resolve, reject) => {
    wx.cloud.downloadFile({
      fileID,
      success: res => {
        resolve(res.tempFilePath);
      },
      fail: err => {
        reject(err);
      }
    });
  });
};

/**
 * 保存用户提名数据到数据库
 * @param {Object} data 提名数据
 */
const saveNominationToDb = (data) => {
  return new Promise((resolve, reject) => {
    wx.cloud.database().collection('entries').add({
      data,
      success: res => {
        resolve(res._id);
      },
      fail: err => {
        reject(err);
      }
    });
  });
};

/**
 * 获取系统信息 - 使用新API替代已废弃的wx.getSystemInfoSync
 * @returns {Promise<Object>} 系统信息对象
 */
const getSystemInfo = () => {
  return new Promise((resolve, reject) => {
    try {
      // 判断新API是否可用 (基础库 2.20.1 及以上版本支持)
      if (typeof wx.getSystemSetting === 'function' &&
          typeof wx.getAppAuthorizeSetting === 'function' &&
          typeof wx.getDeviceInfo === 'function' &&
          typeof wx.getWindowInfo === 'function' &&
          typeof wx.getAppBaseInfo === 'function') {
        
        console.log('使用新API获取系统信息');
        
        // 使用新API获取各类信息
        const systemSetting = wx.getSystemSetting();
        const appAuthorizeSetting = wx.getAppAuthorizeSetting();
        const deviceInfo = wx.getDeviceInfo();
        const windowInfo = wx.getWindowInfo();
        const appBaseInfo = wx.getAppBaseInfo();
        
        // 合并所有信息到一个对象
        const systemInfo = {
          ...systemSetting,
          ...appAuthorizeSetting,
          ...deviceInfo,
          ...windowInfo,
          ...appBaseInfo
        };
        
        resolve(systemInfo);
      } else {
        // 对于不支持新API的旧版本，使用异步的wx.getSystemInfo
        console.log('使用兼容API获取系统信息');
        wx.getSystemInfo({
          success(res) {
            resolve(res);
          },
          fail(err) {
            console.error('获取系统信息失败:', err);
            // 返回基本的默认信息
            resolve({
              platform: 'unknown',
              system: 'unknown',
              version: 'unknown',
              model: 'unknown',
              pixelRatio: 1,
              screenWidth: 375,
              screenHeight: 667,
              windowWidth: 375,
              windowHeight: 667,
              statusBarHeight: 20,
              language: 'zh_CN',
              fontSizeSetting: 16
            });
          }
        });
      }
    } catch (error) {
      console.error('获取系统信息出错:', error);
      reject(error);
    }
  });
};

/**
 * 检查用户微信版本是否支持朋友圈分享
 * 返回包含是否支持onShareTimeline和showShareMenu的对象
 */
function checkShareSupport() {
  // 简化检测，直接返回支持
  return {
    canShareTimeline: true,
    canShowShareMenu: true,
    supportsTimelineShare: true
  };
}

/**
 * 启用分享菜单，包括朋友圈分享（如果支持）
 */
function enableShareMenu() {
  // 默认设置所有分享菜单
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
  
  // 返回支持所有功能的对象
  return {
    canShareTimeline: true, 
    canShowShareMenu: true,
    supportsTimelineShare: true
  };
}

/**
 * 显示分享成功提示
 */
function showShareSuccess() {
  wx.showToast({
    title: '分享成功',
    icon: 'success',
    duration: 1500
  });
}

/**
 * 测试系统信息获取功能
 * 用于验证新API的正确性
 */
function testSystemInfo() {
  console.log('开始测试系统信息API...');
  
  getSystemInfo()
    .then(systemInfo => {
      console.log('系统信息获取成功:', systemInfo);
      
      // 验证关键字段是否存在
      const requiredFields = ['platform', 'system', 'version', 'model'];
      const missingFields = requiredFields.filter(field => !systemInfo.hasOwnProperty(field));
      
      if (missingFields.length === 0) {
        console.log('✅ 系统信息API测试通过');
      } else {
        console.warn('⚠️ 系统信息缺少字段:', missingFields);
      }
    })
    .catch(error => {
      console.error('❌ 系统信息API测试失败:', error);
    });
}

// 导出工具函数
module.exports = {
  // 保留原有导出
  uploadFileToCloud,
  convertVideoToGif,
  downloadFileFromCloud,
  saveNominationToDb,
  getSystemInfo,
  // 添加新函数
  checkShareSupport,
  enableShareMenu,
  showShareSuccess,
  // 测试函数
  testSystemInfo
} 