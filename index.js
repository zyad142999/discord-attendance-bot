const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// تحميل الإعدادات
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// تحميل البيانات
let attendanceData = {};
let hoursData = {};
const dataPath = path.join(__dirname, 'attendance.json');
const hoursPath = path.join(__dirname, 'hours.json');

// تحميل البيانات من الملف
function loadData() {
  if (fs.existsSync(dataPath)) {
    attendanceData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }
  if (fs.existsSync(hoursPath)) {
    hoursData = JSON.parse(fs.readFileSync(hoursPath, 'utf8'));
  }
}

// حفظ البيانات في الملف
function saveData() {
  fs.writeFileSync(dataPath, JSON.stringify(attendanceData, null, 2));
}

// حفظ بيانات الساعات
function saveHoursData() {
  fs.writeFileSync(hoursPath, JSON.stringify(hoursData, null, 2));
}

// دالة للحصول على بداية الأسبوع
function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// دالة لحساب الساعات في الأسبوع الحالي
function getWeeklyHours(userId) {
  if (!hoursData[userId]) return 0;

  const weekStart = getWeekStart();
  let weeklyHours = 0;

  hoursData[userId].sessions.forEach(session => {
    const sessionDate = new Date(session.date);
    if (sessionDate >= weekStart) {
      weeklyHours += session.hours;
    }
  });

  return weeklyHours;
}

// إنشاء العميل
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent
  ]
});

// الأوامر
const commands = [
  new SlashCommandBuilder()
    .setName('login')
    .setDescription('تسجيل الدخول'),
  new SlashCommandBuilder()
    .setName('logout')
    .setDescription('تسجيل الخروج'),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('عرض حالة التسجيل'),
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('عرض لوحة التحكم'),
  new SlashCommandBuilder()
    .setName('list')
    .setDescription('عرض قائمة الحضور'),
  new SlashCommandBuilder()
    .setName('totalhours')
    .setDescription('عرض إجمالي ساعات الجميع'),
  new SlashCommandBuilder()
    .setName('exempt')
    .setDescription('استثناء شخص من الطرد التلقائي')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('المستخدم المراد استثناؤه')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('addhours')
    .setDescription('إضافة ساعات لشخص')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('المستخدم')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('hours')
        .setDescription('عدد الساعات')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('increasehours')
    .setDescription('زيادة ساعات شخص')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('المستخدم')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('hours')
        .setDescription('عدد الساعات المراد زيادتها')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('weeklyhours')
    .setDescription('عرض ساعات الأسبوع للجميع')
].map(command => command.toJSON());

// تسجيل الأوامر
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('بدء تسجيل الأوامر...');

    const data = await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log(`تم تسجيل ${data.length} أمر بنجاح!`);
  } catch (error) {
    console.error('خطأ في تسجيل الأوامر:', error);
  }
}

// إنشاء Embed للوحة التحكم
function createAttendancePanel() {
  const embed = new EmbedBuilder()
    .setColor(config.panelColor)
    .setTitle(config.panelTitle)
    .setDescription(config.panelDescription)
    .addFields(
      { name: config.panelFields.login, value: config.panelFields.loginDescription, inline: false },
      { name: config.panelFields.logout, value: config.panelFields.logoutDescription, inline: false },
      { name: config.panelFields.status, value: config.panelFields.statusDescription, inline: false },
      { name: config.panelFields.notes, value: config.panelFields.notesDescription, inline: false }
    )
    .setFooter({ text: `نظام تسجيل الحضور - ${new Date().toLocaleDateString('en-US')}` })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('login_button')
        .setLabel('تسجيل دخول')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🟢'),
      new ButtonBuilder()
        .setCustomId('logout_button')
        .setLabel('تسجيل خروج')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔴'),
      new ButtonBuilder()
        .setCustomId('status_button')
        .setLabel('عرض الحضور')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋')
    );

  return { embed, row };
}

