# PowerShell 脚本：自动下载 FFmpeg
# 在您的项目根目录运行：powershell -ExecutionPolicy Bypass -File download-ffmpeg.ps1

Write-Host "===========================================" -ForegroundColor Green
Write-Host "       FFmpeg 自动下载脚本" -ForegroundColor Green  
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

# 设置目标路径
$projectRoot = Get-Location
$targetDir = Join-Path $projectRoot "cloudfunctions\videoToGif\bin"
$ffmpegFile = Join-Path $targetDir "ffmpeg"

Write-Host "1. 检查项目目录..." -ForegroundColor Yellow
Write-Host "   项目根目录: $projectRoot"
Write-Host "   目标目录: $targetDir"

# 创建目录
if (!(Test-Path $targetDir)) {
    Write-Host "   创建目录: $targetDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Write-Host ""
Write-Host "2. 检查 FFmpeg 是否已存在..." -ForegroundColor Yellow
if (Test-Path $ffmpegFile) {
    $size = (Get-Item $ffmpegFile).Length
    Write-Host "   ✅ FFmpeg 已存在，大小: $([Math]::Round($size/1MB, 2)) MB" -ForegroundColor Green
    
    $choice = Read-Host "   是否重新下载? (y/N)"
    if ($choice -ne "y" -and $choice -ne "Y") {
        Write-Host "   跳过下载，使用现有文件" -ForegroundColor Green
        goto :verify
    }
}

Write-Host ""
Write-Host "3. 下载 FFmpeg..." -ForegroundColor Yellow
$ffmpegUrl = "https://github.com/eugeneware/ffmpeg-static/releases/download/b4.4.0/linux-x64"

try {
    Write-Host "   下载地址: $ffmpegUrl"
    Write-Host "   保存到: $ffmpegFile"
    Write-Host "   开始下载..." -ForegroundColor Yellow
    
    # 使用 Invoke-WebRequest 下载
    $ProgressPreference = 'SilentlyContinue'  # 禁用进度条以提高性能
    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $ffmpegFile -TimeoutSec 300
    
    Write-Host "   ✅ 下载完成!" -ForegroundColor Green
} catch {
    Write-Host "   ❌ 下载失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   请手动下载:" -ForegroundColor Yellow
    Write-Host "   1. 访问: https://github.com/eugeneware/ffmpeg-static/releases"
    Write-Host "   2. 下载: linux-x64 文件"
    Write-Host "   3. 重命名为: ffmpeg"
    Write-Host "   4. 保存到: $ffmpegFile"
    exit 1
}

:verify
Write-Host ""
Write-Host "4. 验证文件..." -ForegroundColor Yellow
if (Test-Path $ffmpegFile) {
    $size = (Get-Item $ffmpegFile).Length
    $sizeMB = [Math]::Round($size/1MB, 2)
    
    Write-Host "   ✅ 文件验证通过" -ForegroundColor Green
    Write-Host "   - 路径: $ffmpegFile"
    Write-Host "   - 大小: $sizeMB MB"
    
    if ($sizeMB -lt 10) {
        Write-Host "   ⚠️  警告: 文件大小异常，可能下载不完整" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ 文件大小正常" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ 文件不存在" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "5. 生成部署说明..." -ForegroundColor Yellow
$deploymentNote = @"
# FFmpeg 部署完成

## 文件信息
- 路径: $ffmpegFile
- 大小: $sizeMB MB
- 版本: Linux x64 静态编译版本

## 下一步：在微信开发者工具中部署
1. 打开微信开发者工具
2. 右键点击 "videoToGif" 云函数
3. 选择 "上传并部署"
4. 等待部署完成
5. 测试视频转GIF功能

## 验证部署
上传一个视频文件，应该能正常转换为GIF（<512KB）

生成时间: $(Get-Date)
"@

$deploymentNote | Out-File -FilePath "ffmpeg-deployment.md" -Encoding UTF8

Write-Host "   📋 部署说明已保存到: ffmpeg-deployment.md"

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "✅ FFmpeg 准备完成!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📁 文件位置: $ffmpegFile" -ForegroundColor Cyan
Write-Host "📋 部署说明: ffmpeg-deployment.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 下一步: 在微信开发者工具中上传云函数" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Green
