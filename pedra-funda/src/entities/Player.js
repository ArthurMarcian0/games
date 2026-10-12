// Personagem jogável: movimento com stamina, mira, recuo, armas, interação,
// agarrões, quedas, ferimentos e morte.
import * as THREE from 'three';
import { buildHumanoid, resetPose, gait, buildWeapon, buildFlashlightModel } from './Rig.js';
import { charMat } from '../engine/materials.js';
import { clamp, damp, dampAngle, lerp, rand } from '../core/utils.js';
import { WEAPONS, ITEMS } from '../game/Items.js';

const WALK = 2.25;
const RUN = 4.7;
const AIM_WALK = 1.15;

export class Player {
  constructor(game) {
    this.game = game;
    const leather = charMat(0x4a3424, 0.6, { tex: 'fabric' });
    this.rig = buildHumanoid({
      height: 1.8,
      skin: 0xc49a7e,
      jacketMat: leather,
      pants: 0x2a303c,
      shoes: 0x16120e,
      hair: 0x261b14,
      beard: 0x2a1f17,
    });
    this.root = this.rig.root;
    this.pos = this.root.position;
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.weaponModels = {};
    for (const w of ['pistol', 'shotgun', 'pipe']) {
      const m = buildWeapon(w);
      m.rotation.x = Math.PI / 2;
      m.position.set(0, -0.09, 0.02);
      m.visible = false;
      this.rig.rHand.add(m);
      this.weaponModels[w] = m;
    }
    const fl = buildFlashlightModel();
    fl.position.set(0.12, 0.08, 0.16);
    this.rig.chest.add(fl);
    this.flModel = fl;

    this.flashlight = new THREE.SpotLight(0xfff0d8, 55, 30, 0.48, 0.5, 1.5);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.bias = -0.0004;
    this.flashlight.shadow.normalBias = 0.02;
    this.flashlight.shadow.camera.near = 0.2;
    this.flashlight.shadow.camera.far = 30;
    this.flashTarget = new THREE.Object3D();
    this.flashlight.target = this.flashTarget;
    this.fill = new THREE.PointLight(0xd8e0ff, 1.6, 6, 2);
    this.muzzleLight = new THREE.PointLight(0xffb060, 0, 9, 2);
    this.muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd090, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.muzzleFlash.scale.setScalar(0.35);
    this.reset();
  }

  reset() {
    this.hp = 100;
    this.stamina = 100;
    this.exhausted = false;
    this.aiming = false;
    this.fireCd = 0;
    this.reloadT = 0;
    this.reloading = false;
    this.meleeT = 0;
    this.meleeHit = false;
    this.hurtT = 0;
    this.knockT = 0;
    this.invuln = 0;
    this.grabbedBy = null;
    this.struggle = 0;
    this.dead = false;
    this.deathT = 0;
    this.phase = 0;
    this.lastStep = 0;
    this.spread = 0.05;
    this.flashOn = true;
    this.speedNow = 0;
    this.runHold = 0;
    this.pumpT = 0;
    this.locked = false;
    this.healAnim = 0;
    this.flashT = 0;
    this.vel.set(0, 0, 0);
    this.root.rotation.set(0, this.yaw, 0);
    resetPose(this.rig);
  }

  attach(scene) {
    scene.add(this.root, this.flashlight, this.flashTarget, this.fill, this.muzzleLight, this.muzzleFlash);
    this.flashlight.shadow.mapSize.set(this.game.renderer.shadowSize, this.game.renderer.shadowSize);
    if (this.flashlight.shadow.map) {
      this.flashlight.shadow.map.dispose();
      this.flashlight.shadow.map = null;
    }
  }

  get equipped() {
    return this.game.state.equipped;
  }

  setPos(x, z, ry) {
    this.pos.set(x, 0, z);
    this.yaw = ry;
    this.root.rotation.set(0, ry, 0);
    this.vel.set(0, 0, 0);
  }

  equip(id) {
    const st = this.game.state;
    if (id && !this.game.inv.has(id)) return;
    if (st.equipped === id) return;
    st.equipped = id;
    this.reloading = false;
    this.reloadT = 0;
    this.game.audio.play('reload', this.pos, 0.4);
    this.game.hud.flashWeapon();
  }

  validateEquip() {
    const st = this.game.state;
    if (st.equipped && !this.game.inv.has(st.equipped)) st.equipped = this.game.inv.weapons()[0] || null;
  }

