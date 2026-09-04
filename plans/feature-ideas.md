# Top Priority 

- tela caixinhas tem que exibir saldo de cada caixinha
- tela Mês.
  - Icones com cores para representar as transações.

# Docs

- diagrama com endpoints existentes, para que servem e onde são usados
- diagram das estrutura do backend - mermaid componentes?
- atualizar banco de dados erd - erd.mermaid

# Feature Ideas

- Generic `config` JSON field on `User` (instead of a dedicated settings table) to hold all user settings (e.g. `locale`, and whatever future Settings screen options get added), avoiding a new table per setting.

# Improvements

- Tag de Depósito, Retirada e Transferência parecem chamar muita atenção para as transações de caixinhas. Precisa delas?
- Uniformizar todos os info box nas janelas de criar/editar/remover/etc - todos azuis
- Revisar todos os placeholder, sem padrão, numa mesma tela tem campos com e outros sem
- Todas as hints de campos ficam em tooltip ao inves de ficar abaixo do campo

- operação caixinha - transferir
  - quando valor acima do disponivel, erro aparece em 2 locais, capturar imagem para issue.

- tela Mês. 
  - Persistir filtros e ordenação na URL ou entre navegações de mês (hoje ambos resetam ao trocar de mês).
  - For the each row. I don't know if I like the Edit and Remove icon always visible for all rows. What options do we have?
  - Button Month/Year and Today on the top of the screen, don't look like a button, they need some color or border.
  - quando clica no gráfico de dias, filtra o dia, mas não tem botão claro de limpar filtros. Deveria add filtro na URL e detectar e botão limpar filtro ficar ativo.