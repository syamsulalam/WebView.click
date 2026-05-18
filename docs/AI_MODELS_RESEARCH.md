# Riset Model AI dan Harga API

Terakhir dicek: 14 Mei 2026.

Harga di bawah adalah harga API publik dalam USD per 1 juta token, kecuali disebut lain. Untuk OpenRouter, angka dari API catalog memakai harga per-token, lalu dikonversi ke per 1 juta token agar mudah dibandingkan.

## Rekomendasi Default WebView.click

| Use case | Provider | Model ID | Harga input | Harga output | Catatan |
| --- | --- | --- | ---: | ---: | --- |
| Kualitas tertinggi | OpenAI | `gpt-5.5` | $5.00 | $30.00 | Pilihan kuat untuk instruksi kompleks dan output JSON panjang. |
| Balance kualitas/biaya | OpenAI | `gpt-5.4` | $2.50 | $15.00 | Lebih murah dari 5.5, tetap cocok untuk generator website. |
| Hemat tapi bagus | OpenAI | `gpt-5.4-mini` | $0.75 | $4.50 | Default hemat untuk batch lead/site kecil. |
| Multimodal Google terbaik | Gemini | `gemini-3.1-pro-preview` | $2.00 | $12.00 | Harga untuk prompt <= 200K token. |
| Gemini cepat | Gemini | `gemini-3-flash-preview` | $0.50 | $3.00 | Bagus untuk latency dan biaya. |
| Gemini termurah | Gemini | `gemini-3.1-flash-lite` | $0.25 | $1.50 | Cocok untuk volume tinggi dan transformasi JSON sederhana. |
| Router multi-model | OpenRouter | `~anthropic/claude-sonnet-latest` | $3.00 | $15.00 | Alias ke Claude Sonnet terbaru di OpenRouter. |
| Router flagship OpenAI | OpenRouter | `~openai/gpt-latest` | $5.00 | $30.00 | Alias OpenRouter untuk keluarga GPT terbaru. |
| Router Gemini Pro | OpenRouter | `~google/gemini-pro-latest` | $2.00 | $12.00 | Alias Gemini Pro terbaru. |
| Router Gemini Flash | OpenRouter | `~google/gemini-flash-latest` | $0.50 | $3.00 | Alias Gemini Flash terbaru. |
| Qwen kuat murah | OpenRouter | `qwen/qwen3.6-max-preview` | $1.04 | $6.24 | Frontier Qwen via OpenRouter. |
| Qwen cepat murah | OpenRouter | `qwen/qwen3.6-flash` | $0.25 | $1.50 | Opsi murah untuk web copy dan JSON. |
| Aggregator termurah | KIE.ai | `kie/gemini-2.5-flash` | N/A | N/A | Opsi KIE murah untuk rewrite copy; cek live credit KIE. |
| Aggregator murah | KIE.ai | `kie/gemini-3-flash` | est. $0.25 | est. $1.50 | Estimasi 50% dari official; cek dashboard KIE untuk credit aktual. |
| Aggregator GPT hemat | KIE.ai | `kie/gpt-5-4` | est. $1.25 | est. $7.50 | Lebih murah dari GPT-5.5 untuk copy enrichment. |
| Aggregator murah Pro | KIE.ai | `kie/gemini-3.1-pro` | est. $1.00 | est. $6.00 | Estimasi 50% dari official; cek dashboard KIE untuk credit aktual. |

## OpenAI

Sumber resmi OpenAI saat ini menempatkan GPT-5.5 sebagai model flagship, dengan GPT-5.4 dan GPT-5.4 mini sebagai opsi lebih murah.

| Model ID | Harga input | Cached input | Harga output | Catatan |
| --- | ---: | ---: | ---: | --- |
| `gpt-5.5` | $5.00 | $0.50 | $30.00 | Frontier untuk coding dan professional work. |
| `gpt-5.4` | $2.50 | $0.25 | $15.00 | Lebih affordable untuk pekerjaan kompleks. |
| `gpt-5.4-mini` | $0.75 | $0.075 | $4.50 | Mini model yang kuat untuk biaya lebih rendah. |
| `gpt-4.1` | $2.00 | $0.50 | $8.00 | Legacy non-reasoning yang masih berguna, tapi bukan default baru. |

