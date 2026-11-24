# NIKA: فروشگاه پوشاک (دمو) | فارسی + English

پروژه‌ی مستقل از سایت اصلی. Node.js + Express + SQLite. زبان اصلی فارسی (راست‌به‌چپ) و انگلیسی. مسیرها: `/fa` و `/en`.

## نصب روی ساب‌دامین (مثلاً shop.hxdev.ir)
۱) در DNS یک رکورد A برای `shop` به IP سرور بسازید.
۲) روی سرور:
```bash
sudo mkdir -p /var/www/hxshop          # فایل‌های این پروژه را داخل آن بگذارید
cd /var/www/hxshop
cp .env.example .env && nano .env      # ADMIN_PASSWORD و SESSION_SECRET را عوض کنید، SITE_URL را درست کنید
sudo npm install --omit=dev            # نیاز به Node.js 20.9 یا بالاتر
sudo chown -R www-data:www-data /var/www/hxshop
sudo cp hxshop.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now hxshop
sudo cp nginx-hxshop.conf /etc/nginx/sites-available/hxshop      # server_name را به ساب‌دامین خودتان تغییر دهید
sudo ln -sf /etc/nginx/sites-available/hxshop /etc/nginx/sites-enabled/hxshop
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d shop.hxdev.ir
```
این پروژه روی پورت **۳۰۰۱** اجرا می‌شود تا با سایت اصلی (پورت ۳۰۰۰) تداخل نکند.

## پنل مدیریت: `/admin`
- **محصولات:** افزودن، ویرایش، حذف؛ عنوان و توضیح فارسی/انگلیسی؛ قیمت و قیمت قبل از تخفیف؛ سایزها با موجودی هر سایز (قالب‌های آماده برای لباس، شلوار، کفش، بچگانه، تک‌سایز)؛ آپلود چند عکس (خودکار کوچک و WebP می‌شود، شفافیت PNG حفظ می‌شود).
- **سبدهای خرید:** سبد همه‌ی کاربران (مهمان و واردشده) با اقلام و جمع؛ امکان خالی‌کردن سبد.
- **سفارش‌ها:** تغییر وضعیت؛ لغو سفارش موجودی را برمی‌گرداند.
- **کاربران** و **داشبورد** آمار.

## حالت دمو
- `DEMO_MODE=1`: نوار «فروشگاه نمونه» بالای سایت. هیچ پرداخت واقعی وجود ندارد (پرداخت در محل / کارت‌به‌کارت نمایشی).
- `ALLOW_INDEX=0`: موتورهای جستجو ایندکس نکنند (مناسب دمو). برای ایندکس مجاز، `1` کنید.
- ریست کامل دمو (حذف سبدها، سفارش‌ها، کاربران و تغییرات محصولات و بازگشت به ۱۴ محصول اولیه):
```bash
cd /var/www/hxshop && sudo systemctl stop hxshop && sudo node scripts/reset-demo.js && sudo chown -R www-data:www-data . && sudo systemctl start hxshop
```

## شخصی‌سازی
- نام برند: کلید `brand` در `i18n.js` (هر دو زبان). متن‌های رابط هم همان‌جاست.
- دسته‌بندی‌ها: `CATS` در `i18n.js` (فعلاً ثابت‌اند، از پنل قابل افزودن نیستند).
- تصاویر نمونه: پوشه `public/demo` (PNG اورجینال که با `npm run images` ساخته می‌شوند). با عکس واقعی از پنل جایگزینشان کنید.
- فونت‌ها از همین سرور سرو می‌شوند (Fraunces، Manrope، Vazirmatn؛ مجوز OFL).
