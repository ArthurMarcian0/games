// Mundo: carrega áreas, gerencia portas, itens, interações, gatilhos,
// inimigos, perigos, luzes, tiros e propagação de ruído.
import * as THREE from 'three';
import { CollisionWorld, NavGrid } from '../engine/Collision.js';
import { Particles, Decals, Weather } from '../engine/Effects.js';
import { LevelBuilder } from './Level.js';
import { MAPS } from './maps/index.js';
import { getMaterial, emissive, charMat } from '../engine/materials.js';
import { glintTex, paperTex } from '../engine/textures.js';
import { ITEMS } from '../game/Items.js';
import { Errante, Rastejante, Vigia } from '../enemies/Enemy.js';
import { Carcereiro, Ninhada, Cervo, Larva } from '../enemies/Bosses.js';
import { buildHumanoid, resetPose, buildWeapon } from '../entities/Rig.js';
import { clamp, rand } from '../core/utils.js';

const ENEMY_TYPES = { errante: Errante, rastejante: Rastejante, vigia: Vigia, carcereiro: Carcereiro, ninhada: Ninhada, cervo: Cervo, larva: Larva };

const SURFACE_OF = {
  woodfloor: 'wood',
  oldwood: 'wood',
  wood: 'wood',
  tilefloor: 'tile',
  labfloor: 'tile',
  metal: 'metal',
  metalDark: 'metal',
  grass: 'mud',
  forestfloor: 'mud',
  dirt: 'mud',
  asphalt: 'wet',
  sidewalk: 'wet',
  carpet: 'concrete',
  concrete: 'concrete',
  rock: 'concrete',
};

export class World {
  constructor(game) {
    this.game = game;
    this.particles = new Particles();
    this.decals = new Decals();
    this.weather = new Weather(game.settings.get('quality'));
    this.weather.onThunder = () => game.audio.play('thunder');
    this.scene = null;
    this.enemies = [];
    this.doors = [];
    this.interactables = [];
    this.triggers = [];
    this.pickups = [];
    this.npcs = [];
    this.hazards = [];
    this.barrels = [];
    this.updaters = [];
    this.lights = [];
    this.time = 0;
  }

