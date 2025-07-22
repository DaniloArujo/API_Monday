# API_Monday
Consume a API externa do Monday para salvar os registros em um banco de dados MYSQL


📝 Descrição
Este projeto realiza integração automática entre boards do Monday.com e um banco MySQL, coletando dados via GraphQL e sincronizando em três tabelas relacionais (boards, items, column_values) para análise e relatórios internos.

🛠️ Tecnologias Utilizadas
Node.js (JavaScript)

Axios (requisições HTTP)

MySQL2/promise (conexão MySQL com suporte a async/await)

Monday.com API (GraphQL)

📦 Estrutura do Projeto
pgsql
Copiar
Editar
project-root/
├── index.js (ou app.js) - script principal
├── package.json
└── .env (opcional para variáveis sensíveis)
⚙️ Configuração Inicial
1️⃣ Instalação das dependências:

bash
Copiar
Editar
npm install axios mysql2
2️⃣ Variáveis de configuração no topo do arquivo:

js
Copiar
Editar
// Monday.com
const API_URL = 'https://api.monday.com/v2';
const API_TOKEN = 'seu_token_aqui';
const BOARD_IDS = [8212773608, 8203856370, ...];

// MySQL
const DB_CONFIG = {
    host: 'localhost',
    user: 'usuario',
    password: 'senha',
    database: 'nome_do_banco',
    port: 3306
};
🗄️ Estrutura das Tabelas
1️⃣ boards:

Coluna	Tipo	Descrição
id	BIGINT (PK)	ID do board
name	VARCHAR(255)	Nome do board

2️⃣ items:

Coluna	Tipo	Descrição
id	BIGINT (PK)	ID do item
board_id	BIGINT (FK)	ID do board (relaciona com boards)
name	VARCHAR(255)	Nome do item
created_at	TIMESTAMP	Data de criação do item
group_name	VARCHAR(255)	Nome do grupo no board

3️⃣ column_values:

Coluna	Tipo	Descrição
item_id	BIGINT (PK, FK)	ID do item (relaciona com items)
responsaveis	TEXT	Responsáveis pelo item
status	VARCHAR(100)	Status do item
data	DATE	Data extraída da coluna "data"
data_mk	DATE	Data extraída de outra coluna específica
intervalo_tempo	VARCHAR(100)	Intervalo de tempo registrado

🚦 Fluxo do Script
1️⃣ Conexão com o MySQL via pool.

2️⃣ Busca dados do Monday.com via GraphQL:

Boards especificados em BOARD_IDS.

Coleta até 500 itens por board.

Retorna colunas de interesse: responsaveis, status, data, data_mk, intervalo_tempo.

3️⃣ Limpeza das tabelas (TRUNCATE) antes da nova sincronização.

4️⃣ Criação automática das tabelas se não existirem.

5️⃣ Inserção transacional dos dados:

Inserção em boards.

Inserção em items.

Inserção em column_values.

6️⃣ Commit da transação ou rollback em caso de erro.

7️⃣ Encerramento do pool e finalização do processo.

⚡ Comandos
Execute o script com:

bash
Copiar
Editar
node index.js
O script exibirá no console:

Quantidade de itens coletados.

Amostras dos dados.

Status de conexão com o banco.

Status da limpeza de dados.

Status de criação das tabelas.

Contagem de registros inseridos por tabela.

Mensagens de erro detalhadas caso ocorram.

🔒 Segurança
Não versionar API_TOKEN e credenciais do banco em repositórios públicos.

Utilize .env com dotenv para variáveis sensíveis caso publique este projeto.

Exemplo:

bash
Copiar
Editar
API_URL=https://api.monday.com/v2
API_TOKEN=seu_token
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=senha
DB_DATABASE=sync_monday