// إنشاء Embed لقائمة الحضور
function createAttendanceList() {
  const loggedInUsers = [];

  Object.keys(attendanceData).forEach(userId => {
    const userData = attendanceData[userId];
    if (userData && userData.loggedIn) {
      const sessionDuration = Date.now() - userData.loginTime;
      const hours = Math.floor(sessionDuration / (1000 * 60 * 60));
      const minutes = Math.floor((sessionDuration % (1000 * 60 * 60)) / (1000 * 60));

      const loginTime = new Date(userData.loginTime);
      const timeAgo = getTimeAgo(loginTime);

      loggedInUsers.push({
        userId,
        sessionDuration: `${hours}h ${minutes}m`,
        timeAgo
      });
    }
  });

  if (loggedInUsers.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🟢 الأعضاء الحاليون المتواجدين')
      .setDescription('لا يوجد أعضاء مسجلين دخول حالياً')
      .setFooter({ text: `نظام تسجيل الحضور - ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US')}` })
      .setTimestamp();

    return { embed };
  }

  // ترتيب المستخدمين حسب وقت الدخول
  loggedInUsers.sort((a, b) => {
    const userA = attendanceData[a.userId].loginTime;
    const userB = attendanceData[b.userId].loginTime;
    return userA - userB;
  });

  // إنشاء قائمة المستخدمين
  let userList = '';
  loggedInUsers.forEach((user, index) => {
    userList += `${index + 1}. <@${user.userId}> - 🟢 ${user.sessionDuration} - منذ ${user.timeAgo}\n`;
  });

  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('🟢 الأعضاء الحاليون المتواجدين')
    .setDescription(userList)
    .setFooter({ text: `نظام تسجيل الحضور - ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US')}` })
    .setTimestamp();

  return { embed };
}

// دالة مساعدة لحساب الوقت الماضي
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  const intervals = {
    'سنة': 31536000,
    'شهر': 2592000,
    'أسبوع': 604800,
    'يوم': 86400,
    'ساعة': 3600,
    'دقيقة': 60
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `منذ ${interval} ${unit}`;
    }
  }

  return 'منذ لحظات';
}