Implementasi di aplikasi:
- `AdminLeads.tsx` sekarang memakai `gpt-5.5`, `gpt-5.4`, dan `gpt-5.4-mini`.
- Gunakan `gpt-5.4-mini` untuk default hemat, naik ke `gpt-5.4` atau `gpt-5.5` saat output JSON sering gagal valid.

## Google Gemini

Gemini API terbaru memiliki keluarga Gemini 3.1 dan Gemini 3. Untuk generator website, tiga opsi paling relevan:

| Model ID | Harga input | Harga output | Catatan |
| --- | ---: | ---: | --- |
| `gemini-3.1-pro-preview` | $2.00 | $12.00 | Harga standard untuk prompt <= 200K token. Prompt >200K naik menjadi $4 input / $18 output. |
| `gemini-3-flash-preview` | $0.50 | $3.00 | Cepat dan murah untuk mayoritas lead generation. |
| `gemini-3.1-flash-lite` | $0.25 | $1.50 | Paling hemat untuk volume tinggi. |

Catatan biaya Gemini:
- Batch/Flex bisa lebih murah pada beberapa model.
- Grounding Google Search/Maps punya kuota gratis bersama untuk Gemini 3 lalu biaya tambahan per 1.000 query.

## Anthropic via OpenRouter

App ini belum punya provider Anthropic langsung, jadi Claude dipakai lewat OpenRouter. Harga OpenRouter mengikuti katalog model/provider.

| Model ID | Harga input | Harga output | Catatan |
| --- | ---: | ---: | --- |
| `~anthropic/claude-sonnet-latest` | $3.00 | $15.00 | Alias Sonnet terbaru di OpenRouter. |
| `anthropic/claude-opus-4.7` | $5.00 | $25.00 | Flagship Anthropic; gunakan kalau butuh reasoning tinggi dan budget cukup. |
| `anthropic/claude-opus-4.7-fast` | $30.00 | $150.00 | Fast mode premium 6x; tidak cocok sebagai default app. |

Catatan resmi Anthropic:
- Claude Sonnet 4.6: $3 input / $15 output.
- Claude Opus 4.7: $5 input / $25 output.
- Claude Haiku 4.5: $1 input / $5 output.

## OpenRouter

OpenRouter cocok sebagai default operasional karena satu key bisa memilih Claude, OpenAI, Gemini, Qwen, dan model gratis. Pricing OpenRouter menyatakan harga model mengikuti katalog dan tidak markup provider, tetapi paket pay-as-you-go memiliki platform fee.

Model yang disarankan di UI:

| Model ID | Harga input | Harga output | Alasan |
| --- | ---: | ---: | --- |
| `~anthropic/claude-sonnet-latest` | $3.00 | $15.00 | Output desain/copy biasanya kuat. |
| `~openai/gpt-latest` | $5.00 | $30.00 | Alias flagship OpenAI via router. |
| `~google/gemini-pro-latest` | $2.00 | $12.00 | Google Pro terbaru via router. |
| `~google/gemini-flash-latest` | $0.50 | $3.00 | Default murah-cepat. |
| `qwen/qwen3.6-max-preview` | $1.04 | $6.24 | Qwen frontier murah untuk JSON dan copy. |
| `qwen/qwen3.6-flash` | $0.25 | $1.50 | Opsi murah untuk bulk. |

## KIE.ai

KIE.ai menyediakan marketplace API untuk model chat, image, video, dan music. Dokumentasi resminya menyatakan harga lengkap ada di `kie.ai/pricing`, harga biasanya 30%-50% lebih rendah dari API official, dan untuk beberapa model diskonnya bisa sampai 80%. Karena pricing detail per model dirender di dashboard/market dan bisa berubah mengikuti upstream provider, aplikasi memakai estimator konservatif berbasis diskon 50% untuk model yang kita tampilkan.

