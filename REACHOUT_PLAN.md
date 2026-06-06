# WebView.click Reachout Plan

Tanggal riset: 2026-06-07 WIB

## Tujuan

Target utama: mengirim 10.000 website demo gratis ke business owner dan melacak conversion sampai paid setup/hosting/domain.

Pesan pembuka yang ingin dites:

```text
hey, [business name] is this your site?
```

Lampiran/preview: screenshot JPG full-page high-resolution dari situs demo, plus link preview yang bisa dibuka langsung.

Prinsip strategi: jangan terlihat seperti agency spam. Outreach harus terasa seperti pemberian aset nyata yang sudah dibuat untuk bisnis mereka, bukan pitch panjang. Optimasi utama adalah kualitas prospek, screenshot yang meyakinkan, dan follow-up yang sangat singkat.

## Ringkasan Prioritas

1. Cold email dulu untuk eksperimen gratis dan scale awal.
2. LinkedIn Sales Navigator sebagai channel manual bernilai tinggi, bukan automation bot.
3. Instagram dipakai untuk warm inbound/comment strategy, bukan cold DM API.
4. SMS jangan dijadikan channel cold massal untuk US sebelum ada consent/opt-in dan registrasi A2P 10DLC. Gunakan SMS hanya untuk owner yang sudah memberi nomor/izin, reply inbound, atau eksperimen kecil yang sudah lolos compliance review.
5. Bangun `/admin` sebagai command center: target 10.000, queue outreach, screenshot asset, status per channel, reply inbox, opt-out/suppression, dan attribution conversion.

## Integrasi `/admin` Saat Ini

Implementasi awal difokuskan ke email-first workflow:

1. Route baru: `/admin/reachout`.
2. Data source awal: `GET /api/leads` untuk CRM leads dan `GET /api/outreach/summary` untuk event outreach.
3. Target aktif: 10.000 email reachout ke lead yang punya email valid.
4. Link preview yang dicopy selalu membawa tracker:

```text
/:businessId?owner=1
  &wv_channel=email
  &wv_source=admin_reachout
  &wv_campaign=free_site_10000
  &wv_lead=:leadId
  &wv_token=free_site_10000:email::businessId
  &utm_source=webview_reachout
  &utm_medium=email
  &utm_campaign=free_site_10000
```

5. `POST /api/outreach/events` mencatat event `link_created` dan `email_sent_manual`.
6. `POST /api/leads/:businessId/ping?owner=1...` mencatat owner view ke `outreach_events` sebagai `owner_viewed`.
7. Manual send button di `/admin/reachout` mengupdate `leads.last_contacted`, menjaga status paid/viewed tidak diturunkan, dan menulis CRM activity.
8. Public `/:businessId` sekarang punya floating camera button bawah-tengah untuk full-page screenshot. Screenshot dicapture dari `[data-wv-site-canvas]`, dikompresi ke WebP, diupload ke `POST /api/sites/:businessId/screenshot`, disimpan di R2 pada `sites/:businessId/screenshots/`, lalu didownload ke browser.

Tahap ini sengaja belum mengirim email otomatis via provider. Tujuannya adalah memastikan lead quality, copy, tracking, screenshot, dan conversion attribution valid sebelum Sendy/Amazon SES sender diaktifkan.

Email provider direction sekarang pindah ke Sendy + Amazon SES. Detail setup, sandbox/production access, quota, custom fields, dan phased integration ada di `EMAIL.md`.

## Catatan Compliance Penting

Cold SMS ke target US adalah channel paling berisiko. Provider SMS besar mewajibkan A2P 10DLC untuk traffic aplikasi ke nomor US, termasuk brand/campaign, opt-in, opt-out, dan review. Twilio menjelaskan A2P 10DLC dibuat agar traffic US long-code terverifikasi dan consensual, dan review campaign bisa memakan waktu 10-15 hari. Trial Twilio juga hanya untuk testing terbatas, tidak untuk blast ke nomor tidak terverifikasi.

Cold email lebih realistis, tetapi tetap harus patuh CAN-SPAM: subject/header tidak menyesatkan, ada identitas pengirim, alamat fisik/postal valid, dan opt-out yang mudah.

