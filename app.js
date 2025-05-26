const express = require("express");
const RSSParser = require("rss-parser");
const axios = require("axios");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const he = require("he");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { exec } = require("child_process");
const { promisify } = require("util");
const { createCanvas, loadImage, registerFont } = require("canvas");
const textToSpeech = require("@google-cloud/text-to-speech");

const app = express();
const parser = new RSSParser();
const PORT = 3000;

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Data file path
const DATA_FILE = path.join(__dirname, "data", "questions.json");
const LAST_FETCH_FILE = path.join(__dirname, "data", "last_fetched.json");

// StackOverflow API base URL
const SO_API_BASE = "https://api.stackexchange.com/2.3";

// Programlama dili renkleri, logoları ve tasarım varyasyonları
const LANGUAGE_THEMES = {
  javascript: {
    color: "#F7DF1E",
    bgColor: "#1E1E1E",
    textColor: "#FFFFFF",
    icon: "⚡",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/javascript/javascript-original.svg",
  },
  typescript: {
    color: "#3178C6",
    bgColor: "#FFFFFF",
    textColor: "#3178C6",
    icon: "📘",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg",
  },
  python: {
    color: "#3776AB",
    bgColor: "#FFD43B",
    textColor: "#3776AB",
    icon: "🐍",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/python/python-original.svg",
  },
  java: {
    color: "#ED8B00",
    bgColor: "#FFFFFF",
    textColor: "#ED8B00",
    icon: "☕",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/java/java-original.svg",
  },
  "c#": {
    color: "#239120",
    bgColor: "#FFFFFF",
    textColor: "#239120",
    icon: "#️⃣",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/csharp/csharp-original.svg",
  },
  "c++": {
    color: "#00599C",
    bgColor: "#FFFFFF",
    textColor: "#00599C",
    icon: "⚙️",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/cplusplus/cplusplus-original.svg",
  },
  php: {
    color: "#777BB4",
    bgColor: "#FFFFFF",
    textColor: "#777BB4",
    icon: "🐘",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/php/php-original.svg",
  },
  go: {
    color: "#00ADD8",
    bgColor: "#FFFFFF",
    textColor: "#00ADD8",
    icon: "🐹",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/go/go-original.svg",
  },
  rust: {
    color: "#CE422B",
    bgColor: "#FFFFFF",
    textColor: "#CE422B",
    icon: "🦀",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/rust/rust-plain.svg",
  },
  kotlin: {
    color: "#7F52FF",
    bgColor: "#FFFFFF",
    textColor: "#7F52FF",
    icon: "🎯",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/kotlin/kotlin-original.svg",
  },
  swift: {
    color: "#FA7343",
    bgColor: "#FFFFFF",
    textColor: "#FA7343",
    icon: "🍎",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/swift/swift-original.svg",
  },
  react: {
    color: "#61DAFB",
    bgColor: "#20232A",
    textColor: "#61DAFB",
    icon: "⚛️",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/react/react-original.svg",
  },
  vue: {
    color: "#4FC08D",
    bgColor: "#FFFFFF",
    textColor: "#4FC08D",
    icon: "💚",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/vuejs/vuejs-original.svg",
  },
  angular: {
    color: "#DD0031",
    bgColor: "#FFFFFF",
    textColor: "#DD0031",
    icon: "🅰️",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/angularjs/angularjs-original.svg",
  },
  nodejs: {
    color: "#339933",
    bgColor: "#FFFFFF",
    textColor: "#339933",
    icon: "🟢",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/nodejs/nodejs-original.svg",
  },
  flutter: {
    color: "#02569B",
    bgColor: "#FFFFFF",
    textColor: "#02569B",
    icon: "🦋",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/flutter/flutter-original.svg",
  },
  "react-native": {
    color: "#61DAFB",
    bgColor: "#20232A",
    textColor: "#61DAFB",
    icon: "📱",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/react/react-original.svg",
  },
  android: {
    color: "#3DDC84",
    bgColor: "#FFFFFF",
    textColor: "#3DDC84",
    icon: "🤖",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/android/android-original.svg",
  },
  html: {
    color: "#E34F26",
    bgColor: "#FFFFFF",
    textColor: "#E34F26",
    icon: "🌐",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/html5/html5-original.svg",
  },
  css: {
    color: "#1572B6",
    bgColor: "#FFFFFF",
    textColor: "#1572B6",
    icon: "🎨",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/css3/css3-original.svg",
  },
  bootstrap: {
    color: "#7952B3",
    bgColor: "#FFFFFF",
    textColor: "#7952B3",
    icon: "🅱️",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/bootstrap/bootstrap-original.svg",
  },
  mongodb: {
    color: "#47A248",
    bgColor: "#FFFFFF",
    textColor: "#47A248",
    icon: "🍃",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/mongodb/mongodb-original.svg",
  },
  mysql: {
    color: "#4479A1",
    bgColor: "#FFFFFF",
    textColor: "#4479A1",
    icon: "🐬",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/mysql/mysql-original.svg",
  },
  docker: {
    color: "#2496ED",
    bgColor: "#FFFFFF",
    textColor: "#2496ED",
    icon: "🐳",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/docker/docker-original.svg",
  },
  git: {
    color: "#F05032",
    bgColor: "#FFFFFF",
    textColor: "#F05032",
    icon: "📝",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/git/git-original.svg",
  },
  linux: { color: "#FCC624", bgColor: "#000000", textColor: "#FCC624", icon: "🐧" },
  bash: { color: "#4EAA25", bgColor: "#000000", textColor: "#4EAA25", icon: "💻" },
  powershell: { color: "#5391FE", bgColor: "#FFFFFF", textColor: "#5391FE", icon: "💻" },
  "machine-learning": { color: "#FF6F00", bgColor: "#FFFFFF", textColor: "#FF6F00", icon: "🤖" },
  tensorflow: { color: "#FF6F00", bgColor: "#FFFFFF", textColor: "#FF6F00", icon: "🧠" },
  pytorch: { color: "#EE4C2C", bgColor: "#FFFFFF", textColor: "#EE4C2C", icon: "🔥" },
  pandas: { color: "#150458", bgColor: "#FFFFFF", textColor: "#150458", icon: "🐼" },
  numpy: { color: "#013243", bgColor: "#FFFFFF", textColor: "#013243", icon: "🔢" },
  django: { color: "#092E20", bgColor: "#FFFFFF", textColor: "#092E20", icon: "🎸" },
  flask: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "🌶️" },
  laravel: { color: "#FF2D20", bgColor: "#FFFFFF", textColor: "#FF2D20", icon: "🎭" },
  "spring-boot": { color: "#6DB33F", bgColor: "#FFFFFF", textColor: "#6DB33F", icon: "🍃" },
  ".net": { color: "#512BD4", bgColor: "#FFFFFF", textColor: "#512BD4", icon: "🔷" },
  unity: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "🎮" },
  firebase: { color: "#FFCA28", bgColor: "#FFFFFF", textColor: "#FFCA28", icon: "🔥" },
  graphql: { color: "#E10098", bgColor: "#FFFFFF", textColor: "#E10098", icon: "📊" },
  webpack: { color: "#8DD6F9", bgColor: "#FFFFFF", textColor: "#8DD6F9", icon: "📦" },
  nextjs: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "▲" },
  nuxtjs: { color: "#00DC82", bgColor: "#FFFFFF", textColor: "#00DC82", icon: "💚" },
  express: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "🚂" },
  elasticsearch: { color: "#005571", bgColor: "#FFFFFF", textColor: "#005571", icon: "🔍" },
  rabbitmq: { color: "#FF6600", bgColor: "#FFFFFF", textColor: "#FF6600", icon: "🐰" },
  nginx: { color: "#009639", bgColor: "#FFFFFF", textColor: "#009639", icon: "🌐" },
  apache: { color: "#D22128", bgColor: "#FFFFFF", textColor: "#D22128", icon: "🪶" },
  selenium: { color: "#43B02A", bgColor: "#FFFFFF", textColor: "#43B02A", icon: "🤖" },
  jest: { color: "#C21325", bgColor: "#FFFFFF", textColor: "#C21325", icon: "🃏" },
  cypress: { color: "#17202C", bgColor: "#FFFFFF", textColor: "#17202C", icon: "🌲" },
  regex: { color: "#FF6B35", bgColor: "#FFFFFF", textColor: "#FF6B35", icon: "🔤" },
  json: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "📄" },
  xml: { color: "#FF6600", bgColor: "#FFFFFF", textColor: "#FF6600", icon: "📋" },
  api: { color: "#FF6B35", bgColor: "#FFFFFF", textColor: "#FF6B35", icon: "🔌" },
  rest: { color: "#02569B", bgColor: "#FFFFFF", textColor: "#02569B", icon: "🌐" },
  websocket: { color: "#010101", bgColor: "#FFFFFF", textColor: "#010101", icon: "🔌" },
  oauth: { color: "#EB5424", bgColor: "#FFFFFF", textColor: "#EB5424", icon: "🔐" },
  jwt: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "🎫" },
  blockchain: { color: "#F7931A", bgColor: "#FFFFFF", textColor: "#F7931A", icon: "⛓️" },
  solidity: { color: "#363636", bgColor: "#FFFFFF", textColor: "#363636", icon: "💎" },
  electron: { color: "#47848F", bgColor: "#FFFFFF", textColor: "#47848F", icon: "⚛️" },
  cordova: { color: "#E8E8E8", bgColor: "#000000", textColor: "#E8E8E8", icon: "📱" },
  xamarin: { color: "#3498DB", bgColor: "#FFFFFF", textColor: "#3498DB", icon: "📱" },
  ios: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "📱" },
  default: {
    color: "#6366F1",
    bgColor: "#FFFFFF",
    textColor: "#6366F1",
    icon: "💻",
    logoUrl: null,
  },
};

// Tasarım varyasyonları
const DESIGN_VARIANTS = ["modern", "gradient", "minimal", "geometric", "neon"];

