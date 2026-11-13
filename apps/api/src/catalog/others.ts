import type { ColorInput, ComponentInfo, SpecSheet, VariantInput, VehicleInput } from '@showroom/shared';
import { comp, na, ref } from './helpers';

/**
 * Additional vehicles sold new in Mongolia. Values cite their source; official manufacturer /
 * distributor documents are preferred, third-party databases are labelled as such. Everything is
 * "reference" until the dealer verifies it for the Mongolian market.
 */
const LEXUS_LX = 'Lexus USA албан сайт — https://www.lexus.com/models/LX (АНУ-ын зах зээл)';
const LEXUS_GX = 'Lexus USA албан сайт — https://www.lexus.com/models/GX (АНУ-ын зах зээл)';
const CARS_COM = 'cars.com (гуравдагч эх сурвалж, АНУ-ын хувилбар) — албан эх сурвалжаар баталгаажуулах шаардлагатай';
const PRADO = 'Toyota Iraq (албан ёсны дистрибьютер), Prado 250 2024 оны техникийн хуудас — https://toyota.iq/Assets/ContentFiles/24YM%20Prado%20Flow%20Chart_094600.pdf';
const BRUNEI = 'Toyota Brunei албан сайт — https://www.toyota.com.bn/car/land-cruiser-250-prado-tx';
const T2 = 'Jetour UAE (албан ёсны дистрибьютер), T2 2025 оны каталог — https://jetouruae.com/static/pdfs/jetour-t2-2025my.pdf';
const DASHING = 'Jetour UAE (албан ёсны дистрибьютер), Dashing 1.6T 2025 оны каталог — https://jetouruae.com/static/pdfs/jetour-dashing-1_6T-2025my-1.pdf';
const BYD_DB = 'CarNewsChina мэдээллийн сан (гуравдагч эх сурвалж, Хятадын хувилбар) — https://db.carnewschina.com/song-plus-dm-i/2023/params';

const lbToKg = (lb: number) => Math.round(lb * 0.4536).toLocaleString('en-US');
const mpgToL = (mpg: number) => (235.215 / mpg).toFixed(1);

/** Component copy for whole-vehicle (showcase) assets: body, wheels, glass, lights. */
export const showcaseComponents: ComponentInfo[] = [
  comp('exterior', 'body_shell', 'Их бие ба салон', 'Их бие', 'Машины гадна их бие болон салоны бүрдэл.', 'Зорчигчдыг хамгаалж, агаарын урсгал, гадаад төрхийг тодорхойлно.'),
  comp('exterior', 'wheels', 'Дугуй ба обуд', 'Дугуй', 'Хайлшин обуд, дугуй, тоормосны бүрдэл.', 'Машины жинг даах, хөтлөх, тоормослох, жолоодох хүчийг зам руу дамжуулна.'),
  comp('exterior', 'windows', 'Шил', 'Их бие', 'Салхины, хажуугийн, арын шил.', 'Харагдах орчин, хамгаалалт өгнө.'),
  comp('exterior', 'headlights', 'Урд гэрэл', 'Гэрэлтүүлэг', 'Урд гэрлийн бүрдэл.', 'Замыг гэрэлтүүлж, бусдад машиныг харагдуулна.'),
  comp('exterior', 'taillights', 'Хойд гэрэл', 'Гэрэлтүүлэг', 'Хойд гэрлийн бүрдэл.', 'Араас ирж буй тээврийн хэрэгсэлд тоормос, эргэлтийн дохио өгнө.'),
];

const paint = { metalness: 0.5, roughness: 0.3, clearcoat: 1 };
const demoBody = (names: [string, string][]): ColorInput[] => names.map(([name, hex], i) => ({ group: 'body', name, hex, finish: paint, availability: 'demonstration', priceDelta: null, variantIds: [], sortOrder: i }));
const v = (name: string, engine: string, transmission: string, drivetrain: string, sortOrder = 1, specOverrides: SpecSheet = {}): VariantInput =>
  ({ name, engine, transmission, drivetrain, price: null, currency: 'MNT', specOverrides, sortOrder });

