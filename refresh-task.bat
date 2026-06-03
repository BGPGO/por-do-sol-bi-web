@echo off
cd /d "C:\Users\bertu\Downloads\bi-blueprint-main\por-do-sol-bi-web"
"C:\Program Files\Git\bin\bash.exe" -c "bash refresh-and-deploy.sh >> refresh.log 2>&1"
