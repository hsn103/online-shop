// بازگرداندن دمو به حالت اولیه: حذف دیتابیس (سبدها، سفارش‌ها، کاربران، تغییرات محصولات). بعد از آن سرویس را ری‌استارت کنید.
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
for (const f of ['data.db', 'data.db-wal', 'data.db-shm']) fs.rmSync(path.join(root, f), { force: true });
const up = path.join(root, 'uploads'); if (fs.existsSync(up)) for (const f of fs.readdirSync(up)) if (f !== '.gitkeep') fs.rmSync(path.join(up, f), { force: true });
console.log('دمو ریست شد. حالا: sudo systemctl restart hxshop');