// Renk paletleri ve tasarım varyasyonları
const COLOR_PALETTES = [
  // Sunset
  { primary: "#FF6B6B", secondary: "#4ECDC4", accent: "#45B7D1", bg1: "#96CEB4", bg2: "#FFEAA7" },
  // Ocean
  { primary: "#0984e3", secondary: "#74b9ff", accent: "#00b894", bg1: "#00cec9", bg2: "#6c5ce7" },
  // Forest
  { primary: "#00b894", secondary: "#55a3ff", accent: "#fdcb6e", bg1: "#6c5ce7", bg2: "#fd79a8" },
  // Purple
  { primary: "#a29bfe", secondary: "#fd79a8", accent: "#fdcb6e", bg1: "#e17055", bg2: "#74b9ff" },
  // Fire
  { primary: "#e17055", secondary: "#fdcb6e", accent: "#fd79a8", bg1: "#ff7675", bg2: "#74b9ff" },
  // Neon
  { primary: "#00ff88", secondary: "#00d4ff", accent: "#ff0080", bg1: "#8000ff", bg2: "#ffff00" },
  // Retro
  { primary: "#ff6b9d", secondary: "#c44569", accent: "#f8b500", bg1: "#3742fa", bg2: "#2ed573" },
  // Corporate
  { primary: "#2c3e50", secondary: "#3498db", accent: "#e74c3c", bg1: "#95a5a6", bg2: "#f39c12" },
];

// Tasarım layoutları
const LAYOUT_VARIANTS = ["left-aligned", "centered", "diagonal", "corner", "split"];

// Şekil varyasyonları
const SHAPE_VARIANTS = ["circles", "triangles", "hexagons", "waves", "geometric", "organic"];

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(__dirname, "data");
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Load existing data
async function loadQuestions() {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save questions
async function saveQuestions(questions) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(questions, null, 2));
}

// StackOverflow RSS URLs for different categories
const RSS_FEEDS = {
  javascript: "https://stackoverflow.com/feeds/tag?tagnames=javascript&sort=newest",
  python: "https://stackoverflow.com/feeds/tag?tagnames=python&sort=newest",
  nodejs: "https://stackoverflow.com/feeds/tag?tagnames=node.js&sort=newest",
  react: "https://stackoverflow.com/feeds/tag?tagnames=reactjs&sort=newest",
  vue: "https://stackoverflow.com/feeds/tag?tagnames=vue.js&sort=newest",
  angular: "https://stackoverflow.com/feeds/tag?tagnames=angular&sort=newest",
  php: "https://stackoverflow.com/feeds/tag?tagnames=php&sort=newest",
  java: "https://stackoverflow.com/feeds/tag?tagnames=java&sort=newest",
  "c#": "https://stackoverflow.com/feeds/tag?tagnames=c%23&sort=newest",
  sql: "https://stackoverflow.com/feeds/tag?tagnames=sql&sort=newest",
  typescript: "https://stackoverflow.com/feeds/tag?tagnames=typescript&sort=newest",
  "c++": "https://stackoverflow.com/feeds/tag?tagnames=c%2B%2B&sort=newest",
  go: "https://stackoverflow.com/feeds/tag?tagnames=go&sort=newest",
  rust: "https://stackoverflow.com/feeds/tag?tagnames=rust&sort=newest",
  kotlin: "https://stackoverflow.com/feeds/tag?tagnames=kotlin&sort=newest",
  swift: "https://stackoverflow.com/feeds/tag?tagnames=swift&sort=newest",
  flutter: "https://stackoverflow.com/feeds/tag?tagnames=flutter&sort=newest",
  "react-native": "https://stackoverflow.com/feeds/tag?tagnames=react-native&sort=newest",
  android: "https://stackoverflow.com/feeds/tag?tagnames=android&sort=newest",
  ios: "https://stackoverflow.com/feeds/tag?tagnames=ios&sort=newest",
  html: "https://stackoverflow.com/feeds/tag?tagnames=html&sort=newest",
  css: "https://stackoverflow.com/feeds/tag?tagnames=css&sort=newest",
  bootstrap: "https://stackoverflow.com/feeds/tag?tagnames=bootstrap&sort=newest",
  jquery: "https://stackoverflow.com/feeds/tag?tagnames=jquery&sort=newest",
  express: "https://stackoverflow.com/feeds/tag?tagnames=express&sort=newest",
  mysql: "https://stackoverflow.com/feeds/tag?tagnames=mysql&sort=newest",
  postgresql: "https://stackoverflow.com/feeds/tag?tagnames=postgresql&sort=newest",
  redis: "https://stackoverflow.com/feeds/tag?tagnames=redis&sort=newest",
  docker: "https://stackoverflow.com/feeds/tag?tagnames=docker&sort=newest",
  kubernetes: "https://stackoverflow.com/feeds/tag?tagnames=kubernetes&sort=newest",
  aws: "https://stackoverflow.com/feeds/tag?tagnames=amazon-web-services&sort=newest",
  azure: "https://stackoverflow.com/feeds/tag?tagnames=azure&sort=newest",
  git: "https://stackoverflow.com/feeds/tag?tagnames=git&sort=newest",
  linux: "https://stackoverflow.com/feeds/tag?tagnames=linux&sort=newest",
  bash: "https://stackoverflow.com/feeds/tag?tagnames=bash&sort=newest",
  powershell: "https://stackoverflow.com/feeds/tag?tagnames=powershell&sort=newest",
  "machine-learning": "https://stackoverflow.com/feeds/tag?tagnames=machine-learning&sort=newest",
  tensorflow: "https://stackoverflow.com/feeds/tag?tagnames=tensorflow&sort=newest",
  pytorch: "https://stackoverflow.com/feeds/tag?tagnames=pytorch&sort=newest",
  pandas: "https://stackoverflow.com/feeds/tag?tagnames=pandas&sort=newest",
  numpy: "https://stackoverflow.com/feeds/tag?tagnames=numpy&sort=newest",
  django: "https://stackoverflow.com/feeds/tag?tagnames=django&sort=newest",
  flask: "https://stackoverflow.com/feeds/tag?tagnames=flask&sort=newest",
  laravel: "https://stackoverflow.com/feeds/tag?tagnames=laravel&sort=newest",
  "spring-boot": "https://stackoverflow.com/feeds/tag?tagnames=spring-boot&sort=newest",
  ".net": "https://stackoverflow.com/feeds/tag?tagnames=.net&sort=newest",
  unity: "https://stackoverflow.com/feeds/tag?tagnames=unity3d&sort=newest",
  firebase: "https://stackoverflow.com/feeds/tag?tagnames=firebase&sort=newest",
  graphql: "https://stackoverflow.com/feeds/tag?tagnames=graphql&sort=newest",
  webpack: "https://stackoverflow.com/feeds/tag?tagnames=webpack&sort=newest",
  nextjs: "https://stackoverflow.com/feeds/tag?tagnames=next.js&sort=newest",
  nuxtjs: "https://stackoverflow.com/feeds/tag?tagnames=nuxt.js&sort=newest",
  tailwind: "https://stackoverflow.com/feeds/tag?tagnames=tailwind-css&sort=newest",
  sass: "https://stackoverflow.com/feeds/tag?tagnames=sass&sort=newest",
  elasticsearch: "https://stackoverflow.com/feeds/tag?tagnames=elasticsearch&sort=newest",
  rabbitmq: "https://stackoverflow.com/feeds/tag?tagnames=rabbitmq&sort=newest",
  nginx: "https://stackoverflow.com/feeds/tag?tagnames=nginx&sort=newest",
  apache: "https://stackoverflow.com/feeds/tag?tagnames=apache&sort=newest",
  selenium: "https://stackoverflow.com/feeds/tag?tagnames=selenium&sort=newest",
  jest: "https://stackoverflow.com/feeds/tag?tagnames=jestjs&sort=newest",
  cypress: "https://stackoverflow.com/feeds/tag?tagnames=cypress&sort=newest",
  regex: "https://stackoverflow.com/feeds/tag?tagnames=regex&sort=newest",
  json: "https://stackoverflow.com/feeds/tag?tagnames=json&sort=newest",
  xml: "https://stackoverflow.com/feeds/tag?tagnames=xml&sort=newest",
  api: "https://stackoverflow.com/feeds/tag?tagnames=api&sort=newest",
  rest: "https://stackoverflow.com/feeds/tag?tagnames=rest&sort=newest",
  websocket: "https://stackoverflow.com/feeds/tag?tagnames=websocket&sort=newest",
  oauth: "https://stackoverflow.com/feeds/tag?tagnames=oauth&sort=newest",
  jwt: "https://stackoverflow.com/feeds/tag?tagnames=jwt&sort=newest",
  blockchain: "https://stackoverflow.com/feeds/tag?tagnames=blockchain&sort=newest",
  solidity: "https://stackoverflow.com/feeds/tag?tagnames=solidity&sort=newest",
  electron: "https://stackoverflow.com/feeds/tag?tagnames=electron&sort=newest",
  cordova: "https://stackoverflow.com/feeds/tag?tagnames=cordova&sort=newest",
  xamarin: "https://stackoverflow.com/feeds/tag?tagnames=xamarin&sort=newest",
  mongodb: "https://stackoverflow.com/feeds/tag?tagnames=mongodb&sort=newest",
};

// Extract question ID from StackOverflow URL
function extractQuestionId(url) {
  const match = url.match(/\/questions\/(\d+)\//);
  return match ? match[1] : null;
}

// Son çekilen sorunun id/tarihini oku (kategori+mod)
async function loadLastFetched(category, mode) {
  try {
    const data = await fs.readFile(LAST_FETCH_FILE, "utf8");
    const obj = JSON.parse(data);
    return obj[`${category}_${mode}`] || null;
  } catch {
    return null;
  }
}

// Son çekilen sorunun id/tarihini kaydet (kategori+mod)
async function saveLastFetched(category, mode, value) {
  let obj = {};
  try {
    const data = await fs.readFile(LAST_FETCH_FILE, "utf8");
    obj = JSON.parse(data);
  } catch {}
  obj[`${category}_${mode}`] = value;
  await fs.writeFile(LAST_FETCH_FILE, JSON.stringify(obj, null, 2));
}

// HTML entity'lerini çözen fonksiyon
function decodeHtmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”");
}

