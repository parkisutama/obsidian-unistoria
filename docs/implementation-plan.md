---
title: Rencana Implementasi Unistoria
created: 2026-10-01T21:50:44+07:00
modified: 2026-10-02T09:00:00+07:00
tags:
  - unistoria
  - implementation-plan
  - repo-setup
---

# Rencana implementasi Unistoria

- **Status:** Fase 0 dikerjakan. Keputusan engineering dan K-01 diputuskan maintainer pada 2026-10-01.
  K-02 sampai K-08 masih usulan dan divalidasi sebelum Fase 2.
- **Tanggal:** 2026-10-01
- **Sumber kebutuhan:** [Unistoria spec](unistoria-spec.md)
- **Masukan:** [Evaluasi spec dan referensi setup](unistoria-spec-evaluation.md)
- **Instruksi agen:** [AGENTS.md](../AGENTS.md)

Dokumen ini adalah PLAN sekaligus daftar TASKS untuk v1.
Spec menyimpan kebutuhan; dokumen ini menyimpan pendekatan, urutan, dan progres.
Tidak ada tracker kedua: status task dicatat pada checkbox di dokumen ini.

## 1. Ringkasan pendekatan

1. **Fase 0 — Setup repo.** Git, toolchain, gate, CI, dan plugin kosong yang dapat dimuat.
2. **Fase 1 — Spike dan kontrak.** Buktikan tiga risiko tertinggi di vault nyata,
   lalu kunci kontrak R-03, R-04, R-06, R-07, R-08 sebagai ADR.
3. **Fase 2 — Foundation.** Domain murni dan adapter vault,
   diakhiri alur Create Space / Create Topic yang menghasilkan file benar.
4. **Fase 3 — Conversation MVP.** View, thread, composer, Reply/Edit, lifecycle.
5. **Fase 4 — Hardening.** Rename/move, popout, aksesibilitas, performa, acceptance vault nyata.

Urutan ini sengaja menaruh risiko storage dan editor di Fase 1,
sesuai catatan evaluasi agar risiko tersebut tidak ditunda sampai hardening.

## 2. Keadaan repo

| Area | Bukti per 2026-10-01 |
| --- | --- |
| Git | Repo lokal diinisialisasi pada branch `main`; belum ada commit dan belum ada remote |
| Toolchain | Node `v24.21.0`, pnpm `12.8.1` (dari `packageManager`), TypeScript `6.0.3` |
| Gate | `pnpm run check:ci` lulus: typecheck, Biome, Obsidian ESLint, rumdl, test, build, verifikasi artifact |
| Output build | `dist/` dan salinan di `<vault>\.obsidian\plugins\unistoria` |
| Belum dijalankan | Memuat plugin di Obsidian, workflow CI di GitHub, dan seluruh spike |
| Referensi | Unimian HEAD `076bf0b` (GPL-3.0-only), Unisastra, audit DX di `obsidian-univeritas` |

## 3. Keputusan

Baris bertanda **Diputuskan** berasal dari maintainer.
Baris lain adalah usulan dengan rekomendasi;
usulan menjadi final ketika maintainer menyetujuinya dan ADR terkait berstatus Accepted.

### 3.1 Kontrak produk dan data

