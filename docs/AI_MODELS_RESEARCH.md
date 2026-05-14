# Riset Model AI Terbaru (Kuartal 2, 2026)

Dokumen ini berisi rangkuman riset mengenai kapabilitas dan pilihan model Artificial Intelligence (AI) terbaru untuk integrasi di dalam platform WebView CRM. Mengingat perkembangan yang sangat pesat, kita terus memperbarui daftar model yang disematkan ke platform OpenRouter, OpenAI, dan Google Gemini.

## 1. OpenAI
- **GPT-4.5 Preview:** Model next-gen dari OpenAI yang lebih ringkas dan cerdas dibandingkan GPT-4o, dengan fokus pada pemahaman konteks panjang dan eksekusi instruksi yang sangat presisi. 
- **o1 & o3-mini (Reasoning Models):** Seri model dengan kapabilitas Chain-of-Thought secara bawaan, khusus dirancang untuk logika tingkat lanjut, matematika, dan pemrograman. o3-mini memberikan keseimbangan sempurna antara kecepatan dan hasil *reasoning*.
- **GPT-4o / GPT-4o Mini:** Opsi tercepat (omni) yang masih andal untuk tugas scraping data dan pemrosesan JSON harian.

## 2. Google Gemini
- **Gemini 3.1 Pro Preview:** Versi mutakhir dari seri Gemini yang memberikan lompatan besar dalam pemahaman sintaks JSON dan instruksi berlapis (multistep formatting), menjadikannya kandidat terbaik untuk AI Website Generator. 
- **Gemini 2.5 Pro / Flash:** Model standar tangguh dan efisien yang masih banyak digunakan untuk generasi konten yang minim latensi.

## 3. Anthropic (via OpenRouter)
- **Claude 3.5 Sonnet / Opus:** Claude 3.5 Sonnet tetap menjadi primadona di industri frontend development karena kemampuannya mendesain antarmuka UI/UX (termasuk Tailwind) dengan akurasi sangat tinggi.

## 4. Model Tiongkok & Open Source (via OpenRouter & Opencode)
- **Qwen 3.6 & Qwen 2.5 Coder 32B:** Seri Qwen (dari Alibaba) mendapat pembaruan agresif. Versi 3.6 (dan aliasnya) adalah salah satu model bahasa terbesar dan terkuat di ekosistem open-weights Tiongkok, bersaing langsung dalam kecepatan dan dukungan multi-bahasa.
- **Mimo 2.5:** Alternatif AI generatif baru yang optimal untuk copywriting instan dan adaptasi bahasa lokal (seperti Bahasa Indonesia kasual). Sangat bagus untuk landing page Niche spesifik.
- **Llama 3.1 405B:** Model kelas berat dari Meta yang setara dengan model flagship proprietary dalam hal pemahaman konteks umum. Sangat dapat diandalkan namun membutuhkan compute resource tinggi.

## Implementasi di Web Builder
Dalam file `AdminLeads.tsx`, kami telah memperbarui `select` provider untuk mencakup opsi:
- GPT-4.5 Preview & o1 
- Gemini 3.1 Pro Preview
- Qwen 3.6 & Mimo 2.5 (untuk kustom config)
Ini memberikan kontrol lebih luas terhadap *output* JSON saat "Generate Site".