// ---- Lexus LX 600 -----------------------------------------------------------------------------
export const lx600: VehicleInput = {
  slug: 'lx-600', brand: 'Lexus', model: 'LX 600', generation: 'J310', year: 2025,
  tagline: 'Рамтай бүтэц дээрх тансаг зэрэглэлийн тэргүүлэгч.',
  description: 'Lexus-ийн тэргүүлэх SUV — Land Cruiser 300-тай ижил TNGA-F платформ, хос турботой V6, 10 шатлалт автомат, байнгын 4WD.',
  manifestUrl: '/assets/vehicles/lexus/lx-600/vehicle.manifest.json', posterUrl: null, status: 'published', sortOrder: 2,
  specifications: {
    engine: [
      ref('engine_type', 'Хөдөлгүүрийн төрөл', 'V6, хос турботой бензин (V35A-FTS)', undefined, LEXUS_LX),
      ref('displacement', 'Ажлын эзлэхүүн', '3,445', 'см³', CARS_COM),
      ref('max_power', 'Дээд чадал', '409 м.х (305 кВт) / 5,200 эрг/мин', undefined, `${LEXUS_LX}; эрг/мин: ${CARS_COM}`),
      ref('max_torque', 'Дээд эргүүлэх момент', '650 Н·м (479 lb-ft) / 2,000 эрг/мин', undefined, LEXUS_LX),
      ref('fuel_type', 'Түлш', 'Бензин (premium)', undefined, CARS_COM),
      ref('aspiration', 'Агаар шахалт', 'Хос турбо цэнэглэгч', undefined, LEXUS_LX),
    ],
    transmission: [ref('transmission_type', 'Хурдны хайрцаг', '10 шатлалт Direct-Shift автомат', undefined, LEXUS_LX), ref('gears', 'Шатлалын тоо', '10', undefined, LEXUS_LX), ref('drivetrain', 'Хөтлөгч', 'Байнгын бүх дугуйн хөтлөгч (4WD)', undefined, LEXUS_LX)],
    dimensions: [ref('length', 'Урт', '5,105', 'мм', CARS_COM), ref('width', 'Өргөн (тольгүй)', '1,981', 'мм', CARS_COM), ref('height', 'Өндөр', '1,880', 'мм', CARS_COM), ref('wheelbase', 'Тэнхлэг хоорондын зай', '2,845', 'мм', CARS_COM), na('ground_clearance', 'Газраас өндөр (клиренс)')],
    capacity: [ref('seats', 'Суудлын тоо', '7', undefined, LEXUS_LX), ref('towing_braked', 'Чирэх чадвар', lbToKg(8000), 'кг', `${LEXUS_LX}; 8,000 lb`), ref('kerb_weight', 'Өөрийн жин', lbToKg(5665), 'кг', CARS_COM)],
    performance: [ref('fuel_consumption', 'Түлшний зарцуулалт (холимог)', mpgToL(19), 'л/100 км', `${LEXUS_LX}; EPA 19 mpg`), na('acceleration', 'Хурдатгал 0–100 км/ц')],
    safety: [ref('driver_assistance', 'Жолоочид туслах систем', 'Lexus Safety System+ (агуулга нь зах зээлээс хамаарна)', undefined, LEXUS_LX), na('airbags', 'Аюулгүйн дэр')],
    ownership: [ref('warranty', 'Үйлдвэрийн баталгаа', 'Дилерээс тодруулна уу', undefined, 'Зах зээл бүрт өөр — Монгол дахь албан ёсны дилерээс тодруулна уу')],
  },
  components: showcaseComponents,
};
export const lx600Variants: VariantInput[] = [v('LX 600', 'V35A-FTS 3.4 л хос турбо V6', '10 шатлалт автомат', 'Байнгын 4WD')];
export const lx600Colors = demoBody([['Цагаан', '#e9e8e3'], ['Хар', '#101113'], ['Мөнгөлөг', '#b3b6ba'], ['Бараан саарал', '#4c5054']]);

