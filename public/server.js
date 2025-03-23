const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { createObjectCsvWriter } = require('csv-writer');
const ExcelJS = require('exceljs');

const app = express();
const db = new sqlite3.Database(__dirname + '/../database.db');

app.use(cors());
app.use(express.json());

// Criar tabelas se não existirem
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

  // Inserir categorias padrão
  db.run('INSERT OR IGNORE INTO categorias (nome) VALUES');
  db.run('INSERT OR IGNORE INTO centro_custo (nome) VALUES');
});

// Criar uma nova categoria
app.post('/categorias', (req, res) => {
  const { nome } = req.body;
  if (!nome)
    return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });

  db.run('INSERT INTO categorias (nome) VALUES (?)', [nome], function (err) {
    if (err)
      return res
        .status(500)
        .json({ error: 'Erro ao cadastrar categoria. Ela pode já existir.' });
    res.json({ id: this.lastID, nome });
  });
});

// Criar um novo centro de custo
app.post('/centro-custo', (req, res) => {
  const { nome } = req.body;
  if (!nome)
    return res
      .status(400)
      .json({ error: 'Nome do centro de custo é obrigatório.' });

  db.run('INSERT INTO centro_custo (nome) VALUES (?)', [nome], function (err) {
    if (err)
      return res.status(500).json({
        error: 'Erro ao cadastrar centro de custo. Ele pode já existir.',
      });
    res.json({ id: this.lastID, nome });
  });
});

// Obter categorias do banco
app.get('/categorias', (req, res) => {
  db.all('SELECT * FROM categorias', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Obter centros de custo do banco
app.get('/centro-custo', (req, res) => {
  db.all('SELECT * FROM centro_custo', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Salvar um novo cadastro (com validação)
app.post('/cadastro', (req, res) => {
  const { descricao, categoria, valor, data, centro_custo } = req.body;

  // Verificar se a categoria e o centro de custo existem
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

// Exportar cadastros para Excel
app.get('/exportar-excel', async (req, res) => {
  db.all(
    `SELECT cadastros.id, cadastros.descricao, cadastros.categoria, cadastros.valor, cadastros.data, centro_custo.nome AS centro_custo
     FROM cadastros
     LEFT JOIN centro_custo ON cadastros.centro_custo = centro_custo.nome`,
    [],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Cadastros');

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

      res.setHeader(
        'Content-Disposition',
        'attachment; filename=cadastros.xlsx'
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      await workbook.xlsx.write(res);
      res.end();
    }
  );
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
