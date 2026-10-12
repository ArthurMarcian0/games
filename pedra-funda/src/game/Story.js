// Textos da história: documentos, gravações, fotografias e diálogos.
// A narrativa é montada aos poucos — nenhum documento explica tudo sozinho.

export const INTRO = [
  '12 de outubro.',
  'Há seis dias, a equipe de campo do Instituto Nacional de Vigilância Ambiental parou de responder.',
  'Última localização: Pedra Funda, uma cidade de mil e poucos habitantes no fundo de um vale de mineração abandonado.',
  'O pedido de resgate foi negado. "Surto respiratório sob controle", disseram.',
  'Eu coordenei aquela equipe por doze anos. Não ia ficar esperando.',
  'A barreira sanitária na entrada da cidade estava abandonada. O carro morreu quinhentos metros depois.',
];

export const DOCS = {
  aviso_barreira: {
    title: 'Aviso da barreira sanitária',
    kind: 'note',
    pages: [
      'PREFEITURA MUNICIPAL DE PEDRA FUNDA\nDELEGACIA DE POLÍCIA\n\nPor determinação conjunta da Vigilância Sanitária e desta Delegacia, fica PROIBIDA a saída de qualquer morador do perímetro urbano até segunda ordem.\n\nMotivo: surto de doença respiratória em investigação.\n\nQuem desobedecer será detido.\n\nDel. Aldo Bastos — 03/10',
      'Escrito à caneta, embaixo:\n\n"Detido pra onde, Bastos? A cadeia tá cheia de gente doente."',
    ],
  },
  cartaz_vacina: {
    title: 'Cartaz da campanha de imunização',
    kind: 'poster',
    pages: [
      'PEDRA FUNDA PROTEGIDA\nCampanha de Imunização\n\nVÉRTICE BIOTECNOLOGIA em parceria com a Prefeitura Municipal.\n\nDose única. Gratuita. OBRIGATÓRIA para todos os moradores.\nA partir de 28 de setembro, no Hospital São Lázaro.\n\nQuem comparecer nos primeiros dias recebe uma cesta básica.\n\n"Cuidar de você é o nosso compromisso."',
      'Letras miúdas no rodapé:\n\n"Estudo clínico autorizado sob o protocolo VB-CR/07. A participação implica concordância com os termos disponíveis na secretaria do hospital."',
    ],
  },
  recorte_jornal: {
    title: 'Recorte de jornal',
    kind: 'note',
    pages: [
      'GAZETA DO VALE — há dois anos\n\nVÉRTICE INAUGURA CENTRO DE PESQUISA NA VELHA MINA\n\nA empresa de biotecnologia Vértice reativou as galerias da antiga Mineradora Funda para instalar a "Estação Raiz", um centro de estudos sobre micro-organismos do subsolo.\n\nO prefeito comemorou: "São empregos e dinheiro para uma cidade que estava morrendo."\n\nA empresa não permitiu a entrada da imprensa nas instalações.',
    ],
  },
  caderno_joaquim: {
    title: 'Caderno do Joaquim',
    kind: 'note',
    pages: [
      'Caderno de contas do bar. As últimas páginas não têm contas.\n\n"Quem ainda atende a porta:\n— D. Cida (não atende desde o dia 6)\n— Os Ferreira (riscado)\n— Bento e Lu do posto (riscado)\n— Ana, casa 14 (ouvi ela chorando ontem)"\n\nEmbaixo, sublinhado duas vezes:\n"Bia — internada no São Lázaro desde o dia 2. Não deixam visitar. Vou buscar minha neta nem que seja a última coisa que eu faça."',
    ],
  },
  diario_ana: {
    title: 'Diário de Ana Moraes',
    kind: 'diary',
    pages: [
      '29/09 — O Zé tomou a vacina ontem, foi dos primeiros da fila. Disse que não doeu nada. O pessoal da Vértice deu até cesta básica pra quem foi cedo.\n\n01/10 — Zé com febre. Muita. Diz que sente o corpo "cheio de formiga". O Dr. Brandt mandou ficar em casa e beber água.\n\n03/10 — Fecharam a estrada. O Bastos está na saída da cidade com dois carros. Ninguém sai. Dizem que é pra nossa proteção.',
      '04/10 — O Zé não me reconheceu hoje de manhã. Ficou parado olhando pra geladeira por uma hora. Quando toquei no braço dele estava frio como pedra.\nLevaram ele pro São Lázaro de ambulância. Homens de macacão branco.\n\n06/10 — Fui ao hospital. Não me deixaram entrar. Tinha uma moça de cabelo curto, de fora, discutindo com os homens de branco no portão. Depois entrou num carro preto com eles. Saiu calma, como se tivesse combinado tudo.',
      '07/10 — Ouço coisas andando na rua de noite. Arrastando. Não abro a porta pra ninguém.\n\n08/10 — O Zé voltou.\nEstá na cozinha. Não sei como entrou. Acho que não está respirando.\nTranquei a porta do quarto.\nDeus me perdoe, eu não consigo abrir.',
    ],
  },
  bilhete_lu: {
    title: 'Bilhete na porta da oficina',
    kind: 'note',
    pages: [
      'Bento,\n\ntroquei o cadeado da oficina porque o moleque do Ferreira andou mexendo nas ferramentas.\n\nA senha é o ANO em que a gente abriu o posto.\n\nSe esquecer, olha pra cima, homem! Tá escrito na placa bem na sua cara.\n\n— Lu',
    ],
  },
  foto_equipe: {
    title: 'Fotografia da equipe',
    kind: 'photo',
    pages: [
      'Uma fotografia amassada, entre os pertences apreendidos.\n\nA equipe do Instituto em frente à prefeitura de Pedra Funda, no primeiro dia: Caio com as maletas de coleta, Renata rindo de alguma coisa, Otávio encostado no carro.\n\nMarina está no centro. É a única que não sorri.',
      'No verso, com a letra dela:\n\n"Obrigada por ficar na base desta vez, Tomás. Acredite: é melhor assim."',
    ],
  },
  escala_plantao: {
    title: 'Escala de plantão',
    kind: 'note',
    pages: [
      'DELEGACIA DE PEDRA FUNDA — ESCALA DE PLANTÃO — OUTUBRO\n\nDel. A. Bastos ........ Distintivo nº 0001\nCb. Figueiredo ........ Distintivo nº 1156 — diurno\nSd. Prado ................ Distintivo nº 3809 — diurno\nSd. Ramos ............... Distintivo nº 4471 — noturno\nSd. Teles ................. Distintivo nº 2938 — noturno\n\nRabiscado a caneta:\n"Prado — afastado (febre)\nFigueiredo — NÃO VOLTOU"',
    ],
  },
  memo_arsenal: {
    title: 'Memorando interno',
    kind: 'note',
    pages: [
      'MEMORANDO INTERNO — 02/10\n\nApós o incidente com o armário de munições, o código do ARSENAL foi alterado.\n\nNovo código: os dois últimos dígitos do distintivo do Sd. Ramos, seguidos dos dois últimos dígitos do distintivo do Sd. Teles.\n\nDecorem e destruam este papel.\n\n— Del. Bastos',
    ],
  },
  fita_caio: {
    title: 'Gravação — Caio Menezes',
    kind: 'tape',
    pages: [
      '[Gravação — Caio Menezes, técnico de campo do INVA]\n\n"Dia 7... acho que é dia 7. Estou na cela três da delegacia. O delegado me trancou aqui \'para a minha segurança\'.\n\nA Marina saiu ontem com o pessoal da Vértice. Disse que ia resolver, que conhecia gente da diretoria. Nunca vi ela tão calma. Calma demais.\n\nA Renata foi para o hospital atender os doentes, contra tudo o que a gente combinou. O Otávio pegou o carro para buscar ajuda e não voltou."',
      '"Tomás, se você ouvir isto: as amostras de água que eu colhi no córrego da mina não têm nada de vírus respiratório. Tem material genético sintético. Sequências marcadas, numeradas. Isso não é um surto. Alguém fez isso.\n\n[barulho de grades]\n\n...ele está vindo. O delegado. Ele não está bem, Tomás. A pele dele... o braço dele..."\n\n[fim da gravação]',
    ],
  },
  memo_vertice: {
    title: 'Ofício confidencial da Vértice',
    kind: 'report',
    pages: [
      'VÉRTICE BIOTECNOLOGIA — DIRETORIA DE SEGURANÇA\nCONFIDENCIAL\n\nAo Del. Aldo Bastos\n\nConforme acordado, a Vértice arcará com a reforma da delegacia e com a quantia combinada, depositada em sua conta pessoal.\n\nEm contrapartida, solicitamos:\n1. Manutenção da barreira sanitária por tempo indeterminado.\n2. Nenhum morador deve deixar o perímetro.\n3. Agentes externos (imprensa, órgãos federais) devem ser detidos e entregues à nossa equipe.\n4. Sintomáticos devem ser encaminhados à ala de isolamento do Hospital São Lázaro.',
      'Lembramos que o senhor também recebeu a dose de reforço. Mantenha-se disponível para as aplicações seguintes.\n\n— R. Teixeira\nDiretor de Segurança\n\nCópia: Coordenação de Campo (M.L.)',
    ],
  },
  diario_bastos: {
    title: 'Diário do Delegado Bastos',
    kind: 'diary',
    pages: [
      '05/10 — A febre não passa. O tal "reforço" da Vértice me deixou pior. Meu braço esquerdo incha à noite. Parece que tem alguma coisa crescendo por baixo do osso.\n\n06/10 — A doutora de fora, a Lacerda, veio com o Teixeira. Ela já sabia de tudo. O nome da cepa, o cronograma. Me olhou como quem olha um rato de laboratório.\n\n07/10 — Prendi o técnico dela. Ele ouviu demais. A Lacerda pediu para não machucar o rapaz. Disse que ele "seria útil na fase dois".',
      '08/10 — Matei o Ramos. Ele me olhou estranho e eu... não lembro direito. Tem sangue no meu uniforme que não é meu.\n\n09/10 — Minha cabeça. Tudo é barulho. Vou ficar na garagem. Longe das pessoas.\nLonge da fome.\n\n10/10 — o escudo cresce',
    ],
  },
  ficha_vigia: {
    title: 'Ficha técnica — Unidade V-1',
    kind: 'report',
    pages: [
      'VÉRTICE — ESTAÇÃO RAIZ\nFICHA TÉCNICA (cópia entregue às autoridades locais)\n\nUNIDADE DE CONTENÇÃO V-1\nDesignação informal: "VIGIA"\n\nFunção: recuperação de amostras e eliminação de vetores fora do perímetro.\n\nResistência: extrema. Munição convencional provoca apenas incapacitação temporária.\n\nComportamento: persegue o alvo designado de forma contínua, inclusive através de portas e paredes leves.',
      'Limitação conhecida: fotossensibilidade. A unidade evita ambientes fechados com iluminação incandescente contínua.\n\nINSTRUÇÃO ÀS AUTORIDADES: caso avistem a unidade, NÃO INTERFIRAM. Afastem-se e permaneçam em local iluminado.',
    ],
  },
  bilhete_joaquim: {
    title: 'Bilhete do Joaquim',
    kind: 'note',
    pages: [
      'Moço da delegacia,\n\nse você voltar e eu não estiver: fui buscar a Bia no São Lázaro. Não aguento mais esperar.\n\nDeixei uns cartuchos no armário pra você. Usa melhor do que eu.\n\nSe Deus quiser a gente se vê.\n\n— Joaquim',
    ],
  },
  nota_gerador: {
    title: 'Bilhete do eletricista',
    kind: 'note',
    pages: [
      'MANUTENÇÃO — GERADOR DE EMERGÊNCIA (subsolo)\n\nTirei os três fusíveis principais pra evitar sobrecarga depois da queda de energia:\n• 1 ficou aqui na recepção (gaveta);\n• 1 guardei na farmácia;\n• 1 está comigo — vou levar pra sala do gerador.\n\nATENÇÃO: o gerador auxiliar suporta no MÁXIMO 10 unidades de carga. Passou disso, desarma tudo.\nPrioridade em emergência: PORTAS DE SEGURANÇA.\nO elevador está quebrado, nem adianta ligar.\n\n— Valdo, eletricista',
    ],
  },
  prontuario_moraes: {
    title: 'Prontuário — José Moraes',
    kind: 'report',
    pages: [
      'HOSPITAL SÃO LÁZARO — PRONTUÁRIO\n\nPaciente: José Moraes, 52 anos.\nVacinado em 28/09 (lote CR-I/001).\n\n29/09 — febre 39,8 °C.\n01/10 — parestesia generalizada.\n03/10 — hipotermia severa. Frequência cardíaca: 12 bpm (!). Paciente de pé, olhos abertos, não responde a estímulos verbais.\n04/10 — transferido para o isolamento por ordem da Vértice.',
      'Observação manuscrita (Dr. Brandt):\n\n"O lote CR-I NÃO é vacina. Não há antígeno nenhum nessa formulação. Exijo explicações da Vértice ou levo isto à Secretaria de Saúde."',
    ],
  },
  desenho_bia: {
    title: 'Desenho infantil',
    kind: 'photo',
    pages: [
      'Um desenho em giz de cera, colado na parede da ala pediátrica.\n\nUma moça de branco segura um coelho de pelúcia. Ao lado, uma menina de tranças e um homem de bigode atrás de um balcão.\n\nEmbaixo, em letras tortas:\n\n"A TIA ENFERMEIRA ESCONDEU A CHAVE DOS REMÉDIOS DENTRO DO SR. COELHO PRA NINGUÉM PEGAR. SÓ EU SEI. — BIA"',
    ],
  },
  registro_necroterio: {
    title: 'Registro do necrotério',
    kind: 'note',
    pages: [
      'REGISTRO DO NECROTÉRIO — S. Nonato\n\n02/10 — Gaveta A-1: Maria das Dores, 81 anos. Parada cardíaca.\n04/10 — Gaveta B-2: indigente. Chegou com marcas de mordida. Deixei bem trancado.\n05/10 — Gaveta C-3: Valdo, o eletricista. Morreu na escada do gerador. Ainda segurava um fusível na mão, coitado. Não tive coragem de tirar. Deixei com ele.',
      '06/10 — A-2, B-1, C-1: vazias. Não chegam mais corpos. Estão levando todo mundo direto para a ala de isolamento. A Vértice diz que precisa deles "intactos".\n\n07/10 — Ouvi batidas dentro da B-2.',
    ],
  },
  relatorio_brandt: {
    title: 'Relatório do Dr. Brandt',
    kind: 'report',
    pages: [
      'Dr. Aurélio Brandt — anotações pessoais\n\nEles chamam de Cepa Raiz. Três estágios: I — incubação (a "vacina"); II — transmissão; III — colheita.\n\nNão estão tratando ninguém. Estão cultivando.\n\nA ala de isolamento virou um viveiro. Os pacientes estão se fundindo uns aos outros numa só massa. Ela reage a luz e a som. Tem nódulos que pulsam nas paredes — parecem alimentar o centro.',
      'Selei a ala com as portas de segurança e fiquei com o cartão de serviço. Sem ele, ninguém sai pelos fundos do hospital.\n\nVou voltar lá uma última vez para coletar provas.\n\nSe eu não voltar: a entrada da Estação Raiz fica na velha mina, depois da floresta. Que alguém leve isto à imprensa.',
    ],
  },
  diario_abilio: {
    title: 'Diário de caça do Abílio',
    kind: 'diary',
    pages: [
      'Faz trinta anos que caço nessa mata. Nunca vi bicho assim.\n\nGrande como um cavalo, branco como leite, sem olho nenhum na cara. Os chifres parecem raiz de árvore arrancada.\n\nEle não me vê — ele me OUVE. Quando corri, veio direto em cima. Quando fiquei parado, passou do meu lado e farejou o ar. Andando devagar, ele não acha a gente. Quando dá com a cabeça numa árvore fica tonto um tempão.',
      'Os homens de branco trouxeram ele num caminhão, junto com uns cachorros pelados. Soltaram tudo perto da clareira da mina.\n\nVi um deles abrir a porta de ferro da mina girando uns discos com desenhos. Anotei o que deu pra ver de longe:\nO PRIMEIRO disco era uma LUA.\nO ÚLTIMO era uma RAIZ.\nOs do meio não consegui ver.\n\nP.S.: guardei o melhor da minha munição atrás da estante. Se eu não voltar, é de quem achar.',
    ],
  },
  cracha_vertice: {
    title: 'Crachá e lembrete',
    kind: 'note',
    pages: [
      'Um crachá da Vértice Biotecnologia — "P. Gouveia, técnico de campo" — preso com clipe a um papel dobrado:\n\n"Lembrete (não conta pra segurança):\nporta da mina — os dois discos do meio são o OLHO e a SERPENTE.\nO olho sempre antes. Ele vigia a serpente."',
    ],
  },
  ordem_transporte: {
    title: 'Ordem de transporte',
    kind: 'report',
    pages: [
      'VÉRTICE — ORDEM DE TRANSPORTE Nº 0447\n\nCarga:\n— 1 espécime CR-III (cervídeo, apelido "Pálido")\n— 6 espécimes CR-II (canídeos)\n\nDestino: clareira da mina.\nFinalidade: soltura controlada para teste de dispersão em ambiente aberto.\n\nAutorizado por: M. Lacerda — Coordenação de Campo',
    ],
  },
  manual_dreno: {
    title: 'Aviso de manutenção',
    kind: 'note',
    pages: [
      'ESTAÇÃO RAIZ — MANUTENÇÃO\n\nEm caso de inundação do túnel norte: o registro de dreno fica na câmara de junção (parede oeste).\n\nO VOLANTE do registro foi retirado para evitar manobras indevidas e está guardado na sala de ferramentas. A HASTE ficou com a equipe de segurança.\n\nATENÇÃO: há cabos de alta tensão caídos na água. NÃO entre no túnel inundado antes de drenar.',
    ],
  },
  log_guarda: {
    title: 'Registro do vigilante',
    kind: 'diary',
    pages: [
      'Registro do vigilante — turno 3\n\nDia 9 — Mandaram evacuar a Estação. Só ficaram os cientistas da fase dois e a doutora nova.\n\nDia 10 — Os cachorros soltos lá em cima estão descendo pela mina. Fechei a porta de ferro.\n\nDia 11 — Ouvi o V-1 andando nos túneis de manutenção. Ele não devia estar ativo. A doutora diz que ele "está procurando alguém específico".\n\nDia 12 — Será que o alguém sou eu?',
    ],
  },
  quadro_estagios: {
    title: 'Quadro branco',
    kind: 'note',
    pages: [
      'CICLO DA CEPA RAIZ (CR)\n\nI — AZUL — incubação (aplicação via "vacina")\nII — ÂMBAR — transmissão (vetores: água, mordida)\nIII — VERMELHO — colheita (fusão / maturação)\n\nACESSO AO LABORATÓRIO CENTRAL:\ninserir as amostras-padrão na ordem do ciclo.\n\n(alguém desenhou uma carinha sorridente ao lado do "III")',
    ],
  },
  relatorio_colheita: {
    title: 'Relatório final — Protocolo Colheita',
    kind: 'report',
    pages: [
      'VÉRTICE BIOTECNOLOGIA — ESTRITAMENTE CONFIDENCIAL\nRELATÓRIO FINAL — PROTOCOLO COLHEITA (Fase 1)\n\nPopulação-alvo: Pedra Funda (1.214 habitantes).\nAplicações do lote CR-I ("campanha de imunização"): 1.190.\nTaxa de conversão para o estágio II: 97,3%.\nEstágio III (colheita) obtido em ambiente hospitalar controlado.',
      'Nota da coordenação:\n\nA "ruptura acidental do confinamento" na Estação Raiz foi encenada em 05/10, para servir de justificativa pública caso houvesse vazamento de informações.\n\nA liberação foi intencional e realizada em 28/09, sob o pretexto de vacinação.\n\nNada aqui foi acidente.',
    ],
  },
  email_lacerda: {
    title: 'Terminal — mensagem enviada',
    kind: 'terminal',
    pages: [
      'DE: M. Lacerda\nPARA: Conselho Diretor — Vértice\nASSUNTO: Protocolo COLHEITA — Fase 1 concluída\n\nA liberação em Pedra Funda transcorreu como planejado. A cidade foi escolhida pelo isolamento geográfico, pela baixa visibilidade e pela facilidade de controlar a narrativa ("surto respiratório").\n\nMinha equipe do INVA cumpriu o seu papel: legitimou a investigação, e ninguém questionou a presença de um órgão federal.',
      'Menezes e Sales precisarão ser reavaliados. Ouviram demais.\n\nO coordenador Varela permanece fora da zona. Recomendo mantê-lo assim. Ele não entenderia.\n\nA Fase 2 começa no Nível 4.\n\n— M.',
    ],
  },
};

