const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-us-east-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.cdwyizubhattqgogpqen',
  password: 'Pyganflor.1996',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => {
    console.log('Connected successfully!');
    return client.end();
  })
  .catch(err => {
    console.error('Connection error:', err.message);
  });