| ID | Temuan | Keputusan atau usulan | Bukti yang masih diperlukan |
| --- | --- | --- | --- |
| K-01 | R-03, R-11 | **Diputuskan: tanpa offset.** `created`/`updated` ditulis sebagai waktu lokal tanpa offset karena Obsidian belum mendukung multi zona waktu. Usulan sisanya: format dengan detik, contoh `2026-10-01T10:30:00`. `created` tidak pernah diubah; `updated` diubah pada setiap mutation oleh plugin. Urutan sibling: `created` lalu `message_id`. Timestamp invalid diurutkan terakhir dan ditandai sebagai masalah integritas. Stempel pada nama file hanya informatif | S3: format yang dikenali Properties UI sebagai Date & time; konfirmasi pemakaian detik |
| K-02 | R-04 | Transisi yang diizinkan: `draft → published`, `published → removed`, `removed → published`. Draft tidak dapat di-remove di v1. Body kosong tidak dapat dipublish. UI menyebut draft "unpublished", bukan "private". Reply hanya dapat dibuat pada parent `published`. Pesan `published` di bawah ancestor `draft`/`removed` ikut tersembunyi di tampilan normal | Konfirmasi maintainer |
| K-03 | R-06 | Urutan pembuatan topic: folder → Folder Note → `messages/` → draft pertama. Setiap keadaan parsial adalah keadaan valid: folder tanpa Folder Note bukan topic; topic tanpa pesan menampilkan aksi "mulai pesan pertama". Retry melewati langkah yang sudah ada dan cocok `topic_id`-nya. Cleanup hanya ditawarkan untuk file yang dibuat operasi itu dan isinya belum berubah. Tidak ada journal non-Markdown di vault | Uji kegagalan tulis pada adapter palsu |
| K-04 | R-02, R-07 | Keanggotaan topic ditentukan lokasi fisik: file di dalam `<topic>/messages/`. Link `topic` harus menunjuk Folder Note topic itu; ketidakcocokan dilaporkan. `parent` harus menunjuk pesan di `messages/` yang sama. Self-parent, cycle, target hilang, atau target di luar topic menghasilkan status orphan yang terlihat dan tidak pernah dipasangkan ke pesan lain. File yang dipindah keluar boundary keluar dari percakapan. `topic_id` atau `message_id` ganda dilaporkan. Plugin hanya memutasi file di dalam boundary topic yang sedang dibuka | S1: fixture rename/move dengan updater aktif dan nonaktif |
| K-05 | R-08 | Mutation frontmatter memakai `FileManager.processFrontMatter`: preservasi semantik untuk key yang tidak dikenal, body tidak disentuh. Penulisan body hanya melalui editor native Obsidian. YAML rusak: kartu berstatus invalid, hanya aksi "buka file", tanpa mutation. Jika metadata cache belum siap, baca isi file dan parse sendiri; jangan merender hirarki dari data parsial | S3: round-trip nilai link ber-kutip dan key asing |
| K-06 | R-05 | Composer dan Edit menyematkan `MarkdownView` asli lewat adaptasi `detachedLeaf.ts` Unimian. Jika leaf gagal dibuat, aksi eksplisit membuka file di tab editor biasa. Tidak ada fallback read-only mobile | S2: main window dan popout |
| K-07 | §16 | Space tanpa Folder Note di v1. Daftar path Space root disimpan di settings sebagai pointer saja dan diperbarui pada event rename. Topic dikenali dari Folder Note ber-`type: discussion-topic` | Konfirmasi maintainer |
| K-08 | R-09 | Daftar topic minimal masuk MVP agar topic dapat dibuka kembali. `closed` hanya label di v1 dan tidak memblokir reply | Konfirmasi maintainer |
| K-09 | R-10 | Target performa dan aksesibilitas ditetapkan setelah baseline prototype di H3/H4, bukan sekarang | Hasil baseline |
| K-10 | R-12 | Plugin hanya menjamin portabilitas untuk frontmatter yang dihasilkannya. Body pengguna tidak pernah dikonversi otomatis | — |

### 3.2 Engineering

| ID | Concern | Keputusan atau usulan |
| --- | --- | --- |
| E-01 | Toolchain | **Diputuskan.** Versi stabil terbaru yang saling kompatibel; pnpm tetap dipakai. Node `>=24`, `.node-version` `24`, pnpm `12.8.1` lewat `packageManager` |
| E-02 | Bahasa dan bundler | TypeScript `strict: true` plus `noUncheckedIndexedAccess`; esbuild, format CJS, `obsidian`/`electron`/CodeMirror/builtin external |
| E-03 | Output build | **Diputuskan.** `build` dan `dev` menulis `dist/`, lalu menyalin artifact ke folder pada `OBSIDIAN_VAULT_PLUGIN_PATH` di `.env` (`<vault>\.obsidian\plugins\unistoria`; nama folder sama dengan ID plugin) |
| E-04 | Pengaman salinan vault | Hanya key itu yang dibaca dari `.env`; salinan ditolak jika nama folder bukan `unistoria` atau folder `plugins` induknya tidak ada; tanpa `.env` salinan dilewati |
| E-05 | UI runtime | **Diputuskan.** DOM Obsidian biasa lebih dulu. Jika framework ternyata dibutuhkan: Preact; React hanya bila Preact tidak memungkinkan |
| E-06 | Dependency runtime | Target nol dependency runtime; generator ID memakai `crypto.getRandomValues` |
| E-07 | Kualitas | **Diputuskan: Biome.** Biome untuk lint dan format; ESLint hanya menjalankan aturan `eslint-plugin-obsidianmd`; rumdl untuk Markdown; Vitest + happy-dom |
| E-08 | Versi minimum | `minAppVersion` `1.14.4` (stable terbaru, keputusan maintainer 2026-10-09; acceptance native terakhir di 1.14.2/1.14.3); diturunkan hanya dengan bukti |
| E-09 | Commit | Conventional Commits sebagai konvensi tertulis; Husky/commitlint ditunda sampai DX-FU-04 diputuskan |
| E-10 | Lokasi dokumen | Spec dipindah ke `docs/unistoria-spec.md`; ADR di `docs/decisions/` |
| E-11 | CSS | **Diputuskan.** CSS biasa di `src/styles/`, digabung esbuild lewat `@import`; tanpa Sass atau preprocessor |
| E-12 | Push | **Diputuskan.** Remote dan push pertama menunggu maintainer menyatakan uji coba lokal selesai |

