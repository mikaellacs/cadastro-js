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

// Criação das tabelas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS centro_custo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cadastros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    categoria TEXT NOT NULL,
    valor REAL NOT NULL,
    data TEXT NOT NULL,
    centro_custo TEXT NOT NULL
  )`);
});

// ROTAS

// Criar categoria
app.post('/categorias', (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório.' });

  db.run('INSERT INTO categorias (nome) VALUES (?)', [nome], function (err) {
    if (err) {
      return res
        .status(500)
        .json({ error: 'Categoria já existe ou erro interno.' });
    }
    res.json({ id: this.lastID, nome });
  });
});

// Criar centro de custo
app.post('/centro-custo', (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório.' });

  db.run('INSERT INTO centro_custo (nome) VALUES (?)', [nome], function (err) {
    if (err) {
      return res
        .status(500)
        .json({ error: 'Centro de custo já existe ou erro interno.' });
    }
    res.json({ id: this.lastID, nome });
  });
});

// Buscar categorias
app.get('/categorias', (req, res) => {
  db.all('SELECT nome FROM categorias', [], (err, rows) => {
    if (err)
      return res.status(500).json({ error: 'Erro ao buscar categorias.' });
    res.json(rows);
  });
});

// Buscar centros de custo
app.get('/centro-custo', (req, res) => {
  db.all('SELECT nome FROM centro_custo', [], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ error: 'Erro ao buscar centros de custo.' });
    res.json(rows);
  });
});

// Cadastro de nova entrada
app.post('/cadastro', (req, res) => {
  const { descricao, categoria, valor, data, centro_custo } = req.body;
  if (!descricao || !categoria || !valor || !data || !centro_custo) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  db.run(
    'INSERT INTO cadastros (descricao, categoria, valor, data, centro_custo) VALUES (?, ?, ?, ?, ?)',
    [descricao, categoria, valor, data, centro_custo],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Exportar para Excel
app.get('/exportar-excel', async (req, res) => {
  db.all('SELECT * FROM cadastros', [], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cadastros');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Descrição', key: 'descricao', width: 30 },
      { header: 'Categoria', key: 'categoria', width: 20 },
      { header: 'Valor', key: 'valor', width: 15 },
      { header: 'Data', key: 'data', width: 15 },
      { header: 'Centro de Custo', key: 'centro_custo', width: 25 },
    ];

    rows.forEach((row) => {
      worksheet.addRow(row);
    });

    const filePath = path.join(__dirname, 'cadastros.xlsx');
    await workbook.xlsx.writeFile(filePath);

    res.download(filePath, 'cadastros.xlsx', (err) => {
      if (err) {
        console.error('Erro ao enviar arquivo:', err);
      }
      fs.unlinkSync(filePath); // apaga o arquivo temporário após envio
    });
  });
});

// Zerar todos os cadastros
app.post('/zerar', (req, res) => {
  db.run('DELETE FROM cadastros', (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao apagar dados.' });
    res.json({ message: 'Dados zerados com sucesso!' });
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta: ${PORT}`);
});
