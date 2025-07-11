const axios = require('axios');
const mysql = require('mysql2/promise');

// ⚙️ Configurações do Monday.com
const API_URL = '';
const API_TOKEN = ''; 
const BOARD_IDS = [8212773608, 8203856370, 8203887420, 8805355240, 8203892464];

// 🗄️ Configurações do MySQL
const DB_CONFIG = {
    host: '',
    user: '',
    password: '',
    database: '',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10
};

// Criar pool de conexões
const pool = mysql.createPool(DB_CONFIG);

// 📄 Query GraphQL otimizada
const query = `
  query {
    boards(ids: [${BOARD_IDS.join(',')}]) {
      id
      name
      items_page (limit: 500){
        items {
          id
          name
          created_at
          group {
            title
          }
          column_values(ids: ["person", "status", "data", "date_mkqw6eq0", "timerange_mkqwt8x1"]) {
            text
          }
        }
      }
    }
  }
`;

async function main() {
    console.log('Iniciando processo de sincronização Monday → MySQL');
    
    try {
        
        console.log('Coletando dados do Monday.com...');
        const items = await fetchMondayData();
        
        if (items.length === 0) {
            console.log('Nenhum dado encontrado para processar.');
            return;
        }

        
        const connection = await pool.getConnection();
        console.log('Conectado ao MySQL');

        try {
            
            console.log('Verificando/Criando tabelas...');
            await createTables(connection);

            
            console.log('Limpando dados existentes...');
            await clearTables(connection);

            
            console.log('Inserindo dados no MySQL...');
            await insertData(connection, items);
            
        } catch (err) {
            console.error('Erro durante a operação do banco:', err);
        } finally {
            
            connection.release();
            console.log('Conexão liberada');
        }
    } catch (error) {
        console.error('Erro no processo principal:', error);
    } finally {
        
        await pool.end();
        console.log('Pool de conexões encerrado');
        console.log('Processo finalizado!');
    }
}


async function clearTables(connection) {
    try {
        
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0;');
        
        
        await connection.execute('TRUNCATE TABLE column_values;');
        await connection.execute('TRUNCATE TABLE items;');
        await connection.execute('TRUNCATE TABLE boards;');
        
        
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1;');
        
        console.log('Dados antigos removidos com sucesso');
    } catch (error) {
        console.error(' Erro ao limpar tabelas:', error);
        throw error;
    }
}

async function fetchMondayData() {
    try {
        const response = await axios.post(API_URL, { query }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': API_TOKEN
            },
            timeout: 30000 
        });

        const boards = response.data.data.boards;
        const allItems = [];

        if (!boards || boards.length === 0) {
            console.error('Nenhum board encontrado.');
            return [];
        }

        boards.forEach(board => {
            if (!board.items_page || !board.items_page.items) {
                console.warn(`Board ${board.id} não possui itens`);
                return;
            }
            
            board.items_page.items.forEach(item => {
                
                const columnValues = {
                    responsaveis: item.column_values[0]?.text || null,
                    status: item.column_values[1]?.text || null,
                    data: item.column_values[2]?.text || null,
                    data_mk: item.column_values[3]?.text || null,
                    intervalo_tempo: item.column_values[4]?.text || null
                };
                
                allItems.push({
                    id: item.id,
                    board_id: board.id,
                    board_name: board.name,
                    name: item.name,
                    created_at: new Date(item.created_at),
                    group_name: item.group?.title || 'Sem Grupo',
                    ...columnValues
                });
            });
        });

        console.log(`${allItems.length} itens coletados de ${boards.length} boards`);
        
        
        if (allItems.length > 0) {
            console.log('\nAmostra dos dados coletados:');
            console.table(allItems.slice(0, 3), [
                'id', 'board_name', 'name', 'group_name', 'status'
            ]);
        }
        
        return allItems;

    } catch (error) {
        if (error.response) {
            
            console.error('Erro na API Monday:', {
                status: error.response.status,
                data: error.response.data
            });
        } else if (error.request) {
           
            console.error('Sem resposta do Monday:', error.message);
        } else {
            
            console.error('Erro na requisição ao Monday:', error.message);
        }
        return [];
    }
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    

    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate)) return isoDate;
    

    const brDateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brDateMatch) {
        return new Date(`${brDateMatch[3]}-${brDateMatch[2]}-${brDateMatch[1]}`);
    }
    

    const brDateTimeMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{1,2})$/);
    if (brDateTimeMatch) {
        return new Date(
            `${brDateTimeMatch[3]}-${brDateTimeMatch[2]}-${brDateTimeMatch[1]} ` +
            `${brDateTimeMatch[4]}:${brDateTimeMatch[5]}:00`
        );
    }
    
    console.warn(`Formato de data não reconhecido: ${dateStr}`);
    return null;
}