E-08, E-09, dan E-10 diterapkan sesuai rekomendasi tanpa jawaban eksplisit; koreksi bila tidak sesuai.

### 3.3 Versi yang terpasang

| Paket | Versi | Catatan kompatibilitas |
| --- | --- | --- |
| `typescript` | `6.0.3` | 7.0 belum didukung `typescript-eslint` (peer `<6.1.0`) |
| `eslint` | `9.39.5` | `eslint-plugin-obsidianmd` belum menerima ESLint 10 pada dependensinya |
| `@eslint/json` | `0.14.0` | Versi yang diminta peer `eslint-plugin-obsidianmd` |
| `eslint-plugin-obsidianmd` | `0.4.2` | Peer `obsidian` 1.8.7 diizinkan ke 1.14.4 di `pnpm-workspace.yaml` |
| `@biomejs/biome` | `2.5.14` | 2.5.15 masih di dalam jendela `minimumReleaseAge` pnpm saat install |
| `obsidian` | `1.14.4` | Typings sama dengan `minAppVersion` |
| `esbuild` | `0.28.2` | Terbaru |
| `vitest`, `@vitest/coverage-v8` | `5.0.3` | Terbaru |
| `happy-dom` | `20.14.5` | Terbaru |
| `rumdl` | `0.2.78` | Terbaru |
| `typescript-eslint`, `@typescript-eslint/parser` | `8.71.0` | Terbaru |
| `@types/node` | `24.19.0` | Mengikuti Node 24, bukan 26 |

`pnpm peers check` tidak melaporkan masalah.

## 4. Arsitektur target

```text
src/
  main.ts                 # komposisi plugin, registrasi, cleanup
  core/                   # murni; dilarang mengimpor `obsidian`
    schema/               # parse/validasi frontmatter topic dan message
    links/                # codec dan resolver relative Markdown link
    identity/             # ID, timestamp, nama file, sanitasi judul
    thread/               # pohon reply, urutan, cycle/orphan, visibility
    lifecycle/            # transisi status
    creation/             # rencana pembuatan sebagai daftar langkah
  platform/               # adapter Obsidian
    vault/                # baca, eksekutor creation, mutation gateway
    index/                # TopicIndex + rekonsiliasi event vault/metadata
    editor/               # detached leaf (adaptasi Unimian) + fallback
  ui/
    views/                # ItemView Space/Topic/Conversation
    components/           # kartu pesan, thread, composer, panel integritas
    modals/               # Create Space, Create Topic
  settings/
  styles/                 # CSS biasa, entry index.css
tests/
  fixtures/obsidian.ts    # test double API Obsidian
  architecture.test.ts    # menjaga arah dependency
scripts/                  # tooling Node saja
docs/
  decisions/              # ADR
```

Aturan arah dependency: `ui → platform → core`; `core` tidak bergantung pada siapa pun.
Semua penulisan ke vault melewati `platform/vault`; `ui` tidak memanggil API tulis vault langsung.
Operasi DOM memakai document/window milik container view agar popout bekerja.

### 4.1 Reuse dari Unimian

| Sumber Unimian | Perlakuan | Catatan |
| --- | --- | --- |
| `src/platform/preview/detachedLeaf.ts` | Adaptasi | Parent leaf harus mengikuti window pemilik view, bukan selalu `rootSplit` utama |
| `src/platform/preview/QuickPreviewModal.ts` | Adaptasi sebagian | Ambil pola lifecycle (`closed` guard, cleanup leaf, scratch `Component`); buang cabang mobile dan panel backlinks |
| `src/styles/components/quick-preview-modal.css` | Adaptasi sebagian | Hanya aturan header leaf dan layer hover-popover, dengan prefix `unistoria-` |
| `scripts/license-banner.mjs`, `verify-build-artifacts.mjs`, `eslint.config.mts`, `ci.yml` | Dijadikan model | Sudah ditulis ulang lebih ringkas di Fase 0; tidak ada kode yang disalin |

Setiap file adaptasi mempertahankan header SPDX `GPL-3.0-only` dan copyright asal,
menambah catatan perubahan, dan didaftarkan di `THIRD_PARTY_NOTICES.md`.

## 5. Kontrak command

