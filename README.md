# SkyHoop Arena — Basquete 3D

Protótipo jogável de um jogo de basquete 3D estilizado, feito com **Three.js** e
JavaScript puro (módulos ES), sem etapa de build. Inclui partida completa contra a
IA (do salto inicial ao fim do jogo), treinamento, personalização de jogador,
física 3D da bola, áudio procedural e menus.

Todos os times, nomes, marcas e uniformes são fictícios.

## Como rodar

**Abra o `index.html` com duplo clique.** Ele é um único arquivo autocontido
(Three.js, estilos e código embutidos) que funciona offline, sem servidor.
Se o jogo não puder iniciar (por exemplo, WebGL desativado no navegador), a tela
de carregamento mostra o motivo e como resolver.

**Desenvolvimento:** o código-fonte fica em `dev.html` + `src/` (módulos ES), que
precisa ser servido por HTTP:

```bash
npm start            # ou: node server.mjs 8080   (Node 18+, sem dependências)
```

e abra <http://localhost:8080/dev.html>. Depois de alterar o código, regenere o
`index.html`:

```bash
npm install          # instala o esbuild (só para o build)
npm run build        # gera index.html a partir de dev.html + src/
```

## Controles

| Ação | Teclado | Controle |
| --- | --- | --- |
| Mover | W A S D / setas | Analógico esquerdo |
| Correr | Shift | RB / RT |
| Arremessar (segure e solte) | Espaço / K | A |
| Bandeja / enterrada | Espaço perto da cesta (correndo = enterrada) | A |
| Finta de arremesso | Toque rápido em Espaço | Toque em A |
| Passar (na direção do movimento) | E / J | X |
| Drible (varia com a direção, veja abaixo) | X / U | B |
| Giro (spin move) | V / O | L3 / R3 |
| Roubar a bola (defesa) | E / J | X |
| Pular / bloquear (defesa) | Espaço / C | A / LB |
| Trocar de jogador | Q / I | Y |
| Pausar | Esc / P | Start |
| Treino: defensor / lance livre / reposicionar | T / F / R | — |
| Mostrar/ocultar dicas | H | — |

**Barra de arremesso:** ao segurar o arremesso, a barra enche. Solte na faixa
verde para uma soltura **perfeita**; a faixa amarela é boa; fora dela o
arremesso sai curto ou longo. Distância, marcação, cansaço e atributos também
influenciam. A física da bola decide o resultado (aro, tabela, rede).

### Dribles

O drible feito com **X** depende da direção que você segura na hora:

| Drible | Como fazer | Efeito |
| --- | --- | --- |
| Crossover | X + lado (bola na outra mão) | troca de mão e corta para o lado |
| Por trás das costas | X + lado correndo (Shift) | troca de mão sem perder velocidade |
| Finta in-and-out | X + lado da mão que está com a bola | finge a troca e sai para o mesmo lado |
| Entre as pernas | X parado | troca de mão protegendo a bola |
| Hesitação | X + frente | freia e arranca mais rápido |
| Step-back | X + trás | salta para trás e abre espaço para o arremesso |
| Giro | V (+ lado) | gira de costas para o marcador; o que mais desequilibra |

Dribles feitos em sequência formam **combos** (mostrados na tela): cada drible
encadeado aumenta a chance de desequilibrar o marcador. Cada movimento também
protege a bola de forma diferente contra roubos e gasta um pouco de energia.
A IA usa os mesmos dribles (inclusive step-back seguido de arremesso).

## Campanha: Terra Arrasada

Depois do colapso, as gangues disputam as últimas quadras de pé. Você lidera os
**Errantes** e precisa dominar 8 quadras pós-apocalípticas, uma por vez:

| Fase | Quadra | Gangue | Formato | Regra especial |
| --- | --- | --- | --- | --- |
| 1 | Pátio do Ferro-Velho | Os Catadores | 2x2 | — |
| 2 | Viaduto Desabado | Ratos do Asfalto | 3x3 | — |
| 3 | Porto Enferrujado | Maré Negra | 3x3 | piso molhado (menos aderência) |
| 4 | Zona Química | Os Contaminados | 3x3 | ar tóxico (energia acaba mais rápido) |
| 5 | Cidade Cinza | Legião das Cinzas | 4x4 | — |
| 6 | Usina Fantasma | Os Faíscas | 4x4 | noite, só holofotes |
| 7 | Deserto de Vidro | Nômades da Tempestade | 5x5 | vento desvia a bola, areia no piso |
| 8 | A Cidadela | Os Soberanos | 5x5 | torcida hostil (arremessos menos precisos) |

- **Dificuldade crescente:** a IA adversária vai de "fácil" na primeira fase até
  um nível "elite" (acima do difícil) na última, e os atributos das gangues sobem
  a cada quadra. Seus companheiros também melhoram conforme você avança.
- **Estrelas:** vencer dá 1 estrela; vencer por 5+ pontos dá 2; por 10+, 3.
- **Recompensas:** a primeira vitória em cada quadra dá pontos de atributo
  permanentes ao seu jogador (aparecem em "Personalizar jogador") e libera a
  próxima fase. Quadras dominadas ficam disponíveis no "Jogo contra IA".
- O progresso fica salvo no navegador; o mapa da campanha tem a opção de
  reiniciar.

## Funcionalidades

- **Quadra e arena:** piso de madeira com marcações oficiais (FIBA), garrafões,
  linhas de 3 pontos, círculos, duas cestas com tabela de vidro, aro, rede
  animada e relógio de posse. Arquibancadas com público animado (instancing),
  bancos com reservas, mesa oficial, placas de LED com rolagem, placar
  eletrônico suspenso, iluminação de arena e dois temas de quadra.