// ---- Lexus GX 550 -----------------------------------------------------------------------------
export const gx550: VehicleInput = {
  slug: 'gx-550', brand: 'Lexus', model: 'GX 550', generation: 'J250', year: 2025,
  tagline: 'Бартаат замд зориулагдсан тансаг SUV.',
  description: 'Шинэ үеийн GX нь Land Cruiser 250-тай ижил TNGA-F платформ дээр хос турботой V6, байнгын 4WD-тэй. Overtrail хувилбар нь бартаат замд зориулагдсан.',
  manifestUrl: '/assets/vehicles/lexus/gx-550/vehicle.manifest.json', posterUrl: null, status: 'published', sortOrder: 4,
  specifications: {
    engine: [
      ref('engine_type', 'Хөдөлгүүрийн төрөл', 'V6, хос турботой бензин', undefined, LEXUS_GX),
      ref('displacement', 'Ажлын эзлэхүүн', '3.4', 'л', CARS_COM),
      ref('max_power', 'Дээд чадал', '349 м.х (260 кВт) / 4,800 эрг/мин', undefined, `${LEXUS_GX}; эрг/мин: ${CARS_COM}`),
      ref('max_torque', 'Дээд эргүүлэх момент', '650 Н·м (479 lb-ft) / 2,000 эрг/мин', undefined, CARS_COM),
      ref('aspiration', 'Агаар шахалт', 'Хос турбо цэнэглэгч', undefined, LEXUS_GX),
    ],
    transmission: [ref('transmission_type', 'Хурдны хайрцаг', '10 шатлалт автомат', undefined, CARS_COM), ref('drivetrain', 'Хөтлөгч', 'Байнгын бүх дугуйн хөтлөгч (4WD)', undefined, LEXUS_GX)],
    dimensions: [na('length', 'Урт'), ref('wheelbase', 'Тэнхлэг хоорондын зай', '2,850', 'мм', `${CARS_COM}; 112.2 in`), na('ground_clearance', 'Газраас өндөр (клиренс)')],
    capacity: [ref('seats', 'Суудлын тоо', '7 хүртэл', undefined, LEXUS_GX), ref('towing_braked', 'Чирэх чадвар', lbToKg(9063), 'кг', `${LEXUS_GX}; 9,063 lb (сайт дээр 9,096 lb гэсэн утга бас бий — баталгаажуулна уу)`)],
    performance: [ref('fuel_consumption', 'Түлшний зарцуулалт (холимог)', mpgToL(17), 'л/100 км', `${LEXUS_GX}; EPA 17 mpg`)],
    ownership: [ref('warranty', 'Үйлдвэрийн баталгаа', 'Дилерээс тодруулна уу', undefined, 'Зах зээл бүрт өөр — Монгол дахь албан ёсны дилерээс тодруулна уу')],
  },
  components: showcaseComponents,
};
export const gx550Variants: VariantInput[] = [v('GX 550 Overtrail', '3.4 л хос турбо V6', '10 шатлалт автомат', 'Байнгын 4WD')];
export const gx550Colors = demoBody([['Цагаан', '#e7e6e0'], ['Хар', '#111214'], ['Ногоон саарал', '#5d6455'], ['Элсэн шаргал', '#b8a888']]);

