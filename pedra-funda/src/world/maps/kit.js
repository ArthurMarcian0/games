// Ferramentas de alto nível usadas pelos mapas.
import * as THREE from 'three';
import * as P from '../Props.js';
import { buildHumanoid, resetPose } from '../../entities/Rig.js';
import { charMat, emissive, getMaterial } from '../../engine/materials.js';
import { DOCS } from '../../game/Story.js';
import { rand } from '../../core/utils.js';

export const LOOK = {
  joaquim: { height: 1.72, skin: 0xb08a70, shirt: 0x6a5a48, pants: 0x3a3428, hair: 0xd8d4cc, beard: 0xc8c4bc, bulk: 1.1 },
  renata: { height: 1.66, skin: 0x9a7058, shirt: 0xd8d8d0, pants: 0x2a3040, hair: 0x15100c, bulk: 0.9, longHair: true },
  caio: { height: 1.76, skin: 0xd0a888, shirt: 0x3a5a6a, pants: 0x30302c, hair: 0x3a2818, bulk: 0.9 },
  cop: { height: 1.8, skin: 0xb08a70, shirt: 0x1f2a3e, pants: 0x161c28, hair: 0x1a1410, head: 'cap', capColor: 0x141c2a },
  doctor: { height: 1.74, skin: 0xc8a088, shirt: 0xd0d0c8, pants: 0x2a2a2a, hair: 0x8a8a88, bulk: 1 },
  worker: { height: 1.78, skin: 0xa07858, shirt: 0x3a4a6a, pants: 0x2a3040, hair: 0x1a1410 },
  hunter: { height: 1.75, skin: 0xa88068, shirt: 0x4a4a2a, pants: 0x3a3020, hair: 0x5a5048, beard: 0x5a5048 },
  guard: { height: 1.82, skin: 0xb89070, shirt: 0x202428, pants: 0x202428, hair: 0x101010 },
  woman: { height: 1.64, skin: 0xc8a088, shirt: 0x7a4a5a, pants: 0x3a3440, hair: 0x4a2a18, longHair: true, bulk: 0.9 },
};