// التعامل مع الأوامر
client.on('interactionCreate', async interaction => {
  // التعامل مع الأزرار
  if (interaction.isButton()) {
    const { customId, user, guild } = interaction;

    if (customId === 'login_button') {
      const userId = user.id;

      if (attendanceData[userId] && attendanceData[userId].loggedIn) {
        await interaction.reply({
          content: config.alreadyLoggedInMessage,
          ephemeral: true
        });
        return;
      }

      attendanceData[userId] = {
        loggedIn: true,
        loginTime: Date.now(),
        lastSeen: Date.now()
      };
      saveData();

      // تسجيل بداية الجلسة للساعات
      if (!hoursData[userId]) {
        hoursData[userId] = {
          totalHours: 0,
          sessions: []
        };
      }
      hoursData[userId].currentSessionStart = Date.now();
      saveHoursData();

      await interaction.reply({
        content: config.loginSuccessMessage,
        ephemeral: true
      });

      // إرسال رسالة في قناة اللوج إذا تم تحديدها
      if (config.logsChannelId) {
        const logChannel = await guild.channels.fetch(config.logsChannelId).catch(() => null);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('تسجيل دخول جديد')
            .setDescription(`المستخدم: ${user.tag}\nالوقت: ${new Date().toLocaleString('ar-SA')}`)
            .setTimestamp();
          await logChannel.send({ embeds: [embed] });
        }
      }
    }

    if (customId === 'logout_button') {
      const userId = user.id;

      if (!attendanceData[userId] || !attendanceData[userId].loggedIn) {
        await interaction.reply({
          content: config.notLoggedInMessage,
          ephemeral: true
        });
        return;
      }

      const sessionDuration = Date.now() - attendanceData[userId].loginTime;
      const hours = Math.floor(sessionDuration / (1000 * 60 * 60));
      const minutes = Math.floor((sessionDuration % (1000 * 60 * 60)) / (1000 * 60));

      // حفظ الساعات من هذه الجلسة
      if (hoursData[userId] && hoursData[userId].currentSessionStart) {
        const sessionHours = (Date.now() - hoursData[userId].currentSessionStart) / (1000 * 60 * 60);
        hoursData[userId].totalHours += sessionHours;
        hoursData[userId].sessions.push({
          date: new Date().toISOString(),
          hours: sessionHours
        });
        delete hoursData[userId].currentSessionStart;
        saveHoursData();
      }

      attendanceData[userId] = {
        loggedIn: false,
        loginTime: null,
        lastSeen: Date.now()
      };
      saveData();

      await interaction.reply({
        content: `${config.logoutSuccessMessage}\nمدة الجلسة: ${hours} ساعة و ${minutes} دقيقة`,
        ephemeral: true
      });

      // إرسال رسالة في قناة اللوج إذا تم تحديدها
      if (config.logsChannelId) {
        const logChannel = await guild.channels.fetch(config.logsChannelId).catch(() => null);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('تسجيل خروج')
            .setDescription(`المستخدم: ${user.tag}\nالوقت: ${new Date().toLocaleString('ar-SA')}\nمدة الجلسة: ${hours} ساعة و ${minutes} دقيقة`)
            .setTimestamp();
          await logChannel.send({ embeds: [embed] });
        }
      }
    }

    if (customId === 'status_button') {
      const { embed } = createAttendanceList();
      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    return;
  }

  // التعامل مع الأوامر النصية
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user, guild } = interaction;

  if (commandName === 'login') {
    const userId = user.id;

    if (attendanceData[userId] && attendanceData[userId].loggedIn) {
      await interaction.reply({
        content: config.alreadyLoggedInMessage,
        ephemeral: true
      });
      return;
    }

    attendanceData[userId] = {
      loggedIn: true,
      loginTime: Date.now(),
      lastSeen: Date.now()
    };
    saveData();

    await interaction.reply({
      content: config.loginSuccessMessage,
      ephemeral: true
    });

    // إرسال رسالة في قناة اللوج إذا تم تحديدها
    if (config.logsChannelId) {
      const logChannel = await guild.channels.fetch(config.logsChannelId).catch(() => null);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('تسجيل دخول جديد')
          .setDescription(`المستخدم: ${user.tag}\nالوقت: ${new Date().toLocaleString('ar-SA')}`)
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
      }
    }
  }

  if (commandName === 'logout') {
    const userId = user.id;

    if (!attendanceData[userId] || !attendanceData[userId].loggedIn) {
      await interaction.reply({
        content: config.notLoggedInMessage,
        ephemeral: true
      });
      return;
    }

    const sessionDuration = Date.now() - attendanceData[userId].loginTime;
    const hours = Math.floor(sessionDuration / (1000 * 60 * 60));
    const minutes = Math.floor((sessionDuration % (1000 * 60 * 60)) / (1000 * 60));

    attendanceData[userId] = {
      loggedIn: false,
      loginTime: null,
      lastSeen: Date.now()
    };
    saveData();

    await interaction.reply({
      content: `${config.logoutSuccessMessage}\nمدة الجلسة: ${hours} ساعة و ${minutes} دقيقة`,
      ephemeral: true
    });

    // إرسال رسالة في قناة اللوج إذا تم تحديدها
    if (config.logsChannelId) {
      const logChannel = await guild.channels.fetch(config.logsChannelId).catch(() => null);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('تسجيل خروج')
          .setDescription(`المستخدم: ${user.tag}\nالوقت: ${new Date().toLocaleString('ar-SA')}\nمدة الجلسة: ${hours} ساعة و ${minutes} دقيقة`)
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
      }
    }
  }

  if (commandName === 'status') {
    const { embed } = createAttendanceList();
    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  if (commandName === 'panel') {
    const { embed, row } = createAttendancePanel();
    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }

  if (commandName === 'list') {
    const { embed } = createAttendanceList();
    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  if (commandName === 'totalhours') {
    let totalHoursList = '';
    let totalAllHours = 0;

    Object.keys(hoursData).forEach(userId => {
      const userHours = hoursData[userId].totalHours || 0;
      totalAllHours += userHours;
      totalHoursList += `<@${userId}>: ${userHours.toFixed(2)} ساعة\n`;
    });

    if (totalHoursList === '') {
      totalHoursList = 'لا توجد بيانات ساعات متاحة';
    }

    const embed = new EmbedBuilder()
      .setColor('#00bfff')
      .setTitle('📊 إجمالي ساعات الجميع')
      .setDescription(totalHoursList)
      .addFields({ name: 'إجمالي ساعات الجميع', value: `${totalAllHours.toFixed(2)} ساعة`, inline: false })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: false
    });
  }

  if (commandName === 'exempt') {
    const targetUser = interaction.options.getUser('user');
    const userId = targetUser.id;

    if (config.exemptUsers.includes(userId)) {
      // إزالة الاستثناء
      config.exemptUsers = config.exemptUsers.filter(id => id !== userId);
      fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));

      await interaction.reply({
        content: `تم إزالة الاستثناء عن <@${userId}>`,
        ephemeral: true
      });
    } else {
      // إضافة الاستثناء
      config.exemptUsers.push(userId);
      fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));

      await interaction.reply({
        content: `تم استثناء <@${userId}> من الطرد التلقائي`,
        ephemeral: true
      });
    }
  }

  if (commandName === 'addhours') {
    const targetUser = interaction.options.getUser('user');
    const hoursToSet = interaction.options.getInteger('hours');
    const userId = targetUser.id;

    if (!hoursData[userId]) {
      hoursData[userId] = {
        totalHours: 0,
        sessions: []
      };
    }

    hoursData[userId].totalHours = hoursToSet;
    hoursData[userId].sessions.push({
      date: new Date().toISOString(),
      hours: hoursToSet,
      manual: true,
      set: true
    });
    saveHoursData();

    await interaction.reply({
      content: `تم تحديد ساعات <@${userId}> إلى ${hoursToSet} ساعة`,
      ephemeral: true
    });
  }

  if (commandName === 'increasehours') {
    const targetUser = interaction.options.getUser('user');
    const hoursToIncrease = interaction.options.getInteger('hours');
    const userId = targetUser.id;

    if (!hoursData[userId]) {
      hoursData[userId] = {
        totalHours: 0,
        sessions: []
      };
    }

    hoursData[userId].totalHours += hoursToIncrease;
    hoursData[userId].sessions.push({
      date: new Date().toISOString(),
      hours: hoursToIncrease,
      manual: true
    });
    saveHoursData();

    await interaction.reply({
      content: `تم زيادة ${hoursToIncrease} ساعة لـ <@${userId}>. الإجمالي الآن: ${hoursData[userId].totalHours.toFixed(2)} ساعة`,
      ephemeral: true
    });
  }

  if (commandName === 'weeklyhours') {
    let weeklyHoursList = '';

    Object.keys(hoursData).forEach(userId => {
      const weeklyHours = getWeeklyHours(userId);
      weeklyHoursList += `<@${userId}>: ${weeklyHours.toFixed(2)} ساعة\n`;
    });

    if (weeklyHoursList === '') {
      weeklyHoursList = 'لا توجد بيانات ساعات أسبوعية متاحة';
    }

    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('📅 ساعات الأسبوع للجميع')
      .setDescription(weeklyHoursList)
      .setFooter({ text: `الأسبوع من ${getWeekStart().toLocaleDateString('ar-SA')}` })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: false
    });
  }
});