// Fetch question details with answers from StackOverflow API (sadece çözümlü)
async function fetchQuestionDetails(questionId) {
  try {
    const response = await axios.get(`${SO_API_BASE}/questions/${questionId}`, {
      params: {
        site: "stackoverflow",
        filter: "withbody",
        sort: "votes",
      },
    });
    if (response.data.items.length === 0) return null;
    const question = response.data.items[0];
    // Sadece çözümlenmiş sorular
    if (!question.is_answered) return null;
    // Fetch answers
    const answersResponse = await axios.get(`${SO_API_BASE}/questions/${questionId}/answers`, {
      params: {
        site: "stackoverflow",
        filter: "withbody",
        sort: "votes",
        pagesize: 5,
      },
    });
    const answers = answersResponse.data.items.map((answer) => ({
      id: answer.answer_id,
      body: answer.body,
      score: answer.score,
      isAccepted: answer.is_accepted || false,
      author: answer.owner ? answer.owner.display_name : "Anonymous",
      creationDate: new Date(answer.creation_date * 1000).toISOString(),
    }));
    // En az bir kabul edilmiş cevap olmalı
    if (!answers.some((a) => a.isAccepted)) return null;
    return {
      id: question.question_id,
      title: decodeHtmlEntities(question.title),
      body: decodeHtmlEntities(question.body),
      score: question.score,
      viewCount: question.view_count,
      answerCount: question.answer_count,
      tags: question.tags,
      author: question.owner ? question.owner.display_name : "Anonymous",
      creationDate: new Date(question.creation_date * 1000).toISOString(),
      answers: answers.sort((a, b) => {
        if (a.isAccepted) return -1;
        if (b.isAccepted) return 1;
        return b.score - a.score;
      }),
    };
  } catch (error) {
    console.error(`Error fetching question details for ID ${questionId}:`, error.message);
    return null;
  }
}