| Command | Isi | Efek tulis |
| --- | --- | --- |
| `pnpm run typecheck` | `tsc --noEmit` untuk `src`, `tests`, `scripts` | Tidak ada |
| `pnpm run lint` | `biome check` (lint dan format) | Tidak ada |
| `pnpm run lint:obsidian` | ESLint Obsidian untuk `src`, `manifest.json`, `LICENSE` | Tidak ada |
| `pnpm run lint:md` | rumdl untuk seluruh Markdown repo | `.rumdl_cache` |
| `pnpm run test` | `vitest run` | Tidak ada |
| `pnpm run test:coverage` | Vitest dengan coverage V8 | `coverage/` |
| `pnpm run build` | esbuild production | `dist/` dan folder plugin di vault dari `.env` |
| `pnpm run dev` | esbuild watch | `dist/` dan folder plugin di vault dari `.env`, setiap build |
| `pnpm run verify:artifacts` | Cek artifact, identitas manifest, kecocokan versi, banner lisensi | Tidak ada |
| `pnpm run check` | `typecheck` + `lint` + `lint:obsidian` + `lint:md` + `test` | `.rumdl_cache` |
| `pnpm run check:ci` | `check` dengan coverage + `build` + `verify:artifacts` | `coverage/`, `dist/`, folder plugin di vault |
| `pnpm run fix` | Autofix Biome dan rumdl | File sumber dan Markdown |

`build`, `dev`, dan `check:ci` menulis ke luar repo bila `.env` berisi `OBSIDIAN_VAULT_PLUGIN_PATH`.
Gate otomatis tidak membuktikan acceptance UI native.
Ambang coverage (ratchet) ditetapkan di `vitest.config.mts` dari angka aktual setelah Fase 2; hanya boleh dinaikkan.

## 6. Fase 0 — Setup repo

| Selesai | ID | Task | Hasil | Verifikasi |
| --- | --- | --- | --- | --- |
| [x] | T0.1 | `git init` branch `main`; `.gitignore`, `.gitattributes`, `.editorconfig`, `.node-version`; spec dipindah ke `docs/unistoria-spec.md` | Selesai; belum ada commit | `git status`; rumdl memeriksa link relatif |
| [x] | T0.2 | `LICENSE` GPL-3.0, `package.json`, `pnpm-workspace.yaml`, install, `pnpm-lock.yaml` | Selesai dengan pnpm `12.8.1` | `pnpm peers check` bersih |
| [x] | T0.3 | `tsconfig.json`, `biome.jsonc`, `eslint.config.mjs`, `.rumdl.toml` | Selesai | `typecheck`, `lint`, `lint:obsidian`, `lint:md` lulus |
| [x] | T0.4 | `manifest.json`, `versions.json`, `src/main.ts` minimal, `src/styles/`, `esbuild.config.mjs`, banner lisensi, `verify:artifacts` | Selesai | `build` dan `verify:artifacts` lulus |
| [x] | T0.5 | Vitest, happy-dom, `tests/fixtures/obsidian.ts`, `tests/architecture.test.ts` | Selesai; guard dibuktikan dengan kasus pelanggaran sintetis | `pnpm run test` lulus |
| [x] | T0.6 | `scripts/vault-copy.mjs`, `.env.example`, `.env` lokal | Selesai; artifact tersalin ke folder plugin the maintainer's working vault | Test penolakan folder salah; salinan nyata saat build |
| [ ] | T0.7 | `.github/workflows/ci.yml`: baca `.node-version`, install beku, `check:ci` di Ubuntu, `test` di Windows | File ditulis; belum pernah berjalan | Run pertama setelah push (E-12) |
| [x] | T0.8 | `README.md`, `CONTRIBUTING.md`, `THIRD_PARTY_NOTICES.md`, `docs/decisions/README.md`; `AGENTS.md` diselaraskan | Selesai | `pnpm run lint:md` |
| [ ] | T0.9 | Maintainer mengaktifkan plugin di Obsidian 1.14.2 dan menyatakan uji lokal selesai | Menunggu maintainer | Plugin muncul dan aktif tanpa error di console |
| [ ] | T0.10 | Commit awal, buat remote, push | Menunggu T0.9 dan perintah maintainer | CI hijau di GitHub |

**Checkpoint A.** `pnpm run check:ci` hijau secara lokal.
Checkpoint selesai setelah T0.9 dan T0.10.

## 7. Fase 1 — Spike dan kontrak

Spike menghasilkan catatan bukti di `docs/decisions/`, bukan kode produksi.

