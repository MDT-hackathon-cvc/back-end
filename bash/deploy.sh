source ~/.nvm/nvm.sh
cd project/service-api
git remote set-url origin git@git.ekoios.vn:d2/brillianz/service-api.git
git reset --hard HEAD
git pull
cp .env.exam .env
npm install
npm run build
pm2 restart service-api