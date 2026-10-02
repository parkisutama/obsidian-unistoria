---
title: Evaluasi Spec dan Referensi Setup Unistoria
created: 2026-10-01T21:41:40+07:00
modified: 2026-10-01T21:45:05+07:00
tags:
  - unistoria
  - specification-review
  - developer-experience
---

# Evaluasi spec dan referensi setup Unistoria

Status: evaluasi sebelum PLAN dan TASKS; keputusan link, reuse GPL, dan desktop-only telah dikonfirmasi pengguna.
Tanggal pemeriksaan: 2026-10-01, Asia/Jakarta.
Sumber kebutuhan: [Unistoria spec](unistoria-spec.md).

## Kesimpulan evaluasi

Arah produk cukup jelas: percakapan berbasis folder, satu file Markdown per pesan,
relationship relatif, lifecycle draft/published/removed, dan vault sebagai sumber kebenaran.
Spec sudah memiliki alur pengguna, non-goals, acceptance, serta batas kolaborasi lokal.
Namun kontrak relationship, waktu, recovery, dan editing belum cukup presisi untuk plan implementasi final.
R-01 diperbaiki dan format relationship R-02 dipastikan dari changelog resmi.
Reuse GPL serta scope desktop-only pada R-05 sudah diputuskan pengguna;
validasi runtime link/editor tetap terbuka.
Selesaikan kontrak R-03, R-04, R-06, R-07, dan R-08 sebelum mengunci pendekatan teknis.

Evaluasi ini mempertahankan model penyimpanan dan lifecycle yang tertulis.
Spec diperbarui atas instruksi pengguna: contoh link Folder Note/parent,
scope desktop-only, dan reuse/adaptasi Quick Preview GPL-3.0-only.
Tidak ada instalasi skill/dependency, bootstrap repo, atau implementasi plugin.
Pernyataan "approved direction" di handoff dipakai sebagai konteks arah produk,
bukan bukti bahwa keputusan teknis yang masih terbuka sudah disetujui.

## Bukti checkout dan batas pemeriksaan

| Area | Bukti saat pemeriksaan |
| --- | --- |
| Unistoria | Hanya `docs/docs/unistoria-spec.md`; belum ada `.git`, `AGENTS.md`, package manifest, source, tests, atau konfigurasi toolchain |
| Unimian | Working tree bersih; HEAD `076bf0b`; source, manifest, AGENTS, build/test scripts, dan CI dibaca |
| Unisastra | Working tree bersih; HEAD `937065a`; AGENTS, CLAUDE, manifest, hooks, build/dev/test scripts, CI, dan developer docs dibaca |
| Audit lintas repo | `D:/repos/obsidian-univeritas/docs/developer-experience-audit.md`, terutama DX-01 dan perbedaan gate, diverifikasi langsung |
| Runtime | Tidak menjalankan build/test kedua plugin, membuka Obsidian, atau menguji updater link di vault |

Path spec aktual memiliki dua tingkat `docs/`.
Belum dipindahkan agar tidak mengubah lokasi sumber tanpa keputusan struktur dokumentasi.

## Toolchain yang dapat dijadikan referensi