| Selesai | ID | Task | Menjawab | Acceptance |
| --- | --- | --- | --- | --- |
| [x] | S1 | Fixture relative link di vault 1.14.2: rename/move Folder Note, parent, child, folder topic; nama dengan spasi, Unicode, `#`, `%`; updater aktif dan nonaktif | R-02, R-07, K-04 | Tabel hasil per skenario: nilai properti sebelum/sesudah dan resolusi `metadataCache` |
| [x] | S2 | Detached `MarkdownView` di dalam `ItemView`: main window, popout, tutup view saat editor terbuka, dua editor bergantian; perilaku panel Properties di leaf tersemat | R-05, K-06 | Catatan apa yang bekerja, apa yang bocor, dan pemicu fallback |
| [x] | S3 | Round-trip `processFrontMatter`: nilai link ber-kutip, key asing, komentar YAML, format timestamp lokal, CRLF; tampilan di Properties UI | R-03, R-08, K-01, K-05 | Daftar apa yang dipertahankan secara semantik dan apa yang dinormalisasi |
| [x] | D1 | ADR-001 schema dan waktu; ADR-002 relationship dan boundary; ADR-003 lifecycle; ADR-004 creation dan recovery; ADR-005 mutation dan preservasi; ADR-006 reuse editor | K-01–K-07 | Tiap ADR memuat konteks, keputusan, alternatif, konsekuensi, dan bukti spike |
| [x] | D2 | Revisi terbatas spec: tabel schema (required/optional/type/default), transisi status, contoh timestamp tanpa offset, perilaku `closed` | R-03, R-04, R-09, R-11 | Model penyimpanan dan lifecycle tidak berubah; diff dapat direview |

**Checkpoint B.** Maintainer menerima ADR dan revisi spec. Fase 2 tidak dimulai sebelum ini.
Spike menulis file hanya di folder uji khusus di vault, bukan di Space milik pengguna.

## 8. Fase 2 — Foundation

Seluruh task `core` memakai TDD dan tidak menyentuh API Obsidian.

| Selesai | ID | Task | Spec | Bergantung | Acceptance | Verifikasi |
| --- | --- | --- | --- | --- | --- | --- |
| [x] | F1 | `core/schema`: parse dan validasi topic/message; status invalid; key asing diteruskan utuh | §7.2, §7.3, §11 | D1 | Setiap baris tabel schema punya test valid dan invalid | Vitest |
| [x] | F2 | `core/links`: encode sekali, decode sekali, resolusi relatif terhadap sumber, penolakan wikilink/path polos/absolut, validasi boundary setelah normalisasi | §7.3, §7.4, P0 relationships | D1, S1 | `[Topic Name](../Topic%20Name.md)` dari `Topic Name/messages/x.md` menghasilkan `Topic Name/Topic Name.md`; kasus `#`, `%`, Unicode lulus | Vitest tabel kasus |
| [x] | F3 | `core/identity`: ID, timestamp, nama file `YYYY-MM-DDTHHmmss-<id>.md`, sanitasi judul dengan pratinjau hasil | §7.4, §12 | D1 | Tidak ada tabrakan pada 100.000 ID; sanitasi deterministik | Vitest |
| [x] | F4 | `core/thread`: pohon, urutan K-01, cycle/self-parent/orphan, ID ganda, visibility K-02 | §8, §11, P0 threaded | F1, F2 | Input rusak tidak pernah melempar; orphan tidak pernah dipasangkan | Vitest termasuk fixture rusak |
| [x] | F5 | `core/lifecycle`: transisi K-02, larangan publish body kosong | §8, P0 lifecycle | F1 | Transisi terlarang ditolak dengan alasan | Vitest |
| [x] | F6 | `platform/index`: `TopicIndex` dari vault + `metadataCache`; rekonsiliasi create/modify/rename/delete; fallback parse saat cache belum siap | §9.3, §11 | F1–F4 | Snapshot topic konsisten setelah setiap event pada test double | Vitest adapter |
| [x] | F7 | `core/creation` + `platform/vault`: eksekutor K-03; command `Create Space` dan `Create Topic` dengan modal dan pratinjau path | §9.1, P0 create | F2, F3, F6 | Empat item dibuat dengan properti lengkap; konflik path tidak menimpa; kegagalan melaporkan apa yang sudah dibuat | Vitest injeksi kegagalan; native: buat topic di vault uji |
| [x] | F8 | `platform/vault` mutation gateway: ubah `status` dan `updated` saja, hanya di dalam boundary topic | §9.3, P0 lifecycle | F5, F6, S3 | Key asing dan body utuh setelah mutation; file di luar boundary ditolak | Vitest; diff file di vault uji |

**Checkpoint C.** Dari command palette, pengguna membuat Space dan topic;
file yang dihasilkan terbaca dan link-nya dapat diklik tanpa UI percakapan.
Ratchet coverage sudah dipasang.