LinkedIn melarang crawler, bot, browser plugin, atau third-party software yang mengotomasi aktivitas LinkedIn seperti scraping, connect, dan send/redirect messages. Jadi fitur WebView.click sebaiknya membantu persiapan dan tracking manual, bukan mengirim DM LinkedIn otomatis.

Instagram Messaging API tidak cocok untuk cold DM karena official private reply hanya bisa untuk orang yang komentar, hanya satu pesan, dalam 7 hari, dan percakapan 24 jam baru bisa lanjut jika orang tersebut membalas.

## Channel Gratis / Murah Dulu

### 1. Cold Email API

Ini channel terbaik untuk target 10.000 karena biaya awal bisa nol/rendah, bisa dilacak via webhook, dan bisa diintegrasikan ke Pages Functions.

Provider yang layak dites:

| Provider | Free tier/trial | API | Cocok untuk | Catatan |
|---|---:|---|---|---|
| Brevo | 300 email/hari, free plan tanpa time limit | Ya | Batch gratis awal, campaign + transactional | Bisa kirim 10.000 email dalam sekitar 34 hari pada free plan. Ada branding/limit. |
| Resend | 3.000 email/bulan free transactional; marketing free sampai 1.000 contacts/bulan menurut docs quota | Ya | Email personal/transactional-style dari app | Cocok untuk link demo individual, bukan campaign marketing berat. |
| SendGrid | 100 email/hari pada free plan/trial | Ya | Fallback API email | Lebih lambat untuk 10.000, tapi bagus untuk testing deliverability. |
| Mailgun | Trial/free sering berubah | Ya | Transactional fallback | Perlu cek ulang saat signup karena free offer berubah-ubah. |
| Amazon SES | Tidak benar-benar free untuk akun baru di luar kondisi AWS tertentu; sangat murah | Ya | Scale berbayar murah setelah validasi | Setup DNS, domain reputation, suppression, bounce handling harus rapi. |

Rekomendasi awal yang direvisi:

1. Pakai Sendy + Amazon SES untuk campaign utama setelah SES production access approved.
2. Gunakan Sendy untuk list, unsubscribe, custom fields, campaign UI, dan reporting.
3. Jangan kirim dari domain utama `webview.click` langsung untuk cold volume. Siapkan domain/subdomain outbound terpisah agar reputasi domain utama aman.
4. Limit awal: 50-100/hari/domain, naik perlahan jika bounce dan spam complaint rendah.
5. Wajib email verification sebelum send. Target bounce harus di bawah 3%, ideal di bawah 1%.

Format email awal:

```text
Subject: [business name]

hey, [business name] is this your site?

[screenshot image or preview thumbnail]

[demo link]

If this is not useful, reply "no" and I will not follow up.
```

Catatan: untuk deliverability, embedded image besar bisa berat. Lebih aman pakai thumbnail kecil + link ke JPG full-page dan link preview. Untuk owner yang membuka, halaman demo harus punya CTA download gratis dan paid setup yang jelas.

### 2. Manual LinkedIn Dengan Sales Navigator Trial

LinkedIn Sales Navigator resmi punya free trial untuk Core/Advanced jika akun eligible. Sales Navigator menyediakan 50 InMail/bulan untuk Core/Advanced/Advanced Plus. Harga Core yang terlihat di halaman resmi mulai US$119.99/bulan atau US$1,079.88/tahun, dan Advanced mulai US$159.99/bulan atau US$1,799.88/tahun.

Rencana gratis:

1. Ambil free trial Sales Navigator Core.
2. Pakai search filter untuk owner/founder/operator bisnis lokal bernilai tinggi.
3. Jangan pakai automation extension/bot.
4. Dari `/admin`, buat tombol `Copy LinkedIn DM`, `Open LinkedIn Profile`, dan `Mark Sent`.
5. Pakai InMail hanya untuk prospek high-value, bukan 10.000 massal.

DM LinkedIn:

```text
hey, [business name] is this your site?

[demo link]
```