// Clean HTML tags from text
function cleanHtml(html) {
  if (!html) return "";
  return html
    .replace(/<code[^>]*>([^<]*)<\/code>/g, "`$1`")
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, "\n```\n$1\n```\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}

// Gelişmiş süre hesaplama fonksiyonu
function calculateReadingTime(text, hasCode = false, codeContent = "") {
  if (!text && !codeContent) return 2;

  // Temel okuma parametreleri
  const wordsPerMinute = 200; // Biraz daha hızlı okuma
  const wordsPerSecond = wordsPerMinute / 60;

  // Metin analizi
  const wordCount = text ? text.trim().split(/\s+/).length : 0;
  let baseReadingTime = wordCount / wordsPerSecond;

  // Kod analizi
  let codeAnalysisTime = 0;
  if (hasCode && codeContent) {
    codeAnalysisTime = analyzeCodeComplexity(codeContent);
  }

  // Toplam süre
  let totalTime = baseReadingTime + codeAnalysisTime;

  // Minimum süreler (kısaltıldı)
  if (hasCode) {
    totalTime = Math.max(4, totalTime); // Kod varsa minimum 4 saniye
  } else {
    totalTime = Math.max(2, totalTime); // Sadece metin varsa minimum 2 saniye
  }

  // Maksimum süre sınırı (kısaltıldı)
  totalTime = Math.min(20, totalTime);

  return Math.round(totalTime);
}

// Kod karmaşıklığını analiz eden fonksiyon
function analyzeCodeComplexity(code) {
  if (!code) return 0;

  const lines = code.split("\n").filter((line) => line.trim() !== "");
  let complexityScore = 0;

  // Temel süre: satır başına 0.5 saniye (kısaltıldı)
  complexityScore += lines.length * 0.5;

  // Kod yapıları analizi (puanlar daha da kısaltıldı)
  const codeStructures = {
    // Kontrol yapıları (daha fazla düşünme gerektirir)
    if: 1.2,
    else: 0.8,
    for: 1.5,
    while: 1.5,
    switch: 1.5,
    case: 0.6,
    try: 1.2,
    catch: 1.2,
    finally: 0.8,

    // Fonksiyon tanımları
    function: 1.5,
    "=>": 1.2, // Arrow functions
    return: 0.6,

    // Nesne ve dizi işlemleri
    map: 1.2,
    filter: 1.2,
    reduce: 2,
    forEach: 0.8,
    find: 0.8,
    sort: 1.2,
    splice: 1.2,
    push: 0.4,
    pop: 0.4,

    // Async işlemler
    async: 1.2,
    await: 1.2,
    Promise: 1.5,
    then: 1.2,
    catch: 1.2,

    // DOM işlemleri
    document: 0.8,
    getElementById: 0.8,
    querySelector: 0.8,
    addEventListener: 1.2,

    // Regex ve string işlemleri
    match: 1.2,
    replace: 0.8,
    split: 0.6,
    join: 0.6,
    substring: 0.8,

    // Matematiksel işlemler
    "Math.": 0.8,
    parseInt: 0.6,
    parseFloat: 0.6,

    // Konsol ve debug
    "console.log": 0.2,
    "console.error": 0.2,
  };

  // Kod yapılarını say ve puan ekle
  for (const [structure, points] of Object.entries(codeStructures)) {
    const regex = new RegExp(structure.replace(".", "\\."), "gi");
    const matches = code.match(regex);
    if (matches) {
      complexityScore += matches.length * points;
    }
  }

  // Parantez derinliği analizi (nested yapılar) - daha da kısaltıldı
  let maxDepth = 0;
  let currentDepth = 0;
  for (const char of code) {
    if (char === "{" || char === "(" || char === "[") {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === "}" || char === ")" || char === "]") {
      currentDepth--;
    }
  }
  complexityScore += maxDepth * 0.8;

  // Uzun satırlar (80+ karakter) - daha da kısaltıldı
  const longLines = lines.filter((line) => line.length > 80).length;
  complexityScore += longLines * 0.6;

  // Yorum satırları (açıklama gerektirir) - daha da kısaltıldı
  const commentLines = lines.filter((line) => line.trim().startsWith("//") || line.includes("/*")).length;
  complexityScore += commentLines * 0.2;

  // String literal'lar (regex, template strings) - daha da kısaltıldı
  const stringComplexity =
    (code.match(/`[^`]*`/g) || []).length * 0.8 + // Template strings
    (code.match(/\/.*\//g) || []).length * 1.2 + // Regex
    (code.match(/"[^"]*"/g) || []).length * 0.1; // Normal strings
  complexityScore += stringComplexity;

  return complexityScore;
}

// Kod formatını düzelten gelişmiş fonksiyon
function formatCode(code) {
  if (!code) return "";

  // Satırları ayır
  let lines = code.split("\n");

  // Boş satırları temizle (başta ve sonda)
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  if (lines.length === 0) return "";

  // JavaScript kod formatı için akıllı indentasyon
  const formattedLines = [];
  let indentLevel = 0;
  const indentSize = 2; // 2 boşluk kullan

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === "") {
      formattedLines.push("");
      continue;
    }

    // Kapanış parantezleri için indent seviyesini azalt
    if (line.startsWith("}") || line.startsWith("]") || line.startsWith(")") || line.includes("} else {") || line.includes("} catch") || line.includes("} finally")) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Satırı indent ile ekle
    const indentedLine = " ".repeat(indentLevel * indentSize) + line;
    formattedLines.push(indentedLine);

    // Açılış parantezleri için indent seviyesini artır
    if (line.includes("{") && !line.includes("}")) {
      indentLevel++;
    }

    // Özel durumlar
    if (line.includes("} else {") || line.includes("} catch") || line.includes("} finally")) {
      indentLevel++;
    }

    // Array ve object açılışları
    if ((line.includes("[") && !line.includes("]")) || (line.includes("(") && !line.includes(")") && line.includes("function"))) {
      // Bu durumlar için indent artırma zaten yukarıda yapılıyor
    }
  }

  return formattedLines.join("\n");
}

// fetchRSSData fonksiyonu: son çekilen id'yi kategori+mod'a göre oku/kaydet
async function fetchRSSData(category, limit = 5, sortBy = "votes") {
  try {
    const url = RSS_FEEDS[category];
    if (!url) throw new Error("Invalid category");
    const apiUrl = `${SO_API_BASE}/questions`;
    let page = 1;
    let fetched = [];
    // Mevcut soruları yükle
    const existingQuestions = await loadQuestions();
    const existingIds = new Set(existingQuestions.map((q) => q.id));
    // Son çekilen id'yi kategori+mod'a göre al
    const lastFetched = await loadLastFetched(category, sortBy);
    let stop = false;
    while (fetched.length < limit && !stop) {
      const response = await axios.get(apiUrl, {
        params: {
          site: "stackoverflow",
          tagged: category,
          sort: sortBy,
          order: sortBy === "votes" ? "desc" : "desc",
          filter: "withbody",
          pagesize: 20,
          page,
        },
      });
      for (const item of response.data.items) {
        if (!item.is_answered) continue;
        if (lastFetched && item.question_id == lastFetched) {
          stop = true;
          break;
        }
        if (existingIds.has(item.question_id.toString())) continue;
        const details = await fetchQuestionDetails(item.question_id);
        if (!details) continue;
        const question = {
          id: item.question_id.toString(),
          stackoverflowId: item.question_id.toString(),
          title: decodeHtmlEntities(item.title),
          link: item.link,
          description: decodeHtmlEntities(item.title),
          pubDate: new Date(item.creation_date * 1000).toISOString(),
          category: category,
          fetchedAt: new Date().toISOString(),
          fullBody: cleanHtml(details.body),
          score: details.score,
          viewCount: details.viewCount,
          answerCount: details.answerCount,
          tags: details.tags,
          author: details.author,
          answers: details.answers.map((answer) => ({ ...answer, body: cleanHtml(decodeHtmlEntities(answer.body)) })),
          hasAcceptedAnswer: details.answers.some((a) => a.isAccepted),
        };
        fetched.push(question);
        if (fetched.length >= limit) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!response.data.has_more) break;
      page++;
    }
    // Son çekilen id'yi kategori+mod'a göre kaydet
    if (fetched.length > 0) {
      await saveLastFetched(category, sortBy, fetched[0].stackoverflowId);
    }
    return fetched;
  } catch (error) {
    console.error(`Error fetching RSS for ${category}:`, error);
    return [];
  }
}

// Routes
app.get("/", async (req, res) => {
  const questions = await loadQuestions();
  const categories = Object.keys(RSS_FEEDS);

  // İstatistikler
  const stats = {
    total: questions.length,
    withAnswers: questions.filter((q) => q.answers && q.answers.length > 0).length,
    withAcceptedAnswers: questions.filter((q) => q.hasAcceptedAnswer).length,
    categories: Object.keys(RSS_FEEDS).map((cat) => ({
      name: cat,
      count: questions.filter((q) => q.category === cat).length,
    })),
  };

  res.render("index", { questions, categories, stats });
});

app.post("/fetch/:category", async (req, res) => {
  const category = req.params.category;
  const limit = parseInt(req.body.limit) || 5;
  const sortBy = req.body.sortBy || "votes";

  if (!RSS_FEEDS[category]) {
    return res.status(400).json({ error: "Invalid category" });
  }

  try {
    const newQuestions = await fetchRSSData(category, limit, sortBy);
    const existingQuestions = await loadQuestions();
    const allQuestions = [...existingQuestions, ...newQuestions];
    await saveQuestions(allQuestions);
    res.json({
      success: true,
      newCount: newQuestions.length,
      totalCount: allQuestions.length,
      withAnswersCount: newQuestions.filter((q) => q.answers && q.answers.length > 0).length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/questions", async (req, res) => {
  const questions = await loadQuestions();
  const category = req.query.category;
  const hasAnswers = req.query.hasAnswers;
  const sortBy = req.query.sortBy || "fetchedAt";

  let filteredQuestions = questions;

  // Kategori filtresi
  if (category && category !== "all") {
    filteredQuestions = filteredQuestions.filter((q) => q.category === category);
  }

  // Cevap filtresi
  if (hasAnswers === "true") {
    filteredQuestions = filteredQuestions.filter((q) => q.answers && q.answers.length > 0);
  } else if (hasAnswers === "false") {
    filteredQuestions = filteredQuestions.filter((q) => !q.answers || q.answers.length === 0);
  }

  // Sıralama
  filteredQuestions.sort((a, b) => {
    switch (sortBy) {
      case "score":
        return (b.score || 0) - (a.score || 0);
      case "views":
        return (b.viewCount || 0) - (a.viewCount || 0);
      case "answers":
        return (b.answerCount || 0) - (a.answerCount || 0);
      case "date":
        return new Date(b.pubDate) - new Date(a.pubDate);
      default:
        return new Date(b.fetchedAt) - new Date(a.fetchedAt);
    }
  });

  res.render("questions", {
    questions: filteredQuestions,
    selectedCategory: category || "all",
    selectedHasAnswers: hasAnswers || "all",
    selectedSort: sortBy,
    categories: Object.keys(RSS_FEEDS),
    totalQuestions: questions.length,
  });
});

app.get("/question/:id", async (req, res) => {
  const questions = await loadQuestions();
  const question = questions.find((q) => q.id === req.params.id || q.stackoverflowId === req.params.id);

  if (!question) {
    return res.status(404).render("404");
  }

  res.render("question-detail", { question });
});

app.delete("/questions/:id", async (req, res) => {
  try {
    const questions = await loadQuestions();
    const filteredQuestions = questions.filter((q) => q.id !== req.params.id);
    await saveQuestions(filteredQuestions);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk operations
app.post("/questions/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    const questions = await loadQuestions();
    const filteredQuestions = questions.filter((q) => !ids.includes(q.id));
    await saveQuestions(filteredQuestions);
    res.json({ success: true, deletedCount: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export data
app.get("/export", async (req, res) => {
  try {
    const questions = await loadQuestions();
    res.setHeader("Content-Disposition", "attachment; filename=stackoverflow-questions.json");
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(questions, null, 2));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Video içerik oluşturma sayfası
app.get("/video-generator/:id", async (req, res) => {
  const questionId = req.params.id;
  const questions = await loadQuestions();
  const question = questions.find((q) => q.id == questionId);

  if (!question) {
    return res.status(404).send("Soru bulunamadı");
  }

  res.render("video-generator", { question });
});

// Video oluşturma sayfası için POST route (video verisini alır)
app.post("/video-creator/:id", async (req, res) => {
  const questionId = req.params.id;
  const videoData = req.body;
  const questions = await loadQuestions();
  const question = questions.find((q) => q.id == questionId);

  if (!question) {
    return res.status(404).send("Soru bulunamadı");
  }

  res.render("video-creator", { question, videoData });
});

// Video oluşturma sayfası (fallback)
app.get("/video-creator/:id", async (req, res) => {
  const questionId = req.params.id;
  const questions = await loadQuestions();
  const question = questions.find((q) => q.id == questionId);

  if (!question) {
    return res.status(404).send("Soru bulunamadı");
  }

  // Eğer video verisi yoksa generator'a yönlendir
  res.redirect(`/video-generator/${questionId}`);
});

// Video içerik oluşturma API
app.post("/generate-video-content", async (req, res) => {
  try {
    const { questionId, apiKey } = req.body;

    // Sabit API key kullan
    const geminiApiKey = "AIzaSyBtVpQaOiy9mcN06qPKsLXsrUdosVjEtnU";

    const questions = await loadQuestions();
    const question = questions.find((q) => q.id == questionId);

    if (!question) {
      return res.json({ success: false, error: "Soru bulunamadı" });
    }

    // Gemini AI ile içerik oluştur
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt oluştur
    const prompt = `
        Create YouTube video content for the following StackOverflow question and answer:

        QUESTION TITLE: ${question.title}
        CATEGORY: ${question.category}
        QUESTION CONTENT: ${question.fullBody || question.body || question.description}
        ACCEPTED ANSWER: ${question.answers && question.answers.length > 0 ? question.answers.find((a) => a.isAccepted)?.body || question.answers[0].body : "No answer found"}

        Please respond using the following format:

        VIDEO_TITLE: [English, SEO-friendly, searchable video title]
        DESCRIPTION: [Short SEO description including keywords from video title]
        KEYWORDS: [5 keywords of 1-3 words each, comma separated]
        STEPS:
        1. [Direct explanation as if teaching someone - explain what the problem is]
        2. [Show the solution with actual code - MUST include CODE_BLOCK with code]
        3. [Explain how the code works]
        ...

        IMPORTANT RULES:
        - Each step should be 1-2 sentences maximum
        - DO NOT give video creation tips or suggestions
        - Focus ONLY on explaining the programming concept/solution
        - ALWAYS include actual code examples using CODE_BLOCK format
        - Explain the solution step by step as if teaching directly to the viewer
        - Do not say "how to" - just explain what the code does
        - For EVERY step that involves code, include a CODE_BLOCK showing that specific part
        - Show code progression step by step - each step should have its own CODE_BLOCK if code changes
        - Break down complex solutions into multiple steps with individual code blocks

        MANDATORY:
        - Include multiple CODE_BLOCK sections showing the solution step by step
        - Each step that introduces new code or modifies existing code MUST have its own CODE_BLOCK
        - Show the complete working code at the end

        Example format for progressive code explanation:
        Step 1: First we create the basic structure.
        CODE_BLOCK:
        \`\`\`javascript
        const basicStructure = {};
        \`\`\`

        Step 2: Then we add the main functionality.
        CODE_BLOCK:
        \`\`\`javascript
        const basicStructure = {
          mainFunction: function() {
            return "result";
          }
        };
        \`\`\`
        `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Yanıtı parse et
    const videoContent = parseGeminiResponse(text);

    // Kod bloklarını işle ve carbon-now-cli ile görsel oluştur
    const processedSteps = await processCodeBlocks(videoContent.steps, questionId);

    // Toplam süreyi hesapla
    const totalDuration = processedSteps.reduce((total, step) => total + (step.duration || 0), 0);

    res.json({
      success: true,
      data: {
        title: videoContent.title,
        description: videoContent.description,
        keywords: videoContent.keywords,
        steps: processedSteps,
        estimatedDuration: totalDuration,
        estimatedDurationFormatted: `${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, "0")}`,
      },
    });
  } catch (error) {
    console.error("Video içerik oluşturma hatası:", error);
    res.json({ success: false, error: error.message });
  }
});