export function makeKit(L, g, w) {
  const K = {
    L,
    g,
    w,
    P,
    light(def) {
      const rec = w.addLight(def);
      if (def.cone) P.lightCone(L, def.x, def.y ?? 2.6, def.z, def.cone.h, def.cone.r, def.color ?? 0xffd8a8, def.cone.o ?? 0.06);
      return rec;
    },
    item(id, item, x, z, opts = {}) {
      return w.addPickup({ id, item, x, z, ...opts });
    },
    enemy(def) {
      if (g.flag(`killed_${w.id}_${def.id}`)) return null;
      if (def.cond && !def.cond(g)) return null;
      return w.spawnEnemy(def);
    },
    doc(id, docId, x, z, opts = {}) {
      const y = opts.y ?? 0.8;
      const kind = DOCS[docId]?.kind;
      const model = opts.model ?? (kind === 'tape' ? 'tape' : kind === 'photo' ? 'photo' : 'paper');
      let mesh = null;
      if (model === 'paper' || model === 'photo') {
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(model === 'photo' ? 0.15 : 0.21, model === 'photo' ? 0.1 : 0.29), getMaterial('paper'));
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = rand(-0.5, 0.5);
        mesh.position.set(x, y + 0.006, z);
      } else if (model === 'wall') {
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(opts.w || 0.3, opts.h || 0.4), getMaterial('paper'));
        mesh.position.set(x, y, z);
        mesh.rotation.y = opts.ry || 0;
      } else if (model === 'tape') {
        mesh = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.1), charMat(0x1a1a1a, 0.5));
        body.position.y = 0.025;
        mesh.add(body);
        const lab = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.002, 0.06), charMat(0xc8c0a0, 0.8));
        lab.position.y = 0.051;
        mesh.add(lab);
        mesh.position.set(x, y, z);
      }
      if (mesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        L.scene.add(mesh);
      }
      const read = g.state.docs.includes(docId);
      const glint = !read && opts.glint !== false ? P.glowSprite(L, x, y + 0.12, z, 0.25, 0xfff0d0, 0.5) : null;
      w.addInteract({
        x,
        z,
        y,
        r: opts.r || 1.4,
        prompt: opts.prompt || (kind === 'tape' ? 'Ouvir gravação' : kind === 'photo' ? 'Ver fotografia' : 'Ler'),
        use: () => {
          if (glint) glint.visible = false;
          g.readDoc(docId);
          if (opts.onRead) opts.onRead(g);
        },
      });
      return mesh;
    },
    examine(x, z, text, opts = {}) {
      return w.addInteract({
        x,
        z,
        r: opts.r || 1.5,
        prompt: opts.prompt || 'Examinar',
        cond: opts.cond,
        use: () => {
          const t = typeof text === 'function' ? text(g) : text;
          if (t) g.ui.examine(Array.isArray(t) ? t : [t], opts.after ? () => opts.after(g) : null);
        },
      });
    },
    interact(def) {
      return w.addInteract(def);
    },
    trigger(def) {
      if (def.once !== false && def.persist !== false && g.flag(`trig_${w.id}_${def.id}`)) return null;
      const t = { ...def };
      w.triggers.push(t);
      return t;
    },
    onUpdate(fn) {
      w.updaters.push(fn);
    },
    onKill(fn) {
      w.killHooks.push(fn);
    },
    save(x, z, ry = 0) {
      P.savePointProps(L, x, z, ry);
      const lp = new THREE.Vector3(0.3, 1.0, -0.1).applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z));
      w.addLight({ x: lp.x, y: lp.y + 0.1, z: lp.z, color: 0xffc480, intensity: 5, distance: 6, decay: 1.6 });
      w.addInteract({ x, z, r: 1.6, prompt: 'Gravar diário (salvar)', use: () => g.openSave() });
    },
    storage(x, z, ry = 0) {
      P.storageBox(L, x, z, ry);
      w.addInteract({ x, z, r: 1.6, prompt: 'Abrir armário (baú)', use: () => g.openStorage() });
    },
    npc(def) {
      const rig = buildHumanoid(def.look);
      rig.root.position.set(def.x, 0, def.z);
      rig.root.rotation.y = def.ry || 0;
      L.scene.add(rig.root);
      const npc = {
        x: def.x,
        z: def.z,
        rig,
        t: rand(0, 5),
        update(dt) {
          this.t += dt;
          resetPose(rig);
          poseOf(rig, def.pose || 'stand', this.t);
          const p = g.player.pos;
          const dx = p.x - def.x;
          const dz = p.z - def.z;
          if (dx * dx + dz * dz < 25) {
            const a = Math.atan2(dx, dz) - (def.ry || 0);
            let aa = ((a + Math.PI) % (Math.PI * 2)) - Math.PI;
            if (aa < -Math.PI) aa += Math.PI * 2;
            rig.head.rotation.y = Math.max(-1, Math.min(1, aa)) * 0.8;
          }
        },
      };
      if (def.extras) def.extras(rig);
      w.npcs.push(npc);
      w.addInteract({ x: def.x, z: def.z, r: def.r || 2, prompt: def.prompt || 'Conversar', use: () => def.talk(g) });
      return npc;
    },
    corpse(x, z, ry = 0, opts = {}) {
      const rig = buildHumanoid(opts.look || LOOK.worker);
      rig.root.position.set(x, 0, z);
      rig.root.rotation.y = ry;
      resetPose(rig);
      poseOf(rig, opts.pose || 'dead', 0);
      L.scene.add(rig.root);
      if (opts.blood !== false) w.decals.add(x - Math.sin(ry) * 0.6, z - Math.cos(ry) * 0.6, opts.bloodSize || 1.6, 0);
      return rig;
    },
    barrel(x, z) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.92, 14), charMat(0x8a1a10, 0.5, { metal: 0.3 }));
      body.position.y = 0.46;
      body.castShadow = true;
      grp.add(body);
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.325, 0.325, 0.12, 14), charMat(0xc89a1a, 0.5));
      stripe.position.y = 0.6;
      grp.add(stripe);
      grp.position.set(x, 0, z);
      L.scene.add(grp);
      const box = w.collision.add(x - 0.32, z - 0.32, x + 0.32, z + 0.32, 0.92);
      const br = {
        x,
        z,
        alive: true,
        mesh: grp,
        explode() {
          if (!this.alive) return;
          this.alive = false;
          box.enabled = false;
          L.scene.remove(grp);
          w.explosion(x, z);
          w.decals.add(x, z, 2.2, 1);
        },
      };
      w.barrels.push(br);
      return br;
    },
    decal(x, z, s = 1.2, v = 0) {
      w.decals.add(x, z, s, v);
    },
    footprints(x0, z0, x1, z1, n = 10) {
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const side = i % 2 ? 0.15 : -0.15;
        const ang = Math.atan2(x1 - x0, z1 - z0);
        const px = x0 + (x1 - x0) * t + Math.cos(ang) * side;
        const pz = z0 + (z1 - z0) * t - Math.sin(ang) * side;
        w.decals.add(px, pz, 0.28, 1);
      }
    },
  };
  return K;
}

