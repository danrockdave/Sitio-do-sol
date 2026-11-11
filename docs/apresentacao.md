# Roteiro da apresentação (≈ 10 min)

## Slides

1. **Sítio do Sol**: fazendinha 3D em WebGL 2 puro (imagem da tela de título).
2. **O jogo**: plantar, regar, colher, animais, frutas, pesca, galpão, encomendas da vila, clima e uma história em 7 capítulos sobre o ipê do avô; depois o sítio continua sem fim.
3. **Restrições do trabalho**: só WebGL + gl-matrix; canvas só como contexto; leitor OBJ próprio.
4. **Arquitetura**: `loaders` → `gl` → `render` → `game` → `ui` (diagrama das pastas).
5. **Leitor OBJ**: faces n-gon, índices negativos, normais geradas, partes para animação, MTL.
6. **Câmera**: terceira pessoa, `perspective` + `lookAt`, órbita (yaw/pitch/distância), seguir com suavização.
7. **Phong**: fórmula, R = reflect(−L, N); mostrar ao vivo com `F4` (ambiente, difusa, especular, normais).
8. **Luzes em movimento**: ciclo dia/noite (sol e lua), lampiões e a lanterna do fazendeiro.
9. **Sombras**: shadow map ortográfico, PCF, *texel snapping* (mostrar `F2` liga/desliga).
10. **Animações por transformações**: pivôs `T(p)·R·T(−p)` em pernas, braços, cabeça, moinho, tampa da caixa, máquinas do galpão, bandeira do correio e lançamento da vara; linha de pesca construída como matriz que alinha +Y ao segmento; vento e ondas no vertex shader.
11. **Texturas**: PPM com leitor próprio, *splat map* grama/terra no chão.
12. **Desempenho**: instancing automático (cercas, grama, plantas), estatísticas com `F3`.
13. **HUD em WebGL**: fonte SDF, ícones renderizados dos próprios modelos em framebuffer MSAA.
14. **Som sintetizado**: música gerativa dia/noite e efeitos feitos só com osciladores e ruído (Web Audio).
15. **Demonstração ao vivo**.
16. **Dificuldades e aprendizados**.

## Demonstração (ou vídeo de 2 a 3 min)

1. Tela de título com a câmera orbitando ao entardecer.
2. Novo jogo: arar, plantar cenoura, regar (mostrar a terra escurecendo).
3. `T` para acelerar: a planta cresce em estágios; colher com a cesta.
4. Coletar ovos e leite dos animais, colher maçãs.
5. Vender na caixa (tampa abrindo) e comprar uma melhoria na loja.
6. Anoitecer: lampiões, janelas acesas, vaga-lumes, lanterna do fazendeiro.
7. `F4` passando pelas visualizações do Phong; `F2` sombras; `F3` estatísticas.
8. Pescar no lago (boia, ondas, minijogo do ponteiro) e mostrar o peixe no álbum do diário (`J`).
9. Galpão: o telhado sobe quando o fazendeiro entra; queijaria e forno funcionando (fogo com luz pontual).
10. Dia de chuva: céu cinza, gotas, chão molhado com brilho especular, ondas no lago.
8. Dormir na casa (transição e salvamento).
