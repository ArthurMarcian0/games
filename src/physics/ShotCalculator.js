import * as THREE from 'three';
import { COURT, GRAVITY, SHOT } from '../config/Constants.js';
import { gauss, clamp } from '../core/MathUtils.js';

// Resolve a velocidade de lançamento para atingir um alvo com determinado ângulo
export function solveLaunch(from, target, angleDeg) {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const d = Math.hypot(dx, dz) || 0.001;
  const dy = target.y - from.y;
  let theta = (angleDeg * Math.PI) / 180;
  // garante solução: tanθ precisa ser maior que dy/d
  const minTheta = Math.atan2(dy, d) + 0.12;
  if (theta < minTheta) theta = minTheta;
  const cos = Math.cos(theta);
  const denom = 2 * cos * cos * (d * Math.tan(theta) - dy);
  const v = Math.sqrt((GRAVITY * d * d) / Math.max(denom, 1e-4));
  return new THREE.Vector3((dx / d) * v * cos, v * Math.sin(theta), (dz / d) * v * cos);
}

// Velocidade para uma trajetória com tempo de voo definido (passes)
export function solveByTime(from, target, T) {
  return new THREE.Vector3(
    (target.x - from.x) / T,
    (target.y - from.y + 0.5 * GRAVITY * T * T) / T,
    (target.z - from.z) / T,
  );
}

export function isThreePoint(pos, side) {
  const bx = side * COURT.basketX;
  const d = Math.hypot(pos.x - bx, pos.z);
  if (Math.abs(pos.z) >= COURT.threeSideZ) return true;
  return d >= COURT.threeRadius;
}

export function classifyTiming(meter) {
  const e = meter - SHOT.sweetSpot;
  const ae = Math.abs(e);
  if (ae <= SHOT.perfectWindow) return { grade: 'perfect', label: 'PERFEITO!', error: e };
  if (ae <= SHOT.goodWindow) return { grade: 'good', label: e < 0 ? 'BOM (cedo)' : 'BOM (tarde)', error: e };
  return { grade: 'bad', label: e < 0 ? 'MUITO CEDO' : 'MUITO TARDE', error: e };
}

// Mede o quanto o arremesso está sendo contestado (0 = livre, 1 = muito marcado)
export function contestLevel(shooter, opponents, basket) {
  let best = 0;
  const toBasket = new THREE.Vector2(basket.x - shooter.pos.x, basket.z - shooter.pos.z).normalize();
  for (const o of opponents) {
    const dx = o.pos.x - shooter.pos.x;
    const dz = o.pos.z - shooter.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.4) continue;
    const front = (dx * toBasket.x + dz * toBasket.y) / (d || 1);
    if (front < -0.2) continue;
    let c = (1 - d / 2.4) * (0.55 + 0.45 * Math.max(0, front));
    if (!o.onGround || o.action === 'block' || o.contesting) c *= 1.45;
    c *= 0.6 + 0.5 * o.attr('defense');
    best = Math.max(best, c);
  }
  return clamp(best, 0, 1);
}

/**
 * Calcula a velocidade do arremesso considerando distância, força (tempo da
 * barra), direção e precisão. O erro é modelado como desvio do ponto de
 * mira no plano do aro; a física da bola decide se entra.
 */
export function computeJumpShot({ from, rim, meter, skill, contest, fatigue, extraSigma = 0, isFreeThrow = false }) {
  const d = Math.hypot(rim.x - from.x, rim.z - from.z);
  const timing = classifyTiming(meter);
  let sigma = 0.03 + 0.024 * Math.max(0, d - 2) + (1 - skill) * 0.18 + contest * 0.14 + fatigue * 0.08 + extraSigma;
  let longErr;
  if (timing.grade === 'perfect') {
    sigma *= 0.35;
    longErr = timing.error * 0.2;
  } else if (timing.grade === 'good') {
    sigma *= 0.9;
    longErr = timing.error * 0.4;
  } else {
    longErr = timing.error * 1.1 + Math.sign(timing.error) * 0.04;
  }
  if (isFreeThrow) sigma *= 0.85;
  const long = longErr + gauss() * sigma;
  const lat = gauss() * sigma * 0.55;

  const dir = new THREE.Vector3(rim.x - from.x, 0, rim.z - from.z).normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  // mira levemente além do centro: a janela de acerto é assimétrica (aro de trás ajuda)
  const target = rim.clone().addScaledVector(dir, long + 0.045).addScaledVector(perp, lat);
  const angle = (isFreeThrow ? 52 : 50 + clamp((d - 5) * 0.6, -3, 3)) + gauss() * 0.8;
  const velocity = solveLaunch(from, target, angle);
  return { velocity, timing, sigma, distance: d };
}

export function computeLayup({ from, rim, side, skill, contest }) {
  const sigma = 0.028 + (1 - skill) * 0.12 + contest * 0.16;
  const dir = new THREE.Vector3(rim.x - from.x, 0, rim.z - from.z).normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  // mira levemente no fundo do aro (mais próxima da tabela)
  const target = rim.clone();
  target.x += side * 0.04;
  target.addScaledVector(dir, gauss() * sigma).addScaledVector(perp, gauss() * sigma * 0.8);
  target.y += 0.02;
  const velocity = solveLaunch(from, target, 64);
  return { velocity, sigma };
}