function poseOf(r, pose, t) {
  switch (pose) {
    case 'sit':
      r.hips.position.y = r.s * 0.5;
      r.lHip.rotation.x = -1.5;
      r.rHip.rotation.x = -1.5;
      r.lKnee.rotation.x = 1.5;
      r.rKnee.rotation.x = 1.5;
      r.spine.rotation.x = 0.1 + Math.sin(t * 1.2) * 0.02;
      r.lSh.rotation.x = -0.6;
      r.rSh.rotation.x = -0.7;
      r.lEl.rotation.x = -0.9;
      r.rEl.rotation.x = -0.8;
      break;
    case 'sitFloor':
      r.hips.position.y = r.s * 0.12;
      r.lHip.rotation.x = -1.4;
      r.rHip.rotation.x = -1.2;
      r.lKnee.rotation.x = 0.4;
      r.rKnee.rotation.x = 1.6;
      r.spine.rotation.x = -0.25;
      r.head.rotation.x = 0.6;
      r.head.rotation.z = 0.4;
      r.lSh.rotation.z = -0.2;
      r.rSh.rotation.x = -0.3;
      break;
    case 'dead':
      r.root.rotation.x = -Math.PI / 2;
      r.root.position.y = 0.12;
      r.lSh.rotation.x = -2.6;
      r.rSh.rotation.x = -0.4;
      r.rSh.rotation.z = 0.9;
      r.lKnee.rotation.x = 0.5;
      r.head.rotation.y = 0.7;
      break;
    case 'deadFace':
      r.root.rotation.x = Math.PI / 2;
      r.root.position.y = 0.14;
      r.lSh.rotation.x = -2.8;
      r.rSh.rotation.x = -0.3;
      r.rSh.rotation.z = -0.6;
      r.rKnee.rotation.x = 0.7;
      r.head.rotation.y = 1.2;
      break;
    case 'bed':
      r.root.rotation.x = -Math.PI / 2;
      r.root.position.y = 0.72;
      r.lSh.rotation.z = 0.2;
      r.rSh.rotation.z = -0.2;
      break;
    case 'desk':
      r.spine.rotation.x = 0.15;
      r.lSh.rotation.x = -0.8;
      r.rSh.rotation.x = -0.9;
      r.lEl.rotation.x = -0.6;
      r.rEl.rotation.x = -0.6;
      r.head.rotation.x = 0.3;
      break;
    default:
      r.chest.rotation.x = Math.sin(t * 1.4) * 0.02;
      r.lSh.rotation.z = -0.08;
      r.rSh.rotation.z = 0.08;
      r.lEl.rotation.x = -0.15;
      r.rEl.rotation.x = -0.2;
  }
}

export { P, emissive, charMat };