// التحقق كل 10 دقائق
function checkAttendance() {
  const guilds = client.guilds.cache;

  guilds.forEach(async guild => {
    const members = await guild.members.fetch();

    Object.keys(attendanceData).forEach(async userId => {
      const userData = attendanceData[userId];

      if (userData && userData.loggedIn) {
        const member = await members.fetch(userId).catch(() => null);

        if (!member) {
          // المستخدم غير موجود في السيرفر
          // التحقق من أن المستخدم ليس مستثنى
          if (!config.exemptUsers.includes(userId)) {
            attendanceData[userId] = {
              loggedIn: false,
              loginTime: null,
              lastSeen: Date.now()
            };
            saveData();

            if (config.logsChannelId) {
              const logChannel = await guild.channels.fetch(config.logsChannelId).catch(() => null);
              if (logChannel) {
                const embed = new EmbedBuilder()
                  .setColor('#ff9900')
                  .setTitle('تسجيل خروج تلقائي')
                  .setDescription(`المستخدم: <@${userId}>\nالسبب: غير موجود في السيرفر\nالوقت: ${new Date().toLocaleString('ar-SA')}`)
                  .setTimestamp();
                await logChannel.send({ embeds: [embed] });
              }
            }
          }
        } else {
          // تحديث آخر ظهور
          attendanceData[userId].lastSeen = Date.now();
          saveData();
        }
      }
    });
  });
}

