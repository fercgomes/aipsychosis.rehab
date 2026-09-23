import * as THREE from 'three';
import { createField, stepGrass, terrain } from './grass.js';

export function createMeadow(canvas, cursor, settings, onTouch, onError, onBrush) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d8e5d7');
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 260);
  camera.position.set(0, 3.4, 8);
  camera.lookAt(0, 1.4, -15);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const field = createField(matchMedia('(pointer: coarse)').matches ? 24000 : 46000);
  const base = new THREE.PlaneGeometry(1, 1, 1, 5);
  base.translate(0, 0.5, 0);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.attributes.position = base.attributes.position;
  geometry.attributes.uv = base.attributes.uv;
  geometry.setAttribute('root', new THREE.InstancedBufferAttribute(field.roots, 3));
  geometry.setAttribute('shape', new THREE.InstancedBufferAttribute(field.shape, 4));
  const bend = new THREE.InstancedBufferAttribute(field.bends, 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('bend', bend);
  geometry.instanceCount = field.shape.length / 4;
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, breeze: { value: 0.45 } },
    vertexShader: `
      attribute vec3 root;
      attribute vec4 shape;
      attribute vec2 bend;
      uniform float time;
      uniform float breeze;
      varying float height;
      varying float variation;
      varying float facing;
      varying float depth;
      void main() {
        height = uv.y;
        variation = shape.w;
        float angle = shape.z;
        float taper = pow(1.0 - height, 0.75);
        vec3 p = vec3(position.x * shape.y * taper, height * shape.x, 0.0);
        p.xz = vec2(p.x * cos(angle), p.x * sin(angle));
        float wave = sin(root.x * 0.46 + root.z * 0.31 - time * 1.6);
        float flutter = sin(time * 3.2 + root.x * 2.3 + root.z) * 0.035;
        vec2 sway = vec2(0.12 + wave * 0.16, 0.05 + wave * 0.08) * breeze + vec2(flutter * breeze);
        vec2 lean = bend + sway + vec2(cos(angle), sin(angle)) * 0.10;
        p.xz += lean * height * height * shape.x;
        p.y *= 1.0 / sqrt(1.0 + dot(lean, lean) * height * height);
        vec4 viewPosition = modelViewMatrix * vec4(root + p, 1.0);
        depth = -viewPosition.z;
        facing = 0.82 + 0.18 * sin(angle + 0.7);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying float height;
      varying float variation;
      varying float facing;
      varying float depth;
      void main() {
        vec3 low = vec3(0.035, 0.095, 0.014);
        vec3 high = mix(vec3(0.23, 0.37, 0.047), vec3(0.48, 0.54, 0.13), variation);
        vec3 color = mix(low, high, pow(height, 0.7)) * facing;
        color += vec3(0.10, 0.085, 0.02) * pow(height, 5.0);
        float fog = 1.0 - exp(-depth * depth * 0.00024);
        color = mix(color, vec3(0.56, 0.65, 0.43), fog);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const grass = new THREE.Mesh(geometry, material);
  grass.frustumCulled = false;
  scene.add(grass);

  const groundGeometry = new THREE.PlaneGeometry(320, 320, 160, 160);
  groundGeometry.rotateX(-Math.PI / 2);
  const positions = groundGeometry.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setY(i, terrain(positions.getX(i), positions.getZ(i)) - 0.03);
  const groundMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 point;
      varying float depth;
      void main() {
        point = position;
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        depth = -p.z;
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: `
      varying vec3 point;
      varying float depth;
      void main() {
        float patches = sin(point.x * 2.0 + sin(point.z)) * sin(point.z * 1.7);
        vec3 color = vec3(0.085, 0.14, 0.026) + patches * 0.015;
        color = mix(color, vec3(0.56, 0.65, 0.43), 1.0 - exp(-depth * depth * 0.00024));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  scene.add(new THREE.Mesh(groundGeometry, groundMaterial));

  const skyGeometry = new THREE.SphereGeometry(220, 32, 16);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 direction; void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 direction;
      void main() {
        vec3 d = normalize(direction);
        vec3 color = mix(vec3(0.73, 0.79, 0.61), vec3(0.38, 0.65, 0.72), smoothstep(0.0, 0.65, d.y));
        float sun = max(dot(d, normalize(vec3(-0.6, 0.42, -1.0))), 0.0);
        color += vec3(0.22, 0.15, 0.055) * pow(sun, 16.0);
        color = mix(color, vec3(1.0, 0.94, 0.69), smoothstep(0.9991, 0.9995, sun));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeometry, skyMaterial));

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const point = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
  const hand = { x: 0, z: 0, previousX: 0, previousZ: 0, active: false, pressed: false };
  let touched = false;
  let lastX = 0;
  let screenX = 0;
  let screenY = 0;
  let tilt = 0;
  let keyboard = false;
  const move = (event) => {
    const bounds = canvas.getBoundingClientRect();
    screenX = event.clientX - bounds.left;
    screenY = event.clientY - bounds.top;
    pointer.set(screenX / bounds.width * 2 - 1, -(screenY / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.ray.intersectPlane(plane, point);
    if (hit) {
      for (let i = 0; i < 3; i++) {
        plane.constant = -(terrain(point.x, point.z) + 0.4);
        raycaster.ray.intersectPlane(plane, point);
      }
    }
    const active = Boolean(hit && point.z > -24 && point.z < 13 && Math.abs(point.x) < 18);
    if (active) {
      if (!hand.active) { hand.previousX = point.x; hand.previousZ = point.z; }
      hand.x = point.x;
      hand.z = point.z;
      if (!touched) { touched = true; onTouch(); }
    }
    hand.active = active;
    tilt = Math.max(-24, Math.min(24, (screenX - lastX) * 1.2));
    lastX = screenX;
    cursor.style.opacity = active ? '1' : '0';
    canvas.style.cursor = active ? 'none' : 'default';
    cursor.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) rotate(${tilt}deg) scale(${hand.pressed ? 0.9 : 1})`;
  };
  const leave = () => {
    hand.active = false;
    hand.pressed = false;
    cursor.style.opacity = '0';
    canvas.style.cursor = 'default';
  };
  const down = event => {
    keyboard = false;
    hand.pressed = true;
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
    move(event);
  };
  const up = event => {
    hand.pressed = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (event.pointerType === 'touch') leave();
  };
  const pointerMove = event => { keyboard = false; move(event); };
  const keydown = event => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') { leave(); return; }
    const bounds = canvas.getBoundingClientRect();
    if (!keyboard || !hand.active) { screenX = bounds.width / 2; screenY = bounds.height * 0.75; }
    keyboard = true;
    if (event.key === ' ') hand.pressed = true;
    if (event.key === 'ArrowLeft') screenX -= 22;
    if (event.key === 'ArrowRight') screenX += 22;
    if (event.key === 'ArrowUp') screenY -= 22;
    if (event.key === 'ArrowDown') screenY += 22;
    screenX = Math.max(20, Math.min(bounds.width - 20, screenX));
    screenY = Math.max(bounds.height * 0.53, Math.min(bounds.height - 24, screenY));
    move({ clientX: screenX + bounds.left, clientY: screenY + bounds.top });
  };
  const keyup = event => { if (event.key === ' ') hand.pressed = false; };
  const lostContext = event => { event.preventDefault(); renderer.setAnimationLoop(null); onError(); };
  const events = { pointermove: pointerMove, pointerdown: down, pointerup: up, pointercancel: leave, pointerleave: leave, keydown, keyup, blur: leave, webglcontextlost: lostContext };
  for (const [name, handler] of Object.entries(events)) canvas.addEventListener(name, handler);
  const resize = new ResizeObserver(() => {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  resize.observe(canvas);
  let previous = 0;
  let elapsed = 0;
  let wasActive = false;
  let wasPressed = false;
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - previous) / 1000, 1 / 30);
    previous = now;
    if (document.hidden) return;
    if (!settings.current.paused) {
      elapsed += dt;
      stepGrass(field, hand, dt);
      bend.needsUpdate = true;
      material.uniforms.time.value = elapsed;
      const speed = Math.hypot(hand.x - hand.previousX, hand.z - hand.previousZ) / Math.max(dt, 1 / 120);
      if (hand.active && hand.pressed && (!wasActive || !wasPressed || speed > 0.01)) {
        onBrush(Math.min(1, 0.18 + speed * 0.08 + (hand.pressed ? 0.25 : 0)), pointer.x);
      } else if (wasPressed && (!hand.active || !hand.pressed)) {
        onBrush(0, pointer.x);
      }
    }
    wasActive = hand.active;
    wasPressed = hand.pressed;
    material.uniforms.breeze.value = reducedMotion.matches ? 0 : settings.current.wind;
    hand.previousX = hand.x;
    hand.previousZ = hand.z;
    renderer.render(scene, camera);
  });
  return () => {
    renderer.setAnimationLoop(null);
    resize.disconnect();
    for (const [name, handler] of Object.entries(events)) canvas.removeEventListener(name, handler);
    for (const resource of [geometry, base, material, groundGeometry, groundMaterial, skyGeometry, skyMaterial]) resource.dispose();
    renderer.dispose();
    leave();
  };
}
