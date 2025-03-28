const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const app = express();
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

app.use(cors());
app.use(express.json());

// criar tabelas se não existirem
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      nome TEXT UNIQUE NOT NULL
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS centro_custo (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      nome TEXT UNIQUE NOT NULL
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS cadastros (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      descricao TEXT NOT NULL, 
      categoria TEXT NOT NULL, 
      valor REAL NOT NULL, 
      data TEXT NOT NULL, 
      centro_custo TEXT NOT NULL
    )`
  );

  // Inserir categorias padrão, se a tabela estiver vazia
  db.serialize(() => {
    db.get('SELECT COUNT(*) AS count FROM categorias', (err, row) => {
      if (row.count === 0) {
        const categorias = ['Categoria 1', 'Categoria 2', 'Categoria 3'];
        categorias.forEach((categoria) => {
          // Aqui, 'categoria' agora está definida no escopo da função
          db.run(
            'INSERT OR IGNORE INTO categorias (nome) VALUES (?)',
            [categoria],
            function (err) {
              if (err) {
                console.log('Erro ao inserir categoria:', categoria, err);
              }
            }
          );
        });
      }
    });

    // Inserir centros de custo padrão, se a tabela estiver vazia
    db.get('SELECT COUNT(*) AS count FROM centro_custo', (err, row) => {
      if (row.count === 0) {
        const centrosCusto = ['Centro 1', 'Centro 2', 'Centro 3'];
        centrosCusto.forEach((centro) => {
          // Aqui, 'centro' agora está definido no escopo da função
          db.run(
            'INSERT OR IGNORE INTO centro_custo (nome) VALUES (?)',
            [centro],
            function (err) {
              if (err) {
                console.log('Erro ao inserir centro de custo:', centro, err);
              }
            }
          );
        });
      }
    });
  });
});

// criar uma nova categoria
app.post('/categorias', (req, res) => {
  const { nome } = req.body;

  // Verifica se o nome foi enviado
  if (!nome) {
    return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
  }

  // Inserir a categoria na tabela
  db.run('INSERT INTO categorias (nome) VALUES (?)', [nome], function (err) {
    if (err) {
      console.log('Erro ao cadastrar categoria:', err);
      return res
        .status(500)
        .json({ error: 'Erro ao cadastrar categoria. Ela pode já existir.' });
    }
    res.json({ id: this.lastID, nome });
  });
});

// criar um novo centro de custo
app.post('/centro-custo', (req, res) => {
  const { nome } = req.body;

  // Verifica se o nome foi enviado
  if (!nome) {
    return res
      .status(400)
      .json({ error: 'Nome do centro de custo é obrigatório.' });
  }

  // Inserir o centro de custo na tabela
  db.run('INSERT INTO centro_custo (nome) VALUES (?)', [nome], function (err) {
    if (err) {
      console.log('Erro ao cadastrar centro de custo:', err);
      return res.status(500).json({
        error: 'Erro ao cadastrar centro de custo. Ele pode já existir.',
      });
    }
    res.json({ id: this.lastID, nome });
  });
});

// obter categorias do banco
app.get('/categorias', (req, res) => {
  db.get(
    'SELECT nome FROM categorias WHERE nome = ?',
    [categoria],
    (err, cat) => {
      if (err || !cat)
        return res.status(400).json({ error: 'Categoria não encontrada.' });
    }
  );
});

// obter centros de custo do banco
app.get('/centro-custo', (req, res) => {
  db.get(
    'SELECT nome FROM centro_custo WHERE nome = ?',
    [centro_custo],
    (err, cc) => {
      if (err || !cc)
        return res
          .status(400)
          .json({ error: 'Centro de Custo não encontrado.' });

      // inserção no banco
    }
  );
});

// salvar um novo cadastro (com validação)
app.post('/cadastro', (req, res) => {
  const { descricao, categoria, valor, data, centro_custo } = req.body;

  // verificar se a categoria e o centro de custo existem
  db.get(
    'SELECT nome FROM categorias WHERE nome = ?',
    [categoria],
    (err, cat) => {
      if (err || !cat)
        return res.status(400).json({ error: 'Categoria não encontrada.' });

      db.get(
        'SELECT nome FROM centro_custo WHERE nome = ?',
        [centro_custo],
        (err, cc) => {
          if (err || !cc)
            return res
              .status(400)
              .json({ error: 'Centro de Custo não encontrado.' });

          // Agora a inserção é realizada apenas após a verificação
          db.run(
            'INSERT INTO cadastros (descricao, categoria, valor, data, centro_custo) VALUES (?, ?, ?, ?, ?)',
            [descricao, categoria, valor, data, centro_custo],
            function (err) {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ id: this.lastID });
            }
          );
        }
      );
    }
  );
});

// zerar os cadastros
app.post('/zerar', (req, res) => {
  db.run('DELETE FROM cadastros', (err) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao zerar os dados.' });
    }
    res.json({ message: 'Dados zerados com sucesso!' });
  });
});

// exportar cadastros para excel
app.get('/exportar-excel', async (req, res) => {
  db.all(
    `SELECT cadastros.id, cadastros.descricao, cadastros.categoria, cadastros.valor, cadastros.data, centro_custo.nome AS centro_custo
     FROM cadastros
     LEFT JOIN centro_custo ON cadastros.centro_custo = centro_custo.nome`,
    [],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      let planilhaNumero = 1;
      let filePath = path.join(__dirname, `cadastro${planilhaNumero}.xlsx`);

      while (fs.existsSync(filePath)) {
        planilhaNumero++;
        filePath = path.join(__dirname, `cadastro${planilhaNumero}.xlsx`);
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Cadastro${planilhaNumero}`);

      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Descrição', key: 'descricao', width: 30 },
        { header: 'Categoria', key: 'categoria', width: 20 },
        { header: 'Valor', key: 'valor', width: 15 },
        { header: 'Data', key: 'data', width: 15 },
        { header: 'Centro de Custo', key: 'centro_custo', width: 20 },
      ];

      rows.forEach((row) => {
        worksheet.addRow(row);
      });

      // salvar o arquivo Excel com o nome correto
      await workbook.xlsx.writeFile(filePath);

      // enviar o arquivo
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${path.basename(filePath)}`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      // enviar o arquivo para download
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error('Erro ao enviar arquivo:', err);
        } else {
          console.log('Arquivo enviado com sucesso!');
        }

        // excluir o arquivo temporário
        fs.unlinkSync(filePath);
      });

      // limpar a tabela de cadastros após a exportação
      db.run('DELETE FROM cadastros', function (err) {
        if (err) {
          console.error('Erro ao limpar tabela de cadastros:', err);
        } else {
          console.log('Tabela de cadastros foi limpa com sucesso!');
        }
      });
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