**Status Checkpoint C (2026-10-02): tercapai, diverifikasi di Obsidian 1.14.3.**
Create space dan Create topic lewat UI menghasilkan struktur benar, link `topic` ter-resolve,
konflik tidak menimpa, judul dibersihkan, publish menolak body kosong dan hanya mengubah `status` dan `updated`,
rename lewat updater mengikuti relationship, rename mentah menghasilkan orphan tanpa menebak,
dan rename folder atau penghapusan Folder Note memperbarui index.
Belum diuji: kegagalan tulis nyata di vault, cleanup lewat UI, dan popout (menunggu Fase 3 dan 4).

## 9. Fase 3 — Conversation MVP

Setiap task adalah vertical slice yang berakhir dengan pemeriksaan native di vault uji.

| Selesai | ID | Task | Spec | Bergantung | Acceptance |
| --- | --- | --- | --- | --- | --- |
| [x] | C1 | `ItemView` + command `Open Space / Topic view` + ribbon; daftar Space dan topic dengan status open/closed | §9.2, §12, K-08 | F6 | Topic dapat dibuka kembali setelah restart Obsidian |
| [x] | C2 | Render percakapan `published`: `MarkdownRenderer`, metadata author/waktu, nesting, hitungan reply, expand/collapse | §9.2, P0 threaded | C1, F4 | Hirarki di UI sama dengan frontmatter; embed dan link bekerja |
| [x] | C3 | Composer dengan editor tersemat + Publish; alur topic baru membuka draft pertama dan memfokuskan editor | §9.1, §9.2, K-06 | C2, F7, F8, S2 | Create Topic → tulis → Publish tanpa menyentuh file manual |
| [x] | C4 | Reply: buat draft reply dengan link `parent` dan `topic`, composer menempel pada parent | P0 threaded | C3 | Reply muncul di bawah parent setelah publish; tidak ada folder topic baru |
| [x] | C5 | Edit pada pesan `published`; fallback buka di tab editor biasa | §9.2, §9.3 | C3 | Edit mengubah file di tempat; `updated` berubah; key asing utuh |
| [x] | C6 | Bagian Drafts per topic; draft tetap ada setelah composer ditutup; label "unpublished" | §8, P0 create, K-02 | C3 | Draft yang dibatalkan dapat dibuka lagi dan dipublish |
| [x] | C7 | Remove dari menu sekunder; toggle tampilkan removed; Restore | §8, P0 lifecycle | C2, F8 | Path file tidak berubah; subtree tersembunyi; restore mengembalikan |
| [x] | C8 | Panel integritas: orphan, link rusak, ID ganda, YAML invalid, timestamp invalid; aksi buka file | §11, K-04, K-05 | C2 | Setiap kasus §11 terlihat dan tidak meng-crash view |
| [x] | C9 | Metadata topic: toggle open/closed, edit deskripsi di Folder Note; settings tab (default Space root, author) | P1, §12 | C1, F8 | Perubahan status tidak memindahkan file pesan |

**Checkpoint D.** Walkthrough lima ukuran sukses spec §14 dilakukan di vault uji dan hasilnya dicatat.
Checkpoint antara juga dilakukan setelah C3 dan C6.

**Status Fase 3 (2026-10-02): C1–C9 selesai dan diuji native di Obsidian 1.14.3 jendela utama.**
Diuji lewat DOM sungguhan: Create topic membuka view dan composer pada draft pertama; menulis di editor tersemat lalu Publish;
Reply membuat draft dengan link `parent` dan `topic` benar, tampil bersarang setelah publish;
collapse dan expand thread (`aria-expanded`); Remove dan Restore lewat menu (file tidak berpindah);
tampilan removed lewat toggle; Edit di tempat; draft yang ditutup tetap ada di Drafts dan bisa dibuka lagi;
Close dan Reopen topic (hanya label, reply tetap tersedia); panel integritas setelah rename mentah (parent hilang dilaporkan).
Checkpoint D (walkthrough ukuran sukses §14 bersama maintainer) dan acceptance popout masih menunggu.

Catatan temuan implementasi:

- Nama properti pada subclass `ItemView` bisa bertabrakan dengan field internal Obsidian (`navHidden` ternyata dipakai Obsidian).
  Pakai nama yang spesifik dan uji tampilan nyata.
