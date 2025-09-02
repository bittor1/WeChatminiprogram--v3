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
    const { fileID, width = 200, height = 0, duration = 5, fps = 10, diagnose = false, testFFmpeg = false } = event
    const db = cloud.database()
    const _ = db.command
    
    // 如果是FFmpeg测试模式
    if (testFFmpeg) {
      try {
        const { spawn, exec } = require('child_process');
        const ffmpegPath = '/opt/ffmpeg-layer/bin/ffmpeg';
        
        console.log('测试FFmpeg命令:', ffmpegPath, '-version');
        
        // 应用与主程序相同的环境修复
        process.env.LD_LIBRARY_PATH = '/lib64:/usr/lib64:' + (process.env.LD_LIBRARY_PATH || '');
        
        try {
          const { exec } = require('child_process');
          await new Promise((resolve) => {
            exec('ln -sf /lib64/libm.so.6 /tmp/libmvec.so.1', () => resolve());
          });
          process.env.LD_LIBRARY_PATH = '/tmp:' + process.env.LD_LIBRARY_PATH;
          console.log('测试模式：已创建libmvec符号链接');
        } catch (err) {
          console.log('测试模式：符号链接失败:', err.message);
        }
        
        // 检查文件信息和依赖
        const fileInfo = {
          exists: fs.existsSync(ffmpegPath),
          permissions: null,
          type: null,
          dependencies: null
        };
        
        if (fileInfo.exists) {
          try {
            const stats = fs.statSync(ffmpegPath);
            fileInfo.permissions = stats.mode.toString(8);
            
            // 使用file命令检查文件类型
            const fileTypeResult = await new Promise((resolve) => {
              exec(`file ${ffmpegPath}`, (err, stdout) => {
                resolve(stdout || err?.message || 'unknown');
              });
            });
            fileInfo.type = fileTypeResult;
            
            // 使用ldd命令检查动态库依赖
            const lddResult = await new Promise((resolve) => {
              exec(`ldd ${ffmpegPath}`, (err, stdout) => {
                resolve(stdout || err?.message || 'ldd failed');
              });
            });
            fileInfo.dependencies = lddResult;
            
          } catch (err) {
            fileInfo.error = err.message;
          }
        }
        
        return new Promise((resolve, reject) => {
          const ffmpeg = spawn(ffmpegPath, ['-version']);
          let output = '';
          let errorOutput = '';
          
          ffmpeg.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          ffmpeg.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
          
          ffmpeg.on('close', (code) => {
            resolve({
              success: true,
              exitCode: code,
              stdout: output,
              stderr: errorOutput,
              fileInfo: fileInfo,
              message: code === 0 ? 'FFmpeg测试成功' : 'FFmpeg测试失败'
            });
          });
          
          ffmpeg.on('error', (err) => {
            resolve({
              success: false,
              error: err.message,
              fileInfo: fileInfo,
              message: 'FFmpeg启动失败'
            });
          });
        });
      } catch (err) {
        return {
          success: false,
          error: err.message,
          message: '测试FFmpeg时发生错误'
        };
      }
    }

    // 如果是诊断模式，运行诊断并返回
    if (diagnose) {
      const fs = require('fs');
      const { exec } = require('child_process');
      
      const diagnosticResult = {
        timestamp: new Date().toISOString(),
        paths: {},
        environment: {},
        directoryContents: {}
      };

      // 检查可能的FFmpeg路径
      const possiblePaths = [
        '/usr/bin/ffmpeg',               // 系统路径1（优先检查）
        '/bin/ffmpeg',                   // 系统路径2
        '/opt/ffmpeg-layer/bin/ffmpeg',  // 层路径
        '/opt/ffmpeg/bin/ffmpeg',        // 标准层路径1
        '/opt/bin/ffmpeg',               // 标准层路径2
        '/opt/ffmpeg-layer/ffmpeg',      // 备选路径
        '/opt/ffmpeg/ffmpeg',            // 备选路径1
        '/opt/layer/ffmpeg'              // 备选路径2
      ];

      console.log('=== FFmpeg层诊断开始 ===');

      // 检查路径
      for (const testPath of possiblePaths) {
        try {
          const exists = fs.existsSync(testPath);
          let stats = null;
          if (exists) {
            stats = fs.statSync(testPath);
          }
          
          diagnosticResult.paths[testPath] = {
            exists,
            isFile: stats ? stats.isFile() : false,
            size: stats ? stats.size : 0,
            mode: stats ? stats.mode.toString(8) : null
          };
          
          console.log(`路径 ${testPath}: 存在=${exists}`);
        } catch (err) {
          diagnosticResult.paths[testPath] = { error: err.message };
          console.log(`路径 ${testPath}: 错误 - ${err.message}`);
        }
      }

      // 检查环境变量
      diagnosticResult.environment = {
        PATH: process.env.PATH,
        LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
        HOME: process.env.HOME
      };

      // 检查 /opt 目录结构
      try {
        if (fs.existsSync('/opt')) {
          const optContents = fs.readdirSync('/opt');
          diagnosticResult.directoryContents['/opt'] = optContents;
          console.log('/opt 目录内容:', optContents);
          
          // 如果存在ffmpeg-layer，检查其内容
          if (optContents.includes('ffmpeg-layer')) {
            try {
              const ffmpegLayerContents = fs.readdirSync('/opt/ffmpeg-layer');
              diagnosticResult.directoryContents['/opt/ffmpeg-layer'] = ffmpegLayerContents;
              console.log('/opt/ffmpeg-layer 目录内容:', ffmpegLayerContents);
              
              // 如果存在bin目录，检查其内容
              if (ffmpegLayerContents.includes('bin')) {
                try {
                  const binContents = fs.readdirSync('/opt/ffmpeg-layer/bin');
                  diagnosticResult.directoryContents['/opt/ffmpeg-layer/bin'] = binContents;
                  console.log('/opt/ffmpeg-layer/bin 目录内容:', binContents);
                } catch (err) {
                  diagnosticResult.directoryContents['/opt/ffmpeg-layer/bin'] = { error: err.message };
                }
              }
            } catch (err) {
              diagnosticResult.directoryContents['/opt/ffmpeg-layer'] = { error: err.message };
            }
          }
        } else {
          diagnosticResult.directoryContents['/opt'] = 'Directory does not exist';
        }
      } catch (err) {
        diagnosticResult.directoryContents['/opt'] = { error: err.message };
      }

      console.log('=== 诊断完成 ===');
      return {
        success: true,
        diagnostic: diagnosticResult
      };
    }
    
    console.log('接收到的参数:', { fileID, width, height, duration, fps });
    console.log('fileID类型:', typeof fileID);
    
    if (!fileID) {
      return {
        success: false,
        message: '缺少文件ID',
        errorCode: 'MISSING_FILE_ID'
      }
    }

    // 修复可能的URL格式问题
    const fixedFileID = fixCloudStorageUrl(fileID);
    console.log(`开始处理视频转GIF，原始fileID: ${fileID}, 修复后: ${fixedFileID}, width=${width}, height=${height}, duration=${duration}, fps=${fps}`)
    
    // 验证云存储文件ID格式
    if (!fixedFileID.startsWith('cloud://')) {
      return {
        success: false,
        message: '无效的云存储文件ID格式',
        errorCode: 'INVALID_FILE_ID_FORMAT'
      }
    }
    
    // 下载云存储中的视频文件
    const tmpVideoPath = path.join(os.tmpdir(), `video_${Date.now()}.mp4`)
    const tmpGifPath = path.join(os.tmpdir(), `output_${Date.now()}.gif`)
    
    console.log('下载视频文件:', fixedFileID)
    let videoRes
    try {
      videoRes = await cloud.downloadFile({
        fileID: fixedFileID
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
    
    // 查找FFmpeg路径
    const possiblePaths = [
      '/usr/bin/ffmpeg',               // 系统路径1（优先尝试）
      '/bin/ffmpeg',                   // 系统路径2
      '/opt/ffmpeg-layer/bin/ffmpeg',  // 层路径
      '/opt/ffmpeg/bin/ffmpeg',        // 标准层路径1
      '/opt/bin/ffmpeg',               // 标准层路径2
      '/opt/ffmpeg-layer/ffmpeg'       // 备选路径
    ];
    
    let ffmpegPath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        ffmpegPath = testPath;
        break;
      }
    }
    
    if (!ffmpegPath) {
      console.error('FFmpeg未找到，检查的路径:', possiblePaths);
      return {
        success: false,
        message: 'FFmpeg不可用，请检查层配置。确保FFmpeg层已正确绑定到云函数。',
        errorCode: 'FFMPEG_NOT_FOUND',
        checkedPaths: possiblePaths
      }
    }
    
    console.log('找到FFmpeg路径:', ffmpegPath);
    
    // 设置环境变量，尝试绕过libmvec依赖
    process.env.LD_LIBRARY_PATH = '/lib64:/usr/lib64:' + (process.env.LD_LIBRARY_PATH || '');
    
    // 尝试创建libmvec的符号链接到libm（数学库的替代）
    try {
      const { exec } = require('child_process');
      await new Promise((resolve) => {
        exec('ln -sf /lib64/libm.so.6 /tmp/libmvec.so.1', () => resolve());
      });
      process.env.LD_LIBRARY_PATH = '/tmp:' + process.env.LD_LIBRARY_PATH;
      console.log('已尝试创建libmvec符号链接');
    } catch (err) {
      console.log('创建符号链接失败，继续尝试:', err.message);
    }
    
    ffmpeg.setFfmpegPath(ffmpegPath);
    
    try {
      await new Promise((resolve, reject) => {
        let command = ffmpeg(tmpVideoPath)
          .inputOptions([
            '-ss 0',                           // 从第0秒开始
            '-t 4'                             // 4秒时长
          ])
          .outputOptions([
            '-vf', 'fps=30,scale=100:-1',      // 30fps，100px宽度 = 120帧总数
            '-pix_fmt', 'rgb24',               // GIF兼容的像素格式
            '-q:v 15',                         // 高质量（数字越小质量越高）
            '-loop 0'                          // 无限循环
          ])
          .format('gif')

        
        command
          .on('start', cmdline => {
            console.log('FFmpeg开始处理（极速模式），命令:', cmdline);
            console.log('参数：4秒时长，30fps，100px宽度，120帧总数，高质量');
          })
          .on('progress', progress => {
            const percent = Math.floor(progress.percent || 0);
            console.log(`FFmpeg处理进度: ${percent}%, 用时: ${progress.timemark}, 帧数: ${progress.frames}`);
          })
          .on('end', () => {
            console.log('FFmpeg视频转换GIF完成');
            resolve();
          })
          .on('error', (err) => {
            console.error('视频转换GIF失败:', {
              message: err.message,
              stack: err.stack,
              code: err.code,
              ffmpegPath: ffmpegPath,
              tmpVideoPath: tmpVideoPath,
              tmpGifPath: tmpGifPath,
              parameters: { width, height, duration, fps }
            })
            
            // 检查常见的FFmpeg错误
            let specificError = 'FFmpeg处理失败';
            let errorCode = 'FFMPEG_PROCESSING_ERROR';
            
            if (err.message.includes('ENOENT')) {
              specificError = 'FFmpeg可执行文件未找到或无权限';
              errorCode = 'FFMPEG_NOT_FOUND';
            } else if (err.message.includes('Invalid data found')) {
              specificError = '视频文件格式无效或损坏';
              errorCode = 'INVALID_VIDEO_FORMAT';
            } else if (err.message.includes('No such file')) {
              specificError = '输入文件不存在';
              errorCode = 'INPUT_FILE_NOT_FOUND';
            } else if (err.message.includes('Permission denied')) {
              specificError = 'FFmpeg权限不足';
              errorCode = 'PERMISSION_DENIED';
            } else if (err.message.includes('Output file is empty')) {
              specificError = '输出文件为空，可能是视频太短或参数不当';
              errorCode = 'EMPTY_OUTPUT';
            } else if (err.message.includes('codec') || err.message.includes('encoder')) {
              specificError = '视频编解码器问题';
              errorCode = 'CODEC_ERROR';
            }
            
            const enhancedError = new Error(specificError);
            enhancedError.originalError = err.message;
            enhancedError.errorCode = errorCode;
            enhancedError.ffmpegDetails = {
              ffmpegPath,
              videoExists: fs.existsSync(tmpVideoPath),
              videoSize: fs.existsSync(tmpVideoPath) ? fs.statSync(tmpVideoPath).size : 0,
              outputExists: fs.existsSync(tmpGifPath),
              outputSize: fs.existsSync(tmpGifPath) ? fs.statSync(tmpGifPath).size : 0
            };
            
            reject(enhancedError)
          })
          .output(tmpGifPath)
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
      console.log('GIF文件大小:', gifBuffer.length, 'bytes')
      console.log('GIF参数: 4秒时长, 30fps, 100px宽度, 120帧总数, 高质量')
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
    
    // 提供更详细的错误信息
    let errorMessage = '处理失败';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.message.includes('download') || error.message.includes('下载')) {
      errorMessage = '视频文件下载失败';
      errorCode = 'DOWNLOAD_FAILED';
    } else if (error.message.includes('ffmpeg') || error.message.includes('FFmpeg')) {
      errorMessage = '视频处理失败';
      errorCode = 'PROCESSING_FAILED';
    } else if (error.message.includes('upload') || error.message.includes('上传')) {
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

/**
 * 修复云存储URL格式
 * @param {string} url 可能有问题的URL
 * @returns {string} 修复后的URL
 */
function fixCloudStorageUrl(url) {
  // 确保url是字符串类型
  if (!url || typeof url !== 'string') {
    console.warn('fixCloudStorageUrl: 参数不是字符串:', typeof url, url);
    return url;
  }
  
  // 如果URL以 /pages/ 开头且包含 cloud://，提取正确的云存储URL
  if (url.includes('/pages/') && url.includes('cloud://')) {
    const cloudUrlMatch = url.match(/cloud:\/\/[^\/\s]+\/[^\s]*/);
    if (cloudUrlMatch) {
      console.log('修复云存储URL:', url, '->', cloudUrlMatch[0]);
      return cloudUrlMatch[0];
    }
  }
  
  // 如果已经是正确的云存储URL，直接返回
  if (url.startsWith('cloud://')) {
    return url;
  }
  
  return url;
} 