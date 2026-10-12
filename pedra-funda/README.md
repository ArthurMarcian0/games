# Pedra Funda — Parte I: Quarentena

Survival horror 3D em terceira pessoa, jogável no navegador, feito com
**Three.js** e JavaScript puro (módulos ES, sem etapa de build). Toda a
geometria, as texturas, a música e os efeitos sonoros são **gerados por código**
em tempo real — não há arquivos de imagem ou áudio.

> 12 de outubro. Há seis dias, a equipe de campo do Instituto Nacional de
> Vigilância Ambiental parou de responder. Última localização: Pedra Funda, uma
> cidade no fundo de um vale de mineração abandonado. Tomás Varela, coordenador
> da equipe, vai atrás deles durante uma tempestade.

Campanha de aproximadamente 40–60 minutos, com seis áreas conectadas, três
chefes, um perseguidor indestrutível, enigmas ambientais e um final com gancho
para a Parte II.

## Como rodar

O jogo usa módulos ES, então precisa ser servido por HTTP:

```bash
# a partir da raiz do repositório
npm start                      # node server.mjs 8080
# ou: python3 -m http.server 8080
```

Abra <http://localhost:8080/pedra-funda/>. Funciona offline (o Three.js está em
`../lib/three/`). Recomendado: navegador baseado em Chromium ou Firefox recente,
GPU dedicada ou integrada moderna, **fones de ouvido**.

## Controles

| Ação | Tecla |
| --- | --- |
| Mover | W A S D |
| Câmera | Mouse |
| Correr (gasta stamina) | Shift |
| Mirar | Botão direito (segurar) ou C |
| Atirar / golpear | Botão esquerdo (mirando) |
| Recarregar | R |
| Interagir / examinar / abrir | E |
| Virada rápida (180°) | Q |
| Lanterna | F |
| Trocar arma | 1 · 2 · 3 |
| Cura rápida | H |
| Inventário / Arquivos / Mapa | Tab (ou I) · M |
| Soltar-se de um agarrão | E / Espaço repetidamente |
| Pausar | Esc ou P |

No inventário: setas/WASD navegam, **E/Enter** abre as ações do item
(Usar, Equipar, Combinar, Recarregar, Examinar, Descartar).

## Estrutura da campanha

```
CIDADE (rua principal, bar seguro, Casa 14, oficina do posto, praça)
  ↓  alicate de corte → portão da delegacia
DELEGACIA (celas, arquivo, arsenal, gabinete)          chefe: O CARCEREIRO
  ↓  chave do portão leste  ·  atalho: garagem → praça
HOSPITAL SÃO LÁZARO — térreo e subsolo                 chefe: A NINHADA
  ↓  fusíveis → gerador → painel elétrico → ala de isolamento
  ↓  PERSEGUIÇÃO DO VIGIA pelos corredores
MATA DA FUNDA (trilhas, cabana do caçador, caminhão)   chefe: O CERVO PÁLIDO
  ↓  atalho: portão da mata → cidade  ·  discos de símbolos da mina
GALERIAS DA MINA (túnel inundado e eletrificado)
  ↓  volante + haste = válvula → dreno
ESTAÇÃO RAIZ — laboratório (amostras, terminal, elevador)  → FINAL / gancho
```

### Enigmas (todas as pistas estão no cenário)

- **Cadeado da oficina** — o bilhete da Lu diz que a senha é o ano de abertura
  do posto, "escrito na placa": o letreiro da cobertura.
- **Arsenal da delegacia** — o memorando explica a regra; o quadro de escala
  mostra os distintivos.
- **Chave da farmácia** — o desenho da Bia na ala pediátrica revela onde a
  enfermeira escondeu a chave.
- **Fusíveis** — o bilhete do eletricista diz onde estão os três; o registro do
  necrotério aponta a gaveta certa (e avisa sobre a gaveta errada).
