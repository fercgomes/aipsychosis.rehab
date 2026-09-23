export function terrain(x, z) {
  return Math.sin(x * 0.12 + z * 0.065) * 0.55 + Math.sin(z * 0.18) * 0.25;
}

export function createField(count, random = Math.random) {
  const roots = new Float32Array(count * 3);
  const shape = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const near = i < count * 0.78;
    const x = (random() - 0.5) * (near ? 36 : 130);
    const z = near ? 12 - random() * 39 : -25 - random() * 105;
    roots.set([x, terrain(x, z), z], i * 3);
    shape.set([0.38 + random() * 0.56, 0.025 + random() * 0.037, random() * Math.PI * 2, random()], i * 4);
  }
  return { roots, shape, bends: new Float32Array(count * 2), velocity: new Float32Array(count * 2) };
}

export function stepGrass(field, hand, delta) {
  const dt = Math.min(Math.max(delta, 0), 1 / 30);
  const { roots, bends, velocity } = field;
  const radius = hand.pressed ? 1.3 : 0.85;
  const sx = hand.x - hand.previousX;
  const sz = hand.z - hand.previousZ;
  const lengthSquared = sx * sx + sz * sz;
  // ponytail: linear blade scan; spatial bins if larger fields exceed the frame budget.
  for (let i = 0; i < bends.length / 2; i++) {
    let targetX = 0;
    let targetZ = 0;
    if (hand.active) {
      const x = roots[i * 3];
      const z = roots[i * 3 + 2];
      const t = lengthSquared ? Math.max(0, Math.min(1, ((x - hand.previousX) * sx + (z - hand.previousZ) * sz) / lengthSquared)) : 0;
      const dx = x - (hand.previousX + sx * t);
      const dz = z - (hand.previousZ + sz * t);
      const distance = Math.hypot(dx, dz);
      if (distance < radius) {
        const influence = (1 - distance / radius) ** 2;
        const force = (hand.pressed ? 1.35 : 0.9) * influence;
        targetX = (dx / Math.max(distance, 0.1) + Math.max(-0.7, Math.min(0.7, sx * 3))) * force;
        targetZ = (dz / Math.max(distance, 0.1) + 0.35 + Math.max(-0.7, Math.min(0.7, sz * 3))) * force;
      }
    }
    const k = i * 2;
    velocity[k] += ((targetX - bends[k]) * 95 - velocity[k] * 12) * dt;
    velocity[k + 1] += ((targetZ - bends[k + 1]) * 95 - velocity[k + 1] * 12) * dt;
    bends[k] += velocity[k] * dt;
    bends[k + 1] += velocity[k + 1] * dt;
  }
}
