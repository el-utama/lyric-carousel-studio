# Lyric Carousel Studio

Generator carousel promosi lagu bergaya editorial-sinematik. Tempel materi lagu, pilih satu dari lima pembuka, lalu sunting empat slide di kanvas sebelum mengekspor PNG atau ZIP.

Kanvas master internal adalah **1200 × 1500 (4:5)** dengan margin 96 px, latar gelap, serif Cormorant Garamond, Montserrat untuk label, dan satu aksen. Default-nya terracotta; dua palet kurasi lain memakai ochre dan rose. Setiap rasio ekspor memakai artboard dan komposisi sendiri; tidak ada letterbox. Semua warna, ukuran, dan tata letak mengikuti token desain di `src/lib/defaultTemplate.ts`. Latar default memakai arah glow berbeda per peran slide—hook kanan atas, verse kiri, chorus kanan bawah, outro kiri bawah—tetap satu palet dan satu aksen.

Materi demo awal memakai **“Pernah Bahagia Bersama” — eL Utama**; judul dan artis bisa langsung diganti di panel kiri.

## Fitur

- Lima variasi hook dengan sudut berbeda: penasaran, relatable, kontras, baris terkuat, dan konfesi.
- Caption personal dan hashtag yang bisa disunting serta disalin.
- Empat slide dengan struktur hook, verse, chorus, dan outro.
- Editor kanvas: drag, resize, rotate, snap margin/tengah/tepi, layer panel, properti teks, undo/redo 50 langkah, dan pintasan keyboard.
- Bahasa keluaran mengikuti materi atau pilihan pengguna. Tidak ada terjemahan otomatis.
- Foto latar sendiri dengan auto scrim kontras, zoom, posisi, hitam putih, kecerahan, dan overlay manual.
- Tiga palet gelap kurasi—Editorial Sinematik, Ink & Ochre, Plum & Rose—dengan tipografi dan layout yang sama.
- Analisis referensi lokal untuk palet dan arah cahaya; analisis vision opsional bila model gambar dikonfigurasi.
- Simpan, muat, impor, dan ekspor template tema lewat `localStorage`.
- Ekspor PNG satu slide atau ZIP semua slide pada rasio 4:5 (default), 9:16 TikTok dengan safe zone, 3:4, dan 1:1.
- Tata letak teks utama dan paragraf mengikuti tinggi teks aktual, bukan slot kosong tetap, sehingga ruang vertikal lebih seimbang.

## Tech Stack

Vite, React, TypeScript strict, react-konva/Konva, Zustand, Tailwind CSS, Express, JSZip, dan file-saver. Font dimuat dari Google Fonts.

## Instalasi

```bash
npm install
```

Salin `.env.example` menjadi `.env`, lalu isi kredensial model. Jangan commit `.env`.

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini

# Opsional, untuk membaca nuansa gambar referensi.
VISION_BASE_URL=
VISION_API_KEY=
VISION_MODEL=

PORT=8787
```

`LLM_*` memakai API yang kompatibel dengan OpenAI Chat Completions. Kunci hanya dibaca oleh server Express dan tidak pernah dikirim ke browser. `VISION_*` boleh dibiarkan kosong: analisis warna dan pencahayaan tetap berjalan lokal di klien.

## Menjalankan

```bash
npm run dev      # frontend http://localhost:5173 + API http://localhost:8787
npm run build    # cek TypeScript dan build produksi
npm run preview  # pratinjau hasil build
```

### Akses dari PC lain melalui Tailscale

Di Windows, cukup double-klik:

- **`start-app.bat`** — menjalankan frontend + API, lalu otomatis mengaktifkan `tailscale serve` dan menampilkan URL tailnet.
- **`stop-app.bat`** — mematikan app dan Tailscale Serve di port yang dipakai.

URL tailnet memakai HTTPS di port **8443**, misalnya `https://nama-pc.tailnet-anda.ts.net:8443`. Port 443 tidak dipakai agar tidak bentrok dengan layanan Tailscale lain. URL hanya bisa dibuka dari perangkat yang login ke tailnet yang sama.

Server lokal tetap berjalan di `http://localhost:5173`, dan request `/api` diteruskan ke Express di `localhost:8787` oleh proxy Vite. Tailscale tidak perlu diatur manual selama aplikasi Tailscale sudah terpasang, login, dan berstatus terhubung.

Jika LLM belum dikonfigurasi atau gagal, editor dan ekspor tetap bisa dipakai secara manual. Pesan kesalahan ditampilkan di panel materi.

## Alur Pemakaian

1. Isi judul, artis, dan materi lagu di panel kiri.
2. Pilih bahasa: Auto, English, Bahasa Indonesia, Campuran EN–ID, atau Lainnya. Mode Auto membaca materi dan tetap bisa ditimpa.
3. Pilih platform, lalu tekan **Buat carousel**.
4. Pilih salah satu dari lima pembuka di bawah kanvas. Setiap pembuka bisa dibuat ulang sendiri.
5. Sunting slide di kanvas. Klik layer untuk mengubah teks, warna, ukuran, dan posisi. Gunakan `*frasa*` untuk italic beraksen.
6. Buka tab **Foto** untuk memasang latar foto dan menerapkannya ke semua slide. Auto scrim menjaga kontras teks; overlay manual bisa ditambah bila perlu.
7. Buka tab **Referensi** untuk memilih palet kurasi, membaca palet/cahaya dari gambar acuan, atau memakai template tersimpan.
8. Tekan **Ekspor** di header, pilih rasio dan format, lalu unduh.

## Bahasa

