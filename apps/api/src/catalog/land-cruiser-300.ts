import type { ColorInput, ComponentInfo, SpecSheet, VariantInput, VehicleInput } from '@showroom/shared';
import { comp, na, ref } from './helpers';

/**
 * Official distributor data. Status stays "reference" (Лавлагаа) until the dealer confirms each value
 * for the Mongolian market, grade and model year in the dashboard.
 */
const IQ = 'Toyota Iraq (албан ёсны дистрибьютер), LC300 2024 оны техникийн хуудас — https://toyota.iq/Assets/ContentFiles/24YM%20LC300%20Flow%20Chart%20Specs_222709.pdf';
const AU = 'Toyota Australia, LandCruiser 300 техникийн хүснэгт (2026.09) — https://www.toyota.com.au/landcruiser-300 — Австралийн зах зээлийн утга';
const IQWEB = 'Toyota Iraq албан сайт — https://www.toyota.iq/english/land-cruiser-300/specs';
const DEALER = 'Баталгаат хугацаа, үйлчилгээний нөхцөл зах зээл бүрт өөр — Монгол дахь албан ёсны дилерээс тодруулна уу';
const GLOBAL = 'Toyota Motor Corporation, Land Cruiser 300 нээлтийн мэдээ (2021 оны 8-р сар) — Монгол зах зээлд баталгаажуулах шаардлагатай';

