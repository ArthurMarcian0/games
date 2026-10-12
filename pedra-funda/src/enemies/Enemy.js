// Inimigos: base com percepção (visão e audição), navegação e dano,
// mais as criaturas comuns: Errante, Rastejante e o perseguidor Vigia.
import * as THREE from 'three';
import { buildHumanoid, buildQuadruped, resetPose, gait, quadGait } from '../entities/Rig.js';
import { charMat } from '../engine/materials.js';
import { clamp, damp, dampAngle, lerp, rand, pick, chance, wrapAngle } from '../core/utils.js';

const tmp = new THREE.Vector3();

export class Enemy {
  constructor(world, def) {
    this.world = world;
    this.game = world.game;
    this.def = def;
    this.id = def.id;
    this.alive = true;
    this.state = 'idle';
    this.stateT = 0;
    this.alert = false;
    this.radius = 0.35;
    this.path = null;
    this.pathIdx = 0;
    this.pathTimer = 0;
    this.lastKnown = null;
    this.lostT = 0;
    this.vx = 0;
    this.vz = 0;
    this.yaw = def.ry ?? rand(0, Math.PI * 2);
    this.hearing = 1;
    this.navOpts = {};
    this.deathT = 0;
    this.solid = true;
    this.radio = 1;
  }

  attachModel(root) {
    this.root = root;
    root.position.set(this.def.x, 0, this.def.z);
    root.rotation.y = this.yaw;
    this.pos = root.position;
    this.world.scene.add(root);
  }

  get player() {
    return this.game.player;
  }

  distToPlayer() {
    const p = this.player.pos;
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  faceDot(x, z) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    return (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / d;
  }

  canSee(range, fovCos = 0.3) {
    const p = this.player;
    if (p.dead) return false;
    const d = this.distToPlayer();
    let r = range * (p.flashOn ? 1.25 : 0.8);
    if (p.speedNow > 3) r *= 1.15;
    if (d > r) return false;
    if (d > 1.8 && this.faceDot(p.pos.x, p.pos.z) < fovCos) return false;
    return this.world.nav.los(this.pos.x, this.pos.z, p.pos.x, p.pos.z, { ignoreSafe: true });
  }

  hear(x, z, radius, kind) {
    if (!this.alive) return;
    const d = Math.hypot(x - this.pos.x, z - this.pos.z);
    if (d < radius * this.hearing) this.onNoise(x, z, kind, d);
  }

  onNoise(x, z) {
    this.lastKnown = { x, z };
    if (!this.alert) this.alert = true;
  }

  moveToward(tx, tz, speed, dt, turn = 8) {
    const nav = this.world.nav;
    let gx = tx;
    let gz = tz;
    const direct = nav.los(this.pos.x, this.pos.z, tx, tz, this.navOpts);
    if (!direct) {
      this.pathTimer -= dt;
      const goalMoved = !this.pathGoal || Math.hypot(this.pathGoal.x - tx, this.pathGoal.z - tz) > 1.5;
      if (!this.path || this.pathTimer <= 0 || goalMoved) {
        this.path = nav.findPath(this.pos.x, this.pos.z, tx, tz, this.navOpts);
        this.pathIdx = 0;
        this.pathTimer = 0.6 + Math.random() * 0.4;
        this.pathGoal = { x: tx, z: tz };
      }
      if (this.path && this.path.length) {
        let wp = this.path[this.pathIdx];
        while (wp && Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 0.45 && this.pathIdx < this.path.length - 1) {
          this.pathIdx++;
          wp = this.path[this.pathIdx];
        }
        if (wp) {
          gx = wp.x;
          gz = wp.z;
        }
      }
    } else this.path = null;
    const dx = gx - this.pos.x;
    const dz = gz - this.pos.z;
    const d = Math.hypot(dx, dz);
    let dirx = 0;
    let dirz = 0;
    if (d > 0.05) {
      dirx = dx / d;
      dirz = dz / d;
    }
    this.vx = damp(this.vx, dirx * speed, 8, dt);
    this.vz = damp(this.vz, dirz * speed, 8, dt);
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    this.collide();
    if (d > 0.05) this.yaw = dampAngle(this.yaw, Math.atan2(dirx, dirz), turn, dt);
    return Math.hypot(tx - this.pos.x, tz - this.pos.z);
  }

  collide() {
    this.world.collision.resolveCircle(this.pos, this.radius);
    for (const o of this.world.enemies) {
      if (o === this || !o.alive || !o.solid) continue;
      const dx = this.pos.x - o.pos.x;
      const dz = this.pos.z - o.pos.z;
      const rr = this.radius + o.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (rr - d) * 0.5;
        this.pos.x += (dx / d) * push;
        this.pos.z += (dz / d) * push;
      }
    }
    // não entra em áreas seguras
    const i = this.world.nav.idx(this.pos.x, this.pos.z);
    if (i >= 0 && this.world.nav.blocked[i] === 3 && this.prevX !== undefined) {
      this.pos.x = this.prevX;
      this.pos.z = this.prevZ;
    }
    this.prevX = this.pos.x;
    this.prevZ = this.pos.z;
  }

  faceTo(x, z, dt, rate = 8) {
    this.yaw = dampAngle(this.yaw, Math.atan2(x - this.pos.x, z - this.pos.z), rate, dt);
  }

