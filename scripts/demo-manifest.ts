import { lintManifest, VehicleManifest, type ComponentMapping, type Keyframe } from '../packages/shared/src/index';

export const DISCLAIMER =
  'Үзүүлэн геометр. Интерактив системийг харуулах зорилгоор энгийн хэлбэрүүдээр бүтээсэн орлуулга — жинхэнэ машины загвар биш бөгөөд эд ангиуд нь механик талаасаа үнэн зөв биш.';

const four = (p: string) => ['FL', 'FR', 'RL', 'RR'].map((c) => `${p}_${c}`);
const pair = (p: string) => [`${p}_L`, `${p}_R`];
type C = { id: string; system: ComponentMapping['system']; nodes: string[]; o?: [number, number, number]; r?: [number, number, number]; d?: number; m?: boolean };

/** Exact exploded-view states. Offsets are metres in vehicle space (+X forward, +Y up, +Z right). */
const COMPONENTS: C[] = [
  // Exterior
  { id: 'body_shell', system: 'exterior', nodes: ['body_shell'] },
  { id: 'front_bumper', system: 'exterior', nodes: ['front_bumper'], o: [0.95, -0.05, 0] },
  { id: 'grille', system: 'exterior', nodes: ['grille'], o: [0.62, 0.14, 0], d: 0.1 },
  { id: 'headlights', system: 'exterior', nodes: pair('headlight'), o: [0.5, 0.06, 0.32], d: 0.15, m: true },
  { id: 'hood', system: 'exterior', nodes: ['hood'], o: [0.12, 0.9, 0], r: [0, 0, 0.32], d: 0.05 },
  { id: 'doors', system: 'exterior', nodes: four('door'), o: [0, 0.04, 0.78], d: 0.2, m: true },
  { id: 'mirrors', system: 'exterior', nodes: pair('mirror'), o: [0.05, 0.16, 1.05], d: 0.25, m: true },
  { id: 'wheels', system: 'exterior', nodes: four('wheel'), o: [0, 0, 0.95], d: 0.3, m: true },
  { id: 'windows', system: 'exterior', nodes: ['windows', 'pillar_a_L', 'pillar_a_R'], o: [0, 0.5, 0], d: 0.35 },
  { id: 'roof', system: 'exterior', nodes: ['roof', 'acc_roof_rack'], o: [0, 1.0, 0], d: 0.4 },
  { id: 'rear_bumper', system: 'exterior', nodes: ['rear_bumper'], o: [-0.95, -0.05, 0] },
  { id: 'taillights', system: 'exterior', nodes: pair('taillight'), o: [-0.5, 0.06, 0.26], d: 0.15, m: true },
  { id: 'side_steps', system: 'exterior', nodes: ['acc_side_steps'], o: [0, -0.22, 0], d: 0.3 },
  // Engine
  { id: 'engine_block', system: 'engine', nodes: ['engine_block'] },
  { id: 'cylinder_heads', system: 'engine', nodes: pair('cylinder_head'), o: [0, 0.34, 0.26], m: true },
  { id: 'pistons', system: 'engine', nodes: ['pistons'], o: [0, 0.62, 0], d: 0.2 },
  { id: 'crankshaft', system: 'engine', nodes: ['crankshaft'], o: [0, -0.45, 0], d: 0.1 },
  { id: 'turbochargers', system: 'engine', nodes: pair('turbo'), o: [-0.1, 0.1, 0.42], d: 0.15, m: true },
  { id: 'intake_system', system: 'engine', nodes: ['intake_system'], o: [0, 0.78, 0], d: 0.3 },
  { id: 'cooling_system', system: 'engine', nodes: ['cooling_system'], o: [0.55, 0, 0] },
  { id: 'exhaust_system', system: 'engine', nodes: ['exhaust_system'], o: [-0.15, -0.28, 0], d: 0.2 },
  { id: 'alternator', system: 'engine', nodes: ['alternator'], o: [0.25, 0.3, 0.38], d: 0.25 },
  // Transmission / drivetrain
  { id: 'torque_converter', system: 'transmission', nodes: ['torque_converter'], o: [0.28, 0.26, 0] },
  { id: 'gearbox', system: 'transmission', nodes: ['gearbox'], o: [0, 0.36, 0], d: 0.05 },
  { id: 'transfer_case', system: 'transmission', nodes: ['transfer_case'], o: [0, 0.18, 0.48], d: 0.1 },
  { id: 'driveshaft', system: 'transmission', nodes: ['driveshaft'], o: [0, -0.34, 0], d: 0.15 },
  { id: 'differentials', system: 'transmission', nodes: ['differentials'], o: [0, 0.32, 0], d: 0.2 },
  { id: 'axles', system: 'transmission', nodes: ['axles'], o: [0, -0.24, 0], d: 0.25 },
  // Suspension & chassis
  { id: 'frame', system: 'suspension', nodes: ['frame'] },
  { id: 'front_suspension', system: 'suspension', nodes: ['front_suspension'], o: [0.45, 0.05, 0], d: 0.1 },
  { id: 'rear_suspension', system: 'suspension', nodes: ['rear_suspension'], o: [-0.45, 0.05, 0], d: 0.1 },
  { id: 'control_arms', system: 'suspension', nodes: ['control_arms'], o: [0.3, 0.22, 0], d: 0.15 },
  { id: 'springs', system: 'suspension', nodes: ['springs'], o: [0, 0.5, 0], d: 0.2 },
  { id: 'shock_absorbers', system: 'suspension', nodes: ['shock_absorbers'], o: [0, 0.85, 0], d: 0.3 },
  { id: 'braking_system', system: 'suspension', nodes: four('brake'), o: [0, 0, 0.55], d: 0.05, m: true },
  { id: 'steering', system: 'suspension', nodes: ['steering'], o: [0.4, 0.16, 0], d: 0.1 },
  // Interior
  { id: 'dashboard', system: 'interior', nodes: ['dashboard'], o: [0.36, 0, 0] },
  { id: 'instrument_cluster', system: 'interior', nodes: ['instrument_cluster'], o: [0.22, 0.18, 0], d: 0.1 },
  { id: 'infotainment', system: 'interior', nodes: ['infotainment'], o: [0.28, 0.32, 0], d: 0.1 },
  { id: 'climate_control', system: 'interior', nodes: ['climate_control'], o: [0.42, -0.12, 0], d: 0.15 },
  { id: 'steering_wheel', system: 'interior', nodes: ['steering_wheel'], o: [-0.32, 0.12, 0], d: 0.2 },
  { id: 'safety_systems', system: 'interior', nodes: ['safety_systems'], o: [0, 0.28, 0], d: 0.25 },
  { id: 'seats', system: 'interior', nodes: ['seat_FL', 'seat_FR', 'seat_R'], o: [-0.2, 0.14, 0.22], d: 0.1, m: true },
  { id: 'center_console', system: 'interior', nodes: ['center_console'], o: [0, -0.16, 0], d: 0.05 },
  { id: 'door_panels', system: 'interior', nodes: four('door_panel'), o: [0, 0, 0.32], d: 0.2, m: true },
  { id: 'speakers', system: 'interior', nodes: four('speaker'), o: [0, -0.1, 0.42], d: 0.3, m: true },
];

