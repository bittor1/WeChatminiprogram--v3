@echo off
echo 正在下载FFmpeg静态版本...

REM 使用国内镜像下载FFmpeg
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile 'ffmpeg-static.zip'}"

if exist ffmpeg-static.zip (
    echo 下载成功！
    echo 请解压 ffmpeg-static.zip 文件
    echo 然后将 bin/ffmpeg.exe 复制到 ffmpeg-layer/bin/ 目录中
    echo 注意：将 ffmpeg.exe 重命名为 ffmpeg （去掉.exe扩展名）
) else (
    echo 下载失败，请手动下载
)

pause