export const specs: SpecSheet = {
  engine: [
    ref('engine_type', 'Хөдөлгүүрийн төрөл', 'V35A-FTS, V6, хос турботой бензин', undefined, IQ),
    ref('displacement', 'Ажлын эзлэхүүн', '3,445', 'см³', IQ),
    ref('max_power', 'Дээд чадал', '305 кВт (409 м.х) / 5,200 эрг/мин', undefined, IQ),
    ref('max_torque', 'Дээд эргүүлэх момент', '650 Н·м / 2,000–3,600 эрг/мин', undefined, IQ),
    ref('fuel_type', 'Түлш', 'Бензин', undefined, IQ),
    ref('aspiration', 'Агаар шахалт', 'Хос турбо цэнэглэгч', undefined, IQ),
    ref('bore_stroke', 'Цилиндрийн диаметр × явалт', '85.5 × 100.0', 'мм', AU),
  ],
  transmission: [
    ref('transmission_type', 'Хурдны хайрцаг', 'Автомат (10AT)', undefined, IQ),
    ref('gears', 'Шатлалын тоо', '10', undefined, IQ),
    ref('drivetrain', 'Хөтлөгч', 'Байнгын бүх дугуйн хөтлөгч (4WD)', undefined, GLOBAL),
    ref('diff_lock', 'Дифференциалын түгжээ', 'Хойд', undefined, IQ),
  ],
  dimensions: [
    ref('length', 'Урт', '4,985', 'мм', IQ),
    ref('width', 'Өргөн', '1,980', 'мм', IQ),
    ref('height', 'Өндөр', '1,880', 'мм', IQ),
    ref('wheelbase', 'Тэнхлэг хоорондын зай', '2,850', 'мм', AU),
    na('ground_clearance', 'Газраас өндөр (клиренс)'),
    ref('turning_radius', 'Эргэлтийн хамгийн бага радиус', '5.9', 'м', IQ),
    ref('fuel_tank', 'Түлшний савны багтаамж', '110', 'л', IQ),
  ],
  capacity: [
    ref('seats', 'Суудлын тоо', '7', undefined, IQWEB),
    ref('doors', 'Хаалганы тоо', '5', undefined, IQWEB),
    ref('towing_braked', 'Чирэх чадвар (тоормостой чиргүүл)', '3,500', 'кг', AU),
    ref('towing_unbraked', 'Чирэх чадвар (тоормосгүй чиргүүл)', '750', 'кг', AU),
    ref('gvm', 'Бүрэн жин (GVM)', '3,280', 'кг', AU),
    ref('gcm', 'Чиргүүлтэй нийт жин (GCM)', '6,750', 'кг', AU),
    na('kerb_weight', 'Өөрийн жин'),
  ],
  performance: [na('acceleration', 'Хурдатгал 0–100 км/ц'), na('top_speed', 'Дээд хурд'), na('fuel_consumption', 'Түлшний зарцуулалт (холимог)')],
  offroad: [
    ref('approach', 'Ойртох өнцөг', '31°', undefined, `${AU}; зэрэглэлээс хамаарна`),
    ref('departure', 'Холдох өнцөг', '24–25°', undefined, `${AU}; зэрэглэлээс хамаарна`),
    na('ground_clearance_off', 'Газраас өндөр'),
    ref('diff_lock_off', 'Дифференциал түгжээ', 'Хойд (GR Sport: урд ба хойд)', undefined, `${IQ}; ${AU}`),
    ref('crawl', 'Crawl Control', 'Бий', undefined, IQ),
    ref('dac', 'Уруу буух туслах (DAC)', 'Бий', undefined, IQ),
    ref('mts', 'Multi-Terrain Select', 'Зэрэглэлээс хамаарна', undefined, AU),
    ref('transfer', 'Хуваарилах хайрцаг', 'Бууруулсан дамжуулгатай (low range)', undefined, GLOBAL),
  ],
  safety: [
    ref('airbags', 'Аюулгүйн дэр', 'Жолооч 1, зорчигч 2 шатлалт, хөшиг (урд + 2, 3-р эгнээ), урд хажуугийн', undefined, IQ),
    ref('abs', 'ABS', 'Бий (ABS + BA)', undefined, IQ),
    ref('stability_control', 'Тогтворжуулалтын систем', 'VSC + A-TRC + TSC + DAC + Crawl Control', undefined, IQ),
    ref('driver_assistance', 'Жолоочид туслах систем', 'Зогсоолын мэдрэгч (урд 4 + хойд 4), уул өгсөхөд туслах, хурд тогтоогч, цахилгаан гар тоормос + Brake Hold', undefined, IQ),
    ref('tss', 'Toyota Safety Sense', 'Бий (агуулга нь зах зээлээс хамаарна)', undefined, IQWEB),
    ref('camera', 'Камер', 'Арын камер (VX: олон талын камер)', undefined, IQ),
  ],
  comfort: [
    ref('ac', 'Агааржуулагч', 'Автомат, урд зүүн/баруун тусдаа + хойд хөргөгч', undefined, IQ),
    ref('seat_mat', 'Суудлын бүрээс', 'Хиймэл арьс (GX-R) / гөлгөр арьс (VX)', undefined, IQ),
    ref('seat_vent', 'Суудлын агааржуулалт', 'Жолооч + зорчигч (VX: + хойд)', undefined, IQ),
    ref('seat_power', 'Цахилгаан суудал', 'Урд (VX: санах ойтой)', undefined, IQ),
    ref('keyless', 'Түлхүүргүй нэвтрэлт', 'Smart entry + товчлуураар асаах', undefined, IQ),
    ref('sunroof_c', 'Люк', 'Бий', undefined, IQ),
    ref('power_door_c', 'Цахилгаан ачааны хаалга', 'Бий (зэрэглэлээс хамаарна)', undefined, IQ),
    ref('cool_box_c', 'Хөргөгч хайрцаг', 'Бий', undefined, IQ),
    ref('wireless_c', 'Утасгүй цэнэглэгч', 'Бий', undefined, IQ),
    ref('rse', 'Хойд суудлын дэлгэц', 'GX-R High, VX', undefined, IQ),
    ref('cruise', 'Хурд тогтоогч', 'Бий', undefined, IQ),
  ],
  multimedia: [
    ref('screen_m', 'Дэлгэц', '12.3 инч', undefined, IQWEB),
    ref('audio_m', 'Аудио', 'JBL, 14 чанга яригч', undefined, IQWEB),
    ref('phone', 'Утас холбох', 'Apple CarPlay, Android Auto, Bluetooth', undefined, IQWEB),
    ref('usb', 'USB', 'Урд 1 + 2-р эгнээ 2 + 3-р эгнээ 1', undefined, IQ),
  ],
  ownership: [
    ref('warranty', 'Үйлдвэрийн баталгаа', 'Дилерээс тодруулна уу', undefined, DEALER),
    na('service_interval', 'Үйлчилгээний давтамж'),
  ],
};

/** VX Twin Turbo differences (same source). */
export const vxOverrides: SpecSheet = {
  safety: [ref('airbags', 'Аюулгүйн дэр', 'Жолооч 1, зорчигч 2 шатлалт, хөшиг (урд + 2, 3-р эгнээ), хажуугийн (урд + 2-р эгнээ)', undefined, IQ)],
};

/** Diesel: figures from Toyota's global launch material, not from the Iraq sheet. */
export const dieselOverrides: SpecSheet = {
  engine: [
    ref('engine_type', 'Хөдөлгүүрийн төрөл', 'F33A-FTV, V6, хос турботой дизель', undefined, AU),
    ref('displacement', 'Ажлын эзлэхүүн', '3,346', 'см³', AU),
    ref('max_power', 'Дээд чадал', '227 кВт / 4,000 эрг/мин', undefined, AU),
    ref('max_torque', 'Дээд эргүүлэх момент', '700 Н·м / 1,600–2,600 эрг/мин', undefined, AU),
    ref('fuel_type', 'Түлш', 'Дизель', undefined, AU),
    ref('bore_stroke', 'Цилиндрийн диаметр × явалт', '86.0 × 96.0', 'мм', AU),
  ],
  dimensions: [ref('fuel_tank', 'Түлшний савны багтаамж', '80 + 30 (нэмэлт сав) = 110', 'л', AU)],
  capacity: [ref('kerb_weight', 'Өөрийн жин', '2,480–2,620', 'кг', `${AU}; зэрэглэлээс хамаарна`)],
  performance: [ref('fuel_consumption', 'Түлшний зарцуулалт (холимог)', '8.9', 'л/100 км', `${AU}; ADR 81/02 лабораторийн туршилт`)],
};

