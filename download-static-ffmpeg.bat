@echo off
echo 正在下载真正静态编译的FFmpeg...

REM 下载John Van Sickle的静态编译版本
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz' -OutFile 'ffmpeg-static-real.tar.xz'}"

if exist ffmpeg-static-real.tar.xz (
    echo 下载成功！
    echo 请使用7-Zip或其他工具解压 ffmpeg-static-real.tar.xz
    echo 然后进入解压后的文件夹，找到 ffmpeg 文件
    echo 将其复制到 ffmpeg-layer/bin/ 目录中替换现有文件
) else (
    echo 下载失败
)

pause