  cycleWeapon(i) {
    const order = ['pistol', 'shotgun', 'pipe'];
    const id = order[i];
    if (this.game.inv.has(id)) this.equip(id);
  }

  // ------------------------------------------------------------- update
  update(dt, input) {
    const g = this.game;
    const world = g.world;
    const cam = g.cam;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.healAnim = Math.max(0, this.healAnim - dt);
    this.validateEquip();

    if (this.dead) {
      this.deathT += dt;
      this.animate(dt);
      this.updateLights(dt);
      return;
    }

    let ix = 0;
    let iy = 0;
    const canAct = !this.locked && !this.grabbedBy && this.knockT <= 0;
    if (canAct) {
      ix = (input.is('right') ? 1 : 0) - (input.is('left') ? 1 : 0);
      iy = (input.is('forward') ? 1 : 0) - (input.is('back') ? 1 : 0);
    }
    if (this.knockT > 0) this.knockT -= dt;

    // agarrado: precisa se debater
    if (this.grabbedBy) {
      if (input.hit('struggle') || input.mbHit[0] || input.hit('forward') || input.hit('back') || input.hit('left') || input.hit('right')) {
        this.struggle += 1;
        cam.shake(0.03, 0.1);
      }
      this.struggle = Math.max(0, this.struggle - dt * 1.2);
      if (this.struggle >= g.diff.struggle) this.breakFree();
      g.hud.setStruggle(this.struggle / g.diff.struggle);
    }

    const weapon = this.equipped ? WEAPONS[this.equipped] : null;
    const wantAim = canAct && (input.mb[2] || input.is('aim')) && !!weapon && !weapon.melee;
    this.aiming = wantAim && this.meleeT <= 0;

    // movimento relativo à câmera
    const fy = Math.sin(cam.yaw);
    const fz = Math.cos(cam.yaw);
    const rx = -Math.cos(cam.yaw);
    const rz = Math.sin(cam.yaw);
    let mx = fy * iy + rx * ix;
    let mz = fz * iy + rz * ix;
    const ml = Math.hypot(mx, mz);
    if (ml > 0) {
      mx /= ml;
      mz /= ml;
    }
    const moving = ml > 0;
    const lowHp = this.hp < 30;
    const wantRun = canAct && input.is('run') && moving && !this.aiming && !this.exhausted && this.meleeT <= 0;
    let speed = moving ? (wantRun ? RUN : WALK) : 0;
    if (this.aiming) speed = moving ? AIM_WALK : 0;
    if (lowHp) speed *= 0.8;
    if (this.reloading && !wantRun) speed *= 0.75;
    if (this.meleeT > 0) speed *= 0.3;
    if (this.healAnim > 0) speed *= 0.5;
    // stamina
    if (wantRun) {
      this.stamina -= dt * 17;
      this.runHold = 0;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.exhausted = true;
        g.audio.play('hurt', null, 0.25);
      }
    } else {
      this.runHold += dt;
      if (this.runHold > 0.7) this.stamina = Math.min(100, this.stamina + dt * (this.exhausted ? 11 : 16));
      if (this.exhausted && this.stamina > 35) this.exhausted = false;
    }
    const targetVx = mx * speed;
    const targetVz = mz * speed;
    const acc = moving ? 12 : 14;
    this.vel.x = damp(this.vel.x, targetVx, acc, dt);
    this.vel.z = damp(this.vel.z, targetVz, acc, dt);
    if (this.knockT > 0 && this.knockPush) {
      this.vel.x = this.knockPush.x * Math.max(0, this.knockT - 1.0) * 4;
      this.vel.z = this.knockPush.z * Math.max(0, this.knockT - 1.0) * 4;
    }
    if (this.grabbedBy) this.vel.set(0, 0, 0);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    world.collision.resolveCircle(this.pos, 0.32);
    world.pushOutOfActors(this.pos, 0.32);
    this.speedNow = Math.hypot(this.vel.x, this.vel.z);