// ---- Toyota Land Cruiser 250 (Prado) -----------------------------------------------------------
export const lc250: VehicleInput = {
  slug: 'land-cruiser-250', brand: 'Toyota', model: 'Land Cruiser 250 (Prado)', generation: '250 цуврал', year: 2025,
  tagline: 'Land Cruiser-ийн уламжлал, шинэ үеийн бүтэц.',
  description: 'Шинэ Prado 250 нь TNGA-F платформ дээр 2.4 л турботой бензин хөдөлгүүр, 8 шатлалт автомат хайрцаг, байнгын 4WD-тэй.',
  manifestUrl: '/assets/vehicles/toyota/land-cruiser-250/vehicle.manifest.json', posterUrl: null, status: 'published', sortOrder: 3,
  specifications: {
    engine: [
      ref('engine_type', 'Хөдөлгүүрийн төрөл', 'T24A-FTS, 4 цилиндр, турботой бензин', undefined, PRADO),
      ref('displacement', 'Ажлын эзлэхүүн', '2,393', 'см³', PRADO),
      ref('max_power', 'Дээд чадал', '277 м.х / 6,000 эрг/мин', undefined, PRADO),
      ref('max_torque', 'Дээд эргүүлэх момент', '430 Н·м / 4,300–4,500 эрг/мин', undefined, PRADO),
      ref('fuel_type', 'Түлш', 'Бензин', undefined, PRADO),
      ref('aspiration', 'Агаар шахалт', 'Турбо цэнэглэгч', undefined, PRADO),
    ],
    transmission: [ref('transmission_type', 'Хурдны хайрцаг', 'Direct Shift 8 шатлалт автомат', undefined, PRADO), ref('gears', 'Шатлалын тоо', '8', undefined, PRADO), ref('drivetrain', 'Хөтлөгч', 'Байнгын 4WD, LSD-тэй төв дифференциал', undefined, PRADO), ref('diff_lock', 'Дифференциалын түгжээ', 'Хойд (цахилгаан)', undefined, PRADO)],
    dimensions: [ref('length', 'Урт', '4,925', 'мм', PRADO), ref('width', 'Өргөн', '1,980', 'мм', PRADO), ref('height', 'Өндөр', '1,870', 'мм', PRADO), ref('wheelbase', 'Тэнхлэг хоорондын зай', '2,850', 'мм', BRUNEI), ref('fuel_tank', 'Түлшний савны багтаамж', '110', 'л', PRADO)],
    capacity: [na('seats', 'Суудлын тоо'), na('towing_braked', 'Чирэх чадвар')],
    comfort: [ref('ac', 'Агааржуулагч', 'Урд: автомат 2 бүс, хойд: агааржуулагч', undefined, PRADO), ref('seat_mat', 'Суудлын бүрээс', 'Арьс', undefined, PRADO), ref('seat_power', 'Цахилгаан суудал', 'Жолооч 8 чиглэл + санах ой, зорчигч 4 чиглэл', undefined, PRADO)],
    multimedia: [ref('screen_m', 'Дэлгэц', '12.3 инч (навигацтай)', undefined, PRADO), ref('audio_m', 'Аудио', '10 чанга яригч', undefined, PRADO), ref('usb', 'USB', 'Урд 2 + 2-р эгнээ 2 + 3-р эгнээ 2', undefined, PRADO)],
    safety: [ref('airbags', 'Аюулгүйн дэр', 'Жолооч, зорчигч (урд + өвдөг)', undefined, PRADO)],
    ownership: [ref('warranty', 'Үйлдвэрийн баталгаа', 'Дилерээс тодруулна уу', undefined, 'Зах зээл бүрт өөр — Монгол дахь албан ёсны дилерээс тодруулна уу')],
  },
  components: [
    ...showcaseComponents.filter((c) => c.id !== 'wheels'),
    comp('exterior', 'wheels', 'Дугуй ба обуд', 'Дугуй', 'Хайлшин обуд, дугуй.', 'Машины жинг даах, хөтлөх, тоормослох хүчийг зам руу дамжуулна.', [ref('tyre', 'Дугуйн хэмжээ', '265/65R18 эсвэл 265/70R18 (7.5J хайлш)', undefined, PRADO)]),
  ],
};
export const lc250Variants: VariantInput[] = [v('2.4 Turbo', 'T24A-FTS 2.4 л турбо', '8 шатлалт автомат', 'Байнгын 4WD')];
export const lc250Colors = demoBody([['Цагаан сувдан', '#e8e5dc'], ['Хар', '#111214'], ['Элсэн шаргал', '#b9a98a'], ['Саарал', '#666a6e']]);