// Progress tracking için yeni endpoint
app.get("/generate-video-content-stream/:questionId", async (req, res) => {
  const questionId = req.params.questionId;
  const voiceCharacter = req.query.voice || "rachel"; // URL parametresinden ses karakterini al

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  function sendProgress(step, progress, message, data = null) {
    const progressData = {
      step,
      progress,
      message,
      data,
    };
    res.write(`data: ${JSON.stringify(progressData)}\n\n`);
  }

  try {
    // Sabit API key kullan
    const geminiApiKey = "AIzaSyBtVpQaOiy9mcN06qPKsLXsrUdosVjEtnU";

    const questions = await loadQuestions();
    const question = questions.find((q) => q.id == questionId);

    if (!question) {
      sendProgress(0, 0, "Soru bulunamadı", { error: true });
      res.end();
      return;
    }

    // Adım 1: AI ile içerik oluşturma
    sendProgress(0, 10, "AI ile içerik oluşturuluyor...");

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
        Create YouTube video content for the following StackOverflow question and answer:

        QUESTION TITLE: ${question.title}
        CATEGORY: ${question.category}
        QUESTION CONTENT: ${question.fullBody || question.body || question.description}
        ACCEPTED ANSWER: ${question.answers && question.answers.length > 0 ? question.answers.find((a) => a.isAccepted)?.body || question.answers[0].body : "No answer found"}

        Please respond using the following format:

        VIDEO_TITLE: [English, SEO-friendly, searchable video title]
        DESCRIPTION: [Short SEO description including keywords from video title]
        KEYWORDS: [5 keywords of 1-3 words each, comma separated]
        STEPS:
        1. [Direct explanation as if teaching someone - explain what the problem is]
        2. [Show the solution with actual code - MUST include CODE_BLOCK with code]
        3. [Explain how the code works]
        ...

        IMPORTANT RULES:
        - Each step should be 1-2 sentences maximum
        - DO NOT give video creation tips or suggestions
        - Focus ONLY on explaining the programming concept/solution
        - ALWAYS include actual code examples using CODE_BLOCK format
        - Explain the solution step by step as if teaching directly to the viewer
        - Do not say "how to" - just explain what the code does
        - For EVERY step that involves code, include a CODE_BLOCK showing that specific part
        - Show code progression step by step - each step should have its own CODE_BLOCK if code changes
        - Break down complex solutions into multiple steps with individual code blocks

        MANDATORY:
        - Include multiple CODE_BLOCK sections showing the solution step by step
        - Each step that introduces new code or modifies existing code MUST have its own CODE_BLOCK
        - Show the complete working code at the end

        Example format for progressive code explanation:
        Step 1: First we create the basic structure.
        CODE_BLOCK:
        \`\`\`javascript
        const basicStructure = {};
        \`\`\`

        Step 2: Then we add the main functionality.
        CODE_BLOCK:
        \`\`\`javascript
        const basicStructure = {
          mainFunction: function() {
            return "result";
          }
        };
        \`\`\`

        OUTRO: [Short closing statement about the solution, ask viewers to like and subscribe - maximum 1 sentence]
        `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Adım 2: Kod blokları analizi
    sendProgress(1, 30, "Kod blokları analiz ediliyor...");
    const videoContent = parseGeminiResponse(text);

    // Adım 3: Süre hesaplamaları
    sendProgress(2, 50, "Süre hesaplamaları yapılıyor...");

    // Adım 4: Video içeriği hazırlama
    sendProgress(3, 70, "Video içeriği hazırlanıyor...");

    // Adım 5: Kod resimleri oluşturma
    const processedSteps = await processCodeBlocksWithProgress(videoContent.steps, questionId, sendProgress);

    // Adım 6: TTS seslendirme oluşturma
    sendProgress(5, 85, "Seslendirme oluşturuluyor...");
    const voiceId = VOICE_CHARACTERS[voiceCharacter] || VOICE_CHARACTERS.brian; // Seçilen ses karakterini kullan (varsayılan Brian)
    const stepsWithTTS = await processStepsWithTTS(processedSteps, questionId, voiceId, sendProgress);

    // Adım 7: Thumbnail oluşturma
    sendProgress(6, 95, "Thumbnail oluşturuluyor...");
    const thumbnailPath = await createThumbnail(videoContent.title, question.category, questionId);

    // Toplam süreyi hesapla
    const totalDuration = stepsWithTTS.reduce((total, step) => total + (step.duration || 0), 0);

    // Tamamlandı
    sendProgress(7, 100, "Tamamlandı!", {
      success: true,
      data: {
        title: videoContent.title,
        description: videoContent.description,
        keywords: videoContent.keywords,
        steps: stepsWithTTS,
        thumbnail: thumbnailPath,
        estimatedDuration: totalDuration,
        estimatedDurationFormatted: `${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, "0")}`,
      },
    });

    res.end();
  } catch (error) {
    console.error("Video içerik oluşturma hatası:", error);
    sendProgress(0, 0, "Hata oluştu: " + error.message, { error: true });
    res.end();
  }
});

// Gemini yanıtını parse et
function parseGeminiResponse(text) {
  console.log("=== PARSING GEMINI RESPONSE ===");
  console.log("Raw response:", text);

  const lines = text.split("\n");
  let title = "";
  let description = "";
  let keywords = [];
  let steps = [];
  let currentSection = "";
  let currentStep = "";
  let collectingCodeBlock = false;
  let codeBlockContent = "";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    console.log(`Line ${i}: "${line}"`);

    if (line.startsWith("VIDEO_TITLE:")) {
      title = line.replace("VIDEO_TITLE:", "").trim();
      console.log("Found title:", title);
    } else if (line.startsWith("DESCRIPTION:")) {
      description = line.replace("DESCRIPTION:", "").trim();
      console.log("Found description:", description);
    } else if (line.startsWith("KEYWORDS:")) {
      const keywordText = line.replace("KEYWORDS:", "").trim();
      keywords = keywordText
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k);
      console.log("Found keywords:", keywords);
    } else if (line.startsWith("STEPS:")) {
      currentSection = "steps";
      console.log("Started steps section");
    } else if (line.startsWith("OUTRO:")) {
      // Önceki adımı kaydet
      if (currentStep) {
        const hasCode = currentStep.includes("CODE_BLOCK:");
        steps.push({ text: currentStep, hasCode: hasCode });
        console.log("Added step:", { text: currentStep, hasCode: hasCode });
        currentStep = "";
      }

      // OUTRO adımını ekle
      const outroText = line.replace("OUTRO:", "").trim();
      if (outroText && outroText.length > 0) {
        steps.push({ text: outroText, hasCode: false, isOutro: true });
        console.log("Added outro:", outroText);
      }
    } else if (currentSection === "steps") {
      // Adım numarası ile başlıyorsa
      if (line.match(/^\d+\./)) {
        // Önceki adımı kaydet
        if (currentStep && currentStep.trim().length > 0) {
          const hasCode = currentStep.includes("CODE_BLOCK:");
          steps.push({ text: currentStep, hasCode: hasCode });
          console.log("Added step:", { text: currentStep, hasCode: hasCode });
        }

        currentStep = line.replace(/^\d+\./, "").trim();
        console.log("Started new step:", currentStep);
      }
      // CODE_BLOCK başlangıcı
      else if (line.includes("CODE_BLOCK:")) {
        currentStep += "\nCODE_BLOCK:";
        collectingCodeBlock = true;
        console.log("Found CODE_BLOCK start");
      }
      // Kod bloğu içeriği
      else if (collectingCodeBlock) {
        currentStep += "\n" + line;
        if (line.includes("```") && !line.startsWith("```")) {
          collectingCodeBlock = false;
          console.log("CODE_BLOCK ended");
        }
      }
      // Normal adım devamı
      else if (line && !line.startsWith("```")) {
        currentStep += " " + line;
      }
    }
  }

  // Son adımı kaydet
  if (currentStep && currentStep.trim().length > 0) {
    const hasCode = currentStep.includes("CODE_BLOCK:");
    steps.push({ text: currentStep, hasCode: hasCode });
    console.log("Added final step:", { text: currentStep, hasCode: hasCode });
  }

  // Boş adımları filtrele
  steps = steps.filter((step) => step.text && step.text.trim().length > 0);

  console.log("=== PARSE RESULT ===");
  console.log("Title:", title);
  console.log("Description:", description);
  console.log("Keywords:", keywords);
  console.log("Steps count:", steps.length);
  steps.forEach((step, i) => {
    console.log(`Step ${i}:`, step);
  });

  return { title, description, keywords, steps };
}