export const KIND_LABEL = {
  note: 'Documento',
  diary: 'Diário',
  tape: 'Gravação',
  photo: 'Fotografia',
  poster: 'Cartaz',
  report: 'Relatório',
  terminal: 'Terminal',
};

// ------------------------------------------------------------------ diálogos
export const DIALOGS = {
  joaquim_first: [
    { who: 'Homem', text: 'Parado aí! ...Você não é daqui. Não está doente? Mostra as mãos.' },
    { who: 'Tomás', text: 'Calma. Meu nome é Tomás Varela. Sou do Instituto de Vigilância Ambiental. Minha equipe está nesta cidade há duas semanas e parou de responder.' },
    { who: 'Homem', text: 'Equipe... A moça de cabelo curto? E o rapaz magrinho cheio de maletas?' },
    { who: 'Tomás', text: 'Marina e Caio. Você os viu?' },
    { who: 'Joaquim', text: 'O rapaz o Bastos levou preso pra delegacia. Já a moça... andava pra cima e pra baixo com o pessoal da Vértice. Os da vacina.' },
    { who: 'Joaquim', text: 'Faz nove dias que fecharam a cidade. Primeiro a vacina, depois a febre, depois... isso que anda na rua. Minha neta está internada no São Lázaro desde o dia dois. Não deixam ninguém ver.' },
    { who: 'Tomás', text: 'Preciso chegar à delegacia.' },
    { who: 'Joaquim', text: 'O portão de lá está acorrentado. O Bento, do posto, tinha um alicate grande na oficina. Fica do lado do posto, rua acima, à esquerda.' },
    { who: 'Joaquim', text: 'Aqui dentro é seguro. Deixo a luz acesa a noite inteira — essas coisas não gostam de luz. Pode descansar, gravar o seu diário e guardar o que quiser naquele armário.' },
    { who: 'Joaquim', text: 'E leva isso. A Lu plantava essas ervas em todos os vasos da rua. Serve pra machucado.' },
  ],
  joaquim_hint_cutter: [{ who: 'Joaquim', text: 'A oficina do Bento fica junto do posto. A Lu vivia trocando a senha do cadeado... coisa de data, sempre.' }],
  joaquim_hint_police: [{ who: 'Joaquim', text: 'Conseguiu o alicate? Então vai. A delegacia é no fim da rua, depois da praça. Cuidado com o Bastos — se ainda for o Bastos.' }],
  joaquim_hint_generic: [{ who: 'Joaquim', text: 'Fica um pouco. Ninguém aguenta muito tempo lá fora sozinho.' }],
  renata_door: [
    { who: 'Voz', text: 'Quem está aí?! Vai embora!' },
    { who: 'Tomás', text: 'Renata? Sou eu. Tomás.' },
    { who: 'Renata', text: 'Tomás?! Meu Deus... Espera. Espera, vou abrir.' },
  ],
  renata_first: [
    { who: 'Renata', text: 'Você não devia estar aqui. Ninguém devia.' },
    { who: 'Tomás', text: 'Encontrei o Caio. Na delegacia. Ele... não sobreviveu.' },
    { who: 'Renata', text: '...Eu sabia. No fundo, eu sabia.' },
    { who: 'Renata', text: 'Tomás, a Marina sabia de tudo desde o começo. Ela trouxe a gente pra cá pra dar cara de investigação oficial. Eu vi ela dando ordens aos homens da Vértice. Vi ela assinar a transferência dos pacientes para o isolamento.' },
    { who: 'Tomás', text: 'Não. A Marina não faria isso.' },
    { who: 'Renata', text: 'A Marina que a gente conhecia, talvez não.' },
    { who: 'Renata', text: 'O Dr. Brandt descobriu o que era a tal vacina e selou a ala de isolamento. Ele levou o cartão de serviço — é o único jeito de sair pelos fundos, para a floresta. A entrada da instalação deles fica na velha mina.' },
    { who: 'Renata', text: 'Mas a energia caiu. As portas de segurança só destravam com o gerador do subsolo funcionando, e o eletricista tirou os fusíveis. Tem um bilhete dele na recepção.' },
    { who: 'Renata', text: 'Eu fico aqui. Este gabinete tem luz, e aquelas coisas não entram onde tem luz. Pode usar o gravador e o armário.' },
    { who: 'Renata', text: 'Mais uma coisa. Tem algo enorme andando pelos corredores. Alto, de máscara. Ele não morre, Tomás. Se você o vir... corra.' },
  ],
  renata_hint_fuses: [{ who: 'Renata', text: 'O gerador fica no subsolo, pela escada no fim do corredor norte. Você vai precisar dos três fusíveis.' }],
  renata_hint_power: [{ who: 'Renata', text: 'Com a energia de volta, a ala de isolamento destravou. O cartão do Brandt deve estar lá dentro. Com ele.' }],
  renata_hint_exit: [{ who: 'Renata', text: 'A saída de serviço fica no extremo leste do corredor norte. Vai, Tomás. Não olha para trás.' }],
  renata_generic: [{ who: 'Renata', text: 'Descansa um pouco. Você está péssimo.' }],
};

