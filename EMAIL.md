# Email Plan: Sendy + Amazon SES

Tanggal riset: 2026-06-07 WIB

## Keputusan Awal

Untuk 10.000 free-site reachout via email, gunakan Amazon SES sebagai delivery layer dan Sendy sebagai campaign/list UI di atas SES.

Alasan:

1. SES sangat murah untuk volume 10.000 email.
2. Sendy menyediakan UI campaign, subscriber list, unsubscribe, bounce handling, open/click reporting, dan API sederhana tanpa kita membangun ESP penuh dari nol.
3. WebView.click `/admin/reachout` tetap menjadi CRM/prospecting command center: pilih lead, generate tracked preview link, screenshot R2, dan catat status.

## Sendy

Sendy adalah self-hosted email newsletter app berbasis PHP/MySQL yang mengirim lewat Amazon SES. Harga lisensi yang terlihat di situs Sendy adalah one-time fee US$69, tanpa batas subscriber, dan klaim biaya 10.000 email via SES sekitar US$1.

Fitur relevan:

1. Campaign email via SES.
2. Subscriber lists dan custom fields.
3. API HTTP POST untuk subscribe/unsubscribe/delete subscriber/status/list/campaign.
4. Open/click tracking.
5. Bounce/complaint/unsubscribe handling jika SES feedback/webhook diset benar.

Peran Sendy dalam WebView.click:

1. Menyimpan list campaign seperti `free_site_10000`.
2. Menyimpan custom fields: `business_id`, `business_name`, `preview_url`, `screenshot_url`, `niche`, `source`, `wv_token`.
3. Mengirim campaign dari template pendek.
4. Menyediakan unsubscribe dan bounce suppression.

## Amazon SES

Catatan penting:

1. SES sandbox default hanya bisa kirim sampai 200 recipient per 24 jam dan 1 email/detik.
2. Di sandbox, recipient harus verified. Jadi sandbox tidak cukup untuk outreach ke business owner eksternal.
3. Harus request production access sebelum campaign real.
4. SES quota dihitung per recipient, bukan per message.
5. SES pricing official menyebut free tier 3.000 message charges per bulan selama 12 bulan untuk customer free tier eligible; setelah itu pay-as-you-go.

Setup wajib:

1. Verifikasi sending domain/subdomain.
2. DKIM aktif.
3. SPF/MAIL FROM rapi.
4. DMARC minimal `p=none` dulu, lalu naik setelah monitoring.
5. Request SES production access dengan penjelasan use case, opt-out, bounce/complaint handling, dan send ramp.
6. Jangan pakai domain utama untuk cold volume. Gunakan domain/subdomain outbound terpisah.

## Integrasi WebView.click

Tahap 1: manual-assisted

1. `/admin/reachout` memilih lead email-ready.
2. Admin membuat/copy tracked preview link.
3. Admin membuat/copy R2 screenshot URL.
4. Admin import CSV/custom fields ke Sendy.
5. Admin send campaign dari Sendy.
6. Admin mark sent di WebView.click sampai webhook/API sync dibuat.

Tahap 2: API sync

1. WebView.click push subscriber ke Sendy via API.
2. Custom fields dikirim:

```text
email
business_id
business_name
preview_url
screenshot_url
screenshot_size
niche
address
wv_token
```

3. WebView.click mencatat event `email_queued_sendy`.
4. Sendy campaign click URL tetap memakai tracked WebView.click URL.
5. Bounce/unsubscribe/complaint dari Sendy/SES disync balik ke `outreach_events` dan suppression list.

Tahap 3: provider adapter

Tambah adapter backend:

```text
sendySubscribe(listId, lead)
sendyCreateCampaign(template, segment)
sendySyncStatus(campaignId)
recordEmailEvent(providerEvent)
```

Jangan langsung membuat endpoint yang blast 10.000 email sekali klik. Tetap pakai throttle/batch.

## Copy Email Awal

```text
Subject: [business name]

hey, [business name] is this your site?

[preview_url]

If this is not useful, click unsubscribe or reply "no" and I will not follow up.
```

Screenshot besar sebaiknya tidak dilampirkan di batch awal. Pakai hosted R2 screenshot URL atau thumbnail/link supaya deliverability tidak jatuh.

## Ramp Plan

1. 50-100/day untuk domain baru.
2. Naik ke 200-300/day jika bounce rendah dan complaint mendekati 0.
3. Baru scale ke 500+/day setelah reply/click/conversion terbukti.
4. Stop/pause otomatis jika bounce >3%, complaint muncul, atau SES/Sendy menunjukkan reputasi turun.

## Sources

- Sendy official site: https://sendy.co/
- Sendy API: https://sendy.co/api
- Amazon SES pricing: https://aws.amazon.com/ses/pricing/
- Amazon SES quotas: https://docs.aws.amazon.com/ses/latest/dg/quotas.html
- Managing SES sending limits: https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html