  takeDamage(dmg, info = {}) {
    if (!this.alive) return;
    dmg = this.modifyDamage ? this.modifyDamage(dmg, info) : dmg;
    this.hp -= dmg;
    this.alert = true;
    this.lastKnown = { x: this.player.pos.x, z: this.player.pos.z };
    if (this.onHit) this.onHit(dmg, info);
    if (this.hp <= 0 && this.alive && !this.immortal) this.die(info);
  }

  die(info) {
    this.alive = false;
    this.deathT = 0;
    this.setState('dead');
    if (this.def.persist !== false) this.game.setFlag(`killed_${this.world.id}_${this.id}`);
    this.game.stats.kills++;
    if (this.player.grabbedBy === this) this.player.releaseGrab();
    if (this.onDeath) this.onDeath(info);
    this.world.onEnemyKilled(this);
  }

  sph(obj, x, y, z, r, zone, mult) {
    tmp.set(x, y, z);
    obj.localToWorld(tmp);
    return { c: tmp.clone(), r, zone, mult };
  }

  hitSpheres() {
    return [{ c: new THREE.Vector3(this.pos.x, 1, this.pos.z), r: 0.4, zone: 'body', mult: 1 }];
  }

  dispose() {
    if (this.root) this.world.scene.remove(this.root);
  }
}

// ===========================================================================
const LOOKS = [
  { shirt: 0x5a5148, pants: 0x2c2f38, hair: 0x2a2018 },
  { shirt: 0x6a3a30, pants: 0x3a3428, hair: 0x4a3a2a },
  { shirt: 0x8a8678, pants: 0x30343c, hair: 0x101010 },
  { shirt: 0x3a4a3c, pants: 0x2a2620, hair: 0x6a6058 },
  { shirt: 0xb0aca0, pants: 0x3a3a40, hair: null },
  { shirt: 0x2c3a52, pants: 0x262626, hair: 0x2a1a10 },
];