- Materi berbahasa Inggris menghasilkan hook, caption, dan label berbahasa Inggris.
- Materi berbahasa Indonesia menghasilkan keluaran berbahasa Indonesia.
- Mode **Campuran EN–ID** menghasilkan code-switching natural: Inggris untuk emosi pendek, Indonesia untuk konteks, tanpa terjemahan kata per kata.
- Satu carousel memakai satu bahasa kecuali pengguna memilih bahasa lain secara eksplisit.
- Server memeriksa bahasa hasil model. Jika tidak cocok, server meminta koreksi maksimal dua kali sebelum menampilkan kesalahan.
- Nama lagu dan artis tetap ditampilkan di footer slide terakhir.

## Foto Latar

Foto disimpan sebagai data URL di sesi editor, bukan di server. Pengaturan yang tersedia:

- **Zoom** memperbesar crop cover.
- **Geser X/Y** menggeser crop dalam batas aman.
- **Hitam putih** dan **Terang** dipanggang ke kanvas agar tampilan editor dan hasil ekspor sama.
- **Auto scrim** membaca kecerahan foto (persentil 95) lalu menambahkan kegelapan minimum agar teks off-white dan muted tetap memenuhi kontras WCAG AA. Scrim ini dipakai di editor dan ekspor.
- **Overlay manual** menambahkan gelap dari atas dan bawah. Nilai ini bersifat tambahan, jadi menurunkannya tidak mematikan auto scrim.

Kontrol foto ada di tab **Foto**. Tombol **Terapkan ke semua slide** menyalin foto dan pengaturannya, tetapi tidak menghapus teks atau layer lain.

## Referensi dan Template

Tab **Referensi** menerima 1–8 gambar. Palet dan pencahayaan diekstrak di klien tanpa model. Jika `VISION_*` terisi, tombol vision akan membaca nuansa gambar lewat `/api/analyze` dan hasilnya bisa disunting sebelum diterapkan.

Di bagian atas tab yang sama, tiga **palet kurasi** bisa diterapkan ke seluruh carousel. Semua mempertahankan latar gelap, tipografi, layout, dan aturan satu aksen; yang berubah hanya warna dasar, teks, dan aksen. Penerapan palet masuk ke riwayat undo.

Tema yang diterapkan menyimpan warna kanvas dan catatan cahaya. Template bisa disimpan di peramban, diekspor sebagai JSON, dan diimpor kembali. Template tidak menyimpan foto pengguna.

## Ekspor

Ekspor memakai stage Konva terpisah pada `pixelRatio: 2`, sehingga guide snap, selection handle, dan transformer tidak ikut tergambar. Setiap rasio dirender langsung pada artboard-nya sendiri. Dialog ekspor menampilkan pratinjau hasil render untuk rasio terpilih; pratinjau memakai resolusi lebih rendah, sedangkan berkas akhir tetap 2×. Nama berkas selalu menyertakan rasio, misalnya `lyric-carousel-9x16-01.png`; entri di dalam ZIP memakai pola yang sama agar tidak tertukar saat diunggah.

| Rasio | Artboard internal | Ukuran akhir | Catatan |
| --- | --- | --- | --- |
| 4:5 | 1200 × 1500 | 2400 × 3000 | Default, aman untuk feed dan iklan Instagram |
| 9:16 | 1080 × 1920 | 2160 × 3840 | TikTok/Reels; atas 15%, bawah 25%, dan tepi kanan 8% dijaga kosong |
| 3:4 | 1200 × 1600 | 2400 × 3200 | Feed potret native Instagram |
| 1:1 | 1200 × 1200 | 2400 × 2400 | Format kotak |

Tidak ada bidang latar tambahan atau karya yang diperkecil untuk mengejar rasio. Layer teks semantik (header, teks utama, body, footer) ditata ulang per rasio; foto latar full-bleed diperluas agar tetap menutup kanvas. Pada 9:16, header/marker dan footer digeser menjauh dari area UI TikTok; header/marker berada di bawah buffer atas 15%, dan pratinjau menandai safe zone atas/bawah/kanan dengan garis putus-putus. Offset manual teks utama/body dari kanvas 4:5 tetap dipertahankan relatif terhadap hasil reflow. Caption dan hashtag dapat disalin dari dialog ekspor; ZIP berisi semua slide dalam urutan.

## Struktur

```
server/            Express API: health, hooks, analyze
src/components/    Canvas, InputPanel, HookPicker, LayerPanel,
                   PropertyPanel, PhotoPanel, TemplatePanel,
                   SlideTabs, ExportDialog
src/lib/           types, defaultTemplate, ratioLayout, contentRhythm,
                   textLayout, autoFit, detectLanguage, color, theme,
                   imageProcessing, renderShared, exportSlides, iconPaths,
                   generate, vision, analyzeReference, applyGeneration
src/store/         editorStore, generationStore, templateStore
```

## Pintasan

- `Ctrl/⌘ + Z`: undo, `Ctrl/⌘ + Shift + Z` atau `Ctrl/⌘ + Y`: redo.
- Panah: geser layer 1 px; `Shift + panah`: 10 px.
- `Delete`/`Backspace`: hapus layer terpilih; `Esc`: lepaskan pilihan.
- Drag untuk memindahkan; handle untuk resize dan rotasi (mouse dan sentuhan).

## Catatan

- `npm run build` menjalankan `tsc --noEmit` sebelum Vite.
- `.env` diabaikan oleh `.gitignore`; gunakan `.env.example` sebagai acuan.
- Semua data template dan foto pengguna tetap di peramban. Tidak ada unggahan ke server selain permintaan analisis referensi bila vision diaktifkan.
