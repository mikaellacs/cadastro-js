const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path'); // Para garantir caminhos corretos de arquivos

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
});

// Rota para listar categorias
app.get('/categorias', (req, res) => {
  db.all('SELECT nome FROM categorias', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Rota para listar centros de custo
app.get('/centro-custo', (req, res) => {
  db.all('SELECT nome FROM centro_custo', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/cadastro', (req, res) => {
  console.log('Recebendo um novo cadastro:', req.body);
  res.json({ message: 'Teste de resposta do servidor' });
});

// Exportar cadastros para Excel e zerar a tabela
app.get('/exportar-excel', async (req, res) => {
  db.all(
    `SELECT cadastros.id, cadastros.descricao, cadastros.categoria, cadastros.valor, cadastros.data, centro_custo.nome AS centro_custo
     FROM cadastros
     LEFT JOIN centro_custo ON cadastros.centro_custo = centro_custo.nome`,
    [],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Rota para zerar os cadastros
      app.post('/zerar', (req, res) => {
        db.run('DELETE FROM cadastros', (err) => {
          if (err) {
            return res.status(500).json({ error: 'Erro ao zerar os dados.' });
          }
          res.json({ message: 'Dados zerados com sucesso!' });
        });
      });

      // Determinar o nome da planilha com base no número
      let planilhaNumero = 1;
      let filePath = path.join(__dirname, `cadastro${planilhaNumero}.xlsx`);

      // Continuar procurando até encontrar um nome de arquivo que não exista
      while (fs.existsSync(filePath)) {
        planilhaNumero++;
        filePath = path.join(__dirname, `cadastro${planilhaNumero}.xlsx`);
      }

      // Criar um novo arquivo Excel com o número correto
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

      // Salvar o arquivo Excel com o nome correto
      await workbook.xlsx.writeFile(filePath);

      // Enviar o arquivo para o usuário
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${path.basename(filePath)}`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      // Enviar o arquivo para download
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error('Erro ao enviar arquivo:', err);
        } else {
          console.log('Arquivo enviado com sucesso!');
        }

        // Após enviar o arquivo, excluir o arquivo temporário
        fs.unlinkSync(filePath);
      });

      // Limpar a tabela de cadastros após a exportação
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

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