export class Errante extends Enemy {
  constructor(world, def) {
    super(world, def);
    const look = def.look || pick(LOOKS);
    const skin = charMat(def.skin ?? pick([0xb8b4a4, 0xa8aa98, 0xc0b2a0, 0x9ea294]), 0.75, { tex: 'paleskin' });
    const rig = buildHumanoid({
      height: def.height || rand(1.68, 1.86),
      head: 'infected',
      skinMat: skin,
      shirt: look.shirt,
      pants: look.pants,
      shoes: 0x14110e,
      hair: look.hair,
      bulk: rand(0.95, 1.12),
      sleeves: look.sleeves,
      jacketMat: look.jacketMat,
      extras: (r, s) => {
        // manchas de sangue nas roupas
        const bm = charMat(0x3a0806, 0.4);
        for (let i = 0; i < 3; i++) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 6, 5), bm);
          m.position.set(rand(-0.1, 0.1) * s, rand(0.1, 0.4) * s, 0.12 * s);
          m.scale.z = 0.3;
          r.spine.add(m);
        }
        if (def.hazmat) {
          const hm = charMat(0xc8c4a8, 0.8, { tex: 'fabric' });
          const hood = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 10, 8), hm);
          hood.position.y = 0.11 * s;
          hood.scale.set(1, 1.1, 1.05);
          r.head.add(hood);
          const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.08 * s, 0.02), charMat(0x101820, 0.1, { metal: 0.5 }));
          visor.position.set(0, 0.12 * s, 0.14 * s);
          r.head.add(visor);
        }
      },
    });
    this.rig = rig;
    this.attachModel(rig.root);
    this.maxHp = this.hp = (def.hp || 100) * this.game.diff.enemyHp;
    this.speed = def.speed || rand(0.75, 1.05);
    this.state = def.state || 'idle';
    this.groanT = rand(3, 10);
    this.lurchT = 0;
    this.phase = rand(0, 10);
    this.limp = rand(0, 1) < 0.5;
    this.twitchT = rand(1, 4);
    this.downDamage = 0;
    this.home = { x: def.x, z: def.z };
    this.wanderT = rand(2, 6);
    if (this.state === 'fakedead') this.hearing = 0;
    if (this.state === 'eat') this.hearing = 0.5;
  }

  hitSpheres() {
    const r = this.rig;
    if (this.state === 'fakedead' || this.state === 'dead') {
      return [this.sph(r.chest, 0, 0, 0, 0.3, 'body', 1), this.sph(r.head, 0, 0.1, 0, 0.15, 'head', 2.5)];
    }
    return [
      this.sph(r.head, 0, 0.1, 0, 0.13, 'head', 2.6),
      this.sph(r.chest, 0, 0.05, 0, 0.23, 'body', 1),
      this.sph(r.spine, 0, 0.15, 0, 0.21, 'body', 1),
      this.sph(r.lKnee, 0, -0.1, 0, 0.12, 'leg', 0.7),
      this.sph(r.rKnee, 0, -0.1, 0, 0.12, 'leg', 0.7),
      this.sph(r.lEl, 0, -0.1, 0, 0.1, 'body', 0.6),
      this.sph(r.rEl, 0, -0.1, 0, 0.1, 'body', 0.6),
    ];
  }

  onNoise(x, z, kind, d) {
    if (this.state === 'fakedead' || this.state === 'dead') return;
    this.lastKnown = { x, z };
    if (!this.alert) {
      this.alert = true;
      if (['idle', 'wander', 'eat'].includes(this.state)) this.setState('notice');
    }
  }

  onHit(dmg, info) {
    const g = this.game;
    if (this.state === 'fakedead') {
      this.setState('rising');
      return;
    }
    if (this.state === 'grab' && dmg > 8) {
      this.player.releaseGrab();
      this.setState('stagger');
      this.staggerDur = 1;
      return;
    }
    if (this.state === 'dead' || this.state === 'rising') return;
    if (info.zone === 'leg') this.downDamage += dmg;
    const close = this.distToPlayer() < 3.5;
    if ((info.weapon === 'shotgun' && close && dmg > 40) || this.downDamage > 45) {
      this.downDamage = 0;
      this.setState('down');
      g.audio.play('bodyFall', this.pos);
      return;
    }
    const p = (info.stagger || 0.3) * (dmg / 25) + (info.zone === 'head' ? 0.35 : 0);
    if (Math.random() < p && this.state !== 'down') {
      this.setState('stagger');
      this.staggerDur = 0.5 + Math.random() * 0.4;
    } else if (['idle', 'wander', 'eat', 'notice'].includes(this.state)) this.setState('chase');
    if (Math.random() < 0.4) g.audio.play('groan', this.pos, 0.8);
  }

  onDeath() {
    this.game.audio.play('zombieDie', this.pos);
    setTimeout(() => this.game.audio.play('bodyFall', this.pos), 700);
    this.world.decals.add(this.pos.x - Math.sin(this.yaw) * 0.8, this.pos.z - Math.cos(this.yaw) * 0.8, 1.4, 0);
  }

  onReleased() {
    this.setState('stagger');
    this.staggerDur = 1.3;
    this.pos.x -= Math.sin(this.yaw) * 0.7;
    this.pos.z -= Math.cos(this.yaw) * 0.7;
    this.collide();
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
    // gemidos
    this.groanT -= dt;
    if (this.groanT <= 0 && this.state !== 'fakedead') {
      this.groanT = this.alert ? rand(2.5, 6) : rand(6, 14);
      g.audio.play('groan', { x: this.pos.x, y: 1.6, z: this.pos.z }, this.alert ? 0.9 : 0.6);
    }
    const d = this.distToPlayer();
    const sight = this.state === 'eat' ? 4 : 10;
    let seen = false;
    if (!['fakedead', 'down', 'stagger', 'rising', 'dead', 'grab', 'attack'].includes(this.state)) {
      seen = this.canSee(sight, this.alert ? -0.2 : 0.25);
      if (seen) {
        this.lastKnown = { x: p.pos.x, z: p.pos.z };
        this.lostT = 0;
        if (!this.alert) {
          this.alert = true;
          this.setState('notice');
        }
      } else this.lostT += dt;
    }
    let speed = 0;
    switch (this.state) {
      case 'idle':
        this.wanderT -= dt;
        if (this.def.wander && this.wanderT <= 0) {
          this.setState('wander');
          const a = rand(0, Math.PI * 2);
          this.wanderTo = { x: this.home.x + Math.cos(a) * rand(2, 5), z: this.home.z + Math.sin(a) * rand(2, 5) };
        }
        break;
      case 'wander': {
        speed = this.speed * 0.6;
        const left = this.moveToward(this.wanderTo.x, this.wanderTo.z, speed, dt, 3);
        if (left < 0.6 || this.stateT > 8) {
          this.setState('idle');
          this.wanderT = rand(3, 8);
        }
        break;
      }
      case 'eat':
        break;
      case 'notice':
        if (this.lastKnown) this.faceTo(this.lastKnown.x, this.lastKnown.z, dt, 4);
        if (this.stateT > 0.8) this.setState('chase');
        break;
      case 'chase': {
        if (p.dead) {
          this.setState('idle');
          break;
        }
        const target = seen || d < 6 ? p.pos : this.lastKnown;
        if (!target) {
          this.setState('idle');
          break;
        }
        if (this.world.isSafe(p.pos.x, p.pos.z) && d < 6) {
          // não entra na área segura: fica parado na porta e desiste
          this.faceTo(p.pos.x, p.pos.z, dt, 3);
          if (this.stateT > 5) {
            this.alert = false;
            this.setState('wander');
            this.wanderTo = { x: this.home.x, z: this.home.z };
          }
          break;
        }
        this.lurchT -= dt;
        let sp = this.speed;
        if (this.lurchT < 0) {
          if (this.lurchT < -rand(2, 5)) this.lurchT = rand(0.4, 0.8);
        } else sp *= 1.7;
        speed = sp;
        this.moveToward(target.x, target.z, sp, dt, 5);
        if (d < 1.45 && seen && Math.abs(wrapAngle(Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) - this.yaw)) < 0.8) {
          this.setState('attack');
          g.audio.play('zombieAttack', this.pos, 0.8);
        }
        if (!seen && this.lostT > 10) {
          this.alert = false;
          this.setState('wander');
          this.wanderTo = { x: this.lastKnown.x, z: this.lastKnown.z };
        }
        break;
      }
      case 'attack':
        if (this.stateT < 0.55) this.faceTo(p.pos.x, p.pos.z, dt, 6);
        if (this.stateT >= 0.55 && !this.attackDone) {
          this.attackDone = true;
          // investida
          this.pos.x += Math.sin(this.yaw) * 0.35;
          this.pos.z += Math.cos(this.yaw) * 0.35;
          this.collide();
          const dd = this.distToPlayer();
          const facing = this.faceDot(p.pos.x, p.pos.z) > 0.5;
          if (dd < 1.35 && facing && !p.dead) {
            if (!p.grabbedBy && chance(this.game.diff.grabChance) && p.startGrab(this)) {
              this.setState('grab');
              this.biteT = 0.8;
              break;
            }
            p.takeDamage(13, this.pos);
          }
        }
        if (this.stateT > 1.4) {
          this.attackDone = false;
          this.setState('chase');
        }
        break;
      case 'grab': {
        if (p.grabbedBy !== this) {
          this.setState('chase');
          break;
        }
        const dx = this.pos.x - p.pos.x;
        const dz = this.pos.z - p.pos.z;
        const dd = Math.hypot(dx, dz) || 1;
        this.pos.x = p.pos.x + (dx / dd) * 0.62;
        this.pos.z = p.pos.z + (dz / dd) * 0.62;
        this.faceTo(p.pos.x, p.pos.z, dt, 12);
        this.biteT -= dt;
        if (this.biteT <= 0) {
          this.biteT = 1.3;
          g.audio.play('bite', this.pos);
          p.invuln = 0;
          p.takeDamage(9, this.pos, { invuln: 0 });
        }
        break;
      }
      case 'stagger':
        if (this.stateT < 0.3) {
          this.pos.x -= Math.sin(this.yaw) * dt * 0.8;
          this.pos.z -= Math.cos(this.yaw) * dt * 0.8;
          this.collide();
        }
        if (this.stateT > (this.staggerDur || 0.6)) this.setState('chase');
        break;
      case 'down':
        if (this.stateT > 2.8) this.setState('rising');
        break;
      case 'fakedead':
        if (d < 3.0 && this.stateT > 1 && this.world.nav.los(this.pos.x, this.pos.z, p.pos.x, p.pos.z, { ignoreSafe: true })) {
          this.setState('rising');
          this.alert = true;
          g.audio.play('groan', this.pos, 1);
        }
        break;
      case 'rising':
        if (this.stateT > 1.5) {
          this.hearing = 1;
          this.setState('chase');
        }
        break;
    }
    this.speedNow = speed;
    this.animate(dt, speed);
  }

  animate(dt, speed) {
    const r = this.rig;
    resetPose(r);
    this.root.rotation.set(0, this.yaw, 0);
    this.root.position.y = 0;
    const t = performance.now() / 1000;
    if (this.state === 'dead' || this.state === 'fakedead' || this.state === 'down' || this.state === 'rising') {
      let k = 1;
      if (this.state === 'dead') k = Math.min(1, this.deathT / 0.9);
      if (this.state === 'down') k = Math.min(1, this.stateT / 0.4);
      if (this.state === 'rising') k = 1 - Math.min(1, this.stateT / 1.4);
      const ease = k * k;
      this.root.rotation.x = -ease * Math.PI * 0.49;
      this.root.position.y = ease * 0.12;
      r.lSh.rotation.x = -ease * 2.6;
      r.rSh.rotation.x = -ease * 2.3;
      r.lSh.rotation.z = ease * 0.4;
      r.lKnee.rotation.x = ease * 0.3;
      r.head.rotation.y = ease * 0.6;
      if (this.state === 'rising') {
        r.spine.rotation.x = (1 - k) * 0.4;
        r.lSh.rotation.x = -1.2;
        r.rSh.rotation.x = -1.0;
      }
      if (this.state === 'down' && this.stateT > 2.2) r.lSh.rotation.x = -1.5 + Math.sin(t * 8) * 0.3;
      return;
    }
    if (this.state === 'eat') {
      r.hips.position.y = r.s * 0.4;
      r.lHip.rotation.x = -1.6;
      r.rHip.rotation.x = -1.3;
      r.lKnee.rotation.x = 2.2;
      r.rKnee.rotation.x = 2.0;
      r.spine.rotation.x = 0.9;
      r.head.rotation.x = 0.4 + Math.sin(t * 7) * 0.15;
      r.lSh.rotation.x = -1.3 + Math.sin(t * 5) * 0.2;
      r.rSh.rotation.x = -1.1 + Math.cos(t * 6) * 0.2;
      r.lEl.rotation.x = -1;
      r.rEl.rotation.x = -1.2;
      return;
    }
    this.phase += (speed / 1.1) * Math.PI * 2 * dt * 0.9;
    const amt = clamp(speed / 1.0, 0, 1);
    gait(r, this.phase, amt * 0.8, 0, { noArms: true });
    if (this.limp) r.rKnee.rotation.x *= 0.3;
    r.spine.rotation.x = 0.3;
    r.head.rotation.z = 0.35 + Math.sin(t * 0.7) * 0.1;
    r.head.rotation.x = -0.2;
    if (r.jaw) r.jaw.rotation.x = 0.25 + Math.sin(t * 3) * 0.1;
    // espasmos
    this.twitchT -= dt;
    if (this.twitchT < 0) {
      this.twitchT = rand(1.5, 4);
      this.twitch = 0.2;
    }
    if (this.twitch > 0) {
      this.twitch -= dt;
      r.head.rotation.y = Math.sin(t * 40) * 0.25;
    }
    const reach = this.state === 'chase' || this.state === 'notice' ? 1 : 0.25;
    r.lSh.rotation.x = -reach * 1.25 + Math.sin(this.phase) * 0.15;
    r.rSh.rotation.x = -reach * 1.05 - Math.sin(this.phase) * 0.15;
    r.lSh.rotation.z = -0.15;
    r.rSh.rotation.z = 0.2;
    r.lEl.rotation.x = -0.3;
    r.rEl.rotation.x = -0.5;
    if (this.state === 'idle') {
      r.spine.rotation.z = Math.sin(t * 0.8 + this.phase) * 0.06;
      r.lSh.rotation.x = -0.2;
      r.rSh.rotation.x = -0.1;
    }
    if (this.state === 'attack') {
      const k = Math.min(1, this.stateT / 0.55);
      r.lSh.rotation.x = -1.6 - k * 0.7;
      r.rSh.rotation.x = -1.5 - k * 0.7;
      r.spine.rotation.x = 0.1 + (this.stateT > 0.55 ? 0.5 : 0);
      if (r.jaw) r.jaw.rotation.x = 0.5;
    }
    if (this.state === 'grab') {
      r.lSh.rotation.x = -1.5;
      r.rSh.rotation.x = -1.5;
      r.lSh.rotation.z = -0.5;
      r.rSh.rotation.z = 0.5;
      r.lEl.rotation.x = -0.9;
      r.rEl.rotation.x = -0.9;
      r.spine.rotation.x = 0.4;
      r.head.rotation.x = 0.3 + Math.sin(t * 12) * 0.2;
      if (r.jaw) r.jaw.rotation.x = 0.4 + Math.sin(t * 14) * 0.3;
    }
    if (this.state === 'stagger') {
      const k = Math.max(0, 1 - this.stateT / (this.staggerDur || 0.6));
      r.spine.rotation.x = 0.3 - k * 0.8;
      r.head.rotation.x = -k * 0.8;
      r.lSh.rotation.x = -0.4;
      r.rSh.rotation.x = 0.2;
    }
  }
}

