# بوت تسجيل الحضور Discord Attendance Bot

بوت Discord لتتبع الحضور مع التسجيل التلقائي للخروج بعد عدم النشاط.

## المميزات

- ✅ تسجيل الدخول والخروج
- ⏰ التحقق التلقائي كل 10 دقائق
- 🔔 تسجيل خروج تلقائي بعد عدم الوجود في السيرفر لمدة ساعتين
- ⚙️ ملف إعدادات قابل للتعديل
- 📊 نظام تسجيل للجلسات
- 🚀 جاهز للنشر على Railway

## المتطلبات

- Node.js (الإصدار 16 أو أحدث)
- حساب Discord Bot
- حساب Railway (اختياري للنشر)

## التثبيت

### 1. إنشاء Discord Bot

1. اذهب إلى [Discord Developer Portal](https://discord.com/developers/applications)
2. أنشئ تطبيقاً جديداً
3. في قسم "Bot"، أنشئ بوتاً واحصل على التوكن
4. فعّل الأذونات التالية:
   - Gateway Intent: Server Members Intent
   - Gateway Intent: Presence Intent
5. انسخ التوكن

### 2. إعداد المشروع محلياً

```bash
# استنساخ المشروع أو تحميل الملفات
cd discord-attendance-bot

# تثبيت المكتبات
npm install

# إنشاء ملف .env
cp .env.example .env
```

### 3. تعديل ملف .env

افتح ملف `.env` وأضف التوكن:

```
DISCORD_TOKEN=your_bot_token_here
```

### 4. تعديل الإعدادات (اختياري)

افتح ملف `config.json` لتعديل الإعدادات:

```json
{
  "checkInterval": 10,           // فترة التحقق بالدقائق
  "timeoutMinutes": 120,         // مدة المهلة بالدقائق (ساعتين)
  "logsChannelId": "",           // معرف قناة اللوج (اختياري)
  "adminRoles": [],              // أدوار المشرفين (اختياري)
  "welcomeMessage": "...",       // رسالة الترحيب
  "loginSuccessMessage": "...",  // رسالة نجاح تسجيل الدخول
  "logoutSuccessMessage": "...", // رسالة نجاح تسجيل الخروج
  "alreadyLoggedInMessage": "...", // رسالة مسجل دخول بالفعل
  "notLoggedInMessage": "...",   // رسالة غير مسجل دخول
  "timeoutMessage": "..."        // رسالة انتهاء المهلة
}
```

### 5. تشغيل البوت محلياً

```bash
npm start
```

### 6. دعوة البوت إلى السيرفر

1. في Discord Developer Portal، اذهب إلى قسم "OAuth2"
2. في "URL Generator"، اختر الصلاحيات:
   - bot: Send Messages, Embed Links, Read Messages/View Channels
3. انسخ الرابط وافتحه في المتصفح
4. اختر السيرفر وأضف البوت

## النشر على Railway

### 1. إنشاء مستودع GitHub

```bash
# تهيئة Git
git init

# إضافة الملفات
git add .

# الالتزام الأول
git commit -m "Initial commit"

# إنشاء مستودع جديد على GitHub
# ثم اربط المستودع المحلي بالمستودع البعيد
git remote add origin https://github.com/your-username/discord-attendance-bot.git

# رفع الملفات
git push -u origin main
```

### 2. النشر على Railway

1. سجل الدخول إلى [Railway](https://railway.app)
2. اضغط على "New Project"
3. اختر "Deploy from GitHub repo"
4. اختر مستودعك
5. في قسم "Variables"، أضف:
   - `DISCORD_TOKEN`: توكن البوت الخاص بك
6. اضغط "Deploy"

## الأوامر

- `/login` - تسجيل الدخول
- `/logout` - تسجيل الخروج
- `/status` - عرض حالة التسجيل الحالية

## كيف يعمل البوت

1. **تسجيل الدخول**: عندما يستخدم المستخدم `/login`، يتم تسجيل وقت الدخول
2. **التحقق الدوري**: كل 10 دقائق، يتحقق البوت من:
   - المستخدمين المسجلين دخولهم
   - إذا كان المستخدم موجوداً في السيرفر
3. **تسجيل الخروج التلقائي**::
   - إذا لم يكن المستخدم في السيرفر، يتم تسجيل خروجه
   - إذا لم يكن المستخدم موجوداً لمدة ساعتين، يتم تسجيل خروجه وتصفر بياناته
4. **تسجيل الجلسات**: يتم حفظ جميع الجلسات في ملف `attendance.json`

## التعديل على البوت

### تغيير فترة التحقق

عدّل `checkInterval` في `config.json` (بالدقائق)

### تغيير مدة المهلة

عدّل `timeoutMinutes` في `config.json` (بالدقائق)

### إضافة قناة اللوج

1. فعّل وضع المطور في Discord
2. انقر بزر الماوس الأيمن على القناة
3. انسخ "ID"
4. أضفه إلى `logsChannelId` في `config.json`

## استكشاف الأخطاء

### البوت لا يستجيب

- تأكد من أن التوكن صحيح في `.env`
- تأكد من تفعيل Gateway Intents في Discord Developer Portal
- تأكد من أن البوت لديه الصلاحيات المطلوبة

### لا يتم تسجيل الخروج التلقائي

- تأكد من فترة التحقق في `config.json`
- تحقق من سجلات البوت في Railway

## الترخيص

MIT