- Bila "Native menus" aktif (vault kerja maintainer), `Menu` memakai menu OS dan tidak muncul di DOM; uji otomatis harus menonaktifkannya sementara.
- Plugin lain di vault dapat mengubah file pesan saat dibuka di editor; lihat risiko di bagian 12.
- Dua bug tata letak ditemukan maintainer dari screenshot dan diperbaiki: daftar topik yang disembunyikan membuat panel utama jatuh ke kolom grid selebar 0,
  dan editor di dock tidak punya ukuran karena CSS menarget `.workspace-leaf-content`, padahal elemen yang dipasang adalah `.workspace-leaf`.
  Pemeriksaan "elemen ada" tidak cukup: uji native juga harus mengukur ukuran elemen yang harus terlihat (H3 mencakup pemeriksaan visual).

## 10. Fase 4 — Hardening

| Selesai | ID | Task | Spec | Acceptance |
| --- | --- | --- | --- | --- |
| [x] | H1 | Matriks rename/move (pesan, parent, Folder Note, folder topic, Space root; updater aktif/nonaktif; pindah keluar boundary) | §9.3, §11, §17 | Setiap sel: direkonsiliasi atau dilaporkan; tidak pernah salah pasang |
| [x] | H2 | Editing di popout; lifecycle leaf saat window ditutup; fallback editor native | §9.2, §17 | Tidak ada leaf yatim atau listener tersisa setelah tutup |
| [x] | H3 | Aksesibilitas: navigasi keyboard, urutan fokus, `aria-expanded` pada thread, pengumuman collapse | §15, K-09 | Checklist keyboard lulus; target dicatat |
| [x] | H4 | Performa thread besar: skrip generator fixture, ukur baseline, tetapkan target, perbaiki bila perlu | §15, K-09 | Baseline dan target tercatat; hasil akhir memenuhi target |
| [x] | H5 | Mutation saat konflik: edit eksternal bersamaan, file dihapus saat composer terbuka | §11, §13 | Tidak ada penimpaan diam-diam; file yang dihapus tidak dibuat ulang |
| [x] | H6 | Dokumen acceptance vault nyata 1.14.2, README pengguna, workflow release | §17 | Semua butir Definition of Done punya bukti; yang belum diuji dinyatakan belum diuji |

**Checkpoint E.** Definition of Done spec §17 ditinjau butir demi butir bersama maintainer.

**Status Fase 4 (2026-10-02):** H1–H6 selesai; bukti dan item yang masih terbuka ada di [native-acceptance.md](native-acceptance.md).
Skrip acceptance native (`scripts/native/`) dapat diulang dengan `pnpm run native -- <vault> <skrip>`.
Perubahan yang muncul dari hardening: tata letak bergantung pada kontainer jendela (bukan grup tab) untuk editor tersemat,
render dilewati bila tampilan tidak berubah (penyimpanan otomatis draft tidak lagi membangun ulang thread),
composer mengikuti rename dan menutup bila draft dihapus, fokus dipertahankan antar-render, struktur daftar bersarang dan pengumuman layar.
Yang masih terbuka sebelum rilis: ulangi di Obsidian 1.14.2, jalan-jalan keyboard oleh manusia, tema lain, dan keputusan pengurutan sibling (ADR-001).
Setelah uji pakai maintainer, penulisan pesan dipindah dari editor tersemat ke panel editor Obsidian biasa di split (ADR-007, mode `split` default;
editor tersemat tetap sebagai opsi `embedded`), dan ukuran heading di dalam kartu dibatasi agar kartu terbaca sebagai pesan.
Pesan kini dirender seperti reading view dan interaktif: link internal (klik, Ctrl+hover untuk Page Preview), tag membuka pencarian,
callout dan blockquote tampil sesuai tema, dan checkbox tugas bisa dicentang (pengecualian terbatas pada ADR-005, lihat amandemennya).
Kolom percakapan dipusatkan dengan lebar baca nyaman.
Pesan dan konteks topik yang panjang menampilkan excerpt (tinggi maksimal 320 px, dengan margin 96 px agar teks yang hanya sedikit lebih panjang tidak dipotong) dan tombol Read more / Show less; pilihan pembaca bertahan antar-render.
Workflow release (`release.yml`) dan `pnpm run version:sync` sudah ada; tag, push, dan rilis menunggu perintah maintainer.

## 10a. Fase 5 — Revamp tampilan percakapan

Permintaan maintainer 2026-10-08; keputusan di [ADR-008](decisions/ADR-008-thread-panel.md).