Screenshot JPG tidak bisa selalu dilampirkan via InMail secara programmatic. Fitur admin harus menyediakan preview thumbnail dan link JPG supaya operator bisa manual attach/download bila UI LinkedIn mendukung.

### 3. Instagram Warm Strategy, Bukan Cold DM API

Official API tidak cocok untuk cold DM massal. Jalan gratis yang lebih aman:

1. Buat post/reel WebView.click yang menunjukkan demo situs lokal.
2. Komentar manual/engagement di akun bisnis yang relevan tanpa spam.
3. Jika owner komentar di post/reel kita, gunakan Instagram Private Replies API untuk satu private reply.
4. Jika owner DM duluan, baru gunakan API untuk reply dalam window yang diizinkan.

Fitur `/admin` yang relevan:

1. Track Instagram handle per lead.
2. Tombol `Open IG Profile`.
3. Template komentar manual singkat.
4. Webhook inbound DM/comment jika nanti app Meta sudah approved.

### 4. Free / Trial SMS Untuk Testing Saja

SMS provider punya trial, tapi bukan untuk cold blast:

| Provider | Free/trial | API | Catatan |
|---|---:|---|---|
| Twilio | Trial 30 hari; contoh docs menyebut 100 SMS, restricted ke nomor terverifikasi dan max 50/hari pada trial limitations | Ya | Tidak cocok untuk cold blast; US perlu Toll-Free verification/A2P. |
| Vonage | Trial credit 2 Euro untuk testing SMS API | Ya | Trial traffic via dashboard/testing; setelah active, 10DLC wajib untuk US. |
| Plivo | Signup free, trial credits, no credit card | Ya | Cocok dibandingkan Twilio untuk biaya setelah compliance siap. |
| ClickSend | 14-day free trial + free credit | Ya | Untuk US/Canada perlu dedicated number dan registration. |
| Textmagic | Free trial, full access, 0.5 credits; free texting number bulan pertama untuk USA/Canada/Australia/UK | Ya | Lebih cocok sebagai manual/business texting platform. |
| Sinch | Try free/free sandbox | Ya | Enterprise-grade, perlu setup number/service plan untuk production. |
| Telnyx | API SMS/MMS, harga mulai sekitar $0.004/message | Ya | Murah dan scalable, tetapi tetap perlu compliance US. |
| Bird/MessageBird | Start free, SMS + 10DLC fee page | Ya | Lebih cocok omnichannel/enterprise. |

Rekomendasi SMS:

1. Jangan jadikan SMS sebagai channel pertama untuk 10.000 cold US businesses.
2. Buat integrasi SMS provider-agnostic, tapi aktifkan hanya untuk `consent_status = opted_in` atau inbound replies.
3. Kalau ingin paid SMS test, mulai dengan 100-300 nomor yang sudah ada izin/relasi atau negara/market yang aturan SMS-nya sudah dicek.
4. Message wajib punya identitas dan opt-out:

```text
WebView.click: hey, [business name] is this your site? [short link]
Reply STOP to opt out.
```

## Channel Berbayar Setelah Validasi

### Email Outreach Tools

| Tool | Free/trial | Fungsi | Catatan |
|---|---:|---|---|
| Instantly | Free trial; help center menyebut 250 uploaded contacts + 1,000 emails untuk trial outreach | Cold email sequencing | Bagus untuk scale jika tidak ingin build semua sequence sendiri. |
| lemlist | 14-day free trial, 200 free credits, up to 50 emails/day selama trial | Personalization + multichannel | Bagus untuk test copy/image personalization. |
| Smartlead | 14-day free trial, no credit card | Cold email infra + inbox rotation | Cocok setelah domain/outbound strategy matang. |
| Woodpecker | 14-day trial atau 100 cold emails | Cold email + LinkedIn task flow | Cocok untuk workflow manual. |
| Apollo | Free plan untuk prospecting terbatas; API advanced tergantung paid plan | Lead database + email sequence | Cocok untuk menemukan owner emails, tapi data perlu diverifikasi. |

Rekomendasi: jangan langsung beli banyak tool. Jalankan 1.000 lead test dengan Brevo/Resend + admin tracking. Kalau reply rate bagus tapi operasional berat, baru pilih Instantly/Smartlead/lemlist.

