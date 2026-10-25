# AGENTS.md: Lyric Carousel Studio

Aturan tetap untuk semua agen coding di proyek ini. Baca seluruhnya sebelum menulis kode. Jika instruksi di chat bertentangan dengan file ini, ikuti chat, lalu sebutkan konfliknya.

## 1. Ringkasan Proyek

Web app generator carousel promosi lagu bergaya **editorial-sinematik**: elegan, minimalis, tidak norak. User memasukkan lirik, aplikasi membuat hook, caption, dan 4 slide (hook, verse, chorus, outro) yang bisa diedit penuh di kanvas dan diekspor sebagai PNG atau ZIP.

Tujuan utama: hasil terlihat seperti konten kurasi editorial, bukan iklan.

## 2. Tech Stack (jangan diganti tanpa izin)

- Vite + React + TypeScript (strict)
- react-konva + konva (kanvas, drag, resize, rotate)
- Zustand (state, dengan history stack untuk undo/redo)
- Tailwind CSS (hanya untuk UI editor, bukan isi kanvas)
- Express + TypeScript di `/server` (proxy LLM)
- jszip + file-saver (ekspor)
- Font: Cormorant Garamond (400, 500, italic 400/500) dan Montserrat (300, 400, 600, 700)

## 3. Perintah

```
npm install
npm run dev      # frontend + server
npm run build    # wajib lolos tanpa error sebelum menyatakan selesai
npm run lint
```

## 4. Struktur Folder

```
/server/index.ts, prompts.ts
/src/store/        editorStore.ts, templateStore.ts
/src/lib/          types.ts, defaultTemplate.ts, detectLanguage.ts,
                   extractPalette.ts, exportSlides.ts
/src/components/   Canvas, LayerPanel, PropertyPanel, InputPanel,
                   TemplatePanel, HookPicker, ExportDialog
/src/App.tsx
```

Jangan membuat folder atau file di luar struktur ini kecuali perlu. Jika perlu, jelaskan alasannya.

## 5. Design Tokens Default (WAJIB persis)

Kanvas internal **1200x1600** (3:4). Semua koordinat memakai ukuran ini; tampilan di layar hanya di-scale.

| Token | Nilai |
|---|---|
| Margin | 96px semua sisi |
| Latar | `#121212` + gradasi radial `rgba(90,50,35,0.25)` di pojok kanan atas + vignette |
| Teks utama | `#F5F0E8` (off-white, bukan putih murni) |
| Teks pendukung | `#B8B2A7` |
| Aksen (satu-satunya) | `#E07A5F` terracotta |

**Tipografi**
- Quote utama: Cormorant Garamond 400, 84-96px, line-height 1.1, rata kiri, lebar maks 1000px. Frasa kunci: *italic* + warna aksen. Markup `*frasa*`.
- Label header: Montserrat 700 KAPITAL 28px, letter-spacing 0.25em, warna aksen.
- Penanda slide (kanan atas): Montserrat 300 28px, letter-spacing 0.15em, abu-abu, format `01 // Reflection`, rata kanan.
- Paragraf pendukung: Montserrat 300, 34-36px, line-height 1.6, abu-abu.
- Footer: hairline 1px (opacity 0.2) di y=1405; teks kapital Montserrat 400 26px letter-spacing 0.2em di kiri; ikon panah aksen di kanan. Slide terakhir: ikon like dan simpan (SVG, bukan emoji).

**Layout:** header di y=96, konten rata kiri, banyak ruang kosong, maksimal 1 quote besar + 1 paragraf pendek per slide.

**Foto latar (opsional):** overlay gradient hitam dari bawah agar teks terbaca; slide outro boleh grayscale.

## 6. Aturan Anti-Norak (tidak boleh dilanggar)

- Hanya **satu** warna aksen dan maksimal **2** font family per carousel.
- Dilarang: emoji, stiker, outline teks tebal, drop shadow keras, gradient neon.
- Teks sedikit, ruang kosong banyak.
- Kontras teks terhadap latar minimal WCAG AA; tampilkan peringatan di UI jika rendah.
- UI editor ikut tema gelap yang tenang.

## 7. Aturan Bahasa (kritis)

- Bahasa hook dan caption **mengikuti bahasa input/pilihan user**. Lirik Inggris menghasilkan teks Inggris. **Dilarang menerjemahkan otomatis** ke Indonesia (atau sebaliknya).
- Satu carousel = satu bahasa, kecuali user memilih "campuran" secara eksplisit.
- Label struktur (`01 // Reflection`) mengikuti bahasa output.
- Opsi bahasa: Auto / Inggris / Indonesia / Lainnya. Mode Auto memakai `detectLanguage.ts`; user selalu bisa menimpa.
- Server wajib memvalidasi bahasa hasil LLM. Jika tidak cocok, panggil ulang maksimal 2 kali dengan instruksi koreksi.

## 8. Aturan Konten Hook dan Caption

