// متن‌های رابط (فارسی = زبان اصلی، انگلیسی) و دسته‌بندی‌ها
const LANGS = ['fa', 'en'];
const META = { fa: { name: 'فارسی', dir: 'rtl', locale: 'fa-IR', og: 'fa_IR' }, en: { name: 'English', dir: 'ltr', locale: 'en-US', og: 'en_US' } };
const CATS = {
  women: { fa: 'زنانه', en: 'Women' }, men: { fa: 'مردانه', en: 'Men' }, kids: { fa: 'بچگانه', en: 'Kids' },
  shoes: { fa: 'کفش', en: 'Shoes' }, accessories: { fa: 'اکسسوری', en: 'Accessories' }
};
const UI = {
fa: {
  brand: 'نیکا', home: 'خانه', shop: 'فروشگاه', cart: 'سبد خرید', account: 'حساب کاربری', search_ph: 'جستجوی محصولات…', menu: 'منو', skip: 'پرش به محتوا', lang: 'English',
  demo_note: 'این یک فروشگاه نمونه (دمو) است؛ سفارش‌ها واقعی نیستند.', ship_note: 'ارسال رایگان برای خرید بالای {n}',
  hero_kicker: 'کالکشن زمستان ۱۴۰۵', hero_title: 'پوشاک نیکا', hero_sub: 'پوشاک مینیمال و باکیفیت برای هر روز؛ از تی‌شرت و جین تا پالتو و کفش. با سایزبندی کامل و ارسال سریع.', hero_cta: 'مشاهده محصولات', hero_cta2: 'تازه‌ها',
  cats_h: 'خرید بر اساس دسته', new_h: 'تازه‌ترین‌ها', new_sub: 'جدیدترین محصولات اضافه‌شده به فروشگاه', view_all: 'مشاهده همه',
  promo_k: 'تخفیف ویژه', promo_h: 'تا ۲۰٪ تخفیف روی پالتو، جین و کفش', promo_sub: 'تعداد محدود؛ تا پایان موجودی.', promo_cta: 'مشاهده تخفیف‌ها',
  f1_t: 'ارسال سریع', f1_d: 'ارسال به سراسر کشور', f2_t: 'ضمانت بازگشت', f2_d: '۷ روز مهلت تعویض و بازگشت', f3_t: 'پرداخت امن', f3_d: 'پرداخت در محل یا کارت‌به‌کارت', f4_t: 'پشتیبانی', f4_d: 'پاسخگویی در همه‌ی روزهای هفته',
  shop_h: 'همه‌ی محصولات', all: 'همه', sort: 'مرتب‌سازی', sort_new: 'جدیدترین', sort_price_asc: 'ارزان‌ترین', sort_price_desc: 'گران‌ترین', size: 'سایز', filter_size: 'فیلتر سایز', results: '{n} محصول', no_results: 'محصولی پیدا نشد.', sale: 'تخفیف', search: 'جستجو', clear: 'پاک‌کردن فیلترها',
  new_badge: 'جدید', off: '{n}٪ تخفیف', choose_size: 'سایز را انتخاب کنید', sizes_h: 'سایزها', qty: 'تعداد', add_to_cart: 'افزودن به سبد خرید', added: 'به سبد خرید اضافه شد', out_of_stock: 'ناموجود', low_stock: 'فقط {n} عدد باقی مانده', in_stock: 'موجود',
  details_h: 'جزئیات و نگهداری', related: 'محصولات مشابه', one_size: 'تک‌سایز', size_err: 'لطفاً سایز را انتخاب کنید.', yrs: 'سال',
  cart_h: 'سبد خرید', empty_cart: 'سبد خرید شما خالی است.', continue: 'ادامه‌ی خرید', subtotal: 'جمع کالاها', shipping: 'هزینه ارسال', free: 'رایگان', total: 'مبلغ قابل پرداخت', checkout: 'ادامه و ثبت سفارش', remove: 'حذف', free_ship_left: 'با {n} خرید بیشتر، ارسال رایگان می‌شود.', free_ship_ok: 'ارسال این سفارش رایگان است 🎉', toman: 'تومان', stock_err: 'موجودی کافی نیست.',
  checkout_h: 'ثبت سفارش', full_name: 'نام و نام خانوادگی', phone: 'شماره موبایل', email: 'ایمیل (اختیاری)', city: 'شهر', address: 'آدرس کامل', notes: 'توضیحات (اختیاری)', payment: 'روش پرداخت', pay_cod: 'پرداخت در محل', pay_card: 'کارت‌به‌کارت (نمونه)', place_order: 'ثبت نهایی سفارش', summary: 'خلاصه‌ی سفارش', demo_pay: 'در این نسخه‌ی نمونه هیچ پرداخت واقعی انجام نمی‌شود.',
  e_required: 'لطفاً همه‌ی فیلدهای ضروری را کامل کنید.', e_phone: 'شماره موبایل معتبر نیست.', e_generic: 'خطایی رخ داد. دوباره تلاش کنید.', e_empty: 'سبد خرید خالی است.',
  thanks_h: 'سفارش شما ثبت شد', thanks_p: 'ممنون از خریدتان! این یک سفارش نمونه است.', order_no: 'شماره سفارش', s_pending: 'در انتظار بررسی', s_processing: 'در حال آماده‌سازی', s_shipped: 'ارسال شد', s_delivered: 'تحویل داده شد', s_canceled: 'لغو شد', ship_to: 'ارسال به',
  login: 'ورود', register: 'ثبت‌نام', name: 'نام', pass: 'رمز عبور', pass_hint: 'حداقل ۸ کاراکتر', logout: 'خروج', hello: 'سلام، {n}', my_orders: 'سفارش‌های من', no_orders: 'هنوز سفارشی ثبت نکرده‌اید.', e_login: 'ایمیل یا رمز عبور اشتباه است.', e_exists: 'این ایمیل قبلاً ثبت شده است.', e_weak: 'رمز عبور باید حداقل ۸ کاراکتر باشد.', e_email: 'ایمیل معتبر نیست.', login_h: 'ورود به حساب', register_h: 'ساخت حساب جدید',
  f_about: 'درباره‌ی فروشگاه', f_about_d: 'پوشاک مینیمال و باکیفیت برای هر روز.', f_help: 'راهنما', f_rights: 'تمامی حقوق محفوظ است.', f_demo: 'نسخه‌ی نمایشی', nf_h: 'صفحه پیدا نشد', back_home: 'بازگشت به صفحه اصلی', continue_shop: 'ادامه خرید', view_order: 'پیگیری سفارش'
},
en: {
  brand: 'NIKA', home: 'Home', shop: 'Shop', cart: 'Cart', account: 'Account', search_ph: 'Search products…', menu: 'Menu', skip: 'Skip to content', lang: 'فارسی',
  demo_note: 'This is a demo store. Orders are not real.', ship_note: 'Free shipping over {n}',
  hero_kicker: 'Winter collection 2026', hero_title: 'ٔNika Style', hero_sub: 'Minimal, quality everyday wear: from tees and denim to coats and sneakers. Full size ranges and fast delivery.', hero_cta: 'Shop now', hero_cta2: 'New arrivals',
  cats_h: 'Shop by category', new_h: 'New arrivals', new_sub: 'The latest additions to the store', view_all: 'View all',
  promo_k: 'Special offer', promo_h: 'Up to 20% off coats, denim and sneakers', promo_sub: 'Limited stock while it lasts.', promo_cta: 'Shop the sale',
  f1_t: 'Fast delivery', f1_d: 'Nationwide shipping', f2_t: 'Easy returns', f2_d: '7-day exchange and return', f3_t: 'Secure checkout', f3_d: 'Cash on delivery or card transfer', f4_t: 'Support', f4_d: 'Help every day of the week',
  shop_h: 'All products', all: 'All', sort: 'Sort by', sort_new: 'Newest', sort_price_asc: 'Price: low to high', sort_price_desc: 'Price: high to low', size: 'Size', filter_size: 'Filter by size', results: '{n} products', no_results: 'No products found.', sale: 'Sale', search: 'Search', clear: 'Clear filters',
  new_badge: 'New', off: '{n}% off', choose_size: 'Choose a size', sizes_h: 'Sizes', qty: 'Quantity', add_to_cart: 'Add to cart', added: 'Added to cart', out_of_stock: 'Out of stock', low_stock: 'Only {n} left', in_stock: 'In stock',
  details_h: 'Details & care', related: 'You may also like', one_size: 'One size', size_err: 'Please choose a size.', yrs: 'yrs',
  cart_h: 'Shopping cart', empty_cart: 'Your cart is empty.', continue: 'Continue shopping', subtotal: 'Subtotal', shipping: 'Shipping', free: 'Free', total: 'Total', checkout: 'Proceed to checkout', remove: 'Remove', free_ship_left: 'Add {n} more for free shipping.', free_ship_ok: 'This order ships free 🎉', toman: 'Toman', stock_err: 'Not enough stock.',
  checkout_h: 'Checkout', full_name: 'Full name', phone: 'Mobile number', email: 'Email (optional)', city: 'City', address: 'Full address', notes: 'Notes (optional)', payment: 'Payment method', pay_cod: 'Cash on delivery', pay_card: 'Card transfer (demo)', place_order: 'Place order', summary: 'Order summary', demo_pay: 'No real payment is taken in this demo.',
  e_required: 'Please fill in all required fields.', e_phone: 'The mobile number is not valid.', e_generic: 'Something went wrong. Please try again.', e_empty: 'Your cart is empty.',
  thanks_h: 'Your order is placed', thanks_p: 'Thank you! This is a demo order.', order_no: 'Order number', s_pending: 'Pending', s_processing: 'Processing', s_shipped: 'Shipped', s_delivered: 'Delivered', s_canceled: 'Canceled', ship_to: 'Ship to',
  login: 'Log in', register: 'Sign up', name: 'Name', pass: 'Password', pass_hint: 'At least 8 characters', logout: 'Log out', hello: 'Hello, {n}', my_orders: 'My orders', no_orders: 'You have no orders yet.', e_login: 'Wrong email or password.', e_exists: 'This email is already registered.', e_weak: 'Password must be at least 8 characters.', e_email: 'The email is not valid.', login_h: 'Log in to your account', register_h: 'Create an account',
  f_about: 'About the store', f_about_d: 'Minimal, quality everyday wear.', f_help: 'Help', f_rights: 'All rights reserved.', f_demo: 'Demo version', nf_h: 'Page not found', back_home: 'Back to home', continue_shop: 'Continue shopping', view_order: 'View order'
}
};
module.exports = { LANGS, META, CATS, UI };