// Kod bloklarını işle ve carbon-now-cli ile görsel oluştur (Progress tracking ile)
async function processCodeBlocksWithProgress(steps, questionId, sendProgress) {
  const execAsync = promisify(exec);
  const processedSteps = [];

  // Code images klasörü oluştur
  const codeImagesDir = path.join(__dirname, "public", "code-images");
  if (!fsSync.existsSync(codeImagesDir)) {
    fsSync.mkdirSync(codeImagesDir, { recursive: true });
  }

  // Kod bloğu olan adımları say
  const codeSteps = steps.filter((step) => step.hasCode && step.text.includes("CODE_BLOCK:"));
  const totalCodeBlocks = codeSteps.length;

  let processedCodeBlocks = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let processedStep = { text: step.text };

    console.log(`Processing step ${i}: hasCode=${step.hasCode}, includes CODE_BLOCK=${step.text.includes("CODE_BLOCK:")}`);

    if (step.hasCode && step.text.includes("CODE_BLOCK:")) {
      try {
        processedCodeBlocks++;

        // Progress güncelle
        const baseProgress = 80; // İlk 4 adım için %80
        const codeImageProgress = (processedCodeBlocks / totalCodeBlocks) * 15; // Kod resimleri için %15
        const totalProgress = Math.min(95, baseProgress + codeImageProgress);

        sendProgress(4, totalProgress, `Kod resimleri oluşturuluyor... (${processedCodeBlocks}/${totalCodeBlocks})`);

        console.log("Found code block, processing...");

        // Kod bloğunu çıkar - daha esnek regex
        const codeMatch = step.text.match(/CODE_BLOCK:\s*\n```[\w]*\n([\s\S]*?)\n```/);
        console.log(`Code match result:`, codeMatch);

        if (codeMatch) {
          let code = codeMatch[1];

          // Sadece baştaki ve sondaki boş satırları sil, satır içi boşluklara dokunma
          let codeLines = code.split("\n");
          while (codeLines.length > 0 && codeLines[0].trim() === "") codeLines.shift();
          while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === "") codeLines.pop();
          code = codeLines.join("\n");

          // Eğer kodun tamamı tek satırsa veya tüm satırlar aynı seviyede ise formatCode uygula, aksi halde olduğu gibi bırak
          const allLines = code.split("\n");
          const allIndents = allLines.map((l) => l.match(/^\s*/)[0].length);
          const uniqueIndents = new Set(allIndents);
          if (allLines.length === 1 || uniqueIndents.size === 1) {
            code = formatCode(code);
          }

          console.log(`Formatted code: ${code}`);

          const timestamp = Date.now();
          const fileName = `example.js`;
          const filePath = path.join(__dirname, "temp", fileName);

          // Temp klasörü oluştur
          const tempDir = path.join(__dirname, "temp");
          if (!fsSync.existsSync(tempDir)) {
            fsSync.mkdirSync(tempDir, { recursive: true });
            console.log(`Created temp directory: ${tempDir}`);
          }

          // Kodu dosyaya yaz
          fsSync.writeFileSync(filePath, code);
          console.log(`Code written to file: ${filePath}`);

          // Carbon-now-cli ile görsel oluştur - headless mod ile
          const imageName = `code_${questionId}_${i}_${timestamp}`;

          // Headless mod için carbon-now-cli komutunu düzelt
          const carbonCommand = `npx carbon-now "${filePath}" --theme "material" --background-color "transparent" --no-window-controls --headless`;

          console.log(`Running command: ${carbonCommand}`);
          const result = await execAsync(carbonCommand);
          console.log(`Carbon command result:`, result);

          // Ana dizinde oluşan dosyayı bul ve taşı
          const files = fsSync.readdirSync(__dirname);
          const generatedFile = files.find((file) => file.startsWith("example-") && file.endsWith(".png"));

          if (generatedFile) {
            const sourcePath = path.join(__dirname, generatedFile);
            const targetPath = path.join(codeImagesDir, `${imageName}.png`);

            // Dosyayı taşı
            fsSync.renameSync(sourcePath, targetPath);
            console.log(`Image moved from ${sourcePath} to ${targetPath}`);

            // Kod bloğunu metinden tamamen çıkar ve görsel referansı ekle
            processedStep.text = step.text.replace(/CODE_BLOCK:\s*\n```[\w]*\n[\s\S]*?\n```/g, "").trim();
            processedStep.codeImage = `/code-images/${imageName}.png`;

            console.log(`Code image path set: ${processedStep.codeImage}`);
          } else {
            console.error(`Generated image file not found in directory`);
            // Hata durumunda kod bloğunu temizle
            processedStep.text = step.text.replace(/CODE_BLOCK:\s*\n```[\w]*\n[\s\S]*?\n```/g, "").trim();
          }

          // Temp dosyayı sil
          if (fsSync.existsSync(filePath)) {
            fsSync.unlinkSync(filePath);
            console.log(`Temp file deleted: ${filePath}`);
          }
        } else {
          console.log("No code match found in step text");
        }
      } catch (error) {
        console.error("Kod görseli oluşturma hatası:", error);
        console.error("Error details:", error.message);
        console.error("Stack trace:", error.stack);
        // Hata durumunda kod bloğunu tamamen temizle
        processedStep.text = step.text.replace(/CODE_BLOCK:\s*\n```[\w]*\n[\s\S]*?\n```/g, "").trim();
      }
    }

    // Süre hesaplama
    const cleanText = processedStep.text.replace(/CODE_BLOCK:\s*\n```[\w]*\n[\s\S]*?\n```/g, "").trim();
    let codeContent = "";

    // Eğer kod varsa, kod içeriğini çıkar
    if (step.hasCode && step.text.includes("CODE_BLOCK:")) {
      const codeMatch = step.text.match(/CODE_BLOCK:\s*\n```[\w]*\n([\s\S]*?)\n```/);
      if (codeMatch) {
        codeContent = codeMatch[1];
      }
    }

    const duration = calculateReadingTime(cleanText, step.hasCode, codeContent);
    processedStep.duration = duration;

    console.log(`Step ${i} duration: ${duration} seconds (hasCode: ${step.hasCode}, textLength: ${cleanText.length}, codeLength: ${codeContent.length})`);

    processedSteps.push(processedStep);
  }

  return processedSteps;
}

// Static dosyalar için route
app.use("/code-images", express.static(path.join(__dirname, "public", "code-images")));
app.use("/thumbnails", express.static(path.join(__dirname, "public", "thumbnails")));
app.use("/audio", express.static(path.join(__dirname, "public", "audio")));

// Thumbnail oluşturma fonksiyonu
async function createThumbnail(title, category, questionId, variant = null) {
  try {
    const width = 1280;
    const height = 720;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Tema seç
    const theme = LANGUAGE_THEMES[category] || LANGUAGE_THEMES.default;

    // Random seçimler
    const selectedVariant = variant || DESIGN_VARIANTS[Math.floor(Math.random() * DESIGN_VARIANTS.length)];
    const colorPalette = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
    const layout = LAYOUT_VARIANTS[Math.floor(Math.random() * LAYOUT_VARIANTS.length)];
    const shapeVariant = SHAPE_VARIANTS[Math.floor(Math.random() * SHAPE_VARIANTS.length)];

    // Variant'a göre tasarım uygula
    switch (selectedVariant) {
      case "modern":
        await createModernDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant);
        break;
      case "gradient":
        await createGradientDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant);
        break;
      case "minimal":
        await createMinimalDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant);
        break;
      case "geometric":
        await createGeometricDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant);
        break;
      case "neon":
        await createNeonDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant);
        break;
      default:
        await createModernDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant);
    }

    // Icon ekle - Logo yükleme tamamen devre dışı bırakıldı (Canvas sorunları nedeniyle)
    addIconToCanvas(ctx, theme.icon, width, height, colorPalette.primary, selectedVariant, layout);

    // Dosyayı kaydet
    const thumbnailsDir = path.join(__dirname, "public", "thumbnails");
    if (!fsSync.existsSync(thumbnailsDir)) {
      fsSync.mkdirSync(thumbnailsDir, { recursive: true });
    }

    const fileName = `thumbnail_${questionId}_${selectedVariant}_${Date.now()}.png`;
    const filePath = path.join(thumbnailsDir, fileName);

    const buffer = canvas.toBuffer("image/png");
    fsSync.writeFileSync(filePath, buffer);

    return `/thumbnails/${fileName}`;
  } catch (error) {
    console.error("Thumbnail oluşturma hatası:", error);
    return null;
  }
}

// Modern tasarım
async function createModernDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant) {
  // Dinamik gradient arkaplan
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colorPalette.primary + "40");
  gradient.addColorStop(0.5, colorPalette.secondary + "30");
  gradient.addColorStop(1, colorPalette.accent + "20");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Şekil varyasyonlarına göre dekoratif elementler
  drawShapes(ctx, width, height, colorPalette, shapeVariant);

  addTitleAndBadge(ctx, title, category, theme, width, height, null, layout, colorPalette);
}

// Gradient tasarım
async function createGradientDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant) {
  // Çok renkli gradient arkaplan
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
  gradient.addColorStop(0, colorPalette.bg1 + "60");
  gradient.addColorStop(0.3, colorPalette.primary + "40");
  gradient.addColorStop(0.7, colorPalette.secondary + "30");
  gradient.addColorStop(1, colorPalette.bg2 + "20");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Dalga efekti - random parametreler
  const waveHeight = 30 + Math.random() * 40;
  const waveFreq = 0.005 + Math.random() * 0.01;

  ctx.fillStyle = colorPalette.accent + "40";
  ctx.beginPath();
  for (let x = 0; x <= width; x += 5) {
    const y = height - 100 + Math.sin(x * waveFreq) * waveHeight;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fill();

  addTitleAndBadge(ctx, title, category, theme, width, height, null, layout, colorPalette);
}

// Minimal tasarım
async function createMinimalDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant) {
  // Temiz arkaplan - random açık renkler
  const bgColors = ["#FFFFFF", "#F8F9FA", "#F1F3F4", colorPalette.bg1 + "10"];
  ctx.fillStyle = bgColors[Math.floor(Math.random() * bgColors.length)];
  ctx.fillRect(0, 0, width, height);

  // Random border style
  const borderStyles = ["solid", "dashed", "dotted"];
  const borderStyle = borderStyles[Math.floor(Math.random() * borderStyles.length)];

  ctx.strokeStyle = colorPalette.primary + "50";
  ctx.lineWidth = 6;

  if (borderStyle === "dashed") {
    ctx.setLineDash([20, 10]);
  } else if (borderStyle === "dotted") {
    ctx.setLineDash([5, 15]);
  }

  ctx.strokeRect(40, 40, width - 80, height - 80);
  ctx.setLineDash([]); // Reset

  // Random köşe aksentleri
  const accentSize = 80 + Math.random() * 40;
  ctx.fillStyle = colorPalette.accent;

  // Sol üst
  ctx.fillRect(40, 40, accentSize, 8);
  ctx.fillRect(40, 40, 8, accentSize);

  // Sağ alt
  ctx.fillRect(width - 40 - accentSize, height - 48, accentSize, 8);
  ctx.fillRect(width - 48, height - 40 - accentSize, 8, accentSize);

  addTitleAndBadge(ctx, title, category, theme, width, height, null, layout, colorPalette);
}

// Geometric tasarım
async function createGeometricDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant) {
  // Koyu arkaplan
  ctx.fillStyle = "#1A1A1A";
  ctx.fillRect(0, 0, width, height);

  // Random geometric şekiller
  drawRandomGeometricShapes(ctx, width, height, colorPalette);

  addTitleAndBadge(ctx, title, category, theme, width, height, null, layout, colorPalette);
}

// Neon tasarım
async function createNeonDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant) {
  // Siyah arkaplan
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // Random neon grid
  const gridSize = 30 + Math.random() * 40;
  ctx.strokeStyle = colorPalette.primary + "60";
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Neon glow effect - random renk
  const glowColors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];
  const glowColor = glowColors[Math.floor(Math.random() * glowColors.length)];

  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 60, width - 120, height - 120);
  ctx.shadowBlur = 0;

  addTitleAndBadge(ctx, title, category, theme, width, height, null, layout, colorPalette);
}