/** Performance Hybrid (V35A-FTS + 1 мотор) — Toyota Australia 2026. */
export const hybridOverrides: SpecSheet = {
  engine: [
    ref('engine_type', 'Хөдөлгүүрийн төрөл', '3.5 л V6 iFORCE MAX хос турбо бензин + цахилгаан мотор (Performance Hybrid)', undefined, AU),
    ref('displacement', 'Ажлын эзлэхүүн', '3,445', 'см³', AU),
    ref('max_power', 'Дээд чадал (нийлбэр)', '341 кВт (хөдөлгүүр: 305 кВт / 5,200 эрг/мин)', undefined, AU),
    ref('max_torque', 'Дээд эргүүлэх момент (нийлбэр)', '790 Н·м (хөдөлгүүр: 650 Н·м / 2,000–3,600 эрг/мин)', undefined, AU),
    ref('fuel_type', 'Түлш', 'Бензин 95+ октан', undefined, AU),
    ref('bore_stroke', 'Цилиндрийн диаметр × явалт', '85.5 × 100.0', 'мм', AU),
  ],
  dimensions: [ref('fuel_tank', 'Түлшний савны багтаамж', '98', 'л', AU)],
  performance: [ref('fuel_consumption', 'Түлшний зарцуулалт (холимог)', '10.0', 'л/100 км', `${AU}; ADR 81/02 лабораторийн туршилт`)],
};

