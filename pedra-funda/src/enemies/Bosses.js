// Chefes: O Carcereiro (delegacia), A Ninhada (hospital) e O Cervo Pálido (mata).
import * as THREE from 'three';
import { Enemy, Rastejante } from './Enemy.js';
import { buildHumanoid, buildQuadruped, resetPose, gait, quadGait } from '../entities/Rig.js';
import { charMat } from '../engine/materials.js';
import { clamp, damp, lerp, rand, chance } from '../core/utils.js';

const V = new THREE.Vector3();

// ===========================================================================
// O CARCEREIRO — o delegado Bastos, deformado pelo "reforço" da Vértice.
// Escudo de osso no braço esquerdo bloqueia tiros frontais; pústulas nas
// costas são o ponto fraco. Investidas contra paredes o deixam atordoado.
export class Carcereiro extends Enemy {
  constructor(world, def) {
    super(world, def);
    const uniform = charMat(0x1f2a3e, 0.8, { tex: 'fabric' });
    const skin = charMat(0xa89a8a, 0.6, { tex: 'paleskin' });
    const boneMat = charMat(0xc8b898, 0.55, { tex: 'skin' });
    const pusMat = charMat(0x6a2a10, 0.3, { emissive: 0xff7a1a, ei: 1.6 });
    this.pustules = [];
    const rig = buildHumanoid({
      height: 2.45,
      bulk: 1.65,
      head: 'cap',
      capColor: 0x141c2a,
      jacketMat: uniform,
      pants: 0x161c28,
      shoes: 0x0e0e0e,
      skinMat: skin,
      armLength: 1.15,
      sleeves: false,
      extras: (r, s) => {
        // escudo ósseo fundido ao antebraço esquerdo
        const shield = new THREE.Group();
        const plate = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), boneMat);
        plate.scale.set(0.42 * s, 0.55 * s, 0.12 * s);
        plate.castShadow = true;
        shield.add(plate);
        for (let i = 0; i < 5; i++) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.25 * s, 5), boneMat);
          spike.position.set(rand(-0.25, 0.25) * s, rand(-0.35, 0.35) * s, 0.1 * s);
          spike.rotation.x = Math.PI / 2;
          spike.castShadow = true;
          shield.add(spike);
        }
        const metal = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.25 * s, 0.03 * s), charMat(0x2a2c30, 0.5, { metal: 0.7, tex: 'metal' }));
        metal.position.set(0, -0.1 * s, 0.1 * s);
        metal.rotation.z = 0.2;
        shield.add(metal);
        shield.position.set(0.05 * s, -0.18 * s, 0.12 * s);
        r.lEl.add(shield);
        r.shield = shield;
        // pústulas brilhantes nas costas
        for (let i = 0; i < 4; i++) {
          const p = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 10, 8), pusMat);
          p.position.set(rand(-0.15, 0.15) * s, rand(0.0, 0.32) * s, -0.15 * s);
          r.spine.add(p);
          this.pustules.push(p);
        }
        // corrente de algemas na mão direita
        const chainMat = charMat(0x6a6a68, 0.4, { metal: 0.8 });
        const chain = new THREE.Group();
        for (let i = 0; i < 9; i++) {
          const link = new THREE.Mesh(new THREE.TorusGeometry(0.035 * s, 0.01 * s, 4, 8), chainMat);
          link.position.y = -i * 0.07 * s;
          link.rotation.y = i % 2 ? Math.PI / 2 : 0;
          chain.add(link);
        }
        chain.position.y = -0.08 * s;
        r.rHand.add(chain);
        r.chain = chain;
      },
    });
    this.rig = rig;
    this.attachModel(rig.root);
    this.maxHp = this.hp = 820 * this.game.diff.enemyHp;
    this.radius = 0.8;
    this.state = 'intro';
    this.phase = 0;
    this.cool = 2;
    this.isBoss = true;
    this.name = 'O Carcereiro';
    this.bloodScale = 1.5;
    this.persistKill = 'boss1_dead';
  }

  hitSpheres() {
    const r = this.rig;
    const out = [];
    // escudo (bloqueio)
    out.push(this.sph(r.shield, 0, 0, 0, 0.55 * r.s, 'shield', 0.08));
    for (const p of this.pustules) {
      V.set(0, 0, 0);
      p.localToWorld(V);
      out.push({ c: V.clone(), r: 0.16, zone: 'weak', mult: 2.6 });
    }
    out.push(this.sph(r.head, 0, 0.1, 0, 0.2, 'head', 1.6));
    out.push(this.sph(r.chest, 0, 0.05, 0, 0.42, 'body', 0.7));
    out.push(this.sph(r.spine, 0, 0.1, 0, 0.4, 'body', 0.7));
    return out;
  }

  modifyDamage(dmg, info) {
    if (this.state === 'intro') return 0;
    // de frente, com o escudo erguido, quase todo dano é bloqueado
    if (info.from && this.state !== 'stunned') {
      const facing = this.faceDot(info.from.x, info.from.z);
      if (facing > 0.55 && info.zone !== 'weak') {
        if (info.point) this.world.particles.sparks(info.point, 6);
        this.game.audio.play('hitMetal', info.point || this.pos, 0.8);
        return dmg * 0.12;
      }
    }
    return this.state === 'stunned' ? dmg * 1.35 : dmg;
  }

  onHit(dmg, info) {
    if (info.zone === 'weak') this.game.audio.play('squelch', this.pos, 0.8);
  }

  explosionHit(dmg) {
    this.takeDamage(dmg, { zone: 'body' });
    if (this.alive && this.state !== 'stunned') {
      this.setState('stunned');
      this.stunDur = 2.5;
    }
  }

  onDeath() {
    const g = this.game;
    g.audio.play('bossRoar', this.pos, 0.8);
    g.cam.shake(0.1, 1);
    setTimeout(() => g.audio.play('slam', this.pos), 900);
    this.world.decals.add(this.pos.x, this.pos.z, 3, 0);
    g.setFlag('boss1_dead');
    if (this.onDefeated) this.onDefeated();
  }

  update(dt) {
    const g = this.game;
    const p = this.player;
    this.stateT += dt;
    if (!this.alive) {
      this.deathT += dt;
      this.animate(dt, 0);
      return;
    }
    const d = this.distToPlayer();
    let speed = 0;
    this.cool -= dt;
    switch (this.state) {
      case 'intro':
        this.faceTo(p.pos.x, p.pos.z, dt, 3);
        if (this.stateT > 0.2 && !this.roared) {
          this.roared = true;
          g.audio.play('bossRoar', this.pos);
          g.cam.shake(0.06, 1.2);
        }
        if (this.stateT > 2.2) this.setState('approach');
        break;
      case 'approach':
        speed = 1.55;
        this.moveToward(p.pos.x, p.pos.z, speed, dt, 3);
        if (this.cool <= 0) {
          if (d < 2.8) this.setState('slamWind');
          else if (d < 5.2 && chance(0.55)) this.setState('whipWind');
          else if (d > 5) this.setState('chargeWind');
          this.cool = rand(1.2, 2.2);
        }
        break;
      case 'chargeWind':
        this.faceTo(p.pos.x, p.pos.z, dt, 5);
        if (this.stateT < 0.05) {
          g.audio.play('bossRoar', this.pos, 0.7);
          g.audio.play('chain', this.pos);
        }
        if (this.stateT > 1.0) {
          this.chargeDir = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
          this.chargeHit = false;
          this.setState('charge');
        }
        break;
      case 'charge': {
        speed = 9;
        const nx = this.pos.x + this.chargeDir.x * speed * dt;
        const nz = this.pos.z + this.chargeDir.z * speed * dt;
        if (this.world.collision.blocked(nx, nz, this.radius) || this.stateT > 3) {
          // bateu
          g.audio.play('slam', this.pos);
          g.cam.shake(0.1, 0.5);
          this.world.particles.dust(new THREE.Vector3(nx, 1.2, nz), 20);
          this.setState('stunned');
          this.stunDur = 3.2;
          break;
        }
        this.pos.x = nx;
        this.pos.z = nz;
        if (!this.chargeHit && d < 1.6) {
          this.chargeHit = true;
          p.takeDamage(30, this.pos, { knock: true, invuln: 1 });
        }
        if (Math.floor(this.stateT * 6) !== Math.floor((this.stateT - dt) * 6)) g.audio.play('vigiaStep', this.pos, 0.8);
        break;
      }
      case 'stunned':
        if (this.stateT > (this.stunDur || 3)) {
          this.setState('approach');
          this.cool = 0.8;
        }
        break;
      case 'whipWind':
        this.faceTo(p.pos.x, p.pos.z, dt, 4);
        if (this.stateT > 0.75 && !this.hitDone) {
          this.hitDone = true;
          g.audio.play('chain', this.pos, 1.2);
          g.audio.play('swing', this.pos, 1.2);
          if (d < 5.4 && this.faceDot(p.pos.x, p.pos.z) > 0.25) p.takeDamage(20, this.pos);
        }
        if (this.stateT > 1.4) {
          this.hitDone = false;
          this.setState('approach');
        }
        break;
      case 'slamWind':
        this.faceTo(p.pos.x, p.pos.z, dt, 3);
        if (this.stateT > 0.85 && !this.hitDone) {
          this.hitDone = true;
          g.audio.play('slam', this.pos, 1.2);
          g.cam.shake(0.1, 0.5);
          this.world.addRing(this.pos.x, this.pos.z, 5, 22, 7);
          this.world.particles.dust(new THREE.Vector3(this.pos.x, 0.2, this.pos.z), 25);
        }
        if (this.stateT > 1.7) {
          this.hitDone = false;
          this.setState('approach');
        }
        break;
    }
    // pústulas pulsando
    const pulse = 1 + Math.sin(performance.now() / 160) * 0.15;
    for (const pu of this.pustules) pu.scale.setScalar(pulse);
    this.animate(dt, speed);
  }

  animate(dt, speed) {
    const r = this.rig;
    resetPose(r);
    this.root.rotation.set(0, this.yaw, 0);
    const t = performance.now() / 1000;
    if (!this.alive) {
      const k = Math.min(1, this.deathT / 1.2);
      this.root.rotation.x = k * k * Math.PI * 0.48;
      r.hips.position.y = r.s * 0.92 - k * 0.3;
      r.lSh.rotation.x = -k * 1.5;
      r.rSh.rotation.x = -k * 2;
      return;
    }
    this.phase += (Math.min(speed, 4) / 2) * Math.PI * 2 * dt;
    gait(r, this.phase, clamp(speed / 2, 0, 1), this.state === 'charge' ? 1 : 0, { noArms: true });
    r.spine.rotation.x = 0.25;
    r.head.rotation.x = -0.3;
    // escudo à frente
    r.lSh.rotation.x = -1.25;
    r.lSh.rotation.z = -0.55;
    r.lEl.rotation.x = -1.15;
    r.rSh.rotation.x = -0.2 + Math.sin(this.phase) * 0.3;
    r.rSh.rotation.z = 0.25;
    r.chain.rotation.x = Math.sin(t * 3) * 0.3;
    if (this.state === 'chargeWind') {
      r.spine.rotation.x = 0.7;
      r.lHip.rotation.x = -0.6;
      r.rHip.rotation.x = 0.4;
      r.lKnee.rotation.x = 0.8;
      r.hips.position.y = r.s * 0.8 + Math.sin(t * 30) * 0.01;
    }
    if (this.state === 'charge') r.spine.rotation.x = 0.8;
    if (this.state === 'stunned') {
      r.spine.rotation.x = 1.0 + Math.sin(t * 2) * 0.05;
      r.head.rotation.x = 0.6;
      r.lSh.rotation.x = -0.3;
      r.lEl.rotation.x = -0.2;
      r.rSh.rotation.x = 0.1;
      r.hips.position.y = r.s * 0.82;
      r.lKnee.rotation.x = 0.5;
      r.rKnee.rotation.x = 0.5;
    }
    if (this.state === 'whipWind') {
      const k = Math.min(1, this.stateT / 0.75);
      if (this.stateT < 0.75) {
        r.rSh.rotation.x = -2.6 * k;
        r.rSh.rotation.z = 0.8 * k;
        r.spine.rotation.y = 0.6 * k;
      } else {
        const k2 = Math.min(1, (this.stateT - 0.75) / 0.2);
        r.rSh.rotation.x = lerp(-2.6, -1.2, k2);
        r.rSh.rotation.z = lerp(0.8, -0.9, k2);
        r.spine.rotation.y = lerp(0.6, -0.7, k2);
        r.chain.rotation.x = -1.4 * k2;
      }
    }
    if (this.state === 'slamWind') {
      const k = Math.min(1, this.stateT / 0.85);
      if (this.stateT < 0.85) {
        r.lSh.rotation.x = -3.0 * k;
        r.rSh.rotation.x = -3.0 * k;
        r.spine.rotation.x = -0.2 * k;
      } else {
        r.lSh.rotation.x = -1.2;
        r.rSh.rotation.x = -1.2;
        r.spine.rotation.x = 0.9;
        r.hips.position.y = r.s * 0.75;
        r.lKnee.rotation.x = 0.9;
        r.rKnee.rotation.x = 0.9;
      }
    }
    if (this.state === 'intro') {
      r.spine.rotation.x = -0.25;
      r.head.rotation.x = -0.6;
      r.rSh.rotation.x = -1.0;
      r.rSh.rotation.z = 0.8;
    }
  }
}

