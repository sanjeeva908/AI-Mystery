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
    scene.fog = new THREE.FogExp2(theme === 'dark' ? 0x12182b : 0xe9e3d8, mobile ? .012 : .009);
    const camera = new THREE.PerspectiveCamera(mobile ? 75 : 39, node.clientWidth / node.clientHeight, .1, 100);
    camera.position.set(0, .25, mobile ? 15 : 12);
    const dark = theme === 'dark';
    const colors = dark ? { wall: 0x11172a, board: 0x222540, edge: 0x605e91, string: 0x6d88ff, floor: 0x11182a } : { wall: 0xe9e3d8, board: 0xd5cedf, edge: 0x806e9f, string: 0x7866a2, floor: 0xd7d0dc };
    scene.background = null;
    const ambient = new THREE.HemisphereLight(dark ? 0x819090 : 0xfff2da, dark ? 0x241c18 : 0x6b5940, dark ? 1.35 : 1.65); scene.add(ambient);
    const key = new THREE.PointLight(dark ? 0x8f9cff : 0xb59ade, dark ? 48 : 38, 25); key.position.set(-4, 5, 5); scene.add(key);
    const shadow = new THREE.DirectionalLight(dark ? 0xb4c4ff : 0xf0e6ff, dark ? 1.7 : 1.3); shadow.position.set(-3, 6, 5); shadow.castShadow = !mobile && !reduced;
    shadow.shadow.mapSize.set(512, 512); shadow.shadow.camera.near = .5; shadow.shadow.camera.far = 22; shadow.shadow.bias = -.0002; scene.add(shadow);
    const fill = new THREE.PointLight(dark ? 0x4e72ff : 0xb7a3dd, dark ? 30 : 25, 20); fill.position.set(5, 1, 3); scene.add(fill);

    const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, material?: THREE.Material, parent: THREE.Object3D = scene) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material ?? new THREE.MeshStandardMaterial({ color, roughness: .72 }));
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const stages = Array.from({ length: 6 }, (_, index) => { const group = new THREE.Group(); group.position.z = -2 - index * 17; scene.add(group); return group; });
    const ring = (parent: THREE.Object3D, x: number, y: number, z: number, radius: number, color: number, axis = 0) => {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, .018, 8, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .62 }));
      mesh.position.set(x, y, z); mesh.rotation.x = axis; parent.add(mesh); return mesh;
    };
    ring(stages[0], -3.8, .2, -.8, 2.25, dark ? 0x637dff : 0x8d76b5, .4);
    ring(stages[0], -3.8, .2, -.8, 1.8, dark ? 0x3a9fb8 : 0x8a76a8, 1.2);
    box(5.65, 3.95, .3, colors.edge, 1.35, .4, -.38, undefined, stages[0]);
    box(5.35, 3.65, .12, colors.board, 1.35, .4, -.18, undefined, stages[0]);
    const interactables: THREE.Object3D[] = [];
    const setInteractive = (mesh: THREE.Mesh, name: string) => { mesh.userData.label = name; if (mesh.material instanceof THREE.MeshStandardMaterial) mesh.userData.baseEmissive = mesh.material.emissive.getHex(); interactables.push(mesh); };

    const center = box(1.75, 1.15, .12, 0xffffff, -.03, -.08, -.08, new THREE.MeshStandardMaterial({ map: makePaperTexture('INCIDENT FILE', 'OPEN CASE / 01', '#625b91', !dark), roughness: .85 }), stages[0]);
    center.rotation.z = -.025; setInteractive(center, 'Open a new investigation');
    notes.forEach((note, index) => {
      const card = box(1.55, 1.15, .09, 0xffffff, note.x, note.y, .04 + index * .035,
        new THREE.MeshStandardMaterial({ map: makePaperTexture(note.title, note.line, note.color, !dark), roughness: .82 }), stages[0]);
      card.rotation.z = (index - 1) * .035; setInteractive(card, note.title.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()));
      const pin = new THREE.Mesh(new THREE.SphereGeometry(.095, 16, 12), new THREE.MeshStandardMaterial({ color: note.color, metalness: .35, roughness: .3 }));
      pin.position.set(note.x, note.y + .47, .18); stages[0].add(pin);
    });
    const lineMaterial = new THREE.MeshBasicMaterial({ color: colors.string });
    const thread = (a: THREE.Vector3, b: THREE.Vector3, parent: THREE.Object3D = scene) => {
      const direction = b.clone().sub(a); const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, direction.length(), 6), lineMaterial);
      mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); parent.add(mesh);
    };
    thread(new THREE.Vector3(-2.25, .65, .2), new THREE.Vector3(-.8, -.02, .24), stages[0]);
    thread(new THREE.Vector3(-.8, -.02, .24), new THREE.Vector3(.95, .7, .28), stages[0]);
    thread(new THREE.Vector3(.95, .7, .28), new THREE.Vector3(2.05, .48, .32), stages[0]);

    const evidenceCards = ['TRACE / 01', 'ROOM LOG / 02', 'FIELD NOTE / 03'];
    evidenceCards.forEach((title, index) => {
      const x = (index - 1) * 2.1;
      ring(stages[1], x, -.05, -.75 + index * .16, .92, dark ? 0x4ba7d2 : 0x9b83b8, .35 + index * .3);
      const card = box(1.6, 1.2, .1, 0xffffff, x, .12 + (index % 2) * .55, .05 + index * .18,
        new THREE.MeshStandardMaterial({ map: makePaperTexture(title, 'EVIDENCE / SEALED', index === 1 ? '#5f628e' : '#716487', !dark), roughness: .7 }), stages[1]);
      card.rotation.y = (index - 1) * .12; card.rotation.z = (index - 1) * .04;
      setInteractive(card, title.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()));
    });
    const shards: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) {
      const shard = new THREE.Mesh(new THREE.IcosahedronGeometry(.16 + (i % 3) * .08, 0), new THREE.MeshStandardMaterial({ color: dark ? 0x7790ff : 0x8e79b4, emissive: dark ? 0x283e9e : 0x4e366e, emissiveIntensity: .45, metalness: .58, roughness: .25 }));
      shard.position.set(Math.cos(i * .9) * 4.2, Math.sin(i * 1.4) * 2.2, -1 + i * .25); shard.rotation.set(i, i * .4, 0); stages[1].add(shard); shards.push(shard);
    }

    const portraitXs = [-2.35, 0, 2.35];
    portraitXs.forEach((x, index) => {
      const frame = ring(stages[2], x, .25, -.65 + index * .16, .98, dark ? 0x6d81e4 : 0x8873aa, Math.PI / 2);
      frame.scale.set(1, 1.28, 1);
      const portrait = box(1.8, 2.35, .11, 0xffffff, x, .22 + (index === 1 ? -.35 : .28), .08 + index * .14,
        new THREE.MeshStandardMaterial({ map: makePaperTexture('PERSON OF INTEREST', `PROFILE / 0${index + 1}`, index === 1 ? '#665988' : '#5c6b86', !dark), roughness: .76 }), stages[2]);
      portrait.rotation.y = (index - 1) * .1; setInteractive(portrait, `Suspect profile ${index + 1}`);
    });

    const network = [[-3, 1.2, 0], [-1.2, -.8, -.4], [.2, 1.45, .4], [1.7, -.4, -.2], [3.25, 1.1, .2], [2.5, -1.7, -.5], [-2.8, -1.65, .4]] as const;
    network.forEach(([x, y, z], index) => {
      const nodeMaterial = new THREE.MeshStandardMaterial({ color: dark ? 0x80d9ff : 0x7861a7, emissive: dark ? 0x1f91c8 : 0x514078, emissiveIntensity: .9, metalness: .35, roughness: .25 });
      const nodeSphere = new THREE.Mesh(new THREE.SphereGeometry(index === 2 ? .19 : .13, 16, 12), nodeMaterial);
      nodeSphere.position.set(x, y, z); nodeSphere.userData.label = `Signal node ${index + 1}`; nodeSphere.userData.baseEmissive = nodeMaterial.emissive.getHex(); stages[3].add(nodeSphere); interactables.push(nodeSphere);
      if (index > 0) thread(new THREE.Vector3(x, y, z), new THREE.Vector3(network[index - 1][0], network[index - 1][1], network[index - 1][2]), stages[3]);
      if (index === 2 || index === 4) thread(new THREE.Vector3(x, y, z), new THREE.Vector3(network[0][0], network[0][1], network[0][2]), stages[3]);
    });
    ring(stages[3], 0, 0, -.9, 3.9, dark ? 0x408cdb : 0x9581bd, .4);

    const revelation = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 2), new THREE.MeshPhysicalMaterial({ color: dark ? 0x758aff : 0xb4a1d5, emissive: dark ? 0x2438a0 : 0x604a83, emissiveIntensity: .8, metalness: .35, roughness: .12, transparent: true, opacity: .82, transmission: .22, thickness: .8 }));
    revelation.position.set(.2, .05, -.4); revelation.userData.label = 'The sealed truth'; stages[4].add(revelation); interactables.push(revelation);
    ring(stages[4], .2, .05, -.5, 2.25, dark ? 0x69c8ef : 0x8d72b7, .35);
    ring(stages[4], .2, .05, -.5, 2.8, dark ? 0x566aff : 0xbaa6d2, 1.45);

    const portal = new THREE.Mesh(new THREE.TorusGeometry(2.2, .065, 14, 96), new THREE.MeshStandardMaterial({ color: dark ? 0x788cff : 0x8b72ac, emissive: dark ? 0x2d55cb : 0x5d437f, emissiveIntensity: 1.2, metalness: .45, roughness: .2 }));
    portal.position.set(0, .1, -.35); portal.userData.label = 'Open a new investigation'; stages[5].add(portal); interactables.push(portal);
    ring(stages[5], 0, .1, -.5, 2.55, dark ? 0x4aa4d4 : 0x8d78ae, .16);
    const finalFile = box(1.4, 1.05, .12, 0xffffff, 0, .1, .03, new THREE.MeshStandardMaterial({ map: makePaperTexture('NEW FILE', 'YOUR CASE / 01', '#635b91', !dark), roughness: .65 }), stages[5]);
    finalFile.userData.label = 'Open a new investigation'; interactables.push(finalFile);

    // Desk and a magnifying glass establish depth in the foreground.
    const desk = box(12, .35, 4.5, colors.floor, 0, -3.42, 2.1, undefined, stages[0]);
    desk.rotation.x = -.045;
    const lens = new THREE.Mesh(new THREE.TorusGeometry(.42, .055, 10, 48), new THREE.MeshStandardMaterial({ color: dark ? 0xc5a46c : 0x8b704b, metalness: .72, roughness: .24 }));
    lens.position.set(2.65, -2.68, 1); lens.rotation.x = .18; lens.userData.label = 'Magnifying glass'; stages[0].add(lens); interactables.push(lens);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.045, .065, .95, 12), new THREE.MeshStandardMaterial({ color: dark ? 0x806340 : 0x604b34, metalness: .25, roughness: .45 }));
    handle.position.set(3.05, -3.18, 1); handle.rotation.z = -.68; stages[0].add(handle);

    const particleCount = mobile ? 65 : 190;
    const points = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) { points[i * 3] = (Math.random() - .5) * 14; points[i * 3 + 1] = (Math.random() - .5) * 10; points[i * 3 + 2] = -Math.random() * 96; }
    const particleGeometry = new THREE.BufferGeometry(); particleGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: dark ? 0x9fcaff : 0x7f6d9f, size: .026, transparent: true, opacity: dark ? .56 : .3, sizeAttenuation: true })); scene.add(particles);
    const trailPositions = new Float32Array(24 * 3);
    const trailGeometry = new THREE.BufferGeometry(); trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMaterial = new THREE.LineBasicMaterial({ color: dark ? 0x79dcff : 0x8064bd, transparent: true, opacity: .36 });
    const cursorTrail = new THREE.Line(trailGeometry, trailMaterial); cursorTrail.frustumCulled = false; scene.add(cursorTrail);

    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(5, 5); const look = new THREE.Vector3(0, 0, -1.8);
    const sceneControls = node.parentElement?.querySelector<HTMLElement>('.scene-interactions');
    let targetX = 0; let targetY = 0; let raf = 0; let visible = true; let scrollY = window.scrollY; let journey = 0; let hasPointer = false; let trailSamples = 0;
    let cursorX = -100; let cursorY = -100; let currentCursorX = -100; let currentCursorY = -100;
    const customCursor = document.querySelector<HTMLElement>('.interactive-cursor');
    const onGlobalPointerMove = (event: PointerEvent) => {
      cursorX = event.clientX; cursorY = event.clientY;
      const target = (event.target as HTMLElement).closest('a,button'); customCursor?.classList.toggle('is-hot', Boolean(target));
      const magnetic = (event.target as HTMLElement).closest<HTMLElement>('.hero-cta');
      if (magnetic) { const rect = magnetic.getBoundingClientRect(); magnetic.style.setProperty('--mag-x', `${(event.clientX - rect.left - rect.width / 2) * .08}px`); magnetic.style.setProperty('--mag-y', `${(event.clientY - rect.top - rect.height / 2) * .12}px`); }
    };
    const onPointerMove = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; targetX = pointer.x * .45; targetY = pointer.y * .22; hasPointer = true; if (reduced) animate(); };
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
      if (activeHit && activeHit !== hit && activeHit instanceof THREE.Mesh && activeHit.material instanceof THREE.MeshStandardMaterial) activeHit.material.emissive.setHex(activeHit.userData.baseEmissive ?? 0x000000);
      activeHit = hit;
      if (hit instanceof THREE.Mesh && hit.material instanceof THREE.MeshStandardMaterial) hit.material.emissive.setHex(dark ? 0x354fe0 : 0x624b91);
      customCursor?.classList.toggle('is-hot', Boolean(hit));
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
      if (tooltip) { tooltip.style.opacity = hit ? '1' : '0'; tooltip.textContent = hit ? `${String(hit.userData.label)} · click to inspect` : ''; tooltip.style.left = `${(pointer.x + 1) * 50}%`; tooltip.style.top = `${(1 - pointer.y) * 50}%`; }
    };
    const trackPointer = (event: PointerEvent) => { onPointerMove(event); onHover(); };
    const onPointerLeave = () => { hasPointer = false; pointer.set(5, 5); if (activeHit instanceof THREE.Mesh && activeHit.material instanceof THREE.MeshStandardMaterial) activeHit.material.emissive.setHex(activeHit.userData.baseEmissive ?? 0); activeHit = undefined; if (tooltip) tooltip.style.opacity = '0'; renderer.domElement.style.cursor = 'grab'; };
    const onScroll = () => {
      scrollY = window.scrollY;
      node.dataset.chapter = String(Math.round(Math.min(scrollY / Math.max(window.innerHeight, 1), 5)));
      const showControls = scrollY < window.innerHeight * .72;
      if (sceneControls) { sceneControls.style.opacity = showControls ? '1' : '0'; sceneControls.style.visibility = showControls ? 'visible' : 'hidden'; sceneControls.style.pointerEvents = showControls ? 'auto' : 'none'; }
      if (reduced) animate();
    };
    const onVisibility = () => { visible = document.visibilityState === 'visible'; if (visible) animate(); };
    const resize = new ResizeObserver(() => { if (!node.clientWidth || !node.clientHeight) return; camera.aspect = node.clientWidth / node.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(node.clientWidth, node.clientHeight); });
    renderer.domElement.addEventListener('pointermove', trackPointer); renderer.domElement.addEventListener('pointerleave', onPointerLeave); renderer.domElement.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll, { passive: true }); document.addEventListener('visibilitychange', onVisibility);
    let elapsed = 0; let previous = performance.now();
    const animate = (now = performance.now()) => {
      if (!visible) return;
      if (!reduced) raf = requestAnimationFrame(animate);
      const delta = Math.min((now - previous) / 1000, .05); previous = now; elapsed += delta;
      const desiredJourney = Math.min(scrollY / Math.max(window.innerHeight, 1), 5);
      journey += (desiredJourney - journey) * (reduced ? 1 : .035);
      const pathT = journey / 5;
      const cameraBase = mobile ? 15 : 12;
      camera.position.x += ((Math.sin(pathT * Math.PI * 1.65) * 1.25 + (mobile ? targetX * .22 : targetX * .58)) - camera.position.x) * .035;
      camera.position.y += ((.25 + Math.sin(pathT * Math.PI * 2) * .3 - targetY * .18) - camera.position.y) * .035;
      camera.position.z += ((cameraBase - journey * 17) - camera.position.z) * .035;
      look.set(Math.sin(pathT * Math.PI * 1.65) * .35, Math.cos(pathT * Math.PI * 1.6) * .15, camera.position.z - (mobile ? 17 : 14));
      camera.lookAt(look);
      if (hasPointer) {
        raycaster.setFromCamera(pointer, camera);
        const trailPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(camera.position.z - 6));
        const worldPointer = raycaster.ray.intersectPlane(trailPlane, new THREE.Vector3());
        const trailAttribute = trailGeometry.getAttribute('position') as THREE.BufferAttribute;
        const pointsArray = trailAttribute.array as Float32Array;
        if (worldPointer && !reduced) {
          for (let i = pointsArray.length - 3; i >= 3; i -= 3) { pointsArray[i] = pointsArray[i - 3]; pointsArray[i + 1] = pointsArray[i - 2]; pointsArray[i + 2] = pointsArray[i - 1]; }
          pointsArray[0] += (worldPointer.x - pointsArray[0]) * .42; pointsArray[1] += (worldPointer.y - pointsArray[1]) * .42; pointsArray[2] += (worldPointer.z - pointsArray[2]) * .42;
          trailSamples = Math.min(trailSamples + 1, 24); trailGeometry.setDrawRange(0, trailSamples); trailAttribute.needsUpdate = true;
        }
      }
      if (customCursor && !mobile && !reduced) { currentCursorX += (cursorX - currentCursorX) * .24; currentCursorY += (cursorY - currentCursorY) * .24; customCursor.style.transform = `translate3d(${currentCursorX}px,${currentCursorY}px,0)`; }
      if (!reduced) { center.rotation.y = Math.sin(elapsed * .42) * .04; particles.rotation.y = elapsed * .003; key.position.x = -4 + Math.sin(elapsed * .25) * .55; revelation.rotation.y += delta * .19; revelation.rotation.x += delta * .07; portal.rotation.z += delta * .12; shards.forEach((shard, index) => { shard.rotation.x += delta * (.1 + index * .015); shard.rotation.y += delta * .14; }); stages[2].rotation.y = Math.sin(elapsed * .22) * .06; stages[3].rotation.z = Math.sin(elapsed * .18) * .035; }
      renderer.render(scene, camera);
    };
    window.addEventListener('pointermove', onGlobalPointerMove, { passive: true });
    animate();
    const clearMagnet = (event: PointerEvent) => { const magnetic = (event.target as HTMLElement).closest<HTMLElement>('.hero-cta'); magnetic?.style.setProperty('--mag-x', '0px'); magnetic?.style.setProperty('--mag-y', '0px'); };
    resize.observe(node); window.addEventListener('pointerout', clearMagnet);
    return () => { cancelAnimationFrame(raf); resize.disconnect(); renderer.domElement.removeEventListener('pointermove', trackPointer); renderer.domElement.removeEventListener('pointerleave', onPointerLeave); renderer.domElement.removeEventListener('click', onClick); window.removeEventListener('pointermove', onGlobalPointerMove); window.removeEventListener('pointerout', clearMagnet); window.removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', onVisibility); customCursor?.classList.remove('is-hot'); scene.traverse((item) => { if (item instanceof THREE.Mesh || item instanceof THREE.Points || item instanceof THREE.Line) { item.geometry.dispose(); const materials = Array.isArray(item.material) ? item.material : [item.material]; materials.forEach((material) => { if ('map' in material && material.map) material.map.dispose(); material.dispose(); }); } }); renderer.dispose(); renderer.domElement.remove(); };
  }, [theme, onSelect]);

  return <>
    <div className="investigation-scene" ref={host} role="img" aria-label="Interactive three-dimensional mystery investigation world"><div className="scene-tooltip" role="status" />
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
