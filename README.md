# SkyHoop Arena — Basquete 3D

Protótipo jogável de um jogo de basquete 3D estilizado, feito com **Three.js** e
JavaScript puro (módulos ES), sem etapa de build. Inclui partida completa contra a
IA (do salto inicial ao fim do jogo), treinamento, personalização de jogador,
física 3D da bola, áudio procedural e menus.

Todos os times, nomes, marcas e uniformes são fictícios.

## Como rodar

**Jeito mais fácil:** abra `dist/skyhoop.html` com duplo clique. É um único
arquivo autocontido (Three.js, estilos e código embutidos) que funciona offline,
sem servidor.

**Desenvolvimento:** o código-fonte usa módulos ES, então o `index.html` precisa
ser servido por HTTP (abrir direto do disco não funciona):

```bash
npm start            # ou: node server.mjs 8080   (Node 18+, sem dependências)
# alternativa: python3 -m http.server 8080
```

Depois abra <http://localhost:8080>. A biblioteca Three.js está incluída em
`lib/three/`.

Após alterar o código, regenere o arquivo único com:

```bash
npm install          # instala o esbuild (só para o build)
npm run build        # gera dist/skyhoop.html
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
| Drible especial (crossover) | X / U | B |
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
  duração, quadra) e Treinamento (estatísticas, defensor opcional, lances livres).
- **Configurações:** dificuldade, câmera, qualidade gráfica (baixa/média/alta com
  reflexos no piso), volumes, dicas e troca automática de jogador.

## Estrutura do projeto

```
index.html, css/style.css     Página e estilos da interface
build.mjs → dist/skyhoop.html  Versão em arquivo HTML único (abre sem servidor)
lib/three/                     Three.js (r170) + addon Reflector
src/
  main.js                      Ponto de entrada
  core/      Game.js (ciclo, estados, ligação dos sistemas), World.js (mundo da
             partida: jogadores, bola, recepção, tocos, colisões), EventBus, MathUtils
  config/    Constants (medidas oficiais), Settings (persistência), Difficulty
  data/      Teams (times/elencos fictícios), PlayerProfile (jogador criado + progressão)
  court/     Court (piso e marcações), Hoop (tabela/aro/rede), Arena (público,
             placar, luzes, decoração), CourtThemes (quadras)
  entities/  Player (atleta), CharacterModel (modelo 3D), Animator (animações), Ball
  physics/   BallPhysics (colisões e cesta), ShotCalculator (trajetória e precisão)
  controls/  InputManager (teclado/controle), HumanController
  ai/        TeamAI (coordenação coletiva), AIController (decisões individuais)
  camera/    CameraController
  rules/     MatchRules (regras), TrainingRules, ScoreSystem, Formations
  audio/     AudioManager (efeitos), MusicPlayer (música procedural)
  ui/        HUD, Menus
  modes/     GameMode (base), MatchMode, TrainingMode, ModeRegistry
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
- **Diferentes quadras:** adicione um tema em `court/CourtThemes.js`.
- **Diferentes equipes:** adicione entradas em `data/Teams.js`.
