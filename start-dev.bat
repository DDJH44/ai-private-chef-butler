@echo off
chcp 65001 >nul
echo ========================================
echo   AI 私人厨师 - 开发模式启动
echo ========================================
echo.

echo [1/2] 启动后端服务器 (端口 8001)...
start "Backend Server" cmd /k "cd /d %~dp0 && uv run python main.py"

echo [2/2] 启动前端开发服务器 (端口 3000)...
start "Frontend Dev Server" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo ========================================
echo   启动完成！
echo   - 后端 API: http://localhost:8001
echo   - 前端界面: http://localhost:3000
echo ========================================
echo.
pause