const kf = (at: number, position: [number, number, number], target: [number, number, number], explode: Keyframe['explode'], opacity: Keyframe['opacity'], fov = 35): Keyframe =>
  ({ at, camera: { position, target, fov }, explode, opacity, yaw: 0 });

const EXT = { exterior: 1, engine: 0, transmission: 0, suspension: 0, interior: 0 };
const ZERO = { exterior: 0, engine: 0, transmission: 0, suspension: 0, interior: 0 };
const GHOST = 0.04;

/** Story timeline. Section i spans [i, i+1). Holds at the end of sections give reading time. */
const KEYFRAMES: Keyframe[] = [
  kf(0, [7.2, 2.0, 6.4], [0, 0.85, 0], ZERO, EXT, 32),
  kf(0.5, [-3.2, 1.5, 7.4], [0, 0.9, 0], ZERO, EXT, 32),
  kf(0.92, [5.4, 1.2, -3.8], [1.1, 0.85, 0], ZERO, EXT, 32),
  kf(1.15, [8.6, 4.3, 7.6], [0, 0.9, 0], ZERO, EXT, 34),
  kf(1.85, [8.0, 3.9, 8.4], [0, 0.95, 0], { ...ZERO, exterior: 1 }, EXT, 34),
  kf(2.12, [4.9, 2.3, 3.6], [1.8, 0.8, 0], ZERO, { ...ZERO, exterior: GHOST, engine: 1 }, 30),
  kf(2.85, [4.4, 2.7, 3.2], [1.8, 0.95, 0], { ...ZERO, engine: 1 }, { ...ZERO, exterior: GHOST, engine: 1 }, 30),
  kf(3.12, [1.4, 1.0, 4.6], [0.6, 0.55, 0], ZERO, { ...ZERO, exterior: GHOST, engine: 0.35, transmission: 1 }, 32),
  kf(3.85, [0.6, 1.4, 4.4], [0.4, 0.55, 0], { ...ZERO, transmission: 1 }, { ...ZERO, exterior: GHOST, engine: 0.25, transmission: 1 }, 32),
  kf(4.12, [4.6, 1.1, 3.8], [1.1, 0.5, 0], ZERO, { ...ZERO, exterior: GHOST, engine: 0.2, transmission: 0.3, suspension: 1 }, 32),
  kf(4.85, [5.0, 1.8, 4.6], [0.7, 0.55, 0], { ...ZERO, suspension: 1 }, { ...ZERO, exterior: GHOST, engine: 0.15, transmission: 0.2, suspension: 1 }, 32),
  kf(5.15, [-0.5, 1.55, 0.12], [0.95, 1.06, -0.22], ZERO, { ...ZERO, exterior: 0.1, interior: 1 }, 58),
  kf(5.5, [-0.3, 1.5, -0.06], [0.95, 1.1, 0.12], ZERO, { ...ZERO, exterior: 0.1, interior: 1 }, 58),
  kf(5.88, [3.4, 3.1, 3.6], [0.1, 1.0, 0], { ...ZERO, interior: 1 }, { ...ZERO, exterior: GHOST, interior: 1 }, 34),
  kf(6.2, [7.6, 1.7, -5.4], [0, 0.85, 0], ZERO, EXT, 32),
  kf(7, [6.8, 2.1, 6.1], [0, 0.85, 0], ZERO, EXT, 32),
];

