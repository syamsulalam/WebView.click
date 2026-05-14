import { exec } from 'child_process';
const proc = exec('node dist/server.cjs');
setTimeout(() => {
  fetch('http://localhost:3000/api/schema')
    .then(r => r.text())
    .then(text => console.log('SCHEMA GET:', text.substring(0, 50)))
    .catch(console.error)
    .finally(() => {
      fetch('http://localhost:3000/api/settings', { method: 'POST', body: '{}', headers: {'content-type': 'application/json'} })
        .then(r => console.log('SETTINGS POST:', r.status))
        .finally(() => { proc.kill(); process.exit(0); });
    });
}, 2000);