### Done-For-You Outreach Services

Jasa layak dipertimbangkan setelah kita punya conversion proof:

| Service | Free/trial/pricing terlihat | Catatan |
|---|---:|---|
| CIENCE | Pricing page terlihat setup US$5,000 + monthly components mulai US$499 platform dan US$2,000/mo execution | Mahal, cocok setelah unit economics terbukti. |
| ColdGenius | Start free trial / book demo | AI cold email, done-for-you setup. Perlu audit kualitas list dan copy. |
| GhostSDR | 7 days free, klaim DFY outbound | Perlu cek kontrak dan channel yang dipakai. |
| Cold GTM | 30-day risk-free trial, LinkedIn lead gen DFY | Risiko ToS LinkedIn perlu ditanyakan eksplisit. |

Checklist sebelum beli jasa:

1. Minta sample 50-100 leads dan copy aktual.
2. Pastikan mereka tidak memakai bot LinkedIn yang melanggar ToS dari akun kita.
3. Pastikan data source legal dan bisa dihapus/opt-out.
4. Minta raw event export: sent, opened, clicked, replied, booked, bounced, unsubscribed.
5. Bayar untuk outcome terukur, bukan janji "meetings guaranteed" tanpa kualitas.

## Fitur `/admin` Yang Perlu Dibangun

### 1. Outreach Goal Dashboard

Tujuan: semua orang bisa melihat progres menuju 10.000 situs gratis.

Metrik:

1. `sites_generated`: jumlah demo siap outreach.
2. `screenshots_ready`: jumlah JPG full-page siap kirim.
3. `contacts_found`: email/phone/linkedin/instagram ditemukan.
4. `outreach_sent_total`: total sent.
5. `unique_businesses_reached`: dedupe by business/place.
6. `reply_count`, `positive_reply_count`, `claimed_count`.
7. `demo_views`, `download_clicks`, `paid_setup_clicks`, `paid_conversions`.
8. Conversion by stage: sent -> opened/clicked -> replied -> claimed -> paid.
9. Goal progress bar: 10.000 reached, target 5% paid conversion.

Status implementasi awal:

1. `/admin/reachout` menampilkan 10k progress, email-ready count, owner views, dan paid conversion.
2. Lead table memfilter `Ready`, `Sent`, `Viewed`, dan `Paid`.
3. Actions: copy first-touch email, copy tracked link, open tracked preview, mark manual email sent.
4. Plan viewer membuka isi `REACHOUT_PLAN.md` langsung dari admin.

### 2. Lead Contact & Consent Model

Tambah data model konseptual:

```text
lead_contacts
- id
- lead_id / place_id / business_id
- channel: email | sms | linkedin | instagram | phone | website_form
- value
- source: google_places | website_scrape | manual | apollo | hunter | import
- confidence
- consent_status: unknown | opted_in | legitimate_interest | opted_out | do_not_contact
- verification_status: unverified | valid | invalid | risky | bounced
- last_verified_at
- created_at
```

Untuk SMS, default harus `unknown` dan tidak eligible untuk send otomatis. Untuk email, bisa eligible jika valid dan tidak opted out, tetapi tetap throttle.

Status implementasi awal: email-ready masih memakai `leads.email` valid di CRM. Model `lead_contacts` belum dibuat supaya scope tetap ringan; bisa ditambahkan saat mulai enrichment email dari social/GBP/website scrape.

### 3. Outreach Queue

Queue per business, bukan per contact saja:

```text
outreach_queue
- id
- business_id
- site_id
- contact_id
- channel
- template_key
- status: queued | ready | sent | failed | skipped | replied | opted_out
- priority_score
- scheduled_at
- sent_at
- provider
- provider_message_id
- error_code
- error_message
- metadata_json
```

Priority score:

1. No website / weak website.
2. High-value niche.
3. Rating/review count high.
4. Has owner email or LinkedIn.
5. Demo quality score high.
6. Recently generated screenshot exists.