| Concern | Unimian saat ini | Unisastra saat ini | Implikasi untuk Unistoria |
| --- | --- | --- | --- |
| Node | `.node-version` 24; engines `>=24` | `.node-version` 24; engines `>=24 <25` | Gunakan kebijakan DX-01 sebagai baseline usulan |
| pnpm | `12.4.2` | `11.21.0` | Jangan menganggap pin kedua checkout sudah selaras |
| TypeScript | `^6.0.3`; flag ketat individual | `^5.9.3`; `strict: true` | Pilih versi dan config setelah pemeriksaan kompatibilitas tooling |
| Build | esbuild `^0.28.2`; output root | esbuild `^0.25.12`, tsx dan Sass; output `dist/` | CJS plugin bundle; external host API; output perlu diputuskan |
| Quality | Biome/Ultracite, Obsidian ESLint | Biome/Ultracite, Obsidian ESLint, Stylelint, rumdl | Ambil concern yang relevan, bukan seluruh dependency tree |
| Test | Vitest 5, happy-dom, coverage V8 | Vitest 4; wrapper Node langsung | Pure core + adapter tests; wrapper harus kompatibel Windows |
| Docs | Markdown tanpa gate docs khusus pada manifest | rumdl dan VitePress | Markdown lint relevan sejak awal; situs docs opsional |
| Hooks | Tidak ada `.husky`; hooksPath tidak menghasilkan nilai | Husky, commitlint; hooksPath `.husky/_` | Tentukan kebijakan commit dan enforcement secara eksplisit |
| CI | Linux quality/coverage/build/artifact + Windows tests | Ubuntu `check:ci`; commitlint dan docs workflow terpisah | Frozen install dan laporan gate; native QA tetap terpisah |
| Product runtime | Calendar, Gantt, Preact, temporal-polyfill | Integrasi editor dan CodeMirror host | Calendar/Gantt/Preact tidak menjadi kebutuhan Unistoria |
| License | GPL-3.0-only | MIT, beserta notice komponen adaptasi | License produk baru tidak dapat dipilih hanya dari preferensi tooling |

DX-01 mencatat keputusan maintainer tanggal 2026-09-29:
Node `>=24`, `.node-version` `24`, fnm lokal, CI membaca version file,
dan `packageManager` pnpm `12.7.0`.
Penerapan di kedua plugin masih belum terlihat pada manifest yang diperiksa.
Untuk Unistoria, baseline ini direkomendasikan sebagai adopsi kebijakan yang sudah ada;
evaluasi ini tidak mengubah konfigurasi repo referensi atau menetapkan seluruh versi dependency baru.
`12.7.0` disebut sebagai pin kebijakan, bukan klaim versi terbaru pada hari ini.

### Gate dengan nama sama memiliki isi berbeda

- Unimian `check`: Biome lint, Obsidian ESLint, typecheck, tests.
- Unimian `check:ci`: lint, Obsidian ESLint, typecheck, coverage tests, build, artifact verification.
- Unisastra `check`: typecheck, Biome check, Obsidian ESLint, SCSS lint, Markdown lint.
- Unisastra `check:ci`: gate tersebut ditambah tests, build, artifact verification, docs build.

Untuk Unistoria, definisikan isi setiap command sebelum menuliskan command sebagai acceptance.
Coverage floor Unimian adalah ratchet proyek tersebut; jangan menyalin angka itu sebagai target produk baru.
VitePress build dan Markdown lint tidak membuktikan kebenaran isi, seluruh link, atau native UI acceptance.

### Efek samping setup yang perlu dicatat

Unimian `dev` memuat konfigurasi environment dan dapat menyalin artifact ke vault yang dikonfigurasi.
Unisastra `dev` membangun, menyiapkan test-vault, dan memanggil deployment opsional.
Unisastra `prepare` memasang Husky; `release` dapat membuat commit/tag lokal.
Untuk Unistoria, rekomendasinya build/watch hanya menulis output proyek;
deployment menjadi aksi eksplisit ke vault uji dengan pemeriksaan folder plugin ID `unistoria`.
Tidak ada isi credentials atau `.env` dibaca dalam evaluasi ini.

## AGENTS dan setup skill

### Pola AGENTS yang relevan

Unimian AGENTS menjelaskan identitas, lineage, batas produk, lifecycle Obsidian,
dan aturan khusus integrasi view.
Ada ketegangan antara label read-only tingkat umum dan write grants Gantt/Quick Preview;
source serta kontrak yang lebih spesifik perlu dibaca ketika menerapkan aturan.
Jangan menyalin filosofi read-only Unimian ke Unistoria yang memang membuat dan mengedit file.

Unisastra AGENTS lebih lengkap untuk tata kerja:
reading order, pemilihan skill sesuai fase, SPECIFY → PLAN → TASKS → IMPLEMENT,
ADR untuk perubahan kontrak, vertical slices, pelaporan gate, dan acceptance desktop/mobile/popout.
CLAUDE.md hanya menunjuk ke AGENTS.md sebagai sumber instruksi bersama.
Beberapa path Read first masih memakai struktur English tanpa prefix `docs/en/`;
file aktif yang diperiksa berada di root docs atau `docs/en/for-developers/`.
Karena itu salinan AGENTS perlu diverifikasi link-nya, bukan dipindahkan mentah.