| Model UI | Endpoint KIE | Est. input | Est. output | Catatan |
| --- | --- | ---: | ---: | --- |
| `kie/gemini-2.5-flash` | `POST https://api.kie.ai/gemini-2.5-flash/v1/chat/completions` | N/A | N/A | Opsi murah untuk copy rewrite; harga final harus dicek di pricing dashboard KIE. |
| `kie/gemini-3-flash` | `POST https://api.kie.ai/gemini-3-flash/v1/chat/completions` | $0.25 | $1.50 | Estimasi 50% dari Gemini 3 Flash official. |
| `kie/gpt-5-4` | `POST https://api.kie.ai/codex/v1/responses` | $1.25 | $7.50 | Estimasi 50% dari GPT-5.4 official. Endpoint memakai Responses-style body. |
| `kie/gemini-3.1-pro` | `POST https://api.kie.ai/gemini-3.1-pro/v1/chat/completions` | $1.00 | $6.00 | Estimasi 50% dari Gemini 3.1 Pro official. |
| `kie/gpt-5-5` | `POST https://api.kie.ai/codex/v1/responses` | $2.50 | $15.00 | Estimasi 50% dari GPT-5.5 official. Endpoint memakai Responses-style body. |
| `kie/gpt-5-2` | `POST https://api.kie.ai/gpt-5-2/v1/chat/completions` | N/A | N/A | KIE docs menampilkan endpoint chat completions, tapi harga final harus dicek di pricing dashboard. |

Catatan operasional KIE:
- API key tetap harus disimpan di server/D1 sebagai `KIE_API_KEY`, jangan pernah di frontend.
- `/api/ai/readiness?remoteValidate=1` mengecek endpoint credit ringan KIE agar key/credit kosong terlihat sebelum generation. Ini tidak menjamin upstream model tidak 502, tetapi mencegah key/credit kosong terlihat sebagai "ready".
- Jangan tambahkan ID KIE yang belum ada dokumentasi endpointnya. `gpt-5.4-nano` dan `gemini-3.1-flash-lite` belum ditemukan sebagai endpoint KIE yang terdokumentasi saat audit ini, jadi belum dimasukkan.
- KIE docs menyebut generated media disimpan 14 hari dan download URL sementara 20 menit; untuk asset penting, simpan ulang ke R2.
- KIE docs menyebut stabilitas bisa sedikit lebih rendah dari official provider sebagai tradeoff harga.

## Opencode / Custom OpenAI-Compatible

Opencode di aplikasi ini adalah endpoint custom yang kompatibel dengan format OpenAI Chat Completions. Karena pricing tergantung gateway atau model yang dipasang, tidak ada harga universal yang bisa di-hardcode.

Rekomendasi konfigurasi:
- Simpan `OPENCODE_API_KEY`.
- Simpan `OPENCODE_BASE_URL` sebagai endpoint `/v1/chat/completions`.
- Gunakan model alias dari gateway, misalnya `opencode-default`, `qwen/qwen3.6-flash`, atau alias internal lain.
- Cek dashboard gateway untuk harga final sebelum dipakai production.

## Sumber

- OpenAI API pricing: https://openai.com/api/pricing/
- OpenAI models: https://developers.openai.com/api/docs/models
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing?hl=en
- Anthropic Claude pricing: https://platform.claude.com/docs/en/about-claude/pricing
- OpenRouter pricing: https://openrouter.ai/pricing
- OpenRouter model catalog API: https://openrouter.ai/api/v1/models
- KIE.ai getting started/pricing notes: https://kie.ai/getting-started
- KIE.ai API docs: https://docs.kie.ai/
- KIE.ai Gemini 2.5 Flash endpoint: https://docs.kie.ai/market/gemini/gemini-2-5-flash
- KIE.ai GPT-5.4 endpoint: https://docs.kie.ai/market/chat/gpt-5-4
- KIE.ai Gemini 3.1 Pro endpoint: https://docs.kie.ai/market/gemini/gemini-3-1-pro
- KIE.ai GPT-5.5 endpoint: https://docs.kie.ai/market/chat/gpt-5-5