export const components: ComponentInfo[] = [
  // Гадна тал
  comp('exterior', 'body_shell', 'Их бие', 'Их бие', 'Салон болон хаалга, капотыг агуулсан будагтай гадна их бие.', 'Агаарын урсгал, гадны нөлөөллөөс хамгаална. Рамтай (body-on-frame) бүтэцтэй тул их бие тусдаа шат хэлбэрийн рам дээр суурилдаг.'),
  comp('exterior', 'front_bumper', 'Урд бампер ба сараалж', 'Их бие', 'Урд бампер, радиаторын сараалж, доод хамгаалалт, манангийн гэрэл.', 'Бага хурдны мөргөлтийн цохилтыг шингээж, радиатор руу агаар нэвтрүүлнэ.', [ref('grille', 'Сараалж', 'Мөнгөлөг будаг + хромон бүрээс', undefined, IQ), ref('fog', 'Манангийн гэрэл', 'LED', undefined, IQ)]),
  comp('exterior', 'grille', 'Радиаторын сараалж', 'Их бие', 'Хөргөлтийн системд агаар оруулах урд нүх.', 'Радиаторыг хог чулуунаас хамгаалж агаар нэвтрүүлнэ.'),
  comp('exterior', 'headlights', 'Урд гэрэл', 'Гэрэлтүүлэг', 'Ойрын болон алсын гэрэл, өдрийн гэрэл (DRL).', 'Замыг гэрэлтүүлж, бусдад машиныг харагдуулна.', [ref('headlamp_gxr', 'Гэрлийн төрөл (GX-R)', '3 тусгагчтай ойрын/алсын, LED эргэлтийн дохио', undefined, IQ), ref('headlamp_vx', 'Гэрлийн төрөл (VX)', 'Ойрын: 2-Bi LED, алсын: тусгагч, дараалсан эргэлтийн дохио', undefined, IQ), ref('leveling', 'Гэрлийн өндрийн тохируулга', 'Бий (VX: динамик автомат)', undefined, IQ)]),
  comp('exterior', 'hood', 'Капот', 'Их бие', 'Хөдөлгүүрийн хэсгийг бүрхсэн нугастай хавтан.', 'Хөдөлгүүрт засвар үйлчилгээ хийх боломж олгож, явган зорчигчийн хамгаалалтад оролцоно.', [ref('bonnet_light', 'Капот доорх гэрэл', 'Бий', undefined, IQ)]),
  comp('exterior', 'doors', 'Хаалга', 'Их бие', 'Дөрвөн хажуугийн хаалга — шил, цоож, дотор доторлогоотой.', 'Салонд нэвтрэх боломж олгож, хажуугийн мөргөлтөөс хамгаална.', [ref('smart_entry', 'Ухаалаг түлхүүр', 'Smart entry + товчлуураар асаах', undefined, IQ)]),
  comp('exterior', 'mirrors', 'Хажуугийн толь', 'Их бие', 'Гадна талын арын харах толь.', 'Жолоочид ар тал, хажуугаа харах боломж олгоно.', [ref('mirror_spec', 'Боломжууд', 'Цахилгаан тохируулга, автоматаар эвхэгддэг, бүдгэрдэг (ECM), ухрахад доош хазайдаг', undefined, IQ)]),
  comp('exterior', 'wheels', 'Дугуй ба обуд', 'Дугуй', 'Хайлшин обуд, дугуй.', 'Машины жинг даах, хөтлөх, тоормослох, жолоодох хүчийг зам руу дамжуулна.', [ref('tyre_gxr', 'Дугуйн хэмжээ (GX-R)', '265/65R18 (7½J хайлш)', undefined, IQ), ref('tyre_vx', 'Дугуйн хэмжээ (VX / GX-R High)', '265/55R20 (8J хайлш)', undefined, IQ)]),
  comp('exterior', 'windows', 'Шил', 'Их бие', 'Салхины, хажуугийн болон арын шил.', 'Харагдах орчин, ус чийгнээс хамгаалалт өгнө; салхины шил бүтцийн хатуулагт нэмэр болно.', [ref('windshield', 'Салхины шил', 'Ногоон өнгөтэй, дээд туузтай, дулаан тусгагч', undefined, IQ)]),
  comp('exterior', 'roof', 'Дээвэр', 'Их бие', 'Дээврийн хавтан, люк.', 'Салоны дээд хэсгийг хаана; дээврийн төмөр дээр ачаа тээвэрлэж болно.', [ref('sunroof', 'Люк', 'Автомат, хавчилтаас хамгаалалттай', undefined, IQ)]),
  comp('exterior', 'rear_bumper', 'Хойд бампер', 'Их бие', 'Хойд бампер, гишгүүр хамгаалалт, яндангийн хоолой.', 'Бага хурдны цохилтыг шингээж, зогсоолын мэдрэгчийг байрлуулна.', [na('departure_angle', 'Гарах өнцөг')]),
  comp('exterior', 'taillights', 'Хойд гэрэл', 'Гэрэлтүүлэг', 'Хойд гэрлийн бүрдэл.', 'Араас ирж буй тээврийн хэрэгсэлд тоормос, эргэлтийн дохио өгнө.', [ref('rear_lamp', 'Төрөл', 'GX-R: LED тоормос + гэрэл; VX: бүрэн LED', undefined, IQ), ref('rear_fog', 'Хойд манангийн гэрэл', 'Бий', undefined, IQ)]),
  comp('exterior', 'side_steps', 'Хажуугийн гишгүүр', 'Их бие', 'Босгоны дагуух гишгүүр.', 'Өндөр салонд суух, буухад тус болж, босгыг чулуунаас хамгаална.'),
  comp('exterior', 'tailgate', 'Ачааны хаалга', 'Их бие', 'Ачааны тасгийн дээш өргөгддөг хаалга — шил, гэрэл, дугаарын байртай.', 'Ачааны тасагт нэвтрэх боломж олгоно.', [ref('power_door', 'Цахилгаан хаалга', 'Цахилгаан хаалга (PBD) — зэрэглэлээс хамаарна', undefined, IQ)]),
  // Хөдөлгүүр
  comp('engine', 'engine_block', 'Цилиндрийн блок', 'Хөдөлгүүр', 'Цилиндрүүд болон тахир голын хайрцгийг агуулсан үндсэн цутгамал.', 'Хөдөлгүүрийн үндсэн бүтэц бөгөөд поршень, тахир голыг байрлуулна.', [ref('layout', 'Байршил', 'V6', undefined, IQ), ref('disp', 'Ажлын эзлэхүүн', '3,445 см³', undefined, IQ)], ['engine_type', 'displacement']),
  comp('engine', 'oil_pan', 'Тосны ван (картер)', 'Хөдөлгүүр', 'Хөдөлгүүрийн доод хэсэгт байрлах тосны сав.', 'Тосолгооны тосыг хадгалж, тос шахуургад нийлүүлнэ.'),
  comp('engine', 'crankshaft', 'Тахир гол', 'Хөдөлгүүр', 'Шатунаар хөдөлгөгддөг тахир хэлбэртэй эргэлдэх гол.', 'Поршений шулуун хөдөлгөөнийг эргэлт болгон хурдны хайрцаг руу дамжуулна.', [], ['max_torque']),
  comp('engine', 'pistons', 'Поршень ба шатун', 'Хөдөлгүүр', 'Зургаан поршень, холбогч шатунтай.', 'Шаталтын даралтыг шулуун хөдөлгөөн болгон тахир голд дамжуулна.', [ref('cyl', 'Цилиндрийн тоо', '6', undefined, IQ)]),
  comp('engine', 'cylinder_heads', 'Цилиндрийн толгой', 'Хөдөлгүүр', 'Блок тус бүрт нэг — хавхлага, сувгуудыг агуулна.', 'Цилиндрийг дээрээс битүүмжилж, агаар орох, утаа гарах урсгалыг удирдана.'),
  comp('engine', 'valve_covers', 'Хавхлагын таг', 'Хөдөлгүүр', 'Цилиндрийн толгойн дээд таг.', 'Хий түгээх механизмыг тоос шорооноос хамгаалж, тос гоожихоос сэргийлнэ.'),
  comp('engine', 'valvetrain', 'Хий түгээх механизм', 'Хөдөлгүүр', 'Хавхлага, пүрш, коромысло.', 'Хавхлагуудыг зөв мөчид нээж хааж, цилиндрт агаар оруулж утаа гаргана.'),
  comp('engine', 'camshaft', 'Хий түгээх гол', 'Хөдөлгүүр', 'Камтай эргэлдэх гол.', 'Тахир голтой синхрон эргэж, хавхлагуудыг нээх хугацааг тодорхойлно.'),
  comp('engine', 'turbochargers', 'Турбо цэнэглэгч', 'Агаар шахалт', 'Утааны энергиэр ажилладаг компрессор — V6 блок тус бүрт нэг.', 'Утааны энергийг ашиглан агаарыг шахаж, ижил эзлэхүүнээс илүү чадал, момент гаргана.', [ref('turbo_n', 'Турбо цэнэглэгч', '2 (хос турбо)', undefined, IQ)], ['aspiration', 'max_power']),
  comp('engine', 'intake_system', 'Агаар оруулах систем', 'Хөдөлгүүр', 'Агаар оруулах коллектор.', 'Цэвэр агаарыг цилиндр бүрт тэнцүү хуваарилна.'),
  comp('engine', 'cooling_system', 'Хөргөлтийн систем', 'Хөдөлгүүр', 'Радиатор, сэнс, хөргөлтийн шингэний хоолой.', 'Хөдөлгүүрийн илүүдэл дулааныг зайлуулж, ажлын температурт байлгана.'),
  comp('engine', 'exhaust_system', 'Яндангийн коллектор', 'Хөдөлгүүр', 'Цилиндрийн утааг цуглуулах коллектор — блок тус бүрт.', 'Утааг турбо цэнэглэгч болон цэвэршүүлэгч рүү чиглүүлнэ.'),
  comp('engine', 'alternator', 'Генератор', 'Цахилгаан', 'Оосроор эргэлддэг генератор.', 'Хөдөлгүүр ажиллаж байхад аккумуляторыг цэнэглэж, цахилгаан системийг тэжээнэ.'),
  comp('engine', 'timing_cover', 'Урд таг (хий түгээх механизмын)', 'Хөдөлгүүр', 'Хөдөлгүүрийн урд талын таг.', 'Тахир гол, хий түгээх голыг холбосон гинж/дамжуулгыг бүрхэж хамгаална.'),
  // Хүч дамжуулах
  comp('transmission', 'torque_converter', 'Эргүүлэх моментын хувиргагч', 'Хурдны хайрцаг', 'Хөдөлгүүр, автомат хайрцгийн хоорондох шингэн холбогч.', 'Бага хурдад моментыг өсгөж, зогсонги үед хөдөлгүүрийг унтраахгүй байлгана; аялах хурдад түгжигдэж алдагдлыг бууруулна.'),
  comp('transmission', 'gearbox', 'Автомат хурдны хайрцаг', 'Хурдны хайрцаг', 'Гаригийн араатай автомат хайрцаг.', 'Хурдаас хамааран дамжуулгын харьцааг сонгож, хөдөлгүүрийг үр ашигтай мужид ажиллуулна.', [ref('gears_n', 'Шатлал', '10 (10AT)', undefined, IQ)], ['transmission_type', 'gears']),
  comp('transmission', 'planetary_gearset', 'Гаригийн арааны багц', 'Хурдны хайрцаг', 'Нар араа, гаригийн араанууд, тээгч, титэм арааны багц — автомат хайрцаг дотор хэд хэдэн багц дараалан байрлана.', 'Аль араа нь түгжигдэж, аль нь чөлөөтэй эргэхээс хамааран өөр өөр дамжуулгын харьцаа гаргана; шүүрэх, тоормосны багцууд эдгээрийг сэлгэж 10 шатлалыг үүсгэнэ.', [ref('at', 'Хайрцаг', '10 шатлалт автомат (10AT)', undefined, IQ)], ['gears']),
  comp('transmission', 'ring_and_pinion', 'Титэм ба шовгор араа', 'Хөтлөгч', 'Дифференциал доторх гипоид титэм араа, хөтлөх шовгор араа.', 'Кардан голын эргэлтийг 90° эргүүлж тэнхлэг рүү дамжуулж, эцсийн дамжуулгын харьцаагаар моментыг өсгөнө.', [na('final_drive', 'Эцсийн дамжуулгын харьцаа')]),
  comp('transmission', 'transfer_case', 'Хуваарилах хайрцаг', 'Хөтлөгч', 'Урд, хойд тэнхлэгт хүч хуваарилагч.', 'Хоёр тэнхлэгт моментыг хуваарилна; байнгын 4WD-д төв дифференциал, бууруулсан дамжуулга агуулна.', [na('low_range', 'Бууруулсан дамжуулгын харьцаа')], ['drivetrain']),
  comp('transmission', 'driveshaft', 'Кардан гол', 'Хөтлөгч', 'Хуваарилах хайрцгаас дифференциал руу хүч дамжуулах гол.', 'Моментыг урд, хойд дифференциалд хүргэнэ.'),
  comp('transmission', 'differentials', 'Дифференциал', 'Хөтлөгч', 'Тэнхлэгийн дифференциал.', 'Эргэлтэд зүүн, баруун дугуйг өөр хурдтай эргүүлэх боломж олгоно.', [ref('lock', 'Түгжээ', 'Хойд дифференциалын түгжээ', undefined, IQ)], ['diff_lock']),
  comp('transmission', 'axles', 'Хойд тэнхлэг', 'Хөтлөгч', 'Хатуу хойд тэнхлэгийн гэр, хагас тэнхлэгүүд.', 'Дифференциалаас дугуй тус бүрт момент хүргэнэ.'),
  // Явах эд анги
  comp('suspension', 'frame', 'Шат хэлбэрийн рам', 'Явах эд анги', 'Их бие, хөдөлгүүр, түдгэлзүүр суурилдаг тусдаа ган рам.', 'Ачааллыг даах, чирэх болон бартаат замд удаан эдэлгээ өгнө.', [ref('platform', 'Платформ', 'TNGA-F (GA-F)', undefined, GLOBAL)]),
  comp('suspension', 'front_suspension', 'Урд түдгэлзүүр', 'Түдгэлзүүр', 'Бие даасан урд түдгэлзүүр, эргүүлэх цапф.', 'Урд дугуйг байрлуулж, өнхрөлтийг хянан, дугуйн хөдлөх зайг хангана.', [ref('front_type', 'Төрөл', 'Давхар салаат (double wishbone)', undefined, IQ)]),
  comp('suspension', 'rear_suspension', 'Хойд түдгэлзүүр', 'Түдгэлзүүр', 'Хойд тэнхлэгийг байрлуулах холбоосууд.', 'Хатуу тэнхлэгийн хөдөлгөөнийг ачаалал, бартаат замд хянана.', [ref('rear_type', 'Төрөл', '4 холбоост хатуу тэнхлэг, хажуугийн тогтворжуулах гартай', undefined, IQ)]),
  comp('suspension', 'control_arms', 'Түдгэлзүүрийн гар', 'Түдгэлзүүр', 'Урд түдгэлзүүрийн доод, дээд гар.', 'Цапфыг рамтай холбож, дугуйн геометрийг хадгална.'),
  comp('suspension', 'springs', 'Пүрш ба амортизатор', 'Түдгэлзүүр', 'Дугуй бүрийн ороомог пүрш, амортизатор.', 'Машины жинг даах, замын цохилтыг шингээж, хэлбэлзлийг намдаана.'),
  comp('suspension', 'shock_absorbers', 'Амортизатор', 'Түдгэлзүүр', 'Гидравлик амортизатор.', 'Пүршний хэлбэлзлийг намдааж, дугуйг замтай байнга шүргэлцүүлнэ.'),
  comp('suspension', 'braking_system', 'Тоормосны систем', 'Тоормос', 'Дугуй бүрийн тоормосны диск, суппорт.', 'Хөдөлгөөнийг дулаан болгон хувиргаж машиныг зогсооно; ABS, тогтворжуулалтын системтэй хамтран ажиллана.', [ref('brake_f', 'Урд тоормос', '18 инчийн агааржуулалттай диск, 4 поршений тогтмол суппорт', undefined, `${IQ}; ${AU}`), ref('brake_r', 'Хойд тоормос', '17 инчийн агааржуулалттай диск, хөвөгч суппорт', undefined, `${IQ}; ${AU}`), ref('epb', 'Гар тоормос', 'Цахилгаан (EPB), Brake Hold-той', undefined, IQ)], ['abs']),
  comp('suspension', 'steering', 'Жолооны механизм', 'Жолоо', 'Жолооны рейк, тяга.', 'Жолооны хүрдний эргэлтийг урд дугуйн өнцөг болгон хувиргана.', [ref('radius', 'Эргэлтийн хамгийн бага радиус', '5.9 м', undefined, IQ), ref('circle', 'Эргэлтийн тойрог (хашлага хооронд)', '11.8 м', undefined, AU), ref('ps', 'Жолооны хүчлэгч', 'Цахилгаан, интеграл', undefined, AU)], ['turning_radius']),
  // Салон
  comp('interior', 'dashboard', 'Хянах самбар', 'Салон', 'Багаж, удирдлага, агааржуулалтыг агуулсан урд самбар.', 'Дэлгэц, товчлуур, агаарын суваг, зорчигчийн аюулгүйн дэрийг байрлуулна.', [ref('panel', 'Самбар', 'Дээд зэрэглэлийн (High grade)', undefined, IQ)]),
  comp('interior', 'instrument_cluster', 'Багажны самбар', 'Дэлгэц', 'Жолооны хүрдний ард байрлах жолоочийн дэлгэц.', 'Хурд, хөдөлгүүрийн мэдээлэл, анхааруулгыг харуулна.', [ref('mid', 'Мэдээллийн дэлгэц', 'MID — жолооны хүрдний товчлуураар удирдана', undefined, IQ)]),
  comp('interior', 'infotainment', 'Мультимедиа дэлгэц', 'Дэлгэц', 'Төв мэдрэгч дэлгэц.', 'Аудио, утас, машины тохиргоог удирдана.', [ref('screen', 'Дэлгэц', '12.3 инч (Twin Turbo зэрэглэл)', undefined, IQ), ref('audio', 'Аудио систем', 'JBL, 14 чанга яригч', undefined, IQ)]),
  comp('interior', 'climate_control', 'Уур амьсгалын хяналт', 'Тав тух', 'Агааржуулалтын удирдлагын самбар.', 'Салоны температур, агаарын урсгалыг тохируулна.', [ref('ac', 'Агааржуулагч', 'Автомат, урд зүүн/баруун тусдаа + хойд хөргөгч (VX: 4 бүс)', undefined, IQ)]),
  comp('interior', 'steering_wheel', 'Жолооны хүрд', 'Удирдлага', 'Удирдлагын товчлуур, жолоочийн аюулгүйн дэртэй жолооны хүрд.', 'Жолоочийн үндсэн удирдлага; аудио, хурд тогтоогч, утасны товчлууртай.', [ref('wheel_mat', 'Материал', 'Арьс + мод', undefined, IQ), ref('column', 'Тохируулга', 'Налуу + урт', undefined, IQ)]),
  comp('interior', 'safety_systems', 'Аюулгүйн дэр', 'Аюулгүй байдал', 'Жолоочийн аюулгүйн дэр, хөшиг дэр.', 'Мөргөлтийн үед дэлбэрч зорчигчийн гэмтлийг бууруулна.', [], ['airbags']),
  comp('interior', 'seats', 'Суудал', 'Салон', 'Урд суудал, 2 ба 3-р эгнээний суудал.', 'Зорчигчийг тухтай суулгаж, хамгаалах бүс, аюулгүйн дэрийн үр ашигтай ажиллагааг хангана.', [ref('seat_gxr', 'Материал (GX-R)', 'Хиймэл арьс, агааржуулалттай (жолооч + зорчигч)', undefined, IQ), ref('seat_vx', 'Материал (VX)', 'Гөлгөр арьс, агааржуулалт + урд халаагууртай', undefined, IQ), ref('rows', 'Эгнээ', '3 эгнээ (7 суудал)', undefined, IQ)]),
  comp('interior', 'center_console', 'Төв консол', 'Салон', 'Урд суудлын хоорондох консол.', 'Хурдны хайрцгийн удирдлага, хадгалах тасаг, удирдлагын товчлуурыг агуулна.', [ref('cool_box', 'Хөргөгч хайрцаг', 'Бий', undefined, IQ), ref('wireless', 'Утасгүй цэнэглэгч', 'Бий', undefined, IQ)]),
  comp('interior', 'door_panels', 'Хаалганы доторлогоо', 'Салон', 'Хаалга бүрийн дотор доторлогоо.', 'Хаалганы бүтцийг бүрхэж, товчлуур, бариул, чанга яригчийг байрлуулна.'),
  comp('interior', 'speakers', 'Чанга яригч', 'Аудио', 'Аудио системийн чанга яригчид.', 'Мультимедиа системийн дууг дамжуулна.', [ref('spk', 'Тоо', '14 (JBL, Twin Turbo)', undefined, IQ)]),
];