- Hasilkan **5 variasi hook** dengan angle berbeda: pertanyaan memancing penasaran, pernyataan relatable, kontras/kejutan, baris lirik terkuat, konfesi pribadi. Maksimal 14 kata per hook.
- Struktur slide: hook, verse (build-up), chorus (payoff), outro (CTA halus). Tiap slide berakhir dengan dorongan untuk geser.
- **Dilarang** label "Kutipan lirik", "Lirik", "Quote", atau sejenisnya, di kode, prompt, UI, maupun hasil. Label header harus bertema editorial sesuai lagu (contoh: "Lyrical Notes", "Listen Close", "The Hardest Truth").
- Caption terasa seperti catatan pribadi yang relatable ("ini aku banget"), bukan iklan. Nama lagu dan artis disisipkan halus di footer atau slide terakhir.
- Maksimal 1-2 baris lirik asli per slide; sisanya parafrase atau refleksi.
- Batas panjang: quote maks 5 baris, paragraf pendukung maks 160 karakter. Teks harus auto-fit (kecilkan bertahap sampai 60%, lalu potong) agar tidak keluar margin.
- Output LLM hanya JSON valid sesuai skema; tanpa markdown.

## 9. Aturan Editor Kanvas

- Setiap elemen adalah **Layer** terpisah (`text`, `image`, `line`, `icon`) dengan `x, y, width, height, rotation, zIndex, locked, visible`.
- Drag, resize, rotate harus bekerja dengan **mouse dan sentuhan**. Area kanvas memakai `touch-action: none`.
- Snap guides ke margin 96px, tengah, dan tepi layer lain (toleransi 8px).
- Undo/redo minimal 50 langkah (Ctrl+Z, Ctrl+Shift+Z, tombol UI). Panah keyboard geser 1px, Shift = 10px.
- Layer bisa diduplikasi, dihapus, disembunyikan, dikunci, dan diurutkan.
- Ekspor harus identik dengan tampilan kanvas. Tunggu `document.fonts.ready` sebelum render dan ekspor. Guide safe-zone tidak ikut terekspor.

## 10. Aturan AI dan Keamanan

- API key **hanya** dibaca server dari `.env`. Jangan pernah dikirim ke browser, ditulis di kode, atau di-commit.
- Config OpenAI-compatible: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`; opsional `VISION_BASE_URL`, `VISION_API_KEY`, `VISION_MODEL`.
- Jangan berasumsi model mendukung gambar (DeepSeek API tidak). Analisis referensi dua lapis: warna dan pencahayaan diekstrak di klien tanpa model; analisis vision hanya jika `VISION_*` terisi.
- Jika LLM gagal atau tidak dikonfigurasi, UI tetap bisa dipakai secara manual dan menampilkan pesan error yang jelas.
- Sertakan `.env.example` dan pastikan `.env` ada di `.gitignore`.

## 11. Konvensi Kode

- TypeScript strict, tanpa `any` kecuali dengan komentar alasan.
- Komponen fungsional, satu komponen per file, nama file = nama komponen.
- State global hanya lewat Zustand; jangan prop-drilling lebih dari 2 tingkat.
- Konstanta desain di satu tempat (`defaultTemplate.ts`), jangan hardcode warna atau ukuran di komponen.
- Fungsi murni untuk logika (deteksi bahasa, palet, auto-fit) agar mudah diuji.
- Komentar singkat hanya untuk logika yang tidak jelas. Jangan tambah dependensi baru tanpa alasan yang disebutkan.

## 12. Cara Kerja Agen

1. Kerjakan **per fase**, jangan melompat dan jangan menambah fitur di luar spesifikasi.
2. Sebelum menulis kode di tiap fase, tampilkan daftar singkat file yang akan dibuat atau diubah.
3. Setelah tiap fase: jalankan `npm run build`, perbaiki semua error, lalu ringkas hasilnya dalam 3-5 baris.
4. Jika spesifikasi ambigu, pilih opsi paling sederhana yang sesuai aturan di atas, catat asumsinya, lalu lanjut. Jangan berhenti hanya untuk bertanya hal kecil.
5. Jangan menulis ulang file yang sudah berfungsi kecuali diminta. Ubah secukupnya.
6. Jika sebuah bagian terus gagal (misalnya analisis vision), laporkan, lewati, dan lanjut ke bagian lain.

## 13. Definisi Selesai

Laporkan satu per satu:

- [ ] `npm run build` tanpa error; `npm run dev` menjalankan frontend dan server
- [ ] README: cara install, isi `.env`, cara menjalankan
- [ ] Lirik Inggris menghasilkan hook dan caption Inggris
- [ ] Lirik Indonesia menghasilkan hook dan caption Indonesia
- [ ] Tidak ada teks "Kutipan lirik" di kode maupun hasil
- [ ] Semua layer bisa digeser (mouse dan sentuhan), di-resize, dirotasi, diedit, diduplikasi, dihapus, diurutkan
- [ ] Snap guides dan undo/redo berfungsi
- [ ] Unggah gambar referensi: palet dan pencahayaan terdeteksi, template tersimpan dan bisa dipakai ulang
- [ ] Ekspor PNG dan ZIP sesuai tampilan kanvas di rasio 3:4, 4:5, 9:16, 1:1
- [ ] Tampilan default mirip referensi: gelap, serif elegan, satu aksen terracotta, banyak ruang kosong