// ===========================================================================
export class Rastejante extends Enemy {
  constructor(world, def) {
    super(world, def);
    const flesh = charMat(0x7a2a24, 0.45, { tex: 'flesh' });
    const rig = buildQuadruped({
      length: 1.05,
      legLen: 0.48,
      bodyR: 0.16,
      neckLen: 0.22,
      headLen: 0.3,
      headR: 0.075,
      legR: 0.045,
      mat: flesh,
      teeth: true,
      ribs: true,
      extras: (r) => {
        const sp = charMat(0xd8ccb0, 0.5);
        for (let i = 0; i < 7; i++) {
          const s = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.09, 4), sp);
          s.position.set(0, 0.17, -0.35 + i * 0.1);
          r.body.add(s);
        }
      },
    });
    this.rig = rig;
    this.attachModel(rig.root);
    this.maxHp = this.hp = (def.hp || 42) * this.game.diff.enemyHp;
    this.radius = 0.38;
    this.state = def.state || 'idle';
    this.speed = 5.1;
    this.hearing = 1.3;
    this.phase = 0;
    this.home = { x: def.x, z: def.z };
    this.wanderT = rand(1, 4);
    this.growlT = rand(1, 5);
    this.bloodScale = 0.7;
    if (this.state === 'emerge') {
      this.root.position.y = def.y ?? 2.6;
    }
    this.circleDir = chance(0.5) ? 1 : -1;
  }

  hitSpheres() {
    const r = this.rig;
    return [this.sph(r.head, 0, 0, 0.12, 0.14, 'head', 2), this.sph(r.body, 0, 0, 0.2, 0.2, 'body', 1), this.sph(r.body, 0, 0, -0.2, 0.2, 'body', 1)];
  }

  onNoise(x, z) {
    this.lastKnown = { x, z };
    if (!this.alert && this.state !== 'emerge' && this.state !== 'dead') {
      this.alert = true;
      this.setState('chase');
      this.game.audio.play('growl', this.pos);
    }
  }

  onHit(dmg, info) {
    if (!this.alive) return;
    if (this.state !== 'pounce' || dmg > 20) {
      this.setState('stagger');
      this.vx = Math.sin(this.yaw) * -2;
      this.vz = Math.cos(this.yaw) * -2;
    }
    this.game.audio.play('screech', this.pos, 0.7);
  }

  onDeath() {
    this.game.audio.play('screech', this.pos, 1);
    this.world.decals.add(this.pos.x, this.pos.z, 1.0, 1);
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
    let seen = false;
    if (['idle', 'prowl', 'chase', 'circle'].includes(this.state)) {
      seen = this.canSee(14, this.alert ? -0.5 : 0.1);
      if (seen) {
        this.lastKnown = { x: p.pos.x, z: p.pos.z };
        this.lostT = 0;
        if (!this.alert) {
          this.alert = true;
          this.setState('chase');
          g.audio.play('growl', this.pos);
        }
      } else this.lostT += dt;
    }
    this.growlT -= dt;
    if (this.growlT < 0) {
      this.growlT = this.alert ? rand(2, 4) : rand(5, 10);
      g.audio.play(this.alert ? 'growl' : 'growl', this.pos, this.alert ? 0.8 : 0.4);
    }
    let speed = 0;
    switch (this.state) {
      case 'emerge':
        this.root.position.y = Math.max(0, this.root.position.y - dt * 6);
        if (this.root.position.y <= 0 && this.stateT > 0.3) {
          this.alert = true;
          this.setState('chase');
          g.audio.play('screech', this.pos);
        }
        break;
      case 'idle':
        this.wanderT -= dt;
        if (this.wanderT < 0) {
          this.setState('prowl');
          const a = rand(0, Math.PI * 2);
          this.wanderTo = { x: this.home.x + Math.cos(a) * rand(2, 6), z: this.home.z + Math.sin(a) * rand(2, 6) };
        }
        break;
      case 'prowl': {
        speed = 1.2;
        const left = this.moveToward(this.wanderTo.x, this.wanderTo.z, speed, dt, 5);
        if (left < 0.6 || this.stateT > 6) {
          this.setState('idle');
          this.wanderT = rand(2, 5);
        }
        break;
      }
      case 'chase': {
        if (p.dead) {
          this.setState('idle');
          break;
        }
        const target = seen || d < 5 ? p.pos : this.lastKnown;
        if (!target) {
          this.setState('idle');
          break;
        }
        if (this.world.isSafe(p.pos.x, p.pos.z) && d < 7) {
          this.faceTo(p.pos.x, p.pos.z, dt);
          if (this.stateT > 4) {
            this.alert = false;
            this.setState('idle');
          }
          break;
        }
        speed = this.speed;
        this.moveToward(target.x, target.z, speed, dt, 9);
        if (seen && d < 6.5 && d > 3) {
          this.setState(chance(0.5) ? 'circle' : 'crouch');
        } else if (seen && d <= 3) this.setState('crouch');
        if (!seen && this.lostT > 8) {
          this.alert = false;
          this.setState('idle');
        }
        break;
      }
      case 'circle': {
        speed = 3.2;
        const ang = Math.atan2(this.pos.x - p.pos.x, this.pos.z - p.pos.z) + this.circleDir * 0.9;
        const tx = p.pos.x + Math.sin(ang) * 4.5;
        const tz = p.pos.z + Math.cos(ang) * 4.5;
        this.moveToward(tx, tz, speed, dt, 10);
        this.faceTo(p.pos.x, p.pos.z, dt, 6);
        if (this.stateT > rand(1, 2.2)) this.setState('crouch');
        break;
      }
      case 'crouch':
        this.faceTo(p.pos.x, p.pos.z, dt, 12);
        if (this.stateT > 0.38) {
          this.setState('pounce');
          const lead = 0.25;
          this.leapFrom = { x: this.pos.x, z: this.pos.z };
          let tx = p.pos.x + p.vel.x * lead;
          let tz = p.pos.z + p.vel.z * lead;
          const dx = tx - this.pos.x;
          const dz = tz - this.pos.z;
          const dd = Math.hypot(dx, dz);
          const reach = Math.min(dd + 0.6, 6);
          this.leapTo = { x: this.pos.x + (dx / dd) * reach, z: this.pos.z + (dz / dd) * reach };
          this.leapHit = false;
          g.audio.play('screech', this.pos, 0.9);
        }
        break;
      case 'pounce': {
        const T = 0.48;
        const k = Math.min(1, this.stateT / T);
        const nx = lerp(this.leapFrom.x, this.leapTo.x, k);
        const nz = lerp(this.leapFrom.z, this.leapTo.z, k);
        this.pos.x = nx;
        this.pos.z = nz;
        this.collide();
        this.root.position.y = Math.sin(k * Math.PI) * 0.8;
        if (!this.leapHit && this.distToPlayer() < 0.9 && !p.dead) {
          this.leapHit = true;
          p.takeDamage(15, this.pos);
          g.audio.play('bite', this.pos);
        }
        if (k >= 1) {
          this.root.position.y = 0;
          this.setState('recover');
        }
        break;
      }
      case 'recover':
        if (this.stateT > 0.85) this.setState('chase');
        break;
      case 'stagger':
        this.pos.x += this.vx * dt;
        this.pos.z += this.vz * dt;
        this.vx *= 0.9;
        this.vz *= 0.9;
        this.collide();
        this.root.position.y = 0;
        if (this.stateT > 0.5) this.setState('chase');
        break;
    }
    this.speedNow = speed;
    this.animate(dt, speed);
  }

  animate(dt, speed) {
    const r = this.rig;
    this.root.rotation.set(0, this.yaw, 0);
    if (!this.alive) {
      const k = Math.min(1, this.deathT / 0.4);
      this.root.rotation.z = k * Math.PI * 0.5;
      this.root.position.y = 0.1 * k;
      for (const l of r.legs) l.hip.rotation.x = Math.sin(this.deathT * 20) * 0.3 * (1 - k);
      return;
    }
    this.phase += (speed / 1.2) * Math.PI * 2 * dt;
    quadGait(r, this.phase, clamp(speed / 2, 0.15, 1), speed > 3 ? 1 : 0);
    const t = performance.now() / 1000;
    r.head.rotation.x = Math.sin(t * 2) * 0.1;
    r.jaw.rotation.x = this.alert ? 0.3 + Math.sin(t * 9) * 0.15 : 0.1;
    if (this.state === 'crouch') {
      r.body.position.y = r.legLen * 0.75;
      r.jaw.rotation.x = 0.6;
    }
    if (this.state === 'pounce') {
      for (const l of r.legs) l.hip.rotation.x = l.front ? -1.0 : 1.0;
      r.jaw.rotation.x = 0.8;
    }
    if (this.state === 'idle') r.head.rotation.x = 0.4 + Math.sin(t * 3) * 0.1;
    r.tail.rotation.y = Math.sin(t * 6) * 0.4;
  }
}

