# Top Priority 
- "Saldo indisponível" em todas as linhas da tela Mês.
- Fix impeccable critique and audit
- utilizar skills de frontend para analisar projeto
- executar /improve-codebase-architecture
- exec /web-design-guidelines
- exec /vercel-composition-patterns
- exec /vercel-react-best-practices

- import csv - category suggestions
  1. Search confirmed historical transactions from the same account by exact normalized description.
  2. Suggest category and subcategory only when all relevant matches agree.
  3. Keep every imported transaction in `DRAFT`, including transactions with suggestions.
  4. Leave categories empty when no unambiguous match exists.
  5. Add approximate-description matching only after real import history provides examples and confidence rules can be specified.

# Docs

- diagrama com endpoints existentes, para que servem e onde são usados
- diagram das estrutura do backend - mermaid componentes?
- atualizar banco de dados erd - erd.mermaid

# Feature Ideas

- Generic `config` JSON field on `User` (instead of a dedicated settings table) to hold all user settings (e.g. `locale`, and whatever future Settings screen options get added), avoiding a new table per setting.
- tela Mês.
  - Icones com cores para representar as transações.


# Improvements
- Assessibility improv with lighthouse in chrome
- improve path for "/month/{year}/{month}" feels wrong, should be query param? 
- Tag de Depósito, Retirada e Transfeência parecem chamar muita atenção para as transações de caixinhas. Precisa delas?
- tela Mês. 
  - Botões de ação não tem cor de hover
  - Saldo da conta após aplicar lançamento (valor abaixo do valor da transação) - sem ação - #157
  - Filtros de subcategoria, caixinha, cartão de crédito e intervalo de datas — a API já suporta todos, o protótipo não desenha nenhum.
  - Ordenação por descrição com collation por locale: o Postgres ordena pela collation do banco, não pelo `pt-BR`, então descrições acentuadas caem fora da ordem que o usuário espera. Exige índice collation-aware ou coluna de ordenação normalizada.
  - Persistir filtros e ordenação na URL ou entre navegações de mês (hoje ambos resetam ao trocar de mês).
  - For the each row. I don't know if I like the Edit and Remove icon always visible for all rows. What options do we have?
  - Button Month/Year and Today on the top of the screen, don't look like a button, they need some color or border.
  - Botão novo lançamento, poderia ser como botão caixinhas, cor suave e ganha verde atual quando fizer hover.
  - quando clica no gráfico de dias, filtra o dia, mas não tem botão claro de limpar filtros. Deveria add filtro na URL e detectar e botão limpar filtro ficar ativo.
  - Tela mes - Reservar cores ambar para caixinha (#a85c1a) e verde para income (#1f6f54). Substituir essas no seletor de cores de categoria.

- Uniformizar todos os info box nas janelas de criar/editar/remover/etc - todos azuis
- Revisar todos os placeholder, sem padrão, numa mesma tela tem campos com e outros sem

  
- Remove hint de valor de todas as telas: "Aceita 1.234,56 e 1234.56."
- Todas as hints de campos ficam em tooltip ao inves de ficar abaixo do campo
- operação caixinha - transferir
  - quando valor acima do disponivel, erro aparece em 2 locais, capturar imagem para issue.
- config > geral
  - mudar area de idioma - parece que tem um titulo idioma e depois um card. melhorar descrição.

- relatórios
  - seletor de data deve estar no lado esquerdo como na tela mês

# Bugs

- 