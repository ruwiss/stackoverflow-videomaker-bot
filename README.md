# StackOverflow RSS Çekici

StackOverflow'dan belirli kategorilerdeki soruları RSS ile çeken ve JSON formatında saklayan Node.js web uygulaması.

## Özellikler

- 📥 **RSS Çekme**: JavaScript, Python, Node.js, React, Vue.js kategorilerinden sorular
- 💾 **Veri Saklama**: JSON formatında yerel dosya sisteminde
- 🔍 **Filtreleme**: Kategoriye göre soru filtreleme
- 🗑️ **Soru Silme**: İstenmeyen soruları silme
- 📱 **Responsive**: Mobil uyumlu Bootstrap arayüzü

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Uygulamayı başlatın:
```bash
npm start
```

3. Tarayıcıda `http://localhost:3000` adresini açın

## Geliştirme

Geliştirme modunda çalıştırmak için:
```bash
npm run dev
```

## Kullanım

1. Ana sayfada istediğiniz kategoriyi seçin
2. "Çek" butonuna tıklayarak o kategorideki soruları çekin
3. "Sorular" sayfasından çekilen soruları görüntüleyin
4. Kategori filtresi ile soruları filtreleyebilirsiniz
5. İstemediğiniz soruları silebilirsiniz

## Teknik Detaylar

- **Framework**: Express.js
- **Template Engine**: EJS
- **RSS Parser**: rss-parser
- **UI Framework**: Bootstrap 5
- **Veri**: JSON dosyası (`data/questions.json`)

## API Endpoints

- `GET /` - Ana sayfa
- `POST /fetch/:category` - Belirtilen kategoriden RSS çek
- `GET /questions` - Soruları listele
- `DELETE /questions/:id` - Soru sil