// ---- Jetour T2 ------------------------------------------------------------------------------
export const jetourT2: VehicleInput = {
  slug: 't2', brand: 'Jetour', model: 'T2', generation: null, year: 2025,
  tagline: 'Дөрвөлжин дүрстэй, чадвартай, бартаат замд бэлэн.',
  description: '2.0 л турботой хөдөлгүүр, 7 шатлалт DCT, бүх дугуйн хөтлөгч, төв ба хойд дифференциалын түгжээтэй бартаат замын SUV. Интерактив 3D: олдсон загвар дугуйгүй байсан тул лицензтэй загвар ирэхэд нээгдэнэ.',
  manifestUrl: null, posterUrl: null, status: 'published', sortOrder: 5,
  specifications: {
    engine: [
      ref('engine_type', 'Хөдөлгүүрийн төрөл', '2.0 л, 4 цилиндр, турботой бензин', undefined, T2),
      ref('displacement', 'Ажлын эзлэхүүн', '1,998', 'см³', T2),
      ref('max_power', 'Дээд чадал', '187 кВт (254 м.х)', undefined, T2),
      ref('max_torque', 'Дээд эргүүлэх момент', '390 Н·м', undefined, T2),
      ref('fuel_type', 'Түлш', 'Бензин', undefined, T2),
    ],
    transmission: [ref('transmission_type', 'Хурдны хайрцаг', '7 шатлалт DCT', undefined, T2), ref('drivetrain', 'Хөтлөгч', 'Бүх дугуйн хөтлөгч (4WD)', undefined, T2), ref('diff_lock', 'Дифференциалын түгжээ', 'Төв + хойд (цахилгаан)', undefined, T2)],
    dimensions: [ref('length', 'Урт', '4,785', 'мм', T2), ref('width', 'Өргөн', '2,006', 'мм', T2), ref('height', 'Өндөр', '1,880', 'мм', T2), ref('wheelbase', 'Тэнхлэг хоорондын зай', '2,800', 'мм', T2), ref('fuel_tank', 'Түлшний савны багтаамж', '70', 'л', T2)],
    capacity: [ref('seats', 'Суудлын тоо', '5', undefined, T2)],
    offroad: [ref('ground_clearance_off', 'Газраас өндөр', '220', 'мм', T2), ref('approach', 'Ойртох өнцөг', '28°', undefined, T2), ref('ramp', 'Даваа гарах өнцөг', '18°', undefined, T2), ref('departure', 'Холдох өнцөг', '30°', undefined, T2), ref('wading_sensor', 'Ус гатлах мэдрэгч', 'Бий', undefined, T2)],
    safety: [ref('driver_assistance', 'Жолоочид туслах систем', 'ACC, эгнээнээс гарах анхааруулга (LDW), 360° камер, хойд мөргөлтийн анхааруулга', undefined, T2), ref('airbags', 'Аюулгүйн дэр', 'Урд, хажуугийн, хөшиг', undefined, T2)],
    comfort: [ref('seat_vent', 'Суудлын агааржуулалт', 'Бий', undefined, T2), ref('lights', 'Гэрэл', 'Matrix LED', undefined, T2)],
    multimedia: [ref('audio_m', 'Аудио', 'Sony', undefined, T2)],
    ownership: [ref('warranty', 'Үйлдвэрийн баталгаа', 'Дилерээс тодруулна уу', undefined, 'Зах зээл бүрт өөр — Монгол дахь албан ёсны дилерээс тодруулна уу')],
  },
  components: showcaseComponents,
};
export const t2Variants: VariantInput[] = [v('2.0T 4WD', '2.0 л турбо бензин', '7 шатлалт DCT', '4WD')];
export const t2Colors = demoBody([['Цагаан', '#e6e6e2'], ['Хар', '#121314'], ['Ногоон', '#56614e'], ['Саарал', '#6b6f73']]);

// ---- Jetour Dashing -----------------------------------------------------------------------------
export const dashing: VehicleInput = {
  slug: 'dashing', brand: 'Jetour', model: 'Dashing', generation: null, year: 2025,
  tagline: 'Хотын спорт загварын кроссовер.',
  description: '1.6 л турботой хөдөлгүүр, 7 шатлалт DCT, урд хөтлөгчтэй, 5 суудалтай кроссовер.',
  manifestUrl: '/assets/vehicles/jetour/dashing/vehicle.manifest.json', posterUrl: null, status: 'published', sortOrder: 6,
  specifications: {
    engine: [
      ref('engine_type', 'Хөдөлгүүрийн төрөл', '1.6 TGDI, турботой бензин', undefined, DASHING),
      ref('displacement', 'Ажлын эзлэхүүн', '1,598', 'см³', DASHING),
      ref('max_power', 'Дээд чадал', '140 кВт (190 м.х) / 5,500 эрг/мин', undefined, DASHING),
      ref('max_torque', 'Дээд эргүүлэх момент', '290 Н·м / 2,000–4,000 эрг/мин', undefined, DASHING),
      ref('fuel_type', 'Түлш', 'Бензин', undefined, DASHING),
    ],
    transmission: [ref('transmission_type', 'Хурдны хайрцаг', '7 шатлалт DCT', undefined, DASHING), ref('drivetrain', 'Хөтлөгч', 'Урд хөтлөгч (FF)', undefined, DASHING)],
    dimensions: [ref('length', 'Урт', '4,590', 'мм', DASHING), ref('width', 'Өргөн', '1,900', 'мм', DASHING), ref('height', 'Өндөр', '1,685', 'мм', DASHING), ref('wheelbase', 'Тэнхлэг хоорондын зай', '2,720', 'мм', DASHING), ref('ground_clearance', 'Газраас өндөр (клиренс)', '160', 'мм', DASHING), ref('fuel_tank', 'Түлшний савны багтаамж', '57', 'л', DASHING)],
    capacity: [ref('seats', 'Суудлын тоо', '5', undefined, DASHING)],
    comfort: [ref('seat_heat', 'Суудлын халаагуур', 'Бий', undefined, DASHING), ref('ambient', 'Салоны гэрэлтүүлэг', 'Бий', undefined, DASHING), ref('wireless_c', 'Утасгүй цэнэглэгч', 'Бий', undefined, DASHING), ref('hud', 'HUD дэлгэц', 'Бий', undefined, DASHING)],
    multimedia: [ref('phone', 'Утас холбох', 'Apple CarPlay, Android Auto', undefined, DASHING)],
    safety: [ref('isofix', 'ISOFIX', 'Бий', undefined, DASHING), ref('driver_assistance', 'Жолоочид туслах систем', 'Жолоочид туслах ухаалаг систем, хойд мөргөлтийн анхааруулга, TPMS', undefined, DASHING)],
    ownership: [ref('warranty', 'Үйлдвэрийн баталгаа', 'Дилерээс тодруулна уу', undefined, 'Зах зээл бүрт өөр — Монгол дахь албан ёсны дилерээс тодруулна уу')],
  },
  components: showcaseComponents,
};
export const dashingVariants: VariantInput[] = [v('1.6T', '1.6 TGDI турбо бензин', '7 шатлалт DCT', 'Урд хөтлөгч')];
export const dashingColors = demoBody([['Цагаан', '#ecebe7'], ['Хар', '#111214'], ['Цэнхэр', '#2c4e78'], ['Мөнгөлөг', '#b2b5b9']]);