export const vehicle: VehicleInput = {
  slug: 'land-cruiser-300', brand: 'Toyota', model: 'Land Cruiser 300', generation: '300 цуврал (J300)', year: 2025,
  tagline: 'Урт замд ч, хүнд замд ч найдвартай.',
  description: '300 цувралын Land Cruiser нь рамтай бүтэц, хос турботой V6 хөдөлгүүр, 10 шатлалт автомат хайрцгийг хослуулсан. Систем бүрийг доор судлаарай — үзүүлэлт бүрийн эх сурвалж, баталгаажсан эсэхийг харуулсан.',
  manifestUrl: '/assets/vehicles/toyota/land-cruiser-300/vehicle.manifest.json', posterUrl: null,
  status: 'published', sortOrder: 1, specifications: specs, components,
};

export const variants: VariantInput[] = [
  { name: 'GX-R 3.5 Twin Turbo', engine: 'V35A-FTS 3.4 л хос турбо V6', transmission: '10 шатлалт автомат', drivetrain: 'Байнгын 4WD', price: null, currency: 'MNT', specOverrides: {}, sortOrder: 1 },
  { name: 'VX 3.5 Twin Turbo', engine: 'V35A-FTS 3.4 л хос турбо V6', transmission: '10 шатлалт автомат', drivetrain: 'Байнгын 4WD', price: null, currency: 'MNT', specOverrides: vxOverrides, sortOrder: 2 },
  { name: '3.5 Performance Hybrid', engine: 'V35A-FTS хос турбо V6 + цахилгаан мотор', transmission: '10 шатлалт автомат', drivetrain: 'Байнгын 4WD', price: null, currency: 'MNT', specOverrides: hybridOverrides, sortOrder: 3 },
  { name: '3.3 Diesel Twin Turbo', engine: 'F33A-FTV 3.3 л хос турбо V6 дизель', transmission: '10 шатлалт автомат', drivetrain: 'Байнгын 4WD', price: null, currency: 'MNT', specOverrides: dieselOverrides, sortOrder: 4 },
];