  // ----------------------------------------------------------------- carga
  unload() {
    if (!this.scene) return;
    // objetos que sobrevivem entre áreas saem da cena antes do descarte
    const p = this.game.player;
    this.scene.remove(p.root, p.flashlight, p.flashTarget, p.fill, p.muzzleLight, p.muzzleFlash, this.weather.group, this.particles.points);
    for (const d of this.decals.list) this.scene.remove(d);
    this.decals.list.length = 0;
    for (const e of this.enemies) e.dispose();
    const disposeMat = (m) => {
      if (!m || m.userData.shared) return;
      for (const k of ['map', 'emissiveMap']) if (m[k] && !m[k].userData?.shared && m[k].isCanvasTexture && !m[k].userData.keep) m[k].dispose();
      m.dispose();
    };
    this.scene.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isLineSegments || o.isSprite) {
        if (o.userData.keep) return;
        if (o.geometry && !o.userData.sharedGeo && !o.userData.rigPart) o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach(disposeMat);
        else disposeMat(o.material);
      }
    });
    this.scene = null;
  }

  load(id, spawnName) {
    this.unload();
    const g = this.game;
    const map = MAPS[id];
    if (!map) throw new Error('Mapa inexistente: ' + id);
    this.map = map;
    this.id = id;
    this.time = 0;
    const scene = (this.scene = new THREE.Scene());
    const fog = map.fog || { color: 0x0a0c10, density: 0.05 };
    scene.background = new THREE.Color(fog.color);
    scene.fog = new THREE.FogExp2(fog.color, fog.density);
    this.hemi = new THREE.HemisphereLight(map.sky ?? 0x34404e, map.ground ?? 0x0b0908, map.ambient ?? 0.25);
    scene.add(this.hemi);
    this.baseAmbient = map.ambient ?? 0.25;
    this.flash = new THREE.PointLight(0xffa050, 0, 14, 2);
    scene.add(this.flash);
    // mapa de ambiente procedural (reflexos sutis em poças, vidro e metal)
    scene.environment = this.envFor(map);
    scene.environmentIntensity = map.envIntensity ?? (map.rain ? 0.35 : 0.22);
    this.collision = new CollisionWorld();
    this.enemies = [];
    this.doors = [];
    this.interactables = [];
    this.triggers = [];
    this.pickups = [];
    this.npcs = [];
    this.hazards = [];
    this.barrels = [];
    this.updaters = [];
    this.lights = [];
    this.killHooks = [];
    this.lightGroups = {};
    this.focus = null;
    this.zoneNow = null;

    this.particles.attach(scene);
    this.decals.attach(scene);
    const L = new LevelBuilder(this);
    this.L = L;
    map.build(L, g, this);
    L.finalize();
    this.rooms = L.rooms;
    this.zones = L.zones;
    this.spawns = L.spawns;
    this.mapShapes = L.mapShapes;

    for (const d of L.doorDefs) this.doors.push(new Door(this, d));

    const b = map.bounds;
    this.nav = new NavGrid(b.minX, b.minZ, b.maxX, b.maxZ, 0.5);
    this.nav.build(this.collision);
    this.doors.forEach((d, i) => d.updateNav(i));
    for (const z of this.zones) if (z.safe) this.nav.markRect(z.minX + 0.35, z.minZ + 0.35, z.maxX - 0.35, z.maxZ - 0.35, 3);

    const indoorRects = this.zones.filter((z) => z.indoor);
    this.weather.configure({
      rain: !!map.rain || !!map.rainBounds,
      mist: !!map.mist,
      rects: map.rain ? indoorRects : [],
      bounds: map.rainBounds || null,
      mistColor: map.mistColor,
      mistOpacity: map.mistOpacity ?? 0.5,
      lightning: map.lightning !== false,
    });
    scene.add(this.weather.group);

    g.player.attach(scene);
    const sp = this.spawns[spawnName] || this.spawns.default || { x: 0, z: 0, ry: 0 };
    g.player.setPos(sp.x, sp.z, sp.ry);
    g.cam.setYaw(sp.ry);
    g.cam.pitch = -0.08;
    if (map.onEnter) map.onEnter(g, this, spawnName);
  }

  envFor(map) {
    this.envCache ||= new Map();
    const key = map.id;
    if (this.envCache.has(key)) return this.envCache.get(key);
    const r = this.game.renderer.renderer;
    const pm = new THREE.PMREMGenerator(r);
    const s = new THREE.Scene();
    const sky = new THREE.Color(map.envSky ?? (map.rain ? 0x2a3442 : 0x1a1c20));
    const ground = new THREE.Color(0x050505);
    const geo = new THREE.SphereGeometry(10, 32, 16);
    const col = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, Math.min(1, pos.getY(i) / 10 * 0.5 + 0.5));
      const c = ground.clone().lerp(sky, Math.pow(t, 1.5));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    // "janelas" e lâmpadas distantes refletidas
    const warm = new THREE.MeshBasicMaterial({ color: map.envLight ?? 0xffb070 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), warm);
      m.position.set(Math.cos(a) * 8, 1 + (i % 3) * 0.8, Math.sin(a) * 8);
      m.lookAt(0, 0, 0);
      s.add(m);
    }
    const tex = pm.fromScene(s, 0.04).texture;
    pm.dispose();
    geo.dispose();
    tex.userData.keep = true;
    this.envCache.set(key, tex);
    return tex;
  }

  // ----------------------------------------------------------------- luzes
  addLight(def) {
    let light;
    const color = def.color ?? 0xffd8a8;
    if (def.type === 'spot') {
      light = new THREE.SpotLight(color, def.intensity ?? 30, def.distance ?? 16, def.angle ?? 0.7, def.penumbra ?? 0.5, def.decay ?? 1.6);
      light.target.position.set(def.tx ?? def.x, def.ty ?? 0, def.tz ?? def.z);
      this.scene.add(light.target);
    } else {
      light = new THREE.PointLight(color, def.intensity ?? 8, def.distance ?? 10, def.decay ?? 1.8);
    }
    light.position.set(def.x, def.y ?? 2.6, def.z);
    light.castShadow = false;
    this.scene.add(light);
    const rec = { light, base: def.intensity ?? (def.type === 'spot' ? 30 : 8), flicker: def.flicker || 0, on: def.on !== false, group: def.group, pos: light.position, dist: def.distance ?? 10, ft: 0, fv: 1, mesh: def.mesh };
    if (rec.group) (this.lightGroups[rec.group] ||= []).push(rec);
    this.lights.push(rec);
    return rec;
  }

  setLightGroup(group, on) {
    for (const r of this.lightGroups[group] || []) {
      r.on = on;
      if (r.mesh) r.mesh.visible = on;
    }
  }

  updateLights(dt) {
    const p = this.game.player.pos;
    for (const r of this.lights) {
      const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z);
      let k = r.on ? 1 : 0;
      if (d > r.dist + 22) k = 0;
      if (k && r.flicker) {
        r.ft -= dt;
        if (r.ft <= 0) {
          const off = Math.random() < r.flicker;
          r.fv = off ? rand(0, 0.25) : rand(0.85, 1.05);
          r.ft = off ? rand(0.03, 0.15) : rand(0.08, 1.5 * (1 - r.flicker) + 0.1);
        }
        k *= r.fv;
      }
      r.light.intensity = r.base * k;
      if (r.mesh && r.flicker) r.mesh.visible = r.on && r.fv > 0.5;
    }
    // relâmpago ilumina o céu
    const l = this.weather.lightning;
    this.hemi.intensity = this.baseAmbient + l * (this.map.rain ? 2.5 : 0) * (this.zoneNow && this.zoneNow.indoor ? 0.3 : 1);
    this.game.fx.flash = l * (this.map.rain ? 0.12 : 0) * (this.zoneNow && this.zoneNow.indoor ? 0.3 : 1);
    if (this.flash.intensity > 0) this.flash.intensity = Math.max(0, this.flash.intensity - dt * 120);
  }

  // ----------------------------------------------------------------- consultas
  zoneAt(x, z) {
    let best = null;
    for (const zn of this.zones) {
      if (x >= zn.minX && x <= zn.maxX && z >= zn.minZ && z <= zn.maxZ) {
        if (!best || (zn.maxX - zn.minX) * (zn.maxZ - zn.minZ) < (best.maxX - best.minX) * (best.maxZ - best.minZ)) best = zn;
      }
    }
    return best;
  }
  roomAt(x, z) {
    for (const r of this.rooms) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return r;
    return null;
  }
  isSafe(x, z) {
    const zn = this.zoneAt(x, z);
    return !!(zn && zn.safe);
  }
  isIndoor(x, z) {
    const zn = this.zoneAt(x, z);
    if (zn) return !!zn.indoor;
    return !this.map.rain;
  }
  ceilingAt(x, z) {
    const r = this.roomAt(x, z);
    if (r && r.ceil) return r.h;
    if (r && !r.ceil) return 50;
    return this.map.rain ? 50 : this.map.ceilDefault || 50;
  }
  surfaceAt(x, z) {
    for (const s of this.map.surfaces || []) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return s.surface;
    const r = this.roomAt(x, z);
    if (r) return r.surface || SURFACE_OF[r.floor] || 'concrete';
    return this.map.surface || 'concrete';
  }

  // ----------------------------------------------------------------- entidades
  spawnEnemy(def) {
    const Cls = ENEMY_TYPES[def.type];
    if (!Cls) return null;
    const e = new Cls(this, def);
    this.enemies.push(e);
    return e;
  }
  removeEnemy(e) {
    e.dispose();
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
  }
  onEnemyKilled(e) {
    for (const fn of this.killHooks) fn(e);
  }

  emitNoise(x, z, radius, kind) {
    for (const e of this.enemies) if (e.alive) e.hear(x, z, radius, kind);
  }

  pushOutOfActors(pos, r) {
    for (const e of this.enemies) {
      if (!e.alive || !e.solid || e.state === 'fakedead' || e.state === 'grab') continue;
      const dx = pos.x - e.pos.x;
      const dz = pos.z - e.pos.z;
      const rr = r + e.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = e.pos.x + (dx / d) * rr;
        pos.z = e.pos.z + (dz / d) * rr;
      }
    }
    for (const n of this.npcs) {
      const dx = pos.x - n.x;
      const dz = pos.z - n.z;
      const d = Math.hypot(dx, dz);
      if (d < r + 0.35 && d > 0.001) {
        pos.x = n.x + (dx / d) * (r + 0.35);
        pos.z = n.z + (dz / d) * (r + 0.35);
      }
    }
    this.collision.resolveCircle(pos, r);
  }

  shoot(o, dir, range) {
    const ex = o.x + dir.x * range;
    const ez = o.z + dir.z * range;
    const ey = o.y + dir.y * range;
    const seg = this.collision.segment(o.x, o.z, ex, ez, o.y, ey, 0.05);
    let best = seg.t * range;
    let res = null;
    if (dir.y < -0.001) {
      const tf = -o.y / dir.y;
      if (tf < best) best = tf;
    }
    const oc = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || e.untargetable) continue;
      if (Math.hypot(e.pos.x - o.x, e.pos.z - o.z) > range + 4) continue;
      for (const s of e.hitSpheres()) {
        oc.subVectors(o, s.c);
        const b = oc.dot(dir);
        const c = oc.lengthSq() - s.r * s.r;
        const disc = b * b - c;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        let t = -b - sq;
        if (t < 0) t = -b + sq;
        if (t > 0 && t < best) {
          best = t;
          res = { enemy: e, zone: s.zone, mult: s.mult, sid: s.sid };
        }
      }
    }
    for (const br of this.barrels) {
      if (!br.alive) continue;
      oc.set(o.x - br.x, o.y - 0.45, o.z - br.z);
      const b = oc.dot(dir);
      const c = oc.lengthSq() - 0.42 * 0.42;
      const disc = b * b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && t < best) {
        best = t;
        res = { barrel: br };
      }
    }
    if (!res) res = { wall: true };
    res.dist = best;
    res.point = o.clone().addScaledVector(dir, best);
    return res;
  }

  // ----------------------------------------------------------------- perigos
  addRing(x, z, maxR, dmg, speed = 7) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: 0xc8b8a0, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.05, z);
    this.scene.add(mesh);
    this.hazards.push({ type: 'ring', x, z, r: 0.3, maxR, dmg, speed, mesh, hit: false });
  }

  addAcid(x, z, r, dur, dps) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ color: 0x203008, emissive: 0x6a9a10, emissiveIntensity: 0.8, transparent: true, opacity: 0.85, roughness: 0.1, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.03, z);
    this.scene.add(mesh);
    this.hazards.push({ type: 'acid', x, z, r, t: dur, dps, mesh, tick: 0 });
  }

  explosion(x, z, radius = 3.8, dmg = 160) {
    const g = this.game;
    g.audio.play('explosion', { x, y: 0.5, z });
    g.cam.shake(0.15, 0.7);
    this.flash.position.set(x, 1.2, z);
    this.flash.intensity = 120;
    const c = new THREE.Vector3(x, 0.6, z);
    this.particles.sparks(c, 40);
    this.particles.smoke(c, 20);
    this.particles.dust(c, 30, [0.3, 0.2, 0.15]);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d < radius + e.radius) {
        const k = 1 - d / (radius + e.radius + 0.5);
        if (e.explosionHit) e.explosionHit(dmg * k);
        else e.takeDamage(dmg * k, { zone: 'body', stagger: 1 });
      }
    }
    const p = g.player;
    const dp = Math.hypot(p.pos.x - x, p.pos.z - z);
    if (dp < radius) p.takeDamage(45 * (1 - dp / radius), { x, z }, { knock: true });
    this.emitNoise(x, z, 30, 'shot');
  }

  updateHazards(dt) {
    const p = this.game.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      const d = Math.hypot(p.pos.x - h.x, p.pos.z - h.z);
      if (h.type === 'ring') {
        h.r += h.speed * dt;
        h.mesh.scale.setScalar(h.r);
        h.mesh.material.opacity = 0.6 * (1 - h.r / h.maxR);
        if (!h.hit && Math.abs(d - h.r) < 0.55 && p.knockT <= 0) {
          h.hit = true;
          p.takeDamage(h.dmg, { x: h.x, z: h.z }, { knock: h.dmg > 18 });
        }
        if (h.r >= h.maxR) {
          this.scene.remove(h.mesh);
          h.mesh.geometry.dispose();
          this.hazards.splice(i, 1);
        }
      } else if (h.type === 'acid') {
        h.t -= dt;
        h.mesh.material.opacity = Math.min(0.85, h.t);
        if (d < h.r * 0.9) {
          h.tick -= dt;
          if (h.tick <= 0) {
            h.tick = 0.5;
            p.invuln = 0;
            p.takeDamage(h.dps * 0.5, { x: h.x, z: h.z }, { invuln: 0 });
            this.game.audio.play('sizzle', p.pos, 0.6);
          }
        }
        if (Math.random() < dt * 3) this.particles.steam(new THREE.Vector3(h.x + rand(-h.r, h.r) * 0.6, 0.1, h.z + rand(-h.r, h.r) * 0.6), [0.5, 0.7, 0.2]);
        if (h.t <= 0) {
          this.scene.remove(h.mesh);
          h.mesh.geometry.dispose();
          this.hazards.splice(i, 1);
        }
      }
    }
  }

  // ----------------------------------------------------------------- interação
  addInteract(it) {
    const obj = { r: 1.4, y: 1, enabled: true, ...it };
    this.interactables.push(obj);
    return obj;
  }

  findFocus() {
    const p = this.game.player;
    if (p.dead || p.grabbedBy) return null;
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    let best = null;
    let bestScore = Infinity;
    for (const it of this.interactables) {
      if (!it.enabled) continue;
      if (it.cond && !it.cond(this.game)) continue;
      const dx = it.x - p.pos.x;
      const dz = it.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > it.r) continue;
      const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      if (dot < 0.15 && d > 0.7) continue;
      const score = d - dot * 0.6;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    return best;
  }

  interact() {
    const it = this.focus;
    if (!it) return;
    it.use(this.game, it);
  }

  // ----------------------------------------------------------------- itens
  addPickup(def) {
    const g = this.game;
    const flag = `pick_${this.id}_${def.id}`;
    if (g.flag(flag)) return null;
    const item = ITEMS[def.item];
    const model = makeItemModel(def.item);
    model.position.set(def.x, def.y ?? 0.02, def.z);
    model.rotation.y = def.ry ?? rand(0, 6.28);
    this.scene.add(model);
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: item.type === 'key' ? 0xfff0c0 : 0xd8e8ff }));
    glint.position.set(def.x, (def.y ?? 0) + 0.25, def.z);
    glint.scale.setScalar(0.35);
    glint.userData.ph = rand(0, 6);
    this.scene.add(glint);
    const pk = { def, model, glint, qty: def.qty || 1, flag };
    this.pickups.push(pk);
    pk.inter = this.addInteract({
      x: def.x,
      z: def.z,
      r: 1.5,
      prompt: () => `Pegar ${item.name}${pk.qty > 1 ? ' (' + pk.qty + ')' : ''}`,
      use: () => this.takePickup(pk),
    });
    return pk;
  }

  takePickup(pk) {
    const g = this.game;
    const id = pk.def.item;
    const def = ITEMS[id];
    if (def.type === 'upgrade') {
      g.state.invSize = Math.min(12, g.state.invSize + 2);
      while (g.state.inv.length < g.state.invSize) g.state.inv.push(null);
      g.audio.play('keyItem');
      g.ui.examine([`Você encontrou: ${def.name}.`, 'O inventário agora tem ' + g.state.invSize + ' espaços.']);
      this.finishPickup(pk);
      return;
    }
    let qty = Math.round(pk.qty * (def.type === 'ammo' && pk.def.scaleAmmo !== false ? g.diff.ammo : 1));
    qty = Math.max(1, qty);
    let added = 0;
    for (let n = qty; n > 0; n--) {
      if (g.inv.canAdd(id, n)) {
        added = g.inv.add(id, n);
        break;
      }
    }
    if (added <= 0) {
      g.audio.play('uiError');
      g.hud.message('Inventário cheio. Organize seus itens em um ponto seguro.');
      return;
    }
    g.audio.play(def.type === 'key' ? 'keyItem' : 'pickup');
    g.hud.message(`Você pegou: ${def.name}${added > 1 ? ' ×' + added : ''}.`);
    if (def.type === 'weapon' && !g.state.equipped) g.player.equip(id);
    if ((id === 'herb' && g.inv.count('herb') >= 2) || id === 'chem' || (id === 'gunpowder' && g.inv.count('gunpowder') >= 2)) g.hint('combine');
    if (id === 'shotgun') g.hint('weapons');
    if (id === 'pipe') g.hint('pipe');
    if (added < qty) {
      pk.qty = Math.ceil((qty - added) / (def.type === 'ammo' && pk.def.scaleAmmo !== false ? g.diff.ammo : 1));
      g.hud.message(`Pegou ${added}. Não cabe mais nada.`);
      return;
    }
    this.finishPickup(pk);
    if (pk.def.onTake) pk.def.onTake(g);
    g.hud.updateWeapon();
  }

  finishPickup(pk) {
    this.game.setFlag(pk.flag);
    this.scene.remove(pk.model, pk.glint);
    pk.inter.enabled = false;
    const i = this.pickups.indexOf(pk);
    if (i >= 0) this.pickups.splice(i, 1);
  }

  // ----------------------------------------------------------------- portas
  forceOpenDoor(door) {
    if (door.open) return;
    door.locked = false;
    door.setOpen(true, this.game.player.pos, true);
    this.game.audio.play('wallBreak', door.center, 0.5);
    this.game.cam.shake(0.05, 0.3);
    this.particles.dust(door.center.clone().setY(1.2), 14);
  }

  unlockDoor(id, open = false) {
    const d = this.doors.find((x) => x.def.id === id);
    if (!d) return;
    d.unlock();
    if (open) d.setOpen(true, this.game.player.pos);
  }

  // ----------------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    const g = this.game;
    const p = g.player;
    for (const d of this.doors) d.update(dt);
    for (const e of this.enemies.slice()) e.update(dt);
    for (const n of this.npcs) n.update(dt);
    for (const fn of this.updaters) fn(dt, g, this);
    this.updateHazards(dt);
    // gatilhos
    for (const t of this.triggers) {
      if (t.done) continue;
      const inside = p.pos.x >= t.x0 && p.pos.x <= t.x1 && p.pos.z >= t.z0 && p.pos.z <= t.z1;
      if (inside && !t.inside && (!t.cond || t.cond(g))) {
        if (t.once !== false) {
          t.done = true;
          if (t.persist !== false) g.setFlag(`trig_${this.id}_${t.id}`);
        }
        t.onEnter(g, this);
      }
      t.inside = inside;
    }
    // brilho dos itens
    for (const pk of this.pickups) {
      pk.glint.userData.ph += dt * 3;
      pk.glint.material.opacity = 0.35 + Math.max(0, Math.sin(pk.glint.userData.ph)) * 0.65;
      pk.model.rotation.y += dt * 0.4;
    }
    // zona atual
    const zn = this.zoneAt(p.pos.x, p.pos.z);
    if (zn !== this.zoneNow) {
      this.zoneNow = zn;
      g.onZoneChange(zn);
    }
    const room = this.roomAt(p.pos.x, p.pos.z);
    if (room && room.id) g.state.visited[`${this.id}:${room.id}`] = true;
    this.focus = this.findFocus();
    this.updateLights(dt);
    this.weather.update(dt, this.time, g.cam.camera, p.pos);
    this.particles.update(dt);
    // rádio: estática perto de criaturas
    let radio = 0;
    let fear = 0;
    for (const e of this.enemies) {
      if (!e.alive || !e.radio) continue;
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      radio = Math.max(radio, clamp((1 - d / 18) * e.radio, 0, 1));
      if (e.alert && d < 12) fear = Math.max(fear, 1 - d / 12);
    }
    g.audio.radioLevel = g.radioMuted ? 0 : radio;
    g.radioLevel = radio;
    g.fear = fear;
  }
}

