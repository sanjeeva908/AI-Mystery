import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type Theme = 'light' | 'dark';
type SceneProps = { theme: Theme; onStart: () => void; onSelect: (label: string) => void };

const notes = [
  { id: 'suspect', title: 'PERSON OF INTEREST', line: 'Statement / 02', x: -2.45, y: 0.9, color: '#824d49' },
  { id: 'evidence', title: 'FIELD REPORT', line: 'Trace / 04', x: 0.15, y: 1.25, color: '#667568' },
  { id: 'timeline', title: 'TIMELINE', line: '19:40 — 20:15', x: 2.52, y: 0.65, color: '#8d704b' },
];

function makePaperTexture(title: string, line: string, accent: string, light: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 360;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = light ? '#f1e9d7' : '#d9d0bd'; ctx.fillRect(0, 0, 512, 360);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 512, 12);
  ctx.fillStyle = '#5d574c'; ctx.font = 'bold 20px monospace'; ctx.fillText(title, 34, 62);
  ctx.fillStyle = '#867d6b'; ctx.font = '16px monospace'; ctx.fillText(line, 34, 94);
  if (title === 'PERSON OF INTEREST') {
    ctx.fillStyle = '#766e61'; ctx.fillRect(338, 55, 140, 218);
    ctx.fillStyle = '#d5c5a8'; ctx.beginPath(); ctx.arc(408, 128, 34, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(408, 222, 58, 50, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#b9aa8e'; ctx.font = '12px monospace'; ctx.fillText('FILE / 02', 361, 294);
  }
  ctx.strokeStyle = '#a79b83'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(34, 142 + i * 27); ctx.lineTo(440 - (i % 2) * 72, 142 + i * 27); ctx.stroke(); }
  ctx.fillStyle = accent; ctx.globalAlpha = .42; ctx.beginPath(); ctx.arc(390, 250, 43, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export function InvestigationScene({ theme, onStart, onSelect }: SceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const startRef = useRef(onStart);
  useEffect(() => { startRef.current = onStart; }, [onStart]);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = /Mobi/.test(navigator.userAgent);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !/Mobi/.test(navigator.userAgent), powerPreference: 'low-power' });
    } catch { node.classList.add('webgl-unavailable'); return; }
    node.classList.remove('webgl-unavailable');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, /Mobi/.test(navigator.userAgent) ? 1.25 : 1.6));
    renderer.setSize(node.clientWidth, node.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !mobile && !reduced;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(mobile ? 75 : 39, node.clientWidth / node.clientHeight, .1, 100);
    camera.position.set(0, .25, mobile ? 15 : 12);
    const dark = theme === 'dark';
    const colors = dark ? { wall: 0x151a19, board: 0x36342e, edge: 0x6c5438, string: 0x943e3c, floor: 0x191e1c } : { wall: 0xe8e0d1, board: 0xb9aa90, edge: 0x715b3c, string: 0x934444, floor: 0xd4c6ad };
    scene.background = null;
    const ambient = new THREE.HemisphereLight(dark ? 0x819090 : 0xfff2da, dark ? 0x241c18 : 0x6b5940, dark ? 1.35 : 1.65); scene.add(ambient);
    const key = new THREE.PointLight(dark ? 0xffc476 : 0xffd99a, dark ? 60 : 44, 25); key.position.set(-4, 5, 5); scene.add(key);
    const shadow = new THREE.DirectionalLight(dark ? 0xffddb0 : 0xffedce, dark ? 1.7 : 1.3); shadow.position.set(-3, 6, 5); shadow.castShadow = !mobile && !reduced;
    shadow.shadow.mapSize.set(512, 512); shadow.shadow.camera.near = .5; shadow.shadow.camera.far = 22; shadow.shadow.bias = -.0002; scene.add(shadow);
    const fill = new THREE.PointLight(dark ? 0x899da5 : 0xfff5e2, dark ? 25 : 30, 20); fill.position.set(5, 1, 3); scene.add(fill);

    const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, material?: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material ?? new THREE.MeshStandardMaterial({ color, roughness: .72 }));
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
    };
    box(200, 200, .3, colors.wall, 0, 0, -4);
    box(9.3, 6.15, .36, colors.edge, 0, .15, -2.35);
    box(8.92, 5.78, .12, colors.board, 0, .15, -2.12);
    const interactables: THREE.Object3D[] = [];
    const setInteractive = (mesh: THREE.Mesh, name: string) => { mesh.userData.label = name; interactables.push(mesh); };

    const center = box(1.75, 1.15, .12, 0xffffff, -.03, -.08, -1.98, new THREE.MeshStandardMaterial({ map: makePaperTexture('INCIDENT FILE', 'OPEN CASE / 01', '#76563d', !dark), roughness: .85 }));
    center.rotation.z = -.025; setInteractive(center, 'Open a new investigation');
    notes.forEach((note, index) => {
      const card = box(1.55, 1.15, .09, 0xffffff, note.x, note.y, -1.86 + index * .035,
        new THREE.MeshStandardMaterial({ map: makePaperTexture(note.title, note.line, note.color, !dark), roughness: .82 }));
      card.rotation.z = (index - 1) * .035; setInteractive(card, note.title.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()));
      const pin = new THREE.Mesh(new THREE.SphereGeometry(.095, 16, 12), new THREE.MeshStandardMaterial({ color: note.color, metalness: .35, roughness: .3 }));
      pin.position.set(note.x, note.y + .47, -1.72); scene.add(pin);
    });
    const lineMaterial = new THREE.MeshBasicMaterial({ color: colors.string });
    const thread = (a: THREE.Vector3, b: THREE.Vector3) => {
      const direction = b.clone().sub(a); const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, direction.length(), 6), lineMaterial);
      mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); scene.add(mesh);
    };
    thread(new THREE.Vector3(-2.25, .65, -1.7), new THREE.Vector3(-.8, -.02, -1.66));
    thread(new THREE.Vector3(-.8, -.02, -1.66), new THREE.Vector3(.95, .7, -1.63));
    thread(new THREE.Vector3(.95, .7, -1.63), new THREE.Vector3(2.05, .48, -1.6));

    // Desk and a magnifying glass establish depth in the foreground.
    const desk = box(12, .35, 4.5, colors.floor, 0, -3.42, .1);
    desk.rotation.x = -.045;
    const lens = new THREE.Mesh(new THREE.TorusGeometry(.42, .055, 10, 48), new THREE.MeshStandardMaterial({ color: dark ? 0xc5a46c : 0x8b704b, metalness: .72, roughness: .24 }));
    lens.position.set(2.65, -2.68, 1); lens.rotation.x = .18; lens.userData.label = 'Magnifying glass'; scene.add(lens); interactables.push(lens);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.045, .065, .95, 12), new THREE.MeshStandardMaterial({ color: dark ? 0x806340 : 0x604b34, metalness: .25, roughness: .45 }));
    handle.position.set(3.05, -3.18, 1); handle.rotation.z = -.68; scene.add(handle);

    const particleCount = mobile ? 65 : 190;
    const points = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) { points[i * 3] = (Math.random() - .5) * 13; points[i * 3 + 1] = (Math.random() - .5) * 8; points[i * 3 + 2] = Math.random() * 5 - 1; }
    const particleGeometry = new THREE.BufferGeometry(); particleGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: dark ? 0xf5d8a4 : 0x876d48, size: .025, transparent: true, opacity: dark ? .56 : .28, sizeAttenuation: true })); scene.add(particles);

    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(5, 5); const look = new THREE.Vector3(0, 0, -1.8);
    let targetX = 0; let targetY = 0; let raf = 0; let visible = true; let scrollY = window.scrollY;
    const onPointerMove = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; targetX = pointer.x * .45; targetY = pointer.y * .22; };
    const tooltip = node.querySelector<HTMLElement>('.scene-tooltip');
    let activeHit: THREE.Object3D | undefined;
    const onClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('a,button')) return;
      raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(interactables, false)[0]?.object;
      if (!hit) return;
      if (hit.userData.label === 'Open a new investigation') startRef.current();
      else onSelect(String(hit.userData.label));
    };
    const onHover = () => {
      raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(interactables, false)[0]?.object;
      if (activeHit && activeHit !== hit && activeHit instanceof THREE.Mesh && activeHit.material instanceof THREE.MeshStandardMaterial) activeHit.material.emissive.setHex(0x000000);
      activeHit = hit;
      if (hit instanceof THREE.Mesh && hit.material instanceof THREE.MeshStandardMaterial) hit.material.emissive.setHex(dark ? 0x493116 : 0x38240d);
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
      if (tooltip) { tooltip.style.opacity = hit ? '1' : '0'; tooltip.textContent = hit ? `${String(hit.userData.label)} · click to inspect` : ''; tooltip.style.left = `${(pointer.x + 1) * 50}%`; tooltip.style.top = `${(1 - pointer.y) * 50}%`; }
    };
    const trackPointer = (event: PointerEvent) => { onPointerMove(event); onHover(); };
    const onScroll = () => { scrollY = window.scrollY; };
    const onVisibility = () => { visible = document.visibilityState === 'visible'; if (visible) animate(); };
    const resize = new ResizeObserver(() => { if (!node.clientWidth || !node.clientHeight) return; camera.aspect = node.clientWidth / node.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(node.clientWidth, node.clientHeight); });
    resize.observe(node); renderer.domElement.addEventListener('pointermove', trackPointer); renderer.domElement.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll, { passive: true }); document.addEventListener('visibilitychange', onVisibility);
    let elapsed = 0; let previous = performance.now();
    const animate = (now = performance.now()) => {
      if (!visible) return;
      if (!reduced) raf = requestAnimationFrame(animate);
      const delta = Math.min((now - previous) / 1000, .05); previous = now; elapsed += delta;
      const depth = Math.min(scrollY / Math.max(window.innerHeight, 1), 4);
      camera.position.x += ((mobile ? targetX * .28 : targetX) - camera.position.x) * .025;
      camera.position.y += ((.25 - targetY + depth * .16) - camera.position.y) * .025;
      camera.position.z += (((mobile ? 15 : 12) - Math.min(depth * (mobile ? .3 : .8), mobile ? .8 : 2.4)) - camera.position.z) * .025;
      camera.lookAt(look.x, look.y + depth * .15, look.z);
      if (!reduced) { center.rotation.y = Math.sin(elapsed * .42) * .04; particles.rotation.y = elapsed * .008; key.position.x = -4 + Math.sin(elapsed * .25) * .55; }
      renderer.render(scene, camera);
    };
    animate();
    return () => { cancelAnimationFrame(raf); resize.disconnect(); renderer.domElement.removeEventListener('pointermove', trackPointer); renderer.domElement.removeEventListener('click', onClick); window.removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', onVisibility); scene.traverse((item) => { if (item instanceof THREE.Mesh || item instanceof THREE.Points) { item.geometry.dispose(); const materials = Array.isArray(item.material) ? item.material : [item.material]; materials.forEach((material) => { if ('map' in material && material.map) material.map.dispose(); material.dispose(); }); } }); renderer.dispose(); renderer.domElement.remove(); };
  }, [theme, onSelect]);

  return <>
    <div className="investigation-scene" ref={host}><div className="scene-tooltip" role="status" />
      <div className={'scene-fallback ' + theme}><span>CASE FILE / 01</span><i /><b>EVERY DETAIL<br />LEAVES A TRACE.</b><small>THE NIGHT ARCHIVE · FIELD NOTES</small></div>
    </div>
    <nav className="scene-interactions" aria-label="Inspect investigation room props">
      <span>INSPECT THE ROOM</span>
      <button type="button" aria-label="Open case file" onClick={onStart}>Open file</button>
      <button type="button" aria-label="Inspect suspect photograph" onClick={() => onSelect('Person of interest')}>Suspect</button>
      <button type="button" aria-label="Inspect field report" onClick={() => onSelect('Field report')}>Report</button>
      <button type="button" aria-label="Inspect timeline" onClick={() => onSelect('Timeline')}>Timeline</button>
    </nav>
  </>;
}
