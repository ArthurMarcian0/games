import * as THREE from 'three';
import { pick } from '../core/MathUtils.js';

/**
 * Público instanciado (corpo + cabeça) com animação no shader: cada pessoa
 * balança e, com a empolgação (uExcite), parte do público pula.
 * seats: [{ x, y, z, face, scale? }]
 */
export function createCrowd(seats, { shirtColors, skinTones, bodyRoughness = 0.9 }) {
  const uniforms = { uTime: { value: 0 }, uExcite: { value: 0 } };
  const patch = (mat) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uExcite = uniforms.uExcite;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uExcite;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float h = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
  float bob = abs(sin(uTime * (2.2 + h * 3.0) + h * 40.0));
  float stand = step(0.3, h) * uExcite;
  transformed.y += bob * (0.025 + stand * 0.32) + stand * 0.25;
#endif`,
        );
    };
    return mat;
  };

  const bodyGeo = new THREE.BoxGeometry(0.42, 0.62, 0.3);
  bodyGeo.translate(0, 0.42, 0);
  const headGeo = new THREE.SphereGeometry(0.13, 8, 6);
  headGeo.translate(0, 0.88, 0);
  const bodyMat = patch(new THREE.MeshStandardMaterial({ roughness: bodyRoughness }));
  const headMat = patch(new THREE.MeshStandardMaterial({ roughness: 0.8 }));
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, seats.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, seats.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  seats.forEach((s, i) => {
    q.setFromAxisAngle(up, s.face);
    const k = s.scale || 1;
    m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(k, k, k));
    bodies.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
    bodies.setColorAt(i, c.set(pick(shirtColors)));
    heads.setColorAt(i, c.set(pick(skinTones)));
  });
  bodies.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  return { meshes: [bodies, heads], uniforms };
}