Usulan isi AGENTS Unistoria setelah setup diputuskan:

- Identitas `Unistoria`/`unistoria`, spec kanonis, dan urutan baca evaluasi/keputusan/plan/task.
- Invariant: file Markdown kanonis, unknown fields dipertahankan, soft remove,
  relationship deterministik, serta tidak menyisipkan autentikasi/sync/database.
- Pure domain code terpisah dari Obsidian/vault/UI; Node tooling berada di scripts.
- Baca SKILL.md dan pilih skill minimum untuk fase aktif; catat jika tidak tersedia.
- Pertahankan pekerjaan lokal; branch sebelum artefak implementasi setelah repo Git tersedia.
- Tautkan requirement → task → test/native QA → keputusan; hindari tracker ganda.
- Nyatakan isi command, efek write/deploy/release, serta batas hasil otomatis.
- Target desktop-only dengan `isDesktopOnly: true`; acceptance main window/popout
  dan native-editor fallback; tidak mewajibkan mobile QA untuk Unistoria.

AGENTS repo referensi adalah bahan pembelajaran, bukan instruksi otomatis untuk workspace Unistoria.
Belum membuat AGENTS atau CLAUDE baru dalam evaluasi ini.

### Skill yang ditemukan dan dipelajari

Dean Peters tersedia di cache Claude `C:/Users/parki/.claude/plugins/cache/pm-skills/`.
Skill `problem-statement`, `jobs-to-be-done`, dan `prd-development`
berada pada snapshot `1b5a524ebb95` masing-masing skill.
Addy Osmani tersedia di `C:/Users/parki/.claude/plugins/cache/addy-agent-skills/agent-skills/0.6.9/`.
Manifest lokal menyebut author Addy Osmani dan menyertakan adapter `.codex-plugin`.
Ketersediaan file di cache Claude tidak membuktikan plugin terdaftar di Codex;
pada sesi ini instruksi dibaca langsung dari file lokal.

| Skill | Penggunaan pada evaluasi |
| --- | --- |
| Dean `problem-statement` | Memisahkan pengguna, outcome, hambatan, dan bukti dari solusi yang sudah dipilih |
| Dean `jobs-to-be-done` | Memeriksa pekerjaan pengguna: merekam diskusi, membalas konteks tepat, memulihkan draft, dan membaca tanpa plugin |
| Dean `prd-development` | Memeriksa konsistensi problem, persona, flow, scope, metrics, risiko, dan acceptance; tidak menjalankan workshop discovery penuh |
| Addy `spec-driven-development` | Menilai batas dan keputusan yang harus jelas sebelum PLAN; mempertahankan sumber kebutuhan aktif |
| Addy `planning-and-task-breakdown` | Mempelajari aturan dependency, vertical slice, acceptance/verify per task, serta checkpoint; belum menghasilkan task list |
| `markdown-writing-portability` | Menilai sintaks dokumen dan portability file produk sebagai concern yang berbeda |