const paint = { metalness: 0.5, roughness: 0.3, clearcoat: 1 };
const satin = { metalness: 0.1, roughness: 0.55, clearcoat: 0 };
/** Үзүүлэн өнгөнүүд — үйлдвэрийн баталгаажсан жагсаалт БИШ. Дилер жинхэнэ өнгийг "factory-verified" болгоно. */
export const colors: ColorInput[] = [
  // Toyota-гийн албан ёсны LC300 өнгөнүүд (Toyota Iraq). Hex нь дэлгэцэнд ойролцоогоор харуулах утга; Монголд санал болгох эсэхийг дилер баталгаажуулна.
  ...[['White Pearl Crystal Shine — Сувдан болор цагаан', '#f1f0eb'], ['Precious White Pearl — Сувдан цагаан', '#e7e3d8'], ['Silver Metallic — Мөнгөлөг', '#b4b7ba'], ['Gray Metallic — Саарал металлик', '#5b5f63'], ['Attitude Black Mica — Хар гялтгануур', '#111214']]
    .map(([name, hex], i) => ({ group: 'body', name: name!, hex: hex!, finish: paint, availability: 'factory-verified' as const, priceDelta: null, variantIds: [], sortOrder: i })),
  ...[['Их биеийн өнгө', '#e4e2dc'], ['Хар', '#0e0f11']].map(([name, hex], i) => ({ group: 'roof', name: name!, hex: hex!, finish: paint, availability: 'demonstration' as const, priceDelta: null, variantIds: [], sortOrder: i })),
  ...[['Мөнгөлөг', '#a8abb0', 0.9, 0.28], ['Бараан саарал', '#4a4d52', 0.85, 0.32], ['Гялгар хар', '#121314', 0.6, 0.18]]
    .map(([name, hex, metalness, roughness], i) => ({ group: 'wheels', name: name as string, hex: hex as string, finish: { metalness: metalness as number, roughness: roughness as number, clearcoat: 0.5 }, availability: 'demonstration' as const, priceDelta: null, variantIds: [], sortOrder: i })),
  ...[['Хар', '#1c1d1f'], ['Бараан саарал', '#3c3e42']].map(([name, hex], i) => ({ group: 'exterior_trim', name: name!, hex: hex!, finish: satin, availability: 'demonstration' as const, priceDelta: null, variantIds: [], sortOrder: i })),
  // Дотор заслын өнгөний багц: суудал, доторлогоо, самбар, чимэглэлийг хамтад нь тохируулна (зөрчилгүй хослол).
  ...([
    ['Хар', '#1a1a1c', { seats: '#1a1a1c', interior_material: '#202023', dashboard_finish: '#2a2b2e', interior_trim: '#55575c' }],
    ['Цайвар шаргал', '#cdbb9a', { seats: '#cdbb9a', interior_material: '#b9aa8e', dashboard_finish: '#5a4632', interior_trim: '#8d8f93' }],
    ['Хүрэн', '#5a3524', { seats: '#5a3524', interior_material: '#3a2a22', dashboard_finish: '#4a3326', interior_trim: '#77706a' }],
  ] as const).map(([name, hex, members], i) => ({ group: 'interior_theme', name, hex, finish: { metalness: 0.05, roughness: 0.62, clearcoat: 0, members: { ...members } }, availability: 'demonstration' as const, priceDelta: null, variantIds: [], sortOrder: i })),
];
