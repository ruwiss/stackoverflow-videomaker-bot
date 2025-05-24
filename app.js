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
  mongodb: "https://stackoverflow.com/feeds/tag?tagnames=mongodb&sort=newest",
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

    // Toplam süreyi hesapla
    const totalDuration = processedSteps.reduce((total, step) => total + (step.duration || 0), 0);

    // Tamamlandı
    sendProgress(5, 100, "Tamamlandı!", {
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
    } else if (currentSection === "steps") {
      // Adım numarası ile başlıyorsa
      if (line.match(/^\d+\./)) {
        // Önceki adımı kaydet
        if (currentStep) {
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
  if (currentStep) {
    const hasCode = currentStep.includes("CODE_BLOCK:");
    steps.push({ text: currentStep, hasCode: hasCode });
    console.log("Added final step:", { text: currentStep, hasCode: hasCode });
  }

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

          // Kodu formatla
          code = formatCode(code);

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

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