// ===========================================================================
class Door {
  constructor(world, def) {
    this.world = world;
    this.def = def;
    const g = world.game;
    this.flagKey = `door_${world.id}_${def.id}`;
    const st = g.flag(this.flagKey);
    this.locked = !!def.lock && !st;
    this.open = st === 'o' || (!!def.startOpen && !def.lock);
    this.anim = this.open ? 1 : 0;
    this.center = new THREE.Vector3(def.x, 0, def.z);
    const w = def.w;
    const h = def.h;
    const ax = def.axis === 'x';
    this.rect = ax
      ? { minX: def.x - w / 2, maxX: def.x + w / 2, minZ: def.z - 0.16, maxZ: def.z + 0.16 }
      : { minX: def.x - 0.16, maxX: def.x + 0.16, minZ: def.z - w / 2, maxZ: def.z + w / 2 };
    this.box = world.collision.add(this.rect.minX, this.rect.minZ, this.rect.maxX, this.rect.maxZ, h, 'door');
    this.box.enabled = !this.open;
    this.buildMesh();
    this.applyAnim();
    world.addInteract({
      x: def.x,
      z: def.z,
      r: def.r || 1.7,
      kind: 'door',
      prompt: () => this.prompt(),
      use: () => this.use(),
      cond: () => !(this.open && def.kind === 'roll'),
    });
  }

