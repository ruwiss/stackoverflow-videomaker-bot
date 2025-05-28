const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

async function testCoquiTTS() {
  console.log("Coqui TTS test başlıyor...");

  const text = "Hello, this is a test of Coqui TTS.";
  const outputPath = path.join(__dirname, "public", "audio", "test_coqui.wav");

  // Audio klasörü oluştur
  const audioDir = path.join(__dirname, "public", "audio");
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  // Python script - Coqui TTS'in doğru import yolunu kullan
  const pythonScript = `
import sys
import os

try:
    # Önce hangi TTS paketinin yüklü olduğunu kontrol et
    try:
        # PyTorch güvenlik ayarını devre dışı bırak (weights_only=False)
        import torch

        # torch.load'ı monkey patch ile değiştir
        original_load = torch.load
        def patched_load(*args, **kwargs):
            kwargs['weights_only'] = False
            return original_load(*args, **kwargs)
        torch.load = patched_load

        from TTS.api import TTS
        print("TTS.api başarıyla import edildi")
    except ImportError as e:
        print(f"TTS.api import hatası: {e}")
        # Alternatif import yollarını dene
        try:
            import TTS
            print(f"TTS modülü bulundu: {TTS.__file__}")
            print(f"TTS içeriği: {dir(TTS)}")

            # TTS.tts modülünü kontrol et
            import TTS.tts
            print("TTS.tts modülü bulundu")

            # Mevcut dosyaları listele
            import os
            tts_path = os.path.join(TTS.__path__[0], 'tts')
            print(f"TTS.tts klasörü içeriği: {os.listdir(tts_path)}")

            raise ImportError("TTS.api bulunamadı")

        except Exception as e2:
            print(f"Alternatif import da başarısız: {e2}")
            raise

    # Model yükle
    print("Model yükleniyor: tts_models/multilingual/multi-dataset/xtts_v2")
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
    print("Model başarıyla yüklendi")

    # TTS oluştur
    text = "${text}"
    output_path = "${outputPath.replace(/\\/g, "/")}"

    print("TTS oluşturuluyor...")
    # XTTS v2 modeli için speaker_wav gerekli (voice cloning için)
    # Eğer speaker_wav yoksa, varsayılan bir ses kullan
    try:
        # Önce speaker_wav olmadan dene
        tts.tts_to_file(text=text, language="en", file_path=output_path)
    except ValueError as e:
        if "speaker" in str(e):
            print("Speaker gerekli, varsayılan ses ile deneniyor...")
            # Basit bir ses dosyası oluştur veya mevcut sesleri listele
            speakers = tts.speakers if hasattr(tts, 'speakers') and tts.speakers else None
            if speakers:
                print(f"Mevcut sesler: {speakers}")
                # İlk sesi kullan
                tts.tts_to_file(text=text, language="en", speaker=speakers[0], file_path=output_path)
            else:
                print("Hiç speaker bulunamadı, farklı model deneniyor...")
                # Farklı bir model dene
                tts2 = TTS("tts_models/en/ljspeech/tacotron2-DDC")
                tts2.tts_to_file(text=text, file_path=output_path)
        else:
            raise

    print(f"TTS başarıyla oluşturuldu: {output_path}")
    print("SUCCESS")

except Exception as e:
    import traceback
    print(f"Hata: {e}")
    print("Traceback:")
    traceback.print_exc()
    print("ERROR")
`;

  // Python script'i geçici dosyaya yaz
  const scriptPath = path.join(__dirname, "temp_test_tts.py");
  fs.writeFileSync(scriptPath, pythonScript);

  return new Promise((resolve, reject) => {
    console.log("Python script ile Coqui TTS test ediliyor...");
    console.log("Script path:", scriptPath);

    // Python script'i çalıştır
    const pythonProcess = spawn("python3.10", [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      console.log("STDOUT:", output);
    });

    pythonProcess.stderr.on("data", (data) => {
      const output = data.toString();
      stderr += output;
      console.log("STDERR:", output);
    });

    pythonProcess.on("close", (code) => {
      // Geçici script dosyasını sil
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {}

      console.log("Python process tamamlandı, exit code:", code);
      console.log("Full stdout:", stdout);
      console.log("Full stderr:", stderr);

      if (code === 0 && stdout.includes("SUCCESS") && fs.existsSync(outputPath)) {
        console.log("✅ Coqui TTS başarıyla çalıştı!");
        console.log("Dosya oluşturuldu:", outputPath);
        resolve(true);
      } else {
        console.log("❌ Coqui TTS başarısız oldu");
        resolve(false);
      }
    });

    pythonProcess.on("error", (error) => {
      console.error("Python process hatası:", error);
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {}
      resolve(false);
    });

    // 120 saniye timeout
    setTimeout(() => {
      pythonProcess.kill();
      console.error("Timeout - process öldürüldü");
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {}
      resolve(false);
    }, 120000);
  });
}

testCoquiTTS().then((result) => {
  console.log("Test sonucu:", result ? "BAŞARILI" : "BAŞARISIZ");
  process.exit(result ? 0 : 1);
});