// ===========================================================================
// O Vigia: perseguidor praticamente indestrutível
export class Vigia extends Enemy {
  constructor(world, def) {
    super(world, def);
    const coat = charMat(0x1a1c1e, 0.75, { tex: 'fabric' });
    const rig = buildHumanoid({
      height: 2.55,
      head: 'gasmask',
      jacketMat: coat,
      pants: 0x15171a,
      shoes: 0x0e0e0e,
      skinMat: charMat(0x8a8478, 0.6, { tex: 'paleskin' }),
      bulk: 1.15,
      armLength: 1.28,
      coat: true,
      coatMat: charMat(0x17191b, 0.8, { tex: 'fabric' }),
      claws: true,
      sleeves: false,
      extras: (r, s) => {
        // tubos saindo das costas para a máscara
        const tm = charMat(0x2a2a28, 0.5);
        for (const sx of [-1, 1]) {
          const tube = new THREE.Mesh(new THREE.TorusGeometry(0.12 * s, 0.018 * s, 6, 12, Math.PI), tm);
          tube.position.set(sx * 0.06 * s, 0.12 * s, -0.08 * s);
          tube.rotation.y = Math.PI / 2;
          r.chest.add(tube);
        }
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.09 * s, 0.4 * s, 10), charMat(0x3a3a34, 0.4, { metal: 0.6 }));
        tank.position.set(0, 0.02 * s, -0.18 * s);
        r.chest.add(tank);
      },
    });
    this.rig = rig;
    this.attachModel(rig.root);
    this.maxHp = this.hp = (def.hp || 380) * this.game.diff.enemyHp;
    this.immortal = true;
    this.radius = 0.5;
    this.speed = def.speed || 3.3;
    this.navOpts = { doors: true };
    this.state = def.state || 'chase';
    this.alert = true;
    this.phase = 0;
    this.staggerAcc = 0;
    this.stepT = 0;
    this.breathT = 1;
    this.radio = 2.2;
    this.persistent = false;
    this.bloodScale = 0.6;
    this.waitT = 0;
  }

  hitSpheres() {
    const r = this.rig;
    return [this.sph(r.head, 0, 0.1, 0, 0.17, 'head', 1.5), this.sph(r.chest, 0, 0.05, 0, 0.32, 'body', 1), this.sph(r.spine, 0, 0.15, 0, 0.3, 'body', 1), this.sph(r.hips, 0, -0.3, 0, 0.3, 'body', 0.8)];
  }

  modifyDamage(dmg) {
    if (this.state === 'kneel' || this.state === 'burst') return 0;
    return dmg;
  }

  onHit(dmg) {
    if (this.state === 'kneel') return;
    this.staggerAcc += dmg;
    if (this.hp <= 0) {
      this.setState('kneel');
      this.game.audio.play('vigiaRoar', this.pos, 0.8);
      return;
    }
    if (this.staggerAcc > 85 && this.state !== 'stagger') {
      this.staggerAcc = 0;
      this.setState('stagger');
      this.game.audio.play('vigiaBreath', this.pos);
    }
  }

  update(dt) {
    const g = this.game;
    const p = this.player;
    this.stateT += dt;
    const d = this.distToPlayer();
    let speed = 0;
    this.breathT -= dt;
    if (this.breathT < 0) {
      this.breathT = rand(2.5, 4);
      g.audio.play('vigiaBreath', { x: this.pos.x, y: 2.3, z: this.pos.z });
    }
    switch (this.state) {
      case 'burst':
        this.faceTo(p.pos.x, p.pos.z, dt, 3);
        if (this.stateT > 1.6) this.setState('chase');
        break;
      case 'chase': {
        if (p.dead) {
          this.setState('idle');
          break;
        }
        if (this.world.isSafe(p.pos.x, p.pos.z)) {
          this.setState('wait');
          break;
        }
        speed = this.speed * (d > 14 ? 1.25 : 1);
        this.moveToward(p.pos.x, p.pos.z, speed, dt, 6);
        this.breakDoors();
        if (d < 2.0) {
          this.setState('attack');
          g.audio.play('vigiaRoar', this.pos, 0.5);
        }
        break;
      }
      case 'attack':
        if (this.stateT < 0.6) this.faceTo(p.pos.x, p.pos.z, dt, 5);
        if (this.stateT > 0.62 && !this.hitDone) {
          this.hitDone = true;
          if (this.distToPlayer() < 2.4 && this.faceDot(p.pos.x, p.pos.z) > 0.4) {
            if (p.grabbedBy) p.releaseGrab();
            p.takeDamage(34, this.pos, { knock: true, invuln: 1.2 });
            g.cam.shake(0.12, 0.4);
            g.audio.play('slam', p.pos, 0.6);
          }
        }
        if (this.stateT > 1.4) {
          this.hitDone = false;
          this.setState('chase');
        }
        break;
      case 'stagger':
        if (this.stateT > 1.3) this.setState('chase');
        break;
      case 'kneel':
        if (this.stateT > 7) {
          this.hp = this.maxHp;
          this.staggerAcc = 0;
          g.audio.play('vigiaRoar', this.pos);
          this.setState('chase');
        }
        break;
      case 'wait':
        this.faceTo(p.pos.x, p.pos.z, dt, 2);
        if (!this.world.isSafe(p.pos.x, p.pos.z)) this.setState('chase');
        else if (this.stateT > 5) this.setState('leave');
        break;
      case 'leave': {
        // afasta-se e some
        speed = 2;
        const a = Math.atan2(this.pos.x - p.pos.x, this.pos.z - p.pos.z);
        this.moveToward(this.pos.x + Math.sin(a) * 4, this.pos.z + Math.cos(a) * 4, speed, dt, 4);
        if (this.stateT > 3) {
          this.world.removeEnemy(this);
          if (this.onLeave) this.onLeave();
        }
        break;
      }
      case 'walk': {
        // passagem roteirizada (não persegue)
        speed = this.walkSpeed || 1.5;
        const t = this.walkTo;
        const dx = t.x - this.pos.x;
        const dz = t.z - this.pos.z;
        const dd = Math.hypot(dx, dz);
        if (dd < 0.3) {
          this.world.removeEnemy(this);
          break;
        }
        this.pos.x += (dx / dd) * speed * dt;
        this.pos.z += (dz / dd) * speed * dt;
        this.yaw = Math.atan2(dx, dz);
        break;
      }
      case 'idle':
        break;
    }
    // passos pesados
    if (speed > 0.5) {
      this.stepT -= dt * speed;
      if (this.stepT < 0) {
        this.stepT = 1.5;
        g.audio.play('vigiaStep', { x: this.pos.x, y: 0.2, z: this.pos.z });
        if (d < 10) g.cam.shake(0.012 * (1 - d / 10), 0.15);
      }
    }
    this.speedNow = speed;
    this.animate(dt, speed);
  }

  breakDoors() {
    for (const door of this.world.doors) {
      if (door.open || door.def.to || door.def.sealed) continue;
      const dx = door.def.x - this.pos.x;
      const dz = door.def.z - this.pos.z;
      if (dx * dx + dz * dz < 2.2 * 2.2) {
        this.world.forceOpenDoor(door);
      }
    }
  }

  animate(dt, speed) {
    const r = this.rig;
    resetPose(r);
    this.root.rotation.set(0, this.yaw, 0);
    const t = performance.now() / 1000;
    this.phase += (speed / 2.6) * Math.PI * 2 * dt;
    gait(r, this.phase, clamp(speed / 2.5, 0, 1), 0, { noArms: true });
    r.spine.rotation.x = 0.18;
    r.head.rotation.x = -0.15 + Math.sin(t * 0.9) * 0.05;
    r.lSh.rotation.x = Math.sin(this.phase) * 0.25 - 0.1;
    r.rSh.rotation.x = -Math.sin(this.phase) * 0.25 - 0.1;
    r.lSh.rotation.z = -0.1;
    r.rSh.rotation.z = 0.1;
    r.lEl.rotation.x = -0.25;
    r.rEl.rotation.x = -0.25;
    if (this.state === 'attack') {
      const k = Math.min(1, this.stateT / 0.6);
      if (this.stateT < 0.6) {
        r.rSh.rotation.x = -2.8 * k;
        r.rSh.rotation.z = 0.4 * k;
        r.spine.rotation.y = 0.5 * k;
      } else {
        const k2 = Math.min(1, (this.stateT - 0.6) / 0.15);
        r.rSh.rotation.x = lerp(-2.8, -0.5, k2);
        r.spine.rotation.y = lerp(0.5, -0.4, k2);
        r.spine.rotation.x = 0.18 + k2 * 0.4;
      }
    }
    if (this.state === 'stagger') {
      r.spine.rotation.x = -0.3;
      r.head.rotation.x = -0.4;
    }
    if (this.state === 'kneel') {
      const k = Math.min(1, this.stateT / 0.5) * (this.stateT > 6.4 ? Math.max(0, 1 - (this.stateT - 6.4) / 0.6) : 1);
      r.hips.position.y = r.s * 0.92 - k * 0.7;
      r.lHip.rotation.x = -k * 1.5;
      r.lKnee.rotation.x = k * 1.5;
      r.rKnee.rotation.x = k * 2.2;
      r.rHip.rotation.x = k * 0.3;
      r.spine.rotation.x = k * 0.6;
      r.lSh.rotation.x = -k * 0.3;
      r.rSh.rotation.x = -k * 0.6;
      r.head.rotation.x = k * 0.5;
    }
    if (this.state === 'burst') {
      r.lSh.rotation.x = -1.8;
      r.rSh.rotation.x = -2;
      r.spine.rotation.x = -0.2;
    }
  }
}