  prompt() {
    const d = this.def;
    if (d.prompt) return typeof d.prompt === 'function' ? d.prompt(this.world.game) : d.prompt;
    if (d.to) return d.kind === 'stairs' ? 'Usar escada' : 'Atravessar';
    if (this.locked && d.lock.item && this.world.game.inv.has(d.lock.item)) return `Usar ${ITEMS[d.lock.item].name}`;
    if (this.open) return 'Fechar';
    return d.kind === 'shelf' ? 'Empurrar estante' : 'Abrir';
  }

  buildMesh() {
    const d = this.def;
    const kind = d.kind;
    const pivot = new THREE.Group();
    pivot.position.set(d.x, 0, d.z);
    if (d.axis === 'z') pivot.rotation.y = Math.PI / 2;
    this.world.scene.add(pivot);
    this.pivot = pivot;
    const w = d.w;
    const h = d.h;
    const panel = new THREE.Group();
    this.panel = panel;
    if (kind === 'none' || kind === 'stairs') return;
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, typeof mat === 'string' ? getMaterial(mat) : mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      panel.add(m);
      return m;
    };
    // moldura
    const frameMat = getMaterial(kind === 'security' || kind === 'metal' ? 'metalDark' : 'woodDark');
    if (!['gate', 'roll', 'shelf', 'bars'].includes(kind)) {
      for (const sx of [-1, 1]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.34), frameMat);
        f.position.set((sx * (w + 0.08)) / 2, h / 2, 0);
        pivot.add(f);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.08, 0.34), frameMat);
      top.position.set(0, h + 0.04, 0);
      pivot.add(top);
    }
    if (kind === 'wood' || kind === 'metal' || kind === 'glass') {
      // dobradiça na borda esquerda: painel deslocado
      panel.position.set(-w / 2, 0, 0);
      const mat = kind === 'metal' ? 'metalPaint' : 'woodDark';
      add(new THREE.BoxGeometry(w, h - 0.02, 0.05), mat, w / 2, h / 2, 0);
      if (kind === 'glass') add(new THREE.BoxGeometry(w * 0.6, h * 0.35, 0.06), 'glassDark', w / 2, h * 0.7, 0);
      else {
        add(new THREE.BoxGeometry(w * 0.7, h * 0.32, 0.06), kind === 'metal' ? 'metalDark' : 'wood', w / 2, h * 0.7, 0);
        add(new THREE.BoxGeometry(w * 0.7, h * 0.32, 0.06), kind === 'metal' ? 'metalDark' : 'wood', w / 2, h * 0.28, 0);
      }
      for (const sz of [-1, 1]) {
        const knob = add(new THREE.SphereGeometry(0.04, 8, 6), 'chrome', w - 0.1, 1.0, sz * 0.05);
        knob.castShadow = false;
      }
      if (d.sign) this.addSign(panel, w, h);
    } else if (kind === 'double') {
      this.leaves = [];
      for (const sx of [-1, 1]) {
        const leaf = new THREE.Group();
        leaf.position.set((sx * w) / 2, 0, 0);
        const m = new THREE.Mesh(new THREE.BoxGeometry(w / 2, h - 0.02, 0.05), getMaterial('metalPaint'));
        m.position.set((-sx * w) / 4, h / 2, 0);
        m.castShadow = true;
        leaf.add(m);
        const wnd = new THREE.Mesh(new THREE.BoxGeometry(w / 4, 0.4, 0.06), getMaterial('glassDark'));
        wnd.position.set((-sx * w) / 4, 1.55, 0);
        leaf.add(wnd);
        panel.add(leaf);
        this.leaves.push({ leaf, sx });
      }
    } else if (kind === 'security') {
      add(new THREE.BoxGeometry(w, h, 0.12), 'metalDark', 0, h / 2, 0);
      for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(w * 0.18, 0.12, 0.13), 'paintYellow', -w / 2 + w * 0.1 + i * w * 0.2, 0.35, 0);
      const lamp = add(new THREE.BoxGeometry(0.12, 0.12, 0.14), emissive(this.locked ? 0xff2010 : 0x20ff40, 2), w / 2 - 0.15, h - 0.25, 0);
      this.lamp = lamp;
    } else if (kind === 'bars' || kind === 'gate') {
      if (kind === 'gate') panel.position.set(-w / 2, 0, 0);
      const ox = kind === 'gate' ? w / 2 : 0;
      for (let x = -w / 2 + 0.06; x < w / 2; x += 0.13) add(new THREE.CylinderGeometry(0.018, 0.018, h, 6), 'metalDark', x + ox, h / 2, 0);
      add(new THREE.BoxGeometry(w, 0.05, 0.05), 'metalDark', ox, h - 0.05, 0);
      add(new THREE.BoxGeometry(w, 0.05, 0.05), 'metalDark', ox, 0.1, 0);
      add(new THREE.BoxGeometry(w, 0.05, 0.05), 'metalDark', ox, h * 0.5, 0);
      if (d.chain && this.locked) {
        const ch = add(new THREE.TorusGeometry(0.12, 0.025, 6, 12), 'chrome', w - 0.05, 1.1, 0.06);
        this.chain = ch;
        const lock = add(new THREE.BoxGeometry(0.08, 0.1, 0.05), 'metalPaint', w - 0.05, 0.95, 0.1);
        this.padlock = lock;
      }
    } else if (kind === 'roll') {
      add(new THREE.BoxGeometry(w, h, 0.06), 'metalPaint', 0, h / 2, 0);
      for (let y = 0.15; y < h; y += 0.15) add(new THREE.BoxGeometry(w, 0.02, 0.08), 'metalDark', 0, y, 0);
    } else if (kind === 'shelf') {
      add(new THREE.BoxGeometry(w, 2.0, 0.45), 'wood', 0, 1.0, 0.1);
      const bm = ['fabricRed', 'paintBlue', 'fabricGreen', 'woodDark'];
      for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(0.06, 0.25, 0.3), bm[(r + i) % 4], -w / 2 + 0.12 + i * 0.13, 0.3 + r * 0.45, 0.33);
    } else if (kind === 'mine') {
      add(new THREE.BoxGeometry(w, h, 0.2), 'rust', 0, h / 2, 0);
      for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), 'metalDark', -0.6 + i * 0.4, 1.3, 0.12).rotation.x = Math.PI / 2;
      add(new THREE.BoxGeometry(w * 0.9, 0.1, 0.24), 'metalDark', 0, 0.3, 0);
      add(new THREE.BoxGeometry(w * 0.9, 0.1, 0.24), 'metalDark', 0, h - 0.3, 0);
    }
    pivot.add(panel);
  }

  addSign(panel, w, h) {
    // placa sobre a porta (texto)
  }

  updateNav(i) {
    const nav = this.world.nav;
    this.index = i;
    if (this.def.to || this.def.sealed) nav.markRect(this.rect.minX, this.rect.minZ, this.rect.maxX, this.rect.maxZ, 1);
    else nav.setDoor(i, this.rect, !this.open);
  }

  unlock() {
    this.locked = false;
    this.world.game.setFlag(this.flagKey, 'u');
    if (this.lamp) this.lamp.material = emissive(0x20ff40, 2);
    if (this.chain) this.chain.visible = false;
    if (this.padlock) this.padlock.visible = false;
  }

  use() {
    const g = this.world.game;
    const d = this.def;
    if (this.locked) {
      const L = d.lock;
      if (L.item && g.inv.has(L.item)) {
        this.unlock();
        g.audio.play(d.chain ? 'chain' : 'unlock', this.center);
        let msg = `Você usou: ${ITEMS[L.item].name}.`;
        if (L.consume) {
          g.inv.remove(L.item, 1);
          msg += ' O item não é mais necessário.';
        }
        g.hud.message(msg);
        if (L.onUnlock) L.onUnlock(g);
        if (!d.to && !L.openNow) return;
      } else if (L.code) {
        g.ui.openKeypad({
          title: L.codeTitle || 'Painel numérico',
          length: L.code.length,
          check: (v) => v === L.code,
          onSolve: () => {
            this.unlock();
            g.audio.play('unlock', this.center);
            g.hud.message(L.okMsg || 'A trava se abriu.');
            if (L.onUnlock) L.onUnlock(g);
          },
        });
        return;
      } else if (L.flag && g.flag(L.flag)) {
        this.unlock();
      } else {
        const msg = typeof L.msg === 'function' ? L.msg(g) : L.msg === null ? null : L.msg || 'Está trancada.';
        if (msg) {
          g.audio.play('doorLocked', this.center);
          g.hud.message(msg);
        }
        if (L.onLocked) L.onLocked(g);
        return;
      }
    }
    if (d.to) {
      g.transition(d.to.map, d.to.spawn, d.sound || (d.kind === 'stairs' ? 'stairs' : d.kind === 'gate' ? 'gate' : d.kind === 'security' || d.kind === 'mine' ? 'metalDoor' : 'doorOpen'));
      return;
    }
    if (d.oneWay && this.open) return;
    if (d.onUse && d.onUse(g, this) === false) return;
    this.setOpen(!this.open, g.player.pos);
  }

  setOpen(open, fromPos, silent = false) {
    if (this.open === open) return;
    const g = this.world.game;
    const d = this.def;
    if (d.kind === 'shelf' || d.kind === 'roll' || d.kind === 'mine' || d.kind === 'security') open = true;
    this.open = open;
    // abre para longe do jogador
    if (open && fromPos) {
      const nx = d.axis === 'x' ? 0 : 1;
      const nz = d.axis === 'x' ? 1 : 0;
      const side = (fromPos.x - d.x) * nx + (fromPos.z - d.z) * nz;
      this.dir = side > 0 ? -1 : 1;
      if (d.axis === 'z') this.dir *= -1;
    }
    this.box.enabled = !open;
    this.world.nav.setDoor(this.index, this.rect, !open);
    g.setFlag(this.flagKey, open ? 'o' : 'u');
    if (!silent) {
      const snd = { security: 'metalDoor', roll: 'metalDoor', gate: 'gate', bars: 'gate', shelf: 'creak', mine: 'metalDoor' }[d.kind] || (open ? 'doorOpen' : 'doorClose');
      g.audio.play(snd, this.center);
    }
    this.world.emitNoise(d.x, d.z, 7, 'door');
    if (open && d.onOpen) d.onOpen(g, this);
  }

  applyAnim() {
    const d = this.def;
    const k = this.anim;
    const e = k * k * (3 - 2 * k);
    const p = this.panel;
    switch (d.kind) {
      case 'wood':
      case 'metal':
      case 'glass':
      case 'gate':
        p.rotation.y = (this.dir || 1) * e * 1.7;
        break;
      case 'double':
        for (const l of this.leaves) l.leaf.rotation.y = l.sx * (this.dir || 1) * e * 1.6;
        break;
      case 'security':
      case 'bars':
      case 'shelf':
        p.position.x = e * d.w * 0.95;
        break;
      case 'roll':
      case 'mine':
        p.position.y = e * (d.h - 0.2);
        break;
    }
  }

  update(dt) {
    const target = this.open ? 1 : 0;
    if (this.anim !== target) {
      const speed = ['roll', 'mine', 'security', 'shelf'].includes(this.def.kind) ? 0.6 : 2;
      this.anim += Math.sign(target - this.anim) * dt * speed;
      this.anim = clamp(this.anim, 0, 1);
      this.applyAnim();
    }
  }
}