// ===========================================================================
// A NINHADA — os pacientes "colhidos", fundidos numa massa presa ao teto da
// ala de isolamento. Três nódulos nas paredes a alimentam; destruídos, o
// núcleo fica exposto.
export class Ninhada extends Enemy {
  constructor(world, def) {
    super(world, def);
    this.center = new THREE.Vector3(def.x, 0, def.z);
    this.root = new THREE.Group();
    this.root.position.copy(this.center);
    this.pos = this.root.position;
    world.scene.add(this.root);
    const flesh = charMat(0x8a3a32, 0.35, { tex: 'flesh' });
    const darkFlesh = charMat(0x4a1a1a, 0.4, { tex: 'flesh' });
    this.mass = new THREE.Group();
    this.mass.position.y = def.h ? def.h - 1.0 : 3.4;
    this.root.add(this.mass);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), i % 3 ? flesh : darkFlesh);
      const s = rand(0.5, 1.1);
      m.scale.set(s, s * rand(0.7, 1.1), s);
      m.position.set(rand(-1.2, 1.2), rand(-0.3, 0.8), rand(-1.2, 1.2));
      m.castShadow = true;
      this.mass.add(m);
    }
    // braços e rostos fundidos (silhuetas humanas na massa)
    for (let i = 0; i < 7; i++) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.7, 4, 8), charMat(0xb0a090, 0.6, { tex: 'paleskin' }));
      const a = rand(0, Math.PI * 2);
      arm.position.set(Math.cos(a) * 1.2, rand(-0.6, 0.2), Math.sin(a) * 1.2);
      arm.rotation.set(rand(-1, 1), a, rand(0.5, 1.2));
      this.mass.add(arm);
    }
    // talo central até o chão
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, this.mass.position.y, 10), darkFlesh);
    stalk.position.y = this.mass.position.y / 2;
    stalk.castShadow = true;
    this.root.add(stalk);
    world.collision.add(def.x - 1.0, def.z - 1.0, def.x + 1.0, def.z + 1.0, 4);
    // núcleo + pétalas
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0x300808, emissive: 0xff2a10, emissiveIntensity: 0.4, roughness: 0.3 });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), this.coreMat);
    this.core.position.set(0, 1.55, 0);
    this.root.add(this.core);
    this.petals = [];
    for (let i = 0; i < 6; i++) {
      const pet = new THREE.Group();
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), flesh);
      m.scale.set(0.3, 0.6, 0.12);
      m.position.set(0, 0.35, 0.45);
      m.castShadow = true;
      pet.add(m);
      pet.position.set(0, 1.25, 0);
      pet.rotation.y = (i / 6) * Math.PI * 2;
      this.root.add(pet);
      this.petals.push(pet);
    }
    // nódulos nas paredes, ligados por tentáculos
    this.nodes = [];
    const nodeMat = () => new THREE.MeshStandardMaterial({ color: 0x302808, emissive: 0xffd040, emissiveIntensity: 1.2, roughness: 0.3 });
    for (const np of def.nodes) {
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), nodeMat());
      n.position.set(np.x, np.y, np.z);
      world.scene.add(n);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(def.x, this.mass.position.y, def.z),
        new THREE.Vector3((def.x + np.x) / 2, this.mass.position.y + 0.6, (def.z + np.z) / 2),
        new THREE.Vector3(np.x, np.y, np.z),
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.13, 8), darkFlesh);
      tube.castShadow = true;
      world.scene.add(tube);
      const light = def.nodeLights !== false ? null : null;
      this.nodes.push({ mesh: n, tube, hp: 110 * this.game.diff.enemyHp, alive: true, light });
    }
    this.coreHp = 360 * this.game.diff.enemyHp;
    this.maxHp = this.nodes.reduce((a, n) => a + n.hp, 0) + this.coreHp;
    this.hp = this.maxHp;
    this.radius = 1.1;
    this.solid = false;
    this.immortal = true;
    this.isBoss = true;
    this.name = 'A Ninhada';
    this.state = 'intro';
    this.attackT = 2.5;
    this.spawnT = 12;
    this.larvae = [];
    this.tendrils = [];
    this.projectiles = [];
    this.heartT = 0;
    this.exposed = false;
    this.radio = 0;
    this.bloodScale = 1.3;
  }

  hitSpheres() {
    const out = [];
    this.nodes.forEach((n, i) => {
      if (n.alive) out.push({ c: n.mesh.position.clone(), r: 0.38, zone: 'weak', mult: 1, sid: 'node' + i });
    });
    V.set(0, 0, 0);
    this.core.localToWorld(V);
    out.push({ c: V.clone(), r: 0.5, zone: this.exposed ? 'weak' : 'shield', mult: this.exposed ? 1.4 : 0.02, sid: 'core' });
    V.set(0, 0, 0);
    this.mass.localToWorld(V);
    out.push({ c: V.clone(), r: 1.5, zone: 'body', mult: 0.03, sid: 'mass' });
    return out;
  }

  takeDamage(dmg, info = {}) {
    if (!this.alive || this.state === 'intro') return;
    const sid = info.sid || 'mass';
    const g = this.game;
    if (sid.startsWith('node')) {
      const n = this.nodes[+sid.slice(4)];
      if (!n || !n.alive) return;
      n.hp -= dmg;
      this.hp -= dmg;
      g.audio.play('squelch', n.mesh.position, 0.8);
      if (n.hp <= 0) {
        n.alive = false;
        n.mesh.visible = false;
        n.tube.material = charMat(0x2a1010, 0.6);
        this.world.particles.blood(n.mesh.position, new THREE.Vector3(0, -1, 0), 30, 1.5);
        g.audio.play('screech', n.mesh.position, 1.2);
        g.audio.play('bossRoar', this.pos, 0.5);
        g.cam.shake(0.05, 0.6);
        if (this.nodes.every((x) => !x.alive)) {
          this.exposed = true;
          g.hud.message('O núcleo está exposto!');
          this.attackT = 1;
        }
      }
    } else if (sid === 'core' && this.exposed) {
      this.coreHp -= dmg;
      this.hp -= dmg;
      g.audio.play('squelch', this.core.position, 1);
      if (this.coreHp <= 0) this.die(info);
    } else {
      g.audio.play('squelch', this.pos, 0.3);
    }
  }

  onDeath() {
    const g = this.game;
    g.audio.play('bossRoar', this.pos, 1);
    g.audio.play('screech', this.pos, 1);
    g.cam.shake(0.12, 1.5);
    for (const l of this.larvae) if (l.alive) l.die({});
    for (const t of this.tendrils) this.world.scene.remove(t.mesh, t.mark);
    this.tendrils.length = 0;
    this.coreMat.emissiveIntensity = 0;
    this.world.particles.blood(new THREE.Vector3(this.pos.x, 2, this.pos.z), new THREE.Vector3(0, 1, 0), 60, 2);
    g.setFlag('boss2_dead');
    if (this.onDefeated) this.onDefeated();
  }

  update(dt) {
    const g = this.game;
    const p = this.player;
    this.stateT += dt;
    const t = performance.now() / 1000;
    // pulsação
    const beat = this.alive ? 1 + Math.max(0, Math.sin(t * (this.exposed ? 9 : 5))) * 0.04 : 1;
    this.mass.scale.setScalar(beat);
    this.heartT -= dt;
    if (this.alive && this.heartT <= 0) {
      this.heartT = this.exposed ? 0.8 : 1.4;
      g.audio.play('heartbeatBoss', { x: this.pos.x, y: 3, z: this.pos.z }, 0.7);
    }
    for (const n of this.nodes) if (n.alive) n.mesh.scale.setScalar(1 + Math.sin(t * 6 + n.mesh.position.x) * 0.12);
    // pétalas
    const open = this.exposed || !this.alive ? 1 : 0;
    this.petalOpen = damp(this.petalOpen || 0, open, 3, dt);
    for (const pet of this.petals) pet.rotation.x = -this.petalOpen * 1.2;
    this.coreMat.emissiveIntensity = this.alive ? (this.exposed ? 2.2 : 0.4) * (0.8 + Math.sin(t * 9) * 0.2) : 0;
    this.updateTendrils(dt);
    this.updateProjectiles(dt);
    if (!this.alive) {
      this.mass.position.y = Math.max(1.2, this.mass.position.y - dt * 0.6);
      return;
    }
    if (this.state === 'intro') {
      if (this.stateT > 0.3 && !this.roared) {
        this.roared = true;
        g.audio.play('bossRoar', this.pos, 0.9);
        g.cam.shake(0.05, 1);
      }
      if (this.stateT > 2.5) this.setState('fight');
      return;
    }
    if (p.dead) return;
    this.attackT -= dt;
    if (this.attackT <= 0) {
      const r = Math.random();
      if (r < 0.55) this.spawnTendril(p.pos.x + p.vel.x * 0.5, p.pos.z + p.vel.z * 0.5);
      else this.spit();
      if (this.exposed && chance(0.5)) setTimeout(() => this.alive && this.spawnTendril(p.pos.x + rand(-1.5, 1.5), p.pos.z + rand(-1.5, 1.5)), 400);
      this.attackT = this.exposed ? rand(1.2, 1.9) : rand(2.0, 3.0);
    }
    this.spawnT -= dt;
    this.larvae = this.larvae.filter((l) => l.alive);
    if (this.spawnT <= 0 && this.larvae.length < 2) {
      this.spawnT = rand(14, 20);
      const a = rand(0, Math.PI * 2);
      const l = this.world.spawnEnemy({
        type: 'larva',
        id: 'larva' + Math.floor(Math.random() * 1e6),
        x: this.pos.x + Math.cos(a) * 2.2,
        z: this.pos.z + Math.sin(a) * 2.2,
        state: 'emerge',
        y: 2.6,
        hp: 18,
        persist: false,
        scale: 0.65,
      });
      if (l) this.larvae.push(l);
      g.audio.play('squelch', this.pos, 1);
    }
  }

  spawnTendril(x, z) {
    const g = this.game;
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.3, 24), new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(x, 0.03, z);
    this.world.scene.add(mark);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 1, 8), charMat(0x6a2a24, 0.35, { tex: 'flesh' }));
    mesh.visible = false;
    mesh.castShadow = true;
    this.world.scene.add(mesh);
    this.tendrils.push({ x, z, t: 0, mark, mesh, hit: false });
    g.audio.play('squelch', { x, y: 1, z }, 0.5);
  }

  updateTendrils(dt) {
    const g = this.game;
    const top = new THREE.Vector3(this.pos.x, this.mass.position.y, this.pos.z);
    for (let i = this.tendrils.length - 1; i >= 0; i--) {
      const td = this.tendrils[i];
      td.t += dt;
      const warn = 1.05;
      td.mark.material.opacity = td.t < warn ? 0.3 + Math.sin(td.t * 25) * 0.25 : Math.max(0, 0.6 - (td.t - warn) * 2);
      if (td.t >= warn) {
        const k = Math.min(1, (td.t - warn) / 0.12);
        const end = new THREE.Vector3(td.x, 0, td.z);
        const cur = top.clone().lerp(end, k);
        const mid = top.clone().add(cur).multiplyScalar(0.5);
        const len = top.distanceTo(cur);
        td.mesh.visible = true;
        td.mesh.position.copy(mid);
        td.mesh.scale.set(1, Math.max(0.01, len), 1);
        td.mesh.lookAt(cur);
        td.mesh.rotateX(Math.PI / 2);
        if (k >= 1 && !td.hit) {
          td.hit = true;
          g.audio.play('slam', end, 0.7);
          g.cam.shake(0.05, 0.3);
          this.world.particles.dust(new THREE.Vector3(td.x, 0.1, td.z), 12);
          this.world.decals.add(td.x, td.z, 1.2, 1);
          const p = this.player;
          if (Math.hypot(p.pos.x - td.x, p.pos.z - td.z) < 1.35) p.takeDamage(22, { x: td.x, z: td.z }, { knock: true, invuln: 0.8 });
        }
      }
      if (td.t > warn + 1.0) {
        this.world.scene.remove(td.mark, td.mesh);
        td.mark.geometry.dispose();
        td.mesh.geometry.dispose();
        this.tendrils.splice(i, 1);
      }
    }
  }

  spit() {
    const g = this.game;
    const p = this.player;
    const from = new THREE.Vector3(this.pos.x, this.mass.position.y - 0.5, this.pos.z);
    const to = new THREE.Vector3(p.pos.x + p.vel.x * 0.8, 0, p.pos.z + p.vel.z * 0.8);
    const T = 1.1;
    const vel = new THREE.Vector3((to.x - from.x) / T, (to.y - from.y + 0.5 * 9.8 * T * T) / T, (to.z - from.z) / T);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ color: 0x405010, emissive: 0x80a010, emissiveIntensity: 1.2 }));
    m.position.copy(from);
    this.world.scene.add(m);
    this.projectiles.push({ m, vel, t: 0 });
    g.audio.play('spit', from);
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.t += dt;
      pr.vel.y -= 9.8 * dt;
      pr.m.position.addScaledVector(pr.vel, dt);
      if (pr.m.position.y <= 0.05) {
        const x = pr.m.position.x;
        const z = pr.m.position.z;
        this.world.addAcid(x, z, 1.5, 4.5, 12);
        this.world.particles.acid(new THREE.Vector3(x, 0.1, z), 14);
        this.game.audio.play('sizzle', { x, y: 0.2, z });
        this.world.scene.remove(pr.m);
        pr.m.geometry.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  dispose() {
    this.world.scene.remove(this.root);
    for (const n of this.nodes) this.world.scene.remove(n.mesh, n.tube);
  }
}

