// N NAILS Planner — данните за салона и проектите.
// Тук се сменя всичко, което може да се промени с времето (телефон, линкове, сайт за записване).

export const APP_VERSION = '1.0.7';

export const SALON = {
  name: 'N NAILS',
  phone: '+359898568633',
  phoneDisplay: '0898 568 633',
  address: 'ул. „Никола Габровски“ 102, Студентски град, София',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('N NAILS, ул. Никола Габровски 102, София'),
  // Когато новият сайт тръгне официално, сложи адреса на страницата за записване тук.
  // Докато е празно, бутонът „Запиши час“ звъни на телефона на салона.
  bookingUrl: '',
  social: [
    { k: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/nnails.salon' },
    { k: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/nnails.salon' },
    { k: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@nnails_salon' },
    { k: 'telegram', label: 'Telegram', url: 'https://t.me/nnailssalon' },
  ],
};

export const PROJECTS = [
  {
    id: 'nanokti',
    name: 'На нокти',
    logo: 'img/nanokti-logo.webp',
    text: 'Нашият подкаст и YouTube канал. В него говорим открито за ноктите, красотата и всичко, което се случва зад кулисите на един салон.',
    links: [
      { k: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/channel/UCA8x4LjU1eG01xWkycfQOnQ' },
      { k: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/nanokti.podcast' },
      { k: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@nanokti.podcast' },
      { k: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61573848320702' },
    ],
  },
  {
    id: 'nfunds',
    name: 'N FUNDS',
    logo: 'img/nfunds-logo.webp',
    text: 'Пари с ред за дома и за салона. С „Моите пари“ подреждаш домашния си бюджет по японския метод Какебо. Плащаш веднъж и остава твое завинаги.',
    links: [
      { k: 'web', label: 'nfunds.vip', url: 'https://nfunds.vip' },
      { k: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/nfunds.vip' },
    ],
  },
];