export function buildManifest(vehicleSlug: string, bytes: Record<string, number>): VehicleManifest {
  const asset = (s: string) => ({ url: `${s}/demo-${s}.glb`, draco: true, ktx2: false, bytes: bytes[s] });
  const manifest = VehicleManifest.parse({
    schemaVersion: 1,
    vehicleSlug,
    assetStatus: 'demonstration',
    disclaimer: DISCLAIMER,
    units: 'meters',
    assets: { exterior: asset('exterior'), engine: asset('engine'), transmission: asset('transmission'), suspension: asset('suspension'), interior: asset('interior') },
    materialGroups: [
      { id: 'body', label: 'Их биеийн өнгө', materials: ['mat_body'], surface: 'exterior', default: { hex: '#d9d6cf', metalness: 0.55, roughness: 0.32, clearcoat: 1 } },
      { id: 'roof', label: 'Дээврийн өнгө', materials: ['mat_roof'], surface: 'exterior', default: { hex: '#d9d6cf', metalness: 0.55, roughness: 0.32, clearcoat: 1 } },
      { id: 'wheels', label: 'Обудны өнгө', materials: ['mat_rim'], surface: 'exterior', default: { hex: '#a8abb0', metalness: 0.9, roughness: 0.28, clearcoat: 0 } },
      { id: 'exterior_trim', label: 'Гадна чимэглэл', materials: ['mat_trim'], surface: 'exterior', default: { hex: '#1c1d1f', metalness: 0.2, roughness: 0.55, clearcoat: 0 } },
      { id: 'seats', label: 'Суудлын өнгө', materials: ['mat_seat'], surface: 'interior', default: { hex: '#3a2c22', metalness: 0, roughness: 0.62, clearcoat: 0 } },
      { id: 'interior_material', label: 'Дотор засал', materials: ['mat_interior'], surface: 'interior', default: { hex: '#26262a', metalness: 0.05, roughness: 0.7, clearcoat: 0 } },
      { id: 'dashboard_finish', label: 'Хянах самбарын өнгөлгөө', materials: ['mat_dash_finish'], surface: 'interior', default: { hex: '#5a4632', metalness: 0.1, roughness: 0.4, clearcoat: 0.3 } },
      { id: 'interior_trim', label: 'Дотор чимэглэл', materials: ['mat_interior_trim'], surface: 'interior', default: { hex: '#8d8f93', metalness: 0.85, roughness: 0.3, clearcoat: 0 } },
    ],
    switches: [
      { id: 'wheel_design', label: 'Обудны загвар', kind: 'exclusive', default: ['design_a'], options: [
        { id: 'design_a', label: '6 хигээстэй (демо)', nodes: four('rim_a'), availability: 'demonstration' },
        { id: 'design_b', label: '12 хигээстэй (демо)', nodes: four('rim_b'), availability: 'demonstration' },
      ] },
      { id: 'accessories', label: 'Гадна дагалдах хэрэгсэл', kind: 'toggle', default: [], options: [
        { id: 'roof_rack', label: 'Дээврийн тавиур', nodes: ['acc_roof_rack'], availability: 'demonstration' },
        { id: 'side_steps', label: 'Хажуугийн гишгүүр', nodes: ['acc_side_steps'], availability: 'demonstration' },
      ] },
    ],
    components: COMPONENTS.map((c) => ({
      id: c.id, system: c.system, nodes: c.nodes,
      ...(c.o ? { explode: { offset: c.o, rotation: c.r ?? [0, 0, 0], delay: c.d ?? 0, mirror: c.m ?? false } } : {}),
    })),
    story: {
      sections: [
        { id: 'exterior', index: '01', kicker: 'Гадна тал', title: 'Хэлбэр бүрт илэрх хүч', body: 'Их биеийг тойрон харж, хавтан, гэрэл, дугуй бүрийг сонгон юу болох, ямар үүрэгтэйг нь мэдээрэй.', interactiveSystems: ['exterior'], requires: ['exterior'] },
        { id: 'exploded', index: '02', kicker: 'Задалсан', title: 'Эд анги бүрээр нь', body: 'Доош гүйлгэхэд их бие үндсэн угсралтууд болон задарна. Буцааж гүйлгэхэд дахин угсрагдана.', interactiveSystems: ['exterior'], requires: ['exterior'] },
        { id: 'engine', index: '03', kicker: 'Хөдөлгүүр', title: 'Хүчний эх үүсвэр — задлаад', body: 'Блок, толгой, поршень, тахир гол, турбо, агаар оруулах, яндан — тус бүрийг сонгож үзэх боломжтой.', interactiveSystems: ['engine'], requires: ['engine'] },
        { id: 'transmission', index: '04', kicker: 'Хүч дамжуулалт', title: 'Тахир голоос дугуй хүртэл', body: 'Момент хувиргагч, хурдны хайрцаг, хуваарилах хайрцаг, кардан, дифференциалаар дамжих хүчийг дагаарай.', interactiveSystems: ['transmission'], requires: ['transmission', 'engine'] },
        { id: 'suspension', index: '05', kicker: 'Явах эд анги', title: 'Рам, түдгэлзүүр, тоормос', body: 'Рам, түдгэлзүүрийн бүтэц, пүрш, жолооны механизм, тоормосыг нэг бүрчлэн судлаарай.', interactiveSystems: ['suspension'], requires: ['suspension'] },
        { id: 'interior', index: '06', kicker: 'Салон', title: 'Салон руу орж үзээрэй', body: 'Хянах самбар, дэлгэц, жолооны хүрд, суудал — тус бүрийг сонгож дэлгэрэнгүйг харна уу.', interactiveSystems: ['interior'], requires: ['interior'] },
        { id: 'final', index: '07', kicker: 'Бүрэн', title: 'Өөрийнхөөрөө тохируулаарай', body: 'Бүх систем байрандаа. Өнгө, обуд, дотор заслаа сонгохоор тохируулагч руу орно уу.', interactiveSystems: ['exterior'], requires: ['exterior'] },
      ],
      keyframes: KEYFRAMES,
    },
    hero: { position: [7.4, 1.25, 6.6], target: [0, 0.05, 0], fov: 30 },
    configurator: { position: [6.2, 1.9, 6.0], target: [0, 0.8, 0], fov: 30 },
    cameras: { interior: { position: [-0.4, 1.52, 0.02], target: [0.9, 1.08, -0.1], fov: 60 } },
    cabin: { min: [-2.3, 0.55, -0.9], max: [1.2, 1.88, 0.9] },
    credits: ['Demonstration assets generated by scripts/generate-demo-assets.ts (MIT, this repository).'],
  });
  const problems = lintManifest(manifest);
  if (problems.length) throw new Error('Manifest lint failed:\n' + problems.join('\n'));
  return manifest;
}
