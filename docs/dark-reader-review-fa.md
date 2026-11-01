# بازبینی تطبیقی FontARA و Dark Reader

تاریخ بازبینی: ۲۰ تیر ۱۴۰۵ / 11 July 2026

مبنای بررسی Dark Reader، commit زیر از شاخهٔ اصلی است:

- `696d3be34a8a8c49f1f4175994380235d3b0d0fa`
- نسخهٔ پروژه هنگام بررسی: `4.9.128`
- [مشاهدهٔ commit در GitHub](https://github.com/darkreader/darkreader/tree/696d3be34a8a8c49f1f4175994380235d3b0d0fa)

این مقایسه دربارهٔ کیفیت معماری افزونه است، نه برابری دامنهٔ محصول. موتور تغییر رنگ و دیتابیس عظیم site-fix در Dark Reader عمداً بزرگ‌تر است؛ در مقابل، Dark Reader آپلود فایل فونت محلی ندارد و الگوی مستقیمی برای Custom Font چندوجهی FontARA ارائه نمی‌کند.

## نتیجهٔ امتیازدهی

| بخش | FontARA 5.1.0 | Dark Reader | نتیجه |
| --- | ---: | ---: | --- |
| معماری runtime و lifecycle | 95 | 94 | هر دو document-aware؛ FontARA بدون keep-alive مصنوعی |
| permissions و حریم خصوصی | 96 | 86 | FontARA بدون `tabs` و با host scope محدود به HTTP(S) |
| state، storage و sync | 95 | 95 | هر دو serialization و sync chunking مقاوم دارند |
| System Fonts | 94 | 84 | FontARA capability-based و Firefox را صریحاً unsupported می‌داند |
| Custom Fonts | 96 | N/A | Dark Reader آپلود فایل و کتابخانهٔ محلی ندارد |
| UI، RTL و دسترس‌پذیری | 92 | 87 | FontARA دارای i18n مشترک، shadcn/Radix و axe است |
| build، تست و انتشار | 96 | 93 | هر دو browser matrix دارند؛ FontARA artifact و reproducibility gate بیشتری دارد |
| site fixes و بلوغ میدانی | 91 | 99 | برتری اصلی Dark Reader، دیتابیس و سابقهٔ طولانی site-fix است |
| امتیاز کلی متناسب با دامنهٔ محصول | **94/100** | **92/100** | FontARA آمادهٔ release candidate است، نه rollout فوری بدون دورهٔ داخلی |

## الگوهای Dark Reader که در FontARA موجود یا تکمیل شدند

### Manifest و permissions

- Dark Reader در Chromium MV3 نیز permission دائمی `tabs` ندارد و با host permission و APIهای غیرحساس Tabs کار می‌کند. این بررسی حذف `tabs` از FontARA را تأیید می‌کند؛ popup، shortcut، icon update، broadcast و بازکردن options همچنان کار می‌کنند.
- `fontSettings` فقط در target کرومیوم FontARA باقی مانده و Firefox آن را دریافت نمی‌کند.
- `contextMenus` اختیاری است و فقط با اقدام کاربر grant/revoke می‌شود.
- build validation دقیقاً permissionهای مجاز را assert می‌کند.

### lifecycle و ارسال پیام

- الگوی `scriptId` و `documentId` برای جلوگیری از تحویل پیام به سند قدیمی حفظ شده است.
- مسیرهای `pagehide`، `pageshow`، `freeze` و `resume` در content runtime پوشش داده شده‌اند.
- retry تحویل Chromium برای `documentId` و `frameId` وجود دارد.
- پس از این بازبینی، حذف رکورد tab/frame فقط وقتی انجام می‌شود که `scriptId` هنوز متعلق به همان سند باشد؛ callback یا `DOCUMENT_FORGET` دیررس سند قدیمی دیگر نمی‌تواند سند جایگزین را حذف کند.

### storage و build flags

- writeهای تنظیمات در FontARA صف سراسری و revision دارند؛ UI نیز `clientMutationId` تولید می‌کند.
- مقادیر بزرگ sync مانند Dark Reader chunk می‌شوند، اما FontARA کنترل تعداد item، cleanup امن و تست concurrent cleanup نیز دارد.
- `__TEST__` از `__DEBUG__` جدا است و test bridge فقط در artifact اختصاصی localhost ساخته می‌شود.
- production validation نبودن RPC آزمایشی، سقف bundle، permissions، provenance فونت و noticeهای حقوقی را کنترل می‌کند.

### browser matrix

- افزون بر gateهای stable در CI اصلی، workflow زمان‌بندی‌شدهٔ FontARA مانند Dark Reader مرورگرهای Chrome stable/beta و Firefox stable/beta/ESR را آزمایش می‌کند.

## بهبودهای Custom Font حاصل از این ممیزی

- نام استاندارد OpenType از Preferred Family و WWS Family خوانده می‌شود؛ heuristic پسوند وزن فقط fallback سخت‌گیرانه است.
- نام نمایشی، نام فایل و کلید خانواده در مرز مرکزی NFKC می‌شوند.
- control characterها، bidi override/isolate، Arabic Letter Mark، LRM/RLM، BOM و zero-width space حذف می‌شوند؛ ZWNJ/ZWJ لازم برای نام‌های فارسی و شکل‌دهی متن حفظ می‌شوند.
- محدودیت طول بر اساس code point است، بنابراین ایموجی یا surrogate pair نصف نمی‌شود.
- نام داخلی CSS از نام واقعی فونت ساخته نمی‌شود و alias تصادفی امن باقی می‌ماند.
- UI نام‌های جهت‌دار را داخل `bdi dir="auto"` نمایش می‌دهد.
- import و backup نیز دوباره از همین normalization مرکزی عبور می‌کنند؛ امنیت فقط به UI آپلود وابسته نیست.
- پوشهٔ واقعی ایران‌یکان با ۸۰ فایل و ۱۰ batch مستقل برای TTF/WOFF، وزن‌های 100 تا 950 و نسخه‌های Base/Farsi Numerals/Mobile/Web/Rounded/Monospaced ممیزی شده است.

## الگوهایی که عمداً از Dark Reader اقتباس نشدند

- service worker keep-alive با interval ده‌ثانیه‌ای: مصرف انرژی و وابستگی به رفتار غیراستاندارد ایجاد می‌کند. FontARA restart را بخشی طبیعی از MV3 می‌داند و state ضروری را بازیابی می‌کند.
- نگهداری URL کامل frame/tab در `storage.local`: با قرارداد حریم خصوصی FontARA ناسازگار است؛ bookkeeping فقط در حافظه است.
- CSP گستردهٔ `img-src *` و `connect-src *`: FontARA فقط self/data برای تصویر و endpoint لازم Google Fonts را مجاز می‌کند.
- WebSocket test bridge داخل buildهای معمول debug: FontARA test artifact جدا و localhost-only دارد.
- پیاده‌سازی font picker Dark Reader: فقط فونت‌های نصب‌شده را انتخاب می‌کند و برای فایل آپلودی، face metadata، transaction، hash، quota، migration یا backup الگویی ندارد.

## پاسخ نهایی دربارهٔ دو تصمیم قبلی

- حذف آذر مهر به variable بودن آن مربوط نبود. فایل همراه پروژه مجوز بازتوزیع روشن و سازگار نداشت؛ حذف آن تصمیم حقوقی/انتشاری بود. Variable Font در FontARA پشتیبانی می‌شود.
- حذف permission `tabs` فیچر فعلی را حذف نکرده است. این permission قبلاً راه ساده‌ای برای دیدن URL همهٔ تب‌ها بود، اما host permission برای تب‌های HTTP(S) در scope اطلاعات لازم و عملیات مورد استفاده را فراهم می‌کند. چیزی که دیگر عمداً نداریم دسترسی عمومی به URL تب‌های خارج از scope مانند `chrome://` و `file://` است؛ FontARA به آن نیاز ندارد.

## وضعیت انتشار

کد در سطح release candidate قوی است، اما عبارت «همهٔ مشکلات برای همیشه رفع شده» برای هیچ افزونهٔ چندمرورگری صادق نیست. rollout باید طبق برنامه با کانال داخلی سه‌روزه، Chrome تدریجی و توقف خودکار روی data loss، binary exposure یا regression سطح P0/P1 انجام شود.
