export type TourStep = {
  step: number;
  selector: string;
  title: string;
  description: string;
  view: string;
};

export const tourSteps: TourStep[] = [
  {
    step: 1,
    selector: '[data-tour="start-tour"]',
    title: 'Selamat Datang di Chika POS',
    description: 'Ayo kita jelajahi beberapa fitur utama yang akan membantu bisnis Anda berkembang. Klik "Lanjutkan" untuk memulai.',
    view: 'overview',
  },
  {
    step: 2,
    selector: '[data-tour="ai-recommendation"]',
    title: 'Rekomendasi Bisnis AI',
    description: 'Dapatkan saran mingguan dan bulanan yang dibuat oleh AI berdasarkan data penjualan Anda untuk mendorong pertumbuhan.',
    view: 'overview',
  },
  {
    step: 3,
    selector: '[data-view="pos"]',
    title: 'Halaman Kasir (POS)',
    description: 'Ini adalah pusat operasional Anda. Catat pesanan dari meja, lacak transaksi, dan kelola pembayaran dengan cepat.',
    view: 'pos',
  },
  {
    step: 4,
    selector: '[data-view="products"]',
    title: 'Manajemen Produk',
    description: 'Tambahkan, ubah, dan kelola semua produk atau item menu Anda di sini. Atur harga, stok, dan kategori dengan mudah.',
    view: 'products',
  },
  {
    step: 5,
    selector: '[data-view="promotions"]',
    title: 'Buat Promosi Loyalitas',
    description: 'Tarik pelanggan untuk kembali dengan membuat promo penukaran poin. Anda juga bisa mendapatkan ide promo dari Chika AI!',
    view: 'promotions',
  },
  {
    step: 6,
    selector: '[data-view="catalog"]',
    title: 'Katalog Digital Publik',
    description: 'Aktifkan dan kelola menu online profesional Anda. Pelanggan bisa melihat menu dan memesan langsung dari ponsel mereka.',
    view: 'catalog',
  },
  {
    step: 7,
    selector: '[data-tour="chika-chat"]',
    title: 'Konsultan Bisnis Pribadi Anda',
    description: 'Punya pertanyaan tentang bisnis? "Tanya Chika" untuk mendapatkan analisis, ide, dan jawaban berdasarkan data toko Anda. Tur selesai, selamat menjelajah!',
    view: 'overview',
  },
];
