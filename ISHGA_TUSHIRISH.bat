@echo off
chcp 65001 >nul
title ULGURJI - ishga tushirish
set "ROOT=%~dp0"

echo [1/3] MongoDB ishga tushmoqda...
start "MongoDB" /min "D:\MongoDB\server\bin\mongod.exe" --dbpath "D:\MongoDB\data"
timeout /t 5 /nobreak >nul

if not exist "%ROOT%Back end\backend\.env" (
  echo Birinchi ishga tushirish: sozlamalar va namuna ma'lumotlar...
  copy "%ROOT%Back end\backend\.env.example" "%ROOT%Back end\backend\.env" >nul
  pushd "%ROOT%Back end\backend"
  call npm run seed
  popd
)

echo Zaxira nusxa olinmoqda...
pushd "%ROOT%Back end\backend"
call npm run backup --silent
popd

echo [2/3] Backend ishga tushmoqda...
start "Backend" /d "%ROOT%Back end\backend" cmd /k npm run dev

echo [3/3] Sayt ishga tushmoqda...
start "Sayt" /d "%ROOT%sardoba-stocks.uz" cmd /k npm run dev

timeout /t 6 /nobreak >nul
start "" http://localhost:5173
echo.
echo Tayyor! Sayt brauzerda ochildi. Bu oynani yopishingiz mumkin.
echo Ishni tugatganda "MongoDB", "Backend" va "Sayt" oynalarini yoping.
timeout /t 10 >nul