Status implementasi awal: queue belum menjadi table terpisah. `/admin/reachout` memakai filtered CRM list + `outreach_events` sebagai event log. Table `outreach_events` menyimpan `lead_id`, `business_id`, `channel`, `campaign`, `source`, `event_type`, `tracking_token`, `url`, `metadata_json`, dan `created_at`.

### 4. Screenshot Asset Pipeline

Fitur:

1. Generate full-page JPG high-res per site.
2. Simpan ke R2.
3. Buat thumbnail kecil untuk email.
4. Simpan `screenshot_url`, `thumbnail_url`, `generated_at`, `viewport`, `image_size`.
5. Tombol admin: regenerate screenshot, download JPG, copy image link.

Catatan deliverability: jangan attach JPG besar di email batch awal. Pakai hosted image/link. Attach manual hanya untuk LinkedIn/IG jika operator melakukannya satu per satu.

Update implementasi: format output screenshot sekarang WebP saja, bukan JPG, agar ukuran R2 lebih hemat. Hanya ada satu screenshot R2 aktif per `businessId`: `sites/:businessId/screenshots/:businessId-full-page.webp`. Jika screenshot sudah ada, tombol kamera menawarkan copy R2 URL, download existing, atau retake; retake menimpa file lama dan mencoba membersihkan screenshot timestamp lama di prefix yang sama. Untuk email batch awal tetap lebih aman kirim tracked link/thumbnail, bukan attachment besar.

### 5. Provider-Agnostic Outreach Layer

Jangan hardcode satu provider. Buat adapter:

```text
sendEmail(provider, payload)
sendSms(provider, payload)
recordWebhook(provider, event)
normalizeStatus(providerEvent)
```

Provider awal:

1. Email: Brevo, Resend.
2. SMS testing only: Twilio or Plivo.
3. Manual channels: LinkedIn/Instagram task logging.

### 6. Manual LinkedIn/Instagram Task Mode

Karena LinkedIn/Instagram automation berisiko, admin perlu task mode:

1. Button `Open Profile`.
2. Button `Copy Message`.
3. Button `Copy Demo Link`.
4. Button `Download Screenshot`.
5. Status buttons: `Sent`, `Replied`, `Not Owner`, `Interested`, `Do Not Contact`.
6. Daily manual quota tracker per operator.
7. Notes/reply classification.

### 7. Reply Inbox & Intent Classification

Inbound webhook email/SMS harus masuk satu inbox:

Status reply:

1. `owner_confirmed`
2. `interested`
3. `asks_price`
4. `wants_changes`
5. `not_owner`
6. `unsubscribe`
7. `angry/spam_complaint`

Automation:

1. Jika reply berisi unsubscribe/stop/no, set do-not-contact.
2. Jika owner confirmed/interested, buat follow-up task.
3. Jika asks price, tampilkan paid setup/domain/hosting offer.
4. Jika wants changes, masuk queue site revision.

### 8. Conversion Attribution

Setiap demo link harus punya token:

```text
https://webview.click/demo/[site]?r=[reachout_id]
```

Track:

1. First visit.
2. Repeat visit.
3. Screenshot click.
4. Download static zip.
5. Domain search.
6. Setup checkout click.
7. Paid conversion.

Ini penting untuk membuktikan apakah 5% conversion realistis per channel/niche/copy.

### 9. Safety & Suppression

Wajib:

1. Global do-not-contact list.
2. Per-channel unsubscribe.
3. Bounce suppression.
4. Duplicate business suppression.
5. Complaint flag.
6. Daily send cap.
7. Provider failure auto-pause.
8. Audit log untuk siapa yang mengirim apa dan kapan.

### 10. Experiment Board

A/B test yang perlu dilacak:

1. Email subject: `[business name]` vs `quick question about [business name]`.
2. Body: screenshot-first vs link-first.
3. CTA: "is this your site?" vs "made this for [business name]".
4. Niche: dentist, med spa, roofing, law, restaurant, HVAC, auto repair.
5. Lead type: no website vs bad website vs unclaimed/weak GBP.
6. Screenshot style: full homepage vs hero crop.

## 30-Day Execution Plan

### Week 1: Free Email Pilot

