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
        if (res.result && res.result.success) {
          resolve(res.result.fileID);
        } else {
          reject(new Error(res.result?.message || '转换失败'));
        }
      },
      fail: err => {
        reject(err);
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

module.exports = {
  uploadFileToCloud,
  convertVideoToGif,
  downloadFileFromCloud,
  saveNominationToDb
}; 