- **Jogadores:** personagens estilizados com corpo e rosto personalizáveis
  (altura, físico, rosto, pele, cabelo, barba, olhos, faixa, tênis), uniforme
  com número e nome. Animações procedurais de caminhada, corrida, drible,
  salto, arremesso, passe, bandeja, enterrada, roubo, toco, postura de defesa,
  crossover, desequilíbrio e comemorações.
- **Física da bola:** gravidade, quique no piso, colisão com aro (toro), tabela,
  rede, paredes, efeito de rotação; detecção de cesta pela passagem no aro.
- **Regras:** cestas de 1, 2 e 3 pontos, cronômetro de quarto, relógio de 24 s,
  posse, faltas (no arremesso, tapa, bloqueio, ataque), bônus de faltas
  coletivas, lances livres (incluindo "e-um"), bola fora, violação, bola presa,
  quartos, intervalo, prorrogação, vitória/derrota e box score.
- **IA:** marcação individual com ajuda, contestação e tocos, roubos,
  interceptação de passes, espaçamento ofensivo, cortes para a cesta,
  infiltrações contornando o marcador, decisão entre arremessar/passar/infiltrar,
  disputa de rebotes e recomposição defensiva. Erros ocasionais e tempo de reação.
- **Dificuldades:** Fácil (mais lenta, menos precisa, reação demorada), Normal e
  Difícil (melhor posicionamento, reação rápida, mais precisão, defesa mais
  agressiva).
- **Câmera:** terceira pessoa atrás do jogador (gira suavemente com a
  movimentação, mantém a bola no quadro, abre o enquadramento nos arremessos),
  câmera de transmissão opcional e tomadas cinematográficas (cestas, fim de jogo).
- **Interface:** placar com pontuação, cronômetro, relógio de posse, indicador de
  posse e faltas; cartão do jogador com energia; barra de arremesso; mensagens e
  animação de pontos; dicas de controle.
- **Áudio (100% procedural, Web Audio):** quique, aro, tabela, rede, tênis,
  apito, buzina, torcida (ambiente, vibração e palmas), efeitos de pontuação e
  músicas de menu e de partida.
- **Modos:** Partida rápida, Jogo contra IA (times, dificuldade, 1x1 a 5x5,
  duração, quadra), Campanha (8 quadras pós-apocalípticas) e Treinamento
  (estatísticas, defensor opcional, lances livres).
- **Configurações:** dificuldade, câmera, qualidade gráfica (baixa/média/alta com
  reflexos no piso), volumes, dicas e troca automática de jogador.

## Estrutura do projeto

```
index.html                     Jogo em arquivo único, GERADO por build.mjs (abre sem servidor)
dev.html, css/style.css        Página-fonte (módulos ES) e estilos da interface
lib/three/                     Three.js (r170) + addon Reflector
src/
  main.js                      Ponto de entrada
  core/      Game.js (ciclo, estados, ligação dos sistemas), World.js (mundo da
             partida: jogadores, bola, recepção, tocos, colisões), EventBus, MathUtils
  config/    Constants (medidas oficiais), Settings (persistência), Difficulty
  data/      Teams (times/elencos fictícios), PlayerProfile (jogador criado + progressão)
  court/     Court (piso e marcações), Hoop (tabela/aro/rede), Arena (público,
             placar, luzes, decoração), Wasteland (cenário pós-apocalíptico),
             Crowd (público instanciado), CourtThemes (quadras)
  campaign/  CampaignData (fases, gangues, modificadores, recompensas),
             CampaignProgress (progresso salvo)
  entities/  Player (atleta), CharacterModel (modelo 3D), Animator (animações), Ball,
             DribbleMoves (catálogo de dribles)
  physics/   BallPhysics (colisões e cesta), ShotCalculator (trajetória e precisão)
  controls/  InputManager (teclado/controle), HumanController
  ai/        TeamAI (coordenação coletiva), AIController (decisões individuais)
  camera/    CameraController
  rules/     MatchRules (regras), TrainingRules, ScoreSystem, Formations
  audio/     AudioManager (efeitos), MusicPlayer (música procedural)
  ui/        HUD, Menus
  modes/     GameMode (base), MatchMode, TrainingMode, CampaignMode, ModeRegistry
  fx/        Particles
```

### Pontos de extensão

- **Multiplayer:** os atletas recebem "intenções" de um controlador
  (`HumanController`, `AIController`). Um `NetworkController` com a mesma
  interface permite jogadores remotos; o `EventBus` do `World` já centraliza os
  eventos de jogo para sincronização.
- **Campeonato / novos modos:** crie uma classe que estenda `GameMode` e registre
  em `modes/ModeRegistry.js`.
- **Criação de jogador e evolução de atributos:** `data/PlayerProfile.js` já tem
  `level`, `xp` e `bonusAttrs`, somados aos atributos do arquétipo.
- **Diferentes quadras:** adicione um tema em `court/CourtThemes.js` (com
  `venue: 'wasteland'` para usar o cenário pós-apocalíptico).
- **Novas fases da campanha:** adicione uma entrada em `campaign/CampaignData.js`.
- **Novos dribles:** adicione o movimento em `entities/DribbleMoves.js` e a pose
  em `Animator.dribbleMovePose`.
- **Diferentes equipes:** adicione entradas em `data/Teams.js`.
