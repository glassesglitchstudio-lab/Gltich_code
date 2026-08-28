# 🚀 Elytra-ai & GlassesCat: Özel Model Sunucusuz Canlı Dağıtım Planı

Bu plan, **GlassesGlitchStudio** tarafından geliştirilen bağımsız, özel yapay zeka modellerinin (`.pt`, `.safetensors`, `.pth`) evde sunucu tutmaya gerek kalmadan, **0 TL maliyetle** 7/24 tüm dünyadan erişilebilir şekilde web sitesine bağlanmasını sağlar.

---

## 🎯 Hedef ve Mimari Genel Bakış

```
[ Ziyaretçi / Web Sitesi ]
  (GitHub Pages - docs/index.html)
              │
              │  1. Soru Gönderir (POST /chat)
              ▼
[ Hugging Face Spaces (Ücretsiz 7/24 Bulut Motoru) ]
  (FastAPI + PyTorch Runtime)
              │
              │  2. Kendi Modelin İleri Besleme Yapar (Forward Pass)
              ▼
[ GlassesCat Model Ağırlıkları (.pt / .safetensors) ]
              │
              │  3. Cevabı Geri Döndürür (JSON Streaming)
              ▼
[ Ziyaretçinin Ekranında Canlı Yanıt ]
```

---

## 📋 Faz 1: Model ve Tokenizer Hazırlığı

1. **Model Dosyalarını Paketleme:**
   * Kendi yazdığın model mimarisi (`model.py` / `GlassesCatModel`)
   * Model ağırlıkları (`glassescat_weights.pt` veya `model.safetensors`)
   * Tokenizer dosyası (`tokenizer.json` veya `vocab.txt`)

2. **Model Deposu Oluşturma:**
   * [HuggingFace.co](https://huggingface.co) üzerinde `glassesglitchstudio/glassescat-ai-core` adıyla ücretsiz bir model deposu oluşturulacak.
   * Model dosyaları `git lfs` veya web arayüzüyle yüklenecek.

---

## 📋 Faz 2: Hugging Face Spaces API Sunucusu Kurulumu

Hugging Face üzerinde **"New Space"** oluşturulacak (SDK: **Docker** veya **FastAPI** seçilecek).

### 1. `requirements.txt` (Gereksinimler):
```txt
fastapi>=0.110.0
uvicorn>=0.28.0
torch>=2.2.0
pydantic>=2.6.0
```

### 2. `app.py` (Model Yürütme Motoru):
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch

# 1. Kendi model sınıfını içe aktar
from model import GlassesCatModel, GlassesCatTokenizer

app = FastAPI(title="GlassesCat AI Engine")

# Web sitesinden gelen isteklere izin ver (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Modeli ve Tokenizer'ı RAM'e yükle (7/24 hazır bekler)
tokenizer = GlassesCatTokenizer.from_file("tokenizer.json")
model = GlassesCatModel()
model.load_state_dict(torch.load("glassescat_weights.pt", map_location="cpu"))
model.eval()

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    # Gelen soruyu token'lara çevir
    input_ids = tokenizer.encode(req.message)
    
    # Kendi modelinde ileri besleme çalıştır
    with torch.no_grad():
        output_ids = model.generate(input_ids, max_length=256)
    
    response_text = tokenizer.decode(output_ids)
    return {"reply": response_text}
```

---

## 📋 Faz 3: Web Sitesi Canlı Sohbet Entegrasyonu

`docs/index.html` web sitemizdeki sohbet paneline doğrudan bu API bağlanacak:

```javascript
async function sendToGlassesCat(userMessage) {
  const apiUrl = "https://senin-kullanici-adin-glassescat-api.hf.space/chat";
  
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userMessage })
  });

  const data = await response.json();
  return data.reply; // Modelin kendi ürettiği cevap ekrana yazılır
}
```

---

## 📋 Faz 4: Güvenlik, Hız ve Ölçekleme

* **CORS Güvenliği:** Yalnızca kendi GitHub Pages alan adımıza (`glassesglitchstudio-lab.github.io`) erişim izni verilecek.
* **Streaming (Kelime Kelime Yazma):** Cevapların tek seferde değil, kelime kelime ekrana akması için Server-Sent Events (SSE) eklenecek.
* **0 TL Garanti:** Hugging Face Spaces'in ücretsiz CPU tier'ı (16 GB RAM) sayesinde 7/24 kesintisiz ve sıfır maliyetle çalışacak.

---

## 📅 Takvim ve Uygulama Adımları

- [ ] **Adım 1:** Model dosyalarının (`.pt` / `safetensors`) ve `model.py` mimarisinin toparlanması.
- [ ] **Adım 2:** Hugging Face Space açılıp `app.py` API'sinin devreye alınması.
- [ ] **Adım 3:** `docs/index.html` web sitemize canlı sohbet kutusunun entegre edilmesi.
- [ ] **Adım 4:** Canlı testlerin yapılması ve dünyaya duyurulması.
