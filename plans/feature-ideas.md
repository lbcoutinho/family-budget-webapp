# Feature Ideas

Ideas recorded for future features — no milestone or deadline defined yet. Prioritization and brainstorming will be done at a later stage.

- Import bank/account statement (format TBD — CSV, XML or other): user uploads a statement file; system detects entries already registered to avoid duplicates; new entries are created as `DRAFT` transactions for the user to review, categorize, and approve.
- Personal note field on transactions: separate from the statement/imported description (which stays as-is from the bank), a free-text field for the user's own explanation of what the expense was, to help them remember it later.
- Toggle on the transactions screen to switch the displayed text between the personal note and the real transaction description; when a transaction has no personal note, keep showing the normal description.
- Generic `config` JSON field on `User` (instead of a dedicated settings table) to hold all user settings (e.g. `locale`, and whatever future Settings screen options get added), avoiding a new table per setting.
- Assessibility improv with lighthouse in chrome
- tela Mês. Icones com cores para representar as transações.



# Tests

- Testar cashbox transfer - parece que exige uma conta associada e todas as transações. pode fazer sentido pq o dinheiro da cashbox está em algum banco.
- tela Mês.
  - Infinite scroll loads subsequent pages
  - How it shows credit card entries.
  - Test on mobile
  - Testar como recorrências aparecem na tela Mês.

# Improvements
- improve path for "/month/{year}/{month}" feels wrong, should be query param? 
- Tag de Depósito, Retirada e Transfeência parecem chamar muita atenção para as transações de caixinhas. Precisa delas?
- tela Mês. Reservar cores ambar para caixinha (#a85c1a) e verde para income (#1f6f54). Substituir essas no seletor de cores de categoria.
- tela Mês. componentes sem ação.
  - Botão Movimentar caixinhas - sem ação - #155
  - Botão Novo lançamento - sem ação - #154
  - Despesas dia a dia - sem gráfico - new ticket
  - Cards de contas - sem dados - #157
  - Filtros - sem ação - new ticket
  - Ordenação - apenas 1 tipo - new ticket
  - Editar e remover lançamento - sem ação - #156
  - Saldo da conta após aplicar lançamento (valor abaixo do valor da transação) - sem ação - #157

# Bugs

- 