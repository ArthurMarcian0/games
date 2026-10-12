// Definições de itens, armas e receitas de combinação.
export const ITEMS = {
  // armas
  pistol: { name: 'Pistola 9mm', type: 'weapon', weapon: 'pistol', desc: 'Pistola semiautomática de uso policial. Pente de 10 tiros. Precisa e confiável, mas pouco potente contra criaturas grandes.' },
  shotgun: { name: 'Espingarda calibre 12', type: 'weapon', weapon: 'shotgun', desc: 'Espingarda de repetição da delegacia. Devastadora de perto, inútil de longe. Carrega 5 cartuchos.' },
  pipe: { name: 'Cano de ferro', type: 'weapon', weapon: 'pipe', desc: 'Um cano enferrujado com fita isolante no cabo. Arma de emergência — vai entortar e quebrar depois de alguns golpes.' },
  // munição
  ammo_pistol: { name: 'Munição 9mm', type: 'ammo', ammoFor: 'pistol', stack: 40, desc: 'Balas 9mm. Cada uma conta.' },
  ammo_shotgun: { name: 'Cartuchos cal. 12', type: 'ammo', ammoFor: 'shotgun', stack: 12, desc: 'Cartuchos de chumbo grosso para a espingarda.' },
  gunpowder: { name: 'Pólvora', type: 'misc', stack: 3, desc: 'Um saquinho de pólvora de recarga, encontrado em kits de caça. Combinando duas, dá para montar munição 9mm.' },
  // cura
  herb: { name: 'Erva medicinal', type: 'heal', heal: 30, desc: 'Erva de folhas largas, cultivada em vasos por toda a cidade. Alivia ferimentos leves. Pode ser combinada.' },
  herb_mix: { name: 'Mistura de ervas', type: 'heal', heal: 65, desc: 'Duas ervas maceradas juntas. Mais eficaz e ocupa apenas um espaço.' },
  chem: { name: 'Reagente químico', type: 'misc', desc: 'Frasco de solução estabilizante da farmácia. Sozinho não serve para nada; potencializa ervas medicinais.' },
  medicine: { name: 'Medicamento concentrado', type: 'heal', heal: 100, desc: 'Erva tratada com reagente. Recupera todo o vigor e estanca qualquer sangramento.' },
  bandage: { name: 'Bandagem', type: 'heal', heal: 20, desc: 'Rolo de gaze. Fecha cortes pequenos.' },
  firstaid: { name: 'Kit de primeiros socorros', type: 'heal', heal: 60, desc: 'Kit hospitalar completo com antisséptico e sutura adesiva.' },
  // itens-chave
  bolt_cutter: { name: 'Alicate de corte', type: 'key', desc: 'Alicate de corte pesado da oficina do posto. Corta correntes e cadeados finos.' },
  key_chief: { name: 'Chave do Delegado', type: 'key', desc: 'Chave com etiqueta de couro: "GABINETE — BASTOS".' },
  key_eastgate: { name: 'Chave do Portão Leste', type: 'key', desc: 'Chave grande e antiga. Etiqueta: "Portão leste / acesso ao São Lázaro".' },
  key_pharmacy: { name: 'Chave da Farmácia', type: 'key', desc: 'Pequena chave de latão com um adesivo de cruz verde.' },
  fuse: { name: 'Fusível', type: 'key', stack: 3, desc: 'Fusível cerâmico de alta corrente, do tipo usado em geradores.' },
  card_exit: { name: 'Cartão de Serviço', type: 'key', desc: 'Cartão magnético do Dr. Aurélio Brandt. Abre as portas de serviço do hospital.' },
  valve_wheel: { name: 'Volante de válvula', type: 'key', desc: 'Um volante de ferro fundido sem eixo. Pintado de vermelho.' },
  valve_rod: { name: 'Haste roscada', type: 'key', desc: 'Haste metálica com rosca numa ponta e encaixe quadrado na outra.' },
  valve: { name: 'Válvula montada', type: 'key', desc: 'Volante encaixado na haste. Serve num registro de dreno.' },
  sample_blue: { name: 'Amostra azul', type: 'key', desc: 'Tubo de ensaio lacrado com líquido azul. Rótulo: "CR-I".' },
  sample_amber: { name: 'Amostra âmbar', type: 'key', desc: 'Tubo de ensaio lacrado com líquido âmbar. Rótulo: "CR-II".' },
  sample_red: { name: 'Amostra vermelha', type: 'key', desc: 'Tubo de ensaio lacrado com líquido vermelho-escuro. Rótulo: "CR-III". Está morno.' },
  pouch: { name: 'Bolsa de cintura', type: 'upgrade', desc: 'Bolsa de lona. Aumenta o inventário em 2 espaços.' },
};

// combinações (ordem não importa)
export const RECIPES = [
  { a: 'herb', b: 'herb', out: 'herb_mix', qty: 1 },
  { a: 'herb', b: 'chem', out: 'medicine', qty: 1 },
  { a: 'herb_mix', b: 'chem', out: 'medicine', qty: 1 },
  { a: 'gunpowder', b: 'gunpowder', out: 'ammo_pistol', qty: 12 },
  { a: 'valve_wheel', b: 'valve_rod', out: 'valve', qty: 1 },
];

export function findRecipe(a, b) {
  return RECIPES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

export const WEAPONS = {
  pistol: {
    name: 'Pistola 9mm',
    mag: 10,
    ammo: 'ammo_pistol',
    damage: 24,
    rate: 0.32,
    reload: 1.35,
    spreadMin: 0.006,
    spreadMax: 0.05,
    recoil: 0.035,
    range: 50,
    pellets: 1,
    noise: 22,
    stagger: 0.25,
    sound: 'pistol',
  },
  shotgun: {
    name: 'Espingarda',
    mag: 5,
    ammo: 'ammo_shotgun',
    damage: 15,
    rate: 1.0,
    reload: 0.55, // por cartucho
    perShell: true,
    spreadMin: 0.07,
    spreadMax: 0.1,
    recoil: 0.11,
    range: 18,
    pellets: 9,
    noise: 30,
    stagger: 1,
    sound: 'shotgun',
  },
  pipe: {
    name: 'Cano de ferro',
    melee: true,
    damage: 20,
    rate: 0.75,
    range: 1.9,
    durability: 28,
    noise: 6,
    stagger: 0.6,
  },
};
