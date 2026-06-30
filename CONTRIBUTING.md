# Glitch Code'a Katkı Sağlama

Teşekkürler! Glitch Code'a katkı sağlamak için bu rehberi takip et.

## Başlangıç

```bash
git clone https://github.com/glassesglitchstudio-lab/Gltich_code.git
cd Gltich_code
bun install
bun run dev
```

## Geliştirme Ortamı

- **Runtime**: Bun 1.3+
- **Dil**: TypeScript (Effect-TS pattern)
- **Test**: bun:test
- **Lint**: oxlint
- **Package Manager**: Bun workspaces

## Proje Yapısı

```
packages/
├── opencode/          # Ana CLI ve core kütüphane
│   ├── src/
│   │   ├── cli/cmd/   # CLI komutları
│   │   ├── agent/     # Agent sistemi
│   │   ├── session/   # Oturum yönetimi
│   │   ├── tool/      # Araçlar (bash, read, write, edit, vb.)
│   │   ├── provider/  # AI provider entegrasyonları
│   │   ├── memory/    # Hafıza sistemi
│   │   ├── skill/     # Skill sistemi
│   │   └── workflow/  # Workflow motoru
│   ├── test/          # Test dosyaları
│   └── script/        # Build scriptleri
├── desktop/           # Electron desktop uygulaması
├── app/               # Web UI (SolidJS)
└── console/           # Konsol arayüzü
```

## Kod Standartları

### Effect-TS Pattern
```typescript
// Doğru
const result = yield* Effect.gen(function* () {
  const svc = yield* Provider.Service
  const providers = yield* svc.list()
  return providers
})

// Yanlış
const providers = Provider.Service.list() // sync çağrı olmaz
```

### Error Handling
```typescript
// Doğru - Effect ile
const result = yield* Effect.tryPromise(() => fetch(url)).pipe(
  Effect.catchAll((err) => Effect.succeed(fallback))
)

// Yanlış
try { await fetch(url) } catch {} // hata yutuluyor
```

### İsimlendirme
- Dosyalar: `kebab-case` (örn: `plus-two-coder.ts`)
- Fonksiyonlar: `camelCase` (örn: `evaluateSolution`)
- Tipler: `PascalCase` (örn: `CoderOpinion`)
- Sabitler: `UPPER_SNAKE_CASE` (örn: `MAX_REVIEW_CYCLES`)

## Yeni Komut Ekleme

1. `packages/opencode/src/cli/cmd/` altına dosya oluştur
2. `cmd()` pattern'ini kullan
3. `index.ts`'e import ve `.command()` ekle
4. Test oluştur: `test/cli/cmd/<komut>.test.ts`

```typescript
import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"

export const MyCommand = cmd({
  command: "my-command",
  describe: "Komut açıklaması",
  builder: (yargs: Argv) => {
    return yargs.option("flag", { type: "string" })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      // Implementasyon
    })
  },
})
```

## Test Yazma

```typescript
import { describe, expect, test } from "bun:test"
import { myFunction } from "../../src/cli/cmd/my-module"

describe("myFunction", () => {
  test("normal input", () => {
    expect(myFunction("input")).toBe("expected")
  })

  test("edge case", () => {
    expect(myFunction("")).toBeNull()
  })
})
```

Testleri çalıştır:
```bash
bun test test/cli/cmd/my-module.test.ts
```

## Commit Mesaj Formatı

```
<type>: <açıklama>

<opsiyonel vücút>
```

Türler:
- `feat`: Yeni özellik
- `fix`: Hata düzeltmesi
- `refactor`: Kod yeniden yapılandırma
- `test`: Test ekleme/düzeltme
- `docs`: Dokümantasyon
- `chore`: Bakım işleri

Örnek:
```
feat: glitch bench komutu eklendi

Aynı prompt'u birden fazla modele çalıştırıp karşılaştıran
yeni komut eklendi.
```

## Pull Request Süreci

1. Fork oluştur
2. Branch oluştur: `git checkout -b feat/my-feature`
3. Değişiklikleri yap
4. Testleri çalıştır: `bun test`
5. Typecheck yap: `bun typecheck`
6. Commit at
7. Push yap: `git push origin feat/my-feature`
8. PR aç

### PR Kuralları
- Başlık açıklayıcı olsun
- Değişiklikleri özetle
- Test ekle (mümkünse)
- Typecheck ve lint geçmeli

## Sorun Bildirme

GitHub Issues'da bildirirken:
- Başlık: `[BUG] Kısa açıklama`
- Adımlar: Tekrar üretim adımları
- Beklenen: Ne bekleniyordu
- Gerçek: Ne oldu
- Ortam: OS, Node/Bun versiyonu

## Lisans

Katkılarınız MIT lisansı altında olacaktır.