// ---- BYD Song Plus ------------------------------------------------------------------------------
export const songPlus: VehicleInput = {
  slug: 'song-plus', brand: 'BYD', model: 'Song Plus DM-i', generation: null, year: 2024,
  tagline: 'Залгууртай эрлийз (PHEV) гэр бүлийн SUV.',
  description: 'BYD-ийн DM-i залгууртай эрлийз систем: 1.5 л бензин хөдөлгүүр цахилгаан мотортой хамтран ажиллана. Үзүүлэлт нь хувилбараас хамааран өөр — дилерээс баталгаажуулна уу.',
  manifestUrl: '/assets/vehicles/byd/song-plus/vehicle.manifest.json', posterUrl: null, status: 'published', sortOrder: 7,
  specifications: {
    engine: [
      ref('engine_type', 'Хүчний систем', 'DM-i залгууртай эрлийз: 1.5 л бензин + цахилгаан мотор', undefined, BYD_DB),
      ref('max_power', 'Хөдөлгүүрийн чадал', '81 кВт', undefined, `${BYD_DB}; 2023 оны хувилбар`),
      ref('motor_power', 'Цахилгаан моторын чадал', '145 кВт (197 PS)', undefined, `${BYD_DB}; 2023 оны хувилбар (2025: 160 кВт)`),
      ref('fuel_type', 'Түлш', 'Бензин + цахилгаан (залгууртай)', undefined, BYD_DB),
    ],
    transmission: [ref('transmission_type', 'Хурдны хайрцаг', 'E-CVT (DM-i)', undefined, BYD_DB), ref('drivetrain', 'Хөтлөгч', 'Урд хөтлөгч', undefined, BYD_DB)],
    dimensions: [ref('length', 'Урт', '4,775', 'мм', BYD_DB), ref('width', 'Өргөн', '1,890', 'мм', BYD_DB), ref('height', 'Өндөр', '1,670', 'мм', BYD_DB), ref('wheelbase', 'Тэнхлэг хоорондын зай', '2,765', 'мм', BYD_DB)],
    capacity: [na('seats', 'Суудлын тоо'), na('battery', 'Батерейн багтаамж')],
    ownership: [ref('warranty', 'Үйлдвэрийн баталгаа', 'Дилерээс тодруулна уу', undefined, 'Зах зээл бүрт өөр — Монгол дахь албан ёсны дилерээс тодруулна уу')],
  },
  components: showcaseComponents.filter((c) => c.id === 'body_shell'),
};
export const songPlusVariants: VariantInput[] = [v('DM-i', '1.5 л + цахилгаан мотор (PHEV)', 'E-CVT', 'Урд хөтлөгч')];

export const blankSpecs = {};