| Selesai | ID | Task | Spec | Acceptance | Verifikasi |
| --- | --- | --- | --- | --- | --- |
| [x] | U1 | `core/thread/display`: `threadReplies` (balasan datar urut waktu) dan `threadRootOf` | §5, P0 threaded | Balasan pada kedalaman berapa pun terdaftar datar; akar thread tidak pernah ditebak | Vitest (`tests/core/display.test.ts`) |
| [x] | U2 | Daftar topik: tombol tampil/sembunyi di dalam daftar, rel sempit saat tersembunyi, lebar tetap, label status dan nama sejajar | §9.2 | Tombol ada di kedua keadaan; nama topik satu baris dan dua baris sejajar | Native: `h3-accessibility.js` |
| [x] | U3 | Header topik: judul di barisnya sendiri, kontrol di bawahnya, jarak ke konteks dan pesan; jarak heading di dalam kartu | §9.2 | Judul tidak menempel pada konten; heading tidak bertabrakan dengan callout | Native: `h3-accessibility.js` |
| [x] | U4 | Panel thread kanan: halaman topik hanya memuat pesan pembuka thread dengan ringkasan balasan; panel memuat pesan dan balasan datar; perluas ke seluruh view; tutup; Reply selalu ke pembuka thread | §9.2, P0 threaded, ADR-008 | Kriteria P0 threaded yang direvisi | Native: `h3-accessibility.js`, `h4-performance.js` |
| [x] | U5 | Balasan bisa dibalas: Reply di tiap balasan membuat balasan dengan `parent` ke balasan itu; tampil datar dengan kutipan satu baris (`core/markdown/quote`) yang melompat ke pesan asal; balasan tetap tidak punya thread sendiri | §9.2, P0 threaded, ADR-008 (amandemen) | Beberapa balasan boleh menjawab balasan yang sama; kutipan tidak pernah disimpan | Vitest (`tests/core/quote.test.ts`); native: `h3-accessibility.js` |

**Checkpoint F.** Maintainer melihat tampilan di vault kerja.

**Status Fase 5 (2026-10-08):** U1–U5 selesai dan diuji native di Obsidian jendela utama (hasil di [native-acceptance.md](native-acceptance.md)).
Belum diuji: pane sempit, popout (H2 belum diulang), dan tema lain.

## 11. Pemetaan requirement ke task

| Requirement spec | Task |
| --- | --- |
| P0 — Create structure and first draft | F3, F7, C3, C6 |
| P0 — Markdown files and portable relationships | S1, F1, F2, F6, H1 |
| P0 — Threaded conversation and writing | F4, C2, C3, C4, C5, U1, U4, U5 |
| P0 — Lifecycle | F5, F8, C6, C7 |
| P1 — Topic navigation and metadata | C1, C9 |
| §11 Error and edge cases | F4, F6, C8, H1, H5 |
| §12 Settings and commands | F7, C1, C9 |
| §13 Privacy and collaboration boundary | K-02, C6, H5 |
| §17 Definition of done | Checkpoint D, H1–H6 |

## 12. Risiko

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Konstruktor `WorkspaceLeaf` dan `containerEl` tidak terdokumentasi | Editor tersemat rusak pada update Obsidian | Diisolasi di satu file; mengembalikan `null`; fallback tab native; S2 dan H2 |
| Updater link tidak memperbarui properti pada skenario tertentu | Relationship basi | S1 lebih dulu; resolver memvalidasi dan melaporkan, tidak menebak |
| `processFrontMatter` menormalisasi format YAML | Diff tak terduga pada file pengguna | S3 mendokumentasikan batas; kontrak K-05 adalah preservasi semantik |
| Build menyalin ke vault yang dipakai sehari-hari | Plugin setengah jadi aktif di vault kerja | Salinan hanya ke folder `unistoria`; fitur yang menulis file diuji pada folder uji khusus |
| Kode GPL diadaptasi tanpa notice lengkap | Pelanggaran lisensi | Header SPDX, `THIRD_PARTY_NOTICES.md`, `verify:artifacts` memeriksa banner |
| Plugin lain (di vault kerja maintainer, tampaknya Obsidian Linter) memformat file pesan saat dibuka di editor: menambah `title` dan `modified`, menyisipkan heading `# <nama file>` di body, dan memotong `created` ke menit | Tiap pesan menampilkan heading nama file; draft kosong tampak berisi sehingga penjaga body kosong tidak berlaku; pesan satu menit urut menurut `message_id` | Hanya dokumentasi: kecualikan folder Space dari aturan plugin tersebut (README). Opsi yang perlu keputusan maintainer: urutkan sibling dengan stempel pada nama file sebagai pengurut kedua (mengubah ADR-001) |

## 13. Yang masih menunggu maintainer

1. Uji lokal: aktifkan Unistoria di the maintainer's working vault, lalu nyatakan selesai (T0.9).
2. Setelah itu: perintah commit, nama dan visibilitas remote GitHub, dan push (T0.10).
3. K-02 sampai K-08, dan pemakaian detik pada K-01, sebelum Fase 2.
4. Koreksi untuk E-08, E-09, E-10 bila rekomendasi yang diterapkan tidak sesuai.