// mensagens de rádio (não bloqueiam o jogo)
export const RADIO = {
  intro: [{ who: 'Rádio', text: '...chhh... ...ninguém... ...chhh...' }],
  renata_call: [
    { who: 'Rádio — voz feminina', text: '...alguém na escuta? Aqui é Renata Sales, da equipe do INVA...' },
    { who: 'Rádio — Renata', text: 'Estou no Hospital São Lázaro, no gabinete do diretor... a vacina não é... chhh... não deixem ninguém tomar... chhh...' },
  ],
  power_on: [
    { who: 'Rádio — Renata', text: 'Tomás! As luzes voltaram! As portas de segurança da ala de isolamento destravaram.' },
    { who: 'Rádio — Renata', text: 'Cuidado lá dentro. O Brandt nunca saiu de lá.' },
  ],
  chase: [{ who: 'Rádio — Renata', text: 'Ele está aí! CORRE, Tomás! O corredor norte desabou — dá a volta pelo saguão e pelo raio-x!' }],
  forest: [
    { who: 'Rádio — Renata', text: '...Tomás? Você conseguiu sair? Siga a trilha para o norte. Tem a cabana de um caçador no caminho...' },
    { who: 'Rádio — Renata', text: '...e o portão velho a oeste dá de volta na cidade... chhh...' },
  ],
  tunnels: [{ who: 'Rádio — ???', text: '...sim, ele passou da floresta. ...Não. Deixem ele vir. Eu quero ver.' }],
  lab_marina: [
    { who: 'Rádio — Marina', text: 'Olá, Tomás. Eu pedi que você ficasse na base. Você nunca me escuta.' },
    { who: 'Tomás', text: 'Marina... Por quê?' },
    { who: 'Rádio — Marina', text: 'Porque alguém ia fazer isso, mais cedo ou mais tarde. Melhor que fosse alguém que sabe o que está fazendo.' },
    { who: 'Rádio — Marina', text: 'O V-1 vai te trazer até mim. Não resista. Desça até o Nível 4.' },
  ],
};

export const AREA_NAMES = {
  town: 'Pedra Funda — Rua Principal',
  police: 'Delegacia de Pedra Funda',
  hospital: 'Hospital São Lázaro — Térreo',
  hospital_sub: 'Hospital São Lázaro — Subsolo',
  forest: 'Mata da Funda',
  tunnels: 'Galerias da Mina',
  lab: 'Estação Raiz',
};

export const ENDING = [
  'O elevador desce por um tempo que parece não acabar.',
  'Tudo o que eu sabia sobre a Marina cabia numa fotografia amassada.',
  'Mil cento e noventa pessoas. Uma cidade inteira usada como placa de Petri.',
  'Lá embaixo, uma luz verde acende no painel: NÍVEL 4.',
  'Seja lá o que me espera, eu vou levar a verdade para fora deste vale.',
];