// التحقق من المستخدمين الذين لم يكونوا موجودين لمدة ساعتين
function checkInactiveUsers() {
  const now = Date.now();
  const timeoutMs = config.timeoutMinutes * 60 * 1000;

  Object.keys(attendanceData).forEach(userId => {
    const userData = attendanceData[userId];

    if (userData && userData.loggedIn) {
      const timeSinceLastSeen = now - userData.lastSeen;

      if (timeSinceLastSeen > timeoutMs) {
        // تسجيل خروج تلقائي
        attendanceData[userId] = {
          loggedIn: false,
          loginTime: null,
          lastSeen: Date.now()
        };
        saveData();

        // إرسال رسالة للمستخدم
        const user = client.users.fetch(userId).catch(() => null);
        if (user) {
          user.then(u => u.send(config.timeoutMessage).catch(() => {}));
        }

        // إرسال رسالة في قناة اللوج
        if (config.logsChannelId) {
          const guilds = client.guilds.cache;
          guilds.forEach(async guild => {
            const logChannel = await guild.channels.fetch(config.logsChannelId).catch(() => null);
            if (logChannel) {
              const embed = new EmbedBuilder()
                .setColor('#ff6600')
                .setTitle('تسجيل خروج تلقائي - انتهاء الوقت')
                .setDescription(`المستخدم: <@${userId}>\nالسبب: عدم وجوده لمدة ساعتين\nالوقت: ${new Date().toLocaleString('ar-SA')}`)
                .setTimestamp();
              await logChannel.send({ embeds: [embed] });
            }
          });
        }
      }
    }
  });
}

// بدء التحقق الدوري
function startPeriodicChecks() {
  // التحقق كل 10 دقائق
  setInterval(() => {
    console.log('جاري التحقق من الحضور...');
    checkAttendance();
    checkInactiveUsers();
  }, config.checkInterval * 60 * 1000);
}

// إرسال اللوحة تلقائياً إلى القناة المحددة
async function sendPanelToChannel() {
  if (!config.panelChannelId) {
    console.log('لم يتم تحديد قناة للوحة في config.json');
    return;
  }

  try {
    const channel = await client.channels.fetch(config.panelChannelId);
    if (!channel) {
      console.log('القناة المحددة غير موجودة');
      return;
    }

    const { embed, row } = createAttendancePanel();
    await channel.send({
      embeds: [embed],
      components: [row]
    });

    console.log(`تم إرسال اللوحة إلى القناة ${config.panelChannelId}`);
  } catch (error) {
    console.error('خطأ في إرسال اللوحة:', error);
  }
}

// عند جاهزية البوت
client.once('ready', () => {
  console.log(`تم تسجيل الدخول كـ ${client.user.tag}!`);
  loadData();
  registerCommands();
  startPeriodicChecks();

  // إرسال اللوحة تلقائياً بعد ثواني قليلة
  setTimeout(() => {
    sendPanelToChannel();
  }, 3000);
});

// تشغيل البوت
client.login(process.env.DISCORD_TOKEN);