Sumber upstream: [Dean Peters Product Manager Skills](https://github.com/deanpeters/Product-Manager-Skills)
dan [Addy Osmani Agent Skills](https://github.com/addyosmani/agent-skills).
Skill portability dibaca dari cache plugin `anthropic-skills/1.0.0/skills/markdown-writing-portability/SKILL.md`.
Tidak ada skill disalin atau diinstal ulang.

Skill Addy memakai default `tasks/plan.md` dan `tasks/todo.md`.
Unisastra memakai konvensi `docs/specs/<slug>/{spec,plan,tasks}.md` untuk pekerjaan baru.
Unistoria belum memilih konvensi; tentukan satu lokasi kanonis dan tulis di AGENTS.
Jika memilih lokasi selain default, pastikan workflow lanjutan membacanya.

## Evaluasi kebutuhan menurut kerangka PM

Pengguna utama yang tersirat adalah pemilik vault yang menulis dan membaca diskusi lokal.
"Participant", "vault maintainer", dan "agent" adalah peran dalam stories,
belum merupakan bukti persona atau kebutuhan kolaborasi multi-user.
Agent adalah calon consumer konteks folder; integrasi agent tetap non-goal v1.

Rumusan problem berdasarkan spec:
pengguna perlu mempertahankan konteks diskusi dan hubungan balasan dalam file yang mudah dibaca,
karena pembuatan file/properti dan pemeliharaan hirarki secara manual menghambat penulisan.
Tidak ada data wawancara, ukuran waktu, atau bukti emosi pengguna dalam spec;
perlakukan sebagai kebutuhan maintainer yang tertulis, bukan hasil riset yang sudah tervalidasi.
Tidak perlu membuat asumsi emosi, ukuran pasar, atau telemetry untuk melengkapi template PM.

Yang kuat: onboarding tanpa schema manual, reply pada parent tertentu,
editing Markdown, soft removal, recovery, dan raw-file inspection terhubung ke acceptance.
Yang perlu dipertegas: pengguna primer, perilaku topic closed,
visibility draft, serta ukuran sukses usability dan performance.
Success measures kualitatif cukup untuk walkthrough awal,
tetapi hasil baseline dan target berikutnya perlu dicatat agar keputusan hardening dapat diuji.

## Temuan sebelum plan final

Prioritas di bawah adalah prioritas evaluasi, berbeda dari P0/P1 fitur di spec.
R-01, format link R-02, dan arah reuse/platform R-05 telah diterapkan ke spec.
Temuan lain masih berupa rekomendasi; nomor baris merujuk snapshot sebelum revisi.

| ID | Prioritas | Lokasi spec | Temuan dan dampak | Koreksi atau keputusan yang diperlukan |
| --- | --- | --- | --- | --- |
| R-01 | Diperbaiki | §7.1–7.3 | Path contoh menggandakan folder topic | Sekarang `topic: "[Topic Name](../Topic%20Name.md)"`; contoh parent memakai complete Markdown link |
| R-02 | Format diputuskan; QA terbuka | §7.3, §9.3, §16 | Evaluasi awal memakai Help yang tertinggal dari changelog; dukungan native Markdown property links sudah ada sejak 1.11 | Complete Markdown link dengan source-relative URL-encoded destination; uji fixture rename/move pada 1.14.2 dengan updater aktif/nonaktif |
| R-03 | Tinggi | §7.2–7.4, §16 | Timestamp tanpa offset/sekon; sorting chronological belum deterministik untuk zona waktu dan timestamp invalid | Tetapkan instant dengan offset atau UTC, immutable created, updated pada mutation, invalid timestamp handling, dan tie-break ID; filename bukan sumber waktu kanonis |
| R-04 | Tinggi | §8, §13, §16 | Draft disebut private meski tidak ada identity/auth; transisi restore belum lengkap | Sebut unpublished; definisikan transisi yang diizinkan, restore ke status apa, dan visibility anak ketika ancestor draft/removed |
| R-05 | Reuse/platform diputuskan; QA terbuka | §9.2, §16 | Quick Preview source GPL-3.0-only memakai WorkspaceLeaf internal | Reuse/adaptasi GPL-3.0-only dengan attribution; desktop-only, main window/popout dan fallback native editor; perubahan kode tetap mengikuti GPL |
| R-06 | Tinggi | §9.1, §10 creation | "One operation" dan "avoid partial structures" belum dibedakan dari recovery partial yang diterima acceptance | Nyatakan create multi-file dapat gagal parsial; tetapkan retry idempotent, ownership file operasi, restart recovery, dan cleanup yang tidak menghapus konten pengguna |
| R-07 | Tinggi | §7.4, §9.3, §11 | Invariant topic membership dan rename/move belum lengkap | Tetapkan source-relative resolution, same-topic parent, larangan cycle/self-parent, boundary Space/topic, duplicate topic IDs, dan hasil ketika file dipindah keluar boundary |
| R-08 | Tinggi | §9.3, §11, §13 | Preserve unknown fields dan conflict detection belum punya observable contract | Tetapkan tindakan pada YAML rusak, conflict edit eksternal, metadata cache belum siap, serta batas preservasi semantic versus byte-for-byte |
| R-09 | Sedang | §9.2, §10 P1, §12 | Browsing disebut core UX tetapi P1; state closed belum menentukan efek pada reply/publish | Pastikan navigation minimal untuk reopening adalah MVP; putuskan closed hanya label atau membatasi authoring |
| R-10 | Sedang | §14–15, §17 | Accessibility dan large-thread performance disebut tanpa acceptance terukur | Tetapkan keyboard/focus/collapse announcements, desktop pane/popout resizing, dataset dan depth uji, waktu/load target setelah prototype |
| R-11 | Sedang | §7.2–7.3, §11 | Required/optional/type/default belum berupa kontrak yang lengkap; status invalid dan schema evolution belum ditentukan | Buat tabel schema tanpa menambah key diam-diam; tentukan root parent kosong, author optional, enum topic, invalid status, dan forward-compatible handling |
| R-12 | Sedang | §9.2–9.3 | Renderer menerima Markdown arbitrer; generated relationships portable tetapi body dapat berisi Obsidian embeds | Bedakan format yang plugin hasilkan dari konten pengguna; pertahankan konten tanpa konversi otomatis dan dokumentasikan keterbatasan renderer luar |

### Relationship YAML dan updater Obsidian

[Changelog Obsidian 1.11 Desktop](https://obsidian.md/changelog/2026-01-12-desktop-v1.11.4/)
mengonfirmasi Markdown links dalam text/list properties dan pembaruan internal links
ketika destination dipindah atau diganti nama.
Dukungan tersebut pertama tercatat pada
[1.11.0 early access](https://obsidian.md/changelog/2025-12-10-desktop-v1.11.0/);
perbaikan filename berspasi tercatat pada
[1.11.3](https://obsidian.md/changelog/2025-12-31-desktop-v1.11.3/).
Jadi dukungan bukan fitur baru 1.14.2; versi itu menjadi baseline validasi desktop Unistoria.

Evaluasi awal keliru menyimpulkan kesiapan native link dari halaman Help Properties
yang masih mendokumentasikan batas lama.
Kesimpulan tersebut dikoreksi berdasarkan changelog resmi yang lebih spesifik.
[Dokumentasi internal links](https://obsidian.md/help/links)
tetap menjadi referensi encoding destination dan setting pembaruan link.

Kontrak yang diterapkan ke spec adalah complete Markdown link dalam quoted YAML text value:

```yaml
topic: "[Topic Name](../Topic%20Name.md)"
parent: "[Parent message](./2026-10-01T103000-abc123.md)"
```

Raw path saja berbeda dari sintaks link di atas dan tidak menjadi output kanonis.
Dukungan fitur terkonfirmasi dari changelog;
fixture spesifik relative-link, source/destination moves, encoding, serta updater aktif/nonaktif
tetap memerlukan acceptance vault 1.14.2.
Implementasi path encoding membutuhkan aturan encode/decode sekali, slash, Unicode,
literal `#`/`%`, dan validasi boundary setelah normalisasi.
Path dari frontmatter yang diedit eksternal tidak boleh otomatis memberi hak mutation di luar topic.

### Quick Preview sebagai referensi

Source yang diperiksa: Unimian `src/platform/preview/QuickPreviewModal.ts`
dan `src/platform/preview/detachedLeaf.ts`.
Keduanya memiliki header SPDX `GPL-3.0-only`.
Quick Preview merender read-only pada mobile untuk mencegah fokus editor membuka keyboard saat preview.
Detached leaf memakai constructor/container/parent yang tidak didokumentasikan dalam API publik.

Pengguna mengizinkan reuse GPL dan menetapkan Unistoria khusus desktop.
Arah license spec menjadi GPL-3.0-only untuk reuse/adaptasi source Unimian,
dengan copyright, notices, dan attribution dipertahankan.
Mengedit source seperlunya menyesuaikan perilaku; perubahan itu tidak menghilangkan ketentuan GPL.
Inventaris helper/style yang diadaptasi dan notice artifact masih diperlukan saat implementasi.
Fallback mobile pada source referensi merupakan konteks historis;
Unistoria tidak memerlukan mobile support atau mobile acceptance.
Main window, popout, lifecycle cleanup, dan native-editor fallback tetap perlu diverifikasi.

## Audit Markdown portability

### Dokumen spec

- Frontmatter `title`, `created`, `modified`, dan multiline `tags` sudah ditambahkan;
  `created` menandai waktu metadata ditambahkan, bukan waktu pembuatan spec awal yang tidak tercatat.
- Literal `\n` di metadata plugin diperbaiki menjadi item metadata terpisah.
- Header metadata memakai list dengan tanpa trailing spaces.
- Blank lines berlebih di akhir file dibersihkan.
- Contoh file topic/message memakai fence `markdown`; contoh properti saja memakai `yaml`.
- ATX headings, satu H1, level heading berurutan, dash lists,
  dan fence berbahasa sudah menjadi basis yang baik.
- Tidak ditemukan generated wikilink, callout Obsidian-only, atau embed dalam prosa spec.

### File produk yang dihasilkan

Contoh file produk belum mengikuti metadata minimum skill dan waktu ber-offset.
Namun schema produk adalah kontrak yang harus ditinjau;
jangan menambah `modified` bersama `updated`, `tags`, atau key lain hanya untuk memenuhi lint dokumen.
Putuskan apakah file produk mengadopsi metadata skill atau mempunyai pengecualian yang terdokumentasi.
Metadata dokumen proyek dan schema message/topic perlu dinilai terpisah.

Portability berarti struktur/isi tetap bermakna di luar Obsidian,
bukan semua renderer akan memiliki fitur Properties, updater, atau embed yang sama.
Jangan mengubah arbitrary user Markdown secara otomatis untuk membuatnya lulus style guide.

## Kesiapan menuju plan dan task

Contoh link, desktop-only, dan arah reuse GPL sudah direvisi sesuai instruksi pengguna.
Setelah kontrak R-03, R-04, R-06, R-07, dan R-08 tercatat,
lengkapkan spec secara terbatas dan pertahankan model penyimpanan serta lifecycle yang sudah dipilih.
Requirement tinggi yang belum dapat dibuktikan perlu mempunyai acceptance eksplorasi,
terutama YAML relationship/updater dan native editor.
Jangan menunda risiko storage/editor hingga fase hardening terakhir.

Tambahan engineering context yang dibutuhkan sebelum implementasi:
toolchain pin, command contract, struktur proyek, aturan code style,
strategi test, supported Obsidian version, dan boundary mutation.
Letakkan sesuai concern di AGENTS/setup/ADR dan tautkan dari spec;
tidak perlu mengisi spec produk dengan boilerplate engineering berulang.

Ketika plan dibuat nanti, pilih dependency order dan vertical slices yang menghasilkan flow pengguna utuh.
Task harus menyertakan requirement ID, area/file, dependency,
acceptance, automated verification, native QA, dan update docs.
Satu task idealnya kecil atau sedang, dengan checkpoint setelah 2–3 task.
Jika capability map dipakai, jadikan peta concern yang dapat direview;
tidak perlu mengganti satu spec aktif dengan banyak spec tanpa kebutuhan nyata.

Dokumen ini bukan plan atau task tracker.
Tahap berikutnya adalah keputusan kontrak dan revisi spec yang dapat direview,
lalu PLAN dan TASKS menurut otorisasi fase yang diberikan pengguna.

## Validasi evaluasi

Pemeriksaan dilakukan terhadap file lokal, script implementations, konfigurasi,
dan dokumentasi resmi Obsidian yang ditautkan di atas.
Build/test/deploy kedua plugin tidak dijalankan karena tidak diperlukan untuk review dokumen ini.
Native Properties/link updater pada 1.14.2, editing desktop/popout, dan behavior recovery belum diuji.
Klaim shipped atau accepted tidak dibuat dari hasil pembacaan source saja.