async function createTables(connection) {
    try {
        
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0;');
        
        
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS boards (
                id BIGINT PRIMARY KEY,
                name VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS items (
                id BIGINT PRIMARY KEY,
                board_id BIGINT NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                group_name VARCHAR(255) NOT NULL,
                INDEX idx_board_id (board_id),
                FOREIGN KEY (board_id) 
                    REFERENCES boards(id) 
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS column_values (
                item_id BIGINT PRIMARY KEY,
                responsaveis TEXT,
                status VARCHAR(100),
                data DATE,
                data_mk DATE,
                intervalo_tempo VARCHAR(100),
                FOREIGN KEY (item_id) 
                    REFERENCES items(id) 
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1;');

        console.log('Tabelas verificadas/criadas');
    } catch (error) {
        console.error('Erro ao criar tabelas:', error);
        throw error;
    }
}

async function insertData(connection, items) {
    try {
        
        await connection.beginTransaction();
        console.log('Transação iniciada');

        
        const boardInsertQuery = `
            INSERT IGNORE INTO boards (id, name) VALUES (?, ?);
        `;

        
        const itemInsertQuery = `
            REPLACE INTO items 
                (id, board_id, name, created_at, group_name) 
            VALUES (?, ?, ?, ?, ?);
        `;

        
        const columnInsertQuery = `
            REPLACE INTO column_values 
                (item_id, responsaveis, status, data, data_mk, intervalo_tempo)
            VALUES (?, ?, ?, ?, ?, ?);
        `;

        
        const boardsMap = new Map();
        let boardsCount = 0;
        
        for (const item of items) {
            if (!boardsMap.has(item.board_id)) {
                boardsMap.set(item.board_id, item.board_name);
                await connection.execute(boardInsertQuery, [item.board_id, item.board_name]);
                boardsCount++;
            }
        }
        console.log(`${boardsCount} boards processados`);

        
        let itemsCount = 0;
        let columnsCount = 0;
        
        for (const item of items) {
            
            await connection.execute(itemInsertQuery, [
                item.id,
                item.board_id,
                item.name,
                item.created_at,
                item.group_name
            ]);
            itemsCount++;
            
            
            const dataValue = item.data ? parseDate(item.data) : null;
            const dataMkValue = item.data_mk ? parseDate(item.data_mk) : null;
            
            
            await connection.execute(columnInsertQuery, [
                item.id,
                item.responsaveis,
                item.status,
                dataValue,
                dataMkValue,
                item.intervalo_tempo
            ]);
            columnsCount++;
        }

        
        await connection.commit();
        console.log('Transação confirmada');
        console.log(`Dados inseridos/atualizados: 
  → Boards: ${boardsCount}
  → Items: ${itemsCount}
  → Column Values: ${columnsCount}`);

    } catch (error) {
        await connection.rollback();
        console.error('Transação revertida devido a erros');
        console.error('Erro na inserção de dados:', error);
        throw error;
    }
}


main().catch(err => console.error('Erro global:', err));