// Başlık ve badge ekleme fonksiyonu
function addTitleAndBadge(ctx, title, category, theme, width, height, defaultTextColor, layout, colorPalette) {
  // Başlığı temizle
  let cleanTitle = title
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Layout'a göre pozisyon hesapla
  let titleX, titleY, badgeX, badgeY;

  switch (layout) {
    case "centered":
      titleX = width / 2;
      titleY = height / 2 - 50;
      badgeX = width / 2;
      badgeY = height / 2 + 100;
      break;
    case "diagonal":
      titleX = 100;
      titleY = 150;
      badgeX = width - 200;
      badgeY = height - 100;
      break;
    case "corner":
      titleX = width - 600;
      titleY = height - 200;
      badgeX = width - 200;
      badgeY = 60;
      break;
    case "split":
      titleX = 60;
      titleY = height / 2 - 50;
      badgeX = width - 200;
      badgeY = height / 2 + 50;
      break;
    default: // left-aligned
      titleX = 60;
      titleY = 80;
      badgeX = 60;
      badgeY = height - 100;
  }

  // Arkaplan rengine göre metin rengini belirle
  const textColor = getTextColorForBackground(colorPalette.primary);

  // Başlık
  ctx.fillStyle = textColor;
  ctx.font = "bold 64px Arial, sans-serif";
  ctx.textAlign = layout === "centered" ? "center" : "left";
  ctx.textBaseline = "top";

  const maxWidth = layout === "centered" ? width - 200 : width - titleX - 120;
  const words = cleanTitle.split(" ");
  let lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine + (currentLine ? " " : "") + word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  if (lines.length > 3) {
    lines = lines.slice(0, 2);
    lines.push("...");
  }

  const lineHeight = 75;

  lines.forEach((line, index) => {
    ctx.fillText(line, titleX, titleY + index * lineHeight);
  });

  // Badge
  const badgeHeight = 50;
  const badgeText = category.toUpperCase();

  ctx.font = "bold 20px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const textMetrics = ctx.measureText(badgeText);
  const badgeWidth = textMetrics.width + 40;

  // Layout'a göre badge pozisyonu ayarla
  if (layout === "centered") {
    badgeX = badgeX - badgeWidth / 2;
  }

  const badgeGradient = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeWidth, badgeY + badgeHeight);
  badgeGradient.addColorStop(0, colorPalette.primary);
  badgeGradient.addColorStop(1, colorPalette.primary + "CC");
  ctx.fillStyle = badgeGradient;
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 25);
  ctx.fill();

  // Badge metni için uygun renk seç
  const badgeTextColor = getTextColorForBackground(colorPalette.primary);
  ctx.fillStyle = badgeTextColor;
  ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
}

// Logo ekleme fonksiyonu - Tamamen devre dışı bırakıldı
async function addLogoToCanvas(ctx, logoUrl, width, height, variant, layout) {
  // Canvas image loading sorunları nedeniyle logo yükleme devre dışı
  // Direkt icon fallback kullanılacak
  throw new Error("Logo loading disabled to avoid Canvas issues - using icon fallback");
}

// Renk parlaklığını hesaplayan fonksiyon
function getColorBrightness(hexColor) {
  try {
    // Hex rengi temizle ve normalize et
    let hex = hexColor
      .toString()
      .replace("#", "")
      .replace(/[^0-9A-Fa-f]/g, "");

    // Eğer 3 karakterse 6 karaktere çevir (örn: "abc" -> "aabbcc")
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    }

    // Eğer geçerli hex değilse varsayılan değer döndür
    if (hex.length !== 6) {
      return 128; // Orta parlaklık
    }

    const r = parseInt(hex.substr(0, 2), 16) || 0;
    const g = parseInt(hex.substr(2, 2), 16) || 0;
    const b = parseInt(hex.substr(4, 2), 16) || 0;

    // Parlaklık hesapla (0-255 arası)
    return (r * 299 + g * 587 + b * 114) / 1000;
  } catch (error) {
    console.log("Renk parlaklığı hesaplama hatası:", error.message);
    return 128; // Hata durumunda orta parlaklık döndür
  }
}

// Arkaplan rengine göre metin rengi belirle
function getTextColorForBackground(backgroundColor) {
  try {
    const brightness = getColorBrightness(backgroundColor);
    // Eğer arkaplan açıksa (>128) koyu metin, koyuysa açık metin
    return brightness > 128 ? "#2D3748" : "#FFFFFF";
  } catch (error) {
    console.log("Metin rengi belirleme hatası:", error.message);
    return "#FFFFFF"; // Hata durumunda beyaz döndür
  }
}

// Gelişmiş icon ekleme fonksiyonu
function addIconToCanvas(ctx, icon, width, height, color, variant, layout) {
  try {
    let iconSize, iconX, iconY;

    switch (layout) {
      case "centered":
        iconSize = "80px";
        iconX = width - 120;
        iconY = 120;
        break;
      case "diagonal":
        iconSize = "100px";
        iconX = width - 120;
        iconY = height - 60;
        break;
      case "corner":
        iconSize = "120px";
        iconX = 120;
        iconY = height - 60;
        break;
      case "split":
        iconSize = "90px";
        iconX = width - 120;
        iconY = height / 2;
        break;
      default:
        iconSize = "100px";
        iconX = width - 160;
        iconY = 250;
    }

    // Icon'u güvenli şekilde çiz
    ctx.save();

    // Gölge efekti ekle
    ctx.shadowColor = color + "40";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.font = iconSize + " Arial, sans-serif";
    ctx.fillStyle = color + "80"; // Biraz şeffaflık
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, iconX, iconY);

    ctx.restore();

    console.log(`Icon başarıyla eklendi: ${icon} at (${iconX}, ${iconY})`);
  } catch (error) {
    console.log("Icon ekleme hatası:", error.message);
    // Hata durumunda basit bir kare çiz
    try {
      ctx.save();
      ctx.fillStyle = color + "60";
      ctx.fillRect(width - 150, 200, 80, 80);
      ctx.restore();
    } catch (fallbackError) {
      console.log("Fallback icon da başarısız:", fallbackError.message);
    }
  }
}

// Hexagon çizme fonksiyonu
function drawHexagon(ctx, x, y, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Thumbnail yeniden oluşturma endpoint'i
app.post("/regenerate-thumbnail", async (req, res) => {
  try {
    // Request body kontrolü
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: "Request body is missing",
      });
    }

    const { questionId, title, category } = req.body;

    // Gerekli parametreleri kontrol et
    if (!questionId || !title || !category) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: questionId, title, category",
      });
    }

    console.log("Thumbnail yeniden oluşturuluyor:", { questionId, title, category });

    // Yeni thumbnail oluştur (random variant ile)
    const thumbnailPath = await createThumbnail(title, category, questionId);

    if (thumbnailPath) {
      console.log("Thumbnail başarıyla oluşturuldu:", thumbnailPath);
      res.json({
        success: true,
        thumbnail: thumbnailPath,
      });
    } else {
      console.error("Thumbnail oluşturulamadı");
      res.status(500).json({
        success: false,
        error: "Thumbnail oluşturulamadı",
      });
    }
  } catch (error) {
    console.error("Thumbnail yeniden oluşturma hatası:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

// Şekil çizme fonksiyonu
function drawShapes(ctx, width, height, colorPalette, shapeVariant) {
  switch (shapeVariant) {
    case "circles":
      drawRandomCircles(ctx, width, height, colorPalette);
      break;
    case "triangles":
      drawRandomTriangles(ctx, width, height, colorPalette);
      break;
    case "hexagons":
      drawRandomHexagons(ctx, width, height, colorPalette);
      break;
    case "waves":
      drawRandomWaves(ctx, width, height, colorPalette);
      break;
    case "geometric":
      drawRandomGeometricShapes(ctx, width, height, colorPalette);
      break;
    case "organic":
      drawOrganicShapes(ctx, width, height, colorPalette);
      break;
  }
}

// Random daireler
function drawRandomCircles(ctx, width, height, colorPalette) {
  const colors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];

  for (let i = 0; i < 5; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = 50 + Math.random() * 150;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const opacity = "20";

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color + "40");
    gradient.addColorStop(1, color + opacity);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Random üçgenler
function drawRandomTriangles(ctx, width, height, colorPalette) {
  const colors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];

  for (let i = 0; i < 6; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 60 + Math.random() * 120;
    const color = colors[Math.floor(Math.random() * colors.length)];

    ctx.fillStyle = color + "25";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size / 2, y + size * 0.866);
    ctx.closePath();
    ctx.fill();
  }
}

// Random hexagonlar
function drawRandomHexagons(ctx, width, height, colorPalette) {
  const colors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];

  for (let i = 0; i < 4; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 40 + Math.random() * 80;
    const color = colors[Math.floor(Math.random() * colors.length)];

    ctx.strokeStyle = color + "40";
    ctx.lineWidth = 3;
    drawHexagon(ctx, x, y, size);
  }
}

// Random dalgalar
function drawRandomWaves(ctx, width, height, colorPalette) {
  const colors = [colorPalette.bg1, colorPalette.bg2, colorPalette.accent];

  for (let i = 0; i < 3; i++) {
    const startY = (height / 4) * (i + 1);
    const amplitude = 20 + Math.random() * 40;
    const frequency = 0.01 + Math.random() * 0.02;
    const color = colors[i % colors.length];

    ctx.fillStyle = color + "30";
    ctx.beginPath();
    ctx.moveTo(0, startY);

    for (let x = 0; x <= width; x += 5) {
      const y = startY + Math.sin(x * frequency) * amplitude;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();
  }
}

// Random geometric şekiller
function drawRandomGeometricShapes(ctx, width, height, colorPalette) {
  const colors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];

  // Üçgenler
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 50 + Math.random() * 100;
    const color = colors[Math.floor(Math.random() * colors.length)];

    ctx.fillStyle = color + "25";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size / 2, y + size);
    ctx.closePath();
    ctx.fill();
  }

  // Dikdörtgenler
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const w = 80 + Math.random() * 120;
    const h = 40 + Math.random() * 80;
    const color = colors[Math.floor(Math.random() * colors.length)];

    ctx.fillStyle = color + "20";
    ctx.fillRect(x, y, w, h);
  }
}