// ===========================================================================
// modelos simples para itens no chão
function makeItemModel(id) {
  const g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, typeof mat === 'string' ? getMaterial(mat) : mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const def = ITEMS[id];
  switch (id) {
    case 'herb':
    case 'herb_mix':
      add(new THREE.CylinderGeometry(0.1, 0.08, 0.14, 10), charMat(0x7a4a2a, 0.8), 0, 0.07, 0);
      for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(0.07, 6, 4), charMat(id === 'herb' ? 0x2f6a2a : 0x3a7a20, 0.7), Math.cos(i) * 0.06, 0.2 + (i % 2) * 0.05, Math.sin(i) * 0.06).scale.set(1, 0.4, 1.6);
      break;
    case 'ammo_pistol':
      add(new THREE.BoxGeometry(0.16, 0.08, 0.1), charMat(0x8a6a1a, 0.6), 0, 0.04, 0);
      add(new THREE.BoxGeometry(0.162, 0.03, 0.102), charMat(0x1a1a1a, 0.6), 0, 0.06, 0);
      break;
    case 'ammo_shotgun':
      add(new THREE.BoxGeometry(0.18, 0.1, 0.12), charMat(0x7a1a14, 0.6), 0, 0.05, 0);
      for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.015, 0.015, 0.07, 6), charMat(0xa02a1a, 0.5), -0.04 + i * 0.04, 0.12, 0);
      break;
    case 'pistol':
    case 'shotgun':
    case 'pipe': {
      const w = buildWeapon(id);
      w.rotation.set(0, 0, Math.PI / 2);
      w.position.y = 0.04;
      g.add(w);
      break;
    }
    case 'chem':
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 10), new THREE.MeshStandardMaterial({ color: 0x2a5a9a, emissive: 0x10305a, roughness: 0.1 }), 0, 0.09, 0);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), 'plasticDark', 0, 0.2, 0);
      break;
    case 'medicine':
    case 'firstaid':
      add(new THREE.BoxGeometry(0.22, 0.1, 0.16), 'paintWhite', 0, 0.05, 0);
      add(new THREE.BoxGeometry(0.06, 0.002, 0.02), emissive(0xc01010, 0.5), 0, 0.101, 0);
      add(new THREE.BoxGeometry(0.02, 0.002, 0.06), emissive(0xc01010, 0.5), 0, 0.101, 0);
      break;
    case 'bandage':
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12), 'fabricWhite', 0, 0.05, 0, Math.PI / 2);
      break;
    case 'gunpowder':
      add(new THREE.SphereGeometry(0.07, 8, 6), charMat(0x6a5a40, 0.9), 0, 0.06, 0).scale.set(1, 0.8, 1);
      break;
    case 'fuse':
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 10), 'paintWhite', 0, 0.03, 0, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.033, 0.033, 0.03, 10), 'chrome', 0.07, 0.03, 0, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.033, 0.033, 0.03, 10), 'chrome', -0.07, 0.03, 0, 0, 0, Math.PI / 2);
      break;
    case 'card_exit':
      add(new THREE.BoxGeometry(0.09, 0.004, 0.055), emissive(0x2a5aa0, 0.4), 0, 0.01, 0);
      break;
    case 'valve_wheel':
      add(new THREE.TorusGeometry(0.15, 0.025, 6, 16), 'paintRed', 0, 0.03, 0, Math.PI / 2);
      break;
    case 'valve_rod':
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), 'chrome', 0, 0.03, 0, 0, 0, Math.PI / 2);
      break;
    case 'sample_blue':
    case 'sample_amber':
    case 'sample_red': {
      const col = { sample_blue: 0x2a70ff, sample_amber: 0xffa020, sample_red: 0xff2020 }[id];
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2 }), 0, 0.07, 0);
      add(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 8), 'plasticDark', 0, 0.15, 0);
      break;
    }
    case 'pouch':
      add(new THREE.BoxGeometry(0.22, 0.12, 0.1), charMat(0x4a4030, 0.9, { tex: 'fabric' }), 0, 0.06, 0);
      break;
    case 'bolt_cutter':
      add(new THREE.BoxGeometry(0.06, 0.04, 0.7), 'metalDark', 0.04, 0.03, 0, 0, 0.08);
      add(new THREE.BoxGeometry(0.06, 0.04, 0.7), 'metalDark', -0.04, 0.03, 0, 0, -0.08);
      add(new THREE.BoxGeometry(0.07, 0.05, 0.2), 'paintRed', 0.06, 0.03, -0.3, 0, 0.08);
      add(new THREE.BoxGeometry(0.07, 0.05, 0.2), 'paintRed', -0.06, 0.03, -0.3, 0, -0.08);
      break;
    default:
      // chaves
      if (def.type === 'key') {
        add(new THREE.TorusGeometry(0.035, 0.01, 6, 12), 'chrome', -0.06, 0.012, 0, Math.PI / 2);
        add(new THREE.BoxGeometry(0.11, 0.012, 0.015), 'chrome', 0.03, 0.012, 0);
        add(new THREE.BoxGeometry(0.02, 0.012, 0.03), 'chrome', 0.075, 0.012, 0.015);
        add(new THREE.BoxGeometry(0.05, 0.004, 0.035), charMat(0x8a6a3a, 0.8), -0.1, 0.01, 0.03);
      } else add(new THREE.BoxGeometry(0.12, 0.08, 0.12), 'plastic', 0, 0.04, 0);
  }
  return g;
}

export { buildHumanoid, resetPose, paperTex };