- **Painel elétrico** — distribuir a carga do gerador sem passar de 10 unidades
  e mantendo as portas de segurança ligadas (as luzes são opcionais e mudam o
  clima do hospital).
- **Passagem secreta** — o diário do caçador menciona a munição "atrás da
  estante".
- **Discos da mina** — o diário do caçador e o crachá escondido completam a
  sequência de quatro símbolos.
- **Válvula do dreno** — combinar volante + haste no inventário.
- **Laboratório central** — o quadro branco mostra a ordem do ciclo das
  amostras.

### Criaturas

- **Errante** — humano infectado. Lento, mas agarra e morde de perto. Às vezes
  finge estar morto. Tiros na cabeça fazem estragos; tiros nas pernas derrubam.
- **Rastejante** — animal contaminado, rápido e baixo. Rodeia e dá botes.
- **Vigia (V-1)** — perseguidor alto, de máscara de gás. Não morre: tiros só o
  fazem cambalear ou ajoelhar por alguns segundos. Arromba portas. Não entra em
  áreas iluminadas seguras.
- **O Carcereiro** — o delegado deformado; escudo de osso bloqueia tiros
  frontais. Faça-o investir contra paredes/pilares e atire nas pústulas das
  costas; barris explosivos ajudam.
- **A Ninhada** — massa de pacientes fundidos no teto do isolamento. Destrua os
  três nódulos nas paredes para expor o núcleo. Evite os tentáculos (círculo
  vermelho) e o ácido.
- **O Cervo Pálido** — cego, caça pelo som. Correr e atirar o atraem; batendo
  em rochas e árvores fica atordoado. Mire nos sacos luminosos.

### Sistemas

- Inventário limitado por espaços (8, +2 com a bolsa), itens empilháveis,
  combinações (erva+erva, erva+reagente, pólvora+pólvora, volante+haste).
- Vida em faixas (Bem / Cuidado / Perigo) com eletrocardiograma, stamina,
  agarrões, quedas, mancar e lanterna falhando quando ferido.
- Pistola, espingarda (dispersão e queda com a distância) e cano de ferro (arma
  de emergência que quebra). Mira com dispersão que se estabiliza, recuo.
- Percepção dos inimigos por visão (lanterna ligada aumenta o alcance) e por
  **som** (passos correndo, tiros, portas). Navegação por A* em grade.
- Rádio no peito que chia perto de criaturas e recebe transmissões.
- Pontos seguros (luz quente, música própria, inimigos não entram) com
  gravador para salvar em 3 registros e armário compartilhado.
- Mapa de cada área com salas visitadas, portas trancadas/abertas e visão geral
  da região; arquivo de documentos, gravações e fotografias (24 no total).
- Dificuldade Fácil / Normal / Difícil (dano, resistência e munição).

## Estrutura do código

```
pedra-funda/
  index.html, css/style.css
  src/
    main.js
    core/      Game (estados, transições, salvamento), Input, Settings, Save, utils
    engine/    Renderer (pós-processamento: bloom, grão, vinheta, aberração,
               tone mapping), textures (procedurais com normal/roughness maps),
               materials, Collision (colisão 2D + grade A*), Effects (partículas,
               decalques, chuva, névoa rasteira, relâmpagos)
    audio/     Audio (síntese Web Audio: ambiências, efeitos posicionais HRTF,
               reverb por área, rádio, respiração, batimentos, trilha adaptativa)
    entities/  Rig (esqueletos procedurais e animação), Player, Camera
    enemies/   Enemy (base, Errante, Rastejante, Vigia), Bosses
    world/     World (portas, itens, gatilhos, perigos, tiros, ruído), Level
               (salas com paredes automáticas, geometria mesclada), Props,
               maps/ (kit + uma área por arquivo)
    game/      Items (itens, armas, receitas), Inventory, Story (textos)
    ui/        HUD, UI (menus, inventário, mapa, documentos, enigmas), icons
```

`?debug=1` na URL mostra FPS/posição e expõe o jogo em `window.__pf`.