// Organik şekiller
function drawOrganicShapes(ctx, width, height, colorPalette) {
  const colors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];

  for (let i = 0; i < 4; i++) {
    const centerX = Math.random() * width;
    const centerY = Math.random() * height;
    const color = colors[Math.floor(Math.random() * colors.length)];

    ctx.fillStyle = color + "25";
    ctx.beginPath();

    const points = 8;
    for (let j = 0; j < points; j++) {
      const angle = (j / points) * Math.PI * 2;
      const radius = 40 + Math.random() * 60;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();
  }
}

// ElevenLabs TTS entegrasyonu
const ELEVENLABS_API_KEY = "sk_eb003409e135b985acb687a3c21b8eb891a490f9ae97084f";
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

// Kaliteli ses karakterleri (ElevenLabs'dan seçilmiş sesler)
const VOICE_CHARACTERS = {
  brian: "nPczCjzI2devNBz1zQrb", // Erkek, Brian (özel)
  voice1: "eyuCA3LWMylRajljTeOo", // Ses 1
  voice2: "dMyQqiVXTU80dDl2eNK8", // Ses 2
  voice3: "YCkxryRNUmfOIgIS2y61", // Ses 3
  voice4: "h061KGyOtpLYDxcoi8E3", // Ses 4
  voice5: "kpiE5HkOcaC7zMRavpg1", // Ses 5
};

// TTS için metin temizleme fonksiyonu
function cleanTextForTTS(text) {
  const originalText = text;

  const cleanedText = text
    .replace(/CODE_BLOCK:[\s\S]*?```[\s\S]*?```/g, "") // Kod bloklarını kaldır
    .replace(/```[\s\S]*?```/g, "") // Markdown kod bloklarını kaldır
    .replace(/`([^`]+)`/g, (match, content) => {
      // Tek tırnak içindeki içeriği koru, sadece tırnakları kaldır
      return content;
    })
    // HTML tag'larını kaldır (açılış ve kapanış tag'ları)
    .replace(/<\/?[^>]+(>|$)/g, "") // Tüm HTML tag'larını kaldır
    .replace(/&lt;/g, "") // HTML entity'leri kaldır
    .replace(/&gt;/g, "")
    .replace(/&amp;/g, "and")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Kod yapılarındaki parantezleri temizle (fonksiyon çağrıları, metodlar)
    .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)/g, (match, funcName) => {
      // Fonksiyon adından sonra parantez içindeki parametreleri kaldır
      // Örnek: go(test) -> go test, is("test") -> is test
      const params = match.match(/\(([^)]*)\)/)[1];
      if (params.trim()) {
        // Parametreleri temizle ve fonksiyon adıyla birleştir
        const cleanParams = params
          .replace(/["']/g, "") // Tırnakları kaldır
          .replace(/,/g, " ") // Virgülleri boşlukla değiştir
          .trim();
        return cleanParams ? `${funcName} ${cleanParams}` : funcName;
      }
      return funcName;
    })
    // Markdown temizleme
    .replace(/\*\*(.*?)\*\*/g, "$1") // Bold markdown
    .replace(/\*(.*?)\*/g, "$1") // Italic markdown
    .replace(/\[.*?\]/g, "") // Köşeli parantezleri kaldır
    // Normal açıklayıcı parantezleri kaldır (kod yapıları temizlendikten sonra)
    .replace(/\s*\([^)]*\)\s*/g, " ") // Kalan parantezleri kaldır
    .replace(/[#*_]/g, "") // Markdown karakterleri
    // Boşluk ve satır temizleme
    .replace(/\s+/g, " ") // Çoklu boşlukları tek boşluğa çevir
    .replace(/\n+/g, ". ") // Satır sonlarını nokta ile değiştir
    .trim();

  console.log("TTS Metin Temizleme:");
  console.log("Orijinal:", originalText.substring(0, 150) + "...");
  console.log("Temizlenmiş:", cleanedText.substring(0, 150) + "...");

  return cleanedText;
}

// Google Cloud TTS için kaliteli İngilizce ses karakterleri
const GOOGLE_TTS_VOICES = {
  "en-US-Chirp3-HD-Aoede": { name: "en-US-Chirp3-HD-Aoede", label: "Chirp3 HD - Aoede (Female)", gender: "FEMALE" },
  "en-US-Chirp3-HD-Puck": { name: "en-US-Chirp3-HD-Puck", label: "Chirp3 HD - Puck (Male)", gender: "MALE" },
  "en-US-Chirp3-HD-Charon": { name: "en-US-Chirp3-HD-Charon", label: "Chirp3 HD - Charon (Male)", gender: "MALE" },
  "en-US-Chirp3-HD-Kore": { name: "en-US-Chirp3-HD-Kore", label: "Chirp3 HD - Kore (Female)", gender: "FEMALE" },
  "en-US-Chirp3-HD-Fenrir": { name: "en-US-Chirp3-HD-Fenrir", label: "Chirp3 HD - Fenrir (Male)", gender: "MALE" },
  "en-US-Chirp3-HD-Leda": { name: "en-US-Chirp3-HD-Leda", label: "Chirp3 HD - Leda (Female)", gender: "FEMALE" },
  "en-US-Chirp3-HD-Orus": { name: "en-US-Chirp3-HD-Orus", label: "Chirp3 HD - Orus (Male)", gender: "MALE" },
  "en-US-Chirp3-HD-Zephyr": { name: "en-US-Chirp3-HD-Zephyr", label: "Chirp3 HD - Zephyr (Female)", gender: "FEMALE" },
  "en-US-Neural2-J": { name: "en-US-Neural2-J", label: "English (US) - Neural2 J (Male)", gender: "MALE" },
  "en-US-Neural2-I": { name: "en-US-Neural2-I", label: "English (US) - Neural2 I (Female)", gender: "FEMALE" },
  "en-US-Wavenet-D": { name: "en-US-Wavenet-D", label: "English (US) - WaveNet D (Male)", gender: "MALE" },
  "en-US-Wavenet-F": { name: "en-US-Wavenet-F", label: "English (US) - WaveNet F (Female)", gender: "FEMALE" },
  "en-GB-Neural2-A": { name: "en-GB-Neural2-A", label: "English (UK) - Neural2 A (Male)", gender: "MALE" },
  "en-GB-Neural2-B": { name: "en-GB-Neural2-B", label: "English (UK) - Neural2 B (Female)", gender: "FEMALE" },
  "en-AU-Neural2-A": { name: "en-AU-Neural2-A", label: "English (AU) - Neural2 A (Male)", gender: "MALE" },
  "en-AU-Neural2-B": { name: "en-AU-Neural2-B", label: "English (AU) - Neural2 B (Female)", gender: "FEMALE" },
};

// Google Cloud TTS fonksiyonu (İngilizce, en iyi sesler)
async function generateTTS(text, voiceId = "en-US-Neural2-J", questionId, stepIndex) {
  try {
    const cleanText = cleanTextForTTS(text);
    if (!cleanText || cleanText.length < 3) {
      console.log("Metin çok kısa, TTS atlanıyor:", cleanText);
      return null;
    }

    // Voice seçimi
    const voice = GOOGLE_TTS_VOICES[voiceId] || GOOGLE_TTS_VOICES["en-US-Chirp3-HD-Aoede"];
    const languageCode = voice.name.split("-").slice(0, 2).join("-");
    // Gender belirleme (artık doğrudan voice.gender)
    let ssmlGender = voice.gender || "MALE";

    // Google Cloud TTS REST API endpoint
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`;
    const requestBody = {
      input: { text: cleanText },
      voice: {
        languageCode: languageCode,
        name: voice.name,
        ssmlGender: ssmlGender,
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    };

    const response = await axios.post(url, requestBody);
    const audioContent = response.data.audioContent;
    if (!audioContent) {
      console.error("Google TTS: audioContent yok");
      return null;
    }

    // Audio dosyasını kaydet
    const audioDir = path.join(__dirname, "public", "audio");
    if (!fsSync.existsSync(audioDir)) {
      fsSync.mkdirSync(audioDir, { recursive: true });
    }
    const fileName = `audio_${questionId}_step_${stepIndex}_${Date.now()}.mp3`;
    const filePath = path.join(audioDir, fileName);
    fsSync.writeFileSync(filePath, Buffer.from(audioContent, "base64"));
    console.log(`TTS başarıyla oluşturuldu: ${fileName}`);
    return `/audio/${fileName}`;
  } catch (error) {
    console.error("Google TTS oluşturma hatası:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
    return null;
  }
}

// Adımları TTS ile işleme fonksiyonu
async function processStepsWithTTS(steps, questionId, voiceId, sendProgress) {
  const processedSteps = [];
  let ttsEnabled = true; // TTS durumunu takip et

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Progress güncelle
    const ttsProgress = 85 + (i / steps.length) * 10; // %85-95 arası TTS için

    if (ttsEnabled) {
      sendProgress(5, ttsProgress, `Seslendirme oluşturuluyor... (${i + 1}/${steps.length})`);
    } else {
      sendProgress(5, ttsProgress, `İçerik hazırlanıyor... (${i + 1}/${steps.length})`);
    }

    let audioPath = null;

    // TTS oluştur (sadece etkinse)
    if (ttsEnabled) {
      audioPath = await generateTTS(step.text, voiceId, questionId, i);

      // İlk TTS hatası durumunda TTS'i devre dışı bırak
      if (audioPath === null && i === 0) {
        console.log("TTS devre dışı bırakılıyor - API limiti aşılmış olabilir");
        ttsEnabled = false;
      }
    }

    processedSteps.push({
      ...step,
      audioPath: audioPath,
    });

    // API rate limit için kısa bekleme (sadece TTS etkinse)
    if (ttsEnabled) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return processedSteps;
}

const GOOGLE_TTS_API_KEY = "AIzaSyBehe_uZ7eJPJcKk9cUaDCm6lT8UlbJwCw";
