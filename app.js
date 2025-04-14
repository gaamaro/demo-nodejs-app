// Inicializar OpenTelemetry antes de qualquer outra importação
require('./tracing').setupOpenTelemetry();

// app.js - com OpenTelemetry integrado (versão simplificada)
const express = require('express');
const axios = require('axios');
const os = require('os');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { trace } = require('@opentelemetry/api');

const app = express();
const port = 3000;

// Criar diretório de logs se não existir
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Criar um tracer para nossa aplicação
const tracer = trace.getTracer('observability-demo-app');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Logger integrado com OpenTelemetry
const logStream = fs.createWriteStream(path.join(__dirname, 'logs/app.log'), { flags: 'a' });
function log(level, message, meta = {}) {
  const currentSpan = trace.getActiveSpan();
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
    // Adicionar informações de trace para correlação se disponível
    traceId: currentSpan?.spanContext?.().traceId,
    spanId: currentSpan?.spanContext?.().spanId,
  };
  
  const logLine = JSON.stringify(logEntry);
  logStream.write(logLine + '\n');
  if (level === 'error') console.error(logLine);
  else console.log(logLine);
}

// Feature toggles (simples, em memória)
let features = {
  simulateFailures: false,
  rpsLimit: 1,
  stressMode: false,
  simulateLatency: false,
  latencyDuration: 0,
  externalCallPercentage: 100
};

// Loadgen automático baseado no RPS configurado com OpenTelemetry
setInterval(() => {
  if (features.rpsLimit > 0) {
    for (let i = 0; i < features.rpsLimit; i++) {
      tracer.startActiveSpan('loadgen.iteration', async (span) => {
        try {
          const shouldCallExternal = Math.random() * 100 < features.externalCallPercentage;
          span.setAttribute('app.loadgen.call_external', shouldCallExternal);

          if (shouldCallExternal) {
            const start = Date.now();
            
            tracer.startActiveSpan('external.api.call', async (apiSpan) => {
              try {
                const response = await axios.get('https://httpbin.org/get', { timeout: 3000 });
                
                const duration = Date.now() - start;
                
                apiSpan.setAttribute('http.status_code', response.status);
                
                if (features.simulateFailures && Math.random() < 0.3) {
                  throw new Error('Simulated failure');
                }
                
                log('info', 'Requisição externa bem-sucedida', { durationMs: duration });
              } catch (err) {
                apiSpan.setStatus({ code: 2 }); // ERROR
                
                log('error', 'Erro em requisição externa', { error: err.message || err.code });
              } finally {
                apiSpan.end();
              }
            });
          } else {
            log('info', 'Requisição ignorou API externa');
          }
        } catch (error) {
          span.setStatus({ code: 2 }); // ERROR
        } finally {
          span.end();
        }
      });
    }
  }
}, 1000);

// Simulação de carga de CPU/memória
function stressSystem() {
  if (features.stressMode) {
    log('info', 'Iniciando stress de CPU e memória');
    const end = Date.now() + 100;
    while (Date.now() < end) {
      Math.sqrt(Math.random() * Number.MAX_SAFE_INTEGER);
    }
    const arr = new Array(100000).fill("A");
  }
}

// Simulação de latência
function simulateLatency(cb) {
  if (features.simulateLatency) {
    log('info', 'Simulando latência', { delayMs: features.latencyDuration });
    setTimeout(cb, features.latencyDuration);
  } else {
    cb();
  }
}

// Endpoint interno
app.get('/internal', (req, res) => {
  tracer.startActiveSpan('internal.endpoint', (span) => {
    simulateLatency(() => {
      stressSystem();
      
      log('info', 'Chamada ao endpoint interno');
      
      span.end();
      res.send('Internal endpoint ok');
    });
  });
});

// Endpoint para forçar erro 500
app.get('/force-error', (req, res) => {
  tracer.startActiveSpan('force.error', (span) => {
    log('error', 'Erro 500 simulado manualmente');
    
    span.setStatus({ code: 2 }); // ERROR
    span.end();
    
    res.status(500).send('Erro 500 simulado');
  });
});

// Frontend com gráficos
app.get('/', (req, res) => {
  res.render('index', { features });
});

app.post('/update-features', (req, res) => {
  tracer.startActiveSpan('update.features', (span) => {
    features.simulateFailures = req.body.simulateFailures === 'on';
    features.stressMode = req.body.stressMode === 'on';
    features.simulateLatency = req.body.simulateLatency === 'on';
    features.latencyDuration = parseInt(req.body.latencyDuration) || 0;
    features.rpsLimit = parseInt(req.body.rpsLimit) || 0;
    features.externalCallPercentage = parseInt(req.body.externalCallPercentage) || 100;
    
    log('info', 'Atualização de toggles via frontend', { features });
    
    span.end();
    res.redirect('/');
  });
});

app.listen(port, () => {
  log('info', `App de observabilidade rodando em http://localhost:${port}`);
});