    // orientação
    if (this.aiming) this.yaw = dampAngle(this.yaw, cam.yaw, 18, dt);
    else if (this.grabbedBy) {
      const e = this.grabbedBy;
      this.yaw = dampAngle(this.yaw, Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z), 10, dt);
    } else if (moving && canAct) this.yaw = dampAngle(this.yaw, Math.atan2(mx, mz), 11, dt);
    this.root.rotation.y = this.yaw;

    // passos
    const stride = wantRun ? 2.4 : 1.5;
    this.phase += (this.speedNow / stride) * Math.PI * 2 * dt;
    const stepIdx = Math.floor(this.phase / Math.PI);
    if (stepIdx !== this.lastStep && this.speedNow > 0.4) {
      this.lastStep = stepIdx;
      const surf = world.surfaceAt(this.pos.x, this.pos.z);
      g.audio.footstep(surf, { x: this.pos.x, y: 0.1, z: this.pos.z }, wantRun, 0.8);
      world.emitNoise(this.pos.x, this.pos.z, wantRun ? 10 : 3.5, 'step');
    }

    if (canAct) {
      if (input.hit('quickturn') && !this.aiming) {
        cam.quickTurn();
        this.yaw += Math.PI;
      }
      if (input.hit('flashlight')) {
        this.flashOn = !this.flashOn;
        g.audio.play('breaker', null, 0.5);
      }
      if (input.hit('w1')) this.cycleWeapon(0);
      if (input.hit('w2')) this.cycleWeapon(1);
      if (input.hit('w3')) this.cycleWeapon(2);
      if (input.hit('reload')) this.startReload();
      if (input.hit('heal')) g.quickHeal();
      const fire = input.mbHit[0] || input.hit('fire');
      if (fire && weapon) {
        if (weapon.melee) this.melee();
        else if (this.aiming) this.fire();
      }
      if (input.hit('interact')) world.interact();
    }

    // recarga
    if (this.reloading) this.updateReload(dt);
    // corpo a corpo
    if (this.meleeT > 0) {
      this.meleeT -= dt;
      if (!this.meleeHit && this.meleeT < 0.42) {
        this.meleeHit = true;
        this.meleeStrike();
      }
    }
    if (this.pumpT > 0) {
      this.pumpT -= dt;
      if (this.pumpT <= 0) g.audio.play('pump', this.pos);
    }
    // a mira se estabiliza com o tempo parado
    if (weapon && !weapon.melee) {
      const target = this.aiming ? (this.speedNow > 0.3 ? weapon.spreadMax : weapon.spreadMin) : weapon.spreadMax;
      this.spread = damp(this.spread, target, this.aiming ? 2.5 : 6, dt);
      this.spread += Math.abs(g.input.mdx) * 0.00005;
      this.spread = clamp(this.spread, weapon.spreadMin, weapon.spreadMax * 2.5);
    }

    this.animate(dt);
    this.updateLights(dt);
    g.audio.breathLevel = clamp((100 - this.stamina) / 100 + (this.hp < 40 ? 0.3 : 0) + g.fear * 0.3, 0, 1);
    g.audio.heartLevel = this.hp < 30 ? 1 - this.hp / 30 : 0;
  }

  // ------------------------------------------------------------- armas
  fire() {
    const g = this.game;
    const id = this.equipped;
    const w = WEAPONS[id];
    const st = g.state.weapons[id];
    if (this.fireCd > 0 || this.reloading && !w.perShell) return;
    if (this.reloading) this.reloading = false;
    if (st.mag <= 0) {
      g.audio.play('empty', this.pos);
      this.fireCd = 0.25;
      if (g.inv.ammoFor(id) > 0) this.startReload();
      else g.hud.message('Sem munição.');
      return;
    }
    st.mag--;
    this.fireCd = w.rate;
    const ray = g.cam.aimRay();
    const chest = new THREE.Vector3(this.pos.x, 1.4, this.pos.z);
    const t0 = Math.max(0, chest.clone().sub(ray.origin).dot(ray.dir));
    const origin = ray.origin.clone().addScaledVector(ray.dir, t0);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(ray.dir, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, ray.dir).normalize();
    const hitsByEnemy = new Map();
    for (let p = 0; p < w.pellets; p++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.spread;
      const dir = ray.dir.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(realUp, Math.sin(a) * r).normalize();
      const hit = g.world.shoot(origin, dir, w.range);
      if (!hit) continue;
      if (hit.enemy) {
        let dmg = w.damage * hit.mult;
        if (w.pellets > 1) dmg *= clamp(1 - (hit.dist - 3) / 14, 0.15, 1);
        const key = hit.enemy.id + '|' + (hit.sid || '');
        const prev = hitsByEnemy.get(key) || { dmg: 0, hit, enemy: hit.enemy };
        prev.dmg += dmg;
        if (hit.zone === 'head' || hit.zone === 'weak') prev.hit = hit;
        hitsByEnemy.set(key, prev);
        g.world.particles.blood(hit.point, dir, w.pellets > 1 ? 4 : 10, hit.enemy.bloodScale || 1);
      } else if (hit.barrel) {
        hit.barrel.explode();
      } else {
        g.world.particles.dust(hit.point, 4);
        g.world.particles.sparks(hit.point, 3);
        if (p === 0) g.audio.play('hitWall', hit.point, 0.6);
      }
    }
    for (const info of hitsByEnemy.values()) {
      info.enemy.takeDamage(info.dmg, { zone: info.hit.zone, sid: info.hit.sid, dir: ray.dir, point: info.hit.point, weapon: id, stagger: w.stagger, from: this.pos });
      g.audio.play('hitFlesh', info.hit.point, 0.7);
    }
    this.spread = Math.min(this.spread + w.recoil * 0.8, w.spreadMax * 2.5);
    g.cam.recoil(w.recoil);
    g.cam.shake(id === 'shotgun' ? 0.05 : 0.02, 0.12);
    this.flashT = 0.06;
    g.audio.play(w.sound, { x: this.pos.x, y: 1.4, z: this.pos.z });
    g.world.emitNoise(this.pos.x, this.pos.z, w.noise, 'shot');
    if (id === 'shotgun') this.pumpT = 0.38;
    g.stats.shots++;
    g.hud.updateWeapon();
  }

  startReload() {
    const g = this.game;
    const id = this.equipped;
    const w = WEAPONS[id];
    if (!w || w.melee || this.reloading) return;
    const st = g.state.weapons[id];
    if (st.mag >= w.mag) return;
    if (g.inv.ammoFor(id) <= 0) {
      g.hud.message('Sem munição para recarregar.');
      return;
    }
    this.reloading = true;
    this.reloadT = w.reload;
    g.audio.play(w.perShell ? 'shell' : 'reload', this.pos);
  }

  updateReload(dt) {
    const g = this.game;
    const id = this.equipped;
    const w = WEAPONS[id];
    if (!w || w.melee) {
      this.reloading = false;
      return;
    }
    this.reloadT -= dt;
    if (this.reloadT > 0) return;
    const st = g.state.weapons[id];
    if (w.perShell) {
      if (g.inv.remove(w.ammo, 1)) st.mag++;
      if (st.mag < w.mag && g.inv.ammoFor(id) > 0) {
        this.reloadT = w.reload;
        g.audio.play('shell', this.pos);
      } else {
        this.reloading = false;
        g.audio.play('pump', this.pos);
      }
    } else {
      const need = w.mag - st.mag;
      const got = g.inv.remove(w.ammo, need);
      st.mag += got;
      this.reloading = false;
    }
    g.hud.updateWeapon();
  }

  melee() {
    if (this.meleeT > 0 || this.fireCd > 0) return;
    this.meleeT = 0.7;
    this.fireCd = WEAPONS.pipe.rate;
    this.meleeHit = false;
    this.game.audio.play('swing', this.pos);
  }

  meleeStrike() {
    const g = this.game;
    const w = WEAPONS.pipe;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    let hitAny = false;
    for (const e of g.world.enemies) {
      if (!e.alive || e.untargetable) continue;
      const dx = e.pos.x - this.pos.x;
      const dz = e.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) - (e.radius || 0.35);
      if (d > w.range) continue;
      const dot = (dx * fx + dz * fz) / Math.max(0.01, Math.hypot(dx, dz));
      if (dot < 0.4) continue;
      const point = new THREE.Vector3(e.pos.x, 1.3, e.pos.z);
      e.takeDamage(w.damage, { zone: 'body', dir: new THREE.Vector3(fx, 0, fz), point, weapon: 'pipe', stagger: w.stagger, from: this.pos });
      g.world.particles.blood(point, new THREE.Vector3(fx, 0, fz), 8);
      hitAny = true;
    }
    if (hitAny) {
      g.audio.play('pipeHit', this.pos);
      g.cam.shake(0.03, 0.1);
      const st = g.state.weapons.pipe;
      st.dur--;
      if (st.dur <= 0) {
        g.inv.remove('pipe', 1);
        st.dur = WEAPONS.pipe.durability;
        g.audio.play('pipeBreak', this.pos);
        g.hud.message('O cano entortou e quebrou.');
        this.validateEquip();
      }
      g.hud.updateWeapon();
    }
    g.world.emitNoise(this.pos.x, this.pos.z, w.noise, 'melee');
  }

  // ------------------------------------------------------------- dano
  takeDamage(amount, from, opts = {}) {
    const g = this.game;
    if (this.dead || this.invuln > 0 || g.cutsceneLock) return false;
    amount *= g.diff.dmgTaken;
    this.hp -= amount;
    this.hurtT = 0.35;
    this.invuln = opts.invuln ?? 0.5;
    g.fx.damage = Math.min(1.2, g.fx.damage + 0.5 + amount / 60);
    g.audio.play('hurt');
    g.cam.shake(0.04 + amount / 400, 0.25);
    g.world.particles.blood(new THREE.Vector3(this.pos.x, 1.3, this.pos.z), new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)), 8);
    if (opts.knock && from) {
      const dx = this.pos.x - from.x;
      const dz = this.pos.z - from.z;
      const d = Math.max(0.01, Math.hypot(dx, dz));
      this.knockPush = { x: dx / d, z: dz / d };
      this.knockT = 1.6;
      this.reloading = false;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
    g.hud.updateHealth();
    return true;
  }

  startGrab(enemy) {
    if (this.grabbedBy || this.dead || this.invuln > 0 || this.knockT > 0) return false;
    this.grabbedBy = enemy;
    this.struggle = 0;
    this.reloading = false;
    this.game.hud.setStruggle(0, true);
    return true;
  }

  breakFree() {
    const e = this.grabbedBy;
    this.grabbedBy = null;
    this.struggle = 0;
    this.invuln = 1.0;
    this.game.hud.setStruggle(0, false);
    if (e && e.onReleased) e.onReleased(true);
  }

  releaseGrab() {
    this.grabbedBy = null;
    this.game.hud.setStruggle(0, false);
  }

  heal(amount) {
    this.hp = Math.min(100, this.hp + amount);
    this.healAnim = 0.8;
    this.game.hud.updateHealth();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathT = 0;
    if (this.grabbedBy) this.releaseGrab();
    this.game.audio.play('death');
    this.game.onPlayerDeath();
  }

  // ------------------------------------------------------------- visual
  updateLights(dt) {
    const g = this.game;
    const cam = g.cam;
    const chest = new THREE.Vector3();
    this.flModel.getWorldPosition(chest);
    this.flashlight.position.copy(chest);
    const ray = cam.aimRay();
    const target = ray.origin.clone().addScaledVector(ray.dir, 14);
    this.flashTarget.position.lerp(target, Math.min(1, dt * 14));
    // pequenas falhas da lanterna quando ferido
    let fl = this.flashOn ? 1 : 0;
    if (this.flashOn && this.hp < 30 && Math.random() < 0.02) fl = 0.2;
    this.flashlight.intensity = 55 * fl;
    this.flModel.userData.lens.visible = this.flashOn;
    // luz suave vinda da câmera: o personagem nunca vira uma silhueta total
    const cp = cam.camera.position;
    this.fill.position.set(cp.x, cp.y + 0.4, cp.z);
    this.fill.intensity = this.flashOn ? 1.6 : 0.7;
    // clarão do disparo
    this.flashT -= dt;
    const m = this.weaponModels[this.equipped];
    if (this.flashT > 0 && m && m.userData.muzzle) {
      const mp = m.localToWorld(m.userData.muzzle.clone());
      this.muzzleLight.position.copy(mp);
      this.muzzleLight.intensity = 25;
      this.muzzleFlash.position.copy(mp);
      this.muzzleFlash.material.opacity = 1;
      this.muzzleFlash.material.rotation = Math.random() * 6;
      this.muzzleFlash.scale.setScalar(this.equipped === 'shotgun' ? 0.6 : 0.35);
    } else {
      this.muzzleLight.intensity = 0;
      this.muzzleFlash.material.opacity = 0;
    }
  }

  animate(dt) {
    const r = this.rig;
    resetPose(r);
    for (const [k, m] of Object.entries(this.weaponModels)) m.visible = k === this.equipped;
    if (this.dead) {
      const k = Math.min(1, this.deathT / 0.8);
      this.root.rotation.x = -k * k * (Math.PI / 2) * 0.98;
      this.root.position.y = 0;
      r.hips.position.y = r.s * 0.92 - k * 0.6;
      r.lSh.rotation.x = -k * 2.5;
      r.rSh.rotation.x = -k * 2.2;
      r.lKnee.rotation.x = k * 0.4;
      return;
    }
    this.root.rotation.x = 0;
    if (this.knockT > 0) {
      // caído e levantando
      const t = this.knockT;
      const down = t > 0.6 ? Math.min(1, (1.6 - t) / 0.25) : t / 0.6;
      this.root.rotation.x = down * 1.35;
      r.hips.position.y = r.s * 0.92 - down * 0.55;
      r.lSh.rotation.x = -down * 1.2;
      r.rSh.rotation.x = -down * 1.2;
      r.lKnee.rotation.x = down * 1.2;
      r.rKnee.rotation.x = down * 0.6;
      return;
    }
    const run = this.speedNow > 3.2 ? 1 : 0;
    const amt = clamp(this.speedNow / 2.2, 0, 1);
    gait(r, this.phase, amt, run, { drop: this.hp < 30 ? -0.03 : 0 });
    // respiração parada
    const t = performance.now() / 1000;
    r.chest.rotation.x = Math.sin(t * 1.6) * 0.02 * (1 + (100 - this.stamina) / 50);
    r.head.rotation.x = 0;
    const camPitch = this.game.cam.pitch;
    const id = this.equipped;
    if (this.grabbedBy) {
      r.lSh.rotation.x = -1.3 + Math.sin(t * 25) * 0.1;
      r.rSh.rotation.x = -1.4 + Math.cos(t * 23) * 0.1;
      r.lEl.rotation.x = -0.6;
      r.rEl.rotation.x = -0.6;
      r.spine.rotation.x = -0.2;
      return;
    }
    if (this.aiming && id) {
      const p = -Math.PI / 2 - camPitch;
      r.head.rotation.x = -camPitch * 0.6;
      if (id === 'shotgun') {
        r.rSh.rotation.x = p + 0.25;
        r.rSh.rotation.z = 0.15;
        r.rEl.rotation.x = -0.55;
        r.lSh.rotation.x = p + 0.05;
        r.lSh.rotation.z = -0.35;
        r.lEl.rotation.x = -0.5;
        r.spine.rotation.y = 0.35;
        r.chest.rotation.y = -0.35;
      } else {
        r.rSh.rotation.x = p;
        r.rSh.rotation.z = 0.12;
        r.lSh.rotation.x = p + 0.1;
        r.lSh.rotation.z = -0.5;
        r.lEl.rotation.x = -0.35;
      }
      if (this.flashT > 0) {
        r.rSh.rotation.x -= 0.15;
        r.rEl.rotation.x -= 0.2;
      }
    } else if (this.meleeT > 0) {
      const k = 1 - this.meleeT / 0.7;
      const sw = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
      r.rSh.rotation.x = lerp(-0.3, -2.7, k < 0.35 ? sw : 0) + (k >= 0.35 ? lerp(-2.7, -0.4, (k - 0.35) / 0.65) + 0.3 : 0);
      if (k >= 0.35) r.rSh.rotation.x = lerp(-2.6, -0.5, Math.min(1, (k - 0.35) / 0.3));
      r.rSh.rotation.z = 0.3;
      r.rEl.rotation.x = -0.4;
      r.spine.rotation.y = k < 0.35 ? 0.4 * sw : lerp(0.4, -0.4, Math.min(1, (k - 0.35) / 0.3));
    } else if (this.reloading) {
      r.rSh.rotation.x = -0.9;
      r.rEl.rotation.x = -0.8;
      r.lSh.rotation.x = -0.9;
      r.lSh.rotation.z = -0.4;
      r.lEl.rotation.x = -1.0 + Math.sin(t * 10) * 0.1;
    } else if (id === 'shotgun') {
      r.rSh.rotation.x = -0.35;
      r.rEl.rotation.x = -0.7;
      r.lSh.rotation.x = -0.6;
      r.lSh.rotation.z = -0.3;
      r.lEl.rotation.x = -1.0;
    } else if (id === 'pipe') {
      r.rEl.rotation.x = -0.5;
    }
    if (this.healAnim > 0) {
      r.lSh.rotation.x = -1.2;
      r.lEl.rotation.x = -1.3;
    }
    if (this.hurtT > 0) {
      r.spine.rotation.x -= this.hurtT * 0.8;
      r.head.rotation.x -= this.hurtT * 0.6;
    }
  }
}

export { ITEMS };