// ===========================================================================
// O CERVO PÁLIDO — espécime CR-III solto na mata. Cego: caça pelo som.
// Correr e atirar o atraem; batendo em árvores ou rochas, fica atordoado.
export class Cervo extends Enemy {
  constructor(world, def) {
    super(world, def);
    const skin = charMat(0xd8d4c8, 0.45, { tex: 'paleskin' });
    const sacMat = new THREE.MeshStandardMaterial({ color: 0x203040, emissive: 0x9fd8ff, emissiveIntensity: 1.4, roughness: 0.2 });
    this.sacMat = sacMat;
    this.sacs = [];
    const rig = buildQuadruped({
      length: 2.5,
      legLen: 1.65,
      bodyR: 0.45,
      bodyH: 1.15,
      neckLen: 0.95,
      neckR: 0.17,
      headLen: 0.62,
      headR: 0.14,
      legR: 0.085,
      hipW: 0.3,
      mat: skin,
      tail: false,
      extras: (r) => {
        // chifres como raízes ramificadas
        const boneMat = charMat(0x4a3a2a, 0.8, { tex: 'bark' });
        const branch = (parent, len, rad, depth, rot) => {
          const g = new THREE.Group();
          g.rotation.set(rot.x, rot.y, rot.z);
          parent.add(g);
          const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.6, rad, len, 6), boneMat);
          m.position.y = len / 2;
          m.castShadow = true;
          g.add(m);
          if (depth > 0) {
            const tip = new THREE.Group();
            tip.position.y = len;
            g.add(tip);
            const n = depth > 1 ? 3 : 2;
            for (let i = 0; i < n; i++) branch(tip, len * rand(0.55, 0.8), rad * 0.65, depth - 1, { x: rand(-0.7, 0.7), y: rand(-1, 1), z: rand(-0.8, 0.8) });
          }
        };
        for (const sx of [-1, 1]) {
          const base = new THREE.Group();
          base.position.set(sx * 0.1, 0.1, 0.1);
          r.head.add(base);
          branch(base, 0.55, 0.05, 3, { x: -0.5, y: 0, z: sx * -0.7 });
        }
        // sacos luminosos: garganta e flancos
        const throat = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), sacMat);
        throat.position.set(0, 0.0, 0.55);
        r.neck.add(throat);
        this.sacs.push({ m: throat, mult: 2.8 });
        for (const sx of [-1, 1]) {
          const fl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), sacMat);
          fl.position.set(sx * 0.42, -0.05, -0.2);
          fl.scale.set(0.6, 1, 1.2);
          r.body.add(fl);
          this.sacs.push({ m: fl, mult: 2.0 });
        }
        // costelas salientes
        const rib = charMat(0xe8e0cc, 0.5);
        for (let i = 0; i < 6; i++) {
          for (const sx of [-1, 1]) {
            const rb = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.4, 3, 6), rib);
            rb.position.set(sx * 0.42, 0.1, -0.5 + i * 0.16);
            rb.rotation.z = sx * 0.4;
            r.body.add(rb);
          }
        }
      },
    });
    this.rig = rig;
    this.attachModel(rig.root);
    this.maxHp = this.hp = 950 * this.game.diff.enemyHp;
    this.radius = 1.0;
    this.state = 'intro';
    this.hearing = 1;
    this.isBoss = true;
    this.name = 'O Cervo Pálido';
    this.phase = 0;
    this.clickT = 2;
    this.target = null;
    this.bloodScale = 1.4;
    this.radio = 0;
    this.home = { x: def.x, z: def.z };
  }

  hitSpheres() {
    const r = this.rig;
    const out = this.sacs.map((s) => {
      V.set(0, 0, 0);
      s.m.localToWorld(V);
      return { c: V.clone(), r: 0.24, zone: 'weak', mult: s.mult };
    });
    out.push(this.sph(r.head, 0, 0, 0.3, 0.28, 'head', 0.5));
    out.push(this.sph(r.body, 0, 0, 0.5, 0.55, 'body', 0.6));
    out.push(this.sph(r.body, 0, 0, -0.5, 0.55, 'body', 0.6));
    out.push(this.sph(r.neck, 0, 0.3, 0.3, 0.25, 'body', 0.6));
    return out;
  }

  modifyDamage(dmg) {
    if (this.state === 'intro') return 0;
    return this.state === 'stunned' ? dmg * 1.5 : dmg;
  }

  onNoise(x, z, kind, d) {
    if (!this.alive || this.state === 'intro') return;
    this.target = { x, z };
    if (['listen', 'investigate'].includes(this.state)) {
      if (kind === 'shot' || (kind === 'step' && d < 14 && this.player.speedNow > 3)) this.setState('chargeWind');
      else if (this.state === 'listen') this.setState('investigate');
    }
  }

  onHit(dmg, info) {
    if (info.zone === 'weak') this.game.audio.play('squelch', this.pos, 0.7);
  }

  onDeath() {
    const g = this.game;
    g.audio.play('bellow', this.pos, 1);
    g.cam.shake(0.1, 1.2);
    setTimeout(() => g.audio.play('slam', this.pos, 1), 900);
    this.sacMat.emissiveIntensity = 0;
    g.setFlag('boss3_dead');
    if (this.onDefeated) this.onDefeated();
  }

  update(dt) {
    const g = this.game;
    const p = this.player;
    this.stateT += dt;
    if (!this.alive) {
      this.deathT += dt;
      this.animate(dt, 0);
      return;
    }
    const d = this.distToPlayer();
    let speed = 0;
    this.clickT -= dt;
    if (this.clickT <= 0) {
      this.clickT = rand(1.5, 3);
      g.audio.play('clicks', { x: this.pos.x, y: 2.5, z: this.pos.z });
    }
    // muito perto: sente o cheiro
    if (d < 2.8 && ['listen', 'investigate'].includes(this.state)) this.setState('goreWind');
    switch (this.state) {
      case 'intro':
        if (this.stateT > 0.3 && !this.roared) {
          this.roared = true;
          g.audio.play('bellow', this.pos);
          g.cam.shake(0.05, 1.5);
        }
        this.faceTo(p.pos.x, p.pos.z, dt, 2);
        if (this.stateT > 2.6) this.setState('listen');
        break;
      case 'listen':
        if (this.stateT > 4) {
          // vagueia
          const a = rand(0, Math.PI * 2);
          this.target = { x: this.home.x + Math.cos(a) * 8, z: this.home.z + Math.sin(a) * 8 };
          this.setState('investigate');
        }
        break;
      case 'investigate': {
        speed = 2.0;
        if (!this.target) {
          this.setState('listen');
          break;
        }
        const left = this.moveToward(this.target.x, this.target.z, speed, dt, 2.5);
        if (left < 1.2 || this.stateT > 7) this.setState('listen');
        break;
      }
      case 'chargeWind':
        if (this.target) this.faceTo(this.target.x, this.target.z, dt, 4);
        if (this.stateT < 0.05) g.audio.play('bellow', this.pos, 0.8);
        if (this.stateT > 0.8) {
          const tx = this.target ? this.target.x : p.pos.x;
          const tz = this.target ? this.target.z : p.pos.z;
          const a = Math.atan2(tx - this.pos.x, tz - this.pos.z);
          this.yaw = a;
          this.chargeDir = { x: Math.sin(a), z: Math.cos(a) };
          this.chargeLeft = Math.hypot(tx - this.pos.x, tz - this.pos.z) + 5;
          this.chargeHit = false;
          this.setState('charge');
        }
        break;
      case 'charge': {
        speed = 11;
        const step = speed * dt;
        const nx = this.pos.x + this.chargeDir.x * step;
        const nz = this.pos.z + this.chargeDir.z * step;
        this.chargeLeft -= step;
        if (this.world.collision.blocked(nx, nz, this.radius * 0.9)) {
          g.audio.play('slam', this.pos, 1);
          g.audio.play('branchSnap', this.pos, 1);
          g.cam.shake(0.08, 0.5);
          this.world.particles.dust(new THREE.Vector3(nx, 2, nz), 18, [0.3, 0.28, 0.2]);
          this.setState('stunned');
          break;
        }
        this.pos.x = nx;
        this.pos.z = nz;
        if (!this.chargeHit && d < 1.8) {
          this.chargeHit = true;
          p.takeDamage(32, this.pos, { knock: true, invuln: 1 });
        }
        if (Math.floor(this.stateT * 5) !== Math.floor((this.stateT - dt) * 5)) g.audio.play('gallop', this.pos);
        if (this.chargeLeft <= 0) this.setState('listen');
        break;
      }
      case 'stunned':
        if (this.stateT > 3.6) this.setState('listen');
        break;
      case 'goreWind':
        this.faceTo(p.pos.x, p.pos.z, dt, 5);
        if (this.stateT > 0.6 && !this.hitDone) {
          this.hitDone = true;
          g.audio.play('swing', this.pos, 1.3);
          if (this.distToPlayer() < 3.2 && this.faceDot(p.pos.x, p.pos.z) > 0.3) p.takeDamage(26, this.pos, { knock: true, invuln: 0.8 });
        }
        if (this.stateT > 1.3) {
          this.hitDone = false;
          if (chance(0.4)) this.setState('stompWind');
          else this.setState('listen');
        }
        break;
      case 'stompWind':
        if (this.stateT > 0.9 && !this.hitDone) {
          this.hitDone = true;
          g.audio.play('slam', this.pos, 1.3);
          g.cam.shake(0.1, 0.6);
          this.world.addRing(this.pos.x, this.pos.z, 6, 20, 8);
        }
        if (this.stateT > 1.6) {
          this.hitDone = false;
          this.setState('listen');
        }
        break;
    }
    const pulse = 1 + Math.sin(performance.now() / 200) * 0.1;
    for (const s of this.sacs) s.m.scale.setScalar(pulse * (s.mult > 2.5 ? 1 : 1));
    this.animate(dt, speed);
  }

  animate(dt, speed) {
    const r = this.rig;
    this.root.rotation.set(0, this.yaw, 0);
    const t = performance.now() / 1000;
    if (!this.alive) {
      const k = Math.min(1, this.deathT / 1.2);
      this.root.rotation.z = k * Math.PI * 0.45;
      this.root.position.y = 0.4 * k;
      return;
    }
    this.phase += (Math.min(speed, 8) / 3) * Math.PI * 2 * dt;
    quadGait(r, this.phase, clamp(speed / 2.5, 0.05, 1), speed > 5 ? 1 : 0);
    r.neck.rotation.x = 0;
    r.head.rotation.set(0, 0, 0);
    if (this.state === 'listen' || this.state === 'intro') {
      r.head.rotation.z = Math.sin(t * 1.3) * 0.35;
      r.head.rotation.y = Math.sin(t * 0.7) * 0.4;
      r.neck.rotation.x = -0.2;
    }
    if (this.state === 'charge' || this.state === 'chargeWind') r.neck.rotation.x = 0.8;
    if (this.state === 'chargeWind') r.legs[0].hip.rotation.x = Math.sin(t * 20) * 0.5;
    if (this.state === 'stunned') {
      r.neck.rotation.x = 1.0;
      r.head.rotation.z = Math.sin(t * 4) * 0.3;
      r.body.rotation.z = Math.sin(t * 2) * 0.05;
    }
    if (this.state === 'goreWind') {
      const k = Math.min(1, this.stateT / 0.6);
      r.neck.rotation.x = this.stateT < 0.6 ? -0.5 * k : 1.0;
      r.neck.rotation.y = this.stateT < 0.6 ? 0.5 * k : -0.6;
    }
    if (this.state === 'stompWind') {
      const k = this.stateT < 0.9 ? Math.min(1, this.stateT / 0.6) : Math.max(0, 1 - (this.stateT - 0.9) / 0.2);
      r.body.rotation.x = -k * 0.6;
      r.body.position.y = r.legLen + k * 0.6;
      for (const l of r.legs) if (l.front) l.hip.rotation.x = -k * 1.2;
    }
  }
}

// larva da Ninhada = rastejante pequeno
export class Larva extends Rastejante {
  constructor(world, def) {
    super(world, def);
    this.root.scale.setScalar(def.scale || 0.65);
    this.radius = 0.28;
    this.speed = 4.2;
  }
}
