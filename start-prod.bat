@echo off
chcp 65001 >nul
echo ========================================
echo   AI 私人厨师 - 生产模式启动
echo ========================================
echo.

echo [1/3] 构建前端...
cd /d %~dp0\frontend
call npm run build:prod
if errorlevel 1 (
    echo 前端构建失败！
    pause
    exit /b 1
)
cd /d %~dp0

echo [2/3] 前端构建完成！
echo [3/3] 启动服务器...
echo.
echo ========================================
echo   服务器启动中...
echo   访问地址: http://localhost:8001
echo ========================================
echo.

uv run python main.py