1. Add contact fields/status in admin.
2. Add screenshot JPG generation/storage if not already production-ready.
3. Integrate one email provider: Brevo or Resend.
4. Send 100-300 highly curated emails manually/semiautomated.
5. Track reply/click/download/setup clicks.

Success criteria:

1. Bounce under 3%.
2. Complaint near 0.
3. Click rate above 5%.
4. Positive reply above 1%.

### Week 2: Scale to 1.000

1. Add queue throttling.
2. Add reply inbox.
3. Add suppression.
4. Expand to 1.000 leads across 3-5 niches.
5. Compare copy variants.

### Week 3: Add LinkedIn Manual Lane

1. Start Sales Navigator free trial if eligible.
2. Target 50 high-value InMails/manual DMs.
3. Log every action in admin.
4. Compare reply quality vs email.

### Week 4: Decide Paid Scale

1. If email unit economics works, upgrade Brevo/Resend or test Smartlead/Instantly.
2. If LinkedIn reply quality is strong, keep it manual/high-value or evaluate DFY service carefully.
3. Do not scale SMS until consent and A2P strategy are solved.

## Provider Shortlist

Free/low-cost first:

1. Amazon SES sandbox/testing + Sendy setup; production access wajib sebelum cold outreach eksternal.
2. LinkedIn Sales Navigator trial: high-value manual outreach.
3. Instagram Private Replies: only after comments/inbound.
4. Twilio/Vonage/Plivo trial: SMS API testing, not cold blast.

Paid-after-validation:

1. Sendy license + SES production sending.
2. Apollo for lead/contact discovery, with verification.
3. Smartlead/Instantly/lemlist only if Sendy/SES workflow is operationally insufficient.
4. Plivo/Telnyx for SMS only after consent/A2P approval.
5. CIENCE/DFY only after WebView.click has proven conversion numbers.

## Sources

- Twilio trial account: https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account
- Twilio free trial limitations: https://help.twilio.com/hc/en-us/articles/360036052753-Twilio-Free-Trial-Limitations
- Twilio A2P 10DLC: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- Vonage SMS pricing: https://www.vonage.com/communications-apis/sms/pricing/
- Vonage 10DLC trial campaign: https://api.support.vonage.com/hc/en-us/articles/14841470272540-Understanding-the-10DLC-Trial-Campaign-in-SMS-API
- Plivo SMS: https://www.plivo.com/sms/overview/
- Plivo SMS pricing: https://www.plivo.com/sms/pricing/
- Telnyx SMS API: https://telnyx.com/products/sms-api
- Bird SMS fees: https://bird.com/en-us/pricing/sms/fees
- ClickSend free trial: https://help.clicksend.com/en/articles/67738-can-i-have-a-free-trial-to-see-if-it-works
- Textmagic free trial: https://support.textmagic.com/faq/what-is-included-in-textmagic-free-trial/
- Sinch SMS API: https://sinch.com/messaging/sms-api/send-sms/
- Brevo free plan limits: https://help.brevo.com/hc/en-us/articles/208580669-What-are-the-limits-of-the-Free-plans-
- Resend pricing: https://resend.com/docs/knowledge-base/what-is-resend-pricing
- Resend sending limits: https://resend.com/docs/knowledge-base/resend-sending-limits
- SendGrid pricing: https://sendgrid.com/en-us/pricing
- LinkedIn Sales Navigator pricing/trial: https://business.linkedin.com/sell/sales-navigator/compare-plans
- LinkedIn InMail FAQ: https://www.linkedin.com/help/sales-navigator/answer/a554514
- LinkedIn prohibited software/extensions: https://www.linkedin.com/help/recruiter/answer/a1341387
- Instagram Private Replies API: https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
- lemlist free trial: https://help.lemlist.com/en/articles/4941590-lemlist-free-trial-what-s-included-and-how-it-works
- Instantly free trial: https://help.instantly.ai/en/articles/13941298-instantly-free-trial
- Smartlead pricing: https://www.smartlead.ai/pricing
- Woodpecker pricing: https://woodpecker.co/pricing/
- Apollo API pricing: https://docs.apollo.io/docs/api-pricing
- CIENCE pricing: https://www.cience.com/pricing/
